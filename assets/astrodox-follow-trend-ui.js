/* ASTRODOX FOLLOW TREND — standalone mobile-first research panel.
 * Uses ONLY the existing CebonkCore.scan V1 astronomical scores.
 * Never reads Al-Biruni, historical price, technical inputs, trade feeds or EA.
 */
(function(root){
'use strict';
const C=root.CebonkCore,F=root.CebonkAstrodoxFollowTrend;
const panel=document.getElementById('astroFollowTrendView');
if(!panel||!C||!F)return;
const esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const $=id=>panel.querySelector('#'+id);
let report=null,selectedDate=null,busy=false,cancelled=false,libraryPromise=null;
const format=ms=>ms==null?'—':C.Time.dateISO(C.Time.wib(ms))+' '+C.Time.hm(C.Time.wib(ms))+' WIB';
const hour=ms=>ms==null?'—':C.Time.hm(C.Time.wib(ms));
panel.innerHTML=`
 <div class="aft-header">
  <div><div class="aft-kicker">ASTRODOX V1 · MODUL TERPISAH</div><h2 id="aftTitle">FOLLOW TREND ASTROLOGI</h2>
   <p>Ngikuti arah skor ASTRODOX V1 sing bertahan. Ora nganggo Al-Biruni, BBMA, harga, utawa indikator teknikal.</p></div>
  <span class="aft-type">RISET 5 MENIT</span>
 </div>
 <div class="aft-body">
  <div class="aft-controls">
   <label for="aftDate">Tanggal WIB<input id="aftDate" type="date" min="2020-01-01" max="2040-12-31" required></label>
   <label for="aftConfirm">Konfirmasi arah<select id="aftConfirm">
    <option value="3" selected>15 menit · responsif</option>
    <option value="6">30 menit · moderat</option>
    <option value="9">45 menit · konservatif</option>
   </select></label>
   <button id="aftRun" class="aft-primary" type="button">Hitung Follow Trend</button>
   <button id="aftCancel" type="button" disabled>Batalkan</button>
  </div>
  <p class="aft-note"><strong>KEPUTUSAN TRADING: WAIT.</strong> BUY/SELL di bawah iki arah <em>skor astrologi</em>, dudu tren harga XAUUSD sing wis teruji. Simulasi 06:00–24:00 WIB. Ora ngirim perintah EA.</p>
  <p id="aftStatus" class="aft-status" role="status" aria-live="polite">Pilih tanggal banjur tekan Hitung Follow Trend.</p>
  <div id="aftResult" hidden>
   <div class="aft-focus">
    <div><small>DOMINASI HARIAN MODEL</small><strong id="aftDirection">—</strong><span id="aftShare">—</span></div>
    <div><small>KONDISI AKHIR RENTANG</small><strong id="aftEndState">—</strong><span id="aftReverse">—</span></div>
   </div>
   <div class="aft-times">
    <div><small>AWAL</small><strong id="aftStart">—</strong></div>
    <div><small>INTI</small><strong id="aftCore">—</strong></div>
    <div><small>AKHIR</small><strong id="aftEnd">—</strong></div>
   </div>
   <p id="aftBreakdown" class="aft-breakdown"></p>
   <p class="aft-subnote">AWAL = saat konfirmasi 3/6/9 slot selesai, <b>bukan</b> permulaan gerak emas. INTI = puncak skor yang diketahui setelah seluruh window dihitung; bukan sinyal yang tersedia sejak AWAL. AKHIR = akhir segmen skor, bukan penutupan order.</p>
   <details class="aft-details">
    <summary>Rincian window &amp; semua skor 5 menit</summary>
    <div class="aft-scroll"><table><thead><tr><th>Arah skor</th><th>AWAL WIB</th><th>INTI WIB</th><th>AKHIR WIB</th><th>Durasi</th></tr></thead><tbody id="aftWindows"></tbody></table></div>
    <div class="aft-scroll aft-raw"><table><thead><tr><th>Jam WIB</th><th>Skor V1</th><th>Arah awal</th><th>Follow Trend</th><th>Alasan</th></tr></thead><tbody id="aftRows"></tbody></table></div>
    <button id="aftCSV" type="button">Unduh CSV riset</button>
   </details>
  </div>
  <details class="aft-method"><summary>Aturan versi Follow Trend</summary>
   <p>Rumus skor planet, ambang BUY/SELL +1,15/−1,15, dan grid 5 menit <strong>tidak diubah</strong>. Kandidat arah harus muncul berturut-turut 3, 6, atau 9 slot (dipilih). Perubahan arah sebelum terkonfirmasi menjadi WAIT; setelah jeda netral 15 menit, arah lama tidak dipertahankan. Perhitungan waktu memakai WIB UTC+7.</p>
   <p>DOMINASI HARIAN adalah agregasi semua slot terkonfirmasi, dengan porsi minimal 55% dari menit directional; iki ringkasan seluruh hari, bukan informasi realtime sejak pagi. Data langit masa depan dapat dihitung, tetapi akurasi prediksi harga emas belum dibuktikan. Status untuk keputusan order tetap WAIT.</p>
  </details>
 </div>`;
$('aftDate').value=C.Time.today();
const setStatus=(msg,bad=false)=>{$('aftStatus').textContent=msg;$('aftStatus').classList.toggle('aft-error',bad);};
const invalidate=()=>{report=null;selectedDate=null;$('aftResult').hidden=true;setStatus('Setelan berubah. Hitung ulang ASTRODOX Follow Trend.');};
for(const id of ['aftDate','aftConfirm'])$(id).addEventListener('change',invalidate);
function setBusy(v){
 busy=v;
 for(const id of ['aftDate','aftConfirm','aftRun'])$(id).disabled=v;
 $('aftCancel').disabled=!v;
 $('aftRun').textContent=v?'Menghitung…':'Hitung Follow Trend';
}
function downloadCSV(){
 if(!report||!selectedDate)return;
 const quote=x=>'"'+String(x===null?'':x).replace(/"/g,'""')+'"';
 const header=['tanggal_wib','jam_wib','skor_astrodox_V1_BELUM_VALID','arah_mentah','follow_trend_model','alasan','keputusan_trading'];
 const lines=[header,...report.rows.map(r=>[selectedDate,hour(r.ms),r.score.toFixed(6),r.raw,r.state,r.reason,'WAIT'])];
 const text='\uFEFF'+lines.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='ASTRODOX_FOLLOW_TREND_'+selectedDate+'.csv';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
$('aftCSV').addEventListener('click',downloadCSV);
function render(date,confirm){
 const x=report,window=x.focusWindow;
 const focus=$('aftDirection');focus.textContent=x.focus;
 focus.className=x.focus==='BUY'?'aft-buy':x.focus==='SELL'?'aft-sell':'aft-wait';
 $('aftShare').textContent=x.directionalShare==null?'Tidak ada arah terkonfirmasi':
  'Porsi dominan '+(x.directionalShare*100).toFixed(1)+'% dari menit yang punya arah';
 $('aftEndState').textContent=x.last.state;
 $('aftEndState').className=x.last.state==='BUY'?'aft-buy':x.last.state==='SELL'?'aft-sell':'aft-wait';
 $('aftReverse').textContent=x.reversals+' kali pergantian dominasi terkonfirmasi · akhir rentang, bukan sinyal live';
 $('aftStart').textContent=window?hour(window.start):'—';
 $('aftCore').textContent=window?hour(window.core):'—';
 $('aftEnd').textContent=window?hour(window.end):'—';
 $('aftBreakdown').textContent=date+' WIB · konfirmasi '+(confirm*5)+' menit · BUY '+x.buyMinutes+
  ' menit / SELL '+x.sellMinutes+' menit / WAIT '+x.waitMinutes+
  ' menit · '+x.windows.length+' segmen terkonfirmasi.';
 $('aftWindows').innerHTML=x.windows.map(w=>'<tr><td>'+esc(w.direction)+'</td><td>'+esc(format(w.start))+
  '</td><td>'+esc(format(w.core))+'</td><td>'+esc(format(w.end))+
  '</td><td>'+w.minutes+' menit</td></tr>').join('')||
  '<tr><td colspan="5">Tidak ada arah yang lolos konfirmasi.</td></tr>';
 $('aftRows').innerHTML=x.rows.map(r=>'<tr><td>'+esc(hour(r.ms))+'</td><td>'+r.score.toFixed(3)+
  '</td><td>'+esc(r.raw)+'</td><td>'+esc(r.state)+'</td><td>'+esc(r.reason)+'</td></tr>').join('');
 $('aftResult').hidden=false;
}
function injectScript(url){
 return new Promise((resolve,reject)=>{
  const el=document.createElement('script');
  el.src=url;el.async=true;el.referrerPolicy='no-referrer';
  el.onload=resolve;el.onerror=()=>{el.remove();reject(Error('Ephemeris tidak dapat dimuat'));};
  document.head.append(el);
 });
}
async function loadAstronomy(){
 if(root.Astronomy)return root.Astronomy;
 if(!libraryPromise)libraryPromise=(async()=>{
  const urls=['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
   'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js'];
  for(const u of urls){
   if(root.Astronomy)return root.Astronomy;
   try{await injectScript(u);if(root.Astronomy)return root.Astronomy;}catch(e){/* try mirror */}
  }
  throw Error('Astronomy Engine gagal dimuat; tidak dibuat sinyal pengganti.');
 })();
 try{return await libraryPromise;}catch(e){libraryPromise=null;throw e;}
}
async function run(){
 if(busy)return;
 const date=$('aftDate').value,confirm=Number($('aftConfirm').value);
 let engine=null;cancelled=false;report=null;selectedDate=null;
 $('aftResult').hidden=true;
 try{
  C.Time.parseDate(date);
  if(![3,6,9].includes(confirm))throw Error('Konfirmasi tidak valid.');
  setBusy(true);setStatus('Memuat ephemeris astrologi ASTRODOX V1…');
  const A=await loadAstronomy();
  if(cancelled)throw Error('Dibatalkan.');
  engine=C.createEngine(A);
  const samples=await C.scan(engine,date,360,true,
   p=>setStatus('Menghitung skor astrologi 5 menit · '+p+'%'),()=>cancelled);
  if(cancelled)throw Error('Dibatalkan.');
  const next=F.calculate(samples,{confirmBars:confirm,graceBars:3,stepMinutes:C.CFG.step,
   buyThreshold:C.CFG.buy,sellThreshold:C.CFG.sell});
  if(cancelled)throw Error('Dibatalkan.');
  selectedDate=date;report=next;
  render(date,confirm);
  setStatus('Selesai: '+samples.length+' slot ASTRODOX V1. Arah Follow Trend hanya hipotesis; status trading tetap WAIT.');
 }catch(e){
  report=null;selectedDate=null;
  $('aftResult').hidden=true;
  setStatus((e&&e.message)||'Perhitungan gagal. Tidak ada sinyal pengganti.',true);
 }finally{
  if(engine)engine.clear();
  setBusy(false);
 }
}
$('aftRun').addEventListener('click',run);
$('aftCancel').addEventListener('click',()=>{cancelled=true;setStatus('Membatalkan penghitungan ASTRODOX…');});
root.CebonkAstrodoxFollowTrendUI=Object.freeze({model:'PURE_ASTROLOGY_V1',version:'1.0.0'});
})(window);
