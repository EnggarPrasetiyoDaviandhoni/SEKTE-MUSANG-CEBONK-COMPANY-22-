/* ASTRODOX M1 v1.0.0 — independent minute-resolution research layer.
 * Computes fresh astronomical positions every 60 seconds with CebonkCore.
 * V1 BUY/SELL is an unvalidated aspect-score heuristic, NOT a price forecast.
 * Zodiac elements and illustrated planetary roles are INTERPRETATIONS only:
 * no invented directional weights, broker data, orders, or EA requests.
 */
(function(root){
'use strict';
const C=root.CebonkCore;
if(!C)return;
const MINUTE=60000,VERSION='1.0.0';
const ELEMENTS=Object.freeze({
  Aries:'API',Leo:'API',Sagittarius:'API',
  Taurus:'TANAH',Virgo:'TANAH',Capricorn:'TANAH',
  Gemini:'UDARA',Libra:'UDARA',Aquarius:'UDARA',
  Cancer:'AIR',Scorpio:'AIR',Pisces:'AIR'
});
const ELEMENT_INFO=Object.freeze({
  API:'Agresivitas, momentum, potensi breakout (hipotesis)',
  TANAH:'Stabilitas, konsolidasi dan area support/resistance (hipotesis)',
  UDARA:'Kepekaan berita, volatilitas dan ketidakpastian (hipotesis)',
  AIR:'Likuiditas, emosi pasar dan potensi reversal (hipotesis)'
});
const ROLES=Object.freeze({
 Sun:{name:'Matahari',role:'Tren makro',detail:'Konteks arah harian'},
 Moon:{name:'Bulan',role:'Timing',detail:'Konteks waktu entry/exit'},
 Mercury:{name:'Merkurius',role:'Data ekonomi',detail:'Konteks informasi dan berita'},
 Venus:{name:'Venus',role:'Retracement',detail:'Konteks koreksi'},
 Mars:{name:'Mars',role:'Momentum',detail:'Konteks pergerakan agresif'},
 Jupiter:{name:'Jupiter',role:'Ekspansi',detail:'Konteks kelanjutan/ekspansi'},
 Saturn:{name:'Saturnus',role:'Manajemen risiko',detail:'Konteks kehati-hatian'},
 Uranus:{name:'Uranus',role:'Volatilitas',detail:'Konteks lonjakan dan perubahan'},
 Neptune:{name:'Neptunus',role:'Fakeout',detail:'Konteks sinyal menipu'},
 Pluto:{name:'Pluto',role:'Transformasi',detail:'Konteks perubahan fase tren'}
});
function must(ok,msg){if(!ok)throw Error(msg);}
function zodiac(lon){
 must(Number.isFinite(lon),'Longitude planet tidak valid.');
 const norm=C.norm(lon),sign=C.CFG.zodiac[Math.floor(norm/30)];
 return {sign,element:ELEMENTS[sign],degree:norm%30,longitude:norm};
}
function interpret(sample){
 const planetAspects=sample.active.filter(a=>!a.local);
 const totalBuy=planetAspects.reduce((s,a)=>s+Math.max(0,a.impact),0);
 const totalSell=planetAspects.reduce((s,a)=>s+Math.max(0,-a.impact),0);
 const total=totalBuy+totalSell;
 const zodiacCounts={API:0,TANAH:0,UDARA:0,AIR:0};
 const planetPositions=C.CFG.planets.map(p=>{
   const pos=sample.positions[p.id];
   must(pos&&Number.isFinite(pos.lon),'Data longitude '+p.id+' tidak lengkap.');
   const z=zodiac(pos.lon);
   zodiacCounts[z.element]++;
   return {id:p.id,name:ROLES[p.id].name,role:ROLES[p.id].role,detail:ROLES[p.id].detail,...z};
 });
 const topElements=Object.entries(zodiacCounts).sort((a,b)=>b[1]-a[1]);
 const prominent=topElements[0][1]===topElements[1][1]?'CAMPURAN':topElements[0][0];
 const hints=[];
 if(planetAspects.some(a=>a.name==='Square'||a.name==='Opposition'))hints.push('Aspek tegang: potensi reversal (hipotesis)');
 if(planetAspects.some(a=>a.name==='Trine'||a.name==='Sextile'))hints.push('Aspek harmonis: potensi kelanjutan (hipotesis)');
 if(planetAspects.some(a=>a.name==='Conjunction'))hints.push('Konjungsi: perubahan atau intensitas (hipotesis)');
 const alertPlanets=[['Moon','Timing Bulan'],['Uranus','Volatilitas Uranus'],['Neptune','Fakeout Neptunus'],['Saturn','Risiko Saturnus'],['Mars','Momentum Mars'],['Jupiter','Ekspansi Jupiter']];
 for(const [id,label] of alertPlanets){
   if(planetAspects.some(a=>a.id1===id||a.id2===id))hints.push(label+' aktif secara aspek (interpretasi)');
 }
 const aspects=sample.active.map(a=>({
   id1:a.id1,id2:a.id2,local:a.local,name:a.name,angle:a.angle,
   orb:a.orb,phase:a.phase,impact:a.impact,
   type:a.name==='Trine'||a.name==='Sextile'?'HARMONIS':
        a.name==='Square'||a.name==='Opposition'?'TEGANG':'KONJUNGSI'
 })).sort((a,b)=>a.orb-b.orb);
 return {
  ms:sample.ms,state:sample.state,score:sample.score,
  buyWeight:totalBuy,sellWeight:totalSell,
  buyPct:total>0?100*totalBuy/total:null,
  sellPct:total>0?100*totalSell/total:null,
  aspects,planetPositions,zodiacCounts,prominentElement:prominent,
  elementMeaning:prominent==='CAMPURAN'?'Tidak ada elemen tunggal yang dominan':ELEMENT_INFO[prominent],
  hints,
  validation:'MODEL_V1_TIDAK_TERVALIDASI',tradingDecision:'WAIT'
 };
}
async function calculateHour(engine,date,hour,onProgress=()=>{},cancelled=()=>false){
 must(engine&&typeof engine.get==='function','Engine astronomi tidak tersedia.');
 C.Time.parseDate(date);
 must(Number.isInteger(hour)&&hour>=0&&hour<24,'Jam WIB harus 00–23.');
 const start=C.Time.wibToUTC(date,hour*60);
 const positions=[];
 // 1 minute grid + two edge snapshots to determine direction changes.
 for(let i=-2;i<=60;i++){
   must(!cancelled(),'Perhitungan M1 dibatalkan.');
   positions.push(engine.get(start+i*MINUTE));
   if((i+2)%8===0){
     onProgress(Math.min(94,Math.round((i+3)/63*94)));
     await new Promise(r=>setTimeout(r,0));
   }
 }
 const result=[];
 let previousScore=C.analyse(positions[0],positions[1],positions[2],true).score;
 for(let i=0;i<60;i++){
   must(!cancelled(),'Perhitungan M1 dibatalkan.');
   const s=C.analyse(positions[i+1],positions[i+2],positions[i+3],true);
   s.state=C.classify(s.score,previousScore);
   previousScore=s.score;
   result.push(interpret(s));
 }
 onProgress(100);
 return Object.freeze({version:VERSION,mode:'ASTRODOX_M1_RESEARCH',date,hour,
  stepMinutes:1,minutes:60,rows:result,model:'EXISTING_ASTROLOGY_V1_RECALCULATED_EACH_MINUTE',
  planetInterpretation:'DESCRIPTIVE_ONLY',directionValidated:false,
  tradingDecision:'WAIT'});
}
const API=Object.freeze({VERSION,ELEMENTS,ELEMENT_INFO,ROLES,zodiac,interpret,calculateHour});
root.CebonkAstrodoxM1=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);