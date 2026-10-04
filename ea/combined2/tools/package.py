#!/usr/bin/env python3
from pathlib import Path
import csv, hashlib, json, zipfile
ROOT=Path(__file__).resolve().parents[1]
dist=ROOT/'dist';dist.mkdir(exist_ok=True)
core=(ROOT/'src/C2Core.mqh').read_text()
ea=(ROOT/'src/CEBONK_COMBINED2.mq5').read_text()
assert ea.count('#include "C2Core.mqh"')==1
flat=ea.replace('#include "C2Core.mqh"',core)
name='CEBONK_COMBINED2_M5_v1.00'
for ext in ['mq5','txt']:(dist/f'{name}.{ext}').write_text(flat)
coverage=json.loads((ROOT/'data/coverage.json').read_text())
rows=list(csv.DictReader((ROOT/'data/CEBONK_C2_ASTRO.csv').open()))
assert len(rows)==coverage['windows'] and coverage['days']>0
last=0
for row in rows:
 start,end=int(row['start_epoch']),int(row['end_epoch'])
 assert start>=last and end>start and start%300==end%300==0 and end-start<=86400
 assert row['direction'] in ['BUY','SELL','NEUTRAL','TRANSITION']
 assert row['model']=='CEBONK_C2_WEB_V1_35ce78b4'
 last=end
assert (dist/f'{name}.mq5').read_bytes()==(dist/f'{name}.txt').read_bytes()
assert flat.count('OrderSend(')==1
(dist/'BACKTEST_M5.set').write_text('InpSymbol=XAUUSDc\nInpMagic=220202\nInpExecutionTF=5\nInpAutopilot=true\nInpAllowRealAccount=false\nInpAcceptExperimentalAstro=true\nInpFixedLot=0.01\nInpMaxSpreadPoints=70\nInpTarget=1\nInpAstroSource=1\nInpAstroCSV=CEBONK_C2_ASTRO.csv\nInpServerUTCMinutes=180\nInpTelegram=false\nInpMT5Push=false\n')
(dist/'PANDUAN_CEBONK_COMBINED2_M5.txt').write_text((ROOT/'README.md').read_text())
validation={'source':'Combined 2 v3.1.0 at 35ce78b4','native_core_differential_tests':'PASSED (see VALIDATION.log)','csv_schema_validation':'PASSED','metaeditor_compile':'NOT_RUN_COMPILER_UNAVAILABLE','mt5_backtest':'NOT_RUN','live_broker_execution':'NOT_RUN','profitability':'NOT_ESTABLISHED','combined1_changed':False,'default_execution':'M5','default_autopilot':False,'astro_coverage':coverage}
(dist/'VALIDATION.json').write_text(json.dumps(validation,indent=2)+'\n')
files=[p for p in ROOT.rglob('*') if p.is_file() and not any(x in p.parts for x in ['node_modules','.git']) and p.suffix!='.zip' and p.name!='SHA256SUMS.txt']
manifest='\n'.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(ROOT)) for p in sorted(files))+'\n'
(dist/'SHA256SUMS.txt').write_text(manifest)
with zipfile.ZipFile(dist/f'{name}_PAKET.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in files+[dist/'SHA256SUMS.txt']:z.write(p,'CEBONK_COMBINED2/'+str(p.relative_to(ROOT)))
print('PACKAGE_OK',len(flat.encode()),'bytes standalone MQ5;',len(rows),'astrology windows;',coverage['fromWIB'],'through',coverage['toWIB'])
