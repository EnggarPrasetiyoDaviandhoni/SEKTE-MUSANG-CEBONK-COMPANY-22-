#!/usr/bin/env node
/* CEBONK XAGUSD First Quarter publisher v1.0.
 * Same Astronomy Engine 2.1.19 as browser moon-phase-calendar.js.
 * Time values are UTC Unix seconds, never WIB/broker clocks.
 * The EA uses actual symbol sessions; the website cannot know NOZAX hours.
 */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Astronomy=require('astronomy-engine');
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';

const HOUR=3600000,DAY=24*HOUR;
const OUT=resolve('ea/xagusd_first_quarter/data/first_quarters.json');
const MODEL='CEBONK_XAG_FIRST_QUARTER_V1';
const engine='astronomy-engine@2.1.19';

export function buildFeed(now=new Date()){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Invalid UTC timestamp.');
 const utcMs=now.getTime();
 const from=new Date(utcMs-8*DAY);
 const horizon=utcMs+400*DAY;
 let q=Astronomy.SearchMoonQuarter(from);
 const events=[];
 for(let i=0;i<90;i++){
  if(!q||!q.time||!(q.time.date instanceof Date))throw Error('Lunar quarter calculation unavailable.');
  const ms=q.time.date.getTime();
  if(ms>horizon)break;
  if(q.quarter===1 && ms>=utcMs-8*DAY){
   const phase_epoch=Math.round(ms/1000);
   events.push({phase_epoch,utc_date:new Date(phase_epoch*1000).toISOString().slice(0,10),moon_phase:'FIRST_QUARTER'});
  }
  q=Astronomy.NextMoonQuarter(q);
 }
 if(events.length<10||events.length>20)throw Error('Unexpected number of First Quarter events: '+events.length);
 for(let i=1;i<events.length;i++){
  const span=events[i].phase_epoch-events[i-1].phase_epoch;
  if(span<20*86400||span>35*86400)throw Error('Invalid First Quarter spacing.');
 }
 return {
  model:MODEL, status:'READY',source_engine:engine,
  generated_epoch:Math.floor(utcMs/1000),
  expires_epoch:Math.floor((utcMs+4*DAY)/1000),
  first_quarters:events
 };
}
export function validateFeed(feed,now=new Date()){
 if(feed.model!==MODEL||feed.status!=='READY'||feed.source_engine!==engine||
    !Number.isInteger(feed.generated_epoch)||!Number.isInteger(feed.expires_epoch)||
    feed.expires_epoch-feed.generated_epoch!==4*86400||
    !Array.isArray(feed.first_quarters)||feed.first_quarters.length<10)throw Error('Invalid feed metadata.');
 if(feed.generated_epoch>Math.floor(now.getTime()/1000)+600)throw Error('Feed generation in future.');
 if(feed.expires_epoch<Math.floor(now.getTime()/1000))throw Error('Expired moon feed.');
 for(const [i,event] of feed.first_quarters.entries()){
  const t=event.phase_epoch;
  if(event.moon_phase!=='FIRST_QUARTER'||!Number.isSafeInteger(t)||t<1577836800||t>2240611200||
     event.utc_date!==new Date(t*1000).toISOString().slice(0,10))throw Error('Invalid event '+i);
  if(i && (t-feed.first_quarters[i-1].phase_epoch<20*86400 ||
           t-feed.first_quarters[i-1].phase_epoch>35*86400))throw Error('Unsorted event list.');
 }
 return true;
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 const payload=buildFeed();
 validateFeed(payload);
 mkdirSync(dirname(OUT),{recursive:true});
 writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');
 console.log('Saved '+OUT+' with '+payload.first_quarters.length+' validated phases.');
}
