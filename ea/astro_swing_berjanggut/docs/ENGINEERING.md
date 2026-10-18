# Pemetaan aturan dan keputusan implementasi

Dasar: PRD v1.07, kemudian instruksi pengguna “M5 ne gae Iki AE SL tetep -0.236” dengan **FIBO MUSANG BERJANGGUT.pdf**, 21 halaman, Mohd Zulkifli Mohd Din, 6/7/2014. Instruksi ini mengganti M5 EL2/CB1 lama, sementara gate D1/H4/H1/M15 dan pengelolaan basket tetap mengikuti PRD. Instruksi berikutnya “ISO diatur Dewe” mengizinkan level SL menjadi input pengguna pada v1.09, dengan default tetap −0.236.

## M5 Berjanggut

Halaman 2–4: Initial Break / Candle Break and Retest, tunggu harga kembali ke kotak IB. Halaman 9–14: pecah dominan candle. Halaman 15–19: bila tidak ada dominan, pecah S/R terdekat. Halaman 20: jangan mengejar candle; area IB yang dipatahkan melawan arah membatalkan setup.

PDF tidak memberi seluruh ambang detektor numerik. Berikut **keputusan otomatisasi**, bukan angka yang diklaim tertulis dalam PDF:

| Bagian | Definisi dalam kode |
|---|---|
| Candle | OHLC closed M5 berurutan; running bar tidak dimasukkan |
| Dominan | Mother dengan body bukan nol dan 3–12 anak default; wick anak berada dalam full high/low mother. Input minimum dapat 1–12; maksimum ≤12. Mother berwarna lawan arah break |
| Candle Musang | Close directional ≥1 tick melewati sisi body mother searah entry; anak sebelumnya belum lebih dulu close melewati sisi itu |
| Kontrol dominan | S/R fallback diblok jika masih ada mother yang menguasai anak dalam lookback, termasuk mother dengan anak melebihi batas pola entry |
| Alternatif S/R | Pivot strict left2/right2 yang sudah confirmed sebelum break; pilih resistance/support unbroken paling dekat dalam arah break, lookback 96 closed M5 default |
| Sumber IB alternatif S/R | Pivot berlawanan terakhir yang sudah confirmed, candle-nya berwarna lawan entry; body candle itu menjadi kotak IB |
| Kotak IB | `[min(Open,Close), max(Open,Close)]` candle sumber; berbeda dari kotak wick-to-body EL2 lama |
| Fib0 | BUY = batas bawah body sumber IB; SELL = batas atas. Mengikuti penarikan dari bottom/top sumber baru |
| Fib1 | Harga **close candle Musang** pemecah dominan/S/R, bukan wick, garis S/R, atau close retest |
| Stop | `fib0 + InpSLFibLevel*(fib1-fib0)`, default −0.236; input negatif dan terhingga; span searah dan ≥2 tick; BUY floor tick / SELL ceil tick; harga SL positif, di luar IB, dan lolos broker |
| Retest | Candle sesudah break menyentuh IB, directional searah entry, dan belum ada close yang mematahkan sisi risiko IB. Ambil retest sah pertama; tidak wajib close di luar kotak seperti EL2 lama |
| Eksekusi | Tick pertama yang diterima EA pada bar M5 berikutnya, maksimal 30 detik sesudah retest close. Ask BUY / Bid SELL wajib masih di dalam IB; jika harga sudah pergi, skip |
| Umur | Break maksimal 16 closed M5 sesudah gate M15; retest maksimal 12 closed M5 sesudah break; eksekusi harus sebelum akhir window/fase yang mengizinkan layer dan expiry feed |

Initial Break dan candle Musang boleh merupakan satu peristiwa jika struktur demikian; tidak ada kewajiban pivot CB1 baru setelah IB. Tidak menambahkan AO, BBMA, EMA, ATR atau entry EL1/EL3–EL9.

Target 261/423 dalam bahan sumber digunakan untuk memahami ilustrasi siklus. **TP proyek tetap ICT**. Penarikan body-ke-ekor yang disebut materi tidak dipakai untuk menggeser SL basket terbuka.

