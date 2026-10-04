// News calendar adapter + event caps; depends on the unchanged Combined 2 price core.
enum C2_RUN_MODE { C2_NORMAL_ONLY=0,C2_NEWS_ONLY=1,C2_NORMAL_AND_NEWS=2 };
enum C2_NEWS_SOURCE { C2_NEWS_MT5_CALENDAR=0,C2_NEWS_LOCAL_CSV=1 };
input group "05 | NEWS ATTACK - USD HIGH IMPACT"
input C2_RUN_MODE InpRunMode=C2_NORMAL_AND_NEWS;
input C2_NEWS_SOURCE InpNewsSource=C2_NEWS_MT5_CALENDAR;
input int InpNewsPreBlockMinutes=10;
input int InpNewsStartAfterMinutes=2;
input int InpNewsEndAfterMinutes=15;
input int InpNewsM5MaxAgeMinutes=60;
input int InpNewsPollSeconds=60;
input int InpNewsMaxCacheSeconds=180;
input string InpNewsCSV="CEBONK_C2_NEWS.csv";
input bool InpAllowNewsCSVReplay=false; // explicit tester opt-in to retrospective calendar snapshot
input group "06 | TELEGRAM STYLE"
input string InpTelegramBrand="SEKTE MUSANG - CEBONK COMPANY 22";

C2NewsItem gNews[];
long gNewsFrom=0,gNewsTo=0,gNewsUpdated=0,gNewsNextPoll=0,gNewsBar=0,gNewsPhaseRelease=0;
int gNewsOffset=0,gNewsPhase=-1;
bool gNewsOK=false;
string gNewsError="NEWS_NOT_LOADED",gLastNewsStatus="",gNewsSkipped="";
long gNewsAttempted[];
ulong gNewsAttemptIDs[];
bool gSentIsNews=false;
long gSentRelease=0;
string gSentNewsName="";
ulong gSentOrder=0;
double gSentQuote=0;

