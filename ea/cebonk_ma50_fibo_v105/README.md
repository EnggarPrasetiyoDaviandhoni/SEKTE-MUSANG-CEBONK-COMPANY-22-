# CEBONK MA50 Cross + Fibo Musang Elite v1.05 (EXPERIMENTAL)

**Single runtime source:** CEBONK_MA50_FIBO_ELITE_v1.05.mq5 (~658 lines). This independent EA does not overwrite any older EA. **No live deployment** until MetaEditor compile and realistic broker tick backtests. AUTOPILOT OFF, real-account trading forbidden by default.

## Locked strategy contract

1. **H1 BBMA Re-entry:** latest closed Re-entry, BB20/2, LWMA5/10 High/Low and MidBB aligned.
2. **M15 CSAK/CSM + exact MA50 cross:** EMA50(CLOSE) default, BB20/2 MidBB. BUY when MidBB crosses ABOVE MA50; SELL when MidBB crosses BELOW MA50. CSAK/CSM closed confirmation must agree within three M15 bars of cross. MA50 must be below entire BUY signal candle and below MidBB, or above SELL candle and MidBB. There is **no standalone CSA** or cross-alignment fallback.
3. **Mandatory OLD sideways gate:** (UpperBB-LowerBB)/ATR14 on M15 >= 1.8 on the latest CLOSED M15 bar; failure cancels armed setups and blocks both directions. No experimental median-width squeeze.
4. **M5 Initial Break -> CB1 closed break -> first retest** within Fibo Musang Elite 0.12–0.236. IB candle close breaks prior bar high/low and body ratio >=0.50; CB1 is the intervening swing level between two confirmed lower lows (BUY) or higher highs (SELL). CB1 continuation remains OFF.
5. **Experimental Fibo anchor:** Fibo 0 at the IB base structural wick extreme (BUY low / SELL high), 1 at the CB1 breakout candle BODY CLOSE. This is an executable approximation; **compare against the original workbook/screenshot before acceptance**, not a claim of canonical exactness.
6. **Entry:** market Ask for BUY, Bid for SELL within 0.12–0.236. **SL:** IB structural wick with zero user buffer (tick-grid normalization only). **TP:** Fibo 1.618 primary; 2.618 and Cycle 4.23 are informational only. Reject if actual proposed RR <1:2; do not shift SL or TP to force a setup.
7. **ATR14 M5 only for SL-distance sanity:** 0.5×ATR <= entry-to-structure-SL <=8×ATR. Bounds experimental. ATR never replaces/moves structural SL or Fibo TP. ATR14 M15 independently serves the sideways gate.
8. Fixed lot default 0.01; max 3 hedging layers per setup, and 3 concurrent positions. Total open-risk cap 2% of equity and individual trade risk cap 0.5%, calculated by OrderCalcProfit; recalculate after fills. Daily equity loss cap 5%. Pending orders for this symbol/magic block additional fills.
9. Persist armed setup and Fibonacci anchors across terminal restarts via terminal global variables. Atomic one-event claim blocks duplicate retest orders. Expire after 24 M5 bars.
10. Spread max 70 broker points, broker-local session 07:00–23:00 (verify server GMT offset and DST). Hedging account required. No BE, trailing, partial close, martingale, or recovery.
11. Single MQ5 file; chart only AUTOPILOT ON/OFF. Telegram/Push optional. Telegram requires manually allowing https://api.telegram.org in MT5 WebRequest settings. Credentials are empty.

## HIGH / MEDIUM audit acceptance

| ID | Finding | Code response | Required verification |
|---|---|---|---|
| H-01 | Layer count does not constrain aggregate risk | RiskAllowed calculates sum of Symbol+Magic open risks plus next order; AuditPositions checks realized positions | 3-layer, slippage, reload, account balance tests |
| M-01 | BUY/SELL execution asymmetry | Real Ask/Bid, explicit spread check, symmetric directional stop and RR | BUY/SELL skip reason and fill distribution |
| M-02 | Continuation CB1 OFF | Only initial CB1 breakout and first Fibo retest eligible | No continuation entry |
| M-03 | IB chosen with optimistic RR | RR evaluated at the actual proposed quote immediately before each layer | Spread, price gaps and 1.618 target tests |
| M-04 | Actual fill SL/TP not reconciled | Reconcile on entry deal, AuditPositions on every tick; unsafe fills force halt and attempt close | Partial fill, missing SL, stop mismatch and rejection |
| Recovery | Restarts duplicate/drop retest | Persist phase/bias/anchor; terminal global variable claim per event | Restart at WAIT_CB1, WAIT_RETEST, multi-chart test |

**Known limitations:** Error/rejection of emergency closing can leave risk; monitoring and MT5 terminal alert checks are required. Terminal global variable recovery under crash and concurrent charts is not guaranteed until scenario tested.

## Before allowing a merge or live usage

- [ ] Compile with MetaEditor 5 (F7) = zero errors. Not available in this connector session.
- [ ] Visual verification of reference IB, CB1 and Fibo anchor on original Fibo Musang Elite screenshots for both BUY and SELL.
- [ ] Backtest NOZAX XAUUSDc using 2024–2026 *every tick based on real ticks*; include spread, commission and slippage.
- [ ] Compare Fibo structural SL/TP against ATR SL/TP with identical entries; report monthly net profit, separate BUY/SELL WR/PF, drawdown, total trades and effective RR.
- [ ] Test 3-layer aggregate risk, realized-price fill, missing SL/TP, order rejection, spread >70, sessions, holidays, broker stop/freeze distances.
- [ ] Restart in WAIT_CB1 and WAIT_RETEST, two EA instances on the same symbol/magic, low-history indicators, failed Telegram send.
- [ ] Demo forward test and independent code audit before enabling real-account setting.

**Status:** Draft; static file inspection only. No claim of successful MetaEditor compilation, trading backtest, winrate or profit.