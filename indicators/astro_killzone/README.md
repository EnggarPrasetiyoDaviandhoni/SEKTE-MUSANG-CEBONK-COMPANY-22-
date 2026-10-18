# CEBONK KILLZONE ASTROLOGY v1.00 — indikator MT5 mandiri

Indikator khusus **KILLZONE ASTROLOGY**: Sydney, Tokyo / Asia, London Open, New York Open, dan London Close. Setiap sesi memiliki fokus Astro sendiri, sehingga arah satu sesi tidak harus sama dengan sesi lain. Panel menampilkan BUY/SELL/NETRAL, jadwal sesi dan **AWAL / INTI / AKHIR** window. Chart menampilkan kotak window dan garis INTI.

Paket ini terpisah dari EA CEBONK. Tidak memerlukan EA, feed Swing, weekly/daily bias, ICT, Fibo, layer, SL/TP atau akses akun trading. BUY/SELL di sini adalah arah **skor Astro**, sesuai mesin Killzone web asli. Tidak ada konfirmasi candle harga di indikator ini.

**Status:** source MQ5/MQH. **NOT COMPILED** pada MetaEditor; EX5 belum disertakan. Tampilan/runtime MT5 dan script PowerShell belum dijalankan di lingkungan Linux ini. Tes algoritma/format data dan kesesuaian dengan mesin web sudah lulus; rincian ada di `evidence/VALIDATION.json`.

## Pasang

1. Ekstrak seluruh ZIP.
2. MT5 → **File → Open Data Folder**. Salin isi folder `MQL5` paket ke folder `MQL5` terminal itu, termasuk `Indicators`, `Include/CebonkKillzone`, dan `Files`.
3. Buka `MQL5/Indicators/CEBONK_KILLZONE_ASTROLOGY_v1.00.mq5` di MetaEditor dan tekan **F7**. Pastikan log kompilasi tidak berisi error.
4. Di MT5, refresh **Navigator → Indicators**, lalu attach indikator ke chart. Bisa dipakai pada timeframe chart mana saja; perhitungan Astro tetap menggunakan slot lima menit dari source asli.

Pilihan instalasi lewat PowerShell dari folder ZIP:

```powershell
.\scripts\Install-Killzone.ps1 -DataFolder 'C:\Users\NAMA\AppData\Roaming\MetaQuotes\Terminal\ID'
```

Tambahkan `-MetaEditor 'C:\Program Files\MetaTrader 5\metaeditor64.exe'` untuk meminta kompilasi. Script meminta log **0 errors** dan EX5 baru; keberhasilan proses saja tidak dianggap bukti compile.

## Pengaturan dan jam

- `InpDateWIB`: kosong mengikuti tanggal WIB hari ini; akhir pekan memilih weekday berikutnya. Isi `YYYY-MM-DD` untuk tanggal dalam forecast. Tombol **PREV / TODAY / NEXT** memilih tanggal tanpa menghitung ulang Astro.
- `InpHistoryDays`: jumlah tanggal trading yang digambar termasuk tanggal terpilih, default 3.
- Lima pilihan sesi mengatur sesi yang ditampilkan.
- `InpShowAllWindows=false`: tampilkan window fokus dominan setiap sesi. Ubah `true` untuk semua window Astro yang sah, termasuk window berlawanan pada sesi NETRAL.
- `InpShowCoreLines`: garis vertikal pada waktu INTI skor.
- Tabel memakai **WIB**. Kotak/garis chart memakai **jam server broker**. Zona IANA Sydney/London/New York beserta DST sesi dihitung dari tanggal aslinya.
- `InpBrokerUtcOffsetMinutes`: default `2147483647` berarti AUTO dari clock server saat ini dan UTC komputer. Terminal harus terhubung ke broker. Nilai manual adalah menit terhadap UTC, misalnya `120` untuk UTC+2 atau `180` untuk UTC+3, sesuai broker sebenarnya.

AUTO memakai **offset broker saat ini** untuk tanggal yang digambar; ia tidak mengetahui sejarah/perubahan DST broker. Untuk meninjau tanggal di sisi lain perubahan DST broker, isi offset manual yang berlaku pada tanggal itu dan gunakan `InpHistoryDays=1`. UTC/WIB sumber sesi tetap mengikuti tanggal dan DST kota asal. Dalam Strategy Tester, offset manual diperlukan karena `TimeGMT` tester bukan bukti UTC broker. Runtime tester indikator belum diuji.

## Forecast lokal dan pembaruan

File `MQL5/Files/cebonk-killzone-forecast-v1.json` berisi **42 hari kalender**, sekitar seminggu ke belakang dan sebulan ke depan. Tanggal cakupan dan waktu pembuatan ditampilkan di panel. Forecast ini dihitung dari astronomi, bukan dari candle/tick harga; hasil tanggal mendatang tidak berubah hanya karena dihitung beberapa hari lebih awal dengan source yang sama.

**Tidak perlu koneksi WebRequest, Python, Node atau EA untuk membaca forecast awal yang sudah dibundel.** MT5 melarang `WebRequest` dari custom indicator, sehingga indikator membaca file lokal. Saat tanggal terpilih keluar dari cakupan file, panel meminta **UPDATE FORECAST** dan tidak menggambar window pengganti.

Untuk memperpanjang forecast, pasang **Node.js 20 atau lebih baru** di komputer lalu jalankan dari folder ZIP:

```powershell
.\scripts\Update-KillzoneForecast.ps1 -DataFolder 'C:\Users\NAMA\AppData\Roaming\MetaQuotes\Terminal\ID'
```

Kalkulasi berjalan **lokal/offline** dengan mesin Astro yang sudah dibundel. Tidak membutuhkan `npm install`, API web, token, akun GitHub, atau EA pendamping. Pembaru menulis file sementara lalu mengganti file akhir; indikator membaca pembaruan dalam 15 detik.

Alternatif langsung:

```powershell
node .\generate.mjs --output 'C:\Users\NAMA\AppData\Roaming\MetaQuotes\Terminal\ID\MQL5\Files\cebonk-killzone-forecast-v1.json'
```

Matematika `CebonkCore` dan `astro-killzone-core.js` disalin utuh dari commit pada `SOURCE_AUDIT.json`. Astronomy Engine 2.1.19 beserta lisensinya disertakan. Generator hanya memanggil kalkulator sesi Killzone; tidak mengimpor modul weekly, daily, lunar ranking atau strategi EA.
