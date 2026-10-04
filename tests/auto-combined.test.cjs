'use strict';
const assert=require('node:assert/strict'),A=require('../assets/auto-combined-core.js');
let pass=0;const t=(name,fn)=>{fn();pass++;console.log('PASS '+name);};
const M=60000,T=Date.parse('2026-10-02T12:00:00Z');
function bar(i,o,h,l,c,step=M){return {ms:T+i*step,end:T+(i+1)*step,open:o,high:h,low:l,close:c};}
// Synthetic candles only. Not a trading performance/backtest claim.
const raw=[
[110,111,109,110.5],[111,112,110,111.5],[112,114,111,113],[113,115,112,114],
[112,113,111,111.5],[111,112,110,110.5],[110,111,109,110],
[111,113,110,112],[112,114,111,113],[114,115,113,114.5],[115,117,114,116],
[116,116.5,112,113],[113,114,111,112],[112,113,109.5,110],
[110,111,107,108],[108,115.5,107.5,114]];
const b=raw.map((r,i)=>bar(i,...r)),now=b.at(-1).end+1000;
t('UTC conversion',()=>assert.equal(A.localUTC('2026-10-02 12:30:00'),T+30*M));
t('Reject date normalization',()=>assert.throws(()=>A.localUTC('2026-02-30')));
t('Sydney calendar date is not UTC midnight',()=>assert.equal(A.localUTC('2026-10-05','Australia/Sydney'),Date.parse('2026-10-04T13:00:00Z')));
t('Month end uses actual calendar length',()=>assert.equal(A.calendarEnd('2026-02-01','MN1','UTC'),Date.parse('2026-03-01T00:00:00Z')));
const payload={ok:true,symbol:'XAU/USD',interval:'1min',timezone:'UTC',values:b.map(c=>({...c,datetime:new Date(c.ms).toISOString().replace('T',' ').slice(0,19)}))};
t('Remove forming candle',()=>assert.equal(A.parse(payload,'M1',b.at(-1).ms+1).length,b.length-1));
t('Wrong symbol rejected',()=>assert.throws(()=>A.parse({...payload,symbol:'XAUUSDc'},'M1',now)));
t('Wrong interval rejected',()=>assert.throws(()=>A.parse({...payload,interval:'5min'},'M1',now)));
t('Null OHLC rejected',()=>assert.throws(()=>A.parse({...payload,values:[{...payload.values[0],close:null}]},'M1',now)));
t('Duplicate timestamp rejected',()=>assert.throws(()=>A.parse({...payload,values:[payload.values[0],payload.values[0]]},'M1',now)));
t('Contradictory high rejected',()=>assert.throws(()=>A.parse({...payload,values:[{...payload.values[0],high:1}]},'M1',now)));
t('Calendar timezone required',()=>assert.throws(()=>A.parse({...payload,interval:'1day'},'D1',now)));
t('Pivots only known after right candles close',()=>A.pivots(b).forEach(p=>assert.equal(p.knownAt,b[p.i+2].end)));
const s=A.patterns(b).find(s=>s.direction==='SELL');
t('Automatic separate Zone IB and CB1',()=>{assert.ok(s);assert.ok(s.cb1<s.zone.low);assert.equal(s.verified,undefined);});
t('No direct CB1-touch entry',()=>{const r=A.evaluate(s,b.slice(0,14),b[13].end+1);assert.equal(r.stage,'WAIT_CB1_BREAK');});
t('Break alone waits for retest',()=>assert.equal(A.evaluate(s,b.slice(0,15),b[14].end+1).stage,'WAIT_RETEST'));
const r=A.evaluate(s,b,now);
t('Subsequent retest produces observation',()=>assert.equal(r.stage,'RETEST_VALID'));
t('Fibo anchored to first break close',()=>assert.equal(r.fib100,b[14].close));
t('TP ratios are exactly PDF references',()=>assert.deepEqual(r.targets.map(t=>t.ratio),[1.618,2.618,4.23]));
t('Old retest expires, never held five bars',()=>assert.equal(A.evaluate(s,b,now+M).stage,'EXPIRED'));
t('Gap in active structure blocks',()=>assert.equal(A.evaluate(s,b.filter((c,i)=>i!==13),now).stage,'DATA_GAP'));
t('Retest and SL in same candle ambiguous',()=>{const c=b.map(x=>({...x}));c.at(-1).high=s.sl+1;c.at(-1).close=115;assert.equal(A.evaluate(s,c,now).stage,'AMBIGUOUS');});
t('Zone-close invalidation blocks',()=>{const c=b.map(x=>({...x}));c[13].close=119;c[13].high=120;assert.equal(A.evaluate(s,c,now).stage,'INVALID');});
const mirror=b.map(c=>({...c,open:230-c.open,high:230-c.low,low:230-c.high,close:230-c.close}));
t('BUY/SELL symmetry',()=>assert.equal(A.musang(mirror,'M1',now).setup.direction,'BUY'));
const z={id:'H4:SUPPLY:1',tf:'H4',kind:'SUPPLY',low:114.5,high:117,sourceMs:T-10*M,bornAt:T,formation:'RBD',initialDeparted:true};
const visits=[bar(0,110,111,109,110),bar(1,114,115,113,114),bar(2,114,115,113,114),bar(3,110,111,109,110),bar(4,114,115,113,114)];
t('Fresh when never touched after departure',()=>assert.equal(A.life(z,visits.slice(0,1)).status,'FRESH'));
t('Touch episodes counted, not candles',()=>assert.equal(A.life(z,visits.slice(0,3)).tests,1));
t('Second independent visit counts twice',()=>assert.equal(A.life(z,visits).tests,2));
t('First post-departure candle touch counts',()=>assert.equal(A.life(z,[bar(0,114,115,113,114)]).tests,1));
t('Broken invalid for original side',()=>assert.equal(A.life(z,[bar(0,116,119,115,118)]).status,'BROKEN'));
const active={...z,status:'FRESH',tests:0},key={id:'W1:prevH',tf:'W1',price:116,sourceMs:T-20*M,knownAt:T,label:'W1 previous high'};
t('Key confluence automatic',()=>assert.ok(A.context([active],[key],'SELL',115,T+M).selected));
t('Own pivot is not independent confluence',()=>assert.equal(A.context([active],[{...key,tf:z.tf,sourceMs:z.sourceMs}],'SELL',115,T+M).selected,null));
t('Repeated-tested locations skipped',()=>assert.equal(A.context([{...active,tests:2}],[key],'SELL',115,T+M).selected,null));
t('Broken locations skipped',()=>assert.equal(A.context([{...active,status:'BROKEN'}],[key],'SELL',115,T+M).selected,null));
t('Locations born after event do not qualify',()=>assert.equal(A.context([{...active,bornAt:T+10*M}],[key],'SELL',115,T+M).selected,null));
t('Key known after event does not qualify',()=>assert.equal(A.context([active],[{...key,knownAt:T+10*M}],'SELL',115,T+M).selected,null));
t('Nested counts distinct timeframes only',()=>assert.deepEqual(A.context([active,{...active,id:'wide',tf:'D1',low:113,high:120}],[key],'SELL',115,T+M).candidates.find(z=>z.tf==='H4').nested,['D1']));
const astro={model:true,groups:[{state:'SELL',start:T-100*M,end:T+100*M}]},ctx=A.context([active],[key],'SELL',r.entry,r.eventStart);
t('Combined complete agreement',()=>assert.equal(A.combine(r,astro,ctx,now,true,['H4']).decision,'ENTRY SELL'));
t('Partial coverage is explicit not fabricated',()=>assert.deepEqual(A.combine(r,astro,ctx,now,true,['H4']).coverage,['H4']));
t('Stale data prevents combined entry',()=>assert.equal(A.combine(r,astro,ctx,now,false,['H4']).decision,'WAIT'));
t('Missing astrology prevents combined entry',()=>assert.equal(A.combine(r,null,ctx,now,true,['H4']).decision,'WAIT'));
t('Opposite astrology prevents combined entry',()=>assert.equal(A.combine(r,{model:true,groups:[{...astro.groups[0],state:'BUY'}]},ctx,now,true,['H4']).decision,'WAIT'));
t('Opposing HTF zone blocks',()=>assert.equal(A.combine(r,astro,{...ctx,opposed:[{kind:'DEMAND'}]},now,true,['H4']).decision,'WAIT'));
t('No location/key prevents combined entry',()=>assert.equal(A.combine(r,astro,{selected:null,opposed:[]},now,true,['H4']).decision,'WAIT'));
t('No order capability',()=>assert.equal(A.combine(r,astro,ctx,now,true,['H4']).executionEnabled,false));
const bases=[bar(0,110,114,109,113),bar(1,113,114,112,113.2),bar(2,113.2,114,112.5,113.4),bar(3,113,120,112.8,119),bar(4,119,121,118,120),bar(5,116,118,113,115)];
t('RBR demand detected without manual prices',()=>assert.ok(A.zones(bases,'H1').some(z=>z.kind==='DEMAND'&&z.formation==='RBR')));
t('As-of scan cannot use future departure',()=>assert.equal(A.zones(bases,'H1',bases[2].end).filter(z=>z.kind==='DEMAND').length,0));
console.log('TOTAL_PASS',pass);
module.exports={b,now,payload};
