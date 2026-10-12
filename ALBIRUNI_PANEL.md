## PRIMBON DAGANG + SAAT AGUNG — mode observasi, TANPA filter entry (12 Oktober 2026)

Sumber primer transkripsi:
- No.159, hari–pasaran Sri untuk **dagang / golek sandhang pangan**: https://jv.wikisource.org/wiki/Kaca:Kitab_Primbon_Betaljemur_Adammakna.pdf/125 (nomor halaman cetak 124 pada versi Wikisumber ini; nomor halaman lain antar edisi berbeda).
- No.147, **Saat Agung** untuk keperluan umum: https://jv.wikisource.org/wiki/Kaca:Kitab_Primbon_Betaljemur_Adammakna.pdf/119 (nomor halaman cetak 118 pada transkripsi Jawa).
- Siklus pasaran berpatokan pada **2026-10-12 Senin Pahing** (beberapa kalender Jawa Oktober 2026 sepakat, mis. detikJatim). Siklus 5 pasaran diulang tiap hari tanpa tanggal lahir.

**Tabel No.159**: Minggu Pon; Senin Kliwon; Selasa Pahing; Rabu Wage; Kamis Pahing; Jumat Wage; Sabtu Legi = SRI. Selain kombinasi tersebut = DUDU SRI, **bukan otomatis dina ala**. Bukan Pancasuda umum Sri–Lungguh–Gedhong–Lara–Pati.

**Saat Agung No.147**: Wiji, Cahya, Rejeki = kategori waktu baik menurut naskah. Lara, Malaekat, Puji, Pati = dianjurkan dihindari menurut naskah. Tabel jam 7 hari dikopi ke `assets/primbon-dagang.js`, dengan rentang akhir eksklusif. Jam 11–1 / 1–3 setelah jam 11 dinormalisasi menjadi 11:00–13:00 / 13:00–15:00 sesuai urutan jam tabel. **Jam di luar rentang tabel = DI LUAR TABEL**, bukan buruk. Ini bukan Saat II/Ratu No.165.

**Konvensi waktu:**
- UI dan notifikasi EA menggunakan WIB UTC+7, **bukan jam server broker**.
- SRI No.159 menggunakan pergantian hari pasaran setelah **18:00 WIB sebagai pendekatan Maghrib**, bukan matahari terbenam astronomis aktual; label bisa bergeser dekat Maghrib di kota/tanggal berbeda. Kalender pasar tradisional yang memakai pergantian 00.00 juga bisa berbeda untuk sesi malam.
- Saat Agung No.147 menggunakan nama hari sipil WIB beserta jam tabel yang tertulis, **tidak diteruskan** ke jam di luar tabel atau ditafsir ulang mengikuti hari Jawa setelah Maghrib. Waktu di luar rentang tetap tak berlabel. Perlu kajian sumber tambahan jika ingin perhitungan malam yang berbeda.
- Tanggal lahir pengguna **tidak diperlukan**.

**Integrasi:** `assets/primbon-dagang.js` (perhitungan murni testable) dan `assets/primbon-dagang-ui.js` (panel baca-saja) tampil di halaman AL-BIRUNI untuk tanggal/jam pilihan serta kandidat entry dari feed `majority_direct_v3.json` yang sama. `CEBONK_ALBIRUNI_SRI_SAAT_v1.04.mq5` (TXT dan SET disertakan) melanjutkan feed **V3 yang sama tanpa mengubah 14 kolom CSV**; satu-satunya logika baru adalah **menambahkan Sri dan Saat Agung ke notifikasi Telegram/MT5 ketika entry sudah sukses**.

**Tidak memblokir trading sama sekali.** Bukan penentu arah BUY/SELL, bukan syarat masuk, tidak menaikkan atau menurunkan risiko dan lot, tidak mengubah gate market; tidak ada klaim Primbon bisa memprediksi XAUUSD. EA v1.03 tetap tersedia; v1.04 default AUTOPILOT OFF, pengakuan riset OFF, izin akun real OFF, SL 3×ATR(14) M15, TP RR 1:2, spread NOZAX 70, cutoff intraday lama tetap sama. Jangan jalankan kedua versi pada simbol/magic sama; gunakan MetaEditor untuk compile dan Strategy Tester/demo sebelum akun real. Static CI **bukan** kompilasi MQL5 atau backtest historis.

