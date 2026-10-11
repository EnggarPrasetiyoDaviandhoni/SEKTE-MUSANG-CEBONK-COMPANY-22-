#!/usr/bin/env python3
"""Static regression guards; NOT a substitute for MetaEditor compilation or MT5 backtest."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
repo = root.parents[1]
ea = (root / "CEBONK_LS_ASTRO_WEEKLY_v1.00.mq5").read_text(encoding="utf-8")
weekly = (repo / "assets/astro-weekly-core.js").read_text(encoding="utf-8")
ui = (repo / "assets/astro-weekly-ui.js").read_text(encoding="utf-8")
preset = (root / "CEBONK_LS_ASTRO_WEEKLY_v1.00.set").read_text(encoding="utf-8")

checks = {
    "separate standalone EA": '#property version "1.00"' in ea and '#include <Trade/Trade.mqh>' in ea,
    "M5 closed candle": "CopyRates(InpSymbol,PERIOD_M5,1,InpSweepLookback+1,bars)" in ea,
    "simple single-frame sweep": all(x in ea for x in ["signal.low<low&&signal.close>low", "signal.high>high&&signal.close<high"]),
    "weekly model direction strict": "LSActiveWindow(nowUtc)" in ea and "if(dir!=w.direction)return;" in ea,
    "window gates current and signal close": "eventUtc<w.start||eventUtc>=w.end" in ea,
    "ATR3": "InpSL_ATR=3.0" in ea and "iATR(InpSymbol,PERIOD_M5,InpATRPeriod)" in ea,
    "RR4": "InpRR=4.0" in ea and "risk*InpRR" in ea,
    "Friday broker schedule": "SymbolInfoSessionTrade(InpSymbol,FRIDAY" in ea,
    "Friday close when autopilot off": "LSFridayClose(); // Always active" in ea and "gAuto?" not in ea.split("void LSFridayClose(){")[1].split("bool LSCanOpen")[0],
    "only own magic closed": "(ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic" in ea and "PositionClose(ticket" in ea,
    "anti-reentry": "GlobalVariableCheck(key)" in ea,
    "real account lock": "REAL_ACCOUNT_LOCKED" in ea and "InpAllowRealAccount=false" in ea,
    "spread max 70": "InpMaxSpreadPoints=70" in ea and "(tick.ask-tick.bid)/point>InpMaxSpreadPoints" in ea,
    "CSV rejects wrong model": "v[7]!=LS_WEEK_MODEL" in ea and "gCSVValid=false;" in ea,
    "CSV reload and fail-closed": "LSLoadWeekly();  // Every reload fails closed" in ea,
    "weekly CSV frontend exporter": "function toEACsv(report,date)" in weekly and "CEBONK_ASTRO_WEEKLY_V1" in weekly,
    "browser download control": "Unduh CSV EA MT5" in ui and "Week.toEACsv(activeResult" in ui,
    "no other technical directional filter": "InpUseTF1StructureTrend" not in ea and "BWAstroNormalGate" not in ea,
    "no BE/trailing/partial": all(x not in ea for x in ["PositionModify(", "TrailingStop", "BreakEven", "PartialClose"]),
    "preset": "InpFridayAutoClose=true" in preset and "InpSL_ATR=3.0" in preset and "InpRR=4.0" in preset,
    "small standalone source": len(ea.encode("utf-8")) < 22000,
}
for name, value in checks.items():
    assert value, name
    print("PASS", name)
print("TOTAL PASS", len(checks))
