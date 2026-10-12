'use strict';
// No historical gold candles or invented win rate. Tests of astronomical
// feed format and explicit fail-closed state only.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('../assets/albiruni-core.js');
const Gate=require('../assets/albiruni-election-gate.js');
async function main(){
 const {MODEL,HEADER,targetDate,isBusinessDay,chooseCandidate,build,encode,qualify}=
  await import('../scripts/generate-albiruni-intraday.mjs');
 assert.equal(MODEL,'ALBIRUNI_INTRADAY_V1');
 assert.equal(HEADER.split(',').length,12);
 const millis=Date.parse;
 assert.equal(targetDate(millis('2026-10-11T12:00:00Z')),'2026-10-12');
 assert.equal(targetDate(millis('2026-10-10T12:00:00Z')),'2026-10-12');
 assert.equal(targetDate(millis('2026-10-12T01:00:00Z')),'2026-10-12');
 assert.equal(isBusinessDay('2026-10-11'),false);
 assert.equal(isBusinessDay('2026-10-12'),true);
 const date='2026-10-12',start=C.parseDate(date),hour=3600000,exact=start+12*hour;
 const result={range:C.period(date,'day'),orb:2,focus:'moon',events:[{
  id:'moon-jupiter-exact-12',pair:['Moon','Jupiter'],angle:60,name:'Sextile',
  start:start+10*hour,end:start+14*hour,
  exactTimes:[exact],closest:exact,closestOrb:0,
  startClipped:false,endClipped:false
 }]};
 const engine={longitude:(body,ms)=>body==='Moon'?
  C.norm(2*((ms-start)/hour-12)):body==='Jupiter'?60:0};
 const publishedMs=millis('2026-10-11T15:00:00Z');
 const scanFunction=async()=>result;
 const favorable=()=>({eligible:true,status:'MENGUNTUNGKAN',reason:'TEST'});
 const harmful=()=>({eligible:false,status:'MERUGIKAN',reason:'TEST'});
 const mixed=()=>({eligible:false,status:'CAMPURAN',reason:'TEST'});
 const good=await build(date,{engine,scanFunction,publishedMs,electionEvaluator:favorable});
 assert.equal(good.reason,'READY');
 assert.equal(good.election.status,'MENGUNTUNGKAN');
 assert.ok(good.election.entry.eligible);
 assert.match(good.election.check_wib,/2026-10-12/);
 assert.equal(good.feed.direction,'BUY');
 assert.equal(good.feed.phase,'APPLYING');
 assert.equal(good.feed.date_wib,date);
 assert.ok(good.feed.signal_id.startsWith('AB-20261012-BUY-'));
 assert.ok(good.feed.start_epoch<good.feed.entry_epoch);
 assert.ok(good.feed.entry_epoch<good.feed.core_epoch);
 assert.ok(good.feed.core_epoch<good.feed.end_epoch);
 assert.equal(good.feed.core_epoch,Math.floor(exact/1000));
 assert.equal(C.iso(good.feed.entry_epoch*1000),date);
 assert.match(good.feed.aspect,/Moon\/Jupiter Sextile/);
 const csv=encode(good.feed);
 assert.equal(csv.split('\n').filter(Boolean).length,2);
 assert.equal(csv.trim().split('\n')[1].split(',').length,12);
 const other=chooseCandidate(engine,result,date,{fromHour:13,toHour:23});
 assert.equal(other.direction,'WAIT','missed exact or entry window => WAIT');
 const weekend=await build('2026-10-11',{publishedMs,engine,
  scanFunction:async()=>{throw Error('Weekend scan must be skipped');}});
 assert.equal(weekend.feed.direction,'WAIT');
 assert.equal(weekend.feed.entry_epoch,0);
 assert.equal(weekend.feed.signal_id,'NONE');
 assert.equal(encode(weekend.feed).split('\n')[1].split(',').length,12);
 const empty=await build(date,{publishedMs,engine,scanFunction:async()=>({
  ...result,events:[]})});
 assert.equal(empty.feed.direction,'WAIT','No aspect must NOT invent entry');
 const sellResult={...result,events:[{...result.events[0],
  id:'mars-saturn',pair:['Mars','Saturn']}]};
 const sellEngine={longitude:(body,ms)=>body==='Mars'?
  C.norm(2*((ms-start)/hour-12)):body==='Saturn'?60:0};
 const down=await build(date,{engine:sellEngine,scanFunction:async()=>sellResult,publishedMs,
  electionEvaluator:favorable});
 assert.equal(down.feed.direction,'SELL','negative malefic aspect retained');
 const blocked=await build(date,{engine,scanFunction,publishedMs,electionEvaluator:harmful});
 assert.equal(blocked.feed.direction,'WAIT','Harmful must block BUY');
 assert.equal(blocked.feed.entry_epoch,0);
 assert.equal(blocked.reason,'WAIT_ELECTION_TIME_NOT_FAVORABLE');
 assert.equal(blocked.election.status,'MERUGIKAN');
 const ambig=await build(date,{engine,scanFunction,publishedMs,electionEvaluator:mixed});
 assert.equal(ambig.feed.direction,'WAIT','Mixed timing must block BUY');
 const failure=await build(date,{engine,scanFunction,publishedMs,
  electionEvaluator:()=>{throw Error('ephemeris');}});
 assert.equal(failure.feed.direction,'WAIT','Error must block entry');
 assert.equal(failure.election.reason,'ELECTION_CALCULATION_FAILED');
 const shadow=await build(date,{engine,scanFunction,publishedMs,electionEvaluator:harmful,gateMode:'shadow'});
 assert.equal(shadow.feed.direction,'BUY','Shadow mode is only explicitly selected');
 assert.equal(shadow.election.eligible,false);
 const two=qualify({entry:start+11*hour,core:start+12*hour},
  ms=>ms===start+11*hour?favorable():harmful());
 assert.equal(two.eligible,false,'Time turning harmful before exact must block entry');
 assert.equal(two.status,'MERUGIKAN');
 assert.equal(Gate.judge(null).eligible,false);
 const blockedSell=await build(date,{engine:sellEngine,scanFunction:async()=>sellResult,
  publishedMs,electionEvaluator:harmful});
 assert.equal(blockedSell.feed.direction,'WAIT','Harmful must block SELL too');
 const saved=fs.readFileSync('assets/albiruni-core.js','utf8');
 assert.match(saved,/periodEntryReport/,'reuse same astronomy core as website');
 console.log('PASS: Al-Biruni feed two classical time checks, BUY/SELL screening, WAIT on harmful/mixed/error, backward-compatible CSV.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
