/* Divine Symphony Machine · engine
   (c) 2026 Divine Monday. All rights reserved.
   Pure rules: harmony, voice leading, counterpoint, form and orchestration.
   No samples, no AI, no borrowed music. Written for Spitfire BBC Symphony Orchestra Discover. */
(function (root) {
'use strict';
const Y = {};
const PPQ = 480;
Y.PPQ = PPQ;
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
function mkRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
Y.rng = mkRng;

/* ================= pitch spelling ================= */
const NAT = [0, 2, 4, 5, 7, 9, 11];
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
const natMidi = D => 12 * Math.floor(D / 7) + NAT[mod(D, 7)];
const nAcc = x => mod(x + 6, 12) - 6;
function mToD(m) { const o = Math.floor(m / 12), pc = mod(m, 12); let l = 0; for (let i = 6; i >= 0; i--) if (NAT[i] <= pc) { l = i; break; } return o * 7 + l; }
function mkKey(L, t, m) {
  L = mod(L, 7); t = mod(t, 12);
  const sc = m === 'M' ? MAJ : MIN, alt = new Array(7);
  for (let k = 0; k < 7; k++) { const l = (L + k) % 7; alt[l] = nAcc(t + sc[k] - NAT[l]); }
  return { L, t, m, sc, alt };
}
function relKey(K, deg, m) { return mkKey(K.L + deg, K.t + K.sc[deg], m); }
function keyName(K) { const a = K.alt[K.L]; return 'CDEFGAB'[K.L] + (a < 0 ? '♭' : a > 0 ? '♯' : '') + (K.m === 'M' ? ' major' : ' minor'); }
function keyFromName(s) { // "C", "Bb", "f#m", "a" (lowercase = minor) or "Eb minor"
  s = String(s).trim(); let m = 'M';
  if (/minor|m$/.test(s) || /^[a-g]/.test(s)) m = 'm';
  const L = 'CDEFGAB'.indexOf(s[0].toUpperCase());
  let acc = 0; if (s[1] === 'b' || s[1] === '♭') acc = -1; if (s[1] === '#' || s[1] === '♯') acc = 1;
  return mkKey(L, NAT[L] + acc, m);
}
const dpc = (K, deg) => mod(K.t + K.sc[deg], 12);
function tonicD(K, near) {
  let best = 0, bd = 1e9; const base = mToD(near);
  for (let D = base - 8; D <= base + 8; D++) {
    if (mod(D, 7) !== K.L) continue;
    const d = Math.abs(natMidi(D) + K.alt[K.L] - near); if (d < bd) { bd = d; best = D; }
  }
  return best;
}
Y.keyFromName = keyFromName; Y.keyName = keyName;

/* ================= chords ================= */
function tn(L, pc) { L = mod(L, 7); return { L, a: nAcc(pc - NAT[L]), pc: mod(pc, 12) }; }
const QIV = { M: [4, 7], m: [3, 7], o: [3, 6], h: [3, 6], '+': [4, 8] };
function mkChord(rootL, rootPc, q, ext, inv) {
  const iv = QIV[q];
  const T = [tn(rootL, rootPc), tn(rootL + 2, rootPc + iv[0]), tn(rootL + 4, rootPc + iv[1])];
  let sev = -1;
  if (ext === '7' || ext === '9') { T.push(tn(rootL + 6, rootPc + (q === 'o' ? 9 : 10))); sev = 3; }
  if (ext === 'M7' || ext === 'M9') { T.push(tn(rootL + 6, rootPc + 11)); sev = 3; }
  if (ext === '9' || ext === 'M9' || ext === 'a9') T.push(tn(rootL + 1, rootPc + 14));
  if (ext === 'a6') T.push(tn(rootL + 5, rootPc + 9));
  return { T, root: mod(rootPc, 12), q, ext: ext || '', bi: inv < T.length ? inv : 0, sev };
}
const NUMS = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
const TOKRE = /^(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(o|ø|h|\+)?(M9|M7|a6|a9|65|43|42|64|9|7|6)?$/;
const INV = { '': [0, ''], '6': [1, ''], '64': [2, ''], '7': [0, '7'], '65': [1, '7'], '43': [2, '7'], '42': [3, '7'], '9': [0, '9'], 'M7': [0, 'M7'], 'M9': [0, 'M9'], 'a6': [0, 'a6'], 'a9': [0, 'a9'] };
function parseTok(tok, K, plain) {
  let c;
  if (tok === 'Cad') { c = parseTok('I64', K, plain); c.cad = 1; c.fn = 'D'; return c; }
  if (tok === 'PI') { c = mkChord(K.L, K.t, 'M', '', 0); c.fn = 'T'; return c; }
  if (tok === 'N6') { c = mkChord(K.L + 1, K.t + 1, 'M', '', 1); c.fn = 'S'; return c; }
  if (tok === 'Ger') return { T: [tn(K.L + 5, K.t + 8), tn(K.L, K.t), tn(K.L + 2, K.t + 3), tn(K.L + 3, K.t + 6)], root: mod(K.t + 8, 12), q: 'G', ext: '', bi: 0, sev: -1, fn: 'S', ger: 1 };
  const sl = tok.indexOf('/');
  if (sl > 0) {
    const tg = parseTok(tok.slice(sl + 1), K, plain);
    const K2 = mkKey(tg.T[0].L, tg.root, 'M');
    c = parseTok(tok.slice(0, sl), K2, true); c.fn = 'D'; c.app = 1; return c;
  }
  const m = TOKRE.exec(tok); if (!m) throw new Error('chord ' + tok);
  const deg = NUMS[m[2].toUpperCase()], up = m[2] === m[2].toUpperCase();
  const iv = INV[m[4] || ''], inv = iv[0], ext = iv[1];
  let q = m[3] === 'o' ? 'o' : (m[3] === 'ø' || m[3] === 'h') ? 'h' : m[3] === '+' ? '+' : up ? 'M' : 'm';
  let pc = K.t + MAJ[deg] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0);
  if (K.m === 'm' && !plain && !m[1]) {
    pc = K.t + MIN[deg];
    if (!m[3]) q = ['m', ext === '7' ? 'h' : 'o', 'M', 'm', up ? 'M' : 'm', 'M', up ? 'M' : 'o'][deg];
    if (deg === 0 && ext === 'M7') q = 'm';
    if (deg === 6 && (!up || m[3] === 'o')) pc = K.t + 11;
  }
  c = mkChord(K.L + deg, pc, q, ext, inv);
  c.fn = deg === 0 || deg === 2 || deg === 5 ? 'T' : deg === 4 || deg === 6 ? 'D' : 'S';
  return c;
}
function mkEv(t, dur, ch, K, ph) {
  const alt = K.alt.slice(); for (const x of ch.T) alt[x.L] = x.a;
  const pcs = new Set(ch.T.map(x => x.pc));
  let lt = -1;
  if (ch.fn === 'D' && !ch.cad) lt = ch.q === 'M' ? ch.T[1].pc : (ch.q === 'o' || ch.q === 'h') ? ch.T[0].pc : -1;
  return { t, dur, ch, K, alt, pcs, bass: ch.T[ch.bi].pc, lt, sv: ch.sev >= 0 ? ch.T[ch.sev].pc : -1, ph };
}
function evAt(evs, t) {
  let lo = 0, hi = evs.length - 1, a = 0;
  while (lo <= hi) { const md = (lo + hi) >> 1; if (evs[md].t <= t) { a = md; lo = md + 1; } else hi = md - 1; }
  return evs[a];
}
function sounding(L, t) {
  if (!L || !L.length) return null;
  let lo = 0, hi = L.length - 1, a = -1;
  while (lo <= hi) { const md = (lo + hi) >> 1; if (L[md].t <= t) { a = md; lo = md + 1; } else hi = md - 1; }
  if (a < 0) return null; const n = L[a]; return t < n.t + n.dur ? n.m : null;
}
Y.parseTok = parseTok;

/* ================= harmony templates ================= */
const TPLS = {
  sent: ['I | I | V7 | V7 | I IV | ii6 V | Cad V7 | I', 'I | V65 I | V7 | V7 I | vi IV | ii6 V | Cad V7 | I', 'I | I | V | V | vi | ii6 | Cad V7 | I', 'I | IV6 I | V43 | V65 I | IV | ii6 V | Cad V7 | I', 'I | ii V7 | V7 | I | IV | V7/V V | Cad V7 | I'],
  sentHC: ['I | I | V7 | V7 | I IV | ii6 V/V | Cad | V', 'I | V65 I | V7 | V7 I | vi | ii6 V/V | V | V', 'I | I | V | V | IV | ii6 | V/V | V'],
  ante: ['I | V65 I | IV ii6 | V', 'I | I V7 | I IV | V', 'I IV | I V | vi ii6 | V', 'I | ii6 V7 | I vi | V', 'I | IV64 I | V42 I6 | V'],
  cons: ['I | V65 I | ii6 V | I', 'I | IV ii6 | Cad V7 | I', 'vi | ii6 V | Cad V7 | I', 'I6 | IV V | Cad V7 | I', 'I | vi ii | Cad V7 | I'],
  binB: ['V7 | I | V7 | I | vi | ii6 | V/V | V', 'V | V7 | I6 | V | IV | ii6 | Cad | V', 'V7 | V7 | I | I | IV | V/V | V | V'],
  close: ['I IV | V7 I | I IV | V7 I', 'I | V7 | I | V7', 'I ii6 | Cad V7 | I ii6 | Cad V7'],
  transA: ['I | vi | IV | V7/$X', 'I | I6 | ii | V7/$X', 'I | IV | vi | V7/$X'],
  transB: ['I6 | ii6 | Cad | V', 'IV | ii6 | V | V', 'vi | ii6 | Cad | V'],
  stayB: ['I6 | ii6 | Cad | V', 'IV | ii6 | V | V'],
  dev: ['V7 | I', 'V65 | I', 'V7 I | V7 I'],
  retrans: ['V | V | V7 | V7'],
  coda: ['I | IV | Cad | V7 | I | IV | V7 | I', 'I | ii6 | Cad | V7 | I | IV | Cad V7 | I'],
  wz1: ['I | I | V7 | V7 | V7 | V7 | I | I', 'I | I | IV | IV | V7 | V7 | I | I'],
  wz2: ['I | I | IV | IV | Cad | V7 | I | I', 'vi | vi | ii | ii | Cad | V7 | I | I'],
  mA: ['I | I | V7 | I | IV | I | V/V | V'],
  mB: ['I | I | V7 | I | IV | ii6 | Cad V7 | I'],
  ariaB: ['I | V65 I | IV V | I | vi IV | ii6 V | Cad V7 | I'],
  thB: ['V | V7 I | V | V7 | I | IV ii6 | Cad V7 | I'],
  intro: ['I | IV64 I | vi | V/V | V | V | V7 | V7', 'I | V65 | vi | ii6 | Cad | V | V7 | V7'],
};
const GROUNDS = { M: ['I V6 | vi V', 'I vi | IV V', 'I iii | IV V', 'vi IV | I V'], m: ['i v6 | iv6 V', 'i VI | iv V', 'i VII | VI V'] };
function flavor(s, era, r, mode, fl) {
  const bars = s.split('|').map(b => b.trim().split(/\s+/));
  const flat = []; bars.forEach((b, bi) => b.forEach((t, j) => flat.push({ bi, j, t })));
  flat.forEach((x, i) => {
    const nx = flat[i + 1] ? flat[i + 1].t : '';
    let t = x.t;
    if (era === 'romantic') {
      if (t === 'IV' && mode === 'M' && i > 2 && r() < .3) t = 'iv';
      else if (t === 'ii6' && (nx === 'Cad' || nx === 'V' || nx === 'V7') && r() < .35) t = mode === 'm' ? 'N6' : 'ii65';
      else if (t === 'ii6' && r() < .2) t = 'viio7/V';
      else if (t === 'vi' && (nx === 'IV' || nx === 'ii6' || nx === 'ii') && r() < .25) t = 'bVI';
      else if (t === 'IV' && nx === 'Cad' && r() < .4) t = 'Ger';
    } else if (era === 'impressionist') {
      if (t === 'I' && i > 0 && i < flat.length - 1 && r() < .6) t = mode === 'm' ? 'I7' : pick(r, ['IM7', 'Ia9', 'Ia6']);
      else if (t === 'IV' && r() < .6) t = mode === 'm' ? 'IV7' : 'IVM7';
      else if ((t === 'ii' || t === 'ii6') && r() < .6) t = 'ii7';
      else if (t === 'vi' && r() < .5) t = 'vi7';
      else if (t === 'V7' && nx !== 'I' && r() < .5) t = 'V9';
      else if (t === 'V' && nx !== 'I' && i < flat.length - 2 && r() < .25) t = mode === 'm' ? 'VII' : 'bVII';
    }
    if (t === x.t && fl === 'dark') {
      if (t === 'IV' && mode === 'M' && i > 1 && r() < .35) t = 'iv';
      else if (t === 'vi' && mode === 'M' && (nx === 'IV' || nx === 'ii6' || nx === 'ii') && r() < .3) t = 'bVI';
      else if ((t === 'ii6' || t === 'iio6') && mode === 'm' && (nx === 'Cad' || nx === 'V' || nx === 'V7') && r() < .45) t = 'N6';
    } else if (t === x.t && fl === 'color' && era !== 'impressionist') {
      if (t === 'I' && i > 0 && i < flat.length - 1 && r() < .35) t = mode === 'm' ? 'I7' : 'Ia6';
      else if (t === 'IV' && r() < .35) t = mode === 'm' ? 'IV7' : 'IVM7';
      else if (t === 'vi' && r() < .3) t = 'vi7';
    }
    x.t = t;
  });
  const out = bars.map(() => []); flat.forEach(x => out[x.bi].push(x.t));
  return out;
}
function splitBar(n, meter) {
  if (meter === 4) return [[4], [2, 2], [2, 1, 1], [1, 1, 1, 1]][n - 1] || new Array(n).fill(4 / n);
  return [[3], [2, 1], [1, 1, 1]][n - 1] || new Array(n).fill(3 / n);
}

/* ================= rhythm and contour ================= */
const RH = {
  4: {
    brisk: [[1, .5, .5, 1, 1], [.5, .5, .5, .5, 1, 1], [1.5, .5, 1, 1], [1, 1, .5, .5, 1], [.5, .5, 1, .5, .5, 1], [1, .5, .5, .5, .5, 1]],
    lyr: [[2, 1, 1], [3, 1], [1.5, .5, 2], [1, 1, 2], [2, 2], [1, .5, .5, 2], [1.5, .5, 1, 1]],
    motor: [[.5, .5, .5, .5, .5, .5, .5, .5], [.25, .25, .25, .25, .5, .5, .5, .5, 1], [.5, .25, .25, .5, .25, .25, .5, .5, 1], [.25, .25, .25, .25, .25, .25, .25, .25, .5, .5, 1]],
    march: [[.75, .25, .75, .25, 1, 1], [1.5, .5, 1, 1], [.75, .25, 1, .75, .25, 1], [1, .5, .5, 1, 1], [.75, .25, .75, .25, 2]],
    slow: [[4], [3, 1], [2, 2], [2, 1, 1], [1.5, .5, 2]],
    dotted: [[1.5, .5, 1.5, .5], [.75, .25, 1.5, .5, 1], [3, .75, .25], [1.5, .25, .25, 2]],
  },
  3: {
    brisk: [[1, .5, .5, 1], [.5, .5, .5, .5, 1], [1, 1, .5, .5], [1.5, .5, 1], [.5, .5, 1, 1]],
    dance: [[1, 1, 1], [2, 1], [1.5, .5, 1], [1, .5, .5, 1], [.5, .5, 1, 1]],
    waltz: [[3], [2, 1], [1, 1, 1], [1.5, .5, 1], [2, 1]],
    lyr: [[2, 1], [3], [1.5, .5, 1], [1, 2]],
    motor: [[.5, .5, .5, .5, .5, .5], [.25, .25, .25, .25, .5, .5, 1], [.5, .25, .25, .5, .5, 1]],
    slow: [[3], [2, 1], [1.5, .5, 1]],
  },
};
const K7RH = { 4: [[1, 1, 1, 1], [2, 1, 1], [1, .5, .5, 1, 1], [1.5, .5, 1, 1]], 3: [[1, 1, 1], [2, 1], [1, .5, .5, 1]] };
function rhPool(meter, ch, era) {
  if (era === 'baroque' && ch === 'brisk') ch = 'motor';
  const P = RH[meter];
  return P[ch] || (ch === 'march' || ch === 'dotted' ? P.dance || P.brisk : ch === 'waltz' || ch === 'dance' ? P.lyr : P.brisk);
}
function contour(n, r, kind, era) {
  const st = [];
  for (let i = 0; i < n - 1; i++) {
    let s;
    switch (kind) {
      case 'arch': s = i < (n - 1) / 2 ? 1 : -1; break;
      case 'leap': s = i === 0 ? pick(r, era === 'romantic' ? [3, 4, 5] : [2, 3, 4, -2]) : -1; break;
      case 'down': s = -1; break;
      case 'up': s = 1; break;
      case 'nb': s = i % 2 ? -1 : 1; break;
      case 'arp': s = i % 3 === 2 ? -2 : 2; break;
      default: s = pick(r, [1, -1]);
    }
    if (kind !== 'leap' || i > 0) { if (r() < .16) s *= 2; if (r() < .07) s = 0; }
    st.push(s);
  }
  return st;
}
const sum = a => a.reduce((x, y) => x + y, 0);

/* ================= the line maker: beam search ================= */
const ICOST = [0.8, 0, 1.2, 3, 4.5, 6.5, 9, 5.5];
function line(sk, o) {
  const W = o.width || 18, leap = o.leap || 7;
  let beam = [{ c: 0, D: o.prevD == null ? null : o.prevD, m: o.prevM, t: o.prevT, st: 0, nct: 0, ev: null, path: null, n: null }];
  const Dlo = mToD(o.lo), Dhi = mToD(o.hi) + 1;
  const fixed = (o.fixed || []).filter(Boolean);
  for (const n of sk) {
    const ev = n.ev, next = [];
    for (const s of beam) {
      let a = Dlo, b = Dhi;
      if (s.D != null) { a = Math.max(a, s.D - leap); b = Math.min(b, s.D + leap); }
      for (let D = a; D <= b; D++) {
        const m = natMidi(D) + ev.alt[mod(D, 7)];
        if (m < o.lo || m > o.hi) continue;
        const pc = mod(m, 12), ct = ev.pcs.has(pc);
        let c = s.c;
        if (n.goal && !n.goal.has(pc)) c += 90;
        if (n.strong && !ct) c += o.appog ? 16 : 45;
        if (o.avoid && !ct && o.avoid.has(mod(pc - ev.K.t, 12))) c += 6;
        if (s.D == null || s.m == null) c += Math.abs(m - (o.start || o.center)) * 0.25;
        else {
          const dD = D - s.D, ad = Math.abs(dD), sm = m - s.m;
          c += ad < 8 ? ICOST[ad] : 14;
          if (n.want != null) c += (o.wm || 2.5) * Math.abs(dD - n.want);
          if (!ct && !n.strong && ad !== 1) c += 30;
          if (s.nct && ad !== 1) c += 26;
          if (Math.abs(s.st) >= 3 && !(ad >= 1 && ad <= 2 && Math.sign(dD) === -Math.sign(s.st))) c += 7;
          if (ad >= 2 && Math.abs(s.st) >= 2 && Math.sign(dD) === Math.sign(s.st)) c += 5;
          if (ad === 1 && Math.abs(sm) === 3) c += 34;
          if (Math.abs(sm) === 6) c += 18;
          if (ad === 0 && sm !== 0) c += 14;
          if (s.ev && s.ev !== ev) {
            const spc = mod(s.m, 12);
            if (s.ev.lt === spc && ev.ch.root === mod(spc + 1, 12) && sm !== 1) c += o.tend || 6;
            if (s.ev.sv === spc && ev.ch !== s.ev.ch && !(sm === -1 || sm === -2)) c += o.tend || 6;
          }
          if (o.contra && sm) { const a1 = sounding(o.contra, s.t), a2 = sounding(o.contra, n.t); if (a1 != null && a2 != null && Math.sign(sm) === Math.sign(a2 - a1)) c += 1.5; }
          if (sm) for (const F of fixed) {
            let f1 = sounding(F, n.t - 1); if (f1 == null) f1 = sounding(F, s.t); const f2 = sounding(F, n.t);
            if (f1 == null || f2 == null || f1 === f2) continue;
            const i1 = Math.abs(s.m - f1) % 12, i2 = Math.abs(m - f2) % 12;
            if (i1 === i2 && (i1 === 0 || i1 === 7)) c += Math.sign(sm) === Math.sign(f2 - f1) ? 400 : 14;
          }
        }
        if (n.strong) for (const F of fixed) { const f = sounding(F, n.t); if (f === m) c += o.uni || 6; }
        if (o.above) for (const A of o.above) { const x = sounding(A, n.t); if (x != null && m >= x) c += 60; }
        if (o.below) for (const B of o.below) { const x = sounding(B, n.t); if (x != null && m <= x) c += 60; }
        const ov = Math.abs(m - o.center) - (o.half || 9); if (ov > 0) c += ov * 1.4;
        if (o.r) c += o.r() * (o.noise == null ? 1.2 : o.noise);
        next.push({ c, D, m, t: n.t, st: s.D == null ? 0 : D - s.D, nct: ct ? 0 : 1, ev, path: s, n });
      }
    }
    next.sort((x, y) => x.c - y.c);
    const seen = new Set(), nb = [];
    for (const x of next) { const k = x.D * 2 + x.nct; if (seen.has(k)) continue; seen.add(k); nb.push(x); if (nb.length >= W) break; }
    if (nb.length) beam = nb;
  }
  const out = [];
  for (let s = beam[0]; s && s.n; s = s.path) out.push({ t: s.n.t, dur: s.n.dur, m: s.m, D: s.D, orn: s.n.orn });
  return out.reverse();
}
function parHit(a1, a2, F, t) {
  const b1 = sounding(F, t - 1), b2 = sounding(F, t);
  if (a1 == null || b1 == null || b2 == null || a1 === a2 || b1 === b2 || Math.sign(a2 - a1) !== Math.sign(b2 - b1)) return false;
  const i1 = Math.abs(a1 - b1) % 12, i2 = Math.abs(a2 - b2) % 12;
  return i1 === i2 && (i1 === 0 || i1 === 7);
}
function minorFix(notes, evs, fixed) {
  if (fixed) {
    const orig = notes.map(n => n.m);
    minorFix(notes, evs);
    const bad = i => { const n = notes[i]; if (!n) return false; const p = notes[i - 1]; return fixed.some(F => F && p && p.t + p.dur >= n.t && parHit(p.m, n.m, F, n.t)); };
    for (let i = 0; i < notes.length; i++) if (notes[i].m !== orig[i] && (bad(i) || bad(i + 1))) notes[i].m = orig[i];
    return;
  }
  for (let i = 0; i + 1 < notes.length; i++) {
    const a = notes[i], b = notes[i + 1];
    if (Math.abs(b.D - a.D) !== 1 || Math.abs(b.m - a.m) !== 3) continue;
    const ea = evAt(evs, a.t), eb = evAt(evs, b.t);
    if (ea.K.m !== 'm') continue;
    const lo = a.D < b.D ? a : b, el = lo === a ? ea : eb, hi = lo === a ? b : a, eh = hi === a ? ea : eb;
    if (!el.pcs.has(mod(lo.m, 12))) lo.m += 1; else if (!eh.pcs.has(mod(hi.m, 12))) hi.m -= 1;
  }
  for (let i = 0; i + 1 < notes.length; i++) { // natural 7 rising to the tonic becomes a leading tone
    const a = notes[i], b = notes[i + 1], ea = evAt(evs, a.t);
    if (ea.K.m === 'm' && b.D === a.D + 1 && mod(b.m - ea.K.t, 12) === 0 && mod(a.m - ea.K.t, 12) === 10 && !ea.pcs.has(mod(a.m, 12))) a.m += 1;
  }
}

/* ================= eras, forms, instruments ================= */
const ERAS = {
  baroque: { name: 'Baroque', years: '1600 to 1750', blurb: 'Running basses, terraced dynamics, sequences and trills. Think continuo and counterpoint.', tex: 'continuo', btex: 'walk', rub: .02, amp: 0, terr: 1, melLo: 62, melHi: 88, melC: 74, appog: 0, ctr: 0, trill: 1 },
  classical: { name: 'Classical', years: '1750 to 1820', blurb: 'Clear periods, Alberti figures, balanced phrases, wind pairs with horns and trumpets.', tex: 'repeated8', btex: 'drum8', rub: .04, amp: .12, melLo: 64, melHi: 89, melC: 76, appog: 0, ctr: .2, trill: 1 },
  romantic: { name: 'Romantic', years: '1820 to 1900', blurb: 'Long lines, rich chromatic harmony, horn calls, swelling dynamics and rubato.', tex: 'arpeggio', btex: 'held', rub: .1, amp: .2, melLo: 62, melHi: 91, melC: 76, appog: 1, ctr: .6, trill: 0 },
  impressionist: { name: 'Impressionist', years: '1890 to 1920', blurb: 'Colour chords, ninths and added sixths, soft washes, modal turns and floating time.', tex: 'sustain', btex: 'held', rub: .12, amp: .18, melLo: 64, melHi: 89, melC: 76, appog: 1, ctr: .3, trill: 0, avoid: [5, 11] },
};
Y.ERAS = ERAS;
const INST = [
  { id: 'picc', name: 'Piccolo', grp: 'ww', lo: 74, hi: 102, ks: 'w' },
  { id: 'fl', name: 'Flutes', grp: 'ww', lo: 60, hi: 96, ks: 'w' },
  { id: 'ob', name: 'Oboes', grp: 'ww', lo: 58, hi: 89, ks: 'w' },
  { id: 'eh', name: 'English Horn', grp: 'ww', lo: 53, hi: 83, ks: 'w', x: 1, short: 'E Horn' },
  { id: 'cl', name: 'Clarinets', grp: 'ww', lo: 50, hi: 91, ks: 'w' },
  { id: 'bcl', name: 'Bass Clarinet', grp: 'ww', lo: 34, hi: 73, ks: 'w', x: 1, short: 'B Clar' },
  { id: 'bsn', name: 'Bassoons', grp: 'ww', lo: 34, hi: 72, ks: 'w' },
  { id: 'cbsn', name: 'Contrabassoon', grp: 'ww', lo: 22, hi: 59, ks: 'w', x: 1, short: 'C Bsn' },
  { id: 'hn', name: 'Horns', grp: 'br', lo: 41, hi: 77, ks: 'w' },
  { id: 'shn', name: 'Solo Horn', grp: 'br', lo: 41, hi: 77, ks: 'w', x: 1, short: 'S Horn' },
  { id: 'tpt', name: 'Trumpets', grp: 'br', lo: 55, hi: 82, ks: 'w' },
  { id: 'stpt', name: 'Solo Trumpet', grp: 'br', lo: 55, hi: 82, ks: 'w', x: 1, short: 'S Tpt' },
  { id: 'tbn', name: 'Tenor Trombones', grp: 'br', lo: 40, hi: 72, ks: 'w' },
  { id: 'stbn', name: 'Solo Trombone', grp: 'br', lo: 40, hi: 70, ks: 'w', x: 1, short: 'S Tbn' },
  { id: 'btbn', name: 'Bass Trombones', grp: 'br', lo: 34, hi: 65, ks: 'w' },
  { id: 'tba', name: 'Tuba', grp: 'br', lo: 29, hi: 58, ks: 'w' },
  { id: 'timp', name: 'Timpani', grp: 'perc', lo: 40, hi: 57, ks: null },
  { id: 'bells', name: 'Tubular Bells', grp: 'perc', lo: 53, hi: 77, ks: null, x: 1, short: 'Bells' },
  { id: 'glock', name: 'Glockenspiel', grp: 'perc', lo: 65, hi: 101, ks: null, x: 1, short: 'Glock' },
  { id: 'vib', name: 'Vibraphone', grp: 'perc', lo: 53, hi: 89, ks: null, x: 1, short: 'Vibes' },
  { id: 'mar', name: 'Marimba', grp: 'perc', lo: 36, hi: 96, ks: null, x: 1, short: 'Marimba' },
  { id: 'xyl', name: 'Xylophone', grp: 'perc', lo: 65, hi: 108, ks: null, x: 1, short: 'Xylo' },
  { id: 'pno', name: 'Piano', grp: 'kb', lo: 21, hi: 108, ks: null },
  { id: 'vln1', name: 'Violins 1', grp: 'str', lo: 55, hi: 100, ks: 's' },
  { id: 'vln2', name: 'Violins 2', grp: 'str', lo: 55, hi: 93, ks: 's' },
  { id: 'vla', name: 'Violas', grp: 'str', lo: 48, hi: 86, ks: 's' },
  { id: 'vc', name: 'Celli', grp: 'str', lo: 36, hi: 74, ks: 's' },
  { id: 'cb', name: 'Basses', grp: 'str', lo: 28, hi: 62, ks: 'b' },
  { id: 'svn', name: 'Solo Violin', grp: 'str', lo: 55, hi: 98, ks: 's', x: 1, short: 'S Vln' },
  { id: 'svc', name: 'Solo Cello', grp: 'str', lo: 36, hi: 81, ks: 's', x: 1, short: 'S Cello' },
];
const IM = {}; INST.forEach(i => IM[i.id] = i);
Y.EXTRAS = INST.filter(i => i.x).map(i => i.id);
Y.INST = INST;
/* keyswitches of BBC SO Discover: strings Long C-2, Spiccato C#-2, Pizzicato D-2, Tremolo D#-2 (Basses no tremolo); winds and brass Long C-2, Short C#-2 */
const KS = { s: { long: 0, short: 1, pizz: 2, trem: 3 }, b: { long: 0, short: 1, pizz: 2, trem: 0 }, w: { long: 0, short: 1, pizz: 1, trem: 0 } };
const ARTNAME = { s: ['Long', 'Spiccato', 'Pizzicato', 'Tremolo'], b: ['Long', 'Spiccato', 'Pizzicato'], w: ['Long', 'Short'] };
Y.ARTNAME = ARTNAME;
const PRESETS = {
  baroque: ['vln1', 'vln2', 'vla', 'vc', 'cb', 'ob', 'bsn', 'tpt', 'timp', 'pno'],
  classical: ['vln1', 'vln2', 'vla', 'vc', 'cb', 'fl', 'ob', 'cl', 'bsn', 'hn', 'tpt', 'timp'],
  romantic: INST.filter(i => i.id !== 'pno').map(i => i.id),
  impressionist: ['vln1', 'vln2', 'vla', 'vc', 'cb', 'fl', 'ob', 'cl', 'bsn', 'hn', 'pno'],
  strings: ['vln1', 'vln2', 'vla', 'vc', 'cb'],
  all: INST.filter(i => !i.x).map(i => i.id),
  berlin: INST.map(i => i.id).filter(id => id !== 'pno' && id !== 'btbn').concat(['pno']),
};
Y.PRESETS = PRESETS;
const FORMS = {
  minuet: { name: 'Minuet and trio', meter: 3, tempo: 120, map: ['A', 'A', 'B', 'A', 'Trio', 'A', 'B', 'A'], blurb: 'A courtly dance in three, a gentle trio, then the minuet again.' },
  rondo: { name: 'Rondo', meter: 4, tempo: 132, map: ['A', 'B', 'A', 'C', 'A'], blurb: 'A cheerful refrain that keeps coming home between two episodes.' },
  sonata: { name: 'Sonata form', meter: 4, tempo: 132, map: ['Expo', 'Dev', 'Recap', 'Coda'], blurb: 'Two themes, a stormy development, and the return of everything in the home key.' },
  variations: { name: 'Theme and variations', meter: 4, tempo: 100, map: ['Th', '1', '2', '3', '4', '5', 'Fin'], blurb: 'One theme, dressed six ways: ornaments, minor, in the bass, a march, an adagio, a finale.' },
  overture: { name: 'Overture', meter: 4, tempo: 132, map: ['Slow', 'Allegro', 'Cresc'], blurb: 'A slow curtain, a quick allegro and a crescendo that lifts the roof.' },
  march: { name: 'March', meter: 4, tempo: 112, map: ['Intro', 'A', 'B', 'Trio', 'A'], blurb: 'Fanfare, two strains, a singing trio and a proud return.' },
  waltz: { name: 'Waltz', meter: 3, tempo: 168, map: ['Intro', 'W1', 'W2', 'W1', 'Coda'], blurb: 'Oom pah pah: two waltz tunes and a whirling coda.' },
  aria: { name: 'Aria', meter: 4, tempo: 66, map: ['Rit', 'A', 'B', 'A'], blurb: 'A song without words for a solo instrument, da capo with ornaments and a cadenza.' },
  canon: { name: 'Canon', meter: 4, tempo: 72, map: ['Ground', 'I', 'II', 'III'], blurb: 'Three voices chase the same melody over a repeating ground bass.' },
  fugue: { name: 'Fugue', meter: 4, tempo: 84, map: ['Expo', 'Ep', 'Mid', 'Str'], blurb: 'A subject passes through four voices with answer, countersubject, episodes and a pedal.' },
  symphony: { name: 'Symphony', meter: 4, tempo: 132, map: ['I', 'II', 'III', 'IV'], blurb: 'Four movements: sonata allegro, slow aria, minuet or scherzo, rondo finale.' },
  suite: { name: 'Your own suite', meter: 4, tempo: 120, map: ['You', 'choose', '+'], blurb: 'Line up any forms you like. The Mozart Advisor tells you what follows well.' },
};
Y.FORMS = FORMS;

/* ================= feelings ================= */
const FEELINGS = {
  heroic: { name: 'Heroic', icon: '🦁', blurb: 'Brave, proud, a victory. Horns and trumpets lead.', mode: 'M', keys: ['Eb', 'D', 'C'], era: 'romantic', forms: ['overture', 'march', 'sonata'], im: 1.1, ia: .1, da: .1, tempo: 1.04, rub: 1, lead: 'solo:hn', tex: { brisk: 'repeated8', lyr: 'block' }, preset: ['vln1', 'vln2', 'vla', 'vc', 'cb', 'fl', 'ob', 'cl', 'bsn', 'hn', 'tpt', 'tbn', 'btbn', 'tba', 'timp'] , leads: ['shn', 'hn'], bfo: ['shn', 'stpt', 'bells', 'cbsn'] },
  tender: { name: 'Tender', icon: '🕊', blurb: 'Warm and close, like a love letter. A singing oboe over soft strings.', mode: 'M', keys: ['F', 'A', 'G'], era: 'classical', forms: ['aria', 'variations', 'minuet'], im: .75, ia: 0, da: -.15, tempo: .9, rub: 1.3, lead: 'solo:ob', tex: { brisk: 'alberti', lyr: 'arpeggio' }, preset: ['vln1', 'vln2', 'vla', 'vc', 'cb', 'fl', 'ob', 'cl', 'bsn', 'hn'], soft: 1 , leads: ['svn', 'ob'], bfo: ['svn', 'eh'] },
  mysterious: { name: 'Mysterious', icon: '🌫', blurb: 'Shadows and questions. Low strings tremble, a clarinet wanders.', mode: 'm', keys: ['d', 'c', 'f#'], era: 'romantic', forms: ['fugue', 'canon', 'sonata'], im: .85, ia: 0, da: -.12, tempo: .9, rub: 1.2, lead: 'solo:cl', tex: { brisk: 'tremolo', lyr: 'sustain' }, flav: 'dark', preset: ['vln1', 'vln2', 'vla', 'vc', 'cb', 'fl', 'cl', 'bsn', 'hn', 'tbn', 'timp'], soft: 1 , leads: ['bcl', 'cl'], bfo: ['bcl', 'cbsn', 'vib'] },
  joyful: { name: 'Joyful', icon: '☀', blurb: 'Sunny and quick, a smile in sound. Bright strings and chattering winds.', mode: 'M', keys: ['G', 'D', 'A'], era: 'classical', forms: ['rondo', 'waltz', 'minuet'], im: 1, ia: .05, da: .05, tempo: 1.08, rub: .8, lead: 'solo:fl', tex: { brisk: 'repeated8', lyr: 'beats' }, preset: null , leads: ['fl'], bfo: ['glock', 'xyl', 'mar'] },
  melancholy: { name: 'Melancholy', icon: '🌧', blurb: 'Longing and rain on the window. A cello sings, minor colours everywhere.', mode: 'm', keys: ['g', 'e', 'b'], era: 'romantic', forms: ['aria', 'variations', 'canon'], im: .8, ia: 0, da: -.1, tempo: .88, rub: 1.4, lead: 'solo:vc', tex: { brisk: 'syncop', lyr: 'arpeggio' }, flav: 'dark', preset: ['vln1', 'vln2', 'vla', 'vc', 'cb', 'fl', 'ob', 'cl', 'bsn', 'hn'], soft: 1 , leads: ['svc', 'eh', 'vc'], bfo: ['eh', 'svc', 'bcl'] },
  stormy: { name: 'Stormy', icon: '⚡', blurb: 'Wind, waves, a chase. Tremolo strings, hammering timpani.', mode: 'm', keys: ['c', 'd', 'f'], era: 'romantic', forms: ['sonata', 'overture', 'fugue'], im: 1.15, ia: .12, da: .12, tempo: 1.1, rub: .9, lead: 'str', tex: { brisk: 'tremolo', lyr: 'syncop' }, flav: 'dark', preset: null , leads: [], bfo: ['cbsn', 'bcl', 'stbn'] },
  dreamy: { name: 'Dreamy', icon: '💭', blurb: 'Floating, half asleep, soft light. Flute, piano and colour chords.', mode: 'M', keys: ['F', 'Ab', 'E'], era: 'impressionist', forms: ['aria', 'waltz', 'canon'], im: .7, ia: 0, da: -.15, tempo: .86, rub: 1.4, lead: 'solo:fl', tex: { brisk: 'arpeggio', lyr: 'sustain' }, flav: 'color', preset: ['vln1', 'vln2', 'vla', 'vc', 'cb', 'fl', 'ob', 'cl', 'hn', 'pno'], soft: 1 , leads: ['fl', 'svn'], bfo: ['vib', 'glock', 'svn'] },
  solemn: { name: 'Solemn', icon: '👑', blurb: 'Ceremony and dignity. Slow, full chords, brass like an organ.', mode: 'M', keys: ['C', 'Bb', 'D'], era: 'baroque', forms: ['fugue', 'march', 'overture'], im: 1, ia: .05, da: .05, tempo: .85, rub: .8, lead: 'str', tex: { brisk: 'continuo', lyr: 'block' }, preset: ['vln1', 'vln2', 'vla', 'vc', 'cb', 'ob', 'bsn', 'hn', 'tpt', 'tbn', 'timp', 'pno'] , leads: [], bfo: ['bells', 'stbn', 'cbsn'] },
};
Y.FEELINGS = FEELINGS;
const SOFT = ['tender', 'melancholy', 'dreamy', 'mysterious'], BOLD = ['heroic', 'joyful', 'stormy', 'solemn'];
Y.feelArc = function (cats, main, combos) { // cats: 'fast' | 'slow' | 'dance' per part
  const n = cats.length, res = new Array(n).fill(null), used = new Set([main]);
  const take = pref => { let f = combos.find(c => !used.has(c) && pref.includes(c)) || combos.find(c => !used.has(c)); if (f) used.add(f); return f; };
  res[0] = main;
  if (n > 1) res[n - 1] = take(BOLD) || (BOLD.includes(main) ? main : combos.find(c => BOLD.includes(c)) || main);
  for (let i = 1; i < n - 1; i++) if (cats[i] === 'slow') res[i] = take(SOFT) || combos.find(c => SOFT.includes(c)) || main;
  for (let i = 1; i < n - 1; i++) if (!res[i]) res[i] = take([]) || main;
  return res;
};

/* ================= the composer ================= */
function Comp(x) {
  this.x = x; this.meter = x.meter; this.bar = PPQ * x.meter; this.t = 0;
  this.phrases = []; this.events = []; this.markers = []; this.themes = {};
  this.mel = []; this.bassLine = []; this.walk = []; this.voices = null; this.secs = [];
}
Comp.prototype.add = function (p) {
  const x = this.x;
  const bars = Array.isArray(p.tpl) ? p.tpl : flavor(p.tpl, p.noFlavor ? 'classical' : x.era, x.r, p.key.m, p.noFlavor ? null : x.feel && x.feel.flav);
  const st = p.stretch || 1;
  const ph = Object.assign({}, p, { tpl: bars, t0: this.t, nb: bars.length * st, ev0: this.events.length, idx: this.phrases.length, uid: 'p' + this.phrases.length });
  bars.forEach((bar, bi) => {
    const durs = splitBar(bar.length, this.meter);
    let t = this.t + bi * this.bar * st;
    bar.forEach((tok, j) => { const ch = parseTok(tok, p.key); const d = Math.round(durs[j] * PPQ * st); this.events.push(mkEv(t, d, ch, p.key, ph)); t += d; });
  });
  ph.ev1 = this.events.length; ph.t1 = this.t + bars.length * this.bar * st;
  this.t = ph.t1; this.phrases.push(ph);
  if (p.label) this.markers.push({ t: ph.t0, text: p.label });
  if (p.sec) { const last = this.secs[this.secs.length - 1]; if (!last || last.label !== p.sec) this.secs.push({ label: p.sec, t0: ph.t0, t1: ph.t1 }); else last.t1 = ph.t1; }
  else if (this.secs.length) this.secs[this.secs.length - 1].t1 = ph.t1;
  return ph;
};
function defTex(x, ch, I) {
  const e = x.era;
  if (ch === 'waltz') return 'oompah';
  if (ch === 'march') return 'march';
  if (e === 'baroque') return 'continuo';
  if (e === 'impressionist') return ch === 'brisk' ? 'arpeggio' : 'sustain';
  if (ch === 'dance') return 'beats';
  if (ch === 'lyr' || ch === 'slow') return e === 'classical' ? (x.tempo < 100 ? 'alberti' : 'block') : (I > .6 ? 'syncop' : 'arpeggio');
  if (e === 'romantic') return I > .72 ? 'tremolo' : 'syncop';
  return 'repeated8';
}
function defBtex(x, ch, I) {
  if (ch === 'waltz') return 'oompah';
  if (ch === 'march') return 'march';
  if (x.era === 'baroque') return 'walk';
  if (ch === 'dance') return 'held';
  if (ch === 'brisk' || ch === 'motor') return x.era === 'classical' ? 'drum8' : I > .7 ? 'beats' : 'held';
  return 'held';
}
function P(c, x, s) {
  const src = s.mel && (s.mel.restate || s.mel.from || s.mel.id);
  const th = src && c.themes[src];
  const ch = (s.mel && s.mel.char) || (th && th.char) || s.char || 'lyr';
  s.char = ch;
  const fe = x.feel;
  if (fe) {
    if (!s._fi) { s.inten = clamp(s.inten * fe.im + fe.ia, .12, 1); s._fi = 1; }
    if (!s._fd) { s.dyn = clamp(s.dyn + fe.da, .12, 1); s._fd = 1; }
    if (!s.tex && !s.poly && x.era !== 'baroque' || (!s.tex && fe.tex && x.era === 'baroque' && fe.tex[ch === 'lyr' || ch === 'slow' ? 'lyr' : 'brisk'] === 'continuo')) { const t = fe.tex[ch === 'lyr' || ch === 'slow' ? 'lyr' : 'brisk']; if (t && ch !== 'waltz' && ch !== 'march') s.tex = t; }
    if (!s.lead && (ch === 'lyr' || ch === 'slow') && !s.final) { const ld = (fe.leads || []).find(i => x.E.has(i)); if (ld) s.lead = 'solo:' + ld; }
  }
  if (!s.tex) s.tex = defTex(x, ch, s.inten);
  if (!s.btex) s.btex = defBtex(x, ch, s.inten);
  if (s.ctr == null) s.ctr = !s.poly && s.inten >= .35 && s.inten <= .85 && x.r() < ERAS[x.era].ctr;
  if (s.mel && s.mel.id && !c.themes[s.mel.id]) c.themes[s.mel.id] = { char: ch };
  return c.add(s);
}
function again(c, x, phs, ov) {
  return phs.map(p => P(c, x, Object.assign({}, p, ov && 'inten' in ov ? { _fi: 0 } : {}, ov && 'dyn' in ov ? { _fd: 0 } : {}, { tpl: p.tpl, label: null, sec: p.sec, mel: p.mel ? { restate: p.uid, orn: ov && ov.orn } : null, ctr: p.ctr }, ov || {}, { mel: p.mel ? { restate: p.uid, orn: ov && ov.orn } : null, noFlavor: true })));
}
function TP(x, name, K, X) {
  let s = pick(x.r, TPLS[name]);
  if (X) s = s.replace('$X', X);
  return s;
}
function finalPh(c, x, K, s) {
  const tok = K.m === 'm' && x.era === 'baroque' ? 'PI' : 'I';
  const soft = x.feel && x.feel.soft && !(s && s.dyn);
  return P(c, x, Object.assign({ key: K, tpl: tok, mel: { type: 'hold' }, inten: soft ? .5 : 1, dyn: soft ? .35 : .85, final: 1, tex: 'block', btex: 'held', sec: 'Coda', ctr: false }, s || {}, soft ? { inten: .5, dyn: .35 } : {}));
}

/* ----- forms ----- */
const F = {};
F.minuet = (c, x) => {
  const K = x.K, KT = K.m === 'M' ? relKey(K, 3, 'M') : relKey(K, 2, 'M');
  const ch = x.scherzo ? 'brisk' : 'dance';
  const g1 = [P(c, x, { key: K, tpl: TP(x, 'ante'), mel: { type: 'ante', id: 'M', char: ch }, inten: .5, dyn: .6, sec: x.scherzo ? 'Scherzo' : 'Minuet', label: x.scherzo ? 'Scherzo' : 'Minuet' }),
    P(c, x, { key: K, tpl: TP(x, 'cons'), mel: { type: 'cons', id: 'M', head: 1 }, inten: .55, dyn: .65, sec: x.scherzo ? 'Scherzo' : 'Minuet' })];
  if (x.len >= 2) again(c, x, g1, { dyn: x.era === 'baroque' ? .4 : .55 });
  const b = P(c, x, { key: K, tpl: TP(x, 'binB'), mel: { type: 'free', from: 'M', cad: 'HC' }, inten: .6, dyn: .55, sec: g1[0].sec });
  const g2 = [b].concat(again(c, x, g1, { dyn: .7, inten: .65 }));
  if (x.len >= 3) again(c, x, g2);
  const t1 = [P(c, x, { key: KT, tpl: TP(x, 'ante'), mel: { type: 'ante', id: 'T', char: 'lyr' }, inten: .3, dyn: .4, lead: 'ww', tex: x.era === 'baroque' ? 'continuo' : 'pizz', btex: 'held', sec: 'Trio', label: 'Trio' }),
    P(c, x, { key: KT, tpl: TP(x, 'cons'), mel: { type: 'cons', id: 'T', head: 1 }, inten: .32, dyn: .42, lead: 'ww', tex: x.era === 'baroque' ? 'continuo' : 'pizz', btex: 'held', sec: 'Trio' })];
  P(c, x, { key: KT, tpl: TP(x, 'binB'), mel: { type: 'free', from: 'T', cad: 'HC' }, inten: .35, dyn: .4, lead: 'ww', sec: 'Trio' });
  again(c, x, t1, { dyn: .45 });
  again(c, x, g1, { sec: g1[0].sec, label: 'Da capo' });
  again(c, x, g2, { inten: .7, dyn: .75 });
  finalPh(c, x, K, { dyn: .75 });
};
F.rondo = (c, x) => {
  const K = x.K, KD = K.m === 'M' ? relKey(K, 4, 'M') : relKey(K, 2, 'M'), KC = K.m === 'M' ? relKey(K, 5, 'm') : relKey(K, 3, 'm');
  const X = K.m === 'M' ? 'V' : 'III';
  const A = [P(c, x, { key: K, tpl: TP(x, 'ante'), mel: { type: 'ante', id: 'R', char: 'brisk' }, inten: .5, dyn: .55, sec: 'A', label: 'Refrain' }),
    P(c, x, { key: K, tpl: TP(x, 'cons'), mel: { type: 'cons', id: 'R', head: 1 }, inten: .55, dyn: .6, sec: 'A' })];
  if (x.len >= 2) again(c, x, A, { inten: .7, dyn: .7, lead: 'tutti' });
  P(c, x, { key: K, tpl: TP(x, 'transA', K, X), mel: { type: 'free', from: 'R' }, inten: .65, dyn: .65, sec: 'B', label: 'Episode B' });
  P(c, x, { key: KD, tpl: TP(x, 'transB'), mel: { type: 'free', from: 'R', cad: 'HC' }, inten: .6, dyn: .6, sec: 'B' });
  P(c, x, { key: KD, tpl: TP(x, 'sent'), mel: { type: 'sent', id: 'RB', char: 'lyr' }, inten: .4, dyn: .45, lead: 'ww', sec: 'B' });
  P(c, x, { key: K, tpl: TP(x, 'retrans'), mel: { type: 'free', from: 'RB', cad: 'HC' }, inten: .5, dyn: .55, btex: 'pedal', pedal: 4, sec: 'B' });
  again(c, x, A, { sec: 'A', label: 'Refrain' });
  const C1 = P(c, x, { key: KC, tpl: TP(x, 'ante'), mel: { type: 'ante', id: 'RC', char: 'brisk' }, inten: .8, dyn: .8, sec: 'C', label: 'Episode C' });
  P(c, x, { key: KC, tpl: TP(x, 'cons'), mel: { type: 'cons', id: 'RC', head: 1 }, inten: .8, dyn: .8, sec: 'C' });
  if (x.len >= 2) P(c, x, { key: KC, tpl: TP(x, 'close'), mel: { type: 'free', from: 'RC' }, inten: .75, dyn: .75, sec: 'C' });
  P(c, x, { key: K, tpl: TP(x, 'retrans'), mel: { type: 'free', from: 'R', cad: 'HC' }, inten: .55, dyn: .5, btex: 'pedal', pedal: 4, sec: 'C' });
  again(c, x, A, { sec: 'A', label: 'Refrain', inten: .75, dyn: .75, lead: 'tutti' });
  P(c, x, { key: K, tpl: TP(x, 'coda'), mel: { type: 'free', from: 'R', cad: 'PAC' }, inten: .9, dyn: .9, sec: 'Coda', label: 'Coda' });
  finalPh(c, x, K);
  void C1;
};
F.sonata = (c, x, opt) => {
  opt = opt || {};
  const K = x.K, maj = K.m === 'M', KD = maj ? relKey(K, 4, 'M') : relKey(K, 2, 'M'), X = maj ? 'V' : 'III';
  const ex = [];
  ex.push(P(c, x, { key: K, tpl: TP(x, 'sent'), mel: { type: 'sent', id: 'P', char: 'brisk' }, inten: .6, dyn: .65, sec: 'Exposition', label: 'Exposition: first theme' }));
  ex.push(P(c, x, { key: K, tpl: TP(x, 'transA', K, X), mel: { type: 'free', from: 'P' }, inten: .78, dyn: .72, sec: 'Exposition', label: 'Transition' }));
  ex.push(P(c, x, { key: KD, tpl: TP(x, 'transB'), mel: { type: 'free', from: 'P', cad: 'HC' }, inten: .75, dyn: .7, sec: 'Exposition' }));
  ex.push(P(c, x, { key: KD, tpl: TP(x, 'ante'), mel: { type: 'ante', id: 'S', char: 'lyr' }, inten: .38, dyn: .42, lead: 'ww', sec: 'Exposition', label: 'Second theme' }));
  ex.push(P(c, x, { key: KD, tpl: TP(x, 'cons'), mel: { type: 'cons', id: 'S', head: 1 }, inten: .42, dyn: .45, lead: 'str', sec: 'Exposition' }));
  ex.push(P(c, x, { key: KD, tpl: TP(x, 'sent'), mel: { type: 'sent', id: 'S2', char: 'brisk' }, inten: .72, dyn: .72, sec: 'Exposition' }));
  ex.push(P(c, x, { key: KD, tpl: TP(x, 'close'), mel: { type: 'close' }, inten: .82, dyn: .8, sec: 'Exposition', label: 'Closing' }));
  if (x.len >= 3 && !opt.noRepeat) again(c, x, ex);
  // development
  const path = maj ? [relKey(K, 5, 'm'), relKey(K, 1, 'm'), relKey(K, 2, 'm'), relKey(K, 3, 'M')] : [relKey(K, 3, 'm'), relKey(K, 6, 'M'), relKey(K, 2, 'M'), relKey(K, 5, 'M')];
  const nBlocks = x.len === 1 ? 2 : x.len === 2 ? 3 : 4;
  const dv = TP(x, 'dev');
  for (let i = 0; i < nBlocks; i++) P(c, x, { key: path[i], tpl: dv + ' | ' + dv, mel: { type: 'free', from: i % 2 ? 'S' : 'P' }, inten: .82 + i * .03, dyn: .7 + i * .05, lead: i % 2 ? 'ww' : 'str', tex: x.era === 'baroque' ? 'continuo' : 'tremolo', sec: 'Development', label: i ? null : 'Development' });
  P(c, x, { key: K, tpl: TP(x, 'retrans'), mel: { type: 'free', from: 'P', cad: 'HC' }, inten: .7, dyn: .6, btex: 'pedal', pedal: 4, sec: 'Development', label: 'Retransition' });
  // recapitulation
  again(c, x, [ex[0]], { sec: 'Recapitulation', label: 'Recapitulation' });
  P(c, x, { key: K, tpl: TP(x, 'transA', K, 'V'), mel: { type: 'free', from: 'P' }, inten: .78, dyn: .72, sec: 'Recapitulation' });
  P(c, x, { key: K, tpl: TP(x, 'stayB'), mel: { type: 'free', from: 'P', cad: 'HC' }, inten: .72, dyn: .7, sec: 'Recapitulation' });
  again(c, x, ex.slice(3), { key: K, sec: 'Recapitulation' });
  P(c, x, { key: K, tpl: TP(x, 'coda'), mel: { type: 'free', from: 'P', cad: 'PAC' }, inten: .92, dyn: .9, sec: 'Coda', label: 'Coda' });
  finalPh(c, x, K);
};
function ornRestate(c, x, phs, orn, ov) { return again(c, x, phs, Object.assign({ orn }, ov)); }
F.variations = (c, x) => {
  const K = x.K, KP = mkKey(K.L, K.t, K.m === 'M' ? 'm' : 'M');
  const tA = TP(x, 'ante'), tC = TP(x, 'cons'), tB = TP(x, 'thB');
  const th = [P(c, x, { key: K, tpl: tA, mel: { type: 'ante', id: 'TH', char: 'lyr' }, inten: .4, dyn: .5, tex: x.era === 'baroque' ? 'continuo' : 'block', sec: 'Theme', label: 'Theme', noFlavor: 1 }),
    P(c, x, { key: K, tpl: tC, mel: { type: 'cons', id: 'TH', head: 1 }, inten: .42, dyn: .5, tex: x.era === 'baroque' ? 'continuo' : 'block', sec: 'Theme', noFlavor: 1 }),
    P(c, x, { key: K, tpl: tB, mel: { type: 'sent', id: 'TB', char: 'lyr' }, inten: .45, dyn: .52, tex: x.era === 'baroque' ? 'continuo' : 'block', sec: 'Theme', noFlavor: 1 })];
  const vars = [];
  vars.push(() => ornRestate(c, x, th, 'fig', { inten: .5, dyn: .55, tex: x.era === 'baroque' ? 'continuo' : 'repeated8', sec: 'Var 1', label: 'Variation 1: ornaments' }));
  vars.push(() => ornRestate(c, x, th, null, { key: KP, inten: .6, dyn: .5, tex: x.era === 'classical' ? 'syncop' : 'tremolo', sec: 'Var 2', label: 'Variation 2: ' + (KP.m === 'm' ? 'minor' : 'major') }));
  vars.push(() => ornRestate(c, x, th, null, { inten: .55, dyn: .55, lead: 'bass', tex: 'arpeggio', btex: 'mel', sec: 'Var 3', label: 'Variation 3: melody in the bass' }));
  vars.push(() => ornRestate(c, x, th, 'dot', { inten: .88, dyn: .85, tex: 'march', btex: 'march', char: 'march', fan: 1, sec: 'Var 4', label: 'Variation 4: march' }));
  vars.push(() => ornRestate(c, x, th, 'turn', { inten: .35, dyn: .35, stretch: 2, lead: 'ww', tex: x.era === 'baroque' ? 'continuo' : 'arpeggio', sec: 'Var 5', label: 'Variation 5: adagio' }));
  const n = x.len === 1 ? [0, 1, 3] : x.len === 2 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
  n.forEach(i => vars[i]());
  ornRestate(c, x, th, 'fig', { inten: .95, dyn: .9, lead: 'tutti', tex: x.era === 'baroque' ? 'continuo' : 'repeated8', sec: 'Finale', label: 'Finale' });
  P(c, x, { key: K, tpl: TP(x, 'coda'), mel: { type: 'free', from: 'TH', cad: 'PAC' }, inten: .95, dyn: .9, sec: 'Finale' });
  finalPh(c, x, K);
};
F.overture = (c, x) => {
  const K = x.K, maj = K.m === 'M', KD = maj ? relKey(K, 4, 'M') : relKey(K, 2, 'M'), X = maj ? 'V' : 'III';
  P(c, x, { key: K, tpl: TP(x, 'intro'), mel: { type: 'free', id: 'IN', char: x.era === 'baroque' ? 'dotted' : 'slow', cad: 'HC' }, inten: .6, dyn: .6, tex: x.era === 'baroque' ? 'continuo' : 'tremolo', btex: 'held', sec: 'Slow', label: 'Slow introduction' });
  if (x.era === 'baroque') { buildFugue(c, x, true); P(c, x, { key: K, tpl: 'IV | Cad | V7 | I', mel: { type: 'free', from: 'IN', cad: 'PAC' }, inten: .8, dyn: .8, char: 'dotted', sec: 'Slow', label: 'Slow close' }); finalPh(c, x, K); return; }
  const A = P(c, x, { key: K, tpl: TP(x, 'sent'), mel: { type: 'sent', id: 'O', char: 'brisk' }, inten: .55, dyn: .5, sec: 'Allegro', label: 'Allegro' });
  P(c, x, { key: K, tpl: TP(x, 'transA', K, X), mel: { type: 'free', from: 'O' }, inten: .75, dyn: .7, sec: 'Allegro' });
  P(c, x, { key: KD, tpl: TP(x, 'transB'), mel: { type: 'free', from: 'O', cad: 'HC' }, inten: .7, dyn: .7, sec: 'Allegro' });
  const S = [P(c, x, { key: KD, tpl: TP(x, 'ante'), mel: { type: 'ante', id: 'OS', char: 'lyr' }, inten: .38, dyn: .4, lead: 'ww', sec: 'Allegro' }),
    P(c, x, { key: KD, tpl: TP(x, 'cons'), mel: { type: 'cons', id: 'OS', head: 1 }, inten: .42, dyn: .45, sec: 'Allegro' })];
  P(c, x, { key: K, tpl: TP(x, 'retrans'), mel: { type: 'free', from: 'O', cad: 'HC' }, inten: .65, dyn: .6, btex: 'pedal', pedal: 4, sec: 'Allegro' });
  again(c, x, [A], { sec: 'Allegro', label: 'Return' });
  if (x.len >= 2) again(c, x, S, { key: K, sec: 'Allegro' });
  const cr = TP(x, 'close');
  const steps = x.len === 1 ? [.4, .7, 1] : [.35, .55, .75, .95];
  steps.forEach((v, i) => P(c, x, { key: K, tpl: cr, mel: i ? { restate: 'crescA' } : { type: 'close', id: 'crescA', char: 'brisk' }, inten: v, dyn: .35 + v * .6, sec: 'Crescendo', label: i ? null : 'Crescendo', noFlavor: 1, tex: x.era === 'romantic' ? 'syncop' : 'repeated8' }));
  P(c, x, { key: K, tpl: TP(x, 'coda'), mel: { type: 'free', from: 'O', cad: 'PAC' }, inten: 1, dyn: .95, sec: 'Crescendo' });
  finalPh(c, x, K, { dyn: .95 });
};
F.march = (c, x) => {
  const K = x.K, KT = K.m === 'M' ? relKey(K, 3, 'M') : relKey(K, 2, 'M');
  P(c, x, { key: K, tpl: 'I | I | V | V', mel: { type: 'fan', id: 'FA', char: 'march', cad: 'HC' }, inten: .85, dyn: .85, lead: 'solo:tpt', fan: 1, sec: 'Intro', label: 'Fanfare' });
  const A = [P(c, x, { key: K, tpl: TPLS.mA[0], mel: { type: 'sent', id: 'MA', char: 'march', cad: 'HC' }, inten: .7, dyn: .75, sec: 'A', label: 'First strain' }),
    P(c, x, { key: K, tpl: TPLS.mB[0], mel: { type: 'sent', id: 'MA2', char: 'march', head: 1, headFrom: 'MA' }, inten: .75, dyn: .78, sec: 'A' })];
  if (x.len >= 2) again(c, x, A, { inten: .85, dyn: .85, fan: 1 });
  const B = [P(c, x, { key: K, tpl: TP(x, 'binB'), mel: { type: 'free', from: 'MA', cad: 'HC' }, inten: .65, dyn: .65, sec: 'B', label: 'Second strain' }),
    P(c, x, { key: K, tpl: TP(x, 'sent'), mel: { type: 'sent', id: 'MB', char: 'march' }, inten: .8, dyn: .8, sec: 'B' })];
  void B;
  const T = [P(c, x, { key: KT, tpl: TP(x, 'ante'), mel: { type: 'ante', id: 'MT', char: 'lyr' }, inten: .45, dyn: .45, lead: x.E.has('hn') && x.era !== 'baroque' ? 'solo:hn' : 'ww', sec: 'Trio', label: 'Trio' }),
    P(c, x, { key: KT, tpl: TP(x, 'cons'), mel: { type: 'cons', id: 'MT', head: 1 }, inten: .5, dyn: .5, sec: 'Trio' })];
  if (x.len >= 3) again(c, x, T, { inten: .8, dyn: .85, lead: 'tutti', fan: 1 });
  again(c, x, A, { inten: .9, dyn: .9, fan: 1, sec: 'A', label: 'Return' });
  P(c, x, { key: K, tpl: 'I | IV | V7 | I', mel: { type: 'close' }, inten: 1, dyn: .95, fan: 1, char: 'march', sec: 'Coda', label: 'Coda' });
  finalPh(c, x, K);
};
F.waltz = (c, x) => {
  const K = x.K, K2 = K.m === 'M' ? relKey(K, 3, 'M') : relKey(K, 2, 'M');
  P(c, x, { key: K, tpl: 'V | V | V7 | V7', mel: { type: 'free', id: 'WI', char: 'waltz', cad: 'HC' }, inten: .4, dyn: .4, btex: 'pedal', pedal: 4, sec: 'Intro', label: 'Introduction' });
  const W1 = [P(c, x, { key: K, tpl: TP(x, 'wz1'), mel: { type: 'sent', id: 'W1', char: 'waltz', cad: 'IAC' }, inten: .5, dyn: .55, sec: 'Waltz 1', label: 'Waltz 1' }),
    P(c, x, { key: K, tpl: TP(x, 'wz2'), mel: { type: 'sent', id: 'W1b', head: 1, headFrom: 'W1' }, inten: .6, dyn: .62, sec: 'Waltz 1' })];
  if (x.len >= 2) again(c, x, W1, { inten: .72, dyn: .7 });
  const W2 = [P(c, x, { key: K2, tpl: TP(x, 'wz1'), mel: { type: 'sent', id: 'W2', char: 'waltz', cad: 'IAC' }, inten: .45, dyn: .45, lead: 'ww', sec: 'Waltz 2', label: 'Waltz 2' }),
    P(c, x, { key: K2, tpl: TP(x, 'wz2'), mel: { type: 'sent', id: 'W2b', head: 1, headFrom: 'W2' }, inten: .55, dyn: .55, sec: 'Waltz 2' })];
  if (x.len >= 3) again(c, x, W2, { inten: .7, dyn: .7 });
  again(c, x, W1, { inten: .8, dyn: .8, sec: 'Waltz 1', label: 'Waltz 1 again' });
  P(c, x, { key: K, tpl: 'I | I | IV | IV | Cad | Cad | V7 | V7', mel: { type: 'free', from: 'W1', cad: 'HC' }, inten: .9, dyn: .9, sec: 'Coda', label: 'Coda' });
  P(c, x, { key: K, tpl: 'I | IV | I | V7', mel: { type: 'close' }, inten: 1, dyn: .95, sec: 'Coda' });
  finalPh(c, x, K);
};
F.aria = (c, x) => {
  const K = x.K, KB = K.m === 'M' ? relKey(K, 5, 'm') : relKey(K, 2, 'M');
  const solos = ['svn', 'svc', 'eh', 'shn', 'ob', 'cl', 'fl', 'vc', 'hn'].filter(i => x.E.has(i));
  const solo = x.solo && x.E.has(x.solo) ? x.solo : solos.length ? pick(x.r, solos) : 'vln1';
  const tex = x.era === 'baroque' ? 'continuo' : x.era === 'classical' ? 'alberti' : 'arpeggio';
  const R = P(c, x, { key: K, tpl: TP(x, 'close'), mel: { type: 'close', id: 'RIT', char: 'lyr' }, inten: .45, dyn: .45, tex, sec: 'Ritornello', label: 'Ritornello' });
  const A = [P(c, x, { key: K, tpl: TP(x, 'ante'), mel: { type: 'ante', id: 'AR', char: 'lyr' }, inten: .3, dyn: .45, lead: 'solo:' + solo, tex, sec: 'A', label: 'Aria' }),
    P(c, x, { key: K, tpl: TP(x, 'cons'), mel: { type: 'cons', id: 'AR', head: 1 }, inten: .32, dyn: .48, lead: 'solo:' + solo, tex, sec: 'A' }),
    P(c, x, { key: K, tpl: TPLS.ariaB[0], mel: { type: 'sent', id: 'AR2', char: 'lyr' }, inten: .4, dyn: .52, lead: 'solo:' + solo, tex, sec: 'A' })];
  again(c, x, [R], { sec: 'Ritornello' });
  P(c, x, { key: KB, tpl: TP(x, 'ante'), mel: { type: 'ante', id: 'AB', char: 'lyr' }, inten: .35, dyn: .4, lead: 'solo:' + solo, tex: x.era === 'baroque' ? 'continuo' : 'syncop', sec: 'B', label: 'Middle section' });
  P(c, x, { key: KB, tpl: TP(x, 'cons'), mel: { type: 'cons', id: 'AB', head: 1 }, inten: .4, dyn: .45, lead: 'solo:' + solo, tex: x.era === 'baroque' ? 'continuo' : 'syncop', sec: 'B' });
  P(c, x, { key: K, tpl: 'V | V7', mel: { type: 'free', from: 'AB', cad: 'HC' }, inten: .3, dyn: .35, lead: 'solo:' + solo, sec: 'B' });
  again(c, x, [R], { sec: 'A', label: 'Da capo' });
  ornRestate(c, x, A.slice(0, 2), 'turn', { sec: 'A' });
  if (x.len >= 2) ornRestate(c, x, A.slice(2), 'turn', { sec: 'A' });
  P(c, x, { key: K, tpl: 'Cad | V7 | I', mel: { type: 'cadenza' }, inten: .2, dyn: .5, lead: 'solo:' + solo, tex: 'block', cadenza: 1, sec: 'A', label: 'Cadenza' });
  again(c, x, [R], { sec: 'Ritornello' });
  finalPh(c, x, K, { inten: .5, dyn: .45 });
};
F.canon = (c, x) => buildCanon(c, x);
F.fugue = (c, x) => buildFugue(c, x, false);

/* ----- canon over a ground ----- */
function buildCanon(c, x) {
  const K = x.K, r = x.r, g = pick(r, GROUNDS[K.m]);
  const N = [8, 12, 16][x.len - 1];
  c.voices = { V1: [], V2: [], V3: [], B: [] }; c.vorder = ['V1', 'V2', 'V3', 'B'];
  const V = c.voices, RG = [60, 84, 72];
  const phs = [];
  for (let k = 0; k < N + 2; k++) {
    const p = Math.min(1, k / (N * .7));
    phs.push(P(c, x, { key: K, tpl: g, poly: 1, inten: .3 + .55 * Math.sin(Math.PI * Math.min(1, (k + 1) / (N + 2))), dyn: .35 + .5 * Math.sin(Math.PI * p * .9), sec: k === 0 ? 'Ground' : k === 1 ? 'Voice II' : k === 2 ? 'Voice III' : k < N ? 'Canon' : 'Close', label: k === 0 ? 'Ground and first voice' : k === 1 ? 'Second voice' : k === 2 ? 'Third voice' : null, btex: k > 2 && k < N ? 'beats' : 'held', noFlavor: 1 }));
  }
  const fin = finalPh(c, x, K, { poly: 1, inten: .7, dyn: .6, tpl: K.m === 'm' ? 'PI' : 'I' });
  // ground bass
  const ev0 = c.events.slice(phs[0].ev0, phs[0].ev1);
  const bsk = ev0.map(e => ({ t: e.t, dur: e.dur, ev: e, strong: true, goal: new Set([e.bass]) }));
  const gb = line(bsk, { lo: 38, hi: 55, center: 46, r, noise: .5 });
  phs.forEach(ph => gb.forEach(n => V.B.push({ t: n.t - phs[0].t0 + ph.t0, dur: n.dur, m: n.m, D: n.D })));
  const fe = c.events[fin.ev0];
  V.B.push({ t: fe.t, dur: fe.dur, m: gb[0].m, D: gb[0].D });
  const act = k => { const q = k / N; return q < .15 ? 'h' : q < .35 ? 'q' : q < .55 ? 'e' : q < .8 ? 's' : q < .92 ? 'e' : 'q'; };
  const RHC = { h: [[2, 2], [3, 1], [2, 1, 1]], q: [[1, 1, 1, 1], [1, .5, .5, 1, 1], [2, 1, 1], [1.5, .5, 1, 1]], e: [[.5, .5, .5, .5, 1, 1], [1, .5, .5, .5, .5, 1], [.5, .5, 1, .5, .5, 1]], s: [[.25, .25, .25, .25, .5, .5, .5, .5, 1], [.5, .25, .25, .5, .25, .25, .5, .5, 1], [.25, .25, .25, .25, .25, .25, .25, .25, .5, .5, 1]] };
  const segs = [];
  const place = (seg, voice, ph) => seg.forEach(n => V[voice].push({ t: n.rt + ph.t0, dur: n.dur, m: n.m, D: n.D }));
  const gen = (ph, kind, voice, lastV) => {
    const sk = [];
    for (let b = 0; b < 2; b++) {
      const rh = pick(r, RHC[kind]), st = contour(rh.length, r, pick(r, ['arch', 'down', 'nb', 'up', 'leap']), x.era);
      let t = ph.t0 + b * c.bar;
      rh.forEach((d, j) => { const tt = t; sk.push({ t: tt, dur: d * PPQ, want: j ? st[j - 1] : null, ev: evAt(c.events, tt), strong: (tt - ph.t0) % (2 * PPQ) === 0 }); t += d * PPQ; });
    }
    const prev = lastV[lastV.length - 1];
    const others = c.vorder.filter(v => v !== voice).map(v => V[v]);
    const out = line(sk, { lo: RG[0], hi: RG[1], center: RG[2], half: 8, prevD: prev ? prev.D : null, prevM: prev ? prev.m : null, prevT: prev ? prev.t : null, start: 72, fixed: others, r, noise: 1.2, uni: 14, width: 20 });
    minorFix(out, c.events, others);
    return out.map(n => ({ rt: n.t - ph.t0, dur: n.dur, m: n.m, D: n.D }));
  };
  for (let k = 0; k < N + 2; k++) {
    const ph = phs[k];
    if (k >= 1 && k - 1 < N) place(segs[k - 1], 'V2', ph);
    if (k >= 2 && k - 2 < N) place(segs[k - 2], 'V3', ph);
    if (k < N) { const s = gen(ph, act(k), 'V1', V.V1); segs.push(s); place(s, 'V1', ph); }
    else { const s = gen(ph, 'q', 'V1', V.V1); place(s, 'V1', ph); if (k === N + 1) { const s2 = gen(ph, 'h', 'V2', V.V2); place(s2, 'V2', ph); } }
  }
  // final chord
  const tonic = K.t, third = mod(K.t + 4, 12), fifth = mod(K.t + 7, 12);
  [['V1', tonic, 76], ['V2', third, 69], ['V3', fifth, 64]].forEach(([v, pc, near]) => {
    let best = near, bd = 99; for (let m = near - 7; m <= near + 7; m++) if (mod(m, 12) === pc && Math.abs(m - near) < bd) { bd = Math.abs(m - near); best = m; }
    V[v].push({ t: fe.t, dur: fe.dur, m: best, D: mToD(best) });
  });
}

/* ----- fugue ----- */
function buildFugue(c, x, short) {
  const K = x.K, r = x.r, mo = K.m;
  const KD = relKey(K, 4, mo), KR = mo === 'M' ? relKey(K, 5, 'm') : relKey(K, 2, 'M'), KS = relKey(K, 3, mo);
  const RG = { S: [62, 84, 74], A: [55, 77, 66], T: [48, 69, 58], B: [36, 60, 47] };
  c.voices = c.voices || { S: [], A: [], T: [], B: [] }; c.vorder = ['S', 'A', 'T', 'B'];
  const V = c.voices;
  const order = pick(r, [['A', 'S', 'T', 'B'], ['T', 'A', 'S', 'B'], ['S', 'A', 'T', 'B']]);
  const SUBJ = 'I | V7 I';
  const plan = [];
  const ph = (key, tpl, roles, s) => plan.push({ key, tpl, roles, s: s || {} });
  ph(K, SUBJ, { [order[0]]: 'subj' }, { label: 'Fugue: subject', sec: 'Exposition', inten: .4, dyn: .5 });
  ph(KD, SUBJ, { [order[1]]: 'subj', [order[0]]: 'cs' }, { label: 'Answer', sec: 'Exposition', inten: .45, dyn: .55 });
  ph(K, SUBJ, { [order[2]]: 'subj', [order[1]]: 'cs', [order[0]]: 'free' }, { sec: 'Exposition', inten: .5, dyn: .6 });
  ph(KD, SUBJ, { [order[3]]: 'subj', [order[2]]: 'cs', [order[1]]: 'free', [order[0]]: 'free' }, { sec: 'Exposition', inten: .55, dyn: .65 });
  const all = (s, cs, head) => { const o = {}; ['S', 'A', 'T', 'B'].forEach(v => o[v] = v === s ? 'subj' : v === cs ? 'cs' : v === head ? 'head' : v === 'B' ? 'bass' : 'free'); return o; };
  ph(KR, 'iii vi | ii V7', all(null, null, 'S'), { label: 'Episode', sec: 'Episodes', inten: .5, dyn: .55 });
  ph(KR, SUBJ, all('S', 'A'), { label: 'Middle entry', sec: 'Middle entries', inten: .55, dyn: .6 });
  if (!short) {
    if (x.len >= 2) ph(relKey(KR, 4, KR.m), SUBJ, all('T', 'S'), { sec: 'Middle entries', inten: .55, dyn: .6 });
    ph(KS, 'iii vi | ii V7', all(null, null, 'A'), { sec: 'Episodes', inten: .55, dyn: .6 });
    ph(KS, SUBJ, all('B', 'T'), { sec: 'Middle entries', inten: .6, dyn: .65 });
    if (x.len >= 3) { ph(K, 'vi ii | V I | IV viio | iii V7', all(null, null, 'S'), { sec: 'Episodes', inten: .6, dyn: .65 }); ph(KD, SUBJ, all('A', 'S'), { sec: 'Middle entries', inten: .65, dyn: .7 }); }
  }
  ph(K, 'iii vi | ii V7', all(null, null, 'T'), { sec: 'Episodes', inten: .65, dyn: .7 });
  ph(K, SUBJ, all('B', 'S'), { label: 'Final entries', sec: 'Final', inten: .8, dyn: .8 });
  if (!short) ph(K, 'Cad | V7 I', Object.assign(all('S', 'A'), { B: 'pedal' }), { label: 'Dominant pedal', sec: 'Final', inten: .85, dyn: .85 });
  ph(K, mo === 'm' ? 'iv V7 | PI' : 'IV V7 | I', all(), { sec: 'Final', inten: .95, dyn: .9, final: 1 });

  const HEADRH = [[1, 1, 1, 1], [1.5, .5, 1, 1], [1, .5, .5, 1, 1], [2, 1, 1], [.5, .5, 1, 1, 1]];
  const TAILRH = [[.5, .5, .5, .5, .5, .5, 1], [.25, .25, .25, .25, .5, .5, .5, .5, 1], [.5, .5, .25, .25, .25, .25, 1, 1], [.5, .25, .25, .5, .5, .5, .5, 1]];
  let subj = null, cs = null, csRel = null;
  const sk1 = (t0, rh, wants, evs) => { const sk = []; let t = t0; rh.forEach((d, j) => { const tt = t; sk.push({ t: tt, dur: Math.round(d * PPQ), want: wants ? wants[j] : null, ev: evAt(evs, tt), strong: (tt % (2 * PPQ)) === 0 || evAt(evs, tt).t === tt }); t += d * PPQ; }); return sk; };
  const freeRh = (bars) => { const rh = []; for (let b = 0; b < bars * 4;) { const q = r(); if (b % 2 === 0 && q < .12) { rh.push(2); b += 2; } else if (q < .45) { rh.push(1); b++; } else if (q < .9) { rh.push(.5, .5); b++; } else { rh.push(.25, .25, .5); b++; } } return rh; };
  const rest = (v, t0, t1) => {};
  const restateLine = (notes, K0, key, v, t0, refBase, against) => {
    const base = tonicD(key, RG[v][2]);
    let shift = base - refBase;
    const mk = s => notes.map(n => { const t = n.rt + t0, D = n.D + s, ev = evAt(c.events, t); return { t, dur: n.dur, D, m: natMidi(D) + ev.alt[mod(D, 7)] }; });
    const score = s => {
      const L = mk(s); let k = 0;
      L.forEach((n, i) => { if (n.m < RG[v][0] - 1 || n.m > RG[v][1] + 1) k += 10; const pv = i ? L[i - 1] : V[v][V[v].length - 1]; if (pv && against) against.forEach(F => { if (parHit(pv.m, n.m, F, n.t)) k += 6; }); });
      return k;
    };
    let best = shift, bf = 1e9;
    [shift, shift - 7, shift + 7].forEach(s => { const f = score(s); if (f < bf) { bf = f; best = s; } });
    return mk(best);
  };
  plan.forEach((p, pi) => {
    const s = Object.assign({ key: p.key, tpl: p.tpl, poly: 1, noFlavor: !!p.s.final }, p.s);
    const P0 = P(c, x, s);
    const t0 = P0.t0, nb = P0.nb, evs = c.events;
    const done = {};
    const push = (v, notes) => { notes.forEach(n => V[v].push({ t: n.t, dur: n.dur, m: n.m, D: n.D })); done[v] = 1; };
    const vs = ['S', 'A', 'T', 'B'];
    const prevOf = v => V[v][V[v].length - 1];
    // subject and countersubject
    for (const v of vs) {
      if (p.roles[v] !== 'subj') continue;
      if (!subj) {
        const rh = pick(r, HEADRH).concat(pick(r, TAILRH));
        const nh = rh.length;
        const w = [null].concat(contour(nh, r, 'leap', x.era).slice(0, 3)).concat(new Array(nh).fill(-1)).slice(0, nh);
        const sk = sk1(t0, rh, w, evs);
        sk[0].goal = new Set([p.key.t, dpc(p.key, 4)]);
        sk[sk.length - 1].goal = new Set([p.key.t, dpc(p.key, 2)]);
        const out = line(sk, { lo: RG[v][0], hi: RG[v][1], center: RG[v][2], r, noise: 1.5, wm: 3 });
        minorFix(out, evs, vs.filter(u => done[u] && u !== v).map(u => V[u]));
        subj = { notes: out.map(n => ({ rt: n.t - t0, dur: n.dur, D: n.D })), base: tonicD(p.key, RG[v][2]) };
        push(v, out);
      } else push(v, restateLine(subj.notes, null, p.key, v, t0, subj.base, vs.filter(u => u !== v && V[u].length).map(u => V[u])));
    }
    for (const v of vs) {
      if (p.roles[v] !== 'cs') continue;
      const sv = vs.find(u => p.roles[u] === 'subj');
      if (!cs) {
        const S = V[sv]; const rh = [];
        for (let b = 0; b < 8; b++) { const bt = t0 + b * PPQ; const k = S.filter(n => n.t >= bt && n.t < bt + PPQ).length; rh.push(...(k >= 2 ? [1] : [.5, .5])); }
        const sk = sk1(t0, rh, null, evs);
        const pv = prevOf(v);
        const out = line(sk, { lo: RG[v][0], hi: RG[v][1], center: RG[v][2], prevD: pv ? pv.D : null, prevM: pv ? pv.m : null, prevT: pv ? pv.t : null, fixed: [S], above: vs.indexOf(v) > vs.indexOf(sv) ? [S] : null, below: vs.indexOf(v) < vs.indexOf(sv) ? [S] : null, contra: S, r, noise: 1, uni: 12 });
        minorFix(out, evs, vs.filter(u => done[u] && u !== v).map(u => V[u]));
        cs = { notes: out.map(n => ({ rt: n.t - t0, dur: n.dur, D: n.D })), base: tonicD(p.key, RG[v][2]) };
        push(v, out);
      } else push(v, restateLine(cs.notes, null, p.key, v, t0, cs.base, vs.filter(u => done[u]).map(u => V[u])));
    }
    if (p.roles.B === 'pedal') {
      const pc = dpc(p.key, 4); let m = 43; while (mod(m, 12) !== pc) m++;
      if (m > 50) m -= 12;
      const notes = []; for (let b = 0; b < nb; b++) notes.push({ t: t0 + b * c.bar, dur: c.bar, m, D: mToD(m) });
      push('B', notes);
    }
    if (p.roles.B === 'bass' || (p.roles.B === 'free' && pi > 3)) {
      const rh = []; for (let b = 0; b < nb * 4; b++) rh.push(...(r() < .5 ? [1] : [.5, .5]));
      const sk = sk1(t0, rh, null, evs);
      sk.forEach(n => { if (n.ev.t === n.t) n.goal = new Set([n.ev.bass]); });
      const pv = prevOf('B');
      const fixed = vs.filter(u => done[u]).map(u => V[u]);
      const out = line(sk, { lo: RG.B[0], hi: RG.B[1], center: RG.B[2], prevD: pv ? pv.D : null, prevM: pv ? pv.m : null, prevT: pv ? pv.t : null, fixed, above: fixed, r, noise: .8 });
      push('B', out);
    }
    for (const v of vs) {
      const role = p.roles[v];
      if (done[v] || !role || role === 'rest') continue;
      let sk;
      if (role === 'head') {
        const hn = subj.notes.filter(n => n.rt < 4 * PPQ);
        const rh = [], w = [];
        for (let b = 0; b < nb; b++) hn.forEach((n, j) => { rh.push(n.dur / PPQ); w.push(j ? hn[j].D - hn[j - 1].D : (b ? -1 - (hn[hn.length - 1].D - hn[0].D) : null)); });
        sk = sk1(t0, rh, w, evs);
      } else sk = sk1(t0, freeRh(nb), null, evs);
      const pv = prevOf(v);
      const fixed = vs.filter(u => done[u]).map(u => V[u]);
      const above = vs.filter(u => done[u] && vs.indexOf(u) > vs.indexOf(v)).map(u => V[u]);
      const below = vs.filter(u => done[u] && vs.indexOf(u) < vs.indexOf(v)).map(u => V[u]);
      const out = line(sk, { lo: RG[v][0], hi: RG[v][1], center: RG[v][2], prevD: pv ? pv.D : null, prevM: pv ? pv.m : null, prevT: pv ? pv.t : null, fixed, above, below, r, noise: 1, wm: role === 'head' ? 3 : 2.5, uni: 12 });
      minorFix(out, evs, vs.filter(u => done[u] && u !== v).map(u => V[u]));
      push(v, out);
    }
    if (p.s.final) { // last chord: hold the final tonic triad
      const fe = evs[P0.ev1 - 1];
      ['S', 'A', 'T', 'B'].forEach(v => { const L = V[v]; for (let i = L.length - 1; i >= 0 && L[i].t >= fe.t; i--) L.splice(i, 1); });
      const pcs = [...fe.pcs]; const want = { S: fe.ch.root, A: pcs[1], T: pcs[2], B: fe.ch.root };
      const placed = [];
      ['S', 'B', 'A', 'T'].forEach(v => { const pv = prevOf(v); const near = pv ? pv.m : RG[v][2]; const cs = []; for (let m = RG[v][0]; m <= RG[v][1]; m++) if (mod(m, 12) === want[v] || (v !== 'S' && v !== 'B' && pcs.includes(mod(m, 12)))) cs.push(m); cs.sort((a, b) => (Math.abs(a - near) + (mod(a, 12) === want[v] ? 0 : 3)) - (Math.abs(b - near) + (mod(b, 12) === want[v] ? 0 : 3)));
        let best = cs[0]; for (const m of cs) { if (!placed.some(u => { const L = V[u]; const a = L[L.length - 1]; const b1 = sounding(L, fe.t - 1); return pv && b1 != null && pv.m !== m && b1 !== a.m && Math.sign(m - pv.m) === Math.sign(a.m - b1) && Math.abs(m - a.m) % 12 === Math.abs(pv.m - b1) % 12 && [0, 7].includes(Math.abs(m - a.m) % 12); })) { best = m; break; } }
        V[v].push({ t: fe.t, dur: fe.dur, m: best, D: mToD(best) }); placed.push(v); });
    }
    void rest;
  });
}

/* ================= melody ================= */
function rolesFor(type, nb, cad) {
  const end8 = cad === 'HC' ? 'H8' : 'K8';
  if (type === 'sent') return nb >= 8 ? ['A', 'B', 'A', 'B', 'F', 'F', 'K7', end8] : ['A', 'A', 'K7', end8];
  if (type === 'ante') return ['A', 'B', 'C', 'H8'];
  if (type === 'cons') return ['A', 'B', 'K7', 'K8'];
  if (type === 'close') { const r = []; for (let i = 0; i < nb; i += 2) r.push('K7', 'K8'); return r.slice(0, nb); }
  if (type === 'hold') return new Array(nb).fill('HOLD');
  if (type === 'fan') { const r = new Array(nb).fill('FA'); r[nb - 1] = cad === 'HC' ? 'H8' : 'K8'; return r; }
  if (type === 'cadenza') return ['CZ', 'K7', 'K8'];
  // free
  const r = new Array(nb).fill('F');
  if (cad === 'HC') r[nb - 1] = 'H8';
  if (cad === 'PAC' && nb >= 2) { r[nb - 2] = 'K7'; r[nb - 1] = 'K8'; }
  if (cad === 'IAC') r[nb - 1] = 'K8';
  return r;
}
function getTheme(c, id, ch, r) {
  const x = c.x; let th = c.themes[id];
  if (!th) th = c.themes[id] = { char: ch };
  if (!th.A) {
    th.char = th.char || ch;
    const ch2 = th.char;
    const pool = rhPool(c.meter, ch2, x.era);
    const calm = rhPool(c.meter, ch2 === 'brisk' || ch2 === 'motor' || ch2 === 'march' ? (ch2 === 'march' ? 'march' : 'lyr') : ch2 === 'lyr' ? 'slow' : ch2, x.era);
    const A = pick(r, pool);
    let B = pick(r, A.length >= 4 ? calm : pool); if (B === A) B = pick(r, calm);
    const C = pick(r, pool);
    const ka = ch2 === 'march' ? pick(r, ['arp', 'leap', 'up']) : pick(r, ['leap', 'arch', 'nb', 'up', 'arch']);
    th.A = { rh: A, st: contour(A.length, r, ka, x.era) };
    th.B = { rh: B, st: contour(B.length, r, pick(r, ['down', 'arch', 'down', 'nb']), x.era) };
    th.C = { rh: C, st: contour(C.length, r, pick(r, ['up', 'arch', 'nb', 'leap']), x.era) };
  }
  return th;
}
function halfCell(cell, meter) {
  if (meter !== 4) return null;
  let acc = 0, k = -1;
  for (let i = 0; i < cell.rh.length; i++) { acc += cell.rh[i]; if (Math.abs(acc - 2) < 1e-6) { k = i + 1; break; } if (acc > 2) break; }
  if (k < 1) return null;
  return { rh: cell.rh.slice(0, k), st: cell.st.slice(0, k - 1) };
}
function planMel(c, ph, r) {
  const sp = ph.mel, K = ph.key, meter = c.meter, sc = ph.stretch || 1, BAR = c.bar * sc;
  const th = getTheme(c, sp.from || sp.id || ph.uid, ph.char, r);
  const roles = rolesFor(sp.type || 'free', ph.tpl.length, sp.cad);
  const g1 = new Set([dpc(K, 0)]), g3 = new Set([dpc(K, 2)]), g27 = new Set([dpc(K, 1), mod(K.t + 11, 12)]), gH = new Set([dpc(K, 1), dpc(K, 4), mod(K.t + 11, 12)]);
  const seq = r() < .6 ? -1 : 1;
  const sk = [];
  let prevSum = 0;
  roles.forEach((role, bi) => {
    const tb = ph.t0 + bi * BAR;
    let cell, gF = null, gL = null, lead = null, orn = null;
    switch (role) {
      case 'A': cell = th.A; break;
      case 'B': cell = th.B; break;
      case 'C': cell = th.C; break;
      case 'F': {
        const h = halfCell(th.A, meter);
        if (h) cell = { rh: h.rh.concat(h.rh), st: h.st.concat([seq - sum(h.st)], h.st) };
        else cell = th.A;
        lead = bi ? seq - prevSum : null;
        if (h) lead = bi ? seq - sum(h.st) - (seq - sum(h.st)) + seq - prevSum : null;
        break;
      }
      case 'K7': { const rh = pick(r, K7RH[meter]); cell = { rh, st: rh.slice(1).map(() => -1) }; gL = g27; if (ERAS[c.x.era].trill && rh[rh.length - 1] >= 1 && (sp.type === 'cons' || sp.type === 'sent' || sp.cad === 'PAC')) orn = rh.length - 1; break; }
      case 'K8': cell = { rh: [2], st: [] }; gF = sp.cad === 'IAC' ? g3 : g1; lead = -1; break;
      case 'H8': cell = { rh: [meter === 3 ? 2 : 3], st: [] }; gF = gH; break;
      case 'HOLD': cell = { rh: [meter], st: [] }; gF = g1; break;
      case 'FA': { const rh = pick(r, RH[4].march); cell = { rh, st: contour(rh.length, r, 'arp') }; break; }
      case 'CZ': { const rh = new Array(meter * 4).fill(.25); cell = { rh, st: rh.slice(1).map((_, i) => (i < meter * 2 ? 1 : -1)) }; break; }
    }
    let t = tb;
    cell.rh.forEach((d, j) => {
      const n = { t, dur: Math.round(d * PPQ * sc), want: j === 0 ? lead : cell.st[j - 1] };
      if (j === 0 && gF) n.goal = gF;
      if (j === cell.rh.length - 1 && gL) n.goal = gL;
      if (orn === j) n.orn = 'tr';
      sk.push(n); t += Math.round(d * PPQ * sc);
    });
    prevSum = sum(cell.st);
  });
  return sk;
}
function markStrong(c, ph, sk) {
  const sc = ph.stretch || 1, BAR = c.bar * sc;
  sk.forEach(n => {
    n.ev = evAt(c.events, n.t);
    const pos = (n.t - ph.t0) % BAR;
    n.strong = pos === 0 || (c.meter === 4 && pos === 2 * PPQ * sc) || n.ev.t === n.t;
  });
}
function storeTheme(c, id, ph, notes, sc) {
  const base = tonicD(ph.key, c.style.melC);
  const th = c.themes[id] = c.themes[id] || {};
  th.notes = notes.map(n => ({ rt: n.t - ph.t0, dur: n.dur, Dr: n.D - base, orn: n.orn }));
  th.sc = sc || 1; th.K = ph.key; th.char = th.char || ph.char;
}
function restateNotes(c, ph, th, limitRt) {
  const sc = (ph.stretch || 1) / (th.sc || 1), st = c.style;
  let base = tonicD(ph.key, st.melC);
  const src = th.notes.filter(n => limitRt == null || n.rt < limitRt);
  const avg = src.reduce((a, n) => a + natMidi(n.Dr + base), 0) / Math.max(1, src.length);
  if (avg - st.melC > 5) base -= 7; else if (st.melC - avg > 6) base += 7;
  return src.map(n => {
    const t = ph.t0 + Math.round(n.rt * sc), D = n.Dr + base, ev = evAt(c.events, t);
    return { t, dur: Math.round(n.dur * sc), D, m: natMidi(D) + ev.alt[mod(D, 7)], orn: n.orn };
  });
}
function ornament(c, notes, orn) {
  if (!orn) return notes;
  const out = [];
  const mk = (t, dur, D) => { const ev = evAt(c.events, t); return { t, dur, D, m: natMidi(D) + ev.alt[mod(D, 7)] }; };
  notes.forEach((n, i) => {
    const nx = notes[i + 1], dir = nx ? Math.sign(nx.D - n.D) || 1 : -1;
    if (orn === 'fig' && n.dur >= PPQ && !n.orn) {
      const s = PPQ / 4; const k = Math.floor(n.dur / s);
      const pat = dir > 0 ? [0, -1, 0, 1] : [0, 1, 0, -1];
      for (let j = 0; j < k; j++) out.push(mk(n.t + j * s, s, n.D + pat[j % 4] + (j >= 4 && j % 4 === 0 ? 0 : 0)));
      return;
    }
    if (orn === 'fig' && n.dur === PPQ / 2 && nx && Math.abs(nx.D - n.D) === 2) { out.push(mk(n.t, PPQ / 4, n.D)); out.push(mk(n.t + PPQ / 4, PPQ / 4, n.D + dir)); return; }
    if (orn === 'dot' && nx && n.dur === nx.dur && (n.dur === PPQ / 2 || n.dur === PPQ) && nx.t === n.t + n.dur && (n.t % (2 * n.dur)) === 0) {
      out.push(Object.assign({}, n, { dur: n.dur * 1.5 })); nx._dot = n.dur; return;
    }
    if (n._dot) { out.push(Object.assign({}, n, { t: n.t + n._dot / 2, dur: n.dur - n._dot / 2 })); return; }
    if (orn === 'turn' && n.dur >= 2 * PPQ && !n.orn) {
      const s = PPQ / 4, keep = n.dur - PPQ;
      out.push(Object.assign({}, n, { dur: keep }));
      [1, 0, -1, 0].forEach((d, j) => out.push(mk(n.t + keep + j * s, s, n.D + d)));
      return;
    }
    out.push(n);
  });
  return out;
}
function melArt(c, ph, notes) {
  const fast = c.x.tempo >= 96, ch = ph.char;
  const det = ch === 'brisk' || ch === 'motor' || ch === 'march' || ch === 'dance' || c.x.era === 'baroque';
  notes.forEach((n, i) => {
    n.art = 'long';
    if (!det || !fast) return;
    if (n.dur <= PPQ / 2) {
      let k = 1, j = i; while (j > 0 && notes[j - 1].dur <= PPQ / 2 && notes[j - 1].t + notes[j - 1].dur === notes[j].t) { j--; k++; }
      j = i; while (j + 1 < notes.length && notes[j + 1].dur <= PPQ / 2 && notes[j].t + notes[j].dur === notes[j + 1].t) { j++; k++; }
      if (k >= 3 || ch === 'march') n.art = 'short';
    }
  });
}
function genMel(c) {
  const x = c.x, st = c.style;
  let last = null;
  for (const ph of c.phrases) {
    if (ph.poly || !ph.mel) continue;
    const sp = ph.mel, r = mkRng(x.seed * 31 + ph.idx * 977 + 5);
    let notes;
    if (sp.restate) {
      const th = c.themes[sp.restate];
      notes = th && th.notes ? restateNotes(c, ph, th) : [];
      notes = ornament(c, notes, sp.orn);
    } else {
      let sk = planMel(c, ph, r);
      markStrong(c, ph, sk);
      let head = [];
      if (sp.head) {
        const src = c.themes[sp.headFrom || sp.id];
        if (src && src.notes) {
          const half = Math.floor(ph.tpl.length / 2) * c.bar * (ph.stretch || 1);
          head = restateNotes(c, ph, src, half);
          sk = sk.filter(n => n.t >= ph.t0 + half);
        }
      }
      const pv = head.length ? head[head.length - 1] : last;
      const o = { lo: st.melLo, hi: st.melHi, center: st.melC, half: 8, prevD: pv ? pv.D : null, prevM: pv ? pv.m : null, prevT: pv ? pv.t : null, start: st.melC, fixed: [c.bassCheck], r, noise: 1.1, wm: 2.6, appog: st.appog && ph.char === 'lyr', avoid: st.avoid };
      if (sp.type === 'cadenza') { o.wm = 4; }
      notes = head.concat(sk.length ? line(sk, o) : []);
      if (sp.id && !sp.head && !(c.themes[sp.id] && c.themes[sp.id].notes)) storeTheme(c, sp.id, ph, notes, ph.stretch);
      if (sp.head && sp.id && sp.headFrom && !(c.themes[sp.id] && c.themes[sp.id].notes)) storeTheme(c, sp.id, ph, notes, ph.stretch);
    }
    minorFix(notes, c.events, [c.bassCheck]);
    melArt(c, ph, notes);
    notes.forEach(n => { n.ph = ph; });
    storeTheme(c, ph.uid, ph, notes, ph.stretch);
    c.mel.push(...notes);
    if (notes.length) last = notes[notes.length - 1];
  }
  c.mel.sort((a, b) => a.t - b.t);
  // keep the line monophonic
  for (let i = 0; i + 1 < c.mel.length; i++) if (c.mel[i].t + c.mel[i].dur > c.mel[i + 1].t) c.mel[i].dur = Math.max(30, c.mel[i + 1].t - c.mel[i].t);
}

/* ================= bass ================= */
function genBass(c, pass2) {
  const x = c.x, st = c.style;
  let prev = null;
  if (pass2) { c.bassLine = []; c.walk = []; }
  for (const ph of c.phrases) {
    if (ph.poly) { prev = null; continue; }
    const r = mkRng(x.seed * 17 + ph.idx * 131 + 3);
    const evs = c.events.slice(ph.ev0, ph.ev1);
    let sk = [];
    if (ph.btex === 'pedal') {
      const pc = dpc(ph.key, ph.pedal || 0);
      for (let b = 0; b < ph.nb; b++) { const t = ph.t0 + b * c.bar; sk.push({ t, dur: c.bar, ev: evAt(c.events, t), strong: true, goal: new Set([pc]) }); }
      sk.forEach(n => { n.ev = Object.assign({}, n.ev, { pcs: new Set([pc]) }); });
    } else evs.forEach(e => sk.push({ t: e.t, dur: e.dur, ev: e, strong: true, goal: new Set([e.bass]) }));
    const out = line(sk, { lo: st.bLo, hi: st.bHi, center: st.bC, half: 8, prevD: prev ? prev.D : null, prevM: prev ? prev.m : null, prevT: prev ? prev.t : null, r, noise: .6, leap: 5, tend: 1, fixed: pass2 ? [c.mel] : null, below: pass2 ? [c.mel] : null });
    if (ph.btex === 'pedal') out.forEach(n => { n.pedal = 1; });
    out.forEach(n => { n.ph = ph; });
    c.bassLine.push(...out);
    if (out.length) prev = out[out.length - 1];
    if (ph.btex === 'walk' && pass2) {
      const step = x.tempo > 100 ? PPQ : PPQ / 2;
      const wk = [];
      evs.forEach(e => { for (let t = e.t; t < e.t + e.dur; t += step) wk.push({ t, dur: step, ev: e, strong: t === e.t || (t - ph.t0) % PPQ === 0, goal: t === e.t ? new Set([e.bass]) : null }); });
      const w = line(wk, { fixed: [c.mel], below: [c.mel], lo: st.bLo, hi: st.bHi + 4, center: st.bC, half: 9, prevD: out[0] ? out[0].D : null, prevM: out[0] ? out[0].m : null, prevT: ph.t0 - 1, r, noise: 1, leap: 7, tend: 1 });
      w.forEach(n => { n.ph = ph; });
      c.walk.push(...w);
    }
  }
  // the lines the melody must not make parallels with: walking bass where it exists
  if (c.walk.length) {
    const wset = new Set(c.walk.map(n => n.ph.idx));
    c.bassCheck = c.bassLine.filter(n => !wset.has(n.ph.idx)).concat(c.walk).sort((a, b) => a.t - b.t);
  } else c.bassCheck = c.bassLine;
}
function bassForMelPhrases(c) { // variation with the melody in the bass
  for (const ph of c.phrases) {
    if (ph.btex !== 'mel') continue;
    const mel = c.mel.filter(n => n.t >= ph.t0 && n.t < ph.t1);
    const avg = mel.reduce((a, n) => a + n.m, 0) / Math.max(1, mel.length);
    const sh = -12 * Math.round((avg - 50) / 12);
    const nb = mel.map(n => ({ t: n.t, dur: n.dur, m: n.m + sh, D: n.D + (sh / 12) * 7, ph, art: n.art }));
    c.bassLine = c.bassLine.filter(n => n.ph !== ph).concat(nb).sort((a, b) => a.t - b.t);
    c.bassCheck = c.bassCheck.filter(n => n.ph !== ph).concat(nb).sort((a, b) => a.t - b.t);
    ph.melInBass = 1;
  }
}

/* ================= inner voices: Viterbi voicing ================= */
const VR = { A: [55, 79], X: [50, 74], T: [45, 69] };
function voiceAll(c) {
  const mel = c.mel, bass = c.bassCheck;
  let chain = [];
  const flush = () => {
    if (!chain.length) return;
    // backtrack
    let best = null;
    const lastC = chain[chain.length - 1].C; for (const v of lastC) if (!best || v.acc < best.acc) best = v;
    for (let i = chain.length - 1; i >= 0; i--) { chain[i].ev.V = best.V; best = best.back; }
    chain = [];
  };
  let prevEv = null;
  for (const ev of c.events) {
    const ph = ev.ph;
    if (ph.poly) { flush(); prevEv = null; continue; }
    const inBass = ph.melInBass;
    let melM = inBass ? null : sounding(mel, ev.t);
    if (melM == null && !inBass) { for (let i = mel.length - 1; i >= 0; i--) if (mel[i].t < ev.t) { melM = mel[i].m; break; } }
    let melMin = melM;
    if (!inBass) for (const n of mel) { if (n.t >= ev.t + ev.dur) break; if (n.t + n.dur > ev.t && n.t >= ev.t - 4 * PPQ) melMin = Math.min(melMin == null ? 999 : melMin, n.m); }
    const bassM = sounding(bass, ev.t) || 40;
    const top = inBass ? 84 : (melM == null ? 80 : melM);
    const pcs = ev.pcs, cand = [];
    const C = v => { const o = []; for (let m = VR[v][0]; m <= VR[v][1]; m++) if (pcs.has(mod(m, 12))) o.push(m); return o; };
    const As = C('A'), Xs = C('X'), Ts = C('T');
    const tryBuild = relax => {
      for (const A of As) { if (!relax && A >= top + 5) continue; for (const X of Xs) { if (X >= A || A - X > (relax ? 16 : 12)) continue; for (const T of Ts) { if (T >= X || X - T > (relax ? 16 : 12) || T <= bassM) continue; cand.push([A, X, T]); } } }
    };
    tryBuild(false); if (!cand.length) tryBuild(true); if (!cand.length) cand.push([Math.min(top - 1, 67), 62, 55]);
    const root = ev.ch.root, third = ev.ch.T[1].pc, sev = ev.sv, lt = ev.lt;
    const melPc = (!inBass && melM != null && pcs.has(mod(melM, 12))) ? mod(melM, 12) : -1;
    const local = V => {
      const all = [V[0], V[1], V[2]].map(m => mod(m, 12)); all.push(mod(bassM, 12)); if (melPc >= 0) all.push(melPc);
      const has = p => all.includes(p), cnt = p => all.filter(q => q === p).length;
      let k = 0;
      if (!ev.ch.ger && !has(root)) k += 40;
      if (!has(third)) k += 60;
      if (sev >= 0 && !has(sev)) k += 30;
      ev.ch.T.forEach((t, i) => { if (i === 2 && !has(t.pc)) k += 3; if (i >= 4 && !has(t.pc)) k += 8; });
      if (lt >= 0 && cnt(lt) >= 2) k += 40;
      if (sev >= 0 && cnt(sev) >= 2) k += 30;
      if (melMin != null && !inBass && V[0] > melMin) k += 15;
      if (melM != null && !inBass && melM - V[0] < 2) k += 20;
      if (melM != null && !inBass && V[0] >= melM) k += 25;
      if (V[2] <= bassM + 2) k += 8;
      k += Math.abs(V[0] - 68) * .08 + Math.abs(V[2] - 56) * .05;
      return k;
    };
    const contig = prevEv && prevEv.t + prevEv.dur === ev.t;
    const Cs = cand.map(V => ({ V, loc: local(V), acc: 0, back: null }));
    if (contig && chain.length) {
      const pm = inBass ? null : sounding(mel, ev.t - 1), cm = melM, pb = sounding(bass, ev.t - 1), cb = bassM;
      const prevC = chain[chain.length - 1].C;
      const same = prevEv.ch.root === ev.ch.root && prevEv.bass === ev.bass && prevEv.pcs.size === pcs.size;
      for (const cur of Cs) {
        let best = null, bc = 1e18;
        for (const pv of prevC) {
          const P0 = pv.V, V = cur.V;
          let k = pv.acc;
          for (let i = 0; i < 3; i++) { const d = Math.abs(V[i] - P0[i]); k += d; if (d > 7) k += 6; }
          const pl = [P0[0], P0[1], P0[2], pb, pm], cl = [V[0], V[1], V[2], cb, cm];
          for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
            if (i === 3 && j === 4) continue;
            const a1 = pl[i], a2 = cl[i], b1 = pl[j], b2 = cl[j];
            if (a1 == null || a2 == null || b1 == null || b2 == null || a1 === a2 || b1 === b2) continue;
            if (Math.sign(a2 - a1) !== Math.sign(b2 - b1)) continue;
            const i1 = Math.abs(a1 - b1) % 12, i2 = Math.abs(a2 - b2) % 12;
            if (i1 === i2 && (i1 === 0 || i1 === 7)) k += 500;
          }
          if (!same) for (let i = 0; i < 3; i++) {
            const pp = mod(P0[i], 12), d = V[i] - P0[i];
            if (pp === prevEv.sv && !(d === -1 || d === -2)) k += 20;
            if (pp === prevEv.lt && ev.ch.root === mod(pp + 1, 12) && d !== 1) k += 5;
          }
          if (k < bc) { bc = k; best = pv; }
        }
        cur.acc = bc + cur.loc; cur.back = best;
      }
    } else { flush(); Cs.forEach(cc => { cc.acc = cc.loc; }); }
    chain.push({ ev, C: Cs.sort((a, b) => a.acc - b.acc).slice(0, 220) });
    prevEv = ev;
  }
  flush();
}
function genCounter(c) {
  const x = c.x;
  const lines = { A: [], X: [], T: [] };
  c.events.forEach(e => { if (e.V) ['A', 'X', 'T'].forEach((v, i) => lines[v].push({ t: e.t, dur: e.dur, m: e.V[i] })); });
  c.innerLines = lines;
  for (const ph of c.phrases) {
    if (ph.poly || !ph.ctr || ph.melInBass) continue;
    const r = mkRng(x.seed * 7 + ph.idx * 313 + 11);
    const step = ph.char === 'lyr' || ph.char === 'slow' ? 2 * PPQ : PPQ;
    const sk = [];
    for (let i = ph.ev0; i < ph.ev1; i++) { const e = c.events[i]; for (let t = e.t; t < e.t + e.dur; t += step) sk.push({ t, dur: Math.min(step, e.t + e.dur - t), ev: e, strong: t === e.t }); }
    ph.ctrLine = line(sk, { lo: 48, hi: 67, center: 57, half: 7, fixed: [c.mel, c.bassCheck, lines.A, lines.X, lines.T], above: [c.bassCheck], below: [c.mel], contra: c.mel, r, noise: 1, uni: 4 });
    minorFix(ph.ctrLine, c.events);
  }
}

/* ================= textures and orchestration ================= */
function texNotes(tex, ev, V, meter, slow) {
  const out = [], B = PPQ, t0 = ev.t, t1 = ev.t + ev.dur, BAR = B * meter;
  const [A, X, T] = V;
  const push = (t, d, m, voice, art) => { if (t < t1 && t >= t0) out.push({ t, dur: Math.min(d, t1 - t), m, voice, art }); };
  const three = [[A, 'A'], [X, 'X'], [T, 'T']];
  switch (tex) {
    case 'block': case 'sustain':
      for (let s = t0; s < t1; s += BAR) three.forEach(([m, v]) => push(s, Math.min(BAR, t1 - s), m, v, 'long'));
      break;
    case 'tremolo': three.forEach(([m, v]) => push(t0, ev.dur, m, v, 'trem')); break;
    case 'repeated8': for (let t = t0; t < t1; t += B / 2) three.forEach(([m, v]) => push(t, B / 2, m, v, 'short')); break;
    case 'syncop': for (let t = t0; t < t1; t += B) three.forEach(([m, v]) => push(t + B / 2, B / 2, m, v, 'short')); break;
    case 'beats': case 'continuo': for (let t = t0; t < t1; t += B) three.forEach(([m, v]) => push(t, Math.round(B * .8), m, v, slow ? 'long' : 'short')); break;
    case 'pizz': for (let t = t0; t < t1; t += B) three.forEach(([m, v]) => push(t, B / 2, m, v, 'pizz')); break;
    case 'alberti': { const s = slow ? B / 4 : B / 2, pat = [T, A, X, A]; let k = 0; for (let t = t0; t < t1; t += s, k++) push(t, s, pat[k % 4], 'alb', slow ? 'long' : 'short'); break; }
    case 'arpeggio': { const s = slow ? B / 4 : B / 2, pat = [T, X, A, X]; let k = 0; for (let t = t0; t < t1; t += s, k++) push(t, s * 1.6, pat[k % 4], 'arp', 'long'); break; }
    case 'oompah': for (let t = t0; t < t1; t += B) { if ((t % BAR) === 0) continue; three.forEach(([m, v]) => push(t, B / 2, m, v, 'short')); } break;
    case 'march': for (let t = t0; t < t1; t += B) { if (((t % BAR) / B) % 2 === 0) continue; three.forEach(([m, v]) => push(t, B / 2, m, v, 'short')); } break;
    default: three.forEach(([m, v]) => push(t0, ev.dur, m, v, 'long'));
  }
  return out;
}
function bassNotes(btex, ev, m, meter, walk) {
  const out = [], B = PPQ, t0 = ev.t, t1 = ev.t + ev.dur, BAR = B * meter;
  const push = (t, d, art) => { if (t < t1) out.push({ t, dur: Math.min(d, t1 - t), m, art }); };
  switch (btex) {
    case 'walk': return walk.filter(n => n.t >= t0 && n.t < t1).map(n => ({ t: n.t, dur: n.dur, m: n.m, art: n.dur <= B / 2 ? 'short' : 'long' }));
    case 'beats': for (let t = t0; t < t1; t += B) push(t, Math.round(B * .85), 'short'); break;
    case 'drum8': for (let t = t0; t < t1; t += B / 2) push(t, B / 2, 'short'); break;
    case 'oompah': for (let t = t0; t < t1; t += B) if ((t % BAR) === 0) push(t, B, 'long'); if (!out.length) push(t0, B, 'long'); break;
    case 'march': for (let t = t0; t < t1; t += B) if (((t % BAR) / B) % 2 === 0) push(t, B, 'short'); if (!out.length) push(t0, B, 'short'); break;
    case 'pizz': for (let t = t0; t < t1; t += B) push(t, B / 2, 'pizz'); break;
    default: push(t0, ev.dur, 'long');
  }
  return out;
}
const MPREF = { svn: [0, 12, -12], svc: [-12, -24, 0], eh: [-12, 0], bcl: [-12, -24], shn: [-12, -24, 0], stpt: [0, -12], stbn: [-12, -24], vln1: [0, 12, -12], vln2: [0, -12, 12], fl: [0, 12], ob: [0, -12], cl: [0, -12], hn: [-12, -24, 0], tpt: [0, -12], vc: [-12, -24], vla: [-12, 0], bsn: [-12, -24], pno: [0], tbn: [-12, -24], picc: [12, 24] };
function orchPlan(c, ph) {
  const x = c.x, E = x.E, era = x.era, I = ph.inten;
  const has = id => E.has(id), use = new Set();
  const P = { mel: [], inner: [], bass: [], ctr: [], tpt: false, timp: false, pno: null };
  const addM = (id, pref) => { if (has(id) && !use.has(id)) { P.mel.push({ id, pref: pref || MPREF[id] || [0] }); use.add(id); return true; } return false; };
  let lead = ph.lead || 'str';
  if (lead === 'ww') { const w = ['ob', 'fl', 'cl'].filter(has); lead = w.length ? 'solo:' + w[ph.idx % w.length] : 'str'; }
  if (lead.startsWith('solo:') && !addM(lead.slice(5))) lead = 'str';
  if (ph.melInBass) { lead = 'bass'; }
  if (lead === 'str' || lead === 'tutti') { addM('vln1') || addM('fl') || addM('ob') || addM('cl') || addM('vln2') || addM('hn') || addM('pno'); }
  if (lead !== 'bass') {
    if (era === 'baroque' && I >= .45) addM('ob', [0, -12]);
    if (I >= .6) addM('fl', [12, 0]);
    if (I >= .72) addM('ob', [0, -12]);
    if (I >= .82) addM('vln2', [-12, 0]);
    if (I >= .9 && era !== 'baroque' && era !== 'classical') addM('picc', [12, 24]);
    if (I >= .9 && era === 'romantic') addM('cl', [0, -12]);
    if (lead.startsWith('solo:') && I < .6) { /* solo stays alone */ }
  }
  const addB = (id, pref) => { if (has(id) && !use.has(id)) { P.bass.push({ id, pref }); use.add(id); } };
  if (lead !== 'bass') addB('vc', [0, -12, 12]); else { addB('vc', [0, 12, -12]); if (I > .4) addB('bsn', [0, 12, -12]); }
  if (I >= .25 || era === 'baroque') addB('cb', [-12, 0]);
  if (era === 'baroque' || I >= .55) addB('bsn', [0, -12, 12]);
  if (I >= .82 && era !== 'baroque') { addB('tba', [-12, 0]); addB('btbn', [0, -12]); }
  if (I >= .55 && era !== 'baroque') addB('cbsn', [-12, 0, -24]);
  if (ph.ctrLine) { const cid = ['hn', 'vc', 'vla', 'bsn'].find(id => has(id) && !use.has(id) && (id !== 'vc' || has('cb'))); if (cid) { if (cid === 'vc') P.bass = P.bass.filter(b => b.id !== 'vc'); P.ctr.push({ id: cid, pref: [0, -12, 12] }); use.add(cid); } }
  const tex = ph.tex;
  const slow = x.tempo < 96 || ph.char === 'slow' || (ph.stretch || 1) > 1;
  const addI = (id, voices, t, pref) => { if (has(id) && !use.has(id)) { P.inner.push({ id, voices, tex: t, pref: pref || [0] }); use.add(id); return true; } return false; };
  if (tex === 'alberti') { addI('vln2', ['alb'], 'alberti'); addI('vla', ['X', 'T'], 'block'); }
  else if (tex === 'arpeggio') { if (!addI('vln2', ['arp'], 'arpeggio')) addI('vla', ['arp'], 'arpeggio'); addI('vla', ['X', 'T'], 'block'); }
  else if (tex === 'continuo') { addI('vln2', ['A', 'X'], 'continuo'); addI('vla', ['T'], 'continuo'); }
  else { addI('vln2', ['A', 'X'], tex); addI('vla', ['T'], tex); }
  if (!use.has('vln1')) addI('vln1', ['A'], tex === 'alberti' || tex === 'arpeggio' ? 'block' : tex);
  if (I >= .4 && era !== 'baroque') addI('cl', ['A', 'X'], 'block');
  if ((I >= .45 && era !== 'baroque') || (era === 'impressionist' && I >= .25)) addI('hn', ['X', 'T'], tex === 'march' ? 'march' : era === 'impressionist' ? 'sustain' : 'block', [0, -12]);
  if (I >= .55 && era !== 'baroque') addI('bsn', ['T'], 'block');
  if (I >= .7) { addI('fl', ['A'], 'block', [12, 0]); addI('ob', ['A', 'X'], 'block'); }
  if (I >= .8 && era !== 'baroque') addI('tbn', ['X', 'T'], tex === 'march' ? 'march' : 'block');
  if (ph.fan && era === 'baroque' && I >= .6) addI('tbn', ['X', 'T'], 'block');
  if (I >= .3 && I < .85 && (era === 'romantic' || era === 'impressionist')) addI('bcl', ['T'], 'block', [-12, 0]);
  if (I >= .65) addI('stbn', ['T'], tex === 'march' ? 'march' : 'block');
  P.tpt = has('tpt') && !use.has('tpt') && (I >= .8 || (ph.fan && I >= .6) || ph.final && I >= .8);
  P.timp = has('timp') && (I >= .72 || (ph.final && I >= .6));
  if (has('pno') && !use.has('pno')) P.pno = era === 'baroque' ? 'continuo' : era === 'classical' ? (I > .8 ? 'block' : 'alberti') : 'arpeggio';
  P.slow = slow;
  return P;
}
function polyPlan(c, ph) {
  const x = c.x, E = x.E, I = ph.inten, era = x.era;
  const used = new Set(), vm = {};
  const take = (v, list) => { for (const [id, pref] of list) if (E.has(id) && !used.has(id)) { (vm[v] = vm[v] || []).push({ id, pref }); used.add(id); return true; } return false; };
  const [v1, v2, v3, vb] = c.vorder;
  take(v1, [['vln1', [0, 12]], ['fl', [0, 12]], ['ob', [0, -12]], ['cl', [0]]]);
  take(v2, [['vln2', [0]], ['ob', [0, -12]], ['cl', [0, -12]], ['fl', [0, 12]]]);
  take(v3, [['vla', [0, 12]], ['cl', [0, 12]], ['hn', [0, -12]], ['bsn', [0, 12]], ['vln2', [0, 12]]]);
  take(vb, [['vc', [0, -12, 12]], ['bsn', [0, -12, 12]], ['cb', [0, -12]], ['tba', [0, -12]]]);
  if (I >= .25 || era === 'baroque') take(vb, [['cb', [-12, 0]]]);
  if (I >= .5 || era === 'baroque') take(vb, [['bsn', [0, -12, 12]]]);
  if (I >= .55) take(v1, [['ob', [0, -12]], ['fl', [12, 0]]]);
  if (I >= .65) { take(v2, [['cl', [0, -12]], ['ob', [0, -12]]]); take(v3, [['hn', [0, -12]], ['cl', [0, 12]]]); }
  if (I >= .6) take(vb, [['cbsn', [-12, 0]]]);
  if (I >= .8) { take(v1, [['fl', [12, 0]]]); if (era !== 'baroque') take(vb, [['tba', [-12, 0]], ['btbn', [0, -12]]]); take(v3, [['tbn', [0, -12]]]); }
  return { vm, poly: 1, timp: E.has('timp') && (I >= .8 || ph.final), tpt: E.has('tpt') && (I >= .85 || ph.final) && !used.has('tpt') };
}
function chooseShift(notes, inst, pref) {
  let best = pref[0], bc = -1;
  for (const s of pref) { let k = 0; for (const n of notes) if (n.m + s >= inst.lo && n.m + s <= inst.hi) k++; if (k === notes.length) return s; if (k > bc) { bc = k; best = s; } }
  return best;
}
function fold(m, inst) { let k = 0; while (m < inst.lo && k++ < 6) m += 12; while (m > inst.hi && k++ < 12) m -= 12; return m >= inst.lo && m <= inst.hi ? m : null; }
function expandTrill(notes) {
  const out = [];
  notes.forEach(n => {
    if (n.orn !== 'tr' || n.dur < PPQ) { out.push(n); return; }
    const s = PPQ / 8, keep = Math.max(PPQ / 2, Math.round(n.dur / 3));
    let t = n.t, k = 0;
    while (t + s <= n.t + n.dur - keep) { out.push(Object.assign({}, n, { t, dur: s, m: k % 2 ? n.m : n.up, orn: null })); t += s; k++; }
    out.push(Object.assign({}, n, { t, dur: n.t + n.dur - t, orn: null }));
  });
  return out;
}
function render(c) {
  const x = c.x, parts = {}; INST.forEach(i => parts[i.id] = []);
  const H = x.K, tonicPc = H.t, domPc = dpc(H, 4);
  const timpT = (() => { let m = 41; while (mod(m, 12) !== tonicPc) m++; return m; })();
  const timpD = (() => { let best = 0, bd = 99; for (let m = 40; m <= 55; m++) if (mod(m, 12) === domPc && Math.abs(m - timpT) < bd && m !== timpT) { bd = Math.abs(m - timpT); best = m; } return best; })();
  const put = (id, n, role, ph) => { parts[id].push({ t: n.t, dur: n.dur, m: n.m, art: n.art || 'long', role, ph }); };
  const placeLine = (id, notes, pref, role, ph) => {
    const inst = IM[id], sh = chooseShift(notes, inst, pref);
    notes.forEach(n => { const m = fold(n.m + sh, inst); if (m != null) put(id, Object.assign({}, n, { m }), role, ph); });
  };
  // the trill needs the upper neighbour
  c.mel.forEach(n => { if (n.orn === 'tr') { const ev = evAt(c.events, n.t); const D = n.D + 1; n.up = natMidi(D) + ev.alt[mod(D, 7)]; } });
  for (const ph of c.phrases) {
    const evs = c.events.slice(ph.ev0, ph.ev1);
    if (ph.poly) {
      const P = polyPlan(c, ph); ph.plan = P;
      for (const v of c.vorder) {
        const notes = c.voices[v].filter(n => n.t >= ph.t0 && n.t < ph.t1).map(n => Object.assign({}, n, { art: x.era === 'baroque' && n.dur <= PPQ / 2 && x.tempo >= 96 ? 'short' : 'long' }));
        (P.vm[v] || []).forEach(e => placeLine(e.id, notes, e.pref, v === c.vorder[c.vorder.length - 1] ? 'bass' : 'mel', ph));
      }
      if (P.timp) evs.forEach(e => { const m = e.ch.root === tonicPc ? timpT : e.ch.root === domPc ? timpD : null; if (m) put('timp', { t: e.t, dur: PPQ, m }, 'timp', ph); });
      if (P.tpt) evs.forEach(e => { const top = [...e.pcs].map(p => { let m = 60; while (mod(m, 12) !== p) m++; return m; }); top.sort((a, b) => a - b); put('tpt', { t: e.t, dur: e.dur, m: top[top.length - 1] }, 'brass', ph); });
      if (ph.final) finalRoll(ph);
      continue;
    }
    const P = orchPlan(c, ph); ph.plan = P;
    const mel = expandTrill(c.mel.filter(n => n.t >= ph.t0 && n.t < ph.t1));
    P.mel.forEach((e, i) => placeLine(e.id, mel, e.pref, i ? 'dbl' : 'mel', ph));
    // inner
    P.inner.forEach(e => {
      evs.forEach(ev => {
        if (!ev.V) return;
        const V = e.id === 'fl' || e.id === 'ob' || e.id === 'cl' ? ev.V : ev.V;
        texNotes(e.tex, ev, V, c.meter, P.slow).forEach(n => {
          if (!e.voices.includes(n.voice)) return;
          let m = n.m + (e.pref[0] || 0); m = fold(m, IM[e.id]); if (m == null) return;
          put(e.id, Object.assign({}, n, { m }), e.id === 'hn' || e.id === 'cl' || e.id === 'bsn' || e.id === 'fl' || e.id === 'ob' ? 'pad' : e.id === 'tbn' ? 'brass' : 'inner', ph);
        });
      });
    });
    // bass
    const bl = c.bassLine.filter(n => n.t >= ph.t0 && n.t < ph.t1);
    P.bass.forEach(e => {
      const inst = IM[e.id];
      let notes = [];
      if (ph.melInBass) notes = bl.map(n => ({ t: n.t, dur: n.dur, m: n.m, art: n.art || 'long' }));
      else evs.forEach(ev => { const bn = sounding(bl, ev.t); if (bn == null) return; const bt = ph.btex === 'pedal' ? 'held' : (ph.btex === 'walk' && e.id !== 'vc' && e.id !== 'bsn' && e.id !== 'cb') ? 'held' : ph.btex; notes.push(...bassNotes(bt, ev, bn, c.meter, c.walk)); });
      if (ph.btex === 'pedal') { notes = []; bl.forEach(n => notes.push({ t: n.t, dur: n.dur, m: n.m, art: 'long' })); }
      const sh = chooseShift(notes, inst, e.pref);
      notes.forEach(n => { const m = fold(n.m + sh, inst); if (m != null) put(e.id, Object.assign({}, n, { m, art: e.id === 'cb' && n.art === 'short' && ph.inten < .4 ? 'pizz' : n.art }), 'bass', ph); });
    });
    if (ph.ctrLine) P.ctr.forEach(e => placeLine(e.id, ph.ctrLine.map(n => Object.assign({}, n, { art: 'long' })), e.pref, 'ctr', ph));
    // trumpets
    if (P.tpt) {
      const fan = ph.fan || ph.char === 'march';
      evs.forEach(ev => {
        if (!ev.V) return;
        const ps = [ev.V[0], ev.V[1]].map(m => { let q = m; while (q < 62) q += 12; while (q > 79) q -= 12; return q; });
        if (fan) { for (let t = ev.t; t < ev.t + ev.dur; t += 2 * PPQ) { const pat = [[0, .75], [.75, .25], [1, 1]]; pat.forEach(([o, d]) => { const tt = t + o * PPQ; if (tt < ev.t + ev.dur) ps.forEach(m => put('tpt', { t: tt, dur: d * PPQ, m, art: 'short' }, 'brass', ph)); }); } }
        else ps.forEach(m => put('tpt', { t: ev.t, dur: ev.dur, m, art: ev.dur >= 2 * PPQ ? 'long' : 'short' }, 'brass', ph));
      });
    }
    if (P.timp) {
      for (let b = 0; b < ph.nb; b++) {
        const t = ph.t0 + b * c.bar, ev = evAt(c.events, t);
        const m = ev.ch.root === tonicPc ? timpT : ev.ch.root === domPc ? timpD : null;
        if (m) put('timp', { t, dur: PPQ, m }, 'timp', ph);
        if (x.era === 'romantic' && m && c.meter === 4 && ph.inten > .85) put('timp', { t: t + 2 * PPQ, dur: PPQ, m }, 'timp', ph);
      }
    }
    if (P.pno) {
      evs.forEach(ev => {
        if (!ev.V) return;
        const bn = sounding(bl, ev.t);
        if (bn != null) put('pno', { t: ev.t, dur: ev.dur, m: bn - (bn > 48 ? 12 : 0) }, 'pno', ph);
        const tx = P.pno === 'continuo' ? 'beats' : P.pno;
        texNotes(tx === 'alberti' ? 'alberti' : tx === 'arpeggio' ? 'arpeggio' : tx === 'block' ? 'beats' : tx, ev, ev.V, c.meter, true).forEach(n => put('pno', n, 'pno', ph));
      });
    }
    colours(ph, evs, mel, P);
    if (ph.final) finalRoll(ph);
  }
  function colours(ph, evs, mel, P) {
    const fk = x.feelId, I = ph.inten, has = id => x.E.has(id) && !P.mel.some(m => m.id === id);
    const brisk = ph.char === 'brisk' || ph.char === 'motor' || ph.char === 'dance' || ph.char === 'waltz' || ph.char === 'march';
    const dark = x.feel && x.feel.mode === 'm' && fk !== 'heroic';
    const sparkle = !dark && (fk === 'joyful' || fk === 'dreamy' || fk === 'heroic' || x.era === 'impressionist' || (ph.final && ph.key.m === 'M') || (I >= .85 && ph.key.m === 'M'));
    if (has('glock') && sparkle && I >= .4) placeLine('glock', mel.filter(n => (n.t - ph.t0) % PPQ === 0 && n.dur >= PPQ / 2).map(n => Object.assign({}, n, { dur: PPQ / 2, art: 'short' })), [12, 24, 0], 'col', ph);
    if (has('xyl') && brisk && (fk === 'joyful' || fk === 'stormy' || I >= .75)) placeLine('xyl', mel.filter(n => n.dur <= PPQ / 2).map(n => Object.assign({}, n, { art: 'short' })), [12, 0], 'col', ph);
    if (has('vib') && (fk === 'dreamy' || fk === 'mysterious' || x.era === 'impressionist') && I < .8) evs.forEach(ev => { if (ev.V) texNotes('arpeggio', ev, ev.V, c.meter, false).forEach(n => { const m = fold(n.m + 12, IM.vib); if (m != null) put('vib', Object.assign({}, n, { m }), 'col', ph); }); });
    if (has('mar') && (fk === 'joyful' || ph.char === 'waltz' || ph.char === 'dance') && I >= .35 && I < .9) evs.forEach(ev => { if (ev.V) texNotes(ph.char === 'waltz' ? 'oompah' : 'beats', ev, ev.V, c.meter, false).forEach(n => { if (n.voice !== 'A' && n.voice !== 'X') return; const m = fold(n.m, IM.mar); if (m != null) put('mar', Object.assign({}, n, { m, art: 'short' }), 'col', ph); }); });
    if (has('bells') && (ph.final || ((fk === 'solemn' || fk === 'heroic') && (ph.sec === 'Coda' || ph.sec === 'Finale' || I >= .9)))) {
      for (let b = 0; b < ph.nb; b += ph.final ? 1 : 2) { const t = ph.t0 + b * c.bar, ev = evAt(c.events, t); [ev.ch.root, ev.ch.T[2].pc].forEach((pc, k) => { let m = 53; while (mod(m, 12) !== pc) m++; if (!k || ph.final) put('bells', { t, dur: c.bar, m, art: 'long' }, 'col', ph); }); }
    }
  }
  function finalRoll(ph) {
    if (!x.E.has('timp') || ph.inten < .6) return;
    const fe = c.events[ph.ev1 - 1];
    for (let t = fe.t; t < fe.t + fe.dur - PPQ / 4; t += PPQ / 4) put('timp', { t, dur: PPQ / 4, m: timpT, roll: 1 }, 'timp', ph);
  }
  // dedupe identical notes
  for (const id in parts) {
    const L = parts[id].sort((a, b) => a.t - b.t || a.m - b.m);
    const out = []; let last = null;
    for (const n of L) { if (last && last.t === n.t && last.m === n.m) { last.dur = Math.max(last.dur, n.dur); continue; } out.push(n); last = n; }
    parts[id] = out;
  }
  return parts;
}

/* ================= performance: dynamics, rubato, keyswitches ================= */
const ROLEOFF = { col: -.1, mel: 0, dbl: -.04, inner: -.13, pad: -.12, bass: -.06, ctr: -.06, brass: -.1, timp: -.02, pno: -.08 };
function perform(c, parts) {
  const x = c.x, era = ERAS[x.era], r = mkRng(x.seed * 3 + 99);
  const OFF = c.bar;
  const totalBeats = Math.ceil(c.t / PPQ) + 2;
  // rubato
  const amt = x.rubato === 0 ? 0 : era.rub * (x.rubato === 2 ? 1.8 : 1) * (x.tempo < 90 ? 1.3 : 1) * (x.feel ? x.feel.rub : 1);
  const f = new Float64Array(totalBeats).fill(1);
  if (amt > 0) c.phrases.forEach((ph, i) => {
    const b0 = ph.t0 / PPQ, B = (ph.t1 - ph.t0) / PPQ;
    for (let j = 0; j < B; j++) {
      const p = (j + .5) / B;
      let v = era.terr ? 0 : (p < .7 ? -amt * .3 : -amt * .3 + (p - .7) / .3 * amt * 1.5);
      if (!era.terr && j === B - 1 && i < c.phrases.length - 1) v += amt;
      f[b0 + j] = Math.max(.85, 1 + v);
    }
  });
  if (x.rubato !== 0) {
    const fin = c.phrases[c.phrases.length - 1], endB = c.t / PPQ, ritB = c.meter * 2 + fin.nb * c.meter;
    for (let b = Math.max(0, endB - ritB); b < endB; b++) { const q = (b - (endB - ritB)) / ritB; f[b] *= 1 + q * q * (.3 + amt * 2); }
    for (let b = fin.t0 / PPQ; b < endB; b++) f[b] *= 1.6;
    const cz = c.phrases.find(p => p.cadenza);
    if (cz) for (let b = cz.t0 / PPQ; b < cz.t0 / PPQ + c.meter; b++) f[b] *= 1.5;
  }
  const W = new Float64Array(totalBeats + 1);
  for (let b = 0; b < totalBeats; b++) W[b + 1] = W[b] + f[b] * PPQ;
  const warp = t => { const b = Math.min(totalBeats - 1, Math.floor(t / PPQ)), fr = t / PPQ - b; return OFF + Math.round(W[b] + fr * f[b] * PPQ); };
  // dynamics level at time t for phrase ph
  const lvl = (ph, t, role) => {
    const p = clamp((t - ph.t0) / (ph.t1 - ph.t0), 0, 1);
    let v = ph.dyn;
    if (!era.terr) {
      const arc = p < .65 ? p / .65 : (1 - p) / .35;
      v += era.amp * (arc - .5);
      const nx = c.phrases[ph.idx + 1];
      if (nx && nx.dyn - ph.dyn > .15 && p > .6) v += (nx.dyn - ph.dyn) * (p - .6) / .4;
    }
    return clamp(v + (ROLEOFF[role] || 0), .05, 1);
  };
  const tracks = [];
  const tempoMs = 60000 / x.tempo / PPQ;
  for (const inst of INST) {
    const L = parts[inst.id];
    if (!L.length) continue;
    const notes = [], cc = [], ks = [];
    L.forEach(n => {
      const ph = n.ph, beatPos = (n.t % c.bar) / PPQ;
      const lv = lvl(ph, n.t, n.role);
      let v = 28 + 84 * lv + (beatPos === 0 ? 8 : beatPos === 2 && c.meter === 4 ? 3 : (n.t % PPQ) ? -5 : 0) + (r() * 8 - 4);
      if (n.art === 'short' || n.art === 'pizz') v += 5;
      if (n.roll) v = 50 + 60 * lv * (0.6 + 0.4 * ((n.t - ph.t0) / Math.max(1, ph.t1 - ph.t0)));
      v = Math.round(clamp(v, 18, 124));
      let t1 = warp(n.t), t2 = warp(n.t + n.dur);
      let d = t2 - t1;
      if (n.art === 'short' || n.art === 'pizz') d = Math.max(40, Math.min(d, Math.round(d * .55)));
      else d = Math.max(30, d - 12);
      if (inst.ks && n.art === 'long' && x.early) { const sh = Math.round(x.early / tempoMs); t1 = Math.max(OFF / 2, t1 - sh); }
      if (n.art !== 'long' || !inst.ks) t1 += Math.round(r() * 6 - 3);
      notes.push({ t: t1, dur: d, m: n.m, v, art: inst.ks ? n.art : 'long' });
    });
    notes.sort((a, b) => a.t - b.t || a.m - b.m);
    // one articulation per onset, keyswitch before each change
    if (inst.ks) {
      const map = KS[inst.ks];
      let cur = -1;
      for (let i = 0; i < notes.length;) {
        let j = i; const art = notes[i].art;
        while (j < notes.length && notes[j].t - notes[i].t <= 4) { notes[j].art = art; j++; }
        const k = map[art] != null ? map[art] : 0;
        if (k !== cur) { ks.push({ t: Math.max(0, notes[i].t - 24), m: k }); cur = k; }
        i = j;
      }
    }
    // CC1 dynamics, CC11 expression
    if (inst.id !== 'pno') {
      let lastV = -1;
      const role = {}; L.forEach(n => { role[n.ph.idx] = role[n.ph.idx] || n.role; });
      c.phrases.forEach(ph => {
        const rl = role[ph.idx] || 'inner';
        for (let t = ph.t0; t < ph.t1; t += PPQ / 2) {
          const v = Math.round(clamp(14 + 108 * lvl(ph, t, rl), 1, 127));
          if (v !== lastV) { cc.push({ t: warp(t), c: 1, v }); lastV = v; }
        }
      });
      cc.unshift({ t: 0, c: 11, v: 110 });
      if (!cc.find(e => e.c === 1 && e.t <= OFF)) cc.unshift({ t: 0, c: 1, v: 64 });
    }
    tracks.push({ id: inst.id, name: inst.name, notes, cc, ks, ksType: inst.ks });
  }
  const end = warp(c.t) + PPQ;
  return {
    tracks, end, OFF,
    markers: c.markers.map(m => ({ t: warp(m.t), text: m.text })),
    secs: c.secs.map(s => ({ label: s.label, t0: warp(s.t0), t1: warp(s.t1) })),
    warp,
  };
}

/* ================= MIDI ================= */
function vlq(n) { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; }
function strBytes(s) { const o = []; for (const ch of unescape(encodeURIComponent(s))) o.push(ch.charCodeAt(0)); return o; }
function trackChunk(evs) {
  evs.sort((a, b) => a.t - b.t || a.o - b.o);
  const out = []; let last = 0;
  for (const e of evs) { out.push(...vlq(Math.max(0, e.t - last)), ...e.d); last = Math.max(last, e.t); }
  out.push(0, 0xff, 0x2f, 0);
  return [0x4d, 0x54, 0x72, 0x6b, (out.length >>> 24) & 255, (out.length >>> 16) & 255, (out.length >>> 8) & 255, out.length & 255].concat(out);
}
function keySig(K) { const sharpsMaj = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 }; const rel = K.m === 'M' ? K.t : mod(K.t + 3, 12); let sf = sharpsMaj[rel]; if (K.alt[K.L] > 0 && sf < 0) sf += 12; if (K.alt[K.L] < 0 && sf > 0) sf -= 12; if (rel === 6 && K.alt[K.L] < 0) sf = -6; return [sf & 255, K.m === 'M' ? 0 : 1]; }
/* Orchestral Tools Berlin Free Orchestra in SINE: articulations switched with CC70 (Articulation Switch),
   the value range split evenly over the loaded articulations in their default order. Ranges from the OT docs (C3 = 60). */
