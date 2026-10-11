// Fail closed + SSOT format regression for generated GitHub feed.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const path='ea/liquidity_sweep/weekly_atr/data/';
const csv=readFileSync(path+'weekly.csv','utf8').trim().split('\n');
const meta=JSON.parse(readFileSync(path+'weekly.json','utf8'));
const header='monday,week_direction,date,start_epoch,core_epoch,end_epoch,model';
assert.equal(csv[0],header);
assert.equal(meta.model,'ASTRO_WEEKLY_V1');
assert.equal(meta.experimental,true);
assert.equal(meta.total_slots,1080);
assert.ok(['BUY','SELL','CAMPURAN','TIDAK ADA ARAH'].includes(meta.week_direction));
assert.equal(csv.length-1,meta.windows.length);
assert.ok(csv.length<=6);
if(csv.length===1)assert.equal(meta.status,'NO_TRADE');
else{
 assert.equal(meta.status,'READY');
 for(let i=1;i<csv.length;i++){
  const fields=csv[i].split(',');
  assert.equal(fields.length,7);
  assert.equal(fields[0],meta.week_monday_wib);
  assert.equal(fields[1],meta.week_direction);
  assert.equal(fields[6],'ASTRO_WEEKLY_V1');
  const a=Number(fields[3]),c=Number(fields[4]),e=Number(fields[5]);
  assert.ok(a<=c&&c<e&&e-a>=1800);
  assert.ok([a,c,e].every(n=>Number.isSafeInteger(n)&&n%300===0));
  assert.equal(new Date(a*1000+7*3600000).toISOString().slice(0,10),fields[2]);
 }
}
console.log('PASS: feed SSOT/parity, windows, neutral-no-entry, model and epochs');
