#ifndef CEBONK_ASTRO_WEB_FEED
#define CEBONK_ASTRO_WEB_FEED
// Published V1 model drives the UPDATED web weekly panel's Monday-Friday dominance.
// Weekly core on the website uses the legacy V1 model; the browser daily UI says v2.0.
// Never confuse model version with UI version.
// Feed is from user's GitHub Pages site. It is V1 *published historical schedule*,
// NOT the on-page V2 browser runtime. Never imply V1/V2 prediction parity.
#define AC_MODEL "CEBONK_C2_WEB_V1_35ce78b4"
#define AC_WEB "https://enggarprasetiyodaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/ea/combined2/data/"
enum AC_SOURCE { ASTRO_WEB_CSV=0, ASTRO_LOCAL_CSV=1, ASTRO_OFF=2 };
input group "02 | ASTRODOX SOURCE (WEB)"
input AC_SOURCE AstroSource=ASTRO_WEB_CSV;
input bool AcceptExperimentalAstro=false;
input string AstroBaseURL=AC_WEB;
input string AstroLocalCSV="CEBONK_C2_ASTRO.csv";
input int AstroHTTPTimeoutMs=3500;
input int AstroLiveCacheMinutes=180;
input bool AstroAutoServerUTC=true;
input int AstroFixedServerUTCMinutes=180;
input group "03 | WEEKLY DOMINANCE (SENIN–JUMAT WIB)"
input bool UseWeeklyDominance=true;
input int WeeklyMinSharePercent=55;

struct ACWindow{long from,to;int dir;string id;};
ACWindow acRows[];
string acMonth="",acError="NOT_LOADED";
bool acLoaded=false;
long acLastGood=0,acNextTry=0;

