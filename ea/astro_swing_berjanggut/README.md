# CEBONK ASTRO SWING BERJANGGUT v1.08 — MT5

EA XAUUSD Swing dengan **M5 Fibo Musang Berjanggut**, **SL Fibonacci −0.236**, dan **TP liquidity ICT**. Rujukan perubahan M5: instruksi pengguna sesudah paket PRD v1.07. Mesin astrologi website tetap berasal dari source aslinya.

Paket ini berisi **source `.mq5` dan `.mqh`**. Status MetaEditor: **NOT COMPILED**. Status Strategy Tester / broker: **NOT RUN**. File `.ex5` harus dihasilkan dengan MetaEditor; hasil tes host tidak menggantikan kompilasi MT5.

## Pasang

1. MT5 → **File → Open Data Folder**. Salin isi folder `MQL5` paket ke folder `MQL5` terminal tersebut.
2. Buka `Experts/CEBONK_ASTRO_SWING_BERJANGGUT_v1.08.mq5` di MetaEditor, lalu tekan **F7**. Periksa log kompilasi. Script PowerShell pada `scripts/compile-swing.ps1` tersedia untuk verifikasi log dan EX5 baru.
3. Attach ke chart **XAUUSD broker yang sama dengan simbol EA**, termasuk suffix seperti `XAUUSDc`. TF strategi tetap D1 → H4 → H1 → M15 → M5, terlepas dari TF chart.
4. Isi `InpCommissionPerLotPerSide` sesuai akun, dalam mata uang akun per lot. Nilai awal **−1 berarti belum diketahui dan memblokir order baru serta cut profit yang belum terverifikasi**. Isi **0 hanya jika akun memang tanpa komisi**. Maksimal risiko basket 1%; 0.01 lot tetap diperiksa terhadap volume dan margin broker.
5. Untuk feed live, izinkan `https://enggarprasetiyodaviandhoni.github.io` di **Tools → Options → Expert Advisors → Allow WebRequest**. Tunggu status feed dan clock valid. Entry live selalu mulai **AUTOPILOT OFF**; tombol chart mengizinkan entry baru. Exit basket tetap dikelola sesuai pengaturan.

Publikasi otomatis feed baru berjalan setelah workflow `publish-swing-feed.yml` berada di `main`. Sebelum itu endpoint Pages dapat mengembalikan 404; EA memblokir entry. `main` tidak diubah oleh proses pembuatan paket ini. Panduan deployment menjelaskan aktivasi feed melalui PR.

## Aturan singkat

- Weekly, daily, session dan window Astro harus searah. Bulan/ranking menjadi anotasi bawaan.
- IPDA memakai 20/40/60 D1 **closed**; H4 struktur; H1 sweep/MSS atau BOS; M15 retest zona.
- M5: close break dominan, atau S/R terdekat jika dominan tidak ada, lalu retest kotak Initial Break. Entry harus masih di kotak IB.
- **SL = fib0 − 0.236 × (fib1 − fib0)**. BUY fib0 di bawah body sumber IB; SELL di atas. Fib1 adalah close candle Musang yang memecah dominan/S/R. Anchor dikunci.
- **TP ICT terdekat yang valid**, RR ≥ 2; tidak melompati target untuk memaksa RR.
- Satu basket lintas hari; 2 layer AWAL + 2 INTI hanya dengan setup baru; SL/TP basket awal dipertahankan.
- Exit lebih awal: Dominant Break **M15 lawan arah**, mother + 3–12 inside children, close breakout dan **NET seluruh basket > 0 setelah biaya**.

Rincian definisi numerik untuk otomatisasi, pemasangan, tester offline, dan hasil tes tersedia di `docs/`. Angka astrologi tidak dilabeli sebagai probabilitas win rate.
