// Divine Journey Machine: the planner (phase 1, no sound yet).
// Five Oracle words become five chapters. Every choice is made here, from the words and the seed,
// so phase 2 only has to turn this plan into notes.
const JP = {};

// ---------- seeded random ----------
JP.rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
JP.hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));
const pickW = (r, items, w) => { const tot = w.reduce((a, b) => a + Math.max(0, b), 0); let x = r() * tot; for (let i = 0; i < items.length; i++) { x -= Math.max(0, w[i]); if (x <= 0) return items[i]; } return items[items.length - 1]; };

// ---------- the character of a word ----------
// dims: light, speed, warm, weight, tension, world   (each -1 .. 1, world 0 .. 1)
JP.DIMS = ['light', 'speed', 'warm', 'weight', 'tension', 'world'];
const LEX = [
  ['light', -0.9, /shadow|midnight|dark|black|obsidian|onyx|abyss|void|night|noct|haunt|ghost|buried|drown|sunk|ash|char|tar$|ink|ebony|^jet|storm|thunder|fear|rage|grief|sorrow|exile|collapse|eclipse|phantom|spect|curse|wicked|gothic|moonless|starless|sunless|dim|shade|dusk|smoke|graphite|coal|cellar|cave|tunnel|vault|requiem|elegy|absence|lurk|creep/i],
  ['light', 0.9, /sun|gold|bright|radiant|shin|glow|gleam|spark|dawn|morning|noon|summer|lumin|joy|bliss|euphor|glory|halo|paradise|crystal|diamond|pearl|white|snow|ivory|celest|stell|star|holy|blessed|divine|glimmer|shimmer|twinkl|lemon|cream|milk|chalk|rainbow|prism|beacon|lighthouse|lantern|candle|hope|grace|heaven|daybreak|zenith|apex|ascen|rise|rising/i],
  ['speed', 0.9, /rapid|swift|quick|fast|racing|rush|frantic|manic|hyper|electric|kinetic|bounc|jump|leap|run|chas|hunt|rocket|blast|explod|burst|erupt|charg|driv|pump|hammer|drill|surg|crash|break|glitch|stutter|accelerat|hurtl|careen|barrel|launch|thunder|skip|hop|danc|spin|whirl|swirl|frenz|urgent|hast|brisk|lively|nimble|agile|fleet|train|taxi|rail|runway|motor|engine|turbine|piston|velocity|momentum|tempo|pulse|ticking|clicking/i],
  ['speed', -0.9, /slow|still|calm|serene|tranquil|placid|lazy|idle|sleep|dream|float|drift|weightless|meditat|prayer|lullaby|requiem|elegy|mist|fog|haze|silent|quiet|tender|gentle|soft|mellow|peace|frozen|ancient|timeless|eternal|ageless|stone|marble|monument|statue|fossil|relic|shrine|chapel|cathedral|lagoon|pond|lake|harbor|harbour|haven|sanctuary|shelter|refuge|reverie|nostalgia|memory|longing|sorrow|grief|patient|steady|linger|sunken|sinking|descen/i],
  ['warm', 0.9, /warm|honey|amber|golden|gold|copper|bronze|brass|saffron|cinnamon|ginger|coffee|cocoa|caramel|ember|flame|fire|sun|tropic|desert|savanna|jungle|soul|funk|groov|swing|heart|love|passion|devotion|carnival|bazaar|market|danc|spic|sweet|velvet|silk|satin|wool|cotton|linen|leather|wood|cedar|oak|walnut|mahogany|rose|cherry|peach|apricot|coral|salmon|wine|claret|burgundy|henna|cafe|diner|lounge|ballroom|disco|club|bar$|hearth|candle|lamp|blues|jazz|bluesy|jazzy|soulful|funky|comfort|joy/i],
  ['warm', -0.9, /cold|icy|ice|frost|frozen|arctic|polar|glacier|winter|snow|steel|chrome|iron|digital|virtual|synthetic|plastic|quantum|atomic|code|algorithm|logic|grid|matrix|circuit|voltage|vacuum|glass|tundra|silver|platinum|titanium|nickel|zinc|tin|mercury|metallic|neon|laser|plasma|static|concrete|cube|module|unit|cell|terminal|station|satellite|antenna|transmitter|receiver|sequencer|oscillator|filter|protocol|function|variable|equation|formula|vector|axis|node|vertex|zero|cipher|mirror|chrome|clinical|lonely|empty|hollow|nowhere/i],
  ['weight', 0.9, /heavy|dense|thick|deep|low|iron|stone|granite|concrete|lead$|mountain|fortress|citadel|castle|throne|cathedral|temple|monument|gravity|mass|weight|pound|thump|boom|roar|rumbl|grind|fierce|savage|furious|thunder|drum|gong|organ|bass|tank|barrel|anchor|hull|ship|submarine|train|foundry|factory|warehouse|mill|piston|hammer|volcan|lava|magma|abyss|titan|uranium|imperial|majestic|grand|royal|regal|crown|sword|shield|march|stomp|tribal|totem|odyssey|saga|anthem|glory|triumph|victory/i],
  ['weight', -0.9, /light$|airy|ethereal|feather|wing|gossamer|lace|gauze|silk|petal|leaf|bubble|balloon|kite|cloud|mist|breath|whisper|thin|sparse|fragile|delicate|glass|crystal|snowflake|spark|twinkl|flute|harp|lyre|bell|chime|ribbon|thread|paper|pastel|blush|lilac|lavender|mint|pale|weightless|floating|float|drift|bodiless|formless/i],
  ['tension', 0.9, /tension|dissonance|chaos|fear|threat|haunt|lurk|stalk|prowl|creep|crawl|sneak|risk|hazard|omen|riddle|enigma|mystery|paradox|toxic|radioactive|nuclear|abyss|void|rebellion|revolution|cipher|rage|angry|furious|savage|feral|wicked|curse|nervous|jitter|shaky|frantic|manic|urgent|pressing|relentless|distort|overdriven|glitch|fractur|splinter|shatter|crack|broken|jagged|sharp|thorn|fang|claw|sword|arrow|storm|thunder|lightning|eclipse|exile|escape|collapse|fall|descent|phantom|spectral|ghost|uncanny|labyrinth|maze|warning|siren|alarm|acid/i],
  ['tension', -0.9, /calm|serene|tranquil|placid|peace|mellow|gentle|tender|soft|comfort|shelter|refuge|haven|sanctuary|paradise|utopia|bliss|grace|mercy|love|hope|faith|joy|harmony|balance|symmetry|lullaby|serenade|prayer|meditation|home|garden|meadow|lagoon|pond|oasis|sunrise|dawn|morning|honey|cream|velvet|cotton|linen|warm|cosy|cozy|sweet|lucky|dear|free|liberty|freedom|truce|accord|pact|promise|rebirth|revival|awakening/i],
  ['world', 1, /tribal|ritual|ceremony|totem|mask|shrine|temple|altar|drum|gong|bazaar|market|savanna|jungle|desert|oasis|tropic|island|caravan|pilgrim|chant|spice|henna|kohl|saffron|bamboo|polyrhythm|carnival|parade|pagan|mystic|mythic|sacred|holy|ancient|rustic|sandy|coastal|oceanic|tidal|canoe|raft|hut|village|prairie|ranch|farm|harvest|mosaic|fresco|lyre|harp|flute|banjo|bell|cymbal|horn|ochre|umber|sienna|clay|cinnabar|vermilion|woad|lapis|jade|malachite|turquoise|coral|reef|lagoon|savage|feral|wild|dancing|swaying|chanting|singing|calling|hymn|ritual|legend|myth|fable|saga|pilgrimage|migration|journey|voyage|odyssey|quest|expedition|nomad|exodus|genesis|rune|glyph|oracle|prophecy|spirit|soul/i],
];
const WHEEL_BIAS = { W1: { light: 0.15 }, W2: { speed: 0.35, tension: 0.1 }, W3: { warm: 0.2 }, W4: { weight: 0.15, world: 0.1 }, W5: { tension: 0.05 } };
JP.character = (word, wheel) => {
  const w = String(word), lw = w.toLowerCase(), c = { light: 0, speed: 0, warm: 0, weight: 0, tension: 0, world: 0 };
  // the sound of the word: bright vowels lift, dark vowels sink, hard consonants push, soft ones glide
  const v = (lw.match(/[aeiouy]/g) || []), bright = v.filter((x) => 'iey'.includes(x)).length, dark = v.filter((x) => 'ou'.includes(x)).length;
  const hard = (lw.match(/[ktpxzqcgbd]/g) || []).length, soft = (lw.match(/[lmnrswvhf]/g) || []).length;
  c.light += 0.25 * (bright - dark) / Math.max(1, v.length);
  c.speed += 0.3 * (hard - soft) / Math.max(1, hard + soft) - (lw.length > 8 ? 0.12 : 0);
  c.weight += lw.length > 8 ? 0.15 : lw.length < 5 ? -0.12 : 0;
  c.tension += /[kxzq]/.test(lw) ? 0.12 : 0;
  // what the word means (strongest signal)
  for (const [dim, val, re] of LEX) if (re.test(lw)) c[dim] += val;
  for (const [dim, val] of Object.entries(WHEEL_BIAS[wheel] || {})) c[dim] += val * (dim === 'world' ? 1 : Math.sign(c[dim] || 1));
  // a little personal colour per word, always the same for the same word
  const r = JP.rng(JP.hash(w));
  for (const d of JP.DIMS) c[d] = d === 'world' ? clamp(c[d] + r() * 0.35, 0, 1) : clamp(c[d] + (r() - 0.5) * 0.8);
  return c;
};

