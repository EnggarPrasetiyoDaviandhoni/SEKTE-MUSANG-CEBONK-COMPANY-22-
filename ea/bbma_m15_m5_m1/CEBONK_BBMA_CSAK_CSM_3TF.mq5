#property strict
#property version   "1.01"
#property description "CEBONK BBMA 3TF: M15 CSAK (Dominant Break/Engulfing) -> M5 CSM -> M1 CSM"
#property description "Sideways skip; SL Top/Low BB M5; TP fixed RR."

#include <Trade/Trade.mqh>

CTrade trade;

//============================== INPUTS ==================================
input group "=== EXECUTION ==="
input double InpFixedLot              = 0.01;
input double InpRiskReward            = 2.0;
input ulong  InpMagic                 = 22151001;
input int    InpMaxSpreadPoints       = 70;
input int    InpDeviationPoints       = 20;
input int    InpMaxOpenPositions      = 0;      // 0 = unlimited; anti-duplicate remains active
input bool   InpAutoPilotOnStart      = true;

input group "=== BROKER SESSION AUTO GMT ==="
input int    InpSessionStartHour       = 7;      // 07:00 broker/server time
input int    InpSessionEndHour         = 24;     // 24 = 00:00 next day

input group "=== BBMA / BOLLINGER ==="
input int    InpBBPeriod              = 20;
input double InpBBDeviation           = 2.0;

input group "=== M15 CSAK QUALITY ==="
input int    InpM15MaxAgeBars         = 4;
input double InpDominantMinBodyRatio  = 0.60;
input double InpDominantBodyFactor    = 1.10;
input double InpEngulfMinBodyRatio    = 0.50;

input group "=== M5 + M1 CSM ==="
input int    InpM5MaxAgeBars          = 6;
input double InpCSMMinBodyRatio       = 0.55;
input double InpCSMCloseExtreme       = 0.65;
input double InpBBExpandFactor        = 1.00;

input group "=== SIDEWAYS FILTER (M5) ==="
input int    InpATRPeriod             = 14;
input int    InpMidSlopeLookback      = 3;
input double InpMinBBWidthATR         = 2.00;
input double InpMaxMidSlopeATR        = 0.25;

input group "=== SL BB M5 ==="
input int    InpSLBufferPoints        = 0;      // 0 = exactly Low/Top BB M5

//============================== STATE ===================================
int hBB_M15 = INVALID_HANDLE;
int hBB_M5  = INVALID_HANDLE;
int hBB_M1  = INVALID_HANDLE;
int hATR_M5 = INVALID_HANDLE;

bool     gAutoPilot = true;
datetime gLastM1Bar = 0;
datetime gLastExecutedM1Signal = 0;

const string BTN_AUTOPILOT = "CEBONK_AUTOPILOT";

//============================== HELPERS =================================
double NPrice(const double price)
{
   return NormalizeDouble(price, (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS));
}

bool GetBar(const ENUM_TIMEFRAMES tf, const int shift, MqlRates &bar)
{
   MqlRates one[1];
   if(CopyRates(_Symbol, tf, shift, 1, one) != 1)
      return false;
   bar = one[0];
   return true;
}

bool GetBB(const int handle, const int shift, double &mid, double &upper, double &lower)
{
   double b[1];

   if(CopyBuffer(handle, 0, shift, 1, b) != 1)
      return false;
   mid = b[0];

   if(CopyBuffer(handle, 1, shift, 1, b) != 1)
      return false;
   upper = b[0];

   if(CopyBuffer(handle, 2, shift, 1, b) != 1)
      return false;
   lower = b[0];

   return (mid > 0.0 && upper > mid && lower < mid);
}

bool GetATR_M5(const int shift, double &atr)
{
   double b[1];
   if(CopyBuffer(hATR_M5, 0, shift, 1, b) != 1)
      return false;
   atr = b[0];
   return (atr > 0.0);
}

double BodyRatio(const MqlRates &bar)
{
   const double range = bar.high - bar.low;
   if(range <= 0.0)
      return 0.0;
   return MathAbs(bar.close - bar.open) / range;
}

