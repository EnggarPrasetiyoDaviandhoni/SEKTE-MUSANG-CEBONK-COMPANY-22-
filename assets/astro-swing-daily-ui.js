/* CEBONK Daily Swing panel v1.0 — a standalone research view, no trading execution. */
(function(root){
'use strict';
const C=root.CebonkCore,W=root.CebonkAstroWeekly,S=root.CebonkDailySwingCore,B=root.CebonkMt5BrokerTime;
const $=id=>document.getElementById(id);
if(!C||!W||!S||!B)return;
const WEEKDAY=['Senin','Selasa','Rabu','Kamis','Jumat'],DAY=86400000;
let result=null,weekly=null,weeklyMonday='',astronomy=null,busy=false,seq=0,loader=null;
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function pad(x){return String(x).padStart(2,'0');}
function isoDate(p){return p.year+'-'+pad(p.month)+'-'+pad(p.day);}
function brokerTime(ms){
 const p=B.civil(ms);
 return isoDate(p)+' '+pad(p.hour)+':'+pad(p.minute)+' GMT+'+(p.offset/60);
}
function wibTime(ms){
 const p=C.Time.wib(ms);
 return C.Time.dateISO(p)+' '+C.Time.hm(p)+' WIB';
}
function dayAdd(date,delta){return new Date(Date.parse(date+'T00:00:00Z')+delta*DAY).toISOString().slice(0,10);}
function nowMonday(){return W.monday(isoDate(B.civil(Date.now())));}
function observationMinute(){
 const value=$('swingEntryTime').value;
 if(!/^\d{2}:\d{2}$/.test(value))throw Error('Jam pengamatan belum valid.');
 const [h,m]=value.split(':').map(Number);
 if(h>23||m>59)throw Error('Jam broker harus 00.00 sampai 23.59.');
 return h*60+m;
}
function setStatus(s,bad=false){
 const node=$('swingStatus');
 if(node){node.textContent=s;node.classList.toggle('swing-error',bad);}
}
function invalidate(){
 result=null;
 if($('swingResult'))$('swingResult').hidden=true;
 if($('swingCopy'))$('swingCopy').disabled=true;
 setStatus('Pengaturan berubah. Hitung ulang untuk mendapatkan jadwal yang benar.');
}
function setBusy(value){
 busy=value;
 for(const id of ['swingDate','swingPrev','swingNext','swingCalc','swingEntryTime','swingBrokerMode']){
  const e=$(id);if(e)e.disabled=value;
 }
 if($('swingCalc'))$('swingCalc').textContent=value?'Menghitung…':'Hitung sinyal harian';
 if($('swingProgress'))$('swingProgress').hidden=!value;
}
function library(){
 if(root.Astronomy)return Promise.resolve(root.Astronomy);
 if(loader)return loader;
 loader=(async()=>{
  let err;
  for(const uri of [
   'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
   'https://unpkg.com/astronomy-engine@2.1.19/astronomy.browser.min.js'
  ]){
   try{
    await new Promise((resolve,reject)=>{
     const script=document.createElement('script');let done=false;
     const timer=setTimeout(()=>finish(new Error('Memuat Astronomy Engine terlalu lama')),15000);
     function finish(error){
      if(done)return;done=true;clearTimeout(timer);script.onload=script.onerror=null;
      if(error){script.remove();reject(error);}else resolve();
     }
     script.src=uri;script.async=true;
     script.onload=()=>root.Astronomy?finish():finish(new Error('Library astronomi tidak lengkap'));
     script.onerror=()=>finish(new Error('Internet atau layanan Astronomy Engine tidak tersedia'));
     document.head.appendChild(script);
    });
    if(root.Astronomy)return root.Astronomy;
   }catch(e){err=e;}
  }
  throw err||new Error('Astronomy Engine tidak dapat dimuat.');
 })().finally(()=>{loader=null;});
 return loader;
}
function dayRow(item){
 const rank=item.rank,dec=item.direction;
 const priority=dec==='WAIT'?'TIDAK ADA ARAH':rank===1?'UTAMA':rank===2?'TINGGI':rank===3?'SEDANG':'RENDAH';
 const css=dec==='BUY'?'swing-buy':dec==='SELL'?'swing-sell':'swing-wait';
 return '<tr class="'+(rank===1&&dec!=='WAIT'?'swing-top ':'')+css+'">'+
  '<td><strong>'+esc(item.weekday)+'</strong><small>'+esc(item.date)+'</small></td>'+
  '<td><strong class="swing-signal">'+esc(dec)+'</strong><small>arah dari mingguan</small></td>'+
  '<td><strong>'+item.illuminationRounded+'%</strong><small>cahaya Bulan</small></td>'+
  '<td>'+esc(brokerTime(item.observationMs))+'<small>'+esc(wibTime(item.observationMs))+'</small></td>'+
  '<td><strong>'+esc(priority)+'</strong><small>peringkat '+rank+'/5</small></td></tr>';
}
function render(){
 if(!result)return;
 const model=result,dir=model.weekDirection;
 $('swingResult').hidden=false;
 const badge=$('swingDirection');
 badge.textContent=dir==='WAIT'?'WAIT · DOMINASI TIDAK JELAS':'DOMINAN '+dir;
 badge.className='swing-direction '+(dir==='BUY'?'swing-buy':dir==='SELL'?'swing-sell':'swing-wait');
 $('swingPeriod').textContent=model.days[0].date+' s.d. '+model.days[4].date+' · Senin–Jumat (5 hari market)';
 $('swingStats').textContent='Skor model 7 harian: BUY '+model.buyMinutes+' menit · SELL '+model.sellMinutes+
 ' menit. Dasar dominasi: model mingguan lama, scan 06.00–24.00 WIB.';
 $('swingClock').textContent='GMT broker: '+B.modeLabel()+' · jam pengamatan '+$('swingEntryTime').value+
 ' (GMT+2/GMT+3 sesuai tanggal) · pembanding WIB GMT+7.';
 if(model.best){
  const p=model.best;
  $('swingBest').hidden=false;
  $('swingBestDay').textContent=p.weekday+', '+p.date;
  $('swingBestMoon').textContent=p.illuminationRounded+'% cahaya Bulan';
  $('swingBestEntry').textContent=brokerTime(p.observationMs)+' / '+wibTime(p.observationMs);
  $('swingBestReason').textContent='Prioritas karena persentase cahaya Bulan tertinggi di antara 5 hari. Bukan jaminan harga bergerak '+dir+'.';
 }else{
  $('swingBest').hidden=true;
 }
 $('swingBody').innerHTML=model.days.map(dayRow).join('');
 $('swingCopy').disabled=false;
 setStatus('Selesai · 5 hari kerja dinilai, prioritas berdasarkan persen cahaya Bulan tepat di jam pengamatan. Hasil riset, bukan sinyal market live.');
}
async function run(){
 if(busy)return;
 const date=$('swingDate').value;
 let monday,minute;
 try{
  monday=W.monday(date);W.weekDates(monday,C.CFG.yearMin,C.CFG.yearMax);
  minute=observationMinute();
 }catch(e){setStatus(e.message,true);return;}
 const token=++seq;setBusy(true);result=null;
 $('swingResult').hidden=true;$('swingCopy').disabled=true;$('swingProgress').value=0;
 setStatus('Menghitung dominasi Astrology 7 hari (Senin–Jumat)…');
 try{
  astronomy=await library();
  if(token!==seq)return;
  if(!weekly||weeklyMonday!==monday){
   const engine=C.createEngine(astronomy);
   weekly=await W.scanWeek(monday,(d,progress,cancelled)=>C.scan(engine,d,360,true,progress,cancelled,'WIB'),
    statusInfo=>{
     if(token!==seq)return;
     $('swingProgress').value=statusInfo.percent;
     setStatus(statusInfo.index===5?'Menggabungkan dominasi…':'Menghitung '+statusInfo.name+' '+statusInfo.date+' · '+statusInfo.percent+'%');
    },()=>token!==seq);
   if(token!==seq)return;
   weeklyMonday=monday;
   engine.clear();
  }
  result=S.make(weekly,astronomy,B,minute);
  render();
 }catch(e){
  if(token===seq){result=null;$('swingResult').hidden=true;setStatus('Gagal menghitung: '+(e.message||String(e)),true);}
 }finally{if(token===seq)setBusy(false);}
}
function copy(){
 if(!result)return;
 const r=result,lines=['CEBONK — SWING HARIAN (MODEL RISET)','Minggu: '+r.days[0].date+' s.d. '+r.days[4].date,
 'Dominasi astrologi: '+r.weekDirection,'Jam broker: '+B.modeLabel(),
 'Jam pengamatan: '+$('swingEntryTime').value,''];
 for(const p of r.days){
  lines.push(p.weekday+' '+p.date+' | '+p.direction+' | Bulan '+p.illuminationRounded+'% | Urutan '+p.rank+'/5 | '+brokerTime(p.observationMs)+' / '+wibTime(p.observationMs));
 }
 if(r.best)lines.push('','PRIORITAS UTAMA: '+r.best.weekday+' '+r.best.date+' | '+r.weekDirection+' | '+brokerTime(r.best.observationMs));
 lines.push('','Persentase adalah cahaya Bulan, BUKAN probabilitas BUY/SELL. Jam pengamatan bukan perintah transaksi. Status buka market perlu dicek di MT5.');
 const str=lines.join('\n');
 if(navigator.clipboard&&navigator.clipboard.writeText){
  navigator.clipboard.writeText(str).then(()=>setStatus('Ringkasan tersalin.')).catch(()=>{root.prompt('Salin ringkasan:',str);});
 }else root.prompt('Salin ringkasan:',str);
}
function mount(){
 const panel=$('dailySwingView');
 if(!panel||panel.dataset.mounted)return;
 panel.dataset.mounted='1';
 panel.innerHTML='<div class="head"><div><h2>SINYAL SWING HARIAN · ASTROLOGY + FASE BULAN</h2>'+
 '<small>Model riset independen · dominasi mingguan &amp; peringkat cahaya Bulan</small></div></div>'+
 '<div class="swing-inner"><div class="swing-controls">'+
 '<label>Minggu analisis (pilih tanggal)<input type="date" id="swingDate" min="2020-01-01" max="2040-12-31"></label>'+
 '<label>Jam pengamatan GMT broker<input type="time" id="swingEntryTime" value="00:00" step="60"></label>'+
 '<label>GMT MT5 (perkiraan)<select id="swingBrokerMode"><option value="AUTO">AUTO New York DST</option><option value="GMT2">GMT+2 manual</option><option value="GMT3">GMT+3 manual</option></select></label>'+
 '<div class="swing-buttons"><button type="button" id="swingPrev">← Minggu lalu</button><button type="button" id="swingNext">Minggu depan →</button></div>'+
 '<button type="button" id="swingCalc" class="primary">Hitung sinyal harian</button></div>'+
 '<p class="swing-explainer">Arah diambil dari <b>model astrologi mingguan V1</b> (Senin–Jumat, scan 06.00–24.00 WIB; ambang 55% durasi BUY/SELL). Tiap hari mengikuti arah mingguan yang sama jika dominasi jelas. Persentase iluminasi Bulan dihitung pada <b>jam broker yang dipilih</b>, lalu diurutkan tertinggi hingga terendah. Tidak ada arah BUY/SELL yang dihitung dari persentase Bulan.</p>'+
 '<progress id="swingProgress" max="100" value="0" hidden></progress><p id="swingStatus" role="status" aria-live="polite">Pilih minggu, lalu tekan Hitung sinyal harian.</p>'+
 '<section id="swingResult" hidden><div class="swing-overview"><span id="swingDirection" class="swing-direction">—</span><div id="swingPeriod"></div><p id="swingStats"></p><p id="swingClock"></p></div>'+
 '<div id="swingBest" class="swing-best"><span>PRIORITAS SWING UTAMA</span><strong id="swingBestDay"></strong><div id="swingBestMoon"></div><p id="swingBestEntry"></p><small id="swingBestReason"></small></div>'+
 '<div class="swing-scroll"><table><thead><tr><th>Hari</th><th>Sinyal model</th><th>Iluminasi</th><th>Jam broker / WIB</th><th>Prioritas</th></tr></thead><tbody id="swingBody"></tbody></table></div>'+
 '<button id="swingCopy" type="button" disabled>Salin sinyal mingguan</button></section>'+
 '<p class="swing-warning"><b>PERINGATAN.</b> Sinyal ini hipotesis astrologi dan belum diuji terhadap data harga XAUUSD. Persentase Bulan bukan peluang profit. Jam 00.00 hanyalah titik perhitungan, bukan bukti market buka atau waktu entry paling kuat. Untuk trading nyata, cek jam sesi broker, struktur harga, dan risiko.</p></div>';
 $('swingDate').value=nowMonday();
 $('swingBrokerMode').value=B.currentMode();
 $('swingPrev').addEventListener('click',()=>{$('swingDate').value=dayAdd(W.monday($('swingDate').value),-7);invalidate();});
 $('swingNext').addEventListener('click',()=>{$('swingDate').value=dayAdd(W.monday($('swingDate').value),7);invalidate();});
 $('swingDate').addEventListener('change',invalidate);
 $('swingEntryTime').addEventListener('change',invalidate);
 $('swingBrokerMode').addEventListener('change',e=>B.setMode(e.target.value));
 $('swingCalc').addEventListener('click',run);
 $('swingCopy').addEventListener('click',copy);
 root.addEventListener('cebonk-mt5-clock-change',()=>{
  $('swingBrokerMode').value=B.currentMode();
  if(result&&!busy&&astronomy&&weekly){
   try{result=S.make(weekly,astronomy,B,observationMinute());render();}
   catch(e){invalidate();setStatus('Jam broker berubah. Hitung ulang sinyal. '+e.message,true);}
  }
 });
 const tab=$('tabDailySwing');
 if(tab)tab.addEventListener('click',()=>{if(!result&&!busy)run();});
 if(root.location&&root.location.hash==='#sinyal-swing-harian')run();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
