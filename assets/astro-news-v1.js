/* CEBONK ASTROLOGY NEWS 1.0.0
 * News anchors time; CebonkCore alone supplies the inherited experimental bias.
 * No prices, actual/forecast data, trading API, new directional weights or secrets.
 * Calendar snapshot: primary BLS / BEA / Federal Reserve pages checked 2026-10-04.
 */
(function(root){
'use strict';
const MIN=60000,STEP=5*MIN,VERSION='1.0.0',CHECKED='2026-10-04';
const SOURCES=Object.freeze({
 BLS:'https://www.bls.gov/schedule/2026/10_sched.htm',
 BEA:'https://www.bea.gov/news/schedule',
 FED:'https://www.federalreserve.gov/newsevents/2026-october.htm'
});
const CALENDAR=Object.freeze([
 ['nfp-20261002','NFP / Employment Situation','2026-10-02T12:30:00Z','BLS'],
 ['minutes-20261007','FOMC Minutes','2026-10-07T18:00:00Z','FED'],
 ['cpi-20261014','CPI','2026-10-14T12:30:00Z','BLS'],
 ['ppi-20261015','PPI','2026-10-15T12:30:00Z','BLS'],
 ['fomc-20261028','FOMC Statement','2026-10-28T18:00:00Z','FED'],
 ['fed-pc-20261028','FOMC Press Conference','2026-10-28T18:30:00Z','FED'],
 ['gdp-20261029','GDP / Advance Q3','2026-10-29T12:30:00Z','BEA'],
 ['pce-20261029','PCE / Personal Income and Outlays','2026-10-29T12:30:00Z','BEA']
].map(([id,name,utc,agency])=>Object.freeze({id,name,ms:Date.parse(utc),agency,source:SOURCES[agency]})));
const assert=(x,m)=>{if(!x)throw new Error(m);};
const isSide=x=>x==='BUY'||x==='SELL';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=ms=>new Date(ms).toISOString();
function localParts(ms,offset){return new Date(ms+offset*MIN).toISOString().slice(0,16);}
function inputUTC(date,time,zone,C){
 assert(/^\d{4}-\d{2}-\d{2}$/.test(date)&&/^\d{2}:\d{2}$/.test(time),'Isi tanggal lan jam release sing valid.');
 const [hh,mm]=time.split(':').map(Number);
 assert(hh<24&&mm<60,'Jam kudu 00:00–23:59.');
 const base=C.Time.parseDate(date)+(hh*60+mm)*MIN;
 assert(['WIB','UTC','LUXOR','NEW_YORK'].includes(zone),'Zona waktu ora dikenal.');
 if(zone==='WIB')return base-420*MIN;
 if(zone==='UTC')return base;
 const offsets=zone==='LUXOR'?[120,180]:[-300,-240];
 const wanted=date+'T'+time;
 const matches=offsets.map(o=>base-o*MIN).filter(ms=>{
  if(zone==='LUXOR')return localParts(ms,C.Time.luxorOffset(ms,'AUTO'))===wanted;
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
  const x=Object.fromEntries(p.map(v=>[v.type,v.value]));
  return `${x.year}-${x.month}-${x.day}T${x.hour}:${x.minute}`===wanted;
 });
 assert(matches.length===1,'Jam iki ambigu utawa ora ana amarga pergantian DST. Isi wektu UTC utawa WIB.');
 return matches[0];
}
function validate(c){
 assert(c&&Number.isFinite(c.releaseMs),'Waktu news ora valid.');
 assert(typeof c.name==='string'&&c.name.trim().length>0&&c.name.length<=80,'Jeneng news kudu 1–80 karakter.');
 for(const [key,lo,hi] of [['pre',5,120],['post',30,360],['blockBefore',0,60],['blockAfter',5,60],['entrySpan',5,60],['minWindow',5,60]])
  assert(Number.isInteger(c[key])&&c[key]>=lo&&c[key]<=hi&&c[key]%5===0,`${key}: isi kelipatan 5, ${lo}–${hi} menit.`);
 assert(c.blockBefore<=c.pre&&c.blockAfter<c.post,'Buffer kudu ana ing jendela analisis.');
 assert(c.confirmed===true,'Centang konfirmasi jadwal sawise cocogke karo sumber resmi.');
 return c;
}
function ranges(c,other){
 return [{ms:c.releaseMs,name:c.name,id:c.id},...(c.otherRisk?other.filter(e=>e.id!==c.id):[])].map(e=>({
  start:e.ms-c.blockBefore*MIN,end:e.ms+c.blockAfter*MIN,name:e.name,id:e.id
 }));
}
function blocked(ms,blocks){return blocks.filter(b=>ms<b.end&&ms+STEP>b.start);}
function build(samples,c,other=[]){
 validate(c);
 const start=Math.floor((c.releaseMs-c.pre*MIN)/STEP)*STEP;
 const end=Math.ceil((c.releaseMs+c.post*MIN)/STEP)*STEP;
 assert(samples.length===(end-start)/STEP,'Slot astronomi durung lengkap. Ora nerbitake plan.');
 samples.forEach((s,i)=>assert(s.ms===start+i*STEP&&Number.isFinite(s.score)&&['BUY','SELL','NEUTRAL','TRANSITION'].includes(s.state),'Data astronomi utawa urutan slot ora valid.'));
 const blocks=ranges(c,other),runs=[];
 let run=null;
 const rows=samples.map(s=>{
  const risk=blocked(s.ms,blocks);
  const can=s.ms>=c.releaseMs&&!risk.length&&isSide(s.state);
  if(can){
   if(!run||run.dir!==s.state||run.end!==s.ms){run={dir:s.state,start:s.ms,end:s.ms+STEP,samples:[]};runs.push(run);}
   run.end=s.ms+STEP;run.samples.push(s);
  }else run=null;
  return {...s,risk:risk.map(b=>b.name),policy:'WAIT',window:null};
 });
 const long=runs.filter(r=>r.end-r.start>=c.minWindow*MIN);
 const rank=['BUY','SELL'].map(dir=>({dir,max:Math.max(0,...long.filter(r=>r.dir===dir).map(r=>r.end-r.start)),total:long.filter(r=>r.dir===dir).reduce((v,r)=>v+r.end-r.start,0)}));
 rank.sort((a,b)=>b.max-a.max||b.total-a.total);
 const focus=rank[0].max===0||(rank[0].max===rank[1].max&&rank[0].total===rank[1].total)?'NEUTRAL':rank[0].dir;
 const windows=long.filter(r=>r.dir===focus).map((r,i)=>{
  const entryEnd=Math.min(r.end,r.start+c.entrySpan*MIN);
  const peak=r.samples.filter(s=>s.ms<entryEnd).reduce((a,b)=>Math.abs(b.score)>Math.abs(a.score)?b:a);
  return {id:`${c.id}-W${i+1}`,number:i+1,dir:r.dir,start:r.start,entryEnd,lastNewSlot:entryEnd-STEP,end:r.end,peak:peak.ms,duration:(r.end-r.start)/MIN};
 });
 for(const r of rows){
  if(r.risk.length)r.policy='NO ENTRY · BUFFER';
  else if(r.ms<c.releaseMs)r.policy='PRE-NEWS · OBSERVASI';
  else if(!isSide(r.state))r.policy=r.state==='TRANSITION'?'TRANSISI · WAIT':'NEUTRAL · WAIT';
  else if(focus==='NEUTRAL')r.policy='WAIT · TANPA FOKUS';
  else if(r.state!==focus)r.policy=r.state+' SKIP';
  else{
   const w=windows.find(w=>r.ms>=w.start&&r.ms<w.end);
   if(!w)r.policy='WAIT · WINDOW PENDEK';
   else{r.window=w.number;r.policy=r.ms<w.entryEnd?'KANDIDAT '+w.dir:'CONTINUATION · NO NEW ENTRY';}
  }
 }
 const timeline=[];
 for(const r of rows){
  let g=timeline[timeline.length-1];
  const key=r.state+'|'+r.policy+'|'+r.risk.join(',')+'|'+r.window;
  if(!g||g.key!==key){g={key,state:r.state,policy:r.policy,risk:r.risk,start:r.ms,end:r.ms+STEP,peak:r,window:r.window};timeline.push(g);}
  g.end=r.ms+STEP;if(Math.abs(r.score)>Math.abs(g.peak.score))g.peak=r;
 }
 return {version:VERSION,experimental:true,executionEnabled:false,event:{...c},calendarChecked:CHECKED,start,end,focus,windows,timeline,rows,blocks:blocks.filter(b=>b.start<end&&b.end>start)};
}
async function calculate(C,A,c,other=[],progress=()=>{},cancel=()=>false){
 validate(c);const engine=C.createEngine(A);
 const start=Math.floor((c.releaseMs-c.pre*MIN)/STEP)*STEP,end=Math.ceil((c.releaseMs+c.post*MIN)/STEP)*STEP;
 C.Time.parseDate(C.Time.dateISO(C.Time.wib(start)));C.Time.parseDate(C.Time.dateISO(C.Time.wib(end)));
 const total=(end-start)/STEP,rows=[];
 let prior=C.analyse(engine.get(start-2*STEP),engine.get(start-STEP),engine.get(start),true).score;
 for(let i=0;i<total;i++){
  assert(!cancel(),'Perhitungan dibatalkan.');
  const t=start+i*STEP,s=C.analyse(engine.get(t-STEP),engine.get(t),engine.get(t+STEP),true);
  s.state=C.classify(s.score,prior);prior=s.score;rows.push(s);
  if(i%6===0){progress(Math.round((i+1)/total*100));await new Promise(r=>setTimeout(r,0));}
 }
 progress(100);return build(rows,c,other);
}
const API=Object.freeze({VERSION,CHECKED,CALENDAR,SOURCES,STEP,inputUTC,validate,build,calculate});
root.CebonkNews=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(typeof document==='undefined')return;
function mount(){
 const C=root.CebonkCore,nav=document.querySelector('.viewtabs'),wrap=document.querySelector('main.wrap');
 if(!C||!nav||!wrap||document.getElementById('astroNewsView'))return;
 const css=document.createElement('style');css.textContent=`
 .viewtabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.viewtab{min-width:0;font-size:13px;padding:10px 6px}#tabAstroNews.active{background:#282315;color:var(--accent)}
 #astroNewsView{--news-line:#354255}#astroNewsView .an-hero{padding:22px;background:linear-gradient(120deg,#28151c,#142136);border:1px solid #775e32;border-radius:12px;margin-bottom:14px}
 #astroNewsView h2{margin:5px 0;font-size:28px;letter-spacing:-.6px}#astroNewsView .an-hero p{margin:4px 0;color:var(--muted);font-size:13px}
 #astroNewsView .an-tag{font-size:10px;letter-spacing:1px;color:var(--accent);font-weight:750}
 #astroNewsView .an-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:16px}#astroNewsView .an-wide{grid-column:1/-1}
 #astroNewsView label{display:block;font-size:12px;color:var(--muted)}#astroNewsView input,#astroNewsView select{width:100%;margin-top:5px;min-width:0}#astroNewsView input[type=checkbox]{width:18px;margin:0;flex-shrink:0}
 #astroNewsView .an-check{display:flex;gap:10px;align-items:center}#astroNewsView .an-note{font-size:12px;line-height:1.6;color:var(--muted);margin:0}
 #astroNewsView .an-buttonrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}#astroNewsView .an-buttonrow button{flex:1;min-width:140px}
 #astroNewsView .an-settings{padding:0 14px}#astroNewsView .an-settings .an-form{padding:6px 0 14px}
 #astroNewsView .an-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}#astroNewsView .an-box{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:13px;min-width:0}
 #astroNewsView .an-box small{display:block;color:var(--muted);font-size:11px}#astroNewsView .an-box strong{display:block;font-size:22px;line-height:1.35;margin:6px 0;overflow-wrap:anywhere}
 #astroNewsView .an-box p{font-size:12px;margin:5px 0}#astroNewsView .an-window{padding:13px 16px;border-bottom:1px solid var(--line)}#astroNewsView .an-window h3{margin:0 0 5px;font-size:16px}#astroNewsView .an-window p{font-size:12px;margin:4px 0;color:var(--muted)}
 #astroNewsView .an-segment{display:grid;grid-template-columns:165px 1fr;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);border-left:3px solid var(--muted)}
 #astroNewsView .an-segment[data-side=SELL]{border-left-color:var(--sell)}#astroNewsView .an-segment[data-side=BUY]{border-left-color:var(--buy)}#astroNewsView .an-segment[data-block=true]{border-left-color:var(--accent);background:#252014}
 #astroNewsView .an-segment small{font-size:11px;color:var(--muted);display:block}#astroNewsView .an-segment b{font-size:13px}#astroNewsView .an-raw{max-height:360px}
 #astroNewsView .an-disclaimer{border:1px solid #6e5730;background:#251f15;border-radius:10px;padding:12px 14px;font-size:12px;color:#ebd5ad;margin-bottom:14px}
 #astroNewsView .an-error{padding:12px;background:#351c26;border:1px solid #853f50;color:#ffbac1;border-radius:9px;margin-bottom:12px}#astroNewsView #anCopyText{width:100%;height:180px;background:var(--panel);color:var(--text)}
 #astroNewsView #anResult[data-stale=true]{opacity:.4}#astroNewsView .an-progress{color:var(--cyan);min-height:28px;margin:10px 0;font-size:12px}
 @media(max-width:720px){.viewtabs{grid-template-columns:repeat(2,minmax(0,1fr))}.viewtab{font-size:12px}#astroNewsView .an-form{grid-template-columns:1fr 1fr;padding:12px}#astroNewsView .an-meta{grid-template-columns:1fr 1fr}#astroNewsView .an-meta .an-box:first-child{grid-column:1/-1}#astroNewsView .an-hero{padding:16px}#astroNewsView h2{font-size:25px}#astroNewsView .an-segment{grid-template-columns:1fr}#astroNewsView .an-box strong{font-size:21px}}
 @media print{body.an-print{background:white!important;color:black!important}body.an-print main.wrap{width:100%;padding:0}body.an-print .viewtabs,body.an-print header.hero,body.an-print footer,body.an-print main.wrap>div,body.an-print main.wrap>section:not(#astroNewsView),body.an-print #astroNewsView .an-formpanel,body.an-print #astroNewsView .an-export,body.an-print #astroNewsView details,body.an-print #astroNewsView .an-progress{display:none!important}body.an-print #astroNewsView,body.an-print #astroNewsView *{color:black!important;background:white!important;box-shadow:none!important}body.an-print .an-box,body.an-print .an-window,body.an-print .an-segment{break-inside:avoid}body.an-print #astroNewsView .an-meta{display:block}}
 `;document.head.appendChild(css);
 const tab=document.createElement('button');tab.id='tabAstroNews';tab.className='viewtab';tab.type='button';tab.textContent='ASTROLOGY NEWS';nav.appendChild(tab);
 const view=document.createElement('section');view.id='astroNewsView';view.hidden=true;
 view.innerHTML=`
 <div class="an-hero"><div class="an-tag">SEKTE MUSANG · CEBONK COMPANY 22</div><h2>ASTROLOGY NEWS</h2><p>News = patokan wektu. Astrology = bias model. Siji arah · grid 5 menit · Luxor → WIB.</p><span class="badge transition">EXPERIMENTAL / v${VERSION}</span></div>
 <div class="an-disclaimer"><b>Iki planner riset, dudu sinyal teruji.</b> Jam news saka kalender; BUY/SELL saka model eksperimen sing wis ana. Buffer release iku aturan risiko sing sampeyan setel, <b>dudu ramalan spike utawa whipsaw</b>. Ora ana order EA utawa Telegram otomatis.</div>
 <section class="panel an-formpanel"><div class="head"><h3>1. Pilih news & wektu release</h3><small>Kalender snapshot · ${CHECKED}</small></div>
 <div class="an-form">
 <label class="an-wide">Preset resmi / manual<select id="anPreset"></select></label>
 <p class="an-note an-wide" id="anSource"></p>
 <label class="an-wide">Jeneng news<input id="anName" type="text" maxlength="80" placeholder="NFP / CPI / FOMC / pidato Fed"></label>
 <label>Tanggal release<input id="anDate" type="date" min="2020-01-01" max="2040-12-31"></label>
 <label>Jam release<input id="anTime" type="time" step="60"></label>
 <label>Zona jam input<select id="anZone"><option value="WIB">WIB · UTC+7</option><option value="NEW_YORK">New York · DST otomatis</option><option value="LUXOR">Luxor · DST otomatis</option><option value="UTC">UTC</option></select></label>
 <p id="anConverted" class="an-wide an-note"></p>
 <label class="an-check an-wide"><input id="anConfirmed" type="checkbox"><span>Jadwal & jam wis tak cocokke karo sumber resmi. Preset iki dudu feed live.</span></label>
 <div class="an-wide"><details class="an-settings"><summary>2. Atur jendela & zona no-entry</summary><div class="an-form">
 <label>Scan sadurunge (menit)<input id="anPre" type="number" value="30" min="5" max="120" step="5"></label>
 <label>Scan sawise (menit)<input id="anPost" type="number" value="120" min="30" max="360" step="5"></label>
 <label>Block sadurunge (menit)<input id="anBlockBefore" type="number" value="5" min="0" max="60" step="5"></label>
 <label>Block sawise (menit)<input id="anBlockAfter" type="number" value="5" min="5" max="60" step="5"></label>
 <label>Entry awal saben window (menit)<input id="anEntrySpan" type="number" value="10" min="5" max="60" step="5"></label>
 <label>Minimal window searah (menit)<input id="anMinWindow" type="number" value="15" min="5" max="60" step="5"></label>
 <label class="an-check an-wide"><input id="anOtherRisk" type="checkbox" checked><span>Blokir uga event liyane ing snapshot, kalebu press conference.</span></label>
 <p class="an-note an-wide">Mung news sing ana ing daftar iki sing dideteksi. Jadwal dadakan, pidato liyane lan owah-owahan jadwal kudu sampeyan lebokke / verifikasi dhewe.</p>
 </div></details></div>
 <div class="an-buttonrow an-wide"><button id="anRun" class="primary" type="button">HITUNG ASTROLOGY NEWS</button><button id="anExample" type="button">Tes NFP 02 Okt 2026</button></div>
 </div></section>
 <div id="anError" class="an-error" role="alert" hidden></div><div id="anStatus" class="an-progress" role="status" aria-live="polite">Pilih event, konfirmasi jam, banjur hitung.</div>
 <div id="anResult" hidden data-stale="false">
 <div class="an-meta" id="anSummary"></div>
 <section class="panel"><div class="head"><h3>Window entry model · fokus 1 arah</h3><span id="anNow" class="badge neutral">RENCANA</span></div><div id="anWindows"></div><div class="footnote">Awal/akhir iku batas grid model. Akhir rentang scan dudu bukti bias wis rampung. Ora ana harga entry, SL utawa TP rekaan.</div></section>
 <section class="panel"><div class="head"><h3>Timeline news → astrology</h3><small>Seluruh rentang, tanpa slot dibuwang</small></div><div id="anTimeline"></div></section>
 <section class="panel an-export"><div class="head"><h3>Bagikno plan riset</h3></div><div class="an-form"><div class="an-wide an-buttonrow"><button id="anCopy" type="button">Salin plan</button><button id="anCSV" type="button">CSV 5 menit</button><button id="anJSON" type="button">JSON audit</button><button id="anPrint" type="button">Cetak / Simpan PDF</button></div><textarea id="anCopyText" class="an-wide" readonly hidden aria-label="Teks plan untuk disalin"></textarea></div></section>
 <details><summary>Audit kabeh slot 5 menit</summary><div class="scroller an-raw"><table><thead><tr><th>WIB</th><th>Luxor sipil</th><th>Bias model</th><th>Kebijakan window</th><th>Skor, bukan peluang</th><th>Aspek dominan</th></tr></thead><tbody id="anRows"></tbody></table></div></details>
 <details><summary>Metode, sumber, lan watesan</summary><p>Posisi lan skor nganggo CebonkCore sing padha karo tab Astrology; ora ana bobot arah anyar. ASC/MC tetep data lokasi, ora nambah skor BUY/SELL. Ora nggunakake actual/forecast news, MA, RSI utawa data harga.</p><p>Fokus dipilih saka window post-news paling dawa sing lolos buffer lan durasi minimum. Yen imbang, total durasi dadi pembeda; yen isih imbang utawa ora ana window valid, NEUTRAL. Saben window menehi kandidat entry ing menit awal, banjur continuation tanpa entry anyar. Kesempatan kapindho mung metu yen ana window kapindho sing nyata ing hasil model.</p><p>"Shock" mung alasan buffer risiko, ora kedadeyan pasar sing diprediksi. Korelasi lan akurasi arah/timing model durung dibuktekake. Plan iki ora njamin TP lan ora nyegah kabeh slippage. SL/TP lan lot ora dihitung ing tab iki.</p><p>Kalender dibekukake ${CHECKED}; ora ana sinkron otomatis. Sumber: <a href="${SOURCES.BLS}" target="_blank" rel="noopener noreferrer">BLS</a>, <a href="${SOURCES.BEA}" target="_blank" rel="noopener noreferrer">BEA</a>, <a href="${SOURCES.FED}" target="_blank" rel="noopener noreferrer">Federal Reserve</a>. Kahanan lan wektu rilis bisa owah.</p></details>
 </div>`;
 const footer=wrap.querySelector('footer');if(footer)footer.before(view);else wrap.appendChild(view);
 const $=id=>document.getElementById(id);
 let plan=null,busy=false,job=0;
 const fields=['anPreset','anName','anDate','anTime','anZone','anConfirmed','anPre','anPost','anBlockBefore','anBlockAfter','anEntrySpan','anMinWindow','anOtherRisk'];
 const outButtons=['anCopy','anCSV','anJSON','anPrint'];
 const hm=ms=>C.Time.hm(C.Time.wib(ms));
 const full=ms=>C.Time.dateISO(C.Time.wib(ms))+' '+hm(ms)+' WIB';
 const lux=ms=>{const p=C.Time.luxor(ms,'AUTO');return C.Time.dateISO(p)+' '+C.Time.hm(p)+' '+C.Time.offsetLabel(p.offset);};
 const shortRange=(s,e)=>hm(s)+' – '+hm(e)+(C.Time.dateISO(C.Time.wib(s))!==C.Time.dateISO(C.Time.wib(e))?' (+1 hari)':'')+' WIB';
 const num=x=>Number.isFinite(x)?x.toFixed(3):'—';
 const badge=x=>`<span class="badge ${x==='BUY'?'buy':x==='SELL'?'sell':'neutral'}">${esc(x)}</span>`;
 const status=s=>{$('anStatus').textContent=s;};
 const error=s=>{$('anError').hidden=!s;$('anError').textContent=s||'';};
 function stale(){plan=null;job++;$('anResult').dataset.stale='true';outButtons.forEach(id=>$(id).disabled=true);$('anNow').textContent='HITUNG ULANG';error('');status('Setelan ganti. Hitung maneh supaya plan ora lawas.');converted();}
 function scheduleEdit(){if($('anPreset').value!=='manual')$('anPreset').value='manual';$('anConfirmed').checked=false;sourceInfo();stale();}
 function sourceInfo(){
  const event=CALENDAR.find(e=>e.id===$('anPreset').value);
  $('anSource').innerHTML=event?`Snapshot ${CHECKED} · ${esc(event.agency)} · <a href="${event.source}" target="_blank" rel="noopener noreferrer">Cek jadwal resmi</a>. Ora dijamin tetep, dudu kalender live.`:'MANUAL: pilih tanggal lan jam dhewe saka kalender resmi. FOMC statement lan press conference iku event kapisah.';
 }
 function converted(){try{const ms=inputUTC($('anDate').value,$('anTime').value,$('anZone').value,C);$('anConverted').textContent=full(ms)+' ↔ '+lux(ms)+' (Luxor)';}catch(e){$('anConverted').textContent='—';}}
 $('anPreset').innerHTML='<option value="manual">Manual · NFP / CPI / PCE / GDP / FOMC / Fed / liyane</option>'+CALENDAR.map(e=>`<option value="${e.id}">${esc(e.name)} · ${full(e.ms)}</option>`).join('');
 function setPreset(id){
  const e=CALENDAR.find(e=>e.id===id);$('anPreset').value=e?e.id:'manual';
  if(e){$('anName').value=e.name;const p=localParts(e.ms,420);$('anDate').value=p.slice(0,10);$('anTime').value=p.slice(11,16);$('anZone').value='WIB';}
  $('anConfirmed').checked=false;sourceInfo();stale();
 }
 $('anPreset').addEventListener('change',()=>setPreset($('anPreset').value));
 ['anName','anDate','anTime','anZone'].forEach(id=>$(id).addEventListener('input',scheduleEdit));
 fields.filter(id=>!['anPreset','anName','anDate','anTime','anZone'].includes(id)).forEach(id=>$(id).addEventListener('change',stale));
 $('anExample').addEventListener('click',()=>setPreset('nfp-20261002'));
 function config(){
  const releaseMs=inputUTC($('anDate').value,$('anTime').value,$('anZone').value,C),e=CALENDAR.find(e=>e.id===$('anPreset').value);
  const c={id:e?e.id:'manual-'+releaseMs,name:$('anName').value.trim(),releaseMs,source:e?e.source:null,sourceType:e?'OFFICIAL_SNAPSHOT':'USER_INPUT',confirmed:$('anConfirmed').checked,otherRisk:$('anOtherRisk').checked,inputZone:$('anZone').value};
  for(const [k,id] of [['pre','anPre'],['post','anPost'],['blockBefore','anBlockBefore'],['blockAfter','anBlockAfter'],['entrySpan','anEntrySpan'],['minWindow','anMinWindow']])c[k]=Number($(id).value);
  return validate(c);
 }
 async function astronomy(){
  if(root.Astronomy)return root.Astronomy;
  // The host starts its own loader on page open. Let it finish before a retry.
  for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,250));if(root.Astronomy)return root.Astronomy;}
  for(const host of ['https://cdn.jsdelivr.net/npm/','https://unpkg.com/']){
   try{await new Promise((resolve,reject)=>{const s=document.createElement('script'),timer=setTimeout(()=>{s.remove();reject(new Error('Library timeout'));},9000);s.src=host+'astronomy-engine@2.1.19/astronomy.browser.min.js';s.onload=()=>{clearTimeout(timer);resolve();};s.onerror=()=>{clearTimeout(timer);s.remove();reject(new Error('Library gagal'));};document.head.appendChild(s);});
    if(root.Astronomy)return root.Astronomy;
   }catch(e){/* Try only the pinned secondary source; never substitute fake data. */}
  }
  throw new Error('Astronomy Engine gagal dimuat. Aktifke internet banjur coba maneh. Ora ana sinyal pengganti.');
 }
 function reason(s){const a=s.active.filter(a=>!a.local).sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact))[0];return a?`${a.id1}–${a.id2} ${a.name} · orb ${num(a.orb)}° · ${a.phase}`:'Ora ana aspek antarplanet ing orb.';}
 function box(label,val,detail,side=''){return `<div class="an-box"><small>${esc(label)}</small><strong class="${side==='BUY'?'buy':side==='SELL'?'sell':''}">${esc(val)}</strong><p>${esc(detail)}</p></div>`;}
 function render(){
  const p=plan,e=p.event,first=p.windows[0],second=p.windows[1];
  $('anResult').hidden=false;$('anResult').dataset.stale='false';
  $('anSummary').innerHTML=box('NEWS / TANGGAL WIB',e.name,full(e.releaseMs)+' · Luxor '+lux(e.releaseMs))+box('FOKUS MODEL',p.focus==='NEUTRAL'?'NEUTRAL':p.focus+' ONLY',p.focus==='NEUTRAL'?'Ora ana fokus tunggal valid.':(p.focus==='SELL'?'BUY':'SELL')+' SKIP · eksperimen',p.focus)+box('RELEASE WIB',hm(e.releaseMs),lux(e.releaseMs)+' Luxor')+box('NO ENTRY RELEASE',shortRange(e.releaseMs-e.blockBefore*MIN,e.releaseMs+e.blockAfter*MIN),'Aturan risiko, dudu prediksi whipsaw.')+box('KANDIDAT ENTRY AWAL',first?hm(first.start):'—',first?shortRange(first.start,first.entryEnd):'Ora dipeksa metu sinyal.')+box('INTI MODEL / SLOT PUNCAK',first?hm(first.peak):'—','Skor absolut paling gedhe ing entry window, dudu peluang menang.')+box('BATAS ENTRY ANYAR',first?hm(first.entryEnd):'—',first?'Batas eksklusif; slot terakhir '+hm(first.lastNewSlot)+' WIB.':'—')+box('KESEMPATAN KAPINDHO',second?shortRange(second.start,second.entryEnd):'ORA ANA',second?'Mung yen window kapindho model muncul.':'Ora digawe-gawe saka jam release.')+box('AKHIR ANALISIS',full(p.end),'Window ing batas scan ora ateges bias otomatis expired.');
  $('anWindows').innerHTML=p.windows.length?p.windows.map(w=>`<div class="an-window"><h3>${badge(w.dir)} WINDOW ${w.number} · ${shortRange(w.start,w.end)}</h3><p><b>Kandidat entry:</b> ${shortRange(w.start,w.entryEnd)} · inti ${hm(w.peak)} WIB</p><p><b>Batas entry anyar:</b> sadurunge ${hm(w.entryEnd)} WIB. Continuation: ${shortRange(w.entryEnd,w.end)}.</p><p>Luxor: ${lux(w.start)} → ${lux(w.end)} · durasi ${w.duration} menit.</p></div>`).join(''):'<div class="empty">WAIT. Ora ana window arah tunggal sing lolos aturan. Sinyal ora dipeksa.</div>';
  $('anTimeline').innerHTML=p.timeline.map(g=>`<div class="an-segment" data-side="${g.state}" data-block="${g.risk.length>0}"><div><b>${shortRange(g.start,g.end)}</b><small>Luxor ${lux(g.start)}<br>→ ${lux(g.end)}</small></div><div><b>${esc(g.policy)}</b><small>Bias model ${esc(g.state)} · ${esc(reason(g.peak))}</small>${g.risk.length?'<small>Buffer: '+esc(g.risk.join(' + '))+'</small>':''}</div></div>`).join('');
  $('anRows').innerHTML=p.rows.map(r=>`<tr><td>${full(r.ms)}</td><td>${lux(r.ms)}</td><td>${badge(r.state)}</td><td>${esc(r.policy)}</td><td>${num(r.score)}</td><td>${esc(reason(r))}</td></tr>`).join('');
  outButtons.forEach(id=>$(id).disabled=false);clock();
 }
 function clock(){if(!plan)return;const now=Date.now();$('anNow').textContent=now<plan.start?'RENCANA':now>=plan.end?'HISTORIS / SELESAI':'PERIODE EVENT';}
 $('anRun').addEventListener('click',async()=>{
  if(busy)return;error('');let c;
  try{c=config();}catch(e){error(e.message);return;}
  plan=null;$('anResult').hidden=true;$('anCopyText').hidden=true;const thisJob=++job;busy=true;
  fields.concat(['anRun','anExample']).forEach(id=>$(id).disabled=true);outButtons.forEach(id=>$(id).disabled=true);status('Ngitung data astronomi asli kanggo event iki…');
  try{const A=await astronomy();const p=await calculate(C,A,c,CALENDAR,n=>status('Scanner 5 menit · '+n+'%'),()=>job!==thisJob);
   if(job!==thisJob)return;plan=p;render();status(`${p.rows.length} slot rampung · arah saka model lawas · kalender snapshot ${CHECKED}, dudu feed live.`);
  }catch(e){plan=null;$('anResult').hidden=true;error(e.message);status('Gagal. Ora nerbitake sinyal.');}
  finally{busy=false;fields.concat(['anRun','anExample']).forEach(id=>$(id).disabled=false);}
 });
 function summary(){
  assert(plan,'Hitung plan dhisik.');const p=plan,e=p.event;
  return ['SEKTE MUSANG — CEBONK COMPANY 22','ASTROLOGY NEWS / EKSPERIMEN, BELUM TERUJI',e.name+' | '+full(e.releaseMs),'Luxor: '+lux(e.releaseMs),'Fokus model: '+(p.focus==='NEUTRAL'?'NEUTRAL':p.focus+' ONLY'),'Sumber: '+(e.source||'Input manual, dikonfirmasi pengguna'),'Snapshot kalender: '+CHECKED+' (bukan live)','',...p.timeline.map(g=>full(g.start)+' → '+full(g.end)+' | '+g.policy+' | astro '+g.state),'',...p.windows.map(w=>'WINDOW '+w.number+': '+w.dir+' | kandidat '+full(w.start)+' → '+full(w.entryEnd)+' (akhir eksklusif), inti model '+full(w.peak)), '', 'Buffer = aturan risiko, bukan prediksi spike. Tidak ada instruksi order otomatis.', 'Arah/timing belum divalidasi; skor bukan probabilitas. OJO FULLMARGIN COK.'].join('\n');
 }
 function download(text,ext,type){assert(plan,'Hitung dhisik.');const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download='CEBONK_ASTROLOGY_NEWS_'+C.Time.dateISO(C.Time.wib(plan.event.releaseMs))+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);}
 $('anCopy').addEventListener('click',async()=>{if(!plan)return;const text=summary();try{await navigator.clipboard.writeText(text);status('Plan tersalin lengkap karo label eksperimen.');}catch(e){$('anCopyText').hidden=false;$('anCopyText').value=text;$('anCopyText').select();status('Salin saka kotak teks ing ngisor.');}});
 $('anJSON').addEventListener('click',()=>{if(plan)download(JSON.stringify(plan,null,2),'json','application/json');});
 $('anCSV').addEventListener('click',()=>{if(!plan)return;const q=x=>'"'+String(x).replace(/"/g,'""')+'"';const rows=[['utc','WIB','Luxor','model_bias_UNVALIDATED','policy','score_NOT_probability','aspect','risk_events'],...plan.rows.map(r=>[iso(r.ms),full(r.ms),lux(r.ms),r.state,r.policy,r.score,reason(r),r.risk.join(' | ')])];download('\uFEFF'+rows.map(r=>r.map(q).join(',')).join('\r\n'),'csv','text/csv;charset=utf-8');});
 $('anPrint').addEventListener('click',()=>{if(!plan)return;document.body.classList.add('an-print');root.print();});
 root.addEventListener('afterprint',()=>document.body.classList.remove('an-print'));
 function showNews(){for(const id of ['astroView','technicalView','combinedView']){const el=$(id);if(el)el.hidden=true;}nav.querySelectorAll('.viewtab').forEach(b=>b.classList.toggle('active',b===tab));view.hidden=false;try{history.replaceState(null,'','#astrology-news');}catch(e){}clock();}
 tab.addEventListener('click',showNews);
 ['tabAstro','tabTechnical','tabCombined'].forEach(id=>{const el=$(id);if(el)el.addEventListener('click',()=>{view.hidden=true;tab.classList.remove('active');if(location.hash==='#astrology-news'){try{history.replaceState(null,'',location.href.split('#')[0]);}catch(e){}}});});
 const next=CALENDAR.find(e=>e.ms>=Date.now())||CALENDAR[0];setPreset(next.id);status('Pilih event, konfirmasi jam, banjur hitung.');
 if(location.hash==='#astrology-news')showNews();setInterval(clock,1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window!=='undefined'?window:globalThis);