double BodySize(const MqlRates &bar)
{
   return MathAbs(bar.close - bar.open);
}

bool BullishEngulfing(const MqlRates &cur, const MqlRates &prev)
{
   if(cur.close <= cur.open || prev.close >= prev.open)
      return false;
   if(BodyRatio(cur) < InpEngulfMinBodyRatio)
      return false;

   return (cur.open <= prev.close &&
           cur.close >= prev.open &&
           BodySize(cur) >= BodySize(prev));
}

bool BearishEngulfing(const MqlRates &cur, const MqlRates &prev)
{
   if(cur.close >= cur.open || prev.close <= prev.open)
      return false;
   if(BodyRatio(cur) < InpEngulfMinBodyRatio)
      return false;

   return (cur.open >= prev.close &&
           cur.close <= prev.open &&
           BodySize(cur) >= BodySize(prev));
}

bool BullishDominantBreak(const MqlRates &cur, const MqlRates &prev)
{
   if(cur.close <= cur.open)
      return false;
   if(BodyRatio(cur) < InpDominantMinBodyRatio)
      return false;

   return (cur.close > prev.high &&
           BodySize(cur) >= BodySize(prev) * InpDominantBodyFactor);
}

bool BearishDominantBreak(const MqlRates &cur, const MqlRates &prev)
{
   if(cur.close >= cur.open)
      return false;
   if(BodyRatio(cur) < InpDominantMinBodyRatio)
      return false;

   return (cur.close < prev.low &&
           BodySize(cur) >= BodySize(prev) * InpDominantBodyFactor);
}

// M15 CSAK is valid only when the candle is on the correct side of MidBB
// AND it is either a Dominant Break or an Engulfing candle.
int M15CSAKDirection(const int shift)
{
   MqlRates cur, prev;
   double mid, upper, lower;

   if(!GetBar(PERIOD_M15, shift, cur) ||
      !GetBar(PERIOD_M15, shift + 1, prev) ||
      !GetBB(hBB_M15, shift, mid, upper, lower))
      return 0;

   const bool buyPattern  = BullishDominantBreak(cur, prev) || BullishEngulfing(cur, prev);
   const bool sellPattern = BearishDominantBreak(cur, prev) || BearishEngulfing(cur, prev);

   if(buyPattern && cur.close > mid)
      return 1;

   if(sellPattern && cur.close < mid)
      return -1;

   return 0;
}

// CSM = a momentum candle crossing MidBB, closing toward the candle extreme,
// while BB is not contracting.
int CSMDirection(const ENUM_TIMEFRAMES tf, const int bbHandle, const int shift)
{
   MqlRates cur, prev;
   double mid, upper, lower;
   double midPrev, upperPrev, lowerPrev;

   if(!GetBar(tf, shift, cur) ||
      !GetBar(tf, shift + 1, prev) ||
      !GetBB(bbHandle, shift, mid, upper, lower) ||
      !GetBB(bbHandle, shift + 1, midPrev, upperPrev, lowerPrev))
      return 0;

   const double range = cur.high - cur.low;
   if(range <= 0.0 || BodyRatio(cur) < InpCSMMinBodyRatio)
      return 0;

   const double width     = upper - lower;
   const double widthPrev = upperPrev - lowerPrev;
   if(widthPrev <= 0.0 || width < widthPrev * InpBBExpandFactor)
      return 0;

   const bool crossUp = ((prev.close <= midPrev) || (cur.open <= mid)) && cur.close > mid;
   const bool crossDn = ((prev.close >= midPrev) || (cur.open >= mid)) && cur.close < mid;

   const double closePos = (cur.close - cur.low) / range;

   if(cur.close > cur.open && crossUp && closePos >= InpCSMCloseExtreme)
      return 1;

   if(cur.close < cur.open && crossDn && closePos <= (1.0 - InpCSMCloseExtreme))
      return -1;

   return 0;
}

