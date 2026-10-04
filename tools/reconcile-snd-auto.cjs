'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);
const blob=s=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const guards={'assets/auto-combined-core.js':'8178b57c933eb82b128ba9400407a636362f196a','assets/auto-combined-ui.js':'4adad55b3ed1c73ff5a2666f1c6551b2fc52a279','tests/auto-combined.test.cjs':'05e40ca450e5a898815fb7a26ad76de552ba77d6'};
let core=read('assets/auto-combined-core.js'),ui=read('assets/auto-combined-ui.js');
if(core.includes('LOCATION_SCANNER_V310')){console.log('Already reconciled v3.1.0');process.exit(0);}
for(const [p,h] of Object.entries(guards))assert.equal(blob(read(p)),h,'Concurrent source changed: '+p+'; stop, do not overwrite');
function replace(s,a,b,label){assert.ok(s.includes(a),'Patch anchor missing: '+label);return s.replace(a,b);}
core=replace(core,"const MIN=60000,DAY=86400000;","// LOCATION_SCANNER_V310: reuse tested no-pattern SND/SNR rules, preserve Musang.\nconst Locations=root.CebonkSNDAuto||(typeof module!=='undefined'&&module.exports?require('./snd-auto-core.js'):null);\nif(!Locations)throw Error('SND_AUTO_CORE_NOT_LOADED');\nconst MIN=60000,DAY=86400000;",'location dependency');
core=core.replace("version:'3.0.0'","version:'3.1.0'").replace('AUTO SOP v3.0.0','AUTO SOP v3.1.0');
core=replace(core,'depth:2,maxBase:4,baseBody:0.5,departureBody:0.65,departureSize:1.5,keyTolerance:0.1,','depth:2,keyTolerance:0.1,','remove base classifier constants');
const start=core.indexOf('function zones('),end=core.indexOf('function keys(',start);assert.ok(start>=0&&end>start);
core=core.slice(0,start)+`function zones(b,tf,until=Infinity){
 const closed=b.filter(c=>c.end<=until).map(c=>({...c,closed:true}));
 return Locations.scan({tf,closed,bars:closed}).map(z=>({...z,
  sourceMs:z.originMs,bornAt:z.createdAt,tests:z.retests,lastTest:z.visits.length?z.visits[z.visits.length-1].end:null,
  formation:['DEMAND','SUPPLY'].includes(z.kind)?'SWING_DISPLACEMENT':'SWING_REACTION',initialDeparted:true}));
}
`+core.slice(end);
const cs=core.indexOf('function context('),ce=core.indexOf('function patterns(',cs);assert.ok(cs>=0&&ce>cs);
core=core.slice(0,cs)+`function rankLocations(zs,ks,direction,price,at){
 const eligible=zs.filter(z=>z.bornAt<=at&&['FRESH','TESTED'].includes(z.status)&&z.tests<=CFG.maxRetests);
 return eligible.filter(z=>side(z)===direction).map(z=>{
  const tol=(z.high-z.low)*CFG.keyTolerance;
  const confluence=ks.filter(k=>k.knownAt<=at&&k.price>=z.low-tol&&k.price<=z.high+tol&&!(k.tf===z.tf&&k.sourceMs===z.sourceMs));
  const peers=eligible.filter(x=>side(x)===direction&&x.tf!==z.tf&&overlap(z,x));
  const nested=peers.filter(x=>(z.low>=x.low&&z.high<=x.high)||(x.low>=z.low&&x.high<=z.high));
  return {...z,keys:confluence,nested:[...new Set(nested.map(x=>x.tf))],confluenceTF:[...new Set(peers.map(x=>x.tf))],
   distance:finite(price)?Math.max(z.low-price,price-z.high,0):Infinity};
 }).sort((a,b)=>(a.status==='FRESH'?0:1)-(b.status==='FRESH'?0:1)||b.confluenceTF.length-a.confluenceTF.length||b.nested.length-a.nested.length||
  (['SUPPLY','DEMAND'].includes(b.kind)?1:0)-(['SUPPLY','DEMAND'].includes(a.kind)?1:0)||b.keys.length-a.keys.length||
  a.distance/(a.scale||a.high-a.low)-b.distance/(b.scale||b.high-b.low)||b.bornAt-a.bornAt);
}
function context(zs,ks,direction,price,at){
 const candidates=rankLocations(zs,ks,direction,price,at).filter(z=>price>=z.low&&price<=z.high);
 const opposed=zs.filter(z=>z.bornAt<=at&&['FRESH','TESTED'].includes(z.status)&&z.tests<=CFG.maxRetests&&side(z)!==direction&&price>=z.low&&price<=z.high);
 return {selected:candidates[0]||null,candidates,opposed};
}
`+core.slice(ce);
core=core.replace('Nunggu zone FRESH/TESTED 1x + key level searah ing rega retest.','Nunggu SND/SNR otomatis searah ing rega retest; FRESH utama, TESTED 1x cadangan.').replace('Astrology + lokasi + key level + IB/CB1/retest selaras. Pengamatan, dudu order.','Astrology → SND/SNR otomatis → IB/CB1/retest selaras. Pengamatan, dudu order.').replace('life,keys,context,patterns','life,keys,rankLocations,context,patterns');
write('assets/auto-combined-core.js',core);
ui=ui.replace('v3.0.0','v3.1.0').replace('ASTROLOGY → SNR/SND + KEY LEVEL → FIBO MUSANG','ASTROLOGY → SND/SNR FRESH → FIBO MUSANG').replace('ZONA OTOMATIS PALING CEDHAK','KANDIDAT UTAMA · FRESH DAHULU');
ui=replace(ui,'Detektor numerik nggunakake pivot 2 candle kiwa/tengen; SND base maksimal 4 candle, rasio body ≤50%, departure body ≥65% lan range ≥1.5× rata-rata base. Iki engineering otomasi, dudu rumus eksplisit PDF. Hidden Engulfing lan kabeh Level 1–9 ora diklaim wis diotomasi.',
'Detektor lokasi nganggo pivot 2 candle lan displacement saka swing. Ukuran zona dibatasi 0.08–0.50 median range 20 candle; SND kudu close ngliwati candle asal lan jarak ≥1.5 median range ing maksimal 3 candle. Ora nganggo RBR/RBD/DBR/DBD. Angka iki engineering, dudu rumus PDF. Musang tetep subset one-to-one IB Level 2, dudu kabeh Level 1–9.','rule copy');
ui=ui.replace('Key kudu ing zona ±10% lebar zona, ora sumber candle zona sing padha. Nested/confluence mung kanggo ranking; dudu trigger. BROKEN lan TESTED luwih saka 1x ora dienggo arah lawas.',
'Key tambahan kudu ing zona ±10% lebar zona, ora sumber candle zona sing padha; dudu syarat entry wajib. FRESH prioritas sadurunge jarak. Nested/confluence TF beda nambah ranking, dudu trigger. BROKEN, DATA_GAP lan TESTED luwih saka 1x ora dienggo. Status FRESH adhedhasar candle sumber sing wis tutup; sentuhan ing candle HTF sing isih mlaku bisa durung katon. Jumlah retest iku minimal miturut OHLC, dudu tick.');
ui=replace(ui,"const keep={M1:65000,M5:65000,M15:65000,H1:30*60000,H4:60*60000,D1:6*3600000,W1:12*3600000,MN1:24*3600000};",
"const keep={M1:65000,M5:65000,M15:65000,H1:15*60000,H4:30*60000,D1:4*3600000,W1:6*3600000,MN1:12*3600000};\n const usable=tf=>{const c=cache.get(tf);return !!c&&!errors.has(tf)&&Date.now()-c.fetched<keep[tf];};",'cache lifetimes');
ui=ui.replace('if(c&&now-c.fetched<keep[tf])return c;','if(usable(tf))return c;');
ui=replace(ui,"const obj={b,fetched:now,provider:data.provider||'Twelve Data'};cache.set(tf,obj);errors.delete(tf);return obj;",
"const providerAt=Date.parse(data.fetchedAtUtc);if(!Number.isFinite(providerAt)||providerAt>now+60000||now-providerAt>=keep[tf])throw new Error('CACHE_DATA_STALE');\n   const obj={b,fetched:providerAt,provider:data.provider||'Twelve Data'};cache.set(tf,obj);errors.delete(tf);return obj;",'provider timestamp guard');
ui=ui.replace('if(!c||errors.has(tf))continue;','if(!usable(tf))continue;').replace('filter(x=>cache.has(x)&&!errors.has(x))','filter(x=>usable(x))').replace("esc(errors.get(t)||(d?d.b.length+' candle tutup':'MENUNGGU'))","esc(errors.get(t)||(usable(t)?d.b.length+' candle tutup':d?'CACHE EXPIRED':'MENUNGGU'))");
ui=ui.replace('const fresh=!!last&&!errors.has(tf)&&now>=last.end&&now-last.end<2*step;','const fresh=!!last&&usable(tf)&&now>=last.end&&now-last.end<2*step;');
ui=replace(ui,'const maps=allMaps(at),direction=r.setup?.direction,price=r.entry??last?.close;',"const maps=allMaps(at),liveBias=astro?.groups.find(g=>now>=g.start&&now<g.end)?.state,\n   direction=['BUY','SELL'].includes(liveBias)?liveBias:null,price=r.entry??last?.close;",'Astrology first ranking');
ui=ui.replace("ctx.selected.keys.map(k=>k.label+' '+fmt(k.price)).slice(0,2).join(' · '):'Butuh zone aktif + key level searah'",
"ctx.selected.status+' · '+(ctx.selected.keys.map(k=>k.label+' '+fmt(k.price)).slice(0,2).join(' · ')||'SNR tambahan ora wajib'):'Nunggu zona otomatis searah ing rega retest'");
ui=replace(ui,"const current=allMaps(now);const nearest=current.zs.sort((a,z)=>Math.abs((a.low+a.high)/2-(last?.close||0))-Math.abs((z.low+z.high)/2-(last?.close||0))).slice(0,14);",
"const current=allMaps(now);const nearest=['BUY','SELL'].includes(liveBias)?A.rankLocations(current.zs,current.ks,liveBias,last?.close,now).slice(0,14):[];",'fresh-first visible candidates');
ui=ui.replace("'Durung ana zona saka data sing valid.'","'Nunggu Astrology BUY/SELL aktif utawa data zona sehat. Ora meksa arah.'");
ui=replace(ui,"await Promise.allSettled([...new Set([$('autoTF').value,...A.CFG.context])].map(feed));await task;",
"for(const frame of [...new Set([$('autoTF').value,...A.CFG.context])]){try{await feed(frame);}catch(e){/* Frame error stays explicit; others continue. */}}await task;",'sequential requests');
write('assets/auto-combined-ui.js',ui);
let location=read('assets/snd-auto-core.js');location=location.replace(' if(gap<=2*H)return false;\n','');write('assets/snd-auto-core.js',location);
let index=read('index.html');assert.ok(index.includes('id="autoCombinedLoader"'),'Preserve current automatic host');
if(!index.includes('src="assets/snd-auto-core.js'))index=index.replace('<script src="assets/auto-combined-core.js','<script src="assets/snd-auto-core.js?v=1.0.1"></script>\n<script src="assets/auto-combined-core.js');
index=index.replace(/(assets\/auto-combined-(?:core|ui)\.js\?v=)3\.0\.0/g,'$13.1.0');write('index.html',index);
let test=read('tests/auto-combined.test.cjs');
test=test.replace("formation:'RBD'","formation:'SWING_DISPLACEMENT'");
test=replace(test,"t('Own pivot is not independent confluence',()=>assert.equal(A.context([active],[{...key,tf:z.tf,sourceMs:z.sourceMs}],'SELL',115,T+M).selected,null));",
"t('Own pivot is not independent confluence',()=>assert.equal(A.context([active],[{...key,tf:z.tf,sourceMs:z.sourceMs}],'SELL',115,T+M).selected.keys.length,0));",'optional confluence test');
test=replace(test,"t('Key known after event does not qualify',()=>assert.equal(A.context([active],[{...key,knownAt:T+10*M}],'SELL',115,T+M).selected,null));",
"t('Future key not counted but fresh location remains eligible',()=>assert.equal(A.context([active],[{...key,knownAt:T+10*M}],'SELL',115,T+M).selected.keys.length,0));",'future key test');
const testStart=test.indexOf('const bases=['),testEnd=test.indexOf("console.log('TOTAL_PASS'",testStart);assert.ok(testStart>=0&&testEnd>testStart);
test=test.slice(0,testStart)+`const h=3600000,history=Array.from({length:40},(_,i)=>bar(i,105,106+(i%2)*.1,104,105,h));
history[22]=bar(22,101,105,98,102,h);history[23]=bar(23,103,110,102,109,h);history[24]=bar(24,109,112,108,111,h);
for(let i=25;i<history.length;i++)history[i]=bar(i,110,113+(i%3)*.1,109,112,h);
t('SND displacement from swing without base patterns',()=>assert.ok(A.zones(history,'H1').some(z=>z.kind==='DEMAND'&&z.formation==='SWING_DISPLACEMENT')));
t('No RBR DBR DBD RBD labels',()=>assert.ok(A.zones(history,'H1').every(z=>!['RBR','DBR','DBD','RBD'].includes(z.formation))));
t('As-of scan excludes unconfirmed origin',()=>assert.equal(A.zones(history,'H1',history[22].end).filter(z=>z.kind==='DEMAND').length,0));
t('FRESH ahead of nearby TESTED',()=>{const far={...active,id:'far',low:200,high:202,scale:2},near={...active,id:'near',status:'TESTED',tests:1,scale:2};assert.equal(A.rankLocations([near,far],[],'SELL',115,T+M)[0].id,'far');});
t('Fresh standalone zone can qualify without invented mandatory key',()=>assert.ok(A.context([active],[],'SELL',115,T+M).selected));
t('History-gap locations excluded',()=>assert.equal(A.context([{...active,status:'DATA_GAP'}],[key],'SELL',115,T+M).selected,null));
`+test.slice(testEnd);write('tests/auto-combined.test.cjs',test);
let browser=read('tests/auto-combined.browser.cjs');browser=replace(browser,"calendarTimezone:'UTC',values","calendarTimezone:'UTC',fetchedAtUtc:new Date(NOW).toISOString(),values",'browser real payload timestamp');write('tests/auto-combined.browser.cjs',browser);
let sop=read('SOP_AUTO_COMBINED.md');sop=sop.replace('v3.0.0','v3.1.0').replace(' -> key-level confluence ->',' ->');
sop=sop.replace('- SND: up to four base candles, body/range <=0.50; departure body/range >=0.65, range >=1.5 times average base range, close beyond base. RBR/DBR/DBD/RBD from incoming/outgoing candle direction. Zero-range/flat formations skipped.',
'- SNR/SND location rules now use assets/snd-auto-core.js: confirmed swing -> bounded wick/body zone (0.08–0.50 median of previous 20 source-bar ranges). SND additionally requires close displacement beyond the source candle and >=1.5 median ranges within three candles. No RBR/RBD/DBR/DBD pattern classifier. These are engineering definitions, not rules attributed to the PDF. Unexplained source-history gaps yield DATA_GAP, not FRESH.');
sop=sop.replace('Must fall within the zone plus 10% of its width;','Optional confluence, not a mandatory extra signal gate. Must fall within the zone plus 10% of its width;');
sop+='\n## v3.1.0 location reconciliation\nPreserves the current three-tab automatic host and existing Musang execution, not the earlier manual screens. FRESH is ranked before TESTED even when TESTED is nearer; only the current Astrology side is shown in the primary candidate list. BROKEN/DATA_GAP are excluded. Key levels cannot demote a standalone FRESH location to ineligible. Status is assessed from CLOSED native source bars, not tick-complete history: a touch within an unfinished HTF candle can be unobserved until it closes. Retest counts are a lower bound at source TF. Requests now run sequentially, use provider timestamps, and exclude expired cached frames from decisions. This is a research observation engine, not a broker-execution system or empirically validated strategy.\n';write('SOP_AUTO_COMBINED.md',sop);
console.log('Reconciled v3.1.0: current 3 tabs preserved, no base patterns, FRESH primary, no manual zones.');
