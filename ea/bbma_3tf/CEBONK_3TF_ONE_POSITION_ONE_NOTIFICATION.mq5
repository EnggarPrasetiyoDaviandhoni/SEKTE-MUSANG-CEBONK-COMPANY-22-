//+------------------------------------------------------------------+
//| CEBONK BBMA 3TF SSOT v1.13 BALANCED + SIDEWAYS + SESSION                    |
//| SEKTE MUSANG TEORY - CEBONK COMPANY 22                          |
//| Standalone EA: custom modules embedded; no CEBONK include folder required    |
//+------------------------------------------------------------------+
#property strict
#property version   "1.13"
#property description "BBMA 3TF Balanced | MA50 Cross/Align | CB1 Scan | Adaptive Retest | Sideways | WIB GMT+3"

#include <Trade/Trade.mqh>

// Custom CEBONK modules are embedded below to avoid missing-include errors.
//==================================================================
// INLINE MODULE: BBMA3TF_Core.mqh
//==================================================================
//==================================================================
// CEBONK BBMA 3TF - SHARED CORE (SSOT)
// Trading rules live ONLY here so EA and Indicator cannot drift.
// TF1 Re-entry -> TF2 CSAK/CSM + MA50 x MidBB -> TF3 CB1 retest.
//==================================================================

struct C3Config
{
   string          symbol;
   bool            enable_buy;
   bool            enable_sell;
   ENUM_TIMEFRAMES tf1;
   ENUM_TIMEFRAMES tf2;
   ENUM_TIMEFRAMES tf3;

   int             bb_period;
   double          bb_deviation;
   int             ma_fast;
   int             ma_slow;
   int             reentry_max_bars;

   bool            use_csak;
   bool            use_csm;
   int             ma50_period;
   ENUM_MA_METHOD  ma50_method;
   int             tf2_fresh_bars;
   int             tf2_pair_max_gap_bars;
   bool            allow_ma50_alignment;
   double          ma50_min_sep_ratio;

   int             pivot_depth;
   int             cb1_lookback;
   int             setup_expiry_bars;
   int             cb1_buffer_points;
};

struct C3SetupState
{
   int      dir;
   datetime re_time;
   datetime tf2_time;
   bool     cb1_armed;
   double   cb1;
   double   extreme;
   double   break_close;
   datetime break_time;
   string   tf2_signal;
   string   ma_cross;
};

struct C3Events
{
   bool     reentry;
   bool     tf2_confirm;
   bool     cb1_armed;
   bool     retest;
   bool     expired;
   int      dir;
   double   retest_price;
};

void C3ResetState(C3SetupState &s)
{
   s.dir=0;
   s.re_time=0;
   s.tf2_time=0;
   s.cb1_armed=false;
   s.cb1=0.0;
   s.extreme=0.0;
   s.break_close=0.0;
   s.break_time=0;
   s.tf2_signal="";
   s.ma_cross="";
}

void C3ResetEvents(C3Events &e)
{
   e.reentry=false;
   e.tf2_confirm=false;
   e.cb1_armed=false;
   e.retest=false;
   e.expired=false;
   e.dir=0;
   e.retest_price=0.0;
}

class CBBMA3TFCore
{
private:
   C3Config m_cfg;
   string   m_sym;

   bool ReadMA(const ENUM_TIMEFRAMES tf,const int period,const ENUM_MA_METHOD method,
               const ENUM_APPLIED_PRICE price,const int shift,double &v)
   {
      int h=iMA(m_sym,tf,period,0,method,price);
      if(h==INVALID_HANDLE) return false;
      double a[1];
      bool ok=(CopyBuffer(h,0,shift,1,a)==1);
      IndicatorRelease(h);
      if(ok) v=a[0];
      return ok;
   }

   bool ReadBB(const ENUM_TIMEFRAMES tf,const int shift,double &mid,double &upper,double &lower)
   {
      int h=iBands(m_sym,tf,m_cfg.bb_period,0,m_cfg.bb_deviation,PRICE_CLOSE);
      if(h==INVALID_HANDLE) return false;
      double b0[1],b1[1],b2[1];
      bool ok=(CopyBuffer(h,0,shift,1,b0)==1 &&
               CopyBuffer(h,1,shift,1,b1)==1 &&
               CopyBuffer(h,2,shift,1,b2)==1);
      IndicatorRelease(h);
      if(ok){ mid=b0[0]; upper=b1[0]; lower=b2[0]; }
      return ok;
   }

   bool PivotLow(const int s)
   {
      double x=iLow(m_sym,m_cfg.tf3,s);
      if(x<=0) return false;
      for(int k=1;k<=m_cfg.pivot_depth;k++)
         if(iLow(m_sym,m_cfg.tf3,s-k)<=x || iLow(m_sym,m_cfg.tf3,s+k)<x) return false;
      return true;
   }

   bool PivotHigh(const int s)
   {
      double x=iHigh(m_sym,m_cfg.tf3,s);
      if(x<=0) return false;
      for(int k=1;k<=m_cfg.pivot_depth;k++)
         if(iHigh(m_sym,m_cfg.tf3,s-k)>=x || iHigh(m_sym,m_cfg.tf3,s+k)>x) return false;
      return true;
   }

public:
   bool Configure(const C3Config &cfg)
   {
      m_cfg=cfg;
      m_sym=(cfg.symbol=="" ? _Symbol : cfg.symbol);
      return SymbolSelect(m_sym,true);
   }

   string SymbolName(){ return m_sym; }
   string SideText(const int dir){ return(dir>0 ? "BUY" : "SELL"); }

   datetime BarCloseTime(const ENUM_TIMEFRAMES tf,const int shift)
   {
      datetime t=iTime(m_sym,tf,shift);
      int sec=PeriodSeconds(tf);
      return(t>0 && sec>0 ? t+sec : 0);
   }

   bool NewBar(const ENUM_TIMEFRAMES tf,datetime &cache)
   {
      datetime t=iTime(m_sym,tf,0);
      if(t<=0) return false;
      if(cache==0){ cache=t; return false; }
      if(t!=cache){ cache=t; return true; }
      return false;
   }

   bool ValidateConfig()
   {
      return(m_cfg.bb_period>0 && m_cfg.bb_deviation>0.0 &&
             m_cfg.ma_fast>0 && m_cfg.ma_slow>0 && m_cfg.reentry_max_bars>0 &&
             (m_cfg.use_csak || m_cfg.use_csm) && m_cfg.ma50_period>0 &&
             m_cfg.tf2_fresh_bars>0 && m_cfg.tf2_pair_max_gap_bars>=0 &&
             m_cfg.ma50_min_sep_ratio>=0.0 && m_cfg.ma50_min_sep_ratio<=0.50 &&
             m_cfg.pivot_depth>0 && m_cfg.cb1_lookback>=20 &&
             m_cfg.setup_expiry_bars>0 && m_cfg.cb1_buffer_points>=0);
   }

   // TF1: wick touches MA5/MA10, close defends them, MA band is on trend side of MidBB.
   bool DetectReentry(int &dir,datetime &sigtime)
   {
      dir=0; sigtime=0;
      const int s=1;
      double h=iHigh(m_sym,m_cfg.tf1,s), l=iLow(m_sym,m_cfg.tf1,s), c=iClose(m_sym,m_cfg.tf1,s);
      if(h==0 || l==0 || c==0) return false;

      double ma5L,ma10L,ma5H,ma10H,mid,up,dn;
      if(!ReadMA(m_cfg.tf1,m_cfg.ma_fast,MODE_LWMA,PRICE_LOW,s,ma5L) ||
         !ReadMA(m_cfg.tf1,m_cfg.ma_slow,MODE_LWMA,PRICE_LOW,s,ma10L) ||
         !ReadMA(m_cfg.tf1,m_cfg.ma_fast,MODE_LWMA,PRICE_HIGH,s,ma5H) ||
         !ReadMA(m_cfg.tf1,m_cfg.ma_slow,MODE_LWMA,PRICE_HIGH,s,ma10H) ||
         !ReadBB(m_cfg.tf1,s,mid,up,dn)) return false;

      bool buy=(l<=MathMax(ma5L,ma10L) && c>ma5L && c>ma10L && ma5L>mid && ma10L>mid);
      bool sell=(h>=MathMin(ma5H,ma10H) && c<ma5H && c<ma10H && ma5H<mid && ma10H<mid);

      if(buy && m_cfg.enable_buy) dir=1;
      else if(sell && m_cfg.enable_sell) dir=-1;
      else return false;

      sigtime=BarCloseTime(m_cfg.tf1,s);
      return(sigtime>0);
   }