bool NewsEnabled() { return InpRunMode!=C2_NORMAL_ONLY; }
string ModeName(const bool news) { return news?"NEWS ATTACK | M1 + M5":"NORMAL | "+TFName(); }
int NewsPre() { return InpNewsPreBlockMinutes*60; }
int NewsDelay() { return InpNewsStartAfterMinutes*60; }
int NewsFinish() { return InpNewsEndAfterMinutes*60; }
bool NewsHealthy() {
 if(!gNewsOK)return false;
 if(gTester)return true; // CSV coverage is still mandatory; tester uses explicit retrospective replay
 if(InpNewsSource==C2_NEWS_LOCAL_CSV)return NowUTC()-gNewsUpdated<=InpNewsMaxCacheSeconds;
 return NowUTC()>=gNewsUpdated&&NowUTC()-gNewsUpdated<=InpNewsMaxCacheSeconds&&ServerOffset()==gNewsOffset;
}
int NewsRoute(const long at,int &index) {
 return C2NewsRoute(gNews,at,gNewsFrom,gNewsTo,NewsHealthy(),NewsPre(),NewsDelay(),NewsFinish(),index);
}
string NewsNames(const long release) {
 string names="";int count=0;
 for(int i=0;i<ArraySize(gNews);i++)if(gNews[i].utc==release){
  if(count<3)names+=(count>0?" + ":"")+gNews[i].name;count++;
 }
 if(count>3)names+=" + "+(string)(count-3)+" event liyane";
 return names;
}
void NewsStatus(const bool ok,const string error) {
 gNewsOK=ok;gNewsError=error;
 string status=ok?"READY":error;if(status==gLastNewsStatus)return;gLastNewsStatus=status;
 Notice(ok?"NEWS_READY":"NEWS_DATA_WAIT",ok?
  "Kalender USD HIGH siap. News mung patokan wektu; BUY/SELL tetep Astrology.":
  error+"\nMode sing nganggo news: ora ana entry anyar nganti data valid.","NEWS ATTACK");
}
void NewsSort(C2NewsItem &items[]) {
 for(int i=1;i<ArraySize(items);i++){C2NewsItem x=items[i];int j=i-1;
  while(j>=0&&(items[j].utc>x.utc||(items[j].utc==x.utc&&items[j].id>x.id))){items[j+1]=items[j];j--;}items[j+1]=x;
 }
}
bool NewsValueID(const string text,ulong &value) {
 value=0;if(StringLen(text)<1||StringLen(text)>20)return false;
 for(int i=0;i<StringLen(text);i++){
  ushort ch=StringGetCharacter(text,i);if(ch<48||ch>57)return false;ulong digit=(ulong)(ch-48);
  if(value>(ULONG_MAX-digit)/10)return false;value=value*10+digit;
 }return value>0;
}
bool NewsCSV() {
 if(gTester&&!InpAllowNewsCSVReplay){NewsStatus(false,"TESTER_REQUIRES_EXPLICIT_NEWS_CSV_REPLAY");return false;}
 int flags=FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ;if(InpCSVCommonFolder&&!gTester)flags|=FILE_COMMON;
 int f=FileOpen(InpNewsCSV,flags,0,CP_UTF8);if(f==INVALID_HANDLE){NewsStatus(false,"NEWS_CSV_NOT_FOUND");return false;}
 if(FileSize(f)>8000000){FileClose(f);NewsStatus(false,"NEWS_CSV_TOO_LARGE");return false;}
 string head=FileReadString(f);StringTrimRight(head);if(StringLen(head)>0&&StringGetCharacter(head,0)==65279)head=StringSubstr(head,1);
 string meta[];bool valid=StringSplit(head,44,meta)==5;
 long from=0,to=0,exported=0;int expected=-1;
 if(valid)valid=meta[0]=="CEBONK_NEWS_V1"&&DigitsOnly(meta[1])&&DigitsOnly(meta[2])&&DigitsOnly(meta[3])&&DigitsOnly(meta[4]);
 if(valid){from=StringToInteger(meta[1]);to=StringToInteger(meta[2]);exported=StringToInteger(meta[3]);long declared=StringToInteger(meta[4]);expected=declared<=20000?(int)declared:-1;
  valid=from>=946684800&&to>from&&to-from<=370*86400&&exported>=946684800&&expected>=0&&expected<=20000;
  if(!gTester&&exported>NowUTC()+60)valid=false;
 }
 string header=FileReadString(f);StringTrimRight(header);
 valid=valid&&header=="value_id,release_epoch,currency,importance,name";
 C2NewsItem rows[];
 while(valid&&!FileIsEnding(f)){
  string line=FileReadString(f);StringTrimRight(line);if(line=="")continue;string v[];
  if(StringSplit(line,44,v)!=5||!DigitsOnly(v[1])||v[2]!="USD"||v[3]!="HIGH"||StringLen(v[4])<1||StringLen(v[4])>180){valid=false;break;}
  C2NewsItem row;if(!NewsValueID(v[0],row.id)){valid=false;break;}row.utc=StringToInteger(v[1]);row.known=gTester?0:exported;row.name=v[4];
  if(row.id==0||row.utc<from||row.utc>=to){valid=false;break;}
  for(int k=0;k<ArraySize(rows);k++)if(rows[k].id==row.id){valid=false;break;}
  if(!valid||ArraySize(rows)>=20000){valid=false;break;}int n=ArraySize(rows);ArrayResize(rows,n+1);rows[n]=row;
 }
 FileClose(f);
 if(!valid||ArraySize(rows)!=expected){NewsStatus(false,"NEWS_CSV_INVALID_OR_INCOMPLETE");return false;}
 NewsSort(rows);ArrayResize(gNews,ArraySize(rows));for(int i=0;i<ArraySize(rows);i++)gNews[i]=rows[i];
 gNewsFrom=from;gNewsTo=to;gNewsUpdated=NowUTC();NewsStatus(true,"");return true;
}
void PollNews() {
 if(!NewsEnabled()||gTester)return;
 long now=NowUTC();if(now<gNewsNextPoll)return;gNewsNextPoll=now+InpNewsPollSeconds;
 if(InpNewsSource==C2_NEWS_LOCAL_CSV){NewsCSV();return;}
 int offset=ServerOffset();long from=now-NewsFinish()-PeriodSeconds(InpExecutionTF)-300,to=now+86400+NewsPre();
 MqlCalendarValue values[];ResetLastError();int count=CalendarValueHistory(values,(datetime)(from+offset),(datetime)(to+offset),NULL,"USD");
 int error=GetLastError();
 if(count<0||error!=0||count>4096){NewsStatus(false,"CALENDAR_HISTORY_ERROR_"+(string)error);return;}
 C2NewsItem rows[];
 for(int i=0;i<count;i++){
  MqlCalendarEvent event;ResetLastError();
  if(!CalendarEventById(values[i].event_id,event)){NewsStatus(false,"CALENDAR_EVENT_METADATA_MISSING");return;}
  if(event.importance!=CALENDAR_IMPORTANCE_HIGH||event.type==CALENDAR_TYPE_HOLIDAY)continue;
  if(event.time_mode!=CALENDAR_TIMEMODE_DATETIME||values[i].time<=0){NewsStatus(false,"HIGH_NEWS_EXACT_TIME_UNKNOWN");return;}
  long utc=(long)values[i].time-offset;if(utc<from||utc>=to)continue;
  C2NewsItem item;item.id=values[i].id;item.utc=utc;item.known=now;item.name=StringSubstr(event.name,0,180);
  if(item.id==0||item.name==""){NewsStatus(false,"CALENDAR_EVENT_INVALID");return;}
  for(int k=0;k<ArraySize(gNews);k++)if(gNews[k].id==item.id&&gNews[k].utc==utc){item.known=gNews[k].known;break;}
  bool duplicate=false;for(int k=0;k<ArraySize(rows);k++)if(rows[k].id==item.id){duplicate=true;break;}
  if(duplicate)continue;int n=ArraySize(rows);ArrayResize(rows,n+1);rows[n]=item;
 }
 if(ServerOffset()!=offset){NewsStatus(false,"SERVER_UTC_OFFSET_CHANGED");return;}
 NewsSort(rows);ArrayResize(gNews,ArraySize(rows));for(int i=0;i<ArraySize(rows);i++)gNews[i]=rows[i];
 gNewsFrom=from;gNewsTo=to;gNewsUpdated=now;gNewsOffset=offset;NewsStatus(true,"");
}
bool NewsUsed(const long release) {
 for(int i=0;i<ArraySize(gNewsAttempted);i++)if(gNewsAttempted[i]==release)return true;
 if(!gTester&&GlobalVariableCheck(gScope+"NEWS.G."+(string)release))return true;
 for(int i=0;i<ArraySize(gNews);i++)if(gNews[i].utc==release){
  for(int k=0;k<ArraySize(gNewsAttemptIDs);k++)if(gNewsAttemptIDs[k]==gNews[i].id)return true;
  if(!gTester&&GlobalVariableCheck(gScope+"NEWS.I."+(string)gNews[i].id))return true;
 }
 return false;
}
void ReserveNews(const long release) {
 int n=ArraySize(gNewsAttempted);ArrayResize(gNewsAttempted,n+1);gNewsAttempted[n]=release;
 if(!gTester)GlobalVariableSet(gScope+"NEWS.G."+(string)release,(double)NowUTC());
 for(int i=0;i<ArraySize(gNews);i++)if(gNews[i].utc==release){
  int k=ArraySize(gNewsAttemptIDs);ArrayResize(gNewsAttemptIDs,k+1);gNewsAttemptIDs[k]=gNews[i].id;
  if(!gTester)GlobalVariableSet(gScope+"NEWS.I."+(string)gNews[i].id,(double)NowUTC());
 }
 if(!gTester)GlobalVariablesFlush(); // reserve BEFORE OrderSend; timeout/reject cannot produce second attack
}
void NewsHeartbeat() {
 static long checked=0;if(!NewsEnabled()||checked==NowUTC())return;checked=NowUTC();int index;long now=NowUTC();int phase=NewsRoute(now,index),sub=phase;
 long release=index>=0?gNews[index].utc:0;
 if(phase==C2_NEWS_LOCK)sub=now<release?10:11;
 if(sub==gNewsPhase&&release==gNewsPhaseRelease)return;
 if(gNewsPhaseRelease>0&&now>=gNewsPhaseRelease+NewsFinish())
  Notice("NEWS_WINDOW_END","Jendela news rampung. Ora ana entry telat / ngejar spike. Posisi sing wis mbukak tetep nganggo SL/TP.","NEWS ATTACK");
 gNewsPhase=sub;gNewsPhaseRelease=release;
 if(phase==C2_NEWS_DATA_WAIT){Block("NEWS_DATA_WAIT: "+gNewsError);return;}
 if(index<0)return;
 string details=NewsNames(release)+"\nRelease: "+WIB(release)+"\nWindow: "+WIB(release+NewsDelay())+" -> "+WIB(release+NewsFinish())+" (akhir eksklusif)";
 if(sub==10)Notice("NEWS_ARMED",details+"\nPre-news lock. Ora ana order anyar.","NEWS ATTACK");
 else if(sub==11)Notice("NEWS_COOLDOWN",details+"\nNgenteni cooldown. Wektu iki aturan risiko, dudu ramalan spike rampung.","NEWS ATTACK");
 else if(phase==C2_NEWS_ATTACK)Notice("NEWS_ATTACK_OPEN",details+"\nMung entry yen Astrology + lokasi + M5 konfirmasi + retest M1 lengkap. Maksimal 1 percobaan order saben wektu release.","NEWS ATTACK");
 else if(phase==C2_NEWS_LATE)Notice("NEWS_SKIPPED",details+"\nJadwal anyar ditampa sawise release; event iki ora diserang.","NEWS ATTACK");
}
bool NewsGate(const bool news,const C2Event &s,long &release) {
 release=0;if(!NewsEnabled())return !news;
 long now=NowUTC(),start=ServerToUTC(s.eventStart);int index;int phase=NewsRoute(now,index);
 if(phase==C2_NEWS_DATA_WAIT){Block("NEWS_CALENDAR_NOT_READY_OR_OUTSIDE_COVERAGE");return false;}
 if(!news){
  if(gNewsFrom>start-NewsFinish()||phase!=C2_NEWS_NORMAL||!C2NewsNormalRange(gNews,start,now,NewsPre(),NewsFinish())){Block("NORMAL_PAUSED_DURING_NEWS_EPISODE");return false;}
  return true;
 }
 if(phase!=C2_NEWS_ATTACK||index<0){Block("NEWS_NOT_IN_ATTACK_WINDOW");return false;}
 release=gNews[index].utc;
 int initial;int phaseAtStart=NewsRoute(start,initial);
 if(phaseAtStart!=C2_NEWS_ATTACK||initial<0||gNews[initial].utc!=release||
   !C2NewsTriggerTime(start,ServerToUTC(s.eventEnd),now,ServerToUTC(s.breakAt),release,NewsDelay(),NewsFinish())){
  Block("NEWS_TRIGGER_OUTSIDE_WINDOW_OR_CB1_BEFORE_RELEASE");return false;
 }
 if(NewsUsed(release)){Block("NEWS_EVENT_ALREADY_ATTEMPTED");return false;}return true;
}
bool NewsM5Confirm(const C2Event &s,C2Event &confirmation) {
 C2Bar b[];if(!LoadBars(PERIOD_M5,InpExecutionBars,s.eventStart,b)){Block("NEWS_M5_HISTORY_NOT_READY");return false;}
 int n=ArraySize(b);if(s.eventStart-b[n-1].end>=300){Block("NEWS_M5_DATA_STALE");return false;}
 C2Musang(b,300,s.eventStart,confirmation);
 if(!C2NewsM5Policy(confirmation,s.dir,b[n-1].close,s.eventStart,InpNewsM5MaxAgeMinutes*60)){
  Block("NEWS_M5_IB_CB1_CONFIRMATION_NOT_ALIGNED");return false;
 }return true;
}
bool NetworkSlot() {
 if(gTester)return false;
 int phase=(int)((long)TimeCurrent()%60);
 return phase>=20&&phase<=45; // keep synchronous HTTP/calendar away from first ticks of a new M1 bar
}
bool ValidateNewsInputs() {
 return InpRunMode>=C2_NORMAL_ONLY&&InpRunMode<=C2_NORMAL_AND_NEWS&&InpNewsPreBlockMinutes>=0&&InpNewsPreBlockMinutes<=120&&
  InpNewsStartAfterMinutes>=1&&InpNewsEndAfterMinutes>InpNewsStartAfterMinutes&&InpNewsEndAfterMinutes<=120&&
  InpNewsM5MaxAgeMinutes>=5&&InpNewsM5MaxAgeMinutes<=240&&InpNewsPollSeconds>=15&&InpNewsPollSeconds<=120&&
  InpNewsMaxCacheSeconds>=InpNewsPollSeconds&&InpNewsMaxCacheSeconds<=600&&StringLen(InpTelegramBrand)>0&&StringLen(InpTelegramBrand)<=90;
}