// ---------- the machines and their arts ----------
// vector order: light, speed, warm, weight, tension, world.  bpm = where the art feels at home.
const A = (machine, name, v, bpm, extra = {}) => ({ machine, name, v: { light: v[0], speed: v[1], warm: v[2], weight: v[3], tension: v[4], world: v[5] }, bpm, ...extra });
JP.MACHINES = {
  studio: { name: 'Studio', icon: '', gift: 'timing, groove and stabs' },
  percussion: { name: 'Percussion', icon: '', gift: 'world rhythms and call and response' },
  score: { name: 'Score', icon: '', gift: 'tension that builds and lets go' },
  symphony: { name: 'Symphony', icon: '', gift: 'voice leading, phrasing and breath' },
};
JP.ARTS = [
  A('studio', 'Techno', [-0.2, 0.6, -0.4, 0.5, 0.3, 0], 126), A('studio', 'Trip hop', [-0.5, -0.5, 0.1, 0.4, 0.3, 0], 88), A('studio', 'Hip hop', [0, -0.3, 0.4, 0.4, 0, 0.1], 90),
  A('studio', 'New wave', [0.1, 0.5, -0.3, 0, 0.1, 0], 126), A('studio', 'Blues', [-0.2, -0.3, 0.7, 0.2, 0, 0], 92), A('studio', 'House', [0.4, 0.4, 0.5, 0.2, -0.3, 0], 124),
  A('studio', 'Acid', [-0.1, 0.7, -0.2, 0.3, 0.6, 0], 130), A('studio', 'Trance', [0.7, 0.7, 0, 0.1, 0.1, 0], 136), A('studio', 'Eurodance', [0.8, 0.7, 0.3, 0, -0.4, 0], 132),
  A('studio', 'Breakbeat', [0, 0.8, 0.1, 0.4, 0.3, 0], 140), A('studio', 'EBM', [-0.6, 0.5, -0.6, 0.6, 0.6, 0], 122), A('studio', 'Drum and bass', [-0.1, 1, -0.1, 0.5, 0.4, 0.1], 174),
  A('studio', 'UK garage', [0.2, 0.6, 0.3, 0.2, 0, 0], 132), A('studio', 'Dub', [-0.3, -0.7, 0.4, 0.7, 0, 0.3], 74), A('studio', 'Synthwave', [0.3, 0, -0.1, 0.1, 0, 0], 100),
  A('studio', 'Funk and disco', [0.6, 0.3, 0.9, 0.2, -0.4, 0.1], 112), A('studio', 'Dub techno', [-0.4, 0.3, -0.2, 0.5, 0.1, 0], 120), A('studio', 'Minimal techno', [-0.1, 0.4, -0.3, 0.1, 0.1, 0], 126),
  A('studio', 'Ambient', [0.3, -1, 0, -0.6, -0.3, 0], 72), A('studio', 'Chillout', [0.5, -0.4, 0.5, -0.3, -0.5, 0.1], 96), A('studio', 'Club', [0.3, 0.5, 0.2, 0.3, 0, 0], 125),
  A('studio', 'Divine Monday', [0, 0.5, 0.2, 0.4, 0.3, 0], 125), A('studio', 'Singer songwriter', [0.3, -0.4, 0.6, -0.3, -0.3, 0], 92),
  A('percussion', 'West Africa', [0.4, 0.5, 0.9, 0.3, 0, 1], 120), A('percussion', 'Afro-Cuban', [0.5, 0.5, 0.9, 0.2, -0.1, 1], 110), A('percussion', 'Brazil', [0.8, 0.8, 0.9, 0.1, -0.2, 1], 128),
  A('percussion', 'Middle East', [-0.1, 0.2, 0.6, 0.2, 0.3, 1], 100), A('percussion', 'India', [0.2, 0.3, 0.6, 0, 0.2, 1], 105), A('percussion', 'Japanese zen', [0.1, -0.8, -0.2, -0.3, -0.2, 0.9], 70),
  A('percussion', 'Shamanic', [-0.5, -0.1, 0.3, 0.6, 0.4, 1], 95), A('percussion', 'Minimal house', [0.1, 0.4, 0.2, 0, -0.1, 0.4], 122), A('percussion', 'Taiko', [-0.2, 0.4, 0.1, 1, 0.6, 0.9], 110),
  A('percussion', 'Marching', [0.2, 0.4, -0.1, 0.5, 0.2, 0.3], 116), A('percussion', 'Powwow', [0.1, 0.3, 0.5, 0.5, 0.2, 1], 104),
  A('score', 'Playful', [0.7, 0.5, 0.5, -0.4, -0.4, 0], 116), A('score', 'Tense', [-0.4, 0.3, -0.3, 0.3, 0.9, 0], 100), A('score', 'Fearful', [-0.7, 0.2, -0.5, 0.3, 1, 0], 96),
  A('score', 'Chase', [-0.2, 1, -0.2, 0.4, 0.7, 0], 150), A('score', 'Wonder', [0.7, -0.2, 0.3, -0.2, 0, 0], 90), A('score', 'Mysterious', [-0.5, -0.3, -0.1, 0, 0.6, 0.2], 84),
  A('score', 'Tender', [0.4, -0.6, 0.7, -0.6, -0.5, 0], 76), A('score', 'Uncanny', [-0.6, -0.2, -0.6, 0, 0.8, 0], 88), A('score', 'Light', [0.9, 0.2, 0.3, -0.6, -0.6, 0], 108),
  A('score', 'Euphoric', [0.9, 0.7, 0.5, 0.2, -0.3, 0], 128), A('score', 'Glory', [0.8, 0.3, 0.4, 0.8, -0.1, 0], 100), A('score', 'Dark', [-1, -0.2, -0.3, 0.7, 0.5, 0], 84),
  A('score', 'Nostalgic', [0.1, -0.5, 0.6, -0.2, -0.2, 0], 84), A('score', 'Hope', [0.6, 0, 0.5, 0, -0.3, 0], 96), A('score', 'Triumph', [0.8, 0.5, 0.3, 0.9, 0, 0], 112),
  A('score', 'Dreamy', [0.4, -0.8, 0.3, -0.5, -0.3, 0], 76), A('score', 'Serenity', [0.5, -0.9, 0.4, -0.4, -0.8, 0], 70), A('score', 'Sunrise', [1, -0.3, 0.5, 0, -0.5, 0], 84),
  A('score', 'Heartbreak', [-0.4, -0.6, 0.4, 0, 0.2, 0], 72), A('score', 'Lonely', [-0.4, -0.7, -0.3, -0.4, 0, 0], 72),
  A('symphony', 'Overture', [0.5, 0.5, 0.3, 0.6, 0.2, 0], 120), A('symphony', 'March', [0.3, 0.4, 0, 0.7, 0.2, 0], 116), A('symphony', 'Waltz', [0.6, 0.2, 0.6, -0.2, -0.2, 0], 150, { meter: 3 }),
  A('symphony', 'Aria', [0.3, -0.6, 0.7, -0.3, -0.2, 0], 66), A('symphony', 'Fugue', [-0.1, 0.4, -0.2, 0.3, 0.5, 0], 100), A('symphony', 'Canon', [0.4, 0, 0.2, -0.1, 0, 0], 88),
  A('symphony', 'Variations', [0.3, 0.2, 0.3, 0.1, 0, 0], 100), A('symphony', 'Rondo', [0.7, 0.6, 0.5, 0, -0.3, 0], 126), A('symphony', 'Sonata allegro', [0.4, 0.6, 0.2, 0.4, 0.3, 0], 132),
  A('symphony', 'Minuet', [0.6, 0.1, 0.4, 0, -0.3, 0], 112, { meter: 3 }), A('symphony', 'Adagio', [0, -0.9, 0.5, 0.2, 0.1, 0], 60),
];
JP.dist = (a, b) => JP.DIMS.reduce((s, d) => s + (a[d] - b[d]) ** 2 * (d === 'world' ? 1.2 : 1), 0);

