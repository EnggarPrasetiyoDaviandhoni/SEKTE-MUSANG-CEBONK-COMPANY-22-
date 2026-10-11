# CEBONK ASTROLOGY NEWS EA MT5 v1.00

EA terpisah dari Liquidity Sweep. Menjalankan kebijakan ASTROLOGY NEWS website asli (assets/astro-news-v1.js), dengan arah dari mesin CebonkCore dalam index.html. Tidak menggunakan filter Liquidity Sweep, MA, RSI, atau tren teknikal untuk arah.

## Aturan website
- NEWS hanya patokan waktu, arah dari Astrology V1 (model eksperimen, tidak tervalidasi).
- Pre 30 menit, post 120 menit, block -5/+5 menit sekitar release, minimum window searah 15 menit, entry hanya 10 menit pertama window valid. Fokus 1 arah terpilih dari window terpanjang dan total durasi.
- Kalender website saat ini SNAPSHOT OKTOBER 2026, diverifikasi 4 Oktober 2026. Bukan kalender news real-time universal. Setelah event berakhir, tidak ada sinyal baru sampai kalender sumber diperbarui; jadwal dapat berubah.
- GitHub Actions menghitung News.calculate dari website dan menerbitkan file news_windows.csv serta news_windows.json; EA mengunduh HTTPS setiap 5 menit tanpa langkah CSV manual dalam live/demo.
- Pemeriksaan silang MT5 Economic Calendar untuk USD HIGH impact default aktif. Jadwal harus cocok ±1 menit. Jika calendar MT5 gagal, tidak ada entry.
- Maksimal satu trade tiap event news. Jika simbol sudah punya posisi/order (termasuk manual dan EA lain), tidak masuk posisi baru. Posisi yang sudah entry memakai SL/TP broker.

## Risiko dan eksekusi
Fixed lot 0.01, SL 3×ATR(14) M5, TP RR 1:4, spread maksimal 70 points, tanpa BE/trailing/partial. Friday Auto Close aktif 5 menit sebelum penutupan Jumat, hanya posisi magic milik EA. Broker bisa gagal close bila sesi sudah tutup atau terminal offline. Default AUTOPILOT OFF dan LIVE ACCOUNT LOCKED.

## Instalasi
1. Unduh ea/astro_news/dist/CEBONK_ASTROLOGY_NEWS_v1.00.txt. Salin dan ubah nama menjadi CEBONK_ASTROLOGY_NEWS_v1.00.mq5, lalu compile di MetaEditor. TXT ini berisi notifier dalam satu file.
2. Cara modular: CEBONK_ASTROLOGY_NEWS_v1.00.mq5 dan NewsNotify.mqh taruh dalam folder Expert yang sama.
3. Load ea/astro_news/ASTROLOGY_NEWS_DEFAULT.set dan pasang di chart XAUUSDc.
4. MT5 > Tools > Options > Expert Advisors > Allow WebRequest, tambahkan https://raw.githubusercontent.com dan https://api.telegram.org.
5. Isi token dan chat ID Telegram di input terminal, jangan simpan token di GitHub. Aktifkan tombol AUTOPILOT ON untuk uji DEMO.
6. Experts/Journal menampilkan alasan jika web gagal, tidak ada window, kalender HIGH USD tidak cocok, atau spread terlalu tinggi.

## Backtest
MT5 Strategy Tester tidak mendukung WebRequest, maka perlu CSV lokal khusus tester bernama CEBONK_ASTRO_NEWS_WINDOWS.csv dengan format sama. Kalender website belum memiliki semua event 2024–2026, sehingga data backtest historis lengkap belum tersedia.

## Telegram
🦊 SEKTE MUSANG - CEBONK COMPANY 22
📰 NEWS | 🟢 BUY / 🔴 SELL
🔮 Entry Awal window + 🕒 jam release WIB
🌙 aspek planet pada puncak window model
🎯 Entry / 🛑 SL 3ATR / 💰 TP RR1:4
😅 TAKE PROFIT / 🥲 STOP LOSS / 🌙 Friday Close

## Sumber jadwal
- https://www.bls.gov/schedule/2026/10_sched.htm
- https://www.bea.gov/news/schedule
- https://www.federalreserve.gov/newsevents/2026-october.htm

Peringatan: model Astrology V1 tidak terbukti memprediksi harga emas. Trading dekat news berisiko slippage ekstrem dan gap. Syarat compile MetaEditor, backtest dan uji runtime NOZAX belum diverifikasi.
