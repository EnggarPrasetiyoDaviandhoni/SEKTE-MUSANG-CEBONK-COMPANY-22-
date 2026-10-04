'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(),T=Date.parse('2026-10-04T10:00:00Z'),H=3600000,D=24*H;
const server=http.createServer((req,res)=>{let f=path.join(root,new URL(req.url,'http://localhost').pathname);if(f===root+path.sep)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(f));}catch(e){res.writeHead(404).end();}});
function payload(interval){
 const step={'1min':60000,'5min':300000,'15min':900000,'1h':H,'4h':4*H,'1day':D,'1week':7*D}[interval];
 const values=Array.from({length:90},(_,i)=>{let ms;
  if(interval==='1month')ms=Date.UTC(2026,9-90+i,1);
  else {const end=interval==='1week'?Date.parse('2026-09-28T00:00:00Z'):Math.floor(T/step)*step;ms=end-(90-i)*step;}
  const p=100+i*.1+Math.sin(i*.8)*3;
  return {datetime:new Date(ms).toISOString().slice(0,19).replace('T',' '),open:p,high:p+1,low:p-1,close:p+.25};
 });
 return {ok:true,symbol:'XAU/USD',provider:'SYNTHETIC TEST ONLY',interval,timezone:'UTC',exchangeTimezone:'UTC',fetchedAtUtc:new Date(T).toISOString(),values};
}
(async()=>{
 await new Promise(r=>server.listen(8783,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];let failed=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(T=>{window.__testNow=T;const D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[window.__testNow]));}static now(){return window.__testNow;}};},T);
  await page.route('**/astronomy.browser.min.js',r=>r.abort());
  await page.route('**/xau?*',route=>{const interval=new URL(route.request().url()).searchParams.get('interval');requests.push(interval);const fail=failed&&interval==='1h';return route.fulfill({status:fail?502:200,contentType:'application/json',body:JSON.stringify(fail?{ok:false,error:'SYNTHETIC_NETWORK_FAILURE'}:payload(interval))});});
  await page.goto('http://127.0.0.1:8783/index.html#snr-snd',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('saState')?.textContent==='5/5 TF SIAP');
  assert.equal(await page.locator('#pdfZLow').isVisible(),false);
  assert.equal(await page.locator('#sndAutoPanel').isVisible(),true);
  for(const i of ['1month','1week','1day','4h','1h'])assert.ok(requests.includes(i));
  await page.evaluate(T=>{window.CEBONK_ASTRO_STATE={model:true,iso:'2026-10-04',groups:[{start:T-3600000,end:T+3600000,state:'BUY'}]};document.getElementById('dateInput').value='2026-10-04';document.getElementById('modelEnabled').checked=true;document.getElementById('results').dataset.stale='false';window.dispatchEvent(new Event('cebonk-astro-update'));},T);
  assert.ok((await page.locator('#saPrimary').innerText()).includes('BUY'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  fs.mkdirSync('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/snd-auto-mobile.png',fullPage:true});
  await page.click('#tabAstroNews');assert.equal(await page.locator('#astroNewsView').isVisible(),true);assert.equal(await page.locator('#sndAutoPanel').isVisible(),false);
  await page.click('#tabCombined2');assert.equal(await page.locator('#combined2View').isVisible(),true);assert.equal(await page.locator('#astroNewsView').isVisible(),false);
  await page.click('#tabZones');failed=true;
  await page.evaluate(()=>{window.__testNow+=70000;window.CEBONK_SND_AUTO_STATE.frames.H1.validUntil=0;});
  await page.click('#saScan');await page.waitForFunction(()=>document.getElementById('saState').textContent.includes('4/5'));
  assert.ok((await page.locator('#saWarning').innerText()).includes('SYNTHETIC_NETWORK_FAILURE'));
  await page.screenshot({path:'test-artifacts/snd-auto-partial-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS BROWSER: five automatic native TF requests, no manual prices, Astrology ranking, News/C2 navigation, partial error isolation, mobile overflow, no JS errors. SYNTHETIC DATA ONLY.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
