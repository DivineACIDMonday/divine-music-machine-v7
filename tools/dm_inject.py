# Puts tools/dm_sound.js into the app pages and hooks it into their preview sounds (drum, tone, ensureAudio, MP3 render).
# Safe to run again: the code between the markers is replaced, the hooks are added once.
import os, re, sys
V = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = open(V + '/tools/dm_sound.js', encoding='utf8').read().strip()
LANES = "['kick_1','kick_2','snare_1','clap','hat_closed','hat_open','perc','crash']"
DRUM_HOOK = "  if (DMS.drum(AU.ctx, AU.master, li >= 8 ? (typeof laneDefs === 'function' ? DMS.byName((laneDefs()[li] || {}).name) : 'perc') : " + LANES + "[li], t, v, track)) return; // the Divine Monday pack\n"
TONE_HOOK = "  if (DMS.tone(AU.ctx, AU.master, { bass: 'bass', chords: 'keys', pad: 'pad', answer: 'pluck' }[part] || 'lead', p, t, dur, v, track)) return; // the Divine Monday pack\n"
VOICE_HOOK = "  if (e.k === 'drum' ? DMS.drum(AC, out, DMS.gm(e.p), t, e.v * 127) : DMS.tone(AC, out, { bass: 'bass', chords: 'keys', pad: 'pad', orch: 'pad', motif: 'pluck', answer: 'pluck' }[e.k] || 'lead', e.p, t, Math.min(e.d, 6), e.v * 127)) return; // the Divine Monday pack\n"
def inject(path):
    f = os.path.normpath(os.path.join(V, path)); s = open(f, encoding='utf8').read()
    if '/*DMSOUND*/' in s: s = re.sub(r'/\*DMSOUND\*/.*?/\*/DMSOUND\*/', lambda m: KIT, s, flags=re.S)
    else:
        i = s.find('\nfunction drum(li, t, v) {'); i = i if i >= 0 else s.index('\nfunction voice(e, t, out) {'); s = s[:i + 1] + KIT + '\n' + s[i + 1:]
    a = 'function voice(e, t, out) {\n'   # Journey and Press
    if a in s and VOICE_HOOK not in s: s = s.replace(a, a + VOICE_HOOK, 1)
    a = 'if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); AC.resume();'
    if a in s and 'DMS.warm(AC' not in s: s = s.replace(a, a + " DMS.warm(AC, ['bass', 'keys', 'pad', 'pluck', 'lead']);")
    if 'function drum(li, t, v) {' not in s: open(f, 'w', encoding='utf8').write(s); print('dm sound in', path); return
    a = 'function drum(li, t, v) {\n'
    if DRUM_HOOK not in s: s = s.replace(a, a + DRUM_HOOK, 1)
    a = 'function tone(part, p, t, dur, v) {\n'
    if TONE_HOOK not in s: s = s.replace(a, a + TONE_HOOK, 1)
    a = 'const ctx = new C(); AU.ctx = ctx;'
    if a in s and 'DMS.warm(ctx' not in s: s = s.replace(a, a + " DMS.warm(ctx, ['bass', 'keys', 'pad', 'pluck', 'lead']);", 1)
    a = "const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OC) throw new Error('no offline audio');"
    if a in s and 'await DMS.ready' not in s: s = s.replace(a, a + " if (AU.ctx) await DMS.ready(AU.ctx);", 1)
    assert s.count(DRUM_HOOK) == 1 and s.count(TONE_HOOK) == 1, path
    open(f, 'w', encoding='utf8').write(s); print('dm sound in', path)
for p in sys.argv[1:]: inject(p)
