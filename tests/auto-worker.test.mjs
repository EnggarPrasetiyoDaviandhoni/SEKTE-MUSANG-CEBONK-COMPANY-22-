import assert from 'node:assert/strict';
import W from '../worker/auto-sop-v3.mjs';

let passed=0,calls=0,mode='ok',seenUrl='';
const store=new Map();
globalThis.caches={default:{
 async match(r){return store.get(r.url)?.clone()},
 async put(r,v){store.set(r.url,v.clone())}
}};
function rowsFor(url){
 const u=new URL(url),parts=u.pathname.split('/');
 const timespan=parts[parts.indexOf('range')+2];
 const step=timespan==='hour'?3600000:timespan==='minute'?60000:86400000;
 const base=Date.parse('2026-10-07T00:00:00Z');
 return Array.from({length:8},(_,i)=>({t:base+i*step,o:100+i,h:102+i,l:99+i,c:101+i,v:10+i}));
}
globalThis.fetch=async u=>{
 calls++;seenUrl=u;
 if(mode==='network')throw new Error('key must not leak');
 if(mode==='quota')return Response.json({status:'ERROR',message:'SECRET_SENTINEL'},{status:429});
 if(mode==='unauthorized')return Response.json({status:'NOT_AUTHORIZED',message:'SECRET_SENTINEL'},{status:200});
 if(mode==='generic')return Response.json({status:'ERROR',message:'SECRET_SENTINEL'},{status:200});
 if(mode==='empty')return Response.json({status:'OK',ticker:'C:XAUUSD',results:[]});
 const rows=rowsFor(u);if(mode==='bad')rows[0].c=null;
 return Response.json({status:'OK',ticker:'C:XAUUSD',results:rows});
};
const env={MASSIVE_API_KEY:'SECRET_SENTINEL'};
const ctx={waitUntil:p=>p};
const request=(path,extra={})=>W.fetch(new Request('https://unit.workers.dev'+path,extra),env,ctx);
async function t(name,fn){store.clear();mode='ok';await fn();passed++;console.log('PASS '+name);}

await t('Health exposes Massive capabilities not key',async()=>{
 const r=await request('/health'),s=await r.text(),d=JSON.parse(s);
 assert.ok(!s.includes(env.MASSIVE_API_KEY));assert.equal(d.provider,'Massive');assert.equal(d.providerTicker,'C:XAUUSD');assert.equal(d.apiVersion,4);assert.ok(d.intervals.includes('1month'));
});
await t('Massive XAUUSD aggregate endpoint and secret are upstream only',async()=>{
 await request('/xau?interval=5min&outputsize=300');const u=new URL(seenUrl);
 assert.ok(u.pathname.includes('/v2/aggs/ticker/C:XAUUSD/range/5/minute/'));
 assert.equal(u.searchParams.get('apiKey'),env.MASSIVE_API_KEY);assert.equal(u.searchParams.get('sort'),'desc');
});
await t('H4 is built from H1 and UTC-resampled',async()=>{
 const r=await request('/xau?interval=4h&outputsize=50'),d=await r.json(),u=new URL(seenUrl);
 assert.ok(u.pathname.includes('/range/1/hour/'));assert.equal(d.interval,'4h');assert.equal(d.values.length,2);
 assert.equal(d.values[0].datetime,'2026-10-07T00:00:00.000Z');assert.equal(d.values[1].datetime,'2026-10-07T04:00:00.000Z');
});
await t('Monthly uses native Massive month aggregate',async()=>{
 await request('/xau?interval=1month&outputsize=120');assert.ok(new URL(seenUrl).pathname.includes('/range/1/month/'));
});
await t('Bad OHLC fails closed',async()=>{mode='bad';const r=await request('/xau?interval=1day');assert.equal(r.status,200);});
await t('Empty Massive response fails closed',async()=>{mode='empty';assert.equal((await request('/xau?interval=1min')).status,502);});
await t('Outputsize capped',async()=>{await request('/xau?interval=1min&outputsize=9000');assert.ok(Number(new URL(seenUrl).searchParams.get('limit'))<=50000);});
await t('Unknown query cannot force cache miss',async()=>{const n=calls;await request('/xau?interval=1min&outputsize=300&x=1');await request('/xau?interval=1min&outputsize=300&x=2');assert.equal(calls-n,1);});
await t('Invalid interval rejected',async()=>assert.equal((await request('/xau?interval=bad')).status,400));
await t('Malformatted size rejected',async()=>assert.equal((await request('/xau?outputsize=NaN')).status,400));
await t('Quota failure redacts upstream message',async()=>{mode='quota';const r=await request('/xau');assert.equal(r.status,429);assert.ok(!(await r.text()).includes('SECRET_SENTINEL'));});
await t('Unauthorized Massive plan is classified',async()=>{mode='unauthorized';const r=await request('/xau');assert.equal(r.status,403);assert.equal((await r.json()).error,'UPSTREAM_ACCESS_DENIED');});
await t('Generic provider failure is classified',async()=>{mode='generic';const r=await request('/xau');assert.equal(r.status,502);assert.equal((await r.json()).error,'MASSIVE_DATA_ERROR');});
await t('Network failure redacts URL',async()=>{mode='network';const r=await request('/xau');assert.equal(r.status,502);assert.ok(!(await r.text()).includes('key'));});
await t('Different browser origin rejected',async()=>assert.equal((await request('/xau',{headers:{Origin:'https://elsewhere.test'}})).status,403));
console.log('WORKER_TOTAL_PASS',passed);
