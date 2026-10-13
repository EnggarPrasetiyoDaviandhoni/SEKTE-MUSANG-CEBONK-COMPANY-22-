/* ASTRODOX FOLLOW TREND v1.0 — PURE legacy Astrology V1 score processor.
 * Input = CebonkCore.scan(..., modelEnabled=true) ONLY.
 * No Al-Biruni, market prices, technical data, broker feed, orders or Telegram.
 * Causal confirmation: historical scores up to index i determine state at i.
 * Full-day "focus"/"core" is retrospective / deterministic ephemeris simulation,
 * NOT information an intraday trader could have observed beforehand.
 */
(function(root){
'use strict';
const MINUTE=60000;
const VERSION='1.0.0';
function ensure(ok,message){if(!ok)throw Error(message);}
function rawDirection(score,buy,sell){
 ensure(Number.isFinite(score),'Skor astrologi V1 tidak tersedia.');
 return score>=buy?'BUY':score<=sell?'SELL':'WAIT';
}
function calculate(samples,options){
 ensure(Array.isArray(samples)&&samples.length>0&&samples.length<=1000,'Data skor 5 menit kosong atau berlebihan.');
 ensure(options&&typeof options==='object','Konfigurasi mesin ASTRODOX tidak tersedia.');
 const {confirmBars,graceBars,stepMinutes,buyThreshold,sellThreshold}=options;
 ensure(Number.isInteger(confirmBars)&&confirmBars>=2&&confirmBars<=24,'Konfirmasi harus 2–24 slot.');
 ensure(Number.isInteger(graceBars)&&graceBars>=1&&graceBars<=24,'Toleransi netral harus 1–24 slot.');
 ensure(stepMinutes===5,'Modul hanya mendukung skor ASTRODOX per 5 menit.');
 ensure(Number.isFinite(buyThreshold)&&Number.isFinite(sellThreshold)&&
   buyThreshold>0&&sellThreshold<0,'Ambang skor V1 tidak valid.');
 const step=stepMinutes*MINUTE;
 let stable=null,pending=null,pendingCount=0,neutralCount=0,reversals=0;
 const rows=[],windows=[];
 let current=null;
 for(let i=0;i<samples.length;i++){
  const s=samples[i];
  ensure(s&&Number.isFinite(s.ms)&&Number.isFinite(s.score),'Slot skor ASTRODOX tidak lengkap.');
  if(i)ensure(s.ms===samples[i-1].ms+step,'Urutan slot ASTRODOX 5 menit tidak lengkap.');
  const raw=rawDirection(s.score,buyThreshold,sellThreshold);
  let state='WAIT',reason='MENUNGGU_DOMINASI';
  if(raw==='WAIT'){
   neutralCount++;
   pending=null;pendingCount=0;
   if(neutralCount>=graceBars)stable=null;
   reason='NETRAL_ATAU_TRANSISI';
  }else{
   neutralCount=0;
   if(raw===stable){
    state=stable;
    pending=null;pendingCount=0;
    reason='FOLLOW_TREND';
   }else{
    if(pending===raw)pendingCount++;
    else {pending=raw;pendingCount=1;}
    if(pendingCount>=confirmBars){
     if(stable&&stable!==raw)reversals++;
     stable=raw;pending=null;pendingCount=0;
     state=raw;reason='DOMINASI_TERKONFIRMASI';
    }else{
     reason=stable?'PERINGATAN_PERUBAHAN_ARAH':'MENUNGGU_KONFIRMASI';
    }
   }
  }
  const row=Object.freeze({ms:s.ms,score:s.score,raw,state,reason,
    pendingDirection:pending,pendingCount,persistentTrend:stable||'WAIT'});
  rows.push(row);
  if(state==='WAIT'){current=null;continue;}
  if(!current||current.direction!==state||current.end!==s.ms){
   current={direction:state,start:s.ms,core:s.ms,end:s.ms+step,coreScore:s.score,slots:1};
   windows.push(current);
  }else{
   current.end=s.ms+step;current.slots++;
   if(Math.abs(s.score)>Math.abs(current.coreScore)){
    current.core=s.ms;current.coreScore=s.score;
   }
  }
 }
 const buyMinutes=rows.filter(x=>x.state==='BUY').length*stepMinutes;
 const sellMinutes=rows.filter(x=>x.state==='SELL').length*stepMinutes;
 const waitMinutes=rows.filter(x=>x.state==='WAIT').length*stepMinutes;
 const directional=buyMinutes+sellMinutes;
 const share=directional?Math.max(buyMinutes,sellMinutes)/directional:null;
 // A simple descriptive vote over confirmed chart time, not the next price.
 const focus=directional&&share>=0.55&&buyMinutes!==sellMinutes?
  (buyMinutes>sellMinutes?'BUY':'SELL'):'WAIT';
 const chosen=focus==='WAIT'?null:windows.filter(w=>w.direction===focus)
  .sort((a,b)=>b.slots-a.slots||Math.abs(b.coreScore)-Math.abs(a.coreScore)||a.start-b.start)[0]||null;
 return Object.freeze({version:VERSION,model:'ASTRODOX_V1_FOLLOW_TREND_RESEARCH',
  validated:false,tradeDecision:'WAIT',source:'CEBONK_ASTROLOGY_V1_ONLY',
  parameters:Object.freeze({confirmBars,graceBars,stepMinutes,buyThreshold,sellThreshold}),
  rows:Object.freeze(rows),windows:Object.freeze(windows.map(x=>Object.freeze({...x,minutes:x.slots*stepMinutes}))),
  focus,focusWindow:chosen?Object.freeze({...chosen,minutes:chosen.slots*stepMinutes}):null,
  buyMinutes,sellMinutes,waitMinutes,directionalShare:share,reversals,
  last:rows[rows.length-1],dateScope:'FULL_SCAN_RETROSPECTIVE_OR_FUTURE_EPHEMERIS',
  note:'Arah BUY/SELL hanya tren SKOR astrologi V1, bukan tren harga emas. INTI dihitung dari seluruh window, bukan sinyal yang diketahui di awal. Tidak ada izin transaksi.'});
}
const API=Object.freeze({VERSION,rawDirection,calculate});
root.CebonkAstrodoxFollowTrend=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