   bool DirectionalSignalAt(const int wanted,const int s,string &name)
   {
      name="";
      double o=iOpen(m_sym,m_cfg.tf2,s), c=iClose(m_sym,m_cfg.tf2,s);
      if(o==0 || c==0) return false;

      double mid,up,dn;
      if(!ReadBB(m_cfg.tf2,s,mid,up,dn)) return false;

      if(m_cfg.use_csm)
      {
         if(wanted>0 && c>o && o<=up && c>up){ name="CSM"; return true; }
         if(wanted<0 && c<o && o>=dn && c<dn){ name="CSM"; return true; }
      }

      if(m_cfg.use_csak)
      {
         double ma5,ma10;
         if(wanted>0)
         {
            if(!ReadMA(m_cfg.tf2,m_cfg.ma_fast,MODE_LWMA,PRICE_HIGH,s,ma5) ||
               !ReadMA(m_cfg.tf2,m_cfg.ma_slow,MODE_LWMA,PRICE_HIGH,s,ma10)) return false;
            double barrier=MathMax(MathMax(ma5,ma10),mid);
            if(c>o && o<=barrier && c>barrier){ name="CSAK"; return true; }
         }
         else
         {
            if(!ReadMA(m_cfg.tf2,m_cfg.ma_fast,MODE_LWMA,PRICE_LOW,s,ma5) ||
               !ReadMA(m_cfg.tf2,m_cfg.ma_slow,MODE_LWMA,PRICE_LOW,s,ma10)) return false;
            double barrier=MathMin(MathMin(ma5,ma10),mid);
            if(c<o && o>=barrier && c<barrier){ name="CSAK"; return true; }
         }
      }
      return false;
   }

   // Strict event: BUY = MidBB moves above MA50; SELL = MidBB moves below MA50.
   bool MA50CrossAt(const int wanted,const int s,string &label)
   {
      label="";
      double maNow,maPrev,midNow,up,dn,midPrev,up2,dn2;
      if(!ReadMA(m_cfg.tf2,m_cfg.ma50_period,m_cfg.ma50_method,PRICE_CLOSE,s,maNow) ||
         !ReadMA(m_cfg.tf2,m_cfg.ma50_period,m_cfg.ma50_method,PRICE_CLOSE,s+1,maPrev) ||
         !ReadBB(m_cfg.tf2,s,midNow,up,dn) ||
         !ReadBB(m_cfg.tf2,s+1,midPrev,up2,dn2)) return false;

      if(wanted>0 && maPrev>=midPrev && maNow<midNow)
      { label="MA50 x MID BB BUY"; return true; }
      if(wanted<0 && maPrev<=midPrev && maNow>midNow)
      { label="MA50 x MID BB SELL"; return true; }
      return false;
   }

   // Balanced fallback: if no fresh exact cross exists, allow a valid CSAK/CSM
   // while MA50 is already on the correct side of MidBB with real separation.
   bool MA50AlignedAt(const int wanted,const int s,string &label)
   {
      label="";
      double ma,mid,up,dn;
      if(!ReadMA(m_cfg.tf2,m_cfg.ma50_period,m_cfg.ma50_method,PRICE_CLOSE,s,ma) ||
         !ReadBB(m_cfg.tf2,s,mid,up,dn)) return false;

      double width=up-dn;
      if(width<=0.0) return false;
      double sep=MathAbs(mid-ma)/width;
      if(sep<m_cfg.ma50_min_sep_ratio) return false;

      if(wanted>0 && ma<mid){ label="MA50 < MID BB ALIGNED"; return true; }
      if(wanted<0 && ma>mid){ label="MA50 > MID BB ALIGNED"; return true; }
      return false;
   }

   // Keep the original strict pair for reversal protection.
   bool DetectTF2StrictConfirm(const int wanted,const datetime minTime,
                               datetime &sigtime,string &signalName,string &crossName)
   {
      sigtime=0; signalName=""; crossName="";
      int bestFresh=2147483647, bestGap=2147483647;

      for(int ss=1;ss<=m_cfg.tf2_fresh_bars;ss++)
      {
         datetime st=BarCloseTime(m_cfg.tf2,ss);
         if(st<minTime) continue;
         string sig;
         if(!DirectionalSignalAt(wanted,ss,sig)) continue;

         for(int cs=1;cs<=m_cfg.tf2_fresh_bars;cs++)
         {
            datetime ct=BarCloseTime(m_cfg.tf2,cs);
            if(ct<minTime) continue;
            string cross;
            if(!MA50CrossAt(wanted,cs,cross)) continue;

            int gap=(int)MathAbs(ss-cs);
            if(gap>m_cfg.tf2_pair_max_gap_bars) continue;
            int fresh=MathMax(ss,cs);

            if(fresh<bestFresh || (fresh==bestFresh && gap<bestGap))
            {
               bestFresh=fresh;
               bestGap=gap;
               signalName=sig;
               crossName=cross;
               sigtime=(st>ct ? st : ct);
            }
         }
      }
      return(sigtime>0);
   }

   // Entry mode: exact cross first; alignment is fallback only.
   bool DetectTF2Confirm(const int wanted,const datetime minTime,
                         datetime &sigtime,string &signalName,string &crossName)
   {
      if(DetectTF2StrictConfirm(wanted,minTime,sigtime,signalName,crossName))
         return true;

      sigtime=0; signalName=""; crossName="";
      if(!m_cfg.allow_ma50_alignment) return false;

      for(int ss=1;ss<=m_cfg.tf2_fresh_bars;ss++)
      {
         datetime st=BarCloseTime(m_cfg.tf2,ss);
         if(st<minTime) continue;

         string sig,align;
         if(!DirectionalSignalAt(wanted,ss,sig)) continue;
         if(!MA50AlignedAt(wanted,ss,align)) continue;

         signalName=sig;
         crossName=align;
         sigtime=st;
         return true;
      }
      return false;
   }

   // BUY CB1: newer pivot low < older pivot low; CB1 = highest high between pivots.
   // SELL CB1: newer pivot high > older pivot high; CB1 = lowest low between pivots.
   // v1.10 scans multiple adjacent pivot pairs, not only the two freshest.
   bool FindCB1Since(const int dir,const datetime minBreakTime,
                     double &cb1,double &extreme,double &breakClose,datetime &breakTime)
   {
      cb1=0; extreme=0; breakClose=0; breakTime=0;
      int bars=Bars(m_sym,m_cfg.tf3);
      if(bars<m_cfg.cb1_lookback+m_cfg.pivot_depth+5) return false;

      int maxAllowed=bars-m_cfg.pivot_depth-2;
      int maxS=(m_cfg.cb1_lookback<maxAllowed ? m_cfg.cb1_lookback : maxAllowed);

      int piv[32];
      int n=0;
      for(int s=m_cfg.pivot_depth+1;s<=maxS && n<32;s++)
      {
         bool p=(dir>0 ? PivotLow(s) : PivotHigh(s));
         if(p) piv[n++]=s;
      }
      if(n<2) return false;

      for(int i=0;i<n-1;i++)
      {
         int p1=piv[i], p2=piv[i+1];

         if(dir>0)
         {
            double newer=iLow(m_sym,m_cfg.tf3,p1), older=iLow(m_sym,m_cfg.tf3,p2);
            if(!(newer<older)) continue;

            double level=-DBL_MAX;
            for(int s=p1;s<=p2;s++) level=MathMax(level,iHigh(m_sym,m_cfg.tf3,s));

            for(int s=p1-1;s>=1;s--)
            {
               datetime bt=BarCloseTime(m_cfg.tf3,s);
               double c=iClose(m_sym,m_cfg.tf3,s);
               if(c>level && bt>=minBreakTime)
               {
                  cb1=level; extreme=newer; breakClose=c; breakTime=bt;
                  return true;
               }
            }
         }
         else
         {
            double newer=iHigh(m_sym,m_cfg.tf3,p1), older=iHigh(m_sym,m_cfg.tf3,p2);
            if(!(newer>older)) continue;

            double level=DBL_MAX;
            for(int s=p1;s<=p2;s++) level=MathMin(level,iLow(m_sym,m_cfg.tf3,s));

            for(int s=p1-1;s>=1;s--)
            {
               datetime bt=BarCloseTime(m_cfg.tf3,s);
               double c=iClose(m_sym,m_cfg.tf3,s);
               if(c<level && bt>=minBreakTime)
               {
                  cb1=level; extreme=newer; breakClose=c; breakTime=bt;
                  return true;
               }
            }
         }
      }
      return false;
   }