`InpSLFibLevel` hanya membentuk kandidat stop baru melalui `CSM5CBR` → `CSSL`. Saat basket sudah aktif, entry tambahan dan proteksi posisi tetap menggunakan `state.sl`/`state.tp`, bukan menghitung ulang anchor lama dengan input baru. Format state dan identitas basket tidak berubah, sehingga harga stop yang disimpan v1.08 tetap dipakai saat dibuka oleh v1.09. Panel membedakan level untuk basket baru dari harga SL basket aktif; notifikasi order menampilkan harga stop yang benar-benar diajukan. RR dan risiko dihitung ulang memakai harga stop yang akan dipakai order.

## Gate dan konteks lain

H4 pivot 3/3, H1 2/2, D1 target pivot 3/3 (pilihan kuantitatif untuk target D1 yang tidak dirinci sumber). Model A diprioritaskan; H4 RANGE mengizinkan A saja. Semua pivot diperiksa menurut saat konfirmasinya. H1 displacement: body ≥60% range dan range ≥median 20 candle sebelumnya; FVG tiga candle dengan OB fallback. M15 memakai retest valid pertama, maksimal 32 bar sesudah zona lahir; retest lama tidak dibeli ulang.

Target external adalah PDH/PDL terakhir, confirmed H4/D1, completed prior week, dan IPDA 20/40/60. H1/session liquidity lebih dekat juga diperiksa sebagai barrier RR. Target consumed dibuang; dedup maksimum 2 tick mempertahankan mask sumber. Map IPDA dihitung dari OHLC closed, bukan order flow bank.

`trend.best.core` dari source asli dapat **sama dengan start**. Dalam kasus itu AWAL kosong dan INTI boleh memulai maksimal 2 layer; waktu core tidak digeser. Ini mempertahankan matematika source, menyelesaikan ketidaksamaan ketat pada contoh kontrak JSON lama.

Ranking lunar memakai `CebonkDailySwingCore.make` dan mode broker AUTO bawaan situs pada 00:00. Itu estimasi observasi untuk anotasi; clock eksekusi MT5 tidak memakai estimasi browser tersebut. Panel menampilkan sampel lunar astronomis terakhir beserta waktu observasinya, bukan mengklaim snapshot real-time baru.

## Biaya, order dan restart

`InpCommissionPerLotPerSide` adalah estimasi konservatif biaya per lot per sisi dalam mata uang akun. Gunakan sekurang-kurangnya biaya maksimum suatu sisi jika broker membebankan komisi sekaligus. History deals menyumbang komisi/fee/swap/profit yang sudah tercatat; estimasi exit ditambahkan untuk NET basket dan risiko. Biaya akun yang tidak tercermin atau tidak dapat diperkirakan harus ditangani sebagai belum terverifikasi.

Risk dihitung ulang per layer dengan `OrderCalcProfit`, margin, `OrderCheck`, quote baru, stop/freeze-level dan RR. Order selalu membawa SL/TP. Partial fill dan retcode direkonsiliasi lewat posisi/deal, bukan dianggap sukses dari boolean request saja. Fill yang melanggar batas risiko atau posisi tanpa perlindungan memicu tindakan fail-safe atas posisi EA yang teridentifikasi.

Order intent, window spent, signal id, anchor, SL/TP, layer counter, position identifiers dan exit pending disimpan atomik sebelum request. Hasil request tidak pasti memblok retry entry. Ada lock satu instance per account/magic. Netting dengan deal manual/EA lain pada position identifier yang sama diblok, termasuk manajemen close agar tidak mengambil alih posisi itu.

Restart live selalu OFF untuk entry. Basket normal dipulihkan dari state dan history. Jika state hilang dan hanya posisi/comment yang dapat dipulihkan, server SL/TP dijaga; tambahan layer dan cut profit yang NET-nya tidak dapat dipastikan diblok. State rusak tidak ditimpa dengan state kosong.

Exit M15 tidak memerlukan feed/Astro/window baru. NET >0 dikunci sebelum close pertama, kemudian seluruh ticket EA dicoba dengan retry terbatas umur signal sampai close M15 berikutnya. Order close memakai ticket dan dibatasi minimal 10 detik antar batch; SL/TP asli tetap ada. Candle historis saat attach/restart tidak diperlakukan sebagai signal baru.

Profit layer yang sudah ditutup tidak dipakai untuk menjadikan floating NET posisi tersisa tampak positif. Perhitungan floating dan laporan NET realized dipisahkan. Tindakan fail-safe karena stop tidak dapat dipulihkan atau risiko fill melampaui batas memiliki intent persisten tersendiri dan retry sampai flat; ini perlindungan order, dapat merealisasikan rugi, dan tidak dilabeli cut profit.
