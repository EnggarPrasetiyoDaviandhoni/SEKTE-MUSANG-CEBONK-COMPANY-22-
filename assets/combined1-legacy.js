/* COMBINED 1 RESTORED. Calculation source 3ead2e75c4b6f014e6fad163aaf6d05cef71c009. No SND / mandatory break-retest filter. */
(function(root){
'use strict';
const API_BASE='https://cebonk-xau-api.enggarprasetiyo330.workers.dev/xau';
const $=id=>document.getElementById(id);
const PIVOT_DEPTH=2,SL_BUFFER_ATR=0.15,ENTRY_HOLD_BARS=5;
let loading=false,lastRequest=0;
function parseUtc(s){return new Date(String(s).replace(' ','T')+'Z').getTime();}
function wib(ms){return new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms))+' WIB';}
function n(v,d=2){return Number.isFinite(v)?v.toFixed(d):'—';}
function sma(values,period){
 if(values.length<period)return NaN;
 return values.slice(-period).reduce((a,b)=>a+b,0)/period;
}
function trendMA(candles){
 const closes=candles.map(c=>c.close),ma20=sma(closes,20),ma50=sma(closes,50);
 const direction=!Number.isFinite(ma20)||!Number.isFinite(ma50)?'WAIT':ma20>ma50?'BUY':ma20<ma50?'SELL':'WAIT';
 return {ma20,ma50,direction};
}
function atr(candles,period=14){
 if(candles.length<=period) return NaN;
 const tr=[];for(let i=1;i<candles.length;i++){const c=candles[i],p=candles[i-1];tr.push(Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close)));}
 return tr.slice(-period).reduce((a,b)=>a+b,0)/period;
}
function pivots(candles,depth=PIVOT_DEPTH){
 const highs=[],lows=[];
 for(let i=depth;i<candles.length-depth;i++){
  let ph=true,pl=true;
  for(let k=1;k<=depth;k++){
   if(candles[i].high<=candles[i-k].high||candles[i].high<candles[i+k].high) ph=false;
   if(candles[i].low>=candles[i-k].low||candles[i].low>candles[i+k].low) pl=false;
  }
  if(ph) highs.push({i,price:candles[i].high,ms:candles[i].ms});
  if(pl) lows.push({i,price:candles[i].low,ms:candles[i].ms});
 }
 return {highs,lows};
}
function latestStructure(p){
 if(p.highs.length<2||p.lows.length<2) return {direction:'WAIT',label:'Struktur belum cukup'};
 const h1=p.highs[p.highs.length-2],h2=p.highs[p.highs.length-1],l1=p.lows[p.lows.length-2],l2=p.lows[p.lows.length-1];
 if(h2.price>h1.price&&l2.price>l1.price) return {direction:'BUY',label:'HH + HL'};
 if(h2.price<h1.price&&l2.price<l1.price) return {direction:'SELL',label:'LH + LL'};
 return {direction:'WAIT',label:'Mixed / transition'};
}
function makeSellSetup(candles,p){
 if(p.highs.length<2) return null;
 const h1=p.highs[p.highs.length-2],h2=p.highs[p.highs.length-1];
 if(h2.price<=h1.price) return null;
 const between=p.lows.filter(x=>x.i>h1.i&&x.i<h2.i);
 if(!between.length) return null;
 const cb1=between.reduce((a,b)=>b.price<a.price?b:a);
 const touchIndex=candles.findIndex((c,i)=>i>h2.i&&c.low<=cb1.price&&c.high>=cb1.price);
 return {direction:'SELL',anchor0:h2,cb1,touchIndex};
}
function makeBuySetup(candles,p){
 if(p.lows.length<2) return null;
 const l1=p.lows[p.lows.length-2],l2=p.lows[p.lows.length-1];
 if(l2.price>=l1.price) return null;
 const between=p.highs.filter(x=>x.i>l1.i&&x.i<l2.i);
 if(!between.length) return null;
 const cb1=between.reduce((a,b)=>b.price>a.price?b:a);
 const touchIndex=candles.findIndex((c,i)=>i>l2.i&&c.low<=cb1.price&&c.high>=cb1.price);
 return {direction:'BUY',anchor0:l2,cb1,touchIndex};
}
function bestSetup(candles,p){
 const s=makeSellSetup(candles,p),b=makeBuySetup(candles,p);
 return [s,b].filter(Boolean).sort((x,y)=>y.anchor0.i-x.anchor0.i)[0]||null;
}
function fibPrices(direction,a0,a100){
 const range=Math.abs(a0-a100),f=r=>direction==='SELL'?a0-r*range:a0+r*range;
 return {'0.0':f(0),'23.6':f(.236),'38.2':f(.382),'50.0':f(.5),'61.8':f(.618),'100.0':f(1),'161.8':f(1.618),'200.0':f(2),'261.8':f(2.618),'423.6':f(4.236)};
}
function rr(entry,sl,tp){const risk=Math.abs(entry-sl),reward=Math.abs(tp-entry);return risk>0?reward/risk:NaN;}
function ruleHtml(label,ok,detail){return '<div class="rule '+(ok?'ok':'bad')+'"><b>'+(ok?'✓ ':'✕ ')+label+'</b><span>'+detail+'</span></div>';}