   bool RetestTouched(const C3SetupState &s,double &price)
   {
      price=0.0;
      if(!s.cb1_armed || s.dir==0 || s.cb1<=0) return false;
      MqlTick tk;
      if(!SymbolInfoTick(m_sym,tk)) return false;
      double pt=SymbolInfoDouble(m_sym,SYMBOL_POINT);
      if(pt<=0) return false;
      double spreadPts=(tk.ask-tk.bid)/pt;
      double zonePts=MathMax((double)m_cfg.cb1_buffer_points,spreadPts*1.20);
      double zone=zonePts*pt;
      price=(s.dir>0 ? tk.ask : tk.bid);
      return(price>=s.cb1-zone && price<=s.cb1+zone);
   }

   // Shared state machine for EA and Indicator.
   void PollSetup(C3SetupState &s,datetime &bar1,datetime &bar2,datetime &bar3,C3Events &ev)
   {
      C3ResetEvents(ev);
      bool nb1=NewBar(m_cfg.tf1,bar1);
      bool nb2=NewBar(m_cfg.tf2,bar2);
      bool nb3=NewBar(m_cfg.tf3,bar3);

      if(nb1)
      {
         int d=0; datetime t=0;
         if(DetectReentry(d,t))
         {
            C3ResetState(s);
            s.dir=d; s.re_time=t;
            ev.reentry=true; ev.dir=d;
         }
         else if(s.dir!=0 && s.re_time>0)
         {
            int sec=PeriodSeconds(m_cfg.tf1);
            int age=(sec>0 ? (int)MathFloor((double)(TimeCurrent()-s.re_time)/sec) : 0);
            if(age<0 || age>m_cfg.reentry_max_bars)
            {
               C3ResetState(s);
               ev.expired=true;
            }
         }
      }

      if(s.dir!=0 && s.re_time>0 && nb2)
      {
         datetime t=0; string sig="",cross="";
         if(DetectTF2Confirm(s.dir,s.re_time,t,sig,cross) && t>s.tf2_time)
         {
            s.tf2_time=t;
            s.tf2_signal=sig;
            s.ma_cross=cross;
            s.cb1_armed=false;
            s.cb1=0; s.extreme=0; s.break_close=0; s.break_time=0;
            ev.tf2_confirm=true; ev.dir=s.dir;
         }
      }

      if(s.dir!=0 && s.tf2_time>0 && nb3)
      {
         int sec=PeriodSeconds(m_cfg.tf3);
         int age=(sec>0 ? (int)MathFloor((double)(TimeCurrent()-s.tf2_time)/sec) : 0);
         if(age<0 || age>m_cfg.setup_expiry_bars)
         {
            C3ResetState(s);
            ev.expired=true;
         }
         else if(!s.cb1_armed)
         {
            double c,e,bc; datetime bt;
            if(FindCB1Since(s.dir,s.tf2_time,c,e,bc,bt))
            {
               s.cb1=c;
               s.extreme=e;
               s.break_close=bc;
               s.break_time=bt;
               s.cb1_armed=true;
               ev.cb1_armed=true; ev.dir=s.dir;
            }
         }
      }

      double px=0;
      if(RetestTouched(s,px))
      {
         ev.retest=true;
         ev.dir=s.dir;
         ev.retest_price=px;
      }
   }
};

//==================================================================
// INLINE MODULE: BBMA3TF_Sideways.mqh
//==================================================================
//==================================================================
// CEBONK SIDEWAYS DETECTOR
// No ATR. Uses closed candles only:
// 1) Bollinger Band compression vs older baseline
// 2) MidBB flatness
// 3) MA50 flatness
// 4) Directional efficiency (chop)
// 5) MidBB cross count
//==================================================================

struct C3SidewaysConfig
{
   string          symbol;
   ENUM_TIMEFRAMES tf;
   int             bb_period;
   double          bb_deviation;
   int             ma_period;
   ENUM_MA_METHOD  ma_method;
   int             recent_bars;
   int             baseline_bars;
   double          compression_max;
   double          mid_slope_max;
   double          ma_slope_max;
   double          efficiency_max;
   int             min_mid_crosses;
   int             min_score;
};

struct C3SidewaysState
{
   bool   sideways;
   int    score;
   double compression;
   double mid_slope;
   double ma_slope;
   double efficiency;
   int    mid_crosses;
   string mode;
};

void C3ResetSidewaysState(C3SidewaysState &s)
{
   s.sideways=false;
   s.score=0;
   s.compression=0.0;
   s.mid_slope=0.0;
   s.ma_slope=0.0;
   s.efficiency=1.0;
   s.mid_crosses=0;
   s.mode="TRENDING";
}

class CBBMA3TFSideways
{
private:
   C3SidewaysConfig m_cfg;
   string            m_sym;

   bool ReadBB(const int shift,double &mid,double &upper,double &lower)
   {
      int h=iBands(m_sym,m_cfg.tf,m_cfg.bb_period,0,m_cfg.bb_deviation,PRICE_CLOSE);
      if(h==INVALID_HANDLE) return false;
      double b0[1],b1[1],b2[1];
      bool ok=(CopyBuffer(h,0,shift,1,b0)==1 &&
               CopyBuffer(h,1,shift,1,b1)==1 &&
               CopyBuffer(h,2,shift,1,b2)==1);
      IndicatorRelease(h);
      if(ok){ mid=b0[0]; upper=b1[0]; lower=b2[0]; }
      return ok;
   }

   bool ReadMA(const int shift,double &v)
   {
      int h=iMA(m_sym,m_cfg.tf,m_cfg.ma_period,0,m_cfg.ma_method,PRICE_CLOSE);
      if(h==INVALID_HANDLE) return false;
      double a[1];
      bool ok=(CopyBuffer(h,0,shift,1,a)==1);
      IndicatorRelease(h);
      if(ok) v=a[0];
      return ok;
   }

public:
   bool Configure(const C3SidewaysConfig &cfg)
   {
      m_cfg=cfg;
      m_sym=(cfg.symbol=="" ? _Symbol : cfg.symbol);
      return SymbolSelect(m_sym,true);
   }

   bool ValidateConfig()
   {
      return(m_cfg.bb_period>0 && m_cfg.bb_deviation>0.0 &&
             m_cfg.ma_period>0 && m_cfg.recent_bars>=4 &&
             m_cfg.baseline_bars>=m_cfg.recent_bars+10 &&
             m_cfg.compression_max>0.0 && m_cfg.compression_max<=1.50 &&
             m_cfg.mid_slope_max>=0.0 && m_cfg.ma_slope_max>=0.0 &&
             m_cfg.efficiency_max>0.0 && m_cfg.efficiency_max<1.0 &&
             m_cfg.min_mid_crosses>=1 && m_cfg.min_mid_crosses<m_cfg.recent_bars &&
             m_cfg.min_score>=3 && m_cfg.min_score<=5);
   }

   ENUM_TIMEFRAMES Timeframe(){ return m_cfg.tf; }
   string SymbolName(){ return m_sym; }

