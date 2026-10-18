#!/usr/bin/env python3
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from hashlib import sha256
import json
root=Path(__file__).resolve().parents[1]
project=root/'ea/astro_swing_berjanggut'
output=project/'dist/CEBONK_ASTRO_SWING_BERJANGGUT_v1.10_SOURCE.zip'
output.parent.mkdir(parents=True,exist_ok=True)
entries={}
for path in (root/'MQL5').rglob('*'):
    if path.is_file() and path.suffix.lower() in {'.mq5','.mqh','.csv','.jsonl','.set'}:
        entries[path.relative_to(root).as_posix()]=path
for path in (project/'docs').glob('*.md'):entries['docs/'+path.name]=path
for path in (project/'evidence').glob('*'):
    if path.is_file():entries['evidence/'+path.name]=path
entries['BACA_DULU.md']=project/'README.md'
entries['scripts/compile-swing.ps1']=root/'scripts/compile-swing.ps1'
entries['feed/swing-forecast-v2.schema.json']=root/'data/ea/swing-forecast-v2.schema.json'
entries['feed/swing-forecast-v2.json']=root/'data/ea/swing-forecast-v2.json'
manifest={name:sha256(path.read_bytes()).hexdigest() for name,path in sorted(entries.items())}
with ZipFile(output,'w',ZIP_DEFLATED,compresslevel=9) as archive:
    for name,path in sorted(entries.items()):archive.write(path,name)
    archive.writestr('SHA256SUMS.json',json.dumps(manifest,indent=2)+'\n')
    archive.writestr('BUILD_STATUS.json',json.dumps({'artifact':'MQL5 source package','version':'1.10','metaeditor':'NOT_COMPILED','strategy_tester':'NOT_RUN','broker_demo_or_live':'NOT_RUN','ex5_included':False},indent=2)+'\n')
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert not any(n.lower().endswith('.ex5') for n in archive.namelist())
print(json.dumps({'zip':str(output),'bytes':output.stat().st_size,'files':len(entries)+2,'sha256':sha256(output.read_bytes()).hexdigest()}))
