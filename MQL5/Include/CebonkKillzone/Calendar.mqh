#ifndef CEBONK_KILLZONE_CALENDAR_MQH
#define CEBONK_KILLZONE_CALENDAR_MQH
#include "Types.mqh"
string CKADate(datetime t){MqlDateTime d;TimeToStruct(t,d);return StringFormat("%04d-%02d-%02d",d.year,d.mon,d.day);}
datetime CKADateParse(string value){
 if(StringLen(value)!=10||StringSubstr(value,4,1)!="-"||StringSubstr(value,7,1)!="-")return 0;
 string text=value;StringReplace(text,"-",".");datetime t=StringToTime(text+" 00:00:00");return CKADate(t)==value?t:0;
}
bool CKAWeekday(datetime date){MqlDateTime d;TimeToStruct(date,d);return d.day_of_week>=1&&d.day_of_week<=5;}
datetime CKANextTradingDay(datetime date,int side){do{date+=side*86400;}while(!CKAWeekday(date));return date;}
datetime CKAUpcomingDay(datetime utc){datetime day=CKADateParse(CKADate(utc+25200));while(!CKAWeekday(day))day+=86400;return day;}
datetime CKASunday(int year,int month,int nth,bool last=false){
 datetime first=CKADateParse(StringFormat("%04d-%02d-01",year,month));MqlDateTime d;TimeToStruct(first,d);
 if(last){datetime end=CKADateParse(StringFormat("%04d-%02d-01",month==12?year+1:year,month==12?1:month+1))-86400;TimeToStruct(end,d);return end-d.day_of_week*86400;}
 return first+((7-d.day_of_week)%7+7*(nth-1))*86400;
}
// Modern IANA rules at these weekday session hours; tested against JS Intl.
int CKAIanaOffset(datetime date,int index){
 MqlDateTime d;TimeToStruct(date,d);int y=d.year;
 if(index==1)return 540;
 if(index==0)return date>=CKASunday(y,4,1)&&date<CKASunday(y,10,1)?600:660;
 if(index==3)return date>=CKASunday(y,3,2)&&date<CKASunday(y,11,1)?-240:-300;
 return date>=CKASunday(y,3,1,true)&&date<CKASunday(y,10,1,true)?60:0;
}
string CKASessionId(int i){return i==0?"sydney":i==1?"tokyo":i==2?"london":i==3?"newyork":"londonclose";}
string CKASessionName(int i){return i==0?"Sydney":i==1?"Tokyo / Asia":i==2?"London Open":i==3?"New York Open":"London Close";}
string CKASessionZone(int i){return i==0?"Australia/Sydney":i==1?"Asia/Tokyo":i==3?"America/New_York":"Europe/London";}
int CKADirection(string s){return s=="BUY"?1:s=="SELL"?-1:0;}
string CKADirectionText(int side){return side>0?"BUY":side<0?"SELL":"NETRAL";}
datetime CKAToChart(datetime utc,int offsetMinutes){return utc+offsetMinutes*60;}
string CKAPhase(datetime now,datetime start,datetime core,datetime end){
 return now<start?"UPCOMING":now<core?"AWAL":now<end?"INTI":"FINISHED";
}
#endif