   bool Evaluate(C3SidewaysState &out)
   {
      C3ResetSidewaysState(out);
      if(!ValidateConfig()) return false;
      if(Bars(m_sym,m_cfg.tf)<m_cfg.baseline_bars+m_cfg.ma_period+10) return false;

      double recentWidthSum=0.0, oldWidthSum=0.0;
      int recentCount=0, oldCount=0;
      double midFirst=0.0,midLast=0.0,maFirst=0.0,maLast=0.0;
      double prevDelta=0.0;
      bool havePrev=false;
      int crosses=0;
      double path=0.0;
      double closeFirst=0.0,closeLast=0.0,prevClose=0.0;

      for(int s=1;s<=m_cfg.baseline_bars;s++)
      {
         double mid,up,dn;
         if(!ReadBB(s,mid,up,dn)) return false;
         double width=up-dn;
         if(width<=0.0) return false;

         if(s<=m_cfg.recent_bars)
         {
            recentWidthSum+=width;
            recentCount++;

            double c=iClose(m_sym,m_cfg.tf,s);
            if(c<=0.0) return false;
            double delta=c-mid;
            if(havePrev && ((delta>0.0 && prevDelta<0.0) || (delta<0.0 && prevDelta>0.0))) crosses++;
            prevDelta=delta;
            havePrev=true;

            if(s==1){ midFirst=mid; closeFirst=c; prevClose=c; }
            else path+=MathAbs(prevClose-c);
            prevClose=c;
            if(s==m_cfg.recent_bars){ midLast=mid; closeLast=c; }
         }
         else
         {
            oldWidthSum+=width;
            oldCount++;
         }
      }

      if(recentCount<=0 || oldCount<=0) return false;
      double recentWidth=recentWidthSum/recentCount;
      double oldWidth=oldWidthSum/oldCount;
      if(recentWidth<=0.0 || oldWidth<=0.0) return false;

      if(!ReadMA(1,maFirst) || !ReadMA(m_cfg.recent_bars,maLast)) return false;

      out.compression=recentWidth/oldWidth;
      out.mid_slope=MathAbs(midFirst-midLast)/recentWidth;
      out.ma_slope=MathAbs(maFirst-maLast)/recentWidth;
      out.efficiency=(path>0.0 ? MathAbs(closeFirst-closeLast)/path : 0.0);
      out.mid_crosses=crosses;

      bool compressed=(out.compression<=m_cfg.compression_max);
      bool midFlat=(out.mid_slope<=m_cfg.mid_slope_max);
      bool maFlat=(out.ma_slope<=m_cfg.ma_slope_max);
      bool choppy=(out.efficiency<=m_cfg.efficiency_max);
      bool crossing=(out.mid_crosses>=m_cfg.min_mid_crosses);

      out.score=(compressed?1:0)+(midFlat?1:0)+(maFlat?1:0)+(choppy?1:0)+(crossing?1:0);

      // Balanced mode: block only stronger sideways consensus.
      bool compressionSideways=(compressed && out.score>=m_cfg.min_score);
      bool rangeChop=(midFlat && maFlat && choppy && crossing && out.score>=m_cfg.min_score);

      out.sideways=(compressionSideways || rangeChop);
      if(out.sideways) out.mode=(compressionSideways ? "COMPRESSION" : "RANGE_CHOP");
      else out.mode="TRENDING";
      return true;
   }
};

//==================================================================
// INLINE MODULE: BBMA3TF_Session.mqh
//==================================================================
//==================================================================
// CEBONK BBMA 3TF - TRADING SESSION HELPER
// Session input is expressed in WIB (UTC+7).
// Broker clock is assumed fixed to the configured GMT offset.
//==================================================================

bool C3ValidClock(const int h,const int m)
{
   return(h>=0 && h<=23 && m>=0 && m<=59);
}

int C3MinutesOfDay(const int h,const int m)
{
   return h*60+m;
}

int C3WrapMinutes(int m)
{
   m%=1440;
   if(m<0) m+=1440;
   return m;
}

bool C3SessionOpenWIB(const bool enabled,
                      const int broker_gmt_offset,
                      const int start_hour_wib,const int start_min_wib,
                      const int end_hour_wib,const int end_min_wib,
                      int &wib_minutes_now)
{
   if(!enabled)
   {
      wib_minutes_now=-1;
      return true;
   }

   MqlDateTime st;
   if(!TimeToStruct(TimeCurrent(),st))
   {
      wib_minutes_now=-1;
      return false;
   }

   // TimeCurrent() follows broker/server time in live trading and Strategy Tester.
   const int server_minutes=st.hour*60+st.min;
   const int shift_to_wib=(7-broker_gmt_offset)*60;
   wib_minutes_now=C3WrapMinutes(server_minutes+shift_to_wib);

   const int start_m=C3MinutesOfDay(start_hour_wib,start_min_wib);
   const int end_m=C3MinutesOfDay(end_hour_wib,end_min_wib);

   // Equal start/end means full 24h session.
   if(start_m==end_m) return true;
   if(start_m<end_m) return(wib_minutes_now>=start_m && wib_minutes_now<end_m);
   return(wib_minutes_now>=start_m || wib_minutes_now<end_m); // crosses midnight
}

int C3WIBToServerMinutes(const int wib_hour,const int wib_min,const int broker_gmt_offset)
{
   const int wib=C3MinutesOfDay(wib_hour,wib_min);
   return C3WrapMinutes(wib-(7-broker_gmt_offset)*60);
}

string C3ClockText(const int minutes)
{
   const int m=C3WrapMinutes(minutes);
   return StringFormat("%02d:%02d",m/60,m%60);
}

//==================================================================
// INLINE MODULE: BBMA3TF_Notify.mqh
//==================================================================
//==================================================================
// Notification module only. No trading rules here.
//==================================================================
class CBBMA3TFNotify
{
private:
   string m_symbol, m_token, m_chat_id;
   bool m_telegram, m_push;
   int m_timeout;

   string PriceText(const double value)
   {
      return DoubleToString(value,(int)SymbolInfoInteger(m_symbol,SYMBOL_DIGITS));
   }

   string UrlEncode(const string value)
   {
      uchar data[];
      int n=StringToCharArray(value,data,0,WHOLE_ARRAY,CP_UTF8);
      string out="",hex="0123456789ABCDEF";
      for(int i=0;i<n-1;i++)
      {
         int c=(int)data[i];
         if((c>='A' && c<='Z') || (c>='a' && c<='z') ||
            (c>='0' && c<='9') || c=='-' || c=='_' || c=='.' || c=='~')
            out+=CharToString((uchar)c);
         else
            out+="%"+StringSubstr(hex,(c>>4)&15,1)+StringSubstr(hex,c&15,1);
      }
      return out;
   }

   bool TelegramSend(const string msg)
   {
      if(!m_telegram)
      {
         Print("TELEGRAM SKIPPED: InpTelegram=false");
         return false;
      }
      if(m_token=="" || m_chat_id=="")
      {
         Print("TELEGRAM SKIPPED: configure InpTelegramToken + InpTelegramChatID");
         return false;
      }
      if(MQLInfoInteger(MQL_TESTER))
      {
         Print("TELEGRAM SKIPPED: unavailable in Strategy Tester");
         return false;
      }

      string url="https://api.telegram.org/bot"+m_token+"/sendMessage";
      string body="chat_id="+UrlEncode(m_chat_id)+"&text="+UrlEncode(msg)+
                  "&disable_web_page_preview=true";
      string headers="Content-Type: application/x-www-form-urlencoded\r\n";
      char data[],response[];
      string response_headers;
      int n=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
      if(n>0) ArrayResize(data,n-1);

      ResetLastError();
      int code=WebRequest("POST",url,headers,m_timeout,data,response,response_headers);
      string reply=CharArrayToString(response,0,-1,CP_UTF8);
      if(code!=200 || StringFind(reply,"\"ok\":true")<0)
      {
         Print("Telegram send gagal: HTTP=",code," MT5 err=",GetLastError(),
               " | cek Token/ChatID dan WebRequest https://api.telegram.org");
         return false;
      }
      return true;
   }

public:
   void Configure(const string symbol,const bool telegram,const string token,
                  const string chatId,const int timeout,const bool push,const double rr)
   {
      m_symbol=symbol; m_telegram=telegram; m_token=token;
      m_chat_id=chatId; m_timeout=timeout; m_push=push;
   }

