// CEBONK COMPANY 22 | LIQUIDITY SWEEP SIGNAL EA | v1.00
// Web-aligned Liquidity: TF1 map -> TF2 sweep+displacement+break -> TF3 retest.
// Closed candles only. Astrology is master direction/time. No OrderSend: signal + Telegram/MT5 notification only.
#property strict
#property version "1.00"
#property description "CEBONK LIQUIDITY SWEEP SIGNAL EA. Closed-candle scanner; Telegram/MT5 notification; no trade execution."
#property tester_file "CEBONK_C2_ASTRO.csv"
#property tester_file "CEBONK_C2_NEWS.csv"

#include "LSCore.mqh"
#include "LSAstroNews.mqh"
#include "LSNotify.mqh"

input group "01 | SCANNER"
input string InpSymbol="XAUUSDc";
input bool InpScannerOn=true;
input double InpRR=2.0;
input double InpSLBufferPrice=0.20;
input int InpHistoryBars=120;
input int InpInstanceID=221023;

input group "02 | ASTROLOGY WEB MASTER"
input BW_ASTRO_SOURCE InpAstroSource=BW_ASTRO_WEB_MONTH;
input string InpAstroBaseURL="https://enggarprasetiyodaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/ea/combined2/data/";
input string InpAstroCSV="CEBONK_C2_ASTRO.csv";
input bool InpCSVCommonFolder=false;
input bool InpAcceptExperimentalAstro=true;
input int InpHTTPTimeoutMs=3000;
input bool InpLiveAutoServerUTC=true;
input int InpServerUTCMinutes=180;

input group "03 | ASTROLOGY NEWS OVERRIDE"
input bool InpUseAstrologyNews=true;
input BW_NEWS_SOURCE InpNewsSource=BW_NEWS_MT5_CALENDAR;
input string InpNewsCSV="CEBONK_C2_NEWS.csv";
input bool InpAllowNewsCSVReplay=false;
input int InpNewsPreMinutes=30;
input int InpNewsPostMinutes=120;
input int InpNewsBlockBeforeMinutes=5;
input int InpNewsBlockAfterMinutes=5;
input int InpNewsEntrySpanMinutes=10;
input int InpNewsMinWindowMinutes=15;
input int InpNewsPollSeconds=60;
input int InpNewsMaxCacheSeconds=180;

input group "04 | TELEGRAM / MT5"
input bool InpTelegram=true;
input string InpTelegramToken="";
input string InpTelegramChatID="";
input bool InpMT5Push=true;
input bool InpTelegramTestOnStart=true;

bool gTester=false,gScanner=false;
string gButton="",gScope="",gLastStatus="",gLastSignalKey="";
long gM1=0,gM5=0,gM15=0,gM30=0,gH1=0,gH4=0;

