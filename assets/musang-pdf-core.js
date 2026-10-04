/* CEBONK Musang PDF / Entry Level 2. Source: FIBO_MUSANG_ID.pdf pp18-19,23,32-36.
 * Candidate extraction is an engineering aid, NOT an exact automatic translation.
 * User must verify IB/CB1/anchors. No MA/RSI/ATR, orders or guaranteed outcomes.
 */
(function(root){
'use strict';
const MIN=60000;
const CFG=Object.freeze({version:'2.0.0',frames:{M1:1,M5:5,M15:15,H1:60,H4:240},context:['MN1','W1','D1','H4','H1'],ratios:[0,.236,.382,.5,.618,1,1.618,2.618,4.23],pivotDepth:2});
const ok=(v,msg)=>{if(!v)throw new Error(msg);};
const num=v=>typeof v==='number'&&Number.isFinite(v);
const overlap=(a,b)=>a.low<=b.high&&a.high>=b.low;
const side=k=>['DEMAND','SUPPORT'].includes(k)?'BUY':['SUPPLY','RESISTANCE'].includes(k)?'SELL':null;
function stamp(value){
 if(typeof value==='number'){ok(Number.isSafeInteger(value)&&value>0,'Timestamp invalid');return value;}
 const s=String(value);ok(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(:\d\d)?(\.\d{3})?(Z|[+-]\d\d:\d\d)?$/.test(s),'Waktu kudu ISO / UTC');
 const dt=s.slice(0,10).split('-').map(Number),check=new Date(Date.UTC(dt[0],dt[1]-1,dt[2]));ok(check.getUTCMonth()===dt[1]-1&&check.getUTCDate()===dt[2],'Tanggal kalender invalid');
 const t=Date.parse(s.replace(' ','T')+(/(Z|[+-]\d\d:\d\d)$/.test(s)?'':'Z'));ok(Number.isFinite(t),'Waktu invalid');return t;
}
function candles(data,tf,now=Date.now()){
 ok(CFG.frames[tf],'TF invalid');ok(data&&data.ok===true&&Array.isArray(data.values),'Payload API invalid');
 ok(data.symbol==='XAU/USD','Symbol feed dudu XAU/USD');ok(data.timezone==='UTC','Timezone feed kudu UTC');
 const expected={M1:'1min',M5:'5min',M15:'15min',H1:'1h',H4:'4h'}[tf];ok(data.interval===expected,'Interval feed ora cocok');
 const step=CFG.frames[tf]*MIN,seen=new Set(),out=[];
 for(const v of data.values){
  const c={ms:stamp(v.datetime)};
  for(const k of ['open','high','low','close']){ok(v[k]!==null&&v[k]!==''&&v[k]!==undefined,'OHLC kosong');c[k]=Number(v[k]);ok(num(c[k])&&c[k]>0,'OHLC invalid');}
  ok(c.high>=Math.max(c.open,c.close)&&c.low<=Math.min(c.open,c.close)&&c.high>=c.low,'Urutan OHLC invalid');
  ok(!seen.has(c.ms),'Timestamp dobel');seen.add(c.ms);ok(c.ms<=now+MIN,'Feed wektu mangsa depan');
  if(c.ms+step<=now)out.push(c);
 }
 return out.sort((a,b)=>a.ms-b.ms);
}
function pivots(b,d=CFG.pivotDepth){
 const p=[];for(let i=d;i<b.length-d;i++){
  const seg=b.slice(i-d,i+d+1);for(const kind of ['high','low']){
   const valid=seg.every((c,j)=>j===d||(kind==='high'?b[i][kind]>c[kind]:b[i][kind]<c[kind]));
   if(valid)p.push({i,ms:b[i].ms,price:b[i][kind],kind,known:b[i+d].ms});
  }
 }return p;
}
function detect(b,tf){
 const p=pivots(b),out=[],step=CFG.frames[tf]*MIN;
 for(const kind of ['high','low']){
  const ps=p.filter(x=>x.kind===kind);
  for(let n=1;n<ps.length;n++){
   const first=ps[n-1],last=ps[n],buy=kind==='low',direction=buy?'BUY':'SELL';
   if(buy?last.price>=first.price:last.price<=first.price)continue;
   const middle=p.filter(x=>x.kind!==kind&&x.i>first.i&&x.i<last.i);
   if(!middle.length)continue;
   const cb=middle.reduce((a,x)=>(buy?x.price>a.price:x.price<a.price)?x:a);
   // Conservative 1-to-1 body break candidate. Hidden Engulfing is not guessed.
   for(let j=last.i+1;j<Math.min(b.length,last.i+25);j++){
    const c=b[j],prev=b[j-1],low=Math.min(prev.open,prev.close),high=Math.max(prev.open,prev.close);
    if(high===low)continue;
    const initial=buy?(prev.close<prev.open&&c.close>c.open&&c.close>high):(prev.close>prev.open&&c.close<c.open&&c.close<low);
    if(!initial)continue;
    if(cb.price>=low&&cb.price<=high)continue;
    if(buy?cb.price<=high:cb.price>=low)continue;
    const known=Math.max(last.known+step,c.ms+step);
    const bk=b.find(x=>x.ms>=c.ms&&(buy?x.close>cb.price:x.close<cb.price));
    const a0=buy?low:high,a100=bk?bk.close:cb.price;
    const sl=buy?prev.low:prev.high;
    out.push({id:tf+':'+direction+':'+last.ms+':'+c.ms,tf,direction,firstMs:first.ms,pullbackMs:cb.ms,newMs:last.ms,ibMs:c.ms,zoneMs:prev.ms,knownAt:known,cb1:cb.price,low,high,fib0:a0,fib100:a100,sl:buy?(sl<low?sl:null):(sl>high?sl:null),source:'KANDIDAT_OTOMATIS_BUKAN_RULE_PDF',verified:false,reviewedAt:0});break;
   }
  }
 }return out.sort((a,b)=>b.knownAt-a.knownAt).slice(0,16);
}
function validate(s){
 ok(s&&CFG.frames[s.tf]&&['BUY','SELL'].includes(s.direction),'Setup ora valid');
 for(const k of ['firstMs','pullbackMs','newMs','ibMs','zoneMs','knownAt'])ok(num(s[k]),'Wektu struktur kosong: '+k);
 ok(s.firstMs<s.pullbackMs&&s.pullbackMs<s.newMs&&s.newMs<s.ibMs,'Urutan ekstrem / pullback / IB ora valid');
 ok(s.zoneMs<s.ibMs,'Zone kudu wis ana sadurunge IB');
 for(const k of ['cb1','low','high','fib0','fib100'])ok(num(s[k])&&s[k]>0,'Level kosong: '+k);
 ok(s.low<s.high,'Zone low kudu < high');ok(s.cb1<s.low||s.cb1>s.high,'CB1 ora oleh tumpang tindih Zone IB');
 const buy=s.direction==='BUY';ok(buy?s.cb1>s.high:s.cb1<s.low,'CB1 kudu ing arah break sawise Zone IB');
 ok(buy?s.fib100>s.fib0:s.fib100<s.fib0,'Arah anchor Fibo kebalik');
 if(s.sl!==null)ok(num(s.sl)&&(buy?s.sl<s.low:s.sl>s.high),'SL kudu ing njaba Zone IB');
 if(s.verified)ok(num(s.reviewedAt)&&s.reviewedAt>0,'Review timestamp invalid');return s;
}
function evaluate(s,b,now){
 if(!s)return {stage:'NO_SETUP',reason:'Pilih kandidat utawa tandai struktur dhisik.'};
 try{validate(s);}catch(e){return {stage:'INVALID_SETUP',reason:e.message};}
 const step=CFG.frames[s.tf]*MIN,buy=s.direction==='BUY',dir=buy?1:-1;
 const first=b.find(c=>c.ms===s.firstMs),mid=b.find(c=>c.ms===s.pullbackMs),last=b.find(c=>c.ms===s.newMs),ib=b.find(c=>c.ms===s.ibMs),z=b.find(c=>c.ms===s.zoneMs);
 if(!first||!mid||!last||!ib||!z)return {stage:'MISSING_HISTORY',reason:'Candle struktur ora ana ing feed iki.'};
 if(!(buy?last.low<first.low:last.high>first.high))return {stage:'INVALID_SETUP',reason:'Ora ana New Low/New High sing bener.'};
 if(!(buy?ib.close>s.high:ib.close<s.low))return {stage:'INVALID_SETUP',reason:'Initial Break durung mecah Zone IB.'};
 const history=b.filter(c=>c.ms>=s.firstMs);
 if(history.some((c,i)=>i>0&&c.ms-history[i-1].ms!==step))return {stage:'MISSING_HISTORY',reason:'Ana celah candle ing struktur; ora diisi nganggo data rekaan.'};
 const after=b.filter(c=>c.ms>=s.ibMs);
 const broken=after.find(c=>buy?c.close>s.cb1:c.close<s.cb1);
 const levels=CFG.ratios.map(r=>({ratio:r,price:s.fib0+(s.fib100-s.fib0)*r}));
 const base={setup:s,levels,breakMs:broken?broken.ms:null,eventMs:null,entry:null,sl:s.sl,targets:[]};
 if(!s.verified)return {...base,stage:'REVIEW_PDF',reason:'Verifikasi Initial Break, Zone IB, CB1 lan anchor; kandidat durung sinyal.'};
 if(!broken)return {...base,stage:'WAIT_CB1_BREAK',reason:'Nunggu candle close ngliwati CB1, ora mung wick/touch.'};
 let event=null;
 for(const c of after){
  if(buy?c.close<s.low:c.close>s.high)return {...base,stage:'INVALID_ZONE',reason:'Close wis liwat sisih invalidasi zone (aturan penjagaan aplikasi).'};
  if(c.ms>broken.ms&&c.ms>=s.knownAt&&overlap(c,{low:s.low,high:s.high})){event=c;break;}
 }
 if(!event)return {...base,stage:'WAIT_RETEST',reason:'CB1 wis break. Nunggu bali menyang Zone IB, dudu entry CB1.'};
 const eventMs=event.ms+step,entry=buy?Math.min(s.high,event.high):Math.max(s.low,event.low);
 base.eventMs=eventMs;base.entry=entry;
 base.targets=levels.filter(x=>x.ratio>1).map(x=>({...x,rr:s.sl!==null&&dir*(entry-s.sl)>0?dir*(x.price-entry)/(dir*(entry-s.sl)):null}));
 if(s.sl!==null){
  const priceHit=buy?event.low<=s.sl:event.high>=s.sl;
  if(priceHit)return {...base,stage:'AMBIGUOUS_BAR',reason:'Retest lan SL ana ing candle padha; urutan tick ora dingerteni.'};
 }
 if(event.ms<s.reviewedAt)return {...base,stage:'HISTORICAL',reason:'Retest sadurunge review; ora dadi entry anyar.'};
 if(!b.length||b[b.length-1].ms!==event.ms||now>=eventMs+step)return {...base,stage:'HISTORICAL',reason:'Retest wis liwat; ora chase rega lawas.'};
 if(!num(s.sl)||!base.targets.every(t=>num(t.rr)&&t.rr>0))return {...base,stage:'RISK_REVIEW',reason:'SL/target kudu diverifikasi ana ing sisih sing bener.'};
 return {...base,stage:'RETEST_VALID',reason:'Retest terkonfirmasi saka candle tutup; dudu bukti order keisi.'};
}
function validateZone(z){
 ok(z&&CFG.context.includes(z.tf),'TF lokasi invalid');ok(side(z.kind),'Jenis lokasi invalid');ok(num(z.low)&&num(z.high)&&z.low>0&&z.low<=z.high,'Batas lokasi invalid');ok(typeof z.note==='string'&&z.note.trim().length>=3,'Isi sumber/alasan zone');ok(num(z.createdAt),'Wektu zone invalid');return z;
}
function context(zones,direction,price,time){
 const eligible=zones.filter(z=>{try{validateZone(z);return z.active===true&&z.verified===true&&z.createdAt<=time&&num(price)&&price>=z.low&&price<=z.high;}catch(e){return false;}});
 return {aligned:eligible.filter(z=>side(z.kind)===direction),opposed:eligible.filter(z=>side(z.kind)!==direction)};
}
function combine(r,astro,zones,now,fresh,stale=false){
 const out={one:'WAIT',two:'WAIT',reason1:r.reason||'Nunggu setup.',reason2:'Nunggu COMBINED 1.',astro:'NO_DATA',window:null,context:{aligned:[],opposed:[]},executionEnabled:false};
 if(!fresh){out.reason1=out.reason2='DATA STALE / ERROR — ora ana entry.';return out;}
 if(stale||!astro||!astro.model||!Array.isArray(astro.groups)){out.reason1=out.reason2='Astrology kudu dihitung kanggo tanggal sing padha; ora oleh stale/OFF.';return out;}
 const t=r.eventMs||now,g=astro.groups.find(x=>t>=x.start&&t<x.end),live=astro.groups.find(x=>now>=x.start&&now<x.end);
 out.astro=g?g.state:'OUTSIDE';out.window=g||null;
 if(r.stage!=='RETEST_VALID')return out;
 const direction=r.setup.direction;
 if(!g||!live||g.state!==direction||live.state!==direction||g.start!==live.start){out.reason1='Window Astrology lan retest ora selaras / wis rampung.';return out;}
 out.one='ENTRY '+direction;out.reason1='Astrology + setup diverifikasi + CB1 break + retest Zone IB.';
 const ctx=context(zones,direction,r.entry,r.eventMs-CFG.frames[r.setup.tf]*MIN);out.context=ctx;
 if(!ctx.aligned.length){out.reason2='Ora ana lokasi HTF searah sing diverifikasi ing rega retest.';return out;}
 if(ctx.opposed.length){out.reason2='Konflik lokasi: Supply/Resistance lan Demand/Support tumpang tindih.';return out;}
 out.two=out.one;out.reason2='COMBINED 1 + lokasi HTF searah. Ora mbutuhake kabeh TF padha.';return out;
}
const API=Object.freeze({CFG,stamp,candles,pivots,detect,validate,evaluate,validateZone,context,combine});
root.CebonkMusangPDF=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
