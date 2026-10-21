#!/usr/bin/env node
import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT} from './swing/source.mjs';
import {iso,generateFeed,encodeFeed,decodeFeed,validateFeed} from './swing/feed.mjs';
export function sourceCommitOf(override){
 let sourceCommit=override||process.env.GITHUB_SHA;
 if(!sourceCommit){
  const head=readFileSync(resolve(ROOT,'.git/HEAD'),'utf8').trim();
  if(/^[a-f0-9]{40}$/.test(head))sourceCommit=head;
  else if(/^ref: refs\/heads\/[a-zA-Z0-9_./-]+$/.test(head)){
   const ref=head.slice(5);
   try{sourceCommit=readFileSync(resolve(ROOT,'.git',ref),'utf8').trim();}
   catch{sourceCommit=readFileSync(resolve(ROOT,'.git/packed-refs'),'utf8').split('\n').find(x=>x.endsWith(' '+ref))?.split(' ')[0];}
  }
 }
 if(!/^[a-f0-9]{40}$/.test(sourceCommit||''))throw Error('Valid --source-commit or Git checkout required');
 return sourceCommit;
}
export async function main(args=process.argv.slice(2)){
 const get=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
 const now=new Date(get('--generated-at',new Date().toISOString())).getTime();
 if(!Number.isFinite(now))throw Error('Invalid --generated-at');
 const from=get('--from',iso(now+7*3600000)),to=get('--to',null);
 const days=to?1+(Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000:Number(get('--days',8));
 const sourceCommit=sourceCommitOf(get('--source-commit',null));
 const payload=await generateFeed({from,days,generatedAt:now,sourceCommit});
 const raw=encodeFeed(payload);
 validateFeed(decodeFeed(raw),{nowUtc:Math.floor(now/1000)});
 const out=resolve(ROOT,get('--out','data/ea/swing-forecast-v2.json'));
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out+'.tmp',raw);renameSync(out+'.tmp',out);
 console.log(JSON.stringify({file:out,weeks:payload.weeks.length,sessions:payload.sessions.length,bytes:Buffer.byteLength(raw),sourceCommit}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e.message);process.exitCode=1;});
