/* CEBONK 4 MOMEN ASTROLOGY BULANAN v2.0.0
   Independent Moon-phase calendar view. No BaZi, Hijri, market signal or trade API. */
(function(root){
'use strict';
const M=root.CebonkFourMoments;
if(!M)return;
const $=id=>document.getElementById(id);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LIBRARIES=['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
 'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js'];
const labels=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const glyphs={baru:'●',kuartal1:'◐',purnama:'○',kuartal3:'◑'};
let loading=null,running=false,result=null;
function pad(v){return String(v).padStart(2,'0');}
function nameOf(month){const [y,m]=month.split('-').map(Number);return labels[m-1]+' '+y;}
function format(ms){
 const date=new Date(ms+7*3600000);
 return pad(date.getUTCDate())+' '+labels[date.getUTCMonth()]+' '+date.getUTCFullYear()+
  ' · '+pad(date.getUTCHours())+':'+pad(date.getUTCMinutes())+' WIB';
}
function shift(value,delta){
 const b=M.bounds(value),d=new Date(Date.UTC(b.year,b.number-1+delta,1));
 return d.toISOString().slice(0,7);
}
function loadScript(url){
 return new Promise((resolve,reject)=>{
  const s=document.createElement('script');let done=false;
  const timeout=setTimeout(()=>finish(Error('Pustaka astronomi terlalu lama dimuat.')),15000);
  function finish(err){if(done)return;done=true;clearTimeout(timeout);s.onload=s.onerror=null;if(err){s.remove();reject(err);}else resolve();}
  s.src=url;s.async=true;s.referrerPolicy='no-referrer';
  s.onload=()=>root.Astronomy?.SearchMoonPhase?finish():finish(Error('Pustaka astronomi tidak cocok.'));
  s.onerror=()=>finish(Error('Gagal mengunduh pustaka astronomi.'));
  document.head.appendChild(s);
 });
}
async function astronomy(){
 if(root.Astronomy?.SearchMoonPhase)return root.Astronomy;
 if(!loading)loading=(async()=>{
  let error;
  for(const url of LIBRARIES){
   try{await loadScript(url);return root.Astronomy;}catch(e){error=e;}
  }
  throw error||Error('Astronomy Engine tidak tersedia.');
 })().finally(()=>{loading=null;});
 return loading;
}
function status(s){$('amStatus').textContent=s;}
function render(){
 const info=$('amCounts'),events=$('amEvents');
 info.innerHTML=M.PHASES.map(phase=>{
  const count=result.counts[phase.id];
  return '<article class="am-type"><div class="am-glyph am-'+phase.id+'">'+glyphs[phase.id]+'</div><b>'+esc(phase.name)+'</b>'+
   '<small>'+count+' kejadian pada bulan ini</small></article>';
 }).join('');
 events.innerHTML=result.moments.map((event,i)=>{
  return '<article class="am-event"><div class="am-circle am-'+event.id+'">'+glyphs[event.id]+'</div>'+
    '<div class="am-event-body"><small>MOMEN '+(i+1)+' · SUDUT '+event.angle+'°</small>'+
    '<h4>'+esc(event.name)+'</h4><strong>'+esc(format(event.ms))+'</strong>'+
    '<p>'+esc(event.detail)+'</p></div></article>';
 }).join('');
 $('amTitle').textContent=nameOf(result.month);
 $('amOutput').hidden=false;
 $('amExport').disabled=false;
 status(result.moments.length+' kejadian astronomis ditemukan pada '+nameOf(result.month)+
  '. Empat momen berarti empat jenis fase, jumlah kejadian kalender bisa berbeda.');
}
async function run(){
 if(running)return;
 running=true;$('amRun').disabled=true;$('amOutput').hidden=true;$('amExport').disabled=true;result=null;
 try{
  const month=$('amMonth').value;M.bounds(month);status('Memuat data astronomi asli…');
  const A=await astronomy();
  status('Menghitung empat fase Bulan…');
  const next=M.calculate(A,month);
  result=next;render();
 }catch(err){status('Gagal menghitung: '+(err?.message||String(err))+'. Tidak menerbitkan tanggal rekaan.');}
 finally{running=false;$('amRun').disabled=false;}
}
function exportCSV(){
 if(!result)return;
 const line=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 const rows=[['momen','sudut_derajat','waktu_wib','timestamp_utc','keterangan'],
  ...result.moments.map(x=>[x.name,x.angle,x.wib.datetime,new Date(x.ms).toISOString(),x.detail])];
 const data='\uFEFF'+rows.map(a=>a.map(line).join(',')).join('\r\n')+'\r\n';
 const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='CEBONK_4_MOMEN_ASTROLOGY_'+result.month+'.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function mount(){
 const nav=document.querySelector('.viewtabs'),wrap=document.querySelector('main.wrap');
 if(!nav||!wrap||$('astroMonthlyView'))return;
 const style=document.createElement('style');style.id='amStyle';
 style.textContent=
 '#astroMonthlyView{--amline:#405269;max-width:1160px;margin:0 auto;color:var(--text)}'+
 '#astroMonthlyView .am-hero{border-radius:14px;padding:24px 20px;background:linear-gradient(115deg,#24233e,#12253a);border:1px solid #64748c;margin-bottom:16px}'+
 '#astroMonthlyView .am-hero small{letter-spacing:1px;color:#e3bd83;font-weight:800}'+
 '#astroMonthlyView .am-hero h2{font-size:clamp(23px,4vw,34px);margin:5px 0 7px;line-height:1.2}'+
 '#astroMonthlyView .am-hero p,#astroMonthlyView .am-muted{font-size:12px;line-height:1.7;color:#bfcede}'+
 '#astroMonthlyView .am-controls{display:flex;flex-wrap:wrap;gap:9px;align-items:end;padding:13px;border:1px solid var(--amline);border-radius:11px;background:#122133;margin-bottom:12px}'+
 '#astroMonthlyView label{display:block;font-size:12px;flex:1;min-width:160px;color:#d3deed}#astroMonthlyView label input{width:100%;display:block;margin-top:5px}'+
 '#astroMonthlyView button{min-width:88px}#astroMonthlyView .am-types{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}'+
 '#astroMonthlyView .am-type{border-radius:11px;padding:13px 9px;border:1px solid var(--amline);background:#172a3f;text-align:center}'+
 '#astroMonthlyView .am-type b{display:block;font-size:12px}#astroMonthlyView .am-type small{display:block;font-size:11px;color:#b6cce0}'+
 '#astroMonthlyView .am-glyph{font-size:33px;line-height:1.3;color:#edc477}'+
 '#astroMonthlyView .am-events{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:13px 0}'+
 '#astroMonthlyView .am-event{display:flex;gap:13px;padding:16px;border:1px solid var(--amline);border-radius:11px;background:#132339}'+
 '#astroMonthlyView .am-circle{font-size:33px;min-width:40px;color:#f6d18e}#astroMonthlyView .am-event-body{min-width:0}'+
 '#astroMonthlyView .am-event small{color:#b3c6da;font-size:10px;letter-spacing:.7px}'+
 '#astroMonthlyView .am-event h4{font-size:16px;margin:3px 0 5px}'+
 '#astroMonthlyView .am-event strong{font-size:13px;color:#f1cf93;font-variant-numeric:tabular-nums}'+
 '#astroMonthlyView .am-event p{font-size:11px;line-height:1.65;color:#c3d1df;margin:8px 0 0}'+
 '#astroMonthlyView .am-warning{font-size:12px;line-height:1.6;color:#f0dfbf;background:#2f281c;border-left:3px solid #dab578;padding:12px;border-radius:8px;margin-top:13px}'+
 '@media(max-width:700px){#astroMonthlyView .am-types{grid-template-columns:1fr 1fr}#astroMonthlyView .am-events{grid-template-columns:1fr}#astroMonthlyView .am-hero{padding:17px 14px}#astroMonthlyView .am-controls button{flex:1}}';
 document.head.appendChild(style);
 const view=document.createElement('section');view.id='astroMonthlyView';view.hidden=true;
 view.innerHTML='<header class="am-hero"><small>SEKTE MUSANG · CEBONK COMPANY 22</small>'+
 '<h2>4 MOMEN ASTROLOGY BULANAN</h2><p>Kalender astronomi murni: Bulan Baru, Kuartal Pertama, Bulan Purnama, Kuartal Terakhir. Semua tanggal dan jam WIB.</p></header>'+
 '<div class="am-controls"><label for="amMonth">Bulan kalender<input id="amMonth" type="month" min="2020-01" max="2040-12"></label>'+
 '<button id="amPrev" type="button">Sebelumnya</button><button id="amNext" type="button">Berikutnya</button>'+
 '<button id="amRun" type="button" class="primary">Hitung Bulanan</button><button id="amExport" type="button" disabled>Unduh CSV</button></div>'+
 '<p id="amStatus" class="am-muted" role="status">Pilih bulan, lalu hitung empat momen astronomi.</p>'+
 '<div id="amOutput" hidden><h3 id="amTitle"></h3><div id="amCounts" class="am-types"></div>'+
 '<h3>Waktu tepat empat momen utama</h3><div id="amEvents" class="am-events"></div></div>'+
 '<p class="am-warning"><b>Catatan:</b> Empat momen berarti empat jenis fase Bulan, bukan selalu empat kejadian di setiap bulan kalender. Ijtimak tidak sama dengan hilal yang terlihat. Empat momen ini adalah peristiwa astronomi, bukan sinyal BUY/SELL. Hubungan siklus Bulan dengan harga XAUUSD/XAGUSD belum terbukti sebagai strategi trading.</p>';
 wrap.insertBefore(view,wrap.querySelector('footer'));
 const now=new Date(Date.now()+7*3600000).toISOString().slice(0,7);
 $('amMonth').value=now>='2020-01'&&now<='2040-12'?now:'2026-10';
 $('amRun').addEventListener('click',run);
 $('amMonth').addEventListener('change',()=>{result=null;$('amOutput').hidden=true;$('amExport').disabled=true;status('Bulan berubah. Klik Hitung Bulanan.');});
 for(const [id,change] of [['amPrev',-1],['amNext',1]])$(id).addEventListener('click',()=>{
  let value;
  try{value=shift($('amMonth').value,change);}catch(e){status(e.message);return;}
  if(value<'2020-01'||value>'2040-12'){status('Rentang tahun hanya 2020–2040.');return;}
  $('amMonth').value=value;$('amMonth').dispatchEvent(new Event('change'));run();
 });
 $('amExport').addEventListener('click',exportCSV);
 nav.addEventListener('click',event=>{
  const tab=event.target.closest('.viewtab');
  if(tab&&tab.id!=='tabTriple')view.hidden=true;
 });
 root.addEventListener('cebonk:moon-monthly-open',()=>{view.hidden=false;if(!result&&!running)run();});
 const deep=location.hash;
 if(deep==='#momen-astrology'||deep==='#triple-cycle'){
  const tab=$('tabTriple');if(tab)tab.click();
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
