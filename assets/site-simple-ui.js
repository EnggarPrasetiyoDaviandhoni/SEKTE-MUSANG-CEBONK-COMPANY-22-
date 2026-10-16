/* CEBONK simple site shell v1.0
 * Presentation only: preserves module IDs, calculations, events, feeds and routes.
 * Open a detail section to use the original full research controls.
 */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
function groupChildren(parent,keepIds,sectionId,title,description){
 if(!parent||$(sectionId))return null;
 const nodes=[...parent.children].filter(node=>!keepIds.includes(node.id)&&!(sectionId==='simpleAstroDetails'&&node.classList.contains('metrics')));
 if(!nodes.length)return null;
 const box=document.createElement('details');
 box.id=sectionId;
 box.className='simple-detail-group';
 const summary=document.createElement('summary');
 summary.textContent=title;
 box.append(summary);
 if(description){
  const p=document.createElement('p');
  p.className='simple-detail-note';
  p.textContent=description;
  box.append(p);
 }
 nodes.forEach(node=>box.append(node));
 parent.append(box);
 return box;
}
function mount(){
 if($('simpleMore'))return;
 const nav=document.querySelector('.viewtabs');
 if(!nav)return;
 document.body.classList.add('cebonk-simple');
 const primary=['tabAstro','tabAlBiruni','tabAstroFollowTrend','tabMoonCalendar','tabDailySwing'];
 const more=document.createElement('button');
 more.id='simpleMore';
 more.className='simple-more';
 more.type='button';
 more.setAttribute('aria-expanded','false');
 more.textContent='Modul lainnya ▾';
 nav.append(more);
 function toggleMore(on){
  nav.classList.toggle('simple-nav-open',on);
  more.setAttribute('aria-expanded',String(on));
  more.textContent=on?'Tutup modul ▴':'Modul lainnya ▾';
 }
 more.addEventListener('click',()=>toggleMore(!nav.classList.contains('simple-nav-open')));
 nav.addEventListener('click',e=>{
  const button=e.target.closest('button.viewtab');
  if(button&&!primary.includes(button.id))toggleMore(true);
 });
 root.addEventListener('hashchange',()=>{
  const active=nav.querySelector('.viewtab.active');
  if(active&&!primary.includes(active.id))toggleMore(true);
 });
 // Preserve a deep-link to any existing extra module.
 const selected=nav.querySelector('.viewtab.active');
 if(selected&&!primary.includes(selected.id))toggleMore(true);

 const astro=$('results');
 if(astro){
  const advanced=groupChildren(astro,[], 'simpleAstroDetails',
   'Rincian astrologi & data 5 menit',
   'Timeline, tabel planet, ekspor dan pemeriksaan slot tetap tersedia di sini.');
  if(advanced)advanced.open=false;
 }
 const astroControls=$('tzMode')?.closest('.mode-control');
 if(astroControls){
  const button=document.createElement('button');
  button.type='button';button.id='simpleAstroSettings';
  button.className='simple-inline-toggle';
  button.textContent='Pengaturan jam lanjut ▾';
  button.setAttribute('aria-expanded','false');
  const controls=astroControls.parentElement;
  controls.insertBefore(button,astroControls);
  button.addEventListener('click',()=>{
   const opened=controls.classList.toggle('simple-settings-open');
   button.setAttribute('aria-expanded',String(opened));
   button.textContent=opened?'Tutup pengaturan ▴':'Pengaturan jam lanjut ▾';
  });
 }
 // Restore original Al-Biruni v1.5 unchanged: no automatic archival,
 // collapsed periods, hidden actions or injected alternate model.
 root.CebonkSimpleUi=Object.freeze({version:'1.0',mount});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})(window);
