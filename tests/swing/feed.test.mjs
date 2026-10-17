import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,sourceEngines} from '../../scripts/swing/source.mjs';
import {encodeFeed,decodeFeed,validateFeed,canonical,addDay} from '../../scripts/swing/feed.mjs';
const raw=readFileSync(resolve(ROOT,'tests/swing/fixtures/swing-forecast-v2.valid.json'),'utf8');
const base=decodeFeed(raw),clock=base.generated_at_utc;
const copy=()=>structuredClone(base);
const valid=data=>validateFeed(decodeFeed(encodeFeed(data)),{nowUtc:clock});
test('actual feed validates and preserves its checksum on round trip',()=>{
 assert.equal(valid(base).sessions.length,25);assert.equal(encodeFeed(base),raw);
 assert.equal(base.m5_model,'MUSANG_BERJANGGUT_CBR');
 assert.equal(base.moon.samples.length,193);
});
test('canonical JSON rejects nonfinite values and changes in bytes',()=>{
 assert.throws(()=>canonical({bad:NaN}),/Nonfinite/);
 assert.throws(()=>decodeFeed(raw.replace('MUSANG_BERJANGGUT_CBR','MUSANG_OTHER_MODEL')),/mismatch/);
 assert.throws(()=>decodeFeed(raw.replace('"schema_version":"2.0.0"','"schema_version": "2.0.0"')),/mismatch/);
 assert.throws(()=>decodeFeed('{"a":1}'),/suffix/);
 assert.throws(()=>decodeFeed('x'.repeat(2097153)),/exceeds/);
});
for(const [name,mutate] of [
 ['old M5 model',d=>{d.m5_model='EL2_CB1';}],
 ['unknown field',d=>{d.new_strategy='AUTO_BUY';}],
 ['missing fifth weekday',d=>d.weeks[0].daily.pop()],
 ['duplicate weekday',d=>{d.weeks[0].daily[1].date_wib=d.weeks[0].daily[0].date_wib;}],
 ['daily inherits wrong direction',d=>{d.weeks[0].daily[0].swing_daily_direction_inherited='CAMPURAN';}],
 ['duplicate lunar ranks',d=>{d.weeks[0].daily[1].moon_rank=d.weeks[0].daily[0].moon_rank;}],
 ['missing session',d=>d.sessions.pop()],
 ['duplicate session',d=>{d.sessions[1]=structuredClone(d.sessions[0]);}],
 ['invalid session id',d=>{d.sessions[0].session_id='asia_extra';}],
 ['DST shift',d=>{d.sessions[0].session_start_utc+=3600;}],
 ['timezone drift',d=>{d.sessions[0].iana_timezone='Asia/Tokyo';}],
 ['short horizon',d=>{d.horizon_end_wib=addDay(d.horizon_start_wib,2);}],
 ['invalid prediction flag',d=>{d.validated_predictive_model=true;}],
 ['negative illumination',d=>{d.moon.samples[0].illumination_pct=-1;}],
 ['duplicate moon time',d=>{d.moon.samples[1].observed_at_utc=d.moon.samples[0].observed_at_utc;}],
 ['past expiry',d=>{d.expires_at_utc=clock-1;}],
 ['future publication',d=>{d.generated_at_utc=clock+601;}],
 ['wrong source hash',d=>{d.source_commit='not_a_sha';}],
 ['wrong inherited marker',d=>{d.swing_daily_inherited_weekly=false;}]
])test('reject '+name,()=>{const d=copy();mutate(d);assert.throws(()=>valid(d));});
test('current clock cannot use expired data or data outside its horizon',()=>{
 assert.throws(()=>validateFeed(base,{nowUtc:clock+108001}),/Stale/);
 assert.throws(()=>validateFeed(base,{nowUtc:clock-601}),/Stale/);
});
test('WAIT has no order window; directional window never accepts end<=core',()=>{
 let d=copy(),s=d.sessions[0];s.astro_direction='WAIT';s.window=null;s.moon_at_core.observed_at_utc=s.session_start_utc;assert.doesNotThrow(()=>valid(d));
 s.window={id:'bad',start_utc:s.session_start_utc,core_utc:s.session_start_utc,end_utc:s.session_start_utc,direction:'BUY',score_peak:2};
 assert.throws(()=>valid(d));s.astro_direction='BUY';assert.throws(()=>valid(d));
});
test('a zero duration AWAL retains source core==start and does not invent an earlier entry',()=>{
 const d=copy(),s=d.sessions.find(s=>s.window);
 assert.ok(s);s.window.core_utc=s.window.start_utc;s.moon_at_core.observed_at_utc=s.window.core_utc;assert.doesNotThrow(()=>valid(d));
});
test('source killzone schedule switches DST by city, not a permanent WIB table',()=>{
 const {C,K}=sourceEngines();
 const starts=date=>Object.fromEntries(K.schedule(date,C).map(s=>[s.id,s.start]));
 assert.equal(new Date(starts('2026-03-06').newyork).getUTCHours(),13);
 assert.equal(new Date(starts('2026-03-09').newyork).getUTCHours(),12);
 assert.equal(new Date(starts('2026-03-27').london).getUTCHours(),8);
 assert.equal(new Date(starts('2026-03-30').london).getUTCHours(),7);
 assert.equal(new Date(starts('2026-04-03').sydney).getUTCHours(),21);
 assert.equal(new Date(starts('2026-04-06').sydney).getUTCHours(),22);
 assert.equal(new Date(starts('2026-10-02').sydney).getUTCHours(),22);
 assert.equal(new Date(starts('2026-10-05').sydney).getUTCHours(),21);
 assert.throws(()=>K.schedule('2026-10-18',C),/Sabtu/);
});
