#!/usr/bin/env node
// Browser UMD bundles in a VM versus Node modules, using the actual pinned
// browser and Node Astronomy Engine builds. This does not claim UI automation.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {sourceEngines,Astronomy,ROOT,requireEA} from './swing/source.mjs';
import {addDay} from './swing/feed.mjs';
const library=resolve(dirname(requireEA.resolve('astronomy-engine')),'astronomy.browser.min.js');
const astroContext=vm.createContext({Date,Math,console});
vm.runInContext(readFileSync(library,'utf8'),astroContext,{filename:'astronomy.browser.min.js'});
const BA=astroContext.Astronomy;if(!BA)throw Error('Browser Astronomy UMD API missing');
const node=sourceEngines(),browser=sourceEngines(true);
const plain=x=>JSON.parse(JSON.stringify(x));
let maximumDifference=0,dates=0;
function equal(a,b,path='value'){
 if(typeof a==='number'&&typeof b==='number'){
  const delta=Math.abs(a-b);maximumDifference=Math.max(maximumDifference,delta);assert.ok(delta<=1e-9,`${path}: ${delta}`);return;
 }
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.deepEqual(a,b,path);return;}
 assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);
 for(const k of Object.keys(a))equal(a[k],b[k],path+'.'+k);
}
const mondays=['2026-03-02','2026-03-09','2026-03-30','2026-04-06'];
for(const monday of mondays){
 const nd=[],bd=[];
 for(let i=0;i<5;i++){
  const date=addDay(monday,i),ne=node.C.createEngine(Astronomy),be=browser.C.createEngine(BA);
  const ns=await node.C.scan(ne,date,360,true,undefined,undefined,'WIB');
  const bs=await browser.C.scan(be,date,360,true,undefined,undefined,'WIB');
  equal(plain(ns.map(s=>({ms:s.ms,state:s.state,score:s.score}))),plain(bs.map(s=>({ms:s.ms,state:s.state,score:s.score}))),date+'.weeklySlots');
  nd.push({date,samples:ns});bd.push({date,samples:bs});ne.clear();be.clear();
  const nk=await node.K.calculate(date,Astronomy,node.C),bk=await browser.K.calculate(date,BA,browser.C);
  const summarize=r=>r.sessions.map(s=>({id:s.id,start:s.start,end:s.end,trend:s.trend,scores:s.samples.map(x=>x.score)}));
  equal(plain(summarize(nk)),plain(summarize(bk)),date+'.sessions');
  const sample=Date.parse(date+'T12:00:00Z');
  equal(Astronomy.MoonPhase(new Date(sample)),BA.MoonPhase(new Date(sample)),date+'.moonPhase');
  equal(Astronomy.Illumination(Astronomy.Body.Moon,new Date(sample)).phase_fraction,BA.Illumination(BA.Body.Moon,new Date(sample)).phase_fraction,date+'.illumination');
  dates++;
 }
 const nw=node.W.summarize(nd),bw=browser.W.summarize(bd);equal(plain(nw),plain(bw),monday+'.weekly');
 equal(plain(node.D.make(nw,Astronomy,node.B,0)),plain(browser.D.make(bw,BA,browser.B,0)),monday+'.dailySwing');
 const start=new Date(monday+'T00:00:00Z');let nq=Astronomy.SearchMoonQuarter(start),bq=BA.SearchMoonQuarter(start);
 for(let i=0;i<4;i++){assert.equal(nq.quarter,bq.quarter);assert.equal(nq.time.date.getTime(),bq.time.date.getTime());nq=Astronomy.NextMoonQuarter(nq);bq=BA.NextMoonQuarter(bq);}
 console.log('PASS parity week '+monday);
}
const report={status:'PASS',kind:'VM browser UMD versus Node; not browser UI automation',trading_dates:dates,
 weeks:mondays,astronomy_engine:'2.1.19',maximum_numeric_difference:maximumDifference,tolerance:1e-9,
 coverage:['weekly/daily bias','5 city sessions','focus and all windows','start/core/end timestamps','source scores','lunar illumination/rank','major moon events','US/UK/Australia DST before/after']};
mkdirSync(resolve(ROOT,'ea/astro_swing_berjanggut/evidence'),{recursive:true});
writeFileSync(resolve(ROOT,'ea/astro_swing_berjanggut/evidence/parity.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
