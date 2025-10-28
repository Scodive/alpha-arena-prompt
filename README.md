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

## Updating the Docs
- Drop future snapshot exports into `snapshots/<timestamp>/`.
- Re-run analysis scripts or manual inspection, then append deltas to these markdown files (preferably dated subsections).
- Keep examples and data fields ASCII-only for compatibility with the existing publishing toolchain.
