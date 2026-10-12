/* Al-Biruni classical dignity research + visibly separated existing AUTO XAUUSD hypotheses.
 * This file does not change the trading feed, EA or legacy ASTROLOGY module.
 */
(function(root){
'use strict';
const core=root.CebonkAlBiruni,classicCore=root.CebonkAlBiruniClassic;
const panel=document.getElementById('albiruniPanel');
if(!core||!classicCore||!panel)return;
const rulePanel=panel.querySelector('#abRules');
if(!rulePanel)return;
const details=document.createElement('details');
details.id='abClassicPanel';
details.open=true;
details.innerHTML=[
 '<summary>AL-BIRUNI KLASIK · ARAH BUY/SELL + MARTABAT PLANET</summary>',
 '<p><strong>ARAH BUY/SELL di panel iki dijupuk saka model AUTO EKSPERIMEN lawas</strong>, dudu hasil skor martabat kitab, dudu prediksi sing wis terbukti, lan dudu sinyal eksekusi EA. Skor martabat klasik ditampilkan terpisah supaya sumberé jelas.</p>',
 '<label for="abClassicSect">Sekta siang/malam — pilih MANUAL sesuai lokasi</label>',
 '<select id="abClassicSect"><option value="day">Siang</option><option value="night">Malam</option></select>',
 '<button id="abClassicCalc" type="button">Hitung arah BUY/SELL dan martabat</button>',
 '<div id="abClassicResults" role="status" aria-live="polite">ARAH: BELUM DIHITUNG. Jalankan peta aspek, pilih tanggal & jam WIB, lalu tekan tombol di atas.</div>',
 '<p>Kitab §440, §443, §445, §449, §494: rumah 5, exaltation 4, triplicity 2, face 1. Term 3 belum dihitung karena tabel Mesir/Ptolemaios belum dipilih. Tidak ada formula prediksi XAUUSD asli dari kitab.</p>'
].join('');
rulePanel.parentNode.insertBefore(details,rulePanel);
const output=details.querySelector('#abClassicResults');
const button=details.querySelector('#abClassicCalc');
const names={Sun:'Matahari',Moon:'Bulan',Mercury:'Merkurius',Venus:'Venus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturnus'};
let generation=0;
const readInputs=()=>{
 const selected=panel.querySelector('#abCalendar [data-ab-date][aria-pressed="true"]');
 return {
  day:selected?.dataset.abDate||panel.querySelector('#abDate')?.value||'',
  time:panel.querySelector('#abTime')?.value||'',
  focus:panel.querySelector('#abFocus')?.value||'moon',
  orb:Number(panel.querySelector('#abOrb')?.value),
  sect:details.querySelector('#abClassicSect').value
 };
};
const fingerprint=v=>JSON.stringify(v);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const directionChip=d=>'<span class="ab-chip ab-'+(d==='BUY'?'buy':d==='SELL'?'sell':'neutral')+'">'+escape(d)+'</span>';
const stamp=ms=>ms==null?'—':escape(core.stamp(ms));
const reset=()=>{generation++;output.textContent='ARAH: PERLU DIHITUNG ULANG setelah perubahan tanggal, jam, atau setelan.';};
for(const id of ['abDate','abTime','abOrb','abFocus','abMode','abClassicSect']){
 const node=panel.querySelector('#'+id)||details.querySelector('#'+id);
 if(node){node.addEventListener('input',reset);node.addEventListener('change',reset);}
}
for(const id of ['abCalendar','abPeriodDays']){
 const node=panel.querySelector('#'+id);
 if(node)node.addEventListener('click',reset);
}
button.addEventListener('click',async()=>{
 if(button.disabled)return;
 const current=++generation,inputs=readInputs(),check=fingerprint(inputs);
 button.disabled=true;
 output.textContent='Menghitung arah hipotesis harian dan skor martabat klasik…';
 try{
  if(panel.querySelector('#abResults')?.hidden)throw Error('Hitung peta aspek dulu; data yang terlihat belum siap.');
  if(!root.Astronomy)throw Error('Pustaka astronomi belum dimuat.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(inputs.day))throw Error('Tanggal belum valid.');
  if(!/^\d{2}:\d{2}(:\d{2})?$/.test(inputs.time))throw Error('Jam pemeriksaan tidak valid.');
  const [h,m,s=0]=inputs.time.split(':').map(Number);
  if(h>23||m>59||s>59)throw Error('Jam pemeriksaan tidak valid.');
  if(!Number.isFinite(inputs.orb)||inputs.orb<0.25||inputs.orb>5)throw Error('Orb tidak valid.');
  const ms=core.parseDate(inputs.day)+(h*60+m)*core.MIN+s*1000;
  const engine=core.createEngine(root.Astronomy);
  const positions=Object.fromEntries(classicCore.BODIES.map(body=>[body,engine.longitude(body,ms)]));
  const classical=classicCore.assess(positions,inputs.sect);
  // Explicitly separate modern directional hypotheses from historical astrological dignities.
  const map=await core.scan(engine,inputs.day,{mode:'day',focus:inputs.focus,orb:inputs.orb});
  const atTime=core.autoSignal(engine,map,ms);
  const daily=core.periodEntryReport(engine,map);
  if(current!==generation||check!==fingerprint(readInputs())||panel.querySelector('#abResults')?.hidden)return;
  const dayDirection=daily.direction==='BUY'||daily.direction==='SELL'?daily.direction:'WAIT';
  const timeDirection=atTime.direction==='BUY'||atTime.direction==='SELL'?atTime.direction:'WAIT';
  const reason=atTime.direction==='KONFLIK'?'BUY/SELL bentrok':atTime.direction==='NETRAL'?'Tidak ada arah kuat':atTime.reason;
  const dominant=atTime.dominant;
  const aspect=dominant?
   dominant.pair.map(x=>names[x]||x).join(' ↔ ')+' · '+dominant.name+' '+dominant.angle+'° · '+dominant.phase:
   'Tidak ada aspek dominan yang cukup kuat pada jam dipilih';
  const rows=classical.rows.map(row=>{
   const p=row.points;
   const desc=['domicile','exaltation','triplicity','face'].filter(k=>p[k]>0)
    .map(k=>({domicile:'Rumah',exaltation:'Peninggian',triplicity:'Triplicity',face:'Face'})[k]+' +'+p[k]).join('; ')||'Tidak ada martabat terhitung';
   return '<tr><td>'+escape(names[row.body])+'</td><td>'+escape(row.sign)+' '+row.signDegree.toFixed(2)+'°</td>'+
    '<td>'+row.subtotal+'</td><td>'+escape(desc)+(row.detriment?' · Detriment':'')+(row.fall?' · Fall':'')+'</td></tr>';
  }).join('');
  output.innerHTML=
   '<div class="ab-period-focus"><span>ARAH HARIAN · MODEL AUTO EKSPERIMEN</span>'+
    directionChip(dayDirection)+'<small>Belum divalidasi dengan data XAUUSD. Bukan arah dari skor klasik dan tidak dikirim ke EA.</small></div>'+
   '<div class="ab-period-times"><div><small>KANDIDAT WAKTU</small><strong>'+escape(daily.entryWIB||'WAIT')+'</strong></div>'+
    '<div><small>MULAI</small><strong>'+stamp(daily.startUTC)+'</strong></div>'+
    '<div><small>INTI</small><strong>'+stamp(daily.coreUTC)+'</strong></div>'+
    '<div><small>AKHIR</small><strong>'+stamp(daily.endUTC)+'</strong></div></div>'+
   '<p><strong>ARAH PADA '+escape(inputs.day+' '+inputs.time)+' WIB:</strong> '+directionChip(timeDirection)+
    (atTime.direction==='KONFLIK'?' · KONFLIK':'')+' · '+escape(reason)+
    '. Aspek: '+escape(aspect)+'.</p>'+
   '<p><strong>SKOR PARSIAL KLASIK</strong> · '+escape(inputs.sect==='day'?'SIANG':'MALAM')+
    ' · tidak menentukan BUY/SELL. Term +3 belum dihitung.</p>'+
   '<div class="ab-table-wrap"><table><thead><tr><th>Planet</th><th>Zodiak</th><th>Subtotal</th><th>Martabat</th>'+
   '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
   '<p>AWAS: arah di atas hipotesis AUTO V1 lawas, bukan rumus harga saka kitab Al-Biruni. Uji historis XAUUSD dibutuhkan sebelum penggunaannya pada akun real.</p>';
 }catch(e){
  if(current===generation)output.textContent='Perhitungan arah dan martabat gagal: '+(e.message||String(e));
 }finally{button.disabled=false;}
});
})(window);
