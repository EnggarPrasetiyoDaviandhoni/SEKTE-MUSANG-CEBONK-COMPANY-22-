/* CEBONK COMEX GOLD SOLAR RETURN v2.0.0
 * Historical COMEX gold futures inception 1974-12-31 is supported by CME.
 * Actual first-trade clock time is undocumented here. Default 12:00 EST is
 * an explicit RESEARCH ASSUMPTION, NOT a verified market birth time.
 * The chart is geocentric tropical; NO house/ASC claims, price data or orders.
 * Angular aspects vs annual Solar Return chart express event timing only.
 */
(function(root){
'use strict';
const VERSION='2.0.0',MIN=60000,HOUR=3600000,DAY=86400000;
const BIRTH_DATE='1974-12-31',FIRST_TRADE_REF='https://www.cmegroup.com/media-room/historical-first-trade-dates.html';
const PLANETS=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const EVENTS=Object.freeze([
 {name:'Conjunction',angle:0,orb:2.2,type:'TRANSISI'},
 {name:'Sextile',angle:60,orb:1.8,type:'HARMONIS'},
 {name:'Square',angle:90,orb:2.0,type:'TEGANG'},
 {name:'Trine',angle:120,orb:2.0,type:'HARMONIS'},
 {name:'Opposition',angle:180,orb:2.2,type:'TEGANG'}
]);
const norm=x=>((x%360)+360)%360;
const signed=x=>norm(x+180)-180;
const must=(ok,msg)=>{if(!ok)throw Error(msg);};
function natalUTC(hourNY=12){
 must(Number.isInteger(hourNY)&&hourNY>=0&&hourNY<=23,
   'Jam referensi COMEX harus 00 sampai 23 EST.');
 // 1974-12-31 in New York was EST (UTC-5), not daylight time.
 return Date.UTC(1974,11,31,hourNY+5,0,0);
}
function solarLongitude(A,ms){
 must(A&&typeof A.MakeTime==='function'&&typeof A.GeoVector==='function'&&
  typeof A.Ecliptic==='function','Astronomy Engine belum tersedia.');
 const t=A.MakeTime(new Date(ms)),v=A.GeoVector('Sun',t,true);
 const lon=A.Ecliptic(v).elon;
 must(Number.isFinite(lon),'Longitude Matahari tidak tersedia.');
 return norm(lon);
}
function solarReturn(A,year,target){
 must(Number.isInteger(year)&&year>=2019&&year<=2041,'Tahun Solar Return di luar cakupan.');
 must(Number.isFinite(target),'Longitude dasar COMEX tidak tersedia.');
 // Root bracket covers the preceding and following days around Dec 31.
 const begin=Date.UTC(year,11,26,0),end=Date.UTC(year+1,0,6,0);
 const delta=t=>signed(solarLongitude(A,t)-target);
 let a=begin,fa=delta(a),lo=null,hi=null;
 for(let b=a+6*HOUR;b<=end;b+=6*HOUR){
  const fb=delta(b);
  if(fa===0||fb===0||fa*fb<0){lo=a;hi=b;break;}
  a=b;fa=fb;
 }
 must(lo!==null,'Solar Return tahunan tidak ditemukan dalam rentang akhir Desember.');
 // Monotone crossing within narrow bracket: bisection is deterministic.
 for(let i=0;i<45&&hi-lo>100;i++){
  const mid=(lo+hi)/2;
  if(delta(lo)*delta(mid)<=0)hi=mid;else lo=mid;
 }
 const ms=Math.round((lo+hi)/2/1000)*1000;
 must(Math.abs(delta(ms))<0.00002,'Akurasi root Solar Return gagal.');
 return Object.freeze({year,ms,utc:new Date(ms).toISOString(),sunLongitude:solarLongitude(A,ms),
  errorDegrees:Math.abs(delta(ms)),source:'SOLAR_RETURN_TROPICAL_GEOCENTRIC'});
}
function snapshot(C,A,returnObj){
 const eng=C.createEngine(A);
 try{
  const positions=eng.get(returnObj.ms).positions;
  const bodies=Object.freeze(PLANETS.map(id=>{
   must(Number.isFinite(positions[id]?.lon),'Planet Solar Return hilang: '+id);
   return Object.freeze({id,longitude:norm(positions[id].lon)});
  }));
  return Object.freeze({...returnObj,bodies});
 }finally{eng.clear();}
}
function getReturns(C,A,dateStr,hourNY=12){
 C.Time.parseDate(dateStr);
 const natal=natalUTC(hourNY);
 const solarNatal=solarLongitude(A,natal);
 const year=Number(dateStr.slice(0,4));
 // December prior, December current, December following.
 const returns=[year-1,year,year+1].map(y=>snapshot(C,A,solarReturn(A,y,solarNatal)));
 return Object.freeze({
  natalUTC:new Date(natal).toISOString(),hourNY,
  baselineDate:BIRTH_DATE,firstTradeReference:FIRST_TRADE_REF,
  baselineSunLongitude:solarNatal,returns,
  assumption:'Jam pertama perdagangan tidak terverifikasi; 12:00 EST hanya default asumsi.',
  houseSystem:'NONE — no verified natal clock time'
 });
}
function aspectOrb(lonA,lonB,angle){
 const d=norm(lonA-lonB);
 return Math.min(Math.abs(signed(d-angle)),Math.abs(signed(d+angle)));
}
function eventsAt(positions,target,previousPositions){
 const events=[];
 for(const p of PLANETS){
  const longitude=positions[p]?.lon;
  must(Number.isFinite(longitude),'Longitude transit tidak tersedia: '+p);
  for(const natal of target.bodies){
   for(const aspect of EVENTS){
    const orb=aspectOrb(longitude,natal.longitude,aspect.angle);
    if(orb>aspect.orb)continue;
    const prevLon=previousPositions?.[p]?.lon;
    const prevOrb=Number.isFinite(prevLon)?aspectOrb(prevLon,natal.longitude,aspect.angle):null;
    const phase=orb<=0.06?'EXACT':
      prevOrb===null?'UNKNOWN':
      orb<prevOrb-0.000001?'APPLYING':
      orb>prevOrb+0.000001?'SEPARATING':'STATIONARY';
    const strength=Math.max(0,1-orb/aspect.orb);
    events.push({
     pair:p+' → SR '+natal.id,
     planet:p,solarReturnPlanet:natal.id,aspect:aspect.name,
     eventType:aspect.type,orb,phase,strength,
     eventId:p+'|'+natal.id+'|'+aspect.name+'|SR'+target.year
    });
   }
  }
 }
 events.sort((a,b)=>b.strength-a.strength||a.orb-b.orb||a.eventId.localeCompare(b.eventId));
 return events.slice(0,4);
}
function activeReturn(returns,ms){
 const eligible=returns.filter(x=>x.ms<=ms);
 must(eligible.length>0,'Chart Solar Return aktif tidak tersedia.');
 return eligible[eligible.length-1];
}

/* ARAH ASTROLOGI SR: skema riset khusus aspek transit -> chart Solar Return.
 * TIDAK membaca Astrology V1/V2, harga, indikator, atau arah tren XAUUSD.
 * Trine/sextile ditafsirkan mendukung, square/opposition menekan;
 * conjunction netral. Ini bukan kaidah pembuktian arah harga emas.
 */
function polarityOf(events){
 let positive=0,negative=0;
 for(const e of events){
  const weight=Math.pow(e.strength,2);
  if(e.eventType==='HARMONIS')positive+=weight;
  if(e.eventType==='TEGANG')negative+=weight;
 }
 const activity=positive+negative;
 return Object.freeze({positive,negative,activity,
  score:activity>0?(positive-negative)/activity:0});
}
function classify(score,activity,threshold=0.18){
 if(activity<=0||Math.abs(score)<threshold)return 'WAIT';
 return score>0?'BUY':'SELL';
}
function weekBounds(C,dateStr){
 const day=C.Time.parseDate(dateStr),weekday=day.getUTCDay();
 const mondayOffset=(weekday+6)%7;
 const start=C.Time.wibToUTC(dateStr,0)-mondayOffset*DAY;
 return Object.freeze({start,end:start+7*DAY,
  startWIB:new Date(start+7*HOUR).toISOString().slice(0,10),
  endWIB:new Date(start+7*DAY-MIN+7*HOUR).toISOString().slice(0,10)});
}
async function analyzeWeek(C,A,charts,dateStr,onProgress=()=>{},cancelled=()=>false){
 const bounds=weekBounds(C,dateStr),eng=C.createEngine(A);
 let positive=0,negative=0,activeHours=0,samples=0;
 const days=[];
 try{
  for(let d=0;d<7;d++){
   let dailyPositive=0,dailyNegative=0;
   for(let h=0;h<24;h++){
    must(!cancelled(),'Analisis Solar Return dibatalkan.');
    const ms=bounds.start+(d*24+h)*HOUR;
    const chart=activeReturn(charts.returns,ms);
    const score=polarityOf(eventsAt(eng.get(ms).positions,chart));
    dailyPositive+=score.positive;dailyNegative+=score.negative;
    if(score.activity>0)activeHours++;
    samples++;
   }
   positive+=dailyPositive;negative+=dailyNegative;
   const activity=dailyPositive+dailyNegative;
   const dayScore=activity?(dailyPositive-dailyNegative)/activity:0;
   days.push(Object.freeze({
    dateWIB:new Date(bounds.start+d*DAY+7*HOUR).toISOString().slice(0,10),
    bias:classify(dayScore,activity),score:dayScore,activity}));
   onProgress(Math.round((d+1)/7*25));
   await new Promise(done=>setTimeout(done,0));
  }
 }finally{eng.clear();}
 const activity=positive+negative;
 const score=activity?(positive-negative)/activity:0;
 // Hanya chart Solar Return dan aspek transitnya. Tidak dipaksa ada entry.
 const direction=classify(score,activity,0.18);
 return Object.freeze({...bounds,positive,negative,activity,score,
  direction,activeHours,samples,days,
  meaning:'Bias simbolik Solar Return mingguan, BUKAN tren harga XAUUSD.'});
}
function phaseOf(event){
 if(!event)return 'TIDAK ADA';
 if(event.orb<=0.20)return 'INTI';
 if(event.phase==='APPLYING')return 'AWAL';
 if(event.phase==='SEPARATING')return 'AKHIR';
 return 'TRANSISI';
}
async function analyzeDay(C,A,dateStr,hourNY=12,onProgress=()=>{},cancelled=()=>false){
 const charts=getReturns(C,A,dateStr,hourNY);
 must(!cancelled(),'Analisis Solar Return dibatalkan.');
 const weekly=await analyzeWeek(C,A,charts,dateStr,onProgress,cancelled);
 const startMS=C.Time.wibToUTC(dateStr,0);
 const eng=C.createEngine(A),rows=[];
 let prev=null,prevId=null,streak=0;
 const counts={HARMONIS:0,TEGANG:0,TRANSISI:0,NONE:0};
 const polarityCounts={BUY:0,SELL:0,WAIT:0},eventList=[];
 try{
  for(let i=0;i<1440;i++){
   must(!cancelled(),'Analisis Solar Return dibatalkan.');
   const ms=startMS+i*MIN,target=activeReturn(charts.returns,ms);
   const positions=eng.get(ms).positions;
   const previousPositions=prev?.ms===ms-MIN?prev.positions:eng.get(ms-MIN).positions;
   const events=eventsAt(positions,target,previousPositions),top=events[0]||null;
   const polarity=polarityOf(events);
   const local=classify(polarity.score,polarity.activity,0.18);
   const match=weekly.direction!=='WAIT'&&weekly.direction===local&&
    top!==null&&top.strength>=0.35;
   streak=match?streak+1:0;
   const trend=match&&streak>=3?weekly.direction:'WAIT';
   const phase=trend==='WAIT'?'TIDAK ADA':phaseOf(top);
   const isNew=!!top&&top.eventId!==prevId;
   prevId=top?.eventId||null;
   const row={
    ms,utc:new Date(ms).toISOString(),returnYear:target.year,returnUTC:target.utc,
    eventType:top?.eventType||'NONE',topEvent:top,topFour:events,
    eventStrength:top?.strength||0,newEvent:isNew,
    weekBias:weekly.direction,weekScore:weekly.score,localScore:polarity.score,
    eventPolarity:trend,polarityReason:trend==='WAIT'?
     (weekly.direction==='WAIT'?'TANPA_BIAS_MINGGUAN':'BELUM_SELARAS_SR_MINGGUAN'):
     'SELARAS_SR_MINGGUAN_DAN_AKTIVASI_ASPEK',
    phase,tradeDecision:'WAIT'
   };
   rows.push(row);counts[row.eventType]++;polarityCounts[trend]++;
   if(isNew&&top)eventList.push({utc:row.utc,
    wib:C.Time.hm(C.Time.wib(ms)),returnYear:target.year,
    type:row.eventType,pair:top.pair,aspect:top.aspect,
    orb:top.orb,strength:top.strength});
   prev={ms,positions};
   if(i%40===39){
    onProgress(25+Math.round((i+1)/1440*75));
    await new Promise(done=>setTimeout(done,0));
   }
  }
 }finally{eng.clear();}
 must(rows.length===1440,'Data SR M1 tidak lengkap.');
 const first=activeReturn(charts.returns,rows[0].ms);
 const last=activeReturn(charts.returns,rows[rows.length-1].ms);
 return Object.freeze({
  version:VERSION,model:'COMEX_SOLAR_RETURN_PURE_WEEKLY_TREND_RESEARCH',
  dateWIB:dateStr,baseline:charts,weekly,activeAtStart:first,activeAtEnd:last,
  rolloverDuringDay:first.year!==last.year,
  rows,counts,polarityCounts,eventList,minutes:rows.length,
  validatedForXAUUSD:false,tradeDecision:'WAIT',
  note:'Follow trend bermakna konsistensi bias astrologi mingguan terhadap aspek transit chart Solar Return. Tidak memakai V1/V2, indikator teknikal, ataupun harga emas. Bukan tren pasar terbukti.'
 });
}
function exportResearch(result){
 must(result&&result.minutes===1440,'Ekspor memerlukan data 1.440 menit.');
 return {
  schema:'CEBONK_COMEX_SOLAR_RETURN_PURE_WEEKLY_TREND_V2',
  dateWIB:result.dateWIB,timezone:'Asia/Jakarta',
  generatedAtUTC:new Date().toISOString(),
  baseline:result.baseline,weekly:result.weekly,
  eventPolarityMethod:'PURE_SR_CHART_PLUS_SR_TRANSIT_ASPECTS_HEURISTIC',
  activeSolarReturnStart:result.activeAtStart.utc,
  activeSolarReturnEnd:result.activeAtEnd.utc,
  events:result.eventList,
  assumptions:result.baseline.assumption,
  allowAutoTrade:false,validatedForXAUUSD:false,tradeDecision:'WAIT',
  rows:result.rows.map(r=>({
   utc:r.utc,returnYear:r.returnYear,
   weekBias:r.weekBias,localSRScore:r.localScore,
   srTrendResearch:r.eventPolarity,phase:r.phase,
   eventType:r.eventType,eventStrength:r.eventStrength,
   event:r.topEvent?{
    pair:r.topEvent.pair,aspect:r.topEvent.aspect,
    orb:r.topEvent.orb,phase:r.topEvent.phase}:null,
   tradeDecision:'WAIT'
  }))
 };
}
const API=Object.freeze({VERSION,BIRTH_DATE,FIRST_TRADE_REF,PLANETS,EVENTS,
 natalUTC,solarLongitude,solarReturn,getReturns,aspectOrb,eventsAt,activeReturn,
 polarityOf,classify,weekBounds,analyzeWeek,phaseOf,analyzeDay,exportResearch});
root.CebonkComexSolarReturn=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
