'use strict';
const assert=require('assert');
const A=require('../assets/astro-candles.js');
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name);};
const H=3600000;
function msUTC(iso){return Date.parse(iso);}
function sample(ms,state){return {ms,state};}
t('H1 bucket aligns to WIB clock hour',()=>{
  const x=msUTC('2026-10-07T11:35:00Z'); // 18:35 WIB
  assert.equal(new Date(A.bucketStart(x,1)).toISOString(),'2026-10-07T11:00:00.000Z');
});
t('H4 bucket aligns 00/04/08/12/16/20 WIB',()=>{
  const x=msUTC('2026-10-07T11:35:00Z'); // 18:35 WIB -> 16:00 WIB bucket
  assert.equal(new Date(A.bucketStart(x,4)).toISOString(),'2026-10-07T09:00:00.000Z');
});
t('H1 dominant BUY from legacy 5m samples',()=>{
  const start=msUTC('2026-10-07T11:00:00Z'),s=[];
  for(let i=0;i<12;i++)s.push(sample(start+i*5*60000,i<8?'BUY':'SELL'));
  const r=A.aggregate(s,1,5,true,start+H);
  assert.equal(r.length,1);assert.equal(r[0].dominant,'BUY');assert.equal(r[0].pct.BUY.toFixed(0),'67');assert.equal(r[0].coverage,1);
});
t('tie becomes MIXED',()=>{
  const start=msUTC('2026-10-07T11:00:00Z'),s=[];
  for(let i=0;i<12;i++)s.push(sample(start+i*5*60000,i<6?'BUY':'SELL'));
  assert.equal(A.aggregate(s,1,5,true,start+H)[0].dominant,'MIXED');
});
t('model OFF projects DATA only',()=>{
  const start=msUTC('2026-10-07T11:00:00Z'),s=[sample(start,'DATA'),sample(start+300000,'DATA')];
  assert.equal(A.aggregate(s,1,5,false,start+H)[0].dominant,'DATA');
});
t('partial H4 preserves coverage',()=>{
  const start=msUTC('2026-10-07T11:00:00Z'),s=[];
  for(let i=0;i<12;i++)s.push(sample(start+i*5*60000,'BUY'));
  const r=A.aggregate(s,4,5,true,start+H)[0];
  assert.equal(r.coverage,.25);assert.equal(r.status,'PARTIAL');
});
t('H4 separates adjacent candle buckets',()=>{
  const s=[sample(msUTC('2026-10-07T08:55:00Z'),'BUY'),sample(msUTC('2026-10-07T09:00:00Z'),'SELL')];
  const r=A.aggregate(s,4,5,true,msUTC('2026-10-07T10:00:00Z'));
  assert.equal(r.length,2);assert.equal(r[0].dominant,'BUY');assert.equal(r[1].dominant,'SELL');
});
console.log('TOTAL',n);
