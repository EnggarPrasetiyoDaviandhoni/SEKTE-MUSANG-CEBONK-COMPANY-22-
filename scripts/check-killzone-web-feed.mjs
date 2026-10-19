import {readFileSync,writeFileSync} from 'node:fs';
import {decode,validate} from '../indicators/astro_killzone/lib/feed.mjs';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--file','--url','--evidence'].includes(args[i])||!args[i+1])throw Error('Options: --file FILE --url HTTPS_URL --evidence FILE');options[args[i]]=args[i+1];}
if(!options['--file']&&!options['--url'])throw Error('--file or --url is required');
const expected=options['--file']?validate(decode(readFileSync(options['--file'],'utf8'))):null;
let report={checked_at_utc:new Date().toISOString(),http:null,payload_sha256:expected?.payload_sha256,model_id:expected?.model_id};
if(options['--url']){
 const response=await fetch(options['--url'],{headers:{Accept:'application/json','Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
 if(response.status!==200)throw Error('Feed HTTP '+response.status);
 const raw=await response.text(),data=validate(decode(raw));
 if(expected&&data.payload_sha256!==expected.payload_sha256)throw Error('Remote feed differs from the locally validated forecast');
 report={...report,http:response.status,url:options['--url'],bytes:Buffer.byteLength(raw),payload_sha256:data.payload_sha256,model_id:data.model_id,horizon_start_wib:data.horizon_start_wib,horizon_end_wib:data.horizon_end_wib,mt5_native_webrequest:'NOT_RUN'};
}
if(options['--evidence'])writeFileSync(options['--evidence'],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