   // Status alert only on ON/OFF change: chart button or Inputs setting.
   // Status alerts are independent of the one-alert-per-position entry rule.
   void AutopilotStatus(const bool enabled,const ENUM_TIMEFRAMES tf1,
                        const ENUM_TIMEFRAMES tf2,const ENUM_TIMEFRAMES tf3)
   {
      string a=EnumToString(tf1),b=EnumToString(tf2),c=EnumToString(tf3);
      StringReplace(a,"PERIOD_","");
      StringReplace(b,"PERIOD_","");
      StringReplace(c,"PERIOD_","");
      string state=(enabled ? "ON" : "OFF");
      string msg="🐭 SEKTE MUSANG TEORY\n"
                 "CEBONK COMPANY 22\n"
                 "━━━━━━━━━━━━\n"
                 +(enabled ? "🟢 AUTOPILOT ON\n" : "🔴 AUTOPILOT OFF\n")
                 +"📌 "+m_symbol+"\n"
                 +"⏱ TF: "+a+" / "+b+" / "+c+"\n"
                 +(enabled ? "✅ Scanner aktif, menunggu setup valid."
                           : "⏸ Scanner entry nonaktif.");

      bool telegram_ok=TelegramSend(msg);
      bool push_ok=false;
      if(m_push && !MQLInfoInteger(MQL_TESTER))
      {
         ResetLastError();
         push_ok=SendNotification("CEBONK AUTOPILOT "+state+" | "+m_symbol);
         if(!push_ok)
            Print("MT5 Push status gagal | Error=",GetLastError());
      }
      Print("CEBONK AUTOPILOT ",state," | Telegram=",
            (telegram_ok ? "OK" : "SKIP/FAIL"),
            " | Push=",(push_ok ? "OK" : "SKIP/FAIL"));
   }

   // Entry alert: confirmed opening deal, once per POSITION_IDENTIFIER.
   void Executed(const int dir,const long position_id,
                 const string tf1,const string tf2,const string tf3,
                 const string tf2_signal,const string ma_cross,
                 const double lot,const double entry,const double sl,const double tp)
   {
      string side=(dir>0 ? "BUY" : "SELL");
      string icon=(dir>0 ? "🟢" : "🔴");
      double risk=MathAbs(entry-sl);
      double reward=MathAbs(tp-entry);
      string rr=(risk>0.0 ? DoubleToString(reward/risk,2) : "-");
      string msg="🐭 SEKTE MUSANG TEORY\n"
                 "CEBONK COMPANY 22\n"
                 "━━━━━━━━━━━━\n"
                 +icon+" "+side+" ENTRY CONFIRMED\n"
                 "📌 "+m_symbol+"\n"
                 "🆔 Posisi: "+IntegerToString(position_id)+"\n"
                 "⏱ TF: "+tf1+" / "+tf2+" / "+tf3+"\n"
                 "✅ TF1: Re-entry "+side+"\n"
                 "✅ TF2: "+tf2_signal+" "+side+" | "+ma_cross+"\n"
                 "✅ TF3: CB1 retest\n\n"
                 "💰 Lot: "+DoubleToString(lot,2)+"\n"
                 "🎯 Entry: "+PriceText(entry)+"\n"
                 "🛑 SL: "+PriceText(sl)+"\n"
                 "🏁 TP: "+PriceText(tp)+"\n"
                 "⚖️ RR aktual: 1:"+rr+"\n\n"
                 "⚠️ OJO FULLMARGIN COK!";

      Print("CEBONK ENTRY ",side," confirmed | PositionID=",position_id,
            " | Entry=",PriceText(entry)," SL=",PriceText(sl)," TP=",PriceText(tp));
      if(m_push && !MQLInfoInteger(MQL_TESTER))
         SendNotification("CEBONK "+side+" "+m_symbol+
                          " | Entry "+PriceText(entry)+
                          " | SL "+PriceText(sl)+" | TP "+PriceText(tp));
      TelegramSend(msg);
   }

   // SL/TP notification is separate from the one ENTRY alert per position.
   void TPSL(const bool tp,const int dir,const long position_id,const double price,
             const double closed_lot,const double net_profit)
   {
      string side=(dir>0 ? "BUY" : "SELL");
      string status=(tp ? "🏁 TAKE PROFIT HIT" : "🛑 STOP LOSS HIT");
      string msg="🐭 SEKTE MUSANG TEORY\n"+
                 "CEBONK COMPANY 22\n"+
                 "━━━━━━━━━━━━\n"+
                 status+"\n"+
                 "📌 "+m_symbol+"\n"+
                 "🆔 Position: "+IntegerToString(position_id)+"\n"+
                 "🧭 Arah: "+side+"\n"+
                 "💰 Lot ditutup: "+DoubleToString(closed_lot,2)+"\n"+
                 "📍 Harga close: "+PriceText(price)+"\n"+
                 "💵 Net P/L: "+DoubleToString(net_profit,2)+" "+
                 AccountInfoString(ACCOUNT_CURRENCY)+"\n\n"+
                 (tp ? "Target rampung. Gas sing tertib maneh, rek." :
                       "SL kena. Enteni setup anyar, ojo mbales market.")+"\n"+
                 "⚠️ OJO FULLMARGIN COK!";
      Print("CEBONK ",(tp?"TP HIT":"SL HIT")," | ",side,
            " | PositionID=",position_id," | P/L=",DoubleToString(net_profit,2));
      if(m_push && !MQLInfoInteger(MQL_TESTER))
         SendNotification("CEBONK "+string(tp?"TP HIT":"SL HIT")+
                          " | "+side+" "+m_symbol+
                          " | P/L "+DoubleToString(net_profit,2));
      if(!TelegramSend(msg))
         Print("TP/SL Telegram gagal utawa nonaktif | PositionID=",position_id);
   }
};

input group "=== ENGINE ==="
input string          InpSymbol             = "";
input ulong           InpMagic              = 22100106;
input bool            InpAutopilot          = true;
input bool            InpEnableBuy          = true;
input bool            InpEnableSell         = true;
input ENUM_TIMEFRAMES InpTF1                = PERIOD_H1;
input ENUM_TIMEFRAMES InpTF2                = PERIOD_M15;
input ENUM_TIMEFRAMES InpTF3                = PERIOD_M5;

input group "=== BBMA ==="
input int             InpBBPeriod           = 20;
input double          InpBBDeviation        = 2.0;
input int             InpMAFast             = 5;
input int             InpMASlow             = 10;
input int             InpReentryMaxBars     = 20;

input group "=== TF2 CSAK/CSM + MA50 x MIDBB ==="
input bool            InpUseCSAK            = true;
input bool            InpUseCSM             = true;
input int             InpMA50Period         = 50;
input ENUM_MA_METHOD  InpMA50Method         = MODE_EMA;
input int             InpTF2FreshBars       = 25;
input int             InpTF2PairMaxGapBars  = 10;
input bool            InpAllowMA50Alignment = true;
input double          InpMA50MinSepRatio    = 0.03;

input group "=== TF3 CB1 + FIBO MUSANG ==="
input int             InpPivotDepth         = 2;
input int             InpCB1Lookback        = 100;
input int             InpSetupExpiryBars    = 45;
input int             InpCB1BufferPoints    = 30; // effective zone auto >= 1.20x spread
input double          InpSLFibo             = -0.120;
input double          InpRR                 = 2.0;
input int             InpMinSLPoints        = 80;


input group "=== SIDEWAYS FILTER - NO ATR ==="
input bool            InpUseSidewaysFilter  = true;
input ENUM_TIMEFRAMES InpSidewaysTF         = PERIOD_CURRENT; // CURRENT = follow TF2
input int             InpSidewaysRecentBars = 8;
input int             InpSidewaysBaseBars   = 60;
input double          InpSidewaysCompression= 0.68;
input double          InpSidewaysMidSlope   = 0.10;
input double          InpSidewaysMA50Slope  = 0.12;
input double          InpSidewaysEfficiency = 0.30;
input int             InpSidewaysMidCrosses = 4;
input int             InpSidewaysMinScore   = 4;

input group "=== TRADING SESSION - WIB ==="
input bool            InpUseTradingSession = true;
input int             InpBrokerGMTOffset   = 3;   // Broker GMT+3
input int             InpTradeStartHourWIB = 7;
input int             InpTradeStartMinWIB  = 0;
input int             InpTradeEndHourWIB   = 23;
input int             InpTradeEndMinWIB    = 0;

input group "=== REVERSAL GUARD ==="
input bool            InpUseEarlyExit       = true;
input bool            InpExitOppositeCB1    = true;
input bool            InpExitTF2Reverse     = true;

input group "=== ORDER ==="
input double          InpLot                = 0.01;
input int             InpMaxSpreadPoints    = 70;
input int             InpSlippagePoints     = 20;
input bool            InpMT5Push            = true;

input group "=== TELEGRAM ==="
input bool            InpTelegram           = true;
input string          InpTelegramToken      = "";
input string          InpTelegramChatID     = "";
input int             InpTelegramTimeout    = 5000;

