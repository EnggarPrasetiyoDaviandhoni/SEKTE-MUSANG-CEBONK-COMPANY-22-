// SEKTE MUSANG TEORY CEBONK COMPANY 22 — SINCE 2016
// Experimental: H1 Harmonic PRZ -> M5 FMS-style CB1 close break -> MARKET (no retest)
#property strict
#property version "1.00"
#include <Trade/Trade.mqh>

enum ENTRY_MODE { FOLLOW_AND_REVERSAL=0, FOLLOW_ONLY=1, REVERSAL_ONLY=2 };
input ENTRY_MODE StrategyMode=FOLLOW_AND_REVERSAL;
input bool EnableABCD=true;
input bool EnableGartley=true;
input bool EnableBat=true;
input bool EnableButterfly=true;
input int H1Lookback=350;
input int PivotDepth=2;
input int MaxDClosedH1Bars=3;
input int M5Lookback=100;
input int M5PivotDepth=1;
input int MaxM5CB1AgeBars=36;
input double FibTolerance=0.06;
input double MinimumH1XA_Points=300;
input int CB1BreakBufferPoints=10;
input double CB1MinBodyRatio=0.35;
input double FixedLot=0.01;
input int SLBufferPoints=100;
input int MaxSLPoints=6000;
input int MaxChasePoints=700;
input double MaxRiskPercent=1.0;
input double DailyEquityStopPercent=5.0;
input int MaxOpenPositions=1;
input int MaxSpreadPoints=70;
input int DeviationPoints=20;
input int BrokerStartHour=7;
input int BrokerEndHour=23;
input ulong Magic=22100825;
input bool StartAutopilot=false;
input bool AllowRealAccount=false;
input bool EnableMT5Push=false;
input bool EnableTelegram=false;
input string TelegramBotToken="";
input string TelegramChatID="";

#define H1TF PERIOD_H1
#define M5TF PERIOD_M5
#define RR 2.0
#define MAX_PIVOTS 160

struct Swing { int shift; int side; double price; datetime time; };
struct Setup { int dir; int pattern; int regime; datetime dtime; double dprice; double invalid; string label; };
CTrade trade;
bool autopilot=false;
string button="HC22_AUTOPILOT";
string claimKey="";
string equityKey="";
datetime lastM5=0;
int emaHandle=INVALID_HANDLE;

bool ReadPrices(ENUM_TIMEFRAMES tf,int count,MqlRates &bars[])
{
  ArraySetAsSeries(bars,true);
  return CopyRates(_Symbol,tf,0,count,bars)==count;
}

bool IsPivot(MqlRates &bars[],int n,int index,int depth,int side)
{
  if(index-depth<1 || index+depth>=n) return false; // newer neighbors are CLOSED
  for(int j=1;j<=depth;j++)
  {
    if(side>0 && (bars[index].high<=bars[index-j].high || bars[index].high<=bars[index+j].high)) return false;
    if(side<0 && (bars[index].low>=bars[index-j].low || bars[index].low>=bars[index+j].low)) return false;
  }
  return true;
}

int Swings(MqlRates &bars[],int n,int depth,Swing &out[])
{
  ArrayResize(out,0);
  for(int i=n-depth-1;i>=depth+1;i--)
  {
    bool hi=IsPivot(bars,n,i,depth,+1);
    bool lo=IsPivot(bars,n,i,depth,-1);
    if(hi==lo) continue; // avoid outside-bar ambiguous double pivot
    Swing s;
    s.shift=i;
    s.side=(hi ? +1:-1);
    s.price=(hi ? bars[i].high:bars[i].low);
    s.time=bars[i].time;
    int used=ArraySize(out);
    if(used>0 && out[used-1].side==s.side)
    {
      if((s.side>0 && s.price>out[used-1].price) ||
         (s.side<0 && s.price<out[used-1].price)) out[used-1]=s;
      continue;
    }
    if(used==MAX_PIVOTS)
    {
      for(int k=1;k<used;k++) out[k-1]=out[k];
      used--;
      ArrayResize(out,used);
    }
    ArrayResize(out,used+1);
    out[used]=s;
  }
  return ArraySize(out);
}

