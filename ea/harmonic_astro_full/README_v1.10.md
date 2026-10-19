# CEBONK HARMONIC + ASTRODOX WEB + CB1 M5 — v1.10 (EXPERIMENTAL)

**Standalone new EA; never overwrite v1.00 or BBMA/Combined.**

## Contract

- Independent **H4, H1, M30** closed-bar scanners. Either TF is enough, but conflicting active directions skip by default; H4 > H1 > M30 priority when signals agree.
- 16 distinct pattern/variant switches: Gartley, Bat, Alternate Bat, Butterfly, Crab, Deep Crab, Cypher, Shark, 5-0, Three Drives, AB=CD, Alternate AB=CD, Impulsive AB=CD, Corrective AB=CD, Nested AB=CD and Back-to-back AB=CD.
- Screeners use explicitly documented approximate Fibonacci/range geometry; 5-0 and Three Drives use six-point context, Nested and Back-to-back require previous swings. **Not a certified full reproduction of discretionary illustrations**; test each pattern independently.
- **M5 CB1** uses two descending confirmed pivot lows (BUY), or ascending confirmed highs (SELL), and the intervening CB1 level. Require M5 candle body close across that level; entry at **first tick of next M5 bar**. **No retest, no M15**.
- H4/H1/M30 EMA50-slope + close defines FOLLOW vs REVERSAL. Mode BOTH, FOLLOW_ONLY, REVERSAL_ONLY. Neutral trend = SKIP.
- SL beyond D extrema plus buffer. TP is the closest usable structural Fibonacci target **0.382 AD** or **0.618 AD**; if both offer < **RR 1:2 at requested fill**, SKIP. **No forced RR target beyond Fibonacci level.** Slippage and tick rounding can change realized RR.
- Risk gates: fixed lot 0.01 (must match symbol min/max/step), spread <=70 points, max SL 6000 points, max chase 700 points, 1% loss-per-order max, 5% daily equity stop, max 1 concurrent EA position, session 07:00–23:00 on broker clock. No BE, trailing, partial, martingale, or recovery. One terminal-global signal claim per H4/H1/M30 D per account/symbol/magic, consumed before submitting to avoid unknown duplicate fills.
- AUTOPILOT OFF and REAL ACCOUNT LOCKED by default. Attach to XAUUSDc chart; symbol is `_Symbol` so broker variations follow the chart. Requires **hedging MT5 account**.
- Optional Telegram and MT5 Push on actual fill, one per order; optional minimal closing alerts on broker TP/SL. Never embed tokens in GitHub.

## ASTRODOX exact source & version caveat

Web domain: https://enggarprasetiyodaviandhoni.github.io

Published CSV URL pattern:
`https://enggarprasetiyodaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/ea/combined2/data/YYYY-MM.csv`

Published model: **`CEBONK_C2_WEB_V1_35ce78b4`**, generated from pinned web core commit 35ce78b4; available published coverage **2026-01-01 to 2027-12-31, 06:00–24:00 WIB**. The website's current browser UI uses Astrology **v2.0**, which is **not the same model version**. This version consumes the published V1 CSV, **not** live V2 UI signals. Do not claim exact parity with the current screen. Aligning to V2 requires separately publishing and validating a V2-compatible feed.

- Live: `ASTRO_WEB_CSV`, poll from GitHub Pages `YYYY-MM.csv` (must allow WebRequest URL in MT5 terminal settings). Parser requires exact CSV header, model tag, ascending disjoint UTC 5-minute-aligned windows. Only valid BUY/SELL allowed at **both signal close and live execution**; NEUTRAL, TRANSITION, OUTSIDE, stale month, failed fetch, malformed file = **no entry**.
- Strategy Tester: **WebRequest is unavailable**. Automatically read local `CEBONK_C2_ASTRO.csv` in `MQL5/Files` / `Tester/Files` or tester inclusion via `#property tester_file`, even if input says WEB. Configure `AstroFixedServerUTCMinutes` to historical broker offset (NOZAX nominal GMT+3 = 180). If server daylight time shifts, split tests accordingly; do not pretend offset accuracy.
- Safety: `AcceptExperimentalAstro=false` by default, so filter remains closed until explicit acknowledgment. `ASTRO_OFF` permits technical-only A/B testing and bypasses astrology.
- Before 2026 or after 2027 the published CSV has no coverage; history without data **fails closed**. To test 2024–25 you need a same-model, verified publication for those years.
- Astrology direction has no established causal validity for XAUUSD. Backtest technical-only vs astrology-gated and track sample size, separated BUY/SELL WR, PF, monthly net, drawdown and slippage.

## Installation

Simplest: `CEBONK_HARMONIC_ASTRO_FULL_SINGLE_v1.10.mq5` in `MQL5/Experts`; all modules are in one file.
Alternative modular: copy the main `.mq5` and **both** `.mqh` files to the same `MQL5/Experts` directory. The `.txt` is an identical standalone copy to download on Android, rename to `.mq5` on PC.

1. Compile in **MetaEditor 5** (0 errors required). No MetaEditor/MT5 compilation was performed in this environment.
2. Add `https://enggarprasetiyodaviandhoni.github.io` and optional `https://api.telegram.org` under Tools > Options > Expert Advisors > WebRequest allowlist. Test HTTP + actual signal availability in Journal.
3. Check time conversion and volume rules, choose strategy and enabled patterns, and turn AUTOPILOT ON on a demo hedging account.
4. Backtest real ticks/walk-forward 2026–2027 with matching published data; extend historic feed for 2024–2025 separately. Verify trade log, invalid stop, order rejection, duplicate fill, restart, partial fills, Fibonacci targets, forced skip on contradictory TFs and no connection.
5. Only consider live deployment after independent audits. There is **no guarantee** of daily entries, WR >=45% or positive P&L every month.

## Mandatory status

- [x] Source created, fallback disallowed, modular & standalone forms.
- [ ] MetaEditor compile: **not run**.
- [ ] MT5 broker-tick backtest and forward demo: **not run**.
- [ ] Profit targets verified: **not run**.