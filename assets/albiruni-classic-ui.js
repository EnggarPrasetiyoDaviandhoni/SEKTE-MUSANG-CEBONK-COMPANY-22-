/* Additive Al-Biruni classical research panel. Never touches legacy astrology or trade feed. */
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
 '<summary>AL-BIRUNI KLASIK · MARTABAT PLANET (BUKAN SINYAL BUY/SELL)</summary>',
 '<p>Kitab Al-Biruni §440, §443, §445, §449 dan §494: rumah 5, peninggian 4, triplicity 2, face 1. Term 3 belum dihitung karena tabel alternatif Mesir/Ptolemaios. Skor yang ditampilkan adalah subtotal, bukan probabilitas pasar.</p>',
 '<label for="abClassicSect">Pilih siang/malam MANUAL sesuai lokasi perhitungan</label>',
 '<select id="abClassicSect"><option value="day">Siang</option><option value="night">Malam</option></select>',
 '<button id="abClassicCalc" type="button">Hitung klasik pada tanggal dan jam WIB pemeriksaan</button>',
 '<div id="abClassicResults" role="status" aria-live="polite">Jalankan peta aspek dahulu, pilih hari dan jam, lalu hitung martabat.</div>',
 '<p>Riset terpisah: tidak mengambil alih bobot AUTO, tidak mengirim sinyal ke EA/Telegram. Ascendant, rumah, konjungsi lintang, dan term belum dihitung.</p>'
].join('');
rulePanel.parentNode.insertBefore(details,rulePanel);
const result=details.querySelector('#abClassicResults');
const names={Sun:'Matahari',Moon:'Bulan',Mercury:'Merkurius',Venus:'Venus',Mars:'Mars',Jupiter:'Jupiter',Saturn:'Saturnus'};
const reset=()=>{result.textContent='Pengaturan berubah. Hitung ulang martabat klasik.';};
for(const id of ['abDate','abTime','abOrb','abFocus','abMode','abClassicSect']){
 const node=panel.querySelector('#'+id)||details.querySelector('#'+id);
 if(node){node.addEventListener('input',reset);node.addEventListener('change',reset);}
}
for(const id of ['abCalendar','abPeriodDays']){
 const node=panel.querySelector('#'+id);
 if(node)node.addEventListener('click',reset);
}
details.querySelector('#abClassicCalc').addEventListener('click',()=>{
 try{
  if(panel.querySelector('#abResults')?.hidden)throw Error('Peta aspek harus dihitung dan belum kedaluwarsa.');
  if(!root.Astronomy)throw Error('Pustaka astronomi belum dimuat.');
  const dayButton=panel.querySelector('#abCalendar [data-ab-date][aria-pressed="true"]');
  const day=dayButton?.dataset.abDate||panel.querySelector('#abDate')?.value;
  const time=panel.querySelector('#abTime')?.value||'';
  if(!/^\d{2}:\d{2}(:\d{2})?$/.test(time))throw Error('Jam tidak valid.');
  const [h,m,s=0]=time.split(':').map(Number);
  if(h>23||m>59||s>59)throw Error('Jam tidak valid.');
  const ms=core.parseDate(day)+(h*60+m)*core.MIN+s*1000;
  const engine=core.createEngine(root.Astronomy);
  const position=Object.fromEntries(classicCore.BODIES.map(body=>[body,engine.longitude(body,ms)]));
  const sect=details.querySelector('#abClassicSect').value;
  const audit=classicCore.assess(position,sect);
  const rows=audit.rows.map(row=>{
   const p=row.points;
   const note=['domicile','exaltation','triplicity','face'].filter(k=>p[k]>0)
    .map(k=>({domicile:'Rumah',exaltation:'Peninggian',triplicity:'Triplicity',face:'Face'})[k]+' +'+p[k]).join('; ')||'Tidak ada';
   return '<tr><td>'+names[row.body]+'</td><td>'+row.sign+' '+row.signDegree.toFixed(2)+'°</td>'+
    '<td>'+row.subtotal+'</td><td>'+note+(row.detriment?' · Detriment':'')+
    (row.fall?' · Fall':'')+'</td></tr>';
  }).join('');
  result.innerHTML='<p><strong>SKOR PARSIAL KLASIK '+day+' '+time+' WIB · '+
   (sect==='day'?'SIANG':'MALAM')+'</strong> — TIDAK ADA ARAH BUY/SELL.</p>'+
   '<div class="ab-table-wrap"><table><thead><tr><th>Planet</th><th>Posisi zodiak</th>'+
   '<th>Subtotal</th><th>Martabat</th></tr></thead><tbody>'+rows+
   '</tbody></table></div><p>Term 3 poin belum dihitung, dan siang/malam dipilih manual. Urutan subtotal bukan rekomendasi trading emas.</p>';
 }catch(e){result.textContent='Audit klasik tidak tersedia: '+(e.message||String(e));}
});
})(window);
