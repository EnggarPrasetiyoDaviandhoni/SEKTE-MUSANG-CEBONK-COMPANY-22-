'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const blob=s=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const REF='3ead2e75c4b6f014e6fad163aaf6d05cef71c009';
let html=read('index.html');
if(html.includes('id="combinedSplitLoader"')){console.log('Already split: Combined 1 protected, Combined 2 separate.');process.exit(0);}
assert.equal(blob(html),'0602997805506f22b751b43c2e357820044af842','Host changed concurrently; stop rather than overwrite');
assert.equal(blob(read('assets/auto-combined-ui.js')),'446fc1cac8338db789d47862e514341b8c556a8a','New UI changed concurrently');
const old=cp.execFileSync('git',['show',REF+':index.html'],{encoding:'utf8',maxBuffer:1024*1024});
assert.equal(blob(old),'f50cfd064eed91173d5ab44bc097a88341f0512a','Historical source must match verified blob');
fs.mkdirSync('archive',{recursive:true});write('archive/combined1-original-3ead2e75.html',old);
const scripts=s=>[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const legacy=scripts(old).find(s=>s.includes("const API_BASE='https://cebonk-xau-api"));assert.ok(legacy);
const helpers=legacy.slice(legacy.indexOf('function parseUtc('),legacy.indexOf('async function refreshTech('));
const calcStart=legacy.indexOf('  const last=candles[candles.length-1]'),calcEnd=legacy.indexOf("  $('techSignal').textContent=signal",calcStart);
assert.ok(calcStart>0&&calcEnd>calcStart);const calculation=legacy.slice(calcStart,calcEnd);
const exported=['last','a','p','setup','trend5','trend15','signal','stage','entry','sl','tp1','tp2','tp3','fib','direction','entryMs','touchFresh','ageMin'];
const calc='function calculate(candles,m5,m15){\n'+calculation+'  return {'+exported.join(',')+'};\n}\n';
let refresh=legacy.slice(legacy.indexOf('async function refreshTech('),legacy.indexOf('function comboFmt('));
refresh=refresh.replace(calculation,'  const {'+exported.join(',')+'}=calculate(candles,m5,m15);\n');
refresh=refresh.replace('if(loading)return;loading=true;',"if(loading)return;if(Date.now()-lastRequest<65000){renderGuard();return;}lastRequest=Date.now();root.CEBONK_C1_TECH_STATE=null;clearDecision('Nganyari data COMBINED 1…');loading=true;");
refresh=refresh.replace(" }catch(e){\n  $('techStatus')"," }catch(e){\n  root.CEBONK_C1_TECH_STATE=null;clearDecision('DATA ERROR: '+e.message);\n  $('techStatus')");
refresh=refresh.replace(/window\.CEBONK_TECH_STATE/g,'root.CEBONK_C1_TECH_STATE').replace("window.dispatchEvent(new Event('cebonk-tech-update'))","root.dispatchEvent(new Event('cebonk-c1-update'))");
let combined=legacy.slice(legacy.indexOf('function comboFmt('),legacy.indexOf("window.addEventListener('cebonk-astro-update',renderCombined)"));assert.ok(combined.includes('function renderCombined()'));
combined=combined.replace('window.CEBONK_ASTRO_STATE','root.CEBONK_ASTRO_STATE').replace('window.CEBONK_TECH_STATE','root.CEBONK_C1_TECH_STATE');
const techStart=old.indexOf('<section id="technicalView"'),comboStart=old.indexOf('<section id="combinedView"',techStart),footer=old.indexOf('<footer>',comboStart);
assert.ok(techStart>0&&comboStart>techStart&&footer>comboStart);
const techMarkup=old.slice(techStart,comboStart).trim().replace('<section id="technicalView" hidden>','<section id="technicalView">');
const comboMarkup=old.slice(comboStart,footer).trim().replace(/^<section id="combinedView" hidden>/,'').replace(/<\/section>\s*$/,'').replace('Combined — Astrology × Fibo Musang CB1','COMBINED 1 — SOP LAWAS');
const markup='<header class="hero"><div><div class="eyebrow">COMBINED 1 · SOP LAWAS DIPULIHKE</div><h2>ASTROLOGY + MA20/50 + CB1</h2><p>M15 trend → M5 trend → M1 Fibo Musang CB1 touch. Ora nganggo filter SND/SNR.</p></div></header><div class="note">SOP custom lawas saka 3ead2e75. Sinyal web dudu order MT5. Model durung divalidasi; data lawas/error ora ditampilke dadi entry anyar.</div><div class="tech-actions"><button id="c1Refresh" class="primary" type="button">REFRESH COMBINED 1</button><span id="c1FeedStatus" role="status">Data M1 / M5 / M15</span></div>'+comboMarkup+'<details id="c1TechnicalDetail"><summary>Rincian MA20/50, CB1, SL & target — SOP lawas</summary>'+techMarkup+'</details>';
const legacyModule=`/* COMBINED 1 RESTORED. Calculation source ${REF}. No SND / mandatory break-retest filter. */
(function(root){
'use strict';
const API_BASE='https://cebonk-xau-api.enggarprasetiyo330.workers.dev/xau';
const $=id=>document.getElementById(id);
const PIVOT_DEPTH=2,SL_BUFFER_ATR=0.15,ENTRY_HOLD_BARS=5;
let loading=false,lastRequest=0;
${helpers}
${calc}
const core=Object.freeze({sourceRef:'${REF}',sma,trendMA,atr,pivots,makeBuySetup,makeSellSetup,bestSetup,fibPrices,rr,calculate});
root.CebonkCombined1=core;if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(typeof document==='undefined')return;
${refresh}
${combined}
function clearDecision(reason){
 for(const id of ['comboDecision','comboStatus']){if($(id)){$(id).textContent='WAIT';$(id).className=id==='comboStatus'?'badge neutral':'neutral';}}
 for(const id of ['comboEntry','comboSL','comboTP1','comboTP2','comboTP3','comboRR1','comboRR2','comboRR3','comboEntryTime'])if($(id))$(id).textContent='—';
 if($('comboReason'))$('comboReason').textContent=reason;
 root.CEBONK_C1_STATE={mode:'COMBINED_1',decision:'WAIT',reason,executionEnabled:false,sourceRef:core.sourceRef};
}
function renderGuard(){
 if(!$('comboDecision'))return;
 const t=root.CEBONK_C1_TECH_STATE,a=root.CEBONK_ASTRO_STATE,now=Date.now();
 if(!t){clearDecision('Nunggu data anyar COMBINED 1.');return;}
 // Display-health guards only. Old MA/CB1/Fibo/ATR calculations remain verbatim.
 if(!Number.isFinite(t.lastMs)||now<t.lastMs||now-t.lastMs>300000||now-t.updatedMs>360000){clearDecision('DATA STALE — ora nampilke entry lawas.');return;}
 if(!a||!a.model||$('results')?.dataset.stale==='true'||$('dateInput')?.value!==a.iso||!$('modelEnabled')?.checked){clearDecision('Astrology durung siap / setelan wis berubah.');return;}
 const eventMs=Number.isFinite(t.entryMs)?t.entryMs:t.lastMs;
 const eventWindow=a.groups.find(g=>eventMs>=g.start&&eventMs<g.end),live=a.groups.find(g=>now>=g.start&&now<g.end);
 if(!eventWindow||!live||eventWindow.start!==live.start||eventWindow.state!==live.state){clearDecision('Window Astrology wis rampung / tanggal ora saiki.');return;}
 renderCombined();
 root.CEBONK_C1_STATE={mode:'COMBINED_1',decision:$('comboDecision').textContent,reason:$('comboReason').textContent,technical:t,sourceRef:core.sourceRef,executionEnabled:false};
}
function mount(){
 const view=$('combinedView');if(!view||$('c1Refresh'))return;
 view.innerHTML=${JSON.stringify(markup)};
 function show(){
  ['astroView','astroNewsView','combined2View'].forEach(id=>{if($(id))$(id).hidden=true;});view.hidden=false;$('technicalView').hidden=false;
  document.querySelectorAll('.viewtab').forEach(b=>b.classList.toggle('active',b.id==='tabCombined'));
  try{history.replaceState(null,'','#combined-1');}catch(e){}refreshTech();renderGuard();
 }
 $('tabCombined').addEventListener('click',show);
 $('c1Refresh').addEventListener('click',refreshTech);$('techRefresh').addEventListener('click',refreshTech);
 root.addEventListener('cebonk-c1-update',()=>{renderGuard();$('c1FeedStatus').textContent=$('techStatus').textContent;});
 root.addEventListener('cebonk-astro-update',renderGuard);
 for(const id of ['dateInput','modelEnabled','startMinute','tzMode'])$(id)?.addEventListener('change',renderGuard);
 setInterval(()=>{if(view.hidden||document.hidden)return;renderGuard();if($('techAuto').checked&&!loading&&Date.now()-lastRequest>=300000)refreshTech();},5000);
 if(location.hash==='#combined-1')show();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
`;
assert.ok(legacyModule.includes(helpers)&&legacyModule.includes(calculation));new Function(legacyModule);write('assets/combined1-legacy.js',legacyModule);
// Rename only the NEW system's container/tab. Preserve its entire numeric core.
let ui=read('assets/auto-combined-ui.js');
ui=ui.replace("['tabTechnical','tabCombined2','tabZones','technicalView','combined2View','pdfZonesView']","['tabTechnical','tabZones','pdfZonesView']");
ui=ui.replace(/'combinedView'/g,"'combined2View'").replace(/'tabCombined'/g,"'tabCombined2'").replace(/COMBINED 1/g,'COMBINED 2').replace('Three tabs only.','New system in its separate tab.');
ui=ui.replace("['#combined-1','#combined-2','#musang-pdf','#snr-snd']","['#combined-2','#musang-pdf','#snr-snd']");
ui=ui.replace("'#combined-1'","'#combined-2'");
ui=ui.replace("$('astroView').hidden=true;const news=", "$('astroView').hidden=true;if($('combinedView'))$('combinedView').hidden=true;const news=");
ui=ui.replace('root.CEBONK_AUTO_STATE={decision,event:r,coverage,errors:Object.fromEntries(errors),executionEnabled:false};','root.CEBONK_AUTO_STATE={mode:\'COMBINED_2\',decision,event:r,coverage,errors:Object.fromEntries(errors),executionEnabled:false};root.CEBONK_C2_STATE=root.CEBONK_AUTO_STATE;');
write('assets/auto-combined-ui.js',ui);
// Protect page identity: old Combined stays #combined-1; scanner becomes #combined-2.
const tab='<button class="viewtab" id="tabCombined" type="button">COMBINED 1</button>';
assert.ok(html.includes(tab));html=html.replace(tab,tab+'\n <button class="viewtab" id="tabCombined2" type="button">COMBINED 2</button>');
const sec='<section id="combinedView" hidden></section>';assert.ok(html.includes(sec));html=html.replace(sec,sec+'\n<section id="combined2View" hidden></section>');
html=html.replace('</body>','<script src="assets/combined1-legacy.js?v=1.0.0"></script>\n<script id="combinedSplitLoader" src="assets/combined-tabs.js?v=1.0.0"></script>\n</body>');
html=html.replace('assets/auto-combined-ui.js?v=3.1.0','assets/auto-combined-ui.js?v=3.1.0-split1');
write('index.html',html);
// Existing browser regression follows the new system under COMBINED 2.
let browser=read('tests/auto-combined.browser.cjs');
browser=browser.replace(/#combined-1/g,'#combined-2').replace(/#tabCombined(?!2)/g,'#tabCombined2').replace(/#combinedView/g,'#combined2View');
browser=browser.replace("['ASTROLOGY','COMBINED 1','ASTROLOGY NEWS']","['ASTROLOGY','COMBINED 1','COMBINED 2','ASTROLOGY NEWS']");
browser=browser.replace('#tabTechnical,#tabCombined2,#tabZones,#pdfZonesView,#technicalView','#tabTechnical,#tabZones,#pdfZonesView');
write('tests/auto-combined.browser.cjs',browser);
// Old installer cannot erase the restored tab on future runs.
for(const f of ['tools/install-auto-sop.cjs','tools/install-musang-pdf.cjs','tools/install-snd-auto.cjs']){
 if(!fs.existsSync(f))continue;let s=read(f);const gate="\nif(require('node:fs').readFileSync('index.html','utf8').includes('id=\"combinedSplitLoader\"')){console.log('COMBINED SPLIT PROTECTED: legacy install must not replace either mode.');process.exit(0);}\n";
 s=s.replace("'use strict';","'use strict';"+gate);write(f,s);
}
const record={restoredFrom:REF,legacyBlob:blob(old),helpersSHA256:hash(helpers),calculationSHA256:hash(calculation),newCoreSHA256:hash(read('assets/auto-combined-core.js')),locationCoreSHA256:hash(read('assets/snd-auto-core.js')),newsSHA256:hash(read('assets/astro-news-v1.js')),modes:{COMBINED_1:'Astrology + SMA20/50 M15/M5 + M1 CB1 touch',COMBINED_2:'Astrology + automatic MN1/W1/D1/H4/H1 SND/SNR fresh-first + Musang IB/CB1 break/retest'},executionEnabled:false};
write('archive/combined-mode-integrity.json',JSON.stringify(record,null,2)+'\n');
let sop=read('SOP_AUTO_COMBINED.md');sop=sop.replace(/COMBINED 1/g,'COMBINED 2').replace(/Combined 1/g,'Combined 2');
sop='> CURRENT ROUTING: this new-system SOP belongs to COMBINED 2 only. COMBINED 1 is restored from 3ead2e75 and must not be overwritten. Older scope notes below describe the earlier migration, not authorization to delete Combined 1.\n\n'+sop;write('SOP_AUTO_COMBINED.md',sop);
console.log('RESTORED ORIGINAL C1 CALCULATIONS; NEW ENGINE PRESERVED AS C2; NO EA OR CLOUDFLARE CHANGES.');
