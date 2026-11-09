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
      if (end > at) secs.push({ id: 'm' + k, type: ENGINE_TYPE[q.type] || 'verse', bars: end - at }); at = end; });
    song.sections = secs; return song; }
  const secs = []; for (let b = 0, k = 0; b < contentBars; b += 8, k++) { const u = b / Math.max(1, contentBars), e = eAt(c, u);
    const type = e < 0.35 ? ['intro', 'verse'][k % 2] : e < 0.68 ? ['verse', 'prechorus', 'chorus', 'chorus'][k % 4] : ['drop', 'drop', 'build', 'drop'][k % 4];
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
  for (let b = 0; b < bars; b++) { const pcs = byBar[b] ? [...byBar[b]] : prev; if (!pcs || !pcs.length) continue;
    const same = prev && pcs.length === prev.length && pcs.every((x) => prev.includes(x)); prev = pcs;
    const t = b * BAR, v = 64 + Math.round(30 * eAt(c, b / Math.max(1, bars)));
    const put = (tr, lo, hi, k) => { const pc = pcs[k % pcs.length]; let p = lo + ((pc - lo) % 12 + 12) % 12; if (p > hi) p -= 12;
      const last = tr.notes[tr.notes.length - 1]; if (same && last && last.m === p && last.t + last.dur >= t - 10) { last.dur += BAR; return; } tr.notes.push({ t, dur: BAR - 20, m: p, v, art: 'long' }); };
    put(T.vln1, 72, 88, 2); put(T.vln2, 67, 79, 1); put(T.vla, 60, 72, 0); put(T.hn, 55, 67, 1);
    const bp = bassBar[b] != null ? bassBar[b] % 12 : pcs[0]; put(T.vc, 43, 55, 0); T.vc.notes[T.vc.notes.length - 1].m = fold(bp + 48, 43, 55); put(T.cb, 31, 43, 0); T.cb.notes[T.cb.notes.length - 1].m = fold(bp + 36, 31, 43);
    T.vln1.cc.push({ t, c: 1, v: clamp(v + 10, 30, 127) }); T.vln2.cc.push({ t, c: 1, v: clamp(v, 30, 127) }); T.vla.cc.push({ t, c: 1, v: clamp(v, 30, 127) }); T.vc.cc.push({ t, c: 1, v: clamp(v, 30, 127) }); T.cb.cc.push({ t, c: 1, v: clamp(v - 5, 30, 127) }); T.hn.cc.push({ t, c: 1, v: clamp(v - 10, 30, 127) });
  }
  // the melody on top in the violins when it sings
  if (mel.length) { T.vln1.notes = T.vln1.notes.filter(() => false); mel.forEach((n) => T.vln1.notes.push({ t: n.t, dur: Math.max(60, n.d), m: fold(n.p, 62, 93), v: n.v, art: 'long' })); }
  return Object.values(T);
}

