#ifndef CEBONK_SWING_NOTIFICATION_FORMAT_MQH
#define CEBONK_SWING_NOTIFICATION_FORMAT_MQH
#include "JsonParser.mqh"
#include "NumericCore.mqh"
struct CSOrderNoticeContext {
 bool known,autopilot,cutProfit;
 int weekly,model,ipdaDays,digits,volumeDigits;
 string symbol,session;
 double ipdaHigh,ipdaLow;
};
string CSNoticeSide(int side){return side==1?"BUY":side==-1?"SELL":"WAIT";}
string CSNoticeSession(string id){
 if(id=="sydney")return "SYDNEY";if(id=="tokyo")return "TOKYO";
 if(id=="london")return "LONDON OPEN";if(id=="newyork")return "NEW YORK";
 if(id=="londonclose")return "LONDON CLOSE";return "BELUM TERSEDIA";
}
string CSNoticeContextEncode(const CSOrderNoticeContext &c){
 return "{\"version\":1,\"symbol\":\""+CSJsonEscape(c.symbol)+"\",\"session\":\""+CSJsonEscape(c.session)+
  "\",\"weekly\":"+IntegerToString(c.weekly)+",\"model\":"+IntegerToString(c.model)+
  ",\"ipda_days\":"+IntegerToString(c.ipdaDays)+",\"ipda_high\":"+DoubleToString(c.ipdaHigh,16)+
  ",\"ipda_low\":"+DoubleToString(c.ipdaLow,16)+",\"digits\":"+IntegerToString(c.digits)+
  ",\"volume_digits\":"+IntegerToString(c.volumeDigits)+",\"autopilot\":"+(c.autopilot?"true":"false")+
  ",\"cut_profit\":"+(c.cutProfit?"true":"false")+"}";
}
bool CSNoticeContextDecode(string raw,CSOrderNoticeContext &c){
 c.known=false;c.weekly=0;c.model=0;c.ipdaDays=40;c.digits=2;c.volumeDigits=2;
 c.symbol="";c.session="";c.ipdaHigh=0;c.ipdaLow=0;c.autopilot=false;c.cutProfit=false;
 CSJson j;if(!j.Parse(raw)||!j.Only(0,"version,symbol,session,weekly,model,ipda_days,ipda_high,ipda_low,digits,volume_digits,autopilot,cut_profit")||j.Number(j.Get(0,"version"))!=1)return false;
 c.symbol=j.Text(j.Get(0,"symbol"));c.session=j.Text(j.Get(0,"session"));
 c.weekly=(int)j.Number(j.Get(0,"weekly"));c.model=(int)j.Number(j.Get(0,"model"));
 c.ipdaDays=(int)j.Number(j.Get(0,"ipda_days"));c.digits=(int)j.Number(j.Get(0,"digits"));c.volumeDigits=(int)j.Number(j.Get(0,"volume_digits"));
 c.ipdaHigh=j.Number(j.Get(0,"ipda_high"));c.ipdaLow=j.Number(j.Get(0,"ipda_low"));
 c.autopilot=j.Number(j.Get(0,"autopilot"))==1;c.cutProfit=j.Number(j.Get(0,"cut_profit"))==1;
 c.known=c.symbol!=""&&c.weekly*c.weekly==1&&(c.model==1||c.model==2)&&
  (c.ipdaDays==20||c.ipdaDays==40||c.ipdaDays==60)&&c.digits>=0&&c.digits<=8&&c.volumeDigits>=0&&c.volumeDigits<=8&&
  CSFinite(c.ipdaHigh)&&CSFinite(c.ipdaLow)&&c.ipdaHigh>c.ipdaLow&&c.ipdaLow>0;
 if(c.digits<0||c.digits>8)c.digits=2;if(c.volumeDigits<0||c.volumeDigits>8)c.volumeDigits=2;
 return c.known;
}
string CSNoticeVolume(double volume,int digits){
 double scaled=volume;for(int i=0;i<digits;i++)scaled*=10;
 while(digits<8&&MathAbs(scaled-MathFloor(scaled+0.5))>1e-8){digits++;scaled*=10;}
 return DoubleToString(volume,digits);
}
string CSNoticeIPDA(const CSOrderNoticeContext &c,double price){
 if(!c.known)return "BELUM TERSEDIA";
 string zone="ZONA "+IntegerToString(c.ipdaDays)+" — ";
 if(price>c.ipdaHigh)return zone+"DI ATAS RANGE";
 if(price<c.ipdaLow)return zone+"DI BAWAH RANGE";
 double mid=(c.ipdaHigh+c.ipdaLow)/2,epsilon=0.5;
 for(int i=0;i<c.digits;i++)epsilon/=10;
 return zone+(MathAbs(price-mid)<=epsilon?"EQUILIBRIUM":price<mid?"DISCOUNT":"PREMIUM");
}
string CSFilledOrderNotice(const CSOrderNoticeContext &c,string symbol,int side,int layer,
 double volume,double entry,double sl,double tp){
 double rr=CSRR(side,entry,sl,tp);
 string ict=!c.known?"BELUM TERSEDIA":c.model==1?"Sweep + MSS + Retest":"BOS + Retest";
 string exit=!c.known?"BELUM TERSEDIA":c.cutProfit?"Dominant Break "+CSNoticeSide(-side)+" M15 (NET basket > 0)":"OFF";
 return "🟢 CEBONK COMPANY 22\n🦊 ASTROLOGY + ICT IPDA + BBMA + FIBO MUSANG\n🚀 SWING TRADE — "+CSNoticeSide(side)+" "+symbol+
  "\n\n🔮 Astrology Weekly: "+(c.known?CSNoticeSide(c.weekly):"BELUM TERSEDIA")+
  "\n🌍 Session: "+CSNoticeSession(c.session)+"\n\n📊 ICT: "+ict+
  "\n📍 IPDA D1: "+CSNoticeIPDA(c,entry)+"\n📈 BBMA: TIDAK DIGUNAKAN\n🦊 Fibo Musang: "+(c.known?"EL2 M5":"BELUM TERVERIFIKASI")+
  "\n\n💰 Lot: "+CSNoticeVolume(volume,c.volumeDigits)+"\n📈 Entry: "+DoubleToString(entry,c.digits)+
  "\n🛑 SL: "+DoubleToString(sl,c.digits)+"\n🎯 TP ICT: "+DoubleToString(tp,c.digits)+
  "\n⚖️ RR: "+(rr>=0?"1:"+DoubleToString(rr,1):"BELUM TERVERIFIKASI")+
  "\n\n✂️ Cut Profit: "+exit+"\n🔢 Layer: "+IntegerToString(layer)+"/4"+
  "\n🤖 AUTOPILOT "+(!c.known?"BELUM TERSEDIA":c.autopilot?"ON":"OFF");
}
// SendNotification accepts at most 255 UTF-16 code units. Keep every field,
// preserve line boundaries when possible and never split an emoji surrogate.
bool CSPushParts(string text,CS_ARRAY(string,parts)){
 ArrayResize(parts,0);int length=StringLen(text);
 if(length<=255){ArrayResize(parts,1);parts[0]=text;return true;}
 int budget=255-StringLen("CEBONK [99/99]\n"),pos=0;
 while(pos<length){
  int end=(int)CSMin(length,pos+budget);
  if(end<length){
   ushort last=StringGetCharacter(text,end-1);if(last>=0xD800&&last<=0xDBFF)end--;
   for(int i=end-1;i>pos+budget/2;i--)if(StringGetCharacter(text,i)==10){end=i+1;break;}
  }
  int n=ArraySize(parts);if(n>=99||end<=pos)return false;
  ArrayResize(parts,n+1);parts[n]=StringSubstr(text,pos,end-pos);pos=end;
 }
 int total=ArraySize(parts);
 for(int i=0;i<total;i++)parts[i]="CEBONK ["+IntegerToString(i+1)+"/"+IntegerToString(total)+"]\n"+parts[i];
 return true;
}
#endif
