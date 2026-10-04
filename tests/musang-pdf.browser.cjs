'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {b,api,T,M}=require('./musang-pdf.test.cjs');
const prefix=Array.from({length:35},(_,i)=>({ms:T-(35-i)*M,open:112,high:113,low:111,close:112}));
const short=api([...prefix,...b.slice(0,10)]),full=api([...prefix,...b]);
const root=process.cwd();
const server=http.createServer((req,res)=>{let f=path.join(root,new URL(req.url,'http://localhost').pathname);if(f===root+path.sep)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}try{const ext=path.extname(f);res.setHeader('Content-Type',ext==='.html'?'text/html':ext==='.css'?'text/css':'application/javascript');res.end(fs.readFileSync(f));}catch(e){res.writeHead(404);res.end('Not found');}});
(async()=>{
 await new Promise(r=>server.listen(8782,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(now=>{window.__testNow=now;const D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[window.__testNow]));}static now(){return window.__testNow;}};},T+10*M+30000);
  await page.route('**/astronomy.browser.min.js',route=>route.abort());
  let all=false,failed=false;
  await page.route('**/xau?*',route=>route.fulfill({status:failed?502:200,contentType:'application/json',body:JSON.stringify(failed?{ok:false,error:'TEST_NETWORK_FAILURE'}:all?full:short)}));
  await page.goto('http://127.0.0.1:8782/index.html',{waitUntil:'domcontentloaded'});
  await page.click('#tabTechnical');await page.waitForFunction(()=>document.querySelector('#pdfFeed').textContent==='OHLC TERBARU');
  await page.check('#pdfSign');await page.check('#pdfZonesOK');await page.check('#pdfAnchors');await page.click('#pdfVerify');
  assert.equal(await page.locator('#pdfStage').innerText(),'WAIT_RETEST');
  await page.click('#tabZones');await page.selectOption('#pdfZTF','H4');await page.fill('#pdfZLow','101');await page.fill('#pdfZHigh','104');await page.fill('#pdfZNote','Synthetic test fixture, not market');await page.check('#pdfZVerified');await page.click('#pdfZAdd');
  await page.evaluate(({T,M})=>{window.__testNow=T+12*M+5000;window.CEBONK_ASTRO_STATE={iso:'2026-10-02',model:true,mode:'AUTO',start:360,groups:[{start:T,end:T+20*M,state:'BUY'}]};document.getElementById('results').dataset.stale='false';},{T,M});
  all=true;await page.click('#tabCombined');await page.click('#pdfC1Refresh');await page.waitForFunction(()=>document.getElementById('pdfC1Decision').textContent==='ENTRY BUY');
  await page.click('#tabCombined2');assert.equal(await page.locator('#pdfC2Decision').innerText(),'ENTRY BUY');
  await page.click('#tabZones');await page.locator('[data-zone]').first().click();await page.click('#tabCombined2');assert.equal(await page.locator('#pdfC2Decision').innerText(),'WAIT');await page.click('#tabCombined');assert.equal(await page.locator('#pdfC1Decision').innerText(),'ENTRY BUY');
  await page.click('#tabAstroNews');assert.equal(await page.locator('#astroNewsView').isVisible(),true);assert.equal(await page.locator('#combinedView').isVisible(),false);
  await page.click('#tabCombined2');assert.equal(await page.locator('#astroNewsView').isVisible(),false);
  await page.evaluate(now=>window.__testNow=now,T+14*M);failed=true;await page.click('#pdfC2Refresh');await page.waitForFunction(()=>document.getElementById('pdfFeed').textContent==='ERROR');
  assert.equal(await page.locator('#pdfC1Decision').innerText(),'WAIT');assert.equal(await page.locator('#pdfC2Decision').innerText(),'WAIT');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  fs.mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/combined2-wait-mobile.png',fullPage:true});
  await page.click('#tabTechnical');await page.screenshot({path:'test-artifacts/musang-review-mobile.png',fullPage:true});
  console.log('PASS browser: review/chronology, C1/C2 separation, HTF gate, actual News navigation, error reset, mobile overflow, JS errors');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
