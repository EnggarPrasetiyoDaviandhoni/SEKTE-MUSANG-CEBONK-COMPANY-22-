// CEBONK COMPANY 22 — SINCE 2016
// BBMA peta arah TF1 -> FMCBR Musang Elite EL2/EL3A TF2.
// Eksperimental. Uji MetaEditor + Strategy Tester sebelum live.
#property strict
#property version "1.00"
#property description "CEBONK BBMA 2TF FMCBR MUSANG ELITE AUTO LOT"
#include <Trade/Trade.mqh>

enum ENUM_FMCBR_MODE { FMCBR_EL2=0, FMCBR_EL3_A=1 };
enum ENUM_CEBONK_LOT { LOT_AUTO_EQUITY_RISK=0, LOT_FIXED=1 };

input group "=== PETA ARAH / FMCBR ==="
input ENUM_TIMEFRAMES InpTF1=PERIOD_M15;    // BBMA bias
input ENUM_TIMEFRAMES InpTF2=PERIOD_M5;     // FMCBR execution
input ENUM_FMCBR_MODE InpEntryMode=FMCBR_EL2;
input int InpZoneLookback=8;
input int InpCBLookback=22;
input int InpSetupExpiryBars=24;
input double InpIBMinBodyRatio=0.50;

input group "=== FILTER SIDEWAYS ==="
input bool InpSkipSideways=true;
input int InpATRPeriod=14;
input double InpBBWidthATR=1.50;           // width<=1.5 ATR
input double InpMidSlopeATR=0.25;          // 3 closed TF1 bars
input int InpMidSlopeBars=3;

input group "=== LOT SESUAI MODAL / RISK ==="
input ENUM_CEBONK_LOT InpLotMode=LOT_AUTO_EQUITY_RISK;
input double InpRiskPercent=0.50;          // % equity, account currency
input double InpFixedLot=0.01;
input double InpMaxTotalRiskPercent=2.00;  // own-magic open positions
input double InpMaxDailyDDPercent=5.00;    // server-day baseline equity
input double InpRiskReward=2.00;           // TP fixed at 2x initial SL risk
input double InpMaxSpreadRiskRatio=0.20;   // spread / price SL distance

input group "=== EXECUTION ==="
input ulong InpMagic=22102622;
input int InpMaxSpreadPoints=70;
input int InpDeviationPoints=20;
input int InpSessionStartHour=7;
input int InpSessionEndHour=23;
input bool InpAutopilotOnStart=true;

input group "=== TELEGRAM / PUSH ==="
input bool InpTelegramEnabled=true;
input string InpTelegramToken="";
input string InpTelegramChatID="";
input bool InpPushEnabled=false;

CTrade trade;
int hBB=INVALID_HANDLE,hATR=INVALID_HANDLE;
int hBB2=INVALID_HANDLE,hATR2=INVALID_HANDLE;
int hMA5Low=INVALID_HANDLE,hMA10Low=INVALID_HANDLE;
int hMA5High=INVALID_HANDLE,hMA10High=INVALID_HANDLE;
datetime processedBar=0;
bool historyPrimed=false;
datetime lastHistoryLogBar=0;
bool autopilot=true;
string buttonName="CEBONK_2TF_ELITE_AUTOPILOT",claimKey="";
double eliteLevels[18]={0.0,0.12,0.236,0.382,0.5,0.786,0.88,
                         1.272,1.314,1.618,1.786,1.88,2.618,2.786,
                         2.880,4.23,4.786,4.88};

enum ENUM_PHASE { PHASE_IDLE=0, PHASE_CB1=1, PHASE_CB2=2, PHASE_RETEST=3 };
struct SSetup
{
   bool active;
   int direction;
   ENUM_PHASE phase;
   datetime initialBar;
   double zoneLow,zoneHigh,cb1,cb2;
   bool hasCB2;
   double fibBase,fibAnchor;
};
SSetup setup;
double noticeF1=0,noticeF2=0,noticeCycle=0,noticeSL=0,noticeTP=0;
string noticeMode="";

