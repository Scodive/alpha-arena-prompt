"""
Serverless function for Vercel that fetches the latest NOF1 trades.

The function reuses the public NOF1 REST API and returns a concise payload
for the frontend to consume. It keeps the logic standalone so Vercel can
deploy it alongside static assets without a dedicated backend server.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any, Dict, List
from urllib.parse import parse_qs, urlparse

BASE_URL = os.getenv("NOF1_BASE_URL", "https://nof1.ai/api").rstrip("/")
DEFAULT_LIMIT = int(os.getenv("TRADE_DISPLAY_LIMIT", "60"))

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; AlphaArenaTicker/1.0; +https://vercel.com/)",
    "Accept-Language": "en-US,en;q=0.9",
}


def _utc_now() -> str:
    """Return the current UTC timestamp in ISO-8601 format."""
    return datetime.utcnow().replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _fetch_json(path: str) -> Dict[str, Any]:
    """Fetch JSON data from the NOF1 API."""
    url = f"{BASE_URL}{path}"
    request = urllib.request.Request(url, headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"HTTP {err.code} {err.reason}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"Failed to reach NOF1 API: {err.reason}") from err

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON from NOF1 API: {exc}") from exc
    return payload


def _coerce_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_trade(trade: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the fields needed by the frontend and normalise names."""
    entry_time = trade.get("entry_time") or trade.get("entry_human_time")
    exit_time = trade.get("exit_time") or trade.get("exit_human_time")
    leverage = trade.get("leverage")
    leverage_value = _coerce_float(leverage)

    return {
        "id": str(trade.get("trade_id") or trade.get("id") or ""),
        "model_id": trade.get("model_id"),
        "symbol": trade.get("symbol"),
        "side": trade.get("side"),
        "leverage": leverage_value,
        "raw_leverage": leverage,
        "quantity": trade.get("quantity"),
        "entry_price": _coerce_float(trade.get("entry_price")),
        "exit_price": _coerce_float(trade.get("exit_price")),
        "profit_target": _coerce_float((trade.get("exit_plan") or {}).get("profit_target")),
        "stop_loss": _coerce_float((trade.get("exit_plan") or {}).get("stop_loss")),
        "entry_time": entry_time,
        "exit_time": exit_time,
        "display_time": entry_time or exit_time,
        "realized_net_pnl": _coerce_float(trade.get("realized_net_pnl")),
        "confidence": _coerce_float(trade.get("confidence")),
    }


def _sort_trades(trades: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort trades by entry_time descending."""

    def sort_key(trade: Dict[str, Any]) -> tuple[int, str]:
        entry = trade.get("display_time")
        if isinstance(entry, str):
            return (0, entry)
        return (1, "")

    return sorted(trades, key=sort_key, reverse=True)


class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless handler implemented via BaseHTTPRequestHandler."""

    server_version = "AlphaArenaLatestTrades/1.0"

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send_response(HTTPStatus.NO_CONTENT, b"")

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path or "")
        query_params = parse_qs(parsed.query or "")
        limit_param = query_params.get("limit", [None])[0]

        try:
            limit = int(limit_param) if limit_param is not None else DEFAULT_LIMIT
        except (TypeError, ValueError):
            limit = DEFAULT_LIMIT

        try:
            payload = _fetch_json("/trades")
            trades_raw = payload.get("trades")
            if not isinstance(trades_raw, list):
                raise RuntimeError("Unexpected response shape from /trades")
            normalised = [_normalize_trade(tr) for tr in trades_raw]
            filtered = [tr for tr in normalised if tr["id"]]
            sorted_trades = _sort_trades(filtered)
            limited = sorted_trades[: max(limit, 1)]
            response_body = {
                "fetched_at": _utc_now(),
                "limit": limit,
                "count": len(limited),
                "trades": limited,
            }
            body_bytes = json.dumps(response_body).encode("utf-8")
            self._send_response(HTTPStatus.OK, body_bytes)
        except Exception as exc:  # pylint: disable=broad-except
            error_message = f"{exc.__class__.__name__}: {exc}"
            print(f"[latest_trades] error -> {error_message}", flush=True)
            body_bytes = json.dumps({"error": error_message}).encode("utf-8")
            self._send_response(HTTPStatus.BAD_GATEWAY, body_bytes)

    def log_message(self, fmt: str, *args: object) -> None:  # noqa: D401, ANN001
        """Silence the default logging (Vercel already captures stdout)."""
        return

    def _send_response(self, status: HTTPStatus, body: bytes) -> None:
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        if body:
            self.wfile.write(body)
