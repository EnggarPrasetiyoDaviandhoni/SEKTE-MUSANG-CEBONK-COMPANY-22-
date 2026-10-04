/* COMBINED 1 AUTO. Three tabs only. No manual price/review forms. */
(function(root){
'use strict';
function mount(){
 const A=root.CebonkAuto,C=root.CebonkCore,$=id=>document.getElementById(id),nav=document.querySelector('.viewtabs'),view=$('combinedView');
 if(!A||!C||!nav||!view||$('autoRun'))return;
 ['tabTechnical','tabCombined2','tabZones','technicalView','combined2View','pdfZonesView'].forEach(id=>$(id)?.remove());
 $('tabCombined').textContent='COMBINED 1';
 view.innerHTML=`<header class="au-hero"><div class="eyebrow">SEKTE MUSANG · CEBONK COMPANY 22</div><h2>COMBINED 1 · AUTO</h2><span class="badge neutral">v3.0.0</span><p>ASTROLOGY → SNR/SND + KEY LEVEL → FIBO MUSANG</p><small>Tanpa isi zona manual. Model eksperimen + otomasi Level 2; dudu order MT5.</small></header>
 <section class="panel"><div class="au-toolbar"><label>TF eksekusi <select id="autoTF"><option>M1</option><option>M5</option><option>M15</option></select></label><button id="autoRun" class="primary" type="button">PERBARUI SCAN</button><label class="check"><input id="autoRefresh" type="checkbox" checked>Auto 5 menit</label></div><p id="autoStatus" class="au-status" role="status">Pilih COMBINED 1 kanggo miwiti scanner otomatis.</p><p id="autoWarning" class="au-warning" hidden></p></section>
 <section class="au-decision panel" aria-live="polite"><span class="label">KEPUTUSAN</span><strong id="autoDecision">WAIT</strong><p id="autoReason">Nunggu data.</p><small id="autoStamp">—</small></section>
 <div class="au-grid"><section class="panel au-card"><span class="label">ASTROLOGY · HARI INI WIB</span><strong id="autoAstro">—</strong><small id="autoWindow">—</small></section><section class="panel au-card"><span class="label">LOKASI AKTIF</span><strong id="autoLocation">—</strong><small id="autoKey">—</small></section><section class="panel au-card"><span class="label">FIBO MUSANG</span><strong id="autoMusang">—</strong><small id="autoIB">IB → CB1 break → retest Zone IB</small></section><section class="panel au-card"><span class="label">ENTRY / SL</span><strong id="autoEntry">—</strong><small id="autoSL">—</small></section></div>
 <section class="panel"><div class="head"><h3>TARGET FIBO</h3><small>RR saka jarak nyata</small></div><div class="au-targets" id="autoTargets"><p>—</p></div></section>
 <section class="panel"><div class="head"><h3>SCAN MN1 → W1 → D1 → H4 → H1</h3><small id="autoCoverage">0/5 TF</small></div><div id="autoFrames" class="au-frames"></div><div class="footnote">TF sing gagal ora diganti data rekaan. Cakupan parsial ditandai; lokasi saka TF sing datane valid isih dipriksa.</div></section>
 <section class="panel"><div class="head"><h3>ZONA OTOMATIS PALING CEDHAK</h3><small>Prioritas FRESH → TESTED 1x</small></div><div id="autoZones" class="au-zones">Durung ana data.</div></section>
 <details><summary>Audit struktur & aturan otomasi</summary><p>Eksekusi subset PDF Level 2: initial one-to-one body break → Zone IB beda saka CB1 → CB1 close break → retest ing candle sabanjure. Ora ana CB1 direct-entry, MA20/50, RSI utawa ATR.</p><p>Detektor numerik nggunakake pivot 2 candle kiwa/tengen; SND base maksimal 4 candle, rasio body ≤50%, departure body ≥65% lan range ≥1.5× rata-rata base. Iki engineering otomasi, dudu rumus eksplisit PDF. Hidden Engulfing lan kabeh Level 1–9 ora diklaim wis diotomasi.</p><p>Key level saka high/low periode D1/W1/MN1 rampung lan swing terkonfirmasi. Key kudu ing zona ±10% lebar zona, ora sumber candle zona sing padha. Nested/confluence mung kanggo ranking; dudu trigger. BROKEN lan TESTED luwih saka 1x ora dienggo arah lawas.</p><p>Fibo 0 saka body zona sing dipatahke; 100 saka close CB1 break. Anchor dikunci sawise break; SL njaba wick zona + buffer 5% lebar body. Target 1.618 / 2.618 / 4.23. Aturan angka iki bisa dites, ora jaminan padanan kabeh conto PDF.</p><p>Astrology nggunakake CebonkCore lawas, otomatis tanggal saiki WIB, rentang 06:00–00:00. Tanggal histori ing tab Astrology ora dadi sinyal live. Model arah durung divalidasi. News tetep planner kapisah.</p><p>Data Twelve Data XAU/USD ora mesthi padha NOZAX XAUUSDc. Candle durung tutup ora konfirmasi. Refresh 5 menit bisa kelewatan sinyal M1; sinyal kedaluwarsa ing candle sabanjure. Ora ana order/Telegram saka web.</p><pre id="autoAudit">—</pre></details>
 <details id="autoBackend"><summary>API timeframe gedhe / upgrade Worker</summary><p>API lawas durung mbukak D1/W1/MN1. Kode upgrade wis disiapke ing repository. Sapisan tempel kode iki ing Cloudflare Worker cebonk-xau-api → Deploy. Secret TWELVE_DATA_KEY tetep; ojo dilebokke neng GitHub/chat.</p><button type="button" id="autoCopyWorker">SALIN KODE WORKER UPGRADE</button><textarea id="autoWorkerText" readonly hidden aria-label="Kode Worker tanpa API key"></textarea><p id="autoWorkerStatus"></p></details>`;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=x=>Number.isFinite(x)?x.toFixed(3):'—';
 const wib=t=>Number.isFinite(t)?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(t)+' WIB':'—';
 const API='https://cebonk-xau-api.enggarprasetiyo330.workers.dev/xau';
 const cache=new Map(),errors=new Map();let loading=false,attempt=0,lastPoll=0,lastRenderedMinute=-1,astro=null,astroDay='',lastResult=null,lastDecision=null;
 const keep={M1:65000,M5:65000,M15:65000,H1:30*60000,H4:60*60000,D1:6*3600000,W1:12*3600000,MN1:24*3600000};
 async function feed(tf){
  const c=cache.get(tf),now=Date.now();if(c&&now-c.fetched<keep[tf])return c;
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
  try{
   const interval=A.CFG.frames[tf],size=tf==='MN1'?120:tf==='M1'?500:300;
   const res=await fetch(API+'?interval='+interval+'&outputsize='+size,{signal:abort.signal,cache:'no-store'}),data=await res.json();
   if(!res.ok||data.ok!==true)throw new Error(data.error==='INVALID_INTERVAL'?'API_PERLU_UPGRADE':(data.error||'HTTP_'+res.status));
   const b=A.parse(data,tf,now);if(b.length<30)throw new Error('HISTORY_KURANG_30');
   const maxAge=A.CFG.minutes[tf]?2*A.CFG.minutes[tf]*60000:({D1:5,W1:15,MN1:62}[tf])*86400000;
   if(now-b[b.length-1].end>maxAge)throw new Error('DATA_STALE');
   const obj={b,fetched:now,provider:data.provider||'Twelve Data'};cache.set(tf,obj);errors.delete(tf);return obj;
  }catch(e){cache.delete(tf);errors.set(tf,e.name==='AbortError'?'TIMEOUT':e.message);throw e;}finally{clearTimeout(timer);}
 }
 async function astrology(){
  const day=C.Time.today();if(astro&&astroDay===day)return astro;
  if(!root.Astronomy)for(let i=0;i<40&&!root.Astronomy;i++)await new Promise(r=>setTimeout(r,250));
  if(!root.Astronomy)throw new Error('ASTRONOMY_LIBRARY_DURUNG_SIAP');
  const rows=await C.scan(C.createEngine(root.Astronomy),day,360,true);
  astro={model:true,iso:day,groups:C.segments(rows)};astroDay=day;return astro;
 }
 function invalidate(reason){lastDecision={decision:'WAIT',reason,executionEnabled:false};$('autoDecision').textContent='WAIT';$('autoDecision').className='neutral';$('autoReason').textContent=reason;$('autoEntry').textContent='—';$('autoSL').textContent='—';$('autoTargets').innerHTML='<p>—</p>';}
 function allMaps(at){
  let zs=[],ks=[];for(const tf of A.CFG.context){const c=cache.get(tf);if(!c||errors.has(tf))continue;zs.push(...A.zones(c.b,tf,at));ks.push(...A.keys(c.b,tf,at));}return {zs,ks};
 }
 function render(){
  lastRenderedMinute=Math.floor(Date.now()/60000);
  const now=Date.now(),tf=$('autoTF').value,entryData=cache.get(tf),b=entryData?.b||[],last=b[b.length-1],step=A.CFG.minutes[tf]*60000;
  const coverage=A.CFG.context.filter(x=>cache.has(x)&&!errors.has(x));
  $('autoCoverage').textContent=coverage.length+'/5 TF'+(coverage.length<5?' · PARSIAL':'');
  $('autoFrames').innerHTML=A.CFG.context.map(t=>{const d=cache.get(t);return '<div><b>'+t+'</b><span>'+esc(errors.get(t)||(d?d.b.length+' candle tutup':'MENUNGGU'))+'</span></div>';}).join('');
  const fresh=!!last&&!errors.has(tf)&&now>=last.end&&now-last.end<2*step;
  const r=b.length?A.musang(b,tf,now):{stage:'NO_DATA',reason:'Nunggu candle '+tf+'.'},at=r.eventStart||now;
  const maps=allMaps(at),direction=r.setup?.direction,price=r.entry??last?.close;
  const ctx=A.context(maps.zs,maps.ks,direction,price,at),decision=A.combine(r,astro,ctx,now,fresh,coverage);lastResult=r;lastDecision=decision;
  $('autoDecision').textContent=decision.decision;$('autoDecision').className=decision.decision.endsWith('BUY')?'buy':decision.decision.endsWith('SELL')?'sell':'neutral';
  $('autoReason').textContent=decision.reason;
  $('autoAstro').textContent=decision.astro||'WAIT';$('autoAstro').className=decision.astro==='BUY'?'buy':decision.astro==='SELL'?'sell':'neutral';
  $('autoWindow').textContent=decision.window?wib(decision.window.start)+' → '+wib(decision.window.end):'Astrology saiki WIB';
  $('autoMusang').textContent=r.stage;$('autoIB').textContent=r.setup?'CB1 '+fmt(r.setup.cb1)+' · Zone IB '+fmt(r.setup.zone.low)+' – '+fmt(r.setup.zone.high):'IB → CB1 break → retest Zone IB';
  $('autoLocation').textContent=ctx.selected?ctx.selected.tf+' '+ctx.selected.kind:'WAIT LOKASI';
  $('autoKey').textContent=ctx.selected?ctx.selected.keys.map(k=>k.label+' '+fmt(k.price)).slice(0,2).join(' · '):'Butuh zone aktif + key level searah';
  const entry=decision.decision.startsWith('ENTRY');$('autoEntry').textContent=entry?fmt(r.entry):'—';$('autoSL').textContent=entry?'SL '+fmt(r.sl)+' · '+wib(r.eventAt):'—';
  $('autoTargets').innerHTML=entry?r.targets.map((t,i)=>'<div><small>TP'+(i+1)+' · '+t.ratio+'</small><b>'+fmt(t.price)+'</b><small>RR 1:'+t.rr.toFixed(2)+'</small></div>').join(''):'<p>Nunggu sinyal lengkap; ora nampilke target entry lawas.</p>';
  const current=allMaps(now);const nearest=current.zs.sort((a,z)=>Math.abs((a.low+a.high)/2-(last?.close||0))-Math.abs((z.low+z.high)/2-(last?.close||0))).slice(0,14);
  $('autoZones').innerHTML=nearest.length?nearest.map(z=>{const c=A.context(current.zs,current.ks,A.side(z),(z.low+z.high)/2,now).candidates.find(x=>x.id===z.id);return '<div class="au-zone"><b>'+z.tf+' '+z.kind+' <span class="badge '+(z.status==='BROKEN'?'sell':'neutral')+'">'+z.status+(z.tests?' '+z.tests+'x':'')+'</span></b><strong>'+fmt(z.low)+' – '+fmt(z.high)+'</strong><small>'+z.formation+' · '+esc(c?.nested.length?'Nested '+c.nested.join('/'):'Ora nested')+' · '+esc(c?.keys.length?'Key '+c.keys[0].label:'Key durung cocok')+(z.tests>1?' · SKIP':'')+'</small></div>';}).join(''):'Durung ana zona saka data sing valid.';
  const incomplete=coverage.length<5,upgrade=[...errors.values()].includes('API_PERLU_UPGRADE');
  $('autoWarning').hidden=!incomplete;$('autoWarning').textContent=upgrade?'CAKUPAN PARSIAL: Worker lawas durung mbukak D1/W1/MN1. Upgrade Worker sapisan nganggo kode sing wis disiapke. Ora perlu isi harga manual.':incomplete?'CAKUPAN PARSIAL: sawetara TF durung valid. Delok status saben TF ing ngisor.':'';
  $('autoStamp').textContent='Candle '+tf+' '+wib(last?.ms)+' · '+(fresh?'OHLC TERBARU':'STALE / PASAR TUTUP / DATA KURANG');
  $('autoAudit').textContent=JSON.stringify({version:A.CFG.version,decision,stage:r.stage,setup:r.setup||null,eventAt:r.eventAt||null,expiresAt:r.expiresAt||null,coverage,errors:Object.fromEntries(errors),lastCandle:last?.ms,executionEnabled:false},null,2);
  root.CEBONK_AUTO_STATE={decision,event:r,coverage,errors:Object.fromEntries(errors),executionEnabled:false};
 }
 async function scan(){
  if(loading)return;if(Date.now()-attempt<65000){$('autoStatus').textContent='Tunggu 65 detik antar refresh supaya irit kuota.';return;}
  loading=true;attempt=Date.now();lastPoll=attempt;$('autoRun').disabled=true;invalidate('Nganyari data; ora nggunakake entry lawas.');$('autoStatus').textContent='Scan otomatis '+$('autoTF').value+' + MN1/W1/D1/H4/H1…';
  try{
   const task=astrology().catch(e=>{astro=null;astroDay='';errors.set('ASTRO',e.message);});
   await Promise.allSettled([...new Set([$('autoTF').value,...A.CFG.context])].map(feed));await task;
   if(astro)errors.delete('ASTRO');render();$('autoStatus').textContent='Scan rampung · '+wib(Date.now())+' · Sinyal iku pengamatan, dudu fill/order.';
  }catch(e){invalidate('SCAN ERROR: '+e.message);}finally{loading=false;$('autoRun').disabled=false;}
 }
 function showCombined(){
  $('astroView').hidden=true;const news=$('astroNewsView');if(news)news.hidden=true;view.hidden=false;
  nav.querySelectorAll('.viewtab').forEach(b=>b.classList.toggle('active',b.id==='tabCombined'));
  try{history.replaceState(null,'','#combined-1');}catch(e){}if(!loading&&Date.now()-lastPoll>=65000)scan();else render();
 }
 $('tabCombined').addEventListener('click',showCombined);
 $('tabAstro').addEventListener('click',()=>{view.hidden=true;$('astroView').hidden=false;nav.querySelectorAll('.viewtab').forEach(b=>b.classList.toggle('active',b.id==='tabAstro'));try{history.replaceState(null,'','#astrology');}catch(e){}});
 $('autoRun').addEventListener('click',scan);$('autoTF').addEventListener('change',()=>{invalidate('TF diganti. Nunggu scan anyar.');scan();});
 $('autoCopyWorker').addEventListener('click',async()=>{try{const res=await fetch('cloudflare-worker.js?auto-sop=3.0.0');if(!res.ok)throw new Error('Ora bisa muat kode');const txt=await res.text();if(!txt.includes('AUTO_SOP_API_V3'))throw new Error('Kode upgrade durung kasedhiya');try{await navigator.clipboard.writeText(txt);$('autoWorkerStatus').textContent='Kode tersalin. Paste neng Worker lawas → Deploy. Secret ora diganti.';}catch(e){$('autoWorkerText').hidden=false;$('autoWorkerText').value=txt;$('autoWorkerText').select();$('autoWorkerStatus').textContent='Salin kode ing kotak iki; ora ana token rahasia.';}}catch(e){$('autoWorkerStatus').textContent=e.message;}});
 setInterval(()=>{if(view.hidden)return;if(!loading&&lastDecision&&Math.floor(Date.now()/60000)!==lastRenderedMinute)render();if($('autoRefresh').checked&&!loading&&Date.now()-lastPoll>=300000&&document.visibilityState==='visible')scan();},1000);
 if(['#combined-1','#combined-2','#musang-pdf','#snr-snd'].includes(location.hash))showCombined();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
