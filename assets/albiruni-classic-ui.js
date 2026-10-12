/* Source-backed Al-Biruni classical chart, separate from modern AUTO.
 * Never modifies legacy Astrology, trade feed, EA or market direction logic.
 */
(function(root){
'use strict';
const C=root.CebonkAlBiruni,K=root.CebonkAlBiruniClassic,Gate=root.CebonkAlBiruniElectionGate;
const panel=document.getElementById('albiruniPanel');
if(!C||!K||!Gate||!panel)return;
const anchor=panel.querySelector('#abRules');
if(!anchor)return;
const details=document.createElement('details');
details.id='abClassicPanel';details.open=true;
details.innerHTML=[
 '<summary>AL-BIRUNI ASLI · ASCENDANT, MARTABAT, PEMILIHAN WAKTU (§527)</summary>',
 '<p>Riset kitab asli: Ascendant, penguasa Ascendant, Bulan, penguasa tanda Bulan, Matahari (asosiasi emas §410), kontak benefic–malefic dan skor martabat. <strong>Tidak ada rumus BUY/SELL XAUUSD asli dari Al-Biruni.</strong></p>',
 '<p><strong>Lokasi awal hanya contoh Jakarta.</strong> Ubah lintang/bujur sesuai lokasi yang hendak dihitung karena Ascendant bergantung pada lokasi.</p>',
 '<div class="ab-controls"><div><label for="abClassicLat">Lintang ° (selatan negatif)</label><input id="abClassicLat" type="number" value="-6.2000" min="-89.9" max="89.9" step="0.0001"></div>',
 '<div><label for="abClassicLon">Bujur ° (timur positif)</label><input id="abClassicLon" type="number" value="106.8167" min="-180" max="180" step="0.0001"></div></div>',
 '<button id="abClassicCalc" type="button">Hitung AL-BIRUNI KLASIK + bandingkan arah AUTO</button>',
 '<div id="abClassicResults" role="status" aria-live="polite">Hitung peta aspek dahulu, pilih hari & jam WIB, lalu hitung klasik.</div>',
 '<p>Kitab PDF: §410 hal.37, §440–453 hal.50–59, §489–494 hal.98–102, §527 hal.126. Martabat 5/4/3/2/1 dengan term Mesir dari tabel §453; versi Ptolemaios tidak digunakan. Metode ini tidak mengirim perintah ke EA.</p>'
].join('');
anchor.parentNode.insertBefore(details,anchor);
const output=details.querySelector('#abClassicResults');
const button=details.querySelector('#abClassicCalc');
const names={Sun:'Matahari',Moon:'Bulan',Mercury:'Merkurius',Venus:'Venus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturnus'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chip=d=>'<span class="ab-chip ab-'+(d==='BUY'?'buy':d==='SELL'?'sell':'neutral')+'">'+escape(d)+'</span>';
const stamp=ms=>ms==null?'—':escape(C.stamp(ms));
let version=0;
const read=()=>{
 const chosen=panel.querySelector('#abCalendar [data-ab-date][aria-pressed="true"]');
 return {date:chosen?.dataset.abDate||panel.querySelector('#abDate')?.value||'',
  time:panel.querySelector('#abTime')?.value||'',
  focus:panel.querySelector('#abFocus')?.value||'moon',
  orb:Number(panel.querySelector('#abOrb')?.value),
  lat:Number(details.querySelector('#abClassicLat').value),
  lon:Number(details.querySelector('#abClassicLon').value)};
};
const signature=x=>JSON.stringify(x);

/* Status feed broker is deliberately separate from AUTO aspect diagnostics.
 * Never label a historical chart observation as an EA order.
 */
const inspector=panel.querySelector('.ab-inspect');
const finalCard=document.createElement('section');
finalCard.id='abFinalDecision';
finalCard.className='ab-final-decision';
finalCard.setAttribute('aria-label','Keputusan final EA AL-BIRUNI');
finalCard.innerHTML='<h3>AL-BIRUNI DIRECT v1.03 · MAYORITAS WEB → EA</h3>'+
 '<div id="abFinalFeedStatus" role="status" aria-live="polite">Memuat status feed EA dari GitHub…</div>'+
 '<button id="abRefreshFeed" type="button" class="ab-small-button">Perbarui status EA</button>'+
 '<small>EA DIRECT v1.03 menggunakan arah mayoritas aspek yang sama dengan AUTO WEB. Filter waktu klasik §527 TIDAK menjadi veto di mode DIRECT; v1.02 KETAT tetap ada terpisah. Feed jadwal ini bukan bukti order broker atau jaminan profit.</small>';
if(inspector)inspector.parentNode.insertBefore(finalCard,inspector);
let feed=null,feedError=null,feedLoading=true;
const feedTarget=finalCard.querySelector('#abFinalFeedStatus');
const feedReason=reason=>({
 WAIT_ELECTION_TIME_NOT_FAVORABLE:'Filter §527 tidak mengizinkan entry pada kandidat waktu tersebut.',
 MARKET_CLOSED:'Pasar tutup',NO_APPLYING_EXACT_BEFORE_CORE:'Tidak ada kandidat APPLYING valid',
 NO_DOMINANT_OPEN_MARKET_DAY:'Arah belum dominan',READY:'Lolos filter waktu',
 SHADOW_ELECTION_AUDIT:'Mode audit saja'
})[reason]||String(reason||'Alasan tidak tersedia');
function renderFinal(){
 const p=read(),day=p.date;
 if(!day){feedTarget.textContent='Pilih tanggal pemeriksaan WIB.';return;}
 if(feedLoading){feedTarget.textContent='Memuat feed DIRECT v1.03 untuk '+day+'…';return;}
 if(!feed){
  feedTarget.textContent='EA DIRECT v1.03: FEED TIDAK TERSEDIA · '+(feedError||'CSV/JSON belum terbit')+
   '. Jangan mengambil keputusan order dari panel aspek semata.';return;
 }
 if(feed.date_wib!==day){
  feedTarget.textContent='FEED DIRECT v1.03 tidak ada untuk '+day+'. Data terakhir untuk '+
   feed.date_wib+' ('+feed.direction+'); jangan anggap ini sinyal tanggal lain.';return;
 }
 const dir=feed.direction;
 const buy=Number(feed.buy_aspects),sell=Number(feed.sell_aspects);
 const dailyBuy=Number(feed.summary?.buyVotes),dailySell=Number(feed.summary?.sellVotes);
 const daily=feed.summary?.dominant;
 const dailyValid=Number.isInteger(dailyBuy)&&Number.isInteger(dailySell)&&
  dailyBuy>=0&&dailySell>=0&&
  (daily==='BUY'?dailyBuy>dailySell:daily==='SELL'?dailySell>dailyBuy:daily==='NETRAL'?dailyBuy===dailySell:false);
 const valid=feed.model==='ALBIRUNI_MAJORITY_DIRECT_V3'&&
  feed.election?.reference?.gateMode==='majority'&&
  feed.summary?.directionRule==='ASPECT_COUNT_MAJORITY_V2'&&dailyValid&&
  Number.isInteger(buy)&&Number.isInteger(sell)&&buy>=0&&sell>=0&&buy+sell<=21&&
  (dir==='WAIT'?
   feed.signal_id==='NONE'&&feed.entry_epoch===0&&buy===0&&sell===0:
   (dir==='BUY'||dir==='SELL')&&feed.entry_epoch>0&&
   feed.election?.status==='NOT_APPLIED'&&feed.phase==='APPLYING'&&
   (dir==='BUY'?buy>sell:sell>buy));
 if(!valid){feedTarget.textContent='FEED DIRECT V3 TIDAK KONSISTEN — JANGAN ENTRY.';return;}
 const published=Number.isFinite(feed.published_epoch)?
  C.stamp(feed.published_epoch*1000):'tidak diketahui';
 const location=feed.election?.reference;
 const different=location&&Number.isFinite(location.latitude)&&Number.isFinite(location.longitude)&&
  (Math.abs(location.latitude-p.lat)>0.0001||Math.abs(location.longitude-p.lon)>0.0001);
 const candidate=feed.entry_epoch>0?C.stamp(feed.entry_epoch*1000):null;
 const expired=feed.entry_epoch>0&&Date.now()>feed.entry_epoch*1000+8*60000;
 feedTarget.innerHTML='<div class="ab-final-direction"><strong>EA DIRECT '+escape(dir)+'</strong>'+
  '<span>'+escape(day)+' WIB · feed v1.03</span></div>'+
  '<div class="ab-ea-focus"><div><small>ARAH MAYORITAS HARIAN WEB</small><strong>'+
   escape(daily)+'</strong><span>Akumulasi suara: SELL '+dailySell+
   ' / BUY '+dailyBuy+'</span></div><div><small>JADWAL ENTRY EA DIRECT v1.03</small><strong>'+
   escape(dir)+'</strong><span>'+escape(dir==='WAIT'?'Belum ada kandidat valid':'SELL '+sell+' / BUY '+buy+' pada kandidat')+
   '</span></div></div>'+
  '<p><strong>Filter waktu §527:</strong> TIDAK DITERAPKAN pada mode DIRECT. EA v1.02 KETAT tetap memakai filter tersebut.</p>'+
  (candidate?'<p><b>Jadwal kandidat:</b> '+escape(candidate)+
   ' · INTI '+escape(C.stamp(feed.core_epoch*1000))+
   ' · AKHIR '+escape(C.stamp(feed.end_epoch*1000))+'</p>':'')+
  (expired?'<p class="ab-final-warning"><b>Waktu entry sudah lewat.</b> EA tidak boleh mengejar sinyal terlambat; jadwal ini bukan sinyal masuk sekarang.</p>':'')+
  '<p><b>Alasan feed:</b> '+escape(feedReason(feed.reason))+'</p>'+
  '<p><small>Diterbitkan '+escape(published)+' · MT5 tetap memeriksa sesi broker, keterlambatan, spread, SL/TP, dan izin AUTOPILOT.</small></p>'+
  (different?'<p class="ab-final-warning">Koordinat panel ('+p.lat+', '+p.lon+
   ') berbeda dari referensi feed ('+location.latitude+', '+location.longitude+').</p>':'')+
  '<p><small>Arah BUY/SELL adalah hipotesis astrologi belum tervalidasi; feed tidak menunjukkan apakah transaksi benar-benar tereksekusi.</small></p>';
}
async function refreshFeed(){
 feedLoading=true;renderFinal();
 if(typeof root.fetch!=='function'){feedLoading=false;feedError='Fetch tidak tersedia';renderFinal();return;}
 const urls=[
  'ea/albiruni_intraday/data/majority_direct_v3.json',
  'https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/albiruni_intraday/data/majority_direct_v3.json'
 ];
 feed=null;feedError=null;
 for(const url of urls)try{
  const res=await root.fetch(url,{cache:'no-store'});
  if(!res.ok)continue;
  const x=await res.json();
  if(!x||x.model!=='ALBIRUNI_MAJORITY_DIRECT_V3'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x.date_wib)||
   !['BUY','SELL','WAIT'].includes(x.direction))continue;
  feed=x;feedError=null;feedLoading=false;renderFinal();return;
 }catch(e){feedError=String(e?.message||e);}
 feedLoading=false;feedError=feedError||'Feed majority_direct_v3.json belum ada / format tidak cocok';renderFinal();
}
for(const id of ['abDate','abTime','abClassicLat','abClassicLon']){
 const el=panel.querySelector('#'+id)||details.querySelector('#'+id);
 if(el){el.addEventListener('input',renderFinal);el.addEventListener('change',renderFinal);}
}
for(const id of ['abCalendar','abPeriodDays']){
 const el=panel.querySelector('#'+id);if(el)el.addEventListener('click',renderFinal);
}
finalCard.querySelector('#abRefreshFeed').addEventListener('click',()=>refreshFeed());
renderFinal();refreshFeed();

const invalidate=()=>{version++;output.textContent='Parameter berubah. Hitung ulang analisis AL-BIRUNI KLASIK.';};
for(const id of ['abDate','abTime','abOrb','abFocus','abMode','abClassicLat','abClassicLon']){
 const el=panel.querySelector('#'+id)||details.querySelector('#'+id);
 if(el){el.addEventListener('input',invalidate);el.addEventListener('change',invalidate);}
}
for(const id of ['abCalendar','abPeriodDays']){
 const el=panel.querySelector('#'+id);if(el)el.addEventListener('click',invalidate);
}
button.addEventListener('click',async()=>{
 if(button.disabled)return;
 const ticket=++version,inputs=read(),key=signature(inputs);
 button.disabled=true;output.textContent='Menghitung posisi planet, Ascendant, dan aspek klasik…';
 try{
  if(panel.querySelector('#abResults')?.hidden)throw Error('Hitung peta aspek utama terlebih dahulu.');
  if(!root.Astronomy)throw Error('Ephemeris tidak tersedia.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(inputs.date))throw Error('Tanggal tidak valid.');
  if(!/^\d{2}:\d{2}(:\d{2})?$/.test(inputs.time))throw Error('Jam WIB tidak valid.');
  const [hour,minute,second=0]=inputs.time.split(':').map(Number);
  if(hour>23||minute>59||second>59)throw Error('Jam WIB tidak valid.');
  if(!Number.isFinite(inputs.orb)||inputs.orb<=0||inputs.orb>5)throw Error('Orb di luar rentang panel utama.');
  const ms=C.parseDate(inputs.date)+(hour*60+minute)*C.MIN+second*1000;
  const engine=C.createEngine(root.Astronomy);
  const election=K.chart(root.Astronomy,engine,ms,{
   latitude:inputs.lat,longitude:inputs.lon,orb:inputs.orb});
  // Existing AUTO is a separate, unvalidated market-direction model.
  const map=await C.scan(engine,inputs.date,{mode:'day',focus:inputs.focus,orb:inputs.orb});
  const auto=C.autoSignal(engine,map,ms),daily=C.periodEntryReport(engine,map);
  const timeQuality=Gate.judge(election);
  if(ticket!==version||signature(read())!==key||panel.querySelector('#abResults')?.hidden)return;
  const modernDay=['BUY','SELL'].includes(daily.direction)?daily.direction:'WAIT';
  const modernTime=['BUY','SELL'].includes(auto.direction)?auto.direction:'WAIT';
  const detailRows=election.dignities.rows.map(r=>{
   const active=['domicile','exaltation','triplicity','face'].filter(k=>r.points[k]>0)
     .map(k=>({domicile:'Rumah',exaltation:'Peninggian',triplicity:'Triplicity',face:'Face'})[k]+' +'+r.points[k]).join('; ')||'Tidak ada';
   return '<tr><td>'+escape(names[r.body])+'</td><td>'+escape(r.sign)+' '+r.signDegree.toFixed(2)+
    '°</td><td>'+r.subtotal+'</td><td>'+escape(active)+'</td></tr>';
  }).join('');
  const contacts=election.contacts.map(c=>'<li>'+escape(names[c.actor])+' ('+c.role+') → '+
    escape(c.target)+' · '+c.angle+'° · orb '+c.orb.toFixed(3)+'°</li>').join('');
  const meanings={CAMPURAN:'CAMPURAN — kontak benefic dan malefic',
   KONTAK_BENEFIC:'Kontak benefic terdeteksi',KONTAK_MALEFIC:'Kontak malefic terdeteksi',
   BELUM_ADA_KONTAK:'Belum ada kontak pada orb terpilih'};
  output.innerHTML=
   '<h3>AL-BIRUNI KLASIK · KAJIAN §527</h3>'+
   '<p><strong>KUALITAS WAKTU AL-BIRUNI (§527):</strong> '+escape(timeQuality.status)+
    ' · '+escape(timeQuality.reason)+
    '. '+(timeQuality.eligible?'LOLOS FILTER WAKTU':'EA HARUS WAIT JIKA DIAJUKAN SAAT INI')+
    '. Status berasal dari heuristik penelitian, bukan rumus trading kitab.</p>'+
   '<p><strong>INDIKASI ASTROLOGI:</strong> '+escape(meanings[election.indication]||election.indication)+
    '. Bukan arah harga atau keputusan trading.</p>'+
   '<p><strong>ASCENDANT:</strong> '+escape(election.ascendantSign)+' '+
    (election.ascendant%30).toFixed(3)+'° · Penguasa '+escape(names[election.ascendantRuler])+
    ' · Bulan '+escape(election.lunarSign)+' · Penguasa Bulan '+escape(names[election.lunarRuler])+'</p>'+
   '<p><strong>WAKTU:</strong> '+escape(inputs.date+' '+inputs.time)+' WIB · lokasi '+
    inputs.lat.toFixed(4)+', '+inputs.lon.toFixed(4)+' · Matahari '+election.sunAltitudeDegrees.toFixed(2)+
    '° · '+(election.sect==='day'?'SIANG':'MALAM')+
    (election.twilightUncertain?' (dekat horizon, sekta perlu perhatian)':'')+'</p>'+
   '<p><strong>KONTAK BENEFIC:</strong> '+election.beneficCount+' · <strong>KONTAK MALEFIC:</strong> '+
    election.maleficCount+' · orb '+inputs.orb+'°. Matahari sebagai lambang emas berasal dari §410, bukan aturan BUY.</p>'+
   (contacts?'<ul>'+contacts+'</ul>':'<p>Tidak ada kontak cukup dekat pada orb yang dipilih.</p>')+
   '<p><strong>Bulan ↔ Penguasa Ascendant:</strong> '+
    (election.ascendantRuler==='Moon'?'Bulan sendiri adalah penguasa Ascendant (bukan aspek dua planet)':election.moonAscRuler?'aspek '+election.moonAscRuler.angle+'°, orb '+election.moonAscRuler.orb.toFixed(3)+'°':'tidak dekat')+
    ' · <strong>Bulan ↔ Matahari:</strong> '+
    (election.moonGold?'aspek '+election.moonGold.angle+'°, orb '+election.moonGold.orb.toFixed(3)+'°':'tidak dekat')+'</p>'+
   '<p><strong>SKOR MARTABAT KLASIK · MESIR §453</strong> · martabat 5/4/3/2/1 dari tabel Egyptian Terms (§453).</p>'+
   '<div class="ab-table-wrap"><table><thead><tr><th>Planet</th><th>Zodiak</th><th>Subtotal</th><th>Martabat</th></tr></thead>'+
    '<tbody>'+detailRows+'</tbody></table></div>'+
   '<p>Perhitungan ASC tropis memakai pendekatan obliquity rata-rata dan sidereal time. Sistem term Mesir sudah dihitung; seluruh house dan prosedur electional lengkap belum tersedia. Ini penilaian parsial, bukan hasil final kitab.</p>'+
   '<h3>ARAH XAUUSD · AUTO EKSPERIMEN MODERN (DIPISAH DARI KITAB)</h3>'+
   '<p><strong>LAYAK DIAJUKAN KE EA:</strong> '+escape(timeQuality.eligible?'HANYA JIKA FASE/ARAH JUGA VALID':'WAIT · KUALITAS WAKTU BELUM MENDUKUNG')+
    '. Perhitungan entry nyata memakai dua pembacaan (pada entry dan lima menit sebelum exact), bukan hanya waktu pemeriksaan ini.</p>'+
   '<p><strong>ARAH HARIAN:</strong> '+chip(modernDay)+' · <strong>ARAH JAM WIB:</strong> '+chip(modernTime)+
    (auto.direction==='KONFLIK'?' (KONFLIK)':'')+'. Belum tervalidasi sebagai prediksi harga.</p>'+
   '<div class="ab-period-times"><div><small>KANDIDAT</small><strong>'+escape(daily.entryWIB||'WAIT')+'</strong></div>'+
    '<div><small>MULAI</small><strong>'+stamp(daily.startUTC)+'</strong></div>'+
    '<div><small>INTI</small><strong>'+stamp(daily.coreUTC)+'</strong></div>'+
    '<div><small>AKHIR</small><strong>'+stamp(daily.endUTC)+'</strong></div></div>'+
   '<p>Tidak ada rumus BUY/SELL XAUUSD asli dalam kitab yang dirujuk. BUY/SELL AUTO berasal dari bobot aplikasi modern. Tidak ada transaksi atau notifikasi EA yang dikirim dari panel ini.</p>';
 }catch(e){if(ticket===version)output.textContent='AL-BIRUNI KLASIK gagal dihitung: '+(e.message||String(e));}
 finally{button.disabled=false;}
});
})(window);
