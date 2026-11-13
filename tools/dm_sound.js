/*DMSOUND*/
// The Divine Monday sound pack in the browser preview: recorded by Divine Monday in Phase Plant, loaded only when used.
// DMS.drum(...) and DMS.tone(...) return true when they played a recorded sound; otherwise the app's own sketch sound plays.
const DMS = (() => {
  const BASE = '/divine-music-machine-v7/sampler/dm/web/';
  const DR = ['kick_1', 'kick_2', 'snare_1', 'snare_2', 'clap', 'hat_closed', 'hat_open', 'perc', 'crash', 'tom'];
  const TN = { bass: [24, 30, 36, 42, 48], sub: [24, 30, 36, 42], keys: [36, 42, 48, 54, 60, 66, 72, 78], pad: [36, 42, 48, 54, 60, 66], lead: [48, 54, 60, 66, 72, 78], pluck: [60, 66, 72, 78, 84, 90] };
  const NN = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
  const buf = {}, busy = {};
  let on = true; try { on = localStorage.getItem('dm-sounds') !== 'off'; } catch (e) { /* fine */ }
  const load = (ctx, name) => { if (buf[name] || busy[name]) return busy[name]; return busy[name] = fetch(BASE + name + '.mp3').then((r) => { if (!r.ok) throw 0; return r.arrayBuffer(); })
    .then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then((ab) => { buf[name] = ab; }).catch(() => { /* stays sketch */ }); };
  const toneName = (kind, p) => { const rs = TN[kind]; const r = rs.reduce((b, x) => Math.abs(x - p) < Math.abs(b - p) ? x : b, rs[0]); return [kind + '_' + NN[r % 12] + (Math.floor(r / 12) - 2), r]; };
  function warm(ctx, tones) { if (!on || !ctx) return; DR.forEach((d) => load(ctx, d)); (tones || []).forEach((k) => TN[k].forEach((r) => load(ctx, toneName(k, r)[0]))); }
  // before an export: wait until the sounds are in, at most a few seconds
  function ready(ctx, tones) { if (!on || !ctx) return Promise.resolve(); warm(ctx, tones || Object.keys(TN)); return Promise.race([Promise.all(Object.values(busy)), new Promise((ok) => setTimeout(ok, 8000))]); }
  function play(ctx, out, b, t, gain, rate, dur, rel) { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; if (rate !== 1) s.playbackRate.value = rate;
    s.connect(g); g.connect(out); s.start(t); g.gain.setValueAtTime(gain, t);
    if (dur != null) { g.gain.setValueAtTime(gain, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + rel); s.stop(t + dur + rel + 0.02); }
    return s; }
  // kind: one of the 10 drum names
  function drum(ctx, out, kind, t, v, keep) { if (!on || !ctx || !kind) return false; const b = buf[kind]; if (!b) { load(ctx, kind); return false; }
    const s = play(ctx, out, b, t, Math.pow(v / 127, 1.4) * 3, 1); if (keep) keep(s, t + b.duration); return true; }
  // kind: bass, sub, keys, pad, lead or pluck
  function tone(ctx, out, kind, p, t, dur, v, keep) { if (!on || !ctx || !TN[kind]) return false; const [n, r] = toneName(kind, p), b = buf[n]; if (!b) { warm(ctx, [kind]); return false; }
    const rel = kind === 'pad' ? 0.9 : 0.4, s = play(ctx, out, b, t, Math.pow(v / 127, 1.3) * (kind === 'pad' ? 0.2 : kind === 'keys' ? 0.5 : 0.8), Math.pow(2, (p - r) / 12), Math.max(0.05, dur), rel);
    if (keep) keep(s, t + dur + rel); return true; }
  // a drum by its lane name, for lanes with a name instead of a number
  function byName(nm) { const n = (nm || '').toLowerCase();
    if (/clap/.test(n)) return 'clap'; if (/tom|conga|bongo|taiko/.test(n)) return 'tom'; if (/crash|ride|cym/.test(n)) return 'crash';
    if (/open|half/.test(n)) return 'hat_open'; if (/hh|hat|pedal|shak|tamb|maraca/.test(n)) return 'hat_closed'; if (/rim|perc|block|wood|bell|cow|tick|click/.test(n)) return 'perc';
    if (/808|sub|boom/.test(n)) return 'kick_2'; if (/kick|bd|bass/.test(n)) return 'kick_1'; if (/sn|snare/.test(n)) return 'snare_1'; return null; }
  // a drum by its General MIDI note
  function gm(n) { return n === 35 || n === 36 ? 'kick_1' : n === 38 || n === 40 ? 'snare_1' : n === 37 ? 'perc' : n === 39 ? 'clap' : n === 42 || n === 44 || n === 54 || n === 70 || n === 69 ? 'hat_closed' : n === 46 ? 'hat_open'
    : [41, 43, 45, 47, 48, 50, 60, 61, 62, 63, 64].includes(n) ? 'tom' : [49, 51, 52, 53, 55, 57, 59].includes(n) ? 'crash' : 'perc'; }
  function chip() { const hd = document.querySelector('header'); if (!hd || document.getElementById('dmsChip')) return;
    const b = document.createElement('button'); b.id = 'dmsChip'; b.type = 'button'; b.className = 'tag';
    b.style.cssText = 'cursor:pointer;background:transparent;font:12px/1.2 ui-monospace,Menlo,Consolas,monospace;color:inherit;border:1px solid currentColor;opacity:.75;border-radius:6px;padding:4px 7px';
    const say = () => { b.textContent = on ? 'Sounds: Divine Monday' : 'Sounds: sketch'; b.title = on ? 'The preview plays the recorded Divine Monday sound pack. Click for the plain sketch sounds.' : 'The preview plays plain sketch sounds. Click for the Divine Monday sound pack.'; };
    b.onclick = () => { on = !on; try { localStorage.setItem('dm-sounds', on ? 'on' : 'off'); } catch (e) { /* fine */ } say(); }; say(); hd.append(b); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chip); else chip();
  return { drum, tone, warm, ready, byName, gm, get on() { return on; } };
})();
/*/DMSOUND*/
