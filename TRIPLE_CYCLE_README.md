# CEBONK — 4 MOMEN ASTROLOGY BULANAN (v2.2.0)

Pengganti modul lama “Triple Cycle”. Fitur ini adalah **kalender fase Bulan astronomis murni** dan kini berada pada tab navigasi utama **4 MOMEN ASTROLOGY**.

Empat *jenis* momen:
1. **Bulan Baru / Ijtimak** (sudut geosentris 0°)
2. **Kuartal Pertama** (90°)
3. **Bulan Purnama / Badar** (180°)
4. **Kuartal Terakhir** (270°)

Tanggal dan jam kejadian dihitung langsung memakai Astronomy Engine 2.1.19 melalui `SearchMoonPhase` lalu ditampilkan sebagai **WIB (UTC+7)**. Pengguna dapat memilih bulan **2020–2040**, maju/mundur bulan, dan mengunduh CSV. Pada satu bulan kalender Gregorian bisa ada **3–5 kejadian**, walaupun jenis momennya tetap empat. Tidak ada tanggal buatan bila ephemeris gagal.

## Aturan jembatan akhir pekan (WIB)

Ketika waktu tepat fase Bulan terjadi pada **Sabtu atau Minggu menurut kalender WIB**, pertahankan tanggal/jam astronomi aslinya dan tampilkan:
- **Jumat sebelumnya: PRA-MOMEN** (tanggal pengamatan sebelum kejadian).
- **Senin sesudahnya: PASCA-MOMEN** (tanggal pengamatan sesudah kejadian, bila pasar buka).
- Satu fase tetap **satu kejadian astronomis**, bukan dua. Kejadian di hari kerja tidak diberi jembatan.
- Jika Sabtu/Minggu berada di batas bulan, tanggal Jumat/Senin boleh berada di bulan kalender berbeda.
- Tanggal WIB merupakan penanda pengamatan, bukan klaim jam pembukaan/penutupan broker. Hari libur bursa/broker memerlukan pemeriksaan jadwal perdagangan tersendiri.
- CSV menyertakan flag `jembatan_akhir_pekan`, `pra_momen_jumat_wib`, dan `pasca_momen_senin_wib`, tanpa mengubah timestamp UTC dan WIB asli.

## Label dominan Astrology V1 (eksperimental)

Kartu setiap momen sekarang juga menampilkan **DOMINAN BULLISH / DOMINAN BEARISH / NETRAL** dan skor model, dihitung menggunakan `CebonkCore` yang sudah ada pada website. Tidak pernah menetapkan Bulan Baru = BUY atau Purnama = SELL. Skor eksperimen V1 belum dikalibrasi terhadap pergerakan XAUUSD/XAGUSD, sehingga **bukan confidence, winrate, ataupun instruksi transaksi**.

Jika fase jatuh Sabtu/Minggu, label Jumat dan Senin dihitung terpisah: Jumat dari **18.00, 20.00, 22.00 WIB** dan Senin dari **06.00, 08.00, 10.00 WIB**. Dua dari tiga sampel harus memiliki arah sama; jika tidak, status **NETRAL**. Angka tersebut hanya jadwal sampling model astronomis, **bukan** penanda waktu broker membuka/menutup pasar. Ini tidak menggandakan fase astronomi.

Ringkasan bulanan dihitung dari klasifikasi **tiap peristiwa fase asli**, bukan tanggal jembatan. Dominan Bullish/Bearish hanya bila lebih dari setengah jumlah kejadian memiliki label arah yang sama; selain itu CAMPURAN. Bila model tidak tersedia, tampil MODEL TIDAK TERSEDIA tanpa mengganti ephemeris dengan prediksi palsu.

CSV menambahkan kolom `bias_momen_astrology_v1`, `skor_momen_v1`, `bias_jumat_v1`, `bias_senin_v1`. Kalender lunar tidak memuat BaZi atau Hisab, dan modul Astrology Tionghoa akan ditangani terpisah.

## Perubahan dari Triple Cycle

- Dipisahkan menjadi panel tersendiri `#astroMonthlyView` dan tab **4 MOMEN ASTROLOGY**.
- **Tidak** menampilkan BaZi, kalender Hijriah, shio, elemen, atau sinyal EA. Label eksperimen Astrology V1 menggunakan skor aspek planet mesin website yang sudah ada; tidak menciptakan mesin sinyal perdagangan baru.
- BaZi tahunan, Fibo, Astrology News, website teknikal, dan mesin EA lama tetap **utuh dan independen**.
- Deep link baru `#momen-astrology`; `#triple-cycle` lama diarahkan ke modul baru untuk kompatibilitas.

## Ketelitian dan batasan

Ijtimak tidak sama dengan hilal yang dapat dilihat. Data fase Bulan saja tidak mengukur tinggi hilal atau menetapkan awal bulan resmi. Fase astronomis bukan bukti arah harga XAUUSD/XAGUSD. Pusat perhitungan berada di `assets/triple-cycle-core.js` (nama file lama dipertahankan untuk kompatibilitas), UI di `assets/triple-cycle-ui.js`, dan adaptor model arah di `assets/astro-moment-bias.js`.

## Tests

`tests/triple-cycle.test.cjs` menguji **empat sudut fase**, waktu WIB, kalender pendek (Februari), dan integrasi tab. GitHub Actions `.github/workflows/bazi-astrology.yml` menjalankan tes bersama regresi BaZi lama agar penghapusan panel gabungan tidak mengubah modul kalender aslinya. Pengujian juga memeriksa adapter V1 dan perbedaan arah Jumat/Senin menggunakan model tiruan.

Sumber: [Astronomy Engine 2.1.19 (MIT)](https://github.com/cosinekitty/astronomy).
