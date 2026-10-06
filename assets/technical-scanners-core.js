/* CEBONK TECHNICAL SCANNERS v1.3.0
   Astrology is direction/time gate. Technical engines are deterministic closed-candle scanners.
   BBMA source rules follow prior project SOP: RE-ENTRY -> CSAK/CSM -> CSM.
   Liquidity rules are an engineering scanner: map -> sweep+displacement+break -> retest.
*/
(function(root){
'use strict';
const MIN=60000, VERSION='1.3.0';
const CFG=Object.freeze({
  version:VERSION,
  packages:Object.freeze([
    Object.freeze({id:'H4-H1-M15',tf1:'H4',tf2:'H1',tf3:'M15'}),
    Object.freeze({id:'H1-M15-M5',tf1:'H1',tf2:'M15',tf3:'M5'}),
    Object.freeze({id:'M30-M5-M1',tf1:'M30',tf2:'M5',tf3:'M1'}),
    Object.freeze({id:'M15-M5-M1',tf1:'M15',tf2:'M5',tf3:'M1'})
  ]),
  minutes:Object.freeze({M1:1,M5:5,M15:15,M30:30,H1:60,H4:240}),
  bbPeriod:20,bbDev:2,fast:5,slow:10,reAge:6,tf2Age:6,tf3Age:6,
  liquidityPivotDepth:2,liquidityLookback:80,sweepSearch:18,displacementBars:3,
  displacementBodyMultiple:1.20,structureLookback:6,equalToleranceRange:0.12,
  rr:2,slBuffer:0.20,minSignalHoldMinutes:5
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const side=x=>x==='BUY'||x==='SELL';
const opposite=x=>x==='BUY'?'SELL':x==='SELL'?'BUY':'WAIT';
const assert=(x,m)=>{if(!x)throw new Error(m);};
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;}
function median(a){const b=a.filter(finite).slice().sort((x,y)=>x-y);if(!b.length)return NaN;return (b[(b.length-1)>>1]+b[b.length>>1])/2;}
function lwma(values,p,i){if(i<p-1)return NaN;let n=0,d=0;for(let k=0;k<p;k++){const w=p-k;n+=values[i-k]*w;d+=w;}return n/d;}
function sma(values,p,i){if(i<p-1)return NaN;let s=0;for(let k=0;k<p;k++)s+=values[i-k];return s/p;}
function bb(values,p,dev,i){const mid=sma(values,p,i);if(!finite(mid))return {mid:NaN,upper:NaN,lower:NaN};let s=0;for(let k=0;k<p;k++)s+=(values[i-k]-mid)**2;const sd=Math.sqrt(s/p);return {mid,upper:mid+dev*sd,lower:mid-dev*sd};}
function enrich(bars){
 const h=bars.map(x=>x.high),l=bars.map(x=>x.low),c=bars.map(x=>x.close),out=[];
 for(let i=0;i<bars.length;i++){
  const band=bb(c,CFG.bbPeriod,CFG.bbDev,i);
  out.push({...bars[i],i,bb:band,ma5h:lwma(h,CFG.fast,i),ma10h:lwma(h,CFG.slow,i),ma5l:lwma(l,CFG.fast,i),ma10l:lwma(l,CFG.slow,i)});
 }
 return out;
}
function validIndicator(x){return x&&[x.bb.mid,x.bb.upper,x.bb.lower,x.ma5h,x.ma10h,x.ma5l,x.ma10l].every(finite);}
function reentryAt(e,i,dir){
 const x=e[i];if(!validIndicator(x))return false;
 if(dir==='BUY'){
  const lo=Math.min(x.ma5l,x.ma10l),hi=Math.max(x.ma5l,x.ma10l),bodyLo=Math.min(x.open,x.close);
  return x.low<=hi&&x.high>=lo&&bodyLo>hi&&x.close>hi&&x.ma5l>x.bb.mid&&x.ma10l>x.bb.mid;
 }
 const lo=Math.min(x.ma5h,x.ma10h),hi=Math.max(x.ma5h,x.ma10h),bodyHi=Math.max(x.open,x.close);
 return x.high>=lo&&x.low<=hi&&bodyHi<lo&&x.close<lo&&x.ma5h<x.bb.mid&&x.ma10h<x.bb.mid;
}
function crossesUp(x,p,levels,prevLevels){return x.close>Math.max(...levels)&&Math.min(x.open,p.close)<=Math.max(...prevLevels);}
function crossesDown(x,p,levels,prevLevels){return x.close<Math.min(...levels)&&Math.max(x.open,p.close)>=Math.min(...prevLevels);}
function csakAt(e,i,dir){
 if(i<1||!validIndicator(e[i])||!validIndicator(e[i-1]))return false;const x=e[i],p=e[i-1];
 if(dir==='BUY')return x.close>x.open&&crossesUp(x,p,[x.ma5h,x.ma10h,x.bb.mid],[p.ma5h,p.ma10h,p.bb.mid]);
 return x.close<x.open&&crossesDown(x,p,[x.ma5l,x.ma10l,x.bb.mid],[p.ma5l,p.ma10l,p.bb.mid]);
}
function csmAt(e,i,dir){
 if(i<1||!validIndicator(e[i])||!validIndicator(e[i-1]))return false;const x=e[i],p=e[i-1];
 if(dir==='BUY')return x.close>x.open&&x.close>x.bb.upper&&(x.open<=x.bb.upper||p.close<=p.bb.upper);
 return x.close<x.open&&x.close<x.bb.lower&&(x.open>=x.bb.lower||p.close>=p.bb.lower);
}
function latestIndex(e,from,to,pred){for(let i=Math.min(to,e.length-1);i>=Math.max(from,0);i--)if(pred(i))return i;return -1;}
function firstIndex(e,from,to,pred){for(let i=Math.max(from,0);i<=Math.min(to,e.length-1);i++)if(pred(i))return i;return -1;}
function atOrBefore(e,ms){let idx=-1;for(let i=0;i<e.length;i++){if(e[i].end<=ms)idx=i;else break;}return idx;}
function signalHoldMs(tf,opts={}){const step=(CFG.minutes[tf]||1)*MIN,minHold=Math.max(0,opts.minSignalHoldMinutes??CFG.minSignalHoldMinutes)*MIN;return Math.max(step,minHold);}
function astroGate(astro,ms,dir,now){
 if(!astro||!astro.model||!Array.isArray(astro.groups))return {ok:false,reason:'ASTROLOGY_NOT_READY'};
 const live=astro.groups.find(g=>now>=g.start&&now<g.end),event=astro.groups.find(g=>ms>=g.start&&ms<g.end);
 if(!live||!event||!side(live.state)||live.state!==event.state)return {ok:false,reason:'OUTSIDE_ASTRO_WINDOW',live:live?.state||'OUTSIDE'};
 if(dir&&live.state!==dir)return {ok:false,reason:'ASTROLOGY_DIRECTION_MISMATCH',live:live.state};
 return {ok:true,direction:live.state,window:live};
}
function firstEndAfter(e,ms){return e.findIndex(x=>x.end>ms);}
function findBbmaChain(a,b,c,pkg,dir,now,opts={}){
 const reAge=Math.max(1,Math.floor(opts.reAge??CFG.reAge));
 const tf2Age=Math.max(1,Math.floor(opts.tf2Age??CFG.tf2Age));
 const tf3Age=Math.max(1,Math.floor(opts.tf3Age??CFG.tf3Age));
 const reStart=Math.max(0,a.length-reAge);
 let best=null,latestExpired=null,sawRe=false,sawTf2Window=false,sawTf2=false,sawTf3Window=false,sawTf3=false,sawRiskInvalid=false;
 for(let ri=a.length-1;ri>=reStart;ri--){
  if(!reentryAt(a,ri,dir))continue;
  sawRe=true;const reEnd=a[ri].end,bi0=firstEndAfter(b,reEnd);if(bi0<0)continue;
  sawTf2Window=true;const bEnd=Math.min(b.length-1,bi0+tf2Age-1);
  for(let bi=bi0;bi<=bEnd;bi++){
   const csak=csakAt(b,bi,dir),csm=csmAt(b,bi,dir);if(!csak&&!csm)continue;
   sawTf2=true;const tf2Type=csak?'CSAK':'CSM',confirmEnd=b[bi].end,ci0=firstEndAfter(c,confirmEnd);if(ci0<0)continue;
   sawTf3Window=true;const cEnd=Math.min(c.length-1,ci0+tf3Age-1);
   for(let ci=ci0;ci<=cEnd;ci++){
    if(!csmAt(c,ci,dir))continue;
    sawTf3=true;const event=c[ci],hold=signalHoldMs(pkg.tf3,opts),validUntil=event.end+hold;
    if(now<event.end)continue;
    if(now>=validUntil){
     const expired={status:'WAIT',reason:'SIGNAL_EXPIRED',direction:dir,reAt:reEnd,tf2At:confirmEnd,tf2Type,eventAt:event.end,validUntil};
     if(!latestExpired||expired.eventAt>latestExpired.eventAt||(expired.eventAt===latestExpired.eventAt&&expired.tf2At>latestExpired.tf2At))latestExpired=expired;
     continue;
    }
    const t2idx=atOrBefore(b,event.end),t2=b[t2idx];if(!t2||!validIndicator(t2))continue;
    const entry=event.close,buffer=finite(opts.slBuffer)?opts.slBuffer:CFG.slBuffer;
    const sl=dir==='BUY'?t2.bb.lower-buffer:t2.bb.upper+buffer,risk=Math.abs(entry-sl),rr=finite(opts.rr)?opts.rr:CFG.rr,tp=dir==='BUY'?entry+risk*rr:entry-risk*rr;
    if(!(risk>0&&finite(tp))){sawRiskInvalid=true;continue;}
    const candidate={status:'VALID',direction:dir,package:pkg.id,reAt:reEnd,tf2At:confirmEnd,tf2Type,eventAt:event.end,validUntil,entry,sl,tp,rr,tf1Label:'RE-ENTRY '+dir,tf2Label:tf2Type+' '+dir,tf3Label:'CSM '+dir};
    if(!best||candidate.eventAt>best.eventAt||
      (candidate.eventAt===best.eventAt&&candidate.tf2At>best.tf2At)||
      (candidate.eventAt===best.eventAt&&candidate.tf2At===best.tf2At&&candidate.reAt>best.reAt))best=candidate;
   }
  }
 }
 if(best)return best;
 if(latestExpired)return latestExpired;
 if(!sawRe)return {status:'WAIT',reason:'TF1_REENTRY_WAIT',direction:dir};
 if(!sawTf2Window)return {status:'WAIT',reason:'TF2_AFTER_REENTRY_WAIT',direction:dir};
 if(!sawTf2)return {status:'WAIT',reason:'TF2_CSAK_CSM_WAIT',direction:dir};
 if(!sawTf3Window)return {status:'WAIT',reason:'TF3_AFTER_TF2_WAIT',direction:dir};
 if(!sawTf3)return {status:'WAIT',reason:'TF3_CSM_WAIT',direction:dir};
 if(sawRiskInvalid)return {status:'WAIT',reason:'RISK_INVALID',direction:dir};
 return {status:'WAIT',reason:'TF3_CSM_WAIT',direction:dir};
}
function bbmaDirection(data,pkg,dir,now,opts={}){
 const a=enrich(data[pkg.tf1]||[]),b=enrich(data[pkg.tf2]||[]),c=enrich(data[pkg.tf3]||[]);
 if(a.length<CFG.bbPeriod+2||b.length<CFG.bbPeriod+2||c.length<CFG.bbPeriod+2)return {status:'WAIT',reason:'DATA_KURANG',direction:dir};
 return findBbmaChain(a,b,c,pkg,dir,now,opts);
}
function bbmaPackage(data,pkg,astro,now=Date.now(),opts={}){
 const buy=bbmaDirection(data,pkg,'BUY',now,opts),sell=bbmaDirection(data,pkg,'SELL',now,opts);
 const active=[buy,sell].filter(x=>x.status==='VALID');if(active.length>1)return {status:'CONFLICT',package:pkg.id,reason:'BUY_SELL_OVERLAP',buy,sell};
 const raw=active[0]||null;if(!raw)return {status:'WAIT',package:pkg.id,reason:`BUY:${buy.reason} | SELL:${sell.reason}`,buy,sell};
 const g=astroGate(astro,raw.eventAt,raw.direction,now);if(!g.ok)return {...raw,status:'WAIT',reason:g.reason,rawDirection:raw.direction,astro:g};
 return {...raw,status:'VALID',astro:g};
}
function pivots(bars,depth=CFG.liquidityPivotDepth){
 const highs=[],lows=[];for(let i=depth;i<bars.length-depth;i++){let hi=true,lo=true;for(let k=1;k<=depth;k++){if(bars[i].high<=bars[i-k].high||bars[i].high<bars[i+k].high)hi=false;if(bars[i].low>=bars[i-k].low||bars[i].low>bars[i+k].low)lo=false;}const knownAt=bars[i+depth].end;if(hi)highs.push({i,price:bars[i].high,knownAt,type:'SWING_HIGH'});if(lo)lows.push({i,price:bars[i].low,knownAt,type:'SWING_LOW'});}return {highs,lows};
}
function mapLiquidity(bars,dir,opts={}){
 const lookback=Math.max(15,Math.floor(opts.liquidityLookback??CFG.liquidityLookback));
 if(bars.length<15)return [];
 const offset=Math.max(0,bars.length-lookback),work=bars.slice(offset),p=pivots(work);
 const ranges=work.slice(-30).map(x=>x.high-x.low),tol=Math.max(1e-9,(median(ranges)||0)*CFG.equalToleranceRange);
 const src=dir==='BUY'?p.lows:p.highs,out=[];
 for(const x of src.slice(-12))out.push({price:x.price,knownAt:x.knownAt,type:x.type,index:x.i+offset});
 for(let i=1;i<src.length;i++){
  const a=src[i-1],b=src[i];
  if(Math.abs(a.price-b.price)<=tol)out.push({price:(a.price+b.price)/2,knownAt:Math.max(a.knownAt,b.knownAt),type:dir==='BUY'?'EQUAL_LOW':'EQUAL_HIGH',index:b.i+offset});
 }
 return out.sort((a,b)=>b.knownAt-a.knownAt).slice(0,12);
}
function medianBody(bars,endIdx,look=20){return median(bars.slice(Math.max(0,endIdx-look+1),endIdx+1).map(x=>Math.abs(x.close-x.open)));}
function findLiquiditySetup(data,pkg,dir,now,opts={}){
 const t1=data[pkg.tf1]||[],t2=data[pkg.tf2]||[],t3=data[pkg.tf3]||[];
 if(t1.length<20||t2.length<25||t3.length<20)return {status:'WAIT',reason:'DATA_KURANG',direction:dir};
 const levels=mapLiquidity(t1,dir,opts);if(!levels.length)return {status:'WAIT',reason:'TF1_LIQUIDITY_WAIT',direction:dir};
 const scanStart=Math.max(1,t2.length-(opts.sweepSearch??CFG.sweepSearch));
 let best=null,latestExpired=null;
 for(let li=0;li<levels.length;li++){
  const level=levels[li];
  for(let i=scanStart;i<t2.length;i++){
   const s=t2[i];if(s.end<level.knownAt)continue;
   const swept=dir==='BUY'?(s.low<level.price&&s.close>level.price):(s.high>level.price&&s.close<level.price);
   if(!swept)continue;
   const sweepExtreme=dir==='BUY'?s.low:s.high;
   const pre=t2.slice(Math.max(0,i-(opts.structureLookback??CFG.structureLookback)),i);
   if(pre.length<3)continue;
   const structure=dir==='BUY'?Math.max(...pre.map(x=>x.high)):Math.min(...pre.map(x=>x.low));
   let di=-1;
   for(let j=i;j<=Math.min(t2.length-1,i+(opts.displacementBars??CFG.displacementBars));j++){
    const x=t2[j],mb=medianBody(t2,j-1)||medianBody(t2,j)||0,body=Math.abs(x.close-x.open);
    const directional=dir==='BUY'?x.close>x.open:x.close<x.open;
    const broken=dir==='BUY'?x.close>structure:x.close<structure;
    if(directional&&broken&&body>=mb*(opts.displacementBodyMultiple??CFG.displacementBodyMultiple)){di=j;break;}
   }
   if(di<0)continue;
   const d=t2[di],breakAt=d.end,ci0=t3.findIndex(x=>x.end>=breakAt);if(ci0<0)continue;
   for(let k=t3.length-1;k>=ci0;k--){
    const x=t3[k],retest=dir==='BUY'?(x.low<=structure&&x.close>structure):(x.high>=structure&&x.close<structure);
    if(!retest)continue;
    const hold=signalHoldMs(pkg.tf3,opts),validUntil=x.end+hold;
    if(now<x.end)continue;
    if(now>=validUntil){
     if(!latestExpired||x.end>latestExpired.eventAt)latestExpired={status:'WAIT',reason:'SIGNAL_EXPIRED',direction:dir,eventAt:x.end,validUntil};
     continue;
    }
    const buffer=finite(opts.slBuffer)?opts.slBuffer:CFG.slBuffer,entry=x.close,sl=dir==='BUY'?sweepExtreme-buffer:sweepExtreme+buffer;
    const risk=Math.abs(entry-sl),rr=finite(opts.rr)?opts.rr:CFG.rr,tp=dir==='BUY'?entry+risk*rr:entry-risk*rr;
    if(!(risk>0&&finite(tp)))continue;
    const candidate={status:'VALID',direction:dir,package:pkg.id,liquidityType:level.type,liquidity:level.price,sweepAt:s.end,sweepExtreme,breakAt,structure,eventAt:x.end,validUntil,entry,sl,tp,rr,tf1Label:`${level.type} ${level.price.toFixed(2)}`,tf2Label:`SWEEP + DISPLACEMENT + BREAK ${dir}`,tf3Label:`RETEST ${dir}`};
    if(!best||candidate.eventAt>best.eventAt||(candidate.eventAt===best.eventAt&&candidate.sweepAt>best.sweepAt))best=candidate;
    break;
   }
  }
 }
 if(best)return best;
 if(latestExpired)return latestExpired;
 return {status:'WAIT',reason:'SWEEP_BREAK_RETEST_WAIT',direction:dir};
}
function liquidityPackage(data,pkg,astro,now=Date.now(),opts={}){
 const buy=findLiquiditySetup(data,pkg,'BUY',now,opts),sell=findLiquiditySetup(data,pkg,'SELL',now,opts),active=[buy,sell].filter(x=>x.status==='VALID');
 if(active.length>1)return {status:'CONFLICT',package:pkg.id,reason:'BUY_SELL_OVERLAP',buy,sell};const raw=active[0]||null;if(!raw)return {status:'WAIT',package:pkg.id,reason:`BUY:${buy.reason} | SELL:${sell.reason}`,buy,sell};
 const g=astroGate(astro,raw.eventAt,raw.direction,now);if(!g.ok)return {...raw,status:'WAIT',reason:g.reason,rawDirection:raw.direction,astro:g};return {...raw,status:'VALID',astro:g};
}
function scanAll(data,astro,now=Date.now(),opts={}){
 const bbma=CFG.packages.map(p=>bbmaPackage(data,p,astro,now,opts));const liquidity=CFG.packages.map(p=>liquidityPackage(data,p,astro,now,opts));
 const b=bbma.filter(x=>x.status==='VALID'),l=liquidity.filter(x=>x.status==='VALID');const bSides=[...new Set(b.map(x=>x.direction))],lSides=[...new Set(l.map(x=>x.direction))];
 let final='WAIT',reason='NO_VALID_PACKAGE';if(bSides.length>1||lSides.length>1||(bSides[0]&&lSides[0]&&bSides[0]!==lSides[0])){final='CONFLICT';reason='BBMA_LIQUIDITY_CONFLICT';}else{const d=bSides[0]||lSides[0];if(d){final=(b.length&&l.length?'STRONG ':'')+d;reason=b.length&&l.length?'BOTH_ENGINES_ALIGNED':b.length?'BBMA_VALID':'LIQUIDITY_VALID';}}
 return {version:VERSION,bbma,liquidity,final,reason,executionEnabled:false};
}
function cutProfitDecision(dir,reachedR,oppositeCsm,tf2Close,tf2Mid){if(!side(dir)||!reachedR)return false;if(oppositeCsm===opposite(dir))return true;if(!finite(tf2Close)||!finite(tf2Mid))return false;return dir==='BUY'?tf2Close<tf2Mid:tf2Close>tf2Mid;}
const API=Object.freeze({CFG,mean,median,lwma,sma,bb,enrich,reentryAt,csakAt,csmAt,firstEndAfter,signalHoldMs,findBbmaChain,astroGate,bbmaDirection,bbmaPackage,pivots,mapLiquidity,findLiquiditySetup,liquidityPackage,scanAll,cutProfitDecision});
root.CebonkTechnicalScanners=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