// ---------- the rack ----------
// range = the notes the instrument plays well; drums = a drum plugin (only plays drum roles)
JP.RACK = {
  beats: { name: 'Beats', icon: '', items: ['XO', 'Impact', 'EZdrummer', 'Virtual Drummer', 'Beatmaker', 'Tekno'] },
  perc: { name: 'Percussion', icon: '', items: ['XO', 'Impact', 'EZdrummer', 'Virtual Drummer', 'Beatmaker', 'Tekno', 'PERRCS'] },
  melody: { name: 'Melody', icon: '', items: ['Usynth', 'Iron', 'Silk', 'Carbon', 'Cinedream', 'Virtual Pianist Score', 'Berlin', 'BBC'] },
  chords: { name: 'Chords', icon: '', items: ['Usynth', 'Virtual Pianist Score', 'Iron', 'Silk', 'Carbon', 'Cinedream', 'Berlin', 'BBC', 'STRIIIINGS'] },
  bass: { name: 'Bass', icon: '', items: ['SubCraft', 'Royal', 'Slap', 'Usynth', 'Berlin', 'BBC'] },
  orch: { name: 'Orchestra', icon: '', items: ['STRIIIINGS', 'Berlin', 'BBC'] },
};
JP.PLAIN = 'Plain MIDI';
JP.INSTR = {
  'XO': { drums: 1 }, 'Impact': { drums: 1 }, 'EZdrummer': { drums: 1 }, 'Virtual Drummer': { drums: 1 }, 'Beatmaker': { drums: 1 }, 'Tekno': { drums: 1 }, 'PERRCS': { drums: 1 },
  'Usynth': { range: [24, 108] }, 'Iron': { range: [40, 88] }, 'Silk': { range: [40, 88] }, 'Carbon': { range: [40, 88] }, 'Cinedream': { range: [40, 88] },
  'Virtual Pianist Score': { range: [21, 108] }, 'SubCraft': { range: [24, 64] }, 'Royal': { range: [28, 67] }, 'Slap': { range: [28, 67] },
  'STRIIIINGS': { range: [28, 96] }, 'Berlin': { range: [28, 100] }, 'BBC': { range: [28, 100] },
};
JP.ROLE_REG = { melody: [62, 86], chords: [50, 74], bass: [31, 55], orch: [40, 88], beats: null, perc: null };
JP.ROLE_NAME = { beats: 'Beat', perc: 'Percussion', melody: 'Melody', chords: 'Chords', bass: 'Bass', orch: 'Orchestra' };
JP.defaultRack = () => Object.fromEntries(Object.keys(JP.RACK).map((k) => [k, [JP.PLAIN]]));
JP.ROLE_ORDER = ['beats', 'perc', 'bass', 'chords', 'melody', 'orch'];
// every instrument that can play a role: its own pot first, then the ones that fit from the other pots
JP.roleOptions = (role) => { const out = [JP.PLAIN, ...JP.RACK[role].items];
  for (const inst of Object.keys(JP.INSTR)) { if (out.includes(inst)) continue; const i = JP.INSTR[inst];
    if (role === 'beats' || role === 'perc') { if (i.drums ? !i.kickOnly : i.range && i.range[1] - i.range[0] >= 48) out.push(inst); }
    else if (fits(inst, role)) out.push(inst); }
  return out; };
