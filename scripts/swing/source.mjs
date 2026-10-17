// Load the website's unmodified engines. Never copy its astrology coefficients.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const requireEA=createRequire(new URL('../../ea/astro_swing_berjanggut/package.json',import.meta.url));
export const Astronomy=requireEA('astronomy-engine');
const requireRoot=createRequire(new URL('../../index.html',import.meta.url));
export function coreText(){
 const html=readFileSync(resolve(ROOT,'index.html'),'utf8');
 const a=html.indexOf('/* CEBONK ASTROLOGY'),b=html.indexOf('</script>',a);
 if(a<0||b<0)throw Error('SSOT CebonkCore marker missing');
 return html.slice(a,b);
}
export function sourceEngines(browser=false){
 const document={readyState:'loading',addEventListener(){}};
 const context={Date,Math,Intl,console,setTimeout,clearTimeout,document,dispatchEvent(){}};
 if(browser)context.window=context;
 else context.module={exports:{}};
 vm.createContext(context);
 vm.runInContext(coreText(),context,{timeout:15000,filename:'index.html#CebonkCore'});
 const C=browser?context.CebonkCore:context.module.exports;
 if(C.CFG.step!==5||C.CFG.buy!==1.15||C.CFG.sell!==-1.15)throw Error('SSOT API/version changed');
 if(browser){
  for(const path of ['astro-weekly-core','astro-killzone-core','astro-swing-daily-core','mt5-broker-clock'])
   vm.runInContext(readFileSync(resolve(ROOT,`assets/${path}.js`),'utf8'),context,{filename:path});
  return {C,W:context.CebonkAstroWeekly,K:context.CebonkAstroKillzone,
   D:context.CebonkDailySwingCore,B:context.CebonkMt5BrokerTime};
 }
 vm.runInContext(readFileSync(resolve(ROOT,'assets/mt5-broker-clock.js'),'utf8'),
  vm.createContext({window:context,document,Date,Math,console}),{filename:'broker-clock'});
 return {C,W:requireRoot('./assets/astro-weekly-core.js'),K:requireRoot('./assets/astro-killzone-core.js'),
  D:requireRoot('./assets/astro-swing-daily-core.js'),B:context.CebonkMt5BrokerTime};
}
