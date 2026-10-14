'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const F=require('../assets/solar-return-only-trend-core.js');
const OldSR=require('../assets/astrodox-comex-solar-return-core.js');
const STEP=5*60000,TARGET=Date.parse('2026-10-14T03:00:00Z');

const chart={year:2025,ms:Date.UTC(2025,11,31),utc:'2025-12-31T00:00:00.000Z',
 bodies:['Sun','Moon','Venus','Jupiter'].map((id,i)=>({id,longitude:i*30}))};
const point=(v,j,m,s)=>({Venus:{lon:v},Jupiter:{lon:j},Mars:{lon:m},Saturn:{lon:s}});
const score=(v,j,m,s)=>F.scoreAt(point(v,j,m,s),chart);
assert.equal(score(145,145,120,245).direction,'SELL','Trine Mars tidak otomatis BUY');
assert.equal(score(90,145,245,245).direction,'BUY','Square Venus tidak otomatis SELL');
assert.equal(score(145,145,245,245).direction,'WAIT','Tanpa aspek harus WAIT');
assert.equal(F.classify(0,0),'WAIT');
assert.equal(F.classify(0.17,1),'WAIT');
assert.equal(F.classify(-0.5,1),'SELL');

const C={Time:{
 parseDate(d){
  assert.match(d,/^\d{4}-\d{2}-\d{2}$/);
  const n=Date.parse(d+'T00:00:00Z');
  assert.ok(Number.isFinite(n));
  assert.equal(new Date(n).toISOString().slice(0,10),d,'Tanggal tidak sah');
  return n;
 },
 wibToUTC(d,mins){return Date.parse(d+'T00:00:00Z')+(mins-420)*60000;}
},createEngine(){
 return {get(ms){return {positions:point((ms-TARGET)/STEP*0.003,145,245,245)};},clear(){}};
}};
const week=F.weekWindow(C,'2026-10-14');
assert.equal(week.startWIB,'2026-10-12');
assert.equal(week.endWIB,'2026-10-18');
assert.equal(OldSR.weekBounds(C,'2026-10-14').startWIB,'2026-10-12',
 'Bug day.getUTCDay is not a function must never return');
const stationary=F.scoreAt(point(0,145,245,245),chart,point(0,145,245,245));
assert.ok(stationary.events.every(e=>!e.timingEligible),'Stationary aspect never qualifies as 5m timing');
const close=F.scoreAt(point(0.015,145,245,245),chart,point(0.018,145,245,245));
assert.ok(close.events.some(e=>e.timingEligible),'Moving, near-exact aspect can qualify');

const days=Array.from({length:5},(_,i)=>({
 dateWIB:'2026-10-'+(12+i),positive:i<3?1:0,negative:i>=3?.2:0,
 score:i<3?1:-1,direction:i<3?'BUY':'SELL',activity:1,activeSlots:4}));
assert.equal(F.summarizeWeek(days).direction,'BUY');
const mixed=days.map((d,i)=>i===2?{...d,positive:0,negative:0,
 score:0,direction:'WAIT',activity:0}:d);
assert.equal(F.summarizeWeek(mixed).direction,'WAIT');
const example=F.dayContext(F.summarizeWeek(days),'2026-10-14');
assert.equal(example.daily,'BUY');
assert.equal(example.weekly,'BUY');
assert.equal(example.relation,'SEARAH');
const sellDay=F.dayContext(F.summarizeWeek(days),'2026-10-16');
assert.equal(sellDay.daily,'SELL');
assert.equal(sellDay.weekly,'BUY');
assert.equal(sellDay.tradeDecision,'WAIT');
const opposing=F.dayContext({...F.summarizeWeek(days),direction:'SELL'},'2026-10-14');
assert.equal(opposing.daily,'BUY');
assert.equal(opposing.weekly,'SELL');
assert.equal(opposing.relation,'BERLAWANAN');
assert.equal(opposing.priceTrendValidated,false);
assert.throws(()=>F.summarizeWeek(days.slice(1)),/Senin sampai Jumat/);

