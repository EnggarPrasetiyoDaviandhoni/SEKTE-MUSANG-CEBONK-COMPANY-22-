/* Primbon Betaljemur Adammakna No.159 (Sri untuk dagang) dan No.147 (Saat Agung).
 * Observasi tradisi, BUKAN syarat order / probabilitas profit XAUUSD.
 * Sources: jv.wikisource.org/wiki/Kaca:Kitab_Primbon_Betaljemur_Adammakna.pdf/125
 *          jv.wikisource.org/wiki/Kaca:Kitab_Primbon_Betaljemur_Adammakna.pdf/119
 * Anchor pasaran 2026-10-12 = Senin Pahing, corroborated by calendar 2026 sources.
 */
(function(root){
'use strict';
const DAY=86400000,WIB=7*3600000;
const DAY_NAME=Object.freeze(['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']);
const PASARAN=Object.freeze(['Legi','Pahing','Pon','Wage','Kliwon']);
const SRI=Object.freeze(['Pon','Kliwon','Pahing','Wage','Pahing','Wage','Legi']);
const SAAT_NAME=Object.freeze(['Wiji','Cahya','Lara','Rejeki','Malaekat','Puji','Pati']);
const SAAT_GOOD=Object.freeze(['Wiji','Cahya','Rejeki']);
// Tabel jam No.147; 11–1 interpreted as 11:00–13:00,
// 1–3 as 13:00–15:00 where table follows 11–1, else 01:00–03:00.
// Out-of-table hours deliberately remain unclassified.
const SAAT_START_END=Object.freeze([
 [6,8,10,11,13,15,17,18],
 [4,6,8,9,11,13,15,16],
 [2,4,6,7,9,11,13,14],
 [1,3,5,6,8,10,12,13],
 [11,13,15,16,18,20,22,23],
 [9,11,13,14,16,18,20,21],
 [7,9,11,12,14,16,18,19]
].map(row=>Object.freeze(row)));
const ANCHOR=Date.UTC(2026,9,12)/DAY, ANCHOR_PASARAN=1;
const mod=(a,n)=>((a%n)+n)%n;
const pad=n=>String(n).padStart(2,'0');
const fmt=minutes=>pad(Math.floor(minutes/60))+':'+pad(minutes%60);
function evaluate(utcMs,{sunsetMinuteWIB=18*60}={}){
 if(!Number.isFinite(utcMs)||!Number.isInteger(sunsetMinuteWIB)||
  sunsetMinuteWIB<0||sunsetMinuteWIB>=1440)
  throw Error('Waktu UTC utawa asumsi pergantian dina ora valid.');
 const localMs=utcMs+WIB;
 const localDate=new Date(localMs);
 const minute=localDate.getUTCHours()*60+localDate.getUTCMinutes();
 const shifted=localMs+(minute>=sunsetMinuteWIB?DAY:0);
 const jawaDay=Math.floor(shifted/DAY),weekday=new Date(shifted).getUTCDay();
 const civilWeekday=localDate.getUTCDay();
 const index=mod(ANCHOR_PASARAN+(jawaDay-ANCHOR),5);
 const pasaran=PASARAN[index];
 const from=SAAT_START_END[civilWeekday],hour=minute/60;
 let saat=null;
 for(let k=0;k<SAAT_NAME.length;k++){
  if(hour>=from[k]&&hour<from[k+1]){
   const name=SAAT_NAME[k];
   saat={name,good:SAAT_GOOD.includes(name),startWIB:fmt(from[k]*60),endWIB:fmt(from[k+1]*60)};
   break;
  }
 }
 return Object.freeze({
  civilDateWIB:localDate.toISOString().slice(0,10),
  jawaDateWIB:new Date(shifted).toISOString().slice(0,10),
  weekday:DAY_NAME[weekday],pasaran,
  weton:DAY_NAME[weekday]+' '+pasaran,
  sri:pasaran===SRI[weekday],
  sriLabel:pasaran===SRI[weekday]?'SRI':'DUDU SRI',
  saatAgung:saat,
  saatAgungLabel:saat?.name||'DI LUAR TABEL',
  sunsetMinuteWIB,atWIB:localDate.toISOString().slice(11,16)+' WIB',
  observationOnly:true
 });
}
const API=Object.freeze({evaluate,DAY_NAME,PASARAN,SAAT_NAME,SAAT_GOOD,SAAT_START_END});
root.CebonkPrimbonDagang=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
