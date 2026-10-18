#property strict
#property version "1.01"
#property script_show_inputs
#property description "Killzone-only HTTPS downloader. No orders. Runs in its own script thread."
#include <CebonkKillzone/Forecast.mqh>
#include <CebonkKillzone/WebState.mqh>

input string InpFeedURL="https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/killzone-astrology-feed-v1/forecast.json";
input string InpCacheFile="cebonk-killzone-forecast-v1.json";
input int InpPollSeconds=600;
input int InpTimeoutMs=5000;

CKAWebState Web;
bool ReadText(string path,int maximum,string &text){
 int handle=FileOpen(path,FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ|FILE_SHARE_WRITE,0,CP_UTF8);if(handle==INVALID_HANDLE)return false;
 if(FileSize(handle)>maximum){FileClose(handle);return false;}text=FileReadString(handle);FileClose(handle);return true;
}
bool WriteText(string path,string text){
 string temporary=path+".web.tmp";int handle=FileOpen(temporary,FILE_WRITE|FILE_TXT|FILE_ANSI,0,CP_UTF8);if(handle==INVALID_HANDLE)return false;
 bool wrote=FileWriteString(handle,text)>0;FileFlush(handle);FileClose(handle);string verify="";
 if(!wrote||!ReadText(temporary,2097152,verify)||verify!=text){FileDelete(temporary);return false;}
 if(!FileMove(temporary,0,path,FILE_REWRITE)){FileDelete(temporary);return false;}return true;
}
bool Download(){
 Web.lastAttempt=TimeGMT();Web.http=0;
 if(Web.lastAttempt<1577836800){Web.status="CLOCK_UNVERIFIED";return false;}
 char request[],result[];string responseHeaders="";ArrayResize(request,0);ResetLastError();
 Web.http=WebRequest("GET",InpFeedURL,"Accept: application/json\r\nCache-Control: no-cache\r\n",InpTimeoutMs,request,result,responseHeaders);
 int error=GetLastError();
 if(Web.http!=200){Web.status=Web.http<0?"WEBREQUEST_ERROR_"+IntegerToString(error):"HTTP_"+IntegerToString(Web.http);return false;}
 int count=ArraySize(result);if(count<=0||count>2097152){Web.status="RESPONSE_SIZE_INVALID";return false;}
 string raw=CharArrayToString(result,0,count,CP_UTF8);StringTrimRight(raw);CKAForecast forecast;
 datetime now=TimeGMT();if(!forecast.Accept(raw,now)){Web.status="INVALID_"+forecast.error;return false;}
 if(!forecast.Covers(CKAUpcomingDay(now))){Web.status="REMOTE_HORIZON_EXPIRED";return false;}
 if(!WriteText(InpCacheFile,raw)){Web.status="CACHE_WRITE_FAILED";return false;}
 Web.lastSuccess=now;Web.cacheHash=forecast.hash;Web.status="WEB_OK";return true;
}
void OnStart(){
 if(!CKAWebURL(InpFeedURL)||InpCacheFile==""||InpPollSeconds<60||InpPollSeconds>3600||InpTimeoutMs<1000||InpTimeoutMs>15000){Print("KILLZONE WEB: invalid HTTPS URL, file name, polling interval or timeout");return;}
 if(MQLInfoInteger(MQL_TESTER)){Print("KILLZONE WEB: WebRequest is unavailable in Strategy Tester");return;}
 int lock=FileOpen(InpCacheFile+".web.lock",FILE_READ|FILE_WRITE|FILE_BIN);
 if(lock==INVALID_HANDLE){Print("KILLZONE WEB: another downloader owns this cache, or the cache folder is not writable");return;}
 string oldRaw="";CKAWebState old;
 if(ReadText(InpCacheFile+".webstatus.json",8192,oldRaw)&&old.Parse(oldRaw)&&old.url==InpFeedURL){Web.lastSuccess=old.lastSuccess;Web.cacheHash=old.cacheHash;}
 Web.url=InpFeedURL;Web.pollSeconds=InpPollSeconds;int failures=0;ulong next=0;
 Print("KILLZONE WEB: downloader running; allow https://raw.githubusercontent.com in Tools > Options > Expert Advisors > WebRequest");
 while(!IsStopped()){
  if(GetTickCount64()>=next){
   bool success=Download();failures=success?0:failures+1;
   if(!WriteText(InpCacheFile+".webstatus.json",Web.Encode()))Print("KILLZONE WEB: status write failed; indicator will require a verified cache");
   PrintFormat("KILLZONE WEB: %s HTTP=%d last_success=%s",Web.status,Web.http,TimeToString(Web.lastSuccess,TIME_DATE|TIME_SECONDS));
   next=GetTickCount64()+(ulong)CKAWebDelay(success,failures,InpPollSeconds)*1000;
  }
  Sleep(1000); // This script owns a thread; no wait or WebRequest runs in the indicator.
 }
 Web.status="SCRIPT_STOPPED";Web.lastAttempt=TimeGMT();Web.http=0;WriteText(InpCacheFile+".webstatus.json",Web.Encode());FileClose(lock);
}
