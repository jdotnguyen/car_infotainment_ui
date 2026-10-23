/*
 * carplay.js — a mock phone-projection ("CarPlay-style") mode.
 * Generic, original icons; all content is simulated.
 */
'use strict';

const CarPlay = (() => {
  const root = $('#carplay');
  const WALLS = [
    'radial-gradient(120% 90% at 0% 0%, #3a2d7a 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #0f5f7a 0%, transparent 60%), #0c0c14',
    'radial-gradient(120% 90% at 0% 100%, #7a2d4d 0%, transparent 60%), radial-gradient(100% 90% at 100% 0%, #7a4b0f 0%, transparent 60%), #120c0c',
    'radial-gradient(120% 90% at 20% 0%, #1f5f3a 0%, transparent 60%), radial-gradient(100% 90% at 100% 100%, #1d3c7a 0%, transparent 60%), #0b100e',
    'linear-gradient(160deg, #26282e, #0e0f12)'
  ];
  const APPS = {
    phone: { name: 'Phone', ic: 'phone-f', bg: 'linear-gradient(180deg,#5cf07a,#1fbf47)' },
    music: { name: 'Music', ic: 'music', bg: 'linear-gradient(180deg,#ff6b81,#f5213f)' },
    maps: { name: 'Maps', ic: 'nav', bg: 'maps' },
    messages: { name: 'Messages', ic: 'message', bg: 'linear-gradient(180deg,#6cf38a,#1dc443)' },
    nowplaying: { name: 'Now Playing', ic: 'wave', bg: 'linear-gradient(180deg,#ff5a7a,#c4155b)' },
    podcasts: { name: 'Podcasts', ic: 'podcast', bg: 'linear-gradient(180deg,#d77bff,#8a32e0)' },
    audiobooks: { name: 'Audiobooks', ic: 'book', bg: 'linear-gradient(180deg,#ffb340,#ff7a00)' },
    calendar: { name: 'Calendar', ic: 'calendar', bg: 'calendar' },
    settings: { name: 'Settings', ic: 'gear', bg: 'linear-gradient(180deg,#a1a1a8,#5f5f66)' },
    vehicle: { name: 'Vehicle', ic: 'car', bg: 'linear-gradient(180deg,#3a4250,#12151a)' }
  };
  const ORDER = ['phone', 'music', 'maps', 'messages', 'nowplaying', 'podcasts', 'audiobooks', 'calendar', 'settings', 'vehicle'];
  let screen = 'home', stack = [], recents = ['maps', 'music', 'phone'], connected = false, sub = {};

  const appIcon = (k, size = '') => {
    const a = APPS[k];
    if (a.bg === 'maps') return `<span class="cp-icon maps ${size}"><svg viewBox="0 0 60 60"><rect width="60" height="60" fill="#e9f3e2"/><path d="M-5 42 L65 18" stroke="#fff" stroke-width="9"/><path d="M-5 42 L65 18" stroke="#f9d36b" stroke-width="5"/><path d="M22 -5 L34 65" stroke="#fff" stroke-width="6"/><path d="M0 8 Q20 14 30 4" stroke="#9fd0f5" stroke-width="7" fill="none"/><circle cx="45" cy="44" r="10" fill="#fff"/><path d="M45 37 l5.5 12 -5.5-3 -5.5 3z" fill="#1a7cf5"/></svg></span>`;
    if (a.bg === 'calendar') { const d = new Date(); return `<span class="cp-icon cal ${size}"><small>${d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</small><b>${d.getDate()}</b></span>`; }
    return `<span class="cp-icon ${size}" style="background:${a.bg}">${ic(a.ic)}</span>`;
  };

  root.innerHTML = `
    <div class="cp-wall"></div>
    <aside class="cp-side">
      <div class="cp-time" id="cp-time"></div>
      <div class="cp-sig">${ic('signal')}<span>LTE</span></div>
      <div class="cp-recents" id="cp-recents"></div>
      <button class="cp-homebtn" id="cp-homebtn" aria-label="Home">${ic('dash')}</button>
    </aside>
    <main class="cp-main" id="cp-main"></main>
    <div class="cp-banner" id="cp-banner"></div>
    <div class="cp-voice" id="cp-voice" hidden><div class="cp-orb"><i></i><i></i><i></i></div><div class="cp-vtext">Listening…</div></div>
    <div class="cp-vol" id="cp-vol"><span></span><div><i></i></div></div>
    <div class="cp-connect" id="cp-connect" hidden><div class="cc-phone">${ic('carplay')}</div><b>Connecting to ${Phone.device}…</b><span>Keep your phone unlocked</span></div>
  `;
  const main = $('#cp-main');

  function theme() {
    const ap = Settings.get('cpAppearance');
    const light = ap === 'light' || (ap === 'auto' && (new Date().getHours() < 7 || new Date().getHours() >= 19) === false);
    root.classList.toggle('cp-light', light);
    $('.cp-wall', root).style.background = WALLS[Settings.get('cpWallpaper') % WALLS.length];
  }
  const mapStyle = () => (root.classList.contains('cp-light') ? 'cpLight' : 'cpDark');

  /* Maps are created once and re-parented as screens change */
  const mapHost = document.createElement('div');
  mapHost.className = 'cp-maphost';
  const bigMap = new MapView(mapHost, { style: mapStyle, zoom: 1.05, carY: 0.6 });
  bigMap.onFollow = f => { const b = $('#cpm-recenter'); if (b) b.hidden = f; };
  const dashHost = document.createElement('div');
  dashHost.className = 'cp-maphost';
  const dashMap = new MapView(dashHost, { style: mapStyle, zoom: 0.85, interactive: false, carY: 0.6, labels: true });

  const turnIc = d => ({ left: 'turn-l', right: 'turn-r', straight: 'straight', flag: 'flag' }[d] || 'straight');

  /* ---------- Screens ---------- */
  const S = {};
  S.home = () => `<div class="cp-grid">${ORDER.map(k => `<button class="cp-app" data-open="${k}">${appIcon(k)}<span>${APPS[k].name}</span></button>`).join('')}</div>`;

  S.dash = () => {
    const m = Media.summary(), t = m.track, ev = Calendar.find(e => +e.t.split(':')[0] * 60 + +e.t.split(':')[1] > new Date().getHours() * 60 + new Date().getMinutes()) || Calendar[Calendar.length - 1];
    return `<div class="cp-dash">
      <div class="cd-map" data-open="maps"><div class="cd-maphost"></div><div class="cd-man" id="cd-man"></div></div>
      <div class="cd-col">
        <div class="cd-card cd-np" data-open="nowplaying">
          ${t ? artHTML(t, 'art cd-art') : `<div class="art cd-art radio">${ic('radio')}</div>`}
          <div class="cd-np-b"><b>${esc(m.t)}</b><small>${esc(m.a)}</small>
            <div class="cd-ctrl"><button data-mc="prev">${ic('prev')}</button><button data-mc="toggle">${ic(Media.st.playing ? 'pause' : 'play')}</button><button data-mc="next">${ic('next')}</button></div></div>
        </div>
        <div class="cd-card cd-cal" data-open="calendar">
          <div class="cd-cal-ic">${appIcon('calendar', 'sm')}</div>
          <div><b>${esc(ev.title)}</b><small>${ev.t} – ${ev.e} · ${esc(ev.loc)}</small></div>
        </div>
      </div></div>`;
  };

  S.maps = () => `<div class="cpm">
      <div class="cpm-map"></div>
      <div class="cpm-man" id="cpm-man"></div>
      <div class="cpm-btns"><button data-mp="search" aria-label="Search">${ic('search')}</button><button data-mp="zin" aria-label="Zoom in">${ic('plus')}</button><button data-mp="zout" aria-label="Zoom out">${ic('minus')}</button></div>
      <button class="cpm-recenter" id="cpm-recenter" data-mp="recenter" hidden>${ic('locate')}</button>
      <div class="cpm-eta" id="cpm-eta"></div>
    </div>`;

  S.mapsearch = () => `<div class="cp-page">
      <div class="cp-hdr"><button class="cp-back" data-back>${ic('back')}</button><b>Destinations</b><span></span></div>
      <div class="cp-tiles">${['Home', 'Work'].map(n => `<button class="cp-fav" data-poi="${n}">${ic(n === 'Home' ? 'home' : 'office')}<b>${n}</b><small>${esc(World.poi(n).sub)}</small></button>`).join('')}
        ${[Calendar.find(e => e.poi && +e.t.split(':')[0] * 60 + +e.t.split(':')[1] > new Date().getHours() * 60 + new Date().getMinutes()) || Calendar.filter(e => e.poi).pop()].map(e => `<button class="cp-fav sug" data-poi="${esc(e.poi)}">${ic('calendar')}<b>${esc(e.poi)}</b><small>${esc(e.title)} · ${e.t}</small></button>`).join('')}</div>
      <div class="cp-sec">Recents</div>
      <div class="cp-list">${World.pois.filter(p => !['Home', 'Work'].includes(p.name)).map(p => `<button class="cp-row" data-poi="${esc(p.name)}"><span class="cp-ri red">${ic('pin')}</span><span class="cp-rb"><b>${esc(p.name)}</b><small>${esc(p.sub)}</small></span>${ic('chev', 'cp-chev')}</button>`).join('')}</div>
    </div>`;

  S.nowplaying = () => {
    const s = Media.st;
    if (!Media.isTrack()) Media.setSource('bt');
    const c = Media.cur();
    return `<div class="cp-np">
      ${artHTML(c, 'art cp-np-art')}
      <div class="cp-np-b">
        <div class="cp-np-src">${esc(Media.qname() === 'library' ? 'Music' : Media.qname()[0].toUpperCase() + Media.qname().slice(1))}</div>
        <div class="cp-np-t">${esc(c.t)}</div>
        <div class="cp-np-a">${esc(c.a)} — ${esc(c.al)}</div>
        <div class="cp-prog"><div class="cp-bar seek"><i style="width:${(s.pos / c.d) * 100}%"></i></div><div class="cp-times"><span id="cpt-pos">${fmtDur(s.pos)}</span><span id="cpt-rem">-${fmtDur(c.d - s.pos)}</span></div></div>
        <div class="cp-ctrls">
          <button data-mc="toggleShuffle" class="sm ${s.shuffle ? 'on' : ''}">${ic('shuffle')}</button>
          <button data-mc="prev">${ic('prev')}</button>
          <button data-mc="toggle" class="big">${ic(s.playing ? 'pause' : 'play')}</button>
          <button data-mc="next">${ic('next')}</button>
          <button data-mc="toggleRepeat" class="sm ${s.repeat ? 'on' : ''}">${ic('repeat')}</button>
        </div>
      </div>
      <button class="cp-np-list" data-open="library" aria-label="Library">${ic('list')}</button>
    </div>`;
  };

  const trackList = (q, title, back = true) => `<div class="cp-page">
      <div class="cp-hdr">${back ? `<button class="cp-back" data-back>${ic('back')}</button>` : '<span></span>'}<b>${title}</b><button class="cp-hbtn" data-open="nowplaying">${ic('wave')}</button></div>
      <div class="cp-list">${Media.queues[q].map((t, i) => {
        const on = Media.st.source === 'bt' && Media.qname() === q && Media.idx() === i;
        return `<button class="cp-row ${on ? 'on' : ''}" data-play="${q}:${i}">${artHTML(t, 'art cp-thumb')}<span class="cp-rb"><b>${esc(t.t)}</b><small>${esc(t.a)}${q === 'library' ? '' : ' · ' + Math.round(t.d / 60) + ' min'}</small></span>${on && Media.st.playing ? '<i class="eqbars"><i></i><i></i><i></i></i>' : ''}</button>`;
      }).join('')}</div></div>`;
  S.music = () => trackList('library', 'Library', false);
  S.podcasts = () => trackList('podcasts', 'Podcasts', false);
  S.audiobooks = () => trackList('audiobooks', 'Audiobooks', false);

  S.phone = () => {
    const t = sub.phone || 'favorites';
    let body = '';
    const row = (n, small, cls = '') => `<button class="cp-row" data-dial="${esc(n)}"><span class="cp-av" style="--h:${hue(n)}">${/^\(/.test(n) ? ic('user') : esc(initials(n))}</span><span class="cp-rb"><b class="${cls}">${esc(n)}</b><small>${small}</small></span>${ic('info', 'cp-chev')}</button>`;
    if (t === 'favorites') body = `<div class="cp-favs">${Phone.contacts.filter(c => c.fav).map(c => `<button class="cp-favc" data-dial="${esc(c.n)}"><span class="cp-av xl" style="--h:${hue(c.n)}">${esc(initials(c.n))}</span><b>${esc(c.n.split(' ')[0])}</b><small>mobile</small></button>`).join('')}</div>`;
    else if (t === 'recents') body = `<div class="cp-list">${Phone.recents.map(r => row(r.n, `${r.type === 'missed' ? 'Missed' : r.type === 'out' ? 'Outgoing' : 'Incoming'} · ${r.t}`, r.type === 'missed' ? 'missed' : '')).join('')}</div>`;
    else if (t === 'contacts') body = `<div class="cp-list">${Phone.contacts.map(c => row(c.n, c.num)).join('')}</div>`;
    else body = `<div class="cp-keypad"><div class="cpk-num" id="cpk-num">${esc(sub.dial || '')}</div><div class="cpk-grid">${['1', '2 ABC', '3 DEF', '4 GHI', '5 JKL', '6 MNO', '7 PQRS', '8 TUV', '9 WXYZ', '*', '0 +', '#'].map(k => { const [d, s] = k.split(' '); return `<button data-kp="${d}"><b>${d}</b><small>${s || ''}</small></button>`; }).join('')}</div><div class="cpk-acts"><button class="cpk-call" data-kp="call">${ic('phone-f')}</button><button data-kp="del" class="cpk-del">${ic('backspace')}</button></div></div>`;
    return `<div class="cp-page with-tabs"><div class="cp-tabbody">${body}</div>
      <nav class="cp-tabs">${[['favorites', 'star', 'Favorites'], ['recents', 'clock', 'Recents'], ['contacts', 'users', 'Contacts'], ['keypad', 'keypad', 'Keypad']].map(([k, i, l]) => `<button data-ptab="${k}" class="${t === k ? 'on' : ''}">${ic(i)}<span>${l}</span></button>`).join('')}</nav></div>`;
  };

  S.messages = () => `<div class="cp-page">
      <div class="cp-hdr"><span></span><b>Messages</b><button class="cp-hbtn" data-voice>${ic('mic')}</button></div>
      <div class="cp-list">${Messages.list.map(m => `<button class="cp-row" data-msg="${m.id}"><span class="cp-av" style="--h:${hue(m.from)}">${esc(initials(m.from))}</span><span class="cp-rb"><b>${m.unread ? '<i class="cp-dot"></i>' : ''}${esc(m.from)}</b><small>${esc(m.text)}</small></span><span class="cp-rt">${m.t}</span></button>`).join('')}</div></div>`;

  S.msgread = () => {
    const m = Messages.list.find(x => x.id === sub.msg);
    return `<div class="cp-read">
      <span class="cp-av xl" style="--h:${hue(m.from)}">${esc(initials(m.from))}</span>
      <b>${esc(m.from)}</b>
      <div class="cp-read-orb"><i></i><i></i><i></i><i></i><i></i></div>
      <p>“${esc(m.text)}”</p>
      <div class="cp-read-acts"><button data-back>${ic('x')}<span>Close</span></button><button data-reply>${ic('reply')}<span>Reply</span></button><button data-dial="${esc(m.from)}" class="green">${ic('phone-f')}<span>Call</span></button></div>
    </div>`;
  };

  S.calendar = () => {
    const d = new Date();
    return `<div class="cp-page">
      <div class="cp-hdr"><span></span><b>Today · ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</b><span></span></div>
      <div class="cp-list">${Calendar.map(e => `<div class="cp-row cal" style="--c:${e.c}"><span class="cp-calbar"></span><span class="cp-rb"><b>${esc(e.title)}</b><small>${e.t} – ${e.e} · ${esc(e.loc)}</small></span>${e.poi ? `<button class="cp-pill" data-poi="${esc(e.poi)}">${ic('nav')}Go</button>` : ''}</div>`).join('')}</div></div>`;
  };

  S.settings = () => `<div class="cp-page">
      <div class="cp-hdr"><span></span><b>Settings</b><span></span></div>
      <div class="cp-list">
        <div class="cp-row static"><span class="cp-ri" style="background:#5856d6">${ic('moon')}</span><span class="cp-rb"><b>Appearance</b></span>
          <div class="cp-seg">${[['auto', 'Automatic'], ['dark', 'Dark'], ['light', 'Light']].map(([k, l]) => `<button data-ap="${k}" class="${Settings.get('cpAppearance') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="cp-row static"><span class="cp-ri" style="background:#0a84ff">${ic('display')}</span><span class="cp-rb"><b>Wallpaper</b></span>
          <div class="cp-walls">${WALLS.map((w, i) => `<button data-wall="${i}" class="${Settings.get('cpWallpaper') === i ? 'on' : ''}" style="background:${w}"></button>`).join('')}</div></div>
        <div class="cp-row static"><span class="cp-ri" style="background:#5e5ce6">${ic('moon')}</span><span class="cp-rb"><b>Driving Focus</b><small>Silence notifications while driving</small></span><button class="cp-tgl ${sub.focus ? 'on' : ''}" data-focus><i></i></button></div>
        <div class="cp-row static"><span class="cp-ri" style="background:#34c759">${ic('phone-f')}</span><span class="cp-rb"><b>Connected to ${Phone.device}</b><small>Wired · Battery ${Phone.battery}%</small></span></div>
      </div></div>`;

  S.call = () => {
    const c = Phone.call;
    if (!c) return S.home();
    return `<div class="cp-call">
      <span class="cp-av xxl" style="--h:${hue(c.n)}">${/^\(|^\d/.test(c.n) ? ic('user') : esc(initials(c.n))}</span>
      <b>${esc(c.n)}</b>
      <span class="cp-cs" id="cp-cs">${c.status === 'ringing' ? 'mobile · incoming call' : c.status === 'dialing' ? 'calling…' : fmtDur(Phone.elapsed())}</span>
      <div class="cp-cbtns">${c.status === 'ringing'
        ? `<button class="cp-cb red" data-call="end">${ic('endcall')}<span>Decline</span></button><button class="cp-cb green" data-call="answer">${ic('phone-f')}<span>Accept</span></button>`
        : `<button class="cp-cb ${c.muted ? 'on' : ''}" data-call="toggleMute">${ic(c.muted ? 'mic-off' : 'mic')}<span>mute</span></button><button class="cp-cb"  data-call="kp">${ic('keypad')}<span>keypad</span></button><button class="cp-cb" data-call="audio">${ic('speaker')}<span>audio</span></button><button class="cp-cb red" data-call="end">${ic('endcall')}<span>end</span></button>`}</div>
    </div>`;
  };

  /* ---------- Rendering ---------- */
  function render() {
    const fn = S[screen] || S.home;
    main.className = `cp-main scr-${screen}`;
    main.innerHTML = fn();
    if (screen === 'maps') { $('.cpm-map', main).appendChild(mapHost); bigMap.follow = true; mapUpd(); }
    if (screen === 'dash') { $('.cd-maphost', main).appendChild(dashHost); mapUpd(); }
    if (screen === 'msgread') {
      const m = Messages.list.find(x => x.id === sub.msg);
      Messages.read(m.id);
      Messages.speak(`${m.from} said: ${m.text}`);
    }
    side();
  }
  function side() {
    $('#cp-recents').innerHTML = recents.map(k => `<button class="cp-rec ${screen === k || (k === 'music' && screen === 'nowplaying') ? 'on' : ''}" data-open="${k}">${appIcon(k, 'xs')}</button>`).join('');
    $('#cp-homebtn').innerHTML = ic(screen === 'home' ? 'dash' : 'grid');
    $('#cp-time').textContent = Fmt.clock(new Date(), Settings.get('clock24'));
  }
  function open(k) {
    if (k === 'vehicle') return close();
    let target = k;
    if (k === 'music' && Media.st.playing && Media.isTrack() && Media.qname() === 'library') target = 'nowplaying';
    if (k === 'library') { k = 'music'; target = 'music'; }
    if (['phone', 'music', 'maps', 'messages', 'podcasts', 'audiobooks', 'calendar', 'settings', 'nowplaying'].includes(k)) {
      const r = k === 'nowplaying' ? 'music' : k;
      recents = [r, ...recents.filter(x => x !== r)].slice(0, 3);
    }
    stack = (screen === 'home' || screen === 'dash') ? [screen] : stack.concat(screen);
    screen = target; render();
  }
  function push(k) { stack.push(screen); screen = k; render(); }
  function back() {
    if (!$('#cp-voice').hidden) return hideVoice();
    if (screen === 'call') return;
    if (stack.length) { screen = stack.pop(); render(); }
    else if (screen !== 'home') { screen = 'home'; render(); }
  }
  function homeBtn() {
    if (screen === 'home') screen = 'dash';
    else screen = 'home';
    stack = []; render();
  }

  function mapUpd() {
    const m = Nav.nextMan();
    const man = $('#cpm-man') || $('#cd-man');
    const eta = $('#cpm-eta');
    if (man) {
      if (Nav.st.active && m) {
        man.innerHTML = `<div class="cpm-arrow">${ic(turnIc(m.dir))}</div><div><b>${Fmt.dist(m.dist)}</b><span>${esc(m.road)}</span></div>`;
        man.hidden = false;
      } else if (Nav.st.arrived) { man.innerHTML = `<div class="cpm-arrow">${ic('flag')}</div><div><b>Arrived</b><span>${esc(Nav.st.dest.name)}</span></div>`; man.hidden = false; }
      else man.hidden = true;
    }
    if (eta) {
      if (Nav.st.active) {
        const r = Nav.remainSec();
        eta.innerHTML = `<div class="cpe-v"><b>${Fmt.arrival(r)}</b><small>arrival</small></div><div class="cpe-v"><b>${Fmt.mins(r)}</b><small>${Fmt.dist(Nav.remainM())}</small></div><button class="cpe-end" data-mp="end">End</button>`;
        eta.className = 'cpm-eta';
      } else {
        eta.innerHTML = `<button class="cpe-where" data-mp="search">${ic('search')}<span>Where to?</span></button>`;
        eta.className = 'cpm-eta idle';
      }
    }
  }

  /* Voice assistant (fake) */
  let voiceT;
  function showVoice() {
    const v = $('#cp-voice'); v.hidden = false;
    $('.cp-vtext', v).textContent = 'Listening…';
    clearTimeout(voiceT);
    voiceT = setTimeout(() => { $('.cp-vtext', v).textContent = 'Voice control isn’t available in this demo.'; voiceT = setTimeout(hideVoice, 2200); }, 2400);
  }
  function hideVoice() { clearTimeout(voiceT); $('#cp-voice').hidden = true; }

  /* ---------- Events ---------- */
  root.addEventListener('click', e => {
    const b = e.target.closest('button,[data-open]'); if (!b) return;
    const d = b.dataset;
    if (d.mc) { e.stopPropagation(); Media[d.mc](); return; }
    if (b.id === 'cp-homebtn') return homeBtn();
    if (d.open) return open(d.open);
    if (d.back !== undefined) return back();
    if (d.voice !== undefined) return showVoice();
    if (d.mp) {
      if (d.mp === 'search') push('mapsearch');
      else if (d.mp === 'zin') bigMap.zoomBy(1.35);
      else if (d.mp === 'zout') bigMap.zoomBy(1 / 1.35);
      else if (d.mp === 'recenter') { bigMap.recenter(); b.hidden = true; }
      else if (d.mp === 'end') Nav.stop();
      return;
    }
    if (d.poi) { if (Nav.go(World.poi(d.poi))) { stack = ['home']; screen = 'maps'; recents = ['maps', ...recents.filter(x => x !== 'maps')].slice(0, 3); render(); } return; }
    if (d.play) { const [q, i] = d.play.split(':'); Media.playItem(+i, q); push('nowplaying'); return; }
    if (d.dial) return Phone.dial(d.dial);
    if (d.ptab) { sub.phone = d.ptab; return render(); }
    if (d.kp) {
      sub.dial = sub.dial || '';
      if (d.kp === 'del') sub.dial = sub.dial.slice(0, -1);
      else if (d.kp === 'call') { if (sub.dial) Phone.dial(sub.dial); return; }
      else sub.dial += d.kp;
      $('#cpk-num').textContent = sub.dial; return;
    }
    if (d.msg) { sub.msg = +d.msg; return push('msgread'); }
    if (d.reply !== undefined) { const v = $('#cp-voice'); v.hidden = false; $('.cp-vtext', v).textContent = 'Dictating… “On my way!”'; clearTimeout(voiceT); voiceT = setTimeout(() => { hideVoice(); Messages.reply(sub.msg, 'On my way!'); back(); }, 2200); return; }
    if (d.call) { if (Phone[d.call]) Phone[d.call](); return; }
    if (d.ap) { Settings.set('cpAppearance', d.ap); return; }
    if (d.wall !== undefined) { Settings.set('cpWallpaper', +d.wall); return; }
    if (d.focus !== undefined) { sub.focus = !sub.focus; return render(); }
  });
  root.addEventListener('pointerdown', e => {
    const bar = e.target.closest('.cp-bar.seek'); if (!bar) return;
    const r = bar.getBoundingClientRect(); Media.seek((e.clientX - r.left) / r.width);
  });
  /* Long-press the home button for the voice assistant */
  let lp;
  $('#cp-homebtn').addEventListener('pointerdown', () => { lp = setTimeout(() => { lp = 'fired'; showVoice(); }, 600); });
  $('#cp-homebtn').addEventListener('pointerup', e => { if (lp === 'fired') e.stopImmediatePropagation(); clearTimeout(lp); });
  $('#cp-homebtn').addEventListener('click', e => { if (lp === 'fired') { e.stopImmediatePropagation(); lp = null; } }, true);
  $('#cp-voice').addEventListener('click', hideVoice);

  Bus.on('media', t => {
    if (root.hidden) return;
    if (t === 'tick') {
      const c = Media.cur(), s = Media.st;
      const bar = $('.cp-bar i', main); if (bar && c.d) bar.style.width = `${(s.pos / c.d) * 100}%`;
      const p = $('#cpt-pos'), r = $('#cpt-rem'); if (p) { p.textContent = fmtDur(s.pos); r.textContent = '-' + fmtDur(c.d - s.pos); }
      return;
    }
    if (['nowplaying', 'dash', 'music', 'podcasts', 'audiobooks'].includes(screen)) {
      const sc = $('.cp-list', main), top = sc ? sc.scrollTop : 0;
      render();
      const sc2 = $('.cp-list', main); if (sc2) sc2.scrollTop = top;
    }
  });
  let prevScreen = null;
  Bus.on('call', c => {
    if (c && screen !== 'call') { prevScreen = screen; screen = 'call'; render(); }
    else if (!c && screen === 'call') { screen = prevScreen || 'home'; prevScreen = null; render(); }
    else if (screen === 'call') render();
  });
  setInterval(() => { if (screen === 'call' && Phone.call && Phone.call.status === 'active') { const s = $('#cp-cs'); if (s) s.textContent = fmtDur(Phone.elapsed()); } side(); }, 1000);
  Bus.on('navtick', () => { if (!root.hidden && (screen === 'maps' || screen === 'dash')) mapUpd(); });
  Bus.on('nav', () => { if (!root.hidden && (screen === 'maps' || screen === 'dash')) mapUpd(); });
  Bus.on('settings', k => { if (k === 'cpAppearance' || k === 'cpWallpaper' || k === '*') { theme(); if (screen === 'settings') render(); } });
  Bus.on('messages', () => { if (!root.hidden && screen === 'messages') render(); });

  /* Notification banner for new messages */
  let banT;
  Bus.on('messages', () => {
    if (root.hidden || sub.focus) return;
    const m = Messages.list[0]; if (!m.unread) return;
    const b = $('#cp-banner');
    b.innerHTML = `${appIcon('messages', 'xs')}<div><b>${esc(m.from)}</b><small>${esc(m.text)}</small></div>`;
    b.onclick = () => { b.classList.remove('show'); sub.msg = m.id; stack = [screen]; screen = 'msgread'; render(); };
    b.classList.add('show'); clearTimeout(banT); banT = setTimeout(() => b.classList.remove('show'), 4500);
  });

  /* Volume HUD */
  let volT;
  Bus.on('volume', () => {
    if (root.hidden) return;
    const v = $('#cp-vol'), s = Media.st;
    $('span', v).innerHTML = ic(s.muted || !s.vol ? 'mute' : 'vol');
    $('i', v).style.height = `${s.muted ? 0 : (s.vol / 40) * 100}%`;
    v.classList.add('show'); clearTimeout(volT); volT = setTimeout(() => v.classList.remove('show'), 1500);
  });
  Bus.on('toast', msg => {
    if (root.hidden) return;
    const b = $('#cp-banner');
    b.innerHTML = `${appIcon('messages', 'xs')}<div><b>Messages</b><small>${esc(msg)}</small></div>`;
    b.onclick = null; b.classList.add('show'); clearTimeout(banT); banT = setTimeout(() => b.classList.remove('show'), 2500);
  });

  /* ---------- Open / close ---------- */
  function openCP() {
    if (!Settings.get('carplayEnabled')) { Bus.emit('toast', 'CarPlay is turned off — enable it in Settings → Connections'); return; }
    theme();
    $('#nbt').hidden = true;
    root.hidden = false;
    if (Phone.call) { prevScreen = 'home'; screen = 'call'; }
    render();
    if (!connected) {
      const c = $('#cp-connect'); c.hidden = false;
      setTimeout(() => { c.classList.add('out'); setTimeout(() => { c.hidden = true; c.classList.remove('out'); }, 400); connected = true; }, 1500);
    }
  }
  function close() {
    root.hidden = true;
    $('#nbt').hidden = false;
    hideVoice();
    if (screen === 'call') screen = 'home';
    window.dispatchEvent(new Event('resize'));
  }
  theme();
  return { open: openCP, close, back, get active() { return !root.hidden; } };
})();
