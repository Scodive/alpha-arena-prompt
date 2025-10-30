import copy
import json
import os
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path


def utc_now_iso() -> str:
    """Return current UTC time in ISO-8601 format with a Z suffix."""
    return datetime.utcnow().replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


class TradePoller:
    """Background worker that polls NOF1 trades and captures deltas."""

    def __init__(self, base_url: str, interval_seconds: float, cache_limit: int) -> None:
        self.base_url = base_url.rstrip("/")
        self.interval_seconds = max(interval_seconds, 10.0)
        self.cache_limit = max(cache_limit, 1)

        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

        self._initialized = False
        self._known_trade_ids: set[str] = set()
        self._recent_trades: List[Dict[str, Any]] = []
        self._new_trades: List[Dict[str, Any]] = []
        self._last_poll_started: str | None = None
        self._last_poll_completed: str | None = None
        self._last_error: str | None = None

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Accept": "application/json",
            "User-Agent": "nof1-trade-poller/0.1 (+https://nof1.ai)",
        }

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, name="TradePoller", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "initialized": self._initialized,
                "poll_interval_seconds": self.interval_seconds,
                "last_poll_started": self._last_poll_started,
                "last_poll_completed": self._last_poll_completed,
                "last_error": self._last_error,
                "recent_trades": copy.deepcopy(self._recent_trades),
                "new_trades": copy.deepcopy(self._new_trades),
            }

    def trigger_once(self) -> Dict[str, Any]:
        try:
            self._poll_once()
        except Exception as exc:  # pylint: disable=broad-except
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return self.snapshot()

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            start_time = time.monotonic()
            try:
                self._poll_once()
            except Exception as exc:  # pylint: disable=broad-except
                with self._lock:
                    self._last_error = str(exc)
                    self._last_poll_completed = utc_now_iso()
            elapsed = time.monotonic() - start_time
            wait_seconds = max(self.interval_seconds - elapsed, 1.0)
            if self._stop_event.wait(wait_seconds):
                break

    def _poll_once(self) -> None:
        started_at = utc_now_iso()
        with self._lock:
            self._last_poll_started = started_at

        url = f"{self.base_url}/trades"
        text = self._fetch(url)
        payload = json.loads(text)

        trades = payload.get("trades")
        if not isinstance(trades, list):
            raise ValueError("Unexpected trades payload shape")

        summaries = []
        incoming_ids: list[str] = []
        new_trades: list[dict[str, Any]] = []

        for trade in trades:
            if not isinstance(trade, dict):
                continue
            trade_id = str(trade.get("id") or trade.get("trade_id") or "")
            if not trade_id:
                continue
            incoming_ids.append(trade_id)
            summary = self._summarize_trade(trade)
            summaries.append(summary)
            if self._initialized and trade_id not in self._known_trade_ids:
                new_trades.append(summary)

        trimmed = summaries[: self.cache_limit]
        limited_new_trades = new_trades[: self.cache_limit]

        completed_at = utc_now_iso()
        with self._lock:
            self._recent_trades = trimmed
            self._new_trades = limited_new_trades
            self._known_trade_ids = set(incoming_ids)
            self._initialized = True
            self._last_poll_completed = completed_at
            self._last_error = None

    def _fetch(self, url: str) -> str:
        request = urllib.request.Request(url, headers=self.headers, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
                return body.decode("utf-8")
        except urllib.error.HTTPError as err:
            raise RuntimeError(f"HTTP error {err.code} {err.reason} for {url}") from err
        except urllib.error.URLError as err:
            raise RuntimeError(f"Failed to reach {url}: {err.reason}") from err

    @staticmethod
    def _summarize_trade(trade: Dict[str, Any]) -> Dict[str, Any]:
        trade_id = str(trade.get("id") or trade.get("trade_id") or "")
        entry_time = trade.get("entry_human_time") or trade.get("entry_time")
        exit_time = trade.get("exit_human_time") or trade.get("exit_time")
        return {
            "id": trade_id,
            "symbol": trade.get("symbol"),
            "side": trade.get("side"),
            "quantity": trade.get("quantity"),
            "entry_price": trade.get("entry_price"),
            "exit_price": trade.get("exit_price"),
            "entry_time": entry_time,
            "exit_time": exit_time,
            "realized_net_pnl": trade.get("realized_net_pnl"),
            "confidence": trade.get("confidence"),
            "model_id": trade.get("model_id"),
        }


def create_app() -> FastAPI:
    base_url = os.getenv("NOF1_BASE_URL", "https://nof1.ai/api")
    interval_seconds = float(os.getenv("TRADE_POLL_INTERVAL_SECONDS", "60"))
    cache_limit = int(os.getenv("TRADE_CACHE_LIMIT", "50"))

    app = FastAPI(title="NOF1 Trade Poller", version="0.1.0")
    poller = TradePoller(base_url=base_url, interval_seconds=interval_seconds, cache_limit=cache_limit)

    @app.on_event("startup")
    def _startup() -> None:
        poller.start()

    @app.on_event("shutdown")
    def _shutdown() -> None:
        poller.stop()

    @app.get("/api/trades/latest")
    def get_latest_trades() -> JSONResponse:
        snapshot = poller.snapshot()
        return JSONResponse(snapshot)

    @app.post("/api/trades/poll")
    def trigger_poll() -> JSONResponse:
        snapshot = poller.trigger_once()
        return JSONResponse(snapshot)

    frontend_dir = Path(__file__).resolve().parents[1] / "frontend"
    if frontend_dir.exists():
        app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

    return app


app = create_app()
