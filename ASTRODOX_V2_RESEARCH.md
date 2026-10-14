# ASTRODOX V2 — Riset Arah Astrologi dan Timing ASC/MC

**Status:** hipotesis riset, **BELUM VALID** untuk XAUUSD. Tidak terhubung
ke broker, order, EA, Telegram, indikator teknikal atau AL-BIRUNI.
Tidak ada perubahan rumus pada `CebonkCore` V1, mesin Follow Trend V1,
atau `astrodox-planet-strength.js`.

## Pemisahan dan publikasi
Semua pekerjaan V2 berada pada branch `feature/astrodox-v2-astro-timing`
untuk diuji sebelum di-merge. Repo `main` dan GitHub Pages yang
dideploy dari `main` tidak diubah.

V2 dipasang di tab `#astrodox-v2` pada halaman branch; V1 masih pada
`#astrodox-follow-trend`. Perhitungan V1 dan V2 memakai *scan astronomi
yang sama* untuk pembandingan. V2 tidak menggunakan `sample.score` atau
`sample.active[].impact` yang mengandung label arah V1.

## Rumus V2 (semua angka = hipotesis)
- **Arah astrologi, tanpa harga:** ambil aspek antarplanet aktif.
  Untuk tiap kontak, bobot = bobot aspek × rerata bobot planet ×
  kedekatan-orb × fase (EXACT 1,25; APPLYING 1,10; SEPARATING 0,90).
  Nilai arah kontak = rerata `nature` dua planet dari konfigurasi V1.
  Skor arah = jumlah terbobot `nature` dibagi 1,5 × jumlah bobot,
  dipotong ke [−1, 1]. Positif ≥0,20 berarti BUY astrologi;
  negatif ≤−0,20 berarti SELL astrologi; lainnya WAIT.
  **Pemetaan sifat astrologi → harga adalah hipotesis, bukan hukum historis.**
- **Kekuatan kontak:** semua aspek, termasuk Square 90° dan Opposition 180°,
  memberi angka kedekatan non-negatif, bukan tanda arah. ASC/MC hanya
  menentukan waktu, **tidak pernah menentukan BUY/SELL**.
- **Intensitas timing:** gabungan skor kedekatan ASC/MC dan antarplanet
  dinormalisasi 0–100. Porsi ASC/MC default 50%, tersedia sensitivitas
  30%/70%. Tidak ada klaim bobot optimal.
- **Pemicu momen:** setelah arah stabil selama 3/6/9 slot beruntun,
  hanya tampil BUY/SELL bila kekuatan ASC/MC ≥30 dan intensitas total
  ≥50. Jika tidak: WAIT. Jeda arah netral 3 slot mereset arah stabil.
  Angka 30/50 belum dipilih lewat backtest.
- **AWAL:** slot setelah konfirmasi arah dan lolos kekuatan momen.
  **INTI:** intensitas tertinggi dalam satu jendela (bisa diketahui
  setelah kalender astronomi untuk seluruh hari dihitung).
  **AKHIR:** batas eksklusif jendela aktif. Tidak otomatis berarti exit.
- Semua waktu tabel dan CSV = WIB (UTC+7), slot = 5 menit.
  Koordinat ASC/MC memakai Luxor yang sudah ada pada V1.

## Perbandingan V1 dan V2
Tampilan menunjukkan dominasi V1 dan V2 pada tanggal sama, tanpa
menganggap salah satunya benar untuk XAUUSD. Ekspor CSV dengan
`timestamp_wib,v1_state,v2_state,...` tersedia; ini **bukan**
hasil validasi harga.

### Evaluasi terhadap data XAUUSD M5
Tidak ada dataset XAUUSD M5 lengkap 2024–2026 dengan timestamp + OHLC
yang terverifikasi pada repo saat pembuatan modul. Karena itu tidak
ada angka akurasi yang bisa dilaporkan secara benar saat ini.

Setelah memperoleh data harga sebenarnya (NOZAX XAUUSDc atau sumber
terverifikasi), siapkan CSV harga dengan kolom:
`timestamp,open,close`. Timestamp harga **wajib ISO 8601 dengan
offset zona waktu eksplisit** seperti `2026-10-14T09:00:00+03:00`
atau `2026-10-14T06:00:00Z`; artinya timestamp pembukaan candle M5.

1. Ekspor CSV per tanggal V2 dari panel situs.
2. Jalankan `node scripts/evaluate-astrodox-v2.mjs prediksi.csv harga_m5.csv`.
3. Laporan menghitung kecocokan arah perubahan harga pada horizon
   5/15/60 menit, dipisah BUY/SELL, tahun 2024/2025/2026, dan total.
   Sampel tak cocok timestamp di-skip, tidak diisi data asumsi.

Laporan bukan hasil transaksi: tidak menghitung spread, slippage,
komisi, SL/TP, MFE/MAE, expectancy, RR 1:2, equity curve, atau profit.
Validasi sebenarnya memerlukan pengujian *walk-forward* dan
out-of-sample, serta pembandingan baseline harga sederhana dan acak.
Jangan merilis label sebagai rekomendasi entry sebelum lolos pengujian.

## Tes
`node tests/astrodox-v2.test.cjs` memeriksa bahwa:
- Square dari dua planet dengan nature positif tidak otomatis SELL.
- Trine dari dua planet negatif tidak otomatis BUY.
- ASC/MC mengatur timing tanpa mengubah arah planet.
- Tanpa aspek atau tanpa konfirmasi, WAIT.
- Hasil slot masa lalu tidak bergantung pada slot masa depan.
- Model V1 dan modul AL-BIRUNI tidak dimodifikasi.

Workflow `.github/workflows/astrodox-v2.yml` juga menjalankan tes
core V1/planet-strength untuk regresi. Merge hanya setelah review
dan uji harga yang memadai.
