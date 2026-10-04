// Pure NEWS ATTACK policy. UTC seconds, half-open windows. No prices/forecast-based bias.
#ifndef CEBONK_C2_NEWS_POLICY
#define CEBONK_C2_NEWS_POLICY
struct C2NewsItem { ulong id; long utc,known; string name; };
enum C2_NEWS_PHASE { C2_NEWS_DATA_WAIT=0,C2_NEWS_NORMAL=1,C2_NEWS_LOCK=2,C2_NEWS_ATTACK=3,C2_NEWS_LATE=4 };
int C2NewsRoute(const C2NewsItem &items[],const long now,const long from,const long to,const bool healthy,
 const int pre,const int delay,const int finish,int &selected) {
 selected=-1;
 if(!healthy||from>now-finish||to<=now+pre)return C2_NEWS_DATA_WAIT;
 // A second release's pre/cooldown lock overrides any attack window.
 for(int i=0;i<ArraySize(items);i++)if(now>=items[i].utc-pre&&now<items[i].utc+delay){
  if(selected<0||items[i].utc<items[selected].utc)selected=i;
 }
 if(selected>=0)return C2_NEWS_LOCK;
 for(int i=0;i<ArraySize(items);i++)if(now>=items[i].utc+delay&&now<items[i].utc+finish){
  if(selected<0||items[i].utc>items[selected].utc||
    (items[i].utc==items[selected].utc&&items[i].known<items[selected].known))selected=i;
 }
 if(selected<0)return C2_NEWS_NORMAL;
 return items[selected].known<=items[selected].utc?C2_NEWS_ATTACK:C2_NEWS_LATE;
}
bool C2NewsNormalRange(const C2NewsItem &items[],const long start,const long now,const int pre,const int finish) {
 if(start>now)return false;
 for(int i=0;i<ArraySize(items);i++)if(start<items[i].utc+finish&&now>=items[i].utc-pre)return false;
 return true;
}
bool C2NewsTriggerTime(const long start,const long close,const long now,const long cbBreak,const long release,
 const int delay,const int finish) {
 return start>=release+delay&&close>start&&close<=now&&now<release+finish&&cbBreak>=release&&cbBreak<=start;
}
bool C2NewsM5Policy(const C2Event &m5,const int dir,const double lastClose,const long triggerStart,const int maxAge) {
 if(m5.dir!=dir||(m5.stage!=C2_WAIT_RETEST&&m5.stage!=C2_VALID))return false;
 if(m5.breakAt<=0||m5.breakAt>triggerStart||m5.known>triggerStart||triggerStart-m5.breakAt>maxAge)return false;
 return dir==1?lastClose>m5.cb:lastClose<m5.cb;
}
#endif
