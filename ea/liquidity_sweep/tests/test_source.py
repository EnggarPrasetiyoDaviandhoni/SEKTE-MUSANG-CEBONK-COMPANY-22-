#!/usr/bin/env python3
from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
repo=root.parents[1]
main=(root/'src/CEBONK_LIQUIDITY_SWEEP.mq5').read_text(encoding='utf-8')
core=(root/'src/LSCore.mqh').read_text(encoding='utf-8')
astro=(root/'src/LSAstroNews.mqh').read_text(encoding='utf-8')
notify=(root/'src/LSNotify.mqh').read_text(encoding='utf-8')
trade=(root/'src/LSTrade.mqh').read_text(encoding='utf-8')
readme=(root/'README.md').read_text(encoding='utf-8')
web=(repo/'assets/technical-scanners-core.js').read_text(encoding='utf-8')

n=0
def ok(name, cond):
    global n
    assert cond, name
    n+=1
    print('PASS',name)

ok('modular includes', all(x in main for x in ['#include "LSCore.mqh"','#include "LSAstroNews.mqh"','#include "LSNotify.mqh"','#include "LSTrade.mqh"']))
ok('4 packages', all(x in core for x in ['H4-H1-M15','H1-M15-M5','M30-M5-M1','M15-M5-M1']))
ok('closed bars only', 'CopyRates(symbol,tf,1,need,r)' in core)
ok('web parity constants MQL', all(x in core for x in [
 '#define BW_LIQ_LOOKBACK 80','#define BW_PIVOT_DEPTH 2','#define BW_SWEEP_SEARCH 18',
 '#define BW_DISPLACEMENT_BARS 3','#define BW_STRUCTURE_LOOKBACK 6',
 '#define BW_BODY_MULT 1.20','#define BW_EQUAL_TOL 0.12','#define BW_MIN_HOLD_SEC 300']))
ok('web parity constants JS', all(x in web for x in [
 'liquidityPivotDepth:2','liquidityLookback:80','sweepSearch:18','displacementBars:3',
 'displacementBodyMultiple:1.20','structureLookback:6','equalToleranceRange:0.12',
 'minSignalHoldMinutes:5']))
ok('liquidity level types', all(x in core for x in ['SWING_LOW','SWING_HIGH','EQUAL_LOW','EQUAL_HIGH']))
ok('sweep close-back rule', 's.low<level.price&&s.close>level.price' in core and 's.high>level.price&&s.close<level.price' in core)
ok('displacement break rule', 'body>=mb*BW_BODY_MULT' in core and 'x.close>structure' in core and 'x.close<structure' in core)
ok('tf3 retest rule', 'x.low<=structure&&x.close>structure' in core and 'x.high>=structure&&x.close<structure' in core)
ok('latest valid selection', 'cand.eventAt>best.eventAt' in core and 'latestExpired' in core)
ok('signal hold', 'MathMax(PeriodSeconds(tf),BW_MIN_HOLD_SEC)' in core)
ok('astrology normal gate', 'BWAstroNormalGate' in main and 'ASTRO_DIRECTION_MISMATCH' in astro)
ok('astrology news gate', 'BWBuildNewsGate' in main and 'CALENDAR_IMPORTANCE_HIGH' in astro and '"USD"' in astro)
ok('all timeframe pulse', all(x in main for x in ['PERIOD_M1','PERIOD_M5','PERIOD_M15','PERIOD_M30','PERIOD_H1','PERIOD_H4']))
ok('anti duplicate', 'GlobalVariableCheck' in main and 'LSReserveSignal' in main)
ok('telegram JSON', 'Content-Type: application/json' in notify and 'api.telegram.org' in notify)
ok('autopilot button', main.count('OBJ_BUTTON')==1 and 'AUTOPILOT ON' in main and 'AUTOPILOT OFF' in main)
ok('MQL5 arrays passed by reference', all(x in main for x in [
    'int LSCount(const bool &a[])',
    'string LSPackages(const bool &buy[],const bool &sell[],const int dir)',
    'int LSChooseLatest(const BWSignal &signals[],const bool &flags[])']))
ok('no by-value bool array params', all(x not in main for x in [
    'int LSCount(const bool a[])',
    'string LSPackages(const bool buy[],const bool sell[],const int dir)',
    'int LSChooseLatest(const BWSignal &signals[],const bool flags[])']))
ok('market auto execution', 'OrderSend(req,res)' in trade and 'TRADE_ACTION_DEAL' in trade and 'LSPlace(' in main)
ok('fixed lot default', 'InpFixedLot=0.01' in main)
ok('spread 70 default', 'InpMaxSpreadPoints=70' in main)
ok('autopilot default off', 'InpAutopilot=false' in main)
ok('real account locked default', 'InpAllowRealAccount=false' in main and 'REAL_ACCOUNT_LOCKED' in trade)
ok('one position or order per symbol', 'LSHasPositionOrOrder' in trade and 'SYMBOL_ALREADY_HAS_POSITION_OR_ORDER' in trade)
ok('sweep SL execution', 's.structuralSL' in trade and 'SL_WRONG_SIDE' in trade)
ok('RR from actual quote', 'double entry=s.dir>0?tick.ask:tick.bid' in trade and 'entry+risk*rr' in trade and 'entry-risk*rr' in trade)
ok('anti duplicate reserve before execution', main.find('LSReserveSignal(key)') < main.find('LSPlace('))
ok('trade notifications', all(x in trade for x in ['ENTRY_FILLED','POSITION_EXIT']) and all(x in main for x in ['ORDER_ACCEPTED','ORDER_REJECTED']))
ok('no ATR', 'iATR(' not in (main+core+astro+notify+trade) and 'CopyBuffer(' not in (main+core+astro+notify+trade))
ok('no recovery martingale layering', all(x not in (main+core+astro+notify+trade) for x in ['RecoveryLot','MartingaleLot','LayerLot']))
ok('no BE trailing partial engine', all(x not in (main+core+astro+notify+trade) for x in ['PositionModify','TrailingStop','BreakEven','PartialClose']))
ok('readme auto-entry explicit', 'AUTOPILOT ON/OFF' in readme and 'Fixed lot default `0.01`' in readme and '70 points' in readme)
ok('preset present', (root/'LIQUIDITY_SWEEP_DEFAULT.set').exists())
ok('compact main', (root/'src/CEBONK_LIQUIDITY_SWEEP.mq5').stat().st_size < 16000)
ok('compact core', (root/'src/LSCore.mqh').stat().st_size < 12000)
ok('compact notifier', (root/'src/LSNotify.mqh').stat().st_size < 6000)
ok('compact trade', (root/'src/LSTrade.mqh').stat().st_size < 9000)
print('TOTAL PASS',n)
