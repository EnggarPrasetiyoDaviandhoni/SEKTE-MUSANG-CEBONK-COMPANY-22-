# Pemisahan feed HTTPS MT5 dari source privat

**Status: belum aktif di publik.** Kode generator, validator dan workflow telah
disiapkan. Kedua payload nyata lulus decoder asli EA dalam harness lokal.
Repository feed terpisah belum bisa dibuat karena GitHub menolak izin integrasi
dengan HTTP 403. URL EA dan visibilitas repository asal belum diubah.

## Audit dua EA asli

File yang diterima disimpan serta diuji secara lokal; tidak dimasukkan ke GitHub:

| File | Kontrak feed |
| --- | --- |
| `CEBONK_NEWS_ASTROLOGY_BBMA_v1.24_DRAFT.txt` | schema 1, `CEBONK_NEWS_ASTROLOGY_V1`, engine `1.0.0`, `BBMA_3TF_NEWS` |
| `CEBONK_BBMA_4MOMEN_v1.30_GITHUB_RAW.mq5` | schema 2, `CEBONK_FOUR_MOMENTS_ASTROLOGY_V1`, engine `2.1.0`, bias `1.0.0`, `BBMA_3TF_FOUR_MOMENTS` |

Hash file asli tercatat di `scripts/mt5-feeds/source-pins.json`. File berlabel
news v1.24 masih memiliki `#property version "1.23"`; metadata itu dipertahankan.
Seluruh source EA, preset, Early Exit, SL/TP, Telegram dan logika entry tetap asli.

Kedua EA menyediakan `InpFeedURL`. Tidak perlu mengubah source atau compile ulang
untuk mengganti URL. URL tidak masuk ke `ConfigHash()` maupun namespace journal.
`OnDeinit()` menutup journal/timer/tampilan, bukan menutup posisi broker.
`ManageEarlyExit()` dijalankan terpisah dari ketersediaan feed. Ini hasil audit kode,
bukan bukti pengujian langsung pada terminal MT5 yang sedang berjalan.

Kedua parser menolak header/model salah, masa berlaku habis, rollback publikasi,
mutasi ID dan penggantian slot terpakai. Cache hanya boleh digunakan selama valid.
Feed kosong juga dapat mencabut layer yang belum dikirim; karena itu publisher
menolak penghilangan window yang belum berakhir tanpa review. Tidak digunakan
feed kosong sebagai pengganti kegagalan sumber.

## Implementasi

- `generate.mjs`: adapter transport JSON untuk model asli yang dipin dengan SHA256.
  Perubahan source model yang belum direview ditolak, walaupun string versinya sama.
- News memakai `assets/astro-news-v1.js` serta Astrology core asli dari `index.html`.
  Parameter planner yang sudah ada dipertahankan. Batas `end_utc` memakai
  `entryEnd`, sehingga periode continuation tidak diperluas menjadi entry baru.
- `sync_calendar.py`: mengambil waktu rilis dari kalender primer BLS, BEA dan
  Federal Reserve, termasuk perubahan DST New York. Cakupan bergulir maksimum
  30 hari, dengan kelompok rilis yang sama: NFP, CPI, PPI, FOMC statement/minutes/
  press conference, GDP advance dan Personal Income and Outlays/PCE. Waktu TBA,
  tanggal ambigu, layout yang tidak dikenali atau perubahan tanggal melalui
  overlay BEA tidak ditebak; penerbitan berhenti untuk diperiksa.
- Empat momen memakai `assets/triple-cycle-core.js` v2.1.0 dan
  `assets/astro-moment-bias.js` v1.0.0. Waktu astronomi asli dipertahankan dalam
  `event_time_utc_ms`; arah berasal dari model bias asli. NEUTRAL tetap NEUTRAL.
  Window mengikuti kebijakan EA: tanggal konteks WIB, Jumat sampai Sabtu 04:00,
  serta konteks Jumat/Senin untuk kejadian akhir pekan. Cakupan 60 hari.
- ID sinyal tidak memuat waktu publikasi. Refresh tidak membuat identitas entry
  baru. Validator pembaruan memeriksa rollback, perubahan isi ID, penggantian slot
  dan pencabutan window yang belum berakhir.
