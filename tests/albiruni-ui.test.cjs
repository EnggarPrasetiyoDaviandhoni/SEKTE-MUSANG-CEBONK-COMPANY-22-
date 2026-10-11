'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const A=require('astronomy-engine');
const ROOT=path.join(__dirname,'..');
async function until(fn,label){for(let i=0;i<500;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timeout: '+label);}
async function run(){
 const dom=new JSDOM('<main><nav class="viewtabs"><button class="viewtab" id="tabAstro">ASTROLOGY</button><button class="viewtab" id="tabAlBiruni">ASTROLOGY AL-BIRUNI</button></nav><div id="astroView"><input id="dateInput" value="2026-10-11"></div><section id="albiruniPanel" hidden></section><div id="statusText">old status</div></main>',{url:'https://example.test/',runScripts:'outside-only'});
 const w=dom.window;
 w.eval(fs.readFileSync(path.join(path.dirname(require.resolve('astronomy-engine')),'astronomy.browser.min.js'),'utf8'));
 const browserAstronomy=w.Astronomy;
 w.CebonkCore=Object.freeze({sentinel:'legacy'});w.CEBONK_ASTRO_STATE=Object.freeze({sentinel:'unchanged'});
 const oldCore=w.CebonkCore,oldState=w.CEBONK_ASTRO_STATE;
 const errors=[];w.addEventListener('error',e=>errors.push(e.error||e.message));
 let blob=null;
 w.URL.createObjectURL=value=>{blob=value;return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
 w.eval(fs.readFileSync(path.join(ROOT,'assets/albiruni-core.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(ROOT,'assets/albiruni-ui.js'),'utf8'));
 const $=id=>w.document.getElementById(id);
 await until(()=>$('abRun').disabled===false&&!$('abResults').hidden,'initial calculation');
 assert.equal($('abCalendar').querySelectorAll('button').length,5);
 assert.equal($('abBiasMode').value,'AUTO','AUTO must be default for existing users');
 assert.equal($('albiruniPanel').hidden,true,'dedicated view starts hidden');
 $('tabAlBiruni').click();assert.equal($('albiruniPanel').hidden,false);
 assert.equal($('abPeriodSummary').hidden,false);
 assert.match($('abPeriodSummary').textContent,/RINGKASAN MINGGUAN/);
 assert.match($('abPeriodSummary').textContent,/MULAI/);
 assert.match($('abPeriodSummary').textContent,/INTI/);
 assert.match($('abPeriodSummary').textContent,/AKHIR/);
 assert.equal($('abPeriodDays').hidden,false);
 assert.equal($('abPeriodDays').querySelectorAll('[data-ab-period-date]').length,5);
 assert.equal($('abPeriodDays').querySelectorAll('.ab-period-day').length,5);
 assert.equal($('abPeriodSummary').textContent.includes('probabilitas'),true);
 $('tabAstro').click();assert.equal($('albiruniPanel').hidden,true);
 $('tabAlBiruni').click();assert.equal($('albiruniPanel').hidden,false);

 assert.equal($('abAutoStatus').hidden,false,'AUTO summary available');
 assert.equal($('abAutoWindows').hidden,false,'AUTO timeline available');
 assert.match($('abRuleState').textContent,/AUTO/);
 assert.match($('abAutoStatus').textContent,/AUTO EKSPERIMEN/);
 assert.match($('abAutoWindows').textContent,/Window hipotesis AUTO/);
 $('abStudyCSV').click();
 assert.ok(blob&&blob.size>1000);
 assert.match($('abStatus').textContent,/CSV riset AUTO/);
 assert.match($('abAutoStatus').textContent,/bukan persentase kemungkinan profit/);

 const firstWindow=$('abAutoWindows').querySelector('[data-ab-autopick]');
 if(firstWindow){
  firstWindow.click();
  assert.match($('abInspectLabel').textContent,/BUY|SELL|NETRAL|KONFLIK/);
  assert.match($('abAutoStatus').textContent,/MULAI ASPEK|Tidak ada aspek dominan/);
 }
 $('abBiasMode').value='MANUAL';
 $('abBiasMode').dispatchEvent(new w.Event('change'));
 assert.equal($('abAutoWindows').hidden,true,'manual mode hides AUTO candidate windows');
 assert.equal($('abAutoStatus').hidden,true);
 assert.equal($('abRuleState').textContent,'NETRAL');
 assert.match(w.localStorage.getItem('cebonk.albiruni.v1'),/"biasMode":"MANUAL"/);

 assert.equal($('abRuleState').textContent,'NETRAL');
 $('abCalendar').querySelectorAll('button')[2].click();assert.match($('abDayTitle').textContent,/Rabu/);
 $('abRule90').value='SELL';$('abRule90').dispatchEvent(new w.Event('change'));
 assert.equal($('abRuleState').textContent,'UJI MANUAL');assert.match(w.localStorage.getItem('cebonk.albiruni.v1'),/SELL/);
 $('abResetRules').click();assert.equal($('abRuleState').textContent,'NETRAL');
 $('abBiasMode').value='AUTO';$('abBiasMode').dispatchEvent(new w.Event('change'));
 assert.equal($('abAutoWindows').hidden,false);
 assert.match($('abRuleState').textContent,/AUTO/);
 // Changing manual bias while AUTO is active must not make it a live trade signal.
 $('abRule0').value='SELL';$('abRule0').dispatchEvent(new w.Event('change'));
 assert.match($('abRuleState').textContent,/AUTO/);
 $('abBiasMode').value='MANUAL';$('abBiasMode').dispatchEvent(new w.Event('change'));

 $('abCSV').click();assert.ok(blob&&blob.size>1000);assert.match($('abStatus').textContent,/CSV/);
 assert.equal($('abStudyCSV').disabled,false);
 $('abStudyCSV').click();assert.ok(blob&&blob.size>1000);assert.match($('abStatus').textContent,/riset MANUAL diekspor/);
 assert.match($('abInspectInfo').textContent,/Arah NETRAL|Bias uji/);

 $('abMode').value='month';$('abMode').dispatchEvent(new w.Event('change'));assert.equal($('abResults').hidden,true);assert.equal($('abCSV').disabled,true);assert.equal($('abStudyCSV').disabled,true);
 $('abDate').value='2024-02-11';$('abRun').click();
 await until(()=>$('abRun').disabled===false&&!$('abResults').hidden,'monthly calculation');
 assert.equal($('abCalendar').querySelectorAll('button').length,29);
 assert.equal($('abPeriodSummary').hidden,false);
 assert.match($('abPeriodSummary').textContent,/RINGKASAN BULANAN/);
 assert.equal($('abPeriodDays').querySelectorAll('.ab-period-day').length,29);
 const saturday=$('abPeriodDays').querySelector('[data-ab-period-date="2024-02-10"]');
 assert.ok(saturday&&saturday.textContent.includes('MARKET TUTUP'));
 assert.equal($('abPeriodDays').querySelectorAll('.ab-period-day').length,29);

 $('abNext').click();await until(()=>$('abRun').disabled===false&&!$('abResults').hidden,'next month');
 assert.equal($('abDate').value,'2024-03-01');assert.equal($('abCalendar').querySelectorAll('button').length,31);
 $('abMode').value='day';$('abMode').dispatchEvent(new w.Event('change'));$('abOrb').value='0';$('abRun').click();
 assert.equal($('abResults').hidden,true);assert.match($('abStatus').textContent,/Orb/);
 $('abOrb').value='2';$('abRun').click();$('abCancel').click();
 assert.equal($('abRun').disabled,false);assert.equal($('abResults').hidden,true);assert.equal($('abCSV').disabled,true);
 await new Promise(r=>setTimeout(r,40));assert.match($('abStatus').textContent,/Dibatalkan/);
 // A failed ephemeris clears the previous result and export instead of displaying stale signals.
 w.Astronomy={MakeTime:browserAstronomy.MakeTime,GeoVector:()=>{throw Error('simulated failure');},Ecliptic:browserAstronomy.Ecliptic};
 $('abRun').click();await until(()=>$('abRun').disabled===false,'ephemeris failure');
 assert.equal($('abResults').hidden,true);assert.equal($('abCSV').disabled,true);assert.match($('abStatus').textContent,/simulated failure/);
 assert.equal(w.CebonkCore,oldCore);assert.equal(w.CEBONK_ASTRO_STATE,oldState);
 assert.equal($('astroView').hidden,false);
 assert.equal($('dateInput').value,'2026-10-11');assert.equal($('statusText').textContent,'old status');assert.equal(errors.length,0);
 dom.window.close();
 console.log('Al-Biruni UI: week/month navigation, leap year, rules, CSV, stale state, cancel/failure and legacy isolation passed.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
