#ifndef CEBONK_SWING_CLOCK_MQH
#define CEBONK_SWING_CLOCK_MQH
struct CSOffset {datetime from,to;int minutes;};
class CSClock {
 private:
  CSOffset m_offsets[];int m_fixed,m_live;bool m_tester,m_verified;
 public:
  string error;
  bool Init(int testerOffset,string csv){
   m_tester=(bool)MQLInfoInteger(MQL_TESTER);m_fixed=testerOffset;m_verified=false;m_live=0;
   if(m_tester&&testerOffset!=2147483647&&(testerOffset<-840||testerOffset>840)){error="CLOCK_OFFSET_RANGE";return false;}
   if(m_tester&&csv!=""){
    int f=FileOpen(csv,FILE_READ|FILE_CSV|FILE_ANSI,',',CP_UTF8);
    if(f!=INVALID_HANDLE){
     while(!FileIsEnding(f)){
      string a=FileReadString(f),b=FileReadString(f),c=FileReadString(f);if(a=="server_from"||a=="")continue;
      CSOffset v;v.from=(datetime)StringToInteger(a);v.to=(datetime)StringToInteger(b);v.minutes=(int)StringToInteger(c);
      if(v.from<=0||v.to<=v.from||v.minutes<-840||v.minutes>840){FileClose(f);error="CLOCK_BAD_OFFSET_FILE";return false;}
      int n=ArraySize(m_offsets);if(n>0&&v.from<m_offsets[n-1].to){FileClose(f);error="CLOCK_AMBIGUOUS_OFFSET_FILE";return false;}
      ArrayResize(m_offsets,n+1);m_offsets[n]=v;
     }FileClose(f);
    }
   }
   Refresh();return true;
  }
  bool Refresh(){
   if(m_tester){m_verified=ToUtc(TimeCurrent())>0;error=m_verified?"CLOCK_TESTER_VERIFIED":"CLOCK_UNVERIFIED";return m_verified;}
   m_verified=false;
   if(!TerminalInfoInteger(TERMINAL_CONNECTED)||TimeGMT()<1577836800){error="CLOCK_UNVERIFIED";return false;}
   long difference=(long)(TimeTradeServer()-TimeGMT());m_live=(int)MathRound((double)difference/900.0)*15;
   if(m_live<-840||m_live>840||MathAbs((double)(difference-m_live*60))>30){error="CLOCK_UNVERIFIED";return false;}
   m_verified=true;error="CLOCK_LIVE_GMT";return true;
  }
  datetime ToUtc(datetime server){
   if(!m_tester)return m_verified?server-m_live*60:0;
   for(int i=0;i<ArraySize(m_offsets);i++)if(server>=m_offsets[i].from&&server<m_offsets[i].to)return server-m_offsets[i].minutes*60;
   return m_fixed!=2147483647?server-m_fixed*60:0;
  }
  datetime ToServer(datetime utc){
   if(!m_tester)return m_verified?utc+m_live*60:0;
   for(int i=0;i<ArraySize(m_offsets);i++){
    datetime t=utc+m_offsets[i].minutes*60;if(t>=m_offsets[i].from&&t<m_offsets[i].to)return t;
   }return m_fixed!=2147483647?utc+m_fixed*60:0;
  }
  datetime Now(){return !m_verified?0:m_tester?ToUtc(TimeCurrent()):TimeGMT();}
  bool Tester(){return m_tester;}
};
#endif
