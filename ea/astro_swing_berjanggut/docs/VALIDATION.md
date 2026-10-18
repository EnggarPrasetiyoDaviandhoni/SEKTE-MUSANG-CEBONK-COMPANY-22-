# Bukti dan batas verifikasi v1.10

| Pemeriksaan | Status |
|---|---|
| Feed/schema/hash/calendar/DST/expiry/negative cases | PASS, 31 kasus |
| Resolver tujuh hari, weekends, tie, threshold/minimum minutes | PASS, 3 kasus |
| Numeric/policy production headers, C++ Address/UndefinedBehavior Sanitizer | PASS, 126 assertions |
| Parser JSON dan feed production headers, adapter C++ | PASS, 38 assertions |
| Body NET basket produksi verbatim, history/position API adapter C++ | PASS, 10 assertions |
| Formatter/outbox/persistence produksi, adapter terminal/transport C++ | PASS, 58 assertions; tanpa kirim pesan nyata |
| Browser UMD vs Node, Astronomy Engine 2.1.19 | PASS, 20 tanggal trading + 28 tanggal full-day strength; selisih maksimum 0 |
| Struktur 16 file MQL | PASS; bukan kompilasi |
| MetaEditor / Standard Library | **NOT_COMPILED** — compiler tidak tersedia |
| Self-test MT5, Strategy Tester real ticks/in/out sample | **NOT_RUN** |
| Broker demo/live, fill, partial fill, actual commission reconciliation | **NOT_RUN** |

EL2 diuji simetris BUY/SELL: IB terpisah, pivot CB1 sesudah IB, close break bukan wick, retest/rejection wajib, SL default/kustom dan rounding tick, expiry/replay, invalidasi zona, CB1 belum confirmed, stop di dalam IB, RR dan risk cap. Weekly policy diuji tidak berubah di minggu yang sama, dipulihkan/copy state lalu tetap terkunci, hanya minggu baru diterima, replay ditolak, WAIT tidak dibalik menjadi BUY, dan daily/session kontra WAIT. Reservasi layer diuji ditolak→kembali, maksimal 2+2, dan unknown retcodes tidak dianggap penolakan.

Uji NET mengambil body fungsi `CSBasket::Net` dari header produksi tanpa menulis ulang algoritmenya, lalu memberi respons history/position terkendali: layer closed rugi −100 dan floating +20, partial close ID yang masih aktif, komisi/swap/biaya keluar, ownership conflict, missing history, biaya tidak diketahui, dan laporan final tanpa double estimated costs. Adapter bukan terminal atau broker. Runtime file I/O, server stops, transaksi broker, recovery crash dan partial fills masih membutuhkan MT5/demo.

Parity memakai file source website tanpa perubahan dengan library astronomi browser UMD dan Node yang dipin. Empat minggu DST US/UK/Australia: 2026-03-02, 03-09, 03-30, 04-06. Meliputi source weekly/daily, lima sesi, focus/windows/timestamps/scores, lunar, dan tujuh subtotal harian beserta resolver. VM parity API, bukan UI automation.

Feed tester bawaan hanya fixture. Backfill astronomi bukan data harga atau arsip publikasi historis autentik. Bukti publikasi raw HTTP dan jadwal aktif dicatat dalam `evidence/validation.json`; jangan menganggap publikasi sekali sebagai publisher harian aktif.

Jalankan dari repo:

```bash
npm ci --prefix ea/astro_swing_berjanggut --ignore-scripts
node tests/swing/feed.test.mjs
node tests/swing/weekly-lock.test.mjs
python3 scripts/test-swing-core.py
node scripts/test-swing-parity.mjs
python3 scripts/check-swing-source.py
```

Compile memakai F7 atau `scripts/compile-swing.ps1`, lalu jalankan `CEBONK_SWING_SELFTEST` dalam MT5, real-tick tester dan forward demo. Tidak ada win rate/profit factor/drawdown broker yang dibuktikan oleh tes sintetis ini.
