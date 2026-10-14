/* Al-Biruni aspect timing, v1.5. Independent modern ephemeris implementation.
 * Historical inspiration: Al-Qanun al-Masudi XI, chapter 2.
 * No market prediction, price feed, legacy scoring or trade execution. */
(function(root){
'use strict';
const MIN=60000, DAY=86400000, WIB=420*MIN, RESOLUTION=1000;
const BODIES=Object.freeze(['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn']);
const ASPECTS=Object.freeze([
 {angle:0,name:'Konjungsi'}, {angle:60,name:'Sextile'}, {angle:90,name:'Square'},
 {angle:120,name:'Trine'}, {angle:180,name:'Oposisi'}
].map(Object.freeze));
function assert(ok,message){if(!ok)throw Error(message);}
const norm=x=>((x%360)+360)%360;
const signed=x=>norm(x+180)-180;
const iso=ms=>new Date(ms+WIB).toISOString().slice(0,10);
const stamp=ms=>new Date(ms+WIB).toISOString().slice(0,19).replace('T',' ')+' WIB';
function parseDate(date){
 assert(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date),'Pilih tanggal yang valid.');
 const ms=Date.parse(date+'T00:00:00Z'),year=Number(date.slice(0,4));
 assert(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===date,'Tanggal kalender tidak valid.');
 assert(year>=2020&&year<=2040,'Rentang tanggal 2020–2040.');
 return ms-WIB;
}
function period(date,mode='week'){
 const t=parseDate(date),d=new Date(t+WIB);let start=t,end=t+DAY;
 if(mode==='week'){start=t-((d.getUTCDay()+6)%7)*DAY;end=start+5*DAY;}
 else if(mode==='month'){
  start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)-WIB;
  end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)-WIB;
 }else assert(mode==='day','Pilih harian, mingguan, atau bulanan.');
 assert(Number(iso(start).slice(0,4))>=2020&&Number(iso(end-1).slice(0,4))<=2040,'Seluruh periode harus dalam 2020–2040.');
 const days=[];for(let ms=start;ms<end;ms+=DAY)days.push({date:iso(ms),start:ms,end:ms+DAY,weekday:new Date(ms+WIB).getUTCDay()});
 return {date,mode,start,end,days};
}
function geometry(a,b,angle){
 assert([a,b,angle].every(Number.isFinite),'Longitude/aspek tidak valid.');
 const direct=signed(b-a-angle),reverse=signed(b-a+angle);
 const error=Math.abs(direct)<=Math.abs(reverse)?direct:reverse;
 return {error,orb:Math.abs(error)};
}
function pairs(focus='moon'){
 assert(focus==='moon'||focus==='all','Pilihan pasangan tidak valid.');
 const result=[];
 for(let i=0;i<BODIES.length;i++)for(let j=i+1;j<BODIES.length;j++){
  if(focus==='all'||BODIES[i]==='Moon'||BODIES[j]==='Moon')result.push([BODIES[i],BODIES[j]]);
 }
 return result;
}
function createEngine(A){
 for(const name of ['MakeTime','GeoVector','Ecliptic'])assert(A&&typeof A[name]==='function','Astronomy Engine tidak lengkap: '+name+'.');
 const cache=new Map();
 function longitude(body,ms){
  assert(BODIES.includes(body)&&Number.isFinite(ms),'Objek/waktu ephemeris tidak valid.');
  const key=body+':'+ms;if(cache.has(key))return cache.get(key);
  const time=A.MakeTime(new Date(ms)),value=A.Ecliptic(A.GeoVector(body,time,true)).elon;
  assert(Number.isFinite(value),'Ephemeris gagal untuk '+body+'.');
  const lon=norm(value);cache.set(key,lon);return lon;
 }
 return Object.freeze({longitude,clear:()=>cache.clear()});
}
function errorAt(engine,pair,angle,ms){return geometry(engine.longitude(pair[0],ms),engine.longitude(pair[1],ms),angle).error;}
function bisect(fn,a,b){
 let fa=fn(a),fb=fn(b);
 assert(Number.isFinite(fa)&&Number.isFinite(fb)&&fa*fb<=0,'Akar tidak terkurung.');
 if(fa===0)return a;if(fb===0)return b;
 while(b-a>RESOLUTION){
  const m=(a+b)/2,fm=fn(m);assert(Number.isFinite(fm),'Geometri tidak valid.');
  if(fm===0)return m;
  if(fa*fm<=0){b=m;fb=fm;}else{a=m;fa=fm;}
 }
 return (a+b)/2;
}
function extremum(fn,a,b,sign){
 const ratio=(Math.sqrt(5)-1)/2;
 let c=b-ratio*(b-a),d=a+ratio*(b-a),fc=sign*fn(c),fd=sign*fn(d);
 while(b-a>RESOLUTION){
  if(fc<fd){b=d;d=c;fd=fc;c=b-ratio*(b-a);fc=sign*fn(c);}
  else{a=c;c=d;fc=fd;d=a+ratio*(b-a);fd=sign*fn(d);}
 }
 return (a+b)/2;
}
function unique(times){return times.sort((a,b)=>a-b).filter((t,i,a)=>!i||t-a[i-1]>0.5);}
function windows(engine,pair,aspect,range,times,orb){
 const fn=ms=>errorAt(engine,pair,aspect.angle,ms),values=times.map(fn);
 let knots=times.slice();
 // Refine stations as well as crossings; a retrograde turn can graze the
 // orb between samples, or cross an aspect twice within one outer window.
 for(let i=1;i<times.length-1;i++){
  const [a,b,c]=[values[i-1],values[i],values[i+1]];
  if(Math.max(Math.abs(b-a),Math.abs(c-b))>=90||Math.min(Math.abs(a),Math.abs(b),Math.abs(c))>orb+2)continue;
  if(b<=a&&b<=c&&(b<a||b<c))knots.push(extremum(fn,times[i-1],times[i+1],1));
  if(b>=a&&b>=c&&(b>a||b>c))knots.push(extremum(fn,times[i-1],times[i+1],-1));
 }
 knots=unique(knots.filter(ms=>ms>=range.start&&ms<=range.end).concat(range.start,range.end));const exact=[];
 for(let i=0;i<knots.length;i++){
  const a=knots[i],fa=fn(a);if(fa===0)exact.push(a);
  if(i+1<knots.length){
   const b=knots[i+1],fb=fn(b);
   // A branch change far from the aspect is not an exact contact.
   if(fa*fb<0&&Math.abs(fb-fa)<90)exact.push(bisect(fn,a,b));
  }
 }
 const roots=unique(exact);knots=unique(knots.concat(roots));
 const inside=ms=>Math.abs(fn(ms))-orb,spans=[];
 let entered=inside(range.start)<=0?range.start:null;
 for(let i=0;i<knots.length-1;i++){
  const a=knots[i],b=knots[i+1],activeA=inside(a)<=0,activeB=inside(b)<=0;
  if(!activeA&&activeB)entered=bisect(inside,a,b);
  if(activeA&&!activeB&&entered!==null){spans.push([entered,bisect(inside,a,b)]);entered=null;}
 }
 if(entered!==null)spans.push([entered,range.end]);
 return spans.filter(([a,b])=>b-a>RESOLUTION).map(([start,end])=>{
  const exactTimes=roots.filter(ms=>ms>=start&&ms<end&&ms<range.end);
  const candidates=knots.filter(ms=>ms>=start&&ms<=end).concat(start,end);
  let closest=candidates.reduce((a,b)=>Math.abs(fn(a))<=Math.abs(fn(b))?a:b);
  if(exactTimes.length)closest=exactTimes[0];
  return {
   id:pair.join('-')+'-'+aspect.angle+'-'+Math.round(start),pair:pair.slice(),angle:aspect.angle,name:aspect.name,
   start,end,exactTimes,closest,closestOrb:Math.abs(fn(closest)),
   startClipped:start===range.start,endClipped:end===range.end
  };
 });
}
async function scan(engine,date,{mode='week',focus='moon',orb=2,stepMinutes=15,onProgress=()=>{},cancelled=()=>false,yieldNow=()=>new Promise(r=>setTimeout(r,0))}={}){
 assert(engine&&typeof engine.longitude==='function','Mesin perhitungan belum tersedia.');
 assert(Number.isFinite(orb)&&orb>=0.25&&orb<=5,'Orb harus 0.25°–5°.');
 assert(Number.isInteger(stepMinutes)&&stepMinutes>=1&&stepMinutes<=15,'Grid pencarian harus 1–15 menit.');
 const range=period(date,mode),selected=pairs(focus),times=[];
 const check=()=>assert(!cancelled(),'Perhitungan dibatalkan.');
 for(let ms=range.start-stepMinutes*MIN;ms<range.end+stepMinutes*MIN;ms+=stepMinutes*MIN)times.push(ms);
 times.push(range.end,range.end+stepMinutes*MIN);times.sort((a,b)=>a-b);
 const used=[...new Set(selected.flat())];if(engine.clear)engine.clear();
 for(let i=0;i<times.length;i++){
  check();for(const body of used)engine.longitude(body,times[i]);
  if(i%32===0){onProgress(Math.round(i/times.length*65));await yieldNow();}
 }
 const events=[];
 for(let i=0;i<selected.length;i++){
  check();for(const aspect of ASPECTS)events.push(...windows(engine,selected[i],aspect,range,times,orb));
  onProgress(Math.round(65+(i+1)/selected.length*35));await yieldNow();
 }
 check();events.sort((a,b)=>a.closest-b.closest||a.start-b.start||a.id.localeCompare(b.id));
 return {version:'1.5.0',range,focus,orb,stepMinutes,resolutionSeconds:1,events};
}
function normalizeRules(input={}){
 const rules={};for(const a of ASPECTS)rules[a.angle]=['BUY','SELL','NETRAL'].includes(input[a.angle])?input[a.angle]:'NETRAL';
 return rules;
}
function direction(events,rules={}){
 const r=normalizeRules(rules),labels=new Set(events.map(e=>r[e.angle]).filter(s=>s!=='NETRAL'));
 return labels.size>1?'KONFLIK':labels.values().next().value||'NETRAL';
}
function inspect(engine,result,ms,rules={}){
 assert(Number.isFinite(ms)&&ms>=result.range.start&&ms<result.range.end,'Waktu di luar periode.');
 const active=[];
 for(const event of result.events){
  if(ms<event.start||ms>=event.end)continue;
  const orb=Math.abs(errorAt(engine,event.pair,event.angle,ms));
  const before=Math.abs(errorAt(engine,event.pair,event.angle,ms-5*MIN));
  const after=Math.abs(errorAt(engine,event.pair,event.angle,ms+5*MIN));
  const atExact=event.exactTimes.some(t=>Math.abs(t-ms)<=RESOLUTION);
  const phase=atExact?'EXACT':Math.abs(after-before)<1e-6?'STATION':after<before?'APPLYING':'SEPARATING';
  active.push({...event,orb,phase,bias:normalizeRules(rules)[event.angle]});
 }
 return {ms,active,direction:direction(active,rules)};
}
function daily(result){
 return result.range.days.map(day=>{
  const events=result.events.filter(e=>e.start<day.end&&e.end>day.start);
  const exactCount=events.reduce((n,e)=>n+e.exactTimes.filter(t=>t>=day.start&&t<day.end).length,0);
  return {...day,events,exactCount};
 });
}
function toCSV(result,rules={}){
 const r=normalizeRules(rules),header=['version','period','pair','aspect_deg','orb_setting_deg','start_utc','exact_utc','closest_utc','closest_orb_deg','end_utc','start_wib','exact_wib','closest_wib','end_wib','start_clipped','end_clipped','manual_bias_UNVALIDATED'];
 const rows=result.events.map(e=>[result.version,result.range.mode,e.pair.join('/'),e.angle,result.orb,new Date(e.start).toISOString(),e.exactTimes.map(t=>new Date(t).toISOString()).join(' | '),new Date(e.closest).toISOString(),e.closestOrb.toFixed(8),new Date(e.end).toISOString(),stamp(e.start),e.exactTimes.map(stamp).join(' | '),stamp(e.closest),stamp(e.end),e.startClipped,e.endClipped,r[e.angle]]);
 const quote=x=>'"'+String(x).replace(/"/g,'""')+'"';
 return '\uFEFF'+[header,...rows].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
}
// Research-ready observations WITHOUT invented XAUUSD prices or presumed profitability.
// Every true exact is one observation; a window with no exact has one explicitly
// marked closest approach. Calendar days are evaluated in WIB; weekends never
// transfer/shift their astronomical events onto Friday or Monday.
// CEBONK AUTO EXPERIMENT v1 — modern, UNVALIDATED XAUUSD hypothesis.
// Planet sign is an explicit model assumption, NOT Al-Biruni's gold trading rule.
// The aspect changes weighting only: sextile never means BUY by itself,
// and square never means SELL by itself. Real gold returns are NOT available.
const AUTO_NATURE=Object.freeze({Sun:0.20,Moon:0,Mercury:0,Venus:0.90,Mars:-0.95,Jupiter:1.15,Saturn:-1.15});
const AUTO_ASPECT=Object.freeze({0:0.90,60:1.00,90:0.75,120:1.10,180:0.80});
const AUTO_PHASE=Object.freeze({APPLYING:1.10,EXACT:1.25,SEPARATING:0.80,STATION:0.70});
const AUTO_THRESHOLD=0.18,AUTO_CONFLICT_RATIO=0.45;
function autoSignal(engine,result,ms){
 assert(result&&result.range&&Number.isFinite(result.orb),'Periode Al-Biruni belum dihitung.');
 const observed=inspect(engine,result,ms);
 const items=observed.active.map(e=>{
  const planetNature=(AUTO_NATURE[e.pair[0]]+AUTO_NATURE[e.pair[1]])/2;
  const aspectWeight=AUTO_ASPECT[e.angle],phaseWeight=AUTO_PHASE[e.phase];
  const orbWeight=Math.max(0,1-e.orb/result.orb);
  const contribution=planetNature*aspectWeight*phaseWeight*orbWeight;
  const nearestExact=e.exactTimes.length?
   e.exactTimes.reduce((a,b)=>Math.abs(ms-a)<=Math.abs(ms-b)?a:b):null;
  return {
   id:e.id,pair:e.pair.slice(),angle:e.angle,name:e.name,
   start:e.start,end:e.end,exact:nearestExact,closest:e.closest,
   phase:e.phase,orb:e.orb,planetNature,aspectWeight,phaseWeight,
   orbWeight,contribution
  };
 }).sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)||a.id.localeCompare(b.id));
 const buy=items.reduce((v,x)=>v+Math.max(0,x.contribution),0);
 const sell=items.reduce((v,x)=>v+Math.max(0,-x.contribution),0);
 const net=buy-sell;
 let direction='NETRAL',reason='NO_ACTIVE_ASPECT';
 if(items.length){
  if(buy<AUTO_THRESHOLD&&sell<AUTO_THRESHOLD)reason='NO_STRONG_PLANETARY_COMBINATION';
  else if(Math.min(buy,sell)>=AUTO_THRESHOLD&&
          Math.min(buy,sell)>=Math.max(buy,sell)*AUTO_CONFLICT_RATIO){
   direction='KONFLIK';reason='BUY_SELL_OVERLAP';
  }else if(Math.abs(net)<AUTO_THRESHOLD)reason='NET_SCORE_BELOW_THRESHOLD';
  else{direction=net>0?'BUY':'SELL';reason='DOMINANT_WEIGHTED_ASPECTS';}
 }
 const supporting=items.filter(e=>direction==='BUY'?e.contribution>0:direction==='SELL'?e.contribution<0:true);
 return {
  model:'ALBIRUNI_AUTO_EXPERIMENT_V1',validated:false,ms,
  direction,reason,buy,sell,net,threshold:AUTO_THRESHOLD,
  conflictRatio:AUTO_CONFLICT_RATIO,active:items,
  dominant:supporting[0]||null
 };
}
// Sampled aggregate bias windows; boundaries and PEAK are GRID-based estimates,
// not exact orbital events. Exact MULAI/INTI/AKHIR are on dominant aspect above.
function autoTimeline(engine,result,dayStart,{stepMinutes=15}={}){
 assert(Number.isInteger(stepMinutes)&&stepMinutes>=5&&stepMinutes<=60&&
        60%stepMinutes===0,'Grid AUTO harus membagi satu jam.');
 assert(result.range.days.some(d=>d.start===dayStart),'Hari tidak ada dalam periode.');
 const dayEnd=dayStart+DAY,raw=[];
 let current=null;
 for(let ms=dayStart;ms<dayEnd;ms+=stepMinutes*MIN){
  const signal=autoSignal(engine,result,ms);
  if(signal.direction!=='BUY'&&signal.direction!=='SELL'){current=null;continue;}
  if(!current||current.direction!==signal.direction||current.end!==ms){
   current={direction:signal.direction,start:ms,end:ms+stepMinutes*MIN,peak:ms,
    peakNet:Math.abs(signal.net),dominantId:signal.dominant?.id||''};
   raw.push(current);
  }else{
   current.end=ms+stepMinutes*MIN;
   if(Math.abs(signal.net)>current.peakNet){
    current.peakNet=Math.abs(signal.net);current.peak=ms;
    current.dominantId=signal.dominant?.id||'';
   }
  }
 }
 return {model:'ALBIRUNI_AUTO_EXPERIMENT_V1',validated:false,
  resolutionMinutes:stepMinutes,dayStart,windows:raw};
}
// Coherent daily/weekly/monthly overview of the SAME AUTO experimental model.
// Aggregation never moves weekend aspects to trading days, never invents market
// prices, and never forces a direction when the evidence remains balanced.
// All directional windows are sampled at the declared resolution, NOT exact
// planetary aspect start/end timestamps.
function autoPeriodSummary(engine,result,{stepMinutes}={}){
 assert(result&&result.range&&Array.isArray(result.range.days),'Periode Al-Biruni belum dihitung.');
 const resolution=stepMinutes??(result.range.mode==='month'?60:result.range.mode==='week'?30:15);
 assert([15,30,60].includes(resolution),'Resolusi periode harus 15/30/60 menit.');
 const days=[];
 let buyDuration=0,sellDuration=0,neutralDays=0,conflictDays=0;
 const all=[];
 for(const day of result.range.days){
  const report=autoTimeline(engine,result,day.start,{stepMinutes:resolution});
  const ranked=report.windows.slice().sort((a,b)=>(b.end-b.start)-(a.end-a.start)||
   b.peakNet-a.peakNet||a.start-b.start);
  const buy=report.windows.filter(w=>w.direction==='BUY').reduce((v,w)=>v+(w.end-w.start)/MIN,0);
  const sell=report.windows.filter(w=>w.direction==='SELL').reduce((v,w)=>v+(w.end-w.start)/MIN,0);
  const marketClosed=day.weekday===0||day.weekday===6;
  // Weekend planetary states are calculated and shown but excluded from
  // directional XAUUSD summaries; never shift to Friday/Monday.
  if(!marketClosed){buyDuration+=buy;sellDuration+=sell;}
  const focus=buy>sell?'BUY':sell>buy?'SELL':'NETRAL';
  if(focus==='NETRAL')neutralDays++;
  if(buy>0&&sell>0)conflictDays++;
  const selected=ranked.find(w=>w.direction===focus)||null;
  days.push({date:day.date,weekday:day.weekday,marketClosed,direction:focus,
    buyMinutes:buy,sellMinutes:sell,windowCount:report.windows.length,
    window:selected,allWindows:report.windows});
  if(!marketClosed)all.push(...report.windows);
 }
 let direction=buyDuration>sellDuration?'BUY':sellDuration>buyDuration?'SELL':'NETRAL';
 const focusWindows=all.filter(w=>w.direction===direction)
  .sort((a,b)=>(b.end-b.start)-(a.end-a.start)||b.peakNet-a.peakNet||a.start-b.start);
 const dominant=direction==='NETRAL'?null:focusWindows[0]||null;
 // ONE WAY: establish ONE primary direction for the whole chosen date/week/month.
 // A day with no matching windows is WAIT, never reclassified as the opposite
 // and never given an invented entry window. Raw observations remain untouched.
 let focusDays=0,waitDays=0,counterMinutes=0;
 const focusedDays=days.map(day=>{
  const selected=direction==='NETRAL'||day.marketClosed?[]:
   day.allWindows.filter(w=>w.direction===direction);
  const ranked=selected.slice().sort((a,b)=>(b.end-b.start)-(a.end-a.start)||
   b.peakNet-a.peakNet||a.start-b.start);
  const focusWindow=ranked[0]||null;
  const focusMinutes=selected.reduce((m,w)=>m+(w.end-w.start)/MIN,0);
  const counterDuration=day.marketClosed?0:
   (direction==='BUY'?day.sellMinutes:direction==='SELL'?day.buyMinutes:day.buyMinutes+day.sellMinutes);
  counterMinutes+=counterDuration;
  if(!day.marketClosed){if(focusMinutes>0)focusDays++;else waitDays++;}
  return {...day,focusDirection:day.marketClosed?'MARKET_TUTUP':
   focusMinutes>0?direction:'WAIT',focusMinutes,focusWindow,
   focusWindows:selected,counterMinutes:counterDuration};
 });
 return {
  model:'ALBIRUNI_AUTO_EXPERIMENT_V1',validated:false,singleDirection:true,
  focusDays,waitDays,counterMinutes,
  mode:result.range.mode,start:result.range.start,end:result.range.end,
  resolutionMinutes:resolution,direction,buyMinutes:buyDuration,sellMinutes:sellDuration,
  neutralDays,daysWithBothDirections:conflictDays,days:focusedDays,
  startWindow:dominant?.start??null,core:dominant?.peak??null,endWindow:dominant?.end??null,
  dominantWindow:dominant
 };
}
// An independently computed horizon gives ONE direction and (only when a
// dominant market-day window exists) a dated, WIB-stamped candidate time.
// ENTRY = highest raw model score's sampled grid instant ("INTI"), NOT a
// verified market entry, astronomical exact, order, or forward forecast.
// Preserve all cross-horizon disagreements; no forced alignment.
function periodEntryReport(engine,result){
 const summary=autoPeriodSummary(engine,result);
 const w=summary.dominantWindow;
 const hasCandidate=(summary.direction==='BUY'||summary.direction==='SELL')&&
  w&&Number.isFinite(w.start)&&Number.isFinite(w.peak)&&Number.isFinite(w.end)&&
  w.start<=w.peak&&w.peak<w.end&&
  w.start>=result.range.start&&w.end<=result.range.end;
 if(!hasCandidate){
  return {mode:summary.mode,model:summary.model,validated:false,
   direction:'WAIT',periodDirection:summary.direction,
   reason:summary.direction==='NETRAL'?'NO_SINGLE_DIRECTION':'NO_VALID_MARKET_WINDOW',
   resolutionMinutes:summary.resolutionMinutes,
   periodStart:summary.start,periodEnd:summary.end,
   entryUTC:null,entryWIB:null,entryDateWIB:null,
   startUTC:null,coreUTC:null,endUTC:null,startWIB:null,coreWIB:null,endWIB:null,
   aspect:null,summary};
 }
 // A valid focus window is already weekday-only in autoPeriodSummary;
 // double-check to fail closed when called with malformed results.
 const weekday=new Date(w.peak+WIB).getUTCDay();
 if(weekday===0||weekday===6){
  return {mode:summary.mode,model:summary.model,validated:false,
   direction:'WAIT',periodDirection:summary.direction,reason:'MARKET_CLOSED',
   resolutionMinutes:summary.resolutionMinutes,periodStart:summary.start,periodEnd:summary.end,
   entryUTC:null,entryWIB:null,entryDateWIB:null,
   startUTC:null,coreUTC:null,endUTC:null,startWIB:null,coreWIB:null,endWIB:null,
   aspect:null,summary};
 }
 const active=autoSignal(engine,result,w.peak);
 const dominant=active.dominant&&
  Math.sign(active.dominant.contribution)===(summary.direction==='BUY'?1:-1)?
  active.dominant:null;
 const aspect=dominant?{
  pair:dominant.pair.slice(),name:dominant.name,angle:dominant.angle,
  phase:dominant.phase,orb:dominant.orb,contribution:dominant.contribution,
  exactUTC:dominant.exact,closestUTC:dominant.closest
 }:null;
 return {
  mode:summary.mode,model:summary.model,validated:false,
  direction:summary.direction,periodDirection:summary.direction,
  reason:'DOMINANT_WINDOW_PEAK_GRID',resolutionMinutes:summary.resolutionMinutes,
  periodStart:summary.start,periodEnd:summary.end,
  entryUTC:w.peak,entryWIB:stamp(w.peak),entryDateWIB:iso(w.peak),
  startUTC:w.start,coreUTC:w.peak,endUTC:w.end,
  startWIB:stamp(w.start),coreWIB:stamp(w.peak),endWIB:stamp(w.end),
  aspect,summary
 };
}
function studyObservations(result,rules={}){
 assert(result&&result.range&&Array.isArray(result.events),'Hasil aspek belum valid.');
 const normalized=normalizeRules(rules),out=[];
 for(const e of result.events){
  const exact=e.exactTimes.length>0;
  const moments=exact?e.exactTimes:[e.closest];
  for(const ms of moments){
   if(!Number.isFinite(ms)||ms<result.range.start||ms>=result.range.end)continue;
   const dow=new Date(ms+WIB).getUTCDay();
   out.push(Object.freeze({
    eventId:e.id, pair:e.pair.join('/'), angle:e.angle,
    kind:exact?'EXACT':'TERDEKAT_BUKAN_EXACT',
    time:ms, timeWIB:stamp(ms),
    orb:exact?0:e.closestOrb, windowStart:e.start, windowEnd:e.end,
    weekday:dow>=1&&dow<=5?'HARI_KERJA':'AKHIR_PEKAN',
    manualBias:normalized[e.angle],
    clippedStart:e.startClipped,clippedEnd:e.endClipped
   }));
  }
 }
 out.sort((a,b)=>a.time-b.time||a.eventId.localeCompare(b.eventId));
 return out;
}
function toStudyCSV(result,rules={}){
 const observations=studyObservations(result,rules);
 const header=[
  'study_version','model','date_mode','focus','ephemeris','coord_system','orb_rule_deg','grid_minutes',
  'event_id','pair','aspect_deg','observation_kind','time_utc','time_wib','orb_at_observation_deg',
  'window_start_utc','window_end_utc','window_start_clipped','window_end_clipped','session_wib',
  'manual_bias_UNVALIDATED','observed_xau_t0_EMPTY','observed_xau_1h_EMPTY','observed_xau_4h_EMPTY'
 ];
 const data=observations.map(e=>[
  'ALBIRUNI_EVENT_STUDY_V1',result.version,result.range.mode,result.focus,
  'astronomy-engine@2.1.19','geocentric_apparent_tropical_true_ecliptic_of_date',
  result.orb,result.stepMinutes,e.eventId,e.pair,e.angle,e.kind,new Date(e.time).toISOString(),
  e.timeWIB,e.orb.toFixed(8),new Date(e.windowStart).toISOString(),
  new Date(e.windowEnd).toISOString(),e.clippedStart,e.clippedEnd,e.weekday,e.manualBias,
  '','',''
 ]);
 const quote=x=>'"'+String(x).replace(/"/g,'""')+'"';
 return '\uFEFF'+[header,...data].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
}
// Append AUTO hypotheses to the EXISTING 24-column study format without
// filling broker prices or silently altering the legacy manual study schema.
function toAutoStudyCSV(engine,result,rules={}){
 const observations=studyObservations(result,rules);
 const raw=toStudyCSV(result,rules).replace(/^\uFEFF/,'').trimEnd().split('\r\n');
 assert(raw.length===observations.length+1,'Baris riset AUTO tidak selaras.');
 const tail=['auto_hypothesis_UNVALIDATED','auto_buy_weight','auto_sell_weight','auto_reason'];
 const q=x=>'"'+String(x).replace(/"/g,'""')+'"';
 const rows=[raw[0]+','+tail.map(q).join(',')];
 observations.forEach((o,i)=>{
  const signal=autoSignal(engine,result,o.time);
  rows.push(raw[i+1]+','+[signal.direction,signal.buy.toFixed(6),
   signal.sell.toFixed(6),signal.reason].map(q).join(','));
 });
 return '\uFEFF'+rows.join('\r\n')+'\r\n';
}
const API=Object.freeze({BODIES,ASPECTS,DAY,MIN,WIB,parseDate,period,iso,stamp,norm,signed,geometry,pairs,createEngine,scan,inspect,daily,direction,normalizeRules,toCSV,studyObservations,toStudyCSV,toAutoStudyCSV,autoSignal,autoTimeline,autoPeriodSummary,periodEntryReport,AUTO_NATURE,AUTO_ASPECT,AUTO_PHASE,AUTO_THRESHOLD});
root.CebonkAlBiruni=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
