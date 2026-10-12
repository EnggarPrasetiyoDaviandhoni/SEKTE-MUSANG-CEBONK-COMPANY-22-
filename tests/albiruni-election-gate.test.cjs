'use strict';
const assert=require('node:assert/strict');
const Gate=require('../assets/albiruni-election-gate.js');
const b=(target)=>({actor:'Venus',target,role:'BENEFIC',angle:60,orb:0.1});
const m=(target)=>({actor:'Mars',target,role:'MALEFIC',angle:90,orb:0.1});
const chart=contacts=>({
 ascendant:90,ascendantRuler:'Moon',sunAltitudeDegrees:20,
 twilightUncertain:false,moonAscRuler:null,contacts
});
const favored=Gate.judge(chart([b('Ascendant')]));
assert.equal(favored.status,'MENGUNTUNGKAN');
assert.equal(favored.eligible,true);
assert.equal(favored.marketValidated,false);
const blocked=Gate.judge(chart([m('Bulan')]));
assert.equal(blocked.status,'MERUGIKAN');
assert.equal(blocked.eligible,false);
assert.equal(Gate.judge(chart([b('Ascendant'),m('Bulan')])).status,'CAMPURAN');
assert.equal(Gate.judge(chart([])).status,'CAMPURAN');
assert.equal(Gate.judge(chart([b('Penguasa tanda Bulan')])).eligible,false,
 'Benefic not supporting the key Ascendant/Moon must not greenlight time');
assert.equal(Gate.judge({...chart([b('Ascendant')]),ascendantRuler:'Mars',
 moonAscRuler:null}).eligible,false,
 'Moon and Ascendant ruler must have aspect');
assert.equal(Gate.judge({...chart([b('Bulan')]),ascendantRuler:'Mars',
 moonAscRuler:{angle:120,orb:1.5}}).eligible,true);
assert.equal(Gate.judge({...chart([b('Bulan')]),twilightUncertain:true}).eligible,false);
assert.equal(Gate.judge(null).eligible,false);
assert.equal(Gate.judge({contacts:[],ascendant:0,ascendantRuler:'Sun',
 sunAltitudeDegrees:0}).eligible,false);
console.log('PASS: §527 heuristic supports favorable/harmful/mixed, no BUY/SELL decisions, incomplete/twilight fail closed.');
