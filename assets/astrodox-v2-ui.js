/* ASTRODOX V2 stand-alone panel — astronomical research only; no trade execution. */
(function(root){
'use strict';
const C=root.CebonkCore,V=root.CebonkAstrodoxV2,V1=root.CebonkAstrodoxFollowTrend;
const panel=document.getElementById('astroV2View');
if(!panel||!C||!V||!V1)return;
const $=id=>panel.querySelector('#'+id);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const clock=ms=>{const x=C.Time.wib(ms);return C.Time.dateISO(x)+' '+C.Time.hm(x);};
const hm=ms=>C.Time.hm(C.Time.wib(ms));
const fmt=(n,d=1)=>n===null||!Number.isFinite(n)?'—':Number(n).toFixed(d);
let busy=false,cancelled=false,report=null,baseline=null,date='',loadPromise=null,sequence=0;
panel.innerHTML=`
 <div class="v2-header"><p class="v2-kicker">SEKTE MUSANG · CEBONK COMPANY 22</p>
  <h2>ASTRODOX V2 · TIMING ASC/MC</h2>
  <p>Model riset astrologi murni terpisah. Arah sifat planet ≠ tren harga emas. Square/Opposition dihitung sebagai intensitas, bukan SELL otomatis.</p></div>
 <div class="v2-controls">
  <label>Tanggal WIB<input id="v2Date" type="date" min="2020-01-01" max="2040-12-31"></label>
  <label>Konfirmasi arah<select id="v2Confirm"><option value="3">15 menit</option><option value="6">30 menit</option><option value="9">45 menit</option></select></label>
  <label>Bobot ASC/MC (uji sensitivitas)<select id="v2Local"><option value="0.30">30%</option><option value="0.50" selected>50%</option><option value="0.70">70% (hipotesis)</option></select></label>
  <button id="v2Run" type="button">Hitung V2 5 menit</button>
  <button id="v2Cancel" type="button" disabled>Batalkan</button>
 </div>
 <p id="v2Status" class="v2-status" role="status">Hitung kalender astrologi untuk melihat hasil V2.</p>
 <p class="v2-warning"><b>BUKAN SINYAL TRADING LIVE.</b> Belum ada validasi XAUUSD M5 2024–2026. Hasil BUY/SELL berarti dominasi model astrologi; keputusan trading tetap WAIT. INTI dan AKHIR didapat setelah seluruh kalender astronomi dihitung.</p>
 <div id="v2Result" hidden>
  <div class="v2-cards">
   <div><small>FOKUS V2 · MOMEN ASTRO</small><strong id="v2Focus">—</strong><span id="v2Share">—</span></div>
   <div><small>FOKUS V1 · SKOR LAMA</small><strong id="v2Baseline">—</strong><span id="v2BaselineText">—</span></div>
   <div><small>BUKTI AKURASI HARGA</small><strong>BELUM ADA</strong><span>Perlu CSV XAUUSD M5 &amp; uji out-of-sample</span></div>
  </div>
  <div class="v2-times">
   <div><small>AWAL · WIB</small><strong id="v2Start">—</strong></div>
   <div><small>INTI · WIB</small><strong id="v2Core">—</strong></div>
   <div><small>AKHIR · WIB</small><strong id="v2End">—</strong></div>
  </div>
  <p id="v2Stats" class="v2-status"></p>
  <details class="v2-details"><summary>Daftar window AWAL–INTI–AKHIR</summary><div class="v2-scroll">
   <table><thead><tr><th>Arah</th><th>Awal</th><th>Inti</th><th>Akhir (eksklusif)</th><th>Menit</th><th>Intensitas inti</th></tr></thead><tbody id="v2Windows"></tbody></table></div></details>
  <details class="v2-details"><summary>Audit semua slot 5 menit &amp; aspek ASC/MC</summary><div class="v2-scroll v2-raw">
   <table><thead><tr><th>WIB</th><th>V1</th><th>V2</th><th>Alasan</th><th>Skor arah planet</th><th>Intensitas</th><th>ASC/MC</th><th>Antarplanet</th><th>Aspek lokal utama</th></tr></thead><tbody id="v2Rows"></tbody></table></div>
   <button id="v2CSV" type="button">Unduh CSV V1 vs V2</button></details>
  <details class="v2-details"><summary>Metodologi dan batas pengujian</summary>
   <p>Arah dihitung menggunakan sifat planet pada konfigurasi V1; geometri setiap aspek hanya menentukan bobot kedekatan, tidak memaksakan Square/Opposition = SELL. Aspek ASC/MC memberi timing non-arah. Skor intensitas 0–100 merupakan indeks relatif buatan model, bukan probabilitas. Default ASC/MC 50%; 30% dan 70% adalah uji sensitivitas, bukan hasil kalibrasi XAUUSD.</p>
   <p>Konfirmasi 3/6/9 slot berturut-turut; trigger lokal memerlukan kekuatan ≥30 dan intensitas gabungan ≥50. Semua angka ambang adalah hipotesis. Tanpa aspek valid atau tanpa arah stabil, WAIT. Tidak ada pengambilan harga, indikator teknikal, Al-Biruni, broker, atau perintah MT5.</p>
  </details>
 </div>`;
$('v2Date').value=C.Time.today();
function status(s,err=false){$('v2Status').textContent=s;$('v2Status').classList.toggle('v2-error',err);}
function reset(){report=null;baseline=null;$('v2Result').hidden=true;status('Parameter berubah. Hitung ulang V2.');}
for(const id of ['v2Date','v2Confirm','v2Local'])$(id).addEventListener('change',reset);
function setBusy(v){
 busy=v;
 for(const id of ['v2Date','v2Confirm','v2Local','v2Run'])$(id).disabled=v;
 $('v2Cancel').disabled=!v;$('v2Run').textContent=v?'Menghitung…':'Hitung V2 5 menit';
}
function inject(url){return new Promise((resolve,reject)=>{
 const s=document.createElement('script');s.src=url;s.async=true;s.referrerPolicy='no-referrer';
 s.onload=()=>resolve();s.onerror=()=>{s.remove();reject(Error('Astronomy Engine gagal dimuat.'));};document.head.append(s);
});}
async function astronomy(){
 if(root.Astronomy)return root.Astronomy;
 if(!loadPromise)loadPromise=(async()=>{
  for(const src of ['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
   'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js']){
   try{await inject(src);if(root.Astronomy)return root.Astronomy;}catch(e){/* try mirror */}
  }
  throw Error('Ephemeris tak tersedia; tidak membuat hasil pengganti.');
 })();
 try{return await loadPromise;}catch(e){loadPromise=null;throw e;}
}
function render(){
 const r=report,b=baseline,f=r.focusWindow;
 $('v2Focus').textContent=r.focus;
 $('v2Baseline').textContent=b.focus;
 $('v2Share').textContent=r.directionalShare===null?'Tidak ada slot directional':
  'Dominasi waktu '+fmt(r.directionalShare*100)+'% · bukan winrate';
 $('v2BaselineText').textContent='V1 BUY '+b.buyMinutes+'m / SELL '+b.sellMinutes+'m';
 $('v2Start').textContent=f?hm(f.start):'—';
 $('v2Core').textContent=f?hm(f.core):'—';
 $('v2End').textContent=f?hm(f.end):'—';
 $('v2Stats').textContent=date+' · BUY '+r.buyMinutes+' menit · SELL '+r.sellMinutes+
  ' menit · WAIT '+r.waitMinutes+' menit · '+r.windows.length+' window · '+r.reversals+' perubahan arah terkonfirmasi';
 $('v2Windows').innerHTML=r.windows.length?r.windows.map(w=>'<tr><td>'+w.direction+
  '</td><td>'+esc(clock(w.start))+'</td><td>'+esc(clock(w.core))+'</td><td>'+
  esc(clock(w.end))+'</td><td>'+w.minutes+'</td><td>'+fmt(w.coreIntensity)+'%</td></tr>').join(''):
  '<tr><td colspan="6">Tidak ada momen yang lolos filter.</td></tr>';
 $('v2Rows').innerHTML=r.rows.map((s,i)=>{
  const ev=s.event?s.event.planet+'–'+s.event.angle+' '+s.event.aspect+' / '+s.event.phase+
   ' / orb '+fmt(s.event.orb,3)+'°':'—';
  return '<tr><td>'+esc(clock(s.ms))+'</td><td>'+b.rows[i].state+'</td><td>'+s.state+
   '</td><td>'+s.reason+'</td><td>'+fmt(s.directionScore,3)+'</td><td>'+fmt(s.intensity)+
   '%</td><td>'+fmt(s.localPct)+'%</td><td>'+fmt(s.planetPct)+
   '%</td><td>'+esc(ev)+'</td></tr>';
 }).join('');
 $('v2Result').hidden=false;
}
$('v2Cancel').addEventListener('click',()=>{cancelled=true;status('Membatalkan perhitungan…');});
$('v2Run').addEventListener('click',async()=>{
 if(busy)return;
 cancelled=false;const request=++sequence;date=$('v2Date').value;
 report=null;baseline=null;$('v2Result').hidden=true;
 try{
  C.Time.parseDate(date);
  const confirm=Number($('v2Confirm').value),localShare=Number($('v2Local').value);
  if(![3,6,9].includes(confirm)||![0.30,0.50,0.70].includes(localShare))
   throw Error('Parameter tidak valid.');
  setBusy(true);status('Memuat ephemeris…');
  const engine=C.createEngine(await astronomy());
  if(cancelled)throw Error('Dibatalkan.');
  const samples=await C.scan(engine,date,360,true,
   p=>status('Menghitung konfigurasi astronomi '+p+'%'),()=>cancelled);
  if(cancelled||request!==sequence)throw Error('Dibatalkan.');
  report=V.evaluate(samples,C.CFG,{confirmBars:confirm,localShare});
  baseline=V1.calculate(samples,{confirmBars:confirm,graceBars:3,stepMinutes:5,
   buyThreshold:C.CFG.buy,sellThreshold:C.CFG.sell});
  render();status('Perhitungan selesai · '+samples.length+' slot. Bukan hasil backtest harga. Trading tetap WAIT.');
 }catch(e){report=null;baseline=null;$('v2Result').hidden=true;status(e.message,true);}
 finally{setBusy(false);}
});
$('v2CSV').addEventListener('click',()=>{
 if(!report||!baseline)return;
 const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 const hdr=['timestamp_wib','v1_state','v2_state','astro_direction_score','astro_intensity',
  'asc_mc_intensity','interplanet_intensity','reason','trade_decision'];
 const csv=[hdr,...report.rows.map((r,i)=>[clock(r.ms),baseline.rows[i].state,r.state,
  r.directionScore,r.intensity,r.localPct,r.planetPct,r.reason,'WAIT'])]
  .map(x=>x.map(quote).join(',')).join('\r\n')+'\r\n';
 const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='ASTRODOX_V1_V2_'+date+'.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
root.CebonkAstrodoxV2UI=Object.freeze({version:V.VERSION,model:'ASTRODOX_V2_PURE_ASTROLOGY'});
})(window);
