/* CEBONK SND/SNR AUTO v1.0.0. Engineering location rules, NOT Fibo Musang PDF rules.
   No pattern-base classifier. Native periods; no artificial MN/W/D resampling. */
(function(root){
'use strict';
const H=3600000,D=24*H;
const FRAMES=Object.freeze({MN1:{interval:'1month',ttl:21600000,maxAge:40*D},W1:{interval:'1week',ttl:14400000,maxAge:10*D},D1:{interval:'1day',ttl:3600000,maxAge:4*D},H4:{interval:'4h',ttl:1800000,maxAge:4*D},H1:{interval:'1h',ttl:600000,maxAge:4*D}});
const CFG=Object.freeze({version:'1.0.0',frames:FRAMES,depth:2,medianBars:20,minBars:30,impulseBars:3,impulseMultiple:1.5,maxWidthMedian:.5,minWidthMedian:.08});
const assert=(b,s)=>{if(!b)throw Error(s);},finite=x=>typeof x==='number'&&Number.isFinite(x);
const overlaps=(a,b)=>a.low<=b.high&&a.high>=b.low;
const direction=k=>['DEMAND','SUPPORT'].includes(k)?'BUY':'SELL';
function wallParts(ms,zone){
 const a=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
 const p=Object.fromEntries(a.map(x=>[x.type,x.value]));return [+p.year,+p.month,+p.day,+p.hour,+p.minute,+p.second];
}
function calendar(s){
 assert(typeof s==='string'&&/^\d{4}-\d\d-\d\d(?:[ T]\d\d:\d\d(?::\d\d)?)?$/.test(s),'FORMAT_WAKTU_INVALID');
 const a=s.replace('T',' ').split(/[- :]/).map(Number);while(a.length<6)a.push(0);
 const t=Date.UTC(a[0],a[1]-1,a[2],a[3],a[4],a[5]),d=new Date(t);
 assert(d.getUTCFullYear()===a[0]&&d.getUTCMonth()+1===a[1]&&d.getUTCDate()===a[2]&&a[3]<24&&a[4]<60&&a[5]<60,'TANGGAL_INVALID');return {a,t};
}
function wallUTC(s,zone){
 const {a,t}=calendar(s);assert(typeof zone==='string'&&zone.length>0,'TIMEZONE_KOSONG');
 if(['UTC','Etc/UTC','GMT'].includes(zone))return t;
 const offsets=new Set();for(const delta of [-D,0,D]){const x=t+delta,p=wallParts(x,zone);offsets.add(Date.UTC(p[0],p[1]-1,p[2],p[3],p[4],p[5])-x);}
 const hits=[...offsets].map(o=>t-o).filter(x=>wallParts(x,zone).every((v,i)=>v===a[i]));
 assert(hits.length===1,'JAM_DST_AMBIGU_ATAU_TIDAK_ADA');return hits[0];
}
function endOf(s,tf,zone){
 const start=wallUTC(s,zone),{a}=calendar(s);if(tf==='H1'||tf==='H4')return start+(tf==='H1'?H:4*H);
 const d=tf==='MN1'?new Date(Date.UTC(a[0],a[1],1)):new Date(Date.UTC(a[0],a[1]-1,a[2]+(tf==='W1'?7:1)));
 return wallUTC(d.toISOString().slice(0,10)+' 00:00:00',zone);
}
function payload(data,tf,now=Date.now()){
 const f=FRAMES[tf];assert(f,'TF_INVALID');assert(data&&data.ok===true&&data.symbol==='XAU/USD'&&data.interval===f.interval&&Array.isArray(data.values),'FEED_TF_SYMBOL_INVALID');
 // Daily/weekly/monthly timezone=UTC is ignored by provider: preserve the reported exchange zone.
 const zone=['H1','H4'].includes(tf)?data.timezone:(data.exchangeTimezone||data.timezone);
 assert(zone,'TIMEZONE_KOSONG');if(['H1','H4'].includes(tf))assert(zone==='UTC','INTRADAY_BUKAN_UTC');
 const fetched=Date.parse(data.fetchedAtUtc);assert(finite(fetched)&&fetched<=now+60000,'FETCH_TIMESTAMP_INVALID');
 const seen=new Set(),bars=data.values.map(v=>{
  const ms=wallUTC(v.datetime,zone),end=endOf(v.datetime,tf,zone);assert(!seen.has(ms),'CANDLE_DUPLIKAT');seen.add(ms);assert(ms<=now+60000&&end>ms,'CANDLE_FUTURE');
  const b={ms,end,closed:end<=now};for(const k of ['open','high','low','close']){assert(v[k]!==null&&v[k]!==''&&v[k]!==undefined,'OHLC_KOSONG');b[k]=Number(v[k]);assert(finite(b[k])&&b[k]>0,'OHLC_INVALID');}
  assert(b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close)&&b.low<=b.high,'OHLC_CONTRADICTORY');return b;
 }).sort((a,b)=>a.ms-b.ms);
 const closed=bars.filter(b=>b.closed);assert(closed.length>=CFG.minBars,'HISTORY_KURANG_30_CANDLE_TUTUP');
 assert(closed.every((b,i)=>!i||b.ms>=closed[i-1].end),'PERIODE_OVERLAP');
 const recent=bars[bars.length-1];assert(now-recent.end<f.maxAge,'HISTORY_STALE');assert(now-fetched<=f.ttl+120000,'CACHE_STALE');
 return {tf,zone,bars,closed,fetchedAt:fetched,validUntil:fetched+f.ttl,source:'Twelve Data XAU/USD'};
}
function median(xs){const a=xs.filter(x=>finite(x)&&x>0).sort((a,b)=>a-b);return a.length?(a[(a.length-1)>>1]+a[a.length>>1])/2:NaN;}
function largeGap(a,b,tf){
 const gap=b.ms-a.end;if(gap<=0)return false;
 if(tf==='MN1')return gap>5*D;if(tf==='W1')return gap>3*D;if(tf==='D1')return gap>3*D;
 // Weekend closure allowance only; no pretending arbitrary intraday gaps are complete history.
 const day=new Date(a.end).getUTCDay();return !(gap<=3*D&&[5,6,0].includes(day));
}
function lifecycle(z,bars,tf){
 let left=true,inVisit=false,brokenAt=null,unknownAt=null;const visits=[];
 for(const b of bars.filter(b=>b.ms>z.originMs)){
  if(b.end<=z.departedAt)continue;
  const buy=z.direction==='BUY',hit=overlaps(z,b);
  if(b.closed&&(buy?b.close<z.low:b.close>z.high)){brokenAt=b.end;break;}
  if(hit&&left){if(!inVisit)visits.push({start:b.ms,end:b.end,closed:b.closed});else visits[visits.length-1].end=b.end;inVisit=true;}
  else if(!hit)inVisit=false;
  if(buy?b.close>z.high:b.close<z.low)left=true;
 }
 const range=bars.filter(b=>b.end>=z.departedAt);
 for(let i=1;i<range.length;i++)if(largeGap(range[i-1],range[i],tf)){unknownAt=range[i].ms;break;}
 return {...z,visits,brokenAt,unknownAt,retests:visits.length,status:brokenAt?'BROKEN':unknownAt?'DATA_GAP':visits.length?'TESTED':'FRESH'};
}
function scan(feed){
 const b=feed.closed,d=CFG.depth,out=[];
 for(let i=Math.max(CFG.medianBars,d);i<b.length-d;i++){
  const m=median(b.slice(i-CFG.medianBars,i).map(c=>c.high-c.low));if(!finite(m)||m<=0)continue;
  for(const buy of [true,false]){
   const c=b[i],extreme=buy?c.low:c.high,neighbors=b.slice(i-d,i+d+1);
   if(!neighbors.every((x,j)=>j===d||(buy?extreme<x.low:extreme>x.high)))continue;
   const bodyEdge=buy?Math.min(c.open,c.close):Math.max(c.open,c.close);
   const width=Math.min(CFG.maxWidthMedian*m,Math.max(CFG.minWidthMedian*m,Math.abs(extreme-bodyEdge)));
   const low=buy?extreme:extreme-width,high=buy?extreme+width:extreme;
   const after=b.slice(i+1,Math.min(b.length,i+1+CFG.impulseBars));
   const depart=after.find(x=>buy?x.close>high:x.close<low);if(!depart)continue;
   const confirmed=b[i+d].end;
   const impulse=after.find(x=>buy?(x.close>c.high&&x.close-high>=CFG.impulseMultiple*m):(x.close<c.low&&low-x.close>=CFG.impulseMultiple*m));
   for(const kind of [buy?'SUPPORT':'RESISTANCE',...(impulse?[buy?'DEMAND':'SUPPLY']:[])]){
    const isSND=['DEMAND','SUPPLY'].includes(kind),createdAt=Math.max(confirmed,isSND?impulse.end:depart.end);
    const initial={id:feed.tf+':'+kind+':'+c.ms,tf:feed.tf,kind,direction:buy?'BUY':'SELL',low,high,originMs:c.ms,createdAt,departedAt:depart.end,scale:m,impulse:isSND?Math.abs(impulse.close-(buy?high:low))/m:0,source:'AUTO_ENGINEERING',note:'AUTO: pivot tutup '+d+'; '+(isSND?'asal displacement':'reaksi swing')+'; dudu rule PDF'};
    // Scan from the departure onward, including retests before the pivot became known.
    out.push(lifecycle(initial,feed.bars,feed.tf));
   }
  }
 }
 return out;
}
function ranked(zones,side,price){
 const list=zones.filter(z=>z.direction===side&&!['BROKEN','DATA_GAP'].includes(z.status));
 return list.map(z=>{
  const peers=list.filter(x=>x.id!==z.id&&x.tf!==z.tf&&overlaps(x,z));
  return {...z,confluence:[...new Set(peers.map(x=>x.tf))],nested:[...new Set(peers.filter(x=>(x.low<=z.low&&x.high>=z.high)||(z.low<=x.low&&z.high>=x.high)).map(x=>x.tf))],distance:finite(price)?Math.max(z.low-price,price-z.high,0):Infinity};
 }).sort((a,b)=>(a.status==='FRESH'?0:1)-(b.status==='FRESH'?0:1)||b.confluence.length-a.confluence.length||(['DEMAND','SUPPLY'].includes(b.kind)?1:0)-(['DEMAND','SUPPLY'].includes(a.kind)?1:0)||a.distance/a.scale-b.distance/b.scale||b.createdAt-a.createdAt);
}
function select(snapshot,side,price,eventStart,now){
 const ctx={aligned:[],opposed:[],coverage:[],missing:[],primary:null};
 if(!snapshot||!finite(price)||!['BUY','SELL'].includes(side))return ctx;
 const usable=[];for(const tf of Object.keys(FRAMES)){
  const f=snapshot.frames[tf];if(f&&f.ok&&f.validUntil>now){ctx.coverage.push(tf);usable.push(...f.zones);}else ctx.missing.push(tf);
 }
 // Never create confluence retroactively: native confirmed formation must precede event.
 const at=usable.filter(z=>z.createdAt<=eventStart&&price>=z.low&&price<=z.high&&!['BROKEN','DATA_GAP'].includes(z.status));
 ctx.aligned=ranked(at,side,price).map(z=>({...z,active:true,verified:true}));
 ctx.opposed=at.filter(z=>z.direction!==side);ctx.primary=ctx.aligned[0]||null;return ctx;
}
const API=Object.freeze({CFG,wallUTC,endOf,payload,median,largeGap,lifecycle,scan,ranked,select,overlaps});
root.CebonkSNDAuto=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