bool Near(double actual,double target,double tolerance)
{
  return MathAbs(actual-target)<=tolerance;
}

// X-A-B-C confirmed; D uses only the low/high of CLOSED H1 bars AFTER C.
// H1 EMA50 trend is classified at the current closed bar, not future bars.
bool FindHarmonic(MqlRates &h[],int n,Setup &s)
{
  Swing piv[];
  int count=Swings(h,n,PivotDepth,piv);
  if(count<4) return false;
  Swing X=piv[count-4],A=piv[count-3],B=piv[count-2],C=piv[count-1];
  int dir=(X.side<0 && A.side>0 && B.side<0 && C.side>0 ? +1 :
           X.side>0 && A.side<0 && B.side>0 && C.side<0 ? -1 : 0);
  if(dir==0 || C.shift<2 || C.shift>MaxDClosedH1Bars+PivotDepth+8) return false;
  double d=(dir>0 ? DBL_MAX:-DBL_MAX);
  int dshift=-1;
  for(int i=1;i<C.shift;i++)
  {
    double candidate=(dir>0 ? h[i].low : h[i].high);
    if((dir>0 && candidate<d) || (dir<0 && candidate>d))
    {
      d=candidate;
      dshift=i;
    }
  }
  if(dshift<1 || dshift>MaxDClosedH1Bars) return false;
  if(dir>0 ? !(A.price>C.price && C.price>B.price && B.price>d) :
             !(A.price<C.price && C.price<B.price && B.price<d)) return false;
  double xa=MathAbs(A.price-X.price),ab=MathAbs(A.price-B.price);
  double bc=MathAbs(C.price-B.price),cd=MathAbs(C.price-d);
  if(xa<MinimumH1XA_Points*_Point || ab<=0 || bc<=0) return false;
  double b=ab/xa,c=bc/ab,ad=MathAbs(A.price-d)/xa,ext=cd/bc,eq=cd/ab;
  double tol=FibTolerance;
  if(c<0.382-tol || c>0.886+tol) return false;
  int pat=0;
  // Priority explicitly defined; all enabled pattern types independently selectable.
  if(EnableGartley && Near(b,0.618,tol) && Near(ad,0.786,tol)
     && ext>=1.272-2*tol && ext<=1.618+2*tol && (dir>0 ? d>X.price : d<X.price)) pat=2;
  else if(EnableBat && b>=0.382-tol && b<=0.50+tol && Near(ad,0.886,tol)
          && ext>=1.618-2*tol && ext<=2.618+2*tol && (dir>0 ? d>X.price : d<X.price)) pat=3;
  else if(EnableButterfly && Near(b,0.786,tol) && ad>=1.272-tol && ad<=1.618+tol
          && ext>=1.618-2*tol && ext<=3.618+2*tol && (dir>0 ? d<X.price : d>X.price)) pat=4;
  else if(EnableABCD && eq>=0.90 && eq<=1.10) pat=1;
  if(pat==0) return false;
  double emaNow[1],emaPast[1];
  if(CopyBuffer(emaHandle,0,1,1,emaNow)!=1 || CopyBuffer(emaHandle,0,5,1,emaPast)!=1) return false;
  int htrend=(h[1].close>emaNow[0] && emaNow[0]>emaPast[0] ? 1 :
              h[1].close<emaNow[0] && emaNow[0]<emaPast[0] ? -1 : 0);
  if(htrend==0) return false; // ambiguous market regime: skip
  int regime=(dir==htrend ? FOLLOW_ONLY:REVERSAL_ONLY);
  if(StrategyMode!=FOLLOW_AND_REVERSAL && (int)StrategyMode!=regime) return false;
  s.dir=dir;
  s.pattern=pat;
  s.regime=regime;
  s.dtime=h[dshift].time;
  s.dprice=d;
  s.invalid=d;
  s.label=(pat==1 ? "ABCD" : pat==2 ? "GARTLEY" : pat==3 ? "BAT":"BUTTERFLY");
  return true;
}

