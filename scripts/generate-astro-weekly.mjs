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
const ASPECT_HEADER=HEADER+',aspects_at_core';
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
function encodeWeek(report,monday,resolveAspects){
 if(!['BUY','SELL','CAMPURAN','TIDAK ADA ARAH'].includes(report.direction))throw Error('Invalid model direction');
 if(report.totalSlots!==1080||report.days.length!==5||report.candidates.length>5)throw Error('Incomplete weekly scanner');
 const dates=new Set(WEEK.weekDates(monday).map(d=>d.date));
 const rows=[HEADER],aspectRows=[ASPECT_HEADER],windows=[],occupied=[];
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
  const aspects=resolveAspects(x.core,report.direction);
  if(typeof aspects!=='string'||aspects.length<4||aspects.length>400||
     /[\r\n,]/.test(aspects))throw Error('Unsafe aspect description');
  rows.push([monday,report.direction,x.date,x.start/1000,x.core/1000,x.end/1000,MODEL].join(','));
  aspectRows.push([monday,report.direction,x.date,x.start/1000,x.core/1000,x.end/1000,MODEL,aspects].join(','));
  windows.push({date:x.date,direction:x.direction,start_epoch:x.start/1000,
    core_epoch:x.core/1000,end_epoch:x.end/1000,minutes:x.minutes,aspects_at_core:aspects});
 }
 if(report.direction!=='BUY'&&report.direction!=='SELL'&&rows.length!==1)
  throw Error('Neutral week must never trigger entry');
 const manifest={model:MODEL,source:'Website CebonkCore V1 + CebonkAstroWeekly',
  experimental:true,week_monday_wib:monday,week_direction:report.direction,
  total_slots:report.totalSlots,buy_minutes:report.buyMinutes,sell_minutes:report.sellMinutes,
  windows,status:windows.length?'READY':'NO_TRADE'};
 return {csv:rows.join('\n')+'\n',aspectsCSV:aspectRows.join('\n')+'\n',manifest:JSON.stringify(manifest,null,2)+'\n'};
}
async function generate(){
 const core=astrologyCore();
 const engine=core.createEngine(Astronomy);
 const monday=process.env.ASTRO_WEEK_MONDAY||targetWeek();
 if(monday!==WEEK.monday(monday))throw Error('ASTRO_WEEK_MONDAY must be Monday');
 const report=await WEEK.scanWeek(monday,(date,progress,cancelled)=>
  core.scan(engine,date,360,true,progress,cancelled));
 const {csv,aspectsCSV,manifest}=encodeWeek(report,monday,(coreMs,dir)=>{
  // Use the SAME planetary positions/aspect model as the website, at the INTI instant.
  const s=core.analyse(engine.get(coreMs-300000),engine.get(coreMs),
                       engine.get(coreMs+300000),true);
  const aligned=s.active.filter(a=>!a.local&&(dir==='BUY'?a.impact>0:a.impact<0))
    .sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)||a.orb-b.orb);
  const phase={EXACT:'TEPAT',APPLYING:'MENDEKAT',SEPARATING:'MENJAUH',STATIONARY:'STASIONER'};
  return aligned.slice(0,2).map(a=>
    a.id1+' '+a.name+' '+a.id2+' (orb '+a.orb.toFixed(2)+' deg; '+(phase[a.phase]||a.phase)+')'
  ).join(' | ')||'TIDAK ADA ASPEK SEARAH PADA INTI';
 });
 mkdirSync(DIR,{recursive:true});
 writeFileSync(resolve(DIR,'weekly.csv'),csv,'utf8');
 writeFileSync(resolve(DIR,'weekly_aspects.csv'),aspectsCSV,'utf8');
 writeFileSync(resolve(DIR,'weekly.json'),manifest,'utf8');
 console.log('Week '+monday+' '+report.direction+' candidate_windows='+report.candidates.length+
  ' slots='+report.totalSlots+' experimental=true');
}
await generate();
