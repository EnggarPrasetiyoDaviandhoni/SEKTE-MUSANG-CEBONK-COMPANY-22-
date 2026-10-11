#!/usr/bin/env python3
"""Emoji-format static regression for the v2.11 MQL5 notification release."""
from pathlib import Path
base=Path(__file__).resolve().parents[1]
main=(base/"CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.11.mq5").read_text(encoding="utf-8")
notify=(base/"LSNotifyEmoji.mqh").read_text(encoding="utf-8")
dist=(base/"dist/CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.11.txt").read_text(encoding="utf-8")
preset=(base/"LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.11.set").read_text(encoding="utf-8")
checks={
 "v2.11 new version and separate notifier": '#property version "2.11"' in main and '#include "LSNotifyEmoji.mqh"' in main,
 "TXT exact source+notifier":dist==main.replace('#include "LSNotifyEmoji.mqh"',notify),
 "single notification on accepted entry": main.count('LSNotice("ENTRY_FILLED"')==1 and 'LSNotice("ENTRY_FILLED"' not in main.split('void OnTradeTransaction(')[-1],
 "BUY SELL signal colored emojis": all(t in main for t in ['"🟢 BUY"','"🔴 SELL"']),
 "weekly start/core/end with emoji": all(t in main for t in ['🔮 MULAI ',' • INTI ',' • AKHIR ',' WIB']),
 "entry SL TP prices and RR": all(t in main for t in ['🎯 ENTRY ','🛑 SL ','💰 TP ','3×ATR','RR 1:']),
 "TP and SL specific emojis": all(t in notify for t in ['😅 TAKE PROFIT','🥲 STOP LOSS']),
 "Friday close emoji": '🌙 FRIDAY AUTO CLOSE' in notify and '🎟️ Ticket ' in main,
 "start and autopilot notifications": all(t in notify for t in ['🚀 EA AKTIF','🤖 AUTOPILOT']),
 "no old generic header": 'LIQUIDITY SWEEP EA | "+event' not in notify,
 "Telegram + MT5 push maintained":'https://api.telegram.org/bot' in notify and 'SendNotification(' in notify,
 "no token logged":'token/response hidden' in notify,
 "ASTRO auto web still enabled":'InpAutoAstroWeb=true' in main and 'WebRequest("GET",InpAstroWebURL' in main,
 "ATR3 / RR4 / spread guard":all(t in main for t in ['InpSL_ATR=3.0','InpRR=4.0','InpMaxSpreadPoints=70']),
 "Friday close independent": main.index('LSCloseFriday();')<main.index('LSRefreshWeek();',main.index('void OnTimer(){')),
 "real lock and no trailing":'InpAllowRealAccount=false' in main and 'PositionModify(' not in main,
 "preset auto":'InpAutoAstroWeb=true' in preset and 'InpTelegram=true' in preset,
}
for name,ok in checks.items():
 assert ok,name
 print('PASS',name)
print('TOTAL',len(checks))
