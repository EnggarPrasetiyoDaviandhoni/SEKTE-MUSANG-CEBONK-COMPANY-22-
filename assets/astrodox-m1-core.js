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
const MINUTE=60000,VERSION='1.1.0';
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

/* Bobot V2 adalah asumsi eksplisit untuk riset, bukan koefisien terlatih harga emas.
 * Diterapkan pada magnitudo kontribusi aspek V1, bukan posisi planet saja.
 * Interpretasi Lilith dihitung terpisah: tanpa polaritas BUY/SELL buatan.
 */
const ROLE_FACTORS=Object.freeze({
 Sun:1.10,Moon:1.20,Mercury:1.00,Venus:0.95,Mars:1.15,
 Jupiter:1.15,Saturn:1.10,Uranus:1.10,Neptune:1.05,Pluto:1.10
});
const ELEMENT_FACTORS=Object.freeze({API:1.08,TANAH:1.02,UDARA:1.04,AIR:1.00});
const V2_ASSUMPTIONS=Object.freeze({
 version:'EXPERIMENTAL_CONFIG_WEIGHTING_V2',
 coefficientsSource:'ASSUMPTIONS_NOT_CALIBRATED',
 roleFactors:ROLE_FACTORS,elementFactors:ELEMENT_FACTORS,
 buyThreshold:1.15,sellThreshold:-1.15,
 lilithDirectionalWeight:0,
 validation:'BELUM_BACKTEST_XAUUSD'
});
/* Approximate mean lunar apogee, not "true"/osculating Lilith.
 * Meeus mean lunar perigee 83.3532465° + 4069.0137287*T ... plus 180°.
 * T uses UT instead of TT (difference below 0.0002° in modern dates).
 * Source: Meeus, Astronomical Algorithms (mean lunar perigee polynomial).
 */
