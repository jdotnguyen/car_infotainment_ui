/*
 * core.js — shared helpers, settings and the fake "vehicle" data sources
 * (media, phone, messages, calendar, check-control alerts, vehicle data).
 * Both the native (NBT-style) UI and the CarPlay mock read from these.
 */
'use strict';

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const ic = (n, c = '') => `<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"></use></svg>`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDur = s => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`;
};
const initials = n => n.replace(/[^A-Za-z\s]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

const UI = { scale: 1 };

/* ---------- Event bus ---------- */
const Bus = {
  h: {},
  on(e, f) { (this.h[e] || (this.h[e] = [])).push(f); },
  emit(e, d) { (this.h[e] || []).forEach(f => { try { f(d); } catch (err) { console.error(err); } }); }
};

/* ---------- Persistent settings ---------- */
const Settings = (() => {
  const KEY = 'infotainment-ui-settings-v2';
  const defaults = {
    accent: 'blue', brightness: 100, clock24: true, tempUnit: 'C', distUnit: 'km',
    map3d: true, headingUp: true, voiceGuidance: false, split: true, splitWidget: 0,
    eqBass: 0, eqMid: 0, eqTreble: 0, balance: 0, fader: 0, speedVol: 2,
    carplayEnabled: true, carplayAuto: false, cpAppearance: 'dark', cpWallpaper: 0, demoDrive: true
  };
  let s = { ...defaults };
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } };
  return {
    get: k => s[k],
    set(k, v) { if (s[k] === v) return; s[k] = v; save(); Bus.emit('settings', k); },
    reset() { s = { ...defaults }; save(); Bus.emit('settings', '*'); }
  };
})();

/* ---------- Formatting ---------- */
const Fmt = {
  clock(d = new Date(), h24 = Settings.get('clock24')) {
    const m = pad2(d.getMinutes());
    if (h24) return `${d.getHours()}:${m}`;
    return `${d.getHours() % 12 || 12}:${m}`;
  },
  ampm(d = new Date()) { return Settings.get('clock24') ? '' : (d.getHours() >= 12 ? 'PM' : 'AM'); },
  clockFull(d = new Date()) { const a = Fmt.ampm(d); return Fmt.clock(d) + (a ? ' ' + a : ''); },
  temp(c) { return Settings.get('tempUnit') === 'F' ? `${Math.round(c * 9 / 5 + 32)}°F` : `${Math.round(c)}°C`; },
  dist(m) {
    if (Settings.get('distUnit') === 'mi') {
      if (m < 160) return `${Math.max(50, Math.round(m * 3.281 / 50) * 50)} ft`;
      const mi = m / 1609.34;
      return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
    }
    if (m < 1000) return `${m < 100 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50} m`;
    return `${m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)} km`;
  },
  km(km) { return Settings.get('distUnit') === 'mi' ? `${Math.round(km / 1.609).toLocaleString()} mi` : `${Math.round(km).toLocaleString()} km`; },
  speed(kmh) { return Settings.get('distUnit') === 'mi' ? Math.round(kmh / 1.609) : Math.round(kmh); },
  speedUnit() { return Settings.get('distUnit') === 'mi' ? 'mph' : 'km/h'; },
  cons(l100) { return Settings.get('distUnit') === 'mi' ? [(235.2 / l100).toFixed(1), 'mpg'] : [l100.toFixed(1), 'L/100km']; },
  mins(sec) {
    const m = Math.max(1, Math.round(sec / 60));
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
  },
  arrival(sec) { return Fmt.clockFull(new Date(Date.now() + sec * 1000)); }
};

/* Album art: generated gradients (no real artwork) */
const artStyle = t => {
  const [a, b] = t.c;
  return `background:radial-gradient(circle at 28% 22%, ${a} 0%, transparent 58%),radial-gradient(circle at 80% 85%, ${b} 0%, transparent 62%),linear-gradient(135deg, ${b}, #07070c 85%)`;
};
const artHTML = (t, cls = 'art') => `<div class="${cls}" style="${artStyle(t)}"><span class="art-mark">${esc((t.al || t.a || '').slice(0, 1))}</span></div>`;

