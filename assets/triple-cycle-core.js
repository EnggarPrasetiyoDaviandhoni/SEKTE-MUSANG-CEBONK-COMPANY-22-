/* CEBONK TRIPLE CYCLE: astronomy, BaZi, Hijri reference, model observations.
   Read-only research, no trading commands or inferred correlation. */
(function(root){
'use strict';
const MIN=60000,DAY=86400000,WIB=420*MIN;
const PHASES=Object.freeze([
 {angle:0,name:'Bulan Baru / Ijtimak'},
 {angle:45,name:'Sabit Membesar'},
 {angle:90,name:'Kuartal Pertama'},
 {angle:135,name:'Cembung Membesar'},
 {angle:180,name:'Bulan Purnama'},
 {angle:225,name:'Cembung Mengecil'},
 {angle:270,name:'Kuartal Terakhir'},
 {angle:315,name:'Sabit Mengecil'}
]);
const ASPECTS={Conjunction:'Konjungsi',Sextile:'Sekstil',Square:'Kuadrat',Trine:'Trigon',Opposition:'Oposisi'};
function requireOK(value,msg){if(!value)throw Error(msg);}
function bounds(value){
 requireOK(typeof value==='string'&&/^(202\d|203\d|2040)-(0[1-9]|1[0-2])$/.test(value),'Pilih bulan 2020 sampai 2040.');
 const p=value.split('-').map(Number);
 return {month:value,start:Date.UTC(p[0],p[1]-1,1)-WIB,end:Date.UTC(p[0],p[1],1)-WIB};
}
function local(ms){
 const d=new Date(ms+WIB).toISOString();
 return {date:d.slice(0,10),time:d.slice(11,16)};
}
function hijri(ms){
 const fmt=new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'});
 if(fmt.resolvedOptions().calendar!=='islamic-umalqura')return null;
 return fmt.format(new Date(ms));
}
function lunarEvents(A,month){
 requireOK(A&&typeof A.SearchMoonPhase==='function'&&typeof A.MoonPhase==='function','Mesin Astronomy Engine belum tersedia.');
 const {start,end}=bounds(month),events=[],newMoons=[];
 for(const phase of PHASES){
  let from=start-35*DAY;
  for(let i=0;i<5&&from<end;i++){
   const hit=A.SearchMoonPhase(phase.angle,new Date(from),45);
   requireOK(hit&&hit.date instanceof Date&&Number.isFinite(+hit.date),'Pencarian fase Bulan gagal.');
   const ms=+hit.date;
   requireOK(ms>=from&&ms<=from+45*DAY,'Perhitungan fase di luar rentang.');
   if(phase.angle===0)newMoons.push(ms);
   if(ms>=start&&ms<end)events.push({ms,name:phase.name,angle:phase.angle});
   from=ms+MIN;
  }
 }
 events.sort((a,b)=>a.ms-b.ms);newMoons.sort((a,b)=>a-b);
 requireOK(newMoons.some(x=>x<=start),'Ijtimak sebelumnya belum tersedia.');
 return {events,newMoons};
}
function atBazi(B,Solar,ms){
 const w=local(ms),data=B.calculate(Solar,w.date,w.time,2);
 return {month:data.pillars.month,year:data.pillars.year};
}
function baziPeriods(B,Solar,month){
 requireOK(B&&B.calculate&&Solar&&Solar.fromYmdHms,'Mesin BaZi belum tersedia.');
 const {start,end}=bounds(month),segments=[];
 let prev=atBazi(B,Solar,start),from=start;
 for(let day=start+DAY;day<=end;day+=DAY){
  const current=atBazi(B,Solar,day);
  if(current.month.text!==prev.month.text||current.year.text!==prev.year.text){
   let lo=day-DAY,hi=day;
   while(hi-lo>MIN){
    const mid=lo+Math.floor((hi-lo)/(2*MIN))*MIN;
    if(atBazi(B,Solar,mid).month.text===prev.month.text)lo=mid;else hi=mid;
   }
   segments.push({start:from,end:hi,month:prev.month,year:prev.year});
   from=hi;prev=atBazi(B,Solar,hi);
  }else prev=current;
 }
 segments.push({start:from,end,month:prev.month,year:prev.year});
 requireOK(segments[0].start===start&&segments.at(-1).end===end,'Rentang bulan BaZi tidak lengkap.');
 return segments;
}
function astrologyDays(C,A,month,onProgress=()=>{},cancelled=()=>false){
 requireOK(C&&C.createEngine&&C.analyse&&C.classify&&A,'Mesin Astrology belum siap.');
 const {start,end}=bounds(month),engine=C.createEngine(A),days=[],step=5*MIN;
 for(let at=start;at<end;at+=DAY){
  requireOK(!cancelled(),'Perhitungan dibatalkan.');
  const snapshots=[];let prev=null;
  for(const minute of [360,720,1080]){
   const t=at+minute*MIN;
   const r=C.analyse(engine.get(t-step),engine.get(t),engine.get(t+step),true);
   requireOK(Number.isFinite(r.score),'Skor Astrology tidak tersedia.');
   const state=C.classify(r.score,prev);prev=r.score;
   snapshots.push({ms:t,state,score:r.score,active:r.active,speeds:r.speeds});
  }
  const buy=snapshots.filter(x=>x.state==='BUY').length,sell=snapshots.filter(x=>x.state==='SELL').length;
  const state=buy>=2?'BUY':sell>=2?'SELL':snapshots.some(x=>x.state==='TRANSITION')?'TRANSISI':'NETRAL';
  const core=snapshots.filter(x=>x.state===state).sort((a,b)=>Math.abs(b.score)-Math.abs(a.score))[0]||
     snapshots.slice().sort((a,b)=>Math.abs(b.score)-Math.abs(a.score))[0];
  days.push({date:local(at+720*MIN).date,start:at,end:at+DAY,state,score:core.score,peak:core.ms,snapshots});
  onProgress(Math.round(100*(at+DAY-start)/(end-start)));
 }
 engine.clear();
 return days;
}
function enrich(days,periods,lunar,A){
 return days.map(day=>{
  const noon=day.start+720*MIN,active=periods.find(x=>noon>=x.start&&noon<x.end);
  const newMoon=lunar.newMoons.filter(ms=>ms<=noon).at(-1);
  requireOK(active&&newMoon!==undefined,'Data kalender tidak lengkap.');
  return {...day,bazi:active,hijri:hijri(noon),
    moonAgeHours:(noon-newMoon)/3600000,elongation:A.MoonPhase(new Date(noon))};
 });
}
function groupDays(days){
 const result=[];
 for(const day of days){
  let g=result.at(-1);
  if(g&&g.state===day.state&&g.end===day.start){g.end=day.end;g.days++;g.rows.push(day);}
  else result.push({start:day.start,end:day.end,state:day.state,days:1,rows:[day]});
 }
 for(const group of result){
  const best=group.rows.slice().sort((a,b)=>Math.abs(b.score)-Math.abs(a.score))[0];
  group.peak=best.peak;
 }
 return result;
}
function summarize(days){
 const counts={BUY:0,SELL:0,TRANSISI:0,NETRAL:0};
 for(const day of days)counts[day.state]++;
 const leading=counts.BUY>counts.SELL?'BUY':'SELL';
 return {counts,total:days.length,direction:counts[leading]>=Math.ceil(days.length*0.55)?leading:'CAMPURAN',groups:groupDays(days)};
}
function highlights(day){
 const s=day.snapshots.slice().sort((a,b)=>Math.abs(b.score)-Math.abs(a.score))[0];
 return (s.active||[]).filter(a=>!a.local&&a.orb<=1.5).sort((a,b)=>a.orb-b.orb).slice(0,4)
  .map(a=>a.id1+' / '+a.id2+' · '+(ASPECTS[a.name]||a.name)+' · '+a.orb.toFixed(2)+'°');
}
const api=Object.freeze({VERSION:'1.0.0',PHASES,bounds,local,hijri,lunarEvents,baziPeriods,astrologyDays,enrich,groupDays,summarize,highlights});
root.CebonkTripleCycle=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
