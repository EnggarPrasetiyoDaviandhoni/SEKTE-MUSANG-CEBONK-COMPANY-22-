# CEBONK SND/SNR AUTO v1.0.0

Sequence: Astrology direction/time -> automatic SND/SNR location -> existing PDF Musang Entry Level 2. The scanner replaces manual zone inputs as the location source for COMBINED 2. COMBINED 1 stays Astrology + reviewed Musang without this location filter.

## Automatic scope
Native MN1, W1, D1, H4 and H1 OHLC are requested automatically when SND/SNR or COMBINED 2 is opened. No manual zone prices, map import or chart-verification checkbox is required for the location scanner. Existing manual annotations are not deleted from localStorage, but cannot enable COMBINED 2. There is no RBR/RBD/DBR/DBD classifier.

The existing Fibo Musang execution module is deliberately preserved: IB -> CB1 closed-candle break -> subsequent retest of Zone IB. Its existing structure/anchor review is STILL required. This update automates SND/SNR, not the complete discretionary PDF workbook. It does not automatically create broker orders, change an MT5 EA, broadcast Telegram, or alter Astrology/News scores.

## Engineering rules (not rules attributed to the PDF)
- SNR: strict pivot, two closed candles each side. Support uses the low-side wick/body region; resistance the high-side region. Width is bounded to 0.08-0.50 times the median range of the previous 20 bars.
- SND: the same structural origin must precede displacement, with a directional close beyond the origin candle and at least 1.5 median ranges away from its proximal edge within three candles. This is an OHLC location heuristic, not measured resting orders or proven institutional supply/demand.
- Formation time is not earlier than the last required confirmation candle close. Boundaries lock to the historical formation; extra future candles may change status, not old boundaries.
- FRESH: no return intersecting the zone after its departure within inspected data. TESTED: at least one return. Contiguous intersecting source-TF bars count as one visit. The count is a LOWER BOUND at that timeframe, not an exact tick retest count. A fresh zone becomes tested when revisited; this is not an automatic trade signal.
- BROKEN: a closed source-timeframe candle closes through the distal boundary. Forming candles can provide touch evidence, but cannot confirm a break or a new origin.
- Unexplained intraday gaps invalidate location eligibility (DATA_GAP); weekends have a bounded allowance. Without a verified session calendar, maintenance/holiday gaps may also conservatively exclude an old zone. Missing data is never filled with invented candles.
- Ranking: FRESH first; distinct-TF overlapping confluence next; SND origin preference; normalized distance and recency as tie breakers. Same-TF duplicate labels do not count as MTF confluence. Nested requires containment, not merely proximity.

## COMBINED 2
The reviewed current Musang retest and the existing Astrology window must agree. The retest price must also fall inside a same-direction automatically detected zone that was already confirmed BEFORE the event. Broken/gapped/expired data cannot qualify. Overlapping opposite-direction active zones block COMBINED 2. TESTED is a fallback when no FRESH zone covers the event. At least one healthy context TF is required, not all five; missing TFs are explicitly reported as partial coverage. COMBINED 1 is unchanged.

## Data and deployment
The old deployed Worker only accepted intraday intervals. The repository's cloudflare-worker.js is now v2.1.0, adding 1day, 1week and 1month while preserving /health and /xau. YOU MUST DEPLOY THIS FILE TO THE EXISTING CLOUDFLARE WORKER ONCE. A GitHub commit does NOT update Cloudflare. Keep TWELVE_DATA_KEY as the existing Secret. Do not publish or send the key.

Open setup-htf.html on the website: copy the whole Worker code, paste into c eb onk-xau-api's Edit code (actual name: cebonk-xau-api), Deploy, then check /health for htfEnabled:true. Data access also depends on provider entitlements/history. Unsupported TFs show an explicit error instead of fabricated zones. No fallback resampling of a few intraday candles into months.

Twelve Data intraday timestamps are requested in UTC. Daily/weekly/monthly data retain the provider's exchange timezone: its documentation says timezone=UTC is ignored for those intervals. The scanner converts exchange calendar timestamps and handles variable month lengths and DST; ambiguous/nonexistent clock times fail closed. Native feed OHLC can differ from NOZAX/XAUUSDc. The displayed H1 close is NOT a live execution quote.

Requests are cached per TF and fetched sequentially. Automatic refresh checks every five minutes while a relevant tab and browser are visible. Cache ages: H1 10m, H4 30m, D1 1h, W1 4h, MN1 6h. This is not tick execution or an always-running service; price may revisit a zone between polls. It does not run while the browser is closed. Public endpoint CORS is not authentication or a global API-quota guarantee. Verify provider entitlements/public-display rights before distributing feed data.

## Tests
The install workflow runs deterministic scanner, Worker/Combined integration, original PDF/News regressions and actual-host mobile browser tests with clearly synthetic data. Passing software tests is NOT a profitability, hit-rate, freshness-at-every-tick or backtest claim. The live Worker health probe reads only public capability flags, not the API key; this does not establish that all five paid data intervals are available.

Primary technical references checked 2026-10-04:
- https://support.twelvedata.com/en/articles/5656039-how-to-get-historical-prices
- https://twelvedata.com/docs/markets/market-state (timezone restrictions and time_series)
- https://developers.cloudflare.com/workers/runtime-apis/cache/
