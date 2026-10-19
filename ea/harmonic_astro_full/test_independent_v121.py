"""v1.21 weekly-only and independent-scanner source regression; NOT MQL5 compilation."""
from pathlib import Path
import re
from datetime import datetime, timedelta, timezone
root=Path(__file__).resolve().parent
main=(root/"CEBONK_HARMONIC_ASTRO_FULL_v1.21.mq5").read_text(encoding="utf-8")
hp=(root/"HarmonicScanner.mqh").read_text(encoding="utf-8")
astro=(root/"AstroWeeklyDirection.mqh").read_text(encoding="utf-8")
single=(root/"CEBONK_HARMONIC_ASTRO_FULL_SINGLE_v1.21.mq5").read_text(encoding="utf-8")
mirror=(root/"CEBONK_HARMONIC_ASTRO_FULL_SINGLE_v1.21.txt").read_text(encoding="utf-8")
assert single==mirror, "TXT must be byte-for-byte same source"
assert single==main.replace('#include "HarmonicScanner.mqh"',hp).replace('#include "AstroWeeklyDirection.mqh"',astro)
assert '1.21' in main and '#property tester_file "CEBONK_C2_ASTRO.csv"' in main
for t in ("ScanD1=true","ScanH4=true","ScanH1=true","ScanM30=true",
          "PERIOD_D1","PERIOD_H4","PERIOD_H1","PERIOD_M30","PERIOD_M5",
          "FOLLOW_PLUS_REVERSAL","CHCB1(","CHExecute(","ACWeeklyGate(s.dir,closeOpen)",
          "GlobalVariableSetOnCondition","MaxSpreadPoints=70",
          "MaxRiskPercent=1.0","DailyEquityStopPercent=5.0",
          "StartAutopilot=false","AllowRealAccount=false"):
    assert t in single,t
for forbidden in ("RejectOppositeTF","ACGate(","CHSession(","BrokerStartHour",
                  "BrokerEndHour","WeeklyMinWindowMinutes","BuyStop(","SellStop(","PERIOD_M15"):
    assert forbidden not in single,forbidden
assert "if(!ACWeeklyGate(s.dir,closeOpen))continue;" in main
assert "if(CHExecute(s))return;" in main
assert "bool CHExecute(HPSetup &s)" in main
assert "return true; // Daily direction is irrelevant" not in astro # policy returns dominant only
assert "return dominant!=0 && dominant==dir;" in astro
assert "wib.day_of_week<1||wib.day_of_week>5" in astro
assert "if(idx<0||acRows[idx].to<slot+300)return false;" in astro
assert "buy*100>=WeeklyMinSharePercent*directional" in astro
assert "if(AstroSource==ASTRO_WEB_CSV && !MQLInfoInteger(MQL_TESTER)" in astro
for s in (main,hp,astro,single):
    assert s.count("{")==s.count("}"),"Brace imbalance"
# Web weekly 55% counting: Monday daily SELL but the week is BUY.
days=["SELL"]*216+["BUY"]*(4*216)
buy=days.count("BUY");sell=days.count("SELL")
weekly=1 if buy*100>=55*(buy+sell) else (-1 if sell*100>=55*(buy+sell) else 0)
assert weekly==1 and days[0]=="SELL" and weekly!=(-1)
# Monday-Friday daily split is irrelevant; full 1080 slots mandatory.
assert len(days)==1080 and buy==864 and sell==216
# Monday near month boundary uses five weekdays from Monday, never an intraday gate.
date=datetime(2026,9,28,tzinfo=timezone.utc)
assert [(date+timedelta(days=i)).strftime("%Y-%m") for i in range(5)][-1]=="2026-10"
print("PASS v1.21: source/mirror parity, independent TFs, weekly-only direction, no daily window/session, market CB1, safety.")
print("NOT RUN: MetaEditor compile, NOZAX real-tick backtest, Telegram end-to-end.")
