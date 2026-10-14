#property strict
#property version   "3.03"
#property description "CB22: H1/H4 liquidity, M5 sweep and close reclaim, weekly astrology, ATR14 x3, RR 1:4."
#property description "MT5 hedging only. Set required inputs; uses the existing weekly web CSV."
#property tester_file "CEBONK_ASTRO_WEEKLY.csv"

#include <Trade/Trade.mqh>
// Inlined StrategyCore.mqh
#ifndef CB22_STRATEGY_CORE_MQH
#define CB22_STRATEGY_CORE_MQH

// Shared by the MT5 EA and the native regression tests. No terminal APIs here.
#ifdef __cplusplus
#include <cmath>
#define CB22_ROUND(x) std::round(x)
#else
#define CB22_ROUND(x) MathRound(x)
#endif

double CB22_Max(const double a,const double b) { return a>b?a:b; }
double CB22_Abs(const double a) { return a<0?-a:a; }
double CB22_Snap(const double price,const double tick)
{
   return tick>0?CB22_ROUND(price/tick)*tick:0;
}
// Protective stop must never snap INSIDE the sweep extreme or the 3x ATR envelope.
// Snap outward by tick; this is exchange tick alignment, not a discretionary buffer.
double CB22_Outward(const double price,const double tick,const int toward)
{
   if(tick<=0 || (toward!=1 && toward!=-1)) return 0;
   double units=price/tick;
   // toward +1 = higher price; toward -1 = lower price
#ifdef __cplusplus
   return (toward==1?std::ceil(units-1e-10):std::floor(units+1e-10))*tick;
#else
   return (toward==1?MathCeil(units-1e-10):MathFloor(units+1e-10))*tick;
#endif
}
long CB22_ServerFromUTC(const long epoch,const int broker_offset_minutes)
{
   return epoch+(long)broker_offset_minutes*60;
}
long CB22_ServerFromWebWall(const long wall,const int web_offset_minutes,const int broker_offset_minutes)
{
   return wall+(long)(broker_offset_minutes-web_offset_minutes)*60;
}

bool CB22_Risk(const int direction,const double entry,const double extreme,
               const double atr,const double tick,double &sl,double &tp,double &risk)
{
   if((direction!=1 && direction!=-1) || entry<=0 || extreme<=0 || atr<=0 || tick<=0)
      return false;
   double structure=direction*(entry-extreme);
   if(structure<=0) return false;
   double distance=CB22_Max(structure,3.0*atr);
   sl=CB22_Outward(entry-direction*distance,tick,-direction);
   risk=direction*(entry-sl);
   if(sl<=0 || risk<=0) return false;
   // RR uses the final, tick-aligned stop, not an earlier layer's price.
   tp=CB22_Outward(entry+direction*4.0*risk,tick,direction);
   return tp>0 && direction*(tp-entry)>0;
}

bool CB22_StopsValid(const int direction,const double sl,const double tp,
                     const double bid,const double ask,const double min_distance)
{
   if(sl<=0 || tp<=0 || bid<=0 || ask<bid || min_distance<0) return false;
   double market=direction==1?bid:ask;
   if(direction==1) return sl<market && tp>market &&
      market-sl+1e-10>=min_distance && tp-market+1e-10>=min_distance;
   if(direction==-1) return sl>market && tp<market &&
      sl-market+1e-10>=min_distance && market-tp+1e-10>=min_distance;
   return false;
}

bool CB22_InWindow(const long now,const long valid_from,const long valid_until,
                   const long core_from,const long core_until)
{
   return valid_from<valid_until && core_from<core_until &&
      core_from>=valid_from && core_until<=valid_until &&
      now>=valid_from && now<valid_until && now>=core_from && now<core_until;
}

bool CB22_Breach(const int direction,const double low,const double high,
                 const double previous_close,const double level)
{
   if(direction==1) return previous_close>=level && low<level;
   if(direction==-1) return previous_close<=level && high>level;
   return false;
}

bool CB22_Reclaim(const int direction,const double close,const double level)
{
   return direction==1?close>level:(direction==-1?close<level:false);
}

bool CB22_Invalidated(const int direction,const double close,const double extreme)
{
   return direction==1?close<extreme:(direction==-1?close>extreme:true);
}

bool CB22_CloseBreak(const int direction,const double previous_close,
                     const double close,const double point_b)
{
   return direction==1?(previous_close<=point_b && close>point_b):
      (direction==-1?(previous_close>=point_b && close<point_b):false);
}

bool CB22_CanLayer(const int count,const int maximum,const double existing_risk,
                   const double new_risk,const double risk_limit)
{
   return maximum>0 && count>=0 && count<maximum && existing_risk>=0 &&
      new_risk>0 && risk_limit>0 && existing_risk+new_risk<=risk_limit+1e-8;
}

struct CB22Bar
{
   long time;
   double open,high,low,close;
};
#ifdef __cplusplus
#define CB22_BARS const CB22Bar bars[]
#else
#define CB22_BARS const CB22Bar &bars[]
#endif

bool CB22_InitialBreak(const int direction,const double open,const double close,
                      const double previous_close,const double anchor_open,const double anchor_close)
{
   if(direction==1) return anchor_close<anchor_open && close>open &&
      previous_close<=anchor_open && close>anchor_open;
   if(direction==-1) return anchor_close>anchor_open && close<open &&
      previous_close>=anchor_open && close<anchor_open;
   return false;
}
bool CB22_BeyondZone(const int direction,const double b,const double low,const double high)
{
   return low>0 && high>low && (direction==1?b>high:(direction==-1?b<low:false));
}
bool CB22_Pivot(CB22_BARS,const int count,const int index,const int direction,
                const int left,const int right)
{
   if(left<1 || right<1 || index-left<0 || index+right>=count) return false;
   double p=direction==1?bars[index].low:bars[index].high;
   for(int j=index-left;j<=index+right;j++)
   {
      if(j==index) continue;
      double v=direction==1?bars[j].low:bars[j].high;
      if(direction==1?p>=v:p<=v) return false;
   }
   return true;
}
bool CB22_FindB(CB22_BARS,const int count,const int direction,const int left,const int right,
                const long sweep_first,const long extreme_bar,const double extreme,
                double &point_b,long &first_extreme_bar,long &pullback_bar)
{
   // Most recent confirmed previous Low/High before this sweep begins.
   // The actual sweep extreme supplies New Low/New High; no future C pivot needed.
   for(int i=count-right-1;i>=left;i--)
   {
      if(bars[i].time>=sweep_first || bars[i+right].time+300>sweep_first ||
         !CB22_Pivot(bars,count,i,direction,left,right)) continue;
      double old=direction==1?bars[i].low:bars[i].high;
      if(direction==1?extreme>=old:extreme<=old) return false;
      bool found=false;
      for(int j=i+1;j<count-right;j++)
      {
         if(bars[j].time>=extreme_bar) break;
         if(!CB22_Pivot(bars,count,j,-direction,left,right)) continue;
         double b=direction==1?bars[j].high:bars[j].low;
         if(!found || (direction==1?b>point_b:b<point_b))
            { point_b=b; pullback_bar=bars[j].time; found=true; }
      }
      first_extreme_bar=bars[i].time;
      return found;
   }
   return false;
}
bool CB22_FindIB(CB22_BARS,const int count,const int direction,const long earliest_anchor,
                 double &zone_low,double &zone_high,long &anchor_bar)
{
   if(count<2) return false;
   int last=count-1;
   for(int i=last-1;i>=0;i--)
   {
      if(bars[i].time<earliest_anchor) break;
      bool opposite=direction==1?bars[i].close<bars[i].open:bars[i].close>bars[i].open;
      if(!opposite) continue;
      // First opposite candle is the relevant unbroken body. One-to-one when
      // adjacent; a multiple-candle body break when intermediate closes stayed inside.
      for(int j=i+1;j<last;j++)
         if(direction==1?bars[j].close>bars[i].open:bars[j].close<bars[i].open) return false;
      if(!CB22_InitialBreak(direction,bars[last].open,bars[last].close,bars[last-1].close,
                            bars[i].open,bars[i].close)) return false;
      zone_low=bars[i].open<bars[i].close?bars[i].open:bars[i].close;
      zone_high=bars[i].open>bars[i].close?bars[i].open:bars[i].close;
      anchor_bar=bars[i].time; return true;
   }
   return false;
}

#endif

// Inlined ExecutionCore.mqh
#ifndef CB22_EXECUTION_CORE_MQH
#define CB22_EXECUTION_CORE_MQH

#ifdef __cplusplus
#include <cmath>
#define CB22_VOLUME_ROUND(x) std::round(x)
#else
#define CB22_VOLUME_ROUND(x) MathRound(x)
#endif

#define CB22_FILL_NONE 0
#define CB22_FILL_FOK 1
#define CB22_FILL_IOC 2

bool CB22_AnyScannerReady(const bool h1_enabled,const bool h1_ready,
                         const bool h4_enabled,const bool h4_ready)
{
   return (h1_enabled && h1_ready) || (h4_enabled && h4_ready);
}
bool CB22_HistoryUsable(const int count,const int left,const int right)
{
   return left>0 && right>0 && count>=left+right+1;
}
int CB22_ChooseFill(const bool request_or_instant,const bool fok,const bool ioc)
{
   if(request_or_instant || fok) return CB22_FILL_FOK;
   if(ioc) return CB22_FILL_IOC;
   return CB22_FILL_NONE;
}
bool CB22_TerminalOrder(const bool still_active,const bool filled,const bool canceled,const bool partial)
{
   // An IOC PARTIAL in history is terminal once the order has left the live book.
   return !still_active && (filled || canceled || partial);
}
bool CB22_ValidFillVolume(const int filling,const double requested,const double filled,const double step)
{
   if(requested<=0 || filled<=0 || filled>requested+1e-8 || step<=0) return false;
   double units=filled/step-CB22_VOLUME_ROUND(filled/step);
   if(units>1e-6 || units<-1e-6) return false;
   double difference=filled-requested;
   if(filling==CB22_FILL_FOK) return difference<=1e-8 && difference>=-1e-8;
   return filling==CB22_FILL_IOC;
}
bool CB22_FillSynchronized(const bool order_terminal,const double position_volume,
                          const double filled_deals,const double exit_deals,const double confirmed_volume)
{
   if(!order_terminal || position_volume<=0 || filled_deals<=0 || exit_deals<0 || confirmed_volume<=0) return false;
   double fill_delta=filled_deals-confirmed_volume;
   if(fill_delta>1e-8 || fill_delta<-1e-8) return false;
   double remaining=filled_deals-exit_deals;
   double delta=remaining-position_volume;
   return remaining>0 && delta<=1e-8 && delta>=-1e-8;
}
bool CB22_ConfirmedClosed(const double filled_deals,const double exit_deals)
{
   return filled_deals>0 && exit_deals+1e-8>=filled_deals;
}
bool CB22_FillPriceConsistent(const double position_price,const double deal_weighted_price,const double tick)
{
   if(position_price<=0 || deal_weighted_price<=0 || tick<=0) return false;
   double delta=position_price-deal_weighted_price;
   // Broker position prices may round the raw deal VWAP to symbol precision.
   double tolerance=tick*0.5+1e-10;
   return delta<=tolerance && delta>=-tolerance;
}
bool CB22_CanPush(const long now_ms,const long last_attempt_ms,const int rolling_minute_attempts)
{
   return rolling_minute_attempts<10 && (last_attempt_ms==0 || now_ms-last_attempt_ms>=1000);
}
bool CB22_UrlSafe(const int code)
{
   return (code>=65 && code<=90) || (code>=97 && code<=122) ||
      (code>=48 && code<=57) || code==45 || code==95 || code==46 || code==126;
}

#endif

// Inlined LotSizingCore.mqh
#ifndef CB22_LOT_SIZING_CORE_MQH
#define CB22_LOT_SIZING_CORE_MQH
#ifdef __cplusplus
#include <cmath>
#define CB22_DA_FLOOR(x) std::floor(x)
#else
#define CB22_DA_FLOOR(x) MathFloor(x)
#endif
bool CB22_DAParams(const double start,const double step,const double cap)
{
   return start>0 && step>0 && cap>=start && cap<=1000 && step<=cap;
}
int CB22_DAMaxLevel(const double start,const double step,const double cap)
{
   if(!CB22_DAParams(start,step,cap)) return 0;
   return (int)CB22_DA_FLOOR((cap-start)/step+1e-8);
}
double CB22_DALot(const int level,const double start,const double step,const double cap)
{
   if(!CB22_DAParams(start,step,cap)) return 0;
   int x=level<0?0:level;
   double lot=start+(double)x*step;
   return lot>cap?cap:lot;
}
int CB22_DANextLevel(const int current,const int maximum,const double net,const double epsilon)
{
   int value=current<0?0:(current>maximum?maximum:current);
   if(net<-epsilon && value<maximum) return value+1;
   if(net>epsilon && value>0) return value-1;
   return value;
}
#endif


