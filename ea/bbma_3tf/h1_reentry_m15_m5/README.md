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

## Anti-layer H1-M15 SetupID (patch to v1.03)

Each execution setup is identified by **(H1 Re-entry candle time, M15 confirmation candle time, BUY/SELL direction)**; the triggering M5 CSAK candle time is **not** part of SetupID. H1 OFF means H1 time=0, so M15 confirmation time and direction identify the setup. One setup can attempt **at most one order**, even after additional M5 CSAKs or an MT5 restart. A newly detected H1 or M15 event constitutes a new setup and may open a position while an older position is still active **if it passes the existing combined risk and position limits**.

Implementation: under the shared account/server/symbol/Magic lock, the EA atomically claims the M5 bar and the SetupID using persistent terminal global variables before submitting the broker order. The short order comment embeds the same SetupID for history-based recovery if local state expires. Existing per-position Telegram/MT5 notification dedup stays unchanged. Rejected/ambiguous broker submissions retain the setup claim by design to prevent an unintended second order; the next genuinely new setup remains eligible.

**Upgrade warning:** positions opened by a previous version use old M5-only comments and cannot reliably be mapped back to a new H1-M15 SetupID. Do not run mixed old/new builds under the same Symbol/Magic, and plan the upgrade without assuming pre-upgrade entries are automatically deduplicated. Existing positions are not forcibly closed. Multiple independent MT5 terminals do not share terminal global variables, and broker order comments can be altered; test such scenarios carefully.

Manual scenarios (NOT YET EXECUTED in MetaEditor/MT5):

| Scenario | Expected |
| --- | --- |
| Same H1+M15+direction with 2+ later M5 CSAKs | Only first eligible entry |
| New M15 event, same H1/direction | New entry permitted if risk gates pass |
| New H1 event, same M15/direction | Distinct SetupID by definition |
| BUY vs SELL event | Different setup identity |
| Restart EA within a live setup | No duplicate entry |
| Two charts same symbol+Magic in one terminal | Atomic shared claim prevents duplicates |
| H1 filter OFF | One per M15 event+direction |
| Order refused or response ambiguous | Claim retained; no replay for same setup |
| M15 BB SL / TP RR 1:2 | Unchanged |
| Partial fill / MT5 push / Telegram | One notification per position ID, subject to delivery availability |

**Validation status:** 16 static consistency checks passed while preparing the GitHub patch; no MetaEditor compile, historical tester run or demo forward execution has been performed for this patch.