void LSPaint(){
 if(ObjectFind(0,gButton)<0)return;
 ObjectSetString(0,gButton,OBJPROP_TEXT,gScanner?"SCANNER ON":"SCANNER OFF");
 ObjectSetInteger(0,gButton,OBJPROP_BGCOLOR,gScanner?clrDarkGreen:clrFireBrick);
 ObjectSetInteger(0,gButton,OBJPROP_STATE,false);
}
void LSStatus(const string s){
 if(gLastStatus==s)return;gLastStatus=s;Print("LIQUIDITY SWEEP | ",s);
 if(ObjectFind(0,gButton)>=0)ObjectSetString(0,gButton,OBJPROP_TOOLTIP,s);
}
bool LSInputsOK(){
 if(InpSymbol==""||InpRR<1.0||InpRR>10.0||InpSLBufferPrice<0||InpHistoryBars<40||InpHistoryBars>1000||InpInstanceID<=0)return false;
 if(InpHTTPTimeoutMs<500)return false;
 if(InpNewsPreMinutes<5||InpNewsPreMinutes>120||InpNewsPostMinutes<30||InpNewsPostMinutes>360)return false;
 if(InpNewsBlockBeforeMinutes<0||InpNewsBlockBeforeMinutes>60||InpNewsBlockAfterMinutes<0||InpNewsBlockAfterMinutes>60)return false;
 if(InpNewsEntrySpanMinutes<5||InpNewsEntrySpanMinutes>60||InpNewsMinWindowMinutes<5||InpNewsMinWindowMinutes>60)return false;
 if(InpNewsPollSeconds<15||InpNewsPollSeconds>120||InpNewsMaxCacheSeconds<InpNewsPollSeconds||InpNewsMaxCacheSeconds>600)return false;
 return true;
}
int LSCount(const bool a[]){int n=0;for(int i=0;i<BW_PACKAGE_COUNT;i++)if(a[i])n++;return n;}
string LSPackages(const bool buy[],const bool sell[],const int dir){
 string s="";
 for(int i=0;i<BW_PACKAGE_COUNT;i++){
  bool ok=dir>0?buy[i]:sell[i];if(!ok)continue;
  BWPackageSpec p;BWGetPackage(i,p);if(s!="")s+=" + ";s+=p.id;
 }
 return s;
}
int LSChooseLatest(const BWSignal &signals[],const bool flags[]){
 int chosen=-1;
 for(int i=0;i<BW_PACKAGE_COUNT;i++){
  if(!flags[i])continue;
  if(chosen<0||signals[i].eventAt>signals[chosen].eventAt||
    (signals[i].eventAt==signals[chosen].eventAt&&signals[i].reAt>signals[chosen].reAt))chosen=i;
 }
 return chosen;
}
bool LSSignalConsumed(const string key){
 if(gLastSignalKey==key)return true;
 return !gTester&&GlobalVariableCheck(gScope+key);
}
void LSReserveSignal(const string key){
 gLastSignalKey=key;
 if(!gTester){GlobalVariableSet(gScope+key,(double)TimeCurrent());GlobalVariablesFlush();}
}

