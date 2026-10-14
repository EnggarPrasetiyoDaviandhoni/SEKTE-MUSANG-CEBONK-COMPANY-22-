/* COMEX Solar Return dashboard — stand-alone research panel, no order execution. */
(function(root){
'use strict';
const C=root.CebonkCore,SR=root.CebonkComexSolarReturn;
const container=document.getElementById('astroView');
if(!container||!C||!SR||document.getElementById('comexSrPanel'))return;
const $=id=>document.getElementById(id),pad=x=>String(x).padStart(2,'0');
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=ms=>C.Time.hm(C.Time.wib(ms));
const fullTime=ms=>C.Time.dateISO(C.Time.wib(ms))+' '+clock(ms)+' WIB';
const deg=n=>Number.isFinite(n)?n.toFixed(3)+'°':'—';
const pct=n=>Number.isFinite(n)?Math.round(n*100)+'%':'—';
let result=null,astronomyPromise=null,cancelled=false,busy=false,runId=0;
const panel=document.createElement('section');
panel.className='panel srcomex-panel';
panel.id='comexSrPanel';
panel.innerHTML=[
 '<div class="head"><div><h2>SOLAR RETURN MURNI · FOLLOW TREND MINGGUAN</h2>',
 '<small>Gold Futures COMEX · chart dasar 31 Desember 1974 · riset astrologi tahunan</small></div>',
 '<span class="srcomex-chip">SOLAR RETURN</span></div>',
 '<div class="srcomex-body">',
 '<p class="srcomex-note"><strong>Chart dasar:</strong> tanggal 31 Desember 1974 tercatat sebagai hari pertama perdagangan futures emas di COMEX.',
 ' Jam transaksi pertama belum terverifikasi. Default pukul 12:00 New York (EST) adalah <b>ASUMSI penelitian</b>,',
 ' bukan fakta sejarah. Lokasi New York hanya label chart dasar; sistem ini tidak menghitung rumah/ASC.</p>',
 '<div class="srcomex-controls">',
 '<label for="srcomexHour">Asumsi jam chart dasar · New York EST',
 '<select id="srcomexHour"></select></label>',
 '<button id="srcomexRun" class="primary" type="button">Hitung Tren SR 7 Hari + M1</button>',
 '<button id="srcomexCancel" type="button" disabled>Batalkan</button>',
 '</div>',
 '<p class="srcomex-note">Tanggal analisis mengikuti kalender ASTROLOGI di atas.',
 ' Transit M1 dihitung terhadap posisi planet dalam chart Solar Return tahunan.',
 ' Label <b>HARMONIS / TEGANG / TRANSISI</b> menunjukkan jenis aspek, bukan probabilitas naik/turun GOLD.',
 ' Follow trend Solar Return mengunci bias astrologi mingguan, bukan tren harga emas nyata.',
 ' Keputusan trading EA tetap WAIT.</p>',
 '<p id="srcomexStatus" class="srcomex-status" role="status" aria-live="polite">',
 'Pilih tanggal dan jam referensi, kemudian tekan Hitung Solar Return.</p>',
 '<div id="srcomexResults" hidden>',
 '<div class="srcomex-summary">',
 '<div><small>Matahari dasar COMEX</small><strong id="srcomexNatalSun">—</strong></div>',
 '<div><small>Solar Return aktif (awal tanggal)</small><strong id="srcomexLast">—</strong></div>',
 '<div><small>Solar Return berikutnya</small><strong id="srcomexNext">—</strong></div>',
 '<div><small>Total event unik M1</small><strong id="srcomexEventCount">—</strong></div>',
 '</div>',
 '<p class="srcomex-note" id="srcomexSummary"></p>',
 '<div class="srcomex-toolbar">',
 '<label for="srcomexSelectedHour">Lihat jam WIB</label>',
 '<select id="srcomexSelectedHour"></select>',
 '<button id="srcomexCSV" type="button">CSV 1.440 M1</button>',
 '<button id="srcomexJSON" type="button">JSON riset EA</button>',
 '</div>',
 '<div class="srcomex-scroll"><table><thead><tr>',
 '<th>Jam WIB</th><th>SR tahun</th><th>Event dominan</th><th>Jenis</th>',
 '<th>Orb</th><th>Fase</th><th>Kekuatan relatif</th><th>Bias SR Mingguan</th><th>SR Follow Trend*</th><th>Keputusan EA</th>',
 '</tr></thead><tbody id="srcomexMinuteRows"></tbody></table></div>',
 '<div id="srcomexMinuteDetail" class="srcomex-detail">Pilih satu menit untuk rincian.</div>',
 '<details class="srcomex-details">',
 '<summary>Posisi 10 planet pada chart Solar Return aktif</summary>',
 '<div class="srcomex-scroll srcomex-short"><table><thead><tr><th>Planet</th><th>Bujur ekliptika</th><th>Zodiak</th></tr></thead>',
 '<tbody id="srcomexBodies"></tbody></table></div></details>',
 '<details class="srcomex-details">',
 '<summary>Daftar event transit M1 sepanjang tanggal</summary>',
 '<div class="srcomex-scroll srcomex-short"><table><thead>',
 '<tr><th>WIB</th><th>Transit → Solar Return</th><th>Aspek</th><th>Jenis</th><th>Orb</th></tr>',
 '</thead><tbody id="srcomexEventRows"></tbody></table></div></details>',
 '<p class="srcomex-note"><b>Status: RISET, WAIT.</b>',
 ' Solar Return sendiri tidak membuktikan sinyal BUY/SELL harian atau keuntungan XAUUSD.',
 ' BUY/SELL adalah bias astrologi dari aspek chart Solar Return, belum tervalidasi.',
 ' Peristiwa exact dan puncak window dapat diketahui secara astronomis, tetapi arah harga perlu backtest terpisah.',
 ' *Tidak menggunakan Astro V2 atau indikator teknikal pada perhitungan Solar Return.</p>',
 '</div></div>'
].join('');
const css=document.createElement('style');
css.textContent=[
 '.srcomex-panel{border-color:#3c5066;margin:16px 0}.srcomex-panel .head{flex-wrap:wrap}',
 '.srcomex-chip{border:1px solid var(--line);border-radius:99px;color:var(--cyan);padding:5px 9px;font-size:10px;font-weight:750}',
 '.srcomex-body{padding:14px}.srcomex-note{font-size:11px;color:var(--muted);margin:9px 0 13px;line-height:1.65}',
 '.srcomex-note strong{color:var(--text)}.srcomex-controls{display:flex;align-items:end;gap:9px;flex-wrap:wrap}',
 '.srcomex-controls label{font-size:11px;color:var(--muted);display:flex;flex-direction:column;gap:5px;flex:1 1 190px}',
 '.srcomex-controls select{width:100%}.srcomex-controls button{min-height:44px}',
 '.srcomex-controls .primary{flex:2 1 240px}',
 '.srcomex-status{font-size:12px;color:var(--cyan);min-height:23px;margin:13px 0}',
 '.srcomex-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:11px 0}',
 '.srcomex-summary>div{padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--panel2)}',
 '.srcomex-summary small{display:block;font-size:10px;color:var(--muted)}',
 '.srcomex-summary strong{display:block;font-size:14px;font-variant-numeric:tabular-nums;margin-top:6px}',
 '.srcomex-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:13px 0}',
 '.srcomex-toolbar label{font-size:11px;color:var(--muted)}.srcomex-toolbar select{flex:1;min-width:110px}',
 '.srcomex-toolbar button{min-height:40px;font-size:11px}',
 '.srcomex-scroll{max-height:350px;overflow:auto;border:1px solid var(--line);border-radius:8px}',
 '.srcomex-scroll td,.srcomex-scroll th{font-size:11px;padding:9px 10px;white-space:nowrap}',
 '.srcomex-scroll tr[data-min]{cursor:pointer}.srcomex-scroll tr[data-min]:hover{background:var(--panel2)}',
 '.srcomex-scroll tr.srcomex-selected{background:#233b54}',
 '.srcomex-detail{background:var(--panel2);border:1px solid var(--line);border-radius:8px;',
 'margin:10px 0;padding:12px;font-size:12px;overflow-wrap:anywhere}',
 '.srcomex-details{margin:12px 0;padding:0 12px 8px}.srcomex-short{max-height:310px}',
 '@media(max-width:760px){.srcomex-body{padding:11px}.srcomex-controls button{width:100%}',
 '.srcomex-summary strong{font-size:12px}.srcomex-toolbar button{flex:1 1 130px}}'
].join('');
document.head.append(css);
const previous=document.getElementById('epmPanel')||document.getElementById('astroM1Panel');
if(previous&&previous.parentElement===container)previous.insertAdjacentElement('afterend',panel);
else {
 const results=$('results');if(results&&results.parentElement===container)container.insertBefore(panel,results);
 else container.append(panel);
}
for(let h=0;h<24;h++){
 const choice=document.createElement('option');choice.value=String(h);
 choice.textContent=pad(h)+':00 EST'+(h===12?' · asumsi default':'');
 $('srcomexHour').append(choice);
 const select=document.createElement('option');select.value=String(h);
 select.textContent=pad(h)+':00–'+pad((h+1)%24)+':00';
 $('srcomexSelectedHour').append(select);
}
$('srcomexHour').value='12';
$('srcomexSelectedHour').value=String(C.Time.wib(Date.now()).hour);
function status(msg,error=false){
 $('srcomexStatus').textContent=msg;
 $('srcomexStatus').style.color=error?'var(--sell)':'var(--cyan)';
}
function lock(value){
 busy=value;
 $('srcomexRun').disabled=value;
 $('srcomexHour').disabled=value;
 $('srcomexCancel').disabled=!value;
 $('srcomexRun').textContent=value?'Menghitung Solar Return…':'Hitung Tren SR 7 Hari + M1';
}
function reset(){
 cancelled=true;runId++;result=null;$('srcomexResults').hidden=true;
 status('Parameter berubah; tekan Hitung Solar Return untuk tanggal terbaru.');
}
function save(filename,body,type){
 const url=URL.createObjectURL(new Blob([body],{type}));
 try{const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),1800);}
}
function showMinute(i){
 if(!result||!result.rows[i])return;
 const row=result.rows[i],e=row.topEvent;
 $('srcomexMinuteDetail').innerHTML=
  '<strong>'+fullTime(row.ms)+' · Solar Return '+row.returnYear+'</strong>'+
  '<p class="srcomex-note">Event: '+escapeHTML(e?.pair||'Tidak ada')+' · '+
  escapeHTML(e?.aspect||'—')+' · '+escapeHTML(e?.eventType||'NONE')+
  ' · Orb '+deg(e?.orb)+' · Fase '+escapeHTML(e?.phase||'—')+
  ' · Kekuatan relatif '+pct(e?.strength)+
  '. Ini bukan peluang gerak harga.</p>'+
  '<p class="srcomex-note">Bias mingguan SR: '+escapeHTML(row.weekBias)+
  ' · Aktivasi SR mengikuti tren: <b>'+escapeHTML(row.eventPolarity)+
  '</b> · fase '+escapeHTML(row.phase)+' ('+escapeHTML(row.polarityReason)+') · keputusan GOLD/EA: <b>WAIT</b>.'+
  ' Event tambahan: '+
  (row.topFour.slice(1).map(x=>escapeHTML(x.pair+' '+x.aspect+' (orb '+x.orb.toFixed(3)+'°)')).join(' | ')||'Tidak ada')+'</p>';
 for(const tr of $('srcomexMinuteRows').querySelectorAll('tr[data-min]'))
  tr.classList.toggle('srcomex-selected',Number(tr.dataset.min)===i);
}
function renderHour(){
 if(!result)return;
 const target=Number($('srcomexSelectedHour').value);
 const indices=[];
 for(let i=0;i<result.rows.length;i++){
  if(C.Time.wib(result.rows[i].ms).hour===target)indices.push(i);
 }
 $('srcomexMinuteRows').innerHTML=indices.map(i=>{
  const row=result.rows[i],e=row.topEvent;
  return '<tr data-min="'+i+'"><td>'+clock(row.ms)+'</td>'+
   '<td>'+row.returnYear+'</td>'+
   '<td>'+escapeHTML(e?.pair||'—')+' '+escapeHTML(e?.aspect||'')+'</td>'+
   '<td>'+escapeHTML(row.eventType)+'</td><td>'+deg(e?.orb)+'</td>'+
   '<td>'+escapeHTML(e?.phase||'—')+'</td><td>'+pct(e?.strength)+'</td>'+
   '<td>'+escapeHTML(row.weekBias)+'</td>'+
   '<td class="'+(row.eventPolarity==='BUY'?'buy':row.eventPolarity==='SELL'?'sell':'neutral')+'">'+
   escapeHTML(row.eventPolarity)+'</td><td>WAIT</td></tr>';
 }).join('');
 if(indices.length)showMinute(indices[0]);
}
function render(){
 if(!result)return;
 const start=result.activeAtStart;
 const after=result.baseline.returns.filter(r=>r.ms>result.rows[0].ms)[0];
 $('srcomexNatalSun').textContent=deg(result.baseline.baselineSunLongitude);
 $('srcomexLast').textContent=fullTime(start.ms);
 $('srcomexNext').textContent=after?fullTime(after.ms):'—';
 $('srcomexEventCount').textContent=String(result.eventList.length);
 $('srcomexSummary').textContent='Pekan '+result.weekly.startWIB+'–'+result.weekly.endWIB+
   ' · arah SR dominan '+result.weekly.direction+' · skor relatif '+result.weekly.score.toFixed(3)+
   ' (bukan peluang profit). '+result.weekly.days.map(d=>d.dateWIB+': '+d.bias).join(' | ')+
   ' · Aktivasi tanggal '+result.dateWIB+': BUY '+result.polarityCounts.BUY+
   'm, SELL '+result.polarityCounts.SELL+'m, WAIT '+result.polarityCounts.WAIT+
   'm. Jam dasar COMEX '+pad(result.baseline.hourNY)+':00 EST masih asumsi.';
  const names=C.CFG.planets.map(x=>x.id);
 $('srcomexBodies').innerHTML=start.bodies.map(b=>{
  const n=b.longitude,sign=C.CFG.zodiac[Math.floor(n/30)];
  return '<tr><td>'+escapeHTML(b.id)+'</td><td>'+deg(n)+'</td>'+
   '<td>'+escapeHTML(sign)+' '+deg(n%30)+'</td></tr>';
 }).join('');
 $('srcomexEventRows').innerHTML=result.eventList.length?
 result.eventList.map(e=>'<tr><td>'+escapeHTML(e.wib)+'</td><td>'+escapeHTML(e.pair)+
  '</td><td>'+escapeHTML(e.aspect)+'</td><td>'+escapeHTML(e.type)+
  '</td><td>'+deg(e.orb)+'</td></tr>').join(''):
 '<tr><td colspan="5">Tidak ada event terpilih.</td></tr>';
 $('srcomexResults').hidden=false;
 renderHour();
}
function inject(url){
 return new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.async=true;s.src=url;
  s.referrerPolicy='no-referrer';s.onload=resolve;
  s.onerror=()=>{s.remove();reject(Error('Astronomy Engine gagal dimuat.'));};
  document.head.append(s);
 });
}
async function loadAstronomy(){
 if(root.Astronomy)return root.Astronomy;
 if(!astronomyPromise)astronomyPromise=(async()=>{
  for(const u of [
   'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
   'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js'
  ]){
   if(root.Astronomy)return root.Astronomy;
   try{await inject(u);if(root.Astronomy)return root.Astronomy;}catch(e){/* mirror */}
  }
  throw Error('Library astronomi tidak tersedia; tidak membuat posisi palsu.');
 })();
 try{return await astronomyPromise;}catch(e){astronomyPromise=null;throw e;}
}
async function run(){
 if(busy)return;
 const d=$('dateInput')?.value,h=Number($('srcomexHour').value),token=++runId;
 cancelled=false;result=null;$('srcomexResults').hidden=true;lock(true);
 try{
  C.Time.parseDate(d);
  status('Memuat ephemeris dan mencari Solar Return tahunan…');
  const A=await loadAstronomy();
  if(cancelled||token!==runId)return;
  const out=await SR.analyzeDay(C,A,d,h,
   p=>status('Solar Return · tren mingguan + fase M1 '+p+'%'),
   ()=>cancelled||token!==runId);
  if(cancelled||token!==runId)return;
  if(d!==$('dateInput')?.value||h!==Number($('srcomexHour').value))return;
  result=out;render();
  status('Selesai: 1.440 slot WIB · '+d+' · chart COMEX 1974 (jam asumsi) · keputusan trading WAIT.');
 }catch(e){
  result=null;$('srcomexResults').hidden=true;
  if(!cancelled&&token===runId)status(e?.message||'Solar Return gagal dihitung.',true);
 }finally{lock(false);}
}
$('srcomexRun').addEventListener('click',run);
$('srcomexCancel').addEventListener('click',()=>{
 cancelled=true;runId++;$('srcomexResults').hidden=true;status('Perhitungan dibatalkan.');
});
$('srcomexSelectedHour').addEventListener('change',renderHour);
$('srcomexHour').addEventListener('change',reset);
$('dateInput')?.addEventListener('change',reset);
$('srcomexMinuteRows').addEventListener('click',e=>{
 const node=e.target.closest('tr[data-min]');
 if(node)showMinute(Number(node.dataset.min));
});
$('srcomexJSON').addEventListener('click',()=>{
 if(!result)return;
 const v=SR.exportResearch(result);
 save('CEBONK_COMEX_SOLAR_RETURN_'+result.dateWIB+'_RESEARCH.json',
  JSON.stringify(v,null,2),'application/json');
});
$('srcomexCSV').addEventListener('click',()=>{
 if(!result)return;
 const header=['UTC','WIB','SR_YEAR','EVENT_TYPE','EVENT','ASPECT','ORB','PHASE','STRENGTH','WEEK_SR_BIAS','SR_TREND_RESEARCH','SR_POLARITY_REASON','TRADING_DECISION'];
 const lines=result.rows.map(r=>{
  const e=r.topEvent;
  return [r.utc,clock(r.ms),r.returnYear,r.eventType,e?.pair||'',
    e?.aspect||'',e?.orb??'',e?.phase||'',e?.strength??'',r.weekBias,
    r.eventPolarity,r.polarityReason,'WAIT'];
 });
 const safe=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
 save('CEBONK_COMEX_SOLAR_RETURN_'+result.dateWIB+'_1440M1.csv',
  [header,...lines].map(x=>x.map(safe).join(',')).join('\r\n'),
  'text/csv;charset=utf-8');
});
root.CebonkComexSolarReturnUI=Object.freeze({version:'2.0.0',mode:'COMEX_SOLAR_RETURN_PURE_WEEKLY_TREND'});
})(window);