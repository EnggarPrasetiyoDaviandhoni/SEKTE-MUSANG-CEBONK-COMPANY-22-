'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const F=require('../assets/solar-return-only-trend-core.js');

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
 return {get(){return {positions:point(0,145,245,245)};},clear(){}};
}};
const week=F.weekWindow(C,'2026-10-14');
assert.equal(week.startWIB,'2026-10-12');
assert.equal(week.endWIB,'2026-10-18');

const days=Array.from({length:5},(_,i)=>({
 dateWIB:'2026-10-'+(12+i),positive:i<3?1:0,negative:i>=3?.2:0,
 score:i<3?1:-1,direction:i<3?'BUY':'SELL',activity:1,activeSlots:4}));
assert.equal(F.summarizeWeek(days).direction,'BUY');
const mixed=days.map((d,i)=>i===2?{...d,positive:0,negative:0,
 score:0,direction:'WAIT',activity:0}:d);
assert.equal(F.summarizeWeek(mixed).direction,'WAIT');
assert.throws(()=>F.summarizeWeek(days.slice(1)),/Senin sampai Jumat/);

const SR={getReturns(){return {
 natalUTC:'1974-12-31T17:00:00.000Z',hourNY:12,returns:[chart]
};}};

async function testIntegration(){
 const result=await F.analyze(C,SR,{},'2026-10-14');
 assert.equal(result.week.direction,'BUY');
 assert.equal(result.rows.length,288);
 assert.equal(result.rows[0].signal,'WAIT','Konfirmasi harus butuh 2 candle M5');
 assert.equal(result.rows[1].signal,'BUY');
 assert.equal(result.windows.length,1);
 assert.ok(result.windows[0].end>result.windows[0].start);
 const exportData=F.exportResearch(result);
 assert.equal(exportData.allowAutoTrade,false);
 assert.equal(exportData.tradeDecision,'WAIT');
 assert.equal(exportData.validatedForXAUUSD,false);
 const saturday=await F.analyze(C,SR,{},'2026-10-17');
 assert.ok(saturday.rows.every(r=>r.signal==='WAIT'),'Weekend wajib WAIT');
 await assert.rejects(F.analyze(C,SR,{},'2026-10-14',12,()=>{},()=>true),/dibatalkan/);

 const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 const router=fs.readFileSync(path.join(ROOT,'assets/site-tab-router.js'),'utf8');
 const ui=fs.readFileSync(path.join(ROOT,'assets/solar-return-only-trend-ui.js'),'utf8');
 assert.ok(html.includes('id="tabSolarReturnOnly"'));
 assert.ok(html.includes('id="solarReturnOnlyView"'));
 assert.ok(html.includes('solar-return-only-trend-core.js?v=3.0.0'));
 assert.ok(html.includes('solar-return-only-trend-ui.js?v=3.0.0'));
 assert.ok(router.includes("tabSolarReturnOnly:'solarReturnOnlyView'"));
 assert.ok(router.includes("'solar-return-only':'tabSolarReturnOnly'"));
 assert.ok(!ui.includes('CebonkAstrodoxM1'),'Mode SR tak boleh membaca Astro V2');
 assert.ok(!ui.includes('CebonkEventPolarityM1'),'Mode SR tak boleh membaca EventPolarity');
 new Function(ui);
 console.log('PASS: Solar Return only V3 — direction, confirmation, weekdays, exports, cancellation, isolated tab');
}
testIntegration().catch(e=>{console.error(e);process.exitCode=1;});
