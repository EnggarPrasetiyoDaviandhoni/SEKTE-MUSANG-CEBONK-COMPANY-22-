"""Package the Killzone-only indicator and native MT5 WebRequest downloader script."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from hashlib import sha256
import json
root=Path(__file__).resolve().parents[1]
project=root/'indicators/astro_killzone'
out=project/'dist/CEBONK_KILLZONE_ASTROLOGY_WEBREQUEST_v1.01_SOURCE.zip'
out.parent.mkdir(parents=True,exist_ok=True)
entries={
 'MQL5/Indicators/CEBONK_KILLZONE_ASTROLOGY_v1.01.mq5':root/'MQL5/Indicators/CEBONK_KILLZONE_ASTROLOGY_v1.01.mq5',
 'MQL5/Scripts/CEBONK_KILLZONE_WEBREQUEST_v1.01.mq5':root/'MQL5/Scripts/CEBONK_KILLZONE_WEBREQUEST_v1.01.mq5',
 'MQL5/Files/README_KILLZONE_WEB.txt':project/'CACHE_README.txt',
 'BACA_DULU.md':project/'README.md',
}
for path in (root/'MQL5/Include/CebonkKillzone').glob('*.mqh'):entries[path.relative_to(root).as_posix()]=path
for relative in ['SOURCE_AUDIT.json']:
 entries[relative]=project/relative
for directory in ['evidence']:
 for path in (project/directory).rglob('*'):
  if path.is_file():entries[path.relative_to(project).as_posix()]=path
entries['scripts/Install-Killzone.ps1']=project/'scripts/Install-Killzone.ps1'
manifest={name:sha256(path.read_bytes()).hexdigest() for name,path in sorted(entries.items())}
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=9) as archive:
 for name,path in sorted(entries.items()):archive.write(path,name)
 archive.writestr('SHA256SUMS.json',json.dumps(manifest,indent=2)+'\n')
 archive.writestr('BUILD_STATUS.json',json.dumps({'artifact':'MT5 Killzone-only indicator and WebRequest downloader script source','version':'1.01','metaeditor':'NOT_COMPILED','mt5_native_webrequest':'NOT_RUN','mt5_runtime':'NOT_RUN','powershell':'NOT_RUN','orders':False,'trading_ea_required':False,'node_on_client_required':False,'ex5_included':False},indent=2)+'\n')
with ZipFile(out) as archive:
 assert archive.testzip() is None
 assert not any(name.lower().endswith('.ex5') or '/Experts/' in name or 'CebonkSwing' in name for name in archive.namelist())
 assert not any(name.lower().endswith(('.js','.mjs','.cjs')) for name in archive.namelist())
 assert 'MQL5/Files/cebonk-killzone-forecast-v1.json' not in archive.namelist()
print(json.dumps({'file':str(out),'files':len(entries)+2,'bytes':out.stat().st_size,'sha256':sha256(out.read_bytes()).hexdigest()}))
