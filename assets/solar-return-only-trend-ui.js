/* Solar Return murni: dedicated panel, no chart/order/other model dependencies. */
(function(root){
'use strict';
const C=root.CebonkCore,SR=root.CebonkComexSolarReturn,F=root.CebonkSolarReturnOnly;
const view=document.getElementById('solarReturnOnlyView');
if(!view||!C||!SR||!F||document.getElementById('srOnlyPanel'))return;
const $=id=>document.getElementById(id);
const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const wib=ms=>F.dateWIB(ms)+' '+F.timeWIB(ms)+' WIB';
const num=n=>Number.isFinite(n)?n.toFixed(3):'—';
const deg=n=>Number.isFinite(n)?n.toFixed(3)+'°':'—';
let result=null,activeRun=0,busy=false,loader=null;
const wrapper=document.createElement('div');
wrapper.className='panel sr-only';
wrapper.id='srOnlyPanel';
wrapper.innerHTML=[
 '<div class="head"><div><h2>SOLAR RETURN MURNI · FOLLOW TREND</h2>',
 '<small>Panel terpisah · COMEX Gold · astrologi tahunan → bias mingguan → fase 5 menit</small></div>',
 '<span class="sr-only-chip">RISET MURNI SR</span></div>',
 '<div class="sr-only-body">',
 '<p class="sr-only-note">Solar Return = saat longitude Matahari kembali ke longitude Matahari chart dasar.',
 ' Dasar COMEX Gold 31 Desember 1974, pukul 12:00 EST <b>hanya asumsi jam</b>.',
 ' Jam perdagangan pertama tidak terverifikasi. Tidak menghitung ASC, MC, atau rumah astrologi.</p>',
 '<div class="sr-only-controls">',
 '<label for="srOnlyDate">Tanggal analisis (WIB)<input id="srOnlyDate" type="date"',
 ' min="2020-01-01" max="2040-12-31" required></label>',
 '<label for="srOnlyHour">Asumsi jam chart dasar (EST)<select id="srOnlyHour"></select></label>',
 '<button id="srOnlyRun" class="primary" type="button">HITUNG SOLAR RETURN</button>',
 '<button id="srOnlyCancel" type="button" disabled>Batalkan</button>',
 '</div>',
 '<p id="srOnlyStatus" class="sr-only-note" role="status" aria-live="polite">',
 'Silakan pilih tanggal dan hitung Solar Return.</p>',
 '<div id="srOnlyOutput" hidden>',
 '<div class="sr-only-metrics">',
 '<div><small>Bias astrologi Senin–Jumat</small><strong id="srOnlyBias">—</strong></div>',
 '<div><small>Hari inti menurut SR</small><strong id="srOnlyPeakDay">—</strong></div>',
 '<div><small>Keseimbangan aspek*</small><strong id="srOnlyBalance">—</strong></div>',
 '<div><small>Solar Return aktif</small><strong id="srOnlyAnnual">—</strong></div>',
 '</div>',
 '<p class="sr-only-note" id="srOnlyInfo"></p>',
 '<h3>Kalender astrologi mingguan · Senin–Jumat</h3>',
 '<div class="sr-only-scroller"><table><thead><tr><th>Tanggal WIB</th>',
 '<th>Bias astrologi SR</th><th>Skor relatif*</th><th>Jam aspek aktif</th>',
 '<th>Selaras bias minggu</th></tr></thead><tbody id="srOnlyDays"></tbody></table></div>',
 '<h3>AWAL · INTI · AKHIR pada tanggal terpilih</h3>',
 '<p class="sr-only-note">Window berasal dari kedekatan aspek natal Solar Return.',
 ' AWAL = mendekat, INTI = orb terdekat, AKHIR = menjauh.',
 ' Jika tidak ada bukti selaras, status WAIT; tidak memaksa sinyal harian.</p>',
 '<div class="sr-only-scroller"><table><thead><tr><th>Awal (WIB)</th>',
 '<th>Inti (WIB)</th><th>Akhir (WIB)</th><th>Bias SR</th>',
 '<th>Aspek aktif</th><th>Kekuatan*</th></tr></thead><tbody id="srOnlyWindows"></tbody></table></div>',
 '<div class="sr-only-actions"><button id="srOnlyJSON" type="button">Ekspor JSON</button>',
 '<button id="srOnlyCSV" type="button">Ekspor CSV 5 menit</button></div>',
 '<details><summary>Posisi planet chart Solar Return aktif</summary>',
 '<div class="sr-only-scroller"><table><thead><tr><th>Planet</th>',
 '<th>Longitude</th><th>Zodiak</th></tr></thead><tbody id="srOnlyPlanets"></tbody></table></div></details>',
 '<details><summary>Metodologi &amp; batasan</summary>',
 '<p><b>Solar Return only:</b> posisi transit Venus/Jupiter (benefik tradisional),',
 ' Mars/Saturn (malefik tradisional), dihitung sebagai aspek ke Sun/Moon/Venus/Jupiter',
 ' pada chart SR aktif. Arah tanda kontribusi berdasarkan sifat planet,',
 ' BUKAN berdasarkan “Trine selalu BUY / Square selalu SELL”.</p>',
 '<p>Bobot, orb, ambang dan aturan konfirmasi adalah parameter HIPOTESIS untuk riset.',
 ' Skor bukan persentase peluang naik, dan bukan kalibrasi historis XAUUSD.',
 ' Jam dasar COMEX belum dipastikan; hasil bergantung pada asumsi ini.</p>',
 '<p>Tidak ada Astrology V1/V2, Al-Biruni, BaZi, EMA, BB, candle, harga,',
 ' API broker, order, atau auto-trade yang menentukan arah dalam modul ini.</p></details>',
 '<p class="sr-only-note"><b>MODE RISET / EA WAIT.</b> BUY dan SELL merupakan',
 ' interpretasi astrologi Solar Return yang belum terbukti mengikuti tren harga emas nyata.',
 ' Untuk memastikan keselarasan dengan GOLD perlu validasi out-of-sample.',
 ' Tidak ada jaminan profit atau sinyal entry.</p>',
 '</div></div>'
].join('');
view.append(wrapper);
const style=document.createElement('style');
style.textContent=[
 '.sr-only{margin:16px 0}.sr-only-body{padding:16px}',
 '.sr-only-chip{border:1px solid var(--line);border-radius:99px;color:var(--cyan);padding:5px 8px;font-size:10px;font-weight:800}',
 '.sr-only-note{font-size:12px;line-height:1.65;color:var(--muted);margin:12px 0}',
 '.sr-only-controls{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:16px 0}',
 '.sr-only-controls label{flex:1 1 170px;color:var(--muted);font-size:11px}',
 '.sr-only-controls input,.sr-only-controls select{width:100%;display:block;margin-top:5px}',
 '.sr-only-controls button{min-height:44px;flex:1 1 120px}',
 '.sr-only-controls .primary{flex:2 1 215px}',
 '.sr-only-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:15px 0}',
 '.sr-only-metrics>div{padding:13px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)}',
 '.sr-only-metrics small{font-size:10px;color:var(--muted);display:block}',
 '.sr-only-metrics strong{display:block;margin-top:6px;font-size:17px;overflow-wrap:anywhere}',
 '.sr-only-body h3{font-size:13px;margin:22px 0 9px}',
 '.sr-only-scroller{border:1px solid var(--line);border-radius:8px;max-height:380px;overflow:auto}',
 '.sr-only-scroller td,.sr-only-scroller th{padding:10px;font-size:11px;white-space:nowrap}',
 '.sr-only-actions{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}',
 '.sr-only-actions button{flex:1;min-height:40px}',
 '@media(max-width:650px){.sr-only-body{padding:11px}.sr-only-metrics strong{font-size:14px}}'
].join('');
document.head.append(style);
for(let h=0;h<24;h++){
 const option=document.createElement('option');
 option.value=String(h);option.textContent=pad(h)+':00 EST'+(h===12?' · default asumsi':'');
 $('srOnlyHour').append(option);
}
$('srOnlyHour').value='12';
$('srOnlyDate').value=F.dateWIB(Date.now());
function status(s,bad=false){
 $('srOnlyStatus').textContent=s;
 $('srOnlyStatus').style.color=bad?'var(--sell)':'var(--cyan)';
}
function lock(x){
 busy=x;$('srOnlyRun').disabled=x;$('srOnlyCancel').disabled=!x;
 $('srOnlyHour').disabled=x;$('srOnlyDate').disabled=x;
}
function reset(){
 activeRun++;result=null;$('srOnlyOutput').hidden=true;
 status('Tanggal/jam berubah. Hitung ulang untuk data terbaru.');
}
function inject(src){
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=src;script.async=true;
  script.referrerPolicy='no-referrer';script.onload=resolve;
  script.onerror=()=>{script.remove();reject(Error('Gagal memuat ephemeris.'));};
  document.head.append(script);
 });
}
async function astronomy(){
 if(root.Astronomy)return root.Astronomy;
 if(!loader)loader=(async()=>{
  for(const src of [
   'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
   'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js'
  ]){
   if(root.Astronomy)return root.Astronomy;
   try{await inject(src);if(root.Astronomy)return root.Astronomy;}catch(_){}
  }
  throw Error('Astronomy Engine tidak tersedia; perhitungan dibatalkan.');
 })();
 try{return await loader;}catch(e){loader=null;throw e;}
}
function render(){
 if(!result)return;
 const r=result,w=r.week;
 $('srOnlyBias').textContent=w.direction;
 $('srOnlyPeakDay').textContent=w.peakDay||'WAIT';
 $('srOnlyBalance').textContent=num(w.score)+' (−1 sampai +1)';
 $('srOnlyAnnual').textContent=wib(r.activeReturn.ms);
 $('srOnlyInfo').textContent='Pekan '+r.bounds.startWIB+'–'+r.bounds.endWIB+
  ' · analisis sesi perdagangan Senin–Jumat; Sabtu–Minggu tidak dihitung dalam bias.'+
  ' Dukungan '+num(w.positive)+' / tekanan '+num(w.negative)+
  ' · '+w.agreement+' hari searah. '+
  ' Ini bias astrologi SR, bukan pembacaan tren harga GOLD.';
 $('srOnlyDays').innerHTML=w.days.map(d=>
  '<tr><td>'+esc(d.dateWIB)+'</td><td class="'+(d.direction==='BUY'?'buy':d.direction==='SELL'?'sell':'neutral')+'">'+
  esc(d.direction)+'</td><td>'+num(d.score)+'</td><td>'+d.activeSlots+' / 24</td><td>'+
  esc(d.direction===w.direction&&w.direction!=='WAIT'?d.direction:'WAIT')+'</td></tr>').join('');
 const windows=r.windows.slice(0,20);
 $('srOnlyWindows').innerHTML=windows.length?windows.map(p=>
  '<tr><td>'+wib(p.start)+'</td><td>'+wib(p.core)+'</td>'+
  '<td>'+wib(p.end)+'</td><td>'+esc(p.direction)+'</td><td>'+
  esc(p.planet+' → SR '+p.target+' · '+p.aspect)+'</td><td>'+num(p.peakStrength)+'</td></tr>'
 ).join(''):'<tr><td colspan="6">WAIT — tidak ada fase Solar Return yang memenuhi konfirmasi searah minggu.</td></tr>';
 $('srOnlyPlanets').innerHTML=r.activeReturn.bodies.map(p=>{
  const zodiac=C.CFG.zodiac[Math.floor(p.longitude/30)];
  return '<tr><td>'+esc(p.id)+'</td><td>'+deg(p.longitude)+'</td><td>'+
   esc(zodiac)+' '+deg(p.longitude%30)+'</td></tr>';
 }).join('');
 $('srOnlyOutput').hidden=false;
}
async function run(){
 if(busy)return;
 const token=++activeRun,date=$('srOnlyDate').value,hour=Number($('srOnlyHour').value);
 lock(true);result=null;$('srOnlyOutput').hidden=true;
 try{
  C.Time.parseDate(date);
  status('Menghitung chart SR dan 5 hari astrologi…');
  const A=await astronomy();
  if(token!==activeRun)return;
  const output=await F.analyze(C,SR,A,date,hour,
   p=>{if(token===activeRun)status('Menghitung Solar Return murni '+p+'%');},
   ()=>token!==activeRun);
  if(token!==activeRun)return;
  result=output;render();
  status('Selesai. Arah astrologi SR pekan ini: '+result.week.direction+'. Trading EA: WAIT.');
 }catch(e){if(token===activeRun)status(e.message||'Gagal menghitung.',true);}
 finally{if(token===activeRun)lock(false);}
}
function download(filename,content,type){
 const url=URL.createObjectURL(new Blob([content],{type}));
 try{
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),1500);}
}
$('srOnlyRun').addEventListener('click',run);
$('srOnlyCancel').addEventListener('click',()=>{
 activeRun++;lock(false);status('Perhitungan dibatalkan.');
});
$('srOnlyHour').addEventListener('change',reset);
$('srOnlyDate').addEventListener('change',reset);
$('srOnlyJSON').addEventListener('click',()=>{
 if(result)download('SOLAR_RETURN_MURNI_'+result.dateWIB+'.json',
  JSON.stringify(F.exportResearch(result),null,2),'application/json');
});
$('srOnlyCSV').addEventListener('click',()=>{
 if(!result)return;
 const csv=[['UTC','WIB','SR_YEAR','WEEK_BIAS','LOCAL_BIAS','SCORE_SR',
   'SIGNAL_SR','PHASE','PLANET','TARGET_SR','ASPECT','ORB','EA_DECISION']];
 for(const r of result.rows)csv.push([
  r.utc,r.timeWIB,r.chartYear,r.weekBias,r.localBias,num(r.score),
  r.signal,r.phase,r.event?.planet||'',r.event?.target||'',
  r.event?.aspect||'',r.event?.orb??'','WAIT']);
 const q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 download('SOLAR_RETURN_MURNI_'+result.dateWIB+'_M5.csv',
  csv.map(row=>row.map(q).join(',')).join('\r\n'),'text/csv;charset=utf-8');
});
root.CebonkSolarReturnOnlyUI=Object.freeze({version:'3.0.0',viewId:'solarReturnOnlyView'});
})(window);