void LSEvaluate(){
 if(!gScanner){LSStatus("SCANNER_OFF");return;}
 long nowServer=(long)TimeTradeServer();if(nowServer<=0)nowServer=(long)TimeCurrent();
 long nowUtc=BWNowUTC(gTester,InpLiveAutoServerUTC,InpServerUTCMinutes);

 bool buy[BW_PACKAGE_COUNT],sell[BW_PACKAGE_COUNT];
 BWSignal bs[BW_PACKAGE_COUNT],ss[BW_PACKAGE_COUNT];
 for(int i=0;i<BW_PACKAGE_COUNT;i++){
  buy[i]=false;sell[i]=false;string wb="",ws="";
  buy[i]=BWScanDirection(InpSymbol,i,1,nowServer,InpRR,InpSLBufferPrice,InpHistoryBars,bs[i],wb);
  sell[i]=BWScanDirection(InpSymbol,i,-1,nowServer,InpRR,InpSLBufferPrice,InpHistoryBars,ss[i],ws);
 }
 int bc=LSCount(buy),sc=LSCount(sell);
 if(bc>0&&sc>0){LSStatus("LIQUIDITY_PACKAGE_CONFLICT_BUY_SELL");return;}
 if(bc==0&&sc==0){LSStatus("LIQUIDITY_WAIT_NO_VALID_PACKAGE");return;}

 int dir=bc>0?1:-1;bool flags[BW_PACKAGE_COUNT];BWSignal sigs[BW_PACKAGE_COUNT];
 for(int i=0;i<BW_PACKAGE_COUNT;i++){
  flags[i]=dir>0?buy[i]:sell[i];if(dir>0)sigs[i]=bs[i];else sigs[i]=ss[i];
 }
 int chosen=LSChooseLatest(sigs,flags);if(chosen<0)return;
 BWSignal sig=sigs[chosen];long eventUtc=BWServerToUTC(sig.eventAt,gTester,InpLiveAutoServerUTC,InpServerUTCMinutes);

 bool newsMode=false;string gate="";
 if(InpUseAstrologyNews){
  if(!BWNewsHealthy(gTester,InpNewsSource,InpNewsMaxCacheSeconds,InpLiveAutoServerUTC,InpServerUTCMinutes)){
   LSStatus("NEWS_DATA_WAIT_FAIL_CLOSED: "+gBWNewsError);return;
  }
  BWNewsGate ng=BWBuildNewsGate(nowUtc,InpNewsPreMinutes,InpNewsPostMinutes,InpNewsBlockBeforeMinutes,InpNewsBlockAfterMinutes,InpNewsEntrySpanMinutes,InpNewsMinWindowMinutes,InpAcceptExperimentalAstro);
  if(ng.episode){
   newsMode=true;if(!ng.candidate){LSStatus(ng.reason);return;}
   if(dir!=ng.dir){LSStatus("ASTROLOGY_NEWS_DIRECTION_MISMATCH");return;}
   if(eventUtc<ng.windowStart||eventUtc>=ng.entryEnd){LSStatus("TECHNICAL_EVENT_OUTSIDE_ASTROLOGY_NEWS_ENTRY_WINDOW");return;}
   gate="ASTROLOGY NEWS "+BWSide(dir)+" | "+ng.names+" | "+BWWIB(ng.windowStart)+" -> "+BWWIB(ng.entryEnd);
  }
 }
 if(!newsMode&&!BWAstroNormalGate(nowUtc,eventUtc,dir,InpAcceptExperimentalAstro,gate)){LSStatus(gate);return;}

 string mode=newsMode?"NEWS":"NORMAL";
 string key="S."+(string)sig.pkg+"."+(string)dir+"."+(string)sig.reAt+"."+(string)sig.eventAt+"."+mode;
 if(LSSignalConsumed(key)){LSStatus("SIGNAL_ALREADY_NOTIFIED");return;}
 LSReserveSignal(key);

 BWPackageSpec p;BWGetPackage(sig.pkg,p);
 int digits=(int)SymbolInfoInteger(InpSymbol,SYMBOL_DIGITS),count=dir>0?bc:sc;
 double risk=MathAbs(sig.referenceEntry-sig.structuralSL);
 double refTP=dir>0?sig.referenceEntry+risk*InpRR:sig.referenceEntry-risk*InpRR;
 string strength=count>1?"STRONG CONFLUENCE":"VALID";
 string text=strength+" "+BWSide(dir)+" | "+mode+"\nPackages: "+LSPackages(buy,sell,dir)+"\n"+
  "TF1 "+p.id+" "+sig.liquidityType+" @ "+DoubleToString(sig.liquidity,digits)+"\n"+
  "TF2 SWEEP -> DISPLACEMENT -> BREAK @ "+DoubleToString(sig.structure,digits)+"\n"+
  "TF3 RETEST close: "+BWWIB(eventUtc)+"\n"+gate+
  "\nReference close: "+DoubleToString(sig.referenceEntry,digits)+
  "\nReference SL sweep: "+DoubleToString(sig.structuralSL,digits)+
  "\nReference TP RR 1:"+DoubleToString(InpRR,2)+": "+DoubleToString(refTP,digits)+
  "\nSIGNAL ONLY - ora ngirim order.";
 LSNotice("LIQUIDITY_SIGNAL",text,InpSymbol,gTester,gScanner);
 LSStatus("SIGNAL_NOTIFIED");
}

