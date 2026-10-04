// CEBONK COMPANY 22 | COMBINED 2 | v1.00
// Astrology -> native MN1/W1/D1/H4/H1 SND/SNR -> Musang closed retest.
// NO Combined 1 modification; NO MA/ATR direction filter; NO recovery/BE/trailing.
#property strict
#property version "1.00"
#property description "COMBINED 2: default M5. Demo verification required; astrology is experimental."
#property tester_file "CEBONK_C2_ASTRO.csv"
// CEBONK COMBINED 2 native core v1.00.
// Port of auto-combined-core v3.1.0 and snd-auto-core at 35ce78b4.
// Engineering subset of PDF Level 2, NOT every discretionary workbook setup.
#ifndef CEBONK_C2_CORE
#define CEBONK_C2_CORE
struct C2Bar { long time,end; double open,high,low,close; };
struct C2Pivot { int i,kind; long known; double price; }; // kind: 1 high, -1 low
struct C2Zone {
 int tf,dir,kind,status,tests; // kind 0=SNR,1=SND; status 0=fresh,1=tested,2=broken,3=gap
 long origin,born,departed; double low,high,scale;
};
struct C2Key { int tf; long source,known; double price; };
struct C2Rank { int conf,nested,keys; };
enum C2_STAGE { C2_NONE=0,C2_WAIT_BREAK=1,C2_WAIT_RETEST=2,C2_VALID=3,C2_EXPIRED=4,C2_INVALID=5,C2_AMBIGUOUS=6,C2_GAP=7,C2_EARLY_BREAK=8,C2_CONFLICT=9 };
struct C2Event {
 int stage,dir; long first,extreme,ib,known,eventStart,eventEnd,expires,breakAt;
 double low,high,cb,distal,sl,fib0,fib100,entry,tp1,tp2,tp3;
};
bool C2Overlap(const double al,const double ah,const double bl,const double bh) { return al<=bh&&ah>=bl; }
bool C2PivotAt(const C2Bar &b[],const int i,const int kind) {
 int n=ArraySize(b);if(i<2||i+2>=n)return false;
 for(int k=1;k<=2;k++){
  if(kind==1&&(b[i].high<=b[i-k].high||b[i].high<=b[i+k].high))return false;
  if(kind==-1&&(b[i].low>=b[i-k].low||b[i].low>=b[i+k].low))return false;
 }return true;
}
void C2Pivots(const C2Bar &b[],C2Pivot &out[]) {
 ArrayResize(out,0);
 for(int i=2;i<ArraySize(b)-2;i++)for(int pass=0;pass<2;pass++){
  int kind=pass==0?1:-1;if(!C2PivotAt(b,i,kind))continue;
  int n=ArraySize(out);ArrayResize(out,n+1);out[n].i=i;out[n].kind=kind;
  out[n].known=b[i+2].end;out[n].price=kind==1?b[i].high:b[i].low;
 }
}
bool C2Contiguous(const C2Bar &b[],const int from,const int to,const int step) {
 for(int i=from+1;i<=to;i++)if(b[i].time-b[i-1].time!=step)return false;return true;
}
void C2Evaluate(C2Event &s,const C2Bar &b[],const int start,const int step,const long now) {
 s.stage=C2_WAIT_BREAK;int broken=-1,event=-1,n=ArraySize(b);
 if(!C2Contiguous(b,start,n-1,step)){s.stage=C2_GAP;return;}
 for(int i=start;i<n;i++){
  if(s.dir==1?b[i].close<s.distal:b[i].close>s.distal){s.stage=C2_INVALID;return;}
  if(broken<0&&(s.dir==1?b[i].close>s.cb:b[i].close<s.cb)){
   if(b[i].end<s.known){s.stage=C2_EARLY_BREAK;return;}
   broken=i;continue;
  }
  if(broken>=0&&b[i].time>=b[broken].end&&b[i].time>=s.known&&C2Overlap(b[i].low,b[i].high,s.low,s.high)){event=i;break;}
 }
 if(broken<0)return;
 s.fib100=b[broken].close;s.breakAt=b[broken].end;
 if(s.dir*(s.fib100-s.fib0)<=0){s.stage=C2_INVALID;return;}
 if(event<0){s.stage=C2_WAIT_RETEST;return;}
 s.entry=s.dir==1?MathMin(s.high,b[event].high):MathMax(s.low,b[event].low);
 s.eventStart=b[event].time;s.eventEnd=b[event].end;s.expires=s.eventEnd+step;
 double range=s.fib100-s.fib0;
 s.tp1=s.fib0+1.618*range;s.tp2=s.fib0+2.618*range;s.tp3=s.fib0+4.23*range;
 bool hitSL=s.dir==1?b[event].low<=s.sl:b[event].high>=s.sl;
 bool hitTP=s.dir==1?(b[event].high>=s.tp1||b[event].high>=s.tp2||b[event].high>=s.tp3):(b[event].low<=s.tp1||b[event].low<=s.tp2||b[event].low<=s.tp3);
 if(hitSL||hitTP){s.stage=C2_AMBIGUOUS;return;}
 if(s.dir*(s.entry-s.sl)<=0||s.dir*(s.tp1-s.entry)<=0||s.dir*(s.tp2-s.entry)<=0||s.dir*(s.tp3-s.entry)<=0){s.stage=C2_INVALID;return;}
 if(now<s.eventEnd||now>=s.expires||event!=n-1){s.stage=C2_EXPIRED;return;}
 s.stage=C2_VALID;
}
void C2Musang(const C2Bar &b[],const int step,const long now,C2Event &out) {
 ZeroMemory(out);int n=ArraySize(b);if(n<6)return;
 C2Pivot p[];C2Pivots(b,p);C2Event live,waiting,other;ZeroMemory(live);ZeroMemory(waiting);ZeroMemory(other);
 bool hasLive=false,hasWait=false,hasOther=false,conflict=false;
 for(int pass=0;pass<2;pass++){
  int kind=pass==0?1:-1,previous=-1,dir=pass==0?-1:1;
  for(int q=0;q<ArraySize(p);q++){
   if(p[q].kind!=kind)continue;int prev=previous;previous=q;if(prev<0)continue;
   int first=p[prev].i,last=p[q].i;
   if(dir==1?p[q].price>=p[prev].price:p[q].price<=p[prev].price)continue;
   int mid=-1;
   for(int m=0;m<ArraySize(p);m++)if(p[m].kind!=kind&&p[m].i>first&&p[m].i<last)
    if(mid<0||(dir==1?p[m].price>p[mid].price:p[m].price<p[mid].price))mid=m;
   if(mid<0)continue;
   for(int j=last+1;j<n&&j<last+25;j++){
    double low=MathMin(b[j-1].open,b[j-1].close),high=MathMax(b[j-1].open,b[j-1].close);
    bool ib=dir==1?(b[j-1].close<b[j-1].open&&b[j].close>b[j].open&&b[j].close>high):(b[j-1].close>b[j-1].open&&b[j].close<b[j].open&&b[j].close<low);
    if(low==high||!ib||!(dir==1?p[mid].price>high:p[mid].price<low)||!C2Contiguous(b,first,j,step))continue;
    C2Event s;ZeroMemory(s);s.dir=dir;s.first=b[first].time;s.extreme=b[last].time;s.ib=b[j].time;
    s.known=(long)MathMax(MathMax(p[q].known,p[mid].known),b[j].end);
    s.low=low;s.high=high;s.cb=p[mid].price;s.distal=dir==1?b[j-1].low:b[j-1].high;
    s.sl=s.distal-dir*0.05*(high-low);s.fib0=dir==1?low:high;
    C2Evaluate(s,b,j,step,now);
    if(!hasOther||s.known>other.known){other=s;hasOther=true;}
    if(s.stage==C2_WAIT_BREAK||s.stage==C2_WAIT_RETEST)if(!hasWait||s.known>waiting.known){waiting=s;hasWait=true;}
    if(s.stage==C2_VALID){
     if(hasLive&&live.dir!=s.dir)conflict=true;
     if(!hasLive||s.known>live.known){live=s;hasLive=true;}
    }
    break;
   }
  }
 }
 if(conflict){out.stage=C2_CONFLICT;return;}
 if(hasLive)out=live;else if(hasWait)out=waiting;else if(hasOther)out=other;
}
double C2MedianRange(const C2Bar &b[],const int at) {
 double v[];ArrayResize(v,0);
 for(int i=at-20;i<at;i++)if(i>=0&&b[i].high>b[i].low){int n=ArraySize(v);ArrayResize(v,n+1);v[n]=b[i].high-b[i].low;}
 int n=ArraySize(v);if(n==0)return 0;ArraySort(v);
 return (v[(n-1)/2]+v[n/2])/2;
}
bool C2LargeGap(const C2Bar &a,const C2Bar &b,const int tf) {
 long gap=b.time-a.end;if(gap<=0)return false;
 if(tf==0)return gap>5*86400; // MN1
 if(tf==1||tf==2)return gap>3*86400; // W1 / D1
 int day=(int)((a.end/86400+4)%7);
 return !(gap<=3*86400&&(day==5||day==6||day==0));
}
void C2Life(C2Zone &z,const C2Bar &b[]) {
 bool visit=false;z.status=0;z.tests=0;
 for(int i=0;i<ArraySize(b);i++){
  if(b[i].time<=z.origin||b[i].end<=z.departed)continue;
  if(z.dir==1?b[i].close<z.low:b[i].close>z.high){z.status=2;return;}
  bool hit=C2Overlap(z.low,z.high,b[i].low,b[i].high);
  if(hit&&!visit)z.tests++;visit=hit;
 }
 int previous=-1;
 for(int i=0;i<ArraySize(b);i++)if(b[i].end>=z.departed){
  if(previous>=0&&C2LargeGap(b[previous],b[i],z.tf)){z.status=3;return;}previous=i;
 }
 if(z.tests>0)z.status=1;
}
void C2Zones(const C2Bar &b[],const int tf,C2Zone &all[]) {
 int n=ArraySize(b);
 for(int i=20;i<n-2;i++){
  double median=C2MedianRange(b,i);if(median<=0)continue;
  for(int pass=0;pass<2;pass++){
   int dir=pass==0?1:-1;if(!C2PivotAt(b,i,-dir))continue;
   double extreme=dir==1?b[i].low:b[i].high;
   double edge=dir==1?MathMin(b[i].open,b[i].close):MathMax(b[i].open,b[i].close);
   double width=MathMin(.5*median,MathMax(.08*median,MathAbs(extreme-edge)));
   double low=dir==1?extreme:extreme-width,high=dir==1?extreme+width:extreme;
   int departure=-1,impulse=-1;
   for(int j=i+1;j<n&&j<i+4;j++){
    if(departure<0&&(dir==1?b[j].close>high:b[j].close<low))departure=j;
    if(impulse<0&&(dir==1?(b[j].close>b[i].high&&b[j].close-high>=1.5*median):(b[j].close<b[i].low&&low-b[j].close>=1.5*median)))impulse=j;
   }
   if(departure<0)continue;
   for(int kind=0;kind<2;kind++){
    if(kind==1&&impulse<0)continue;
    C2Zone z;ZeroMemory(z);z.tf=tf;z.dir=dir;z.kind=kind;z.low=low;z.high=high;z.scale=median;
    z.origin=b[i].time;z.departed=b[departure].end;
    z.born=(long)MathMax(b[i+2].end,kind==1?b[impulse].end:b[departure].end);
    C2Life(z,b);int size=ArraySize(all);ArrayResize(all,size+1,128);all[size]=z;
   }
  }
 }
}
void C2Keys(const C2Bar &b[],const int tf,C2Key &out[]) {
 int n=ArraySize(b);if(n==0)return;
 if(tf<=2)for(int k=0;k<2;k++){
  C2Key key;key.tf=tf;key.price=k==0?b[n-1].high:b[n-1].low;key.known=b[n-1].end;key.source=b[n-1].time;
  int size=ArraySize(out);ArrayResize(out,size+1);out[size]=key;
 }
 C2Pivot p[];C2Pivots(b,p);int start=(int)MathMax(0,ArraySize(p)-12);
 for(int i=start;i<ArraySize(p);i++){
  C2Key key;key.tf=tf;key.source=b[p[i].i].time;key.known=p[i].known;key.price=p[i].price;
  int size=ArraySize(out);ArrayResize(out,size+1);out[size]=key;
 }
}
bool C2Eligible(const C2Zone &z,const long at) { return z.born<=at&&z.status<2&&z.tests<=1; }
void C2RankOf(const C2Zone &z,const C2Zone &all[],const C2Key &keys[],const long at,C2Rank &r) {
 ZeroMemory(r);bool conf[5],nested[5];ArrayInitialize(conf,false);ArrayInitialize(nested,false);
 for(int i=0;i<ArraySize(all);i++){
  if(!C2Eligible(all[i],at)||all[i].tf==z.tf||all[i].dir!=z.dir||!C2Overlap(z.low,z.high,all[i].low,all[i].high))continue;
  int tf=all[i].tf;conf[tf]=true;
  if((z.low>=all[i].low&&z.high<=all[i].high)||(all[i].low>=z.low&&all[i].high<=z.high))nested[tf]=true;
 }
 for(int i=0;i<5;i++){if(conf[i])r.conf++;if(nested[i])r.nested++;}
 double tolerance=(z.high-z.low)*.1;
 for(int i=0;i<ArraySize(keys);i++)if(keys[i].known<=at&&keys[i].price>=z.low-tolerance&&keys[i].price<=z.high+tolerance&&!(keys[i].tf==z.tf&&keys[i].source==z.origin))r.keys++;
}
bool C2Better(const C2Zone &a,const C2Rank &ar,const C2Zone &b,const C2Rank &br) {
 if(a.status!=b.status)return a.status<b.status;
 if(ar.conf!=br.conf)return ar.conf>br.conf;
 if(ar.nested!=br.nested)return ar.nested>br.nested;
 if(a.kind!=b.kind)return a.kind>b.kind;
 if(ar.keys!=br.keys)return ar.keys>br.keys;
 return a.born>b.born; // all eligible candidates contain the same retest price: distance zero
}
bool C2Select(const C2Zone &all[],const C2Key &keys[],const int dir,const double price,const long at,C2Zone &selected,C2Rank &rank,bool &opposed) {
 bool found=false;opposed=false;ZeroMemory(selected);ZeroMemory(rank);
 for(int i=0;i<ArraySize(all);i++){
  if(!C2Eligible(all[i],at)||price<all[i].low||price>all[i].high)continue;
  if(all[i].dir!=dir){opposed=true;continue;}
  C2Rank r;C2RankOf(all[i],all,keys,at,r);
  if(!found||C2Better(all[i],r,selected,rank)){selected=all[i];rank=r;found=true;}
 }return found;
}
#endif


