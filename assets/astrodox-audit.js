/* ASTRODOX REV-01 — isolated astrology event audit, NOT a trading signal.
 * Al-Biruni timing core remains unchanged. Astro-Seek is a manual cross-check,
 * not an API. No prices/backtest = WAIT; never promote legacy votes to live signals.
 */
(function(root){
'use strict';
const VERSION='1.0.0',WIB='Asia/Jakarta',NEW_YORK='America/New_York';
const BODIES=Object.freeze({Sun:'Matahari',Moon:'Bulan',Mercury:'Merkurius',Venus:'Venus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturnus'});
function check(ok,message){if(!ok)throw Error(message);}
function parts(ms,zone){
 check(Number.isFinite(ms),'Waktu UTC tidak valid.');
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
 const get=t=>p.find(v=>v.type===t)?.value;
 return get('year')+'-'+get('month')+'-'+get('day')+' '+get('hour')+':'+get('minute')+':'+get('second');
}
function isoDate(ms){return parts(ms,WIB).slice(0,10);}
function format(ms,zone=WIB){return parts(ms,zone)+(zone===WIB?' WIB':' New York');}
function eventPhase(event){
 if(event.exactTimes?.length)return 'EXACT';
 return event.closestOrb<=0.5?'TERDEKAT ≤0,5° (bukan exact)':'TANPA INTI ≤0,5°';
}
function build(result,directionAt){
 check(result&&result.range&&Array.isArray(result.events),'Data aspek tidak lengkap.');
 check(typeof directionAt==='function','Pembanding hipotesis tidak tersedia.');
 const rows=result.events.map(e=>{
  check(Array.isArray(e.pair)&&e.pair.length===2&&Number.isFinite(e.start)&&Number.isFinite(e.end)
   &&Number.isFinite(e.closest)&&Number.isFinite(e.closestOrb),'Data aspek tidak valid.');
  const exact=(e.exactTimes||[]).find(ms=>ms>=result.range.start&&ms<result.range.end);
  const core=Number.isFinite(exact)?exact:e.closest;
  const raw=directionAt(core,e);
  const hypothesis=raw==='BUY'||raw==='SELL'?raw:'NETRAL/KONFLIK';
  return Object.freeze({
   id:e.id, pair:e.pair.map(x=>BODIES[x]||x).join(' / '), angle:e.angle,
   aspect:e.name, start:e.start, core, end:e.end, orb:e.closestOrb,
   phase:eventPhase(e), exact:Number.isFinite(exact), clipped:!!(e.startClipped||e.endClipped),
   hypothesis, decision:'WAIT',reason:'BELUM_TERVALIDASI_DENGAN_DATA_HARGA'
  });
 }).sort((a,b)=>a.core-b.core||String(a.id).localeCompare(String(b.id)));
 const buy=rows.filter(r=>r.hypothesis==='BUY').length;
 const sell=rows.filter(r=>r.hypothesis==='SELL').length;
 const hypothesis=buy>sell?'BUY':sell>buy?'SELL':'NETRAL/KONFLIK';
 return Object.freeze({version:VERSION,date:result.range.date,model:'ASTRODOX_AUDIT_REV01',
  status:'WAIT',validated:false,hypothesis,buyVotes:buy,sellVotes:sell,rows,
  reason:'Belum ada hasil backtest XAUUSD out-of-sample; BUY/SELL hanya hipotesis mayoritas aspek Al-Biruni lama.'});
}
function csv(report){
 check(report&&Array.isArray(report.rows),'Laporan audit tidak valid.');
 const header=['version','tanggal_wib','pasangan','aspek','derajat','awal_utc','inti_utc','akhir_utc',
  'awal_wib','inti_wib','akhir_wib','inti_new_york','fase','orb_terdekat',
  'window_terpotong','hipotesis_lama_TIDAK_VALID','status_final','alasan',
  'harga_masuk_ISI_MANUAL','harga_keluar_ISI_MANUAL','hasil_xau_ISI_MANUAL'];
 const q=x=>'"'+String(x).replace(/"/g,'""')+'"';
 const vals=report.rows.map(r=>[report.version,report.date,r.pair,r.aspect,r.angle,
  new Date(r.start).toISOString(),new Date(r.core).toISOString(),new Date(r.end).toISOString(),
  format(r.start),format(r.core),format(r.end),format(r.core,NEW_YORK),r.phase,
  r.orb.toFixed(6),r.clipped,r.hypothesis,r.decision,r.reason,'','','']);
 return '\uFEFF'+[header,...vals].map(row=>row.map(q).join(',')).join('\r\n')+'\r\n';
}
const api=Object.freeze({VERSION,WIB,NEW_YORK,format,isoDate,build,csv,eventPhase});
root.CebonkAstrodoxAudit=api;
if(typeof document==='undefined')return;
const C=root.CebonkAlBiruni;
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null,running=false,library=null;
function mount(){
 const nav=document.querySelector('.viewtabs'),main=document.querySelector('main.wrap');
 if(!nav||!main||!C||document.getElementById('astrodoxAuditView'))return;
 const tab=document.createElement('button');
 tab.type='button';tab.id='tabAstrodoxAudit';tab.className='viewtab';tab.textContent='ASTRODOX AUDIT';
 nav.appendChild(tab);
 const panel=document.createElement('section');
 panel.id='astrodoxAuditView';panel.hidden=true;
 panel.setAttribute('aria-label','Audit sinyal ASTRODOX eksperimen');
 panel.innerHTML=String.raw`
 <section class="panel">
  <div class="head"><div><h2>ASTRODOX REV-01 · Audit astrologi XAUUSD</h2>
  <small>Panel terpisah. Mesin Al-Biruni dan ASTROLOGY lama tidak diubah.</small></div></div>
  <div style="padding:16px">
   <p style="margin-top:0">Status keputusan: <strong>WAIT hingga ada backtest independen</strong>.
   BUY/SELL mayoritas aspek yang tampil di bawah hanyalah hipotesis lama, bukan instruksi trading.</p>
   <div style="display:flex;flex-wrap:wrap;align-items:end;gap:12px">
    <div><label for="adDate">Tanggal WIB</label><input id="adDate" type="date" min="2020-01-01" max="2040-12-31"></div>
    <button id="adRun" class="primary" type="button">Hitung aspek &amp; audit</button>
    <button id="adCsv" type="button" disabled>Ekspor CSV riset</button>
   </div>
   <p id="adStatus" role="status" aria-live="polite" class="muted">Siap. Perhitungan membutuhkan Astronomy Engine.</p>
  </div>
 </section>
 <section id="adResult" class="panel" hidden>
  <div class="head"><div><h2 id="adDecision">WAIT · belum tervalidasi</h2><small id="adHypothesis">—</small></div></div>
  <div class="footnote">Waktu AWAL/INTI/AKHIR merupakan batas orb 1,5° dan waktu exact/terdekat.
  Bila tidak mencapai exact, tertulis jelas. Batas hari dapat memotong window.
  New York memakai America/New_York dengan DST otomatis. WIB menggunakan UTC+7.
  Tanpa akses server MT5, offset broker tidak diasumsikan.</div>
  <div class="scroller"><table>
   <thead><tr><th>Pasangan / aspek</th><th>AWAL WIB</th><th>INTI WIB</th><th>AKHIR WIB</th><th>INTI New York</th><th>Fase</th><th>Hipotesis lama</th><th>Keputusan</th></tr></thead>
   <tbody id="adEvents"></tbody>
  </table></div>
 </section>
 <details><summary>Referensi, cara audit, dan batas penggunaan</summary>
  <p>Posisi planet berasal dari Astronomy Engine melalui mesin <b>Al-Biruni</b> yang sudah ada.
  <a href="https://horoscopes.astro-seek.com/" target="_blank" rel="noopener noreferrer">Astro-Seek</a>
  digunakan untuk membandingkan posisi planet/aspek secara manual; tidak ada API atau sinkronisasi akun Astro-Seek di sini.</p>
  <p>Ekspor CSV memiliki tiga kolom harga kosong untuk dicocokkan dengan data XAUUSD broker.
  Tanpa data harga, spread, biaya, serta pengujian out-of-sample tidak ada winrate atau rekomendasi eksekusi.
  Pasangan waktu di panel bersifat astrologis, bukan jam entry yang sudah valid.</p>
 </details>`;
 main.insertBefore(panel,main.querySelector('footer'));
 const $=id=>panel.querySelector('#'+id);
 $('adDate').value=api.isoDate(Date.now());
 $('adDate').addEventListener('change',()=>{current=null;$('adResult').hidden=true;$('adCsv').disabled=true;$('adStatus').textContent='Tanggal berubah. Hitung ulang.';});
 $('adRun').addEventListener('click',async()=>{
  if(running)return;
  running=true;$('adRun').disabled=true;$('adCsv').disabled=true;$('adResult').hidden=true;
  $('adStatus').textContent='Memuat posisi planet…';
  let engine=null;
  try{
   C.parseDate($('adDate').value);
   const A=await loadLibrary();
   engine=C.createEngine(A);
   const result=await C.scan(engine,$('adDate').value,{
    mode:'day',focus:'moon',orb:1.5,stepMinutes:15,
    onProgress:p=>{$('adStatus').textContent='Menghitung aspek '+p+'%…';}
   });
   current=api.build(result,ms=>C.autoSignal(engine,result,ms).direction);
   $('adDecision').textContent='WAIT · '+safe(current.date)+' · belum tervalidasi';
   $('adHypothesis').textContent='Hipotesis model lama: '+current.hypothesis+
    ' (BUY '+current.buyVotes+' / SELL '+current.sellVotes+') — tidak boleh jadi order otomatis';
   $('adEvents').innerHTML=current.rows.length?current.rows.map(r=>'<tr>'+
    '<td>'+safe(r.pair)+'<small style="display:block">'+safe(r.aspect)+' '+r.angle+'°'+(r.clipped?' · TERPOTONG':'')+'</small></td>'+
    '<td>'+safe(api.format(r.start))+'</td><td>'+safe(api.format(r.core))+'</td>'+
    '<td>'+safe(api.format(r.end))+'</td><td>'+safe(api.format(r.core,NEW_YORK))+'</td>'+
    '<td>'+safe(r.phase)+'</td><td>'+safe(r.hypothesis)+'</td><td>WAIT</td></tr>').join(''):
    '<tr><td colspan="8">Tidak ada aspek Bulan dalam orb 1,5°.</td></tr>';
   $('adResult').hidden=false;$('adCsv').disabled=false;
   $('adStatus').textContent='Selesai: '+current.rows.length+' window. Sinyal eksekusi tetap WAIT karena belum ada validasi XAUUSD.';
  }catch(e){
   current=null;$('adCsv').disabled=true;$('adStatus').textContent='Gagal: '+(e&&e.message||'perhitungan tidak tersedia')+'. Tidak ada sinyal pengganti.';
  }finally{if(engine)engine.clear();running=false;$('adRun').disabled=false;}
 });
 $('adCsv').addEventListener('click',()=>{
  if(!current)return;
  const blob=new Blob([api.csv(current)],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='ASTRODOX_AUDIT_'+current.date+'.csv';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
}
function loadScript(src){
 return new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src=src;s.async=true;s.referrerPolicy='no-referrer';
  s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Library astronomi tidak dapat dimuat'));};
  document.head.appendChild(s);
 });
}
async function loadLibrary(){
 if(root.Astronomy)return root.Astronomy;
 if(!library)library=(async()=>{
  for(const url of ['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
    'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js']){
   try{await loadScript(url);if(root.Astronomy)return root.Astronomy;}catch(e){/* retry alternate origin */}
  }
  throw Error('Astronomy Engine 2.1.19 tidak tersedia');
 })();
 try{return await library;}catch(e){library=null;throw e;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})(typeof window!=='undefined'?window:globalThis);
