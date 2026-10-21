# Notifikasi MT5 dan Telegram — v1.12

Kartu entry mengikuti format CEBONK COMPANY 22 yang diminta pengguna. Contoh dalam `evidence/notification-example.txt` memakai harga fiktif dari contoh pengguna dan dihasilkan oleh tes; itu bukan transaksi atau sinyal pasar.

## Data yang ditampilkan

- Kartu dikirim **sesudah entry deal broker terkonfirmasi**, per layer. Request ditolak atau belum pasti diberi pesan status sendiri, tanpa mengklaim entry sudah terjadi.
- BUY/SELL dan nama simbol mengikuti basket serta simbol broker, termasuk suffix. Lot dan harga entry berasal dari matching history deals; jika beberapa fill sudah tersedia, harga memakai rata-rata tertimbang volume. Fill parsial tidak dibulatkan menjadi lot request. Satu kartu pertama per layer; jika masih ada remainder aktif, order tetap pending.
- SL/TP adalah harga asli basket yang disimpan/diajukan. Request baru memberi label **TP ICT H4**; konteks notifikasi v1 lama tidak dilabeli H4 tanpa bukti. RR dihitung dengan harga fill nyata dan harga SL/TP tersebut, bukan angka contoh yang tetap.
- Weekly adalah lock pada saat request; sesi berasal dari window owner. ICT Model A = Sweep + MSS + Retest; Model B = BOS + Retest. Tidak menulis Model A untuk setup continuation.
- Zona IPDA adalah range yang memenuhi filter AUTO OR pada quote terakhir sebelum request: 20/40/60, prioritas pelaporan 20→40→60 bila lebih dari satu cocok. Harga fill aktual dipakai menghitung DISCOUNT/PREMIUM/EQUILIBRIUM/di luar range. Jika slippage mengubah sisi midpoint, notifikasi melaporkan klasifikasi fill secara jujur. Input display-only IPDA40 lama dihapus.
- **BBMA: TIDAK DIGUNAKAN**, karena EA ini tidak menghitung/menggunakan filter BBMA. Tulisan BBMA pada judul mengikuti template; tidak mengklaim ada sinyal BUY/SELL BBMA.
- Musang selalu EL2 M5 untuk request versi ini. Cut Profit menampilkan Dominant Break M15 kontra posisi dan syarat NET basket >0, atau OFF sesuai pengaturan. Itu rencana exit, bukan pengakuan bahwa basket telah ditutup.
- Layer ditampilkan 1/4 sampai 4/4. AUTOPILOT dan enable cut profit mengikuti status EA saat konfirmasi diproses. Setelah restart live, AUTOPILOT OFF tetap ditampilkan OFF.

## Aktifkan kanal

Telegram: set `InpTelegramEnabled=true`, isi `InpTelegramBotToken` dan `InpTelegramChatId` secara lokal. Tambahkan `https://api.telegram.org` pada **Tools → Options → Expert Advisors → Allow WebRequest**. Telegram menerima satu pesan lengkap. WebRequest feed tetap `https://raw.githubusercontent.com`.

MT5: aktifkan **Tools → Options → Notifications**, isi MetaQuotes ID perangkat, lalu set `InpPushEnabled=true`. Batas `SendNotification` 255 karakter: kartu panjang dibagi menjadi bagian `CEBONK [1/3]`, `[2/3]`, dan seterusnya, maksimum satu push per 10 detik. Tidak memotong emoji atau membuang baris akhir. Event pendek tetap satu push.

Outbox menyimpan cursor bagian push dan status Telegram per event. Restart melanjutkan bagian yang belum berhasil; kegagalan transport memakai backoff. Seperti API tanpa idempotency key, crash tepat setelah layanan menerima pesan namun sebelum save dapat mengulangi bagian terakhir. Tidak ada pengiriman Telegram/MT5 nyata selama tes host.

## Upgrade dan validasi

State basket v4 menyimpan total layer tanpa fase serta konteks notifikasi sebelum request. File v1/v2/v3 tetap diterima tanpa menghapus arah, pending order, layer counter, position identifiers atau SL/TP. Field konteks lama yang memang tidak tersedia ditulis BELUM TERSEDIA/TERVERIFIKASI, bukan direka. File weekly lock tidak diubah oleh penyesuaian notifikasi.

Tes host menjalankan formatter, splitter, outbox dan persistence produksi dengan adapter terminal/transport dalam memori. Meliputi BUY/SELL, ICT A/B, IPDA, RR, volume partial, batas 255, Unicode emoji, pesan Telegram utuh, retry, dedup, resume sesudah restart, dan migrasi state v1/v2/v3. MetaEditor serta penerimaan pesan pada MT5/Telegram nyata belum diuji dalam lingkungan ini.