/* ---------- Media ---------- */
const Media = (() => {
  const radio = {
    fm: [
      { name: 'CBC Radio One', freq: '91.5', genre: 'News / Talk', songs: ['Ottawa Morning', 'The Current', 'All in a Day'] },
      { name: 'Hot 89.9', freq: '89.9', genre: 'Top 40', songs: ['Midnight Atlas – Neon Overpass', 'Mira Vale – Low Light', 'Strada – Velvet Engine'] },
      { name: 'CHEZ 106', freq: '106.1', genre: 'Classic Rock', songs: ['Harbour Fires – Second Wind', 'The Gravel Kings – Highway 17'] },
      { name: 'Jump! 106.9', freq: '106.9', genre: 'Pop', songs: ['Lumen Coast – Glass Horizon', 'Paper Moons – Summer Static'] },
      { name: 'Majic 100', freq: '100.3', genre: 'Adult Contemporary', songs: ['The Quiet Hours – City of Bridges', 'Mira Vale – Hours'] },
      { name: 'Live 88.5', freq: '88.5', genre: 'Alternative', songs: ['Canal & Co. – Rideau Lights', 'Static Bloom – Wires'] },
      { name: 'CBC Music', freq: '103.3', genre: 'Music', songs: ['Afternoon Drive', 'Saturday Night Jazz'] },
      { name: 'Rouge FM', freq: '94.9', genre: 'Pop (FR)', songs: ['Les Phares – Nord', 'Clara Belle – Minuit'] },
      { name: 'Pure Country', freq: '94.1', genre: 'Country', songs: ['Dusty Lanes – Back Roads', 'June Harlow – Porch Light'] },
      { name: 'Unique FM', freq: '94.5', genre: 'Community', songs: ['Le Matin', 'Musique Locale'] }
    ],
    sxm: [
      { name: 'Hits 1', freq: '2', genre: 'Pop Hits', songs: ['Midnight Atlas – Analog Heart', 'Paper Moons – Summer Static'] },
      { name: 'Coffee House', freq: '14', genre: 'Acoustic', songs: ['Mira Vale – Hours', 'June Harlow – Kettle'] },
      { name: 'The Pulse', freq: '15', genre: 'Adult Hits', songs: ['Lumen Coast – Northbound'] },
      { name: 'Classic Vinyl', freq: '26', genre: 'Classic Rock', songs: ['The Gravel Kings – Highway 17'] },
      { name: 'Lithium', freq: '34', genre: '90s Alternative', songs: ['Static Bloom – Wires'] },
      { name: 'BPM', freq: '51', genre: 'Dance', songs: ['Strada – Velvet Engine (Club Mix)'] },
      { name: 'Real Jazz', freq: '67', genre: 'Jazz', songs: ['The Blue Hour Trio – Rideau'] },
      { name: 'CBC Country', freq: '171', genre: 'Canadian Country', songs: ['Dusty Lanes – Back Roads'] }
    ]
  };
  const T = (t, a, al, d, c) => ({ t, a, al, d, c });
  const queues = {
    library: [
      T('Neon Overpass', 'Midnight Atlas', 'Night Drive', 214, ['#ff5e7e', '#5b2a86']),
      T('Glass Horizon', 'Lumen Coast', 'Tidal', 241, ['#2ec5ff', '#173b8a']),
      T('Paper Satellites', 'The Quiet Hours', 'Low Orbit', 198, ['#ffd166', '#e05a2b']),
      T('Rideau Lights', 'Canal & Co.', 'Winterlude', 226, ['#9be15d', '#00a3a3']),
      T('Velvet Engine', 'Strada', 'Autobahn Dreams', 263, ['#c084fc', '#3b0764']),
      T('Second Wind', 'Harbour Fires', 'Second Wind', 187, ['#fb923c', '#7c2d12']),
      T('Analog Heart', 'Midnight Atlas', 'Night Drive', 232, ['#f472b6', '#1e1b4b']),
      T('Northbound', 'Lumen Coast', 'Tidal', 205, ['#67e8f9', '#0e7490']),
      T('Low Light', 'Mira Vale', 'Hours', 219, ['#fde68a', '#92400e']),
      T('City of Bridges', 'The Quiet Hours', 'Low Orbit', 248, ['#a5b4fc', '#312e81'])
    ],
    usb: [
      T('Highway 17', 'The Gravel Kings', 'Mile Markers', 251, ['#f87171', '#450a0a']),
      T('Summer Static', 'Paper Moons', 'Daydreams', 199, ['#fcd34d', '#be185d']),
      T('Wires', 'Static Bloom', 'Feedback', 228, ['#86efac', '#14532d']),
      T('Back Roads', 'Dusty Lanes', 'Gravel & Gold', 212, ['#fdba74', '#78350f']),
      T('Porch Light', 'June Harlow', 'Kettle', 236, ['#fef3c7', '#9a3412']),
      T('Rideau', 'The Blue Hour Trio', 'Late Set', 301, ['#93c5fd', '#1e3a8a'])
    ],
    podcasts: [
      T('The Long Commute — Ep. 112: Winter Tires', 'Roadside Radio', 'Roadside Radio', 2460, ['#d8b4fe', '#581c87']),
      T('How Maps Are Made', 'Curious Systems', 'Curious Systems', 1985, ['#5eead4', '#134e4a']),
      T('The Daily Byte — Friday', 'Byte Media', 'The Daily Byte', 1320, ['#fca5a5', '#7f1d1d']),
      T('Design Matters in the Car', 'Interface Club', 'Interface Club', 2710, ['#fde047', '#3f3f46'])
    ],
    audiobooks: [
      T('Chapter 7 — The Northern Road', 'E. Marlowe', 'The Cartographer', 1840, ['#fdba74', '#431407']),
      T('Chapter 8 — Bridges', 'E. Marlowe', 'The Cartographer', 2105, ['#fdba74', '#431407']),
      T('Chapter 9 — Thaw', 'E. Marlowe', 'The Cartographer', 1760, ['#fdba74', '#431407'])
    ]
  };
  const st = {
    source: 'bt', queue: 'library', qidx: { library: 0, usb: 0, podcasts: 0, audiobooks: 0 },
    pos: 37, playing: true, vol: 16, muted: false, shuffle: false, repeat: false, fm: 1, sxm: 0,
    presets: { fm: [0, 1, 2, 3, 4, 5], sxm: [0, 1, 2, 3, 4, 5] }
  };
  const isTrack = (s = st.source) => s === 'usb' || s === 'bt';
  const qname = () => (st.source === 'usb' ? 'usb' : st.queue);
  const list = () => (isTrack() ? queues[qname()] : radio[st.source]);
  const idx = () => (isTrack() ? st.qidx[qname()] : st[st.source]);
  const cur = () => list()[idx()];
  const rds = s => s.songs[Math.floor(Date.now() / 40000) % s.songs.length];
  const changed = () => Bus.emit('media', 'change');

  function next(auto) {
    if (!isTrack()) return stepStation(1);
    const q = qname(), n = queues[q].length;
    st.qidx[q] = st.shuffle ? Math.floor(Math.random() * n) : (st.qidx[q] + 1) % n;
    if (auto && !st.repeat && !st.shuffle && st.qidx[q] === 0) st.playing = false;
    st.pos = 0; changed();
  }
  function prev() {
    if (!isTrack()) return stepStation(-1);
    const q = qname(), n = queues[q].length;
    if (st.pos > 3) st.pos = 0; else st.qidx[q] = (st.qidx[q] - 1 + n) % n, st.pos = 0;
    changed();
  }
  function stepStation(d) {
    const n = radio[st.source].length;
    st[st.source] = (st[st.source] + d + n) % n; st.playing = true; changed();
  }
  setInterval(() => {
    if (st.playing && isTrack()) {
      st.pos++;
      if (st.pos >= cur().d) next(true); else Bus.emit('media', 'tick');
    }
  }, 1000);

  return {
    st, radio, queues, isTrack, list, idx, cur, rds, next, prev, stepStation,
    qname,
    toggle() { st.playing = !st.playing; changed(); },
    play() { st.playing = true; changed(); },
    seek(f) { if (isTrack()) { st.pos = Math.floor(clamp(f, 0, 0.99) * cur().d); Bus.emit('media', 'tick'); } },
    setSource(s) { if (st.source === s) return; st.source = s; st.playing = true; if (isTrack(s)) st.pos = 0; changed(); },
    setQueue(q) { st.source = 'bt'; if (st.queue !== q) { st.queue = q; st.pos = 0; } changed(); },
    playItem(i, q) {
      if (q) { st.source = q === 'usb' ? 'usb' : 'bt'; if (q !== 'usb') st.queue = q; }
      if (isTrack()) { st.qidx[qname()] = i; st.pos = 0; } else st[st.source] = i;
      st.playing = true; changed();
    },
    tunePreset(n) { st[st.source] = st.presets[st.source][n]; st.playing = true; changed(); },
    savePreset(n) { st.presets[st.source][n] = st[st.source]; changed(); },
    toggleShuffle() { st.shuffle = !st.shuffle; changed(); },
    toggleRepeat() { st.repeat = !st.repeat; changed(); },
    setVol(v) { st.vol = clamp(v, 0, 40); st.muted = false; Bus.emit('volume'); },
    volUp() { this.setVol(st.vol + 1); },
    volDown() { this.setVol(st.vol - 1); },
    toggleMute() { st.muted = !st.muted; Bus.emit('volume'); },
    sourceLabel(s = st.source) { return { fm: 'FM Radio', sxm: 'SiriusXM', usb: 'USB', bt: 'Bluetooth' }[s]; },
    /* title/subtitle summary for widgets */
    summary() {
      const c = cur();
      if (isTrack()) return { t: c.t, a: c.a, al: c.al, track: c };
      return { t: c.name, a: rds(c), al: `${st.source === 'fm' ? 'FM ' + c.freq : 'Ch ' + c.freq} · ${c.genre}`, station: c };
    }
  };
})();

