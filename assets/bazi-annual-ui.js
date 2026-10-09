/* BaZi one-year trend research panel. Bahasa Indonesia; observed data != prediction. */
(function(root){
'use strict';
const API=root.CebonkBaziYear;
if(!API)return;
const $=id=>document.getElementById(id);
let market={XAUUSD:[],XAGUSD:[]},sources={},loaded=false;
const num=x=>x==null?'—':(x>=0?'+':'')+x.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const cls=s=>s==='BULLISH'?'buy':s==='BEARISH'?'sell':'transition';
function cohort(label,s){
 const rate=s.n?(100*s.up/s.n).toFixed(1).replace('.',',')+'%':'—';
 return '<div class="ay-cohort"><small>'+label+'</small><b class="'+cls(s.bias)+'">'+s.bias+'</b>'+
 '<span>'+s.up+' naik · '+s.down+' turun · '+s.flat+' datar / '+s.n+' tahun</span>'+
 '<span>Frekuensi naik: '+rate+' · rata-rata: '+num(s.mean)+'</span></div>';
}
function card(symbol,analysis){
 const name=symbol==='XAUUSD'?'EMAS':'PERAK';
 const exact=analysis.matching;
 const observed=analysis.full?'<p><b>Hasil 12 bulan selesai:</b> <span class="'+(analysis.full.change>=0?'buy':'sell')+'">'+num(analysis.full.change)+'</span> ('+analysis.full.from+' hingga '+analysis.full.to+')</p>':
 analysis.partial?'<p><b>Pergerakan sementara:</b> <span class="'+(analysis.partial.change>=0?'buy':'sell')+'">'+num(analysis.partial.change)+'</span> ('+analysis.partial.from+' hingga '+analysis.partial.to+') — belum 12 bulan.</p>':
 '<p>Belum ada observasi harga untuk periode yang dipilih.</p>';
 return '<article class="ay-card"><h4>'+symbol+' — '+name+'</h4>'+
 '<div class="ay-result">Kesimpulan BaZi historis: <b class="'+cls(analysis.dominant)+'">'+analysis.dominant+'</b></div>'+
 '<p class="ay-muted">'+analysis.animal+' · Elemen '+analysis.element+' · '+analysis.samples+' siklus 12 bulan lengkap sebelum tahun '+analysis.year+'</p>'+
 cohort('Tahun berelemen '+analysis.element,analysis.byElement)+cohort('Tahun bershio '+analysis.animal,analysis.byShio)+
 '<p class="ay-muted">Kombinasi persis '+analysis.animal+' '+analysis.element+': <strong>'+exact.n+' tahun lengkap</strong>'+
 (exact.n?' · '+exact.up+' naik, '+exact.down+' turun, '+exact.flat+' datar':'')+
 '. Minimum 3 pengulangan kombinasi untuk menampilkan arah gabungan.</p>'+observed+'</article>';
}
function paint(){
 if(!$('ayCards'))return;
 const year=Number($('ayYear').value);
 if(!loaded){$('ayCards').innerHTML='<p>Menunggu arsip harga historis dari modul XAUUSD/XAGUSD…</p>';return;}
 const out=[];
 for(const symbol of ['XAUUSD','XAGUSD']){
  try{
   const r=API.analyze(market[symbol]||[],year);
   out.push(card(symbol,r));
  }catch(e){out.push('<article class="ay-card"><h4>'+symbol+'</h4><p>Data tidak dapat dihitung: '+String(e.message||e).replace(/[<>]/g,'')+'</p></article>');}
 }
 $('ayCards').innerHTML=out.join('');
 $('ayDataNote').textContent='Data: '+(sources.XAUUSD||'tidak tersedia')+'. Harga perak dapat berasal dari sumber berbeda jika CSV diimpor. Periode penuh: rata-rata Februari ke Februari berikutnya.';
}
function mount(){
 const anchor=$('mhPanel'),parent=anchor?.parentElement;if(!parent||$('ayPanel'))return;
 const css=document.createElement('style');css.textContent=
 '#ayPanel{margin:18px 0;padding:16px;border:1px solid #52718a;border-radius:12px;background:#101d30}#ayPanel h3{margin:0 0 8px;font-size:18px}.ay-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}.ay-card{padding:15px;border:1px solid #34445e;background:#101d30;border-radius:10px}.ay-card h4{margin:0 0 10px}.ay-card p{font-size:12px}.ay-muted{font-size:11px;color:#a8b8c9}.ay-result{background:#1b2c3f;padding:10px;border-radius:8px;font-size:12px}.ay-result b{display:block;font-size:16px;margin-top:4px}.ay-cohort{display:flex;gap:3px;flex-direction:column;margin:12px 0;padding:9px;border-left:2px solid #6d839d;background:#142237}.ay-cohort small,.ay-cohort span{font-size:11px;color:#c5d1df}.ay-cohort b{font-size:14px}#ayPanel select{min-width:160px;margin-left:10px}#ayPanel .ay-warning{background:#292519;border:1px solid #5f4e2f;border-radius:8px;padding:12px;font-size:12px;color:#f1dcae}@media(max-width:760px){.ay-cards{grid-template-columns:1fr}#ayPanel select{margin:8px 0;display:block;width:100%}}';
 document.head.appendChild(css);
 const box=document.createElement('section');box.id='ayPanel';
 const choices=Array.from({length:11},(_,i)=>2026+i).map(y=>'<option value="'+y+'">'+y+'</option>').join('');
 box.innerHTML='<h3>DOMINASI BULLISH / BEARISH 1 TAHUN — RIWAYAT BAZI</h3>'+
 '<label for="ayYear">Tahun BaZi yang dianalisis: <select id="ayYear">'+choices+'</select></label>'+
 '<p class="ay-muted">Perbandingan berdasarkan tahun berelemen sama, bershio sama, dan kombinasi persis. Dominasi tahunan tidak dipaksakan jika sampel kurang atau kelompok tidak konsisten.</p>'+
 '<div id="ayCards" class="ay-cards"><p>Menunggu arsip harga…</p></div>'+
 '<p id="ayDataNote" class="ay-muted"></p>'+
 '<p class="ay-warning"><b>Penting:</b> Ini pengelompokan statistik atas riwayat, bukan pembuktian bahwa BaZi menggerakkan harga. Tahun BaZi dimulai sekitar awal Februari; karena sumber hanya bulanan, perubahan rata-rata Februari ke Februari berikutnya adalah pendekatan, bukan kalender harian yang presisi. Frekuensi historis bukan probabilitas masa depan atau sinyal transaksi. Hasil tahun berjalan adalah sementara.</p>';
 parent.insertBefore(box,anchor);
 $('ayYear').addEventListener('change',paint);
 paint();
}
root.addEventListener('cebonk:market-history',e=>{
 const d=e.detail||{};
 if(d.data){
  market={XAUUSD:d.data.XAUUSD||[],XAGUSD:d.data.XAGUSD||[]};
  sources=d.sources||{};
  loaded=Object.values(market).some(x=>x.length);
  paint();
 }
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
