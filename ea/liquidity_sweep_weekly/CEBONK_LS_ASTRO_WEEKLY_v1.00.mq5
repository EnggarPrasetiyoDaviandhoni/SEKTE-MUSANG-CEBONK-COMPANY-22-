// CEBONK COMPANY 22 — LIQUIDITY SWEEP + ASTROLOGY MINGGUAN | v1.00
// Astrology weekly CSV = ONLY direction/time master; price action = sweep entry trigger.
// Closed M5 candle. SL 3*ATR(14), TP 4R. Friday close before final broker session.
#property strict
#property version "1.00"
#property description "CEBONK LS WEEKLY ASTRO: M5 sweep, ATR3 SL, RR4 TP, Friday close."
#property tester_file "CEBONK_ASTRO_WEEKLY.csv"
#include <Trade/Trade.mqh>

#define LS_WEEK_MODEL "CEBONK_ASTRO_WEEKLY_V1"
#define LS_MAX_WINDOWS 5

input group "01 | TRADE / SAFETY";
input string InpSymbol="XAUUSDc";
input ulong InpMagic=221024;
input bool InpAutopilot=false;
input bool InpAllowRealAccount=false;
input double InpFixedLot=0.01;
input int InpMaxOpenPositions=1;
input int InpMaxSpreadPoints=70;
input int InpDeviationPoints=30;

input group "02 | SWEEP M5 / ATR RISK";
input int InpSweepLookback=12;
input int InpATRPeriod=14;
input double InpSL_ATR=3.0;
input double InpRR=4.0;

input group "03 | ASTROLOGY MINGGUAN (SENIN-JUMAT WIB)";
input string InpWeeklyCSV="CEBONK_ASTRO_WEEKLY.csv";
input bool InpCSVCommonFolder=false;
input int InpServerUTCMinutes=180;  // Tester / fixed GMT+3. Live computes offset.
input int InpRefreshSeconds=30;

input group "04 | JUMAT CLOSE OTOMATIS";
input bool InpFridayAutoClose=true;
input int InpFridayCloseBeforeMinutes=5;

input group "05 | TELEGRAM / MT5";
input bool InpTelegram=false;
input string InpTelegramToken="";
input string InpTelegramChatID="";
input bool InpMT5Push=true;
input int InpHTTPTimeoutMs=3000;

struct LSWindow {long start,core,end;int direction;string date;};
LSWindow gWindow[];
CTrade gTrade;
int gATR=INVALID_HANDLE;
bool gTester=false,gAuto=false,gCSVValid=false;
string gButton="",gScope="",gStatus="";
long gLastClosedBar=0,gNextCSVRead=0,gLastCloseAttempt=0;

