"""Static source acceptance checks; not MT5 compilation or empirical validation."""
from pathlib import Path
import re
root = Path(__file__).parent
main = (root/'CEBONK_HARMONIC_ASTRO_FULL_v1.10.mq5').read_text()
hp = (root/'HarmonicScanner.mqh').read_text()
astro = (root/'AstroWebFeed.mqh').read_text()
standalone = (root/'CEBONK_HARMONIC_ASTRO_FULL_SINGLE_v1.10.mq5').read_text()
mirror = (root/'CEBONK_HARMONIC_ASTRO_FULL_SINGLE_v1.10.txt').read_text()
assert mirror == standalone
assert standalone == main.replace('#include "HarmonicScanner.mqh"',hp).replace('#include "AstroWebFeed.mqh"',astro)
assert '#include "HarmonicScanner.mqh"' not in standalone
assert '#include "AstroWebFeed.mqh"' not in standalone
assert standalone.count('{')==standalone.count('}')
assert standalone.count('(')==standalone.count(')')
for param in ('ScanH4=true','ScanH1=true','ScanM30=true','PERIOD_H4','PERIOD_H1','PERIOD_M30',
              'PERIOD_M5','FOLLOW_PLUS_REVERSAL','FOLLOW_TREND_ONLY','REVERSAL_ONLY',
              'CB1MinBody','CB1BreakPoints','CHCB1(', 'CHExecute(', 'SLBufferPoints',
              'MaxSpreadPoints=70','MaxRiskPercent=1.0','DailyEquityStopPercent=5.0',
              'StartAutopilot=false','AllowRealAccount=false','GlobalVariableSetOnCondition',
              'OrderCalcProfit','OnTradeTransaction','AcceptExperimentalAstro=false',
              'ASTRO_WEB_CSV','ASTRO_LOCAL_CSV','ASTRO_OFF','AstroFixedServerUTCMinutes=180',
              'CEBONK_C2_WEB_V1_35ce78b4','MQL_TESTER', 'WebRequest(', 'CHClaim(',
              '0.382','0.618','2.0*risk','HPClassifySix','HPClassifyContext'):
    assert param in standalone,param
assert 'PERIOD_M15' not in standalone
for hpname in ('GARTLEY','BAT','ALT_BAT','BUTTERFLY','CRAB','DEEP_CRAB',
               'CYPHER','SHARK','FIVE_ZERO','THREE_DRIVES','ABCD','ALT_ABCD',
               'IMPULSE_ABCD','CORRECTIVE_ABCD','NESTED_ABCD','BACK_TO_BACK_ABCD'):
    assert 'HP_'+hpname in hp, hpname
assert len(re.findall(r'case HP_',hp))>=32
assert 'chLastM5=iTime(_Symbol,PERIOD_M5,0)' in standalone
assert 'if(chLastM5==0){chLastM5=closeOpen;return;}' in standalone
assert 'if(!ACGate(s.dir,closeOpen))continue;' in standalone
assert 'if(!ACClaim' not in standalone
assert 'AstroSource==ASTRO_OFF)return true;' in standalone
assert 'if(MQLInfoInteger(MQL_TESTER))' in standalone
assert 'StringFind(note,"CF:")' in standalone
# Pure arithmetic smoke, not runtime MQL execution.
D=100.0; A=110.0; entry=102.0; sl=100.0
f382=D+(A-D)*.382
f618=D+(A-D)*.618
assert f382-entry < 2*(entry-sl)
assert f618-entry >= 2*(entry-sl)
assert entry + 2*(entry-sl)==106.0
print('PASS: standalone matches modular + TXT, 16 pattern switches, safety gates, Fibonacci RR arithmetic')
print('NOT tested: MetaEditor MQL5 compile, broker ticks, strategy profitability, published HTTP runtime')