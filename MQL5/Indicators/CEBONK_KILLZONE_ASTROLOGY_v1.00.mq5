#property strict
#property version "1.00"
#property indicator_chart_window
#property indicator_plots 0
#property indicator_buffers 0
#property description "Standalone CEBONK Astrology Killzone: five independent session forecasts"
#include <CebonkKillzone/Forecast.mqh>

input string InpForecastFile="cebonk-killzone-forecast-v1.json";
input string InpDateWIB=""; // Blank follows today, or next weekday on weekends; YYYY-MM-DD selects a date.
input int InpBrokerUtcOffsetMinutes=2147483647; // AUTO; set real broker offset in minutes if automatic clock is unavailable.
input int InpHistoryDays=3; // Number of trading dates drawn, including the selected date.
input bool InpSydney=true;
input bool InpTokyo=true;
input bool InpLondonOpen=true;
input bool InpNewYorkOpen=true;
input bool InpLondonClose=true;
input bool InpShowPanel=true;
input bool InpShowSessionBoxes=true;
input bool InpShowAllWindows=false; // False highlights only the dominant focus window of each session.
input bool InpShowCoreLines=true;
input int InpPanelX=12;
input int InpPanelY=12;
input int InpFontSize=9;
input color InpBuyColor=clrLimeGreen;
input color InpSellColor=clrTomato;
input color InpSessionColor=clrSlateGray;
input color InpBuyFill=C'16,58,39';
input color InpSellFill=C'67,27,32';

