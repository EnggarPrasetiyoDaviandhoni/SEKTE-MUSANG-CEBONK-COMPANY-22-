// CEBONK LIQUIDITY SWEEP EA v1.00 - Astrology + Astrology News adapter.
// Astrology direction is loaded from the same published 5-minute model schedule used by the web project.
// Astrology News reproduces the web policy: news anchors time, inherited Astrology supplies direction.
#ifndef CEBONK_BW_ASTRO_NEWS
#define CEBONK_BW_ASTRO_NEWS

#define BW_ASTRO_MODEL "CEBONK_C2_WEB_V1_35ce78b4"
#define BW_STEP 300

enum BW_ASTRO_SOURCE { BW_ASTRO_WEB_MONTH=0, BW_ASTRO_LOCAL_CSV=1 };
enum BW_NEWS_SOURCE { BW_NEWS_MT5_CALENDAR=0, BW_NEWS_LOCAL_CSV=1 };

struct BWAstroRow { long from,to; int dir; string id; };
struct BWNewsItem { ulong id; long utc,known; string name; };
struct BWNewsGate {
 bool episode;
 bool candidate;
 int dir;
 long release;
 long windowStart;
 long entryEnd;
 string names;
 string reason;
};
struct BWRun { int dir; long start,end; };

BWAstroRow gBWAstro[];
BWNewsItem gBWNews[];
long gBWAstroNextPoll=0,gBWNewsNextPoll=0,gBWNewsUpdated=0,gBWNewsFrom=0,gBWNewsTo=0;
int gBWNewsOffset=0;
bool gBWAstroOK=false,gBWNewsOK=false;
string gBWAstroMonth="",gBWAstroError="ASTRO_NOT_LOADED",gBWNewsError="NEWS_NOT_LOADED";

bool BWDigits(const string s){
 if(StringLen(s)<1||StringLen(s)>20)return false;
 for(int i=0;i<StringLen(s);i++){ushort c=StringGetCharacter(s,i);if(c<48||c>57)return false;}return true;
}
int BWServerOffset(const bool tester,const bool autoOffset,const int fixedMinutes){
 if(tester||!autoOffset)return fixedMinutes*60;
 long diff=(long)TimeTradeServer()-(long)TimeGMT();
 return (int)MathRound((double)diff/900.0)*900;
}
long BWNowUTC(const bool tester,const bool autoOffset,const int fixedMinutes){
 return tester?(long)TimeCurrent()-BWServerOffset(true,autoOffset,fixedMinutes):(long)TimeGMT();
}
long BWServerToUTC(const long t,const bool tester,const bool autoOffset,const int fixedMinutes){
 return t-BWServerOffset(tester,autoOffset,fixedMinutes);
}
string BWWIB(const long utc){ return TimeToString((datetime)(utc+7*3600),TIME_DATE|TIME_MINUTES)+" WIB"; }
string BWMonthWIB(const long utc){
 MqlDateTime d;TimeToStruct((datetime)(utc+7*3600),d);return StringFormat("%04d-%02d",d.year,d.mon);
}

bool BWParseAstro(const string text){
 BWAstroRow rows[];string lines[];StringSplit(text,10,lines);bool header=false;long previous=0;
 for(int i=0;i<ArraySize(lines);i++){
  string row=lines[i];StringTrimLeft(row);StringTrimRight(row);
  if(i==0&&StringLen(row)>0&&StringGetCharacter(row,0)==65279)row=StringSubstr(row,1);
  if(row=="")continue;
  if(!header){if(row!="start_epoch,end_epoch,direction,window_id,model")return false;header=true;continue;}
  string v[];if(StringSplit(row,44,v)!=5||!BWDigits(v[0])||!BWDigits(v[1])||v[4]!=BW_ASTRO_MODEL)return false;
  long from=StringToInteger(v[0]),to=StringToInteger(v[1]);
  if(from<946684800||to<=from||from%300!=0||to%300!=0||from<previous||StringLen(v[3])<1)return false;
  int dir=v[2]=="BUY"?1:v[2]=="SELL"?-1:0;
  if(dir==0&&v[2]!="NEUTRAL"&&v[2]!="TRANSITION"&&v[2]!="OUTSIDE")return false;
  int n=ArraySize(rows);if(n>=100000)return false;ArrayResize(rows,n+1);
  rows[n].from=from;rows[n].to=to;rows[n].dir=dir;rows[n].id=v[3];previous=to;
 }
 if(!header||ArraySize(rows)==0)return false;
 ArrayResize(gBWAstro,ArraySize(rows));for(int i=0;i<ArraySize(rows);i++)gBWAstro[i]=rows[i];
 gBWAstroOK=true;gBWAstroError="";return true;
}

