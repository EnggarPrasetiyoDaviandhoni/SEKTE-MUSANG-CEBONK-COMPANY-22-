# CEBONK BBMA + FMCBR + Fibo Musang Elite (v1.00 experimental)

Independent MT5 Expert Advisor. Does not modify or replace prior BBMA EA, Combined 1/2, or the GitHub Pages website. Source: CEBONK_BBMA_FMCBR_ELITE_v1.00.mq5; identical plain-text mirror: .txt.

## Engine and sequence

TF1 BBMA Re-entry -> TF2 CSAK / Momentum in TF1 direction -> TF3 Initial Break -> CB1 close break -> zone retest -> trade. The EA only reads closed candles for setup decisions.

- BB20, deviation 2.0, shift 0; LWMA5/10 High/Low.
- TF1 Re-entry BUY: wick contacts MA5/10 Low, close holds above MA5/10 Low and MidBB confirms bullish. SELL mirrored with High.
- TF2 CSAK: directional candle breaks MA5/10 plus MidBB, or Momentum candle closes outside Bollinger Band, after TF1 Re-entry. At least 50% body/range.
- TF3 **IB means Initial Break, not Inside Bar**. IB candle has >=0.50 body/range and closes beyond previous candle high (BUY) / low (SELL). The nearest base extreme in previous 8 TF3 bars defines a *frozen zone* from extreme wick to base candle body. This mechanical definition is an **EA approximation** to the visual screenshot; not a verbatim formula from the Musang material.
- CB1: most recent confirmed countertrend pivot before IB (pivot uses only closed neighbors). CB2: next older, farther countertrend pivot.
- EL2 (default): IB -> close beyond CB1 -> later zone retest/rejection.
- EL3 A: IB -> close beyond CB1 -> close beyond CB2 -> later zone retest.
- EL3 B: IB -> close beyond CB1 -> first retest -> close beyond CB2 -> second retest.
- Retest BUY: candle range touches zone, closes above zone high and bullish; SELL mirrored. Retest must be a later CLOSED candle than the last break.
- Setup expires after 24 TF3 closed bars, invalidates on close through far side of base, or when TF1/TF2 context expires or changes.

## Fibo Musang Elite

Levels stored exactly: 0, 0.12, 0.236, 0.382, 0.5, 0.786, 0.88, 1.272, 1.314, 1.618, 1.786, 1.88, 2.618, 2.786, 2.880, 4.23, 4.786, 4.88.

**v1.00 algorithmic CB1 anchor**: base zone extreme at IB plus **BODY CLOSE** of CB1 breakout candle; lock anchor when CB1 closes. Projection = base + (breakout close - base) * Elite level; mirrored for SELL. Screenshot-derived Dominant Break and CB1/SNR Break need further formalized rules. This version implements **CB1 break anchor**, not full Dominant Break classifier. TP1 Elite 1.618, TP2 Elite 2.618, Complete Cycle 4.23 are informational **only** and are included in notifications. Fibo is NOT the risk/reward ratio.

## SL, TP, execution

- BUY SL = IB zone lower wick - 0.20 * ATR14(TF3). SELL SL = IB zone upper wick + 0.20 * ATR14(TF3).
- Broker TP = fixed **RR 1:2** from quoted entry to structural SL (ratio adjustable, default 2.0). Real RR can differ after slippage/commissions.
- No BE, trailing, partial close, recovery, or forced layering.
- Maximum spread 70 points. Reject when spread >20% of risk distance.
- Check tick size, volume step, margin, broker stops/freeze levels, trading permissions and fill mode before submitting.
- Entry time **07:00 inclusive to 23:00 exclusive**, MT5 server time, Mon–Fri. Server should have desired broker GMT+3 offset; EA never hardcodes an offset.
- One order attempt per IB event. MT5 terminal global-variable CAS protects duplicate instances sharing same account/symbol/magic/TF/mode. No global one-position restriction.
- Chart UI: AUTOPILOT ON/OFF button only.

## Packages and modes

| InpPackage | TF1 / TF2 / TF3 |
|---|---|
| 0 (default) | H1 / M15 / M5 |
| 1 | M15 / M5 / M1 |
| 2 | H4 / H1 / M15 |
| 3 | M30 / M5 / M1 |
| 4 | D1 / H4 / H1 |
| 5 | W1 / D1 / H4 |
| 6 | MN1 / W1 / D1 |

InpEntryMode=0 EL2; =1 EL3 A; =2 EL3 B. Evaluate separately. Package selection is independent of chart timeframe.

## Telegram / Push

Do not commit bot credentials. Fill InpTelegramToken, InpTelegramChatID in MT5 and whitelist https://api.telegram.org under Tools > Options > Expert Advisors > Allow WebRequest. No WebRequest in Strategy Tester. Entry notice includes BUY/SELL, symbol, TF package, entry, SL, broker TP, Elite 1.618/2.618/4.23. On actual deals: TAKE PROFIT 😅 / STOP LOSS 🥲. Position identifier/type used to prevent duplicate alerts. Set InpPushEnabled=true for MT5 push.

## Backtest and limitations

**Not compiled or backtested by this delivery.** Source inspection is not MetaEditor compiler evidence. Do not enable with real funds until tests pass.

1. Compile in MetaEditor with zero errors; inspect warnings.
2. Test **Every tick based on real ticks**, XAUUSDc, 2024–2026 as data permit, including commission, floating spread and real stop levels. Record BUY/SELL win rates independently, PF, DD, monthly net profit and number of entries. >=45% winrate per direction and positive each month are **user targets, not guarantees**.
3. Compare visual trades with screenshot references for IB zone, CB1/CB2, breakout, retest and Elite anchors. Review false positives / missed trades.
4. Exercise absent history, terminal restart, weekend jumps, high spread, unavailable margin, broker stop rejects, filling modes, hedging/netting, multi-chart duplicates, connection failures, Telegram errors and partial fills.
5. EL3 A/B may trade far less often than EL2. Never force a daily trade by relaxing conditions.
6. These screenshots have discretionary IB/dominant/zone rules. This is a bounded *testable implementation*, not a claim that all original FMCBR nuances were reconstructed exactly.

Source lives in its own experimental directory; old files untouched. Review draft pull request before merging.