bool FindLatestM15Signal(int &dir, datetime &signalTime)
{
   for(int shift = 1; shift <= InpM15MaxAgeBars; ++shift)
   {
      const int d = M15CSAKDirection(shift);
      if(d == 0)
         continue;

      MqlRates bar;
      if(!GetBar(PERIOD_M15, shift, bar))
         continue;

      dir = d;
      signalTime = bar.time + PeriodSeconds(PERIOD_M15); // confirmed only after M15 close
      return true;
   }

   dir = 0;
   signalTime = 0;
   return false;
}

bool FindLatestM5CSM(int &dir, datetime &signalTime)
{
   for(int shift = 1; shift <= InpM5MaxAgeBars; ++shift)
   {
      const int d = CSMDirection(PERIOD_M5, hBB_M5, shift);
      if(d == 0)
         continue;

      MqlRates bar;
      if(!GetBar(PERIOD_M5, shift, bar))
         continue;

      dir = d;
      signalTime = bar.time + PeriodSeconds(PERIOD_M5); // confirmed only after M5 close
      return true;
   }

   dir = 0;
   signalTime = 0;
   return false;
}

bool IsM5Sideways()
{
   double midNow, upperNow, lowerNow;
   double midPast, upperPast, lowerPast;
   double atr;

   if(!GetBB(hBB_M5, 1, midNow, upperNow, lowerNow) ||
      !GetBB(hBB_M5, 1 + InpMidSlopeLookback, midPast, upperPast, lowerPast) ||
      !GetATR_M5(1, atr))
      return true; // fail-safe: no valid market data = no trade

   const double width = upperNow - lowerNow;
   const bool narrow  = (width <= atr * InpMinBBWidthATR);
   const bool flat    = (MathAbs(midNow - midPast) <= atr * InpMaxMidSlopeATR);

   return (narrow && flat);
}

int CountOpenPositionsByMagic()
{
   int count = 0;

   for(int i = PositionsTotal() - 1; i >= 0; --i)
   {
      const ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;

      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;

      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;

      ++count;
   }

   return count;
}

double NormalizeVolume(const double requested)
{
   const double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   const double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   const double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);

   if(step <= 0.0)
      return requested;

   double lot = MathMax(minLot, MathMin(maxLot, requested));
   lot = MathFloor(lot / step + 1e-9) * step;

   int volDigits = 2;
   if(step >= 1.0)      volDigits = 0;
   else if(step >= 0.1) volDigits = 1;
   else if(step >= 0.01)volDigits = 2;
   else if(step >= 0.001)volDigits = 3;

   return NormalizeDouble(lot, volDigits);
}

bool SpreadAllowed()
{
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick))
      return false;

   const double spreadPts = (tick.ask - tick.bid) / _Point;
   return (spreadPts <= InpMaxSpreadPoints);
}

double BrokerGMTOffsetHours()
{
   const datetime server = TimeTradeServer();
   const datetime gmt    = TimeGMT();

   if(server <= 0 || gmt <= 0)
      return 0.0;

   return (double)(server - gmt) / 3600.0;
}

bool IsBrokerSessionOpen()
{
   datetime serverNow = TimeTradeServer();
   if(serverNow <= 0)
      serverNow = TimeCurrent();

   MqlDateTime dt;
   TimeToStruct(serverNow, dt);

   const int nowMin   = dt.hour * 60 + dt.min;
   const int startMin = InpSessionStartHour * 60;
   const int endMin   = InpSessionEndHour * 60;

   // Default 07:00 <= server time < 24:00.
   if(endMin > startMin)
      return (nowMin >= startMin && nowMin < endMin);

   // Supports a session crossing midnight if inputs are changed later.
   if(endMin < startMin)
      return (nowMin >= startMin || nowMin < endMin);

   // Same start/end means 24h session.
   return true;
}


