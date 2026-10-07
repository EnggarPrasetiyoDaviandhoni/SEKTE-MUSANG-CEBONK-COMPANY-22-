# CEBONK LIQUIDITY SWEEP MT5 v1.00

EA scanner MT5 kapisah kanggo mesin **Liquidity Sweep** sing selaras karo `assets/technical-scanners-core.js`. Modul BBMA lawas ora diowahi.

## Alur sinyal

Paket independen:
1. H4 → H1 → M15
2. H1 → M15 → M5
3. M30 → M5 → M1
4. M15 → M5 → M1

Urutan:
`TF1 LIQUIDITY MAP → TF2 SWEEP + DISPLACEMENT + STRUCTURE BREAK → TF3 RETEST → ASTROLOGY GATE`

TF1 map:
- pivot depth 2;
- lookback 80 candle;
- SWING LOW/HIGH lan EQUAL LOW/HIGH;
- maksimal 12 level paling anyar.

TF2:
- sweep BUY: low nusuk liquidity banjur close bali ing ndhuwur level;
- sweep SELL: high nusuk liquidity banjur close bali ing ngisor level;
- struktur = high/low 6 candle sadurunge sweep;
- displacement maksimal 3 bar saka sweep;
- body displacement minimal 1.20 × median body;
- displacement kudu close nembus struktur.

TF3:
- retest BUY: low nyentuh/break struktur banjur close ing ndhuwur;
- retest SELL: high nyentuh/break struktur banjur close ing ngisor;
- scanner milih setup valid paling anyar;
- setup expired di-skip yen ana setup anyar;
- signal hold = 1 bar TF3 utawa minimal 5 menit, sing luwih dawa.

Kabeh nggunakake **closed candle**.

## Astrology

Astrology tetep master direction/time kaya web. Normal gate mbutuhake arah Astrology saiki lan nalika TF3 event padha karo arah Liquidity. Astrology News bisa override jalur normal nganggo policy sing padha karo EA BBMA: USD HIGH impact, buffer release, lan window entry.

## Output

EA iki versi **signal-only**:
- Telegram JSON POST;
- MT5 Push;
- tombol chart `SCANNER ON/OFF`;
- anti-duplicate nganggo Global Variable;
- output level liquidity, structure break, TF3 retest, reference close, reference SL sweep, lan reference TP RR.

Ora ana `OrderSend`, ora ana posisi otomatis, ora ana martingale/recovery/layering/BE/trailing.

## File

- `src/CEBONK_LIQUIDITY_SWEEP.mq5` — orchestration scanner.
- `src/LSCore.mqh` — SSOT Liquidity Sweep.
- `src/LSAstroNews.mqh` — Astrology + Astrology News.
- `src/LSNotify.mqh` — Telegram/MT5 notification.
- `LIQUIDITY_SWEEP_DEFAULT.set` — preset default.
- `dist/CEBONK_LIQUIDITY_SWEEP_v1.00.txt` — single-file TXT release.

## Pasang

Copy 4 file ing `src/` menyang folder sing padha ing `MQL5/Experts/CEBONK_LIQUIDITY_SWEEP/`, compile `CEBONK_LIQUIDITY_SWEEP.mq5`, banjur pasang neng chart `XAUUSDc`. TF chart bebas.

Kanggo live Astrology/Telegram, Allow WebRequest:
- `https://enggarprasetiyodaviandhoni.github.io`
- `https://api.telegram.org`

Token Telegram ora disimpen neng repo.

## Validasi

GitHub CI mung static/source validation lan parity guard. CI Linux ora compile nganggo MetaEditor lan ora mbuktekake profitabilitas utawa runtime broker behavior.
