# CEBONK — Astrology Mingguan Senin–Jumat (WIB)

Panel berada di **ASTROLOGY**, di bawah keterangan model eksperimen dan sebelum timeline harian. Kode terpisah:
- `assets/astro-weekly-core.js`: perhitungan mingguan murni, tanpa teknikal/harga/eksekusi order.
- `assets/astro-weekly-ui.js`: antarmuka tanggal/jam WIB, tabel harian, kandidat utama dan salin ringkasan.
- `tests/astro-weekly.test.cjs`: pengujian tanggal, batas jam, durasi, pembatalan dan data hilang.
- `.github/workflows/astro-weekly.yml`: cek sintaks serta regresi pada setiap update.

## Cara menggunakan

1. Buka tab **ASTROLOGY**, pilih tanggal apa saja pada minggu yang ingin dianalisis. Sistem menyesuaikan ke hari **Senin**.
2. Tekan **Hitung Mingguan**. Sistem memindai **Senin–Jumat 06.00–24.00 WIB** dengan interval **5 menit**, sebanyak 216 slot/hari atau 1.080 slot/minggu.
3. Lihat **Dominasi Mingguan** (BUY/BULLISH, SELL/BEARISH, CAMPURAN, atau TIDAK ADA ARAH), ringkasan setiap hari, dan sampai 5 window searah dominasi mingguan. Window terbaik menampilkan **tanggal, jam mulai, jam inti/skor tertinggi, jam akhir** dalam WIB. Waktu Luxor otomatis DST atau UTC+3 tetap hanya untuk referensi perbandingan tampilan.
4. Tombol **Minggu lalu/Minggu depan**, **Batal**, dan **Salin Ringkasan** tersedia. Fitur ini berjalan jika JavaScript dan dependensi Astronomy Engine dari CDN berhasil dimuat. Hitungan 5 hari dapat memerlukan waktu pada telepon; tidak dipaksakan berjalan otomatis saat halaman dibuka.

## Aturan yang transparan

- Peta arah per 5 menit berasal dari **model eksperimen V1 yang sudah digunakan di scanner harian Astrology**; bukan prediksi teruji.
- Jumlah menit BUY vs SELL selama 5 hari; sinyal mingguan dominan jika salah satu memiliki **≥55% dari total menit yang berlabel BUY atau SELL**. Netral dan transisi tetap dicatat, tetapi tidak dimasukkan dalam penyebut. Ambang 55% merupakan aturan pengelompokan eksploratif yang belum tervalidasi.
- Window kandidat harus berurutan searah dan berlangsung **minimal 30 menit**. Prioritaskan **durasi terpanjang**, lalu besarnya skor puncak, lalu waktu paling awal. Seleksi tidak menggabungkan window lintas hari atau mengarang data waktu di luar jam scan.
- Bila dominasi campuran atau tidak ada window dominan yang memenuhi durasi, keluaran **tidak ada kandidat**. Tidak ada janji entry tiap hari dan tidak mengeluarkan perintah transaksi.
- **XAUUSD dan XAGUSD ditampilkan sebagai cakupan pembacaan yang sama**: model V1 belum dilatih berdasarkan harga untuk membedakan sinyal kedua instrumen. Jangan menyebut kandidat ini mempunyai win rate tertentu atau jaminan profit.
- Hari libur pasar dan berita berdampak tinggi **belum** dipakai untuk memblokir kandidat. Format tanggal/jam sudah dikonversi WIB, bukan jam server broker.

Modul BaZi dan arsip harga historis World Bank tetap mandiri, sama dengan Astrology News dan mesin indikator yang sudah ada. Scanner BBMA dan Liquidity Sweep di halaman web tetap dihapus.
