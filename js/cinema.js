/* =========================================================================
   The projector, the gift box, the two reel stacks and the cat.
   - Click the projector: a blank white screen rises slowly from behind the
     far hill (click again to lower it).
   - The gift box beside the cat holds the films as a stack of numbered reels.
     The first click unfolds the box, lid and walls, and shows the stack.
   - Click a stack: the cat first carries whatever is in the projector to
     the *other* stack, then takes the top reel from the stack you clicked
     and threads it. The screen counts down and the film starts by itself
     (browsers allow this because she has already clicked; if one refuses,
     the film waits with its play button). Clicking the left stack again is
     "next"; clicking the right stack, where the watched reels pile up, is
     "previous". Nothing is ever lost, so it works forever in both directions.
   - When a film ends (or sits unplayed for a while) the cat walks over and
     nudges the stack that holds the next reel, asking for it.
   ========================================================================= */
(function () {
  'use strict';

  // ---- The films. Add one entry per video message, in the order they should play. ----
  //   id:    the Gumlet video id, the last part of the embed URL
  //          (https://play.gumlet.io/embed/<id>)
  //   ratio: the video's aspect ratio, "16/9" (landscape) or "9/16" (portrait);
  //          it's the aspect-ratio value in the embed code Gumlet gives you
  const VIDEOS = [
    { id: '6aab7fe04b9588fb8c474e33', ratio: '9/16' },
    { id: '6aac4fdcef37684c946c6baa', ratio: '9/16' },
    { id: '6aac7a344b9588fb8c4ffde3', ratio: '16/9' },
    { id: '6aac7adcef37684c946d3c9c', ratio: '9/16' },
    { id: '6aacaa77a98a2e8c6c0f72a5', ratio: '9/16' },
    { id: '6aacab2c4b9588fb8c50ea08', ratio: '239/425' },
    { id: '6aacab2c490dbfc4f4b8910f', ratio: '239/425' },
    { id: '6aacac954b9588fb8c50f17b', ratio: '239/425' },
    { id: '6aacac95490dbfc4f4b89815', ratio: '239/425' },
  { id: '6aacba6ea98a2e8c6c0fdeb9', ratio: '239/425' },
  { id: '6aacba6e4b9588fb8c5154ec', ratio: '16/9' },
  ];

  const sky = document.getElementById('sky');
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
  const stackEls = [document.getElementById('stackA'), document.getElementById('stackB')];
  if (!sky || !cinema || !projector || !gift || !cat || !catwalk || !stackEls[0] || !stackEls[1]) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SEAT = 905, PROJECTOR = 758;               // scene x positions the cat walks between
  const STACK_X = [975, 1009];                     // the two stacks' centres (left: to watch, right: watched)
  const REACH = 38;                                // the walking cat's head is this far ahead of her centre
  const SPEED = reduceMotion ? 900 : 95;           // scene units per second
  const CAT_SCALE = 1.8;                           // the walking pose is drawn small; match the sitting cat
  const IDLE_MS = 60000;                           // a film left unplayed this long gets a nudge
  const REEL_W = 26, REEL_H = 5, GROUND = 867;     // a reel seen edge-on, and the box floor
  let isUp = false, current = -1, busy = false, catX = SEAT, facing = 1;
  let stacks = [[], []];                           // reel numbers (0-based), last element on top
  let held = -1;                                   // the reel out of the box (carried or in the projector)
  let player = null, idleTimer = null, nudged = false, waiting = false;

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

  // ---- small async helpers
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const snd = (name, delay) => { if (window.NimmiSound) window.NimmiSound.play(name, delay); };
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
  // walk so that her head (she always arrives facing right) is over a stack
  const walkToStack = side => walkTo(STACK_X[side] - REACH);
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
  function sitDown() {
    catwalk.classList.remove('is-out'); cat.classList.remove('is-away');
    say(250);                            // once she is settled
  }

  // ---- the two stacks of reels, seen edge-on, numbered on the rim
  const NS = 'http://www.w3.org/2000/svg';
  function resetStacks() {
    stacks = [[], []];
    for (let i = VIDEOS.length - 1; i >= 0; i--) stacks[0].push(i);   // 1 ends up on top
    held = -1;
  }
  function renderStacks() {
    stacks.forEach((stack, side) => {
      const g = stackEls[side];
      g.innerHTML = '';
      const cx = STACK_X[side];
      const el = (tag, attrs, text) => {
        const e = document.createElementNS(NS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        if (text != null) e.textContent = text;
        g.appendChild(e);
      };
      // something to click, even when the stack is empty
      const hitH = Math.max(34, REEL_H * VIDEOS.length + 10);
      el('rect', { class: 'gift__stack-hit', x: cx - REEL_W / 2 - 5, y: GROUND - hitH, width: REEL_W + 10, height: hitH, fill: 'transparent' });
      stack.forEach((n, k) => {
        const y = GROUND - REEL_H * (k + 1);
        el('rect', { class: 'gift__reel', x: cx - REEL_W / 2, y: y + 0.4, width: REEL_W, height: REEL_H - 0.6, rx: 1, fill: '#2a2f3a', stroke: '#8a93a8', 'stroke-width': .7 });
        el('text', { class: 'gift__num', x: cx, y: y + REEL_H - 1.15, 'text-anchor': 'middle', 'font-size': 3.9, 'font-weight': 700, fill: '#e9ecf2' }, String(n + 1));
      });
      g.classList.toggle('is-bare', stack.length === 0);
    });
  }
  // the stack the cat should ask for next: the unwatched pile, or else the other one
  const nextSide = () => stacks[0].length ? 0 : (stacks[1].length ? 1 : -1);

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
      p.on('play', () => { if (player !== p) return; clearIdle(); stage.classList.remove('is-done'); projector.classList.remove('is-done'); });
      p.on('pause', () => { if (player === p && !nudged) armIdle(); });
      p.on('ended', () => { if (player === p) endOfReel(); });
      player = p;
    } catch (e) { player = null; }
  }
  async function endOfReel() {
    if (nudged || current < 0) return;
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
  // the cat asks for the next reel: walks to the stack that has it, nudges it, then waits there
  async function nudge() {
    if (nudged || busy || !isUp || current < 0) return;
    const side = nextSide();
    if (side < 0) return;
    nudged = true;
    clearIdle();
    busy = true;
    gift.classList.add('is-busy');
    standUp();
    await walkToStack(side);
    await wait(250);
    catwalk.classList.add('is-nudging');
    stackEls[side].classList.add('is-rocking');
    snd('rattle', 0.1);
    await wait(1400);
    catwalk.classList.remove('is-nudging');
    stackEls[side].classList.remove('is-rocking');
    snd('mew');
    await wait(600);
    facing = -1; placeCat();            // and looks back at her
    gift.classList.remove('is-empty', 'is-busy');
    waiting = true;
    busy = false;
  }
  // called when the lights go up while the cat is still waiting by the box
  async function comeBack() {
    if (!waiting) return;
    waiting = false;
    busy = true;
    await walkTo(SEAT);
    facing = 1; placeCat();
    catwalk.classList.remove('is-out'); cat.classList.remove('is-away');
    busy = false;
  }

  // ---- threading a film
  function thread(index) {
    current = index;
    const v = VIDEOS[current];
    stage.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.className = 'film';
    frame.dataset.ratio = v.ratio;
    frame.title = 'Video message ' + (current + 1);
    frame.src = `https://play.gumlet.io/embed/${v.id}`;
    frame.setAttribute('referrerpolicy', 'origin');
    frame.setAttribute('allow', 'autoplay; accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen; clipboard-write;');
    stage.appendChild(frame);
    stage.classList.add('is-on');
    fitFilm();
    nudged = false;
    attachPlayer(frame);
    armIdle();
  }
  function unthread() {
    clearIdle();
    player = null;
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

  // ---- the cat's errand: a reel from the stack that was clicked
  async function fetchFrom(side) {
    if (busy || !stacks[side].length) return;
    busy = true;
    waiting = false;
    clearIdle();
    gift.classList.add('is-busy');
    if (!gift.classList.contains('is-unfolded')) {
      // the first click: the box unfolds and shows the stack
      gift.classList.add('is-unfolded'); snd('lid');
      if (!isUp) lightsDown();
      await wait(2600);                 // a beat to take in the reels before she goes for one
    } else if (!isUp) {
      lightsDown();
      await wait(1600);
    }
    standUp();
    if (held >= 0) {
      // the reel in the projector goes onto the other stack first
      await walkTo(PROJECTOR);
      await wait(350);
      unthread(); snd('clack');
      carry.classList.add('is-on');
      await wait(300);
      await walkToStack(1 - side);
      await wait(250);
      carry.classList.remove('is-on'); snd('click');
      stacks[1 - side].push(held); held = -1;
      renderStacks();
      await wait(450);
    }
    // then the top reel from the stack she was sent to
    await walkToStack(side);
    await wait(300);
    held = stacks[side].pop(); renderStacks(); snd('click');
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
    gift.classList.add('is-empty');
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
    if (window.NimmiSound) window.NimmiSound.startHum();
  }
  function lightsUp() {
    if (!isUp || busy) return;
    isUp = false;
    snd('click'); snd('cloth', 0.1);
    if (window.NimmiSound) window.NimmiSound.stopHum();
    cinema.classList.remove('is-up', 'is-live');
    cinema.setAttribute('aria-hidden', 'true');
    projector.classList.remove('is-on');
    beam.classList.remove('is-on');
    clearIdle();
    comeBack();
    setTimeout(() => {
      if (isUp) return;
      unthread(); current = -1;
      resetStacks(); renderStacks();
      gift.classList.remove('is-empty', 'is-unfolded');
    }, 2600);
  }

  projector.addEventListener('click', e => { e.stopPropagation(); isUp ? lightsUp() : lightsDown(); });
  // the sitting cat answers a tap (scene.js also twitches her tail)
  cat.addEventListener('click', e => { e.stopPropagation(); if (!cat.classList.contains('is-away')) say(0, 2600); });
  gift.addEventListener('click', e => {
    e.stopPropagation();
    const stackEl = e.target.closest && e.target.closest('.gift__stack');
    const side = stackEl ? stackEls.indexOf(stackEl) : 0;   // the folded box counts as the first stack
    fetchFrom(side < 0 ? 0 : side);
  });
  cinema.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('keydown', e => { if (isUp && e.key === 'Escape') lightsUp(); });
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
  placeCat();
  resetStacks(); renderStacks();
  layout();
})();
