# Panel Al-Biruni

Panel terpisah untuk jadwal aspek, dengan mingguan Senin–Jumat sebagai default,
harian 24 jam, dan bulanan. Klik hari pada kalender untuk tabel mulai–inti–akhir.
Kolom inti memuat semua kontak exact dalam satu window; jika tidak ada kontak
exact, panel menampilkan waktu dan orb terdekat, tanpa membuat exact rekaan.

## Perhitungan

- Tujuh benda langit klasik: Matahari, Bulan, Merkurius, Venus, Mars, Jupiter,
  Saturnus. Default enam pasangan Bulan; pilihan semua menghasilkan 21 pasangan.
- Aspek bujur 0°, 60°, 90°, 120°, 180°. Selisih bujur melingkar dipakai untuk
  kedua orientasi aspek. Tidak menghitung lintang aspek, ASC/MC, rumah atau tasyir.
- Ephemeris modern Astronomy Engine **2.1.19**, geosentrik apparent, tropical,
  true ecliptic of date; `Ecliptic(GeoVector(body,time,true)).elon`.
- Kalender memakai WIB UTC+7. Acuan geosentrik tidak memerlukan lokasi Luxor.
- Orb awal 2° merupakan setelan aplikasi, dapat diubah 0.25°–5°. Tidak diklaim
  sebagai orb baku dari al-Biruni.
- Grid 15 menit mencari kontak dan titik balik. Akar signed angular error dan
  batas orb disempurnakan dengan bisection sampai bracket ≤1 detik. Titik balik
  disempurnakan untuk menangkap kontak yang mendekati orb di antara sampel.
  Resolusi numerik tersebut bukan klaim akurasi ephemeris satu detik.
- Setiap lintasan ulang saat retrograde tetap disimpan. Batas periode tidak
  disamarkan sebagai awal atau akhir kontak sebenarnya. Exact di batas akhir
  dicatat pada periode berikutnya untuk mencegah duplikasi.

## Arah XAUUSD

Default semua aspek NETRAL. Pengguna boleh memberi BUY atau SELL pada tiap jenis
aspek di bagian setelan hipotesis. Ini pemetaan manual, bukan aturan trading
dari kitab dan belum memiliki backtest XAUUSD. Pada waktu dipilih: ada BUY saja
berarti BUY; SELL saja berarti SELL; keduanya berarti KONFLIK; tanpa aturan arah
aktif berarti NETRAL. Jumlah aspek, durasi dan jumlah exact tidak dipakai sebagai
confidence atau probabilitas keuntungan. Panel tidak mengirim data ke EA.

CSV menyimpan UTC, WIB, kontak berulang, orb, penanda batas periode dan label
`manual_bias_UNVALIDATED`. Setelan memakai localStorage `cebonk.albiruni.v1`.

## Pemisahan dari astrology lama

Modul `assets/albiruni-core.js`, `assets/albiruni-ui.js` dan `assets/albiruni.css`
memiliki engine, cache, kontrol, status, hasil, dan penyimpanan sendiri. Panel
tidak membaca atau menulis `CebonkCore`, `CEBONK_ASTRO_STATE`, skor V1, feed EA,
atau event `cebonk-astro-update`. Hanya objek pustaka Astronomy yang dibaca bila
sudah dimuat. Semua CSS dibatasi ke `#albiruniPanel`. Perubahan index hanya
menambahkan satu mount, satu stylesheet, dan dua script.

## Sumber dan cakupan sejarah

Terinspirasi dari aspek dan applying/exact/separating pada Al-Qanun al-Masudi,
Maqalah XI, Bab 2. Ini bukan pemindahan seluruh sebelas maqalah ke JavaScript.

- [Edisi cetak III halaman 1373](https://archive.org/details/kitabalqanunalma03biru/page/n307/mode/1up).
- [British Library Or 1997 / Qatar Digital Library](https://www.qdl.qa/en/archive/81055/vdc_100022880536.0x000001).
- [Koleksi Internet Archive dari pengguna](https://archive.org/details/al-qanun-al-masudi-biruni-muhammad-ibn-ahmad).
- [Dokumentasi resmi Astronomy Engine 2.1.19](https://github.com/cosinekitty/astronomy/blob/v2.1.19/source/js/README.md).

## Validasi

`node tests/albiruni.test.cjs` mencakup kalender WIB, wrap sudut, akar antarsampel,
awal/akhir orb, near miss, kontak saat titik balik, retrograde berulang, batas
periode, pembatalan, kegagalan ephemeris, konflik aturan, dan CSV. Kontak Bulan–
Matahari aktual dibandingkan dengan `SearchMoonPhase` resmi dengan konvensi
koordinat tanpa aberration yang disamakan untuk tes tersebut. Mode produksi
apparent juga dibandingkan dengan solver akar `Search` resmi secara terpisah.
`node tests/albiruni-ui.test.cjs` memeriksa
alur DOM, navigasi, leap year, aturan, ekspor, data basi, batal/gagal dan isolasi
state lama. Tes DOM bukan pengganti pemeriksaan tampilan pada browser nyata.

Dependensi tes: `npm install --no-save --no-package-lock --ignore-scripts
astronomy-engine@2.1.19 jsdom@26.1.0`.
