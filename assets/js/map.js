/*
 * map.js — a small procedural "Ottawa-ish" city map, a route planner,
 * a simulated drive along the route, and a canvas MapView that can be
 * mounted in several places (native nav, split screen, CarPlay).
 */
'use strict';

const World = (() => {
  const COLS = 24, ROWS = 18, SP = 120;
  let seed = 20231;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const riverY = x => 370 + 80 * Math.sin(x / 430) + 35 * Math.sin(x / 160 + 1.3);

  const majorRows = { 5: 'Wellington St', 10: 'Laurier Ave', 15: 'Carling Ave' };
  const majorCols = { 2: 'Bronson Ave', 7: 'Bank St', 12: 'Elgin St', 17: 'King Edward Ave', 21: 'Vanier Pkwy' };
  const bridges = { 4: 'Champlain Bridge', 10: 'Portage Bridge', 16: 'Alexandra Bridge', 21: 'Macdonald-Cartier Br' };
  const rowNames = ['Rue Laurier', 'Boul. Alexandre-Taché', 'Rue Montcalm', 'Sussex Dr', 'Murray St', '', 'Sparks St', 'Queen St', 'Albert St', 'Slater St', '', 'Gloucester St', 'Nepean St', 'Lisgar St', 'Cooper St', '', 'Somerset St', 'Gladstone Ave'];
  const colNames = ['Parkdale Ave', 'Preston St', '', 'Percy St', 'Bay St', 'Lyon St', 'Kent St', '', "O'Connor St", 'Metcalfe St', 'Cartier St', 'Lewis St', '', 'Waller St', 'Cumberland St', 'Dalhousie St', 'Nicholas St', '', 'Chapel St', 'Range Rd', 'Charlotte St', '', 'Lola St', 'St Laurent Blvd'];

  const N = [];
  const nodes = [];
  const at = (i, j) => (i >= 0 && j >= 0 && i < ROWS && j < COLS ? N[i * COLS + j] : null);
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      const x = j * SP + (j in majorCols ? 0 : (rnd() - 0.5) * 22);
      const y = i * SP + (i in majorRows ? 0 : (rnd() - 0.5) * 22);
      if (Math.abs(y - riverY(x)) < 80) { N.push(null); continue; }
      const n = { id: nodes.length, i, j, x, y, adj: [] };
      N.push(n); nodes.push(n);
    }
  }
  const edges = [];
  const addEdge = (a, b, name, kind) => {
    const e = { a, b, name, kind, len: Math.hypot(b.x - a.x, b.y - a.y) };
    e.limit = kind === 'minor' ? 40 : 60;
    edges.push(e); a.adj.push({ n: b, e }); b.adj.push({ n: a, e });
  };
  for (let i = 0; i < ROWS; i++) for (let j = 0; j < COLS - 1; j++) {
    const a = at(i, j), b = at(i, j + 1);
    if (!a || !b) continue;
    const major = i in majorRows;
    if (!major && rnd() < 0.09) continue;
    addEdge(a, b, major ? majorRows[i] : rowNames[i], major ? 'major' : 'minor');
  }
  for (let j = 0; j < COLS; j++) {
    let prev = null;
    for (let i = 0; i < ROWS; i++) {
      const n = at(i, j);
      if (!n) continue;
      if (prev) {
        const gap = n.i - prev.i, major = j in majorCols;
        if (gap > 1) { if (j in bridges) addEdge(prev, n, bridges[j], 'bridge'); }
        else if (major || rnd() > 0.09) addEdge(prev, n, major ? majorCols[j] : colNames[j], major ? 'major' : 'minor');
      }
      prev = n;
    }
  }

  /* Static geometry as Path2D for fast drawing */
  const river = new Path2D();
  for (let x = -800; x <= COLS * SP + 800; x += 40) x === -800 ? river.moveTo(x, riverY(x)) : river.lineTo(x, riverY(x));
  const canal = new Path2D();
  canal.moveTo(1650, riverY(1650) + 40);
  canal.bezierCurveTo(1520, 900, 1330, 1300, 1490, 1650);
  canal.bezierCurveTo(1580, 1850, 1560, 2050, 1700, 2400);

  const blocks = new Path2D(), parks = new Path2D();
  const parkCells = new Set(['6,10', '6,11', '13,12', '14,13', '3,5', '16,3', '9,19', '11,6', '0,3', '0,4', '1,4']);
  for (let i = 0; i < ROWS - 1; i++) for (let j = 0; j < COLS - 1; j++) {
    const q = [at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j)];
    if (q.some(n => !n)) continue;
    const cx = q.reduce((s, n) => s + n.x, 0) / 4, cy = q.reduce((s, n) => s + n.y, 0) / 4;
    const isPark = parkCells.has(`${i},${j}`) || rnd() < 0.04;
    const k = isPark ? 0.1 : 0.17;
    const p = isPark ? parks : blocks;
    q.forEach((n, idx) => {
      const x = n.x + (cx - n.x) * k, y = n.y + (cy - n.y) * k;
      idx ? p.lineTo(x, y) : p.moveTo(x, y);
    });
    p.closePath();
    if (!isPark && rnd() < 0.55) { // split some blocks into two buildings
      const m1x = (q[0].x + q[1].x) / 2, m1y = (q[0].y + q[1].y) / 2, m2x = (q[3].x + q[2].x) / 2, m2y = (q[3].y + q[2].y) / 2;
      blocks.moveTo(m1x + (cx - m1x) * 0.17, m1y + (cy - m1y) * 0.17);
      blocks.lineTo(m2x + (cx - m2x) * 0.17, m2y + (cy - m2y) * 0.17);
    }
  }
  const roads = { minor: new Path2D(), major: new Path2D(), bridge: new Path2D() };
  edges.forEach(e => { roads[e.kind].moveTo(e.a.x, e.a.y); roads[e.kind].lineTo(e.b.x, e.b.y); });

  /* Labels along major roads */
  const labels = [];
  const byName = {};
  edges.forEach(e => { if (e.kind !== 'minor') (byName[e.name] || (byName[e.name] = [])).push(e); });
  Object.entries(byName).forEach(([name, es]) => {
    es.forEach((e, k) => {
      if (e.kind === 'bridge' || k % 4 === 1) labels.push({ x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2, ang: Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x), name, kind: e.kind });
    });
  });
  [400, 1500, 2500].forEach(x => labels.push({ x, y: riverY(x), ang: Math.atan2(riverY(x + 20) - riverY(x - 20), 40), name: 'Ottawa River', kind: 'water' }));
  labels.push({ x: 1420, y: 1320, ang: 1.25, name: 'Rideau Canal', kind: 'water' });

  const nearest = (x, y) => { let best = null, bd = Infinity; nodes.forEach(n => { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd && n.adj.length) { bd = d; best = n; } }); return best; };

  const P = (name, i, j, icon, sub) => ({ name, node: nearest(j * SP, i * SP), icon, sub });
  const pois = [
    P('Parliament Hill', 6, 11, 'star', 'Wellington St'),
    P('ByWard Market', 6, 15, 'pin', 'Market district'),
    P('Rideau Centre', 8, 14, 'pin', 'Shopping'),
    P('University of Ottawa', 9, 16, 'pin', '75 Laurier Ave E'),
    P('Lansdowne Park', 14, 12, 'pin', 'Bank St'),
    P('Canadian Tire Centre', 15, 0, 'pin', 'Arena'),
    P('Rideau Auto', 13, 19, 'wrench', 'Service garage'),
    P('Ottawa Airport (YOW)', 17, 9, 'pin', 'Airport Pkwy'),
    P('Gatineau Park', 0, 4, 'pin', 'Gatineau, QC'),
    P('Home', 12, 4, 'home', '214 Somerset St'),
    P('Work', 8, 8, 'office', 'Albert St')
  ];
  const poi = name => pois.find(p => p.name === name);

  function route(from, to) {
    const dist = new Map(), prev = new Map(), done = new Set();
    dist.set(from, 0);
    while (true) {
      let u = null, ud = Infinity;
      dist.forEach((d, n) => { if (!done.has(n) && d < ud) { ud = d; u = n; } });
      if (!u || u === to) break;
      done.add(u);
      u.adj.forEach(({ n, e }) => {
        const c = ud + e.len / e.limit + 0.4; // small per-intersection penalty keeps routes simple
        if (c < (dist.has(n) ? dist.get(n) : Infinity)) { dist.set(n, c); prev.set(n, { n: u, e }); }
      });
    }
    if (!prev.has(to) && from !== to) return null;
    const path = [to], es = [];
    let c = to;
    while (c !== from) { const p = prev.get(c); es.unshift(p.e); path.unshift(p.n); c = p.n; }
    return { path, edges: es };
  }

  return { COLS, ROWS, SP, nodes, edges, river, canal, blocks, parks, roads, labels, pois, poi, nearest, route, riverY, W: COLS * SP, H: ROWS * SP };
})();

