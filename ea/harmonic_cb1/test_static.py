"""Static source-policy and arithmetic smoke checks; not a MetaEditor compile or backtest."""
from pathlib import Path

root = Path(__file__).parent
ea = (root / "CEBONK_HARMONIC_CB1_H1_M5_v1.00.mq5").read_text(encoding="utf-8")
txt = (root / "CEBONK_HARMONIC_CB1_H1_M5_v1.00.txt").read_text(encoding="utf-8")
assert ea == txt, "EA and TXT have diverged"
for token in [
    "FOLLOW_AND_REVERSAL", "FOLLOW_ONLY", "REVERSAL_ONLY",
    "PERIOD_H1", "PERIOD_M5", "EnableABCD", "EnableGartley", "EnableBat",
    "EnableButterfly", "BreakCB1(", "FindHarmonic(", "DEAL_ENTRY_IN",
    "GlobalVariableSetOnCondition", "OrderCalcProfit",
    "MaxSpreadPoints=70", "StartAutopilot=false", "AllowRealAccount=false",
    "MaxRiskPercent=1.0", "DailyEquityStopPercent=5.0",
    "trade.PositionModify(", "HistoryOrderGetString", "OnTradeTransaction"
]:
    assert token in ea, f"required invariant missing: {token}"
assert "PERIOD_M15" not in ea
assert ea.count("{") == ea.count("}")

def ratios(X, A, B, C, D):
    xa, ab, bc, cd = abs(A-X), abs(A-B), abs(B-C), abs(C-D)
    return (ab/xa, bc/ab, abs(A-D)/xa, cd/bc, cd/ab)

g = ratios(0, 100, 38.2, 78, 21.4)
assert abs(g[0]-.618)<.06 and abs(g[2]-.786)<.06 and 1.152 <= g[3] <= 1.738
b = ratios(0, 100, 55, 85, 11.4)
assert .322 <= b[0] <= .56 and abs(b[2]-.886)<.06 and 1.498 <= b[3] <= 2.738
f = ratios(0, 100, 21.4, 70, -27.2)
assert abs(f[0]-.786)<.06 and 1.212 <= f[2] <= 1.678
a = ratios(0, 100, 60, 80, 40)
assert .90 <= a[4] <= 1.10
assert (100 + 2*(100-95) == 110 and 100 + 2*(100-105) == 90)
print("PASS static contract, four Fibonacci archetypes, RR 1:2 math.")
print("MetaEditor compile and MT5 tick backtest still required.")