/* ---------- Phone ---------- */
const Phone = (() => {
  const C = (n, num, fav) => ({ n, num, fav: !!fav });
  const contacts = [
    C('Alex Chen', '(613) 555-0142', 1), C('Ava Singh', '(613) 555-0187'), C('Daniel Okafor', '(343) 555-0110'),
    C('Emma Wilson', '(613) 555-0163', 1), C('Garage – Rideau Auto', '(613) 555-0199'), C('Liam Roy', '(819) 555-0124'),
    C('Marc Tremblay', '(819) 555-0171'), C('Mom', '(613) 555-0101', 1), C('Noah Bouchard', '(613) 555-0135'),
    C('Olivia Martin', '(343) 555-0158'), C('Priya Sharma', '(613) 555-0176', 1), C('Sophie Gagnon', '(819) 555-0148'),
    C('Dr. Lee Dental', '(613) 555-0192')
  ].sort((a, b) => a.n.localeCompare(b.n));
  const recents = [
    { n: 'Priya Sharma', type: 'in', t: '15:12' }, { n: 'Mom', type: 'out', t: '13:40' },
    { n: 'Garage – Rideau Auto', type: 'missed', t: '11:05' }, { n: 'Alex Chen', type: 'out', t: 'Yesterday' },
    { n: '(613) 555-0119', type: 'missed', t: 'Yesterday' }, { n: 'Emma Wilson', type: 'in', t: 'Wed' },
    { n: 'Marc Tremblay', type: 'out', t: 'Tue' }
  ];
  const find = n => contacts.find(c => c.n === n);
  let call = null, timer = null;
  const emit = () => Bus.emit('call', call);
  return {
    contacts, recents, find,
    get call() { return call; },
    device: 'iPhone', battery: 78, signal: 4,
    dial(n, num) {
      const c = find(n); num = num || (c ? c.num : n);
      call = { n: c ? c.n : n, num, status: 'dialing', t0: 0, muted: false, dir: 'out' };
      recents.unshift({ n: call.n, type: 'out', t: Fmt.clock() });
      emit();
      clearTimeout(timer);
      timer = setTimeout(() => { if (call && call.status === 'dialing') { call.status = 'active'; call.t0 = Date.now(); emit(); } }, 2600);
    },
    incoming(n) {
      const c = find(n) || contacts[0];
      call = { n: c.n, num: c.num, status: 'ringing', t0: 0, muted: false, dir: 'in' };
      emit();
    },
    answer() { if (call) { call.status = 'active'; call.t0 = Date.now(); recents.unshift({ n: call.n, type: 'in', t: Fmt.clock() }); emit(); } },
    end() { clearTimeout(timer); if (call && call.status === 'ringing') recents.unshift({ n: call.n, type: 'missed', t: Fmt.clock() }); call = null; emit(); },
    toggleMute() { if (call) { call.muted = !call.muted; emit(); } },
    elapsed() { return call && call.t0 ? (Date.now() - call.t0) / 1000 : 0; }
  };
})();

