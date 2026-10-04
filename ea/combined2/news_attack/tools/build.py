#!/usr/bin/env python3
"""Build a new standalone EA from pinned v1.00 without modifying it or the web."""
from pathlib import Path
import hashlib, json, argparse, zipfile
HERE=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--base',type=Path,default=HERE.parent);args=ap.parse_args();BASE=args.base
pins={'src/CEBONK_COMBINED2.mq5':'7778b81ba7851387b9e2db8792498237e9f7d3358eb1ab6d2d11f5e423376220','src/C2Core.mqh':'f991cab01f0a276ce27ccb3aa4611c50492f4b0656b61e5e70d4fcae6876509e'}
for name,digest in pins.items():
 assert hashlib.sha256((BASE/name).read_bytes()).hexdigest()==digest, 'Base changed; review rather than overwrite: '+name
read=lambda name:(HERE/'src'/name).read_text(encoding='utf8')
s=(BASE/'src/CEBONK_COMBINED2.mq5').read_text()
def once(old,new):
 global s
 assert s.count(old)==1,(old[:100],s.count(old));s=s.replace(old,new)
def block(start,end,text):
 global s
 a=s.index(start);b=s.index(end,a);s=s[:a]+text+'\n'+s[b:]
once('#property version "1.00"','#property version "1.10"')
once('// CEBONK COMPANY 22 | COMBINED 2 | v1.00','// CEBONK COMPANY 22 | COMBINED 2 + NEWS ATTACK | v1.10')
once('#property tester_file "CEBONK_C2_ASTRO.csv"','#property tester_file "CEBONK_C2_ASTRO.csv"\n#property tester_file "CEBONK_C2_NEWS.csv"')
once('#include "C2Core.mqh"',(BASE/'src/C2Core.mqh').read_text()+'\n'+read('C2NewsPolicy.mqh'))
once('struct C2Message { string event,text;','struct C2Message { string event,text,push;')
once('double gSentSL=0,gSentTP=0;','double gSentSL=0,gSentTP=0;\n'+read('C2News.mqh'))
block('void Notice(const string event,','bool DigitsOnly(',read('C2Telegram.mqh'))
block('string SignalKey(','void Paint()',read('C2Execution.mqh'))
block('void OnTradeTransaction(','void OnDeinit(',read('C2TradeEvents.mqh'))
once(' gTester=(bool)MQLInfoInteger(MQL_TESTER);gAuto=InpAutopilot;',
 ' gTester=(bool)MQLInfoInteger(MQL_TESTER);gAuto=InpAutopilot;\n if(!ValidateNewsInputs())return INIT_PARAMETERS_INCORRECT;')
once(' gBar=(long)iTime(InpSymbol,InpExecutionTF,0);gArmedAt=(long)TimeCurrent();',
 ' gBar=(long)iTime(InpSymbol,InpExecutionTF,0);gNewsBar=(long)iTime(InpSymbol,PERIOD_M1,0);gArmedAt=(long)TimeCurrent();\n if(NewsEnabled()&&(gTester||InpNewsSource==C2_NEWS_LOCAL_CSV))if(!NewsCSV())return INIT_FAILED;')
once(' EvaluateBar();Paint();',' if(gTester)NewsHeartbeat();EvaluateBar();Paint();')
once('void OnTimer() { PollAstrology();FlushNotice();Paint(); }',
 'void OnTimer() { if(NetworkSlot())PollNews();if(NetworkSlot())PollAstrology();if(NetworkSlot())FlushNotice();NewsHeartbeat();Paint(); }')
once('Default execution "+TFName()', 'Mode "+EnumToString(InpRunMode)+"\\nNormal "+TFName()+" | NEWS M1 + konfirmasi M5\\nDefault execution "+TFName()')
# Check accidental escapes in generated title; strategy functions not altered.
assert s.count('OrderSend(')==1
assert 'InpExecutionTF=PERIOD_M5' in s and 'InpAutopilot=false' in s
assert (BASE/'src/C2Core.mqh').read_text() in s
for forbidden in ('iMA(','iATR(','GetActualValue(','GetForecastValue(','PositionClosePartial(','/astro-signal'):
 assert forbidden not in s,forbidden
D=HERE/'dist';D.mkdir(exist_ok=True);name='CEBONK_COMBINED2_NEWS_ATTACK_v1.10'
for ext in ('mq5','txt'):(D/f'{name}.{ext}').write_text(s,encoding='utf8')
for ext in ('mq5','txt'):(D/f'EXPORT_C2_NEWS.{ext}').write_text(read('EXPORT_C2_NEWS.mq5'),encoding='utf8')
base_set='InpSymbol=XAUUSDc\nInpMagic=220202\nInpExecutionTF=5\nInpAutopilot=true\nInpAllowRealAccount=false\nInpAcceptExperimentalAstro=true\nInpFixedLot=0.01\nInpMaxSpreadPoints=70\nInpAstroSource=1\nInpAstroCSV=CEBONK_C2_ASTRO.csv\nInpServerUTCMinutes=180\nInpTelegram=false\nInpMT5Push=false\n'
(D/'BACKTEST_NORMAL_ONLY.set').write_text(base_set+'InpRunMode=0\nInpAllowNewsCSVReplay=false\n')
(D/'BACKTEST_NEWS_ATTACK.set').write_text(base_set+'InpRunMode=1\nInpNewsSource=1\nInpAllowNewsCSVReplay=true\nInpNewsCSV=CEBONK_C2_NEWS.csv\n')
(D/'BACKTEST_NORMAL_AND_NEWS.set').write_text(base_set+'InpRunMode=2\nInpNewsSource=1\nInpAllowNewsCSVReplay=true\nInpNewsCSV=CEBONK_C2_NEWS.csv\n')
# Deliberately invalid until a real export replaces it; NEVER fake a news-free history.
(D/'CEBONK_C2_NEWS.csv').write_text('CEBONK_NEWS_V1,0,0,0,0\nvalue_id,release_epoch,currency,importance,name\n')
astro=BASE/'data/CEBONK_C2_ASTRO.csv'
if astro.exists():(D/astro.name).write_bytes(astro.read_bytes())
readme=HERE/'README.md'
if readme.exists():(D/'PANDUAN_CEBONK_NEWS_ATTACK.txt').write_text(readme.read_text(),encoding='utf8')
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in D.iterdir() if p.is_file() and p.suffix in ('.mq5','.txt','.csv','.set')}
(D/'SHA256.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('BUILD_OK',len(s.encode()),'bytes. Not MetaEditor compilation. Original v1.00 files untouched.')
