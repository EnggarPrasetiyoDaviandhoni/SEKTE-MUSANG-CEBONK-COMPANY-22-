/* CEBONK historical metal trend engine v1.0.0 — descriptive, no predictions. */
(function(root){
'use strict';
const RE=/^\d{4}-(0[1-9]|1[0-2])$/,MAX=10000,DAY=/^\d{4}-\d{2}-\d{2}$/;
const monthNumber=d=>Number(d.slice(0,4))*12+Number(d.slice(5,7))-1;
function rows(input){
 if(!Array.isArray(input)||input.length>MAX)throw Error('Jumlah data tidak valid.');
 const seen=new Set(),output=[];
 for(const v of input){
  if(!Array.isArray(v)||v.length!==2||typeof v[0]!=='string'||!RE.test(v[0])||!Number.isFinite(v[1])||v[1]<=0)throw Error('Format harga harus [YYYY-MM, angka positif].');
  if(seen.has(v[0]))throw Error('Duplikasi bulan: '+v[0]);
  seen.add(v[0]);output.push([v[0],v[1]]);
 }
 output.sort((a,b)=>a[0].localeCompare(b[0]));
 return output;
}
const pct=(a,b)=>(a/b-1)*100;
const average=a=>a.reduce((s,x)=>s+x,0)/a.length;
function atMonth(xs,minus){
 const last=xs[xs.length-1];return xs.find(x=>monthNumber(x[0])===monthNumber(last[0])-minus);
}
function trend(input){
 const xs=rows(input);if(xs.length<13)return {ok:false,message:'Minimal 13 bulan data harga diperlukan.',count:xs.length};
 const last=xs.at(-1),last12=xs.slice(-12),last3=xs.slice(-3);
 if(monthNumber(last[0])-monthNumber(last12[0][0])!==11)return {ok:false,message:'Ada bulan hilang pada 12 bulan terakhir. Tidak dihitung.',count:xs.length};
 const ma3=average(last3.map(x=>x[1])),ma12=average(last12.map(x=>x[1]));
 const change={};
 for(const m of [1,3,6,12]){const past=atMonth(xs,m);change[m]=past?pct(last[1],past[1]):null;}
 const direction=ma3>ma12 && change[3]>0?'NAIK':ma3<ma12 && change[3]<0?'TURUN':'CAMPURAN';
 const recent=xs.slice(-Math.min(xs.length,61));
 let high=0,drawdown=0;
 for(const x of recent){high=Math.max(high,x[1]);drawdown=Math.min(drawdown,pct(x[1],high));}
 return {ok:true,month:last[0],price:last[1],count:xs.length,first:xs[0][0],direction,change,ma3,ma12,drawdown,history:xs};
}
function horseYear(input,year){
 const xs=rows(input);const inYear=xs.filter(x=>x[0].startsWith(year+'-'));
 if(!inYear.length)return {year,ok:false,reason:'Data tidak tersedia.'};
 const months=new Set(inYear.map(x=>x[0].slice(5))),complete=months.size===12;
 const first=inYear[0],last=inYear.at(-1);
 return {year,ok:true,count:inYear.length,first:first[0],last:last[0],firstPrice:first[1],lastPrice:last[1],change:inYear.length>1?pct(last[1],first[1]):null,complete};
}
function csv(content){
 if(typeof content!=='string'||content.length>3500000)throw Error('CSV terlalu besar (maksimal 3,5 MB).');
 const lines=content.replace(/^\uFEFF/,'').trim().split(/\r?\n/);if(lines.length>110000)throw Error('CSV terlalu panjang.');
 const delim=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',';
 const head=lines[0].toLowerCase().split(delim).map(x=>x.trim().replace(/[<>"]/g,''));
 const dateIndex=head.findIndex(x=>x==='date'||x==='datetime'||x==='timestamp'||x==='tanggal');
 const closeIndex=head.findIndex(x=>x==='close'||x==='value'||x==='price'||x==='harga'||x==='penutupan');
 if(dateIndex<0||closeIndex<0)throw Error('CSV perlu kolom date/tanggal dan close/value/price.');
 const parsed=[];
 for(const line of lines.slice(1)){
  if(!line.trim())continue;const c=line.split(delim);if(c.length<=Math.max(dateIndex,closeIndex))throw Error('Kolom CSV tidak lengkap.');
  const date=c[dateIndex].trim().replace(/"/g,'').replace(/[./]/g,'-').slice(0,10);
  const value=Number(c[closeIndex].trim().replace(/"/g,''));
  if(!DAY.test(date)||!Number.isFinite(value)||value<=0)throw Error('Tanggal atau harga CSV tidak valid.');
  const [y,m,d]=date.split('-').map(Number);const chk=new Date(Date.UTC(y,m-1,d));
  if(chk.getUTCFullYear()!==y||chk.getUTCMonth()+1!==m||chk.getUTCDate()!==d)throw Error('Tanggal CSV tidak valid: '+date);
  parsed.push([date,value]);
 }
 if(parsed.length<13)throw Error('CSV kurang dari 13 baris harga.');
 // Treat month rows as monthly observations; daily files become monthly mean of their close column.
 const isMonthly=parsed.every(([d])=>d.endsWith('-01'))&&new Set(parsed.map(x=>x[0].slice(0,7))).size===parsed.length;
 const groups=new Map();for(const [d,value] of parsed){const k=d.slice(0,7);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(value);}
 return {data:rows([...groups].map(([k,v])=>[k,average(v)])),method:isMonthly?'Harga bulanan CSV':'Rata-rata penutupan harian CSV',count:parsed.length};
}
const api=Object.freeze({rows,trend,horseYear,csv,monthNumber});
root.CebonkMetalHistory=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
