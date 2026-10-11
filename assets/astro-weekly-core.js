/* CEBONK ASTROLOGY weekly aggregation v1 — inherited UNVALIDATED V1 direction model.
 * Pure calculations; no market data and no execution. */
(function(root){
'use strict';
const MS=86400000,MIN=60000,START=360,END=1440,NAMES=['Senin','Selasa','Rabu','Kamis','Jumat'];
function requireValid(ok,message){if(!ok)throw Error(message);}
function monday(input){
 requireValid(typeof input==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input),'Tanggal minggu tidak valid.');
 const t=Date.parse(input+'T00:00:00Z');requireValid(Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===input,'Tanggal kalender tidak valid.');
 const d=new Date(t).getUTCDay(),shift=(d+6)%7;
 return new Date(t-shift*MS).toISOString().slice(0,10);
}
function weekDates(date,minYear=2020,maxYear=2040){
 const m=monday(date),t=Date.parse(m+'T00:00:00Z');
 const days=NAMES.map((name,i)=>({name,date:new Date(t+i*MS).toISOString().slice(0,10)}));
 requireValid(days.every(d=>Number(d.date.slice(0,4))>=minYear&&Number(d.date.slice(0,4))<=maxYear),'Pilih minggu Senin–Jumat dalam rentang tahun '+minYear+'–'+maxYear+'.');
 return days;
}
function summarize(days,step=5,minWindow=30){
 requireValid(Array.isArray(days)&&days.length===5,'Data harus berisi lima hari Senin–Jumat.');
 requireValid(Number.isInteger(step)&&step>0&&1440%step===0,'Interval waktu tidak valid.');
 let buys=0,sells=0,neutral=0;const items=[],totals=[],week=[];
 const dates=new Set(),expected=(END-START)/step;
 for(let i=0;i<days.length;i++){
  const day=days[i];requireValid(day&&typeof day.date==='string'&&day.date===weekDates(days[0].date)[i].date,'Urutan hari mingguan tidak valid.');
  requireValid(!dates.has(day.date),'Duplikasi tanggal.');dates.add(day.date);
  requireValid(Array.isArray(day.samples)&&day.samples.length===expected,'Data slot belum lengkap untuk '+day.date+'.');
  const begin=Date.parse(day.date+'T00:00:00Z')-420*MIN+START*MIN;
  let b=0,s=0,n=0;
  for(const [j,v] of day.samples.entries()){
   requireValid(v&&Number.isFinite(v.ms)&&v.ms===begin+j*step*MIN,'Slot 5 menit tidak berurutan pada '+day.date+'.');
   if(v.state==='BUY')b++;else if(v.state==='SELL')s++;else if(v.state==='NEUTRAL'||v.state==='TRANSITION')n++;
   else requireValid(false,'Label model tidak dikenal: '+String(v.state));
  }
  const groups=[];for(const sample of day.samples){
   let g=groups.at(-1);
   if(!g||g.state!==sample.state){g={state:sample.state,start:sample.ms,end:sample.ms+step*MIN,best:sample,slots:0};groups.push(g);}
   g.end=sample.ms+step*MIN;g.slots++;
   if(Math.abs(sample.score||0)>Math.abs(g.best.score||0))g.best=sample;
  }
  const candidates=groups.filter(x=>['BUY','SELL'].includes(x.state)&&(x.end-x.start)/MIN>=minWindow);
  for(const x of candidates)items.push({date:day.date,weekday:NAMES[i],direction:x.state,start:x.start,core:x.best.ms,end:x.end,minutes:(x.end-x.start)/MIN,score:x.best.score});
  buys+=b;sells+=s;neutral+=n;
  const dDir=b>s?'BUY':s>b?'SELL':'CAMPURAN';
  const dailyBest=candidates.filter(x=>x.state===dDir).sort((a,b)=>b.slots-a.slots||Math.abs(b.best.score||0)-Math.abs(a.best.score||0)||a.start-b.start)[0];
  totals.push({date:day.date,weekday:NAMES[i],buyMinutes:b*step,sellMinutes:s*step,otherMinutes:n*step,dominant:dDir,qualified:candidates.length,best:dailyBest?{direction:dailyBest.state,start:dailyBest.start,core:dailyBest.best.ms,end:dailyBest.end,minutes:dailyBest.slots*step}:null});
  week.push({date:day.date,count:day.samples.length});
 }
 const directional=buys+sells,buyShare=directional?buys/directional:0,sellShare=directional?sells/directional:0;
 const direction=!directional?'TIDAK ADA ARAH':buyShare>=0.55?'BUY':sellShare>=0.55?'SELL':'CAMPURAN';
 const rank=(a,b)=>b.minutes-a.minutes||Math.abs(b.score||0)-Math.abs(a.score||0)||a.start-b.start;
 const matching=items.filter(x=>x.direction===direction).sort(rank);
 return {direction,buyMinutes:buys*step,sellMinutes:sells*step,otherMinutes:neutral*step,
  buyShare:directional?buyShare:null,sellShare:directional?sellShare:null,
  days:totals,candidates:matching.slice(0,5),best:matching[0]||null,totalSlots:buys+sells+neutral,
  method:'Durasi slot model V1 tidak tervalidasi; ambang dominan 55%; kandidat minimal '+minWindow+' menit.'};
}
async function scanWeek(date,scanner,notify=()=>{},cancelled=()=>false){
 requireValid(typeof scanner==='function','Mesin pemindai tidak tersedia.');
 const days=weekDates(date),result=[];
 for(let i=0;i<days.length;i++){
  requireValid(!cancelled(),'Perhitungan dibatalkan.');
  notify({index:i,date:days[i].date,name:days[i].name,percent:Math.round(i*100/5)});
  const samples=await scanner(days[i].date,p=>notify({index:i,date:days[i].date,name:days[i].name,percent:Math.min(99,Math.round((i+p/100)*100/5))}),cancelled);
  requireValid(!cancelled(),'Perhitungan dibatalkan.');
  result.push({...days[i],samples});
 }
 notify({index:5,percent:100});
 return summarize(result);
}
// EA bridge: export the actual weekly scanner output, never reconstruct signals inside MT5.
function toEACsv(report,date){
 const week=monday(date),days=new Set(weekDates(date).map(d=>d.date));
 requireValid(report&&Array.isArray(report.candidates)&&typeof report.direction==='string','Hasil mingguan belum tersedia.');
 const head='week_monday_wib,week_direction,date_wib,start_epoch,core_epoch,end_epoch,window_direction,model';
 const out=[head],direction=report.direction;
 if(direction==='BUY'||direction==='SELL'){
  requireValid(report.candidates.length<=5,'Terlalu banyak window.');
  for(const x of report.candidates){
   requireValid(x&&days.has(x.date)&&x.direction===direction,'Window harus searah dominasi minggu.');
   requireValid([x.start,x.core,x.end].every(t=>Number.isSafeInteger(t)&&t%300000===0),
    'Waktu window bukan grid 5 menit.');
   requireValid(x.start<=x.core&&x.core<x.end&&x.end-x.start>=1800000,
    'Mulai/inti/akhir tidak valid.');
   out.push([week,direction,x.date,x.start/1000,x.core/1000,x.end/1000,direction,'CEBONK_ASTRO_WEEKLY_V1'].join(','));
  }
 }
 return out.join('\n')+'\n';
}
const API=Object.freeze({monday,weekDates,summarize,scanWeek,toEACsv});
root.CebonkAstroWeekly=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
