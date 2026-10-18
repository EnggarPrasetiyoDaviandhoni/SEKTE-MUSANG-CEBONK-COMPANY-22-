#include "host_notifier.hpp"
#include "Notifier.mqh"
#include "Persistence.mqh"
#include <iostream>
#include <fstream>
int checks=0;
#define CHECK(x) do{++checks;if(!(x)){std::cerr<<"FAILED notification line "<<__LINE__<<": "<<#x<<'\n';return 1;}}while(0)
string joinedPush(const std::vector<string>&messages){
 string out="";for(const auto &message:messages){int line=StringFind(message,"\n");out+=StringSubstr(message,line+1);}return out;
}
int main(int argc,char **argv){
 CSOrderNoticeContext c;c.known=true;c.autopilot=true;c.cutProfit=true;c.weekly=1;c.model=1;c.ipdaDays=40;c.digits=2;c.volumeDigits=2;
 c.symbol="XAUUSDc";c.session="london";c.ipdaLow=4200;c.ipdaHigh=4320;
 CSOrderNoticeContext decoded;CHECK(CSNoticeContextDecode(CSNoticeContextEncode(c),decoded));
 CHECK(decoded.known&&decoded.weekly==1&&decoded.session=="london"&&decoded.ipdaDays==40);
 string text=CSFilledOrderNotice(decoded,c.symbol,1,1,.01,4250,4240,4278);
 CHECK(StringFind(text,"🚀 SWING TRADE — BUY XAUUSDc")>=0);
 CHECK(StringFind(text,"🌍 Session: LONDON OPEN")>=0&&StringFind(text,"📊 ICT: Sweep + MSS + Retest")>=0);
 CHECK(StringFind(text,"IPDA D1: ZONA 40 — DISCOUNT")>=0);
 CHECK(StringFind(text,"BBMA: TIDAK DIGUNAKAN")>=0&&StringFind(text,"BBMA: BUY")==-1);
 CHECK(StringFind(text,"Fibo Musang: EL2 M5")>=0&&StringFind(text,"Lot: 0.01")>=0);
 CHECK(StringFind(text,"Entry: 4250.00")>=0&&StringFind(text,"SL: 4240.00")>=0&&StringFind(text,"TP ICT: 4278.00")>=0);
 CHECK(StringFind(text,"RR: 1:2.8")>=0&&StringFind(text,"Dominant Break SELL M15 (NET basket > 0)")>=0);
 CHECK(StringFind(text,"Layer: 1/4")>=0&&StringFind(text,"AUTOPILOT ON")>=0);
 c.weekly=-1;c.model=2;c.autopilot=false;c.cutProfit=false;
 auto sell=CSFilledOrderNotice(c,c.symbol,-1,4,.005,4270,4280,4242);
 CHECK(StringFind(sell,"SWING TRADE — SELL XAUUSDc")>=0&&StringFind(sell,"BOS + Retest")>=0);
 CHECK(StringFind(sell,"PREMIUM")>=0&&StringFind(sell,"Lot: 0.005")>=0&&StringFind(sell,"AUTOPILOT OFF")>=0);
 CHECK(StringFind(sell,"Cut Profit: OFF")>=0&&StringFind(sell,"Layer: 4/4")>=0);
 c.cutProfit=true;sell=CSFilledOrderNotice(c,c.symbol,-1,4,.01,4270,4280,4242);
 CHECK(StringFind(sell,"Dominant Break BUY M15")>=0&&StringFind(sell,"RR: 1:2.8")>=0);
 CHECK(StringFind(CSNoticeIPDA(c,4330),"DI ATAS RANGE")>=0&&StringFind(CSNoticeIPDA(c,4190),"DI BAWAH RANGE")>=0);
 CHECK(StringFind(CSNoticeIPDA(c,4260),"EQUILIBRIUM")>=0);
 CHECK(!CSNoticeContextDecode("",c));auto legacy=CSFilledOrderNotice(c,"XAUUSDc",1,1,.01,4250,4240,4278);
 CHECK(StringFind(legacy,"Astrology Weekly: BELUM TERSEDIA")>=0&&StringFind(legacy,"Fibo Musang: BELUM TERVERIFIKASI")>=0);
 std::vector<string> parts;CHECK(CSPushParts(text,parts)&&parts.size()>1);
 CHECK(joinedPush(parts)==text);
 for(const auto &p:parts){CHECK(StringLen(p)<=255);CHECK(string(p.utf8())==p);}
 string emojis="x";for(int i=0;i<600;i++)emojis+="🦊";
 CHECK(CSPushParts(emojis,parts)&&joinedPush(parts)==emojis);
 for(const auto &p:parts){CHECK(StringLen(p)<=255);CHECK(string(p.utf8())==p);}
 CHECK(CSPushParts("AUTOPILOT ON",parts)&&parts.size()==1&&parts[0]=="AUTOPILOT ON");
 CSNotifier first;first.Init(true,true,"DUMMY_TOKEN","DUMMY_CHAT","outbox");first.Add("ENTRY_FILLED_A_1",text);first.Pump(100);
 CHECK(pushMessages.size()==1&&telegramBodies.size()==1);
 CSJson telegram;CHECK(telegram.Parse(telegramBodies[0])&&telegram.Text(telegram.Get(0,"text"))==text);
 CHECK(testFiles.at("outbox").find("DUMMY_TOKEN")==std::string::npos);
 CSNotifier restored;restored.Init(true,true,"DUMMY_TOKEN","DUMMY_CHAT","outbox");restored.Pump(105);
 CHECK(pushMessages.size()==1&&telegramBodies.size()==1);
 for(int t=110;t<=200;t+=10)restored.Pump(t);
 CHECK(joinedPush(pushMessages)==text&&telegramBodies.size()==1);
 auto sent=pushMessages.size();restored.Add("ENTRY_FILLED_A_1",text);restored.Pump(220);CHECK(pushMessages.size()==sent); // Durable dedup.
 pushMessages.clear();CSNotifier retry;retry.Init(true,false,"","","retry");retry.Add("ENTRY_FILLED_B_2",text);
 failPush=true;retry.Pump(300);auto attempts=pushAttempts;retry.Pump(310);CHECK(pushAttempts==attempts&&pushMessages.empty());
 failPush=false;retry.Pump(320);CHECK(pushMessages.size()==1);for(int t=330;t<=410;t+=10)retry.Pump(t);
 CHECK(joinedPush(pushMessages)==text); // Failure retries the same unsent chunk, then every field arrives.
 CSNotifier tgOnly;tgOnly.Init(false,true,"DUMMY_TOKEN","DUMMY_CHAT","telegram-only");tgOnly.Add("ENTRY_FILLED_C_1",sell);auto before=telegramBodies.size();tgOnly.Pump(500);
 CHECK(telegramBodies.size()==before+1&&telegram.Parse(telegramBodies.back())&&telegram.Text(telegram.Get(0,"text"))==sell);
 CSState state;CHECK(state.Init("basket-state","XAUUSDc",77,false));
 state.basket="0123456789abcdef";state.side=1;state.first=100;state.sl=4240;state.tp=4278;
 state.awal=1;state.pending=true;state.pendingCore=false;state.pendingOrder=9007199254740995UL;
 state.AddId(9007199254740993L);state.Remember(state.spent,"windowA",256);state.noticeContext=CSNoticeContextEncode(decoded);
 CHECK(state.Save());CSState recovered;CHECK(recovered.Init("basket-state","XAUUSDc",77,false));
 CHECK(recovered.pending&&recovered.pendingOrder==9007199254740995UL&&recovered.ids[0]==9007199254740993L);
 CHECK(recovered.noticeContext==state.noticeContext&&recovered.awal==1&&recovered.sl==4240&&recovered.tp==4278);
 auto raw=testFiles.at("basket-state");auto marker=raw.rfind(",\"notice_context\":");CHECK(marker!=std::string::npos);
 auto version2=raw.substr(0,marker)+"}";version2.replace(version2.find("\"version\":3"),11,"\"version\":2");testFiles["legacy-v2"]=version2;
 CSState v2;CHECK(v2.Init("legacy-v2","XAUUSDc",77,false)&&v2.noticeContext==""&&v2.pending&&v2.pendingOrder==state.pendingOrder);
 CHECK(v2.awal==1&&v2.sl==4240&&v2.Contains(v2.spent,"windowA"));
 auto version1=version2;version1.replace(version1.find("\"version\":2"),11,"\"version\":1");
 for(const std::string field:{"\"pending_core\":false,","\"pending_order\":\"9007199254740995\","})version1.erase(version1.find(field),field.size());
 testFiles["legacy-v1"]=version1;CSState v1;CHECK(v1.Init("legacy-v1","XAUUSDc",77,false));
 CHECK(v1.pending&&v1.pendingOrder==0&&v1.awal==1&&v1.sl==4240&&v1.noticeContext=="");
 if(argc==2){std::ofstream out(argv[1]);out<<text.utf8()<<'\n';}
 std::cout<<"PASS "<<checks<<" assertions on production notification formatter, multipart push and durable outbox (host API adapter; no external messages sent)\n";
}
