#!/usr/bin/env node
/* AL-BIRUNI intraday feed publisher v1.00.
 * Same ephemeris and direction engine as assets/albiruni-core.js.
 * Hypothetical XAUUSD direction only; never a validated price forecast.
 */
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const C=require('../assets/albiruni-core.js');
const A=require('astronomy-engine');
const MODEL='ALBIRUNI_INTRADAY_V1';
const HEADER='model,date_wib,signal_id,direction,start_epoch,entry_epoch,core_epoch,end_epoch,valid_until_epoch,published_epoch,aspect,phase';
const MIN=60000,DAY=86400000,WIB=7*3600000;
const PATH='ea/albiruni_intraday/data/intraday.csv';
const MANIFEST='ea/albiruni_intraday/data/intraday.json';
function assert(ok,msg){if(!ok)throw Error(msg);}
const wibDate=ms=>new Date(ms+WIB).toISOString().slice(0,10);
function targetDate(now=Date.now()){
 assert(Number.isFinite(now),'Invalid timestamp');
 let t=Date.parse(wibDate(now)+'T00:00:00Z'),dow=new Date(t).getUTCDay();
 if(dow===0)t+=DAY;
 if(dow===6)t+=2*DAY;
 return new Date(t).toISOString().slice(0,10);
}
const isBusinessDay=date=>{const d=new Date(date+'T00:00:00Z').getUTCDay();return d>=1&&d<=5;};
function encode(result){
 const q=v=>String(v??'');
 const cols=[result.model,result.date_wib,result.signal_id,result.direction,
  result.start_epoch,result.entry_epoch,result.core_epoch,result.end_epoch,
  result.valid_until_epoch,result.published_epoch,result.aspect,result.phase];
 assert(cols.length===12&&cols.every(x=>!/[\r\n,]/.test(q(x))),'Bad CSV field');
 return HEADER+'\n'+cols.join(',')+'\n';
}
// The day-wide direction is fixed first. Only a supporting APPLYING aspect
// with an actual upcoming EXACT contact can create a candidate, never a
// neutral, weekend, retrograde-only near-miss, or post-exact slot.
function chooseCandidate(engine,scan,date,{fromHour=7,toHour=23}={}){
 const report=C.autoPeriodSummary(engine,scan,{stepMinutes:15});
 const day=report.days[0];
 if(!day||day.marketClosed||!['BUY','SELL'].includes(report.direction))
  return {direction:'WAIT',reason:'NO_DOMINANT_OPEN_MARKET_DAY',report};
 const sign=report.direction==='BUY'?1:-1;
 const windows=day.focusWindows.slice().sort((a,b)=>
  (b.end-b.start)-(a.end-a.start)||b.peakNet-a.peakNet||a.start-b.start);
 const valid=[];
 for(const w of windows){
  // 15 min confirmation after first sampled aligned signal; no hindsight
  // candle data, no forced entry at the model's later highest score.
  let entry=w.start+15*MIN;
  if(entry+15*MIN>=w.end)continue;
  const minDate=C.iso(entry),time=(entry-C.parseDate(minDate))/MIN;
  if(minDate!==date||time<fromHour*60||time>=toHour*60-15)continue;
  const state=C.autoSignal(engine,scan,entry);
  if(state.direction!==report.direction)continue;
  const aspects=state.active.filter(x=>
   Math.sign(x.contribution)===sign&&
   x.phase==='APPLYING'&&Number.isFinite(x.exact)&&
   x.exact>entry+5*MIN&&x.exact<w.end&&
   C.iso(x.exact)===date&&
   (x.exact-C.parseDate(date))/MIN<=toHour*60
  ).sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)||a.exact-b.exact);
  if(!aspects.length)continue;
  const a=aspects[0],end=Math.min(w.end,a.end);
  if(entry>=a.exact||a.exact>=end)continue;
  const aspect=a.pair.join('/')+' '+a.name+' '+a.angle+'deg orb '+a.orb.toFixed(3)+'deg';
  assert(!/[,;\r\n]/.test(aspect),'Invalid descriptive field');
  const id='AB-'+date.replaceAll('-','')+'-'+report.direction+'-'+a.exact.toFixed(0).slice(0,11);
  valid.push({date,direction:report.direction,start:w.start,entry,
   core:a.exact,end,aspect,phase:'APPLYING',signalId:id,
   dominantAspect:a,modelScore:Math.abs(a.contribution)});
 }
 return valid.length?{direction:report.direction,reason:'READY',
  candidate:valid[0],report}:{direction:'WAIT',reason:'NO_APPLYING_EXACT_BEFORE_CORE',report};
}
async function build(date,{publishedMs=Date.now(),engine,scanFunction,fromHour=7,toHour=23}={}){
 C.period(date,'day');
 const published=Math.floor(publishedMs/1000);
 assert(published>1600000000,'Bad published timestamp');
 const noop={model:MODEL,date_wib:date,signal_id:'NONE',direction:'WAIT',
  start_epoch:0,entry_epoch:0,core_epoch:0,end_epoch:0,valid_until_epoch:0,
  published_epoch:published,aspect:'NONE',phase:'NONE'};
 if(!isBusinessDay(date))return {feed:noop,reason:'MARKET_CLOSED',summary:null};
 const ephemeris=engine||C.createEngine(A);
 const scan=await (scanFunction||C.scan)(ephemeris,date,{
  mode:'day',focus:'moon',orb:2,stepMinutes:15});
 const chosen=chooseCandidate(ephemeris,scan,date,{fromHour,toHour});
 const c=chosen.candidate;
 if(!c)return {feed:noop,reason:chosen.reason,summary:{
  buyMinutes:chosen.report.buyMinutes,sellMinutes:chosen.report.sellMinutes,
  dominant:chosen.report.direction}};
 const seconds=x=>Math.floor(x/1000);
 const row={model:MODEL,date_wib:date,signal_id:c.signalId,direction:c.direction,
  start_epoch:seconds(c.start),entry_epoch:seconds(c.entry),
  core_epoch:seconds(c.core),end_epoch:seconds(c.end),
  valid_until_epoch:seconds(c.end),published_epoch:published,
  aspect:c.aspect,phase:c.phase};
 const midnight=seconds(C.parseDate(date)+DAY);
 assert(row.start_epoch<row.entry_epoch&&row.entry_epoch<row.core_epoch&&
  row.core_epoch<row.end_epoch&&row.end_epoch<=midnight,
  'Invalid phase order: refuse feed');
 assert(C.iso(c.entry)===date&&isBusinessDay(date),'Entry day mismatch');
 return {feed:row,reason:'READY',summary:{
  buyMinutes:chosen.report.buyMinutes,sellMinutes:chosen.report.sellMinutes,
  dominant:chosen.report.direction}};
}
function parseArgs(args){
 const opts={};
 for(const a of args){
  const m=/^--([a-z-]+)=(.+)$/.exec(a);
  assert(m,'Use --date=YYYY-MM-DD or --out=path');
  assert(['date','out','json'].includes(m[1]),'Unsupported argument '+m[1]);
  opts[m[1]]=m[2];
 }
 return opts;
}
async function main(){
 const opts=parseArgs(process.argv.slice(2)),date=opts.date||targetDate();
 const data=await build(date),csv=encode(data.feed);
 const manifest={...data.feed,reason:data.reason,experimental:true,
  source:'assets/albiruni-core.js v1.5; moon focus orb 2; forward exact',
  summary:data.summary,generated_at_utc:new Date(data.feed.published_epoch*1000).toISOString(),
  candidate_entry_wib:data.feed.entry_epoch?C.stamp(data.feed.entry_epoch*1000):null,
  start_wib:data.feed.start_epoch?C.stamp(data.feed.start_epoch*1000):null,
  core_wib:data.feed.core_epoch?C.stamp(data.feed.core_epoch*1000):null,
  end_wib:data.feed.end_epoch?C.stamp(data.feed.end_epoch*1000):null};
 const dest=resolve(opts.out||PATH),json=resolve(opts.json||MANIFEST);
 mkdirSync(dirname(dest),{recursive:true});mkdirSync(dirname(json),{recursive:true});
 writeFileSync(dest,csv,'utf8');
 writeFileSync(json,JSON.stringify(manifest,null,2)+'\n','utf8');
 console.log('AL-BIRUNI '+date+' '+data.feed.direction+
  ' entryWIB='+(manifest.candidate_entry_wib||'WAIT')+' published='+
  manifest.generated_at_utc+' EXPERIMENTAL');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 await main();
export {MODEL,HEADER,targetDate,isBusinessDay,chooseCandidate,build,encode,parseArgs};
