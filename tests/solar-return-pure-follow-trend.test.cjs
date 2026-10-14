'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const SR=require('../assets/astrodox-comex-solar-return-core.js');

const MIN=60000,DAY=86400000,origin=Date.UTC(1974,11,31,17);
const norm=n=>((n%360)+360)%360;
const A={
 MakeTime:d=>({ms:d.getTime()}),
 GeoVector:(body,time)=>({ms:time.ms}),
 Ecliptic:v=>({elon:norm(280+(v.ms-origin)/DAY*360/365.2422),elat:0})
};
const C={
 Time:{
  parseDate:s=>new Date(s+'T00:00:00Z'),
  wibToUTC:(s,m)=>Date.parse(s+'T00:00:00Z')+(m-420)*MIN,
  wib:t=>{const d=new Date(t+420*MIN);return {hour:d.getUTCHours(),minute:d.getUTCMinutes()};},
  hm:o=>String(o.hour).padStart(2,'0')+':'+String(o.minute).padStart(2,'0')
 },
 createEngine:()=>({
  get:ms=>({positions:Object.fromEntries(SR.PLANETS.map((p,i)=>
   [p,{lon:norm(47*i+(ms-origin)/DAY*(0.18+i*.21))}]))}),
  clear:()=>{}
 })
};

test('weekly bounds are Monday–Sunday WIB',()=>{
 const w=SR.weekBounds(C,'2026-10-14');
 assert.equal(w.startWIB,'2026-10-12');
 assert.equal(w.endWIB,'2026-10-18');
});

test('SR aspect classification has neutral abstention',()=>{
 const z=SR.polarityOf([]);
 assert.equal(SR.classify(z.score,z.activity),'WAIT');
 const buy=SR.polarityOf([{eventType:'HARMONIS',strength:1}]);
 const sell=SR.polarityOf([{eventType:'TEGANG',strength:1}]);
 assert.equal(SR.classify(buy.score,buy.activity),'BUY');
 assert.equal(SR.classify(sell.score,sell.activity),'SELL');
 assert.equal(SR.phaseOf({phase:'APPLYING',orb:0.4}),'AWAL');
 assert.equal(SR.phaseOf({phase:'EXACT',orb:0.01}),'INTI');
 assert.equal(SR.phaseOf({phase:'SEPARATING',orb:0.4}),'AKHIR');
});

test('independent Solar Return weekly trend produces safe M1 research feed',async()=>{
 const r=await SR.analyzeDay(C,A,'2026-10-14',12);
 assert.equal(r.weekly.samples,168);
 assert.equal(r.weekly.days.length,7);
 assert.equal(r.rows.length,1440);
 assert.equal(Object.values(r.polarityCounts).reduce((a,b)=>a+b,0),1440);
 assert.equal(r.tradeDecision,'WAIT');
 for(const row of r.rows){
  assert.equal(row.tradeDecision,'WAIT');
  assert.equal('astroV2' in row,false);
  if(row.eventPolarity==='WAIT')continue;
  assert.equal(row.eventPolarity,r.weekly.direction);
  assert.ok(row.topEvent);
  assert.ok(row.topEvent.orb<=0.50);
  assert.equal(row.topEvent.eventType==='HARMONIS'?'BUY':'SELL',r.weekly.direction);
 }
 const feed=SR.exportResearch(r);
 assert.equal(feed.allowAutoTrade,false);
 assert.equal(feed.validatedForXAUUSD,false);
 assert.equal(feed.rows.length,1440);
 assert.equal('astroV2' in feed.rows[0],false);
});
