'use strict';
const assert=require('assert');
const D=require('../assets/astro-daily-brief.js');
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name);};
const M=60000;
t('WIB date rolls UTC evening into next WIB day',()=>{
  assert.equal(D.wibDate(Date.parse('2026-10-07T18:00:00Z')),'2026-10-08');
});
t('dailySignals keeps only BUY SELL groups',()=>{
  const s={groups:[
    {state:'BUY',start:0,end:30*M,best:{ms:10*M}},
    {state:'NEUTRAL',start:30*M,end:40*M},
    {state:'SELL',start:40*M,end:80*M,best:{ms:50*M}},
    {state:'TRANSITION',start:80*M,end:85*M}
  ]};
  const x=D.dailySignals(s);assert.equal(x.length,2);assert.equal(x[0].dir,'BUY');assert.equal(x[1].dir,'SELL');
});
t('transition creates whipsaw warning',()=>{
  const s={groups:[{state:'BUY',start:0,end:30*M},{state:'TRANSITION',start:30*M,end:40*M},{state:'SELL',start:40*M,end:60*M}]};
  const w=D.astrologyWhipsaw(s);assert.equal(w.length,1);assert.equal(w[0].start,30*M);assert.equal(w[0].end,40*M);
});
t('direct BUY SELL switch creates padded warning',()=>{
  const s={groups:[{state:'BUY',start:0,end:30*M},{state:'SELL',start:30*M,end:60*M}]};
  const w=D.astrologyWhipsaw(s,5);assert.equal(w.length,1);assert.equal(w[0].start,25*M);assert.equal(w[0].end,35*M);
});
t('overlapping warnings merge',()=>{
  const x=D.mergeWindows([{start:0,end:10,reason:'A'},{start:5,end:15,reason:'B'}]);
  assert.equal(x.length,1);assert.deepEqual(x[0].reasons,['A','B']);
});
t('newsForDate uses WIB release date',()=>{
  const cal=[
    {id:'a',ms:Date.parse('2026-10-07T12:30:00Z')},
    {id:'b',ms:Date.parse('2026-10-07T18:00:00Z')}
  ];
  assert.deepEqual(D.newsForDate(cal,'2026-10-07').map(x=>x.id),['a']);
  assert.deepEqual(D.newsForDate(cal,'2026-10-08').map(x=>x.id),['b']);
});
t('news config matches web default policy',()=>{
  const c=D.newsConfig({id:'x',name:'NFP',ms:123,source:'s'});
  assert.equal(c.pre,30);assert.equal(c.post,120);assert.equal(c.blockBefore,5);assert.equal(c.blockAfter,5);
  assert.equal(c.entrySpan,10);assert.equal(c.minWindow,15);assert.equal(c.confirmed,true);assert.equal(c.otherRisk,true);
});
console.log('TOTAL',n);
