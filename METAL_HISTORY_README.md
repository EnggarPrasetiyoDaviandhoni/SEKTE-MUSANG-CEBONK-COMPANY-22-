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