---

## Koreksi UI v1.02: ARAH mayoritas ≠ IZIN entry — 12 Oktober 2026

Panel final menampilkan **FOKUS ARAH HARIAN** terpisah dari **IZIN ENTRY EA**. Pada 2026-10-12, sinyal AUTO pukul 12:00 WIB adalah SELL (2 SELL, 1 BUY), dan mayoritas harian dari sampler tercatat SELL 128 suara vs BUY 30 suara. **Feed EA v1.02 tetap WAIT** karena kualitas waktu klasik §527 CAMPURAN.

Web membaca `ea/albiruni_intraday/data/majority_v2.json` milik EA v1.02, **bukan** `intraday.json` v1.01. JSON harus `ALBIRUNI_MAJORITY_V2`, mempunyai jumlah suara dan label `ASPECT_COUNT_MAJORITY_V2`, serta konsisten dengan pembatas `WAIT` / gate §527. Bila feed tidak ada, tanggal berbeda, atau kontradiktif, panel tidak menampilkan sinyal palsu. Tombol perbarui membaca lagi tanpa cache.

Perubahan hanya presentasi/read-only, tidak mengubah generator, EA, atau filter ketat. Mengubah CAMPURAN menjadi entry tetap perlu evaluasi strategi terpisah dan pengujian risiko.

---

## Perubahan model AUTO — mayoritas jumlah aspek (12 Oktober 2026)

Berdasarkan permintaan pengguna, model `ALBIRUNI_AUTO_MAJORITY_V2` menentukan fokus arah dari **jumlah aspek aktif berarah**: **2 SELL + 1 BUY = SELL**, **2 BUY + 1 SELL = BUY**, **imbang = KONFLIK** dan **tanpa arah = NETRAL/WAIT**. Aspek berkekuatan bobot kecil (seperti SELL −0.006) tetap dihitung sebagai satu aspek selama masih aktif dan kontribusinya memiliki tanda SELL. Tidak menghitung sekadar banyaknya label tanpa arah; aspek 0 diabaikan. Fase applying/separating keduanya masuk hitungan sesuai permintaan.

- Sinyal pada jam tertentu memakai jumlah aspek di jam itu. Dominasi harian/mingguan/bulanan memakai **jumlah vote aspek yang disampling** di masing-masing tanggal/jam (mengecualikan Sabtu–Minggu untuk fokus trading), bukan bobot total atau jumlah menit yang mendapat label BUY/SELL.
- Bobot planet, fase, orb dan aspek **tetap dihitung untuk diagnostik dan pemilihan titik puncak di saat jumlah suara sama**, tetapi tidak membalik arah mayoritas.
- Web menampilkan `FOKUS JAM`, jumlah BUY dan SELL, serta fokus periode terpisah; arah periode masih bisa berbeda dengan jam tunggal. Feed EA memakai fungsi AUTO yang sama, dengan filter waktu §527 tetap aktif. Sinyal EA final tetap bisa WAIT.
- Ini **hipotesis modern yang belum divalidasi**, bukan aturan klasik Al-Biruni atau bukti peningkatan winrate. Perubahan model dapat mengubah sinyal masa depan; uji data XAUUSD 2024–2026 dan demo sebelum akun real.

---

## Koreksi tampilan web: peta AUTO ≠ keputusan EA (12 Oktober 2026)

Ketika pengguna membuka tabel aspek dan melihat `KONFLIK`, `BUY`, atau `SELL` pada jam yang dipilih, itu adalah output `assets/albiruni-ui.js` (AUTO research), **bukan** keputusan feed yang diikuti MT5. Panel `KEPUTUSAN EA FINAL · FILTER WAKTU KLASIK` sekarang diletakkan **tepat sebelum Periksa jam WIB** dan membaca `ea/albiruni_intraday/data/intraday.json` dengan cache no-store, lalu fallback ke GitHub RAW. Menampilkan BUY/SELL/WAIT, kondisi waktu klasik, tanggal feed, alasan, dan kapan file dipublikasikan.