CTrade          g_trade;
CBBMA3TFCore    g_core;
CBBMA3TFNotify  g_notify;
CBBMA3TFSideways g_sideways;
C3SetupState    g_setup;
C3SetupState    g_last_entry_setup;
ulong           g_last_entry_order=0;
double          g_last_entry_sl=0.0,g_last_entry_tp=0.0;
C3SidewaysState g_sideways_state;
datetime        g_bar1=0,g_bar2=0,g_bar3=0;
datetime        g_exit_bar2=0,g_exit_bar3=0;
datetime        g_last_exit_cb1_break=0;
datetime        g_sideways_cache_bar=0;
datetime        g_last_sideways_block_bar=0;
bool            g_sideways_cache_valid=false;
bool            g_autopilot=true;
string          BTN="CEBONK_AUTOPILOT_BTN";

ENUM_TIMEFRAMES SidewaysTF()
{
   return(InpSidewaysTF==PERIOD_CURRENT ? InpTF2 : InpSidewaysTF);
}

C3SidewaysConfig BuildSidewaysConfig()
{
   C3SidewaysConfig c;
   c.symbol=InpSymbol;
   c.tf=SidewaysTF();
   c.bb_period=InpBBPeriod;
   c.bb_deviation=InpBBDeviation;
   c.ma_period=InpMA50Period;
   c.ma_method=InpMA50Method;
   c.recent_bars=InpSidewaysRecentBars;
   c.baseline_bars=InpSidewaysBaseBars;
   c.compression_max=InpSidewaysCompression;
   c.mid_slope_max=InpSidewaysMidSlope;
   c.ma_slope_max=InpSidewaysMA50Slope;
   c.efficiency_max=InpSidewaysEfficiency;
   c.min_mid_crosses=InpSidewaysMidCrosses;
   c.min_score=InpSidewaysMinScore;
   return c;
}

bool TradingSessionOpen()
{
   int wib_now=0;
   return C3SessionOpenWIB(InpUseTradingSession,InpBrokerGMTOffset,
                           InpTradeStartHourWIB,InpTradeStartMinWIB,
                           InpTradeEndHourWIB,InpTradeEndMinWIB,wib_now);
}

void RefreshSetupBarCaches()
{
   g_bar1=iTime(g_core.SymbolName(),InpTF1,0);
   g_bar2=iTime(g_core.SymbolName(),InpTF2,0);
   g_bar3=iTime(g_core.SymbolName(),InpTF3,0);
}

bool SidewaysNow()
{
   if(!InpUseSidewaysFilter) return false;
   datetime b=iTime(g_core.SymbolName(),SidewaysTF(),0);
   if(b<=0) return false;

   if(b!=g_sideways_cache_bar)
   {
      g_sideways_cache_bar=b;
      g_sideways_cache_valid=g_sideways.Evaluate(g_sideways_state);
   }
   return(g_sideways_cache_valid && g_sideways_state.sideways);
}

C3Config BuildConfig()
{
   C3Config c;
   c.symbol=InpSymbol;
   c.enable_buy=InpEnableBuy; c.enable_sell=InpEnableSell;
   c.tf1=InpTF1; c.tf2=InpTF2; c.tf3=InpTF3;
   c.bb_period=InpBBPeriod; c.bb_deviation=InpBBDeviation;
   c.ma_fast=InpMAFast; c.ma_slow=InpMASlow; c.reentry_max_bars=InpReentryMaxBars;
   c.use_csak=InpUseCSAK; c.use_csm=InpUseCSM;
   c.ma50_period=InpMA50Period; c.ma50_method=InpMA50Method;
   c.tf2_fresh_bars=InpTF2FreshBars; c.tf2_pair_max_gap_bars=InpTF2PairMaxGapBars;
   c.allow_ma50_alignment=InpAllowMA50Alignment; c.ma50_min_sep_ratio=InpMA50MinSepRatio;
   c.pivot_depth=InpPivotDepth; c.cb1_lookback=InpCB1Lookback;
   c.setup_expiry_bars=InpSetupExpiryBars; c.cb1_buffer_points=InpCB1BufferPoints;
   return c;
}

bool SpreadOK()
{
   MqlTick tk; if(!SymbolInfoTick(g_core.SymbolName(),tk)) return false;
   double pt=SymbolInfoDouble(g_core.SymbolName(),SYMBOL_POINT);
   return(pt>0 && (tk.ask-tk.bid)/pt<=InpMaxSpreadPoints);
}

double NormLot(double lot)
{
   string s=g_core.SymbolName();
   double mn=SymbolInfoDouble(s,SYMBOL_VOLUME_MIN), mx=SymbolInfoDouble(s,SYMBOL_VOLUME_MAX);
   double st=SymbolInfoDouble(s,SYMBOL_VOLUME_STEP); if(st<=0) st=0.01;
   lot=MathMax(mn,MathMin(mx,lot));
   lot=MathFloor(lot/st+1e-9)*st;
   int vd=0; double x=st;
   while(vd<8 && MathAbs(x-MathRound(x))>1e-9){ x*=10.0; vd++; }
   return NormalizeDouble(lot,vd);
}

bool StopsValid(const int dir,const double entry,const double sl,const double tp)
{
   string s=g_core.SymbolName();
   double pt=SymbolInfoDouble(s,SYMBOL_POINT);
   double dmin=(double)SymbolInfoInteger(s,SYMBOL_TRADE_STOPS_LEVEL)*pt;
   if(dir>0) return(sl<entry && tp>entry && entry-sl>=dmin && tp-entry>=dmin);
   return(sl>entry && tp<entry && sl-entry>=dmin && entry-tp>=dmin);
}

bool OwnPosition(int &dir,double &entry,double &sl,datetime &openTime,double &profit)
{
   string s=g_core.SymbolName();
   dir=0; entry=0; sl=0; openTime=0; profit=0;
   if(!PositionSelect(s) || (ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic) return false;
   ENUM_POSITION_TYPE pt=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   dir=(pt==POSITION_TYPE_BUY ? 1 : -1);
   entry=PositionGetDouble(POSITION_PRICE_OPEN);
   sl=PositionGetDouble(POSITION_SL);
   openTime=(datetime)PositionGetInteger(POSITION_TIME);
   profit=PositionGetDouble(POSITION_PROFIT);
   return true;
}

double RunningRR(const int dir,const double entry,const double sl,const double now)
{
   double risk=MathAbs(entry-sl);
   if(risk<=0) return 0.0;
   return(dir>0 ? (now-entry)/risk : (entry-now)/risk);
}

bool CloseForReversal(const int posdir,const string reason)
{
   double entry,sl,profit; datetime ot; int d;
   if(!OwnPosition(d,entry,sl,ot,profit) || d!=posdir) return false;
   MqlTick tk; if(!SymbolInfoTick(g_core.SymbolName(),tk)) return false;
   double now=(posdir>0 ? tk.bid : tk.ask);
   double rr=RunningRR(posdir,entry,sl,now);
   if(!g_trade.PositionClose(g_core.SymbolName()))
   {
      Print("Early close gagal: ",g_trade.ResultRetcode()," ",g_trade.ResultRetcodeDescription());
      return false;
   }
   Print("REVERSAL GUARD | closed | ",reason," | runningRR=",DoubleToString(rr,2));
   C3ResetState(g_setup);
   return true;
}

void ManageEarlyExit(const bool newTF2,const bool newTF3)
{
   if(!InpUseEarlyExit) return;
   int posdir; double entry,sl,profit; datetime openTime;
   if(!OwnPosition(posdir,entry,sl,openTime,profit)) return;

   if(newTF2 && InpExitTF2Reverse)
   {
      datetime t=0; string sig="",cross="";
      if(g_core.DetectTF2StrictConfirm(-posdir,openTime,t,sig,cross) && t>=openTime)
      {
         if(CloseForReversal(posdir,"TF2 "+sig+" "+g_core.SideText(-posdir)+" + "+cross)) return;
      }
   }

   if(newTF3 && InpExitOppositeCB1)
   {
      double cb1,ex,bc; datetime bt;
      if(g_core.FindCB1Since(-posdir,openTime,cb1,ex,bc,bt) && bt>=openTime && bt!=g_last_exit_cb1_break)
      {
         g_last_exit_cb1_break=bt;
         CloseForReversal(posdir,"TF3 CB1 "+g_core.SideText(-posdir)+" fresh wis break");
      }
   }
}

void TryEntry(const C3Events &ev)
{
   if(!g_autopilot || !ev.retest || !g_setup.cb1_armed || g_setup.dir==0) return;
   if(PositionSelect(g_core.SymbolName())) return;

   if(SidewaysNow())
   {
      datetime b=iTime(g_core.SymbolName(),SidewaysTF(),0);
      if(b>0 && b!=g_last_sideways_block_bar)
      {
         g_last_sideways_block_bar=b;
         Print("SIDEWAYS | entry blocked | ",EnumToString(SidewaysTF()),
               " | mode=",g_sideways_state.mode," | score=",g_sideways_state.score);
      }
      return;
   }

   if(!SpreadOK()) return;
   MqlTick tk; if(!SymbolInfoTick(g_core.SymbolName(),tk)) return;
   double pt=SymbolInfoDouble(g_core.SymbolName(),SYMBOL_POINT);
   int digits=(int)SymbolInfoInteger(g_core.SymbolName(),SYMBOL_DIGITS);
   double entry=(g_setup.dir>0 ? tk.ask : tk.bid);
   double sl=g_setup.extreme + InpSLFibo*(g_setup.break_close-g_setup.extreme);
   double risk=(g_setup.dir>0 ? entry-sl : sl-entry);
   if(risk<InpMinSLPoints*pt) return;

   double tp=(g_setup.dir>0 ? entry+InpRR*risk : entry-InpRR*risk);
   sl=NormalizeDouble(sl,digits); tp=NormalizeDouble(tp,digits);
   if(!StopsValid(g_setup.dir,entry,sl,tp)) return;

   double lot=NormLot(InpLot); if(lot<=0) return;
   bool ok=(g_setup.dir>0 ? g_trade.Buy(lot,g_core.SymbolName(),0,sl,tp,"RE-TF2xMID-CB1 BUY")
                          : g_trade.Sell(lot,g_core.SymbolName(),0,sl,tp,"RE-TF2xMID-CB1 SELL"));
   if(!ok)
   {
      Print("Order gagal: ",g_trade.ResultRetcode()," ",g_trade.ResultRetcodeDescription());
      return;
   }

   g_last_entry_setup=g_setup;
   g_last_entry_order=g_trade.ResultOrder();
   g_last_entry_sl=sl;
   g_last_entry_tp=tp;
   C3ResetState(g_setup);
}

// Track AUTOPILOT state across EA reinitialization (Inputs > InpAutopilot).
// No alert on initial attach, no repeated alerts on ordinary reinit/ticks.
string AutopilotStateKey()
{
   return "CB22:AP:"+IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN))+
          ":"+IntegerToString((long)InpMagic)+":"+IntegerToString((long)ChartID());
}

