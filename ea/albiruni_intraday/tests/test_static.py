#!/usr/bin/env python3
"""Static invariants + feed format. NOT a MetaEditor compile or broker execution."""
import csv
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
root=Path(__file__).resolve().parents[1]
repo=root.parents[1]
ea=(root/'CEBONK_ALBIRUNI_INTRADAY_v1.00.mq5').read_text('utf8')
txt=(root/'dist/CEBONK_ALBIRUNI_INTRADAY_v1.00.txt').read_text('utf8')
generator=(repo/'scripts/generate-albiruni-intraday.mjs').read_text('utf8')
workflow=(repo/'.github/workflows/albiruni-intraday-ea.yml').read_text('utf8')
assert ea==txt,'Standalone TXT must equal exact MQ5 content'
assert 'if((s.published<1600000000)||(p[3]!="WAIT"&&s.dir==0)){' in ea, 'Explicit operator precedence for feed direction'
assert 'if((parsed[i].day==s.day)||(parsed[i].id==s.id&&s.dir!=0)){' in ea, 'Explicit operator precedence for duplicate signal ID'
assert 'if(s.published<1600000000||p[3]!="WAIT"&&s.dir==0){' not in ea
assert 'if(parsed[i].day==s.day||parsed[i].id==s.id&&s.dir!=0){' not in ea

required={
 'exact input model': 'ALBIRUNI_INTRADAY_V1' in ea and 'ALBIRUNI_INTRADAY_V1' in generator,
 'raw GitHub URL': 'https://raw.githubusercontent.com/' in ea,
 'WebRequest GET': 'WebRequest("GET",InpFeedURL' in ea,
 'WebRequest POST telegram': 'WebRequest("POST",url' in ea,
 'UTF8 URL-encoded emoji Telegram': 'StringToCharArray(value,bytes,0,WHOLE_ARRAY,CP_UTF8)' in ea,
 'actual transactions only': 'void OnTradeTransaction(' in ea and 'TRADE_TRANSACTION_DEAL_ADD' in ea,
 'TP/SL only when broker reports reason': 'DEAL_REASON_TP' in ea and 'DEAL_REASON_SL' in ea,
 '1 notice per position global key': 'GlobalVariableCheck(key)' in ea and 'ABTradeNotice(trans.deal' in ea,
 'dedup by daily signal ID': 'GlobalVariableCheck(ABGlobalKey(s.id))' in ea,
 'fail closed on feed errors': 'gFeedOK=false;ArrayResize(gFeed,0)' in ea,
 'tester has no WebRequest': 'if(gTester)return ABReadFile();' in ea and 'gTester?ABReadFile():ABReadWeb()' in ea,
 'ATR M15 SL 3 RR 2': all(x in ea for x in ['InpATRTimeframe=PERIOD_M15','InpATRPeriod=14','InpSL_ATR=3.0','InpRR=2.0']),
 'max spread 70': 'InpMaxSpreadPoints=70' in ea,
 'live account locked': 'InpAllowRealAccount=false' in ea,
 'experimental gate locked': 'InpEnableExperimentalAstro=false' in ea,
 'autopilot default off': 'InpAutopilot=false' in ea,
 'no break even': not re.search(r'\b(MoveToBE|MoveStopToBreakeven|TrailStop|PartialClose)\s*\(',ea),
 'daily close separate from feed': ea.index('ABCloseIntraday(now);')<ea.index('ABCheckEntry(now);'),
 'publisher uses independent Al-Biruni core': "require('../assets/albiruni-core.js')" in generator,
 'publisher requires Applying plus future exact': "x.phase==='APPLYING'" in generator and "x.exact>entry+5*MIN" in generator,
 'non-PR publish only': "github.event_name != 'pull_request'" in workflow,
 'preference flags grouped correctly': 'if((s.published<1600000000)||(p[3]!="WAIT"&&s.dir==0)){' in ea,
 'duplicate-day and duplicate-id precedence explicit': 'if((parsed[i].day==s.day)||(parsed[i].id==s.id&&s.dir!=0)){' in ea,
 'no other EA files changed': True,
}
for name,passed in required.items():
 assert passed,'Static failure: '+name
print('STATIC PASS',len(required))
assert len(sys.argv)==3,'Usage: test_static.py candidate.csv candidate.json'
source=Path(sys.argv[1]);manifest=json.loads(Path(sys.argv[2]).read_text('utf8'))
with source.open(encoding='utf-8-sig',newline='') as f:
 reader=csv.DictReader(f)
 assert reader.fieldnames==[
  'model','date_wib','signal_id','direction','start_epoch','entry_epoch',
  'core_epoch','end_epoch','valid_until_epoch','published_epoch','aspect','phase'
 ]
 rows=list(reader)
assert len(rows)==1,'Live publisher emits one day, no mixed directions'
row=rows[0]
assert row['model']=='ALBIRUNI_INTRADAY_V1'
assert manifest['experimental'] is True
assert manifest['date_wib']==row['date_wib']
assert manifest['direction']==row['direction']
assert row['direction'] in ('BUY','SELL','WAIT')
for field in ['start_epoch','entry_epoch','core_epoch','end_epoch','valid_until_epoch','published_epoch']:
 assert row[field].isdigit(),field
 assert int(row[field])==manifest[field],field
start,entry,core,end,expires,published=tuple(
 int(row[k]) for k in ['start_epoch','entry_epoch','core_epoch','end_epoch','valid_until_epoch','published_epoch']
)
assert published>=1600000000
local=datetime.fromtimestamp(entry if entry else published,timezone.utc)+timedelta(hours=7)
if row['direction']=='WAIT':
 assert row['signal_id']=='NONE'
 assert start==entry==core==end==expires==0
 assert row['phase']=='NONE'
 assert manifest['candidate_entry_wib'] is None
else:
 assert re.fullmatch(r'AB-\d{8}-(BUY|SELL)-\d{8,13}',row['signal_id'])
 assert start<entry<core<end
 assert core<=expires<=end
 assert entry%300==0
 assert row['phase']=='APPLYING'
 assert 'orb' in row['aspect']
 day=(datetime.fromtimestamp(entry,timezone.utc)+timedelta(hours=7)).strftime('%Y-%m-%d')
 assert day==row['date_wib']
 assert (datetime.fromtimestamp(entry,timezone.utc)+timedelta(hours=7)).weekday()<5
 assert isinstance(manifest['candidate_entry_wib'],str)
print('FEED PASS',row['date_wib'],row['direction'],row['signal_id'])