bool StopsAreValid(const int dir, const double entry, const double sl, const double tp)
{
   const double minStop = (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;

   if(dir > 0)
   {
      if(!(sl < entry && tp > entry))
         return false;
      if((entry - sl) < minStop || (tp - entry) < minStop)
         return false;
   }
   else
   {
      if(!(sl > entry && tp < entry))
         return false;
      if((sl - entry) < minStop || (entry - tp) < minStop)
         return false;
   }

   return true;
}

bool ExecuteTrade(const int dir, const datetime m1SignalTime)
{
   if(InpMaxOpenPositions > 0 && CountOpenPositionsByMagic() >= InpMaxOpenPositions)
   {
      Print("SKIP: max open positions reached.");
      return false;
   }

   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick))
      return false;

   double midM5, upperM5, lowerM5;
   if(!GetBB(hBB_M5, 1, midM5, upperM5, lowerM5))
      return false;

   const double entry = (dir > 0 ? tick.ask : tick.bid);
   double sl = (dir > 0 ? lowerM5 - InpSLBufferPoints * _Point
                        : upperM5 + InpSLBufferPoints * _Point);

   const double risk = MathAbs(entry - sl);
   if(risk <= 0.0)
      return false;

   const double tp = (dir > 0 ? entry + risk * InpRiskReward
                              : entry - risk * InpRiskReward);

   const double nSL = NPrice(sl);
   const double nTP = NPrice(tp);

   if(!StopsAreValid(dir, entry, nSL, nTP))
   {
      Print("SKIP: BB M5 SL/TP violates broker stop distance. Rule is not widened automatically.");
      return false;
   }

   const double lot = NormalizeVolume(InpFixedLot);
   if(lot <= 0.0)
      return false;

   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpDeviationPoints);

   const string side = (dir > 0 ? "BUY" : "SELL");
   const string comment = "CEBONK BBMA CSAK-CSM " + side;

   bool ok = false;
   if(dir > 0)
      ok = trade.Buy(lot, _Symbol, 0.0, nSL, nTP, comment);
   else
      ok = trade.Sell(lot, _Symbol, 0.0, nSL, nTP, comment);

   if(!ok)
   {
      PrintFormat("ORDER FAIL %s | retcode=%u | %s",
                  side,
                  trade.ResultRetcode(),
                  trade.ResultRetcodeDescription());
      return false;
   }

   gLastExecutedM1Signal = m1SignalTime;

   PrintFormat("ENTRY %s | lot=%.2f | SL=%.*f | TP=%.*f | RR=1:%.2f",
               side,
               lot,
               (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS), nSL,
               (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS), nTP,
               InpRiskReward);

   return true;
}

//============================== UI ======================================
void RefreshButton()
{
   if(ObjectFind(0, BTN_AUTOPILOT) < 0)
      return;

   ObjectSetString(0, BTN_AUTOPILOT, OBJPROP_TEXT,
                   gAutoPilot ? "AUTOPILOT ON" : "AUTOPILOT OFF");
   ChartRedraw();
}