void RememberAutopilotState()
{
   string key=AutopilotStateKey();
   ResetLastError();
   if(GlobalVariableSet(key,(g_autopilot ? 1.0 : 0.0))==0)
      Print("AUTOPILOT state persistence failed | error=",GetLastError());
   else
      GlobalVariablesFlush();
}

void SyncAutopilotOnInit()
{
   string key=AutopilotStateKey();
   bool existed=GlobalVariableCheck(key);
   bool changed=(existed && ((GlobalVariableGet(key)>0.5)!=g_autopilot));
   RememberAutopilotState();
   if(changed)
      g_notify.AutopilotStatus(g_autopilot,InpTF1,InpTF2,InpTF3);
}

void UpdateButton()
{
   if(ObjectFind(0,BTN)<0)
   {
      ObjectCreate(0,BTN,OBJ_BUTTON,0,0,0);
      ObjectSetInteger(0,BTN,OBJPROP_CORNER,CORNER_LEFT_UPPER);
      ObjectSetInteger(0,BTN,OBJPROP_XDISTANCE,10);
      ObjectSetInteger(0,BTN,OBJPROP_YDISTANCE,20);
      ObjectSetInteger(0,BTN,OBJPROP_XSIZE,145);
      ObjectSetInteger(0,BTN,OBJPROP_YSIZE,24);
      ObjectSetInteger(0,BTN,OBJPROP_FONTSIZE,9);
   }
   ObjectSetString(0,BTN,OBJPROP_TEXT,(g_autopilot ? "AUTOPILOT : ON" : "AUTOPILOT : OFF"));
   ChartRedraw();
}

int OnInit()
{
   if(InpRR<2.0 || InpLot<=0 || InpMinSLPoints<0 ||
      InpMA50MinSepRatio<0.0 || InpMA50MinSepRatio>0.50 ||
      InpSidewaysMinScore<3 || InpSidewaysMinScore>5)
      return INIT_PARAMETERS_INCORRECT;
   if(InpBrokerGMTOffset<-12 || InpBrokerGMTOffset>14 ||
      !C3ValidClock(InpTradeStartHourWIB,InpTradeStartMinWIB) ||
      !C3ValidClock(InpTradeEndHourWIB,InpTradeEndMinWIB))
      return INIT_PARAMETERS_INCORRECT;
   C3Config cfg=BuildConfig();
   if(!g_core.Configure(cfg) || !g_core.ValidateConfig()) return INIT_PARAMETERS_INCORRECT;

   C3SidewaysConfig swcfg=BuildSidewaysConfig();
   if(InpUseSidewaysFilter && (!g_sideways.Configure(swcfg) || !g_sideways.ValidateConfig()))
      return INIT_PARAMETERS_INCORRECT;
   C3ResetSidewaysState(g_sideways_state);

   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(InpSlippagePoints);
   g_notify.Configure(g_core.SymbolName(),InpTelegram,InpTelegramToken,InpTelegramChatID,
                      InpTelegramTimeout,InpMT5Push,InpRR);
   C3ResetState(g_setup);
   C3ResetState(g_last_entry_setup);
   g_bar1=iTime(g_core.SymbolName(),InpTF1,0);
   g_bar2=iTime(g_core.SymbolName(),InpTF2,0);
   g_bar3=iTime(g_core.SymbolName(),InpTF3,0);
   g_exit_bar2=g_bar2;
   g_exit_bar3=g_bar3;
   g_autopilot=InpAutopilot;
   UpdateButton();
   SyncAutopilotOnInit();

   if(InpUseTradingSession)
   {
      int ss=C3WIBToServerMinutes(InpTradeStartHourWIB,InpTradeStartMinWIB,InpBrokerGMTOffset);
      int se=C3WIBToServerMinutes(InpTradeEndHourWIB,InpTradeEndMinWIB,InpBrokerGMTOffset);
      Print("Trading session WIB ",StringFormat("%02d:%02d",InpTradeStartHourWIB,InpTradeStartMinWIB),
            "-",StringFormat("%02d:%02d",InpTradeEndHourWIB,InpTradeEndMinWIB),
            " | Broker GMT",(InpBrokerGMTOffset>=0?"+":""),InpBrokerGMTOffset,
            " | Server ",C3ClockText(ss),"-",C3ClockText(se));
   }
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason){ ObjectDelete(0,BTN); }

void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam)
{
   if(id==CHARTEVENT_OBJECT_CLICK && sparam==BTN)
   {
      g_autopilot=!g_autopilot;
      UpdateButton();
      RememberAutopilotState();
      g_notify.AutopilotStatus(g_autopilot,InpTF1,InpTF2,InpTF3);
   }
}

void OnTick()
{
   if(!g_autopilot) return;

   // Exit monitoring has independent bar caches so it cannot consume setup events.
   bool exitNB2=g_core.NewBar(InpTF2,g_exit_bar2);
   bool exitNB3=g_core.NewBar(InpTF3,g_exit_bar3);
   ManageEarlyExit(exitNB2,exitNB3);

   int pd; double pe,ps,pp; datetime pot;
   if(OwnPosition(pd,pe,ps,pot,pp)) return;

   // Session controls NEW setup/entry only. Existing positions stay managed above.
   if(!TradingSessionOpen())
   {
      C3ResetState(g_setup);
      RefreshSetupBarCaches();
      return;
   }

   C3Events ev;
   g_core.PollSetup(g_setup,g_bar1,g_bar2,g_bar3,ev);
   if(ev.reentry) Print("TF1 RE-ENTRY ",g_core.SideText(g_setup.dir)," detected");
   if(ev.tf2_confirm) Print("TF2 CONFIRM ",g_setup.tf2_signal," + ",g_setup.ma_cross);
   if(ev.cb1_armed) Print("TF3 CB1 valid | waiting for retest");
   TryEntry(ev);
}

