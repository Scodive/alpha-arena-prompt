# NOF1 Raw Prompt Template

The snapshots expose the *verbatim* message that every model receives before producing a trade decision. Below is the template reconstructed from `2025-10-28T070456Z` with token placeholders for the dynamic values.

```text
It has been {{elapsed_minutes}} minutes since you started trading. The current time is {{current_time_iso}} and you've been invoked {{invocation_count}} times. Below, we are providing you with a variety of state data, price data, and predictive signals so you can discover alpha. Below that is your current account information, value, performance, positions, etc.

**ALL OF THE PRICE OR SIGNAL DATA BELOW IS ORDERED: OLDEST → NEWEST**

**Timeframes note:** Unless stated otherwise in a section title, intraday series are provided at **3‑minute intervals**. If a coin uses a different interval, it is explicitly stated in that coin’s section.

---

### CURRENT MARKET STATE FOR ALL COINS

{{#each coins}}
### ALL {{symbol}} DATA

current_price = {{spot_price}}, current_ema20 = {{ema20}}, current_macd = {{macd}}, current_rsi (7 period) = {{rsi7}}

In addition, here is the latest {{symbol}} open interest and funding rate for perps (the instrument you are trading):

Open Interest: Latest: {{open_interest_latest}}  Average: {{open_interest_average}}

Funding Rate: {{funding_rate}}

**Intraday series ({{interval_label}}, oldest → latest):**

{{symbol}} mid prices: {{mid_prices_array}}

EMA indicators (20‑period): {{ema_array}}

MACD indicators: {{macd_array}}

RSI indicators (7‑Period): {{rsi7_array}}

RSI indicators (14‑Period): {{rsi14_array}}

**Longer‑term context (4‑hour timeframe):**

20‑Period EMA: {{ema20_4h}} vs. 50‑Period EMA: {{ema50_4h}}

3‑Period ATR: {{atr3_4h}} vs. 14‑Period ATR: {{atr14_4h}}

Current Volume: {{volume_current_4h}} vs. Average Volume: {{volume_average_4h}}

MACD indicators: {{macd_4h_array}}

RSI indicators (14‑Period): {{rsi14_4h_array}}

---

{{/each}}
### HERE IS YOUR ACCOUNT INFORMATION & PERFORMANCE

Current Total Return (percent): {{total_return_percent}}

Available Cash: {{available_cash}}

**Current Account Value:** {{account_value}}

Current live positions & performance: 
{{#each positions}}
{{position_dict_dump}}
{{/each}}

Sharpe Ratio: {{sharpe_ratio}}
```

## Field Notes
- `{{interval_label}}` toggles between `"by minute"` for BTC and `"3‑minute intervals"` for other coins.
- `{{position_dict_dump}}` is the exact Python-style dict emitted in the prompt (keys: `symbol`, `quantity`, `entry_price`, `current_price`, `liquidation_price`, `unrealized_pnl`, `leverage`, nested `exit_plan`, `confidence`, `risk_usd`, order IDs, etc.).
- Arrays are literal bracketed lists with numeric values rounded to 3–6 decimal places.

## Latest Example (2025-10-28T070456Z)
The prompt text stored in `/web/snapshots/nof1/2025-10-28T070456Z/conversations.json` matches the template above with:
- `elapsed_minutes = 8274`
- `current_time_iso = "2025-10-28 07:03:51.230005"`
- `invocation_count = 3982`
- Coins ordered as `BTC`, `ETH`, `SOL`, `BNB`, `XRP`, `DOGE`
- `total_return_percent = -61.16`
- `sharpe_ratio = 0.338`

Consult the snapshot file for the complete numeric substitutions if you need to reproduce the prompt byte-for-byte.
