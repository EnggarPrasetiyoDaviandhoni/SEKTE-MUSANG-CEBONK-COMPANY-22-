/* BaZi x monthly metal prices: one-year historical associations, not a prediction. */
(function(root){
'use strict';
const B=root.CebonkBazi,M=root.CebonkMetalHistory;
if(!B||!M)return;
const monthOf=(y,m)=>y+'-'+String(m).padStart(2,'0');
function annual(input,year){
 if(!Number.isInteger(year)||year<1900||year>2098)throw Error('Tahun BaZi tidak valid.');
 const xs=M.rows(input),d=new Map(xs),start=d.get(monthOf(year,2)),end=d.get(monthOf(year+1,2));
 if(!(start>0&&end>0))return null;
 // Average February-to-next-February: 12 monthly steps, a coarse Li Chun proxy.
 for(let i=0;i<=12;i++){
  const y=year+Math.floor((i+1)/12),m=((i+1)%12)+1;
  if(!(d.get(monthOf(y,m))>0))return null;
 }
 return {year,from:monthOf(year,2),to:monthOf(year+1,2),change:(end/start-1)*100,element:B.yearCycle(year).element,animal:B.yearCycle(year).animal};
}
function sample(set,min){
 const n=set.length,up=set.filter(x=>x.change>0).length,down=set.filter(x=>x.change<0).length,flat=n-up-down;
 const mean=n?set.reduce((a,x)=>a+x.change,0)/n:null;
 const upPct=n?100*up/n:null,downPct=n?100*down/n:null;
 const bias=n<min?'TIDAK CUKUP DATA':up/n>=0.65?'BULLISH':down/n>=0.65?'BEARISH':'CAMPURAN';
 return {n,up,down,flat,mean,upPct,downPct,bias,min};
}
function analyze(input,targetYear){
 if(!Number.isInteger(targetYear)||targetYear<1960||targetYear>2050)throw Error('Pilih tahun 1960–2050.');
 const xs=M.rows(input),cyc=B.yearCycle(targetYear);
 const yearStart=xs.length?Number(xs[0][0].slice(0,4)):1960;
 const endExclusive=Math.min(targetYear,Number(xs.at(-1)?.[0].slice(0,4)??1959)+1);
 const samples=[];
 // No future peeking: exclude target year's outcome, and incomplete 12-month cycles.
 for(let y=Math.max(1960,yearStart);y<endExclusive;y++){
  const a=annual(xs,y);if(a)samples.push(a);
 }
 const byElement=sample(samples.filter(x=>x.element===cyc.element),8);
 const byShio=sample(samples.filter(x=>x.animal===cyc.animal),4);
 const matching=sample(samples.filter(x=>x.element===cyc.element&&x.animal===cyc.animal),3);
 // NEVER infer a reliable one-year direction from a single matching 60-year cycle.
 const dominant=byElement.bias===byShio.bias&&['BULLISH','BEARISH'].includes(byElement.bias)&&
   matching.n>=3?byElement.bias:'TIDAK KONKLUSIF';
 const price=new Map(xs),start=price.get(monthOf(targetYear,2));
 const full=annual(xs,targetYear);
 const partial=full?null:(()=>{
  if(!(start>0))return null;
  const latest=xs.filter(([date])=>date>=monthOf(targetYear,2)&&date<monthOf(targetYear+1,2)).at(-1);
  return latest&&latest[0]!==monthOf(targetYear,2)?{from:monthOf(targetYear,2),to:latest[0],change:(latest[1]/start-1)*100}:null;
 })();
 return {year:targetYear,element:cyc.element,animal:cyc.animal,dominant,byElement,byShio,matching,
  full,partial,samples: samples.length,cutoff:samples.at(-1)?.year??null,monthlyProxy:true};
}
const API=Object.freeze({annual,sample,analyze});
root.CebonkBaziYear=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
