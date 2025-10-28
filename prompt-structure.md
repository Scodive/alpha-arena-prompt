# NOF1 Alpha Arena Prompt Structure

## Invocation Preamble
- Opens with elapsed trading minutes (`It has been XXXX minutes since you started trading`), the precise timestamp of the cycle, and the cumulative invocation count. These runtime markers reset each call and help the orchestrator track cadence and compliance windows.
- Immediately reminds the model that **price/signal data is oldest → newest** and that intraday series default to **3-minute intervals** unless otherwise stated.
- Uses triple-dash separators (`---`) to bound major sections.

## Market Data Sections
For each supported coin (`BTC`, `ETH`, `SOL`, `BNB`, `XRP`, `DOGE`):
- Headline values: `current_price`, `current_ema20`, `current_macd`, `current_rsi`.
- Latest open interest and funding rate for the corresponding Hyperliquid perp.
- An intraday block containing arrays for mid price, EMA, MACD, RSI (7/14) ordered oldest → newest.
- A longer-term block (4-hour timeframe) covering EMA (20/50), ATR (3/14), current vs. average volume, MACD history, and RSI (14).

## Account Context
- Heading: `### HERE IS YOUR ACCOUNT INFORMATION & PERFORMANCE`.
- Metrics: current total return percentage, available cash, total account value, Sharpe ratio.
- For each open position a Python-style dict is embedded with:
  - Core trade state (`symbol`, `quantity`, `entry_price`, `current_price`, `liquidation_price`, `unrealized_pnl`, `leverage`).
  - Exit plan sub-dict (`profit_target`, `stop_loss`, `invalidation_condition`).
  - Confidence score, `risk_usd`, order identifiers (`entry_oid`, `tp_oid`, `sl_oid`), and `notional_usd`.

## Hidden System Rules (Recovered From Failures)
`failed_json_response_raw_text` entries expose the guardrails applied to every model:
- If a position already exists for a coin, allowed signals are only `hold` or `close_position`.
- No pyramiding or size increases; new entries must target coins without active exposure.
- Output must be valid JSON per-coin (see schema below); the platform rejects narrative-only answers.
- `hold` responses omit `justification`, whereas `buy_to_enter` and `close_position` require one.

## Expected Response Schema
The platform converts successful answers into the following structure (keys observed across all models):

```jsonc
{
  "COIN": {
    "quantity": 0.12,
    "signal": "hold",                // one of: hold | close_position | buy_to_enter
    "profit_target": 118136.15,
    "stop_loss": 102026.675,
    "invalidation_condition": "If the price closes below 105000 on a 3-minute candle",
    "leverage": 10,                  // typically 5–40
    "confidence": 0.65,              // 0–1
    "risk_usd": 619.23,
    "coin": "BTC",
    "justification": ""              // empty for hold, populated for entry/exit
  }
}
```

Additional fields uncovered:
- `cot_trace` and `cot_trace_summary` capture the model’s reasoning but do **not** drive execution.
- `skill` currently fixed to `swing_trading`.

## Signal Frequency (Sample)
Across 100 recent conversations:
- `hold`: 451 occurrences
- `close_position`: 2 occurrences
- `buy_to_enter`: 2 occurrences

This indicates the orchestration layer aggressively filters outputs that deviate from the house rules.
