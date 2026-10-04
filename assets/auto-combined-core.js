/* CEBONK AUTO SOP v3.1.0. Automatic observations, NOT broker orders.
   PDF-aligned subset: one-to-one IB -> separate CB1 break -> later Zone IB retest.
   Numeric detection, SND/SNR, key proximity and expiry are disclosed engineering rules.
   No MA/RSI/ATR, manual prices, fabricated candles or hindsight entry resurrection. */
(function(root){
'use strict';
// LOCATION_SCANNER_V310: reuse tested no-pattern SND/SNR rules, preserve Musang.
const Locations=root.CebonkSNDAuto||(typeof module!=='undefined'&&module.exports?require('./snd-auto-core.js'):null);
if(!Locations)throw Error('SND_AUTO_CORE_NOT_LOADED');
const MIN=60000,DAY=86400000;
const CFG=Object.freeze({version:'3.1.0',context:['MN1','W1','D1','H4','H1'],
 frames:{M1:'1min',M5:'5min',M15:'15min',H1:'1h',H4:'4h',D1:'1day',W1:'1week',MN1:'1month'},
 minutes:{M1:1,M5:5,M15:15,H1:60,H4:240},ratios:[1.618,2.618,4.23],
 depth:2,keyTolerance:0.1,
 slBuffer:0.05,maxRetests:1,setupSearch:25});
const assert=(v,m)=>{if(!v)throw new Error(m);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const side=z=>['SUPPLY','RESISTANCE'].includes(z.kind)?'SELL':'BUY';
const overlap=(a,b)=>a.low<=b.high&&a.high>=b.low;
const body=c=>({low:Math.min(c.open,c.close),high:Math.max(c.open,c.close)});
const br=c=>(c.high-c.low)>0?Math.abs(c.close-c.open)/(c.high-c.low):0;
const sign=c=>Math.sign(c.close-c.open);
const utcParts=(t,zone)=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(t);const get=k=>+p.find(x=>x.type===k).value;return [get('year'),get('month'),get('day'),get('hour'),get('minute'),get('second')];};
function localUTC(s,zone='UTC'){
 assert(typeof s==='string'&&/^\d{4}-\d\d-\d\d(?:[ T]\d\d:\d\d(?::\d\d)?)?$/.test(s),'TIMESTAMP_INVALID');
 const a=s.replace('T',' ').split(/[- :]/).map(Number);while(a.length<6)a.push(0);
 const naive=Date.UTC(a[0],a[1]-1,a[2],a[3],a[4],a[5]),d=new Date(naive);
 assert(d.getUTCFullYear()===a[0]&&d.getUTCMonth()===a[1]-1&&d.getUTCDate()===a[2]&&a[3]<24&&a[4]<60&&a[5]<60,'DATE_INVALID');
 if(zone==='UTC'||zone==='Etc/UTC')return naive;
 const offsets=new Set();for(const shift of [-DAY,0,DAY]){const t=naive+shift,p=utcParts(t,zone);offsets.add(Date.UTC(p[0],p[1]-1,p[2],p[3],p[4],p[5])-t);}
 const matches=[...offsets].map(o=>naive-o).filter(t=>utcParts(t,zone).every((v,i)=>v===a[i]));
 assert(matches.length===1,'TIMEZONE_AMBIGUOUS_OR_INVALID');return matches[0];
}
function calendarEnd(date,tf,zone){
 const [y,m,d]=date.slice(0,10).split('-').map(Number);
 const e=tf==='MN1'?new Date(Date.UTC(y,m,1)):new Date(Date.UTC(y,m-1,d+(tf==='W1'?7:1)));
 return localUTC(e.toISOString().slice(0,10),zone);
}
function parse(data,tf,now=Date.now()){
 assert(CFG.frames[tf]&&data&&data.ok===true&&data.symbol==='XAU/USD'&&data.interval===CFG.frames[tf]&&Array.isArray(data.values),'PAYLOAD_INVALID_'+tf);
 const intraday=!!CFG.minutes[tf];const zone=intraday?'UTC':data.calendarTimezone;
 assert(intraday?data.timezone==='UTC':typeof zone==='string'&&zone.length>0,'TIMEZONE_UNKNOWN_'+tf);
 const seen=new Set(),out=[];
 for(const v of data.values){
  const s=String(v.datetime).replace(/Z$/,''),ms=localUTC(s,zone),end=intraday?ms+CFG.minutes[tf]*MIN:calendarEnd(s,tf,zone);
  assert(!seen.has(ms)&&ms<=now+MIN,'DUPLICATE_OR_FUTURE_'+tf);seen.add(ms);
  const c={ms,end};for(const k of ['open','high','low','close']){assert(v[k]!==null&&v[k]!==''&&v[k]!==undefined,'OHLC_MISSING');c[k]=Number(v[k]);assert(finite(c[k])&&c[k]>0,'OHLC_INVALID');}
  assert(c.high>=Math.max(c.open,c.close)&&c.low<=Math.min(c.open,c.close)&&c.low<=c.high,'OHLC_ORDER');
  if(end<=now)out.push(c);
 }
 return out.sort((a,b)=>a.ms-b.ms);
}
function pivots(b,d=CFG.depth){
 const p=[];for(let i=d;i<b.length-d;i++)for(const kind of ['high','low']){
  if(b.slice(i-d,i+d+1).every((c,j)=>j===d||(kind==='high'?b[i][kind]>c[kind]:b[i][kind]<c[kind])))
   p.push({i,kind,price:b[i][kind],ms:b[i].ms,knownAt:b[i+d].end});
 }return p;
}
function life(z,b,until=Infinity){
 let tests=0,inside=false,departed=z.initialDeparted===true,lastTest=null;
 for(const c of b){if(c.ms<z.bornAt||c.end>until)continue;
  const broken=side(z)==='BUY'?c.close<z.low:c.close>z.high;
  if(broken)return {...z,status:'BROKEN',tests,brokenAt:c.end,lastTest};
  const touch=overlap(c,z);
  if(!touch){inside=false;departed=true;continue;}
  if(departed&&!inside){tests++;lastTest=c.end;}inside=true;
 }
 return {...z,tests,lastTest,status:tests?'TESTED':'FRESH',brokenAt:null};
}
function zones(b,tf,until=Infinity){
 const closed=b.filter(c=>c.end<=until).map(c=>({...c,closed:true}));
 return Locations.scan({tf,closed,bars:closed}).map(z=>({...z,
  sourceMs:z.originMs,bornAt:z.createdAt,tests:z.retests,lastTest:z.visits.length?z.visits[z.visits.length-1].end:null,
  formation:['DEMAND','SUPPLY'].includes(z.kind)?'SWING_DISPLACEMENT':'SWING_REACTION',initialDeparted:true}));
}
function keys(b,tf,until=Infinity){
 const closed=b.filter(c=>c.end<=until),out=[];if(!closed.length)return out;
 if(['D1','W1','MN1'].includes(tf)){
  const c=closed[closed.length-1];for(const k of ['high','low'])out.push({id:tf+':PREV_'+k+':'+c.ms,tf,price:c[k],sourceMs:c.ms,knownAt:c.end,label:tf+' previous '+k});
 }
 for(const p of pivots(closed).slice(-12))out.push({id:tf+':SWING:'+p.kind+':'+p.ms,tf,price:p.price,sourceMs:p.ms,knownAt:p.knownAt,label:tf+' swing '+p.kind});
 return out;
}
function rankLocations(zs,ks,direction,price,at){
 const eligible=zs.filter(z=>z.bornAt<=at&&['FRESH','TESTED'].includes(z.status)&&z.tests<=CFG.maxRetests);
 return eligible.filter(z=>side(z)===direction).map(z=>{
  const tol=(z.high-z.low)*CFG.keyTolerance;
  const confluence=ks.filter(k=>k.knownAt<=at&&k.price>=z.low-tol&&k.price<=z.high+tol&&!(k.tf===z.tf&&k.sourceMs===z.sourceMs));
  const peers=eligible.filter(x=>side(x)===direction&&x.tf!==z.tf&&overlap(z,x));
  const nested=peers.filter(x=>(z.low>=x.low&&z.high<=x.high)||(x.low>=z.low&&x.high<=z.high));
  return {...z,keys:confluence,nested:[...new Set(nested.map(x=>x.tf))],confluenceTF:[...new Set(peers.map(x=>x.tf))],
   distance:finite(price)?Math.max(z.low-price,price-z.high,0):Infinity};
 }).sort((a,b)=>(a.status==='FRESH'?0:1)-(b.status==='FRESH'?0:1)||b.confluenceTF.length-a.confluenceTF.length||b.nested.length-a.nested.length||
  (['SUPPLY','DEMAND'].includes(b.kind)?1:0)-(['SUPPLY','DEMAND'].includes(a.kind)?1:0)||b.keys.length-a.keys.length||
  a.distance/(a.scale||a.high-a.low)-b.distance/(b.scale||b.high-b.low)||b.bornAt-a.bornAt);
}
function context(zs,ks,direction,price,at){
 const candidates=rankLocations(zs,ks,direction,price,at).filter(z=>price>=z.low&&price<=z.high);
 const opposed=zs.filter(z=>z.bornAt<=at&&['FRESH','TESTED'].includes(z.status)&&z.tests<=CFG.maxRetests&&side(z)!==direction&&price>=z.low&&price<=z.high);
 return {selected:candidates[0]||null,candidates,opposed};
}
function patterns(b,tf='M1'){
 const p=pivots(b),out=[],step=CFG.minutes[tf]*MIN;
 for(const kind of ['high','low']){
  const ps=p.filter(x=>x.kind===kind),buy=kind==='low';
  for(let n=1;n<ps.length;n++){
   const first=ps[n-1],last=ps[n];if(buy?last.price>=first.price:last.price<=first.price)continue;
   const middle=p.filter(x=>x.kind!==kind&&x.i>first.i&&x.i<last.i);if(!middle.length)continue;
   const cb=middle.reduce((a,x)=>(buy?x.price>a.price:x.price<a.price)?x:a);
   for(let j=last.i+1;j<Math.min(b.length,last.i+CFG.setupSearch);j++){
    const prev=b[j-1],c=b[j],bb=body(prev);
    if(bb.high===bb.low)continue;
    const ib=buy?prev.close<prev.open&&c.close>c.open&&c.close>bb.high:prev.close>prev.open&&c.close<c.open&&c.close<bb.low;
    if(!ib||!(buy?cb.price>bb.high:cb.price<bb.low))continue;
    if(b.slice(first.i,j+1).some((x,k,a)=>k>0&&x.ms-a[k-1].ms!==step))continue;
    const knownAt=Math.max(last.knownAt,cb.knownAt,c.end),width=bb.high-bb.low;
    out.push({id:tf+':'+(buy?'BUY':'SELL')+':'+last.ms+':'+c.ms,tf,direction:buy?'BUY':'SELL',firstMs:first.ms,newMs:last.ms,knownAt,
     cb1:cb.price,ibMs:c.ms,zone:{low:bb.low,high:bb.high},distal:buy?prev.low:prev.high,
     sl:buy?prev.low-CFG.slBuffer*width:prev.high+CFG.slBuffer*width,fib0:buy?bb.low:bb.high,
     source:'PDF_LEVEL2_ONE_TO_ONE_AUTOMATION',initialSign:'ONE_TO_ONE_BODY_BREAK'});break;
   }
  }
 }return out.sort((a,b)=>b.knownAt-a.knownAt);
}
function evaluate(s,b,now){
 const wait=(stage,reason,more={})=>({stage,reason,setup:s,executionEnabled:false,...more});
 const buy=s.direction==='BUY',d=buy?1:-1,step=CFG.minutes[s.tf]*MIN,after=b.filter(c=>c.ms>=s.ibMs);
 if(after.some((c,i)=>i>0&&c.ms-after[i-1].ms!==step))return wait('DATA_GAP','Celah candle ing struktur.');
 let broken=null,event=null;
 for(const c of after){
  if(buy?c.close<s.distal:c.close>s.distal)return wait('INVALID','Zone IB wis invalid.');
  if(!broken&&(buy?c.close>s.cb1:c.close<s.cb1)){
   if(c.end<s.knownAt)return wait('EARLY_BREAK','CB1 break sadurunge pivot bisa dikonfirmasi.');
   broken=c;continue;
  }
  if(broken&&c.ms>=Math.max(broken.end,s.knownAt)&&overlap(c,s.zone)){event=c;break;}
 }
 if(!broken)return wait('WAIT_CB1_BREAK','IB ana; nunggu CB1 close break.');
 const fib100=broken.close,breakAt=broken.end;
 if(d*(fib100-s.fib0)<=0)return wait('INVALID','Anchor Fibo ora selaras.');
 if(!event)return wait('WAIT_RETEST','CB1 wis break; nunggu retest Zone IB.',{breakAt});
 const entry=buy?Math.min(s.zone.high,event.high):Math.max(s.zone.low,event.low),risk=d*(entry-s.sl),eventAt=event.end;
 const targets=CFG.ratios.map(r=>({ratio:r,price:s.fib0+(fib100-s.fib0)*r})).map(t=>({...t,rr:risk>0?d*(t.price-entry)/risk:null}));
 const data={entry,sl:s.sl,targets,fib0:s.fib0,fib100,eventStart:event.ms,eventAt,expiresAt:eventAt+step,breakAt};
 if((buy?event.low<=s.sl:event.high>=s.sl)||targets.some(t=>buy?event.high>=t.price:event.low<=t.price))return wait('AMBIGUOUS','Retest lan SL/TP ana ing candle padha; urutan tick ora dingerteni.',data);
 if(!(risk>0&&targets.every(t=>t.rr>0)))return wait('INVALID','SL/target ora valid.',data);
 if(now<eventAt||now>=eventAt+step||b[b.length-1].ms!==event.ms)return wait('EXPIRED','Retest lawas; ora chase.',data);
 return wait('RETEST_VALID','IB → CB1 break → retest Zone IB terdeteksi.',data);
}
function musang(b,tf,now){
 const all=patterns(b,tf).map(s=>evaluate(s,b,now));
 const live=all.filter(r=>r.stage==='RETEST_VALID');
 if(new Set(live.map(r=>r.setup.direction)).size>1)return {stage:'CONFLICT',reason:'Pola BUY/SELL aktif tumpang tindih.',executionEnabled:false};
 return live[0]||all.find(r=>['WAIT_CB1_BREAK','WAIT_RETEST'].includes(r.stage))||all[0]||{stage:'NO_SETUP',reason:'Durung ana struktur Level 2 sing lengkap.',executionEnabled:false};
}
function combine(r,astro,ctx,now,fresh,coverage){
 const out={decision:'WAIT',reason:r.reason||'Nunggu data.',executionEnabled:false,coverage};
 if(!fresh)return {...out,reason:'Data M1 stale / error. Ora nerbitake entry.'};
 if(!astro||!astro.model||!Array.isArray(astro.groups))return {...out,reason:'Astrology saiki durung siap.'};
 const live=astro.groups.find(g=>now>=g.start&&now<g.end);out.astro=live?live.state:'OUTSIDE';out.window=live||null;
 if(r.stage!=='RETEST_VALID')return out;
 const atEvent=astro.groups.find(g=>r.eventStart>=g.start&&r.eventStart<g.end),d=r.setup.direction;
 if(!live||!atEvent||live.state!==d||atEvent.state!==d||live.start!==atEvent.start)return {...out,reason:'Astrology beda arah / window wis rampung.'};
 if(!ctx||!ctx.selected)return {...out,reason:'Nunggu SND/SNR otomatis searah ing rega retest; FRESH utama, TESTED 1x cadangan.'};
 if(ctx.opposed.length)return {...out,reason:'Konflik lokasi Supply/Demand aktif.'};
 if(now>=r.expiresAt)return {...out,reason:'Retest wis expired.'};
 return {...out,decision:'ENTRY '+d,reason:'Astrology → SND/SNR otomatis → IB/CB1/retest selaras. Pengamatan, dudu order.',event:r,location:ctx.selected};
}
const API=Object.freeze({CFG,localUTC,calendarEnd,parse,pivots,zones,life,keys,rankLocations,context,patterns,evaluate,musang,combine,side});
root.CebonkAuto=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
