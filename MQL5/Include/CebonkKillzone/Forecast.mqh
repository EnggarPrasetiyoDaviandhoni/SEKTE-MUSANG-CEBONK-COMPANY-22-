#ifndef CEBONK_KILLZONE_FORECAST_MQH
#define CEBONK_KILLZONE_FORECAST_MQH
#include "Calendar.mqh"
#include "JsonParser.mqh"
struct CKAWindow {int side;datetime rawStart,start,core,end;double score;};
struct CKASession {int index,side,first,count,best,buyMinutes,sellMinutes;datetime date,start,end;};
class CKAForecast {
 public:
  CKASession sessions[];CKAWindow windows[];datetime generated,horizonStart,horizonEnd;string hash,source,error;bool healthy;
  CKAForecast(){healthy=false;generated=0;horizonStart=0;horizonEnd=0;error="FORECAST_NOT_LOADED";}
  bool Reject(string why){healthy=false;error=why;return false;}
  bool Covers(datetime date){return healthy&&date>=horizonStart&&date<=horizonEnd;}
  int Find(datetime date,int index){for(int i=0;i<ArraySize(sessions);i++)if(sessions[i].date==date&&sessions[i].index==index)return i;return -1;}
  bool Text(CKAJson &j,int object,string key,string value){return j.Kind(j.Get(object,key))==CKAJ_STRING&&j.Text(j.Get(object,key))==value;}
  bool TimeField(CKAJson &j,int object,string key,datetime &out){int v=j.Get(object,key);if(!j.Integer(v)||j.Number(v)<1577836800||j.Number(v)>4102444800)return false;out=(datetime)j.Number(v);return true;}
  bool Accept(string raw,datetime now){
   if(now<1577836800)return Reject("CLOCK_UNVERIFIED");
   CKAJson j;if(!j.Parse(raw))return Reject(j.Error());
   if(!j.VerifyHash(raw))return Reject("FORECAST_SHA256");
   if(!j.Only(0,"schema_version,model_id,source_commit,astronomy_engine,generated_at_utc,horizon_start_wib,horizon_end_wib,sessions,payload_sha256")||
    !Text(j,0,"schema_version","1.0.0")||!Text(j,0,"model_id","CEBONK_ASTRODOX_V1_SESSION_ONLY")||!Text(j,0,"astronomy_engine","2.1.19"))return Reject("FORECAST_MODEL_FIELDS");
   string commit=j.Text(j.Get(0,"source_commit"));if(StringLen(commit)!=40)return Reject("FORECAST_SOURCE");
   for(int i=0;i<40;i++){ushort c=StringGetCharacter(commit,i);if(!((c>=48&&c<=57)||(c>=97&&c<=102)))return Reject("FORECAST_SOURCE");}
   datetime gen=0;if(!TimeField(j,0,"generated_at_utc",gen)||gen>now+600)return Reject("FORECAST_FUTURE");
   datetime hs=CKADateParse(j.Text(j.Get(0,"horizon_start_wib"))),he=CKADateParse(j.Text(j.Get(0,"horizon_end_wib")));
   if(hs==0||he<hs||he-hs>41*86400)return Reject("FORECAST_HORIZON");
   int root=j.Get(0,"sessions"),expected=0;for(datetime d=hs;d<=he;d+=86400)if(CKAWeekday(d))expected+=5;
   if(j.Kind(root)!=CKAJ_ARRAY||j.Count(root)!=expected)return Reject("FORECAST_MISSING_SESSIONS");
   CKASession nextSessions[];CKAWindow nextWindows[];int position=0;
   for(datetime d=hs;d<=he;d+=86400)if(CKAWeekday(d))for(int index=0;index<5;index++){
    int item=j.At(root,position++);CKASession s;s.index=index;s.date=d;s.first=ArraySize(nextWindows);
    if(!j.Only(item,"id,session_id,session_name,date_wib,iana_timezone,session_start_utc,session_end_utc,focus,buy_minutes,sell_minutes,best_index,windows")||
     !Text(j,item,"id",CKASessionId(index)+"-"+CKADate(d))||!Text(j,item,"date_wib",CKADate(d))||!Text(j,item,"session_id",CKASessionId(index))||
     !Text(j,item,"session_name",CKASessionName(index))||!Text(j,item,"iana_timezone",CKASessionZone(index)))return Reject("FORECAST_SESSION_FIELDS");
    int localStart=index==0?480:index==1?540:index==4?900:480,duration=index==4?7200:10800;
    if(!TimeField(j,item,"session_start_utc",s.start)||!TimeField(j,item,"session_end_utc",s.end)||s.start!=d+localStart*60-CKAIanaOffset(d,index)*60||s.end!=s.start+duration)return Reject("FORECAST_SESSION_DST");
    int wa=j.Get(item,"windows");if(j.Kind(wa)!=CKAJ_ARRAY||j.Count(wa)>36)return Reject("FORECAST_WINDOWS");
    s.count=j.Count(wa);int buy=0,sell=0;datetime previous=s.start;
    for(int k=0;k<s.count;k++){
     int wi=j.At(wa,k);CKAWindow w;string direction=j.Text(j.Get(wi,"direction"));w.side=CKADirection(direction);
     int score=j.Get(wi,"score_peak");w.score=j.Number(score);
     if(!j.Only(wi,"direction,raw_start_utc,start_utc,core_utc,end_utc,score_peak")||w.side==0||j.Kind(score)!=CKAJ_NUMBER||
      !TimeField(j,wi,"raw_start_utc",w.rawStart)||!TimeField(j,wi,"start_utc",w.start)||!TimeField(j,wi,"core_utc",w.core)||!TimeField(j,wi,"end_utc",w.end)||
      w.rawStart%300!=0||w.start%300!=0||w.core%300!=0||w.end%300!=0||
      !(previous<=w.rawStart&&w.rawStart+600==w.start&&w.start<=w.core&&w.core<w.end&&w.end<=s.end&&w.end-w.start>=900)||
      (w.side>0?w.score<1.15:w.score> -1.15))return Reject("FORECAST_WINDOW");
     previous=w.end;if(w.side>0)buy+=(int)((w.end-w.start)/60);else sell+=(int)((w.end-w.start)/60);
     int n=ArraySize(nextWindows);ArrayResize(nextWindows,n+1);nextWindows[n]=w;
    }
    int total=buy+sell;s.side=total>0&&buy!=sell&&(double)(buy>sell?buy:sell)/total>=.55?(buy>sell?1:-1):0;
    s.buyMinutes=buy;s.sellMinutes=sell;s.best=-1;
    for(int k=0;k<s.count;k++){
     int at=s.first+k;CKAWindow w=nextWindows[at];if(w.side!=s.side)continue;
     if(s.best<0){s.best=at;continue;}CKAWindow best=nextWindows[s.best];
     if(w.end-w.start>best.end-best.start||
      (w.end-w.start==best.end-best.start&&(MathAbs(w.score)>MathAbs(best.score)||(MathAbs(w.score)==MathAbs(best.score)&&w.start<best.start))))s.best=at;
    }
    string focus=s.side>0?"BUY":s.side<0?"SELL":"WAIT";int bm=j.Get(item,"buy_minutes"),sm=j.Get(item,"sell_minutes"),bi=j.Get(item,"best_index");
    if(!Text(j,item,"focus",focus)||!j.Integer(bm)||j.Number(bm)!=buy||!j.Integer(sm)||j.Number(sm)!=sell||!j.Integer(bi)||j.Number(bi)!=(s.best<0?-1:s.best-s.first))return Reject("FORECAST_FOCUS_RANK");
    int n=ArraySize(nextSessions);ArrayResize(nextSessions,n+1);nextSessions[n]=s;
   }
   ArrayResize(sessions,ArraySize(nextSessions));for(int i=0;i<ArraySize(nextSessions);i++)sessions[i]=nextSessions[i];
   ArrayResize(windows,ArraySize(nextWindows));for(int i=0;i<ArraySize(nextWindows);i++)windows[i]=nextWindows[i];
   generated=gen;horizonStart=hs;horizonEnd=he;source=commit;hash=j.Text(j.Get(0,"payload_sha256"));healthy=true;error="FORECAST_VALID";return true;
  }
};
#endif
