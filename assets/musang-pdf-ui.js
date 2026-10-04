/* UI for reviewed PDF Entry Level 2, separate from Astrology and Astrology News. */
(function(root){
'use strict';
const K=root.CebonkMusangPDF,$=id=>document.getElementById(id);
const API='https://cebonk-xau-api.enggarprasetiyo330.workers.dev/xau';
const STORE='CEBONK_PDF_CONTEXT_V2';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number.isFinite(v)?v.toFixed(3):'—';
const wib=t=>Number.isFinite(t)?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(t)+' WIB':'—';
function mount(){
 if(!K||!$('astroView')||$('pdfVersion'))return;
 const nav=document.querySelector('.viewtabs'),wrap=document.querySelector('main.wrap');
 const views=['astroView','astroNewsView','pdfZonesView','technicalView','combinedView','combined2View'];
 const routes={tabAstro:['astroView','astrology'],tabTechnical:['technicalView','musang-pdf'],tabCombined:['combinedView','combined-1'],tabCombined2:['combined2View','combined-2'],tabZones:['pdfZonesView','snr-snd'],tabAstroNews:['astroNewsView','astrology-news']};
 const tab=(id,text)=>{let t=$(id);if(!t){t=document.createElement('button');t.id=id;t.type='button';t.className='viewtab';nav.appendChild(t);}t.textContent=text;return t;};
 tab('tabTechnical','FIBO MUSANG PDF');tab('tabCombined','COMBINED 1');tab('tabCombined2','COMBINED 2');tab('tabZones','SNR / SND');
 const section=id=>{let v=$(id);if(!v){v=document.createElement('section');v.id=id;wrap.querySelector('footer').before(v);}v.classList.add('pdf-view');v.hidden=true;return v;};
 const tech=section('technicalView'),zv=section('pdfZonesView'),c1=section('combinedView'),c2=section('combined2View');
 const smallNote='<div class="pdf-note"><b>Mode bantuan verifikasi PDF · Entry Level 2.</b> Kandidat pola bukan sinyal otomatis yang terbukti. Verifikasi struktur dulu. Astrology adalah lapisan eksperimen di luar PDF. Tidak ada order MT5/Telegram dari tab ini.</div>';
 tech.innerHTML=`<header class="pdf-hero"><span id="pdfVersion">MUSANG PDF / v${K.CFG.version}</span><h2>Struktur dulu. Retest baru.</h2><p>CB1 = konfirmasi · Zone IB = lokasi entry · tanpa MA20/50, RSI atau ATR.</p></header>${smallNote}
 <section class="panel"><div class="head"><h3>1. Data candle</h3><span id="pdfFeed" class="badge neutral">BELUM ADA DATA</span></div><div class="pdf-form">
 <label>TF setup / eksekusi<select id="pdfTF"><option>M1</option><option>M5</option><option>M15</option></select></label>
 <button id="pdfRefresh" type="button" class="primary">Ambil candle</button><label class="pdf-check"><input id="pdfAuto" type="checkbox" checked>Refresh 5 menit saat tab analisis dibuka</label>
 <p class="pdf-wide pdf-muted" id="pdfFeedText">Feed XAU/USD Twelve Data, bukan XAUUSDc NOZAX. Hanya candle tutup.</p>
 </div></section>
 <section class="panel"><div class="head"><h3>2. Kandidat & verifikasi struktur</h3><span class="badge transition">PERLU REVIEW</span></div><div class="pdf-form">
 <label class="pdf-wide">Kandidat 1-to-1 Initial Break<select id="pdfCandidate"><option value="">Ambil data dahulu</option></select></label>
 <p class="pdf-wide pdf-muted" id="pdfSummary">Detektor menggunakan pivot 2 candle dan pencarian body-break sebagai alat bantu, bukan angka baku PDF. Hidden Engulfing / Dominant yang ambigu tidak dipaksakan.</p>
 <label>Zone IB bawah<input id="pdfLow" type="number" step="any"></label><label>Zone IB atas<input id="pdfHigh" type="number" step="any"></label>
 <label>CB1 — level terpisah<input id="pdfCB" type="number" step="any"></label><label>SL di luar Zone IB<input id="pdfSL" type="number" step="any" placeholder="Isi level invalidasi"></label>
 <label>Fibo 0 — Dominant/IB<input id="pdfF0" type="number" step="any"></label><label>Fibo 100 — struktur break<input id="pdfF100" type="number" step="any"></label>
 <label class="pdf-wide pdf-check"><input id="pdfSign" type="checkbox">Saya cocokkan initial sign / IB dan ekstrem High–New High atau Low–New Low.</label>
 <label class="pdf-wide pdf-check"><input id="pdfZonesOK" type="checkbox">Zone IB adalah candle/zone yang dipatahkan; CB1 terpisah dan break valid.</label>
 <label class="pdf-wide pdf-check"><input id="pdfAnchors" type="checkbox">Anchor Fibo & SL sudah diverifikasi dari struktur, bukan sekadar usulan detektor.</label>
 <button class="primary" type="button" id="pdfVerify">Verifikasi & pantau retest BARU</button><button type="button" id="pdfClear">Batalkan setup</button>
 <p class="pdf-wide pdf-muted">Hal. 18–19 & 23: CB1 tidak boleh bertumpuk Zone IB. Hal. 33: anchor berdasarkan Dominant Break dan SNR/CB1 Break, body/close diutamakan. Retest lama tidak dijadikan entry baru saat verifikasi.</p>
 </div></section><div class="pdf-error" id="pdfError" role="alert" hidden></div>
 <section class="panel"><div class="head"><h3>Status Musang</h3><span id="pdfStage" class="badge neutral">WAIT</span></div><p class="pdf-pad" id="pdfReason">Belum ada setup.</p><div id="pdfPlan" class="pdf-grid"></div></section>
 <section class="panel"><div class="head"><h3>Audit candle & penandaan</h3><small id="pdfChartLabel">OHLC sebenarnya dari feed</small></div><div id="pdfChart" class="pdf-chart"><p class="pdf-pad">Belum ada data.</p></div><div class="scroller pdf-table"><table><thead><tr><th>WIB · candle tutup</th><th>Open</th><th>High</th><th>Low</th><th>Close</th></tr></thead><tbody id="pdfCandles"></tbody></table></div></section>
 <details><summary>Batas implementasi & sumber rule</summary><p>Yang diterapkan adalah alur Entry Level 2 (PDF hal. 23), bukan seluruh Entry Level 1–9. Kandidat mekanis wajib direview; tidak ada klaim deteksi identik dengan pembacaan workbook. Pemilihan pivot, batas pencarian 25 candle, penggunaan close untuk invalidasi zone, candle tutup dan masa berlaku tampilan adalah kebijakan teknis aplikasi, bukan aturan numerik dari PDF.</p><p>PDF mendefinisikan trend dari HH-HL/LH-LL (hal. 35), bukan MA. Kandidat reversal lokal tetap perlu break CB1 dan retest. TP1 1.618, TP2 2.618 dan Complete Cycle 4.23 (hal. 32); tidak menjamin tercapai dan RR bukan otomatis 1:2. Contoh penandaan harus diperiksa pengguna. Semua waktu input/feed UTC ditampilkan dalam WIB.</p></details>`;
 zv.innerHTML=`<header class="pdf-hero"><span>LOKASI / MULTI-TIMEFRAME</span><h2>SNR / SND</h2><p>MN1 · W1 · D1 · H4 · H1</p></header><div class="pdf-note"><b>Peta lokasi manual terverifikasi.</b> PDF ini tidak memberi algoritme RBR/DBR/DBD/RBD atau ambang fresh/nested-zone yang lengkap. Batas lokasi Anda tandai dari chart; aplikasi tidak mengarang zona. Ini lapisan tambahan COMBINED 2, bukan rule asli PDF.</div>
 <section class="panel"><div class="head"><h3>Tambah lokasi dari chart</h3></div><div class="pdf-form">
 <label>Timeframe<select id="pdfZTF">${K.CFG.context.map(x=>'<option>'+x+'</option>').join('')}</select></label>
 <label>Jenis<select id="pdfZKind"><option value="DEMAND">Demand</option><option value="SUPPLY">Supply</option><option value="SUPPORT">Support</option><option value="RESISTANCE">Resistance</option></select></label>
 <label>Harga bawah<input id="pdfZLow" type="number" step="any"></label><label>Harga atas<input id="pdfZHigh" type="number" step="any"></label>
 <label class="pdf-wide">Sumber & alasan zone<input id="pdfZNote" type="text" maxlength="180" placeholder="Contoh: chart XAU/USD H4, Zone B tanggal ..."></label>
 <label class="pdf-wide pdf-check"><input type="checkbox" id="pdfZVerified">Batas dan status zone sudah saya cocokkan ke chart yang dipakai.</label>
 <button class="primary" id="pdfZAdd" type="button">Simpan lokasi</button><button id="pdfZExport" type="button">Ekspor peta JSON</button>
 <label class="pdf-wide">Impor peta JSON sendiri<input type="file" id="pdfZImport" accept=".json,application/json"></label>
 <p class="pdf-wide pdf-muted">Peta tersimpan di browser ini, bukan otomatis ke website teman. Impor perlu dikonfirmasi ulang. Gunakan feed yang sama untuk batas harga; perbedaan broker tidak dikoreksi otomatis.</p>
 </div><p id="pdfZStatus" class="pdf-pad" role="status"></p></section><section class="panel"><div class="head"><h3>Daftar lokasi HTF</h3></div><div id="pdfZoneList"></div></section>`;
 function comboMarkup(i){return `<header class="pdf-hero"><span>COMBINED ${i} / MODE UJI</span><h2>${i===1?'Astrology × Musang PDF':'Astrology × Lokasi × Musang PDF'}</h2><p>${i===1?'Arah/jam + Entry Level 2':'COMBINED 1 ditambah konteks SNR/SND terverifikasi'}</p></header>${smallNote}<div class="pdf-bar"><button type="button" data-pdf-open="technicalView">Periksa Musang</button><button type="button" data-pdf-open="astroView">Periksa Astrology</button>${i===2?'<button type="button" data-pdf-open="pdfZonesView">Atur lokasi</button>':''}<button type="button" id="pdfC${i}Refresh">Refresh candle</button></div><section class="panel"><div class="pdf-decision"><span>KEPUTUSAN COMBINED ${i}</span><strong id="pdfC${i}Decision">WAIT</strong><p id="pdfC${i}Reason">Menunggu data.</p></div><div class="pdf-grid" id="pdfC${i}Grid"></div><p class="pdf-pad pdf-muted">ENTRY = catatan setup uji setelah candle retest tutup, bukan order broker atau jaminan harga fill. Berakhir di candle berikutnya / saat window Astro berubah. Riwayat tidak dibuka ulang.</p></section><section class="panel"><div class="head"><h3>Jejak keputusan</h3></div><div id="pdfC${i}Checks" class="pdf-checks"></div></section><div class="pdf-bar"><button id="pdfC${i}Copy" type="button">Salin keputusan</button><button id="pdfC${i}JSON" type="button">JSON audit</button></div><textarea id="pdfC${i}Text" class="pdf-copy" readonly hidden aria-label="Salin teks keputusan"></textarea>`;}
 c1.innerHTML=comboMarkup(1);c2.innerHTML=comboMarkup(2);
 let bars=[],candidates=[],preview=null,approved=null,zones=[],tf='M1',loading=false,lastRequest=0,lastSuccess=0,feedError='',result={stage:'NO_SETUP',reason:'Pilih kandidat dahulu.'},decision=null,formDirty=false,storeNotice='';
 try{const saved=JSON.parse(localStorage.getItem(STORE)||'[]');if(Array.isArray(saved))zones=saved.filter(z=>{try{K.validateZone(z);return true;}catch(e){return false;}}).slice(0,60);}catch(e){storeNotice='Penyimpanan lokal tidak tersedia / rusak.';}
 const inputs=['pdfLow','pdfHigh','pdfCB','pdfSL','pdfF0','pdfF100','pdfSign','pdfZonesOK','pdfAnchors'];
 const fresh=()=>!feedError&&lastSuccess>0&&bars.length>0&&Date.now()-lastSuccess<360000&&Date.now()-(bars[bars.length-1].ms+K.CFG.frames[tf]*60000)<(5+K.CFG.frames[tf])*60000;
 function save(){try{localStorage.setItem(STORE,JSON.stringify(zones));return true;}catch(e){$('pdfZStatus').textContent='Penyimpanan gagal; peta hanya bertahan di tab ini.';return false;}}
 function err(s){$('pdfError').hidden=!s;$('pdfError').textContent=s||'';}
 function card(label,value,sub=''){return '<div class="pdf-card"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></div>';}
 function badge(el,value){el.textContent=value;el.className='badge '+(value.includes('BUY')?'buy':value.includes('SELL')?'sell':'neutral');}
 function parseField(id){const s=$(id).value.trim();return s===''?null:Number(s);}
 function edited(){if(!preview)return null;return {...preview,low:parseField('pdfLow'),high:parseField('pdfHigh'),cb1:parseField('pdfCB'),sl:parseField('pdfSL'),fib0:parseField('pdfF0'),fib100:parseField('pdfF100'),verified:false,reviewedAt:0};}
 function fill(s){preview=s;formDirty=false;inputs.forEach(id=>{if($(id).type==='checkbox')$(id).checked=false;});const pairs={pdfLow:'low',pdfHigh:'high',pdfCB:'cb1',pdfSL:'sl',pdfF0:'fib0',pdfF100:'fib100'};Object.entries(pairs).forEach(([id,k])=>$(id).value=s&&s[k]!==null?s[k]:'');
  $('pdfSummary').textContent=s?`${s.direction} · pola ${s.direction==='SELL'?'High → New High':'Low → New Low'} · CB1 antar ekstrem. IB ${wib(s.ibMs)}; teramati sejak ${wib(s.knownAt)}. Usulan anchor/zone boleh dikoreksi sebelum verifikasi.`:'Belum ada kandidat 1-to-1 yang dapat ditinjau. Tidak dipaksa BUY/SELL.';render();draw();}
 function updateCandidateMenu(){
  const selected=preview&&preview.id;const options=[...candidates];if(preview&&!options.some(s=>s.id===preview.id))options.unshift(preview);
  $('pdfCandidate').innerHTML=options.length?options.map(s=>`<option value="${esc(s.id)}">${s.direction} · IB ${wib(s.ibMs)} · CB1 ${n(s.cb1)}</option>`).join(''):'<option value="">Tidak ada kandidat</option>';
  if(selected)$('pdfCandidate').value=selected;
 }
 async function refresh(){
  if(loading)return;if(Date.now()-lastRequest<65000){$('pdfFeedText').textContent='Jeda permintaan 65 detik untuk kuota API. Tidak mengambil ulang.';return;}
  loading=true;lastRequest=Date.now();lastSuccess=0;feedError='Memuat data';render();err('');$('pdfRefresh').disabled=true;
  const control=new AbortController(),timer=setTimeout(()=>control.abort(),15000);
  const map={M1:'1min',M5:'5min',M15:'15min'};
  try{
   const res=await fetch(API+'?interval='+map[tf]+'&outputsize=500',{signal:control.signal,cache:'no-store'}),data=await res.json();
   if(!res.ok||!data.ok)throw new Error(String(data.error||'HTTP '+res.status));
   const c=K.candles(data,tf,Date.now());if(c.length<30)throw new Error('Candle tutup kurang saka 30.');
   bars=c;lastSuccess=Date.now();feedError='';candidates=K.detect(bars,tf);updateCandidateMenu();
   if(!preview&&!approved)fill(candidates[0]||null);
   $('pdfFeedText').textContent=`${bars.length} candle tutup ${tf} · terakhir ${wib(bars[bars.length-1].ms)} · diambil ${wib(lastSuccess)}. Refresh 5 menit dapat melewatkan sinyal M1; bukan tick live.`;
  }catch(e){bars=[];lastSuccess=0;feedError=e.name==='AbortError'?'API timeout':e.message;err('Feed gagal: '+feedError+'. Semua keputusan WAIT.');$('pdfFeedText').textContent='Tidak menggunakan data lama sebagai sinyal baru.';}
  finally{clearTimeout(timer);loading=false;$('pdfRefresh').disabled=false;render();draw();}
 }
 function astroStale(){const a=root.CEBONK_ASTRO_STATE;return !a||($('results')&&$('results').dataset.stale==='true')||($('dateInput')&&a.iso!==$('dateInput').value)||($('modelEnabled')&&!$('modelEnabled').checked)||($('tzMode')&&a.mode!==$('tzMode').value)||($('startMinute')&&a.start!==Number($('startMinute').value));}
 function render(){
  const s=approved||(!formDirty?preview:edited());result=K.evaluate(s,bars,Date.now());decision=K.combine(result,root.CEBONK_ASTRO_STATE,zones,Date.now(),fresh(),astroStale());
  badge($('pdfFeed'),fresh()?'OHLC TERBARU':loading?'MEMUAT':feedError?'ERROR':'STALE / BELUM ADA');badge($('pdfStage'),result.stage);$('pdfReason').textContent=result.reason;
  const t=result.targets||[];const showRisk=fresh()&&s;
  $('pdfPlan').innerHTML=card('Arah setup',s?s.direction:'—',approved?'DIVERIFIKASI':'BELUM DIVERIFIKASI')+card('CB1 break',wib(result.breakMs),'CB1 bukan entry')+card('Zone IB',s?n(s.low)+' – '+n(s.high):'—','Retest sesudah break')+card('Retest teramati',wib(result.eventMs),'Waktu tutup candle, bukan tick fill')+card('Harga retest acuan',showRisk?n(result.entry):'—','Bukan harga executable')+card('SL acuan',showRisk?n(result.sl):'—','Bukan ATR otomatis')+t.map(x=>card(x.ratio===4.23?'COMPLETE CYCLE':x.ratio===1.618?'TP1':'TP2',showRisk?n(x.price):'—',x.rr===null?'RR belum valid':'RR 1:'+x.rr.toFixed(2))).join('');
  for(const i of [1,2]){
   const d=i===1?decision.one:decision.two,valid=d.startsWith('ENTRY');$('pdfC'+i+'Decision').textContent=d;$('pdfC'+i+'Decision').className=valid?(d.includes('BUY')?'buy':'sell'):'neutral';$('pdfC'+i+'Reason').textContent=i===1?decision.reason1:decision.reason2;
   const win=decision.window,ctx=decision.context.aligned;
   $('pdfC'+i+'Grid').innerHTML=card('Astrology',decision.astro,win?wib(win.start)+' → '+wib(win.end):'Tanggal/window harus sama')+card('Musang PDF',result.stage.replace(/_/g,' '),s?s.direction+' · '+s.tf:'Belum ada setup')+(i===2?card('Lokasi HTF',ctx.length?ctx.map(z=>z.tf+' '+z.kind).join(' / '):'BELUM SELARAS','Minimal satu lokasi; konflik lawan = WAIT'):'')+card('Entry acuan',valid?n(result.entry):'—',valid?wib(result.eventMs):'Belum ada entry baru')+card('SL',valid?n(result.sl):'—','Di luar Zone IB')+[1.618,2.618,4.23].map((ratio,j)=>{const q=t.find(x=>x.ratio===ratio);return card(j===2?'Complete Cycle 4.23':'TP'+(j+1)+' · '+ratio,valid&&q?n(q.price):'—',valid&&q&&Number.isFinite(q.rr)?'RR 1:'+q.rr.toFixed(2):'Tidak dipaksa RR tertentu');}).join('');
   const checks=[['Data baru & sehat',fresh()],['Struktur/anchor direview',!!approved],['CB1 break pada candle tutup',!!result.breakMs],['Retest BARU valid',result.stage==='RETEST_VALID'],['Astrology cocok pada event & sekarang',decision.one.startsWith('ENTRY')]];if(i===2)checks.push(['Lokasi HTF searah tanpa konflik',decision.two.startsWith('ENTRY')]);
   $('pdfC'+i+'Checks').innerHTML=checks.map(([label,pass])=>'<p class="'+(pass?'buy':'neutral')+'">'+(pass?'OK — ':'WAIT — ')+esc(label)+'</p>').join('');
  }
  root.CEBONK_PDF_STATE={result,decision,source:'PDF_LEVEL_2_REVIEWED',executionEnabled:false};
 }
 function draw(){
  $('pdfCandles').innerHTML=bars.slice(-20).reverse().map(c=>'<tr><td>'+wib(c.ms)+'</td>'+['open','high','low','close'].map(k=>'<td>'+n(c[k])+'</td>').join('')+'</tr>').join('');
  if(!bars.length){$('pdfChart').innerHTML='<p class="pdf-pad">Tidak ada data OHLC valid.</p>';return;}
  const data=bars.slice(-75),s=approved||preview,prices=data.flatMap(c=>[c.low,c.high]);if(s)prices.push(s.low,s.high,s.cb1);
  let min=Math.min(...prices),max=Math.max(...prices);if(max===min)max=min+1;const span=max-min;min-=span*.05;max+=span*.05;
  const W=780,H=330,left=12,right=105,bottom=35,scale=(H-bottom-25)/(max-min),y=p=>H-bottom-(p-min)*scale,dx=(W-left-right)/data.length,x=i=>left+(i+.5)*dx;
  let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Chart candle feed dengan Zone IB dan CB1"><rect width="100%" height="100%" fill="#0a1421"/>';
  for(let k=0;k<5;k++){const p=min+(max-min)*(k+.5)/5;svg+=`<line x1="0" x2="${W-right}" y1="${y(p)}" y2="${y(p)}" stroke="#25354a"/><text x="${W-right+8}" y="${y(p)+4}" fill="#a5b4c9" font-size="12">${n(p)}</text>`;}
  if(s){svg+=`<rect x="0" y="${y(s.high)}" width="${W-right}" height="${Math.max(1,y(s.low)-y(s.high))}" fill="#c89b3e" opacity=".20"/><line x1="0" x2="${W-right}" y1="${y(s.cb1)}" y2="${y(s.cb1)}" stroke="#83cdd5" stroke-dasharray="5 4"/>`;}
  data.forEach((c,i)=>{const color=c.close>=c.open?'#83dfb3':'#ff9b9b';svg+=`<line x1="${x(i)}" x2="${x(i)}" y1="${y(c.high)}" y2="${y(c.low)}" stroke="${color}"/><rect x="${x(i)-dx*.3}" y="${y(Math.max(c.open,c.close))}" width="${dx*.6}" height="${Math.max(1,Math.abs(c.close-c.open)*scale)}" fill="${color}"/>`;});
  svg+=`<text x="12" y="322" fill="#a5b4c9" font-size="12">${esc(wib(data[0].ms))}</text><text x="420" y="322" fill="#a5b4c9" font-size="12">${esc(wib(data[data.length-1].ms))}</text></svg>`;
  $('pdfChart').innerHTML=svg;$('pdfChartLabel').textContent=s?'Area emas = Zone IB · garis putus = CB1 · kandidat perlu review':'75 candle tutup';
 }
 function zoneList(){
  $('pdfZoneList').innerHTML=zones.length?zones.map(z=>`<div class="pdf-zone"><div><b>${esc(z.tf)} · ${esc(z.kind)}</b><p>${n(z.low)} – ${n(z.high)}</p><small>${esc(z.note)} · ${wib(z.createdAt)}</small></div><button type="button" data-zone="${esc(z.id)}">${z.active?'Aktif — nonaktifkan':'Nonaktif — aktifkan'}</button><button type="button" data-delete="${esc(z.id)}">Hapus</button></div>`).join(''):'<p class="pdf-pad">Peta kosong. COMBINED 2 tetap WAIT sampai ada lokasi terverifikasi.</p>';
 }
 function download(data,name){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
 function audit(i){return {version:K.CFG.version,mode:'COMBINED_'+i,exportedAt:new Date().toISOString(),experimentalAstrology:true,executionEnabled:false,pdfScope:'Entry Level 2, halaman 23',feed:'Twelve Data XAU/USD, candle tutup',feedOK:fresh(),decision:i===1?decision.one:decision.two,reason:i===1?decision.reason1:decision.reason2,result,locations:i===2?zones:[]};}
 function open(id){
  views.forEach(v=>{if($(v))$(v).hidden=v!==id;});Object.keys(routes).forEach(k=>{if($(k))$(k).classList.toggle('active',routes[k][0]===id);});
  const route=Object.values(routes).find(x=>x[0]===id);if(route)try{history.replaceState(null,'','#'+route[1]);}catch(e){}
  if(['technicalView','combinedView','combined2View'].includes(id)&&!loading&&(!lastSuccess||Date.now()-lastSuccess>=300000))refresh();render();
 }
 nav.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&routes[b.id])open(routes[b.id][0]);});
 wrap.addEventListener('click',e=>{const b=e.target.closest('[data-pdf-open]');if(b)open(b.dataset.pdfOpen);});
 $('pdfRefresh').addEventListener('click',refresh);[1,2].forEach(i=>$('pdfC'+i+'Refresh').addEventListener('click',refresh));
 $('pdfTF').addEventListener('change',()=>{tf=$('pdfTF').value;bars=[];approved=null;preview=null;lastSuccess=0;feedError='TF diganti';candidates=[];updateCandidateMenu();fill(null);refresh();});
 $('pdfCandidate').addEventListener('change',()=>{approved=null;fill(candidates.find(s=>s.id===$('pdfCandidate').value)||null);});
 inputs.forEach(id=>$(id).addEventListener('input',()=>{approved=null;formDirty=true;render();}));
 $('pdfVerify').addEventListener('click',()=>{try{
  if(!fresh())throw new Error('Ambil data terbaru dahulu.');if(!preview)throw new Error('Tidak ada kandidat terpilih.');
  if(!['pdfSign','pdfZonesOK','pdfAnchors'].every(id=>$(id).checked))throw new Error('Lengkapi tiga verifikasi struktur PDF.');
  const s=K.validate({...edited(),verified:true,reviewedAt:Date.now()});const r=K.evaluate(s,bars,Date.now());
  if(['INVALID_SETUP','INVALID_ZONE','MISSING_HISTORY','WAIT_CB1_BREAK'].includes(r.stage))throw new Error(r.reason);
  approved=Object.freeze(s);preview=s;formDirty=false;err('');render();draw();
 }catch(e){approved=null;err(e.message);render();}});
 $('pdfClear').addEventListener('click',()=>{approved=null;preview=null;fill(null);err('');});
 $('pdfZAdd').addEventListener('click',()=>{try{
  if(!$('pdfZVerified').checked)throw new Error('Konfirmasi chart sumber dahulu.');if(zones.length>=60)throw new Error('Maksimal 60 lokasi.');
  const z=K.validateZone({id:'Z'+Date.now()+Math.random().toString(16).slice(2,7),tf:$('pdfZTF').value,kind:$('pdfZKind').value,low:parseField('pdfZLow'),high:parseField('pdfZHigh'),note:$('pdfZNote').value.trim(),createdAt:Date.now(),verified:true,active:true});
  zones.push(z);if(save())$('pdfZStatus').textContent='Lokasi disimpan di browser ini.';$('pdfZVerified').checked=false;zoneList();render();
 }catch(e){$('pdfZStatus').textContent=e.message;}});
 $('pdfZoneList').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.delete){zones=zones.filter(z=>z.id!==b.dataset.delete);}else if(b.dataset.zone){const z=zones.find(z=>z.id===b.dataset.zone);z.active=!z.active;if(z.active)z.createdAt=Date.now();}save();zoneList();render();});
 $('pdfZExport').addEventListener('click',()=>download({schema:STORE,zones},'CEBONK_SNR_SND_MANUAL.json'));
 $('pdfZImport').addEventListener('change',async()=>{try{const f=$('pdfZImport').files[0];if(!f)return;if(f.size>64000)throw new Error('Peta terlalu besar.');const j=JSON.parse(await f.text());if(j.schema!==STORE||!Array.isArray(j.zones)||j.zones.length>60)throw new Error('Format peta tidak valid.');const copy=j.zones.map((z,i)=>K.validateZone({...z,id:'I'+Date.now()+i,active:false,createdAt:Date.now(),note:String(z.note).slice(0,180)}));zones=copy;save();zoneList();render();$('pdfZStatus').textContent='Peta diimpor NONAKTIF. Periksa ke chart lalu aktifkan per zone.';}catch(e){$('pdfZStatus').textContent=e.message;}});
 for(const i of [1,2]){
  $('pdfC'+i+'JSON').addEventListener('click',()=>{render();download(audit(i),'CEBONK_COMBINED_'+i+'_AUDIT.json');});
  $('pdfC'+i+'Copy').addEventListener('click',async()=>{render();const a=audit(i),txt='SEKTE MUSANG — CEBONK COMPANY 22\nCOMBINED '+i+' / UJI\n'+a.decision+'\n'+a.reason+'\nAstrology: '+decision.astro+'\nMusang: '+result.stage+'\nTidak ada order otomatis. Belum tervalidasi. OJO FULLMARGIN COK.';try{await navigator.clipboard.writeText(txt);}catch(e){const ta=$('pdfC'+i+'Text');ta.hidden=false;ta.value=txt;ta.select();}});
 }
 root.addEventListener('cebonk-astro-update',render);
 for(const id of ['dateInput','modelEnabled','tzMode','startMinute'])if($(id))$(id).addEventListener('input',render);
 setInterval(()=>{render();},5000);
 setInterval(()=>{const visible=['technicalView','combinedView','combined2View'].some(id=>!$(id).hidden);if(visible&&$('pdfAuto').checked&&!document.hidden)refresh();},300000);
 zoneList();$('pdfZStatus').textContent=storeNotice;render();
 const hash=location.hash.slice(1),entry=Object.values(routes).find(x=>x[1]===hash);if(entry&&entry[0]!=='astroNewsView')open(entry[0]);
 root.addEventListener('hashchange',()=>{const q=Object.values(routes).find(x=>x[1]===location.hash.slice(1));if(q)open(q[0]);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
