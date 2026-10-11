'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../assets/albiruni-core.js');
const A=require('astronomy-engine');
const ROOT=path.join(__dirname,'..');
const date='2026-10-05',start=C.parseDate(date),HOUR=60*C.MIN;
const fast={yieldNow:async()=>{}};
const mock=fn=>({longitude:(body,ms)=>body==='Sun'?0:body==='Moon'?C.norm(fn((ms-start)/HOUR)):({Mercury:43,Venus:76,Mars:145,Jupiter:224,Saturn:289})[body]});
const lunarConjunction=r=>r.events.filter(e=>e.pair.join('/')==='Sun/Moon'&&e.angle===0);
async function run(){
 assert.equal(new Date(start).toISOString(),'2026-10-04T17:00:00.000Z');
 assert.equal(C.stamp(start),'2026-10-05 00:00:00 WIB');
 assert.equal(C.geometry(359,1,0).orb,2);
 assert.equal(C.geometry(10,310,60).orb,0);
 assert.equal(C.geometry(0,180,180).orb,0);
 assert.equal(C.pairs().length,6);assert.equal(C.pairs('all').length,21);
 assert.deepEqual(C.period('2026-10-11').days.map(d=>d.date),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
 assert.equal(C.period('2024-02-11','month').days.length,29);
 assert.equal(C.period('2026-10-11','day').days[0].weekday,0);
 for(const invalid of ['2026-02-30','2026-13-01','2019-12-31','not-a-date'])assert.throws(()=>C.period(invalid));
 assert.throws(()=>C.period('2020-01-01','week'),/2020/);
 assert.throws(()=>C.period(date,'bad'));
 const linear=mock(h=>h-12),r=await C.scan(linear,date,{mode:'day',...fast});
 const [e]=lunarConjunction(r);assert.equal(lunarConjunction(r).length,1);
 assert.ok(Math.abs(e.start-(start+10*HOUR))<=1000,'orb entry refined');
 assert.ok(Math.abs(e.exactTimes[0]-(start+12*HOUR))<=1000,'exact refined');
 assert.ok(Math.abs(e.end-(start+14*HOUR))<=1000,'orb exit refined');
 assert.equal(e.startClipped,false);assert.equal(e.endClipped,false);
 assert.equal(C.inspect(linear,r,start+11*HOUR).active.find(x=>x.id===e.id).phase,'APPLYING');
 assert.equal(C.inspect(linear,r,start+13*HOUR).active.find(x=>x.id===e.id).phase,'SEPARATING');
 assert.equal(C.inspect(linear,r,e.exactTimes[0]).active.find(x=>x.id===e.id).phase,'EXACT');
 const offGrid=await C.scan(mock(h=>h-12.12345),date,{mode:'day',...fast});
 assert.ok(Math.abs(lunarConjunction(offGrid)[0].exactTimes[0]-(start+12.12345*HOUR))<=1000,'exact is not snapped to a grid');
 const stationary=await C.scan(mock(()=>1),date,{mode:'day',...fast});
 const [s]=lunarConjunction(stationary);
 assert.equal(s.exactTimes.length,0);assert.equal(s.closestOrb,1);
 assert.equal(s.start,start);assert.equal(s.end,start+C.DAY);assert.ok(s.startClipped&&s.endClipped);
 const grazing=await C.scan(mock(h=>0.1+0.04*(h-12.1)**2),date,{mode:'day',...fast});
 assert.equal(lunarConjunction(grazing)[0].exactTimes.length,0,'near miss is not exact');
 assert.ok(Math.abs(lunarConjunction(grazing)[0].closestOrb-0.1)<1e-6);
 const edge=await C.scan(mock(h=>1.99999+0.003*(h-0.125)**2),date,{mode:'day',...fast});
 assert.equal(lunarConjunction(edge).length,1,'grazing contact between first two samples detected');
 assert.ok(lunarConjunction(edge)[0].start>start);
 const repeated=await C.scan(mock(h=>0.0008*(h-4)*(h-12)*(h-20)),date,{mode:'day',...fast});
 assert.equal(lunarConjunction(repeated)[0].exactTimes.length,3,'retrograde repeats are retained');
 const discontinuity=await C.scan(mock(h=>179+h/12),date,{mode:'day',...fast});
 assert.equal(discontinuity.events.filter(e=>e.pair.join('/')==='Sun/Moon'&&e.angle===90).length,0,'branch switch is not an exact contact');
 await assert.rejects(C.scan(linear,date,{orb:0}),/Orb/);
 await assert.rejects(C.scan(linear,date,{cancelled:()=>true}),/dibatalkan/);
 await assert.rejects(C.scan({longitude:()=>NaN},date,fast),/tidak valid/);
 assert.equal(C.direction([{angle:0}]),'NETRAL');
 assert.equal(C.direction([{angle:0}],{0:'BUY'}),'BUY');
 assert.equal(C.direction([{angle:0},{angle:90}],{0:'BUY',90:'SELL'}),'KONFLIK');
 assert.equal(C.normalizeRules({0:'<script>'})[0],'NETRAL');
 // AUTO hypothesis: transparent, deterministic and independent of manual rule settings.
 // No simplistic Sextile=BUY / Square=SELL mapping. Planet natures contribute sign.
 const mk=(pair,angle,id)=>({
  id,pair,name:C.ASPECTS.find(x=>x.angle===angle).name,angle,
  start:start+10*HOUR,end:start+12*HOUR,exactTimes:[start+11*HOUR],
  closest:start+11*HOUR,closestOrb:0,startClipped:false,endClipped:false
 });
 const windowResult=events=>({
  version:'1.2.0',range:C.period('2026-10-05','day'),orb:2,
  focus:'all',stepMinutes:15,events
 });
 const pseudo={longitude:(body)=>({
  Sun:90,Moon:0,Mercury:180,Venus:150,Mars:180,Jupiter:60,Saturn:240
 })[body]};
 const t=start+11*HOUR;
 const bullish=windowResult([mk(['Moon','Jupiter'],60,'test-benefic-sextile')]);
 const bearish=windowResult([mk(['Mars','Saturn'],60,'test-malefic-sextile')]);
 assert.equal(C.autoSignal(pseudo,bullish,t).direction,'BUY');
 const autoCsv=C.toAutoStudyCSV(pseudo,bullish);
 assert.match(autoCsv,/auto_hypothesis_UNVALIDATED/);
 assert.match(autoCsv,/observed_xau_t0_EMPTY/);
 assert.match(autoCsv,/"BUY"/);
 assert.equal(autoCsv.trim().replace(/^\uFEFF/,'').split('\r\n')[0].split(',').length,28);
 assert.ok(autoCsv.trim().replace(/^\uFEFF/,'').split('\r\n').slice(1)
  .every(x=>x.split(',').length===28));
 const emptyCsv=C.toAutoStudyCSV(pseudo,windowResult([]));
 assert.equal(emptyCsv.trim().split('\r\n').length,1,'zero events keep valid header');

 assert.equal(C.autoSignal(pseudo,bearish,t).direction,'SELL','sextile must NOT blindly give BUY');
 const neutral=windowResult([mk(['Moon','Mercury'],180,'neutral-opposition')]);
 assert.equal(C.autoSignal(pseudo,neutral,t).direction,'NETRAL','absence of signed planetary evidence must remain neutral');
 const squareBuy=windowResult([mk(['Venus','Jupiter'],90,'benefic-square')]);
 assert.equal(C.autoSignal(pseudo,squareBuy,t).direction,'BUY','square must NOT blindly give SELL');
 const opposite=windowResult([mk(['Moon','Jupiter'],60,'buy'),mk(['Mars','Saturn'],60,'sell')]);
 const contradiction=C.autoSignal(pseudo,opposite,t);
 assert.equal(contradiction.direction,'KONFLIK');
 assert.equal(contradiction.reason,'BUY_SELL_OVERLAP');
 assert.equal(contradiction.validated,false);
 assert.equal(contradiction.model,'ALBIRUNI_AUTO_EXPERIMENT_V1');
 assert.equal(C.autoSignal(pseudo,bullish,start+9*HOUR).direction,'NETRAL','outside aspect windows must remain neutral');
 assert.deepEqual(C.normalizeRules()[60],'NETRAL','MANUAL legacy baseline unchanged');
 assert.equal(C.AUTO_THRESHOLD,0.18);
 const autoDay=C.autoTimeline(pseudo,bullish,start);
 assert.equal(autoDay.resolutionMinutes,15);
 const reportDay=C.autoPeriodSummary(pseudo,bullish);
 assert.equal(reportDay.mode,'day');
 assert.equal(reportDay.resolutionMinutes,15);
 assert.equal(reportDay.direction,'BUY');
 assert.equal(reportDay.days.length,1);
 assert.equal(reportDay.days[0].date,'2026-10-05');
 assert.ok(reportDay.startWindow<=reportDay.core&&reportDay.core<reportDay.endWindow);
 assert.equal(reportDay.validated,false);
 assert.equal(reportDay.buyMinutes,120);
 const emptyWeek=windowResult([]);
 emptyWeek.range=C.period('2026-10-11','week');
 const reportWeek=C.autoPeriodSummary(pseudo,emptyWeek);
 assert.equal(reportWeek.mode,'week');
 assert.equal(reportWeek.resolutionMinutes,30);
 assert.equal(reportWeek.days.length,5);
 assert.equal(reportWeek.direction,'NETRAL');
 assert.equal(reportWeek.startWindow,null);
 assert.ok(reportWeek.days.every(x=>!x.marketClosed));
 const monthRange=C.period('2026-10-11','month');
 const saturday=Date.parse('2026-10-10T10:00:00+07:00');
 const saturdayEvent={...mk(['Moon','Jupiter'],60,'saturday-only'),
  start:saturday,end:saturday+2*HOUR,closest:saturday+HOUR,exactTimes:[saturday+HOUR],
  startClipped:false,endClipped:false};
 const monthOnlyWeekend={version:'1.3.0',range:monthRange,orb:2,focus:'all',stepMinutes:15,events:[saturdayEvent]};
 const reportMonth=C.autoPeriodSummary(pseudo,monthOnlyWeekend);
 assert.equal(reportMonth.mode,'month');
 assert.equal(reportMonth.resolutionMinutes,60);
 assert.equal(reportMonth.days.length,31);
 assert.equal(reportMonth.direction,'NETRAL','weekend-only aspects cannot determine XAUUSD monthly focus');
 assert.equal(reportMonth.buyMinutes,0);
 assert.ok(reportMonth.days.find(x=>x.date==='2026-10-10').marketClosed);
 assert.equal(reportMonth.days.find(x=>x.date==='2026-10-10').direction,'BUY');
 assert.ok(!reportMonth.days.find(x=>x.date==='2026-10-12').allWindows
   .some(x=>x.start===saturday),'never move weekend aspects to Monday');
 assert.throws(()=>C.autoPeriodSummary(pseudo,bullish,{stepMinutes:7}),/Resolusi/);

 assert.ok(autoDay.windows.some(x=>x.direction==='BUY'&&x.start===start+10*HOUR&&x.end===start+12*HOUR));
 assert.ok(autoDay.windows.every(x=>x.peak>=x.start&&x.peak<x.end));
 assert.throws(()=>C.autoTimeline(pseudo,bullish,start-86400000),/Hari tidak ada/);

 assert.throws(()=>C.inspect(linear,r,r.range.end));
 const csv=C.toCSV(r,{0:'BUY'});assert.match(csv,/manual_bias_UNVALIDATED/);assert.match(csv,/'?2026-10-05 12:00/);assert.match(csv,/"BUY"/);
 // Reproducible event-study rows contain NO fabricated price returns or win rates.
 assert.equal(r.version,'1.3.0');
 const obs=C.studyObservations(r,{0:'BUY'});
 const selected=obs.filter(x=>x.pair==='Sun/Moon'&&x.angle===0);
 assert.equal(selected.length,1);
 assert.equal(selected[0].kind,'EXACT');
 assert.equal(selected[0].manualBias,'BUY');
 assert.equal(selected[0].weekday,'HARI_KERJA');
 assert.ok(Math.abs(selected[0].time-(start+12*HOUR))<=1000);
 const study=C.toStudyCSV(r,{0:'BUY'});
 assert.match(study,/ALBIRUNI_EVENT_STUDY_V1/);
 assert.match(study,/observed_xau_t0_EMPTY/);
 assert.match(study,/observed_xau_4h_EMPTY/);
 assert.match(study,/manual_bias_UNVALIDATED/);
 assert.doesNotMatch(study,/winrate|profit_factor|forecast_price/);
 const studyRows=study.trim().replace(/^\uFEFF/,'').split('\r\n');
 assert.equal(studyRows[0].split(',').length,24);
 assert.ok(studyRows.slice(1).every(x=>x.split(',').length===24));
 assert.ok(studyRows.some(x=>x.includes('"EXACT"')&&x.includes('"BUY"')));
 const miss=C.studyObservations(grazing);
 assert.ok(miss.some(x=>x.pair==='Sun/Moon'&&x.angle===0&&x.kind==='TERDEKAT_BUKAN_EXACT'));
 const rep=C.studyObservations(repeated).filter(x=>x.pair==='Sun/Moon'&&x.angle===0);
 assert.equal(rep.length,3,'each repeated exact must remain a separate study observation');
 const weekend=await C.scan(mock(h=>h-(6*24+12)),'2026-10-11',{mode:'day',...fast});
 const sunday=C.studyObservations(weekend).find(x=>x.pair==='Sun/Moon'&&x.angle===0);
 assert.ok(sunday&&sunday.weekday==='AKHIR_PEKAN','Sunday remains Sunday, not shifted to Friday or Monday');
 assert.equal(C.toStudyCSV(weekend).includes('"AKHIR_PEKAN"'),true);

 // An independently supplied lunar phase search checks a real exact contact.
 const real=C.createEngine(A),week=await C.scan(real,'2026-10-12',{...fast});
 // SearchMoonPhase uses GeoVector(...,false). Match that documented source
 // convention for this reference check; production uses aberration=true.
 const phaseEngine=C.createEngine({...A,GeoVector:(body,time)=>A.GeoVector(body,time,false)});
 const month=await C.scan(phaseEngine,'2026-10-12',{mode:'month',...fast});
 const phase=A.SearchMoonPhase(0,new Date(month.range.start),32);
 assert.ok(lunarConjunction(month).flatMap(x=>x.exactTimes).some(ms=>Math.abs(ms-phase.date.getTime())<3000),'new moon agrees with official phase solver using matched coordinates');
 const apparent=await C.scan(real,'2026-10-12',{mode:'month',...fast});
 const newMoon=lunarConjunction(apparent)[0];
 const independent=A.Search(t=>C.signed(A.Ecliptic(A.GeoVector('Moon',t,true)).elon-A.Ecliptic(A.GeoVector('Sun',t,true)).elon),A.MakeTime(new Date(newMoon.start)),A.MakeTime(new Date(newMoon.end)),{dt_tolerance_seconds:0.1});
 assert.ok(independent&&Math.abs(newMoon.exactTimes[0]-independent.date.getTime())<2000,'apparent exact agrees with independent root solver');
 for(const evt of week.events){
  assert.ok(evt.start>=week.range.start&&evt.end<=week.range.end&&evt.start<evt.end);
  for(const ms of evt.exactTimes)assert.ok(C.geometry(real.longitude(evt.pair[0],ms),real.longitude(evt.pair[1],ms),evt.angle).orb<0.0003);
  if(!evt.startClipped)assert.ok(Math.abs(C.geometry(real.longitude(evt.pair[0],evt.start),real.longitude(evt.pair[1],evt.start),evt.angle).orb-week.orb)<0.0003);
  if(!evt.endClipped)assert.ok(Math.abs(C.geometry(real.longitude(evt.pair[0],evt.end),real.longitude(evt.pair[1],evt.end),evt.angle).orb-week.orb)<0.0003);
 }
 assert.equal(C.daily(week).reduce((n,d)=>n+d.exactCount,0),week.events.reduce((n,e)=>n+e.exactTimes.length,0));
 const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 assert.equal((html.match(/id="albiruniPanel"/g)||[]).length,1);
 const astroStart=html.indexOf('<div id="astroView">');
 const astroEnd=html.indexOf('</div>\n<section id="albiruniPanel"');
 assert.ok(astroStart>=0&&astroEnd>astroStart,'Al-Biruni must be separate sibling view');
 assert.ok(html.indexOf('id="tabAlBiruni"')>=0,'Al-Biruni dedicated top navigation tab');
 assert.ok(html.indexOf('id="albiruniPanel" hidden')>astroEnd);
 const baziNav=fs.readFileSync(path.join(ROOT,'assets/bazi-ui.js'),'utf8');
 assert.match(baziNav,/tabAlBiruni/);
 assert.match(baziNav,/al-biruni/);

 for(const f of ['albiruni-core.js','albiruni-ui.js','albiruni.css'])assert.ok(html.includes(f));
 for(const f of ['albiruni-core.js','albiruni-ui.js'])assert.doesNotMatch(fs.readFileSync(path.join(ROOT,'assets',f),'utf8'),/CebonkCore|CEBONK_ASTRO_STATE|cebonk-astro-update|legacyImpact|classify\(/,'no dependency on legacy direction engine');
 console.log('Al-Biruni calculations: calendar, roots, orb edges, stations, retrograde, manual conflict, CSV and independent lunar phase check passed.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
