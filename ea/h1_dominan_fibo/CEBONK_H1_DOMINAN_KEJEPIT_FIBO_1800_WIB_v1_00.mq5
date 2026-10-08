//+------------------------------------------------------------------+
//| SEKTE MUSANG TEORY CEBONK COMPANY 22 - SINCE 2016                |
//| H1 Dominan Break / Candle Kejepit -> Fibo -0.236 / 1.618         |
//| V1.00 | Research EA: compile, backtest, then demo before live.    |
//+------------------------------------------------------------------+
#property copyright "SEKTE MUSANG TEORY CEBONK COMPANY 22"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>

enum ENUM_CEBONK_TP_MODE
  {
   TP_FIBO_1618 = 0,       // TP fib 1.618 as in screenshot
   TP_FIXED_RR  = 1        // TP = risk * fixed RR (default RR 1:2)
  };

input group "01 | Symbol and execution"
input string             InpSymbol                 = "";       // empty = chart symbol (XAUUSDc)
input long               InpMagic                  = 221018;
input double             InpFixedLot               = 0.01;
input bool               InpUseRiskPercent         = false;
input double             InpRiskPercent            = 0.50;
input int                InpMaxSpreadPoints        = 70;
input int                InpDeviationPoints        = 30;
input bool               InpAllowBUY               = true;
input bool               InpAllowSELL              = true;

input group "02 | Trading time (WIB = UTC+7)"
input int                InpStartHourWIB           = 18;       // 18:00 inclusive
input int                InpEndHourWIB             = 19;       // 19:00 exclusive
input int                InpBrokerUTCOffsetHours   = 3;        // tester fallback: NOZAX GMT+3
input bool               InpAutoDetectBrokerUTC    = true;     // live only; tester uses fallback
input int                InpEntryGraceMinutes      = 10;       // entry <= 10 min after H1 closes

input group "03 | Setup on closed H1 candles"
input bool               InpDominanBreakON         = true;
input bool               InpCandleKejepitON        = true;
input int                InpBreakPreviousBars      = 3;        // break high/low of 2-3 candles
input int                InpKejepitBars            = 2;
input double             InpDominanMinBodyRatio    = 0.60;
input double             InpKejepitMaxBoxATR       = 1.20;
input double             InpMinBreakBodyATR        = 0.40;
input int                InpATRPeriod              = 14;

input group "04 | SL/TP Fibonacci"
input double             InpFiboSLMinusExtension   = 0.236;    // beyond Fibo 0.0
input double             InpFiboTPLevel            = 1.618;    // beyond Fibo 100.0
input ENUM_CEBONK_TP_MODE InpTPMode                = TP_FIBO_1618;
input double             InpFixedRR                = 2.0;      // only for TP_FIXED_RR

input group "05 | Notifications"
input bool               InpMT5PushON              = false;
input bool               InpTelegramON             = false;
input string             InpTelegramBotToken       = "";
input string             InpTelegramChatID         = "";

input group "06 | Chart control"
input bool               InpAutopilotInitiallyON    = true;

CTrade     trade;
string     g_symbol="",g_key="",g_button="CBH1_AUTOPILOT";
int        g_atrHandle=INVALID_HANDLE;
bool       g_auto=true;
datetime   g_doneH1=0,g_retryAfter=0;

// Return UTC offset from broker time; don't auto-detect in MT5 Tester:
// TimeGMT() there is simulated server time, not necessarily real UTC.
int BrokerOffset()
  {
   int offset=InpBrokerUTCOffsetHours;
   if(InpAutoDetectBrokerUTC && !MQLInfoInteger(MQL_TESTER))
     {
      int measured=(int)MathRound((double)(TimeTradeServer()-TimeGMT())/3600.0);
      if(measured>=-12 && measured<=14) offset=measured;
     }
   return offset;
  }

datetime ToWIB(const datetime brokerTime)
  {
   return brokerTime+(7-BrokerOffset())*3600;
  }

