/* CEBONK Moon Saving calendar plan v1.0.
 * Pure date-time planner. No trading, no live market data or session assumptions.
 * Moon quarter is one instant, not a guaranteed tradable interval.
 */
(function(root){
'use strict';
const ONE_DAY=86400000,MINUTE=60000;
const z=n=>String(n).padStart(2,'0');
const dateStr=p=>p.year+'-'+z(p.month)+'-'+z(p.day);
function parseClock(s){
 if(!s)return null;
 if(!/^\d{2}:\d{2}$/.test(s))throw Error('Jam tutup Jumat harus HH:MM.');
 const a=s.split(':').map(Number);
 if(a[0]>23||a[1]>59)throw Error('Jam tutup Jumat di luar 00:00–23:59.');
 return {hour:a[0],minute:a[1]};
}
function plan(eventDate,broker,fridayClose='',leadMinutes=5){
 const phaseMs=eventDate instanceof Date?eventDate.getTime():Number(eventDate);
 if(!Number.isFinite(phaseMs))throw Error('Waktu Kuartal Pertama tidak valid.');
 if(!broker||typeof broker.civil!=='function'||typeof broker.wallToUtc!=='function')throw Error('Jam broker tidak tersedia.');
 if(!Number.isInteger(leadMinutes)||leadMinutes<1||leadMinutes>60)throw Error('Jeda sebelum market tutup 1–60 menit.');
 const c=broker.civil(phaseMs);
 const civilDate=dateStr(c),day=new Date(Date.UTC(c.year,c.month-1,c.day)).getUTCDay();
 if(day>=1&&day<=5){
  return {type:'QUARTER_CONDITIONAL',phaseMs,phaseDate:civilDate,plannedMs:phaseMs,
   scheduledDate:civilDate,confirmedOpen:false,
   note:'Kuartal Pertama tepat: BUY hanya jika sesi XAGUSD di MT5 terbuka.'};
 }
 // Weekend: Friday before the quarter, while still waxing crescent.
 const dateMid=Date.UTC(c.year,c.month-1,c.day);
 const prevFriday=new Date(dateMid-(day===6?1:2)*ONE_DAY);
 const f={year:prevFriday.getUTCFullYear(),month:prevFriday.getUTCMonth()+1,day:prevFriday.getUTCDate()};
 const scheduledDate=dateStr(f);
 const close=parseClock(fridayClose);
 if(!close){
  return {type:'FRIDAY_UNSET',phaseMs,phaseDate:civilDate,plannedMs:null,
   scheduledDate,confirmedOpen:false,
   note:'Kuartal Pertama akhir pekan. Isi jam tutup Jumat sesuai sesi XAGUSD MT5.'};
 }
 const closeMs=broker.wallToUtc(f.year,f.month-1,f.day,close.hour,close.minute);
 const plannedMs=closeMs-leadMinutes*MINUTE;
 const x=broker.civil(plannedMs);
 if(plannedMs>=phaseMs || dateStr(x)!==scheduledDate){
  return {type:'INVALID_FRIDAY',phaseMs,phaseDate:civilDate,plannedMs:null,
   scheduledDate,confirmedOpen:false,
   note:'Jam Jumat atau selisih menit tidak memungkinkan entry pada hari Jumat.'};
 }
 return {type:'FRIDAY_ESTIMATE',phaseMs,phaseDate:civilDate,plannedMs,scheduledDate,confirmedOpen:false,
  note:'Jadwal perkiraan '+leadMinutes+' menit sebelum jam tutup Jumat yang diinput; wajib cocokkan spesifikasi XAGUSD di MT5.'};
}
root.CebonkMoonSavingPlan=Object.freeze({plan,parseClock,dateStr});
if(typeof module!=='undefined'&&module.exports)module.exports=root.CebonkMoonSavingPlan;
})(typeof window!=='undefined'?window:globalThis);
