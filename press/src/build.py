# Builds press/index.html from src: the Journey engine with the press on top, all inlined.
import pathlib
d = pathlib.Path(__file__).parent
html = (d / 'app.html').read_text()
root = d.parent.parent  # divine-music-machine-v7
def wrap(name, src):  # each engine in its own scope, so their helpers never collide
    return 'window.%s = (function () { var module; %s\n; return %s; })();' % (name, src, name)
score_src = (root / 'score' / 'index.html').read_text().split('\n')
a = next(i for i, l in enumerate(score_src) if l.startswith('/* Divine Score Machine engine'))
z = next(i for i, l in enumerate(score_src) if l.startswith('})(typeof window'))
engines = '\n'.join([
    (root / 'engine' / 'engine.js').read_text(),  # exposes window.DMM
    (root.parent / 'divineacidmonday.github.io' / 'percussion' / 'src' / 'perc-engine.js').read_text(),
    '\n'.join(score_src[a:z + 1]),
    (root / 'symphony' / 'src' / 'sym-engine.js').read_text(),  # exposes window.SYM
])
jd = root / 'journey' / 'src'
parts = {'/*WORDS*/': (jd / 'words.js').read_text(), '/*PLAN*/': (jd / 'journey-plan.js').read_text(), '/*PRESS*/': (d / 'press.js').read_text(),
         '/*ENGINES*/': engines, '/*RENDER*/': (jd / 'journey-render.js').read_text()}
for tag, js in parts.items():
    assert '</script' not in js, tag
    html = html.replace(tag, js, 1)
(d.parent / 'index.html').write_text(html)
print('built', len(html), 'bytes')
