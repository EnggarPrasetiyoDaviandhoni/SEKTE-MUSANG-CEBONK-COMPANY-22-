/* AL-BIRUNI CLASSICAL DIRECTION (research hypothesis) v1.0.
 * ONLY consumes CebonkAlBiruniClassic.chart data, NOT the legacy
 * ASPECT_COUNT_MAJORITY_V2 signal. The original historical text
 * does not establish a BUY/SELL XAUUSD rule: mapping is user-requested.
 * The chart is a PARTIAL classical reconstruction (houses, reception,
 * besiegement not completed); do not represent this as the entire §527.
 */
(function(root){
'use strict';
const VERSION='1.0.0',MIN=60000;
const FAVORABLE='MENGUNTUNGKAN',HARMFUL='MERUGIKAN',WAIT='WAIT';
const BODIES=new Set(['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn']);
const BENEFICS=new Set(['Venus','Jupiter']),MALEFICS=new Set(['Mars','Saturn']);
const NAME=Object.freeze({Sun:'Matahari',Moon:'Bulan',Mercury:'Merkurius',
 Venus:'Venus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturnus'});
function guard(v,msg){if(!v)throw Error(msg);}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const angular=(a,b)=>Math.abs((((b-a+180)%360)+360)%360-180);
function targetWeights(chart){
 // Overlapping roles are deduplicated; keep the strongest role only.
 const weights=new Map([['Sun',1.4],['Moon',1.3]]);
 for(const [body,weight] of [[chart.ascendantRuler,1.2],[chart.lunarRuler,0.95]]){
  if(!BODIES.has(body))continue;
  weights.set(body,Math.max(weights.get(body)||0,weight));
 }
 return weights;
}
function contactPhase(chart,contact){
 const sign=chart.significators?.find(s=>s.label===contact.target);
 if(!sign||!BODIES.has(sign.id)||!Number.isFinite(chart.longitudes?.[contact.actor])||
    !Number.isFinite(chart.longitudes?.[sign.id]))return 'TIDAK_TERSEDIA';
 if(contact.orb<=0.06)return 'EXACT';
 const velocity=new Map(chart.conditions.rows.map(r=>[r.body,r.velocityDegPerDay]));
 const va=velocity.get(contact.actor),vt=velocity.get(sign.id);
 if(!Number.isFinite(va)||!Number.isFinite(vt))return 'TIDAK_TERSEDIA';
 const before=angular(chart.longitudes[contact.actor]-va/288,
                      chart.longitudes[sign.id]-vt/288);
 const after=angular(chart.longitudes[contact.actor]+va/288,
                     chart.longitudes[sign.id]+vt/288);
 const prior=Math.abs(before-contact.angle),later=Math.abs(after-contact.angle);
 if(Math.abs(later-prior)<0.00001)return 'STASIONER';
 return later<prior?'APPLYING':'SEPARATING';
}
function assess(chart){
 if(!chart||!chart.dignities||!Array.isArray(chart.dignities.rows)||
  !chart.conditions||!Array.isArray(chart.conditions.rows)||
  !Array.isArray(chart.contacts)||!Array.isArray(chart.significators)||
  !chart.longitudes||!Number.isFinite(chart.ms)||!Number.isFinite(chart.ascendant)||
  !Number.isFinite(chart.sunAltitudeDegrees)||!Number.isFinite(chart.orb)||chart.orb<=0||
  !BODIES.has(chart.ascendantRuler)||!BODIES.has(chart.lunarRuler)){
  return Object.freeze({ms:Number.isFinite(chart?.ms)?chart.ms:null,
   status:WAIT,direction:WAIT,reason:'DATA_KLASIK_TIDAK_LENGKAP',
   favorable:0,harmful:0,net:0,supportPct:null,
   factors:Object.freeze([]),beneficContacts:0,maleficContacts:0,
   validated:false,source:'ALBIRUNI_CLASSIC_PARTIAL_ONLY',
   tradeDecision:WAIT});
 }
 const dignities=new Map(chart.dignities.rows.map(r=>[r.body,r]));
 const conditions=new Map(chart.conditions.rows.map(r=>[r.body,r]));
 const weights=targetWeights(chart);
 if([...weights.keys()].some(body=>!dignities.has(body)||!conditions.has(body))||
  !chart.dignities.completeDignity||!['day','night'].includes(chart.sect)){
  return Object.freeze({ms:chart.ms,status:WAIT,direction:WAIT,
   reason:'MARTABAT_ATAU_KONDISI_KURANG',
   favorable:0,harmful:0,net:0,supportPct:null,
   factors:Object.freeze([]),beneficContacts:0,maleficContacts:0,
   validated:false,source:'ALBIRUNI_CLASSIC_PARTIAL_ONLY',tradeDecision:WAIT});
 }
 let favorable=0,harmful=0,beneficContacts=0,maleficContacts=0;
 const factors=[];
 function add(section,label,benefit,risk,more={}){
  if(benefit<=0&&risk<=0)return;
  favorable+=benefit;harmful+=risk;
  factors.push(Object.freeze({section,label,favorable:benefit,harmful:risk,...more}));
 }
 for(const [body,weight] of weights){
  const d=dignities.get(body),c=conditions.get(body);
  const dignity=Number(d.subtotal);
  if(!Number.isFinite(dignity)||!Array.isArray(c.negatives)||!Array.isArray(c.positives)){
   return Object.freeze({ms:chart.ms,status:WAIT,direction:WAIT,reason:'DATA_PLANET_TIDAK_SAH',
    favorable:0,harmful:0,net:0,supportPct:null,factors:Object.freeze([]),
    beneficContacts:0,maleficContacts:0,validated:false,tradeDecision:WAIT,
    source:'ALBIRUNI_CLASSIC_PARTIAL_ONLY'});
  }
  // Essential dignity (§493-494) and debility/condition (§498-513).
  // Scoring COEFFICIENTS are modern explicit research choices.
  add('MARTABAT',NAME[body]+' · martabat '+dignity,
    weight*dignity*0.27,0,{body,longitude:d.longitude,zodiac:d.sign,degree:d.signDegree});
  const negatives=new Set(c.negatives),positives=new Set(c.positives);
  if(negatives.has('DETRIMENT'))add('KELEMAHAN',NAME[body]+' · detriment',0,weight*2.2);
  if(negatives.has('FALL'))add('KELEMAHAN',NAME[body]+' · fall',0,weight*2.2);
  if(negatives.has('COMBUST'))add('KONDISI',NAME[body]+' · combust',0,weight*2.0);
  if(negatives.has('UNDER_BEAMS'))add('KONDISI',NAME[body]+' · under beams',0,weight*1.2);
  if(negatives.has('RETROGRADE'))add('GERAK',NAME[body]+' · retrograde',0,weight*1.2);
  if(negatives.has('STATIONARY'))add('GERAK',NAME[body]+' · stationary',0,weight*0.7);
  if(positives.has('CAZIMI'))add('KONDISI',NAME[body]+' · cazimi',weight*1.8,0);
 }
 const orb=chart.orb,aspectWeights={0:1.0,60:0.95,90:1.0,120:1.1,180:1.05};
 const phaseWeights={EXACT:1.18,APPLYING:1.08,SEPARATING:0.88,STASIONER:0.85,TIDAK_TERSEDIA:1};
 const targets={'Ascendant':1.3,'Bulan':1.25,
  'Penguasa Ascendant':1.15,'Penguasa tanda Bulan':1,
  'Matahari (asosiasi emas §410)':1.35};
 for(const contact of chart.contacts){
  if(!contact||!BODIES.has(contact.actor)||!(contact.target in targets)||
     !Number.isFinite(contact.angle)||!Number.isFinite(contact.orb)||
     contact.orb<0||contact.orb>orb||
     !Object.prototype.hasOwnProperty.call(aspectWeights,contact.angle))continue;
  const beneficial=BENEFICS.has(contact.actor)&&contact.role==='BENEFIC';
  const adverse=MALEFICS.has(contact.actor)&&contact.role==='MALEFIC';
  if(!beneficial&&!adverse)continue;
  const phase=contactPhase(chart,contact);
  const actorDignity=dignities.get(contact.actor)?.subtotal||0;
  const strength=(0.4+0.6*clamp(1-contact.orb/orb,0,1))*2.65*
   targets[contact.target]*aspectWeights[contact.angle]*
   (phaseWeights[phase]||1)*(1+Math.min(12,actorDignity)*0.035);
  add('KONTAK',NAME[contact.actor]+' → '+contact.target+
   ' · '+contact.angle+'° · orb '+contact.orb.toFixed(3)+'° · '+phase,
   beneficial?strength:0,adverse?strength:0,
   {actor:contact.actor,target:contact.target,phase,orb:contact.orb,angle:contact.angle});
  if(beneficial)beneficContacts++;else maleficContacts++;
 }
 // Moon-to-Ascendant-ruler relationship: supportive traditional electional
 // geometry is used as a modest modifier, NOT a BUY/SELL quotation from book.
 if(chart.ascendantRuler==='Moon'){
  add('BULAN','Bulan menguasai Ascendant',0.4,0);
 }else if(chart.moonAscRuler){
  const a=chart.moonAscRuler;
  if([0,60,120].includes(a.angle))add('BULAN','Bulan → penguasa Ascendant',0.7,0);
  else if([90,180].includes(a.angle))add('BULAN','Bulan → penguasa Ascendant',0,0.7);
 }
 const total=favorable+harmful,net=favorable-harmful;
 const supportPct=total>0?favorable/total*100:null;
 let status=WAIT,reason='KEKUATAN_BELUM_TEGAS';
 if(chart.twilightUncertain)reason='BATAS_SIANG_MALAM';
 else if(!beneficContacts&&!maleficContacts)reason='KONTAK_PENANDA_TIDAK_TERSEDIA';
 else if(favorable>=3&&beneficContacts>0&&net>=2.2&&favorable>=harmful*1.65){
  status=FAVORABLE;reason='DUKUNGAN_KLASIK_DOMINAN';
 }else if(harmful>=3&&maleficContacts>0&&-net>=2.2&&harmful>=favorable*1.65){
  status=HARMFUL;reason='TEKANAN_KLASIK_DOMINAN';
 }
 const direction=status===FAVORABLE?'BUY':status===HARMFUL?'SELL':WAIT;
 return Object.freeze({ms:chart.ms,status,direction,reason,
  favorable,harmful,net,supportPct,
  factors:Object.freeze(factors),beneficContacts,maleficContacts,
  validated:false,source:'ALBIRUNI_CLASSIC_PARTIAL_ONLY',
  originalBookDirection:false,tradeDecision:WAIT,fullElectional:false,
  limitations:'Pemetaan positif→BUY/negatif→SELL dan koefisien adalah HIPOTESIS MODERN. Rumah lengkap, reception, besiegement, prediksi harga dan validasi statistik belum tersedia.'});
}
function summarize(rows,{stepMinutes=15,confirmBars=2}={}){
 guard(Array.isArray(rows)&&rows.length>0&&rows.length<=700,'Perhitungan waktu klasik kosong atau berlebihan.');
 guard(Number.isInteger(stepMinutes)&&stepMinutes>0&&60%stepMinutes===0,'Resolusi klasik tidak sah.');
 guard(Number.isInteger(confirmBars)&&confirmBars>=1&&confirmBars<=12,'Konfirmasi klasik tidak sah.');
 let pending=null,pendingCount=0;
 let previous=null,segments=[],current=null;
 const timeline=[];
 for(const [i,r] of rows.entries()){
  guard(r&&Number.isFinite(r.ms)&&['BUY','SELL','WAIT'].includes(r.direction)&&
   Number.isFinite(r.favorable)&&Number.isFinite(r.harmful)&&Number.isFinite(r.net),
   'Sampel keputusan klasik tidak lengkap.');
  const sameDay=previous!==null&&r.ms===previous+stepMinutes*MIN&&
   new Date(r.ms+7*3600000).toISOString().slice(0,10)===
   new Date(previous+7*3600000).toISOString().slice(0,10);
  if(!sameDay){pending=null;pendingCount=0;current=null;}
  let state=WAIT;
  if(r.direction===WAIT){pending=null;pendingCount=0;current=null;}
  else{
   if(r.direction===pending)pendingCount++;
   else {pending=r.direction;pendingCount=1;}
   if(pendingCount>=confirmBars)state=r.direction;
  }
  timeline.push(Object.freeze({...r,confirmed:state}));
  if(state!==WAIT){
   if(!current||current.direction!==state||current.end!==r.ms){
    current={direction:state,start:r.ms,end:r.ms+stepMinutes*MIN,
     core:r.ms,peakStrength:Math.abs(r.net),score:r.net,
     strength:Math.abs(r.net),slots:1};
    segments.push(current);
   }else{
    current.end=r.ms+stepMinutes*MIN;current.slots++;
    current.strength+=Math.abs(r.net);
    if(Math.abs(r.net)>current.peakStrength){
     current.peakStrength=Math.abs(r.net);current.core=r.ms;current.score=r.net;
    }
   }
  }else current=null;
  previous=r.ms;
  if(i&&rows[i-1].ms>=r.ms)throw Error('Urutan waktu klasik tidak menaik.');
 }
 const buyStrength=segments.filter(s=>s.direction==='BUY').reduce((sum,s)=>sum+s.strength,0);
 const sellStrength=segments.filter(s=>s.direction==='SELL').reduce((sum,s)=>sum+s.strength,0);
 const total=buyStrength+sellStrength,ratio=total?Math.max(buyStrength,sellStrength)/total:0;
 const direction=total&&ratio>=0.55?(buyStrength>sellStrength?'BUY':sellStrength>buyStrength?'SELL':WAIT):WAIT;
 const chosen=segments.filter(s=>s.direction===direction).sort((a,b)=>b.strength-a.strength||
  b.slots-a.slots||a.start-b.start)[0]||null;
 return Object.freeze({version:VERSION,model:'ALBIRUNI_CLASSICAL_DIRECTION_EXPERIMENT_V1',
  direction,quality:direction==='BUY'?FAVORABLE:direction==='SELL'?HARMFUL:WAIT,
  focusWindow:chosen?Object.freeze({...chosen,minutes:chosen.slots*stepMinutes}):null,
  windows:Object.freeze(segments.map(x=>Object.freeze({...x,minutes:x.slots*stepMinutes}))),
  timeline:Object.freeze(timeline),buyStrength,sellStrength,
  buyMinutes:timeline.filter(x=>x.confirmed==='BUY').length*stepMinutes,
  sellMinutes:timeline.filter(x=>x.confirmed==='SELL').length*stepMinutes,
  waitMinutes:timeline.filter(x=>x.confirmed===WAIT).length*stepMinutes,
  tradeDecision:WAIT,validated:false,
  note:'Arah merupakan interpretasi eksperimen kondisi klasik, bukan hasil formula harga emas Al-Biruni. Status entry nyata tetap WAIT.'});
}
const API=Object.freeze({VERSION,assess,summarize,FAVORABLE,HARMFUL,WAIT});
root.CebonkAlBiruniClassicalDirection=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
