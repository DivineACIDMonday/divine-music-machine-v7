# Builds journey/index.html from src: the page with the words and the planner inlined.
import pathlib
d = pathlib.Path(__file__).parent
html = (d / 'app.html').read_text()
for tag, f in (('/*WORDS*/', 'words.js'), ('/*PLAN*/', 'journey-plan.js')):
    js = (d / f).read_text()
    assert '</script' not in js
    html = html.replace(tag, js, 1)
(d.parent / 'index.html').write_text(html)
print('built', len(html), 'bytes')
