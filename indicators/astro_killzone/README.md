# CEBONK KILLZONE ASTROLOGY WEBREQUEST v1.01 — MT5

Indikator khusus **KILLZONE ASTROLOGY**: Sydney, Tokyo / Asia, London Open, New York Open, dan London Close. Setiap sesi memiliki fokus Astro sendiri, sehingga arah satu sesi tidak harus sama dengan sesi lain. Panel menampilkan BUY/SELL/NETRAL, jadwal sesi dan **AWAL / INTI / AKHIR** window. Chart menampilkan kotak window dan garis INTI.

Paket ini berisi indikator dan **script pendownload WebRequest khusus Killzone**. Tidak memerlukan EA trading, feed Swing, weekly/daily bias, ICT, Fibo, layer, SL/TP atau kredensial akun. BUY/SELL adalah arah **skor Astro**, sesuai mesin Killzone web asli. Tidak ada konfirmasi candle harga di indikator ini.

MT5 [melarang `WebRequest()` dari custom indicator](https://www.mql5.com/en/docs/network/webrequest). Karena itu, panggilan HTTPS berjalan di script dengan thread sendiri, lalu indikator membaca cache hasil download. Indikator tidak memanggil fungsi jaringan yang dilarang tersebut.

**Status:** source MQ5/MQH. **NOT COMPILED** pada MetaEditor; EX5 belum disertakan. Native WebRequest, tampilan/runtime MT5 dan script PowerShell belum dijalankan di lingkungan Linux ini. Tes logika cache, format data dan kesesuaian mesin Astro sudah lulus; GET endpoint publik diverifikasi terpisah dari runtime MT5. Rincian ada di `evidence/`.

## Pasang

1. Ekstrak seluruh ZIP.
2. MT5 → **File → Open Data Folder**. Salin isi folder `MQL5` paket ke folder `MQL5` terminal itu, termasuk `Indicators`, `Scripts`, `Include/CebonkKillzone`, dan `Files`.
3. Compile **dua file** di MetaEditor dengan **F7**: `Indicators/CEBONK_KILLZONE_ASTROLOGY_v1.01.mq5` dan `Scripts/CEBONK_KILLZONE_WEBREQUEST_v1.01.mq5`. Pastikan log tidak berisi error.
4. MT5 → **Tools → Options → Expert Advisors → Allow WebRequest for listed URL**. Tambahkan **`https://raw.githubusercontent.com`**. Nama menu MT5 ini juga mengatur WebRequest script; tidak perlu memasang EA trading.
5. **Navigator → Scripts → CEBONK_KILLZONE_WEBREQUEST_v1.01**: jalankan pada satu chart dan biarkan script berjalan. Script langsung melakukan GET, kemudian mengulang setiap 600 detik.
6. **Navigator → Indicators → CEBONK_KILLZONE_ASTROLOGY_v1.01**: attach ke chart. Indikator membaca hasil download dalam 15 detik. Satu script dapat memasok beberapa chart dalam terminal yang sama, selama nama file cache sama.

Jalankan kembali script downloader setelah terminal MT5 dibuka ulang atau script dihentikan. Tidak ada Node/Python, DLL, token API, atau EA pendamping yang harus dijalankan di komputer pengguna.

Pilihan instalasi lewat PowerShell dari folder ZIP:

```powershell
.\scripts\Install-Killzone.ps1 -DataFolder 'C:\Users\NAMA\AppData\Roaming\MetaQuotes\Terminal\ID'
```

Tambahkan `-MetaEditor 'C:\Program Files\MetaTrader 5\metaeditor64.exe'` untuk meminta kompilasi. Script meminta log **0 errors** dan EX5 baru; keberhasilan proses saja tidak dianggap bukti compile.

## Pengaturan dan jam

- `InpDateWIB`: kosong mengikuti tanggal WIB hari ini; akhir pekan memilih weekday berikutnya. Isi `YYYY-MM-DD` untuk tanggal dalam forecast. Tombol **PREV / TODAY / NEXT** memilih tanggal tanpa menghitung ulang Astro.
- `InpMaxWebSilenceMinutes`: default 60. Setelah 60 menit tanpa download yang berhasil dan terverifikasi, indikator menghapus window dan meminta pembaruan WebRequest. File offline lama tidak dianggap sebagai data web.
- `InpHistoryDays`: jumlah tanggal trading yang digambar termasuk tanggal terpilih, default 3.
- Lima pilihan sesi mengatur sesi yang ditampilkan.
- `InpShowAllWindows=false`: tampilkan window fokus dominan setiap sesi. Ubah `true` untuk semua window Astro yang sah, termasuk window berlawanan pada sesi NETRAL.
- `InpShowCoreLines`: garis vertikal pada waktu INTI skor.
- Tabel memakai **WIB**. Kotak/garis chart memakai **jam server broker**. Zona IANA Sydney/London/New York beserta DST sesi dihitung dari tanggal aslinya.
- `InpBrokerUtcOffsetMinutes`: default `2147483647` berarti AUTO dari clock server saat ini dan UTC komputer. Terminal harus terhubung ke broker. Nilai manual adalah menit terhadap UTC, misalnya `120` untuk UTC+2 atau `180` untuk UTC+3, sesuai broker sebenarnya.

AUTO memakai **offset broker saat ini** untuk tanggal yang digambar; ia tidak mengetahui sejarah/perubahan DST broker. Untuk tanggal di sisi lain perubahan DST broker, isi offset manual yang berlaku pada tanggal itu dan gunakan `InpHistoryDays=1`. UTC/WIB sumber sesi tetap mengikuti tanggal dan DST kota asal. WebRequest tidak tersedia di Strategy Tester; versi ini memakai downloader pada terminal MT5.

## Sumber web dan cache

Endpoint HTTPS bawaan script:

`https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/killzone-astrology-feed-v1/forecast.json`

Input script `InpFeedURL` dapat diganti dengan endpoint HTTPS lain yang menghasilkan model dan checksum yang sama. `InpCacheFile` harus sama dengan `InpForecastFile` indikator. `InpPollSeconds=600` berarti polling 10 menit; timeout bawaan 5 detik dan retry kegagalan memakai backoff.

Script hanya menerima HTTP 200, JSON model Killzone yang benar, SHA-256 valid, jadwal sesi/window yang konsisten dan cakupan tanggal yang belum habis. Hasil ditulis ke file sementara, dibaca ulang untuk memeriksa kelengkapan, lalu mengganti cache. Respons rusak/HTML/HTTP error tidak menimpa cache sebelumnya.

Cache pada `MQL5/Files`:

- `cebonk-killzone-forecast-v1.json`: forecast terverifikasi hasil WebRequest.
- `cebonk-killzone-forecast-v1.json.webstatus.json`: HTTP, waktu percobaan/download terakhir dan hash cache.
- File `.web.lock`: mencegah dua downloader menulis cache yang sama bersamaan.

Saat jaringan gagal, cache terakhir masih dapat ditampilkan hingga batas `InpMaxWebSilenceMinutes`, dengan status kegagalan berwarna oranye. Tanpa status download yang valid, hash cache yang cocok dan waktu keberhasilan yang masih berlaku, indikator tidak menggambar window. Menyalin forecast offline saja tidak mengaktifkan mode web.

Forecast server mencakup 42 hari kalender dan hanya menghitung lima sesi Killzone dari source Astro asli; timestamp pembuatan berbeda dari timestamp download dan keduanya ditampilkan. Generator/publisher berada di repo, bukan pada komputer pengguna. File di branch data sudah bisa diambil langsung. Workflow `publish-killzone-web-feed.yml` memperbaruinya setiap 00:20 UTC **setelah workflow digabung ke `main`**. Sebelum itu, publikasi awal tetap memiliki batas cakupan tanggal yang tertulis dalam JSON; pengunduhan ulang tidak memperpanjang cakupan.

`WEBREQUEST_ERROR_4014` biasanya berarti URL belum diizinkan atau fungsi dipanggil dari jenis program yang tidak diizinkan. Jalankan downloader dari **Scripts**, bukan mengganti indikator menjadi pemanggil WebRequest. Periksa Journal untuk rincian. Tidak ada pemanggilan order trading di kedua program.