CKAForecast Forecast;
string Prefix,LastRaw="",ClockStatus="STARTING",NavStatus="";
datetime NowUTC=0,SelectedDate=0;
int BrokerOffset=0;
bool ClockVerified=false,FollowToday=true,InDraw=false,FirstCalculation=true;
bool Enabled(int i){return i==0?InpSydney:i==1?InpTokyo:i==2?InpLondonOpen:i==3?InpNewYorkOpen:InpLondonClose;}
color DirectionColor(int side){return side>0?InpBuyColor:side<0?InpSellColor:clrSilver;}
string WIB(datetime t){return TimeToString(t+25200,TIME_MINUTES);}
string OffsetText(){int magnitude=(int)MathAbs((double)BrokerOffset);return "UTC"+(BrokerOffset<0?"-":"+")+StringFormat("%02d:%02d",magnitude/60,magnitude%60);}
void RefreshClock(){
 ClockVerified=false;bool tester=(bool)MQLInfoInteger(MQL_TESTER);
 if(InpBrokerUtcOffsetMinutes!=2147483647){
  BrokerOffset=InpBrokerUtcOffsetMinutes;NowUTC=tester?TimeCurrent()-BrokerOffset*60:TimeGMT();
  ClockVerified=NowUTC>=1577836800;ClockStatus=ClockVerified?"BROKER OFFSET MANUAL":"CLOCK_UNVERIFIED";return;
 }
 if(tester){NowUTC=0;ClockStatus="TESTER_REQUIRES_BROKER_UTC_OFFSET";return;}
 NowUTC=TimeGMT();if(!TerminalInfoInteger(TERMINAL_CONNECTED)||NowUTC<1577836800){ClockStatus="AUTO OFFSET: CONNECT BROKER OR SET MANUAL";return;}
 long difference=(long)(TimeTradeServer()-NowUTC);BrokerOffset=(int)MathRound((double)difference/900.0)*15;
 if(BrokerOffset<-840||BrokerOffset>840||MathAbs((double)(difference-BrokerOffset*60))>30){ClockStatus="AUTO OFFSET UNVERIFIED: SET MANUAL";return;}
 ClockVerified=true;ClockStatus="BROKER OFFSET AUTO (CURRENT)";
}
void LoadForecast(){
 int handle=FileOpen(InpForecastFile,FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE,0,CP_UTF8);
 if(handle==INVALID_HANDLE){Forecast.Reject("FORECAST_FILE_MISSING: copy MQL5/Files from package");return;}
 if(FileSize(handle)>2097152){FileClose(handle);Forecast.Reject("FORECAST_TOO_LARGE");return;}
 string raw=FileReadString(handle);FileClose(handle);
 if(raw!=LastRaw||!Forecast.healthy){if(Forecast.Accept(raw,NowUTC))LastRaw=raw;}
 if(Forecast.healthy&&Forecast.generated>NowUTC+600)Forecast.Reject("FORECAST_FUTURE");
}
void BaseObject(string key){ObjectSetInteger(0,key,OBJPROP_SELECTABLE,false);ObjectSetInteger(0,key,OBJPROP_HIDDEN,true);}
void Label(string name,string text,int row,color shade){
 string key=Prefix+"UI_label_"+name;ObjectCreate(0,key,OBJ_LABEL,0,0,0);BaseObject(key);
 ObjectSetInteger(0,key,OBJPROP_CORNER,CORNER_LEFT_UPPER);ObjectSetInteger(0,key,OBJPROP_XDISTANCE,InpPanelX+10);
 ObjectSetInteger(0,key,OBJPROP_YDISTANCE,InpPanelY+10+row*(InpFontSize+9));ObjectSetInteger(0,key,OBJPROP_COLOR,shade);
 ObjectSetInteger(0,key,OBJPROP_FONTSIZE,InpFontSize);ObjectSetString(0,key,OBJPROP_FONT,"Consolas");ObjectSetString(0,key,OBJPROP_TEXT,text);
}
void Button(string name,string text,int x,int y,int width){
 string key=Prefix+"UI_"+name;ObjectCreate(0,key,OBJ_BUTTON,0,0,0);BaseObject(key);
 ObjectSetInteger(0,key,OBJPROP_XDISTANCE,x);ObjectSetInteger(0,key,OBJPROP_YDISTANCE,y);ObjectSetInteger(0,key,OBJPROP_XSIZE,width);ObjectSetInteger(0,key,OBJPROP_YSIZE,26);
 ObjectSetInteger(0,key,OBJPROP_BGCOLOR,clrDarkSlateGray);ObjectSetInteger(0,key,OBJPROP_COLOR,clrWhite);ObjectSetInteger(0,key,OBJPROP_STATE,false);
 ObjectSetInteger(0,key,OBJPROP_FONTSIZE,InpFontSize);ObjectSetString(0,key,OBJPROP_TEXT,text);
}
void DrawPanel(){
 ObjectsDeleteAll(0,Prefix+"UI_");if(!InpShowPanel)return;
 int rows=7;for(int i=0;i<5;i++)if(Enabled(i))rows+=2;
 string bg=Prefix+"UI_background";ObjectCreate(0,bg,OBJ_RECTANGLE_LABEL,0,0,0);BaseObject(bg);
 ObjectSetInteger(0,bg,OBJPROP_XDISTANCE,InpPanelX);ObjectSetInteger(0,bg,OBJPROP_YDISTANCE,InpPanelY);ObjectSetInteger(0,bg,OBJPROP_XSIZE,790);
 ObjectSetInteger(0,bg,OBJPROP_YSIZE,rows*(InpFontSize+9)+54);ObjectSetInteger(0,bg,OBJPROP_BGCOLOR,C'17,21,29');ObjectSetInteger(0,bg,OBJPROP_BORDER_TYPE,BORDER_FLAT);
 int row=0;Label("title","CEBONK KILLZONE ASTROLOGY | "+CKADate(SelectedDate)+" WIB",row++,clrWhite);
 Label("clock","UTC "+TimeToString(NowUTC,TIME_DATE|TIME_SECONDS)+" | WIB "+WIB(NowUTC)+" | Chart "+OffsetText(),row++,clrSilver);
 Label("legend","Jam tabel WIB. Kotak/garis chart memakai jam broker. AWAL > INTI > AKHIR",row++,clrSilver);
 for(int i=0;i<5;i++)if(Enabled(i)){
  int at=Forecast.healthy?Forecast.Find(SelectedDate,i):-1;
  if(at<0){Label("session"+IntegerToString(i),CKASessionName(i)+" | "+(!CKAWeekday(SelectedDate)?"WEEKEND":Forecast.Covers(SelectedDate)?"NO SESSION":"DATE OUTSIDE FORECAST"),row++,clrSilver);Label("window"+IntegerToString(i),"AWAL --:-- | INTI --:-- | AKHIR --:--",row++,clrSilver);continue;}
  CKASession s=Forecast.sessions[at];string range=WIB(s.start)+"-"+WIB(s.end)+(CKADate(s.start+25200)!=CKADate(s.end+25200)?" (+1d)":"");
  Label("session"+IntegerToString(i),CKASessionName(i)+" | ASTRO "+CKADirectionText(s.side)+" | SESI "+range+" WIB",row++,DirectionColor(s.side));
  string text;
  if(s.best>=0){CKAWindow w=Forecast.windows[s.best];text="AWAL "+WIB(w.start)+" | INTI "+WIB(w.core)+" | AKHIR "+WIB(w.end)+" | "+CKAPhase(NowUTC,w.start,w.core,w.end)+" | score "+DoubleToString(w.score,2);}
  else text="Tidak ada window dominan | BUY "+IntegerToString(s.buyMinutes)+" m / SELL "+IntegerToString(s.sellMinutes)+" m";
  Label("window"+IntegerToString(i),text,row++,clrWhite);
 }
 Label("meaning","BUY/SELL = arah skor Astro per sesi. Tidak ada konfirmasi harga dalam indikator.",row++,clrSilver);
 string status=!Forecast.healthy?Forecast.error:!Forecast.Covers(SelectedDate)?"UPDATE FORECAST: date outside file horizon":!ClockVerified?ClockStatus:NavStatus!=""?NavStatus:"FORECAST VALID | "+ClockStatus;
 Label("status",status,row++,Forecast.healthy&&Forecast.Covers(SelectedDate)&&ClockVerified?clrPaleGreen:clrOrange);
 string publication=Forecast.healthy?TimeToString(Forecast.generated,TIME_DATE|TIME_MINUTES)+" UTC | "+CKADate(Forecast.horizonStart)+".."+CKADate(Forecast.horizonEnd):"--";
 Label("file","Forecast dibuat "+publication,row++,clrSilver);
 int y=InpPanelY+14+row*(InpFontSize+9);Button("previous","< PREV",InpPanelX+10,y,110);Button("today","TODAY / NEXT WEEKDAY",InpPanelX+130,y,225);Button("next","NEXT >",InpPanelX+365,y,110);
}
void Rectangle(string name,datetime start,datetime end,double low,double high,color shade,bool fill,string tooltip){
 string key=Prefix+"BAND_"+name;ObjectCreate(0,key,OBJ_RECTANGLE,0,CKAToChart(start,BrokerOffset),high,CKAToChart(end,BrokerOffset),low);BaseObject(key);
 ObjectSetInteger(0,key,OBJPROP_COLOR,shade);ObjectSetInteger(0,key,OBJPROP_FILL,fill);ObjectSetInteger(0,key,OBJPROP_BACK,true);ObjectSetString(0,key,OBJPROP_TOOLTIP,tooltip);
}
void DrawWindow(CKASession &s,CKAWindow &w,int ordinal,double low,double high){
 string name=IntegerToString((long)s.date)+"_"+IntegerToString(s.index)+"_"+IntegerToString(ordinal);
 string tooltip=CKASessionName(s.index)+" ASTRO "+CKADirectionText(w.side)+" | AWAL "+WIB(w.start)+" INTI "+WIB(w.core)+" AKHIR "+WIB(w.end)+" WIB | score "+DoubleToString(w.score,3);
 Rectangle(name,w.start,w.end,low,high,w.side>0?InpBuyFill:InpSellFill,true,tooltip);
 if(InpShowCoreLines){string core=Prefix+"BAND_core_"+name;ObjectCreate(0,core,OBJ_VLINE,0,CKAToChart(w.core,BrokerOffset),0);BaseObject(core);ObjectSetInteger(0,core,OBJPROP_COLOR,DirectionColor(w.side));ObjectSetInteger(0,core,OBJPROP_STYLE,STYLE_DOT);ObjectSetInteger(0,core,OBJPROP_BACK,true);ObjectSetString(0,core,OBJPROP_TOOLTIP,tooltip);}
 string text=Prefix+"BAND_text_"+name;ObjectCreate(0,text,OBJ_TEXT,0,CKAToChart(w.start,BrokerOffset),high-(high-low)*(.025+s.index*.035));BaseObject(text);
 ObjectSetInteger(0,text,OBJPROP_ANCHOR,ANCHOR_LEFT_UPPER);ObjectSetInteger(0,text,OBJPROP_COLOR,DirectionColor(w.side));ObjectSetInteger(0,text,OBJPROP_FONTSIZE,8);
 ObjectSetString(0,text,OBJPROP_TEXT,CKASessionName(s.index)+" "+CKADirectionText(w.side));ObjectSetString(0,text,OBJPROP_TOOLTIP,tooltip);
}
void DrawBands(){
 ObjectsDeleteAll(0,Prefix+"BAND_");if(!ClockVerified||!Forecast.Covers(SelectedDate))return;
 double low=ChartGetDouble(0,CHART_PRICE_MIN,0),high=ChartGetDouble(0,CHART_PRICE_MAX,0);if(low<=0||high<=low)return;
 datetime date=SelectedDate;
 for(int d=0;d<InpHistoryDays;d++,date=CKANextTradingDay(date,-1))for(int i=0;i<5;i++)if(Enabled(i)){
  int at=Forecast.Find(date,i);if(at<0)continue;CKASession s=Forecast.sessions[at];
  if(InpShowSessionBoxes)Rectangle("session_"+IntegerToString((long)date)+"_"+IntegerToString(i),s.start,s.end,low,high,InpSessionColor,false,CKASessionName(i)+" session WIB "+WIB(s.start)+"-"+WIB(s.end));
  for(int k=0;k<s.count;k++){int w=s.first+k;if(!InpShowAllWindows&&w!=s.best)continue;CKAWindow window=Forecast.windows[w];DrawWindow(s,window,k,low,high);}
 }
}
void Paint(){if(InDraw)return;InDraw=true;DrawBands();DrawPanel();ChartRedraw();InDraw=false;}
void Refresh(){RefreshClock();LoadForecast();if(FollowToday&&NowUTC>0)SelectedDate=CKAUpcomingDay(NowUTC);Paint();}
int OnInit(){
 if(InpHistoryDays<1||InpHistoryDays>10||InpPanelX<0||InpPanelY<0||InpFontSize<8||InpFontSize>16||
  (InpBrokerUtcOffsetMinutes!=2147483647&&(InpBrokerUtcOffsetMinutes<-840||InpBrokerUtcOffsetMinutes>840)))return INIT_PARAMETERS_INCORRECT;
 if(InpDateWIB!=""&&CKADateParse(InpDateWIB)==0)return INIT_PARAMETERS_INCORRECT;
 Prefix="CEBONK_KZ_"+IntegerToString(ChartID())+"_"+IntegerToString((long)GetMicrosecondCount())+"_";
 FollowToday=InpDateWIB=="";SelectedDate=FollowToday?CKAUpcomingDay(TimeGMT()):CKADateParse(InpDateWIB);
 IndicatorSetString(INDICATOR_SHORTNAME,"CEBONK KILLZONE ASTROLOGY 1.00");if(!EventSetTimer(15))return INIT_FAILED;Refresh();return INIT_SUCCEEDED;
}
int OnCalculate(const int rates_total,const int prev_calculated,const datetime &time[],const double &open[],const double &high[],const double &low[],const double &close[],const long &tick_volume[],const long &volume[],const int &spread[]){
 if(FirstCalculation){FirstCalculation=false;Paint();}return rates_total;
}
void OnTimer(){Refresh();}
void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam){
 if(id==CHARTEVENT_CHART_CHANGE){Paint();return;}if(id!=CHARTEVENT_OBJECT_CLICK)return;
 bool previous=sparam==Prefix+"UI_previous",next=sparam==Prefix+"UI_next",today=sparam==Prefix+"UI_today";if(!previous&&!next&&!today)return;
 NavStatus="";
 if(today){FollowToday=true;if(NowUTC>0)SelectedDate=CKAUpcomingDay(NowUTC);}
 else{datetime candidate=CKANextTradingDay(SelectedDate,previous?-1:1);if(Forecast.Covers(candidate)){SelectedDate=candidate;FollowToday=false;}else NavStatus="Date outside forecast. Run Update-KillzoneForecast.ps1.";}
 Paint();
}
void OnDeinit(const int reason){EventKillTimer();if(Prefix!="")ObjectsDeleteAll(0,Prefix);ChartRedraw();}
