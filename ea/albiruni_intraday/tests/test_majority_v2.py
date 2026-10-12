#!/usr/bin/env python3
"""Validate majority V2 publisher and EA source invariants, NOT a MetaEditor compile."""
import csv,json,sys,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
repo=root.parents[1]
mq=(root/'CEBONK_ALBIRUNI_MAJORITY_v1.02.mq5').read_text('utf8')
txt=(root/'dist/CEBONK_ALBIRUNI_MAJORITY_v1.02.txt').read_text('utf8')
preset=(root/'CEBONK_ALBIRUNI_MAJORITY_v1.02.set').read_text('utf8')
js=(repo/'scripts/generate-albiruni-intraday.mjs').read_text('utf8')
assert mq==txt,'TXT and MQ5 differ'
assert '#property version "1.02"' in mq
assert 'const string AB_MODEL="ALBIRUNI_MAJORITY_V2"' in mq
assert 'const string AB_HEADER="model,date_wib,signal_id,direction,start_epoch,entry_epoch,core_epoch,end_epoch,valid_until_epoch,published_epoch,aspect,phase,buy_aspects,sell_aspects"' in mq
assert 'if(StringSplit(line,44,p)!=14)' in mq
assert 'ALBIRUNI_MAJORITY_MISMATCH' in mq
assert '(s.dir>0&&s.buyAspects<=s.sellAspects)' in mq
assert '(s.dir<0&&s.sellAspects<=s.buyAspects)' in mq
assert 's.buyAspects=(int)StringToInteger(p[12])' in mq
assert 's.sellAspects=(int)StringToInteger(p[13])' in mq
assert 'if(s.dir==0)' in mq
assert "mode:'day',focus:'all',orb:2" in js,'Publisher does not scan all 21 aspect pairs'
assert "'ASPECT_COUNT_MAJORITY_V2'" in js
assert "data.election?.eligible===true" in js
assert "data.election?.reference?.gateMode==='enforce'" in js
assert 'InpFeedURL="https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/albiruni_intraday/data/majority_v2.csv"' in mq
assert 'InpAutopilot=false' in mq and 'InpEnableExperimentalAstro=false' in mq and 'InpAllowRealAccount=false' in mq
assert 'InpMaxSpreadPoints=70' in mq
assert all(k in mq for k in ['InpATRTimeframe=PERIOD_M15','InpATRPeriod=14','InpSL_ATR=3.0','InpRR=2.0'])
assert 'InpAutopilot=false' in preset and 'InpAllowRealAccount=false' in preset
assert '/data/majority_v2.csv' in preset
assert 'if(gTester)return ABReadFile();' in mq,'No WebRequest in tester'
assert 'GlobalVariableCheck(ABGlobalKey(s.id))' in mq
assert 'SymbolInfoSessionTrade(InpSymbol,day,n,sessionFrom,sessionTo)' in mq
assert 'DEAL_REASON_TP' in mq and 'DEAL_REASON_SL' in mq
assert re.search(r'input bool InpNotifyAutopilot=true',mq)
assert not any(re.search(r'\b'+k+r'\s*\(',mq) for k in ('MoveToBE','MoveStopToBreakeven','TrailStop','PartialClose'))
if len(sys.argv)>2:
  csv_path=Path(sys.argv[1]);json_path=Path(sys.argv[2])
  with csv_path.open(newline='',encoding='utf-8') as f:
    reader=csv.DictReader(f);rows=list(reader)
    assert len(reader.fieldnames)==14 and len(rows)==1,'V2 expected one 14-field daily record'
    assert reader.fieldnames[-2:]==['buy_aspects','sell_aspects']
  row=rows[0]
  data=json.loads(json_path.read_text('utf8'))
  assert row['model']=='ALBIRUNI_MAJORITY_V2'
  assert data['model']==row['model']
  assert data['direction']==row['direction']
  assert data['election']['reference']['gateMode']=='enforce'
  buy,sell=int(row['buy_aspects']),int(row['sell_aspects'])
  assert 0<=buy and 0<=sell and buy+sell<=21
  if row['direction']=='BUY':
    assert buy>sell and data['election']['eligible'] is True
    assert data['majority']['buyAspects']==buy
    assert data['majority']['sellAspects']==sell
  elif row['direction']=='SELL':
    assert sell>buy and data['election']['eligible'] is True
    assert data['majority']['buyAspects']==buy
    assert data['majority']['sellAspects']==sell
  else:
    assert row['direction']=='WAIT' and buy==sell==0
    assert row['signal_id']=='NONE' and int(row['entry_epoch'])==0
  print('V2 MAJORITY FEED PASS',row['date_wib'],row['direction'],buy,sell)
else:
  print('V2 MAJORITY SOURCE PASS')