// FMS-style CB1: bullish break over the intervening HIGH of two descending
// M5 pivot LOWs; bearish break under intervening LOW of two ascending pivot HIGHs.
// Break is judged by the latest CLOSED M5 candle, never by its wick.
bool BreakCB1(MqlRates &m[],int n,Setup &s,double &level)
{
  Swing piv[];
  int count=Swings(m,n,M5PivotDepth,piv);
  int latest=-1,previous=-1;
  for(int j=count-1;j>=0;j--)
  {
    if(piv[j].side==-s.dir)
    {
      if(latest<0) latest=j;
      else { previous=j; break; }
    }
  }
  if(previous<0) return false;
  Swing p=piv[previous],q=piv[latest];
  if(q.time<s.dtime || q.shift<2 || q.shift>MaxM5CB1AgeBars) return false;
  if(p.shift-q.shift<2) return false;
  if(s.dir>0 ? q.price>=p.price : q.price<=p.price) return false;
  level=(s.dir>0 ? -DBL_MAX:DBL_MAX);
  for(int k=q.shift+1;k<p.shift;k++)
  {
    if(s.dir>0) level=MathMax(level,m[k].high);
    else level=MathMin(level,m[k].low);
  }
  if(level==DBL_MAX || level==-DBL_MAX || m[1].time<=q.time) return false;
  double body=MathAbs(m[1].close-m[1].open);
  double range=m[1].high-m[1].low;
  if(range<=0 || body/range<CB1MinBodyRatio) return false;
  if(s.dir>0)
    return m[1].close>level+CB1BreakBufferPoints*_Point && m[2].close<=level && m[1].close>m[1].open;
  return m[1].close<level-CB1BreakBufferPoints*_Point && m[2].close>=level && m[1].close<m[1].open;
}

bool SessionOpen()
{
  MqlDateTime d;
  TimeToStruct(TimeCurrent(),d);
  if(BrokerStartHour==BrokerEndHour) return true;
  if(BrokerStartHour<BrokerEndHour) return d.hour>=BrokerStartHour && d.hour<BrokerEndHour;
  return d.hour>=BrokerStartHour || d.hour<BrokerEndHour;
}

double PriceRound(double value,bool upward)
{
  double tickSize=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
  if(tickSize<=0) return 0;
  return NormalizeDouble((upward ? MathCeil(value/tickSize-1e-9):MathFloor(value/tickSize+1e-9))*tickSize,_Digits);
}

void PaintButton()
{
  if(ObjectFind(0,button)<0)
  {
    ObjectCreate(0,button,OBJ_BUTTON,0,0,0);
    ObjectSetInteger(0,button,OBJPROP_XDISTANCE,12);
    ObjectSetInteger(0,button,OBJPROP_YDISTANCE,18);
    ObjectSetInteger(0,button,OBJPROP_XSIZE,163);
    ObjectSetInteger(0,button,OBJPROP_YSIZE,29);
  }
  ObjectSetString(0,button,OBJPROP_TEXT,autopilot ? "AUTOPILOT ON":"AUTOPILOT OFF");
  ObjectSetInteger(0,button,OBJPROP_BGCOLOR,autopilot ? clrDarkGreen:clrMaroon);
  ObjectSetInteger(0,button,OBJPROP_COLOR,clrWhite);
  ObjectSetInteger(0,button,OBJPROP_STATE,false);
  ChartRedraw();
}