enum C2_ASTRO_SOURCE { C2_ASTRO_WEB_CSV=0,C2_ASTRO_LOCAL_CSV=1 };
enum C2_TARGET { C2_TP_1618=0,C2_TP_2618=1,C2_TP_423=2 };
input group "01 | EXECUTION"
input string InpSymbol="XAUUSDc";
input ulong InpMagic=220202;
input ENUM_TIMEFRAMES InpExecutionTF=PERIOD_M5;
input bool InpAutopilot=false;
input bool InpAllowRealAccount=false;
input bool InpAcceptExperimentalAstro=false;
input double InpFixedLot=0.01;
input int InpMaxSpreadPoints=70;
input int InpDeviationPoints=30;
input double InpMaxTradeRiskPct=1.0; // 0 disables cap; fixed lot NEVER increased
input double InpMinRR=0.0; // 0 = structural Fibonacci, not forced 1:2
input C2_TARGET InpTarget=C2_TP_2618;
input double InpMaxDriftR=0.25; // actual quote vs reference retest, fraction of planned risk
input int InpMaxEntryDelaySeconds=15; // after the retest candle CLOSE; never backdated
input group "02 | NATIVE BROKER SCANNER"
input int InpExecutionBars=500;
input int InpContextBars=300;
input int InpMonthlyBars=120;
input bool InpRequireAllFiveTF=false; // partial coverage explicit, at least one healthy TF
input group "03 | ASTROLOGY SCHEDULE"
input C2_ASTRO_SOURCE InpAstroSource=C2_ASTRO_WEB_CSV;
input string InpAstroBaseURL="https://enggarprasetiyodaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/ea/combined2/data/";
input string InpAstroCSV="CEBONK_C2_ASTRO.csv";
input bool InpCSVCommonFolder=false;
input int InpHTTPTimeoutMs=3000;
input bool InpLiveAutoServerUTC=true;
input int InpServerUTCMinutes=180; // tester ALWAYS uses this fixed offset: verify historical broker DST
input group "04 | TELEGRAM / MT5"
input bool InpTelegram=true;
input string InpTelegramToken="";
input string InpTelegramChatID="";
input bool InpMT5Push=true;
input bool InpTelegramTestOnStart=true;
input bool InpWriteAuditCSV=true;

