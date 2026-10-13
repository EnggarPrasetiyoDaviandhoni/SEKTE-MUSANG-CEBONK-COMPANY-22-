/* AL-BIRUNI classical-direction primary interface — research only.
 * Entirely independent of ALBIRUNI_AUTO_MAJORITY_V2 and EA DIRECT feeds.
 * The pre-existing historical study/control tree remains in legacy archive.
 */
(function(root){
'use strict';
const C=root.CebonkAlBiruni,K=root.CebonkAlBiruniClassic,D=root.CebonkAlBiruniClassicalDirection;
const container=document.getElementById('albiruniPanel');
if(!container||!C||!K||!D)return;
const host=document.createElement('section');
host.id='abClassicalPrimary';host.className='ab-classical-primary';
host.setAttribute('aria-label','AL-BIRUNI arah eksperimen berdasarkan konfigurasi klasik');
host.innerHTML=`
 <div class="abcp-head">
  <div><small>AL-BIRUNI · KAJIAN KLASIK §382–§527</small>
   <h2 id="abClassicalPrimaryTitle">ARAH BERDASARKAN KONFIGURASI PLANET</h2>
   <p>Martabat, kondisi planet, Ascendant, Bulan, penguasa, kontak benefic–malefic. <strong>Ora nganggo mayoritas aspek lawas.</strong></p></div>
  <span class="abcp-pill">RISET KLASIK</span>
 </div>
 <div class="abcp-body">
  <div class="abcp-inputs">
   <label for="abClassicalMainDate">Tanggal acuan WIB<input type="date" min="2020-01-01" max="2040-12-31" id="abClassicalMainDate" required></label>
   <label for="abClassicalMainMode">Periode<select id="abClassicalMainMode">
    <option value="day">HARIAN · 15 menit</option>
    <option value="week">MINGGUAN · 30 menit</option>
    <option value="month">BULANAN · 60 menit</option>
   </select></label>
   <label for="abClassicalMainLatitude">Lintang lokasi<input type="number" min="-89.9" max="89.9" step="0.0001" value="-6.2000" id="abClassicalMainLatitude"></label>
   <label for="abClassicalMainLongitude">Bujur lokasi<input type="number" min="-180" max="180" step="0.0001" value="106.8167" id="abClassicalMainLongitude"></label>
   <label for="abClassicalMainOrb">Orb pemeriksaan<input type="number" min="0.25" max="5" step="0.25" value="2" id="abClassicalMainOrb"></label>
  </div>
  <p class="abcp-caution"><strong>PEMETAAN EKSPERIMEN:</strong> MENGUNTUNGKAN → BUY; MERUGIKAN → SELL; bukti durung cukup → WAIT. Angka bobot lan pemetaan arah dirancang kanggo riset, <strong>dudu rumus prediksi XAUUSD asli saka kitab</strong>. Status izin transaksi website tetep WAIT lan ora mengubah EA MT5.</p>
  <div class="abcp-actions">
   <button type="button" id="abClassicalMainRun">Hitung AL-BIRUNI KLASIK</button>
   <button type="button" id="abClassicalMainCancel" disabled>Batalkan</button>
  </div>
  <p id="abClassicalMainStatus" class="abcp-status" role="status" aria-live="polite">Siap. Lokasi Jakarta mung nilai awal; pilih lokasi sesuai kebutuhan.</p>
  <div id="abClassicalMainResult" hidden>
   <div class="abcp-focus">
    <div><small>DOMINASI KONFIGURASI KLASIK</small><strong id="abClassicalDirection">WAIT</strong><span id="abClassicalQuality">—</span></div>
    <div><small>IZIN ORDER OTOMATIS</small><strong>WAIT</strong><span>Hasil astrologi belum tervalidasi terhadap harga emas.</span></div>
   </div>
   <div class="abcp-time-grid">
    <div><small>AWAL WIB</small><strong id="abClassicalStart">—</strong></div>
    <div><small>INTI WIB</small><strong id="abClassicalCore">—</strong></div>
    <div><small>AKHIR WIB</small><strong id="abClassicalEnd">—</strong></div>
   </div>
   <p id="abClassicalWeights" class="abcp-weights"></p>
   <p id="abClassicalEvidence" class="abcp-evidence"></p>
   <p class="abcp-disclaimer">AWAL = slot arah terkonfirmasi; INTI = skor klasik bersih terkuat ing window sawise kabeh periode dihitung; AKHIR = akhir slot. Ora dipadakake karo gerakan harga utawa jam eksekusi.</p>
   <details class="abcp-details">
    <summary>Rincian konfigurasi lan window AL-BIRUNI</summary>
    <div class="abcp-scroll"><table><thead><tr><th>Arah</th><th>AWAL WIB</th><th>INTI WIB</th><th>AKHIR WIB</th><th>Durasi</th><th>Jumlah bobot</th></tr></thead><tbody id="abClassicalWindows"></tbody></table></div>
    <div class="abcp-scroll abcp-raw"><table><thead><tr><th>Waktu WIB</th><th>Kondisi klasik</th><th>Model arah</th><th>Konfirmasi</th><th>Bobot baik</th><th>Bobot buruk</th><th>Alasan</th></tr></thead><tbody id="abClassicalRows"></tbody></table></div>
    <button type="button" id="abClassicalCSV">Ekspor CSV riset</button>
   </details>
   <details class="abcp-details">
    <summary>Detail martabat dan kontak planet pada INTI</summary>
    <div id="abClassicalFactors"></div>
   </details>
  </div>
  <details class="abcp-details">
   <summary>Metode dan batasan kitab</summary>
   <p>Rumus martabat 5/4/3/2/1, term Mesir §453, Ascendant, sekta siang/malam, kondisi detriment/fall, retrograde dan jarak Matahari dihitung oleh mesin klasik yang sudah ada. Aspek benefic–malefic diperiksa pada penanda Ascendant, Bulan, penguasanya, lan Matahari minangka asosiasi simbolis emas §410. Kekuatan kontak memperhitungkan orb, derajat dan fase estimasi applying/exact/separating bila velocity tersedia.</p>
   <p>Koefisien kombinasi lan batas klasifikasi iki <strong>hipotesis modern</strong>, dudu petunjuk BUY/SELL pasar emas langsung saka Al-Biruni. Perhitungan electional klasik durung lengkap: rumah astrologi menyeluruh, besiegement, reception, lintang kontak lan pemilihan signifikator perdagangan ora diprogram lengkap. Hasil tanpa dukungan kuat = WAIT. Tidak ada backtest out-of-sample.</p>
   <p>Rentang: 06:00–24:00 WIB Senin–Jumat. Sabtu/Minggu tidak dipindah ke tanggal lain. Resolusi grid 15 menit harian, 30 menit mingguan, 60 menit bulanan. Rentang astronomis dihitung historis ataupun masa depan, nanging dudu konfirmasi harga masa depan.</p>
  </details>
 </div>`;
container.insertBefore(host,container.firstChild);
const $=id=>host.querySelector('#'+id),WIB=420*60000,MIN=60000;
const today=()=>new Date(Date.now()+WIB).toISOString().slice(0,10);
$('abClassicalMainDate').value=today();
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=ms=>Number.isFinite(ms)?C.stamp(ms):'—';
const nice=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
let token=0,busy=false,report=null,options=null,libraryLoading=null;
function status(msg,error=false){$('abClassicalMainStatus').textContent=msg;$('abClassicalMainStatus').classList.toggle('abcp-error',error);}
function read(){
 return {date:$('abClassicalMainDate').value,mode:$('abClassicalMainMode').value,
  latitude:Number($('abClassicalMainLatitude').value),
  longitude:Number($('abClassicalMainLongitude').value),
  orb:Number($('abClassicalMainOrb').value)};
}
function signature(c){return JSON.stringify(c);}
function invalidate(){
 token++;report=null;options=null;$('abClassicalMainResult').hidden=true;
 if(busy){$('abClassicalMainCancel').disabled=true;busy=false;}
 $('abClassicalMainRun').disabled=false;
 status('Setelan berubah. Hitung ulang penilaian AL-BIRUNI KLASIK.');
}
for(const id of ['abClassicalMainDate','abClassicalMainMode','abClassicalMainLatitude',
 'abClassicalMainLongitude','abClassicalMainOrb']){
 const field=$(id);field.addEventListener('change',invalidate);
}
function setBusy(v){
 busy=v;
 for(const id of ['abClassicalMainDate','abClassicalMainMode','abClassicalMainLatitude',
  'abClassicalMainLongitude','abClassicalMainOrb','abClassicalMainRun'])$(id).disabled=v;
 $('abClassicalMainCancel').disabled=!v;
}
function getLibrary(){
 if(root.Astronomy)return Promise.resolve(root.Astronomy);
 if(libraryLoading)return libraryLoading;
 libraryLoading=(async()=>{
  for(const src of ['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
   'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js']){
   if(root.Astronomy)return root.Astronomy;
   try{
    await new Promise((resolve,reject)=>{
     const el=document.createElement('script');let done=false;
     const timer=setTimeout(()=>finish(Error('Waktu muat ephemeris habis.')),10000);
     function finish(err){if(done)return;done=true;clearTimeout(timer);
      el.onload=el.onerror=null;if(err){el.remove();reject(err);}else resolve();}
     el.src=src;el.async=true;el.onload=()=>finish();el.onerror=()=>finish(Error('Ephemeris gagal dimuat.'));
     document.head.append(el);
    });
    if(root.Astronomy)return root.Astronomy;
   }catch(e){/* retry pinned mirror */}
  }
  throw Error('Astronomy Engine v2.1.19 tidak tersedia; hasil tidak dibuat-buat.');
 })();
 return libraryLoading.catch(e=>{libraryLoading=null;throw e;});
}
function render(model,c){
 const fw=model.focusWindow;
 $('abClassicalDirection').textContent=model.direction;
 $('abClassicalDirection').className=model.direction==='BUY'?'abcp-buy':model.direction==='SELL'?'abcp-sell':'abcp-wait';
 $('abClassicalQuality').textContent=model.quality===D.WAIT?'Bukti astrologi belum cukup / pasar tutup':model.quality;
 $('abClassicalStart').textContent=fw?stamp(fw.start):'—';
 $('abClassicalCore').textContent=fw?stamp(fw.core):'—';
 $('abClassicalEnd').textContent=fw?stamp(fw.end):'—';
 $('abClassicalWeights').textContent='Periode '+c.mode.toUpperCase()+
  ' · total bobot window BUY '+nice(model.buyStrength)+
  ' / SELL '+nice(model.sellStrength)+
  ' · waktu BUY '+model.buyMinutes+' menit / SELL '+model.sellMinutes+
  ' menit / WAIT '+model.waitMinutes+' menit.';
 const best=fw?model.timeline.find(r=>r.ms===fw.core):null;
 $('abClassicalEvidence').textContent=best?'Bukti pada INTI: martabat/kontak mendukung '+
  nice(best.favorable)+' poin · faktor menekan '+nice(best.harmful)+' poin · net '+nice(best.net)+
  ' · '+best.reason+'.':'Ora ana window arah sing lolos konfirmasi klasik.';
 $('abClassicalWindows').innerHTML=model.windows.map(w=>'<tr><td>'+safe(w.direction)+'</td><td>'+
  safe(stamp(w.start))+'</td><td>'+safe(stamp(w.core))+'</td><td>'+safe(stamp(w.end))+
  '</td><td>'+w.minutes+' menit</td><td>'+nice(w.strength)+'</td></tr>').join('')||
  '<tr><td colspan="6">Tidak ada window BUY/SELL terkonfirmasi.</td></tr>';
 $('abClassicalRows').innerHTML=model.timeline.map(r=>'<tr><td>'+safe(stamp(r.ms))+
  '</td><td>'+safe(r.status)+'</td><td>'+safe(r.direction)+'</td><td>'+safe(r.confirmed)+
  '</td><td>'+nice(r.favorable)+'</td><td>'+nice(r.harmful)+'</td><td>'+safe(r.reason)+'</td></tr>').join('');
 $('abClassicalFactors').innerHTML=best&&best.factors.length?
  '<ul>'+best.factors.slice().sort((a,b)=>
   (b.favorable+b.harmful)-(a.favorable+a.harmful)).slice(0,16).map(f=>
   '<li>'+safe(f.label)+' · dukungan +'+nice(f.favorable)+
   ' / tekanan '+nice(f.harmful)+'</li>').join('')+'</ul>':
  '<p>Tidak ada rincian INTI untuk ditampilkan.</p>';
 $('abClassicalMainResult').hidden=false;
}
async function run(){
 if(busy)return;
 const c=read(),ticket=++token,key=signature(c);
 report=null;options=null;$('abClassicalMainResult').hidden=true;
 let engine=null;
 try{
  const period=C.period(c.date,c.mode);
  if(!Number.isFinite(c.latitude)||c.latitude< -89.9||c.latitude>89.9||
   !Number.isFinite(c.longitude)||c.longitude< -180||c.longitude>180)throw Error('Koordinat lokasi tidak valid.');
  if(!Number.isFinite(c.orb)||c.orb<0.25||c.orb>5)throw Error('Orb harus 0.25–5°.');
  setBusy(true);
  status('Memuat ephemeris AL-BIRUNI KLASIK…');
  const A=await getLibrary();
  if(ticket!==token)return;
  engine=C.createEngine(A);
  const step=c.mode==='day'?15:c.mode==='week'?30:60;
  const scope=period.days.filter(d=>d.weekday>=1&&d.weekday<=5);
  const count=scope.length*1080/step,rows=[];let done=0;
  if(count===0){
   status('Hari Sabtu/Minggu: pasar XAUUSD umumnya tutup. Kualitas entry: WAIT.');
   $('abClassicalDirection').textContent='WAIT';return;
  }
  for(const d of scope){
   for(let minute=360;minute<1440;minute+=step){
    if(ticket!==token)throw Error('Perhitungan dibatalkan.');
    const ms=d.start+minute*MIN;
    const chart=K.chart(A,engine,ms,{latitude:c.latitude,longitude:c.longitude,orb:c.orb});
    rows.push(D.assess(chart));done++;
    if(done%4===0){
     status('Menghitung martabat & konfigurasi planet · '+Math.round(done/count*100)+'% ('+done+'/'+count+' slot)');
     await new Promise(resolve=>setTimeout(resolve,0));
    }
   }
  }
  if(ticket!==token||key!==signature(read()))return;
  const result=D.summarize(rows,{stepMinutes:step,confirmBars:2});
  report=result;options=c;
  render(result,c);
  status('Perhitungan selesai · '+done+' slot · model klasik parsial tanpa mayoritas aspek. Keputusan entry otomatis tetap WAIT.');
 }catch(e){if(ticket===token){
  report=null;options=null;$('abClassicalMainResult').hidden=true;
  status('Gagal: '+(e?.message||String(e))+'. Tidak ada hasil pengganti.',true);
 }}finally{if(engine)engine.clear();if(ticket===token)setBusy(false);}
}
$('abClassicalMainRun').addEventListener('click',run);
$('abClassicalMainCancel').addEventListener('click',()=>{
 if(!busy)return;
 token++;busy=false;
 for(const id of ['abClassicalMainDate','abClassicalMainMode','abClassicalMainLatitude',
  'abClassicalMainLongitude','abClassicalMainOrb','abClassicalMainRun'])$(id).disabled=false;
 $('abClassicalMainCancel').disabled=true;
 report=null;options=null;$('abClassicalMainResult').hidden=true;
 status('Perhitungan dibatalkan. Status arah: WAIT.');
});
$('abClassicalCSV').addEventListener('click',()=>{
 if(!report||!options||signature(options)!==signature(read()))return;
 const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 const cols=['waktu_WIB','kondisi_klasik','arah_hipotesis_UNVALIDATED','konfirmasi','bobot_dukung','bobot_tekan','net','alasan','izin_trading'];
 const lines=[cols,...report.timeline.map(r=>[stamp(r.ms),r.status,r.direction,r.confirmed,
  r.favorable.toFixed(5),r.harmful.toFixed(5),r.net.toFixed(5),r.reason,'WAIT'])];
 const blob=new Blob(['\uFEFF'+lines.map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n'],
  {type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='ALBIRUNI_KLASIK_RISET_'+options.date+'_'+options.mode+'.csv';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
root.CebonkAlBiruniClassicalDirectionUI=Object.freeze({version:'1.0.0',model:'ALBIRUNI_CLASSICAL_DIRECTION_EXPERIMENT_V1'});
})(window);
