// Divine Journey Machine: the renderer (phase 2). Turns the plan into notes, in the language of every plugin in your rack.
// It borrows the real engines of the suite: E (Studio), PercMotor (Percussion), SCORE (Score), Y (Symphony).
// One harmony per chapter: the Symphony leads it when a Symphony art leads, otherwise the Studio engine does; Score always follows it.
const JR = {};
(function () {
const PPQ = 480, BAR = PPQ * 4;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const H = (...xs) => { let h = 2166136261; for (const x of xs) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } } return h >>> 0; };
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------- names to engine keys ----------
const GENRE_KEY = {}; const PERC_KEY = {}; const SCORE_KEY = {};
const SYM_FORM = { 'Overture': 'overture', 'March': 'march', 'Waltz': 'waltz', 'Aria': 'aria', 'Fugue': 'fugue', 'Canon': 'canon', 'Variations': 'variations', 'Rondo': 'rondo', 'Sonata allegro': 'sonata', 'Minuet': 'minuet', 'Adagio': 'aria' };
const SCORE_FEEL = { Playful: 'joyful', Tense: 'stormy', Fearful: 'mysterious', Chase: 'stormy', Wonder: 'dreamy', Mysterious: 'mysterious', Tender: 'tender', Uncanny: 'mysterious', Light: 'joyful', Euphoric: 'joyful', Glory: 'heroic', Dark: 'stormy', Nostalgic: 'melancholy', Hope: 'tender', Triumph: 'heroic', Dreamy: 'dreamy', Serenity: 'dreamy', Sunrise: 'solemn', Heartbreak: 'melancholy', Lonely: 'melancholy' };
function keys(E, P, S) {
  if (!Object.keys(GENRE_KEY).length) {
    for (const [k, g] of Object.entries(E.GENRES)) GENRE_KEY[g.name] = k;
    for (const [k, s] of Object.entries(P.STYLES)) PERC_KEY[s.name.replace(/ \(.*\)$/, '')] = k;
    for (const [k, s] of Object.entries(S.STYLES)) if (!SCORE_KEY[s.name]) SCORE_KEY[s.name] = k;
  }
}
// the plugin language for each rack item
const PK = { 'XO': 'xo', 'Impact': 'impact', 'EZdrummer': 'ezdrummer', 'Virtual Drummer': 'vdrummer', 'Beatmaker': 'beatmaker', 'Tekno': 'tekno',
  'Usynth': 'usynth', 'Iron': 'iron2', 'Silk': 'silk2', 'Carbon': 'carbon', 'Cinedream': 'cinedream', 'Virtual Pianist Score': 'score', 'SubCraft': 'subcraft', 'Royal': 'royal', 'Slap': 'slap' };
const PERC_SLOTS = [['drum'], ['clo'], ['chi'], ['slap'], ['bhi', 'blo'], ['shk', 'tamb'], ['bell', 'bell2', 'apito'], ['wood', 'clave']];
const TAIKO_SLOTS = [['odaiko'], ['don'], ['ka'], ['shime'], ['shimeka'], ['okedo'], ['kane'], ['kake']];
const MARCH_SLOTS = [['bass1', 'bass2'], ['bass3'], ['bass4', 'bass5'], ['snare'], ['rim'], ['tenor1', 'tenor2'], ['tenor3', 'tenor4'], ['cym', 'cyc']];
const PERC_KEYS = { xo: [36, 37, 38, 39, 40, 41, 42, 43], impact: [36, 37, 38, 39, 40, 41, 42, 43], beatmaker: [36, 38, 40, 43, 45, 48, 52, 59], vdrummer: [36, 41, 38, 40, 42, 46, 37, 49] };
const TEKNO_PERC = { drum: 43, clo: 47, chi: 48, slap: 46, bhi: 44, blo: 44, shk: 40, tamb: 42, bell: 51, bell2: 51, wood: 52, clave: 52, odaiko: 36, don: 43, ka: 46, shime: 44, shimeka: 52, okedo: 47, kane: 51, kake: 45, apito: 50, bass1: 36, bass2: 36, bass3: 37, bass4: 43, bass5: 43, snare: 38, rim: 46, tenor1: 44, tenor2: 44, tenor3: 48, tenor4: 47, cym: 53, cyc: 53 };
const KICKS = new Set(['drum', 'odaiko', 'bass1', 'bass2', 'don']);
const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const deg = (tonic, minor, d, base) => { const sc = minor ? SCALE.minor : SCALE.major, o = Math.floor(d / 7), k = ((d % 7) + 7) % 7; return base + tonic + sc[k] + 12 * o; };
const fold = (p, lo, hi) => { while (p < lo) p += 12; while (p > hi) p -= 12; return p; };

// ---------- the journey's timeline ----------
JR.timeline = (plan) => { let t = 0; return plan.chapters.map((c, i) => { const s = t; t += (c.bars - (i < plan.chapters.length - 1 ? (c.overlap || 0) : 0)) * BAR; return { start: s, len: c.bars * BAR }; }); };

// energy inside a chapter, u = 0..1
const eAt = (c, u) => c.song ? songE(c, u) : (u < 0.5 ? c.eStart + (c.energy - c.eStart) * (u / 0.5) : c.energy + (c.eEnd - c.energy) * ((u - 0.5) / 0.5));
// a chapter that is a song of its own (Mixed journey): the same curve the planner draws
function songE(x, u) { const S = x.song; let k = S.findIndex((q) => u < q.u1); if (k < 0) k = S.length - 1; const q = S[k];
  const f = (u - q.u0) / Math.max(1e-6, q.u1 - q.u0), nx = S[k + 1], pv = S[k - 1];
  let e = q.e; if (nx && f > 0.75) e = q.e + (nx.e - q.e) * (f - 0.75) / 0.25 * 0.5; if (pv && f < 0.25) e = q.e + (pv.e - q.e) * (0.25 - f) / 0.25 * 0.5;
  return x.lo + (x.hi - x.lo) * e; }
const ENGINE_TYPE = { intro: 'intro', verse: 'verse', build: 'build', rise: 'prechorus', chorus: 'chorus', drop: 'drop', peak: 'chorus', break: 'break', fall: 'break', outro: 'outro' };
const layersAt = (c, u) => { const e = eAt(c, u); return Math.round(clamp(e, 0, 1) * 6); };

// ---------- the four engines, one chapter at a time ----------
function nearest(JP, machine, c) { let b = null; for (const a of JP.ARTS) if (a.machine === machine) { const d = JP.dist(c, a.v); if (!b || d < b.d) b = { d, a }; } return b.a; }
const artFor = (JP, c, machine) => (c.lead.machine === machine ? c.lead : c.guests.find((g) => g.machine === machine) || nearest(JP, machine, c.c));
const symFeel = (c) => { const x = c.c;
  if (c.lead.machine === 'score' && SCORE_FEEL[c.lead.name]) return SCORE_FEEL[c.lead.name];
  if (x.tension > 0.35 && x.light < 0) return 'stormy'; if (x.light < -0.25) return x.speed < 0 ? 'melancholy' : 'mysterious';
  if (x.weight > 0.3 && x.light > 0) return x.speed < 0 ? 'solemn' : 'heroic'; if (x.speed < -0.3) return x.light > 0 ? 'dreamy' : 'melancholy';
  if (x.warm > 0.3 && x.speed < 0.2) return 'tender'; return x.light > 0.1 ? 'joyful' : 'mysterious'; };

function studioSong(E, genreName, c, contentBars, seed, F) {
  const g = GENRE_KEY[genreName] || 'house', song = E.newSong(g, { seed });
  song.bpm = F; song.bpmAuto = false; song.keyAuto = false; song.key = { root: c.tonic, scale: c.minor ? 'minor' : 'major' }; song.meter = '4/4';
  if (c.song) { // Mixed journey: the engine writes a real song in the chapter's form, sections on whole 8-bar phrases
    const secs = []; let at = 0; c.song.forEach((q, k) => { const end = k === c.song.length - 1 ? contentBars : Math.max(at + 8, Math.round(q.u1 * contentBars / 8) * 8);
      if (end > at) { const ty = ENGINE_TYPE[q.type] || 'verse', len = end - at;
        // an intro or outro of the engine is drumless: keep it to 8 bars, the rest of the song's intro already grooves
        if ((ty === 'intro' || ty === 'outro') && len > 8) { if (ty === 'intro') secs.push({ id: 'm' + k, type: 'intro', bars: 8 }, { id: 'm' + k + 'v', type: 'verse', bars: len - 8 });
          else secs.push({ id: 'm' + k + 'v', type: 'verse', bars: len - 8 }, { id: 'm' + k, type: 'outro', bars: 8 }); }
        else secs.push({ id: 'm' + k, type: ty, bars: len }); }
      at = end; });
    song.sections = secs; return song; }
  const secs = []; for (let b = 0, k = 0; b < contentBars; b += 8, k++) { const u = b / Math.max(1, contentBars), e = eAt(c, u);
    // the engine writes full material; the journey's own layers decide how much of it sounds
    const type = e < 0.68 ? ['verse', 'chorus', 'chorus', 'prechorus'][k % 4] : ['drop', 'drop', 'build', 'drop'][k % 4];
    secs.push({ id: 'j' + k, type, bars: Math.min(8, contentBars - b) }); }
  song.sections = secs; return song;
}

