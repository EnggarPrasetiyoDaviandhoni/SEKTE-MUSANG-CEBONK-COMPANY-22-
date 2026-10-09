/* 12M annual historical comparison UI — chart displays annual MONTHLY MEANS, never fabricated OHLC. */
(function(root){
'use strict';
const A=root.CebonkMetal12M;if(!A)return;
const $=id=>document.getElementById(id);
const n=x=>Number(x).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=x=>x===null?'—':(x>0?'+':'')+Number(x).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let price={XAUUSD:[],XAGUSD:[]},sources={},symbol='XAUUSD',isReady=false;
const safeSymbol=s=>s==='XAGUSD'?'XAGUSD':'XAUUSD';
function svg(history,selected,scale,cut){
 const entries=history.filter(x=>x.year>=cut),width=Math.max(680,entries.length*18+65),height=310,top=25,bottom=262;
 if(!entries.length)return '<p>Belum ada data untuk periode ini.</p>';
 const positive=entries.map(x=>x.average);
 const max=Math.max(...positive)*1.08;
 const min=Math.min(...positive);
 const low=scale==='log'?Math.floor(Math.log10(min))-0.15:0,high=scale==='log'?Math.log10(max):max;
 const position=v=>scale==='log'?Math.log10(v):v;
 const y=v=>(bottom-(position(v)-low)/Math.max(0.000001,high-low)*(bottom-top));
 const baseline=bottom,xFor=i=>54+i*18;
 const grid=[0,0.25,0.5,0.75,1].map(f=>{
  const value=scale==='log'?Math.pow(10,low+(high-low)*f):high*f;
  const py=bottom-(bottom-top)*f;
  return '<line x1="48" y1="'+py.toFixed(2)+'" x2="'+(width-12)+'" y2="'+py.toFixed(2)+'" stroke="#34465a" stroke-width="1"/><text x="43" y="'+(py-4).toFixed(2)+'" font-size="10" text-anchor="end" fill="#b7c9dc">'+esc(Number(value).toLocaleString('id-ID',{maximumFractionDigits:value>=100?0:2}))+'</text>';
 }).join('');
 const bars=entries.map((x,i)=>{
  const xx=xFor(i),py=y(x.average),h=Math.max(0.5,baseline-py),fill=!x.complete?'#8994a8':x.direction==='NAIK'?'#79d4a5':x.direction==='TURUN'?'#ed9299':'#bdcbd8';
  const selectedStyle=x.year===selected?' stroke="#ffd68d" stroke-width="3"':'';
  const tooltip=x.year+' — '+x.shio+' '+x.element+'; '+x.months+' bulan; rata-rata $'+n(x.average)+'; '+x.direction+'; perubahan '+pct(x.comparison);
  return '<g><title>'+esc(tooltip)+'</title><rect x="'+xx+'" y="'+py.toFixed(2)+'" width="12" height="'+h.toFixed(2)+'" rx="1" fill="'+fill+'"'+selectedStyle+'/>'+
   (x.year%5===0||i===entries.length-1?'<text x="'+(xx+6)+'" y="284" font-size="10" text-anchor="middle" fill="#b8c9d9">'+x.year+'</text>':'')+'</g>';
 }).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Grafik rata-rata harga emas atau perak per tahun dari data World Bank">'+grid+bars+'</svg>';
}
function details(r){
 const selected=r.year,history=r.history;
 const current=selected.complete?'12 BULAN LENGKAP':'BELUM LENGKAP';
 const compare=selected.comparisonType==='TAHUN PENUH'?'Perubahan rata-rata terhadap tahun sebelumnya':selected.comparisonType==='BULAN SEPADAN TAHUN SEBELUMNYA'?'Perubahan rata-rata bulan sepadan, sementara':'Tidak ada pembanding tahun sebelumnya';
 const related=r.analogue?
  '<p><strong>Perbandingan 60 tahun:</strong> '+r.analogue.year+' · '+esc(r.analogue.shio+' '+r.analogue.element)+' · rata-rata $'+n(r.analogue.average)+' · '+esc(r.analogue.direction)+'. Perbedaan tingkat harga nominal bukan ukuran dampak astrologi.</p>':
  '<p>Riwayat pembanding tepat 60 tahun sebelumnya tidak tersedia.</p>';
 return '<div class="m12-grid">'+
  '<div><small>Tahun terpilih</small><strong>'+selected.year+' · '+esc(selected.shio+' '+selected.element)+'</strong></div>'+
  '<div><small>Status data</small><strong>'+current+' ('+selected.months+'/12)</strong></div>'+
  '<div><small>Rata-rata harga</small><strong>$'+n(selected.average)+'</strong></div>'+
  '<div><small>Tren terhadap tahun lalu</small><strong>'+esc(selected.direction)+'</strong></div>'+
  '<div><small>'+esc(compare)+'</small><strong>'+pct(selected.comparison)+'</strong></div>'+
  '<div><small>Bulan yang tersedia</small><strong>'+selected.first+' → '+selected.last+'</strong></div>'+
  '</div><p>'+related+'</p><p>Dalam '+history.n+' tahun pembanding lengkap sebelum '+selected.year+': '+history.bullish+' tahun rata-rata naik, '+history.bearish+' turun, '+history.flat+' datar. Ini frekuensi observasi historis, bukan peluang trading.</p>';
}
function refresh(){
 if(!$('m12Year'))return;
 if(!isReady){$('m12Note').textContent='Menunggu data riwayat harga bulanan.';return;}
 const currentData=price[symbol]||[];
 const series=A.build(currentData);
 if(!series.length){$('m12Details').innerHTML='<p>Data harga '+symbol+' belum tersedia.</p>';$('m12Graph').innerHTML='';return;}
 const selectedValue=Number($('m12Year').value);
 if($('m12Year').options.length!==series.length||![...$('m12Year').options].every((x,i)=>Number(x.value)===series[i].year)){
  $('m12Year').innerHTML=series.map(x=>'<option value="'+x.year+'">'+x.year+(x.complete?'':' (berjalan)')+'</option>').join('');
  $('m12Year').value=series.some(x=>x.year===selectedValue)?String(selectedValue):String(series.at(-1).year);
 }
 const year=Number($('m12Year').value);
 const r=A.analyze(currentData,year);
 $('m12Details').innerHTML=details(r);
 $('m12Graph').innerHTML=svg(r.series,year,$('m12Scale').value,Number($('m12From').value));
 $('m12Note').textContent=symbol+' · '+(sources[symbol]||'Sumber belum teridentifikasi')+' · tahun paling akhir '+series.at(-1).year+'.';
}
function mount(){
 const anchor=$('ayPanel')||$('mhPanel'),host=anchor?.parentElement;if(!host||$('m12Panel'))return;
 const css=document.createElement('style');css.textContent=
 '#m12Panel{border:1px solid #56768f;border-radius:12px;background:#101d30;padding:16px;margin:18px 0}#m12Panel h3{font-size:18px;margin:0 0 8px}#m12Panel p{font-size:12px;color:#b9c9db}#m12Panel .m12-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:12px 0}#m12Panel label{font-size:11px;color:#bac8d9}#m12Panel select{display:block;width:100%;margin-top:5px}#m12Panel .m12-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}#m12Panel .m12-grid>div{padding:10px;background:#19293c;border:1px solid #37516b;border-radius:8px}#m12Panel .m12-grid small{display:block;font-size:10px;color:#aebfd1;margin-bottom:4px}#m12Panel .m12-grid strong{display:block;font-size:13px;overflow-wrap:anywhere}#m12Panel .m12-scroll{overflow-x:auto;border:1px solid #34455a;background:#0c1828;border-radius:9px;padding:9px;max-width:100%}#m12Panel .m12-scroll svg{display:block;max-width:none}#m12Panel .m12-legend{font-size:11px;color:#bdcee0;margin:8px 0}#m12Panel .m12-warning{font-size:12px;background:#30281b;border-left:3px solid #ddab51;padding:10px;color:#f4dcac;border-radius:5px}@media(max-width:760px){#m12Panel .m12-actions{grid-template-columns:1fr 1fr}#m12Panel .m12-grid{grid-template-columns:1fr 1fr}}';
 document.head.appendChild(css);
 const section=document.createElement('section');section.id='m12Panel';
 section.innerHTML='<h3>GRAFIK RIWAYAT 12 BULAN · 1960–SEKARANG</h3>'+
 '<p>Referensi tampilan TradingView 12M. Grafik berikut berupa <b>batang rata-rata harga bulanan per tahun</b>, bukan candle OHLC dan bukan harga live.</p>'+
 '<div class="m12-actions"><label>Instrumen<select id="m12Symbol"><option value="XAUUSD">XAUUSD — Emas</option><option value="XAGUSD">XAGUSD — Perak</option></select></label>'+
 '<label>Tahun yang diperiksa<select id="m12Year"><option value="2026">2026</option></select></label>'+
 '<label>Mulai grafik<select id="m12From"><option value="1960">1960 — Semua</option><option value="1980">1980</option><option value="2000">2000</option><option value="2010">2010</option><option value="2020">2020</option></select></label>'+
 '<label>Skala<select id="m12Scale"><option value="linear">Linear USD</option><option value="log">Logaritmik (harga positif)</option></select></label></div>'+
 '<div class="m12-legend">Hijau = rata-rata lebih tinggi dari tahun sebelumnya · Merah = lebih rendah · Abu-abu = belum lengkap/tanpa pembanding · Garis emas = tahun pilihan.</div>'+
 '<div class="m12-scroll" id="m12Graph" aria-live="polite"></div><div id="m12Details"></div>'+
 '<p id="m12Note" aria-live="polite">Menunggu data…</p>'+
 '<div class="m12-warning"><b>Batasan data:</b> 12M pada screenshot TradingView adalah candle 12 bulan. Arsip World Bank hanya memberikan rata-rata bulanan. Maka grafik ini tidak mengklaim memiliki open/high/low/close asli. Tahun terakhir yang belum selesai ditandai jelas dan dibandingkan hanya dengan bulan sepadan pada tahun sebelumnya. Shio/elemen berdasarkan nama tahun; batas awal tahun BaZi berbeda dari 1 Januari. Riwayat tidak membuktikan kemampuan BaZi memprediksi harga.</div>';
 host.insertBefore(section,anchor);
 for(const id of ['m12Symbol','m12Year','m12Scale','m12From'])$(id).addEventListener('change',()=>{
  if(id==='m12Symbol')symbol=safeSymbol($('m12Symbol').value);
  if(id==='m12Symbol')$('m12Year').innerHTML='';
  refresh();
 });
 refresh();
}
root.addEventListener('cebonk:market-history',e=>{
 const p=e.detail||{};
 if(!p.data)return;
 price={XAUUSD:p.data.XAUUSD||[],XAGUSD:p.data.XAGUSD||[]};
 sources=p.sources||{};
 isReady=price.XAUUSD.length>0||price.XAGUSD.length>0;
 if(!$('m12Panel'))return;
 symbol=safeSymbol(p.symbol||symbol);
 $('m12Symbol').value=symbol;
 refresh();
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