void LSStatus(const string s){
 if(gStatus==s)return;
 gStatus=s;Print("LS WEEKLY | ",s);
 if(ObjectFind(0,gButton)>=0)ObjectSetString(0,gButton,OBJPROP_TOOLTIP,s);
}
string LSJson(const string s){
 string r="\"";
 for(int i=0;i<StringLen(s);i++){
  ushort c=StringGetCharacter(s,i);
  if(c==34)r+="\\\"";else if(c==92)r+="\\\\";
  else if(c==10)r+="\\n";else if(c==13)r+="\\r";else if(c==9)r+="\\t";
  else if(c<32)r+=StringFormat("\\u%04X",(int)c);else r+=ShortToString(c);
 }
 return r+"\"";
}
void LSNotify(const string message){
 Print("LS WEEKLY | ",message);
 if(gTester)return;
 string text="SEKTE MUSANG CEBONK COMPANY 22\nLIQUIDITY SWEEP + ASTROLOGY MINGGUAN\n"+InpSymbol+"\n"+message;
 if(InpMT5Push&&!SendNotification(StringSubstr(text,0,250)))Print("LS WEEKLY | PUSH_FAILED");
 if(!InpTelegram||InpTelegramToken==""||InpTelegramChatID=="")return;
 string json="{\"chat_id\":"+LSJson(InpTelegramChatID)+",\"text\":"+LSJson(text)+"}";
 char bytes[],response[];string headers;
 int len=StringToCharArray(json,bytes,0,WHOLE_ARRAY,CP_UTF8);
 if(len>0)ArrayResize(bytes,len-1);
 ResetLastError();
 int code=WebRequest("POST","https://api.telegram.org/bot"+InpTelegramToken+"/sendMessage",
                     "Content-Type: application/json\r\n",InpHTTPTimeoutMs,bytes,response,headers);
 if(code!=200)Print("LS WEEKLY | TELEGRAM_FAILED HTTP=",code," err=",GetLastError()," (token hidden)");
}
long LSServerNow(){
 long t=(long)TimeTradeServer();
 return (gTester||t<=0)?(long)TimeCurrent():t;
}
int LSServerOffset(){
 if(gTester)return InpServerUTCMinutes*60;
 return (int)MathRound((double)(LSServerNow()-(long)TimeGMT())/900.0)*900;
}
long LSNowUTC(){return gTester?LSServerNow()-LSServerOffset():(long)TimeGMT();}
string LSDateWIB(const long utc){
 string s=TimeToString((datetime)(utc+7*3600),TIME_DATE);
 StringReplace(s,".","-");return s;
}
string LSMondayWIB(const long utc){
 long local=utc+7*3600;MqlDateTime d;TimeToStruct((datetime)local,d);
 if(d.day_of_week<1||d.day_of_week>5)return "";
 long monday=local-(d.day_of_week-1)*86400-d.hour*3600-d.min*60-d.sec;
 return LSDateWIB(monday-7*3600);
}
bool LSDigits(const string s){
 if(StringLen(s)<1||StringLen(s)>14)return false;
 for(int i=0;i<StringLen(s);i++){ushort c=StringGetCharacter(s,i);if(c<48||c>57)return false;}
 return true;
}
bool LSLoadWeekly(){
 ArrayResize(gWindow,0);gCSVValid=false;
 int mode=FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ;
 if(InpCSVCommonFolder&&!gTester)mode|=FILE_COMMON;
 int f=FileOpen(InpWeeklyCSV,mode,0,CP_UTF8);
 if(f==INVALID_HANDLE){LSStatus("ASTRO_WEEKLY_CSV_MISSING (NO ENTRY)");return false;}
 string head=FileReadString(f);StringTrimLeft(head);StringTrimRight(head);
 if(StringLen(head)>0&&StringGetCharacter(head,0)==65279)head=StringSubstr(head,1);
 const string expected="week_monday_wib,week_direction,date_wib,start_epoch,core_epoch,end_epoch,window_direction,model";
 if(head!=expected){FileClose(f);LSStatus("ASTRO_WEEKLY_HEADER_INVALID");return false;}
 LSWindow rows[];string week="",direction="";
 bool valid=true;
 while(!FileIsEnding(f)){
  string line=FileReadString(f);StringTrimLeft(line);StringTrimRight(line);
  if(line=="")continue;
  string v[];
  if(StringSplit(line,44,v)!=8||!LSDigits(v[3])||!LSDigits(v[4])||!LSDigits(v[5])||
     (v[1]!="BUY"&&v[1]!="SELL")||v[6]!=v[1]||v[7]!=LS_WEEK_MODEL){valid=false;break;}
  long start=StringToInteger(v[3]),core=StringToInteger(v[4]),end=StringToInteger(v[5]);
  if(start<946684800||start%300!=0||core%300!=0||end%300!=0||
     core<start||core>=end||end-start<1800||end-start>18*3600){valid=false;break;}
  MqlDateTime d;long local=start+7*3600;TimeToStruct((datetime)local,d);
  long midnight=local-d.hour*3600-d.min*60-d.sec;
  if(d.day_of_week<1||d.day_of_week>5||d.hour<6||end+7*3600>midnight+86400||
     v[2]!=LSDateWIB(start)||v[0]!=LSMondayWIB(start)){valid=false;break;}
  if(week!=""&&(v[0]!=week||v[1]!=direction)){valid=false;break;}
  week=v[0];direction=v[1];
  int n=ArraySize(rows);if(n>=LS_MAX_WINDOWS){valid=false;break;}
  ArrayResize(rows,n+1);rows[n].start=start;rows[n].core=core;rows[n].end=end;
  rows[n].direction=v[1]=="BUY"?1:-1;rows[n].date=v[2];
 }
 FileClose(f);
 if(valid){
  for(int i=0;i<ArraySize(rows);i++)
   for(int j=i+1;j<ArraySize(rows);j++)
    if(rows[i].start<rows[j].end&&rows[j].start<rows[i].end)valid=false;
 }
 if(!valid||ArraySize(rows)<1){LSStatus("ASTRO_WEEKLY_CSV_INVALID_OR_EMPTY (NO ENTRY)");return false;}
 ArrayResize(gWindow,ArraySize(rows));
 for(int i=0;i<ArraySize(rows);i++)gWindow[i]=rows[i];
 gCSVValid=true;
 LSStatus("ASTRO_WEEKLY_LOADED "+week+" "+direction+" windows="+(string)ArraySize(gWindow));
 return true;
}
void LSPollCSV(){
 long now=(long)TimeLocal();
 if(gTester)now=LSServerNow();
 if(now<gNextCSVRead)return;
 gNextCSVRead=now+InpRefreshSeconds;
 LSLoadWeekly();  // Every reload fails closed, never carry stale model windows.
}
int LSActiveWindow(const long nowUtc){
 if(!gCSVValid)return -1;
 for(int i=0;i<ArraySize(gWindow);i++)
  if(nowUtc>=gWindow[i].start&&nowUtc<gWindow[i].end)return i;
 return -1;
}
bool LSFridaySessionEnd(const long now,long &endAt){
 MqlDateTime d;TimeToStruct((datetime)now,d);
 if(d.day_of_week!=5&&d.day_of_week!=6)return false;
 long midnight=now-d.hour*3600-d.min*60-d.sec;
 long friday=midnight-(d.day_of_week==6?86400:0);
 int latest=-1;
 for(uint i=0;i<24;i++){
  datetime from=0,to=0;
  if(!SymbolInfoSessionTrade(InpSymbol,FRIDAY,i,from,to))break;
  int a=(int)((long)from%86400),b=(int)((long)to%86400);
  if(b==0)b=86400;
  if(b<=a)b+=86400;
  if(b>latest)latest=b;
 }
 if(latest<0)return false;
 endAt=friday+latest;return true;
}
bool LSFridayEntryBlocked(const long now){
 if(!InpFridayAutoClose)return false;
 MqlDateTime d;TimeToStruct((datetime)now,d);
 if(d.day_of_week!=5&&d.day_of_week!=6)return false;
 long endAt=0;
 if(!LSFridaySessionEnd(now,endAt)){LSStatus("FRIDAY_SESSION_UNKNOWN: ENTRIES BLOCKED");return true;}
 return now>=endAt-InpFridayCloseBeforeMinutes*60;
}
void LSFridayClose(){
 if(!InpFridayAutoClose)return;
 long now=LSServerNow(),endAt=0;
 if(!LSFridaySessionEnd(now,endAt))return;
 if(now<endAt-InpFridayCloseBeforeMinutes*60||now>endAt+3600||
    now-gLastCloseAttempt<10)return;
 gLastCloseAttempt=now;
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);
  if(ticket==0||PositionGetString(POSITION_SYMBOL)!=InpSymbol||
     (ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic)continue;
  gTrade.SetExpertMagicNumber(InpMagic);
  gTrade.SetDeviationInPoints(InpDeviationPoints);
  gTrade.SetTypeFillingBySymbol(InpSymbol);
  bool ok=gTrade.PositionClose(ticket,InpDeviationPoints);
  uint rc=gTrade.ResultRetcode();
  if(!ok||(rc!=TRADE_RETCODE_DONE&&rc!=TRADE_RETCODE_DONE_PARTIAL&&rc!=TRADE_RETCODE_PLACED))
   LSStatus("FRIDAY_CLOSE_FAILED ticket="+(string)ticket+" retcode="+(string)rc);
  else LSStatus("FRIDAY_CLOSE_SENT ticket="+(string)ticket);
 }
}
bool LSCanOpen(const int dir,const MqlTick &tick,string &reason){
 reason="";
 if(!gAuto){reason="AUTOPILOT_OFF";return false;}
 if(!InpAllowRealAccount&&AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL){
  reason="REAL_ACCOUNT_LOCKED";return false;
 }
 if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)||!MQLInfoInteger(MQL_TRADE_ALLOWED)||
    !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_EXPERT)){
  reason="ALGO_TRADING_DISABLED";return false;
 }
 double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
 if(point<=0||tick.bid<=0||tick.ask<tick.bid||
    (tick.ask-tick.bid)/point>InpMaxSpreadPoints){reason="SPREAD_OR_TICK_INVALID";return false;}
 long mode=SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_MODE);
 if(mode==SYMBOL_TRADE_MODE_DISABLED||mode==SYMBOL_TRADE_MODE_CLOSEONLY||
    (dir>0&&mode==SYMBOL_TRADE_MODE_SHORTONLY)||(dir<0&&mode==SYMBOL_TRADE_MODE_LONGONLY)){
  reason="SYMBOL_TRADE_DIRECTION_DISABLED";return false;
 }
 int count=0;
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);
  if(ticket==0||PositionGetString(POSITION_SYMBOL)!=InpSymbol)continue;
  if((ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic){reason="OTHER_POSITION_ON_SYMBOL";return false;}
  count++;
 }
 for(int i=OrdersTotal()-1;i>=0;i--){
  ulong order=OrderGetTicket(i);
  if(order>0&&OrderGetString(ORDER_SYMBOL)==InpSymbol){reason="PENDING_ORDER_ON_SYMBOL";return false;}
 }
 if(count>=InpMaxOpenPositions){reason="POSITION_LIMIT";return false;}
 return true;
}
double LSRoundPrice(const double price,const bool roundUp){
 double step=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_SIZE);
 int digits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
 if(step<=0)return 0;
 double ticks=roundUp?MathCeil(price/step-1.e-9):MathFloor(price/step+1.e-9);
 return NormalizeDouble(ticks*step,digits);
}
void LSEvaluate(){
 MqlRates bars[];ArraySetAsSeries(bars,false);
 int got=CopyRates(InpSymbol,PERIOD_M5,1,InpSweepLookback+1,bars);
 if(got<InpSweepLookback+1)return;
 MqlRates signal=bars[got-1];
 if((long)signal.time==gLastClosedBar)return;
 gLastClosedBar=(long)signal.time;
 long now=LSServerNow();
 if(LSFridayEntryBlocked(now))return;
 long nowUtc=LSNowUTC(),eventUtc=(long)signal.time+PeriodSeconds(PERIOD_M5)-LSServerOffset();
 int window=LSActiveWindow(nowUtc);
 if(window<0)return;
 LSWindow w=gWindow[window];
 if(eventUtc<w.start||eventUtc>=w.end)return;
 MqlDateTime day;TimeToStruct((datetime)(nowUtc+7*3600),day);
 if(day.day_of_week<1||day.day_of_week>5)return;

 double low=bars[0].low,high=bars[0].high;
 for(int i=1;i<got-1;i++){low=MathMin(low,bars[i].low);high=MathMax(high,bars[i].high);}
 bool sweptLow=signal.low<low&&signal.close>low;
 bool sweptHigh=signal.high>high&&signal.close<high;
 if(sweptLow==sweptHigh)return; // Neither side, or two-sided ambiguous sweep.
 int dir=sweptLow?1:-1;
 if(dir!=w.direction)return;
 double atr[];ArraySetAsSeries(atr,true);
 if(CopyBuffer(gATR,0,1,1,atr)!=1||!MathIsValidNumber(atr[0])||atr[0]<=0)return;
 MqlTick tick;
 if(!SymbolInfoTick(InpSymbol,tick))return;
 string reason="";
 if(!LSCanOpen(dir,tick,reason)){LSStatus(reason);return;}
 double step=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_STEP),
        minlot=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MIN),maxlot=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MAX);
 if(step<=0||InpFixedLot<minlot||InpFixedLot>maxlot){LSStatus("LOT_INVALID");return;}
 double lot=NormalizeDouble(MathFloor(InpFixedLot/step+1.e-8)*step,8);
 if(lot<minlot||lot>maxlot){LSStatus("LOT_STEP_INVALID");return;}
 double entry=dir>0?tick.ask:tick.bid;
 double distance=atr[0]*InpSL_ATR;
 double sl=LSRoundPrice(dir>0?entry-distance:entry+distance,dir<0);
 double risk=dir>0?entry-sl:sl-entry;
 if(sl<=0||risk<=0)return;
 double tp=LSRoundPrice(dir>0?entry+risk*InpRR:entry-risk*InpRR,dir>0);
 double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
 double minstop=(SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_STOPS_LEVEL)+1)*point;
 if(point<=0||tp<=0||
    (dir>0&&(tick.bid-sl<minstop||tp-tick.bid<minstop))||
    (dir<0&&(sl-tick.ask<minstop||tick.ask-tp<minstop))){
  LSStatus("BROKER_MIN_STOP_OR_INVALID_PRICE");return;
 }
 string key=gScope+(string)((long)signal.time);
 if(!gTester&&GlobalVariableCheck(key)){LSStatus("SIGNAL_ALREADY_TRADED");return;}
 gTrade.SetExpertMagicNumber(InpMagic);
 gTrade.SetDeviationInPoints(InpDeviationPoints);
 gTrade.SetAsyncMode(false);
 if(!gTrade.SetTypeFillingBySymbol(InpSymbol)){LSStatus("FILLING_MODE_UNSUPPORTED");return;}
 string comment="LSW "+(dir>0?"BUY":"SELL")+" "+(string)((long)signal.time);
 bool ok=dir>0?gTrade.Buy(lot,InpSymbol,entry,sl,tp,comment):
               gTrade.Sell(lot,InpSymbol,entry,sl,tp,comment);
 uint rc=gTrade.ResultRetcode();
 if(!ok||(rc!=TRADE_RETCODE_DONE&&rc!=TRADE_RETCODE_DONE_PARTIAL&&rc!=TRADE_RETCODE_PLACED)){
  LSStatus("ORDER_REJECTED code="+(string)rc);return;
 }
 if(!gTester){GlobalVariableSet(key,(double)now);GlobalVariablesFlush();}
 LSStatus("ENTRY_SENT "+(dir>0?"BUY":"SELL")+" ATR="+DoubleToString(atr[0],3)+
          " SL="+DoubleToString(sl,(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS))+
          " TP="+DoubleToString(tp,(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS))+
          " ASTRO="+w.date+" MULAI/INTI/AKHIR");
}
void LSPaint(){
 if(ObjectFind(0,gButton)<0)return;
 ObjectSetString(0,gButton,OBJPROP_TEXT,gAuto?"AUTOPILOT ON":"AUTOPILOT OFF");
 ObjectSetInteger(0,gButton,OBJPROP_BGCOLOR,gAuto?clrDarkGreen:clrFireBrick);
 ObjectSetInteger(0,gButton,OBJPROP_STATE,false);
}
int OnInit(){
 gTester=(bool)MQLInfoInteger(MQL_TESTER);
 gAuto=InpAutopilot;
 if(_Symbol!=InpSymbol||InpSymbol==""||InpMagic==0||InpFixedLot<=0||
    InpMaxOpenPositions<1||InpMaxOpenPositions>5||InpMaxSpreadPoints<1||
    InpDeviationPoints<0||InpSweepLookback<3||InpSweepLookback>100||
    InpATRPeriod<2||InpATRPeriod>100||InpSL_ATR<=0||InpSL_ATR>10||
    InpRR<1||InpRR>10||InpServerUTCMinutes< -720||InpServerUTCMinutes>840||
    InpFridayCloseBeforeMinutes<1||InpFridayCloseBeforeMinutes>120||
    InpRefreshSeconds<10||InpRefreshSeconds>3600||
    InpWeeklyCSV==""||InpHTTPTimeoutMs<500)return INIT_PARAMETERS_INCORRECT;
 gScope="CEBONK.LSW."+(string)AccountInfoInteger(ACCOUNT_LOGIN)+"."+(string)InpMagic+".";
 gButton="CEBONK_LSW_"+(string)ChartID();
 gATR=iATR(InpSymbol,PERIOD_M5,InpATRPeriod);
 if(gATR==INVALID_HANDLE)return INIT_FAILED;
 if(!gTester){
  ObjectCreate(0,gButton,OBJ_BUTTON,0,0,0);
  ObjectSetInteger(0,gButton,OBJPROP_CORNER,CORNER_RIGHT_UPPER);
  ObjectSetInteger(0,gButton,OBJPROP_XDISTANCE,12);
  ObjectSetInteger(0,gButton,OBJPROP_YDISTANCE,18);
  ObjectSetInteger(0,gButton,OBJPROP_XSIZE,126);
  ObjectSetInteger(0,gButton,OBJPROP_YSIZE,30);LSPaint();
 }
 gLastClosedBar=(long)iTime(InpSymbol,PERIOD_M5,1);
 gTrade.SetExpertMagicNumber(InpMagic);
 gTrade.SetDeviationInPoints(InpDeviationPoints);
 gTrade.SetAsyncMode(false);
 EventSetTimer(5);
 LSPollCSV();
 LSStatus("INITIALIZED | weekly CSV required | Friday close ON="+(InpFridayAutoClose?"YES":"NO"));
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){
 EventKillTimer();if(gATR!=INVALID_HANDLE)IndicatorRelease(gATR);
 if(ObjectFind(0,gButton)>=0)ObjectDelete(0,gButton);
}
void LSPulse(){
 LSFridayClose(); // Always active for OWN positions, including when AUTOPILOT OFF.
 LSPollCSV();
 LSEvaluate();
}
void OnTick(){LSPulse();}
void OnTimer(){LSPulse();}
void OnChartEvent(const int id,const long &l,const double &d,const string &s){
 if(id!=CHARTEVENT_OBJECT_CLICK||s!=gButton)return;
 gAuto=!gAuto;LSPaint();LSStatus(gAuto?"AUTOPILOT_ON":"AUTOPILOT_OFF");
}
void OnTradeTransaction(const MqlTradeTransaction &trans,const MqlTradeRequest &request,const MqlTradeResult &result){
 if(trans.type!=TRADE_TRANSACTION_DEAL_ADD||trans.deal==0||!HistoryDealSelect(trans.deal))return;
 if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=InpSymbol||
    (ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=InpMagic)return;
 long entry=HistoryDealGetInteger(trans.deal,DEAL_ENTRY);
 long reason=HistoryDealGetInteger(trans.deal,DEAL_REASON);
 double price=HistoryDealGetDouble(trans.deal,DEAL_PRICE);
 int digits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
 if(entry==DEAL_ENTRY_IN||entry==DEAL_ENTRY_INOUT){
  LSNotify("ENTRY "+(HistoryDealGetInteger(trans.deal,DEAL_TYPE)==DEAL_TYPE_BUY?"BUY":"SELL")+
   " @ "+DoubleToString(price,digits)+" | SL 3xATR | TP RR 1:4");
 }
 if(entry==DEAL_ENTRY_OUT||entry==DEAL_ENTRY_OUT_BY||entry==DEAL_ENTRY_INOUT){
  string action=reason==DEAL_REASON_TP?"TAKE PROFIT":reason==DEAL_REASON_SL?"STOP LOSS":
    "POSITION CLOSED (incl. Friday auto-close)";
  LSNotify(action+" @ "+DoubleToString(price,digits));
 }
}
