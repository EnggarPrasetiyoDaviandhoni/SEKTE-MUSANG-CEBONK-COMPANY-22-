# CEBONK COMBINED 2 — EA MT5 v1.00, default M5

COMBINED 1 and all existing web/EA files are unchanged. This folder adds a separate EA with magic 220202. It ports the current Combined 2 price engine, not Combined 1's MA20/50 + CB1-touch rule.

## Download / install
Use `dist/CEBONK_COMBINED2_M5_v1.00.mq5` (single file), or the identical `.txt` renamed to `.mq5`. Copy to MT5 desktop: File -> Open Data Folder -> MQL5 -> Experts. Compile with MetaEditor and attach to **XAUUSDc**. The chart timeframe may differ: `InpExecutionTF=PERIOD_M5` controls the strategy. Supported execution TF choices: M1/M5/M15.

Do not attach alongside the old EA with the expectation both can open at once: this EA permits only one position or pending order on its symbol, including manual/Combined 1 positions. It never modifies or closes those other positions. The exclusive local instance lock prevents duplicate instances using the same account/server/symbol/magic on the same computer. Multiple VPS terminals are not globally coordinated.

## What actually runs automatically
1. Astrology: the same pinned CebonkCore web model calculates real ephemerides using astronomy-engine 2.1.19. Monthly CSV files in `data/` contain precomputed model windows, not hand-entered BUY/SELL guesses. The EA downloads the current WIB month's file from this repository's GitHub Pages site. No Twelve Data token, Cloudflare upgrade, Python service, or open browser is needed for this EA.
2. Locations: native broker OHLC for MN1, W1, D1, H4, H1; automatic SND/SNR. FRESH first, distinct-TF overlap/nesting next. TESTED once is fallback; BROKEN / DATA_GAP / repeated visits excluded. No RBR/RBD/DBR/DBD classifier. Missing TF is reported and does not block a healthy TF unless `InpRequireAllFiveTF=true`.
3. Musang: default M5. One-to-one Initial Break -> separate CB1 closed-candle break -> first later Zone IB retest. **CB1 touch by itself is NOT entry.** No MA20/MA50, RSI or ATR filter.
4. Entry: evaluate a NEW closed retest bar, then send a protected market order only if the current Ask/Bid is still sufficiently close to the reference retest price and the same Astrology window was active at retest start and now. It does NOT retrospectively fill at the historical wick/zone price. All SL/TP use broker prices, not the website provider's prices.

The EA evaluates at execution-bar changes rather than the web's 5-minute refresh timer. It deliberately skips a retest that started before attach/restart/arming, late ticks more than 15 seconds after the retest close, stale quotes, conflicting locations, ambiguous same-candle SL/TP, and previously consumed signals. It attempts a signal once, including when blocked/off; no retry chase. HTTP/Telegram work is timer-queued, not called on each price tick, although MQL5 WebRequest remains synchronous and can delay that EA's event loop.

## Defaults and arming
- Symbol XAUUSDc, lot 0.01, spread maximum 70 broker points; magic 220202.
- **AUTOPILOT OFF**, **InpAcceptExperimentalAstro=false**, **InpAllowRealAccount=false** initially.
- For a demo test, set `InpAcceptExperimentalAstro=true`, permit terminal Algo Trading, then turn the chart button ON. It waits for a NEW eligible retest; it does not instantly open the old displayed setup.
- `InpMaxTradeRiskPct=1.0`: fixed lot is never increased; orders above the pre-slippage/commission 1% equity risk estimate are blocked. Set 0 only to intentionally disable this extra execution cap.
- SL: outside the source Zone IB wick + 5% of its body-zone width, matching the web numeric engine. Fibonacci 0 = relevant broken body boundary; 100 = first valid CB1-break close.
- TP choice 1.618 / **2.618 default** / 4.23. These are Fibonacci targets, NOT fixed RR. Telegram reports RR from actual fill; `InpMinRR=0` does not impose another ratio. No ATR SL/TP.
- `InpMaxDriftR=0.25` and `InpMaxEntryDelaySeconds=15` are live execution safeguards, not additional PDF rules. A market fill may differ or be rejected. Stop slippage can exceed the estimated risk cap.
- No martingale, recovery, layering, breakeven, trailing, strategic partial close or early exit. Broker IOC partial fills, if unavoidable, are reported rather than topped up.

The UI is only AUTOPILOT ON/OFF. Hover its tooltip or inspect Experts/Journal for the exact WAIT/block reason. `InpWriteAuditCSV=true` records events under MQL5/Files. Telegram is readable multiline text sent via JSON POST; Journal retains escaped JSON. On confirmed exits, net position-to-date includes entry/exit commissions, fees and swap recorded on that position's deals. Separate broker balance charges cannot be assigned automatically.

