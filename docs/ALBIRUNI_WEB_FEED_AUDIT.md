# Audit AL-BIRUNI website–EA

The GitHub-published CSV at `ea/albiruni_intraday/data/intraday.csv` is the EA's execution input. The web's interactive aspect analysis is a separate research interface and its browser-only preferences do not change the EA feed.

The current feed generator uses fixed 07:00–23:00 WIB candidate selection while the EA v1.01 no longer adds such a clock gate. The web research period-entry calculation and feed-entry rule also differ.

Do not deploy a modified signal calculation to live trading without consistency tests and independent XAUUSD historical validation. Preserve fail-closed behavior, live-account lock, and existing EA risk limits.