function calculate(candles,m5,m15){
  const last=candles[candles.length-1],a=atr(candles,14),p=pivots(candles),setup=bestSetup(candles,p);
  const trend5=trendMA(m5),trend15=trendMA(m15);
  let signal='WAIT',stage='NO SETUP',entry=NaN,sl=NaN,tp1=NaN,tp2=NaN,tp3=NaN,fib=null,direction='WAIT',entryMs=NaN,touchFresh=false;
  if(setup){
   direction=setup.direction;
   fib=fibPrices(direction,setup.anchor0.price,setup.cb1.price);
   entry=setup.cb1.price;
   sl=direction==='SELL'?setup.anchor0.price+SL_BUFFER_ATR*a:setup.anchor0.price-SL_BUFFER_ATR*a;
   tp1=fib['161.8'];tp2=fib['261.8'];tp3=fib['423.6'];
   if(setup.touchIndex>=0){
    entryMs=candles[setup.touchIndex].ms;
    const barsAgo=(candles.length-1)-setup.touchIndex;
    touchFresh=barsAgo<=ENTRY_HOLD_BARS;
    const trendAligned=trend5.direction===direction&&trend15.direction===direction;
    stage=touchFresh?(trendAligned?'CB1 ENTRY + TREND OK':'CB1 TOUCH / TREND WAIT'):'CB1 TOUCHED / EXPIRED';
    if(touchFresh&&trendAligned)signal=direction;
   }else stage='WAIT CB1 TOUCH';
  }
  const ageMin=Math.max(0,Math.round((Date.now()-last.ms)/60000));
  return {last,a,p,setup,trend5,trend15,signal,stage,entry,sl,tp1,tp2,tp3,fib,direction,entryMs,touchFresh,ageMin};
}

