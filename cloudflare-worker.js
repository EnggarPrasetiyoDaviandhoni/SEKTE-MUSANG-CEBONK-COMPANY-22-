/* AUTO_SOP_API_V4 | Massive Currencies provider.
   Public read-only XAU/USD proxy for GitHub Pages scanners.
   Provider ticker: C:XAUUSD. Secret: MASSIVE_API_KEY.
   Response schema remains backward-compatible with the web scanner. */
const ORIGIN='https://enggarprasetiyodaviandhoni.github.io';
const PROVIDER='Massive';
const TICKER='C:XAUUSD';
const INTERVALS=['1min','5min','15min','30min','45min','1h','2h','4h','1day','1week','1month'];
const TTL={'1min':60,'5min':120,'15min':300,'30min':600,'45min':600,'1h':900,'2h':1800,'4h':1800,'1day':14400,'1week':21600,'1month':43200};
const BACKUP_TTL=86400;
const SPEC={
 '1min':{m:1,s:'minute',step:60000},
 '5min':{m:5,s:'minute',step:300000},
 '15min':{m:15,s:'minute',step:900000},
 '30min':{m:30,s:'minute',step:1800000},
 '45min':{m:15,s:'minute',step:900000,resample:2700000},
 '1h':{m:1,s:'hour',step:3600000},
 '2h':{m:1,s:'hour',step:3600000,resample:7200000},
 '4h':{m:1,s:'hour',step:3600000,resample:14400000},
 '1day':{m:1,s:'day',step:86400000},
 '1week':{m:1,s:'week',step:604800000},
 '1month':{m:1,s:'month',step:2678400000}
};
const flight=new Map();
function headers(extra={}){return {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','X-Content-Type-Options':'nosniff',...extra};}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:headers(extra)});}
function isoDay(ms){return new Date(ms).toISOString().slice(0,10);}
function etDay(ms){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
 const get=t=>parts.find(x=>x.type===t)?.value||'';
 return get('year')+'-'+get('month')+'-'+get('day');
}
function providerLimit(interval,size){const x=SPEC[interval];return Math.min(50000,Math.max(50,size*(x.resample?Math.ceil(x.resample/x.step):1)+8));}
function dateRange(interval,limit,now=Date.now()){
 const x=SPEC[interval],factor=['minute','hour'].includes(x.s)?3:2;
 const span=Math.max(3*86400000,x.step*limit*factor);
 return {from:isoDay(now-span),to:isoDay(now)};
}
function safeProviderError(res,data){
 const providerStatus=typeof data?.status==='string'?data.status:'';
 const access=[401,403].includes(res.status)||providerStatus==='NOT_AUTHORIZED';
 const quota=res.status===429||providerStatus==='RATE_LIMITED';
 const status=quota?429:access?403:502;
 const error=quota?'UPSTREAM_QUOTA':access?'UPSTREAM_ACCESS_DENIED':'MASSIVE_DATA_ERROR';
 return json({ok:false,error,provider:PROVIDER,providerCode:providerStatus||res.status,upstreamHttpStatus:res.status,retryAfterSeconds:quota?300:60},status,{'Cache-Control':'no-store','Retry-After':quota?'300':'60'});
}
function normalize(rows){
 const out=[];
 for(const r of rows||[]){
  const t=Number(r.t),open=Number(r.o),high=Number(r.h),low=Number(r.l),close=Number(r.c);
  if(![t,open,high,low,close].every(Number.isFinite)||t<=0||open<=0||high<=0||low<=0||close<=0||high<Math.max(open,close)||low>Math.min(open,close)||low>high)continue;
  out.push({t,open,high,low,close,volume:r.v==null?null:Number(r.v)});
 }
 out.sort((a,b)=>a.t-b.t);return out;
}
function resample(rows,targetMs){
 if(!targetMs)return rows;
 const out=[];let cur=null;
 for(const r of rows){
  const t=Math.floor(r.t/targetMs)*targetMs;
  if(!cur||cur.t!==t){
   if(cur)out.push(cur);
   cur={t,open:r.open,high:r.high,low:r.low,close:r.close,volume:Number.isFinite(r.volume)?r.volume:null};
  }else{
   cur.high=Math.max(cur.high,r.high);cur.low=Math.min(cur.low,r.low);cur.close=r.close;
   if(Number.isFinite(r.volume))cur.volume=(Number.isFinite(cur.volume)?cur.volume:0)+r.volume;
  }
 }
 if(cur)out.push(cur);return out;
}
async function pull(env,interval,size){
 if(!env.MASSIVE_API_KEY)return json({ok:false,error:'MASSIVE_API_KEY_NOT_CONFIGURED',provider:PROVIDER},503,{'Cache-Control':'no-store'});
 const spec=SPEC[interval],limit=providerLimit(interval,size),range=dateRange(interval,limit);
 const u=new URL('https://api.massive.com/v2/aggs/ticker/'+TICKER+'/range/'+spec.m+'/'+spec.s+'/'+range.from+'/'+range.to);
 for(const [k,v] of Object.entries({adjusted:'true',sort:'desc',limit:String(limit),apiKey:env.MASSIVE_API_KEY}))u.searchParams.set(k,v);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const res=await fetch(u.toString(),{headers:{Accept:'application/json'},signal:controller.signal});
  let data;try{data=await res.json();}catch(e){return json({ok:false,error:'UPSTREAM_INVALID_JSON',provider:PROVIDER},502,{'Cache-Control':'no-store'});}
  if(!res.ok||data.status!=='OK')return safeProviderError(res,data);
  if(data.ticker&&data.ticker!==TICKER)return json({ok:false,error:'UPSTREAM_TICKER_MISMATCH',provider:PROVIDER},502,{'Cache-Control':'no-store'});
  let rows=resample(normalize(data.results),spec.resample);
  if(!rows.length)return json({ok:false,error:'UPSTREAM_EMPTY',provider:PROVIDER},502,{'Cache-Control':'no-store'});
  if(rows.length>size)rows=rows.slice(-size);
  const calendar=['1day','1week','1month'].includes(interval),calendarTimezone=calendar?'America/New_York':null;
  const values=rows.map(r=>({datetime:calendar?etDay(r.t):new Date(r.t).toISOString(),open:r.open,high:r.high,low:r.low,close:r.close,volume:r.volume}));
  return json({ok:true,apiVersion:4,provider:PROVIDER,providerTicker:TICKER,symbol:'XAU/USD',interval,timezone:calendar?calendarTimezone:'UTC',calendarTimezone,
   dateBasis:calendar?'EXCHANGE_CALENDAR':'UTC_AGGREGATE',fetchedAtUtc:new Date().toISOString(),count:values.length,values},200,{'Cache-Control':'public, max-age='+TTL[interval]});
 }catch(e){
  return json({ok:false,error:'UPSTREAM_NETWORK_OR_TIMEOUT',provider:PROVIDER,providerCode:null,upstreamHttpStatus:null,retryAfterSeconds:60},502,{'Cache-Control':'no-store','Retry-After':'60'});
 }finally{clearTimeout(timer);}
}
async function saveBackup(cache,key,response){
 try{
  if(!response.ok)return;
  const data=await response.clone().json();if(data?.ok!==true)return;
  const backup=json({...data,cacheState:'BACKUP'},200,{'Cache-Control':'public, max-age='+BACKUP_TTL,'X-Cebonk-Cache':'backup'});
  await cache.put(key,backup);
 }catch(e){}
}
async function staleBackup(cache,key,failure){
 try{
  const hit=await cache.match(key);if(!hit)return null;
  const data=await hit.json();if(data?.ok!==true)return null;
  let err={};try{err=await failure.clone().json();}catch(e){}
  return json({...data,degraded:true,cacheState:'STALE_BACKUP',
   upstreamError:err.error||'UPSTREAM_ERROR',
   upstreamCode:err.providerCode??err.code??null,
   upstreamHttpStatus:err.upstreamHttpStatus??failure.status,
   retryAfterSeconds:err.retryAfterSeconds??60},200,{'Cache-Control':'no-store','X-Cebonk-Cache':'stale-backup'});
 }catch(e){return null;}
}
export default {async fetch(request,env,ctx){
 const origin=request.headers.get('Origin');if(origin&&origin!==ORIGIN)return json({ok:false,error:'ORIGIN_NOT_ALLOWED'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers({'Access-Control-Max-Age':'86400'})});
 if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,{Allow:'GET, OPTIONS'});
 const url=new URL(request.url);
 if(url.pathname==='/'||url.pathname==='/health')return json({ok:true,service:'CEBONK XAUUSD DATA API',apiVersion:4,provider:PROVIDER,providerTicker:TICKER,symbol:'XAU/USD',secretConfigured:!!env.MASSIVE_API_KEY,intervals:INTERVALS,timeUtc:new Date().toISOString()},200,{'Cache-Control':'no-store'});
 if(url.pathname!=='/xau')return json({ok:false,error:'NOT_FOUND'},404);
 const interval=url.searchParams.get('interval')||'5min';if(!INTERVALS.includes(interval))return json({ok:false,error:'INVALID_INTERVAL',allowed:INTERVALS},400);
 const raw=url.searchParams.get('outputsize')||'300';if(!/^\d+$/.test(raw))return json({ok:false,error:'INVALID_OUTPUTSIZE'},400);
 const size=Math.max(50,Math.min(500,Number(raw)));
 const canonical='/xau?interval='+interval+'&outputsize='+size;
 const key=new Request(url.origin+canonical),backupKey=new Request(url.origin+'/__backup'+canonical),cache=caches.default;
 let cached;try{cached=await cache.match(key);}catch(e){}
 if(cached){ctx.waitUntil(saveBackup(cache,backupKey,cached.clone()));return cached;}
 const id=interval+':'+size;let pending=flight.get(id);
 if(!pending){pending=pull(env,interval,size);flight.set(id,pending);}
 try{
  const response=(await pending).clone();
  if(response.ok){
   ctx.waitUntil(Promise.all([cache.put(key,response.clone()).catch(()=>{}),saveBackup(cache,backupKey,response.clone())]));
   return response;
  }
  const stale=await staleBackup(cache,backupKey,response.clone());
  return stale||response;
 }finally{if(flight.get(id)===pending)flight.delete(id);}
}};