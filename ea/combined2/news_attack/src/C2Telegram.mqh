string Html(const string s) {
 string out=s;StringReplace(out,"&","&amp;");StringReplace(out,"<","&lt;");StringReplace(out,">","&gt;");StringReplace(out,"\"","&quot;");return out;
}
string NoticeTitle(const string event) {
 if(event=="SIGNAL_VALID")return "🎯 SINYAL WIS SELARAS";
 if(event=="ENTRY_FILLED")return "✅ ORDER WIS MLEBU";
 if(event=="POSITION_CLOSED")return "🏁 POSISI WIS RAMPUNG";
 if(event=="EXIT_DEAL_PARTIAL")return "ℹ️ EXIT SEBAGIAN SAKA BROKER / MANUAL";
 if(event=="NEWS_ATTACK_OPEN")return "⚡ NEWS ATTACK — WINDOW BUKA";
 if(event=="NEWS_ARMED")return "🕒 NEWS SIAGA — ORA ENTRY DHISIK";
 if(event=="NEWS_COOLDOWN")return "⏸ NEWS COOLDOWN";
 if(event=="NEWS_WINDOW_END")return "⌛ NEWS WINDOW RAMPUNG";
 if(event=="NEWS_READY")return "📅 KALENDER NEWS SIAP";
 if(event=="NEWS_DATA_WAIT"||event=="ENTRY_BLOCKED")return "⛔ ENTRY DITAHAN";
 if(event=="ORDER_REJECTED")return "❌ ORDER DITOLAK";
 if(event=="EA_STARTED")return "⚙️ EA WIS URIP";
 if(event=="AUTOPILOT")return "⚙️ AUTOPILOT";
 if(event=="TELEGRAM_TEST")return "📨 TES TELEGRAM — ORA ANA ORDER";
 return "ℹ️ "+event;
}
void Notice(const string event,const string text,const string mode="SYSTEM") {
 Audit(event,mode+" | "+text);if(gTester)return;
 int n=ArraySize(gQueue);if(n>=32){Print("C2 notify queue full; event kept in audit.");return;}
 ArrayResize(gQueue,n+1);gQueue[n].event=event;gQueue[n].tries=0;gQueue[n].pushed=false;
 string detail=StringSubstr(text,0,2600); // bounded BEFORE escaping; no broken HTML tags
 gQueue[n].push=event+" | "+mode+" | "+InpSymbol+" | "+detail;
 gQueue[n].text="<b>"+Html(StringSubstr(InpTelegramBrand,0,90))+"</b>\n<b>"+Html(NoticeTitle(event))+"</b>\n"+
 "━━━━━━━━━━━━━━━━━━\n<b>COMBINED 2 · "+Html(mode)+"</b>\n"+
 Html(InpSymbol)+" | "+Html(WIB(NowUTC()))+"\nAUTOPILOT: <b>"+(gAuto?"ON":"OFF — SINYAL TOK")+"</b>\n"+
 "━━━━━━━━━━━━━━━━━━\n"+Html(detail)+"\n━━━━━━━━━━━━━━━━━━\n<b>OJO FULLMARGIN COK</b>";
}
void PopNotice() {int n=ArraySize(gQueue);for(int i=1;i<n;i++)gQueue[i-1]=gQueue[i];ArrayResize(gQueue,n-1);}
int RetryAfter(const string json) {
 int p=StringFind(json,"\"retry_after\"");if(p<0)return 60;p=StringFind(json,":",p);if(p<0)return 60;p++;
 while(p<StringLen(json)&&StringGetCharacter(json,p)==32)p++;
 string digits="";while(p<StringLen(json)){ushort c=StringGetCharacter(json,p++);if(c<48||c>57)break;digits+=ShortToString(c);}
 int seconds=(int)StringToInteger(digits);return (int)MathMax(1,MathMin(seconds>0?seconds:60,3600));
}
void FlushNotice() {
 if(gTester||ArraySize(gQueue)==0||(long)TimeLocal()<gNextNotify)return;gNextNotify=(long)TimeLocal()+7;
 if(!gQueue[0].pushed){if(InpMT5Push&&!SendNotification(StringSubstr(gQueue[0].push,0,250)))Print("C2 MT5 push gagal; cek Notifications.");gQueue[0].pushed=true;}
 if(!InpTelegram||InpTelegramToken==""||InpTelegramChatID==""){PopNotice();return;}
 string body="{\"chat_id\":"+Q(InpTelegramChatID)+",\"parse_mode\":\"HTML\",\"text\":"+Q(gQueue[0].text)+"}";
 char bytes[],answer[];string headers;int len=StringToCharArray(body,bytes,0,WHOLE_ARRAY,CP_UTF8);if(len>0)ArrayResize(bytes,len-1);
 ResetLastError();int http=WebRequest("POST","https://api.telegram.org/bot"+InpTelegramToken+"/sendMessage","Content-Type: application/json\r\n",InpHTTPTimeoutMs,bytes,answer,headers);
 string response=CharArrayToString(answer,0,WHOLE_ARRAY,CP_UTF8),compact=response;StringReplace(compact," ","");
 if(http==200&&StringFind(compact,"\"ok\":true")>=0){PopNotice();return;}
 gQueue[0].tries++;Print("C2 Telegram HTTP=",http," err=",GetLastError(),"; credentials/response hidden.");
 if(http==400||http==401||http==403||gQueue[0].tries>=3)PopNotice();
 else gNextNotify=(long)TimeLocal()+(http==429?RetryAfter(response):30);
}
