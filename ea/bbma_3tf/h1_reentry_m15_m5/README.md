# CEBONK BBMA H1–M15–M5 v1.03

Status: **experimental / demo / unverified**. This revision has not been compiled with MetaEditor or backtested in MT5.

- H1: BBMA Re-entry directional filter (the implementation uses a MidBB slope proxy, not a strict price-action HH/HL test).
- M15: CSA/CSAK/CSM confirmation and stop-loss reference (upper/lower Bollinger Band, using closed candle).
- M5: CSAK execution trigger.
- RR: fixed 1:2, no breakeven, trailing, or partial close.
- MaxSpreadPoints: 70 (NOZAX XAUUSDc reference).
- Limits: 0.5% projected risk/trade, 2% aggregate projected open risk, 8 concurrent positions, 5% daily drawdown entry pause (initial defaults, not validated).
- Telegram: configured through EA inputs; tokens should never be committed to GitHub.

Files:
- `CEBONK_H1_M15_M5_v1.03.mq5`: editable EA source.
- `CEBONK_H1_M15_M5_v1.03.txt`: identical source for mobile use.
- `PRD_CODEX_CEBONK_H1_M15_M5_v1.03.txt`: specification and acceptance criteria.
- `INSTALL_DAN_UJI_v1.03.txt`: installation and testing guide.

## Mandatory validation before live trading

1. Compile with MetaEditor; fix all errors and warnings.
2. Backtest NOZAX XAUUSDc with realistic ticks/spread, covering 2024–2026, separately per BUY/SELL and per month.
3. Compare with old M15–M5 baseline: WR BUY 38.61%, WR SELL 28.81%, PF 1.13, relative equity DD 17.08% (2024-01-01 through 2026-10-02).
4. Test the H1 filter toggle, session hours, SL at BB M15, order rejection, 1 position = 1 notification, and restart/multi-chart scenarios.
5. Use demo/forward test; there is no guarantee of WR 45%, monthly profitability, or controlled drawdown.