const fits = (inst, role) => { if (inst === JP.PLAIN) return true; const i = JP.INSTR[inst] || {}; const reg = JP.ROLE_REG[role];
  if (!reg) return !!i.drums; if (i.drums) return false; return i.range && i.range[0] <= reg[0] && i.range[1] >= reg[1]; };

// which roles each leader brings to the stage, strongest first
JP.ROLES = {
  studio: ['beats', 'bass', 'chords', 'melody', 'perc', 'orch'],
  percussion: ['perc', 'beats', 'bass', 'melody', 'chords', 'orch'],
  score: ['orch', 'perc', 'bass', 'melody', 'beats', 'chords'],
  symphony: ['orch', 'melody', 'bass', 'chords', 'perc', 'beats'],
};
const PREFER = { orch: { symphony: ['Berlin', 'BBC'], score: ['STRIIIINGS'] }, perc: { score: ['PERRCS'], percussion: ['XO', 'Beatmaker', 'Impact'] }, beats: { studio: ['XO', 'Tekno', 'Impact'] } };

// ---------- arcs, openings, endings ----------
JP.ARCS = [
  { id: 'wave', name: 'One great wave', f: (t) => (t < 0.65 ? 0.2 + 0.8 * Math.sin(Math.PI / 2 * t / 0.65) : 0.2 + 0.8 * Math.cos(Math.PI / 2 * (t - 0.65) / 0.35)) },
  { id: 'three', name: 'Three waves', f: (t) => 0.45 + 0.4 * Math.sin(t * Math.PI * 5 - 1.3) * (0.7 + 0.3 * t) },
  { id: 'dawn', name: 'Dark start, light summit', f: (t) => 0.15 + 0.8 * Math.pow(t, 1.4) - (t > 0.9 ? (t - 0.9) * 3 : 0) },
  { id: 'summit', name: 'Begins on the summit', f: (t) => 0.95 - 0.6 * t + 0.35 * Math.sin(t * Math.PI * 2.2) * t },
  { id: 'open', name: 'Open ending', f: (t) => 0.25 + 0.7 * t + 0.1 * Math.sin(t * 9) },
  { id: 'valley', name: 'Valley', f: (t) => 0.9 - 1.3 * Math.sin(Math.PI * t) * 0.55 },
  { id: 'plateau', name: 'High plateau', f: (t) => (t < 0.2 ? 0.3 + 3 * t : t > 0.8 ? 0.9 - 3 * (t - 0.8) : 0.9) },
  { id: 'twin', name: 'Two summits, the second higher', f: (t) => 0.25 + 0.5 * Math.exp(-((t - 0.3) ** 2) / 0.012) + 0.7 * Math.exp(-((t - 0.75) ** 2) / 0.015) },
];
JP.OPENINGS = [
  { id: 'awaken', name: 'Awakening', start: 0.08, desc: 'soft, from nothing to something', likes: { speed: -1, tension: -0.5 } },
  { id: 'threat', name: 'Threat', start: 0.45, desc: 'dark, menacing drums', likes: { tension: 1, light: -1 } },
  { id: 'midst', name: 'In the middle of it', start: 0.7, desc: 'straight into a swinging groove', likes: { speed: 1, warm: 0.8 } },
  { id: 'motif', name: 'The motif alone', start: 0.12, desc: 'bare, like a question', likes: { weight: -1, speed: -0.4 } },
  { id: 'bang', name: 'A bang', start: 0.95, desc: 'straight onto the summit', likes: { weight: 1, speed: 0.8 } },
];
JP.ENDINGS = [
  { id: 'sunrise', name: 'Sunrise', desc: 'bright and open', likes: { light: 1, tension: -0.5 } },
  { id: 'home', name: 'Homecoming', desc: 'the motif bare again, like the start', likes: { warm: 1, weight: -0.4 } },
  { id: 'fade', name: 'Fading', desc: 'layer by layer away', likes: { speed: -1, light: -0.3 } },
  { id: 'abrupt', name: 'Abrupt', desc: 'a hard stop', likes: { speed: 1, tension: 1 } },
];
JP.TRANSITIONS = {
  bassout: { name: 'Bass out and back', icon: '◢' }, filter: { name: 'Filter bridge', icon: '≈' }, motif: { name: 'Motif bridge', icon: '◇' },
  cut: { name: 'Hard cut', icon: '|' }, riser: { name: 'Riser', icon: '↗' }, breath: { name: 'Breath', icon: '○' },
};
JP.FEELS = [
  { id: 'straight', name: 'straight', ratio: 1 }, { id: 'half', name: 'halftime', ratio: 0.5 },
  { id: 'triplet', name: 'triplet feel', ratio: 2 / 3 }, { id: 'double', name: 'double time', ratio: 2 },
];
JP.KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const likeScore = (likes, c) => Object.entries(likes).reduce((s, [d, w]) => s + w * c[d], 0);

