import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {engines,generate,encode,decode,validate,Astronomy,projectSession} from '../../indicators/astro_killzone/lib/feed.mjs';
const fixture=decode(readFileSync(new URL('./forecast.valid.json',import.meta.url),'utf8'));
const now=fixture.generated_at_utc+1;
const check=x=>validate(x,{nowUtc:now,requireCurrent:false});
const mutate=fn=>{const d=structuredClone(fixture);fn(d);return d;};
test('complete standalone forecast validates, without swing/weekly/daily fields',()=>{
 check(fixture);assert.equal(fixture.sessions.length,150);
 assert.ok(!Object.keys(fixture).some(k=>/week|moon|m5|ict|basket|risk/i.test(k)));
});
test('all five session identities occur exactly once per weekday',()=>{
 const days=new Map();for(const s of fixture.sessions){const ids=days.get(s.date_wib)||new Set();assert.ok(!ids.has(s.session_id));ids.add(s.session_id);days.set(s.date_wib,ids);}
 for(const ids of days.values())assert.equal(ids.size,5);
});
test('checksum detects edited scores',()=>assert.throws(()=>decode(encode(fixture).replace('Sydney','Sidney')),/Checksum/));
test('missing sessions rejected',()=>assert.throws(()=>check(mutate(d=>d.sessions.pop())),/Missing/));
test('duplicate session rejected',()=>assert.throws(()=>check(mutate(d=>d.sessions[1]=d.sessions[0])),/schedule/));
test('broker/WIB substitution cannot change source UTC times',()=>assert.throws(()=>check(mutate(d=>d.sessions[0].session_start_utc+=3600)),/schedule/));
test('unexpected weekly filter rejected',()=>assert.throws(()=>check(mutate(d=>d.weekly_direction='BUY')),/fields/));
test('wrong model rejected',()=>assert.throws(()=>check(mutate(d=>d.model_id='CEBONK_SWING_ASTRO_WEEKLY_DAILY_5KZ_V1')),/Model/));
test('focus and best-window ranking are checked',()=>{
 assert.throws(()=>check(mutate(d=>d.sessions[0].focus='INVALID')),/ranking/);
 assert.throws(()=>check(mutate(d=>{const s=d.sessions.find(s=>s.best_index>=0);s.best_index=-1;})),/ranking/);
});
test('invalid window bounds and off-grid endpoints rejected',()=>{
 assert.throws(()=>check(mutate(d=>{const s=d.sessions.find(s=>s.windows.length);s.windows[0].core_utc=s.windows[0].end_utc;})),/window/i);
 assert.throws(()=>check(mutate(d=>{const s=d.sessions.find(s=>s.windows.length);s.windows[0].start_utc++;})),/grid/);
});
test('future publication and current date outside horizon rejected',()=>{
 assert.throws(()=>validate(fixture,{nowUtc:fixture.generated_at_utc-601}),/clock/);
 assert.throws(()=>validate(fixture,{nowUtc:Date.parse(fixture.horizon_end_wib+'T00:00:00Z')/1000+86400}),/clock/);
});
test('invalid/too-wide generation ranges rejected',async()=>{
 await assert.rejects(generate({from:'2026-02-30',days:1}));await assert.rejects(generate({from:'2026-10-19',days:43}));
});
test('vendored original source and ephemeris hashes match audit',()=>{
 const base=new URL('../../indicators/astro_killzone/',import.meta.url),audit=JSON.parse(readFileSync(new URL('SOURCE_AUDIT.json',base)));
 for(const [name,hash] of Object.entries(audit.vendor_sha256))assert.equal(createHash('sha256').update(readFileSync(new URL('vendor/'+name,base))).digest('hex'),hash);
 for(const [name,hash] of Object.entries(audit.source_sha256))assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+name,base))).digest('hex'),hash);
});
test('real browser astronomy and original website source match standalone engine across DST',async()=>{
 const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8'),start=html.indexOf('/* CEBONK ASTROLOGY'),end=html.indexOf('</script>',start);
 const original=engines({core:html.slice(start,end),killzone:readFileSync(new URL('../../assets/astro-killzone-core.js',import.meta.url),'utf8')});
 const context={Date,Math,Intl};vm.createContext(context);vm.runInContext(readFileSync(new URL('./vendor/astronomy.browser.min.js',import.meta.url),'utf8'),context);
 const dates=['2026-03-06','2026-03-09','2026-03-27','2026-03-30','2026-04-03','2026-04-06','2026-10-02','2026-10-05','2026-10-23','2026-10-26','2026-10-30','2026-11-02'];
 const standalone=engines();let sessions=0;
 for(const date of dates){
  const actual=await standalone.K.calculate(date,Astronomy,standalone.C),expected=await original.K.calculate(date,context.Astronomy,original.C);
  for(let i=0;i<5;i++){
   const got=projectSession(actual.sessions[i],date),raw=expected.sessions[i];
   assert.equal(got.focus,raw.trend.focus);assert.equal(got.buy_minutes,raw.trend.buyMinutes);assert.equal(got.sell_minutes,raw.trend.sellMinutes);
   assert.equal(got.session_start_utc,raw.start/1000);assert.equal(got.session_end_utc,raw.end/1000);
   assert.equal(got.best_index,raw.trend.best?raw.trend.windows.indexOf(raw.trend.best):-1);
   assert.equal(got.windows.length,raw.trend.windows.length);
   got.windows.forEach((w,k)=>{const e=raw.trend.windows[k];assert.deepEqual(w,{direction:e.direction,raw_start_utc:e.rawStart/1000,start_utc:e.start/1000,core_utc:e.core/1000,end_utc:e.end/1000,score_peak:e.score});});sessions++;
  }
 }
 console.log('PARITY PASS: 12 dates, '+sessions+' sessions; all window times/scores identical; browser UMD versus Node.');
});
test('neutral mixed windows and dominant longest-window selection stay independent',()=>{
 const data=decode(readFileSync(new URL('./forecast.synthetic.json',import.meta.url),'utf8'));check(data);
 assert.equal(data.sessions[0].focus,'WAIT');assert.equal(data.sessions[0].windows.length,2);assert.equal(data.sessions[0].best_index,-1);
 assert.equal(data.sessions[1].best_index,1);assert.equal(data.sessions[1].windows[1].core_utc,data.sessions[1].windows[1].start_utc);
});