bool WithinSession(const datetime brokerNow)
  {
   MqlDateTime t;
   TimeToStruct(ToWIB(brokerNow),t);
   int nowMinute=t.hour*60+t.min;
   int start=InpStartHourWIB*60;
   int finish=InpEndHourWIB*60;
   if(start==finish) return true;  // 24 hours (explicit choice)
   if(start<finish) return (nowMinute>=start && nowMinute<finish);
   return (nowMinute>=start || nowMinute<finish);
  }

void UpdateButton()
  {
   ObjectSetString(0,g_button,OBJPROP_TEXT,g_auto?"AUTOPILOT ON":"AUTOPILOT OFF");
   ObjectSetInteger(0,g_button,OBJPROP_BGCOLOR,g_auto?clrGreen:clrMaroon);
   ChartRedraw(0);
  }

void SaveDone(const datetime barTime)
  {
   g_doneH1=barTime;
   GlobalVariableSet(g_key+".BAR",(double)barTime);
  }

bool HasAnySymbolPosition()
  {
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong ticket=PositionGetTicket(i);
      if(ticket>0 && PositionGetString(POSITION_SYMBOL)==g_symbol) return true;
     }
   return false;
  }

double NormalizeLots(const double asked)
  {
   double minV=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_MIN);
   double maxV=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(g_symbol,SYMBOL_VOLUME_STEP);
   if(step<=0 || asked<minV-1e-9) return 0; // never raise risk to min volume
   double vol=MathMin(asked,maxV);
   vol=MathFloor((vol+1e-10)/step)*step;
   vol=NormalizeDouble(vol,8);
   return (vol>=minV-1e-9)?vol:0;
  }

double CalculateLots(const ENUM_ORDER_TYPE type,const double entry,const double sl)
  {
   if(!InpUseRiskPercent) return NormalizeLots(InpFixedLot);
   double loss1=0;
   if(!OrderCalcProfit(type,g_symbol,1.0,entry,sl,loss1) || loss1>=0)
      return 0;
   double riskMoney=AccountInfoDouble(ACCOUNT_EQUITY)*InpRiskPercent/100.0;
   return NormalizeLots(riskMoney/MathAbs(loss1));
  }

// Form-url-encode UTF-8 bytes, including line breaks and special characters.
string UrlEncode(const string str)
  {
   uchar bytes[];
   int n=StringToCharArray(str,bytes,0,WHOLE_ARRAY,CP_UTF8);
   string out="";
   for(int i=0;i<n-1;i++)
     {
      int b=(int)bytes[i];
      if((b>=65 && b<=90)||(b>=97 && b<=122)||
         (b>=48 && b<=57)||b==45||b==95||b==46||b==126)
         out+=CharToString((uchar)b);
      else
         out+=StringFormat("%%%02X",b);
     }
   return out;
  }

void SendTradeNotice(const string message)
  {
   Print(message);
   if(MQLInfoInteger(MQL_TESTER)) return;
   if(InpMT5PushON && !SendNotification(message))
      Print("MT5 Push failure. Code=",GetLastError());
   if(!InpTelegramON) return;
   if(InpTelegramBotToken=="" || InpTelegramChatID=="")
     {
      Print("Telegram enabled but token/chat_id empty.");
      return;
     }
   string post="chat_id="+UrlEncode(InpTelegramChatID)+"&text="+UrlEncode(message);
   char payload[],response[];
   string responseHeaders="";
   StringToCharArray(post,payload,0,StringLen(post),CP_UTF8);
   ResetLastError();
   int code=WebRequest("POST",
                       "https://api.telegram.org/bot"+InpTelegramBotToken+"/sendMessage",
                       "Content-Type: application/x-www-form-urlencoded\r\n",
                       5000,payload,response,responseHeaders);
   if(code!=200)
      Print("Telegram HTTP=",code," / MT5 error=",GetLastError(),
            ". Allow https://api.telegram.org in Tools > Options > Expert Advisors.");
  }

