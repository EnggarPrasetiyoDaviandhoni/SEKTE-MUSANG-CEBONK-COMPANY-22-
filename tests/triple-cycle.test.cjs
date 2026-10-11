'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const Astronomy=require('astronomy-engine');
const M=require('../assets/triple-cycle-core.js');
assert.equal(M.VERSION,'2.0.0');
assert.equal(M.PHASES.length,4);
assert.deepEqual(M.PHASES.map(x=>x.angle),[0,90,180,270]);
assert.equal(new Set(M.PHASES.map(x=>x.id)).size,4);
assert.equal(M.bounds('2026-10').start,Date.UTC(2026,9,1)-7*3600000);
assert.equal(M.bounds('2026-10').end,Date.UTC(2026,10,1)-7*3600000);
assert.throws(()=>M.bounds('2026-13'),/Pilih bulan/);
assert.throws(()=>M.bounds('2041-01'),/2020/);
assert.throws(()=>M.calculate(null,'2026-10'),/belum tersedia/);
assert.deepEqual(M.wib(Date.UTC(2026,9,11,12,30)),{date:'2026-10-11',time:'19:30',datetime:'2026-10-11 19:30 WIB'});
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
 for(const e of result.moments){
   const utc=Astronomy.SearchMoonPhase(e.angle,new Date(e.ms-60000),1);
   assert.ok(Math.abs(+utc.date-e.ms)<1000,'Reproduction of astronomical phase timestamp');
 }
}
const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('assets/triple-cycle-ui.js','utf8');
const nav=fs.readFileSync('assets/bazi-ui.js','utf8');
assert.ok(html.includes('triple-cycle-core.js?v=2.0.0'));
assert.ok(html.includes('triple-cycle-ui.js?v=2.0.0'));
assert.ok(html.indexOf('triple-cycle-core.js')<html.indexOf('triple-cycle-ui.js'));
assert.ok(nav.includes("tabTriple.textContent='4 MOMEN ASTROLOGY'"));
assert.ok(nav.includes("activate('astroMonthlyView','momen-astrology','tabTriple')"));
assert.ok(nav.includes("#momen-astrology"));
assert.ok(ui.includes("view.id='astroMonthlyView'"));
assert.ok(ui.includes("cebonk:moon-monthly-open"));
assert.ok(ui.includes("Unduh CSV"));
assert.ok(!ui.includes("CebonkBazi")&&!ui.includes("CebonkNews")&&!ui.includes("CebonkCore"));
assert.ok(!ui.includes("TRIPLE CYCLE"));
assert.ok(!/[\u3400-\u9fff]/u.test(ui),'No Hanzi in new UI');
assert.ok(!html.includes('technical-scanners-ui.js'));
console.log('PASS: pure 4 Moon moments, WIB, month edge cases, distinct view, no BaZi/Hijri/trading dependencies.');
