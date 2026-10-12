// CEBONK COMPANY 22 | AL-BIRUNI MAJORITY DIRECT v1.03 | Standalone MT5 EA
// BUY/SELL: majority of active signed aspects (2 SELL > 1 BUY). Classical §527 veto NOT applied in V3; astronomy majority only.
// ATR14 M15 only sizes stops. UNVALIDATED.
// Live: exact signed CSV feed from GitHub RAW; Tester: LOCAL historical CSV.
// No WebRequest during Strategy Tester. No BE, trailing, partial or martingale.
#property strict
#property version "1.03"
#property description "AL-BIRUNI DIRECT V3: majority verified, APPLYING, ATR3 RR2"
#property tester_file "CEBONK_ALBIRUNI_DIRECT_v1.03.csv"
#include <Trade/Trade.mqh>

input group "01 | INTRADAY / SAFETY"
input string InpSymbol="XAUUSDc";
input ulong InpMagic=221026;
input bool InpAutopilot=false;
input bool InpEnableExperimentalAstro=false;
input bool InpAllowRealAccount=false;
input double InpFixedLot=0.01;
input int InpMaxSpreadPoints=70;
input int InpDeviationPoints=30;
input int InpMaxEntryLateSeconds=480;

input group "02 | FIXED SL/TP"
input ENUM_TIMEFRAMES InpATRTimeframe=PERIOD_M15;
input int InpATRPeriod=14;
input double InpSL_ATR=3.0;
input double InpRR=2.0;
input bool InpCloseIntraday=true;
input int InpCloseHourWIB=23;
input int InpCloseMinuteWIB=45;

input group "03 | AL-BIRUNI WEBREQUEST"
input string InpFeedURL="https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/albiruni_intraday/data/majority_direct_v3.csv";
input int InpWebPollSeconds=300;
input int InpWebTimeoutMs=5000;
input int InpMaxFeedAgeHours=36;
input bool InpAutoBrokerUTC=true;
input int InpBrokerUTCMinutes=180;
input string InpTesterCSV="CEBONK_ALBIRUNI_DIRECT_v1.03.csv";

input group "04 | TELEGRAM + MT5 PUSH"
input bool InpTelegram=true;
input string InpTelegramToken="";
input string InpTelegramChatID="";
input bool InpMT5Push=true;
input bool InpNotifyAutopilot=true; // Notify only after successful ON/OFF button click.

struct ABSignal{
 string day,id,aspect,phase;
 int dir,buyAspects,sellAspects;
 long start,entry,core,end,expiry,published;
};
ABSignal gFeed[];
CTrade gTrade;
bool gTester=false,gAuto=false,gFeedOK=false;
int gATR=INVALID_HANDLE;
long gLastPoll=0;
string gButton="",gStatus="",gError="";
const string AB_MODEL="ALBIRUNI_MAJORITY_DIRECT_V3";
const string AB_HEADER="model,date_wib,signal_id,direction,start_epoch,entry_epoch,core_epoch,end_epoch,valid_until_epoch,published_epoch,aspect,phase,buy_aspects,sell_aspects";

