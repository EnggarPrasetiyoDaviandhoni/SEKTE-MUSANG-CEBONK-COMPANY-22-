# CEBONK COMBINED 2 + NEWS ATTACK v1.10

EA siji, rong mode entry. NORMAL tetep default eksekusi M5. NEWS ATTACK nganggo trigger M1 lan konfirmasi M5. COMBINED 1, web, Worker, jadwal Astrology lan EA Combined 2 v1.00 ora diganti. Iki versi anyar kanggo ngganti EA v1.00 sing dipasang, dudu dipasang dobel ing simbol sing padha.

## Logika sing ditambah

Default `InpRunMode=C2_NORMAL_AND_NEWS`:

ASTROLOGY arah/window -> jadwal USD HIGH -> SND/SNR MN1/W1/D1/H4/H1 -> konfirmasi Musang M5 -> Musang M1 IB/CB1 break/retest -> protected market order.

Arah BUY/SELL tetep saka Astrology, ora saka actual, forecast utawa arah spike news. Lokasi FRESH dadi prioritas; TESTED 1x isih oleh. BROKEN, data gap lan tested luwih saka 1x tetep diblokir. Aturan numerik lokasi lan Musang asli Combined 2 dipertahankan, dudu kabeh level ing workbook Fibo Musang.

T = jam rilis event sing dilaporake kalender MT5:
- T-10 nganti T+2 menit: ora ana entry anyar. NORMAL uga ditahan.
- T+2 nganti SADURUNGE T+15 menit: NEWS ATTACK bisa entry yen kabeh syarat lengkap. NORMAL tetep ditahan supaya ora bypass aturan news.
- T+15 lan sawise: NORMAL bisa aktif maneh ing setup anyar sing reteste ora nyabrang periode news. NEWS event mau wis expired.

Window iki aturan eksekusi sing bisa disetel, dudu ramalan kapan whipsaw rampung. Yen ora ana setup ing window, ora ana order.

Trigger NEWS iku **candle retest M1 sing wis tutup**, dudu langsung touch/detik rilis. CB1 M1 kudu break sawise release, retest kudu mulai ing T+2 utawa luwih, lan order kudu dikirim sadurunge T+15. Dadi retest sing mulai pas T+2 paling awal ditindak sawise tutup, kira-kira T+3, dudu janji entry pas T+2.

Konfirmasi M5 dibaca saka candle sing wis tutup SAURUNGE utawa pas wiwitan retest M1. Kudu IB + CB1 break searah, stage WAIT_RETEST utawa RETEST_VALID, close M5 isih ngliwati CB1 ing arah kasebut, lan break ora luwih lawas saka 60 menit (input). M5 ora diwajibake retest maneh ing detik sing padha karo M1. M5 dudu MA/ATR filter; NEWS ora nambah MA20/MA50.

Window Astrology kudu searah ing wiwitan retest lan nalika order arep dikirim, ing ID/window sing padha. Window news ora bisa mbukak entry ing njaba jam Astrology. Yen ana news liyane, pre-release/cooldown event liyane luwih prioritas tinimbang window attack sing isih aktif.

## Batas order lan risiko

Maksimal siji **percobaan kirim order** saben kelompok news kanthi wektu release padha. NFP, pengangguran, upah, lan indikator liyane sing rilis bareng ora ngasilake order dobel. Identitas release lan ID event disimpen sadurunge OrderSend; reject/timeout uga nganggo jatah kasebut, ora retry/chase. Kalender reschedule ora mbusak cathetan ID sing wis digunakake. Ana lock instance lan anti-duplikat lokal; iki dudu koordinasi global antar VPS.

Siji posisi utawa pending order saben simbol, kalebu posisi manual/EA liyane. Posisi sing wis mbukak ora ditutup otomatis mung amarga news teka. Ora ana layering, martingale, recovery, breakeven, trailing utawa partial close strategi. Partial fill/exit saka broker/manual dicatat tanpa top-up otomatis.

Default sing dipertahankan:
- XAUUSDc; magic 220202; fixed lot 0.01; spread maksimum 70 broker points.
- SL njaba wick Zone IB + buffer 5% lebar body zone.
- Pilihan TP Fibo 1.618 / 2.618 / 4.23; default 2.618. RR saka jarak nyata, ora otomatis 1:2.
- Batas perkiraan risiko fixed-lot 1% equity; lot ora ditambah. Slippage/biaya bisa nggawe loss nyata luwih gedhe.
- Batas drift quote 0.25R saka retest acuan lan keterlambatan order 15 detik sawise candle retest tutup.
- AUTOPILOT OFF; InpAcceptExperimentalAstro=false; akun real dikunci (`InpAllowRealAccount=false`).

