#!/usr/bin/env node
import {buildFeed,validateFeed} from '../scripts/generate-xagusd-first-quarter.mjs';

const now=new Date('2026-10-16T10:00:00Z');
const feed=buildFeed(now);
validateFeed(feed,now);
const next=feed.first_quarters.find(e=>e.phase_epoch>now.getTime()/1000);
if(!next)throw Error('No upcoming Quarter event');
const iso=new Date(next.phase_epoch*1000).toISOString();
if(!iso.startsWith('2026-10-18T'))throw Error('Next First Quarter date inconsistent: '+iso);
// Cross-check broad tolerance against published independent almanac; UTC minute precision.
if(Math.abs(next.phase_epoch-Date.parse('2026-10-18T16:12:00Z')/1000)>2*3600)
 throw Error('Unexpected First Quarter from ephemeris '+iso);
if(!feed.first_quarters.every((e,i,a)=>i===0||e.phase_epoch>a[i-1].phase_epoch))
 throw Error('Unsorted First Quarter events');
const tampered=structuredClone(feed);tampered.first_quarters[1].phase_epoch=tampered.first_quarters[0].phase_epoch;
let rejected=false;try{validateFeed(tampered,now)}catch(_){rejected=true;}
if(!rejected)throw Error('Duplicate quarter was accepted.');
console.log('XAGUSD moon feed tests OK · '+feed.first_quarters.length+' events · first '+iso);
