# CEBONK COMPANY 22 — XAGUSD First Quarter Saving (website source)

## Source of truth

The browser Moon calendar and the MT5 feed are derived from the same
`astronomy-engine@2.1.19` lunar-quarter functions. GitHub Actions generates
`data/first_quarters.json` daily (01:35 UTC) using
`scripts/generate-xagusd-first-quarter.mjs`.

Feed:
`https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/xagusd_first_quarter/data/first_quarters.json`

The feed contains `FIRST_QUARTER` UTC Unix timestamps. Times are UTC to avoid
double-applying broker DST. Neither buy/sell astrology scores nor the illumination
percentages make automatic order decisions for this savings EA.

If `status` is `PENDING`, JSON stale, or a WebRequest fails, the EA MUST WAIT.
This is intentional fail-closed behavior: no local astronomy fallback.

## Installation (MT5, not MT4)

1. Place **CEBONK_XAGUSD_FIRST_QUARTER_WEB_v1.10.mq5** in MQL5/Experts and compile in MetaEditor.
2. Open chart XAGUSD or the broker's suffix (e.g. XAGUSDc).
3. Open MT5 Tools > Options > Expert Advisors and allow WebRequest:
   `https://raw.githubusercontent.com`
4. The EA's default settings: Autopilot OFF, real-account lock ON,
   BUY 0.01, maximum 5 open BUY positions, zero SL/TP.
5. When the feed is READY and trading is enabled, unlock only on demo first.

Market hours are read with `SymbolInfoSessionTrade` from the connected broker,
not from the public website, so a weekend First Quarter is scheduled for the last
prior tradable session (normally Friday). Entries never fire if the scheduled
time is missed. One purchase per First Quarter event, deduplicated by event UTC
epoch/account/symbol/Magic Number. Distinct positions require a hedging account.

## Important limitations

- Website AUTO GMT+2 / GMT+3 is an NY-DST estimate, NOT a live MT5 bridge;
  the EA derives the current broker-server clock itself.
- A direct WebRequest does not work in MT5 Strategy Tester. Optional local JSON
  fixtures can be used for tester replays; **no manual CSV is needed live**.
- The strategy is not a guaranteed savings vehicle: leveraged XAGUSD without SL
  or TP can lose more than expected, accumulate swaps, and be forcibly liquidated.
- The code is not claimed to have been compiled or backtested in the user's
  MetaEditor / NOZAX environment.