/* ---------- Simulated route guidance ---------- */
const Nav = (() => {
  const MPU = 1.6;           // metres per world unit
  const TIME_SCALE = 4;      // demo drive runs 4x real time
  const start = World.poi('University of Ottawa').node;
  const st = {
    car: { x: start.x, y: start.y, h: -Math.PI / 2, hd: -Math.PI / 2 },
    kmh: 0, active: false, arrived: false, dest: null, r: null, s: 0, seg: 0, arriveTimer: null
  };

  function build(res) {
    const pts = res.path.map(n => ({ x: n.x, y: n.y }));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const man = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      const a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const nameChange = res.edges[i - 1].name !== res.edges[i].name;
      if (Math.abs(d) > 0.6) man.push({ s: cum[i], dir: d > 0 ? 'right' : 'left', road: res.edges[i].name, i });
      else if (nameChange && Math.abs(d) > 0.15) man.push({ s: cum[i], dir: 'straight', road: res.edges[i].name, i });
    }
    return { pts, cum, total: cum[cum.length - 1], edges: res.edges, man };
  }

  function go(poi) {
    const from = World.nearest(st.car.x, st.car.y);
    if (from === poi.node) { Bus.emit('toast', `You are already at ${poi.name}`); return false; }
    const res = World.route(from, poi.node);
    if (!res) return false;
    clearTimeout(st.arriveTimer);
    st.r = build(res); st.s = 0; st.seg = 0; st.dest = poi; st.active = true; st.arrived = false;
    st.car.x = from.x; st.car.y = from.y;
    Bus.emit('nav', 'start');
    return true;
  }
  function stop() { clearTimeout(st.arriveTimer); st.active = false; st.arrived = false; st.r = null; st.dest = null; Bus.emit('nav', 'stop'); }

  function nextMan() {
    if (!st.r) return null;
    const m = st.r.man.find(m => m.s > st.s + 1);
    if (m) return { ...m, dist: (m.s - st.s) * MPU };
    return { dir: 'flag', road: st.dest.name, dist: (st.r.total - st.s) * MPU };
  }
  const remainM = () => (st.r ? (st.r.total - st.s) * MPU : 0);
  const remainSec = () => remainM() / 11.5;     // realistic-ish average city speed
  const road = () => {
    if (st.r) return st.r.edges[Math.min(st.seg, st.r.edges.length - 1)];
    return null;
  };

  let lastSpoken = null;
  function update(dt) {
    const c = st.car;
    if (st.active && st.r) {
      const e = road();
      const nm = nextMan();
      let target = e ? e.limit : 40;
      if (nm && nm.dir !== 'straight' && nm.dist < 60) target = 22;
      if (nm && nm.dir === 'flag' && nm.dist < 80) target = 15;
      st.kmh += (target - st.kmh) * Math.min(1, dt * 1.2);
      st.s += (st.kmh / 3.6) * TIME_SCALE * dt / MPU;
      if (Settings.get('voiceGuidance') && nm && nm.dist < 220 && lastSpoken !== nm.s) {
        lastSpoken = nm.s;
        const say = nm.dir === 'flag' ? `In ${Fmt.dist(nm.dist)}, you will reach your destination` : nm.dir === 'straight' ? `Continue onto ${nm.road}` : `In ${Fmt.dist(nm.dist)}, turn ${nm.dir} onto ${nm.road}`;
        Messages.speak(say);
      }
      if (st.s >= st.r.total) {
        st.s = st.r.total; st.active = false; st.arrived = true; st.kmh = 0;
        Bus.emit('nav', 'arrived');
        if (Settings.get('demoDrive')) st.arriveTimer = setTimeout(() => {
          const others = World.pois.filter(p => p !== st.dest && p.name !== 'Gatineau Park');
          go(others[Math.floor(Math.random() * others.length)]);
        }, 7000);
      }
      const { pts, cum } = st.r;
      while (st.seg < pts.length - 2 && cum[st.seg + 1] < st.s) st.seg++;
      const a = pts[st.seg], b = pts[st.seg + 1], f = (st.s - cum[st.seg]) / (cum[st.seg + 1] - cum[st.seg] || 1);
      c.x = a.x + (b.x - a.x) * f; c.y = a.y + (b.y - a.y) * f;
      c.h = Math.atan2(b.y - a.y, b.x - a.x);
      Vehicle.trip.km += (st.kmh / 3.6) * TIME_SCALE * dt / 1000;
    } else {
      st.kmh += (0 - st.kmh) * Math.min(1, dt * 2);
    }
    let d = c.h - c.hd; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    c.hd += d * Math.min(1, dt * 5);
  }

  return { st, go, stop, update, nextMan, remainM, remainSec, road, MPU, get kmh() { return st.kmh; } };
})();

