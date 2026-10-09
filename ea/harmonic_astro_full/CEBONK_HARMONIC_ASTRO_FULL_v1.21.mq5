// SEKTE MUSANG TEORY CEBONK COMPANY 22 — SINCE 2016
// Independent D1/H4/H1/M30 Harmonic + WEB ASTRO WEEKLY DIRECTION ONLY + M5 CB1 MARKET.
// Experimental research EA. Demo only until MetaEditor + real-tick validation.
#property strict
#property version "1.21"
#property description "D1/H4/H1/M30 Harmonic, weekly Astro V1 dominance, M5 CB1; Fibonacci TP RR>=2"
#property tester_file "CEBONK_C2_ASTRO.csv"
#include <Trade/Trade.mqh>
#include "HarmonicScanner.mqh"
#include "AstroWeeklyDirection.mqh"

enum CH_STRATEGY { FOLLOW_PLUS_REVERSAL=0, FOLLOW_TREND_ONLY=1, REVERSAL_ONLY=2 };
input group "01 | SCANNERS + REGIME"
input bool ScanD1=true;
input bool ScanH4=true;
input bool ScanH1=true;
input bool ScanM30=true;
input CH_STRATEGY StrategyMode=FOLLOW_PLUS_REVERSAL;
input int D1History=320;
input int H4History=320;
input int H1History=340;
input int M30History=360;
input int PivotDepth=2;
input int MaxD1DClosedBars=3;
input int MaxH4DClosedBars=4;
input int MaxH1DClosedBars=6;
input int MaxM30DClosedBars=10;
input double FibTolerance=0.06;
input double MinimumXA_Points=250;
input int M5History=160;
input int M5PivotDepth=1;
input int CB1MaxAgeBars=30;
input int CB1BreakPoints=10;
input double CB1MinBody=0.35;

input group "04 | RISK / EXECUTION"
input double FixedLot=0.01;
input int SLBufferPoints=100;
input int MaxSLPoints=6000;
input int MaxChasePoints=700;
input double MaxRiskPercent=1.0;
input double DailyEquityStopPercent=5.0;
input int MaxOpenPositions=1;
input int MaxSpreadPoints=70;
input int DeviationPoints=20;
input ulong Magic=22100910;
input bool StartAutopilot=false;
input bool AllowRealAccount=false;

input group "05 | NOTIFICATIONS"
input bool EnableMT5Push=false;
input bool EnableTelegram=false;
input bool EnableCloseAlerts=false;
input string TelegramBotToken="";
input string TelegramChatID="";

CTrade chTrade;
int chEMA[4]={INVALID_HANDLE,INVALID_HANDLE,INVALID_HANDLE,INVALID_HANDLE};
ENUM_TIMEFRAMES chTF[4]={PERIOD_D1,PERIOD_H4,PERIOD_H1,PERIOD_M30};
string CHTFName(const ENUM_TIMEFRAMES tf){
 if(tf==PERIOD_D1)return "D1";
 if(tf==PERIOD_H4)return "H4";
 if(tf==PERIOD_H1)return "H1";
 if(tf==PERIOD_M30)return "M30";
 return "UNKNOWN";
}
bool chAuto=false;
string chButton="CHAF_AUTOPILOT";
datetime chLastM5=0;
string chDayKey="";