## Network setup once
MT5: Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URLs:

```
https://enggarprasetiyodaviandhoni.github.io
https://api.telegram.org
```

Telegram inputs: `InpTelegram=true`, `InpTelegramToken=<your bot token>`, `InpTelegramChatID=<your chat id>`. Start the bot / add it to your chat first. Do not commit these credentials. `InpTelegramTestOnStart=true` queues a non-trading test message. No Telegram messages are sent in Strategy Tester. At most three transient retries; an uncertain delivery may result in duplicate notification, never duplicate order.

The live CSV file is fetched initially, at month change and about every six hours. A failed/invalid refresh clears live schedule eligibility and produces WAIT; no hardcoded SELL or manual fallback. A currently cached valid precomputed schedule does not require a per-minute heartbeat. The files have an explicit coverage range in `data/coverage.json`; after coverage ends the EA waits. No schedule-update automation is silently installed.

## Backtest
Use MT5 Strategy Tester on XAUUSDc, preferably real ticks. The tester automatically uses LOCAL CSV because WebRequest is unavailable there. Copy `data/CEBONK_C2_ASTRO.csv` to the terminal's **MQL5/Files** before starting; the fixed `#property tester_file` transfers this filename to test agents. Do not rename it for cloud/remote agents. `InpCSVCommonFolder` only applies live; tester uses its own sandbox. Load `BACKTEST_M5.set` from the package (autopilot/experimental acknowledgment enabled specifically for testing).

The starter dataset is generated for 2026-01-01 through 2027-12-31, daily 06:00–24:00 WIB. Use only dates actually present in `coverage.json`; absent dates and 00:00–06:00 WIB give WAIT. Historical native broker data availability is separate from the astrology schedule.

**Time conversion:** live mode can derive the current server UTC offset from TimeTradeServer/TimeGMT. Tester cannot: MT5 makes TimeGMT equal simulated server time. `InpServerUTCMinutes=180` is the default based on the user's GMT+3 setting, NOT proof all historical NOZAX data is GMT+3. Verify broker history; split tests into constant-offset periods and use 120/180 or the broker's actual offset as appropriate. Do not interpret a DST-misaligned backtest as strategy evidence. Native candle shapes follow the broker's own daily/weekly/monthly boundaries and may differ from Twelve Data.

Assess BUY and SELL win rates separately, drawdown, trade count and each calendar month's net profit. No claim of reaching a win-rate target or making every month profitable is made here. Attaching/compiling does not prove that an entry exists in the selected period.

## Generate different dates
From this folder with Node.js installed:

```
npm ci
node tools/generate-astro.cjs 2024-01-01 2027-12-31
```

The generator verifies the pinned model's provenance and produces native ephemeris-derived model windows with exact 5-minute boundaries. It writes monthly files plus the combined tester CSV. Upload the new `data/` files to this same GitHub folder for live monthly downloading, or copy only the combined CSV to MT5 for offline testing. This is a computed experimental model, not a forecast with demonstrated accuracy.

## Source and test limits
Price-engine basis: source commit `35ce78b437c26ca28577e835676c5655113579cf`, `assets/auto-combined-core.js` v3.1.0 and `assets/snd-auto-core.js`. Astrology: the exact CebonkCore from that commit, archived under `vendor/` with a hash. Core constants (2-neighbour pivots, median 20, width 0.08–0.50, displacement >=1.5 median in 3 bars, bounded Musang search 25) are existing engineering choices, not literal numeric rules quoted from the PDF.

This is the existing one-to-one Entry Level 2 subset, not every Fibo Musang level/hidden engulfing. FRESH refers to the inspected CLOSED source-timeframe bars; intrabar HTF touches may not yet be visible and retest counts are lower bounds. Native broker price data can differ from the web provider, so identical rules do not guarantee identical signals across feeds.

CI runs original JS regressions, a C++ compatibility harness executing syntax-adapted pure MQL core arithmetic against the real JS reference, schedule/schema tests, source-wiring checks, and packaging hashes. **C++ compatibility testing is NOT compiling the EA with MetaEditor. No MetaEditor compiler or MT5 broker terminal is available in this build environment. No EX5 is supplied, and no MT5 backtest/live trading success is claimed.** Compile in MetaEditor and test on demo before enabling a real account.

Official implementation references:
- https://www.mql5.com/en/docs/network/webrequest
- https://www.mql5.com/en/docs/dateandtime/timegmt
- https://www.mql5.com/en/docs/files/fileopen
- https://www.mql5.com/en/docs/trading/ordersend