Untuk tanggal 2026-10-12, feed yang telah diterbitkan adalah `WAIT_ELECTION_TIME_NOT_FAVORABLE`, `CAMPURAN`, sementara peta AUTO jam 12:00 dapat tetap menunjukkan KONFLIK. Ini **dua output berbeda yang tidak boleh disamakan**. Jika tanggal yang dipilih tidak sama dengan tanggal feed, panel tidak menampilkan feed lama sebagai keputusan saat ini. Jika feed gagal dimuat, panel menyatakan tidak tersedia (tidak menebak sinyal). Ada tombol "Perbarui status EA". Locale tempat Ascendant pada web dan feed dapat berbeda; panel mengingatkan pengguna bila koordinat tidak cocok.

Tidak mengubah arah AUTO, generator, kode MQ5, broker trade, atau pengaturan AUTOPILOT. Tidak ada klaim prediksi XAUUSD telah tervalidasi; perubahan ini **koreksi keterbacaan dan konsistensi informasi**, bukan perbaikan winrate.

---

## Integrasi waktu menguntungkan/merugikan ke EA — riset §527 (12 Oktober 2026)

- Modul sumber tunggal baru `assets/albiruni-election-gate.js` menghitung klasifikasi MENGUNTUNGKAN / MERUGIKAN / CAMPURAN dari chart AL-BIRUNI KLASIK; penilaian berkaitan dengan waktu melakukan suatu urusan, **tidak memberi arah BUY/SELL modern**.
- Engine arah BUY/SELL di `assets/albiruni-core.js` tetap hipotesis lama. Generator EA mengizinkan kandidat hanya bila dua pemeriksaan waktu klasik (ENTRY dan lima menit sebelum EXACT) sama-sama MENGUNTUNGKAN. Selain itu CSV = WAIT; tidak pernah membalik arah.
- Source PDF: *The Book of Instruction in the Elements of the Art of Astrology* §527 (PDF p.126), §440–453 (p.50–59), §493–494 (p.101–102), §409–411 (p.37). Klasifikasi benefic/malefic berbasis prinsip kitab, tetapi persyaratan ambang dua waktu adalah **aturan riset modern**, bukan rumus asli kitab.
- Lokasi referensi default Jakarta (-6.2, 106.8167); UI lokasi dapat diedit, generator `--latitude`/`--longitude`. Bila lokasi berbeda, hasil bisa berbeda. Semua penilaian dan alasan direkam dalam JSON audit.
- Kontrak feed CSV 12 kolom `ALBIRUNI_INTRADAY_V1` dan file EA MQL5 tidak diubah. Autopilot real tidak diaktifkan. Belum ada verifikasi profit XAUUSD historis, compile MetaEditor, atau uji broker langsung.

---

## AL-BIRUNI KLASIK v2 — implementasi kitab asli (12 Oktober 2026)

Koreksi atas v1: panel penelitian klasik tidak cukup hanya menghitung empat komponen martabat. Implementasi v2 menambahkan:

- **Martabat klasik 5/4/3/2/1**, mencakup **Egyptian terms +3** yang ditranskripsi langsung dari tabel §453 PDF halaman 59. Pilihan metodologi eksplisit: Egyptian, **bukan tabel Ptolemaios**. Domicile §440 PDF 50; exaltation §443 PDF 52 (menggunakan sign-wide interpretation karena kitab mencatat perbedaan pendapat tentang derajat khusus), triplicity §445 PDF 53, face §449 PDF 56–57; bobot §494 PDF 101–102. Perbedaan versi harus dihormati dan tidak dihapus diam-diam.
- **Ascendant lokal** berdasarkan waktu sidereal apparent Greenwich dari Astronomy Engine 2.1.19, koordinat lokasi yang dapat diubah, dan titik potong **horizon timur** terhadap ekliptika tropis dengan obliquity rata-rata. Karena precession/nutation tidak dihitung sepenuhnya dalam transformasi, ASC diberi label **aproksimasi**. Batas lintang ±89,9°.
- **Siang/malam otomatis** berdasarkan tinggi geometris Matahari tanpa refraksi atmosfer pada koordinat yang dipilih. Di dekat horizon (altitude ±0,5°), hasil ditandai tidak pasti.
- **Analisis §527 PDF 126**: posisi dan penguasa Ascendant; Bulan dan penguasa tanda Bulan; Matahari sebagai asosiasi simbolis emas dari §410 PDF 37; kedekatan aspek dengan Venus/Jupiter (benefic) atau Mars/Saturn (malefic); dan kontak Bulan–penguasa Ascendant. Input orb diambil dari panel pengguna dan **bukan satu-satunya batas dalam kitab** (§490 PDF 98–99).
- Status `KONTAK_BENEFIC`, `KONTAK_MALEFIC`, `CAMPURAN`, atau `BELUM_ADA_KONTAK` merupakan **inventaris kontak aspek**, bukan putusan electional lengkap. Nama "asli" menunjukkan sumber aturan, bukan reproduksi semua teknik; seluruh rumah, pemilihan signifikator urusan, lintang aspek, dan interpretasi electional lengkap masih di luar lingkup.
- **BUY/SELL/WAIT tetap tampak sebagai perbandingan tetapi berasal dari AUTO EKSPERIMEN modern**, bukan keputusan klasik, dan tidak dipakai untuk mengirim order EA MT5, mengubah feed, atau mengubah modul ASTROLOGY lama. Tidak ada rumus trading XAUUSD asli di kitab maupun validasi hubungan aspek dengan harga emas.