// Returns 1 for BUY, -1 for SELL, 0 for no signal.
int IdentifySignal(MqlRates &r[],const double atr,string &setup)
  {
   int n=InpBreakPreviousBars;
   double highPrev=-DBL_MAX,lowPrev=DBL_MAX;
   for(int i=2;i<n+2;i++)
     {
      highPrev=MathMax(highPrev,r[i].high);
      lowPrev=MathMin(lowPrev,r[i].low);
     }
   double body=MathAbs(r[1].close-r[1].open);
   double range=r[1].high-r[1].low;
   if(range<=0 || body<InpMinBreakBodyATR*atr) return 0;
   double ratio=body/range;
   double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);

   bool buyBreak=(r[1].close>r[1].open && r[1].close>highPrev+point);
   bool sellBreak=(r[1].close<r[1].open && r[1].close<lowPrev-point);
   if(!buyBreak && !sellBreak) return 0;

   bool dominant=(InpDominanBreakON && ratio>=InpDominanMinBodyRatio);
   bool squeezed=false;
   if(InpCandleKejepitON)
     {
      double boxHi=-DBL_MAX,boxLo=DBL_MAX;
      for(int i=2;i<InpKejepitBars+2;i++)
        {
         boxHi=MathMax(boxHi,r[i].high);
         boxLo=MathMin(boxLo,r[i].low);
        }
      // Opposite-colored compressed candle, then closed break in trade direction.
      bool opposite=(buyBreak && r[2].close<r[2].open) ||
                    (sellBreak && r[2].close>r[2].open);
      squeezed=(opposite && boxHi-boxLo<=InpKejepitMaxBoxATR*atr);
     }
   if(!dominant && !squeezed) return 0;
   setup=dominant?"DOMINAN BREAK":"CANDLE KEJEPIT BREAK";
   if(buyBreak && InpAllowBUY) return 1;
   if(sellBreak && InpAllowSELL) return -1;
   return 0;
  }

bool ComputeStops(MqlRates &r[],const int direction,const double entry,
                  double &sl,double &tp,double &fiboTarget)
  {
   double boxHi=-DBL_MAX,boxLo=DBL_MAX;
   for(int i=1;i<InpBreakPreviousBars+2;i++)
     {
      boxHi=MathMax(boxHi,r[i].high);
      boxLo=MathMin(boxLo,r[i].low);
     }
   // Fibo 0 is setup extreme; Fibo 100 is breakout-candle extreme.
   double upper=(direction>0)?r[1].high:boxHi;
   double lower=(direction>0)?boxLo:r[1].low;
   double width=upper-lower;
   if(width<=0) return false;
   if(direction>0)
     {
      sl=lower-InpFiboSLMinusExtension*width;
      fiboTarget=upper+(InpFiboTPLevel-1.0)*width;
      tp=(InpTPMode==TP_FIXED_RR)?entry+InpFixedRR*(entry-sl):fiboTarget;
     }
   else
     {
      sl=upper+InpFiboSLMinusExtension*width;
      fiboTarget=lower-(InpFiboTPLevel-1.0)*width;
      tp=(InpTPMode==TP_FIXED_RR)?entry-InpFixedRR*(sl-entry):fiboTarget;
     }
   int digits=(int)SymbolInfoInteger(g_symbol,SYMBOL_DIGITS);
   sl=NormalizeDouble(sl,digits);
   tp=NormalizeDouble(tp,digits);
   fiboTarget=NormalizeDouble(fiboTarget,digits);
   return (direction>0)?(sl<entry && tp>entry):(sl>entry && tp<entry);
  }

bool StopsValid(const int direction,const MqlTick &tick,
                const double sl,const double tp)
  {
   double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);
   double minGap=(double)SymbolInfoInteger(g_symbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
   minGap+=2.0*point; // safety margin; don't silently change screenshot levels
   if(direction>0) return (tick.bid-sl>minGap && tp-tick.bid>minGap);
   return (sl-tick.ask>minGap && tick.ask-tp>minGap);
  }