const BFO = {
  vln1: { name: 'Violins a8 (1st)', n: 4, map: [0, 1, 2, 3], lo: 55, hi: 98 },
  vln2: { name: 'Violins a8 (2nd)', n: 4, map: [0, 1, 2, 3], lo: 55, hi: 98 },
  vla: { name: 'Violas a5', n: 4, map: [0, 1, 2, 3], lo: 48, hi: 86 },
  vc: { name: 'Celli a5', n: 4, map: [0, 1, 2, 3], lo: 36, hi: 84 },
  cb: { name: 'Basses a4', n: 3, map: [0, 1, 2], lo: 23, hi: 72 },
  picc: { name: 'Solo Piccolo Flute', n: 2, map: [0, 1], lo: 74, hi: 108 },
  fl: { name: 'Solo Flute', n: 3, map: [1, 2], lo: 60, hi: 96 },
  ob: { name: 'Solo Oboe', n: 2, map: [0, 1], lo: 60, hi: 89 },
  cl: { name: 'Solo Clarinet', n: 3, map: [1, 2], lo: 50, hi: 89 },
  bsn: { name: 'Solo Bassoon', n: 2, map: [0, 1], lo: 34, hi: 74 },
  hn: { name: 'French Horns a4', n: 2, map: [1, 1], lo: 34, hi: 77 },
  tpt: { name: 'Trumpets a3', n: 2, map: [0, 1], lo: 54, hi: 84 },
  tbn: { name: 'Trombones a3', n: 2, map: [1, 1], lo: 34, hi: 72 },
  tba: { name: 'Solo Tuba', n: 2, map: [1, 1], lo: 27, hi: 63 },
  timp: { name: 'Timpani', n: 0, lo: 48, hi: 60 },
  svn: { name: 'Solo Violin', n: 3, map: [0, 2, 2, 0], lo: 55, hi: 98 },
  svc: { name: 'Solo Cello', n: 3, map: [0, 2, 2, 0], lo: 36, hi: 84 },
  eh: { name: 'Solo English Horn', n: 2, map: [0, 1], lo: 53, hi: 83 },
  bcl: { name: 'Solo Bass Clarinet', n: 2, map: [0, 1], lo: 34, hi: 73 },
  cbsn: { name: 'Solo Contrabassoon', n: 2, map: [0, 1], lo: 22, hi: 59 },
  shn: { name: 'Solo French Horn', n: 2, map: [0, 1], lo: 34, hi: 77 },
  stpt: { name: 'Solo Trumpet', n: 2, map: [0, 1], lo: 54, hi: 84 },
  stbn: { name: 'Solo Trombone', n: 2, map: [0, 1], lo: 34, hi: 70 },
  bells: { name: 'Tubular bells', n: 0, lo: 53, hi: 77 },
  glock: { name: 'Glockenspiel', n: 0, lo: 65, hi: 101 },
  vib: { name: 'Vibraphone', n: 0, lo: 53, hi: 89 },
  mar: { name: 'Marimba', n: 0, lo: 36, hi: 96 },
  xyl: { name: 'Xylophone', n: 0, lo: 65, hi: 108 },
  pno: { name: 'Harp', n: 0, lo: 24, hi: 103 },
};
Y.BFO = BFO;
function toBerlin(tracks) {
  const out = [];
  const byId = {}; tracks.forEach(t => byId[t.id] = t);
  tracks.forEach(t => {
    if (t.id === 'btbn') return;
    const B = BFO[t.id]; if (!B) return;
    let notes = t.notes, ks = t.ks, cc = t.cc;
    if (t.id === 'tbn' && byId.btbn) { notes = notes.concat(byId.btbn.notes); ks = ks.concat(byId.btbn.ks); }
    notes = notes.map(n => { let m = n.m, k = 0; while (m < B.lo && k++ < 6) m += 12; while (m > B.hi && k++ < 12) m -= 12; return Object.assign({}, n, { m }); }).sort((a, b) => a.t - b.t);
    const sw = [];
    if (B.n) { let cur = -1; ks.slice().sort((a, b) => a.t - b.t).forEach(k => { const a = B.map[Math.min(k.m, B.map.length - 1)]; if (a !== cur) { sw.push({ t: k.t, c: 70, v: Math.floor((a + .5) * 128 / B.n) }); cur = a; } }); if (!sw.length) sw.push({ t: 0, c: 70, v: Math.floor((B.map[0] + .5) * 128 / B.n) }); }
    out.push({ id: t.id, name: B.name, notes, cc: cc.concat(sw), ks: [], ksType: null });
  });
  if (!byId.tbn && byId.btbn) { const t = byId.btbn, B = BFO.tbn; out.push({ id: 'tbn', name: B.name, notes: t.notes.map(n => { let m = n.m; while (m < B.lo) m += 12; return Object.assign({}, n, { m }); }), cc: t.cc.concat([{ t: 0, c: 70, v: 96 }]), ks: [], ksType: null }); }
  return out;
}
function writeMidi(res, ids, opt) {
  const plain = opt && opt.plain;
  let pool = res.tracks;
  if (opt && opt.target === 'berlin') { pool = toBerlin(res.tracks.filter(t => !ids || ids.includes(t.id) || (ids.includes('tbn') && t.id === 'btbn'))); }
  const sel = ids && !(opt && opt.target === 'berlin') ? pool.filter(t => ids.includes(t.id)) : pool;
  const us = Math.round(60000000 / res.tempo);
  const cond = [{ t: 0, o: 0, d: [0xff, 0x03, ...vlq(strBytes(res.title).length), ...strBytes(res.title)] },
    { t: 0, o: 0, d: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] },
    { t: 0, o: 0, d: [0xff, 0x58, 4, res.meter, 2, 24, 8] },
    { t: 0, o: 0, d: [0xff, 0x59, 2, ...keySig(res.key)] }];
  res.markers.forEach(m => { const b = strBytes(m.text); cond.push({ t: m.t, o: 1, d: [0xff, 0x06, ...vlq(b.length), ...b] }); });
  cond.push({ t: res.end, o: 9, d: [0xff, 0x01, 1, 32] });
  const chunks = [trackChunk(cond)];
  sel.forEach(tr => {
    const ev = []; const nb = strBytes(tr.name);
    ev.push({ t: 0, o: 0, d: [0xff, 0x03, ...vlq(nb.length), ...nb] });
    tr.cc.forEach(e => { if (!plain || e.c !== 1) ev.push({ t: e.t, o: 1, d: [0xb0, e.c, e.v] }); });
    if (!plain) tr.ks.forEach(k => { ev.push({ t: k.t, o: 3, d: [0x90, k.m, 100] }); ev.push({ t: k.t + 12, o: 2, d: [0x80, k.m, 0] }); });
    tr.notes.forEach(n => { ev.push({ t: n.t, o: 4, d: [0x90, n.m, n.v] }); ev.push({ t: n.t + n.dur, o: 2, d: [0x80, n.m, 0] }); });
    chunks.push(trackChunk(ev));
  });
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, chunks.length, (PPQ >> 8) & 255, PPQ & 255];
  const all = head.concat(...chunks);
  return new Uint8Array(all);
}
Y.writeMidi = writeMidi;

