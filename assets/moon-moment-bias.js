/* CEBONK ASTROLOGY MOMENT BIAS v1.0.0
 * Independent inherited V1 experimental Astrology score; pure computation.
 * Moon phases NEVER imply BUY/SELL. No prices, trading orders, invented probabilities.
 * Friday (pre) and Monday (post) scan 06:00-24:00 WIB at 5-minute intervals.
 */
(function(root){
'use strict';
const MIN=60000;
function assert(v,s){if(!v)throw Error(s);}
function support(C,A){
 assert(C&&C.CFG&&typeof C.scan==='function'&&typeof C.analyse==='function'&&typeof C.classify==='function'&&
  typeof C.createEngine==='function'&&A,'Mesin Astrology atau ephemeris belum tersedia.');
}
function instant(C,A,ms){
 support(C,A);assert(Number.isFinite(ms),'Waktu momen tidak valid.');
 const engine=C.createEngine(A),step=C.CFG.step*MIN;
 const x=C.analyse(engine.get(ms-step),engine.get(ms),engine.get(ms+step),true);
 assert(Number.isFinite(x.score),'Skor momen Astrology tidak lengkap.');
 engine.clear();
 const direction=C.classify(x.score,null);
 assert(['BUY','SELL','NEUTRAL'].includes(direction),'Klasifikasi momen tidak dikenal.');
 return Object.freeze({ms,direction,score:x.score,model:'CEBONK_ASTROLOGY_V1_EXPERIMENTAL'});
}
function summarize(samples,iso){
 assert(Array.isArray(samples)&&samples.length===216,'Scan 5 menit 06:00-24:00 WIB harus lengkap.');
 const counts={BUY:0,SELL:0,NEUTRAL:0,TRANSITION:0};
 for(const s of samples){
  assert(s&&Number.isFinite(s.score)&&Object.hasOwn(counts,s.state),'Slot Astrology tidak valid.');
  counts[s.state]++;
 }
 const total=samples.length,buy=Math.round(counts.BUY/total*1000)/10,
  sell=Math.round(counts.SELL/total*1000)/10;
 // Strict dominance >=55% of ALL slots, not 55% of just directional slots.
 const dir=counts.BUY>=Math.ceil(total*0.55)&&counts.BUY>counts.SELL?'BUY':
           counts.SELL>=Math.ceil(total*0.55)&&counts.SELL>counts.BUY?'SELL':'CAMPURAN';
 return Object.freeze({date:iso,direction:dir,buyPercent:buy,sellPercent:sell,
  counts:Object.freeze(counts),total,method:'216 slot x 5 menit; dominan jika >=55% seluruh slot.'});
}
async function day(C,A,iso,onProgress=()=>{},cancelled=()=>false){
 support(C,A);
 assert(/^\d{4}-\d{2}-\d{2}$/.test(iso),'Tanggal WIB tidak valid.');
 const year=+iso.slice(0,4);
 assert(year>=C.CFG.yearMin&&year<=C.CFG.yearMax,'Tanggal Jumat/Senin di luar cakupan model Astrology.');
 const samples=await C.scan(C.createEngine(A),iso,360,true,onProgress,cancelled);
 assert(!cancelled(),'Perhitungan dibatalkan.');
 return summarize(samples,iso);
}
async function forMoments(C,A,moments,onProgress=()=>{},cancelled=()=>false){
 support(C,A);assert(Array.isArray(moments),'Data momen tidak valid.');
 const cache=new Map(),output=[];
 const days=[...new Set(moments.flatMap(m=>m.bridge?[m.bridge.friday,m.bridge.monday]:[]))];
 for(const m of moments){
  assert(!cancelled(),'Perhitungan dibatalkan.');
  const point=instant(C,A,m.ms);
  output.push({ms:m.ms,phase:m.name,instant:point,bridge:null});
 }
 for(let i=0;i<days.length;i++){
  assert(!cancelled(),'Perhitungan dibatalkan.');
  const date=days[i];
  try{
   cache.set(date,await day(C,A,date,p=>onProgress(Math.round((i+p/100)/days.length*100)),cancelled));
  }catch(e){
   if(cancelled())throw e;
   // Unavailable date (e.g. Jan 2041) is reported explicitly; no dummy direction.
   cache.set(date,Object.freeze({date,direction:'DATA_TIDAK_TERSEDIA',error:e?.message||String(e)}));
  }
 }
 for(let i=0;i<moments.length;i++){
  const b=moments[i].bridge;
  if(b)output[i].bridge={friday:cache.get(b.friday),monday:cache.get(b.monday)};
 }
 onProgress(100);
 return output;
}
const api=Object.freeze({VERSION:'1.0.0',instant,summarize,day,forMoments});
root.CebonkMoonBias=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
