#!/usr/bin/env python3
"""Build symphony/index.html: the app page with the engine inline."""
import os
here = os.path.dirname(os.path.abspath(__file__))
app = open(os.path.join(here, 'app.html'), encoding='utf-8').read()
eng = open(os.path.join(here, 'sym-engine.js'), encoding='utf-8').read()
out = app.replace('/*ENGINE*/', eng, 1)
open(os.path.join(here, '..', 'index.html'), 'w', encoding='utf-8').write(out)
print('built', len(out), 'bytes')