void CHButton(){
 if(ObjectFind(0,chButton)<0){
  ObjectCreate(0,chButton,OBJ_BUTTON,0,0,0);
  ObjectSetInteger(0,chButton,OBJPROP_XDISTANCE,14);
  ObjectSetInteger(0,chButton,OBJPROP_YDISTANCE,18);
  ObjectSetInteger(0,chButton,OBJPROP_XSIZE,155);
  ObjectSetInteger(0,chButton,OBJPROP_YSIZE,28);
 }
 ObjectSetString(0,chButton,OBJPROP_TEXT,chAuto?"AUTOPILOT ON":"AUTOPILOT OFF");
 ObjectSetInteger(0,chButton,OBJPROP_BGCOLOR,chAuto?clrDarkGreen:clrMaroon);
 ObjectSetInteger(0,chButton,OBJPROP_COLOR,clrWhite);
 ObjectSetInteger(0,chButton,OBJPROP_STATE,false);
 ChartRedraw();
}
int CHMyPositions(){
 int count=0;
 for(int i=PositionsTotal()-1;i>=0;i--){
  ulong ticket=PositionGetTicket(i);
  if(ticket>0&&PositionSelectByTicket(ticket)&&PositionGetString(POSITION_SYMBOL)==_Symbol&&
     (ulong)PositionGetInteger(POSITION_MAGIC)==Magic)count++;
 }
 return count;
}
string CHDailyKey(){
 MqlDateTime d;TimeToStruct(TimeCurrent(),d);
 return StringFormat("CHAF.D.%I64d.%I64u.%04d%02d%02d",AccountInfoInteger(ACCOUNT_LOGIN),Magic,d.year,d.mon,d.day);
}
bool CHDailyRisk(){
 string key=CHDailyKey();
 if(key!=chDayKey)chDayKey=key;
 if(!GlobalVariableCheck(key)){
  GlobalVariableSet(key,AccountInfoDouble(ACCOUNT_EQUITY));GlobalVariablesFlush();
 }
 double baseline=GlobalVariableGet(key);
 return baseline>0&&AccountInfoDouble(ACCOUNT_EQUITY)>baseline*(1.0-DailyEquityStopPercent/100.0);
}
// Trend classification computed per scanner TF. True countertrend is distinct from no trend.
int CHRegime(const int idx,const HPSetup &s){
 double emaNow[1],emaOld[1];MqlRates b[];ArraySetAsSeries(b,true);
 if(CopyBuffer(chEMA[idx],0,1,1,emaNow)!=1 || CopyBuffer(chEMA[idx],0,5,1,emaOld)!=1 ||
    CopyRates(_Symbol,chTF[idx],0,7,b)!=7)return 0;
 int trend=(b[1].close>emaNow[0]&&emaNow[0]>emaOld[0]?1:
            b[1].close<emaNow[0]&&emaNow[0]<emaOld[0]?-1:0);
 if(trend==0)return 0;
 return trend==s.dir?1:2;
}
// CB1 level = pivot high between two descending M5 lows, mirrored for SELL.
// Entry requires real-body close-break on bar 1, and M5 pivot after D1/H4/H1/M30 D.
bool CHCB1(MqlRates &m[],const int n,const HPSetup &s,double &level){
 HPSwing piv[];int count=HPBuildSwings(m,n,M5PivotDepth,piv);
 int recent=-1,older=-1;
 for(int j=count-1;j>=0;j--){
  if(piv[j].side==-s.dir){
   if(recent<0)recent=j;else{older=j;break;}
  }
 }
 if(older<0)return false;
 HPSwing p=piv[older],q=piv[recent];
 if(q.at<s.dAt||q.bar<2||q.bar>CB1MaxAgeBars||p.bar-q.bar<2)return false;
 if(s.dir>0?q.price>=p.price:q.price<=p.price)return false;
 level=s.dir>0?-DBL_MAX:DBL_MAX;
 for(int k=q.bar+1;k<p.bar;k++){
  if(s.dir>0)level=MathMax(level,m[k].high);
  else level=MathMin(level,m[k].low);
 }
 if(level==DBL_MAX||level==-DBL_MAX||m[1].time<=q.at)return false;
 double range=m[1].high-m[1].low;
 if(range<=0||MathAbs(m[1].close-m[1].open)/range<CB1MinBody)return false;
 if(s.dir>0)return m[1].close>m[1].open&&m[2].close<=level&&
                        m[1].close>level+CB1BreakPoints*_Point;
 return m[1].close<m[1].open&&m[2].close>=level&&
        m[1].close<level-CB1BreakPoints*_Point;
}
double CHRound(const double price,const bool up){
 double step=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
 if(step<=0)return 0;
 return NormalizeDouble((up?MathCeil(price/step-1e-9):MathFloor(price/step+1e-9))*step,_Digits);
}
string CHClaimKey(const HPSetup &s){
 // Same timeframe/D cannot generate repeated orders regardless of overlapping patterns.
 return StringFormat("CHAF.C.%I64d.%s.%I64u.%d.%I64d",AccountInfoInteger(ACCOUNT_LOGIN),
  _Symbol,Magic,(int)s.tf,(long)s.dAt);
}
bool CHHistoryConsumed(const HPSetup &s){
 if(!HistorySelect(s.dAt,TimeCurrent()))return true;
 string token=StringFormat("CF:%d:%I64d",(int)s.tf,(long)s.dAt);
 for(int i=HistoryDealsTotal()-1;i>=0;i--){
  ulong id=HistoryDealGetTicket(i);
  if(HistoryDealGetString(id,DEAL_SYMBOL)==_Symbol &&
   (ulong)HistoryDealGetInteger(id,DEAL_MAGIC)==Magic &&
   StringFind(HistoryDealGetString(id,DEAL_COMMENT),token)==0)return true;
 }
 return false;
}
bool CHClaim(const HPSetup &s){
 string key=CHClaimKey(s);
 if(StringLen(key)>63)return false;
 if(CHHistoryConsumed(s))return false;
 if(!GlobalVariableCheck(key))GlobalVariableSet(key,0);
 if(!GlobalVariableSetOnCondition(key,1,0))return false;
 GlobalVariablesFlush();return true;
}

