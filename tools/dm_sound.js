/*DMSOUND*/
// The Divine Monday sound packs in the browser preview, loaded only when used.
// Pack 1 "Mediocre Diarrhea", pack 2 "Dictatorship of the Good", or "My mix" (the mix made in the Divine Sampler).
// DMS.drum(...) and DMS.tone(...) return true when they played a recorded sound; otherwise the app's own sketch sound plays.
const DMS = (() => {
  const ROOT = '/divine-music-machine-v7/sampler/';
  const DR = ['kick_1', 'kick_2', 'snare_1', 'snare_2', 'clap', 'hat_closed', 'hat_open', 'perc', 'crash', 'tom'];
  const TN = { bass: [24, 30, 36, 42, 48], sub: [24, 30, 36, 42], keys: [36, 42, 48, 54, 60, 66, 72, 78], pad: [36, 42, 48, 54, 60, 66], lead: [48, 54, 60, 66, 72, 78], pluck: [60, 66, 72, 78, 84, 90] };
  const DR2 = ['kick_1', 'kick_2', 'kick_4', 'snare_1', 'snare_2', 'clap', 'clap_2', 'hat_closed', 'hat_open', 'perc', 'perc_2'];
  const TN2 = { bass: [24, 30, 36, 42, 48], keys: [36, 42, 48, 54, 60, 66, 72, 78], pluck: [60, 66, 72, 78, 84, 90], mallet: [48, 54, 60, 66, 72, 78] };
  // pack 2 for each sound of the apps; crash, tom, sub, pad and lead stay with pack 1
  const DEF2 = { kick_1: 'kick_1', kick_2: 'kick_4', snare_1: 'snare_1', snare_2: 'snare_2', clap: 'clap', hat_closed: 'hat_closed', hat_open: 'hat_open', perc: 'perc_2', bass: 'bass', keys: 'keys', pluck: 'pluck' };
  const ALIAS1 = { acid: 'bass', organ: 'pad', bell: 'pluck', strings: 'pad' };
  const NAMES = { dm1: 'Mediocre Diarrhea', dm2: 'Dictatorship of the Good', mix: 'My mix' };
  const NN = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
  const buf = {}, busy = {};
  const on = true;   // always a Divine Monday pack; the sketch sounds only fill in while it loads
  let st = { pack: 'dm1', mix: {} }, lastCtx = null;
  const readSt = () => { try { const v = JSON.parse(localStorage.getItem('dm-pack') || 'null'); if (v && NAMES[v.pack]) st = { pack: v.pack, mix: v.mix || {} }; } catch (e) { /* pack 1 */ } };
  readSt();
  try { addEventListener('storage', (e) => { if (e.key === 'dm-pack') { readSt(); syncSel(); if (lastCtx) warm(lastCtx, Object.keys(TN)); } }); } catch (e) { /* fine */ }
  // which recorded sound plays for a sound of the app: [pack, key]
  function pick(kind) {
    if (st.pack === 'dm2' && DEF2[kind]) return ['dm2', DEF2[kind]];
    if (st.pack === 'mix' && st.mix[kind]) { const [p, k] = st.mix[kind].split(':'); if (p === 'dm2' && (DR2.includes(k) || TN2[k])) return ['dm2', k]; if (p === 'dm1') { const k1 = ALIAS1[k] || k; if (DR.includes(k1) || TN[k1]) return ['dm1', k1]; } }
    return ['dm1', kind];
  }
  const url = (name) => name.startsWith('dm2/') ? ROOT + 'dm2/web/' + name.slice(4) + '.mp3' : ROOT + 'dm/web/' + name + '.mp3';
  const load = (ctx, name) => { if (buf[name] || busy[name]) return busy[name]; return busy[name] = fetch(url(name)).then((r) => { if (!r.ok) throw 0; return r.arrayBuffer(); })
    .then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then((ab) => { buf[name] = ab; }).catch(() => { /* stays sketch */ }); };
  const nearest = (rs, p) => rs.reduce((b, x) => Math.abs(x - p) < Math.abs(b - p) ? x : b, rs[0]);
  // a tone file for pack, key and pitch: [file name, recorded note]
  const toneFile = (pk, k, p) => { const rs = (pk === 'dm2' ? TN2 : TN)[k]; if (!rs) return null; const r = nearest(rs, p); return [(pk === 'dm2' ? 'dm2/' : '') + k + '_' + NN[r % 12] + (Math.floor(r / 12) - 2), r]; };
  const drumFile = (kind) => { const [pk, k] = pick(kind); return pk === 'dm2' ? (DR2.includes(k) ? 'dm2/' + k : null) : (DR.includes(k) ? k : null); };
  function warmTone(ctx, kind) { const [pk, k] = pick(kind), rs = (pk === 'dm2' ? TN2 : TN)[k]; if (rs) rs.forEach((r) => load(ctx, toneFile(pk, k, r)[0])); }
  function warm(ctx, tones) { if (!on || !ctx) return; lastCtx = ctx; DR.forEach((d) => { const f = drumFile(d); if (f) load(ctx, f); }); (tones || []).forEach((k) => warmTone(ctx, k)); }
  // before an export: wait until the sounds are in, at most a few seconds
  function ready(ctx, tones) { if (!on || !ctx) return Promise.resolve(); warm(ctx, tones || Object.keys(TN)); return Promise.race([Promise.all(Object.values(busy)), new Promise((ok) => setTimeout(ok, 8000))]); }
  function play(ctx, out, b, t, gain, rate, dur, rel) { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; if (rate !== 1) s.playbackRate.value = rate;
    s.connect(g); g.connect(out); s.start(t); g.gain.setValueAtTime(gain, t);
    if (dur != null) { g.gain.setValueAtTime(gain, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + rel); s.stop(t + dur + rel + 0.02); }
    return s; }
  // kind: one of the 10 drum names
  function drum(ctx, out, kind, t, v, keep) { if (!on || !ctx || !kind) return false; lastCtx = ctx; const f = drumFile(kind); if (!f) return false; const b = buf[f]; if (!b) { load(ctx, f); return false; }
    const s = play(ctx, out, b, t, Math.pow(v / 127, 1.4) * 3, 1); if (keep) keep(s, t + b.duration); return true; }
  // kind: bass, sub, keys, pad, lead or pluck
  function tone(ctx, out, kind, p, t, dur, v, keep) { if (!on || !ctx || !TN[kind]) return false; lastCtx = ctx; const [pk, k] = pick(kind); if (/^(bass|sub)$/.test(kind) || /^(bass|sub)$/.test(k)) { const rs = (pk === 'dm2' ? TN2 : TN)[k]; if (rs) { const top = Math.max(...rs) + 5; while (p > top) p -= 12; } }   // a bass stays deep: notes above the recording fold down an octave
    const tf = toneFile(pk, k, p); if (!tf) return false; const [n, r] = tf, b = buf[n]; if (!b) { warmTone(ctx, kind); return false; }
    const rel = k === 'pad' ? 0.9 : 0.4, s = play(ctx, out, b, t, Math.pow(v / 127, 1.3) * (k === 'pad' ? 0.2 : k === 'keys' ? 0.5 : 0.8), Math.pow(2, (p - r) / 12), Math.max(0.05, dur), rel);
    if (keep) keep(s, t + dur + rel); return true; }
  // a drum by its lane name, for lanes with a name instead of a number
  function byName(nm) { const n = (nm || '').toLowerCase();
    if (/clap/.test(n)) return 'clap'; if (/tom|conga|bongo|taiko/.test(n)) return 'tom'; if (/crash|ride|cym/.test(n)) return 'crash';
    if (/open|half/.test(n)) return 'hat_open'; if (/hh|hat|pedal|shak|tamb|maraca/.test(n)) return 'hat_closed'; if (/rim|perc|block|wood|bell|cow|tick|click/.test(n)) return 'perc';
    if (/808|sub|boom/.test(n)) return 'kick_2'; if (/kick|bd|bass/.test(n)) return 'kick_1'; if (/sn|snare/.test(n)) return 'snare_1'; return null; }
  // a drum by its General MIDI note
  function gm(n) { return n === 35 || n === 36 ? 'kick_1' : n === 38 || n === 40 ? 'snare_1' : n === 37 ? 'perc' : n === 39 ? 'clap' : n === 42 || n === 44 || n === 54 || n === 70 || n === 69 ? 'hat_closed' : n === 46 ? 'hat_open'
    : [41, 43, 45, 47, 48, 50, 60, 61, 62, 63, 64].includes(n) ? 'tom' : [49, 51, 52, 53, 55, 57, 59].includes(n) ? 'crash' : 'perc'; }
  // the small pack choice in the corner of every app: a pill that opens on a tap
  let sel = null, pill = null;
  const SHORT = { dm1: 'Pack 1', dm2: 'Pack 2', mix: 'My mix' };
  function syncSel() { if (sel) sel.value = st.pack; if (pill) { pill.textContent = 'Sound: ' + SHORT[st.pack]; pill.title = 'Divine Monday sound pack: ' + NAMES[st.pack]; } }
  function setPack(p) { if (!NAMES[p]) return; st.pack = p; try { localStorage.setItem('dm-pack', JSON.stringify(st)); } catch (e) { /* fine */ } syncSel(); if (lastCtx) warm(lastCtx, Object.keys(TN)); }
  function addSel() { if (sel || !document.body || document.getElementById('dms-pack')) return;
    const w = document.createElement('div'); w.id = 'dms-pack';
    w.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483000;font:11px/1.2 system-ui,sans-serif';
    const look = 'background:rgba(16,16,24,.9);color:#e8e4da;border:1px solid rgba(255,255,255,.22);border-radius:999px;font:11px/1.2 system-ui,sans-serif;padding:4px 9px;cursor:pointer';
    pill = document.createElement('button'); pill.type = 'button'; pill.style.cssText = look;
    sel = document.createElement('select'); sel.style.cssText = look + ';display:none;border-radius:8px;padding:4px 6px';
    Object.keys(NAMES).forEach((k) => { const o = document.createElement('option'); o.value = k; o.textContent = NAMES[k]; sel.append(o); });
    const close = () => { sel.style.display = 'none'; pill.style.display = ''; };
    pill.onclick = () => { pill.style.display = 'none'; sel.style.display = ''; sel.focus(); };
    sel.onchange = () => { setPack(sel.value); close(); }; sel.onblur = close;
    syncSel(); w.append(pill, sel); document.body.append(w); }
  try { if (document.readyState === 'loading') addEventListener('DOMContentLoaded', addSel); else addSel(); } catch (e) { /* no page */ }
  return { drum, tone, warm, ready, byName, gm, setPack, get pack() { return st.pack; }, get on() { return on; } };
})();
/*/DMSOUND*/
