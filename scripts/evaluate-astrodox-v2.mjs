#!/usr/bin/env node
/* Compare exported V1/V2 astrology labels against REAL M5 OHLC CSV only.
 * Usage: node scripts/evaluate-astrodox-v2.mjs predictions.csv xauusd_m5.csv
 * Price timestamps MUST have ISO timezone offsets (e.g. Z or +03:00).
 * Price bar timestamp = bar OPEN time; compare next candle open to future close.
 * This is an unsigned-price-movement concordance study, not trade backtest.
 */
import fs from 'node:fs';
const die=m=>{console.error('ERROR:',m);process.exit(1);};
function parseCSV(s){
 const rows=[];let cell='',row=[],quoted=false;
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&s[i+1]==='\n')i++;
   row.push(cell);if(row.some(x=>x!==''))rows.push(row);
   cell='';row=[];
  }else cell+=c;
 }
 if(quoted)throw Error('CSV contains unterminated quote.');
 row.push(cell);if(row.some(x=>x!==''))rows.push(row);
 if(!rows.length)throw Error('CSV empty.');
 const hdr=rows.shift().map((x,i)=>i===0?x.replace(/^\uFEFF/,'').trim():x.trim());
 if(new Set(hdr).size!==hdr.length)throw Error('Duplicate CSV columns.');
 return rows.map((r,i)=>{
  if(r.length!==hdr.length)throw Error('Wrong CSV column count on row '+(i+2));
  return Object.fromEntries(hdr.map((h,j)=>[h,r[j]]));
 });
}
function isoMillis(s){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(s))
  throw Error('Prices need explicit timezone ISO timestamps, got: '+s);
 const t=Date.parse(s);if(!Number.isFinite(t))throw Error('Invalid ISO timestamp: '+s);
 return t;
}
function predMillis(s){
 if(!/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(s))
  throw Error('ASTRODOX timestamp_wib required, got: '+s);
 const t=Date.parse(s.replace(' ','T')+':00+07:00');
 if(!Number.isFinite(t))throw Error('Invalid WIB timestamp');
 return t;
}
function read(file){return parseCSV(fs.readFileSync(file,'utf8'));}
function evaluate(predictions,prices){
 const byTime=new Map();
 for(const r of prices){
  const t=isoMillis(r.timestamp),op=Number(r.open),cl=Number(r.close);
  if(byTime.has(t))throw Error('Duplicate price bar: '+r.timestamp);
  if(!Number.isFinite(op)||op<=0||!Number.isFinite(cl)||cl<=0)
   throw Error('Invalid M5 OHLC values.');
  if(t%300000!==0)throw Error('Not aligned to M5 boundary.');
  byTime.set(t,{open:op,close:cl});
 }
 const all=[];
 const seen=new Set();
 for(const p of predictions){
  const t=predMillis(p.timestamp_wib);
  if(seen.has(t))throw Error('Duplicate prediction slot: '+p.timestamp_wib);
  seen.add(t);
  for(const horizon of [1,3,12]){
   const entry=byTime.get(t+300000),exit=byTime.get(t+horizon*300000);
   if(!entry||!exit)continue; // Never fill forward price gaps.
   const change=exit.close-entry.open;
   for(const model of ['v1','v2']){
    const direction=p[model+'_state'];
    if(!['BUY','SELL','WAIT'].includes(direction))
     throw Error('Invalid '+model+' state.');
    if(direction==='WAIT')continue;
    const year=Number(new Date(t+7*3600000).toISOString().slice(0,4));
    if(year<2024||year>2026)continue;
    all.push({model,year,side:direction,horizon,correct:direction==='BUY'?change>0:change<0,
     unchanged:change===0,change,ms:t});
   }
  }
 }
 const out=[];
 for(const model of ['v1','v2'])for(const horizon of [1,3,12])
  for(const year of [2024,2025,2026,'ALL'])
   for(const side of ['BUY','SELL','ALL']){
    const xs=all.filter(x=>x.model===model&&x.horizon===horizon&&
     (year==='ALL'||x.year===year)&&(side==='ALL'||x.side===side));
    if(!xs.length)continue;
    out.push({model,horizon_minutes:horizon*5,year,side,count:xs.length,
     wins_directional:xs.filter(x=>x.correct).length,
     flats:xs.filter(x=>x.unchanged).length,
     directional_match_pct:Number((xs.filter(x=>x.correct).length/xs.length*100).toFixed(2))});
   }
 return out;
}
if(process.argv.length!==4)die('Usage: node scripts/evaluate-astrodox-v2.mjs predictions.csv price_m5.csv');
try{
 const result=evaluate(read(process.argv[2]),read(process.argv[3]));
 if(!result.length)die('No exactly timestamp-matched real price bars for 2024–2026.');
 console.log(JSON.stringify({status:'UNVALIDATED_DIRECTIONAL_CONCORDANCE_ONLY',
  price_source:'USER_SUPPLIED',entry:'NEXT_M5_OPEN',exit:'HORIZON_M5_CLOSE',
  note:'NOT a profit factor, trade win rate, spread-adjusted return, or trading permission.',
  rows:result},null,2));
}catch(e){die(e.message);}
