#ifndef CEBONK_SWING_FEED_CLIENT_MQH
#define CEBONK_SWING_FEED_CLIENT_MQH
#include "Types.mqh"
#include "FeedValidator.mqh"
class CSFeedClient {
 private:
  string m_url,m_history,m_cache,m_pending;datetime m_next,m_pendingAt;int m_handle,m_failures;bool m_tester;
  bool Cache(string raw){
   int f=FileOpen(m_cache+".tmp",FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON,0,CP_UTF8);if(f==INVALID_HANDLE)return false;
   FileWriteString(f,raw);FileFlush(f);FileClose(f);return FileMove(m_cache+".tmp",FILE_COMMON,m_cache,FILE_COMMON|FILE_REWRITE);
  }
 public:
  CSFeedClient(){m_handle=INVALID_HANDLE;m_next=0;m_pendingAt=0;m_failures=0;m_pending="";}
  void Init(string url,string history,string cache){m_url=url;m_history=history;m_cache=cache;m_tester=(bool)MQLInfoInteger(MQL_TESTER);}
  void Close(){if(m_handle!=INVALID_HANDLE){FileClose(m_handle);m_handle=INVALID_HANDLE;}}
  bool Poll(datetime now,CSFeed &feed){
   if(now<=0)return feed.Reject("CLOCK_UNVERIFIED");
   if(now<m_next){if(!feed.Valid(now))feed.Reject("FEED_STALE");return feed.Valid(now);}
   m_next=now+600;
   if(m_tester){
    if(m_handle==INVALID_HANDLE){m_handle=FileOpen(m_history,FILE_READ|FILE_TXT|FILE_ANSI,0,CP_UTF8);
     if(m_handle==INVALID_HANDLE)return feed.Reject("TESTER_HISTORY_FILE_MISSING");}
    string chosen="";
    while(true){
     if(m_pending==""){
      if(FileIsEnding(m_handle))break;m_pending=FileReadString(m_handle);if(m_pending=="")continue;
      CSJson j;if(!j.Parse(m_pending)||!j.Integer(j.Get(0,"generated_at_utc"))){m_pending="";return feed.Reject("TESTER_HISTORY_INVALID");}
      m_pendingAt=(datetime)j.Number(j.Get(0,"generated_at_utc"));
     }
     if(m_pendingAt>now)break; // No future publication selected by simulated time.
     chosen=m_pending;m_pending="";
    }
    if(chosen!="")return feed.Accept(chosen,now);
    if(!feed.Valid(now))return feed.Reject("TESTER_NO_ASOF_FEED");return true;
   }
   char body[],result[];string headers;
   ResetLastError();int code=WebRequest("GET",m_url,"Accept: application/json\r\n",8000,body,result,headers);
   if(code!=200||ArraySize(result)>2097152||ArraySize(result)<2){
    m_failures++;int delay=(int)CSMin(3600,60*MathPow(2,CSMin(m_failures,6)));m_next=now+delay;
    return feed.Reject(code==-1?"FEED_WEBREQUEST_FAILED_"+IntegerToString(GetLastError()):"FEED_HTTP_"+IntegerToString(code));
   }
   string raw=CharArrayToString(result,0,ArraySize(result),CP_UTF8);
   if(!feed.Accept(raw,now))return false;m_failures=0;Cache(raw);return true;
  }
};
#endif
