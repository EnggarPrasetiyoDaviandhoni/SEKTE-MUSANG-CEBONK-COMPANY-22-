# CEBONK BBMA + FMCBR 2TF + Fibo Musang Elite AUTO LOT v1.01

Independent, EXPERIMENTAL MT5 EA. Old BBMA 3TF and existing website are not overwritten.

## Trading rules

- TF1 default M15: **BBMA PETA ARAH from CSA, CSAK, CSM**, not a generic MA trend classifier. Closed-candle **CSA** = directional close beyond LWMA5/10 High (BUY) / Low (SELL), on the near side of MidBB; **CSAK** = close beyond LWMA5/10 and MidBB inside BB; **CSM** = momentum close outside upper BB (BUY) / lower BB (SELL). Latest valid CSA/CSAK/CSM from up to `InpTF1SignalAgeBars=8` closed TF1 candles defines the bias; slope of MidBB and MA defense of newest TF1 candle must agree. Opposite/expired signal, sideways or absent history = NEUTRAL / NO ENTRY. All signals based on BB20/2 and LWMA5/10 High/Low.
- TF2 default M5: FMCBR EL2 (or optional EL3 A). Both timeframes individually adjustable from **21 native MT5 timeframes**, with **210 valid higher-to-lower pairs**; chart/tester displayed TF is independent. TF1 must be larger than TF2. M1 can be the entry TF2 but cannot be the higher mapping TF1 without a shorter TF2; MN1 can be TF1 but not lower TF2. Each pair requires its own available historical bars; a WAIT_HISTORY for an unsupported/empty pair does not disable other pairs.
- Supported native periods: M1, M2, M3, M4, M5, M6, M10, M12, M15, M20, M30, H1, H2, H3, H4, H6, H8, H12, D1, W1, MN1.
- During tester start or terminal restart, indicators/history must be warm; EA logs `WAIT_HISTORY` until both selected TFs are ready and prints `HISTORY_READY`. The first already-closed bar after warm-up is not retro-traded; evaluation begins on the next TF2 close.
- SIDEWAYS = NO ENTRY. Sideways rejection runs on BOTH TFs: (BB upper-lower <= 1.5 x ATR14) AND (absolute MidBB move of 3 closed bars <= 0.25 x ATR14); reject also if TF1 BBMA bias is unclear. Sideways mid-setup cancels it. ATR is for sideways only, never SL.
- FMCBR IB = **Initial Break**, not Inside Bar. Latest closed TF2 candle must have >=50% body/range and close beyond previous bar high (BUY) or low (SELL). Frozen initial zone = wick-to-body region of last opposing candle within 8 bars that the IB close defeats. This is a **mechanical interpretation** of visual PDF examples, not a verbatim rule supplied in the teaching material.
- CB1 = nearest old confirmed pivot; CB2 = next older, farther pivot. Do not use any unclosed bars or future swing information.
- EL2: Initial Break -> candle CLOSE past CB1 -> subsequent zone retest/rejection -> MARKET order. IB itself may also clear CB1.
- EL3 A: Initial Break -> CB1 and CB2 CLOSE breaks -> subsequent zone retest/rejection. EL3 B, EL4-EL9 NOT implemented in this EA.
- Expiry: 24 closed TF2 bars. Cancel on failed BBMA bias / sideways or candle close past far edge of frozen zone. No forced entry per day.

## SL / TP (NO BUFFER)

BUY SL = low of frozen zone; SELL SL = high of frozen zone. No ATR, points, or pip padding; only broker tick-size rounding outward where needed. Broker minimum stop rule violations -> SKIP trade, never widen stop. TP = 2x risk distance (RR 1:2). No breakeven, trailing stop, partial close, recovery, or martingale.

## Fibo MUSANG ELITE

Eighteen exact stored levels:
0; 0.12; 0.236; 0.382; 0.5; 0.786; 0.88; 1.272; 1.314; 1.618; 1.786; 1.88; 2.618; 2.786; 2.880; 4.23; 4.786; 4.88.

For this CB1-based EA: base anchor = zone low (BUY) / zone high (SELL). Directional anchor = first confirmed CB1-break candle BODY CLOSE, frozen. ElitePrice(level) = base + (breakClose-base)*level. Elite TP1 1.618, TP2 2.618 and Cycle 4.23 show as notification REFERENCES ONLY; they do not replace the broker's fixed RR 1:2 TP. Dominant Break anchor variation is not implemented and needs its own objective rule.

## AUTO LOT and account protection

InpLotMode=0 AUTO RISK (default), =1 FIXED LOT. Default risk = 0.50% of ACCOUNT_EQUITY measured in the account currency, including cent accounts. Broker-specific OrderCalcProfit(symbol, lot, entry, exact SL) supplies expected cash risk, not an assumed gold pip value. Lot rounds DOWN to broker lot step. If min lot already exceeds available risk budget, SKIP trade: never force 0.01. FixedLot input = 0.01 alternative.

