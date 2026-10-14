/* CEBONK Event Polarity M1 independent dashboard.
 * Astro-only by default. Optional D1 is MANUAL HYBRID guard, never price API.
 */
(function(root){
'use strict';
const C=root.CebonkCore,M=root.CebonkAstrodoxM1,P=root.CebonkEventPolarityM1;
const astro=document.getElementById('astroView');
if(!astro||!C||!M||!P||document.getElementById('epmPanel'))return;
const $=id=>document.getElementById(id);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=ms=>C.Time.hm(C.Time.wib(ms));
const date=()=>document.getElementById('dateInput')?.value;
const fmt=n=>Number.isFinite(n)?n.toFixed(3):'—';
const pct=n=>Number.isFinite(n)?Math.round(n*100)+'%':'—';
const color=x=>x==='BUY'?'buy':x==='SELL'?'sell':'neutral';
let scan=null,raw=null,report=null,astronomyPromise=null,cancelled=false,busy=false,runId=0;
const section=document.createElement('section');
section.className='panel epm-panel';
section.id='epmPanel';
section.innerHTML=[
 '<div class="head"><div><h2>EVENT POLARITY · FOLLOW TREND M1</h2>',
 '<small>Mesin riset terpisah · Astrology per menit · bukan tren harga D1</small></div>',
 '<span class="epm-chip">M1 · V1.0</span></div>',
 '<div class="epm-body"><div class="epm-controls">',
 '<label>Tren skor Astro <select id="epmTrend">',
 '<option value="10">10 menit · cepat</option><option value="15" selected>15 menit · default</option>',
 '<option value="30">30 menit · moderat</option><option value="60">60 menit · lambat</option>',
 '</select></label>',
 '<label>Konfirmasi M1 <select id="epmConfirm">',
 '<option value="2" selected>2 menit</option><option value="3">3 menit</option><option value="5">5 menit</option>',
 '</select></label>',
 '<label>Guard D1 emas (manual, opsional) <select id="epmGuard">',
 '<option value="OFF" selected>OFF · Astrology murni</option>',
 '<option value="BUY">D1 BUY · hanya BUY</option>',
 '<option value="SELL">D1 SELL · hanya SELL</option>',
 '</select></label>',
 '<button id="epmRun" class="primary" type="button">Hitung Event Polarity Sehari</button>',
 '<button id="epmCancel" type="button" disabled>Batalkan</button>',
 '</div>',
 '<div class="epm-note"><strong>Aturan:</strong> tren = rata-rata skor Astrology V2 masa lalu;',
 ' Trine/Sextile = kandidat kelanjutan, Square/Opposition = pantau reversal, Konjungsi = tunggu.',
 ' Semua sinyal membutuhkan konfirmasi M1. <strong>Tidak membaca harga GOLD/D1.</strong>',
 ' Guard D1 bila aktif ialah pembanding manual yang mengubah tampilan jadi HYBRID, bukan mengubah astrologi.</div>',
 '<div id="epmStatus" role="status" aria-live="polite" class="epm-status">',
 'Pilih tanggal di atas, lalu tekan Hitung Event Polarity Sehari.</div>',
 '<div id="epmResults" hidden>',
 '<div class="epm-summary">',
 '<div><small>Polarity BUY</small><strong class="buy" id="epmBuy">—</strong></div>',
 '<div><small>Polarity SELL</small><strong class="sell" id="epmSell">—</strong></div>',
 '<div><small>WAIT / diblokir</small><strong id="epmWait">—</strong></div>',
 '<div><small>Event unik lolos</small><strong id="epmEvents">—</strong></div>',
 '</div>',
 '<p class="epm-note" id="epmDaily"></p>',
 '<div class="epm-toolbar">',
 '<label for="epmHour">Tampilkan jam WIB</label><select id="epmHour"></select>',
 '<button id="epmCSV" type="button">Unduh CSV M1</button>',
 '<button id="epmJSON" type="button">Unduh JSON riset EA</button>',
 '</div>',
 '<div class="epm-scroll"><table><thead><tr>',
 '<th>Jam WIB</th><th>Trend Astro</th><th>Event polarity</th><th>Jenis event</th>',
 '<th>Orb</th><th>Skor tren</th><th>Alasan</th><th>Event baru</th>',
 '</tr></thead><tbody id="epmMinuteRows"></tbody></table></div>',
 '<div class="epm-detail" id="epmDetail">Pilih menit untuk rincian event.</div>',
 '<h3 class="epm-subhead">Event terkonfirmasi (seluruh tanggal)</h3>',
 '<div class="epm-scroll epm-eventscroll"><table><thead><tr><th>WIB</th><th>Polarity</th>',
 '<th>Pasangan planet</th><th>Jenis</th><th>Orb</th></tr></thead>',
 '<tbody id="epmEventRows"></tbody></table></div>',
 '<p class="epm-note">Event unik = perubahan kondisi penelitian, <b>bukan order</b>.',
 ' Tidak ada janji entry setiap hari. AWAL/INTI/AKHIR yang diringkas bersifat retrospektif.',
 ' Semua data hanya untuk evaluasi dan backtest; izin trading tetap WAIT.</p>',
 '</div></div>'
].join('');
const styles=document.createElement('style');
styles.textContent=[
 '.epm-panel{border-color:#425577;margin:16px 0}',
 '.epm-panel .head{flex-wrap:wrap}.epm-chip{font-size:10px;color:var(--cyan);border:1px solid var(--line);padding:5px 8px;border-radius:99px}',
 '.epm-body{padding:14px}.epm-controls{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px}',
 '.epm-controls label{display:flex;flex-direction:column;font-size:11px;gap:4px;color:var(--muted)}',
 '.epm-controls select{width:100%;min-height:42px}',
 '.epm-controls button{min-height:42px}.epm-controls #epmRun{grid-column:1/3}',
 '.epm-note{font-size:11px;line-height:1.65;color:var(--muted);margin:11px 0}',
 '.epm-status{color:var(--cyan);font-size:12px;min-height:26px;margin:12px 0}',
 '.epm-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}',
 '.epm-summary>div{border:1px solid var(--line);background:var(--panel2);border-radius:9px;padding:11px}',
 '.epm-summary small{color:var(--muted);font-size:10px;display:block}',
 '.epm-summary strong{font-size:19px;display:block;margin-top:5px;font-variant-numeric:tabular-nums}',
 '.epm-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}',
 '.epm-toolbar label{font-size:11px;color:var(--muted)}',
 '.epm-toolbar select{min-width:105px;flex:1}.epm-toolbar button{font-size:11px;min-height:40px}',
 '.epm-scroll{overflow:auto;max-height:370px;border:1px solid var(--line);border-radius:9px}',
 '.epm-scroll th,.epm-scroll td{white-space:nowrap;font-size:11px;padding:9px 10px}',
 '.epm-scroll tr[data-row]{cursor:pointer}.epm-scroll tr[data-row]:hover{background:var(--panel2)}',
 '.epm-scroll tr.epm-picked{background:#21354b}',
 '.epm-detail{border:1px solid var(--line);background:var(--panel2);border-radius:8px;',
 'padding:12px;margin:11px 0;font-size:12px;overflow-wrap:anywhere}',
 '.epm-subhead{font-size:13px;margin:18px 0 9px}.epm-eventscroll{max-height:280px}',
 '@media(max-width:760px){.epm-body{padding:11px}.epm-controls{grid-template-columns:1fr 1fr}',
 '.epm-controls label:nth-child(3){grid-column:1/-1}',
 '.epm-controls #epmRun{grid-column:1/-1}.epm-controls #epmCancel{grid-column:1/-1}',
 '.epm-summary{grid-template-columns:1fr 1fr}.epm-summary strong{font-size:17px}',
 '.epm-toolbar button{flex:1 1 140px}.epm-scroll{max-height:320px}}'
].join('');
document.head.append(styles);
const sourcePanel=$('astroM1Panel');
if(sourcePanel&&sourcePanel.parentElement===astro)sourcePanel.insertAdjacentElement('afterend',section);
else {
 const results=$('results');
 if(results&&results.parentElement===astro)astro.insertBefore(section,results);
 else astro.append(section);
}
const hour=$('epmHour');
for(let i=0;i<24;i++){
 const option=document.createElement('option');
 option.value=String(i);option.textContent=String(i).padStart(2,'0')+':00–'+String((i+1)%24).padStart(2,'0')+':00';
 hour.append(option);
}
hour.value=String(C.Time.wib(Date.now()).hour);
function status(msg,error){
 $('epmStatus').textContent=msg;
 $('epmStatus').style.color=error?'var(--sell)':'var(--cyan)';
}
function lock(locked){
 busy=locked;
 for(const id of ['epmRun','epmTrend','epmConfirm'])$(id).disabled=locked;
 $('epmCancel').disabled=!locked;
 $('epmRun').textContent=locked?'Menghitung M1…':'Hitung Event Polarity Sehari';
}
function forget(){
 cancelled=true;runId++;scan=null;raw=null;report=null;
 $('epmResults').hidden=true;
 status('Setelan atau tanggal berubah. Hitung Event Polarity lagi.');
}
function showMinute(index){
 if(!report||!report.rows[index])return;
 const r=report.rows[index];
 const current=$('epmMinuteRows').querySelectorAll('tr[data-row]');
 for(const tr of current)tr.classList.toggle('epm-picked',Number(tr.dataset.row)===index);
 $('epmDetail').innerHTML=
  '<b>'+clock(r.ms)+' WIB · '+escapeHTML(r.eventPair||'Tidak ada event aktif')+'</b>'+
  '<p class="epm-note">Event '+escapeHTML(r.eventName||'—')+
  ' · '+escapeHTML(r.eventType)+' · '+escapeHTML(r.phase||'—')+
  ' · orb '+fmt(r.orb)+'° · kekuatan relatif '+pct(r.eventStrength)+
  ' · skor tren '+fmt(r.astroTrendScore)+' · konfirmasi '+r.confirmationBars+
  ' M1 · '+escapeHTML(r.reason)+'.</p>'+
  '<p class="epm-note"><b>Trend Astro:</b> '+escapeHTML(r.astroTrend)+
  ' · <b>Polarity asli:</b> '+escapeHTML(r.polarity)+
  ' · <b>Setelah guard D1:</b> '+escapeHTML(r.guardedPolarity)+
  (r.blockedByManualD1?' (BLOKIR D1 MANUAL)':'')+
  '. Keputusan transaksi otomatis tetap WAIT.</p>';
}
function renderHour(){
 if(!report)return;
 const h=Number(hour.value),idx=[];
 for(let i=0;i<report.rows.length;i++){
   if(C.Time.wib(report.rows[i].ms).hour===h)idx.push(i);
 }
 const sectionRows=idx.map(i=>{
  const r=report.rows[i],decision=r.guardedPolarity;
  return '<tr data-row="'+i+'"><td>'+clock(r.ms)+'</td>'+
   '<td class="'+color(r.astroTrend)+'">'+escapeHTML(r.astroTrend)+'</td>'+
   '<td class="'+color(decision)+'"><strong>'+escapeHTML(decision)+'</strong></td>'+
   '<td>'+escapeHTML(r.eventType)+'</td><td>'+fmt(r.orb)+'°</td>'+
   '<td>'+fmt(r.astroTrendScore)+'</td><td>'+escapeHTML(r.reason)+'</td>'+
   '<td>'+(r.entryEvent?'EVENT':'—')+'</td></tr>';
 });
 $('epmMinuteRows').innerHTML=sectionRows.join('');
 if(idx.length)showMinute(idx[0]);
}
function refresh(){
 if(!scan||!raw)return;
 const guard=$('epmGuard').value;
 report=P.applyD1Guard(raw,guard);
 const c=report.counts;
 $('epmBuy').textContent=c.BUY+'m';
 $('epmSell').textContent=c.SELL+'m';
 $('epmWait').textContent=c.WAIT+'m';
 $('epmEvents').textContent=report.eligibleEvents??report.directionalEvents;
 const line=guard==='OFF'?'ASTROLOGY MURNI · tanpa data harga D1':
   'HYBRID GUARD MANUAL '+guard+' · arah lawan D1 disembunyikan (WAIT)';
 const fw=guard==='OFF'?report.focusWindow:null;
 $('epmDaily').textContent='Tanggal '+scan.date+' WIB · '+line+
   ' · jumlah 1.440 menit · konfirmasi '+raw.options.confirmMinutes+' M1.'+
   (fw?' Window terpanjang '+fw.direction+': AWAL '+clock(Date.parse(fw.awalUTC))+
     ', INTI '+clock(Date.parse(fw.intiUTC))+
     ', AKHIR '+clock(Date.parse(fw.akhirUTC))+' (retrospektif).':'');
 const events=report.rows.filter(r=>r.entryEvent);
 $('epmEventRows').innerHTML=events.length?events.map(r=>
  '<tr><td>'+clock(r.ms)+'</td><td class="'+color(r.guardedPolarity)+'">'+
  escapeHTML(r.guardedPolarity)+'</td><td>'+escapeHTML(r.eventPair||'—')+'</td>'+
  '<td>'+escapeHTML(r.eventType)+'</td><td>'+fmt(r.orb)+'°</td></tr>'
 ).join(''):'<tr><td colspan="5">Tidak ada event yang lolos. Jangan memaksa transaksi.</td></tr>';
 $('epmResults').hidden=false;
 renderHour();
 status('Selesai · '+raw.rows.length+' menit · '+line+'. Belum divalidasi terhadap harga emas.');
}
function inject(u){
 return new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src=u;s.async=true;s.referrerPolicy='no-referrer';
  s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Gagal memuat Astronomy Engine'));};
  document.head.append(s);
 });
}
async function loadAstronomy(){
 if(root.Astronomy)return root.Astronomy;
 if(!astronomyPromise)astronomyPromise=(async()=>{
  for(const u of ['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
   'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js']){
   if(root.Astronomy)return root.Astronomy;
   try{await inject(u);if(root.Astronomy)return root.Astronomy;}catch(e){/* mirror */}
  }
  throw Error('Astronomy Engine tidak tersedia; tidak ada data pengganti.');
 })();
 try{return await astronomyPromise;}catch(e){astronomyPromise=null;throw e;}
}
async function run(){
 if(busy)return;
 const selectedDate=date(),trendMinutes=Number($('epmTrend').value),
 confirmMinutes=Number($('epmConfirm').value),ticket=++runId;
 cancelled=false;scan=null;raw=null;report=null;
 $('epmResults').hidden=true;lock(true);
 let engine=null;
 try{
  C.Time.parseDate(selectedDate);
  status('Menyiapkan posisi planet dan event per menit...');
  const A=await loadAstronomy();
  if(cancelled||ticket!==runId)return;
  engine=C.createEngine(A);
  scan=await M.calculateDay(engine,selectedDate,
   p=>status('Menghitung ephemeris M1 '+p+'% · 1.440 menit'),
   ()=>cancelled||ticket!==runId);
  if(cancelled||ticket!==runId)return;
  if(selectedDate!==date())throw Error('Tanggal berubah; hitung ulang.');
  raw=P.compute(scan.rows,{trendMinutes,confirmMinutes});
  refresh();
 }catch(e){
  scan=null;raw=null;report=null;$('epmResults').hidden=true;
  if(ticket===runId&&!cancelled)status(e?.message||'Perhitungan gagal.',true);
 }finally{
  engine?.clear();lock(false);
 }
}
function saveFile(filename,body,mime){
 const url=URL.createObjectURL(new Blob([body],{type:mime}));
 try{
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),1800);}
}
function exportRows(){
 if(!report||!scan)return null;
 return report.rows.map(r=>({
  utc:new Date(r.ms).toISOString(),timeWIB:clock(r.ms),
  astroTrend:r.astroTrend,astroMean:r.astroTrendScore,
  event:r.eventPair,eventType:r.eventType,eventPhase:r.phase,
  orb:r.orb,eventStrength:r.eventStrength,
  polarityRaw:r.polarity,polarityGuarded:r.guardedPolarity,
  polarityNumber:r.guardedPolarity==='BUY'?1:r.guardedPolarity==='SELL'?-1:0,
  eventId:r.eventId,eventTriggerResearch:r.entryEvent,
  reason:r.reason,blockedByManualD1:r.blockedByManualD1,tradeDecision:'WAIT'
 }));
}
$('epmRun').addEventListener('click',run);
$('epmCancel').addEventListener('click',()=>{
 cancelled=true;runId++;status('Dibatalkan.');$('epmResults').hidden=true;
});
for(const id of ['epmTrend','epmConfirm'])$(id).addEventListener('change',()=>{
 if(busy){cancelled=true;runId++;return;}
 if(scan){raw=P.compute(scan.rows,{trendMinutes:Number($('epmTrend').value),
  confirmMinutes:Number($('epmConfirm').value)});refresh();}
 else forget();
});
$('epmGuard').addEventListener('change',()=>{if(raw&&!busy)refresh();});
hour.addEventListener('change',renderHour);
$('epmMinuteRows').addEventListener('click',e=>{
 const tr=e.target.closest('tr[data-row]');if(tr)showMinute(Number(tr.dataset.row));
});
$('dateInput')?.addEventListener('change',forget);
$('epmCSV').addEventListener('click',()=>{
 const rows=exportRows();if(!rows)return;
 const keys=Object.keys(rows[0]);
 const escapeCSV=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
 const data=[keys.join(','),...rows.map(r=>keys.map(k=>escapeCSV(r[k])).join(','))].join('\r\n');
 saveFile('CEBONK_EVENT_POLARITY_M1_'+scan.date+'.csv',data,'text/csv;charset=utf-8');
});
$('epmJSON').addEventListener('click',()=>{
 const rows=exportRows();if(!rows)return;
 const payload={
  schema:'CEBONK_EVENT_POLARITY_M1_RESEARCH_V1',dateWIB:scan.date,
  timezone:'Asia/Jakarta',minutes:rows.length,
  mode:report.guard==='OFF'?'PURE_ASTROLOGY':'MANUAL_D1_HYBRID',
  guardD1:report.guard,options:raw.options,
  description:'Event polarity follows ASTRO score trend only. Not validated for GOLD.',
  validatedForXAUUSD:false,allowAutoTrade:false,tradeDecision:'WAIT',
  records:rows
 };
 saveFile('CEBONK_EVENT_POLARITY_M1_'+scan.date+'_RESEARCH.json',
  JSON.stringify(payload,null,2),'application/json');
});
root.CebonkEventPolarityM1UI=Object.freeze({version:'1.0.0',mode:'ASTRO_RESEARCH'});
})(window);