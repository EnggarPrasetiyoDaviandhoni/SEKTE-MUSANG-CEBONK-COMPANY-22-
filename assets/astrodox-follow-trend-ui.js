/* ASTRODOX FOLLOW TREND — standalone mobile-first research panel.
 * Uses ONLY the existing CebonkCore.scan V1 astronomical scores.
 * Never reads Al-Biruni, historical price, technical inputs, trade feeds or EA.
 */
(function(root){
'use strict';
const C=root.CebonkCore,F=root.CebonkAstrodoxFollowTrend,P=root.CebonkAstrodoxPlanetStrength;
const panel=document.getElementById('astroFollowTrendView');
if(!panel||!C||!F||!P)return;
const esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const $=id=>panel.querySelector('#'+id);
let report=null,configuration=null,selectedDate=null,busy=false,cancelled=false,libraryPromise=null;
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
   <section class="aft-planet-panel" aria-label="Konfigurasi planet dan aspek ASTRODOX">
    <h3>KONFIGURASI PLANET · PERSENTASE BOBOT ASPEK</h3>
    <div class="aft-planet-percent">
     <div><small>BOBOT BUY</small><strong id="aftPlanetBuy" class="aft-buy">—</strong></div>
     <div><small>BOBOT SELL</small><strong id="aftPlanetSell" class="aft-sell">—</strong></div>
     <div><small>SELISIH BERSIH</small><strong id="aftPlanetNet">—</strong></div>
    </div>
    <p id="aftPlanetDirection" class="aft-planet-direction">—</p>
    <p id="aftPlanetCoverage" class="aft-planet-explanation"></p>
    <p class="aft-subnote">Persentase = porsi total <b>bobot aspek planet V1</b> positif/negatif, dihitung dari longitude, derajat aspek, orb, serta fase Applying/Exact/Separating. <b>Bukan persentase naik/turun harga, peluang profit, atau kekuatan absolut.</b> Zodiak ditampilkan sebagai posisi planet, bukan skor baru.</p>
    <details class="aft-details">
     <summary>Audit planet, zodiak, longitude, degrees &amp; aspek</summary>
     <p class="aft-audit-label">Kontribusi tiap planet (% dari total bobot konfigurasi)</p>
     <div class="aft-scroll"><table><thead><tr><th>Planet</th><th>Bobot BUY</th><th>Bobot SELL</th><th>Porsi semua aspek</th></tr></thead><tbody id="aftPlanetRanking"></tbody></table></div>
     <p class="aft-audit-label">Kontribusi posisi zodiak (% dari total bobot, tanpa bobot arah zodiak baru)</p>
     <div class="aft-scroll"><table><thead><tr><th>Zodiak</th><th>Bobot BUY</th><th>Bobot SELL</th><th>Porsi semua aspek</th></tr></thead><tbody id="aftZodiacRanking"></tbody></table></div>
     <p id="aftZodiacCoverage" class="aft-planet-explanation"></p>
     <p class="aft-audit-label">Pasangan planet, longitude, sudut &amp; orb yang paling berkontribusi</p>
     <div class="aft-scroll"><table><thead><tr><th>Planet &amp; aspek</th><th>Posisi zodiak / longitude</th><th>Derajat aspek, orb, fase</th><th>Porsi bobot</th></tr></thead><tbody id="aftPlanetPairs"></tbody></table></div>
    </details>
   </section>
   <div class="aft-focus">
    <div><small>FOLLOW TREND · DOMINASI DURASI</small><strong id="aftDirection">—</strong><span id="aftShare">—</span></div>
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
    <div class="aft-scroll aft-raw"><table><thead><tr><th>Jam WIB</th><th>Skor V1</th><th>Bobot BUY</th><th>Bobot SELL</th><th>BUY % aspek</th><th>SELL % aspek</th><th>Arah awal</th><th>Follow Trend</th><th>Alasan</th></tr></thead><tbody id="aftRows"></tbody></table></div>
    <button id="aftCSV" type="button">Unduh CSV riset</button>
   </details>
  </div>
  <details class="aft-method"><summary>Aturan versi Follow Trend</summary>
   <p>Rumus skor planet, ambang BUY/SELL +1,15/−1,15, dan grid 5 menit <strong>tidak diubah</strong>. Kandidat arah harus muncul berturut-turut 3, 6, atau 9 slot (dipilih). Perubahan arah sebelum terkonfirmasi menjadi WAIT; setelah jeda netral 15 menit, arah lama tidak dipertahankan. Perhitungan waktu memakai WIB UTC+7.</p>
   <p>DOMINASI DURASI lan PERSENTASE KONFIGURASI PLANET iku loro ukuran berbeda. Persentase planet = jumlah kontribusi positif / (positif + absolut negatif) × 100%; SELL memakai absolut kontribusi negatif. Yen ora ana aspek sah utawa data ilang, tampil TIDAK TERSEDIA, ora diisi perkiraan. Longitudes lan posisi zodiak mung diperlihatke kanggo audit, ora oleh koefisien BUY/SELL tambahan.</p>
   <p>Ringkasan tanggal lengkap bisa dipengaruhi posisi astronomi ing akhir dina; iki dudu sinyal sing sudah diketahui realtime. Akurasi prediksi emas belum dibuktikan. Keputusan eksekusi tetep WAIT.</p>
  </details>
 </div>`;
$('aftDate').value=C.Time.today();
const setStatus=(msg,bad=false)=>{$('aftStatus').textContent=msg;$('aftStatus').classList.toggle('aft-error',bad);};
const invalidate=()=>{report=null;configuration=null;selectedDate=null;$('aftResult').hidden=true;setStatus('Setelan berubah. Hitung ulang ASTRODOX Follow Trend.');};
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
 const header=['tanggal_wib','jam_wib','skor_astrodox_V1_BELUM_VALID','bobot_positif_aspek','bobot_negatif_aspek','buy_pct_konfigurasi','sell_pct_konfigurasi','arah_mentah','follow_trend_model','alasan','keputusan_trading'];
 const lines=[header,...report.rows.map((r,i)=>{const a=configuration?.perSlot[i];return [selectedDate,hour(r.ms),r.score.toFixed(6),a?.buyWeight??'',a?.sellWeight??'',a?.buyPct??'',a?.sellPct??'',r.raw,r.state,r.reason,'WAIT'];})];
 const text='\uFEFF'+lines.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
 const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='ASTRODOX_FOLLOW_TREND_'+selectedDate+'.csv';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
$('aftCSV').addEventListener('click',downloadCSV);
function render(date,confirm){
 const x=report,window=x.focusWindow,p=configuration;
 const percentage=n=>n==null?'—':n.toFixed(1)+'%';
 $('aftPlanetBuy').textContent=p?.available?percentage(p.buyPct):'—';
 $('aftPlanetSell').textContent=p?.available?percentage(p.sellPct):'—';
 $('aftPlanetNet').textContent=p?.available?(p.netPct>0?'+':'')+percentage(p.netPct):'—';
 $('aftPlanetDirection').textContent=p?.available?
  'DOMINASI BOBOT ASPEK: '+p.direction:'KONFIGURASI PLANET: TIDAK TERSEDIA';
 $('aftPlanetCoverage').textContent=p?.available?
  p.aspects+' kontribusi aspek · '+p.coveredSlots+'/'+p.slots+' slot memiliki kontribusi ('+percentage(p.coveragePct)+
  ') · total bobot terukur '+p.totalWeight.toFixed(3):
  'Bobot tidak dihitung: '+(p?.reason||'DATA_TIDAK_TERSEDIA')+'. Persentase tidak direkayasa.';
 const tableRow=(r,key)=>'<tr><td>'+esc(r[key])+'</td><td>'+r.positiveWeight.toFixed(3)+
  '</td><td>'+r.negativeWeight.toFixed(3)+'</td><td>'+percentage(r.contributionPct)+'</td></tr>';
 $('aftPlanetRanking').innerHTML=p?.available?p.planetRanking.map(x=>tableRow(x,'id')).join(''):
  '<tr><td colspan="4">Tidak ada kontribusi planet terukur.</td></tr>';
 $('aftZodiacRanking').innerHTML=p?.available&&p.zodiacRanking.length?
  p.zodiacRanking.map(x=>tableRow(x,'sign')).join(''):
  '<tr><td colspan="4">Tidak ada longitude planet yang tersedia untuk atribusi zodiak.</td></tr>';
 $('aftZodiacCoverage').textContent=p?.available?
  'Bentuk laporan: bobot tiap aspek dibagi 50% untuk masing-masing dari dua planet. Cakupan longitude untuk kelompok zodiak '+percentage(p.zodiacWeightCoveragePct)+'. Zodiak tidak menambah skor arah.':
  'Tidak ada kontribusi zodiak terverifikasi.';
 const showLoc=(id,loc)=>loc?esc(id+' '+loc.sign+' '+loc.degreeInSign.toFixed(2)+
  '° (longitude '+loc.longitude.toFixed(2)+'°)'):esc(id+' · longitude tidak tersedia');
 $('aftPlanetPairs').innerHTML=p?.available?p.leadingAspects.map(a=>'<tr><td>'+
  esc(a.id1+' / '+a.id2+' · '+a.aspect)+'</td><td>'+showLoc(a.id1,a.peak.planet1)+
  ' / '+showLoc(a.id2,a.peak.planet2)+'</td><td>'+
  esc(a.angle+'° · orb '+a.peak.orb.toFixed(3)+'° · '+a.peak.phase)+
  '</td><td>'+percentage(a.contributionPct)+' · '+a.occurrences+' slot-aspek</td></tr>').join(''):
  '<tr><td colspan="4">Data kontribusi planet/aspek belum tersedia. Tidak ada persentase asumsi.</td></tr>';

 const focus=$('aftDirection');focus.textContent=x.focus;
 focus.className=x.focus==='BUY'?'aft-buy':x.focus==='SELL'?'aft-sell':'aft-wait';
 $('aftShare').textContent=x.directionalShare==null?'Tidak ada arah terkonfirmasi':
  'Porsi durasi '+(x.directionalShare*100).toFixed(1)+'% dari menit directional (bukan kekuatan planet)';
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
 $('aftRows').innerHTML=x.rows.map((r,i)=>{const a=p?.perSlot[i];return '<tr><td>'+esc(hour(r.ms))+'</td><td>'+r.score.toFixed(3)+
  '</td><td>'+(a?a.buyWeight.toFixed(3):'—')+'</td><td>'+(a?a.sellWeight.toFixed(3):'—')+
  '</td><td>'+percentage(a?.buyPct)+'</td><td>'+percentage(a?.sellPct)+
  '</td><td>'+esc(r.raw)+'</td><td>'+esc(r.state)+'</td><td>'+esc(r.reason)+'</td></tr>';}).join('');
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
 let engine=null;cancelled=false;report=null;configuration=null;selectedDate=null;
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
  const strength=P.evaluate(samples);
  if(cancelled)throw Error('Dibatalkan.');
  selectedDate=date;report=next;configuration=strength;
  render(date,confirm);
  setStatus('Selesai: '+samples.length+' slot ASTRODOX V1. Arah Follow Trend hanya hipotesis; status trading tetap WAIT.');
 }catch(e){
  report=null;configuration=null;selectedDate=null;
  $('aftResult').hidden=true;
  setStatus((e&&e.message)||'Perhitungan gagal. Tidak ada sinyal pengganti.',true);
 }finally{
  if(engine)engine.clear();
  setBusy(false);
 }
}
$('aftRun').addEventListener('click',run);
$('aftCancel').addEventListener('click',()=>{cancelled=true;setStatus('Membatalkan penghitungan ASTRODOX…');});
root.CebonkAstrodoxFollowTrendUI=Object.freeze({model:'PURE_ASTROLOGY_V1',version:'1.1.0'});
})(window);
