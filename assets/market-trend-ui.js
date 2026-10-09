/* CEBONK history panel v1.0.0. Never present benchmark data as broker/live signals. */
(function(root){
'use strict';
const M=root.CebonkMetalHistory;if(!M)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});
const signed=n=>n==null?'—':(n>0?'+':'')+n.toFixed(2)+'%';
const state={symbol:'XAUUSD',data:{XAUUSD:[],XAGUSD:[]},sources:{},initial:false};
function line(data){
 const xs=data.slice(-72);if(xs.length<2)return '';
 const vals=xs.map(x=>x[1]),min=Math.min(...vals),max=Math.max(...vals),r=Math.max(max-min,1e-9);
 const dots=xs.map((x,i)=>(20+660*i/(xs.length-1)).toFixed(1)+','+(178-153*(x[1]-min)/r).toFixed(1)).join(' ');
 return '<svg role="img" aria-label="Grafik rata-rata harga historis, bukan proyeksi" viewBox="0 0 700 204" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg"><path d="M20 178H680M20 25H680" stroke="#34475b" stroke-width="1"/><polyline points="'+dots+'" fill="none" stroke="#70d7dc" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><text x="20" y="196" fill="#b5c2d2" font-size="13">'+esc(xs[0][0])+'</text><text x="680" y="196" text-anchor="end" fill="#b5c2d2" font-size="13">'+esc(xs.at(-1)[0])+'</text></svg>';
}
function show(){
 const s=state.symbol,d=state.data[s]||[],src=state.sources[s]||'Belum tersedia';
 const t=M.trend(d),info=$('mhInfo'),cards=$('mhMetrics'),history=$('mhHorse'),chart=$('mhGraph');
 $('mhSymbol').value=s;
 info.textContent=(s==='XAUUSD'?'Emas':'Perak')+' · '+src+(d.length?' · '+d.length+' bulan tersimpan · terakhir '+d.at(-1)[0]:' · tidak tersedia');
 root.dispatchEvent(new CustomEvent('cebonk:market-history',{detail:{data:state.data,sources:state.sources,symbol:s}}));
 if(!t.ok){
  cards.innerHTML='<p class="mh-muted">'+esc(t.message||'Belum ada data. Masukkan CSV untuk memulai.')+'</p>';
  chart.innerHTML='';history.innerHTML='';return;
 }
 const trendClass=t.direction==='NAIK'?'buy':t.direction==='TURUN'?'sell':'transition';
 cards.innerHTML=[
  ['Tren historis','<span class="'+trendClass+'">'+t.direction+'</span>'],
  ['Rata-rata '+t.month,'$'+money(t.price)],
  ['Perubahan 3 bulan',signed(t.change[3])],
  ['Perubahan 6 bulan',signed(t.change[6])],
  ['Perubahan 12 bulan',signed(t.change[12])],
  ['Rata-rata 3 bulan','$'+money(t.ma3)],
  ['Rata-rata 12 bulan','$'+money(t.ma12)],
  ['Penurunan terbesar (≤60 bulan)',signed(t.drawdown)],
  ['Data terawal',t.first]
 ].map(x=>'<div class="mh-metric"><small>'+esc(x[0])+'</small><strong>'+x[1]+'</strong></div>').join('');
 chart.innerHTML=line(t.history);
 const results=[1966,2026].map(y=>M.horseYear(d,y));
 history.innerHTML='<div class="mh-horsegrid">'+results.map(r=>r.ok?
  '<article><strong>'+r.year+'</strong><small>'+esc(r.first)+' sampai '+esc(r.last)+'</small><b>'+signed(r.change)+'</b><small>'+ (r.complete?'12 bulan teramati':'Periode belum lengkap')+'</small></article>':
  '<article><strong>'+r.year+'</strong><small>'+esc(r.reason)+'</small></article>').join('')+'</div><p class="mh-muted">Perubahan dihitung dari rata-rata bulan pertama ke bulan terakhir yang tersedia dalam tahun tersebut. Bukan return trading Januari–Desember dan bukan bukti pengaruh shio. Pergantian tahun BaZi sekitar Li Chun tidak tepat sama dengan batas tahun kalender ini.</p>';
}
async function load(){
 $('mhStatus').textContent='Memeriksa arsip harga bulanan…';
 try{
  const urls=[
   'https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/data/market-history.json',
   'data/market-history.json?v=1.0.0'
  ];
  let doc=null,issue='Sumber harga tidak merespons.';
  for(const url of urls){
   try{
    const res=await fetch(url,{cache:'no-store'});
    if(!res.ok)throw Error('HTTP '+res.status);
    const loaded=await res.json();
    if(loaded?.frequency!=='monthly_average'||!loaded?.data)throw Error('Format sumber tidak sesuai.');
    doc=loaded;break;
   }catch(e){issue=e.message||String(e);}
  }
  if(!doc)throw Error(issue);
  for(const sym of ['XAUUSD','XAGUSD']){
   state.data[sym]=M.rows(doc.data[sym]||[]);
   state.sources[sym]=(doc.source||'Data historis bulanan')+' · diperbarui '+(doc.retrieved||'tanggal tidak diketahui');
  }
  $('mhStatus').textContent='Arsip dimuat. Pilih instrumen atau unggah data CSV sendiri.';
 }catch(e){
  $('mhStatus').textContent='Arsip harga belum bisa dimuat: '+e.message+' Unggah CSV MT5 untuk analisis.';
 }
 state.initial=true;show();
}
async function importCSV(){
 const file=$('mhFile').files?.[0];if(!file)return;
 if(file.size>3500000){$('mhStatus').textContent='CSV terlalu besar. Maksimal 3,5 MB.';return;}
 try{
  const parsed=M.csv(await file.text()),sym=$('mhSymbol').value;
  state.data[sym]=parsed.data;state.sources[sym]=parsed.method+' · '+parsed.count+' baris impor lokal (tidak dikirim ke server)';
  $('mhStatus').textContent='CSV '+sym+' diterima. Data impor menggantikan arsip untuk instrumen ini selama halaman terbuka.';
  show();
 }catch(e){$('mhStatus').textContent='Impor gagal: '+e.message;}
}
function mount(){
 const parent=$('baziView');if(!parent||$('mhPanel'))return;
 const style=document.createElement('style');style.id='mhStyle';
 style.textContent='.mh-box{border:1px solid #34445e;border-radius:12px;overflow:hidden;background:#101a28;margin:18px 0}.mh-head{padding:14px 16px;border-bottom:1px solid #34445e}.mh-head h3{margin:0 0 4px;font-size:18px}.mh-muted{color:#a8b8c9;font-size:12px}.mh-body{padding:15px}.mh-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:end}.mh-actions label{font-size:12px;flex:1;min-width:150px}.mh-actions input,.mh-actions select{display:block;margin:5px 0;width:100%}.mh-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:12px 0}.mh-metric,.mh-horsegrid article{background:#152438;border:1px solid #31445c;border-radius:10px;padding:12px}.mh-metric small,.mh-horsegrid small{display:block;color:#a8b8c9;font-size:11px}.mh-metric strong{display:block;font-size:17px;margin-top:5px;overflow-wrap:anywhere}.mh-horsegrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mh-horsegrid b{display:block;font-size:19px}.mh-status{font-size:12px;color:#d1dcea;margin:10px 0}.mh-note{border-left:3px solid #d7a954;background:#292419;padding:12px;font-size:12px;margin:12px 0}.mh-chart{margin-top:12px;background:#0c1624;border-radius:9px;padding:12px}@media(max-width:760px){.mh-grid{grid-template-columns:1fr 1fr}.mh-actions{display:grid;grid-template-columns:1fr}#mhPanel .mh-body{padding:12px}}';
 document.head.appendChild(style);
 const section=document.createElement('section');section.className='mh-box';section.id='mhPanel';
 section.innerHTML='<div class="mh-head"><h3>ANALISIS TREN HISTORIS EMAS & PERAK</h3><div class="mh-muted">XAUUSD / XAGUSD · riwayat harga USD per troy ounce</div></div><div class="mh-body">'+
 '<div class="mh-actions"><label>Instrumen<select id="mhSymbol"><option value="XAUUSD">XAUUSD — Emas</option><option value="XAGUSD">XAGUSD — Perak</option></select></label><label>Impor riwayat CSV (opsional)<input id="mhFile" type="file" accept=".csv,text/csv,text/plain"></label><button id="mhImport" type="button">Analisis CSV</button><button id="mhReload" type="button">Muat ulang arsip</button></div>'+
 '<p class="mh-status" id="mhStatus" role="status">Menyiapkan data…</p><p class="mh-muted" id="mhInfo"></p><div class="mh-grid" id="mhMetrics"></div><div class="mh-chart" id="mhGraph"></div>'+
 '<h4>Perbandingan sejarah Kuda Api (tahun kalender)</h4><div id="mhHorse"></div>'+
 '<div class="mh-note"><strong>Tren adalah deskripsi sejarah, bukan prediksi.</strong> Tren NAIK hanya bila rata-rata 3 bulan lebih tinggi dari rata-rata 12 bulan dan perubahan 3 bulan positif; TURUN berlaku sebaliknya; sisanya CAMPURAN. Data bulanan bukan harga tick atau harga eksekusi broker. Tidak ada estimasi win rate, probabilitas entry, atau sinyal BUY/SELL otomatis.</div>'+
 '<p class="mh-muted">CSV menerima kolom date dan close/value/price (titik desimal); untuk data harian dihitung rata-rata harga penutupan per bulan. Arsip publik bersumber dari World Bank Pink Sheet. Saat data sumber gagal, aplikasi tidak mengarang harga.</p></div>';
 parent.appendChild(section);
 $('mhSymbol').addEventListener('change',e=>{state.symbol=e.target.value;show();});
 $('mhImport').addEventListener('click',importCSV);$('mhReload').addEventListener('click',load);
 load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
