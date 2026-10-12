#!/usr/bin/env python3
"""V3 direct-majority contract checks; this is NOT a MetaEditor compilation."""
import csv,json,sys
from pathlib import Path
repo=Path(__file__).resolve().parents[3]
root=repo/'ea/albiruni_intraday'
mq=(root/'CEBONK_ALBIRUNI_DIRECT_v1.03.mq5').read_text(encoding='utf8')
text=(root/'dist/CEBONK_ALBIRUNI_DIRECT_v1.03.txt').read_text(encoding='utf8')
preset=(root/'CEBONK_ALBIRUNI_DIRECT_v1.03.set').read_text(encoding='utf8')
generator=(repo/'scripts/generate-albiruni-intraday.mjs').read_text(encoding='utf8')
assert mq==text,'TXT/MQ5 differ'
assert '#property version "1.03"' in mq
assert 'const string AB_MODEL="ALBIRUNI_MAJORITY_DIRECT_V3"' in mq
assert 'if(StringSplit(line,44,p)!=14)' in mq
assert 'ALBIRUNI_MAJORITY_MISMATCH' in mq
assert '(s.dir>0&&s.buyAspects<=s.sellAspects)' in mq
assert '(s.dir<0&&s.sellAspects<=s.buyAspects)' in mq
assert 'majority_direct_v3.csv' in mq
assert 'majority_direct_v3.csv' in preset
assert 'InpAutopilot=false' in mq
assert 'InpEnableExperimentalAstro=false' in mq
assert 'InpAllowRealAccount=false' in mq
assert 'InpAllowRealAccount=false' in preset
assert 'InpMaxSpreadPoints=70' in mq
assert 'InpATRTimeframe=PERIOD_M15' in mq
assert 'InpATRPeriod=14' in mq
assert 'InpSL_ATR=3.0' in mq
assert 'InpRR=2.0' in mq
assert "mode:'day',focus:'all',orb:2" in generator
assert "gateMode==='majority'" in generator
assert "READY_MAJORITY_ONLY" in generator
if len(sys.argv)==3:
 with open(sys.argv[1],encoding='utf-8',newline='') as stream:
  reader=csv.DictReader(stream);rows=list(reader)
 assert len(reader.fieldnames)==14 and len(rows)==1
 assert reader.fieldnames[-2:]==['buy_aspects','sell_aspects']
 feed=rows[0]; audit=json.loads(Path(sys.argv[2]).read_text(encoding='utf8'))
 assert feed['model']==audit['model']=='ALBIRUNI_MAJORITY_DIRECT_V3'
 assert feed['direction']==audit['direction']
 assert audit['election']['reference']['gateMode']=='majority'
 assert audit['election']['status'] in ('NOT_APPLIED','WAIT')
 n_buy=int(feed['buy_aspects']);n_sell=int(feed['sell_aspects'])
 assert 0<=n_buy and 0<=n_sell and n_buy+n_sell<=21
 if feed['direction'] in ('BUY','SELL'):
  assert audit['election']['status']=='NOT_APPLIED'
  assert audit['reason']=='READY_MAJORITY_ONLY'
  assert (n_buy>n_sell) if feed['direction']=='BUY' else (n_sell>n_buy)
  assert audit['majority']['buyAspects']==n_buy
  assert audit['majority']['sellAspects']==n_sell
  assert feed['phase']=='APPLYING'
 else:
  assert feed['direction']=='WAIT' and n_buy==n_sell==0
  assert feed['signal_id']=='NONE' and int(feed['entry_epoch'])==0
 print('PASS: direct majority V3 daily file',feed['date_wib'],feed['direction'],n_sell,n_buy)
else:
 print('PASS: direct majority V3 static MT5 and generator contracts')