bool BWLoadAstroLocal(const string file,const bool common){
 int flags=FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ;if(common)flags|=FILE_COMMON;
 int f=FileOpen(file,flags,0,CP_UTF8);if(f==INVALID_HANDLE){gBWAstroError="ASTRO_CSV_NOT_FOUND";gBWAstroOK=false;return false;}
 string text="";while(!FileIsEnding(f)){text+=FileReadString(f)+"\n";if(StringLen(text)>8000000){FileClose(f);gBWAstroOK=false;return false;}}
 FileClose(f);if(!BWParseAstro(text)){gBWAstroError="ASTRO_CSV_INVALID";gBWAstroOK=false;return false;}return true;
}

bool BWLoadAstroWeb(const string baseURL,const int timeout,const string month){
 char empty[],answer[];string headers;ResetLastError();
 int http=WebRequest("GET",baseURL+month+".csv","Accept: text/csv\r\n",timeout,empty,answer,headers);
 if(http!=200||ArraySize(answer)>1000000||!BWParseAstro(CharArrayToString(answer,0,WHOLE_ARRAY,CP_UTF8))){
  ArrayResize(gBWAstro,0);gBWAstroOK=false;gBWAstroError="ASTRO_HTTP_"+(string)http;return false;
 }
 return true;
}

void BWAstroPoll(const bool tester,const BW_ASTRO_SOURCE source,const string baseURL,const string localFile,
 const bool common,const int timeout,const bool autoOffset,const int fixedMinutes){
 long now=BWNowUTC(tester,autoOffset,fixedMinutes),clock=(long)TimeLocal();
 if(source==BW_ASTRO_LOCAL_CSV||tester){
  if(!gBWAstroOK)BWLoadAstroLocal(localFile,common&&!tester);return;
 }
 string month=BWMonthWIB(now);
 if(gBWAstroOK&&gBWAstroMonth==month&&clock<gBWAstroNextPoll)return;
 gBWAstroMonth=month;gBWAstroNextPoll=clock+60;
 if(BWLoadAstroWeb(baseURL,timeout,month))gBWAstroNextPoll=clock+6*3600;
}

int BWAstroIndex(const long utc){
 int lo=0,hi=ArraySize(gBWAstro)-1;
 while(lo<=hi){int m=(lo+hi)/2;if(utc<gBWAstro[m].from)hi=m-1;else if(utc>=gBWAstro[m].to)lo=m+1;else return m;}return -1;
}
int BWAstroDir(const long utc){int i=BWAstroIndex(utc);return i>=0?gBWAstro[i].dir:0;}
bool BWAstroNormalGate(const long nowUtc,const long eventUtc,const int dir,const bool accepted,string &why){
 if(!accepted){why="ASTRO_EXPERIMENT_NOT_ACCEPTED";return false;}
 if(!gBWAstroOK){why=gBWAstroError;return false;}
 int live=BWAstroDir(nowUtc),event=BWAstroDir(eventUtc);
 if(live==0||event==0){why="OUTSIDE_ASTRO_WINDOW";return false;}
 if(live!=dir||event!=dir){why="ASTRO_DIRECTION_MISMATCH";return false;}
 why="ASTROLOGY "+BWSide(dir);return true;
}