const core=Object.freeze({sourceRef:'3ead2e75c4b6f014e6fad163aaf6d05cef71c009',sma,trendMA,atr,pivots,makeBuySetup,makeSellSetup,bestSetup,fibPrices,rr,calculate});
root.CebonkCombined1=core;if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(typeof document==='undefined')return;
async function refreshTech(){
 if(loading)return;if(Date.now()-lastRequest<65000){renderGuard();return;}lastRequest=Date.now();root.CEBONK_C1_TECH_STATE=null;clearDecision('Nganyari data COMBINED 1…');loading=true;$('techRefresh').disabled=true;$('techStatus').textContent='Mengambil M1 + M5 + M15…';
 try{
  const urls=[
   API_BASE+'?interval=1min&outputsize=500',
   API_BASE+'?interval=5min&outputsize=100',
   API_BASE+'?interval=15min&outputsize=100'
  ];
  const responses=await Promise.all(urls.map(u=>fetch(u,{cache:'no-store'})));
  const payloads=await Promise.all(responses.map(r=>r.json()));
  for(let i=0;i<responses.length;i++)if(!responses[i].ok||!payloads[i].ok)throw new Error(payloads[i].message||payloads[i].error||('HTTP '+responses[i].status));
  const parse=x=>(x.values||[]).map(v=>({ms:parseUtc(v.datetime),open:+v.open,high:+v.high,low:+v.low,close:+v.close})).filter(c=>Number.isFinite(c.close)).sort((a,b)=>a.ms-b.ms);
  const candles=parse(payloads[0]),m5=parse(payloads[1]),m15=parse(payloads[2]);
  if(candles.length<100||m5.length<50||m15.length<50)throw new Error('Data MA durung cukup.');
  const {last,a,p,setup,trend5,trend15,signal,stage,entry,sl,tp1,tp2,tp3,fib,direction,entryMs,touchFresh,ageMin}=calculate(candles,m5,m15);
  $('techSignal').textContent=signal;$('techSignal').className='tech-signal '+(signal==='BUY'?'buy':signal==='SELL'?'sell':'neutral');
  $('techScore').textContent=setup?direction+' CB1 setup':'Ora ana setup valid';
  $('techStage').textContent=stage;$('techStructure').textContent='M5 '+trend5.direction+' · M15 '+trend15.direction;
  $('techEntry').textContent=setup?n(entry):'—';$('techSL').textContent=setup?n(sl):'—';$('techTP1').textContent=setup?n(tp1):'—';$('techTP2').textContent=setup?n(tp2):'—';$('techTP3').textContent=setup?n(tp3):'—';
  $('techRR1').textContent=setup?'RR 1:'+n(rr(entry,sl,tp1),2):'—';$('techRR2').textContent=setup?'RR 1:'+n(rr(entry,sl,tp2),2):'—';$('techRR3').textContent=setup?'RR 1:'+n(rr(entry,sl,tp3),2):'—';
  $('techAtr').textContent=n(a);$('techAge').textContent='umur candle '+ageMin+' menit';
  $('techFib0').textContent=setup?n(setup.anchor0.price):'—';$('techFib100').textContent=setup?n(setup.cb1.price):'—';
  $('techCB1').textContent=setup?n(setup.cb1.price):'—';$('techCB1State').textContent=setup?(setup.touchIndex>=0?'TOUCHED':'MENUNGGU TOUCH'):'—';
  $('techZone').textContent=trend5.direction;$('techZone').className=trend5.direction==='BUY'?'buy':trend5.direction==='SELL'?'sell':'neutral';$('techZoneState').textContent='MA20 '+n(trend5.ma20)+' · MA50 '+n(trend5.ma50)+' | M15 '+trend15.direction+' ('+n(trend15.ma20)+' / '+n(trend15.ma50)+')';
  $('techCandleTime').textContent=setup&&setup.touchIndex>=0?wib(entryMs):wib(last.ms);
  $('techUpdated').textContent='Update '+wib(Date.now());$('techStatus').textContent='Feed M1/M5/M15 aktif · trend MA20/MA50 · provider '+payloads[0].provider;
  $('techFeed').textContent=ageMin<=5?'LIVE':'STALE';$('techFeed').className='badge '+(ageMin<=5?'buy':'transition');

  const trendAligned=!!setup&&trend5.direction===direction&&trend15.direction===direction;
  const rules=[
   ['Trend M5 MA20/MA50',!!setup&&trend5.direction===direction,'MA20 '+n(trend5.ma20)+' · MA50 '+n(trend5.ma50)+' → '+trend5.direction],
   ['Trend M15 MA20/MA50',!!setup&&trend15.direction===direction,'MA20 '+n(trend15.ma20)+' · MA50 '+n(trend15.ma50)+' → '+trend15.direction],
   ['CB1 terbentuk',!!setup,setup?('CB1 '+n(setup.cb1.price)):'Belum ada'],
   ['Harga touch CB1',!!setup&&setup.touchIndex>=0,setup&&setup.touchIndex>=0?wib(entryMs):'Belum touch'],
   ['ENTRY valid',touchFresh&&trendAligned,touchFresh&&trendAligned?direction+' · M5+M15 SELARAS':'WAIT']
  ];
  $('techRules').innerHTML=rules.map(x=>ruleHtml(x[0],x[1],x[2])).join('');
  $('techFibBody').innerHTML=fib?Object.entries(fib).map(([k,v])=>'<tr><td>'+k+'</td><td>'+n(v)+'</td><td>'+(k==='100.0'?'CB1 / ENTRY':k==='161.8'?'TP1':k==='261.8'?'TP2':k==='423.6'?'TP3':k==='0.0'?'Swing 0':'Retracement / extension')+'</td></tr>').join(''):'<tr><td colspan="3">Belum ada Fibo valid.</td></tr>';
  $('techCandleBody').innerHTML=candles.slice(-20).reverse().map(c=>'<tr><td class="mono">'+wib(c.ms)+'</td><td>'+n(c.open)+'</td><td>'+n(c.high)+'</td><td>'+n(c.low)+'</td><td>'+n(c.close)+'</td></tr>').join('');

  root.CEBONK_C1_TECH_STATE={signal,direction,stage,entry,sl,tp:tp2,tp1,tp2,tp3,rr1:rr(entry,sl,tp1),rr2:rr(entry,sl,tp2),rr3:rr(entry,sl,tp3),lastMs:last.ms,entryMs,lastClose:last.close,atr:a,ageMin,updatedMs:Date.now(),cb1:setup?.cb1?.price??NaN,trend5,trend15};
  root.dispatchEvent(new Event('cebonk-c1-update'));
 }catch(e){
  root.CEBONK_C1_TECH_STATE=null;clearDecision('DATA ERROR: '+e.message);
  $('techStatus').textContent='Gagal: '+e.message;$('techFeed').textContent='ERROR';$('techFeed').className='badge sell';
 }finally{loading=false;$('techRefresh').disabled=false;}
}


