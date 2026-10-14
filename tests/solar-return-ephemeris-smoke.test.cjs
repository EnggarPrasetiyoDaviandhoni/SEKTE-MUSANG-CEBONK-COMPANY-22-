'use strict';
/* Uses REAL Astronomy Engine, not a mocked planetary ephemeris.
 * This is an astronomical computation smoke test, NOT a GOLD trading backtest.
 */
const assert=require('node:assert/strict');
const A=require('astronomy-engine');
const SR=require('../assets/astrodox-comex-solar-return-core.js');
const F=require('../assets/solar-return-only-trend-core.js');
const bodies=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const MIN=60000;
const C={
 Time:{
  parseDate(date){
   assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
   const ms=Date.parse(date+'T00:00:00Z');
   assert.equal(new Date(ms).toISOString().slice(0,10),date);
   return ms; // production-compatible timestamp, not Date object
  },
  wibToUTC(date,minute){return this.parseDate(date)+(minute-420)*MIN;}
 },
 createEngine(){
  const cache=new Map();
  return {
   get(ms){
    if(cache.has(ms))return cache.get(ms);
    const at=A.MakeTime(new Date(ms)),positions={};
    for(const id of bodies){
     const v=A.GeoVector(id,at,true);
     const e=A.Ecliptic(v);
     assert.ok(Number.isFinite(e.elon),'Longitude unavailable for '+id);
     positions[id]={lon:e.elon};
    }
    const result={ms,positions};
    cache.set(ms,result);
    return result;
   },
   clear(){cache.clear();}
  };
 }
};
async function main(){
 const date='2026-10-14';
 const week=SR.weekBounds(C,date);
 assert.equal(week.startWIB,'2026-10-12','Timestamp from production parseDate must work');
 const charts=SR.getReturns(C,A,date,12);
 assert.equal(charts.returns.length,3);
 for(const chart of charts.returns){
  assert.ok(chart.errorDegrees<0.00002,'Solar Return Sun must return to natal longitude');
  assert.equal(chart.bodies.length,10);
 }
 const r=await F.analyze(C,SR,A,date,12);
 assert.equal(r.rows.length,288);
 assert.equal(r.week.days.length,5);
 assert.equal(r.allowAutoTrade,false);
 assert.equal(r.tradeDecision,'WAIT');
 assert.ok(r.windows.every(w=>w.end-w.start<=90*MIN),
  'No planet should generate an all-day 5-minute timing window');
 assert.ok(r.rows.every(x=>x.tradeDecision==='WAIT'));
 assert.equal(F.exportResearch(r).validatedForXAUUSD,false);
 // Reproduce the user's 2030-10-14 screenshot with its 21:00 EST birth-hour assumption.
 const future=await F.analyze(C,SR,A,'2030-10-14',21);
 const context=F.dayContext(future.week,'2030-10-14');
 assert.equal(context.daily,'BUY','14 October 2030 daily should not be masked');
 assert.equal(context.weekly,'SELL','Weekly 3 SELL days outweigh two BUY days');
 assert.equal(context.relation,'BERLAWANAN');
 assert.deepEqual(future.week.days.map(d=>d.direction),
  ['BUY','BUY','SELL','SELL','SELL']);
 assert.ok(Math.abs(future.week.score-(-0.336))<0.02,
  'Score should reproduce 2030 screenshot under 21:00 EST');
 assert.equal(context.tradeDecision,'WAIT');
 const later=await F.analyze(C,SR,A,'2030-10-28',21);
 assert.equal(later.week.direction,'BUY',
  '2030 also contains BUY weeks; must not be all-SELL');
 console.log('2030 verified:',context,'days:',future.week.days.map(d=>d.direction),
  'score:',future.week.score,'28 Oct week:',later.week.direction);
 console.log('PASS: REAL ephemeris, solar longitude return, week date, 288 M5 slots, timing cap, no trading claims');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
