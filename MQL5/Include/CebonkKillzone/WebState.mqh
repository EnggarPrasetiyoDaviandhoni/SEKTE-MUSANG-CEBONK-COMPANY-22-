#ifndef CEBONK_KILLZONE_WEB_STATE_MQH
#define CEBONK_KILLZONE_WEB_STATE_MQH
#include "Calendar.mqh"
#include "JsonParser.mqh"
bool CKAWebURL(string url){return StringLen(url)>8&&StringLen(url)<=2000&&StringFind(url,"https://")==0&&StringFind(url,"\r")<0&&StringFind(url,"\n")<0;}
bool CKAWebHash(string value){
 if(StringLen(value)!=64)return false;
 for(int i=0;i<64;i++){ushort c=StringGetCharacter(value,i);if(!((c>=48&&c<=57)||(c>=97&&c<=102)))return false;}return true;
}
int CKAWebDelay(bool success,int failures,int pollSeconds){
 if(success)return pollSeconds;int seconds=30;for(int i=1;i<failures&&seconds<pollSeconds;i++)seconds*=2;return seconds<pollSeconds?seconds:pollSeconds;
}
class CKAWebState {
 public:
  string url,status,cacheHash;datetime lastAttempt,lastSuccess;int http,pollSeconds;bool valid;
  CKAWebState(){url="";status="WEB_NOT_STARTED";cacheHash="";lastAttempt=0;lastSuccess=0;http=0;pollSeconds=600;valid=false;}
  bool Parse(string raw){
   valid=false;CKAJson j;
   if(!j.Parse(raw)||!j.Only(0,"schema_version,model_id,url,last_attempt_utc,last_success_utc,last_http,status,cache_hash,refresh_seconds")||
    j.Text(j.Get(0,"schema_version"))!="1.0.0"||j.Text(j.Get(0,"model_id"))!="CEBONK_KILLZONE_WEBREQUEST")return false;
   int a=j.Get(0,"last_attempt_utc"),s=j.Get(0,"last_success_utc"),h=j.Get(0,"last_http"),p=j.Get(0,"refresh_seconds");
   string u=j.Text(j.Get(0,"url")),st=j.Text(j.Get(0,"status")),hash=j.Text(j.Get(0,"cache_hash"));
   if(!CKAWebURL(u)||st==""||StringLen(st)>128||!j.Integer(a)||j.Number(a)<1577836800||j.Number(a)>4102444800||
    !j.Integer(s)||j.Number(s)<0||j.Number(s)>j.Number(a)+60||!j.Integer(h)||j.Number(h)<-1||j.Number(h)>599||
    !j.Integer(p)||j.Number(p)<60||j.Number(p)>3600||(j.Number(s)>0?!CKAWebHash(hash):hash!="")||
    (st=="WEB_OK"&&(j.Number(h)!=200||j.Number(s)==0)))return false;
   url=u;status=st;cacheHash=hash;lastAttempt=(datetime)j.Number(a);lastSuccess=(datetime)j.Number(s);http=(int)j.Number(h);pollSeconds=(int)j.Number(p);valid=true;return true;
  }
  string Encode(){
   return "{\"schema_version\":\"1.0.0\",\"model_id\":\"CEBONK_KILLZONE_WEBREQUEST\",\"url\":\""+CKAJsonEscape(url)+
    "\",\"last_attempt_utc\":"+IntegerToString((long)lastAttempt)+",\"last_success_utc\":"+IntegerToString((long)lastSuccess)+
    ",\"last_http\":"+IntegerToString(http)+",\"status\":\""+CKAJsonEscape(status)+"\",\"cache_hash\":\""+cacheHash+"\",\"refresh_seconds\":"+IntegerToString(pollSeconds)+"}";
  }
  bool CacheUsable(datetime now,int maxAgeSeconds,string actualHash){
   return valid&&maxAgeSeconds>0&&now>=1577836800&&lastAttempt<=now+60&&lastSuccess>0&&lastSuccess<=now+60&&now-lastSuccess<maxAgeSeconds&&cacheHash==actualHash&&CKAWebHash(actualHash);
  }
  bool Online(){return valid&&http==200&&status=="WEB_OK";}
};
#endif
