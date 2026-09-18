/* =========================================================================
   The projector, the gift box, the stack of reels and the cat.
   - Click the projector: a blank white screen rises slowly from behind the
     far hill (click again to lower it).
   - The gift box beside the cat holds the messages as a stack of reels, each
     with a handwritten paper label. Clicking the gift unfolds the box (lid
     and walls) and the camera zooms in on the stack so the labels can be read.
   - Click a reel: the camera zooms back out, the cat takes that reel from the
     stack and threads it. The screen counts down and the film starts by
     itself (browsers allow this because she has already clicked; if one
     refuses, the film waits with its play button).
   - Click the gift again: the cat first brings the reel in the projector back
     to its place in the stack, then the camera zooms in on the full stack.
   - When a film ends (or sits unplayed for a while) the cat walks over and
     nudges the stack, asking for the next one.
   ========================================================================= */
(function () {
  'use strict';

  // ---- The messages, top of the stack first. ----
  //   id:    the Gumlet video id, the last part of the embed URL
  //          (https://play.gumlet.io/embed/<id>)
  //   photo: instead of an id, a picture in assets/ (shown for a while, then it ends)
  //   ratio: the aspect ratio, "16/9" (landscape) or "9/16" (portrait);
  //          it's the aspect-ratio value in the embed code Gumlet gives you
  //   label: the name written on the reel's paper label ("\n" starts a second line)
  const VIDEOS = [
    { id: '6aacac95490dbfc4f4b89815', ratio: '239/425', label: 'Mummy' },
    { id: '6aacac954b9588fb8c50f17b', ratio: '239/425', label: 'Papa' },
    { id: '6aacc439a373d0cf89f5cf6a', ratio: '16/9', label: 'Saloni' },
    { id: '6aab7fe04b9588fb8c474e33', ratio: '9/16', label: 'Aditi' },
    { id: '6aacaa77a98a2e8c6c0f72a5', ratio: '9/16', label: 'Aditya' },
    { id: '6aacab2c490dbfc4f4b8910f', ratio: '239/425', label: 'Nidhi' },
    { id: '6aacba6ea98a2e8c6c0fdeb9', ratio: '239/425', label: 'Neha' },
    { id: '6aac4fdcef37684c946c6baa', ratio: '9/16', label: 'Shreya' },
    { id: '6aac7a344b9588fb8c4ffde3', ratio: '16/9', label: 'Advait, Supriya aunty\n& Bharatheeyan uncle' },
    { id: '6aacba6e4b9588fb8c5154ec', ratio: '16/9', label: 'Keru uncle' },
    { id: '6aacc42d63818d09ef4a6634', ratio: '9/16', label: 'Devi aunty' },
    { id: '6aac7adcef37684c946d3c9c', ratio: '9/16', label: 'Sahana & Ganesh' },
    { id: '6aacab2c4b9588fb8c50ea08', ratio: '239/425', label: 'Mukul & Nidhi' },
  ];

  const sky = document.getElementById('sky');
  const world = document.getElementById('world');
  const cinema = document.getElementById('cinema');
  const stage = document.getElementById('cinemaStage');
  const leader = document.getElementById('cinemaLeader');
  const count = document.getElementById('cinemaCount');
  const projector = document.getElementById('projector');
  const gift = document.getElementById('gift');
  const cat = document.getElementById('cat');
  const catwalk = document.getElementById('catwalk');
  const carry = document.getElementById('carry');
  const beam = document.getElementById('beam');
  const meow = document.getElementById('meow');
  const stackEl = document.getElementById('stack');
  if (!sky || !world || !cinema || !projector || !gift || !cat || !catwalk || !stackEl) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SEAT = 905, PROJECTOR = 758;               // scene x positions the cat walks between
  const STACK_X = 992;                             // the stack's centre
  const REACH = 38;                                // the walking cat's head is this far ahead of her centre
  const SPEED = reduceMotion ? 900 : 95;           // scene units per second
  const CAT_SCALE = 1.8;                           // the walking pose is drawn small; match the sitting cat
  const IDLE_MS = 60000;                           // a film left unplayed this long gets a nudge
  const REEL_W = 36, REEL_H = 7, GROUND = 867;     // a reel seen edge-on, and the box floor
  const ZOOM_MS = reduceMotion ? 50 : 1150;        // the camera's travel time (matches the CSS)
  const PHOTO_MS = 15000;                          // how long a photo stays on the screen
  let isUp = false, current = -1, busy = false, catX = SEAT, facing = 1;
  let held = -1;                                   // the reel out of the box (carried or in the projector)
  let zoomed = false;
  let player = null, idleTimer = null, nudged = false, waiting = false, photoTimer = null;
  let settle = Promise.resolve();                  // the cat's walk back to her seat, if she is on it

  // ---- geometry: same mapping as the SVG scene (viewBox 1600x1000, xMidYMax slice)
  function mapping() {
    const W = sky.clientWidth, H = sky.clientHeight;
    const S = Math.max(W / 1600, H / 1000);
    return { W, H, S, OX: (W - 1600 * S) / 2, OY: H - 1000 * S };
  }
  function layout() {
    const m = mapping();
    const top = Math.round(m.H * 0.12 + 14);
    const bottom = Math.round(m.OY + 705 * m.S);
    cinema.style.top = top + 'px';
    cinema.style.height = Math.max(120, bottom - top) + 'px';
    stage.style.paddingBottom = Math.max(0, Math.round(bottom - (m.OY + 628 * m.S))) + 'px';
    const r = cinema.getBoundingClientRect(), s = sky.getBoundingClientRect();
    const toScene = (x, y) => [((x - s.left) - m.OX) / m.S, ((y - s.top) - m.OY) / m.S];
    const [lx, ly] = toScene(r.left + 6, r.top + 6);
    const [rx, ry] = toScene(r.right - 6, r.top + 6);
    beam.setAttribute('points', `722,840 ${lx.toFixed(1)},${ly.toFixed(1)} ${rx.toFixed(1)},${ry.toFixed(1)}`);
    fitFilm();
    if (zoomed) zoomIn();
  }
  function fitFilm() {
    const frame = stage.querySelector('.film');
    if (!frame) return;
    const [aw, ah] = frame.dataset.ratio.split('/').map(Number);
    const hidden = parseFloat(stage.style.paddingBottom) || 0;
    const bw = stage.clientWidth - 24, bh = stage.clientHeight - hidden - 24;
    let w = bw, h = bw * ah / aw;
    if (h > bh) { h = bh; w = bh * aw / ah; }
    frame.style.width = Math.round(w) + 'px';
    frame.style.height = Math.round(h) + 'px';
  }

  // ---- the camera: the whole world zooms in on the stack, and back out
  function zoomIn() {
    const m = mapping();
    const h = REEL_H * VIDEOS.length + 8, w = REEL_W + 8;
    const cx = m.OX + STACK_X * m.S, cy = m.OY + (GROUND + 2 - h / 2) * m.S;
    const k = Math.max(2, Math.min(m.H * 0.82 / (h * m.S), m.W * 0.9 / (w * m.S)));
    world.style.transformOrigin = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
    world.style.transform = `translate(${(m.W / 2 - cx).toFixed(1)}px, ${(m.H / 2 - cy).toFixed(1)}px) scale(${k.toFixed(3)})`;
    sky.classList.add('is-zoomed');
    zoomed = true;
  }
  function zoomOut() {
    if (!zoomed) return;
    world.style.transform = 'none';
    sky.classList.remove('is-zoomed');
    zoomed = false;
  }

  // ---- small async helpers
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const snd = (name, delay) => { if (window.NimmiSound) window.NimmiSound.play(name, delay); };
  // the projector's motor runs only while a film is running
  const humOn = () => { if (window.NimmiSound) window.NimmiSound.startHum(); };
  const humOff = () => { if (window.NimmiSound) window.NimmiSound.stopHum(); };
  function placeCat() { catwalk.setAttribute('transform', `translate(${catX.toFixed(1)} 866) scale(${facing * CAT_SCALE} ${CAT_SCALE})`); }
  function walkTo(x) {
    return new Promise(resolve => {
      facing = x < catX ? -1 : 1;
      catwalk.classList.add('is-walking');
      let last = performance.now(), stepAt = 0;
      const step = now => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (now > stepAt) { snd('pad'); stepAt = now + 380; }
        const dir = Math.sign(x - catX);
        catX += dir * SPEED * dt;
        if ((dir > 0 && catX >= x) || (dir < 0 && catX <= x)) { catX = x; placeCat(); catwalk.classList.remove('is-walking'); resolve(); return; }
        placeCat();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  // walk so that her head (she always arrives facing right) is over the stack
  const walkToStack = () => walkTo(STACK_X - REACH);
  function standUp() { placeCat(); cat.classList.add('is-away'); catwalk.classList.add('is-out'); }
  // a word from the cat: the sound, and the caption above her ears
  let meowTimer = null, captionTimer = null;
  function say(delay = 0, hold = 4800) {
    clearTimeout(meowTimer); clearTimeout(captionTimer);
    snd('meow', delay / 1000);
    meow.classList.remove('is-on');
    captionTimer = setTimeout(() => meow.classList.add('is-on'), delay + 30);
    meowTimer = setTimeout(() => meow.classList.remove('is-on'), delay + hold);
  }
  function sitDown(quietly) {
    catwalk.classList.remove('is-out'); cat.classList.remove('is-away');
    if (!quietly) say(250);              // once she is settled
  }
  // she goes back to her seat on her own, and sits without a word
  function goHome() {
    settle = walkTo(SEAT).then(() => { facing = 1; placeCat(); sitDown(true); });
    return settle;
  }

  // ---- the stack of reels, seen edge-on, each with a paper label written by hand
  const NS = 'http://www.w3.org/2000/svg';
  let reels = [];
  function buildStack() {
    stackEl.innerHTML = '';
    reels = [];
    const el = (parent, tag, attrs, text) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (text != null) e.textContent = text;
      parent.appendChild(e);
      return e;
    };
    const cx = STACK_X, h = REEL_H * VIDEOS.length + 10;
    el(stackEl, 'rect', { class: 'gift__stack-hit', x: cx - REEL_W / 2 - 4, y: GROUND - h, width: REEL_W + 8, height: h, fill: 'transparent' });
    VIDEOS.forEach((v, i) => {
      const g = el(stackEl, 'g', { class: 'gift__reel', 'data-index': i });
      // the reel's rim: a dark can with a bright edge and a couple of rivets
      el(g, 'rect', { class: 'gift__can', x: cx - REEL_W / 2, y: -REEL_H + 0.35, width: REEL_W, height: REEL_H - 0.6, rx: 1.2, fill: '#2a2f3a', stroke: '#7d8699', 'stroke-width': .5 });
      el(g, 'rect', { x: cx - REEL_W / 2 + 1.5, y: -REEL_H + 0.9, width: REEL_W - 3, height: .55, rx: .3, fill: '#8a93a8', opacity: .55 });
      el(g, 'circle', { cx: cx - REEL_W / 2 + 2.4, cy: -REEL_H / 2 + 0.2, r: .55, fill: '#6b7386' });
      el(g, 'circle', { cx: cx + REEL_W / 2 - 2.4, cy: -REEL_H / 2 + 0.2, r: .55, fill: '#6b7386' });
      // the paper label, stuck on a little crooked, written in blue ballpoint
      const tilt = ((i * 7) % 5 - 2) * 0.7;
      const label = el(g, 'g', { transform: `rotate(${tilt} ${cx} ${-REEL_H / 2 + 0.3})` });
      el(label, 'rect', { class: 'gift__paper', x: cx - 15, y: -REEL_H + 1.35, width: 30, height: REEL_H - 2.6, rx: .45, fill: '#efe6cf', stroke: '#c9bb95', 'stroke-width': .2 });
      const lines = v.label.split('\n');
      const t = el(label, 'text', { class: 'gift__label', x: cx, 'text-anchor': 'middle', fill: '#2447a6', stroke: '#2447a6', 'stroke-width': .1 });
      if (lines.length === 1) {
        t.setAttribute('y', -REEL_H / 2 + 1.55); t.setAttribute('font-size', 3.6);
        t.textContent = lines[0];
      } else {
        t.setAttribute('font-size', 2.35);
        el(t, 'tspan', { x: cx, y: -REEL_H / 2 - 0.25 }, lines[0]);
        el(t, 'tspan', { x: cx, y: -REEL_H / 2 + 2.1 }, lines[1]);
      }
      // zoomed in, a reel is a choice; zoomed out, the stack is just the gift
      g.addEventListener('click', e => { e.stopPropagation(); zoomed ? pick(i) : openGift(); });
      reels.push(g);
    });
    layoutStack();
  }
  // the reels sit in their order with the one that is out of the box missing; the rest settle down
  function layoutStack() {
    const list = VIDEOS.map((_, i) => i).filter(i => i !== held);
    reels.forEach((g, i) => {
      const pos = list.indexOf(i);
      g.classList.toggle('is-out', pos < 0);
      if (pos >= 0) g.style.transform = `translate(0px, ${GROUND - REEL_H * (list.length - 1 - pos)}px)`;
    });
  }

  // ---- listening to the film, through Gumlet's player bridge
  function clearIdle() { clearTimeout(idleTimer); idleTimer = null; }
  function armIdle() { clearIdle(); idleTimer = setTimeout(nudge, IDLE_MS); }
  function attachPlayer(frame) {
    player = null;
    if (!window.playerjs || !window.playerjs.Player) return;
    try {
      const p = new window.playerjs.Player(frame);
      // start the film once the player is ready; if the browser refuses, the play button stays
      p.on('ready', () => { if (player === p) { try { p.play(); } catch (e) {} } });
      p.on('play', () => {
        if (player !== p) return;
        clearIdle(); humOn(); stage.classList.remove('is-done'); projector.classList.remove('is-done');
        // the player says "play" as soon as it is asked; if the browser then refused
        // to start the film (no tap yet), the motor should not run over a still picture
        setTimeout(() => { if (player === p) { try { p.getPaused(v => { if (player === p && v) humOff(); }); } catch (e) {} } }, 1200);
      });
      p.on('pause', () => { if (player !== p) return; humOff(); if (!nudged) armIdle(); });
      p.on('ended', () => { if (player === p) { humOff(); endOfReel(); } });
      player = p;
    } catch (e) { player = null; }
  }
  async function endOfReel() {
    if (nudged || current < 0) return;
    humOff();
    // the tail of the reel slaps round in the gate and the picture goes dim
    leader.classList.add('is-end', 'is-on');
    count.textContent = 'END';
    snd('flap');
    stage.classList.add('is-done');
    projector.classList.add('is-done');
    await wait(1700);
    leader.classList.remove('is-on', 'is-end');
    count.textContent = '3';
    nudge();
  }
  // the cat asks for the next reel: walks to the stack, nudges it, then waits there
  async function nudge() {
    if (nudged || busy || !isUp || current < 0) return;
    nudged = true;
    clearIdle();
    busy = true;
    gift.classList.add('is-busy');
    await settle;
    standUp();
    await walkToStack();
    await wait(250);
    catwalk.classList.add('is-nudging');
    stackEl.classList.add('is-rocking');
    snd('rattle', 0.1);
    await wait(1400);
    catwalk.classList.remove('is-nudging');
    stackEl.classList.remove('is-rocking');
    snd('mew');
    await wait(600);
    facing = -1; placeCat();            // and looks back at her
    gift.classList.remove('is-busy');
    waiting = true;
    busy = false;
  }
  // called when the lights go up while the cat is still waiting by the box
  async function comeBack() {
    if (!waiting) return;
    waiting = false;
    busy = true;
    await goHome();
    busy = false;
  }

  // ---- threading a film
  function thread(index) {
    current = index;
    const v = VIDEOS[current];
    stage.innerHTML = '';
    nudged = false;
    if (v.photo) {
      // a photo message: a still on the screen for a while, then the end of the reel
      const pic = document.createElement('img');
      pic.className = 'film film--photo';
      pic.dataset.ratio = v.ratio;
      pic.alt = 'Photo message from ' + v.label;
      pic.src = v.photo;
      stage.appendChild(pic);
      stage.classList.add('is-on');
      fitFilm();
      humOn();
      clearTimeout(photoTimer);
      photoTimer = setTimeout(endOfReel, PHOTO_MS);
      return;
    }
    const frame = document.createElement('iframe');
    frame.className = 'film';
    frame.dataset.ratio = v.ratio;
    frame.title = 'Video message from ' + v.label;
    frame.src = `https://play.gumlet.io/embed/${v.id}`;
    frame.setAttribute('referrerpolicy', 'origin');
    frame.setAttribute('allow', 'autoplay; accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen; clipboard-write;');
    stage.appendChild(frame);
    stage.classList.add('is-on');
    fitFilm();
    attachPlayer(frame);
    // the motor runs while the film does: it starts on the player's play event
    // and stops on pause; without the bridge it simply runs while the reel is in
    if (!player) humOn();
    armIdle();
  }
  function unthread() {
    clearIdle();
    clearTimeout(photoTimer); photoTimer = null;
    player = null;
    humOff();
    stage.classList.remove('is-on', 'is-done');
    projector.classList.remove('has-reel', 'is-done');
    leader.classList.remove('is-on', 'is-end');
    count.textContent = '3';
    stage.innerHTML = '';
  }
  async function countdown() {
    if (reduceMotion) return;
    leader.classList.add('is-on');
    for (let n = 3; n > 0; n--) { count.textContent = n; snd('beep'); await wait(520); }
    leader.classList.remove('is-on');
  }

  // ---- the cat's errands
  // the reel in the projector goes back to its place in the stack
  async function returnReel() {
    if (held < 0) return;
    waiting = false;
    clearIdle();
    await settle;
    standUp();
    await walkTo(PROJECTOR);
    await wait(350);
    unthread(); current = -1; snd('clack');
    carry.classList.add('is-on');
    await wait(300);
    await walkToStack();
    await wait(250);
    carry.classList.remove('is-on'); snd('click');
    held = -1;
    layoutStack();
    await wait(500);
  }
  // the reel that was picked comes out of the stack and into the projector
  async function fetchReel(index) {
    waiting = false;
    clearIdle();
    await settle;
    if (!isUp) { lightsDown(); await wait(1600); }
    standUp();
    await walkToStack();
    await wait(300);
    held = index; layoutStack(); snd('click');
    carry.classList.add('is-on');
    await wait(400);
    await walkTo(PROJECTOR);
    await wait(300);
    carry.classList.remove('is-on');
    projector.classList.add('has-reel'); snd('clack');
    await wait(300);
    await walkTo(SEAT);
    facing = 1; placeCat();
    sitDown();
    await countdown();
    thread(held);
  }

  // the gift: the box unfolds, whatever is in the projector comes back, and the camera moves in
  async function openGift() {
    if (busy || zoomed) return;
    busy = true;
    gift.classList.add('is-busy');
    if (!gift.classList.contains('is-unfolded')) {
      gift.classList.add('is-unfolded'); snd('lid');
      await wait(1300);
    }
    if (held >= 0) {
      await returnReel();
      goHome();                          // she wanders back while the camera moves in
    }
    zoomIn();
    gift.classList.remove('is-busy');
    busy = false;
  }
  // a reel was picked from the zoomed-in stack
  async function pick(index) {
    if (!zoomed || busy) return;
    busy = true;
    gift.classList.add('is-busy');
    zoomOut();
    await wait(ZOOM_MS * 0.8);
    await fetchReel(index);
    gift.classList.remove('is-busy');
    busy = false;
  }

  // ---- lights down, lights up
  function lightsDown() {
    if (isUp) return;
    isUp = true;
    layout();
    snd('click'); snd('cloth', 0.15);
    cinema.classList.add('is-up', 'is-live');
    cinema.setAttribute('aria-hidden', 'false');
    projector.classList.add('is-on');
    beam.classList.add('is-on');
  }
  function lightsUp() {
    if (!isUp || busy) return;
    isUp = false;
    snd('click'); snd('cloth', 0.1);
    humOff();
    cinema.classList.remove('is-up', 'is-live');
    cinema.setAttribute('aria-hidden', 'true');
    projector.classList.remove('is-on');
    beam.classList.remove('is-on');
    clearIdle();
    comeBack();
    setTimeout(() => {
      if (isUp) return;
      unthread(); current = -1;
      held = -1; layoutStack();
      gift.classList.remove('is-unfolded');
    }, 2600);
  }

  projector.addEventListener('click', e => { e.stopPropagation(); isUp ? lightsUp() : lightsDown(); });
  // the sitting cat answers a tap (scene.js also twitches her tail)
  cat.addEventListener('click', e => { e.stopPropagation(); if (!cat.classList.contains('is-away')) say(0, 2600); });
  gift.addEventListener('click', e => { e.stopPropagation(); openGift(); });
  // while the camera is in on the stack, a click anywhere else just backs out again
  sky.addEventListener('click', e => {
    if (!zoomed || (e.target.closest && e.target.closest('.gift__reel, a, button'))) return;
    e.stopPropagation();
    if (!busy) zoomOut();
  }, true);
  cinema.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (zoomed) { if (!busy) zoomOut(); } else if (isUp) lightsUp();
  });
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
  placeCat();
  buildStack();
  layout();
})();