/* ================= main ================= */
function compose(o) {
  const era = ERAS[o.era] ? o.era : 'classical';
  const form = FORMS[o.form] ? o.form : 'minuet';
  const K = typeof o.key === 'string' ? keyFromName(o.key) : (o.key || keyFromName('C'));
  const E = new Set(o.inst && o.inst.length ? o.inst : PRESETS[era]);
  if (!['vln1', 'vln2', 'vla', 'vc', 'cb', 'fl', 'ob', 'cl', 'bsn', 'hn', 'pno', 'tpt', 'tbn', 'picc'].some(i => E.has(i))) E.add('vln1');
  const meter = o.meter || FORMS[form].meter;
  const seed = (o.seed >>> 0) || 1;
  const x = { era, form, K, E, meter, tempo: o.tempo || FORMS[form].tempo, len: clamp(o.len || 2, 1, 3), seed, r: mkRng(seed), rubato: o.rubato == null ? 1 : o.rubato, early: o.early == null ? 40 : o.early, scherzo: o.scherzo, solo: o.solo, feel: FEELINGS[o.feel] || null, feelId: FEELINGS[o.feel] ? o.feel : null };
  const c = new Comp(x);
  const st = ERAS[era];
  c.style = { melLo: st.melLo, melHi: st.melHi, melC: st.melC, appog: st.appog, avoid: st.avoid ? new Set(st.avoid) : null, bLo: 36, bHi: 57, bC: 46 };
  F[form](c, x);
  genBass(c);
  genMel(c);
  genBass(c, true);
  bassForMelPhrases(c);
  voiceAll(c);
  genCounter(c);
  const parts = render(c);
  const res = perform(c, parts);
  res.tempo = x.tempo; res.meter = meter; res.key = K; res.era = era; res.form = form;
  res.title = (o.title || FORMS[form].name) + ' in ' + keyName(K);
  res.keyName = keyName(K);
  res.feel = o.feel || null;
  res._c = c;
  return res;
}
/* ================= your own suite and the Mozart Advisor ================= */
const CAT = { sonata: 'fast', rondo: 'fast', overture: 'fast', fugue: 'fast', aria: 'slow', canon: 'slow', variations: 'slow', minuet: 'dance', waltz: 'dance', march: 'dance' };
Y.CAT = CAT;
Y.SUITE_FORMS = Object.keys(CAT);
Y.advise = function (chain, feel) {
  const n = chain.length, last = n ? chain[n - 1].form : null, lc = last ? CAT[last] : null;
  const used = f => chain.filter(c => c.form === f).length;
  return Y.SUITE_FORMS.map(f => {
    const c = CAT[f]; let st = 1, why = '';
    if (!n) {
      if (f === 'sonata') { st = 3; why = 'The classic first movement: strong and serious.'; }
      else if (f === 'overture') { st = 3; why = 'Raises the curtain on everything that follows.'; }
      else if (f === 'fugue') { st = 2; why = 'A learned, grand opening.'; }
      else if (c === 'dance') { st = 2; why = 'A light start, like a Baroque suite.'; }
      else if (f === 'rondo') { st = 1; why = 'Usually the finale. Save it for the end.'; }
      else { st = 1; why = 'A slow start is rare. Better after something lively.'; }
    } else {
      if (f === 'overture') { st = 0; why = 'An overture opens a work; it rarely follows anything.'; }
      else if (lc === 'fast' && c === 'slow') { st = 3; why = 'Slow after fast: the heart of the work.'; }
      else if (lc === 'fast' && c === 'dance') { st = 2; why = 'A dance after the drama gives air.'; }
      else if (lc === 'fast' && c === 'fast') { st = 0; why = 'Two fast parts in a row tire the ear.'; }
      else if (lc === 'slow' && c === 'dance') { st = 3; why = 'A dance lifts the mood after the slow part.'; }
      else if (lc === 'slow' && f === 'rondo') { st = 3; why = 'A bright finale that brings you home.'; }
      else if (lc === 'slow' && c === 'fast') { st = 2; why = 'Back to energy.'; }
      else if (lc === 'slow' && c === 'slow') { st = 0; why = 'Two slow parts in a row lose the pulse.'; }
      else if (lc === 'dance' && f === last) { st = 0; why = 'Mozart put a slow part between two of the same dance.'; }
      else if (lc === 'dance' && f === 'rondo') { st = 3; why = 'The classic finale after a dance.'; }
      else if (lc === 'dance' && c === 'slow') { st = 3; why = 'A slow song between the dances, as in a serenade.'; }
      else if (lc === 'dance' && c === 'fast') { st = 2; why = 'Energy after the dance.'; }
      else if (lc === 'dance' && c === 'dance') { st = 1; why = 'A second, different dance can work. Contrast helps.'; }
      if (f === 'sonata' && n >= 1 && st > 1) { st = 1; why = 'A second big sonata is heavy. A rondo is lighter.'; }
      if (f === 'fugue' && n >= 1 && st >= 2) why = 'A fugue makes a grand, learned finale.';
      if (used(f) >= 2 && st > 1) { st = 1; why = 'Already twice in your suite. Something new keeps it fresh.'; }
    }
    const fe = FEELINGS[feel];
    if (fe && fe.forms.includes(f) && st >= 1) { st = Math.min(3, st + 1); why += ' Fits ' + fe.name.toLowerCase() + '.'; }
    return { form: f, stars: st, why };
  }).sort((a, b) => b.stars - a.stars);
};
Y.suiteHint = function (chain) {
  if (!chain.length) return 'Start with a strong opening.';
  const fs = chain.map(c => FEELINGS[c.feel]).filter(Boolean);
  if (fs.length >= 2) {
    const a = fs[0], z = fs[fs.length - 1];
    if (a.mode === 'm' && z.mode === 'M') return 'From ' + a.name.toLowerCase() + ' to ' + z.name.toLowerCase() + ': a journey from dark to light. Beethoven loved that arc.';
    if (a.mode === 'M' && z.mode === 'm') return 'From light into shadow: a tragic arc. Strong, and rare.';
    if (z.soft && chain.length > 2) return 'It ends ' + z.name.toLowerCase() + '. A gentle farewell; a heroic or joyful finale would end in triumph.';
  }
  const last = CAT[chain[chain.length - 1].form];
  if (chain.length === 1) return 'Now something that contrasts with it.';
  if (last === 'fast') return 'This ends with energy. A fine close.';
  if (last === 'dance') return 'This ends with a dance. A rondo would close it in style.';
  return 'This ends softly. Lovely, or add a lively finale.';
};
Y.planSuite = function (chain, K, era) {
  const maj = K.m === 'M';
  const slowKeys = maj ? [relKey(K, 3, 'M'), relKey(K, 5, 'm'), relKey(K, 4, 'M')] : [relKey(K, 5, 'M'), relKey(K, 2, 'M'), relKey(K, 3, 'm')];
  let si = 0;
  const out = [];
  chain.forEach((c, i) => {
    const cat = CAT[c.form], prev = out[i - 1];
    if (prev && c.seed && prev.seed === c.seed && prev.form === c.form) { out.push(Object.assign({}, prev)); return; }
    let key = K;
    if (i > 0 && i < chain.length - 1) {
      if (cat === 'slow') key = slowKeys[si++ % slowKeys.length];
      else if (prev && prev.key === K && CAT[prev.form] === cat) key = maj ? relKey(K, 4, 'M') : relKey(K, 2, 'M');
    }
    let tempo = FORMS[c.form].tempo;
    const scherzo = c.form === 'minuet' && (era === 'romantic' || era === 'impressionist') && i > 0;
    if (scherzo) tempo = 160;
    if (prev && prev.form === c.form) tempo = Math.round(tempo * (i % 2 ? .92 : 1.06));
    if (i === chain.length - 1 && i > 0 && prev && prev.key !== K) key = K;
    const fe = FEELINGS[c.feel];
    if (fe) {
      if (i === chain.length - 1 && i > 0 && fe.mode !== K.m) key = mkKey(K.L, K.t, fe.mode);
      else if (fe.mode === 'm' && key.m === 'M') key = relKey(key, 5, 'm');
      else if (fe.mode === 'M' && key.m === 'm') key = relKey(key, 2, 'M');
      tempo = Math.round(tempo * fe.tempo);
    }
    out.push({ form: c.form, key, tempo, scherzo, seed: c.seed, feel: c.feel });
  });
  return out;
};
function mergeParts(parts, titles, labels) {
  const first = parts[0], master = first.tempo;
  const tracks = {}, markers = [], secs = [];
  let off = first.OFF;
  parts.forEach((m, i) => {
    const k = master / m.tempo, sh = t => Math.round(off + Math.max(0, t - m.OFF) * k);
    m.tracks.forEach(tr => {
      const T = tracks[tr.id] = tracks[tr.id] || { id: tr.id, name: tr.name, notes: [], cc: [], ks: [], ksType: tr.ksType };
      tr.notes.forEach(n => T.notes.push(Object.assign({}, n, { t: sh(n.t), dur: Math.max(20, Math.round(n.dur * k)) })));
      tr.cc.forEach(e => T.cc.push(Object.assign({}, e, { t: sh(e.t) })));
      tr.ks.forEach(e => T.ks.push(Object.assign({}, e, { t: Math.max(0, sh(e.t + 24) - 24) })));
    });
    markers.push({ t: off, text: titles[i] });
    m.markers.forEach(x => markers.push({ t: sh(x.t), text: x.text }));
    const end = sh(m.end);
    secs.push({ label: (FEELINGS[m.feel] ? FEELINGS[m.feel].icon + ' ' : '') + (labels ? labels[i] : (i + 1) + '. ' + FORMS[m.form].name.replace(' form', '').replace('Theme and v', 'V')), t0: off, t1: end, key: m.keyName, tempo: m.tempo });
    off = end + Math.round(PPQ * 2);
  });
  const ord = INST.map(i => i.id).filter(id => tracks[id]);
  return { tracks: ord.map(id => tracks[id]), end: off, OFF: first.OFF, markers, secs, tempo: master, meter: first.meter, key: first.key, keyName: first.keyName, era: first.era, form: 'suite', parts };
}