input group "Execution (initial values for DEMO testing)"
input bool   InpEnableTrading=false;
input bool   InpDemoOnly=true;
input double InpFixedLot=0.01;
input int    InpMaxLayers=3;
input double InpMaxTotalRiskMoney=25.0; // Account currency; gross open-to-stop risk.
input ulong  InpMagic=22142026;
input ulong  InpMaxDeviationPoints=30;

input group "Weekly scanning / M5 reclaim execution"
input bool InpScanOutsideAstroWindow=true;
input int InpSetupMaxAgeM5Bars=72;
input int InpReclaimExecutionGraceSeconds=20;
input bool InpWeeklyDiagnostics=true;

input group "Optional basket lot progression (default FIXED)"
enum CB22_LOT_MODE { LOT_FIXED=0, LOT_MODIFIED_DALEMBERT=1 };
input CB22_LOT_MODE InpLotMode=LOT_FIXED;
input double InpDAStartLot=0.01;
input double InpDAStepLot=0.01;
input double InpDAMaxLot=0.03;

input group "Closed-candle H1/H4 liquidity scanner"
input bool InpScanH1=true;
input bool InpScanH4=true;
input int  InpSwingLeft=2;
input int  InpSwingRight=2;
input int  InpLookbackBars=200;
input double InpEqualTolerancePoints=5.0;

input group "Existing Astrology weekly web feed"
input bool InpAutoAstrologyWeb=true;
input string InpAstroWebURL="https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/liquidity_sweep/weekly_atr/data/weekly.csv";
input int InpWebPollSeconds=300;
input int InpHTTPTimeoutMs=3000;
input int InpBrokerUTCOffsetMinutes=180; // DEMO starting assumption UTC+3; verify actual broker/DST.
input string InpAstrologyCsv="CEBONK_ASTRO_WEEKLY.csv";
input bool InpCustomAstrologyCsv=false; // Optional semicolon adapter; auto web must be false.
input bool InpFeedInCommonFiles=false;

input group "Notifications (delivery never changes entry conditions)"
input bool InpMT5Push=true;
input bool InpTelegram=false;
input string InpTelegramToken="";
input string InpTelegramChatID="";
input int InpNotificationTimeoutMs=2000;

#define CB22_ATR_PERIOD 14
#define CB22_MAX_SPREAD 70.0
#define CB22_MAX_SETUPS 256
#define CB22_PREFIX "CB22:"

struct AstroSignal
{
   string id;
   int direction;
   datetime valid_from,valid_until,core_from,core_until,core_at;
};
struct LiquidityLevel
{
   double price;
   datetime confirmed_at;
   ENUM_TIMEFRAMES timeframe;
   bool equal_level;
};
struct SweepEvent
{
   bool active;
   int direction;
   string signal_id;
   datetime first_bar,extreme_bar;
   double extreme;
};
struct Setup
{
   string id,signal_id;
   int direction;
   datetime first_bar,reclaim_bar,extreme_bar;
   double extreme;
};
struct EntryPlan
{
   string key;
   int direction;
   double extreme,atr,volume,confirmed_volume;
   datetime created;
   ulong order;
   int filling;
   bool emergency,finalized;
};
struct PendingReclaim
{
   bool active;
   Setup setup;
   datetime detected,bar_open,reclaim_closed;
};
struct WeeklyCounters
{
   int sweeps,reclaims,reclaim_in_window,reclaim_outside,expired,invalidated;
   int blocked_auto,blocked_spread,blocked_risk,blocked_gate,orders,filled;
};
struct Notice
{
   string id,message;
   bool push_done,telegram_done;
   int push_attempts,telegram_attempts;
   long push_retry_ms,telegram_retry_ms;
};

CTrade gTrade;
AstroSignal gSignal;
SweepEvent gSweep;
LiquidityLevel gLevels[],gFrozenLevels[];
bool gTouched[];
EntryPlan gPlans[];
Notice gNotices[];
int gATR=INVALID_HANDLE;
int gInstanceLock=INVALID_HANDLE;
datetime gCurrentBar=0,gLastRefresh=0;
datetime gLastWebRead=0;
bool gSignalActive=false,gEntryWindowOpen=false,gConfigReady=false,gRecoveryBlocked=false,gUnreadableState=false;
PendingReclaim gPending;
WeeklyCounters gWeeklyStats;
string gWeeklyStatsId="";
int gDALevel=0;
bool gDAActive=false,gDAReady=false;
datetime gDABasketStart=0,gDAHistoryFrom=0;
double gDABasketLot=0;
string gConfigReason="",gStatus="Starting",gStatePrefix="";
string gWebPayload="",gWebError="Not loaded";
string gTesterLocalWeek="",gTesterLocalPayload="";
bool gWebOK=false;
bool gAuto=false,gH1Ready=false,gH4Ready=false;
int gH1Bars=0,gH4Bars=0,gFilling=CB22_FILL_NONE;
string gButton="",gSessionId="";
int gAutoChanges=0,gPushCursor=0;
long gPushTimes[10];
long gLastPushAttempt=0;
int gTesterPeakLayers=0;
double gTesterPeakRisk=0;

string Trim(string text)
{
   StringTrimLeft(text); StringTrimRight(text); return text;
}
bool SimpleId(const string id)
{
   if(StringLen(id)<1 || StringLen(id)>32) return false;
   for(int i=0;i<StringLen(id);i++)
   {
      ushort c=StringGetCharacter(id,i);
      if(!((c>='A' && c<='Z') || (c>='a' && c<='z') ||
           (c>='0' && c<='9') || c=='_' || c=='-')) return false;
   }
   return true;
}
string HashKey(const string value)
{
   // Two 32-bit FNV streams, encoded as one 64-bit identifier.
   uint a=2166136261,b=3339675911;
   for(int i=0;i<StringLen(value);i++)
   {
      uint c=(uint)StringGetCharacter(value,i);
      a=(a^c)*16777619;
      b=(b^(c+97))*16777619;
   }
   return StringFormat("%08X%08X",a,b);
}
bool Number(string value,double &result)
{
   value=Trim(value);
   bool digit=false,dot=false;
   for(int i=0;i<StringLen(value);i++)
   {
      ushort c=StringGetCharacter(value,i);
      if(c>='0' && c<='9') { digit=true; continue; }
      if((c=='-' || c=='+') && i==0) continue;
      if(c=='.' && !dot) { dot=true; continue; }
      return false;
   }
   if(!digit) return false;
   result=StringToDouble(value);
   return MathIsValidNumber(result);
}
bool Offset(const string value,int &minutes)
{
   double n;
   if(!Number(value,n) || n!=MathRound(n) || n<-840 || n>840) return false;
   minutes=(int)n; return true;
}
bool DateValue(string text,datetime &value)
{
   text=Trim(text);
   if(StringLen(text)!=19) return false;
   value=StringToTime(text);
   return value>0 && TimeToString(value,TIME_DATE|TIME_SECONDS)==text;
}
bool ReadRow(const int handle,string &columns[])
{
   ArrayResize(columns,0);
   if(FileIsEnding(handle)) return false;
   do
   {
      int n=ArraySize(columns);
      if(n>=32) return false;
      ArrayResize(columns,n+1);
      columns[n]=Trim(FileReadString(handle));
   }
   while(!FileIsLineEnding(handle) && !FileIsEnding(handle));
   return true;
}
int FeedFlags()
{
   return FILE_READ|FILE_CSV|FILE_ANSI|FILE_SHARE_READ|
      (InpFeedInCommonFiles?FILE_COMMON:0);
}
void Report(const string message)
{
   if(message!=gStatus) Print("CB22 ",message);
   gStatus=message;
}
void ClearSetups(const string reason)
{
   bool existed=gSweep.active || gPending.active;
   if(existed) Print("CB22 cancel: ",reason);
   gSweep.active=false;
   gPending.active=false;
   ArrayResize(gFrozenLevels,0); ArrayResize(gTouched,0);
}
void RemovePlan(const int index)
{
   int n=ArraySize(gPlans);
   for(int i=index;i<n-1;i++) gPlans[i]=gPlans[i+1];
   ArrayResize(gPlans,n-1);
}

string NoticePath(const string id) { return gStatePrefix+"notice_"+HashKey(id)+".done"; }
bool NoticeHandled(const string id)
{
   int h=FileOpen(NoticePath(id),FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h==INVALID_HANDLE) return false;
   string result=Trim(FileReadString(h)); FileClose(h);
   return result=="HANDLED";
}
bool SaveNoticeHandled(const string id)
{
   int h=FileOpen(NoticePath(id),FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h==INVALID_HANDLE) return false;
   uint n=FileWriteString(h,"HANDLED\r\n"); FileFlush(h); FileClose(h); return n>0;
}
void QueueNotice(const string id,const string message)
{
   if(MQLInfoInteger(MQL_TESTER)) { Print("CB22 notice (tester) ",message); return; }
   if(!InpMT5Push && !InpTelegram) return;
   if(NoticeHandled(id)) return;
   for(int i=0;i<ArraySize(gNotices);i++) if(gNotices[i].id==id) return;
   if(ArraySize(gNotices)>=128) { Print("CB22 notification queue full; event skipped: ",id); return; }
   Notice n;
   n.id=id; n.message=message; n.push_done=!InpMT5Push;
   n.telegram_done=!InpTelegram || InpTelegramToken=="" || InpTelegramChatID=="";
   n.push_attempts=0; n.telegram_attempts=0; n.push_retry_ms=0; n.telegram_retry_ms=0;
   int count=ArraySize(gNotices); ArrayResize(gNotices,count+1); gNotices[count]=n;
}
string UrlEncode(const string text)
{
   uchar bytes[]; int count=StringToCharArray(text,bytes,0,WHOLE_ARRAY,CP_UTF8);
   string result="";
   for(int i=0;i<count-1;i++)
   {
      int code=(int)bytes[i];
      if(CB22_UrlSafe(code)) result+=CharToString((uchar)code);
      else if(code==32) result+="+";
      else result+=StringFormat("%%%02X",code);
   }
   return result;
}
bool SendTelegramNotice(const string message,int &http,int &error)
{
   http=0; error=0;
   if(StringFind(InpTelegramToken,"\r")>=0 || StringFind(InpTelegramToken,"\n")>=0)
      return false;
   string form="chat_id="+UrlEncode(InpTelegramChatID)+"&text="+UrlEncode(message);
   char request[],response[];
   int bytes=StringToCharArray(form,request,0,WHOLE_ARRAY,CP_UTF8);
   if(bytes<1) return false;
   ArrayResize(request,bytes-1); // No trailing NUL in the HTTP body.
   string headers;
   int timeout=InpNotificationTimeoutMs;
   if(timeout<500) timeout=500;
   if(timeout>10000) timeout=10000;
   ResetLastError();
   http=WebRequest("POST","https://api.telegram.org/bot"+InpTelegramToken+"/sendMessage",
      "Content-Type: application/x-www-form-urlencoded\r\n",timeout,request,response,headers);
   error=GetLastError();
   if(http!=200) return false;
   string body=CharArrayToString(response,0,WHOLE_ARRAY,CP_UTF8);
   StringReplace(body," ",""); StringReplace(body,"\r",""); StringReplace(body,"\n",""); StringReplace(body,"\t","");
   return StringFind(body,"\"ok\":true")>=0;
}
void FlushNotices()
{
   if(MQLInfoInteger(MQL_TESTER)) return;
   bool push_used=false,telegram_used=false;
   long now=(long)GetTickCount64();
   for(int i=0;i<ArraySize(gNotices);)
   {
      Notice n=gNotices[i];
      if(!n.push_done && !push_used && now>=n.push_retry_ms)
      {
         int recent=0;
         for(int j=0;j<10;j++) if(gPushTimes[j]>0 && now-gPushTimes[j]<60000) recent++;
         if(CB22_CanPush(now,gLastPushAttempt,recent))
         {
            ResetLastError();
            bool delivered=SendNotification(StringSubstr(n.message,0,255));
            int error=GetLastError();
            n.push_attempts++; push_used=true; gLastPushAttempt=now;
            gPushTimes[gPushCursor]=now; gPushCursor=(gPushCursor+1)%10;
            n.push_done=delivered || n.push_attempts>=3; n.push_retry_ms=now+15000;
            if(!delivered) Print("CB22 MT5 Push failed; error=",error," attempt=",n.push_attempts);
         }
      }
      if(!n.telegram_done && !telegram_used && now>=n.telegram_retry_ms)
      {
         int http,error;
         bool delivered=SendTelegramNotice(n.message,http,error);
         n.telegram_attempts++; telegram_used=true;
         n.telegram_done=delivered || n.telegram_attempts>=3; n.telegram_retry_ms=now+15000;
         // Never log the bot token, request URL or Telegram response body.
         if(!delivered) Print("CB22 Telegram failed; HTTP=",http," error=",error," attempt=",n.telegram_attempts);
      }
      gNotices[i]=n;
      if(n.push_done && n.telegram_done && SaveNoticeHandled(n.id))
      {
         int count=ArraySize(gNotices);
         for(int j=i;j<count-1;j++) gNotices[j]=gNotices[j+1];
         ArrayResize(gNotices,count-1); continue;
      }
      i++;
   }
}
string AutopilotText()
{
   return (gAuto?"ON":"OFF")+(gAuto && !gConfigReady?" (BLOCKED: "+gConfigReason+")":"");
}
void PaintAutopilot()
{
   if(gButton=="" || ObjectFind(0,gButton)<0) return;
   ObjectSetString(0,gButton,OBJPROP_TEXT,"AUTOPILOT "+(gAuto?"ON":"OFF")+
      (gAuto && !gConfigReady?" | BLOCKED":""));
   ObjectSetInteger(0,gButton,OBJPROP_BGCOLOR,gAuto?(gConfigReady?clrDarkGreen:clrDarkOrange):clrFireBrick);
   ObjectSetInteger(0,gButton,OBJPROP_COLOR,clrWhite);
   ObjectSetInteger(0,gButton,OBJPROP_STATE,false);
   ObjectSetString(0,gButton,OBJPROP_TOOLTIP,gConfigReady?"Toggle new entries. Existing layer SL/TP remain fixed.":gConfigReason);
   ChartRedraw();
}
void CreateAutopilot()
{
   if(MQLInfoInteger(MQL_TESTER) && !MQLInfoInteger(MQL_VISUAL_MODE)) return;
   gButton="CB22_AUTOPILOT_"+StringFormat("%I64d",ChartID());
   if(ObjectFind(0,gButton)>=0) ObjectDelete(0,gButton);
   if(!ObjectCreate(0,gButton,OBJ_BUTTON,0,0,0)) { Print("CB22 cannot create Autopilot button"); gButton=""; return; }
   ObjectSetInteger(0,gButton,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,gButton,OBJPROP_XDISTANCE,12); ObjectSetInteger(0,gButton,OBJPROP_YDISTANCE,20);
   ObjectSetInteger(0,gButton,OBJPROP_XSIZE,290); ObjectSetInteger(0,gButton,OBJPROP_YSIZE,54);
   ObjectSetInteger(0,gButton,OBJPROP_FONTSIZE,16);
   ObjectSetInteger(0,gButton,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,gButton,OBJPROP_HIDDEN,true);
   PaintAutopilot();
}

