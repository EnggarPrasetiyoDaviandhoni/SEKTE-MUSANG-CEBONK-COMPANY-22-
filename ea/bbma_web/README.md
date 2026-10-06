# CEBONK BBMA WEB EA v1.01

EA MT5 modular lan ringkes kanggo port **SCANNER BBMA** website menyang eksekusi broker. Folder iki anyar; web, Liquidity Sweep, Combined 2, News Attack lawas, lan Cloudflare Worker ora diowahi.

## Struktur source

- `src/CEBONK_BBMA_WEB.mq5` — orchestration, input, tombol AUTOPILOT.
- `src/BWCore.mqh` — SSOT BBMA closed-candle.
- `src/BWAstroNews.mqh` — jadwal Astrology web + Astrology News override.
- `src/BWTrade.mqh` — fixed-lot order, cut-profit, Telegram/MT5.

Ora ana file monster lan ora ana duplikasi mesin BBMA antar package.

## Rule BBMA sing di-port saka website

Paket independen:

1. H4 → H1 → M15
2. H1 → M15 → M5
3. M30 → M5 → M1
4. M15 → M5 → M1

Saben paket:

`TF1 RE-ENTRY -> TF2 CSAK utawa CSM -> TF3 CSM`

Kabeh nggunakake candle sing wis close. Baseline indikator padha karo `assets/technical-scanners-core.js`:

- Bollinger Band 20, deviasi 2, Close.
- LWMA 5 / 10 High-Low.
- Re-entry age 6 bar.
- TF2 confirm age 6 bar.
- TF3 confirm age 6 bar.
- Signal TF3 ora langsung mati sakbar close: valid window = **1 bar TF3 utawa minimal 5 menit**, endi sing luwih dawa. Dadi M1/M5 minimal 5 menit, M15 15 menit.
- EA re-evaluate nalika candle anyar muncul ing **M1, M5, M15, M30, H1, H4**, ora mung TF eksekusi.

Siji paket valid cukup kanggo calon entry. Yen luwih saka siji paket searah, Telegram menehi label **STRONG CONFLUENCE**. Yen raw package BUY lan SELL padha-sama valid, EA **CONFLICT → WAIT**.

## Astrology

Arah dudu saka BBMA. EA maca jadwal model Astrology website sing padha saka:

`https://enggarprasetiyodaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/ea/combined2/data/YYYY-MM.csv`

Model ID sing ditampa dikunci: `CEBONK_C2_WEB_V1_35ce78b4`.

Mode normal:
- arah Astrology saiki kudu BUY/SELL;
- arah Astrology nalika candle TF3 signal close kudu padha;
- BBMA kudu searah.

Ora ana fallback arah manual yen jadwal gagal. Data Astrology iki tetep model eksperimen sing durung dibuktekake win rate/profit.

## Astrology News — override

Default `InpUseAstrologyNews=true`. Live event nggunakake **MT5 Economic Calendar, USD HIGH impact, exact time**. News mung anchor wektu; arah tetep saka jadwal Astrology web.

Policy ngikut default tab **ASTROLOGY NEWS**:
- scan 30 menit sadurunge;
- scan 120 menit sawise;
- buffer no-entry 5 menit sadurunge / 5 menit sawise release;
- kandidat entry mung 10 menit awal saben window;
- minimal window arah 15 menit;
- event liyane sing ana ing kalender uga dadi buffer.

EA nyusun ulang focus BUY/SELL saka slot Astrology 5 menit: run valid paling dawa menang; total durasi dadi tie-break; yen tetep imbang → WAIT.

Prioritas:
`ASTROLOGY NEWS aktif -> override ASTROLOGY normal`.

Dadi nalika ana episode news, jalur normal diparkir. Yen durung mlebu kandidat window, arah ora cocok, utawa kalender ora sehat, ora ana entry anyar. Signal teknikal TF3 uga kudu close nang window entry Astrology News sing padha.

Bedane source event karo website: tab web saiki nganggo kalender snapshot/preset; EA live nggunakake MT5 Calendar supaya ora gumantung snapshot lawas. **Policy Astrology News padha, source jadwal event live luwih dinamis.**

## Lot, SL, TP, exit

- Fixed lot default `0.01`.
- Max spread default `70 points`.
- Ora ana risk-percent sizing.
- Ora ana ATR.
- Ora ana martingale/recovery/layering.
- Ora ana BE/trailing/strategic partial close.
- Maksimal siji posisi utawa pending order per symbol.

SL:
- BUY = Lower BB TF2 − buffer harga.
- SELL = Upper BB TF2 + buffer harga.
- default buffer = `0.20` harga XAU, bisa disetel.

TP:
- dihitung saka **fill/quote aktual** supaya RR aktual dijaga.
- default `RR 1:2`, bisa disetel.

Cut-profit default ON:
- mung sawise posisi minimal `+1R`;
- close yen TF3 metu CSM lawan **utawa** TF2 close nyabrang Mid BB nglawan posisi.

## Anti tabrakan / anti double-entry

- Astrology News menang saka Astrology normal.
- raw BBMA BUY+SELL bareng = CONFLICT.
- `MaxPositionsPerSymbol = 1` sacara praktik: EA nolak entry yen simbol wis duwe posisi/order, kalebu manual/EA liyane.
- Signal key = package + direction + TF3 event close + mode NORMAL/NEWS.
- Signal di-reserve sadurunge OrderSend; reject/timeout ora dikejar maneh.
- Tombol chart mung **AUTOPILOT ON/OFF**.

## Pasang

Copy papat file `src/` menyang folder sing padha:

`MQL5/Experts/CEBONK_BBMA_WEB/`

Compile `CEBONK_BBMA_WEB.mq5` ing MetaEditor. Pasang ing chart `XAUUSDc`; TF chart bebas.

Tools → Options → Expert Advisors → Allow WebRequest:

- `https://enggarprasetiyodaviandhoni.github.io`
- `https://api.telegram.org`

Isi token/chat Telegram dhewe. Token ora disimpen ing repo.

Default `InpAutopilot=false` lan `InpAllowRealAccount=false`. Uji DEMO dhisik.

## Strategy Tester

Astrology live WebRequest ora dadi basis tester. Gunakake:
- `InpAstroSource=BW_ASTRO_LOCAL_CSV`
- file `CEBONK_C2_ASTRO.csv` saka `ea/combined2/news_attack/dist/` menyang `MQL5/Files`.

Yen arep replay Astrology News:
- export kalender nganggo tool Combined 2 sing wis ana;
- pasang `CEBONK_C2_NEWS.csv` menyang `MQL5/Files`;
- `InpNewsSource=BW_NEWS_LOCAL_CSV`;
- `InpAllowNewsCSVReplay=true`.

CSV news iku snapshot retrospektif; ora padha karo informasi sing mesthi wis dingerteni real-time nalika sejarah kasebut.

## Status validasi

CI repository mriksa struktur source, rule parity utama, no-ATR/no-martingale guard, default news policy, anti-conflict, anti-duplicate, lan wiring modular. **MetaEditor compile, broker execution, Telegram credential nyata, lan profitability durung diuji dening CI Linux iki.** Aja nganggep source pass static test = profit utawa bebas kabeh bug runtime.
