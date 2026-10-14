/* CEBONK EVENT POLARITY FOLLOW TREND M1 v1.0.0
 * Research-only, pure astrology, based on independent minute-by-minute M1 positions.
 * "FOLLOW TREND" means trend of the ASTROLOGICAL V2 score, NOT market D1.
 * Continuation/reversal describe event relationship with that trend;
 * harmonious aspects are NOT by themselves a BUY or a SELL.
 * Causal filtering: row[i] and earlier only; no future-price or look-ahead label.
 * Trade permission is NEVER emitted.
 */
(function(root){
'use strict';
const VERSION='1.0.0',STEP=60000;
const VALID=new Set(['BUY','SELL','WAIT']);
const EVENT_TYPES=Object.freeze({
 Sextile:'CONTINUATION',Trine:'CONTINUATION',
 Square:'REVERSAL_WATCH',Opposition:'REVERSAL_WATCH',
 Conjunction:'TRANSITION'
});
const ORBS=Object.freeze({Sextile:1.8,Trine:2,Square:2,Opposition:2.2,Conjunction:2.2});
const DEFAULTS=Object.freeze({
 trendMinutes:15,confirmMinutes:2,minimumTrendScore:0.6,
 minimumEventStrength:0.22,minimumAstroStreak:2,
 allowLiveTrading:false
});
function ensure(test,msg){if(!test)throw Error(msg);}
function options(input){
 const o={...DEFAULTS,...(input||{})};
 ensure([10,15,30,60].includes(o.trendMinutes),'Trend window M1 harus 10/15/30/60.');
 ensure([2,3,5].includes(o.confirmMinutes),'Konfirmasi M1 harus 2/3/5.');
 ensure(o.minimumTrendScore===0.6,'Batas tren riset harus 0.6 (versi ini).');
 return Object.freeze(o);
}
function eventOf(row){
 // No Lilith/ASC/MC directional weights. Orb and phase are from real ephemeris.
 const candidates=(row.aspects||[]).filter(a=>
   a&&!a.local&&Number.isFinite(a.impact)&&Math.abs(a.impact)>0 &&
   Object.prototype.hasOwnProperty.call(EVENT_TYPES,a.name)&&
   Number.isFinite(a.orb)&&a.orb>=0);
 if(!candidates.length)return null;
 const enriched=candidates.map(a=>{
   const orb=Math.min(1,a.orb/ORBS[a.name]);
   const exactness=1-orb;
   const phaseBoost=a.phase==='EXACT'?1.25:
     a.phase==='APPLYING'?1.10:a.phase==='SEPARATING'?0.85:0.75;
   return {
     key:[a.id1,a.id2,a.name].join('|'),pair:a.id1+' / '+a.id2,
     name:a.name,type:EVENT_TYPES[a.name],phase:a.phase,
     orb:a.orb,impact:a.impact,
     strength:Math.min(1,exactness*phaseBoost),
     weight:Math.abs(a.impact),
     // Strongest angular event, rather than most positive "benefic" score.
     priority:exactness*phaseBoost*Math.sqrt(Math.abs(a.impact))
   };
 });
 enriched.sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key));
 return enriched[0];
}
function compute(rows,selectedOptions){
 const cfg=options(selectedOptions);
 ensure(Array.isArray(rows)&&rows.length>=cfg.trendMinutes+cfg.confirmMinutes&&rows.length<=1440,
   'M1 minimal memenuhi warmup trend, maksimal 1440 menit.');
 for(let i=0;i<rows.length;i++){
   const r=rows[i];
   ensure(r&&Number.isFinite(r.ms)&&Number.isFinite(r.configScore)&&Array.isArray(r.aspects),
     'Data M1 konfigurasi/aspek tidak lengkap.');
   if(i)ensure(r.ms-rows[i-1].ms===STEP,'Slot M1 harus berurutan tanpa celah.');
 }
 const result=[],buffer=[];let total=0,pending='WAIT',pendingCount=0;
 let lastConfirmed='WAIT',astroPrevious='WAIT',astroStreak=0,eventSession=0,lastEventKey=null;
 const fired=new Set();
 for(let i=0;i<rows.length;i++){
   const r=rows[i];
   buffer.push(r.configScore);total+=r.configScore;
   if(buffer.length>cfg.trendMinutes)total-=buffer.shift();
   const ready=buffer.length===cfg.trendMinutes;
   const mean=ready?total/buffer.length:null;
   const astroTrend=!ready?'WAIT':mean>=cfg.minimumTrendScore?'BUY':
     mean<=-cfg.minimumTrendScore?'SELL':'WAIT';
   if(astroTrend!=='WAIT'){
     astroStreak=astroTrend===astroPrevious?astroStreak+1:1;
   }else astroStreak=0;
   astroPrevious=astroTrend;
   const e=eventOf(r);
   const meetsEvent=!!e&&e.strength>=cfg.minimumEventStrength;
   if(!meetsEvent||e.key!==lastEventKey){
     if(meetsEvent)eventSession++;
     lastEventKey=meetsEvent?e.key:null;
   }
   const eventId=meetsEvent?e.key+'#'+eventSession:null;
   let candidate='WAIT',reason='WARMUP_M1';
   if(ready){
     reason=!meetsEvent?'TIDAK_ADA_EVENT_CUKUP_KUAT':
       astroTrend==='WAIT'?'TREN_SKOR_ASTROLOGI_NETRAL':'MENUNGGU_POLARITAS';
     if(meetsEvent&&astroTrend!=='WAIT'){
       if(e.type==='CONTINUATION'){
         candidate=astroTrend;reason='EVENT_CONTINUATION_SEARAH_TREN_ASTRO';
       }else if(e.type==='REVERSAL_WATCH'){
         if(lastConfirmed!=='WAIT'&&astroTrend!==lastConfirmed&&
             astroStreak>=cfg.minimumAstroStreak){
           candidate=astroTrend;
           reason='EVENT_REVERSAL_DENGAN_PERGANTIAN_TREN_ASTRO';
         }else reason='EVENT_TEGANG_BELUM_KONFIRMASI_REVERSAL';
       }else reason='KONJUNGSI_ARAH_TIDAK_PASTI';
     }
   }
   if(candidate!=='WAIT'&&candidate===pending)pendingCount++;
   else{pending=candidate;pendingCount=candidate==='WAIT'?0:1;}
   let direction='WAIT',justConfirmed=false;
   if(candidate!=='WAIT'&&pendingCount>=cfg.confirmMinutes){
     direction=candidate;
     if(lastConfirmed!==direction){
       lastConfirmed=direction;
       justConfirmed=true;
     }
   }
   let eventTrigger=false;
   if(direction!=='WAIT'&&eventId&&!fired.has(eventId)){
     eventTrigger=true;fired.add(eventId);
   }
   // One event can trigger only once. Event signals never permit trading.
   result.push(Object.freeze({
     ms:r.ms,model:'ASTRO_EVENT_POLARITY_M1_RESEARCH',
     astroTrend,astroTrendScore:mean,astroTrendStreak:astroStreak,
     eventId,eventKey:e?.key||null,eventPair:e?.pair||null,eventName:e?.name||null,
     eventType:e?.type||'NONE',phase:e?.phase||null,
     orb:e?.orb??null,eventStrength:e?.strength??0,
     eventImpact:e?.impact??null,
     polarityCandidate:candidate,polarity:direction,
     polarityNumber:direction==='BUY'?1:direction==='SELL'?-1:0,
     reason:direction==='WAIT'&&candidate!=='WAIT'?'KONFIRMASI_M1_'+pendingCount+'/'+cfg.confirmMinutes:reason,
     confirmationBars:pendingCount,trendFlipped:justConfirmed,
     entryEvent:eventTrigger,
     tradingDecision:'WAIT',validatedForXAUUSD:false
   }));
 }
 const counts={BUY:0,SELL:0,WAIT:0};
 for(const r of result)counts[r.polarity]++;
 const events=result.filter(r=>r.entryEvent).map(r=>({
   utc:new Date(r.ms).toISOString(),direction:r.polarity,
   eventId:r.eventId,event:r.eventPair+' '+r.eventName,
   eventType:r.eventType,orb:r.orb,reason:r.reason
 }));
 const windows=[];
 for(const r of result){
   if(r.polarity==='WAIT')continue;
   let w=windows[windows.length-1];
   if(!w||w.direction!==r.polarity||w.endMs!==r.ms){
     w={direction:r.polarity,startMs:r.ms,coreMs:r.ms,
       endMs:r.ms+STEP,peak:Math.abs(r.astroTrendScore),minutes:1};
     windows.push(w);
   }else{
     w.minutes++;w.endMs=r.ms+STEP;
     if(Math.abs(r.astroTrendScore)>w.peak){
       w.coreMs=r.ms;w.peak=Math.abs(r.astroTrendScore);
     }
   }
 }
 const dominant=counts.BUY>counts.SELL&&counts.BUY>counts.WAIT?'BUY':
   counts.SELL>counts.BUY&&counts.SELL>counts.WAIT?'SELL':'WAIT';
 const focus=windows.filter(w=>w.direction===dominant)
   .sort((a,b)=>b.minutes-a.minutes||b.peak-a.peak)[0];
 return Object.freeze({
   version:VERSION,model:'ASTRO_EVENT_POLARITY_M1_RESEARCH',
   assumptions:'EVENT_TYPE_DIRECTION_RELATIVE_TO_ASTRO_V2_TREND',
   options:cfg,minutes:result.length,rows:result,events,
   counts,dominant,focusWindow:focus?{
      direction:focus.direction,awalUTC:new Date(focus.startMs).toISOString(),
      intiUTC:new Date(focus.coreMs).toISOString(),
      akhirUTC:new Date(focus.endMs).toISOString(),minutes:focus.minutes
   }:null,
   directionalEvents:events.length,
   tradeDecision:'WAIT',validatedForXAUUSD:false,
   note:'POLARITY hanya arah tren skor Astrology. BUKAN tren harga D1 XAUUSD. Event harmonis tidak otomatis BUY; event tegang tidak otomatis SELL.'
 });
}
function applyD1Guard(result,manualD1){
 ensure(result&&Array.isArray(result.rows),'Data polarity kosong.');
 ensure(['OFF','BUY','SELL'].includes(manualD1),'Arah D1 manual tidak valid.');
 const rows=result.rows.map(r=>{
   const blocked=manualD1!=='OFF'&&r.polarity!=='WAIT'&&r.polarity!==manualD1;
   return {...r,guardedPolarity:blocked?'WAIT':r.polarity,
     blockedByManualD1:blocked,manualD1,hybrid:manualD1!=='OFF',
     entryEvent:blocked?false:r.entryEvent,tradingDecision:'WAIT'};
 });
 const counts={BUY:0,SELL:0,WAIT:0},events=[];
 for(const r of rows){counts[r.guardedPolarity]++;if(r.entryEvent)events.push(r);}
 return Object.freeze({
   ...result,rows,guard:manualD1,
   counts,eligibleEvents:events.length,
   tradeDecision:'WAIT',validatedForXAUUSD:false,
   note:manualD1==='OFF'?result.note:
    'Mode HYBRID: guard D1 dimasukkan manual oleh pengguna, tidak dibaca otomatis dan tidak memodifikasi rumus astrologi. Arah yang melawan D1 disembunyikan (WAIT), bukan dibuktikan salah.'
 });
}
const API=Object.freeze({VERSION,DEFAULTS,EVENT_TYPES,eventOf,compute,applyD1Guard});
root.CebonkEventPolarityM1=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);