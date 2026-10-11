// CEBONK COMPANY 22 | LIQUIDITY SWEEP + ASTROLOGY MINGGUAN | v2.00
// Standalone MT5 EA. ONLY the validated CSV controls BUY/SELL and MULAI-INTI-AKHIR.
// Weekly Astrology V1 is experimental and NOT a validated financial predictor.
#property strict
#property version "2.00"
#property description "M5 sweep, Astrology weekly CSV, SL ATR 3, TP 4R, Friday auto-close"

#include "LSNotify.mqh"

input group "01 | TRADE"
input string InpSymbol="XAUUSDc";
input ulong InpMagic=221024;
input bool InpAutopilot=false;
input bool InpAllowRealAccount=false;
input double InpFixedLot=0.01;
input int InpMaxPositions=3;
input int InpMaxSpreadPoints=70;
input int InpDeviationPoints=30;

input group "02 | LIQUIDITY SWEEP M5 (RELAXED)"
input int InpSweepLookback=10;
input int InpMinPiercePoints=1;

input group "03 | ATR STOPS"
input int InpATRPeriod=14;
input double InpSL_ATR=3.0;
input double InpRR=4.0;

input group "04 | ASTROLOGY WEEKLY CSV"
input string InpWeeklyCSV="CEBONK_ASTRO_WEEKLY.csv";
input bool InpAcceptExperimentalAstro=true;
input bool InpLiveAutoBrokerUTC=true;
input int InpBrokerUTCMinutes=180;

input group "05 | CLOSE BEFORE WEEKEND"
input bool InpFridayAutoClose=true;
input int InpFridayBufferMinutes=5;
input int InpFallbackFridayCloseHour=23;
input int InpFallbackFridayCloseMinute=55;

input group "06 | TELEGRAM + MT5"
input bool InpTelegram=true;
input string InpTelegramToken="";
input string InpTelegramChatID="";
input bool InpMT5Push=true;
input int InpHTTPTimeoutMs=3000;

struct LSWeekWindow {
 long from,core,to;
 int dir;
 string monday,date;
};
LSWeekWindow gWindows[];
bool gAuto=false,gTester=false,gWeekOK=false;
string gWeekError="ASTRO_WEEKLY_CSV_NOT_LOADED";
string gButton="",gScope="",gStatus="";
int gAtr=INVALID_HANDLE;
long gLastM5=0,gLastAcceptedSweep=0,gLastRead=0;

