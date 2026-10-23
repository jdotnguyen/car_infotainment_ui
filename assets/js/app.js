/*
 * app.js — the native, NBT-inspired infotainment UI.
 * Widescreen 1280x480 layout, touch-first: big targets, swipe, drag, pinch.
 */
'use strict';

const NBT = (() => {
  const root = $('#nbt');
  const TITLES = {
    home: 'Main menu', media: 'Media / Radio', nav: 'Navigation', tel: 'Communication', office: 'Office',
    vehicle: 'My Vehicle', alerts: 'Check Control', settings: 'Settings'
  };

  root.innerHTML = `
    <header class="sb">
      <button class="sb-back" data-act="back" aria-label="Back">${ic('back')}</button>
      <div class="sb-title"><span id="sb-title">Main menu</span></div>
      <div class="sb-right">
        <button class="sb-call" id="sb-call" data-act="call-open" hidden>${ic('phone-f')}<span></span></button>
        <button class="sb-btn" data-go="alerts" aria-label="Check Control">${ic('warn')}<b class="badge" id="sb-badge"></b></button>
        <span class="sb-ic" title="iPhone">${ic('signal')}<i>LTE</i></span>
        <span class="sb-ic">${ic('bluetooth')}</span>
        <span class="sb-temp" id="sb-temp"></span>
        <span class="sb-clock" id="sb-clock"></span>
        <button class="sb-btn" data-act="split" aria-label="Split screen">${ic('split')}</button>
        <button class="sb-btn sb-home" data-go="home" aria-label="Main menu">${ic('home')}</button>
      </div>
    </header>
    <div class="body" id="body">
      <div class="views" id="views">${Object.keys(TITLES).map(k => `<section class="view" data-view="${k}"></section>`).join('')}</div>
      <aside class="split" id="split"></aside>
    </div>
    <div class="vol-hud" id="nbt-vol"><span class="vh-ic"></span><div class="vh-bar"><i></i></div><b></b></div>
    <div class="call-ov" id="nbt-call" hidden></div>
    <div class="toast" id="nbt-toast"></div>
  `;

  const VIEWS = {};
  const V = k => $(`.view[data-view="${k}"]`, root);
  let stack = ['home'], current = null;

  function show(k) {
    if (current === k) return;
    const prev = current;
    current = k;
    $$('.view', root).forEach(v => v.classList.toggle('active', v.dataset.view === k));
    $('#sb-title').textContent = TITLES[k];
    root.classList.toggle('at-home', k === 'home');
    if (prev && VIEWS[prev] && VIEWS[prev].hide) VIEWS[prev].hide();
    if (VIEWS[k] && VIEWS[k].show) VIEWS[k].show();
  }
  function go(k) {
    if (k === 'carplay') return CarPlay.open();
    if (!TITLES[k]) return;
    if (k === current) { VIEWS[k] && VIEWS[k].reset && VIEWS[k].reset(); return; }
    if (k === 'home') stack = ['home'];
    else { const i = stack.indexOf(k); stack = i >= 0 ? stack.slice(0, i + 1) : stack.concat(k); }
    show(k);
  }
  function back() {
    if (VIEWS[current] && VIEWS[current].back && VIEWS[current].back()) return;
    if (stack.length > 1) { stack.pop(); show(stack[stack.length - 1]); }
  }

  /* Shared building blocks */
  const rail = (items, active) => `<nav class="rail">${items.map(([k, i, l, b]) =>
    `<button class="rail-i ${k === active ? 'on' : ''}" data-tab="${k}">${ic(i)}<span>${l}</span>${b ? `<b class="badge">${b}</b>` : ''}</button>`).join('')}</nav>`;
  const turnIcon = d => ({ left: 'turn-l', right: 'turn-r', straight: 'straight', flag: 'flag' }[d] || 'straight');
  const toggle = (k, on) => `<button class="tgl ${on ? 'on' : ''}" data-set="${k}" role="switch" aria-checked="${on}"><i></i></button>`;
  const seg = (k, opts, val) => `<div class="seg" data-seg="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const avatar = (n, cls = 'av') => `<span class="${cls}" style="--h:${hue(n)}">${/^\(|^\d/.test(n) ? ic('user') : esc(initials(n))}</span>`;
  const sevIcon = s => ({ crit: 'crit', warn: 'warn', info: 'info' }[s]);

  /* ===================== HOME ===================== */
  VIEWS.home = (() => {
    const el = V('home');
    const tiles = [
      ['media', 'music', 'Media / Radio'], ['nav', 'nav', 'Navigation'], ['tel', 'phone', 'Communication'], ['office', 'office', 'Office'],
      ['vehicle', 'car', 'My Vehicle'], ['carplay', 'carplay', 'CarPlay'], ['alerts', 'warn', 'Check Control'], ['settings', 'gear', 'Settings']
    ];
    el.innerHTML = `<div class="home-grid">${tiles.map(([k, i, l]) => `
      <button class="tile tile-${k}" data-go="${k}">
        <span class="tile-ic">${ic(i)}</span>
        <span class="tile-l">${l}</span>
        <span class="tile-s" id="ts-${k}"></span>
        ${k === 'alerts' || k === 'office' ? `<b class="badge" id="tb-${k}"></b>` : ''}
      </button>`).join('')}</div>`;
    const set = (k, t) => { const e = $('#ts-' + k); if (e && e.textContent !== t) e.textContent = t; };
    function upd() {
      const m = Media.summary();
      set('media', `${Media.sourceLabel()} · ${m.t}`);
      set('nav', Nav.st.active ? `${Nav.st.dest.name} · ${Fmt.mins(Nav.remainSec())}` : Nav.st.arrived ? 'Destination reached' : 'Enter a destination');
      set('tel', Phone.call ? `On call · ${Phone.call.n}` : `${Phone.device} connected`);
      const u = Messages.unread();
      set('office', u ? `${u} unread message${u > 1 ? 's' : ''}` : 'Messages · Calendar');
      $('#tb-office').textContent = u || ''; $('#tb-office').hidden = !u;
      set('vehicle', `Range ${Fmt.km(Vehicle.rangeKm())}`);
      set('carplay', Settings.get('carplayEnabled') ? `${Phone.device} · ready` : 'Disabled in settings');
      const n = Alerts.count();
      set('alerts', n ? `${n} message${n > 1 ? 's' : ''}` : 'No messages');
      $('#tb-alerts').textContent = n || ''; $('#tb-alerts').hidden = !n;
      set('settings', 'Display · Sound · Units');
    }
    ['media', 'nav', 'alerts', 'messages', 'settings', 'call'].forEach(e => Bus.on(e, t => t !== 'tick' && upd()));
    Bus.on('navtick', () => current === 'home' && upd());
    upd();
    return { show: upd };
  })();

  /* ===================== SPLIT SCREEN ===================== */
  const Split = (() => {
    const el = $('#split');
    const W = [['map', 'Map'], ['media', 'Entertainment'], ['trip', 'Onboard info'], ['weather', 'Weather']];
    el.innerHTML = `
      <div class="sp-head"><button class="sp-arrow" data-sp="-1">${ic('back')}</button><span class="sp-title"></span><button class="sp-arrow" data-sp="1">${ic('chev')}</button></div>
      <div class="sp-track">${W.map(([k]) => `<div class="sp-pane" data-pane="${k}"></div>`).join('')}</div>
      <div class="sp-dots">${W.map((w, i) => `<button data-dot="${i}"></button>`).join('')}</div>`;
    const track = $('.sp-track', el);
    const pane = k => $(`[data-pane="${k}"]`, el);
    let idx = clamp(Settings.get('splitWidget') || 0, 0, W.length - 1);

    pane('map').innerHTML = `<div class="sp-map"></div><div class="sp-man" id="sp-man"></div>`;
    const mini = new MapView($('.sp-map', el), { style: 'nbt', zoom: 0.75, interactive: false, carY: 0.62 });
    pane('media').innerHTML = `<div class="sp-media"></div>`;
    pane('trip').innerHTML = `<div class="sp-trip"></div>`;
    pane('weather').innerHTML = `
      <div class="sp-weather">
        <div class="w-now">${ic('cloud-sun', 'w-big')}<div><b id="w-temp"></b><span>Ottawa · Mostly cloudy</span><small id="w-hl"></small></div></div>
        <div class="w-days" id="w-days"></div>
      </div>`;

    function setIdx(i) {
      idx = (i + W.length) % W.length;
      track.style.transform = `translateX(${-idx * 100}%)`;
      $('.sp-title', el).textContent = W[idx][1];
      $$('[data-dot]', el).forEach((d, k) => d.classList.toggle('on', k === idx));
      Settings.set('splitWidget', idx);
      renderAll();
    }
    function renderMedia() {
      const m = Media.summary(), s = Media.st, t = m.track;
      $('.sp-media', el).innerHTML = `
        ${t ? artHTML(t, 'art sp-art') : `<div class="art sp-art radio-art">${ic(Media.st.source === 'fm' ? 'radio' : 'satellite')}<b>${esc(m.station.freq)}</b></div>`}
        <div class="sp-mt">${esc(m.t)}</div><div class="sp-ma">${esc(m.a)}</div>
        ${t ? `<div class="bar sp-bar"><i style="width:${(s.pos / t.d) * 100}%"></i></div>` : `<div class="sp-ma dim">${esc(m.al)}</div>`}
        <div class="sp-ctrl"><button data-m="prev">${ic(t ? 'prev' : 'seekb')}</button><button data-m="toggle" class="big">${ic(s.playing ? 'pause' : 'play')}</button><button data-m="next">${ic(t ? 'next' : 'seekf')}</button></div>`;
    }
    function renderTrip() {
      const tr = Vehicle.trip, [c, cu] = Fmt.cons(tr.l100);
      $('.sp-trip', el).innerHTML = `
        <div class="kv"><span>${ic('fuel')} Range</span><b>${Fmt.km(Vehicle.rangeKm())}</b></div>
        <div class="kv"><span>${ic('gauge')} Avg. consumption</span><b>${c} <small>${cu}</small></b></div>
        <div class="kv"><span>${ic('route')} Trip distance</span><b>${Fmt.km(tr.km)}</b></div>
        <div class="kv"><span>${ic('activity')} Speed</span><b>${Fmt.speed(Nav.kmh)} <small>${Fmt.speedUnit()}</small></b></div>
        <div class="kv"><span>${ic('thermo')} Outside</span><b>${Fmt.temp(Vehicle.outsideC)}</b></div>`;
    }
    function renderWeather() {
      $('#w-temp').textContent = Fmt.temp(Vehicle.outsideC);
      $('#w-hl').textContent = `H ${Fmt.temp(11)}  ·  L ${Fmt.temp(2)}`;
      $('#w-days').innerHTML = [['Sat', 'sun', 12, 3], ['Sun', 'cloud', 9, 1], ['Mon', 'snow', 2, -4]].map(([d, i, h, l]) =>
        `<div><span>${d}</span>${ic(i)}<b>${Fmt.temp(h)}</b><small>${Fmt.temp(l)}</small></div>`).join('');
    }
    function renderMan() {
      const m = Nav.nextMan(), e = $('#sp-man');
      if (Nav.st.active && m) e.innerHTML = `${ic(turnIcon(m.dir))}<div><b>${Fmt.dist(m.dist)}</b><span>${esc(m.road)}</span></div>`;
      else e.innerHTML = Nav.st.arrived ? `${ic('flag')}<div><b>Arrived</b><span>${esc(Nav.st.dest ? Nav.st.dest.name : '')}</span></div>` : `${ic('nav')}<div><b>${esc((Nav.road() || { name: 'Laurier Ave' }).name)}</b><span>No route</span></div>`;
      e.classList.toggle('show', true);
    }
    function renderAll() { renderMedia(); renderTrip(); renderWeather(); renderMan(); }

    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sp) setIdx(idx + +b.dataset.sp);
      else if (b.dataset.dot) setIdx(+b.dataset.dot);
      else if (b.dataset.m) Media[b.dataset.m]();
    });
    track.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      if (swiped) return;
      go({ map: 'nav', media: 'media', trip: 'vehicle', weather: 'home' }[W[idx][0]]);
    });
    let sx = null, swiped = false;
    track.addEventListener('pointerdown', e => { sx = e.clientX; swiped = false; });
    track.addEventListener('pointerup', e => {
      if (sx === null) return;
      const dx = (e.clientX - sx) / UI.scale; sx = null;
      if (Math.abs(dx) > 50) { swiped = true; setIdx(idx + (dx < 0 ? 1 : -1)); }
    });
    Bus.on('media', t => { if (t === 'tick') { const b = $('.sp-bar i', el); const tr = Media.cur(); if (b && tr.d) b.style.width = `${(Media.st.pos / tr.d) * 100}%`; } else renderMedia(); });
    Bus.on('navtick', () => { renderMan(); if (W[idx][0] === 'trip') renderTrip(); });
    Bus.on('nav', renderMan);
    Bus.on('settings', renderAll);
    setIdx(idx);

    function apply() { root.classList.toggle('split-open', !!Settings.get('split')); }
    Bus.on('settings', k => (k === 'split' || k === '*') && apply());
    apply();
    return { toggle: () => Settings.set('split', !Settings.get('split')) };
  })();

  /* ===================== MEDIA ===================== */
  VIEWS.media = (() => {
    const el = V('media');
    const SRC = [['fm', 'radio', 'FM Radio'], ['sxm', 'satellite', 'SiriusXM'], ['usb', 'usb', 'USB'], ['bt', 'bluetooth', 'Bluetooth']];
    el.innerHTML = `<div class="layout">${'<div id="m-rail"></div>'}<div class="m-main" id="m-main"></div><div class="m-list" id="m-list"><div class="m-lhead" id="m-lhead"></div><div class="scroll" id="m-items"></div></div></div>`;
    function renderRail() { $('#m-rail', el).innerHTML = rail(SRC, Media.st.source); }
    function renderMain() {
      const s = Media.st, c = Media.cur();
      if (!Media.isTrack()) {
        const pre = s.presets[s.source];
        $('#m-main', el).innerHTML = `
          <div class="radio">
            <div class="r-band">${s.source === 'fm' ? 'FM' : 'SiriusXM'} <span>${s.source === 'fm' ? c.freq + ' MHz' : 'Channel ' + c.freq}</span></div>
            <div class="r-row">
              <button class="r-seek" data-m="prev" aria-label="Seek down">${ic('seekb')}</button>
              <div class="r-info">
                <div class="r-name">${esc(c.name)}</div>
                <div class="r-rds">${ic('music')}${esc(Media.rds(c))}</div>
                <div class="r-genre">${esc(c.genre)}${s.playing ? '' : ' · Muted'}</div>
              </div>
              <button class="r-seek" data-m="next" aria-label="Seek up">${ic('seekf')}</button>
            </div>
            <div class="presets">${pre.map((p, i) => { const st = Media.radio[s.source][p]; return `<button class="preset ${p === s[s.source] ? 'on' : ''}" data-preset="${i}"><b>${i + 1}</b><span>${esc(st.name)}</span><small>${st.freq}</small></button>`; }).join('')}</div>
            <p class="hint">Tap a preset to tune · press and hold to store the current station</p>
          </div>`;
      } else {
        const label = s.source === 'usb' ? 'USB · SanDisk 64GB' : `Bluetooth · ${Phone.device}`;
        $('#m-main', el).innerHTML = `
          <div class="np">
            ${artHTML(c, 'art np-art')}
            <div class="np-info">
              <div class="np-src">${ic(s.source === 'usb' ? 'usb' : 'bluetooth')}${label}</div>
              <div class="np-t">${esc(c.t)}</div>
              <div class="np-a">${esc(c.a)}</div>
              <div class="np-al">${esc(c.al)}</div>
              <div class="prog"><div class="bar seekbar" id="m-bar"><i></i><em></em></div><div class="times"><span id="m-pos"></span><span id="m-rem"></span></div></div>
              <div class="ctrls">
                <button data-m="toggleShuffle" class="sm ${s.shuffle ? 'on' : ''}" aria-label="Shuffle">${ic('shuffle')}</button>
                <button data-m="prev" aria-label="Previous">${ic('prev')}</button>
                <button data-m="toggle" class="big" aria-label="Play/Pause">${ic(s.playing ? 'pause' : 'play')}</button>
                <button data-m="next" aria-label="Next">${ic('next')}</button>
                <button data-m="toggleRepeat" class="sm ${s.repeat ? 'on' : ''}" aria-label="Repeat">${ic('repeat')}</button>
              </div>
            </div>
          </div>`;
        tick();
      }
    }
    function renderList() {
      const s = Media.st, list = Media.list(), active = Media.idx();
      if (s.source === 'bt') $('#m-lhead', el).innerHTML = seg('queue', [['library', 'Music'], ['podcasts', 'Podcasts'], ['audiobooks', 'Books']], s.queue);
      else $('#m-lhead', el).innerHTML = `<span>${Media.isTrack() ? 'Tracks' : 'Station list'}</span>`;
      $('#m-items', el).innerHTML = list.map((it, i) => Media.isTrack()
        ? `<button class="li ${i === active ? 'on' : ''}" data-item="${i}"><span class="li-n">${i === active && s.playing ? '<i class="eqbars"><i></i><i></i><i></i></i>' : i + 1}</span><span class="li-b"><b>${esc(it.t)}</b><small>${esc(it.a)}</small></span><span class="li-r">${fmtDur(it.d)}</span></button>`
        : `<button class="li ${i === active ? 'on' : ''}" data-item="${i}"><span class="li-n">${ic(s.source === 'fm' ? 'radio' : 'satellite')}</span><span class="li-b"><b>${esc(it.name)}</b><small>${esc(it.genre)}</small></span><span class="li-r">${it.freq}</span></button>`).join('');
      const on = $('.li.on', el), box = $('#m-items', el);
      if (on && (on.offsetTop < box.scrollTop || on.offsetTop + on.offsetHeight > box.scrollTop + box.clientHeight)) box.scrollTop = on.offsetTop - box.clientHeight / 2 + on.offsetHeight / 2;
    }
    function tick() {
      const b = $('#m-bar', el); if (!b) return;
      const c = Media.cur(), p = Media.st.pos;
      b.style.setProperty('--p', `${(p / c.d) * 100}%`);
      $('#m-pos', el).textContent = fmtDur(p);
      $('#m-rem', el).textContent = '-' + fmtDur(c.d - p);
    }
    function render() { renderRail(); renderMain(); renderList(); }
    let holdT = null, held = false;
    el.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-preset]'); if (!b) return;
      held = false;
      holdT = setTimeout(() => { held = true; Media.savePreset(+b.dataset.preset); Bus.emit('toast', `Stored on preset ${+b.dataset.preset + 1}`); }, 700);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, () => clearTimeout(holdT)));
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) Media.setSource(b.dataset.tab);
      else if (b.dataset.m) Media[b.dataset.m]();
      else if (b.dataset.preset) { if (!held) Media.tunePreset(+b.dataset.preset); }
      else if (b.dataset.item) Media.playItem(+b.dataset.item);
      else if (b.dataset.v && b.closest('[data-seg="queue"]')) Media.setQueue(b.dataset.v);
    });
    el.addEventListener('pointerdown', e => {
      const bar = e.target.closest('.seekbar'); if (!bar) return;
      const seekTo = ev => { const r = bar.getBoundingClientRect(); Media.seek((ev.clientX - r.left) / r.width); };
      seekTo(e);
      const mv = ev => seekTo(ev), up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
    Bus.on('media', t => { if (t === 'tick') tick(); else render(); });
    Bus.on('settings', k => k === 'distUnit' || render());
    render();
    return { reset() { } };
  })();

  /* ===================== NAVIGATION ===================== */
  VIEWS.nav = (() => {
    const el = V('nav');
    el.innerHTML = `
      <div class="nav-wrap">
        <div class="nav-map" id="nav-map"></div>
        <div class="nav-man" id="nav-man"></div>
        <div class="nav-speed" id="nav-speed"><div class="limit"><b>50</b></div><div class="cur"><b>0</b><small>km/h</small></div></div>
        <div class="nav-road" id="nav-road"></div>
        <div class="nav-tools">
          <button data-n="search" class="primary" aria-label="Search">${ic('search')}</button>
          <button data-n="zin" aria-label="Zoom in">${ic('plus')}</button>
          <button data-n="zout" aria-label="Zoom out">${ic('minus')}</button>
          <button data-n="tilt" id="nav-tilt" class="txt">3D</button>
          <button data-n="voice" id="nav-voice" aria-label="Voice guidance">${ic('vol')}</button>
        </div>
        <button class="nav-recenter" id="nav-recenter" data-n="recenter">${ic('locate')}<span>Re-centre</span></button>
        <div class="nav-eta" id="nav-eta"></div>
        <div class="nav-search" id="nav-search" hidden>
          <div class="ns-left">
            <div class="ns-input"><span id="ns-q"></span><i class="caret"></i><button data-n="clear" aria-label="Clear">${ic('x')}</button></div>
            <div class="kb" id="kb"></div>
          </div>
          <div class="ns-right"><div class="ns-head" id="ns-head">Favourites &amp; recent</div><div class="scroll" id="ns-results"></div></div>
          <button class="ns-close" data-n="close" aria-label="Close search">${ic('x')}</button>
        </div>
      </div>`;
    const map = new MapView($('#nav-map', el), { style: 'nbt', zoom: 1, tilt: Settings.get('map3d'), carY: 0.66 });
    map.onFollow = f => $('#nav-recenter').classList.toggle('show', !f);

    /* On-screen keyboard */
    let q = '';
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    $('#kb', el).innerHTML = rows.map((r, i) => `<div class="kb-row">${[...r].map(k => `<button data-k="${k}">${k}</button>`).join('')}${i === 2 ? `<button data-k="BS" class="w" aria-label="Delete">${ic('backspace')}</button>` : ''}</div>`).join('') +
      `<div class="kb-row"><button data-k="123" class="w">123</button><button data-k=" " class="space">space</button><button data-k="OK" class="w go">${ic('search')}</button></div>`;
    function results() {
      const ql = q.trim().toLowerCase();
      const items = World.pois.filter(p => !ql || p.name.toLowerCase().includes(ql) || p.sub.toLowerCase().includes(ql));
      $('#ns-q').textContent = q || '';
      $('#ns-q').dataset.ph = q ? '' : 'Enter a destination';
      $('#ns-head').textContent = ql ? `${items.length} result${items.length === 1 ? '' : 's'}` : 'Favourites & recent';
      $('#ns-results').innerHTML = items.map(p => {
        const d = Math.hypot(p.node.x - Nav.st.car.x, p.node.y - Nav.st.car.y) * Nav.MPU * 1.25;
        return `<button class="li" data-poi="${esc(p.name)}"><span class="li-n">${ic(p.icon)}</span><span class="li-b"><b>${esc(p.name)}</b><small>${esc(p.sub)}</small></span><span class="li-r">${Fmt.dist(d)}</span></button>`;
      }).join('') || `<div class="empty">No matches for “${esc(q)}”</div>`;
    }
    const openSearch = () => { q = ''; results(); $('#nav-search').hidden = false; };
    const closeSearch = () => { $('#nav-search').hidden = true; };

    function overlay() {
      const m = Nav.nextMan(), e = $('#nav-man'), eta = $('#nav-eta');
      if (Nav.st.active && m) {
        e.innerHTML = `<div class="nm-ic">${ic(turnIcon(m.dir))}</div><div class="nm-t"><b>${Fmt.dist(m.dist)}</b><span>${m.dir === 'flag' ? 'Destination' : m.dir === 'straight' ? 'Continue onto' : 'Turn ' + m.dir + ' onto'}</span><em>${esc(m.road)}</em></div>`;
        e.className = 'nav-man show';
        const rem = Nav.remainSec();
        eta.innerHTML = `<div class="eta-dest">${ic('flag')}<span>${esc(Nav.st.dest.name)}</span></div>
          <div class="eta-v"><b>${Fmt.arrival(rem)}</b><small>Arrival</small></div><div class="eta-v"><b>${Fmt.mins(rem)}</b><small>Time</small></div><div class="eta-v"><b>${Fmt.dist(Nav.remainM())}</b><small>Distance</small></div>
          <button class="eta-end" data-n="end">${ic('x')}<span>End</span></button>`;
        eta.className = 'nav-eta show';
      } else if (Nav.st.arrived) {
        e.innerHTML = `<div class="nm-ic">${ic('flag')}</div><div class="nm-t"><b>Arrived</b><span>You have reached</span><em>${esc(Nav.st.dest.name)}</em></div>`;
        e.className = 'nav-man show';
        eta.innerHTML = `<div class="eta-dest">${ic('check')}<span>${Settings.get('demoDrive') ? 'Demo drive will continue shortly…' : 'Destination reached'}</span></div><button class="eta-end go" data-n="search">${ic('search')}<span>New destination</span></button>`;
        eta.className = 'nav-eta show';
      } else {
        e.className = 'nav-man';
        eta.innerHTML = `<button class="eta-where" data-n="search">${ic('search')}<span>Where to?</span></button>
          ${['Home', 'Work', 'Lansdowne Park'].map(n => `<button class="eta-fav" data-poi="${n}">${ic(World.poi(n).icon)}<span>${n}</span></button>`).join('')}`;
        eta.className = 'nav-eta show idle';
      }
      const r = Nav.road();
      $('#nav-road').textContent = r ? r.name : 'Laurier Ave';
      $('#nav-speed').innerHTML = `<div class="limit"><b>${Fmt.speed(r ? r.limit : 40)}</b></div><div class="cur"><b>${Fmt.speed(Nav.kmh)}</b><small>${Fmt.speedUnit()}</small></div>`;
      $('#nav-tilt').classList.toggle('on', !!Settings.get('map3d'));
      $('#nav-voice').innerHTML = ic(Settings.get('voiceGuidance') ? 'vol' : 'mute');
    }
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const n = b.dataset.n;
      if (b.dataset.k) {
        const k = b.dataset.k;
        if (k === 'BS') q = q.slice(0, -1);
        else if (k === 'OK') { const first = $('#ns-results [data-poi]'); if (first) first.click(); return; }
        else if (k === '123') return;
        else q += q.length && q[q.length - 1] !== ' ' ? k.toLowerCase() : k;
        return results();
      }
      if (b.dataset.poi) { const p = World.poi(b.dataset.poi); if (Nav.go(p)) { closeSearch(); map.recenter(); } return; }
      if (n === 'search') openSearch();
      else if (n === 'close') closeSearch();
      else if (n === 'clear') { q = ''; results(); }
      else if (n === 'zin') map.zoomBy(1.35);
      else if (n === 'zout') map.zoomBy(1 / 1.35);
      else if (n === 'tilt') Settings.set('map3d', !Settings.get('map3d'));
      else if (n === 'voice') Settings.set('voiceGuidance', !Settings.get('voiceGuidance'));
      else if (n === 'recenter') map.recenter();
      else if (n === 'end') Nav.stop();
    });
    Bus.on('navtick', overlay); Bus.on('nav', overlay);
    Bus.on('settings', k => { if (k === 'map3d' || k === '*') map.setTilt(Settings.get('map3d')); overlay(); });
    overlay();
    return {
      back() { if (!$('#nav-search').hidden) { closeSearch(); return true; } return false; },
      reset() { map.recenter(); }
    };
  })();

  /* ===================== COMMUNICATION ===================== */
  VIEWS.tel = (() => {
    const el = V('tel');
    let tab = 'recents', dialed = '';
    function render() {
      const missed = Phone.recents.filter(r => r.type === 'missed').length;
      let body = '';
      if (tab === 'recents') body = `<div class="scroll list-pane">${Phone.recents.map(r => `
          <button class="li" data-dial="${esc(r.n)}">${avatar(r.n)}<span class="li-b"><b class="${r.type === 'missed' ? 'missed' : ''}">${esc(r.n)}</b><small>${ic(r.type === 'out' ? 'out' : 'in', r.type)} ${r.type === 'missed' ? 'Missed' : r.type === 'out' ? 'Outgoing' : 'Incoming'}</small></span><span class="li-r">${r.t}</span><span class="li-call">${ic('phone')}</span></button>`).join('')}</div>`;
      else if (tab === 'contacts') {
        let letter = '';
        body = `<div class="scroll list-pane">${Phone.contacts.map(c => {
          const L = c.n[0].toUpperCase(); const h = L !== letter ? `<div class="li-sec">${(letter = L)}</div>` : '';
          return `${h}<button class="li" data-dial="${esc(c.n)}">${avatar(c.n)}<span class="li-b"><b>${esc(c.n)}${c.fav ? ' ' + ic('star', 'fav') : ''}</b><small>Mobile · ${c.num}</small></span><span class="li-call">${ic('phone')}</span></button>`;
        }).join('')}</div>`;
      } else {
        body = `<div class="keypad-wrap">
          <div class="kp-left"><div class="kp-num" id="kp-num">${dialed ? esc(dialed) : '<span class="ph">Enter number</span>'}</div>
            <div class="kp-acts"><button class="kp-del" data-kp="del" aria-label="Delete">${ic('backspace')}</button><button class="kp-call" data-kp="call">${ic('phone-f')}<span>Call</span></button></div>
            <div class="kp-hint">${Phone.device} · ${Phone.battery}% · Rogers LTE</div></div>
          <div class="keypad">${['1', '2 ABC', '3 DEF', '4 GHI', '5 JKL', '6 MNO', '7 PQRS', '8 TUV', '9 WXYZ', '*', '0 +', '#'].map(k => { const [d, s] = k.split(' '); return `<button data-kp="${d}"><b>${d}</b><small>${s || '&nbsp;'}</small></button>`; }).join('')}</div>
        </div>`;
      }
      el.innerHTML = `<div class="layout">${rail([['recents', 'clock', 'Recents', missed], ['contacts', 'users', 'Contacts'], ['keypad', 'keypad', 'Keypad']], tab)}<div class="pane">${body}</div></div>`;
    }
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; render(); }
      else if (b.dataset.dial) Phone.dial(b.dataset.dial);
      else if (b.dataset.kp) {
        const k = b.dataset.kp;
        if (k === 'del') dialed = dialed.slice(0, -1);
        else if (k === 'call') { if (dialed) Phone.dial(dialed); return; }
        else if (dialed.length < 14) dialed += k;
        $('#kp-num', el).innerHTML = dialed ? esc(dialed) : '<span class="ph">Enter number</span>';
      }
    });
    Bus.on('call', () => current === 'tel' && tab === 'recents' && render());
    render();
    return { show: render };
  })();

  /* Call overlay (works from any screen) */
  const CallUI = (() => {
    const el = $('#nbt-call'), pill = $('#sb-call');
    let min = false;
    function render() {
      const c = Phone.call;
      if (!c) { el.hidden = true; pill.hidden = true; min = false; return; }
      const status = c.status === 'ringing' ? 'Incoming call' : c.status === 'dialing' ? 'Calling…' : fmtDur(Phone.elapsed());
      pill.hidden = !min; $('span', pill).textContent = c.status === 'active' ? fmtDur(Phone.elapsed()) : '…';
      el.hidden = min;
      if (min) return;
      el.innerHTML = `
        <div class="co-card">
          ${avatar(c.n, 'av av-xl')}
          <div class="co-n">${esc(c.n)}</div>
          <div class="co-s ${c.status}">${status}</div>
          <div class="co-num">${esc(c.num)} · via ${Phone.device}</div>
          <div class="co-btns">
            ${c.status === 'ringing'
              ? `<button class="co-b decline" data-c="end">${ic('endcall')}<span>Decline</span></button><button class="co-b accept" data-c="answer">${ic('phone-f')}<span>Accept</span></button>`
              : `<button class="co-b ${c.muted ? 'on' : ''}" data-c="toggleMute">${ic(c.muted ? 'mic-off' : 'mic')}<span>${c.muted ? 'Unmute' : 'Mute'}</span></button>
                 <button class="co-b decline" data-c="end">${ic('endcall')}<span>End</span></button>
                 <button class="co-b" data-c="min">${ic('chev-d')}<span>Minimise</span></button>`}
          </div>
        </div>`;
    }
    el.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; if (b.dataset.c === 'min') { min = true; render(); } else Phone[b.dataset.c](); });
    pill.addEventListener('click', () => { min = false; render(); });
    Bus.on('call', c => { if (c && c.status === 'ringing') min = false; render(); });
    setInterval(() => { if (Phone.call && Phone.call.status === 'active') { if (min) $('span', pill).textContent = fmtDur(Phone.elapsed()); else { const s = $('.co-s', el); if (s) s.textContent = fmtDur(Phone.elapsed()); } } }, 1000);
    return { render };
  })();

  /* ===================== OFFICE ===================== */
  VIEWS.office = (() => {
    const el = V('office');
    let tab = 'messages', sel = Messages.list[0].id;
    function render() {
      let body;
      if (tab === 'messages') {
        const m = Messages.list.find(x => x.id === sel);
        body = `<div class="two">
          <div class="scroll list-pane narrow">${Messages.list.map(x => `<button class="li ${x.id === sel ? 'on' : ''}" data-msg="${x.id}">${avatar(x.from)}<span class="li-b"><b>${esc(x.from)}${x.unread ? '<i class="dot"></i>' : ''}</b><small>${esc(x.text)}</small></span><span class="li-r">${x.t}</span></button>`).join('')}</div>
          <div class="msg-detail">
            <div class="md-head">${avatar(m.from)}<div><b>${esc(m.from)}</b><small>${m.t} · SMS</small></div></div>
            <p class="md-text">${esc(m.text)}</p>
            <div class="md-acts"><button class="btn" data-o="read">${ic('vol')}<span>Read aloud</span></button><button class="btn" data-o="call">${ic('phone')}<span>Call</span></button></div>
            <div class="md-quick">${['On my way!', 'Driving — will call you soon', 'Sounds good', 'Running late'].map(t => `<button class="chip" data-reply="${t}">${ic('reply')}${t}</button>`).join('')}</div>
          </div></div>`;
        Messages.read(sel);
      } else {
        const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
        body = `<div class="cal">
          <div class="cal-day"><b>${now.toLocaleDateString('en-CA', { weekday: 'long' })}</b><span>${now.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}</span></div>
          <div class="scroll cal-list">${Calendar.map(ev => {
            const [h, mi] = ev.t.split(':').map(Number), past = h * 60 + mi + 30 < nowMin;
            return `<div class="cal-ev ${past ? 'past' : ''}" style="--c:${ev.c}"><div class="ce-t"><b>${ev.t}</b><small>${ev.e}</small></div><div class="ce-b"><b>${esc(ev.title)}</b><small>${ic('pin')}${esc(ev.loc)}</small></div>${ev.poi ? `<button class="btn sm" data-goto="${esc(ev.poi)}">${ic('nav')}<span>Navigate</span></button>` : ''}</div>`;
          }).join('')}</div></div>`;
      }
      el.innerHTML = `<div class="layout">${rail([['messages', 'message', 'Messages', Messages.unread()], ['calendar', 'calendar', 'Calendar']], tab)}<div class="pane">${body}</div></div>`;
    }
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const m = Messages.list.find(x => x.id === sel);
      if (b.dataset.tab) { tab = b.dataset.tab; render(); }
      else if (b.dataset.msg) { sel = +b.dataset.msg; render(); }
      else if (b.dataset.o === 'read') { if (!Messages.speak(`Message from ${m.from}. ${m.text}`)) Bus.emit('toast', 'Speech is not available in this browser'); }
      else if (b.dataset.o === 'call') Phone.dial(m.from);
      else if (b.dataset.reply) Messages.reply(sel, b.dataset.reply);
      else if (b.dataset.goto) { if (Nav.go(World.poi(b.dataset.goto))) go('nav'); }
    });
    Bus.on('messages', () => { if (current === 'office') render(); });
    render();
    return { show: render };
  })();

  /* ===================== MY VEHICLE ===================== */
  VIEWS.vehicle = (() => {
    const el = V('vehicle');
    let tab = 'status';
    const ring = (v, max, color = 'var(--accent)') => {
      const f = clamp(v / max, 0, 1), C = 2 * Math.PI * 34;
      return `<svg viewBox="0 0 80 80" class="ring"><circle cx="40" cy="40" r="34" class="r-bg"/><circle cx="40" cy="40" r="34" class="r-fg" style="stroke:${color};stroke-dasharray:${C * 0.75 * f} ${C}"/></svg>`;
    };
    function pressure(b) { return Settings.get('distUnit') === 'mi' ? `${Math.round(b * 14.5)}<small> psi</small>` : `${b.toFixed(1)}<small> bar</small>`; }
    function body() {
      const v = Vehicle;
      if (tab === 'status') {
        const t = v.tires;
        const tire = (k, cls) => `<div class="tp ${cls} ${t[k] < 2.3 ? 'low' : ''}"><b>${pressure(t[k])}</b><small>${Fmt.temp(v.tireTemp[k])}</small></div>`;
        return `<div class="veh">
          <div class="car-wrap">
            ${tire('fl', 'fl')}${tire('fr', 'fr')}${tire('rl', 'rl')}${tire('rr', 'rr')}
            <svg class="car-top" viewBox="0 0 120 240">
              <defs><linearGradient id="cbody" x1="0" x2="1"><stop offset="0" stop-color="#2a3546"/><stop offset=".5" stop-color="#4a5a70"/><stop offset="1" stop-color="#2a3546"/></linearGradient></defs>
              <rect x="6" y="38" width="12" height="34" rx="4" class="wheel"/><rect x="102" y="38" width="12" height="34" rx="4" class="wheel"/>
              <rect x="6" y="166" width="12" height="34" rx="4" class="wheel"/><rect x="102" y="166" width="12" height="34" rx="4" class="wheel"/>
              <path d="M30 14 Q60 2 90 14 Q108 22 108 60 L108 196 Q108 230 60 234 Q12 230 12 196 L12 60 Q12 22 30 14Z" fill="url(#cbody)" stroke="#6b7c94" stroke-width="1"/>
              <path d="M24 78 Q60 62 96 78 L90 108 Q60 100 30 108Z" class="glass"/>
              <path d="M30 112 Q60 106 90 112 L90 168 Q60 172 30 168Z" fill="#1d2632" stroke="#556479" stroke-width=".8"/>
              <path d="M30 174 Q60 180 90 174 L94 200 Q60 210 26 200Z" class="glass"/>
              <path d="M22 22 L36 18 M98 22 L84 18" stroke="#e8f1ff" stroke-width="3" stroke-linecap="round"/>
              <path d="M22 226 L36 230 M98 226 L84 230" stroke="#ff4040" stroke-width="3" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="veh-side">
            <div class="vs-card"><div class="vs-h">${ic('fuel')}<span>Fuel &amp; range</span></div><div class="vs-big">${Fmt.km(v.rangeKm())}</div><div class="bar"><i style="width:${v.fuel * 100}%"></i></div><small>${Math.round(v.fuel * v.tankL)} L of ${v.tankL} L</small></div>
            <div class="vs-grid">
              <div class="vs-mini ok">${ic('check')}<span>Doors closed</span></div>
              <div class="vs-mini ${t.rl < 2.3 ? 'warn' : 'ok'}">${ic('tire')}<span>${t.rl < 2.3 ? 'Check rear left' : 'Tires OK'}</span></div>
              <div class="vs-mini">${ic('gauge')}<span>${Fmt.km(v.odoKm)}</span></div>
              <div class="vs-mini">${ic('thermo')}<span>${Fmt.temp(v.outsideC)} outside</span></div>
            </div>
          </div></div>`;
      }
      if (tab === 'trip') {
        const tr = v.trip, [c, cu] = Fmt.cons(tr.l100), max = Math.max(...v.history);
        return `<div class="trip">
          <div class="trip-stats">
            <div class="ts"><small>Avg. consumption</small><b>${c}</b><span>${cu}</span></div>
            <div class="ts"><small>Avg. speed</small><b>${Fmt.speed(tr.kmh)}</b><span>${Fmt.speedUnit()}</span></div>
            <div class="ts"><small>Distance</small><b>${Fmt.km(tr.km).replace(/ \w+$/, '')}</b><span>${Settings.get('distUnit') === 'mi' ? 'mi' : 'km'}</span></div>
            <div class="ts"><small>Driving time</small><b>${Math.floor(tr.mins / 60)}:${pad2(tr.mins % 60)}</b><span>h:min</span></div>
          </div>
          <div class="chart">
            <div class="ch-h"><span>Consumption · last 60 min</span><button class="btn sm" data-v="reset">${ic('repeat')}<span>Reset trip</span></button></div>
            <div class="ch-bars">${v.history.map((h, i) => `<i style="height:${(h / max) * 100}%" class="${h > tr.l100 + 1 ? 'hi' : ''}" title="${h}"></i>`).join('')}</div>
            <div class="ch-x"><span>-60 min</span><span>-30 min</span><span>now</span></div>
          </div></div>`;
      }
      if (tab === 'live') {
        const L = v.live;
        const g = (label, val, max, unit, dec = 0, col) => `<div class="gauge">${ring(val, max, col)}<div class="g-v"><b>${val.toFixed(dec)}</b><small>${unit}</small></div><span>${label}</span></div>`;
        return `<div class="live">
          <div class="live-h">${ic('activity')}<span>Live data · OBD-II</span><i class="pulse"></i></div>
          <div class="gauges">
            ${g('Engine speed', L.rpm, 7000, 'rpm')}
            ${g('Vehicle speed', Fmt.speed(L.kmh), Settings.get('distUnit') === 'mi' ? 120 : 200, Fmt.speedUnit())}
            ${g('Coolant', L.coolant, 130, '°C', 0, L.coolant > 105 ? 'var(--crit)' : undefined)}
            ${g('Battery', L.volts, 16, 'V', 1, L.volts < 12.2 ? 'var(--warn)' : undefined)}
            ${g('Engine load', L.load, 100, '%')}
            ${g('Throttle', L.throttle, 100, '%')}
          </div></div>`;
      }
      return `<div class="scroll list-pane service">${v.service.map(s => {
        const pct = s.km != null ? 1 - s.km / s.max : s.pct, due = pct > 0.9;
        return `<div class="svc ${due ? 'due' : ''}"><span class="svc-ic">${ic(s.ic)}</span><div class="svc-b"><b>${s.name}</b><div class="bar"><i style="width:${(1 - pct) * 100}%"></i></div></div><span class="svc-w">${s.km != null ? 'In ' + Fmt.km(s.km) : s.when.replace('Due ', '')}</span></div>`;
      }).join('')}</div>`;
    }
    function render() {
      el.innerHTML = `<div class="layout">${rail([['status', 'car', 'Vehicle status'], ['trip', 'bars', 'Trip computer'], ['live', 'activity', 'Live data'], ['service', 'wrench', 'Service']], tab)}<div class="pane">${body()}</div></div>`;
    }
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; render(); }
      else if (b.dataset.v === 'reset') { Vehicle.resetTrip(); render(); Bus.emit('toast', 'Trip computer reset'); }
    });
    setInterval(() => {
      const L = Vehicle.live, k = Nav.kmh, n = () => Math.random() - 0.5;
      L.kmh = k; L.rpm = Math.round(780 + k * 32 + n() * 60); L.load = clamp(18 + k * 0.35 + n() * 6, 0, 100);
      L.throttle = clamp(8 + k * 0.3 + n() * 5, 0, 100); L.coolant = 89 + n() * 1.5; L.volts = 14.1 + n() * 0.2;
      if (current === 'vehicle' && tab === 'live') render();
    }, 700);
    Bus.on('settings', () => current === 'vehicle' && render());
    render();
    return { show: render };
  })();

  /* ===================== CHECK CONTROL ===================== */
  VIEWS.alerts = (() => {
    const el = V('alerts');
    let open = null;
    function render() {
      const L = Alerts.list;
      el.innerHTML = L.length ? `<div class="alerts">
          <div class="al-head"><span>${L.length} Check Control message${L.length > 1 ? 's' : ''}</span><button class="btn sm" data-a="clear">${ic('check')}<span>Acknowledge all</span></button></div>
          <div class="scroll al-list">${L.map(a => `
            <div class="al ${a.sev} ${open === a.id ? 'open' : ''}" data-id="${a.id}">
              <button class="al-main" data-a="toggle"><span class="al-ic">${ic(a.ic)}</span><span class="al-b"><b>${esc(a.title)}</b><small>${a.sev === 'crit' ? 'Have checked immediately' : a.sev === 'warn' ? 'Check soon' : 'Information'}</small></span>${ic('chev-d', 'al-chev')}</button>
              <button class="al-x" data-a="dismiss" aria-label="Dismiss">${ic('x')}</button>
              <div class="al-detail">${esc(a.detail)}</div>
            </div>`).join('')}</div></div>`
        : `<div class="empty-state">${ic('check')}<b>No Check Control messages</b><span>All vehicle systems are working normally.</span><button class="btn" data-a="restore">${ic('repeat')}<span>Restore demo messages</span></button></div>`;
    }
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const row = b.closest('.al'), id = row ? +row.dataset.id : null;
      if (b.dataset.a === 'toggle') { open = open === id ? null : id; row.classList.toggle('open', open === id); $$('.al', el).forEach(r => r !== row && r.classList.remove('open')); }
      else if (b.dataset.a === 'dismiss') { row.classList.add('gone'); setTimeout(() => Alerts.dismiss(id), 220); }
      else if (b.dataset.a === 'clear') Alerts.clearAll();
      else if (b.dataset.a === 'restore') Alerts.restore();
    });
    /* swipe a row left to dismiss */
    let sw = null;
    el.addEventListener('pointerdown', e => { const r = e.target.closest('.al'); if (r) sw = { r, x: e.clientX, dx: 0 }; });
    el.addEventListener('pointermove', e => { if (!sw) return; sw.dx = Math.min(0, (e.clientX - sw.x) / UI.scale); if (sw.dx < -10) sw.r.style.transform = `translateX(${sw.dx}px)`; });
    const end = () => { if (!sw) return; const { r, dx } = sw; sw = null; if (dx < -140) { r.classList.add('gone'); setTimeout(() => Alerts.dismiss(+r.dataset.id), 220); } else r.style.transform = ''; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    Bus.on('alerts', render);
    render();
    return { show: render };
  })();

  /* ===================== SETTINGS ===================== */
  VIEWS.settings = (() => {
    const el = V('settings');
    let tab = 'display';
    const row = (label, ctl, sub) => `<div class="set-row"><div class="sr-l"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="sr-c">${ctl}</div></div>`;
    const slider = (k, min, max, val, lbl) => `<div class="rng-wrap"><input type="range" class="rng" data-rng="${k}" min="${min}" max="${max}" value="${val}"><output>${lbl || val}</output></div>`;
    function pane() {
      const S = Settings.get;
      if (tab === 'display') return `
        ${row('Brightness', slider('brightness', 30, 100, S('brightness'), S('brightness') + '%'))}
        ${row('Accent colour', `<div class="swatches">${[['blue', 'Blue'], ['red', 'Classic red'], ['amber', 'Amber'], ['teal', 'Teal']].map(([k, l]) => `<button class="sw sw-${k} ${S('accent') === k ? 'on' : ''}" data-accent="${k}" aria-label="${l}"><i></i><span>${l}</span></button>`).join('')}</div>`, 'Classic red is the original theme of this project')}
        ${row('Split screen', toggle('split', S('split')), 'Show the side panel with map, media, onboard info or weather')}`;
      if (tab === 'sound') return `
        ${row('Bass', slider('eqBass', -6, 6, S('eqBass'), (S('eqBass') > 0 ? '+' : '') + S('eqBass')))}
        ${row('Mid', slider('eqMid', -6, 6, S('eqMid'), (S('eqMid') > 0 ? '+' : '') + S('eqMid')))}
        ${row('Treble', slider('eqTreble', -6, 6, S('eqTreble'), (S('eqTreble') > 0 ? '+' : '') + S('eqTreble')))}
        <div class="set-row tall"><div class="sr-l"><b>Balance / Fader</b><small>Drag the dot to move the sound focus</small><button class="btn sm" data-act2="center">Centre</button></div>
          <div class="sr-c"><div class="bf-pad" id="bf-pad"><span class="bf-l">Front</span><span class="bf-r">Rear</span><i class="bf-cross"></i><i class="bf-dot" style="left:${50 + S('balance') * 5}%;top:${50 + S('fader') * 5}%"></i></div></div></div>
        ${row('Speed-dependent volume', seg('speedVol', [[0, 'Off'], [1, 'Low'], [2, 'Med'], [3, 'High']], S('speedVol')))}`;
      if (tab === 'general') return `
        ${row('Time format', seg('clock24', [[true, '24 h'], [false, '12 h']], S('clock24')))}
        ${row('Temperature', seg('tempUnit', [['C', '°C'], ['F', '°F']], S('tempUnit')))}
        ${row('Distance', seg('distUnit', [['km', 'km'], ['mi', 'miles']], S('distUnit')))}
        ${row('Date &amp; time', `<span class="val">${new Date().toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' })} · synced from ${Phone.device}</span>`)}`;
      if (tab === 'navigation') return `
        ${row('3D map view', toggle('map3d', S('map3d')))}
        ${row('Map orientation', seg('headingUp', [[true, 'Direction of travel'], [false, 'North up']], S('headingUp')))}
        ${row('Voice guidance', toggle('voiceGuidance', S('voiceGuidance')), 'Spoken turn instructions (uses browser speech)')}`;
      if (tab === 'connections') return `
        <div class="dev-card">${ic('phone', 'dev-ic')}<div><b>${Phone.device}</b><small>Connected · Phone, Audio, Messages${S('carplayEnabled') ? ', CarPlay' : ''}</small></div><span class="dev-bat">${Phone.battery}%</span></div>
        ${row('CarPlay', toggle('carplayEnabled', S('carplayEnabled')), 'Allow the phone to project CarPlay on this display')}
        ${row('Start CarPlay automatically', toggle('carplayAuto', S('carplayAuto')), 'Open CarPlay when the system starts')}
        ${row('Wi-Fi hotspot', `<span class="val">Off</span>`)}`;
      if (tab === 'demo') return `
        ${row('Demo drive', toggle('demoDrive', S('demoDrive')), 'Keep driving to a new destination after arrival')}
        ${row('Incoming call', `<button class="btn" data-demo="call">${ic('phone')}<span>Simulate</span></button>`)}
        ${row('Check Control', `<button class="btn" data-demo="alert">${ic('warn')}<span>Add message</span></button>`)}
        ${row('New text message', `<button class="btn" data-demo="msg">${ic('message')}<span>Simulate</span></button>`)}
        ${row('Reset all settings', `<button class="btn danger" data-demo="reset">${ic('repeat')}<span>Reset</span></button>`)}`;
      return `<div class="about">
        <div class="ab-logo">${ic('car')}</div>
        <b>Car Infotainment UI</b><span>Version 2.0 · NBT-inspired touch concept</span>
        <p>A browser-based concept for a touch-first, widescreen car infotainment system with a mock phone projection mode. All data is simulated.</p>
        <p class="dim">Hardware keys: BACK · MENU · MEDIA · NAV · TEL · volume. Keyboard: Esc = back, K = kiosk mode.</p></div>`;
    }
    function render() {
      el.innerHTML = `<div class="layout">${rail([['display', 'display', 'Display'], ['sound', 'eq', 'Sound'], ['general', 'gear', 'General'], ['navigation', 'nav', 'Navigation'], ['connections', 'link', 'Connections'], ['demo', 'flask', 'Demo'], ['about', 'info', 'About']], tab)}<div class="pane"><div class="scroll set-pane">${pane()}</div></div></div>`;
    }
    const parse = v => (v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v);
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; return render(); }
      if (b.dataset.set) Settings.set(b.dataset.set, !Settings.get(b.dataset.set));
      else if (b.dataset.accent) Settings.set('accent', b.dataset.accent);
      else if (b.dataset.v && b.closest('[data-seg]')) Settings.set(b.closest('[data-seg]').dataset.seg, parse(b.dataset.v));
      else if (b.dataset.act2 === 'center') { Settings.set('balance', 0); Settings.set('fader', 0); }
      else if (b.dataset.demo === 'call') { Bus.emit('toast', 'Incoming call in 2 seconds…'); setTimeout(() => Phone.incoming('Priya Sharma'), 2000); }
      else if (b.dataset.demo === 'alert') Alerts.add();
      else if (b.dataset.demo === 'msg') {
        Messages.list.unshift({ id: Date.now(), from: 'Alex Chen', text: 'Found parking on Clarence. Table for two by the window!', t: Fmt.clock(), unread: true });
        Bus.emit('messages'); Bus.emit('toast', 'New message from Alex Chen');
      } else if (b.dataset.demo === 'reset') Settings.reset();
    });
    el.addEventListener('input', e => {
      const r = e.target.closest('[data-rng]'); if (!r) return;
      const k = r.dataset.rng, v = +r.value;
      r.nextElementSibling.textContent = k === 'brightness' ? v + '%' : (v > 0 ? '+' : '') + v;
      Settings.set(k, v);
    });
    el.addEventListener('pointerdown', e => {
      const pad = e.target.closest('#bf-pad'); if (!pad) return;
      const setP = ev => {
        const r = pad.getBoundingClientRect();
        const bx = clamp(Math.round(((ev.clientX - r.left) / r.width - 0.5) * 20), -10, 10), by = clamp(Math.round(((ev.clientY - r.top) / r.height - 0.5) * 20), -10, 10);
        const dot = $('.bf-dot', pad); dot.style.left = `${50 + bx * 5}%`; dot.style.top = `${50 + by * 5}%`;
        Settings.set('balance', bx); Settings.set('fader', by);
      };
      setP(e);
      const up = () => { removeEventListener('pointermove', setP); removeEventListener('pointerup', up); };
      addEventListener('pointermove', setP); addEventListener('pointerup', up);
    });
    Bus.on('settings', k => {
      if (current !== 'settings') return;
      if (['balance', 'fader', 'brightness', 'eqBass', 'eqMid', 'eqTreble'].includes(k)) return; // live controls already updated
      const sc = $('.set-pane', el), top = sc ? sc.scrollTop : 0;
      render();
      const sc2 = $('.set-pane', el); if (sc2) sc2.scrollTop = top;
    });
    render();
    return { show: render };
  })();

  /* ===================== Global chrome ===================== */
  function tickStatus() {
    $('#sb-clock').innerHTML = `${Fmt.clock()}${Fmt.ampm() ? `<small>${Fmt.ampm()}</small>` : ''}`;
    $('#sb-temp').textContent = Fmt.temp(Vehicle.outsideC);
    const n = Alerts.count(), b = $('#sb-badge');
    b.textContent = n || ''; b.hidden = !n;
  }
  setInterval(tickStatus, 1000);
  Bus.on('settings', tickStatus); Bus.on('alerts', tickStatus);
  tickStatus();

  /* Volume HUD */
  let volT;
  Bus.on('volume', () => {
    if (root.hidden) return;
    const h = $('#nbt-vol'), s = Media.st;
    $('.vh-ic', h).innerHTML = ic(s.muted || !s.vol ? 'mute' : 'vol');
    $('i', h).style.width = `${s.muted ? 0 : (s.vol / 40) * 100}%`;
    $('b', h).textContent = s.muted ? 'Mute' : s.vol;
    h.classList.add('show'); clearTimeout(volT); volT = setTimeout(() => h.classList.remove('show'), 1600);
  });

  /* Toasts */
  let toastT;
  Bus.on('toast', msg => {
    if (root.hidden) return;
    const t = $('#nbt-toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  });
  Bus.on('alert:new', a => Bus.emit('toast', `Check Control: ${a.title}`));

  /* Delegated chrome actions */
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-go],[data-act]'); if (!b || !root.contains(b)) return;
    if (b.dataset.go) go(b.dataset.go);
    else if (b.dataset.act === 'back') back();
    else if (b.dataset.act === 'split') Split.toggle();
  });

  /* Edge swipe from the left = back */
  let edge = null;
  $('#views').addEventListener('pointerdown', e => {
    const r = $('#views').getBoundingClientRect();
    if ((e.clientX - r.left) / UI.scale < 24 && current !== 'home') edge = e.clientX;
  });
  addEventListener('pointerup', e => { if (edge !== null && (e.clientX - edge) / UI.scale > 90) back(); edge = null; });

  show('home');
  return { go, back, get current() { return current; }, root };
})();
