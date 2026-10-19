/* CEBONK ASTROLOGY KILLZONE v1.0 — independent session research.
 * Original CebonkCore / ASTRODOX V1 mathematics unchanged.
 * No Al-Biruni dependency, no market price, no Judas confirmation, no orders.
 */
(function(root){
'use strict';
const MIN=60000, STEP=5*MIN, WIB=7*60;
const SESSIONS=Object.freeze([
 Object.freeze({id:'sydney',name:'Sydney',zone:'Australia/Sydney',from:8*60,to:11*60}),
 Object.freeze({id:'tokyo',name:'Tokyo / Asia',zone:'Asia/Tokyo',from:9*60,to:12*60}),
 Object.freeze({id:'london',name:'London Open',zone:'Europe/London',from:8*60,to:11*60}),
 Object.freeze({id:'newyork',name:'New York Open',zone:'America/New_York',from:8*60,to:11*60}),
 Object.freeze({id:'londonclose',name:'London Close',zone:'Europe/London',from:15*60,to:17*60})
]);
const formatters=new Map();
function requireValue(x,message){if(!x)throw Error(message);}
function zonedParts(ms,zone){
 let fmt=formatters.get(zone);
 if(!fmt){fmt=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});formatters.set(zone,fmt);}
 const p=Object.fromEntries(fmt.formatToParts(new Date(ms)).filter(v=>v.type!=='literal').map(v=>[v.type,Number(v.value)]));
 requireValue(['year','month','day','hour','minute'].every(k=>Number.isInteger(p[k])),'Konversi zona waktu gagal.');
 return p;
}
function zoneOffset(ms,zone){
 const p=zonedParts(ms,zone);
 return (Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)-Math.floor(ms/MIN)*MIN)/MIN;
}
function wallToUtc(date,minutes,zone){
 requireValue(Number.isInteger(minutes)&&minutes>=0&&minutes<1440,'Jam lokal tidak valid.');
 const [y,m,d]=date.split('-').map(Number);
 const local=Date.UTC(y,m-1,d,Math.floor(minutes/60),minutes%60);
 let utc=local;
 for(let i=0;i<4;i++)utc=local-zoneOffset(utc,zone)*MIN;
 const found=zonedParts(utc,zone);
 requireValue(found.year===y&&found.month===m&&found.day===d&&found.hour===Math.floor(minutes/60)&&found.minute===minutes%60,
  'Jam lokal tidak tersedia pada zona waktu '+zone+'.');
 return utc;
}
function fmtTime(ms,C){
 const p=C.Time.wib(ms);
 return C.Time.dateISO(p)+' '+C.Time.hm(p)+' WIB';
}
function schedule(date,C){
 requireValue(C&&C.Time&&typeof C.Time.parseDate==='function','Mesin CEBONK tidak tersedia.');
 const ms=C.Time.parseDate(date),weekday=new Date(ms).getUTCDay();
 requireValue(weekday!==0&&weekday!==6,'Sabtu/Minggu: jadwal killzone tidak dihitung karena market akhir pekan tutup.');
 return SESSIONS.map(s=>{
  const start=wallToUtc(date,s.from,s.zone),end=wallToUtc(date,s.to,s.zone);
  requireValue(end>start&&(end-start)%STEP===0,'Rentang sesi salah: '+s.name);
  const a=C.Time.wib(start),b=C.Time.wib(end);
  requireValue(C.Time.dateISO(a)===date,
    'Sesi '+s.name+' di luar tanggal WIB yang dipilih.');
  return Object.freeze({...s,start,end,offsetStart:zoneOffset(start,s.zone),
   startWib:fmtTime(start,C),endWib:fmtTime(end,C)});
 });
}
function state(score,C){
 requireValue(Number.isFinite(score),'Skor ASTRODOX V1 tidak valid.');
 return score>=C.CFG.buy?'BUY':score<=C.CFG.sell?'SELL':'WAIT';
}
function windows(samples,C,confirmBars=2,minMinutes=15){
 requireValue(Array.isArray(samples)&&samples.length>0,'Data sesi kosong.');
 requireValue(Number.isInteger(confirmBars)&&confirmBars>=2&&confirmBars<=12,'Konfirmasi tidak valid.');
 requireValue(Number.isInteger(minMinutes)&&minMinutes>=5,'Durasi minimum tidak valid.');
 let previous=null,group=[],segments=[];
 function flush(){
  if(group.length>=confirmBars){
   const rawStart=group[0].ms,start=group[confirmBars-1].ms+STEP,end=group[group.length-1].ms+STEP;
   const minutes=(end-start)/MIN;
   if(minutes>=minMinutes){
    const after=group.slice(confirmBars);
    const core=after.reduce((best,x)=>Math.abs(x.score)>Math.abs(best.score)?x:best,after[0]);
    segments.push({direction:previous,rawStart,start,core:core.ms,end,minutes,score:core.score,rawBars:group.length});
   }
  }
  group=[];
 }
 for(let i=0;i<samples.length;i++){
  const r=samples[i];
  requireValue(Number.isFinite(r.ms)&&Number.isFinite(r.score),'Sampel tidak lengkap.');
  if(i)requireValue(r.ms===samples[i-1].ms+STEP,'Slot sampel tidak berurutan.');
  const d=state(r.score,C);
  if(d!==previous){if(group.length)flush();previous=d;}
  if(d==='WAIT'){group=[];continue;}
  group.push(r);
 }
 if(group.length)flush();
 const buy=segments.filter(s=>s.direction==='BUY').reduce((n,s)=>n+s.minutes,0);
 const sell=segments.filter(s=>s.direction==='SELL').reduce((n,s)=>n+s.minutes,0);
 const total=buy+sell;
 const focus=total&&buy!==sell&&Math.max(buy,sell)/total>=.55?(buy>sell?'BUY':'SELL'):'WAIT';
 const best=segments.filter(s=>s.direction===focus).sort((a,b)=>b.minutes-a.minutes||Math.abs(b.score)-Math.abs(a.score)||a.start-b.start)[0]||null;
 return {focus,buyMinutes:buy,sellMinutes:sell,directionalShare:total?Math.max(buy,sell)/total:null,
  windows:segments,best,confirmBars,minMinutes};
}
async function calculate(date,A,C,onProgress=()=>{},cancelled=()=>false,P=null){
 requireValue(A&&C&&typeof C.createEngine==='function'&&typeof C.analyse==='function','Ephemeris ASTRODOX tidak tersedia.');
 const sessions=schedule(date,C),engine=C.createEngine(A);
 const total=sessions.reduce((sum,s)=>sum+(s.end-s.start)/STEP,0);
 let done=0;
 try{
  const output=[];
  for(const s of sessions){
   requireValue(!cancelled(),'Perhitungan dibatalkan.');
   const samples=[];
   for(let t=s.start;t<s.end;t+=STEP){
    requireValue(!cancelled(),'Perhitungan dibatalkan.');
    const x=C.analyse(engine.get(t-STEP),engine.get(t),engine.get(t+STEP),true);
    requireValue(Number.isFinite(x.score),'Skor V1 tidak tersedia.');
    samples.push(x);done++;
    if(done%8===0){onProgress(Math.round(100*done/total),s.name);await new Promise(resolve=>setTimeout(resolve,0));}
   }
   const trend=windows(samples,C);
   const strength=P&&typeof P.evaluate==='function'?P.evaluate(samples):null;
   output.push({...s,samples,trend,strength});
  }
  onProgress(100,'Selesai');
  return {date,model:'CEBONK_ASTRODOX_V1_SESSION_ONLY',validated:false,tradeDecision:'WAIT',
   sessions:output,note:'Arah skor astrologi eksperimental, bukan arah harga; Judas Swing belum dapat dikonfirmasi tanpa candle harga.'};
 }finally{engine.clear();}
}
const API=Object.freeze({VERSION:'1.0.0',SESSIONS,zonedParts,zoneOffset,wallToUtc,schedule,state,windows,calculate});
root.CebonkAstroKillzone=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
