"""Source checks and actual MQL forecast logic on a C++ API adapter; not MT5 compilation."""
from pathlib import Path
import os,re,subprocess,tempfile
root=Path(__file__).resolve().parents[2]
headers=root/'MQL5/Include/CebonkKillzone'
indicator=root/'MQL5/Indicators/CEBONK_KILLZONE_ASTROLOGY_v1.01.mq5'
downloader=root/'MQL5/Scripts/CEBONK_KILLZONE_WEBREQUEST_v1.01.mq5'
files=[indicator,downloader,*headers.glob('*.mqh')]
for path in files:
    source=re.sub(r'#ifdef __cplusplus\n.*?#endif','',path.read_text(),flags=re.S)
    for delimiter,target in re.findall(r'#include\s*([<"])([^>"\n]+)[>"]',source):
        include=(root/'MQL5/Include'/target) if delimiter=='<' else path.parent/target
        assert include.is_file(),f'{path}: missing {target}'
    stripped=re.sub(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'',' ',source,flags=re.S)
    assert not re.search(r'\b(?:CTrade|OrderSend|OrderSendAsync|OrderCheck|PositionModify|PositionClose|iATR|iMA)\b|#import|CebonkSwing',stripped),f'{path}: non-standalone capability'
    if path!=downloader:assert not re.search(r'\bWebRequest\s*\(',stripped),f'{path}: network call outside downloader script'
    stack=[]
    for c in stripped:
        if c in '([{':stack.append(c)
        elif c in ')]}':assert stack and stack.pop()==dict(zip(')]}','([{'))[c],path
    assert not stack,path
assert '#property indicator_chart_window' in indicator.read_text()
assert 'OnCalculate(' in indicator.read_text() and 'OnTick(' not in indicator.read_text()
assert 'void OnStart()' in downloader.read_text() and 'WebRequest("GET"' in downloader.read_text() and 'OnTick(' not in downloader.read_text()
print(f'PASS standalone/source checks on {len(files)} MQL files; WebRequest only in downloader script; no trade APIs or other strategy modules',flush=True)
with tempfile.TemporaryDirectory(prefix='cebonk-killzone-') as directory:
    for path in headers.glob('*.mqh'):
        source=path.read_text()
        pattern=r'\b([A-Za-z_]\w*)\s+((?:[A-Za-z_]\w*\[\]\s*,\s*)*[A-Za-z_]\w*\[\])\s*;'
        def arrays(m):
            return ';'.join(f'std::vector<{m.group(1)}> {v.strip().removesuffix("[]")}' for v in m.group(2).split(','))+';'
        (Path(directory)/path.name).write_text(re.sub(pattern,arrays,source))
    binary=Path(directory)/'forecast'
    subprocess.run(['g++','-std=c++17','-Wall','-Wextra','-Werror','-Wno-misleading-indentation','-pedantic','-fsanitize=address,undefined','-g',
        '-I'+directory,str(root/'tests/killzone/forecast_native.cpp'),'-lcrypto','-o',str(binary)],check=True)
    env=os.environ.copy();env['ASAN_OPTIONS']='detect_leaks=0'
    subprocess.run([str(binary),str(root/'tests/killzone/forecast.valid.json'),str(root/'tests/killzone/forecast.synthetic.json'),str(root/'tests/killzone/calendar.csv')],env=env,check=True)