void ProcessH1(const datetime now)
  {
   if(!g_auto || !WithinSession(now) || now<g_retryAfter) return;
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) ||
      !MQLInfoInteger(MQL_TRADE_ALLOWED)) return;
   if(Bars(g_symbol,PERIOD_H1)<InpATRPeriod+InpBreakPreviousBars+5) return;

   MqlRates r[];
   ArraySetAsSeries(r,true);
   int need=MathMax(InpBreakPreviousBars,InpKejepitBars)+3;
   if(CopyRates(g_symbol,PERIOD_H1,0,need,r)!=need) return;
   datetime startOfCurrentH1=r[0].time;
   if(startOfCurrentH1<=g_doneH1) return;
   long elapsed=(long)(now-startOfCurrentH1);
   if(elapsed<0 || elapsed>InpEntryGraceMinutes*60) return;

   // Closed candle r[1] is the ONLY signal candle: no repaint / look-ahead.
   double atrValue[];
   if(CopyBuffer(g_atrHandle,0,1,1,atrValue)!=1 || atrValue[0]<=0) return;
   string setup="";
   int direction=IdentifySignal(r,atrValue[0],setup);
   if(direction==0) { SaveDone(startOfCurrentH1); return; }
   if(HasAnySymbolPosition())
     {
      Print("H1 valid signal, but a position already exists for ",g_symbol);
      SaveDone(startOfCurrentH1);
      return;
     }
   MqlTick tick;
   if(!SymbolInfoTick(g_symbol,tick)) return;
   double point=SymbolInfoDouble(g_symbol,SYMBOL_POINT);
   if(point<=0) return;
   double spread=(tick.ask-tick.bid)/point;
   if(spread>InpMaxSpreadPoints)
     {
      g_retryAfter=now+30;
      Print("Skipped/retry: spread ",DoubleToString(spread,1)," > ",InpMaxSpreadPoints);
      return;
     }

   double entry=(direction>0)?tick.ask:tick.bid;
   double sl=0,tp=0,fiboTarget=0;
   if(!ComputeStops(r,direction,entry,sl,tp,fiboTarget))
     {
      Print("Fibonacci stop/target invalid at current price; skipping bar.");
      SaveDone(startOfCurrentH1);
      return;
     }
   if(!StopsValid(direction,tick,sl,tp))
     {
      Print("Fibonacci SL/TP violates broker minimum stop distance; skipping bar.");
      SaveDone(startOfCurrentH1);
      return;
     }
   ENUM_ORDER_TYPE type=(direction>0)?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
   double lot=CalculateLots(type,entry,sl);
   if(lot<=0)
     {
      Print("Volume smaller than broker minimum or invalid risk; skipping bar.");
      SaveDone(startOfCurrentH1);
      return;
     }
   trade.SetExpertMagicNumber((ulong)InpMagic);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetTypeFillingBySymbol(g_symbol);
   bool sent=(direction>0)
             ?trade.Buy(lot,g_symbol,0.0,sl,tp,"CEBONK H1 FIBO")
             :trade.Sell(lot,g_symbol,0.0,sl,tp,"CEBONK H1 FIBO");
   uint ret=trade.ResultRetcode();
   if(sent && (ret==TRADE_RETCODE_DONE || ret==TRADE_RETCODE_DONE_PARTIAL))
     {
      SaveDone(startOfCurrentH1); // persisted; 1 position = 1 notification
      int digits=(int)SymbolInfoInteger(g_symbol,SYMBOL_DIGITS);
      double executed=trade.ResultPrice();
      if(executed<=0) executed=entry;
      string directionText=(direction>0)?"BUY":"SELL";
      string msg="SEKTE MUSANG TEORY CEBONK COMPANY 22\n"+
                 "H1 "+directionText+" | "+setup+"\n"+
                 g_symbol+" | WIB "+TimeToString(ToWIB(now),TIME_DATE|TIME_MINUTES)+"\n"+
                 "Lot: "+DoubleToString(lot,2)+" | Entry: "+DoubleToString(executed,digits)+"\n"+
                 "SL: "+DoubleToString(sl,digits)+" | TP: "+DoubleToString(tp,digits)+"\n"+
                 "Fibo TP 1.618: "+DoubleToString(fiboTarget,digits)+
                 " | Deal: "+(string)trade.ResultDeal();
      SendTradeNotice(msg);
     }
   else
     {
      g_retryAfter=now+30;
      Print("Order failed: ",trade.ResultRetcodeDescription(),
            " / code=",ret," / last error=",GetLastError());
     }
  }

