'use strict';
// Fast deterministic UI integration test. Real ephemeris/calculation paths
// are tested separately in tests/albiruni.test.cjs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const C=require('../assets/albiruni-core.js');
const ROOT=path.join(__dirname,'..');
async function until(fn,name){
 for(let i=0;i<500;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}
 throw Error('Timeout: '+name);
}
async function run(){
 const html='<main><nav class="viewtabs"><button class="viewtab" id="tabAstro">ASTROLOGY</button>'+
  '<button class="viewtab" id="tabAlBiruni">AL-BIRUNI</button></nav>'+
  '<div id="astroView"></div><section id="albiruniPanel" hidden></section></main>';
 const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only'});
 const w=dom.window,errors=[];
 w.addEventListener('error',e=>errors.push(e.error||e.message));
 const source=fs.readFileSync(path.join(ROOT,'assets/albiruni-ui.js'),'utf8');
 // Pseudo geometric longitudes deliberately yield opposite direction across
 // separate, independent date/week/month datasets.
 const longitudes={Sun:90,Moon:0,Mercury:180,Venus:150,Mars:180,Jupiter:60,Saturn:240};
 const engine={longitude:body=>longitudes[body]};
 const modes=[];
 const H=3600000;
 function event(id,pair,start,end,exact){
  const aspect=C.ASPECTS.find(x=>x.angle===60);
  return {id,pair,angle:60,name:aspect.name,start,end,exactTimes:[exact],
   closest:exact,closestOrb:0,startClipped:false,endClipped:false};
 }
 const scan=async (_engine,date,{mode,focus,orb,onProgress,cancelled})=>{
  if(cancelled())throw Error('cancelled');
  modes.push(mode);
  const range=C.period(date,mode),first=range.start,dayStart=range.days[0].start;
  const events=mode==='day'?
    [event('day-sell',['Mars','Saturn'],first+10*H,first+12*H,first+11*H)]:
   mode==='week'?
    [event('week-buy',['Moon','Jupiter'],dayStart+9*H,dayStart+13*H,dayStart+11*H)]:
    [event('month-sell',['Mars','Saturn'],
      C.parseDate('2026-10-06')+10*H,C.parseDate('2026-10-06')+16*H,
      C.parseDate('2026-10-06')+13*H)];
  onProgress?.(100);
  return {version:'1.5.0',range,focus,orb,stepMinutes:15,resolutionSeconds:1,events};
 };
 w.Astronomy={}; // library available; no third-party network request.
 w.CebonkAlBiruni=Object.freeze({...C,createEngine:()=>engine,scan});
 w.eval(source);
 const $=id=>w.document.getElementById(id);
 await until(()=>$('abRun').disabled===false,'initial weekly ready');
 $('tabAlBiruni').click();
 $('abDate').value='2026-10-05';
 $('abDate').dispatchEvent(new w.Event('change'));
 const before=modes.length;
 $('abRunThree').click();
 await until(()=>$('abRunThree').disabled===false&&!$('abThreeResult').hidden,'three horizons done');
 assert.deepEqual(modes.slice(before),['day','week','month'],'each horizon must scan independently');
 const cards=[...w.document.querySelectorAll('.ab-three-card')];
 assert.equal(cards.length,3);
 assert.deepEqual(cards.map(x=>x.dataset.abHorizon),['day','week','month']);
 assert.deepEqual(cards.map(x=>x.querySelector('.ab-three-direction').textContent.trim()),['SELL','BUY','SELL']);
 for(const card of cards){
  assert.match(card.textContent,/TANGGAL & JAM KANDIDAT ENTRY/);
  assert.match(card.textContent,/2026-10-0\d \d\d:\d\d:\d\d WIB/);
  assert.match(card.textContent,/MULAI/);
  assert.match(card.textContent,/INTI/);
  assert.match(card.textContent,/AKHIR/);
  assert.match(card.textContent,/Dasar aspek/);
  assert.match(card.textContent,/orb /);
  assert.doesNotMatch(card.textContent,/winrate|akurasi \d\d%|probabilitas \d\d%/i);
 }
 assert.match(cards[0].textContent,/Mars/);
 assert.match(cards[1].textContent,/Jupiter/);
 assert.match(cards[2].textContent,/Saturnus/);
 assert.match(cards[1].textContent,/SWING/);
 assert.match(cards[2].textContent,/POSITION TRADE/);
 // Sunday is explicitly excluded as a market-entry candidate.
 $('abDate').value='2026-10-11';
 $('abDate').dispatchEvent(new w.Event('change'));
 assert.equal($('abThreeResult').hidden,true,'stale cards must disappear when anchor date changes');
 $('abRunThree').click();
 await until(()=>$('abRunThree').disabled===false&&!$('abThreeResult').hidden,'Sunday re-run');
 const sunday=$('abThreeCards').querySelector('[data-ab-horizon="day"]');
 assert.match(sunday.textContent,/WAIT — TIDAK ADA ENTRY/);
 assert.doesNotMatch(sunday.textContent,/TANGGAL & JAM KANDIDAT ENTRY \(WIB\).*2026-10-11 11:00:00/);
 // MANUAL mode never shows stale AUTO outputs.
 $('abBiasMode').value='MANUAL';$('abBiasMode').dispatchEvent(new w.Event('change'));
 assert.equal($('abThreeResult').hidden,true);
 $('abRunThree').click();
 assert.match($('abStatus').textContent,/AUTO EKSPERIMEN/);
 assert.equal($('abThreeCards').children.length,0);
 assert.equal(errors.length,0,JSON.stringify(errors));
 dom.window.close();
 console.log('PASS: independent Al-Biruni intraday/swing/position cards, entry dates and WIB, opposite biases, Sunday WAIT, stale/manual safety.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