Referensi PDF adalah nomor halaman *file 128 halaman yang diunggah*, bukan nomor halaman terbitan lain. Contoh lokasi awal Jakarta hanya preset demonstrasi, **bukan klaim pengguna berada di Jakarta**.

---

## Koreksi tampilan arah 12 Oktober 2026

Panel AL-BIRUNI KLASIK sekarang menampilkan arah **BUY/SELL/WAIT** dari model **AUTO EKSPERIMEN lama**, berdampingan dengan skor martabat klasik. Arah harian dan arah pada jam WIB yang diperiksa ditampilkan secara terpisah; jam kandidat, MULAI, INTI, AKHIR mengikuti perhitungan `periodEntryReport` yang sudah ada. Kondisi `KONFLIK` ditunjukkan sebagai WAIT untuk keputusan dengan label konflik yang eksplisit.

**Batasan penting:** skor martabat klasik itu sendiri tidak menghasilkan arah XAUUSD. Bobot arah AUTO tidak berasal dari rumus klasik Al-Biruni dan belum tervalidasi secara historis. Modul tidak mengubah EA, generator feed, ataupun sinyal trading langsung. Untuk evaluasi mingguan/bulanan gunakan tombol “Hitung 3 Dominasi” yang sudah ada. Perubahan hanya memperjelas informasi dan tidak memperbaiki akurasi model yang pernah menghasilkan SL.

---

## Perbaikan AL-BIRUNI KLASIK — audit 12 Oktober 2026

Penambahan panel riset mandiri berdasarkan PDF *The Book of Instruction in the Elements of the Art of Astrology* (unggahan 128 halaman), bukan formula prediksi XAUUSD dari kitab.

- Sumber yang diterapkan: §440 domicile (PDF 50), §443 exaltation (PDF 52), §445 triplicity (PDF 53), §449 face (PDF 56–57), dan §494 skor martabat (PDF 101–102). Simbol emas §409–411 berada di PDF 37; timing applying/separating §489–490 di PDF 98–99.
- Hitung skor parsial: domicile +5; exaltation +4; triplicity +2; face +1. **Term +3 sengaja belum dihitung** sebab §453 menampilkan alternatif tabel Mesir dan Ptolemaios; tidak boleh mengarang nilai untuk salah satunya.
- Pengguna memilih siang/malam manual. Belum menghitung Ascendant, rumah, konjungsi lintang, maupun pemilihan waktu §527. Hasil **bukan BUY/SELL, probabilitas harga, atau sinyal EA**.
- Perbaikan sengaja terisolasi: ASTROLOGY lama, AUTO AL-BIRUNI v1.5, feed GitHub, EA MT5, dan transaksi akun real tidak diubah.
- Temuan belum diperbaiki dalam PR ini: pengaturan web focus/orb tidak identik dengan generator feed (moon/orb 2, jam 07–23 WIB); sistem BUY/SELL AUTO belum memiliki validasi XAUUSD 2024–2026. Jangan gunakan model untuk akun real tanpa audit backtest out-of-sample dan kontrol risiko.

---
# Panel Al-Biruni

