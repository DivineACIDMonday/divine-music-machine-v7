import os, re, json, shutil
V='/home/claude/divine-music-machine-v7'; OUT=V+'/ujam'
HOME="https://divineacidmonday.github.io/ujam/"
BASE="https://divineacidmonday.github.io/divine-music-machine-v7/"
def rep(s,a,b,count=None,need=True):
    n=s.count(a)
    if need: assert n, ('missing',a[:80])
    if count is not None: assert n==count,(n,a[:80])
    return s.replace(a,b)
# engine patch: only UJAM plugins can be picked; any other choice turns into a UJAM one
PATCH = r"""
/* UJAM edition: only UJAM plugins to pick from */
if (window.DMM_UJAM && window.DMM) (function (E) {
  const isU = (k) => E.PLUGINS[k] && /^(UJAM|Virtual|Usynth)/.test(E.PLUGINS[k].name);
  const ORDER = { beat: ['beatmaker', 'vdrummer', 'beatmaker2'], bass: ['royal', 'slap', 'subcraft', 'usynth', 'score', 'iron2', 'silk2', 'carbon', 'cinedream'], chords: ['score', 'iron2', 'silk2', 'carbon', 'cinedream', 'usynth', 'royal', 'slap', 'subcraft'], pad: ['usynth', 'score', 'iron2', 'silk2', 'carbon', 'cinedream', 'royal', 'slap', 'subcraft'], melody: ['usynth', 'score', 'silk2', 'iron2', 'carbon', 'cinedream', 'royal', 'slap', 'subcraft'], answer: ['usynth', 'score', 'silk2', 'iron2', 'carbon', 'cinedream', 'subcraft'] };
  const all = E.pluginsFor;
  E.pluginsFor = (part) => { const o = ORDER[part] || []; const r = (k) => { const i = o.indexOf(k); return i < 0 ? 99 : i; }; return all(part).filter(isU).sort((a, b) => r(a) - r(b)); };
  const EL = { beat: 'beatmaker', bass: 'usynth', chords: 'usynth', pad: 'usynth', melody: 'usynth' };
  const BY = { techno: EL, acid: EL, trance: EL, eurodance: EL, breakbeat: EL, ebm: EL, house: Object.assign({}, EL, { chords: 'score' }), hiphop: Object.assign({}, EL, { chords: 'score' }),
    triphop: { beat: 'beatmaker', bass: 'royal', chords: 'score', pad: 'usynth', melody: 'silk2' }, newwave: { beat: 'vdrummer', bass: 'usynth', chords: 'carbon', pad: 'usynth', melody: 'usynth' },
    punk: { beat: 'vdrummer', bass: 'royal', chords: 'iron2', pad: 'usynth', melody: 'iron2' }, blues: { beat: 'vdrummer', bass: 'royal', chords: 'silk2', pad: 'score', melody: 'silk2' }, free: { beat: 'vdrummer', bass: 'royal', chords: 'score', pad: 'usynth', melody: 'usynth' },
    dnb: Object.assign({}, EL, { chords: 'score' }), garage: Object.assign({}, EL, { chords: 'score' }), synthwave: EL, dub: { beat: 'vdrummer', bass: 'royal', chords: 'carbon', pad: 'score', melody: 'usynth' }, funk: { beat: 'vdrummer', bass: 'slap', chords: 'silk2', pad: 'score', melody: 'usynth' }, dubtechno: EL, minimal: EL, club: EL, ambient: EL, chillout: { beat: 'beatmaker', bass: 'royal', chords: 'score', pad: 'usynth', melody: 'silk2' }, divine: Object.assign({}, EL, { chords: 'score' }), songwriter: { beat: 'vdrummer', bass: 'royal', chords: 'silk2', pad: 'score', melody: 'usynth' } };
  const fix = (sg, fresh) => { if (!sg || !sg.parts) return sg; const d = BY[sg.genre] || BY.free;
    for (const p in sg.parts) { const P = sg.parts[p], l = E.pluginsFor(p); if (!l.length || l.includes(P.plugin)) continue;
      let k = p === 'answer' ? (sg.parts.melody && l.includes(sg.parts.melody.plugin) ? sg.parts.melody.plugin : (l.includes(d.melody) ? d.melody : l[0])) : d[p];
      P.plugin = l.includes(k) ? k : l[0]; }
    return sg; };
  const ens = E.ensureTypes; E.ensureTypes = function (sg) { const r = ens.apply(this, arguments); fix(sg); return r; };
  const nw = E.newSong; E.newSong = function () { return fix(nw.apply(this, arguments), true); };
})(window.DMM);
"""
def common(s, path, title, short):
    s = rep(s, '<head><meta charset="utf-8">', '<head><meta charset="utf-8"><script>window.DMM_UJAM = true;</script>', 1)
    s = rep(s, "location.href = 'https://divineacidmonday.github.io/'", "location.href = '" + HOME + "'")
    s = s.replace("'Back to the suite: all Divine Monday machines'", "'Back to the UJAM suite: all Divine Monday machines for UJAM'")
    s = rep(s, 'const D = window.DMM;', PATCH + 'const D = window.DMM;', 1)
    for a, b in [("'dmmlu-'", "'dmmul-'"), ("'dmm-", "'dmmu-"), ("'dgm-", "'dgmu-")]: s = s.replace(a, b)
    s = re.sub(r'(<meta property="og:url" content=")[^"]*"', r'\g<1>' + BASE + path + '"', s)
    s = re.sub(r'<title>[^<]*</title>', '<title>' + title + '</title>', s)
    s = re.sub(r'(<meta (?:property="og:title"|name="twitter:title"|name="apple-mobile-web-app-title") content=")[^"]*"', lambda m: m.group(1) + (short if 'apple' in m.group(1) else title) + '"', s)
    return s
