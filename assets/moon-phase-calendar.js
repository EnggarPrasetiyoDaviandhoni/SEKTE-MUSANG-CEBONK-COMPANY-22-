/* Kalender Fase Bulan CEBONK v1.4 — full month phase details and XAGUSD first-quarter panel. */
(function(root){
'use strict';
const DAY=86400000;
const NAMES=['Bulan Baru','Perbani Awal','Bulan Purnama','Perbani Akhir'];
const ICONS=['🌑','🌓','🌕','🌗'];
const DAILY=['Bulan Baru','Sabit Muda','Perbani Awal','Cembung Membesar','Bulan Purnama','Cembung Mengecil','Perbani Akhir','Sabit Tua'];
const DAILY_ICONS=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
const WEEK=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
const MONTH=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});
const FULL=new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const HHMM=new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'});
const $=id=>document.getElementById(id);
const WIB=420;
const Broker=root.CebonkMt5BrokerTime; if(!Broker)throw Error('Modul broker MT5 belum termuat');
let year,month,selected,enginePromise=null,loaded=false;
const zoneName=date=>Broker.label(date);
const localClock=(date,offset)=>new Date(date.getTime()+offset*60000);
const localParts=(date,offset)=>{const d=localClock(date,offset);return {y:d.getUTCFullYear(),m:d.getUTCMonth(),day:d.getUTCDate()};};
const localInstant=(y,m,day,hour,minute=0)=>new Date(Broker.wallToUtc(y,m,day,hour,minute));
const localDate=(date,offset=Broker.offsetAt(date))=>FULL.format(localClock(date,offset));
const localTime=(date,offset=Broker.offsetAt(date))=>HHMM.format(localClock(date,offset));
const stamp=date=>localDate(date)+' · '+localTime(date)+' broker '+zoneName(date)+
  ' / '+localDate(date,WIB)+' · '+localTime(date,WIB)+' WIB';