## Pembaruan v1.5 — 3 hasil independen sekaligus, tanggal dan jam kandidat ENTRY WIB

**Tombol baru `Hitung 3 Dominasi + Jam Entry`** di tab AL-BIRUNI menghitung **tiga sumber periode secara terpisah** dengan ephemeris dan pengaturan orb/pasangan planet yang sama. Tidak mengambil arah harian dari mingguan, atau arah mingguan dari bulanan:

| Kartu | Periode | Resolusi grid estimasi |
|---|---|---|
| HARIAN / INTRADAY | 1 tanggal WIB (dengan market tutup akhir pekan) | 15 menit |
| MINGGUAN / SWING | Senin–Jumat WIB pekan tanggal acuan | 30 menit |
| BULANAN / POSITION TRADE | Bulan kalender tanggal acuan; fokus hanya sesi hari kerja | 60 menit |

Setiap kartu menampilkan BUY, SELL, atau **WAIT**, rentang tanggal periode, dan apabila ada window valid: **TANGGAL & JAM KANDIDAT ENTRY**, **MULAI**, **INTI**, **AKHIR** dalam tanggal dan jam WIB penuh. Entry kandidat dipilih dari **`peak` (INTI grid) window terpanjang dalam arah dominan periode itu**. Ini **puncak skor model eksperimen**, bukan penentuan eksekusi yang teruji; jam dapat sudah lewat dan aplikasi menandainya. Informasi aspek pendukung diambil ulang dari `autoSignal` pada jam INTI, mencantumkan pasangan planet, jenis, fase, dan orb.

Jika hari Sabtu/Minggu, hasil harian adalah WAIT tanpa jam entry (meskipun aspek astronomi tetap dihitung). Jika arah seimbang, tidak ada window searah, atau data tidak valid, tampil WAIT/galat; **tidak mengarang waktu entry**. Rincian tabel aspek asli, AUTO/MANUAL, tiga tombol lama HARIAN/MINGGUAN/BULANAN, dan hasil seleksi individual tetap tersedia. Ganti tanggal/pasangan/orb membatalkan hasil 3 kartu sebelumnya. Tombol batal dan peringatan sumber pustaka tetap digunakan. Tidak melakukan transaksi, mengirim alert EA, mengambil candle emas, ataupun menghitung probabilitas, profit/loss, dan akurasi.

**Metodologi:** mengolah `C.scan` **tiga kali** (mode day, week, month) lalu `C.periodEntryReport` masing-masing, sehingga ketiga dominasi boleh berbeda, misalnya SELL / BUY / SELL, sesuai hasil perhitungan, tanpa memaksa ketiganya sama arah. Bobot planet/aspek/fase tetap **hipotesis modern yang belum divalidasi**, bukan klaim rumus trading al-Biruni. Hasil merupakan kandidat waktu riset, bukan rekomendasi bertransaksi.

## Pembaruan v1.4 — Fokus satu arah per HARIAN / MINGGUAN / BULANAN

- Mesin `autoPeriodSummary` menetapkan arah dominan **satu kali per periode**: BUY apabila total menit BUY > SELL, SELL apabila SELL > BUY, dan NETRAL bila sama kuat/nihil. Data hanya aspek planet yang sama, **bukan** sinyal harga teruji dari kitab Al-Biruni.
- Setelah menentukan fokus, daftar `focusWindows` dan `focusWindow` tiap tanggal **hanya boleh searah fokus periode**. Hari dengan hanya arah lawan menjadi **WAIT**, tidak disulap menjadi arah fokus; Sabtu/Minggu **MARKET TUTUP**. Jumlah menit lawan disimpan sebagai `counterMinutes` untuk transparansi, tetapi tidak dipromosikan sebagai kandidat sinyal.
- Jadwal periode MULAI–INTI–AKHIR memakai window dominan searah (grid: harian 15 menit, mingguan 30 menit, bulanan 60 menit). Detail aspek asli — termasuk arah lawan, exact/retrograde, dan fase — tetap tersedia pada tabel audit, diberi tanda SKIP bila berlawanan dengan fokus periode.
- Mode MANUAL dan semua mesin Astrology, BaZi, Astrology News, EA MT5 tidak berubah. Tidak ada estimasi winrate, probabilitas, atau harga XAUUSD.
- Tes memverifikasi BUY dominan Senin dan SELL Selasa: hasil mingguan tetap BUY, Selasa WAIT sementara arah mentah SELL tidak ditimpa, serta weekend tidak dipromosikan ke entry.

