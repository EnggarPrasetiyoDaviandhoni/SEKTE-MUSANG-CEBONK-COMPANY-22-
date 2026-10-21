import test from 'node:test';
import assert from 'node:assert/strict';
import {strengthDay,resolveWeekly,validateWeeklyStrength,MIN_SHARE,MIN_MINUTES,STRENGTH_METHOD} from '../../scripts/swing/weekly-lock.mjs';
const score=(state,score)=>Array.from({length:288},()=>({state,score}));
function strength(days){return {method:STRENGTH_METHOD,start_wib:'2026-10-19',end_wib:'2026-10-25',
 step_minutes:5,total_slots:2016,min_share:MIN_SHARE,min_directional_minutes:MIN_MINUTES,days,
 buy_score_minutes:days.reduce((x,d)=>x+d.buy_score_minutes,0),sell_score_minutes:days.reduce((x,d)=>x+d.sell_score_minutes,0),
 buy_minutes:days.reduce((x,d)=>x+d.buy_minutes,0),sell_minutes:days.reduce((x,d)=>x+d.sell_minutes,0)};}
test('CAMPURAN uses score strength over all seven days including Saturday/Sunday',()=>{
 const days=Array.from({length:7},(_,i)=>strengthDay('2026-10-'+(19+i),score(i<5?'BUY':'SELL',i<5?1:-5)));
 const s=strength(days),decision=resolveWeekly('CAMPURAN',s);
 assert.deepEqual(decision,{direction:'SELL',reason:'SEVEN_DAY_STRENGTH'});
 assert.equal(s.buy_minutes,7200);assert.equal(s.sell_minutes,2880);
 assert.doesNotThrow(()=>validateWeeklyStrength({week_monday_wib:s.start_wib,weekly_source_direction:'CAMPURAN',
  weekly_direction:decision.direction,weekly_resolution_reason:decision.reason,seven_day_strength:s}));
});
test('tie, weak dominance, too few directional minutes and no direction all WAIT',()=>{
 const s={buy_score_minutes:500,sell_score_minutes:500,buy_minutes:180,sell_minutes:180,min_share:.55,min_directional_minutes:360};
 assert.equal(resolveWeekly('CAMPURAN',s).reason,'WAIT_TIE');
 s.buy_score_minutes=540;s.sell_score_minutes=460;assert.equal(resolveWeekly('CAMPURAN',s).direction,'WAIT');
 s.buy_score_minutes=900;s.sell_score_minutes=100;s.buy_minutes=175;assert.equal(resolveWeekly('CAMPURAN',s).direction,'WAIT');
 s.buy_minutes=180;assert.equal(resolveWeekly('CAMPURAN',s).direction,'BUY');
 assert.deepEqual(resolveWeekly('TIDAK ADA ARAH',s),{direction:'WAIT',reason:'SOURCE_NO_DIRECTION'});
 assert.equal(resolveWeekly('SELL',s).direction,'SELL');
});
test('neutral slots do not count as BUY/SELL strength',()=>{
 const d=strengthDay('2026-10-19',score('TRANSITION',100));assert.equal(d.buy_score_minutes+d.sell_score_minutes,0);
 assert.equal(d.buy_minutes+d.sell_minutes,0);assert.throws(()=>strengthDay(d.date_wib,[]),/288/);
 assert.throws(()=>strengthDay(d.date_wib,score('BUY',NaN)),/Nonfinite/);
});