function symphonyRes(Y, art, c, needTicks, seed, F) {
  const form = SYM_FORM[art.name] || 'overture', feel = symFeel(c);
  const era = form === 'fugue' || form === 'canon' ? 'baroque' : feel === 'dreamy' ? 'impressionist' : form === 'waltz' || art.name === 'Adagio' || feel === 'stormy' || feel === 'melancholy' ? 'romantic' : 'classical';
  const key = (['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][c.tonic]); const kn = c.minor ? key.toLowerCase() : key;
  const out = {}; let off = 0, k = 0;
  while (off < needTicks && k < 6) { const m = Y.generate({ form, key: kn, tempo: F, feel, era, seed: seed + k * 101, len: 3 }).movements[0];
    for (const t of m.tracks) { const o = out[t.id] || (out[t.id] = { id: t.id, name: t.name, notes: [], cc: [], ks: [], ksType: t.ksType });
      t.notes.forEach((n) => o.notes.push(Object.assign({}, n, { t: n.t + off })));
      t.cc.forEach((e) => o.cc.push(Object.assign({}, e, { t: e.t + off }))); t.ks.forEach((e) => o.ks.push(Object.assign({}, e, { t: e.t + off }))); }
    off += m.end + PPQ; k++; }
  return { tracks: Object.values(out), form, feel, era };
}

// strings and brass that hold the chords of the Studio engine: an orchestra that follows the harmony instead of inventing its own
function orchestrate(chords, bass, mel, c) {
  const mk = (id, name, ksType) => ({ id, name, notes: [], cc: [{ t: 0, c: 11, v: 110 }], ks: [{ t: 0, m: 0 }], ksType });
  const T = { vln1: mk('vln1', 'Violins 1', 's'), vln2: mk('vln2', 'Violins 2', 's'), vla: mk('vla', 'Violas', 's'), vc: mk('vc', 'Celli', 's'), cb: mk('cb', 'Basses', 'b'), hn: mk('hn', 'Horns', 'w') };
  // one block per bar: the notes that sound in that bar, held
  const byBar = {}; chords.forEach((n) => { const b = Math.floor(n.t / BAR); (byBar[b] = byBar[b] || new Set()).add(n.p % 12); });
  const bassBar = {}; bass.forEach((n) => { const b = Math.floor(n.t / BAR); if (bassBar[b] == null || n.p < bassBar[b]) bassBar[b] = n.p; });
  const bars = Math.max(0, ...Object.keys(byBar).map(Number), ...Object.keys(bassBar).map(Number)) + 1;
  let prev = null;
  if (!prev) prev = [0, 2, 4].map((d) => (c.tonic + (c.minor ? SCALE.minor : SCALE.major)[d]) % 12); // before the first chord: the home chord
  for (let b = 0; b < bars; b++) { const pcs = byBar[b] ? [...byBar[b]] : prev; if (!pcs || !pcs.length) continue;
    const same = prev && pcs.length === prev.length && pcs.every((x) => prev.includes(x)); prev = pcs;
    const t = b * BAR, v = 64 + Math.round(30 * eAt(c, b / Math.max(1, bars)));
    const put = (tr, lo, hi, k) => { const pc = pcs[k % pcs.length]; let p = lo + ((pc - lo) % 12 + 12) % 12; if (p > hi) p -= 12;
      const last = tr.notes[tr.notes.length - 1]; if (same && last && last.m === p && last.t + last.dur >= t - 10) { last.dur += BAR; return; } tr.notes.push({ t, dur: BAR - 20, m: p, v, art: 'long' }); };
    put(T.vln1, 72, 88, 2); put(T.vln2, 67, 79, 1); put(T.vla, 60, 72, 0); put(T.hn, 55, 67, 1);
    const bp = bassBar[b] != null ? bassBar[b] % 12 : pcs[0]; put(T.vc, 43, 55, 0); T.vc.notes[T.vc.notes.length - 1].m = fold(bp + 48, 43, 55); put(T.cb, 31, 43, 0); T.cb.notes[T.cb.notes.length - 1].m = fold(bp + 36, 31, 43);
    T.vln1.cc.push({ t, c: 1, v: clamp(v + 10, 30, 127) }); T.vln2.cc.push({ t, c: 1, v: clamp(v, 30, 127) }); T.vla.cc.push({ t, c: 1, v: clamp(v, 30, 127) }); T.vc.cc.push({ t, c: 1, v: clamp(v, 30, 127) }); T.cb.cc.push({ t, c: 1, v: clamp(v - 5, 30, 127) }); T.hn.cc.push({ t, c: 1, v: clamp(v - 10, 30, 127) });
  }
  // nobody tires: the violins rest every other 32 bars (the low strings and horns carry), the horns every fourth
  T.vln1.notes = T.vln1.notes.filter((n) => Math.floor(n.t / (32 * BAR)) % 2 === 0); T.vln2.notes = T.vln2.notes.filter((n) => Math.floor(n.t / (32 * BAR)) % 2 === 0);
  T.hn.notes = T.hn.notes.filter((n) => Math.floor(n.t / (32 * BAR)) % 4 !== 3);
  // the melody on top in the violins when it sings
  if (mel.length) { T.vln1.notes = T.vln1.notes.filter(() => false); mel.forEach((n) => T.vln1.notes.push({ t: n.t, dur: Math.max(60, n.d), m: fold(n.p, 62, 93), v: n.v, art: 'long' })); }
  return Object.values(T);
}

// the hot pocket: the first notes of a phrase become a riff that repeats for 8 bars and evolves (a note drops out, it swells),
// like minimal techno inside the symphony; only then the phrase goes on, so the horns never burn through their power
function hotPocket(notes, seed) {
  if (notes.length < 6) return notes; const out = [], used = new Set(); notes.sort((a, b) => a.t - b.t);
  for (let blk = 0; blk < 64; blk++) { const b0 = blk * 32 * BAR, inBlk = notes.filter((n) => n.t >= b0 && n.t < b0 + 32 * BAR); if (inBlk.length < 4) continue;
    const s = Math.floor(inBlk[0].t / BAR) * BAR, cellLen = inBlk.filter((n) => n.t < s + BAR).length >= 3 ? BAR : 2 * BAR;
    const cell = inBlk.filter((n) => n.t >= s && n.t < s + cellLen); if (cell.length < 2) continue;
    inBlk.filter((n) => n.t >= s && n.t < s + 8 * BAR).forEach((n) => used.add(n));
    for (let r = 0, k = 0; r * cellLen < 8 * BAR; r++) cell.forEach((n, j) => { if (r % 2 === 1 && j === (r + seed) % cell.length) return;
      out.push(Object.assign({}, n, { t: n.t + r * cellLen, dur: Math.min(n.dur, cellLen), v: Math.round(clamp(n.v * (0.78 + 0.05 * r), 1, 127)) })); k++; }); }
  return notes.filter((n) => !used.has(n)).concat(out).sort((a, b) => a.t - b.t);
}

// the orchestra as one element inside the band: two sections of the symphony, taking turns every 32 bars, together on the summit
function orchElement(tracks, c, seed) {
  const G = { strings: ['vln2', 'vla', 'vc'], high: ['vln1', 'fl', 'svn', 'ob'], brass: ['hn', 'tpt', 'tbn', 'stpt', 'shn'], low: ['vc', 'cb', 'bsn', 'tba'] };
  const x = c.c, order = x.weight + x.tension > 0.6 ? ['brass', 'strings'] : x.light > 0.3 ? ['high', 'strings'] : x.tension > 0.3 ? ['strings', 'low'] : ['strings', 'high'];
  if (H(seed, 'orch') % 2) order.reverse();
  const groupOf = (id) => order.findIndex((g) => G[g].includes(id));
  return tracks.filter((t) => groupOf(t.id) >= 0).map((t) => { const gi = groupOf(t.id);
    const notes = t.notes.filter((n) => { const blk = Math.floor(n.t / (32 * BAR)), e = eAt(c, n.t / Math.max(1, c.bars * BAR * c.feelsLike / 120));
      return blk % 2 === gi || e > 0.82; });
    return Object.assign({}, t, { notes: hotPocket(notes, seed) }); });
}

// ---------- a bass that plays: longer notes, octave jumps, pushes ahead of the beat; blues walks ----------
function playBass(bass, c, genre, seed) {
  if (!bass.length) return bass; const R = rng(H(seed, 'bass')), e = c.energy;
  if (/Blues/.test(genre)) { // a walking bass: root, third or fifth, sixth, and a step into the next root, four to the bar, a little swing
    const root = {}; bass.forEach((n) => { const b = Math.floor(n.t / BAR); if (root[b] == null || n.p < root[b]) root[b] = n.p; });
    const bars = Object.keys(root).map(Number).sort((a, b) => a - b), out = [], sc = c.minor ? SCALE.minor : SCALE.major;
    bars.forEach((b) => { const r = fold(root[b], 33, 52), nx = root[b + 1] != null ? fold(root[b + 1], 33, 52) : r, third = r + (c.minor ? 3 : 4);
      [r, R() < 0.5 ? third : r + 7, r + 9, nx + (nx > r ? -1 : 1)].forEach((p, k) => out.push({ t: b * BAR + k * PPQ + (k % 2 ? 40 : 0), d: PPQ - 50, p, v: k === 0 ? 100 : 84 })); });
    return out; }
  const out = [];
  bass.sort((a, b) => a.t - b.t).forEach((n, k) => { const m = Object.assign({}, n), nx = bass[k + 1], bar = Math.floor(n.t / BAR);
    if (nx && R() < 0.25 + 0.2 * e && nx.t - n.t <= PPQ * 2) m.d = Math.max(m.d, nx.t - n.t - 20);            // longer, singing notes
    if (n.t % PPQ !== 0 && bar % 2 === 1 && R() < 0.3 && m.p + 12 <= 64) m.p += 12;                        // an octave jump on an offbeat
    out.push(m);
    if (nx && Math.floor(nx.t / BAR) > bar && nx.t % BAR === 0 && R() < 0.22 + 0.25 * e) out.push({ t: nx.t - PPQ / 4, d: PPQ / 4 - 10, p: nx.p, v: Math.round(n.v * 0.85) }); // a push just before the next bar
  });
  return out;
}

// ---------- the motif in its costume ----------
function motifNotes(plan, c, F, shape) {
  const m = plan.motif, cos = c.costume, half = cos.includes('half, a memory') || shape === 'riff';
  const sc = shape === 'long' ? 0 : shape === 'riff' ? 0.5 : cos.includes('quicker') ? 0.5 : cos.includes('slower') ? 2 : 1;
  const base = cos.includes('low') ? 48 : cos.includes('high') ? 72 : 60, inv = cos.includes('upside down'), grand = cos.includes('grand');
  const out = []; let t = 0;
  m.degrees.forEach((d, k) => { if (half && k >= Math.ceil(m.degrees.length / 2)) return; const dur = shape === 'long' ? 2 * BAR : m.rhythm[k] * sc * PPQ; // long: every note two bars, a line under the music
    const p = deg(c.tonic, c.minor, inv ? -d : d, base); const v = Math.round((grand ? 104 : cos.includes('bare') ? 80 : 88) * (shape === 'long' ? 0.62 : shape === 'riff' ? 0.7 : 0.8));
    out.push({ t, d: Math.round(dur * 0.92), p, v }); if (grand) out.push({ t, d: Math.round(dur * 0.92), p: p - 12, v: v - 14 }); t += dur; });
  return { notes: out, len: t };
}

// ---------- drum notes as pitches, for a swap (a synth that plays the percussion) ----------
function pitchDrums(notes, c, isLane) {
  const LANE = [0, -7, 4, 7, 9, 11, 5, 14], VOICE = { drum: 0, odaiko: -7, bass1: -7, bass2: -5, don: 0, clo: 4, chi: 7, slap: 9, bhi: 11, blo: 6, shk: 14, tamb: 13, bell: 16, bell2: 12, wood: 10, clave: 15, ka: 9, shime: 7, shimeka: 15, okedo: 4, kane: 16, kake: 11, apito: 18, snare: 7, rim: 9, tenor1: 11, tenor2: 9, tenor3: 7, tenor4: 4, bass3: -3, bass4: -1, bass5: 1, cym: 21, cyc: 21 };
  return notes.map((n) => ({ t: n.t, d: Math.min(n.d || 120, 240), v: n.v, p: deg(c.tonic, c.minor, isLane ? LANE[n.lane] || 0 : VOICE[n.voice] || 0, 48) }));
}

// ---------- one chapter: every role as notes in content time ----------
function chapterContent(ctx, plan, i) {
  const { E, P, S, Y, JP } = ctx, c = plan.chapters[i], B = plan.bpm, F = c.feelsLike, seed = H(plan.seed, i, c.word);
  const lenTicks = c.bars * BAR, needContent = Math.ceil(lenTicks * F / B) + BAR, contentBars = Math.ceil(needContent / BAR);
  const roles = new Set(c.players.map((p) => p.role)), out = { tracks: {} };
  const symLead = c.lead.machine === 'symphony';
  // the harmony: Studio engine, or the Symphony when it leads
  const studioArt = artFor(JP, c, 'studio');
  const song = studioSong(E, studioArt.name, c, contentBars, seed, F);
  out.song = song; out.studio = studioArt.name;
  let bass = [], chords = [], melody = [], harmonic = [], orch = null;
  if (symLead) { const res = symphonyRes(Y, c.lead, c, needContent, seed, F); out.symphony = res;
    if (roles.has('beats') || roles.has('perc')) { const q = (t) => Math.round(t / (PPQ / 4)) * (PPQ / 4); // one band, one clock: no rubato against a beat
      res.tracks.forEach((tr) => { tr.notes.forEach((n) => { const e = q(n.t + n.dur); n.t = q(n.t); n.dur = Math.max(PPQ / 4, e - n.t); }); tr.cc.forEach((e) => { e.t = q(e.t); }); tr.ks.forEach((e) => { e.t = q(e.t); }); }); }
    const get = (ids) => res.tracks.filter((t) => ids.includes(t.id)).flatMap((t) => t.notes.map((n) => ({ t: n.t, d: n.dur, p: n.m, v: n.v })));
    bass = get(['cb']).length ? get(['cb']) : get(['vc']); chords = get(['vla', 'vln2']); melody = get(['svn', 'fl', 'ob']).length > get(['vln1']).length * 0.6 ? get(['svn', 'fl', 'ob']) : get(['vln1']);
    harmonic = get(['vln2', 'vla', 'vc', 'cb', 'hn']); orch = res.tracks;
    if (roles.has('beats') || roles.has('perc')) orch = orchElement(res.tracks, c, seed);
  } else {
    bass = E.renderSong(song, 'bass'); chords = E.renderSong(song, 'chords'); const pad = E.renderSong(song, 'pad');
    if (chords.length < pad.length) chords = chords.concat(pad);
    melody = E.renderSong(song, 'melody').concat(E.renderSong(song, 'answer'));
    harmonic = chords.concat(pad, bass);
  }
  // the beat: always from the Studio engine (a rhythm never clashes with a harmony)
  out.beat = roles.has('beats') ? E.renderSong(song, 'beat') : [];
  // the engine leaves some sections without drums (an intro, a prechorus); where the journey wants a groove, the groove of
  // the nearest bar that has one carries on, so a song never waits half its length for its beat
  if (out.beat.length) { const by = {}; out.beat.forEach((n) => { const b = Math.floor(n.t / BAR); (by[b] = by[b] || []).push(n); });
    const wantAt = (b) => { if (!c.song) return true; const q = c.song.find((x) => b / contentBars < x.u1) || c.song[c.song.length - 1]; return q.type !== 'break' && q.type !== 'outro' && (q.type !== 'intro' || b >= 8); };
    const have = Object.keys(by).map(Number).sort((x, y) => x - y), add = [];
    for (let b = 0; b < contentBars; b++) { if (by[b] || !wantAt(b)) continue;
      let src = null; for (let d = 8; d <= contentBars && src == null; d += 8) { if (by[b - d]) src = b - d; else if (by[b + d]) src = b + d; }
      if (src == null) src = have.reduce((a2, x) => (Math.abs(x - b) < Math.abs(a2 - b) ? x : a2), have[0]);
      by[src].forEach((n) => add.push(Object.assign({}, n, { t: n.t - src * BAR + b * BAR }))); }
    out.beat = out.beat.concat(add); }
  // something happens: the last two beats of every 16 bars are a fill (snare and percussion lanes taking turns)
  { const every = c.song ? 16 : 32, R = rng(H(seed, 'fill')); if (out.beat.length) for (let b = every - 1; b < contentBars; b += every) { const t0 = b * BAR + 2 * PPQ, kind = R();
    for (let k = 0; k < 8; k++) { if (kind < 0.4 && k % 2 && R() < 0.5) continue; const acc = k % 4 === 0 ? 16 : 0;
      out.beat.push({ t: t0 + k * PPQ / 4 + Math.round((R() - 0.5) * 12), d: 60, lane: kind < 0.5 ? (k < 4 ? 2 : 6) : k % 3 === 2 ? 6 : 2, v: Math.round(clamp(52 + k * 5 + acc - (R() < 0.25 ? 20 : 0), 10, 120)) }); } } }
  // the beat evolves: before a new 16 bars the kick rests for 2 bars, and every 4th block opens with 4 bars of hats and percussion only
  out.beat = out.beat.filter((n) => { const bar = Math.floor(n.t / BAR), blk = Math.floor(bar / 16), inb = bar % 16;
    if (blk % 2 === 1 && inb >= 14 && n.lane <= 1) return false;
    if (blk % 4 === 2 && inb < 4 && n.lane <= 3) return false; return true; });
  // percussion: the Percussion Machine, in the style of this chapter
  const percArt = c.lead.machine === 'percussion' ? c.lead : c.guests.find((g) => g.machine === 'percussion') || nearest(JP, 'percussion', c.c);
  out.percStyle = percArt.name;
  if (roles.has('perc') || roles.has('beats')) {
    const secs = []; if (c.song) { let at = 0; c.song.forEach((q, k) => { const end = k === c.song.length - 1 ? contentBars : Math.max(at + 8, Math.round(q.u1 * contentBars / 8) * 8); if (end > at) secs.push({ type: ENGINE_TYPE[q.type] || 'verse', bars: end - at }); at = end; }); }
    else for (let b = 0, k = 0; b < contentBars; b += 8, k++) { const e = eAt(c, b / contentBars); secs.push({ type: e < 0.35 ? 'verse' : e < 0.68 ? 'chorus' : 'drop', bars: Math.min(8, contentBars - b) }); }
    // a hand drummer never plays at 240: double and fast feels are played at a human tempo, the groove still sits on the beat
    let Fp = F; while (Fp > 132) Fp /= 2; const ps = secs.map((q) => Object.assign({}, q, { bars: Math.max(1, Math.ceil(q.bars * Fp / F)) }));
    const pr = P.generate({ style: PERC_KEY[percArt.name] || 'minimal', bpm: Fp, seed, wild: clamp(0.12 + c.energy * 0.35, 0, 1), swing: c.c.warm > 0.3 ? 0.4 : 0, sections: ps });
    out.perc = pr.events.map((e) => ({ t: Math.round(e.t * F / 60 * PPQ), d: 120, voice: e.v, v: e.vel }));
  } else out.perc = [];
  // Score: follows the harmony, adds its tension (for STRIIIINGS and PERRCS)
  const wantsScore = c.players.some((p) => p.player === 'STRIIIINGS' || p.player === 'PERRCS');
  if (wantsScore) { const scoreArt = c.lead.machine === 'score' ? c.lead : c.guests.find((g) => g.machine === 'score') || nearest(JP, 'score', c.c);
    let sc = S.newScore(SCORE_KEY[scoreArt.name] || 'suspense', { seed }); sc.bpm = F;
    sc = S.fromTrack(sc, { notes: harmonic.filter((n) => n.t < needContent), meter: 4, bpm: F }); sc.parts.percs.on = true; sc.parts.strings.on = true;
    const r = S.render(sc), cats = S.catsFor(sc); out.score = { r, cats, style: scoreArt.name }; }
  out.bass = playBass(bass, c, studioArt.name, seed); out.chords = chords; out.melody = melody;
  out.orch = orch || orchestrate(chords, bass, c.energy > 0.6 && !roles.has('melody') ? melody : [], c);
  out.F = F; out.lenTicks = lenTicks;
  return out;
}

// ---------- the language of each player ----------
function speak(ctx, role, player, content, c) {
  const { E } = ctx, song = content.song, tr = [];
  const one = (name, notes, cc) => tr.push({ name, notes, cc: cc || [] });
  const isDrumRole = role === 'beats' || role === 'perc';
  const drumPlugin = ['XO', 'Impact', 'EZdrummer', 'Virtual Drummer', 'Beatmaker', 'Tekno', 'Kick 1', 'Kick 2'].includes(player);
  if (isDrumRole) {
    const lanes = role === 'beats' ? content.beat : [], voices = role === 'perc' ? content.perc : [];
    if (player === 'PERRCS' && content.score) { const s = content.score; const k = role === 'perc' ? 'perA' : 'perB'; one('PERRCS, Style ' + s.cats[k], s.r[k].notes, s.r[k].ccs); return tr; }
    if (player === 'Kick 1' || player === 'Kick 2') { const ns = role === 'beats' ? lanes.filter((n) => n.lane <= 1).map((n) => ({ t: n.t, d: n.d, v: n.v, p: 36 })) : voices.filter((n) => KICKS.has(n.voice)).map((n) => ({ t: n.t, d: 120, v: n.v, p: 36 })); one(player + ' (kick only)', ns); return tr; }
    if (drumPlugin || player === JP_PLAIN || player === 'PERRCS') {
      if (role === 'beats') { const key = PK[player] || 'gm'; one(player === JP_PLAIN ? 'Beat, standard drum notes' : 'Beat for ' + player, E.applyMask(song, 'beat', lanes, key, { mode: 'instrument' })); return tr; }
      const style = content.percKey, sl = style === 'taiko' ? TAIKO_SLOTS : style === 'marching' ? MARCH_SLOTS : PERC_SLOTS, k = PK[player];
      const noteOf = (v) => { if (player === 'Tekno') return TEKNO_PERC[v] || 43; if (PERC_KEYS[k]) { const i = sl.findIndex((s) => s.includes(v)); return PERC_KEYS[k][Math.max(0, i)]; } return ctx.P.VOICES[v] ? ctx.P.VOICES[v].gm : 60; };
      one(player === JP_PLAIN ? 'Percussion, standard drum notes' : 'Percussion for ' + player, voices.map((n) => ({ t: n.t, d: 120, v: n.v, p: noteOf(n.voice) }))); return tr;
    }
    // a pitched instrument plays the drums: every drum becomes a tone of the key
    const pitched = pitchDrums(role === 'beats' ? lanes : voices, c, role === 'beats');
    return speak(ctx, 'chords', player, Object.assign({}, content, { chords: pitched }), c).map((t) => Object.assign(t, { name: t.name.replace('Chords', JR_ROLE[role]) }));
  }
  const src = role === 'bass' ? content.bass : role === 'chords' ? content.chords : role === 'melody' ? content.melody : role === 'motif' ? content.motif : null;
  if (role === 'orch') {
    if (player === 'STRIIIINGS' && content.score) { const s = content.score; one('Strings A for STRIIIINGS, Style ' + s.cats.strA, s.r.strA.notes, s.r.strA.ccs); one('Strings B for STRIIIINGS, Style ' + s.cats.strB, s.r.strB.notes, s.r.strB.ccs); return tr; }
    let tracks = content.orch;
    if (player === 'Berlin') tracks = ctx.Y.toBerlin(tracks);
    for (const t of tracks) { if (!t.notes.length) continue;
      const ks = player === 'BBC' ? (t.ks || []).map((k) => ({ t: k.t, d: 12, p: k.m, v: 100, ks: 1 })) : [];
      one(t.name + (player === JP_PLAIN ? '' : ' for ' + player), ks.concat(t.notes.map((n) => ({ t: n.t, d: n.dur, p: n.m, v: n.v }))), player === JP_PLAIN ? t.cc.filter((e) => e.c !== 70) : t.cc); }
    return tr;
  }
  if (!src) return tr;
  const label = JR_ROLE[role];
  if (player === JP_PLAIN) { one(label, src); return tr; }
  if (PK[player]) { const part = role === 'motif' ? 'melody' : role; one(label + ' for ' + player + ' (Instrument mode)', E.applyMask(song, part === 'orch' ? 'pad' : part, src, PK[player], { mode: 'instrument' })); return tr; }
  // Berlin and BBC on a single line: one named orchestra instrument, in its own range and language
  if (player === 'Berlin' || player === 'BBC') {
    const pick = role === 'bass' ? ['vc', 'Celli', 36, 60, 's'] : role === 'chords' ? ['vln2', 'Violins 2', 55, 81, 's'] : role === 'motif' ? (!ctx.fixed && (c.costume.includes('grand') || c.costume.includes('low')) ? ['hn', 'Horns', 41, 72, 'w'] : ['ob', 'Oboe', 60, 86, 'w']) : !ctx.fixed && c.c.light > 0.3 ? ['fl', 'Flute', 62, 93, 'w'] : ['vln1', 'Violins 1', 57, 93, 's'];
    const t = { id: pick[0], name: pick[1], ksType: pick[4], notes: src.map((n) => ({ t: n.t, dur: n.d, m: fold(n.p, pick[2], pick[3]), v: n.v, art: 'long' })), cc: [{ t: 0, c: 1, v: 90 }, { t: 0, c: 11, v: 110 }], ks: [{ t: 0, m: 0 }] };
    const out = player === 'Berlin' ? ctx.Y.toBerlin([t]) : [t];
    for (const x of out) one(label + ' for ' + player + ', ' + x.name, (player === 'BBC' ? (x.ks || []).map((k) => ({ t: k.t, d: 12, p: k.m, v: 100, ks: 1 })) : []).concat(x.notes.map((n) => ({ t: n.t, d: n.dur, p: n.m, v: n.v }))), x.cc);
    return tr;
  }
  // STRIIIINGS, Presence, Diva on a single line: fold into a range that sounds
  const rg = role === 'bass' ? [28, 55] : role === 'chords' ? [48, 79] : [55, 91];
  one(label + ' for ' + player, src.map((n) => Object.assign({}, n, { p: fold(n.p, rg[0], rg[1]) })), player === 'Berlin' || player === 'BBC' ? [{ t: 0, c: 1, v: 90 }, { t: 0, c: 11, v: 110 }] : []);
  return tr;
}
const JP_PLAIN = 'Plain MIDI';
const JR_ROLE = { beats: 'Beat', perc: 'Percussion', bass: 'Bass', chords: 'Chords', melody: 'Melody', orch: 'Orchestra', motif: 'Motif' };

// who plays in this bar: the energy sets how many layers, and the layers breathe in waves of 16 bars
function plays(plan, i, rank, bar, bars) {
  // bar and bars are counted in the chapter's own musical bars, so phrases stay whole in every feel
  const c = plan.chapters[i], n = plan.chapters.length, np = c.players.length;
  const ph = Math.floor(bar / 8) * 8; let L = Math.max(1, layersAt(c, ph / bars));
  const edge = (i === 0 && bar < 16) || (i === n - 1 && bar >= bars - 16);
  if (!edge && eAt(c, ph / bars) > (c.song ? 0.4 : 0.15)) L = Math.max(L, Math.min(3, np)); // a chapter is never just one dry layer for long
  if (L === 1 && bar >= 16) L = 2;
  if (bar < 48 && !edge) L = Math.max(L, Math.min(np, 2 + Math.floor(bar / 8))); // a chapter never waits: from the start one more layer every 8 bars
  L = Math.min(L, np);
  // never just a beat and percussion for long: after 4 bars something with a tone joins them
  if (c._order && bar >= 4) { while (L < np && c._order.slice(0, L).every((r) => r === 'beats' || r === 'perc')) L++; }
  if (rank >= L) return false;
  // waves: every other 16 bars one layer rests, on a big moment a second one; never the leader (rank 0)
  const blk = Math.floor(bar / 16), h = (blk * 2654435761 + i * 40503) >>> 0;
  if (L >= 3 && blk % 2 === 1 && rank === 1 + (h % (L - 1))) return false;
  if (L >= 5 && blk % 4 === 3 && rank === 1 + ((h >>> 8) % (L - 1))) return false;
  return true;
}

// ---------- the transitions: one beat, one bass, one harmony, one melody at a time ----------
// window out = the last bars of this chapter that overlap the next one; window in = the first bars that overlap the previous one
const HARM = new Set(['chords', 'orch']);
function win(plan, i) {
  const c = plan.chapters[i], nx = plan.chapters[i + 1], pv = plan.chapters[i - 1];
  const out = nx ? c.overlap || 0 : 0, inn = pv ? pv.overlap || 0 : 0;
  return { out, inn, nx, pv, keyOut: nx && (nx.tonic !== c.tonic || nx.minor !== c.minor), keyIn: pv && (pv.tonic !== c.tonic || pv.minor !== c.minor),
    feelOut: nx && nx.feel.id !== c.feel.id, feelIn: pv && pv.feel.id !== c.feel.id,
    // the new melody waits for the first whole phrase after the handover, then grows in over 8 bars
    melodyIn: pv ? Math.max(8, Math.ceil(inn / 8) * 8) : 0 };
}
// the rhythm handover in the chapter's own time: the old kick and snare leave halfway, the new ones arrive halfway; hats carry the seam
function handRhythm(list, plan, i, isKick, isBack) {
  const c = plan.chapters[i], w = win(plan, i), k = c.feelsLike / plan.bpm, cb = (jb) => jb * BAR * k;
  const W0 = cb(c.bars - w.out), Wh = cb(c.bars - w.out / 2), I1 = cb(w.inn), Ih = cb(w.inn / 2);
  return list.filter((n) => { if (n.roll) return true;
    // a different feel never overlaps: the old groove plays to the middle of the window, the new one takes over right there, no hole
    if (w.out && n.t >= W0) { if (w.feelOut ? n.t >= Wh : (isKick(n) || isBack(n)) && n.t >= Wh) return false; }
    if (w.inn && n.t < I1) { if (w.feelIn ? n.t < Ih : (isKick(n) || isBack(n)) && n.t < Ih) return false; }
    return true; });
}

// ---------- the percussionist: joins in, listens, answers, builds ----------
// voices enter one by one ("you drum, I join with my djembe"), the number of voices follows the energy,
// every 4th bar is the answer (a fill with more voices), the busiest bars of the beat leave room, accents breathe
function percussionist(ev, plan, i, styleKey, swing) {
  if (!ev.length) return ev;
  const c = plan.chapters[i], F = c.feelsLike, cb = c.bars * F / plan.bpm, lead = c.lead.machine === 'percussion';
  const sl = styleKey === 'taiko' ? TAIKO_SLOTS : styleKey === 'marching' ? MARCH_SLOTS : PERC_SLOTS;
  const rankOf = (v) => { const k = sl.findIndex((q) => q.includes(v)); return k < 0 ? 5 : k; };
  // the order voices join: a soft time keeper first (shaker, bell), then the low drum, then the talking voices
  const JOIN = [5, 6, 0, 1, 2, 3, 4, 7], joinRank = (v) => JOIN.indexOf(rankOf(v));
  const R = rng(H(plan.seed, 'perc', i)), keepP = {};
  const kept = ev.filter((n) => {
    const bar = Math.floor(n.t / BAR), e = eAt(c, bar / Math.max(1, cb));
    const grow = Math.min(8, 2 + Math.floor(bar / (lead ? 4 : 8)));          // one more voice every 8 bars (4 when percussion leads)
    let V = Math.min(grow, Math.max(1, Math.round(1 + e * (lead ? 7 : 5))));   // the energy decides how many may play
    const inBar = bar % 4, fill = inBar === 3;
    if (fill) V = Math.min(8, V + 2); else if (inBar === 1) V = Math.max(1, V - 1); // a call, a breath, the answer
    const jr = joinRank(n.voice); if (jr >= V) return false;
    // the newest voice in plays sparser, it is still finding its place
    if (jr === V - 1 && !fill) { const key = bar + ':' + n.voice; if (keepP[key] == null) keepP[key] = R() < 0.55; if (!keepP[key]) return false; }
    const pos = n.t % BAR, beat = pos % PPQ === 0;
    n.v = Math.round(clamp(n.v * (beat ? 1.08 : 0.86) * (fill ? 1.06 : 1), 1, 127));
    n.jr = jr; return true; });
  // one clock: in a straight chapter the hands play on the band's 16ths, with the band's swing; never two hits of one voice on one step
  const S16 = PPQ / 4, trip = c.feel.id === 'triplet', sw = Math.round(((swing || 50) * 2 / 100 - 1) * S16), seen = new Set();
  let out = kept;
  if (!trip) out = kept.filter((n) => { let st = Math.round(n.t / S16); const key = st + n.voice; if (seen.has(key)) return false; seen.add(key);
    n.t = st * S16 + (st % 2 ? sw : 0); return true; });
  // a hand drummer plays a handful of notes per bar, not a wall: the most important voices and the beats of the bar win
  const per = {}; out.forEach((n) => { const b = Math.floor(n.t / BAR); (per[b] = per[b] || []).push(n); });
  const final = [];
  for (const [b, list] of Object.entries(per)) { const e = eAt(c, +b / Math.max(1, cb)), cap = Math.round(5 + e * (lead ? 11 : 7));
    list.sort((a, z) => (a.jr - z.jr) || ((a.t % PPQ ? 1 : 0) - (z.t % PPQ ? 1 : 0))); list.slice(0, cap).forEach((n) => final.push(n)); }
  return final.sort((a, z) => a.t - z.t);
}

// ---------- shaping in journey time: layers, breaths, transitions, the ending ----------
function shape(plan, i, role, rank, notes, tl) {
  const c = plan.chapters[i], n = plan.chapters.length, len = c.bars * BAR, o = [], w = win(plan, i);
  const k = c.feelsLike / plan.bpm, cbars = c.bars * k;
  for (const x of notes) {
    if (x.t < -PPQ / 2 || x.t >= len) continue; if (x.t < 0) x = Object.assign({}, x, { t: 0 }); const bar = Math.floor(x.t / BAR), u = x.t / len;
    const fb = x.t / BAR; // bar as a fraction, for smooth fades
    let fade = 1;
    if (role === 'motif' && ((w.out && w.keyOut && fb >= c.bars - w.out / 2) || (w.inn && w.keyIn && fb < w.inn / 2))) continue; // the motif speaks the key that sounds
    if (role !== 'motif' && !x.ks) {
      // layers: each role has a rank; it plays when the energy carries that many layers
      const seam = (w.out && bar >= c.bars - w.out - 2) || (w.inn && bar < w.inn + 2), rhythm = role === 'beats' || role === 'perc';
      const cbar = Math.floor(x.t * k / BAR), sec = c.song ? (c.song.find((q) => cbar / cbars < q.u1) || c.song[c.song.length - 1]).type : '',
        groove = role === 'beats' && (c.song ? sec !== 'break' && sec !== 'outro' && (cbar >= 16 || eAt(c, cbar / cbars) > 0.3) : cbar >= 16 || (i > 0 && eAt(c, cbar / cbars) > 0.2));
      const overture = i === 0 && plan.opening.id === 'overture';
      if (overture && (role === 'beats' || role === 'perc') && bar < 24) continue;       // the overture: harmony alone, then the groove slides in
      if (overture && role === 'bass' && bar < 16) continue;
      const gift = c._gift != null && bar >= c._gift && bar < c._gift + 8;             // the gift: everyone plays
      if (!(overture && HARM.has(role) && bar < 48) && !gift && !(seam && rhythm) && !groove && !plays(plan, i, rank, cbar, cbars)) continue; // the groove never drops out at a seam, and the beat holds the floor
      // a breath inside the chapter: two bars where only the motif sounds
      if (c.breathInside && bar >= c.breathInside.bar && bar < c.breathInside.bar + 2) continue;
      // the way out
      if (i < n - 1) {
        if (c.out === 'breath' && bar >= c.bars - 1 && !HARM.has(role)) continue; // the breath: one bar where the rhythm, bass and melody let go
        if (c.out === 'motif' && bar >= c.bars - 4 && rank > 0) continue;
        if (w.out && bar >= c.bars - w.out) { const p = (fb - (c.bars - w.out)) / w.out;
          if ((role === 'melody' && p >= 0.25) || (role === 'bass' && p >= 0.5)) continue; // the old melody bows out first, the old bass hands over halfway
          if (HARM.has(role) && p >= 0.5) continue;                                   // one harmony at a time, always: the seam stays clear
          if (role === 'perc' && p >= 0.6) continue;
          fade = c.out === 'filter' ? 1 - 0.75 * p : 1 - 0.5 * p; }
        if (c.out === 'riser' && bar >= c.bars - 16) fade *= 0.75 + 0.35 * ((fb - (c.bars - 16)) / 16); // the build lifts everything, still inside the old song
      }
      // the way in
      if (w.inn && bar < w.inn) { const p = fb / w.inn;
        if (role === 'bass' && p < 0.5) continue; // the new bass takes over halfway, right where the old one leaves
        if (HARM.has(role) && w.keyIn && p < 0.5) continue;
        fade = Math.min(fade, w.pv.out === 'filter' ? 0.25 + 0.75 * p : 0.5 + 0.5 * p); }
      if (role === 'melody' && w.pv) { if (bar < w.melodyIn) continue; fade = Math.min(fade, 0.55 + 0.45 * clamp((fb - w.melodyIn) / 8, 0, 1)); }
    }
    let v = x.v;
    if (!x.ks) { v = v * (0.72 + 0.4 * eAt(c, u)) * fade * (c._gift != null && bar >= c._gift && bar < c._gift + 8 ? 1.12 : 1);
      if (i === n - 1 && plan.ending.id === 'fade') v *= 1 - 0.7 * clamp((u - 0.75) / 0.25, 0, 1); }
    // nothing rings over the line it may not cross: the old melody and bass stop as the window opens, the old harmony at its middle when the key changes
    let lim = len;
    if (w.out && i < n - 1) { const W0 = (c.bars - w.out) * BAR, Wh = (c.bars - w.out / 2) * BAR;
      const Wq = (c.bars - w.out * 0.75) * BAR; if (role === 'melody' && x.t < Wq) lim = Wq; else if (role === 'bass' && x.t < Wh) lim = Wh; else if ((HARM.has(role) || role === 'melody' || role === 'motif') && w.keyOut && x.t < Wh) lim = Wh; }
    if (lim - x.t < 90) continue;
    o.push({ t: x.t + tl[i].start, d: Math.max(30, Math.min(x.d, lim - x.t)), p: x.p, v: clamp(Math.round(v), 1, 127), ks: x.ks });
  }
  return o;
}

// ---------- the players listen to each other ----------
// the melody rests while the motif speaks (call and response), the chords step aside under the melody,
// the supporting layers play softer when a voice sings or when the stage is full, and every 32 bars they all breathe in together
function listen(all, plan, tl) {
  plan.chapters.forEach((c, i) => {
    const T = all.filter((t) => t.chapter === i), s0 = tl[i].start, w = win(plan, i), byRole = (r) => T.filter((t) => t.role === r);
    const barOf = (t) => Math.floor((t - s0) / BAR);
    // where the voices are: motif statements and melody, per bar
    const motifSpans = []; byRole('motif').forEach((t) => t.notes.forEach((n) => motifSpans.push([n.t - PPQ / 4, n.t + n.d])));
    const sings = new Set(), melLow = {};
    byRole('melody').forEach((t) => { t.notes = t.notes.filter((n) => !motifSpans.some(([a, b]) => n.t < b && n.t + n.d > a)); });
    byRole('melody').concat(byRole('motif')).forEach((t) => t.notes.forEach((n) => { if (n.ks) return; const b = barOf(n.t); sings.add(b); if (t.role === 'melody') melLow[b] = Math.min(melLow[b] == null ? 999 : melLow[b], n.p); }));
    // how full the stage is, per bar
    const full = {}; T.forEach((t) => { const seen = new Set(); t.notes.forEach((n) => { const b = barOf(n.t); if (!seen.has(b)) { seen.add(b); full[b] = (full[b] || 0) + 1; } }); });
    T.forEach((t) => {
      const support = t.role === 'chords' || t.role === 'orch' || t.role === 'perc';
      t.notes.forEach((n) => { if (n.ks) return; const b = barOf(n.t);
        if (t.role === 'chords' && melLow[b] != null && n.p >= melLow[b] - 1 && n.p - 12 >= 40) n.p -= 12; // under the melody, never on top of it
        if (support && sings.has(b)) n.v = Math.max(1, Math.round(n.v * 0.84));
        if (support && (full[b] || 0) >= 6) n.v = Math.max(1, Math.round(n.v * 0.9)); });
    });
    // the melody leaves some wonder: before the summit it gives fragments (the first half of each phrase), on the summit the whole line,
    // after it again fragments, every other phrase
    { const peakU = (() => { let best = 0, bu = 0.5; for (let u = 0; u <= 1; u += 0.02) { const e = eAt(c, u); if (e > best) { best = e; bu = u; } } return bu; })();
      byRole('melody').forEach((t) => { t.notes = t.notes.filter((n) => { if (n.ks) return true; const rel = (n.t - s0) / BAR, u = rel / c.bars, ph = Math.floor(rel / 8), inPh = rel % 8;
        if (c._gift != null && rel >= c._gift && rel < c._gift + 8) return true;
        if (Math.abs(u - peakU) < 0.12) return true; if (u < peakU) return inPh < 4.5; return ph % 2 === 0 && inPh < 5; }); }); }
    // silence at the right moments, flow everywhere else:
    // the harmony is a bed that holds until the next chord (never into a breath, a handover or the end), the melody sings legato
    // over small gaps and only breathes at the end of a phrase (every 8 bars)
    const stops = []; // moments nothing may ring into
    if (c.breathInside) stops.push(s0 + c.breathInside.bar * BAR);
    if (i < plan.chapters.length - 1) { if (c.out === 'breath') stops.push(s0 + (c.bars - 1) * BAR); if (w.out) stops.push(s0 + (c.bars - (w.keyOut ? w.out / 2 : 0)) * BAR); if (c.out === 'motif') stops.push(s0 + (c.bars - 4) * BAR); }
    stops.push(s0 + c.bars * BAR);
    const nextStop = (t) => stops.filter((x) => x > t).reduce((a, b) => Math.min(a, b), Infinity);
    T.forEach((t) => {
      const bed = t.role === 'chords' || t.role === 'orch', sing = t.role === 'melody';
      if (!bed && !sing) return;
      const ns = t.notes.filter((n) => !n.ks).sort((a, b) => a.t - b.t), on = [...new Set(ns.map((n) => n.t))];
      ns.forEach((n) => { const k = on.findIndex((x) => x > n.t); const nx = k < 0 ? Infinity : on[k], gap = nx - (n.t + n.d);
        if (gap <= 0) return;
        let to = n.t + n.d;
        if (bed && n.d >= 2 * PPQ && nx - n.t <= 2 * BAR) to = nx - 20; // held chords become a bed; short stabs stay stabs
        if (sing && gap < 2 * PPQ) { const phraseEnd = Math.floor((nx - s0) / (8 * BAR)) !== Math.floor((n.t - s0) / (8 * BAR)); if (!phraseEnd) to = nx - 30; }
        n.d = Math.max(n.d, Math.min(to, nextStop(n.t)) - n.t); });
    });
    // a breath between two songs is never empty: the last chord hangs, soft, through the silent bar into the next song
    if (i < plan.chapters.length - 1 && c.out === 'breath') { const g = s0 + (c.bars - 1) * BAR, end = s0 + c.bars * BAR;
      T.filter((t) => HARM.has(t.role)).forEach((t) => { const ns = t.notes.filter((n) => !n.ks && n.t < g && n.t >= g - 4 * BAR); if (!ns.length) return;
        const last = Math.max(...ns.map((n) => n.t)); t.notes = t.notes.filter((n) => n.ks || n.t < g || n.t >= end);
        ns.filter((n) => n.t === last).forEach((n) => { n.d = end - n.t - 10; n.v = Math.max(20, Math.round(n.v * 0.7)); }); }); }
    if (c._gift != null) { const g0 = s0 + c._gift * BAR, g1 = g0 + 8 * BAR;
      byRole('bass').forEach((t) => { const add = t.notes.filter((n) => !n.ks && n.t >= g0 && n.t < g1 && n.p - 12 >= 26).map((n) => Object.assign({}, n, { p: n.p - 12, v: Math.round(n.v * 0.8) })); t.notes = t.notes.concat(add); });
      const bt = byRole('beats')[0]; if (bt && bt.notes.length) { const crash = bt.notes.reduce((a2, n) => (n.p > a2 ? n.p : a2), 0); bt.notes.push({ t: g0, d: 240, p: crash, v: 116 }); } }
    // the shared breath: the last two beats before every 32nd bar, everyone lets go together (not in a handover, not at the very start or end)
    for (let b = 32; b < c.bars - Math.max(16, w.out); b += 32) { if (b < Math.max(16, w.inn + 8)) continue;
      const g0 = s0 + b * BAR - 2 * PPQ, g1 = s0 + b * BAR;
      T.forEach((t) => { if (t.role === 'motif') return;
        t.notes = t.notes.filter((n) => n.ks || !(n.t >= g0 && n.t < g1));
        if (t.role !== 'beats' && t.role !== 'perc') t.notes.forEach((n) => { if (!n.ks && n.t < g0 && n.t + n.d > g0) n.d = Math.max(60, g0 - n.t); }); });
    }
  });
}

// ---------- no empty seams: between two songs at most the one bar of a breath is silent ----------
// any longer hole near a boundary is filled by the motif of the chapter it belongs to, its last tone held to the end of the hole
function bridgeSilence(all, plan, tl) {
  const spans = all.flatMap((t) => t.notes.filter((n) => !n.ks).map((n) => [n.t, n.t + n.d])).sort((a, b) => a[0] - b[0]);
  const sounding = (t) => spans.some(([a, b]) => a <= t && b > t);
  plan.chapters.forEach((c, i) => { if (i === 0) return;
    const b = tl[i].start, pv = plan.chapters[i - 1], allowed = pv.out === 'breath' ? BAR + PPQ : PPQ * 2;
    for (let t = b - 4 * BAR; t < b + 6 * BAR; t += PPQ / 4) { if (sounding(t)) continue;
      let u = t; while (u < b + 10 * BAR && !sounding(u)) u += PPQ / 4;
      if (u - t > allowed) { // fill from where the silence may end
        const from = pv.out === 'breath' && t < b ? Math.max(t, b) : t + PPQ; if (u - from < PPQ) { t = u; continue; }
        const half = b + (pv.overlap || 0) * BAR / 2, k = from < half ? i - 1 : i, ch = plan.chapters[k], cap = k === i - 1 ? Math.min(u, half) : u, mo = motifNotes(plan, ch), f = plan.bpm / ch.feelsLike;
        let tr = all.find((x) => x.chapter === k && x.role === 'motif');
        if (!tr) { tr = { chapter: k, word: ch.word, role: 'motif', player: 'Plain MIDI', name: (k + 1) + ' ' + ch.word + ' . Motif . ' + plan.bpm + ' bpm . ' + JR.colour(ch, 'motif', 'Plain MIDI'), notes: [], cc: [] }; all.push(tr); }
        const add = mo.notes.map((n) => ({ t: from + Math.round(n.t * f), d: Math.round(n.d * f), p: n.p, v: Math.round(n.v * 0.8) })).filter((n) => n.t < cap);
        add.forEach((n) => { n.d = Math.min(n.d, cap - n.t - 10); });
        if (add.length) { const last = add[add.length - 1]; last.d = Math.max(last.d, cap - last.t - 20); add.forEach((n) => { tr.notes.push(n); spans.push([n.t, n.t + n.d]); }); }
      }
      t = u; }
  });
}

// ---------- no holes inside a chapter either: silence only where it was meant (a breath, the fading end) ----------
function fillHoles(all, plan, tl) {
  const S = PPQ / 4, total = tl[tl.length - 1].start + tl[tl.length - 1].len, cov = new Uint8Array(Math.ceil(total / S) + 2);
  all.forEach((t) => t.notes.forEach((n) => { if (n.ks) return; for (let k = Math.floor(n.t / S); k < Math.ceil((n.t + n.d) / S); k++) cov[k] = 1; }));
  plan.chapters.forEach((c, i) => {
    const s0 = tl[i].start, end = s0 + c.bars * BAR, meant = [];
    if (c.breathInside) meant.push([s0 + c.breathInside.bar * BAR, s0 + (c.breathInside.bar + 2) * BAR]);
    if (i < plan.chapters.length - 1 && c.out === 'breath') meant.push([end - BAR, end]);
    if (i === plan.chapters.length - 1) meant.push([end - 8 * BAR, end]);
    const isMeant = (t) => meant.some(([a, b]) => t >= a && t < b);
    for (let k = Math.ceil(s0 / S); k < Math.floor(end / S); k++) { if (cov[k] || isMeant(k * S)) continue;
      let u = k; while (u < Math.floor(end / S) && !cov[u] && !isMeant(u * S)) u++;
      if ((u - k) * S > 2 * BAR) { const from = k * S, to = u * S, mo = motifNotes(plan, c), f = plan.bpm / c.feelsLike;
        let tr = all.find((x) => x.chapter === i && x.role === 'motif');
        if (!tr) { tr = { chapter: i, word: c.word, role: 'motif', player: 'Plain MIDI', name: (i + 1) + ' ' + c.word + ' . Motif . ' + plan.bpm + ' bpm . ' + JR.colour(c, 'motif', 'Plain MIDI'), notes: [], cc: [] }; all.push(tr); }
        for (let at = from; at < to - BAR; at += 4 * BAR) { const add = mo.notes.map((n) => ({ t: at + Math.round(n.t * f), d: Math.round(n.d * f), p: n.p, v: Math.round(n.v * 0.75) })).filter((n) => n.t < Math.min(to, at + 4 * BAR));
          if (!add.length) break; const last = add[add.length - 1]; last.d = Math.max(last.d, Math.min(to, at + 4 * BAR) - last.t - 20);
          add.forEach((n) => { tr.notes.push(n); for (let q = Math.floor(n.t / S); q < Math.ceil((n.t + n.d) / S); q++) cov[q] = 1; }); } }
      k = u; }
  });
}

// ---------- never a dry rhythm for long: after 4 bars of only beat and percussion, the bass (or the chords) comes back with what it played last ----------
function toneGuard(all, plan, tl) {
  plan.chapters.forEach((c, i) => {
    const s0 = tl[i].start, w = win(plan, i), T = all.filter((t) => t.chapter === i), bars = c.bars;
    const tone = new Array(bars).fill(0), rh = new Array(bars).fill(0), b = (t) => Math.floor((t - s0) / BAR);
    T.forEach((t) => t.notes.forEach((n) => { if (n.ks) return; const q = b(n.t); if (q < 0 || q >= bars) return; if (t.role === 'beats' || t.role === 'perc') rh[q] = 1; else for (let k = q; k <= Math.min(bars - 1, b(n.t + n.d - 1)); k++) tone[k] = 1; }));
    const safe = (q) => q >= (w.inn || 0) && q < bars - (w.out || 0) && !(c.breathInside && q >= c.breathInside.bar && q < c.breathInside.bar + 2) && !(i === 0 && plan.opening.id === 'overture' && q < 24);
    const src = (pref) => T.filter((t) => t.role === pref && t.notes.some((n) => !n.ks));
    let run = 0;
    for (let q = 0; q < bars; q++) { if (rh[q] && !tone[q]) run++; else { run = 0; continue; }
      if (run <= 4 || !safe(q)) continue;
      for (const role of ['bass', 'chords', 'orch']) { const trs = src(role); let done = false;
        for (const tr of trs) { let from = -1; for (let k = q - 1; k >= 0; k--) { if (tr.notes.some((n) => !n.ks && b(n.t) === k)) { from = k; break; } } if (from < 0) continue;
          tr.notes.filter((n) => !n.ks && b(n.t) === from).forEach((n) => tr.notes.push(Object.assign({}, n, { t: n.t + (q - from) * BAR, v: Math.round(n.v * 0.92) }))); done = true; break; }
        if (done) { tone[q] = 1; break; } } }
  });
}

// the riser: a snare roll into the next chapter, written into the beat
// the build: 16 bars, snare, clap and percussion take the roll over from each other (leapfrog), from eighths to sixteenths to thirty-seconds
function riserRoll(c, i, tl) { const out = [], end = c.bars * BAR, start = end - 16 * BAR, LANES = [2, 6, 3], R = rng(H(c.word, 'roll'));
  for (let t = start; t < end;) { const pr = (t - start) / (end - start), lastBar = t >= end - BAR, step = lastBar ? PPQ / 8 : pr < 0.45 ? PPQ / 2 : PPQ / 4;
    const turn = Math.floor((t - start) / (pr < 0.8 ? 2 * BAR : BAR)), lane = LANES[turn % 3], onBeat = t % PPQ === 0;
    const wave = 0.85 + 0.15 * Math.sin((t - start) / BAR * Math.PI); // the roll breathes, it is played, not printed
    let v = (onBeat ? 18 : -6) + (40 + 70 * pr) * wave; if (!onBeat && R() < 0.3) v *= 0.55; // accents on the beat, ghost notes between
    const jit = Math.round((R() - 0.5) * 14);
    if (R() < 0.35 * pr || out.length % 7 === 6) { out.push({ t: Math.max(start, t + jit), d: 50, lane, roll: 1, v: Math.round(clamp(v, 8, 125)) }); }
    else out.push({ t: Math.max(start, t + jit), d: 50, lane, roll: 1, v: Math.round(clamp(v, 8, 125)) });
    if (onBeat && R() < 0.12) out.push({ t: Math.max(start, t + jit - 22), d: 30, lane, roll: 1, v: Math.round(clamp(v * 0.45, 8, 90)) }); // a flam
    if (pr > 0.75 && turn % 2 && !lastBar && R() < 0.5) out.push({ t: t + step / 2 + jit, d: 40, lane: LANES[(turn + 1) % 3], roll: 1, v: Math.round(clamp(v * 0.7, 8, 110)) }); // they answer each other
    t += step; }
  return out; }

// ---------- the whole journey ----------
JR.render = function (plan, ctx) {
  keys(ctx.E, ctx.P, ctx.S); ctx.fixed = !!plan.fixed;
  const tl = JR.timeline(plan), all = [];
  plan.chapters.forEach((c, i) => {
    const content = chapterContent(ctx, plan, i); content.percKey = PERC_KEY[content.percStyle];
    // the rhythm handover with the neighbours, and a crash on the first beat after a cut or a riser
    content.beat = handRhythm(content.beat, plan, i, (n) => n.lane <= 1, (n) => n.lane === 2 || n.lane === 3);
    content.perc = percussionist(content.perc, plan, i, content.percKey, (ctx.E.GENRES[GENRE_KEY[content.studio]] || {}).swing);
    content.perc = handRhythm(content.perc, plan, i, (n) => KICKS.has(n.voice), (n) => /snare|slap|clo/.test(n.voice));
    if (i > 0 && ['cut', 'riser'].includes(plan.chapters[i - 1].out) && content.beat.length) content.beat.push({ t: 0, d: 240, lane: 7, v: 112 });
    if (i < plan.chapters.length - 1 && c.out === 'riser' && content.beat.length) content.beat = content.beat.concat(riserRoll(c, i, tl).map((n) => ({ t: Math.round(n.t * c.feelsLike / plan.bpm), d: n.d, lane: n.lane, v: n.v, roll: 1 })));
    // the motif: at the start of the chapter, at every 16 bars, in a breath and before a motif bridge
    const mo = motifNotes(plan, c, c.feelsLike), motif = []; const put = (bar) => mo.notes.forEach((n) => motif.push(Object.assign({}, n, { t: n.t + Math.round(bar * BAR * c.feelsLike / plan.bpm) })));
    // rarely and hidden: once at the start (the pivot after a handover), once as a long line under the middle, once as a short riff near the summit
    const w0 = win(plan, i), putAs = (bar, shape) => motifNotes(plan, c, c.feelsLike, shape).notes.forEach((n) => motif.push(Object.assign({}, n, { t: n.t + Math.round(bar * BAR * c.feelsLike / plan.bpm) })));
    put(w0.inn ? Math.ceil(w0.inn / 2) : 0);
    const mid = Math.round(c.bars * 0.45 / 8) * 8; if (mid > (w0.inn || 0) + 8 && mid + 12 < c.bars - (c.overlap || 0)) putAs(mid, 'long');
    const pk = Math.round(c.bars * 0.7 / 8) * 8; if (c.energy > 0.5 && pk + 4 < c.bars - (c.overlap || 0)) putAs(pk, 'riff');
    if (c.breathInside) put(c.breathInside.bar); if (i < plan.chapters.length - 1 && (c.out === 'motif' || c.out === 'breath')) put(c.bars - 4);
    content.motif = motif;
    // content time to journey time: the chapter was written at its own feel tempo
    const k = plan.bpm / c.feelsLike, toJ = (ns) => ns.map((n) => Object.assign({}, n, { t: Math.round(n.t * k), d: Math.max(30, Math.round((n.d || 120) * k)) }));
    const rank = {}; let order = c.players.map((p) => p.role);
    if (i === 0 && (plan.opening.id === 'awaken' || plan.opening.id === 'motif')) { const soft = ['orch', 'chords', 'melody', 'bass']; order = order.filter((r) => soft.includes(r)).concat(order.filter((r) => !soft.includes(r))); }
    // the melody is the voice of the chapter: it never waits at the back of the queue
    if (order.indexOf('melody') > 2) { order = order.filter((r) => r !== 'melody'); order.splice(2, 0, 'melody'); }
    if (order.indexOf('beats') > 1) { order = order.filter((r) => r !== 'beats'); order.splice(1, 0, 'beats'); } // dance is the ground
    order.forEach((r, k) => { rank[r] = k; }); c._order = order;
    // every chapter brings its gift: 8 bars of release at its summit (or right after the build, when the way in was a riser), away from the seams
    { const w1 = win(plan, i); let g = null, best = -1; for (let b = Math.max(16, (w1.inn || 0) + 8); b < c.bars - (w1.out || 0) - 8; b += 8) { const e = eAt(c, b / c.bars); if (e > best) { best = e; g = b; } }
      if (i > 0 && plan.chapters[i - 1].out === 'riser' && c.bars > (w1.inn || 0) + 24) g = Math.ceil((w1.inn || 0) / 8) * 8; c._gift = g; }
    const motifPlayer = c.tplMotif || (c.players.find((p) => p.role === 'melody') || c.players.find((p) => p.role === 'chords') || { player: (plan.rack && plan.rack.melody && plan.rack.melody[0]) || JP_PLAIN }).player;
    for (const p of c.players.concat([{ role: 'motif', player: motifPlayer }])) {
      const tracks = speak(ctx, p.role, p.player, content, c);
      for (const t of tracks) { const notes = shape(plan, i, p.role, rank[p.role] || 0, toJ(t.notes), tl);
        if (!notes.length) continue;
        const cc = (t.cc || []).filter((e) => e.t * k < c.bars * BAR).map((e) => ({ t: Math.max(0, Math.round(e.t * k)) + tl[i].start, c: e.c, v: e.v }));
        all.push({ chapter: i, word: c.word, role: p.role, player: p.player, name: (i + 1) + ' ' + c.word + ' . ' + t.name + ' . ' + plan.bpm + ' bpm . ' + JR.colour(c, p.role, p.player), plain: t.name, colour: JR.colour(c, p.role, p.player), notes, cc }); }
    }
  });
  listen(all, plan, tl);
  bridgeSilence(all, plan, tl);
  fillHoles(all, plan, tl);
  toneGuard(all, plan, tl);
  // the ending: abrupt stops everything on one last hit
  if (plan.ending.id === 'abrupt') { const last = tl[tl.length - 1], end = last.start + last.len; all.forEach((t) => { t.notes = t.notes.filter((n) => n.t < end - BAR || n.t === end - BAR); t.notes.forEach((n) => { if (n.t + n.d > end) n.d = end - n.t; }); }); }
  const totalTicks = tl[tl.length - 1].start + tl[tl.length - 1].len;
  return { tracks: all, timeline: tl, totalTicks, markers: plan.chapters.map((c, i) => ({ t: tl[i].start, text: (i + 1) + '. ' + c.word + ' (' + c.lead.name + ')' })) };
};

// ---------- MIDI out ----------
const vlq = (n) => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; };
const str = (s) => [...new TextEncoder().encode(String(s).replace(/[–—]/g, ','))];
JR.writeMidi = function (tracks, meta) {
  const chunk = (evs) => { evs.sort((a, b) => a.t - b.t || a.o - b.o); let last = 0, bytes = []; for (const e of evs) { bytes = bytes.concat(vlq(e.t - last), e.b); last = e.t; } bytes = bytes.concat([0, 0xff, 0x2f, 0]); const l = bytes.length; return [0x4d, 0x54, 0x72, 0x6b, (l >>> 24) & 255, (l >>> 16) & 255, (l >>> 8) & 255, l & 255].concat(bytes); };
  const us = Math.round(60000000 / meta.bpm);
  const cond = [{ t: 0, o: 0, b: [0xff, 0x03].concat(vlq(str(meta.title).length), str(meta.title)) }, { t: 0, o: 0, b: [0xff, 0x02].concat(vlq(str(meta.copyright).length), str(meta.copyright)) },
    { t: 0, o: 0, b: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] }, { t: 0, o: 0, b: [0xff, 0x58, 4, 4, 2, 24, 8] }];
  (meta.markers || []).forEach((m) => { const s = str(m.text); cond.push({ t: m.t, o: 1, b: [0xff, 0x06].concat(vlq(s.length), s) }); });
  const chunks = [chunk(cond)];
  tracks.forEach((tr, ti) => { const ch = 0, ev = [{ t: 0, o: 0, b: [0xff, 0x03].concat(vlq(str(tr.name).length), str(tr.name)) }];
    (tr.cc || []).forEach((e) => ev.push({ t: e.t, o: 1, b: [0xb0 | ch, e.c, clamp(e.v, 0, 127)] }));
    tr.notes.forEach((n) => { const p = clamp(Math.round(n.p), 0, 127); ev.push({ t: n.t, o: n.ks ? 2 : 3, b: [0x90 | ch, p, clamp(n.v, 1, 127)] }); ev.push({ t: n.t + Math.max(1, n.d), o: 0, b: [0x80 | ch, p, 0] }); });
    chunks.push(chunk(ev)); });
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (chunks.length >> 8) & 255, chunks.length & 255, (PPQ >> 8) & 255, PPQ & 255];
  return new Uint8Array(head.concat(...chunks));
};
// ---------- fixed tracks: the same track list every time, so a DAW template keeps working ----------
JR.norm = (name) => name.replace(/^\d+ .*? \. /, '').replace(/ \. \d+ bpm \. .*$/, '').replace(/, Style .*$/, '');
// what sounds best here: a colour for the sound, from the chapter's character and the role
JR.colour = (c, role, player) => {
  const x = c.c, pick = (pairs) => pairs.filter(([ok]) => ok).map(([, w]) => w).slice(0, 2);
  const orchP = player === 'Berlin' || player === 'BBC' || player === 'STRIIIINGS';
  const tone = pick([[x.light < -0.3, 'dark'], [x.light > 0.35, 'bright'], [x.tension > 0.45, 'gritty'], [x.warm > 0.35, 'warm'], [x.warm < -0.35, 'cold'], [x.weight > 0.35, 'heavy'], [x.weight < -0.35, 'airy']]);
  const t = tone.length ? tone.join(' ') + ' ' : (x.light >= 0 ? 'gentle ' : 'deep ');
  const fast = x.speed > 0.3 || c.feel.id === 'double', slow = x.speed < -0.3 || c.feel.id === 'half';
  if (orchP && role !== 'beats' && role !== 'perc') return t + (fast ? 'short, spiccato' : slow ? 'long legato, slow attack' : 'long sustain');
  switch (role) {
    case 'beats': return t + (x.warm > 0.35 ? 'vintage kit' : x.warm < -0.35 ? 'electronic kit' : 'tight kit');
    case 'perc': return t + 'hand percussion, ' + (c.lead.machine === 'percussion' ? c.lead.name : 'light shakers and bells');
    case 'bass': return x.weight > 0.3 ? t + 'deep sub' : x.tension > 0.4 ? t + 'growling saw bass' : x.warm > 0.3 ? t + 'round warm bass' : t + 'clean sub bass';
    case 'chords': return t + (slow ? 'slow pad' : fast ? 'short stab' : 'electric piano');
    case 'melody': return x.tension > 0.45 ? t + 'saw lead with grit' : x.light > 0.4 ? t + 'bell lead' : fast ? t + 'pluck' : t + 'smooth lead';
    case 'motif': return t + 'clear lead that cuts through';
    case 'orch': return t + 'strings, long';
  }
  return t.trim();
};
JR.skeleton = (rack, Y) => {
  const P = (r) => (rack[r] && rack[r][0]) || JP_PLAIN, out = [];
  const UJ = (lab, p) => (PK[p] ? lab + ' for ' + p + ' (Instrument mode)' : p === JP_PLAIN ? lab : lab + ' for ' + p);
  const single = { bass: ['vc', 'Celli'], chords: ['vln2', 'Violins 2'], melody: ['vln1', 'Violins 1'], motif: ['ob', 'Oboe'] };
  const berlinName = (id) => Y.toBerlin([{ id, name: id, notes: [{ t: 0, dur: 10, m: 60, v: 80, art: 'long' }], cc: [], ks: [] }])[0].name;
  const line = (role, p) => { const lab = JR_ROLE[role];
    if (p === 'Berlin' || p === 'BBC') { const [id, nm] = single[role] || single.chords; return lab + ' for ' + p + ', ' + (p === 'Berlin' ? berlinName(id) : nm); }
    return UJ(lab, p); };
  for (const role of ['beats', 'perc', 'bass', 'chords', 'melody', 'motif', 'orch']) {
    const p = role === 'motif' ? P('melody') : P(role), lab = JR_ROLE[role];
    if (role === 'beats' || role === 'perc') {
      if (p === JP_PLAIN) out.push({ role, name: lab + ', standard drum notes' }); else if (p === 'PERRCS') out.push({ role, name: 'PERRCS' });
      else if (p === 'Kick 1' || p === 'Kick 2') out.push({ role, name: p + ' (kick only)' }); else if (['XO', 'Impact', 'EZdrummer', 'Virtual Drummer', 'Beatmaker', 'Tekno'].includes(p)) out.push({ role, name: lab + ' for ' + p });
      else out.push({ role, name: line(role, p) }); continue; }
    if (role === 'orch') {
      if (p === 'STRIIIINGS') { out.push({ role, name: 'Strings A for STRIIIINGS' }, { role, name: 'Strings B for STRIIIINGS' }); continue; }
      if (p === 'Berlin') { Object.keys(Y.BFO).forEach((id) => out.push({ role, name: Y.BFO[id].name + ' for Berlin' })); continue; }
      Y.INST.forEach((x) => out.push({ role, name: x.name + (p === 'BBC' ? ' for BBC' : '') })); continue; }
    out.push({ role, name: line(role, p) });
  }
  return out;
};
JR.fix = (tracks, rack, Y) => {
  const sk = JR.skeleton(rack, Y).map((x) => ({ role: x.role, name: x.name, notes: [], cc: [] })), by = {};
  sk.forEach((x) => { by[x.name] = x; });
  for (const t of tracks) { const k = JR.norm(t.name); let d = by[k]; if (!d) { d = by[k] = { role: t.role, name: k, notes: [], cc: [] }; sk.push(d); } d.notes = d.notes.concat(t.notes); d.cc = d.cc.concat(t.cc || []); }
  return sk;
};
// ---------- your template: read the tracks of the MIDI you built your DAW from, and land a new journey on exactly those tracks ----------
const LABEL = { Beat: 'beats', Percussion: 'perc', Bass: 'bass', Chords: 'chords', Melody: 'melody', Motif: 'motif' };
JR.parseTemplate = (names, Y) => {
  const inst = new Set(Y.INST.map((x) => x.name).concat(Object.values(Y.BFO).map((x) => x.name)));
  const tracks = names.map((name, k) => { const full = name.replace(/ \. \d+ bpm( \. .*)?$/, '');
    const m = full.match(/^(\d+) (.+?) \. (.*)$/), ch = m ? +m[1] - 1 : -1, rest = (m ? m[3] : full).replace(/, Style .*$/, '');
    let role = null, player = JP_PLAIN, ins = '';
    let q = rest.match(/^(Beat|Percussion|Bass|Chords|Melody|Motif)(?:, standard drum notes)?(?: for (.+?))?(?: \(Instrument mode\))?(?:, (.+))?$/);
    if (q) { role = LABEL[q[1]]; if (q[2]) player = q[2].replace(/ \(kick only\)$/, ''); if (q[3]) ins = q[3]; }
    else if (/^PERRCS/.test(rest)) { role = 'perc'; player = 'PERRCS'; }
    else if ((q = rest.match(/^Strings ([AB]) for STRIIIINGS/))) { role = 'orch'; player = 'STRIIIINGS'; ins = 'Strings ' + q[1]; }
    else if ((q = rest.match(/^(.+) for (Berlin|BBC)$/)) && inst.has(q[1])) { role = 'orch'; player = q[2]; ins = q[1]; }
    else if (inst.has(rest)) { role = 'orch'; ins = rest; }
    return { k, name, ch, role, player, inst: ins, key: rest }; }).filter((t) => t.role);
  return { tracks, perChapter: tracks.some((t) => t.ch >= 0), count: names.length };
};
const REG = [[/piccolo/i, 86], [/flute/i, 80], [/oboe/i, 74], [/bass clarinet/i, 54], [/clarinet/i, 68], [/contrabassoon/i, 36], [/bassoon/i, 50], [/horn/i, 59],
  [/trumpet/i, 68], [/trombone/i, 55], [/tuba/i, 41], [/timpani/i, 47], [/(1st)|violins 1/i, 80], [/(2nd)|violins 2/i, 73], [/viola/i, 65], [/cell/i, 53], [/bass/i, 41], [/harp/i, 63], [/strings a/i, 72], [/strings b/i, 55]];
