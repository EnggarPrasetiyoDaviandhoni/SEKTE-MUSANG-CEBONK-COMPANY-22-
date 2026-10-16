/* CEBONK Monthly Moon Schedule UI v1.0 — calendar & tentative XAGUSD buy-saving dates.
 * Depends on existing Astronomy Engine lunar moments, never executes trades.
 */
(function(root){
'use strict';
const B=root.CebonkMt5BrokerTime,P=root.CebonkMoonSavingPlan,$=id=>document.getElementById(id);
if(!B||!P)return;
const MS_DAY=86400000;
const WEEK=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const LABEL=['Bulan Baru','Sabit Membesar','Perbani Awal','Cembung Membesar',
 'Bulan Purnama','Cembung Mengecil','Perbani Akhir','Sabit Menyusut'];
const ICON=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
const EVENTS=['Bulan Baru','Kuartal Pertama','Purnama','Kuartal Ketiga'];
const pad=n=>String(n).padStart(2,'0');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textUTC=new Intl.DateTimeFormat('id-ID',{dateStyle:'long',timeZone:'UTC'});
let snapshot=null,renderId=0,summaryText='',countdownHandle=null;
function wib(ms){
 const d=new Date(ms+7*3600000);
 return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+' WIB';
}
function broker(ms){
 const c=B.civil(ms);
 return P.dateStr(c)+' '+pad(c.hour)+':'+pad(c.minute)+' GMT+'+(c.offset/60);
}
function timeOnly(ms){
 const c=B.civil(ms);
 return pad(c.hour)+':'+pad(c.minute)+' GMT+'+(c.offset/60);
}
function iso(y,m,d){return y+'-'+pad(m+1)+'-'+pad(d);}
function updateNext(){
 const target=$('moonSavingCountdown');
 if(!target || !root.Astronomy)return;
 const A=root.Astronomy;
 try{
  let q=A.SearchMoonQuarter(new Date());
  for(let i=0;i<5&&q.quarter!==1;i++)q=A.NextMoonQuarter(q);
  if(q.quarter!==1){target.textContent='Perhitungan berikutnya belum tersedia.';return;}
  const t=q.time.date.getTime(),delta=Math.max(0,t-Date.now());
  const days=Math.floor(delta/MS_DAY),hours=Math.floor(delta%MS_DAY/3600000),mins=Math.floor(delta%3600000/60000);
  target.textContent='Kuartal Pertama berikutnya: '+broker(t)+' / '+wib(t)+' · '+days+' hari '+hours+' jam '+mins+' menit lagi.';
 }catch(e){target.textContent='Hitung mundur belum tersedia: '+e.message;}
}
function planRows(events){
 const close=$('moonSavingFridayClose').value;
 const lead=Number($('moonSavingBeforeClose').value);
 return events.filter(x=>x.quarter===1).map(x=>P.plan(x.date,B,close,lead));
}
function planDetails(p){
 const t=p.plannedMs===null?'JAM BELUM DISETEL':broker(p.plannedMs)+' / '+wib(p.plannedMs);
 const tag=p.type==='FRIDAY_ESTIMATE'?'PERKIRAAN JUMAT':
   p.type==='QUARTER_CONDITIONAL'?'TEPAT KUARTAL PERTAMA':
   p.type==='FRIDAY_UNSET'?'BUTUH JAM TUTUP JUMAT':'PERLU KOREKSI';
 return '<div class="moon-saving-plan">'+
  '<strong>Kuartal Pertama: '+esc(broker(p.phaseMs))+' / '+esc(wib(p.phaseMs))+'</strong>'+
  '<span class="moon-saving-tag">'+esc(tag)+'</span>'+
  '<p>Calon BUY: '+esc(p.scheduledDate)+' · '+esc(t)+'</p>'+
  '<small>'+esc(p.note)+'</small></div>';
}
function monthTable(snapshot,plans){
 const {year,month,events}=snapshot,A=root.Astronomy;
 const end=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 const eventsByDate=new Map();
 const plannedByDate=new Map();
 for(const e of events){const k=P.dateStr(B.civil(e.date.getTime()));if(!eventsByDate.has(k))eventsByDate.set(k,[]);eventsByDate.get(k).push(e);}
 for(const p of plans){if(!plannedByDate.has(p.scheduledDate))plannedByDate.set(p.scheduledDate,[]);plannedByDate.get(p.scheduledDate).push(p);}
 let rows='',summary=['KALENDER FASE BULAN DAN XAGUSD SAVING '+(month+1)+'/'+year,'MODE '+B.modeLabel(),'JAM TUTUP JUMAT: '+($('moonSavingFridayClose').value||'BELUM DIISI'),''];
 for(let d=1;d<=end;d++){
  const when=B.wallToUtc(year,month,d,12,0),utcDate=new Date(when);
  const illumination=A.Illumination(A.Body.Moon,utcDate).phase_fraction*100;
  const angle=A.MoonPhase(utcDate);
  if(!Number.isFinite(illumination)||!Number.isFinite(angle))throw Error('Data Bulan tidak lengkap pada '+d);
  const i=Math.floor(((angle%360+360)%360+22.5)/45)%8;
  const pct=Math.round(illumination);
  const date=iso(year,month,d),dayOfWeek=new Date(Date.UTC(year,month,d)).getUTCDay();
  const dayEvents=eventsByDate.get(date)||[],dayPlans=plannedByDate.get(date)||[];
  const eventNames=dayEvents.map(e=>EVENTS[e.quarter]+' '+timeOnly(e.date.getTime())+' / '+wib(e.date.getTime())).join('; ');
  const plansLabel=dayPlans.map(p=>{
   const mark=p.type==='QUARTER_CONDITIONAL'?'BUY bersyarat':p.type==='FRIDAY_ESTIMATE'?'BUY Jumat (estimasi)':p.type==='FRIDAY_UNSET'?'Isi jam tutup Jumat':'WAIT';
   return mark+(p.plannedMs===null?'':' '+timeOnly(p.plannedMs));
  }).join('; ');
  const hasQuarter=dayEvents.some(e=>e.quarter===1);
  const eventNote=hasQuarter&&dayOfWeek%6===0?'Kuartal Pertama akhir pekan · lihat calon Jumat':eventNames;
  const planNote=plansLabel|| (hasQuarter&&dayOfWeek%6===0?'Lihat ringkasan jadwal Jumat':'—');
  rows+='<tr class="'+(dayPlans.length?'moon-saving-buy ':'')+(hasQuarter?'moon-saving-quarter':'')+'">'+
   '<td><b>'+esc(WEEK[dayOfWeek])+' '+d+'</b><small>'+esc(date)+'</small></td>'+
   '<td>'+ICON[i]+' '+esc(LABEL[i])+'</td>'+
   '<td><b>'+pct+'%</b><small>12.00 broker</small></td>'+
   '<td>'+esc(eventNote||'—')+'</td>'+
   '<td>'+esc(planNote)+'</td></tr>';
  summary.push(date+' | '+WEEK[dayOfWeek]+' | '+LABEL[i]+' '+pct+'% | '+(eventNames||'—')+' | '+(plansLabel||'—'));
 }
 for(const p of plans)summary.push('BUY QUARTAL PERTAMA: '+p.scheduledDate+' '+(p.plannedMs===null?'jam perlu diisi':broker(p.plannedMs))+' | fase tepat '+broker(p.phaseMs)+' | '+p.note);
 summary.push('CATATAN: Jadwal BUY tidak memverifikasi pasar XAGUSD sedang buka. Tidak ada transaksi oleh web.');
 summaryText=summary.join('\n');
 return rows;
}
function render(snapshotNow){
 if(!snapshotNow)return;
 snapshot=snapshotNow;
 const rootEl=$('moonSavingMonthStatus');
 if(!rootEl)return;
 const token=++renderId;
 try{
  if(!root.Astronomy)throw Error('Astronomy Engine belum siap.');
  const plans=planRows(snapshot.events);
  const html=monthTable(snapshot,plans);
  if(token!==renderId)return;
  $('moonSavingMonthBody').innerHTML=html;
  $('moonSavingPlans').innerHTML=plans.length?plans.map(planDetails).join(''):
   '<p>Tidak ada Kuartal Pertama pada bulan ini. Lihat bulan sebelah.</p>';
  $('moonSavingBrokerMode').value=B.currentMode();
  $('moonSavingMonthInfo').textContent='Tanggal 1–'+new Date(Date.UTC(snapshot.year,snapshot.month+1,0)).getUTCDate()+
   ' · persen cahaya Bulan di 12.00 GMT broker · mode '+B.modeLabel()+
   '. Pilihan AUTO ialah estimasi DST New York, bukan koneksi langsung ke MT5.';
  rootEl.textContent='Kalender lengkap terhitung. '+(plans.length?'Rencana BUY hanya untuk Kuartal Pertama.':'Tidak ada BUY untuk fase lainnya.');
  $('moonSavingCopy').disabled=false;
  updateNext();
 }catch(e){
  rootEl.textContent='Perhitungan jadwal tidak tersedia: '+(e.message||String(e));
  $('moonSavingMonthBody').innerHTML='';
  $('moonSavingPlans').textContent='Jadwal tidak dapat dihitung.';
  $('moonSavingCopy').disabled=true;
 }
}
function mount(){
 const holder=$('moonCalendarView');
 if(!holder||$('moonSavingMonth'))return;
 const content=holder.querySelector('.moon-content');
 if(!content)return;
 const panel=document.createElement('section');
 panel.id='moonSavingMonth';
 panel.className='moon-saving-month';
 panel.innerHTML='<h3>KALENDER LENGKAP 1 BULAN · JADWAL NABUNG BUY XAGUSD</h3>'+
 '<p class="moon-saving-intro">Setiap tanggal: nama fase, persen cahaya Bulan, dan jam momen utama. BUY hanya menjadi <b>calon jadwal</b> saat Kuartal Pertama; jika Sabtu/Minggu, gunakan Jumat sebelumnya dalam fase Sabit Membesar, bila sesi Jumat cocok.</p>'+
 '<div class="moon-saving-settings">'+
 '<label>GMT broker MT5<select id="moonSavingBrokerMode"><option value="AUTO">AUTO New York DST (estimasi)</option><option value="GMT2">Manual GMT+2</option><option value="GMT3">Manual GMT+3</option></select></label>'+
 '<label>Jam tutup Jumat XAGUSD di MT5<input type="time" id="moonSavingFridayClose" step="60" aria-label="Jam tutup Jumat broker XAGUSD" title="Isi berdasarkan Specification simbol XAGUSD di MT5"></label>'+
 '<label>Menit sebelum Jumat tutup<input type="number" id="moonSavingBeforeClose" min="1" max="60" step="1" value="5"></label>'+
 '</div>'+
 '<p class="moon-saving-disclaimer">Jam tutup Jumat <b>harus diisi sesuai Specification → Sessions</b> simbol XAGUSD/XAGUSDc broker. Tanpa jam ini web hanya dapat menghitung tanggal Jumat, <b>bukan jam pasti entry</b>. Jam hari kerja juga bersyarat: market harus benar-benar buka, tidak libur dan tidak sedang jeda perdagangan. Tidak ada WebRequest MT5 atau order dari web.</p>'+
 '<p id="moonSavingCountdown" class="moon-saving-next"></p>'+
 '<div id="moonSavingPlans" class="moon-saving-plans"></div>'+
 '<p id="moonSavingMonthInfo" class="moon-saving-meta"></p>'+
 '<p id="moonSavingMonthStatus" role="status" aria-live="polite"></p>'+
 '<div class="moon-saving-scroll"><table><thead><tr><th>Tanggal</th><th>Fase Bulan</th><th>Cahaya</th><th>Momen utama GMT broker / WIB</th><th>Rencana BUY</th></tr></thead><tbody id="moonSavingMonthBody"></tbody></table></div>'+
 '<button id="moonSavingCopy" type="button" disabled>Salin kalender 1 bulan</button>'+
 '<p class="moon-saving-risk"><b>MODE NABUNG:</b> BUY 0.01 lot, maksimum 5 posisi (aturan EA, bukan posisi web). Tanpa SL/TP tetap memiliki risiko floating loss, swap, margin call, dan likuidasi paksa. Tidak ada bukti Kuartal Pertama memberikan keunggulan harga XAGUSD.</p>';
 content.insertBefore(panel,content.querySelector('.moon-caveat'));
 $('moonSavingBrokerMode').value=B.currentMode();
 $('moonSavingBrokerMode').addEventListener('change',e=>B.setMode(e.target.value));
 $('moonSavingFridayClose').addEventListener('change',()=>render(snapshot));
 $('moonSavingBeforeClose').addEventListener('change',()=>render(snapshot));
 $('moonSavingCopy').addEventListener('click',()=>{
  if(!summaryText)return;
  if(navigator.clipboard&&navigator.clipboard.writeText){
   navigator.clipboard.writeText(summaryText).then(()=>{$('moonSavingMonthStatus').textContent='Kalender 1 bulan disalin.';})
    .catch(()=>root.prompt('Salin jadwal:',summaryText));
  }else root.prompt('Salin jadwal:',summaryText);
 });
 root.addEventListener('cebonk-moon-calendar-updated',e=>render(e.detail));
 if(root.CebonkMoonMonthSnapshot)render(root.CebonkMoonMonthSnapshot);
 if(!countdownHandle)countdownHandle=root.setInterval(()=>{if(!holder.hidden)updateNext();},60000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
