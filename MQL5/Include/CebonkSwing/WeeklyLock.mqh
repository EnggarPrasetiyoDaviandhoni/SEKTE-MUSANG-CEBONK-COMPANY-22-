#ifndef CEBONK_SWING_WEEKLY_LOCK_MQH
#define CEBONK_SWING_WEEKLY_LOCK_MQH
#include "Persistence.mqh"
#include "FeedValidator.mqh"
datetime CSWeekMondayUTC(datetime now){
 datetime local=CSDateParse(CSDate(now+25200));MqlDateTime d;TimeToStruct(local,d);
 return local-((d.day_of_week+6)%7)*86400-25200;
}
class CSWeeklyLock {
 private:
  string m_file,m_symbol;long m_account,m_magic;bool m_durable;
 public:
  CSWeekLatch value;string hash,source,reason,error;
  bool Save(){
   string raw=StringFormat("{\"version\":1,\"account\":\"%I64d\",\"magic\":\"%I64d\",\"symbol\":\"%s\",\"monday\":%I64d,\"side\":%d,\"captured\":%I64d,\"feed_hash\":\"%s\",\"source\":\"%s\",\"reason\":\"%s\"}",
    m_account,m_magic,CSJsonEscape(m_symbol),(long)value.monday,value.side,(long)value.captured,hash,source,CSJsonEscape(reason));
   int f=FileOpen(m_file+".tmp",FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON,0,CP_UTF8);if(f==INVALID_HANDLE)return false;
   bool wrote=FileWriteString(f,raw)>0;FileFlush(f);FileClose(f);
   return wrote&&FileMove(m_file+".tmp",FILE_COMMON,m_file,FILE_COMMON|FILE_REWRITE);
  }
  bool Init(string path,string symbol,long magic,bool reset){
   m_file=path;m_symbol=symbol;m_magic=magic;m_account=AccountInfoInteger(ACCOUNT_LOGIN);value.Clear();hash="";source="";reason="";m_durable=true;
   if(reset)FileDelete(m_file,FILE_COMMON);
   if(!FileIsExist(m_file,FILE_COMMON))return Save();
   int f=FileOpen(m_file,FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON,0,CP_UTF8);if(f==INVALID_HANDLE)return false;
   if(FileSize(f)>8192){FileClose(f);return false;}string raw=FileReadString(f);FileClose(f);CSJson j;
   if(!j.Parse(raw)||!j.Only(0,"version,account,magic,symbol,monday,side,captured,feed_hash,source,reason")||j.Number(j.Get(0,"version"))!=1||
    j.Text(j.Get(0,"symbol"))!=m_symbol||StringToInteger(j.Text(j.Get(0,"account")))!=m_account||StringToInteger(j.Text(j.Get(0,"magic")))!=m_magic)return false;
   if(!j.Integer(j.Get(0,"monday"))||!j.Integer(j.Get(0,"captured"))||!j.Integer(j.Get(0,"side")))return false;
   value.monday=(datetime)j.Number(j.Get(0,"monday"));value.captured=(datetime)j.Number(j.Get(0,"captured"));value.side=(int)j.Number(j.Get(0,"side"));
   hash=j.Text(j.Get(0,"feed_hash"));source=j.Text(j.Get(0,"source"));reason=j.Text(j.Get(0,"reason"));
   if(value.monday==0)return value.captured==0&&value.side==0;
   return value.side>=-1&&value.side<=1&&value.captured>=value.monday&&value.captured<value.monday+604800&&
    CSWeekMondayUTC(value.captured)==value.monday&&StringLen(hash)==64&&StringLen(source)==40;
  }
  bool Refresh(datetime now,CSFeed &feed){
   if(now<=0||!feed.Valid(now)){error="WEEKLY_WAIT_VALID_FEED";return false;}
   datetime week=CSWeekMondayUTC(now);
   if(value.Current(week)){
    if(!m_durable)m_durable=Save();error=m_durable?"WEEKLY_LOCKED":"WEEKLY_PERSISTENCE_FAILED";return m_durable;
   }
   int i=feed.WeekIndex(CSDate(week+25200));if(i<0||!value.Capture(week,feed.weeks[i].side,now)){error="WEEKLY_MISSING_OR_REPLAYED";return false;}
   hash=feed.hash;source=feed.source;reason=feed.weeks[i].reason;m_durable=Save();
   error=m_durable?"WEEKLY_LOCKED":"WEEKLY_PERSISTENCE_FAILED";return m_durable;
  }
};
#endif
