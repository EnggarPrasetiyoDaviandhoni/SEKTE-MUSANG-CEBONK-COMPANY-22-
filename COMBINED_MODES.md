# Combined 1 and Combined 2 are independent systems

## COMBINED 1 — original user SOP (restored)
Source: index.html at commit 3ead2e75c4b6f014e6fad163aaf6d05cef71c009.
The historical file is retained under archive/combined1-original-3ead2e75.html.
- Astrology supplies direction and the time window.
- M15: MA20 versus MA50 trend.
- M5: MA20 versus MA50 trend.
- M1: Fibo Musang custom CB1 touch entry, not mandatory CB1 close-break/retest.
- BUY: both MA timeframes bullish, CB1 BUY touched, Astrology BUY. SELL symmetric.
- The original web used SMA, not EMA. The arithmetic is restored verbatim.
- Original Fibo is swing 0 -> CB1 100, target references 1.618 / 2.618 / 4.236.
- Original SL uses swing plus 0.15 of the existing ATR-style M1 buffer calculation.
- Original five-M1-bar observation hold remains in the technical calculation.
No SND/SNR condition is added to Combined 1. New-system changes must not alter it.

## COMBINED 2 — newer automatic system
Astrology -> automatic SND/SNR MN1/W1/D1/H4/H1 -> Fibo Musang one-to-one IB -> separate CB1 close break -> subsequent retest of Zone IB.
FRESH locations are the primary candidates; TESTED is a fallback. No RBR/RBD/DBR/DBD classifier. MA20/50 is not the trend gate for this newer engine. Its numeric core and location scanner were kept unchanged when assigning its own tab.
The engine is a disclosed engineering subset of PDF Entry Level 2, not a complete literal automation of the entire workbook. The price-data API must support native higher-timeframe intervals. Source deployment to GitHub does not deploy the Cloudflare Worker.

## Separation and safeguards
Visible routes: ASTROLOGY | COMBINED 1 | COMBINED 2 | ASTROLOGY NEWS.
Combined 1 is #combined-1; Combined 2 is #combined-2. Separate containers, state objects and refresh timers prevent cross-mode overwrites. The detail panel inside Combined 1 contains its original MA/CB1 audit, not an additional strategy tab.
The original Combined 1 arithmetic and signal rules are preserved byte-for-byte in extracted functions; provenance hashes are in archive/combined-mode-integrity.json. Display-only health guards clear entry/SL/targets when data fails or is stale, or when the current Astrology window is no longer valid. No new SND or break/retest requirement is imposed on Combined 1.
Both are web research observations: no broker order submission, no Telegram broadcast and no MT5 EA modification. The original rule's inherited limitations are not evidence of reliability. No profitability or strategy backtest result is claimed.
Old migration installers stop when the split marker is present rather than removing either system. Tests cover historical arithmetic equivalence, BUY/SELL symmetry, state separation, the new-engine core hash, navigation, browser failures and mobile layout. Synthetic software tests are not financial-performance tests.