string ABDate(const long utc){
 MqlDateTime d;TimeToStruct((datetime)(utc+7*3600),d);
 return StringFormat("%04d-%02d-%02d",d.year,d.mon,d.day);
}
string ABStamp(const long utc){
 if(utc<=0)return "—";
 MqlDateTime d;TimeToStruct((datetime)(utc+7*3600),d);
 return StringFormat("%04d-%02d-%02d %02d:%02d WIB",d.year,d.mon,d.day,d.hour,d.min);
}
int ABWeekday(const long utc){
 MqlDateTime d;TimeToStruct((datetime)(utc+7*3600),d);return d.day_of_week;
}
int ABMinuteWIB(const long utc){
 MqlDateTime d;TimeToStruct((datetime)(utc+7*3600),d);return 60*d.hour+d.min;
}
int ABOffset(){
 if(gTester||!InpAutoBrokerUTC)return InpBrokerUTCMinutes*60;
 long d=(long)TimeTradeServer()-(long)TimeGMT();
 if(MathAbs(d)>15*3600)return InpBrokerUTCMinutes*60;
 return (int)MathRound((double)d/900.0)*900;
}
long ABNowUTC(){
 if(gTester)return (long)TimeCurrent()-ABOffset();
 return (long)TimeGMT();
}
bool ABDigits(const string s){
 if(StringLen(s)<1||StringLen(s)>20)return false;
 for(int i=0;i<StringLen(s);i++){
  ushort c=StringGetCharacter(s,i);if(c<48||c>57)return false;
 }
 return true;
}
bool ABDateText(const string s){
 if(StringLen(s)!=10||StringGetCharacter(s,4)!=45||StringGetCharacter(s,7)!=45)return false;
 for(int i=0;i<10;i++){
  if(i==4||i==7)continue;
  ushort c=StringGetCharacter(s,i);if(c<48||c>57)return false;
 }
 return true;
}
bool ABTokenSafe(const string s){
 if(StringLen(s)<2||StringLen(s)>100)return false;
 for(int i=0;i<StringLen(s);i++){
  ushort c=StringGetCharacter(s,i);
  if(!((c>=65&&c<=90)||(c>=97&&c<=122)||(c>=48&&c<=57)||c==45||c==95))return false;
 }
 return true;
}
bool ABLoad(const string payload){
 gFeedOK=false;ArrayResize(gFeed,0);gError="ALBIRUNI_FEED_INVALID";
 if(StringLen(payload)<StringLen(AB_HEADER)+3||StringLen(payload)>220000)return false;
 string lines[];int n=StringSplit(payload,10,lines);
 if(n<2||n>1400)return false;
 string header=lines[0];StringTrimLeft(header);StringTrimRight(header);
 if(StringLen(header)>0&&StringGetCharacter(header,0)==65279)header=StringSubstr(header,1);
 if(header!=AB_HEADER){gError="ALBIRUNI_BAD_HEADER";return false;}
 ABSignal parsed[];
 for(int k=1;k<n;k++){
  string line=lines[k];StringTrimLeft(line);StringTrimRight(line);
  if(line=="")continue;
  string p[];if(StringSplit(line,44,p)!=14){gError="ALBIRUNI_BAD_COLUMNS";return false;}
  for(int j=0;j<14;j++){StringTrimLeft(p[j]);StringTrimRight(p[j]);}
  if(p[0]!=AB_MODEL||!ABDateText(p[1])||!ABDigits(p[9])||
      !ABDigits(p[12])||!ABDigits(p[13])||
     !ABDigits(p[4])||!ABDigits(p[5])||!ABDigits(p[6])||
     !ABDigits(p[7])||!ABDigits(p[8])||
     StringLen(p[10])>160||StringLen(p[11])>24){
   gError="ALBIRUNI_BAD_FIELD";return false;
  }
  ABSignal s;s.day=p[1];s.id=p[2];s.aspect=p[10];s.phase=p[11];
  s.dir=p[3]=="BUY"?1:p[3]=="SELL"?-1:0;
   s.buyAspects=(int)StringToInteger(p[12]);
   s.sellAspects=(int)StringToInteger(p[13]);
  s.start=StringToInteger(p[4]);s.entry=StringToInteger(p[5]);
  s.core=StringToInteger(p[6]);s.end=StringToInteger(p[7]);
  s.expiry=StringToInteger(p[8]);s.published=StringToInteger(p[9]);
  if((s.published<1600000000)||(p[3]!="WAIT"&&s.dir==0)){
   gError="ALBIRUNI_BAD_DIRECTION";return false;
  }
  // Validate majority; never BUY with 2 SELL / 1 BUY or vice versa.
   if(s.buyAspects<0||s.sellAspects<0||
      s.buyAspects+s.sellAspects>21||
      (s.dir>0&&s.buyAspects<=s.sellAspects)||
      (s.dir<0&&s.sellAspects<=s.buyAspects)||
      (s.dir==0&&(s.buyAspects!=0||s.sellAspects!=0))){
    gError="ALBIRUNI_MAJORITY_MISMATCH";return false;
   }
   if(s.dir==0){
   if(s.id!="NONE"||s.start!=0||s.entry!=0||s.core!=0||
      s.end!=0||s.expiry!=0||s.aspect!="NONE"||s.phase!="NONE"){
    gError="ALBIRUNI_BAD_WAIT";return false;
   }
  }else{
   if(!ABTokenSafe(s.id)||s.phase!="APPLYING"||
      StringLen(s.aspect)<6||StringFind(s.aspect,",")>=0||
      s.start<1600000000||s.start>=s.entry||s.entry>=s.core||
      s.core>=s.end||s.expiry<s.core||s.expiry>s.end||
      s.entry%300!=0||ABDate(s.entry)!=s.day||
      ABDate(s.start)!=s.day||ABDate(s.end-1)!=s.day||
      ABWeekday(s.entry)<1||ABWeekday(s.entry)>5){
    gError="ALBIRUNI_BAD_WINDOW";return false;
   }
  }
  for(int i=0;i<ArraySize(parsed);i++)
   if((parsed[i].day==s.day)||(parsed[i].id==s.id&&s.dir!=0)){
    gError="ALBIRUNI_DUPLICATE_DATE_OR_ID";return false;
   }
  if(ArraySize(parsed)>=1100){gError="ALBIRUNI_TOO_MANY_DAYS";return false;}
  int index=ArraySize(parsed);ArrayResize(parsed,index+1);parsed[index]=s;
 }
 if(ArraySize(parsed)==0){gError="ALBIRUNI_NO_ROWS";return false;}
 ArrayResize(gFeed,ArraySize(parsed));
 for(int i=0;i<ArraySize(parsed);i++)gFeed[i]=parsed[i];
 gFeedOK=true;gError="";return true;
}
bool ABReadFile(){
 int file=FileOpen(InpTesterCSV,FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ,0,CP_UTF8);
 if(file==INVALID_HANDLE){
  gFeedOK=false;ArrayResize(gFeed,0);gError="TESTER_CSV_NOT_FOUND";return false;
 }
 string payload="";
 while(!FileIsEnding(file)){
  payload+=FileReadString(file)+"\n";
  if(StringLen(payload)>220000)break;
 }
 FileClose(file);return ABLoad(payload);
}
bool ABReadWeb(){
 if(gTester)return ABReadFile(); // never WebRequest in Strategy Tester
 char request[],reply[];string headers="";
 ResetLastError();
 int code=WebRequest("GET",InpFeedURL,
  "Accept: text/csv\r\nCache-Control: no-cache\r\n",
  InpWebTimeoutMs,request,reply,headers);
 if(code!=200||ArraySize(reply)<20||ArraySize(reply)>220000){
  gFeedOK=false;ArrayResize(gFeed,0);
  gError="WEB_HTTP_"+(string)code+"_MT5_"+(string)GetLastError();return false;
 }
 return ABLoad(CharArrayToString(reply,0,WHOLE_ARRAY,CP_UTF8));
}
int ABCurrentSignal(const long now){
 if(!gFeedOK)return -1;
 const string date=ABDate(now);
 for(int i=0;i<ArraySize(gFeed);i++){
  if(gFeed[i].day!=date)continue;
  // Production feed may be created Sunday evening for Monday.
  if(!gTester&&(gFeed[i].published>now+300||
     now-gFeed[i].published>InpMaxFeedAgeHours*3600))return -1;
  return i;
 }
 return -1;
}
void ABStatus(const string text){
 if(text==gStatus)return;gStatus=text;Print("CEBONK AL-BIRUNI | ",text);
 if(ObjectFind(0,gButton)>=0)ObjectSetString(0,gButton,OBJPROP_TOOLTIP,text);
}
void ABPaint(){
 if(ObjectFind(0,gButton)<0)return;
 ObjectSetString(0,gButton,OBJPROP_TEXT,gAuto?"AUTOPILOT ON":"AUTOPILOT OFF");
 ObjectSetInteger(0,gButton,OBJPROP_BGCOLOR,gAuto?clrDarkGreen:clrFireBrick);
 ObjectSetInteger(0,gButton,OBJPROP_STATE,false);
}
string ABGlobalKey(const string signal){
 return "AB"+(string)AccountInfoInteger(ACCOUNT_LOGIN)+"_"+(string)InpMagic+"_"+signal;
}
bool ABOwnPosition(){
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);if(ticket==0)continue;
  if(PositionGetString(POSITION_SYMBOL)==InpSymbol&&
   (ulong)PositionGetInteger(POSITION_MAGIC)==InpMagic)return true;
 }
 return false;
}
bool ABForeignPosition(){
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);if(ticket==0)continue;
  if(PositionGetString(POSITION_SYMBOL)==InpSymbol&&
   (ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic)return true;
 }
 return false;
}
bool ABNetting(){
 return AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING;
}
bool ABTradeAllowed(){
 return TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)&&
  MQLInfoInteger(MQL_TRADE_ALLOWED)&&
  AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)&&
  AccountInfoInteger(ACCOUNT_TRADE_EXPERT);
}
double ABTickRound(const double price,const bool ceilValue){
 double step=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_SIZE);
 if(step<=0)return 0;
 double units=ceilValue?MathCeil(price/step-1e-9):MathFloor(price/step+1e-9);
 return NormalizeDouble(units*step,(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS));
}
bool ABValidLot(){
 double step=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_STEP);
 double minimum=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MIN);
 double maximum=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MAX);
 return step>0&&InpFixedLot>=minimum&&InpFixedLot<=maximum&&
  MathAbs(MathRound(InpFixedLot/step)*step-InpFixedLot)<0.00000001;
}
bool ABPlace(const ABSignal &s){
 if(!gAuto||!InpEnableExperimentalAstro)return false;
 if(AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL&&!InpAllowRealAccount){
  ABStatus("REAL_ACCOUNT_LOCKED");return false;
 }
 if(!ABTradeAllowed()||ABOwnPosition()||(ABNetting()&&ABForeignPosition())){
  ABStatus("TRADE_DISABLED_OR_POSITION_OCCUPIED");return false;
 }
 if(!ABValidLot()){ABStatus("INVALID_FIXED_LOT");return false;}
 MqlTick tick;
 if(!SymbolInfoTick(InpSymbol,tick)||tick.ask<=tick.bid||tick.bid<=0){
  ABStatus("INVALID_QUOTE");return false;
 }
 if((long)TimeCurrent()-(long)tick.time>60){
  ABStatus("STALE_QUOTE");return false;
 }
 double pt=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
 if(pt<=0||(tick.ask-tick.bid)/pt>InpMaxSpreadPoints){
  ABStatus("SPREAD_GUARD");return false;
 }
 long mode=SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_MODE);
 if(mode==SYMBOL_TRADE_MODE_DISABLED||mode==SYMBOL_TRADE_MODE_CLOSEONLY||
    (s.dir>0&&mode==SYMBOL_TRADE_MODE_SHORTONLY)||
    (s.dir<0&&mode==SYMBOL_TRADE_MODE_LONGONLY)){
  ABStatus("BROKER_DIRECTION_BLOCKED");return false;
 }
 double buffer[];ArraySetAsSeries(buffer,true);
 if(CopyBuffer(gATR,0,1,1,buffer)!=1||buffer[0]<=0){
  ABStatus("ATR_NOT_READY");return false;
 }
 const double entry=s.dir>0?tick.ask:tick.bid;
 const double distance=InpSL_ATR*buffer[0];
 double sl=ABTickRound(entry+(s.dir>0?-distance:distance),s.dir<0);
 const double risk=MathAbs(entry-sl);
 if(sl<=0||risk<=0||(s.dir>0&&sl>=entry)||(s.dir<0&&sl<=entry)){
  ABStatus("INVALID_ATR_SL");return false;
 }
 double tp=ABTickRound(entry+(s.dir>0?risk*InpRR:-risk*InpRR),s.dir>0);
 double minimumStop=(SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_STOPS_LEVEL)+1)*pt;
 if(tp<=0||(s.dir>0&&(tick.bid-sl<minimumStop||tp-tick.bid<minimumStop))||
            (s.dir<0&&(sl-tick.ask<minimumStop||tick.ask-tp<minimumStop))){
  ABStatus("BROKER_STOP_LEVEL");return false;
 }
 if(!gTrade.SetTypeFillingBySymbol(InpSymbol)){
  ABStatus("FILLING_MODE_UNSUPPORTED");return false;
 }
 gTrade.SetExpertMagicNumber(InpMagic);
 gTrade.SetDeviationInPoints(InpDeviationPoints);
 gTrade.SetAsyncMode(false);
 const string comment="AB_"+s.day+"_"+(s.dir>0?"B":"S");
 bool sent=s.dir>0?
  gTrade.Buy(InpFixedLot,InpSymbol,entry,sl,tp,comment):
  gTrade.Sell(InpFixedLot,InpSymbol,entry,sl,tp,comment);
 uint retcode=gTrade.ResultRetcode();
 if(!sent||(retcode!=TRADE_RETCODE_DONE&&retcode!=TRADE_RETCODE_DONE_PARTIAL)){
  ABStatus("ORDER_REJECTED_"+(string)retcode+" "+gTrade.ResultRetcodeDescription());
  return false;
 }
 // Persistent per account/magic/SignalID; safe on restart.
 GlobalVariableSet(ABGlobalKey(s.id),(double)ABNowUTC());
 ABStatus("ENTRY_EXECUTED "+(s.dir>0?"BUY ":"SELL ")+s.id+" VOTES_BUY="+(string)s.buyAspects+" SELL="+(string)s.sellAspects);
 return true;
}
string ABURLEncode(const string value){
 char bytes[];int n=StringToCharArray(value,bytes,0,WHOLE_ARRAY,CP_UTF8);
 string out="";
 for(int i=0;i<n-1;i++){
  int b=((int)bytes[i])&255;
  if((b>=65&&b<=90)||(b>=97&&b<=122)||(b>=48&&b<=57)||
      b==45||b==95||b==46||b==126)out+=CharToString((uchar)b);
  else out+=StringFormat("%%%02X",b);
 }
 return out;
}
void ABNotice(const string msg){
 if(InpMT5Push&&!gTester){
  ResetLastError();
  if(!SendNotification(StringSubstr(msg,0,250)))
   ABStatus("MT5_PUSH_FAILED_ERR_"+(string)GetLastError());
 }
 if(!InpTelegram||gTester)return;
 if(InpTelegramToken==""||InpTelegramChatID==""){
  ABStatus("TELEGRAM_NOT_CONFIGURED");return;
 }
 string url="https://api.telegram.org/bot"+InpTelegramToken+"/sendMessage";
 string body="chat_id="+ABURLEncode(InpTelegramChatID)+"&text="+ABURLEncode(msg);
 char req[],reply[];string responseHeaders="";
 int count=StringToCharArray(body,req,0,WHOLE_ARRAY,CP_UTF8);
 if(count>0)ArrayResize(req,count-1);
 int code=WebRequest("POST",url,
  "Content-Type: application/x-www-form-urlencoded\r\n",
  InpWebTimeoutMs,req,reply,responseHeaders);
 if(code!=200||StringFind(CharArrayToString(reply,0,WHOLE_ARRAY,CP_UTF8),"\"ok\":true")<0)
  ABStatus("TELEGRAM_FAILED_HTTP_"+(string)code);
}
string ABPrice(const double value){
 return DoubleToString(value,(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS));
}
void ABTradeNotice(const ulong deal,const bool isEntry,const string side,const double price){
 ulong positionId=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
 string key="ABN_"+(string)AccountInfoInteger(ACCOUNT_LOGIN)+"_"+
  (string)InpMagic+"_"+(string)positionId+(isEntry?"_IN":"_OUT");
 if(GlobalVariableCheck(key))return;
 GlobalVariableSet(key,(double)TimeCurrent()); // claim BEFORE sending; one per position.
 if(!isEntry){
  long why=HistoryDealGetInteger(deal,DEAL_REASON);
  if(why==DEAL_REASON_TP)ABNotice("🦊 AL-BIRUNI INTRADAY\n"+
    (side=="BUY"?"🟢 BUY ":"🔴 SELL ")+InpSymbol+"\n😅 TAKE PROFIT");
  else if(why==DEAL_REASON_SL)ABNotice("🦊 AL-BIRUNI INTRADAY\n"+
    (side=="BUY"?"🟢 BUY ":"🔴 SELL ")+InpSymbol+"\n🥲 STOP LOSS");
  return;
 }
 double sl=HistoryDealGetDouble(deal,DEAL_SL);
 double tp=HistoryDealGetDouble(deal,DEAL_TP);
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);if(ticket==0)continue;
  if((ulong)PositionGetInteger(POSITION_IDENTIFIER)!=positionId)continue;
  sl=PositionGetDouble(POSITION_SL);tp=PositionGetDouble(POSITION_TP);break;
 }
 const long now=ABNowUTC();
 int index=ABCurrentSignal(now);
 string aw="—",inti="—",akhir="—",day=ABDate(now);
 if(index>=0&&gFeed[index].dir!=0){
  day=gFeed[index].day;
  aw=ABStamp(gFeed[index].start);
  inti=ABStamp(gFeed[index].core);
  akhir=ABStamp(gFeed[index].end);
 }
 string msg="🦊 SEKTE MUSANG TEORY\nCEBONK COMPANY 22\n\n"+
  "🪐 AL-BIRUNI INTRADAY\n"+(side=="BUY"?"🟢 BUY ":"🔴 SELL ")+InpSymbol+
  "\n\n📅 Tanggal: "+day+
  "\n🕐 Entry: "+ABStamp((long)HistoryDealGetInteger(deal,DEAL_TIME))+
  "\n\n🌙 AWAL: "+aw+"\n☀️ INTI: "+inti+"\n🌑 AKHIR: "+akhir+
  "\n\n🪐 MAYORITAS: "+(index>=0?("SELL "+(string)gFeed[index].sellAspects+" / BUY "+(string)gFeed[index].buyAspects):"Data tidak tersedia")+
   "\n\n💰 Entry: "+ABPrice(price)+
  "\n🛑 SL: "+ABPrice(sl)+"\n🎯 TP: "+ABPrice(tp)+
  "\n\n📊 RR 1:"+DoubleToString(InpRR,0)+
  "\n🛡️ AUTOPILOT ON\n\n⚠️ OJO FULLMARGIN COK!";
 ABNotice(msg);
}
void ABCloseIntraday(const long now){
 if(!InpCloseIntraday||!ABTradeAllowed())return;
 const string today=ABDate(now);
 bool cutoff=ABMinuteWIB(now)>=InpCloseHourWIB*60+InpCloseMinuteWIB;
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);if(ticket==0)continue;
  if(PositionGetString(POSITION_SYMBOL)!=InpSymbol||
     (ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic)continue;
  long opened=(long)PositionGetInteger(POSITION_TIME);
  long utcOpen=opened-ABOffset();
  if(!cutoff&&ABDate(utcOpen)==today)continue;
  if(!gTrade.SetTypeFillingBySymbol(InpSymbol))continue;
  gTrade.SetExpertMagicNumber(InpMagic);
  gTrade.SetDeviationInPoints(InpDeviationPoints);
  if(!gTrade.PositionClose(ticket,InpDeviationPoints)||
    gTrade.ResultRetcode()!=TRADE_RETCODE_DONE)
   ABStatus("DAILY_CLOSE_RETRY_"+(string)gTrade.ResultRetcode());
  else ABStatus("DAILY_CLOSE_EXECUTED");
 }
}
// Broker trading sessions, NOT a manual hour filter. Fail closed for delayed entries
// if metadata is unavailable; normal 8-minute entry keeps its old quote guard.
bool ABTradeSessionAt(const long utc,bool &known){
 known=false;
 const long server=utc+ABOffset();
 MqlDateTime dt;TimeToStruct((datetime)server,dt);
 const long seconds=dt.hour*3600+dt.min*60+dt.sec;
 // Previous day's overnight sessions may extend past midnight (to>=86400).
 for(int back=0;back<=1;back++){
  ENUM_DAY_OF_WEEK day=(ENUM_DAY_OF_WEEK)((dt.day_of_week+7-back)%7);
  datetime sessionFrom,sessionTo;
  for(uint n=0;n<20;n++){
   if(!SymbolInfoSessionTrade(InpSymbol,day,n,sessionFrom,sessionTo))break;
   known=true;
   long first=(long)sessionFrom,last=(long)sessionTo;
   if(last<=first)last+=86400; // Crossing midnight, including 00:00->00:00.
   long t=seconds+back*86400;
   if(t>=first&&t<last)return true;
  }
 }
 return false;
}
void ABCheckEntry(const long now){
 if(!gAuto||!InpEnableExperimentalAstro)return;
 int index=ABCurrentSignal(now);if(index<0)return;
 ABSignal s=gFeed[index];
 if(s.dir==0||ABWeekday(now)<1||ABWeekday(now)>5)return;
 // Preserve Al-Biruni's exact scheduled ENTRY and applying phase before INTI.
 if(now<s.entry)return;
 if(now>=s.core||now>=s.end||now>=s.expiry){
  ABStatus("ASTRO_PHASE_EXPIRED_SKIP "+s.id);return;
 }
 if(GlobalVariableCheck(ABGlobalKey(s.id)))return;
 // Do not open after the configured automatic close cutoff; it would
 // otherwise close again on the next 1-second timer tick.
 if(InpCloseIntraday&&ABMinuteWIB(now)>=InpCloseHourWIB*60+InpCloseMinuteWIB){
  ABStatus("AFTER_DAILY_CLOSE_CUTOFF "+s.id);return;
 }
 bool entryKnown=false,nowKnown=false;
 bool openAtEntry=ABTradeSessionAt(s.entry,entryKnown);
 bool openNow=ABTradeSessionAt(now,nowKnown);
 if(nowKnown&&!openNow){ABStatus("WAIT_MARKET_OPEN "+s.id);return;}
 const bool deferred=entryKnown&&!openAtEntry;
 // Extended wait is allowed ONLY if broker's session data proves the
 // scheduled Al-Biruni ENTRY fell outside the trading session.
 if(now-s.entry>InpMaxEntryLateSeconds){
  if(!deferred){ABStatus("LATE_SIGNAL_SKIP "+s.id);return;}
  if(!nowKnown||!openNow){ABStatus("MARKET_SESSION_UNKNOWN "+s.id);return;}
 }
 ABPlace(s);
}
int OnInit(){
 gTester=(bool)MQLInfoInteger(MQL_TESTER);
 if(InpSymbol==""||InpFixedLot<=0||InpSL_ATR<=0||InpRR<1||
  InpATRPeriod<2||InpMaxSpreadPoints<1||InpWebPollSeconds<60||
  InpMaxFeedAgeHours<1||InpMaxEntryLateSeconds<1||
  InpCloseHourWIB<0||InpCloseHourWIB>23||
  InpCloseMinuteWIB<0||InpCloseMinuteWIB>59||
  InpWebTimeoutMs<1000){
  Print("AL-BIRUNI: INVALID_INPUTS");return INIT_PARAMETERS_INCORRECT;
 }
 if(!SymbolSelect(InpSymbol,true))return INIT_FAILED;
 gATR=iATR(InpSymbol,InpATRTimeframe,InpATRPeriod);
 if(gATR==INVALID_HANDLE)return INIT_FAILED;
 gAuto=InpAutopilot;
 if(AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL&&!InpAllowRealAccount)
  gAuto=false;
 gTrade.SetExpertMagicNumber(InpMagic);
 gTrade.SetDeviationInPoints(InpDeviationPoints);
 gButton="AB_AUTO_"+(string)InpMagic;
 if(ObjectCreate(0,gButton,OBJ_BUTTON,0,0,0)){
  ObjectSetInteger(0,gButton,OBJPROP_CORNER,CORNER_LEFT_UPPER);
  ObjectSetInteger(0,gButton,OBJPROP_XDISTANCE,10);
  ObjectSetInteger(0,gButton,OBJPROP_YDISTANCE,25);
  ObjectSetInteger(0,gButton,OBJPROP_XSIZE,260);
  ObjectSetInteger(0,gButton,OBJPROP_YSIZE,70);
  ObjectSetInteger(0,gButton,OBJPROP_COLOR,clrWhite);
  ObjectSetInteger(0,gButton,OBJPROP_FONTSIZE,20);
 }
 ABPaint();
 EventSetTimer(1);
 ABStatus("INIT DIRECT_MAJORITY_V3 experimental="+(InpEnableExperimentalAstro?"YES":"NO")+
  " source="+(gTester?"TESTER_CSV":"GITHUB_RAW"));
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){
 EventKillTimer();
 if(gATR!=INVALID_HANDLE)IndicatorRelease(gATR);
 ObjectDelete(0,gButton);
}
void OnTimer(){
 long now=ABNowUTC();
 // Always manage own open positions, even if the web feed is unavailable.
 ABCloseIntraday(now);
 if(gLastPoll==0||now-gLastPoll>=InpWebPollSeconds){
  gLastPoll=now;
  bool ok=gTester?ABReadFile():ABReadWeb();
  if(!ok)ABStatus("NO_NEW_ENTRY: "+gError);
 }
 ABCheckEntry(now);
}
void OnTick(){ /* All timing is UTC OnTimer; no indicator direction filters. */ }
void OnChartEvent(const int id,const long &l,const double &d,const string &name){
 if(id!=CHARTEVENT_OBJECT_CLICK||name!=gButton)return;
 if(!gAuto){
  if(AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL&&!InpAllowRealAccount){
   ABStatus("REAL_ACCOUNT_LOCKED");ABPaint();return;
  }
  if(!InpEnableExperimentalAstro){
   ABStatus("EXPERIMENTAL_ASTRO_NOT_ACKNOWLEDGED");ABPaint();return;
  }
 }
 gAuto=!gAuto;ABPaint();ABStatus(gAuto?"AUTOPILOT_ON":"AUTOPILOT_OFF");
 // One real user click -> one notice. Never announce ON for a blocked request.
 if(InpNotifyAutopilot){
  string text="🦊 AL-BIRUNI INTRADAY\n"+
   (gAuto?"🟢 AUTOPILOT ON":"🔴 AUTOPILOT OFF")+"\n📊 "+InpSymbol;
  ABNotice(text); // Telegram and MT5 Push have independent enable switches.
 }
}
void OnTradeTransaction(const MqlTradeTransaction &trans,
 const MqlTradeRequest &request,const MqlTradeResult &result){
 if(trans.type!=TRADE_TRANSACTION_DEAL_ADD||trans.deal==0)return;
 if(!HistoryDealSelect(trans.deal))return;
 if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=InpSymbol||
    (ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=InpMagic)return;
 long entry=HistoryDealGetInteger(trans.deal,DEAL_ENTRY);
 long type=HistoryDealGetInteger(trans.deal,DEAL_TYPE);
 if(type!=DEAL_TYPE_BUY&&type!=DEAL_TYPE_SELL)return;
 bool open=entry==DEAL_ENTRY_IN;
 if(!open&&entry!=DEAL_ENTRY_OUT&&entry!=DEAL_ENTRY_OUT_BY)return;
 string side=(open?(type==DEAL_TYPE_BUY):(type==DEAL_TYPE_SELL))?"BUY":"SELL";
 ABTradeNotice(trans.deal,open,side,HistoryDealGetDouble(trans.deal,DEAL_PRICE));
}
