## Model V2 — fokus jumlah aspek aktif (12 Oktober 2026)

Publisher kini mengimpor `assets/albiruni-core.js` yang menggunakan `ALBIRUNI_AUTO_MAJORITY_V2`. Arah jam dihitung dengan suara mayoritas aspek aktif: 2 SELL + 1 BUY → SELL, sebaliknya BUY, suara imbang → KONFLIK/WAIT. Arah dominan harian berasal dari akumulasi jumlah suara aspek dalam grid, bukan penjumlahan bobot planet. **Fokus jam dan fokus harian dapat berbeda** karena jendela waktunya berbeda; calon entry masih memerlukan arah harian searah jam APPLYING dan aspek EXACT berikutnya.

Filter kualitas waktu Al-Biruni klasik §527 **tetap aktif** setelah pemilihan arah. MENGUNTUNGKAN pada dua titik → kandidat diteruskan, selain itu WAIT. File MQ5 tetap mengikuti kontrak 12 kolom, tidak memerlukan compile ulang untuk perubahan arah feed, tapi live EA dengan AUTOPILOT ON dapat mengambil feed yang berubah setelah GitHub Actions menerbitkannya. Penggunaan real belum tervalidasi dan tidak dianjurkan; uji di demo dahulu. Tidak ada jaminan strategi ini menang meskipun sinyal bertambah.

---

## v1.02 publisher: §527 favorable/harmful/mixed electional gate (12 October 2026)

The feed generator no longer applies a fixed 07:00–23:00 WIB candidate window. The EA still checks actual broker sessions and its existing intraday close cutoff; overnight market-closed windows do not cause guaranteed entries. 

The unchanged MT5 EA v1.01 reads the **same 12-column ALBIRUNI_INTRADAY_V1 CSV**; no MQ5 or .set replacement is required. New publisher computes the same experimental daily BUY/SELL bias and an APPLYING candidate, then calls the **separate Al-Biruni election research engine** at candidate ENTRY and five minutes before astronomical EXACT. A candidate is published only when both time checks return MENGUNTUNGKAN; otherwise the EA sees WAIT and opens nothing. The gate **never changes BUY into SELL or vice versa**.

Time quality follows an explicitly *modern conservative heuristic inspired by* the original electional considerations in the user-supplied §527: avoid malefic rays to Ascendant, Moon and their rulers; require benefic contact to Ascendant or Moon and a Moon–Ascendant ruler relationship. Mixed contacts, harmful contacts, insufficient support, missing ephemeris or uncertainty at sunrise/sunset => WAIT. This is **not a verbatim Al-Biruni BUY/SELL strategy**, and there is no established predictive value for XAUUSD.

Location for Ascendant is **a chosen reference**, not automatically the broker's server or the user's actual geographic location. Publisher defaults to Jakarta latitude -6.2000, longitude +106.8167, election orb 2°. Override with `--latitude=-7.2575 --longitude=112.7521 --election-orb=2` for Surabaya, or another explicit location. To compare unfiltered outputs **offline only**, `--gate=shadow` keeps the previous direction and writes diagnostic election status; do not use shadow mode for unattended live publishing. Production defaults to `--gate=enforce`.

The daily JSON manifest records `election.status`, `election.reason`, `election.reference`, candidate timestamps and two classical checks when present. CSV remains backward compatible. This only blocks some hypothetical trades; it **does not validate forecasting accuracy**, ensure profitable entries or replace MT5's separate real account lock (default OFF). A published position can remain open after the favorable window; existing ATR SL/TP, time cutoff, broker session deferral and risk controls are unchanged. Favorable classification is determined in advance, but not a guarantee that the broker session or price direction will cooperate.

---

# CEBONK AL-BIRUNI INTRADAY EA v1.01 — WAIT MARKET OPEN

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

