'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),W=require('../assets/astro-weekly-core.js');
const minute=60000;
assert.equal(W.monday('2026-10-09'),'2026-10-05');
assert.equal(W.monday('2026-10-04'),'2026-09-28');
const days=W.weekDates('2026-10-09');
assert.deepEqual(days.map(d=>d.date),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
assert.throws(()=>W.weekDates('2020-01-01'),/rentang/);
assert.throws(()=>W.monday('2026-02-30'),/kalender/);
assert.throws(()=>W.monday('2026-10-xx'),/tanggal/);
function daily(d,kind='BUY',buyN=144){
 const start=Date.parse(d.date+'T00:00:00Z')-60*minute;
 return {...d,samples:Array.from({length:216},(_,i)=>{
  const dir=kind==='NONE'?'NEUTRAL':(i<buyN?'BUY':'SELL');
  return {ms:start+i*5*minute,state:kind==='BEAR'?(dir==='BUY'?'SELL':'BUY'):dir,score:dir==='BUY'?2:-2};
 })};
}
const normal=days.map((d,i)=>daily(d,'BUY',[144,145,110,150,145][i]));
const report=W.summarize(normal);
assert.equal(report.totalSlots,1080);
assert.equal(report.direction,'BUY');
assert.equal(report.buyMinutes,694*5);
assert.equal(report.sellMinutes,386*5);
assert.equal(report.days.length,5);
assert.equal(report.days[0].dominant,'BUY');
assert.equal(report.best.weekday,'Kamis');
assert.equal(new Date(report.best.start).toISOString(),'2026-10-07T23:00:00.000Z'); // Kamis 06:00 WIB
assert.equal(report.best.minutes,750);
assert.equal(report.days[3].best.minutes,750);
const bear=W.summarize(normal.map(d=>({...d,samples:d.samples.map(x=>({...x,state:x.state==='BUY'?'SELL':'BUY'}))})));
assert.equal(bear.direction,'SELL');
assert.equal(bear.best.direction,'SELL');
const empty=W.summarize(days.map(d=>daily(d,'NONE')));
assert.equal(empty.direction,'TIDAK ADA ARAH');
assert.equal(empty.best,null);
const mixed=W.summarize(days.map(d=>daily(d,'BUY',108)));
assert.equal(mixed.direction,'CAMPURAN');
assert.equal(mixed.best,null);
assert.throws(()=>W.summarize(normal.slice(0,4)),/lima hari/);
assert.throws(()=>W.summarize(normal.map((d,i)=>i===2?{...d,samples:d.samples.slice(0,-1)}:d)),/belum lengkap/);
assert.throws(()=>W.summarize(normal.map((d,i)=>i===2?{...d,samples:d.samples.map((s,j)=>j===10?{...s,ms:s.ms+minute}:s)}:d)),/tidak berurutan/);
(async()=>{
 let visited=[];
 const scan=await W.scanWeek('2026-10-09',async date=>{visited.push(date);return normal.find(x=>x.date===date).samples;});
 assert.equal(scan.direction,'BUY');assert.deepEqual(visited,days.map(x=>x.date));
 await assert.rejects(W.scanWeek('2026-10-09',async ()=>[],undefined,()=>true),/dibatalkan/);
 const html=fs.readFileSync('index.html','utf8');
 assert.ok(html.includes('assets/astro-weekly-core.js')&&html.includes('assets/astro-weekly-ui.js'));
 assert.ok(!html.includes('technical-scanners-ui'));
 const ui=fs.readFileSync('assets/astro-weekly-ui.js','utf8');
 assert.ok(!/[\u3400-\u9fff]/.test(ui),'No Mandarin glyphs in weekly interface');
 assert.ok(ui.includes('TIDAK ADA ARAH')&&ui.includes('06.00–24.00 WIB'));
 assert.ok(ui.includes('XAUUSD')&&ui.includes('XAGUSD'));
 console.log('PASS: weekday dates, weekly and daily dominances, window ranking, complete 5m slots, model caveats and integration.');
})().catch(e=>{console.error(e);process.exitCode=1;});
