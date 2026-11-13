# Builds burp/index.html: the Director machinery (hidden) with the one-button Burp face on top.
import pathlib
d = pathlib.Path(__file__).parent
root = d.parent.parent
html = (root / 'director' / 'index.html').read_text()
burp = (d / 'burp.html').read_text()
html = html.replace('<title>Divine Director</title>', '<title>Divine Burp Supreme</title>', 1)
html = html.replace('content="Direct your own track scene by scene: choose the genre and the instruments with a feeling, leave the rest open and the machine fills it in. MIDI for your plugins. By Divine Monday."',
                    'content="One button, one whole track, never the same twice. Every rule of every Divine machine thrown open and remixed: the supreme burp. MIDI for your plugins. By Divine Monday."', 1)
html = html.replace('/icons/director', '/icons/burp').replace('og/og-director.png', 'og/og-burp.png').replace('/divine-music-machine-v7/director/"', '/divine-music-machine-v7/burp/"')
html = html.replace('<meta property="og:title" content="Divine Director">', '<meta property="og:title" content="Divine Burp Supreme">').replace('<meta name="twitter:title" content="Divine Director">', '<meta name="twitter:title" content="Divine Burp Supreme">')
html = html.replace('content="Direct your own track scene by scene: pick a genre and a feeling, leave the rest open and the machine fills it in. MIDI for your plugins. By Divine Monday."', 'content="One button, one whole track, never the same twice. MIDI for your plugins. By Divine Monday."')
i = html.index('<script>(function(){try{if(!/\\.github\\.io$/')  # the suite bar stays last
html = html[:i] + burp + html[i:]
(d.parent / 'index.html').write_text(html)
print('built', len(html), 'bytes')