NEWS nggunakake SL/TP struktur M1; NORMAL nggunakake struktur TF normal sing dipilih (default M5). Ora ana loosening spread utawa nambah lot kanggo 'attack'.

## Pasang neng MT5 desktop

Pilih `CEBONK_COMBINED2_NEWS_ATTACK_v1.10.mq5` saka dist/paket. File TXT isine padha persis; rename dadi .mq5 yen nganggo TXT. Lebokke neng MQL5/Experts, compile nganggo MetaEditor, banjur pasang neng chart XAUUSDc akun DEMO. TF chart bebas; input ngontrol TF eksekusi.

Copot EA v1.00 saka chart sing bakal diganti. Aja ngarepake versi lawas lan anyar entry bareng: magic/lock/symbol guard padha. Ora ana perubahan marang file EA lawas utawa Combined 1.

MT5 -> Tools -> Options -> Expert Advisors -> Allow WebRequest:

```
https://enggarprasetiyodaviandhoni.github.io
https://api.telegram.org
```

Isi `InpTelegramToken` lan `InpTelegramChatID` dhewe. Token ora ana ing source/preset/repository. Bukak/start bot utawa tambah bot ing grup sing bener. `InpTelegramTestOnStart=true` ngirim TES tanpa trade, liwat antrean timer.

Kanggo demo sing disengaja: `InpAcceptExperimentalAstro=true`, Algo Trading aktif, banjur tombol AUTOPILOT ON. Default input run mode wis NORMAL + NEWS. `C2_NORMAL_ONLY` mulihake jalur normal tanpa kalender; `C2_NEWS_ONLY` mung golek entry ing window news. OFF tetep bisa ngirim sinyal sing lolos, ora order.

## Kalender otomatis

Live default `InpNewsSource=C2_NEWS_MT5_CALENDAR`. EA nggunakake CalendarValueHistory filter USD, banjur importance HIGH lan jam rilis sing exact. Metadata lan tanggal dipriksa ulang default saben 60 detik, cache maksimum 180 detik. Ora perlu API news pihak katelu utawa browser/web tetep mbukak.

Wektu kalender MT5 yaiku SERVER TIME, dikonversi menyang UTC nganggo offset server lan ditampilke WIB. Yen offset ganti, cache lawas ora oleh ngaktifke trade. Jadwal sing pisanan katon sawise release ora dipakai kanggo attack event kasebut. Speeches/indikator sing ora ana wektu exact ora digawe-gawe: kalender ditahan nganti data bisa dipesthekake. Status HIGH gumantung sing dilaporake kalender, dudu daftar event hardcode.

Kalender error, data durung lengkap/stale, jam rilis ambigu, utawa coverage ora cukup -> WAIT. Ing NORMAL_AND_NEWS, NORMAL uga ditahan nalika kesehatan kalender ora cetha; pilih NORMAL_ONLY mung kanggo sengaja mateni fitur news. Respons sukses kanthi nol event ing rentang sing dipriksa beda karo gagal njupuk kalender.

News ngandhut jadwal, ora nebak asil rilis. Sinyal Astrology uga tetep model eksperimen, durung ana bukti win rate/profit. Aja nganggep kalender/SL njamin aman saka gap utawa slippage.

## Telegram sing dikirim

Pesan HTML rapi, dikirim liwat JSON POST. Journal/audit tetep JSON/CSV. Ana jeneng mode, jam WIB, news/release/window, arah Astrology, lokasi HTF + fresh/tested, konfirmasi M5/M1, CB1/Zone IB, entry acuan, SL lan TP1-3.

Sinyal lan order KEISI dibedakake. `ENTRY_FILLED` mung saka deal broker terkonfirmasi; ngemot fill nyata, lot, SL/TP, RR fill, lan slippage vs request (+ tegese luwih elek). Posisi rampung ngirim alasan TP/SL/liyane lan net kalebu commission/fee/swap sing broker catat ing deal posisi kasebut. Biaya balance kapisah ora bisa diatribusikake kanthi otomatis.

Event utama: EA_STARTED, TELEGRAM_TEST, NEWS_READY, NEWS_DATA_WAIT, NEWS_ARMED, NEWS_COOLDOWN, NEWS_ATTACK_OPEN, NEWS_WINDOW_END, NEWS_SKIPPED, SIGNAL_VALID, ENTRY_FILLED, ENTRY_BLOCKED, ORDER_REJECTED, POSITION_CLOSED.

Teks dynamic di-escape kanggo HTML/JSON; token lan response mentah ora dicetak. Retry maksimal 3; rate-limit nganggo retry_after. Delivery sing ora mesthi bisa nggawe notifikasi dobel, nanging ora nyebabake trade dobel. Antrean timer bisa menehi jeda pesen; ora janji notifikasi instan. Notifikasi dipateni ing Strategy Tester.