// Fibonacci target: choose 0.382 AD if RR>=2; else 0.618 AD if RR>=2;
// otherwise do not open. NO synthetic TP beyond a pattern's natural target.
bool CHExecute(HPSetup &s){
 MqlTick tick;
 if(!SymbolInfoTick(_Symbol,tick)||tick.ask<=tick.bid||tick.bid<=0)return false;
 if((tick.ask-tick.bid)/_Point>MaxSpreadPoints)return false;
 if(CHMyPositions()>=MaxOpenPositions)return false;
 double entry=s.dir>0?tick.ask:tick.bid;
 if(MathAbs(entry-s.cb1)/_Point>MaxChasePoints)return false;
 double sl=CHRound(s.d+(s.dir>0?-SLBufferPoints:SLBufferPoints)*_Point,s.dir<0);
 double risk=s.dir*(entry-sl);
 if(sl<=0||risk<=0||risk/_Point>MaxSLPoints)return false;
 double tp382=CHRound(s.target382,s.dir>0);
 double tp618=CHRound(s.target618,s.dir>0);
 double tp=0;
 if(s.dir*(tp382-entry)>=2.0*risk)tp=tp382;
 else if(s.dir*(tp618-entry)>=2.0*risk)tp=tp618;
 else{Print("CHAF SKIP Fibonacci RR under 1:2 | ",HPName(s.pat));return false;}
 double required=MathMax((double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL),
                          (double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL))*_Point+2*_Point;
 if(s.dir>0 ? tick.bid-sl<required||tp-tick.bid<required :
              sl-tick.ask<required||tick.ask-tp<required)return false;
 ENUM_ORDER_TYPE type=s.dir>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
 double loss=0,margin=0;
 if(!OrderCalcProfit(type,_Symbol,FixedLot,entry,sl,loss)||loss>=0||
    -loss>AccountInfoDouble(ACCOUNT_EQUITY)*MaxRiskPercent/100.0)return false;
 if(!OrderCalcMargin(type,_Symbol,FixedLot,entry,margin)||margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE))return false;
 if(!CHClaim(s))return false; // Fail/unknown orders consumed, no duplicate retry.
 string comment=StringFormat("CF:%d:%I64d:%d:%d",(int)s.tf,(long)s.dAt,s.pat,s.regime);
 bool ok=s.dir>0?chTrade.Buy(FixedLot,_Symbol,entry,sl,tp,comment):
                 chTrade.Sell(FixedLot,_Symbol,entry,sl,tp,comment);
 uint ret=chTrade.ResultRetcode();
 if(!ok||(ret!=TRADE_RETCODE_DONE && ret!=TRADE_RETCODE_DONE_PARTIAL&&ret!=TRADE_RETCODE_PLACED)){
  PrintFormat("CHAF order refused: %u (%s); signal consumed",ret,chTrade.ResultRetcodeDescription());return true;
 }
 PrintFormat("CHAF %s | %s | TF%s | %s | CB1 %.*f | SL %.*f TP %.*f (Fibonacci)",
    HPName(s.pat),s.regime==1?"FOLLOW":"REVERSAL",CHTFName(s.tf),s.dir>0?"BUY":"SELL",
    _Digits,s.cb1,_Digits,sl,_Digits,tp);
 return true;
}