int CountMyPositions()
{
  int result=0;
  for(int i=PositionsTotal()-1;i>=0;i--)
  {
    ulong id=PositionGetTicket(i);
    if(id>0 && PositionSelectByTicket(id) && PositionGetString(POSITION_SYMBOL)==_Symbol &&
       (ulong)PositionGetInteger(POSITION_MAGIC)==Magic) result++;
  }
  return result;
}

string TodayEquityKey()
{
  MqlDateTime d;
  TimeToStruct(TimeCurrent(),d);
  return StringFormat("HC22.E.%I64d.%I64u.%04d%02d%02d",AccountInfoInteger(ACCOUNT_LOGIN),Magic,d.year,d.mon,d.day);
}

bool DailyEquityOK()
{
  string today=TodayEquityKey();
  if(today!=equityKey) equityKey=today;
  if(!GlobalVariableCheck(equityKey))
  {
    GlobalVariableSet(equityKey,AccountInfoDouble(ACCOUNT_EQUITY));
    GlobalVariablesFlush();
  }
  double baseline=GlobalVariableGet(equityKey);
  if(baseline<=0) return false;
  return AccountInfoDouble(ACCOUNT_EQUITY)>baseline*(1.0-DailyEquityStopPercent/100.0);
}

bool AlreadyFilled(datetime dtime)
{
  if(!HistorySelect(dtime,TimeCurrent())) return true; // fail closed
  string tag="HC22:"+IntegerToString((long)dtime);
  for(int i=HistoryDealsTotal()-1;i>=0;i--)
  {
    ulong deal=HistoryDealGetTicket(i);
    if(HistoryDealGetString(deal,DEAL_SYMBOL)==_Symbol &&
       (ulong)HistoryDealGetInteger(deal,DEAL_MAGIC)==Magic &&
       StringFind(HistoryDealGetString(deal,DEAL_COMMENT),tag)==0) return true;
  }
  return false;
}

void Execute(Setup &s,double cb1)
{
  MqlTick tick;
  if(!SymbolInfoTick(_Symbol,tick) || tick.bid<=0 || tick.ask<=tick.bid) return;
  if((tick.ask-tick.bid)/_Point>MaxSpreadPoints) { Print("HC22 SKIP spread"); return; }
  if(CountMyPositions()>=MaxOpenPositions) { Print("HC22 SKIP max positions"); return; }
  double entry=(s.dir>0 ? tick.ask:tick.bid);
  if(MathAbs(entry-cb1)/_Point>MaxChasePoints) { Print("HC22 SKIP chasing CB1"); return; }
  double sl=PriceRound(s.invalid+(s.dir>0 ? -SLBufferPoints:+SLBufferPoints)*_Point,s.dir<0);
  double risk=s.dir*(entry-sl);
  if(sl<=0 || risk<=0 || risk/_Point>MaxSLPoints) { Print("HC22 SKIP SL/risk distance"); return; }
  double tp=PriceRound(entry+s.dir*RR*risk,s.dir>0);
  double minimum=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*_Point;
  double freeze=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL)*_Point;
  minimum=MathMax(minimum,freeze)+2*_Point;
  bool valid=s.dir>0 ? (tick.bid-sl>=minimum && tp-tick.bid>=minimum):
                       (sl-tick.ask>=minimum && tick.ask-tp>=minimum);
  if(!valid) { Print("HC22 SKIP invalid broker stops"); return; }
  double loss=0;
  ENUM_ORDER_TYPE type=(s.dir>0 ? ORDER_TYPE_BUY:ORDER_TYPE_SELL);
  if(!OrderCalcProfit(type,_Symbol,FixedLot,entry,sl,loss) || loss>=0 ||
     -loss>AccountInfoDouble(ACCOUNT_EQUITY)*MaxRiskPercent/100.0)
  { Print("HC22 SKIP monetary risk"); return; }
  double margin=0;
  if(!OrderCalcMargin(type,_Symbol,FixedLot,entry,margin) || margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE))
  { Print("HC22 SKIP margin"); return; }
  if(AlreadyFilled(s.dtime)) return;
  double previous=GlobalVariableGet(claimKey);
  if(previous>=(double)s.dtime || !GlobalVariableSetOnCondition(claimKey,(double)s.dtime,previous)) return;
  GlobalVariablesFlush(); // claim BEFORE sending: failed/unknown orders are never retried
  string tag="HC22:"+IntegerToString((long)s.dtime)+":"+IntegerToString(s.pattern)+":"+IntegerToString(s.regime);
  bool sent=(s.dir>0 ? trade.Buy(FixedLot,_Symbol,entry,sl,tp,tag):
                       trade.Sell(FixedLot,_Symbol,entry,sl,tp,tag));
  uint code=trade.ResultRetcode();
  if(!sent || (code!=TRADE_RETCODE_DONE && code!=TRADE_RETCODE_DONE_PARTIAL && code!=TRADE_RETCODE_PLACED))
  { PrintFormat("HC22 ORDER FAILED retcode=%u %s; signal consumed",code,trade.ResultRetcodeDescription()); return; }
  PrintFormat("HC22 ORDER SUBMITTED %s %s %s CB1=%.5f ENTRY=%.5f SL=%.5f TP=%.5f",
              s.label,(s.regime==FOLLOW_ONLY ? "FOLLOW":"REVERSAL"),(s.dir>0 ? "BUY":"SELL"),cb1,entry,sl,tp);
}