New trades constrained by:
- InpMaxTotalRiskPercent=2.00%, across all open positions with this magic on the account, with SL-risk recomputed. A missing SL on an EA position blocks further trade.
- InpMaxDailyDDPercent=5.00%, comparing current equity against first observed server-day equity, stored in MT5 terminal global variables across restarts. Also reserve remaining daily risk against current positions. A new server day resets baseline. Existing positions are NOT liquidated at limit.
- InpMaxSpreadPoints=70; spread <=20% of entry-to-structure-SL distance; tick size, volume step, available free margin, minimum stop and freeze levels must pass.
- Opening session is 07:00 inclusive through before 23:00, broker-server time Monday-Friday, intended GMT+3. Netting accounts block another same-symbol position to avoid modifying its SL/TP. Hedging allows multiple different setups subject to risk limits; terminal global claim prevents duplicate IB orders across chart instances.

Daily DD 5% is an entry guard, NOT a guarantee that losses cannot exceed 5% due to market gaps, slippage, commissions, broker execution or positions outside this EA. First EA activation during a day records the baseline at activation, not retroactively at midnight. OrderCalcProfit excludes unknown execution costs.

## Notifications / chart

Only AUTOPILOT ON/OFF button on chart. Telegram and optional MT5 Push use confirmed broker deals, with direction, TF1/TF2, **TF1 detected CSA/CSAK/CSM**, lot, SL, TP and Elite target references. Exit notice exactly "TAKE PROFIT 😅" / "STOP LOSS 🥲". Supply Telegram Token and Chat ID in MT5 inputs, never in GitHub; add https://api.telegram.org to MT5 Allowed WebRequest list. WebRequest unavailable in Strategy Tester. Telegram outages can cause missed notifications.

## Installation and validation

Download MQ5 source, identical TXT mirror and default SET preset. Compile in MetaEditor, then attach to DEMO / Strategy Tester before any real trade. Test Every tick based on real ticks for NOZAX XAUUSDc 2024-2026 with spread, commission, swap, stop levels and slippage. Compare EL2 vs EL3 A, and test M15-M5 plus H1-M5 and H4-M15. Track BUY/SELL winrates separately (target each >=45%), monthly PnL (target every month net positive), maximum drawdown, profit factor and entry frequency. These are goals, NOT promises. Cross-check visual IB, CB1/CB2, retest zone and Elite anchors against the screenshot PDF.

NOT METAEDITOR-COMPILED OR REAL-TICK BACKTESTED by this GitHub delivery. Review as draft PR; do not use with real capital until independently compiled and validated.

## Backtest ALL 21 MT5 timeframes: v1.01 correction

- TF1 is the BBMA CSA/CSAK/CSM direction and must be larger than TF2 FMCBR. Both are selected in EA Inputs, independently of the Strategy Tester chart timeframe.
- Use Every tick based on real ticks for cross-timeframe tests. In Open prices only modeling, tester H1 cannot access lower EA timeframes M15/M5: an official MT5 limitation.
- For quick coarse Open prices only trials, use tester period TF2 and a compatible, multiple higher TF1; final PnL tests require real tick modeling.
- v1.01 proactively requests CopyRates on BOTH selected TFs and CopyBuffer on all indicator handles before checking BarsCalculated, to start on-demand indicator computation.
- Zero account Equity during visual tester initialization no longer causes an immediate EA initialization failure. Trading remains disabled until Equity is positive.
- Tester Journal messages: BACKTEST SETTINGS (chart TF, EA TF1/TF2), WAIT_HISTORY (bars and buffers), WAIT_EQUITY (zero equity), HISTORY_READY (series primed).
- The Waiting for Update screenshot and Balance/Equity zero cannot prove a specific root cause. Check Tester Journal, downloaded broker tick/minute data, and tester visual template.
- All 21 TFs are selectable, not guaranteed to have adequate history or valid trade signals. W1/MN1 need substantial pre-start history.
- Validation: draft source only; MetaEditor compile and real-tick XAUUSDc historical tests are not verified.

## Current version / files — v1.01

- CEBONK_BBMA_FMCBR_2TF_AUTOLOT_v1.01.mq5: current source to compile in MetaEditor.
- CEBONK_BBMA_FMCBR_2TF_AUTOLOT_v1.01.txt: byte-for-byte identical latest MQL5 source, for mobile transfer.
- CEBONK_BBMA_FMCBR_2TF_AUTOLOT_v1.01_DEFAULT.set: matching inputs preset.
- For D1/W1/MN1 TF2, a retest candle commonly closes outside 07:00–23:00 broker session. If InpDeferHighTFSession=true, a valid closed retest may be held up to InpHighTFWaitHours=24 until the next allowed session; CANCEL if BBMA direction/sideways changes, price crosses stop-side zone, or entry deviates by more than the zone width from retest close. This allows higher-timeframe setups to be tested without trading outside the requested session. It is NOT a guarantee of an entry or ideal price.
- IMPORTANT: The screenshot title 'xtc on XAUUSDc,H1' shows the tester Expert as 'xtc'. Ensure the selected Expert is actually the newly compiled v1.01 source, not an older EA named xtc.