int BrokerFillMode()
{
   long mode=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_EXEMODE);
   long capabilities=SymbolInfoInteger(_Symbol,SYMBOL_FILLING_MODE);
   return CB22_ChooseFill(mode==SYMBOL_TRADE_EXECUTION_REQUEST || mode==SYMBOL_TRADE_EXECUTION_INSTANT,
      (capabilities&SYMBOL_FILLING_FOK)!=0,(capabilities&SYMBOL_FILLING_IOC)!=0);
}
bool ConfigureFilling()
{
   gFilling=BrokerFillMode();
   if(gFilling==CB22_FILL_NONE) return false;
   gTrade.SetTypeFilling(gFilling==CB22_FILL_IOC?ORDER_FILLING_IOC:ORDER_FILLING_FOK);
   return true;
}

bool ValidateConfiguration(string &reason)
{
   if(AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
      { reason="MT5 hedging account required for independent layer SL/TP"; return false; }
   if(InpDemoOnly && AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL)
      { reason="Demo preset: real-account execution disabled by InpDemoOnly"; return false; }
   if(!InpScanH1 && !InpScanH4) { reason="Select H1 and/or H4"; return false; }
   if(!InpCustomAstrologyCsv && (InpBrokerUTCOffsetMinutes<-840 || InpBrokerUTCOffsetMinutes>840))
      { reason="Set actual broker UTC offset in minutes (including DST)"; return false; }
   if(InpWebPollSeconds<1 || InpHTTPTimeoutMs<500 || (InpCustomAstrologyCsv && InpAutoAstrologyWeb))
      { reason="Invalid web poll/timeout or conflicting custom CSV mode"; return false; }
   if(InpSwingLeft<1 || InpSwingRight<1 || InpSwingLeft>10000 || InpSwingRight>10000 ||
      InpLookbackBars<InpSwingLeft+InpSwingRight+3 || InpLookbackBars>10000 ||
      InpEqualTolerancePoints<0)
      { reason="Set swing left/right, lookback (max 10000) and equal tolerance"; return false; }
   if(InpSetupMaxAgeM5Bars<1 || InpSetupMaxAgeM5Bars>10000 ||
      InpReclaimExecutionGraceSeconds<0 || InpReclaimExecutionGraceSeconds>299)
      { reason="Invalid weekly sweep expiry / reclaim grace"; return false; }
   if(InpLotMode!=LOT_FIXED && InpLotMode!=LOT_MODIFIED_DALEMBERT)
      { reason="Invalid lot mode"; return false; }
   if(InpLotMode==LOT_MODIFIED_DALEMBERT && !CB22_DAParams(InpDAStartLot,InpDAStepLot,InpDAMaxLot))
      { reason="Invalid D'Alembert configuration"; return false; }
   if(InpFixedLot<=0 || InpMaxLayers<1 || InpMaxTotalRiskMoney<=0 || InpMagic==0)
      { reason="Set lot, max layers, max total risk and nonzero magic"; return false; }
   double vmin=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double vmax=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   if(step<=0 || InpFixedLot<vmin || InpFixedLot>vmax ||
      CB22_Abs(InpFixedLot/step-MathRound(InpFixedLot/step))>1e-7)
      { reason="Lot must match symbol min/max/step; EA never rounds lot automatically"; return false; }
   if(InpLotMode==LOT_MODIFIED_DALEMBERT)
      for(int i=0;i<=CB22_DAMaxLevel(InpDAStartLot,InpDAStepLot,InpDAMaxLot);i++)
      {
         double lot=CB22_DALot(i,InpDAStartLot,InpDAStepLot,InpDAMaxLot);
         if(lot<vmin || lot>vmax || CB22_Abs(lot/step-MathRound(lot/step))>1e-7)
            { reason="D'Alembert lot level violates broker volume min/max/step"; return false; }
      }
   if(BrokerFillMode()==CB22_FILL_NONE)
      { reason="Broker supports neither compatible FOK nor IOC execution"; return false; }
   long orders=SymbolInfoInteger(_Symbol,SYMBOL_ORDER_MODE);
   if((orders&SYMBOL_ORDER_SL)==0 || (orders&SYMBOL_ORDER_TP)==0)
      { reason="Broker must support SL and TP on the opening request"; return false; }
   reason=""; return true;
}

bool ReadCustomAstrology(const datetime now,AstroSignal &selected,string &reason)
{
   int h=FileOpen(InpAstrologyCsv,FeedFlags(),';',CP_UTF8);
   if(h==INVALID_HANDLE) { reason="Astrology file unavailable"; return false; }
   string c[];
   bool ok=ReadRow(h,c) && ArraySize(c)==9;
   string expected="signal_id;symbol;bias;valid_from;valid_until;core_start;core_end;web_utc_offset_minutes;broker_utc_offset_minutes";
   string header="";
   for(int i=0;i<ArraySize(c);i++) header+=(i==0?"":";")+c[i];
   if(!ok || header!=expected)
      { FileClose(h); reason="Invalid Astrology CSV header"; return false; }
   bool found=false;
   while(!FileIsEnding(h))
   {
      if(!ReadRow(h,c)) { ok=false; break; }
      if(ArraySize(c)==1 && c[0]=="") continue;
      if(ArraySize(c)!=9) { ok=false; break; }
      if(c[1]!=_Symbol && c[1]!="*") continue;
      AstroSignal candidate;
      int web_offset,broker_offset;
      if(!SimpleId(c[0]) || !DateValue(c[3],candidate.valid_from) ||
         !DateValue(c[4],candidate.valid_until) || !DateValue(c[5],candidate.core_from) ||
         !DateValue(c[6],candidate.core_until) || !Offset(c[7],web_offset) ||
         !Offset(c[8],broker_offset)) { ok=false; break; }
      candidate.id=c[0];
      candidate.core_at=candidate.core_from;
      candidate.direction=c[2]=="BUY"?1:(c[2]=="SELL"?-1:0);
      if(c[2]!="BUY" && c[2]!="SELL" && c[2]!="NEUTRAL") { ok=false; break; }
      candidate.valid_from=(datetime)CB22_ServerFromWebWall((long)candidate.valid_from,web_offset,broker_offset);
      candidate.valid_until=(datetime)CB22_ServerFromWebWall((long)candidate.valid_until,web_offset,broker_offset);
      candidate.core_from=(datetime)CB22_ServerFromWebWall((long)candidate.core_from,web_offset,broker_offset);
      candidate.core_until=(datetime)CB22_ServerFromWebWall((long)candidate.core_until,web_offset,broker_offset);
      candidate.core_at=candidate.core_from;
      if(candidate.valid_from>=candidate.valid_until || candidate.core_from>=candidate.core_until ||
         candidate.core_from<candidate.valid_from || candidate.core_until>candidate.valid_until)
         { ok=false; break; }
      if(now<candidate.valid_from || now>=candidate.valid_until) continue;
      // Contradictory weekly signals are never silently prioritized.
      if(found && (selected.id!=candidate.id || selected.direction!=candidate.direction ||
         selected.valid_from!=candidate.valid_from || selected.valid_until!=candidate.valid_until))
         { ok=false; break; }
      if(!found) { selected=candidate; found=true; }
      else if(CB22_InWindow((long)now,(long)candidate.valid_from,(long)candidate.valid_until,
                           (long)candidate.core_from,(long)candidate.core_until)) selected=candidate;
   }
   FileClose(h);
   if(!ok) { reason="Malformed/conflicting Astrology snapshot"; return false; }
   if(!found || selected.direction==0) { reason="No valid directional weekly signal"; return false; }
   reason=""; return true;
}

bool ISODate(const string iso,datetime &nominal)
{
   if(StringLen(iso)!=10 || StringGetCharacter(iso,4)!='-' || StringGetCharacter(iso,7)!='-') return false;
   string normalized=iso; StringReplace(normalized,"-",".");
   return DateValue(normalized+" 00:00:00",nominal);
}
bool Epoch(const string value,long &epoch)
{
   if(StringLen(value)!=10) return false;
   for(int i=0;i<StringLen(value);i++)
      if(StringGetCharacter(value,i)<'0' || StringGetCharacter(value,i)>'9') return false;
   epoch=StringToInteger(value); return epoch>=946684800;
}
bool ReadWeeklyPayload(const string payload,const datetime now,AstroSignal &selected,string &reason)
{
   if(StringLen(payload)<10 || StringLen(payload)>32768)
      { reason="Invalid weekly feed size"; return false; }
   string lines[]; int n=StringSplit(payload,'\n',lines);
   if(n<1) { reason="Empty weekly feed"; return false; }
   string header=Trim(lines[0]);
   if(StringLen(header)>0 && StringGetCharacter(header,0)==65279) header=StringSubstr(header,1);
   bool aspects=header=="monday,week_direction,date,start_epoch,core_epoch,end_epoch,model,aspects_at_core";
   if(!aspects && header!="monday,week_direction,date,start_epoch,core_epoch,end_epoch,model")
      { reason="Unknown weekly CSV schema"; return false; }
   AstroSignal windows[];
   for(int i=1;i<n;i++)
   {
      string line=Trim(lines[i]); if(line=="") continue;
      string c[]; int columns=StringSplit(line,',',c);
      if(columns!=(aspects?8:7)) { reason="Malformed weekly CSV row"; return false; }
      datetime nominal; long start,core,end;
      int direction=c[1]=="BUY"?1:(c[1]=="SELL"?-1:0);
      if(!ISODate(c[0],nominal) || !Epoch(c[3],start) || !Epoch(c[4],core) ||
         !Epoch(c[5],end) || direction==0 || c[6]!="ASTRO_WEEKLY_V1" ||
         start>=end || core<start || core>=end || start%300!=0 || core%300!=0 || end%300!=0)
         { reason="Invalid weekly direction/model/epochs"; return false; }
      MqlDateTime tm; TimeToStruct(nominal,tm);
      string displaydate=TimeToString((datetime)(start+7*3600),TIME_DATE); StringReplace(displaydate,".","-");
      if(tm.day_of_week!=1 || displaydate!=c[2])
         { reason="Weekly WIB calendar mismatch"; return false; }
      AstroSignal s;
      s.id="AW1_"+c[0]; s.direction=direction;
      s.valid_from=(datetime)CB22_ServerFromUTC((long)nominal-7*3600,InpBrokerUTCOffsetMinutes);
      s.valid_until=s.valid_from+7*86400;
      s.core_from=(datetime)CB22_ServerFromUTC(start,InpBrokerUTCOffsetMinutes);
      s.core_until=(datetime)CB22_ServerFromUTC(end,InpBrokerUTCOffsetMinutes);
      s.core_at=(datetime)CB22_ServerFromUTC(core,InpBrokerUTCOffsetMinutes);
      if(s.core_from<s.valid_from || s.core_until>s.valid_until)
         { reason="Window outside weekly validity"; return false; }
      for(int j=0;j<ArraySize(windows);j++)
      {
         if(windows[j].id==s.id && (windows[j].direction!=s.direction ||
            (windows[j].core_from<s.core_until && windows[j].core_until>s.core_from)))
            { reason="Conflicting/overlapping weekly windows"; return false; }
      }
      int k=ArraySize(windows); ArrayResize(windows,k+1); windows[k]=s;
   }
   bool found=false,inside=false;
   for(int i=0;i<ArraySize(windows);i++)
   {
      AstroSignal candidate=windows[i];
      if(now<candidate.valid_from || now>=candidate.valid_until) continue;
      if(found && (selected.id!=candidate.id || selected.direction!=candidate.direction ||
         selected.valid_from!=candidate.valid_from || selected.valid_until!=candidate.valid_until))
         { reason="Conflicting weekly directions or validity"; return false; }
      bool window=CB22_InWindow((long)now,(long)candidate.valid_from,(long)candidate.valid_until,
                                (long)candidate.core_from,(long)candidate.core_until);
      if(!found || (window && !inside)) selected=candidate;
      found=true;
      if(window) inside=true;
   }
   if(found) { reason=""; return true; }
   reason="No valid weekly bias in current server week";
   return false;
}
bool ReadLocalWeekly(const datetime now,AstroSignal &selected,string &reason)
{
   // Stream a large historical archive and retain only the current WIB week.
   // Live web parsing and its model/window rules remain unchanged.
   datetime wib=(datetime)((long)now-InpBrokerUTCOffsetMinutes*60+7*3600);
   MqlDateTime tm; TimeToStruct(wib,tm);
   datetime monday=wib-((tm.day_of_week+6)%7)*86400;
   string week=TimeToString(monday,TIME_DATE); StringReplace(week,".","-");
   if(MQLInfoInteger(MQL_TESTER) && gTesterLocalWeek==week)
      return ReadWeeklyPayload(gTesterLocalPayload,now,selected,reason);
   int h=FileOpen(InpAstrologyCsv,FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ|
      (InpFeedInCommonFiles?FILE_COMMON:0),0,CP_UTF8);
   if(h==INVALID_HANDLE) { reason="Local historical weekly CSV unavailable"; return false; }
   string payload=FileReadString(h)+"\n";
   bool ok=true;
   while(!FileIsEnding(h))
   {
      string line=Trim(FileReadString(h)); if(line=="") continue;
      int comma=StringFind(line,",");
      datetime row_monday;
      if(comma<0 || !ISODate(StringSubstr(line,0,comma),row_monday)) { ok=false; break; }
      if(StringSubstr(line,0,comma)!=week) continue;
      payload+=line+"\n";
      if(StringLen(payload)>32768) { ok=false; break; }
   }
   FileClose(h);
   if(!ok) { reason="Malformed historical weekly archive/current-week size"; return false; }
   if(MQLInfoInteger(MQL_TESTER)) { gTesterLocalWeek=week; gTesterLocalPayload=payload; }
   return ReadWeeklyPayload(payload,now,selected,reason);
}
bool ReadAstrology(const datetime now,AstroSignal &selected,string &reason)
{
   if(InpCustomAstrologyCsv) return ReadCustomAstrology(now,selected,reason);
   if(MQLInfoInteger(MQL_TESTER) || !InpAutoAstrologyWeb) return ReadLocalWeekly(now,selected,reason);
   datetime wall=TimeLocal();
   if(gLastWebRead==0 || wall<gLastWebRead || wall-gLastWebRead>=InpWebPollSeconds)
   {
      gLastWebRead=wall; gWebOK=false; gWebPayload="";
      char request[],response[]; string headers;
      ResetLastError();
      int http=WebRequest("GET",InpAstroWebURL,"Accept: text/csv\r\nCache-Control: no-cache\r\n",
         InpHTTPTimeoutMs,request,response,headers);
      if(http==200 && ArraySize(response)>0 && ArraySize(response)<=32768)
         { gWebPayload=CharArrayToString(response,0,WHOLE_ARRAY,CP_UTF8); gWebOK=true; }
      else gWebError="Astrology HTTP "+IntegerToString(http)+" / MT5 error "+IntegerToString(GetLastError());
   }
   if(!gWebOK) { reason=gWebError; return false; }
   return ReadWeeklyPayload(gWebPayload,now,selected,reason);
}

bool EntryWindow(const datetime now)
{
   return gSignalActive && CB22_InWindow((long)now,(long)gSignal.valid_from,(long)gSignal.valid_until,
      (long)gSignal.core_from,(long)gSignal.core_until);
}
void SaveWeeklyReport(const string week)
{
   if(!InpWeeklyDiagnostics || week=="") return;
   string file="CB22_Weekly_Reclaim_"+_Symbol+"_"+StringFormat("%I64u",InpMagic)+".csv";
   bool exists=FileIsExist(file,InpFeedInCommonFiles?FILE_COMMON:0);
   int flags=FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|(InpFeedInCommonFiles?FILE_COMMON:0);
   int h=FileOpen(file,flags,';',CP_UTF8);
   if(h==INVALID_HANDLE) { Print("CB22 weekly report unavailable: ",GetLastError()); return; }
   if(!exists || FileSize(h)==0)
      FileWrite(h,"weekly_id","sweeps","reclaims","reclaims_in_window","reclaims_outside",
         "expired","invalidated","blocked_auto","blocked_spread","blocked_risk",
         "blocked_gate","order_attempts","fills");
   FileSeek(h,0,SEEK_END);
   FileWrite(h,week,gWeeklyStats.sweeps,gWeeklyStats.reclaims,gWeeklyStats.reclaim_in_window,
      gWeeklyStats.reclaim_outside,gWeeklyStats.expired,gWeeklyStats.invalidated,
      gWeeklyStats.blocked_auto,gWeeklyStats.blocked_spread,gWeeklyStats.blocked_risk,
      gWeeklyStats.blocked_gate,gWeeklyStats.orders,gWeeklyStats.filled);
   FileFlush(h); FileClose(h);
   Print("CB22 WEEK ",week," reclaim=",gWeeklyStats.reclaims," inside=",gWeeklyStats.reclaim_in_window,
      " orders=",gWeeklyStats.orders," filled=",gWeeklyStats.filled,
      " spread_blocks=",gWeeklyStats.blocked_spread," gate_blocks=",gWeeklyStats.blocked_gate);
}
void BeginWeeklyCounters(const string week)
{
   if(gWeeklyStatsId==week) return;
   SaveWeeklyReport(gWeeklyStatsId);
   ZeroMemory(gWeeklyStats);
   gWeeklyStatsId=week;
}
void RefreshSignal(const datetime now)
{
   if(now==gLastRefresh) return;
   gLastRefresh=now;
   AstroSignal next;
   string reason;
   bool valid=ReadAstrology(now,next,reason);
   if(!valid)
   {
      ClearSetups(reason); gSignalActive=false; gEntryWindowOpen=false;
      Report(reason); return;
   }
   if(gSignalActive && (gSignal.id!=next.id || gSignal.direction!=next.direction ||
      gSignal.valid_from!=next.valid_from || gSignal.valid_until!=next.valid_until))
      ClearSetups("Weekly identity/bias/validity changed");
   if(!gSignalActive) Report("Weekly bias active; scanner monitoring M5");
   gSignal=next; gSignalActive=true;
   gEntryWindowOpen=EntryWindow(now);
   BeginWeeklyCounters(gSignal.id);
}
void AddLevel(const double price,const datetime confirmed,const ENUM_TIMEFRAMES tf)
{
   int n=ArraySize(gLevels);
   LiquidityLevel level;
   level.price=price; level.confirmed_at=confirmed; level.timeframe=tf; level.equal_level=false;
   for(int i=0;i<n;i++)
   {
      if(CB22_Abs(gLevels[i].price-price)<=InpEqualTolerancePoints*_Point+1e-10)
         { level.equal_level=true; gLevels[i].equal_level=true; }
      // Keep exact constituent prices of equal levels, never average them.
      if(CB22_Abs(gLevels[i].price-price)<SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE)*0.01)
         return;
   }
   ArrayResize(gLevels,n+1); gLevels[n]=level;
}
bool ScanTimeframe(const ENUM_TIMEFRAMES tf,const datetime cutoff)
{
   MqlRates r[]; ArraySetAsSeries(r,true);
   int count=CopyRates(_Symbol,tf,1,InpLookbackBars,r);
   if(tf==PERIOD_H1) gH1Bars=count>0?count:0;
   if(tf==PERIOD_H4) gH4Bars=count>0?count:0;
   if(!CB22_HistoryUsable(count,InpSwingLeft,InpSwingRight)) return false;
   int seconds=PeriodSeconds(tf);
   for(int i=InpSwingRight;i<count-InpSwingLeft;i++)
   {
      datetime confirmation=r[i-InpSwingRight].time+seconds;
      if(confirmation>cutoff) continue;
      double price=gSignal.direction==1?r[i].low:r[i].high;
      bool pivot=true,strict=false;
      for(int j=i-InpSwingRight;j<=i+InpSwingLeft;j++)
      {
         if(j==i) continue;
         double other=gSignal.direction==1?r[j].low:r[j].high;
         if((gSignal.direction==1 && other<price) || (gSignal.direction==-1 && other>price))
            { pivot=false; break; }
         if(other!=price) strict=true;
      }
      if(pivot && strict) AddLevel(price,confirmation,tf);
   }
   return true;
}
bool BuildLevels(const datetime cutoff)
{
   ArrayResize(gLevels,0);
   gH1Ready=InpScanH1?ScanTimeframe(PERIOD_H1,cutoff):false;
   gH4Ready=InpScanH4?ScanTimeframe(PERIOD_H4,cutoff):false;
   return CB22_AnyScannerReady(InpScanH1,gH1Ready,InpScanH4,gH4Ready);
}

