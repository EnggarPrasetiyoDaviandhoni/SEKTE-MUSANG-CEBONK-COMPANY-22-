#!/usr/bin/env python3
"""Static parity only, not proof of MQL5 compilation or trading profitability."""
from pathlib import Path
r=Path(__file__).resolve().parents[1]
repo=r.parents[2]
ea=(r/"CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.12.mq5").read_text(encoding="utf-8")
txt=(r/"dist/CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.12.txt").read_text(encoding="utf-8")
notification=(r/"LSNotifyEmoji.mqh").read_text(encoding="utf-8")
preset=(r/"LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.12.set").read_text(encoding="utf-8")
generator=(repo/"scripts/generate-astro-weekly.mjs").read_text(encoding="utf-8")
validation=(repo/"scripts/test-astro-weekly-feed.mjs").read_text(encoding="utf-8")
checks={
 "correct new version": '#property version "2.12"' in ea,
 "separate standalone EA": "CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.11.mq5" not in ea,
 "TXT parity exact": txt==ea.replace('#include "LSNotifyEmoji.mqh"',notification),
 "new sidecar only": "weekly_aspects.csv" in ea and "weekly_aspects.csv" in preset,
 "schema strict": 'model,aspects_at_core' in ea and 'StringSplit(line,44,p)!=8' in ea,
 "aspect passed to Telegram": '"🌙 ASPEK INTI: "+gWindows[wi].aspects' in ea,
 "aspects at core, not synthesized at entry": "w.aspects=p[7];" in ea and "core.analyse(engine.get(coreMs-300000)" in generator,
 "phase and orb included": "a.orb.toFixed(2)" in generator and "a.name" in generator and "MENDEKAT" in generator and "MENJAUH" in generator,
 "signed dominant impact": "dir==='BUY'?a.impact>0:a.impact<0" in generator,
 "not inventing Moon": "Moon Sextile Jupiter" not in generator and "TIDAK ADA ASPEK SEARAH PADA INTI" in generator,
 "legacy weekly.csv unchanged": "writeFileSync(resolve(DIR,'weekly.csv'),csv" in generator,
 "aspects publisher": "writeFileSync(resolve(DIR,'weekly_aspects.csv'),aspectsCSV" in generator,
 "test parity in JS": "assert.deepEqual(detail.slice(0,7),fields)" in validation,
 "no Telegram duplicate": ea.count('LSNotice("ENTRY_FILLED"')==1,
 "RR/ATR/Friday unchanged": all(t in ea for t in ["InpSL_ATR=3.0","InpRR=4.0","InpMaxSpreadPoints=70","LSCloseFriday();"]),
 "web + tester fallback": "LSReadWebWeek()" in ea and "if(gTester)return LSReadWeek();" in ea,
 "real account lock": "InpAllowRealAccount=false" in ea,
}
for k,v in checks.items():
 assert v,k
 print("PASS",k)
print("TOTAL",len(checks))
