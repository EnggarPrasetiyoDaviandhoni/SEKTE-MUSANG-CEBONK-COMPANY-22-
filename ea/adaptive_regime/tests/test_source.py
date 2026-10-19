from pathlib import Path

root=Path(__file__).resolve().parents[1]
main=(root/"src/CEBONK_ADAPTIVE_REGIME.mq5").read_text()
preset=(root/"ADAPTIVE_REGIME_SAFE.set").read_text()
readme=(root/"README.md").read_text()

def ok(name, cond):
    if not cond:
        raise AssertionError(name)
    print("OK", name)

ok("version", '#property version "1.00"' in main)
ok("safe default autopilot", "InpAutopilot=false" in main)
ok("real locked default", "InpAllowRealAccount=false" in main and "REAL_ACCOUNT_LOCKED" in main)
ok("fixed lot 0.01", "InpFixedLot=0.01" in main)
ok("max lot cap", "InpMaxLot=0.05" in main and "MathMin(SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MAX),InpMaxLot)" in main)
ok("risk percent", "InpRiskPercent=0.25" in main)
ok("RR 1:2", "InpRR=2.0" in main)
ok("spread 70", "InpMaxSpreadPoints=70" in main)
ok("daily kill switch", "DAILY_LOSS_KILL_SWITCH" in main and "InpDailyLossLimitPct=2.0" in main)
ok("loss streak cooldown", "LOSS_STREAK_COOLDOWN" in main and "InpMaxConsecutiveLosses=2" in main)
ok("single position guard", "SYMBOL_ALREADY_HAS_POSITION_OR_ORDER" in main)
ok("package selector", "enum AR_PACKAGE" in main and "InpPackage=AR_H1_M15_M5" in main)
ok("trend routing", "AR_TREND" in main and "TrendSignal" in main)
ok("liquidity routing", "SweepSignal" in main and "TF2 SWEEP+DISPLACEMENT+BREAK" in main)
ok("IB CB1 retest", "TF3 IB -> CB1 BREAK -> FIRST RETEST" in main)
ok("closed candles", "CopyRates(InpSymbol,tf,1,InpHistoryBars,r)" in main)
ok("ATR SL guard", "InpMinSL_ATR=0.80" in main and "InpMaxSL_ATR=3.00" in main and "SL_TOO_WIDE_ATR" in main)
ok("one entry notification", main.count("NotifyEntry(") == 2 and "ONE ENTRY = ONE NOTIFICATION" in main)
ok("no martingale recovery trailing partial", all(x not in main for x in ["Martingale","RecoveryLot","PositionClosePartial","TrailingStop","BreakEven"]))
ok("telegram secret empty", 'InpTelegramToken=""' in main and 'InpTelegramChatID=""' in main)
ok("preset exists", (root/"ADAPTIVE_REGIME_SAFE.set").exists())
ok("no profit promise", "ora njanjeni profit" in readme)
print("ALL SOURCE POLICY TESTS PASSED")
