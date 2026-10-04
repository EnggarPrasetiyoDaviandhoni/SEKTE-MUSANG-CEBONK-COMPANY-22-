// Export real MT5 calendar history for retrospective schedule replay, NOT as-known-at-the-time proof.
#property strict
#property script_show_inputs
#property version "1.00"
input datetime InpFromUTC=D'2026.01.01 00:00';
input datetime InpToUTC=0; // 0 = now UTC. Never export unknown future as an empty calendar.
input int InpHistoricalServerUTCMinutes=180;
input bool InpConfirmHistoricalOffset=false; // split history across broker DST changes
struct NewsExportRow { ulong id; long utc; string name; };
void OnStart() {
 long from=(long)InpFromUTC,to=InpToUTC==0?(long)TimeGMT():(long)InpToUTC;
 if(!InpConfirmHistoricalOffset||MathAbs(InpHistoricalServerUTCMinutes)>840||from<946684800||to<=from||to>(long)TimeGMT()||to-from>370*86400){
  Print("NEWS EXPORT: verify historical server UTC offset, <=370 days and no future coverage.");return;
 }
 int offset=InpHistoricalServerUTCMinutes*60;MqlCalendarValue values[];ResetLastError();
 int count=CalendarValueHistory(values,(datetime)(from+offset),(datetime)(to+offset),NULL,"USD");
 if(count<0||GetLastError()!=0||count>30000){Print("NEWS EXPORT FAILED ",GetLastError(),". Existing file unchanged.");return;}
 NewsExportRow rows[];
 for(int i=0;i<count;i++){
  MqlCalendarEvent e;if(!CalendarEventById(values[i].event_id,e)){Print("Missing calendar metadata; no file written.");return;}
  if(e.importance!=CALENDAR_IMPORTANCE_HIGH||e.type==CALENDAR_TYPE_HOLIDAY)continue;
  if(e.time_mode!=CALENDAR_TIMEMODE_DATETIME){Print("High-impact event has unknown exact time; abort rather than invent.");return;}
  long utc=(long)values[i].time-offset;if(utc<from||utc>=to)continue;
  bool exists=false;for(int k=0;k<ArraySize(rows);k++)if(rows[k].id==values[i].id){exists=true;break;}if(exists)continue;
  string name=StringSubstr(e.name,0,180);StringReplace(name,","," ");StringReplace(name,"\r"," ");StringReplace(name,"\n"," ");
  if(name==""||values[i].id==0){Print("Invalid calendar record; no file written.");return;}
  int n=ArraySize(rows);ArrayResize(rows,n+1);rows[n].id=values[i].id;rows[n].utc=utc;rows[n].name=name;
 }
 for(int i=1;i<ArraySize(rows);i++){NewsExportRow x=rows[i];int j=i-1;
  while(j>=0&&(rows[j].utc>x.utc||(rows[j].utc==x.utc&&rows[j].id>x.id))){rows[j+1]=rows[j];j--;}rows[j+1]=x;
 }
 int f=FileOpen("CEBONK_C2_NEWS.csv",FILE_WRITE|FILE_TXT|FILE_ANSI,0,CP_UTF8);if(f==INVALID_HANDLE){Print("Cannot open output ",GetLastError());return;}
 FileWriteString(f,"CEBONK_NEWS_V1,"+(string)from+","+(string)to+","+(string)(long)TimeGMT()+","+(string)ArraySize(rows)+"\r\n");
 FileWriteString(f,"value_id,release_epoch,currency,importance,name\r\n");
 for(int i=0;i<ArraySize(rows);i++)FileWriteString(f,(string)rows[i].id+","+(string)rows[i].utc+",USD,HIGH,"+rows[i].name+"\r\n");
 FileFlush(f);FileClose(f);Print("NEWS_EXPORT_OK ",ArraySize(rows)," high USD records. MQL5/Files/CEBONK_C2_NEWS.csv. Retrospective snapshot, not a point-in-time archive.");
}