/* ---------- Messages & calendar ---------- */
const Messages = (() => {
  const list = [
    { id: 1, from: 'Alex Chen', text: 'Running 10 min late — can you grab us a table at the market?', t: '16:21', unread: true },
    { id: 2, from: 'Priya Sharma', text: 'Slides look great. Let’s sync Monday morning before the review.', t: '15:48', unread: true },
    { id: 3, from: 'Garage – Rideau Auto', text: 'Your winter tires are mounted and ready for pick-up after 17:00.', t: '11:10', unread: false },
    { id: 4, from: 'Mom', text: 'Dinner Sunday at 6? Bring the dog!', t: 'Yesterday', unread: false },
    { id: 5, from: 'Emma Wilson', text: 'Got the hockey tickets, section 112. See you at 7.', t: 'Wed', unread: false }
  ];
  return {
    list,
    unread: () => list.filter(m => m.unread).length,
    read(id) { const m = list.find(x => x.id === id); if (m && m.unread) { m.unread = false; Bus.emit('messages'); } },
    reply(id, text) { Bus.emit('toast', `Reply sent: “${text}”`); },
    speak(text) {
      try {
        if (!('speechSynthesis' in window)) return false;
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(text));
        return true;
      } catch (e) { return false; }
    }
  };
})();

const Calendar = [
  { t: '09:30', e: '10:00', title: 'Team stand-up', loc: 'Video call', c: '#3b82f6' },
  { t: '12:00', e: '13:00', title: 'Lunch with Priya', loc: 'ByWard Market', poi: 'ByWard Market', c: '#22c55e' },
  { t: '17:30', e: '18:00', title: 'Pick up winter tires', loc: 'Rideau Auto', poi: 'Rideau Auto', c: '#f59e0b' },
  { t: '19:00', e: '21:30', title: 'Hockey night', loc: 'Canadian Tire Centre', poi: 'Canadian Tire Centre', c: '#ef4444' }
];

