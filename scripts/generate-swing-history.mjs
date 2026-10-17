#!/usr/bin/env node
// Astronomy backfill from a pinned source; no historical/future price input.
import {mkdirSync,writeFileSync,appendFileSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {ROOT,sourceEngines} from './swing/source.mjs';
import {sourceCommitOf} from './generate-swing-feed.mjs';
import {addDay,generateFeed,encodeFeed,decodeFeed,validateFeed} from './swing/feed.mjs';
const args=process.argv.slice(2),get=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
async function main(){
 const from=get('--from',null),to=get('--to',null);
 if(!from||!to||from>to||addDay(from,0)!==from||addDay(to,0)!==to||Date.parse(to)-Date.parse(from)>366*86400000)
  throw Error('--from/--to are required, at most 367 calendar days');
 const output=resolve(ROOT,get('--out','MQL5/Files/swing-forecast-v2.history.jsonl'));
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output+'.tmp','');
 const sourceCommit=sourceCommitOf(get('--source-commit',null)),engines=sourceEngines(),weekCache=new Map(),sessionCache=new Map();
 let count=0;const first=addDay(from,-1);
 for(let day=first;day<=to;day=addDay(day,1)){
  const published=Date.parse(day+'T00:10:00Z');
  const payload=await generateFeed({from:day,days:8,generatedAt:published,sourceCommit,engines,weekCache,sessionCache});
  const raw=encodeFeed(payload);validateFeed(decodeFeed(raw),{nowUtc:published/1000});appendFileSync(output+'.tmp',raw);count++;
  console.log('Prepared publication '+day+' 00:10 UTC');
 }
 renameSync(output+'.tmp',output);
 writeFileSync(output+'.manifest.json',JSON.stringify({kind:'Astronomy backfill, simulated daily publication, not an authentic historical publication archive',source_commit:sourceCommit,
  requested_from:from,requested_to:to,publication_from:first,records:count,price_input:false},null,2)+'\n');
 console.log(JSON.stringify({output,records:count,sourceCommit}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
