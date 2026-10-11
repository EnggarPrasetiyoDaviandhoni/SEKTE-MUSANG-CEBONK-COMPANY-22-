/* CEBONK FASE KALENDER TIONGHOA v1.0.0
 * User's original CebonkCore Astrology V1 scoring is consumed unmodified.
 * 24 solar terms = astronomical facts. Direction = explicitly experimental model.
 */
(function(root){
'use strict';
const K=root.CebonkChineseCalendar,C=root.CebonkCore,B=root.CebonkMomentBias;
if(!K||!C)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const SOURCES=['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
 'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js'];
const COLOR={Semi:'#86d9a7',Panas:'#ffad83',Gugur:'#d6dce5',Dingin:'#8fcaf9'};
let loadPromise=null,result=null,biases={},busy=false;
const pad=n=>String(n).padStart(2,'0');
function time(ms){
 const p=K.wib(ms),[y,m,d]=p.date.split('-').map(Number);
 return d+' '+MONTHS[m-1]+' '+y+' · '+p.time+' WIB';
}
function assert(cond,msg){if(!cond)throw Error(msg);}
function script(url){
 return new Promise((resolve,reject)=>{
  const s=document.createElement('script');let settled=false;
  const clock=setTimeout(()=>finish(Error('Pustaka astronomi timeout.')),12000);
  function finish(err){if(settled)return;settled=true;clearTimeout(clock);s.onload=s.onerror=null;if(err){s.remove();reject(err);}else resolve();}
  s.src=url;s.async=true;s.referrerPolicy='no-referrer';
  s.onload=()=>root.Astronomy?.SearchSunLongitude?finish():finish(Error('Pustaka astronomi tidak kompatibel.'));
  s.onerror=()=>finish(Error('Jaringan gagal memuat pustaka astronomi.'));
  document.head.appendChild(s);
 });
}
async function getAstronomy(){
 if(root.Astronomy?.SearchSunLongitude)return root.Astronomy;
 if(!loadPromise)loadPromise=(async()=>{
  let reason;
  for(const url of SOURCES){
   try{await script(url);return root.Astronomy;}catch(e){reason=e;}
  }
  throw reason||Error('Astronomy Engine tidak tersedia.');
 })().finally(()=>{loadPromise=null;});
 return loadPromise;
}
function note(message){$('chStatus').textContent=message;}
function biasLabel(v){
 if(!v||!B)return '<span class="ch-bias ch-unknown">Bias Astrology tidak tersedia</span>';
 const state=v.state;
 const cls=state==='BUY'?'ch-buy':state==='SELL'?'ch-sell':'ch-neutral';
 const score=Number.isFinite(v.score)?' · skor model '+v.score.toFixed(2):'';
 return '<span class="ch-bias '+cls+'">'+esc(B.label(state)+score)+'</span>';
}
function weekendHtml(event,bias){
 if(!event.bridge)return '';
 const b=event.bridge;
 return '<div class="ch-weekend"><b>JEMBATAN JUMAT–SENIN</b>'+
 '<div class="ch-bridge-grid"><span>Jumat sebelumnya <strong>'+esc(b.friday)+'</strong>'+biasLabel(bias?.friday)+
 '</span><span>Senin sesudahnya <strong>'+esc(b.monday)+'</strong>'+biasLabel(bias?.monday)+'</span></div>'+
 '<small>Jumat: 18, 20, 22 WIB; Senin: 06, 08, 10 WIB. Label dari model riset Astrology, bukan harga atau jam buka broker.</small></div>';
}
function eventCard(event,short=false){
 const t=biases[event.ms]||null,bias=t?.event||null;
 return '<article class="ch-event'+(event.season?' ch-highlight':'')+'">'+
 '<div class="ch-head"><div><small>'+(event.season?'GERBANG MUSIM · '+esc(event.season):event.kind==='JIE'?'AWAL PERIODE BULAN':'PERTENGAHAN PERIODE')+
 '</small><h4>'+esc(event.name)+'</h4></div><b>'+event.angle+'°</b></div>'+
 '<p class="ch-time">'+esc(time(event.ms))+'</p>'+
 (event.animal?'<p class="ch-sub">Periode shio dimulai: <b>'+esc(event.animal)+'</b></p>':'')+
 '<p class="ch-direction">Arah riset Astrology pada momen: '+biasLabel(bias)+'</p>'+
 (short?'':weekendHtml(event,t))+'</article>';
}
function render(){
 if(!result)return;
 const month=Number($('chMonth').value.slice(5,7));
 const visible=K.filterMonth(result,month);
 $('chSummary').textContent='Tahun '+result.year+' · 24 titik musim · 12 awal periode BaZi · 4 gerbang musim utama';
 $('chEvents').innerHTML=visible.map(e=>eventCard(e)).join('');
 $('chMonthlyTitle').textContent='Fase '+MONTHS[month-1]+' '+result.year+' ('+visible.length+' peristiwa)';
 $('chSeasons').innerHTML=result.seasons.map(e=>
 '<article class="ch-season" style="--ch-season:'+COLOR[e.season]+'">'+
 '<small>'+esc(e.season.toUpperCase())+'</small><strong>'+esc(e.name)+'</strong>'+
 '<span>'+esc(time(e.ms))+'</span>'+biasLabel(biases[e.ms]?.event)+
 '<button type="button" data-ch-month="'+e.wib.month+'">Lihat bulan ini</button></article>').join('');
 $('chSeasons').querySelectorAll('button[data-ch-month]').forEach(button=>button.addEventListener('click',()=>{
  $('chMonth').value=result.year+'-'+pad(Number(button.dataset.chMonth));update();
 }));
 const summary=B?.summary(visible,biases)||null;
 $('chBias').textContent=summary?
  'Dominasi '+MONTHS[month-1]+' menurut model riset Astrology: '+B.label(summary.state)+
  ' · '+summary.count.BUY+' bullish · '+summary.count.SELL+' bearish · '+summary.count.NEUTRAL+' netral':
  'Bias model Astrology tidak tersedia.';
 $('chOutput').hidden=false;$('chCsv').disabled=false;
 note('Selesai. Tanggal musim dihitung astronomis; bias arah memakai mesin Astrology riset yang sudah ada.');
}
async function update(){
 if(busy)return;
 let month=$('chMonth').value;
 if(!/^(202\d|203\d|2040)-(0[1-9]|1[0-2])$/.test(month)){note('Pilih bulan 2020–2040.');return;}
 busy=true;$('chCompute').disabled=true;$('chCsv').disabled=true;
 try{
  const year=Number(month.slice(0,4));
  if(!result||result.year!==year){
   note('Menghitung 24 titik musim surya tahun '+year+' …');
   const A=await getAstronomy();const next=K.yearTerms(A,year);
   result=next;
  }
  const current=K.filterMonth(result,Number(month.slice(5,7)));
  const all=[...new Map([...result.seasons,...current].map(x=>[x.ms,x])).values()];
  note('Menghitung bias dengan rumus Astrology milikmu …');
  if(B&&C){
   try{biases=B.calculate(await getAstronomy(),all,C);}
   catch(e){biases={};note('Bias tidak dapat dihitung: '+e.message+'. Tidak menampilkan arah rekaan.');}
  }else biases={};
  render();
 }catch(e){result=null;biases={};$('chOutput').hidden=true;note('Perhitungan gagal: '+(e?.message||String(e))+'.');}
 finally{busy=false;$('chCompute').disabled=false;}
}
function csv(){
 if(!result)return;
 const m=Number($('chMonth').value.slice(5,7));
 const rows=[['waktu_wib','nama_fase','sudut_matahari','jenis','awal_shio','gerbang_musim','bias_astrology_riset','skor_model','jumat_pra','bias_jumat','senin_pasca','bias_senin']];
 for(const e of K.filterMonth(result,m)){
  const b=biases[e.ms];
  rows.push([time(e.ms),e.name,e.angle,e.kind,e.animal||'',e.season||'',b?.event?.state||'',b?.event?.score??'',
   e.bridge?.friday||'',b?.friday?.state||'',e.bridge?.monday||'',b?.monday?.state||'']);
 }
 const q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='CEBONK_KALENDER_TIONGHOA_'+$('chMonth').value+'.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function mount(){
 const nav=document.querySelector('.viewtabs'),wrap=document.querySelector('main.wrap');
 if(!nav||!wrap||$('chineseCalendarView'))return;
 const style=document.createElement('style');style.id='chineseCalendarStyle';
 style.textContent=
 '.viewtabs{grid-template-columns:repeat(5,minmax(0,1fr))}'+
 '#chineseCalendarView{color:var(--text);margin-bottom:26px}'+
 '#chineseCalendarView .ch-hero{border:1px solid #526783;background:linear-gradient(125deg,#1c2a38,#17223a);border-radius:14px;padding:19px;margin-bottom:15px}'+
 '#chineseCalendarView .ch-hero small{color:#e1c58e;font-size:11px;font-weight:800;letter-spacing:1px}'+
 '#chineseCalendarView .ch-hero h2{font-size:clamp(21px,4vw,30px);margin:6px 0}'+
 '#chineseCalendarView p{line-height:1.6;font-size:12px}'+
 '#chineseCalendarView .ch-muted{color:#b7c7da;font-size:12px}'+
 '#chineseCalendarView .ch-controls{display:flex;flex-wrap:wrap;gap:9px;align-items:end;background:#162437;padding:12px;border:1px solid #3b5067;border-radius:10px}'+
 '#chineseCalendarView .ch-controls label{min-width:150px;flex:1;font-size:12px;color:#becfe0}'+
 '#chineseCalendarView .ch-controls input{display:block;width:100%;margin-top:6px}'+
 '#chineseCalendarView .ch-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}'+
 '#chineseCalendarView .ch-season{display:flex;flex-direction:column;align-items:flex-start;background:#17283b;border:1px solid #40536b;border-top:3px solid var(--ch-season);padding:12px;border-radius:10px;gap:5px}'+
 '#chineseCalendarView .ch-season small{font-size:10px;color:var(--ch-season);font-weight:800}'+
 '#chineseCalendarView .ch-season strong{font-size:13px}'+
 '#chineseCalendarView .ch-season span{color:#c9d8e7;font-size:11px}'+
 '#chineseCalendarView .ch-season button{margin-top:auto;font-size:11px;padding:6px 10px;min-height:34px;width:100%}'+
 '#chineseCalendarView .ch-events{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}'+
 '#chineseCalendarView .ch-event{padding:16px;border:1px solid #40536b;background:#15263b;border-radius:11px}'+
 '#chineseCalendarView .ch-highlight{border-color:#d0aa6d}'+
 '#chineseCalendarView .ch-head{display:flex;gap:9px;justify-content:space-between}'+
 '#chineseCalendarView .ch-head small{font-size:10px;color:#c2b189}'+
 '#chineseCalendarView .ch-head h4{margin:5px 0;font-size:16px}'+
 '#chineseCalendarView .ch-head b{color:#d5bf90;font-size:13px}'+
 '#chineseCalendarView .ch-time{font-size:13px;color:#ead09d;font-weight:750}'+
 '#chineseCalendarView .ch-sub{color:#bcd0e2}'+
 '#chineseCalendarView .ch-direction{color:#cddbe9}'+
 '#chineseCalendarView .ch-bias{display:block;padding:6px 8px;border-radius:7px;border:1px solid #788598;margin:6px 0;font-size:11px}'+
 '#chineseCalendarView .ch-buy{color:#aff5d0;background:#173b33;border-color:#4a9c75}'+
 '#chineseCalendarView .ch-sell{color:#ffc0c0;background:#4a2d38;border-color:#bb7885}'+
 '#chineseCalendarView .ch-neutral{color:#f0d4a4;background:#3d3529;border-color:#897952}'+
 '#chineseCalendarView .ch-weekend{border:1px solid #586e90;background:#1b3047;padding:10px;border-radius:8px}'+
 '#chineseCalendarView .ch-weekend>b{font-size:11px;color:#efd19b}'+
 '#chineseCalendarView .ch-bridge-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0}'+
 '#chineseCalendarView .ch-bridge-grid>span{display:block;border:1px solid #395876;padding:8px;border-radius:7px;font-size:11px}'+
 '#chineseCalendarView .ch-bridge-grid strong{display:block;margin:3px 0;color:#f5d99b}'+
 '#chineseCalendarView .ch-weekend small{font-size:10px;color:#bacddd}'+
 '#chineseCalendarView .ch-warning{padding:13px;border-left:3px solid #d4ac6e;border-radius:7px;background:#302919;color:#ecd6ad;margin-top:16px}'+
 '@media(max-width:760px){.viewtabs{grid-template-columns:repeat(2,minmax(0,1fr))}#chineseCalendarView .ch-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#chineseCalendarView .ch-events{grid-template-columns:1fr}}'+
 '@media(max-width:400px){#chineseCalendarView .ch-bridge-grid{grid-template-columns:1fr}#chineseCalendarView .ch-controls button{flex:1}}';
 document.head.appendChild(style);
 const tab=document.createElement('button');tab.id='tabChineseCalendar';tab.className='viewtab';tab.type='button';tab.textContent='KALENDER CINA';nav.appendChild(tab);
 const view=document.createElement('section');view.id='chineseCalendarView';view.hidden=true;
 view.innerHTML='<header class="ch-hero"><small>SEKTE MUSANG · CEBONK COMPANY 22</small>'+
 '<h2>FASE KALENDER TIONGHOA</h2><p class="ch-muted">24 titik musim surya, 12 pergantian periode bulan BaZi, dan 4 awal musim tahunan. Semua waktu WIB. Arah tetap memakai model Astrology hasil risetmu yang sudah terpasang.</p></header>'+
 '<div class="ch-controls"><label for="chMonth">Pilih bulan<input id="chMonth" type="month" min="2020-01" max="2040-12"></label>'+
 '<button id="chPrev" type="button">Bulan lalu</button><button id="chNext" type="button">Bulan depan</button>'+
 '<button id="chCompute" type="button" class="primary">Hitung Astrology</button><button id="chCsv" type="button" disabled>Unduh CSV</button></div>'+
 '<p id="chStatus" class="ch-muted" role="status">Pilih bulan lalu hitung.</p>'+
 '<div id="chOutput" hidden><p id="chSummary" class="ch-muted"></p>'+
 '<h3>4 Momen Pergantian Musim Tahunan</h3><div id="chSeasons" class="ch-grid"></div>'+
 '<h3 id="chMonthlyTitle"></h3><p id="chBias" class="ch-muted"></p><div id="chEvents" class="ch-events"></div></div>'+
 '<p class="ch-warning">**Perhitungan terpisah:** 24 fase kalender Tionghoa memakai posisi Matahari geosentris setiap 15°, bukan 4 fase Bulan. Label BUY/SELL berasal sepenuhnya dari mesin Astrology V1 riset CEBONK yang sudah ada; elemen, shio, atau musim tidak otomatis menentukan arah pasar. Jumat dan Senin di sekitar kejadian akhir pekan adalah tanggal kajian, bukan kepastian jam pasar XAUUSDc. Ini model eksperimental yang belum terbukti mampu memprediksi harga.</p>';
 wrap.insertBefore(view,wrap.querySelector('footer'));
 $('chMonth').value=new Date(Date.now()+7*3600000).toISOString().slice(0,7);
 $('chCompute').addEventListener('click',update);
 $('chMonth').addEventListener('change',()=>{biases={};$('chOutput').hidden=true;$('chCsv').disabled=true;note('Bulan berubah; klik Hitung Astrology.');});
 for(const [id,delta] of [['chPrev',-1],['chNext',1]])$(id).addEventListener('click',()=>{
  const [y,m]=$('chMonth').value.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));
  const target=d.toISOString().slice(0,7);
  if(target<'2020-01'||target>'2040-12'){note('Batas tahun 2020–2040.');return;}
  $('chMonth').value=target;$('chMonth').dispatchEvent(new Event('change'));update();
 });
 $('chCsv').addEventListener('click',csv);
 function open(){
  for(const id of ['astroView','astroNewsView','baziView','astroMonthlyView','technicalView','combinedView','combined2View']){
   const old=$(id);if(old)old.hidden=true;
  }
  for(const el of nav.querySelectorAll('.viewtab'))el.classList.toggle('active',el===tab);
  view.hidden=false;
  try{history.replaceState(null,'','#kalender-cina');}catch(e){}
  if(!result&&!busy)update();
 }
 nav.addEventListener('click',e=>{
  const target=e.target.closest('.viewtab');if(!target)return;
  if(target===tab)open();else view.hidden=true;
 });
 if(location.hash==='#kalender-cina')open();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
