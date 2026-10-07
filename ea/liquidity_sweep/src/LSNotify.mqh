// CEBONK LIQUIDITY SWEEP EA v1.00 - notification only.
#ifndef CEBONK_LS_NOTIFY
#define CEBONK_LS_NOTIFY
struct LSNoticeItem { string event,text; int tries; bool pushed; };
LSNoticeItem gLSQueue[];
long gLSNextNotify=0;

string LSQ(const string s){
 string out="\"";
 for(int i=0;i<StringLen(s);i++){ushort c=StringGetCharacter(s,i);
  if(c==34)out+="\\\"";else if(c==92)out+="\\\\";else if(c==10)out+="\\n";
  else if(c==13)out+="\\r";else if(c==9)out+="\\t";else if(c<32)out+=StringFormat("\\u%04X",(int)c);else out+=ShortToString(c);
 }
 return out+"\"";
}
void LSAudit(const string event,const string symbol,const string detail){
 Print("{\"ea\":\"CEBONK_LIQUIDITY_SWEEP\",\"event\":"+LSQ(event)+",\"symbol\":"+LSQ(symbol)+",\"detail\":"+LSQ(detail)+"}");
}
void LSNotice(const string event,const string text,const string symbol,const bool tester,const bool scannerOn){
 LSAudit(event,symbol,text);if(tester)return;
 int n=ArraySize(gLSQueue);if(n>=32)return;ArrayResize(gLSQueue,n+1);
 gLSQueue[n].event=event;gLSQueue[n].tries=0;gLSQueue[n].pushed=false;
 gLSQueue[n].text="SEKTE MUSANG - CEBONK COMPANY 22\nLIQUIDITY SWEEP EA | "+event+"\n"+
  symbol+" | SCANNER "+(scannerOn?"ON":"OFF")+"\n--------------------\n"+StringSubstr(text,0,3000)+
  "\n--------------------\nOJO FULLMARGIN COK";
}
void LSPopNotice(){
 int n=ArraySize(gLSQueue);for(int i=1;i<n;i++)gLSQueue[i-1]=gLSQueue[i];ArrayResize(gLSQueue,n-1);
}
void LSFlushNotice(const bool tester,const bool push,const bool telegram,const string token,const string chat,const int timeout){
 if(tester||ArraySize(gLSQueue)==0||(long)TimeLocal()<gLSNextNotify)return;gLSNextNotify=(long)TimeLocal()+7;
 if(!gLSQueue[0].pushed){
  if(push&&!SendNotification(StringSubstr(gLSQueue[0].event+" | "+gLSQueue[0].text,0,250)))Print("LS MT5 push gagal.");
  gLSQueue[0].pushed=true;
 }
 if(!telegram||token==""||chat==""){LSPopNotice();return;}
 string body="{\"chat_id\":"+LSQ(chat)+",\"text\":"+LSQ(gLSQueue[0].text)+"}";
 char bytes[],answer[];string headers;
 int len=StringToCharArray(body,bytes,0,WHOLE_ARRAY,CP_UTF8);if(len>0)ArrayResize(bytes,len-1);
 ResetLastError();
 int http=WebRequest("POST","https://api.telegram.org/bot"+token+"/sendMessage","Content-Type: application/json\r\n",timeout,bytes,answer,headers);
 string response=CharArrayToString(answer,0,WHOLE_ARRAY,CP_UTF8);StringReplace(response," ","");
 if(http==200&&StringFind(response,"\"ok\":true")>=0){LSPopNotice();return;}
 gLSQueue[0].tries++;Print("LS Telegram HTTP=",http," err=",GetLastError(),"; token/response hidden.");
 if(http==400||http==401||http==403||gLSQueue[0].tries>=3)LSPopNotice();else gLSNextNotify=(long)TimeLocal()+(http==429?120:30);
}
#endif