## Perbaikan isolasi tab v1.3.1 — Al-Biruni tidak campur BaZi

Masalah screenshot Android: Al-Biruni lan BaZi muncul bersamaan. Penyebab struktural: beberapa skrip navigasi (`combined-tabs.js`, `bazi-ui.js`, `chinese-solar-ui.js`) mengatur daftar panel berbeda tanpa satu pengendali global. Terdapat risiko panel lama tertinggal tampil saat pindah tab.

- `assets/site-tab-router.js` dimuat terakhir dan menjadi pengendali tampilan 8 panel utama: Astrology, Al-Biruni, Astrology News, BaZi, 4 Momen, Kalender Cina, Combined 1, dan Combined 2.
- Setiap klik tab maupun deep link `#al-biruni` / `#bazi-astrology` harus menunjukkan tepat satu panel utama; panel lain ditutup memakai `hidden`. Child technical Combined 1 tetap didukung.
- CSS khusus root panels menegakkan `[hidden]` untuk mengatasi konflik tampilan dari stylesheet tema.
- `tests/site-tab-router.test.cjs` menguji navigasi 8 tab dan sengaja menyimulasikan listener lama yang membuka BaZi ketika Al-Biruni diklik. Perhitungan astrologi, model arah, BaZi dan EA MT5 tidak diubah.


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

## Pembaruan v1.3 — Al-Biruni jadi tab terpisah + ringkasan 3 periode

- Di website GitHub Pages, **ASTROLOGY AL-BIRUNI** sekarang tombol **tab tersendiri**, sederajat dengan ASTROLOGY, ASTROLOGY NEWS, dan BAZI ASTROLOGY. Panel `#albiruniPanel` adalah sibling `#astroView`, bukan anaknya. Klik tab ASTROLOGY tidak lagi memunculkan Al-Biruni di atas jam Luxor. Alamat langsung: `#al-biruni`.
- Tombol mode **HARIAN**, **MINGGUAN**, **BULANAN** mengubah pilihan hitungan (yang masih tersedia di selector) dan langsung menghitung ulang memakai sumber ephemeris/al-Biruni yang sama. Mode harian 24 jam, mingguan Senin–Jumat, bulanan semua tanggal termasuk Sabtu–Minggu sebagai **data astronomi**.
- Ringkasan AUTO sekarang memuat **dominasi arah eksperimen** berdasarkan total durasi grid BUY vs SELL selama sesi Senin–Jumat (seri yang imbang tetap **NETRAL**), window searah terbesar dengan **MULAI / INTI / AKHIR** sebagai *perkiraan grid*, serta kartu setiap tanggal untuk meninjau rinciannya. Sampling: **15 menit harian, 30 menit mingguan, 60 menit bulanan**. Pemilihan grid sengaja dipaparkan; ini bukan timestamp exact planet atau bukti waktu tren emas.
- Ringkasan bulanan mengecualikan Sabtu/Minggu dari penghitungan dominasi XAUUSD; aspek yang muncul akhir pekan tetap terlihat pada kalender dan kartu sebagai **MARKET TUTUP**, tidak digeser ke Jumat atau Senin. Mode harian Sabtu/Minggu tetap menampilkan aspek untuk keperluan riset, tetapi tidak memberi dominasi sesi market.
- Mode **MANUAL** tetap tersedia dan tidak menggunakan ringkasan AUTO; menu setelan manual, CSV, serta tabel aspek lama tidak hilang.
- Semua halaman lain/EA MT5/mesin `CebonkCore` tidak diubah. Navigasi memakai handler utama `bazi-ui.js` dan handler panel untuk menyembunyikan Al-Biruni ketika pindah ke tab lain. DOM tests memeriksa mode, tab, bulan tahun kabisat, pembatalan, dan pemisahan tampilan.
- BUY/SELL tetap **HIPOTESIS MODERN**, bukan rumus asli prediksi emas dari al-Biruni, tidak di-backtest dengan harga XAUUSD. Tidak ada perubahan trading EA, feed WebRequest, atau notifikasi Telegram.

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