void BWNewsSort(BWNewsItem &a[]){
 for(int i=1;i<ArraySize(a);i++){BWNewsItem x=a[i];int j=i-1;while(j>=0&&(a[j].utc>x.utc||(a[j].utc==x.utc&&a[j].id>x.id))){a[j+1]=a[j];j--;}a[j+1]=x;}
}
bool BWParseNewsLocal(const string file,const bool common,const bool tester,const bool allowReplay,const long now){
 if(tester&&!allowReplay){gBWNewsOK=false;gBWNewsError="TESTER_NEWS_REPLAY_OFF";return false;}
 int flags=FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ;if(common&&!tester)flags|=FILE_COMMON;
 int f=FileOpen(file,flags,0,CP_UTF8);if(f==INVALID_HANDLE){gBWNewsOK=false;gBWNewsError="NEWS_CSV_NOT_FOUND";return false;}
 string head=FileReadString(f);StringTrimRight(head);if(StringLen(head)>0&&StringGetCharacter(head,0)==65279)head=StringSubstr(head,1);
 string m[];bool ok=StringSplit(head,44,m)==5&&m[0]=="CEBONK_NEWS_V1"&&BWDigits(m[1])&&BWDigits(m[2])&&BWDigits(m[3])&&BWDigits(m[4]);
 long from=0,to=0,exported=0;int expected=-1;
 if(ok){from=StringToInteger(m[1]);to=StringToInteger(m[2]);exported=StringToInteger(m[3]);expected=(int)StringToInteger(m[4]);ok=from>0&&to>from&&expected>=0&&expected<=20000;}
 string hdr=FileReadString(f);StringTrimRight(hdr);ok=ok&&hdr=="value_id,release_epoch,currency,importance,name";
 BWNewsItem rows[];
 while(ok&&!FileIsEnding(f)){
  string line=FileReadString(f);StringTrimRight(line);if(line=="")continue;string v[];
  if(StringSplit(line,44,v)!=5||!BWDigits(v[0])||!BWDigits(v[1])||v[2]!="USD"||v[3]!="HIGH"){ok=false;break;}
  BWNewsItem x;x.id=(ulong)StringToInteger(v[0]);x.utc=StringToInteger(v[1]);x.known=tester?0:exported;x.name=StringSubstr(v[4],0,180);
  if(x.id==0||x.utc<from||x.utc>=to||x.name==""){ok=false;break;}
  int n=ArraySize(rows);ArrayResize(rows,n+1);rows[n]=x;
 }
 FileClose(f);if(!ok||ArraySize(rows)!=expected){gBWNewsOK=false;gBWNewsError="NEWS_CSV_INVALID";return false;}
 BWNewsSort(rows);ArrayResize(gBWNews,ArraySize(rows));for(int i=0;i<ArraySize(rows);i++)gBWNews[i]=rows[i];
 gBWNewsFrom=from;gBWNewsTo=to;gBWNewsUpdated=now;gBWNewsOK=true;gBWNewsError="";return true;
}

void BWNewsPoll(const bool tester,const BW_NEWS_SOURCE source,const string localFile,const bool common,const bool allowReplay,
 const int pollSeconds,const int maxCache,const bool autoOffset,const int fixedMinutes){
 long now=BWNowUTC(tester,autoOffset,fixedMinutes);
 if(tester||source==BW_NEWS_LOCAL_CSV){
  if(!gBWNewsOK)BWParseNewsLocal(localFile,common,tester,allowReplay,now);return;
 }
 if(now<gBWNewsNextPoll)return;gBWNewsNextPoll=now+pollSeconds;
 int offset=BWServerOffset(false,autoOffset,fixedMinutes);
 long from=now-3*3600,to=now+30*3600;MqlCalendarValue values[];ResetLastError();
 int count=CalendarValueHistory(values,(datetime)(from+offset),(datetime)(to+offset),NULL,"USD");
 int err=GetLastError();if(count<0||err!=0||count>4096){gBWNewsOK=false;gBWNewsError="CALENDAR_"+(string)err;return;}
 BWNewsItem rows[];
 for(int i=0;i<count;i++){
  MqlCalendarEvent ev;ResetLastError();if(!CalendarEventById(values[i].event_id,ev)){gBWNewsOK=false;gBWNewsError="NEWS_METADATA_WAIT";return;}
  if(ev.importance!=CALENDAR_IMPORTANCE_HIGH||ev.type==CALENDAR_TYPE_HOLIDAY)continue;
  if(ev.time_mode!=CALENDAR_TIMEMODE_DATETIME||values[i].time<=0){gBWNewsOK=false;gBWNewsError="NEWS_TIME_UNKNOWN";return;}
  BWNewsItem x;x.id=values[i].id;x.utc=(long)values[i].time-offset;x.known=now;x.name=StringSubstr(ev.name,0,180);
  for(int k=0;k<ArraySize(gBWNews);k++)if(gBWNews[k].id==x.id&&gBWNews[k].utc==x.utc){x.known=gBWNews[k].known;break;}
  bool dup=false;for(int k=0;k<ArraySize(rows);k++)if(rows[k].id==x.id){dup=true;break;}if(dup)continue;
  int n=ArraySize(rows);ArrayResize(rows,n+1);rows[n]=x;
 }
 BWNewsSort(rows);ArrayResize(gBWNews,ArraySize(rows));for(int i=0;i<ArraySize(rows);i++)gBWNews[i]=rows[i];
 gBWNewsFrom=from;gBWNewsTo=to;gBWNewsUpdated=now;gBWNewsOffset=offset;gBWNewsOK=true;gBWNewsError="";
}

