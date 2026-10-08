# CEBONK BBMA 2TF v1.00

Requested engine: TF1 CSA OR CSAK OR CSM; TF2 strictly CSAK in the same direction.
Default M15 -> M5. Choose both timeframes in inputs; TF1 must be higher.
Closed candles only. Evaluate on each new TF2 closed candle. TF1 uses its latest closed candle; no historical signal scan.

## Exact implemented definitions
BB20 deviation2 shift0 close; MA5/10 LWMA High/Low.
BUY CSA: bullish candle closes above both MA High, at/below MidBB.
BUY CSAK: bullish candle closes above both MA High and MidBB, at/below TopBB.
BUY CSM: bullish candle closes above TopBB.
SELL mirrors these rules using MA Low, MidBB and LowBB.
TF2 CSM does not qualify as CSAK in this implementation.
These are explicit operational definitions, not a claim that all discretionary BBMA variants use identical boundaries.

## Execution
Market entry after TF2 closes, latest TF1 direction must agree.
BUY SL=closed TF2 LowBB; SELL SL=closed TF2 TopBB.
Optional SLBufferPoints default0. Planned TP=2x entry-to-SL, tick rounding outward.
Execution slippage can change the realised RR. SL/TP are not moved after entry.
No BE, trailing or partial-close logic. Broker partial fills may still occur.
FixedLot default0.01, validated against broker min/max/step without increasing it.
Default entry hours07:00-24:00 on broker clock (TimeCurrent); no GMT inference.
Spread guard70 points, not pips. Symbol follows the attached chart (e.g. XAUUSDc).
Hedging account required; netting merges positions and cannot preserve independent stops.
Each qualifying TF2 candle may open an entry, including while previous positions exist.
No guaranteed daily entry or profit.

## Duplicate policy and diagnostics
Atomic terminal global claim by account/symbol/magic/TF pair, flushed before sending.
A claimed signal is never retried, including order failures, to avoid uncertain duplicate execution.
History comments provide a second duplicate check. Use distinct Magic for separate strategies.
Do not run multiple terminals on the same account with identical Magic: global claims are terminal-local.
At attach/restart, wait for next TF2 candle close. AUTOPILOT button only; no dashboard or plotted indicators.
Journal includes skip reason and broker retcode. No Telegram or push module was requested for this version.

## Install
Copy .mq5 into MQL5/Experts, compile in MetaEditor, attach to chart.
.txt contains identical source; rename to .mq5 before compiling.
Check Algo Trading and account type. Test on demo/Strategy Tester first.

## Validation completed
Native C++ execution of the exact Signal function: mirrored BUY/SELL CSA/CSAK/CSM,
TF2 exclusion of CSM/CSA, wrong-body direction, strict MA boundary, doji.
Manual source review of BB buffers0/1/2, closed-bar reads, order retcodes and stop distances.
MetaEditor compile and MT5 broker-tick backtest were NOT performed; compiler/MT5 unavailable.
No win-rate, profit factor or monthly profitability claim.
