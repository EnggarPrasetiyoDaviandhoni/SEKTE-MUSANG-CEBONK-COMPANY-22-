/* CEBONK COMEX GOLD SOLAR RETURN v1.0.0
 * Historical COMEX gold futures inception 1974-12-31 is supported by CME.
 * Actual first-trade clock time is undocumented here. Default 12:00 EST is
 * an explicit RESEARCH ASSUMPTION, NOT a verified market birth time.
 * The chart is geocentric tropical; NO house/ASC claims, price data or orders.
 * Angular aspects vs annual Solar Return chart express event timing only.
 */
(function(root){
'use strict';
const VERSION='1.1.0',MIN=60000,HOUR=3600000,DAY=86400000;
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
async function analyzeDay(C,M,A,dateStr,hourNY=12,onProgress=()=>{},cancelled=()=>false){
 const charts=getReturns(C,A,dateStr,hourNY);
 must(!cancelled(),'Perhitungan Solar Return dibatalkan.');
 const dayEngine=C.createEngine(A);
 let day;
 try{
  day=await M.calculateDay(dayEngine,dateStr,
   p=>onProgress(Math.round(p*0.75)),cancelled);
 }finally{dayEngine.clear();}
 const polarityEngine=root.CebonkEventPolarityM1;
 must(polarityEngine&&typeof polarityEngine.compute==='function',
  'Mesin Event Polarity M1 tidak tersedia.');
 // Existing causal V2 astrology-score filter is an independent research input.
 // Solar Return aspects are a second, distinct event gate; NOT gold D1 trend.
 const astroPolarity=polarityEngine.compute(day.rows,{
  trendMinutes:15,confirmMinutes:2
 }).rows;
 // Separate daily engine is cleared inside M.calculateDay's per-hour loop;
 // still clean below using an independent engine for previous-minute lookup.
 must(!cancelled(),'Perhitungan Solar Return dibatalkan.');
 const eng=C.createEngine(A),rows=[];
 let prev=null,prevSolarEvent=null,pending='WAIT',pendingBars=0,
  previousPolarityEvent=null;
 try{
  for(let i=0;i<day.rows.length;i++){
   must(!cancelled(),'Perhitungan Solar Return dibatalkan.');
   const r=day.rows[i],target=activeReturn(charts.returns,r.ms);
   const positions=eng.get(r.ms).positions;
   let previousPositions=prev?.positions;
   if(!prev||prev.ms!==r.ms-MIN)previousPositions=eng.get(r.ms-MIN).positions;
   const events=eventsAt(positions,target,previousPositions);
   const top=events[0]||null;
   const trendEvent=top&&top.strength>=0.50?top:null;
   const currentEventId=trendEvent?.eventId||null;
   const fresh=!!currentEventId&&currentEventId!==prevSolarEvent;
   prevSolarEvent=currentEventId;
   const astro=astroPolarity[i];
   let candidate='WAIT',polarityReason='NO_CONFIRMED_SOLAR_EVENT';
   if(trendEvent){
    if(trendEvent.eventType==='HARMONIS'&&astro.polarity!=='WAIT'&&
       astro.astroTrendStreak>=2){
      candidate=astro.polarity;
      polarityReason='SR_HARMONIS_DAN_ASTRO_M1_SEARAH';
    }else if(trendEvent.eventType==='TEGANG'&&astro.polarity!=='WAIT'&&
             astro.reason==='EVENT_REVERSAL_DENGAN_PERGANTIAN_TREN_ASTRO'){
      candidate=astro.polarity;
      polarityReason='SR_TEGANG_DAN_REVERSAL_ASTRO_M1_TERKONFIRMASI';
    }else{
      polarityReason=trendEvent.eventType==='TEGANG'?
       'SR_TEGANG_MENUNGGU_REVERSAL_ASTRO':
       'SR_TIDAK_MEMBERI_ARAH_KONFIRMASI';
    }
   }
   if(candidate!=='WAIT'&&candidate===pending&&
      previousPolarityEvent===currentEventId)pendingBars++;
   else{pending=candidate;pendingBars=candidate==='WAIT'?0:1;}
   previousPolarityEvent=currentEventId;
   const solarPolarity=candidate!=='WAIT'&&pendingBars>=2?candidate:'WAIT';
   rows.push({
     ms:r.ms,utc:new Date(r.ms).toISOString(),
     returnYear:target.year,returnUTC:target.utc,
     astroV1:r.state,astroV2:r.configState,astroV2Score:r.configScore,
     eventType:top?.eventType||'NONE',
     topEvent:top,topFour:events,eventStrength:top?.strength||0,
     newEvent:fresh,
     astroTrend:astro.astroTrend,astroPolarity:astro.polarity,
     eventPolarity:solarPolarity,polarityReason,
     solarPolarityCandidate:candidate,
     // BUY/SELL labels are unvalidated ASTRO SCORE direction hypotheses.
     tradeDecision:'WAIT'
   });
   prev={ms:r.ms,positions};
   if(i%40===39){
     onProgress(75+Math.round((i+1)/1440*25));
     await new Promise(done=>setTimeout(done,0));
   }
  }
 }finally{eng.clear();}
 must(rows.length===1440,'Data transit M1 tidak lengkap.');
 const counts={HARMONIS:0,TEGANG:0,TRANSISI:0,NONE:0};
 const polarityCounts={BUY:0,SELL:0,WAIT:0};
 const eventList=[];
 for(const row of rows){
  counts[row.eventType]++;
  polarityCounts[row.eventPolarity]++;
  if(row.newEvent&&row.topEvent)eventList.push({
   utc:row.utc,wib:C.Time.hm(C.Time.wib(row.ms)),returnYear:row.returnYear,
   type:row.eventType,pair:row.topEvent.pair,aspect:row.topEvent.aspect,
   orb:row.topEvent.orb,strength:row.topEvent.strength
  });
 }
 const start=activeReturn(charts.returns,rows[0].ms);
 const end=activeReturn(charts.returns,rows[rows.length-1].ms);
 return Object.freeze({
  version:VERSION,model:'COMEX_SOLAR_RETURN_M1_RESEARCH',
  dateWIB:dateStr,baseline:charts,activeAtStart:start,
  activeAtEnd:end,rolloverDuringDay:start.year!==end.year,
  rows,counts,polarityCounts,eventList,minutes:rows.length,
  validatedForXAUUSD:false,tradeDecision:'WAIT',
  note:'Solar Return shows annual geocentric Sun longitude recurrence. BUY/SELL polarity is a separate unvalidated Astrology-score hypothesis, never a market trend or trading instruction.'
 });
}
function exportResearch(result){
 must(result&&result.minutes===1440,'Ekspor perlu 1.440 menit.');
 return {
  schema:'CEBONK_COMEX_SOLAR_RETURN_M1_RESEARCH_V1',
  dateWIB:result.dateWIB,timezone:'Asia/Jakarta',
  generatedAtUTC:new Date().toISOString(),
  baseline:result.baseline,
  polarityCounts:result.polarityCounts,
  eventPolarityMethod:'CONFIRMED_V2_ASTRO_SCORE_CONDITIONAL_ON_SOLAR_RETURN_EVENT',
  activeSolarReturnStart:result.activeAtStart.utc,
  activeSolarReturnEnd:result.activeAtEnd.utc,
  events:result.eventList,
  assumptions:'COMEX 1974-12-31, unverified natal hour 12:00 EST by default',
  allowAutoTrade:false,validatedForXAUUSD:false,tradeDecision:'WAIT',
  rows:result.rows.map(r=>({
   utc:r.utc,returnYear:r.returnYear,astroV2:r.astroV2,astroV2Score:r.astroV2Score,
   eventType:r.eventType,eventStrength:r.eventStrength,
   astroTrend:r.astroTrend,solarEventPolarity:r.eventPolarity,
   polarityReason:r.polarityReason,
   event:r.topEvent?{
     pair:r.topEvent.pair,aspect:r.topEvent.aspect,
     orb:r.topEvent.orb,phase:r.topEvent.phase
   }:null,tradeDecision:'WAIT'
  }))
 };
}
const API=Object.freeze({VERSION,BIRTH_DATE,FIRST_TRADE_REF,PLANETS,EVENTS,
 natalUTC,solarLongitude,solarReturn,getReturns,aspectOrb,eventsAt,analyzeDay,exportResearch});
root.CebonkComexSolarReturn=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);