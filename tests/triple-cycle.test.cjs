'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const Astronomy=require('astronomy-engine');
const M=require('../assets/triple-cycle-core.js');
assert.equal(M.VERSION,'2.1.0');
assert.equal(M.PHASES.length,4);
assert.deepEqual(M.PHASES.map(x=>x.angle),[0,90,180,270]);
assert.equal(new Set(M.PHASES.map(x=>x.id)).size,4);
assert.equal(M.bounds('2026-10').start,Date.UTC(2026,9,1)-7*3600000);
assert.equal(M.bounds('2026-10').end,Date.UTC(2026,10,1)-7*3600000);
assert.throws(()=>M.bounds('2026-13'),/Pilih bulan/);
assert.throws(()=>M.bounds('2041-01'),/2020/);
assert.throws(()=>M.calculate(null,'2026-10'),/belum tersedia/);
assert.deepEqual(M.wib(Date.UTC(2026,9,11,12,30)),{date:'2026-10-11',time:'19:30',datetime:'2026-10-11 19:30 WIB'});
// Weekend bridge uses the exact WIB date, not UTC or the nearest trading session.
assert.equal(M.weekendBridge(Date.UTC(2026,9,9,12)),null); // Friday WIB
assert.equal(M.weekendBridge(Date.UTC(2026,9,10,12)).friday,'2026-10-09'); // Saturday WIB
assert.equal(M.weekendBridge(Date.UTC(2026,9,10,12)).monday,'2026-10-12');
assert.equal(M.weekendBridge(Date.UTC(2026,9,11,12)).friday,'2026-10-09'); // Sunday WIB
assert.equal(M.weekendBridge(Date.UTC(2026,9,11,12)).monday,'2026-10-12');
assert.equal(M.weekendBridge(Date.UTC(2026,9,30,18)).eventDate,'2026-10-31'); // Saturday in WIB, Friday UTC
assert.equal(M.weekendBridge(Date.UTC(2026,9,30,18)).monday,'2026-11-02');
assert.equal(M.weekendBridge(Date.UTC(2026,10,1,12)).friday,'2026-10-30'); // Month boundary
assert.equal(M.weekendBridge(Date.UTC(2026,10,1,12)).monday,'2026-11-02');
for(const month of ['2026-01','2026-02','2026-10','2028-02','2040-12']){
 const result=M.calculate(Astronomy,month),{start,end}=M.bounds(month);
 assert.equal(result.month,month);
 assert.equal(result.phases.length,4);
 assert.ok(result.moments.length>=3&&result.moments.length<=5);
 assert.equal(Object.values(result.counts).reduce((s,n)=>s+n,0),result.moments.length);
 assert.ok(result.moments.every(x=>x.ms>=start&&x.ms<end&&[0,90,180,270].includes(x.angle)));
 assert.ok(result.moments.every((x,i)=>!i||x.ms>result.moments[i-1].ms));
 assert.ok(result.moments.every(x=>x.wib.date.startsWith(month)));
 assert.ok(result.moments.every(x=>typeof x.name==='string'&&x.name.length>3));
 assert.ok(result.moments.every(x=>x.bridge===null||(
  x.bridge.eventDate===x.wib.date && x.bridge.friday<x.bridge.eventDate && x.bridge.monday>x.bridge.eventDate
 )));
 for(const e of result.moments){
   const utc=Astronomy.SearchMoonPhase(e.angle,new Date(e.ms-60000),1);
   assert.ok(Math.abs(+utc.date-e.ms)<1000,'Reproduction of astronomical phase timestamp');
 }
}
const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('assets/triple-cycle-ui.js','utf8');
const nav=fs.readFileSync('assets/bazi-ui.js','utf8');
assert.ok(html.includes('triple-cycle-core.js?v=2.1.0'));
assert.ok(html.includes('triple-cycle-ui.js?v=2.2.0'));
assert.ok(html.includes('astro-moment-bias.js?v=1.0.0'));
assert.ok(html.indexOf('astro-moment-bias.js')<html.indexOf('triple-cycle-ui.js'));
assert.ok(html.indexOf('triple-cycle-core.js')<html.indexOf('triple-cycle-ui.js'));
assert.ok(nav.includes("tabTriple.textContent='4 MOMEN ASTROLOGY'"));
assert.ok(nav.includes("activate('astroMonthlyView','momen-astrology','tabTriple')"));
assert.ok(nav.includes("#momen-astrology"));
assert.ok(ui.includes("view.id='astroMonthlyView'"));
assert.ok(ui.includes("cebonk:moon-monthly-open"));
assert.ok(ui.includes("Unduh CSV"));
assert.ok(ui.includes('JEMBATAN AKHIR PEKAN'));
assert.ok(ui.includes('pra_momen_jumat_wib'));
assert.ok(ui.includes('pasca_momen_senin_wib'));
assert.ok(ui.includes('bridgeHtml(event.bridge,result.biases?.[event.ms])'));
assert.ok(ui.includes('Dominasi model Astrology bulanan'));
assert.ok(ui.includes('bias_jumat_v1'));
assert.ok(ui.includes('bias_senin_v1'));
assert.ok(ui.includes('CebonkMomentBias'));
assert.ok(ui.includes('CebonkCore'));

assert.ok(!ui.includes("CebonkBazi")&&!ui.includes("CebonkNews"));
assert.ok(!ui.includes("TRIPLE CYCLE"));
assert.ok(!/[\u3400-\u9fff]/u.test(ui),'No Hanzi in new UI');
assert.ok(!html.includes('technical-scanners-ui.js'));
// The new bias adapter is independent of BaZi/Hisab and reuses injected V1 score logic.
const B=require('../assets/astro-moment-bias.js');
assert.equal(B.VERSION,'1.0.0');
assert.equal(B.label('BUY'),'DOMINAN BULLISH');
assert.equal(B.label('SELL'),'DOMINAN BEARISH');
assert.equal(B.label('MIXED'),'CAMPURAN');
const fakeCore={
 createEngine(){return {get(ms){return {ms};},clear(){}};},
 analyse(prev,now){
  const local=new Date(now.ms+7*3600000);
  const day=local.getUTCDay();
  return {score:day===1?-2:day===5?2:0};
 },
 classify(score){return score>=1.15?'BUY':score<=-1.15?'SELL':'NEUTRAL';}
};
const sun=Date.UTC(2026,9,11,12);
const weekend={ms:sun,bridge:M.weekendBridge(sun)};
const biases=B.calculate({},[weekend],fakeCore);
assert.equal(biases[sun].event.state,'NEUTRAL');
assert.equal(biases[sun].friday.state,'BUY');
assert.equal(biases[sun].monday.state,'SELL');
assert.equal(biases[sun].friday.slots,'18:00, 20:00, 22:00 WIB');
assert.equal(biases[sun].monday.slots,'06:00, 08:00, 10:00 WIB');
assert.equal(B.summary([weekend],biases).state,'MIXED');
assert.deepEqual(B.summary([weekend],biases).count,{BUY:0,SELL:0,NEUTRAL:1});
assert.equal(B.summary([weekend],{}).state,'UNAVAILABLE');
console.log('PASS: four Moon phases, WIB weekend bridge and Astrology V1 labels, no BaZi/Hijri dependencies.');