Y.generate = function (o) {
  if (o.form === 'suite') {
    const K = typeof o.key === 'string' ? keyFromName(o.key) : o.key;
    const plan = Y.planSuite(o.chain || [], K, o.era);
    if (!plan.length) throw new Error('Add at least one part to your suite.');
    const titles = [];
    const parts = plan.map((p, i) => { const t = (i + 1) + '. ' + FORMS[p.form].name + (p.scherzo ? ' (scherzo)' : ''); titles.push(t); return compose(Object.assign({}, o, { form: p.form, key: p.key, tempo: Math.round(p.tempo * (o.tempoMul || 1)), seed: p.seed, scherzo: p.scherzo, feel: p.feel || o.feel, title: t })); });
    const res = mergeParts(parts, titles.map((t, i) => t + ' in ' + parts[i].keyName));
    res.title = 'Suite in ' + keyName(K);
    return { movements: [res] };
  }
  if (o.form !== 'symphony') return { movements: [compose(o)] };
  const K = typeof o.key === 'string' ? keyFromName(o.key) : o.key;
  const KII = K.m === 'M' ? relKey(K, 3, 'M') : relKey(K, 5, 'M');
  const base = o.seed >>> 0;
  const t = o.tempo || 132;
  const mf = i => (o.mvFeels && o.mvFeels[i]) || o.feel;
  const mk = (i, key) => { const fe = FEELINGS[mf(i)]; if (!fe || fe.mode === key.m) return key; if (i === 3) return mkKey(K.L, K.t, fe.mode); return fe.mode === 'm' ? relKey(key, 5, 'm') : relKey(key, 2, 'M'); };
  const tm = i => FEELINGS[mf(i)] ? FEELINGS[mf(i)].tempo / (FEELINGS[o.feel] ? FEELINGS[o.feel].tempo : 1) : 1;
  const sch = o.era === 'romantic' || o.era === 'impressionist';
  const mv = [
    compose(Object.assign({}, o, { form: 'sonata', key: mk(0, K), seed: base + 1, tempo: Math.round(t * tm(0)), feel: mf(0), title: 'Symphony I. Allegro' })),
    compose(Object.assign({}, o, { form: o.len >= 3 ? 'variations' : 'aria', key: mk(1, KII), seed: base + 2, tempo: Math.round((o.len >= 3 ? t * .62 : t * .5) * tm(1)), feel: mf(1), title: 'Symphony II. Andante' })),
    compose(Object.assign({}, o, { form: 'minuet', key: mk(2, K), seed: base + 3, scherzo: sch, tempo: Math.round((sch ? 160 : t * .9) * tm(2)), feel: mf(2), title: sch ? 'Symphony III. Scherzo' : 'Symphony III. Menuetto' })),
    compose(Object.assign({}, o, { form: 'rondo', key: mk(3, K), seed: base + 4, tempo: Math.round(t * 1.08 * tm(3)), feel: mf(3), title: 'Symphony IV. Finale' })),
  ];
  mv.forEach((m, i) => { m.movement = i + 1; });
  const short = ['I. Allegro', 'II. Andante', sch ? 'III. Scherzo' : 'III. Menuetto', 'IV. Finale'];
  const res = mergeParts(mv, mv.map((m, i) => short[i] + ' in ' + m.keyName), short);
  res.title = 'Symphony in ' + keyName(K);
  return { movements: [res] };
};

