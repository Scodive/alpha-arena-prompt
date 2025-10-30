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
POSITIONS_LIMIT = int(os.getenv("TRADE_POSITIONS_LIMIT", "200"))

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


def _ensure_iso8601(value: Any) -> str | None:
    """Best-effort conversion to ISO-8601 (UTC)."""
    if value is None:
        return None

    epoch_seconds: float | None = None

    if isinstance(value, (int, float)):
        epoch_seconds = float(value)
    elif isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return None
        try:
            # Numeric strings (seconds or milliseconds)
            epoch_seconds = float(candidate)
        except ValueError:
            normalized = candidate.replace("Z", "+00:00")
            normalized = normalized.replace(" ", "T", 1)
            try:
                dt_obj = datetime.fromisoformat(normalized)
                if dt_obj.tzinfo is None:
                    dt_obj = dt_obj.replace(tzinfo=timezone.utc)
                return dt_obj.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
            except ValueError:
                return candidate

    if epoch_seconds is None:
        return None

    if epoch_seconds > 1e12:  # treat as milliseconds
        epoch_seconds /= 1000.0

    dt_obj = datetime.fromtimestamp(epoch_seconds, tz=timezone.utc)
    return dt_obj.isoformat().replace("+00:00", "Z")


def _normalize_trade(trade: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the fields needed by the frontend and normalise names."""
    entry_time_raw = trade.get("entry_time")
    entry_label = trade.get("entry_human_time") or entry_time_raw
    exit_time_raw = trade.get("exit_time")
    exit_label = trade.get("exit_human_time") or exit_time_raw
    entry_time = _ensure_iso8601(entry_time_raw)
    exit_time = _ensure_iso8601(exit_time_raw)
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
        "entry_human_time": entry_label,
        "exit_human_time": exit_label,
        "entry_time": entry_time,
        "exit_time": exit_time,
        "display_time": exit_time or entry_time,
        "realized_net_pnl": _coerce_float(trade.get("realized_net_pnl")),
        "unrealized_pnl": None,
        "confidence": _coerce_float(trade.get("confidence")),
        "current_price": None,
        "status": "closed" if exit_time else "closed_pending",
        "event": "trade_closed" if exit_time else "trade_record",
    }


def _normalize_position(position: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise live positions to align with the trade schema."""
    timestamp_hint = position.pop("_account_timestamp", None)
    entry_time_raw = position.get("entry_time") or timestamp_hint
    entry_label = position.get("entry_human_time") or entry_time_raw
    entry_time = _ensure_iso8601(entry_time_raw)
    leverage = position.get("leverage")
    leverage_value = _coerce_float(leverage)
    exit_plan = position.get("exit_plan") or {}

    identifier = (
        position.get("position_id")
        or position.get("id")
        or position.get("entry_oid")
        or f"{position.get('model_id')}-{position.get('symbol')}-{entry_time or entry_label or ''}"
    )

    display_time = entry_time or _ensure_iso8601(timestamp_hint) or _utc_now()

    return {
        "id": str(identifier),
        "model_id": position.get("model_id"),
        "symbol": position.get("symbol"),
        "side": position.get("side"),
        "leverage": leverage_value,
        "raw_leverage": leverage,
        "quantity": position.get("quantity"),
        "entry_price": _coerce_float(position.get("entry_price")),
        "exit_price": None,
        "profit_target": _coerce_float(exit_plan.get("profit_target")),
        "stop_loss": _coerce_float(exit_plan.get("stop_loss")),
        "entry_human_time": entry_label,
        "exit_human_time": None,
        "entry_time": entry_time,
        "exit_time": None,
        "display_time": display_time,
        "realized_net_pnl": None,
        "unrealized_pnl": _coerce_float(position.get("unrealized_pnl")),
        "confidence": _coerce_float(position.get("confidence")),
        "current_price": _coerce_float(position.get("current_price")),
        "status": "open",
        "event": "position_open",
    }


def _sort_trades(trades: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort trades by entry_time descending."""

    def sort_key(trade: Dict[str, Any]) -> tuple[int, str]:
        entry = trade.get("display_time")
        if isinstance(entry, str):
            return (0, entry)
        return (1, "")

    return sorted(trades, key=sort_key, reverse=True)


def _normalize_account(entry: Dict[str, Any]) -> Dict[str, Any]:
    model_id = entry.get("model_id") or entry.get("modelId") or entry.get("id") or ""
    return_pct = _coerce_float(entry.get("total_return_pct"))
    if return_pct is not None and abs(return_pct) <= 1:
        return_pct *= 100
    return {
        "model_id": str(model_id),
        "account_value": _coerce_float(entry.get("dollar_equity") or entry.get("account_value")),
        "total_return_pct": return_pct,
        "realized_pnl": _coerce_float(entry.get("realized_pnl")),
        "total_unrealized_pnl": _coerce_float(entry.get("total_unrealized_pnl")),
        "timestamp": _ensure_iso8601(entry.get("timestamp")),
    }


def _extract_positions_from_account_entry(entry: Dict[str, Any]) -> List[Dict[str, Any]]:
    positions: List[Dict[str, Any]] = []
    positions_map = entry.get("positions")
    if not isinstance(positions_map, dict):
        return positions
    model_id = entry.get("model_id") or entry.get("modelId") or entry.get("id")
    timestamp = entry.get("timestamp")
    for symbol, pos in positions_map.items():
        if not isinstance(pos, dict):
            continue
        pos_copy = pos.copy()
        pos_copy.setdefault("symbol", symbol)
        pos_copy.setdefault("model_id", model_id)
        if timestamp is not None:
            pos_copy.setdefault("_account_timestamp", timestamp)
        positions.append(_normalize_position(pos_copy))
    return positions


def _collect_account_data() -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    accounts: List[Dict[str, Any]] = []
    positions: List[Dict[str, Any]] = []
    try:
        payload = _fetch_json("/account-totals")
        entries = payload.get("accountTotals") or payload.get("accounts") or payload
        if isinstance(entries, list):
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                accounts.append(_normalize_account(entry))
                positions.extend(_extract_positions_from_account_entry(entry))
    except Exception as exc:  # pylint: disable=broad-except
        print(f"[latest_trades] account totals fetch failed -> {exc}", flush=True)
    return accounts, positions


def _collect_open_positions() -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Fetch open positions from primary endpoint with account-total fallbacks."""
    errors: List[str] = []
    positions_by_id: Dict[str, Dict[str, Any]] = {}

    try:
        positions_payload = _fetch_json(f"/positions?limit={POSITIONS_LIMIT}")
        positions_raw = (
            positions_payload.get("positions")
            or positions_payload.get("data")
            or positions_payload
        )
        if isinstance(positions_raw, list):
            for pos in positions_raw:
                if not isinstance(pos, dict):
                    continue
                normalised = _normalize_position(pos)
                identifier = normalised.get("id")
                if identifier:
                    positions_by_id[str(identifier)] = normalised
        else:
            errors.append("Unexpected /positions response shape")
    except Exception as exc:  # pylint: disable-broad-except
        errors.append(f"/positions -> {exc}")

    accounts, fallback_positions = _collect_account_data()
    for pos in fallback_positions:
        identifier = pos.get("id")
        if identifier and identifier not in positions_by_id:
            positions_by_id[str(identifier)] = pos

    if errors:
        print(f"[latest_trades] open position fetch issues -> {' | '.join(errors)}", flush=True)

    sorted_positions = _sort_trades(list(positions_by_id.values()))
    return sorted_positions[: max(POSITIONS_LIMIT, 1)], accounts


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
            normalised_trades = [_normalize_trade(tr) for tr in trades_raw if isinstance(tr, dict)]
            filtered_trades = [tr for tr in normalised_trades if tr["id"]]
            sorted_trades = _sort_trades(filtered_trades)
            limited_trades = sorted_trades[: max(limit, 1)]

            open_positions, accounts = _collect_open_positions()

            combined = limited_trades + open_positions
            combined_sorted = _sort_trades(combined)

            models = sorted({item["model_id"] for item in combined_sorted if item.get("model_id")})
            symbols = sorted({item["symbol"] for item in combined_sorted if item.get("symbol")})
            open_count = sum(1 for item in combined_sorted if item.get("status") == "open")
            closed_count = sum(1 for item in combined_sorted if item.get("status") != "open")

            response_body = {
                "fetched_at": _utc_now(),
                "limit": limit,
                "count": len(combined_sorted),
                "open_count": open_count,
                "closed_count": closed_count,
                "trades": combined_sorted,
                "models": models,
                "symbols": symbols,
                "accounts": accounts,
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
