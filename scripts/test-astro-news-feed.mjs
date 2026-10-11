import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const a='ea/astro_news/data/';
const rows=readFileSync(a+'news_windows.csv','utf8').trim().split('\n'),j=JSON.parse(readFileSync(a+'news_windows.json','utf8'));
assert.equal(rows[0],'event_id,event_name,release_epoch,calendar_checked,direction,start_epoch,entry_end_epoch,end_epoch,peak_epoch,aspects,model');
assert.equal(j.model,'CEBONK_ASTRO_NEWS_V1');
assert.equal(j.calendar_type,'WEBSITE_SNAPSHOT_NOT_LIVE');
assert.equal(j.calendar_checked,'2026-10-04');
assert.equal(j.experimental,true);
assert.deepEqual(j.policy,{pre:30,post:120,blockBefore:5,blockAfter:5,entrySpan:10,minWindow:15,otherRisk:true});
assert.equal(j.window_count,rows.length-1);
let n=0;const identities=new Set();
for(const e of j.events){
 for(const w of e.windows){
  const k=e.id+'-'+w.start_epoch;
  assert.ok(!identities.has(k));identities.add(k);
  assert.ok(w.start_epoch>=e.release_epoch+300);
  assert.ok(w.entry_end_epoch-w.start_epoch<=600);
  assert.ok(w.end_epoch>=w.entry_end_epoch);
  assert.ok(w.end_epoch<=e.release_epoch+120*60+300);
  assert.ok(['BUY','SELL'].includes(w.direction));
  assert.equal(w.direction,e.focus);
  n++;
 }
}
assert.equal(n,j.window_count);
for(const row of rows.slice(1)){
 const a=row.split(',');
 assert.equal(a.length,11);
 assert.equal(a[3],'2026-10-04');
 assert.ok(['BUY','SELL'].includes(a[4]));
 assert.equal(a[10],'CEBONK_ASTRO_NEWS_V1');
 assert.ok(a[9].length>3);
}
console.log('PASS: exact website news planner, model provenance, buffer, initial windows and CSV contracts ('+n+' windows)');
