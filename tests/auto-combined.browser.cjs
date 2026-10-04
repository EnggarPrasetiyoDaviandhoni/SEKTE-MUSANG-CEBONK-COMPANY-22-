'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve('.'),NOW=Date.parse('2026-10-05T12:30:01Z');let mode='ok';
const data=interval=>{
 const steps={'1min':60000,'5min':300000,'15min':900000,'1h':3600000,'4h':14400000};
 const values=[];for(let i=0;i<80;i++){
  let t;if(steps[interval])t=Math.floor(NOW/steps[interval])*steps[interval]-(80-i)*steps[interval];
  else if(interval==='1month')t=Date.UTC(2026,9-(80-i),1);
  else if(interval==='1week')t=Date.UTC(2026,9,5)-(80-i)*7*86400000;
  else t=Date.UTC(2026,9,5)-(80-i)*86400000;
  const o=4000+Math.sin(i/4)*4,c=o+Math.cos(i)*0.1;
  values.push({datetime:new Date(t).toISOString().slice(0,steps[interval]?19:10).replace('T',' '),open:o,high:Math.max(o,c)+0.5,low:Math.min(o,c)-0.5,close:c});
 }
 return {ok:true,provider:'SYNTHETIC TEST FIXTURE',symbol:'XAU/USD',interval,timezone:'UTC',calendarTimezone:'UTC',values};
};
const server=http.createServer((req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://x').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end('Not found');}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(n=>{window.__mockNow=n;Date.now=()=>window.__mockNow;},NOW);
 const lib=path.join(path.dirname(require.resolve('astronomy-engine')),'astronomy.browser.min.js');assert.ok(fs.existsSync(lib));
 await page.route('**/astronomy.browser.min.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(lib,'utf8')}));
 await page.route('**/*.workers.dev/**',route=>{
  const q=new URL(route.request().url()),i=q.searchParams.get('interval');
  if(mode==='legacy'&&['1day','1week','1month'].includes(i))return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,error:'INVALID_INTERVAL'})});
  if(mode==='failure'&&i==='1min')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'TEST_OUTAGE'})});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data(i))});
 });
 fs.mkdirSync('test-artifacts',{recursive:true});
 await page.goto(url+'/#combined-1');await page.waitForFunction(()=>document.getElementById('autoStatus')?.textContent.includes('Scan rampung'),{timeout:30000});
 assert.deepEqual(await page.locator('.viewtab').allTextContents(),['ASTROLOGY','COMBINED 1','ASTROLOGY NEWS']);
 assert.equal(await page.locator('#tabTechnical,#tabCombined2,#tabZones,#pdfZonesView,#technicalView').count(),0);
 assert.equal(await page.locator('#combinedView input[type=number],#combinedView input[type=text]').count(),0);
 assert.ok((await page.locator('#autoCoverage').textContent()).includes('5/5'));
 assert.ok(!(await page.locator('#autoWarning').isVisible()));
 assert.equal(await page.evaluate(()=>window.CEBONK_AUTO_STATE.executionEnabled),false);
 await page.screenshot({path:'test-artifacts/mobile-auto-combined.png',fullPage:true});
 await page.locator('#tabAstroNews').click();assert.equal(await page.locator('#astroNewsView').isVisible(),true);assert.equal(await page.locator('#combinedView').isVisible(),false);
 await page.locator('#tabAstro').click();assert.equal(await page.locator('#astroView').isVisible(),true);
 await page.locator('#tabCombined').click();assert.equal(await page.locator('#combinedView').isVisible(),true);assert.equal(await page.locator('#astroNewsView').isVisible(),false);
 mode='legacy';await page.reload();await page.waitForFunction(()=>document.getElementById('autoStatus')?.textContent.includes('Scan rampung'));
 assert.ok((await page.locator('#autoCoverage').textContent()).includes('2/5'));
 assert.ok((await page.locator('#autoWarning').textContent()).includes('Worker lawas'));
 await page.screenshot({path:'test-artifacts/mobile-partial-api.png',fullPage:true});
 mode='failure';await page.reload();await page.waitForFunction(()=>document.getElementById('autoStatus')?.textContent.includes('Scan rampung'));
 assert.equal(await page.locator('#autoDecision').textContent(),'WAIT');assert.equal(await page.locator('#autoEntry').textContent(),'—');
 await page.setViewportSize({width:1280,height:800});await page.screenshot({path:'test-artifacts/desktop-fail-closed.png',fullPage:true});
 assert.deepEqual(errors,[],'No uncaught browser exceptions');
 console.log('BROWSER_PASS: 3 tabs; no manual prices; all TF / partial TF; Astro & News navigation; failure WAIT. Synthetic data only.');
 await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1);});
