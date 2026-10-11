#!/usr/bin/env python3
"""Static invariants only, not MetaEditor compilation or real MT5 execution."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
ea=(root/'CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.10.mq5').read_text('utf8')
dist=(root/'dist/CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.10.txt').read_text('utf8')
notify=(root/'LSNotify.mqh').read_text('utf8')
setfile=(root/'LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.10.set').read_text('utf8')
repo=root.parents[2]
generator=(repo/'scripts/generate-astro-weekly.mjs').read_text('utf8')
workflow=(repo/'.github/workflows/astro-weekly-publish.yml').read_text('utf8')
checks={
 'new standalone version': '#property version "2.10"' in ea,
 'TXT complete/notifier included': dist==ea.replace('#include "LSNotify.mqh"',notify),
 'default auto web': 'InpAutoAstroWeb=true' in ea and 'InpAutoAstroWeb=true' in setfile,
 'live host correct': 'https://raw.githubusercontent.com/' in ea,
 'WebRequest via GET': 'WebRequest("GET",InpAstroWebURL' in ea,
 'two sources same parser': 'LSParseWeek(payload)' in ea and 'LSParseWeek(CharArrayToString(response' in ea,
 'tester never WebRequest': 'if(gTester)return LSReadWeek();' in ea and 'if(gTester||!InpAutoAstroWeb)return LSReadWeek();' in ea,
 'refresh 5min': 'InpWebPollSeconds=300' in ea,
 'fail closed on web errors': 'gWeekOK=false;ArrayResize(gWindows,0);' in ea and 'ASTRO_WEB_HTTP_' in ea,
 'week range valid': 'w.monday!=LSISODate(w.from-(dow-1)*86400)' in ea,
 'Astro direction filter': 'dir!=gWindows[wi].dir' in ea,
 'friday independent from web': ea.index('LSCloseFriday();')<ea.index('LSRefreshWeek();',ea.index('void OnTimer(){')),
 'ATR3 RR4 spread 70': all(x in ea for x in ['InpSL_ATR=3.0','InpRR=4.0','InpMaxSpreadPoints=70']),
 'live account locked': 'InpAllowRealAccount=false' in ea,
 'Web core reused SSOT': "html.indexOf('/* CEBONK ASTROLOGY')" in generator and 'WEEK.scanWeek(' in generator and "core.scan(engine,date,360,true" in generator,
 'weekly neutral fail closed': "rows=[HEADER]" in generator and "status:windows.length?'READY':'NO_TRADE'" in generator,
 'scheduled retry & write': "schedule:" in workflow and 'git push origin HEAD:main' in workflow,
}
for name,condition in checks.items():
 assert condition,name
 print('PASS',name)
print('TOTAL',len(checks))
