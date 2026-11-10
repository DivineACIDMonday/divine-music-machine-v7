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
    const opt = { solo: true, mode: 'mixed', records: [{ arts: o.arts }], minutes: o.minutes, bpm: o.bpm || 0, seed: o.seed >>> 0, rack: o.rack, allWords: JW, template: o.template || null, tplChapter: 0 };
    let p = JP.plan([word(o.word)], opt);
    // the key: yours, or one the record itself chooses (the word and the styles), in the mode its character asks for
    const key = o.key && o.key !== 'auto' ? o.key : JP.KEYS[JP.hash(o.word + '|' + o.arts.join('|')) % 12] + (p.chapters[0].minor ? ' minor' : ' major');
    if (key !== p.chapters[0].key) p = JP.plan([word(o.word)], Object.assign(opt, { ov: [{ key }] }));
    p.side = 'A'; p.title = o.name; return p;
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
    const p = JP.plan([word(o.word)], { solo: true, mode: 'mixed', records: [{ arts }], minutes: o.minutes + (h.extended ? 2 : 0), bpm, seed: (o.seed ^ 0x5bd1e995) >>> 0,
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
    const g = cv.getContext('2d'), Wd = cv.width, Ht = cv.height, u = Wd / 1200, { bg, ink, acc } = pal, BAR = rd.BAR, ph = 8 * BAR;
    const F = PR.FONTS.find((f) => f.id === fontId) || PR.FONTS[0], serif = F.css, big = (n) => Math.round(n * (F.k || 1)), title = F.up ? info.name.toUpperCase() : info.name;
    const sans = '#px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    g.save(); g.scale(u, u);
    // the sleeve
    g.fillStyle = bg; g.fillRect(0, 0, 1200, 1200);
    const glow = g.createRadialGradient(600, 690, 60, 600, 690, 720); glow.addColorStop(0, rgba(acc, 0.16)); glow.addColorStop(1, rgba(acc, 0)); g.fillStyle = glow; g.fillRect(0, 0, 1200, 1200);
    g.fillStyle = ink; g.textBaseline = 'alphabetic';
    fit(g, title, serif, big(76), 1000); g.fillText(title, 60, 118);
    g.font = sans.replace('#', 23); g.fillStyle = rgba(ink, 0.7); g.fillText(info.styles + '   ' + info.bpm + ' bpm   ' + info.key + (info.remix ? '   ' + info.remix : ''), 62, 162);
    g.textAlign = 'right'; g.font = '600 ' + sans.replace('#', 64); g.fillStyle = rgba(acc, 0.9); g.fillText(info.side, 1140, 118);
    g.font = sans.replace('#', 19); g.fillStyle = rgba(ink, 0.55); g.fillText('Divine Monday Record Press', 1140, 1166); g.textAlign = 'left';
    // the disc: grooves from the outside in, one ring per phrase of eight bars, like a needle reads it
    const cx = 600, cy = 690, R = 455, inner = R * 0.36, P = rd.P, rw = (R * 0.975 - inner * 1.06) / P;
    const disc = lum(bg) > 0.5 ? '#141418' : mix(bg, '#000000', 0.55);
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = disc; g.fill();
    const sheen = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R); sheen.addColorStop(0, 'rgba(255,255,255,0.06)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = sheen; g.fill();
    const ringR = (q) => R * 0.975 - (q + 0.5) * rw, ang = (t) => -Math.PI / 2 + ((t % ph) / ph) * Math.PI * 2, ringOf = (t) => Math.min(P - 1, Math.floor(t / ph));
    const dens = rd.rows.map((row) => ROLES.reduce((s, k) => s + row[k], 0)), dmax = Math.max(1, ...dens);
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
    g.font = '600 ' + sans.replace('#', 15); g.fillText('SIDE ' + info.side + '   ' + info.bpm + ' BPM   ' + info.key.toUpperCase(), cx, cy + 76);
    if (info.remix) { g.font = sans.replace('#', 15); fit(g, info.remix, sans, 15, inner * 1.5); g.fillText(info.remix, cx, cy + 100); }
    g.font = sans.replace('#', 12); g.fillStyle = rgba(lab, 0.6); g.fillText('DIVINE MONDAY', cx, cy - inner * 0.62);
    g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fillStyle = bg; g.fill();
    g.restore(); g.textAlign = 'left';
  };

  root.PR = PR;
  if (typeof module !== 'undefined' && module.exports) module.exports = PR;
})(typeof window !== 'undefined' ? window : globalThis);