/* ---------- Canvas map view ---------- */
const PALETTES = {
  nbt: {
    bg: '#121a25', block: '#1a2431', park: '#15302a', water: '#0d3254', waterLine: '#16466f',
    minorC: '#0b1118', minor: '#455265', majorC: '#2d1e08', major: '#d0973f', bridge: '#d0973f',
    label: '#d3dbe6', halo: 'rgba(8,12,18,.9)', water_label: '#6fa6d6', routeC: '#04101f', poi: '#c9d3e0', traveled: 'rgba(255,255,255,.15)'
  },
  cpDark: {
    bg: '#1c1d20', block: '#26272b', park: '#203628', water: '#1d3a57', waterLine: '#244869',
    minorC: '#18191b', minor: '#4a4b51', majorC: '#1e1f22', major: '#77787f', bridge: '#77787f',
    label: '#d9d9de', halo: 'rgba(20,20,22,.92)', water_label: '#7aa7d1', routeC: '#0b3a7a', route: '#3b8cff', poi: '#bdbdc4', traveled: 'rgba(160,160,170,.35)'
  },
  cpLight: {
    bg: '#f3f0ea', block: '#e7e2d9', park: '#cde6c4', water: '#a7cff0', waterLine: '#93c1e6',
    minorC: '#d4cec3', minor: '#ffffff', majorC: '#e0ad48', major: '#fcd877', bridge: '#fcd877',
    label: '#3a3a3e', halo: 'rgba(255,255,255,.92)', water_label: '#3f7fb5', routeC: '#0d56c4', route: '#1a7cf5', poi: '#6b6b70', traveled: 'rgba(120,120,130,.35)'
  }
};

