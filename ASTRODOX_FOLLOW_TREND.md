# ASTRODOX FOLLOW TREND v1.0 — Modul Astrologi Murni (Terpisah)

## Status
Implementasi riset, **bukan** sistem prediksi harga XAUUSD yang tervalidasi.
Keputusan trading website: **WAIT**, tidak mengirim perintah broker/EA/Telegram.

## Pemisahan dari mesin lama
- Mesin asli ASTROLOGY V1 tetap ada dan **tidak diubah** (`index.html` inline `CebonkCore`).
- Mesin baru menerima **hanya** output `CebonkCore.scan(engine, date, 360, true)`.
- Tidak memakai `CebonkAlBiruni`, metode astrologi historis lainnya, data harga,
  indikator teknikal, broker API, atau feed trading.
- Panel sendiri: `#astrodox-follow-trend`; `#astrology` tetap lama.
- Pilihan konfirmasi: **15 / 30 / 45 menit**, berarti 3 / 6 / 9 bar yang masing-masing 5 menit.
- Grace netral: **15 menit** (3 slot), tetap.
- Rentang scan: **06:00–24:00 WIB**, sesuai rentang baseline ASTROLOGY lama.

## Rumus
1. Klasifikasi dari **skor V1 yang tidak diubah**: BUY bila `score ≥ 1.15`,
   SELL bila `score ≤ -1.15`, lainnya WAIT.
2. Setelah `confirmBars` skor searah **berturut-turut**, status follow trend
   dapat menjadi BUY atau SELL pada **slot konfirmasi**, tidak dibalik ke slot awal.
3. Satu atau dua skor lawan saat konfirmasi tiga bar menghasilkan **WAIT**,
   bukan reversal otomatis. Setelah `confirmBars` lawan beruntun, arah baru
   terkonfirmasi.
4. Pada skor netral/transition, status **WAIT**. Netral selama tiga slot
   me-reset arah lama, sehingga pemulihan arah butuh konfirmasi lagi.
5. Segmen status terkonfirmasi mengeluarkan **AWAL** (slot konfirmasi),
   **INTI** (waktu skor absolut terbesar di segmen setelah seluruh
   segmen dihitung), **AKHIR** (batas akhir segmen, eksklusif).
6. Fokus tanggal = arah yang memegang setidaknya **55%** dari seluruh menit
   *directional* terkonfirmasi. Jika durasi seri seimbang atau data tidak
   tersedia, fokus WAIT. **Bukan** confidence, winrate atau peluang profit.

## Larangan look-ahead dan interpretasi waktu
- Status pada slot ke-`i` hanya bergantung pada skor sampai slot ke-`i`.
- Menampilkan INTI, AKHIR, dan **dominasi satu tanggal penuh** memerlukan
  seluruh hasil kalkulasi hari tersebut. Kalender astronomi memungkinkan
  simulasi masa depan, tetapi tidak membuat hasil itu teruji terhadap XAUUSD.
- Tidak ada harga pasar, spread, biaya, atau backtest out-of-sample
  2024–2026 di modul ini. Jangan gunakan label BUY/SELL untuk order live.

## Berkas
- `assets/astrodox-follow-trend-core.js` — state machine murni (tidak ada DOM).
- `assets/astrodox-follow-trend-ui.js` — date, confirm, tiga waktu, table,
  ekspor CSV penelitian (semua baris ditandai keputusan trading WAIT).
- `assets/astrodox-follow-trend.css` — gaya mandiri responsif.
- `assets/site-tab-router.js` — rute `#astrodox-follow-trend`.
- `tests/astrodox-follow-trend.test.cjs` — non-lookahead, konfirmasi,
  pemulihan neutral, gap, status wait.
- `tests/astrodox-follow-trend-ui.test.cjs` — isolasi global dan alur UI.

## Validasi sebelum penggunaan finansial
1. Simpan dataset skor astrologi yang tidak berubah dan data harga XAUUSDc
   timestamp-tercocok, termasuk spread NOZAX, biaya, serta broker DST.
2. Backtest walk-forward 2024–2026 terpisah per sisi BUY/SELL, tahun dan bulan.
3. Lakukan perbandingan dengan ASTRODOX V1 lama dan baseline acak/sederhana.
4. Jangan mengaktifkan order kecuali sudah ada validasi out-of-sample yang
   meyakinkan dan kontrol risiko/eksekusi tersendiri.
