# CEBONK v1.06 — Experimental M5 CB1 Direct Entry

Status: **EXPERIMENTAL / COMPILE NOT RUN / BACKTEST NOT RUN / DEMO NOT RUN**.
Do not replace the working v1.05 until MetaEditor compilation and backtest/forward tests pass.

## Source files

- `CEBONK_H1_M15_M5_v1.06_CB1_NO_LAYER.mq5` — v1.06 EA source
- `CEBONK_H1_M15_M5_v1.06_CB1_NO_LAYER.txt` — identical code for mobile
- `CEBONK_H1_M15_M5_v1.05_NO_LAYER_TF_SL.mq5` — previous M5 CSAK comparator (unchanged)

## Strategy pipeline

1. H1: BBMA Re-entry direction filter (existing MidBB slope proxy unchanged).
2. M15: CSA / CSAK / CSM in matching direction, using only closed candles.
3. M5: **CB1 closed-candle BREAK** replaces the old M5 CSAK trigger. Direct market entry at the first permitted tick after M5 breakout close; **no zone retest**.

## CB1 swing model used in this experiment

Operational interpretation of the Fibo Musang CB1 trend-door structure (not a claim that the complete reference rules have been transcribed):

- BUY: identify two confirmed M5 swing LOWs where the most recent swing low is LOWER than the older one (lower low). The highest high BETWEEN those two lows forms the bullish CB1 break level. Enter only after an M5 bullish candle CLOSE crosses above this level from at/below the level on the previous candle.
- SELL: identify two confirmed M5 swing HIGHs where the most recent high is HIGHER than the older one (higher high). The lowest low BETWEEN those two highs forms the bearish CB1 break level. Enter only after an M5 bearish candle CLOSE crosses below this level from at/above it on the previous candle.
- Pivots are confirmed using equal numbers of already-closed bars on both sides (`CB1PivotStrength`, default 2). `CopyRates(...,shift=1)` explicitly excludes the current forming M5 candle; there is no future-bar access.
- Both swing points must occur within the 120-bar closed-M5 search window by default. If there is no qualifying structure, the EA skips the signal. Strict equality rules intentionally reject ambiguous equal lows/highs.
- This is a potentially rare **reversal/structure-break** event. H1/M15 direction agreement is mandatory when H1 filter enabled. Not an M5 CSAK detector; trade frequency may fall.

## Inputs and execution defaults

| Input | Default | Meaning |
| --- | --- | --- |
| `CB1PivotStrength` | 2 | Bars to confirm swing on each side |
| `CB1LookbackBars` | 120 | Number of last closed M5 bars searched |
| `CB1BreakBufferPoints` | 0 | Break threshold offset in symbol points |
| `TF_StopLoss` | M15 | Selectable Bollinger Bands SL timeframe, e.g. M5/M15/H1 |
| `MaxConcurrentPositions` | 1 | Hard no-layer (cannot be overridden by risk guard toggle) |
| `MaxSpreadPoints` | 70 | Skip overly wide spread |

SL BUY = Lower BB of most recent CLOSED TF_StopLoss candle; SL SELL = Upper BB. TP fixed RR 1:2 using existing risk, margin, tick-rounding and stops verification. No BE, trailing or partial close. A new SetupID is still distinct but must await the prior position close before entry.

## Audit / skip logs

- `CB1_HISTORY_INCOMPLETE`: not enough closed M5 history for the configured search.
- `CB1_BAR_MISMATCH`: closed bar changed between reads; fail closed.
- `CB1_PIVOTS_MISSING`: no two fully confirmed swing points.
- `CB1_NOT_LOWER_LOW` or `CB1_NOT_HIGHER_HIGH`: invalid preceding structure.
- `CB1_WAIT_CLOSE_BREAK`: crossing/bullish-bearish close requirement not satisfied.
- `WAIT_POSITION_CLOSE`, `WAIT_PENDING_ORDER`: hard no-layer gates.
- `ORDER_ACCEPTED`: logs `M5_CB1_LEVEL=...` plus H1/M15 event time and selected SL TF.
- Telegram/MT5 fill notification now says `M5 CB1 BREAK`; remains 1 per position ID (remote delivery not guaranteed).

## Validation matrix — NOT EXECUTED in MT5

- [ ] MQL5 MetaEditor compile F7, fix all errors and warnings.
- [ ] M5 BUY lower low + intermediate high, breakout candle **close above** => one BUY.
- [ ] M5 SELL higher high + intermediate low, breakout candle **close below** => one SELL.
- [ ] Wick only, break in wrong direction, prior close already beyond CB1, equal/lacking pivots => SKIP.
- [ ] Check pivot confirmation uses ONLY historical closed M5 bars; not a repainter.
- [ ] Check one position maximum even for new SetupID with active old trade; risk guard OFF cannot bypass.
- [ ] Check configured M5/M15/H1 BB SL, tick size and stop-level validation; RR 1:2.
- [ ] Check Telegram/Push 1 per filled position and CB1 label.
- [ ] Backtest v1.05 vs v1.06 2024–2026 on NOZAX XAUUSDc using identical spread, inputs and history: separate BUY and SELL WR/PF, monthly PnL, equity DD, number of trades/day, commission and slippage.
- [ ] Forward-demo test before production.

Before installing v1.06 remove old v1.03–v1.05 EA instances from all charts so they do not trade concurrently with the same Magic. After compiling, verify Experts banner `CEBONK v1.06 CB1-M5 NO-LAYER STARTED`. GitHub changes do NOT update a local `.ex5` file.

Source-side structural review found the intended guards and 9 synthetic scenarios passed, but these are **not** a real MQL5 compile or market backtest.

Do not claim the filter improves win rate, reduces DD or profits every month without evidence.