string UrlEncode(string value)
{
  char bytes[];
  int n=StringToCharArray(value,bytes,0,WHOLE_ARRAY,CP_UTF8);
  string out="";
  for(int i=0;i<n-1;i++)
  {
    uchar c=(uchar)bytes[i];
    if((c>='a' && c<='z') || (c>='A' && c<='Z') || (c>='0' && c<='9') || c=='-' || c=='_' || c=='.')
      out+=ShortToString((ushort)c);
    else if(c==' ') out+="+";
    else out+=StringFormat("%%%02X",(int)c);
  }
  return out;
}

ulong TicketByIdentifier(ulong identifier)
{
  if(PositionSelectByTicket(identifier)) return identifier;
  for(int i=PositionsTotal()-1;i>=0;i--)
  {
    ulong ticket=PositionGetTicket(i);
    if(ticket>0 && PositionSelectByTicket(ticket) &&
       (ulong)PositionGetInteger(POSITION_IDENTIFIER)==identifier) return ticket;
  }
  return 0;
}

void NotifyFilled(ulong order,ulong deal,string dealTag)
{
  // Deduplicate by ORDER, not DEAL: a partially filled order creates several deals.
  string nk=StringFormat("HC22.N.%I64d.%I64u",AccountInfoInteger(ACCOUNT_LOGIN),order);
  if(GlobalVariableCheck(nk)) return;
  GlobalVariableSet(nk,1);
  GlobalVariablesFlush();
  int direction=(HistoryDealGetInteger(deal,DEAL_TYPE)==DEAL_TYPE_BUY ? +1:-1);
  double entry=HistoryDealGetDouble(deal,DEAL_PRICE),sl=0,tp=0;
  ulong positionId=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
  // On hedging accounts POSITION_IDENTIFIER and ticket usually match for new positions.
  // Attempt TP correction to exact filled price; never move SL.
  ulong positionTicket=TicketByIdentifier(positionId);
  if(positionTicket>0 && PositionSelectByTicket(positionTicket))
  {
    entry=PositionGetDouble(POSITION_PRICE_OPEN);
    sl=PositionGetDouble(POSITION_SL);
    tp=PositionGetDouble(POSITION_TP);
    if(sl>0 && direction*(entry-sl)>0)
    {
      double desired=PriceRound(entry+RR*(entry-sl),direction>0);
      if(MathAbs(desired-tp)>SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE)/2.0)
      {
        bool modified=trade.PositionModify(positionTicket,sl,desired);
        if(!modified || trade.ResultRetcode()!=TRADE_RETCODE_DONE)
          Print("HC22 WARN TP adjustment failed ",trade.ResultRetcode());
        if(PositionSelectByTicket(positionTicket)) tp=PositionGetDouble(POSITION_TP);
      }
    }
  }
  else if(HistoryOrderSelect(order))
  {
    sl=HistoryOrderGetDouble(order,ORDER_SL);
    tp=HistoryOrderGetDouble(order,ORDER_TP);
  }
  string parts[];
  int number=StringSplit(dealTag,':',parts);
  int pat=(number>=4 ? (int)StringToInteger(parts[2]):0);
  int mode=(number>=4 ? (int)StringToInteger(parts[3]):0);
  string patName=(pat==1 ? "ABCD":pat==2 ? "GARTLEY":pat==3 ? "BAT":pat==4 ? "BUTTERFLY":"UNKNOWN");
  string modeName=(mode==FOLLOW_ONLY ? "FOLLOW":mode==REVERSAL_ONLY ? "REVERSAL":"UNKNOWN");
  string msg=StringFormat("SEKTE MUSANG TEORY CEBONK COMPANY 22\nHARMONIC H1 / CB1 M5\n%s | %s\n%s %s\nENTRY %s\nPRICE %s | SL %s | TP %s\nRR target 1:2 | OJO FULLMARGIN COK",
                          patName,modeName,_Symbol,(direction>0 ? "BUY":"SELL"),
                          TimeToString(TimeCurrent(),TIME_DATE|TIME_MINUTES),
                          DoubleToString(entry,_Digits),DoubleToString(sl,_Digits),DoubleToString(tp,_Digits));
  if(EnableMT5Push && !SendNotification(msg)) Print("HC22 Push failed: ",GetLastError());
  if(EnableTelegram && TelegramBotToken!="" && TelegramChatID!="" && !MQLInfoInteger(MQL_TESTER))
  {
    string url="https://api.telegram.org/bot"+TelegramBotToken+"/sendMessage";
    string body="chat_id="+UrlEncode(TelegramChatID)+"&text="+UrlEncode(msg);
    char post[],answer[];
    StringToCharArray(body,post,0,StringLen(body),CP_UTF8);
    string headers="";
    int status=WebRequest("POST",url,"Content-Type: application/x-www-form-urlencoded\r\n",5000,post,answer,headers);
    if(status!=200) Print("HC22 Telegram failed HTTP=",status," MT5err=",GetLastError(),"; allow api.telegram.org under MT5 WebRequest");
  }
}

