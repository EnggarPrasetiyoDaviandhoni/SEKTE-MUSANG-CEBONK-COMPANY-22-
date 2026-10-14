/* ASTRODOX V2 — experimental pure-astrology direction + ASC/MC event timing.
 * Uses CebonkCore.scan astronomical sample data, NEVER its signed V1 score.
 * No XAUUSD prices, technical data, Al-Biruni, orders, or live execution.
 */
(function(root){
'use strict';
const VERSION='2.0.0', STEP=300000;
const DEFAULTS=Object.freeze({confirmBars:3,graceBars:3,directionThreshold:0.20,
 intensityThreshold:50,localThreshold:30,localShare:0.50,focusShare:0.55});
const valid=(v,m)=>{if(!v)throw Error(m);};
const clamp=(x,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x));
const round=x=>Math.round(x*1000)/1000;
function optionsFrom(input){
 const o={...DEFAULTS,...input};
 valid(Number.isInteger(o.confirmBars)&&o.confirmBars>=1&&o.confirmBars<=24,'Konfirmasi 1–24 slot.');
 valid(Number.isInteger(o.graceBars)&&o.graceBars>=1&&o.graceBars<=24,'Toleransi 1–24 slot.');
 for(const k of ['directionThreshold','intensityThreshold','localThreshold','localShare','focusShare'])
  valid(Number.isFinite(o[k]),'Parameter '+k+' tidak valid.');
 valid(o.directionThreshold>0&&o.directionThreshold<1,'Ambang arah harus (0,1).');
 valid(o.intensityThreshold>=0&&o.intensityThreshold<=100,'Ambang intensitas harus 0–100.');
 valid(o.localThreshold>0&&o.localThreshold<=100,'Ambang ASC/MC harus (0,100].');
 valid(o.localShare>=0&&o.localShare<=1,'Porsi lokal harus 0–1.');
 valid(o.focusShare>=0.5&&o.focusShare<=1,'Fokus harus 0.5–1.');
 return Object.freeze(o);
}
function contribution(a,planetMap,aspectMap){
 valid(a&&typeof a==='object'&&typeof a.id1==='string'&&typeof a.id2==='string'&&
  Number.isFinite(a.orb)&&a.orb>=0&&Number.isFinite(a.angle),'Metadata aspek astronomi tidak lengkap.');
 const def=aspectMap.get(a.angle);
 valid(def&&Number.isFinite(def.orb)&&def.orb>0&&Number.isFinite(def.weight),'Definisi aspek tidak valid.');
 const local=a.local===true,limit=local?2:def.orb;
 if(a.orb>limit+1e-7)return null;
 const p=planetMap.get(a.id1),q=planetMap.get(a.id2);
 if(!p||(!local&&!q)|| (local&&a.id2!=='ASC'&&a.id2!=='MC'))
  throw Error('Pasangan aspek tidak dikenal.');
 const proximity=clamp(1-a.orb/limit);
 const phaseFactor=a.phase==='EXACT'?1.25:a.phase==='APPLYING'?1.10:
  a.phase==='SEPARATING'?0.90:1;
 // Each contact's momentum is non-directional, including square/opposition.
 const eventStrength=clamp(proximity*phaseFactor/1.25);
 const coefficient=def.weight*(local?p.weight:(p.weight+q.weight)/2);
 valid(Number.isFinite(coefficient)&&coefficient>0,'Bobot planet tidak valid.');
 return {local,eventStrength,coefficient,relative:proximity*phaseFactor,
  nature:local?null:(p.nature+q.nature)/2,
  id1:a.id1,id2:a.id2,aspect:def.name,phase:a.phase,orb:a.orb};
}
function evaluate(samples,astroConfig,settings){
 valid(Array.isArray(samples)&&samples.length>0&&samples.length<=1000,'Sampel astrologi kosong / terlalu besar.');
 valid(astroConfig&&Array.isArray(astroConfig.planets)&&Array.isArray(astroConfig.aspects),
  'Konfigurasi astronomi V1 tidak tersedia.');
 const o=optionsFrom(settings),planetMap=new Map(astroConfig.planets.map(p=>[p.id,p]));
 const aspectMap=new Map(astroConfig.aspects.map(a=>[a.angle,a]));
 valid(planetMap.size===astroConfig.planets.length&&aspectMap.size===astroConfig.aspects.length,
  'Konfigurasi aspek/planet duplikat.');
 let stable='WAIT',pending='WAIT',pendingCount=0,neutralCount=0,reversals=0;
 const rows=[],windows=[];let current=null;
 for(let i=0;i<samples.length;i++){
  const s=samples[i];
  valid(s&&Number.isFinite(s.ms)&&Array.isArray(s.active),'Sampel/aspek tidak lengkap.');
  if(i)valid(s.ms===samples[i-1].ms+STEP,'Urutan grid 5 menit terputus.');
  let total=0,signed=0,localPeak=0,globalPeak=0,leading=null,nPlanet=0,nLocal=0;
  for(const a of s.active){
   const c=contribution(a,planetMap,aspectMap);
   if(!c)continue;
   if(c.local){
    nLocal++;
    if(c.eventStrength>localPeak){localPeak=c.eventStrength;leading=c;}
   }else{
    nPlanet++;
    // Only planetary natures set astro-direction; geometry/type sets magnitude.
    const mass=c.coefficient*c.relative;
    valid(Number.isFinite(c.nature),'Sifat planet tidak tersedia.');
    total+=mass;signed+=mass*c.nature;
    globalPeak=Math.max(globalPeak,c.eventStrength*clamp(c.coefficient/1.7));
   }
  }
  const directionScore=total>0?clamp(signed/(1.5*total),-1,1):null;
  const raw=directionScore===null?'WAIT':
   directionScore>=o.directionThreshold?'BUY':
   directionScore<=-o.directionThreshold?'SELL':'WAIT';
  let confirmed='WAIT';
  if(raw==='WAIT'){
   neutralCount++;pending='WAIT';pendingCount=0;
   if(neutralCount>=o.graceBars)stable='WAIT';
  }else{
   neutralCount=0;
   if(raw===stable){confirmed=stable;pending='WAIT';pendingCount=0;}
   else{
    if(raw===pending)pendingCount++;else{pending=raw;pendingCount=1;}
    if(pendingCount>=o.confirmBars){
     if(stable!=='WAIT'&&stable!==raw)reversals++;
     stable=raw;confirmed=raw;pending='WAIT';pendingCount=0;
    }
   }
  }
  const localPct=round(100*localPeak),planetPct=round(100*globalPeak);
  const intensity=round(o.localShare*localPct+(1-o.localShare)*planetPct);
  const timeReady=localPct>=o.localThreshold&&intensity>=o.intensityThreshold;
  const state=timeReady?confirmed:'WAIT';
  const reason=raw==='WAIT'?'ARAH_TIDAK_CUKUP':
   confirmed==='WAIT'?'KONFIRMASI_ARAH':
   localPct<o.localThreshold?'TUNGGU_ASC_MC':
   intensity<o.intensityThreshold?'INTENSITAS_RENDAH':'MOMEN_ASTROLOGI';
  const row=Object.freeze({ms:s.ms,raw,confirmed,state,reason,
   directionScore:directionScore===null?null:round(directionScore),
   intensity,localPct,planetPct,nPlanet,nLocal,
   event:leading?Object.freeze({planet:leading.id1,angle:leading.id2,
    aspect:leading.aspect,phase:leading.phase,orb:round(leading.orb)}):null});
  rows.push(row);
  if(state==='WAIT'){current=null;continue;}
  if(!current||current.direction!==state||current.end!==s.ms){
   current={direction:state,start:s.ms,core:s.ms,end:s.ms+STEP,
    coreIntensity:intensity,slots:1};windows.push(current);
  }else{
   current.end=s.ms+STEP;current.slots++;
   if(intensity>current.coreIntensity){current.core=s.ms;current.coreIntensity=intensity;}
  }
 }
 const buyMinutes=rows.filter(r=>r.state==='BUY').length*5,
  sellMinutes=rows.filter(r=>r.state==='SELL').length*5,
  waitMinutes=rows.filter(r=>r.state==='WAIT').length*5;
 const directional=buyMinutes+sellMinutes;
 const share=directional?Math.max(buyMinutes,sellMinutes)/directional:null;
 const focus=directional&&share>=o.focusShare&&buyMinutes!==sellMinutes?
  (buyMinutes>sellMinutes?'BUY':'SELL'):'WAIT';
 const best=focus==='WAIT'?null:windows.filter(w=>w.direction===focus)
  .sort((a,b)=>b.slots-a.slots||b.coreIntensity-a.coreIntensity||a.start-b.start)[0]||null;
 return Object.freeze({version:VERSION,model:'ASTRODOX_V2_ASTRO_TIMING_RESEARCH',
  validatedForXAUUSD:false,tradeDecision:'WAIT',source:'CEBONK_ASTRONOMY_ONLY',
  parameters:o,rows:Object.freeze(rows),windows:Object.freeze(windows.map(w=>Object.freeze({...w,minutes:w.slots*5}))),
  focus,focusWindow:best?Object.freeze({...best,minutes:best.slots*5}):null,
  buyMinutes,sellMinutes,waitMinutes,directionalShare:share,reversals,
  disclaimer:'Arah = hipotesis sifat planet; intensitas = kontak aspek. Ini bukan prediksi harga yang tervalidasi. INTI/AKHIR adalah kalender astronomi penuh.'});
}
const API=Object.freeze({VERSION,DEFAULTS,optionsFrom,evaluate});
root.CebonkAstrodoxV2=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
