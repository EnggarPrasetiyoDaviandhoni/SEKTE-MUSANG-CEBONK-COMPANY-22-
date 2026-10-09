/* CEBONK weekly Astrology UI v1.0: Monday-Friday WIB, model only. */
(function(root){
'use strict';
const Core=root.CebonkCore,Week=root.CebonkAstroWeekly;
if(!Core||!Week)return;
const $=id=>document.getElementById(id);
const T=Core.Time,MIN=60000;
let running=false,seq=0,activeResult=null,activeMode='AUTO';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=ms=>{const p=T.wib(ms);return T.dateISO(p)+' '+T.hm(p)+' WIB';};
const luxor=(ms,mode)=>{const p=T.luxor(ms,mode);return T.dateISO(p)+' '+T.hm(p)+' '+T.offsetLabel(p.offset);};
function label(d){return d==='BUY'?'BULLISH':d==='SELL'?'BEARISH':d==='TIDAK ADA ARAH'?'TIDAK ADA ARAH':'CAMPURAN';}
function style(d){return d==='BUY'?'buy':d==='SELL'?'sell':'transition';}
function status(s){$('awStatus').textContent=s;}
function buttons(busy){running=busy;$('awRun').disabled=busy;$('awDate').disabled=busy;$('awNext').disabled=busy;$('awPrev').disabled=busy;$('awCancel').disabled=!busy;}
function invalidate(){activeResult=null;$('awSummary').hidden=true;$('awDays').innerHTML='';status('Tanggal atau pengaturan berubah. Klik Hitung Mingguan untuk memperbarui hasil.');}
function dateShift(date,delta){return new Date(Date.parse(date+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10);}
function dateToWeek(date){return Week.monday(date);}
function formatBest(g){
 if(!g)return 'Tidak ada window memenuhi minimum 30 menit.';
 return '<b class="'+style(g.direction)+'">'+esc(label(g.direction))+'</b> · '+esc(clock(g.start))+' → '+esc(clock(g.end))+' · inti '+esc(clock(g.core))+' · '+g.minutes+' menit';
}
function render(result,mode,monday){
 activeResult=result;activeMode=mode;
 $('awSummary').hidden=false;
 $('awRange').textContent='Senin '+monday+' s.d. Jumat '+dateShift(monday,4)+' · jam scan 06.00–24.00 WIB';
 $('awDominant').textContent=label(result.direction);
 $('awDominant').className=style(result.direction);
 const total=result.buyMinutes+result.sellMinutes;
 $('awNumbers').textContent='BUY '+result.buyMinutes+' menit ('+(total?(100*result.buyMinutes/total).toFixed(1):'0')+'%) · SELL '+result.sellMinutes+' menit ('+(total?(100*result.sellMinutes/total).toFixed(1):'0')+'%) · netral/transisi '+result.otherMinutes+' menit.';
 if(result.best){
  const x=result.best;
  $('awDateOut').textContent=x.weekday+', '+x.date;
  $('awStart').textContent=clock(x.start);
  $('awCore').textContent=clock(x.core);
  $('awEnd').textContent=clock(x.end);
  $('awLuxor').textContent='Luxor '+luxor(x.start,mode)+' → '+luxor(x.end,mode);
  $('awCandidate').hidden=false;$('awNone').hidden=true;
 }else{
  $('awCandidate').hidden=true;$('awNone').hidden=false;
  $('awNone').textContent=result.direction==='CAMPURAN'?'Dominasi mingguan campuran; tidak ada kandidat entry utama.':'Tidak ada kandidat window dominan yang memenuhi minimal 30 menit.';
 }
 $('awDays').innerHTML=result.days.map(x=>'<tr><td>'+x.weekday+'<small>'+x.date+'</small></td><td class="'+style(x.dominant)+'">'+esc(label(x.dominant))+'</td><td>'+x.buyMinutes+' / '+x.sellMinutes+' menit</td><td>'+formatBest(x.best)+'</td></tr>').join('');
 $('awTop').innerHTML=result.candidates.map((g,i)=>'<tr><td>'+(i+1)+'</td><td>'+g.weekday+', '+g.date+'</td><td class="'+style(g.direction)+'">'+label(g.direction)+'</td><td>'+esc(clock(g.start))+'</td><td>'+esc(clock(g.core))+'</td><td>'+esc(clock(g.end))+'</td><td>'+g.minutes+' menit</td></tr>').join('')||'<tr><td colspan="7">Tidak ada kandidat searah dominasi mingguan yang memenuhi syarat.</td></tr>';
 $('awCopy').disabled=false;
}
let loading=null;
async function library(){
 if(root.Astronomy)return root.Astronomy;
 if(loading)return loading;
 loading=(async()=>{
  let err;
  for(const url of ['https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js','https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js']){
   try{
    await new Promise((ok,bad)=>{
     const script=document.createElement('script');let done=false;
     const timer=setTimeout(()=>finish(Error('Pustaka astronomi timeout.')),15000);
     function finish(e){if(done)return;done=true;clearTimeout(timer);script.onload=script.onerror=null;if(e){script.remove();bad(e);}else ok();}
     script.src=url;script.async=true;script.referrerPolicy='no-referrer';
     script.onload=()=>root.Astronomy?finish():finish(Error('Astronomy Engine tidak tersedia.'));
     script.onerror=()=>finish(Error('Gagal memuat astronomi.'));
     document.head.appendChild(script);
    });
    if(root.Astronomy)return root.Astronomy;
   }catch(e){err=e;}
  }
  throw err||Error('Pustaka astronomi gagal dimuat.');
 })().finally(()=>{loading=null;});
 return loading;
}
async function run(){
 if(running)return;
 const monday=$('awDate').value,mode=$('tzMode')?.value||'AUTO';
 let days;
 try{days=Week.weekDates(monday,Core.CFG.yearMin,Core.CFG.yearMax);}catch(e){status('Kesalahan tanggal: '+e.message);return;}
 const token=++seq;buttons(true);$('awSummary').hidden=true;$('awCopy').disabled=true;
 $('awDays').innerHTML='';$('awTop').innerHTML='';$('awProgress').hidden=false;$('awProgress').value=0;status('Memuat Astronomy Engine…');
 try{
  const A=await library();
  if(token!==seq)throw Error('Perhitungan dibatalkan.');
  const engine=Core.createEngine(A);
  const result=await Week.scanWeek(days[0].date,(date,progress,cancelled)=>Core.scan(engine,date,360,true,progress,cancelled),
  e=>{if(token!==seq)return;$('awProgress').value=e.percent;status(e.index===5?'Menggabungkan hasil…':'Menghitung '+e.name+' '+e.date+' · '+e.percent+'%');},()=>token!==seq);
  if(token!==seq)return;
  render(result,mode,days[0].date);status('Selesai: '+result.totalSlots+' slot 5 menit, Senin–Jumat. Hasil model eksperimental.');
 }catch(e){if(token===seq){$('awSummary').hidden=true;status('Perhitungan gagal: '+(e.message||String(e)));}}
 finally{if(token===seq){buttons(false);$('awProgress').hidden=true;}}
}
function copy(){
 if(!activeResult)return;
 const r=activeResult,from=$('awDate').value,head=[
  'SEKTE MUSANG · CEBONK COMPANY 22','ASTROLOGY MINGGUAN (MODEL EKSPERIMEN)','WIB '+from+' s.d. '+dateShift(from,4),'Dominan: '+label(r.direction),'BUY '+r.buyMinutes+' menit | SELL '+r.sellMinutes+' menit'
 ];
 if(r.best)head.push('Kandidat entry model: '+r.best.weekday+' '+r.best.date,'Mulai: '+clock(r.best.start),'Inti: '+clock(r.best.core),'Akhir: '+clock(r.best.end));
 else head.push('Tidak ada kandidat mingguan yang memenuhi syarat.');
 for(const d of r.days)head.push(d.weekday+' '+d.date+' '+label(d.dominant)+' '+d.buyMinutes+'/'+d.sellMinutes+' menit');
 head.push('Bukan prediksi teruji, probabilitas, atau anjuran transaksi. Model arah sama untuk XAUUSD dan XAGUSD.');
 const out=head.join('\n');
 if(navigator.clipboard?.writeText){navigator.clipboard.writeText(out).then(()=>status('Ringkasan mingguan tersalin.')).catch(()=>{root.prompt('Salin ringkasan mingguan:',out);});}
 else root.prompt('Salin ringkasan mingguan:',out);
}
function mount(){
 const parent=$('astroView');if(!parent||$('awPanel'))return;
 const css=document.createElement('style');css.id='awStyles';
 css.textContent='#awPanel{border:1px solid #364d66;border-radius:12px;margin:16px 0;overflow:hidden;background:#101d2c}#awPanel .aw-heading{padding:14px 16px;background:linear-gradient(100deg,#223142,#121d2b);border-bottom:1px solid #33465d}#awPanel h2{font-size:16px;margin:0}#awPanel .aw-body{padding:14px}#awPanel p{font-size:12px;color:#afbdce}#awPanel .aw-controls{display:flex;gap:8px;align-items:end;flex-wrap:wrap}#awPanel .aw-controls label{display:block;font-size:12px}#awPanel .aw-controls input{display:block;margin-top:5px}#awPanel .aw-controls button{font-size:12px}#awPanel .aw-summary{padding:12px;background:#13263b;border:1px solid #37506c;border-radius:9px;margin:14px 0}#awPanel .aw-summary strong{font-size:20px}#awPanel .aw-out{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}#awPanel .aw-out div{padding:10px;border-radius:7px;background:#192d41}#awPanel .aw-out small{display:block;color:#bac9d9}#awPanel .aw-out b{font-size:13px;overflow-wrap:anywhere}#awPanel .aw-dim{font-size:11px;color:#b8c8db}#awPanel .aw-scroll{overflow:auto;max-width:100%}#awPanel .aw-scroll table{white-space:normal;min-width:650px}#awPanel .aw-scroll small{display:block;color:#b7c3d2}#awPanel .aw-disclaimer{background:#2a251a;color:#f0d7a4;border-left:3px solid #d2a04d;padding:10px;border-radius:5px;margin:12px 0}#awPanel progress{display:block;width:100%;height:6px;accent-color:#70d7dc;margin:9px 0}#awPanel .aw-strong{font-weight:700}#awPanel .aw-plain{font-size:12px;padding:9px 0}#awPanel button:disabled{opacity:.45}@media(max-width:760px){#awPanel .aw-controls{display:grid;grid-template-columns:1fr 1fr}#awPanel .aw-controls label{grid-column:1/-1}#awPanel .aw-controls input{width:100%}#awPanel .aw-out{grid-template-columns:1fr 1fr}#awPanel .aw-body{padding:11px}}';
 document.head.appendChild(css);
 const panel=document.createElement('section');panel.id='awPanel';
 panel.innerHTML='<div class="aw-heading"><h2>ASTROLOGY MINGGUAN · SENIN–JUMAT</h2><p>Dominasi model BUY/SELL dan kandidat jam entry · Zona waktu WIB · Tanpa teknikal</p></div>'+
 '<div class="aw-body"><div class="aw-controls"><label>Tanggal dalam minggu (WIB)<input type="date" id="awDate" min="2020-01-01" max="2040-12-31"></label>'+
 '<button type="button" id="awPrev">Minggu lalu</button><button type="button" id="awNext">Minggu depan</button><button type="button" class="primary" id="awRun">Hitung Mingguan</button><button type="button" id="awCancel" disabled>Batal</button></div>'+
 '<p class="aw-disclaimer"><b>Penting:</b> Arah BUY/SELL berasal dari model aspek planet V1 yang belum divalidasi terhadap harga emas/perak. Waktu di bawah adalah <b>kandidat window astrologi, bukan sinyal entry pasti</b>. Karena bobot belum dibedakan berdasarkan instrumen, jadwal model <b>sama untuk XAUUSD dan XAGUSD</b>. Tidak ada eksekusi order.</p>'+
 '<progress id="awProgress" max="100" value="0" hidden></progress><p id="awStatus" role="status" aria-live="polite">Pilih minggu dan tekan Hitung Mingguan.</p>'+
 '<div id="awSummary" class="aw-summary" hidden><div class="aw-dim" id="awRange"></div><p>Dominasi astrologi minggu ini:</p><strong id="awDominant"></strong><p id="awNumbers"></p>'+
 '<div id="awCandidate"><p class="aw-strong">KANDIDAT ENTRY UTAMA (EKSPERIMEN)</p><div class="aw-out"><div><small>Tanggal</small><b id="awDateOut"></b></div><div><small>Mulai WIB</small><b id="awStart"></b></div><div><small>Inti WIB</small><b id="awCore"></b></div><div><small>Akhir WIB</small><b id="awEnd"></b></div></div><p class="aw-dim" id="awLuxor"></p></div>'+
 '<p id="awNone" hidden></p><button id="awCopy" type="button" disabled>Salin Ringkasan</button></div>'+
 '<h3 style="font-size:14px;margin:14px 0 8px">RINGKASAN HARIAN</h3><div class="aw-scroll"><table><thead><tr><th>Hari, tanggal WIB</th><th>Dominasi</th><th>BUY / SELL</th><th>Window terpanjang harian</th></tr></thead><tbody id="awDays"></tbody></table></div>'+
 '<h3 style="font-size:14px;margin:14px 0 8px">MAKSIMAL 5 WINDOW SEARAH DOMINASI MINGGUAN</h3><div class="aw-scroll"><table><thead><tr><th>No</th><th>Hari</th><th>Arah</th><th>Mulai WIB</th><th>Inti WIB</th><th>Akhir WIB</th><th>Durasi</th></tr></thead><tbody id="awTop"></tbody></table></div>'+
 '<p class="aw-dim">Scan setiap hari 06.00–24.00 WIB; grid 5 menit. Dominasi jika ≥55% waktu berkategori BUY atau SELL. Kandidat harus ≥30 menit. Seluruh jam mengikuti WIB; periode di luar scan tidak dihitung. Skor bukan win rate atau kepastian arah harga.</p></div>';
 const notice=parent.querySelector('.note');
 if(notice)notice.insertAdjacentElement('afterend',panel);else parent.prepend(panel);
 const thisWeek=dateToWeek(T.today());$('awDate').value=thisWeek;
 $('awRun').addEventListener('click',run);
 $('awPrev').addEventListener('click',()=>{$('awDate').value=dateShift(dateToWeek($('awDate').value),-7);invalidate();});
 $('awNext').addEventListener('click',()=>{$('awDate').value=dateShift(dateToWeek($('awDate').value),7);invalidate();});
 $('awDate').addEventListener('change',()=>{try{$('awDate').value=dateToWeek($('awDate').value);}catch(e){}invalidate();});
 $('tzMode')?.addEventListener('change',invalidate);
 $('awCancel').addEventListener('click',()=>{seq++;buttons(false);$('awProgress').hidden=true;status('Perhitungan dibatalkan. Tidak ada kandidat yang diterbitkan.');});
 $('awCopy').addEventListener('click',copy);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