function comboFmt(v){return Number.isFinite(v)?v.toFixed(2):'—';}
function comboWib(ms){return Number.isFinite(ms)?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ms))+' WIB':'—';}
function renderCombined(){
 const a=root.CEBONK_ASTRO_STATE,t=root.CEBONK_C1_TECH_STATE;
 if(!a){$('comboAstro').textContent='NO DATA';$('comboAstro').className='neutral';$('comboDecision').textContent='WAIT';$('comboReason').textContent='Astrology durung siap.';return;}
 $('comboAstroDate').textContent=a.iso||'—';
 if(!t){$('comboTech').textContent='NO DATA';$('comboTech').className='neutral';$('comboDecision').textContent='WAIT';$('comboReason').textContent='Fibo Musang durung siap.';return;}
 const eventMs=Number.isFinite(t.entryMs)?t.entryMs:t.lastMs;
 const g=(a.groups||[]).find(x=>eventMs>=x.start&&eventMs<x.end)||null;
 const astroState=g?g.state:'OUTSIDE',validAstro=astroState==='BUY'||astroState==='SELL',aligned=validAstro&&astroState===t.signal;
 const decision=aligned?'ENTRY '+astroState:'WAIT';
 $('comboAstro').textContent=astroState;$('comboAstro').className=astroState==='BUY'?'buy':astroState==='SELL'?'sell':'neutral';
 $('comboWindow').textContent=g?(comboWib(g.start)+' – '+comboWib(g.end)):'Ora ana window Astrology ing event CB1';
 $('comboTech').textContent=t.signal;$('comboTech').className=t.signal==='BUY'?'buy':t.signal==='SELL'?'sell':'neutral';
 $('comboTechScore').textContent=t.direction+' · '+t.stage;
 $('comboDecision').textContent=decision;$('comboDecision').className=aligned?(astroState==='BUY'?'buy':'sell'):'neutral';
 $('comboStatus').textContent=aligned?'SELARAS':'WAIT';$('comboStatus').className='badge '+(aligned?(astroState==='BUY'?'buy':'sell'):'neutral');
 $('comboReason').textContent=aligned?'Astrology searah + CB1 touch + MA20/MA50 M5 & M15 selaras → entry.':!validAstro?('Astrology '+astroState+' → ora entry.'):(t.signal==='WAIT'?'CB1 durung aktif, wis expired, utawa trend M5/M15 ora selaras.':'Arah beda: Astro '+astroState+' vs CB1 '+t.signal+'.');
 $('comboEntry').textContent=aligned?comboFmt(t.entry):'—';$('comboSL').textContent=aligned?comboFmt(t.sl):'—';
 $('comboTP1').textContent=aligned?comboFmt(t.tp1):'—';$('comboTP2').textContent=aligned?comboFmt(t.tp2):'—';$('comboTP3').textContent=aligned?comboFmt(t.tp3):'—';
 $('comboRR1').textContent=aligned&&Number.isFinite(t.rr1)?'RR 1:'+comboFmt(t.rr1):'—';$('comboRR2').textContent=aligned&&Number.isFinite(t.rr2)?'RR 1:'+comboFmt(t.rr2):'—';$('comboRR3').textContent=aligned&&Number.isFinite(t.rr3)?'RR 1:'+comboFmt(t.rr3):'—';
 $('comboEntryTime').textContent=aligned?comboWib(eventMs):'—';$('comboCandle').textContent=comboWib(eventMs);
}

