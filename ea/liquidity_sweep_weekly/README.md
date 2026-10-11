# CEBONK COMPANY 22 — Liquidity Sweep + Astrology Mingguan MT5 v1.00

**Proyek baru, terpisah dari EA Liquidity Sweep v1.03.** Model arah adalah **Astrology Mingguan asli** di halaman ASTROLOGY (Senin–Jumat 06:00–24:00 WIB), **bukan** arah EMA, tren teknikal, atau CSV Astrology Combined2 bulanan.

## SOP

- **Arah**: dominasi Astrology mingguan BUY atau SELL minimal 55% dari menit berlabel arah menurut assets/astro-weekly-core.js (model V1 **eksperimental, belum terbukti menghasilkan keuntungan**).
- **MULAI – INTI – AKHIR**: entry hanya antara start_epoch (inklusif) dan end_epoch (eksklusif). Inti adalah waktu puncak skor sebagai referensi, tanpa filter ketat tambahan. Menggunakan **maksimal lima** kandidat searah dominasi dari scanner asli, tidak memaksakan sinyal setiap hari.
- **Entry M5**: candle M5 **sudah close** menyapu lower low dari 12 candle sebelumnya lalu close kembali di atas level itu => BUY; kebalikan untuk SELL. Jika kedua sisi disapu dalam satu candle, **skip ambigu**. Tidak wajib BOS, CHOCH, FVG, tiga timeframe, atau retest kedua.
- **SL**: nominal **3 × ATR(14) M5**, dihitung dari harga quote entry saat order.
- **TP**: nominal **4 × jarak Entry–SL** setelah pembulatan tick; setara kira-kira **12 × ATR**, tidak dijamin persis setelah slippage/gap.
- Tanpa BEP, trailing stop, martingale, recovery, atau partial close. Fixed lot default **0.01**; tidak ada kalkulasi persen risiko.
- **Spread**: maksimal 70 points; validasi volume min/step, jarak stop broker, quote, arah trade, autopilot, dan lock akun real.
- **ANTI-DUPLIKAT**: satu evaluasi per M5 candle, GlobalVariable setelah order diterima agar tidak entry ulang pasca-restart.
- **JUMAT**: posisi **milik magic EA ini saja** dicoba untuk ditutup mulai 5 menit **sebelum sesi perdagangan Jumat terakhir** menurut SymbolInfoSessionTrade broker. Berlaku sekalipun AUTOPILOT OFF/CSV hilang. Senin–Kamis tidak ditutup paksa.
- Bila sesi Jumat tidak tersedia, entry Jumat diblokir (fail-closed). Penutupan tidak dijamin jika broker menolak close, sesi berhenti mendadak, platform offline, atau tidak ada likuiditas.

## Menghubungkan Astrology mingguan (WAJIB)

Arah model tidak dapat dihitung langsung oleh EA MQL5 ini tanpa menjalankan Astronomy Engine web. **EA tidak menghitung Astrology live secara mandiri.** Gunakan *ekspor mingguan asli*:

1. Buka halaman web milikmu, pilih **ASTROLOGY → ASTROLOGY MINGGUAN · SENIN–JUMAT**.
2. Pilih minggu saat ini, klik **Hitung Mingguan** sampai selesai.
3. Jika terdapat kandidat, klik **Unduh CSV EA MT5**. Unduhan bernama CEBONK_ASTRO_WEEKLY.csv, berasal langsung dari hasil scanner yang sebenarnya (bukan sinyal contoh).
4. Salin ke MT5 → File → Open Data Folder → MQL5 → Files. Untuk InpCSVCommonFolder=true (live saja), salin ke common terminal Files. Untuk Strategy Tester, file harus tersedia sebelum compile/pack, sesuai #property tester_file.
5. **Ganti setiap minggu** dengan CSV hasil hitungan terbaru. EA mencoba baca ulang file setiap 30 detik. CSV satu minggu **tidak** berlaku untuk minggu lain. Jika tidak ada kandidat, CSV hilang/korup, tanggal salah, dominasi campuran, atau window telah lewat, **EA tidak entry**.
6. Taruh CEBONK_LS_ASTRO_WEEKLY_v1.00.mq5 di MQL5/Experts, compile di MetaEditor, attach ke chart **XAUUSDc** (TF chart bebas), periksa tab Experts/Journal.
7. Aktifkan Algo Trading dan **AUTOPILOT ON**. Default **OFF** dan akun real terkunci; hanya set InpAllowRealAccount=true jika sengaja ingin transaksi real. Uji dulu di Strategy Tester/demo.
8. Telegram opsional: isi token/chat ID input EA (jangan commit token di repo), set InpTelegram=true, izinkan WebRequest https://api.telegram.org di Options → Expert Advisors. MT5 Push diatur via Notifications.

## Format CSV

Header tepat:
week_monday_wib,week_direction,date_wib,start_epoch,core_epoch,end_epoch,window_direction,model

Tiap baris memuat satu window arah BUY/SELL, waktu Unix detik UTC **MULAI–INTI–AKHIR**, tanggal window WIB, tanggal Senin minggu itu, dan model CEBONK_ASTRO_WEEKLY_V1. Semua harus kelipatan lima menit. Jika web menghasilkan dominasi campuran/tiada kandidat, tidak ada sinyal dapat dieksekusi.

## Pengujian dan batasan

Jalankan node tests/astro-weekly.test.cjs untuk regresi model+CSV, dan python3 ea/liquidity_sweep_weekly/tests/test_source.py untuk cek source. GitHub Actions hanya memvalidasi JavaScript serta source secara statis. **Belum dibuktikan compile MetaEditor, backtest 2024–2026, profitabilitas, atau eksekusi broker real.**

Fixed lot dengan SL 3 ATR dapat menghasilkan risiko moneter besar saat volatilitas tinggi. Periksa spesifikasi kontrak akun broker, lot, dan slippage. Tidak ada jaminan profit atau pencapaian RR 1:4.
