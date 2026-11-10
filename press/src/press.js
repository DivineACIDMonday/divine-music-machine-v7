/* Divine Record Press engine. (c) 2026 Divine Monday.
   One record from one to three styles, pressed with the Journey engine as a song of its own (side A),
   a full remix on side B that keeps the motif and the key, and a record picture drawn from the notes. */
(function (root) {
  const PR = {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- hints for side B: pairs switch each other off ----------
  PR.HINTS = [
    { id: 'darker', name: 'Darker', not: 'lighter' }, { id: 'lighter', name: 'Lighter', not: 'darker' },
    { id: 'faster', name: 'Faster', not: 'slower' }, { id: 'slower', name: 'Slower', not: 'faster' },
    { id: 'barer', name: 'Barer', not: 'fuller' }, { id: 'fuller', name: 'Fuller', not: 'barer' },
    { id: 'orch', name: 'More orchestra' }, { id: 'extended', name: 'Extended' },
  ];

  const word = (w) => ({ wheel: 'W1', word: w });
  // side A: the record as a song of its own, with its own build, drop, break and gift
  PR.planA = (JP, JW, o) => {
    const au = o.audio; // pressing your own track: its tempo, its key and its length, its motif when the press could hear one
    const opt = { solo: true, mode: 'mixed', records: [{ arts: o.arts }], minutes: au ? Math.max(3, Math.min(9, Math.round(au.sec / 30) / 2)) : o.minutes, bpm: au ? au.bpm : o.bpm || 0, seed: o.seed >>> 0, rack: o.rack, allWords: JW, template: o.template || null, tplChapter: 0 };
    if (au) o = Object.assign({}, o, { key: JP.KEYS[au.tonic] + (au.minor ? ' minor' : ' major'), minutes: opt.minutes });
    let p = JP.plan([word(o.word)], opt);
    // the key: yours, or one the record itself chooses (the word and the styles), in the mode its character asks for
    const key = o.key && o.key !== 'auto' ? o.key : JP.KEYS[JP.hash(o.word + '|' + o.arts.join('|')) % 12] + (p.chapters[0].minor ? ' minor' : ' major');
    if (key !== p.chapters[0].key) p = JP.plan([word(o.word)], Object.assign(opt, { ov: [{ key }] }));
    if (au && au.motif) p.motif = au.motif;
    p.side = 'A'; p.title = o.name; p.minutesUsed = opt.minutes; if (au) { p.remix = o.arts.join(' ') + ' Version'; p.title = o.name + ' (' + p.remix + ')'; } return p;
  };

  // the remix: the harmony of the record stays, a new style brings a new pulse
  PR.remixStyle = (JP, planA, o) => {
    if (o.style) return JP.ARTS.find((a) => a.name === o.style) || null;
    const rc = planA.chapters[0].records[0], own = rc.arts.map((a) => a.name), h = o.hints || {}, r = JP.rng((o.seed ^ 0x2545f491) >>> 0);
    const v = {}; JP.DIMS.forEach((d) => { v[d] = rc.arts.reduce((t, a) => t + a.v[d], 0) / rc.arts.length; });
    const push = h.slower ? -0.6 : h.faster ? 0.7 : (v.speed > 0.3 ? -0.5 : 0.6), aim = Object.assign({}, v, { speed: clamp(v.speed + push, -1, 1), light: clamp(v.light + (h.darker ? -0.5 : h.lighter ? 0.5 : 0), -1, 1) });
    const cand = JP.ARTS.filter((a) => a.machine === 'studio' && !own.includes(a.name) && a.name !== 'Divine Monday' && a.name !== 'Club').sort((a, b) => JP.dist(aim, a.v) - JP.dist(aim, b.v)).slice(0, 4);
    return cand[Math.floor(r() * cand.length)];
  };
  PR.remixArts = (JP, planA, st, h) => {
    const rc = planA.chapters[0].records[0], keep = [];
    if (rc.lead.machine === 'studio') keep.push(rc.lead.name);
    if (!h.barer) rc.guests.forEach((g) => { if (g.machine !== 'studio') keep.push(g.name); });
    if (rc.lead.machine !== 'studio') keep.push(rc.lead.name);
    let arts = [...new Set([].concat(st ? [st.name] : [], keep))];
    if (h.orch && !arts.some((n) => { const a = JP.ARTS.find((x) => x.name === n); return a && a.machine === 'symphony'; })) arts.push(JP.ORCH);
    if (h.barer) arts = arts.filter((n) => { const a = JP.ARTS.find((x) => x.name === n); return !a || a.machine !== 'score'; });
    return arts.slice(0, 4);
  };
  PR.remixName = (st, h) => (h.extended ? 'Extended ' : '') + (h.darker ? 'Dark ' : h.lighter ? 'Bright ' : '')
    + (h.barer ? (st ? st.name + ' Dub' : 'Dub') : (st ? st.name : 'Club') + (h.orch ? ' Orchestral' : '') + ' Remix');

  // side B: a full remix with the same motif and the same key (or its dark or bright twin), its own form and its own tempo when you ask
  PR.planB = (JP, JW, o, planA) => {
    const h = o.hints || {}, st = PR.remixStyle(JP, planA, o), arts = PR.remixArts(JP, planA, st, h);
    let bpm = planA.bpm; if (h.faster) bpm = Math.min(134, bpm + 8); if (h.slower) bpm = Math.max(90, bpm - 10);
    const cA = planA.chapters[0]; let [kn, km] = cA.key.split(' '); if (h.darker) km = 'minor'; if (h.lighter) km = 'major';
    const p = JP.plan([word(o.word)], { solo: true, mode: 'mixed', records: [{ arts }], minutes: (planA.minutesUsed || o.minutes) + (h.extended ? 2 : 0), bpm, seed: (o.seed ^ 0x5bd1e995) >>> 0,
      rack: o.rack, allWords: JW, template: o.template || null, tplChapter: 0, ov: [{ key: kn + ' ' + km }] });
    p.motif = planA.motif; const c = p.chapters[0];
    if (h.barer) { c.layers = Math.max(2, c.layers - 2); c.layersStart = Math.max(1, c.layersStart - 1); c.players = c.players.filter((x) => x.role !== 'melody'); } // a dub: the motif sings, the melody rests
    if (h.fuller) { c.layers = Math.min(6, c.layers + 1); c.layersStart = Math.min(6, c.layersStart + 1); }
    p.side = 'B'; p.remix = PR.remixName(st, h); p.title = o.name + ' (' + p.remix + ')'; p.remixStyle = st ? st.name : null;
    return p;
  };

  // ---------- what the notes do, phrase by phrase (for the groove map and the picture) ----------
  const ROLES = ['beats', 'perc', 'bass', 'chords', 'orch', 'melody', 'motif'];
  PR.ROLES = ROLES;
  PR.read = (res, BAR) => {
    const P = Math.max(1, Math.ceil(res.totalTicks / (8 * BAR))), rows = Array.from({ length: P }, () => Object.fromEntries(ROLES.map((r) => [r, 0])));
    const notes = { beats: [], perc: [], bass: [], chords: [], orch: [], melody: [], motif: [] };
    res.tracks.forEach((t) => { const role = notes[t.role] ? t.role : null; if (!role) return;
      t.notes.forEach((n) => { if (n.ks || n.v <= 1 || n.t >= res.totalTicks) return; rows[Math.floor(n.t / (8 * BAR))][role]++; notes[role].push(n); }); });
    for (const k of Object.keys(notes)) notes[k].sort((a, b) => a.t - b.t);
    return { P, rows, notes, total: res.totalTicks, BAR };
  };

  // ---------- the record picture: drawn from the notes of the record itself ----------
  const hex = (c) => { const m = c.replace('#', ''); const n = parseInt(m.length === 3 ? m.split('').map((x) => x + x).join('') : m, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  const lum = (c) => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const mix = (c, d, u) => { const a = hex(c), b = hex(d); return '#' + a.map((x, i) => Math.round(x + (b[i] - x) * u).toString(16).padStart(2, '0')).join(''); };
  PR.PALETTES = [
    { name: 'Gold night', bg: '#10131D', ink: '#EDE6D8', acc: '#E7B65C' },
    { name: 'Cream and red', bg: '#EFE6D4', ink: '#1B1A1E', acc: '#C2452D' },
    { name: 'Deep teal', bg: '#0D2826', ink: '#E7F0EA', acc: '#4FB3A9' },
    { name: 'Plum and rose', bg: '#24102A', ink: '#F4E6F1', acc: '#D9668A' },
    { name: 'Midnight blue', bg: '#0E1C36', ink: '#E6EEF8', acc: '#6FA8DC' },
    { name: 'Paper', bg: '#E9E5DD', ink: '#17171A', acc: '#2B2B30' },
  ];
  // fit text into a width by shrinking the font
  const fit = (g, text, font, size, maxW) => { let s = size; g.font = font.replace('#', s); while (g.measureText(text).width > maxW && s > 10) { s -= 2; g.font = font.replace('#', s); } return s; };

  // the letters for the name on the sleeve and the label
  PR.FONTS = [
    { id: 'classic', name: 'Classic', css: 'italic 600 #px "Playfair Display", "Bodoni 72", Didot, Georgia, serif' },
    { id: 'poster', name: 'Poster', css: '400 #px "Bebas Neue", Impact, "Arial Narrow", sans-serif', up: true, k: 1.25 },
    { id: 'display', name: 'Display', css: '400 #px "Abril Fatface", "Bodoni 72", Georgia, serif' },
    { id: 'clean', name: 'Clean', css: '700 #px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif' },
    { id: 'type', name: 'Typewriter', css: '700 #px "Space Mono", ui-monospace, Menlo, Consolas, monospace', k: 0.9 },
    { id: 'hand', name: 'Hand', css: '700 #px "Caveat", "Segoe Script", "Bradley Hand", cursive', k: 1.3 },
  ];
  PR.drawCover = (cv, rd, info, pal, fontId) => {
    const g = cv.getContext('2d'), Wd = cv.width, Ht = cv.height, u = Wd / 1200, { bg, ink, acc } = pal, BAR = rd.BAR;
    let per = 8; while (per > 1 && rd.total / (per * BAR) < 10) per /= 2; const ph = per * BAR; // a short track gets shorter rings, so there are always enough grooves
    const F = PR.FONTS.find((f) => f.id === fontId) || PR.FONTS[0], serif = F.css, big = (n) => Math.round(n * (F.k || 1)), title = F.up ? info.name.toUpperCase() : info.name;
    const sans = '#px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    g.save(); g.scale(u, u);
    // the sleeve
    g.fillStyle = bg; g.fillRect(0, 0, 1200, 1200);
    const glow = g.createRadialGradient(600, 690, 60, 600, 690, 720); glow.addColorStop(0, rgba(acc, 0.16)); glow.addColorStop(1, rgba(acc, 0)); g.fillStyle = glow; g.fillRect(0, 0, 1200, 1200);
    g.fillStyle = ink; g.textBaseline = 'alphabetic';
    fit(g, title, serif, big(76), 1000); g.fillText(title, 60, 118);
    g.font = sans.replace('#', 23); g.fillStyle = rgba(ink, 0.7); g.fillText(info.styles + '   ' + info.bpm + ' bpm   ' + info.key + (info.remix ? '   ' + info.remix : ''), 62, 162);
    g.textAlign = 'right'; g.font = '600 ' + sans.replace('#', 64); g.fillStyle = rgba(acc, 0.9); if (info.side !== 'O') g.fillText(info.side, 1140, 118);
    g.font = sans.replace('#', 19); g.fillStyle = rgba(ink, 0.55); g.fillText('Divine Monday Record Press', 1140, 1166); g.textAlign = 'left';
    // the disc: grooves from the outside in, one ring per phrase of eight bars, like a needle reads it
    const cx = 600, cy = 690, R = 455, inner = R * 0.36, P = Math.max(1, Math.ceil(rd.total / ph)), rw = (R * 0.975 - inner * 1.06) / P;
    const disc = lum(bg) > 0.5 ? '#141418' : mix(bg, '#000000', 0.55);
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = disc; g.fill();
    const sheen = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R); sheen.addColorStop(0, 'rgba(255,255,255,0.06)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = sheen; g.fill();
    const ringR = (q) => R * 0.975 - (q + 0.5) * rw, ang = (t) => -Math.PI / 2 + ((t % ph) / ph) * Math.PI * 2, ringOf = (t) => Math.min(P - 1, Math.floor(t / ph));
    const dens = new Array(P).fill(0); ROLES.forEach((k) => rd.notes[k].forEach((n) => { const q = Math.floor(n.t / ph); if (q >= 0 && q < P) dens[q]++; })); const dmax = Math.max(1, ...dens);
    const lite = lum(disc) > 0.5 ? '#000000' : '#FFFFFF';
    for (let q = 0; q < P; q++) { const d = dens[q] / dmax; g.lineWidth = Math.max(0.6, rw * 0.18);
      for (let s = 0; s < 3; s++) { g.beginPath(); g.arc(cx, cy, ringR(q) - rw * 0.33 + s * rw * 0.33, 0, Math.PI * 2); g.strokeStyle = rgba(lite, 0.035 + 0.11 * d); g.stroke(); } }
    // the harmony: soft arcs where the chords and the orchestra sound
    const harm = rd.notes.chords.concat(rd.notes.orch);
    g.lineCap = 'butt';
    harm.forEach((n) => { const q = ringOf(n.t), a0 = ang(n.t), len = Math.min(n.d, ph - (n.t % ph)) / ph * Math.PI * 2; if (len <= 0) return;
      g.beginPath(); g.arc(cx, cy, ringR(q), a0, a0 + len); g.lineWidth = rw * 0.78; g.strokeStyle = rgba(acc, 0.018 + 0.05 * (n.v / 127)); g.stroke(); });
    // the bass: a low line on the inner edge of each ring
    rd.notes.bass.forEach((n) => { const q = ringOf(n.t), a0 = ang(n.t), len = Math.min(n.d, ph - (n.t % ph)) / ph * Math.PI * 2; if (len <= 0) return;
      g.beginPath(); g.arc(cx, cy, ringR(q) + rw * 0.36, a0, a0 + len); g.lineWidth = Math.max(1, rw * 0.14); g.strokeStyle = rgba(ink, 0.32); g.stroke(); });
    // the beat: kicks as accent dots, snares and claps as light dots, the rest as dust
    rd.notes.beats.concat(rd.notes.perc).forEach((n) => { const q = ringOf(n.t), a = ang(n.t), kick = n.p === 35 || n.p === 36 || n.p <= 36, sn = n.p >= 37 && n.p <= 40;
      const rr = ringR(q) - (kick ? 0 : sn ? rw * 0.22 : rw * 0.36), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      g.beginPath(); g.arc(x, y, kick ? Math.max(1.6, rw * 0.17) : sn ? Math.max(1.2, rw * 0.12) : Math.max(0.7, rw * 0.06), 0, Math.PI * 2);
      g.fillStyle = kick ? rgba(acc, 0.85) : sn ? rgba(ink, 0.6) : rgba(ink, 0.22); g.fill(); });
    // the melody and the motif: one flowing line that rides the grooves, its height is the pitch
    const all = rd.notes.melody.concat(rd.notes.motif);
    if (all.length) { const ps = all.map((n) => n.p), lo = Math.min(...ps), hi = Math.max(lo + 6, ...ps);
      const pt = (t, p) => { const q = ringOf(t), rr = ringR(q) + (0.5 - (p - lo) / (hi - lo)) * rw * 1.5, a = ang(t); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; };
      g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = Math.max(1.4, rw * 0.16); g.strokeStyle = rgba(ink, 0.82);
      [rd.notes.melody, rd.notes.motif].forEach((mel) => { let prev = null; g.beginPath(); // one voice, one line: the top note when notes sound together
      mel.forEach((n) => { if (prev && n.t < prev.t + prev.d - 10 && n.p <= prev.p) return; const gap = prev ? n.t - (prev.t + prev.d) : 0; const [x, y] = pt(n.t, n.p);
        if (!prev || gap > BAR || gap < -10 || ringOf(n.t) !== ringOf(prev.t)) { g.stroke(); g.beginPath(); g.moveTo(x, y); } else g.lineTo(x, y);
        const e = Math.min(n.t + n.d, (ringOf(n.t) + 1) * ph - 1); // a held note follows its groove
        for (let tt = n.t + BAR / 16; tt < e; tt += BAR / 16) { const [xa, ya] = pt(tt, n.p); g.lineTo(xa, ya); }
        const [x2, y2] = pt(e, n.p); g.lineTo(x2, y2); prev = n; });
      g.stroke(); });
      rd.notes.motif.forEach((n) => { const [x, y] = pt(n.t, n.p); g.beginPath(); g.arc(x, y, Math.max(1.8, rw * 0.15), 0, Math.PI * 2); g.fillStyle = rgba(acc, 0.95); g.fill(); }); }
    // the label
    g.beginPath(); g.arc(cx, cy, inner, 0, Math.PI * 2); g.fillStyle = acc; g.fill();
    g.beginPath(); g.arc(cx, cy, inner * 0.93, 0, Math.PI * 2); g.lineWidth = 1.5; g.strokeStyle = rgba(lum(acc) > 0.55 ? '#000000' : '#FFFFFF', 0.25); g.stroke();
    const lab = lum(acc) > 0.55 ? '#16161A' : '#FBF7EE'; g.fillStyle = lab; g.textAlign = 'center';
    fit(g, title, serif, big(40), inner * 1.5); g.fillText(title, cx, cy - 34);
    g.font = sans.replace('#', 16); g.fillStyle = rgba(lab, 0.8); const sty = info.styles.length > 34 ? info.styles.slice(0, 33) + '.' : info.styles; g.fillText(sty, cx, cy + 50);
    g.font = '600 ' + sans.replace('#', 15); g.fillText((info.side === 'O' ? 'ORIGINAL' : 'SIDE ' + info.side) + '   ' + info.bpm + ' BPM   ' + info.key.toUpperCase(), cx, cy + 76);
    if (info.remix) { g.font = sans.replace('#', 15); fit(g, info.remix, sans, 15, inner * 1.5); g.fillText(info.remix, cx, cy + 100); }
    g.font = sans.replace('#', 12); g.fillStyle = rgba(lab, 0.6); g.fillText('DIVINE MONDAY', cx, cy - inner * 0.62);
    g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fillStyle = bg; g.fill();
    g.restore(); g.textAlign = 'left';
  };

  // ---------- your own track: the press listens, mechanically, and writes down what it hears ----------
  // the tempo from the pulse of the onsets, the key from the twelve pitch colours, the beat from the low and the bright hits,
  // the loud parts from the energy, a melody line from the strongest middle tone. Nothing leaves your computer.
  function fft(re, im) { const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } }
  const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const corr = (a, b) => { const ma = a.reduce((x, y) => x + y, 0) / 12, mb = b.reduce((x, y) => x + y, 0) / 12; let n = 0, da = 0, db = 0; for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db || 1); };
  PR.analyse = (chans, sr) => {
    const f = Math.max(1, Math.round(sr / 11025)), sr2 = sr / f, len = Math.floor(chans[0].length / f), x = new Float32Array(len);
    for (let i = 0; i < len; i++) { let v = 0; for (const c of chans) for (let k = 0; k < f; k++) v += c[i * f + k] || 0; x[i] = v / (f * chans.length); }
    const N = 2048, hop = 512, F = Math.max(1, Math.floor((len - N) / hop)), fr = sr2 / hop, win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
    const bin = (hz) => Math.round(hz * N / sr2), lo1 = bin(30), lo2 = bin(150), mi1 = bin(1500), mi2 = bin(4500), me1 = bin(300), me2 = bin(2000), ch1 = bin(65), ch2 = bin(2000);
    const flux = new Float32Array(F), fLow = new Float32Array(F), fMid = new Float32Array(F), rms = new Float32Array(F), lowE = new Float32Array(F), mel = new Float32Array(F), chroma = new Array(12).fill(0), pcOf = [];
    for (let k = 0; k <= N / 2; k++) { const hz = k * sr2 / N; pcOf[k] = hz > 0 ? ((Math.round(12 * Math.log2(hz / 440) + 69) % 12) + 12) % 12 : 0; }
    let prev = new Float32Array(N / 2 + 1), pl = 0, pm = 0; const re = new Float32Array(N), im = new Float32Array(N);
    for (let t = 0; t < F; t++) { let e = 0; for (let i = 0; i < N; i++) { const v = x[t * hop + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; } rms[t] = Math.sqrt(e / N);
      fft(re, im); let fl = 0, le = 0, me = 0, best = 0, bk = 0, sum = 0;
      for (let k = 1; k <= N / 2; k++) { const m = Math.log1p(Math.hypot(re[k], im[k]) * 10); const d = m - prev[k]; if (d > 0) fl += d; prev[k] = m;
        if (k >= lo1 && k <= lo2) le += m; if (k >= mi1 && k <= mi2) me += m; if (k >= ch1 && k <= ch2) chroma[pcOf[k]] += m * m;
        if (k >= me1 && k <= me2) { sum += m; if (m > best) { best = m; bk = k; } } }
      flux[t] = fl; fLow[t] = Math.max(0, le - pl); fMid[t] = Math.max(0, me - pm); pl = le; pm = me; lowE[t] = le;
      mel[t] = best > 2.6 * sum / (me2 - me1 + 1) ? 69 + 12 * Math.log2(bk * sr2 / N / 440) : 0; }
    // the tempo: the lag where the onsets repeat best, with a soft wish for the dance floor around 120
    const mean = flux.reduce((a, b) => a + b, 0) / F, env = flux.map((v) => Math.max(0, v - mean)); let bestL = 0, bestS = -1;
    for (let L = Math.floor(fr * 60 / 180); L <= Math.ceil(fr * 60 / 60); L++) { let sc = 0; for (let t = L; t < F; t++) sc += env[t] * env[t - L]; const bpm = fr * 60 / L; sc *= Math.exp(-0.5 * (Math.log2(bpm / 118) / 0.6) ** 2); if (sc > bestS) { bestS = sc; bestL = L; } }
    let raw = fr * 60 / bestL; // a finer look around the best lag
    let fine = raw, fs = -1; for (let b = raw * 0.97; b <= raw * 1.03; b += 0.1) { const L = fr * 60 / b; let sc = 0; for (let t = Math.ceil(L); t < F; t++) { const q = t - L, q0 = Math.floor(q), u = q - q0; sc += env[t] * (env[q0] * (1 - u) + (env[q0 + 1] || 0) * u); } if (sc > fs) { fs = sc; fine = b; } }
    let bpm = fine; while (bpm < 90) bpm *= 2; while (bpm > 134 && bpm / 2 >= 90) bpm /= 2;
    // the exact tempo: lay the low hits on a beat grid and let them correct it, a line through all of them
    { const lowPk = []; for (let t = 2; t < F - 2; t++) if (fLow[t] > fLow[t - 1] && fLow[t] >= fLow[t + 1] && fLow[t] > 0) lowPk.push(t);
      const top = lowPk.map((t) => fLow[t]).sort((a, b) => b - a)[Math.floor(lowPk.length * 0.4)] || 0, ts = lowPk.filter((t) => fLow[t] >= top).map((t) => t / fr);
      for (let it = 0; it < 3 && ts.length > 8; it++) { const P = 60 / bpm, t0 = ts[0], pts = ts.map((t) => [Math.round((t - t0) / P), t]).filter(([k, t]) => Math.abs(t - t0 - k * P) < P * 0.2);
        if (pts.length < 8) break; const n = pts.length, sx = pts.reduce((a, q) => a + q[0], 0), sy = pts.reduce((a, q) => a + q[1], 0), sxx = pts.reduce((a, q) => a + q[0] * q[0], 0), sxy = pts.reduce((a, q) => a + q[0] * q[1], 0);
        const slope = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx); if (slope > 0) bpm = 60 / slope; } }
    bpm = Math.round(Math.min(134, Math.max(90, bpm)));
    const L = fr * 60 / fine; let phase = 0, ps = -1; for (let ph = 0; ph < L; ph++) { let sc = 0; for (let t = ph; t < F; t += L) sc += fLow[Math.round(t)] || 0; if (sc > ps) { ps = sc; phase = ph; } }
    // the key
    let tonic = 0, minor = false, kb = -2; for (let k = 0; k < 12; k++) { const rot = chroma.slice(k).concat(chroma.slice(0, k)); const a = corr(rot, MAJ), b = corr(rot, MIN); if (a > kb) { kb = a; tonic = k; minor = false; } if (b > kb) { kb = b; tonic = k; minor = true; } }
    // hits: peaks above the local level
    const peaks = (sig, k) => { const out = []; for (let t = 2; t < F - 2; t++) { if (!(sig[t] > sig[t - 1] && sig[t] >= sig[t + 1])) continue; let m = 0, q = 0; for (let u = Math.max(0, t - 22); u < Math.min(F, t + 22); u++) { m += sig[u]; q += sig[u] * sig[u]; } const n = Math.min(F, t + 22) - Math.max(0, t - 22); m /= n; const sd = Math.sqrt(Math.max(0, q / n - m * m)); if (sig[t] > m + k * sd) out.push([t, sig[t]]); } return out; };
    const kicks = peaks(fLow, 1.3), snares = peaks(fMid, 1.5), all = peaks(flux, 1.0);
    // the melody line: frames with one clear middle tone, joined into notes
    const notes = []; let cur = null;
    for (let t = 0; t < F; t++) { const p = mel[t] ? Math.round(mel[t]) : 0; if (cur && p && Math.abs(p - cur.p) <= 0) { cur.e = t; continue; } if (cur && cur.e - cur.s >= 1) notes.push(cur); cur = p ? { s: t, e: t, p } : null; }
    if (cur && cur.e - cur.s >= 1) notes.push(cur);
    const sec = len / sr2, sorted = Array.from(rms).sort((a, b) => a - b);
    return { bpm, tempoHeard: Math.round(fine * 10) / 10, tonic, minor, sec, fr, phase: phase / fr, rms, lowE, kicks, snares, all, notes, q40: sorted[Math.floor(F * 0.4)] || 0, q90: sorted[Math.floor(F * 0.9)] || 1, frames: F };
  };
  // what the press heard, written as notes on the grid of its tempo, so the record picture can draw it like any record
  PR.readAudio = (an, BAR, PPQ) => {
    const tps = an.bpm / 60 * PPQ, T = (fr) => Math.round((fr / an.fr - an.phase) * tps), total = Math.max(BAR, Math.round((an.sec - an.phase) * tps)), ph = 8 * BAR;
    const P = Math.max(1, Math.ceil(total / ph)), rows = Array.from({ length: P }, () => Object.fromEntries(ROLES.map((r) => [r, 0]))), notes = { beats: [], perc: [], bass: [], chords: [], orch: [], melody: [], motif: [] };
    const add = (role, n) => { if (n.t < 0 || n.t >= total) return; notes[role].push(n); rows[Math.floor(n.t / ph)][role]++; };
    const kmax = Math.max(1e-6, ...an.kicks.map((k) => k[1])), smax = Math.max(1e-6, ...an.snares.map((k) => k[1]));
    an.kicks.forEach(([t, v]) => add('beats', { t: T(t), d: 60, p: 36, v: Math.round(40 + 87 * v / kmax) }));
    an.snares.forEach(([t, v]) => add('beats', { t: T(t), d: 60, p: 38, v: Math.round(40 + 87 * v / smax) }));
    const ks = new Set(an.kicks.concat(an.snares).map((k) => k[0])); an.all.forEach(([t]) => { if (!ks.has(t)) add('perc', { t: T(t), d: 40, p: 42, v: 60 }); });
    // one harmony arc and one bass stroke per beat where the track is full
    const beatF = an.fr * 60 / an.bpm, lmed = Array.from(an.lowE).sort((a, b) => a - b)[Math.floor(an.frames / 2)] || 0;
    for (let b = an.phase * an.fr, k = 0; b < an.frames; b += beatF, k++) { const i = Math.floor(b), j = Math.min(an.frames, Math.floor(b + beatF)); let e = 0, l = 0; for (let q = i; q < j; q++) { e += an.rms[q]; l += an.lowE[q]; } e /= Math.max(1, j - i); l /= Math.max(1, j - i);
      if (e > an.q40) add('chords', { t: Math.round(k * PPQ), d: PPQ, p: 60, v: Math.round(Math.min(127, 30 + 97 * (e - an.q40) / Math.max(1e-6, an.q90 - an.q40))) });
      if (l > lmed * 1.05) add('bass', { t: Math.round(k * PPQ), d: Math.round(PPQ * 0.8), p: 40, v: 90 }); }
    an.notes.forEach((n) => add('melody', { t: T(n.s), d: Math.max(20, T(n.e + 1) - T(n.s)), p: n.p, v: 90 }));
    for (const k of Object.keys(notes)) notes[k].sort((a, b) => a.t - b.t);
    return { P, rows, notes, total, BAR };
  };
  // the motif of your track: the busiest two bars of its melody line, written in the steps of its key
  PR.motifOf = (an, JP) => {
    if (an.notes.length < 6) return null; const beatF = an.fr * 60 / an.bpm, w = 8 * beatF, scale = an.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    let best = null, bs = 0; for (let s = an.phase * an.fr; s < an.frames - w; s += beatF * 2) { const inW = an.notes.filter((n) => n.s >= s && n.s < s + w); const sc = inW.length + inW.reduce((a, n) => a + Math.min(4, n.e - n.s), 0) * 0.2; if (inW.length >= 4 && sc > bs) { bs = sc; best = inW; } }
    if (!best) return null; const ns = []; best.forEach((n) => { const q = Math.round((n.s - best[0].s) / beatF * 2) / 2; if (!ns.length || q > ns[ns.length - 1].q) ns.push({ q, p: n.p }); });
    const pick = ns.slice(0, 6); if (pick.length < 4) return null;
    const step = (p) => { const s0 = ((p - an.tonic) % 12 + 12) % 12, oct = Math.floor((p - an.tonic) / 12); let bi = 0; scale.forEach((v, i) => { if (Math.abs(v - s0) < Math.abs(scale[bi] - s0)) bi = i; }); return oct * 7 + bi; };
    const base = step(pick[0].p), degrees = pick.map((n) => Math.max(-4, Math.min(7, step(n.p) - base)));
    const rhythm = pick.map((n, i) => { const d = i < pick.length - 1 ? pick[i + 1].q - n.q : 2; return [0.5, 1, 1.5, 2].reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a)); }); rhythm[rhythm.length - 1] = Math.max(1.5, rhythm[rhythm.length - 1]);
    return { degrees, rhythm };
  };

  root.PR = PR;
  if (typeof module !== 'undefined' && module.exports) module.exports = PR;
})(typeof window !== 'undefined' ? window : globalThis);
