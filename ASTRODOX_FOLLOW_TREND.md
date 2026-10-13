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

## Persentase kekuatan konfigurasi planet (v1.1)

Modul Follow Trend sekarang memiliki **dua metrik berbeda**, tidak boleh disamakan.

### A. Persentase bobot konfigurasi planet
Untuk setiap interval 5 menit, gunakan **kontribusi aspek asli** `sample.active[].impact`
dari `CebonkCore.analyse`. Kontribusi lokal ASC/MC `local=true` dikecualikan
sesuai skor arah V1; tidak ada koefisien baru untuk pasar.

- `BobotBUY = Σ max(impact,0)`
- `BobotSELL = Σ max(-impact,0)`
- `BUY% = 100 × BobotBUY / (BobotBUY + BobotSELL)`
- `SELL% = 100 × BobotSELL / (BobotBUY + BobotSELL)`
- `NET% = BUY% − SELL%`.

Persentase dihitung dari total bobot aspek aktif pada seluruh sampel hari itu,
**bukan** dari durasi keadaan BUY/SELL atau rasio profit. V1 sudah memakai
sifat/bobot planet, longitude untuk jarak sudut, jenis aspek, orb, dan
fase Applying/Exact/Separating. Nilai zodiak tampil sebagai **lokasi**
benda langit dan tidak diberikan koefisien baru. Bila bobot total 0 atau data
aspek tidak tersedia, hasil persentase **TIDAK TERSEDIA**, bukan 50% atau 100%
asumsi. Karena normalisasi bersifat relatif, satu kontribusi sangat kecil
dapat menghasilkan 100% — **bukan** berarti kuat secara absolut. Total bobot
dan jumlah slot yang berkontribusi harus dibaca bersama persentase.

### B. Persentase durasi Follow Trend (lama)
Perhitungan durasi dan algoritme konfirmasi lama tetap utuh di panel yang sama
dengan label **DOMINASI DURASI**. Persentase durasi hanya memakai total menit
BUY/SELL yang terkonfirmasi, bukan bobot planet. Dua angka itu mungkin berbeda
atau bahkan mempunyai arah dominasi berbeda.

### Audit planet, zodiak, degrees, longitude dan aspek
- Per-planet: masing-masing pasangan aspek membagi bobot absolut **50/50**
  ke dua planet yang berpartisipasi; digunakan sebagai atribusi pelaporan,
  bukan sebagai rumus skor baru.
- Per-zodiak: kontribusi planet tersebut dicatat menurut tanda zodiak dari
  longitude ketika aspek dihitung. Ini adalah pengelompokan distribusi bobot,
  **bukan** klaim bahwa suatu tanda zodiak secara otomatis bullish/bearish.
- Pasangan aspek: daftar nilai bobot terbesar berikut sudut nominal aspek,
  orb, fase, longitude kedua planet, dan derajat pada zodiaknya.
- Cakupan bobot dengan longitude lengkap ditampilkan; jangan menciptakan
  tanda zodiak jika posisi planet tidak tersedia.
- Per-slot tabel/CSV menampilkan bobot positif dan negatif, BUY% dan SELL%
  konfigurasi bersamaan dengan status Follow Trend.

**Interpretasi:** persentase konfigurasi adalah ukuran komposisi algoritma
ASTRODOX V1, bukan pengukuran kesuksesan ramalan atau probabilitas kenaikan
XAUUSD. Status trading website tetap WAIT. Belum ada bukti out-of-sample
bahwa bobot astrologi mengikuti tren harga emas.

Berkas: `assets/astrodox-planet-strength.js`, tambahan UI Follow Trend,
`tests/astrodox-planet-strength.test.cjs`, dan pengujian UI/regresi.
