/* CEBONK DAILY SWING RESEARCH CORE v1.0
 * Pure combination: existing unvalidated weekly direction + observed lunar illumination.
 * Does not alter existing Astrology, Al-Biruni, Solar Return, or trading engines.
 */
(function(root){
'use strict';
const WEEKDAYS=Object.freeze(['Senin','Selasa','Rabu','Kamis','Jumat']);
const isDirection=v=>v==='BUY'||v==='SELL';
function requireValue(ok,msg){if(!ok)throw Error(msg);}
function dayString(date){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date||'');
 requireValue(Boolean(m),'Tanggal mingguan tidak valid.');
 const y=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
 const d=new Date(Date.UTC(y,month-1,day));
 requireValue(d.getUTCFullYear()===y&&d.getUTCMonth()===month-1&&d.getUTCDate()===day,'Tanggal tidak valid.');
 return {y,month:month-1,day};
}
function make(weekly,astronomy,broker,minuteOfDay=0){
 requireValue(weekly&&Array.isArray(weekly.days)&&weekly.days.length===5,'Dominasi mingguan belum dihitung.');
 requireValue(astronomy&&astronomy.Body&&astronomy.Body.Moon&&typeof astronomy.Illumination==='function',
  'Astronomy Engine untuk cahaya Bulan tidak tersedia.');
 requireValue(broker&&typeof broker.wallToUtc==='function'&&typeof broker.civil==='function',
  'Jam broker MT5 tidak tersedia.');
 requireValue(Number.isInteger(minuteOfDay)&&minuteOfDay>=0&&minuteOfDay<1440,'Jam pengamatan tidak valid.');
 const hour=Math.floor(minuteOfDay/60),minute=minuteOfDay%60;
 const direction=isDirection(weekly.direction)?weekly.direction:'WAIT';
 const days=weekly.days.map((item,i)=>{
  const {y,month,day}=dayString(item.date);
  const when=broker.wallToUtc(y,month,day,hour,minute);
  const obs=astronomy.Illumination(astronomy.Body.Moon,new Date(when));
  const fraction=obs&&obs.phase_fraction;
  requireValue(Number.isFinite(fraction)&&fraction>=0&&fraction<=1,'Cahaya Bulan tidak valid.');
  const brokerDate=broker.civil(when);
  requireValue(brokerDate.year===y&&brokerDate.month===month+1&&brokerDate.day===day &&
    brokerDate.hour===hour&&brokerDate.minute===minute,'Jam broker tidak konsisten untuk '+item.date);
  return {date:item.date,weekday:item.weekday||WEEKDAYS[i],direction,observationMs:when,
   illumination:fraction*100,illuminationRounded:Math.round(fraction*100),brokerOffset:brokerDate.offset,
   astroDailyBias:item.dominant||'CAMPURAN',buyMinutes:item.buyMinutes||0,sellMinutes:item.sellMinutes||0};
 });
 const ranked=[...days].sort((a,b)=>b.illumination-a.illumination||a.observationMs-b.observationMs);
 const priority=ranked.map((d,i)=>({...d,rank:i+1,priority:i===0?'UTAMA':i===1?'TINGGI':i===2?'SEDANG':'RENDAH'}));
 const order=new Map(priority.map(d=>[d.date,d]));
 const chronological=days.map(d=>order.get(d.date));
 const total=weekly.buyMinutes+weekly.sellMinutes;
 return Object.freeze({version:'1.0.0',weekDirection:direction,
  weekModel:weekly.method||'Model mingguan V1',buyMinutes:weekly.buyMinutes,sellMinutes:weekly.sellMinutes,
  directionalShare:total>0?(direction==='BUY'?weekly.buyMinutes/total:direction==='SELL'?weekly.sellMinutes/total:null):null,
  minuteOfDay,days:chronological,ranked:priority,best:isDirection(direction)?priority[0]:null,
  brokerMode:broker.currentMode(),caveat:'Persentase Bulan hanya peringkat iluminasi, bukan confidence, prediksi harga, maupun pembenaran entry.'});
}
const API=Object.freeze({make});
root.CebonkDailySwingCore=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
