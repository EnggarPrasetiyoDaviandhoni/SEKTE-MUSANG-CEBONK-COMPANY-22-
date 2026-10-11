#!/usr/bin/env node
// Server-side publisher: EXACT same Astro core embedded in index.html and weekly aggregator.
// Model V1 is experimental, not a validated predictor. No technical price input.
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const Astronomy=require('astronomy-engine');
const WEEK=require('../assets/astro-weekly-core.js');
const DIR=resolve('ea/liquidity_sweep/weekly_atr/data');
const MODEL='ASTRO_WEEKLY_V1';
const HEADER='monday,week_direction,date,start_epoch,core_epoch,end_epoch,model';
const MINUTE=60000,DAY=86400000;

function astrologyCore(){
 const html=readFileSync(resolve('index.html'),'utf8');
 const start=html.indexOf('/* CEBONK ASTROLOGY');
 if(start<0)throw Error('SSOT Astrology core marker missing in index.html');
 const end=html.indexOf('</script>',start);
 if(end<0)throw Error('SSOT Astrology core script end missing');
 const module={exports:{}};
 // Share Node's Date constructor: astronomy-engine checks Date instanceof across realms.
 vm.runInNewContext(html.slice(start,end),{module,setTimeout,console,Date},{timeout:15000,filename:'index.html#CebonkCore'});
 const core=module.exports;
 if(typeof core.createEngine!=='function'||typeof core.scan!=='function'||core.CFG?.step!==5)
  throw Error('Website Astrology engine API changed. Refuse publishing');
 return core;
}
function targetWeek(now=new Date()){
 if(!Number.isFinite(now.valueOf()))throw Error('Invalid clock');
 const wib=new Date(now.valueOf()+420*MINUTE);
 const monday=WEEK.monday(wib.toISOString().slice(0,10));
 const day=wib.getUTCDay();
 // At the weekend, prepare FOLLOWING week's schedule before Monday opens.
 return (day===0||day===6)?
  new Date(Date.parse(monday+'T00:00:00Z')+7*DAY).toISOString().slice(0,10):monday;
}
function encodeWeek(report,monday){
 if(!['BUY','SELL','CAMPURAN','TIDAK ADA ARAH'].includes(report.direction))throw Error('Invalid model direction');
 if(report.totalSlots!==1080||report.days.length!==5||report.candidates.length>5)throw Error('Incomplete weekly scanner');
 const dates=new Set(WEEK.weekDates(monday).map(d=>d.date));
 const rows=[HEADER],windows=[],occupied=[];
 for(const x of report.candidates){
  if(!['BUY','SELL'].includes(report.direction)||x.direction!==report.direction||
     !dates.has(x.date)||![x.start,x.core,x.end].every(Number.isSafeInteger)||
     x.start%300000||x.core%300000||x.end%300000||
     x.start>x.core||x.core>=x.end||x.end-x.start<30*MINUTE||
     x.date!==new Date(x.start+420*MINUTE).toISOString().slice(0,10)||
     x.date!==new Date(x.end-1+420*MINUTE).toISOString().slice(0,10))
   throw Error('Refuse inconsistent Astrology window');
  if(occupied.some(y=>x.start<y.end&&x.end>y.start))throw Error('Overlapping Astrology windows');
  occupied.push(x);
  rows.push([monday,report.direction,x.date,x.start/1000,x.core/1000,x.end/1000,MODEL].join(','));
  windows.push({date:x.date,direction:x.direction,start_epoch:x.start/1000,
    core_epoch:x.core/1000,end_epoch:x.end/1000,minutes:x.minutes});
 }
 if(report.direction!=='BUY'&&report.direction!=='SELL'&&rows.length!==1)
  throw Error('Neutral week must never trigger entry');
 const manifest={model:MODEL,source:'Website CebonkCore V1 + CebonkAstroWeekly',
  experimental:true,week_monday_wib:monday,week_direction:report.direction,
  total_slots:report.totalSlots,buy_minutes:report.buyMinutes,sell_minutes:report.sellMinutes,
  windows,status:windows.length?'READY':'NO_TRADE'};
 return {csv:rows.join('\n')+'\n',manifest:JSON.stringify(manifest,null,2)+'\n'};
}
async function generate(){
 const core=astrologyCore();
 const engine=core.createEngine(Astronomy);
 const monday=process.env.ASTRO_WEEK_MONDAY||targetWeek();
 if(monday!==WEEK.monday(monday))throw Error('ASTRO_WEEK_MONDAY must be Monday');
 const report=await WEEK.scanWeek(monday,(date,progress,cancelled)=>
  core.scan(engine,date,360,true,progress,cancelled));
 const {csv,manifest}=encodeWeek(report,monday);
 mkdirSync(DIR,{recursive:true});
 writeFileSync(resolve(DIR,'weekly.csv'),csv,'utf8');
 writeFileSync(resolve(DIR,'weekly.json'),manifest,'utf8');
 console.log('Week '+monday+' '+report.direction+' candidate_windows='+report.candidates.length+
  ' slots='+report.totalSlots+' experimental=true');
}
await generate();
