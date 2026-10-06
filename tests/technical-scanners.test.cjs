'use strict';
const assert=require('assert');
const T=require('../assets/technical-scanners-core.js');
let n=0;const test=(name,fn)=>{fn();n++;console.log('PASS',name);};
function bar(o,h,l,c,ms=0,end=ms+60000){return {open:o,high:h,low:l,close:c,ms,end};}
function E(o,h,l,c,bb,ma,ms=0){return {...bar(o,h,l,c,ms,ms+60000),bb,ma5h:ma.m5h,ma10h:ma.m10h,ma5l:ma.m5l,ma10l:ma.m10l};}
const buyBB={mid:100,upper:110,lower:90},sellBB={mid:100,upper:110,lower:90};
test('package matrix exact',()=>assert.deepStrictEqual(T.CFG.packages.map(x=>x.id),['H4-H1-M15','H1-M15-M5','M30-M5-M1','M15-M5-M1']));
test('signal hold covers every timeframe with 5m minimum',()=>assert.deepStrictEqual(
  ['M1','M5','M15','M30','H1','H4'].map(tf=>T.signalHoldMs(tf)),
  [5,5,15,30,60,240].map(x=>x*60000)
));
test('RE-ENTRY BUY wick + close + stack',()=>{const e=[E(104,106,101,105,buyBB,{m5h:106,m10h:105,m5l:102,m10l:103})];assert(T.reentryAt(e,0,'BUY'));});
test('RE-ENTRY SELL wick + close + stack',()=>{const e=[E(96,99,94,95,sellBB,{m5h:98,m10h:97,m5l:94,m10l:95})];assert(T.reentryAt(e,0,'SELL'));});
test('RE-ENTRY invalid without wick-only body',()=>{const e=[E(102,106,101,103,buyBB,{m5h:106,m10h:105,m5l:102,m10l:103})];assert(!T.reentryAt(e,0,'BUY'));});
test('CSAK BUY',()=>{const p=E(98,101,97,99,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95});const x=E(99,108,98,106,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95},60000);assert(T.csakAt([p,x],1,'BUY'));});
test('CSAK SELL',()=>{const p=E(102,103,99,101,sellBB,{m5h:105,m10h:106,m5l:98,m10l:97});const x=E(101,102,92,94,sellBB,{m5h:105,m10h:106,m5l:98,m10l:97},60000);assert(T.csakAt([p,x],1,'SELL'));});
test('CSM BUY',()=>{const p=E(105,109,103,108,buyBB,{m5h:106,m10h:105,m5l:102,m10l:101});const x=E(108,113,107,112,buyBB,{m5h:106,m10h:105,m5l:102,m10l:101},60000);assert(T.csmAt([p,x],1,'BUY'));});
test('CSM SELL',()=>{const p=E(95,97,92,93,sellBB,{m5h:99,m10h:98,m5l:94,m10l:95});const x=E(93,94,87,88,sellBB,{m5h:99,m10h:98,m5l:94,m10l:95},60000);assert(T.csmAt([p,x],1,'SELL'));});
function buyChainBars(){
 const a=[E(104,106,101,105,buyBB,{m5h:106,m10h:105,m5l:102,m10l:103},0)];
 const b=[
  E(98,101,97,99,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95},60000),
  E(99,108,98,106,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95},120000)
 ];
 const c=[
  E(105,109,103,108,buyBB,{m5h:106,m10h:105,m5l:102,m10l:101},180000),
  E(108,113,107,112,buyBB,{m5h:106,m10h:105,m5l:102,m10l:101},240000)
 ];
 return {a,b,c};
}
function sellChainBars(){
 const a=[E(96,99,94,95,sellBB,{m5h:98,m10h:97,m5l:94,m10l:95},0)];
 const b=[
  E(102,103,99,101,sellBB,{m5h:105,m10h:106,m5l:98,m10l:97},60000),
  E(101,102,92,94,sellBB,{m5h:105,m10h:106,m5l:98,m10l:97},120000)
 ];
 const c=[
  E(95,97,92,93,sellBB,{m5h:99,m10h:98,m5l:94,m10l:95},180000),
  E(93,94,87,88,sellBB,{m5h:99,m10h:98,m5l:94,m10l:95},240000)
 ];
 return {a,b,c};
}
test('BBMA strict sequencing rejects TF2 same-close with TF1',()=>{
 const a=[E(104,106,101,105,buyBB,{m5h:106,m10h:105,m5l:102,m10l:103},0)];
 const b=[
  E(98,101,97,99,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95},-60000),
  E(99,108,98,106,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95},0)
 ];
 const c=buyChainBars().c,pkg={id:'TEST',tf3:'M1'};
 const r=T.findBbmaChain(a,b,c,pkg,'BUY',300000);
 assert.equal(r.status,'WAIT');assert.equal(r.reason,'TF2_AFTER_REENTRY_WAIT');
});
test('BBMA strict sequencing ignores same-close and uses later TF2 confirm',()=>{
 const a=[E(104,106,101,105,buyBB,{m5h:106,m10h:105,m5l:102,m10l:103},0)];
 const b=[
  E(98,101,97,99,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95},-60000),
  E(99,108,98,106,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95},0),
  E(99,108,98,106,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95},60000)
 ];
 const c=[
  E(105,109,103,108,buyBB,{m5h:106,m10h:105,m5l:102,m10l:101},120000),
  E(108,113,107,112,buyBB,{m5h:106,m10h:105,m5l:102,m10l:101},180000)
 ];
 const r=T.findBbmaChain(a,b,c,{id:'TEST',tf3:'M1'},'BUY',250000);
 assert.equal(r.status,'VALID');assert.equal(r.tf2At,120000);assert.equal(r.eventAt,240000);
});
test('BBMA TF2 age counts exactly N post-TF1 bars',()=>{
 const a=[E(104,106,101,105,buyBB,{m5h:106,m10h:105,m5l:102,m10l:103},0)];
 const b=[
  E(100,101,99,100,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95},60000),
  E(99,108,98,106,buyBB,{m5h:102,m10h:103,m5l:96,m10l:95},120000)
 ];
 const c=buyChainBars().c,pkg={id:'TEST',tf3:'M1'};
 assert.equal(T.findBbmaChain(a,b,c,pkg,'BUY',300000,{tf2Age:1}).reason,'TF2_CSAK_CSM_WAIT');
 assert.equal(T.findBbmaChain(a,b,c,pkg,'BUY',300000,{tf2Age:2}).status,'VALID');
});
test('BBMA skips expired CSM and selects newer valid CSM',()=>{
 const {a,b}=buyChainBars();
 const c=[
  E(105,109,103,108,buyBB,{m5h:106,m10h:105,m5l:102,m10l:101},180000),
  E(108,113,107,112,buyBB,{m5h:106,m10h:105,m5l:102,m10l:101},240000),
  E(105,109,103,108,buyBB,{m5h:106,m10h:105,m5l:102,m10l:101},600000),
  E(108,113,107,112,buyBB,{m5h:106,m10h:105,m5l:102,m10l:101},660000)
 ];
 const r=T.findBbmaChain(a,b,c,{id:'TEST',tf3:'M1'},'BUY',750000,{tf3Age:6});
 assert.equal(r.status,'VALID');assert.equal(r.eventAt,720000);assert(r.validUntil>750000);
});
test('BBMA BUY and SELL chain valid on all four packages',()=>{
 const buy=buyChainBars(),sell=sellChainBars();
 for(const pkg of T.CFG.packages){
  const rb=T.findBbmaChain(buy.a,buy.b,buy.c,pkg,'BUY',310000);
  const rs=T.findBbmaChain(sell.a,sell.b,sell.c,pkg,'SELL',310000);
  assert.equal(rb.status,'VALID',pkg.id+' BUY');
  assert.equal(rs.status,'VALID',pkg.id+' SELL');
  assert(rb.reAt<rb.tf2At&&rb.tf2At<rb.eventAt,pkg.id+' BUY order');
  assert(rs.reAt<rs.tf2At&&rs.tf2At<rs.eventAt,pkg.id+' SELL order');
 }
});
test('Astrology BUY alignment',()=>{const a={model:true,groups:[{state:'BUY',start:0,end:1000000}]};assert(T.astroGate(a,500000,'BUY',600000).ok);});
test('Astrology SELL alignment',()=>{const a={model:true,groups:[{state:'SELL',start:0,end:1000000}]};assert(T.astroGate(a,500000,'SELL',600000).ok);});
test('opposite Astrology waits',()=>{const a={model:true,groups:[{state:'SELL',start:0,end:1000000}]};assert.equal(T.astroGate(a,500000,'BUY',600000).reason,'ASTROLOGY_DIRECTION_MISMATCH');});
test('outside Astrology waits',()=>{const a={model:true,groups:[{state:'BUY',start:0,end:1000}]};assert.equal(T.astroGate(a,500,'BUY',2000).reason,'OUTSIDE_ASTRO_WINDOW');});
test('SL TP math BUY RR2',()=>{const e=100,sl=95,rr=2,tp=e+(e-sl)*rr;assert.equal(tp,110);});
test('SL TP math SELL RR2',()=>{const e=100,sl=105,rr=2,tp=e-(sl-e)*rr;assert.equal(tp,90);});
test('Cut profit not before +1R',()=>assert(!T.cutProfitDecision('BUY',false,'SELL',90,100)));
test('Cut profit BUY opposite CSM',()=>assert(T.cutProfitDecision('BUY',true,'SELL',101,100)));
test('Cut profit SELL opposite CSM',()=>assert(T.cutProfitDecision('SELL',true,'BUY',99,100)));
test('Cut profit BUY TF2 MidBB invalidation',()=>assert(T.cutProfitDecision('BUY',true,'WAIT',99,100)));
test('Cut profit SELL TF2 MidBB invalidation',()=>assert(T.cutProfitDecision('SELL',true,'WAIT',101,100)));
test('pivots closed confirmation',()=>{const b=[bar(1,2,0,1,0,1),bar(1,3,1,2,1,2),bar(2,5,2,4,2,3),bar(4,3,1,2,3,4),bar(2,2,0,1,4,5)];const p=T.pivots(b,2);assert.equal(p.highs[0].price,5);assert.equal(p.highs[0].knownAt,5);});
function seqBars(n,base=105){const a=[];for(let i=0;i<n;i++){const o=base+(i%3)*0.1,c=o+0.2;a.push(bar(o,Math.max(o,c)+0.3,Math.min(o,c)-0.3,c,i*60000,(i+1)*60000));}return a;}
test('Liquidity map finds swing low',()=>{const a=seqBars(30,105);a[10]={...a[10],open:102,high:103,low:100,close:102};for(const i of [8,9,11,12])a[i]={...a[i],low:101+i%2};const m=T.mapLiquidity(a,'BUY');assert(m.some(x=>x.type==='SWING_LOW'&&x.price===100));});
test('Liquidity lookback excludes stale TF1 levels',()=>{
 const a=[];for(let i=0;i<100;i++){const o=100+i;a.push(bar(o,o+1,o-1,o+.5,i*60000,(i+1)*60000));}
 a[65]={...a[65],low:1};
 assert(T.mapLiquidity(a,'BUY',{liquidityLookback:80}).some(x=>x.type==='SWING_LOW'&&x.price===1));
 assert(!T.mapLiquidity(a,'BUY',{liquidityLookback:20}).some(x=>x.price===1));
});
test('Liquidity BUY sweep displacement break retest',()=>{
 const t1=seqBars(30,105);t1[10]={...t1[10],open:102,high:103,low:100,close:102};for(const i of [8,9,11,12])t1[i]={...t1[i],low:101.5};
 const t2=seqBars(45,103);for(let i=24;i<30;i++)t2[i]={...t2[i],open:103,high:104+i%2,low:102.5,close:103.2};
 t2[30]={...t2[30],open:102,high:104,low:99,close:101};t2[31]={...t2[31],open:101,high:108,low:100.8,close:107};
 const t3=seqBars(50,107);t3[34]={...t3[34],open:107,high:108,low:105.5,close:106.8};t3[35]={...t3[35],open:106.6,high:107.5,low:103.8,close:106.5};
 const now=t3[35].end+30000,pkg={id:'TEST',tf1:'M15',tf2:'M5',tf3:'M1'};const r=T.findLiquiditySetup({M15:t1,M5:t2,M1:t3},pkg,'BUY',now,{sweepSearch:20});assert.equal(r.status,'VALID');assert.equal(r.direction,'BUY');assert(r.sl<r.entry&&r.tp>r.entry);
});
test('Liquidity skips expired retest and selects newer valid retest',()=>{
 const t1=seqBars(30,105);t1[10]={...t1[10],open:102,high:103,low:100,close:102};for(const i of [8,9,11,12])t1[i]={...t1[i],low:101.5};
 const t2=seqBars(45,103);for(let i=24;i<30;i++)t2[i]={...t2[i],open:103,high:104+i%2,low:102.5,close:103.2};
 t2[30]={...t2[30],open:102,high:104,low:99,close:101};t2[31]={...t2[31],open:101,high:108,low:100.8,close:107};
 const t3=seqBars(50,107);
 t3[31]={...t3[31],open:106.6,high:107.5,low:103.8,close:106.5};
 t3[38]={...t3[38],open:106.7,high:107.6,low:103.9,close:106.6};
 const now=t3[38].end+30000,pkg={id:'TEST',tf1:'M15',tf2:'M5',tf3:'M1'};
 const r=T.findLiquiditySetup({M15:t1,M5:t2,M1:t3},pkg,'BUY',now,{sweepSearch:20});
 assert.equal(r.status,'VALID');assert.equal(r.eventAt,t3[38].end);assert(r.validUntil>now);
});
test('Liquidity SELL sweep displacement break retest',()=>{
 const t1=seqBars(30,95);t1[10]={...t1[10],open:98,high:100,low:97,close:98};for(const i of [8,9,11,12])t1[i]={...t1[i],high:98.5};
 const t2=seqBars(45,97);for(let i=24;i<30;i++)t2[i]={...t2[i],open:97,high:97.5,low:96-i%2,close:96.8};
 t2[30]={...t2[30],open:98,high:101,low:96,close:99};t2[31]={...t2[31],open:99,high:99.2,low:92,close:93};
 const t3=seqBars(50,93);t3[35]={...t3[35],open:93.5,high:96.2,low:92.8,close:93.2};
 const now=t3[35].end+30000,pkg={id:'TEST',tf1:'M15',tf2:'M5',tf3:'M1'};const r=T.findLiquiditySetup({M15:t1,M5:t2,M1:t3},pkg,'SELL',now,{sweepSearch:20});assert.equal(r.status,'VALID');assert.equal(r.direction,'SELL');assert(r.sl>r.entry&&r.tp<r.entry);
});
console.log('TOTAL',n);
