/* Al-Biruni aspect timing, v1. Independent modern ephemeris implementation.
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
 return {version:'1.0.0',range,focus,orb,stepMinutes,resolutionSeconds:1,events};
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
const API=Object.freeze({BODIES,ASPECTS,DAY,MIN,WIB,parseDate,period,iso,stamp,norm,signed,geometry,pairs,createEngine,scan,inspect,daily,direction,normalizeRules,toCSV});
root.CebonkAlBiruni=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