class MapView {
  constructor(host, o = {}) {
    this.o = Object.assign({ style: 'nbt', tilt: false, zoom: 0.9, interactive: true, carY: 0.62, labels: true, headingUp: () => Settings.get('headingUp') }, o);
    this.host = host;
    host.classList.add('mapview');
    this.cv = document.createElement('canvas');
    this.cv.className = 'map-canvas';
    host.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.v = { cx: Nav.st.car.x, cy: Nav.st.car.y, zoom: this.o.zoom, rot: 0 };
    this.follow = true;
    this.setTilt(this.o.tilt);
    if (this.o.interactive) this.bind();
    MapView.all.push(this);
  }
  setTilt(t) { this.o.tilt = t; this.host.classList.toggle('tilted', !!t); }
  visible() { return this.host.offsetParent !== null && this.host.clientWidth > 0; }
  recenter() { this.follow = true; this.onFollow && this.onFollow(true); }
  zoomBy(f) { this.v.zoom = clamp(this.v.zoom * f, 0.3, 2.6); }
  w2s(x, y) {
    const v = this.v, dx = (x - v.cx) * v.zoom, dy = (y - v.cy) * v.zoom, c = Math.cos(v.rot), s = Math.sin(v.rot);
    return [this.ox + dx * c - dy * s, this.oy + dx * s + dy * c];
  }
  bind() {
    const pts = new Map();
    let moved = 0, lastTap = 0;
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
    });
    cv.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      if (pts.size === 1) {
        let dx = (e.clientX - p.x) / UI.scale, dy = (e.clientY - p.y) / UI.scale;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) {
          if (this.follow) { this.follow = false; this.onFollow && this.onFollow(false); }
          if (this.o.tilt) { dx *= 0.75; dy *= 2; }
          const c = Math.cos(-this.v.rot), s = Math.sin(-this.v.rot);
          this.v.cx -= (dx * c - dy * s) / this.v.zoom;
          this.v.cy -= (dx * s + dy * c) / this.v.zoom;
        }
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        const o = [...pts.entries()].find(([id]) => id !== e.pointerId)[1];
        const after = Math.hypot(e.clientX - o.x, e.clientY - o.y);
        if (before > 0) this.zoomBy(after / before);
        moved += 10;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (moved < 6 && e.type === 'pointerup') {
        const now = Date.now();
        if (now - lastTap < 300) this.zoomBy(1.6);
        lastTap = now;
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  }
  draw() {
    const cv = this.cv, cw = cv.clientWidth, ch = cv.clientHeight;
    if (!cw || !ch) return;
    const px = (window.devicePixelRatio || 1) * UI.scale;
    if (this._w !== cw || this._h !== ch || this._px !== px) {
      this._w = cw; this._h = ch; this._px = px;
      cv.width = Math.round(cw * px); cv.height = Math.round(ch * px);
    }
    const ctx = this.ctx, v = this.v, car = Nav.st.car;
    const style = typeof this.o.style === 'function' ? this.o.style() : this.o.style;
    const P = PALETTES[style];
    const route = P.route || MapView.accent;

    if (this.follow) {
      v.cx += (car.x - v.cx) * 0.25; v.cy += (car.y - v.cy) * 0.25;
      const target = this.o.headingUp() ? -Math.PI / 2 - car.hd : 0;
      let d = target - v.rot; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      v.rot += d * 0.12;
    }
    this.ox = cw / 2;
    this.oy = this.follow ? ch * (this.o.tilt ? 0.63 : this.o.carY) : ch / 2;

    ctx.setTransform(px, 0, 0, px, 0, 0);
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(this.ox, this.oy); ctx.rotate(v.rot); ctx.scale(v.zoom, v.zoom); ctx.translate(-v.cx, -v.cy);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    ctx.strokeStyle = P.waterLine; ctx.lineWidth = 124; ctx.stroke(World.river);
    ctx.strokeStyle = P.water; ctx.lineWidth = 112; ctx.stroke(World.river);
    ctx.lineWidth = 30; ctx.stroke(World.canal);
    ctx.fillStyle = P.park; ctx.fill(World.parks);
    ctx.fillStyle = P.block; ctx.fill(World.blocks);
    if (v.zoom > 0.55) { ctx.strokeStyle = P.bg; ctx.lineWidth = 3; ctx.stroke(World.blocks); }

    const lw = (w, min) => Math.max(w, min / v.zoom);
    ctx.strokeStyle = P.minorC; ctx.lineWidth = lw(15, 3.2); ctx.stroke(World.roads.minor);
    ctx.strokeStyle = P.majorC; ctx.lineWidth = lw(24, 5); ctx.stroke(World.roads.major); ctx.stroke(World.roads.bridge);
    ctx.strokeStyle = P.minor; ctx.lineWidth = lw(10, 2); ctx.stroke(World.roads.minor);
    ctx.strokeStyle = P.major; ctx.lineWidth = lw(17, 3.5); ctx.stroke(World.roads.major);
    ctx.strokeStyle = P.bridge; ctx.stroke(World.roads.bridge);

    const r = Nav.st.r;
    if (r) {
      const path = new Path2D(), done = new Path2D();
      done.moveTo(r.pts[0].x, r.pts[0].y);
      for (let i = 1; i <= Nav.st.seg; i++) done.lineTo(r.pts[i].x, r.pts[i].y);
      done.lineTo(car.x, car.y);
      path.moveTo(car.x, car.y);
      for (let i = Nav.st.seg + 1; i < r.pts.length; i++) path.lineTo(r.pts[i].x, r.pts[i].y);
      ctx.strokeStyle = P.traveled; ctx.lineWidth = lw(10, 3); ctx.stroke(done);
      ctx.strokeStyle = P.routeC; ctx.lineWidth = lw(22, 8); ctx.stroke(path);
      ctx.strokeStyle = route; ctx.lineWidth = lw(14, 5); ctx.stroke(path);
    }
    ctx.restore();

    /* Labels (screen space so text stays upright) */
    if (this.o.labels && v.zoom > 0.38) {
      const placed = [];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      World.labels.forEach(l => {
        const [sx, sy] = this.w2s(l.x, l.y);
        if (sx < -60 || sy < -20 || sx > cw + 60 || sy > ch + 20) return;
        if (placed.some(([x, y]) => Math.abs(x - sx) < 130 && Math.abs(y - sy) < 40)) return;
        placed.push([sx, sy]);
        let a = l.ang + v.rot;
        while (a > Math.PI / 2) a -= Math.PI; while (a < -Math.PI / 2) a += Math.PI;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
        ctx.font = `${l.kind === 'water' ? 'italic 500' : '600'} ${l.kind === 'water' ? 12 : 11}px "Barlow Semi Condensed", Inter, sans-serif`;
        ctx.lineWidth = 3.5; ctx.strokeStyle = P.halo; ctx.strokeText(l.name, 0, 0);
        ctx.fillStyle = l.kind === 'water' ? P.water_label : P.label; ctx.fillText(l.name, 0, 0);
        ctx.restore();
      });
    }

    /* POIs */
    if (v.zoom > 0.5 && this.o.labels) {
      ctx.font = '500 11px "Barlow Semi Condensed", Inter, sans-serif'; ctx.textAlign = 'left';
      World.pois.forEach(p => {
        if (Nav.st.dest === p) return;
        const [sx, sy] = this.w2s(p.node.x, p.node.y);
        if (sx < -20 || sy < -20 || sx > cw + 20 || sy > ch + 20) return;
        ctx.fillStyle = P.halo; ctx.beginPath(); ctx.arc(sx, sy, 5.5, 0, 7); ctx.fill();
        ctx.fillStyle = P.poi; ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 7); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = P.halo; ctx.strokeText(p.name, sx + 9, sy);
        ctx.fillStyle = P.poi; ctx.fillText(p.name, sx + 9, sy);
      });
    }

    /* Destination pin */
    if (Nav.st.dest) {
      const [sx, sy] = this.w2s(Nav.st.dest.node.x, Nav.st.dest.node.y);
      ctx.save(); ctx.translate(sx, sy);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = style === 'nbt' ? '#e8eef7' : '#ff3b30';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-4, -8, -11, -14, -11, -22); ctx.arc(0, -22, 11, Math.PI, 0); ctx.bezierCurveTo(11, -14, 4, -8, 0, 0); ctx.fill();
      ctx.fillStyle = style === 'nbt' ? route : '#fff'; ctx.beginPath(); ctx.arc(0, -22, 4.5, 0, 7); ctx.fill();
      ctx.restore();
    }

    /* Vehicle marker */
    const [sx, sy] = this.w2s(car.x, car.y);
    const a = car.hd + v.rot;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
    if (style === 'nbt') {
      ctx.shadowColor = route; ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -11); ctx.lineTo(-5, 0); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = route;
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -7.5); ctx.lineTo(-3.5, 0); ctx.lineTo(-7, 7.5); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(0, 1, 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
      ctx.fillStyle = route; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6.5); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}
MapView.all = [];
MapView.accent = '#2f7fff';
