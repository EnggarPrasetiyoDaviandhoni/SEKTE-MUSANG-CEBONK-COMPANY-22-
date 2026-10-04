# CEBONK — Combined 1 / Combined 2 (v2.0.0)

This update retires the previous custom CB1-touch + MA20/MA50 engine. It does not alter the Astrology calculation, Astrology News, the Cloudflare Worker, secrets, or any MT5 EA file.

## Scope of source fidelity
The supplied FIBO_MUSANG_ID.pdf is a 47-page Indonesian compilation of screenshots, not the complete original workbook. This implementation covers **Entry Level 2**: Initial Break, separate Zone IB and CB1, CB1 break, then a subsequent retest of Zone IB (PDF pages 18–19, 23). It does not claim to implement every Entry Level 1–9.

PDF pages 32–33 specify 1.618, 2.618, 4.23 target references and structurally justified Fibo anchors; they do not supply a complete numeric detector. Therefore automated candidates are explicitly suggestions, not certified PDF signals. Users verify the initial sign/IB, CB1, Zone IB, SL and anchors before the application monitors a **new** retest. Historical retests are not resurrected after review. There is no MA, RSI or ATR requirement.

The engineering helper uses 2-neighbour strict pivots, one-to-one body breaks and a bounded 25-candle search. It does not invent hidden-engulfing identification. Body-zone and anchor suggestions must be reviewed, not silently treated as canonical workbook rules. Zone-close invalidation, closed-candle confirmation, fresh-event expiry and data-integrity checks are application safeguards, not additional rules attributed to the PDF.

## Modes
- **FIBO MUSANG PDF:** fetch closed M1/M5/M15 candles, choose a candidate, inspect the chart and levels, complete three review checks, then monitor for CB1 break / a new retest. No direct CB1 entry.
- **SNR/SND:** manually verified price-location map for MN1/W1/D1/H4/H1. Supply/Demand/Support/Resistance names describe user annotations. No automatic RBR/DBR/DBD/RBD, freshness ranking or undocumented numerical SND algorithm is claimed. Zones are stored only in this browser and can be exported/imported; imports start inactive.
- **COMBINED 1:** a current reviewed Musang Level 2 retest and the existing Astrology direction/window must agree at the event and now.
- **COMBINED 2:** all Combined 1 conditions, plus at least one active, verified, same-direction HTF location covering the retest price. Overlapping opposite locations block the signal. All five timeframes do not have to align. Locations added after the retest cannot retroactively create confluence.

Astrology is an external experimental filter, not part of the PDF and not validated against XAUUSD. News is still a separate planner; it is not automatically a gate for Combined 1/2. There are no MT5 orders, position management, Telegram broadcasts, guaranteed win rates or guaranteed monthly returns.

## Data and operation
The existing Worker is used only for XAU/USD intraday OHLC, not NOZAX XAUUSDc. Backend and API keys require no changes. HTF location boundaries must use compatible chart prices; there is no automatic spread/feed correction. Null, malformed, duplicate, future or contradictory OHLC, mismatched symbols/timezones/intervals and gaps in the active structure fail closed. Forming candles cannot confirm a break or retest.

Refresh is at most once each 65 seconds manually and every 5 minutes automatically while a relevant tab is visible. Five-minute polling **can miss M1 signals**. Signals are closed-candle research observations, not tick execution or promises of the displayed fill. A new observation expires at the next setup candle; an error/stale feed resets both Combined decisions to WAIT and hides entry/SL/targets.

## How to use
1. Open the Astrology tab, select the intended WIB date, and calculate it with the experimental model enabled.
2. Open FIBO MUSANG PDF, fetch candles, choose a candidate, correct/verify the levels and tick all three source-review confirmations. Watch for a NEW retest after confirmation.
3. Combined 1 shows the conjunction. It never fabricates a missing signal.
4. Add verified context locations on SNR/SND before the retest to enable Combined 2.
5. Use JSON audit or copy controls. Local annotations are not shared automatically with visitors.

## Tests and installation
`node tests/musang-pdf.test.cjs` runs deterministic synthetic tests (not a backtest).
`node tools/install-musang-pdf.cjs` performs a guarded, idempotent replacement of only the old technical views/script and adds three assets. It checks the existing astronomy core and UI remain byte-identical. The existing news test suite is run in CI as a regression check. Do not mistake passing software tests for profitable trading evidence.