string CHUrlEnc(string in){
 char bytes[];int n=StringToCharArray(in,bytes,0,WHOLE_ARRAY,CP_UTF8);string s="";
 for(int i=0;i<n-1;i++){
  uchar c=(uchar)bytes[i];
  if((c>=48&&c<=57)||(c>=65&&c<=90)||(c>=97&&c<=122)||c==45||c==95||c==46)s+=ShortToString((ushort)c);
  else if(c==32)s+="+";
  else s+=StringFormat("%%%02X",(int)c);
 }
 return s;
}
void CHMessage(const string msg){
 if(EnableMT5Push&&!MQLInfoInteger(MQL_TESTER))if(!SendNotification(msg))Print("CHAF push failed ",GetLastError());
 if(EnableTelegram&&!MQLInfoInteger(MQL_TESTER)&&TelegramBotToken!=""&&TelegramChatID!=""){
  string url="https://api.telegram.org/bot"+TelegramBotToken+"/sendMessage";
  string payload="chat_id="+CHUrlEnc(TelegramChatID)+"&text="+CHUrlEnc(msg);
  char post[],reply[];StringToCharArray(payload,post,0,StringLen(payload),CP_UTF8);
  string headers="";
  int code=WebRequest("POST",url,"Content-Type: application/x-www-form-urlencoded\r\n",4500,post,reply,headers);
  if(code!=200)Print("CHAF Telegram HTTP=",code," ERR=",GetLastError());
 }
}
void CHNotify(const ulong deal,const ulong order,const long entryKind){
 string key=StringFormat("CHAF.N.%I64d.%I64u",AccountInfoInteger(ACCOUNT_LOGIN),order);
 if(GlobalVariableCheck(key))return;
 GlobalVariableSet(key,1);GlobalVariablesFlush();
 if(entryKind==DEAL_ENTRY_OUT){
  long reason=HistoryDealGetInteger(deal,DEAL_REASON);
  if(!EnableCloseAlerts||(reason!=DEAL_REASON_TP && reason!=DEAL_REASON_SL))return;
  CHMessage(reason==DEAL_REASON_TP?"TAKE PROFIT 😅":"STOP LOSS 🥲");return;
 }
 string note=HistoryDealGetString(deal,DEAL_COMMENT);
 if(StringFind(note,"CF:")!=0&&HistoryOrderSelect(order))note=HistoryOrderGetString(order,ORDER_COMMENT);
 if(StringFind(note,"CF:")!=0)return;
 string f[];int k=StringSplit(note,':',f);
 int tf=k>=5?(int)StringToInteger(f[1]):0;
 int pat=k>=5?(int)StringToInteger(f[3]):0;
 int regime=k>=5?(int)StringToInteger(f[4]):0;
 double price=HistoryDealGetDouble(deal,DEAL_PRICE),sl=0,tp=0;
 ulong pid=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
 for(int j=PositionsTotal()-1;j>=0;j--){
  ulong ticket=PositionGetTicket(j);
  if(ticket>0&&PositionSelectByTicket(ticket) &&
     (ulong)PositionGetInteger(POSITION_IDENTIFIER)==pid){
    price=PositionGetDouble(POSITION_PRICE_OPEN);
    sl=PositionGetDouble(POSITION_SL);tp=PositionGetDouble(POSITION_TP);break;
  }
 }
 if(sl==0&&HistoryOrderSelect(order)){
  sl=HistoryOrderGetDouble(order,ORDER_SL);
  tp=HistoryOrderGetDouble(order,ORDER_TP);
 }
 int dir=(HistoryDealGetInteger(deal,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1);
 string msg=StringFormat("SEKTE MUSANG TEORY CEBONK COMPANY 22\nASTRO WEEKLY + HARMONIC + CB1\n%s %s | %s\nMINGGU DOMINAN %s\n%s %s\nENTRY %s\nSL %s | TP %s\nOJO FULLMARGIN COK",
   HPName(pat),CHTFName((ENUM_TIMEFRAMES)tf),regime==1?"FOLLOW":"REVERSAL",dir>0?"BULLISH":"BEARISH",_Symbol,dir>0?"BUY":"SELL",
   DoubleToString(price,_Digits),DoubleToString(sl,_Digits),DoubleToString(tp,_Digits));
 CHMessage(msg);
}

int OnInit(){
 if(!(ScanD1||ScanH4||ScanH1||ScanM30)||PivotDepth<1||PivotDepth>5||M5PivotDepth<1||M5PivotDepth>4||
    M5History<90||M5History>600||D1History<140||D1History>1200||H4History<140||H4History>1200||
    H1History<140||H1History>1200||M30History<140||M30History>1200||
    MaxD1DClosedBars<1||MaxD1DClosedBars>8||MaxH4DClosedBars<1||MaxH4DClosedBars>10||MaxH1DClosedBars<1||MaxH1DClosedBars>15||
    MaxM30DClosedBars<1||MaxM30DClosedBars>25||FibTolerance<0.005||FibTolerance>0.15||
    MinimumXA_Points<=0||CB1MaxAgeBars<3||CB1MaxAgeBars>80||CB1BreakPoints<0||
    CB1MinBody<0||CB1MinBody>1||SLBufferPoints<0||MaxSLPoints<1||MaxChasePoints<1||
    MaxRiskPercent<=0||MaxRiskPercent>5||DailyEquityStopPercent<=0||DailyEquityStopPercent>10||
    MaxOpenPositions<1||MaxOpenPositions>10||MaxSpreadPoints<0||DeviationPoints<0||
    AstroHTTPTimeoutMs<500||AstroHTTPTimeoutMs>12000||AstroLiveCacheMinutes<1||
    AstroLiveCacheMinutes>360||AstroFixedServerUTCMinutes<(-720)||AstroFixedServerUTCMinutes>840||
    AstroBaseURL==""||WeeklyMinSharePercent<51||WeeklyMinSharePercent>100||
    (!MathIsValidNumber(FixedLot))||FixedLot<=0)return INIT_PARAMETERS_INCORRECT;
 double lo=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN),hi=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
 double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
 if(step<=0||FixedLot<lo||FixedLot>hi||MathAbs(FixedLot/step-MathRound(FixedLot/step))>1e-7)return INIT_PARAMETERS_INCORRECT;
 if(AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING){
  Print("CHAF requires hedging account for independent stops");return INIT_FAILED;
 }
 for(int k=0;k<4;k++){
  chEMA[k]=iMA(_Symbol,chTF[k],50,0,MODE_EMA,PRICE_CLOSE);
  if(chEMA[k]==INVALID_HANDLE)return INIT_FAILED;
 }
 chTrade.SetExpertMagicNumber(Magic);
 chTrade.SetDeviationInPoints(DeviationPoints);
 chTrade.SetAsyncMode(false);
 if(!chTrade.SetTypeFillingBySymbol(_Symbol))return INIT_FAILED;
 chAuto=StartAutopilot;
 chLastM5=iTime(_Symbol,PERIOD_M5,0);
 CHButton();EventSetTimer(60);
 ACPoll();
 Print("CHAF EXPERIMENTAL v1.21. INDEPENDENT D1/H4/H1/M30, M5 direct CB1. WEEKLY-ONLY 55%+ from web V1 model: ",AC_MODEL,
       ". Weekly panel uses V1 model; browser V2 daily display not interchangeable. Real lock: ",!AllowRealAccount);
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){
 EventKillTimer();ObjectDelete(0,chButton);
 for(int k=0;k<4;k++)if(chEMA[k]!=INVALID_HANDLE)IndicatorRelease(chEMA[k]);
}
void OnChartEvent(const int id,const long &l,const double &d,const string &s){
 if(id==CHARTEVENT_OBJECT_CLICK&&s==chButton){chAuto=!chAuto;CHButton();}
}
void OnTimer(){if(chAuto)ACPoll();}
void OnTick(){
 datetime closeOpen=iTime(_Symbol,PERIOD_M5,0);
 if(closeOpen<=0||closeOpen==chLastM5)return;
 if(chLastM5==0){chLastM5=closeOpen;return;} // Never enter historical bar on initial data load
 MqlRates m[];ArraySetAsSeries(m,true);
 if(CopyRates(_Symbol,PERIOD_M5,0,M5History,m)!=M5History)return;
 chLastM5=closeOpen; // no late replays; next live M5 bar required
 if(!chAuto||(AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL&&!AllowRealAccount))return;
 if(!MQLInfoInteger(MQL_TRADE_ALLOWED)||!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)||
    !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)||!AccountInfoInteger(ACCOUNT_TRADE_EXPERT))return;
 if(!CHDailyRisk())return;
 HPSetup picks[4];int num=0;
 for(int k=0;k<4;k++){
  if((k==0&&!ScanD1)||(k==1&&!ScanH4)||(k==2&&!ScanH1)||(k==3&&!ScanM30))continue;
  HPSetup s;
  int history=k==0?D1History:(k==1?H4History:(k==2?H1History:M30History));
  int age=k==0?MaxD1DClosedBars:(k==1?MaxH4DClosedBars:(k==2?MaxH1DClosedBars:MaxM30DClosedBars));
  if(!HPFind(chTF[k],PivotDepth,history,age,FibTolerance,MinimumXA_Points,s))continue;
  s.regime=CHRegime(k,s);
  if(s.regime==0 || (StrategyMode==FOLLOW_TREND_ONLY&&s.regime!=1)||
      (StrategyMode==REVERSAL_ONLY&&s.regime!=2))continue;
  picks[num]=s;num++;
 }
 if(num<1)return;
 // Priority: D1, H4, H1, then M30. Every timeframe still scans independently.
 for(int i=0;i<num;i++){
  HPSetup s=picks[i];double level=0;
  // Only the weekly bias decides the permitted direction.
  // Opposite patterns in other timeframes NEVER veto this independent setup.
  if(!ACWeeklyGate(s.dir,closeOpen))continue;
  if(!CHCB1(m,ArraySize(m),s,level))continue;
  s.cb1=level;
  if(CHExecute(s))return; // Skip bad RR/SL candidate; test next independent TF.
 }
}
void OnTradeTransaction(const MqlTradeTransaction &t,const MqlTradeRequest &r,const MqlTradeResult &out){
 if(t.type!=TRADE_TRANSACTION_DEAL_ADD||t.deal==0||t.order==0)return;
 if(!HistoryDealSelect(t.deal))return;
 if(HistoryDealGetString(t.deal,DEAL_SYMBOL)!=_Symbol||
   (ulong)HistoryDealGetInteger(t.deal,DEAL_MAGIC)!=Magic)return;
 long kind=HistoryDealGetInteger(t.deal,DEAL_ENTRY);
 if(kind!=DEAL_ENTRY_IN && kind!=DEAL_ENTRY_OUT)return;
 CHNotify(t.deal,t.order,kind);
}