/* ---------- Check control (vehicle alerts) ---------- */
const Alerts = (() => {
  const seed = () => [
    { id: 1, sev: 'warn', ic: 'oil', title: 'Engine oil level low', detail: 'Top up 1 litre of approved engine oil at the next opportunity. Do not exceed the MAX mark on the dipstick.' },
    { id: 2, sev: 'crit', ic: 'bulb', title: 'Front driver headlight malfunction', detail: 'Low beam has failed. Drive with extra care at night and have the bulb replaced as soon as possible.' },
    { id: 3, sev: 'warn', ic: 'battery', title: 'High battery drain', detail: 'Increased battery discharge was detected while parked. Switch off unnecessary consumers such as interior lights.' },
    { id: 4, sev: 'info', ic: 'clock', title: 'Date/Time not set', detail: 'The vehicle clock is not synchronised. Set date and time in Settings → General, or connect a phone.' },
    { id: 5, sev: 'warn', ic: 'bulb', title: 'Rear passenger tail light malfunction', detail: 'A rear lamp has failed. Following traffic may not see you braking clearly. Have it checked soon.' }
  ];
  let list = seed(), nextId = 10;
  const extra = [
    { sev: 'warn', ic: 'tire', title: 'Tire pressure low — rear left', detail: 'Pressure is 2.0 bar (recommended 2.4 bar). Check and inflate the tire at the next opportunity.' },
    { sev: 'info', ic: 'thermo', title: 'Ice warning', detail: 'Outside temperature is near freezing. Watch for black ice on bridges and shaded roads.' },
    { sev: 'info', ic: 'wrench', title: 'Service due soon', detail: 'Engine oil service is due in 1,200 km. Book an appointment with your service centre.' }
  ];
  return {
    get list() { return list; },
    count: () => list.length,
    dismiss(id) { list = list.filter(a => a.id !== id); Bus.emit('alerts'); },
    clearAll() { list = []; Bus.emit('alerts'); },
    restore() { list = seed(); Bus.emit('alerts'); },
    add() {
      const a = { ...extra[nextId % extra.length], id: nextId++ };
      list.unshift(a); Bus.emit('alerts'); Bus.emit('alert:new', a);
    }
  };
})();

