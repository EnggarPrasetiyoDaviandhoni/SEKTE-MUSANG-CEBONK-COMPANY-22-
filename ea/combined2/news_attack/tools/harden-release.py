from pathlib import Path
import sys
H=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
def patch(p,old,new):
 s=p.read_text(encoding='utf-8')
 if new in s:return
 assert s.count(old)==1,(p,old[:60],s.count(old))
 p.write_text(s.replace(old,new,1),encoding='utf-8')
N=H/'src/C2News.mqh'
patch(N,'if(!gTester&&exported>NowUTC()+60)valid=false;', 'if(!gTester&&(exported>NowUTC()||NowUTC()-exported>InpNewsMaxCacheSeconds))valid=false;')
patch(N,'int phase=(int)((long)TimeCurrent()%60);','long clock=(long)TimeTradeServer();if(clock<=0)clock=(long)TimeLocal();\n int phase=(int)(clock%60); // clock advances even when weekend has no ticks')
patch(N,'return InpRunMode>=C2_NORMAL_ONLY&&InpRunMode<=C2_NORMAL_AND_NEWS&&InpNewsPreBlockMinutes>=0','return InpRunMode>=C2_NORMAL_ONLY&&InpRunMode<=C2_NORMAL_AND_NEWS&&InpNewsSource>=C2_NEWS_MT5_CALENDAR&&InpNewsSource<=C2_NEWS_LOCAL_CSV&&InpNewsPreBlockMinutes>=0')
T=H/'tests/test_adapters.py'
patch(T,'std::unordered_map<string,double>globals;int flushes=0;', 'std::unordered_map<string,double>globals;int flushes=0;const int InpNewsMaxCacheSeconds=180;')
patch(T,'fileText=csv("1,1790944200,USD,HIGH,Test\\n");gTester=false;check(NewsCSV()&&gNews[0].known==1790940000,"Live CSV retains export observation time");','fileText=csv("1,1790944200,USD,HIGH,Test\\n");gTester=false;mockNow=1790940001;check(NewsCSV()&&gNews[0].known==1790940000,"Live CSV retains export observation time");\n mockNow=1790940180;check(NewsCSV(),"Live snapshot valid at cache limit");mockNow++;check(!NewsCSV(),"Repeated reads cannot refresh stale live CSV");')
E=H/'src/EXPORT_C2_NEWS.mq5'
s=E.read_text(encoding='utf-8').replace('InpHistoricalServerUTCMinutes','InpCalendarServerUTCMinutes').replace('InpConfirmHistoricalOffset','InpConfirmCalendarOffset').replace('verify historical server UTC offset','verify CURRENT calendar server UTC offset').replace('// split history across broker DST changes','// Calendar uses CURRENT server offset; historical QUOTE DST is separate')
E.write_text(s,encoding='utf-8')
patch(E,'input int InpCalendarServerUTCMinutes=180;', 'input bool InpAutoCurrentServerOffset=true;\ninput int InpCalendarServerUTCMinutes=180;')
patch(E,'int offset=InpCalendarServerUTCMinutes*60;MqlCalendarValue values[];', 'int offset=InpAutoCurrentServerOffset?(int)MathRound(((double)TimeTradeServer()-(double)TimeGMT())/900.0)*900:InpCalendarServerUTCMinutes*60;MqlCalendarValue values[];')
patch(E,' int f=FileOpen("CEBONK_C2_NEWS.csv",', ' if(InpAutoCurrentServerOffset&&offset!=(int)MathRound(((double)TimeTradeServer()-(double)TimeGMT())/900.0)*900){Print("Offset changed; export aborted.");return;}\n int f=FileOpen("CEBONK_C2_NEWS.csv",')
patch(H/'src/C2Telegram.mqh','+NoticeTitle(event)+','+Html(NoticeTitle(event))+')
P=H/'tests/test_policy.py'
patch(P,"assert core in ea", "assert core in ea\nassert 'long clock=(long)TimeTradeServer()' in ea\nassert 'NowUTC()-exported>InpNewsMaxCacheSeconds' in ea")
R=H/'README.md'
if R.exists():
 s=R.read_text(encoding='utf-8').replace('offset SERVER historis sing bener, banjur `InpConfirmHistoricalOffset=true`. Yen sejarah broker ngalami DST, ekspor/tes saben rentang offset konstan.', 'offset kalender SERVER SAAT EKSPOR sing bener, banjur `InpConfirmCalendarOffset=true`. Default exporter nggunakake offset server saiki otomatis. Kalender lan quote historis beda: kanggo backtest quote sing ngalami DST, tes saben rentang offset historis konstan.')
 if '## Pemeriksaan tambahan sebelum distribusi' not in s:
  s+='\n## Pemeriksaan tambahan sebelum distribusi\nLive CSV ditolak yen umur ekspor ngluwihi InpNewsMaxCacheSeconds; maca file maneh ora nggawe jadwal lawas dadi anyar. Mode live standar tetep kalender MT5. Timer jaringan nganggo jam server sing terus mlaku, ora gumantung ana tick; tes Telegram isih bisa dilayani nalika pasar tutup. Native MQL API/compiler lan akun Telegram nyata isih durung diuji. Kanggo backtest, simpen CSV asli ing MQL5/Files sadurunge compile/recompile EA supaya tester_file bisa nyalin menyang agen. Offset kalender saat ekspor nggunakake CURRENT server offset; offset quote tester yaiku offset HISTORIS broker sing kudu sampeyan verifikasi.\n'
 R.write_text(s,encoding='utf-8')
print('HARDENED live CSV age, weekend clock, current calendar offset; no baseline/web edits')
