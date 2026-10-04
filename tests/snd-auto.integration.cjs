'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function main(){
 let n=0;const pass=s=>{console.log('PASS '+s);n++;};
 const source=fs.readFileSync('cloudflare-worker.js','utf8').replace('export default','globalThis.worker =');
 const store=new Map(),jobs=[];let calls=0,upstream=null,networkFail=false;
 const sandbox={URL,Request,Response,AbortController,setTimeout,clearTimeout,caches:{default:{match:async key=>store.get(key.url)?.clone(),put:async(key,res)=>{store.set(key.url,res.clone());}}},fetch:async()=>{calls++;if(networkFail)throw Error('TEST_SECRET_LEAK');return new Response(JSON.stringify(upstream),{status:200});}};
 vm.runInNewContext(source,sandbox);const worker=sandbox.worker,env={TWELVE_DATA_KEY:'UNIT_TEST_SECRET_NOT_REAL'},ctx={waitUntil:p=>jobs.push(p)};
 const req=path=>new Request('https://example.workers.dev'+path);
 let r=await worker.fetch(req('/health'),env,ctx),j=await r.json();assert.equal(j.htfEnabled,true);assert.ok(j.intervals.includes('1month'));pass('health advertises native HTF without secret');
 assert.ok(!JSON.stringify(j).includes(env.TWELVE_DATA_KEY));assert.equal(calls,0);pass('health no paid data request');
 r=await worker.fetch(req('/xau?interval=1month'),{},ctx);assert.equal(r.status,503);pass('missing key fails closed');
 r=await worker.fetch(req('/xau?interval=1day&random=42'),env,ctx);assert.equal(r.status,400);pass('cache fragmentation query rejected');
 r=await worker.fetch(req('/xau?interval=1h&outputsize=1x'),env,ctx);assert.equal(r.status,400);pass('invalid count rejected');
 r=await worker.fetch(new Request('https://example.workers.dev/xau',{headers:{Origin:'https://untrusted.example'}}),env,ctx);assert.equal(r.status,403);pass('foreign browser origin rejected; not API authentication');
 for(const interval of ['1min','5min','15min','1h','4h','1day','1week','1month']){
  upstream={meta:{symbol:'XAU/USD',interval,exchange_timezone:'Australia/Sydney'},values:[{datetime:'2026-09-01',open:'100',high:'102',low:'99',close:'101'}]};
  r=await worker.fetch(req('/xau?interval='+interval),env,ctx);j=await r.json();assert.equal(j.ok,true);assert.equal(j.timezone,['1day','1week','1month'].includes(interval)?'Australia/Sydney':'UTC');
  assert.ok(!JSON.stringify(j).includes(env.TWELVE_DATA_KEY));pass('native '+interval+' and correct timezone contract');
 }
 await Promise.all(jobs);const before=calls;r=await worker.fetch(req('/xau?interval=1month'),env,ctx);assert.equal(calls,before);pass('cache hit avoids upstream request');
 upstream={status:'error',code:429,message:'API KEY '+env.TWELVE_DATA_KEY};r=await worker.fetch(req('/xau?interval=1day&outputsize=301'),env,ctx);j=await r.json();assert.equal(r.status,429);assert.ok(!JSON.stringify(j).includes(env.TWELVE_DATA_KEY));pass('rate limit not leaked or fabricated data');
 networkFail=true;r=await worker.fetch(req('/xau?interval=1h&outputsize=301'),env,ctx);assert.equal(r.status,502);assert.ok(!(await r.text()).includes('TEST_SECRET_LEAK'));pass('network error sanitized');
 const N=require('../assets/snd-auto-core.js'),K=require('../assets/musang-pdf-core.js');
 const box={CebonkSNDAuto:N,CebonkMusangPDF:K};vm.runInNewContext(fs.readFileSync('assets/snd-auto-ui.js','utf8'),box);
 assert.equal(box.CebonkMusangPDF.evaluate,K.evaluate);assert.equal(box.CebonkMusangPDF.detect,K.detect);pass('PDF detector and verifier untouched');
 const T=Date.parse('2026-10-02T12:30:00Z'),now=T+5000,a={model:true,groups:[{start:T-3600000,end:T+3600000,state:'BUY'}]},r0={stage:'RETEST_VALID',reason:'unit fixture',eventMs:T,entry:100,setup:{direction:'BUY',tf:'M1'}};
 const manual=[{tf:'H4',kind:'DEMAND',low:99,high:101,note:'manual legacy',createdAt:T-1000000,verified:true,active:true}];
 let c=box.CebonkMusangPDF.combine(r0,a,manual,now,true);assert.equal(c.one,'ENTRY BUY');assert.equal(c.two,'WAIT');pass('manual zone cannot bypass automatic scanner');
 box.CEBONK_SND_AUTO_STATE.frames.H1={ok:true,validUntil:T+3600000,zones:[{id:'z',tf:'H1',kind:'DEMAND',direction:'BUY',low:99,high:101,status:'FRESH',createdAt:T-120000,scale:2,note:'auto'}]};
 c=box.CebonkMusangPDF.combine(r0,a,[],now,true);assert.equal(c.two,'ENTRY BUY');pass('Combined 2 receives automatic searah zone');
 c=box.CebonkMusangPDF.combine(r0,a,[],now,false);assert.equal(c.one,'WAIT');assert.equal(c.two,'WAIT');pass('stale Musang blocks both modes');
 box.CEBONK_SND_AUTO_STATE.frames.H1.zones.push({id:'opp',tf:'H1',kind:'SUPPLY',direction:'SELL',low:99,high:101,status:'FRESH',createdAt:T-120000,scale:2,note:'auto'});
 c=box.CebonkMusangPDF.combine(r0,a,[],now,true);assert.equal(c.two,'WAIT');assert.equal(c.one,'ENTRY BUY');pass('opposite location blocks C2, C1 unchanged');
 console.log('INTEGRATION_TOTAL_PASS',n);
}
main().catch(e=>{console.error(e);process.exit(1);});
