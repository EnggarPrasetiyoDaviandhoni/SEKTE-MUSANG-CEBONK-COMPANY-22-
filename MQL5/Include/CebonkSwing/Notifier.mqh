#ifndef CEBONK_SWING_NOTIFIER_MQH
#define CEBONK_SWING_NOTIFIER_MQH
#include "Types.mqh"
#include "JsonParser.mqh"
struct CSNotice {string id,text;int pending,attempts;datetime retry;};
class CSNotifier {
 private:
  CSNotice m_queue[];string m_seen[],m_token,m_chat,m_store;bool m_push,m_telegram,m_tester;datetime m_lastPush,m_lastTelegram;
  void Persist(){
   if(m_tester||m_store=="")return;
   string raw="{\"seen\":[";for(int i=0;i<ArraySize(m_seen);i++){if(i)raw+=",";raw+="\""+CSJsonEscape(m_seen[i])+"\"";}
   raw+="],\"queue\":[";
   for(int i=0;i<ArraySize(m_queue);i++){
    if(i)raw+=",";raw+=StringFormat("{\"id\":\"%s\",\"text\":\"%s\",\"pending\":%d,\"attempts\":%d,\"retry\":%I64d}",CSJsonEscape(m_queue[i].id),CSJsonEscape(m_queue[i].text),m_queue[i].pending,m_queue[i].attempts,(long)m_queue[i].retry);
   }
   raw+=StringFormat("],\"last_push\":%I64d,\"last_telegram\":%I64d}",(long)m_lastPush,(long)m_lastTelegram);
   int f=FileOpen(m_store+".tmp",FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON,0,CP_UTF8);if(f==INVALID_HANDLE){Print("CEBONK NOTIFY_PERSISTENCE_FAILED");return;}
   bool wrote=FileWriteString(f,raw)>0;FileFlush(f);FileClose(f);
   if(!wrote||!FileMove(m_store+".tmp",FILE_COMMON,m_store,FILE_COMMON|FILE_REWRITE))Print("CEBONK NOTIFY_PERSISTENCE_FAILED");
  }
  void Restore(){
   if(m_tester||!FileIsExist(m_store,FILE_COMMON))return;
   int f=FileOpen(m_store,FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON,0,CP_UTF8);if(f==INVALID_HANDLE)return;
   if(FileSize(f)>600000){FileClose(f);return;}string raw=FileReadString(f);FileClose(f);CSJson j;
   if(!j.Parse(raw)){Print("CEBONK NOTIFY_STATE_INVALID");return;}int seen=j.Get(0,"seen"),queue=j.Get(0,"queue");
   if(j.Kind(seen)!=CSJ_ARRAY||j.Count(seen)>512||j.Kind(queue)!=CSJ_ARRAY||j.Count(queue)>64)return;
   ArrayResize(m_seen,j.Count(seen));for(int i=0;i<j.Count(seen);i++)m_seen[i]=j.Text(j.At(seen,i));
   for(int i=0;i<j.Count(queue);i++){
    int item=j.At(queue,i);CSNotice v;v.id=j.Text(j.Get(item,"id"));v.text=j.Text(j.Get(item,"text"));
    v.pending=(int)j.Number(j.Get(item,"pending"))&((m_push?1:0)|(m_telegram?2:0));
    v.attempts=(int)j.Number(j.Get(item,"attempts"));v.retry=(datetime)j.Number(j.Get(item,"retry"));
    if(v.id==""||v.pending==0)continue;int n=ArraySize(m_queue);ArrayResize(m_queue,n+1);m_queue[n]=v;
   }
   m_lastPush=(datetime)j.Number(j.Get(0,"last_push"));m_lastTelegram=(datetime)j.Number(j.Get(0,"last_telegram"));
  }
 public:
  void Init(bool push,bool telegram,string token,string chat,string store){
   m_tester=(bool)MQLInfoInteger(MQL_TESTER);m_push=push;m_telegram=telegram;m_token=token;m_chat=chat;m_store=store;m_lastPush=0;m_lastTelegram=0;Restore();
  }
  void Add(string id,string text){
   for(int i=0;i<ArraySize(m_seen);i++)if(m_seen[i]==id)return;
   int n=ArraySize(m_seen);if(n>=512){for(int i=1;i<n;i++)m_seen[i-1]=m_seen[i];n--;ArrayResize(m_seen,n);}
   ArrayResize(m_seen,n+1);m_seen[n]=id;Print("CEBONK ",id," | ",text);
   if(m_tester||(!m_push&&!m_telegram)){Persist();return;}
   n=ArraySize(m_queue);if(n>=64){Print("CEBONK NOTIFY_QUEUE_FULL; journal retains event");return;}
   ArrayResize(m_queue,n+1);m_queue[n].id=id;m_queue[n].text=text;m_queue[n].pending=(m_push?1:0)|(m_telegram?2:0);m_queue[n].attempts=0;m_queue[n].retry=0;Persist();
  }
  void Pump(datetime now){
   if(m_tester||ArraySize(m_queue)==0)return;
   if(m_queue[0].retry>now)return;
   if((m_queue[0].pending&1)!=0&&now-m_lastPush>=10){
    m_lastPush=now;if(SendNotification(StringSubstr(m_queue[0].text,0,255)))m_queue[0].pending&=~1;
   }
   if((m_queue[0].pending&2)!=0&&now-m_lastTelegram>=10){
    m_lastTelegram=now;
    if(m_token==""||m_chat==""){Print("CEBONK TELEGRAM_NOT_CONFIGURED");m_queue[0].pending&=~2;}
    else{
     string payload="{\"chat_id\":\""+CSJsonEscape(m_chat)+"\",\"text\":\""+CSJsonEscape(m_queue[0].text)+"\"}";
     char data[],result[];int n=StringToCharArray(payload,data,0,WHOLE_ARRAY,CP_UTF8);ArrayResize(data,n-1);string headers;
     int code=WebRequest("POST","https://api.telegram.org/bot"+m_token+"/sendMessage","Content-Type: application/json\r\n",8000,data,result,headers);
     if(code==200){CSJson response;if(response.Parse(CharArrayToString(result,0,ArraySize(result),CP_UTF8))&&response.Kind(response.Get(0,"ok"))==CSJ_BOOL&&response.Number(response.Get(0,"ok"))==1)m_queue[0].pending&=~2;}
     // Never print the token, URL, HTTP body, or chat identifier on failure.
    }
   }
   if(m_queue[0].pending==0){for(int i=1;i<ArraySize(m_queue);i++)m_queue[i-1]=m_queue[i];ArrayResize(m_queue,ArraySize(m_queue)-1);}
   else{m_queue[0].attempts++;m_queue[0].retry=now+(int)CSMin(3600,10*MathPow(2,CSMin(m_queue[0].attempts,8)));}Persist();
  }
};
#endif