- `validate.py`: pemeriksaan JSON ketat dan kontrak masing-masing EA, termasuk
  duplicate keys, surrogate, batas nesting/token, detik versus milidetik, WIB,
  overlap dan header lifetime.
- `.github/workflows/mt5-public-feeds.yml`: validasi pada PR, jadwal setiap enam
  jam di `main`, serta manual staging/production. Masa berlaku publikasi 36 jam.
  Job news dan momen berjalan terpisah; kegagalan kalender news tidak membatalkan
  job momen. Tidak ada deployment atau izin GitHub Pages.
- Token source hanya `contents: read`. Publikasi menggunakan token terpisah
  dengan Contents read/write khusus repository feed. Destinasi harus Public,
  terpisah dari source, memiliki default branch `main`, dan Pages nonaktif.
  Publisher hanya menulis satu file JSON yang lolos validasi; EA/source tidak disalin.
  Sesudah push, GET HTTPS anonim harus 200, bytes identik, dan validator harus lulus.

## Hasil pengujian

- 9 tes Python: kontrak ketat, masa berlaku, identitas, kalender resmi, DST dan
  penolakan perubahan layout/tanggal yang belum bisa dipastikan.
- 5 tes Node dengan ephemeris asli: kesamaan waktu fase, bias, window entry,
  ID yang stabil, kegagalan sumber dan penolakan perubahan model.
- 52 kasus positif/negatif membandingkan validator Python dengan parser JSON,
  `DecodeFeed()` dan `FeedAvailable()` yang diekstrak dari EA asli. Semuanya lulus.
  Harness hanya mengganti dukungan string/array/waktu MQL menjadi padanan C++;
  source EA asli tidak diubah dan tidak dipublikasikan.
- Payload nyata pada 19 Oktober 2026 berisi 4 window news dan 9 konteks momen.
  Jumlah berubah mengikuti kalender dan cakupan; tidak dipaksa memiliki BUY/SELL.
- Lima halaman kalender primer (BLS/Fed dua bulan dan BEA) memberi HTTP 200.
  Kalender hasil unduhan harus baru diperiksa, maksimum satu jam sebelum generasi.
- Snapshot source website, generator lama, EA dan data lama tetap identik dengan
  `main`. Hanya file baru untuk adapter, pengujian, workflow dan laporan ditambahkan.

Bukti terstruktur ada di [MT5_HTTPS_FEED_VERIFICATION_2026-10-19.json](MT5_HTTPS_FEED_VERIFICATION_2026-10-19.json).
Harness C++ tidak menggantikan kompilasi MetaEditor atau WebRequest terminal live.
Penerbitan jarak jauh, HTTP 200 pada URL baru, dan terminal MT5 masih belum teruji.

## Konfigurasi yang perlu dilakukan pemilik

