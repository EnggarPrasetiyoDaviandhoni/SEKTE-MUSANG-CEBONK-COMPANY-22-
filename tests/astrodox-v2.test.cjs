'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const V=require('../assets/astrodox-v2-core.js');
const base=Date.UTC(2026,9,14,0),step=300000;
const CFG={
 planets:[
  {id:'Venus',nature:1,weight:1},{id:'Jupiter',nature:1.2,weight:1},
  {id:'Mars',nature:-1,weight:1},{id:'Saturn',nature:-1.2,weight:1}],
 aspects:[
  {name:'Square',angle:90,orb:2,weight:1.25},
  {name:'Trine',angle:120,orb:2,weight:1.2}]
};
const aspect=(id1,id2,local=false,name='Square',angle=90,orb=0,phase='EXACT')=>
 ({id1,id2,local,name,angle,orb,phase,impact:local?0:-999});
const plus=()=>aspect('Venus','Jupiter');
const minus=()=>aspect('Mars','Saturn');
const angle=()=>aspect('Venus','ASC',true);
const mk=(items)=>items.map((active,i)=>({ms:base+i*step,active,score:-100}));
const data=mk([[plus(),angle()],[plus(),angle()],[plus(),angle()],
 [plus()],[minus(),angle()],[minus(),angle()],[minus(),angle()]]);
const a=V.evaluate(data,CFG);
assert.equal(a.version,'2.0.0');
assert.equal(a.source,'CEBONK_ASTRONOMY_ONLY');
assert.equal(a.validatedForXAUUSD,false);
assert.equal(a.tradeDecision,'WAIT');
assert.deepEqual(a.rows.map(r=>r.state),['WAIT','WAIT','BUY','WAIT','WAIT','WAIT','SELL']);
assert.equal(a.rows[2].raw,'BUY','square must NOT automatically generate SELL');
assert.equal(a.rows[6].raw,'SELL','negative planetary natures may imply negative astrology direction');
assert.equal(a.rows[6].event.angle,'ASC','ASC event only times the already established direction');
assert.equal(a.rows[6].nLocal,1);
assert.equal(a.rows[6].nPlanet,1);
assert.equal(a.buyMinutes,5);
assert.equal(a.sellMinutes,5);
assert.equal(a.focus,'WAIT');
assert.equal(a.reversals,1);
assert.equal(a.windows[0].start,base+2*step,'AWAL never backdated before confirmation');
assert.equal(a.windows[0].core,base+2*step);
assert.equal(a.windows[0].end,base+3*step);
assert.equal(a.windows[1].start,base+6*step);
assert.ok(a.rows[2].intensity>50);
assert.ok(a.rows[3].localPct===0);
const sameSignTrine=V.evaluate(mk([[aspect('Mars','Saturn',false,'Trine',120),angle()],
 [aspect('Mars','Saturn',false,'Trine',120),angle()],
 [aspect('Mars','Saturn',false,'Trine',120),angle()]]),CFG);
assert.equal(sameSignTrine.rows.at(-1).state,'SELL','trine alone must NOT force BUY');
const onlyAngle=V.evaluate(mk([[angle()],[angle()],[angle()]]),CFG);
assert.equal(onlyAngle.focus,'WAIT','local event without global astrology bias must NOT force direction');
assert.equal(onlyAngle.rows[2].directionScore,null);
const noAngle=V.evaluate(mk([[plus()],[plus()],[plus()]]),CFG);
assert.ok(noAngle.rows.every(r=>r.state==='WAIT'),'planetary bias without ASC/MC event must not trigger');
const p70=V.evaluate(data,CFG,{localShare:0.70});
assert.ok(p70.rows[2].intensity>a.rows[2].intensity,'70% changes timing intensity only');
assert.equal(p70.rows[2].directionScore,a.rows[2].directionScore,'timing weight never changes astro direction');
const tooHigh=V.evaluate(data,CFG,{intensityThreshold:100});
assert.ok(tooHigh.rows.every(r=>r.state==='WAIT'),'threshold must actively block weak triggers');
for(let i=1;i<=data.length;i++){
 const prefix=V.evaluate(data.slice(0,i),CFG);
 assert.deepEqual(prefix.rows,a.rows.slice(0,i),'earlier slots may not depend on future slots');
}
assert.throws(()=>V.evaluate([],CFG),/Sampel/);
assert.throws(()=>V.evaluate(mk([[plus()]]),CFG,{localShare:1.1}),/Porsi lokal/);
assert.throws(()=>V.evaluate(mk([[plus()]]),CFG,{confirmBars:0}),/Konfirmasi/);
assert.throws(()=>V.evaluate([{ms:base,active:[]},{ms:base+60000,active:[]}],CFG),/grid/);
assert.throws(()=>V.evaluate(mk([[aspect('Venus','UFO')]]),CFG),/tidak dikenal/);
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const router=fs.readFileSync(path.join(root,'assets/site-tab-router.js'),'utf8');
const v1=fs.readFileSync(path.join(root,'assets/astrodox-follow-trend-core.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'assets/astrodox-v2-ui.js'),'utf8');
assert.match(html,/id="tabAstroV2"/);
assert.match(html,/id="astroV2View"/);
assert.match(html,/assets\/astrodox-v2-core\.js/);
assert.match(html,/assets\/astrodox-v2-ui\.js/);
assert.match(html,/assets\/astrodox-v2\.css/);
assert.match(router,/tabAstroV2:'astroV2View'/);
assert.match(router,/'astrodox-v2':'tabAstroV2'/);
assert.match(ui,/V1\.calculate\(samples/,'comparison must use same astronomy dataset');
assert.doesNotMatch(ui,/CebonkAlBiruni|OrderSend|trade\.Buy|trade\.Sell|TwelveData|technicalView/,
 'V2 UI must not consume non-astro or trading systems');
assert.match(v1,/CEBONK_ASTROLOGY_V1_ONLY/,'V1 code and interpretation retained');
console.log('PASS ASTRODOX V2: pure astro direction, ASC/MC timing, no forced aspect polarity, stable 5m slots, V1 isolation.');
