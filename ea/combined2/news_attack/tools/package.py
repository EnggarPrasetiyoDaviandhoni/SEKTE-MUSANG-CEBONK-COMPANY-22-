#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,zipfile
HERE=Path(__file__).resolve().parents[1];D=HERE/'dist'
assert json.loads((D/'VALIDATION.json').read_text())['source_wiring']=='PASS'
files=[p for p in D.iterdir() if p.is_file() and p.suffix!='.zip' and p.name!='SHA256.json']
(D/'SHA256.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)},indent=2)+'\n')
name='CEBONK_COMBINED2_NEWS_ATTACK_v1.10_PAKET.zip'
with zipfile.ZipFile(D/name,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(files+[D/'SHA256.json']):z.write(p,p.name)
 for sub in ('src','tools','tests'):
  for p in sorted((HERE/sub).rglob('*')):
   if p.is_file() and '__pycache__' not in p.parts:z.write(p,'source/'+str(p.relative_to(HERE)))
 z.write(HERE/'README.md','README.md')
print('PACKAGE_OK',name,(D/name).stat().st_size,'bytes; no credentials or EX5')