function script(url){
 return new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src=url;s.async=true;
  s.onload=()=>root.Astronomy?resolve(root.Astronomy):reject(new Error('Library tidak lengkap'));
  s.onerror=()=>reject(new Error('Tidak dapat memuat '+url));
  document.head.append(s);
 });
}
function astronomy(){
 if(root.Astronomy)return Promise.resolve(root.Astronomy);
 if(!enginePromise)enginePromise=(async()=>{
  let last;
  for(const url of [
   'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
   'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js'
  ]){try{return await script(url);}catch(e){last=e;}}
  throw last||new Error('Astronomy Engine tidak tersedia');
 })().catch(err=>{enginePromise=null;throw err;});
 return enginePromise;
}
function nameForAngle(deg){
 const i=Math.floor(((deg%360+360)%360+22.5)/45)%8;
 return {name:DAILY[i],icon:DAILY_ICONS[i]};
}
function within(y,m){return y>=2020&&(y<2040||(y===2040&&m<=11));}
function eventsFor(A,y,m){
 const start=localInstant(y,m,1,0).getTime(),end=localInstant(y,m+1,1,0).getTime();
 let q=A.SearchMoonQuarter(new Date(start-10*DAY));
 const out=[];
 for(let i=0;i<10;i++){
  if(!q||!q.time||!(q.time.date instanceof Date))throw new Error('Format perhitungan fase bulan tidak dikenal');
  const t=q.time.date.getTime();
  if(t>=end)break;
  if(t>=start)out.push({date:q.time.date,quarter:q.quarter});
  q=A.NextMoonQuarter(q);
 }
 return out;
}
function selectDay(A,y,m,day,event){
 selected=day;
 document.querySelectorAll('#moonDays button[data-day]').forEach(b=>{
  const active=Number(b.dataset.day)===day;
  b.classList.toggle('moon-selected',active);
  b.setAttribute('aria-pressed',String(active));
 });
 const d=localInstant(y,m,day,12);
 const dEarly=localInstant(y,m,day,2);
 const angle=A.MoonPhase(d);
 const illumination=Math.round(A.Illumination(A.Body.Moon,d).phase_fraction*100);
 const illuminationEarly=Math.round(A.Illumination(A.Body.Moon,dEarly).phase_fraction*100);
 const phase=nameForAngle(angle);
 const eventText=event?' Momen utama: '+NAMES[event.quarter]+' pada '+stamp(event.date)+'.':'';
 $('moonSelectedDetail').textContent=localDate(d)+': '+phase.icon+' '+phase.name+
  ' · cahaya Bulan '+illuminationEarly+'% pukul 02.00 broker '+zoneName(dEarly)+' ('+
  localTime(dEarly,WIB)+' WIB), dan '+illumination+'% pukul 12.00 broker '+zoneName(d)+'.'+eventText;
}
async function render(){
 const status=$('moonStatus'),prev=$('moonPrev'),next=$('moonNext');
 if(!status||!prev||!next)return;
 prev.disabled=true;next.disabled=true;
 status.textContent='Menghitung fase bulan…';
 try{
  const A=await astronomy();
  const events=eventsFor(A,year,month);
  $('moonTimeBasis').textContent='Mode '+Broker.modeLabel()+'; waktu momen ikut GMT pada tanggalnya. WIB GMT+7 sebagai pembanding.';
  const byDay=new Map(events.map(e=>[Broker.civil(e.date).day,e]));
  const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const first=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
  $('moonMonth').textContent=MONTH.format(new Date(Date.UTC(year,month,1)));
  const grid=$('moonDays');grid.replaceChildren();
  for(let n=0;n<first;n++){const blank=document.createElement('span');blank.className='moon-blank';grid.append(blank);}
  const today=new Date();
  for(let day=1;day<=count;day++){
   const midday=localInstant(year,month,day,12);
   const phase=nameForAngle(A.MoonPhase(midday));
   const pct=Math.round(A.Illumination(A.Body.Moon,midday).phase_fraction*100);
   const e=byDay.get(day);
   const cell=document.createElement('button');cell.type='button';cell.className='moon-day';
   const civilToday=localParts(today,Broker.offsetAt(today));
   if(civilToday.y===year&&civilToday.m===month&&civilToday.day===day)cell.classList.add('moon-today');
   if(e)cell.classList.add('moon-major');
   cell.dataset.day=String(day);
   cell.setAttribute('aria-label',day+' '+MONTH.format(midday)+', '+(e?NAMES[e.quarter]:phase.name)+', terang '+pct+' persen');
   const num=document.createElement('span');num.className='moon-day-number';num.textContent=String(day);
   const icon=document.createElement('span');icon.className='moon-day-icon';icon.textContent=e?ICONS[e.quarter]:phase.icon;icon.setAttribute('aria-hidden','true');
   const amount=document.createElement('small');amount.textContent=pct+'%';
   cell.append(num,icon,amount);
   if(e){const tag=document.createElement('span');tag.className='moon-event-dot';tag.textContent='●';cell.append(tag);}
   cell.addEventListener('click',()=>selectDay(A,year,month,day,byDay.get(day)));
   grid.append(cell);
  }
  const eventList=$('moonEvents');eventList.replaceChildren();
  events.forEach(e=>{
   const item=document.createElement('li');
   const title=document.createElement('strong');title.textContent=ICONS[e.quarter]+' '+NAMES[e.quarter];
   const date=document.createElement('span');date.textContent=stamp(e.date);
   item.append(title,date);eventList.append(item);
  });
  const q=A.SearchMoonQuarter(new Date());
  $('moonNextEvent').textContent='Momen selanjutnya: '+NAMES[q.quarter]+' — '+stamp(q.time.date)+'.';
  const civilToday=localParts(today,Broker.offsetAt(today));
  const current=civilToday.y===year&&civilToday.m===month?civilToday.day:1;
  const target=selected&&selected<=count?selected:current;
  selectDay(A,year,month,target,byDay.get(target));
  status.textContent='Tanggal kalender mengikuti '+Broker.modeLabel()+'. WIB tetap GMT+7; fase utama ditandai titik emas.';
  loaded=true;
  // Publish actual computed phases to the independent XAGUSD saving month view.
  // Never let an optional child panel interrupt the original phase calendar.
  root.CebonkMoonMonthSnapshot={year,month,events};
  try{root.dispatchEvent(new CustomEvent('cebonk-moon-calendar-updated',{detail:root.CebonkMoonMonthSnapshot}));}
  catch(error){console.warn('Monthly saving add-on unavailable:',error);}

 }catch(e){
  status.textContent='Perhitungan tidak tersedia: '+(e&&e.message?e.message:String(e));
  $('moonDays').replaceChildren();$('moonEvents').replaceChildren();
  $('moonNextEvent').textContent='Tidak ada data pengganti yang dibuat-buat.';
 }finally{
  prev.disabled=year===2020&&month===0;
  next.disabled=year===2040&&month===11;
 }
}
function shift(delta){
 const d=new Date(Date.UTC(year,month+delta,1));
 const y=d.getUTCFullYear(),m=d.getUTCMonth();
 if(!within(y,m))return;
 year=y;month=m;selected=null;render();
}
function mount(){
 const view=$('moonCalendarView');if(!view||view.dataset.mounted)return;
 view.dataset.mounted='1';
 const now=localParts(new Date(),Broker.offsetAt(Date.now()));year=now.y;month=now.m;
 view.innerHTML='<div class="head"><div><h2 id="moonCalendarTitle">KALENDER FASE BULAN</h2><small>Tanggal sesuai zona utama · WIB sebagai pembanding</small></div></div>'+
 '<div class="moon-content"><div class="moon-zone"><strong>Acuan kalender: GMT server broker MT5 (perkiraan AUTO)</strong><small id="moonTimeBasis">GMT+2/GMT+3 mengikuti DST New York; WIB GMT+7 tetap. Belum tersambung langsung ke server MT5.</small></div>'+
 '<div class="moon-toolbar"><button id="moonPrev" type="button" aria-label="Bulan sebelumnya">←</button><strong id="moonMonth">—</strong><button id="moonNext" type="button" aria-label="Bulan berikutnya">→</button><button id="moonToday" type="button">Bulan ini</button></div>'+
 '<p id="moonStatus" role="status" aria-live="polite">Memuat kalender…</p>'+
 '<div class="moon-weekdays" aria-hidden="true">'+WEEK.map(x=>'<span>'+x+'</span>').join('')+'</div>'+
 '<div id="moonDays" class="moon-days" role="group" aria-label="Tanggal dan fase bulan"></div>'+
 '<p id="moonSelectedDetail" class="moon-detail">Pilih tanggal untuk rincian.</p>'+
 '<h3>Empat momen utama</h3><ul id="moonEvents" class="moon-events"></ul>'+
 '<p id="moonNextEvent" class="moon-detail"></p>'+
 '<p class="moon-caveat">Fase dihitung dengan Astronomy Engine 2.1.19 berdasarkan posisi geosentris Bulan–Matahari. Persentase harian dalam kotak tanggal dihitung pukul 12.00 jam broker estimasi; rincian tanggal juga menunjukkan pukul 02.00. Tanggal momen mengikuti DST New York (GMT+2/+3), WIB pembanding. Persentase terang bukan kekuatan BUY/SELL atau petunjuk entry XAUUSD.</p></div>';
 $('moonPrev').addEventListener('click',()=>shift(-1));
 $('moonNext').addEventListener('click',()=>shift(1));
 $('moonToday').addEventListener('click',()=>{const d=localParts(new Date(),Broker.offsetAt(Date.now()));year=d.y;month=d.m;selected=d.day;render();});
 root.addEventListener('cebonk-mt5-clock-change',()=>{if(loaded)render();});
 const nav=$('tabMoonCalendar');
 if(nav)nav.addEventListener('click',()=>{if(!loaded)render();});
 if(root.location&&root.location.hash==='#kalender-fase-bulan')render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
