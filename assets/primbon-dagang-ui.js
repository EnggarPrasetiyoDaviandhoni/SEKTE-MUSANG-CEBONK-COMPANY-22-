/* Separate read-only Primbon Dagang observations in the Al-Biruni web view.
 * Does not block BUY/SELL, alter trade schedule, or touch legacy Astrology.
 */
(function(root){
'use strict';
const P=root.CebonkPrimbonDagang,C=root.CebonkAlBiruni;
const panel=document.getElementById('albiruniPanel');
if(!P||!C||!panel)return;
const anchor=panel.querySelector('#abFinalDecision')||panel.querySelector('#abRules');
if(!anchor)return;
const section=document.createElement('section');
section.id='abPrimbonDagang';section.className='ab-primbon-dagang';
section.setAttribute('aria-label','Primbon Jawa khusus dagang, hanya informasi');
section.innerHTML='<h3>PRIMBON JAWA · SRI DAGANG + SAAT AGUNG</h3>'+
 '<p>Label tradisional No.159 dan No.147, <strong>bukan filter order</strong>. Arah dan eksekusi EA tetap menggunakan AL-BIRUNI DIRECT.</p>'+
 '<div id="abPrimbonSelected" role="status" aria-live="polite"></div>'+
 '<div id="abPrimbonEntry" class="ab-primbon-entry"></div>'+
 '<small>Pasaran Jawa diasumsikan berganti pukul 18.00 WIB (pendekatan Maghrib, bukan sunset aktual). Saat Agung mengikuti jam dan nama hari sipil WIB dalam tabel No.147; di luar rentang tabel tidak dinilai buruk. Kategori positif tidak menjamin profit XAUUSD.</small>'+
 '<small>Rujukan: <a href="https://jv.wikisource.org/wiki/Kaca:Kitab_Primbon_Betaljemur_Adammakna.pdf/125" target="_blank" rel="noopener">No.159 (SRI dagang)</a> dan <a href="https://jv.wikisource.org/wiki/Kaca:Kitab_Primbon_Betaljemur_Adammakna.pdf/119" target="_blank" rel="noopener">No.147 (Saat Agung)</a>.</small>';
anchor.insertAdjacentElement('afterend',section);
const sel=section.querySelector('#abPrimbonSelected'),entry=section.querySelector('#abPrimbonEntry');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const renderLabels=(v,label)=>'<div class="ab-primbon-labels"><strong>'+esc(label)+'</strong>'+
 '<div><b>Weton dagang:</b> '+esc(v.weton)+' · <b>No.159:</b> '+esc(v.sriLabel)+'</div>'+
 '<div><b>Saat Agung No.147:</b> '+esc(v.saatAgungLabel)+
 (v.saatAgung?' ('+esc(v.saatAgung.startWIB)+'–'+esc(v.saatAgung.endWIB)+' WIB · '+
  (v.saatAgung.good?'Kategori becik':'Kategori dihindari')+')':' (jam tidak tercakup tabel)')+'</div>'+
 '<small>Waktu dihitung: '+esc(v.civilDateWIB+' '+v.atWIB)+'</small></div>';
function selectedDate(){
 const chosen=panel.querySelector('#abCalendar [data-ab-date][aria-pressed="true"]');
 return chosen?.dataset.abDate||panel.querySelector('#abDate')?.value||'';
}
function render(){
 const date=selectedDate(),time=panel.querySelector('#abTime')?.value||'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}(?::\d{2})?$/.test(time)){
  sel.textContent='Pilih tanggal lan jam WIB sing valid.';entry.textContent='';return;
 }
 const [h,m,s=0]=time.split(':').map(Number);
 if(h>23||m>59||s>59){sel.textContent='Jam WIB ora valid.';entry.textContent='';return;}
 try{
  const point=C.parseDate(date)+(h*60+m)*C.MIN+s*1000;
  sel.innerHTML=renderLabels(P.evaluate(point),'WAKTU DIPILIH ING WEB');
  const f=root.CebonkAlBiruniDirectFeed;
  if(f?.model==='ALBIRUNI_MAJORITY_DIRECT_V3'&&f.date_wib===date&&
   ['BUY','SELL'].includes(f.direction)&&Number.isFinite(f.entry_epoch)&&f.entry_epoch>0){
   const v=P.evaluate(f.entry_epoch*1000);
   entry.innerHTML=renderLabels(v,'KANDIDAT ENTRY EA DIRECT · '+f.direction)+
    '<small>Status Primbon iki observasi tok; ora nyuda utawa nambah persyaratan entry.</small>';
  }else{
   entry.textContent='Kandidat entry EA DIRECT kanggo tanggal iki ora tersedia. Label Primbon dipilih tetep bisa dideleng.';
  }
 }catch(e){sel.textContent='Primbon gagal dihitung: '+String(e.message||e);entry.textContent='';}
}
for(const id of ['abDate','abTime']){
 const el=panel.querySelector('#'+id);
 if(el){el.addEventListener('input',render);el.addEventListener('change',render);}
}
for(const id of ['abCalendar','abPeriodDays']){
 const el=panel.querySelector('#'+id);
 if(el)el.addEventListener('click',render);
}
root.addEventListener('cebonk:direct-feed-updated',render);
render();
})(window);
