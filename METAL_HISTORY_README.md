# Analisis Tren Riwayat Emas & Perak — CEBONK COMPANY 22

Modul berada di tab **BaZi Astrology** pada `index.html`, setelah tabel 12 Shio. Tampilan dan ekspor data BaZi menggunakan bahasa Indonesia tanpa aksara Cina; `assets/bazi-core.js` tetap menyimpan simbol asli **secara internal** untuk ketelitian kalender, tidak untuk tampilan.

## Data pasar

- Dataset: [World Bank Commodity Markets, Pink Sheet](https://www.worldbank.org/en/research/commodity-markets), data **rata-rata bulanan** dalam USD/troy ounce sejak 1960.
- `XAUUSD`: seri GOLD World Bank. `XAGUSD`: seri SILVER World Bank. Ini proksi benchmark, **bukan** harga broker, tick, candle OHLC, spread, atau quote live.
- Arsip: `data/market-history.json`, dibuat hanya dari workbook resmi oleh `tools/build-metals-history.py`. Harus ada >=200 bulan dan harga positif; generator gagal tertutup jika sumber tidak valid.
- GitHub Actions `.github/workflows/metal-history.yml` memperbarui arsip tiap Rabu atau pada perubahan modul. Situs membaca arsip branch `main` melalui GitHub Raw, dengan fallback pada file GitHub Pages lokal; sumber dan bulan terakhir ditampilkan.
- Sumber dan lisensi: World Bank, CC BY 4.0. Nilai historis dapat direvisi oleh penerbit.

## Perhitungan yang dilakukan

`assets/market-trend-core.js` memeriksa tanggal/angka, tidak mengisi bulan kosong, lalu menghitung:

1. Rata-rata harga 3 dan 12 bulan terakhir; perubahan harga terhadap bulan yang tepat berjarak 3, 6, dan 12 bulan.
2. **NAIK** bila rata-rata 3 bulan > rata-rata 12 bulan **dan** perubahan 3 bulan positif.
3. **TURUN** bila rata-rata 3 bulan < rata-rata 12 bulan **dan** perubahan 3 bulan negatif.
4. Kondisi lain = **CAMPURAN**. Hasil bukan prediksi, skor probabilitas, confidence, atau rekomendasi entry.
5. Drawdown dari puncak serentang maksimum 60 bulan dan grafik 72 bulan.
6. Tahun Kuda Api 1966 dan 2026: pergerakan rata-rata bulan pertama ke terakhir yang tersedia dalam tahun kalender. Tahun parsial ditandai; metrik ini **bukan return perdagangan 1 Januari–31 Desember** dan **bukan** bukti astrologi memengaruhi harga.

Periode tahun BaZi mengikuti pergantian kalender surya sekitar awal Februari, sehingga rata-rata bulanan Januari/Februari tidak dipaksa menjadi sinyal BaZi harian atau jam. Asosiasi astrologi perlu diuji terpisah dengan sampel cukup, biaya transaksi dan out-of-sample.

## Impor CSV

Pilih simbol (XAUUSD atau XAGUSD), kemudian pilih CSV dan klik **Analisis CSV**. Kolom yang diterima: `date`/`tanggal` dan `close`/`value`/`price`/`harga`; tanggal ISO `YYYY-MM-DD`, desimal titik; pemisah koma, titik koma, atau tab.

- Berkas CSV harian dikonversi ke **rata-rata penutupan bulanan**, yang tidak identik dengan benchmark World Bank.
- Impor hanya menggantikan **satu** simbol, selama halaman terbuka. Data tidak diunggah ke server atau disimpan.
- CSV tidak menambah data bulan kosong otomatis. Minimal 13 bulan dan 12 bulan terkini harus berurutan agar label tren muncul.
- Hasil bukan live trade, tidak ada perintah otomatis ke MT5.

## Uji regresi

```sh
node --check assets/market-trend-core.js
node --check assets/market-trend-ui.js
node tests/market-trend.test.cjs
```

Uji BaZi yang lama tetap digunakan: `tests/bazi-core.test.cjs` dengan `lunar-javascript@1.7.7`.

Scanner BBMA serta Liquidity Sweep untuk website tetap dihapus. Modul Astrology, Astrology News, Astro Candles, Daily Brief dan source EA tidak diubah.

## Dominasi Bullish/Bearish 1 Tahun menurut pengelompokan BaZi

Modul `assets/bazi-annual-core.js` dan `assets/bazi-annual-ui.js` membuat ringkasan tahunan untuk **dua instrumen sekaligus**. Pilihan tahun 2026–2036. Semua label memakai Bahasa Indonesia, tanpa aksara Cina pada antarmuka.

- Outcome satu tahun dihitung sebagai perubahan benchmark rata-rata **Februari tahun BaZi ke Februari tahun berikutnya**, 12 selisih bulanan. Ini hanya proksi kasar batas Li Chun karena harga sumber tidak harian.
- Sampel dari 1960 sampai setahun sebelum tahun yang dipilih. Tahun parsial atau data yang kehilangan salah satu bulan tidak dihitung sebagai return satu tahun. Sampel tahun target tidak pernah masuk basis pembandingan (anti-leakage).
- **Elemen sama** (minimal 8 observasi) dan **shio sama** (minimal 4) dihitung masing-masing. Bila setidaknya 65% tahun sebelumnya naik, label kelompok BULLISH; bila setidaknya 65% turun, label BEARISH; selain itu CAMPURAN.
- **Gabungan dominan tahunan** baru ditampilkan jika kedua kelompok sepakat pada arah yang sama **dan** kombinasi elemen+shio yang persis memiliki minimal 3 siklus lengkap. Jika syarat tidak dipenuhi, status **TIDAK KONKLUSIF**. Threshold ini sekadar aturan riset eksploratif, belum tervalidasi secara out-of-sample untuk prediksi harga.
- Siklus Kuda Api 2026 mempunyai satu tahun analog lengkap di arsip, yaitu 1966. Jadi tidak ada dasar menghitung probabilitas harga pasti tahun 2026 dari siklus persisnya. Pergerakan riil Februari–bulan terbaru ditampilkan terpisah sebagai hasil sementara.
- Tidak menghasilkan order, saran entry, jaminan tren, atau proyeksi angka harga masa depan.

Pengujian: `node tests/bazi-annual.test.cjs`. Workflow `.github/workflows/metal-history.yml` menjalankan regresi ini pada perubahan source terkait.

## Grafik riwayat 12M berdasarkan referensi TradingView

Screenshot TradingView pengguna dipakai sebagai **referensi bentuk analisis tahunan**, bukan sumber harga numerik, bukan data feed, dan bukan aset yang disalin ke dalam repo. Timeframe 12M pada TradingView lazimnya merepresentasikan satu **candle OHLC 12 bulan**, sedangkan World Bank Pink Sheet hanya menyediakan **rata-rata harga setiap bulan**. Tidak boleh mengubah angka rata-rata bulanan menjadi OHLC tahunan palsu.

- Modul terpisah `assets/metal-12m-core.js` dan `assets/metal-12m-ui.js` mengelompokkan 12 rata-rata bulanan berdasarkan **tahun kalender**. Tiap batang menunjukkan **rata-rata harga bulanan dalam tahun itu**, bukan candle atau penutupan akhir tahun.
- Harga perak dan emas dapat dipilih, grafik mulai 1960/1980/2000/2010/2020, pilihan linear/logaritmik (harga positif), tahun pemeriksaan, rentang bulan teramati, dan penjelasan shio/elemen **sebagai label tahun kalender**, bukan pergantian harian BaZi.
- Untuk 12 bulan lengkap, klasifikasi NAIK/TURUN membandingkan **rata-rata harga tahun berjalan** dengan rata-rata 12 bulan tahun sebelumnya. Untuk tahun belum lengkap, arah diberi label **BELUM LENGKAP**; perbandingan sementara hanya memakai bulan-bulan kalender yang sama pada tahun sebelumnya.
- Grafik tidak mengisi bulan hilang dan tidak mengeluarkan HIGH/LOW yang direkayasa. Analisis perbedaan 60 tahun contoh 1966/2026 ditampilkan jika tersedia, tanpa probabilitas/prediksi.
- Update otomatis tetap menggunakan `.github/workflows/metal-history.yml` dari sumber World Bank setiap Rabu; situs memuat data ketika halaman dibuka, bukan harga live. Uji `node tests/metal-12m.test.cjs` dijalankan bersama regresi sumber pasar.
- Screenshot 12M dapat menunjukkan periode lonjakan/penurunan secara visual, tetapi tidak boleh digunakan untuk merekonstruksi angka candle atau menarik kesimpulan bahwa kalender BaZi menyebabkan perubahan harga.


## Fundamental emas dan perak dalam pembandingan siklus BaZi 60 tahun

Tab BaZi kini memiliki tombol **FUNDAMENTAL 60 TAHUN** di bagian atas. Panel mandiri berada setelah grafik 12M dan sebelum dominasi tahunan. Pilih XAUUSD/XAGUSD dan tahun 1960–2050. Tahun 2026 diperbandingkan dengan 1966; bila perbandingan 60 tahun jatuh sebelum data 1960, UI menampilkan tidak tersedia.

- **Harga yang berubah otomatis:** arsip World Bank Pink Sheet `data/market-history.json`; rerata bulan pada tahun yang dipilih dibanding rata-rata bulan yang sama tahun sebelumnya. Untuk 12 bulan penuh muncul "TAHUN PENUH"; periode parsial bertanda "BELUM LENGKAP" dan memakai pembandingan *bulan sepadan* agar tidak menyesatkan.
- **Kronologi fundamental dengan sumber dokumenter:** `assets/fundamental-60y-core.js`. Peristiwa tahun terkait dan satu tahun sebelum/sesudah ditampilkan untuk menghindari tertukarnya periode tahun kalender, awal tahun BaZi (sekitar Februari), dan waktu kejadian aktual.
- **Faktor yang bisa dijelaskan:** patokan harga emas/perak pemerintah 1966, pelepasan kebijakan perak 1967, penutupan konvertibilitas emas 1971, pengetatan Volcker dan spekulasi/pembatasan kontrak perak 1979–1982, krisis likuiditas 2008, krisis utang 2011, imbal hasil 2013, pandemi 2020, pertentangan dolar/imbal hasil dan bank sentral 2022, tekanan bunga/dolar dan prospek pasokan industri 2026.
- **Sumber riset/primer:** U.S. Mint (usmint.gov), Federal Reserve History (federalreservehistory.org), CFTC (cftc.gov), World Gold Council (gold.org), Silver Institute (silverinstitute.org). Setiap peristiwa punya tautan resmi yang dapat dibuka langsung.
- **Pembaruan:** Harga otomatis diperbarui sesuai data World Bank; kronologi fundamental **merupakan katalog terkurasi, bukan feed berita live atau kalendar ekonomi otomatis**. Tambahan peristiwa memerlukan verifikasi sumber dan revisi kode/dataset. Jangan menampilkan klaim fundamental real-time bila belum ada sumber yang melaporkan.
- **Interpretasi:** pengelompokan 60 tahun dan shio/elemen bukan hubungan sebab-akibat, tidak menghasilkan entry BUY/SELL dan tidak memberikan bobot kontribusi makro yang belum dihitung. Tidak ada OHLC rekaan, tidak mengaitkan satu peristiwa dengan seluruh perubahan harga tahunan tanpa pengujian.
- **Pemeriksaan:** `node tests/fundamental-60y.test.cjs`. Workflow `.github/workflows/metal-history.yml` juga menjalankan validasi sintaks dan data historis sebelum memperbarui arsip.

