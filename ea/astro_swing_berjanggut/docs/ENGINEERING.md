# Pemetaan aturan v1.10

Instruksi terbaru pengguna “Fibo musang nya pakek yang EL 2 aja” mengganti M5 CBR Berjanggut v1.08/v1.09. Rujukan EL2: PRD v1.07 §8.3A–8.4 dan slide Entry Level 2 (MUS-15/16, FMI-23). ICT H4/H1/M15 tetap. SL dapat diatur, default −0.236; TP tetap ICT.

## Weekly lock dan alignment

Batas minggu adalah Senin 00:00 WIB, bukan clock server broker. `CSWeekLatch` hanya menerima minggu lebih baru, dan menangkap juga keputusan WAIT. `CSWeeklyLock` menyimpan minggu/arah/waktu/hash/source/reason secara atomik di Common Files terpisah dari state basket, sebelum entry diizinkan. File gagal disimpan atau rusak memblok entry; keputusan dalam memori tidak diganti ketika save diulang. Feed invalid tidak menciptakan lock WAIT permanen. Pemasangan pertama di tengah minggu menangkap keputusan valid pertama untuk sisa minggu itu.

`Feed.Owner(now, lockedSide)` mengecek daily dan session terhadap arah yang disimpan. Ia tidak mengganti lock dengan weekly pada feed yang diperbarui. Sesi berlawanan WAIT sesuai jawaban pengguna. Daily/session tidak menutup basket. Pergantian minggu hanya dapat mengganti lock; basket lama tidak ditutup dan tetap menghalangi basket baru. Tidak ada order reverse otomatis.

Source weekly asli tetap hasil lima hari trading, scan 06:00–24:00 WIB, dan daily asli tetap `weekly.days[].dominant`. Wrapper terpisah menambahkan scan **tujuh hari kalender penuh 00:00–24:00**, 2016 slot; tidak mengambil potongan scan untuk menggantikan source awal karena state slot pertama bergantung priorScore. Hanya source CAMPURAN memakai resolver baru: jumlah `abs(score) × step_minutes` dari slot BUY versus SELL, share terbesar minimal 0.55 dan directional minutes total minimal 360. Tie toleransi relatif 1e−12 / kurang sampel / share lemah = WAIT. Source BUY/SELL dipertahankan; source TIDAK ADA ARAH tetap WAIT. Feed 2.1.0 berisi source, keputusan, reason, semua tujuh subtotal harian dan threshold. Validator JS dan MQL menghitung ulang total dan keputusan; tidak menghitung ephemeris dalam EA. `validated_predictive_model=false` tetap berlaku.

## M5 EL2 saja

| Langkah | Definisi deterministik |
|---|---|
| Data | CLOSED M5, pivot strict kiri2/kanan2 yang sudah confirmed saat kejadian; BUY/SELL simetris |
| IB | Setelah gate M15, close directional ≥1 tick melewati pivot searah terbaru yang belum broken; anchor adalah pivot berlawanan terakhir yang sudah confirmed |
| Zone IB | BUY `[Low(anchor), min(Open,Close)]`; SELL `[max(Open,Close), High(anchor)]`; wick-to-body, tidak boleh zero-width |
| CB1 | Pivot searah baru sesudah IB, terpisah dari Zone IB, lebih lanjut minimal 1 tick dibanding level IB; dua right bars harus closed sebelum break |
| Break | Close directional pertama ≥1 tick melewati CB1; wick-only tidak sah; belum entry |
| Retest | Sesudah CB1 break, sentuh Zone IB, BUY bullish close > zone.high / SELL bearish close < zone.low. Close melawan sisi risiko membatalkan. Retest sah pertama saja, tidak replay |
| Entry | Tick pertama bar M5 setelah retest, maksimum 30 detik. Quote harus tetap di sisi rejection, Ask > zone.high BUY / Bid < zone.low SELL; RR/spread/stop/risk tetap diperiksa |
| Freshness | Default M15→IB 16 closed bars, IB→CB1 break 12, break→retest 12; semua entry sebelum expiry window/fase/feed |
| Fib | Fib0 = zone.high BUY / zone.low SELL; Fib1 = close pemecah CB1; signed span minimal 2 tick. SL = fib0 + input negatif × span, BUY floor / SELL ceil tick; harus di luar zona |

