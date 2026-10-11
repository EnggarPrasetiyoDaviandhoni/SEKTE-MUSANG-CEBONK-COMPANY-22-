# CEBONK LIQUIDITY SWEEP + ASTROLOGY MINGGUAN (v2.00)

VERSI BARU TERPISAH. EA lama v1.03 tidak diubah. Ini *desain eksperimen*; arah Astrology belum divalidasi terhadap hasil harga XAUUSDc. Tidak ada klaim winrate atau profit.

## Strategi

1. Di situs, tab ASTROLOGY -> ASTROLOGY MINGGUAN -> pilih minggu Senin–Jumat -> **Hitung Mingguan** -> **Ekspor EA CSV**. File ekspor adalah CE﻿BONK_ASTRO_WEEKLY.csv (tanpa karakter tersembunyi; ejaan sebenarnya CEBONK_ASTRO_WEEKLY.csv).
2. EA hanya menerima CSV model ASTRO_WEEKLY_V1 dengan dominasi mingguan BUY atau SELL dan hingga lima window kandidat yang searah (MULAI, INTI, AKHIR) dari hasil scanner. INTI ditampilkan sebagai puncak skor, bukan pemicu order tersendiri; entry boleh setelah MULAI sampai sebelum AKHIR.
3. Harga M5 terakhir harus sweep swing high/low dari 10 candle M5 sebelumnya dan CLOSE kembali melewati level likuiditas. BUY jika sweep low/reclaim; SELL jika sweep high/reject. Satu candle closed, tanpa BOS/CHOCH/FVG, retest, atau tiga TF. Jika sweep dua sisi sekaligus, skip.
4. Arah sweep wajib sama dengan arah Astrology CSV. Di luar waktu window, Sabtu/Minggu, CSV kosong/salah/stale -> tidak entry.
5. Stop loss di harga entry aktual +/- 3 x ATR(14) M5. Target = 4 x jarak entry-SL aktual (default ~12 ATR, dibulatkan ke tick). Tanpa BE, trailing, atau partial. Spread maksimal 70 points, fixed lot default 0.01.
6. Jumat, posisi milik EA dengan simbol+magic ini ditutup mulai 5 menit sebelum akhir sesi Jumat menurut broker (jika data sesi tak ada, fallback 23:55 server - 5 menit). Close exit tidak bergantung AUTOPILOT/CSV. Jika broker sudah menutup sesi, penutupan tidak dijamin.
7. Autopilot default OFF dan live account LOCKED secara default. Untuk demo/backtest aktifkan AUTOPILOT. Live butuh AllowRealAccount=true secara sadar. Risiko per posisi bergantung lot dan ATR, tidak otomatis dikunci persentase modal.

## Instalasi MT5

- Cara modular: tempatkan CEBONK_LIQUIDITY_SWEEP_WEEKLY_ATR_v2.00.mq5 dan LSNotify.mqh pada folder MQL5/Experts/CEBONK_WEEKLY_ATR/ lalu compile file MQ5 menggunakan MetaEditor.
- Cara satu file dari telepon: simpan dist/CEBONK_LIQUIDITY_SWEEP_WEEKLY_ATR_v2.00.txt sebagai CEBONK_LIQUIDITY_SWEEP_WEEKLY_ATR_v2.00.mq5; ini sudah menyertakan LSNotify. Jangan sertakan .mqh pada build single-file.
- Simpan CSV hasil ekspor web ke folder data MT5 yang dibaca FileOpen, biasanya MQL5/Files (untuk Tester, salin ke folder Files test agent atau gunakan mekanisme tester_file). Ekspor minggu baru setiap minggu. Web tidak otomatis mengirim data ke EA.
- Pasang EA pada chart XAUUSDc. Izinkan Algo Trading; atur Telegram token/chat ID hanya pada input terminal, jangan pernah commit token ke GitHub. WebRequest perlu allow https://api.telegram.org.
- Input preset: LIQUIDITY_SWEEP_WEEKLY_ATR_v2.00.set.
- Waktu ASTRO dalam CSV adalah Unix epoch UTC; UI menunjukkan WIB. Jadwal sesi penutupan menggunakan jam server broker.

## Audit batasan

- Ini tidak mengimplementasikan astronomi di MT5. Harus diekspor manual dari scanner web Senin–Jumat; **tidak** menggunakan file ASTRO bulanan model lain.
- CSV 1 minggu: backtest tahun 2024–2026 perlu dataset CSV seluruh minggu, tidak cukup satu file.
- Belum dikompilasi dalam MetaEditor atau dibacktest dengan data NOZAX; uji dengan akun demo dan MT5 Strategy Tester terlebih dahulu.
- Berisiko terkena slippage, stop rejection, weekend gap, false sweeps dan strategi astrologi belum terbukti secara empiris.
- Akun netting dan simbol yang juga diperdagangkan manual/EA lain tidak disarankan. Guard mencegah entry baru jika netting sudah ada posisi asing di simbol; pada akun hedging posisi difilter menurut magic dan simbol.
- Jumat auto-close menggunakan sesi resmi simbol bila tersedia; jadwal libur/penutupan mendadak mungkin berbeda, dan close perlu kuotasi serta koneksi.
- File CSV lokal dapat diedit. Pemeriksaan memvalidasi struktur dan konsistensi jadwal, bukan tanda tangan kriptografis.
