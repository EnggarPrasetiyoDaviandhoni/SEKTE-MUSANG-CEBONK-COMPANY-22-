#ifndef CEBONK_SWING_FEED_VALIDATOR_MQH
#define CEBONK_SWING_FEED_VALIDATOR_MQH
#include "JsonParser.mqh"
struct CSSession {
 string id,sessionId,date,zone,windowId;int direction;
 datetime start,end,windowStart,core,windowEnd;
};
struct CSDay {string date,monday;int weekly,daily,rank;double illumination;};
struct CSLunar {datetime observed;string phase;double illumination;};
struct CSRangeSession {int id;datetime start,end;};
int CSDirection(string s){return s=="BUY"?1:s=="SELL"?-1:0;}
string CSDate(datetime t){MqlDateTime d;TimeToStruct(t,d);return StringFormat("%04d-%02d-%02d",d.year,d.mon,d.day);}
datetime CSDateParse(string text){
 if(StringLen(text)!=10||StringSubstr(text,4,1)!="-"||StringSubstr(text,7,1)!="-")return 0;
 string value=text;StringReplace(value,"-",".");datetime t=StringToTime(value+" 00:00:00");return CSDate(t)==text?t:0;
}
int CSSessionIndex(string s){if(s=="sydney")return 0;if(s=="tokyo")return 1;if(s=="london")return 2;if(s=="newyork")return 3;if(s=="londonclose")return 4;return -1;}
bool CSIsWeekday(datetime t){MqlDateTime d;TimeToStruct(t,d);return d.day_of_week>=1&&d.day_of_week<=5;}
datetime CSSunday(int year,int month,int nth,bool last=false){
 datetime first=CSDateParse(StringFormat("%04d-%02d-01",year,month));MqlDateTime d;TimeToStruct(first,d);
 if(last){int nextMonth=month==12?1:month+1,nextYear=month==12?year+1:year;datetime end=CSDateParse(StringFormat("%04d-%02d-01",nextYear,nextMonth))-86400;TimeToStruct(end,d);return end-d.day_of_week*86400;}
 return first+((7-d.day_of_week)%7+7*(nth-1))*86400;
}
int CSIanaOffset(datetime date,int session){
 MqlDateTime d;TimeToStruct(date,d);int year=d.year;
 if(session==1)return 540;
 if(session==0)return date>=CSSunday(year,4,1)&&date<CSSunday(year,10,1)?600:660;
 if(session==3)return date>=CSSunday(year,3,2)&&date<CSSunday(year,11,1)?-240:-300;
 return date>=CSSunday(year,3,1,true)&&date<CSSunday(year,10,1,true)?60:0;
}
bool CSPhaseAllowed(string phase){return phase!=""&&StringFind("|NEW_MOON|WAXING_CRESCENT|FIRST_QUARTER|WAXING_GIBBOUS|FULL_MOON|WANING_GIBBOUS|LAST_QUARTER|WANING_CRESCENT|","|"+phase+"|")>=0;}
class CSFeed {
 public:
  CSSession sessions[];CSDay days[];CSLunar moon[];CSRangeSession ranges[];datetime majorEvents[];
  datetime generated,expires,horizonStart,horizonEnd;string source,hash,error;bool healthy;
  CSFeed(){healthy=false;generated=0;expires=0;horizonStart=0;horizonEnd=0;}
  bool Reject(string reason){error=reason;healthy=false;return false;}
  bool TimeField(CSJson &j,int object,string key,datetime &out){int n=j.Get(object,key);if(!j.Integer(n)||j.Number(n)<1577836800||j.Number(n)>4102444800)return false;out=(datetime)j.Number(n);return true;}
  bool TextIs(CSJson &j,int object,string key,string expected){int n=j.Get(object,key);return j.Kind(n)==CSJ_STRING&&j.Text(n)==expected;}
  bool Valid(datetime now){return healthy&&now>=generated-600&&now<expires&&now-generated<=108000&&now+25200>=horizonStart&&now+25200<horizonEnd+86400;}
  bool Accept(string raw,datetime now){
   CSJson j;if(!j.Parse(raw))return Reject(j.Error());
   if(!j.Only(0,"schema_version,model_id,m5_model,source_commit,generated_at_utc,expires_at_utc,horizon_start_wib,horizon_end_wib,validated_predictive_model,weekly_source_method,daily_source_method,swing_daily_inherited_weekly,lunar_rank_broker_mode,weeks,sessions,moon,liquidity_sessions,payload_sha256"))return Reject("FEED_FIELDS");
   if(!j.VerifyHash(raw))return Reject("FEED_SHA256");
   if(!TextIs(j,0,"schema_version","2.0.0")||!TextIs(j,0,"model_id","CEBONK_SWING_ASTRO_WEEKLY_DAILY_5KZ_V1")||!TextIs(j,0,"m5_model","MUSANG_BERJANGGUT_CBR"))return Reject("FEED_MODEL");
   if(!TextIs(j,0,"weekly_source_method","CebonkAstroWeekly.scanWeek/CebonkCore.scan(WIB,360)")||!TextIs(j,0,"daily_source_method","CebonkAstroWeekly.days[].dominant")||!TextIs(j,0,"lunar_rank_broker_mode","AUTO_NY_CLOSE_ESTIMATE_00:00_ANNOTATION_ONLY"))return Reject("FEED_SOURCE_METHOD");
   int flag=j.Get(0,"validated_predictive_model"),inherited=j.Get(0,"swing_daily_inherited_weekly");
   if(j.Kind(flag)!=CSJ_BOOL||j.Number(flag)!=0||j.Kind(inherited)!=CSJ_BOOL||j.Number(inherited)!=1)return Reject("FEED_FLAGS");
   string commit=j.Text(j.Get(0,"source_commit"));if(StringLen(commit)!=40)return Reject("FEED_SOURCE_COMMIT");
   for(int k=0;k<40;k++){ushort c=StringGetCharacter(commit,k);if(!((c>=48&&c<=57)||(c>=97&&c<=102)))return Reject("FEED_SOURCE_COMMIT");}
   datetime gen=0,exp=0;if(!TimeField(j,0,"generated_at_utc",gen)||!TimeField(j,0,"expires_at_utc",exp)||gen>now+600||now-gen>108000||exp<=now||exp<=gen||exp-gen>108000)return Reject("FEED_STALE_FUTURE");
   datetime hs=CSDateParse(j.Text(j.Get(0,"horizon_start_wib"))),he=CSDateParse(j.Text(j.Get(0,"horizon_end_wib")));
   if(hs==0||he-hs<7*86400||he-hs>31*86400||now+25200<hs||now+25200>=he+86400)return Reject("FEED_HORIZON");
   int weekly=j.Get(0,"weeks"),ss=j.Get(0,"sessions"),lunar=j.Get(0,"moon"),rs=j.Get(0,"liquidity_sessions");
   if(j.Kind(weekly)!=CSJ_ARRAY||j.Count(weekly)<1||j.Count(weekly)>6||j.Kind(ss)!=CSJ_ARRAY||j.Count(ss)>160||j.Kind(rs)!=CSJ_ARRAY||j.Count(rs)>200||j.Count(rs)<5)return Reject("FEED_ARRAYS");
   CSDay newDays[];CSSession newSessions[];CSLunar newMoon[];CSRangeSession newRanges[];
   string expectedMondays[];int expectedRecords=0;
   for(datetime d=hs;d<=he;d+=86400)if(CSIsWeekday(d)){
    expectedRecords+=5;MqlDateTime p;TimeToStruct(d,p);string monday=CSDate(d-(p.day_of_week-1)*86400);
    int n=ArraySize(expectedMondays);if(n==0||expectedMondays[n-1]!=monday){ArrayResize(expectedMondays,n+1);expectedMondays[n]=monday;}
   }
   if(j.Count(weekly)!=ArraySize(expectedMondays)||j.Count(ss)!=expectedRecords)return Reject("FEED_MISSING_DAYS_SESSIONS");
   for(int w=0;w<j.Count(weekly);w++){
    int item=j.At(weekly,w);if(!j.Only(item,"week_monday_wib,weekly_direction,daily"))return Reject("FEED_WEEK_FIELDS");
    string monday=j.Text(j.Get(item,"week_monday_wib")),wd=j.Text(j.Get(item,"weekly_direction"));
    if(monday!=expectedMondays[w]||(wd!="BUY"&&wd!="SELL"&&wd!="CAMPURAN"&&wd!="TIDAK ADA ARAH"))return Reject("FEED_WEEK");
    int da=j.Get(item,"daily");if(j.Kind(da)!=CSJ_ARRAY||j.Count(da)!=5)return Reject("FEED_WEEK_DAYS");int ranks=0;
    for(int k=0;k<5;k++){
     int di=j.At(da,k);if(!j.Only(di,"date_wib,daily_direction,swing_daily_direction_inherited,moon_rank,illumination_pct,moon_observed_at_utc"))return Reject("FEED_DAY_FIELDS");
     CSDay v;v.date=j.Text(j.Get(di,"date_wib"));v.monday=monday;v.weekly=CSDirection(wd);
     string dd=j.Text(j.Get(di,"daily_direction"));v.daily=CSDirection(dd);int rank=j.Get(di,"moon_rank"),illum=j.Get(di,"illumination_pct");
     datetime observed=0;
     if(v.date!=CSDate(CSDateParse(monday)+k*86400)||(dd!="BUY"&&dd!="SELL"&&dd!="CAMPURAN")||
      !TextIs(j,di,"swing_daily_direction_inherited",v.weekly==1?"BUY":v.weekly==-1?"SELL":"WAIT")||
      !j.Integer(rank)||j.Number(rank)<1||j.Number(rank)>5||j.Kind(illum)!=CSJ_NUMBER||j.Number(illum)<0||j.Number(illum)>100||!TimeField(j,di,"moon_observed_at_utc",observed))return Reject("FEED_DAY");
     v.rank=(int)j.Number(rank);v.illumination=j.Number(illum);if((ranks&(1<<v.rank))!=0)return Reject("FEED_LUNAR_RANK");ranks|=1<<v.rank;
     int n=ArraySize(newDays);ArrayResize(newDays,n+1);newDays[n]=v;
    }
   }
   for(int i=0;i<j.Count(ss);i++){
    int item=j.At(ss,i);if(!j.Only(item,"id,session_id,date_wib,iana_timezone,session_start_utc,session_end_utc,astro_direction,window,moon_at_core"))return Reject("FEED_SESSION_FIELDS");
    CSSession s;s.id=j.Text(j.Get(item,"id"));s.sessionId=j.Text(j.Get(item,"session_id"));s.date=j.Text(j.Get(item,"date_wib"));s.zone=j.Text(j.Get(item,"iana_timezone"));
    int ix=CSSessionIndex(s.sessionId);datetime day=CSDateParse(s.date);string direction=j.Text(j.Get(item,"astro_direction"));s.direction=CSDirection(direction);
    if(ix<0||day<hs||day>he||!CSIsWeekday(day)||s.id!=s.sessionId+"-"+s.date||
     !TimeField(j,item,"session_start_utc",s.start)||!TimeField(j,item,"session_end_utc",s.end)||s.start>=s.end||
     CSDate(s.start+25200)!=s.date||(direction!="BUY"&&direction!="SELL"&&direction!="WAIT"))return Reject("FEED_SESSION");
    string zone=ix==0?"Australia/Sydney":ix==1?"Asia/Tokyo":ix==3?"America/New_York":"Europe/London";
    if(s.zone!=zone)return Reject("FEED_TIMEZONE");
    int localStart=ix==0?480:ix==1?540:ix==4?900:480,duration=ix==4?7200:10800;
    datetime expectedStart=day+localStart*60-CSIanaOffset(day,ix)*60;
    if(s.start!=expectedStart||s.end!=expectedStart+duration)return Reject("FEED_SESSION_DST_SCHEDULE");
    for(int q=0;q<ArraySize(newSessions);q++)if(newSessions[q].id==s.id)return Reject("FEED_DUPLICATE_SESSION");
    s.windowStart=0;s.core=0;s.windowEnd=0;s.windowId="";int win=j.Get(item,"window");
    if(!s.direction){if(j.Kind(win)!=CSJ_NULL)return Reject("FEED_WAIT_WINDOW");}
    else{
     if(!j.Only(win,"id,start_utc,core_utc,end_utc,direction,score_peak"))return Reject("FEED_WINDOW_FIELDS");
     s.windowId=j.Text(j.Get(win,"id"));
     if(s.windowId==""||StringLen(s.windowId)>100||!TextIs(j,win,"direction",direction)||
      !TimeField(j,win,"start_utc",s.windowStart)||!TimeField(j,win,"core_utc",s.core)||!TimeField(j,win,"end_utc",s.windowEnd)||
      !(s.start<=s.windowStart&&s.windowStart<=s.core&&s.core<s.windowEnd&&s.windowEnd<=s.end)||s.windowStart%300!=0||s.core%300!=0||s.windowEnd%300!=0||s.windowEnd-s.windowStart<900||j.Kind(j.Get(win,"score_peak"))!=CSJ_NUMBER)return Reject("FEED_WINDOW");
    }
    int mc=j.Get(item,"moon_at_core");datetime mo=0;int mi=j.Get(mc,"illumination_pct"),ma=j.Get(mc,"phase_angle");
    if(!j.Only(mc,"observed_at_utc,phase,phase_angle,illumination_pct")||!TimeField(j,mc,"observed_at_utc",mo)||mo!=(s.direction?s.core:s.start)||!CSPhaseAllowed(j.Text(j.Get(mc,"phase")))||
     j.Kind(mi)!=CSJ_NUMBER||j.Number(mi)<0||j.Number(mi)>100||j.Kind(ma)!=CSJ_NUMBER||j.Number(ma)<0||j.Number(ma)>=360)return Reject("FEED_MOON_CORE");
    int n=ArraySize(newSessions);ArrayResize(newSessions,n+1);newSessions[n]=s;
   }
   if(!j.Only(lunar,"algorithm,major_events,samples")||!TextIs(j,lunar,"algorithm","astronomy-engine@2.1.19"))return Reject("FEED_LUNAR");
   int events=j.Get(lunar,"major_events"),samples=j.Get(lunar,"samples");
   if(j.Kind(events)!=CSJ_ARRAY||j.Count(events)<4||j.Count(events)>30||j.Kind(samples)!=CSJ_ARRAY||j.Count(samples)<193||j.Count(samples)>769)return Reject("FEED_LUNAR_ARRAYS");
   datetime newEvents[];datetime previous=0;
   for(int i=0;i<j.Count(events);i++){int item=j.At(events,i);datetime t=0;
    string p=j.Text(j.Get(item,"phase"));if(!j.Only(item,"phase,event_at_utc")||!TimeField(j,item,"event_at_utc",t)||t<=previous||
     (p!="NEW_MOON"&&p!="FIRST_QUARTER"&&p!="FULL_MOON"&&p!="LAST_QUARTER"))return Reject("FEED_MOON_EVENTS");previous=t;ArrayResize(newEvents,i+1);newEvents[i]=t;}
   if(j.Count(samples)!=(int)((he-hs)/3600)+25)return Reject("FEED_MOON_COVERAGE");previous=0;
   for(int i=0;i<j.Count(samples);i++){
    int item=j.At(samples,i);CSLunar v;int illum=j.Get(item,"illumination_pct"),angle=j.Get(item,"phase_angle");
    if(!j.Only(item,"observed_at_utc,phase,phase_angle,illumination_pct")||!TimeField(j,item,"observed_at_utc",v.observed)||v.observed<=previous||
     j.Kind(illum)!=CSJ_NUMBER||j.Number(illum)<0||j.Number(illum)>100||j.Kind(angle)!=CSJ_NUMBER||j.Number(angle)<0||j.Number(angle)>=360)return Reject("FEED_MOON_SAMPLE");
    v.phase=j.Text(j.Get(item,"phase"));if(!CSPhaseAllowed(v.phase)||v.observed!=hs-25200+i*3600)return Reject("FEED_MOON_GRID");v.illumination=j.Number(illum);previous=v.observed;
    int n=ArraySize(newMoon);ArrayResize(newMoon,n+1);newMoon[n]=v;
   }
   for(int i=0;i<j.Count(rs);i++){
    int item=j.At(rs,i);CSRangeSession v;if(!j.Only(item,"session_id,start_utc,end_utc"))return Reject("FEED_RANGE_FIELDS");
    v.id=CSSessionIndex(j.Text(j.Get(item,"session_id")));
    if(v.id<0||!TimeField(j,item,"start_utc",v.start)||!TimeField(j,item,"end_utc",v.end)||v.start>=v.end)return Reject("FEED_RANGE");
    int n=ArraySize(newRanges);ArrayResize(newRanges,n+1);newRanges[n]=v;
   }
   ArrayResize(sessions,ArraySize(newSessions));for(int i=0;i<ArraySize(newSessions);i++)sessions[i]=newSessions[i];
   ArrayResize(days,ArraySize(newDays));for(int i=0;i<ArraySize(newDays);i++)days[i]=newDays[i];
   ArrayResize(moon,ArraySize(newMoon));for(int i=0;i<ArraySize(newMoon);i++)moon[i]=newMoon[i];
   ArrayResize(ranges,ArraySize(newRanges));for(int i=0;i<ArraySize(newRanges);i++)ranges[i]=newRanges[i];ArrayCopy(majorEvents,newEvents);
   generated=gen;expires=exp;horizonStart=hs;horizonEnd=he;source=commit;hash=j.Text(j.Get(0,"payload_sha256"));healthy=true;error="FEED_VALID";return true;
  }
  int DayIndex(string date){for(int i=0;i<ArraySize(days);i++)if(days[i].date==date)return i;return -1;}
  int Owner(datetime now){
   int owner=-1;
   for(int i=0;i<ArraySize(sessions);i++){
    CSSession s=sessions[i];int day=DayIndex(s.date);
    if(s.direction==0||day<0||days[day].weekly!=s.direction||days[day].daily!=s.direction||now<s.windowStart||now>=s.windowEnd)continue;
    if(owner<0||s.windowStart<sessions[owner].windowStart||(s.windowStart==sessions[owner].windowStart&&StringCompare(s.sessionId,sessions[owner].sessionId)<0))owner=i;
   }return owner;
  }
};
#endif
