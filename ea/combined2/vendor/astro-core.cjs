
/* CEBONK ASTROLOGY • v2.0 • SSOT / pure computation / no trading API.
   Ephemeris: Astronomy Engine 2.1.19 (MIT), apparent geocentric tropical ECT.
   Cairo time rules: IANA tzdb africa, verified 2026-10-03. Supported 2020–2040.
   The legacy V1 directional score is an UNVALIDATED experiment, not astronomy. */
(function(root){
'use strict';
const freeze = o => { Object.values(o).forEach(v => {if(v && typeof v==='object' && !Object.isFrozen(v)) freeze(v);}); return Object.freeze(o); };
const CFG=freeze({
 version:'2.0.0', step:5, yearMin:2020, yearMax:2040, wibOffset:420,
 luxor:{name:'Luxor, Mesir',lat:25.6872,lon:32.6396,zone:'Africa/Cairo'},
 timezoneSnapshot:'2026-10-03',
 planets:[
  {id:'Sun',nature:1.10,weight:1.25},{id:'Moon',nature:0.55,weight:1.45},
  {id:'Mercury',nature:0.20,weight:0.90},{id:'Venus',nature:1.00,weight:1.10},
  {id:'Mars',nature:-1.00,weight:1.20},{id:'Jupiter',nature:1.25,weight:1.25},
  {id:'Saturn',nature:-1.25,weight:1.25},{id:'Uranus',nature:-0.45,weight:0.85},
  {id:'Neptune',nature:-0.25,weight:0.80},{id:'Pluto',nature:-0.95,weight:1.05}
 ],
 angles:['ASC','MC'],
 aspects:[
  {name:'Conjunction',symbol:'0°',angle:0,pol:0.40,weight:1.35,orb:2.2},
  {name:'Sextile',symbol:'60°',angle:60,pol:1.00,weight:1.00,orb:1.8},
  {name:'Square',symbol:'90°',angle:90,pol:-1.00,weight:1.25,orb:2.0},
  {name:'Trine',symbol:'120°',angle:120,pol:1.10,weight:1.20,orb:2.0},
  {name:'Opposition',symbol:'180°',angle:180,pol:-1.15,weight:1.35,orb:2.2}
 ],
 angleOrb:2.0, exactOrb:0.06, buy:1.15, sell:-1.15, transitionDelta:0.55,
 zodiac:['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
});
const DEG=Math.PI/180, MIN=60000, DAY=86400000;
const norm=x=>((x%360)+360)%360;
const signed=x=>norm(x+180)-180;
const pad=x=>String(x).padStart(2,'0');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function assert(v,msg){if(!v) throw new Error(msg);}
function parts(ms,offset){
 const d=new Date(ms+offset*MIN);
 return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes(),second:d.getUTCSeconds(),offset};
}
function dateISO(p){return `${p.year}-${pad(p.month)}-${pad(p.day)}`;}
function hm(p){return `${pad(p.hour)}:${pad(p.minute)}`;}
function hms(p){return `${hm(p)}:${pad(p.second)}`;}
function offsetLabel(n){return `UTC${n<0?'-':'+'}${Math.floor(Math.abs(n)/60)}${Math.abs(n)%60?':'+pad(Math.abs(n)%60):''}`;}
function parseDate(s){
 assert(/^\d{4}-\d{2}-\d{2}$/.test(s),'Pilih tanggal yang valid.');
 const [y,m,d]=s.split('-').map(Number),t=Date.UTC(y,m-1,d),z=new Date(t);
 assert(y>=CFG.yearMin&&y<=CFG.yearMax,`Tanggal didukung ${CFG.yearMin}–${CFG.yearMax}.`);
 assert(z.getUTCFullYear()===y&&z.getUTCMonth()===m-1&&z.getUTCDate()===d,'Tanggal kalender tidak valid.');
 return t;
}
function wibToUTC(iso,minute){
 assert(Number.isInteger(minute)&&minute>=0&&minute<=1440,'Jam WIB tidak valid.');
 return parseDate(iso)+(minute-CFG.wibOffset)*MIN;
}
function lastWeekday(y,monthIndex,weekday){
 const d=new Date(Date.UTC(y,monthIndex+1,0));
 return d.getUTCDate()-(d.getUTCDay()-weekday+7)%7;
}
function cairoBounds(y){
 // Start last Fri Apr at 00:00 STANDARD (+2); end last Thu Oct at 24:00 DAYLIGHT (+3).
 return {start:Date.UTC(y,3,lastWeekday(y,3,5),-2),end:Date.UTC(y,9,lastWeekday(y,9,4)+1,-3)};
}
function luxorOffset(ms,mode='AUTO'){
 assert(Number.isFinite(ms),'Waktu UTC tidak valid.');
 assert(mode==='AUTO'||mode==='FIXED3','Mode waktu tidak valid.');
 if(mode==='FIXED3') return 180;
 const y=new Date(ms).getUTCFullYear();
 // One adjacent year is allowed for timezone conversion of a boundary date.
 assert(y>=CFG.yearMin-1&&y<=CFG.yearMax+1,'Tahun di luar tabel waktu.');
 if(y<2023) return 120;
 const b=cairoBounds(y);
 return ms>=b.start&&ms<b.end?180:120;
}
const Time=Object.freeze({parts,dateISO,hm,hms,offsetLabel,parseDate,wibToUTC,cairoBounds,luxorOffset,
 wib:ms=>parts(ms,CFG.wibOffset),luxor:(ms,mode)=>parts(ms,luxorOffset(ms,mode)),
 today:()=>dateISO(parts(Date.now(),CFG.wibOffset))
});
function anglesFromSidereal(lstDeg,obliquityDeg,latitude){
 assert([lstDeg,obliquityDeg,latitude].every(Number.isFinite),'Sudut astronomi tidak valid.');
 assert(Math.abs(latitude)<66,'Latitude di luar batas mesin ASC/MC ini.');
 const t=lstDeg*DEG,e=obliquityDeg*DEG,p=latitude*DEG;
 // Eastern ecliptic/horizon intersection; the opposite root is DSC, not ASC.
 const ASC=norm(Math.atan2(Math.cos(t),-Math.sin(t)*Math.cos(e)-Math.tan(p)*Math.sin(e))/DEG);
 // Upper meridian intersection; atan2 preserves the correct quadrant.
 const MC=norm(Math.atan2(Math.sin(t),Math.cos(t)*Math.cos(e))/DEG);
 return {ASC,MC};
}
function aspectGeometry(lon1,lon2,a){
 const d=norm(lon2-lon1);
 const first=signed(d-a.angle),second=signed(d+a.angle);
 const error=Math.abs(first)<=Math.abs(second)?first:second;
 return {error,orb:Math.abs(error)};
}
function phase(error,rate){
 const orb=Math.abs(error),orbRate=Math.sign(error)*rate;
 if(orb<=CFG.exactOrb) return 'EXACT';
 if(Math.abs(rate)<1e-7) return 'STATIONARY';
 return orbRate<0?'APPLYING':'SEPARATING';
}
const planetMap=Object.fromEntries(CFG.planets.map(p=>[p.id,p]));
function legacyImpact(id1,id2,a,orb,ph){
 // This is the inherited V1 HEURISTIC, not an empirically estimated price relationship.
 // Local angles never receive invented BUY/SELL coefficients.
 if(!planetMap[id1]||!planetMap[id2]) return 0;
 const p=planetMap[id1],q=planetMap[id2],near=clamp(1-orb/a.orb,0,1);
 const pol=a.angle===0?(p.nature+q.nature)/2:a.pol;
 const blend=(Math.abs(p.nature)+Math.abs(q.nature)+0.8)/2;
 const boost=ph==='EXACT'?1.25:ph==='APPLYING'?1.10:0.90;
 return pol*a.weight*blend*(p.weight+q.weight)/2*near*boost;
}
const pairs=[];
for(let i=0;i<CFG.planets.length;i++){
 for(let j=i+1;j<CFG.planets.length;j++) pairs.push([CFG.planets[i].id,CFG.planets[j].id,false]);
 for(const angle of CFG.angles) pairs.push([CFG.planets[i].id,angle,true]);
}
freeze(pairs);
function analyse(prev,now,next,modelEnabled=true){
 const speeds={};
 for(const id of Object.keys(now.positions)) speeds[id]=signed(next.positions[id].lon-prev.positions[id].lon)/(next.ms-prev.ms)*DAY;
 const active=[]; let score=0;
 for(const [id1,id2,local] of pairs){
  for(const a of CFG.aspects){
   const g=aspectGeometry(now.positions[id1].lon,now.positions[id2].lon,a),limit=local?CFG.angleOrb:a.orb;
   if(g.orb>limit) continue;
   const ph=phase(g.error,speeds[id2]-speeds[id1]);
   const impact=local?0:legacyImpact(id1,id2,a,g.orb,ph);
   if(!local) score+=impact;
   active.push({id1,id2,local,name:a.name,angle:a.angle,orb:g.orb,phase:ph,impact,limit,
    prevOrb:aspectGeometry(prev.positions[id1].lon,prev.positions[id2].lon,a).orb,
    nextOrb:aspectGeometry(next.positions[id1].lon,next.positions[id2].lon,a).orb});
  }
 }
 active.sort((a,b)=>a.orb-b.orb||a.id1.localeCompare(b.id1));
 return {ms:now.ms,positions:now.positions,speeds,active,score:modelEnabled?score:null,state:'NEUTRAL'};
}
function classify(score,prev){
 if(score===null) return 'DATA';
 if(score>=CFG.buy) return 'BUY';
 if(score<=CFG.sell) return 'SELL';
 if(prev!==null&&Math.abs(score-prev)>=CFG.transitionDelta) return 'TRANSITION';
 return 'NEUTRAL';
}
function segments(samples){
 const out=[];
 for(const s of samples){
  let g=out[out.length-1];
  if(!g||g.state!==s.state){g={state:s.state,start:s.ms,end:s.ms+CFG.step*MIN,best:s,samples:[],sum:0};out.push(g);}
  g.end=s.ms+CFG.step*MIN; g.samples.push(s);g.sum+=s.score||0;
  if(Math.abs(s.score||0)>Math.abs(g.best.score||0)) g.best=s;
 }
 return out; // Keep every interval, including single 5-minute NEUTRAL/TRANSITION intervals.
}
function longestWindow(groups){
 return groups.filter(g=>g.state==='BUY'||g.state==='SELL').sort((a,b)=>
  (b.end-b.start)-(a.end-a.start)||Math.abs(b.best.score)-Math.abs(a.best.score)||a.start-b.start)[0]||null;
}
function checkAPI(A){
 for(const name of ['GeoVector','Ecliptic','MakeTime','SiderealTime','Rotation_ECT_EQD','Rotation_EQJ_EQD','RotateVector','EquatorFromVector','Vector'])
  assert(A&&typeof A[name]==='function',`Astronomy Engine tidak lengkap: ${name}.`);
}
function createEngine(A){
 checkAPI(A);
 const cache=new Map();
 function get(ms){
  if(cache.has(ms)) return cache.get(ms);
  const time=A.MakeTime(new Date(ms)), positions={};
  const rotation=A.Rotation_EQJ_EQD(time);
  for(const p of CFG.planets){
   const vector=A.GeoVector(p.id,time,true),ec=A.Ecliptic(vector);
   const eq=A.EquatorFromVector(A.RotateVector(rotation,vector));
   assert(Number.isFinite(ec.elon)&&Number.isFinite(eq.dec),`Ephemeris ${p.id} gagal.`);
   positions[p.id]={lon:norm(ec.elon),lat:ec.elat,dec:eq.dec};
  }
  const ectToEqd=A.Rotation_ECT_EQD(time);
  const y=A.RotateVector(ectToEqd,new A.Vector(0,1,0,time));
  const obliquity=Math.atan2(y.z,y.y)/DEG;
  const lst=norm(15*A.SiderealTime(time)+CFG.luxor.lon);
  const local=anglesFromSidereal(lst,obliquity,CFG.luxor.lat);
  for(const id of CFG.angles){
   const l=local[id]*DEG;
   const eq=A.EquatorFromVector(A.RotateVector(ectToEqd,new A.Vector(Math.cos(l),Math.sin(l),0,time)));
   positions[id]={lon:local[id],lat:0,dec:eq.dec};
  }
  const state={ms,positions,lst,obliquity};cache.set(ms,state);return state;
 }
 return Object.freeze({get,clear:()=>cache.clear(),cacheSize:()=>cache.size});
}
async function scan(engine,iso,startMinute,modelEnabled,onProgress=()=>{},cancelled=()=>false){
 assert(startMinute===0||startMinute===360,'Window scan tidak valid.');
 const start=wibToUTC(iso,startMinute),end=wibToUTC(iso,1440),step=CFG.step*MIN;
 const n=(end-start)/step;engine.clear();
 // One cached ephemeris snapshot per grid point, including phase edge samples.
 for(let i=-1;i<=n;i++){
  assert(!cancelled(),'Perhitungan dibatalkan.'); engine.get(start+i*step);
  if((i+1)%8===0){onProgress(Math.round((i+2)/(n+2)*85));await new Promise(r=>setTimeout(r,0));}
 }
 const result=[]; let priorScore=null;
 for(let i=0;i<n;i++){
  const t=start+i*step,s=analyse(engine.get(t-step),engine.get(t),engine.get(t+step),modelEnabled);
  s.state=classify(s.score,priorScore);priorScore=s.score;result.push(s);
 }
 onProgress(100);return result;
}
const Core=Object.freeze({CFG,Time,norm,signed,anglesFromSidereal,aspectGeometry,phase,legacyImpact,analyse,classify,segments,longestWindow,createEngine,scan,pairs});
if(typeof module!=='undefined'&&module.exports) module.exports=Core;
root.CebonkCore=Core;
})(typeof window!=='undefined'?window:globalThis);

