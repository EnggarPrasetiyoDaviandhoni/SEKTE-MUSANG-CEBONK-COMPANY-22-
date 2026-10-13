'use strict';
const assert=require('node:assert/strict');
const P=require('../assets/astrodox-planet-strength.js');
const ms=Date.UTC(2026,9,13,23,0,0);
const pos={Venus:{lon:45},Jupiter:{lon:165},Mars:{lon:350},Saturn:{lon:20},ASC:{lon:120}};
const pair=(id1,id2,name,angle,orb,impact,local=false)=>({id1,id2,name,angle,orb,impact,phase:'EXACT',local});
const samples=[
 {ms,positions:pos,active:[
  pair('Venus','Jupiter','Trine',120,0.7,2),
  pair('Mars','Saturn','Square',90,1.2,-1),
  pair('Mars','ASC','Trine',120,0.2,999,true)]},
 {ms:ms+300000,positions:{...pos,Venus:{lon:46}},active:[
  pair('Venus','Jupiter','Trine',120,0.6,1),
  pair('Mars','Saturn','Square',90,1.3,-3)]},
 {ms:ms+600000,positions:pos,active:[]}
];
const v=P.evaluate(samples);
assert.equal(v.available,true);
assert.equal(v.model,'RELATIVE_SIGNED_ASPECT_WEIGHT_COMPOSITION_V1');
assert.equal(v.positiveWeight,3);
assert.equal(v.negativeWeight,4);
assert.equal(v.totalWeight,7);
assert.equal(v.buyPct,3/7*100);
assert.equal(v.sellPct,4/7*100);
assert.equal(v.netPct,-1/7*100);
assert.equal(v.direction,'SELL','direction derives from strength composition, NOT duration');
assert.equal(v.coveredSlots,2);
assert.equal(v.coveragePct,2/3*100);
assert.equal(v.aspects,4,'ASC timing-only must be excluded despite enormous impact');
assert.equal(v.slots,3);
assert.equal(v.leadingAspects.length,2);
assert.equal(v.leadingAspects[0].id1,'Mars');
assert.equal(v.leadingAspects[0].negativeWeight,4);
assert.equal(v.leadingAspects[1].id1,'Venus');
assert.equal(v.leadingAspects[1].positiveWeight,3);
assert.equal(v.leadingAspects[1].angle,120);
assert.equal(v.leadingAspects[1].peak.planet1.sign,'Taurus');
assert.equal(v.leadingAspects[1].peak.planet1.degreeInSign,15);
assert.equal(v.leadingAspects[1].peak.planet1.longitude,45);
assert.equal(v.leadingAspects[1].peak.planet2.sign,'Virgo');
assert.equal(v.leadingAspects[1].peak.orb,0.7);
assert.equal(v.perSlot[0].buyPct,2/3*100);
assert.equal(v.perSlot[1].sellPct,3/4*100);
assert.equal(v.perSlot[2].buyPct,null,'0/0 must never become 50 or 100 percent');
assert.equal(v.tradingDecision,'WAIT');
assert.equal(v.validatedForXAUUSD,false);
const single=P.evaluate([{ms,active:[pair('Venus','Jupiter','Trine',120,1.7,0.001)]}]);
assert.equal(single.buyPct,100);
assert.equal(single.totalWeight,0.001,'100% is RELATIVE composition, not large absolute strength');
assert.equal(single.coveragePct,100);
const none=P.evaluate([{ms,active:[]},{ms:ms+300000,active:[]}]);
assert.equal(none.available,false);
assert.equal(none.buyPct,null);
assert.equal(none.direction,'TIDAK_TERSEDIA');
const missing=P.evaluate([{ms,active:[pair('Venus','Jupiter','Trine',120,1,2)]},{ms:ms+300000,score:2}]);
assert.equal(missing.available,false,'partial source data must not fabricate strength');
assert.equal(missing.reason,'DATA_ASPEK_V1_TIDAK_TERSEDIA');
assert.throws(()=>P.evaluate([{ms,active:[pair('Venus','Jupiter','Trine',120,1,NaN)]}]),/Bobot/);
assert.throws(()=>P.evaluate([{ms,active:[{id1:'Venus',id2:'Mars',impact:1}]}]),/Metadata/);
assert.throws(()=>P.evaluate([]),/sampel/i);
assert.equal(P.locate(pos,'Mars').sign,'Pisces');
assert.equal(P.locate(pos,'Venus').longitude,45);
assert.equal(P.locate(pos,'Uranus'),null);
assert.equal(P.VERSION,'1.0.0');
console.log('PASS: ASTRODOX planetary configuration strength, weighting, longitude, zodiak, orb, unavailable and exclusion of ASC/MC.');