// arts that sit close to many words would win too often; this evens the chances out
let POP = null;
JP.popularity = (allWords) => { if (POP) return POP; if (!allWords) return JP.ARTS.map(() => 1);
  const tot = JP.ARTS.map(() => 0);
  for (const [wheel, list] of Object.entries(allWords)) for (const word of list) { const c = JP.character(word, wheel);
    const e = JP.ARTS.map((a) => Math.exp(-JP.dist(c, a.v) * 1.5)), s = e.reduce((x, y) => x + y, 0); e.forEach((v, i) => { tot[i] += v / s; }); }
  const mean = tot.reduce((x, y) => x + y, 0) / tot.length; POP = tot.map((t) => Math.pow(mean / t, 0.8)); return POP; };

// ---------- song forms for a Mixed journey: [section, weight] ----------
JP.SONGS = {
  club: [['intro', 2], ['build', 2], ['drop', 3], ['break', 1.5], ['build', 1.5], ['drop', 3.5], ['outro', 2]],
  verse: [['intro', 1.5], ['verse', 2], ['chorus', 2], ['verse', 2], ['chorus', 2], ['break', 1.5], ['chorus', 2.5], ['outro', 1.5]],
  slow: [['intro', 2], ['rise', 3], ['peak', 3], ['fall', 2.5], ['outro', 2]],
};
JP.SONG_E = { intro: 0.12, verse: 0.5, build: 0.6, rise: 0.55, chorus: 0.88, drop: 1, peak: 1, break: 0.25, fall: 0.4, outro: 0.1 };
JP.ENGINE_TYPE = { intro: 'intro', verse: 'verse', build: 'build', rise: 'prechorus', chorus: 'chorus', drop: 'drop', peak: 'chorus', break: 'break', fall: 'break', outro: 'outro' };
// the energy of a song at u (0..1), smooth between sections
JP.songEnergy = (x, u) => { const S = x.song; let k = S.findIndex((q) => u < q.u1); if (k < 0) k = S.length - 1; const q = S[k];
  const f = (u - q.u0) / Math.max(1e-6, q.u1 - q.u0), nx = S[k + 1], pv = S[k - 1];
  let e = q.e; if (nx && f > 0.75) e = q.e + (nx.e - q.e) * (f - 0.75) / 0.25 * 0.5; if (pv && f < 0.25) e = q.e + (pv.e - q.e) * (0.25 - f) / 0.25 * 0.5;
  return x.lo + (x.hi - x.lo) * e; };