Harga eksekusi tidak diwajibkan kembali di dalam IB setelah candle rejection ditutup: ketentuan itu dari CBR lama dan akan berlawanan dengan close rejection EL2. Tidak ada fallback dominan/SR, EL1/EL3–EL9, AO, BBMA, EMA atau ATR. TP tidak memakai Fib 1.618/2.618.

H4 pivot 3/3, H1 2/2, D1 target 3/3; Model A diprioritaskan, H4 RANGE hanya A. H1 displacement body ≥60% range dan range ≥median 20 bar sebelumnya; FVG dengan OB fallback. M15 retest valid pertama, maksimal 32 bar setelah zona lahir. Target external PDH/PDL, H4/D1 confirmed, prior week dan IPDA20/40/60; barrier H1/session lebih dekat ikut diperiksa. Target terdekat tidak dilewati untuk membuat RR lolos.

## Akuntansi NET, risiko dan order

Setiap position identifier basket, termasuk yang sudah flat, ditelusuri sekali. Semua deal menyumbang actual profit + swap + commission + fee. Ditambahkan floating semua posisi yang masih terbuka pada Bid/Ask dengan OrderCalcProfit, POSITION_SWAP dan estimasi biaya keluar hanya pada volume tersisa. Setelah flat, laporan hanya menjumlah actual history, tanpa estimasi exit tambahan atau kewajiban quote baru. Missing history/ownership conflict/biaya exit tidak diketahui memblok cut profit. Realized loss tidak hilang setelah partial close. Risk juga memasukkan realized loss dan biaya aktual agar penutupan layer rugi tidak membebaskan allowance semu.

Sebelum request, fase/counter/pending/order intent disimpan. **Belum** menandai spent window/signal. Retcode DONE/DONE_PARTIAL atau matching fill menandai spent. Requote/price changed/explicit reject dan penolakan definitif lain mengembalikan hanya reservasi request tersebut. Timeout/connection/generic error/placed/locked tetap pending. Rekonsiliasi harus cocok dengan **pending order ticket**, atau comment nomor reservasi terakhir jika ticket tidak tersedia; deal lama dari basket yang sama tidak dapat menyelesaikan request baru. Active remainder pada partial fill menahan pending. Hanya historical ORDER_STATE_REJECTED tanpa fill boleh melepas reservasi asinkron. Retry tidak dilakukan secara buta; setelah penolakan pasti, kesempatan baru harus melewati seluruh konfirmasi/freshness lagi.

State basket v2 mempertahankan nama file/magic/lock namespace sebelumnya dan menerima state v1. State v1 pending tanpa ticket diperlakukan konservatif melalui exact comment; tidak mereset counter/spent/SL/TP. State mingguan terpisah. Recovery dari posisi tanpa state memblok tambahan/cut profit NET yang tidak dapat diverifikasi. Netting bercampur manual/EA lain diblok. SL/TP diajukan bersama order dan diperbaiki ke harga tersimpan; gagal melindungi atau fill melampaui risiko memicu emergency close persisten milik EA saja.

Exit Dominant Break M15: mother +3–12 inside children, directional close di luar full high/low, berlawanan posisi, setelah layer terakhir, dan total NET basket strict >0. Intent exit dikunci sebelum close pertama; partial close dicoba ulang sampai flat atau M15 berikutnya closed. Harga fill/slippage/biaya broker masih dapat membuat realisasi akhir berbeda. Exit tidak membutuhkan feed valid dan pergantian minggu tidak memanggil close.
