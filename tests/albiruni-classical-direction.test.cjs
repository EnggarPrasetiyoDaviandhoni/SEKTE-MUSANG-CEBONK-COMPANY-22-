'use strict';
const assert=require('node:assert/strict');
const D=require('../assets/albiruni-classical-direction.js');
const B=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'];
const ms=Date.UTC(2026,9,13,23,0); // 06:00 WIB
function chart({good=true,bad=false,twilight=false,contact=true,broken=false}={}){
 const dignities=B.map(body=>({body,longitude:body==='Sun'?10:body==='Moon'?45:120,
  sign:'Aries',signDegree:10,subtotal:good?4:0}));
 const cond=B.map(body=>({body,velocityDegPerDay:body==='Jupiter'?.1:1,
  negatives:bad?['DETRIMENT','FALL','RETROGRADE']:[],
  positives:[]}));
 return {ms,sect:'day',ascendant:90,ascendantRuler:'Moon',
  lunarRuler:'Venus',orb:2,longitudes:{Sun:10,Moon:45,Venus:90,Mars:180,Jupiter:165,Saturn:270,Mercury:15},
  sunAltitudeDegrees:35,twilightUncertain:twilight,
  dignities:{rows:dignities,completeDignity:true},
  conditions:{rows:cond},
  significators:[{id:'Sun',label:'Matahari (asosiasi emas §410)',longitude:10},
   {id:'Moon',label:'Bulan',longitude:45},{id:'ASC',label:'Ascendant',longitude:90}],
  contacts:contact?[bad?
   {actor:'Mars',target:'Bulan',role:'MALEFIC',angle:90,orb:.1}:
   {actor:'Jupiter',target:'Bulan',role:'BENEFIC',angle:120,orb:.1}]:[],
  moonAscRuler:null,
  fullElectional:false,
  ...(broken?{conditions:{rows:[]}}:{})};
}
const buy=D.assess(chart());
assert.equal(buy.status,'MENGUNTUNGKAN');
assert.equal(buy.direction,'BUY');
assert.equal(buy.tradeDecision,'WAIT');
assert.ok(buy.favorable>buy.harmful);
assert.equal(buy.beneficContacts,1);
assert.equal(buy.maleficContacts,0);
assert.ok(buy.factors.some(f=>f.section==='MARTABAT'));
assert.ok(buy.factors.some(f=>f.section==='KONTAK'));
assert.equal(buy.source,'ALBIRUNI_CLASSIC_PARTIAL_ONLY');
assert.equal(buy.originalBookDirection,false);
assert.equal(buy.validated,false);
const sell=D.assess(chart({good:false,bad:true}));
assert.equal(sell.status,'MERUGIKAN');
assert.equal(sell.direction,'SELL');
assert.ok(sell.harmful>sell.favorable);
assert.equal(sell.maleficContacts,1);
assert.equal(sell.tradeDecision,'WAIT');
const noContact=D.assess(chart({contact:false}));
assert.equal(noContact.direction,'WAIT','No contact must not force BUY based on dignity alone');
assert.equal(noContact.reason,'KONTAK_PENANDA_TIDAK_TERSEDIA');
const twilight=D.assess(chart({twilight:true}));
assert.equal(twilight.direction,'WAIT','Near the horizon must not force direction');
const missing=D.assess(chart({broken:true}));
assert.equal(missing.direction,'WAIT');
assert.equal(missing.reason,'MARTABAT_ATAU_KONDISI_KURANG');
const incomplete=D.assess(null);
assert.equal(incomplete.direction,'WAIT');
assert.equal(incomplete.tradeDecision,'WAIT');
assert.equal(D.assess({...chart(),contacts:[{actor:'Venus',target:'Ascendant',role:'BENEFIC',angle:60,orb:2.1}]}).direction,
 'WAIT','Beyond user orb is excluded');
const at=i=>ms+i*15*60000;
const t=[
 {...buy,ms:at(0)}, {...buy,ms:at(1)}, {...buy,ms:at(2)},
 {...sell,ms:at(3)},{...sell,ms:at(4)},{...sell,ms:at(5)}
];
const summary=D.summarize(t,{stepMinutes:15,confirmBars:2});
assert.equal(summary.model,'ALBIRUNI_CLASSICAL_DIRECTION_EXPERIMENT_V1');
assert.equal(summary.tradeDecision,'WAIT');
assert.deepEqual(summary.timeline.map(x=>x.confirmed),['WAIT','BUY','BUY','WAIT','SELL','SELL']);
assert.equal(summary.buyMinutes,30);
assert.equal(summary.sellMinutes,30);
assert.equal(summary.waitMinutes,30);
assert.equal(summary.windows.length,2);
assert.equal(summary.windows[0].start,at(1),'AWAL is confirmation time, no lookahead');
assert.equal(summary.windows[0].end,at(3));
assert.equal(summary.windows[1].start,at(4));
assert.equal(summary.windows[1].end,at(6));
assert.equal(summary.direction,'SELL','Weighted classical strength drives period direction, NOT number of aspects');
assert.equal(summary.quality,'MERUGIKAN');
assert.equal(summary.focusWindow.start,at(4));
assert.ok(summary.focusWindow.core===at(4)||summary.focusWindow.core===at(5));
const p=[...t];
const full=D.summarize(p,{stepMinutes:15,confirmBars:2});
for(let i=0;i<p.length;i++){
 const x=D.summarize(p.slice(0,i+1),{stepMinutes:15,confirmBars:2});
 assert.deepEqual(x.timeline,full.timeline.slice(0,i+1),'No earlier slot may depend on future evaluations');
}
const nxt=at(0)+86400000;
const gap=D.summarize([{...buy,ms:at(0)}, {...buy,ms:nxt}],
 {stepMinutes:15,confirmBars:2});
assert.deepEqual(gap.timeline.map(x=>x.confirmed),['WAIT','WAIT'],'No confirmation across days');
assert.equal(gap.direction,'WAIT');
const wait=D.summarize([{...buy,ms:at(0)},{...buy,ms:at(1)},
 {...noContact,ms:at(2)},{...buy,ms:at(3)}],{stepMinutes:15,confirmBars:2});
assert.deepEqual(wait.timeline.map(x=>x.confirmed),['WAIT','BUY','WAIT','WAIT'],'WAIT resets pending streak');
assert.throws(()=>D.summarize([],{}),/kosong/);
assert.throws(()=>D.summarize([p[0],{...p[1],ms:at(0)}]),/menaik/);
assert.throws(()=>D.summarize([p[0]],{stepMinutes:7}),/Resolusi/);
assert.equal(D.VERSION,'1.0.0');
console.log('PASS AL-BIRUNI CLASSICAL DIRECTION: source-only dignity/debility, benefic/malefic contacts, BUY SELL WAIT, causal windows, no legacy voting.');