def write(path, s, name, short, icon, desc, src_manifest):
    OG = {'': 'og-pro-ujam', 'lite': 'og-lite-ujam', 'groove': 'og-groove-ujam', 'score': 'og-score-ujam'}[path]
    s = re.sub(r'og/og-[a-z-]+\.png', 'og/' + OG + '-2.png', s)
    s = re.sub(r'(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*"', lambda m: m.group(1) + desc + '"', s)
    d = OUT + '/' + path if path else OUT; os.makedirs(d, exist_ok=True)
    open(d + '/index.html', 'w').write(s)
    m = json.load(open(src_manifest)); m.update(name=name, short_name=short, description=desc)
    m['id'] = '/divine-music-machine-v7/ujam/' + (path + '/' if path else '')
    json.dump(m, open(d + '/manifest.webmanifest', 'w'), indent=1)
    shutil.copy(V + '/lite/sw.js', d + '/sw.js')
# Pro UJAM
s = open(V + '/index.html').read()
s = common(s, 'ujam/', 'Divine Music Machine Pro UJAM', 'DM Pro UJAM')
s = rep(s, "'Divine Music Machine Pro'", "'Divine Music Machine Pro UJAM'")
s = rep(s, ": 'pro';", ": 'pro-ujam';", 1)
s = rep(s, "' Machine ', h('span', { class: 'pro' }, 'Pro')),", "' Machine ', h('span', { class: 'pro' }, 'Pro'), ' ', h('span', { class: 'pro' }, 'UJAM')),", 1)
s = s.replace("'manuals/Divine-Music-Machine-", "'/divine-music-machine-v7/ujam/manuals/Divine-Music-Machine-UJAM-")
s = rep(s, "'https://divineacidmonday.github.io/divine-music-machine-v7/'; }", "'https://divineacidmonday.github.io/divine-music-machine-v7/ujam/'; }")
write('', s, 'Divine Music Machine Pro UJAM', 'DM Pro UJAM', 'pro', 'Track arranged in one click, for UJAM plugins only. Totally free. No AI inside.', V + '/manifest.webmanifest')
# Lite UJAM
s = open(V + '/lite/ujam/index.html').read()
s = common(s, 'ujam/lite/', 'Divine Music Machine Lite UJAM', 'DM Lite UJAM')
s = s.replace("'manuals/Divine-Music-Machine-", "'/divine-music-machine-v7/ujam/manuals/Divine-Music-Machine-UJAM-")
s = s.replace("'https://divineacidmonday.github.io/divine-music-machine-v7/'", "'https://divineacidmonday.github.io/divine-music-machine-v7/ujam/'")
write('lite', s, 'Divine Music Machine Lite UJAM', 'DM Lite UJAM', 'ujam', 'Track arranged in one click, for UJAM plugins. Totally free. No AI inside.', V + '/lite/ujam/manifest.webmanifest')
# Groove UJAM
s = open(V + '/groove/index.html').read()
s = common(s, 'ujam/groove/', 'Divine Groove Machine UJAM', 'DM Groove UJAM')
s = rep(s, "'Divine ', h('b', null, 'Groove'), ' Machine')", "'Divine ', h('b', null, 'Groove'), ' Machine ', h('span', { style: 'font:700 11px/1 var(--body);letter-spacing:.08em;border:1px solid currentColor;border-radius:999px;padding:2px 7px;vertical-align:3px;opacity:.85' }, 'UJAM'))", 1)
s = rep(s, "'Choose your drum plugin: XO, Impact, Tekno, Beatmaker 3, Playbeat 4 or plain MIDI. The keys land right for it.'", "'Choose your UJAM drummer: Beatmaker 3, Virtual Drummer or Beatmaker 2. The keys land right for it.'", 1)
s = rep(s, "COUNT_APP = 'groove';", "COUNT_APP = 'groove-ujam';", 1)
s = s.replace("'manuals/Divine-Groove-Machine-", "'/divine-music-machine-v7/ujam/manuals/Divine-Groove-Machine-UJAM-")
write('groove', s, 'Divine Groove Machine UJAM', 'DM Groove UJAM', 'groove', 'Groove arranged in one click, for UJAM Beatmaker and Virtual Drummer. Totally free. No AI inside.', V + '/groove/manifest.webmanifest')
# Score: same app, with a home button to the UJAM suite
s = open(V + '/score/index.html').read()
s = rep(s, "title: 'Back to the suite: all Divine Monday machines', onclick: () => { location.href = 'https://divineacidmonday.github.io/'; } }, '🏠 Suite'),", "title: 'Back to the UJAM suite: all Divine Monday machines for UJAM', onclick: () => { location.href = '" + HOME + "'; } }, '🏠 Suite'),", 1)
s = rep(s, "'../manuals/'", "'/divine-music-machine-v7/manuals/'", 1)
s = re.sub(r'(<meta property="og:url" content=")[^"]*"', r'\g<1>' + BASE + 'ujam/score/"', s)
s = re.sub(r'<title>[^<]*</title>', '<title>Divine Score Machine UJAM</title>', s)
s = re.sub(r'(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*"', r'\g<1>Divine Score Machine UJAM"', s)
write('score', s, 'Divine Score Machine UJAM', 'DM Score UJAM', 'score', 'Pick a feeling, draw the tension, get MIDI for UJAM STRIIIINGS and PERRCS. No AI inside.', V + '/score/manifest.webmanifest')
print('built')
