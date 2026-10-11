/* CEBONK TRIPLE CYCLE UI v1.0.0 — Indonesian, mobile first, isolated. */
(function(root){
'use strict';
const T=root.CebonkTripleCycle,B=root.CebonkBazi,C=root.CebonkCore;
if(!T||!B||!C)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dates=ms=>T.local(ms).date;
const clock=ms=>{const p=T.local(ms);return p.date+' '+p.time+' WIB';};
const label=x=>({BUY:'BULLISH (MODEL)',SELL:'BEARISH (MODEL)',TRANSISI:'TRANSISI',NETRAL:'NETRAL',CAMPURAN:'CAMPURAN'})[x]||x;
const libs={
 astronomy:['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js','https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js'],
 solar:['https://cdn.jsdelivr.net/npm/lunar-javascript@1.7.7/lunar.js','https://cdnjs.cloudflare.com/ajax/libs/lunar-javascript/1.7.7/lunar.js']
};
let pending={},result=null,selected=0,job=0;
function script(url,validate){
 return new Promise((resolve,reject)=>{
  const el=document.createElement('script');let finished=false;
  const timer=setTimeout(()=>done(Error('Waktu muat pustaka habis.')),15000);
  function done(err){if(finished)return;finished=true;clearTimeout(timer);el.onload=el.onerror=null;if(err){el.remove();reject(err);}else resolve();}
  el.src=url;el.async=true;el.referrerPolicy='no-referrer';
  el.onload=()=>validate()?done():done(Error('Pustaka tidak kompatibel.'));
  el.onerror=()=>done(Error('Tidak dapat memuat pustaka.'));
  document.head.appendChild(el);
 });
}
async function requireLib(kind){
 const valid=kind==='astronomy'?()=>root.Astronomy?.SearchMoonPhase&&root.Astronomy?.GeoVector:
      ()=>root.Solar&&typeof root.Solar.fromYmdHms==='function';
 if(valid())return kind==='astronomy'?root.Astronomy:root.Solar;
 if(!pending[kind])pending[kind]=(async()=>{
  let last;
  for(const url of libs[kind]){
   if(valid())return kind==='astronomy'?root.Astronomy:root.Solar;
   try{await script(url,valid);return kind==='astronomy'?root.Astronomy:root.Solar;}catch(e){last=e;}
  }
  throw last||Error('Pustaka tidak tersedia.');
 })().finally(()=>{delete pending[kind];});
 return pending[kind];
}
const monthShift=(s,n)=>{
 const b=T.bounds(s),d=new Date(b.start+420*60000);
 d.setUTCMonth(d.getUTCMonth()+n);
 return d.toISOString().slice(0,7);
};
const row=(title,value)=>'<div class="tc-row"><span>'+esc(title)+'</span><b>'+esc(value)+'</b></div>';
function say(msg){const s=$('tcStatus');if(s)s.textContent=msg;}
function summary(s){
 const data=s.summary;
 $('tcSummary').innerHTML='<article class="tc-stat"><small>Dominasi model</small><strong class="tc-'+esc(data.direction)+'">'+esc(label(data.direction))+'</strong><span>3 cuplikan waktu/hari</span></article>'+
 '<article class="tc-stat"><small>Hari BUY</small><strong class="tc-BUY">'+data.counts.BUY+'</strong><span>dari '+data.total+' hari</span></article>'+
 '<article class="tc-stat"><small>Hari SELL</small><strong class="tc-SELL">'+data.counts.SELL+'</strong><span>dari '+data.total+' hari</span></article>'+
 '<article class="tc-stat"><small>Fase Bulan</small><strong>'+s.lunar.events.length+'</strong><span>peristiwa dalam bulan</span></article>';
}
function showDay(index){
 if(!result||!result.days[index])return;
 selected=index;
 const day=result.days[index];
 $('tcDetail').innerHTML='<h4>Rincian '+esc(day.date)+' WIB</h4>'+
 row('Klasifikasi model',label(day.state))+
 row('Hijriah (kalender Umm al-Qura)',day.hijri||'Tidak didukung browser')+
 row('Pilar Bulan BaZi',day.bazi.month.animal+' · '+day.bazi.month.element+' ('+day.bazi.month.yinYang+')')+
 row('Pilar Tahun BaZi',day.bazi.year.animal+' · '+day.bazi.year.element)+
 row('Umur Bulan sejak ijtimak',day.moonAgeHours.toFixed(1)+' jam')+
 row('Sudut fase Bulan',day.elongation.toFixed(1)+'°')+
 row('Cuplikan inti model',clock(day.peak))+
 '<p class="tc-muted">Aspek planet pada cuplikan dengan skor model paling kuat: '+(T.highlights(day).map(esc).join('; ')||'Tidak ada aspek dekat yang lolos ambang tampilan.')+'</p>';
 for(const btn of $('tcCalendar').querySelectorAll('button[data-day]')){
  btn.setAttribute('aria-pressed',String(Number(btn.dataset.day)===index));
 }
}
function calendar(s){
 const first=new Date(s.days[0].date+'T00:00:00Z').getUTCDay();
 const offset=(first+6)%7;
 let html='<div class="tc-weekdays">'+['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="tc-days">';
 for(let i=0;i<offset;i++)html+='<span class="tc-empty"></span>';
 for(let i=0;i<s.days.length;i++){
  const d=s.days[i];
  html+='<button type="button" class="tc-day tc-'+d.state+'" data-day="'+i+'" aria-pressed="false" title="'+esc(d.date+' · '+label(d.state)+' · '+(d.hijri||'Hijriah tidak tersedia'))+'"><b>'+Number(d.date.slice(-2))+'</b><small>'+({BUY:'BUY',SELL:'SELL',TRANSISI:'UBAH',NETRAL:'NETRAL'})[d.state]+'</small></button>';
 }
 html+='</div>';
 $('tcCalendar').innerHTML=html;
 $('tcCalendar').querySelectorAll('button[data-day]').forEach(b=>b.addEventListener('click',()=>showDay(Number(b.dataset.day))));
 showDay(Math.min(selected,s.days.length-1));
}
function lunar(s){
 $('tcLunar').innerHTML=s.lunar.events.map(x=>
  '<div class="tc-event"><div><b>'+esc(x.name)+'</b><small>'+esc(clock(x.ms))+'</small></div><span>'+x.angle+'°</span></div>').join('')||
  '<p>Tidak ada peristiwa fase yang tercatat dalam rentang ini.</p>';
}
function bazi(s){
 $('tcBazi').innerHTML=s.periods.map(x=>
  '<div class="tc-event"><div><b>'+esc(x.month.animal+' · '+x.month.element+' ('+x.month.yinYang+')')+'</b>'+
  '<small>'+esc(clock(x.start))+' – '+esc(clock(x.end))+'</small>'+
  '<small>Pilar tahun: '+esc(x.year.animal+' · '+x.year.element)+'</small></div></div>').join('');
}
function segments(s){
 $('tcGroups').innerHTML=s.summary.groups.map(g=>
  '<div class="tc-phase tc-'+g.state+'"><b>'+esc(label(g.state))+'</b><small>'+
  esc(dates(g.start))+' s.d. '+esc(dates(g.end-1))+' · '+g.days+' hari</small>'+
  '<small>Cuplikan inti: '+esc(clock(g.peak))+'</small></div>').join('');
}
function exportCSV(){
 if(!result)return;
 const rows=['tanggal_wib,arah_model,hijriah_umm_al_qura,pilar_bulan_shio,pilar_bulan_elemen,pilar_tahun_shio,pilar_tahun_elemen,umur_bulan_jam,sudut_fase_derajat'];
 const cell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 for(const d of result.days)rows.push([
  d.date,d.state,d.hijri||'',d.bazi.month.animal,d.bazi.month.element,d.bazi.year.animal,d.bazi.year.element,d.moonAgeHours.toFixed(2),d.elongation.toFixed(2)
 ].map(cell).join(','));
 const blob=new Blob(['\uFEFF'+rows.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='CEBONK_TRIPLE_CYCLE_'+result.month+'.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function compute(){
 const token=++job,month=$('tcMonth').value,button=$('tcRun');
 result=null;$('tcOutput').hidden=true;$('tcExport').disabled=true;
 button.disabled=true;
 try{
  T.bounds(month);say('Memuat ephemeris dan kalender BaZi…');
  const [A,Solar]=await Promise.all([requireLib('astronomy'),requireLib('solar')]);
  if(token!==job)return;
  say('Menghitung pilar BaZi dan 8 fase Bulan…');
  const periods=T.baziPeriods(B,Solar,month),lunar=T.lunarEvents(A,month);
  say('Menghitung cuplikan Astrology bulanan…');
  await new Promise(resolve=>setTimeout(resolve,20));
  const days=T.enrich(T.astrologyDays(C,A,month,percent=>say('Menghitung Astrology: '+percent+'%'),()=>token!==job),periods,lunar,A);
  if(token!==job)return;
  const summaryData=T.summarize(days);
  result={month,days,lunar,periods,summary:summaryData};
  selected=0;summary(result);lunarView(result);bazi(result);segments(result);calendar(result);
  $('tcOutput').hidden=false;$('tcExport').disabled=false;
  say('Selesai · '+days.length+' hari dihitung · semua jam WIB. Hasil bersifat riset, bukan sinyal transaksi.');
 }catch(e){say('Perhitungan gagal: '+(e?.message||String(e))+'. Tidak ada angka pengganti.');}
 finally{if(token===job)button.disabled=false;}
}
function lunarView(s){lunar(s);}
function mount(){
 const anchor=$('m12Panel')||$('ayPanel')||$('mhPanel'),view=$('baziView');
 if(!view||!anchor||$('tcPanel'))return;
 const style=document.createElement('style');style.id='tcStyles';style.textContent=
 '#tcPanel{border:1px solid #537d8b;border-radius:13px;background:#101e30;padding:16px;margin:17px 0;color:inherit;scroll-margin-top:15px}'+
 '#tcPanel h3{margin:3px 0;font-size:20px}#tcPanel h4{font-size:14px;margin:15px 0 8px}#tcPanel p{font-size:12px;line-height:1.6}'+
 '#tcPanel .tc-muted{color:#bed0df;font-size:12px}#tcPanel .tc-controls{display:flex;gap:9px;align-items:end;flex-wrap:wrap;margin:15px 0}'+
 '#tcPanel label{font-size:12px;color:#d0dce9;flex:1;min-width:140px}#tcPanel input{width:100%;display:block;margin-top:5px}'+
 '#tcPanel .tc-controls button{min-width:90px}#tcPanel .tc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}'+
 '#tcPanel .tc-stat{padding:13px;background:#1a2d42;border:1px solid #3b5065;border-radius:10px}'+
 '#tcPanel .tc-stat small,#tcPanel .tc-stat span{display:block;font-size:11px;color:#b8c9d9}#tcPanel .tc-stat strong{font-size:18px;display:block;margin:4px 0}'+
 '#tcPanel .tc-BUY{color:#84e0b5}#tcPanel .tc-SELL{color:#ff9ba5}#tcPanel .tc-TRANSISI{color:#ffcc89}'+
 '#tcPanel .tc-weekdays,#tcPanel .tc-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}'+
 '#tcPanel .tc-weekdays{margin:6px 0;text-align:center;color:#c5d5df;font-size:11px}#tcPanel .tc-days button{min-width:0;padding:8px 2px;min-height:55px;border-radius:7px;background:#192b40}'+
 '#tcPanel .tc-days button b{display:block;font-size:13px}#tcPanel .tc-days button small{display:block;font-size:9px;color:#dce5ee}'+
 '#tcPanel .tc-days button.tc-BUY{border-color:#3d8a6f;background:#143c34}#tcPanel .tc-days button.tc-SELL{border-color:#ac5663;background:#482b39}'+
 '#tcPanel .tc-days button.tc-TRANSISI{border-color:#b08e49;background:#493c2a}#tcPanel .tc-days button[aria-pressed=true]{outline:2px solid #f3dca4;outline-offset:1px}'+
 '#tcPanel .tc-columns{display:grid;grid-template-columns:1fr 1fr;gap:15px}#tcPanel .tc-box{background:#14253a;border:1px solid #34495d;border-radius:10px;padding:12px;margin:12px 0}'+
 '#tcPanel .tc-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:7px 0;border-bottom:1px solid #324357;font-size:12px}'+
 '#tcPanel .tc-row span{color:#b1c4d8}#tcPanel .tc-row b{text-align:right}#tcPanel .tc-event{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #314357;padding:10px 0;font-size:12px}'+
 '#tcPanel .tc-event small{display:block;color:#bdc9d7;font-size:11px}#tcPanel .tc-phase{padding:9px 11px;margin:7px 0;border-left:3px solid #879cb1;background:#1c3043;border-radius:6px}'+
 '#tcPanel .tc-phase.tc-BUY{border-color:#84e0b5}#tcPanel .tc-phase.tc-SELL{border-color:#ff9ba5}#tcPanel .tc-phase.tc-TRANSISI{border-color:#ffcc89}'+
 '#tcPanel .tc-phase small{display:block;color:#c2d4df;font-size:11px}#tcPanel .tc-warning{border-left:3px solid #c99b56;background:#302719;color:#f1dfba;padding:12px;border-radius:7px}'+
 '@media(max-width:680px){#tcPanel{padding:12px}#tcPanel .tc-stats{grid-template-columns:1fr 1fr}#tcPanel .tc-columns{grid-template-columns:1fr}#tcPanel .tc-controls button{flex:1}}';
 document.head.appendChild(style);
 const panel=document.createElement('section');panel.id='tcPanel';
 panel.innerHTML='<h3>TRIPLE CYCLE · ASTROLOGY + BAZI + HISAB</h3>'+
 '<p class="tc-muted">Kalender bulanan WIB: 8 fase Bulan, ijtimak, umur Bulan, sudut fase, Pilar Bulan BaZi dan referensi tanggal Hijriah. Ditambah arah model Astrology eksperimental.</p>'+
 '<div class="tc-controls"><label for="tcMonth">Pilih bulan (2020–2040)<input id="tcMonth" type="month" min="2020-01" max="2040-12"></label>'+
 '<button type="button" id="tcPrev">Bulan lalu</button><button type="button" id="tcNext">Bulan depan</button>'+
 '<button type="button" id="tcRun">Hitung Bulanan</button><button type="button" id="tcExport" disabled>Unduh CSV</button></div>'+
 '<p class="tc-muted" id="tcStatus" role="status">Pilih bulan lalu klik Hitung Bulanan.</p>'+
 '<div id="tcOutput" hidden><div class="tc-stats" id="tcSummary"></div>'+
 '<div class="tc-columns"><div class="tc-box"><h4>Kalender fase model — harian</h4><div id="tcCalendar"></div><div id="tcDetail"></div></div>'+
 '<div class="tc-box"><h4>Fase Astrology — awal / inti / akhir</h4><div id="tcGroups"></div></div></div>'+
 '<div class="tc-columns"><div class="tc-box"><h4>Hisab fase Bulan (8 sudut)</h4><div id="tcLunar"></div></div>'+
 '<div class="tc-box"><h4>Periode Pilar Bulan BaZi</h4><div id="tcBazi"></div></div></div></div>'+
 '<p class="tc-warning"><b>Batasan ilmiah:</b> Fase astronomis dihitung dari posisi geosentris Matahari–Bulan menggunakan Astronomy Engine. Umur Bulan dihitung sejak ijtimak, bukan tinggi/visibilitas hilal. Tanggal Hijriah menggunakan kalender Umm al-Qura sebagai referensi, <b>bukan</b> keputusan pemerintah Indonesia atau hasil rukyat lokal. BaZi memakai batas musim surya dari pustaka kalender; waktu transisi ditaksir ke menit. BUY/SELL berasal dari 3 cuplikan model Astrology per hari (06.00, 12.00, 18.00 WIB), bukan hasil pengujian harga, bukan sinyal EA, dan bukan klaim bahwa hisab atau BaZi menyebabkan pasar naik/turun.</p>';
 anchor.parentElement.insertBefore(panel,anchor);
 const now=new Date(Date.now()+420*60000).toISOString().slice(0,7);
 $('tcMonth').value=now>='2020-01'&&now<='2040-12'?now:'2026-10';
 $('tcRun').addEventListener('click',compute);
 $('tcMonth').addEventListener('change',()=>{job++;result=null;$('tcOutput').hidden=true;$('tcExport').disabled=true;$('tcRun').disabled=false;say('Bulan berubah; klik Hitung Bulanan.');});
 for(const [id,delta] of [['tcPrev',-1],['tcNext',1]])$(id).addEventListener('click',()=>{
  const next=monthShift($('tcMonth').value,delta);
  if(next<'2020-01'||next>'2040-12'){say('Batas bulan 2020–2040.');return;}
  $('tcMonth').value=next;$('tcMonth').dispatchEvent(new Event('change'));
 });
 $('tcExport').addEventListener('click',exportCSV);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
