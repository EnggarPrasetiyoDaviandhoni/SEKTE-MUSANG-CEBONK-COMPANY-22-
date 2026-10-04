/** CEBONK XAUUSD DATA API v2.1.0 — HTF support for SND/SNR.
 * Deploy to the existing Worker. Keep TWELVE_DATA_KEY as a Cloudflare Secret.
 * No API key is embedded here. GitHub commit does NOT deploy Cloudflare.
 */
const ORIGIN='https://enggarprasetiyodaviandhoni.github.io';
const TTL=Object.freeze({'1min':20,'5min':45,'15min':90,'30min':150,'45min':150,'1h':600,'2h':600,'4h':1800,'1day':3600,'1week':14400,'1month':21600});
function headers(){return {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','X-Content-Type-Options':'nosniff'};}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...headers(),'Cache-Control':'no-store',...extra}});}
export default {
 async fetch(request,env,ctx){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers()});
  if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const url=new URL(request.url),origin=request.headers.get('Origin');
  if(origin&&origin!==ORIGIN)return json({ok:false,error:'ORIGIN_NOT_ALLOWED'},403);
  if(url.pathname==='/'||url.pathname==='/health')return json({ok:true,service:'CEBONK XAUUSD DATA API',version:'2.1.0',symbol:'XAU/USD',secretConfigured:!!env.TWELVE_DATA_KEY,intervals:Object.keys(TTL),htfEnabled:true,timeUtc:new Date().toISOString()});
  if(url.pathname!=='/xau')return json({ok:false,error:'NOT_FOUND'},404);
  if(!env.TWELVE_DATA_KEY)return json({ok:false,error:'TWELVE_DATA_KEY_NOT_CONFIGURED'},503);
  for(const key of url.searchParams.keys())if(!['interval','outputsize'].includes(key))return json({ok:false,error:'INVALID_PARAMETER'},400);
  const interval=url.searchParams.get('interval')||'5min';
  if(!Object.hasOwn(TTL,interval))return json({ok:false,error:'INVALID_INTERVAL',allowed:Object.keys(TTL)},400);
  const raw=url.searchParams.get('outputsize')||'300';if(!/^\d+$/.test(raw))return json({ok:false,error:'INVALID_OUTPUTSIZE'},400);
  const outputsize=Math.max(50,Math.min(500,Number(raw)));
  const key=new Request(url.origin+'/__cache_v210/'+interval+'/'+outputsize);
  const cache=caches.default,hit=await cache.match(key);if(hit)return hit;
  const u=new URL('https://api.twelvedata.com/time_series');
  Object.entries({symbol:'XAU/USD',interval,outputsize:String(outputsize),order:'DESC',timezone:'UTC',apikey:env.TWELVE_DATA_KEY}).forEach(([k,v])=>u.searchParams.set(k,v));
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);let response,data;
  try{response=await fetch(u.toString(),{headers:{Accept:'application/json'},signal:ctl.signal});data=await response.json();}
  catch(e){return json({ok:false,error:'UPSTREAM_UNAVAILABLE',message:'Provider timeout/network/JSON error; no fallback prices.'},502);}
  finally{clearTimeout(timer);}
  if(!response.ok||data?.status==='error'){
   const code=Number(data?.code)||response.status,status=code===429?429:code===401||code===403?403:502;
   return json({ok:false,error:'TWELVE_DATA_ERROR',code,message:code===429?'Kuota API habis / rate limit.':code===401?'API key ditolak.':code===403?'Akses instrumen / timeframe perlu diperiksa pada paket provider.':'Provider gagal; tidak ada data pengganti.'},status,code===429?{'Retry-After':'65'}:{});
  }
  if(data?.meta?.symbol!=='XAU/USD'||data?.meta?.interval!==interval)return json({ok:false,error:'UPSTREAM_META_MISMATCH'},502);
  if(!Array.isArray(data.values)||!data.values.length)return json({ok:false,error:'UPSTREAM_NO_DATA'},502);
  const daily=['1day','1week','1month'].includes(interval),exchangeTimezone=data.meta.exchange_timezone;
  if(daily&&(typeof exchangeTimezone!=='string'||!exchangeTimezone))return json({ok:false,error:'EXCHANGE_TIMEZONE_MISSING'},502);
  let values;
  try{values=data.values.map(v=>{
   if(typeof v.datetime!=='string')throw Error('datetime');const row={datetime:v.datetime};
   for(const k of ['open','high','low','close']){if(v[k]===null||v[k]===''||v[k]===undefined)throw Error('empty');row[k]=Number(v[k]);if(!Number.isFinite(row[k])||row[k]<=0)throw Error('OHLC');}
   if(row.high<Math.max(row.open,row.close)||row.low>Math.min(row.open,row.close)||row.low>row.high)throw Error('range');
   row.volume=v.volume==null?null:Number(v.volume);if(row.volume!==null&&!Number.isFinite(row.volume))row.volume=null;return row;
  });}catch(e){return json({ok:false,error:'INVALID_UPSTREAM_OHLC'},502);}
  const out=json({ok:true,version:'2.1.0',provider:'Twelve Data',symbol:'XAU/USD',interval,timezone:daily?exchangeTimezone:'UTC',exchangeTimezone:exchangeTimezone||null,datetimeBasis:daily?'EXCHANGE_CALENDAR':'UTC',fetchedAtUtc:new Date().toISOString(),count:values.length,values},200,{'Cache-Control':'public, max-age='+TTL[interval],'X-CEBONK-Cache-TTL':String(TTL[interval])});
  ctx.waitUntil(cache.put(key,out.clone()).catch(()=>{}));return out;
 }
};
