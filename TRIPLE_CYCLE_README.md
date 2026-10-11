# CEBONK — 4 MOMEN ASTROLOGY BULANAN (v2.0.0)

Pengganti modul lama “Triple Cycle”. Fitur ini adalah **kalender fase Bulan astronomis murni** dan kini berada pada tab navigasi utama **4 MOMEN ASTROLOGY**.

Empat *jenis* momen:
1. **Bulan Baru / Ijtimak** (sudut geosentris 0°)
2. **Kuartal Pertama** (90°)
3. **Bulan Purnama / Badar** (180°)
4. **Kuartal Terakhir** (270°)

Tanggal dan jam kejadian dihitung langsung memakai Astronomy Engine 2.1.19 melalui `SearchMoonPhase` lalu ditampilkan sebagai **WIB (UTC+7)**. Pengguna dapat memilih bulan **2020–2040**, maju/mundur bulan, dan mengunduh CSV. Pada satu bulan kalender Gregorian bisa ada **3–5 kejadian**, walaupun jenis momennya tetap empat. Tidak ada tanggal buatan bila ephemeris gagal.

## Perubahan dari Triple Cycle

- Dipisahkan menjadi panel tersendiri `#astroMonthlyView` dan tab **4 MOMEN ASTROLOGY**.
- **Tidak** menampilkan BaZi, kalender Hijriah, shio, elemen, algoritme BUY/SELL, momen harian berbasis skor, ataupun sinyal EA.
- BaZi tahunan, Fibo, Astrology News, website teknikal, dan mesin EA lama tetap **utuh dan independen**.
- Deep link baru `#momen-astrology`; `#triple-cycle` lama diarahkan ke modul baru untuk kompatibilitas.

## Ketelitian dan batasan

Ijtimak tidak sama dengan hilal yang dapat dilihat. Data fase Bulan saja tidak mengukur tinggi hilal atau menetapkan awal bulan resmi. Fase astronomis bukan bukti arah harga XAUUSD/XAGUSD. Pusat perhitungan berada di `assets/triple-cycle-core.js` (nama file lama dipertahankan untuk kompatibilitas), UI di `assets/triple-cycle-ui.js`.

## Tests

`tests/triple-cycle.test.cjs` menguji **empat sudut fase**, waktu WIB, kalender pendek (Februari), dan integrasi tab. GitHub Actions `.github/workflows/bazi-astrology.yml` menjalankan tes bersama regresi BaZi lama agar penghapusan panel gabungan tidak mengubah modul kalender aslinya.

Sumber: [Astronomy Engine 2.1.19 (MIT)](https://github.com/cosinekitty/astronomy).