// ---------- the motif in its costume ----------
function motifNotes(plan, c, F) {
  const m = plan.motif, cos = c.costume, sc = cos.includes('quicker') ? 0.5 : cos.includes('slower') ? 2 : 1, half = cos.includes('half, a memory');
  const base = cos.includes('low') ? 48 : cos.includes('high') ? 72 : 60, inv = cos.includes('upside down'), grand = cos.includes('grand');
  const out = []; let t = 0;
  m.degrees.forEach((d, k) => { if (half && k >= Math.ceil(m.degrees.length / 2)) return; const dur = m.rhythm[k] * sc * PPQ;
    const p = deg(c.tonic, c.minor, inv ? -d : d, base); const v = grand ? 112 : cos.includes('bare') ? 84 : 96;
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
    const get = (ids) => res.tracks.filter((t) => ids.includes(t.id)).flatMap((t) => t.notes.map((n) => ({ t: n.t, d: n.dur, p: n.m, v: n.v })));
    bass = get(['cb']).length ? get(['cb']) : get(['vc']); chords = get(['vla', 'vln2']); melody = get(['svn', 'fl', 'ob']).length > get(['vln1']).length * 0.6 ? get(['svn', 'fl', 'ob']) : get(['vln1']);
    harmonic = get(['vln2', 'vla', 'vc', 'cb', 'hn']); orch = res.tracks;
  } else {
    bass = E.renderSong(song, 'bass'); chords = E.renderSong(song, 'chords'); const pad = E.renderSong(song, 'pad');
    if (chords.length < pad.length) chords = chords.concat(pad);
    melody = E.renderSong(song, 'melody').concat(E.renderSong(song, 'answer'));
    harmonic = chords.concat(pad, bass);
  }
  // the beat: always from the Studio engine (a rhythm never clashes with a harmony)
  out.beat = roles.has('beats') ? E.renderSong(song, 'beat') : [];
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
    const pr = P.generate({ style: PERC_KEY[percArt.name] || 'minimal', bpm: F, seed, wild: clamp(0.25 + c.energy * 0.6, 0, 1), swing: c.c.warm > 0.3 ? 0.4 : 0, sections: secs });
    out.perc = pr.events.map((e) => ({ t: Math.round(e.t * F / 60 * PPQ), d: 120, voice: e.v, v: e.vel }));
  } else out.perc = [];
  // Score: follows the harmony, adds its tension (for STRIIIINGS and PERRCS)
  const wantsScore = c.players.some((p) => p.player === 'STRIIIINGS' || p.player === 'PERRCS');
  if (wantsScore) { const scoreArt = c.lead.machine === 'score' ? c.lead : c.guests.find((g) => g.machine === 'score') || nearest(JP, 'score', c.c);
    let sc = S.newScore(SCORE_KEY[scoreArt.name] || 'suspense', { seed }); sc.bpm = F;
    sc = S.fromTrack(sc, { notes: harmonic.filter((n) => n.t < needContent), meter: 4, bpm: F }); sc.parts.percs.on = true; sc.parts.strings.on = true;
    const r = S.render(sc), cats = S.catsFor(sc); out.score = { r, cats, style: scoreArt.name }; }
  out.bass = bass; out.chords = chords; out.melody = melody;
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
  L = Math.min(L, np);
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
    if (w.out && n.t >= W0) { if (w.feelOut) return false; if ((isKick(n) || isBack(n)) && n.t >= Wh) return false; }
    if (w.inn && n.t < I1) { if (w.feelIn) return false; if ((isKick(n) || isBack(n)) && n.t < Ih) return false; }
    return true; });
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
      if (!plays(plan, i, rank, Math.floor(x.t * k / BAR), cbars)) continue;
      // a breath inside the chapter: two bars where only the motif sounds
      if (c.breathInside && bar >= c.breathInside.bar && bar < c.breathInside.bar + 2) continue;
      // the way out
      if (i < n - 1) {
        if (c.out === 'breath' && bar >= c.bars - 1 && !HARM.has(role)) continue; // the breath: one bar where the rhythm, bass and melody let go
        if (c.out === 'motif' && bar >= c.bars - 4 && rank > 0) continue;
        if (w.out && bar >= c.bars - w.out) { const p = (fb - (c.bars - w.out)) / w.out;
          if (role === 'melody' || role === 'bass') continue;                         // the old melody and bass leave as the window opens
          if (HARM.has(role) && w.keyOut && p >= 0.5) continue;                       // two keys never sound together
          fade = c.out === 'filter' ? 1 - 0.75 * p : 1 - 0.5 * p; }
        if (c.out === 'riser' && bar >= c.bars - 4) fade *= 0.8 + 0.3 * ((fb - (c.bars - 4)) / 4); // the riser lifts everything
      }
      // the way in
      if (w.inn && bar < w.inn) { const p = fb / w.inn;
        if (role === 'bass') continue;
        if (HARM.has(role) && w.keyIn && p < 0.5) continue;
        fade = Math.min(fade, w.pv.out === 'filter' ? 0.25 + 0.75 * p : 0.5 + 0.5 * p); }
      if (role === 'melody' && w.pv) { if (bar < w.melodyIn) continue; fade = Math.min(fade, 0.55 + 0.45 * clamp((fb - w.melodyIn) / 8, 0, 1)); }
    }
    let v = x.v;
    if (!x.ks) { v = v * (0.72 + 0.4 * eAt(c, u)) * fade;
      if (i === n - 1 && plan.ending.id === 'fade') v *= 1 - 0.7 * clamp((u - 0.75) / 0.25, 0, 1); }
    // nothing rings over the line it may not cross: the old melody and bass stop as the window opens, the old harmony at its middle when the key changes
    let lim = len;
    if (w.out && i < n - 1) { const W0 = (c.bars - w.out) * BAR, Wh = (c.bars - w.out / 2) * BAR;
      if ((role === 'melody' || role === 'bass') && x.t < W0) lim = W0; else if ((HARM.has(role) || role === 'melody' || role === 'motif') && w.keyOut && x.t < Wh) lim = Wh; }
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