// Persisted per account + EA magic + position identifier.
// Mark BEFORE sending: at-most-one alert attempt, even after EA restart.
// Telegram cannot guarantee exactly-once delivery across network failures.
string EntryNotificationKey(const long position_id)
{
   return "CB22N:"+IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN))+
          ":"+IntegerToString((long)InpMagic)+":"+IntegerToString(position_id);
}

string ShortTF(const ENUM_TIMEFRAMES timeframe)
{
   string value=EnumToString(timeframe);
   StringReplace(value,"PERIOD_","");
   return value;
}


// Dedup terminal-persistent across EA restarts and broker trade transactions.
string C3ClosedNotificationKey(const long position_id)
{
   return "CB22X:"+IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN))+":"+
          IntegerToString((long)InpMagic)+":"+IntegerToString(position_id);
}

// Broker SL/TP close deals can carry DEAL_MAGIC=0: verify origin via opening deal.
void C3NotifyClosedTPSL(const ulong exit_deal)
{
   if(!HistoryDealSelect(exit_deal)) return;
   if(HistoryDealGetString(exit_deal,DEAL_SYMBOL)!=g_core.SymbolName()) return;
   if((ENUM_DEAL_ENTRY)HistoryDealGetInteger(exit_deal,DEAL_ENTRY)!=DEAL_ENTRY_OUT) return;

   ENUM_DEAL_REASON reason=(ENUM_DEAL_REASON)HistoryDealGetInteger(exit_deal,DEAL_REASON);
   if(reason!=DEAL_REASON_TP && reason!=DEAL_REASON_SL) return;
   ENUM_DEAL_TYPE type=(ENUM_DEAL_TYPE)HistoryDealGetInteger(exit_deal,DEAL_TYPE);
   if(type!=DEAL_TYPE_BUY && type!=DEAL_TYPE_SELL) return;
   long position_id=HistoryDealGetInteger(exit_deal,DEAL_POSITION_ID);
   if(position_id<=0) return;
   double close_price=HistoryDealGetDouble(exit_deal,DEAL_PRICE);

   // A partial fill must not generate a premature/duplicate closed-position alert.
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket!=0 && (long)PositionGetInteger(POSITION_IDENTIFIER)==position_id)
         return;
   }
   if(!HistorySelectByPosition((ulong)position_id)) return;

   bool owned=false;
   double net_profit=0.0,closed_lot=0.0;
   for(int i=0;i<HistoryDealsTotal();i++)
   {
      ulong deal=HistoryDealGetTicket(i);
      if(deal==0 || HistoryDealGetString(deal,DEAL_SYMBOL)!=g_core.SymbolName()) continue;
      ENUM_DEAL_ENTRY action=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal,DEAL_ENTRY);
      if((action==DEAL_ENTRY_IN || action==DEAL_ENTRY_INOUT) &&
         (ulong)HistoryDealGetInteger(deal,DEAL_MAGIC)==InpMagic)
         owned=true;
      net_profit+=HistoryDealGetDouble(deal,DEAL_PROFIT)
                 +HistoryDealGetDouble(deal,DEAL_SWAP)
                 +HistoryDealGetDouble(deal,DEAL_COMMISSION)
                 +HistoryDealGetDouble(deal,DEAL_FEE);
      if(action==DEAL_ENTRY_OUT || action==DEAL_ENTRY_OUT_BY)
         closed_lot+=HistoryDealGetDouble(deal,DEAL_VOLUME);
   }
   if(!owned || closed_lot<=0.0) return;

   string key=C3ClosedNotificationKey(position_id);
   if(GlobalVariableCheck(key)) return;
   // Mark BEFORE WebRequest: at most one delivery attempt, including EA restarts.
   // Telegram exact-once semantics cannot be guaranteed on network failures.
   if(GlobalVariableSet(key,(double)TimeCurrent())==0)
   {
      Print("CLOSE NOTIFY dedup gagal | ",GetLastError()," | PositionID=",position_id);
      return;
   }
   GlobalVariablesFlush();
   int closed_dir=(type==DEAL_TYPE_SELL ? 1 : -1);
   g_notify.TPSL(reason==DEAL_REASON_TP,closed_dir,position_id,
                 close_price,closed_lot,net_profit);
   C3ResetState(g_setup);
}

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(trans.type!=TRADE_TRANSACTION_DEAL_ADD || trans.deal==0) return;
   if(!HistoryDealSelect(trans.deal)) return;
   if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=g_core.SymbolName()) return;

   ENUM_DEAL_ENTRY action=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal,DEAL_ENTRY);
   // Opening notifications require own Magic; close ownership is verified via position history.
   if((action==DEAL_ENTRY_IN || action==DEAL_ENTRY_INOUT) &&
      (ulong)HistoryDealGetInteger(trans.deal,DEAL_MAGIC)!=InpMagic) return;

   if(action==DEAL_ENTRY_IN || action==DEAL_ENTRY_INOUT)
   {
      long position_id=HistoryDealGetInteger(trans.deal,DEAL_POSITION_ID);
      if(position_id<=0) return;

      string key=EntryNotificationKey(position_id);
      if(GlobalVariableCheck(key)) return;  // already notified, including prior EA sessions

      ENUM_DEAL_TYPE type=(ENUM_DEAL_TYPE)HistoryDealGetInteger(trans.deal,DEAL_TYPE);
      if(type!=DEAL_TYPE_BUY && type!=DEAL_TYPE_SELL) return;
      int dir=(type==DEAL_TYPE_BUY ? 1 : -1);

      ulong order=(ulong)HistoryDealGetInteger(trans.deal,DEAL_ORDER);
      double entry=HistoryDealGetDouble(trans.deal,DEAL_PRICE);
      double lot=HistoryDealGetDouble(trans.deal,DEAL_VOLUME);
      double sl=HistoryDealGetDouble(trans.deal,DEAL_SL);
      double tp=HistoryDealGetDouble(trans.deal,DEAL_TP);

      // Opening-deal SL/TP may be zero on some servers: obtain executed position
      // data by identifier (safe on hedging accounts), then the source order.
      for(int i=PositionsTotal()-1;i>=0;i--)
      {
         ulong ticket=PositionGetTicket(i);
         if(ticket==0 || (long)PositionGetInteger(POSITION_IDENTIFIER)!=position_id)
            continue;
         entry=PositionGetDouble(POSITION_PRICE_OPEN);
         lot=PositionGetDouble(POSITION_VOLUME);
         sl=PositionGetDouble(POSITION_SL);
         tp=PositionGetDouble(POSITION_TP);
         break;
      }
      if((sl<=0.0 || tp<=0.0) && HistoryOrderSelect(order))
      {
         if(sl<=0.0) sl=HistoryOrderGetDouble(order,ORDER_SL);
         if(tp<=0.0) tp=HistoryOrderGetDouble(order,ORDER_TP);
      }
      if(order==g_last_entry_order && order!=0)
      {
         if(sl<=0.0) sl=g_last_entry_sl;
         if(tp<=0.0) tp=g_last_entry_tp;
      }
      if(entry<=0.0 || lot<=0.0 || sl<=0.0 || tp<=0.0)
      {
         Print("ENTRY NOTIFY: price/SL/TP not yet available for position ",position_id);
         return;
      }

      C3SetupState info;
      C3ResetState(info);
      if(order==g_last_entry_order && order!=0) info=g_last_entry_setup;
      string signal=(info.tf2_signal=="" ? "CSAK/CSM" : info.tf2_signal);
      string cross=(info.ma_cross=="" ? "MA50 x MidBB" : info.ma_cross);

      // Mark and flush *before* outbound calls to suppress duplicate alerts.
      if(GlobalVariableSet(key,(double)TimeCurrent())==0)
      {
         Print("ENTRY NOTIFY: dedup state failed, alert withheld | ",GetLastError());
         return;
      }
      GlobalVariablesFlush();
      g_notify.Executed(dir,position_id,ShortTF(InpTF1),ShortTF(InpTF2),
                        ShortTF(InpTF3),signal,cross,lot,entry,sl,tp);
      return;
   }

   // TP/SL notification is independent from Autopilot state and trading session.
   if(action==DEAL_ENTRY_OUT) C3NotifyClosedTPSL(trans.deal);
}
//+------------------------------------------------------------------+
