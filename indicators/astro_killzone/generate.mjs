import {writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {generate,encode,decode,validate} from './lib/feed.mjs';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){
  if(!['--from','--days','--output','--generated-at'].includes(args[i])||!args[i+1])throw Error('Options: --from YYYY-MM-DD --days 1..42 --output FILE --generated-at ISO_UTC');
  options[args[i]]=args[i+1];
}
const generatedAt=options['--generated-at']?Date.parse(options['--generated-at']):Date.now();
if(!Number.isFinite(generatedAt))throw Error('Invalid generation time');
const base=dirname(fileURLToPath(import.meta.url));
const output=options['--output']?resolve(options['--output']):resolve(base,existsSync(resolve(base,'MQL5/Indicators'))?'MQL5/Files/cebonk-killzone-forecast-v1.json':'../../MQL5/Files/cebonk-killzone-forecast-v1.json');
const feed=await generate({from:options['--from'],days:options['--days']?Number(options['--days']):42,generatedAt,onProgress:d=>process.stderr.write('Calculated '+d+'\n')});
const text=encode(feed);validate(decode(text),{nowUtc:Math.floor(generatedAt/1000),requireCurrent:!options['--from']});
mkdirSync(dirname(output),{recursive:true});writeFileSync(output+'.tmp',text);renameSync(output+'.tmp',output);
console.log(JSON.stringify({file:output,from:feed.horizon_start_wib,to:feed.horizon_end_wib,sessions:feed.sessions.length,bytes:Buffer.byteLength(text),sha256:decode(text).payload_sha256}));
