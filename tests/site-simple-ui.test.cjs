'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const ROOT=path.resolve(__dirname,'..');
const CODE=fs.readFileSync(path.join(ROOT,'assets/site-simple-ui.js'),'utf8');
function make(extraActive=false){
 const tabs=['tabAstro','tabAlBiruni','tabAstroNews','tabBazi','tabCombined'];
 const dom=new JSDOM('<body><main class="wrap">'+
  '<nav class="viewtabs">'+tabs.map(id=>'<button class="viewtab'+
  ((extraActive&&id==='tabBazi')||(!extraActive&&id==='tabAstro')?' active':'')+
  '" id="'+id+'">'+id+'</button>').join('')+'</nav>'+
  '<div class="controls"><input id="dateInput"><div class="mode-control"><select id="tzMode"></select></div><button id="runBtn">Hitung</button></div>'+
  '<section id="results"><div class="metrics" id="testMetrics"><div>AWAL</div></div>'+
  '<section class="panel"><button id="copyBtn">Salin</button><div id="timeline">Timeline</div></section>'+
  '<section class="panel"><input id="slotSelect"><table id="sampleData"></table></section></section>'+
  '<section id="albiruniPanel"><div class="ab-header">AL-BIRUNI</div><div class="ab-body">'+
  '<div class="ab-period-modes"></div><div class="ab-controls">'+
  '<div><input id="abDate"></div><div><select id="abMode"></select></div>'+
  '<div><select id="abFocus"></select></div><div><input id="abOrb"></div></div>'+
  '<div class="ab-auto-config"><select id="abBiasMode"></select></div>'+
  '<div class="ab-actions"><button id="abRun">Hitung aspek</button><button id="abRunThree">3 dominasi</button>'+
  '<button id="abToday">Hari ini</button><button id="abCancel">Batalkan</button><button id="abPrev">Mundur</button>'+
  '<button id="abNext">Maju</button><button id="abCSV">CSV</button><button id="abStudyCSV">Studi</button></div>'+
  '<div id="abResults"><div id="abPeriodSummary">RINGKASAN</div>'+
  '<div id="abPeriodDays">HARI</div><div id="abCalendar"></div>'+
  '<div id="abFinalDecision">ARSIP EA</div><div id="abEvents">DATA</div></div>'+
  '<details id="abClassicPanel" open><summary>Klasik</summary><div id="classicData"></div></details>'+
  '</div></section></main></body>',
 {url:'https://example.test/',runScripts:'outside-only'});
 const w=dom.window;
 w.eval(CODE);
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return dom;
}
function run(){
 const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 assert.match(html,/assets\/site-simple\.css\?v=1\.0\.0/);
 assert.match(html,/assets\/site-simple-ui\.js\?v=1\.0\.0/);
 assert.ok(html.indexOf('assets/site-simple-ui.js?')>html.indexOf('assets/site-tab-router.js?'),
  'simplified shell must load after all module tabs/router');
 const d=make(),w=d.window,$=id=>w.document.getElementById(id);
 assert.ok(w.document.body.classList.contains('cebonk-simple'));
 assert.equal($('simpleMore').getAttribute('aria-expanded'),'false');
 assert.equal($('simpleAstroDetails').open,false);
 assert.equal($('simpleAlbiruniDetails').open,false);
 assert.equal($('abClassicPanel').open,false,'classical calculation is still available after expanding');
 assert.equal($('testMetrics').parentElement.id,'results','headline timing remains visible');
 assert.equal($('timeline').closest('details').id,'simpleAstroDetails');
 assert.equal($('copyBtn').closest('details').id,'simpleAstroDetails');
 assert.equal($('sampleData').closest('details').id,'simpleAstroDetails');
 assert.equal($('abPeriodSummary').parentElement.id,'abResults','headline Al-Biruni report stays visible');
 assert.equal($('abPeriodDays').closest('details').id,'simpleAlbiruniDetails');
 assert.equal($('abFinalDecision').closest('details').id,'simpleAlbiruniDetails','legacy feed stays accessible as archive');
 assert.equal($('abEvents').closest('details').id,'simpleAlbiruniDetails');
 assert.match($('simpleAbNotice').textContent,/STATUS TRADING: WAIT/);
 $('simpleMore').click();
 assert.equal($('simpleMore').getAttribute('aria-expanded'),'true');
 assert.ok(w.document.querySelector('.viewtabs').classList.contains('simple-nav-open'));
 $('simpleMore').click();
 assert.equal($('simpleMore').getAttribute('aria-expanded'),'false');
 $('tabBazi').click();
 assert.equal($('simpleMore').getAttribute('aria-expanded'),'true','secondary modules remain visible after navigation');
 $('simpleAlbiruniSettings').click();
 assert.equal($('simpleAlbiruniSettings').getAttribute('aria-expanded'),'true');
 assert.ok($('albiruniPanel').classList.contains('simple-ab-expanded'));
 $('simpleAlbiruniSettings').click();
 assert.ok(!$('albiruniPanel').classList.contains('simple-ab-expanded'));
 $('simpleAstroSettings').click();
 assert.ok($('tzMode').closest('.controls').classList.contains('simple-settings-open'));
 let clicks=0;
 $('abRun').addEventListener('click',()=>clicks++);
 $('abRun').click();assert.equal(clicks,1,'original calculation button remains intact');
 // A duplicate load must not duplicate controls.
 w.CebonkSimpleUi.mount();
 assert.equal(w.document.querySelectorAll('#simpleMore').length,1);
 d.window.close();
 const deep=make(true);
 assert.equal(deep.window.document.getElementById('simpleMore').getAttribute('aria-expanded'),'true',
  'secondary deep link stays discoverable');
 deep.window.close();
 console.log('PASS: simplified shell preserves tabs, details, calculation controls, archives and deep links.');
}
run();
