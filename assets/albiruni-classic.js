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
const API=Object.freeze({BODIES,SIGNS,DOMICILE,EXALTATION,ELEMENT,TRIPLICITY,FACE_CYCLE,normalize,position,assess});
root.CebonkAlBiruniClassic=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