// Return exactly one freshly closed M5 reclaim. No IB, B point, or CB1 confirmation.
// A sweep may begin outside the published entry window, but the reclaim MUST close
// inside that window. H1/H4 levels are frozen when the sweep first breaches.
bool DetectSweep(const MqlRates &bar,const MqlRates &previous,Setup &reclaimed)
{
   if(gSweep.active && (long)bar.time-(long)gSweep.first_bar>=InpSetupMaxAgeM5Bars*300)
   {
      gSweep.active=false; ArrayResize(gFrozenLevels,0); ArrayResize(gTouched,0);
      gWeeklyStats.expired++;
   }
   if(!gSweep.active)
   {
      bool breached=false;
      for(int i=0;i<ArraySize(gLevels);i++)
         if(CB22_Breach(gSignal.direction,bar.low,bar.high,previous.close,gLevels[i].price))
            { breached=true; break; }
      if(!breached) return false;
      gWeeklyStats.sweeps++;
      gSweep.active=true; gSweep.direction=gSignal.direction;
      gSweep.signal_id=gSignal.id; gSweep.first_bar=bar.time; gSweep.extreme_bar=bar.time;
      gSweep.extreme=gSignal.direction==1?bar.low:bar.high;
      int n=ArraySize(gLevels);
      ArrayResize(gFrozenLevels,n); ArrayResize(gTouched,n);
      for(int i=0;i<n;i++) { gFrozenLevels[i]=gLevels[i]; gTouched[i]=false; }
   }
   if((gSweep.direction==1 && bar.low<gSweep.extreme) || (gSweep.direction==-1 && bar.high>gSweep.extreme))
      { gSweep.extreme=gSweep.direction==1?bar.low:bar.high; gSweep.extreme_bar=bar.time; }
   bool has_reclaim=false;
   for(int i=0;i<ArraySize(gFrozenLevels);i++)
   {
      double level=gFrozenLevels[i].price;
      if(CB22_Breach(gSweep.direction,bar.low,bar.high,previous.close,level)) gTouched[i]=true;
      if(gTouched[i] && CB22_Reclaim(gSweep.direction,bar.close,level)) has_reclaim=true;
   }
   if(!has_reclaim) return false;
   gWeeklyStats.reclaims++;
   reclaimed.signal_id=gSweep.signal_id; reclaimed.direction=gSweep.direction;
   reclaimed.first_bar=gSweep.first_bar; reclaimed.reclaim_bar=bar.time;
   reclaimed.extreme=gSweep.extreme; reclaimed.extreme_bar=gSweep.extreme_bar;
   reclaimed.id=reclaimed.signal_id+"|"+_Symbol+"|"+(reclaimed.direction==1?"BUY":"SELL")+"|"+
      TimeToString(reclaimed.first_bar,TIME_DATE|TIME_SECONDS)+"|"+
      TimeToString(reclaimed.reclaim_bar,TIME_DATE|TIME_SECONDS);
   gSweep.active=false;
   ArrayResize(gFrozenLevels,0); ArrayResize(gTouched,0);
   Print("CB22 M5 SWEEP+RECLAIM ",reclaimed.id," extreme=",DoubleToString(reclaimed.extreme,_Digits));
   return true;
}

