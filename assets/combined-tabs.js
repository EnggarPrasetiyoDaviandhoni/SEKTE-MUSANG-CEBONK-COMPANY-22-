/* Navigation only. Never changes either trading model or its parameters. */
(function(root){
'use strict';
function mount(){
 const $=id=>document.getElementById(id),nav=document.querySelector('.viewtabs');if(!nav)return;
 const routes={astrology:['tabAstro','astroView'],'combined-1':['tabCombined','combinedView'],'combined-2':['tabCombined2','combined2View'],'astrology-news':['tabAstroNews','astroNewsView']};
 root.CebonkModeRegistry=Object.freeze({combined1:Object.freeze({route:'combined-1',view:'combinedView',engine:'CebonkCombined1',sourceRef:'3ead2e75c4b6f014e6fad163aaf6d05cef71c009'}),combined2:Object.freeze({route:'combined-2',view:'combined2View',engine:'CebonkAuto'})});
 function sync(route){
  if(!routes[route])return;
  for(const [key,[tab,id]] of Object.entries(routes)){if($(id))$(id).hidden=key!==route;$(tab)?.classList.toggle('active',key===route);}
  // News used to hide the old technical child. It is now optional detail inside C1.
  if(route==='combined-1'&&$('technicalView'))$('technicalView').hidden=false;
  try{history.replaceState(null,'','#'+route);}catch(e){}
 }
 nav.addEventListener('click',e=>{const id=e.target.closest('button')?.id;const route=Object.keys(routes).find(k=>routes[k][0]===id);if(route)sync(route);});
 root.addEventListener('hashchange',()=>{const route=location.hash.slice(1);if(routes[route])$(routes[route][0])?.click();});
 const css=document.createElement('style');css.id='combinedSplitStyle';css.textContent=`.viewtabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.viewtab{min-width:0;white-space:normal}#combinedView .tech-card{min-width:0}#combinedView .tech-card strong,#combinedView .tech-card small{overflow-wrap:anywhere}#combinedView .tech-status{flex-wrap:wrap}#combinedView .tech-grid{grid-template-columns:repeat(4,minmax(0,1fr))}#combinedView details .tech-grid{grid-template-columns:repeat(3,minmax(0,1fr))}#combinedView .hero{margin:0 0 14px}#combinedView .hero h2{margin:8px 0;font-size:25px}#combinedView #c1FeedStatus{font-size:12px;color:var(--muted)}#combinedView #comboDecision{font-size:23px}@media(max-width:760px){.viewtabs{grid-template-columns:repeat(2,minmax(0,1fr))}#combinedView .tech-grid,#combinedView details .tech-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#combinedView #techStage{font-size:17px}#combinedView #comboWindow{overflow-wrap:anywhere}}`;document.head.appendChild(css);
 sync(routes[location.hash.slice(1)]?location.hash.slice(1):'astrology');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
