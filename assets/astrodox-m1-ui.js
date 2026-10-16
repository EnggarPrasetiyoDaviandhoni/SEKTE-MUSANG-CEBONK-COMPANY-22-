/* ASTRODOX M1 — timestamps WIB plus estimated MT5 GMT2 GMT3 clock. Scores unchanged. */
(function(root){
'use strict';
const C=root.CebonkCore,M=root.CebonkAstrodoxM1;
const astro=document.getElementById('astroView');
if(!astro||!C||!M||document.getElementById('astroM1Panel'))return;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=(id)=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const hourString=h=>pad(h)+':00';
const clock=ms=>C.Time.hm(C.Time.wib(ms));
const broker=ms=>{const B=root.CebonkMt5BrokerTime;if(!B)return 'Broker GMT belum tersedia';const p=B.civil(ms);return pad(p.day)+'/'+pad(p.month)+' '+pad(p.hour)+':'+pad(p.minute)+' GMT+'+(p.offset/60);};
const fmt=n=>Number.isFinite(n)?n.toFixed(2):'—';
const pct=n=>Number.isFinite(n)?n.toFixed(0)+'%':'—';
const directionClass=x=>x==='BUY'?'buy':x==='SELL'?'sell':'neutral';
let busy=false,cancelled=false,libPromise=null,report=null,chosen=-1,calculationId=0,viewRows=[];
const section=document.createElement('section');
section.className='panel astrom1';
section.id='astroM1Panel';
section.innerHTML=[
 '<div class="head astrom1-head"><div><h2>ASTROLOGY PER CANDLE M1 · 1 MENIT</h2>',
 '<small>Planet × Zodiak × Aspek · waktu WIB · riset Astrology murni</small></div>',
 '<span class="astrom1-chip">60 slot per jam</span></div>',
 '<div class="astrom1-body">',
 '<div class="astrom1-controls">',
 '<label for="astrom1Scope">Rentang hitung</label>',
 '<select id="astrom1Scope"><option value="HOUR">1 jam / 60 M1</option><option value="DAY">Sehari / 1.440 M1</option></select>',
 '<label for="astrom1Hour">Jam WIB</label>',
 '<select id="astrom1Hour" aria-label="Jam M1 WIB">',
 ...Array.from({length:24},(_,h)=>'<option value="'+h+'">'+hourString(h)+'–'+hourString((h+1)%24)+'</option>'),
 '</select>',
 '<button id="astrom1Prev" type="button" aria-label="Jam sebelumnya">◀</button>',
 '<button id="astrom1Next" type="button" aria-label="Jam berikutnya">▶</button>',
 '<button id="astrom1Run" class="primary" type="button">Hitung M1</button>',
 '<button id="astrom1JSON" type="button" disabled>Ekspor JSON EA (riset)</button>',
 '<button id="astrom1CSV" type="button" disabled>Ekspor CSV</button>',
 '</div>',
 '<p class="astrom1-note">Tanggal mengikuti kalender ASTRODOX di atas. Perhitungan asli setiap menit, bukan interpolasi M5. ',
 '<b>BUY/SELL = arah skor aspek V1, bukan prediksi harga teruji.</b> ',
 'V2 memberi faktor riset eksplisit pada peran planet dan unsur zodiak; bukan model teruji. Lilith Mean dihitung pendekatan Meeus tanpa bobot arah. Keputusan trading: WAIT.</p>',
 '<div class="astrom1-status" id="astrom1Status" role="status" aria-live="polite">Pilih jam lalu tekan Hitung M1.</div>',
 '<div id="astrom1Result" hidden>',
 '<p id="astrom1DayMeta" class="astrom1-small"></p>',
 '<div class="astrom1-summary">',
 '<div><small>Dominasi model per jam</small><strong id="astrom1Dominant">—</strong></div>',
 '<div><small>BUY / SELL / lainnya</small><strong id="astrom1Counts">—</strong></div>',
 '<div><small>Awal · inti · akhir dominan</small><strong id="astrom1Window">—</strong></div>',
 '</div>',
 '<div class="astrom1-scroller"><table><thead><tr><th>Jam WIB</th><th>Model V1</th>',
 '<th>BUY % V1</th><th>SELL % V1</th><th>Skor V1</th><th>Arah V2</th><th>Skor V2</th><th>Elemen utama</th></tr></thead>',
 '<tbody id="astrom1Rows"></tbody></table></div>',
 '<p class="astrom1-small">Klik menit untuk melihat 10 planet, longitude, zodiak, unsur dan aspek. Persentase ialah porsi bobot positif/negatif, ',
 'bukan peluang naik/turun XAUUSD. V2 = skor konfigurasi tambahan, bukan konfirmasi harga. AWAL/INTI/AKHIR retrospektif, bukan waktu entry tervalidasi.</p>',
 '<div id="astrom1Details" class="astrom1-details" hidden>',
 '<h3 id="astrom1DetailTitle">Rincian menit</h3>',
 '<div class="astrom1-overview" id="astrom1Overview"></div>',
 '<h4>Peran planet dan posisi zodiak</h4>',
 '<div class="astrom1-scroller"><table><thead><tr><th>Planet · Peran</th><th>Zodiak</th><th>Longitude</th><th>Unsur</th></tr></thead>',
 '<tbody id="astrom1Planets"></tbody></table></div>',
 '<h4>Aspek pada menit dipilih</h4>',
 '<div class="astrom1-scroller"><table><thead><tr><th>Pasangan</th><th>Jenis</th><th>Orb</th><th>Fase</th><th>Skor V1</th></tr></thead>',
 '<tbody id="astrom1Aspects"></tbody></table></div>',
 '<p class="astrom1-small" id="astrom1Hints"></p>',
 '</div></div></div>'
].join('');
const style=document.createElement('style');
style.textContent=[
 '.astrom1{margin:16px 0;border-color:#3d506a}.astrom1-head{flex-wrap:wrap}.astrom1-chip{color:var(--cyan);border:1px solid #36566e;border-radius:99px;padding:4px 8px;font-size:10px;font-weight:750}',
 '.astrom1-body{padding:14px}.astrom1-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
 '.astrom1-controls label{font-size:12px;color:var(--muted)}.astrom1-controls select{flex:1;min-width:100px;max-width:220px}',
 '.astrom1-controls button{min-width:44px}.astrom1-controls .primary{margin-left:auto}',
 '.astrom1-note{font-size:12px;line-height:1.6;color:var(--muted);margin:12px 0}',
 '.astrom1-status{font-size:12px;min-height:22px;color:var(--cyan);margin:10px 0}',
 '.astrom1-summary{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:9px;margin:8px 0 12px}',
 '.astrom1-summary>div{padding:12px;border-radius:9px;border:1px solid var(--line);background:var(--panel2)}',
 '.astrom1-summary small{font-size:10px;color:var(--muted);display:block}',
 '.astrom1-summary strong{font-size:14px;display:block;margin-top:5px;font-variant-numeric:tabular-nums}',
 '.astrom1-scroller{overflow:auto;max-height:350px;border:1px solid var(--line);border-radius:8px}',
 '.astrom1-scroller tr[data-minute]{cursor:pointer}.astrom1-scroller tr[data-minute]:hover{background:#172b42}',
 '.astrom1-scroller tr.astrom1-picked{background:#223850}',
 '.astrom1-scroller td,.astrom1-scroller th{white-space:nowrap;padding:9px 11px}',
 '.astrom1-small{font-size:11px;line-height:1.6;color:var(--muted);margin:11px 0}',
 '.astrom1-details{border-top:1px solid var(--line);padding-top:12px}',
 '.astrom1-details h3{font-size:15px;margin:4px 0 10px}.astrom1-details h4{font-size:13px;margin:15px 0 8px}',
 '.astrom1-overview{display:flex;flex-wrap:wrap;gap:8px}',
 '.astrom1-overview span{border:1px solid var(--line);border-radius:8px;padding:7px 9px;background:var(--panel2);font-size:12px}',
 '.astrom1-overview b{font-weight:750}',
 '@media(max-width:760px){.astrom1-body{padding:10px}.astrom1-controls label{width:100%}',
 '.astrom1-controls select{flex:1;max-width:none}.astrom1-controls .primary{width:100%;margin:0}',
 '.astrom1-summary{grid-template-columns:1fr 1fr}.astrom1-summary>div:last-child{grid-column:1/-1}',
 '.astrom1-summary strong{font-size:13px}.astrom1-scroller{max-height:300px}}'
].join('');
document.head.append(style);
const results=el('results');
if(results&&results.parentElement===astro)astro.insertBefore(section,results);
else astro.append(section);
const inputHour=el('astrom1Hour'),inputScope=el('astrom1Scope');
inputHour.value=String(C.Time.wib(Date.now()).hour);
function setStatus(t,isError){
 const x=el('astrom1Status');x.textContent=t;x.style.color=isError?'var(--sell)':'var(--cyan)';
}
function reset(){
 cancelled=true;calculationId++;report=null;chosen=-1;viewRows=[];
 el('astrom1JSON').disabled=true;el('astrom1CSV').disabled=true;
 el('astrom1Result').hidden=true;el('astrom1Details').hidden=true;
 if(!busy)setStatus('Parameter berubah. Tekan Hitung M1 untuk menghitung ulang.');
}
function lock(value){
 busy=value;
 for(const id of ['astrom1Run','astrom1Hour','astrom1Prev','astrom1Next','astrom1Scope'])el(id).disabled=value;
 el('astrom1Run').textContent=value?'Menghitung…':'Hitung M1';
}
function groupWindows(rows){
 const windows=[];
 for(const r of rows){
   if(r.state!=='BUY'&&r.state!=='SELL')continue;
   let w=windows[windows.length-1];
   if(!w||w.direction!==r.state||w.end!==r.ms){
     w={direction:r.state,start:r.ms,end:r.ms+60000,core:r.ms,peak:Math.abs(r.score),count:1};
     windows.push(w);
   }else{
     w.end=r.ms+60000;w.count++;
     if(Math.abs(r.score)>w.peak){w.peak=Math.abs(r.score);w.core=r.ms;}
   }
 }
 return windows.sort((a,b)=>b.count-a.count||b.peak-a.peak||a.start-b.start);
}
function renderSummary(rows){
 const counts={BUY:0,SELL:0,NEUTRAL:0,TRANSITION:0};
 for(const r of rows)counts[r.state]=(counts[r.state]||0)+1;
 let winner=counts.BUY>counts.SELL?'BUY':counts.SELL>counts.BUY?'SELL':'NEUTRAL';
 if(Math.max(counts.BUY,counts.SELL)<=counts.NEUTRAL)winner='NEUTRAL';
 const x=el('astrom1Dominant');x.textContent=winner;x.className=directionClass(winner);
 el('astrom1Counts').textContent=counts.BUY+' / '+counts.SELL+' / '+(60-counts.BUY-counts.SELL);
 const windows=groupWindows(rows).filter(w=>w.direction===winner);
 const w=windows[0];
 el('astrom1Window').textContent=w?
    clock(w.start)+' · '+clock(w.core)+' · '+clock(w.end):
    'Tidak ada window '+winner+' yang dominan';
}
function selectMinute(index){
 if(!report||index<0||index>=viewRows.length)return;
 chosen=index;
 const r=viewRows[index];
 el('astrom1Details').hidden=false;
 el('astrom1DetailTitle').textContent='Rincian M1 · '+clock(r.ms)+'–'+clock(r.ms+60000)+' WIB | Broker MT5 '+broker(r.ms);
 const elements=Object.entries(r.zodiacCounts).map(([e,n])=>e+' '+n+'/10').join(' · ');
 el('astrom1Overview').innerHTML=[
  '<span>Status <b class="'+directionClass(r.state)+'">'+esc(r.state)+'</b></span>',
  '<span>Skor V1 <b>'+fmt(r.score)+'</b></span>',
  '<span>V1 BUY '+pct(r.buyPct)+' · SELL '+pct(r.sellPct)+'</span>',
  '<span>V2 <b class="'+directionClass(r.configState)+'">'+esc(r.configState)+'</b> · skor '+fmt(r.configScore)+'</span>',
  '<span>V2 BUY '+pct(r.configBuyPct)+' · SELL '+pct(r.configSellPct)+'</span>',
  '<span>Unsur 10 planet: '+esc(elements)+'</span>',
  '<span>Mean Lilith: '+fmt(r.lilith.longitude)+'° ('+esc(r.lilithMethod)+')</span>',
  '<span>Dominasi elemen: '+esc(r.prominentElement)+'</span>'
 ].join('');
 el('astrom1Planets').innerHTML=r.planetPositions.map(p=>
   '<tr><td><strong>'+esc(p.name)+'</strong><small style="display:block">'+esc(p.role)+'</small></td>'+
   '<td>'+esc(p.sign)+' '+fmt(p.degree)+'°</td>'+
   '<td class="mono">'+fmt(p.longitude)+'°</td><td>'+esc(p.element)+'</td></tr>'
 ).join('');
 el('astrom1Aspects').innerHTML=r.aspects.length?r.aspects.map(a=>
   '<tr><td>'+esc((M.ROLES[a.id1]?.name||a.id1)+' / '+(M.ROLES[a.id2]?.name||a.id2))+
   (a.local?' <small>ASC/MC</small>':'')+'</td>'+
   '<td>'+esc(a.type)+' · '+esc(a.name)+'</td><td>'+fmt(a.orb)+'°</td>'+
   '<td>'+esc(a.phase)+'</td><td class="'+(a.impact>0?'buy':a.impact<0?'sell':'neutral')+'">'+fmt(a.impact)+'</td></tr>'
 ).join(''):'<tr><td colspan="5">Tidak ada aspek aktif dalam orb model V1.</td></tr>';
 el('astrom1Hints').textContent=
   'Interpretasi gambar: '+r.elementMeaning+'. '+(r.hints.length?r.hints.join(' · ')+'. ':'')+
   'Peran planet dan elemen memengaruhi skor V2 sesuai faktor hipotesis; V1 tetap asli. Mean Black Moon Lilith dihitung, tanpa pengaruh arah. Semua angka V1/V2 belum divalidasi terhadap harga XAUUSD.';
 for(const node of el('astrom1Rows').querySelectorAll('tr[data-minute]'))node.classList.toggle('astrom1-picked',Number(node.dataset.minute)===index);
}
function render(x){
 report=x;chosen=-1;
 const hour=Number(inputHour.value);
 viewRows=x.minutes===1440?x.rows.filter(r=>C.Time.wib(r.ms).hour===hour):x.rows;
 if(viewRows.length!==60)throw Error('Rentang tampilan M1 bukan 60 menit.');
 renderSummary(viewRows);
 const day=x.summary;
 const fw=day?.focusWindow;
 const dayLabel=fw?
   ' · AWAL '+clock(Date.parse(fw.startUTC))+' · INTI '+clock(Date.parse(fw.coreUTC))+
   ' · AKHIR '+clock(Date.parse(fw.endUTC)):' · tanpa window dominan';
 el('astrom1DayMeta').textContent=x.minutes===1440?
   'SCAN HARIAN '+x.date+' WIB · dominasi V2: '+day.v2DailyDominance+
   ' (BUY '+day.v2Counts.BUY+'m / SELL '+day.v2Counts.SELL+'m / NETRAL '+day.v2Counts.NEUTRAL+'m)'+
   dayLabel+'. Menampilkan '+pad(hour)+':00–'+pad(hour+1)+':00 · ubah jam untuk melihat 60 menit lain.':
   'SCAN PER JAM '+x.date+' WIB: '+pad(x.hour)+':00–'+pad(x.hour+1)+':00 · 60 menit.';
 el('astrom1Rows').innerHTML=viewRows.map((r,i)=>
   '<tr data-minute="'+i+'"><td class="mono">'+clock(r.ms)+'–'+clock(r.ms+60000)+'<small style="display:block">'+esc(broker(r.ms))+' MT5</small></td>'+
   '<td class="'+directionClass(r.state)+'"><b>'+esc(r.state)+'</b></td>'+
   '<td class="buy">'+pct(r.buyPct)+'</td><td class="sell">'+pct(r.sellPct)+'</td>'+
   '<td class="mono">'+fmt(r.score)+'</td>'+
   '<td class="'+directionClass(r.configState)+'">'+esc(r.configState)+'</td>'+
   '<td class="mono">'+fmt(r.configScore)+'</td>'+
   '<td>'+esc(r.prominentElement)+'</td></tr>'
 ).join('');
 el('astrom1Result').hidden=false;
 el('astrom1CSV').disabled=false;
 el('astrom1JSON').disabled=x.minutes!==1440;
 selectMinute(0);
}
function script(url){
 return new Promise((resolve,reject)=>{
  const s=document.createElement('script');
  s.src=url;s.async=true;s.referrerPolicy='no-referrer';
  s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Tidak dapat memuat ephemeris Astronomy Engine.'));};
  document.head.append(s);
 });
}
async function loadLibrary(){
 if(root.Astronomy)return root.Astronomy;
 if(!libPromise)libPromise=(async()=>{
   for(const url of [
     'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
     'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js'
   ]){
     if(root.Astronomy)return root.Astronomy;
     try{await script(url);if(root.Astronomy)return root.Astronomy;}catch(e){/* next mirror */}
   }
   throw Error('Astronomy Engine tidak dapat dimuat. Tidak dibuat data pengganti.');
 })();
 try{return await libPromise;}catch(e){libPromise=null;throw e;}
}
async function run(){
 if(busy)return;
 const date=el('dateInput')?.value,hour=Number(inputHour.value),scope=inputScope.value,ticket=++calculationId;
 cancelled=false;report=null;viewRows=[];el('astrom1Result').hidden=true;
 el('astrom1JSON').disabled=true;el('astrom1CSV').disabled=true;
 let engine=null;
 lock(true);
 try{
   C.Time.parseDate(date);
   setStatus('Memuat astronomi untuk tanggal '+date+'…');
   const A=await loadLibrary();
   if(cancelled||ticket!==calculationId)return;
   engine=C.createEngine(A);
   const data=scope==='DAY'?
     await M.calculateDay(engine,date,
       p=>setStatus('Menghitung 1.440 M1 · '+p+'%'),()=>cancelled||ticket!==calculationId):
     await M.calculateHour(engine,date,hour,
       p=>setStatus('Menghitung 60 M1 · '+p+'%'),()=>cancelled||ticket!==calculationId);
   if(cancelled||ticket!==calculationId)return;
   if(el('dateInput')?.value!==date||inputScope.value!==scope||(scope==='HOUR'&&Number(inputHour.value)!==hour))return;
   render(data);
   setStatus('Selesai · '+data.rows.length+' menit dihitung asli · '+date+' WIB · tidak ada izin entry otomatis.');
 }catch(e){
   if(!cancelled&&ticket===calculationId)setStatus((e&&e.message)||'Perhitungan M1 gagal.',true);
 }finally{
   if(engine)engine.clear();
   lock(false);
 }
}
function changeHour(d){
 if(busy)return;
 const h=Number(inputHour.value)+d;
 if(h<0||h>23)return;
 inputHour.value=String(h);
 if(report&&report.minutes===1440){render(report);return;}
 reset();run();
}
el('astrom1Run').addEventListener('click',run);
el('astrom1Prev').addEventListener('click',()=>changeHour(-1));
el('astrom1Next').addEventListener('click',()=>changeHour(1));
inputHour.addEventListener('change',()=>{if(report&&report.minutes===1440)render(report);else reset();});
inputScope.addEventListener('change',reset);
el('astrom1Rows').addEventListener('click',e=>{
 const tr=e.target.closest('tr[data-minute]');
 if(tr)selectMinute(Number(tr.dataset.minute));
});
for(const id of ['dateInput','tzMode','modelEnabled']){
 el(id)?.addEventListener('change',reset);
}
root.addEventListener('cebonk-mt5-clock-change',()=>{if(report&&!busy)render(report);});
root.addEventListener('cebonk-astro-update',()=>{
 if(!report)return;
 if(report.date!==el('dateInput')?.value){reset();return;}
 // Read-only M1: a legacy 5M rescan never overwrites its ephemeris.
});

function saveText(filename,content,type){
 const blob=new Blob([content],{type});
 const url=URL.createObjectURL(blob);
 try{
   const a=document.createElement('a');a.href=url;a.download=filename;
   document.body.append(a);a.click();a.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),1500);}
}
function csvEscape(value){
 const str=value===null||value===undefined?'':String(value);
 return '"'+str.replace(/"/g,'""')+'"';
}
el('astrom1JSON').addEventListener('click',()=>{
 if(!report||report.minutes!==1440)return;
 try{
   const feed=M.exportEAResearchFeed(report);
   saveText('CEBONK_ASTRODOX_M1_'+feed.dateWIB+'_RESEARCH.json',
      JSON.stringify(feed,null,2),'application/json');
   setStatus('JSON 1.440 menit tersedia untuk audit dan simulasi EA; auto-trade sengaja OFF.');
 }catch(e){setStatus(e.message,true);}
});
el('astrom1CSV').addEventListener('click',()=>{
 if(!report)return;
 const header=['UTC','WIB','V1_STATUS','V1_SCORE','V2_STATUS','V2_SCORE',
   'V1_BUY_PCT','V1_SELL_PCT','V2_BUY_PCT','V2_SELL_PCT','ELEMEN','LILITH_MEAN_LON','TRADE_STATUS'];
 const records=report.rows.map(r=>[
    new Date(r.ms).toISOString(),clock(r.ms),r.state,r.score.toFixed(6),
    r.configState,r.configScore.toFixed(6),r.buyPct,r.sellPct,
    r.configBuyPct,r.configSellPct,r.prominentElement,r.lilith.longitude.toFixed(6),'WAIT'
  ]);
 saveText('CEBONK_ASTRODOX_M1_'+report.date+'_'+report.minutes+'MIN_RESEARCH.csv',
  [header,...records].map(row=>row.map(csvEscape).join(',')).join('\r\n'),
  'text/csv;charset=utf-8');
 setStatus('CSV '+report.rows.length+' menit berhasil dibuat. Semua sinyal masih riset.');
});
root.CebonkAstrodoxM1UI=Object.freeze({version:'1.2.0',mode:'M1_DAILY_RESEARCH_PLUS_EXPORT'});
})(window);