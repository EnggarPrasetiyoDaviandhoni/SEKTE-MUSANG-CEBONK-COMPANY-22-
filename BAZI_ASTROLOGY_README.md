# CEBONK — BAZI ASTROLOGY v1.0.0

Tab `BAZI ASTROLOGY` ditambahkan ke `index.html`, tanpa mengubah mesin Astrology Luxor/WIB, Astrology News, Astro Candles, ataupun Daily Brief. Tidak memakai feed harga dan tidak menerbitkan rekomendasi BUY/SELL.

## Perhitungan
- Empat pilar Tahun–Bulan–Hari–Jam (Gan/Zhi), Yin/Yang, 5 elemen, 12 shio.
- Tahun dan bulan menggunakan solar terms Jie Qi (termasuk Li Chun), **bukan** tanggal 1 Januari atau Tahun Baru Imlek.
- Pengguna memasukkan tanggal dan waktu **WIB (UTC+7)**. Untuk solar terms pustaka `lunar-javascript` (tradisi waktu Beijing), **timestamp UTC yang sama** dikonversi ke China Standard Time (UTC+8) sebelum pilar Tahun/Bulan. Pilar Hari/Jam dihitung pada jam sipil WIB. Pendekatan ini **bukan koreksi true solar time**.
- Batas hari Zi 23:00 tersedia pilihan Sect 1 (hari baru mulai 23:00) dan Sect 2 (hari lama sampai 23:59). Keduanya dibedakan jelas dalam UI.
- Output: 13 baris jadwal untuk satu hari WIB (00:00–00:59 dan 23:00–23:59 adalah bagian Zi terpisah), tabulasi elemen batang+cabangan terlihat (8), Clash 六冲 dan Liu He 六合 sebagai hubungan simbolis, grid shio 1912–2055, dan ekspor CSV.
- Warna tahun bersumber dari elemen **Batang Langit**, bukan tingkat keberuntungan.
- Contoh tiga siklus Kuda Api: 1906, 1966, 2026; tidak menunjukkan kinerja harga perak/emas.

## Dependensi
`lunar-javascript@1.7.7`, MIT, ditarik **saat tab BaZi digunakan** dari jsDelivr dengan fallback cdnjs. Tidak menyimpan tanggal lahir pengguna. Tidak ada token API / trade execution. Bila CDN gagal, UI memperlihatkan error (tidak mengarang data).

## Menguji
```sh
npm install --prefix /tmp/cebonk-bazi --no-save --package-lock=false --ignore-scripts lunar-javascript@1.7.7
NODE_PATH=/tmp/cebonk-bazi/node_modules node tests/bazi-core.test.cjs
```
CI: `.github/workflows/bazi-astrology.yml`.

**Catatan:** BaZi merupakan sistem astrologi tradisional dan tidak terbukti dapat meramalkan arah XAUUSD/XAGUSD. Untuk menguji hipotesis finansial diperlukan data harga historis dan validasi out-of-sample. Kalender dan hubungan elemen tidak boleh disamakan dengan hasil backtest harga.