string LSDirection(const int d){return d>0?"BUY":d<0?"SELL":"WAIT";}
string LSISODate(const long utc){
 MqlDateTime d;TimeToStruct((datetime)(utc+7*3600),d);
 return StringFormat("%04d-%02d-%02d",d.year,d.mon,d.day);
}
int LSWeekday(const long utc){
 MqlDateTime d;TimeToStruct((datetime)(utc+7*3600),d);return d.day_of_week;
}
bool LSDigits(const string s){
 if(StringLen(s)<1||StringLen(s)>20)return false;
 for(int i=0;i<StringLen(s);i++){ushort c=StringGetCharacter(s,i);if(c<48||c>57)return false;}
 return true;
}
int LSOffsetSeconds(){
 if(gTester||!InpLiveAutoBrokerUTC)return InpBrokerUTCMinutes*60;
 long delta=(long)TimeTradeServer()-(long)TimeGMT();
 return (int)MathRound((double)delta/900.0)*900;
}
long LSNowUTC(){
 if(gTester)return (long)TimeCurrent()-LSOffsetSeconds();
 return (long)TimeGMT();
}
bool LSReadWeek(){
 int f=FileOpen(InpWeeklyCSV,FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ,0,CP_UTF8);
 if(f==INVALID_HANDLE){
  gWeekOK=false;gWeekError="ASTRO_WEEKLY_CSV_NOT_FOUND";
  ArrayResize(gWindows,0);return false;
 }
 string header=FileReadString(f);StringTrimLeft(header);StringTrimRight(header);
 if(StringLen(header)>0&&StringGetCharacter(header,0)==65279)header=StringSubstr(header,1);
 bool valid=header=="monday,week_direction,date,start_epoch,core_epoch,end_epoch,model";
 LSWeekWindow next[];int weekDir=0;string monday="";
 while(valid&&!FileIsEnding(f)){
  string line=FileReadString(f);StringTrimLeft(line);StringTrimRight(line);
  if(line=="")continue;
  string p[];
  if(StringSplit(line,44,p)!=7||!LSDigits(p[3])||!LSDigits(p[4])||!LSDigits(p[5])||
     p[6]!="ASTRO_WEEKLY_V1"){valid=false;break;}
  LSWeekWindow w;
  w.monday=p[0];w.date=p[2];w.from=StringToInteger(p[3]);
  w.core=StringToInteger(p[4]);w.to=StringToInteger(p[5]);
  w.dir=p[1]=="BUY"?1:p[1]=="SELL"?-1:0;
  int dow=LSWeekday(w.from);
  if(w.dir==0||w.from<946684800||w.to<=w.from||w.core<w.from||w.core>=w.to||
     w.from%300!=0||w.core%300!=0||w.to%300!=0||
     dow<1||dow>5||LSISODate(w.from)!=w.date||
     LSISODate(w.to-1)!=w.date||
     w.monday!=LSISODate(w.from-(dow-1)*86400)||
     (weekDir!=0&&weekDir!=w.dir)||(monday!=""&&monday!=w.monday)||
     ArraySize(next)>=5){valid=false;break;}
  for(int i=0;i<ArraySize(next);i++){
   if(w.from<next[i].to&&w.to>next[i].from){valid=false;break;}
  }
  if(!valid)break;
  weekDir=w.dir;monday=w.monday;
  int n=ArraySize(next);ArrayResize(next,n+1);next[n]=w;
 }
 FileClose(f);
 if(!valid||ArraySize(next)<1){
  ArrayResize(gWindows,0);gWeekOK=false;gWeekError="ASTRO_WEEKLY_CSV_INVALID";return false;
 }
 ArrayResize(gWindows,ArraySize(next));
 for(int i=0;i<ArraySize(next);i++)gWindows[i]=next[i];
 gWeekOK=true;gWeekError="";
 return true;
}
int LSWindowAt(const long utc){
 if(!gWeekOK||!InpAcceptExperimentalAstro)return -1;
 int dow=LSWeekday(utc);if(dow<1||dow>5)return -1;
 for(int i=0;i<ArraySize(gWindows);i++)
  if(utc>=gWindows[i].from&&utc<gWindows[i].to)return i;
 return -1;
}
void LSStatus(const string msg){
 if(msg==gStatus)return;
 gStatus=msg;Print("CEBONK WEEKLY LS | ",msg);
 if(ObjectFind(0,gButton)>=0)ObjectSetString(0,gButton,OBJPROP_TOOLTIP,msg);
}
void LSPaint(){
 if(ObjectFind(0,gButton)<0)return;
 ObjectSetString(0,gButton,OBJPROP_TEXT,gAuto?"AUTOPILOT ON":"AUTOPILOT OFF");
 ObjectSetInteger(0,gButton,OBJPROP_BGCOLOR,gAuto?clrDarkGreen:clrFireBrick);
 ObjectSetInteger(0,gButton,OBJPROP_STATE,false);
}
bool LSNettingAccount(){
 long margin=AccountInfoInteger(ACCOUNT_MARGIN_MODE);
 return margin!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING;
}
bool LSForeignPosition(){
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);
  if(ticket>0&&PositionGetString(POSITION_SYMBOL)==InpSymbol&&
     (ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic)return true;
 }
 return false;
}
int LSOwnPositions(){
 int count=0;
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);
  if(ticket>0&&PositionGetString(POSITION_SYMBOL)==InpSymbol&&
     (ulong)PositionGetInteger(POSITION_MAGIC)==InpMagic)count++;
 }
 return count;
}
ENUM_ORDER_TYPE_FILLING LSFillMode(bool &ok){
 ok=true;
 long modes=SymbolInfoInteger(InpSymbol,SYMBOL_FILLING_MODE);
 if((modes&SYMBOL_FILLING_IOC)!=0)return ORDER_FILLING_IOC;
 if((modes&SYMBOL_FILLING_FOK)!=0)return ORDER_FILLING_FOK;
 if(SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_EXEMODE)!=SYMBOL_TRADE_EXECUTION_MARKET)
  return ORDER_FILLING_RETURN;
 ok=false;return ORDER_FILLING_FOK;
}
double LSTickRound(const double p,const bool up){
 double step=SymbolInfoDouble(InpSymbol,SYMBOL_TRADE_TICK_SIZE);
 if(step<=0)return 0;
 double v=up?MathCeil(p/step-1e-9):MathFloor(p/step+1e-9);
 return NormalizeDouble(v*step,(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS));
}
int LSFridayLastSecond(){
 datetime from,to;int last=-1;
 for(uint i=0;i<24;i++){
  if(!SymbolInfoSessionTrade(InpSymbol,FRIDAY,i,from,to))break;
  int s=(int)((long)to%86400);
  if(s==0)s=86400;
  if(s>last)last=s;
 }
 if(last>0)return last;
 return InpFallbackFridayCloseHour*3600+InpFallbackFridayCloseMinute*60;
}
bool LSFridayCutoff(){
 if(!InpFridayAutoClose)return false;
 long now=(long)TimeTradeServer();if(now<=0)now=(long)TimeCurrent();
 MqlDateTime d;TimeToStruct((datetime)now,d);
 if(d.day_of_week!=FRIDAY)return false;
 int current=d.hour*3600+d.min*60+d.sec;
 int deadline=LSFridayLastSecond()-InpFridayBufferMinutes*60;
 return current>=MathMax(0,deadline);
}
bool LSTradeAllowed(){
 return TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)&&
        MQLInfoInteger(MQL_TRADE_ALLOWED)&&
        AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)&&
        AccountInfoInteger(ACCOUNT_TRADE_EXPERT);
}
void LSCloseFriday(){
 if(!LSFridayCutoff()||!LSTradeAllowed())return;
 bool fillOk=false;
 ENUM_ORDER_TYPE_FILLING filling=LSFillMode(fillOk);
 if(!fillOk){LSStatus("FRIDAY_CLOSE_FILLING_UNSUPPORTED");return;}
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);if(ticket==0)continue;
  if(PositionGetString(POSITION_SYMBOL)!=InpSymbol||
     (ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic)continue;
  MqlTick q;if(!SymbolInfoTick(InpSymbol,q)||q.ask<=0||q.bid<=0)continue;
  long type=PositionGetInteger(POSITION_TYPE);
  MqlTradeRequest req={};MqlTradeResult res={};
  req.action=TRADE_ACTION_DEAL;req.symbol=InpSymbol;req.position=ticket;
  req.magic=InpMagic;req.volume=PositionGetDouble(POSITION_VOLUME);
  req.type=type==POSITION_TYPE_BUY?ORDER_TYPE_SELL:ORDER_TYPE_BUY;
  req.price=type==POSITION_TYPE_BUY?q.bid:q.ask;
  req.type_filling=filling;req.deviation=(ulong)InpDeviationPoints;
  req.comment="CEBONK FRIDAY AUTO CLOSE";
  ResetLastError();
  bool sent=OrderSend(req,res);
  if(!sent||(res.retcode!=TRADE_RETCODE_DONE&&res.retcode!=TRADE_RETCODE_DONE_PARTIAL))
   LSStatus("FRIDAY_CLOSE_RETRY retcode="+(string)res.retcode+" err="+(string)GetLastError());
  else LSNotice("FRIDAY_CLOSE","Close posisi EA ticket "+(string)ticket+
    " sebelum market tutup; ora ngenteni TP.",InpSymbol,gTester,gAuto);
 }
}
int LSSweepDirection(long &barTime,double &extreme){
 MqlRates r[];ArraySetAsSeries(r,true);
 int n=CopyRates(InpSymbol,PERIOD_M5,1,InpSweepLookback+1,r);
 if(n<InpSweepLookback+1)return 0;
 double low=r[1].low,high=r[1].high;
 for(int i=2;i<=InpSweepLookback;i++){
  if(r[i].low<low)low=r[i].low;
  if(r[i].high>high)high=r[i].high;
 }
 double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
 if(point<=0)return 0;
 double pierce=InpMinPiercePoints*point;
 bool buy=r[0].low<=low-pierce&&r[0].close>low;
 bool sell=r[0].high>=high+pierce&&r[0].close<high;
 if(buy==sell)return 0;
 barTime=(long)r[0].time;
 extreme=buy?r[0].low:r[0].high;
 return buy?1:-1;
}
bool LSPlace(const int dir,const double atr,const long sweepTime,const int wi,string &reason){
 reason="";
 if(!gAuto){reason="AUTOPILOT_OFF";return false;}
 if(!InpAllowRealAccount&&AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL){
  reason="REAL_ACCOUNT_LOCKED";return false;
 }
 if(!LSTradeAllowed()){reason="ALGO_TRADE_DISABLED";return false;}
 if(LSFridayCutoff()){reason="FRIDAY_CUTOFF";return false;}
 if(LSNettingAccount()&&LSForeignPosition()){reason="NETTING_SYMBOL_OCCUPIED";return false;}
 if(LSOwnPositions()>=(LSNettingAccount()?1:InpMaxPositions)){
  reason="MAX_OWN_POSITIONS";return false;
 }
 MqlTick q; if(!SymbolInfoTick(InpSymbol,q)||q.ask<=q.bid||q.bid<=0){
  reason="INVALID_QUOTES";return false;
 }
 double point=SymbolInfoDouble(InpSymbol,SYMBOL_POINT);
 if(point<=0||(q.ask-q.bid)/point>InpMaxSpreadPoints){
  reason="SPREAD_GUARD";return false;
 }
 long mode=SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_MODE);
 if(mode==SYMBOL_TRADE_MODE_DISABLED||mode==SYMBOL_TRADE_MODE_CLOSEONLY||
    (dir>0&&mode==SYMBOL_TRADE_MODE_SHORTONLY)||
    (dir<0&&mode==SYMBOL_TRADE_MODE_LONGONLY)){reason="TRADE_DIRECTION_DISABLED";return false;}
 double minLot=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MIN);
 double maxLot=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_MAX);
 double step=SymbolInfoDouble(InpSymbol,SYMBOL_VOLUME_STEP);
 if(step<=0||InpFixedLot<minLot||InpFixedLot>maxLot||
    MathAbs(MathRound(InpFixedLot/step)*step-InpFixedLot)>0.00000001){
  reason="INVALID_FIXED_LOT";return false;
 }
 double entry=dir>0?q.ask:q.bid,risk=InpSL_ATR*atr;
 double sl=LSTickRound(entry+(dir>0?-risk:risk),dir<0);
 if(sl<=0){reason="INVALID_SL";return false;}
 // Preserve at least 1:4 AFTER tick rounding, not less.
 double actualRisk=MathAbs(entry-sl);
 if(actualRisk<=0||(dir>0&&sl>=entry)||(dir<0&&sl<=entry)){
  reason="SL_WRONG_SIDE";return false;
 }
 double tp=LSTickRound(entry+(dir>0?actualRisk*InpRR:-actualRisk*InpRR),dir>0);
 double stop=(SymbolInfoInteger(InpSymbol,SYMBOL_TRADE_STOPS_LEVEL)+1)*point;
 if(tp<=0||(dir>0&&(q.bid-sl<stop||tp-q.bid<stop))||
           (dir<0&&(sl-q.ask<stop||q.ask-tp<stop))){
  reason="BROKER_MIN_STOPS";return false;
 }
 bool fillingOK=false;ENUM_ORDER_TYPE_FILLING fill=LSFillMode(fillingOK);
 if(!fillingOK){reason="UNSUPPORTED_FILLING";return false;}
 MqlTradeRequest req={};MqlTradeCheckResult chk={};MqlTradeResult res={};
 req.action=TRADE_ACTION_DEAL;req.symbol=InpSymbol;req.magic=InpMagic;
 req.volume=InpFixedLot;req.price=entry;
 req.type=dir>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
 req.sl=sl;req.tp=tp;req.type_filling=fill;
 req.deviation=(ulong)InpDeviationPoints;
 req.comment="WLS-"+(string)sweepTime;
 if(!OrderCheck(req,chk)){reason="ORDER_CHECK_"+(string)chk.retcode;return false;}
 if(!OrderSend(req,res)||(res.retcode!=TRADE_RETCODE_DONE&&res.retcode!=TRADE_RETCODE_DONE_PARTIAL)){
  reason="ORDER_SEND_"+(string)res.retcode;return false;
 }
 gLastAcceptedSweep=sweepTime;
 if(!gTester)GlobalVariableSet(gScope+"LAST_SWEEP",(double)sweepTime);
 int digits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS);
 LSNotice("ENTRY_FILLED",LSDirection(dir)+" | LS M5 + ASTRO WEEKLY\n"+
  "MULAI "+TimeToString((datetime)(gWindows[wi].from+7*3600),TIME_MINUTES)+" WIB"+
  " | INTI "+TimeToString((datetime)(gWindows[wi].core+7*3600),TIME_MINUTES)+" WIB"+
  " | AKHIR "+TimeToString((datetime)(gWindows[wi].to+7*3600),TIME_MINUTES)+" WIB"+
  "\nEntry "+DoubleToString(entry,digits)+" | SL "+DoubleToString(sl,digits)+
  " | TP "+DoubleToString(tp,digits)+" | RR 1:"+DoubleToString(InpRR,1),
  InpSymbol,gTester,gAuto);
 return true;
}
void LSEvaluate(){
 long utc=LSNowUTC();
 int wi=LSWindowAt(utc);
 if(wi<0){LSStatus(gWeekOK?"OUTSIDE_ASTRO_MULAI_INTI_AKHIR":gWeekError);return;}
 if(LSFridayCutoff()){LSStatus("FRIDAY_NO_NEW_ENTRY");return;}
 long bt=0;double extreme=0;
 int dir=LSSweepDirection(bt,extreme);
 if(dir==0){LSStatus("WAIT_M5_LIQUIDITY_SWEEP");return;}
 if(dir!=gWindows[wi].dir){LSStatus("SWEEP_OPPOSITE_ASTRO_DIRECTION");return;}
 long eventUTC=bt+PeriodSeconds(PERIOD_M5)-LSOffsetSeconds();
 if(eventUTC<gWindows[wi].from||eventUTC>=gWindows[wi].to){
  LSStatus("SWEEP_EVENT_OUTSIDE_ASTRO_WINDOW");return;
 }
 if(bt<=gLastAcceptedSweep){LSStatus("DUPLICATE_SWEEP");return;}
 double a[];if(CopyBuffer(gAtr,0,1,1,a)!=1||a[0]<=0||
               !MathIsValidNumber(a[0])){LSStatus("ATR_NOT_READY");return;}
 string why;
 if(!LSPlace(dir,a[0],bt,wi,why)){LSStatus(why);return;}
 LSStatus("ENTRY_ACCEPTED "+LSDirection(dir));
}
bool LSInputsOK(){
 return InpSymbol!=""&&InpMagic>0&&InpFixedLot>0&&InpMaxPositions>=1&&
  InpMaxPositions<=20&&InpMaxSpreadPoints>0&&InpDeviationPoints>=0&&
  InpSweepLookback>=3&&InpSweepLookback<=100&&InpMinPiercePoints>=1&&
  InpATRPeriod>=2&&InpSL_ATR>0&&InpSL_ATR<=20&&InpRR>=1&&InpRR<=10&&
  InpWeeklyCSV!=""&&InpBrokerUTCMinutes>=-720&&InpBrokerUTCMinutes<=840&&
  InpFridayBufferMinutes>=1&&InpFridayBufferMinutes<=120&&
  InpFallbackFridayCloseHour>=0&&InpFallbackFridayCloseHour<=23&&
  InpFallbackFridayCloseMinute>=0&&InpFallbackFridayCloseMinute<=59&&
  InpHTTPTimeoutMs>=500;
}
int OnInit(){
 if(!LSInputsOK()||_Symbol!=InpSymbol)return INIT_PARAMETERS_INCORRECT;
 gTester=(bool)MQLInfoInteger(MQL_TESTER);
 gAuto=InpAutopilot;
 gAtr=iATR(InpSymbol,PERIOD_M5,InpATRPeriod);
 if(gAtr==INVALID_HANDLE)return INIT_FAILED;
 gScope="CEBONK.WEEKLY.LS."+(string)AccountInfoInteger(ACCOUNT_LOGIN)+"."+
   InpSymbol+"."+(string)InpMagic+".";
 if(!gTester&&GlobalVariableCheck(gScope+"LAST_SWEEP"))
  gLastAcceptedSweep=(long)GlobalVariableGet(gScope+"LAST_SWEEP");
 gButton="CEBONK_WEEKLY_LS_AUTO_"+(string)ChartID();
 if(!gTester){
  ObjectCreate(0,gButton,OBJ_BUTTON,0,0,0);
  ObjectSetInteger(0,gButton,OBJPROP_CORNER,CORNER_RIGHT_UPPER);
  ObjectSetInteger(0,gButton,OBJPROP_XDISTANCE,12);
  ObjectSetInteger(0,gButton,OBJPROP_YDISTANCE,18);
  ObjectSetInteger(0,gButton,OBJPROP_XSIZE,126);
  ObjectSetInteger(0,gButton,OBJPROP_YSIZE,30);
  LSPaint();
 }
 LSReadWeek();
 gLastM5=(long)iTime(InpSymbol,PERIOD_M5,0);
 EventSetTimer(1);
 LSNotice("EA_STARTED","CEBONK WEEKLY LIQUIDITY SWEEP v2.00 |"+
   " M5 | SL 3 ATR | TP RR 1:4 | Jumat AUTO CLOSE | "+
   (gWeekOK?"CSV LOADED":gWeekError),InpSymbol,gTester,gAuto);
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){
 EventKillTimer();if(gAtr!=INVALID_HANDLE)IndicatorRelease(gAtr);
 if(ObjectFind(0,gButton)>=0)ObjectDelete(0,gButton);
}
void OnTimer(){
 // Risk exit ALWAYS runs, even when AUTOPILOT is OFF or Astrology CSV is missing.
 LSCloseFriday();
 long now=(long)TimeLocal();
 if(gLastRead==0||now-gLastRead>=60){gLastRead=now;LSReadWeek();}
 LSFlushNotice(gTester,InpMT5Push,InpTelegram,InpTelegramToken,
               InpTelegramChatID,InpHTTPTimeoutMs);
 long t=(long)iTime(InpSymbol,PERIOD_M5,0);
 if(t>0&&t!=gLastM5){gLastM5=t;LSEvaluate();}
}
void OnTick(){}
// Broker-registered SL/TP exits; use one concise notification per completed deal.
void OnTradeTransaction(const MqlTradeTransaction &trans,
 const MqlTradeRequest &request,const MqlTradeResult &result){
 if(trans.type!=TRADE_TRANSACTION_DEAL_ADD||trans.deal==0||
    !HistoryDealSelect(trans.deal))return;
 if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=InpSymbol||
    (ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=InpMagic)return;
 long entry=HistoryDealGetInteger(trans.deal,DEAL_ENTRY);
 if(entry!=DEAL_ENTRY_OUT&&entry!=DEAL_ENTRY_OUT_BY&&entry!=DEAL_ENTRY_INOUT)return;
 long reason=HistoryDealGetInteger(trans.deal,DEAL_REASON);
 if(reason==DEAL_REASON_TP)
  LSNotice("TAKE PROFIT","😅 TAKE PROFIT",InpSymbol,gTester,gAuto);
 else if(reason==DEAL_REASON_SL)
  LSNotice("STOP LOSS","🥲 STOP LOSS",InpSymbol,gTester,gAuto);
}
void OnChartEvent(const int id,const long &l,const double &d,const string &s){
 if(id==CHARTEVENT_OBJECT_CLICK&&s==gButton){
  gAuto=!gAuto;LSPaint();
  LSNotice("AUTOPILOT",gAuto?"ON":"OFF",InpSymbol,gTester,gAuto);
 }
}
