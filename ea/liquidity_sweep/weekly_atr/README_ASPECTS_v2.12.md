# CEBONK LIQUIDITY SWEEP + ASTROLOGY MINGGUAN AUTO v2.12 — aspek planet

Versi tambahan dari v2.11. EA lawas tetap utuh. Telegram menampilkan aspek planet yang betul-betul dihitung, bukan label contoh.

## Aspek yang dijelaskan
Generator GitHub Actions memakai mesin astrologi asli website (index.html + assets/astro-weekly-core.js). Pada titik INTI setiap window kandidat, generator memilih sampai dua aspek planet-planet (bukan ASC/MC) dengan pengaruh model V1 terbesar yang searah dominasi BUY/SELL.

Menampilkan jenis Conjunction, Sextile, Square, Trine atau Opposition, pasangan planet, orb dalam derajat, dan fase TEPAT/MENDEKAT/MENJAUH/STASIONER.

Kalau tak ada aspek planet yang searah pada INTI, ditulis "TIDAK ADA ASPEK SEARAH PADA INTI". Tidak mengarang "Moon Sextile Jupiter". Aspek INTI bukan klaim aspek pada saat entry, dan bukan bukti arah harga.

## Live / demo (tanpa CSV manual)
GitHub otomatis menerbitkan feed:
https://raw.githubusercontent.com/EnggarPrasetiyoDaviandhoni/SEKTE-MUSANG-CEBONK-COMPANY-22-/main/ea/liquidity_sweep/weekly_atr/data/weekly_aspects.csv

EA mengambil otomatis tiap 300 detik melalui WebRequest. MT5 Allow WebRequest cukup raw.githubusercontent.com dan api.telegram.org bila Telegram aktif. Feed weekly.csv lama tetap ada dan kompatibel v2.11; EA v2.12 membaca weekly_aspects.csv dengan 8 kolom. Bila feed baru belum ada/HTTP gagal/model tak cocok/minggu tak cocok, EA tak entry baru. Penutupan Jumat tetap jalan.

Strategy Tester tidak mendukung WebRequest: fallback ke CEBONK_ASTRO_WEEKLY_ASPECTS.csv dengan format 8 kolom. Backtest historis butuh data untuk semua minggu yang diuji.

## Contoh susunan Telegram
🦊 SEKTE MUSANG | CEBONK COMPANY 22
🟢 BUY | XAUUSDc | M5
🔮 MULAI ... • INTI ... • AKHIR ... WIB
🌙 ASPEK INTI: [Planet] [Aspek] [Planet] (orb ... deg; MENDEKAT)
🎯 ENTRY ...
🛑 SL ... (3×ATR)
💰 TP ... (RR 1:4)

Nama planet dan aspek diambil dari data sebenarnya. Format lain tetap: TAKE PROFIT 😅, STOP LOSS 🥲, Friday Auto Close 🌙.

## SOP / instalasi
Tidak ada perubahan arah atau risiko: Liquid Sweep M5, SL ATR(14)×3, TP RR1:4, spread70, fixed lot0.01, Friday Auto Close, tanpa BE/trailing/partial, default AUTOPILOT OFF dan live account locked.

HP: unduh dist/CEBONK_LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.12.txt, rename menjadi .mq5, compile MetaEditor. Cara modular: gabungkan EA MQ5 dan LSNotifyEmoji.mqh dalam satu folder Expert. Preset: LIQUIDITY_SWEEP_WEEKLY_AUTO_v2.12.set.

Audit GitHub hanya membuktikan tes model/struktur source, bukan compile MetaEditor atau backtest NOZAX. Uji demo dahulu.