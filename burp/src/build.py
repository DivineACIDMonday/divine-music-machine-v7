# Builds burp/index.html: the Director machinery (hidden) with the one-button Burp face on top.
import pathlib
d = pathlib.Path(__file__).parent
root = d.parent.parent
html = (root / 'director' / 'index.html').read_text()
burp = (d / 'burp.html').read_text()
html = html.replace('<title>Divine Director</title>', '<title>Divine Burp Machine</title>', 1)
html = html.replace('content="Direct your own track scene by scene: choose the genre and the instruments with a feeling, leave the rest open and the machine fills it in. MIDI for your plugins. By Divine Monday."',
                    'content="One button, one whole track, never the same twice. Every rule of every Divine machine thrown open and remixed. MIDI for your plugins. By Divine Monday."', 1)
i = html.index('<script>(function(){try{if(!/\\.github\\.io$/')  # the suite bar stays last
html = html[:i] + burp + html[i:]
(d.parent / 'index.html').write_text(html)
print('built', len(html), 'bytes')
