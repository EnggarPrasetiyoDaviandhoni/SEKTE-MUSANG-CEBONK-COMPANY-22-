# NEW EXPERIMENTAL VARIANT v1.06 — M5 CB1 DIRECT ENTRY

Source: `CEBONK_H1_M15_M5_v1.06_CB1_NO_LAYER.mq5` (and identical `.txt`).
The former v1.05 M5-**CSAK** version remains unchanged for A/B backtest. v1.06 uses **M5 CB1 close-break entry** instead, preserving H1 Re-entry → M15 CSA/CSAK/CSM filters, NO-LAYER one position, BB stop-TF selector, RR 1:2, risk controls and 1 position=1 fill notification.

See [README_CB1_v1.06.md](README_CB1_v1.06.md) for exact closed-swing CB1 algorithm, limitations and validation matrix. **This version has NOT been compiled in MetaEditor or backtested in MT5; use only in demo research until verified.** Remove old EA instances from all charts and check the startup banner before testing.

---

# CURRENT REQUIRED BUILD: v1.05 NO-LAYER + SELECTABLE BB SL TF

Use `CEBONK_H1_M15_M5_v1.05_NO_LAYER_TF_SL.mq5` (matching `.txt` for mobile). v1.03 and v1.04 are legacy references; do not compile them for the new selectable-SL behavior.

## New input

`input ENUM_TIMEFRAMES TF_StopLoss=PERIOD_M15;`

- Default `PERIOD_M15`: old SL behavior preserved.
- Change to M5, M30, H1, H4, or another valid fixed MT5 timeframe in EA Inputs; PERIOD_CURRENT is rejected to avoid chart-dependent changes.
- BUY SL = lower Bollinger Band (BBPeriod=20, deviation=2) at last CLOSED bar of selected SL timeframe (shift=1), minus optional SLBufferPoints.
- SELL SL = upper Bollinger Band at the last CLOSED bar (shift=1), plus optional SLBufferPoints.
- TP = 2x entry-to-SL distance (fixed RR 1:2) with existing tick rounding and broker StopsOK checks; no BE/trailing/partial.
- H1 Re-entry, M15 CSA/CSAK/CSM, M5 CSAK remain the only filter/confirmation/entry sequence. Selecting TF_StopLoss does NOT move these signal timeframes.
- NO-LAYER remains a hard 1 position + zero pending order rule per Symbol+Magic, even when EnableRiskGuard=false; old positions are never auto-closed.
- Telegram/MT5 position entry notification includes the chosen SL timeframe (e.g. `SL BB H1`).

## Safe deployment

1. Remove old versions from ALL charts first, including META AI.ex5, then compile **v1.05** using F7 in MetaEditor.
2. In Experts confirm startup log `CEBONK v1.05 NO-LAYER STARTED`, including `stop=BB <TF> CLOSED`.
3. Set TF_StopLoss=M15 (baseline) or the preferred MT5 timeframe, and MaxConcurrentPositions=1. Do not load old `.set` values without reviewing them.
4. On NOZAX demo test M5/M15/H1 selected stop TF individually: inspect the last closed indicator band's price vs each filled position's SL; check RR 1:2, skip invalid stops, and no duplicate entries.
5. Backtest the FULL 2024–2026 period per BUY/SELL and monthly before live use. Changing SL timeframe changes stop distance, trade risk, exit distribution, and probably win rate / DD. Different TFs are NOT validated.

WARNING: Compile and MT5 Strategy Tester have NOT been run for v1.05. Uploading to GitHub does not update an installed `.ex5`.

---
# PRIOR BUILD (ARCHIVE): v1.04 NO-LAYER

Prior build: CEBONK_H1_M15_M5_v1.04_NO_LAYER.mq5. Older v1.03 remains for audit and may still open overlapping positions from different setups.

v1.04 enforces ONE open position plus zero pending orders for Symbol+Magic under a shared terminal lock, independently of EnableRiskGuard. MaxConcurrentPositions defaults to 1 and any other value prevents initialization. New H1-M15 setups must wait for prior positions to close, and a fresh M5 trigger is required. No automatic position closure.

UPGRADE: remove old v1.03 / META AI EA from ALL charts; compile v1.04 in MetaEditor using F7; check Experts log for CEBONK v1.04 NO-LAYER STARTED; reset old .set inputs (MaxConcurrentPositions=1) and use demo testing. GitHub upload does not update any installed .ex5 file. Other Magic numbers and independent MT5 terminals are outside this gate.

---
# CEBONK BBMA H1–M15–M5 historical v1.03

Status: **experimental / demo / unverified**. This revision has not been compiled with MetaEditor or backtested in MT5.

- H1: BBMA Re-entry directional filter (the implementation uses a MidBB slope proxy, not a strict price-action HH/HL test).
- M15: CSA/CSAK/CSM confirmation and stop-loss reference (upper/lower Bollinger Band, using closed candle).
- M5: CSAK execution trigger.
- RR: fixed 1:2, no breakeven, trailing, or partial close.
- MaxSpreadPoints: 70 (NOZAX XAUUSDc reference).
- Limits: 0.5% projected risk/trade, 2% aggregate projected open risk, 1 concurrent position (v1.04 NO-LAYER), 5% daily drawdown entry pause (initial defaults, not validated).
- Telegram: configured through EA inputs; tokens should never be committed to GitHub.

Files:
- CEBONK_H1_M15_M5_v1.04_NO_LAYER.mq5: CURRENT EA source (strict no-layer).
- CEBONK_H1_M15_M5_v1.04_NO_LAYER.txt: identical mobile source.
- CEBONK_H1_M15_M5_v1.03.mq5: legacy reference only, may stack from new setups.
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

Each execution setup is identified by **(H1 Re-entry candle time, M15 confirmation candle time, BUY/SELL direction)**; the triggering M5 CSAK candle time is **not** part of SetupID. H1 OFF means H1 time=0, so M15 confirmation time and direction identify the setup. One setup can attempt **at most one order**, even after additional M5 CSAKs or an MT5 restart. A newly detected H1 or M15 event is a new setup, but v1.04 allows entry ONLY after previous EA positions and pending orders for the same Symbol+Magic are fully closed/settled.

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

## v1.04 NO-LAYER validation (NOT RUN in MetaEditor or MT5)

- F7 compile the v1.04_NO_LAYER MQ5 and review all diagnostics.
- Existing EA position plus new H1/M15 SetupID => log WHY_SKIP=WAIT_POSITION_CLOSE; 0 new entries.
- Matching pending EA order => WHY_SKIP=WAIT_PENDING_ORDER; 0 new entries.
- Disable EnableRiskGuard => hard one-position cap must remain effective.
- Load old .set with MaxConcurrentPositions=8 => initialization must reject invalid config.
- After old position closes, a genuinely new setup with new closed M5 trigger may enter.
- Restart/two charts => same Symbol+Magic must never have two EA positions at once.
- Check M15 BB SL and fixed RR 1:2 unchanged; one notification per filled position.
- Verify startup marker (v1.04 NO-LAYER), old v1.03 EA instances removed.
- Backtest realistic NOZAX XAUUSDc 2024–2026 and demo forward test.

Other EAs with different Magic, independent terminals, or altered broker comments are outside global protection. Do not live-trade before validation.