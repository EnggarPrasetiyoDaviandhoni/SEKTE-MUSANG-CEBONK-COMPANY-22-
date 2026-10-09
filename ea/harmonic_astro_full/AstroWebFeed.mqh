#ifndef CEBONK_ASTRO_WEB_FEED
#define CEBONK_ASTRO_WEB_FEED
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
void ACPoll(){
 if(AstroSource==ASTRO_OFF){acLoaded=false;acError="ASTRO_DISABLED";return;}
 long now=ACNowUTC();
 string month=ACMonthWIB(now);
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
 if(ACReadWeb(month))acNextTry=(long)TimeLocal()+AstroLiveCacheMinutes*60;
}
int ACDirAt(const long utc){
 if(!acLoaded)return 0;
 int lo=0,hi=ArraySize(acRows)-1;
 while(lo<=hi){int mid=(lo+hi)/2;
  if(utc<acRows[mid].from)hi=mid-1;
  else if(utc>=acRows[mid].to)lo=mid+1;
  else return acRows[mid].dir;
 }
 return 0;
}
bool ACGate(const int dir,const datetime m5SignalClose){
 if(AstroSource==ASTRO_OFF)return true;
 if(!AcceptExperimentalAstro||!acLoaded)return false;
 long now=ACNowUTC();
 // Tester historical dataset is simulated and thus evaluated at simulated UTC.
 // Live cached file can be reused, but not a missing or wrong-month model feed.
 if(AstroSource==ASTRO_WEB_CSV && !MQLInfoInteger(MQL_TESTER) &&
    (acMonth!=ACMonthWIB(now) || (long)TimeLocal()-acLastGood>AstroLiveCacheMinutes*60+120))return false;
 long closedUTC=ACFromServer(m5SignalClose)-1;
 return ACDirAt(now)==dir && ACDirAt(closedUTC)==dir;
}
#endif
