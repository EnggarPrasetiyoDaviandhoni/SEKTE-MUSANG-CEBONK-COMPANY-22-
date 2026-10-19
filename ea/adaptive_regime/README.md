# CEBONK ADAPTIVE REGIME EA v1.00

EA iki kapisah saka Combined 1, Combined 2, BBMA WEB, lan Liquidity Sweep lawas. Fokus utama: market-regime routing, execution sing bisa diaudit, lan capital protection.

## Timeframe package selector
- H4 -> H1 -> M15
- H1 -> M15 -> M5 (default)
- M15 -> M5 -> M1

Ora nganggo tumpukan true/false kanggo package. Siji package dipilih saka input.

## Regime routing
TF1 nggunakake confirmed swing structure lan directional efficiency.
- TREND: HH/HL utawa LH/LL + efficiency cukup kuat.
- RANGE: efficiency cilik.
- TRANSITION: kondisi antarane loro mau.

TREND engine:
TF1 BBMA Re-entry -> TF2 CSAK/CSM style momentum -> TF3 IB -> CB1 close break -> first Zone IB retest -> market entry.

RANGE / TRANSITION engine:
TF1 confirmed swing liquidity -> TF2 sweep + displacement + structure break -> TF3 first retest -> market entry.

Kabeh sinyal nganggo closed candle.

## Risk baseline
Default v1.00 sengaja konservatif:
- AUTOPILOT OFF.
- Real account LOCKED.
- Fixed lot 0.01.
- Hard max lot 0.05.
- Optional risk sizing 0.25% equity/trade.
- RR 1:2.
- Max spread 70 points.
- Maksimal 1 posisi/pending order per symbol.
- Daily account loss kill switch 2%.
- Maksimal 3 entry saben broker day.
- 2 consecutive EA losses -> cooldown 120 menit.
- Structural SL divalidasi 0.8 sampai 3.0 ATR.
- Ora ana martingale.
- Ora ana recovery lot.
- Ora ana layering.
- Ora ana BE/BEP.
- Ora ana trailing.
- Ora ana partial close.

Broker entry session default 07:00-23:00 wektu server. Posisi sing wis kebuka ora dipaksa tutup nalika session rampung.

## Notification
Entry notification mung dikirim saka OnTradeTransaction nalika fill. Maksude: siji fill entry = siji notifikasi. Telegram token lan Chat ID ora disimpen ing repository.

Kanggo Telegram, tambah https://api.telegram.org ing MT5 Allow WebRequest.

## Validation
v1.00 ora njanjeni profit, win rate, utawa kabeh bulan profit. Sadurunge real account:
1. Compile MetaEditor.
2. Strategy Tester XAUUSDc 2024-2026 nganggo real ticks.
3. Pisah statistik BUY lan SELL.
4. Audit PF, expectancy, max DD, consecutive losses, trade count, lan net profit saben bulan.
5. Walk-forward / out-of-sample.
6. Demo forward test.

Yen hasil ora lolos KPI, rule sing gagal sing diganti. Lot ora digedhekake kanggo recovery.