const SR={getReturns(){return {
 natalUTC:'1974-12-31T17:00:00.000Z',hourNY:12,returns:[chart]
};}};

async function testIntegration(){
 const result=await F.analyze(C,SR,{},'2026-10-14');
 assert.equal(result.week.direction,'BUY');
 assert.equal(result.rows.length,288);
 assert.equal(result.rows[0].signal,'WAIT','Konfirmasi harus butuh 2 candle M5');
 assert.ok(result.rows.some(r=>r.signal==='BUY'),'Near-exact moving event must appear');
 assert.ok(result.rows.filter(r=>r.signal==='BUY').length<=18,
  'Single planetary event must not produce all-day 5m bias');
 assert.equal(result.windows.length,1,'One event ID can open once per day');
 assert.ok(result.windows[0].end-result.windows[0].start<=90*60000,
  'Each window capped at 90m');
 assert.ok(result.windows[0].end>result.windows[0].start);
 const exportData=F.exportResearch(result);
 assert.equal(exportData.allowAutoTrade,false);
 assert.equal(exportData.tradeDecision,'WAIT');
 assert.equal(exportData.validatedForXAUUSD,false);
 assert.equal(exportData.schema,'CEBONK_SOLAR_RETURN_ONLY_RESEARCH_V3_2');
 assert.ok(exportData.rows.every(r=>r.tradeDecision==='WAIT'));
 assert.ok(exportData.rows.every(r=>!Object.hasOwn(r,'signal')),
  'EA exports must not contain an actionable signal field');
 const saturday=await F.analyze(C,SR,{},'2026-10-17');
 assert.ok(saturday.rows.every(r=>r.signal==='WAIT'),'Weekend wajib WAIT');
 await assert.rejects(F.analyze(C,SR,{},'2026-10-14',12,()=>{},()=>true),/dibatalkan/);

 const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 const router=fs.readFileSync(path.join(ROOT,'assets/site-tab-router.js'),'utf8');
 const ui=fs.readFileSync(path.join(ROOT,'assets/solar-return-only-trend-ui.js'),'utf8');
 assert.ok(html.includes('id="tabSolarReturnOnly"'));
 assert.ok(html.includes('id="solarReturnOnlyView"'));
 assert.ok(html.includes('id="tabAstro" type="button"')||html.includes('id="tabAstro"'), 'ASTROLOGI tab preserved');
 assert.ok(html.includes('id="tabAlBiruni"'), 'Al-Biruni tab preserved');
 assert.ok(html.includes('id="solarReturnOnlyView" aria-label="Solar Return murni untuk riset astrologi, tidak tervalidasi sebagai tren harga" hidden'), 'Solar Return no longer hijacks homepage');
 assert.ok(html.includes('<div id="astroView">'), 'Homepage must show original ASTROLOGI tab');
 assert.ok(!html.includes('src="assets/astrodox-comex-solar-return-ui.js'),
  'Old broken panel must not be mounted');
 assert.ok(!html.includes('id="modelEnabled" type="checkbox" checked'),
  'Legacy V1 should not expose BUY/SELL by default');
 assert.ok(html.includes('solar-return-only-trend-core.js?v=3.2.0'));
 assert.ok(html.includes('solar-return-only-trend-ui.js?v=3.2.0'));
 assert.ok(router.includes("tabSolarReturnOnly:'solarReturnOnlyView'"));
 assert.ok(router.includes("'solar-return-only':'tabSolarReturnOnly'"));
 assert.ok(ui.includes('id="srOnlyWeekBias"'));
 assert.ok(ui.includes('F.dayContext(w,r.dateWIB)'));
 assert.ok(!ui.includes('CebonkAstrodoxM1'),'Mode SR tak boleh membaca Astro V2');
 assert.ok(!ui.includes('CebonkEventPolarityM1'),'Mode SR tak boleh membaca EventPolarity');
 new Function(ui);
 console.log('PASS: Solar Return v3.1 safety — direction, confirmation, weekdays, exports, cancellation, isolated tab');
}
testIntegration().catch(e=>{console.error(e);process.exitCode=1;});
