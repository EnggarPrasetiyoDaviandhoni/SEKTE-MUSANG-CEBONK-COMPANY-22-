'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const ROOT=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(ROOT,'assets/albiruni-classical-direction-ui.js'),'utf8');
const shell=fs.readFileSync(path.join(ROOT,'assets/site-simple-ui.js'),'utf8');
const core=fs.readFileSync(path.join(ROOT,'assets/albiruni-classical-direction.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
assert.ok(html.includes('assets/albiruni-classical-direction.js?v=1.0.0'));
assert.ok(html.includes('assets/albiruni-classical-direction-ui.js?v=1.0.0'));
assert.ok(html.includes('assets/albiruni-classical-direction.css?v=1.0.0'));
assert.ok(!/autoSignal|autoPeriodSummary|ASPECT_COUNT_MAJORITY|majority_direct_v3/.test(ui),'new classical UI does not call legacy majority engine');
assert.ok(!/autoSignal|ASPECT_COUNT_MAJORITY/.test(core),'classical direction source must not vote on aspects');
const dom=new JSDOM('<body><main><nav class="viewtabs"><button type="button" class="viewtab active" id="tabAstro">ASTROLOGY</button><button type="button" class="viewtab" id="tabAlBiruni">AL-BIRUNI</button></nav>'+
 '<section id="albiruniPanel"><div class="ab-header">Legacy title</div><div class="ab-body"><div class="ab-period-modes"></div>'+
 '<div id="abResults"><div id="abPeriodSummary">Summary</div><div id="abPeriodDays">Days</div><div id="abEvents"></div></div>'+
 '<details id="abClassicPanel"><summary>Classic legacy</summary></details><div class="ab-actions"></div></div></section></main></body>',
 {url:'https://example.test/#al-biruni',runScripts:'outside-only'});
const w=dom.window;
w.Date.now=()=>Date.parse('2026-10-14T03:00:00.000Z');
const start=Date.parse('2026-10-13T17:00:00.000Z'),MIN=60000;
let charts=0,cleared=0,legacyVotes=0;
const original={read:'legacy state'};w.CEBONK_ASTRO_STATE=original;
w.CebonkAlBiruni={
 stamp:ms=>new Date(ms+7*60*MIN).toISOString().slice(0,16).replace('T',' ')+' WIB',
 period:(date,mode)=>{
  assert.equal(date,'2026-10-14');assert.equal(mode,'day');
  return {days:[{start,weekday:3}]};
 },
 createEngine:()=>({clear:()=>cleared++}),
 autoSignal:()=>{legacyVotes++;throw Error('Legacy majority must NEVER be called');}
};
w.Astronomy={stub:true};
w.CebonkAlBiruniClassic={chart:(A,engine,ms,opts)=>{
 charts++;assert.equal(opts.orb,2);
 return {ms};
}};
w.CebonkAlBiruniClassicalDirection={
 FAVORABLE:'MENGUNTUNGKAN',HARMFUL:'MERUGIKAN',WAIT:'WAIT',
 assess:chart=>({ms:chart.ms,direction:'BUY',status:'MENGUNTUNGKAN',reason:'DUKUNGAN_KLASIK_DOMINAN',
  favorable:7,harmful:1,net:6,factors:[{label:'Venus → Ascendant',favorable:6,harmful:0}]}),
 summarize:(rows,{stepMinutes,confirmBars})=>{
  assert.equal(stepMinutes,15);assert.equal(confirmBars,2);
  assert.equal(rows.length,72);
  return {direction:'BUY',quality:'MENGUNTUNGKAN',buyStrength:426,sellStrength:0,
   buyMinutes:71*15,sellMinutes:0,waitMinutes:15,
   focusWindow:{start:rows[1].ms,core:rows[1].ms,end:rows.at(-1).ms+15*MIN},
   windows:[{direction:'BUY',start:rows[1].ms,core:rows[1].ms,end:rows.at(-1).ms+15*MIN,
    minutes:71*15,strength:426}],
   timeline:rows.map((r,i)=>({...r,confirmed:i?'BUY':'WAIT'}))};
 }
};
w.eval(ui);
const $=id=>w.document.getElementById(id);
assert.ok($('abClassicalPrimary'));
assert.equal($('abClassicalMainDate').value,'2026-10-14');
assert.equal($('abClassicalMainMode').value,'day');
assert.equal($('abClassicalMainResult').hidden,true);
assert.equal($('abClassicalMainStatus').textContent.includes('Siap.'),true);
assert.ok($('abResults'),'legacy structure remains present');
assert.ok(!$('abLegacyArchive'),'archival presentation handled by simple site shell');
assert.ok(!$('abClassicalPrimary').textContent.includes('CAMPURAN'),'new panel never surfaces disallowed category');
const wait=()=>new Promise((resolve,reject)=>{
 let i=0;function poll(){
  if(!$('abClassicalMainResult').hidden)return resolve();
  if(++i>200)return reject(Error('Timed out classical result: '+$('abClassicalMainStatus').textContent));
  setTimeout(poll,15);
 }poll();
});
(async()=>{
 $('abClassicalMainRun').click();
 await wait();
 assert.equal(charts,72,'day scans the standalone classical chart, not legacy votes');
 assert.equal(cleared,1,'ephemeris cache cleared on success');
 assert.equal(legacyVotes,0);
 assert.equal($('abClassicalDirection').textContent,'BUY');
 assert.match($('abClassicalQuality').textContent,/MENGUNTUNGKAN/);
 assert.match($('abClassicalStart').textContent,/2026-10-14 06:15 WIB/);
 assert.match($('abClassicalCore').textContent,/2026-10-14 06:15 WIB/);
 assert.equal($('abClassicalRows').querySelectorAll('tr').length,72);
 assert.match($('abClassicalFactors').textContent,/Venus/);
 assert.match($('abClassicalMainStatus').textContent,/Keputusan entry otomatis tetap WAIT/);
 assert.equal(w.CEBONK_ASTRO_STATE,original);
 $('abClassicalMainOrb').value='3';
 $('abClassicalMainOrb').dispatchEvent(new w.Event('change'));
 assert.equal($('abClassicalMainResult').hidden,true,'stale results invalidated after edit');
 $('abClassicalMainOrb').value='2';
 $('abClassicalMainOrb').dispatchEvent(new w.Event('change'));
 // Simulate shell mounting afterwards. Legacy components must be archived
 // without hiding the new primary screen.
 w.eval(shell);
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 assert.ok($('abLegacyArchive'),'legacy majority is now explicitly archived');
 assert.equal($('abLegacyArchive').open,false,'majority hidden by default');
 assert.ok(!$('abClassicalPrimary').closest('details'),'classical primary stays visible');
 assert.ok($('abResults').closest('#abLegacyArchive'),'legacy UI remains intact');
 assert.ok($('abClassicPanel').closest('#abLegacyArchive'),'previous classical diagnostics archived');
 assert.ok($('simpleMore'));
 assert.ok(!$('abClassicalPrimary').textContent.includes('CAMPURAN'));
 dom.window.close();
 console.log('PASS AL-BIRUNI CLASSICAL UI: standalone scan, BUY mapping, timeline, old majority isolated, archive closed, no legacy impact.');
})().catch(err=>{console.error(err);dom.window.close();process.exitCode=1;});
