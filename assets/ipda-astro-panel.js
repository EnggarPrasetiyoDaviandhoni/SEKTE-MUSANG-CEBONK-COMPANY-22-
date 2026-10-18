(function(){
"use strict";
const host=document.createElement("section");host.id="ipdaAstroView";host.hidden=true;host.style.cssText="margin:18px auto;max-width:1180px;padding:18px;border:1px solid #34465b;border-radius:14px;background:#101a28;color:#e8eff8";
host.innerHTML='<h2>IPDA ICT 20 / 40 / 60 — XAUUSD</h2><p>Panel analisis teknikal. Arah dominan tetap berasal dari astrologi mingguan, bukan IPDA. Data OHLC D1 harus diisi dari sumber pasar yang valid.</p><label>Bias astrologi mingguan (pilih sesuai hasil panel astrologi) <select id="ipda-bias"><option value="WAIT">WAIT / CAMPURAN</option><option value="BUY">BUY ONLY</option><option value="SELL">SELL ONLY</option></select></label><p><label>OHLC D1 (CSV, minimal 60 candle selesai; urutan lama ke baru, header: date,open,high,low,close)</label></p><textarea id="ipda-csv" rows="5" style="width:100%;background:#0d1725;color:#fff;border:1px solid #34465b;border-radius:8px;padding:10px" placeholder="2026-07-01,3300,3340,3280,3320"></textarea><p><button id="ipda-calc" type="button">Hitung IPDA</button></p><div id="ipda-result" aria-live="polite">Belum ada data OHLC terverifikasi. Tidak menampilkan level rekaan.</div>';
const anchor=document.querySelector("main")||document.body;anchor.appendChild(host);
const output=host.querySelector("#ipda-result");
const feedUrl="data/ipda/yahoo-gold-d1.json";
async function refreshYahoo(){
 output.textContent="Memuat Yahoo Finance GC=F D1...";
 try {
  const response=await fetch(feedUrl+"?t="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw new Error("Feed belum tersedia (HTTP "+response.status+")");
  const feed=await response.json();
  if(feed.symbol!=="GC=F"||!Array.isArray(feed.candles))throw new Error("Format feed tidak valid");
  const completed=feed.candles.slice(0,-1);
  if(completed.length<60)throw new Error("Candle selesai kurang dari 60");
  const csv=completed.map(x=>[new Date(x.timestamp*1000).toISOString().slice(0,10),x.open,x.high,x.low,x.close].join(",")).join("\\n");
  host.querySelector("#ipda-csv").value=csv;
  host.querySelector("#ipda-calc").click();
  const note=document.createElement("p");
  note.textContent="Sumber otomatis: Yahoo Finance GC=F (futures, bukan spot XAUUSD). Candle terakhir diabaikan untuk menghindari bar berjalan.";
  output.prepend(note);
 }catch(e){output.textContent="Data otomatis belum tersedia: "+e.message;}
}
const refresh=document.createElement("button");refresh.type="button";refresh.textContent="Refresh Yahoo D1 otomatis";refresh.addEventListener("click",refreshYahoo);
host.querySelector("#ipda-calc").parentElement.after(refresh);

const tab=document.getElementById("tabIpdaAstro");
if(tab)tab.addEventListener("click",function(){
  if(window.CebonkViewRouter?.render)window.CebonkViewRouter.render("tabIpdaAstro",true);
  else {
    document.querySelectorAll("main > [id$='View'],main > #albiruniPanel").forEach(el=>{if(el!==host)el.hidden=true;});
    host.hidden=false;
  }
  host.hidden=false;
  host.scrollIntoView({behavior:"smooth",block:"start"});
  refreshYahoo();
});
host.querySelector("#ipda-calc").addEventListener("click",function(){
try{
const rows=host.querySelector("#ipda-csv").value.trim().split(/\r?\n/).filter(Boolean).filter(x=>!/^date\s*,/i.test(x)).map(line=>{
const p=line.split(",").map(x=>x.trim());if(p.length!==5)throw Error("Format wajib date,open,high,low,close");
const nums=p.slice(1).map(Number);if(!/^\d{4}-\d{2}-\d{2}$/.test(p[0])||nums.some(x=>!Number.isFinite(x)||x<=0)||nums[2]<Math.max(nums[0],nums[3],nums[1])||nums[3]>Math.min(nums[0],nums[1],nums[2]))throw Error("OHLC tidak valid: "+p[0]);
return {date:p[0],o:nums[0],h:nums[1],l:nums[2],c:nums[3]};
});
if(rows.length<60)throw Error("Perlu minimal 60 candle D1 yang sudah selesai.");
for(let i=1;i<rows.length;i++)if(rows[i].date<=rows[i-1].date)throw Error("Tanggal harus unik dan berurutan lama ke baru.");
const bias=host.querySelector("#ipda-bias").value;const last=rows[rows.length-1];let html='<p><strong>Astrology weekly: '+bias+'</strong> — harga penutupan terakhir: '+last.c.toFixed(2)+' ('+last.date+')</p><table style="width:100%;text-align:left"><thead><tr><th>Range</th><th>High</th><th>Low</th><th>Midpoint</th><th>Posisi</th><th>Target searah bias</th></tr></thead><tbody>';
for(const n of [20,40,60]){const x=rows.slice(-n);const hi=Math.max(...x.map(a=>a.h)),lo=Math.min(...x.map(a=>a.l)),mid=(hi+lo)/2;const target=bias==="BUY"?(hi>last.c?hi.toFixed(2):"High sudah terlampaui"):bias==="SELL"?(lo<last.c?lo.toFixed(2):"Low sudah terlampaui"):"WAIT";html+='<tr><td>IPDA '+n+'</td><td>'+hi.toFixed(2)+'</td><td>'+lo.toFixed(2)+'</td><td>'+mid.toFixed(2)+'</td><td>'+(last.c>=mid?"Premium":"Discount")+'</td><td>'+target+'</td></tr>';}
output.innerHTML=html+'</tbody></table><p>Level historis bukan sinyal entry. Sweep perlu konfirmasi candle dan konteks ICT. Bias mingguan dipilih manual agar tidak mengarang koneksi astrologi.</p>';
}catch(e){output.textContent="Data ditolak: "+e.message;}
});
if(location.hash==="#ipda-ict")refreshYahoo();
})();