void CreateButton()
{
   ObjectDelete(0, BTN_AUTOPILOT);

   if(!ObjectCreate(0, BTN_AUTOPILOT, OBJ_BUTTON, 0, 0, 0))
      return;

   ObjectSetInteger(0, BTN_AUTOPILOT, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, BTN_AUTOPILOT, OBJPROP_XDISTANCE, 12);
   ObjectSetInteger(0, BTN_AUTOPILOT, OBJPROP_YDISTANCE, 20);
   ObjectSetInteger(0, BTN_AUTOPILOT, OBJPROP_XSIZE, 120);
   ObjectSetInteger(0, BTN_AUTOPILOT, OBJPROP_YSIZE, 28);
   ObjectSetInteger(0, BTN_AUTOPILOT, OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(0, BTN_AUTOPILOT, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, BTN_AUTOPILOT, OBJPROP_HIDDEN, false);

   RefreshButton();
}

//============================== ENGINE ==================================
void EvaluateNewM1Bar()
{
   if(!gAutoPilot)
      return;

   if(!IsBrokerSessionOpen())
   {
      Print("SKIP: outside broker session 07:00-00:00.");
      return;
   }

   if(!SpreadAllowed())
   {
      Print("SKIP: spread > MaxSpreadPoints.");
      return;
   }

   if(IsM5Sideways())
   {
      Print("SKIP: M5 sideways (BB narrow + MidBB flat).");
      return;
   }

   int dirM15 = 0;
   datetime tM15 = 0;
   if(!FindLatestM15Signal(dirM15, tM15))
      return;

   int dirM5 = 0;
   datetime tM5 = 0;
   if(!FindLatestM5CSM(dirM5, tM5))
      return;

   // Sequence must be M15 -> M5 -> M1 and all directions must agree.
   if(dirM5 != dirM15 || tM5 < tM15)
      return;

   MqlRates m1;
   if(!GetBar(PERIOD_M1, 1, m1))
      return;

   const int dirM1 = CSMDirection(PERIOD_M1, hBB_M1, 1);
   const datetime tM1Confirm = m1.time + PeriodSeconds(PERIOD_M1);
   if(dirM1 == 0 || dirM1 != dirM15 || tM1Confirm < tM5)
      return;

   if(gLastExecutedM1Signal == m1.time)
      return;

   ExecuteTrade(dirM1, m1.time);
}

//============================== EVENTS ==================================
int OnInit()
{
   if(InpRiskReward <= 0.0 ||
      InpBBPeriod < 2 ||
      InpATRPeriod < 2 ||
      InpMidSlopeLookback < 1 ||
      InpM15MaxAgeBars < 1 ||
      InpM5MaxAgeBars < 1 ||
      InpSessionStartHour < 0 || InpSessionStartHour > 23 ||
      InpSessionEndHour < 0   || InpSessionEndHour > 24)
      return INIT_PARAMETERS_INCORRECT;

   hBB_M15 = iBands(_Symbol, PERIOD_M15, InpBBPeriod, 0, InpBBDeviation, PRICE_CLOSE);
   hBB_M5  = iBands(_Symbol, PERIOD_M5,  InpBBPeriod, 0, InpBBDeviation, PRICE_CLOSE);
   hBB_M1  = iBands(_Symbol, PERIOD_M1,  InpBBPeriod, 0, InpBBDeviation, PRICE_CLOSE);
   hATR_M5 = iATR(_Symbol, PERIOD_M5, InpATRPeriod);

   if(hBB_M15 == INVALID_HANDLE ||
      hBB_M5  == INVALID_HANDLE ||
      hBB_M1  == INVALID_HANDLE ||
      hATR_M5 == INVALID_HANDLE)
   {
      Print("INIT FAIL: indicator handle invalid.");
      return INIT_FAILED;
   }

   gAutoPilot = InpAutoPilotOnStart;
   gLastM1Bar = iTime(_Symbol, PERIOD_M1, 0);

   CreateButton();

   PrintFormat("CEBONK BBMA CSAK-CSM 3TF READY | M15->M5->M1 | session %02d:00-%s broker time | broker GMT offset auto: GMT%+.1f",
               InpSessionStartHour,
               (InpSessionEndHour == 24 ? "00:00" : IntegerToString(InpSessionEndHour) + ":00"),
               BrokerGMTOffsetHours());
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(hBB_M15 != INVALID_HANDLE) IndicatorRelease(hBB_M15);
   if(hBB_M5  != INVALID_HANDLE) IndicatorRelease(hBB_M5);
   if(hBB_M1  != INVALID_HANDLE) IndicatorRelease(hBB_M1);
   if(hATR_M5 != INVALID_HANDLE) IndicatorRelease(hATR_M5);

   ObjectDelete(0, BTN_AUTOPILOT);
}

void OnTick()
{
   const datetime currentM1Bar = iTime(_Symbol, PERIOD_M1, 0);
   if(currentM1Bar <= 0 || currentM1Bar == gLastM1Bar)
      return;

   gLastM1Bar = currentM1Bar;
   EvaluateNewM1Bar();
}

void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == BTN_AUTOPILOT)
   {
      gAutoPilot = !gAutoPilot;
      RefreshButton();
      Print(gAutoPilot ? "AUTOPILOT ON" : "AUTOPILOT OFF");
   }
}
