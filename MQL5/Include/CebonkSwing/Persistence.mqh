#ifndef CEBONK_SWING_PERSISTENCE_MQH
#define CEBONK_SWING_PERSISTENCE_MQH
#include "JsonParser.mqh"
string CSHash16(string text){
 uchar bytes[],key[],digest[];int n=StringToCharArray(text,bytes,0,WHOLE_ARRAY,CP_UTF8);ArrayResize(bytes,n-1);
 if(CryptEncode(CRYPT_HASH_SHA256,bytes,key,digest)!=32)return "";string out="";for(int i=0;i<8;i++)out+=StringFormat("%02x",(int)digest[i]);return out;
}
class CSState {
 public:
  string file,symbol,basket,window,signal,exitEvent,noticeContext;string spent[],signals[];long magic,account;long ids[];
  int side,layers;ulong pendingOrder;bool pending,exitPending,recovered;datetime first,last,intent,exitExpiry,lastM15;
  datetime h1Origin,h1Structure,h1Birth,m15Retest,m5Source;
  double sl,tp,fib0,fib1;
  void EmptyBasket(){basket="";window="";signal="";exitEvent="";noticeContext="";side=0;layers=0;pending=false;pendingOrder=0;exitPending=false;recovered=false;
   first=0;last=0;intent=0;exitExpiry=0;h1Origin=0;h1Structure=0;h1Birth=0;m15Retest=0;m5Source=0;sl=0;tp=0;fib0=0;fib1=0;ArrayResize(ids,0);}
  bool Contains(CS_CONST_ARRAY(string,a),string s){for(int i=0;i<ArraySize(a);i++)if(a[i]==s)return true;return false;}
  void Remember(CS_ARRAY(string,a),string s,int limit){if(Contains(a,s))return;int n=ArraySize(a);if(n>=limit){for(int i=1;i<n;i++)a[i-1]=a[i];n--;ArrayResize(a,n);}ArrayResize(a,n+1);a[n]=s;}
  void AddId(long id){for(int i=0;i<ArraySize(ids);i++)if(ids[i]==id)return;int n=ArraySize(ids);if(n>=16)return;ArrayResize(ids,n+1);ids[n]=id;}
  bool HasId(long id){for(int i=0;i<ArraySize(ids);i++)if(ids[i]==id)return true;return false;}
  string Strings(CS_CONST_ARRAY(string,a)){string out="[";for(int i=0;i<ArraySize(a);i++){if(i)out+=",";out+="\""+CSJsonEscape(a[i])+"\"";}return out+"]";}
  string Encode(){
   string idList="[";for(int i=0;i<ArraySize(ids);i++){if(i)idList+=",";idList+="\""+IntegerToString(ids[i])+"\"";}idList+="]";
   return StringFormat("{\"version\":4,\"account\":\"%I64d\",\"magic\":\"%I64d\",\"symbol\":\"%s\",\"basket\":\"%s\",\"window\":\"%s\",\"signal\":\"%s\",\"exit_event\":\"%s\",\"side\":%d,\"layers\":%d,\"pending\":%s,\"pending_order\":\"%I64u\",\"exit_pending\":%s,\"recovered\":%s,\"first\":%I64d,\"last\":%I64d,\"intent\":%I64d,\"exit_expiry\":%I64d,\"last_m15\":%I64d,\"h1_origin\":%I64d,\"h1_structure\":%I64d,\"h1_birth\":%I64d,\"m15_retest\":%I64d,\"m5_source\":%I64d,\"sl\":%s,\"tp\":%s,\"fib0\":%s,\"fib1\":%s,\"spent\":%s,\"signals\":%s,\"ids\":%s,\"notice_context\":\"%s\"}",
    account,magic,CSJsonEscape(symbol),CSJsonEscape(basket),CSJsonEscape(window),CSJsonEscape(signal),CSJsonEscape(exitEvent),side,layers,
    pending?"true":"false",pendingOrder,exitPending?"true":"false",recovered?"true":"false",(long)first,(long)last,(long)intent,(long)exitExpiry,(long)lastM15,
    (long)h1Origin,(long)h1Structure,(long)h1Birth,(long)m15Retest,(long)m5Source,
    DoubleToString(sl,16),DoubleToString(tp,16),DoubleToString(fib0,16),DoubleToString(fib1,16),Strings(spent),Strings(signals),idList,CSJsonEscape(noticeContext));
  }
  bool Save(){
   int f=FileOpen(file+".tmp",FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON,0,CP_UTF8);if(f==INVALID_HANDLE)return false;
   bool wrote=FileWriteString(f,Encode())>0;FileFlush(f);FileClose(f);return wrote&&FileMove(file+".tmp",FILE_COMMON,file,FILE_COMMON|FILE_REWRITE);
  }
  bool Init(string path,string sym,long mg,bool reset){
   file=path;symbol=sym;magic=mg;account=AccountInfoInteger(ACCOUNT_LOGIN);EmptyBasket();lastM15=0;ArrayResize(spent,0);ArrayResize(signals,0);
   if(reset){FileDelete(file,FILE_COMMON);return Save();}if(!FileIsExist(file,FILE_COMMON))return Save();
   int f=FileOpen(file,FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON,0,CP_UTF8);if(f==INVALID_HANDLE)return false;
   if(FileSize(f)>500000){FileClose(f);return false;}string raw=FileReadString(f);FileClose(f);CSJson j;
   if(!j.Parse(raw))return false;
   int version=(int)j.Number(j.Get(0,"version"));
   string fields="version,account,magic,symbol,basket,window,signal,exit_event,side,pending,exit_pending,recovered,first,last,intent,exit_expiry,last_m15,h1_origin,h1_structure,h1_birth,m15_retest,m5_source,sl,tp,fib0,fib1,spent,signals,ids";
   if(version==4)fields+=",layers,pending_order,notice_context";
   else{
    fields+=",awal,inti"; // v1-v3 migration only; no runtime phase allocation.
    if(version>=2)fields+=",pending_core,pending_order";
    if(version>=3)fields+=",notice_context";
   }
   if(version<1||version>4||!j.Only(0,fields)||j.Text(j.Get(0,"symbol"))!=symbol||
    StringToInteger(j.Text(j.Get(0,"account")))!=account||StringToInteger(j.Text(j.Get(0,"magic")))!=magic)return false;
   basket=j.Text(j.Get(0,"basket"));window=j.Text(j.Get(0,"window"));signal=j.Text(j.Get(0,"signal"));exitEvent=j.Text(j.Get(0,"exit_event"));
   side=(int)j.Number(j.Get(0,"side"));
   if(version==4){if(!j.Integer(j.Get(0,"layers")))return false;layers=(int)j.Number(j.Get(0,"layers"));}
   else{
    int oldAwal=(int)j.Number(j.Get(0,"awal")),oldInti=(int)j.Number(j.Get(0,"inti"));
    if(!j.Integer(j.Get(0,"awal"))||!j.Integer(j.Get(0,"inti"))||oldAwal<0||oldAwal>2||oldInti<0||oldInti>2)return false;
    layers=oldAwal+oldInti;
   }
   pending=j.Number(j.Get(0,"pending"))==1;exitPending=j.Number(j.Get(0,"exit_pending"))==1;recovered=j.Number(j.Get(0,"recovered"))==1;
   noticeContext=version>=3?j.Text(j.Get(0,"notice_context")):"";
   pendingOrder=version>=2?(ulong)StringToInteger(j.Text(j.Get(0,"pending_order"))):0;
   first=(datetime)j.Number(j.Get(0,"first"));last=(datetime)j.Number(j.Get(0,"last"));intent=(datetime)j.Number(j.Get(0,"intent"));exitExpiry=(datetime)j.Number(j.Get(0,"exit_expiry"));lastM15=(datetime)j.Number(j.Get(0,"last_m15"));
   h1Origin=(datetime)j.Number(j.Get(0,"h1_origin"));h1Structure=(datetime)j.Number(j.Get(0,"h1_structure"));h1Birth=(datetime)j.Number(j.Get(0,"h1_birth"));m15Retest=(datetime)j.Number(j.Get(0,"m15_retest"));m5Source=(datetime)j.Number(j.Get(0,"m5_source"));
   sl=j.Number(j.Get(0,"sl"));tp=j.Number(j.Get(0,"tp"));fib0=j.Number(j.Get(0,"fib0"));fib1=j.Number(j.Get(0,"fib1"));
   if(layers<0||layers>4||side<-1||side>1)return false;
   int a=j.Get(0,"spent"),b=j.Get(0,"signals"),c=j.Get(0,"ids");
   if(j.Kind(a)!=CSJ_ARRAY||j.Count(a)>256||j.Kind(b)!=CSJ_ARRAY||j.Count(b)>512||j.Kind(c)!=CSJ_ARRAY||j.Count(c)>16)return false;
   for(int i=0;i<j.Count(a);i++)Remember(spent,j.Text(j.At(a,i)),256);
   for(int i=0;i<j.Count(b);i++)Remember(signals,j.Text(j.At(b,i)),512);
   for(int i=0;i<j.Count(c);i++)AddId(StringToInteger(j.Text(j.At(c,i))));
   return basket==""||(StringLen(basket)==16&&first>0&&side!=0&&((sl>0&&tp>0)||(exitPending&&StringFind(exitEvent,"SAFETY_")==0)));
  }
};
#endif
