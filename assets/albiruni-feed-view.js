/* Read-only Al-Biruni EA feed and classical source-audit panel.
 * Browser research controls do NOT mutate the published EA schedule.
 * The official signal display reads the SAME CSV URL as MT5.
 */
(function(root){
 'use strict';
 const panel=root.document&&root.document.getElementById('albiruniPanel');
 if(!panel)return;
 const FEED_URL='https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/albiruni_intraday/data/intraday.csv';
 const HEADER='model,date_wib,signal_id,direction,start_epoch,entry_epoch,core_epoch,end_epoch,valid_until_epoch,published_epoch,aspect,phase';
 const W=7*3600000;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const wibDate=utcMs=>new Date(utcMs+W).toISOString().slice(0,10);
 const wibStamp=seconds=>{const s=new Date(seconds*1000+W).toISOString().slice(0,19);return s.replace('T',' ')+' WIB';};
 function parseFeed(csv){
  const lines=String(csv).replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  if(lines.length!==2||lines[0].trim()!==HEADER)throw Error('Format CSV EA tidak sesuai');
  const fields=lines[1].split(',');
  if(fields.length!==12)throw Error('Jumlah kolom CSV tidak sesuai');
  const [model,date,id,direction,start,entry,core,end,expiry,published,aspect,phase]=fields;
  if(model!=='ALBIRUNI_INTRADAY_V1'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['BUY','SELL','WAIT'].includes(direction))
   throw Error('Model, tanggal atau arah CSV tidak valid');
  const ns=[start,entry,core,end,expiry,published].map(s=>/^\d{1,13}$/.test(s)?Number(s):NaN);
  if(!ns.every(Number.isFinite))throw Error('Epoch CSV tidak valid');
  const [a,b,c,d,e,p]=ns;
  if(p<1600000000)throw Error('Tanggal publikasi CSV tidak valid');
  if(direction==='WAIT'){
   if(id!=='NONE'||[a,b,c,d,e].some(Boolean))throw Error('WAIT harus tanpa jadwal entry');
  }else{
   if(!/^AB-[A-Za-z0-9_-]+$/.test(id)||!(a<b&&b<c&&c<d&&c<=e&&e<=d)||
      wibDate(b*1000)!==date||wibDate((d-1)*1000)!==date||
      phase!=='APPLYING')throw Error('Window sinyal CSV tidak valid');
  }
  return {date,id,direction,start:a,entry:b,core:c,end:d,expiry:e,published:p,aspect,phase};
 }
 const style=root.document.createElement('style');
 style.textContent='.ab-live-panel,.ab-books-panel{margin:14px 0;padding:16px;border:1px solid #385066;border-radius:12px;background:rgba(15,28,42,.76);color:#e8eff8}.ab-live-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.ab-live-panel h3,.ab-books-panel h3{font-size:16px;margin:0 0 8px}.ab-live-panel p,.ab-books-panel p,.ab-books-panel li{font-size:13px;line-height:1.5;color:#c4d1df}.ab-live-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px;margin-top:12px}.ab-live-cell{background:#1b2b3c;border-radius:8px;padding:9px}.ab-live-cell small{display:block;color:#9fb3c8}.ab-live-cell strong{display:block;overflow-wrap:anywhere;font-size:13px}.ab-live-panel button{border:1px solid #6b8aa3;border-radius:8px;background:#243e54;color:white;padding:8px 12px;cursor:pointer}.ab-books-panel summary{cursor:pointer;font-weight:bold}.ab-books-panel a{color:#9de5f4}.ab-books-panel ul{padding-left:21px}';
 root.document.head.appendChild(style);
 const box=root.document.createElement('section');
 box.className='ab-live-panel';
 box.innerHTML='<div class="ab-live-head"><h3>SINYAL RESMI EA AL-BIRUNI · FOLLOW WEB</h3><button type="button" id="abLiveRefresh">Refresh feed</button></div>'+
  '<p id="abLiveStatus" role="status">Memeriksa jadwal CSV yang benar-benar dibaca EA…</p>'+
  '<div class="ab-live-grid"><div class="ab-live-cell"><small>ARAH</small><strong id="abLiveDirection">—</strong></div>'+
  '<div class="ab-live-cell"><small>AWAL</small><strong id="abLiveStart">—</strong></div>'+
  '<div class="ab-live-cell"><small>ENTRY</small><strong id="abLiveEntry">—</strong></div>'+
  '<div class="ab-live-cell"><small>INTI</small><strong id="abLiveCore">—</strong></div>'+
  '<div class="ab-live-cell"><small>AKHIR</small><strong id="abLiveEnd">—</strong></div></div>'+
  '<p id="abLiveBasis">Ini feed penerbit, bukan bukti akurasi BUY/SELL. Panel analisis bebas di bawah dapat berbeda jika setelan orb/fokus berbeda.</p>';
 const header=panel.querySelector('.ab-header');
 if(header)header.insertAdjacentElement('afterend',box);else panel.prepend(box);
 const set=(id,value)=>{const el=box.querySelector('#'+id);if(el)el.textContent=value;};
 let pending=false;
 async function refresh(){
  if(pending)return;
  pending=true;const button=box.querySelector('#abLiveRefresh');button.disabled=true;
  set('abLiveStatus','Mengunduh CSV resmi EA…');
  try{
   if(typeof root.fetch!=='function')throw Error('Browser tidak menyediakan fetch');
   const reply=await root.fetch(FEED_URL+'?v='+Date.now(),{cache:'no-store'});
   if(!reply.ok)throw Error('HTTP '+reply.status);
   const signal=parseFeed(await reply.text()),now=Math.floor(Date.now()/1000);
   if(signal.published>now+300||now-signal.published>36*3600)throw Error('Feed kedaluwarsa atau timestamp publikasi tidak valid');
   const today=wibDate(Date.now()),isToday=signal.date===today;
   set('abLiveDirection',isToday?signal.direction:'WAIT (jadwal '+signal.date+')');
   set('abLiveStart',signal.start?wibStamp(signal.start):'—');
   set('abLiveEntry',signal.entry?wibStamp(signal.entry):'—');
   set('abLiveCore',signal.core?wibStamp(signal.core):'—');
   set('abLiveEnd',signal.end?wibStamp(signal.end):'—');
   set('abLiveStatus','CSV terbaca · '+signal.date+' WIB · '+(isToday?'tanggal aktif':'jadwal tanggal lain')+' · diterbitkan '+wibStamp(signal.published));
   set('abLiveBasis','Aspek: '+(signal.aspect||'NONE')+'. Source: GitHub RAW CSV. Website hanya menampilkan, EA tetap memeriksa jam broker, kondisi pasar dan pengaman.');
  }catch(e){
   ['abLiveDirection','abLiveStart','abLiveEntry','abLiveCore','abLiveEnd'].forEach(id=>set(id,'—'));
   set('abLiveStatus','TIDAK ADA SINYAL TERKONFIRMASI: '+e.message);
   set('abLiveBasis','Gagal membaca feed bukan izin entry. Lihat log terminal MT5 untuk status EA.');
  }finally{pending=false;button.disabled=false;}
 }
 box.querySelector('#abLiveRefresh').addEventListener('click',refresh);
 root.setInterval&&root.setInterval(()=>{if(!root.document.hidden)refresh();},300000);
 const books=root.document.createElement('section');books.className='ab-books-panel';
 books.innerHTML='<details><summary>REFERENSI KITAB · AUDIT PERHITUNGAN</summary>'+
  '<p>Enam edisi rujukan mencakup lima karya; kedua edisi Sefer Yetzirah adalah pembanding karya yang sama. Materi ini BELUM dijadikan bobot BUY/SELL otomatis tanpa validasi historis.</p>'+
  '<ul>'+
  '<li><a target="_blank" rel="noopener noreferrer" href="https://archive.org/details/SeleznyovLiberSessionum/mode/1up">Liber Sessionum / Kitāb al-Majālis</a> — kritik determinisme astrologi; bukan rumus trading.</li>'+
  '<li><a target="_blank" rel="noopener noreferrer" href="https://archive.org/details/biruni-1914-sachau-india/mode/1up">Al-Biruni: India (Sachau)</a> — kalender, posisi rata-rata planet, 27 stasiun Bulan, yoga dan metode astrologi Hindu.</li>'+
  '<li><a target="_blank" rel="noopener noreferrer" href="https://archive.org/details/albirunibookofinstruction/page/11/mode/1up">Kitāb al-Tafhīm</a> — aspek, penguasa jam, rumah, Part of Fortune, pemilihan waktu.</li>'+
  '<li><a target="_blank" rel="noopener noreferrer" href="https://archive.org/details/kaplan-aryeh-sefer-yetzirah-el-libro-de-la-creacion-teoria-y-practica/page/365/mode/1up">Sefer Yetzirah, Kaplan (Spanyol)</a> — sistem huruf, gematria, dan korespondensi simbolis.</li>'+
  '<li><a target="_blank" rel="noopener noreferrer" href="https://archive.org/details/sefer-yetzirah-the-book-of-creation-1997-aryeh-kaplan/page/250/mode/1up">Sefer Yetzirah, Kaplan (Inggris 1997)</a> — pembanding redaksi, bukan sumber terpisah untuk skor arah.</li>'+
  '<li><a target="_blank" rel="noopener noreferrer" href="https://archive.org/details/shesh-fasl_tabaritreatise_on_astrolabe/page/n18/mode/1up">Shesh Fasl, al-Tabari</a> — instrumen astrolab, ascendant, rumah dan waktu astronomis.</li>'+
  '</ul><p><a target="_blank" rel="noopener noreferrer" href="https://archive.org/details/TahqiqMaLiAlHind_201701/page/n61/mode/1up">Teks Arab Taḥqīq mā li-l-Hind</a> menjadi pembanding bagi terjemahan India, bukan karya tambahan.</p>'+
  '<p>Audit matematika sederhana: 22 × 21 ÷ 2 = <strong>231 pasangan huruf</strong> (komentar Sefer Yetzirah); nilai contoh Abraham dan Sarah 248 + 505 = <strong>753</strong>, dengan sisa 9 saat dibagi 12 dan sisa 4 saat dibagi 7. Ini hasil simbolis, bukan prediksi harga emas.</p>'+
  '<p>Perhitungan dinamis 7 planet dan aspek tetap dari albiruni-core.js. Metode kitab lain hanya boleh mempengaruhi sinyal setelah definisi masukan, koordinat, halaman sumber, dan hasil uji harga terdokumentasi.</p></details>';
 panel.appendChild(books);
 root.CebonkAlBiruniFeedView=Object.freeze({parseFeed,FEED_URL,refresh});
 refresh();
})(typeof window!=='undefined'?window:globalThis);
