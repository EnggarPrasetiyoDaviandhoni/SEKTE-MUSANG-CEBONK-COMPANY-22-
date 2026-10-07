/* AUTO_SOP_API_V3 | same Worker, same TWELVE_DATA_KEY Secret.
   GET /health and GET /xau?interval=1day&outputsize=300
   Adds native daily/weekly/monthly data, never builds fake MN1 from 500 M1 bars.
   Public read-only data proxy; CORS is not authentication or a global quota guard. */
const ORIGIN='https://enggarprasetiyodaviandhoni.github.io';
const INTERVALS=['1min','5min','15min','30min','45min','1h','2h','4h','1day','1week','1month'];
const DAILY=new Set(['1day','1week','1month']);
const TTL={'1min':60,'5min':120,'15min':300,'30min':600,'45min':600,'1h':900,'2h':1800,'4h':1800,'1day':14400,'1week':21600,'1month':43200};
const BACKUP_TTL=86400;
const flight=new Map();
function headers(extra={}){return {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','X-Content-Type-Options':'nosniff',...extra};}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:headers(extra)});}
async function pull(env,interval,size){
 if(!env.TWELVE_DATA_KEY)return json({ok:false,error:'TWELVE_DATA_KEY_NOT_CONFIGURED'},503,{'Cache-Control':'no-store'});
 const u=new URL('https://api.twelvedata.com/time_series');
 for(const [k,v] of Object.entries({symbol:'XAU/USD',interval,outputsize:String(size),order:'DESC',timezone:'UTC',apikey:env.TWELVE_DATA_KEY}))u.searchParams.set(k,v);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const res=await fetch(u.toString(),{headers:{Accept:'application/json'},signal:controller.signal});
  let data;try{data=await res.json();}catch(e){return json({ok:false,error:'UPSTREAM_INVALID_JSON'},502);}
  if(!res.ok||data.status==='error'){
   const raw=Number(data.code),code=Number.isFinite(raw)?raw:res.status;
   const status=code===429?429:[401,403].includes(code)?403:502;
   const error=status===429?'UPSTREAM_QUOTA':status===403?'UPSTREAM_ACCESS_DENIED':'TWELVE_DATA_ERROR';
   return json({ok:false,error,provider:'Twelve Data',providerCode:code,upstreamHttpStatus:res.status,retryAfterSeconds:status===429?300:60},status,{'Cache-Control':'no-store','Retry-After':status===429?'300':'60'});
  }
  if(data.meta?.symbol!=='XAU/USD'||data.meta?.interval!==interval||!Array.isArray(data.values)||!data.values.length)return json({ok:false,error:'UPSTREAM_SCHEMA_INVALID'},502);
  const calendarTimezone=DAILY.has(interval)?(data.meta.exchange_timezone||data.meta.timezone||null):null;
  if(DAILY.has(interval)){
   if(!calendarTimezone)return json({ok:false,error:'EXCHANGE_TIMEZONE_MISSING'},502);
   try{new Intl.DateTimeFormat('en',{timeZone:calendarTimezone}).format(new Date());}catch(e){return json({ok:false,error:'EXCHANGE_TIMEZONE_INVALID'},502);}
  }
  const values=[];
  for(const v of data.values){
   if(typeof v.datetime!=='string')return json({ok:false,error:'UPSTREAM_TIMESTAMP_INVALID'},502);
   const c={datetime:v.datetime};for(const k of ['open','high','low','close']){
    if(v[k]===null||v[k]===''||v[k]===undefined)return json({ok:false,error:'UPSTREAM_OHLC_MISSING'},502);
    c[k]=Number(v[k]);if(!Number.isFinite(c[k])||c[k]<=0)return json({ok:false,error:'UPSTREAM_OHLC_INVALID'},502);
   }
   if(c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||c.low>c.high)return json({ok:false,error:'UPSTREAM_OHLC_ORDER'},502);
   c.volume=v.volume==null?null:Number(v.volume);values.push(c);
  }
  return json({ok:true,apiVersion:3,provider:'Twelve Data',symbol:'XAU/USD',interval,timezone:DAILY.has(interval)?calendarTimezone:'UTC',calendarTimezone,
   dateBasis:DAILY.has(interval)?'EXCHANGE_CALENDAR':'UTC_INTRADAY',fetchedAtUtc:new Date().toISOString(),count:values.length,values},200,{'Cache-Control':'public, max-age='+TTL[interval]});
 }catch(e){return json({ok:false,error:'UPSTREAM_NETWORK_OR_TIMEOUT',provider:'Twelve Data',providerCode:null,upstreamHttpStatus:null,retryAfterSeconds:60},502,{'Cache-Control':'no-store','Retry-After':'60'});}finally{clearTimeout(timer);}
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
 if(url.pathname==='/'||url.pathname==='/health')return json({ok:true,service:'CEBONK XAUUSD DATA API',apiVersion:3,symbol:'XAU/USD',secretConfigured:!!env.TWELVE_DATA_KEY,intervals:INTERVALS,timeUtc:new Date().toISOString()},200,{'Cache-Control':'no-store'});
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
