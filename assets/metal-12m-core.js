/* CEBONK 12M reference: annual summaries derived from observed MONTHLY AVERAGES.
   NOT OHLC candles; do not create fake opens, highs, lows or closes.
   Historical signs are not BaZi forecasts or trading signals. */
(function(root){
'use strict';
const M=root.CebonkMetalHistory,B=root.CebonkBazi;
if(!M||!B)return;
function build(input){
 const values=M.rows(input),byYear=new Map(),output=[];
 for(const [month,price] of values){
  const year=Number(month.slice(0,4));
  if(!byYear.has(year))byYear.set(year,[]);
  byYear.get(year).push({month,price});
 }
 const years=[...byYear.keys()].sort((a,b)=>a-b);
 const summaryByYear=new Map();
 for(const year of years){
  const months=byYear.get(year);
  const present=new Set(months.map(x=>Number(x.month.slice(5))));
  const complete=present.size===12;
  const average=months.reduce((sum,x)=>sum+x.price,0)/months.length;
  const shio=B.yearCycle(year);
  const report={
   year,months:months.length,complete,average,
   minMonthlyAverage:Math.min(...months.map(x=>x.price)),
   maxMonthlyAverage:Math.max(...months.map(x=>x.price)),
   first:months[0].month,last:months.at(-1).month,
   shio:shio.animal,element:shio.element,
   comparison:null,comparisonType:null,
   direction:complete?'DATA TAHUN AWAL':'BELUM LENGKAP'
  };
  const prev=summaryByYear.get(year-1);
  if(complete&&prev&&prev.complete){
   report.comparison=100*(average/prev.average-1);
   report.comparisonType='TAHUN PENUH';
   report.direction=report.comparison>0?'NAIK':report.comparison<0?'TURUN':'DATAR';
  }else if(!complete&&prev){
   // Compare only matching calendar months, never partial period against all prior 12 months.
   const prevVals=new Map(byYear.get(year-1)?.map(x=>[Number(x.month.slice(5)),x.price]));
   if(prevVals&&months.every(x=>prevVals.has(Number(x.month.slice(5))))){
    const comparisonMean=months.reduce((sum,x)=>sum+prevVals.get(Number(x.month.slice(5))),0)/months.length;
    report.comparison=100*(average/comparisonMean-1);
    report.comparisonType='BULAN SEPADAN TAHUN SEBELUMNYA';
   }
  }
  summaryByYear.set(year,report);output.push(report);
 }
 return output;
}
function analyze(input,year){
 const series=build(input),found=series.find(x=>x.year===year);
 if(!found) return {ok:false,reason:'Tahun tidak tersedia di arsip.'};
 const historical=series.filter(x=>x.complete&&x.year<year&&x.direction!=='DATA TAHUN AWAL');
 const bullish=historical.filter(x=>x.direction==='NAIK').length;
 const bearish=historical.filter(x=>x.direction==='TURUN').length;
 const flat=historical.filter(x=>x.direction==='DATAR').length;
 const analogue=series.find(x=>x.year===year-60)||null;
 return {ok:true,year:found,series,history:{n:historical.length,bullish,bearish,flat},
  analogue,source:'Rata-rata harga bulanan; kalender tahun sipil Januari–Desember'};
}
const API=Object.freeze({build,analyze});
root.CebonkMetal12M=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
