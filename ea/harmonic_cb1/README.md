# CEBONK Harmonic H1 + CB1 M5 — Follow + Reversal v1.00 (EXPERIMENTAL)

New **standalone EA**; does not modify the existing BBMA/Combined EAs.

## Exact signal contract

1. On **H1**, scan already-confirmed alternating X-A-B-C swings using pivot depth 2. Candidate D is the extreme of **closed H1 candles after C** (last 3 closed H1 candles); never read an unclosed H1 candle to confirm a pattern.
2. Validate a bullish or bearish **AB=CD**, **Gartley**, **Bat** or **Butterfly** geometry and its own Fibonacci ratios. These are pragmatic quantitative definitions and must not be confused with every discretionary harmonic variant. AB=CD uses X-A-B-C context but its primary ratio is CD/AB.
3. H1 trend classification: EMA50 (closed H1) slope (bar 1 versus bar 5) **and** last closed H1 close above/below the EMA. Signal aligning with trend = **FOLLOW**; opposing it = **REVERSAL**. Neutral = skip. Input `StrategyMode`: `FOLLOW_AND_REVERSAL` (default), `FOLLOW_ONLY`, `REVERSAL_ONLY`. Each pattern also has independent ON/OFF input.
4. On **M5**, locate two confirmed pivot LOWs with the latter a lower low (BUY), and the intervening high as the **CB1 level**. For SELL, two pivot HIGHs with the latter higher high, and intervening low as CB1. The newer pivot must have occurred at or after the H1 D candle opened. The latest **closed M5 candle** must cross CB1 by candle close, in the intended direction and with body ratio >= 0.35.
5. **MARKET ENTRY on the first available tick after M5 candle close. No retest. No M15.** The entry must pass all execution/risk filters. A valid setup may be skipped; there is no guaranteed minimum trade count.
6. SL outside H1 D extreme plus `SLBufferPoints`. TP set at exactly **2x the requested entry-to-SL distance**, rounded to symbol trade tick size. On successful fill the EA attempts to adjust TP using the **actual average position fill**; if broker rejects that amendment, the original broker TP remains and realized RR may vary.

### Fibonacci rules (tolerances adjustable)

| Pattern | B / XA retracement | C / AB retracement | AD / XA | CD / BC or CD / AB |
|---|---|---|---|---|
| Gartley | around 0.618 | 0.382–0.886 | around 0.786 | CD/BC 1.272–1.618 |
| Bat | around 0.382–0.50 | 0.382–0.886 | around 0.886 | CD/BC 1.618–2.618 |
| Butterfly | around 0.786 | 0.382–0.886 | 1.272–1.618 | CD/BC 1.618–3.618 |
| AB=CD | not constrained | 0.382–0.886 | not constrained | CD/AB 0.90–1.10 |

The code compares `abs(A-D)/abs(X-A)` for AD/XA; it does **not** use the same ratio for all patterns. Fibonacci ranges are implementation choices for research, not experimentally optimized.

## Risk/execution defaults

- Intended NOZAX `XAUUSDc` by attaching the EA to that symbol's chart; symbol is **always the current chart symbol**. Broker server time 07:00–23:00. Confirm your broker clock really is GMT+3; no inferred timezone conversion.
- Spread **70 points maximum**; fixed **0.01 lot**, with broker min/step validation (never round volume up).
- Stop buffer 100 points; max SL 6000 points; max chase from CB1 700 points; max estimated stop loss **1% of current account equity** via `OrderCalcProfit`, not a fixed pip-to-dollar assumption. Equity daily stop **5%** relative to first observed equity on that broker day.
- Default at most **1 concurrent position owned by this EA**. `MaxOpenPositions` may be changed, but duplicate orders for the same H1 D are blocked. No martingale, recovery, layering, BE, trailing or partial-close instructions.
- **AUTOPILOT starts OFF** (only button on chart); **real-money accounts blocked** unless `AllowRealAccount=true` is explicitly set. Requires **MT5 hedging account** so SL/TP remain independent.
- One terminal-wide claim per account/symbol/magic/H1-D timestamp is written before order submission, including uncertain/failing orders. Rejected signals are consumed, not silently retried. Do **not** operate independent MT5 terminals with the same account+magic and expect a cross-terminal lock.
- Notifications are triggered by the actual `DEAL_ENTRY_IN` event. A terminal global suppresses repeated notification for multiple partial deals of the **same order**; optional MT5 Push and Telegram are **OFF by default**, and bot credentials are never embedded in committed code. Event contains pattern, FOLLOW/REVERSAL, H1/M5, symbol, direction, entry, SL and TP. Telegram needs Tools > Options > Expert Advisors > Allow WebRequest for `https://api.telegram.org`. Telegram and MT5 Push are unavailable/restricted in Strategy Tester.

## Installation / testing

Copy `.mq5` to `MQL5/Experts`, open in MetaEditor and compile; `.txt` holds identical code for mobile download, rename to `.mq5` before compilation. Attach to chart (prefer M5); H1 and M5 data are read independently of attached chart timeframe. Activate Algo Trading, switch AUTOPILOT ON. Start on demo only, log rejected signals and order retcodes.

### Mandatory validation before live use

- [ ] **MetaEditor 5 compile: zero errors** (not yet performed in this environment).
- [ ] MT5 real-tick backtest **2024–2026** on broker's own `XAUUSDc` historical data, plus walk-forward and demo forward testing (not yet performed).
- [ ] Test BOTH, FOLLOW_ONLY, REVERSAL_ONLY independently and AB=CD/Gartley/Bat/Butterfly individually (otherwise an attractive aggregate can hide an unprofitable direction).
- [ ] Report BUY winrate, SELL winrate, PF per direction, every month's net PnL, max equity drawdown, trade frequency, false breakouts, skipped risk checks and slippage.
- [ ] Verify broker stop distance, tick rounding, actual-fill TP adjustment, partial fills, hedging account support, restarts and terminal-global deduplication.
- [ ] Test Telegram + Push with dummy/demo orders before enabling credentials on a live account.

**No claimed winrate, no guarantee that all months are profitable, and no evidence yet this source compiles or is financially robust.** Source-policy and arithmetic sanity tests are not a substitute for MetaEditor or Strategy Tester.