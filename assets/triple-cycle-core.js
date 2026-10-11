/* CEBONK FOUR MONTHLY MOON MOMENTS v2.1.0 — pure astronomical phase times.
   Four categories are 0, 90, 180, 270 degrees of geocentric lunar phase.
   Does not estimate visible hilal, calculate Hijri start, or predict trades. */
(function(root){
'use strict';
const DAY=86400000,MIN=60000,WIB=420*MIN;
const PHASES=Object.freeze([
 Object.freeze({id:'baru',angle:0,name:'Bulan Baru / Ijtimak',detail:'Konjungsi geosentris Matahari dan Bulan. Bukan tanggal terlihatnya hilal.'}),
 Object.freeze({id:'kuartal1',angle:90,name:'Kuartal Pertama',detail:'Fase seperempat perjalanan Bulan, tampak kira-kira separuh terang.'}),
 Object.freeze({id:'purnama',angle:180,name:'Bulan Purnama / Badar',detail:'Fase oposisi Matahari dan Bulan, tampak hampir seluruhnya terang.'}),
 Object.freeze({id:'kuartal3',angle:270,name:'Kuartal Terakhir',detail:'Fase tiga perempat perjalanan Bulan, tampak kira-kira separuh terang.'})
]);
function assert(x,message){if(!x)throw Error(message);}
function bounds(month){
 assert(typeof month==='string'&&/^(202\d|203\d|2040)-(0[1-9]|1[0-2])$/.test(month),'Pilih bulan antara Januari 2020 dan Desember 2040.');
 const [y,m]=month.split('-').map(Number);
 return Object.freeze({month,year:y,number:m,start:Date.UTC(y,m-1,1)-WIB,end:Date.UTC(y,m,1)-WIB});
}
function wib(ms){
 assert(Number.isFinite(ms),'Waktu fase tidak valid.');
 const s=new Date(ms+WIB).toISOString();
 return Object.freeze({date:s.slice(0,10),time:s.slice(11,16),datetime:s.slice(0,16).replace('T',' ')+' WIB'});
}
// Retain the exact astronomical timestamp. Weekend observation dates are WIB calendar days.
function weekendBridge(ms){
 assert(Number.isFinite(ms),'Waktu fase tidak valid.');
 const local=new Date(ms+WIB);
 const day=local.getUTCDay();
 if(day!==0&&day!==6)return null;
 const midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
 const iso=t=>new Date(t).toISOString().slice(0,10);
 return Object.freeze({
  flag:'JEMBATAN_AKHIR_PEKAN',
  eventDate:iso(midnight),
  friday:iso(midnight-(day===6?1:2)*DAY),
  monday:iso(midnight+(day===6?2:1)*DAY)
 });
}
function calculate(A,month){
 assert(A&&typeof A.SearchMoonPhase==='function','Astronomy Engine belum tersedia.');
 const {start,end}=bounds(month),moments=[];
 for(const phase of PHASES){
  let from=start-36*DAY,prior=-Infinity;
  for(let n=0;n<5&&from<end;n++){
   const found=A.SearchMoonPhase(phase.angle,new Date(from),45);
   assert(found&&found.date instanceof Date&&Number.isFinite(+found.date),'Perhitungan fase Bulan gagal.');
   const ms=+found.date;
   assert(ms>=from&&ms<=from+45*DAY&&ms>prior,'Urutan fase Bulan tidak valid.');
   prior=ms;
   if(ms>=start&&ms<end)moments.push(Object.freeze({id:phase.id,angle:phase.angle,name:phase.name,detail:phase.detail,ms,wib:wib(ms),bridge:weekendBridge(ms)}));
   from=ms+MIN;
  }
 }
 moments.sort((a,b)=>a.ms-b.ms);
 assert(moments.length>=3&&moments.length<=5,'Hasil perhitungan bulan tidak masuk akal.');
 const count=Object.fromEntries(PHASES.map(p=>[p.id,0]));
 for(const m of moments)count[m.id]++;
 // Four phase TYPES, not necessarily four events in each Gregorian month; a 28-day month can miss one type.
 return Object.freeze({version:'2.1.0',month,start,end,phases:PHASES,moments:Object.freeze(moments),counts:Object.freeze(count)});
}
const api=Object.freeze({VERSION:'2.1.0',PHASES,bounds,wib,weekendBridge,calculate});
root.CebonkFourMoments=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
