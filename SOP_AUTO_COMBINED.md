> CURRENT ROUTING: this new-system SOP belongs to COMBINED 2 only. COMBINED 1 is restored from 3ead2e75 and must not be overwritten. Older scope notes below describe the earlier migration, not authorization to delete Combined 1.

# CEBONK AUTO SOP — v3.1.0

## Scope requested 4 October 2026
Remove the crossed-out FIBO MUSANG PDF, COMBINED 2 and SNR/SND tabs and their manual forms. Retain ASTROLOGY, COMBINED 2 and ASTROLOGY NEWS. COMBINED 2 now runs the single automatic SOP. Old modules remain in Git history/repository for audit but are not loaded. Local manual annotations are not consumed or silently deleted. No MT5 EA is changed.

## Pipeline
Astrology direction/time -> automatic MN1/W1/D1/H4/H1 location -> Initial Break -> separate CB1 close break -> subsequent Zone IB retest -> ENTRY observation or WAIT. BUY/SELL symmetric. No direct CB1 entry, MA20/50, RSI or ATR. No manual zone/price/review input.

Astrology uses the existing unmodified CebonkCore experimental score. Combined automatically calculates the current WIB date, 06:00–00:00; historical dates selected in the Astrology tab do not drive live signals. Astrology must agree at the retest and now in the same window. Astrology News remains separate, not a new automatic news gate.

## Source fidelity and explicit engineering definitions
The provided FIBO_MUSANG_ID.pdf is an Indonesian screenshot compilation, not the entire original workbook. Pages 18–19 and 23 specify separate Zone IB/CB1, confirmation by CB1 break and entry on a subsequent retest; pages 32–33 give target/anchor references. This automation covers a conservative **one-to-one body-break branch of Entry Level 2**, not every hidden engulfing or Level 1–9. It is NOT a certified complete or literal numerical implementation of the PDF. Ambiguous or unsupported structures produce WAIT.

The following numeric detector rules are engineering choices, not rules quoted from the PDF:
- Strict pivots: two candles each side, available only after right-side candles close.
- SNR: pivot wick-to-body band; zero-width bands skipped.
- SNR/SND location rules now use assets/snd-auto-core.js: confirmed swing -> bounded wick/body zone (0.08–0.50 median of previous 20 source-bar ranges). SND additionally requires close displacement beyond the source candle and >=1.5 median ranges within three candles. No RBR/RBD/DBR/DBD pattern classifier. These are engineering definitions, not rules attributed to the PDF. Unexplained source-history gaps yield DATA_GAP, not FRESH.
- Freshness: after formation/departure, count distinct overlap episodes, not consecutive candles. Close beyond distal boundary means BROKEN; never reuse the original role. FRESH priority, TESTED once eligible, more visits skipped. This is ranking policy, not measured win probability.
- Key levels: previous completed D1/W1/MN1 high/low and confirmed swings. Optional confluence, not a mandatory extra signal gate. Must fall within the zone plus 10% of its width; same source candle and TF cannot count as independent confirmation. Key levels never trigger entries.
- Nested/confluence: distinct same-side TF zones must geometrically contain/overlap. Used for ranking, not a fabricated extra probability score. Opposing eligible locations containing the retest price block entry.
- Musang: New High/New Low pair and intervening CB1; opposite candle followed by one-to-one body close break provides the IB candidate. CB1 must lie outside Zone IB in the break direction. Search bounded to 25 candles after the new extreme. No pre-confirmation pivot hindsight.
- Fibo 0: relevant broken body boundary; 100: close of the first valid CB1 break, frozen thereafter. SL beyond source-zone wick +5% of body-zone width. Target references 1.618 / 2.618 / 4.23; RR calculated, not fixed at 2.
- First subsequent retest only. No resurrection of old retests. Same-candle retest plus SL or target is ambiguous -> WAIT. Observation expires at the next setup candle. This is not a promised fill at the displayed historical touch price.

## Data requirements / deployment truth
Current source supports native provider M1, M5, M15, H1, H4, D1, W1, MN1. It never invents MN1 from a few intraday bars. UTC intraday data is kept separate from exchange-calendar daily/weekly/monthly dates; missing timezone metadata fails closed. Null, invalid, future, duplicate or contradictory OHLC is rejected. Forming candles do not confirm structure. Gaps in the active Musang sequence block observations.

**GitHub deployment is not Cloudflare deployment.** The original Worker allowed only intraday intervals. `cloudflare-worker.js` / `worker/auto-sop-v3.mjs` adds daily/weekly/monthly capability; paste it once into the SAME Cloudflare Worker and Deploy, retaining Secret TWELVE_DATA_KEY. The web has a copy-upgrade button in the API details section. No API key belongs in GitHub or chat.

Missing macro intervals appear as API_PERLU_UPGRADE / errors; complete 5-TF coverage is NOT claimed. Valid H1/H4 can be scanned independently. Decisions include explicit coverage so a partial map cannot be presented as a complete five-TF scan. No switch to an unrelated price provider or invented fallback.

Browser refresh every five minutes while Combined is visible. Manual refresh bounded to >=65 seconds; HTF requests are cached longer. Five-minute polling can miss M1 signals. Closed/stale markets produce WAIT. Browser/edge caching reduces usage but is not a global daily quota guarantee, especially for many visitors. Public redisplay remains subject to the provider's account permissions.

## Operation
Open COMBINED 2: scan starts automatically, no price form. Read KEPUTUSAN, Astrology window, active zone/key, Musang stage, target/RR and five-TF data coverage. Optional TF selector M1/M5/M15, default M1. The other two tabs retain their prior functionality. There are no order submissions, Telegram broadcasts, position management, profit guarantees or empirical accuracy claims.

## Validation
Synthetic deterministic engine tests, mocked Worker tests, actual-host browser navigation/error tests, and existing Astrology News regression checks. Tests do not establish profitability. No live broker execution or real-price strategy backtest was performed.

Primary API references reviewed 2026-10-04:
- https://twelvedata.com/docs/markets/market-state (time_series: daily timezone parameter is ignored; exchange calendar applies)
- https://support.twelvedata.com/en/articles/5656039-how-to-get-historical-prices
- https://developers.cloudflare.com/workers/configuration/secrets/

## v3.1.0 location reconciliation
Preserves the current three-tab automatic host and existing Musang execution, not the earlier manual screens. FRESH is ranked before TESTED even when TESTED is nearer; only the current Astrology side is shown in the primary candidate list. BROKEN/DATA_GAP are excluded. Key levels cannot demote a standalone FRESH location to ineligible. Status is assessed from CLOSED native source bars, not tick-complete history: a touch within an unfinished HTF candle can be unobserved until it closes. Retest counts are a lower bound at source TF. Requests now run sequentially, use provider timestamps, and exclude expired cached frames from decisions. This is a research observation engine, not a broker-execution system or empirically validated strategy.
