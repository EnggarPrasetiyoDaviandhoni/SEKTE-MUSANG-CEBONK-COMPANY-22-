/* CEBONK SITE VIEW ROUTER v1.0
 * Single display authority for website's primary analysis views.
 * Existing modules retain their own calculations and navigation callbacks.
 * Load LAST, after all feature scripts, to reconcile their partial hide lists.
 */
(function(root){
'use strict';
const TAB_TO_VIEW=Object.freeze({
 tabAstro:'astroView',
 tabAlBiruni:'albiruniPanel',
 tabAstroFollowTrend:'astroFollowTrendView',
 tabSolarReturnOnly:'solarReturnOnlyView',
 tabMoonCalendar:'moonCalendarView',
 tabAstrodoxAudit:'astrodoxAuditView',
 tabAstroNews:'astroNewsView',
 tabBazi:'baziView',
 tabTriple:'astroMonthlyView',
 tabChineseCalendar:'chineseCalendarView',
 tabCombined:'combinedView',
 tabCombined2:'combined2View'
});
const ROUTE_TO_TAB=Object.freeze({
 astrology:'tabAstro',
 'al-biruni':'tabAlBiruni',
 'astrodox-follow-trend':'tabAstroFollowTrend',
 'solar-return-only':'tabSolarReturnOnly',
 'kalender-fase-bulan':'tabMoonCalendar',
 'astrodox-audit':'tabAstrodoxAudit',
 'astrology-news':'tabAstroNews',
 'bazi-astrology':'tabBazi',
 'momen-astrology':'tabTriple',
 'triple-cycle':'tabTriple',
 'kalender-cina':'tabChineseCalendar',
 'chinese-calendar':'tabChineseCalendar',
 'combined-1':'tabCombined',
 'combined-2':'tabCombined2'
});
const TAB_TO_ROUTE=Object.freeze({
 tabAstro:'astrology',
 tabAlBiruni:'al-biruni',
 tabAstroFollowTrend:'astrodox-follow-trend',
 tabSolarReturnOnly:'solar-return-only',
 tabMoonCalendar:'kalender-fase-bulan',
 tabAstrodoxAudit:'astrodox-audit',
 tabAstroNews:'astrology-news',
 tabBazi:'bazi-astrology',
 tabTriple:'momen-astrology',
 tabChineseCalendar:'kalender-cina',
 tabCombined:'combined-1',
 tabCombined2:'combined-2'
});
const $=id=>document.getElementById(id);
let ready=false,active='tabAstro';
function render(tabId,writeHash=false){
 const selectedView=TAB_TO_VIEW[tabId];
 if(!selectedView||!$(selectedView))return false;
 active=tabId;
 for(const id of Object.values(TAB_TO_VIEW)){
  const view=$(id);
  if(view)view.hidden=id!==selectedView;
 }
 // Optional legacy C1 technical details; not a separate independent tab.
 for(const id of ['technicalView','bbmaScannerView','liquidityScannerView','pdfZonesView']){
  const view=$(id);
  if(view)view.hidden=!(id==='technicalView'&&tabId==='tabCombined');
 }
 const nav=document.querySelector('.viewtabs');
 if(nav)for(const tab of nav.querySelectorAll('button.viewtab')){
  const selected=tab.id===tabId;
  tab.classList.toggle('active',selected);
  tab.setAttribute('aria-selected',String(selected));
  if(TAB_TO_VIEW[tab.id])tab.setAttribute('aria-controls',TAB_TO_VIEW[tab.id]);
 }
 if(writeHash){
  const hash='#'+TAB_TO_ROUTE[tabId];
  if(root.location&&root.location.hash!==hash)try{root.history.replaceState(null,'',hash);}catch(e){/* navigation still works */}
 }
 return true;
}
function mount(){
 if(ready)return;
 const nav=document.querySelector('.viewtabs');
 if(!nav)return;
 ready=true;
 // Reconcile AFTER legacy delegated tab handlers: they currently know
 // incompatible subsets of page views, allowing Al-Biruni + BaZi together.
 nav.addEventListener('click',e=>{
  const tab=e.target.closest('button.viewtab');
  if(tab&&TAB_TO_VIEW[tab.id])render(tab.id,true);
 });
 root.addEventListener('hashchange',()=>{
  const target=ROUTE_TO_TAB[(root.location?.hash||'').replace(/^#/,'')];
  if(target)render(target,false);
 });
 const fromHash=ROUTE_TO_TAB[(root.location?.hash||'').replace(/^#/,'')];
 const selected=fromHash||[...nav.querySelectorAll('button.viewtab')]
  .find(tab=>tab.classList.contains('active')&&TAB_TO_VIEW[tab.id])?.id||'tabAstro';
 render(selected,false);
}
root.CebonkViewRouter=Object.freeze({render,tabToView:TAB_TO_VIEW});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})(window);
