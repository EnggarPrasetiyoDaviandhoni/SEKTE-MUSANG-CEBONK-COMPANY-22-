// Weekly resolver wraps the unchanged website engines. It does not alter their
// scores or the five-day source weekly/daily forecasts.
export const STRENGTH_METHOD='DIRECTIONAL_ABS_SCORE_MINUTES_7D_WIB_00_24';
export const MIN_SHARE=0.55;
export const MIN_MINUTES=360;
const datePlus=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function strengthDay(date,samples){
 if(samples.length!==288)throw Error('Seven-day scan needs 288 five-minute slots per day');
 let buy=0,sell=0,buyMinutes=0,sellMinutes=0;
 for(const sample of samples){
  if(!Number.isFinite(sample.score))throw Error('Nonfinite seven-day score');
  if(sample.state==='BUY'){buy+=Math.abs(sample.score)*5;buyMinutes+=5;}
  if(sample.state==='SELL'){sell+=Math.abs(sample.score)*5;sellMinutes+=5;}
 }
 return {date_wib:date,slots:288,buy_score_minutes:buy,sell_score_minutes:sell,buy_minutes:buyMinutes,sell_minutes:sellMinutes};
}
export function resolveWeekly(source,strength){
 if(source==='BUY'||source==='SELL')return {direction:source,reason:'SOURCE_WEEKLY'};
 if(source==='TIDAK ADA ARAH')return {direction:'WAIT',reason:'SOURCE_NO_DIRECTION'};
 if(source!=='CAMPURAN')throw Error('Unknown source weekly direction');
 const b=strength.buy_score_minutes,s=strength.sell_score_minutes,total=b+s;
 if(total<=0||Math.abs(b-s)<=total*1e-12)return {direction:'WAIT',reason:'WAIT_TIE'};
 if(strength.buy_minutes+strength.sell_minutes<strength.min_directional_minutes||
    Math.max(b,s)/total+1e-12<strength.min_share)return {direction:'WAIT',reason:'WAIT_BELOW_THRESHOLD'};
 return {direction:b>s?'BUY':'SELL',reason:'SEVEN_DAY_STRENGTH'};
}
export async function sevenDayStrength(monday,C,Astronomy){
 const engine=C.createEngine(Astronomy),days=[];
 try{for(let i=0;i<7;i++){
  const date=datePlus(monday,i);
  days.push(strengthDay(date,await C.scan(engine,date,0,true,undefined,undefined,'WIB')));
 }}finally{engine.clear();}
 return {method:STRENGTH_METHOD,start_wib:monday,end_wib:datePlus(monday,6),step_minutes:5,total_slots:2016,
  min_share:MIN_SHARE,min_directional_minutes:MIN_MINUTES,
  buy_score_minutes:days.reduce((a,d)=>a+d.buy_score_minutes,0),sell_score_minutes:days.reduce((a,d)=>a+d.sell_score_minutes,0),
  buy_minutes:days.reduce((a,d)=>a+d.buy_minutes,0),sell_minutes:days.reduce((a,d)=>a+d.sell_minutes,0),days};
}
export function validateWeeklyStrength(week){
 const s=week.seven_day_strength;
 if(s.method!==STRENGTH_METHOD||s.start_wib!==week.week_monday_wib||s.end_wib!==datePlus(s.start_wib,6)||
    s.step_minutes!==5||s.total_slots!==2016||s.min_share!==MIN_SHARE||s.min_directional_minutes!==MIN_MINUTES||s.days.length!==7)
  throw Error('Seven-day method/coverage/threshold mismatch');
 let b=0,v=0,bm=0,sm=0;
 s.days.forEach((d,i)=>{
  if(d.date_wib!==datePlus(s.start_wib,i)||d.slots!==288||d.buy_minutes+d.sell_minutes>1440||
     d.buy_minutes%5||d.sell_minutes%5||(!d.buy_minutes&&d.buy_score_minutes)||(!d.sell_minutes&&d.sell_score_minutes))
   throw Error('Seven-day daily coverage/strength mismatch');
  b+=d.buy_score_minutes;v+=d.sell_score_minutes;bm+=d.buy_minutes;sm+=d.sell_minutes;
 });
 const near=(a,b)=>Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10;
 if(!near(b,s.buy_score_minutes)||!near(v,s.sell_score_minutes)||bm!==s.buy_minutes||sm!==s.sell_minutes)
  throw Error('Seven-day totals mismatch');
 const decision=resolveWeekly(week.weekly_source_direction,s);
 if(decision.direction!==week.weekly_direction||decision.reason!==week.weekly_resolution_reason)throw Error('Weekly decision mismatch');
}
