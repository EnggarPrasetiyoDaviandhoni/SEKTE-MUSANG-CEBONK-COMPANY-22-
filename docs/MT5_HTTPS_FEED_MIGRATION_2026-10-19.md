# Pemisahan feed HTTPS MT5 dari source privat

**Status: kedua feed staging dan publikasi lewat GitHub Actions terverifikasi.
Produksi, cron di default branch dan WebRequest terminal MT5 belum terverifikasi.**
Token dan variabel yang disimpan pemilik berhasil digunakan. Job news serta
empat momen sama-sama lulus, lalu memperbarui dua JSON di `CEBONK-MT5-FEEDS/staging`.
`main` repository feed tetap berisi README. URL EA dan visibilitas repository
asal belum diubah; PR source #81 dan PR feed #1 tetap draft dan belum di-merge.

**Pembaruan Pages, 19 Oktober 2026 19:51 UTC:** pemilik telah menyimpan
`Branch: None`. Tangkapan pengaturan menunjukkan **GitHub Pages is currently
disabled**. GET anonim ke URL website dan `index.html` menghasilkan HTTP 404;
API Pages juga menghasilkan 404. Kedua endpoint RAW EA lama masih HTTP 404.
Penonaktifan website terverifikasi; pemulihan feed belum selesai.

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
- `sync_calendar.py`: workflow memilih `--labor-calendar nyfed` secara eksplisit.
  Jadwal NFP/CPI/PPI diambil dari [kalender resmi New York Fed](https://www.newyorkfed.org/research/calendars/i-oct26.html)
  yang mencantumkan tanggal, jam Eastern Time dan tautan BLS; BEA serta Federal
  Reserve tetap memakai kalender masing-masing. Enam jadwal Oktober–November
  telah dibandingkan dengan BLS langsung dan semuanya identik, termasuk DST.
  Mode BLS langsung tetap tersedia untuk audit; tidak ada pergantian sumber
  otomatis atau fallback kalender lama. Cakupan bergulir maksimum
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
  jam di `main`, serta manual staging/production. Push ke branch pekerjaan yang
  dipercaya juga menjalankan pengujian dan hanya dapat menerbitkan ke `staging`,
  sehingga pengujian sebelum merge tidak bergantung pada registrasi workflow
  baru di default branch. Masa berlaku publikasi 36 jam.
  Job news dan momen berjalan terpisah; kegagalan kalender news tidak membatalkan
  job momen. Tidak ada deployment atau izin GitHub Pages.
- Token source hanya `contents: read`. Publikasi menggunakan token terpisah
  dengan Contents read/write khusus repository feed. Destinasi harus Public,
  terpisah dari source, memiliki default branch `main`, dan Pages nonaktif.
  Publisher hanya menulis satu file JSON yang lolos validasi; EA/source tidak disalin.
  Sesudah push, GET HTTPS anonim harus 200, bytes identik, dan validator harus lulus.

## Hasil pengujian

- 12 tes Python: kontrak ketat, masa berlaku, identitas, kalender resmi, DST,
  penolakan perubahan layout/tanggal yang belum bisa dipastikan, serta penolakan
  membuat kalender kosong ketika sumber resmi mengembalikan HTTP 403.
- 6 tes Node dengan ephemeris asli: kesamaan waktu fase, bias, window entry,
  ID yang stabil, kesamaan sinyal antar-transport kalender, kegagalan sumber
  dan penolakan perubahan model.
- 12 kombinasi event/ref/flag/input menguji ekspresi workflow yang sebenarnya:
  PR dan branch tak dipercaya tidak boleh publish; branch pekerjaan hanya
  staging; production hanya dari source `main` dengan flag publikasi aktif.
- 52 kasus positif/negatif membandingkan validator Python dengan parser JSON,
  `DecodeFeed()` dan `FeedAvailable()` yang diekstrak dari EA asli. Semuanya lulus.
  Harness hanya mengganti dukungan string/array/waktu MQL menjadi padanan C++;
  source EA asli tidak diubah dan tidak dipublikasikan.
- Payload nyata pada 19 Oktober 2026 berisi 4 window news dan 9 konteks momen.
  Jumlah berubah mengikuti kalender dan cakupan; tidak dipaksa memiliki BUY/SELL.
- Lima halaman kalender primer (BLS/Fed dua bulan dan BEA) memberi HTTP 200.
  Kalender hasil unduhan harus baru diperiksa, maksimum satu jam sebelum generasi.
- Snapshot source website, generator lama, EA dan data lama pada branch pekerjaan
  tetap identik dengan base commit `f5daccf`. PR tidak mengubah file tersebut;
  update Al-Biruni di `main` dijalankan oleh workflow lama secara terpisah.

Bukti terstruktur ada di [MT5_HTTPS_FEED_VERIFICATION_2026-10-19.json](MT5_HTTPS_FEED_VERIFICATION_2026-10-19.json).
Harness C++ tidak menggantikan kompilasi MetaEditor atau WebRequest terminal live.
Publikasi melalui Actions ke staging sudah teruji seperti dicatat di bawah.
Publikasi produksi, cron default branch dan terminal MT5 masih belum teruji.

### Hasil terbaru: publikasi kedua feed lewat Actions

- Source commit `8983687450907df2e425d07a0072ae82b059c5b4` lulus
  [run push 39335344228](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/actions/runs/39335344228)
  dan [run PR 39335351166](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/actions/runs/39335351166).
  Job `checks`, `feed (news)` dan `feed (moments)` semuanya **success**.
- Pada run push, kedua job berhasil memakai secret, memeriksa destinasi Public
  dengan Pages nonaktif, push file yang tervalidasi ke `staging`, kemudian
  membandingkan GET anonim dengan bytes build memakai `cmp` dan validator.
  Run PR hanya memvalidasi, tanpa mempublikasikan data.
- Staging pada `f43c780de22b61b7f4e98a1649e540c0359ac442` memberi HTTP 200
  dari kedua URL kanonis pada 22:31 UTC. Payload berisi 4 window news dan 9
  konteks momen. Seluruh arah, waktu, ID dan isi sinyal identik dengan publikasi
  sebelumnya; hanya header publikasi/provenance diperbarui.
- RAW yang diunduh diuji ulang dengan validator ketat serta 52 kasus parser
  asli EA; semuanya lulus. Ini tetap harness C++, bukan terminal MT5.
- Akses kalender NY Fed Oktober/November dari runner telah dibuktikan HTTP 200
  pada [run diagnostik 39334928562](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/actions/runs/39334928562).
  Kalender langsung BLS tetap HTTP 403; workflow memakai transport NY Fed yang
  sudah dibandingkan, dengan provenance yang menyebut provider sebenarnya.
- Unduhan artifact langsung dari workspace ditolak storage HTTP 403.
  Verifikasi bytes tetap dibuktikan oleh langkah `cmp` pada runner dan
  pemeriksaan RAW/parser secara terpisah; tidak ada nilai token yang dibaca.
- Source `main` maju sendiri ke `f6f3efc` melalui workflow Al-Biruni lama
  (`github-actions[bot]`, hanya enam file data intraday). Codex tidak menulis
  `main` atau `mt5-feed`; branch `mt5-feed` tetap `f5daccf`. Setelah perubahan
  main tersebut, Pages tetap nonaktif dan URL website tetap HTTP 404.

### Uji awal staging pada repository publik baru

- Repository `EnggarPrasetiyoDaviandhoni/CEBONK-MT5-FEEDS` terverifikasi Public,
  default branch `main`, Pages nonaktif. Akses tulis berhasil, dan source EA tidak
  disalin. Branch `main` tetap pada initial commit README `453df58`.
- Branch `staging`, commit `1fbee30`, hanya menambahkan dua file `data/*.json`.
  [Draft PR feed #1](https://github.com/EnggarPrasetiyoDaviandhoni/CEBONK-MT5-FEEDS/pull/1)
  menyediakan hasil yang dapat direview, tanpa merge.
- Kalender primer diunduh ulang: 7 event pada cakupan aktif dari 5 halaman resmi.
  Payload dibuat oleh source commit `597c6b3`, berisi 4 window news dan 9 konteks
  momen; pembandingan dengan preview sebelumnya mempertahankan identitas window.
- 52 kasus parser asli diulang terhadap payload baru dan semuanya lulus.
- GET anonim pada 19 Oktober 2026 20:05 UTC memberi **HTTP 200**, JSON valid,
  serta byte/hash identik untuk kedua URL staging berikut. Masa berlaku payload
  36 jam; hasil ini membuktikan publikasi manual, bukan pembaruan cron.

```text
https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/CEBONK-MT5-FEEDS/staging/data/news-astrology-mt5.json
https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/CEBONK-MT5-FEEDS/staging/data/astro-4momen-mt5.json
```

Kedua URL staging belum boleh menggantikan URL EA live sebelum otomatisasi dan
terminal MT5 diuji. URL produksi memakai branch `main` dan belum tersedia.

PR implementasi: [draft #81](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/pull/81),
belum di-merge. CI awal pada commit `89e34a7` lulus job `checks` dan
`feed (moments)`. Job `feed (news)` gagal saat sumber kalender resmi menolak
permintaan GitHub Actions dengan HTTP 403, meskipun unduhan dari lingkungan
audit sebelumnya berhasil. Generator menghentikan publikasi; tidak ada kalender
cadangan, feed kosong, atau sinyal pengganti. Status CI ini belum memenuhi
syarat publikasi news atau merge pada waktu itu. Kendala tersebut sudah ditangani
dengan transport kalender resmi New York Fed dan uji Actions terbaru di atas.

Diagnostik jaringan terpisah pada
[run 39316417839](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/actions/runs/39316417839)
membuktikan halaman HTML **dan** kalender iCalendar resmi BLS sama-sama HTTP 403
dari runner GitHub, sedangkan Fed dan BEA HTTP 200. Probe tidak menerbitkan data.
Tidak digunakan proxy pihak ketiga atau penanggalan hasil tebakan. Workflow
diagnostik sementara sudah dihapus setelah hasil dicatat.

## Konfigurasi yang perlu dilakukan pemilik

Langkah 1–4 sudah dilakukan pemilik dan credential berhasil dipakai pada Actions.
Tidak perlu membuat ulang token. Pemeriksaan Settings langsung oleh integrasi
tetap dibatasi HTTP 403; hasil runtime membuktikan konfigurasi efektif.

1. Repository `EnggarPrasetiyoDaviandhoni/CEBONK-MT5-FEEDS` **sudah dibuat**
   pemilik sebagai Public dengan README, default branch `main`, Pages nonaktif.
   Akses Codex dan publikasi dua JSON ke `staging` sudah berhasil. Pertahankan
   repository ini sebagai distribusi data publik, tanpa source EA.
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
5. Sebelum merge, buka **Actions → MT5 isolated public HTTPS feeds**, pilih run
   dengan event **push** dari branch `codex/isolated-mt5-https-feeds-20261019`,
   lalu **Re-run all jobs** setelah konfigurasi siap. Push branch ini selalu
   mengarah ke `staging`; flag publikasi dan token target tetap wajib.
   Workflow membuat branch data `staging` bila perlu dan memeriksa endpointnya.
   Publikasi `main` hanya diizinkan dari source `main`. Lengkapi pemeriksaan
   HTTP serta decoder pada staging sebelum review/merge perubahan kode.
   Uji staging melalui Actions sudah lulus; verifikasi terminal MT5 masih menunggu.
6. Pada repository asal, **Settings → Pages → Build and deployment → Branch:
   None → Save** sudah dilakukan pemilik dan diverifikasi. Pertahankan pengaturan
   ini. [PR #80](https://github.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/pull/80)
   untuk menghapus permintaan build Pages dari workflow lama masih terpisah dan
   belum di-merge.
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
4. Periksa panel/Experts: HTTP 200, status **FEED OK**, revisi dan masa berlaku benar,
   serta tidak ada `FEED_INVALID`, rollback, mutasi ID atau penggantian slot.
   Jika ada cache/journal dari penerbit lama, audit payload lamanya sebelum pindah;
   identitas sinyal penerbit lama belum tersedia untuk dibandingkan pada sesi ini.
5. Pastikan pembaruan terjadwal berikutnya tetap diterima dengan ID sinyal sama,
   dan posisi/Early Exit berjalan sesuai pengaturan semula.
6. Sesudah verifikasi EA, repository source asal dapat diubah menjadi Private oleh
   pemilik. Repository feed tetap Public. Token publikasi tetap disimpan hanya
   sebagai secret di source; tidak dimasukkan dalam URL atau JSON.

## Masalah yang belum selesai

- Pemilik telah membuat repository, secret dan variabel; publikasi staging kedua
  job sudah lulus. Akses Settings langsung oleh integrasi tetap terbatas, tetapi
  tidak lagi menghalangi pengujian credential melalui workflow.
- Dua URL RAW lama masih 404 pada pemeriksaan 22:32 UTC. Source tetap Public,
  Codex tidak menulis `main` atau `mt5-feed`, dan dua EA asli tetap lokal.
- Pemilik telah menonaktifkan Pages dan URL website terverifikasi 404. PR #80
  yang menghapus pemicu build lama masih perlu review; perubahan visibilitas
  source tetap menunggu feed publik dan terminal MT5 teruji.
- Dua endpoint staging sudah HTTP 200 dan diperbarui lewat Actions. Produksi
  `main` masih belum diterbitkan, dan cron setiap enam jam belum aktif karena
  workflow masih berada di branch PR. Semua PR tetap draft dan belum di-merge.
- BLS langsung ditolak runner, tetapi transport resmi NY Fed sudah lulus dan
  menghasilkan jadwal/sinyal yang sama. Semua sumber dapat mengubah layout atau
  jadwal; parser tetap berhenti jika data tidak lengkap atau ambigu.
- Tidak tersedia terminal live MT5 untuk menguji WebRequest, broker/account,
  journal sebelumnya atau posisi yang sedang berjalan.
- Kalender resmi bisa mengubah layout atau membatalkan jadwal. Generator berhenti
  bila sumber tidak dapat dipastikan; saat payload kedaluwarsa EA menahan entry
  baru sesuai kode aslinya. GitHub Actions juga tidak menjamin jam cron tepat.

Tugas belum memenuhi kriteria akhir sebelum HTTPS publik, otomatisasi, kedua EA,
Pages dan pemisahan visibilitas benar-benar diverifikasi.
