import json
import urllib.request
from pathlib import Path

url = 'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=6mo'
request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(request, timeout=30) as response:
    data = json.load(response)
result = data['chart']['result'][0]
quote = result['indicators']['quote'][0]
rows = []
for i, ts in enumerate(result['timestamp']):
    values = [quote[k][i] for k in ('open', 'high', 'low', 'close')]
    if all(isinstance(v, (int, float)) and v > 0 for v in values):
        rows.append(dict(timestamp=ts, open=values[0], high=values[1], low=values[2], close=values[3]))
if len(rows) < 61:
    raise RuntimeError('Insufficient D1 candles')
output = Path('data/ipda/yahoo-gold-d1.json')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'symbol': 'GC=F', 'source': 'Yahoo Finance', 'candles': rows[-90:]}, indent=2))