int OnInit()
{
  if(H1Lookback<120 || H1Lookback>2000 || PivotDepth<1 || PivotDepth>5 ||
     MaxDClosedH1Bars<1 || MaxDClosedH1Bars>8 || M5Lookback<40 || M5Lookback>500 ||
     M5PivotDepth<1 || M5PivotDepth>4 || MaxM5CB1AgeBars<4 || MaxM5CB1AgeBars>M5Lookback-5 ||
     FibTolerance<0.005 || FibTolerance>0.15 || MinimumH1XA_Points<=0 ||
     CB1BreakBufferPoints<0 || CB1MinBodyRatio<0 || CB1MinBodyRatio>1 ||
     MaxSLPoints<=0 || SLBufferPoints<0 || MaxChasePoints<=0 ||
     MaxRiskPercent<=0 || MaxRiskPercent>5 || DailyEquityStopPercent<=0 || DailyEquityStopPercent>10 ||
     MaxOpenPositions<1 || MaxOpenPositions>10 || MaxSpreadPoints<0 || DeviationPoints<0 ||
     BrokerStartHour<0 || BrokerStartHour>23 || BrokerEndHour<0 || BrokerEndHour>24 ||
     !MathIsValidNumber(FixedLot) || FixedLot<=0 || (!EnableABCD && !EnableGartley && !EnableBat && !EnableButterfly))
     return INIT_PARAMETERS_INCORRECT;
  double minLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN),maxLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
  double lotStep=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
  if(lotStep<=0 || FixedLot<minLot || FixedLot>maxLot ||
     MathAbs(FixedLot/lotStep-MathRound(FixedLot/lotStep))>1e-7) return INIT_PARAMETERS_INCORRECT;
  if(AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
  { Print("HC22 requires a hedging account to preserve independent SL/TP"); return INIT_FAILED; }
  emaHandle=iMA(_Symbol,H1TF,50,0,MODE_EMA,PRICE_CLOSE);
  if(emaHandle==INVALID_HANDLE) return INIT_FAILED;
  claimKey=StringFormat("HC22.C.%I64d.%s.%I64u",AccountInfoInteger(ACCOUNT_LOGIN),_Symbol,Magic);
  if(StringLen(claimKey)>63) return INIT_FAILED;
  if(!GlobalVariableCheck(claimKey)) GlobalVariableSet(claimKey,0);
  trade.SetExpertMagicNumber(Magic);
  trade.SetDeviationInPoints(DeviationPoints);
  trade.SetAsyncMode(false);
  trade.SetTypeFillingBySymbol(_Symbol);
  autopilot=StartAutopilot;
  lastM5=iTime(_Symbol,M5TF,1); // don't trade stale bar when EA is attached
  PaintButton();
  Print("HC22 initialized. H1->M5, mode=",(int)StrategyMode," REAL LOCK=",!AllowRealAccount);
  return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
  if(emaHandle!=INVALID_HANDLE) IndicatorRelease(emaHandle);
  ObjectDelete(0,button);
}

