/* CEBONK ASTROLOGY DAILY BRIEF v1.0.0
   Read-only daily projection of legacy Astrology + Astrology News snapshot.
   Does NOT change CebonkCore, legacy Astrology groups, scanner gates, EA, or news direction rules.
*/
(function(root){
'use strict';
const MIN=60000,HOUR=60*MIN,WIB=7*HOUR,VERSION='1.0.0';
const CFG=Object.freeze({
  whipsawPadMinutes:5,
  newsPre:30,
  newsPost:120,
  newsBlockBefore:5,
  newsBlockAfter:5,
  newsEntrySpan:10,
  newsMinWindow:15
});
const side=s=>s==='BUY'||s==='SELL';
const finite=x=>Number.isFinite(x);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function wibDate(ms){return new Date(ms+WIB).toISOString().slice(0,10);}
function hm(ms){return new Date(ms+WIB).toISOString().slice(11,16);}
function range(a,b){return hm(a)+'–'+hm(b)+' WIB';}
function tone(s){return s==='BUY'?'buy':s==='SELL'?'sell':s==='TRANSITION'?'transition':'neutral';}
function life(a,b,now=Date.now()){return now>=a&&now<b?'ACTIVE':now>=b?'SELESAI':'NANTI';}
function mergeWindows(items){
  const src=items.filter(x=>finite(x.start)&&finite(x.end)&&x.end>x.start).sort((a,b)=>a.start-b.start);
  const out=[];
  for(const x of src){
    const last=out[out.length-1];
    if(last&&x.start<=last.end){
      last.end=Math.max(last.end,x.end);
      if(!last.reasons.includes(x.reason))last.reasons.push(x.reason);
    }else out.push({start:x.start,end:x.end,reasons:[x.reason]});
  }
  return out;
}
function dailySignals(state){
  if(!state||!Array.isArray(state.groups))return [];
  return state.groups.filter(g=>side(g.state)&&finite(g.start)&&finite(g.end)).map(g=>({
    dir:g.state,start:g.start,end:g.end,best:g.best?.ms??null,duration:(g.end-g.start)/MIN
  }));
}
function astrologyWhipsaw(state,padMinutes=CFG.whipsawPadMinutes){
  if(!state||!Array.isArray(state.groups))return [];
  const pad=Math.max(0,padMinutes)*MIN,raw=[];
  for(const g of state.groups){
    if(g.state==='TRANSITION')raw.push({start:g.start,end:g.end,reason:'TRANSITION MODEL'});
  }
  for(let i=1;i<state.groups.length;i++){
    const a=state.groups[i-1],b=state.groups[i];
    if(side(a.state)&&side(b.state)&&a.state!==b.state){
      const t=b.start;raw.push({start:t-pad,end:t+pad,reason:'GANTI '+a.state+' → '+b.state});
    }
  }
  return mergeWindows(raw);
}
function newsForDate(calendar,iso){
  return (Array.isArray(calendar)?calendar:[]).filter(e=>finite(e.ms)&&wibDate(e.ms)===iso).slice().sort((a,b)=>a.ms-b.ms);
}
function newsConfig(event){
  return {
    id:event.id||('news-'+event.ms),
    name:event.name||'NEWS',
    releaseMs:event.ms,
    source:event.source||'',
    pre:CFG.newsPre,
    post:CFG.newsPost,
    blockBefore:CFG.newsBlockBefore,
    blockAfter:CFG.newsBlockAfter,
    entrySpan:CFG.newsEntrySpan,
    minWindow:CFG.newsMinWindow,
    confirmed:true,
    otherRisk:true
  };
}
async function newsPlan(event,C,A,N,calendar){
  if(!N||typeof N.calculate!=='function'||!C||!A)return null;
  return N.calculate(C,A,newsConfig(event),calendar||[],()=>{},()=>false);
}
function signalHtml(x,now){
  return '<div class="adb-row"><div><span class="badge '+tone(x.dir)+'">'+x.dir+'</span> <b>'+range(x.start,x.end)+'</b></div>'+
    '<small>'+life(x.start,x.end,now)+' · '+Math.round(x.duration)+' menit'+(finite(x.best)?' · inti '+hm(x.best)+' WIB':'')+'</small></div>';
}
function warningHtml(x,now,label='AWAS WHIPSAW'){
  return '<div class="adb-row adb-warn"><div><b>⚠ '+esc(label)+'</b> <span class="mono">'+range(x.start,x.end)+'</span></div>'+
    '<small>'+life(x.start,x.end,now)+' · '+esc((x.reasons||[]).join(' + '))+'</small></div>';
}
function newsBaseHtml(e,now){
  const a=e.ms-CFG.newsBlockBefore*MIN,b=e.ms+CFG.newsBlockAfter*MIN;
  return '<div class="adb-news" data-news="'+esc(e.id||String(e.ms))+'">'+
    '<div class="adb-news-head"><div><b>'+esc(e.name)+'</b><small>Release '+hm(e.ms)+' WIB · '+esc(e.agency||'snapshot')+'</small></div>'+
    '<span class="badge transition">'+life(a,b,now)+'</span></div>'+
    '<div class="adb-row adb-warn"><div><b>⚠ AWAS WHIPSAW NEWS</b> <span class="mono">'+range(a,b)+'</span></div>'+
    '<small>Buffer risiko default ±5 menit saka release; dudu ramalan spike.</small></div>'+
    '<div class="adb-news-plan"><small>Ngitung Astrology News…</small></div></div>';
}
function coverageText(state){
  if(!state?.samples?.length)return '—';
  const first=state.samples[0],last=state.samples[state.samples.length-1],step=(root.CebonkCore?.CFG?.step||5)*MIN;
  return range(first.ms,last.ms+step);
}
async function render(state){
  const host=document.getElementById('astroDailyBrief');if(!host)return;
  const token=String(Date.now())+'-'+Math.random();host.dataset.job=token;
  const stale=document.getElementById('results')?.dataset.stale==='true';
  if(!state||!Array.isArray(state.samples)||!state.samples.length||stale){
    host.querySelector('#adbSignals').innerHTML='<div class="empty">Belum ada hasil Astrology valid.</div>';
    host.querySelector('#adbWhipsaw').innerHTML='<div class="empty">—</div>';
    host.querySelector('#adbNews').innerHTML='<div class="empty">—</div>';
    host.querySelector('#adbMeta').textContent='Menunggu perhitungan Astrology lawas.';
    return;
  }
  const now=Date.now(),signals=dailySignals(state),warn=astrologyWhipsaw(state);
  host.querySelector('#adbDate').textContent=state.iso+' WIB';
  host.querySelector('#adbSignals').innerHTML=signals.length?signals.map(x=>signalHtml(x,now)).join(''):'<div class="empty">Ora ana window BUY/SELL ing rentang scan iki.</div>';
  host.querySelector('#adbWhipsaw').innerHTML=warn.length?warn.map(x=>warningHtml(x,now)).join(''):'<div class="empty">Ora ana TRANSITION / ganti arah langsung ing rentang scan iki.</div>';
  host.querySelector('#adbMeta').textContent='Coverage Astrology lawas: '+coverageText(state)+' · warning whipsaw = transition/ganti arah model, dudu kepastian pasar.';

  const N=root.CebonkNews,calendar=N?.CALENDAR||[],events=newsForDate(calendar,state.iso);
  if(!events.length){
    host.querySelector('#adbNews').innerHTML='<div class="empty">NEWS HARI IKI: ora ana event ing snapshot Astrology News sing saiki dimuat. Iki dudu klaim kalender ekonomi lengkap.</div>';
    return;
  }
  host.querySelector('#adbNews').innerHTML=events.map(e=>newsBaseHtml(e,now)).join('');
  const C=root.CebonkCore,A=root.Astronomy;
  await Promise.all(events.map(async e=>{
    let plan=null,error='';
    try{plan=await newsPlan(e,C,A,N,calendar);}catch(err){error=err?.message||String(err);}
    if(host.dataset.job!==token)return;
    const box=host.querySelector('[data-news="'+CSS.escape(e.id||String(e.ms))+'"] .adb-news-plan');if(!box)return;
    if(!plan){
      box.innerHTML='<small>ASTROLOGY NEWS: '+esc(error||'data astronomi durung siap')+'. Bukak tab ASTROLOGY NEWS kanggo hitung manual.</small>';return;
    }
    const first=plan.windows?.[0],focus=plan.focus||'NEUTRAL';
    if(focus==='NEUTRAL'||!first){
      box.innerHTML='<div class="adb-row"><div><b>ASTROLOGY NEWS: WAIT / NEUTRAL</b></div><small>Ora ana window arah tunggal sing lolos policy Astrology News.</small></div>';return;
    }
    box.innerHTML='<div class="adb-row"><div><span class="badge '+tone(focus)+'">ASTROLOGY NEWS '+esc(focus)+'</span></div>'+
      '<small>Kandidat entry '+range(first.start,first.entryEnd)+' · window '+range(first.start,first.end)+' · inti '+hm(first.peak)+' WIB</small></div>';
  }));
}
function mount(){
  if(typeof document==='undefined'||document.getElementById('astroDailyBrief'))return;
  const results=document.getElementById('results'),metrics=results?.querySelector('.metrics');if(!results||!metrics)return;
  const style=document.createElement('style');
  style.textContent='.adb-panel{border-color:#5b4b2f}.adb-head{background:#171a1d}.adb-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.adb-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px}.adb-box{border:1px solid var(--line);border-radius:10px;background:#0d1725;overflow:hidden}.adb-box h3{margin:0;padding:11px 12px;border-bottom:1px solid var(--line);font-size:13px}.adb-row{padding:10px 12px;border-bottom:1px solid #223047}.adb-row:last-child{border-bottom:0}.adb-row small,.adb-news-head small{display:block;color:var(--muted);font-size:11px;margin-top:3px}.adb-warn{background:#252014}.adb-news{border-bottom:1px solid var(--line)}.adb-news:last-child{border-bottom:0}.adb-news-head{display:flex;justify-content:space-between;gap:10px;align-items:start;padding:11px 12px;background:#111b29}.adb-news-plan{border-top:1px dashed #38475b}.adb-news-plan>.adb-row{border-bottom:0}.adb-meta{padding:0 14px 13px;color:var(--muted);font-size:11px}@media(max-width:760px){.adb-grid{grid-template-columns:1fr;padding:10px}.adb-news-head{align-items:center}}';
  document.head.appendChild(style);
  const section=document.createElement('section');section.id='astroDailyBrief';section.className='panel adb-panel';
  section.innerHTML='<div class="head adb-head"><div><div class="adb-title"><h2>ASTROLOGY DAILY · SINYAL + AWAS WHIPSAW + NEWS</h2><span class="badge transition" id="adbDate">—</span></div><small>Ringkasan otomatis saka Astrology lawas lan policy Astrology News sing wis ana.</small></div></div>'+
    '<div class="adb-grid"><div class="adb-box"><h3>SINYAL ASTROLOGY DINO IKI</h3><div id="adbSignals"><div class="empty">Menunggu Astrology…</div></div></div>'+
    '<div class="adb-box"><h3>⚠ AWAS WHIPSAW ASTROLOGY</h3><div id="adbWhipsaw"><div class="empty">Menunggu Astrology…</div></div></div>'+
    '<div class="adb-box" style="grid-column:1/-1"><h3>NEWS + ASTROLOGY NEWS</h3><div id="adbNews"><div class="empty">Menunggu Astrology…</div></div></div></div>'+
    '<div id="adbMeta" class="adb-meta">—</div>';
  const candles=document.getElementById('astroCandleSummary');
  if(candles)candles.insertAdjacentElement('afterend',section);else metrics.insertAdjacentElement('afterend',section);
  render(root.CEBONK_ASTRO_STATE);
}
const API=Object.freeze({VERSION,CFG,wibDate,hm,range,mergeWindows,dailySignals,astrologyWhipsaw,newsForDate,newsConfig});
root.CebonkDailyBrief=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  root.addEventListener('cebonk-astro-update',()=>render(root.CEBONK_ASTRO_STATE));
  document.addEventListener('change',e=>{if(['dateInput','tzMode','startMinute','modelEnabled'].includes(e.target?.id))setTimeout(()=>render(null),0);});
}
})(typeof window!=='undefined'?window:globalThis);
