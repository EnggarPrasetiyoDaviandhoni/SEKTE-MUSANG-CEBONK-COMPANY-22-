/* CEBONK 4 MOMEN ASTROLOGY — experimental directional context v1.0.0.
   Uses ONLY the existing website Astrology V1 aspect score (CebonkCore).
   Does not assign BUY/SELL from Moon phase, BaZi, Hijri, or market prices.
   Bias scores and calendar observation windows are NOT verified predictions. */
(function(root){
'use strict';
const WIB=7*3600000, HOUR=3600000, STEP=5*60000;
const PRE_HOURS=Object.freeze([18,20,22]); // Friday WIB, observation context
const POST_HOURS=Object.freeze([6,8,10]);  // Monday WIB, observation context
function assert(ok,msg){if(!ok)throw Error(msg);}
function label(state){
 return state==='BUY'?'DOMINAN BULLISH':state==='SELL'?'DOMINAN BEARISH':
  state==='NEUTRAL'?'NETRAL':state==='MIXED'?'CAMPURAN':'MODEL TIDAK TERSEDIA';
}
function calculate(A,moments,C){
 assert(A&&Array.isArray(moments)&&C&&typeof C.createEngine==='function'&&
  typeof C.analyse==='function'&&typeof C.classify==='function','Mesin Astrology V1 tidak tersedia.');
 const engine=C.createEngine(A),out=Object.create(null),cache=new Map();
 function snapshot(ms){
  const t=Math.round(ms/STEP)*STEP;
  if(cache.has(t))return cache.get(t);
  const analysed=C.analyse(engine.get(t-STEP),engine.get(t),engine.get(t+STEP),true);
  assert(Number.isFinite(analysed.score),'Skor Astrology tidak tersedia.');
  const state=C.classify(analysed.score,null);
  assert(['BUY','SELL','NEUTRAL'].includes(state),'Klasifikasi Astrology tidak valid.');
  const point={state,score:analysed.score};
  cache.set(t,point);return point;
 }
 function dayWindow(date,hours){
  const start=Date.parse(date+'T00:00:00Z')-WIB;
  assert(Number.isFinite(start),'Tanggal jembatan tidak valid.');
  const points=hours.map(h=>snapshot(start+h*HOUR));
  const count={BUY:0,SELL:0,NEUTRAL:0};
  for(const point of points)count[point.state]++;
  return {state:count.BUY>=2?'BUY':count.SELL>=2?'SELL':'NEUTRAL',
   count,slots:hours.map(h=>String(h).padStart(2,'0')+':00').join(', ')+' WIB'};
 }
 try{
  for(const m of moments){
   const entry={event:snapshot(m.ms),friday:null,monday:null};
   if(m.bridge){
    entry.friday=dayWindow(m.bridge.friday,PRE_HOURS);
    entry.monday=dayWindow(m.bridge.monday,POST_HOURS);
   }
   out[m.ms]=entry;
  }
  return out;
 }finally{engine.clear();}
}
function summary(moments,biases){
 const count={BUY:0,SELL:0,NEUTRAL:0},available=moments.filter(m=>biases[m.ms]?.event);
 for(const m of available){
  const state=biases[m.ms].event.state;
  count[state==='BUY'||state==='SELL'?state:'NEUTRAL']++;
 }
 const n=available.length;
 return {count,available:n,state:n===0?'UNAVAILABLE':count.BUY>n/2?'BUY':
  count.SELL>n/2?'SELL':'MIXED'};
}
const api=Object.freeze({VERSION:'1.0.0',PRE_HOURS,POST_HOURS,label,calculate,summary});
root.CebonkMomentBias=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
