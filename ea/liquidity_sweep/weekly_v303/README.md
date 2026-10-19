# CEBONK COMPANY 22 — Weekly Astrology + M5 Sweep/Reclaim v3.03

**Status:** implementasi source dan uji regresi matematis/statis. Belum compile MetaEditor, belum backtest MT5 real ticks atau live broker. **Jangan dipasang di akun real dulu.**

## Mesin entry
- Feed Astrology weekly V1 dari website menentukan **satu arah BUY atau SELL** dan jadwal **Mulai–Inti–Akhir**. Scanner tidak memilih arah sendiri.
- Scanner H1/H4 mencari level liquidity confirmed pivot dari candle yang sudah close; cukup salah satu scanner valid.
- M5 harus **sweep** level liquidity H1/H4 dengan wick menembus dari sisi yang tepat, kemudian **close reclaim** kembali ke sisi dalam level itu.
- Entry langsung pada tick awal setelah **candle M5 reclaim tutup**, jika candle tersebut dan order sekarang sama-sama berada di dalam window Astrology. **Tidak perlu IB, B, CB1 atau retest.**
- Sweep boleh mulai sebelum window, tetapi **reclaim harus close di dalam window**. Setup reclaim di luar window tidak dieksekusi belakangan.
- Retry 20 detik (dapat disetel) hanya untuk spread/quote sementara, tidak melewati candle M5 baru; status fill ambigu tidak diulang.
- Target evaluasi kesempatan entry mingguan, **bukan wajib entry setiap hari/tiap minggu**.

## SL/TP dan manajemen risiko
BUY SL = minimum(sweep low, Entry − 3×ATR14 M5). SELL SL = maksimum(sweep high, Entry + 3×ATR14 M5). SL diselaraskan ke tick size secara keluar tanpa buffer ekstra. TP RR 1:4 dari jarak SL final. Tanpa BE, trailing, partial atau pemindahan SL/TP layer lama. Maksimal 3 layer, spread maksimum 70 points, total risiko stop terbuka dibatasi preset 25 **mata uang akun**, bukan otomatis USD. Fixed Lot 0.01 default; Modified D'Alembert 0.01 → 0.02 → 0.03 opsional, berdasarkan hasil **net satu basket selesai**, dilindungi state persistence.

## Instalasi demo
1. Download `CEBONK_WEEKLY_SWEEP_RECLAIM_v3.03.mq5` (standalone) dan compile dalam MetaEditor; periksa error dan warning secara nyata.
2. Pasang di chart `XAUUSDc` pada akun **DEMO hedging**; gunakan `DEMO_NOZAX_UTC3_v3.03_FIXED.set` untuk uji awal. Default Autopilot OFF, DemoOnly ON, Fixed Lot default.
3. Daftarkan `https://raw.githubusercontent.com` pada MT5 Tools > Options > Expert Advisors > Allow WebRequest. Jika Telegram dipakai, aktifkan `https://api.telegram.org` dan isi token/chat id di MT5 (jangan commit token).
4. Periksa offset server UTC, spesifikasi lot, spread aktual, stops level, mata uang akun CENT, serta izin algo trading. UTC+3 hanya asumsi preset, perubahan DST perlu dicek.
5. Strategy Tester tidak memakai WebRequest: sediakan CSV history weekly model valid di MT5 tester `MQL5/Files`. Data seminggu tidak cukup untuk evaluasi 2024–2026.
6. Bandingkan v3.03 M5 reclaim vs v3.02 CB1 memakai data tick yang identik: jumlah setup, minggu 0 entry, profit, drawdown, BUY/SELL winrate dan slippage.

## Status pengujian
Uji unit C++ lokal: strategi 10.069, execution core 50, D'Alembert 10.019 pemeriksaan lulus; Python statis/fixture 12 tes lulus. Uji tersebut **tidak membuktikan compile MetaEditor atau profitabilitas live**. GitHub branch/PR tidak otomatis memasang kode di terminal MT5.
