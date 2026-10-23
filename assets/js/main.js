/*
 * main.js — boots the system: screen scaling, hardware keys, render loop,
 * global settings (accent, brightness) and desktop conveniences.
 */
'use strict';

(() => {
  const device = $('#device'), screen = $('#screen');
  const params = new URLSearchParams(location.search);

  /* Kiosk mode (no bezel/keys) for running on an actual wide display: ?kiosk or press K */
  const setKiosk = on => { document.body.classList.toggle('kiosk', on); fit(); };

  /* Scale the fixed 1280x480 design to fit any window */
  function fit() {
    const w = device.offsetWidth, h = device.offsetHeight;
    const s = Math.min(innerWidth / w, innerHeight / h) * (document.body.classList.contains('kiosk') ? 1 : 0.96);
    UI.scale = s;
    device.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  addEventListener('resize', fit);

  /* Accent + brightness */
  function applyDisplay() {
    screen.dataset.accent = Settings.get('accent');
    $('#dimmer').style.opacity = ((100 - Settings.get('brightness')) / 100) * 0.85;
    MapView.accent = getComputedStyle(screen).getPropertyValue('--accent').trim() || '#2f7fff';
  }
  Bus.on('settings', k => (k === 'accent' || k === 'brightness' || k === '*') && applyDisplay());
  applyDisplay();

  /* Hardware keys */
  const keys = {
    back: () => (CarPlay.active ? CarPlay.back() : NBT.back()),
    menu: () => { if (CarPlay.active) CarPlay.close(); NBT.go('home'); },
    media: () => { if (CarPlay.active) CarPlay.close(); NBT.go('media'); },
    nav: () => { if (CarPlay.active) CarPlay.close(); NBT.go('nav'); },
    tel: () => { if (CarPlay.active) CarPlay.close(); NBT.go('tel'); },
    volup: () => Media.volUp(), voldown: () => Media.volDown(), mute: () => Media.toggleMute()
  };
  let rep;
  $('#hardkeys').addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-key]'); if (!b) return;
    const k = b.dataset.key; keys[k]();
    if (k === 'volup' || k === 'voldown') { clearInterval(rep); rep = setInterval(keys[k], 140); setTimeout(() => {}, 0); }
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => $('#hardkeys').addEventListener(t, () => clearInterval(rep)));

  addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'Backspace') keys.back();
    else if (e.key === 'k' || e.key === 'K') setKiosk(!document.body.classList.contains('kiosk'));
    else if (e.key === 'ArrowUp' || e.key === '+') keys.volup();
    else if (e.key === 'ArrowDown' || e.key === '-') keys.voldown();
  });

  /* Mouse drag-to-scroll so lists feel like touch on a desktop */
  let drag = null;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    const sc = e.target.closest('.scroll, .cp-list, .cp-grid, .set-pane');
    if (!sc || sc.scrollHeight <= sc.clientHeight) return;
    drag = { sc, y: e.clientY, top: sc.scrollTop, moved: false };
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = (e.clientY - drag.y);
    if (Math.abs(dy) > 5) drag.moved = true;
    if (drag.moved) drag.sc.scrollTop = drag.top - dy / UI.scale;
  });
  document.addEventListener('pointerup', () => { if (drag && drag.moved) { const sc = drag.sc; sc.dataset.dragged = '1'; setTimeout(() => delete sc.dataset.dragged, 0); } drag = null; });
  document.addEventListener('click', e => { const sc = e.target.closest('[data-dragged]'); if (sc) { e.stopPropagation(); e.preventDefault(); } }, true);

  /* Keep fixed containers from being scrolled by focus/scrollIntoView */
  document.addEventListener('scroll', e => {
    const t = e.target;
    if (t.matches && t.matches('#screen, .system, .body, .views, .view, .nav-wrap, .cp-main, .layout, .pane')) { t.scrollLeft = 0; t.scrollTop = 0; }
  }, true);

  /* Render loop: drive simulation + visible maps */
  let last = performance.now(), acc = 0;
  function loop(t) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    Nav.update(dt);
    MapView.all.forEach(m => m.visible() && m.draw());
    acc += dt;
    if (acc > 0.25) { acc = 0; Bus.emit('navtick'); }
    requestAnimationFrame(loop);
  }

  /* Start a demo route so the maps feel alive */
  Nav.go(World.poi('Lansdowne Park'));
  if (params.has('kiosk')) setKiosk(true); else fit();
  if (Settings.get('carplayAuto') || params.get('start') === 'carplay') setTimeout(() => CarPlay.open(), 300);
  if (params.get('start') && params.get('start') !== 'carplay') NBT.go(params.get('start'));
  requestAnimationFrame(loop);
  document.fonts && document.fonts.ready.then(fit);
})();