bool BWNewsHealthy(const bool tester,const BW_NEWS_SOURCE source,const int maxCache,const bool autoOffset,const int fixedMinutes){
 if(!gBWNewsOK)return false;if(tester||source==BW_NEWS_LOCAL_CSV)return true;
 long now=BWNowUTC(false,autoOffset,fixedMinutes);
 return now>=gBWNewsUpdated&&now-gBWNewsUpdated<=maxCache&&BWServerOffset(false,autoOffset,fixedMinutes)==gBWNewsOffset;
}
string BWNewsNames(const long release){
 string s="";int n=0;for(int i=0;i<ArraySize(gBWNews);i++)if(gBWNews[i].utc==release){if(n<3)s+=(n?" + ":"")+gBWNews[i].name;n++;}
 if(n>3)s+=" + "+(string)(n-3)+" liyane";return s;
}
long BWNewsKnown(const long release){
 long known=0;for(int i=0;i<ArraySize(gBWNews);i++)if(gBWNews[i].utc==release)known=MathMax(known,gBWNews[i].known);return known;
}
bool BWSlotBlocked(const long slot,const int beforeMin,const int afterMin){
 for(int i=0;i<ArraySize(gBWNews);i++){
  long a=gBWNews[i].utc-beforeMin*60,b=gBWNews[i].utc+afterMin*60;
  if(slot<b&&slot+BW_STEP>a)return true;
 }return false;
}
long BWPickNewsRelease(const long now,const int preMin,const int postMin){
 long past=0,future=0;
 for(int i=0;i<ArraySize(gBWNews);i++){
  long r=gBWNews[i].utc;if(now<r-preMin*60||now>=r+postMin*60)continue;
  if(r<=now){if(r>past)past=r;}else if(future==0||r<future)future=r;
 }
 return past>0?past:future;
}

void BWAddRun(BWRun &runs[],const int dir,const long slot){
 int n=ArraySize(runs);
 if(n>0&&runs[n-1].dir==dir&&runs[n-1].end==slot){runs[n-1].end=slot+BW_STEP;return;}
 ArrayResize(runs,n+1);runs[n].dir=dir;runs[n].start=slot;runs[n].end=slot+BW_STEP;
}

BWNewsGate BWBuildNewsGate(const long now,const int preMin,const int postMin,const int blockBefore,const int blockAfter,
 const int entrySpan,const int minWindow,const bool accepted){
 BWNewsGate g;ZeroMemory(g);g.reason="NO_NEWS_EPISODE";
 long release=BWPickNewsRelease(now,preMin,postMin);if(release<=0)return g;
 g.episode=true;g.release=release;g.names=BWNewsNames(release);
 if(!accepted){g.reason="ASTRO_EXPERIMENT_NOT_ACCEPTED";return g;}
 if(!gBWAstroOK){g.reason=gBWAstroError;return g;}
 long known=BWNewsKnown(release);if(known>release){g.reason="NEWS_DISCOVERED_AFTER_RELEASE";return g;}
 long start=((release-preMin*60)/BW_STEP)*BW_STEP;
 long end=((release+postMin*60+BW_STEP-1)/BW_STEP)*BW_STEP;
 BWRun runs[];
 for(long t=start;t<end;t+=BW_STEP){
  int dir=BWAstroDir(t);bool can=t>=release&&!BWSlotBlocked(t,blockBefore,blockAfter)&&(dir==1||dir==-1);
  if(can)BWAddRun(runs,dir,t);
 }
 long buyMax=0,sellMax=0,buyTotal=0,sellTotal=0;
 for(int i=0;i<ArraySize(runs);i++){
  long d=runs[i].end-runs[i].start;if(d<minWindow*60)continue;
  if(runs[i].dir>0){buyTotal+=d;buyMax=MathMax(buyMax,d);}else{sellTotal+=d;sellMax=MathMax(sellMax,d);}
 }
 int focus=0;
 if(buyMax>sellMax||(buyMax==sellMax&&buyTotal>sellTotal))focus=1;
 else if(sellMax>buyMax||(sellMax==buyMax&&sellTotal>buyTotal))focus=-1;
 if(focus==0||MathMax(buyMax,sellMax)==0){g.reason="ASTRO_NEWS_NO_FOCUS";return g;}
 g.dir=focus;
 for(int i=0;i<ArraySize(runs);i++){
  long d=runs[i].end-runs[i].start;if(runs[i].dir!=focus||d<minWindow*60)continue;
  long entryEnd=MathMin(runs[i].end,runs[i].start+entrySpan*60);
  if(now>=runs[i].start&&now<entryEnd){
   g.candidate=true;g.windowStart=runs[i].start;g.entryEnd=entryEnd;g.reason="ASTROLOGY_NEWS "+BWSide(focus);return g;
  }
 }
 g.reason="ASTRO_NEWS_WAIT_WINDOW";return g;
}
#endif
