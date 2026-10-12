/* Independent Al-Biruni panel. All controls, results and saved rules are scoped here. */
(function(root){
'use strict';
const C=root.CebonkAlBiruni,panel=document.getElementById('albiruniPanel');
if(!C||!panel)return;
const $=id=>panel.querySelector('#'+id),KEY='cebonk.albiruni.v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={Sun:'Matahari',Moon:'Bulan',Mercury:'Merkurius',Venus:'Venus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturnus'};
const weekdays=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
let result=null,engine=null,selectedDate='',busy=false,token=0,loading=null,periodSummary=null,threePlans=null,threeKey='';
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){saved={};}
let rules=C.normalizeRules(saved.rules);
let biasMode=saved.biasMode==='MANUAL'?'MANUAL':'AUTO';
panel.innerHTML=`
 <div class="ab-header">
  <div><div class="ab-kicker">PANEL PERHITUNGAN TERPISAH · XAUUSD</div><h2 id="abTitle">AL-BIRUNI <span style="color:var(--ab-gold)">/</span> Peta aspek</h2><p class="ab-lead">Peta mingguan, rincian harian, dan kalender bulanan. Ikuti aspek dari mendekat → exact → menjauh, dengan waktu WIB.</p></div>
  <span class="ab-tag">7 BENDA LANGIT · WIB</span>
 </div>
 <div class="ab-body">
  <div class="ab-period-modes" aria-label="Pilihan hitungan Al-Biruni">
   <button type="button" data-ab-mode="day">HARIAN</button>
   <button type="button" data-ab-mode="week">MINGGUAN</button>
   <button type="button" data-ab-mode="month">BULANAN</button>
  </div>
  <div class="ab-controls">
   <div><label for="abDate">Tanggal acuan WIB</label><input id="abDate" type="date" min="2020-01-01" max="2040-12-31" required></div>
   <div><label for="abMode">Rentang perhitungan</label><select id="abMode"><option value="week">Mingguan · Senin–Jumat</option><option value="day">Harian · 24 jam</option><option value="month">Bulanan · kalender penuh</option></select></div>
   <div><label for="abFocus">Pasangan benda langit</label><select id="abFocus"><option value="moon">Bulan ↔ 6 benda lainnya</option><option value="all">Semua pasangan klasik · 21</option></select></div>
   <div><label for="abOrb">Orb window (°)</label><input id="abOrb" type="number" min="0.25" max="5" step="0.25" value="2" required></div>
  </div>
  <div class="ab-auto-config"><label for="abBiasMode">Mesin interpretasi arah XAUUSD</label><select id="abBiasMode"><option value="AUTO">AUTO EKSPERIMEN · penilaian planet & aspek</option><option value="MANUAL">MANUAL · aturan uji sendiri</option></select><span class="ab-auto-warning">AUTO merupakan hipotesis modern BELUM tervalidasi, bukan rumus harga dari kitab Al-Biruni atau order EA.</span></div>
  <div class="ab-actions"><button id="abRunThree" class="ab-primary" type="button">Hitung 3 Dominasi + Jam Entry</button><button id="abRun" class="ab-primary" type="button">Hitung peta aspek</button><button id="abToday" type="button">Hari ini</button><button id="abCancel" type="button" disabled>Batalkan</button><button id="abPrev" class="ab-next" type="button" aria-label="Periode sebelumnya">← Sebelumnya</button><button id="abNext" type="button" aria-label="Periode berikutnya">Berikutnya →</button><button id="abCSV" type="button" disabled>Unduh CSV aspek</button><button id="abStudyCSV" type="button" disabled>CSV riset XAUUSD</button></div>
  <div id="abStatusBox" class="ab-status" role="status" aria-live="polite"><progress id="abProgress" max="100" value="0" hidden></progress><span id="abStatus">Siap menghitung panel baru.</span></div>
  <div id="abThreeResult" class="ab-three-result" hidden>
  <h3>DOMINASI AL-BIRUNI · 3 JANGKA WAKTU</h3>
  <p class="ab-three-intro">Harian/Intraday · Mingguan/Swing · Bulanan/Position Trade. Saben periode dihitung mandiri. Entry yaiku kandidat waktu INTI bobot model, ora order EA.</p>
  <div id="abThreeCards" class="ab-three-cards"></div>
 </div>
 <div id="abResults" class="ab-results" hidden>
   <div id="abPeriodSummary" class="ab-period-summary" hidden></div>
   <div id="abPeriodDays" class="ab-period-days" hidden></div>
   <div class="ab-metrics">
    <div class="ab-metric"><span>Kontak exact dalam periode</span><strong id="abExactCount">—</strong><small id="abPeriodLabel">—</small></div>
    <div class="ab-metric"><span>Window aspek</span><strong id="abWindowCount">—</strong><small id="abSettingsLabel">—</small></div>
    <div class="ab-metric"><span>Hipotesis arah XAUUSD (AUTO/MANUAL)</span><strong id="abRuleState">NETRAL</strong><small id="abRuleCaption">Arah belum divalidasi.</small></div>
   </div>
   <div id="abAutoStatus" class="ab-auto-status" role="status" aria-live="polite" hidden></div>
   <div class="ab-section-title"><h3 id="abCalendarTitle">Pilih hari untuk rincian</h3><small>Jumlah exact = peristiwa langit, bukan jumlah entry</small></div>
   <div id="abCalendar" class="ab-calendar" aria-label="Peta harian aspek"></div>
   <h3 id="abDayTitle" class="ab-date-title"></h3>
   <div id="abAutoWindows" class="ab-auto-windows" hidden></div>
   <div class="ab-table-wrap"><table><caption class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden">Awal, exact atau titik terdekat, dan akhir window aspek pada hari dipilih</caption><thead><tr><th>Pasangan / aspek</th><th>Mulai window</th><th>Inti · exact</th><th>Akhir window</th><th id="abBiasTableHeader">Bias uji manual</th></tr></thead><tbody id="abEvents"></tbody></table></div>
   <div class="ab-inspect"><div><label for="abTime">Periksa jam WIB</label><input id="abTime" type="time" value="12:00:00" step="1"></div><div><strong id="abInspectLabel">—</strong><small id="abInspectInfo">—</small><div id="abActive" class="ab-active"></div></div></div>
   <p class="ab-footnote">AUTO memakai bobot planet, jenis aspek, fase dan orb sebagai HIPOTESIS, bukan probabilitas. Window AUTO disampling per 15 menit, bukan batas exact astronomis. Mode mingguan menghitung Senin–Jumat saja; kontak Sabtu/Minggu tidak digeser ke Jumat/Senin. Awal/akhir memakai orb yang dipilih. Tanda “batas periode” berarti window sudah aktif atau masih berlanjut; bukan awal/akhir kontak yang terkonfirmasi. Kalender WIB tidak memeriksa jam broker atau hari libur.</p>
  </div>
  <details id="abRules"><summary>Setelan BUY/SELL untuk uji hipotesis</summary><p>Default semua NETRAL. Pilih label untuk menguji aturanmu sendiri. Label ini bukan aturan trading dari kitab al-Biruni dan belum diuji dengan harga XAUUSD. Bila window BUY dan SELL tumpang tindih, hasilnya KONFLIK.</p><div class="ab-rules">${C.ASPECTS.map(a=>`<div><label for="abRule${a.angle}">${a.name} ${a.angle}°</label><select id="abRule${a.angle}" data-ab-rule="${a.angle}"><option value="NETRAL">NETRAL</option><option value="BUY">BUY · uji manual</option><option value="SELL">SELL · uji manual</option></select></div>`).join('')}</div><button id="abResetRules" class="ab-small-button" type="button">Reset semua NETRAL</button><p id="abSaveNote">Setelan disimpan di perangkat ini.</p><p>CSV riset hanya mengekspor waktu aspek dan kolom harga XAUUSD kosong untuk dipasangkan dengan data pasar di luar situs. Tanpa data harga, tidak ada hasil backtest atau winrate.</p></details>
  <details><summary>Metode dan sumber al-Biruni</summary><p>Versi ini mengambil konsep aspek dan tahap mendekat, tepat, lalu menjauh dari Maqalah XI, Bab 2, <i>Al-Qanun al-Masudi</i>. Ini implementasi timing dengan ephemeris modern, bukan reproduksi seluruh rumus kitab. Hanya selisih bujur ekliptika; tidak mencakup lintang aspek, rumah, tasyir, atau siklus panjang. **AUTO** adalah model hipotesis modern: bobot planet ±, aspek, applying/exact/separating, dan orb; bukan rumus perdagangan emas al-Biruni, tanpa backtest, tanpa data harga, dan tidak dibaca EA.</p><p>Posisi geosentrik tropikal dihitung memakai Astronomy Engine 2.1.19, apparent true ecliptic of date. Pencarian memakai grid 15 menit, lalu akar sudut aspek dan batas orb disempurnakan hingga interval ≤1 detik. Angka tersebut adalah resolusi pencarian numerik, bukan jaminan akurasi astronomi satu detik. Retrograde dan kontak berulang tetap dicatat; titik terdekat yang tidak mencapai aspek tidak dilabeli exact. Orb 2° adalah setelan awal aplikasi yang bisa diubah, bukan angka baku dari kitab.</p><p><a href="https://archive.org/details/kitabalqanunalma03biru/page/n307/mode/1up" target="_blank" rel="noopener noreferrer">Edisi cetak jilid III, halaman 1373 · applying/exact/separating</a> · <a href="https://www.qdl.qa/en/archive/81055/vdc_100022880536.0x000001" target="_blank" rel="noopener noreferrer">Manuskrip British Library Or 1997</a> · <a href="https://archive.org/details/al-qanun-al-masudi-biruni-muhammad-ibn-ahmad" target="_blank" rel="noopener noreferrer">Koleksi yang kamu kirim</a> · <a href="https://github.com/cosinekitty/astronomy/blob/v2.1.19/source/js/README.md" target="_blank" rel="noopener noreferrer">Dokumentasi ephemeris</a>.</p></details>
 </div>`;
const status=(message,error=false)=>{$('abStatus').textContent=message;$('abStatusBox').classList.toggle('ab-error',error);};
const pairLabel=e=>e.pair.map(id=>names[id]).join(' ↔ ');
function chip(bias){const cls={BUY:'buy',SELL:'sell',KONFLIK:'conflict',NETRAL:'neutral'}[bias]||'neutral';return `<span class="ab-chip ab-${cls}">${esc(bias)}</span>`;}
function save(){
 const config={mode:$('abMode').value,focus:$('abFocus').value,orb:Number($('abOrb').value),rules,biasMode};
 try{localStorage.setItem(KEY,JSON.stringify(config));$('abSaveNote').textContent='Setelan disimpan di perangkat ini.';}
 catch(e){$('abSaveNote').textContent='Penyimpanan perangkat tidak tersedia; setelan berlaku selama halaman terbuka.';}
}
function setBusy(value){
 busy=value;
 for(const id of ['abDate','abMode','abFocus','abOrb','abBiasMode','abRun','abRunThree','abToday','abPrev','abNext'])$(id).disabled=value;
 $('abCancel').disabled=!value;$('abCSV').disabled=value||!result;$('abStudyCSV').disabled=value||!result;$('abProgress').hidden=!value;
}
const THREE_MODES=Object.freeze([
 {mode:'day',title:'HARIAN',style:'INTRADAY'},
 {mode:'week',title:'MINGGUAN',style:'SWING'},
 {mode:'month',title:'BULANAN',style:'POSITION TRADE'}
]);
function threeInputsKey(){return JSON.stringify([$('abDate').value,$('abFocus').value,$('abOrb').value]);}
function clearThree(){
 threePlans=null;threeKey='';
 $('abThreeResult').hidden=true;$('abThreeCards').replaceChildren();
}
function renderThree(){
 if(!threePlans||threeKey!==threeInputsKey()){clearThree();return;}
 const phases={APPLYING:'MENDEKAT',EXACT:'TEPAT',SEPARATING:'MENJAUH',STATION:'STASIONER'};
 $('abThreeResult').hidden=false;
 $('abThreeCards').innerHTML=THREE_MODES.map(m=>{
  const p=threePlans[m.mode];if(!p)throw Error('Hasil tiga periode tidak lengkap.');
  const entry=p.entryUTC!==null,direction=entry?p.direction:'WAIT';
  const reason=entry?'Puncak bobot hipotesis window dominan':
   p.reason==='NO_SINGLE_DIRECTION'?'Tidak ada satu arah dominan':
   p.reason==='MARKET_CLOSED'?'Market tutup':'Tidak ada window valid searah dominasi';
  const a=p.aspect;
  const aspect=a?
   '<p class="ab-three-aspect"><strong>Dasar aspek:</strong> '+
    esc(a.pair.map(x=>names[x]||x).join(' ↔ '))+' · '+esc(a.name)+' '+a.angle+
    '° · '+esc(phases[a.phase]||a.phase)+' · orb '+a.orb.toFixed(3)+'°</p>':
   '<p class="ab-three-aspect">Ora ana aspek pendukung valid ing waktu kandidat.</p>';
  return '<article class="ab-three-card" data-ab-horizon="'+m.mode+'">'+
   '<header><div><h4>'+m.title+'</h4><small>'+m.style+'</small></div>'+
   '<strong class="ab-three-direction">'+chip(direction)+'</strong></header>'+
   '<p class="ab-three-range">'+esc(C.iso(p.periodStart))+' s.d. '+
    esc(C.iso(p.periodEnd-1))+' WIB · grid '+p.resolutionMinutes+' menit</p>'+
   (entry?
    '<div class="ab-three-entry"><small>TANGGAL & JAM KANDIDAT ENTRY (WIB)</small>'+
    '<strong>'+esc(p.entryWIB)+'</strong>'+
    '<span>'+(p.entryUTC<Date.now()?'WAKTU TELAH LEWAT · ':'')+
    'Kandidat INTI eksperimen, bukan sinyal order MT5</span></div>'+
    '<div class="ab-three-times">'+
    '<div><small>MULAI</small><b>'+esc(p.startWIB)+'</b></div>'+
    '<div><small>INTI</small><b>'+esc(p.coreWIB)+'</b></div>'+
    '<div><small>AKHIR</small><b>'+esc(p.endWIB)+'</b></div></div>'+
    aspect:
    '<div class="ab-three-entry"><small>TANGGAL & JAM KANDIDAT ENTRY (WIB)</small>'+
    '<strong>WAIT — TIDAK ADA ENTRY</strong><span>'+esc(reason)+'</span></div>')+
   '<p class="ab-three-muted">'+esc(reason)+
   ' · BUY '+p.summary.buyMinutes+' menit / SELL '+p.summary.sellMinutes+
   ' menit (skor durasi, bukan tingkat keberhasilan).</p>'+
   '</article>';
 }).join('');
}
async function runThree(){
 if(busy)return;
 if(biasMode!=='AUTO'){status('Aktifkan AUTO EKSPERIMEN kanggo hitung 3 dominasi.',true);return;}
 const date=$('abDate').value,focus=$('abFocus').value,orb=Number($('abOrb').value);
 clearThree();
 try{
  for(const m of THREE_MODES)C.period(date,m.mode);
  if(!Number.isFinite(orb)||orb<0.25||orb>5)throw Error('Orb harus 0.25°–5°.');
 }catch(e){status(e.message,true);return;}
 const request=++token,finished={};
 setBusy(true);$('abProgress').value=0;
 status('Memuat ephemeris untuk tiga perhitungan terpisah…');save();
 try{
  const A=await library();if(request!==token)return;
  for(let i=0;i<THREE_MODES.length;i++){
   const m=THREE_MODES[i],localEngine=C.createEngine(A);
   const calculated=await C.scan(localEngine,date,{
    mode:m.mode,focus,orb,cancelled:()=>request!==token,
    onProgress:p=>{if(request===token){
     const pct=Math.round((i+p/100)/THREE_MODES.length*100);
     $('abProgress').value=pct;status('Menghitung '+m.title+' mandiri · '+pct+'%');
    }}
   });
   if(request!==token)return;
   finished[m.mode]=C.periodEntryReport(localEngine,calculated);
  }
  if(request!==token)return;
  threePlans=finished;threeKey=threeInputsKey();
  renderThree();
  status('Selesai: 3 arah independen, tanggal/jam WIB, MULAI–INTI–AKHIR. Hanya hipotesis eksperimen.');
 }catch(e){
  if(request===token){clearThree();status('Hitung 3 periode gagal: '+(e.message||String(e)),true);}
 }finally{if(request===token)setBusy(false);}
}
function invalidate(){
 clearThree();token++;result=null;engine=null;periodSummary=null;selectedDate='';$('abResults').hidden=true;$('abCalendar').replaceChildren();$('abEvents').replaceChildren();$('abActive').replaceChildren();$('abCSV').disabled=true;$('abStudyCSV').disabled=true;
 status('Pengaturan berubah. Klik Hitung peta aspek untuk memperbarui hasil.');save();
}
function shortTime(ms){return C.stamp(ms).replace(' WIB','');}
function eventTime(ms,clipped){return esc(shortTime(ms))+(clipped?'<small>Batas periode · kontak berlanjut</small>':'');}
function updateRuleSummary(){
 if(biasMode==='AUTO'){$('abRuleState').textContent='AUTO · WAIT';$('abRuleCaption').textContent='Interpretasi modern, BUKAN sinyal trading teruji.';return;}
 const n=Object.values(rules).filter(v=>v!=='NETRAL').length;
 $('abRuleState').textContent=n?'UJI MANUAL':'NETRAL';
 $('abRuleCaption').textContent=n?`${n} aturan diberi arah · belum divalidasi`:'Atur hipotesis BUY/SELL di setelan bawah.';
}
function inspect(){
 if(!result||!engine)return;
 const time=$('abTime').value;if(!/^\d{2}:\d{2}(:\d{2})?$/.test(time))return;
 const [h,m,sec=0]=time.split(':').map(Number);if(h>23||m>59||sec>59)return;
 try{
  const ms=C.parseDate(selectedDate)+(h*60+m)*C.MIN+sec*1000;
  const snapshot=C.inspect(engine,result,ms,rules);
  const automatic=biasMode==='AUTO'?C.autoSignal(engine,result,ms):null;
  const direction=automatic?automatic.direction:snapshot.direction;
  const primary=periodSummary?.direction||'NETRAL';
  const counter=automatic&&['BUY','SELL'].includes(primary)&&direction!==primary;
  $('abInspectLabel').innerHTML='<span class="ab-auto-only">ASPEK '+(automatic?'AUTO EKSPERIMEN · BELUM FILTER EA':'MANUAL · UJI HIPOTESIS')+'</span> '+chip(direction)+' <span>· '+esc(selectedDate+' '+time+' WIB')+'</span>'+
   (counter?' <small>· LUAR FOKUS '+esc(primary)+' / SKIP</small>':'');
  const phases={APPLYING:'Mendekat',EXACT:'Exact',SEPARATING:'Menjauh',STATION:'Titik balik'};
  if(automatic){
   const explanations={
    NO_ACTIVE_ASPECT:'Tidak ada aspek aktif pada jam ini.',
    NO_STRONG_PLANETARY_COMBINATION:'Aspek aktif ada, namun bobot planet terlalu lemah.',
    BUY_SELL_OVERLAP:'Aspek BUY dan SELL bersamaan; KONFLIK.',
    NET_SCORE_BELOW_THRESHOLD:'Kekuatan arah bersih kurang dari batas minimum.',
    DOMINANT_WEIGHTED_ASPECTS:'Arah hipotesis sesuai jumlah bobot planet, aspek, fase dan orb.'
   };
   $('abRuleState').textContent=direction+' · AUTO';
   $('abRuleCaption').textContent='AUTO V1 EKSPERIMEN · bukan probabilitas pasar.';
   $('abInspectInfo').textContent=(explanations[automatic.reason]||automatic.reason)+
    ' Bobot BUY '+automatic.buy.toFixed(3)+' / SELL '+automatic.sell.toFixed(3)+
    ' (bukan confidence).';
   const d=automatic.dominant;
   $('abAutoStatus').hidden=false;
   $('abAutoStatus').innerHTML='<b>ASPEK AUTO '+esc(direction)+' · BUKAN KEPUTUSAN EA</b>'+
    (counter?'<p>SKIP: jam iki ora searah fokus '+esc(primary)+' kanggo periode sing dipilih.</p>':'')+
    '<p>Bobot model: BUY '+automatic.buy.toFixed(3)+' · SELL '+automatic.sell.toFixed(3)+
    ' · bukan persentase kemungkinan profit.</p>'+
    (d?'<p>Aspek dominan: '+esc(pairLabel(d))+' '+esc(d.name)+' '+d.angle+'° · '+
       esc(phases[d.phase]||d.phase)+' · orb '+d.orb.toFixed(3)+'°</p>'+
       '<div class="ab-auto-times">'+
       '<span>MULAI ASPEK '+esc(shortTime(d.start))+'</span>'+
       '<span>INTI ASPEK '+esc(shortTime(d.exact??d.closest))+
         (d.exact===null?' (terdekat, bukan exact)':'')+'</span>'+
       '<span>AKHIR ASPEK '+esc(shortTime(d.end))+'</span></div>':
       '<p>Tidak ada aspek dominan pada jam ini.</p>')+
    '<small>Jam di atas milik aspek DOMINAN, tidak membuktikan awal/akhir tren XAUUSD.</small>';
  }else{
   $('abAutoStatus').hidden=true;$('abAutoStatus').replaceChildren();
   updateRuleSummary();
   const configured=Object.values(rules).some(v=>v!=='NETRAL');
   $('abInspectInfo').textContent=snapshot.direction==='KONFLIK'?
    'BUY dan SELL aktif bersamaan; tidak ada arah tunggal.':
    configured?'Bias uji manual pada window aktif; bukan sinyal terverifikasi.':
    'Arah NETRAL karena aturan manual belum diatur.';
  }
  $('abActive').innerHTML=snapshot.active.map(e=>{
   const upcoming=e.exactTimes.find(t=>t>=ms);
   const previous=e.exactTimes.filter(t=>t<ms).slice(-1)[0];
   const info=upcoming!==undefined?'Exact berikutnya: '+shortTime(upcoming):
    previous!==undefined?'Exact sebelumnya: '+shortTime(previous):
    'Titik terdekat: '+shortTime(e.closest)+' (bukan exact)';
   const a=automatic?.active.find(x=>x.id===e.id);
   const label=a?chip(a.contribution>0?'BUY':a.contribution<0?'SELL':'NETRAL')+
     ' bobot '+a.contribution.toFixed(3):chip(e.bias);
   return esc(pairLabel(e))+' '+e.angle+'° · orb '+e.orb.toFixed(4)+
    '° · '+esc(phases[e.phase]||e.phase)+' · '+label+
    ' <small>· '+esc(info)+'</small>';
  }).join('<br>')||'Tidak ada aspek aktif pada jam yang diperiksa.';
 }catch(e){
  $('abAutoStatus').hidden=true;
  $('abInspectInfo').textContent='Gagal memeriksa waktu: '+(e.message||String(e));
  $('abActive').replaceChildren();
 }
}
function renderDay(){
 if(!result||!engine)return;
 const day=C.daily(result).find(d=>d.date===selectedDate);if(!day)return;
 panel.querySelectorAll('[data-ab-date]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.abDate===selectedDate)));
 $('abDayTitle').textContent=weekdays[day.weekday]+', '+selectedDate+' · '+day.exactCount+' exact / '+day.events.length+' window aktif';
 $('abBiasTableHeader').textContent=biasMode==='AUTO'?'Asumsi bobot awal':'Bias uji manual';
 if(biasMode==='AUTO'){
  // Estimated bias windows sampled at 15-minute spacing; exact orbital times are in event rows.
  const report=periodSummary||C.autoPeriodSummary(engine,result);
  const selected=report.days.find(d=>d.date===selectedDate);
  const windows=selected?.focusWindows||[],focus=report.direction;
  const shown=selected?.marketClosed?'MARKET TUTUP':
   focus==='NETRAL'?'NETRAL / WAIT':windows.length?focus:'WAIT / TIDAK SEARAH';
  $('abAutoWindows').hidden=false;
  $('abAutoWindows').innerHTML='<h4>FOKUS 1 ARAH · '+esc(shown)+' · '+
   windows.length+' window searah · grid '+report.resolutionMinutes+' menit</h4>'+
   (windows.map(w=>'<div class="ab-auto-win">'+chip(w.direction)+
    ' <span>MULAI ~'+esc(shortTime(w.start))+
    ' · INTI grid ~'+esc(shortTime(w.peak))+
    ' · AKHIR ~'+esc(shortTime(w.end))+' WIB</span>'+
    ' <button type="button" data-ab-autopick="'+w.peak+'">Lihat INTI</button></div>').join('')||
    '<p>Ora ana window searah fokus periode. Ora diganti dadi sinyal arah lawan.</p>')+
   '<small>Data aspek lan arah lawan tetep ana ing tabel audit ngisor, nanging ora dadi kandidat fokus. Waktu grid iku perkiraan, dudu bukti tren XAUUSD.</small>';
 }else{$('abAutoWindows').hidden=true;$('abAutoWindows').replaceChildren();}
 $('abEvents').innerHTML=day.events.map(e=>{
  const exact=e.exactTimes.length?e.exactTimes.map(ms=>esc(shortTime(ms))).join('<br>'):
   esc(shortTime(e.closest))+'<small>Terdekat '+e.closestOrb.toFixed(4)+'° · bukan exact</small>';
  const base=((C.AUTO_NATURE[e.pair[0]]+C.AUTO_NATURE[e.pair[1]])/2)*C.AUTO_ASPECT[e.angle];
  const hypothesis=biasMode==='AUTO'?
   '<small>Bobot awal '+base.toFixed(3)+'; fase dan orb dinilai pada jam dipilih.</small>':
   chip(rules[e.angle])+(rules[e.angle]!=='NETRAL'?
   '<small>Hipotesis manual · belum divalidasi</small>':'');
  return '<tr><td><b>'+esc(pairLabel(e))+'</b><small>'+esc(e.name)+' '+e.angle+
   '°</small></td><td>'+eventTime(e.start,e.startClipped)+'</td><td>'+exact+
   '</td><td>'+eventTime(e.end,e.endClipped)+'</td><td>'+hypothesis+'</td></tr>';
 }).join('')||'<tr><td colspan="5" class="ab-empty">Tidak ada window aspek pada hari ini.</td></tr>';
 inspect();
}
function renderPeriodOverview(){
 if(!result||!engine)return;
 const modeNames={day:'HARIAN',week:'MINGGUAN',month:'BULANAN'};
 const mode=result.range.mode;
 panel.querySelectorAll('[data-ab-mode]').forEach(b=>{
  const active=b.dataset.abMode===mode;
  b.classList.toggle('active',active);
  b.setAttribute('aria-pressed',String(active));
 });
 if(biasMode!=='AUTO'){
  $('abPeriodSummary').hidden=false;
  $('abPeriodSummary').innerHTML='<h3>RINGKASAN '+modeNames[mode]+' · MANUAL</h3>'+
   '<p>Mode MANUAL ora ngitung arah otomatis. Pilih jam lan atur label aspek kanggo uji hipotesis.</p>';
  $('abPeriodDays').hidden=true;$('abPeriodDays').replaceChildren();return;
 }
 if(!periodSummary)periodSummary=C.autoPeriodSummary(engine,result);
 const r=periodSummary,focus=r.dominantWindow;
 const fmt=ms=>ms===null?'—':shortTime(ms).slice(11,19);
 $('abPeriodSummary').hidden=false;
 $('abPeriodSummary').innerHTML=
  '<h3>RINGKASAN '+modeNames[mode]+' · AL-BIRUNI AUTO EKSPERIMEN</h3>'+
  '<p class="ab-period-sub">'+esc(C.iso(r.start))+' — '+esc(C.iso(r.end-1))+
   ' WIB · sampling '+r.resolutionMinutes+' menit · Senin–Jumat untuk arah XAUUSD</p>'+
  '<div class="ab-period-focus"><span>FOKUS SATU ARAH · AUTO EKSPERIMEN</span>'+
   chip(r.direction)+'<small>BUY '+r.buyMinutes+' menit · SELL '+r.sellMinutes+
   ' menit. '+r.focusDays+' dina searah · '+r.waitDays+' dina WAIT. Durasi model, bukan probabilitas / backtest.</small></div>'+
  '<div class="ab-period-times">'+
   '<div><small>MULAI</small><strong>'+esc(fmt(r.startWindow))+'</strong></div>'+
   '<div><small>INTI</small><strong>'+esc(fmt(r.core))+'</strong></div>'+
   '<div><small>AKHIR</small><strong>'+esc(fmt(r.endWindow))+'</strong></div>'+
  '</div>'+
  '<p class="ab-period-sub">'+(focus?
   'Window dominan paling dawa: '+esc(C.iso(focus.start))+
   '. Waktu perkiraan grid, bukan prediksi pergerakan emas.':
   'Arah imbang / ora ana window kuat. Tetep NETRAL.')+'</p>';
 $('abPeriodDays').hidden=false;
 $('abPeriodDays').innerHTML='<h3>Rincian saben tanggal · mung '+esc(r.direction)+'</h3>'+
  '<div class="ab-period-grid">'+r.days.map(d=>{
   const w=d.focusWindow;
   return '<button type="button" data-ab-period-date="'+d.date+
    '" class="ab-period-day" aria-label="'+esc(d.date)+' '+esc(d.focusDirection)+'">'+
    '<small>'+weekdays[d.weekday]+' '+esc(d.date)+'</small>'+
    (d.marketClosed?'<strong>MARKET TUTUP</strong>':chip(d.focusDirection))+
    '<span>Durasi searah '+d.focusMinutes+'m'+
    (d.counterMinutes?' · '+d.counterMinutes+'m lawan diabaikan':'')+'</span>'+
    '<span>'+(w?'MULAI ~'+esc(fmt(w.start))+' · INTI ~'+esc(fmt(w.peak))+
      ' · AKHIR ~'+esc(fmt(w.end)):'WAIT · ora ana window searah')+'</span>'+
    '</button>';
  }).join('')+'</div>'+
  '<p class="ab-period-sub">Mung window '+esc(r.direction)+' sing ditonjolake. Arah lawan ora diganti, tetep bisa diaudit. Sabtu/Minggu market tutup.</p>';
}
function render(){
 if(!result)return;
 const days=C.daily(result),exact=result.events.reduce((n,e)=>n+e.exactTimes.length,0);
 renderPeriodOverview();
 $('abResults').hidden=false;$('abCSV').disabled=false;$('abStudyCSV').disabled=false;
 $('abExactCount').textContent=String(exact);$('abWindowCount').textContent=String(result.events.length);
 $('abPeriodLabel').textContent=C.iso(result.range.start)+' → '+C.iso(result.range.end-1)+' WIB';
 $('abSettingsLabel').textContent=(result.focus==='moon'?'6 pasangan Bulan':'21 pasangan klasik')+' · orb '+result.orb+'°';
 updateRuleSummary();
 const calendar=$('abCalendar');calendar.className='ab-calendar'+(result.range.mode==='month'?' ab-month':result.range.mode==='day'?' ab-day':'');
 const blanks=result.range.mode==='month'?(days[0].weekday+6)%7:0;
 calendar.innerHTML=Array.from({length:blanks},()=>'<span aria-hidden="true"></span>').join('')+days.map(d=>`<button type="button" class="ab-day-card${[0,6].includes(d.weekday)?' ab-weekend':''}" data-ab-date="${d.date}" aria-pressed="${d.date===selectedDate}" aria-label="${weekdays[d.weekday]} ${d.date}, ${d.exactCount} exact"><span>${weekdays[d.weekday]}</span><strong>${Number(d.date.slice(-2))}</strong><span class="ab-count">${d.exactCount} exact</span><span>${d.events.length} window${[0,6].includes(d.weekday)?' · akhir pekan':''}</span></button>`).join('');
 renderDay();
}
async function library(){
 if(root.Astronomy)return root.Astronomy;if(loading)return loading;
 loading=(async()=>{
  for(const url of ['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js','https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js']){
   try{
    await new Promise((resolve,reject)=>{
     const el=document.createElement('script');let done=false;
     const timeout=setTimeout(()=>finish(Error('Pustaka astronomi timeout.')),15000);
     function finish(error){if(done)return;done=true;clearTimeout(timeout);el.onload=el.onerror=null;if(error){el.remove();reject(error);}else resolve();}
     el.src=url;el.async=true;el.referrerPolicy='no-referrer';el.onload=()=>finish(root.Astronomy?null:Error('Pustaka astronomi tidak tersedia.'));el.onerror=()=>finish(Error('Pustaka astronomi gagal dimuat.'));document.head.appendChild(el);
    });
    return root.Astronomy;
   }catch(e){/* Try the second pinned source; never invent positions. */}
  }
  throw Error('Astronomy Engine tidak dapat dimuat. Periksa koneksi lalu hitung lagi.');
 })().finally(()=>{loading=null;});return loading;
}
async function run(){
 if(busy)return;
 const date=$('abDate').value,mode=$('abMode').value,focus=$('abFocus').value,orb=Number($('abOrb').value);
 result=null;engine=null;periodSummary=null;$('abResults').hidden=true;$('abCSV').disabled=true;$('abStudyCSV').disabled=true;
 try{C.period(date,mode);if(!Number.isFinite(orb)||orb<0.25||orb>5)throw Error('Orb harus 0.25°–5°.');}
 catch(e){status(e.message,true);return;}
 const request=++token;setBusy(true);$('abProgress').value=0;status('Memuat ephemeris panel Al-Biruni…');save();
 try{
  const A=await library();if(request!==token)return;
  const isolated=C.createEngine(A);
  const calculated=await C.scan(isolated,date,{mode,focus,orb,cancelled:()=>request!==token,onProgress:p=>{if(request===token){$('abProgress').value=p;status('Menghitung aspek dan waktu kontak · '+p+'%');}}});
  if(request!==token)return;
  engine=isolated;result=calculated;periodSummary=null;
  const today=C.iso(Date.now());selectedDate=result.range.days.some(d=>d.date===date)?date:result.range.days.some(d=>d.date===today)?today:result.range.days[0].date;
  render();status('Selesai · peta aspek dihitung. AUTO/MANUAL tetap hipotesis, bukan prediksi teruji.');
 }catch(e){if(request===token){result=null;engine=null;$('abResults').hidden=true;$('abCSV').disabled=true;$('abStudyCSV').disabled=true;status('Perhitungan gagal: '+(e.message||String(e)),true);}}
 finally{if(request===token)setBusy(false);}
}
function move(delta){
 try{
  const mode=$('abMode').value,r=C.period($('abDate').value,mode),d=new Date(r.start+C.WIB);
  if(mode==='month')d.setUTCMonth(d.getUTCMonth()+delta);else d.setUTCDate(d.getUTCDate()+delta*(mode==='week'?7:1));
  const date=d.toISOString().slice(0,10);C.period(date,mode);$('abDate').value=date;run();
 }catch(e){status(e.message,true);}
}
$('abDate').value=C.iso(Date.now());
if(['day','week','month'].includes(saved.mode))$('abMode').value=saved.mode;
$('abBiasMode').value=biasMode;
if(['moon','all'].includes(saved.focus))$('abFocus').value=saved.focus;
if(Number.isFinite(saved.orb)&&saved.orb>=0.25&&saved.orb<=5)$('abOrb').value=String(saved.orb);
C.ASPECTS.forEach(a=>$('abRule'+a.angle).value=rules[a.angle]);
for(const id of ['abDate','abMode','abFocus','abOrb'])$(id).addEventListener('change',invalidate);
panel.querySelectorAll('[data-ab-mode]').forEach(b=>b.addEventListener('click',()=>{
 const mode=b.dataset.abMode;
 if(!['day','week','month'].includes(mode)||busy)return;
 if($('abMode').value!==mode){$('abMode').value=mode;invalidate();run();}
}));
$('abPeriodDays').addEventListener('click',e=>{
 const b=e.target.closest('[data-ab-period-date]');if(!b||!result)return;
 const date=b.dataset.abPeriodDate;
 if(!result.range.days.some(x=>x.date===date))return;
 selectedDate=date;renderDay();
 $('abDayTitle').scrollIntoView?.({behavior:'smooth',block:'start'});
});
$('abBiasMode').addEventListener('change',()=>{
 biasMode=$('abBiasMode').value==='MANUAL'?'MANUAL':'AUTO';save();
 if(biasMode!=='AUTO')clearThree();
 if(result){updateRuleSummary();renderPeriodOverview();renderDay();}
});
$('abRun').addEventListener('click',run);
$('abRunThree').addEventListener('click',runThree);
$('abToday').addEventListener('click',()=>{$('abDate').value=C.iso(Date.now());run();});
$('abPrev').addEventListener('click',()=>move(-1));$('abNext').addEventListener('click',()=>move(1));
$('abCancel').addEventListener('click',()=>{token++;result=null;engine=null;periodSummary=null;clearThree();$('abResults').hidden=true;setBusy(false);status('Dibatalkan. Klik Hitung peta aspek untuk memulai lagi.');});
$('abAutoWindows').addEventListener('click',event=>{
 const b=event.target.closest('[data-ab-autopick]');if(!b||!result)return;
 const timeMs=Number(b.dataset.abAutopick);
 if(!Number.isFinite(timeMs)||timeMs<result.range.start||timeMs>=result.range.end)return;
 $('abTime').value=C.stamp(timeMs).slice(11,19);inspect();
});
$('abCalendar').addEventListener('click',event=>{const b=event.target.closest('[data-ab-date]');if(!b||!result)return;selectedDate=b.dataset.abDate;renderDay();});
$('abTime').addEventListener('input',inspect);
panel.querySelectorAll('[data-ab-rule]').forEach(select=>select.addEventListener('change',()=>{rules=C.normalizeRules(Object.fromEntries(C.ASPECTS.map(a=>[a.angle,$('abRule'+a.angle).value])));save();if(result&&biasMode==='MANUAL'){updateRuleSummary();renderDay();}}));
$('abResetRules').addEventListener('click',()=>{rules=C.normalizeRules();C.ASPECTS.forEach(a=>$('abRule'+a.angle).value='NETRAL');save();if(result){updateRuleSummary();renderDay();}});
$('abCSV').addEventListener('click',()=>{
 if(!result||busy)return;
 const url=URL.createObjectURL(new Blob([C.toCSV(result,rules)],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='ALBIRUNI_ASPECTS_'+C.iso(result.range.start)+'_'+result.range.mode+'.csv';panel.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 status('CSV seluruh periode diunduh, termasuk batas periode dan label hipotesis manual.');
});
$('abStudyCSV').addEventListener('click',()=>{
 if(!result||busy)return;
 const csv=biasMode==='AUTO'?C.toAutoStudyCSV(engine,result,rules):C.toStudyCSV(result,rules);
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='ALBIRUNI_RISET_XAUUSD_'+biasMode+'_'+C.iso(result.range.start)+'_'+result.range.mode+'.csv';
 panel.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 status('CSV riset '+biasMode+' diekspor: waktu exact/terdekat dan label hipotesis; harga XAUUSD tetap kosong.');
});
const nav=document.querySelector('.viewtabs');
if(nav)nav.addEventListener('click',e=>{
 const tab=e.target.closest('.viewtab');if(tab)panel.hidden=tab.id!=='tabAlBiruni';
});
run();
})(window);
