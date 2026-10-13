/* ASTRODOX Planet Configuration v1.0 — PURE V1 aspect contributions.
 * Composition of signed historical V1 aspect weights. NO new price or
 * zodiac-direction hypothesis, no Al-Biruni, no trading orders.
 * Planet sign/longitude/degree are metadata from the SAME V1 positions.
 */
(function(root){
'use strict';
const VERSION='1.0.0';
const ZODIAC=Object.freeze(['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
 'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']);
const requireValid=(ok,msg)=>{if(!ok)throw Error(msg);};
const normal=x=>((x%360)+360)%360;
const pct=(n,d)=>d>0?n/d*100:null;
function locate(positions,id){
 const lon=positions?.[id]?.lon;
 if(!Number.isFinite(lon))return null;
 const degree=normal(lon),signIndex=Math.floor(degree/30);
 return Object.freeze({longitude:degree,sign:ZODIAC[signIndex],degreeInSign:degree%30});
}
function unavailable(message,slots){
 return Object.freeze({version:VERSION,available:false,reason:message,
  buyPct:null,sellPct:null,netPct:null,direction:'TIDAK_TERSEDIA',
  positiveWeight:null,negativeWeight:null,totalWeight:null,
  coveredSlots:0,coveragePct:slots?0:null,slots,aspects:0,
  leadingAspects:Object.freeze([]),perSlot:Object.freeze([]),
  tradingDecision:'WAIT',validatedForXAUUSD:false});
}
function evaluate(samples){
 requireValid(Array.isArray(samples)&&samples.length>0&&samples.length<=1000,
  'Data konfigurasi planet harus berasal dari sampel V1.');
 if(!samples.every(s=>s&&Number.isFinite(s.ms)&&Array.isArray(s.active)))
  return unavailable('DATA_ASPEK_V1_TIDAK_TERSEDIA',samples.length);
 let positive=0,negative=0,covered=0,n=0;
 const pairs=new Map(),perSlot=[];
 for(const s of samples){
  let buy=0,sell=0,count=0;
  for(const a of s.active){
   requireValid(a&&typeof a==='object','Aspek planet V1 tidak valid.');
   if(a.local===true)continue; // ASC and MC only annotate timing in original V1.
   requireValid(Number.isFinite(a.impact),'Bobot aspek V1 tidak tersedia; jangan buat estimasi.');
   requireValid(typeof a.id1==='string'&&typeof a.id2==='string'&&
    typeof a.name==='string'&&Number.isFinite(a.angle)&&
    Number.isFinite(a.orb),'Metadata bujur/derajat/aspek V1 tidak lengkap.');
   if(a.impact===0)continue;
   if(a.impact>0)buy+=a.impact;else sell+=-a.impact;
   count++;n++;
   const key=a.id1+'|'+a.id2+'|'+a.angle;
   let rec=pairs.get(key);
   if(!rec){
    rec={id1:a.id1,id2:a.id2,aspect:a.name,angle:a.angle,
     positiveWeight:0,negativeWeight:0,occurrences:0,
     peakWeight:-1,peak:null};
    pairs.set(key,rec);
   }
   if(a.impact>0)rec.positiveWeight+=a.impact;
   else rec.negativeWeight+=-a.impact;
   rec.occurrences++;
   if(Math.abs(a.impact)>rec.peakWeight){
    rec.peakWeight=Math.abs(a.impact);
    rec.peak={ms:s.ms,phase:a.phase||'TIDAK_TERSEDIA',
     orb:a.orb,planet1:locate(s.positions,a.id1),
     planet2:locate(s.positions,a.id2)};
   }
  }
  positive+=buy;negative+=sell;
  if(count)covered++;
  const total=buy+sell;
  perSlot.push(Object.freeze({ms:s.ms,buyWeight:buy,sellWeight:sell,
   buyPct:pct(buy,total),sellPct:pct(sell,total),
   totalWeight:total,aspects:count}));
 }
 const total=positive+negative;
 if(total<=0)return unavailable('TIDAK_ADA_KONTRIBUSI_ASPEK_V1',samples.length);
 const direction=positive/total>=0.55?'BUY':
  negative/total>=0.55?'SELL':'CAMPURAN';
 const ranking=[...pairs.values()].map(x=>Object.freeze({
  id1:x.id1,id2:x.id2,aspect:x.aspect,angle:x.angle,
  positiveWeight:x.positiveWeight,negativeWeight:x.negativeWeight,
  totalWeight:x.positiveWeight+x.negativeWeight,
  contributionPct:pct(x.positiveWeight+x.negativeWeight,total),
  occurrences:x.occurrences,peak:Object.freeze(x.peak)
 })).sort((a,b)=>b.totalWeight-a.totalWeight||
  a.id1.localeCompare(b.id1)||a.id2.localeCompare(b.id2)||a.angle-b.angle);
 return Object.freeze({version:VERSION,available:true,reason:'OK',
  buyPct:pct(positive,total),sellPct:pct(negative,total),
  netPct:(positive-negative)/total*100,direction,
  positiveWeight:positive,negativeWeight:negative,totalWeight:total,
  coveredSlots:covered,coveragePct:pct(covered,samples.length),
  slots:samples.length,aspects:n,
  leadingAspects:Object.freeze(ranking.slice(0,7)),
  perSlot:Object.freeze(perSlot),
  tradingDecision:'WAIT',validatedForXAUUSD:false,
  model:'RELATIVE_SIGNED_ASPECT_WEIGHT_COMPOSITION_V1',
  note:'BUY % dan SELL % adalah PORSI bobot aspek ASTRODOX V1; tidak mengukur tingkat kepastian, profit, kekuatan harga, atau probabilitas. Zodiak/longitude adalah posisi planet, bukan skor zodiak baru.'});
}
const API=Object.freeze({VERSION,locate,evaluate});
root.CebonkAstrodoxPlanetStrength=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