const centre = (name) => { for (const [re, c] of REG) if (re.test(name)) return c; return 64; };
JR.fitTemplate = (tracks, tpl, plan) => {
  const out = tpl.tracks.map((t) => ({ t, notes: [], cc: [], name: null })), used = new Set();
  const slot = (tr) => out.filter((o) => (tpl.perChapter ? o.t.ch === tr.chapter : true));
  for (const tr of tracks) { const key = JR.norm(tr.name), here = slot(tr);
    let hit = here.find((o) => o.t.key === key) || null;
    if (!hit && tr.role !== 'orch') hit = here.find((o) => o.t.role === tr.role && o.t.player === tr.player) || here.find((o) => o.t.role === tr.role) || null;
    if (!hit && tpl.perChapter) { const near = out.filter((o) => o.t.role === tr.role && o.t.player === tr.player).sort((x, y) => Math.abs(x.t.ch - tr.chapter) - Math.abs(y.t.ch - tr.chapter)); if (tr.role !== 'orch' && near.length) hit = near[0]; }
    if (hit) { hit.notes = hit.notes.concat(tr.notes); if (!used.has(hit)) { hit.cc = hit.cc.concat(tr.cc || []); used.add(hit); } if (!hit.name) hit.name = tr.name; continue; }
    // an orchestra part without its own track: every note goes to the template instrument whose register fits it best
    const orch = here.filter((o) => o.t.role === 'orch' && (o.t.player === tr.player || true)); if (!orch.length) continue;
    tr.notes.forEach((n) => { if (n.ks) return; const o = orch.reduce((a, b) => (Math.abs(centre(b.t.inst) - n.p) < Math.abs(centre(a.t.inst) - n.p) ? b : a)); o.notes.push(n); }); }
  // every track keeps the name of its place in your template; an empty track gets one silent note after the end,
  // because a DAW drops empty tracks on import and everything below would shift up one place
  const end = Math.max(0, ...tracks.flatMap((t) => t.notes.map((n) => n.t + n.d))) + BAR;
  return out.map((o) => { const c = o.t.ch >= 0 ? plan.chapters[o.t.ch] : null;
    const name = (c ? (o.t.ch + 1) + ' ' + c.word + ' . ' : '') + o.t.key + ' . ' + plan.bpm + ' bpm';
    const notes = o.notes.sort((a, b) => a.t - b.t); if (!notes.length) notes.push({ t: end, d: 30, p: 0, v: 1 });
    return { name, role: o.t.role, notes, cc: o.cc }; });
};
JR.PPQ = PPQ; JR.BAR = BAR;
})();
if (typeof module !== 'undefined') module.exports = JR;
