#!/usr/bin/env node
// CEBONK ASTROLOGY NEWS: EXACT existing website model and planner; no invented news times.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const Astronomy=require('astronomy-engine');
const News=require('../assets/astro-news-v1.js');
const OUT=resolve('ea/astro_news/data'), MODEL='CEBONK_ASTRO_NEWS_V1';
const HEADER='event_id,event_name,release_epoch,calendar_checked,direction,start_epoch,entry_end_epoch,end_epoch,peak_epoch,aspects,model';
function coreFromSite(){
 const html=readFileSync(resolve('index.html'),'utf8'),p=html.indexOf('/* CEBONK ASTROLOGY');
 const q=html.indexOf('</script>',p);
 if(p<0||q<0)throw Error('Website Astrology SSOT not found');
 const module={exports:{}};
 vm.runInNewContext(html.slice(p,q),{module,Date,setTimeout,console},{timeout:15000});
 const c=module.exports;
 if(typeof c.createEngine!=='function'||typeof c.analyse!=='function'||c.CFG?.step!==5)
  throw Error('Website Astrology API incompatible');
 return c;
}
function clean(x){return String(x).replace(/[,|\r\n]/g,' ').trim();}
function aspectsAt(c,engine,ms,dir){
 const step=300000;
 const a=c.analyse(engine.get(ms-step),engine.get(ms),engine.get(ms+step),true).active;
 const list=a.filter(x=>!x.local&&(dir==='BUY'?x.impact>0:x.impact<0))
  .sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)||a.orb-b.orb).slice(0,2);
 const phases={EXACT:'TEPAT',APPLYING:'MENDEKAT',SEPARATING:'MENJAUH',STATIONARY:'STASIONER'};
 return clean(list.map(x=>x.id1+' '+x.name+' '+x.id2+' orb '+x.orb.toFixed(2)+'deg '+(phases[x.phase]||x.phase)).join(' / ')||'NO_ALIGNED_ASPECT');
}
async function main(){
 if(News.VERSION!=='1.0.0'||News.CHECKED!=='2026-10-04')throw Error('News source model changed; review needed');
 const core=coreFromSite(),events=News.CALENDAR;
 if(!Array.isArray(events)||events.length<1||events.length>100)throw Error('News source calendar missing');
 const grouped=new Map();
 for(const e of events){
  if(!e.id||!e.name||!Number.isSafeInteger(e.ms)||!['BLS','BEA','FED'].includes(e.agency))
   throw Error('Unsupported calendar event');
  const key=String(e.ms);
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(e);
 }
 const rows=[HEADER],plans=[];
 for(const sameTime of grouped.values()){
  const first=sameTime[0],id=clean(first.id),name=clean(sameTime.map(e=>e.name).join(' + '));
  const params={id:first.id,name:first.name,releaseMs:first.ms,
   pre:30,post:120,blockBefore:5,blockAfter:5,entrySpan:10,minWindow:15,
   otherRisk:true,confirmed:true};
  const plan=await News.calculate(core,Astronomy,params,events);
  if(plan.version!==News.VERSION||!plan.experimental||plan.executionEnabled!==false)
   throw Error('Planner result failed provenance test');
  const windows=[];
  const analysis=core.createEngine(Astronomy);
  for(const w of plan.windows){
   if(w.dir!==plan.focus||!['BUY','SELL'].includes(w.dir)||
      w.start<first.ms+5*60000||w.entryEnd<=w.start||w.entryEnd>w.end||
      w.end>first.ms+120*60000+300000||w.peak<w.start||w.peak>=w.entryEnd)
    throw Error('Plan window outside original website policy');
   const aspect=aspectsAt(core,analysis,w.peak,w.dir);
   const fields=[id,name,first.ms/1000,News.CHECKED,w.dir,w.start/1000,w.entryEnd/1000,
    w.end/1000,w.peak/1000,aspect,MODEL];
   if(fields.some(v=>String(v).includes(',')))throw Error('Unsafe CSV field');
   rows.push(fields.join(','));
   windows.push({direction:w.dir,start_epoch:w.start/1000,entry_end_epoch:w.entryEnd/1000,
     end_epoch:w.end/1000,peak_epoch:w.peak/1000,aspect});
  }
  plans.push({id,news:name,release_epoch:first.ms/1000,agency:sameTime.map(e=>e.agency),
    focus:plan.focus,windows});
 }
 // Source is the site's checked calendar snapshot, NOT a rolling official news feed.
 const manifest={model:MODEL,source:'CebonkNews.calculate + CebonkCore.analyse',
  experimental:true,calendar_checked:News.CHECKED,calendar_type:'WEBSITE_SNAPSHOT_NOT_LIVE',
  policy:{pre:30,post:120,blockBefore:5,blockAfter:5,entrySpan:10,minWindow:15,otherRisk:true},
  events:plans,window_count:rows.length-1};
 mkdirSync(OUT,{recursive:true});
 writeFileSync(resolve(OUT,'news_windows.csv'),rows.join('\n')+'\n','utf8');
 writeFileSync(resolve(OUT,'news_windows.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
 console.log('NEWS_ASTRO_SNAPSHOT='+News.CHECKED+' events='+plans.length+' windows='+(rows.length-1));
 for(const p of plans)console.log(p.id+' '+p.focus+' windows='+p.windows.length);
}
await main();
