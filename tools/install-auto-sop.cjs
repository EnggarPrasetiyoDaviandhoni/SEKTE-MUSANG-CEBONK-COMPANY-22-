'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const file=process.argv[2]||'index.html',original=fs.readFileSync(file,'utf8');let html=original;
const scripts=s=>[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
const astro=s=>scripts(s).filter(x=>x.includes('root.CebonkCore=Core;')||x.includes('async function loadLibrary()'));
assert.equal(astro(html).length,2,'Original astronomy core/UI required');
if(!html.includes('id="autoCombinedLoader"')){
 assert.ok(html.includes('id="pdfModeLoader"'),'Expected reviewed PDF predecessor');
 html=html.replace(/\s*<button\b[^>]*id="(?:tabTechnical|tabCombined2|tabZones)"[^>]*>[\s\S]*?<\/button>/g,'');
 html=html.replace(/\s*<section id="(?:technicalView|combined2View|pdfZonesView)" hidden><\/section>/g,'');
 html=html.replace(/\s*<script\b[^>]*src="assets\/musang-pdf-(?:core|ui)\.js[^\"]*"[^>]*><\/script>/g,'');
 html=html.replace(/\s*<link\b[^>]*id="pdfModeStyle"[^>]*>/g,'');
 assert.ok(!html.includes('pdfModeLoader')&&!html.includes('tabTechnical'),'Old manual UI removed, not hidden');
 html=html.replace('</head>','<link rel="stylesheet" href="assets/auto-combined.css?v=3.0.0">\n</head>');
 const news=/<script src="assets\/astro-news-v1\.js[^\"]*"><\/script>/;
 assert.ok(news.test(html),'News loader must remain');
 html=html.replace(news,m=>'<script src="assets/auto-combined-core.js?v=3.0.0"></script>\n<script id="autoCombinedLoader" src="assets/auto-combined-ui.js?v=3.0.0"></script>\n'+m);
}
assert.deepEqual(astro(html),astro(original),'Astrology core/UI byte-identical');
assert.ok(html.includes('assets/astro-news-v1.js'),'News unchanged');
assert.ok(html.includes('id="tabCombined"')&&!html.includes('id="tabTechnical"'));
assert.equal((html.match(/id="autoCombinedLoader"/g)||[]).length,1);
for(const script of scripts(html))if(script.trim())new Function(script);
fs.writeFileSync(file,html);
const worker=fs.readFileSync('worker/auto-sop-v3.mjs','utf8');assert.ok(worker.includes('AUTO_SOP_API_V3'));
fs.writeFileSync('cloudflare-worker.js',worker); // Repo update only; DOES NOT deploy Cloudflare.
console.log('INSTALLED: 3 tabs. COMBINED 1 AUTO, no manual price input. Cloudflare deployment separate.');
