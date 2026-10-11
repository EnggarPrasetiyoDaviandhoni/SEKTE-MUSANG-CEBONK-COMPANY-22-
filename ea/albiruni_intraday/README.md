# CEBONK AL-BIRUNI INTRADAY EA v1.00

Independent new MT5 Expert Advisor. No changes to BBMA, Liquidity Sweep, Luxor Astrology, BaZi, Astrology News or old EA. Astronomy-only experimental BUY/SELL, NOT a validated market predictor.

## Separate Al-Biruni feed

The publisher scripts/generate-albiruni-intraday.mjs imports the same assets/albiruni-core.js v1.5 as the AL-BIRUNI web panel and astronomy-engine@2.1.19. It calculates daily (mode=day, Moon focus, 2° orb), one direction BUY/SELL/WAIT. For BUY/SELL, it searches for a same-side ACTIVE APPLYING aspect with an actual future EXACT contact within the current weekday.

- AWAL: first sampled signal time (15-minute grid).
- ENTRY: 15 minutes after AWAL, only if signal is still same-direction and exact remains ahead.
- INTI: ephemeris-refined exact contact time (not merely strongest score).
- AKHIR: earliest expiry of signal window or actual selected aspect window.
- Weekend, opposite, no exact, no strong daily direction, expired or broken data: WAIT, no entry.

An astronomical exact contact can be computed, but its predictive relation to XAUUSD has not been validated. No market prices are used to generate the feed.

Live CSV (for WebRequest):
https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/albiruni_intraday/data/intraday.csv

Audit JSON (not the EA parser):
https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/albiruni_intraday/data/intraday.json

This is NOT the preexisting weekly feed of Liquidity Sweep / Luxor Astrology.

The new GitHub Actions workflow prepares Monday on Sunday 20:17 WIB, with daily weekday retries at 04:17 and 06:17 WIB. Jobs can be delayed or fail. The EA refuses entries when the live file is unavailable, stale, corrupt, or dated differently.

## Install in MT5

1. Download dist/CEBONK_ALBIRUNI_INTRADAY_v1.00.txt. Rename to CEBONK_ALBIRUNI_INTRADAY_v1.00.mq5.
2. Put the MQ5 file in File -> Open Data Folder -> MQL5 -> Experts, then compile in MetaEditor.
3. Apply to broker NOZAX chart XAUUSDc. Any chart TF; EA timer governs entry and M15 governs ATR.
4. Optionally load CEBONK_ALBIRUNI_INTRADAY_v1.00.set. Always verify symbol, broker digits, volume and trading sessions.
5. MT5 Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL:
   - https://raw.githubusercontent.com
   - https://api.telegram.org (if Telegram notification used)
6. Fill InpTelegramToken and InpTelegramChatID only in your private MT5 terminal, NEVER in public GitHub.
7. Enable Algo Trading. Default Autopilot OFF, EnableExperimentalAstro OFF, RealAccountLocked. For demo, set InpEnableExperimentalAstro=true, and then click AUTOPILOT ON. Live requires separate deliberate InpAllowRealAccount=true and is NOT advised without extensive tests.

## Trading configuration

Symbol XAUUSDc; fixed 0.01 lot; MAX spread 70 points; magic 221026; one own position at a time; anti-duplicate SignalID stored in terminal Global Variables. No reversal or forced daily entry.

ATR(14) from closed M15 bar: SL=3xATR and TP=2x the actual tick-rounded risk (RR 1:2). ATR NEVER decides BUY or SELL. Stop levels, quote age, spread, volume step and broker trade permissions are checked.

Entry only when current WIB day matches feed, current time is ENTRY to strictly before INTI/AKHIR, and delay <=480 seconds. If candidate is stale, no chase. StartHourWIB=07, EndHourWIB=23. After 23:45 WIB, attempts to close its own positions before intraday rollover; market closures and disconnections may prevent execution. Broker-side SL/TP remain placed. No BE, trailing, partial close, recovery or layering.

OnTimer checks execution windows every second and polls WebRequest every 300 seconds. Time feed is Unix UTC epoch; display and Telegram convert to WIB; broker GMT+3 auto offset fallback configured. Live WebRequest is synchronous; broker/disconnection delays are possible.

## Telegram / Push messages

Notice only after an actual broker DEAL_ADD, NOT after merely receiving a schedule. Keyed by unique position ID to avoid duplicate ENTRY or TP/SL notices on restart/partial fills. Push and Telegram can be enabled independently.

Illustrative ENTRY format (numbers below are dummy data):

🦊 SEKTE MUSANG TEORY
CEBONK COMPANY 22

🪐 AL-BIRUNI INTRADAY
🟢 BUY XAUUSDc

📅 Tanggal: 2026-10-12
🕐 Entry: 2026-10-12 09:30 WIB

🌙 AWAL: 2026-10-12 09:00 WIB
☀️ INTI: 2026-10-12 12:00 WIB
🌑 AKHIR: 2026-10-12 15:00 WIB

💰 Entry: 4050.00
🛑 SL: 4041.00
🎯 TP: 4068.00

📊 RR 1:2
🛡️ AUTOPILOT ON

⚠️ OJO FULLMARGIN COK!

TP notice: 🦊 AL-BIRUNI INTRADAY / 🟢 BUY XAUUSDc / 😅 TAKE PROFIT
SL notice: 🦊 AL-BIRUNI INTRADAY / 🟢 BUY XAUUSDc / 🥲 STOP LOSS

No P/L. Telegram sends UTF-8 percent-encoded HTTPS POST to api.telegram.org and requires WebRequest allowlisting.

## Strategy Tester

MT5 Strategy Tester does NOT support WebRequest. The EA reads local InpTesterCSV=CEBONK_ALBIRUNI_INTRADAY.csv via the SAME strict ABLoad parser. Place a complete historical file with the header and one row PER DATE into tester MQL5/Files. A one-day current feed cannot backtest 2024–2026; that historical dataset is NOT in this release. NO invented win rate or profitability.

The automated GitHub Actions test installs astronomy-engine@2.1.19, runs tests/albiruni-intraday-feed.test.cjs, generates a real ephemeris weekday, and validates CSV/JSON and EA source invariants with ea/albiruni_intraday/tests/test_static.py. NO MetaEditor compilation or NOZAX runtime test is claimed. Verify in MetaEditor and a demo account before trading.

Manual generator: node scripts/generate-albiruni-intraday.mjs --date=2026-10-12 --out=/tmp/albiruni.csv --json=/tmp/albiruni.json

Security: experimental astrology is NOT a validated XAUUSD directional or entry-timing predictor. Test historical returns and drawdown independently. Do not put Telegram secrets in the repository.