void ResetSetup()
{
   setup.active=false;setup.direction=0;setup.phase=PHASE_IDLE;
   setup.initialBar=0;setup.zoneLow=0;setup.zoneHigh=0;
   setup.cb1=0;setup.cb2=0;setup.hasCB2=false;
   setup.fibBase=0;setup.fibAnchor=0;
}
string ModeLabel(){return (InpEntryMode==FMCBR_EL2?"EL2":"EL3A");}
// Every native MT5 timeframe is selectable: 21 periods, 210 descending pairs.
// TF1 must be strictly larger than TF2; chart/tester period can be ANY value.
bool NativeTimeframe(ENUM_TIMEFRAMES tf)
{
   switch(tf)
   {
      case PERIOD_M1:
      case PERIOD_M2:
      case PERIOD_M3:
      case PERIOD_M4:
      case PERIOD_M5:
      case PERIOD_M6:
      case PERIOD_M10:
      case PERIOD_M12:
      case PERIOD_M15:
      case PERIOD_M20:
      case PERIOD_M30:
      case PERIOD_H1:
      case PERIOD_H2:
      case PERIOD_H3:
      case PERIOD_H4:
      case PERIOD_H6:
      case PERIOD_H8:
      case PERIOD_H12:
      case PERIOD_D1:
      case PERIOD_W1:
      case PERIOD_MN1:
         return true;
      default: return false;
   }
}
// History warm-up is per SELECTED pair; missing a higher timeframe
// never disables another test run/combination.
bool HistoryReady()
{
   int need1=(int)MathMax(30,InpATRPeriod+InpMidSlopeBars+5);
   int need2=(int)MathMax(InpCBLookback+6,
                          MathMax(InpZoneLookback+5,InpATRPeriod+InpMidSlopeBars+5));
   int b1=Bars(_Symbol,InpTF1),b2=Bars(_Symbol,InpTF2);
   bool ready=(b1>=need1 && b2>=need2 &&
       BarsCalculated(hBB)>=need1 &&
       BarsCalculated(hATR)>=need1 &&
       BarsCalculated(hMA5Low)>=need1 &&
       BarsCalculated(hMA10Low)>=need1 &&
       BarsCalculated(hMA5High)>=need1 &&
       BarsCalculated(hMA10High)>=need1 &&
       BarsCalculated(hBB2)>=need2 &&
       BarsCalculated(hATR2)>=need2);
   if(!ready)
   {
      datetime mark=iTime(_Symbol,InpTF2,0);
      if(mark!=lastHistoryLogBar)
      {
         lastHistoryLogBar=mark;
         PrintFormat("WAIT_HISTORY: TF1=%s bars=%d/%d; TF2=%s bars=%d/%d. Load earlier broker history.",
                 EnumToString(InpTF1),b1,need1,EnumToString(InpTF2),b2,need2);
      }
   }
   return ready;
}
bool Bar(ENUM_TIMEFRAMES tf,int shift,MqlRates &b)
{
   MqlRates one[1];
   if(CopyRates(_Symbol,tf,shift,1,one)!=1)return false;
   b=one[0];
   return (b.time>0 && b.close>0 && b.high>b.low);
}
bool Buffer(int handle,int index,int shift,double &v)
{
   double out[1];
   if(handle==INVALID_HANDLE || CopyBuffer(handle,index,shift,1,out)!=1)return false;
   v=out[0];
   return (MathIsValidNumber(v) && v!=EMPTY_VALUE && v>0);
}
double CandleBodyRatio(const MqlRates &b)
{
   double span=b.high-b.low;
   return (span>0?MathAbs(b.close-b.open)/span:0);
}
// Causal BBMA bias. Closed TF1 candle only; bullish MA5/10 LOW over MidBB
// or bearish MA5/10 HIGH under MidBB. ATR used ONLY for sideways detection.
int BBMABias()
{
   MqlRates b;
   double mid,hi,lo,previousMid,ma5L,ma10L,ma5H,ma10H,atr;
   if(!Bar(InpTF1,1,b) || !Buffer(hBB,0,1,mid) ||
      !Buffer(hBB,1,1,hi) || !Buffer(hBB,2,1,lo) ||
      !Buffer(hBB,0,1+InpMidSlopeBars,previousMid) ||
      !Buffer(hATR,0,1,atr) ||
      !Buffer(hMA5Low,0,1,ma5L) || !Buffer(hMA10Low,0,1,ma10L) ||
      !Buffer(hMA5High,0,1,ma5H) || !Buffer(hMA10High,0,1,ma10H))
      return 0;
   double slope=mid-previousMid;
   bool compression=((hi-lo)<=InpBBWidthATR*atr);
   bool flat=(MathAbs(slope)<=InpMidSlopeATR*atr);
   if(InpSkipSideways && compression && flat)return 0;
   bool buy=(b.close>mid && ma5L>mid && ma10L>mid && slope>0);
   bool sell=(b.close<mid && ma5H<mid && ma10H<mid && slope<0);
   if(buy==sell)return 0;
   return buy?1:-1;
}
// Sideways veto on the entry timeframe also uses only CLOSED candles.
bool EntryTFSideways()
{
   if(!InpSkipSideways)return false;
   double mid,upper,lower,oldMid,atr;
   // Missing data fails closed: no speculative entry on incomplete history.
   if(!Buffer(hBB2,0,1,mid)||!Buffer(hBB2,1,1,upper)||
      !Buffer(hBB2,2,1,lower)||
      !Buffer(hBB2,0,1+InpMidSlopeBars,oldMid)||
      !Buffer(hATR2,0,1,atr))return true;
   return ((upper-lower)<=InpBBWidthATR*atr &&
           MathAbs(mid-oldMid)<=InpMidSlopeATR*atr);
}
bool Pivot(int shift,int direction,double &level)
{
   // Never consult bar shift 0; shift >=3 therefore all three are CLOSED.
   MqlRates newer,candidate,older;
   if(shift<3 || !Bar(InpTF2,shift-1,newer) ||
      !Bar(InpTF2,shift,candidate) || !Bar(InpTF2,shift+1,older))
      return false;
   if(direction>0)
   {
      if(candidate.high<=newer.high || candidate.high<older.high)return false;
      level=candidate.high;
   }
   else
   {
      if(candidate.low>=newer.low || candidate.low>older.low)return false;
      level=candidate.low;
   }
   return true;
}
// CB1: first confirmed old structural pivot; CB2: next older, farther pivot.
bool LocateCB(int direction,double &cb1,double &cb2,bool &hasCB2)
{
   bool one=false;
   hasCB2=false;cb1=0;cb2=0;
   for(int s=3;s<=InpCBLookback+2;s++)
   {
      double x;
      if(!Pivot(s,direction,x))continue;
      if(!one){cb1=x;one=true;continue;}
      if(direction>0?x>cb1:x<cb1)
      {cb2=x;hasCB2=true;break;}
   }
   return one;
}
// Last opposite candle before Initial Break defines a fixed wick-to-body zone.
// This is a documented mechanical interpretation of the illustrated FMCBR PDF.
bool ZoneFromKilledCandle(int direction,const MqlRates &breakout,double &low,double &high)
{
   for(int s=2;s<=InpZoneLookback+1;s++)
   {
      MqlRates c;
      if(!Bar(InpTF2,s,c))return false;
      if(direction>0 && c.close<c.open && breakout.close>c.high)
      {
         low=c.low;high=MathMax(c.open,c.close);
         return high>low;
      }
      if(direction<0 && c.close>c.open && breakout.close<c.low)
      {
         low=MathMin(c.open,c.close);high=c.high;
         return high>low;
      }
   }
   return false;
}
bool Breaks(const MqlRates &c,double level,int direction)
{
   double gap=2.0*_Point;
   if(CandleBodyRatio(c)<0.40)return false;
   if(direction>0)return(c.close>c.open && c.close>level+gap);
   return(c.close<c.open && c.close<level-gap);
}
bool ZoneRetest(const MqlRates &b)
{
   if(!(b.low<=setup.zoneHigh && b.high>=setup.zoneLow))return false;
   if(setup.direction>0)return(b.close>b.open && b.close>setup.zoneHigh);
   return(b.close<b.open && b.close<setup.zoneLow);
}
void Arm(int direction)
{
   MqlRates current,previous;
   if(!Bar(InpTF2,1,current)||!Bar(InpTF2,2,previous))return;
   if(CandleBodyRatio(current)<InpIBMinBodyRatio)return;
   if(direction>0)
   {
      if(current.close<=current.open || current.close<=previous.high)return;
   }
   else
   {
      if(current.close>=current.open || current.close>=previous.low)return;
   }
   double low,high,cb1,cb2;
   bool hasCB2;
   if(!ZoneFromKilledCandle(direction,current,low,high) ||
      !LocateCB(direction,cb1,cb2,hasCB2))return;
   if(InpEntryMode==FMCBR_EL3_A && !hasCB2)return;
   ResetSetup();
   setup.active=true;setup.direction=direction;setup.phase=PHASE_CB1;
   setup.initialBar=current.time;
   setup.zoneLow=low;setup.zoneHigh=high;
   setup.cb1=cb1;setup.cb2=cb2;setup.hasCB2=hasCB2;
   setup.fibBase=(direction>0?low:high);
   // IB breakout can break CB1 (and CB2) on the same CLOSED candle.
   if(Breaks(current,cb1,direction))
   {
      setup.fibAnchor=current.close; // BODY close is locked; no future relocation
      setup.phase=(InpEntryMode==FMCBR_EL2?PHASE_RETEST:PHASE_CB2);
      if(InpEntryMode==FMCBR_EL3_A && Breaks(current,cb2,direction))
         setup.phase=PHASE_RETEST;
   }
   PrintFormat("FMCBR IB ARMED %s %s zone[%.5f,%.5f] CB1=%.5f CB2=%.5f",
               ModeLabel(),direction>0?"BUY":"SELL",low,high,cb1,cb2);
}
int SetupAgeBars()
{
   return iBarShift(_Symbol,InpTF2,setup.initialBar,true);
}
double Elite(double level)
{
   return setup.fibBase+(setup.fibAnchor-setup.fibBase)*level;
}
double TickAligned(double p,bool roundUp)
{
   double ts=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   if(ts<=0)return 0;
   // Broker tick-size normalization only; NO ATR/pips SL buffer.
   return NormalizeDouble((roundUp?MathCeil(p/ts-1e-9):MathFloor(p/ts+1e-9))*ts,_Digits);
}
bool SessionAllowed()
{
   MqlDateTime t;
   TimeToStruct(TimeCurrent(),t);
   if(t.day_of_week==0 || t.day_of_week==6)return false;
   if(InpSessionStartHour==InpSessionEndHour)return true;
   if(InpSessionStartHour<InpSessionEndHour)
      return(t.hour>=InpSessionStartHour && t.hour<InpSessionEndHour);
   return(t.hour>=InpSessionStartHour || t.hour<InpSessionEndHour);
}
bool TradeEnabled()
{
   return autopilot && SessionAllowed() &&
          (bool)MQLInfoInteger(MQL_TRADE_ALLOWED) &&
          (bool)TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) &&
          (bool)AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) &&
          (bool)AccountInfoInteger(ACCOUNT_TRADE_EXPERT);
}
string DayKey()
{
   MqlDateTime t;TimeToStruct(TimeCurrent(),t);
   return StringFormat("C2D.%I64d.%I64u.%04d%02d%02d",
          AccountInfoInteger(ACCOUNT_LOGIN),InpMagic,t.year,t.mon,t.day);
}
double DayStartEquity()
{
   string key=DayKey();
   if(!GlobalVariableCheck(key))
   {
      if(GlobalVariableSet(key,AccountInfoDouble(ACCOUNT_EQUITY))==0)return 0;
      GlobalVariablesFlush();
   }
   return GlobalVariableGet(key);
}
// Portfolio cap checks all OPEN positions with the same EA magic, across symbols.
// Missing/malformed SL fails closed instead of assuming zero exposure.
bool OpenRisk(double &risk)
{
   risk=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic)continue;
      string sym=PositionGetString(POSITION_SYMBOL);
      double sl=PositionGetDouble(POSITION_SL);
      double ep=PositionGetDouble(POSITION_PRICE_OPEN);
      double volume=PositionGetDouble(POSITION_VOLUME);
      if(sl<=0||ep<=0||volume<=0)return false;
      ENUM_ORDER_TYPE direction=(PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?
                                 ORDER_TYPE_BUY:ORDER_TYPE_SELL);
      double outcome=0;
      if(!OrderCalcProfit(direction,sym,volume,ep,sl,outcome))return false;
      risk+=MathMax(0,-outcome);
   }
   return true;
}
bool NormalVolume(double volume)
{
   double minV=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double maxV=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   return step>0 && volume>=minV-1e-9 && volume<=maxV+1e-9 &&
          MathAbs((volume-minV)/step-MathRound((volume-minV)/step))<1e-6;
}
bool ChooseLot(ENUM_ORDER_TYPE type,double entry,double sl,
               double allowedRisk,double &lots,double &actualRisk)
{
   double minV=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double maxV=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   if(minV<=0 || maxV<minV || step<=0 || allowedRisk<=0)return false;
   if(InpLotMode==LOT_FIXED)lots=InpFixedLot;
   else
   {
      double atMin=0;
      if(!OrderCalcProfit(type,_Symbol,minV,entry,sl,atMin) || atMin>=0)return false;
      double perLot=(-atMin)/minV;
      double budgetLot=allowedRisk/perLot;
      if(budgetLot+1e-9<minV)return false; // never force minimum lot
      double desired=MathMin(maxV,budgetLot);
      double increments=MathFloor((desired-minV)/step+1e-9);
      lots=NormalizeDouble(minV+increments*step,8);
   }
   if(!NormalVolume(lots))return false;
   double outcome=0;
   if(!OrderCalcProfit(type,_Symbol,lots,entry,sl,outcome)||outcome>=0)return false;
   actualRisk=-outcome;
   if(actualRisk>allowedRisk+1e-7*MathMax(1,allowedRisk))return false;
   return true;
}
bool NettingConflict()
{
   if(AccountInfoInteger(ACCOUNT_MARGIN_MODE)==ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
      return false;
   // Netting merges positions at symbol level and may overwrite old SL/TP.
   // Therefore do not open another order if any symbol position exists.
   for(int i=PositionsTotal()-1;i>=0;i--)
      if(PositionGetTicket(i)>0 &&
         PositionGetString(POSITION_SYMBOL)==_Symbol)return true;
   return false;
}
void SubmitTrade()
{
   if(!TradeEnabled()){Print("SKIP_AUTOPILOT_OR_SESSION");return;}
   if(NettingConflict()){Print("SKIP_NETTING_POSITION_CONFLICT");return;}
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol,tick) || tick.ask<=tick.bid || tick.bid<=0)return;
   double spread=tick.ask-tick.bid;
   if(spread/_Point>InpMaxSpreadPoints)
   {Print("SKIP_SPREAD_LIMIT");return;}
   ENUM_ORDER_TYPE side=(setup.direction>0?ORDER_TYPE_BUY:ORDER_TYPE_SELL);
   double entry=(setup.direction>0?tick.ask:tick.bid);
   // SL EXACT IB zone boundary, outward tick rounding only.
   double sl=TickAligned(setup.direction>0?setup.zoneLow:setup.zoneHigh,setup.direction<0);
   double distance=(setup.direction>0?entry-sl:sl-entry);
   if(sl<=0||distance<=0||spread>InpMaxSpreadRiskRatio*distance)
   {Print("SKIP_BAD_SL_OR_SPREAD_TO_STOP");return;}
   double tp=TickAligned(entry+setup.direction*InpRiskReward*distance,setup.direction>0);
   double stopLevel=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*_Point;
   double freezeLevel=(double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL)*_Point;
   double required=MathMax(stopLevel,freezeLevel)+_Point;
   if(setup.direction>0?(tick.bid-sl<required||tp-tick.bid<required)
                       :(sl-tick.ask<required||tick.ask-tp<required))
   {Print("SKIP_BROKER_STOP_DISTANCE");return;}
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);
   double baseline=DayStartEquity();
   if(equity<=0||baseline<=0)return;
   double dailyFloor=baseline*(1.0-InpMaxDailyDDPercent/100.0);
   if(equity<=dailyFloor)
   {Print("SKIP_DAILY_DD_REACHED");return;}
   double existingRisk;
   if(!OpenRisk(existingRisk))
   {Print("SKIP_UNSAFE_OPEN_POSITION_RISK");return;}
   double totalAllowance=equity*InpMaxTotalRiskPercent/100.0-existingRisk;
   double dailyAllowance=equity-dailyFloor-existingRisk;
   double allowedRisk=MathMin(totalAllowance,dailyAllowance);
   if(InpLotMode==LOT_AUTO_EQUITY_RISK)
      allowedRisk=MathMin(allowedRisk,equity*InpRiskPercent/100.0);
   if(allowedRisk<=0)
   {Print("SKIP_PORTFOLIO_OR_DAILY_RISK");return;}
   double lots=0,plannedRisk=0;
   if(!ChooseLot(side,entry,sl,allowedRisk,lots,plannedRisk))
   {Print("SKIP_MIN_LOT_OR_RISK_CAP");return;}
   double margin=0;
   if(!OrderCalcMargin(side,_Symbol,lots,entry,margin) ||
      margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE))
   {Print("SKIP_INSUFFICIENT_MARGIN");return;}
   if(!trade.SetTypeFillingBySymbol(_Symbol))
   {Print("SKIP_FILLING_MODE");return;}
   // Atomic claim across same-symbol charts and terminal restarts.
   if(!GlobalVariableCheck(claimKey))GlobalVariableSet(claimKey,0);
   double old=GlobalVariableGet(claimKey);
   if(old>=(double)setup.initialBar ||
      !GlobalVariableSetOnCondition(claimKey,(double)setup.initialBar,old))
      return;
   GlobalVariablesFlush();
   noticeF1=Elite(eliteLevels[9]);
   noticeF2=Elite(eliteLevels[12]);
   noticeCycle=Elite(eliteLevels[15]);
   noticeSL=sl;noticeTP=tp;noticeMode=ModeLabel();
   string tag=StringFormat("C2E%s:%I64d",ModeLabel(),(long)setup.initialBar);
   bool sent=(setup.direction>0?
              trade.Buy(lots,_Symbol,entry,sl,tp,tag):
              trade.Sell(lots,_Symbol,entry,sl,tp,tag));
   uint rc=trade.ResultRetcode();
   if(!sent || (rc!=TRADE_RETCODE_DONE &&
                rc!=TRADE_RETCODE_DONE_PARTIAL &&
                rc!=TRADE_RETCODE_PLACED))
   {
      Print("ORDER_FAILED_UNCERTAIN ",rc," ",trade.ResultRetcodeDescription());
      return; // uncertain response must not trigger duplicate live order
   }
   PrintFormat("ORDER ACCEPTED %s lots=%.4f risk=%.2f SL=%.5f TP=%.5f",
                ModeLabel(),lots,plannedRisk,sl,tp);
}
void Progress(const MqlRates &bar,int bias)
{
   if(!setup.active)return;
   int age=SetupAgeBars();
   if(bias==0 || bias!=setup.direction || age<0 || age>InpSetupExpiryBars ||
      (setup.direction>0?bar.close<setup.zoneLow:bar.close>setup.zoneHigh))
   {ResetSetup();return;}
   if(setup.phase==PHASE_CB1 && Breaks(bar,setup.cb1,setup.direction))
   {
      setup.fibAnchor=bar.close; // freeze confirmed body anchor
      setup.phase=(InpEntryMode==FMCBR_EL2?PHASE_RETEST:PHASE_CB2);
      if(InpEntryMode==FMCBR_EL3_A &&
         setup.hasCB2 && Breaks(bar,setup.cb2,setup.direction))
         setup.phase=PHASE_RETEST;
      return;
   }
   if(setup.phase==PHASE_CB2 && setup.hasCB2 &&
      Breaks(bar,setup.cb2,setup.direction))
   {setup.phase=PHASE_RETEST;return;}
   if(setup.phase==PHASE_RETEST && ZoneRetest(bar))
   {
      SubmitTrade();
      ResetSetup(); // a retest is consumed even when preflight rejects it
   }
}
string UrlEncode(string str)
{
   uchar bytes[];
   int n=StringToCharArray(str,bytes,0,WHOLE_ARRAY,CP_UTF8);
   string out="";
   for(int i=0;i<n-1;i++)
   {
      int b=(int)bytes[i];
      if((b>=65&&b<=90)||(b>=97&&b<=122)||(b>=48&&b<=57)||
         b==45||b==95||b==46||b==126)out+=CharToString((uchar)b);
      else out+=StringFormat("%%%02X",b);
   }
   return out;
}
void Notify(string msg)
{
   Print(msg);
   if(MQLInfoInteger(MQL_TESTER))return;
   if(InpPushEnabled)SendNotification(msg);
   if(!InpTelegramEnabled || InpTelegramToken=="" || InpTelegramChatID=="")return;
   string body="chat_id="+UrlEncode(InpTelegramChatID)+"&text="+UrlEncode(msg);
   char data[],answer[];
   string headers;
   int n=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   if(n>0)ArrayResize(data,n-1);
   ResetLastError();
   int status=WebRequest("POST","https://api.telegram.org/bot"+InpTelegramToken+
                         "/sendMessage","Content-Type: application/x-www-form-urlencoded\r\n",
                         5000,data,answer,headers);
   if(status!=200)Print("TELEGRAM_ERROR http=",status," err=",GetLastError());
}
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &req,const MqlTradeResult &res)
{
   if(trans.type!=TRADE_TRANSACTION_DEAL_ADD || !HistoryDealSelect(trans.deal))return;
   if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=_Symbol ||
      (ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=InpMagic)return;
   ENUM_DEAL_ENTRY e=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal,DEAL_ENTRY);
   if(e!=DEAL_ENTRY_IN && e!=DEAL_ENTRY_OUT)return;
   ENUM_DEAL_REASON why=(ENUM_DEAL_REASON)HistoryDealGetInteger(trans.deal,DEAL_REASON);
   if(e==DEAL_ENTRY_OUT && why!=DEAL_REASON_TP && why!=DEAL_REASON_SL)return;
   long id=HistoryDealGetInteger(trans.deal,DEAL_POSITION_ID);
   string key=StringFormat("C2N.%I64d.%I64u.%I64d.%d",
              AccountInfoInteger(ACCOUNT_LOGIN),InpMagic,id,(int)e);
   if(StringLen(key)>63 || GlobalVariableCheck(key))return;
   if(GlobalVariableSet(key,(double)TimeCurrent())==0)return;
   GlobalVariablesFlush();
   if(e==DEAL_ENTRY_OUT)
   {
      Notify(why==DEAL_REASON_TP?"TAKE PROFIT 😅":"STOP LOSS 🥲");
      return;
   }
   double fill=HistoryDealGetDouble(trans.deal,DEAL_PRICE);
   double volume=HistoryDealGetDouble(trans.deal,DEAL_VOLUME);
   double sl=noticeSL,tp=noticeTP;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      if(PositionGetTicket(i)==0)continue;
      if(PositionGetInteger(POSITION_IDENTIFIER)!=id)continue;
      double pSL=PositionGetDouble(POSITION_SL),pTP=PositionGetDouble(POSITION_TP);
      if(pSL>0)sl=pSL;
      if(pTP>0)tp=pTP;
      break;
   }
   int direction=(HistoryDealGetInteger(trans.deal,DEAL_TYPE)==DEAL_TYPE_BUY?1:-1);
   string msg=StringFormat("SEKTE MUSANG CEBONK COMPANY 22\n%s %s | %s\nTF: %s > %s\nLot: %.4f\nEntry: %s\nSL: %s\nTP: %s\nElite 1.618: %s\nElite 2.618: %s\nCycle 4.23: %s",
       direction>0?"BUY":"SELL",_Symbol,noticeMode,
       EnumToString(InpTF1),EnumToString(InpTF2),volume,
       DoubleToString(fill,_Digits),DoubleToString(sl,_Digits),
       DoubleToString(tp,_Digits),DoubleToString(noticeF1,_Digits),
       DoubleToString(noticeF2,_Digits),DoubleToString(noticeCycle,_Digits));
   Notify(msg);
}
void DrawButton()
{
   if(ObjectFind(0,buttonName)<0)
   {
      ObjectCreate(0,buttonName,OBJ_BUTTON,0,0,0);
      ObjectSetInteger(0,buttonName,OBJPROP_XDISTANCE,12);
      ObjectSetInteger(0,buttonName,OBJPROP_YDISTANCE,20);
      ObjectSetInteger(0,buttonName,OBJPROP_XSIZE,165);
      ObjectSetInteger(0,buttonName,OBJPROP_YSIZE,29);
   }
   ObjectSetString(0,buttonName,OBJPROP_TEXT,autopilot?"AUTOPILOT ON":"AUTOPILOT OFF");
   ObjectSetInteger(0,buttonName,OBJPROP_BGCOLOR,autopilot?clrDarkGreen:clrMaroon);
   ObjectSetInteger(0,buttonName,OBJPROP_COLOR,clrWhite);
   ObjectSetInteger(0,buttonName,OBJPROP_STATE,false);
   ChartRedraw();
}
int OnInit()
{
   if(!NativeTimeframe(InpTF1) || !NativeTimeframe(InpTF2) ||
      PeriodSeconds(InpTF1)<=PeriodSeconds(InpTF2) ||
      InpZoneLookback<2 || InpCBLookback<5 || InpSetupExpiryBars<3 ||
      InpIBMinBodyRatio<=0 || InpIBMinBodyRatio>1 ||
      InpATRPeriod<2 || InpMidSlopeBars<1 ||
      InpBBWidthATR<=0 || InpMidSlopeATR<0 ||
      InpRiskPercent<=0 || InpRiskPercent>5 ||
      InpFixedLot<=0 || InpMaxTotalRiskPercent<=0 ||
      InpMaxDailyDDPercent<=0 || InpMaxDailyDDPercent>=100 ||
      InpRiskReward<=0 || InpMaxSpreadRiskRatio<=0 ||
      InpMaxSpreadRiskRatio>1 || InpMaxSpreadPoints<0 ||
      InpDeviationPoints<0 ||
      InpSessionStartHour<0 || InpSessionStartHour>23 ||
      InpSessionEndHour<0 || InpSessionEndHour>24)
      return INIT_PARAMETERS_INCORRECT;
   hBB=iBands(_Symbol,InpTF1,20,0,2.0,PRICE_CLOSE);
   hATR=iATR(_Symbol,InpTF1,InpATRPeriod);
   hBB2=iBands(_Symbol,InpTF2,20,0,2.0,PRICE_CLOSE);
   hATR2=iATR(_Symbol,InpTF2,InpATRPeriod);
   hMA5Low=iMA(_Symbol,InpTF1,5,0,MODE_LWMA,PRICE_LOW);
   hMA10Low=iMA(_Symbol,InpTF1,10,0,MODE_LWMA,PRICE_LOW);
   hMA5High=iMA(_Symbol,InpTF1,5,0,MODE_LWMA,PRICE_HIGH);
   hMA10High=iMA(_Symbol,InpTF1,10,0,MODE_LWMA,PRICE_HIGH);
   if(hBB==INVALID_HANDLE||hATR==INVALID_HANDLE||
      hBB2==INVALID_HANDLE||hATR2==INVALID_HANDLE||
      hMA5Low==INVALID_HANDLE||hMA10Low==INVALID_HANDLE||
      hMA5High==INVALID_HANDLE||hMA10High==INVALID_HANDLE)
   {Print("INIT ERROR: indicator");return INIT_FAILED;}
   claimKey=StringFormat("C2C.%I64d.%s.%I64u.%d.%d",
      AccountInfoInteger(ACCOUNT_LOGIN),_Symbol,InpMagic,(int)InpTF2,(int)InpEntryMode);
   if(StringLen(claimKey)>63)return INIT_PARAMETERS_INCORRECT;
   if(MQLInfoInteger(MQL_TESTER))
   {
      GlobalVariableSet(claimKey,0);
      // Fresh risk-day baseline for each independent tester run.
      GlobalVariableSet(DayKey(),AccountInfoDouble(ACCOUNT_EQUITY));
   }
   else if(!GlobalVariableCheck(claimKey))GlobalVariableSet(claimKey,0);
   if(DayStartEquity()<=0)return INIT_FAILED;
   if(!trade.SetTypeFillingBySymbol(_Symbol))return INIT_FAILED;
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpDeviationPoints);
   trade.SetAsyncMode(false);
   ResetSetup();
   autopilot=InpAutopilotOnStart;
   processedBar=0;
   historyPrimed=false;  // wait for BOTH TFs, then skip stale bar on start/restart
   DrawButton();
   Print("CEBONK BBMA 2TF FMCBR ELITE READY ",EnumToString(InpTF1),
         " -> ",EnumToString(InpTF2)," ",ModeLabel(),
         " AUTO RISK | chart TF independent | 21 MT5 periods");
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason)
{
   int handles[8]={hBB,hATR,hBB2,hATR2,hMA5Low,hMA10Low,hMA5High,hMA10High};
   for(int i=0;i<8;i++)if(handles[i]!=INVALID_HANDLE)IndicatorRelease(handles[i]);
   ObjectDelete(0,buttonName);
}
void OnChartEvent(const int id,const long &lp,const double &dp,const string &sp)
{
   if(id==CHARTEVENT_OBJECT_CLICK && sp==buttonName)
   {autopilot=!autopilot;DrawButton();}
}
void OnTick()
{
   // No chart timeframe dependency. Wait for both SELECTED series and indicators.
   if(!HistoryReady())return;
   MqlRates b;
   datetime stamp=iTime(_Symbol,InpTF2,1);
   if(stamp<=0||!Bar(InpTF2,1,b))return;
   if(!historyPrimed)
   {
      historyPrimed=true;processedBar=stamp;
      PrintFormat("HISTORY_READY: %s -> %s; bars=%d/%d; next TF2 candle will be evaluated.",
                  EnumToString(InpTF1),EnumToString(InpTF2),
                  Bars(_Symbol,InpTF1),Bars(_Symbol,InpTF2));
      return; // never retroactively enter old closed bar on attach/restart
   }
   if(stamp==processedBar)return;
   if(DayStartEquity()<=0)return;
   processedBar=stamp;
   int bias=BBMABias();
   if(EntryTFSideways())bias=0;
   if(setup.active){Progress(b,bias);return;}
   if(!autopilot || bias==0)return;
   Arm(bias);
}