bool LSPulse(){
 long m1=(long)iTime(InpSymbol,PERIOD_M1,0),m5=(long)iTime(InpSymbol,PERIOD_M5,0),m15=(long)iTime(InpSymbol,PERIOD_M15,0);
 long m30=(long)iTime(InpSymbol,PERIOD_M30,0),h1=(long)iTime(InpSymbol,PERIOD_H1,0),h4=(long)iTime(InpSymbol,PERIOD_H4,0);
 bool changed=(m1>0&&m1!=gM1)||(m5>0&&m5!=gM5)||(m15>0&&m15!=gM15)||
              (m30>0&&m30!=gM30)||(h1>0&&h1!=gH1)||(h4>0&&h4!=gH4);
 gM1=m1;gM5=m5;gM15=m15;gM30=m30;gH1=h1;gH4=h4;return changed;
}
void LSHeartbeat(){
 BWAstroPoll(gTester,InpAstroSource,InpAstroBaseURL,InpAstroCSV,InpCSVCommonFolder,InpHTTPTimeoutMs,InpLiveAutoServerUTC,InpServerUTCMinutes);
 if(InpUseAstrologyNews)BWNewsPoll(gTester,InpNewsSource,InpNewsCSV,InpCSVCommonFolder,InpAllowNewsCSVReplay,InpNewsPollSeconds,InpNewsMaxCacheSeconds,InpLiveAutoServerUTC,InpServerUTCMinutes);
 LSFlushNotice(gTester,InpMT5Push,InpTelegram,InpTelegramToken,InpTelegramChatID,InpHTTPTimeoutMs);
}
int OnInit(){
 gTester=(bool)MQLInfoInteger(MQL_TESTER);gScanner=InpScannerOn;
 if(_Symbol!=InpSymbol){Print("Pasang EA neng chart ",InpSymbol,". TF chart bebas.");return INIT_PARAMETERS_INCORRECT;}
 if(!LSInputsOK())return INIT_PARAMETERS_INCORRECT;
 gScope="CEBONK.LS."+(string)AccountInfoInteger(ACCOUNT_LOGIN)+"."+InpSymbol+"."+(string)InpInstanceID+".";
 gButton="CEBONK_LS_SCAN_"+(string)ChartID();
 if(!gTester){
  ObjectCreate(0,gButton,OBJ_BUTTON,0,0,0);ObjectSetInteger(0,gButton,OBJPROP_CORNER,CORNER_RIGHT_UPPER);
  ObjectSetInteger(0,gButton,OBJPROP_XDISTANCE,12);ObjectSetInteger(0,gButton,OBJPROP_YDISTANCE,18);
  ObjectSetInteger(0,gButton,OBJPROP_XSIZE,126);ObjectSetInteger(0,gButton,OBJPROP_YSIZE,30);LSPaint();
 }
 gM1=(long)iTime(InpSymbol,PERIOD_M1,0);gM5=(long)iTime(InpSymbol,PERIOD_M5,0);gM15=(long)iTime(InpSymbol,PERIOD_M15,0);
 gM30=(long)iTime(InpSymbol,PERIOD_M30,0);gH1=(long)iTime(InpSymbol,PERIOD_H1,0);gH4=(long)iTime(InpSymbol,PERIOD_H4,0);
 EventSetTimer(1);LSHeartbeat();
 LSNotice("EA_STARTED","LIQUIDITY SWEEP v1.00 | SIGNAL ONLY | closed candle | Astrology News "+(InpUseAstrologyNews?"ON":"OFF"),InpSymbol,gTester,gScanner);
 if(InpTelegramTestOnStart)LSNotice("TELEGRAM_TEST","Tes notifikasi. Ora ana order.",InpSymbol,gTester,gScanner);
 return INIT_SUCCEEDED;
}
void OnDeinit(const int reason){EventKillTimer();if(ObjectFind(0,gButton)>=0)ObjectDelete(0,gButton);}
void OnTimer(){LSHeartbeat();if(LSPulse())LSEvaluate();}
void OnTick(){}
void OnChartEvent(const int id,const long &l,const double &d,const string &s){
 if(id==CHARTEVENT_OBJECT_CLICK&&s==gButton){gScanner=!gScanner;LSPaint();LSNotice("SCANNER",gScanner?"ON":"OFF",InpSymbol,gTester,gScanner);}
}
