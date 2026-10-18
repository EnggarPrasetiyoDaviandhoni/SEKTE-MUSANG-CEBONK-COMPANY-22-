# Bukti dan batas verifikasi

| Pemeriksaan | Status |
|---|---|
| Node JSON/schema, checksum, calendar, expiry, session/DST, negative cases | PASS, 25 kasus |
| Numeric engine `.mqh` yang sama, C++ host + Address/UndefinedBehavior Sanitizer | PASS, 87 assertion |
| Parser JSON dan validator feed `.mqh` yang sama, adapter API C++ host | PASS, 34 assertion |
| Browser UMD asli vs Node, Astronomy Engine 2.1.19, 20 tanggal / 4 minggu | PASS; selisih maksimum 0, toleransi 1e-9 |
| MetaEditor / MQL5 Standard Library compile | **NOT COMPILED** — MetaEditor tidak tersedia di lingkungan Linux ini |
| Script self-test pada runtime MT5 | **NOT RUN** |
| Strategy Tester real ticks / in-sample / out-of-sample | **NOT RUN** |
| Broker demo/live, hedging/netting, partial fill, commission reconciliation | **NOT RUN** |

Tes numeric mencakup BUY/SELL, level SL default −0.236 dan level pilihan −0.382/−0.618/−1.0, rasio dan tick rounding stop, input nol/positif/nonfinite, overflow, harga stop nonpositif, stop di dalam IB, anchor salah, close break vs wick, retest wajib, expiry dan replay, alternatif S/R, pivot tanpa lookahead, H4 trend, H1 continuation, NET exit >0 dan risk cap. Detektor M5 diuji dengan level kustom pada pola dominan BUY/SELL dan alternatif S/R; contoh stop lebih lebar menurunkan RR hingga di bawah 2. Test parser/feed mengeksekusi control flow header produksi: duplicate key, Unicode surrogate, JSON number invalid, kedalaman, hash, model lama, timezone drift, kalender, expiry dan alignment. Adapter menerjemahkan deklarasi dynamic-array dan menyediakan API string/time/SHA host; ini bukan compiler MQL5 dan tidak menguji API order terminal.

Parity memakai file mesin website yang tidak diubah, dengan build browser UMD dan build Node library astronomi yang dipin. Tanggal 2026-03-02..06, 03-09..13, 03-30..04-03, 04-06..10 mencakup kondisi sebelum/sesudah DST US, UK dan Australia. Ini VM parity API, bukan browser UI automation. Rincian di `evidence/parity.json`.

Jalankan dari repo:

```bash
npm ci --prefix ea/astro_swing_berjanggut --ignore-scripts
node tests/swing/feed.test.mjs
python scripts/test-swing-core.py
node scripts/test-swing-parity.mjs
python scripts/check-swing-source.py
```

`scripts/compile-swing.ps1` dan `MQL5/Scripts/CEBONK_SWING_SELFTEST.mq5` disediakan untuk tahap verifikasi MT5. Belum ada win rate, profit factor atau drawdown trading yang dihasilkan; angka performa tidak diisi dari tes sintetis.
