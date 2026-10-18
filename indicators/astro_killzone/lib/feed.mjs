import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export const Astronomy=require('../vendor/astronomy.cjs');
export const MODEL='CEBONK_ASTRODOX_V1_SESSION_ONLY';
export const IDS=['sydney','tokyo','london','newyork','londonclose'];
export const DAY=86400000;
export const iso=ms=>new Date(ms).toISOString().slice(0,10);
export const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&iso(Date.parse(d+'T00:00:00Z'))===d;
export const addDay=(d,n)=>iso(Date.parse(d+'T00:00:00Z')+n*DAY);
export const weekday=d=>new Date(d+'T00:00:00Z').getUTCDay()%6!==0;
export function engines({core,killzone}={}){
  const context={module:{exports:{}},Date,Math,Intl,console,setTimeout,clearTimeout};
  vm.createContext(context);
  vm.runInContext(core??readFileSync(new URL('../vendor/cebonk-core.js',import.meta.url),'utf8'),context,{timeout:15000});
  const C=context.module.exports;context.module={exports:{}};
  vm.runInContext(killzone??readFileSync(new URL('../vendor/astro-killzone-core.cjs',import.meta.url),'utf8'),context,{timeout:15000});
  const K=context.module.exports;
  if(C.CFG.step!==5||C.CFG.buy!==1.15||C.CFG.sell!==-1.15||K.VERSION!=='1.0.0')throw Error('Unexpected source engine version');
  return {C,K};
}
export function canonical(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  throw Error('Unsupported/nonfinite JSON value');
}
export function encode(data){
  const {payload_sha256:unused,...body}=data;
  const payload=canonical(body),hash=createHash('sha256').update(payload).digest('hex');
  return payload.slice(0,-1)+',"payload_sha256":"'+hash+'"}\n';
}
export function decode(raw){
  if(Buffer.byteLength(raw)>2097152)throw Error('Feed too large');
  const data=JSON.parse(raw);
  if(raw.trimEnd()!==encode(data).trimEnd())throw Error('Checksum/canonical mismatch');
  return data;
}
export function projectSession(s,date){
  return {id:s.id+'-'+date,session_id:s.id,session_name:s.name,date_wib:date,iana_timezone:s.zone,
    session_start_utc:s.start/1000,session_end_utc:s.end/1000,focus:s.trend.focus,
    buy_minutes:s.trend.buyMinutes,sell_minutes:s.trend.sellMinutes,
    best_index:s.trend.best?s.trend.windows.indexOf(s.trend.best):-1,
    windows:s.trend.windows.map(w=>({direction:w.direction,raw_start_utc:w.rawStart/1000,
      start_utc:w.start/1000,core_utc:w.core/1000,end_utc:w.end/1000,score_peak:w.score}))};
}
export async function generate({from=addDay(iso(Date.now()+7*3600000),-7),days=42,
  generatedAt=Date.now(),source=engines(),astronomy=Astronomy,onProgress=()=>{}}={}){
  if(!validDate(from)||!Number.isInteger(days)||days<1||days>42)throw Error('Expected a valid date and 1..42 calendar days');
  const audit=JSON.parse(readFileSync(new URL('../SOURCE_AUDIT.json',import.meta.url),'utf8'));
  const sessions=[];
  for(let n=0;n<days;n++){
    const date=addDay(from,n);if(!weekday(date))continue;
    const report=await source.K.calculate(date,astronomy,source.C);
    sessions.push(...report.sessions.map(s=>projectSession(s,date)));onProgress(date);
  }
  return {schema_version:'1.0.0',model_id:MODEL,source_commit:audit.source_commit,astronomy_engine:'2.1.19',
    generated_at_utc:Math.floor(generatedAt/1000),horizon_start_wib:from,horizon_end_wib:addDay(from,days-1),sessions};
}
function keys(value,expected){
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join(',')!==expected.split(',').sort().join(','))throw Error('Unexpected fields');
}
function timestamp(t){if(!Number.isInteger(t)||t<1577836800||t>4102444800)throw Error('Invalid UTC timestamp');}
export function validate(data,{nowUtc=Math.floor(Date.now()/1000),requireCurrent=true,source=engines()}={}){
  keys(data,'schema_version,model_id,source_commit,astronomy_engine,generated_at_utc,horizon_start_wib,horizon_end_wib,sessions,payload_sha256');
  if(data.schema_version!=='1.0.0'||data.model_id!==MODEL||data.astronomy_engine!=='2.1.19'||!/^[a-f0-9]{40}$/.test(data.source_commit))throw Error('Model/source mismatch');
  timestamp(data.generated_at_utc);
  const from=data.horizon_start_wib,to=data.horizon_end_wib;
  if(!validDate(from)||!validDate(to)||to<from||(Date.parse(to)-Date.parse(from))/DAY>41)throw Error('Invalid horizon');
  if(requireCurrent&&(data.generated_at_utc>nowUtc+600||iso(nowUtc*1000+7*3600000)<from||iso(nowUtc*1000+7*3600000)>to))throw Error('Forecast outside clock/horizon');
  const expected=[];
  for(let d=from;d<=to;d=addDay(d,1))if(weekday(d))expected.push(...source.K.schedule(d,source.C).map(s=>({date:d,s})));
  if(!Array.isArray(data.sessions)||data.sessions.length!==expected.length)throw Error('Missing sessions');
  data.sessions.forEach((s,i)=>{
    keys(s,'id,session_id,session_name,date_wib,iana_timezone,session_start_utc,session_end_utc,focus,buy_minutes,sell_minutes,best_index,windows');
    const {s:original,date}=expected[i];
    if(s.id!==original.id+'-'+date||s.session_id!==original.id||s.session_name!==original.name||s.date_wib!==date||s.iana_timezone!==original.zone||s.session_start_utc!==original.start/1000||s.session_end_utc!==original.end/1000)throw Error('Session schedule/DST mismatch');
    if(!Array.isArray(s.windows)||s.windows.length>36)throw Error('Windows missing/too many');
    let previous=s.session_start_utc,buy=0,sell=0;
    s.windows.forEach(w=>{
      keys(w,'direction,raw_start_utc,start_utc,core_utc,end_utc,score_peak');
      for(const key of ['raw_start_utc','start_utc','core_utc','end_utc']){timestamp(w[key]);if(w[key]%300)throw Error('Window off five-minute grid');}
      if(!['BUY','SELL'].includes(w.direction)||!(previous<=w.raw_start_utc&&w.raw_start_utc+600===w.start_utc&&w.start_utc<=w.core_utc&&w.core_utc<w.end_utc&&w.end_utc<=s.session_end_utc&&w.end_utc-w.start_utc>=900)||!Number.isFinite(w.score_peak)||(w.direction==='BUY'?w.score_peak<1.15:w.score_peak> -1.15))throw Error('Invalid window');
      previous=w.end_utc;if(w.direction==='BUY')buy+=(w.end_utc-w.start_utc)/60;else sell+=(w.end_utc-w.start_utc)/60;
    });
    const total=buy+sell,focus=total&&buy!==sell&&Math.max(buy,sell)/total>=.55?(buy>sell?'BUY':'SELL'):'WAIT';
    const ranked=s.windows.map((w,n)=>({...w,n})).filter(w=>w.direction===focus).sort((a,b)=>(b.end_utc-b.start_utc)-(a.end_utc-a.start_utc)||Math.abs(b.score_peak)-Math.abs(a.score_peak)||a.start_utc-b.start_utc);
    if(s.buy_minutes!==buy||s.sell_minutes!==sell||s.focus!==focus||s.best_index!==(ranked[0]?.n??-1))throw Error('Focus/window ranking mismatch');
  });
  return data;
}
