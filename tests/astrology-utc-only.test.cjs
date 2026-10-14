'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const match=html.match(/<script>\s*(\/\* CEBONK ASTROLOGY[\s\S]*?)<\/script>/);
assert.ok(match,'Inline ASTROLOGI core is required');
const context={module:{exports:{}},setTimeout,Date};
vm.runInNewContext(match[1],context,{filename:'index-inline-astrology-core.js'});
const C=context.module.exports,T=C.Time;
assert.equal(typeof C.scan,'function');
assert.equal(typeof T.utcToUTC,'function');
const start=Date.parse('2026-10-14T00:00:00Z');
assert.equal(T.utcToUTC('2026-10-14',0),start);
assert.equal(T.utcToUTC('2026-10-14',360),start+6*3600000);
assert.equal(T.utcToUTC('2026-10-14',1440),start+24*3600000);
assert.equal(T.wibToUTC('2026-10-14',0),start-7*3600000,
 'Other tabs must retain original WIB API');
assert.equal(T.todayUTC(),new Date().toISOString().slice(0,10));
const fakeEngine={
 clear(){},
 get(ms){
  const positions={};
  for(const p of [...C.CFG.planets.map(x=>x.id),...C.CFG.angles])
   positions[p]={lon:0,dec:0};
  return {ms,positions};
 }
};
async function verify(){
 const utc=await C.scan(fakeEngine,'2026-10-14',0,false,()=>{},()=>false,'UTC');
 assert.equal(utc.length,288);
 assert.equal(utc[0].ms,start);
 assert.equal(utc[287].ms,start+287*300000);
 const six=await C.scan(fakeEngine,'2026-10-14',360,false,()=>{},()=>false,'UTC');
 assert.equal(six.length,216);
 assert.equal(six[0].ms,start+6*3600000);
 const legacy=await C.scan(fakeEngine,'2026-10-14',0,false);
 assert.equal(legacy[0].ms,start-7*3600000,
  'Existing consumers using default scan must remain on WIB');
 assert.match(html,/const samples=await C\.scan\(engine,iso,start,model,[\s\S]*?'UTC'\);/);
 assert.match(html,/date_UTC','time_UTC/);
 assert.match(html,/Tanggal jadwal \(UTC\)/);
 assert.match(html,/Jam UTC sekarang · UTC\+0/);
 assert.match(html,/id="tabAlBiruni"/);
 assert.match(html,/assets\/albiruni-original-v1-5-core\.js\?v=1\.5\.0-restored-20261014/);
 assert.match(html,/assets\/albiruni-original-v1-5-ui\.js\?v=1\.5\.0-restored-20261014/);
 assert.match(html,/assets\/solar-return-only-trend-core\.js\?v=3\.2\.0/);
 const ui=html.slice(html.indexOf('function error(msg)'),html.indexOf('</script>\n<script src='));
 assert.doesNotMatch(ui,/\bWIB\b/,'Visible ASTROLOGI UI should never label a UTC time as WIB');
 console.log('PASS: ASTROLOGI UTC+0 date, M5 scan, CSV, legacy WIB API and untouched Al-Biruni load');
}
verify().catch(e=>{console.error(e);process.exitCode=1;});
