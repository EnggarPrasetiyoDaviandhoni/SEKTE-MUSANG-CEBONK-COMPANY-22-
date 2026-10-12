/* AL-BIRUNI KLASIK — research-only essential dignities, isolated from trading.
 * Source: user's Al-Biruni / Wright 1934 PDF (128 pages):
 * PDF p.37 §409–411 (gold symbolism), p.50 §440 (domiciles),
 * p.52 §443 (exaltation), p.53 §445 (triplicity),
 * p.56–57 §449/451 (faces), p.59 §453 (competing terms),
 * p.101–102 §493–494 (dignity scoring 5/4/3/2/1).
 * The book does NOT provide a BUY/SELL XAUUSD formula.
 */
(function(root){
'use strict';
const BODIES=Object.freeze(['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn']);
const SIGNS=Object.freeze(['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']);
const DOMICILE=Object.freeze(['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter']);
const EXALTATION=Object.freeze({Sun:0,Moon:1,Mercury:5,Venus:11,Mars:9,Jupiter:3,Saturn:6});
const ELEMENT=Object.freeze(['fire','earth','air','water','fire','earth','air','water','fire','earth','air','water']);
// §445: day lord, night lord, and the partner common to both.
const TRIPLICITY=Object.freeze({
 fire:Object.freeze({day:'Sun',night:'Jupiter',partner:'Saturn'}),
 earth:Object.freeze({day:'Venus',night:'Moon',partner:'Mars'}),
 air:Object.freeze({day:'Saturn',night:'Mercury',partner:'Jupiter'}),
 water:Object.freeze({day:'Venus',night:'Mars',partner:'Moon'})
});
// §449: Chaldean order, Aries starts Mars / Sun / Venus.
const FACE_CYCLE=Object.freeze(['Mars','Sun','Venus','Mercury','Moon','Saturn','Jupiter']);
function assert(condition,message){if(!condition)throw Error(message);}
function normalize(x){assert(Number.isFinite(x),'Bujur planet tidak valid.');return ((x%360)+360)%360;}
function position(body,longitude,sect){
 assert(BODIES.includes(body),'Planet klasik tidak valid.');
 assert(sect==='day'||sect==='night','Pilih siang atau malam secara eksplisit.');
 const norm=normalize(longitude);
 const index=Math.floor(norm/30),degree=norm-index*30;
 const element=ELEMENT[index],trip=TRIPLICITY[element];
 const face=FACE_CYCLE[(index*3+Math.floor(degree/10))%7];
 const points=Object.freeze({
  domicile:DOMICILE[index]===body?5:0,
  exaltation:EXALTATION[body]===index?4:0,
  term:null, // §453 lists Egyptian/Ptolemaic alternatives: no silent invented +3.
  triplicity:(trip[sect]===body||trip.partner===body)?2:0,
  face:face===body?1:0
 });
 const subtotal=points.domicile+points.exaltation+points.triplicity+points.face;
 return Object.freeze({body,longitude:norm,sign:SIGNS[index],signDegree:degree,
  element,sect,faceLord:face,triplicity:trip,points,subtotal,
  complete:false,termStatus:'BELUM_DIPILIH_MESIR_ATAU_PTOLEMAIOS',
  detriment:DOMICILE[(index+6)%12]===body,
  fall:EXALTATION[body] === ((index+6)%12)});
}
function assess(longitudes,sect){
 assert(longitudes&&typeof longitudes==='object','Posisi planet belum tersedia.');
 const rows=BODIES.map(body=>position(body,longitudes[body],sect))
  .sort((a,b)=>b.subtotal-a.subtotal||BODIES.indexOf(a.body)-BODIES.indexOf(b.body));
 return Object.freeze({
  model:'ALBIRUNI_CLASSICAL_PARTIAL_V1',kind:'RESEARCH_ONLY',
  marketValidated:false,tradingDirection:null,sect,
  completeDignity:false,rows,
  limitations:'Term 3 poin tidak dihitung; siang/malam dipilih manual; tidak menghitung Ascendant, house, latitude conjunction, atau BUY/SELL.',
  reference:'The Book of Instruction, PDF pp.37, 50-59, 98-102, 126-127'
 });
}

// §527 astronomical prerequisites: local ascendant and natural day/night.
// Astronomy Engine gives apparent Greenwich sidereal time and unrefracted Sun altitude.
// Obliquity is mean of date (Meeus polynomial); resulting ASC is an approximation.
const ASPECTS=Object.freeze([0,60,90,120,180]);
const BENEFICS=Object.freeze(['Venus','Jupiter']);
const MALEFICS=Object.freeze(['Mars','Saturn']);
const RAD=Math.PI/180;
function signed(deg){return ((deg+180)%360+360)%360-180;}
function meanObliquity(ms){
 assert(Number.isFinite(ms),'Waktu tidak valid.');
 const t=((ms/86400000+2440587.5)-2451545)/36525;
 return 23.439291111-0.013004167*t-0.0000001639*t*t+0.0000005036*t*t*t;
}
function observerCheck(latitude,longitude){
 assert(Number.isFinite(latitude)&&latitude>=-89.9&&latitude<=89.9,'Lintang lokasi harus -89.9 sampai 89.9°.');
 assert(Number.isFinite(longitude)&&longitude>=-180&&longitude<=180,'Bujur lokasi harus -180 sampai 180°.');
}
// Eastern ecliptic-horizon intersection, converted back to ecliptic longitude.
// We explicitly choose the east-facing root, not the setting/Descendant root.
function ascendant(siderealHours,latitude,longitude,obliquity){
 observerCheck(latitude,longitude);
 assert(Number.isFinite(siderealHours)&&Number.isFinite(obliquity),'Parameter ASC tidak valid.');
 const theta=normalize(siderealHours*15+longitude)*RAD,phi=latitude*RAD,eps=obliquity*RAD;
 const cp=Math.cos(phi),sp=Math.sin(phi),ce=Math.cos(eps),se=Math.sin(eps);
 let x=-se*sp-ce*cp*Math.sin(theta);
 let y=ce*cp*Math.cos(theta),z=se*cp*Math.cos(theta);
 // Local due east direction in the equatorial frame.
 if(x*(-Math.sin(theta))+y*Math.cos(theta)<0){x=-x;y=-y;z=-z;}
 const eclipticY=y*ce+z*se;
 return normalize(Math.atan2(eclipticY,x)/RAD);
}
function aspectBetween(first,second,orb){
 assert(Number.isFinite(orb)&&orb>0&&orb<=15,'Orb pemeriksaan harus >0 dan <=15°.');
 const gap=Math.abs(signed(normalize(second)-normalize(first)));
 const nearest=ASPECTS.map(angle=>({angle,orb:Math.abs(gap-angle)}))
  .sort((a,b)=>a.orb-b.orb)[0];
 return nearest.orb<=orb?Object.freeze({angle:nearest.angle,orb:nearest.orb}):null;
}
function chart(A,engine,ms,{latitude,longitude,orb=2}={}){
 observerCheck(latitude,longitude);
 assert(A&&typeof A.MakeTime==='function'&&typeof A.SiderealTime==='function'&&
  typeof A.Observer==='function'&&typeof A.Equator==='function'&&
  typeof A.Horizon==='function','Ephemeris astronomi tidak cukup untuk menghitung Ascendant.');
 assert(engine&&typeof engine.longitude==='function','Engine posisi planet belum ada.');
 assert(Number.isFinite(ms),'Waktu perhitungan tidak valid.');
 const t=A.MakeTime(new Date(ms)),siderealHours=A.SiderealTime(t);
 const eps=meanObliquity(ms);
 const ascending=ascendant(siderealHours,latitude,longitude,eps);
 const solar=A.Equator('Sun',t,new A.Observer(latitude,longitude,0),true,true);
 const altitude=A.Horizon(t,new A.Observer(latitude,longitude,0),solar.ra,solar.dec).altitude;
 assert(Number.isFinite(altitude),'Altitudo Matahari tidak valid.');
 const sect=altitude>=0?'day':'night';
 const longitudes=Object.fromEntries(BODIES.map(body=>[body,engine.longitude(body,ms)]));
 const dignities=assess(longitudes,sect);
 const risingRuler=DOMICILE[Math.floor(ascending/30)];
 const lunarRuler=DOMICILE[Math.floor(normalize(longitudes.Moon)/30)];
 // The source does not specify a XAUUSD indicator. Sun is included here
 // as a historical symbolic gold association (§410), NOT a market oracle.
 const significators=[
  {id:'ASC',longitude:ascending,label:'Ascendant'},
  {id:risingRuler,longitude:longitudes[risingRuler],label:'Penguasa Ascendant'},
  {id:'Moon',longitude:longitudes.Moon,label:'Bulan'},
  {id:lunarRuler,longitude:longitudes[lunarRuler],label:'Penguasa tanda Bulan'},
  {id:'Sun',longitude:longitudes.Sun,label:'Matahari (asosiasi emas §410)'}
 ];
 const contacts=[];
 for(const actor of [...BENEFICS,...MALEFICS]){
  for(const target of significators){
   if(actor===target.id)continue;
   const a=aspectBetween(longitudes[actor],target.longitude,orb);
   if(!a)continue;
   contacts.push(Object.freeze({
    actor,target:target.label,angle:a.angle,orb:a.orb,
    role:BENEFICS.includes(actor)?'BENEFIC':'MALEFIC'
   }));
  }
 }
 const beneficCount=contacts.filter(x=>x.role==='BENEFIC').length;
 const maleficCount=contacts.length-beneficCount;
 const indication=beneficCount&&maleficCount?'CAMPURAN':
  beneficCount?'KONTAK_BENEFIC':maleficCount?'KONTAK_MALEFIC':'BELUM_ADA_KONTAK';
 const moonAscRuler=aspectBetween(longitudes.Moon,longitudes[risingRuler],orb);
 const moonGold=aspectBetween(longitudes.Moon,longitudes.Sun,orb);
 return Object.freeze({
  model:'ALBIRUNI_CLASSICAL_ELECTIONAL_PARTIAL_V2',kind:'RESEARCH_ONLY',
  ms,latitude,longitude,orb,obliquityDegrees:eps,
  ascendant:ascending,ascendantSign:SIGNS[Math.floor(ascending/30)],
  ascendantRuler:risingRuler,lunarSign:SIGNS[Math.floor(normalize(longitudes.Moon)/30)],
  lunarRuler,sunAltitudeDegrees:altitude,sect,
  twilightUncertain:Math.abs(altitude)<0.5,
  longitudes,significators,contacts,indication,moonAscRuler,moonGold,
  beneficCount,maleficCount,dignities,
  // Explicit missing steps of §527 and §453: no market direction at all.
  termSystem:'UNSELECTED_EGYPTIAN_OR_PTOLEMAIC',
  fullElectional:false,marketValidated:false,tradingDirection:null,
  limitations:'Kontak aspek dan martabat parsial saja; ASC tropikal geometri dan siang/malam otomatis. Term, seluruh house, occultation, konjungsi lintang, serta interpretasi urusan spesifik belum lengkap. Tidak ada formula BUY/SELL XAUUSD dari kitab.',
  sourcePages:'Al-Biruni Wright 1934 PDF pp.37, 50-59, 98-102, 126-127'
 });
}

const API=Object.freeze({BODIES,SIGNS,DOMICILE,EXALTATION,ELEMENT,TRIPLICITY,FACE_CYCLE,ASPECTS,BENEFICS,MALEFICS,normalize,position,assess,ascendant,meanObliquity,aspectBetween,chart});
root.CebonkAlBiruniClassic=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
