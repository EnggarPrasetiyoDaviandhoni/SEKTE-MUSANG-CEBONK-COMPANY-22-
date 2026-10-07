# CEBONK BBMA CSAK-CSM 3TF

EA MT5 standalone untuk alur tetap:

**M15 CSAK -> M5 CSM -> M1 CSM -> MARKET ENTRY**

## Rule entry

### 1. M15 CSAK = bias arah
M15 hanya valid jika candle sudah **close** dan memenuhi salah satu:
- **Dominant Break BUY**: bullish, body/range >= 0.60, close > high candle sebelumnya, body >= 1.10x body sebelumnya.
- **Dominant Break SELL**: kebalikan BUY.
- **Bullish/Bearish Engulfing**: body engulf candle sebelumnya, body/range >= 0.50.

Selain pola di atas, close M15 harus berada di sisi yang benar terhadap MidBB:
- BUY: close > MidBB.
- SELL: close < MidBB.

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
- TP = jarak entry-ke-SL x **2.0** (RR 1:2).

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
- RR: 1:2.
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
Entry: 0000.00
SL: 0000.00
TP: 0000.00
RR: 1:2.0
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
