# CEBONK Astrology News — v1.0.0

Open the existing website and choose ASTROLOGY NEWS, or append #astrology-news.
This is a research planner. No order, Telegram broadcast, verified win rate or causal
astronomy/price relationship is claimed. News supplies the timestamp; the existing
CebonkCore supplies its unchanged experimental BUY/SELL score. The other tabs and EA
are not connected to, or modified by, this module.

## Use
Select a verified preset or enter the news name, date, time and zone manually.
Confirm the schedule against the primary source, then press HITUNG ASTROLOGY NEWS.
Default scan is 30 minutes before through 120 minutes after release, on a 5-minute
UTC grid. Default exclusion is 5 minutes before and 5 minutes after release.
These buffers are editable risk rules, NOT a prediction that whipsaw will end then.

The focus is the direction with the longest eligible post-release window (minimum
15 minutes). Ties use aggregate duration; a remaining tie becomes NEUTRAL.
The first 10 minutes of each qualified window are experimental entry candidates;
the remainder is continuation with no new entries. The end of an entry interval is
exclusive. Opposite-direction windows are SKIP. A second opportunity is shown only
when there is an actual second qualifying run. No windows are manufactured.
A peak means maximum absolute model score within that entry window, not a price peak.
The end of the scan is not evidence that the underlying bias has expired.

## Calendar provenance — snapshot checked 2026-10-04, not a live feed
- BLS: https://www.bls.gov/schedule/2026/10_sched.htm
  NFP Oct 2, CPI Oct 14, PPI Oct 15, all 08:30 Eastern / 12:30 UTC / 19:30 WIB.
- Federal Reserve: https://www.federalreserve.gov/newsevents/2026-october.htm
  Minutes Oct 7 at 14:00 Eastern, statement Oct 28 at 14:00 Eastern, press conference
  Oct 28 at 14:30 Eastern. The latter two appear on Oct 29 at 01:00 and 01:30 WIB.
- BEA: https://www.bea.gov/news/schedule
  GDP advance Q3 and Personal Income and Outlays / PCE both Oct 29 at 08:30 Eastern.

Other-event protection covers ONLY these eight snapshot events, not all economic
news. Dates may be revised. Fed speeches and other dates use confirmed manual input.
UTC / WIB / New York / Luxor input is supported. Ambiguous or nonexistent DST clock
hours are rejected, not guessed. For those cases enter an unambiguous UTC/WIB time.
Luxor time uses the same host Africa/Cairo snapshot, not the device location.

## Implementation and validation
One module: assets/astro-news-v1.js, appended via a single loader in index.html.
No new API keys or Cloudflare deployment are required. The pinned astronomy library
still needs internet when not already loaded. Failure emits no substitute results.
Existing CEBONK_ASTRO_STATE and CEBONK_TECH_STATE are not overwritten.
Source changes invalidate output and exports. CSV/JSON/copy include experimental labels.
The module supports browser print/PDF, without inventing a price chart or SL/TP.

The install workflow runs only on relevant source pushes or manual workflow dispatch;
it is not a scheduled monitor. It tests against the actual host core, downloads the
pinned Astronomy Engine 2.1.19 for integration checks, appends only the loader,
commits that edit and requests a Pages rebuild. It never changes broker settings,
secrets, Cloudflare configuration or the EA. It cannot promise a profitable trade.
