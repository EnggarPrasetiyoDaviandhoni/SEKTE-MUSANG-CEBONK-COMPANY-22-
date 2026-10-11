/* CEBONK KALENDER TIONGHOA SURYA v1.0 — 24 titik musim astronomis.
 * 12 Jie membuka periode bulan surya BaZi, 12 Qi menandai tengah periode.
 * 4 gerbang musim tahunan: Semi (315°), Panas (45°), Gugur (135°), Dingin (225°).
 * HANYA kalender. Arah Astrology dari mesin riset lama CebonkCore, terpisah.
 */
(function(root){
'use strict';
const WIB=7*3600000,DAY=86400000,MIN=60000;
const SPEC=Object.freeze([
 ['Dingin Kecil',285,1,5,'Kerbau'],['Dingin Besar',300,1,20,null],
 ['Awal Musim Semi',315,2,4,'Macan'],['Air Hujan',330,2,19,null],
 ['Bangkitnya Serangga',345,3,5,'Kelinci'],['Ekuinoks Semi',0,3,20,null],
 ['Terang dan Jernih',15,4,5,'Naga'],['Hujan Biji',30,4,20,null],
 ['Awal Musim Panas',45,5,5,'Ular'],['Tumbuhan Mulai Penuh',60,5,21,null],
 ['Biji Berbulir',75,6,5,'Kuda'],['Titik Balik Matahari Juni',90,6,21,null],
 ['Panas Kecil',105,7,7,'Kambing'],['Panas Besar',120,7,23,null],
 ['Awal Musim Gugur',135,8,7,'Monyet'],['Akhir Panas',150,8,23,null],
 ['Embun Putih',165,9,7,'Ayam'],['Ekuinoks Gugur',180,9,23,null],
 ['Embun Dingin',195,10,8,'Anjing'],['Turunnya Embun Beku',210,10,23,null],
 ['Awal Musim Dingin',225,11,7,'Babi'],['Salju Kecil',240,11,22,null],
 ['Salju Besar',255,12,7,'Tikus'],['Titik Balik Matahari Desember',270,12,22,null]
].map(([name,angle,month,day,animal])=>Object.freeze({
 name,angle,month,day,animal,kind:animal?'JIE':'QI',
 season:angle===315?'Semi':angle===45?'Panas':angle===135?'Gugur':angle===225?'Dingin':null
})));
const FOUR=Object.freeze(['Semi','Panas','Gugur','Dingin']);
function valid(c,msg){if(!c)throw Error(msg);}
function wib(ms){
 const d=new Date(ms+WIB);
 return Object.freeze({date:d.toISOString().slice(0,10),time:d.toISOString().slice(11,16),month:d.getUTCMonth()+1,weekday:d.getUTCDay()});
}
function weekend(ms){
 const t=new Date(ms+WIB),day=t.getUTCDay();
 if(day!==0&&day!==6)return null;
 const midnight=Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate());
 const iso=x=>new Date(x).toISOString().slice(0,10);
 return Object.freeze({eventDate:iso(midnight),friday:iso(midnight-(day===6?1:2)*DAY),monday:iso(midnight+(day===6?2:1)*DAY)});
}
function yearTerms(A,year){
 valid(Number.isInteger(year)&&year>=2020&&year<=2040,'Tahun kalender 2020–2040 saja.');
 valid(A&&typeof A.SearchSunLongitude==='function','Astronomy Engine untuk titik musim surya tidak tersedia.');
 const entries=SPEC.map(spec=>{
  // Known seasonal window (± 4 days); the astronomical root determines exact time.
  const start=Date.UTC(year,spec.month-1,spec.day-4,0);
  const hit=A.SearchSunLongitude(spec.angle,new Date(start),9);
  valid(hit&&hit.date instanceof Date&&Number.isFinite(+hit.date),'Titik musim '+spec.name+' gagal dihitung.');
  const ms=+hit.date,local=wib(ms);
  valid(ms>=start&&ms<=start+9*DAY&&local.month===spec.month,'Titik musim '+spec.name+' di luar bulan yang diharapkan.');
  return Object.freeze({...spec,ms,wib:local,bridge:weekend(ms)});
 });
 valid(entries.length===24&&entries.every((e,i)=>i===0||e.ms>entries[i-1].ms),'Urutan 24 titik musim tidak lengkap.');
 valid(entries.filter(e=>e.kind==='JIE').length===12&&entries.filter(e=>e.season).length===4,'Titik awal musim tidak lengkap.');
 return Object.freeze({year,events:Object.freeze(entries),seasons:Object.freeze(entries.filter(e=>e.season))});
}
function filterMonth(data,month){
 valid(data&&Array.isArray(data.events),'Kalender tahunan belum dihitung.');
 valid(Number.isInteger(month)&&month>=1&&month<=12,'Bulan kalender tidak valid.');
 return data.events.filter(x=>x.wib.month===month);
}
const api=Object.freeze({VERSION:'1.0.0',SPEC,FOUR,wib,weekend,yearTerms,filterMonth});
root.CebonkChineseCalendar=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
