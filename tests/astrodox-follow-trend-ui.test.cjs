'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const F=require('../assets/astrodox-follow-trend-core.js');
const ROOT=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(ROOT,'assets/astrodox-follow-trend-ui.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
assert.match(html,/id="tabAstroFollowTrend"/);
assert.match(html,/id="astroFollowTrendView"/);
assert.match(html,/astrodox-follow-trend-core\.js/);
assert.match(html,/astrodox-follow-trend-ui\.js/);
assert.match(html,/astrodox-follow-trend\.css/);
assert.ok(!/CebonkAlBiruni|CebonkMetalHistory|OrderSend|trade\.Buy|trade\.Sell|majority_direct/.test(ui),'panel must only read Astrology V1');
const dom=new JSDOM('<main><section id="astroFollowTrendView" hidden></section></main>',
 {url:'https://test.example/#astrodox-follow-trend',runScripts:'outside-only'});
const w=dom.window;
const sentinel={iso:'2026-10-14',samples:[]};
w.CEBONK_ASTRO_STATE=sentinel;
w.CebonkAlBiruni={sentinel:true};
w.Astronomy={stub:true};
const start=Date.UTC(2026,9,13,23,0,0);
let scanned=0,cleared=0,params=null;
const C={
 Time:{today:()=> '2026-10-14',
  parseDate:date=>{if(date!=='2026-10-14')throw Error('Tanggal invalid.');return Date.UTC(2026,9,14);},
  wib:ms=>({ms}),
  dateISO:p=>new Date(p.ms+7*3600000).toISOString().slice(0,10),
  hm:p=>new Date(p.ms+7*3600000).toISOString().slice(11,16)},
 CFG:{step:5,buy:1.15,sell:-1.15},
 createEngine:a=>{assert.equal(a,w.Astronomy);return {clear:()=>cleared++};},
 scan:async (engine,date,startMinute,enabled,progress,cancelled)=>{
  scanned++;params={date,startMinute,enabled};
  progress(30);
  assert.equal(cancelled(),false);
  return [2,2,2,2,0,-2,-2,-2].map((score,i)=>({ms:start+i*5*60000,score}));
 }
};
w.CebonkCore=C;
w.CebonkAstrodoxFollowTrend=F;
w.eval(ui);
const $=id=>w.document.getElementById(id);
assert.equal($('aftDate').value,'2026-10-14');
assert.equal($('aftConfirm').value,'3');
assert.match($('aftStatus').textContent,/Pilih tanggal/);
assert.match($('aftRun').textContent,/Hitung Follow Trend/);
assert.equal($('aftResult').hidden,true);
$('aftRun').click();
function done(){
 return new Promise((resolve,reject)=>{
  let i=0;
  const check=()=>{
   if($('aftResult').hidden===false)return resolve();
   if(++i>=40)return reject(Error('Timeout: result not displayed'));
   setTimeout(check,15);
  };
  check();
 });
}
(async()=>{
 await done();
 assert.deepEqual(params,{date:'2026-10-14',startMinute:360,enabled:true});
 assert.equal(scanned,1);
 assert.equal(cleared,1);
 assert.equal($('aftDirection').textContent,'BUY');
 assert.equal($('aftStart').textContent,'06:10');
 assert.equal($('aftCore').textContent,'06:10');
 assert.equal($('aftEnd').textContent,'06:20');
 assert.match($('aftBreakdown').textContent,/SELL 5 menit/);
 assert.match($('aftStatus').textContent,/status trading tetap WAIT/);
 assert.equal($('aftWindows').querySelectorAll('tr').length,2);
 assert.equal($('aftRows').querySelectorAll('tr').length,8);
 assert.equal(w.CEBONK_ASTRO_STATE,sentinel,'legacy data must stay untouched');
 assert.equal(w.CebonkAlBiruni.sentinel,true);
 $('aftConfirm').value='6';
 $('aftConfirm').dispatchEvent(new w.Event('change'));
 assert.equal($('aftResult').hidden,true,'parameter changes invalidate old results');
 $('aftRun').click();
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(scanned,2);
 assert.equal($('aftDirection').textContent,'WAIT','6-slot confirmation must reject short runs');
 assert.equal($('aftRows').querySelectorAll('tr').length,8);
 assert.ok(!w.CebonkAstrodoxFollowTrendUI.model.includes('ALBIRUNI'));
 dom.window.close();
 console.log('PASS ASTRODOX FOLLOW TREND UI: pure V1, original untouched, async scan and independent date/confirmation.');
})().catch(err=>{console.error(err);process.exitCode=1;dom.window.close();});
