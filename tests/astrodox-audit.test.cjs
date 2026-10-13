'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const A=require('../assets/astrodox-audit.js');
const t=Date.parse('2026-10-14T01:00:00Z');
const result={range:{date:'2026-10-14',start:Date.parse('2026-10-13T17:00:00Z'),end:Date.parse('2026-10-14T17:00:00Z')},
 events:[{id:'moon-sun',pair:['Sun','Moon'],angle:0,name:'Konjungsi',
  start:t-3600000,closest:t,end:t+3600000,closestOrb:0,exactTimes:[t],
  startClipped:false,endClipped:false}]};
assert.equal(A.format(Date.parse('2026-10-14T00:00:00Z'),A.NEW_YORK),'2026-10-13 20:00:00 New York',
 'October New York DST is UTC-4');
assert.equal(A.format(Date.parse('2026-11-02T00:00:00Z'),A.NEW_YORK),'2026-11-01 19:00:00 New York',
 'November New York standard time is UTC-5');
assert.equal(A.format(Date.parse('2026-10-14T00:00:00Z')),'2026-10-14 07:00:00 WIB');
assert.equal(A.isoDate(Date.parse('2026-10-13T23:00:00Z')),'2026-10-14');
const r=A.build(result,()=> 'BUY');
assert.equal(r.status,'WAIT','unvalidated BUY must be blocked');
assert.equal(r.validated,false);assert.equal(r.hypothesis,'BUY');
assert.equal(r.rows.length,1);assert.equal(r.rows[0].decision,'WAIT');
assert.equal(r.rows[0].phase,'EXACT');assert.equal(r.rows[0].exact,true);
assert.ok(A.csv(r).includes('harga_masuk_ISI_MANUAL'));
assert.ok(A.csv(r).includes('"WAIT"'));
assert.ok(!A.csv(r).includes('WINRATE'),'no winrate invented');
const noExact={...result,events:[{...result.events[0],exactTimes:[],closestOrb:0.8,startClipped:true}]};
const n=A.build(noExact,()=> 'SELL');
assert.equal(n.hypothesis,'SELL');assert.equal(n.status,'WAIT');
assert.equal(n.rows[0].phase,'TANPA INTI ≤0,5°');
assert.equal(n.rows[0].clipped,true);
assert.equal(A.build({...result,events:[]},()=> 'BUY').status,'WAIT');
assert.throws(()=>A.build({},()=> 'BUY'),/Data aspek/);
assert.throws(()=>A.build(result,null),/Pembanding/);
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const router=fs.readFileSync(path.join(root,'assets/site-tab-router.js'),'utf8');
assert.match(html,/assets\/astrodox-audit\.js/);
assert.match(router,/tabAstrodoxAudit:'astrodoxAuditView'/);
assert.match(router,/'astrodox-audit':'tabAstrodoxAudit'/);
console.log('ASTRODOX audit REV-01: timezones, WAIT gating, CSV and wiring OK');