## Backtest sing bener

CalendarValueHistory lan WebRequest ora bisa diandelake langsung ing Strategy Tester. EA nggunakake CSV lokal kanggo backtest. Paket wis ngemot jadwal Astrology asli `CEBONK_C2_ASTRO.csv` (coverage 2026-2027); ora ngemot tanggal/hasil news rekaan.

1. Compile script `EXPORT_C2_NEWS.mq5` lan lebokke neng MQL5/Scripts.
2. Jalanake script neng terminal online. Set FromUTC/ToUTC (ToUTC=0 tegese saiki), offset kalender SERVER SAAT EKSPOR sing bener, banjur `InpConfirmCalendarOffset=true`. Default exporter nggunakake offset server saiki otomatis. Kalender lan quote historis beda: kanggo backtest quote sing ngalami DST, tes saben rentang offset historis konstan. Script ora ngekspor masa depan sing durung dingerteni minangka kalender kosong.
3. Script nulis `MQL5/Files/CEBONK_C2_NEWS.csv` saka kalender nyata. File placeholder ing ZIP sengaja invalid: **aja nimpa hasil ekspor nyata karo placeholder**.
4. Lebokke Astrology CSV neng MQL5/Files, banjur pakai preset `BACKTEST_NEWS_ATTACK.set` utawa `BACKTEST_NORMAL_AND_NEWS.set`. Preset nyetel `InpAllowNewsCSVReplay=true` lan trading tester ON. Aja nganggo preset tester kanggo live tanpa review.

CSV minangka SNAPSHOT RETROSPEKTIF. Jadwal wis bisa direvisi sadurunge ekspor; iki dudu database historis 'sing wis dingerteni nalika kuwi'. Ora nganggo actual/forecast kanggo arah, nanging timestamp sing direvisi tetep dadi wates validitas backtest. Source timestamp, coverage lan jumlah baris wajib valid. Gagal/file kosong ora dianggep 'ora ana news'.

CSV format: metadata `CEBONK_NEWS_V1,coverage_from_epoch,coverage_to_epoch,exported_epoch,row_count`, banjur header `value_id,release_epoch,currency,importance,name`. Parser mung nampa USD/HIGH, epoch UTC valid, ID unik, lan jumlah baris sing pas. Rentang tes kudu ana ing coverage news + Astrology lan duwe historical broker candles cukup.

## Validasi lan source

Source builder pin SHA256 EA v1.00 lan C2Core. Modul news lan Telegram ditambah ing file standalone anyar. Fungsi normal Prepare, AstrologyMatches, Location, LoadBars lan price-core diuji byte-identical. Folder `ea/combined2/news_attack` mung tambahan; ora ngowahi file web/Combined 1.

Tes software: pure news policy dieksekusi sawise adaptasi sintaks array MQL menyang C++; 41 tes lan 3,200 pemeriksaan batas wektu per detik. Tes tambahan mriksa CSV, cap event, escaping Telegram, lan wiring sumber. Iki **dudu compile MetaEditor**, **dudu backtest MT5**, lan dudu bukti profit. Sambungan broker/Telegram nganggo credential nyata durung diuji ing lingkungan build iki. Ora ana file EX5 sing diklaim wis dikompilasi.

Rebuild ing repository: `python3 ea/combined2/news_attack/tools/build.py`, banjur `python3 ea/combined2/news_attack/tests/test_policy.py`. Builder mandheg yen base wis owah; ora diam-diam nggabungake versi liyane.

Referensi implementasi resmi:
- https://www.mql5.com/en/docs/calendar/calendarvaluehistory
- https://www.mql5.com/en/docs/constants/structures/mqlcalendar
- https://www.mql5.com/en/book/advanced/calendar/calendar_cache_tester
- https://www.mql5.com/en/docs/network/webrequest
- https://core.telegram.org/bots/api#sendmessage

## Pemeriksaan tambahan sebelum distribusi
Live CSV ditolak yen umur ekspor ngluwihi InpNewsMaxCacheSeconds; maca file maneh ora nggawe jadwal lawas dadi anyar. Mode live standar tetep kalender MT5. Timer jaringan nganggo jam server sing terus mlaku, ora gumantung ana tick; tes Telegram isih bisa dilayani nalika pasar tutup. Native MQL API/compiler lan akun Telegram nyata isih durung diuji. Kanggo backtest, simpen CSV asli ing MQL5/Files sadurunge compile/recompile EA supaya tester_file bisa nyalin menyang agen. Offset kalender saat ekspor nggunakake CURRENT server offset; offset quote tester yaiku offset HISTORIS broker sing kudu sampeyan verifikasi.
