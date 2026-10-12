'use strict';
const assert=require('node:assert/strict');
const C=require('../assets/albiruni-core.js');
async function run(){
 const P=await import('../scripts/generate-albiruni-intraday.mjs');
 assert.equal(P.DIRECT_MODEL,'ALBIRUNI_MAJORITY_DIRECT_V3');
 assert.equal(P.DIRECT_HEADER.split(',').length,14);
 const date='2026-10-12',start=C.parseDate(date),h=3600000;
 const mk=(pair,angle,id)=>({id,pair,name:C.ASPECTS.find(x=>x.angle===angle).name,angle,
  start:start+10*h,end:start+14*h,exactTimes:[start+12*h],closest:start+12*h,
  closestOrb:0,startClipped:false,endClipped:false});
 const scan={range:C.period(date,'day'),orb:2,focus:'all',events:[
  mk(['Moon','Venus'],0,'buy'),mk(['Moon','Mars'],90,'sell-one'),
  mk(['Venus','Mars'],90,'sell-two')]};
 const engine={longitude:(body,ms)=>({Moon:(ms-start)/h-12,Venus:0,Mars:90})[body]??0};
 const common={engine,scanFunction:async()=>scan,publishedMs:Date.parse('2026-10-11T14:00:00Z')};
 const unkind=()=>({eligible:false,status:'CAMPURAN'});
 const strict=await P.build(date,{...common,gateMode:'enforce',electionEvaluator:unkind});
 const direct=await P.build(date,{...common,gateMode:'majority',
  electionEvaluator:()=>{throw Error('Classical evaluator must never veto DIRECT');}});
 assert.equal(strict.feed.direction,'WAIT','old strict feed must remain WAIT');
 assert.equal(direct.feed.direction,'SELL','direct majority should be SELL');
 assert.equal(direct.election.status,'NOT_APPLIED');
 assert.equal(direct.election.reference.gateMode,'majority');
 assert.equal(direct.reason,'READY_MAJORITY_ONLY');
 assert.equal(direct.majority.buyAspects,1);
 assert.equal(direct.majority.sellAspects,2);
 assert.equal(direct.feed.phase,'APPLYING');
 assert.ok(direct.feed.start_epoch<direct.feed.entry_epoch&&
  direct.feed.entry_epoch<direct.feed.core_epoch&&direct.feed.core_epoch<direct.feed.end_epoch);
 const row=P.directRow(direct);
 assert.equal(row.buy_aspects,1);
 assert.equal(row.sell_aspects,2);
 assert.equal(row.model,P.DIRECT_MODEL);
 assert.equal(P.encodeDirect(direct).trimEnd().split('\n')[1].split(',').length,14);
 assert.equal(P.encodeDirect(direct).trimEnd().split('\n')[1].split(',')[3],'SELL');
 assert.throws(()=>P.directRow({...direct,majority:{buyAspects:2,sellAspects:1}}),/contradicts/);
 assert.throws(()=>P.directRow({...direct,election:{reference:{gateMode:'enforce'}}}),/majority-only/);
 assert.throws(()=>P.directRow({...direct,feed:{...direct.feed,direction:'BUY'}}),/contradicts/);
 const empty={...direct,feed:{...direct.feed,signal_id:'NONE',direction:'WAIT',start_epoch:0,entry_epoch:0,core_epoch:0,end_epoch:0,valid_until_epoch:0,aspect:'NONE',phase:'NONE'},majority:null};
 assert.equal(P.directRow(empty).buy_aspects,0);
 assert.equal(P.directRow(empty).sell_aspects,0);
 const legacy=P.majorityRow(strict);
 assert.equal(legacy.direction,'WAIT','V2 remains strict independently of V3');
 console.log('PASS: V3 follows 2 SELL + 1 BUY without §527 veto; v2 stays WAIT; 14-column counts and APPLYING order valid.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