// ---------- the plan ----------
// words: [{wheel, word}] x5; opts: {seed, minutes, rack, recent: [art names]}
JP.plan = (words, opts = {}) => {
  const seed = (opts.seed >>> 0) ^ JP.hash(words.map((w) => w.word).join('|'));
  const ov = opts.ov || [];
  const r = JP.rng(seed), minutes = opts.minutes || 40, rack = opts.rack || JP.defaultRack(), recent = new Set(opts.recent || []);
  const ch = words.map((w) => ({ word: w.word, wheel: w.wheel, c: JP.character(w.word, w.wheel) }));
  const n = ch.length, avg = Object.fromEntries(JP.DIMS.map((d) => [d, ch.reduce((s, x) => s + x.c[d], 0) / n]));

  // arc: the words choose its shape (with the dice)
  const arcW = JP.ARCS.map((a) => { const e = [0.1, 0.3, 0.5, 0.7, 0.9].map(a.f); const pk = e.indexOf(Math.max(...e));
    return 1 + 0.6 * clamp(avg.speed + avg.weight, 0, 2) * (a.id === 'summit' || a.id === 'plateau' ? 1 : 0) + 0.6 * clamp(-avg.light, 0, 1) * (a.id === 'dawn' ? 1 : 0) + 0.5 * clamp(avg.tension, 0, 1) * (a.id === 'three' || a.id === 'valley' ? 1 : 0) + (pk === 4 && ch[4].c.speed > 0 ? 0.4 : 0); });
  const arc = pickW(r, JP.ARCS, arcW);
  const opening = pickW(r, JP.OPENINGS, JP.OPENINGS.map((o) => Math.exp(1.4 * likeScore(o.likes, ch[0].c))));
  const ending = pickW(r, JP.ENDINGS, JP.ENDINGS.map((o) => Math.exp(1.4 * likeScore(o.likes, ch[n - 1].c))));

  // chapter lengths, never equal
  const lw = ch.map(() => 0.7 + r() * 0.7), lt = lw.reduce((a, b) => a + b, 0);
  let t0 = 0; ch.forEach((x, i) => { x.share = lw[i] / lt; x.t0 = t0; t0 += x.share; x.t1 = t0; });

  // energy per chapter from the arc; the opening sets the very first moment
  const E = (t) => clamp(arc.f(t), 0.05, 1);
  ch.forEach((x, i) => { x.eStart = i === 0 ? opening.start : E(x.t0); x.eEnd = E(x.t1); x.energy = (x.eStart + 2 * E((x.t0 + x.t1) / 2) + x.eEnd) / 4; });
  if (ending.id === 'fade' || ending.id === 'home') ch[n - 1].eEnd = 0.08; if (ending.id === 'abrupt') ch[n - 1].eEnd = Math.max(0.8, ch[n - 1].eEnd);
  if (ending.id === 'sunrise') ch[n - 1].eEnd = Math.max(0.45, ch[n - 1].eEnd);

  // leaders: each word picks its art from the pots; no art twice in one journey, recent journeys weigh less
  const used = new Set(), leadCount = {};
  ch.forEach((x, i) => {
    const cv = { ...x.c, speed: clamp(x.c.speed * 0.7 + (x.energy - 0.5) * 0.8), weight: clamp(x.c.weight * 0.8 + (x.energy - 0.5) * 0.4) };
    if (i === 0 && opening.id === 'threat') { cv.tension = 1; cv.light = -0.8; }
    if (i === 0 && opening.id === 'midst') { cv.speed = Math.max(cv.speed, 0.4); cv.warm = Math.max(cv.warm, 0.5); }
    // a word with a strong character chooses sharply; a quiet word leaves more to the dice
    const mag = Math.sqrt(JP.DIMS.reduce((s2, d) => s2 + x.c[d] ** 2, 0)), k = 0.35 + 2.4 * Math.min(1, mag / 1.1);
    const pop = JP.popularity(opts.allWords), w = JP.ARTS.map((a, ai) => used.has(a.name) ? 0 : Math.exp(-JP.dist(cv, a.v) * k) * pop[ai] * (recent.has(a.name) ? 0.35 : 1) * (leadCount[a.machine] ? (a.machine === 'symphony' ? 0 : 0.5 ** leadCount[a.machine]) : 1) * (0.6 + r() * 0.8));
    const ovL = ov[i] && ov[i].lead && JP.ARTS.find((a) => a.name === ov[i].lead);
    x.lead = ovL || pickW(r, JP.ARTS, w); used.add(x.lead.name); leadCount[x.lead.machine] = (leadCount[x.lead.machine] || 0) + 1;
    // one or two guests from other machines: the cross-over
    const gn = x.energy > 0.55 && r() < 0.6 ? 2 : 1, gm = new Set([x.lead.machine]); x.guests = [];
    for (let g = 0; g < gn; g++) { const gw = JP.ARTS.map((a) => gm.has(a.machine) || used.has(a.name) ? 0 : Math.exp(-JP.dist(cv, a.v) * 1.5) * (0.5 + r()));
      if (gw.every((v) => v <= 0)) break; const gA = pickW(r, JP.ARTS, gw); x.guests.push(gA); gm.add(gA.machine); used.add(gA.name); }
  });

  // an ode to every machine: each one leads or guests at least once
  for (const m of Object.keys(JP.MACHINES)) {
    if (ch.some((x) => x.lead.machine === m || x.guests.some((g) => g.machine === m))) continue;
    let bestS = null;
    ch.forEach((x, i) => JP.ARTS.forEach((a) => { if (a.machine !== m || used.has(a.name)) return; const d = JP.dist(x.c, a.v); if (!bestS || d < bestS.d) bestS = { d, i, a }; }));
    if (!bestS) continue; const x = ch[bestS.i];
    if (x.guests.length < 2) x.guests.push(bestS.a); else { used.delete(x.guests[1].name); x.guests[1] = bestS.a; }
    used.add(bestS.a.name);
  }

  // your own choices for the guests win over the dice
  ch.forEach((x, i) => { const o = ov[i] || {}; ['g1', 'g2'].forEach((g, gi) => { if (!(g in o)) return;
    const a = o[g] === 'none' ? null : JP.ARTS.find((t) => t.name === o[g]); const rest = x.guests.filter((_, k) => k !== gi);
    x.guests = gi === 0 ? [a, ...rest.slice(0, 1)] : [x.guests[0], a]; x.guests = x.guests.filter(Boolean); }); });

  // one tempo for the whole journey; each chapter finds its own feel on top of it
  let best = null;
  for (let b = 96; b <= 130; b++) { let cost = Math.abs(b - 120) / 300; // a journey walks best around 120 for (const x of ch) cost += Math.min(...JP.FEELS.map((f) => Math.abs(b * f.ratio - x.lead.bpm) / x.lead.bpm + (f.id === 'straight' ? 0 : 0.02)));
    cost += r() * 0.04; if (!best || cost < best.cost) best = { b, cost }; }
  const bpm = opts.bpm || best.b;
  ch.forEach((x, i) => { x.feel = JP.FEELS.reduce((a, f) => (Math.abs(bpm * f.ratio - x.lead.bpm) < Math.abs(bpm * a.ratio - x.lead.bpm) ? f : a));
    if (ov[i] && ov[i].feel) x.feel = JP.FEELS.find((f) => f.id === ov[i].feel) || x.feel; x.feelsLike = Math.round(bpm * x.feel.ratio); });

  // bars: every chapter a whole number of 8-bar phrases
  const totalBars = minutes * bpm / 4;
  ch.forEach((x) => { x.bars = Math.max(16, Math.round(totalBars * x.share / 8) * 8); x.minutes = x.bars * 4 / bpm; });

  // breaths: one, sometimes two, never next to each other, mostly after something big
  const nb = r() < 0.4 ? 2 : 1, spots = [];
  for (let i = 1; i < n; i++) spots.push({ at: i, kind: 'between', w: 0.5 + ch[i - 1].energy });
  ch.forEach((x, i) => { if (i > 0 && i < n - 1) spots.push({ at: i, kind: 'inside', w: 0.4 + x.energy * 0.6 }); });
  const breaths = [];
  for (let k = 0; k < nb; k++) { const free = spots.filter((s) => !breaths.some((b) => Math.abs(b.at - s.at) < 2)); if (!free.length) break;
    const s = pickW(r, free, free.map((f) => f.w)); breaths.push({ at: s.at, kind: s.kind, bar: s.kind === 'inside' ? Math.round(ch[s.at].bars * (0.4 + r() * 0.3) / 8) * 8 : 0 }); }
  ch.forEach((x, i) => { x.breathInside = breaths.find((b) => b.kind === 'inside' && b.at === i) || null; });

  // transitions between chapters
  ch.forEach((x, i) => { if (i === n - 1) return; const y = ch[i + 1], d = JP.dist(x.c, y.c), rise = y.eStart - x.eEnd;
    const breathHere = breaths.some((b) => b.kind === 'between' && b.at === i + 1);
    const w = { bassout: 1 + (d < 1.5 ? 0.8 : 0), filter: d < 1.2 ? 1.6 : 0.6, motif: 0.8 + (x.feel.id !== y.feel.id ? 0.8 : 0), cut: d > 2.2 ? 1.6 : 0.3, riser: rise > 0.2 ? 2 : 0.3, breath: 0 };
    x.out = breathHere ? 'breath' : pickW(r, Object.keys(w), Object.values(w)); x.overlap = x.out === 'cut' || x.out === 'breath' ? 0 : x.out === 'riser' ? 4 : 8; });

  // keys: only to neighbours that sound beautiful, with one golden step up at the summit sometimes
  const top = ch.reduce((a, x, i) => (x.energy > ch[a].energy ? i : a), 0);
  let tonic = JP.hash(words[0].word) % 12, minor = ch[0].c.light < 0.1;
  ch.forEach((x, i) => {
    if (i > 0) { const prev = ch[i - 1], big = prev.out === 'breath' || prev.out === 'cut' || prev.out === 'motif' || prev.out === 'riser';
      const wantMinor = x.c.light < 0.1; let move = 'stay';
      if (wantMinor !== minor) move = 'relative'; else if (big && r() < 0.7) move = pickW(r, ['up5', 'down5'], [1, 1]);
      if (i === top && r() < 0.3) move = 'golden';
      if (move === 'relative') { tonic = (tonic + (minor ? 3 : 9)) % 12; minor = !minor; } else if (move === 'up5') tonic = (tonic + 7) % 12; else if (move === 'down5') tonic = (tonic + 5) % 12; else if (move === 'golden') tonic = (tonic + 2) % 12;
      x.keyMove = move; } else x.keyMove = 'start';
    if (ov[i] && ov[i].key) { const [kn, km] = ov[i].key.split(' '); const kt = JP.KEYS.indexOf(kn); if (kt >= 0) { tonic = kt; minor = km === 'minor'; x.keyMove = 'yours'; } }
    x.key = JP.KEYS[tonic] + (minor ? ' minor' : ' major'); x.tonic = tonic; x.minor = minor;
  });

  // layers: how many play, from the energy
  ch.forEach((x) => { x.layers = Math.max(1, Math.round(1 + x.energy * 5)); x.layersStart = Math.max(1, Math.round(1 + x.eStart * 5)); x.layersEnd = Math.max(0, Math.round(x.eEnd * 6)); });

  // who plays what: roles from the leader, players only from your rack
  const pick = (role, x) => { const own = rack[role] || [JP.PLAIN]; if (opts.fixed) return own[0]; const pref = (PREFER[role] || {})[x.lead.machine] || [];
    return pickW(r, own, own.map((p) => (p === JP.PLAIN && own.length > 1 ? 0.4 : pref.includes(p) ? 3 : 1))); };
  ch.forEach((x) => { const roles = JP.ROLES[x.lead.machine].slice(0, Math.min(6, Math.max(2, x.layers)));
    x.players = roles.map((role) => ({ role, player: pick(role, x), swapped: false })); });

  // an awakening needs something soft to wake up with: chords join the first chapter if it has no harmony yet
  if ((opening.id === 'awaken' || opening.id === 'motif') && !ch[0].players.some((p) => p.role === 'chords' || p.role === 'orch'))
    ch[0].players.push({ role: 'chords', player: pick('chords', ch[0]), swapped: false });

  // the band: a guest brings its own instrument; dance is the ground (a beat in every chapter, one exception at most,
  // never two in a row, never the very first); the orchestra is colour in most chapters when you have one in your rack
  const has = (x, r) => x.players.some((p) => p.role === r), add = (x, r) => { if (!has(x, r)) x.players.push({ role: r, player: pick(r, x), swapped: false }); };
  ch.forEach((x) => x.guests.forEach((g) => { if (g.machine === 'studio') add(x, 'beats'); else if (g.machine === 'percussion') add(x, 'perc'); else if (g.machine === 'symphony') add(x, 'orch'); }));
  const noBeat = ch.map((x, i) => (has(x, 'beats') ? -1 : i)).filter((i) => i >= 0);
  const keep = noBeat.filter((i) => i > 0 && i < n - 1).sort((a, b) => ch[a].energy - ch[b].energy)[0];
  noBeat.forEach((i) => { if (i !== keep) add(ch[i], 'beats'); });
  const orchMine = (rack.orch || []).some((p) => p !== JP.PLAIN);
  if (orchMine) { // colour, not a wall: at most three in five chapters carry the orchestra, the leaders of the orchestra keep theirs
    const own = (x) => x.lead.machine === 'symphony' || x.lead.machine === 'score';
    let cnt = ch.filter((x) => has(x, 'orch')).length; ch.map((x, i) => i).sort((a, b) => ch[a].energy - ch[b].energy).forEach((i) => { if (cnt > Math.ceil(n * 0.6) && has(ch[i], 'orch') && !own(ch[i])) { ch[i].players = ch[i].players.filter((p) => p.role !== 'orch'); cnt--; } });
    const want = Math.ceil(n * 0.6); let got = ch.filter((x) => has(x, 'orch')).length;
    ch.map((x, i) => i).sort((a, b) => (ch[b].c.weight + ch[b].c.tension + ch[b].c.light) - (ch[a].c.weight + ch[a].c.tension + ch[a].c.light)).forEach((i) => { if (got < want && !has(ch[i], 'orch')) { add(ch[i], 'orch'); got++; } }); }

  // swaps: one or two per journey, always on a chapter edge, and only where the instrument fits the role
  const swaps = []; const nsw = opts.fixed ? 0 : r() < 0.5 ? 2 : 1;
  for (let k = 0; k < nsw; k++) {
    const cands = [];
    ch.forEach((x, i) => { if (i === 0 || swaps.some((s) => s.at === i)) return;
      x.players.forEach((p, pi) => { for (const [el, list] of Object.entries(rack)) { if (el === p.role) continue;
        for (const inst of list) { if (inst === JP.PLAIN || inst === p.player) continue;
          if ((p.role === 'beats' || p.role === 'perc') && ['Berlin', 'BBC', 'STRIIIINGS', 'Iron', 'Silk', 'Carbon', 'Cinedream', 'SubCraft', 'Royal', 'Slap'].includes(inst)) continue; // only a synth or a pianist may play the drums
          const ok = fits(inst, p.role) || ((p.role === 'beats' || p.role === 'perc') && !(JP.INSTR[inst] || {}).drums && (JP.INSTR[inst] || {}).range && JP.INSTR[inst].range[1] - JP.INSTR[inst].range[0] >= 48);
          if (ok) cands.push({ at: i, pi, from: el, inst, role: p.role }); } } }); });
    if (!cands.length) break; const s = cands[Math.floor(r() * cands.length)]; swaps.push(s);
    const p = ch[s.at].players[s.pi]; p.player = s.inst; p.swapped = s.from;
  }

  // your template: the tracks you built in your DAW decide who plays in each chapter, so the new journey lands on them
  if (opts.template && opts.template.tracks && opts.template.tracks.length) { const T = opts.template.tracks;
    ch.forEach((x, i) => { const mine = T.filter((t) => t.role !== 'motif' && (t.ch === i || t.ch < 0)); if (!mine.length) return;
      const roles = {}; mine.forEach((t) => { if (!roles[t.role]) roles[t.role] = t.player; });
      // dance stays the ground: a beat may borrow the beat track of another chapter (same plugin, same kit)
      const anyBeat = T.find((t) => t.role === 'beats'); if (!roles.beats && anyBeat && x.players.some((p) => p.role === 'beats')) roles.beats = anyBeat.player;
      x.players = x.players.filter((p) => roles[p.role]).map((p) => Object.assign({}, p, { player: roles[p.role], swapped: false }));
      if (opts.template.perChapter) for (const [r, pl] of Object.entries(roles)) if (!x.players.some((p) => p.role === r)) x.players.push({ role: r, player: pl, swapped: false });
      x.tplMotif = (T.find((t) => t.role === 'motif' && (t.ch === i || t.ch < 0)) || {}).player; }); }

  // your own players win over the dice; 'off' takes a layer out
  ch.forEach((x, i) => { const o = (ov[i] || {}).players || {};
    for (const [role, inst] of Object.entries(o)) { const at = x.players.findIndex((p) => p.role === role);
      if (inst === 'off') { if (at >= 0) x.players.splice(at, 1); continue; }
      const p = { role, player: inst, swapped: false, yours: true }; if (at >= 0) x.players[at] = p; else x.players.push(p); } });

  // the motif: four to six notes that travel through every chapter in a new costume
  const len = 4 + Math.floor(r() * 3), steps = [0], rh = [];
  for (let k = 1; k < len; k++) { const lp = r() < 0.25; steps.push(clamp(steps[k - 1] + (lp ? (r() < 0.5 ? -1 : 1) * (2 + Math.floor(r() * 3)) : (r() < 0.5 ? -1 : 1)), -4, 7)); }
  for (let k = 0; k < len; k++) rh.push(pickW(r, [0.5, 1, 1.5, 2], [2, 3, 1, 1]));
  rh[len - 1] = Math.max(rh[len - 1], 1.5);
  const motif = { degrees: steps, rhythm: rh };
  ch.forEach((x, i) => { const c = [];
    if ((i === 0 && (opening.id === 'motif' || opening.id === 'awaken')) || (i === n - 1 && ending.id === 'home')) c.push('bare');
    if (x.feel.id === 'double' || x.c.speed > 0.5) c.push('quicker'); if (x.feel.id === 'half' || x.c.speed < -0.5) c.push('slower');
    if (x.minor) c.push('minor'); else c.push('major'); if (x.c.light < -0.4) c.push('low'); if (x.c.light > 0.5) c.push('high');
    if (x.c.tension > 0.5) c.push('upside down'); if (x.energy > 0.75) c.push('grand'); if (x.breathInside || x.energy < 0.25) c.push('half, a memory');
    x.costume = c; });

  // Mixed journey: every chapter is a song of its own, with its own form, its own summit and its own break;
  // the journey arc only sets how loud or soft that song lives as a whole. Deep journey keeps the one long arc.
  const mode = opts.mode === 'mixed' ? 'mixed' : 'deep';
  if (mode === 'mixed') ch.forEach((x) => {
    const slow = x.c.speed < -0.35 || x.lead.machine === 'symphony' && x.c.speed < 0, sing = x.lead.machine === 'symphony' || x.lead.machine === 'score' || x.c.warm > 0.4;
    const form = slow ? JP.SONGS.slow : sing ? JP.SONGS.verse : JP.SONGS.club;
    const tot = form.reduce((a, f) => a + f[1], 0); let u = 0;
    x.song = form.map(([type, w]) => { const u0 = u; u += w / tot; return { type, u0, u1: u, e: JP.SONG_E[type] }; });
    x.hi = clamp(x.energy + 0.3, 0.45, 1); x.lo = clamp(x.energy - 0.5, 0.05, 0.4);
  });
  return { mode, fixed: !!opts.fixed, rack, seed, words, bpm, minutes, arc, opening, ending, chapters: ch, breaths, swaps, motif, top, totalBars: ch.reduce((s, x) => s + x.bars, 0) };
};

if (typeof module !== 'undefined') module.exports = JP;