1. Download CEBONK_ALBIRUNI_INTRADAY_v1.01.mq5 (or rename dist/CEBONK_ALBIRUNI_INTRADAY_v1.01.txt to .mq5). The v1.00 files are retained only as a previous version.
2. Put the MQ5 file in File -> Open Data Folder -> MQL5 -> Experts, then compile in MetaEditor.
3. Apply to broker NOZAX chart XAUUSDc. Any chart TF; EA timer governs entry and M15 governs ATR.
4. Optionally load CEBONK_ALBIRUNI_INTRADAY_v1.01.set. Always verify symbol, broker digits, volume and trading sessions.
5. MT5 Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL:
   - https://raw.githubusercontent.com
   - https://api.telegram.org (if Telegram notification used)
6. Fill InpTelegramToken and InpTelegramChatID only in your private MT5 terminal, NEVER in public GitHub.
7. Enable Algo Trading. Default Autopilot OFF, EnableExperimentalAstro OFF, RealAccountLocked. For demo, set InpEnableExperimentalAstro=true, and then click AUTOPILOT ON. Live requires separate deliberate InpAllowRealAccount=true and is NOT advised without extensive tests.

## Trading configuration

Symbol XAUUSDc; fixed 0.01 lot; MAX spread 70 points; magic 221026; one own position at a time; anti-duplicate SignalID stored in terminal Global Variables. No reversal or forced daily entry.

ATR(14) from closed M15 bar: SL=3xATR and TP=2x the actual tick-rounded risk (RR 1:2). ATR NEVER decides BUY or SELL. Stop levels, quote age, spread, volume step and broker trade permissions are checked.

**v1.01 market session policy:** No fixed 07:00–23:00 WIB hour gate. A BUY/SELL may be considered at the exact Al-Biruni ENTRY time on the matching WIB weekday. For a market that was open at its scheduled ENTRY, keep the existing 480-second late limit (no arbitrary chase). If the broker trading-session timetable proves the symbol's session was **closed at scheduled ENTRY**, label `WAIT_MARKET_OPEN`, and allow entry later only when the symbol's **broker trading session is open**, the same-day feed is still valid, and the APPLYING phase is **strictly before INTI** (also before expiry/AKHIR). Quote freshness, stop-level, lot, spread, real-account lock and all other guards still apply. Sessions are read from MT5 `SymbolInfoSessionTrade` in broker-server time, including overnight sessions. If session metadata is missing, do **not** extend the eight-minute entry grace; session schedule alone never guarantees broker will fill an order. Normal signal feed refresh stays unchanged; there is no broker-closed-order queue and no carryover across dates.

**Auto-close remains unchanged:** if `InpCloseIntraday=true`, entry after its configured 23:45 WIB close cutoff is skipped to avoid an open-then-immediately-close loop; the EA attempts to close owned positions at/after the cutoff, even when feed is unavailable, and may fail during actual market closures or disconnections. If `InpCloseIntraday=false`, entry can be considered after 23:45 WIB if the Al-Biruni phase and broker session are still valid. Broker-side SL/TP remain placed. No BE, trailing, partial close, recovery or layering.

OnTimer checks execution windows every second and polls WebRequest every 300 seconds. Time feed is Unix UTC epoch; display and Telegram convert to WIB; broker GMT+3 auto offset fallback configured. Live WebRequest is synchronous; broker/disconnection delays are possible.

## Telegram / Push messages

**AUTOPILOT notifications:** on each successful chart button click, one `🟢 AUTOPILOT ON` or `🔴 AUTOPILOT OFF` notice is sent to both enabled channels (Telegram and MT5 Push), including the symbol. No false ON notice is sent when `REAL_ACCOUNT_LOCKED` or `EXPERIMENTAL_ASTRO_NOT_ACKNOWLEDGED` prevents enabling. Controlled by `InpNotifyAutopilot=true`; attaching/restarting the EA does not issue a toggle notice. `SendNotification` failures log `MT5_PUSH_FAILED_ERR_<code>` in Experts. Configure MetaQuotes ID under MT5 Tools → Options → Notifications and enable push there; to receive Telegram, configure token and chat ID and allow `https://api.telegram.org` in Tools → Options → Expert Advisors.

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
