# NOF1 Documentation with PROMPT

Chinese version 中文版本: [README.zh-CN.md](./README.zh-CN.md)

This project distills key learnings from the latest Alpha Arena so you can understand and reproduce NOF1’s model orchestration pipeline.

## Contents
- [`prompt-structure.md`](./prompt-structure.md) — Deep dive into the system prompt, market data payload, embedded account context, and the required response schema (including hidden trading rules).
- [`api-reference.md`](./api-reference.md) — Reference sheet for every read-only REST endpoint surfaced in the snapshots, with field notes and polling guidance.
- [`prompt-template.md`](./prompt-template.md) — Literal prompt template with placeholder tokens so you can recreate the exact message sent to each model.

## How to Use
1. **Reverse engineer prompts:** Start with `prompt-structure.md` to rebuild the invocation template. The document highlights each section in the order it appears, along with the validation rules gleaned from `failed_json_response_raw_text`.
2. **Replay decision loops:** Pair the prompt template with `/api/conversations` output to simulate model cycles. Cross-check signals against `/api/trades` to verify fills and risk settings.
3. **Integrate live data:** Use the endpoints summarized in `api-reference.md` to stream market, account, and analytics data into your own harness. Follow the listed polling intervals and respect the noted `limit` behavior on `/api/positions`.
4. **Benchmark your agents:** Reuse the schema when plugging in new models—`prompt-structure.md` documents the exact fields that NOF1 expects before executing trades on Hyperliquid.

## Snapshot script usage (snapshot_nof1.py)
This script pulls read-only data from the public NOF1 API and saves it into date/time partitioned folders for offline analysis and replay.

### Requirements
- Python ≥ 3.8 (built-in `urllib`/`json`; no extra dependencies required)

### How to run
```bash
python snapshot_nof1.py
```

### Behavior and output
- Base URL: `https://nof1.ai/api`
- Endpoints fetched (with fallback order where applicable):
  - `crypto-prices`
  - `positions` (tries `?limit=5000` first, then falls back)
  - `trades`
  - `account-totals`
  - `since-inception-values`
  - `leaderboard`
  - `analytics`
  - `conversations`
- Output directory: `snapshots/nof1/<YYYY-MM-DD>/<HHMMSSZ>/`
  - Each endpoint is saved as `<key>.json`
  - An `index.json` manifest records the timestamp, relative file paths, and source URLs

### Example output structure
```
snapshots/
    nof1/
      2025-10-28/
        070456Z/
          account-totals.json
          analytics.json
          conversations.json
          crypto-prices.json
          index.json
          leaderboard.json
          since-inception-values.json
          trades.json
```

## Real-time trade monitor
The `backend/` and `frontend/` folders provide a lightweight web service that polls the NOF1 `/trades` endpoint every minute and surfaces newly detected fills in a browser.

### Running the service
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app:app --reload
```

Then open `http://127.0.0.1:8000/` to view the dashboard.

### What it does
- Polls `https://nof1.ai/api/trades` on a background thread (`TRADE_POLL_INTERVAL_SECONDS` defaults to `60`).
- Tracks the most recent trade IDs to highlight fills that landed since the previous poll.
- Exposes the latest data at `GET /api/trades/latest` and an optional manual refresh at `POST /api/trades/poll`.
- Serves the front-end dashboard (`frontend/index.html`) so the latest trade activity is visible without additional tooling.

### Configuration
- `NOF1_BASE_URL` — override the upstream API base URL (default: `https://nof1.ai/api`).
- `TRADE_POLL_INTERVAL_SECONDS` — poll cadence in seconds (minimum 10 seconds, default 60).
- `TRADE_CACHE_LIMIT` — number of recent trades retained in memory and returned to the UI (default 50).

## Deploying a 30-second ticker on Vercel
A fully serverless option lives alongside the existing backend:

- **Python serverless endpoint:** `api/latest_trades.py` talks to `https://nof1.ai/api/trades`, normalises the payload, and returns a trimmed list of trades sorted by timestamp. The handler runs on Vercel’s Python 3.11 runtime (see `vercel.json`) and supports an optional `?limit=` query override.
- **Minimal “headline” UI:** `frontend/index.html` renders the newest fills in a news-feed style layout. It calls `/api/latest_trades` immediately on load and every 30 seconds afterwards. Each card displays：交易时间、空/多方向、模型、币种、杠杆、数量、开仓价、止盈/止损以及已实现盈亏。
- **Routing:** `vercel.json` maps `/` to the static frontend while preserving `/api/*` routes for serverless functions.

### Deploy steps
1. Install the Vercel CLI (`npm i -g vercel`) and log in with `vercel login`.
2. From the repository root run `vercel --prod` (or `vercel` for a preview). The CLI respects `vercel.json`, so no extra build configuration is necessary.
3. Optional: set `NOF1_BASE_URL` / `TRADE_DISPLAY_LIMIT` in the Vercel project dashboard if you need to target a different API host or change the number of rows returned.

Once deployed, opening the Vercel URL shows the live ticker page; the latest trades surface automatically at the top without manual refresh.

## Updating the Docs
- Drop future snapshot exports into `snapshots/<timestamp>/`.
- Re-run analysis scripts or manual inspection, then append deltas to these markdown files (preferably dated subsections).
- Keep examples and data fields ASCII-only for compatibility with the existing publishing toolchain.
