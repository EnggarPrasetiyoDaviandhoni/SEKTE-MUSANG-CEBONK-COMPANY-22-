#!/usr/bin/env python3
"""Static source invariants only. Does not substitute for MetaEditor compile/backtest."""
from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
main=(root/"CEBONK_LIQUIDITY_SWEEP_WEEKLY_ATR_v2.00.mq5").read_text(encoding="utf-8")
notify=(root/"LSNotify.mqh").read_text(encoding="utf-8")
dist=(root/"dist/CEBONK_LIQUIDITY_SWEEP_WEEKLY_ATR_v2.00.txt").read_text(encoding="utf-8")
site=(root.parents[2]/"assets/astro-weekly-ui.js").read_text(encoding="utf-8")
preset=(root/"LIQUIDITY_SWEEP_WEEKLY_ATR_v2.00.set").read_text(encoding="utf-8")
def check(name,ok):
 assert ok, name
 print("PASS",name)
check("standalone modular and exact dist",dist==main.replace('#include "LSNotify.mqh"',notify))
check("ATR defaults",all(s in main and s in preset for s in
 ["InpATRPeriod=14","InpSL_ATR=3.0","InpRR=4.0","InpMaxSpreadPoints=70"]))
check("M5 sweep and close back",all(s in main for s in
 ["PERIOD_M5","r[0].low<=low-pierce&&r[0].close>low","r[0].high>=high+pierce&&r[0].close<high"]))
check("weekly 5 day CSV export",all(s in site for s in
 ["Ekspor EA CSV","CEBONK_ASTRO_WEEKLY.csv","ASTRO_WEEKLY_V1","activeResult.candidates"]))
check("weekly csv gate strict",all(s in main for s in
 ['w.core<w.from','w.core>=w.to','dow<1||dow>5','LSISODate(w.from)!=w.date',
  'w.monday!=LSISODate(w.from-(dow-1)*86400)','LSWindowAt(utc)',
  'SWEEP_OPPOSITE_ASTRO_DIRECTION','SWEEP_EVENT_OUTSIDE_ASTRO_WINDOW']))
check("ATR stop and 4R actual entry",all(s in main for s in
 ["double entry=dir>0?q.ask:q.bid,risk=InpSL_ATR*atr;",
  'double actualRisk=MathAbs(entry-sl);','actualRisk*InpRR']))
check("Friday close even with autopilot off",main.index("LSCloseFriday();")<main.index("LSEvaluate();") and
 'if(!LSFridayCutoff()||!LSTradeAllowed())return;' in main and
 'req.position=ticket;' in main and 'POSITION_MAGIC)!=InpMagic' in main)
check("Friday broker sessions then fallback",all(s in main for s in
 ['SymbolInfoSessionTrade(InpSymbol,FRIDAY','InpFridayBufferMinutes=5',
 'InpFallbackFridayCloseHour=23','InpFallbackFridayCloseMinute=55']))
check("trade only with bot permission + Magic",all(s in main for s in
 ['InpAutopilot=false','InpAllowRealAccount=false','req.magic=InpMagic','MAX_OWN_POSITIONS',
  'LSNettingAccount()&&LSForeignPosition()']))
check("no BE, trailing or martingale",not re.search(r'(PositionModify|TrailingStop|BreakEven|MartingaleLot)',main))
check("notifications",all(s in main for s in ["DEAL_REASON_TP","DEAL_REASON_SL","ENTRY_FILLED"]) and
 'api.telegram.org' in notify)
check("tester global state isolation",all(s in main for s in
 ['if(!gTester)GlobalVariableSet','if(!gTester&&GlobalVariableCheck']))
print("PASS static checks (not a compiler)")
