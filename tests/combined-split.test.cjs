'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const C=require('../assets/combined1-legacy.js'),read=p=>fs.readFileSync(p,'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=JSON.parse(read('archive/combined-mode-integrity.json')),old=read('archive/combined1-original-3ead2e75.html');
const legacy=[...old.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes("const API_BASE='https://cebonk-xau-api"));
const helpers=legacy.slice(legacy.indexOf('function parseUtc('),legacy.indexOf('async function refreshTech('));
const begin=legacy.indexOf('  const last=candles[candles.length-1]'),end=legacy.indexOf("  $('techSignal').textContent=signal",begin),calc=legacy.slice(begin,end);
assert.equal(sha(helpers),manifest.helpersSHA256);assert.equal(sha(calc),manifest.calculationSHA256);
assert.ok(read('assets/combined1-legacy.js').includes(helpers));assert.ok(read('assets/combined1-legacy.js').includes(calc));
assert.equal(sha(read('assets/auto-combined-core.js')),manifest.newCoreSHA256);
assert.equal(sha(read('assets/snd-auto-core.js')),manifest.locationCoreSHA256);
assert.equal(sha(read('assets/astro-news-v1.js')),manifest.newsSHA256);
console.log('PASS original C1 helpers/calculations byte-identical; C2 and location numeric cores, News untouched');
const box={Date,Intl};vm.runInNewContext('const PIVOT_DEPTH=2,SL_BUFFER_ATR=0.15,ENTRY_HOLD_BARS=5;\n'+helpers+'\nfunction original(candles,m5,m15){\n'+calc+'return {signal,stage,entry,sl,tp1,tp2,tp3,direction,entryMs,touchFresh,trend5,trend15};}\nglobalThis.original=original;',box);
const M=60000,T=Date.parse('2026-10-05T12:00:00Z');
const rows=[[110,111,109,110.5],[111,112,110,111.5],[112,114,111,113],[113,115,112,114],[112,113,111,111.5],[111,112,110,110.5],[110,111,109,110],[111,113,110,112],[112,114,111,113],[114,115,113,114.5],[115,117,114,116],[116,116.5,112,113],[113,114,111,112],[112,113,109.5,110],[110,111,107,108],[108,115.5,107.5,114]];
const b=[...Array.from({length:100},(_,i)=>({ms:T-(100-i)*M,open:105,high:106,low:104,close:105})),...rows.map(([open,high,low,close],i)=>({ms:T+i*M,open,high,low,close}))];
const m=Array.from({length:100},(_,i)=>({ms:T-(100-i)*5*M,open:130-i*.2+.1,high:131-i*.2,low:129-i*.2,close:130-i*.2}));
const mirror=a=>a.map(c=>({...c,open:230-c.open,high:230-c.low,low:230-c.high,close:230-c.close}));
function comparable(x){return JSON.parse(JSON.stringify(Object.fromEntries(['signal','stage','entry','sl','tp1','tp2','tp3','direction','entryMs','touchFresh','trend5','trend15'].map(k=>[k,x[k]]))));}
for(const [name,one,five,fifteen] of [['SELL',b,m,m],['BUY',mirror(b),mirror(m),mirror(m)],['mixed',b,m,mirror(m)]]){
 assert.deepEqual(comparable(C.calculate(one,five,fifteen)),comparable(box.original(one,five,fifteen)));console.log('PASS historical calculation equivalence '+name);
}
assert.equal(C.calculate(b,m,m).signal,'SELL');assert.equal(C.calculate(mirror(b),mirror(m),mirror(m)).signal,'BUY');
assert.equal(C.calculate(b,m,mirror(m)).signal,'WAIT');assert.equal(C.sma([1,2,3,4],2),3.5);
assert.equal(C.calculate(b,m,m).entry,C.calculate(b,m,m).setup.cb1.price);
const html=read('index.html');for(const id of ['tabAstro','tabCombined','tabCombined2','combinedView','combined2View','combinedSplitLoader'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
assert.ok(read('assets/auto-combined-ui.js').includes("$('tabCombined2')"));
assert.ok(!read('assets/auto-combined-ui.js').includes("$('tabCombined').addEventListener"));
console.log('PASS SMA20/50, direct CB1 price, BUY/SELL symmetry, mismatch WAIT, separate page identities');
module.exports={b,m,M,T};
