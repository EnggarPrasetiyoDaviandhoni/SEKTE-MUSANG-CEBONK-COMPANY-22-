#!/usr/bin/env python3
"""Static audit only. Not MetaEditor compilation or live broker execution."""
from pathlib import Path
r=Path(__file__).resolve().parents[1]
repo=r.parents[1]
ea=(r/"CEBONK_ASTROLOGY_NEWS_v1.00.mq5").read_text(encoding="utf8")
notify=(r/"NewsNotify.mqh").read_text(encoding="utf8")
txt=(r/"dist/CEBONK_ASTROLOGY_NEWS_v1.00.txt").read_text(encoding="utf8")
preset=(r/"ASTROLOGY_NEWS_DEFAULT.set").read_text(encoding="utf8")
script=(repo/"scripts/generate-astro-news.mjs").read_text(encoding="utf8")
checks={
 "standalone file source":'#property version "1.00"' in ea,
 "same website news engine":"News.calculate(core,Astronomy,params,events)" in script,
 "same website astrology model":"coreFromSite()" in script and "core.analyse(" in script,
 "website news original policy":all(x in script for x in ["pre:30","post:120","blockBefore:5","blockAfter:5","entrySpan:10","minWindow:15","otherRisk:true"]),
 "no technical direction rule":all(x not in ea for x in ["LSSweepDirection","BWScanDirection","iMA(","iRSI("]),
 "feed model and schema":"CEBONK_ASTRO_NEWS_V1" in ea and "StringSplit(line,44,p)!=11" in ea,
 "WebRequest live / CSV tester":'WebRequest("GET",InpNewsURL' in ea and "if(gTester)return ANReadLocal();" in ea,
 "fail closed on missing feed":"gFeedOK=false;ArrayResize(gWindows,0);" in ea,
 "verified live USD HIGH calendar":"InpRequireHighUSDCalendar=true" in ea and 'event.importance==CALENDAR_IMPORTANCE_HIGH' in ea,
 "one trade per event":"GlobalVariableCheck(key)" in ea and 'gScope+"EV."+w.id' in ea,
 "spread ATR RR":all(x in ea for x in ["InpMaxSpreadPoints=70","InpSL_ATR=3.0","InpRR=4.0","InpFixedLot=0.01"]),
 "fixed lot and live lock":'InpAllowRealAccount=false' in ea and "InpAutopilot=false" in ea,
 "friday closes own magic":'ANFridayClose();' in ea and "(ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic" in ea,
 "one entry notification":ea.count('LSNotice("ENTRY_FILLED"')==1,
 "telegram emoji":all(x in ea for x in ["📰 ","🔮 Entry Awal ","🌙 Aspek INTI","🎯 ENTRY","🛑 SL","💰 TP"]),
 "TXT source parity":txt==ea.replace('#include "NewsNotify.mqh"',notify),
 "no trailing":all(x not in ea for x in ["PositionModify(","BreakEven","TrailingStop"]),
 "preset safe":"InpAutopilot=false" in preset and "InpRequireHighUSDCalendar=true" in preset
}
for name,good in checks.items():
 assert good,name
 print("PASS",name)
print("TOTAL",len(checks))
