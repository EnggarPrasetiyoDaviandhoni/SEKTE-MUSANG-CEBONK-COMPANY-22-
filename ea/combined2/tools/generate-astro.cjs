'use strict';
// Usage: node tools/generate-astro.cjs 2026-01-01 2027-12-31
// Run from ea/combined2; npm install first. No prices / assumed BUY or SELL fallback.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),PIN='35ce78b437c26ca28577e835676c5655113579cf',MODEL='CEBONK_C2_WEB_V1_35ce78b4';
function date(s){assert.match(s,/^\d{4}-\d{2}-\d{2}$/);const t=Date.parse(s+'T00:00:00Z');assert.equal(new Date(t).toISOString().slice(0,10),s);return t;}
function astroCore(){
 const vendor=path.join(ROOT,'vendor','astro-core.cjs');
 if(!fs.existsSync(vendor)){
  const {execFileSync}=require('node:child_process');
  const html=execFileSync('git',['show',PIN+':index.html'],{encoding:'utf8',maxBuffer:2000000});
  const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).find(x=>x.includes('root.CebonkCore=Core;'));
  assert.ok(source,'Pinned CebonkCore not found; do not substitute a different model');
  fs.mkdirSync(path.dirname(vendor),{recursive:true});fs.writeFileSync(vendor,source);
  fs.writeFileSync(path.join(ROOT,'vendor','provenance.json'),JSON.stringify({repository:'EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-',commit:PIN,model:MODEL,astroCoreSHA256:crypto.createHash('sha256').update(source).digest('hex')},null,2)+'\n');
 }
 const info=JSON.parse(fs.readFileSync(path.join(ROOT,'vendor','provenance.json'),'utf8'));
 assert.equal(info.commit,PIN);assert.equal(info.model,MODEL);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(vendor)).digest('hex'),info.astroCoreSHA256);
 return require(vendor);
}
async function main(){
 const from=process.argv[2]||'2026-01-01',to=process.argv[3]||'2027-12-31',first=date(from),last=date(to);assert.ok(last>=first&&last-first<=10*366*86400000);
 const C=astroCore(),Astronomy=require('astronomy-engine'),months=new Map(),all=[],header='start_epoch,end_epoch,direction,window_id,model\n';
 let days=0;const started=Date.now();
 for(let t=first;t<=last;t+=86400000){
  const iso=new Date(t).toISOString().slice(0,10),rows=await C.scan(C.createEngine(Astronomy),iso,360,true);
  assert.equal(rows.length,216,'06:00–24:00 WIB must have 216 five-minute slots');
  const groups=C.segments(rows),lines=[];let expected=Date.parse(iso+'T06:00:00+07:00');
  for(const g of groups){
   assert.equal(g.start,expected);assert.ok(g.end>g.start&&g.start%300000===0&&g.end%300000===0);
   assert.ok(['BUY','SELL','NEUTRAL','TRANSITION'].includes(g.state));
   const a=g.start/1000,b=g.end/1000;lines.push([a,b,g.state,'C2-'+a+'-'+g.state,MODEL].join(','));expected=g.end;
  }
  assert.equal(expected,Date.parse(iso+'T00:00:00+07:00')+86400000);
  const month=iso.slice(0,7);if(!months.has(month))months.set(month,[]);months.get(month).push(...lines);all.push(...lines);days++;
  if(days%15===0)console.log('Astrology generated',iso,'days',days,'seconds',Math.round((Date.now()-started)/1000));
 }
 fs.mkdirSync(path.join(ROOT,'data'),{recursive:true});for(const [month,lines] of months)fs.writeFileSync(path.join(ROOT,'data',month+'.csv'),header+lines.join('\n')+'\n');
 fs.writeFileSync(path.join(ROOT,'data','CEBONK_C2_ASTRO.csv'),header+all.join('\n')+'\n');
 fs.writeFileSync(path.join(ROOT,'data','coverage.json'),JSON.stringify({model:MODEL,fromWIB:from,toWIB:to,dailyWindowWIB:'06:00–24:00',outsideWindow:'WAIT',gridMinutes:5,days,windows:all.length,generatedUTC:new Date().toISOString(),experimental:true,sourceCommit:PIN,software:'astronomy-engine@2.1.19',priceValidation:false},null,2)+'\n');
 console.log('GENERATED_REAL_EPHEMERIS',JSON.stringify({from,to,days,windows:all.length,seconds:Math.round((Date.now()-started)/1000)}));
}
main().catch(e=>{console.error(e);process.exit(1);});