int OnInit()
  {
   g_symbol=(InpSymbol=="")?_Symbol:InpSymbol;
   if(!SymbolSelect(g_symbol,true)) return INIT_FAILED;
   if(InpStartHourWIB<0 || InpStartHourWIB>23 ||
      InpEndHourWIB<0 || InpEndHourWIB>23 ||
      InpEntryGraceMinutes<1 || InpEntryGraceMinutes>59 ||
      InpBreakPreviousBars<2 || InpBreakPreviousBars>3 ||
      InpKejepitBars<1 || InpKejepitBars>3 ||
      InpATRPeriod<2 || InpFiboTPLevel<=1.0 ||
      InpFiboSLMinusExtension<=0 || InpFixedRR<=0 ||
      InpFixedLot<=0 || InpRiskPercent<=0 ||
      InpMaxSpreadPoints<0 || InpDeviationPoints<0)
      return INIT_PARAMETERS_INCORRECT;

   g_atrHandle=iATR(g_symbol,PERIOD_H1,InpATRPeriod);
   if(g_atrHandle==INVALID_HANDLE) return INIT_FAILED;
   g_key="CBH1."+IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN))+
         "."+g_symbol+"."+IntegerToString(InpMagic);
   if(GlobalVariableCheck(g_key+".BAR"))
      g_doneH1=(datetime)(long)GlobalVariableGet(g_key+".BAR");
   g_auto=InpAutopilotInitiallyON;
   if(GlobalVariableCheck(g_key+".AUTO"))
      g_auto=(GlobalVariableGet(g_key+".AUTO")>0.5);

   ObjectCreate(0,g_button,OBJ_BUTTON,0,0,0);
   ObjectSetInteger(0,g_button,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,g_button,OBJPROP_XDISTANCE,12);
   ObjectSetInteger(0,g_button,OBJPROP_YDISTANCE,24);
   ObjectSetInteger(0,g_button,OBJPROP_XSIZE,140);
   ObjectSetInteger(0,g_button,OBJPROP_YSIZE,28);
   ObjectSetInteger(0,g_button,OBJPROP_COLOR,clrWhite);
   ObjectSetInteger(0,g_button,OBJPROP_FONTSIZE,10);
   UpdateButton();
   Print("CEBONK H1 ready: ",g_symbol," | WIB ",InpStartHourWIB,
         ":00-",InpEndHourWIB,":00; broker UTC offset=",BrokerOffset());
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   ObjectDelete(0,g_button);
   if(g_atrHandle!=INVALID_HANDLE) IndicatorRelease(g_atrHandle);
  }

void OnChartEvent(const int id,const long &lparam,
                  const double &dparam,const string &sparam)
  {
   if(id==CHARTEVENT_OBJECT_CLICK && sparam==g_button)
     {
      g_auto=!g_auto;
      GlobalVariableSet(g_key+".AUTO",g_auto?1.0:0.0);
      ObjectSetInteger(0,g_button,OBJPROP_STATE,false);
      UpdateButton();
      Print("CEBONK H1 autopilot: ",g_auto?"ON":"OFF");
     }
  }

void OnTick()
  {
   // Attach this EA to the XAUUSDc H1 chart (or specify the symbol).
   // With another chart symbol, ticks may not coincide with H1 close.
   ProcessH1(TimeCurrent());
  }
//+------------------------------------------------------------------+
