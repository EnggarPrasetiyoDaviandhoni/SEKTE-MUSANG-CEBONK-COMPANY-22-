# CEBONK ASTRO SWING BERJANGGUT v1.09 — MT5

EA XAUUSD Swing dengan **M5 Fibo Musang Berjanggut**, **level SL Fibonacci yang bisa diatur (default −0.236)**, dan **TP liquidity ICT**. Rujukan perubahan M5 dan pengaturan SL: instruksi pengguna sesudah paket PRD v1.07. Mesin astrologi website tetap berasal dari source aslinya.

Paket ini berisi **source `.mq5` dan `.mqh`**. Status MetaEditor: **NOT COMPILED**. Status Strategy Tester / broker: **NOT RUN**. File `.ex5` harus dihasilkan dengan MetaEditor; hasil tes host tidak menggantikan kompilasi MT5.

## Pasang

1. MT5 → **File → Open Data Folder**. Salin isi folder `MQL5` paket ke folder `MQL5` terminal tersebut.
2. Buka `Experts/CEBONK_ASTRO_SWING_BERJANGGUT_v1.09.mq5` di MetaEditor, lalu tekan **F7**. Periksa log kompilasi. Script PowerShell pada `scripts/compile-swing.ps1` tersedia untuk verifikasi log dan EX5 baru.
3. Attach ke chart **XAUUSD broker yang sama dengan simbol EA**, termasuk suffix seperti `XAUUSDc`. TF strategi tetap D1 → H4 → H1 → M15 → M5, terlepas dari TF chart.
4. Isi `InpCommissionPerLotPerSide` sesuai akun, dalam mata uang akun per lot. Nilai awal **−1 berarti belum diketahui dan memblokir order baru serta cut profit yang belum terverifikasi**. Isi **0 hanya jika akun memang tanpa komisi**. Maksimal risiko basket 1%; 0.01 lot tetap diperiksa terhadap volume dan margin broker.
5. Untuk feed live, izinkan `https://enggarprasetiyodaviandhoni.github.io` di **Tools → Options → Expert Advisors → Allow WebRequest**. Tunggu status feed dan clock valid. Entry live selalu mulai **AUTOPILOT OFF**; tombol chart mengizinkan entry baru. Exit basket tetap dikelola sesuai pengaturan.

Publikasi otomatis feed baru berjalan setelah workflow `publish-swing-feed.yml` berada di `main`. Sebelum itu endpoint Pages dapat mengembalikan 404; EA memblokir entry. `main` tidak diubah oleh proses pembuatan paket ini. Panduan deployment menjelaskan aktivasi feed melalui PR.

## Atur SL sendiri

Buka **EA Properties → Inputs → `InpSLFibLevel`**. Nilai awal `-0.236`; contoh lain `-0.382`, `-0.618`, atau `-1.0`. Ini level Fibonacci, bukan pip, harga SL, atau persentase risiko. Nilai harus negatif dan terhingga; nol, nilai positif, NaN, dan infinity ditolak saat inisialisasi.

Pengaturan baru hanya menentukan SL **basket baru**. SL/TP basket yang sedang aktif tetap memakai harga asli yang disimpan, termasuk layer tambahan dan setelah restart. Mengubah Inputs menginisialisasi ulang EA, sehingga entry kembali **AUTOPILOT OFF**. SL tetap harus di luar kotak IB, sesuai tick/stop-level broker, memenuhi RR minimal 1:2 dan risiko basket maksimal 1%; setup yang tidak memenuhi syarat dilewati.

## Aturan singkat

- Weekly, daily, session dan window Astro harus searah. Bulan/ranking menjadi anotasi bawaan.
- IPDA memakai 20/40/60 D1 **closed**; H4 struktur; H1 sweep/MSS atau BOS; M15 retest zona.
- M5: close break dominan, atau S/R terdekat jika dominan tidak ada, lalu retest kotak Initial Break. Entry harus masih di kotak IB.
- **SL = fib0 + InpSLFibLevel × (fib1 − fib0)**. Default `InpSLFibLevel=-0.236` mempertahankan stop semula. BUY fib0 di bawah body sumber IB; SELL di atas. Fib1 adalah close candle Musang yang memecah dominan/S/R. Anchor dan harga stop basket dikunci.
- **TP ICT terdekat yang valid**, RR ≥ 2; tidak melompati target untuk memaksa RR.
- Satu basket lintas hari; 2 layer AWAL + 2 INTI hanya dengan setup baru; SL/TP basket awal dipertahankan.
- Exit lebih awal: Dominant Break **M15 lawan arah**, mother + 3–12 inside children, close breakout dan **NET seluruh basket > 0 setelah biaya**.

Rincian definisi numerik untuk otomatisasi, pemasangan, tester offline, dan hasil tes tersedia di `docs/`. Angka astrologi tidak dilabeli sebagai probabilitas win rate.
