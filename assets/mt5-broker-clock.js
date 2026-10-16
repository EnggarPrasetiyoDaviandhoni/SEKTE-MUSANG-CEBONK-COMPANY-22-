/* CEBONK MT5 Broker Clock v1.0
 * Estimated NY-close broker clock: GMT+3 during US DST, GMT+2 outside it.
 * This is NOT a live MT5 connection. Browser/GitHub Pages cannot know broker server offset
 * without authenticated external bridge. Manual corrections are supported.
 */
(function(root){
'use strict';
const MIN=60000;
const now=()=>Date.now();
const validModes=Object.freeze(['AUTO','GMT2','GMT3']);
let mode='AUTO';
const pad=n=>String(n).padStart(2,'0');
const utcDate=ms=>{const d=new Date(ms);return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;};
function nthSunday(year,month,n){
 const first=new Date(Date.UTC(year,month,1)).getUTCDay();
 return 1+((7-first)%7)+7*(n-1);
}
function bounds(year){
 // US: second Sunday March 02:00 EST = 07:00 UTC,
 // first Sunday November 02:00 EDT = 06:00 UTC.
 return {start:Date.UTC(year,2,nthSunday(year,2,2),7),
         end:Date.UTC(year,10,nthSunday(year,10,1),6)};
}
function offsetAt(value){
 const t=value instanceof Date?value.getTime():Number(value);
 if(!Number.isFinite(t))throw Error('Timestamp tidak valid');
 if(mode==='GMT2')return 120;
 if(mode==='GMT3')return 180;
 const y=new Date(t).getUTCFullYear(),b=bounds(y);
 return t>=b.start&&t<b.end?180:120;
}
function civil(value){
 const t=value instanceof Date?value.getTime():Number(value);
 const offset=offsetAt(t),d=new Date(t+offset*MIN);
 return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),
         hour:d.getUTCHours(),minute:d.getUTCMinutes(),second:d.getUTCSeconds(),offset};
}
function civilDate(value){const p=civil(value);return `${p.year}-${pad(p.month)}-${pad(p.day)}`;}
function civilTime(value){const p=civil(value);return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;}
function wallToUtc(year,monthZero,day,hour=0,minute=0){
 const naive=Date.UTC(year,monthZero,day,hour,minute);
 let guess=naive-(mode==='GMT2'?120:180)*MIN;
 // Recheck DST on actual UTC instant; switches happen Sunday when gold market is closed.
 for(let i=0;i<3;i++){const correct=naive-offsetAt(guess)*MIN;if(correct===guess)break;guess=correct;}
 return guess;
}
function currentMode(){return mode;}
function modeLabel(){return mode==='AUTO'?'AUTO · New York DST (perkiraan)':mode==='GMT2'?'GMT+2 manual':'GMT+3 manual';}
function label(value){return 'GMT+'+(offsetAt(value)/60);}
function setMode(value){
 if(!validModes.includes(value))throw Error('Pilihan GMT broker tidak valid.');
 if(value===mode)return;
 mode=value;
 try{root.dispatchEvent(new CustomEvent('cebonk-mt5-clock-change',{detail:{mode}}));}
 catch(_){root.dispatchEvent(new Event('cebonk-mt5-clock-change'));}
}
function mount(){
 if(document.getElementById('brokerStatusBox'))return;
 const clocks=document.querySelector('#astroView .clocks');
 if(!clocks)return;
 const panel=document.createElement('section');panel.id='brokerStatusBox';panel.className='broker-clock-panel';
 panel.innerHTML='<div><strong>JAM BROKER MT5 (ESTIMASI)</strong><span id="brokerClockTime">—</span></div><div><small id="brokerClockDate">—</small><small id="brokerClockMethod">—</small></div>'+
 '<label>Mode GMT server <select id="brokerClockSelect" aria-label="Mode GMT server MT5"><option value="AUTO">AUTO · New York DST</option><option value="GMT2">Paksa GMT+2</option><option value="GMT3">Paksa GMT+3</option></select></label>'+
 '<p>Bukan koneksi langsung ke MT5. AUTO mengikuti jadwal DST New York; verifikasi dengan jam server broker pada MT5.</p>';
 clocks.insertAdjacentElement('afterend',panel);
 const select=panel.querySelector('#brokerClockSelect');
 select.value=mode;
 select.addEventListener('change',()=>setMode(select.value));
 function tick(){
  const t=now(),c=civil(t);
  panel.querySelector('#brokerClockTime').textContent=civilTime(t)+' GMT+'+(c.offset/60);
  panel.querySelector('#brokerClockDate').textContent=civilDate(t)+' · '+modeLabel();
  panel.querySelector('#brokerClockMethod').textContent='WIB GMT+7 · beda '+(420-c.offset)/60+' jam';
  select.value=mode;
 }
 root.addEventListener('cebonk-mt5-clock-change',tick);
 tick();root.setInterval(tick,1000);
}
root.CebonkMt5BrokerTime=Object.freeze({offsetAt,civil,civilDate,civilTime,wallToUtc,bounds,label,setMode,currentMode,modeLabel});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