#define C2_MODEL "CEBONK_C2_WEB_V1_35ce78b4"
struct C2Astro { long from,to; int dir; string id; };
struct C2Message { string event,text; int tries; bool pushed; };
C2Astro gSchedule[];
C2Message gQueue[];
ENUM_TIMEFRAMES gFrames[5]={PERIOD_MN1,PERIOD_W1,PERIOD_D1,PERIOD_H4,PERIOD_H1};
string gTFNames[5]={"MN1","W1","D1","H4","H1"};
bool gTester=false,gAuto=false,gHaveSent=false;
long gArmedAt=0,gBar=0,gNextAstro=0,gNextNotify=0;
int gLock=INVALID_HANDLE,gDigits=2;
string gScope,gButton,gLastBlock="",gMonth="",gScheduleError="ASTRO_NOT_LOADED";
C2Event gSent;
C2Zone gSentZone;
double gSentSL=0,gSentTP=0;

string Side(const int dir) { return dir==1?"BUY":dir==-1?"SELL":"WAIT"; }
string ZoneKind(const C2Zone &z) { return z.kind==1?(z.dir==1?"DEMAND":"SUPPLY"):(z.dir==1?"SUPPORT":"RESISTANCE"); }
string ZoneStatus(const C2Zone &z) { return z.status==0?"FRESH":z.status==1?"TESTED":z.status==2?"BROKEN":"DATA_GAP"; }
string TFName() { string s=EnumToString(InpExecutionTF);StringReplace(s,"PERIOD_","");return s; }
string Price(const double p) { return DoubleToString(p,gDigits); }
bool Fin(const double v) { return MathIsValidNumber(v)&&v!=EMPTY_VALUE; }
uint Hash(const string s) { uint h=2166136261;for(int i=0;i<StringLen(s);i++){h^=(uint)StringGetCharacter(s,i);h*=16777619;}return h; }
int ServerOffset() {
 if(gTester||!InpLiveAutoServerUTC)return InpServerUTCMinutes*60;
 long diff=(long)TimeTradeServer()-(long)TimeGMT();return (int)MathRound((double)diff/900.0)*900;
}
long ServerToUTC(const long t) { return t-ServerOffset(); }
long NowUTC() { return gTester?ServerToUTC((long)TimeCurrent()):(long)TimeGMT(); }
string WIB(const long t) { return TimeToString((datetime)(t+7*3600),TIME_DATE|TIME_SECONDS)+" WIB"; }
string MonthUTC(const long t) { MqlDateTime d;TimeToStruct((datetime)(t+7*3600),d);return StringFormat("%04d-%02d",d.year,d.mon); }
string Q(const string s) {
 string out="\"";for(int i=0;i<StringLen(s);i++){
  ushort c=StringGetCharacter(s,i);
  if(c==34)out+="\\\"";else if(c==92)out+="\\\\";else if(c==10)out+="\\n";
  else if(c==13)out+="\\r";else if(c==9)out+="\\t";else if(c<32)out+=StringFormat("\\u%04X",(int)c);else out+=ShortToString(c);
 }return out+"\"";
}
void Block(const string s) {
 if(gLastBlock==s)return;gLastBlock=s;Print("COMBINED2 | ",s);
 if(ObjectFind(0,gButton)>=0)ObjectSetString(0,gButton,OBJPROP_TOOLTIP,s);
}
void Audit(const string event,const string text) {
 Print("{\"mode\":\"COMBINED_2\",\"event\":"+Q(event)+",\"symbol\":"+Q(InpSymbol)+",\"utc\":"+(string)NowUTC()+",\"detail\":"+Q(text)+"}");
 if(!InpWriteAuditCSV)return;
 string file="CEBONK_C2_AUDIT_"+(string)AccountInfoInteger(ACCOUNT_LOGIN)+(gTester?"_TEST":"_LIVE")+".csv";
 int f=FileOpen(file,FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_SHARE_READ,',',CP_UTF8);
 if(f==INVALID_HANDLE)return;
 if(FileSize(f)==0)FileWrite(f,"utc_epoch","event","symbol","magic","detail");FileSeek(f,0,SEEK_END);
 FileWrite(f,NowUTC(),event,InpSymbol,InpMagic,text);FileFlush(f);FileClose(f);
}
void Notice(const string event,const string text) {
 Audit(event,text);if(gTester)return;
 int n=ArraySize(gQueue);if(n>=32){Print("C2 notify queue full: event retained in audit.");return;}
 ArrayResize(gQueue,n+1);gQueue[n].event=event;gQueue[n].tries=0;gQueue[n].pushed=false;
 gQueue[n].text="SEKTE MUSANG - CEBONK COMPANY 22\nCOMBINED 2 | "+event+"\n--------------------\n"+
 InpSymbol+" | "+TFName()+" | "+WIB(NowUTC())+"\nAUTOPILOT: "+(gAuto?"ON":"OFF")+"\n--------------------\n"+text+"\n--------------------\nOJO FULLMARGIN COK";
}
void PopNotice() { int n=ArraySize(gQueue);for(int i=1;i<n;i++)gQueue[i-1]=gQueue[i];ArrayResize(gQueue,n-1); }
void FlushNotice() {
 if(gTester||ArraySize(gQueue)==0||(long)TimeLocal()<gNextNotify)return;gNextNotify=(long)TimeLocal()+7;
 if(!gQueue[0].pushed){if(InpMT5Push&&!SendNotification(StringSubstr(gQueue[0].event+" | "+gQueue[0].text,0,250)))Print("C2 MT5 push gagal; cek Notifications.");gQueue[0].pushed=true;}
 if(!InpTelegram||InpTelegramToken==""||InpTelegramChatID==""){PopNotice();return;}
 string body="{\"chat_id\":"+Q(InpTelegramChatID)+",\"text\":"+Q(gQueue[0].text)+"}";
 char bytes[],answer[];string headers;int len=StringToCharArray(body,bytes,0,WHOLE_ARRAY,CP_UTF8);if(len>0)ArrayResize(bytes,len-1);
 ResetLastError();int http=WebRequest("POST","https://api.telegram.org/bot"+InpTelegramToken+"/sendMessage","Content-Type: application/json\r\n",InpHTTPTimeoutMs,bytes,answer,headers);
 string response=CharArrayToString(answer,0,WHOLE_ARRAY,CP_UTF8);StringReplace(response," ","");
 if(http==200&&StringFind(response,"\"ok\":true")>=0){PopNotice();return;}
 gQueue[0].tries++;Print("C2 Telegram HTTP=",http," err=",GetLastError(),"; secret and response not logged.");
 if(http==401||http==403||gQueue[0].tries>=3)PopNotice();else gNextNotify=(long)TimeLocal()+(http==429?300:30);
}
bool DigitsOnly(const string s) {
 if(StringLen(s)<1||StringLen(s)>12)return false;
 for(int i=0;i<StringLen(s);i++){ushort c=StringGetCharacter(s,i);if(c<48||c>57)return false;}return true;
}
bool ParseSchedule(const string text) {
 C2Astro rows[];string lines[];StringSplit(text,10,lines);long previous=0;bool header=false;
 for(int i=0;i<ArraySize(lines);i++){
  string row=lines[i];StringTrimLeft(row);StringTrimRight(row);
  if(i==0&&StringLen(row)>0&&StringGetCharacter(row,0)==65279)row=StringSubstr(row,1);
  if(row=="")continue;
  if(!header){if(row!="start_epoch,end_epoch,direction,window_id,model")return false;header=true;continue;}
  string v[];if(StringSplit(row,44,v)!=5||!DigitsOnly(v[0])||!DigitsOnly(v[1])||v[4]!=C2_MODEL||StringLen(v[3])<1||StringLen(v[3])>100)return false;
  long from=StringToInteger(v[0]),to=StringToInteger(v[1]);
  if(from<946684800||to<=from||to-from>86400||from%300!=0||to%300!=0||from<previous)return false;
  int dir=v[2]=="BUY"?1:v[2]=="SELL"?-1:0;
  if(dir==0&&v[2]!="NEUTRAL"&&v[2]!="TRANSITION"&&v[2]!="OUTSIDE")return false;
  int n=ArraySize(rows);if(n>=100000)return false;ArrayResize(rows,n+1,512);
  rows[n].from=from;rows[n].to=to;rows[n].dir=dir;rows[n].id=v[3];previous=to;
 }
 if(!header||ArraySize(rows)==0)return false;
 ArrayResize(gSchedule,ArraySize(rows));for(int i=0;i<ArraySize(rows);i++)gSchedule[i]=rows[i];gScheduleError="";return true;
}
bool LocalSchedule() {
 int flags=FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ;if(InpCSVCommonFolder&&!gTester)flags|=FILE_COMMON;
 int f=FileOpen(InpAstroCSV,flags,0,CP_UTF8);if(f==INVALID_HANDLE){gScheduleError="CSV_NOT_FOUND: "+InpAstroCSV;return false;}
 string text="";while(!FileIsEnding(f)){text+=FileReadString(f)+"\n";if(StringLen(text)>8000000){FileClose(f);return false;}}
 FileClose(f);if(!ParseSchedule(text)){gScheduleError="CSV_INVALID_MODEL_OR_SCHEMA";return false;}return true;
}
void PollAstrology() {
 if(gTester||InpAstroSource==C2_ASTRO_LOCAL_CSV)return;
 string month=MonthUTC(NowUTC());long clock=(long)TimeLocal();
 if(clock<gNextAstro&&gMonth==month)return;gMonth=month;gNextAstro=clock+60;
 char empty[],answer[];string headers;ResetLastError();
 int http=WebRequest("GET",InpAstroBaseURL+month+".csv","Accept: text/csv\r\n",InpHTTPTimeoutMs,empty,answer,headers);
 if(http!=200||ArraySize(answer)>1000000||!ParseSchedule(CharArrayToString(answer,0,WHOLE_ARRAY,CP_UTF8))){
  ArrayResize(gSchedule,0);gScheduleError="ASTRO_HTTP_WAIT HTTP="+(string)http+" month="+month;Block(gScheduleError);return;
 }
 gNextAstro=clock+6*3600;Notice("ASTROLOGY_READY","Jadwal model "+month+" dimuat. Window otomatis; ora ana fallback BUY/SELL manual.");
}
int ScheduleIndex(const long utc) {
 int low=0,high=ArraySize(gSchedule)-1;
 while(low<=high){int mid=(low+high)/2;if(utc<gSchedule[mid].from)high=mid-1;else if(utc>=gSchedule[mid].to)low=mid+1;else return mid;}return -1;
}
bool AstrologyMatches(const C2Event &s,C2Astro &a) {
 if(!InpAcceptExperimentalAstro){Block("ASTRO_EXPERIMENT_NOT_ACCEPTED");return false;}
 int now=ScheduleIndex(NowUTC()),then=ScheduleIndex(ServerToUTC(s.eventStart));
 if(now<0||then<0){Block(gScheduleError!=""?gScheduleError:"ASTRO_OUTSIDE_COVERAGE_OR_WINDOW");return false;}
 if(gSchedule[now].dir!=s.dir||gSchedule[then].dir!=s.dir||gSchedule[now].id!=gSchedule[then].id||gSchedule[now].from!=gSchedule[then].from){Block("ASTRO_DIRECTION_OR_WINDOW_MISMATCH");return false;}
 a=gSchedule[now];return true;
}
long BarEnd(const long t,const ENUM_TIMEFRAMES tf) {
 if(tf!=PERIOD_MN1)return t+PeriodSeconds(tf);
 MqlDateTime d;TimeToStruct((datetime)t,d);d.mon++;if(d.mon>12){d.mon=1;d.year++;}d.day=1;d.hour=0;d.min=0;d.sec=0;return (long)StructToTime(d);
}
bool LoadBars(const ENUM_TIMEFRAMES tf,const int need,const long cutoff,C2Bar &out[]) {
 ArrayResize(out,0);MqlRates rates[];ArraySetAsSeries(rates,false);
 int count=CopyRates(InpSymbol,tf,0,need+1,rates);if(count<30)return false;
 for(int i=0;i<count;i++){
  long end=BarEnd((long)rates[i].time,tf);if(end>cutoff)continue;
  if(!Fin(rates[i].open)||!Fin(rates[i].high)||!Fin(rates[i].low)||!Fin(rates[i].close)||rates[i].low<=0||rates[i].high<MathMax(rates[i].open,rates[i].close)||rates[i].low>MathMin(rates[i].open,rates[i].close)||rates[i].high<rates[i].low)return false;
  if(i>0&&rates[i].time<=rates[i-1].time)return false;
  int n=ArraySize(out);ArrayResize(out,n+1,512);out[n].time=(long)rates[i].time;out[n].end=end;
  out[n].open=rates[i].open;out[n].high=rates[i].high;out[n].low=rates[i].low;out[n].close=rates[i].close;
 }
 return ArraySize(out)>=30;
}
bool Location(const C2Event &s,C2Zone &z,C2Rank &rank,string &coverage) {
 C2Zone zones[];C2Key keys[];int healthy=0;coverage="";
 for(int tf=0;tf<5;tf++){
  C2Bar b[];bool ok=LoadBars(gFrames[tf],tf==0?InpMonthlyBars:InpContextBars,s.eventStart,b);
  long maxAge=tf==0?62*86400:tf==1?15*86400:tf==2?5*86400:2*PeriodSeconds(gFrames[tf]);
  if(ok)ok=s.eventStart-b[ArraySize(b)-1].end<=maxAge;
  coverage+=gTFNames[tf]+(ok?" OK":" DATA_WAIT")+(tf<4?" | ":"");
  if(!ok)continue;healthy++;C2Zones(b,tf,zones);C2Keys(b,tf,keys);
 }
 if(healthy==0||(InpRequireAllFiveTF&&healthy<5)){Block("CONTEXT_DATA_WAIT "+coverage);return false;}
 bool opposed=false,found=C2Select(zones,keys,s.dir,s.entry,s.eventStart,z,rank,opposed);
 if(opposed){Block("OPPOSING_LOCATION_CONFLICT");return false;}
 if(!found){Block("NO_ACTIVE_SAME_SIDE_LOCATION_AT_RETEST");return false;}return true;
}
bool HasPositionOrOrder() {
 for(int i=PositionsTotal()-1;i>=0;i--)if(PositionGetTicket(i)>0&&PositionGetString(POSITION_SYMBOL)==InpSymbol)return true;
 for(int i=OrdersTotal()-1;i>=0;i--)if(OrderGetTicket(i)>0&&OrderGetString(ORDER_SYMBOL)==InpSymbol)return true;return false;
}
double Target(const C2Event &s) { return InpTarget==C2_TP_1618?s.tp1:InpTarget==C2_TP_423?s.tp3:s.tp2; }
double RoundTick(const double price,const bool up) {
 double tick=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_SIZE);if(tick<=0)return 0;
 return NormalizeDouble((up?MathCeil(price/tick-1e-9):MathFloor(price/tick+1e-9))*tick,gDigits);
}
bool Prepare(const C2Event &s,MqlTradeRequest &req,string &why) {
 ZeroMemory(req);MqlTick tick;if(!SymbolInfoTick(InpSymbol,tick)||tick.bid<=0||tick.ask<tick.bid){why="NO_QUOTE";return false;}
 if(!gTester&&!InpAllowRealAccount&&AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL){why="REAL_ACCOUNT_LOCKED";return false;}
 if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)||!MQLInfoInteger(MQL_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_EXPERT)){why="ALGO_OR_ACCOUNT_DISABLED";return false;}
 if(HasPositionOrOrder()){why="SYMBOL_ALREADY_HAS_POSITION_OR_ORDER";return false;}
 long mode=SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_MODE);
 if(mode==SYMBOL_TRADE_MODE_DISABLED||mode==SYMBOL_TRADE_MODE_CLOSEONLY||(mode==SYMBOL_TRADE_MODE_LONGONLY&&s.dir==-1)||(mode==SYMBOL_TRADE_MODE_SHORTONLY&&s.dir==1)){why="SIDE_DISABLED_BY_BROKER";return false;}
 long orderModes=SymbolInfoInteger(InpSymbol,SYMBOL_ORDER_MODE);
 if((orderModes&SYMBOL_ORDER_MARKET)==0||(orderModes&SYMBOL_ORDER_SL)==0||(orderModes&SYMBOL_ORDER_TP)==0){why="PROTECTED_MARKET_ORDER_UNSUPPORTED";return false;}
 double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT),entry=s.dir==1?tick.ask:tick.bid;
 if(point<=0||(tick.ask-tick.bid)/point>InpMaxSpreadPoints){why="SPREAD_LIMIT";return false;}
 double planned=s.dir*(s.entry-s.sl);
 if(planned<=0||MathAbs(entry-s.entry)>InpMaxDriftR*planned){why="QUOTE_DRIFT_TOO_FAR_FROM_RETEST";return false;}
 double minv=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MIN),maxv=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MAX),step=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_STEP);
 if(step<=0||InpFixedLot<minv||InpFixedLot>maxv){why="FIXED_LOT_OUTSIDE_BROKER_LIMIT";return false;}
 double lot=NormalizeDouble(MathFloor(InpFixedLot/step+1e-8)*step,8);if(lot<minv||lot<=0){why="LOT_STEP_INVALID";return false;}
 double sl=RoundTick(s.sl,s.dir==-1),tp=RoundTick(Target(s),s.dir==-1);
 double risk=s.dir*(entry-sl),reward=s.dir*(tp-entry),stop=(SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_STOPS_LEVEL)+1)*point;
 if(sl<=0||tp<=0||risk<=0||reward<=0){why="SL_TP_WRONG_SIDE";return false;}
 if((s.dir==1&&(tick.bid-sl<stop||tp-tick.bid<stop))||(s.dir==-1&&(sl-tick.ask<stop||tick.ask-tp<stop))){why="BROKER_MIN_STOP_DISTANCE";return false;}
 if(InpMinRR>0&&reward/risk<InpMinRR){why="ACTUAL_RR_BELOW_MINIMUM";return false;}
 ENUM_ORDER_TYPE type=s.dir==1?ORDER_TYPE_BUY:ORDER_TYPE_SELL;double loss=0,margin=0,equity=AccountInfoDouble(ACCOUNT_EQUITY);
 if(!OrderCalcProfit(type,InpSymbol,lot,entry,sl,loss)||!OrderCalcMargin(type,InpSymbol,lot,entry,margin)){why="BROKER_RISK_CALC_FAILED";return false;}
 if(InpMaxTradeRiskPct>0&&(equity<=0||MathAbs(loss)>equity*InpMaxTradeRiskPct/100)){why="FIXED_LOT_RISK_CAP";return false;}
 if(margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE)){why="MARGIN_INSUFFICIENT";return false;}
 long filling=SymbolInfoInteger(InpSymbol,SYMBOL_FILLING_MODE);
 if((filling&SYMBOL_FILLING_FOK)!=0)req.type_filling=ORDER_FILLING_FOK;
 else if((filling&SYMBOL_FILLING_IOC)!=0)req.type_filling=ORDER_FILLING_IOC;
 else if(SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_EXEMODE)!=SYMBOL_TRADE_EXECUTION_MARKET)req.type_filling=ORDER_FILLING_RETURN;
 else {why="FILLING_MODE_UNSUPPORTED";return false;}
 req.action=TRADE_ACTION_DEAL;req.magic=InpMagic;req.symbol=InpSymbol;req.type=type;req.volume=lot;
 req.price=entry;req.sl=sl;req.tp=tp;req.deviation=(ulong)InpDeviationPoints;
 req.comment="C2-"+Side(s.dir)+"-"+StringFormat("%08X",Hash((string)s.ib+":"+(string)s.eventStart));
 MqlTradeCheckResult check={};if(!OrderCheck(req,check)){why="ORDERCHECK_"+(string)check.retcode;return false;}return true;
}
string SignalKey(const C2Event &s) { return gScope+(string)InpExecutionTF+"."+(string)s.dir+"."+(string)s.ib+"."+(string)s.eventStart; }
void EvaluateBar() {
 long bar=(long)iTime(InpSymbol,InpExecutionTF,0);if(bar<=0||bar==gBar)return;
 gBar=bar; // one evaluation per newly opened execution bar; no later chase on retries
 C2Bar bars[];if(!LoadBars(InpExecutionTF,InpExecutionBars,bar,bars)){Block("EXECUTION_HISTORY_NOT_READY");return;}
 int n=ArraySize(bars),seconds=PeriodSeconds(InpExecutionTF);long now=(long)TimeCurrent();
 if(bars[n-1].end!=bar||now-bar>InpMaxEntryDelaySeconds){Block("STALE_OR_LATE_NEW_BAR");return;}
 C2Event s;C2Musang(bars,seconds,now,s);
 if(s.stage!=C2_VALID){Block("MUSANG_WAIT_STAGE_"+(string)s.stage);return;}
 if(s.eventStart<gArmedAt){Block("PRE_ATTACH_OR_PRE_ARM_RETEST_SKIPPED");return;}
 string id=SignalKey(s);if(!gTester&&GlobalVariableCheck(id)){Block("SIGNAL_ALREADY_CONSUMED");return;}
 if(!gTester){GlobalVariableSet(id,(double)now);GlobalVariablesFlush();}
 C2Astro a;if(!AstrologyMatches(s,a))return;
 C2Zone zone;C2Rank rank;string coverage;
 if(!Location(s,zone,rank,coverage))return;
 string text=Side(s.dir)+" SELARAS\nAstrology: "+WIB(a.from)+" -> "+WIB(a.to)+"\n"+
 "Lokasi: "+gTFNames[zone.tf]+" "+ZoneKind(zone)+" "+ZoneStatus(zone)+"\nZone: "+Price(zone.low)+" - "+Price(zone.high)+"\n"+
 "IB -> CB1 BREAK -> RETEST "+TFName()+"\nCB1: "+Price(s.cb)+"\nZone IB: "+Price(s.low)+" - "+Price(s.high)+"\n"+
 "Retest acuan: "+Price(s.entry)+"\nSL: "+Price(s.sl)+"\nTP1 1.618: "+Price(s.tp1)+"\nTP2 2.618: "+Price(s.tp2)+"\nTP3 4.23: "+Price(s.tp3)+"\n"+coverage;
 Notice("SIGNAL_VALID",text);
 if(!gAuto){Block("AUTOPILOT_OFF_SIGNAL_ONLY");return;}
 MqlTradeRequest req;string why;if(!Prepare(s,req,why)){Notice("ENTRY_BLOCKED",why);Block(why);return;}
 if(!AstrologyMatches(s,a)||(long)TimeCurrent()-s.eventEnd>InpMaxEntryDelaySeconds){Notice("ENTRY_BLOCKED","WINDOW_EXPIRED_BEFORE_SEND");return;}
 gSent=s;gSentZone=zone;gSentSL=req.sl;gSentTP=req.tp;gHaveSent=true;
 MqlTradeResult result={};bool sent=OrderSend(req,result);
 if(sent&&(result.retcode==TRADE_RETCODE_DONE||result.retcode==TRADE_RETCODE_DONE_PARTIAL||result.retcode==TRADE_RETCODE_PLACED)){
  Audit("ORDER_ACCEPTED","order="+(string)result.order+" retcode="+(string)result.retcode+"; fill notification waits for deal confirmation");gLastBlock="";
 }else{
  Notice("ORDER_REJECTED","retcode="+(string)result.retcode+"; ora retry sinyal sing padha");
  if(result.retcode==TRADE_RETCODE_TIMEOUT||result.retcode==TRADE_RETCODE_CONNECTION){gAuto=false;Block("EXECUTION_UNCERTAIN_AUTOPILOT_OFF_CHECK_POSITIONS");}
 }
}
void Paint() {
 if(ObjectFind(0,gButton)<0)return;ObjectSetString(0,gButton,OBJPROP_TEXT,gAuto?"AUTOPILOT ON":"AUTOPILOT OFF");ObjectSetInteger(0,gButton,OBJPROP_STATE,false);
}
int OnInit() {
 gTester=(bool)MQLInfoInteger(MQL_TESTER);gAuto=InpAutopilot;
 if(_Symbol!=InpSymbol){Print("Pasang neng chart ",InpSymbol,". TF chart bebas; execution default M5.");return INIT_PARAMETERS_INCORRECT;}
 if(InpMagic==0||InpFixedLot<=0||!Fin(InpFixedLot)||(InpExecutionTF!=PERIOD_M1&&InpExecutionTF!=PERIOD_M5&&InpExecutionTF!=PERIOD_M15)||InpExecutionBars<100||InpExecutionBars>2000||InpContextBars<30||InpContextBars>1000||InpMonthlyBars<30||InpMonthlyBars>500||InpMaxSpreadPoints<0||InpDeviationPoints<0||InpMaxTradeRiskPct<0||InpMinRR<0||InpMaxDriftR<=0||InpMaxEntryDelaySeconds<1||InpMaxEntryDelaySeconds>60||MathAbs(InpServerUTCMinutes)>840||InpHTTPTimeoutMs<500||InpHTTPTimeoutMs>10000)return INIT_PARAMETERS_INCORRECT;
 if(!SymbolSelect(InpSymbol,true))return INIT_FAILED;gDigits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
 gScope="C2."+StringFormat("%08X",Hash(AccountInfoString(ACCOUNT_SERVER)+":"+(string)AccountInfoInteger(ACCOUNT_LOGIN)+":"+(string)InpMagic+":"+InpSymbol))+".";
 gButton="CEBONK_C2_AUTOPILOT_"+(string)InpMagic;
 if(!gTester){gLock=FileOpen(gScope+"LOCK.bin",FILE_READ|FILE_WRITE|FILE_BIN|FILE_COMMON);if(gLock==INVALID_HANDLE){Print("C2 another instance holds exclusive lock. Close it first.");return INIT_FAILED;}}
 if(gTester||InpAstroSource==C2_ASTRO_LOCAL_CSV){if(!LocalSchedule()){Print(gScheduleError);return INIT_FAILED;}}
 else if(StringFind(InpAstroBaseURL,"https://")!=0){Print("HTTPS AstroBaseURL required");return INIT_PARAMETERS_INCORRECT;}
 gBar=(long)iTime(InpSymbol,InpExecutionTF,0);gArmedAt=(long)TimeCurrent();
 if(ObjectCreate(0,gButton,OBJ_BUTTON,0,0,0)){
  ObjectSetInteger(0,gButton,OBJPROP_CORNER,CORNER_LEFT_UPPER);ObjectSetInteger(0,gButton,OBJPROP_XDISTANCE,10);ObjectSetInteger(0,gButton,OBJPROP_YDISTANCE,15);ObjectSetInteger(0,gButton,OBJPROP_XSIZE,155);ObjectSetInteger(0,gButton,OBJPROP_YSIZE,30);Paint();
 }
 if(!gTester)EventSetTimer(1);
 Notice("EA_STARTED","Default execution "+TFName()+"\nLot "+DoubleToString(InpFixedLot,2)+" | spread max "+(string)InpMaxSpreadPoints+" points\nNew retests only after attach/arm.\nAstro: "+(gTester||InpAstroSource==C2_ASTRO_LOCAL_CSV?"LOCAL CSV":"MONTHLY WEB CSV")+"\nNo MA/ATR, no recovery, no BE/trailing/partial strategy.");
 if(!InpAcceptExperimentalAstro)Block("SET InpAcceptExperimentalAstro=true ONLY FOR DELIBERATE TESTING");
 if(InpTelegramTestOnStart)Notice("TELEGRAM_TEST","Tes sambungan COMBINED 2. Iki dudu sinyal entry.");return INIT_SUCCEEDED;
}
void OnTick() {
 MqlTick tick;if(!SymbolInfoTick(InpSymbol,tick)||tick.bid<=0||tick.ask<tick.bid)return;
 if(!gTester&&MathAbs((double)((long)TimeTradeServer()-(long)tick.time))>15){Block("BROKER_TICK_STALE");return;}
 EvaluateBar();Paint();
}
void OnTimer() { PollAstrology();FlushNotice();Paint(); }
void OnChartEvent(const int id,const long &lp,const double &dp,const string &sp) {
 if(id==CHARTEVENT_OBJECT_CLICK&&sp==gButton){gAuto=!gAuto;gArmedAt=(long)TimeCurrent();Paint();Notice("AUTOPILOT",gAuto?"ON. Mung retest anyar sawise diaktifke.":"OFF. Ora ana order anyar. SL/TP posisi lawas tetep.");}
}
void OnTradeTransaction(const MqlTradeTransaction &tr,const MqlTradeRequest &request,const MqlTradeResult &result) {
 if(tr.type!=TRADE_TRANSACTION_DEAL_ADD||tr.deal==0||!HistoryDealSelect(tr.deal)||HistoryDealGetString(tr.deal,DEAL_SYMBOL)!=InpSymbol)return;
 long entry=HistoryDealGetInteger(tr.deal,DEAL_ENTRY);ulong magic=(ulong)HistoryDealGetInteger(tr.deal,DEAL_MAGIC),pos=(ulong)HistoryDealGetInteger(tr.deal,DEAL_POSITION_ID);
 double price=HistoryDealGetDouble(tr.deal,DEAL_PRICE),lot=HistoryDealGetDouble(tr.deal,DEAL_VOLUME);int dir=HistoryDealGetInteger(tr.deal,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1;
 if(entry==DEAL_ENTRY_IN&&magic==InpMagic){
  double sl=gHaveSent?gSentSL:0,tp=gHaveSent?gSentTP:0,risk=dir*(price-sl),reward=dir*(tp-price);
  string info=Side(dir)+" WIS MLEBU\nDeal: "+(string)tr.deal+" | posisi: "+(string)pos+"\nFill nyata: "+Price(price)+"\nLot: "+DoubleToString(lot,3)+"\nSL: "+(sl>0?Price(sl):"cek terminal")+"\nTP dipilih: "+(tp>0?Price(tp):"cek terminal");
  if(gHaveSent)info+="\nTP1: "+Price(gSent.tp1)+"\nTP2: "+Price(gSent.tp2)+"\nTP3: "+Price(gSent.tp3)+"\nRR fill: "+(risk>0?DoubleToString(reward/risk,2):"invalid")+"\nLokasi: "+gTFNames[gSentZone.tf]+" "+ZoneKind(gSentZone)+" "+ZoneStatus(gSentZone);
  Notice("ENTRY_FILLED",info);return;
 }
 if(entry!=DEAL_ENTRY_OUT&&entry!=DEAL_ENTRY_OUT_BY)return;
 long reason=HistoryDealGetInteger(tr.deal,DEAL_REASON);if(!HistorySelectByPosition(pos))return;
 bool ours=false;double net=0;int initialSide=0;
 for(int i=0;i<HistoryDealsTotal();i++){ulong d=HistoryDealGetTicket(i);if(d==0)continue;
  if(HistoryDealGetInteger(d,DEAL_ENTRY)==DEAL_ENTRY_IN&&(ulong)HistoryDealGetInteger(d,DEAL_MAGIC)==InpMagic){ours=true;initialSide=HistoryDealGetInteger(d,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1;}
  net+=HistoryDealGetDouble(d,DEAL_PROFIT)+HistoryDealGetDouble(d,DEAL_SWAP)+HistoryDealGetDouble(d,DEAL_COMMISSION)+HistoryDealGetDouble(d,DEAL_FEE);
 }
 if(!ours)return;bool stillOpen=false;
 for(int i=PositionsTotal()-1;i>=0;i--)if(PositionGetTicket(i)>0&&(ulong)PositionGetInteger(POSITION_IDENTIFIER)==pos)stillOpen=true;
 string why=reason==DEAL_REASON_TP?"TP":reason==DEAL_REASON_SL?"SL":"OTHER_"+(string)reason;
 Notice(stillOpen?"EXIT_DEAL_PARTIAL":"POSITION_CLOSED","Arah awal: "+Side(initialSide)+"\nPosisi: "+(string)pos+"\nExit: "+Price(price)+"\nAlasan: "+why+"\nNet posisi s.d. saiki: "+DoubleToString(net,2)+" "+AccountInfoString(ACCOUNT_CURRENCY)+"\nKalebu commission/fee/swap sing dicatat broker ing deal posisi iki.");
}
void OnDeinit(const int reason) { EventKillTimer();ObjectDelete(0,gButton);if(gLock!=INVALID_HANDLE){FileClose(gLock);gLock=INVALID_HANDLE;} }
