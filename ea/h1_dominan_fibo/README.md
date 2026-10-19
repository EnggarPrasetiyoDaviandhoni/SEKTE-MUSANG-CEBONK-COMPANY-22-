# CEBONK H1 DOMINAN + KEJEPIT + FIBO (v1.00)

**Status: EA source draft for MetaEditor compilation and Strategy Tester; performance NOT verified.**

## Entry sequence reconstructed from both H1 screenshots

1. A dominant H1 candle closes beyond the high/low of the previous 2–3 bars with a large body: body/range >= 0.60 and body >= 0.40 x ATR(14).
2. Within a user-settable lookback of 8 H1 bars, a small/opposite-colored compressed candle appears (SELL requires a bullish squeezed candle; BUY a bearish one). Range of the prior 2 bars <= 1.20 x ATR(14).
3. A confirmation H1 candle CLOSES beyond the highs/lows of the previous 3 H1 bars in the intended direction. Trade at market on the first tick of the next H1 candle, within the WIB session and 10-minute grace.
4. Direct dominant-break entry is OFF by default, because the annotated screenshots show waiting for the squeezed candle's break. Turn on InpDominanBreakON only to test direct dominant break as an alternative.
5. One position per symbol (including manual positions); no duplicate order on one H1 bar.

## Fibonacci levels

SELL: Fibo 0 at highest high of setup (trigger + three previous H1 bars); Fibo 100 at low of bearish trigger. SL -0.236 = high + 0.236*(high-low). TP 1.618 = low - 0.618*(high-low).

BUY: symmetric mirrored anchors/formulas.

- Default InpTPMode=TP_FIBO_1618 exactly models Fibonacci SL/TP ratios from the screenshot. It does NOT guarantee fixed RR 1:2.
- InpTPMode=TP_FIXED_RR keeps Fibo SL but sets TP = 2x initial stop distance (InpFixedRR is editable). The Fibo 1.618 is shown for reference in trade notification.
- If entry is already beyond TP or violates minimum stop distance, skip trade; do NOT silently move anchors.

## Time in WIB, NOZAX example

WIB UTC+7. Server GMT+3 => 18:00 WIB == 14:00 broker time. Live auto broker offset may be enabled; Strategy Tester always uses explicit InpBrokerUTCOffsetHours=3 (because simulated TimeGMT can equal server time).

- InpStartHourWIB=18, InpEndHourWIB=19: only a signal on an H1 candle closing at 18:00 WIB is eligible, within 10 minutes of the new H1 opening.
- To trade 18:00–00:00 WIB instead, change InpEndHourWIB=0.
- No valid completed signal means no trade. There is no forced daily entry.

## Risk, UI, notifications

Attach to XAUUSDc H1. Symbol defaults to the chart symbol. Fixed lot 0.01 or optional percent-risk sizing. Maximum spread 70 broker points. No breakeven, trailing or partial exits. Stop levels, spread, trade permission, price direction and volume checked. Execution result retcode checked.

Minimal chart: AUTOPILOT ON/OFF button only. The button state persists across restarts in live trading; Strategy Tester starts from input defaults. On success, one execution message is constructed. MT5 Push/Telegram optional (OFF by default). For Telegram, add https://api.telegram.org to MT5 Tools > Options > Expert Advisors > Allow WebRequest. Do not commit bot tokens into a public repository. WebRequest doesn't work in the Strategy Tester.

## Before using a real account

Compile with MetaEditor (compiler unavailable here). Strategy Tester: XAUUSDc / H1 / real tick model / 2024–2026 if history is available / broker spreads & costs. Audit the H1 dominant -> squeezed -> closed break sequence visually. Verify live/server/Tester time conversion. Assess BUY/SELL win rate separately, monthly net PnL, drawdown, actual RR and order reject logs. There is no verified result, win-rate promise or guarantee of profit.

Files: MQ5 for MetaEditor, TXT is identical full source for mobile download.
