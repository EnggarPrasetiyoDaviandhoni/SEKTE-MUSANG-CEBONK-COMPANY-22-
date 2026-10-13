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
 // Freeze fixture clock: the direct SELL test feed is dated 2026-10-12.
 w.Date.now=()=>Date.parse('2026-10-12T00:00:00Z');
 w.eval(fs.readFileSync(path.join(path.dirname(require.resolve('astronomy-engine')),'astronomy.browser.min.js'),'utf8'));
 const browserAstronomy=w.Astronomy;
 w.CebonkCore=Object.freeze({sentinel:'legacy'});w.CEBONK_ASTRO_STATE=Object.freeze({sentinel:'unchanged'});
 const oldCore=w.CebonkCore,oldState=w.CEBONK_ASTRO_STATE;
 const errors=[];w.addEventListener('error',e=>errors.push(e.error||e.message));
 w.fetch=async (url,opts)=>{assert.match(url,/majority_direct_v3\.json$/,'EA 1.03 must read direct V3 only');return ({
   ok:true,json:async()=>({
    model:'ALBIRUNI_MAJORITY_DIRECT_V3',date_wib:'2026-10-12',
    signal_id:'AB-20261012-SELL-TEST',direction:'SELL',
    entry_epoch:Math.floor(Date.parse('2026-10-12T03:00:00Z')/1000),
    core_epoch:Math.floor(Date.parse('2026-10-12T06:42:35Z')/1000),
    end_epoch:Math.floor(Date.parse('2026-10-12T07:30:00Z')/1000),
    phase:'APPLYING',buy_aspects:1,sell_aspects:2,
    summary:{directionRule:'ASPECT_COUNT_MAJORITY_V2',dominant:'SELL',buyVotes:30,sellVotes:128},
    published_epoch:1791801290,reason:'READY_MAJORITY_ONLY',
    election:{eligible:null,status:'NOT_APPLIED',reference:{latitude:-6.2,longitude:106.8167,gateMode:'majority'},
     entry_wib:'2026-10-12 10:00 WIB',check_wib:'2026-10-12 13:37 WIB'}
   })
  });};
  let blob=null;
 w.URL.createObjectURL=value=>{blob=value;return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
 w.eval(fs.readFileSync(path.join(ROOT,'assets/albiruni-core.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(ROOT,'assets/albiruni-classic.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(ROOT,'assets/albiruni-ui.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(ROOT,'assets/albiruni-election-gate.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(ROOT,'assets/albiruni-classic-ui.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(ROOT,'assets/primbon-dagang.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(ROOT,'assets/primbon-dagang-ui.js'),'utf8'));
 const $=id=>w.document.getElementById(id);
 await until(()=>$('abRun').disabled===false&&!$('abResults').hidden,'initial calculation');
 assert.equal($('abCalendar').querySelectorAll('button').length,5);
 assert.ok($('abClassicPanel'),'classical panel must exist');
 assert.ok($('abFinalDecision'),'EA decision must be displayed beside time inspector');
 assert.ok($('abPrimbonDagang'),'Sri + Saat Agung panel must be separate');
 assert.match($('abPrimbonDagang').textContent,/bukan filter order/);
 assert.match($('abPrimbonSelected').textContent,/No.159/);
 assert.match($('abPrimbonSelected').textContent,/No.147/);
 assert.ok($('abFinalDecision').compareDocumentPosition($('abTime')) & w.Node.DOCUMENT_POSITION_FOLLOWING,
  'EA decision must render before time inspector, not hidden below classical tables');
 await until(()=>$('abFinalFeedStatus').textContent.includes('EA DIRECT SELL'),'published direct SELL');
 await until(()=>$('abPrimbonEntry').textContent.includes('KANDIDAT ENTRY EA DIRECT'),'primbon candidate from same V3 feed');
 assert.match($('abPrimbonEntry').textContent,/Senin Pahing/);
 assert.match($('abPrimbonEntry').textContent,/Rejeki/);
 assert.match($('abPrimbonEntry').textContent,/observasi tok/i);
 assert.match($('abFinalFeedStatus').textContent,/TIDAK DITERAPKAN/);
  assert.match($('abFinalFeedStatus').textContent,/ARAH MAYORITAS HARIAN WEB/);
  assert.match($('abFinalFeedStatus').textContent,/SELL 128 \/ BUY 30/);
  assert.match($('abFinalFeedStatus').textContent,/feed v1\.03/);
  assert.match($('abFinalFeedStatus').textContent,/JADWAL ENTRY EA DIRECT/);
  assert.match($('abFinalFeedStatus').textContent,/SELL 2 \/ BUY 1/);
 assert.match($('abFinalFeedStatus').textContent,/2026-10-12/);
 assert.match($('abFinalFeedStatus').textContent,/Filter waktu/);
 assert.match($('abInspectLabel').textContent,/BELUM FILTER EA/);
 $('abRefreshFeed').click();
 await until(()=>$('abFinalFeedStatus').textContent.includes('EA DIRECT SELL'),'refresh direct EA feed');
 $('abClassicCalc').click();
 await until(()=>$('abClassicResults').textContent.includes('SKOR MARTABAT KLASIK'),'classical direction and dignity');
 assert.match($('abClassicResults').textContent,/ARAH HARIAN/);
 assert.match($('abClassicResults').textContent,/AUTO EKSPERIMEN MODERN/);
 assert.match($('abClassicResults').textContent,/BUY|SELL|WAIT/);
 assert.match($('abClassicResults').textContent,/MULAI/);
 assert.match($('abClassicResults').textContent,/INTI/);
 assert.match($('abClassicResults').textContent,/AKHIR/);
 assert.match($('abClassicResults').textContent,/Tidak ada rumus BUY\/SELL/);
 assert.match($('abClassicResults').textContent,/ASCENDANT/);
 assert.match($('abClassicResults').textContent,/KONTAK BENEFIC/);
 assert.match($('abClassicResults').textContent,/KUALITAS WAKTU AL-BIRUNI/);
 assert.match($('abClassicResults').textContent,/MENGUNTUNGKAN|MERUGIKAN|CAMPURAN/);
 assert.match($('abClassicResults').textContent,/KONTAK MALEFIC/);
 assert.match($('abClassicResults').textContent,/MALAM|SIANG/);
 $('abClassicLat').value='-7.3000';
 $('abClassicLat').dispatchEvent(new w.Event('change'));
 assert.match($('abClassicResults').textContent,/Hitung ulang/);
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
 const periodHeader=$('abPeriodDays').textContent;
 const primary=$('abPeriodSummary').querySelector('.ab-period-focus .ab-chip')?.textContent.trim();
 assert.ok(['BUY','SELL','NETRAL'].includes(primary));
 assert.match($('abPeriodSummary').textContent,/FOKUS SATU ARAH/);
 const weekFocus=[...$('abPeriodDays').querySelectorAll('.ab-period-day')].map(x=>x.querySelector('.ab-chip')?.textContent.trim());
 assert.ok(weekFocus.every(x=>x===primary||x==='WAIT'||x===undefined),'opposite side must never appear in focused cards');
 assert.match(periodHeader,/Rincian saben tanggal/);

 assert.equal($('abPeriodSummary').textContent.includes('probabilitas'),true);
 $('tabAstro').click();assert.equal($('albiruniPanel').hidden,true);
 $('tabAlBiruni').click();assert.equal($('albiruniPanel').hidden,false);

 assert.equal($('abAutoStatus').hidden,false,'AUTO summary available');
 assert.equal($('abAutoWindows').hidden,false,'AUTO timeline available');
 assert.match($('abRuleState').textContent,/AUTO/);
 assert.match($('abAutoStatus').textContent,/ASPEK AUTO MAYORITAS/);
 assert.match($('abInspectLabel').textContent,/FOKUS JAM/);
 assert.match($('abAutoStatus').textContent,/\d+ SELL \/ \d+ BUY/);
 assert.match($('abAutoWindows').textContent,/FOKUS 1 ARAH/);
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
 assert.match($('abFinalFeedStatus').textContent,/tidak ada untuk 2026-10-14/,'historical feed must not be reused for another date');
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

 $('abBiasMode').value='AUTO';$('abBiasMode').dispatchEvent(new w.Event('change'));
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
