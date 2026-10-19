#!/usr/bin/env python3
from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
p=root/'dist/CEBONK_BBMA_LS_ADAPTIVE_v1.00.txt'
ea=p.read_text(encoding='utf-8')

n=0
def ok(name, cond):
    global n
    assert cond, name
    n+=1
    print('PASS',name)

ok('adaptive release exists', p.exists())
ok('exact 3 TF packages', all(x in ea for x in ['LS_H4_H1_M15','LS_H1_M15_M5','LS_M15_M5_M1']) and 'LS_M30_M5_M1' not in ea)
ok('spread guard 70', 'InpMaxSpreadPoints=70' in ea)
ok('RR default 2', 'InpRR=2.0' in ea)
ok('no ATR', 'iATR(' not in ea and 'CopyBuffer(' not in ea)
ok('SL from TF2 BB', 'double stop=dir>0?low:top;' in ea)
ok('one position/order guard', 'LSHasPositionOrOrder()' in ea and 'if(!LSSession()||LSHasPositionOrOrder())return;' in ea)

ok('tester files declared', '#property tester_file "CEBONK_C2_ASTRO.csv"' in ea and '#property tester_file "CEBONK_C2_NEWS.csv"' in ea)
ok('tester news replay active', 'if(!InpUseCounterNews||gTester)return false;' not in ea and 'LSLoadNewsLocal()' in ea)
ok('tester astro replay active', 'if(!InpUseAstrologyCounterNews||gTester)return;' not in ea and 'LSLoadAstroLocal()' in ea)
ok('tester fail closed without news CSV', 'INIT FAIL: Counter News tester wajib' in ea)
ok('tester fail closed without astro CSV', 'INIT FAIL: Astrology tester wajib' in ea)

regime=ea[ea.index('bool LSRegime('):ea.index('bool LSPivot(')]
ok('latest regime event wins', all(x in regime for x in ['rb>best','rs>best','fb>best','fs>best']))
ok('old reversal age blocked', 'TimeTradeServer()-at>maxAge' in regime)
ok('sideways follow blocked', 'LSStructureTrend(tf)' in regime and 'if(st==0||st!=dir)return false;' in regime)

ok('news cooldown minimum 5m', '#define LS_NEWS_COOLDOWN_MIN 5' in ea and 'readyUTC=release+LS_NEWS_COOLDOWN_MIN*60' in ea)
ok('astrology event and live must align', 'eventDir=LSAstroDir(releaseUtc)' in ea and 'liveDir=LSAstroDir(LSNowUTC())' in ea and 'eventDir==dir&&liveDir==dir' in ea)

place=ea[ea.index('bool LSPlace('):ea.index('bool LSSetExactTP(')]
ok('order send keeps protective provisional TP', 'req.sl=sl;req.tp=tp;' in place)
ok('no Telegram on mere order acceptance', 'LSTelegramEntry(' not in place)
ok('pending signal context saved', 'gPendingSignalKey=signalKey' in place)

trade=ea[ea.index('void OnTradeTransaction('):ea.index('void OnChartEvent(')]
ok('entry notification from actual deal', 'DEAL_ENTRY_IN' in trade and 'LSTelegramEntry(' in trade)
ok('actual fill price used', 'POSITION_PRICE_OPEN' in trade and 'DEAL_PRICE' in trade)
ok('actual-fill RR TP modification', 'LSSetExactTP(' in trade and 'TRADE_ACTION_SLTP' in ea)
ok('signal consumed after actual fill', 'if(gPendingSignalKey!="")LSMark(gPendingSignalKey);' in trade)
ok('one notification per position', 'LSNotifySeen(posTicket)' in trade and 'LSNotifyMark(posTicket)' in trade)

cut=ea[ea.index('bool LSCloseProfitIfWarn('):ea.index('bool LSSession()')]
ok('cut profit only above minimum profit', 'profit<InpCutMinProfitMoney' in cut)
ok('cut profit hysteresis', 'gCutWarnCount<MathMax(1,InpCutConfirmTicks)' in cut)
ok('cut profit buffer', 'InpCutBufferPoints' in cut and 'mid-buf' in cut and 'mid+buf' in cut)
ok('cut profit intrabar', 'void OnTick()' in ea and 'LSCloseProfitIfWarn(p.tf2)' in ea)

ok('autopilot single button', ea.count('OBJ_BUTTON')==1 and 'AUTOPILOT ON' in ea and 'AUTOPILOT OFF' in ea)
ok('no obvious placeholder tokens', all(x not in ea for x in ['TODO','FIXME','({LSPackage']))
print('TOTAL PASS',n)
