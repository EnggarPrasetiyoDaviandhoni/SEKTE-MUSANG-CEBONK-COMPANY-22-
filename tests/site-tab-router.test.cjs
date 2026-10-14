'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const ROOT=path.resolve(__dirname,'..');
const tabs={
 tabAstro:'astroView',
 tabAlBiruni:'albiruniPanel',
 tabAstroFollowTrend:'astroFollowTrendView',
 tabAstroNews:'astroNewsView',
 tabBazi:'baziView',
 tabTriple:'astroMonthlyView',
 tabChineseCalendar:'chineseCalendarView',
 tabCombined:'combinedView',
 tabCombined2:'combined2View'
};
function build(hash=''){
 const html='<main class="wrap"><nav class="viewtabs">'+
  Object.keys(tabs).map(id=>'<button type="button" id="'+id+'" class="viewtab">'+id+'</button>').join('')+
  '</nav><div id="astroView"></div><section id="albiruniPanel" hidden></section>'+
  Object.values(tabs).filter(id=>!['astroView','albiruniPanel'].includes(id))
   .map(id=>'<section id="'+id+'" hidden></section>').join('')+
  '<section id="technicalView" hidden></section></main>';
 const dom=new JSDOM(html,{url:'https://example.test/'+hash,runScripts:'outside-only'});
 const {window:w}=dom;
 const nav=w.document.querySelector('.viewtabs');
 // Mimic existing independent modules that fail to hide other views.
 nav.addEventListener('click',e=>{
  if(e.target.id==='tabAlBiruni')w.document.getElementById('baziView').hidden=false;
  if(e.target.id==='tabBazi')w.document.getElementById('albiruniPanel').hidden=false;
  if(e.target.id==='tabChineseCalendar')w.document.getElementById('astroView').hidden=false;
 });
 w.eval(fs.readFileSync(path.join(ROOT,'assets/site-tab-router.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return dom;
}
function assertOnly(w,tabId){
 const expected=tabs[tabId],all=Object.values(tabs);
 assert.ok(w.document.getElementById(expected),'missing '+expected);
 for(const id of all)assert.equal(w.document.getElementById(id).hidden,id!==expected,tabId+' must isolate '+id);
 const selected=w.document.querySelectorAll('.viewtab.active');
 assert.equal(selected.length,1);
 assert.equal(selected[0].id,tabId);
 assert.equal(selected[0].getAttribute('aria-selected'),'true');
}
function main(){
 const doc=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 assert.ok(doc.includes('<section id="albiruniPanel" aria-labelledby="abTitle" hidden>'));
 assert.ok(doc.indexOf('<section id="albiruniPanel"')>doc.indexOf('</div>\n<section id="albiruniPanel"'));
 assert.ok(doc.indexOf('assets/site-tab-router.js?v=1.0.0')>doc.indexOf('assets/albiruni-original-v1-5-ui.js?'));
 const dom=build(),w=dom.window;
 assertOnly(w,'tabAstro');
 for(const id of Object.keys(tabs)){
  w.document.getElementById(id).click();
  assertOnly(w,id);
  assert.equal(w.location.hash,'#'+({
   tabAstro:'astrology',tabAlBiruni:'al-biruni',tabAstroFollowTrend:'astrodox-follow-trend',tabAstroNews:'astrology-news',
   tabBazi:'bazi-astrology',tabTriple:'momen-astrology',
   tabChineseCalendar:'kalender-cina',tabCombined:'combined-1',tabCombined2:'combined-2'
  })[id]);
 }
 w.document.getElementById('tabAlBiruni').click();
 assertOnly(w,'tabAlBiruni');
 w.document.getElementById('tabBazi').click();
 assertOnly(w,'tabBazi');
 w.document.getElementById('tabAlBiruni').click();
 assertOnly(w,'tabAlBiruni');
 dom.window.close();
 const direct=build('#al-biruni');
 assertOnly(direct.window,'tabAlBiruni');
 direct.window.close();
 const trend=build('#astrodox-follow-trend');
 assertOnly(trend.window,'tabAstroFollowTrend');
 trend.window.close();
 const deep=build('#bazi-astrology');
 assertOnly(deep.window,'tabBazi');
 deep.window.close();
 console.log('PASS: Al-Biruni and BaZi never share view, all 9 tabs including follow trend, route hashes, broken legacy listeners.');
}
main();