function clearDecision(reason){
 for(const id of ['comboDecision','comboStatus']){if($(id)){$(id).textContent='WAIT';$(id).className=id==='comboStatus'?'badge neutral':'neutral';}}
 for(const id of ['comboEntry','comboSL','comboTP1','comboTP2','comboTP3','comboRR1','comboRR2','comboRR3','comboEntryTime'])if($(id))$(id).textContent='—';
 if($('comboReason'))$('comboReason').textContent=reason;
 root.CEBONK_C1_STATE={mode:'COMBINED_1',decision:'WAIT',reason,executionEnabled:false,sourceRef:core.sourceRef};
}
function renderGuard(){
 if(!$('comboDecision'))return;
 const t=root.CEBONK_C1_TECH_STATE,a=root.CEBONK_ASTRO_STATE,now=Date.now();
 if(!t){clearDecision('Nunggu data anyar COMBINED 1.');return;}
 // Display-health guards only. Old MA/CB1/Fibo/ATR calculations remain verbatim.
 if(!Number.isFinite(t.lastMs)||now<t.lastMs||now-t.lastMs>300000||now-t.updatedMs>360000){clearDecision('DATA STALE — ora nampilke entry lawas.');return;}
 if(!a||!a.model||$('results')?.dataset.stale==='true'||$('dateInput')?.value!==a.iso||!$('modelEnabled')?.checked){clearDecision('Astrology durung siap / setelan wis berubah.');return;}
 const eventMs=Number.isFinite(t.entryMs)?t.entryMs:t.lastMs;
 const eventWindow=a.groups.find(g=>eventMs>=g.start&&eventMs<g.end),live=a.groups.find(g=>now>=g.start&&now<g.end);
 if(!eventWindow||!live||eventWindow.start!==live.start||eventWindow.state!==live.state){clearDecision('Window Astrology wis rampung / tanggal ora saiki.');return;}
 renderCombined();
 root.CEBONK_C1_STATE={mode:'COMBINED_1',decision:$('comboDecision').textContent,reason:$('comboReason').textContent,technical:t,sourceRef:core.sourceRef,executionEnabled:false};
}
function mount(){
 const view=$('combinedView');if(!view||$('c1Refresh'))return;
 view.innerHTML="<header class=\"hero\"><div><div class=\"eyebrow\">COMBINED 1 · SOP LAWAS DIPULIHKE</div><h2>ASTROLOGY + MA20/50 + CB1</h2><p>M15 trend → M5 trend → M1 Fibo Musang CB1 touch. Ora nganggo filter SND/SNR.</p></div></header><div class=\"note\">SOP custom lawas saka 3ead2e75. Sinyal web dudu order MT5. Model durung divalidasi; data lawas/error ora ditampilke dadi entry anyar.</div><div class=\"tech-actions\"><button id=\"c1Refresh\" class=\"primary\" type=\"button\">REFRESH COMBINED 1</button><span id=\"c1FeedStatus\" role=\"status\">Data M1 / M5 / M15</span></div>\n <section class=\"panel\">\n  <div class=\"head\"><div><h2>COMBINED 1 — SOP LAWAS</h2><small>Astrology = master arah/jam. Fibo Musang M1 = CB1 entry.</small></div><span class=\"badge neutral\" id=\"comboStatus\">WAIT</span></div>\n  <div class=\"tech-grid\">\n   <div class=\"tech-card\"><span class=\"label\">Astrology aktif</span><strong id=\"comboAstro\" class=\"neutral\">—</strong><small id=\"comboWindow\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Fibo Musang</span><strong id=\"comboTech\" class=\"neutral\">—</strong><small id=\"comboTechScore\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Keputusan</span><strong id=\"comboDecision\" class=\"neutral\">WAIT</strong><small id=\"comboReason\">Menunggu data.</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Entry</span><strong id=\"comboEntry\">—</strong><small id=\"comboEntryTime\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Stop Loss</span><strong id=\"comboSL\">—</strong><small>Di luar swing 0 + buffer</small></div>\n   <div class=\"tech-card\"><span class=\"label\">TP1 · 161.8</span><strong id=\"comboTP1\">—</strong><small id=\"comboRR1\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">TP2 · 261.8</span><strong id=\"comboTP2\">—</strong><small id=\"comboRR2\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">TP3 · 423.6</span><strong id=\"comboTP3\">—</strong><small id=\"comboRR3\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Astro date</span><strong id=\"comboAstroDate\">—</strong><small>Jadwal WIB sing lagi dihitung</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Candle M1</span><strong id=\"comboCandle\">—</strong><small>Feed Twelve Data</small></div>\n  </div>\n  <div class=\"tech-warn\">ENTRY mung metu yen Astrology + arah CB1 + MA20/MA50 M5 + MA20/MA50 M15 kabeh selaras. Ora nunggu CB1 break utawa retest Zone IB. NEUTRAL / TRANSITION / trend beda = WAIT.</div>\n </section>\n<details id=\"c1TechnicalDetail\"><summary>Rincian MA20/50, CB1, SL & target — SOP lawas</summary><section id=\"technicalView\">\n <section class=\"panel\">\n  <div class=\"head\"><div><h2>Fibo Musang — CB1 Entry</h2><small>Execution M1 · trend filter mung MA20/MA50 M5 + M15 · touch CB1 = ENTRY</small></div><span class=\"badge neutral\" id=\"techFeed\">OFFLINE</span></div>\n  <div class=\"tech-status\"><span id=\"techStatus\">Belum mengambil data.</span><span id=\"techUpdated\" class=\"mono\">—</span></div>\n  <div class=\"tech-grid\">\n   <div class=\"tech-card\"><span class=\"label\">Signal</span><strong id=\"techSignal\" class=\"tech-signal neutral\">WAIT</strong><small id=\"techScore\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Stage</span><strong id=\"techStage\">—</strong><small id=\"techStructure\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">CB1 / Entry</span><strong id=\"techEntry\">—</strong><small id=\"techCandleTime\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Stop Loss</span><strong id=\"techSL\">—</strong><small>Swing 0 + buffer ATR</small></div>\n   <div class=\"tech-card\"><span class=\"label\">TP1 · 161.8</span><strong id=\"techTP1\">—</strong><small id=\"techRR1\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">TP2 · 261.8</span><strong id=\"techTP2\">—</strong><small id=\"techRR2\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">TP3 · 423.6</span><strong id=\"techTP3\">—</strong><small id=\"techRR3\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">ATR(14) M1</span><strong id=\"techAtr\">—</strong><small id=\"techAge\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Fibo 0.0</span><strong id=\"techFib0\">—</strong><small>Swing anchor</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Fibo 100 / CB1</span><strong id=\"techFib100\">—</strong><small>ENTRY level</small></div>\n   <div class=\"tech-card\"><span class=\"label\">CB1</span><strong id=\"techCB1\">—</strong><small id=\"techCB1State\">—</small></div>\n   <div class=\"tech-card\"><span class=\"label\">Trend M5</span><strong id=\"techZone\">—</strong><small id=\"techZoneState\">—</small></div>\n  </div>\n  <div class=\"tech-actions\">\n   <button class=\"primary\" id=\"techRefresh\" type=\"button\">Refresh Fibo Musang</button>\n   <label class=\"check\"><input id=\"techAuto\" type=\"checkbox\" checked><span>Auto refresh 5 menit</span></label>\n  </div>\n </section>\n <section class=\"panel\">\n  <div class=\"head\"><div><h2>Rule Fibo Musang — CB1 Entry</h2><small>Trend mung MA20/MA50 M5 lan M15. CB1 break ora ditunggu.</small></div></div>\n  <div class=\"rulelist\" id=\"techRules\"><div class=\"empty\">Belum ada data.</div></div>\n  <div class=\"tech-warn\">CB1 M1 dadi level entry. BUY/SELL mung valid yen MA20 vs MA50 ing M5 lan M15 selaras karo arah CB1. Fibo 0→CB1(100), target 161.8 / 261.8 / 423.6.</div>\n </section>\n <section class=\"panel\">\n  <div class=\"head\"><div><h2>Level Fibo aktif</h2><small>0 / 23.6 / 38.2 / 50 / 61.8 / 100(CB1) / 161.8 / 200 / 261.8 / 423.6</small></div></div>\n  <div class=\"scroller\"><table><thead><tr><th>Level</th><th>Harga</th><th>Keterangan</th></tr></thead><tbody id=\"techFibBody\"><tr><td colspan=\"3\">—</td></tr></tbody></table></div>\n </section>\n <section class=\"panel\">\n  <div class=\"head\"><div><h2>Candle M1 terbaru</h2><small>20 candle terakhir saka backend Cloudflare Worker.</small></div></div>\n  <div class=\"scroller\"><table><thead><tr><th>Waktu WIB</th><th>Open</th><th>High</th><th>Low</th><th>Close</th></tr></thead><tbody id=\"techCandleBody\"><tr><td colspan=\"5\">—</td></tr></tbody></table></div>\n </section>\n</section></details>";
 function show(){
  ['astroView','astroNewsView','combined2View'].forEach(id=>{if($(id))$(id).hidden=true;});view.hidden=false;$('technicalView').hidden=false;
  document.querySelectorAll('.viewtab').forEach(b=>b.classList.toggle('active',b.id==='tabCombined'));
  try{history.replaceState(null,'','#combined-1');}catch(e){}refreshTech();renderGuard();
 }
 $('tabCombined').addEventListener('click',show);
 $('c1Refresh').addEventListener('click',refreshTech);$('techRefresh').addEventListener('click',refreshTech);
 root.addEventListener('cebonk-c1-update',()=>{renderGuard();$('c1FeedStatus').textContent=$('techStatus').textContent;});
 root.addEventListener('cebonk-astro-update',renderGuard);
 for(const id of ['dateInput','modelEnabled','startMinute','tzMode'])$(id)?.addEventListener('change',renderGuard);
 setInterval(()=>{if(view.hidden||document.hidden)return;renderGuard();if($('techAuto').checked&&!loading&&Date.now()-lastRequest>=300000)refreshTech();},5000);
 if(location.hash==='#combined-1')show();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
