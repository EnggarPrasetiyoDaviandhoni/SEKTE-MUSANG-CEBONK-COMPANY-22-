// Export the terminal's USD HIGH calendar for the C2 News Attack tester.
// Run as a SCRIPT on an online MT5 chart, never in the Strategy Tester.
#property strict
#property script_show_inputs
input datetime InpFromUTC=D'2026.01.01 00:00:00';
input datetime InpToUTC=D'2027.01.01 00:00:00';
input bool InpAutoCurrentServerOffset=true;
input int InpCurrentCalendarUTCMinutes=180;
input bool InpConfirmTimesChecked=false;
input string InpOutputFile="CEBONK_C2_NEWS.csv";
struct ExportNews {ulong id;long utc;string name;};
void OnStart() {
 if(MQLInfoInteger(MQL_TESTER)){Print("Run exporter on an ONLINE chart, not Tester.");return;}
 if(!InpConfirmTimesChecked){Print("Check event times and CURRENT server UTC offset first. Set InpConfirmTimesChecked=true deliberately. Tester broker historical DST must be handled separately.");return;}
 if(InpToUTC<=InpFromUTC||(long)InpToUTC-(long)InpFromUTC>370*86400||MathAbs(InpCurrentCalendarUTCMinutes)>840||InpOutputFile==""){Print("Invalid export range/file/offset.");return;}
 int offset=InpAutoCurrentServerOffset?(int)MathRound(((double)TimeTradeServer()-(double)TimeGMT())/900.0)*900:InpCurrentCalendarUTCMinutes*60;
 MqlCalendarValue values[];ResetLastError();
 int count=CalendarValueHistory(values,(datetime)((long)InpFromUTC+offset),(datetime)((long)InpToUTC+offset),NULL,"USD");
 if(count<0||GetLastError()!=0){Print("Calendar export failed / incomplete: ",GetLastError(),". Existing file left unchanged.");return;}
 ExportNews rows[];
 for(int i=0;i<count;i++){
  MqlCalendarEvent e;if(!CalendarEventById(values[i].event_id,e)){Print("Missing metadata. Export aborted; original file unchanged.");return;}
  if(e.importance!=CALENDAR_IMPORTANCE_HIGH||e.type==CALENDAR_TYPE_HOLIDAY)continue;
  if(e.time_mode!=CALENDAR_TIMEMODE_DATETIME||values[i].time<=0){Print("HIGH event without exact time: ",e.name,". Narrow export range; do not pretend coverage is complete.");return;}
  long utc=(long)values[i].time-offset;if(utc<(long)InpFromUTC||utc>=(long)InpToUTC)continue;
  bool duplicate=false;for(int k=0;k<ArraySize(rows);k++)if(rows[k].id==values[i].id){duplicate=true;break;}if(duplicate)continue;
  if(values[i].id==0||ArraySize(rows)>=20000){Print("Invalid id/too many events; export aborted.");return;}
  string name=StringSubstr(e.name,0,180);StringReplace(name,",",";");StringReplace(name,"\r"," ");StringReplace(name,"\n"," ");
  if(name==""){Print("Event name missing; abort.");return;}
  int n=ArraySize(rows);ArrayResize(rows,n+1);rows[n].id=values[i].id;rows[n].utc=utc;rows[n].name=name;
 }
 if(InpAutoCurrentServerOffset&&offset!=(int)MathRound(((double)TimeTradeServer()-(double)TimeGMT())/900.0)*900){Print("Offset changed while exporting; retry.");return;}
 for(int i=1;i<ArraySize(rows);i++){ExportNews x=rows[i];int j=i-1;while(j>=0&&rows[j].utc>x.utc){rows[j+1]=rows[j];j--;}rows[j+1]=x;}
 string temp=InpOutputFile+".tmp";int f=FileOpen(temp,FILE_WRITE|FILE_TXT|FILE_ANSI,0,CP_UTF8);if(f==INVALID_HANDLE){Print("Cannot write temporary export.");return;}
 string text="CEBONK_NEWS_V1,"+(string)(long)InpFromUTC+","+(string)(long)InpToUTC+","+(string)(long)TimeGMT()+","+(string)ArraySize(rows)+"\r\nvalue_id,release_epoch,currency,importance,name\r\n";
 for(int i=0;i<ArraySize(rows);i++)text+=(string)rows[i].id+","+(string)rows[i].utc+",USD,HIGH,"+rows[i].name+"\r\n";
 ResetLastError();uint written=FileWriteString(f,text);FileFlush(f);int error=GetLastError();FileClose(f);
 if(written==0||error!=0){Print("Write failed; original file left unchanged.");FileDelete(temp);return;}
 if(!FileMove(temp,0,InpOutputFile,FILE_REWRITE)){Print("Could not replace output; inspect temporary export. Error ",GetLastError());return;}
 Print("EXPORTED ",ArraySize(rows)," USD HIGH events to MQL5/Files/",InpOutputFile,". Calendar current UTC offset=",offset/60," minutes. This is a retrospective snapshot, NOT release-publication timestamps or a point-in-time archive.");
}
