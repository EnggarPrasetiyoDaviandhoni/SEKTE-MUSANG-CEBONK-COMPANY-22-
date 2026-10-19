# CEBONK HARMONIC + ASTRODOX WEEKLY + CB1 — v1.21 (EXPERIMENTAL)

**New policy (replacing v1.20): scanner timeframes INDEPENDENT; ASTRODOX WEEKLY direction only.**
v1.10 and v1.20 remain in this directory as frozen historical candidates. Earlier BBMA/Combined EAs are not changed.

## Entry SOP — weekly direction only

1. Publish/read the user's existing **ASTRODOX weekly** V1 schedule, with **Monday–Friday 06:00–24:00 WIB** samples (5-minute grid; 1,080 slots). Weekly BUY or SELL must own **at least 55% of directional minutes**; NEUTRAL/TRANSITION do not count in the denominator. If data is missing, invalid, mixed or absent: **SKIP**.
2. **No daily ASTRODOX veto, no “start/end WIB” intraday window, and no broker-hour entry session.** A BULLISH week may enter BUY on Monday even when Monday's daily ASTRODOX is BEARISH; never SELL in a BULLISH week. A BEARISH week is the symmetric case. Weekend entries are blocked.
3. **D1 / H4 / H1 / M30 fully independent.** One valid harmonic matching the weekly bias is sufficient; opposite harmonic patterns on other timeframes **must never block it**. Each scanner has its own enable input. When multiple candidates qualify simultaneously, try D1 > H4 > H1 > M30; if one fails pre-order RR/SL/margin checks, try the next candidate.
4. Harmonic detector: 16 separately selectable pattern/variant implementations in `HarmonicScanner.mqh`; Fibonacci shapes are explicit quantitative approximations that require testing and are **not guaranteed faithful to every illustrated discretionary variant**. Strategy mode BOTH, FOLLOW_ONLY or REVERSAL_ONLY remains independently selectable using scanner-TF EMA50 trend. If trend is neutral, candidate is skipped.
5. Entry trigger: latest **CLOSED M5 candle breaks CB1** with valid body, trade **BUY/SELL MARKET at first available tick of next M5 bar**; never BuyStop/SellStop, and **no retest**.
6. SL beyond the pattern's D extreme + buffer. Select nearer usable TP among Fibonacci **0.382 or 0.618 of AD**, but only if RR >= 1:2 at requested entry; otherwise SKIP. One TP, no partial, BE or trailing.

## Data provenance & restrictions

Published CSV from the user's GitHub Pages:
`https://enggarprasetiyodaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/ea/combined2/data/YYYY-MM.csv`

The weekly panel uses the inherited **EXPERIMENTAL V1** direction model. CSV tag must exactly equal `CEBONK_C2_WEB_V1_35ce78b4`; it is **not identical to the browser UI's V2 daily display**, and there is no established link from astrology to financial prices. Published coverage is **2026–2027** only. Live WebRequest requires allowlisting `https://enggarprasetiyodaviandhoni.github.io`. Strategy Tester cannot WebRequest, so it reads the bundled/local `CEBONK_C2_ASTRO.csv`, with configured historical GMT offset (nominal broker GMT+3). The EA checks complete weekly data, including month crossover. It fails closed if model, coverage, date conversion or cache is invalid. `AcceptExperimentalAstro=false` by default until the user opts in; `UseWeeklyDominance=true` by default. Disable weekly filtering only for explicitly labeled technical-only comparison tests, never to claim the same strategy.

## Safety

- Chart symbol (`XAUUSDc` when attached there), fixed lot 0.01 validated against min/max/step, spread <=70 **points**.
- Risk <=1% account equity per planned order, daily equity stop 5%, max one open EA position by default; SL buffer 100 points, max SL 6000 points and max CB1 chase 700 points.
- Duplicate signal lock by account/symbol/magic/scanner-TF/pattern-D timestamp, claim before sending any order. Broker refusals after claim are not retried; no martingale/recovery/layering.
- **AUTOPILOT OFF and REAL-ACCOUNT LOCK ON by default.** Demo hedging account required for initial tests. Optional Telegram/push are off by default and tokens must never be committed. Only button on chart.
- No guarantee of a daily trade, any win rate, or positive monthly P&L.

## Files & install

The easiest install: `CEBONK_HARMONIC_ASTRO_FULL_SINGLE_v1.21.mq5` is **standalone**; copy to MT5 `MQL5/Experts` and compile. `.txt` is an identical mirror for mobile; rename it to `.mq5` on desktop. Modular alternative: `CEBONK_HARMONIC_ASTRO_FULL_v1.21.mq5` + `HarmonicScanner.mqh` + `AstroWeeklyDirection.mqh` side by side.

### Validation

- Static source, mirror parity and synthetic dominance contracts are checked by GitHub Actions.
- **MetaEditor compilation not completed. MT5 real-tick backtest not completed.** No profitability figures are claimed.
- Required before live: compile 0 errors, broker XAUUSDc real tick tester, explicit Monday-daily-opposite-vs-weekly test, buy/sell WR and PF separately, monthly net, max equity DD, no duplicated fills, bad-feed fail-closed, order retcodes and Telegram delivery.

Versions v1.10/v1.20 are retained for audit, but **v1.21 is the new candidate**, not merged live.
