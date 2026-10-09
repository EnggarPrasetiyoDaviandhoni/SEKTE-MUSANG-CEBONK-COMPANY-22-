/* CEBONK BAZI ASTROLOGY v1.0.0
 * Pure traditional calendar analysis. No market prices, trades, or directional signals.
 * Requires 6tail/lunar-javascript v1.7.7 (MIT).
 * Year/month pillars use Beijing civil time for the same UTC instant (Jie Qi);
 * day/hour pillars use Jakarta/WIB civil time. No true-solar-time correction.
 */
(function(root){
'use strict';
const VERSION='1.0.0',HOUR=3600000;
const GAN=[...'甲乙丙丁戊己庚辛壬癸'],ZHI=[...'子丑寅卯辰巳午未申酉戌亥'];
const ELEMENTS=['Kayu','Api','Tanah','Logam','Air'];
const SHIO=['Tikus','Kerbau','Macan','Kelinci','Naga','Ular','Kuda','Kambing','Monyet','Ayam','Anjing','Babi'];
const ANIMAL_ZHI=['Tikus','Kerbau','Macan','Kelinci','Naga','Ular','Kuda','Kambing','Monyet','Ayam','Anjing','Babi'];
const CLASH=['子午','丑未','寅申','卯酉','辰戌','巳亥'];
const HARMONY=['子丑','寅亥','卯戌','辰酉','巳申','午未'];
const mod=(n,m)=>(n%m+m)%m;
function assert(ok,message){if(!ok)throw Error(message);}
function parse(date,time='12:00'){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
 const h=/^(\d{2}):(\d{2})$/.exec(String(time));
 assert(m&&h,'Tanggal atau jam WIB tidak valid.');
 const y=+m[1],mo=+m[2],d=+m[3],hh=+h[1],mm=+h[2];
 assert(y>=1900&&y<=2099&&hh<=23&&mm<=59,'Tanggal 1900–2099 dan jam 00:00–23:59 saja.');
 const check=new Date(Date.UTC(y,mo-1,d));
 assert(check.getUTCFullYear()===y&&check.getUTCMonth()===mo-1&&check.getUTCDate()===d,'Tanggal kalender tidak valid.');
 return {y,mo,d,hh,mm};
}
function wibToUTC(date,time){
 const p=parse(date,time);
 return Date.UTC(p.y,p.mo-1,p.d,p.hh,p.mm)-7*HOUR;
}
function solarParts(ms,offsetHours){
 const x=new Date(ms+offsetHours*HOUR);
 return [x.getUTCFullYear(),x.getUTCMonth()+1,x.getUTCDate(),x.getUTCHours(),x.getUTCMinutes()];
}
function eight(Solar,parts,sect){
 assert(Solar&&typeof Solar.fromYmdHms==='function','Pustaka lunar-javascript belum termuat.');
 const e=Solar.fromYmdHms(...parts,0).getLunar().getEightChar();
 assert(e&&typeof e.getYear==='function','Mesin BaZi tidak kompatibel.');
 if(typeof e.setSect==='function')e.setSect(sect);
 return e;
}
function pillar(text){
 const gan=GAN.indexOf(text?.[0]),zhi=ZHI.indexOf(text?.[1]);
 assert(gan>=0&&zhi>=0,'Hasil pilar BaZi tidak valid: '+text);
 return Object.freeze({text,gan:text[0],zhi:text[1],element:ELEMENTS[Math.floor(gan/2)],branchElement:['Air','Tanah','Kayu','Kayu','Tanah','Api','Api','Tanah','Logam','Logam','Tanah','Air'][zhi],yinYang:gan%2===0?'Yang':'Yin',animal:ANIMAL_ZHI[zhi]});
}
function yearCycle(year){
 assert(Number.isInteger(year)&&year>=1900&&year<=2099,'Tahun di luar cakupan.');
 const i=mod(year-1984,60),gan=GAN[i%10],zhi=ZHI[i%12];
 const p=pillar(gan+zhi);
 return Object.freeze({...p,year,horseFire:gan==='丙'&&zhi==='午'});
}
function relationships(pillars){
 const keys=['year','month','day','hour'],rows=[];
 const kinds=[['CLASH',CLASH],['LIU_HE',HARMONY]];
 for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
  const a=pillars[keys[i]].zhi,b=pillars[keys[j]].zhi;
  for(const [kind,pairs] of kinds)if(pairs.some(p=>p.includes(a)&&p.includes(b))){
   rows.push({kind,from:keys[i],to:keys[j],pair:a+b});
  }
 }
 return rows;
}
function elements(pillars){
 // Eight visible characters only; not a BaZi strength, favorable element, or price probability.
 const counts=Object.fromEntries(ELEMENTS.map(x=>[x,0]));
 for(const p of Object.values(pillars)){counts[p.element]++;counts[p.branchElement]++;}
 return counts;
}
function calculate(Solar,date,time='12:00',sect=2){
 assert(sect===1||sect===2,'Aturan batas hari harus 1 atau 2.');
 const ms=wibToUTC(date,time);
 const beijing=eight(Solar,solarParts(ms,8),sect);
 const jakarta=eight(Solar,solarParts(ms,7),sect);
 const pillars=Object.freeze({
  year:pillar(beijing.getYear()),
  month:pillar(beijing.getMonth()),
  day:pillar(jakarta.getDay()),
  hour:pillar(jakarta.getTime())
 });
 return Object.freeze({date,time,ms,sect,pillars,elements:elements(pillars),relationships:relationships(pillars)});
}
function periods(Solar,date,sect=2){
 parse(date,'00:00');
 const slots=[0,1,3,5,7,9,11,13,15,17,19,21,23];
 return slots.map((h,i)=>{
  const start=String(h).padStart(2,'0')+':00',end=i===0?'00:59':i===12?'23:59':String(h+1).padStart(2,'0')+':59';
  return {...calculate(Solar,date,start,sect),range:start+'–'+end};
 });
}
function years(first=1912,last=2055){
 assert(Number.isInteger(first)&&Number.isInteger(last)&&first>=1900&&last<=2099&&last>=first,'Rentang tahun tidak valid.');
 return Array.from({length:last-first+1},(_,i)=>yearCycle(first+i));
}
function todayWIB(now=Date.now()){
 const x=new Date(now+7*HOUR);
 return {date:x.toISOString().slice(0,10),time:x.toISOString().slice(11,16)};
}
const API=Object.freeze({VERSION,GAN,ZHI,ELEMENTS,SHIO,parse,wibToUTC,solarParts,pillar,yearCycle,calculate,periods,years,todayWIB});
root.CebonkBazi=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
