'use strict';
const assert=require('node:assert/strict');
const C=require('../assets/albiruni-core.js');
async function main(){
 const P=await import('../scripts/generate-albiruni-intraday.mjs');
 const date='2026-10-12',start=C.parseDate(date),h=3600000;
 const old={model:P.MODEL,date_wib:date,signal_id:'AB-20261012-SELL-17800000000',
  direction:'SELL',start_epoch:1791774000,entry_epoch:1791774900,
  core_epoch:1791781200,end_epoch:1791788400,valid_until_epoch:1791788400,
  published_epoch:1791760000,aspect:'Moon/Mars Square 90deg orb 0.4deg',phase:'APPLYING'};
 const favored={eligible:true,status:'MENGUNTUNGKAN',reference:{gateMode:'enforce'}};
 const make=(dir,buy,sell)=>({feed:{...old,direction:dir},election:favored,
  majority:{buyAspects:buy,sellAspects:sell,neutralAspects:0}});
 assert.equal(P.MAJORITY_HEADER.split(',').length,14);
 const sell=P.majorityRow(make('SELL',1,2));
 assert.equal(sell.model,'ALBIRUNI_MAJORITY_V2');
 assert.equal(sell.sell_aspects,2);
 assert.equal(sell.buy_aspects,1);
 const csv=P.encodeMajority(make('SELL',1,2));
 assert.equal(csv.trimEnd().split('\n')[0],P.MAJORITY_HEADER);
 assert.equal(csv.trimEnd().split('\n')[1].split(',').length,14);
 assert.equal(csv.trimEnd().split('\n')[1].split(',')[3],'SELL');
 assert.equal(P.majorityRow(make('BUY',2,1)).direction,'BUY');
 assert.throws(()=>P.majorityRow(make('BUY',1,2)),/contradicts/);
 assert.throws(()=>P.majorityRow(make('SELL',1,1)),/contradicts/);
 assert.throws(()=>P.majorityRow(make('SELL',12,11)),/Invalid/);
 assert.throws(()=>P.majorityRow({...make('SELL',1,2),election:{eligible:false,reference:{gateMode:'enforce'}}}),/gate/);
 assert.throws(()=>P.majorityRow({...make('SELL',1,2),election:{eligible:true,reference:{gateMode:'shadow'}}}),/gate/);
 const wait=P.majorityRow({feed:{...old,direction:'WAIT',signal_id:'NONE',start_epoch:0,entry_epoch:0,
  core_epoch:0,end_epoch:0,valid_until_epoch:0,aspect:'NONE',phase:'NONE'},
  election:{status:'CAMPURAN',eligible:false}});
 assert.equal(wait.buy_aspects,0);assert.equal(wait.sell_aspects,0);
 assert.equal(P.encodeMajority({feed:wait}).trimEnd().split('\n')[1].split(',').length,14);
 const mk=(pair,angle,id)=>({id,pair,name:C.ASPECTS.find(x=>x.angle===angle).name,angle,
  start:start+10*h,end:start+14*h,exactTimes:[start+12*h],closest:start+12*h,
  closestOrb:0,startClipped:false,endClipped:false});
 const result={range:C.period(date,'day'),orb:2,focus:'all',events:[
  mk(['Moon','Venus'],0,'buy'),mk(['Moon','Mars'],90,'sell-one'),
  mk(['Venus','Mars'],90,'sell-two')]};
 const engine={longitude:(body,ms)=>({Moon:(ms-start)/h-12,Venus:0,Mars:90})[body]??0};
 let requestedFocus=null;
 const build=await P.build(date,{engine,publishedMs:Date.parse('2026-10-11T14:00:00Z'),
  scanFunction:async(_engine,_date,opts)=>{requestedFocus=opts.focus;return result;},
  electionEvaluator:()=>favored});
 assert.equal(requestedFocus,'all','EA scanner must include Venus/Mars alongside Moon/Mars');
 assert.equal(build.feed.direction,'SELL','same 2 SELL 1 BUY majority as web');
 assert.equal(build.majority.sellAspects,2);
 assert.equal(build.majority.buyAspects,1);
 assert.equal(P.majorityRow(build).direction,'SELL');
 const blocked=await P.build(date,{engine,publishedMs:Date.parse('2026-10-11T14:00:00Z'),
  scanFunction:async()=>result,electionEvaluator:()=>({eligible:false,status:'CAMPURAN'})});
 assert.equal(blocked.feed.direction,'WAIT','classic veto remains active');
 assert.equal(P.majorityRow(blocked).sell_aspects,0);
 console.log('PASS: MT5 V2 feed, 2 SELL + 1 BUY, majority enforcement, all 21 pairs, classic WAIT gate.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