function meanLilith(ms){
 must(Number.isFinite(ms),'Waktu Lilith tidak valid.');
 const T=(ms-Date.UTC(2000,0,1,12))/(36525*86400000);
 const perigee=83.3532465+T*(4069.0137287+T*(-0.01032+T*(-1/80053+T/18999000)));
 return Object.freeze({longitude:C.norm(perigee+180),method:'MEAN_APOGEE_APPROX_MEEUS_UT'});
}
function calculateLilithAspects(ms,planetPositions){
 const lil=meanLilith(ms),pos=new Map(planetPositions.map(x=>[x.id,x]));
 const aspects=[];
 for(const p of C.CFG.planets){
  const lon=pos.get(p.id).longitude;
  for(const a of C.CFG.aspects){
   const g=C.aspectGeometry(lon,lil.longitude,a);
   if(g.orb>a.orb)continue;
   aspects.push({id1:p.id,id2:'Lilith',local:false,name:a.name,
     angle:a.angle,orb:g.orb,phase:'APROKSIMASI',impact:0,
     type:a.name==='Trine'||a.name==='Sextile'?'HARMONIS':
          a.name==='Square'||a.name==='Opposition'?'TEGANG':'KONJUNGSI',
     source:'MEAN_APOGEE_APPROX_NO_DIRECTION'});
  }
 }
 return aspects;
}
function configScore(aspects,positionMap){
 let buy=0,sell=0;
 for(const a of aspects){
  if(a.local||!Number.isFinite(a.impact)||a.impact===0)continue;
  const p=positionMap.get(a.id1),q=positionMap.get(a.id2);
  if(!p||!q)continue;
  const pWeight=ROLE_FACTORS[a.id1]*ELEMENT_FACTORS[p.element];
  const qWeight=ROLE_FACTORS[a.id2]*ELEMENT_FACTORS[q.element];
  const effect=a.impact*(pWeight+qWeight)/2;
  if(effect>0)buy+=effect;else sell-=effect;
 }
 const total=buy+sell;
 return {buy,sell,score:buy-sell,buyPct:total?100*buy/total:null,
   sellPct:total?100*sell/total:null,
   direction:buy-sell>=V2_ASSUMPTIONS.buyThreshold?'BUY':
     buy-sell<=V2_ASSUMPTIONS.sellThreshold?'SELL':'NEUTRAL'};
}

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
 const positionsById=new Map(planetPositions.map(p=>[p.id,p]));
 const zLilith=zodiac(meanLilith(sample.ms).longitude);
 const lilith={id:'Lilith',name:'Black Moon Lilith (Mean)',role:'Titik apogee Bulan',
   detail:'Interpretasi ketegangan bayangan; bukan benda langit fisik dan bukan sinyal arah',
   ...zLilith,positionMethod:'MEAN_APOGEE_APPROX'};
 planetPositions.push(lilith);
 // Hitungan unsur untuk 10 planet saja; Lilith ditampilkan terpisah.
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
 })).concat(calculateLilithAspects(sample.ms,planetPositions)).sort((a,b)=>a.orb-b.orb);
 const config=configScore(sample.active,positionsById);
 return {
  ms:sample.ms,state:sample.state,score:sample.score,
  buyWeight:totalBuy,sellWeight:totalSell,
  configScore:config.score,configState:config.direction,
  configBuyWeight:config.buy,configSellWeight:config.sell,
  configBuyPct:config.buyPct,configSellPct:config.sellPct,
  buyPct:total>0?100*totalBuy/total:null,
  sellPct:total>0?100*totalSell/total:null,
  aspects,planetPositions,zodiacCounts,prominentElement:prominent,
  elementMeaning:prominent==='CAMPURAN'?'Tidak ada elemen tunggal yang dominan':ELEMENT_INFO[prominent],
  hints,lilith:zLilith,lilithMethod:'MEAN_APOGEE_APPROX',
  configModel:V2_ASSUMPTIONS.version,
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

/* 1,440 independently sampled minutes for one WIB calendar date.
 * 24 hourly chunks reduce retained ephemeris cache on low-memory phones.
 */
async function calculateDay(engine,date,onProgress=()=>{},cancelled=()=>false){
 C.Time.parseDate(date);
 const rows=[];
 for(let hour=0;hour<24;hour++){
   must(!cancelled(),'Perhitungan harian M1 dibatalkan.');
   const result=await calculateHour(engine,date,hour,
     p=>onProgress(Math.min(99,Math.round((hour+p/100)*100/24))),cancelled);
   rows.push(...result.rows);
   engine.clear();
 }
 must(rows.length===1440,'Jumlah menit harian tidak lengkap.');
 for(let i=1;i<rows.length;i++)
   must(rows[i].ms-rows[i-1].ms===MINUTE,'Data M1 tidak berurutan.');
 onProgress(100);
 return Object.freeze({version:VERSION,mode:'ASTRODOX_M1_DAY_RESEARCH',
    date,hour:null,stepMinutes:1,minutes:1440,rows,
    model:'V1_PLUS_SEPARATE_EXPERIMENTAL_CONFIG_V2',
    planetInterpretation:'V2_EXPLICIT_UNVALIDATED_WEIGHTING',
    directionValidated:false,tradingDecision:'WAIT'});
}
function exportEAResearchFeed(result){
 must(result&&result.minutes===1440&&result.rows.length===1440,
   'Ekspor feed hanya untuk hasil scan 1.440 menit penuh.');
 return {
  schema:'CEBONK_ASTRODOX_M1_RESEARCH_FEED_V1',
  dateWIB:result.date,timezone:'Asia/Jakarta',
  serverTimezoneIndependent:true,generatedAtUTC:new Date().toISOString(),
  intervalMinutes:1,source:'ASTRONOMY_ENGINE_V2.1.19_PLUS_MEEUS_MEAN_APOGEE',
  scores:'EXPERIMENTAL_UNVALIDATED_ASTROLOGY_DIRECTION',
  allowAutoTrade:false,tradeDecision:'WAIT',
  note:'Bukan sinyal trading otomatis. EA hanya boleh membaca jadwal sebagai bahan uji.',
  v2Assumptions:V2_ASSUMPTIONS,
  rows:result.rows.map(x=>({
    utc:new Date(x.ms).toISOString(),wib:C.Time.hm(C.Time.wib(x.ms)),
    v1State:x.state,v1Score:Number(x.score.toFixed(6)),
    v2State:x.configState,v2Score:Number(x.configScore.toFixed(6)),
    v2BuyPct:x.configBuyPct===null?null:Number(x.configBuyPct.toFixed(4)),
    v2SellPct:x.configSellPct===null?null:Number(x.configSellPct.toFixed(4)),
    element:x.prominentElement,lilithMeanLongitude:Number(x.lilith.longitude.toFixed(6)),
    tradingDecision:'WAIT'
  }))
 };
}
const API=Object.freeze({VERSION,ELEMENTS,ELEMENT_INFO,ROLES,zodiac,interpret,calculateHour,calculateDay,meanLilith,exportEAResearchFeed,V2_ASSUMPTIONS});
root.CebonkAstrodoxM1=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);