/* CEBONK TECHNICAL SCANNERS UI v1.2.0. Web observation only; never sends an order. */
(function(root){
'use strict';
if(typeof document==='undefined')return;
const API='https://cebonk-xau-api.enggarprasetiyo330.workers.dev/xau',T=root.CebonkTechnicalScanners;
const intervals={M1:'1min',M5:'5min',M15:'15min',M30:'30min',H1:'1h',H4:'4h'},frames=Object.keys(intervals),cache=new Map(),errors=new Map();
const ttl={M1:65000,M5:65000,M15:120000,M30:180000,H1:300000,H4:600000},STORE='CEBONK.TECH.FEED.V1.';
let loading=false,lastScan=0,result=null,rr=2,buffer=.20,lastAutoSync=0;
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=x=>Number.isFinite(x)?x.toFixed(2):'—';
function wib(ms){return Number.isFinite(ms)?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms))+' WIB':'—';}
function parseTime(s){const v=String(s).trim();return Date.parse(v.endsWith('Z')?v:v.replace(' ','T')+'Z');}
function stepMs(tf){return (T.CFG.minutes[tf]||1)*60000;}
function expectedClosedEnd(tf,now=Date.now()){const step=stepMs(tf);return Math.floor(now/step)*step;}
function hasBoundaryBar(tf,x,now=Date.now()){const bars=x?.bars;if(!bars?.length)return false;return bars[bars.length-1].end>=expectedClosedEnd(tf,now);}
function usable(tf,now=Date.now()){const x=cache.get(tf);return !!x&&hasBoundaryBar(tf,x,now);}
function healthy(tf,now=Date.now()){const x=cache.get(tf);return !!x&&!errors.has(tf)&&now-x.fetched<ttl[tf]&&hasBoundaryBar(tf,x,now);}
function persist(tf,x){
 try{localStorage.setItem(STORE+tf,JSON.stringify({bars:x.bars,fetched:x.fetched,saved:Date.now()}));}catch(e){}
}
function restore(tf){
 if(cache.has(tf))return;
 try{
  const raw=localStorage.getItem(STORE+tf);if(!raw)return;
  const x=JSON.parse(raw);if(!Array.isArray(x?.bars)||x.bars.length<35||!Number.isFinite(x?.fetched)||!Number.isFinite(x?.saved)||Date.now()-x.saved>24*3600000)return;
  if(!x.bars.every(b=>[b.ms,b.end,b.open,b.high,b.low,b.close].every(Number.isFinite)))return;
  cache.set(tf,{bars:x.bars,fetched:x.fetched,persisted:true});
 }catch(e){}
}
function feedError(p,status){
 const base=p?.error||('HTTP_'+status),code=p?.providerCode??p?.code??p?.upstreamCode;
 return code===null||code===undefined||code===''?base:base+' ('+code+')';
}
function parse(payload,tf,now){
 if(!payload||payload.ok!==true||payload.symbol!=='XAU/USD'||payload.interval!==intervals[tf]||!Array.isArray(payload.values))throw new Error('FEED_SCHEMA');
 const step=T.CFG.minutes[tf]*60000,b=payload.values.map(v=>({ms:parseTime(v.datetime),open:+v.open,high:+v.high,low:+v.low,close:+v.close})).filter(x=>[x.ms,x.open,x.high,x.low,x.close].every(Number.isFinite)).map(x=>({...x,end:x.ms+step})).filter(x=>x.end<=now).sort((a,b)=>a.ms-b.ms);
 if(b.length<35)throw new Error('HISTORY_KURANG');const last=b[b.length-1];if(now-last.end>Math.max(step*2,10*60000))throw new Error('DATA_STALE');return b;
}
async function feed(tf,force=false){
 const now=Date.now();if(!force&&healthy(tf,now))return cache.get(tf).bars;const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
 try{
  const r=await fetch(API+'?interval='+intervals[tf]+'&outputsize=300',{cache:'no-store',signal:ctl.signal});
  let p={};try{p=await r.json();}catch(e){throw new Error('UPSTREAM_INVALID_JSON');}
  if(!r.ok||p.ok!==true)throw new Error(feedError(p,r.status));
  const bars=parse(p,tf,now),fetched=Date.parse(p.fetchedAtUtc)||now,last=bars[bars.length-1],expected=expectedClosedEnd(tf,now);
  const x={bars,fetched,degraded:p.degraded===true,upstreamError:p.upstreamError||'',upstreamCode:p.upstreamCode??null};
  cache.set(tf,x);persist(tf,x);
  if(last.end<expected)throw new Error('CANDLE_CLOSE_WAIT');
  if(p.degraded===true)errors.set(tf,feedError({error:p.upstreamError||'UPSTREAM_ERROR',providerCode:p.upstreamCode},200));
  else errors.delete(tf);
  return bars;
 }catch(e){
  const msg=e.name==='AbortError'?'TIMEOUT':e.message;errors.set(tf,msg);restore(tf);
  return usable(tf,now)?cache.get(tf).bars:null;
 }finally{clearTimeout(timer);}
}
function astro(){const a=root.CEBONK_ASTRO_STATE;if(!a||$('results')?.dataset.stale==='true'||$('dateInput')?.value!==root.CebonkCore?.Time?.today()||!$('modelEnabled')?.checked)return null;return a;}
function cls(s){return String(s||'WAIT').includes('BUY')?'buy':String(s||'WAIT').includes('SELL')?'sell':String(s||'WAIT')==='CONFLICT'?'transition':'neutral';}
function finalSummary(){
 const f=result?.final||'WAIT',a=astro()?.groups?.find(g=>Date.now()>=g.start&&Date.now()<g.end),b=result?.bbma?.filter(x=>x.status==='VALID')||[],l=result?.liquidity?.filter(x=>x.status==='VALID')||[];
 return `<section class="panel ts-final"><div class="head"><div><h2>FINAL TECHNICAL SIGNAL</h2><small>Astrology = arah + window. Siji package valid wis cukup.</small></div><span class="badge ${cls(f)}">${esc(f)}</span></div><div class="ts-summary"><div><small>ASTROLOGY</small><b class="${cls(a?.state)}">${esc(a?.state||'WAIT')}</b></div><div><small>BBMA</small><b>${b.length?esc(b.map(x=>x.package+' '+x.direction).join(' · ')):'WAIT'}</b></div><div><small>LIQUIDITY</small><b>${l.length?esc(l.map(x=>x.package+' '+x.direction).join(' · ')):'WAIT'}</b></div><div><small>ALASAN</small><b>${esc(result?.reason||'WAIT')}</b></div></div></section>`;
}
function packageCard(x,type){
 const labels=type==='BBMA'?[x.tf1Label||'RE-ENTRY WAIT',x.tf2Label||'CSAK/CSM WAIT',x.tf3Label||'CSM WAIT']:[x.tf1Label||'LIQUIDITY MAP WAIT',x.tf2Label||'SWEEP/BREAK WAIT',x.tf3Label||'RETEST WAIT'];
 return `<article class="ts-card"><div class="ts-cardhead"><b>${esc(x.package)}</b><span class="badge ${cls(x.status==='VALID'?x.direction:x.status)}">${esc(x.status==='VALID'?x.direction:x.status)}</span></div><div class="ts-steps"><span>TF1 · ${esc(labels[0])}</span><span>TF2 · ${esc(labels[1])}</span><span>TF3 · ${esc(labels[2])}</span></div><div class="ts-prices"><span>ENTRY <b>${num(x.entry)}</b></span><span>SL <b>${num(x.sl)}</b></span><span>TP <b>${num(x.tp)}</b></span><span>RR <b>${Number.isFinite(x.rr)?'1:'+x.rr.toFixed(2):'—'}</b></span></div><small>${esc(x.status==='VALID'?'VALID · '+wib(x.eventAt):x.reason||'WAIT')}</small></article>`;
}
function frameHealth(){
 return frames.map(tf=>{
  const ok=healthy(tf),fallback=!ok&&usable(tf),kind=ok?'buy':fallback?'transition':'sell';
  const label=ok?'OK':fallback?'CACHE · '+(errors.get(tf)||'UPSTREAM WAIT'):(errors.get(tf)||'WAIT');
  return `<span class="badge ${kind}">${tf} ${esc(label)}</span>`;
 }).join(' ');
}
function render(){
 if(!result)return;const b=$('bbmaScannerBody'),l=$('liquidityScannerBody');if(!b||!l)return;
 const controls=`<div class="ts-controls"><label>RR <input class="tsRR" type="number" min="1" max="5" step="0.25" value="${rr}"></label><label>SL buffer XAU <input class="tsBuffer" type="number" min="0" max="20" step="0.05" value="${buffer}"></label><button class="tsRefresh primary" type="button">REFRESH SCANNER</button></div><div class="ts-feed">${frameHealth()}<small>Update ${wib(Date.now())}</small></div>`;
 b.innerHTML=controls+finalSummary()+`<div class="note"><strong>BBMA:</strong> TF1 wajib RE-ENTRY → TF2 CSAK/CSM → TF3 CSM. Closed candle. SL Top/Low BB TF2 + buffer · TP RR.</div><div class="ts-grid">${result.bbma.map(x=>packageCard(x,'BBMA')).join('')}</div><div class="tech-warn">Cut Profit rule: mulai +1R; exit yen CSM TF3 lawan utawa TF2 close lawan Mid BB. Scanner web iki ora ngirim order.</div>`;
 l.innerHTML=controls+finalSummary()+`<div class="note"><strong>Liquidity:</strong> TF1 map swing/equal liquidity → TF2 sweep + displacement + structure break → TF3 retest. Closed candle.</div><div class="ts-grid">${result.liquidity.map(x=>packageCard(x,'LIQ')).join('')}</div>`;
 for(const view of [b,l]){const r=view.querySelector('.tsRefresh');if(r)r.addEventListener('click',scan);const ri=view.querySelector('.tsRR'),bi=view.querySelector('.tsBuffer');if(ri)ri.addEventListener('change',()=>{rr=Math.max(1,Math.min(5,+ri.value||2));render();});if(bi)bi.addEventListener('change',()=>{buffer=Math.max(0,Math.min(20,+bi.value||0));render();});}
}
function rescanCached(){
 const now=Date.now(),data={};for(const tf of frames)if(usable(tf,now))data[tf]=cache.get(tf).bars;
 result=T.scanAll(data,astro(),now,{rr,slBuffer:buffer});root.CEBONK_TECHNICAL_SCANNER_STATE=result;render();
}
async function scan(){
 if(loading)return;if(Date.now()-lastScan<60000){document.querySelectorAll('.ts-status').forEach(x=>x.textContent='Tunggu 60 detik antar refresh manual. Auto close-sync tetep aktif.');return;}
 loading=true;lastScan=Date.now();document.querySelectorAll('.ts-status').forEach(x=>x.textContent='Ngambil M1/M5/M15/M30/H1/H4…');
 try{for(const tf of frames)await feed(tf,true);rescanCached();document.querySelectorAll('.ts-status').forEach(x=>x.textContent='Scan rampung · '+wib(Date.now()));}catch(e){document.querySelectorAll('.ts-status').forEach(x=>x.textContent='SCAN ERROR: '+e.message);}finally{loading=false;}
}
async function syncClosedFrames(){
 if(loading)return;const now=Date.now();if(now-lastAutoSync<15000)return;lastAutoSync=now;
 const due=frames.filter(tf=>!healthy(tf,now));
 if(!due.length){if(result)rescanCached();return;}
 loading=true;document.querySelectorAll('.ts-status').forEach(x=>x.textContent='Sinkron candle close: '+due.join('/')+'…');
 try{
  for(const tf of due)await feed(tf,true);
  rescanCached();
  const blocked=frames.filter(tf=>!usable(tf)).map(tf=>tf+':'+(errors.get(tf)||'WAIT'));
  const degraded=frames.filter(tf=>usable(tf)&&!healthy(tf)).map(tf=>tf+':'+(errors.get(tf)||'CACHE'));
  const status=blocked.length?'Nunggu close feed · '+blocked.join(' · '):degraded.length?'Pakai cache valid · '+degraded.join(' · '):'Close-sync rampung · '+wib(Date.now());
  document.querySelectorAll('.ts-status').forEach(x=>x.textContent=status);
 }catch(e){document.querySelectorAll('.ts-status').forEach(x=>x.textContent='AUTO SYNC ERROR: '+e.message);}finally{loading=false;}
}
function mount(){
 if(!T||$('bbmaScannerView'))return;for(const tf of frames)restore(tf);const nav=document.querySelector('.viewtabs'),wrap=document.querySelector('main.wrap');if(!nav||!wrap)return;
 const style=document.createElement('style');style.textContent=`.viewtabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.ts-view{margin-top:0}.ts-hero{margin-bottom:14px}.ts-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap;padding:14px;background:var(--panel);border:1px solid var(--line);border-radius:10px;margin-bottom:10px}.ts-controls label{font-size:11px;color:var(--muted)}.ts-controls input{display:block;width:125px;margin-top:4px}.ts-feed{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 12px}.ts-feed small{margin-left:auto;color:var(--muted)}.ts-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line)}.ts-summary>div{background:var(--panel);padding:13px}.ts-summary small{display:block;color:var(--muted);font-size:10px}.ts-summary b{display:block;margin-top:5px;overflow-wrap:anywhere}.ts-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ts-card{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:13px;min-width:0}.ts-cardhead{display:flex;justify-content:space-between;gap:8px}.ts-steps{display:grid;gap:5px;margin:11px 0;font-size:12px;color:var(--muted)}.ts-prices{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.ts-prices span{background:var(--panel2);padding:7px;border-radius:7px;font-size:10px}.ts-prices b{display:block;font-size:14px}.ts-card>small{color:var(--muted);overflow-wrap:anywhere}@media(max-width:760px){.viewtabs{grid-template-columns:repeat(2,minmax(0,1fr))}.ts-grid{grid-template-columns:1fr}.ts-summary{grid-template-columns:1fr 1fr}.ts-prices{grid-template-columns:1fr 1fr}.ts-controls>*{flex:1}.ts-controls button{width:100%}.ts-feed small{width:100%;margin-left:0}}`;document.head.appendChild(style);
 const footer=wrap.querySelector('footer');for(const [id,title,tagline] of [['bbmaScannerView','SCANNER BBMA','TF1 RE-ENTRY · TF2 CSAK/CSM · TF3 CSM'],['liquidityScannerView','SCANNER LIQUIDITY SWEEP','TF1 liquidity map · TF2 sweep/break · TF3 retest']]){const v=document.createElement('section');v.id=id;v.className='ts-view';v.hidden=true;v.innerHTML=`<header class="hero ts-hero"><div><div class="eyebrow">SEKTE MUSANG · TECHNICAL</div><h2>${title}</h2><p>${tagline} · Astrology master arah & window.</p></div><span class="version">v${T.CFG.version}</span></header><div class="ts-status">Belum scan.</div><div id="${id==='bbmaScannerView'?'bbmaScannerBody':'liquidityScannerBody'}"></div>`;footer?footer.before(v):wrap.appendChild(v);}
 const tabs={tabAstro:'astroView',tabBBMA:'bbmaScannerView',tabLiquidity:'liquidityScannerView',tabAstroNews:'astroNewsView'};
 function show(id,hash){for(const view of ['astroView','bbmaScannerView','liquidityScannerView','astroNewsView'])if($(view))$(view).hidden=view!==id;nav.querySelectorAll('.viewtab').forEach(b=>b.classList.toggle('active',tabs[b.id]===id));if(hash)try{history.replaceState(null,'','#'+hash);}catch(e){}if(id==='bbmaScannerView'||id==='liquidityScannerView'){if(!result||Date.now()-lastScan>=60000)scan();else render();}}
 $('tabAstro')?.addEventListener('click',()=>show('astroView','astrology'));$('tabBBMA')?.addEventListener('click',()=>show('bbmaScannerView','bbma-scanner'));$('tabLiquidity')?.addEventListener('click',()=>show('liquidityScannerView','liquidity-scanner'));
 nav.addEventListener('click',e=>{if(e.target.closest('#tabAstroNews')){for(const id of ['bbmaScannerView','liquidityScannerView'])$(id).hidden=true;}});
 root.addEventListener('cebonk-astro-update',()=>{if(result)rescanCached();});
 setInterval(syncClosedFrames,15000);
 if(location.hash==='#bbma-scanner')show('bbmaScannerView','bbma-scanner');else if(location.hash==='#liquidity-scanner')show('liquidityScannerView','liquidity-scanner');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
