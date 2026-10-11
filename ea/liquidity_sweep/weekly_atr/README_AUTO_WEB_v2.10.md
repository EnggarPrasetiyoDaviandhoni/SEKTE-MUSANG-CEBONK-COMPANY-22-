# CEBONK LIQUIDITY SWEEP + ASTROLOGY MINGGUAN — v2.10 AUTO WEB

Ini **file EA baru**; v2.00 dan v1.03 tidak ditimpa. Astrology mingguan menggunakan mesin riset asli di website: core JavaScript yang sama dari index.html dan agregator assets/astro-weekly-core.js. Arahnya tetap **eksperimental dan belum dibuktikan profit**.

## Live/demo tanpa CSV manual
- GitHub Actions (workflow astro-weekly-publish.yml) otomatis menjalankan perhitungan Astrology Senin–Jumat, pakai Astronomy Engine 2.1.19. Dijadwalkan Minggu 21:17 WIB dan retry setiap hari 03:17 WIB, serta setelah perubahan kode/perintah manual. Jadwal GitHub Actions dapat terlambat/gagal; bukan layanan real-time dengan SLA.
- Hasil sebenarnya diterbitkan sebagai file public raw di:
  https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/liquidity_sweep/weekly_atr/data/weekly.csv
- Data untuk audit: path sama dengan nama weekly.json, memuat model, periode, arah, jumlah slot, dan kandidat (tanpa harga pasar).
- MT5 EA v2.10 dengan default InpAutoAstroWeb=true menggunakan WebRequest GET setiap 300 detik, juga saat init. TIDAK perlu menekan Hitung Mingguan ataupun Ekspor CSV dari website.
- **MT5 → Tools → Options → Expert Advisors → Allow WebRequest**:
  https://raw.githubusercontent.com
  https://api.telegram.org (hanya jika Telegram diaktifkan)
- Data tidak tersedia, status HTTP bukan 200, format salah, model tidak cocok, minggu tidak cocok, window lewat, atau Astrology campuran/tidak ada kandidat => **TIDAK ENTRY**. Data tidak ditebak; setiap refresh menimpa state lama secara fail-closed.
- Jika update GitHub gagal, jam Jumat tetap akan menjalankan close posisi milik magic EA; tidak memerlukan WebRequest/CSV.
- Tidak ada URL website GitHub Pages yang wajib di whitelist untuk versi ini. Raw GitHub dipakai agar pembaruan file otomatis tidak tergantung rebuild Pages.

## Entry dan risiko
- Arah BUY/SELL hanya dari dominasi mingguan. ENTRY hanya selama MULAI sampai sebelum AKHIR; INTI sekadar puncak skor sebagai referensi.
- M5 sweep high/low 10 candle sebelumnya + close-back, tanpa BOS/CHOCH/FVG wajib.
- **SL 3× ATR(14) M5, TP RR 1:4** (nominal 12× ATR). Fixed lot 0.01; max spread 70 points. Tanpa BEP/trailing/partial.
- Friday Auto Close aktif untuk posisi dengan magic EA saja: 5 menit sebelum market Jumat tutup berdasarkan informasi sesi simbol broker, dengan fallback waktu server. Broker/platform mungkin gagal mengeksekusi close.
- AUTOPILOT default OFF, live account locked (InpAllowRealAccount=false). Tombol ON/OFF di chart. Telegram & Push tetap tersedia, isi token pribadi hanya di terminal.

## Cara pasang
1. Unduh **dist/CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.10.txt** (satu file) lalu rename menjadi CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.10.mq5 dalam folder MQL5/Experts.
2. Compile di MetaEditor. Alternatif file modular CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.10.mq5 membutuhkan LSNotify.mqh pada folder sama.
3. Pasang di chart XAUUSDc; cek Experts/Journal bahwa Astrology feed terbaca. Jika WebRequest menampilkan error 4014, periksa URL allowlist.
4. Gunakan preset LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.10.set dan uji demo terlebih dulu. Pada akun real harus mengubah InpAllowRealAccount=true secara eksplisit.
5. Telegram: masukkan token/chat ID input EA; aktifkan WebRequest api.telegram.org.

## Backtest / Strategy Tester
MT5 **melarang WebRequest dalam Strategy Tester**, sehingga v2.10 beralih ke InpWeeklyCSV sebagai sumber **khusus tester**. Backtest 2024–2026 membutuhkan data historis mingguan yang mencakup semua minggu: satu CSV hasil web tidak cukup. Generator ini menerbitkan hanya satu minggu berjalan/berikutnya, bukan data historis otomatis. Tidak ada klaim backtest, kompilasi MetaEditor, ataupun profitabilitas.

## Audit
Static CI dan test Node memeriksa paritas format dan sumber Astro dari website, serta integritas sinyal mingguan. Uji runtime broker NOZAX dan compile MetaEditor tetap dibutuhkan. Pada kegagalan feed, trade baru berhenti, posisi terbuka tetap menggunakan stop broker/TP serta Friday Auto Close.