bool ACDigits(const string s){
 if(StringLen(s)<1||StringLen(s)>20)return false;
 for(int k=0;k<StringLen(s);k++){ushort c=StringGetCharacter(s,k);if(c<48||c>57)return false;}
 return true;
}
int ACOffset(){
 if(MQLInfoInteger(MQL_TESTER) || !AstroAutoServerUTC)return AstroFixedServerUTCMinutes*60;
 double diff=(double)TimeTradeServer()-(double)TimeGMT();
 return (int)MathRound(diff/900.0)*900;
}
long ACNowUTC(){
 if(MQLInfoInteger(MQL_TESTER))return (long)TimeCurrent()-ACOffset();
 return (long)TimeGMT();
}
long ACFromServer(const datetime t){return (long)t-ACOffset();}
string ACMonthWIB(const long utc){
 MqlDateTime d;TimeToStruct((datetime)(utc+7*3600),d);
 return StringFormat("%04d-%02d",d.year,d.mon);
}
long ACWeekMondayUTC(const long utc){
 MqlDateTime d;
 TimeToStruct((datetime)(utc+7*3600),d);
 int offset=(d.day_of_week+6)%7; // Monday=0, Sunday=6
 d.hour=0;d.min=0;d.sec=0;
 return (long)StructToTime(d)-7*3600-(long)offset*86400;
}
string ACWeekCacheKey(const long utc){
 long monday=ACWeekMondayUTC(utc);
 string m1=ACMonthWIB(utc);
 string m2=ACMonthWIB(monday+6*3600);
 string m3=ACMonthWIB(monday+4*86400+6*3600);
 return m1+"/"+m2+"/"+m3;
}
bool ACParse(const string content){
 ACWindow temp[];string lines[];int n=StringSplit(content,10,lines);
 if(n<2){acError="EMPTY_ASTRO_CSV";return false;}
 long previous=0;bool header=false;
 for(int i=0;i<n;i++){
  string line=lines[i];StringTrimLeft(line);StringTrimRight(line);
  if(i==0&&StringLen(line)>0&&StringGetCharacter(line,0)==65279)line=StringSubstr(line,1);
  if(line=="")continue;
  if(!header){if(line!="start_epoch,end_epoch,direction,window_id,model")return false;header=true;continue;}
  string v[];if(StringSplit(line,44,v)!=5 || !ACDigits(v[0]) || !ACDigits(v[1]) ||
   v[4]!=AC_MODEL || StringLen(v[3])<2)return false;
  long from=StringToInteger(v[0]),to=StringToInteger(v[1]);
  if(from<946684800||to<=from||from%300!=0||to%300!=0||from<previous)return false;
  int dir=0;
  if(v[2]=="BUY")dir=1;
  else if(v[2]=="SELL")dir=-1;
  else if(v[2]!="NEUTRAL" && v[2]!="TRANSITION" && v[2]!="OUTSIDE")return false;
  int size=ArraySize(temp);if(size>20000)return false;
  ArrayResize(temp,size+1);temp[size].from=from;temp[size].to=to;
  temp[size].dir=dir;temp[size].id=v[3];previous=to;
 }
 if(ArraySize(temp)<1)return false;
 ArrayResize(acRows,ArraySize(temp));
 for(int i=0;i<ArraySize(temp);i++)acRows[i]=temp[i];
 acLoaded=true;acError="";acLastGood=(long)TimeLocal();return true;
}
bool ACReadLocal(){
 int fh=FileOpen(AstroLocalCSV,FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ,0,CP_UTF8);
 if(fh==INVALID_HANDLE){acError="ASTRO_LOCAL_FILE_MISSING";return false;}
 string content="";
 while(!FileIsEnding(fh)){
  content+=FileReadString(fh)+"\n";
  if(StringLen(content)>1500000){FileClose(fh);acError="ASTRO_FILE_TOO_LARGE";return false;}
 }
 FileClose(fh);if(!ACParse(content)){acError="ASTRO_LOCAL_FILE_INVALID";return false;}
 return true;
}
bool ACReadWeb(const string month){
 if(MQLInfoInteger(MQL_TESTER)){acError="TESTER_WEBREQUEST_UNSUPPORTED";return false;}
 char send[],reply[];string headers="";ResetLastError();
 int status=WebRequest("GET",AstroBaseURL+month+".csv","Accept: text/csv\r\n",AstroHTTPTimeoutMs,send,reply,headers);
 if(status!=200||ArraySize(reply)<30||ArraySize(reply)>1000000){acError="ASTRO_HTTP_"+IntegerToString(status);return false;}
 if(!ACParse(CharArrayToString(reply,0,WHOLE_ARRAY,CP_UTF8))){acError="ASTRO_WEB_PARSE_FAILED";return false;}
 return true;
}
// Fetch every month required for the CURRENT Mon-Fri week, plus the present
// month (Saturday/Sunday can be in another month). Atomic: no stale partial feed.
bool ACReadWebWeek(const long now){
 long monday=ACWeekMondayUTC(now);
 string required[3];
 required[0]=ACMonthWIB(monday+6*3600);
 required[1]=ACMonthWIB(monday+4*86400+6*3600);
 required[2]=ACMonthWIB(now);
 for(int a=0;a<3;a++)for(int b=a+1;b<3;b++){
  if(required[b]<required[a]){string x=required[a];required[a]=required[b];required[b]=x;}
 }
 ACWindow combined[];ArrayResize(combined,0);
 for(int m=0;m<3;m++){
  if(m>0&&required[m]==required[m-1])continue;
  if(!ACReadWeb(required[m])){acLoaded=false;ArrayResize(acRows,0);return false;}
  int start=ArraySize(combined),count=ArraySize(acRows);
  if(start+count>100000){acLoaded=false;ArrayResize(acRows,0);acError="ASTRO_TOO_MANY_ROWS";return false;}
  if(start>0&&count>0&&acRows[0].from<combined[start-1].to){
   acLoaded=false;ArrayResize(acRows,0);acError="ASTRO_OVERLAPPING_MONTHS";return false;
  }
  ArrayResize(combined,start+count);
  for(int k=0;k<count;k++)combined[start+k]=acRows[k];
 }
 if(ArraySize(combined)<1){acLoaded=false;acError="ASTRO_WEEK_EMPTY";return false;}
 ArrayResize(acRows,ArraySize(combined));
 for(int k=0;k<ArraySize(combined);k++)acRows[k]=combined[k];
 acLoaded=true;acLastGood=(long)TimeLocal();return true;
}
void ACPoll(){
 if(AstroSource==ASTRO_OFF){acLoaded=false;acError="ASTRO_DISABLED";return;}
 long now=ACNowUTC();
 string month=ACWeekCacheKey(now);
 if(AstroSource==ASTRO_LOCAL_CSV||MQLInfoInteger(MQL_TESTER)){
  if(!acLoaded && (long)TimeLocal()>=acNextTry){
   acNextTry=(long)TimeLocal()+60;
   if(!ACReadLocal())acLoaded=false;
  }
  return;
 }
 if(acLoaded && acMonth==month && (long)TimeLocal()<acNextTry)return;
 if((long)TimeLocal()<acNextTry)return;
 // Month must match active lookup; old month data is never reused as fallback.
 acLoaded=false;acMonth=month;acNextTry=(long)TimeLocal()+60;
 if(ACReadWebWeek(now))acNextTry=(long)TimeLocal()+AstroLiveCacheMinutes*60;
}
int ACIndexAt(const long utc){
 if(!acLoaded)return -1;
 int lo=0,hi=ArraySize(acRows)-1;
 while(lo<=hi){int mid=(lo+hi)/2;
  if(utc<acRows[mid].from)hi=mid-1;
  else if(utc>=acRows[mid].to)lo=mid+1;
  else return mid;
 }
 return -1; // missing is NOT neutral
}
int ACDirAt(const long utc){
 int i=ACIndexAt(utc);
 return i<0?0:acRows[i].dir;
}
// Weekly website policy: 5 WIB weekdays * 216 slots (06:00-24:00, 5-minute grid).
// BUY / SELL share is counted across the entire week; NEUTRAL/TRANSITION excluded.
// No DAILY ASTRO FILTER, no intraday window, no opposite-timeframe veto.
bool ACWeeklyGate(const int dir,const datetime nextM5Open){
 if(!UseWeeklyDominance)return true; // Only for explicit technical-only A/B tests.
 if(AstroSource==ASTRO_OFF||!AcceptExperimentalAstro||!acLoaded)return false;
 const long now=ACNowUTC();
 const long closedUTC=ACFromServer(nextM5Open)-1;
 const long monday=ACWeekMondayUTC(now);
 if(monday!=ACWeekMondayUTC(closedUTC))return false;
 MqlDateTime wib;TimeToStruct((datetime)(now+7*3600),wib);
 if(wib.day_of_week<1||wib.day_of_week>5)return false; // Never trade weekends.
 if(AstroSource==ASTRO_WEB_CSV && !MQLInfoInteger(MQL_TESTER) &&
   (acMonth!=ACWeekCacheKey(now)||(long)TimeLocal()-acLastGood>AstroLiveCacheMinutes*60+120))return false;
 int buy=0,sell=0;
 for(int day=0;day<5;day++){
  long start=monday+(long)day*86400+6*3600;
  for(int i=0;i<216;i++){
   long slot=start+(long)i*300;
   int idx=ACIndexAt(slot);
   if(idx<0||acRows[idx].to<slot+300)return false; // Full Mon-Fri coverage or SKIP.
   if(acRows[idx].dir>0)buy++;
   else if(acRows[idx].dir<0)sell++;
  }
 }
 const int directional=buy+sell;
 if(directional==0)return false;
 const int dominant=buy*100>=WeeklyMinSharePercent*directional ? 1 :
                    sell*100>=WeeklyMinSharePercent*directional ? -1 : 0;
 return dominant!=0 && dominant==dir; // Daily direction is irrelevant by design.
}
#endif