bool IsOwnPosition()
{
   return PositionGetString(POSITION_SYMBOL)==_Symbol &&
      (ulong)PositionGetInteger(POSITION_MAGIC)==InpMagic;
}
bool Exposure(const ulong exclude,int &count,double &risk)
{
   count=0; risk=0;
   for(int i=0;i<PositionsTotal();i++)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0 || ticket==exclude || !IsOwnPosition()) continue;
      count++;
      double sl=PositionGetDouble(POSITION_SL),profit=0;
      ENUM_ORDER_TYPE type=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
      if(sl<=0 || !OrderCalcProfit(type,_Symbol,PositionGetDouble(POSITION_VOLUME),
         PositionGetDouble(POSITION_PRICE_OPEN),sl,profit)) return false;
      risk+=MathMax(0.0,-profit);
   }
   return true;
}
bool HaveOwnWorkingOrder()
{
   for(int i=0;i<OrdersTotal();i++)
   {
      if(OrderGetTicket(i)==0) continue;
      if(OrderGetString(ORDER_SYMBOL)==_Symbol && (ulong)OrderGetInteger(ORDER_MAGIC)==InpMagic)
         return true;
   }
   return false;
}
bool RiskBudget(const ulong exclude,const int direction,const double volume,
                const double entry,const double sl)
{
   int count; double oldrisk,newprofit;
   ENUM_ORDER_TYPE type=direction==1?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
   if(!Exposure(exclude,count,oldrisk) || !OrderCalcProfit(type,_Symbol,volume,entry,sl,newprofit)) return false;
   return CB22_CanLayer(count,InpMaxLayers,oldrisk,MathMax(0.0,-newprofit),InpMaxTotalRiskMoney);
}

bool SessionOpen(const datetime now)
{
   MqlDateTime tm; TimeToStruct(now,tm);
   int second=tm.hour*3600+tm.min*60+tm.sec;
   for(int day=0;day<2;day++)
   {
      ENUM_DAY_OF_WEEK weekday=(ENUM_DAY_OF_WEEK)((tm.day_of_week+7-day)%7);
      for(uint i=0;i<32;i++)
      {
         datetime from,until;
         if(!SymbolInfoSessionTrade(_Symbol,weekday,i,from,until)) break;
         long start=(long)from%86400,end=(long)until%86400;
         if(day==0 && (start==end || (start<end && second>=start && second<end) ||
            (start>end && second>=start))) return true;
         if(day==1 && start>end && second<end) return true;
      }
   }
   return false;
}
bool TradingPermitted(const int direction,const datetime now)
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED) ||
      !AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) || !AccountInfoInteger(ACCOUNT_TRADE_EXPERT)) return false;
   long mode=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_MODE);
   if(mode==SYMBOL_TRADE_MODE_DISABLED || mode==SYMBOL_TRADE_MODE_CLOSEONLY ||
      (direction==1 && mode==SYMBOL_TRADE_MODE_SHORTONLY) ||
      (direction==-1 && mode==SYMBOL_TRADE_MODE_LONGONLY)) return false;
   return SessionOpen(now);
}