1. Buat repository melalui [GitHub New repository](https://github.com/new): owner
   `EnggarPrasetiyoDaviandhoni`, nama `CEBONK-MT5-FEEDS`, **Public**, tambahkan
   README, default branch `main`. Isinya hanya README dan dua file di `data/`.
   Biarkan Pages nonaktif. Jika Codex akan membantu menulis branch staging,
   tambahkan repository tersebut ke akses koneksi GitHub Codex.
2. Pada akun GitHub, buka **Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token**. Batasi Repository access
   ke `CEBONK-MT5-FEEDS`, dengan permission **Contents: Read and write**.
3. Pada repository source asal, buka **Settings → Secrets and variables → Actions**.
   Simpan token di **Secrets → New repository secret** bernama
   `MT5_FEED_WRITE_TOKEN`. Nilai token tidak perlu dikirim melalui chat atau EA.
4. Pada tab **Variables**, buat `MT5_PUBLIC_FEED_REPOSITORY` dengan nilai
   `EnggarPrasetiyoDaviandhoni/CEBONK-MT5-FEEDS` dan `MT5_ENABLE_PUBLISH` dengan
   nilai `true`. Semua publikasi PR otomatis tetap dinonaktifkan; staging hanya
   bisa diminta secara manual dari branch pekerjaan yang dipercaya.
5. Jalankan manual workflow pada branch PR, `publish=true`, `destination=staging`.
   Workflow membuat branch data `staging` bila perlu dan memeriksa endpointnya.
   Publikasi `main` hanya diizinkan dari source `main`. Lengkapi pemeriksaan
   HTTP serta decoder pada staging sebelum review/merge perubahan kode.
6. Pada repository asal, atur **Settings → Pages → Build and deployment → Branch:
   None → Save**. [PR #80](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/pull/80)
   untuk menghapus pemicu Pages masih terpisah dan belum di-merge. Konfigurasi Pages
   harus diselesaikan sebelum commit baru di `main` memicu rebuild website lagi.
7. Setelah pengujian dan review selesai, aktifkan workflow di source `main`, lalu
   jalankan `publish=true`, `destination=main`. Pastikan kedua job benar-benar
   menerbitkan data, bukan hanya berstatus **Validation only**.

## Perpindahan URL EA sesudah endpoint teruji

Rencana URL produksi berikut **belum aktif dan belum boleh dipasang pada EA live**:

```text
https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/CEBONK-MT5-FEEDS/main/data/news-astrology-mt5.json
https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/CEBONK-MT5-FEEDS/main/data/astro-4momen-mt5.json
```

Sesudah GET 200, format, waktu, ID dan pembaruan otomatis teruji:

1. Simpan preset EA yang berjalan. Pertahankan akun, simbol, Magic dan journal.
2. Pada MT5 buka **Tools → Options → Expert Advisors → Allow WebRequest for
   listed URL**, lalu pastikan `https://raw.githubusercontent.com` diizinkan.
3. Uji terlebih dahulu pada terminal demo dengan konfigurasi yang sesuai.
   Ganti **hanya `InpFeedURL`** pada masing-masing EA. Default
   `InpFeedInstrument` keduanya `XAUUSD`; payload harus sesuai nilai yang dipakai.
4. Periksa panel/Experts: HTTP 200, feed diterima, revisi dan masa berlaku benar,
   serta tidak ada `FEED_INVALID`, rollback, mutasi ID atau penggantian slot.
   Jika ada cache/journal dari penerbit lama, audit payload lamanya sebelum pindah;
   identitas sinyal penerbit lama belum tersedia untuk dibandingkan pada sesi ini.
5. Pastikan pembaruan terjadwal berikutnya tetap diterima dengan ID sinyal sama,
   dan posisi/Early Exit berjalan sesuai pengaturan semula.
6. Sesudah verifikasi EA, repository source asal dapat diubah menjadi Private oleh
   pemilik. Repository feed tetap Public. Token publikasi tetap disimpan hanya
   sebagai secret di source; tidak dimasukkan dalam URL atau JSON.

## Masalah yang belum selesai

- `POST /user/repos` untuk membuat `CEBONK-MT5-FEEDS` ditolak HTTP 403
  `Resource not accessible by integration`. Konfigurasi repository/secret memerlukan
  pemilik; belum ada klaim bahwa target publik atau credential publikasi siap.
- Dua URL RAW lama masih 404 pada pemeriksaan awal sesi. Source tetap Public,
  `main` dan `mt5-feed` tidak diubah, dan dua EA asli tetap lokal.
- Pengaturan Pages/visibilitas pernah ditolak izin administrasi; status website
  harus diverifikasi lagi setelah pemilik menonaktifkan sumber publikasinya.
- Belum ada HTTP 200 dari endpoint baru atau bukti push publikasi yang sukses.
  Workflow hanya disiapkan, belum dijalankan sebagai publisher produksi.
- Tidak tersedia terminal live MT5 untuk menguji WebRequest, broker/account,
  journal sebelumnya atau posisi yang sedang berjalan.
- Kalender resmi bisa mengubah layout atau membatalkan jadwal. Generator berhenti
  bila sumber tidak dapat dipastikan; saat payload kedaluwarsa EA menahan entry
  baru sesuai kode aslinya. GitHub Actions juga tidak menjamin jam cron tepat.

Tugas belum memenuhi kriteria akhir sebelum HTTPS publik, otomatisasi, kedua EA,
Pages dan pemisahan visibilitas benar-benar diverifikasi.