void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam)
{
  if(id==CHARTEVENT_OBJECT_CLICK && sparam==button)
  {
    autopilot=!autopilot;
    PaintButton();
    Print("HC22 AUTOPILOT ",autopilot ? "ON":"OFF");
  }
}

void OnTick()
{
  datetime closed=iTime(_Symbol,M5TF,1);
  if(closed==0 || closed==lastM5) return;
  MqlRates h[],m[];
  if(!ReadPrices(H1TF,H1Lookback,h) || !ReadPrices(M5TF,M5Lookback,m) || m[1].time!=closed) return;
  lastM5=closed;
  if(!autopilot || !SessionOpen() || (AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL && !AllowRealAccount)) return;
  if(!MQLInfoInteger(MQL_TRADE_ALLOWED) || !TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) ||
     !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) || !AccountInfoInteger(ACCOUNT_TRADE_EXPERT)) return;
  if(!DailyEquityOK()) { Print("HC22 SKIP daily equity stop"); return; }
  Setup s;
  if(!FindHarmonic(h,ArraySize(h),s)) return;
  double cb1=0;
  if(!BreakCB1(m,ArraySize(m),s,cb1)) return;
  Execute(s,cb1);
}

void OnTradeTransaction(const MqlTradeTransaction &trans,const MqlTradeRequest &request,const MqlTradeResult &result)
{
  if(trans.type!=TRADE_TRANSACTION_DEAL_ADD || trans.deal==0 || trans.order==0) return;
  if(!HistoryDealSelect(trans.deal)) return;
  if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=_Symbol ||
     (ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=Magic ||
     HistoryDealGetInteger(trans.deal,DEAL_ENTRY)!=DEAL_ENTRY_IN) return;
  string tag=HistoryDealGetString(trans.deal,DEAL_COMMENT);
  if(StringFind(tag,"HC22:")!=0 && HistoryOrderSelect(trans.order))
     tag=HistoryOrderGetString(trans.order,ORDER_COMMENT);
  if(StringFind(tag,"HC22:")!=0) return;
  NotifyFilled(trans.order,trans.deal,tag);
}