/* ================= checks (used by the tests and the page) ================= */
Y.check = function (res) {
  if (res.parts) {
    const rs = res.parts.map(p => Y.check(p));
    return { parallels: rs.reduce((a, r) => a + r.parallels, 0), range: rs.reduce((a, r) => a + r.range, 0), notes: rs.reduce((a, r) => a + r.notes, 0), finalTonic: rs[rs.length - 1].finalTonic, melEndsTonic: true };
  }
  const c = res._c, rep = { parallels: 0, structural: 0, range: 0, finalTonic: false, notes: 0 };
  res.tracks.forEach(tr => { const inst = IM[tr.id]; tr.notes.forEach(n => { rep.notes++; if (n.m < inst.lo || n.m > inst.hi) rep.range++; }); });
  // structural voices at chord changes: melody, A, X, T, bass
  let prev = null;
  for (const ev of c.events) {
    if (ev.ph.poly || !ev.V) { prev = null; continue; }
    const m = ev.ph.melInBass ? null : sounding(c.mel, ev.t), b = sounding(c.bassCheck, ev.t);
    const cur = [ev.V[0], ev.V[1], ev.V[2], b, m];
    if (prev && prev.ev.t + prev.ev.dur === ev.t) {
      const pm = ev.ph.melInBass ? null : sounding(c.mel, ev.t - 1), pb = sounding(c.bassCheck, ev.t - 1);
      const pl = [prev.ev.V[0], prev.ev.V[1], prev.ev.V[2], pb, pm];
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
        const a1 = pl[i], a2 = cur[i], b1 = pl[j], b2 = cur[j];
        if (a1 == null || a2 == null || b1 == null || b2 == null || a1 === a2 || b1 === b2) continue;
        if (Math.sign(a2 - a1) !== Math.sign(b2 - b1)) continue;
        const i1 = Math.abs(a1 - b1) % 12, i2 = Math.abs(a2 - b2) % 12;
        if (i1 === i2 && (i1 === 0 || i1 === 7)) { rep.parallels++; if (i === 3 && j === 4) rep.structural++; (rep.pairs = rep.pairs || {})['AXTBM'[i] + 'AXTBM'[j]] = ((rep.pairs || {})['AXTBM'[i] + 'AXTBM'[j]] || 0) + 1; }
      }
    }
    prev = { ev };
  }
  // polyphonic voices
  if (c.voices) {
    const vs = c.vorder;
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
      const A = c.voices[vs[i]], B = c.voices[vs[j]];
      const onB = new Set(B.map(n => n.t));
      for (const n of A) {
        const t = n.t; if (!onB.has(t)) continue;
        const a1 = sounding(A, t - 1), a2 = n.m, b1 = sounding(B, t - 1), b2 = sounding(B, t);
        if (a1 == null || b1 == null || b2 == null || a1 === a2 || b1 === b2) continue;
        if (Math.sign(a2 - a1) !== Math.sign(b2 - b1)) continue;
        const i1 = Math.abs(a1 - b1) % 12, i2 = Math.abs(a2 - b2) % 12;
        if (i1 === i2 && (i1 === 0 || i1 === 7)) { rep.parallels++; rep.poly = (rep.poly || 0) + 1; }
      }
    }
  }
  const lastEv = c.events[c.events.length - 1];
  rep.finalTonic = lastEv.ch.root === res.key.t;
  const lastMel = c.mel.length ? c.mel[c.mel.length - 1] : null;
  rep.melEndsTonic = !lastMel || mod(lastMel.m, 12) === res.key.t || !!c.voices;
  return rep;
};
Y._internals = { parseTok, mkKey, keyFromName, line, evAt, sounding };

if (typeof module !== 'undefined' && module.exports) module.exports = Y;
else root.SYM = Y;
})(typeof window !== 'undefined' ? window : globalThis);
