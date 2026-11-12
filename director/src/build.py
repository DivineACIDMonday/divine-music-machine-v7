# Builds director/index.html: the page with the shared engine and the suite bar inlined.
import pathlib
d = pathlib.Path(__file__).parent
root = d.parent.parent  # divine-music-machine-v7
html = (d / 'app.html').read_text()
eng = (root / 'engine' / 'engine.js').read_text()
press = (root / 'press' / 'src' / 'app.html').read_text()
i = press.index('<script>(function(){try{if(!/\\.github\\.io$/')
suite = press[i:press.rindex('</body>')]
assert '</script' not in eng
html = html.replace('/*ENGINES*/', eng, 1).replace('/*SUITE*/', suite, 1)
(d.parent / 'index.html').write_text(html)
print('built', len(html), 'bytes')
