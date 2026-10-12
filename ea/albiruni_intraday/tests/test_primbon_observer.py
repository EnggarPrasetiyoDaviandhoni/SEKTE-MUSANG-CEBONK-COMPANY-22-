#!/usr/bin/env python3
"""Static invariants for standalone v1.04; not a substitute for MetaEditor compilation."""
from pathlib import Path
root=Path(__file__).resolve().parents[3]
ea=root/'ea/albiruni_intraday'
old=(ea/'CEBONK_ALBIRUNI_DIRECT_v1.03.mq5').read_text(encoding='utf8')
new=(ea/'CEBONK_ALBIRUNI_SRI_SAAT_v1.04.mq5').read_text(encoding='utf8')
txt=(ea/'dist/CEBONK_ALBIRUNI_SRI_SAAT_v1.04.txt').read_text(encoding='utf8')
preset=(ea/'CEBONK_ALBIRUNI_SRI_SAAT_v1.04.set').read_text(encoding='utf8')
assert new==txt,'MQ5/TXT mismatch'
assert '#property version "1.04"' in new
assert 'majority_direct_v3.csv' in new and 'majority_direct_v3.csv' in preset
assert 'InpAutopilot=false' in new and 'InpAllowRealAccount=false' in new
assert 'InpEnableExperimentalAstro=false' in new
assert 'InpAllowRealAccount=false' in preset
assert 'InpMaxSpreadPoints=70' in new
assert 'InpATRTimeframe=PERIOD_M15' in new
assert 'InpSL_ATR=3.0' in new and 'InpRR=2.0' in new
assert 'ABPrimbonNote(now)+' in new,'Primbon only appears in successful entry notice'
assert 'ABPrimbonNote(' in new
assert 'if(civil.hour*60+civil.min>=1080)wetonSec+=86400' in new
assert 'int offset=(int)(diff%5)' in new
assert 'long diff=wetonSec/86400-20738' in new
assert 'string preferred[7]={"Pon","Kliwon","Pahing","Wage","Pahing","Wage","Legi"}' in new
assert 'int hours[56]' in new
assert 'Observasi tok, bukan filter entry' in new
assert new.count('ABPrimbonNote(now)')==1
# All legacy trading entry logic must remain byte-for-byte identical.
def segment(code,left,right):
 return code[code.index(left):code.index(right,code.index(left))]
for left,right in [
 ('bool ABTradeAllowed(', 'bool ABValidLot('),
 ('bool ABOpenPosition(', 'string ABURLEncode('),
 ('void ABCheckEntry(', 'int OnInit('),
 ('void OnTimer()', 'void OnTick()'),
]:
 assert segment(old,left,right)==segment(new,left,right),left+' trade logic changed'
print('PASS: v1.04 only annotates successful order notice; trade logic, feed, locks, spread and risk unchanged')
