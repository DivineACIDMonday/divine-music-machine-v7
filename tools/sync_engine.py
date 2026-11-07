# Writes engine/engine.js into every app page (inline, so each page stays one self-contained file), then builds the Studios.
# Usage: python3 tools/sync_engine.py "<version>"
import re, sys, subprocess, os
V = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE = open(V + '/engine/engine.js', encoding='utf8').read()
PAGES = ['index.html', 'lite/index.html', 'groove/index.html', 'ujam/index.html', 'ujam/lite/index.html', 'ujam/groove/index.html', 'lite/ujam/index.html', '../divine-groove-machine/index.html']
for p in PAGES:
    f = os.path.normpath(os.path.join(V, p))
    if not os.path.exists(f): print('skip', p); continue
    s = open(f, encoding='utf8').read()
    hits = [m for m in re.finditer(r'(<script(?:[^>]*)>)(.*?)(</script>)', s, re.S) if 'E.renderBar = function' in m.group(2)]
    assert len(hits) == 1, p
    m = hits[0]
    s = s[:m.start(2)] + ENGINE + s[m.end(2):]
    open(f, 'w', encoding='utf8').write(s)
    print('synced', p)
for t in [V + '/tools/studio/build.py']:
    if os.path.exists(t): subprocess.run(['python3', t, sys.argv[1] if len(sys.argv) > 1 else 'dev'], check=True)