/* ---------- Vehicle data (trip, OBD-II style live values) ---------- */
const Vehicle = (() => {
  const v = {
    fuel: 0.58, tankL: 60, odoKm: 48213, outsideC: 8,
    tires: { fl: 2.4, fr: 2.4, rl: 2.3, rr: 2.4 }, tireTemp: { fl: 18, fr: 19, rl: 17, rr: 18 },
    trip: { km: 36.4, l100: 7.8, kmh: 41, mins: 53 },
    history: [8.2, 7.9, 9.4, 10.1, 7.2, 6.8, 6.5, 7.7, 8.8, 9.6, 7.1, 6.3, 6.9, 7.4, 8.1, 7.8, 6.6, 6.2, 7.0, 8.4, 9.0, 7.6, 7.2, 6.9],
    live: { rpm: 820, kmh: 0, coolant: 89, intake: 14, volts: 14.2, load: 22, throttle: 12 },
    service: [
      { ic: 'oil', name: 'Engine oil', km: 1200, max: 15000, when: 'Due in 1,200 km' },
      { ic: 'tire', name: 'Front brake pads', km: 18400, max: 40000, when: 'In 18,400 km' },
      { ic: 'wrench', name: 'Brake fluid', km: null, max: null, pct: 0.35, when: 'Due March 2027' },
      { ic: 'car', name: 'Vehicle inspection', km: null, max: null, pct: 0.6, when: 'Due October 2027' },
      { ic: 'cloud', name: 'Cabin microfilter', km: 9800, max: 30000, when: 'In 9,800 km' }
    ]
  };
  v.rangeKm = () => (v.fuel * v.tankL) / (v.trip.l100 / 100);
  v.resetTrip = () => { v.trip = { km: 0, l100: 7.8, kmh: 0, mins: 0 }; Bus.emit('trip'); };
  return v;
})();
