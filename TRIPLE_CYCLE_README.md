# CEBONK TRIPLE CYCLE ASTROLOGY — MODUL WEB

Modul berbasis browser untuk menggabungkan *perhitungan* dari tiga jenis kalender/siklus, tanpa mengubah mesin trading:

- **Astrology Barat:** ephemeris posisi planet dari Astronomy Engine 2.1.19; tiga cuplikan model eksperimental per tanggal **06.00, 12.00, 18.00 WIB**. BUY/SELL hanyalah klasifikasi skor bawaan model v2.0 yang **belum tervalidasi**; dua dari tiga cuplikan harus searah untuk klasifikasi hari. Hari lain NETRAL atau TRANSISI. Segmentasi awal–inti–akhir berbasis tanggal, bukan waktu perubahan harga yang sebenarnya. Rincian tanggal memperlihatkan aspek planet dekat dan planet yang tampak retrograde.
- **BaZi:** Pilar Tahun dan Pilar Bulan memakai `lunar-javascript@1.7.7` melalui `assets/bazi-core.js`, dengan tanggal/jam lokal Beijing untuk pergantian musim surya dan pelaporan WIB. Pergantian Pilar Bulan dicari ke menit berdasarkan pustaka itu; bukan tanggal 1 otomatis. Elemen dan shio dalam UI ditampilkan dalam bahasa Indonesia, tanpa Hanzi.
- **Ilmu Falak / Hisab Bulan:** 8 sudut fase Bulan dari `Astronomy.SearchMoonPhase` pada 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°. Umur Bulan dihitung sejak ijtimak terbaru; sudut fase dihitung geosentris. **Tidak** menghitung tinggi hilal di ufuk atau probabilitas terlihatnya hilal; sehingga tidak dapat dipakai untuk penetapan awal Ramadan/Syawal.
- **Tanggal Hijriah referensi:** API kalender browser `Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura')`; ditandai sebagai **Umm al-Qura**, bukan kalender resmi Indonesia/rukyat pemerintah. Bila dukungan browser tidak ada, tampilkan “Tidak didukung browser”, tidak mengarang tanggal.
- **Zona waktu:** tampilan waktu WIB UTC+07:00. Rentang tahun 2020–2040 mengikuti dukungan model utama Astrology.
- **Interaksi:** buka tab **BAZI ASTROLOGY**, pilih pintasan **TRIPLE CYCLE BULANAN**, pilih bulan dan tekan **Hitung Bulanan**. Klik suatu tanggal untuk membaca rincian; unduh CSV bila diperlukan. Tombol sebelumnya dan berikutnya tersedia.

## Batasan ilmiah dan trading

Ketepatan ephemeris dan kalender **tidak membuktikan** bahwa BaZi, fase Bulan, Hijriah atau posisi planet memprediksi harga XAUUSD/XAGUSD. Tidak ada voting arah antara Falak/BaZi dan Astrology, tidak ada model probabilitas transaksi yang teruji, tidak ada order MT5/API. Klasifikasi warna adalah hasil model eksperimental dan hanya diperuntukkan riset. Tidak ada data harga buatan.

## Struktur berkas

- `assets/triple-cycle-core.js` perhitungan dan validasi (tanpa DOM).
- `assets/triple-cycle-ui.js` kalender mobile-first dan CSV.
- `tests/triple-cycle.test.cjs` uji referensi astronomis dan kalender serta integrasi DOM.
- `.github/workflows/bazi-astrology.yml` menjalankan seluruh uji dengan pustaka asli, bukan mock.

## Sumber

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) — algoritma ephemeris dan fase Bulan, lisensi MIT.
- [lunar-javascript](https://github.com/6tail/lunar-javascript) — penanggalan surya dan BaZi, lisensi MIT.
- [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) — kalender Umm al-Qura dari implementasi ICU/browser; bukan penetapan tanggal resmi di Indonesia.
