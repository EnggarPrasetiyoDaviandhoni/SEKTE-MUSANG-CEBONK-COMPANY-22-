/* CEBONK BAZI ASTROLOGY UI v1.0.0 — read-only, independent of legacy Astrology. */
(function(root){
'use strict';
const B=root.CebonkBazi,MINUTE=60000;
if(!B)return;
const $=id=>document.getElementById(id);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons=['🐀','🐂','🐅','🐇','🐉','🐍','🐎','🐑','🐒','🐓','🐕','🐖'];
const hues={Kayu:'#70c68b',Api:'#ff8e7b',Tanah:'#e2b77a',Logam:'#d1d8e3',Air:'#82cbee'};
const libraryURLs=[
 'https://cdn.jsdelivr.net/npm/lunar-javascript@1.7.7/lunar.js',
 'https://cdnjs.cloudflare.com/ajax/libs/lunar-javascript/1.7.7/lunar.js'
];
let solarLoading=null,calculated=null;
function loadOne(src){
 return new Promise((resolve,reject)=>{
  const el=document.createElement('script');let done=false;
  const timer=setTimeout(()=>finish(Error('Library BaZi timeout.')),12000);
  function finish(err){if(done)return;done=true;clearTimeout(timer);el.onload=el.onerror=null;if(err){el.remove();reject(err);}else resolve();}
  el.src=src;el.async=true;el.referrerPolicy='no-referrer';
  el.onload=()=>root.Solar&&typeof root.Solar.fromYmdHms==='function'?finish():finish(Error('Library BaZi tidak kompatibel.'));
  el.onerror=()=>finish(Error('Gagal mengunduh BaZi.'));
  document.head.appendChild(el);
 });
}
async function getSolar(){
 if(root.Solar&&typeof root.Solar.fromYmdHms==='function')return root.Solar;
 if(!solarLoading)solarLoading=(async()=>{
  let last;
  for(const url of libraryURLs){try{await loadOne(url);return root.Solar;}catch(e){last=e;}}
  throw last||Error('Pustaka BaZi tidak tersedia.');
 })().catch(e=>{solarLoading=null;throw e;});
 return solarLoading;
}
function yearTiles(){
 const grouped=B.SHIO.map((name,i)=>({name,icon:icons[i],years:B.years(1912,2055).filter(y=>y.animal===name)}));
 return grouped.map(x=>'<article class="bz-zodiac"><h3>'+x.icon+' '+x.name+'</h3><div class="bz-years">'+
  x.years.map(y=>'<span class="bz-year'+(y.year===2026?' bz-current':'')+'" title="'+esc(y.text)+' · '+esc(y.element)+' · mulai Li Chun" style="--zy:'+hues[y.element]+'">'+y.year+'</span>').join('')+
  '</div></article>').join('');
}
function pillarCard(name,p){
 return '<article class="bz-pillar"><small>'+name+'</small><strong>'+esc(p.text)+'</strong><span>'+esc(p.yinYang)+' '+esc(p.element)+'</span><span>'+esc(p.animal)+' · '+esc(p.branchElement)+'</span></article>';
}
function render(){
 if(!calculated)return;
 const x=calculated.data,periods=calculated.periods;
 $('bzPillars').innerHTML=[
  pillarCard('TAHUN',x.pillars.year),
  pillarCard('BULAN',x.pillars.month),
  pillarCard('HARI',x.pillars.day),
  pillarCard('JAM',x.pillars.hour)
 ].join('');
 $('bzTime').textContent=x.date+' · '+x.time+' WIB · UTC '+new Date(x.ms).toISOString().slice(11,16);
 $('bzElements').innerHTML=B.ELEMENTS.map(name=>
  '<div class="bz-element"><span>'+name+'</span><div class="bz-track"><i style="width:'+x.elements[name]*12.5+'%;background:'+hues[name]+'"></i></div><b>'+x.elements[name]+'/8</b></div>'
 ).join('');
 $('bzRelations').innerHTML=x.relationships.length?x.relationships.map(r=>
  '<span class="bz-relation">'+(r.kind==='CLASH'?'Clash / 冲':'Kombinasi / 六合')+' · '+esc(r.pair)+' ('+r.from+'–'+r.to+')</span>'
 ).join(''):'<span class="bz-dim">Tidak ada pasangan Clash / Liu He di empat cabang.</span>';
 const map=periods.map(p=>'<tr><td class="bz-mono">'+p.range+'</td><td>'+esc(p.pillars.year.text)+'</td><td>'+esc(p.pillars.month.text)+'</td><td>'+esc(p.pillars.day.text)+'</td><td><strong>'+esc(p.pillars.hour.text)+'</strong></td><td>'+esc(p.pillars.hour.animal)+'</td></tr>').join('');
 $('bzSchedule').innerHTML=map;
 $('bzStatus').textContent='13 segmen waktu WIB selesai · '+x.date+' · BaZi v'+B.VERSION;
 $('bzDownload').disabled=false;
}
function csvQuote(x){return '"'+String(x).replace(/"/g,'""')+'"';}
function exportCSV(){
 if(!calculated)return;
 const header=['Tanggal_WIB','Rentang_WIB','Pilar_Tahun','Pilar_Bulan','Pilar_Hari','Pilar_Jam','Elemen_Jam','Shio_Jam','Metode','Arah_harga'];
 const rows=calculated.periods.map(p=>[p.date,p.range,p.pillars.year.text,p.pillars.month.text,p.pillars.day.text,p.pillars.hour.text,p.pillars.hour.element,p.pillars.hour.animal,'BaZi_JieQi_WIB','TIDAK_DIHITUNG']);
 const blob=new Blob(['\uFEFF'+[header,...rows].map(row=>row.map(csvQuote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='CEBONK_BAZI_WIB_'+calculated.data.date+'.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(href),1500);
}
async function run(){
 const btn=$('bzRun');if(btn.disabled)return;
 btn.disabled=true;$('bzError').hidden=true;$('bzDownload').disabled=true;
 $('bzStatus').textContent='Memuat kalender BaZi…';
 try{
  const date=$('bzDate').value,time=$('bzHour').value,sect=Number($('bzSect').value);
  B.parse(date,time);
  const Solar=await getSolar();
  const data=B.calculate(Solar,date,time,sect),periods=B.periods(Solar,date,sect);
  calculated={data,periods};render();
 }catch(e){
  calculated=null;$('bzPillars').innerHTML='';$('bzElements').innerHTML='';$('bzRelations').innerHTML='';$('bzSchedule').innerHTML='';
  $('bzError').hidden=false;$('bzError').textContent=e?.message||String(e);
  $('bzStatus').textContent='Perhitungan gagal; tidak ada hasil BaZi diterbitkan.';
 }finally{btn.disabled=false;}
}
function mount(){
 if($('baziView'))return;
 const nav=document.querySelector('.viewtabs'),wrap=document.querySelector('main.wrap');
 if(!nav||!wrap)return;
 const style=document.createElement('style');style.id='baziStyle';style.textContent=[
 '.viewtabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
 '#baziView{--bzline:#30415a;--bzpanel:rgba(15,27,43,.94)}',
 '#baziView .bz-hero{margin-bottom:16px;padding:22px;border:1px solid #674a48;border-radius:14px;background:linear-gradient(120deg,#321a2c,#121f32)}',
 '#baziView .bz-hero small{color:var(--accent);letter-spacing:1px;font-weight:750}',
 '#baziView .bz-hero h2{font-size:clamp(24px,4vw,34px);line-height:1.2;margin:6px 0}',
 '#baziView .bz-hero p,#baziView .bz-dim{color:var(--muted);font-size:12px}',
 '#baziView .bz-panel{background:var(--bzpanel);border:1px solid var(--bzline);border-radius:12px;margin-bottom:15px;overflow:hidden}',
 '#baziView .bz-head{padding:12px 15px;border-bottom:1px solid var(--bzline);font-size:14px;font-weight:700}',
 '#baziView .bz-body{padding:15px}',
 '#baziView .bz-controls{display:grid;grid-template-columns:1.1fr 1fr 1.2fr auto auto;gap:10px;align-items:end}',
 '#baziView label{font-size:11px;color:var(--muted);display:block}',
 '#baziView input,#baziView select{width:100%;margin-top:5px}',
 '#baziView .bz-controls button{min-width:100px}',
 '#baziView .bz-pillars{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}',
 '#baziView .bz-pillar{display:flex;flex-direction:column;gap:2px;text-align:center;border:1px solid #385069;border-radius:11px;background:#142236;padding:11px 6px}',
 '#baziView .bz-pillar small{font-size:10px;color:var(--muted);letter-spacing:1px}',
 '#baziView .bz-pillar strong{font-size:clamp(23px,5vw,38px);font-weight:800;color:var(--accent)}',
 '#baziView .bz-pillar span{font-size:11px}',
 '#baziView .bz-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
 '#baziView .bz-element{display:grid;grid-template-columns:49px 1fr 35px;gap:8px;align-items:center;font-size:12px;margin:8px 0}',
 '#baziView .bz-track{height:9px;border-radius:8px;background:#28374b;overflow:hidden}',
 '#baziView .bz-track i{display:block;height:100%;border-radius:8px}',
 '#baziView .bz-relation{display:block;border-left:2px solid var(--accent);padding:6px 8px;margin:6px 0;background:#1a2a3c;font-size:12px}',
 '#baziView .bz-yeargrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}',
 '#baziView .bz-zodiac{background:#172538;padding:10px;border:1px solid #31445c;border-radius:10px}',
 '#baziView .bz-zodiac h3{font-size:13px;margin:0 0 8px}',
 '#baziView .bz-years{display:flex;gap:4px;flex-wrap:wrap}',
 '#baziView .bz-year{font-size:10px;padding:4px 5px;border-radius:4px;border:1px solid #394d60;color:var(--zy);background:#101b2b;font-variant-numeric:tabular-nums}',
 '#baziView .bz-year.bz-current{border:2px solid var(--accent);font-weight:800}',
 '#baziView .bz-scroller{overflow-x:auto;max-height:490px}',
 '#baziView table{font-size:12px}#baziView td,#baziView th{padding:9px 11px}',
 '#baziView .bz-mono{font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace}',
 '#baziView .bz-note{padding:11px 14px;font-size:12px;color:#e9d4ab;background:#252014;border:1px solid #584a2d;border-radius:10px;margin:0 0 14px}',
 '#baziView .bz-status{font-size:12px;color:var(--muted);margin:7px 0}',
 '#baziView .bz-error{color:#ffb5b5;font-size:12px;padding:10px;border:1px solid #733a48;border-radius:8px;margin-bottom:12px}',
 '#baziView .bz-legend{font-size:11px;color:var(--muted);margin-top:9px}',
 '@media(max-width:760px){.viewtabs{grid-template-columns:repeat(2,minmax(0,1fr))}.viewtab{font-size:12px;padding:9px 4px}#baziView .bz-controls{grid-template-columns:1fr 1fr}#baziView .bz-controls .bz-sect{grid-column:1/-1}#baziView .bz-controls button{width:100%}#baziView .bz-pillars{grid-template-columns:1fr 1fr}#baziView .bz-two{grid-template-columns:1fr}#baziView .bz-yeargrid{grid-template-columns:1fr 1fr}#baziView .bz-hero{padding:15px}}',
 '@media(max-width:420px){#baziView .bz-yeargrid{grid-template-columns:1fr 1fr}#baziView .bz-year{font-size:9px}}'
 ].join('');
 document.head.appendChild(style);
 const tab=document.createElement('button');tab.id='tabBazi';tab.className='viewtab';tab.type='button';tab.textContent='BAZI ASTROLOGY';nav.appendChild(tab);
 const view=document.createElement('section');view.id='baziView';view.hidden=true;
 view.innerHTML=[
 '<div class="bz-hero"><small>SEKTE MUSANG · CEBONK COMPANY 22</small><h2>BAZI ASTROLOGY 八字</h2><p>Kalender Four Pillars · Shio · Five Elements · Jadwal WIB · Riset XAUUSD / XAGUSD</p></div>',
 '<div class="bz-note"><strong>Ini kalender astrologi, bukan sinyal trading.</strong> Kombinasi elemen, Clash, dan jam BaZi belum membuktikan arah atau probabilitas harga XAUUSD maupun XAGUSD. Modul ini tidak mengubah mesin Astrology lama.</div>',
 '<div class="bz-panel"><div class="bz-head">Hitung BaZi · Zona Asia/Jakarta (WIB)</div><div class="bz-body"><div class="bz-controls">',
 '<label>Tanggal WIB<input type="date" id="bzDate" min="1900-01-01" max="2099-12-31"></label>',
 '<label>Jam WIB<input type="time" id="bzHour" step="60"></label>',
 '<label class="bz-sect">Batas hari Zi (23:00)<select id="bzSect"><option value="2">Sekte 2 · hari lama sampai 23:59</option><option value="1">Sekte 1 · hari baru mulai 23:00</option></select></label>',
 '<button type="button" id="bzToday">Hari ini</button><button type="button" class="primary" id="bzRun">Hitung BaZi</button>',
 '</div><p class="bz-status" id="bzStatus">Pilih tanggal dan jam untuk menghitung.</p><div class="bz-error" id="bzError" hidden role="alert"></div></div></div>',
 '<div class="bz-panel"><div class="bz-head">Four Pillars / 八字 · <span id="bzTime" style="font-weight:400;font-size:11px"></span></div><div class="bz-body"><div class="bz-pillars" id="bzPillars"></div><p class="bz-legend">Tahun dan bulan mengikuti solar term Jie Qi / Li Chun (waktu Beijing untuk satu UTC yang sama). Hari dan jam mengikuti WIB. Belum dikoreksi waktu matahari sejati menurut bujur lokasi.</p></div></div>',
 '<div class="bz-two"><div class="bz-panel"><div class="bz-head">5 Elemen · 8 karakter terlihat</div><div class="bz-body"><div id="bzElements"></div><p class="bz-legend">Jumlah elemen batang & cabang (8 karakter) saja, bukan kekuatan elemen atau saran transaksi.</p></div></div>',
 '<div class="bz-panel"><div class="bz-head">Clash / 冲 & Liu He / 六合</div><div class="bz-body"><div id="bzRelations"></div><p class="bz-legend">Relasi tradisional antar cabang empat pilar, tanpa bobot prediksi harga.</p></div></div></div>',
 '<div class="bz-panel"><div class="bz-head">Jadwal 2 jam WIB · 1 hari penuh</div><div class="bz-body"><p class="bz-dim">Tabel memuat 00:00–00:59 dan 23:00–23:59 sebagai dua bagian Zi. Batas 23:00 dapat mengubah pilar hari sesuai pilihan sekte.</p><button type="button" id="bzDownload" disabled>Unduh CSV</button></div>',
 '<div class="bz-scroller"><table><thead><tr><th>WIB</th><th>Tahun</th><th>Bulan</th><th>Hari</th><th>Jam</th><th>Shio Jam</th></tr></thead><tbody id="bzSchedule"></tbody></table></div></div>',
 '<div class="bz-panel"><div class="bz-head">12 Shio · Siklus 60 Tahun (1912–2055)</div><div class="bz-body"><p class="bz-dim">Warna tiap tahun menunjukkan elemen batang langit. Contoh Kuda Api: 1906, 1966, 2026. Tahun pada tabel dihitung mulai Li Chun, bukan otomatis sejak 1 Januari atau Tahun Baru Imlek.</p><div class="bz-yeargrid" id="bzZodiac"></div>',
 '<p class="bz-legend">Legenda: <span style="color:'+hues.Kayu+'">Kayu</span> · <span style="color:'+hues.Api+'">Api</span> · <span style="color:'+hues.Tanah+'">Tanah</span> · <span style="color:'+hues.Logam+'">Logam</span> · <span style="color:'+hues.Air+'">Air</span>. Sumber kalkulasi: lunar-javascript 1.7.7 (MIT).</p></div></div>'
 ].join('');
 wrap.insertBefore(view,wrap.querySelector('footer'));
 $('bzZodiac').innerHTML=yearTiles();
 const n=B.todayWIB();$('bzDate').value=n.date;$('bzHour').value=n.time;
 $('bzRun').addEventListener('click',run);
 $('bzToday').addEventListener('click',()=>{const n=B.todayWIB();$('bzDate').value=n.date;$('bzHour').value=n.time;run();});
 $('bzDownload').addEventListener('click',exportCSV);
 ['bzDate','bzHour','bzSect'].forEach(id=>$(id).addEventListener('change',()=>{$('bzStatus').textContent='Parameter berubah; klik Hitung BaZi.';$('bzDownload').disabled=true;calculated=null;}));
 function activate(which,hash){
  for(const id of ['astroView','astroNewsView','baziView','bbmaScannerView','liquidityScannerView','technicalView','combinedView','combined2View']){
   const el=$(id);if(el)el.hidden=id!==which;
  }
  for(const b of nav.querySelectorAll('.viewtab'))b.classList.toggle('active',b.id===(which==='baziView'?'tabBazi':which==='astroNewsView'?'tabAstroNews':'tabAstro'));
  if(hash)try{history.replaceState(null,'','#'+hash);}catch(e){}
  if(which==='baziView'&&!calculated)run();
 }
 nav.addEventListener('click',e=>{
  const t=e.target.closest('.viewtab');if(!t)return;
  if(t.id==='tabBazi')activate('baziView','bazi-astrology');
  if(t.id==='tabAstro')activate('astroView','astrology');
  if(t.id==='tabAstroNews')activate('astroNewsView','astrology-news');
 });
 if(location.hash==='#bazi-astrology')activate('baziView','bazi-astrology');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
