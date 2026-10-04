'use strict';
if(require('node:fs').readFileSync('index.html','utf8').includes('id="combinedSplitLoader"')){console.log('COMBINED SPLIT PROTECTED: legacy install must not replace either mode.');process.exit(0);}

const fs=require('node:fs'),assert=require('node:assert/strict');
const path=process.argv[2]||'index.html',original=fs.readFileSync(path,'utf8');
let html=original;
const scripts=s=>[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const beforeCore=scripts(html).find(x=>x.includes('root.CebonkCore=Core;'));
const beforeAstroUI=scripts(html).find(x=>x.includes('async function loadLibrary()'));
assert.ok(beforeCore&&beforeAstroUI,'Existing astronomy modules required');
if(!html.includes('id="pdfModeLoader"')){
 const start=html.indexOf('<section id="technicalView"'),end=html.indexOf('<footer>',start);
 assert.ok(start>0&&end>start,'Exact old technical section required');
 html=html.slice(0,start)+'<section id="technicalView" hidden></section>\n<section id="combinedView" hidden></section>\n<section id="combined2View" hidden></section>\n<section id="pdfZonesView" hidden></section>\n'+html.slice(end);
 let removed=0;
 html=html.replace(/<script>([\s\S]*?)<\/script>/g,(all,s)=>{if(s.includes("const API_BASE='https://cebonk-xau-api.enggarprasetiyo330.workers.dev/xau';")){removed++;return '';}return all;});
 assert.equal(removed,1,'Must remove precisely one legacy CB1-touch + MA engine');
 html=html.replace('id="tabTechnical" type="button">FIBO MUSANG</button>','id="tabTechnical" type="button">FIBO MUSANG PDF</button>');
 html=html.replace('id="tabCombined" type="button">COMBINED</button>','id="tabCombined" type="button">COMBINED 1</button>');
 html=html.replace('</head>','<link id="pdfModeStyle" rel="stylesheet" href="assets/musang-pdf.css?v=2.0.0">\n</head>');
 const loader='<script src="assets/musang-pdf-core.js?v=2.0.0"></script>\n<script id="pdfModeLoader" src="assets/musang-pdf-ui.js?v=2.0.0"></script>\n';
 const news=/<script src="assets\/astro-news-v1\.js[^\"]*"><\/script>/;
 assert.ok(news.test(html),'Existing News loader must be retained');
 html=html.replace(news,m=>loader+m);
}
assert.equal(scripts(html).find(x=>x.includes('root.CebonkCore=Core;')),beforeCore,'Astronomy calculation untouched');
assert.equal(scripts(html).find(x=>x.includes('async function loadLibrary()')),beforeAstroUI,'Astronomy UI untouched');
assert.ok(!html.includes('ENTRY_HOLD_BARS'),'Legacy entry engine disabled');
assert.ok(html.includes('assets/astro-news-v1.js'),'News retained');
assert.equal((html.match(/id="pdfModeLoader"/g)||[]).length,1);
for(const script of scripts(html)){if(script.trim())new Function(script);}
fs.writeFileSync(path,html);console.log('INSTALLED: Combined1/2 reviewed Level2; legacy technical removed. Astro/News retained.');
