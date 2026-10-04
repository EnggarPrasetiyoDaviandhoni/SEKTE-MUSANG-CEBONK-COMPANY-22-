'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const N=require('../assets/astro-news-v1.js');
const host=process.env.CEBONK_HOST||path.join(__dirname,'..','index.html');
const text=fs.readFileSync(host,'utf8');
const scripts=[...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const coreScript=scripts.find(s=>s.includes('root.CebonkCore=Core;'));
assert.ok(coreScript,'Host exposes the single original astronomy core');
const box={module:{exports:{}},setTimeout,console};vm.runInNewContext(coreScript,box);const C=box.module.exports;
let passes=0;
function test(name,fn){fn();passes++;console.log('PASS '+name);}
const M=60000,R=Date.parse('2026-10-02T12:30:00Z');
const cfg=(more={})=>({id:'nfp-20261002',name:'NFP test',releaseMs:R,pre:30,post:120,blockBefore:5,blockAfter:5,entrySpan:10,minWindow:15,confirmed:true,otherRisk:true,...more});
function samples(c,fn=()=>['SELL',-2]){
 const start=Math.floor((c.releaseMs-c.pre*M)/N.STEP)*N.STEP,end=Math.ceil((c.releaseMs+c.post*M)/N.STEP)*N.STEP,out=[];
 for(let ms=start;ms<end;ms+=N.STEP){const [state,score]=fn((ms-c.releaseMs)/M);out.push({ms,state,score,active:[]});}return out;
}
test('WIB -> UTC',()=>assert.equal(N.inputUTC('2026-10-02','19:30','WIB',C),R));
test('Luxor DST -> UTC',()=>assert.equal(N.inputUTC('2026-10-02','15:30','LUXOR',C),R));
test('New York daylight -> UTC',()=>assert.equal(N.inputUTC('2026-10-02','08:30','NEW_YORK',C),R));
test('New York standard -> UTC',()=>assert.equal(N.inputUTC('2026-11-06','08:30','NEW_YORK',C),Date.parse('2026-11-06T13:30:00Z')));
test('Reject nonexistent US DST hour',()=>assert.throws(()=>N.inputUTC('2026-03-08','02:30','NEW_YORK',C)));
test('Reject ambiguous US DST hour',()=>assert.throws(()=>N.inputUTC('2026-11-01','01:30','NEW_YORK',C)));
test('Reject malformed date',()=>assert.throws(()=>N.inputUTC('2026-02-30','08:30','WIB',C)));
test('Reject malformed time',()=>assert.throws(()=>N.inputUTC('2026-10-02','25:30','WIB',C)));
test('Luxor winter +2',()=>assert.equal(N.inputUTC('2026-11-06','15:30','LUXOR',C),Date.parse('2026-11-06T13:30:00Z')));
test('Confirmation required',()=>assert.throws(()=>N.validate(cfg({confirmed:false}))));
test('Parameter limits',()=>assert.throws(()=>N.validate(cfg({blockAfter:0}))));
test('Exact slot count, no truncation',()=>{const p=N.build(samples(cfg()),cfg());assert.equal(p.rows.length,30);assert.equal(p.start,R-30*M);assert.equal(p.end,R+120*M);});
test('NFP candidate begins after buffer, not release',()=>{const p=N.build(samples(cfg()),cfg());assert.equal(p.windows[0].start,R+5*M);assert.equal(p.windows[0].entryEnd,R+15*M);assert.equal(p.windows[0].lastNewSlot,R+10*M);});
test('Pre-news & release cannot be candidates',()=>{const p=N.build(samples(cfg()),cfg());for(const r of p.rows.filter(r=>r.ms<R+5*M))assert.ok(!r.policy.startsWith('KANDIDAT'));});
test('Continuation blocks new entries',()=>{const p=N.build(samples(cfg()),cfg());assert.equal(p.rows.find(r=>r.ms===R+15*M).policy,'CONTINUATION · NO NEW ENTRY');});
test('No invented second chance',()=>assert.equal(N.build(samples(cfg()),cfg()).windows.length,1));
test('Neutral produces no window',()=>{const p=N.build(samples(cfg(),()=>['NEUTRAL',0]),cfg());assert.equal(p.focus,'NEUTRAL');assert.equal(p.windows.length,0);});
test('Short run rejected',()=>{const p=N.build(samples(cfg(),m=>m>=5&&m<15?['SELL',-2]:['NEUTRAL',0]),cfg());assert.equal(p.windows.length,0);});
test('Single direction chosen by longer run',()=>{const p=N.build(samples(cfg(),m=>m<40?['BUY',2]:['SELL',-2]),cfg());assert.equal(p.focus,'SELL');assert.ok(p.rows.some(r=>r.policy==='BUY SKIP'));});
test('Exactly tied durations -> neutral',()=>{const c=cfg({post:65});const p=N.build(samples(c,m=>m<35?['BUY',2]:['SELL',-2]),c);assert.equal(p.focus,'NEUTRAL');});
test('Second window exists only after intervening neutral',()=>{const p=N.build(samples(cfg(),m=>m>=35&&m<45?['NEUTRAL',0]:['SELL',-2]),cfg());assert.equal(p.windows.length,2);assert.equal(p.windows[1].start,R+45*M);});
test('FOMC press conference adds separate risk block',()=>{const e=N.CALENDAR.find(e=>e.id==='fomc-20261028'),c=cfg({id:e.id,releaseMs:e.ms,name:e.name});const p=N.build(samples(c),c,N.CALENDAR);assert.equal(p.windows.length,2);assert.equal(p.windows[0].end,e.ms+25*M);assert.equal(p.windows[1].start,e.ms+35*M);});
test('Simultaneous GDP/PCE annotated without duplicate slots',()=>{const e=N.CALENDAR.find(e=>e.id==='gdp-20261029'),c=cfg({id:e.id,releaseMs:e.ms,name:e.name});const p=N.build(samples(c),c,N.CALENDAR);assert.equal(p.rows.length,30);assert.equal(p.rows.find(r=>r.ms===e.ms).risk.length,2);});
test('Manual release off 5m grid rounds safety outward',()=>{const c=cfg({releaseMs:R+2*M});const p=N.build(samples(c),c);assert.equal(p.windows[0].start,R+10*M);});
test('Missing slot fails closed',()=>assert.throws(()=>N.build(samples(cfg()).slice(1),cfg())));
test('Bad score fails closed',()=>{const rows=samples(cfg());rows[3].score=NaN;assert.throws(()=>N.build(rows,cfg()));});
test('All entry intervals avoid all risk intervals',()=>{const c=cfg();const other=[{id:'other',ms:R+45*M,name:'Other'}];const p=N.build(samples(c),c,other);for(const r of p.rows.filter(r=>r.policy.startsWith('KANDIDAT')))assert.equal(r.risk.length,0);});
test('Trade execution disabled in every plan',()=>{const p=N.build(samples(cfg()),cfg());assert.equal(p.executionEnabled,false);assert.equal(p.experimental,true);});
(async()=>{
 const lib=process.env.ASTRONOMY_MODULE;
 if(lib){
  const A=require(lib);const c=cfg();const p=await N.calculate(C,A,c,N.CALENDAR);
  test('Real Astronomy Engine scan has 30 complete slots',()=>assert.equal(p.rows.length,30));
  test('News uses unchanged host ephemeris score',()=>{const e=C.createEngine(A);for(const s of p.rows){const old=C.analyse(e.get(s.ms-N.STEP),e.get(s.ms),e.get(s.ms+N.STEP),true);assert.equal(s.score,old.score);assert.equal(s.positions.ASC.lon,old.positions.ASC.lon);}});
  console.log('REAL_EPHEMERIS',JSON.stringify({event:'NFP 2026-10-02',focus:p.focus,rows:p.rows.length,windows:p.windows.length,scoreFirst:p.rows[0].score,scoreLast:p.rows.at(-1).score}));
 }else console.log('SKIP real-ephemeris integration: ASTRONOMY_MODULE not provided (no substitutes).');
 console.log('TOTAL_PASS',passes);
})().catch(e=>{console.error(e);process.exit(1);});
