#property strict
#property script_show_inputs
#include <CebonkSwing/NumericCore.mqh>
#include <CebonkSwing/FeedValidator.mqh>
input string InpFixture="swing-forecast-v2.history.jsonl";
int Checks=0,Failures=0;
void Check(bool condition,string label){Checks++;if(!condition){Failures++;Print("FAIL ",label);}}
void OnStart(){
 CSJson j;Check(j.Parse("{\"a\":[true,null,{\"s\":\"\\uD83D\\uDE00\"}],\"n\":-1.2e2}"),"JSON nested and unicode");
 Check(j.Number(j.Get(0,"n"))==-120,"JSON exponent");Check(!j.Parse("{\"a\":1,\"a\":2}"),"duplicate key rejected");
 Check(!j.Parse("[1,]"),"trailing comma rejected");Check(!j.Parse("[01]"),"leading zero rejected");
 Check(!j.Parse("\"\\uD800\""),"unpaired surrogate rejected");
 double raw=0,sl=0;Check(CSSL(1,3299.1,3300,3300,3310,.01,-.236,raw,sl)&&MathAbs(sl-3297.64)<1e-7,"BUY -0.236");
 Check(CSSL(-1,3300,3300.9,3300,3290,.01,-.236,raw,sl)&&MathAbs(sl-3302.36)<1e-7,"SELL -0.236");
 Check(CSSL(1,3299.1,3300,3300,3310,.01,-.382,raw,sl)&&MathAbs(sl-3296.18)<1e-7,"BUY custom -0.382");
 Check(CSSL(-1,3300,3300.9,3300,3290,.01,-.618,raw,sl)&&MathAbs(sl-3306.18)<1e-7,"SELL custom -0.618");
 Check(!CSSL(1,3299.1,3300,3300,3310,.01,0,raw,sl)&&!CSSL(1,3299.1,3300,3300,3310,.01,.236,raw,sl),"zero and positive SL levels rejected");
 Check(CSShouldExit(1,-1,12,true)&&!CSShouldExit(1,-1,0,true)&&!CSShouldExit(1,-1,12,false),"NET exit");
 CSWeekLatch lock;lock.Clear();Check(lock.Capture(1800000000,-1,1800000001),"weekly capture");
 Check(!lock.Capture(1800000000,1,1800086400)&&lock.side==-1,"weekly cannot flip");
 Check(!CSAligned(-1,-1,1),"opposite session WAIT");
 Check(!CSShouldExit(1,-1,CSDealNetContribution(-100,0,-1,0)+20,true),"closed loss included in NET");
 Check(CSOrderOutcome(10012)==CS_ORDER_UNKNOWN&&CSOrderOutcome(10004)==CS_ORDER_REJECTED,"uncertain versus rejected order");
 int f=FileOpen(InpFixture,FILE_READ|FILE_TXT|FILE_ANSI,0,CP_UTF8);Check(f!=INVALID_HANDLE,"fixture open");
 if(f!=INVALID_HANDLE){string text=FileReadString(f);FileClose(f);Check(j.Parse(text)&&j.VerifyHash(text),"fixture SHA-256");
  datetime when=(datetime)j.Number(j.Get(0,"generated_at_utc"));CSFeed feed;Check(feed.Accept(text,when+1),"full MT5 feed validation: "+feed.error);}
 PrintFormat("CEBONK_SELFTEST checks=%d failures=%d",Checks,Failures);
}
