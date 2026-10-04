'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{b,m,M,T}=require('./combined-split.test.cjs');
const NOW=T+16*M+1000,root=process.cwd();let failure=false;const calls=[];
const out=(bars,interval)=>({ok:true,symbol:'XAU/USD',interval,timezone:'UTC',calendarTimezone:'UTC',provider:'SYNTHETIC TEST ONLY',fetchedAtUtc:new Date(NOW).toISOString(),values:bars.map(c=>({datetime:new Date(c.ms).toISOString().slice(0,19).replace('T',' '),open:c.open,high:c.high,low:c.low,close:c.close}))});
function data(interval){
 if(interval==='1min')return out(b,interval);
 const minutes={'5min':5,'15min':15,'1h':60,'4h':240};
 if(minutes[interval]){const step=minutes[interval]*M;return out(m.map((c,i)=>({...c,ms:Math.floor(NOW/step)*step-(m.length-i)*step})),interval);}
 const native=Array.from({length:80},(_,i)=>{let ms;if(interval==='1month')ms=Date.UTC(2026,9-80+i,1);else ms=Date.UTC(2026,9,5)-(80-i)*(interval==='1week'?7:1)*86400000;const v=112+Math.sin(i);return {ms,open:v,high:v+1,low:v-1,close:v+.1};});return out(native,interval);
}
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,f=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!f.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(f));}catch(e){res.statusCode=404;res.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(t=>{window.__clock=t;Date.now=()=>window.__clock;},NOW);
  const lib=path.join(path.dirname(require.resolve('astronomy-engine')),'astronomy.browser.min.js');
  await page.route('**/astronomy.browser.min.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(lib,'utf8')}));
  await page.route('**/*.workers.dev/**',r=>{const interval=new URL(r.request().url()).searchParams.get('interval');calls.push(interval);return r.fulfill({status:failure&&interval==='1min'?503:200,contentType:'application/json',body:JSON.stringify(failure&&interval==='1min'?{ok:false,error:'TEST_OUTAGE'}:data(interval))});});
  await page.goto(url+'/#combined-1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.CEBONK_C1_TECH_STATE&&window.CEBONK_ASTRO_STATE&&!document.getElementById('runBtn').disabled);
  assert.deepEqual(await page.locator('.viewtab').allTextContents(),['ASTROLOGY','COMBINED 1','COMBINED 2','ASTROLOGY NEWS']);
  assert.equal(await page.locator('#combinedView').isVisible(),true);assert.equal(await page.locator('#combined2View').isVisible(),false);
  assert.ok(calls.includes('1min')&&calls.includes('5min')&&calls.includes('15min'));assert.ok(!calls.includes('1month'));
  await page.evaluate(({T,M})=>{window.CEBONK_ASTRO_STATE={iso:'2026-10-05',model:true,groups:[{state:'SELL',start:T-120*M,end:T+120*M}]};document.getElementById('dateInput').value='2026-10-05';document.getElementById('modelEnabled').checked=true;document.getElementById('results').dataset.stale='false';window.dispatchEvent(new Event('cebonk-astro-update'));},{T,M});
  await page.waitForFunction(()=>document.getElementById('comboDecision').textContent==='ENTRY SELL');
  assert.equal(await page.evaluate(()=>window.CEBONK_C1_TECH_STATE.trend5.direction),'SELL');assert.equal(await page.evaluate(()=>window.CEBONK_C1_TECH_STATE.trend15.direction),'SELL');
  fs.mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/combined1-restored-mobile.png',fullPage:true});
  const oldState=await page.evaluate(()=>JSON.stringify(window.CEBONK_C1_TECH_STATE));
  await page.click('#tabCombined2');await page.waitForFunction(()=>document.getElementById('autoStatus').textContent.includes('Scan rampung'));
  assert.equal(await page.locator('#combined2View').isVisible(),true);assert.equal(await page.locator('#combinedView').isVisible(),false);
  assert.ok((await page.locator('#autoCoverage').innerText()).includes('5/5'));assert.equal(await page.evaluate(()=>JSON.stringify(window.CEBONK_C1_TECH_STATE)),oldState);
  assert.equal(await page.evaluate(()=>window.CEBONK_C2_STATE.mode),'COMBINED_2');
  await page.screenshot({path:'test-artifacts/combined2-independent-mobile.png',fullPage:true});
  await page.click('#tabAstroNews');assert.equal(await page.locator('#astroNewsView').isVisible(),true);assert.equal(await page.locator('#combined2View').isVisible(),false);
  await page.click('#tabCombined');assert.equal(await page.locator('#combinedView').isVisible(),true);assert.equal(await page.locator('#astroNewsView').isVisible(),false);assert.equal(await page.locator('#comboDecision').innerText(),'ENTRY SELL');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const newBefore=await page.evaluate(()=>JSON.stringify(window.CEBONK_C2_STATE));
  failure=true;await page.evaluate(()=>window.__clock+=70000);await page.click('#c1Refresh');await page.waitForFunction(()=>document.getElementById('techFeed').textContent==='ERROR');
  assert.equal(await page.locator('#comboDecision').innerText(),'WAIT');assert.equal(await page.locator('#comboEntry').innerText(),'—');assert.equal(await page.evaluate(()=>JSON.stringify(window.CEBONK_C2_STATE)),newBefore);
  await page.evaluate(()=>{location.hash='combined-2';});await page.waitForFunction(()=>!document.getElementById('combined2View').hidden);
  await page.click('#tabAstro');assert.equal(await page.locator('#astroView').isVisible(),true);assert.equal(await page.locator('#combinedView').isVisible(),false);
  await page.setViewportSize({width:1280,height:800});await page.click('#tabCombined');await page.screenshot({path:'test-artifacts/combined1-error-desktop.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('BROWSER PASS: original C1 signal without SND; independent C2; four routes; no duplicate ids; stale/error UI guard; responsive mobile. Synthetic data only.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