string PlanPath(const string key) { return gStatePrefix+key+".plan"; }
string DonePath(const string key) { return gStatePrefix+key+".done"; }
string ReceiptPath(const string key) { return gStatePrefix+key+".fill"; }
bool SaveFillReceipt(const EntryPlan &plan)
{
   int h=FileOpen(ReceiptPath(plan.key),FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,';');
   if(h==INVALID_HANDLE) return false;
   uint n=FileWrite(h,plan.key,StringFormat("%I64u",plan.order),DoubleToString(plan.confirmed_volume,8));
   FileFlush(h); FileClose(h); return n>0;
}
bool LoadFillReceipt(EntryPlan &plan)
{
   if(!FileIsExist(ReceiptPath(plan.key),FILE_COMMON)) return true;
   int h=FileOpen(ReceiptPath(plan.key),FILE_READ|FILE_CSV|FILE_ANSI|FILE_COMMON,';');
   if(h==INVALID_HANDLE) return false;
   string c[]; bool ok=ReadRow(h,c) && ArraySize(c)==3;
   if(ok) ok=c[0]==plan.key && StringLen(c[1])>0 && StringLen(c[1])<=18 &&
      Number(c[2],plan.confirmed_volume) && plan.confirmed_volume>=0 && plan.confirmed_volume<=plan.volume+1e-8;
   if(ok)
   {
      for(int i=0;i<StringLen(c[1]);i++)
         if(StringGetCharacter(c[1],i)<'0' || StringGetCharacter(c[1],i)>'9') { ok=false; break; }
      if(ok) plan.order=(ulong)StringToInteger(c[1]);
   }
   FileClose(h); return ok;
}
bool PlanDone(const string key)
{
   int h=FileOpen(DonePath(key),FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h==INVALID_HANDLE) return false;
   string result=Trim(FileReadString(h)); FileClose(h);
   return result=="FINAL" || result=="CLOSED_OR_REJECTED" || result=="REJECTED" ||
      result=="CLOSED_DURING_FINALIZATION" || result=="PROTECTION_FAILURE_CLOSED";
}
bool SaveDone(const string key,const string result)
{
   int h=FileOpen(DonePath(key),FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h==INVALID_HANDLE) return false;
   uint written=FileWriteString(h,result+"\r\n");
   FileFlush(h); FileClose(h); return written>0;
}
string DAStatePath() { return gStatePrefix+"dalembert.state"; }
string DAStateLine()
{
   return "DA1|"+IntegerToString(gDALevel)+"|"+(gDAActive?"1":"0")+"|"+
      StringFormat("%I64d",(long)gDABasketStart)+"|"+
      DoubleToString(gDABasketLot,8)+"|"+StringFormat("%I64d",(long)gDAHistoryFrom);
}
bool SaveDAState()
{
   if(InpLotMode!=LOT_MODIFIED_DALEMBERT) return true;
   string payload=DAStateLine(),tmp=DAStatePath()+".tmp";
   int h=FileOpen(tmp,FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h==INVALID_HANDLE) return false;
   bool ok=FileWriteString(h,payload+"|"+HashKey(payload)+"\r\n")>0;
   FileFlush(h); FileClose(h);
   if(!ok) return false;
   ResetLastError();
   // Atomic replacement of a single integrity-protected state record.
   return FileMove(tmp,FILE_COMMON,DAStatePath(),FILE_COMMON|FILE_REWRITE);
}
bool LoadDAState()
{
   if(InpLotMode!=LOT_MODIFIED_DALEMBERT) { gDAReady=true; return true; }
   string path=DAStatePath();
   if(!FileIsExist(path,FILE_COMMON))
   {
      // Existing marker + missing state means deletion/corruption, NEVER silently reset level.
      if(FileIsExist(path+".initialized",FILE_COMMON))
         { Report("D'Alembert state missing after initialization; BLOCK"); return false; }
      int count; double risk;
      if(!Exposure(0,count,risk) || count>0 || HaveOwnWorkingOrder() || ArraySize(gPlans)>0)
         { Report("D'Alembert legacy or uncertain positions; BLOCK until manually reconciled"); return false; }
      gDALevel=0; gDAActive=false; gDABasketStart=0; gDABasketLot=0;
      gDAHistoryFrom=TimeCurrent();
      if(!SaveDAState()) return false;
      int marker=FileOpen(path+".initialized",FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
      if(marker==INVALID_HANDLE) return false;
      bool saved=FileWriteString(marker,"DA1 initialized; do not delete state\r\n")>0;
      FileFlush(marker); FileClose(marker);
      return saved;
   }
   int h=FileOpen(path,FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON);
   if(h==INVALID_HANDLE) return false;
   string line=Trim(FileReadString(h)); FileClose(h);
   string a[]; if(StringSplit(line,'|',a)!=7 || a[0]!="DA1") return false;
   string payload=a[0]+"|"+a[1]+"|"+a[2]+"|"+a[3]+"|"+a[4]+"|"+a[5];
   if(HashKey(payload)!=a[6]) return false;
   double level,active,start,volume,history;
   if(!Number(a[1],level) || !Number(a[2],active) || !Number(a[3],start) ||
      !Number(a[4],volume) || !Number(a[5],history) ||
      level<0 || level>CB22_DAMaxLevel(InpDAStartLot,InpDAStepLot,InpDAMaxLot) ||
      MathFloor(level)!=level || (active!=0 && active!=1) || start<0 || history<0) return false;
   gDALevel=(int)level; gDAActive=active==1; gDABasketStart=(datetime)start;
   gDABasketLot=volume; gDAHistoryFrom=(datetime)history;
   if(gDAActive && (gDABasketStart<=0 || gDABasketLot<=0)) return false;
   return true;
}
double ResolveOrderLot()
{
   if(InpLotMode==LOT_FIXED) return InpFixedLot;
   if(!gDAReady) return 0;
   return gDAActive?gDABasketLot:
      CB22_DALot(gDALevel,InpDAStartLot,InpDAStepLot,InpDAMaxLot);
}
// Persist basket lock before the first broker request. Recovery never guesses a missing fill.
bool ReserveDABasket(const double volume)
{
   if(InpLotMode==LOT_FIXED) return true;
   if(!gDAReady) return false;
   if(gDAActive) return CB22_Abs(gDABasketLot-volume)<1e-8;
   if(TimeCurrent()<=gDAHistoryFrom) return false; // Separate basket time boundaries
   gDAActive=true; gDABasketStart=TimeCurrent(); gDABasketLot=volume;
   if(!SaveDAState()) { gDAReady=false; return false; }
   return true;
}
void ReconcileDABasket()
{
   if(InpLotMode!=LOT_MODIFIED_DALEMBERT || !gDAReady || !gDAActive) return;
   if(gRecoveryBlocked || ArraySize(gPlans)>0 || HaveOwnWorkingOrder()) return;
   int count; double risk;
   if(!Exposure(0,count,risk) || count>0) return;
   if(!HistorySelect(gDABasketStart-60,TimeCurrent()+60))
      { gDAReady=false; Report("D'Alembert history unavailable; BLOCK"); return; }
   ulong identifiers[];
   double opened[];
   double closed[];
   bool unknown=false;
   for(int i=0;i<HistoryDealsTotal();i++)
   {
      ulong deal=HistoryDealGetTicket(i);
      if(HistoryDealGetString(deal,DEAL_SYMBOL)!=_Symbol ||
         (ulong)HistoryDealGetInteger(deal,DEAL_MAGIC)!=InpMagic ||
         HistoryDealGetInteger(deal,DEAL_ENTRY)!=DEAL_ENTRY_IN) continue;
      if((datetime)HistoryDealGetInteger(deal,DEAL_TIME)<gDABasketStart) continue;
      ulong id=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
      if(id==0) { unknown=true; break; }
      int k=-1;
      for(int j=0;j<ArraySize(identifiers);j++) if(identifiers[j]==id) { k=j; break; }
      if(k<0) { k=ArraySize(identifiers); ArrayResize(identifiers,k+1);
         ArrayResize(opened,k+1); ArrayResize(closed,k+1);
         identifiers[k]=id; opened[k]=0; closed[k]=0; }
      opened[k]+=HistoryDealGetDouble(deal,DEAL_VOLUME);
   }
   if(unknown) { gDAReady=false; Report("D'Alembert inconsistent entry position IDs"); return; }
   double net=0;
   for(int i=0;i<HistoryDealsTotal();i++)
   {
      ulong deal=HistoryDealGetTicket(i);
      ulong id=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
      int k=-1;
      for(int j=0;j<ArraySize(identifiers);j++) if(identifiers[j]==id) { k=j; break; }
      if(k<0) continue;
      long entry=HistoryDealGetInteger(deal,DEAL_ENTRY);
      if(entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_OUT_BY)
         closed[k]+=HistoryDealGetDouble(deal,DEAL_VOLUME);
      net+=HistoryDealGetDouble(deal,DEAL_PROFIT)+HistoryDealGetDouble(deal,DEAL_SWAP)+
         HistoryDealGetDouble(deal,DEAL_COMMISSION)+HistoryDealGetDouble(deal,DEAL_FEE);
   }
   for(int k=0;k<ArraySize(identifiers);k++)
      if(opened[k]<=0 || CB22_Abs(opened[k]-closed[k])>1e-7)
         { gDAReady=false; Report("D'Alembert incomplete basket deals; BLOCK"); return; }
   int old=gDALevel;
   if(ArraySize(identifiers)>0)
      gDALevel=CB22_DANextLevel(gDALevel,CB22_DAMaxLevel(InpDAStartLot,InpDAStepLot,InpDAMaxLot),net,0.000001);
   gDAActive=false; gDABasketStart=0; gDABasketLot=0;
   if(!SaveDAState()) { gDAReady=false; Report("D'Alembert commit failed; BLOCK"); return; }
   if(ArraySize(identifiers)>0)
   {
      Print("CB22 BASKET CLOSED net=",DoubleToString(net,2)," level ",old," -> ",gDALevel);
      QueueNotice("BASKET_"+StringFormat("%I64d",(long)gDAHistoryFrom)+"_"+
         IntegerToString((int)TimeCurrent()),"CB22 BASKET CLOSED net "+DoubleToString(net,2)+
         " "+AccountInfoString(ACCOUNT_CURRENCY)+" | level "+IntegerToString(old)+" -> "+IntegerToString(gDALevel));
   }
   gDAHistoryFrom=TimeCurrent();
   if(!SaveDAState()) { gDAReady=false; Report("D'Alembert checkpoint failed; BLOCK"); }
}
bool ClaimPlan(const Setup &setup,const double atr,const double volume,EntryPlan &plan)
{
   plan.key=HashKey(AccountInfoString(ACCOUNT_SERVER)+"|"+setup.id);
   plan.direction=setup.direction; plan.extreme=setup.extreme; plan.atr=atr;
   plan.volume=volume; plan.created=TimeCurrent(); plan.order=0;
   plan.filling=gFilling;
   plan.confirmed_volume=0;
   plan.emergency=false; plan.finalized=false;
   // Exclusive common-file open is also the cross-chart / cross-terminal lock.
   int h=FileOpen(PlanPath(plan.key),FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,';',CP_UTF8);
   if(h==INVALID_HANDLE) return false;
   if(FileSize(h)>0) { FileClose(h); return false; }
   uint written=FileWrite(h,plan.key,_Symbol,IntegerToString(plan.direction),
      DoubleToString(plan.extreme,16),DoubleToString(plan.atr,16),
      DoubleToString(plan.volume,8),TimeToString(plan.created,TIME_DATE|TIME_SECONDS),setup.id,
      IntegerToString(plan.filling));
   FileFlush(h); FileClose(h);
   return written>0;
}
bool LoadPlan(const string key,EntryPlan &plan)
{
   int h=FileOpen(PlanPath(key),FILE_READ|FILE_CSV|FILE_ANSI|FILE_COMMON,';',CP_UTF8);
   if(h==INVALID_HANDLE) return false;
   string c[]; bool ok=ReadRow(h,c) && (ArraySize(c)==8 || ArraySize(c)==9);
   double direction=0;
   if(ok) ok=c[0]==key && c[1]==_Symbol && Number(c[2],direction) &&
      (direction==1 || direction==-1) && Number(c[3],plan.extreme) &&
      Number(c[4],plan.atr) && Number(c[5],plan.volume) && DateValue(c[6],plan.created) &&
      plan.extreme>0 && plan.atr>0 && plan.volume>0;
   plan.filling=CB22_FILL_FOK; // Backward-compatible v3.00 plan (8 columns).
   double saved_filling=0;
   if(ok && ArraySize(c)==9)
   {
      ok=Number(c[8],saved_filling) && (saved_filling==CB22_FILL_FOK || saved_filling==CB22_FILL_IOC);
      if(ok) plan.filling=(int)saved_filling;
   }
   FileClose(h);
   if(!ok) return false;
   plan.key=key; plan.direction=(int)direction; plan.order=0;
   plan.confirmed_volume=plan.filling==CB22_FILL_FOK?plan.volume:0;
   plan.emergency=false; plan.finalized=false; return LoadFillReceipt(plan);
}
bool KnownPlan(const string key)
{
   for(int i=0;i<ArraySize(gPlans);i++) if(gPlans[i].key==key) return true;
   return false;
}
ulong PlanPosition(const EntryPlan &plan)
{
   string comment=CB22_PREFIX+plan.key;
   for(int i=0;i<PositionsTotal();i++)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0 || !IsOwnPosition()) continue;
      if(StringFind(PositionGetString(POSITION_COMMENT),comment)==0) return ticket;
      if(plan.order>0 && HistoryOrderSelect(plan.order))
      {
         ulong identifier=(ulong)HistoryOrderGetInteger(plan.order,ORDER_POSITION_ID);
         if(identifier>0 && (ulong)PositionGetInteger(POSITION_IDENTIFIER)==identifier) return ticket;
      }
   }
   return 0;
}
void RecoverPositions()
{
   gRecoveryBlocked=gUnreadableState;
   for(int i=0;i<PositionsTotal();i++)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0 || !IsOwnPosition()) continue;
      string comment=PositionGetString(POSITION_COMMENT);
      if(StringFind(comment,CB22_PREFIX)!=0 || StringLen(comment)<21)
         { gRecoveryBlocked=true; continue; }
      string key=StringSubstr(comment,StringLen(CB22_PREFIX),16);
      if(PlanDone(key) || KnownPlan(key)) continue;
      EntryPlan plan;
      if(!LoadPlan(key,plan)) { gRecoveryBlocked=true; continue; }
      int n=ArraySize(gPlans); ArrayResize(gPlans,n+1); gPlans[n]=plan;
      Print("CB22 recovering unfinished entry ",key);
   }
}
void RecoverPendingPlans()
{
   string filename;
   long search=FileFindFirst(gStatePrefix+"*.plan",filename,FILE_COMMON);
   if(search==INVALID_HANDLE) return;
   do
   {
      string key=StringSubstr(filename,StringLen(gStatePrefix),16);
      if(PlanDone(key) || KnownPlan(key)) continue;
      EntryPlan plan;
      if(!LoadPlan(key,plan)) { gUnreadableState=true; continue; }
      int n=ArraySize(gPlans); ArrayResize(gPlans,n+1); gPlans[n]=plan;
      Print("CB22 recovering durable pending claim ",key);
   }
   while(FileFindNext(search,filename));
   FileFindClose(search);
}
bool ReadOrderFill(EntryPlan &plan,bool &no_fill,double &opened,double &closed,double &fill_price)
{
   no_fill=false; opened=0; closed=0; fill_price=0;
   if(!HistorySelect(plan.created-60,TimeCurrent())) return false;
   if(plan.order==0)
   {
      for(int i=0;i<HistoryOrdersTotal();i++)
      {
         ulong ticket=HistoryOrderGetTicket(i);
         if(HistoryOrderGetString(ticket,ORDER_SYMBOL)==_Symbol &&
            (ulong)HistoryOrderGetInteger(ticket,ORDER_MAGIC)==InpMagic &&
            StringFind(HistoryOrderGetString(ticket,ORDER_COMMENT),CB22_PREFIX+plan.key)==0)
            { plan.order=ticket; break; }
      }
   }
   if(plan.order==0 || OrderSelect(plan.order)) return false;
   if(!HistoryOrderSelect(plan.order)) return false;
   long state=HistoryOrderGetInteger(plan.order,ORDER_STATE);
   bool canceled=state==ORDER_STATE_CANCELED || state==ORDER_STATE_REJECTED || state==ORDER_STATE_EXPIRED;
   bool partial=state==ORDER_STATE_PARTIAL;
   if(!CB22_TerminalOrder(false,state==ORDER_STATE_FILLED,canceled,partial)) return false;
   ulong identifier=(ulong)HistoryOrderGetInteger(plan.order,ORDER_POSITION_ID);
   double weighted=0;
   for(int i=0;i<HistoryDealsTotal();i++)
   {
      ulong deal=HistoryDealGetTicket(i);
      if((ulong)HistoryDealGetInteger(deal,DEAL_ORDER)!=plan.order ||
         HistoryDealGetInteger(deal,DEAL_ENTRY)!=DEAL_ENTRY_IN) continue;
      double volume=HistoryDealGetDouble(deal,DEAL_VOLUME);
      opened+=volume; weighted+=HistoryDealGetDouble(deal,DEAL_PRICE)*volume;
      if(identifier==0) identifier=(ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
   }
   if(opened>0) fill_price=weighted/opened;
   if(identifier>0)
      for(int i=0;i<HistoryDealsTotal();i++)
      {
         ulong deal=HistoryDealGetTicket(i);
         if((ulong)HistoryDealGetInteger(deal,DEAL_POSITION_ID)!=identifier) continue;
         long entry=HistoryDealGetInteger(deal,DEAL_ENTRY);
         if(entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_OUT_BY) closed+=HistoryDealGetDouble(deal,DEAL_VOLUME);
      }
   no_fill=canceled && identifier==0 && opened==0;
   if(plan.confirmed_volume<=0)
   {
      double initial=HistoryOrderGetDouble(plan.order,ORDER_VOLUME_INITIAL);
      double remaining=HistoryOrderGetDouble(plan.order,ORDER_VOLUME_CURRENT);
      double reported=initial-remaining;
      if(partial && initial>0 && remaining>=0 && reported>0) plan.confirmed_volume=reported;
      else if(plan.filling==CB22_FILL_FOK) plan.confirmed_volume=plan.volume;
      else
      {
         // Broker order history is a second source of the final filled amount.
         // Never guess it from a potentially incomplete POSITION_ADD snapshot.
         if(initial>0 && remaining>=0 && reported>0) plan.confirmed_volume=reported;
      }
   }
   return true;
}
void FinalizeEntries()
{
   for(int i=ArraySize(gPlans)-1;i>=0;i--)
   {
      EntryPlan plan=gPlans[i];
      if(plan.finalized)
      {
         if(SaveDone(plan.key,"FINAL")) RemovePlan(i);
         continue;
      }
      bool no_fill=false; double opened=0,closed=0,fill_price=0;
      bool terminal=ReadOrderFill(plan,no_fill,opened,closed,fill_price);
      gPlans[i]=plan;
      ulong ticket=PlanPosition(plan);
      if(ticket==0)
      {
         if(terminal && (no_fill || (plan.confirmed_volume>0 &&
            CB22_Abs(opened-plan.confirmed_volume)<=1e-8 && CB22_ConfirmedClosed(opened,closed))))
         {
            if(opened>0)
               QueueNotice("ENTRY_"+plan.key,"CB22 ENTRY FILLED THEN CLOSED\n"+_Symbol+" "+
                  (plan.direction==1?"BUY":"SELL")+" | lot "+DoubleToString(opened,8)+
                  "\nEntry "+DoubleToString(fill_price,_Digits)+" | finalization not completed");
            if(SaveDone(plan.key,"CLOSED_OR_REJECTED")) RemovePlan(i);
            continue;
         }
         gPlans[i]=plan;
         Report("Unconfirmed broker outcome; new entries blocked; key="+plan.key);
         continue;
      }
      if(!PositionSelectByTicket(ticket)) continue;
      double entry=PositionGetDouble(POSITION_PRICE_OPEN),volume=PositionGetDouble(POSITION_VOLUME);
      if(!CB22_FillSynchronized(terminal,volume,opened,closed,plan.confirmed_volume) ||
         !CB22_FillPriceConsistent(entry,fill_price,SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE)))
         { Report("Waiting for final order/deals/position fill snapshot"); continue; }
      int direction=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?1:-1;
      double sl=0,tp=0,risk=0;
      MqlTick tick; bool quotes=SymbolInfoTick(_Symbol,tick);
      double step=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
      if(direction!=plan.direction || !CB22_ValidFillVolume(plan.filling,plan.volume,volume,
         SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP)) ||
         !CB22_Risk(plan.direction,entry,plan.extreme,plan.atr,step,sl,tp,risk) ||
         !RiskBudget(ticket,plan.direction,volume,entry,sl)) plan.emergency=true;
      if(!plan.emergency && quotes)
      {
         // This is one-time fill finalization; finalized older layers are never modified.
         if(!PositionSelectByTicket(ticket)) continue;
         bool same=CB22_Abs(PositionGetDouble(POSITION_SL)-sl)<step*0.01 &&
            CB22_Abs(PositionGetDouble(POSITION_TP)-tp)<step*0.01;
         if(!same)
         {
            double min_distance=(double)MathMax(SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL),
               SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL))*_Point;
            if(!CB22_StopsValid(plan.direction,sl,tp,tick.bid,tick.ask,min_distance)) plan.emergency=true;
            else if(!gTrade.PositionModify(ticket,NormalizeDouble(sl,_Digits),NormalizeDouble(tp,_Digits)) ||
               (gTrade.ResultRetcode()!=TRADE_RETCODE_DONE && gTrade.ResultRetcode()!=TRADE_RETCODE_NO_CHANGES))
               plan.emergency=true;
         }
         if(!plan.emergency)
         {
            if(!PositionSelectByTicket(ticket))
               { if(SaveDone(plan.key,"CLOSED_DURING_FINALIZATION")) RemovePlan(i); continue; }
            if(CB22_Abs(PositionGetDouble(POSITION_SL)-sl)>=step*0.01 ||
               CB22_Abs(PositionGetDouble(POSITION_TP)-tp)>=step*0.01) plan.emergency=true;
            else
            {
               plan.finalized=true; gPlans[i]=plan;
               gWeeklyStats.filled++;
               Print("CB22 FINAL ticket=",ticket," entry=",entry," ATR=",plan.atr,
                  " SL=",sl," TP=",tp," R=",risk);
               QueueNotice("ENTRY_"+plan.key,"CB22 ENTRY "+(plan.direction==1?"BUY":"SELL")+" "+_Symbol+
                  "\nTicket "+StringFormat("%I64u",ticket)+" | lot "+DoubleToString(volume,8)+
                  (volume+1e-8<plan.volume?" (IOC partial, requested "+DoubleToString(plan.volume,8)+")":"")+
                  "\nEntry "+DoubleToString(entry,_Digits)+" | ATR "+DoubleToString(plan.atr,_Digits)+
                  "\nSL "+DoubleToString(sl,_Digits)+" | TP "+DoubleToString(tp,_Digits)+" | RR 1:4");
               if(SaveDone(plan.key,"FINAL")) RemovePlan(i);
               continue;
            }
         }
      }
      gPlans[i]=plan;
      if(plan.emergency)
      {
         Report("Entry protection failure; closing ONLY new/unfinished ticket "+StringFormat("%I64u",ticket));
         ConfigureFilling();
         if(gTrade.PositionClose(ticket,InpMaxDeviationPoints) && gTrade.ResultRetcode()==TRADE_RETCODE_DONE &&
            !PositionSelectByTicket(ticket) && SaveDone(plan.key,"PROTECTION_FAILURE_CLOSED")) RemovePlan(i);
      }
   }
}

