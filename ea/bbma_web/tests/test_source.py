#!/usr/bin/env python3
from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
main=(root/'src/CEBONK_BBMA_WEB.mq5').read_text(encoding='utf-8')
core=(root/'src/BWCore.mqh').read_text(encoding='utf-8')
astro=(root/'src/BWAstroNews.mqh').read_text(encoding='utf-8')
trade=(root/'src/BWTrade.mqh').read_text(encoding='utf-8')
readme=(root/'README.md').read_text(encoding='utf-8')

def ok(name, cond):
    assert cond, name
    print('PASS', name)

ok('modular includes', all(x in main for x in ['#include "BWCore.mqh"','#include "BWAstroNews.mqh"','#include "BWTrade.mqh"']))
ok('4 packages', all(x in core for x in ['H4-H1-M15','H1-M15-M5','M30-M5-M1','M15-M5-M1']))
ok('web BB baseline', all(x in core for x in ['#define BW_BB_PERIOD 20','#define BW_BB_DEV 2.0','#define BW_FAST 5','#define BW_SLOW 10']))
ok('reentry tf2 tf3 ages', all(x in core for x in ['#define BW_RE_AGE 6','#define BW_TF2_AGE 6','#define BW_TF3_AGE 6']))
ok('closed bars only', 'CopyRates(symbol,tf,1,need,r)' in core)
ok('tf1 reentry', 'BWReentryAt' in core and 'TF1_REENTRY_WAIT' in core)
ok('tf2 csak/csm', 'BWCSAKAt' in core and 'TF2_CSAK_CSM_WAIT' in core)
ok('tf3 csm', 'BWCSMAt' in core and 'TF3_CSM_WAIT' in core)
ok('fixed lot default', 'InpFixedLot=0.01' in main)
ok('spread 70', 'InpMaxSpreadPoints=70' in main)
ok('rr2', 'InpRR=2.0' in main)
ok('sl bb buffer', 'InpSLBufferPrice=0.20' in main and 't2i].lower-slBuffer' in core and 't2i].upper+slBuffer' in core)
ok('no ATR engine', 'iATR(' not in (main+core+astro+trade) and 'CopyBuffer(' not in (main+core+astro+trade))
ok('no martingale recovery layering', not re.search(r'\b(Martingale|RecoveryLot|Layering|InpRiskPercent)\b', main+core+astro+trade, re.I))
ok('news defaults match web', all(x in main for x in [
    'InpNewsPreMinutes=30','InpNewsPostMinutes=120',
    'InpNewsBlockBeforeMinutes=5','InpNewsBlockAfterMinutes=5',
    'InpNewsEntrySpanMinutes=10','InpNewsMinWindowMinutes=15']))
ok('news overrides normal', main.find('if(ng.episode)') < main.find('if(!newsMode)'))
ok('news technical event inside entry window', 'TECHNICAL_EVENT_OUTSIDE_ASTROLOGY_NEWS_ENTRY_WINDOW' in main)
ok('normal astro gate', 'BWAstroNormalGate' in main)
ok('news inherited astro schedule', 'BWAstroDir(t)' in astro and 'focus' in astro)
ok('news live calendar high USD', 'CalendarValueHistory' in astro and 'CALENDAR_IMPORTANCE_HIGH' in astro and '"USD"' in astro)
ok('global raw conflict', 'BBMA_PACKAGE_CONFLICT_BUY_SELL' in main)
ok('one position per symbol', 'BWHasPositionOrOrder' in trade and 'SYMBOL_ALREADY_HAS_POSITION_OR_ORDER' in trade)
ok('anti duplicate signal', 'BWReserveSignal' in main and 'GlobalVariableCheck' in main)
ok('cut profit after 1R', 'if(move<risk)return;' in main and 'BWLatestCutSignal' in main)
ok('no trailing or be operations', 'PositionModify' not in (main+core+astro+trade))
ok('autopilot button only custom chart object', main.count('OBJ_BUTTON')==1)
ok('real account locked default', 'InpAllowRealAccount=false' in main)
ok('telegram json post', 'Content-Type: application/json' in trade and 'api.telegram.org' in trade)
ok('experimental warning documented', 'belum dibuktekake win rate/profit' in readme)
ok('no web/liquidity source touched by module', 'liquidity' not in core.lower())

for p,limit in [
    (root/'src/CEBONK_BBMA_WEB.mq5',18000),
    (root/'src/BWCore.mqh',14000),
    (root/'src/BWAstroNews.mqh',19000),
    (root/'src/BWTrade.mqh',14000),
]:
    ok(f'compact {p.name}', p.stat().st_size < limit)

print('TOTAL PASS 32')
