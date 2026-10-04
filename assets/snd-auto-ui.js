/* Automatic HTF location layer. Keeps the PDF Entry Level 2 verifier and Astrology intact. */
(function(root){
'use strict';
const N=root.CebonkSNDAuto,base=root.CebonkMusangPDF;
if(!N||!base)throw Error('SND_AUTO_DEPENDENCY_MISSING');
const snapshot={version:N.CFG.version,frames:{},executionEnabled:false,source:'AUTO_ENGINEERING_NOT_PDF'};
root.CEBONK_SND_AUTO_STATE=snapshot;
// Loaded BEFORE the original PDF UI captures K. Manual annotations cannot enable Combined 2.
function combine(r,a,ignored,now,fresh,stale=false){
 const d=base.combine(r,a,[],now,fresh,stale);
 d.two='WAIT';d.locationSource='AUTO_ENGINEERING';
 if(!d.one.startsWith('ENTRY')){d.reason2=d.reason1;return d;}
 const eventStart=r.eventMs-base.CFG.frames[r.setup.tf]*60000;
 const ctx=N.select(snapshot,r.setup.direction,r.entry,eventStart,now);d.context=ctx;
 if(!ctx.coverage.length){d.reason2='SND/SNR: data HTF durung siap / expired. Ora nganggo zona manual.';return d;}
 if(!ctx.aligned.length){d.reason2='SND/SNR: retest ora ana ing zona otomatis searah sing aktif.';return d;}
 if(ctx.opposed.length){d.reason2='SND/SNR: konflik zona lawan ing rega retest. WAIT.';return d;}
 d.two=d.one;d.reason2='Astrology → '+ctx.primary.tf+' '+ctx.primary.kind+' '+ctx.primary.status+' → CB1 break + retest Zone IB.'+(ctx.primary.status==='TESTED'?' TESTED cadangan; ora ana FRESH ing lokasi retest.':'')+(ctx.missing.length?' Cakupan parsial: '+ctx.coverage.join('/')+'.':'');
 return d;
}
root.CebonkMusangPDF=Object.freeze({...base,combine});
if(typeof document==='undefined')return;
function mount(){
 const $=id=>document.getElementById(id),parent=$('pdfZonesView');if(!parent||$('sndAutoPanel'))return;
 const style=document.createElement('style');style.textContent=`
 #pdfZonesView>:not(#sndAutoPanel){display:none!important}#sndAutoPanel .sa-head{padding:18px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel);margin-bottom:12px}#sndAutoPanel h2{font-size:27px;margin:5px 0}#sndAutoPanel p{font-size:12px;color:var(--muted);line-height:1.65;margin:6px 0}#sndAutoPanel .sa-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}#sndAutoPanel .sa-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:12px 0}#sndAutoPanel .sa-tf{padding:13px 10px;background:var(--panel);border:1px solid var(--line);border-radius:10px;min-width:0}#sndAutoPanel .sa-tf strong{display:block;font-size:20px}#sndAutoPanel .sa-tf small{font-size:11px;display:block;color:var(--muted);overflow-wrap:anywhere}#sndAutoPanel .sa-pick{padding:16px;background:var(--panel);border:1px solid var(--accent);border-radius:10px;margin-bottom:12px}#sndAutoPanel .sa-pick strong{font-size:22px;display:block;overflow-wrap:anywhere}#sndAutoPanel .sa-list{border:1px solid var(--line);border-radius:10px;overflow:hidden}#sndAutoPanel .sa-zone{padding:12px 14px;border-bottom:1px solid var(--line)}#sndAutoPanel .sa-zone b{font-size:14px}#sndAutoPanel .sa-zone small{display:block;font-size:11px;color:var(--muted)}#sndAutoPanel .sa-error{border-color:var(--sell)}#sndAutoPanel details{margin-top:12px}#sndAutoPanel table{font-size:12px}#sndAutoPanel .scroller{max-height:420px}#sndAutoPanel button{min-height:44px}#sndAutoPanel .sa-warning{padding:10px 12px;border:1px solid #735a37;border-radius:8px;background:#251f15;color:#ebd5ad;font-size:12px;margin:12px 0}@media(max-width:720px){#sndAutoPanel .sa-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#sndAutoPanel .sa-tf:first-child{grid-column:1/-1}#sndAutoPanel h2{font-size:25px}}
 `;document.head.appendChild(style);
 const el=document.createElement('div');el.id='sndAutoPanel';el.innerHTML=`
 <header class="sa-head"><span class="eyebrow">SEKTE MUSANG · CEBONK COMPANY 22</span><h2>SND / SNR OTOMATIS</h2><p>ASTROLOGY → LOKASI FRESH → FIBO MUSANG<br>MN1 · W1 · D1 · H4 · H1 — ora perlu input harga zona.</p></header>
 <div class="sa-bar"><button type="button" id="saScan" class="primary">SCAN OTOMATIS</button><span id="saState" class="badge neutral">MENUNGGU DATA</span><button type="button" id="saExport">JSON audit</button></div>
 <p id="saProgress" role="status" aria-live="polite">Scanner mlaku nalika tab SNR/SND utawa COMBINED 2 dibuka.</p>
 <div id="saWarning" class="sa-warning" hidden></div><div id="saFrames" class="sa-grid"></div>
 <div id="saPrimary" class="sa-pick"></div><section class="sa-list"><div class="head"><h3>Kandidat searah Astrology</h3><small>FRESH dhisik; TESTED cadangan</small></div><div id="saCandidates"></div></section>
 <details><summary>Kabeh zona — FRESH / TESTED / BROKEN</summary><div class="scroller"><table><thead><tr><th>TF</th><th>Jenis</th><th>Bawah</th><th>Atas</th><th>Status</th><th>Retest min.</th><th>Terbentuk WIB</th></tr></thead><tbody id="saAll"></tbody></table></div></details>
 <details><summary>Aturan otomatis & batasan</summary><p>SNR: pivot ekstrem terkonfirmasi dua candle kiri/kanan. Zona saka wick menyang body, dibatasi 0.08–0.50 median range 20 candle sadurunge. SND: asal displacement saka pivot, close ngliwati candle asal lan jarak paling ora 1.5 median range ing maksimal 3 candle. Ora ana klasifikasi pola base.</p><p>FRESH: ora ana bali menyang zona sawise departure ing sejarah feed sing dipriksa. TESTED: wis kena paling ora sepisan. Retest dihitung minangka kunjungan candle HTF, mula angka iki minimal, dudu hitungan tick. BROKEN: candle TF sumber tutup ngliwati distal. DATA_GAP: ora layak digunakake. FRESH dadi prioritas sadurunge jarak; confluence kudu TF beda. Zona wis disentuh bisa pindah dadi TESTED, ora dilabeli FRESH maneh.</p><p>Deteksi lokasi iki aturan engineering, dudu formula numerik saka PDF. Fibo Musang tetep Entry Level 2 sing wis ana: IB → CB1 break → retest Zone IB, kanthi review struktur/anchor sing wis ana. Scanner zona ora mbutuhake review/input manual. Ora ana order EA utawa Telegram otomatis.</p><p>Data native Twelve Data XAU/USD, dudu feed NOZAX. Refresh selektif nalika tab aktif; ora 24 jam nalika browser ditutup. Timeframe kurang data ditandhai, ora diganti data rekaan lan ora mblokir TF liyane sing sehat. Harga referensi H1 iku close HTF pungkasan, dudu quote live. Hasil dudu jaminan profit.</p></details>`;
 parent.prepend(el);$('tabZones').textContent='SND / SNR AUTO';
 document.querySelectorAll('[data-pdf-open="pdfZonesView"]').forEach(b=>b.textContent='Delok SND/SNR otomatis');
 let busy=false,lastStart=0;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>Number.isFinite(v)?v.toFixed(3):'—';
 const time=t=>Number.isFinite(t)?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'short',timeStyle:'short'}).format(t)+' WIB':'—';
 function astro(){const a=root.CEBONK_ASTRO_STATE,now=Date.now();if(!a||!a.model||$('results')?.dataset.stale==='true'||$('dateInput')?.value!==a.iso||!$('modelEnabled')?.checked)return null;return a.groups.find(g=>now>=g.start&&now<g.end&&['BUY','SELL'].includes(g.state))||null;}
 function all(){return Object.values(snapshot.frames).filter(f=>f.ok&&f.validUntil>Date.now()).flatMap(f=>f.zones);}
 function price(){return snapshot.frames.H1?.referencePrice;}
 function render(){
  const now=Date.now(),a=astro(),zs=all(),rank=a?N.ranked(zs,a.state,price()):[],p=rank[0];
  $('saFrames').innerHTML=Object.keys(N.CFG.frames).map(tf=>{const f=snapshot.frames[tf],ok=f?.ok&&f.validUntil>now;return `<div class="sa-tf ${f&&!ok?'sa-error':''}"><strong>${tf}</strong><span class="badge ${ok?'buy':'neutral'}">${ok?'SIAP':f?.error?'DATA ERROR':f?'CACHE EXPIRED':'MENUNGGU'}</span><small>${ok?f.zones.filter(z=>z.status==='FRESH').length+' FRESH · '+f.zones.filter(z=>z.status==='TESTED').length+' TESTED':esc(f?.error||'Belum dipindai')}</small><small>${ok?f.count+' candle tutup · '+esc(f.zone):''}</small></div>`;}).join('');
  const good=Object.keys(snapshot.frames).filter(tf=>snapshot.frames[tf].ok&&snapshot.frames[tf].validUntil>now).length;
  $('saState').textContent=busy?'SCANNING':good===5?'5/5 TF SIAP':good?good+'/5 TF · PARSIAL':'WAIT DATA';
  const issues=Object.entries(snapshot.frames).filter(([,f])=>f.error).map(([tf,f])=>tf+': '+f.error);
  $('saWarning').hidden=!issues.length;$('saWarning').textContent=issues.join(' | ');
  $('saPrimary').innerHTML='<span class="label">KANDIDAT UTAMA · '+esc(a?a.state:'WAIT ASTROLOGY')+'</span><strong>'+esc(p?p.tf+' '+p.kind+' '+p.status:a?'ORA ANA ZONA AKTIF':'Astrology durung searah / ing njaba window')+'</strong><p>'+esc(p?fmt(p.low)+' – '+fmt(p.high)+' · confluence '+(p.confluence.join('/')||'—')+' · nested '+(p.nested.join('/')||'—'):'Scanner tetep maca lokasi; ora maksa BUY/SELL.')+'</p><p>Referensi close H1: '+fmt(price())+' · '+time(snapshot.frames.H1?.referenceMs)+'</p><p>Lokasi iki dudu entry langsung. Sinyal mbutuhake CB1 break + retest Zone IB.</p>';
  $('saCandidates').innerHTML=rank.slice(0,10).map(z=>`<div class="sa-zone"><b>${esc(z.tf+' '+z.kind+' · '+z.status)}</b><p>${fmt(z.low)} – ${fmt(z.high)}</p><small>Confluence: ${esc(z.confluence.join('/')||'—')} · nested: ${esc(z.nested.join('/')||'—')} · retest minimal ${z.retests}</small></div>`).join('')||'<p class="pdf-pad">'+(a?'Ora ana kandidat sehat searah.':'Hitung Astrology kanggo tanggal saiki; kandidat utama mung dipilih yen BUY/SELL aktif.')+'</p>';
  const records=Object.values(snapshot.frames).flatMap(f=>f.zones||[]);
  $('saAll').innerHTML=records.map(z=>`<tr><td>${z.tf}</td><td>${z.kind}</td><td>${fmt(z.low)}</td><td>${fmt(z.high)}</td><td>${z.status}</td><td>${z.retests}</td><td>${time(z.createdAt)}</td></tr>`).join('')||'<tr><td colspan="7">Belum ana zona saka data valid.</td></tr>';
 }
 async function refresh(){
  if(busy||document.hidden||Date.now()-lastStart<65000)return;
  const due=Object.keys(N.CFG.frames).filter(tf=>!snapshot.frames[tf]?.ok||snapshot.frames[tf].validUntil<=Date.now());if(!due.length){render();return;}
  lastStart=Date.now();busy=true;$('saScan').disabled=true;render();
  for(const tf of due){
   $('saProgress').textContent='Scan '+tf+' — data native, candle tutup…';
   try{
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);let res,j;
    try{res=await fetch('https://cebonk-xau-api.enggarprasetiyo330.workers.dev/xau?interval='+N.CFG.frames[tf].interval+'&outputsize=300',{signal:ctl.signal});j=await res.json();}finally{clearTimeout(timer);}
    if(!res.ok||!j.ok)throw Error(j.error==='INVALID_INTERVAL'?'Worker perlu update HTF (1day/1week/1month).':j.code===429||res.status===429?'KUOTA API / RATE LIMIT':j.code===403||res.status===403?'PAKET DATA TIDAK MENDUKUNG TF':j.error||'HTTP '+res.status);
    const f=N.payload(j,tf),zones=N.scan(f),c=f.closed[f.closed.length-1];
    snapshot.frames[tf]={ok:true,tf,zone:f.zone,zones,count:f.closed.length,fetchedAt:f.fetchedAt,validUntil:f.validUntil,referencePrice:c.close,referenceMs:c.end};
   }catch(e){snapshot.frames[tf]={ok:false,error:e.name==='AbortError'?'KONEKSI TIMEOUT':e.message,zones:[]};}
   render();await new Promise(r=>setTimeout(r,250));
  }
  busy=false;$('saScan').disabled=false;$('saProgress').textContent='Scan rampung '+time(Date.now())+'. Refresh selektif otomatis saben 5 menit nalika tab iki / Combined 2 aktif.';
  render();root.dispatchEvent(new Event('cebonk-astro-update'));
 }
 const visible=()=>!document.hidden&&[parent,$('combined2View')].some(x=>x&&!x.hidden);
 function maybe(){if(visible())refresh();}
 $('saScan').addEventListener('click',refresh);
 $('saExport').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),rules:N.CFG,...snapshot},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='CEBONK_SND_SNR_AUTO_AUDIT.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);});
 document.querySelector('.viewtabs').addEventListener('click',()=>setTimeout(maybe,0));
 document.querySelector('main.wrap').addEventListener('click',e=>{if(e.target.closest('[data-pdf-open]'))setTimeout(maybe,0);});
 root.addEventListener('hashchange',()=>setTimeout(maybe,0));document.addEventListener('visibilitychange',maybe);
 root.addEventListener('cebonk-astro-update',render);setInterval(()=>{render();maybe();},300000);render();maybe();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0),{once:true});else setTimeout(mount,0);
})(typeof window!=='undefined'?window:globalThis);
