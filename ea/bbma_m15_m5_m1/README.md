# CEBONK BBMA CSAK-CSM 3TF

EA MT5 standalone untuk alur tetap:

**M15 CSAK -> M5 CSM -> M1 CSM -> MARKET ENTRY**

## Rule entry

### 1. M15 = 4 setup + CSAK wajib
Candle M15 pemicu harus membentuk **CSAK** lebih dulu:
- body/range >= 0.50,
- cross MidBB sesuai arah,
- BUY close di bagian atas candle (default >= 0.60),
- SELL close di bagian bawah candle (default <= 0.40).

Sesudah CSAK valid, M15 harus masuk salah satu dari **4 jalur setup**:

1. **IB + CSAK**
   - candle sebelum CSAK adalah Inside Bar terhadap mother candle,
   - BUY: CSAK close menembus high Inside Bar,
   - SELL: CSAK close menembus low Inside Bar.

2. **CB1 + CSAK**
   - CB1 diperlakukan sebagai level pivot struktur M15 terdekat, bukan rolling-high/low breakout,
   - BUY: CSAK close menembus pivot high terkonfirmasi,
   - SELL: CSAK close menembus pivot low terkonfirmasi,
   - default pencarian pivot = 8 candle M15 sebelumnya.

3. **Dominant Break + CSAK**
   - candle CSAK juga harus memenuhi Dominant Break,
   - body/range >= 0.60,
   - body >= 1.10x body candle sebelumnya,
   - BUY close > high sebelumnya / SELL close < low sebelumnya.

4. **Engulfing + CSAK**
   - candle CSAK juga harus engulf body candle sebelumnya,
   - body/range >= 0.50.

Jika tidak ada salah satu dari empat kombinasi di atas, setup M15 tidak valid.

### 2. M5 CSM = konfirmasi
CSM memakai candle close:
- body/range >= 0.55,
- cross MidBB searah bias M15,
- close berada dekat extreme candle,
- BB tidak contracting.

### 3. M1 CSM = trigger
M1 harus membentuk CSM baru yang searah M15 dan M5.
Urutan menggunakan **waktu close candle**, bukan waktu open:
M15 confirmed -> M5 confirmed -> M1 confirmed.

### 4. Sideways skip
Filter sideways dihitung di M5:
- BB width sempit terhadap ATR14, dan
- slope MidBB datar.

Default:
- BB width <= 2.00 x ATR14
- perubahan MidBB 3 bar <= 0.25 x ATR14

Jika dua kondisi terpenuhi, EA tidak entry.

### 5. SL / TP
- BUY: SL = **Low BB M5**.
- SELL: SL = **Top BB M5**.
- Default buffer = 0 point.
- TP = jarak entry-ke-SL x **InpRiskReward**. Default **2.0**, tetapi bisa diganti dari input EA (mis. 1.5, 2.0, 3.0).

EA tidak memaksa/melebarkan SL jika jarak SL tidak memenuhi minimum stop broker. Trade akan di-skip.

## Jam entry / GMT broker otomatis
- Entry hanya diizinkan **07:00 sampai sebelum 00:00** menurut **waktu server broker MT5**.
- EA membaca `TimeTradeServer()` secara otomatis; tidak ada input GMT manual.
- Offset broker terhadap GMT ikut dipindai otomatis untuk informasi log saat EA start.
- Jika broker mengubah offset/DST, session tetap mengikuti jam server broker saat itu.
- Di luar session, sinyal boleh terbentuk tetapi **order baru tidak dieksekusi**.

## Defaults penting
- Bollinger Bands: Period 20, Deviation 2.0.
- Fixed lot: 0.01.
- Max spread: 70 points.
- RR default: 1:2, **bisa diganti** lewat `InpRiskReward`.
- Session broker: 07:00-00:00.
- GMT broker: auto-scan dari server MT5.
- M15 signal age: 4 bars.
- M5 signal age: 6 bars.
- MaxOpenPositions: 0 = tidak dibatasi oleh EA; anti-duplicate tetap aktif per M1 trigger.
- UI chart: hanya tombol **AUTOPILOT ON/OFF**.

## File
- `CEBONK_BBMA_CSAK_CSM_3TF.mq5` = source EA.
- `CEBONK_BBMA_CSAK_CSM_3TF_DEFAULT.set` = preset default.

## Telegram
Notifikasi dikirim **hanya setelah order sukses**. Format dibuat ringkas:

```
BBMA BUY | XAUUSDc
TF: M15 > M5 > M1
M15: IB + CSAK
Entry: 0000.00
SL: 0000.00
TP: 0000.00
RR: mengikuti input InpRiskReward
```

Input:
- `InpTelegramEnabled=true`
- `InpTelegramBotToken` = token bot Telegram.
- `InpTelegramChatID` = chat ID tujuan.
- `InpTelegramTimeoutMs=5000`

Di MT5 buka **Tools > Options > Expert Advisors**, centang **Allow WebRequest for listed URL**, lalu tambahkan:
`https://api.telegram.org`

Token dan Chat ID sengaja tidak disimpan di repository.

## Backtest
Backtest dengan **Every tick based on real ticks**. Evaluasi BUY dan SELL terpisah, drawdown, profit factor, expectancy, serta net profit per bulan. Jangan anggap rule ini profitable sebelum hasil backtest membuktikannya.
