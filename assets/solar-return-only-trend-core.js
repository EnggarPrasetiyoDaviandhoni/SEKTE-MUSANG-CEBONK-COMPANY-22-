/* SEKTE MUSANG — Solar Return murni / isolated research core v3.0
 * Only COMEX annual Solar Return chart + planetary transits are inputs.
 * Direction is a documented SYMBOLIC astrological hypothesis, not an observed
 * XAUUSD trend, price-based calibration, or a proven market forecasting model.
 * No Astro V1/V2, Al-Biruni, BaZi, market feeds, trading orders or fallbacks.
 */
(function(root){
'use strict';
const VERSION='3.0.0',MIN=60000,HOUR=60*MIN,DAY=24*HOUR;
const BODIES=Object.freeze({
 Venus:{nature:1,weight:1.0},Jupiter:{nature:1,weight:1.15},
 Mars:{nature:-1,weight:0.95},Saturn:{nature:-1,weight:1.15}
});
const TARGETS=Object.freeze({Sun:1.50,Moon:0.50,Venus:0.75,Jupiter:0.85});
const ASPECTS=Object.freeze([
 {name:'Konjungsi',angle:0,orb:2.0,weight:1.00},
 {name:'Sextile',angle:60,orb:1.6,weight:0.65},
 {name:'Square',angle:90,orb:1.8,weight:0.70},
 {name:'Trine',angle:120,orb:1.8,weight:0.75},
 {name:'Oposisi',angle:180,orb:2.0,weight:0.75}
]);
const must=(cond,msg)=>{if(!cond)throw Error(msg);};
const norm=n=>((n%360)+360)%360;
const separation=(a,b)=>Math.abs(norm(a-b+180)-180);
const orbOf=(a,b,angle)=>Math.abs(separation(a,b)-angle);
const classify=(score,activity,min=0.22)=>activity>0&&Math.abs(score)>=min?(score>0?'BUY':'SELL'):'WAIT';
function dateWIB(ms){return new Date(ms+7*HOUR).toISOString().slice(0,10);}
function timeWIB(ms){return new Date(ms+7*HOUR).toISOString().slice(11,16);}
function weekWindow(C,date){
 C.Time.parseDate(date);
 const day=Date.parse(date+'T00:00:00Z');
 const monday=(new Date(day).getUTCDay()+6)%7;
 const start=C.Time.wibToUTC(date,0)-monday*DAY;
 return Object.freeze({start,end:start+7*DAY,
  startWIB:dateWIB(start),endWIB:dateWIB(start+6*DAY)});
}
function returnAt(charts,ms){
 const list=charts.returns.filter(chart=>chart.ms<=ms);
 must(list.length>0,'Chart Solar Return aktif belum ada.');
 return list[list.length-1];
}
function scoreAt(positions,chart,previousPositions){
 must(chart&&Array.isArray(chart.bodies),'Chart SR tidak tersedia.');
 const sr=new Map(chart.bodies.map(b=>[b.id,b.longitude]));
 const events=[];
 for(const [id,nature] of Object.entries(BODIES)){
  const p=positions[id]?.lon,prev=previousPositions?.[id]?.lon;
  must(Number.isFinite(p),'Ephemeris '+id+' tidak tersedia.');
  for(const [target,weight] of Object.entries(TARGETS)){
   const lon=sr.get(target);
   must(Number.isFinite(lon),'Longitude '+target+' pada chart Solar Return hilang.');
   for(const aspect of ASPECTS){
    const orb=orbOf(p,lon,aspect.angle);
    if(orb>aspect.orb)continue;
    const prevOrb=Number.isFinite(prev)?orbOf(prev,lon,aspect.angle):null;
    const phase=orb<=0.12?'INTI':prevOrb===null?'TRANSISI':
      orb+0.000001<prevOrb?'AWAL':orb>prevOrb+0.000001?'AKHIR':'TRANSISI';
    const closeness=1-orb/aspect.orb;
    const strength=closeness*closeness*nature.weight*weight*aspect.weight;
    const signed=nature.nature*strength;
    events.push(Object.freeze({
     id:id+'|'+target+'|'+aspect.name+'|'+chart.year,
     planet:id,target,aspect:aspect.name,orb,phase,
     nature:nature.nature===1?'MENGUNTUNGKAN':'MERUGIKAN',
     contribution:signed,strength,chartYear:chart.year
    }));
   }
  }
 }
 events.sort((a,b)=>b.strength-a.strength||a.id.localeCompare(b.id));
 const positive=events.reduce((n,e)=>n+Math.max(0,e.contribution),0);
 const negative=events.reduce((n,e)=>n+Math.max(0,-e.contribution),0);
 const activity=positive+negative;
 const score=activity?(positive-negative)/activity:0;
 return Object.freeze({positive,negative,activity,score,
  direction:classify(score,activity),events});
}
function summarizeWeek(days){
 must(days.length===5,'Ringkasan Solar Return memerlukan Senin sampai Jumat.');
 const positive=days.reduce((n,d)=>n+d.positive,0);
 const negative=days.reduce((n,d)=>n+d.negative,0);
 const activity=positive+negative;
 const score=activity?(positive-negative)/activity:0;
 const candidate=classify(score,activity);
 const agreement=days.filter(d=>d.direction===candidate).length;
 const opposition=days.filter(d=>d.direction!=='WAIT'&&d.direction!==candidate).length;
 // No forced weekly BUY/SELL: 2 supporting days and a stronger than opposing
 // daily majority are required. WAIT if the astrological evidence is mixed.
 const direction=candidate!=='WAIT'&&agreement>=2&&agreement>opposition?candidate:'WAIT';
 const peak=direction==='WAIT'?null:days.filter(d=>d.direction===direction)
  .sort((a,b)=>b.activity*Math.abs(b.score)-a.activity*Math.abs(a.score))[0]||null;
 return Object.freeze({positive,negative,activity,score,direction,
  agreement,opposition,days,peakDay:peak?.dateWIB||null,
  method:'BENEFIC_VENUS_JUPITER_VS_MALEFIC_MARS_SATURN_TO_SR_SUN_MOON_VENUS_JUPITER',
  isPriceTrend:false,isValidated:false});
}
async function analyze(C,SR,A,date,hourNY=12,onProgress=()=>{},isCancelled=()=>false){
 must(C&&C.Time&&typeof C.createEngine==='function','CebonkCore tidak tersedia.');
 must(SR&&typeof SR.getReturns==='function','Solar Return core tidak tersedia.');
 must(A,'Ephemeris Astronomy Engine tidak tersedia.');
 C.Time.parseDate(date);
 must(Number.isInteger(hourNY)&&hourNY>=0&&hourNY<24,'Jam referensi tidak valid.');
 const bounds=weekWindow(C,date),charts=SR.getReturns(C,A,date,hourNY);
 const engine=C.createEngine(A);
 const days=[],rows=[],windows=[];
 try{
  for(let d=0;d<5;d++){
   let positive=0,negative=0,activeSlots=0;
   const dayStart=bounds.start+d*DAY;
   for(let h=0;h<24;h++){
    must(!isCancelled(),'Perhitungan dibatalkan.');
    const ms=dayStart+h*HOUR,chart=returnAt(charts,ms);
    const current=engine.get(ms).positions;
    const data=scoreAt(current,chart,engine.get(ms-5*MIN).positions);
    positive+=data.positive;negative+=data.negative;
    if(data.activity>0)activeSlots++;
   }
   const activity=positive+negative,score=activity?(positive-negative)/activity:0;
   days.push(Object.freeze({dateWIB:dateWIB(dayStart),positive,negative,
    activity,score,direction:classify(score,activity),activeSlots}));
   onProgress(Math.round((d+1)/5*45));
   await new Promise(done=>setTimeout(done,0));
  }
  const week=summarizeWeek(days),start=C.Time.wibToUTC(date,0);
  let confirmed=0,open=null,lastId=null;
  for(let i=0;i<288;i++){
   must(!isCancelled(),'Perhitungan dibatalkan.');
   const ms=start+i*5*MIN,chart=returnAt(charts,ms);
   const info=scoreAt(engine.get(ms).positions,chart,engine.get(ms-5*MIN).positions);
   const candidates=info.events.filter(e=>Math.sign(e.contribution)===(week.direction==='BUY'?1:-1));
   const leading=candidates[0]||null;
   const matching=week.direction!=='WAIT'&&info.direction===week.direction&&
     leading&&leading.strength>=0.08;
   confirmed=matching?confirmed+1:0;
   const signal=confirmed>=2?week.direction:'WAIT';
   const event=signal!=='WAIT'?leading:null;
   const row=Object.freeze({ms,utc:new Date(ms).toISOString(),timeWIB:timeWIB(ms),
    chartYear:chart.year,weekBias:week.direction,localBias:info.direction,
    score:info.score,activity:info.activity,signal,
    phase:signal==='WAIT'?'WAIT':event.phase,event,
    reason:week.direction==='WAIT'?'BIAS_MINGGUAN_TIDAK_KUKUH':
      signal==='WAIT'?'AKTIVASI_SR_TIDAK_SEARAH':'SR_MINGGUAN_DAN_ASPEK_SEARAH'});
   rows.push(row);
   if(signal==='WAIT'){if(open){windows.push(Object.freeze(open));open=null;}lastId=null;}
   else if(open&&lastId===event.id){
    open.end=ms+5*MIN;
    if(event.strength>open.peakStrength){open.peakStrength=event.strength;open.core=ms;
      open.corePhase=event.phase;open.aspect=event.aspect;}
   }else{
    if(open)windows.push(Object.freeze(open));
    open={start:ms,end:ms+5*MIN,core:ms,corePhase:event.phase,
     planet:event.planet,target:event.target,aspect:event.aspect,
     direction:signal,peakStrength:event.strength,chartYear:chart.year};
    lastId=event.id;
   }
   if(i%24===23){
    onProgress(45+Math.round((i+1)/288*55));
    await new Promise(done=>setTimeout(done,0));
   }
  }
  if(open)windows.push(Object.freeze(open));
  const active=returnAt(charts,C.Time.wibToUTC(date,0));
  return Object.freeze({version:VERSION,dateWIB:date,week:week,bounds,
   baseline:charts,activeReturn:active,rows,windows:windows.sort((a,b)=>
    b.peakStrength-a.peakStrength),
   sampleMinutes:5,weekday:new Date(Date.parse(date+'T00:00:00Z')).getUTCDay(),
   allowAutoTrade:false,validatedForXAUUSD:false,tradeDecision:'WAIT',
   disclaimer:'Arah adalah bias simbolik astrologi murni; bukan tren harga aktual atau akurasi terbukti.'});
 }finally{engine.clear();}
}
function exportResearch(r){
 must(r&&r.version===VERSION,'Hasil SR v3.0 tidak tersedia.');
 return {schema:'CEBONK_SOLAR_RETURN_ONLY_TREND_RESEARCH_V3',
  dateWIB:r.dateWIB,week:r.week,bounds:r.bounds,
  reference:{natalUTC:r.baseline.natalUTC,hourNY:r.baseline.hourNY,
   assumedClock:true,activeSolarReturnUTC:r.activeReturn.utc},
  windows:r.windows,rows:r.rows,allowAutoTrade:false,
  validatedForXAUUSD:false,tradeDecision:'WAIT',disclaimer:r.disclaimer};
}
const api=Object.freeze({VERSION,BODIES,TARGETS,ASPECTS,separation,orbOf,scoreAt,
 classify,weekWindow,returnAt,summarizeWeek,analyze,exportResearch,dateWIB,timeWIB});
root.CebonkSolarReturnOnly=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
