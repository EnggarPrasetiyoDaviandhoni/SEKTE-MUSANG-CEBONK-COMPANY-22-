import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,Astronomy,sourceEngines,requireEA} from './source.mjs';
export const DAY=86400000;
export const MODEL='CEBONK_SWING_ASTRO_WEEKLY_DAILY_5KZ_V1';
export const M5_MODEL='MUSANG_BERJANGGUT_CBR';
export const SESSION_IDS=['sydney','tokyo','london','newyork','londonclose'];
export const PHASES=['NEW_MOON','WAXING_CRESCENT','FIRST_QUARTER','WAXING_GIBBOUS','FULL_MOON','WANING_GIBBOUS','LAST_QUARTER','WANING_CRESCENT'];
export const iso=ms=>new Date(ms).toISOString().slice(0,10);
export const addDay=(d,n)=>iso(Date.parse(d+'T00:00:00Z')+n*DAY);
export const weekday=d=>{const x=Date.parse(d+'T00:00:00Z');return Number.isFinite(x)&&iso(x)===d&&new Date(x).getUTCDay()%6!==0;};
export function canonical(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Nonfinite JSON');return JSON.stringify(value);}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&Object.getPrototypeOf(value)===Object.prototype)
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 throw Error('Unsupported canonical value');
}
export function encodeFeed(payload){
 const {payload_sha256:ignored,...body}=payload;
 const raw=canonical(body),hash=createHash('sha256').update(raw).digest('hex');
 // Hash is the final member. MT5 verifies exact canonical payload bytes without
 // reformatting floating point numbers in a different language.
 return raw.slice(0,-1)+',"payload_sha256":"'+hash+'"}\n';
}
export function decodeFeed(raw){
 if(Buffer.byteLength(raw)>2*1024*1024)throw Error('Feed exceeds 2 MiB');
 const text=raw.trimEnd();
 if(!/,"payload_sha256":"[a-f0-9]{64}"}$/.test(text))throw Error('Missing hash suffix');
 const data=JSON.parse(text),{payload_sha256,...body}=data;
 const expected=encodeFeed(body).trimEnd();
 if(text!==expected)throw Error('Checksum/canonical encoding mismatch');
 return data;
}
export function moonAt(ms){
 const when=new Date(ms),angle=Astronomy.MoonPhase(when);
 return {observed_at_utc:Math.floor(ms/1000),phase:PHASES[Math.floor((angle+22.5)%360/45)],
  phase_angle:angle,illumination_pct:Astronomy.Illumination(Astronomy.Body.Moon,when).phase_fraction*100};
}
export async function generateFeed({from,days=8,generatedAt=Date.now(),sourceCommit,engines=sourceEngines(),weekCache=new Map(),sessionCache=new Map()}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||iso(Date.parse(from+'T00:00:00Z'))!==from||!Number.isInteger(days)||days<8||days>32)
  throw Error('Valid --from date and 8..32 days required');
 const {C,W,K,D,B}=engines,to=addDay(from,days-1),dates=[];
 for(let d=from;d<=to;d=addDay(d,1))if(weekday(d))dates.push(d);
 const mondays=[...new Set(dates.map(W.monday))],weeks=[];
 for(const monday of mondays){
  if(weekCache.has(monday)){weeks.push(weekCache.get(monday));continue;}
  const engine=C.createEngine(Astronomy);
  let weekly;
  try{weekly=await W.scanWeek(monday,(date,p,c)=>C.scan(engine,date,360,true,p,c,'WIB'));}
  finally{engine.clear();}
  const daily=D.make(weekly,Astronomy,B,0);
  const week={week_monday_wib:monday,weekly_direction:weekly.direction,daily:weekly.days.map(d=>{
   const s=daily.days.find(x=>x.date===d.date);
   return {date_wib:d.date,daily_direction:d.dominant,swing_daily_direction_inherited:s.direction,
    moon_rank:s.rank,illumination_pct:s.illumination,moon_observed_at_utc:s.observationMs/1000};
  })};weeks.push(week);weekCache.set(monday,week);
 }
 const sessions=[];
 for(const date of dates){
  if(sessionCache.has(date)){sessions.push(...sessionCache.get(date));continue;}
  const daySessions=[];
  const report=await K.calculate(date,Astronomy,C);
  for(const s of report.sessions){
   const best=s.trend.best;
   daySessions.push({id:`${s.id}-${date}`,session_id:s.id,date_wib:date,iana_timezone:s.zone,
    session_start_utc:s.start/1000,session_end_utc:s.end/1000,astro_direction:s.trend.focus,
    window:best?{id:`${s.id}-${date}-best-v2`,start_utc:best.start/1000,core_utc:best.core/1000,
     end_utc:best.end/1000,direction:best.direction,score_peak:best.score}:null,
    moon_at_core:moonAt(best?best.core:s.start)});
  }
  sessions.push(...daySessions);sessionCache.set(date,daySessions);
 }
 sessions.sort((a,b)=>a.session_start_utc-b.session_start_utc||a.session_id.localeCompare(b.session_id));
 const start=Date.parse(from+'T00:00:00Z')-7*3600000,end=start+days*DAY;
 const major_events=[];let q=Astronomy.SearchMoonQuarter(new Date(start-32*DAY));
 for(let n=0;n<30&&q.time.date.getTime()<end+62*DAY;n++,q=Astronomy.NextMoonQuarter(q))
  major_events.push({phase:PHASES[q.quarter*2],event_at_utc:Math.floor(q.time.date.getTime()/1000)});
 const samples=[];for(let ms=start;ms<=end;ms+=3600000)samples.push(moonAt(ms));
 // Completed session ranges are measured from MT5 candles, not JSON prices.
 const liquidity_sessions=[];
 for(let d=addDay(from,-4);d<=to;d=addDay(d,1))if(weekday(d))
  for(const s of K.schedule(d,C))liquidity_sessions.push({session_id:s.id,start_utc:s.start/1000,end_utc:s.end/1000});
 const generated=Math.floor(generatedAt/1000);
 return {schema_version:'2.0.0',model_id:MODEL,m5_model:M5_MODEL,source_commit:sourceCommit,
  generated_at_utc:generated,expires_at_utc:generated+30*3600,horizon_start_wib:from,horizon_end_wib:to,
  validated_predictive_model:false,weekly_source_method:'CebonkAstroWeekly.scanWeek/CebonkCore.scan(WIB,360)',
  daily_source_method:'CebonkAstroWeekly.days[].dominant',swing_daily_inherited_weekly:true,
  lunar_rank_broker_mode:'AUTO_NY_CLOSE_ESTIMATE_00:00_ANNOTATION_ONLY',weeks,sessions,
  moon:{algorithm:'astronomy-engine@2.1.19',major_events,samples},liquidity_sessions};
}
let validator;
export function validateFeed(data,{nowUtc=Math.floor(Date.now()/1000),requireCurrent=true}={}){
 if(!validator){const Ajv=requireEA('ajv');const ajv=new Ajv({allErrors:true,strict:true});
  validator=ajv.compile(JSON.parse(readFileSync(resolve(ROOT,'data/ea/swing-forecast-v2.schema.json'),'utf8')));}
 if(!validator(data))throw Error('Schema: '+JSON.stringify(validator.errors));
 const fail=message=>{throw Error(message);},expect=new Set(),dates=[];
 for(let d=data.horizon_start_wib;d<=data.horizon_end_wib;d=addDay(d,1)){
  if(dates.length>32)fail('Horizon too long');
  if(weekday(d)){dates.push(d);for(const id of SESSION_IDS)expect.add(id+'-'+d);}
 }
 const span=Date.parse(data.horizon_end_wib+'T00:00:00Z')-Date.parse(data.horizon_start_wib+'T00:00:00Z');
 if(span<7*DAY||span>31*DAY)fail('Invalid horizon length');
 const {W,K}=sourceEngines();
 const expectedWeeks=[...new Set(dates.map(W.monday))];
 if(data.weeks.length!==expectedWeeks.length)fail('Wrong number of weeks');
 data.weeks.forEach((week,i)=>{
  if(week.week_monday_wib!==expectedWeeks[i])fail('Week ordering');
  const days=W.weekDates(week.week_monday_wib);
  const ranks=new Set();week.daily.forEach((d,j)=>{
   if(d.date_wib!==days[j].date)fail('Missing/duplicate weekday');
   const inherited=['BUY','SELL'].includes(week.weekly_direction)?week.weekly_direction:'WAIT';
   if(d.swing_daily_direction_inherited!==inherited)fail('Inherited swing bias mismatch');
   ranks.add(d.moon_rank);
  });if(ranks.size!==5)fail('Duplicate lunar rank');
 });
 for(const s of data.sessions){
  if(!expect.delete(s.id)||s.id!==s.session_id+'-'+s.date_wib)fail('Missing/duplicate session');
  const authoritative=K.schedule(s.date_wib,sourceEngines().C).find(x=>x.id===s.session_id);
  if(s.session_start_utc!==authoritative.start/1000||s.session_end_utc!==authoritative.end/1000||s.iana_timezone!==authoritative.zone)fail('Session timezone/DST drift');
  const w=s.window;
  if(s.astro_direction==='WAIT'){if(w!==null)fail('WAIT with window');}
  else if(!w||w.direction!==s.astro_direction||!(s.session_start_utc<=w.start_utc&&w.start_utc<=w.core_utc&&w.core_utc<w.end_utc&&w.end_utc<=s.session_end_utc))fail('Window ordering/alignment');
  if(s.moon_at_core.observed_at_utc!==(w?w.core_utc:s.session_start_utc))fail('Moon core observation time');
 }
 if(expect.size)fail('Missing sessions');
 if(data.expires_at_utc<=data.generated_at_utc||data.expires_at_utc-data.generated_at_utc>30*3600)fail('Expiry interval');
 if(requireCurrent&&(data.generated_at_utc>nowUtc+600||nowUtc-data.generated_at_utc>30*3600||nowUtc>=data.expires_at_utc))fail('Stale/future feed');
 const nowDate=iso(nowUtc*1000+7*3600000);
 if(requireCurrent&&(nowDate<data.horizon_start_wib||nowDate>data.horizon_end_wib))fail('Horizon does not contain clock');
 for(const key of ['major_events','samples']){
  const field=key==='samples'?'observed_at_utc':'event_at_utc';
  if(data.moon[key].some((v,i,a)=>i&&v[field]<=a[i-1][field]))fail('Unordered lunar records');
 }
 const moonStart=Date.parse(data.horizon_start_wib+'T00:00:00Z')/1000-7*3600;
 if(data.moon.samples.length!==span/3600000+25||data.moon.samples.some((v,i)=>v.observed_at_utc!==moonStart+i*3600))fail('Moon sample grid/coverage');
 return data;
}
