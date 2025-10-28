#!/usr/bin/env python3
"""
Snapshot NOF1 Alpha Arena API payloads using Python.

Creates date-based directories under snapshots/nof1/YYYY-MM-DD/HHMMSSZ
and stores each endpoint's raw JSON response along with an index.json manifest.

Usage:
    python web/scripts/snapshot_nof1.py
"""

from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys
import urllib.error
import urllib.request

BASE_URL = "https://nof1.ai/api"

ENDPOINTS = [
    {"key": "crypto-prices", "paths": ["/crypto-prices"]},
    {
        "key": "positions",
        "paths": ["/positions?limit=1000", "/positions"],
    },
    {"key": "trades", "paths": ["/trades"]},
    {"key": "account-totals", "paths": ["/account-totals"]},
    {"key": "since-inception-values", "paths": ["/since-inception-values"]},
    {"key": "leaderboard", "paths": ["/leaderboard"]},
    {"key": "analytics", "paths": ["/analytics"]},
    {"key": "conversations", "paths": ["/conversations"]},
]

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "nof1-snapshot/1.0 (+https://nof1.ai)",
}


def timestamp_parts(now: dt.datetime | None = None) -> tuple[str, str, str]:
    """Return ISO8601 timestamp plus date and compact time components."""
    if now is None:
        now = dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc)
    iso = now.isoformat().replace("+00:00", "Z")
    date_part = now.strftime("%Y-%m-%d")
    time_part = now.strftime("%H%M%SZ")
    return iso, date_part, time_part


def fetch(url: str) -> str:
    """Fetch UTF-8 text from URL, raising on HTTP errors."""
    request = urllib.request.Request(url, headers=HEADERS, method="GET")
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read()
        return body.decode("utf-8")


def ensure_json(text: str, key: str) -> None:
    """Validate that text parses as JSON, warning on failure."""
    try:
        json.loads(text)
    except json.JSONDecodeError as exc:
        print(f"Warning: {key} response is not valid JSON: {exc}", file=sys.stderr)


def main() -> int:
    iso_ts, date_part, time_part = timestamp_parts()

    root = pathlib.Path(__file__).resolve().parents[1]
    snapshot_dir = root / "snapshots" / "nof1" / date_part / time_part
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    summary: dict[str, object] = {
        "base": BASE_URL,
        "timestamp": iso_ts,
        "date": date_part,
        "time": time_part,
        "files": [],
    }

    for endpoint in ENDPOINTS:
        key = endpoint["key"]
        attempted_urls: list[str] = []
        success = False

        for rel_path in endpoint["paths"]:
            url = f"{BASE_URL}{rel_path}"
            attempted_urls.append(url)
            print(f"Fetching {url} ... ", end="", flush=True)
            try:
                text = fetch(url)
                ensure_json(text, key)

                file_path = snapshot_dir / f"{key}.json"
                file_path.write_text(text, encoding="utf-8")

                summary["files"].append(
                    {
                        "key": key,
                        "path": str(file_path.relative_to(root)),
                        "url": url,
                    }
                )
                print("saved")
                success = True
                break
            except urllib.error.HTTPError as err:
                print(f"failed ({err.code} {err.reason})")
            except urllib.error.URLError as err:
                print(f"failed ({err.reason})")
            except Exception as err:  # pylint: disable=broad-except
                print(f"failed ({err})")

        if not success:
            summary["files"].append(
                {
                    "key": key,
                    "error": " | ".join(attempted_urls),
                    "message": "All attempts failed",
                }
            )

    index_path = snapshot_dir / "index.json"
    index_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\nSnapshot complete -> {snapshot_dir.relative_to(root)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