// Return true for a terminal outcome, false ONLY for spread/quote transients.
bool ExecuteSetup(const Setup &setup,const datetime now)
{
   if(!gAuto) { gWeeklyStats.blocked_auto++; Report("M5 reclaim observed; Autopilot OFF"); return true; }
   if(!gConfigReady || gRecoveryBlocked || ArraySize(gPlans)>0 || HaveOwnWorkingOrder() ||
      (InpLotMode==LOT_MODIFIED_DALEMBERT && !gDAReady))
      { gWeeklyStats.blocked_gate++; Report("Entry skipped: configuration/recovery/order/DA guard"); return true; }
   if(InpDemoOnly && AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL)
      { gWeeklyStats.blocked_gate++; Report("Entry skipped: demo-only preset"); return true; }
   if(!ConfigureFilling()) { gWeeklyStats.blocked_gate++; Report("Unsupported broker fill"); return true; }
   if(!EntryWindow(now) || setup.signal_id!=gSignal.id || setup.direction!=gSignal.direction ||
      !TradingPermitted(setup.direction,now))
      { gWeeklyStats.blocked_gate++; Report("Entry skipped: invalid astrology window/session"); return true; }
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol,tick) || tick.time!=now || (tick.ask-tick.bid)/_Point>CB22_MAX_SPREAD+1e-8)
      { gWeeklyStats.blocked_spread++; Report("M5 reclaim transient quote/spread block"); return false; }
   double a[1];
   if(BarsCalculated(gATR)<CB22_ATR_PERIOD+1 || CopyBuffer(gATR,0,1,1,a)!=1 || a[0]<=0)
      { gWeeklyStats.blocked_gate++; Report("Entry skipped: closed M5 ATR unavailable"); return true; }
   if((setup.direction==1 && tick.bid<=setup.extreme) ||
      (setup.direction==-1 && tick.ask>=setup.extreme))
      { gWeeklyStats.blocked_gate++; Report("M5 reclaim invalidated by price crossing sweep extreme"); return true; }
   double entry=setup.direction==1?tick.ask:tick.bid,sl=0,tp=0,risk=0;
   if(!CB22_Risk(setup.direction,entry,setup.extreme,a[0],
      SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE),sl,tp,risk) ||
      !CB22_StopsValid(setup.direction,sl,tp,tick.bid,tick.ask,
                      (double)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*_Point))
      { gWeeklyStats.blocked_gate++; Report("Entry skipped: invalid hybrid stop/TP/stop-level"); return true; }
   double volume=ResolveOrderLot();
   if(volume<=0 || !RiskBudget(0,setup.direction,volume,entry,sl))
      { gWeeklyStats.blocked_risk++; Report("Entry skipped: layer/risk budget"); return true; }
   ENUM_ORDER_TYPE type=setup.direction==1?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
   double margin=0;
   if(!OrderCalcMargin(type,_Symbol,volume,entry,margin) || margin>AccountInfoDouble(ACCOUNT_MARGIN_FREE))
      { gWeeklyStats.blocked_risk++; Report("Entry skipped: insufficient margin"); return true; }
   // Reserve basket BEFORE the durable claim. Never continue if the state cannot be persisted.
   if(!ReserveDABasket(volume))
      { gWeeklyStats.blocked_gate++; Report("Entry skipped: DA reservation failure"); return true; }
   EntryPlan plan;
   if(!ClaimPlan(setup,a[0],volume,plan))
      { gWeeklyStats.blocked_gate++; Report("Entry skipped: duplicate or inaccessible durable claim"); return true; }
   int n=ArraySize(gPlans); ArrayResize(gPlans,n+1); gPlans[n]=plan;
   string comment=CB22_PREFIX+plan.key;
   gWeeklyStats.orders++;
   bool sent=setup.direction==1?
      gTrade.Buy(volume,_Symbol,entry,NormalizeDouble(sl,_Digits),NormalizeDouble(tp,_Digits),comment):
      gTrade.Sell(volume,_Symbol,entry,NormalizeDouble(sl,_Digits),NormalizeDouble(tp,_Digits),comment);
   uint retcode=gTrade.ResultRetcode();
   gPlans[n].order=gTrade.ResultOrder();
   if(retcode==TRADE_RETCODE_DONE || retcode==TRADE_RETCODE_DONE_PARTIAL)
      gPlans[n].confirmed_volume=gTrade.ResultVolume();
   if(gPlans[n].confirmed_volume<=0 && retcode==TRADE_RETCODE_DONE && gPlans[n].filling==CB22_FILL_FOK)
      gPlans[n].confirmed_volume=plan.volume;
   if(!SaveFillReceipt(gPlans[n])) Print("CB22 fill receipt unavailable; durable claim still prevents resubmission");
   if(retcode!=TRADE_RETCODE_DONE && retcode!=TRADE_RETCODE_PLACED &&
      retcode!=TRADE_RETCODE_DONE_PARTIAL && retcode!=TRADE_RETCODE_TIMEOUT &&
      retcode!=TRADE_RETCODE_CONNECTION && retcode!=TRADE_RETCODE_ERROR && gTrade.ResultDeal()==0)
   {
      if(SaveDone(plan.key,"REJECTED")) RemovePlan(n);
      Report("Order rejected: "+gTrade.ResultRetcodeDescription());
      return true;
   }
   if(retcode==TRADE_RETCODE_DONE_PARTIAL && gPlans[n].filling==CB22_FILL_FOK) gPlans[n].emergency=true;
   if(!sent) Report("Order outcome requires reconciliation: "+gTrade.ResultRetcodeDescription());
   FinalizeEntries();
   return true;
}
void TryPendingReclaim(const datetime now)
{
   if(!gPending.active) return;
   datetime current=iTime(_Symbol,PERIOD_M5,0);
   if(now<gPending.reclaim_closed || current!=gPending.bar_open ||
      now>=gPending.reclaim_closed+InpReclaimExecutionGraceSeconds ||
      now>=gPending.reclaim_closed+300 || !EntryWindow(now))
      { Report("M5 reclaim intent expired; no delayed entry"); gPending.active=false; return; }
   if(ExecuteSetup(gPending.setup,now)) gPending.active=false;
}

void ProcessClosedBar(const MqlRates &bar,const MqlRates &previous,const datetime now)
{
   // Scanner runs outside the Astro window while weekly direction is known.
   // Only a freshly closed reclaim candle inside the published window may trigger entry.
   bool ready=BuildLevels(bar.time);
   Setup s;
   if(!(ready || gSweep.active))
   {
      Report("Waiting for either H1 or H4 liquidity history");
      return;
   }
   if(!DetectSweep(bar,previous,s)) return;
   datetime close_time=bar.time+300;
   if(!EntryWindow(close_time) || !EntryWindow(now) ||
      s.signal_id!=gSignal.id || s.direction!=gSignal.direction)
   {
      gWeeklyStats.reclaim_outside++;
      Report("M5 reclaim outside Astrology window; setup consumed without chasing");
      return;
   }
   gWeeklyStats.reclaim_in_window++;
   if(gPending.active)
   {
      gWeeklyStats.blocked_gate++;
      Report("Concurrent M5 reclaim ignored; one pending execution at a time");
      return;
   }
   gPending.active=true; gPending.setup=s;
   gPending.reclaim_closed=close_time; gPending.bar_open=close_time;
   gPending.detected=now;
   if(InpReclaimExecutionGraceSeconds==0)
   {
      // One immediate attempt when retry grace is disabled.
      ExecuteSetup(s,now);
      gPending.active=false;
   }
   else TryPendingReclaim(now);
}

