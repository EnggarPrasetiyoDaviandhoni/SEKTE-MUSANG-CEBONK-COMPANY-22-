/* CEBONK ASTROLOGY CANDLE SUMMARY v1.0.0
   Read-only projection of the existing 5-minute Astrology result.
   Does NOT change the legacy Astrology calculation, score, groups, or technical scanner gate. */
(function(root){
'use strict';
const MIN=60000,HOUR=60*MIN,WIB=7*HOUR,VERSION='1.0.0';
const STATES=['BUY','SELL','NEUTRAL','TRANSITION','DATA'];
const finite=x=>Number.isFinite(x);
function bucketStart(ms,hours){
  const local=ms+WIB, span=hours*HOUR;
  return Math.floor(local/span)*span-WIB;
}
function dominant(counts,model){
  if(!model)return 'DATA';
  let best=-1,winners=[];
  for(const s of ['BUY','SELL','NEUTRAL','TRANSITION']){
    const n=counts[s]||0;
    if(n>best){best=n;winners=[s];}
    else if(n===best)winners.push(s);
  }
  if(best<=0)return 'NEUTRAL';
  return winners.length===1?winners[0]:'MIXED';
}
function aggregate(samples,hours,stepMinutes=5,model=true,now=Date.now()){
  if(!Array.isArray(samples)||!samples.length)return [];
  const step=Math.max(1,Number(stepMinutes)||5)*MIN,span=hours*HOUR,map=new Map();
  for(const sample of samples){
    if(!sample||!finite(sample.ms))continue;
    const start=bucketStart(sample.ms,hours),end=start+span;
    let b=map.get(start);
    if(!b){
      b={start,end,hours,counts:{BUY:0,SELL:0,NEUTRAL:0,TRANSITION:0,DATA:0},observedMinutes:0,samples:0};
      map.set(start,b);
    }
    const state=STATES.includes(sample.state)?sample.state:(model?'NEUTRAL':'DATA');
    b.counts[state]+=step/MIN;b.observedMinutes+=step/MIN;b.samples++;
  }
  return [...map.values()].sort((a,b)=>a.start-b.start).map(b=>{
    const expected=hours*60,coverage=Math.min(1,b.observedMinutes/expected),dom=dominant(b.counts,model);
    const pct={};for(const s of STATES)pct[s]=b.observedMinutes?100*(b.counts[s]||0)/b.observedMinutes:0;
    const life=now>=b.start&&now<b.end?'ACTIVE':now>=b.end?'CLOSED':'FUTURE';
    return {...b,dominant:dom,pct,coverage,status:coverage<0.999?'PARTIAL':life};
  });
}
function formatRange(start,end){
  const fmt=ms=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms));
  return fmt(start)+'–'+fmt(end);
}
function formatDate(ms){
  return new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit'}).format(new Date(ms));
}
function pct(x){return (finite(x)?x:0).toFixed(0)+'%';}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function tone(s){return s==='BUY'?'buy':s==='SELL'?'sell':s==='TRANSITION'||s==='MIXED'?'transition':'neutral';}
function row(b,label){
  return '<tr>'+
    '<td><strong>'+label+'</strong><small>'+formatDate(b.start)+' WIB</small></td>'+
    '<td class="mono">'+formatRange(b.start,b.end)+'</td>'+
    '<td><span class="badge '+tone(b.dominant)+'">'+esc(b.dominant)+'</span></td>'+
    '<td class="buy">'+pct(b.pct.BUY)+'</td>'+
    '<td class="sell">'+pct(b.pct.SELL)+'</td>'+
    '<td>'+pct(b.pct.NEUTRAL)+'</td>'+
    '<td class="transition">'+pct(b.pct.TRANSITION)+'</td>'+
    '<td>'+pct(b.coverage*100)+' <small>'+esc(b.status)+'</small></td>'+
  '</tr>';
}
function render(state){
  const host=document.getElementById('astroCandleSummary');
  if(!host)return;
  if(!state||!Array.isArray(state.samples)||!state.samples.length||document.getElementById('results')?.dataset.stale==='true'){
    host.querySelector('#astroH4Body').innerHTML='<tr><td colspan="8">Belum ada hasil Astrology valid.</td></tr>';
    host.querySelector('#astroH1Body').innerHTML='<tr><td colspan="8">Belum ada hasil Astrology valid.</td></tr>';
    return;
  }
  const step=root.CebonkCore?.CFG?.step||5,now=Date.now();
  const h4=aggregate(state.samples,4,step,state.model,now),h1=aggregate(state.samples,1,step,state.model,now);
  host.querySelector('#astroH4Body').innerHTML=h4.map((b,i)=>row(b,'H4 #'+(i+1))).join('');
  host.querySelector('#astroH1Body').innerHTML=h1.map((b,i)=>row(b,'H1 #'+(i+1))).join('');
  host.querySelector('#astroCandleMeta').textContent='Sumber: '+state.samples.length+' slot Astrology lawas @ '+step+' menit · read-only · v'+VERSION;
}
function mount(){
  if(typeof document==='undefined'||document.getElementById('astroCandleSummary'))return;
  const results=document.getElementById('results'),metrics=results?.querySelector('.metrics');
  if(!results||!metrics)return;
  const style=document.createElement('style');
  style.textContent='.astro-candle-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.astro-candle-panel .scroller{max-height:380px}.astro-candle-panel td strong{display:block}.astro-candle-panel td small{display:block;color:var(--muted)}.astro-candle-meta{color:var(--muted);font-size:11px}@media(max-width:760px){.astro-candle-grid{grid-template-columns:1fr}.astro-candle-panel .scroller{max-height:330px}}';
  document.head.appendChild(style);
  const section=document.createElement('section');
  section.id='astroCandleSummary';
  section.className='astro-candle-grid';
  const table=(title,bodyId,sub)=>'<section class="panel astro-candle-panel"><div class="head"><div><h2>'+title+'</h2><small>'+sub+'</small></div></div><div class="scroller"><table><thead><tr><th>Candle</th><th>Jam WIB</th><th>Dominan</th><th>BUY</th><th>SELL</th><th>Neutral</th><th>Transition</th><th>Coverage</th></tr></thead><tbody id="'+bodyId+'"><tr><td colspan="8">Menunggu Astrology…</td></tr></tbody></table></div></section>';
  section.innerHTML=table('ASTROLOGY PER CANDLE H4','astroH4Body','Bucket WIB 00/04/08/12/16/20 · ringkasan dari slot 5 menit lawas')+table('ASTROLOGY PER CANDLE H1','astroH1Body','Bucket WIB per jam · tidak mengubah mesin Astrology lawas')+'<div id="astroCandleMeta" class="astro-candle-meta"></div>';
  metrics.insertAdjacentElement('afterend',section);
  render(root.CEBONK_ASTRO_STATE);
}
const API=Object.freeze({VERSION,bucketStart,dominant,aggregate,formatRange});
root.CebonkAstroCandles=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  root.addEventListener('cebonk-astro-update',()=>render(root.CEBONK_ASTRO_STATE));
  document.addEventListener('change',e=>{if(['dateInput','tzMode','startMinute','modelEnabled'].includes(e.target?.id))setTimeout(()=>render(null),0);});
}
})(typeof window!=='undefined'?window:globalThis);
