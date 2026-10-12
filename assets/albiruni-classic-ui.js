/* Source-backed Al-Biruni classical chart, separate from modern AUTO.
 * Never modifies legacy Astrology, trade feed, EA or market direction logic.
 */
(function(root){
'use strict';
const C=root.CebonkAlBiruni,K=root.CebonkAlBiruniClassic;
const panel=document.getElementById('albiruniPanel');
if(!C||!K||!panel)return;
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
