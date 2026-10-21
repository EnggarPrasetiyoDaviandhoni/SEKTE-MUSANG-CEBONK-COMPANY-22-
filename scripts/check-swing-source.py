#!/usr/bin/env python3
"""Structural lint only. Does not claim MetaEditor compilation."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
files=list((root/'MQL5').rglob('*.mqh'))+list((root/'MQL5').rglob('*.mq5'))
for path in files:
    text=path.read_text()
    text=re.sub(r'#ifdef __cplusplus\n.*?#else\n(.*?)\n#endif',r'\1',text,flags=re.S)
    for delimiter,target in re.findall(r'#include\s*([<"])([^>"\n]+)[>"]',text):
        if target=='Trade/Trade.mqh': continue  # Native MT5 standard library, verified by MetaEditor later.
        candidate=(root/'MQL5/Include'/target) if delimiter=='<' else path.parent/target
        assert candidate.is_file(),f'{path.name}: missing include {target}'
    text=re.sub(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'',' ',text,flags=re.S)
    assert '#import' not in text,f'{path.name}: external imports are forbidden'
    assert not re.search(r'\b(?:string|double|int|long|bool|datetime|uchar|char|ushort|uint)\s+&?\s*(?:input|new|delete|class|struct|enum|true|false)\b',text),f'{path.name}: reserved identifier'
    stack=[]
    for char in text:
        if char in '([{':stack.append(char)
        elif char in ')]}':
            assert stack and stack.pop()==dict(zip(')]}','([{'))[char],f'{path.name}: delimiter mismatch'
    assert not stack,f'{path.name}: unterminated delimiter'
    if path.suffix=='.mq5': assert '#property strict' in text,f'{path.name}: strict mode missing'
print(f'PASS structural checks on {len(files)} MQL files; MetaEditor/SDK compilation NOT PERFORMED')
