/* ASTROLOGY KILLZONE session UI v1.0 — independent, not a trading signal */
(function(root){
'use strict';
const C=root.CebonkCore,K=root.CebonkAstroKillzone,P=root.CebonkAstrodoxPlanetStrength;
const panel=document.getElementById('astroKillzoneView');
if(!panel||!C||!K)return;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>panel.querySelector('#'+id);
let busy=false,cancelToken=0,loadPromise=null,result=null;
function nextWeekday(date){
 let t=Date.parse(date+'T00:00:00Z'),d=new Date(t).getUTCDay();
 if(d===6)t+=2*86400000;if(d===0)t+=86400000;
 return new Date(t).toISOString().slice(0,10);
}
panel.innerHTML=[
 '<header class="ak-head"><div><div class="ak-kicker">ASTRODOX V1 · MODUL SESI INDEPENDEN</div>',
 '<h2>KILL ZONE ASTROLOGY · XAUUSD</h2>',
 '<p>Arah skor astrologi dihitung <strong>per sesi</strong>. Asia boleh SELL, London boleh BUY.',
 ' Tidak mengikuti dominasi satu hari ataupun dominasi 7 hari.</p></div>',
 '<span class="ak-mark">RISET / BUKAN ENTRY OTOMATIS</span></header>',
 '<div class="ak-main">',
 '<div class="ak-controls"><label for="akDate">Tanggal kalender WIB',
 '<input id="akDate" type="date" min="2020-01-01" max="2040-12-31"></label>',
 '<button id="akRun" class="ak-run" type="button">Hitung Killzone</button>',
 '<button id="akCancel" type="button" disabled>Batalkan</button></div>',
 '<p class="ak-warning"><b>Hanya arah skor astrologi eksperimental, bukan prediksi harga emas teruji.</b>',
 ' Jam AWAL–INTI–AKHIR adalah jendela kandidat menurut skor planet.',
 ' Judas Swing harus menunggu sweep, reclaim, dan konfirmasi candle harga; panel ini tidak terhubung ke harga.',
 ' Status transaksi tetap WAIT.</p>',
 '<div class="ak-status" id="akStatus" role="status" aria-live="polite">Pilih hari kerja lalu tekan Hitung Killzone.</div>',
 '<progress id="akProgress" max="100" value="0" hidden></progress>',
 '<div class="ak-grid" id="akGrid" hidden></div>',
 '<details class="ak-method"><summary>Aturan perhitungan, zona waktu &amp; Judas Swing</summary>',
 '<p>Setiap sesi dihitung terpisah memakai longitude/aspek planet, orb, fase Applying/Exact/Separating,',
 ' dan bobot V1 asli dari CebonkCore; tidak mengubah Al-Biruni atau model lain.',
 ' ASC/MC yang ada tetap milik koordinat Luxor dan tidak memberikan bobot arah.',
 ' Tidak memakai sinyal harian/mingguan sebagai filter.</p>',
 '<p>Window lokal yang dipakai untuk riset: Sydney 08–11, Tokyo 09–12, London Open 08–11,',
 ' New York Open 08–11, London Close 15–17 (semuanya menurut jam kota tersebut).',
 ' Jam WIB berubah otomatis mengikuti zona IANA/DST.',
 ' Ini pilihan window penelitian, bukan definisi universal ICT Killzone.</p>',
 '<p>Slot setiap 5 menit. BUY jika skor ≥ +1,15; SELL jika ≤ −1,15.',
 ' Arah perlu 2 slot berturut-turut lalu setidaknya 15 menit bertahan setelah konfirmasi.',
 ' Fokus sesi adalah arah dengan minimal 55% dari durasi window directional terkonfirmasi;',
 ' bila tidak memenuhi, NETRAL. INTI dipilih setelah semua data periode dihitung',
 ' (retrospektif, bukan waktu diketahui sejak awal).</p>',
 '<p>Rencana Judas BUY: pantau sweep low → reclaim → displacement bullish.',
 ' Judas SELL: pantau sweep high → reclaim → displacement bearish.',
 ' Tanpa OHLC/price feed, pola tersebut tidak pernah diklaim terkonfirmasi.',
 ' Persentase bobot aspek bukan win rate, peluang profit, maupun persentase kekuatan harga.</p>',
 '</details></div>'
].join('');
$('akDate').value=nextWeekday(C.Time.today());
function setStatus(text,bad=false){$('akStatus').textContent=text;$('akStatus').classList.toggle('ak-error',bad);}
function setBusy(v){busy=v;$('akDate').disabled=v;$('akRun').disabled=v;$('akCancel').disabled=!v;}
function time(ms){const p=C.Time.wib(ms);return C.Time.hm(p);}
function dateTime(ms){const p=C.Time.wib(ms);return C.Time.dateISO(p)+' '+C.Time.hm(p);}
function cssDir(x){return x==='BUY'?'ak-buy':x==='SELL'?'ak-sell':'ak-wait';}
function renderCard(s){
 const d=s.trend,b=d.best,priceCheck=d.focus==='BUY'?
   'Judas BUY: tunggu sweep LOW, reclaim, lalu candle displacement bullish.':
   d.focus==='SELL'?
   'Judas SELL: tunggu sweep HIGH, reclaim, lalu candle displacement bearish.':
   'NETRAL: belum ada satu arah skor yang mendominasi sesi. Jangan memaksakan Judas BUY/SELL.';
 const strength=s.strength?.available?('Bobot aspek planet: BUY '+s.strength.buyPct.toFixed(1)+
   '% / SELL '+s.strength.sellPct.toFixed(1)+'% (bukan probabilitas).'):
   'Bobot aspek planet: tidak tersedia.';
 const windows=d.windows.map(w=>'<tr><td class="'+cssDir(w.direction)+'">'+esc(w.direction)+
  '</td><td>'+esc(dateTime(w.start))+'</td><td>'+esc(dateTime(w.core))+
  '</td><td>'+esc(dateTime(w.end))+'</td><td>'+w.minutes+' menit</td></tr>').join('');
 const offset=s.offsetStart;const zone='UTC'+(offset<0?'-':'+')+String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')+
   ':'+String(Math.abs(offset)%60).padStart(2,'0');
 return [
  '<article class="ak-card"><div class="ak-title"><span>',esc(s.name),'</span><span class="ak-label">',esc(zone),'</span></div>',
  '<div class="ak-local">Zona ',esc(s.zone),' · ',
  String(Math.floor(s.from/60)).padStart(2,'0'),':',String(s.from%60).padStart(2,'0'),'–',
  String(Math.floor(s.to/60)).padStart(2,'0'),':',String(s.to%60).padStart(2,'0'),' waktu kota</div>',
  '<div class="ak-clock">',esc(s.startWib),' – ',esc(time(s.end)),(C.Time.dateISO(C.Time.wib(s.end))!==s.date?' (+1 hari)':''),'</div>',
  '<div class="ak-label">FOKUS ARAH SKOR SESI</div>',
  '<div class="ak-focus ',cssDir(d.focus),'">',esc(d.focus==='WAIT'?'NETRAL':d.focus),'</div>',
  b?('<div class="ak-window"><div><small>AWAL kandidat</small><strong>'+esc(time(b.start))+'</strong></div>'+
   '<div><small>INTI skor</small><strong>'+esc(time(b.core))+'</strong></div>'+
   '<div><small>AKHIR</small><strong>'+esc(time(b.end))+'</strong></div></div>'):
   '<p class="ak-info">Tidak ada window dominan yang memenuhi ambang. Tidak dibuat jam entry pengganti.</p>',
  '<p class="ak-info">BUY terkonfirmasi ',d.buyMinutes,' menit · SELL ',d.sellMinutes,
  ' menit · ',d.windows.length,' window. ',esc(strength),'</p>',
  '<p class="ak-judas">',esc(priceCheck),' <strong>Status Judas: BELUM DIKONFIRMASI.</strong></p>',
  '<details><summary>Lihat semua window astrologi sesi (',d.windows.length,')</summary>',
  '<div class="ak-scroll"><table><thead><tr><th>Arah</th><th>AWAL WIB</th><th>INTI WIB</th><th>AKHIR WIB</th><th>Durasi</th></tr></thead><tbody>',
  windows||'<tr><td colspan="5">Tidak ada window memenuhi syarat.</td></tr>',
  '</tbody></table></div></details></article>'
 ].join('');
}
function render(report){
 $('akGrid').innerHTML=report.sessions.map(s=>renderCard({...s,date:report.date})).join('');
 $('akGrid').hidden=false;
}
function addScript(url){
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');let finished=false;
  const timer=setTimeout(()=>complete(Error('Timeout memuat ephemeris.')),15000);
  function complete(err){if(finished)return;finished=true;clearTimeout(timer);script.onload=script.onerror=null;
    if(err){script.remove();reject(err);}else resolve();}
  script.src=url;script.async=true;script.referrerPolicy='no-referrer';
  script.onload=()=>root.Astronomy?complete():complete(Error('Astronomy Engine tidak tersedia.'));
  script.onerror=()=>complete(Error('Unduhan ephemeris gagal.'));
  document.head.append(script);
 });
}
async function library(){
 if(root.Astronomy)return root.Astronomy;
 if(!loadPromise)loadPromise=(async()=>{
  let error;
  for(const url of ['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
                     'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js']){
   try{await addScript(url);if(root.Astronomy)return root.Astronomy;}catch(e){error=e;}
  }
  throw error||Error('Ephemeris belum tersedia.');
 })().finally(()=>{loadPromise=null;});
 return loadPromise;
}
async function run(){
 if(busy)return;
 const date=$('akDate').value,token=++cancelToken;
 try{
  C.Time.parseDate(date);
  K.schedule(date,C);
  result=null;$('akGrid').hidden=true;$('akGrid').innerHTML='';
  setBusy(true);$('akProgress').value=0;$('akProgress').hidden=false;
  setStatus('Memuat posisi planet untuk sesi '+date+' WIB...');
  const A=await library();
  if(token!==cancelToken)throw Error('Dibatalkan.');
  const report=await K.calculate(date,A,C,(pct,name)=>{
   if(token!==cancelToken)return;
   $('akProgress').value=pct;setStatus('Menghitung '+name+' · '+pct+'%');
  },()=>token!==cancelToken,P);
  if(token!==cancelToken)throw Error('Dibatalkan.');
  result=report;render(report);
  setStatus('Selesai · '+date+' WIB · 5 sesi dihitung independen. Keputusan trading tetap WAIT.');
 }catch(e){
  if(token===cancelToken){result=null;$('akGrid').hidden=true;setStatus('Gagal: '+(e.message||String(e)),true);}
 }finally{setBusy(false);$('akProgress').hidden=true;}
}
$('akRun').addEventListener('click',run);
$('akCancel').addEventListener('click',()=>{cancelToken++;result=null;$('akGrid').hidden=true;setStatus('Perhitungan dibatalkan.');setBusy(false);$('akProgress').hidden=true;});
$('akDate').addEventListener('change',()=>{result=null;$('akGrid').hidden=true;setStatus('Tanggal berubah. Tekan Hitung Killzone untuk memperbarui.');});
root.CebonkAstroKillzoneUI=Object.freeze({VERSION:'1.0.0',model:'ASTRODOX_V1_SESSION_RESEARCH'});
})(window);
