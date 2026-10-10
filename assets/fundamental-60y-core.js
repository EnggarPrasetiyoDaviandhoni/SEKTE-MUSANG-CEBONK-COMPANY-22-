/* Source-grounded historical fundamentals and 60-year BaZi comparison.
 * Event chronology is curated, NOT a live macro feed or causal estimation.
 * Price changes use observed World Bank MONTHLY AVERAGES, not annual OHLC.
 */
(function(root){
'use strict';
const B=root.CebonkBazi, M=root.CebonkMetalHistory;
if(!B||!M)return;
const EVENTS=Object.freeze([
 {date:'1966-01-01',end:'1967-06-30',title:'Harga emas dan perak masih dibatasi kebijakan moneter',
  metals:['XAUUSD','XAGUSD'],drivers:['Kebijakan pemerintah','Penetapan harga'],
  explanation:'Emas masih berada dalam sistem patokan resmi dolar. Departemen Keuangan AS menjual perak sekitar $1,29 per ons untuk menjaga harga perak. Angka saat itu tidak mewakili perdagangan bebas seperti sekarang.',
  mechanism:'Harga resmi dan penjualan cadangan pemerintah membatasi kemampuan harga pasar merefleksikan perubahan permintaan.',
  evidence:'CATATAN SEJARAH',sources:[{name:'U.S. Mint — keputusan perak 1967',url:'https://www.usmint.gov/learn/history/historical-documents/letter-to-president-on-joint-commission-on-coinage'},{name:'Federal Reserve — akhir konvertibilitas emas',url:'https://www.federalreservehistory.org/essays/gold-convertibility-ends'}]},
 {date:'1967-07-01',end:'1967-12-31',title:'AS mengakhiri penjualan perak pada harga tetap',
  metals:['XAGUSD'],drivers:['Perubahan aturan','Pasokan pemerintah'],
  explanation:'Pemerintah AS menghentikan penjualan perak dengan harga tetap $1,29 per ons pada Juli 1967.',
  mechanism:'Penghilangan suplai resmi pada harga bersubsidi membuat harga semakin responsif terhadap penawaran dan permintaan.',
  evidence:'DOKUMEN RESMI',sources:[{name:'U.S. Mint — kebijakan penjualan 1967',url:'https://www.usmint.gov/learn/history/historical-documents/letter-to-president-on-joint-commission-on-coinage'}]},
 {date:'1971-08-15',end:'1971-08-15',title:'Penutupan jendela emas dolar AS',
  metals:['XAUUSD'],drivers:['Sistem moneter','Kebijakan AS'],
  explanation:'Presiden Nixon mengakhiri penukaran dolar AS dengan emas oleh otoritas asing pada 15 Agustus 1971.',
  mechanism:'Berakhirnya patokan resmi mengubah mekanisme pembentukan harga emas, sehingga perbandingan harga era 1960-an dengan era modern tidak setara.',
  evidence:'DOKUMEN RESMI',sources:[{name:'Federal Reserve History — Gold Window',url:'https://www.federalreservehistory.org/essays/gold-convertibility-ends'}]},
 {date:'1979-10-06',end:'1982-12-31',title:'Pengetatan moneter AS untuk memerangi inflasi',
  metals:['XAUUSD','XAGUSD'],drivers:['Inflasi','Suku bunga','Kebijakan The Fed'],
  explanation:'The Fed di bawah Paul Volcker mengetatkan kebijakan moneter dengan sangat agresif pada era 1979–1982.',
  mechanism:'Inflasi dan kekhawatiran terhadap daya beli dapat meningkatkan minat terhadap logam mulia; suku bunga sangat tinggi kemudian menaikkan biaya peluang memegang logam yang tidak menghasilkan bunga.',
  evidence:'DOKUMEN RESMI',sources:[{name:'Federal Reserve History — kebijakan Volcker',url:'https://www.federalreservehistory.org/essays/anti-inflation-measures'}]},
 {date:'1979-06-01',end:'1980-06-30',title:'Akumulasi perak Hunt bersaudara dan pembatasan posisi',
  metals:['XAGUSD'],drivers:['Spekulasi','Margin','Likuiditas'],
  explanation:'Pembelian perak secara masif pada 1979–1980 diikuti intervensi bursa: batas posisi, peningkatan margin, dan pembatasan transaksi likuidasi.',
  mechanism:'Konsentrasi posisi dapat mendorong kenaikan tajam; aturan margin dan likuidasi dapat mengubah pasar menjadi kejatuhan cepat.',
  evidence:'REGULATOR',sources:[{name:'CFTC — riwayat pasar perak 1979–1980',url:'https://www.cftc.gov/LawRegulation/FederalRegister/ProposedRules/2013-27200.html'}]},
 {date:'2008-09-01',end:'2009-06-30',title:'Krisis keuangan global dan tekanan likuiditas',
  metals:['XAUUSD','XAGUSD'],drivers:['Krisis kredit','Likuiditas','Aset aman'],
  explanation:'Krisis keuangan memicu kebutuhan likuiditas dan perubahan tajam selera risiko. Emas dapat mengalami tekanan jangka pendek ketika investor menjual aset untuk memperoleh kas.',
  mechanism:'Arus aset aman bisa mendukung emas, tetapi kebutuhan likuiditas dan aksi jual paksa dapat sementara menekan emas dan perak.',
  evidence:'TINJAUAN RISET',sources:[{name:'World Gold Council — krisis likuiditas dan emas',url:'https://www.gold.org/goldhub/research/portfolio-continuum-rethinking-gold-alternatives-investing'}]},
 {date:'2011-01-01',end:'2011-12-31',title:'Krisis utang Eropa, ketidakpastian dan investasi logam',
  metals:['XAUUSD','XAGUSD'],drivers:['Risiko sistemik','Investasi','Krisis utang'],
  explanation:'Krisis utang zona euro, penurunan peringkat kredit AS, dan ketidakpastian ekonomi meningkatkan permintaan emas sebagai pelindung nilai.',
  mechanism:'Permintaan investasi dapat mendorong kenaikan tetapi volatilitas dan perubahan posisi investor dapat memicu koreksi cepat. Bukti utama di sini menjelaskan emas, bukan sebab khusus perak.',
  evidence:'RISET PASAR',sources:[{name:'World Gold Council — permintaan emas Q3 2011',url:'https://www.gold.org/news-and-events/press-releases/global-gold-demand-6-third-quarter-2011'}]},
 {date:'2013-01-01',end:'2013-12-31',title:'Kenaikan imbal hasil obligasi dan tekanan emas',
  metals:['XAUUSD'],drivers:['Imbal hasil riil','Suku bunga','Investor'],
  explanation:'World Gold Council mencatat 2013 sebagai tahun ketika emas turun hampir 30% seiring kenaikan besar imbal hasil riil.',
  mechanism:'Ketika imbal hasil riil meningkat, aset berbunga menjadi lebih menarik daripada emas yang tidak memberi kupon. Ini bukan satu-satunya penentu harga.',
  evidence:'RISET PASAR',sources:[{name:'World Gold Council — analisis imbal hasil 2022/2013',url:'https://www.gold.org/goldhub/research/gold-market-commentary-december-2022'}]},
 {date:'2020-01-01',end:'2020-12-31',title:'Pandemi, suku bunga rendah dan lonjakan investasi emas',
  metals:['XAUUSD','XAGUSD'],drivers:['Pandemi','Pelonggaran moneter','Permintaan investasi'],
  explanation:'Pandemi Covid-19 memperbesar ketidakpastian. Pelonggaran moneter dan arus masuk ETF mendukung permintaan emas; efek pada perak juga bergantung pada aktivitas industri.',
  mechanism:'Turunnya biaya peluang dan naiknya permintaan aset aman mendukung emas, sedangkan perak menghadapi kombinasi permintaan investasi dan industri.',
  evidence:'RISET PASAR',sources:[{name:'World Gold Council — hasil pasar emas 2020',url:'https://www.gold.org/goldhub/research/gold-demand-trends/gold-demand-trends-full-year-2020'}]},
 {date:'2022-01-01',end:'2022-12-31',title:'Dolar dan suku bunga riil naik, pembelian bank sentral menahan tekanan',
  metals:['XAUUSD'],drivers:['Dolar AS','Suku bunga riil','Bank sentral'],
  explanation:'Pada 2022 dolar menguat dan imbal hasil riil naik kuat, tetapi pembelian emas bank sentral dan permintaan ritel menahan dampaknya.',
  mechanism:'Harga emas dipengaruhi beberapa faktor sekaligus; kenaikan bunga tidak menjamin emas turun sepanjang tahun.',
  evidence:'RISET PASAR',sources:[{name:'World Gold Council — kekuatan berlawanan 2022',url:'https://www.gold.org/goldhub/research/gold-market-commentary-december-2022'}]},
 {date:'2026-02-01',end:'2026-12-31',title:'Defisit pasokan perak berhadapan dengan penghematan penggunaan industri',
  metals:['XAGUSD'],drivers:['Defisit fisik','Permintaan industri','Substitusi'],
  explanation:'Silver Institute memproyeksikan defisit pasar perak 2026 dan pelemahan penggunaan perak di sektor panel surya karena penghematan bahan serta substitusi.',
  mechanism:'Defisit pasokan dapat mendukung harga, sedangkan penurunan permintaan industri menjadi hambatan. Proyeksi bukan hasil akhir tahun.',
  evidence:'PROYEKSI INDUSTRI',sources:[{name:'Silver Institute — outlook 2026',url:'https://silverinstitute.org/global-silver-investment-to-remain-strong-in-2026-against-the-backdrop-of-a-sixth-consecutive-annual-market-deficit/'}]},
 {date:'2026-09-01',end:'2026-09-30',title:'Emas terkoreksi ketika dolar dan imbal hasil menekan',
  metals:['XAUUSD'],drivers:['Dolar AS','Imbal hasil','Momentum'],
  explanation:'World Gold Council melaporkan pelemahan harga emas pada September 2026 dan menilai penguatan dolar serta kenaikan imbal hasil sebagai faktor penekan utama.',
  mechanism:'Naiknya opportunity cost dan dolar AS dapat mengurangi daya tarik emas. Arus dana dan momentum dapat memperkuat atau melawan tekanan.',
  evidence:'RISET PASAR',sources:[{name:'World Gold Council — komentar September 2026',url:'https://www.gold.org/goldhub/research/gold-market-commentary-september-2026'}]}
]);
const ISO=/^\d{4}-\d{2}-\d{2}$/;
function validDate(s){if(!ISO.test(s))return false;const d=new Date(s+'T00:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===s;}
function validateEvents(arr){
 if(!Array.isArray(arr))throw Error('Daftar peristiwa tidak tersedia.');
 for(const e of arr){
  if(!validDate(e.date)||!validDate(e.end)||e.date>e.end)throw Error('Rentang tanggal peristiwa tidak valid.');
  if(!Array.isArray(e.metals)||!e.metals.length||e.metals.some(x=>!['XAUUSD','XAGUSD'].includes(x)))throw Error('Instrumen peristiwa tidak valid.');
  if(!e.title||!e.explanation||!e.mechanism||!e.evidence||!Array.isArray(e.sources)||!e.sources.length||e.sources.some(x=>!/^https:\/\/(www\.)?(usmint\.gov|federalreservehistory\.org|cftc\.gov|gold\.org|silverinstitute\.org)\//.test(x.url)))throw Error('Sumber peristiwa tidak terverifikasi.');
 }
 return true;
}
validateEvents(EVENTS);
function priceYear(monthly,year){
 const rows=M.rows(monthly),inYear=rows.filter(x=>x[0].startsWith(String(year)+'-'));
 if(!inYear.length)return null;
 const avg=inYear.reduce((s,x)=>s+x[1],0)/inYear.length;
 const prior=rows.filter(x=>x[0].startsWith(String(year-1)+'-'));
 const matches=prior.filter(x=>inYear.some(v=>v[0].slice(5)===x[0].slice(5)));
 const complete=inYear.length===12,prevComplete=prior.length===12;
 const base=matches.length===inYear.length&&matches.length
  ?matches.reduce((s,x)=>s+x[1],0)/matches.length:null;
 const change=base?100*(avg/base-1):null;
 return {year,average:avg,months:inYear.length,complete,change,
  comparison:change===null?'TIDAK ADA PEMBANDING':complete&&prevComplete?'TAHUN PENUH':'BULAN SEPADAN (SEMENTARA)',
  label:!complete?'BELUM LENGKAP':change===null?'TANPA PEMBANDING':change>0?'NAIK':change<0?'TURUN':'DATAR'};
}
function eventsForYear(year,symbol,radius=1){
 if(!Number.isInteger(year)||year<1900||year>2100)throw Error('Tahun tidak valid.');
 if(!['XAUUSD','XAGUSD'].includes(symbol))throw Error('Instrumen tidak valid.');
 if(!Number.isInteger(radius)||radius<0||radius>3)throw Error('Rentang tahun tidak valid.');
 const first=String(year-radius)+'-01-01',last=String(year+radius)+'-12-31';
 return EVENTS.filter(e=>e.metals.includes(symbol)&&e.date<=last&&e.end>=first).map(e=>({...e,inSelectedYear:e.date<=String(year)+'-12-31'&&e.end>=String(year)+'-01-01'}));
}
function compare(input,year,symbol){
 if(!Number.isInteger(year)||year<1960||year>2050)throw Error('Tahun harus 1960–2050.');
 if(!['XAUUSD','XAGUSD'].includes(symbol))throw Error('Instrumen tidak valid.');
 const cycle=B.yearCycle(year);
 const older=year-60>=1960?year-60:null;
 return {symbol,year,cycle:{animal:cycle.animal,element:cycle.element},
   selected:priceYear(input,year),olderYear:older,
   previous:older===null?null:priceYear(input,older),
   events:eventsForYear(year,symbol,1),
   previousEvents:older===null?[]:eventsForYear(older,symbol,1),
   priceMethod:'Perubahan rata-rata bulanan tahun kalender dibanding bulan yang sama tahun sebelumnya.',
   warnings:['Peristiwa yang tercatat merupakan konteks fundamental, bukan atribusi sebab-akibat terukur.',
     'Shio dan elemen merupakan label siklus. Tidak membuktikan sebab atau probabilitas arah harga.',
     'Batas tahun BaZi sekitar awal Februari; data harga dikelompokkan menurut tahun kalender.',
     'Database peristiwa terkurasi dan tidak mengikuti berita langsung; harga World Bank diperbarui terpisah.']};
}
const api=Object.freeze({EVENTS,validateEvents,priceYear,eventsForYear,compare});
root.CebonkFundamental60=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
