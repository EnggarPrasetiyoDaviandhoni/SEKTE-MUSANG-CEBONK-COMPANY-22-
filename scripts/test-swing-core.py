#!/usr/bin/env python3
"""Compile and execute the same .mqh numeric engine using its C++ adapter.
This is a host algorithm test, not MQL5 compilation or a price backtest.
"""
from pathlib import Path
import subprocess
import tempfile
import os
import re
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='cebonk-core-') as directory:
    output=Path(directory)/'core'
    subprocess.run(['g++','-std=c++17','-Wall','-Wextra','-Werror','-pedantic','-fsanitize=address,undefined','-g',str(root/'tests/swing/core.cpp'),'-o',str(output)],check=True)
    # LeakSanitizer cannot run inside some traced sandboxes; address/UB checks stay enabled.
    env=os.environ.copy()
    env['ASAN_OPTIONS']='detect_leaks=0'
    subprocess.run([str(output)],check=True,env=env)
    # Translate only dynamic array declarations; all parser/validator control flow
    # comes directly from the production headers, including hash verification.
    for name in ['JsonParser.mqh','FeedValidator.mqh']:
        content=(root/'MQL5/Include/CebonkSwing'/name).read_text()
        pattern=r'\b([A-Za-z_]\w*)\s+((?:[A-Za-z_]\w*\[\]\s*,\s*)*[A-Za-z_]\w*\[\])\s*;'
        def arrays(match):
            kind=match.group(1)
            names=[s.strip().removesuffix('[]') for s in match.group(2).split(',')]
            return ';'.join(f'std::vector<{kind}> {n}' for n in names)+';'
        (Path(directory)/name).write_text(re.sub(pattern,arrays,content))
    native=Path(directory)/'feed-native'
    subprocess.run(['g++','-std=c++17','-Wall','-Wextra','-Werror','-Wno-misleading-indentation','-pedantic','-fsanitize=address,undefined','-g',
        '-I'+directory,'-I'+str(root/'MQL5/Include/CebonkSwing'),str(root/'tests/swing/feed_native.cpp'),'-lcrypto','-o',str(native)],check=True)
    subprocess.run([str(native),str(root/'tests/swing/fixtures/swing-forecast-v2.valid.json')],check=True,env=env)

    basket=(root/'MQL5/Include/CebonkSwing/BasketManager.mqh').read_text()
    net=basket[basket.index('  bool Net('):basket.index('  bool Risk(')]
    (Path(directory)/'BasketNetUnderTest.mqh').write_text(
        'class CSBasketNetHarness {public: struct {std::vector<long> ids;} state; '
        'string m_symbol;long m_magic;double m_fee,lastNet;bool conflict;int positions; '
        'bool OwnSelected(){return live[selected].magic==m_magic&&std::find(state.ids.begin(),state.ids.end(),live[selected].id)!=state.ids.end();}\n'
        +net+'};\n')
    net_binary=Path(directory)/'basket-net'
    subprocess.run(['g++','-std=c++17','-Wall','-Wextra','-Werror','-pedantic','-fsanitize=address,undefined','-g',
        '-I'+directory,str(root/'tests/swing/basket_net.cpp'),'-lcrypto','-o',str(net_binary)],check=True)
    subprocess.run([str(net_binary)],check=True,env=env)
