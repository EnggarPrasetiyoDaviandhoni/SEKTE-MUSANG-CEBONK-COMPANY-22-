'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const site=new JSDOM('<html><head></head><body><section id="albiruniPanel"><div class="ab-header"></div></section></body></html>',{url:'https://example.test/',runScripts:'outside-only'});
const w=site.window;
const now=Math.floor(Date.now()/1000),wibMs=Date.now()+7*3600000;
const date=new Date(wibMs).toISOString().slice(0,10);
const daySec=Date.parse(date+'T00:00:00Z')/1000-7*3600;
const header='model,date_wib,signal_id,direction,start_epoch,entry_epoch,core_epoch,end_epoch,valid_until_epoch,published_epoch,aspect,phase';
const row=['ALBIRUNI_INTRADAY_V1',date,'AB-'+date.replace(/-/g,'')+'-BUY-17917791728','BUY',
 daySec+9*3600,daySec+9*3600+900,daySec+11*3600,daySec+12*3600,daySec+12*3600,now-60,
 'Moon/Venus Konjungsi 0deg orb 1.049deg','APPLYING'].join(',');
const valid=header+'\n'+row+'\n';
let csv=valid;
w.fetch=async()=>({ok:true,text:async()=>csv});
w.eval(fs.readFileSync(path.join(__dirname,'..','assets/albiruni-feed-view.js'),'utf8'));
const api=w.CebonkAlBiruniFeedView;
assert.ok(api&&api.FEED_URL.includes('/main/ea/albiruni_intraday/data/intraday.csv'));
assert.equal(api.parseFeed(valid).direction,'BUY');
assert.equal(api.parseFeed(valid).date,date);
assert.throws(()=>api.parseFeed('bad header\n'+row),/Format CSV/);
assert.throws(()=>api.parseFeed(header+'\n'+row.replace(',BUY,',',UNKNOWN,')),/Model, tanggal atau arah/);
assert.equal(w.document.querySelectorAll('.ab-books-panel li').length,6);
const el=id=>w.document.querySelector('#'+id);
async function waitFor(fn){
 for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}
 throw Error('Timed out waiting for feed render');
}
(async()=>{
 await waitFor(()=>el('abLiveStatus').textContent.includes('CSV terbaca'));
 assert.equal(el('abLiveDirection').textContent,'BUY');
 assert.match(el('abLiveEntry').textContent,/WIB/);
 assert.match(el('abLiveBasis').textContent,/GitHub RAW CSV/);
 csv=valid.replace(',BUY,',',UNKNOWN,');
 el('abLiveRefresh').click();
 await waitFor(()=>el('abLiveStatus').textContent.includes('TIDAK ADA SINYAL'));
 assert.equal(el('abLiveDirection').textContent,'—','malformed CSV must fail closed');
 site.window.close();
 console.log('PASS: same-CSV website/EA source, six-book references, BUY display, malformed CSV fail-closed');
})().catch(e=>{console.error(e);process.exitCode=1;});
