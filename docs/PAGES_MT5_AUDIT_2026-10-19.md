# Audit penonaktifan GitHub Pages dan kelangsungan MT5 — 19 Oktober 2026

**Status: BELUM SELESAI.** Konfigurasi Pages masih aktif; dua endpoint JSON yang
diminta masih HTTP 404. PR ini harus tetap draft dan tidak di-merge sampai
pengujian serta ketergantungan feed diselesaikan.

Repository: `EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-`.
Commit dasar: `f5daccf2ae805146ca3352de7efe6e6a9189a69b`.
Branch pekerjaan: `codex/disable-pages-preserve-mt5-20261019`.
Review: [draft PR #80](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/pull/80), tanpa auto-merge.
Seluruh waktu dalam laporan ini menggunakan UTC.

## Temuan dan perubahan

- API Pages masih melaporkan `build_type: legacy`, `source.branch: main`,
  `source.path: /`, `status: built`, `public: true`, dan `cname: null`.
- Deployment Pages terakhir yang teramati berhasil pada 19 Oktober 2026
  pukul 02:03:05: [run 39188050762](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/actions/runs/39188050762).
  Riwayat menunjukkan deployment setelah commit dari workflow terjadwal.
  Sumber branch yang masih aktif memungkinkan publikasi berikutnya walaupun
  situs sebelumnya di-unpublish. Respons HTTP 404 saat ini tidak membuktikan
  bahwa sumber publikasinya sudah dimatikan.
- Ditemukan 10 workflow di `main` dengan izin `pages: write` dan permintaan
  `POST /repos/.../pages/builds`. PR ini hanya menghapus kedua hal tersebut
  dari `astro-candles.yml`, `astro-daily-brief.yml`, `astro-news.yml`,
  `auto-sop.yml`, `combined-split.yml`, `combined2-ea.yml`,
  `combined2-news-attack.yml`, `musang-pdf.yml`, `snd-auto.yml`, dan
  `wallpaper-glass.yml`.
- Tidak ada perubahan pada EA, preset, strategi, parameter, Early Exit, SL/TP,
  Telegram, logika entry, generator, data, `index.html`, atau file website.
  Semua trigger dan langkah non-Pages pada 10 workflow tersebut dipertahankan.
  PR ini belum mengubah workflow yang berjalan di `main`.
- `main` dan `mt5-feed` ada, dan saat snapshot keduanya menunjuk commit dasar
  yang sama. Repository tetap public. Branch `mt5-feed` juga berisi source
  website/EA; branch tersebut bukan penyimpanan feed saja. Menonaktifkan Pages
  tidak menyembunyikan source yang masih ada di repository public.

## Upaya perubahan pengaturan GitHub

Pada pukul 14:43, tindakan administratif berikut dicoba dengan izin integrasi
yang tersedia:

| Tindakan | Hasil |
| --- | --- |
| `DELETE /repos/{owner}/{repo}/pages` untuk menonaktifkan situs beserta sumbernya | HTTP 403: `Resource not accessible by integration` |
| `PUT /actions/workflows/374014886/disable` untuk workflow Pages bawaan | HTTP 422: `Unable to disable this workflow.` |
| Audit kebijakan Actions tingkat repository dan webhooks | HTTP 403; tidak dapat diaudit dengan izin integrasi ini |

Tidak ada perubahan konfigurasi Pages yang berhasil. Workflow bawaan
`dynamic/pages/pages-build-deployment` masih active. Pemeriksaan run berstatus
`queued`, `in_progress`, dan `waiting` menemukan nol run Pages pada masing-masing
status; tidak ada run aktif yang perlu dibatalkan saat pemeriksaan.

## Hasil HTTP dan audit feed

GET publik diperiksa pada 19 Oktober 2026 pukul 14:45. Uji ulang root Pages,
`/index.html`, dan kedua RAW yang diminta pada pukul 14:52 tetap menghasilkan
404. API Pages masih `legacy`, sumber `main /`; kedua branch tetap pada commit
dasar, dan repository tetap public. Detail terstruktur ada di
[PAGES_MT5_VERIFICATION_2026-10-19.json](PAGES_MT5_VERIFICATION_2026-10-19.json).
`mt5-feed` pada dua URL pertama berikut diperlakukan sebagai nama branch,
sedangkan `data/...json` merupakan path file.

| Endpoint | HTTP | JSON valid | Kesimpulan |
| --- | --- | --- | --- |
| [Pages root](https://enggarprasetiyodaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/) | 404 | Tidak | Halaman GitHub “Site not found”; konfigurasi sumber masih aktif |
| Pages `/index.html`, `/assets/astro-news-v1.js`, dan root dengan parameter audit | 404 | Tidak | Tidak tersaji pada lokasi-lokasi yang diperiksa |
| [RAW news yang diminta](https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/mt5-feed/data/news-astrology-mt5.json) | 404 | Tidak | File tidak tersedia |
| [RAW 4 momen yang diminta](https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/mt5-feed/data/astro-4momen-mt5.json) | 404 | Tidak | File tidak tersedia |
| [News JSON yang tersedia di main](https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/astro_news/data/news_windows.json) | 200 | Ya | Model `CEBONK_ASTRO_NEWS_V1`; bukan kontrak dua feed yang diminta |
| [Weekly JSON yang tersedia di main](https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/liquidity_sweep/weekly_atr/data/weekly.json) | 200 | Ya | Model `ASTRO_WEEKLY_V1`; bukan kontrak dua feed yang diminta |
| [Al-Biruni direct V3 JSON](https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/albiruni_intraday/data/majority_direct_v3.json) | 200 | Ya | Tetap tersedia |
| [Swing JSON](https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/cebonk-astro-swing-feed-v2/forecast.json) | 200 | Ya | Tetap tersedia |

Full clone bukan shallow. Pencarian seluruh objek/path dalam riwayat semua
branch yang tersedia tidak menemukan `news-astrology-mt5.json` maupun
`astro-4momen-mt5.json`. Tree API `mt5-feed` juga tidak memiliki kedua file itu.
Generator dan kontrak validator EA untuk dua nama tersebut belum ditemukan.
Tidak dibuat file pengganti, alias feed, atau sinyal BUY/SELL buatan.

Pemilik mengonfirmasi bahwa branch `mt5-feed` baru dibuat kembali, kedua JSON
belum tersedia, dan source EA belum diunggah ke repository. Dua file asli yang
akan diberikan untuk audit adalah `CEBONK_NEWS_ASTROLOGY_BBMA_v1.24_DRAFT(1).txt`
dan `CEBONK_BBMA_4MOMEN_v1.30_GITHUB_RAW(1).mq5`. Audit kontrak JSON menunggu
lampiran tersebut; source strategi tidak perlu dipublikasikan untuk audit ini.

EA news yang ada di repository justru membaca `news_windows.csv` dengan parser
11 kolom; EA weekly v2.12 membaca `weekly_aspects.csv` dengan parser 8 kolom.
Keduanya tidak cukup untuk membuktikan format JSON bagi dua EA yang dimaksud.

Generator news yang tersedia memakai kalender snapshot website bertanggal
`2026-10-04` (`WEBSITE_SNAPSHOT_NOT_LIVE`), bukan kalender berita resmi yang
bergulir otomatis. Jadwal generator tidak membuat kalender itu otomatis mutakhir.
Generator weekly menghasilkan minggu `2026-10-19`, arah `CAMPURAN`, nol window,
dan `NO_TRADE`; tidak dipaksa menjadi BUY atau SELL.

Workflow news dan weekly tetap active dan tidak diubah. Eksekusi terjadwal
terakhir yang diperiksa berhasil:

- [News: 19 Oktober 2026, 01:05:59](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/actions/runs/39183744851).
- [Weekly: 18 Oktober 2026, 20:38:22](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/actions/runs/39164203110).

Keberhasilan workflow tersebut bukan bukti publikasi otomatis dua feed yang
hilang. Untuk dua endpoint yang diminta, otomatisasi belum dapat diverifikasi.

## Pengujian

- Seluruh 25 YAML workflow di `main` berhasil diparse setelah perubahan.
  Perbandingan struktur sebelum/sesudah membuktikan bahwa pada setiap workflow
  hanya satu izin Pages dan satu langkah rebuild yang dihapus. Tidak tersisa
  izin Pages write, permintaan build Pages, atau action deployment Pages dalam
  workflow pada branch PR.
- `git diff --check` lulus. File website, EA, preset, generator, dan data identik
  dengan commit dasar.
- Dua generator yang tersedia dijalankan dengan `astronomy-engine@2.1.19` di
  worktree validasi terpisah. Output news dan weekly identik dengan data di
  commit dasar dan lulus validator masing-masing; tidak dipublikasikan ulang.
- Dari 13 perintah generator/validasi/regresi lokal, 12 lulus. Rincian perintah
  dan exit code tersimpan dalam JSON pendamping.
- Satu kegagalan sudah ada pada commit dasar: `node tests/astro-candles.integration.cjs`,
  baris 8, mengharapkan teks `Astrologi harian &amp; Al-Biruni` dalam `index.html`.
  Tes ini dijalankan pada worktree commit dasar dengan file website tidak diubah.
  Tidak ada perbaikan UI/test di PR ini karena di luar lingkup tugas.
- Terminal MT5 yang sedang berjalan dan MetaEditor tidak tersedia pada sesi ini;
  keberhasilan WebRequest serta penerimaan payload oleh kedua EA aktif belum
  dapat diuji langsung.

CI PR telah selesai pada commit kode `0513f23d35748a61fefd0f849ffe5f0aa8b0c03c`:

| Workflow CI | Hasil | Bukti |
| --- | --- | --- |
| Astrology H1 H4 candle summaries | Gagal pada assertion header website lama, sama dengan baseline | [run 39272577983](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/actions/runs/39272577983) |
| Astrology daily whipsaw news brief | Gagal pada assertion header website lama yang sama | [run 39272577958](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/actions/runs/39272577958) |
| Web wallpaper glass skin | Lulus | [run 39272577990](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/actions/runs/39272577990) |

Log kedua job yang gagal mengonfirmasi `astro-candles.integration.cjs:8` dengan
pesan `Astrology view and inputs must remain present after header simplification`.
Commit sesudah hasil CI hanya memperbarui laporan/bukti; workflow dan source
yang diuji tidak berubah. Tidak ada klaim bahwa seluruh pengujian lulus.

## Langkah pemilik repository

1. Buka [repository → Settings → Pages](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/settings/pages).
2. Pada **Build and deployment**, konfigurasi yang teramati adalah
   **Source: Deploy from a branch**, **Branch: main**, folder **/(root)**.
   Buka dropdown **Branch**, pilih **None**, lalu klik **Save**.
   Jika Source sudah berubah menjadi **GitHub Actions**, pilih
   **Deploy from a branch**, kemudian **Branch: None**, lalu **Save**.
   Tindakan **Unpublish site** saja tidak menggantikan penonaktifan sumber.
3. Biarkan workflow feed tetap enabled. Jika muncul run Pages yang masih berjalan,
   buka **Actions → pages build and deployment → run aktif → Cancel workflow**.
4. Verifikasi pengaturan tersimpan tanpa sumber publikasi; uji ulang GET Pages
   root, `/index.html`, dan URL yang sebelumnya masih dapat dibuka dari sesi
   publik baru. Konfirmasi tidak ada deployment Pages baru setelahnya.
5. Setelah kedua file EA asli tersedia dalam sesi audit, periksa parser dan
   validatornya sebelum membuat generator kedua JSON. Tidak perlu mengunggah
   source strategi ke repository public. Kedua RAW harus mencapai HTTP 200,
   JSON valid, lolos validator EA masing-masing, serta lolos pemeriksaan
   timestamp/masa berlaku dan WebRequest terminal sebelum dinyatakan pulih.

## Masalah yang masih terbuka

- Pages belum dimatikan secara permanen: pengaturan masih `main /`, akses admin
  diperlukan, dan PR belum di-merge.
- Kedua endpoint RAW yang diminta HTTP 404; source EA, validator, dan generator
  yang cocok belum tersedia. Belum ada jaminan kelangsungan dua EA aktif.
- URL situs yang masih dapat dibuka oleh pemilik belum diberikan; URL bawaan
  yang diaudit HTTP 404 dan tidak memiliki custom domain dalam konfigurasi API.
- Sebagian EA lama di `ea/combined2`, `ea/bbma_web`, dan
  `ea/liquidity_sweep/src` mempunyai URL default ke Pages. Belum diketahui apakah
  versi tersebut yang sedang berjalan. Penonaktifan Pages juga menghilangkan
  endpoint data yang disajikan dari Pages; jangan menganggap semua EA memakai RAW.
- Satu tes integrasi lama gagal secara lokal dan pada dua workflow CI PR.
  Kegagalan tetap terbuka; PR tetap draft dan tidak di-merge.
- Kebijakan Actions dan webhooks tingkat admin tidak dapat diaudit dengan izin
  yang tersedia. Tidak ada klaim bahwa proses eksternal telah seluruhnya diperiksa.
- Source tetap terbuka di repository public. Pemisahan feed publik yang telah
  teruji belum tersedia; repository tidak dijadikan Private.

Tugas belum memenuhi kriteria akhir sampai konfigurasi Pages benar-benar
nonaktif dan kedua endpoint RAW yang diminta mencapai 200 serta lolos validator.
