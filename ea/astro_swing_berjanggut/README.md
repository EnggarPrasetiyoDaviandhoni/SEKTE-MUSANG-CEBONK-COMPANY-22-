# CEBONK ASTRO SWING BERJANGGUT v1.11 — MT5

EA XAUUSD Swing: **weekly direction lock**, alignment **weekly + Killzone Astrology** tanpa daily atau fase AWAL/INTI/AKHIR, **Fibo Musang EL2 saja pada M5**, SL Fibonacci dapat diatur (default −0.236), dan TP liquidity ICT.

Paket berisi **source `.mq5` / `.mqh`**. MetaEditor **NOT_COMPILED**, Strategy Tester dan broker demo/live **NOT_RUN**. Tidak ada `.ex5`; tes host bukan kompilasi MT5.

## Aturan v1.11

- Arah pertama dari feed valid untuk minggu berjalan disimpan sampai **Senin 00:00 WIB berikutnya**. BUY ONLY, SELL ONLY, atau WAIT. Restart, perubahan daily/session dan pembaruan feed tidak dapat membalik lock itu. Saat dipasang di tengah minggu, keputusan pertama saat pemasangan menjadi lock sisa minggu tersebut.
- Weekly dan Killzone Astrology harus searah. Weekly BUY + Killzone BUY + ICT BUY + EL2 BUY = boleh entry setelah seluruh validasi. Daily SELL/CAMPURAN tidak memblok. Killzone berlawanan/WAIT tetap WAIT. Gunakan seluruh rentang sesi `[session_start, session_end)`; AWAL, INTI, AKHIR dan best-window/core tidak dipakai sebagai pembatas entry.
- Weekly sumber CAMPURAN diselesaikan oleh kekuatan skor BUY/SELL **7 hari penuh Senin–Minggu, 00:00–24:00 WIB**, interval 5 menit. Kekuatan = jumlah `abs(score) × 5 menit` pada slot directional. Default minimum **55% kekuatan** dan **360 menit directional**. Imbang/lemah = WAIT sepanjang minggu. Ambang ini keputusan engineering yang tercantum di feed, bukan ukuran win rate.
- ICT tetap wajib: IPDA D1 20/40/60 closed, struktur H4, H1 sweep/MSS atau BOS, retest M15, kemudian EL2 M5.
- **EL2:** Initial Break closed → pivot CB1 baru dan terkonfirmasi → break CB1 closed → retest/rejection Zone IB → entry pada tick bar M5 berikutnya, maksimal 30 detik. Tidak ada entry pada candle break atau alternatif CBR dominan/SR.
- Maksimal **4 layer total**, tanpa kuota fase. Satu konfirmasi dapat mengirim maksimal dua layer seperti batch sebelumnya; penambahan berikutnya wajib H1/M15/EL2 baru dan tetap searah weekly. Dapat terjadi pada Killzone searah berikutnya. Satu basket global; SL/TP awal tetap dipakai.
- **SL = fib0 + InpSLFibLevel × (fib1 − fib0)**. EL2 fib0: BUY batas body atas Zone IB, SELL batas body bawah; fib1 close pemecah CB1. Default −0.236. SL wajib di luar zona dan memenuhi broker. TP ICT terdekat, **RR minimal 1:2**, risiko basket maksimal 1%.
- Minggu berganti **tidak menutup posisi lama**. Basket lama memakai SL/TP awal dan menghalangi basket baru sampai flat. Tambahan yang berlawanan dengan lock baru tidak diizinkan.
- Cut profit hanya Dominant Break M15 berlawanan + **NET seluruh basket > 0**: semua realized P/L layer yang sudah closed/partial, actual swap/commission/fee + floating posisi tersisa + swap terbuka − estimasi biaya exit tersisa. Contoh −100 +20 tidak menjadi profit.
- Order ditolak secara pasti mengembalikan reservasi layer dan tidak menghabiskan window jika belum ada fill. Fill menghabiskan window; timeout/status tidak pasti tetap pending sampai order/deal yang tepat terkonfirmasi. Tidak ada retry buta.

## Pasang

1. MT5 → **File → Open Data Folder**. Salin isi `MQL5` paket ke `MQL5` terminal.
2. Compile `Experts/CEBONK_ASTRO_SWING_BERJANGGUT_v1.11.mq5` dengan MetaEditor F7. Helper `scripts/compile-swing.ps1` memeriksa log nol error dan EX5 baru.
3. Attach pada chart XAUUSD sesuai suffix broker. Isi `InpCommissionPerLotPerSide` sesuai biaya akun; −1 berarti belum diketahui dan memblok order/cut profit yang membutuhkan verifikasi biaya. 0 hanya untuk akun tanpa komisi.
4. **Tools → Options → Expert Advisors → Allow WebRequest:** tambahkan **`https://raw.githubusercontent.com`**. URL file lengkap bawaan:

   `https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/cebonk-astro-swing-feed-v2/forecast.json`

5. Tunggu feed/clock valid. Entry live selalu **AUTOPILOT OFF** saat attach/restart. Tombol chart mengizinkan entry baru. Posisi lama tetap dikelola sesuai konfigurasi exit.

IPDA D1 20/40/60 tetap dihitung untuk konteks dan peta target ICT. Notifikasi default menampilkan range 40; DISCOUNT/PREMIUM bukan gate wajib entry. Tidak ada filter daily atau IPDA premium/discount tambahan.

## Atur SL sendiri

**EA Properties → Inputs → `InpSLFibLevel`**. Contoh `-0.236`, `-0.382`, `-0.618`. Angka ini level Fibonacci. Hanya nilai negatif terhingga diterima. Perubahan berlaku untuk basket baru; SL/TP basket aktif tidak dihitung ulang. RR dan risiko diperiksa dengan stop yang benar-benar diajukan.

Simpan file Common Files `CSB_...json` dan `CSB_..._weekly.json` ketika restart/memindah terminal. State basket v1/v2/v3 dibaca dan dimigrasikan ke v4; counter lama dijumlahkan menjadi total layer tanpa mengubah SL/TP basket. Jangan menjalankan EA versi lama bersamaan.

## Notifikasi sesuai template

Kartu tiap fill mengikuti format emoji **CEBONK COMPANY 22**: weekly/session, ICT, IPDA, BBMA, EL2, lot/entry/SL/TP/RR, cut profit, layer dan AUTOPILOT. Data order diambil dari fill terkonfirmasi. BBMA ditulis **TIDAK DIGUNAKAN** karena tidak ada filter BBMA pada EA ini. Telegram menerima kartu utuh; MT5 Push membaginya menjadi beberapa bagian berurutan agar seluruh isi lolos batas 255 karakter. Aktifkan `InpTelegramEnabled`/`InpPushEnabled` beserta konfigurasi terminal yang sesuai. Rincian ada di `docs/NOTIFIKASI.md`.

Rincian dan status publikasi ada di `docs/` dan `evidence/`. Astrologi belum terbukti menghasilkan keuntungan melalui hasil tester/broker dalam paket ini.
