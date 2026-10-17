# Deployment dan tester

## Source dan feed

Branch kerja: `codex/cebonk-swing-berjanggut`, repo `EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-`. File source website dipanggil langsung oleh generator; formula asli tidak disalin menjadi rumus baru.

Untuk generator lokal dari checkout repo:

```bash
npm ci --prefix ea/astro_swing_berjanggut --ignore-scripts
node scripts/generate-swing-feed.mjs
node scripts/check-swing-feed.mjs --file data/ea/swing-forecast-v2.json
```

Feed v2 adalah data baru; feed v1 tetap milik alur lama. Publikasi dijalankan workflow baru setiap 00:10 UTC setelah branch/PR masuk ke `main`. Workflow mengecek model/browser parity, menghasilkan JSON sementara, validasi, commit **hanya** file data v2, meminta build Pages yang sudah dipakai repo, kemudian memeriksa GET 200 dan hash payload yang benar. Perubahan source bersamaan membuat publikasi berhenti agar hasil source lama tidak menimpa hasil source baru.

URL MT5:

`https://EnggarPrasetiyoDaviandhoni.github.io/SEKTE-MUSANG-CEBONK-COMPANY-22-/data/ea/swing-forecast-v2.json`

Sebelum workflow dipublikasikan, 404 berarti feed belum tersedia dan EA tidak membuka order. Untuk uji branch, `InpFeedURL` boleh memakai raw GitHub branch tersebut dan domain `https://raw.githubusercontent.com` harus di-whitelist; data tetap hanya berlaku ≤30 jam. Jangan memakai JSON fixture lama sebagai feed live.

Format payload: JSON canonical dengan key object tersortir, SHA-256 atas payload tanpa field hash. Field `payload_sha256` ditempatkan paling akhir. Parser MT5 memverifikasi bytes UTF-8 payload yang sama tanpa mengubah format float. Ini pemeriksaan integritas, bukan tanda tangan digital; transport HTTPS tetap dipakai.

## MT5

Salin `MQL5/Experts`, `MQL5/Include/CebonkSwing`, `MQL5/Scripts`, dan file tester ke Data Folder terminal yang dipilih. Compile dengan F7 atau:

```powershell
.\scripts\compile-swing.ps1 -MetaEditor 'C:\Program Files\MetaTrader 5\metaeditor64.exe' -DataFolder 'C:\Users\NAMA\AppData\Roaming\MetaQuotes\Terminal\ID_TERMINAL'
```

Script membutuhkan log “0 errors” dan EX5 baru; exit code proses saja tidak dianggap bukti compile. Jalankan script MT5 `CEBONK_SWING_SELFTEST` untuk menguji parser/hash/feed di runtime MT5 setelah compile. Log self-test belum dihasilkan dalam lingkungan pembuatan ini.

Attach pada chart simbol XAUUSD yang sesuai. Isi komisi per lot per sisi; verifikasi kontrak simbol, minimum lot, tick size, margin, dan jam broker di MT5. Suffix broker diterima. Tombol ON hanya mengizinkan entry baru; OFF tidak menutup basket. Menghapus EA menghentikan manajemen client-side, sementara server SL/TP yang sudah terpasang tetap berlaku.

## Strategy Tester offline

WebRequest tidak dipanggil di tester. Siapkan archive astronomi untuk periode test, misalnya:

```bash
node scripts/generate-swing-history.mjs --from 2026-09-01 --to 2026-09-30
```

Archive menyertakan publikasi satu hari sebelum tanggal awal, pada jadwal 00:10 UTC, supaya sesi Sydney awal tercakup. Ini **backfill astronomi dengan source commit yang dipin**, bukan arsip publikasi historis asli dan bukan data harga. JSONL dipilih menurut publication timestamp ≤simulated UTC; record mendatang tidak dipakai. OHLC dan harga tetap dari tester MT5 sesuai waktu simulasi.

File `MQL5/Files/swing-forecast-v2.history.jsonl` yang dibundel hanya fixture contoh Oktober 2026. Ganti dengan hasil generator untuk rentang test. `#property tester_file` memastikan nama file default disalin ke tester agent. Jika nama input file diganti, file harus tersedia pada sandbox agent yang bersangkutan.

Clock tester **tidak menganggap TimeCurrent sebagai UTC**. Pilih salah satu:

- Isi `InpTesterUtcOffsetMinutes` jika seluruh rentang memang memiliki offset broker tetap yang sudah diverifikasi.
- Isi CSV `cebonk-broker-offsets.csv`: `server_from,server_to,offset_minutes`, Unix seconds **pada clock server**, interval `[from,to)`, urut tanpa overlap. Gunakan offset broker nyata untuk setiap periode DST. Template bawaan hanya header; tidak berisi tebakan GMT broker.

Set `InpTesterAutopilot=true` untuk simulasi nonvisual. Input ini tidak bisa menyalakan autopilot pada akun live. Pilih Every Tick Based on Real Ticks bila data tersedia, uji in-sample dan out-of-sample, lalu simpan report MT5 beserta Journal. `OnTester` menulis trades, net, expectancy, profit factor dan drawdown dari statistik tester. Belum ada hasil performa yang dapat dilaporkan dari paket ini.

## Telegram dan Push

Telegram/Push default OFF. Masukkan Bot Token dan Chat ID hanya pada terminal lokal. Whitelist `https://api.telegram.org`; aktifkan notifikasi MT5 pada terminal bila memakai Push. Tombol TEST NOTIFIKASI menguji konfigurasi saat EA berjalan. Token tidak ditulis ke source, JSON feed, atau log.

Outbox dan event id per-channel disimpan di Common Files, retry dengan backoff. Broker order tidak bergantung pada keberhasilan Telegram. Seperti API tanpa idempotency key, restart tepat setelah layanan menerima pesan tetapi sebelum acknowledgement tersimpan masih dapat menghasilkan pesan ulang.

## File state dan pemecahan masalah

Common Files memakai prefix account/magic dan hash simbol; tester memakai namespace terpisah. Simpan state jika memindah terminal yang masih memiliki basket aktif.

| Status | Tindakan |
|---|---|
| `FEED_HTTP_404` | Publikasikan workflow/data v2 atau periksa URL branch |
| `FEED_STALE` / `FEED_SHA256` | Periksa publikasi terbaru; jangan edit timestamp/hash untuk meloloskan feed |
| `CLOCK_UNVERIFIED` | Periksa koneksi/GMT mesin live atau mapping UTC historis tester |
| `COMMISSION_UNVERIFIED` | Isi biaya broker nyata; 0 hanya untuk akun tanpa komisi |
| `SKIP_PRICE_LEFT_IB` | Harga sudah meninggalkan area; tidak mengejar entry |
| `SKIP_RISK` / `SKIP_BROKER_STOPLEVEL` | Kontrak/lot/stop tidak memenuhi batas; SL tidak digeser otomatis |
| `POSITION_OWNERSHIP_CONFLICT` | Ada posisi/deal manual atau EA lain; basket tidak diambil alih |
| `STATE_CORRUPT_OR_UNWRITABLE` | Simpan file untuk audit dan pulihkan state yang benar; jangan hapus state saat ada posisi terbuka |
| `ORDER_ACK_UNKNOWN` | Rekonsiliasi history/order MT5; jangan membuat request entry pengganti secara manual dari signal yang sama |