void DisplayStatus()
{
   int count; double risk;
   bool exposure=Exposure(0,count,risk);
   if(MQLInfoInteger(MQL_TESTER) && exposure)
   {
      if(count>gTesterPeakLayers) gTesterPeakLayers=count;
      if(risk>gTesterPeakRisk) gTesterPeakRisk=risk;
   }
   string bias=gSignalActive?(gSignal.direction==1?"BUY":"SELL"):"INACTIVE";
   Comment("\n\n\n\nCEBONK COMPANY 22 | MT5 v3.03\n",
      "Autopilot: ",AutopilotText()," | ",gConfigReady?"Configured":gConfigReason,"\n",
      "Scanner H1: ",InpScanH1?(gH1Ready?"READY":"LOADING"):"OFF"," (",gH1Bars,
      ") | H4: ",InpScanH4?(gH4Ready?"READY":"LOADING"):"OFF"," (",gH4Bars,
      ") | fill ",gFilling==CB22_FILL_IOC?"IOC":(gFilling==CB22_FILL_FOK?"FOK":"UNSUPPORTED"),"\n",
      "Astrology: ",bias," | ",gSignalActive?gSignal.id:"-",
      " | Entry window: ",gEntryWindowOpen?"OPEN":"CLOSED","\n",
      "Window: ",gSignalActive?TimeToString(gSignal.core_from,TIME_DATE|TIME_MINUTES):"-"," -> ",
      gSignalActive?TimeToString(gSignal.core_until,TIME_DATE|TIME_MINUTES):"-"," (server)\n",
      "Inti: ",gSignalActive?TimeToString(gSignal.core_at,TIME_DATE|TIME_MINUTES):"-"," (server)\n",
      "Entry: M5 SWEEP + CLOSE RECLAIM (NO IB/CB1)",
      " | Pending retry: ",gPending.active?"YES":"NO","\n",
      "Lot: ",InpLotMode==LOT_FIXED?"FIXED":"D'ALEMBERT",
      " | level: ",gDALevel," | next/current: ",DoubleToString(ResolveOrderLot(),2),
      " | basket: ",gDAActive?"ACTIVE":"FLAT","\n",
      "Layers: ",count,"/",InpMaxLayers," | gross stop risk: ",exposure?DoubleToString(risk,2):"UNKNOWN",
      " ",AccountInfoString(ACCOUNT_CURRENCY),"\n",gStatus);
}

int OnInit()
{
   gTrade.SetExpertMagicNumber(InpMagic);
   gTrade.SetDeviationInPoints(InpMaxDeviationPoints);
   ConfigureFilling();
   gTrade.SetAsyncMode(false);
   gAuto=InpEnableTrading;
   string context=AccountInfoString(ACCOUNT_SERVER)+"|"+_Symbol+"|"+StringFormat("%I64u",InpMagic);
   // Tester claims must not pollute live account state or unrelated test passes.
   string run_identity=TerminalInfoString(TERMINAL_DATA_PATH)+"|"+
      StringFormat("%I64d|%I64u|%I64u",(long)TimeLocal(),GetMicrosecondCount(),GetTickCount64());
   gSessionId=HashKey(run_identity);
   string scope=MQLInfoInteger(MQL_TESTER)?"TEST_"+HashKey(run_identity)+"_":"LIVE_";
   gStatePrefix="CB22_"+scope+StringFormat("%I64d",AccountInfoInteger(ACCOUNT_LOGIN))+"_"+HashKey(context)+"_";
   if(!MQLInfoInteger(MQL_TESTER))
   {
      gInstanceLock=FileOpen(gStatePrefix+"instance.lock",FILE_READ|FILE_WRITE|FILE_BIN|FILE_COMMON);
      if(gInstanceLock==INVALID_HANDLE)
         { Report("Another EA instance holds this symbol/account/magic lock"); return INIT_FAILED; }
   }
   gConfigReady=ValidateConfiguration(gConfigReason);
   gATR=iATR(_Symbol,PERIOD_M5,CB22_ATR_PERIOD);
   if(gATR==INVALID_HANDLE)
      { if(gInstanceLock!=INVALID_HANDLE) FileClose(gInstanceLock); gInstanceLock=INVALID_HANDLE;
        Report("ATR handle creation failed"); return INIT_FAILED; }
   gCurrentBar=iTime(_Symbol,PERIOD_M5,0);
   RecoverPendingPlans(); RecoverPositions(); FinalizeEntries();
   gDAReady=LoadDAState();
   if(InpLotMode==LOT_MODIFIED_DALEMBERT && !gDAReady)
      Report("D'Alembert state unavailable / legacy exposure: new entries BLOCKED");
   if(!gConfigReady) Report("Required configuration: "+gConfigReason);
   CreateAutopilot();
   if(InpTelegram && (InpTelegramToken=="" || InpTelegramChatID==""))
      Print("CB22 Telegram not configured: fill token/chat ID inputs; trading stays independent");
   QueueNotice("AUTO_START_"+gSessionId,"CB22 v3.03 "+_Symbol+"\nAutopilot "+AutopilotText()+
      "\nDemo-only "+(InpDemoOnly?"YES":"NO")+" | server UTC offset "+IntegerToString(InpBrokerUTCOffsetMinutes)+" minutes");
   EventSetTimer(1); DisplayStatus();
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason)
{
   SaveWeeklyReport(gWeeklyStatsId);
   EventKillTimer(); if(gATR!=INVALID_HANDLE) IndicatorRelease(gATR); Comment("");
   if(gInstanceLock!=INVALID_HANDLE) FileClose(gInstanceLock);
   if(gButton!="") ObjectDelete(0,gButton);
}
void OnTimer()
{
   RecoverPositions(); FinalizeEntries(); ReconcileDABasket();
   // Calendar validity on ticks uses broker server time; a timer cannot create entries.
   DisplayStatus();
   FlushNotices();
}
void OnTick()
{
   datetime now=TimeCurrent();
   RecoverPositions(); FinalizeEntries();
   if(!gConfigReady) { DisplayStatus(); return; }
   RefreshSignal(now);
   if(!gSignalActive) { gCurrentBar=iTime(_Symbol,PERIOD_M5,0); DisplayStatus(); return; }
   ReconcileDABasket();
   datetime current=iTime(_Symbol,PERIOD_M5,0);
   if(current>0 && current!=gCurrentBar)
   {
      datetime old=gCurrentBar; gCurrentBar=current;
      MqlRates r[]; ArraySetAsSeries(r,true);
      if(old==0 || current-old!=300 || CopyRates(_Symbol,PERIOD_M5,0,3,r)!=3 ||
         r[1].time+300!=current || r[2].time+300!=r[1].time)
         ClearSetups("M5 data gap/market reopening; stale signals skipped");
      else if(r[1].time<gSignal.valid_from || r[1].time+300>gSignal.valid_until)
         ClearSetups("Closed candle outside weekly validity");
      else if(InpScanOutsideAstroWindow || EntryWindow(r[1].time+300))
         ProcessClosedBar(r[1],r[2],now);
   }
   TryPendingReclaim(now);
   DisplayStatus();
}
void OnTradeTransaction(const MqlTradeTransaction &transaction,
                        const MqlTradeRequest &request,const MqlTradeResult &result)
{
   // Broker events are reconciled by the next tick/timer; no setup is resubmitted.
   if(transaction.type!=TRADE_TRANSACTION_DEAL_ADD) return;
   RecoverPositions();
   if(transaction.deal==0 || !HistoryDealSelect(transaction.deal)) return;
   if(HistoryDealGetString(transaction.deal,DEAL_SYMBOL)!=_Symbol ||
      (ulong)HistoryDealGetInteger(transaction.deal,DEAL_MAGIC)!=InpMagic) return;
   long entry=HistoryDealGetInteger(transaction.deal,DEAL_ENTRY);
   if(entry!=DEAL_ENTRY_OUT && entry!=DEAL_ENTRY_OUT_BY) return;
   long reason=HistoryDealGetInteger(transaction.deal,DEAL_REASON);
   if(reason!=DEAL_REASON_SL && reason!=DEAL_REASON_TP) return;
   string event=reason==DEAL_REASON_TP?"TAKE PROFIT":"STOP LOSS";
   string side=HistoryDealGetInteger(transaction.deal,DEAL_TYPE)==DEAL_TYPE_SELL?"BUY":"SELL";
   QueueNotice("EXIT_"+StringFormat("%I64u",transaction.deal),"CB22 "+event+" "+side+" "+_Symbol+
      "\nDeal "+StringFormat("%I64u",transaction.deal)+" | position "+
      StringFormat("%I64d",HistoryDealGetInteger(transaction.deal,DEAL_POSITION_ID))+
      "\nLot "+DoubleToString(HistoryDealGetDouble(transaction.deal,DEAL_VOLUME),8)+
      " | exit "+DoubleToString(HistoryDealGetDouble(transaction.deal,DEAL_PRICE),_Digits)+
      "\nProfit deal (gross) "+DoubleToString(HistoryDealGetDouble(transaction.deal,DEAL_PROFIT),2)+
      " "+AccountInfoString(ACCOUNT_CURRENCY));
}
void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam)
{
   if(id!=CHARTEVENT_OBJECT_CLICK || gButton=="" || sparam!=gButton) return;
   gAuto=!gAuto; gAutoChanges++;
   PaintAutopilot();
   Report("Autopilot "+AutopilotText());
   DisplayStatus();
   QueueNotice("AUTO_"+gSessionId+"_"+IntegerToString(gAutoChanges),
      "CB22 AUTOPILOT "+AutopilotText()+"\n"+_Symbol+" | new entries "+
      (gAuto?(gConfigReady?"enabled":"blocked"):"disabled")+
      "\nExisting layer SL/TP remain fixed");
}

double OnTester()
{
   string deals_file=gStatePrefix+"BacktestDeals.csv";
   string summary_file=gStatePrefix+"BacktestSummary.csv";
   int h=FileOpen(deals_file,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,';',CP_UTF8);
   if(h!=INVALID_HANDLE)
   {
      FileWrite(h,"time_server","time_msc","deal","position_id","symbol","entry","side","volume",
         "price","profit","swap","commission","fee","reason");
      if(HistorySelect(0,TimeCurrent()+86400))
         for(int i=0;i<HistoryDealsTotal();i++)
         {
            ulong deal=HistoryDealGetTicket(i);
            if(HistoryDealGetString(deal,DEAL_SYMBOL)!=_Symbol ||
               (ulong)HistoryDealGetInteger(deal,DEAL_MAGIC)!=InpMagic) continue;
            long type=HistoryDealGetInteger(deal,DEAL_TYPE);
            if(type!=DEAL_TYPE_BUY && type!=DEAL_TYPE_SELL) continue;
            FileWrite(h,TimeToString((datetime)HistoryDealGetInteger(deal,DEAL_TIME),TIME_DATE|TIME_SECONDS),
               StringFormat("%I64d",HistoryDealGetInteger(deal,DEAL_TIME_MSC)),StringFormat("%I64u",deal),
               StringFormat("%I64d",HistoryDealGetInteger(deal,DEAL_POSITION_ID)),_Symbol,
               EnumToString((ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal,DEAL_ENTRY)),type==DEAL_TYPE_BUY?"BUY":"SELL",
               DoubleToString(HistoryDealGetDouble(deal,DEAL_VOLUME),8),
               DoubleToString(HistoryDealGetDouble(deal,DEAL_PRICE),_Digits),
               DoubleToString(HistoryDealGetDouble(deal,DEAL_PROFIT),8),
               DoubleToString(HistoryDealGetDouble(deal,DEAL_SWAP),8),
               DoubleToString(HistoryDealGetDouble(deal,DEAL_COMMISSION),8),
               DoubleToString(HistoryDealGetDouble(deal,DEAL_FEE),8),
               EnumToString((ENUM_DEAL_REASON)HistoryDealGetInteger(deal,DEAL_REASON)));
         }
      FileFlush(h); FileClose(h);
   }
   h=FileOpen(summary_file,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,';',CP_UTF8);
   if(h!=INVALID_HANDLE)
   {
      FileWrite(h,"metric","value");
      FileWrite(h,"currency",AccountInfoString(ACCOUNT_CURRENCY));
      FileWrite(h,"net_profit",DoubleToString(TesterStatistics(STAT_PROFIT),8));
      FileWrite(h,"equity_drawdown_money",DoubleToString(TesterStatistics(STAT_EQUITY_DD),8));
      FileWrite(h,"equity_drawdown_percent",DoubleToString(TesterStatistics(STAT_EQUITY_DDREL_PERCENT),8));
      FileWrite(h,"peak_layers",IntegerToString(gTesterPeakLayers));
      FileWrite(h,"peak_gross_stop_risk_money",DoubleToString(gTesterPeakRisk,8));
      FileFlush(h); FileClose(h);
   }
   Print("CB22 tester exports in Common/Files: ",deals_file," and ",summary_file);
   return TesterStatistics(STAT_PROFIT);
}
