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

## Mode AUTO EKSPERIMEN v1.2 (default)

**AUTO** otomatis menghitung hipotesis BUY/SELL/KONFLIK/NETRAL dari aspek planet saat jam WIB dipilih, terpisah dari **MANUAL** v1.1 yang tidak berubah. Pengaturan mode disimpan pada localStorage `cebonk.albiruni.v1`. Hasil bukan prediksi harga yang teruji, tidak terhubung ke EA/Telegram, dan **BUKAN rumus trading dari Al-Biruni**. Dasar Al-Biruni yang disitasi hanya timing aspek, bukan bobot pasar.

Metode eksplisit yang dapat diaudit dalam `assets/albiruni-core.js`:

- Sifat planet menurut **asumsi modern developer** (bukan koefisien kitab): Matahari +0.20; Bulan 0; Merkurius 0; Venus +0.90; Mars −0.95; Jupiter +1.15; Saturnus −1.15.
- Bobot aspek (pengali kekuatan, **bukan tanda arah langsung**): Konjungsi 0.90; Sextile 1.00; Square 0.75; Trine 1.10; Opposition 0.80. Karena itu Sextile Mars–Saturnus bisa menyumbang SELL; Square Venus–Jupiter bisa menyumbang BUY.
- Bobot fase applying 1.10, exact 1.25, separating 0.80, stationary 0.70. Bobot orb `max(0,1-orb/orbSetting)`, dengan default `orbSetting = 2°`.
- Kontribusi pasangan = `((natureP1+natureP2)/2) * aspectWeight * phaseWeight * orbWeight`. Pisahkan kontribusi positif menjadi `buy`, dan absolut negatif menjadi `sell`; `net=buy-sell`. Angka ini **skor model**, bukan probabilitas atau winrate.
- Ambang arah 0.18. Dua sisi disebut **KONFLIK** bila masing-masing ≥0.18 dan sisi lemah ≥45% sisi kuat; jika tidak, BUY ketika net≥0.18, SELL ketika net≤−0.18, selain itu NETRAL. NETRAL bukan bug bila tidak ada aspek kuat.
- Panel menunjukkan alasan `reason`, bobot BUY dan SELL, semua aspek aktif berikut orb/fase, dan MULAI–INTI–AKHIR astronomis untuk *aspek dominan*. Jam tersebut **bukan awal–inti–akhir tren harga emas**.
- Kalender hari terpilih menampilkan daftar **window bias AUTO** yang disampling setiap 15 menit. Awal/inti/akhir pada daftar itu memakai tanda ~ karena berupa **estimasi grid**, bukan waktu exact. Klik **Lihat INTI** untuk audit pada jam grid tertentu; rentang setiap aspek tetap dihitung dengan akar presisi numerik terpisah.
- CSV riset mode AUTO menambah empat kolom `auto_hypothesis_UNVALIDATED`, `auto_buy_weight`, `auto_sell_weight`, `auto_reason` ke 24 kolom studi waktu astronomis yang lama. Mode MANUAL tetap memakai CSV 24 kolom. Harga broker tetap kosong. Belum ada uji profitabilitas XAUUSD 2024–2026; kalibrasi dan evaluasi di dataset out-of-sample diperlukan sebelum mempertimbangkan pemakaian finansial.

**Batasan:** bobot ini hipotesis buatan aplikasi, bukan pengetahuan yang dibuktikan dari `Al-Qanun al-Masudi` atau studi pasar. Perhitungan aspek berbasis kalender dan ephemeris modern tetap terpisah dari aturan arah. Tidak ada pengiriman trade atau feed baru untuk MT5. Panel dapat menunjukkan BUY/SELL lebih sering dibanding versi yang semua aturan MANUAL awalnya NETRAL, tetapi tidak dipaksa menjadi selalu BUY/SELL.

## Perbaikan v1.1 — audit & bukti pengujian XAUUSD

- Ekspor **CSV aspek** lama tetap tersedia. Ditambahkan tombol **CSV riset XAUUSD** yang menghasilkan satu baris tiap kontak **EXACT** (termasuk semua exact retrograde) atau satu baris **TERDEKAT_BUKAN_EXACT** untuk window tanpa exact. Urut sesuai waktu UTC; juga ditulis WIB.
- Format riset memuat nama pasangan, sudut, window, status batas periode, orb setelan, grid, versi mesin, ephemeris, dan **manual_bias_UNVALIDATED**. Kolom observed_xau_t0_EMPTY / observed_xau_1h_EMPTY / observed_xau_4h_EMPTY sengaja **dibiarkan kosong** karena website tidak mengambil harga untuk panel ini. Pengguna harus menggabungkan data XAUUSD broker secara eksternal untuk melakukan uji pasar yang bebas look-ahead; winrate, return, probabilitas, dan rekomendasi perdagangan tidak dihitung.
- Status pemeriksaan jam kini menyebut **exact berikutnya/sebelumnya**, atau *titik terdekat bukan exact*. Ini keterangan astronomi, tidak mengubah logika arah.
- **Mingguan tetap hanya Senin–Jumat**; kontak yang terjadi Sabtu/Minggu tidak digeser atau diklaim sebagai sinyal pada Jumat/Senin. Harian dan bulanan tetap menghitung tanggal kalender apa adanya.
- Pemetaan BUY/SELL masih hipotesis **manual**, NETRAL sebagai default, KONFLIK jika overlap. Tidak ditambah rumus arah pasar atas nama al-Biruni tanpa dasar teks terverifikasi dan data validasi. Data ini **belum** dibaca EA MT5.
- Dependency Astronomy Engine tetap memakai runtime library versi 2.1.19. Browser masih perlu internet/cache; dua CDN tersedia, namun **belum** ada paket offline yang berdiri sendiri. Jangan klaim fitur tersedia offline.
- Ketelitian root bertaraf bracket numerik sekitar 1 detik, **bukan** presisi ephemeris mutlak; angka UTC yang memiliki milidetik adalah artefak solver, bukan hasil pengamatan langit langsung.

### Verifikasi sumber vs adaptasi modern

British Library Or 1997 di Qatar Digital Library mengidentifikasi `al-Qanun al-Masudi` sebagai naskah 11 maqalah dan Maqalah XI membahas astrologi: https://www.qdl.qa/en/archive/81055/vdc_100022880536.0x000001 . Itu membenarkan cakupan sejarah **secara umum**, bukan membuktikan pemetaan aspek → prediksi XAUUSD, orb 2°, penggunaan ephemeris modern atau 5-minute trading window. Semua bagian tersebut harus diperlakukan sebagai pilihan implementasi/hipotesis modern; belum ada bukti statistik kemampuan prediksi arah harga.

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
periode, pembatalan, kegagalan ephemeris, konflik aturan, CSV aspek, CSV riset, exact berulang dan label akhir pekan. Kontak Bulan–
Matahari aktual dibandingkan dengan `SearchMoonPhase` resmi dengan konvensi
koordinat tanpa aberration yang disamakan untuk tes tersebut. Mode produksi
apparent juga dibandingkan dengan solver akar `Search` resmi secara terpisah.
`node tests/albiruni-ui.test.cjs` memeriksa
alur DOM, navigasi, leap year, aturan, ekspor, data basi, batal/gagal dan isolasi
state lama. Tes DOM bukan pengganti pemeriksaan tampilan pada browser nyata.

Dependensi tes: `npm install --no-save --no-package-lock --ignore-scripts
astronomy-engine@2.1.19 jsdom@26.1.0`.
