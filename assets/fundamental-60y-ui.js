/* Indexed documentary fundamentals + verified monthly benchmark calculations.
 * Accessible Indonesian-only view; no invented economic releases or trading orders.
 */
(function(root){
'use strict';
const F=root.CebonkFundamental60;
if(!F)return;
const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=n=>n===null?'—':(n>0?'+':'')+n.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const money=n=>n==null?'—':'$'+Number(n).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});
const cssClass=x=>x==='NAIK'?'buy':x==='TURUN'?'sell':'transition';
let records={XAUUSD:[],XAGUSD:[]},sources={},hasData=false;
function tile(name,d,year){
 if(!d)return '<article class="f60-tile"><small>'+escape(name)+' '+year+'</small><strong>TIDAK ADA DATA</strong><p>Belum tersedia observasi harga untuk tahun ini.</p></article>';
 return '<article class="f60-tile"><small>'+escape(name)+' '+year+'</small><strong class="'+cssClass(d.label)+'">'+d.label+'</strong>'+
  '<div>Rata-rata: '+money(d.average)+' / ons</div><div>Perubahan: '+pct(d.change)+'</div>'+
  '<p>'+d.months+'/12 bulan · '+escape(d.comparison)+'.</p></article>';
}
function entries(items,heading,year){
 let result='<section class="f60-events"><h4>'+heading+' · '+year+'</h4>';
 if(!items.length)return result+'<p>Tidak ada kronologi peristiwa yang sudah dikurasi untuk fase ini. Bukan berarti pasar tidak memiliki penyebab fundamental.</p></section>';
 for(const e of items){
  result+='<article class="f60-event"><div class="f60-tag">'+escape(e.date)+(e.end===e.date?'':' – '+escape(e.end))+' · '+escape(e.evidence)+'</div>'+
    '<h5>'+escape(e.title)+'</h5><p>'+escape(e.explanation)+'</p>'+
    '<p><b>Jalur fundamental:</b> '+escape(e.mechanism)+'</p>'+
    '<small>Faktor: '+escape(e.drivers.join(', '))+'</small><p class="f60-sources">Sumber: '+
    e.sources.map(x=>'<a href="'+escape(x.url)+'" target="_blank" rel="noopener noreferrer">'+escape(x.name)+'</a>').join(' · ')+'</p></article>';
 }
 return result+'</section>';
}
function paint(){
 if(!$('f60Panel'))return;
 const year=Number($('f60Year').value),sym=$('f60Symbol').value;
 const chart=$('f60Charts'),eventBlock=$('f60Events'),status=$('f60Status');
 if(!hasData||!records[sym]?.length){
  chart.innerHTML='<p>Data harga '+sym+' belum dapat dimuat. Gunakan Muat ulang arsip di panel Tren Bulanan.</p>';
  eventBlock.innerHTML='';status.textContent='Menunggu arsip harga World Bank.';return;
 }
 try{
  const r=F.compare(records[sym],year,sym);
  $('f60Phase').textContent=year+' · '+r.cycle.animal+' '+r.cycle.element+
   (r.olderYear?' | pembanding '+r.olderYear+' (siklus sama)':' | pembanding 60 tahun belum tersedia');
  chart.innerHTML=tile('Tahun terpilih',r.selected,year)+
   (r.olderYear?tile('Selisih 60 tahun',r.previous,r.olderYear):
   '<article class="f60-tile"><small>Pembanding 60 tahun</small><strong>DATA TIDAK ADA</strong></article>');
  eventBlock.innerHTML=entries(r.events,'Konteks fundamental sekitar tahun pilihan',year)+
   (r.olderYear?entries(r.previousEvents,'Konteks fundamental sekitar siklus sebelumnya',r.olderYear):'');
  $('f60Source').textContent=sym+' · '+(sources[sym]||'Sumber harga tidak tersedia')+'.';
  status.textContent='Harga: World Bank (rata-rata bulanan). Peristiwa: katalog berkala dengan sumber primer. Bukan berita ekonomi langsung.';
 }catch(e){chart.innerHTML='';eventBlock.innerHTML='';status.textContent='Perhitungan gagal: '+String(e.message||e);}
}
function mount(){
 const bazi=$('baziView'),anchor=$('ayPanel')||$('mhPanel');
 if(!bazi||!anchor||$('f60Panel'))return;
 const style=document.createElement('style');style.id='f60Style';
 style.textContent='#f60Panel{background:#111f30;border:1px solid #58788e;border-radius:13px;padding:16px;margin:16px 0;color:inherit}' +
 '#f60Panel h3{font-size:18px;margin:0 0 8px}#f60Panel h4{font-size:14px;margin:10px 0}#f60Panel p{font-size:12px;line-height:1.6}' +
 '#f60Panel label{font-size:12px;color:#c2d0dc;display:block}#f60Panel select{margin:5px 0;width:100%}#f60Panel .f60-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}' +
 '#f60Panel .f60-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}#f60Panel .f60-tile{background:#192a3c;border-radius:9px;padding:13px;border:1px solid #344e63}' +
 '#f60Panel .f60-tile small{display:block;font-size:12px;color:#c4d2df}#f60Panel .f60-tile strong{display:block;font-size:17px;margin:7px 0}' +
 '#f60Panel .f60-events{border-top:1px solid #344c62;margin-top:18px;padding-top:8px}#f60Panel .f60-event{padding:12px;margin:12px 0;background:#15263a;border:1px solid #354b63;border-radius:9px}' +
 '#f60Panel .f60-event h5{font-size:14px;margin:7px 0}#f60Panel .f60-tag{font-size:11px;color:#edd4a4}#f60Panel .f60-event small{font-size:11px;color:#cad5df}#f60Panel .f60-sources a{color:#84cce0;text-decoration:underline}' +
 '#f60Panel .f60-warning{background:#322718;border-left:3px solid #d3a354;padding:12px;border-radius:6px;color:#f2ddbc}' +
 '@media(max-width:550px){#f60Panel .f60-grid{grid-template-columns:1fr}#f60Panel{padding:12px}}';
 document.head.appendChild(style);
 const section=document.createElement('section');section.id='f60Panel';
 const years=Array.from({length:2050-1960+1},(_,i)=>1960+i).map(y=>'<option value="'+y+'"'+(y===2026?' selected':'')+'>'+y+'</option>').join('');
 section.innerHTML='<h3>FUNDAMENTAL EMAS & PERAK · SIKLUS BAZI 60 TAHUN</h3>'+
 '<p>Kenapa harga naik atau turun? Bandingkan data harga dengan kebijakan moneter, suku bunga, krisis, spekulasi, pasokan, dan permintaan. Peristiwa ditautkan ke sumber resmi atau riset pasar.</p>'+
 '<div class="f60-controls"><label>Instrumen<select id="f60Symbol"><option value="XAUUSD">XAUUSD — Emas</option><option value="XAGUSD">XAGUSD — Perak</option></select></label>'+
 '<label>Tahun pembanding<select id="f60Year">'+years+'</select></label></div>'+
 '<p id="f60Phase" style="font-weight:700"></p><div class="f60-grid" id="f60Charts"></div>'+
 '<p id="f60Source"></p><div id="f60Events"></div><p id="f60Status" role="status"></p>'+
 '<div class="f60-warning"><b>Batasan:</b> Perubahan harga dihitung dari rata-rata bulanan World Bank, bukan candle OHLC TradingView atau return transaksi. Catatan peristiwa menjelaskan konteks, bukan kontribusi kausal yang telah dihitung secara statistik. Peristiwa sekitar tahun pilihan mencakup satu tahun sebelum dan sesudah; belum tentu terjadi dalam periode tahun BaZi. Kalender tahun BaZi mulai sekitar awal Februari. Tahun berikutnya yang belum lengkap tidak ditafsirkan sebagai hasil penuh. Katalog fundamental disunting berdasarkan dokumen, tidak otomatis mengikuti setiap berita.</div>';
 anchor.parentElement.insertBefore(section,anchor);
 for(const id of ['f60Symbol','f60Year'])$(id).addEventListener('change',paint);
 paint();
}
root.addEventListener('cebonk:market-history',e=>{
 const d=e.detail||{};if(!d.data)return;
 records={XAUUSD:d.data.XAUUSD||[],XAGUSD:d.data.XAGUSD||[]};
 sources=d.sources||{};hasData=Boolean(records.XAUUSD.length||records.XAGUSD.length);
 paint();
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
