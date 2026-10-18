"""Package only the standalone custom indicator and its offline forecast calculator."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from hashlib import sha256
import json
root=Path(__file__).resolve().parents[1]
project=root/'indicators/astro_killzone'
out=project/'dist/CEBONK_KILLZONE_ASTROLOGY_v1.00_SOURCE.zip'
out.parent.mkdir(parents=True,exist_ok=True)
entries={
 'MQL5/Indicators/CEBONK_KILLZONE_ASTROLOGY_v1.00.mq5':root/'MQL5/Indicators/CEBONK_KILLZONE_ASTROLOGY_v1.00.mq5',
 'MQL5/Files/cebonk-killzone-forecast-v1.json':root/'MQL5/Files/cebonk-killzone-forecast-v1.json',
 'BACA_DULU.md':project/'README.md',
}
for path in (root/'MQL5/Include/CebonkKillzone').glob('*.mqh'):entries[path.relative_to(root).as_posix()]=path
for relative in ['generate.mjs','package.json','SOURCE_AUDIT.json','THIRD_PARTY_NOTICES.txt']:
 entries[relative]=project/relative
for directory in ['lib','scripts','vendor','evidence']:
 for path in (project/directory).rglob('*'):
  if path.is_file():entries[path.relative_to(project).as_posix()]=path
manifest={name:sha256(path.read_bytes()).hexdigest() for name,path in sorted(entries.items())}
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=9) as archive:
 for name,path in sorted(entries.items()):archive.write(path,name)
 archive.writestr('SHA256SUMS.json',json.dumps(manifest,indent=2)+'\n')
 archive.writestr('BUILD_STATUS.json',json.dumps({'artifact':'Standalone MT5 custom indicator source','version':'1.00','metaeditor':'NOT_COMPILED','mt5_runtime':'NOT_RUN','powershell':'NOT_RUN','orders':False,'ea_required':False,'ex5_included':False},indent=2)+'\n')
with ZipFile(out) as archive:
 assert archive.testzip() is None
 assert not any(name.lower().endswith('.ex5') or '/Experts/' in name or 'CebonkSwing' in name for name in archive.namelist())
print(json.dumps({'file':str(out),'files':len(entries)+2,'bytes':out.stat().st_size,'sha256':sha256(out.read_bytes()).hexdigest()}))