// the riser: a snare roll into the next chapter, written into the beat
function riserRoll(c, i, tl) { const out = [], end = c.bars * BAR, start = end - 4 * BAR; for (let t = start, k = 0; t < end; k++) { const step = k < 16 ? PPQ / 2 : k < 32 ? PPQ / 4 : PPQ / 8; out.push({ t, d: 60, lane: 2, roll: 1, v: 50 + Math.round(70 * (t - start) / (end - start)) }); t += step; } return out; }

// ---------- the whole journey ----------
JR.render = function (plan, ctx) {
  keys(ctx.E, ctx.P, ctx.S); ctx.fixed = !!plan.fixed;
  const tl = JR.timeline(plan), all = [];
  plan.chapters.forEach((c, i) => {
    const content = chapterContent(ctx, plan, i); content.percKey = PERC_KEY[content.percStyle];
    // the rhythm handover with the neighbours, and a crash on the first beat after a cut or a riser
    content.beat = handRhythm(content.beat, plan, i, (n) => n.lane <= 1, (n) => n.lane === 2 || n.lane === 3);
    content.perc = handRhythm(content.perc, plan, i, (n) => KICKS.has(n.voice), (n) => /snare|slap|clo/.test(n.voice));
    if (i > 0 && ['cut', 'riser'].includes(plan.chapters[i - 1].out) && content.beat.length) content.beat.push({ t: 0, d: 240, lane: 7, v: 112 });
    if (i < plan.chapters.length - 1 && c.out === 'riser' && content.beat.length) content.beat = content.beat.concat(riserRoll(c, i, tl).map((n) => ({ t: Math.round(n.t * c.feelsLike / plan.bpm), d: n.d, lane: n.lane, v: n.v, roll: 1 })));
    // the motif: at the start of the chapter, at every 16 bars, in a breath and before a motif bridge
    const mo = motifNotes(plan, c, c.feelsLike), motif = []; const put = (bar) => mo.notes.forEach((n) => motif.push(Object.assign({}, n, { t: n.t + Math.round(bar * BAR * c.feelsLike / plan.bpm) })));
    const w0 = win(plan, i); for (let b = 0; b < c.bars - 4; b += 16) put(b === 0 && w0.inn ? Math.ceil(w0.inn / 2) : b); // after a handover the motif is the pivot into the new key
    if (c.breathInside) put(c.breathInside.bar); if (i < plan.chapters.length - 1 && (c.out === 'motif' || c.out === 'breath')) put(c.bars - 4);
    content.motif = motif;
    // content time to journey time: the chapter was written at its own feel tempo
    const k = plan.bpm / c.feelsLike, toJ = (ns) => ns.map((n) => Object.assign({}, n, { t: Math.round(n.t * k), d: Math.max(30, Math.round((n.d || 120) * k)) }));
    const rank = {}; let order = c.players.map((p) => p.role);
    if (i === 0 && (plan.opening.id === 'awaken' || plan.opening.id === 'motif')) { const soft = ['orch', 'chords', 'melody', 'bass']; order = order.filter((r) => soft.includes(r)).concat(order.filter((r) => !soft.includes(r))); }
    // the melody is the voice of the chapter: it never waits at the back of the queue
    if (order.indexOf('melody') > 2) { order = order.filter((r) => r !== 'melody'); order.splice(2, 0, 'melody'); }
    order.forEach((r, k) => { rank[r] = k; });
    const motifPlayer = (c.players.find((p) => p.role === 'melody') || c.players.find((p) => p.role === 'chords') || { player: (plan.rack && plan.rack.melody && plan.rack.melody[0]) || JP_PLAIN }).player;
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
JR.PPQ = PPQ; JR.BAR = BAR;
})();
if (typeof module !== 'undefined') module.exports = JR;
