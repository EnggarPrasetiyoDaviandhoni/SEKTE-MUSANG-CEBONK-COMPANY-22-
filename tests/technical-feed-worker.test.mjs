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
function massiveRows(){
 const base=Date.parse('2026-10-07T06:00:00Z');
 return Array.from({length:12},(_,i)=>({t:base+i*60000,o:100+i,h:102+i,l:99+i,c:101+i,v:10+i}));
}
globalThis.fetch=async u=>{
 calls++;seenUrl=u;
 if(mode==='network')throw new Error('SECRET_URL_SHOULD_NOT_LEAK');
 if(mode==='quota')return Response.json({status:'ERROR',message:'SECRET_SENTINEL'},{status:429});
 if(mode==='generic')return Response.json({status:'ERROR',message:'SECRET_SENTINEL'},{status:200});
 if(mode==='unauthorized')return Response.json({status:'NOT_AUTHORIZED',message:'SECRET_SENTINEL'},{status:200});
 return Response.json({status:'OK',ticker:'C:XAUUSD',results:massiveRows()});
};
const env={MASSIVE_API_KEY:'SECRET_SENTINEL'};
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

await t('Massive provider error exposes safe status not raw message',async()=>{
 mode='generic';const r=await request('/xau?interval=1min&outputsize=300'),d=await r.json();
 assert.equal(r.status,502);assert.equal(d.error,'MASSIVE_DATA_ERROR');assert.equal(d.provider,'Massive');
 assert.ok(!JSON.stringify(d).includes('SECRET_SENTINEL'));
});
await t('quota classification exposes 429 safely',async()=>{
 mode='quota';const r=await request('/xau?interval=5min&outputsize=300'),d=await r.json();
 assert.equal(r.status,429);assert.equal(d.error,'UPSTREAM_QUOTA');
});
await t('access denial classification exposes no provider message',async()=>{
 mode='unauthorized';const r=await request('/xau?interval=15min'),d=await r.json();
 assert.equal(r.status,403);assert.equal(d.error,'UPSTREAM_ACCESS_DENIED');assert.ok(!JSON.stringify(d).includes('SECRET_SENTINEL'));
});
await t('successful response seeds stale backup cache',async()=>{
 const r=await request('/xau?interval=1min&outputsize=300'),d=await r.json();assert.equal(r.status,200);assert.equal(d.provider,'Massive');
 assert.equal(d.providerTicker,'C:XAUUSD');assert.ok([...store.keys()].some(k=>k.includes('/__backup/xau?interval=1min')));
});
await t('upstream failure can return stale backup with diagnostics',async()=>{
 let r=await request('/xau?interval=1min&outputsize=300');assert.equal(r.status,200);
 dropFresh();mode='quota';r=await request('/xau?interval=1min&outputsize=300');const d=await r.json();
 assert.equal(r.status,200);assert.equal(d.ok,true);assert.equal(d.degraded,true);
 assert.equal(d.cacheState,'STALE_BACKUP');assert.equal(d.upstreamError,'UPSTREAM_QUOTA');
 assert.ok(!JSON.stringify(d).includes('SECRET_SENTINEL'));
});
await t('network error stays fail closed without backup',async()=>{
 mode='network';const r=await request('/xau?interval=1min'),d=await r.json();
 assert.equal(r.status,502);assert.equal(d.error,'UPSTREAM_NETWORK_OR_TIMEOUT');
 assert.ok(!JSON.stringify(d).includes('SECRET_URL_SHOULD_NOT_LEAK'));
});
await t('secret is Massive only and Twelve Data removed',async()=>{
 const health=await request('/health'),d=await health.json();assert.equal(d.secretConfigured,true);assert.equal(d.provider,'Massive');
 assert.ok(!src.includes('TWELVE_DATA_KEY'));assert.ok(!src.includes('api.twelvedata.com'));assert.ok(src.includes('MASSIVE_API_KEY'));assert.ok(src.includes('api.massive.com'));
});
console.log('TECHNICAL_FEED_WORKER_TOTAL_PASS',passed);
