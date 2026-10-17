#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {decodeFeed,validateFeed} from './swing/feed.mjs';
const args=process.argv.slice(2),get=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
const file=get('--file'),url=get('--url');if(!file)throw Error('--file required');
const raw=readFileSync(file,'utf8'),data=decodeFeed(raw);validateFeed(data);
if(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
 if(response.status!==200)throw Error('Pages GET '+response.status);
 const live=decodeFeed(await response.text());validateFeed(live);
 if(live.payload_sha256!==data.payload_sha256)throw Error('Pages serves a different/older payload');
}
console.log('PASS schema, checksum, calendar, freshness'+(url?', Pages GET 200 and payload parity':''));
