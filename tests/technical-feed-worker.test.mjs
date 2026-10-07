import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('cloudflare-worker.js','utf8');
const W=(await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'))).default;

let mode='ok',calls=0,seenUrl='';
const store=new Map();
globalThis.caches={default:{
 async match(r){return store.get(r.url)?.clone()||null;},
 async put(r,v){store.set(r.url,v.clone());}
}};
globalThis.fetch=async u=>{
 calls++;seenUrl=u;const q=new URL(u),interval=q.searchParams.get('interval');
 if(mode==='network')throw new Error('SECRET_URL_SHOULD_NOT_LEAK');
 if(mode==='quota')return Response.json({status:'error',code:429,message:'SECRET_SENTINEL'});
 if(mode==='generic')return Response.json({status:'error',code:400,message:'SECRET_SENTINEL'});
 return Response.json({meta:{symbol:'XAU/USD',interval},values:[
  {datetime:'2026-10-07 06:10:00',open:'100',high:'102',low:'99',close:'101'},
  {datetime:'2026-10-07 06:11:00',open:'101',high:'103',low:'100',close:'102'}
 ]});
};
const env={TWELVE_DATA_KEY:'SECRET_SENTINEL'};
let waits=[];
const ctx={waitUntil(p){waits.push(Promise.resolve(p));}};
async function request(path){
 waits=[];const r=await W.fetch(new Request('https://unit.workers.dev'+path),env,ctx);
 await Promise.all(waits);return r;
}
function clear(){store.clear();mode='ok';calls=0;}
function dropFresh(){
 for(const k of [...store.keys()])if(k.includes('/xau?')&&!k.includes('/__backup/'))store.delete(k);
}
let passed=0;
async function t(name,fn){clear();await fn();passed++;console.log('PASS '+name);}

await t('provider error exposes safe code not raw message',async()=>{
 mode='generic';const r=await request('/xau?interval=1min&outputsize=300'),d=await r.json();
 assert.equal(r.status,502);assert.equal(d.error,'TWELVE_DATA_ERROR');assert.equal(d.providerCode,400);
 assert.ok(!JSON.stringify(d).includes('SECRET_SENTINEL'));
});
await t('quota classification exposes 429 safely',async()=>{
 mode='quota';const r=await request('/xau?interval=5min&outputsize=300'),d=await r.json();
 assert.equal(r.status,429);assert.equal(d.error,'UPSTREAM_QUOTA');assert.equal(d.providerCode,429);
});
await t('successful response seeds stale backup cache',async()=>{
 const r=await request('/xau?interval=1min&outputsize=300');assert.equal(r.status,200);
 assert.ok([...store.keys()].some(k=>k.includes('/__backup/xau?interval=1min')));
});
await t('upstream failure can return stale backup with diagnostics',async()=>{
 let r=await request('/xau?interval=1min&outputsize=300');assert.equal(r.status,200);
 dropFresh();mode='quota';r=await request('/xau?interval=1min&outputsize=300');const d=await r.json();
 assert.equal(r.status,200);assert.equal(d.ok,true);assert.equal(d.degraded,true);
 assert.equal(d.cacheState,'STALE_BACKUP');assert.equal(d.upstreamError,'UPSTREAM_QUOTA');assert.equal(d.upstreamCode,429);
 assert.ok(!JSON.stringify(d).includes('SECRET_SENTINEL'));
});
await t('network error stays fail closed without backup',async()=>{
 mode='network';const r=await request('/xau?interval=1min'),d=await r.json();
 assert.equal(r.status,502);assert.equal(d.error,'UPSTREAM_NETWORK_OR_TIMEOUT');
 assert.ok(!JSON.stringify(d).includes('SECRET_URL_SHOULD_NOT_LEAK'));
});
console.log('TECHNICAL_FEED_WORKER_TOTAL_PASS',passed);
