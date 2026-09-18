/* =========================================================================
   A starry night on the farm.
   - skyCanvas: gradient, moon, a field of twinkling stars, the greeting
     written in stars, shooting stars (click the sky to launch one).
   - the SVG scene: hills, barn, windmill, Nimmi and the cat (static markup),
     plus flowers, grass and fences generated here.
   - fxCanvas: fireflies drifting in front of the hills.
   - the piano truck: after the fireworks it drives in from the right, a lit
     sign pops up, the man plays the birthday song, and it drives off left.
   ========================================================================= */
(function () {
  'use strict';

  const sky = document.getElementById('sky');
  const skyCanvas = document.getElementById('skyCanvas');
  const fxCanvas = document.getElementById('fxCanvas');
  const scene = document.getElementById('scene');
  if (!sky || !skyCanvas || !fxCanvas || !scene) return;

  const ctx = skyCanvas.getContext('2d');
  const fx = fxCanvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- geometry shared with the SVG (viewBox 1600x1000, xMidYMax slice) ----------
  let W = 0, H = 0, dpr = 1, S = 1, OX = 0, OY = 0;
  function sceneToScreen(x, y) { return [OX + x * S, OY + y * S]; }

  // ---------- stars ----------
  let stars = [], shooting = [], bg = null;
  const mouse = { x: -9999, y: -9999 };

  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = Math.ceil(W * dpr); bg.height = Math.ceil(H * dpr);
    const c = bg.getContext('2d');
    c.scale(dpr, dpr);
    const horizon = sceneToScreen(0, 620)[1];
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#000003');
    g.addColorStop(0.5, '#030409');
    g.addColorStop(clamp(horizon / H, 0.5, 0.95), '#0a0c16');
    g.addColorStop(1, '#0d101c');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // a soft band of milky way, diagonal
    c.save();
    c.translate(W * 0.55, H * 0.3);
    c.rotate(-0.5);
    const mw = c.createLinearGradient(0, -H * 0.22, 0, H * 0.22);
    mw.addColorStop(0, 'rgba(200,210,230,0)');
    mw.addColorStop(0.5, 'rgba(200,210,230,0.06)');
    mw.addColorStop(1, 'rgba(200,210,230,0)');
    c.fillStyle = mw;
    c.fillRect(-W, -H * 0.22, W * 2, H * 0.44);
    c.restore();
    // glow near the horizon
    const hg = c.createRadialGradient(W * 0.5, horizon, 10, W * 0.5, horizon, W * 0.7);
    hg.addColorStop(0, 'rgba(140,160,200,0.13)');
    hg.addColorStop(1, 'rgba(140,160,200,0)');
    c.fillStyle = hg;
    c.fillRect(0, 0, W, H);
    // moon
    const [mx, my] = [W * 0.88, H * 0.12];
    const mr = clamp(W * 0.02, 16, 32);
    const halo = c.createRadialGradient(mx, my, mr, mx, my, mr * 7);
    halo.addColorStop(0, 'rgba(230,240,215,0.22)');
    halo.addColorStop(1, 'rgba(230,240,215,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(mx, my, mr * 7, 0, TAU); c.fill();
    c.fillStyle = '#eef3dc'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
    c.fillStyle = '#030409'; c.beginPath(); c.arc(mx - mr * 0.42, my - mr * 0.18, mr * 0.86, 0, TAU); c.fill();
    // repaint the sky behind the bite so it matches the gradient there
    c.save(); c.beginPath(); c.arc(mx - mr * 0.42, my - mr * 0.18, mr * 0.86, 0, TAU); c.clip();
    c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = halo; c.beginPath(); c.arc(mx, my, mr * 7, 0, TAU); c.fill();
    c.restore();
  }

  function buildStars() {
    const r = mulberry32(11);
    stars = [];
    const horizon = sceneToScreen(0, 700)[1];
    const n = Math.round((W * horizon) / 2600);
    for (let i = 0; i < n; i++) {
      const big = r() < 0.06;
      stars.push({
        x: r() * W, y: r() * horizon * (r() < 0.7 ? 1 : 0.55),
        r: big ? 1.4 + r() * 1.2 : 0.5 + r() * 0.9,
        a: 0.35 + r() * 0.6,
        ph: r() * TAU, sp: 0.6 + r() * 1.8,
        warm: r() < 0.25,
      });
    }
  }

  function launchShootingStar(x, y) {
    const r = Math.random();
    shooting.push({
      x: x != null ? x : W * (0.15 + r * 0.7),
      y: y != null ? y : H * (0.05 + Math.random() * 0.25),
      vx: (Math.random() < 0.5 ? -1 : 1) * (380 + Math.random() * 260),
      vy: 140 + Math.random() * 120,
      life: 0, max: 0.9 + Math.random() * 0.5,
    });
  }

  function drawSky(t, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);

    // field of stars
    for (const s of stars) {
      const tw = reduceMotion ? 1 : 0.65 + 0.35 * Math.sin(t * s.sp + s.ph);
      const dx = s.x - mouse.x, dy = s.y - mouse.y;
      const near = 1 - Math.min(1, Math.hypot(dx, dy) / 150);
      const a = clamp(s.a * tw + near * 0.6, 0, 1);
      ctx.fillStyle = s.warm ? `rgba(245,225,170,${a})` : `rgba(225,240,235,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r + near * 0.8, 0, TAU); ctx.fill();
      if (s.r > 1.6) {
        ctx.strokeStyle = `rgba(240,245,235,${a * 0.5})`; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(s.x - s.r * 3, s.y); ctx.lineTo(s.x + s.r * 3, s.y);
        ctx.moveTo(s.x, s.y - s.r * 3); ctx.lineTo(s.x, s.y + s.r * 3); ctx.stroke();
      }
    }

    // shooting stars
    for (let i = shooting.length - 1; i >= 0; i--) {
      const s = shooting[i];
      s.life += dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const p = s.life / s.max;
      if (p >= 1) { shooting.splice(i, 1); continue; }
      const fade = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      const len = 90 + 60 * fade;
      const nx = s.vx / Math.hypot(s.vx, s.vy), ny = s.vy / Math.hypot(s.vx, s.vy);
      const g = ctx.createLinearGradient(s.x, s.y, s.x - nx * len, s.y - ny * len);
      g.addColorStop(0, `rgba(255,250,230,${0.95 * fade})`);
      g.addColorStop(1, 'rgba(255,250,230,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - nx * len, s.y - ny * len); ctx.stroke();
      ctx.fillStyle = `rgba(255,250,230,${fade})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.8, 0, TAU); ctx.fill();
    }
  }

  // ---------- fireflies ----------
  let flies = [];
  function buildFlies() {
    const r = mulberry32(23);
    flies = [];
    const n = Math.round(clamp(W / 55, 12, 34));
    const top = sceneToScreen(0, 640)[1];
    for (let i = 0; i < n; i++) {
      flies.push({
        x: r() * W, y: top + r() * (H - top),
        ph: r() * TAU, sp: 0.5 + r() * 1.2,
        ax: r() * TAU, ay: r() * TAU, r: 1.3 + r() * 1.4,
      });
    }
  }
  function drawFlies(t, dt) {
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.clearRect(0, 0, W, H);
    const top = sceneToScreen(0, 640)[1];
    for (const f of flies) {
      f.ax += dt * 0.35; f.ay += dt * 0.27;
      f.x += Math.cos(f.ax + f.ph) * 14 * dt + Math.sin(t * 0.2 + f.ph) * 6 * dt;
      f.y += Math.sin(f.ay + f.ph) * 10 * dt;
      if (f.x < -10) f.x = W + 10; if (f.x > W + 10) f.x = -10;
      f.y = clamp(f.y, top, H - 4);
      const k = reduceMotion ? 0.7 : Math.max(0, Math.sin(t * f.sp + f.ph));
      const a = k * k * 0.9;
      if (a < 0.02) continue;
      const g = fx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 6);
      g.addColorStop(0, `rgba(222,240,140,${a})`);
      g.addColorStop(0.3, `rgba(222,240,140,${a * 0.35})`);
      g.addColorStop(1, 'rgba(222,240,140,0)');
      fx.fillStyle = g;
      fx.beginPath(); fx.arc(f.x, f.y, f.r * 6, 0, TAU); fx.fill();
    }
  }


  // ---------- fireworks that spell the greeting ----------
  const PALETTE = ['#ffd98a', '#ffb3c6', '#c9b8ff', '#9fe3d0', '#ffe9b0', '#f4a6ff', '#a8d8ff'];
  let rockets = [], sparks = [], showUntil = 0;
  const HOLD = 6; // seconds the greeting stays up when the sound module cannot say

  function greetingPoints() {
    // sample the greeting into points, in one line or two depending on width
    const off = document.createElement('canvas');
    const c = off.getContext('2d');
    const GREETING = ['Happy birthday', 'Princess Arya!'];
    const twoLines = W < 1100;
    const lines = twoLines ? GREETING : [GREETING.join(' ')];
    const font = f => `italic 600 ${f}px "Cormorant Garamond", Georgia, serif`;
    // size the text to fit comfortably across the sky
    c.font = font(100);
    const widest = Math.max(...lines.map(l => c.measureText(l).width));
    const cap = twoLines ? clamp(W * 0.13, 44, 96) : 112;
    const size = clamp(100 * (W * 0.84) / widest, 40, cap);
    c.font = font(size);
    const tw = Math.ceil(Math.max(...lines.map(l => c.measureText(l).width)) + 40);
    const th = Math.ceil(size * 1.2 * lines.length + 20);
    off.width = tw; off.height = th;
    c.font = font(size); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((l, i) => c.fillText(l, tw / 2, size * 0.7 + i * size * 1.15));
    const data = c.getImageData(0, 0, tw, th).data;
    const step = Math.max(3, Math.round(size / 19));
    const r = mulberry32(77);
    const left = (W - tw) / 2, top = H * 0.12;
    const pts = [];
    for (let y = 0; y < th; y += step) for (let x = 0; x < tw; x += step) {
      if (data[(y * tw + x) * 4 + 3] > 110) pts.push({ x: left + x + (r() - 0.5) * step * 0.5, y: top + y + (r() - 0.5) * step * 0.5, line: Math.floor(y / (size * 1.15)) });
    }
    pts.size = size;
    return pts;
  }

  function launchFireworks(fromX, fromY) {
    const now = performance.now() / 1000;
    if (now < showUntil) return;
    const pts = greetingPoints();
    if (!pts.length) return;
    const scale = clamp(pts.size / 100, 0.55, 1);
    // split the points into a handful of rockets, left to right
    const nRockets = W < 760 ? 6 : 8;
    const sorted = pts.slice().sort((a, b) => a.line - b.line || a.x - b.x);
    const per = Math.ceil(sorted.length / nRockets);
    for (let i = 0; i < nRockets; i++) {
      const group = sorted.slice(i * per, (i + 1) * per);
      if (!group.length) continue;
      let cx = 0, cy = 0;
      for (const p of group) { cx += p.x; cy += p.y; }
      cx /= group.length; cy /= group.length;
      rockets.push({
        x: fromX, y: fromY, sx: fromX, sy: fromY, tx: cx, ty: cy,
        t: -0.16 * i - Math.random() * 0.08, dur: 1.05 + Math.random() * 0.25,
        color: PALETTE[i % PALETTE.length], targets: group, done: false, scale,
      });
    }
    // a few plain bursts for company
    for (let i = 0; i < 3; i++) {
      rockets.push({
        x: fromX, y: fromY, sx: fromX, sy: fromY,
        tx: W * (0.1 + Math.random() * 0.8), ty: H * (0.3 + Math.random() * 0.16),
        t: -0.3 - Math.random() * 1.4, dur: 0.9 + Math.random() * 0.3,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)], targets: null, done: false,
      });
    }
    // the greeting fades as the last bang dies away; the truck sets off as it
    // fades, and there is no second show until the truck has gone again
    const hold = (window.NimmiSound && window.NimmiSound.enabled && window.NimmiSound.showLength()) || HOLD;
    showUntil = Infinity;
    setTimeout(parade, (1.4 + hold - 0.8) * 1000);
  }

  function burst(rk) {
    // the sound module says how long the greeting should hold, so it lasts until the song ends
    const hold = (window.NimmiSound && window.NimmiSound.play('burst')) || HOLD;
    const n = rk.targets ? rk.targets.length : (W < 760 ? 34 : 52);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = rk.targets ? 60 + Math.random() * 160 : 40 + Math.random() * 110;
      sparks.push({
        x: rk.tx, y: rk.ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        tx: rk.targets ? rk.targets[i].x : null, ty: rk.targets ? rk.targets[i].y : null,
        age: 0, life: rk.targets ? hold + Math.random() * 0.6 : 1.6 + Math.random() * 0.8,
        color: rk.color, r: rk.targets ? (1.1 + Math.random() * 0.8) * rk.scale : (0.8 + Math.random() * 0.8) * (W < 760 ? 0.7 : 1),
        ph: Math.random() * TAU,
      });
    }
  }

  function drawFireworks(t, dt) {
    for (const rk of rockets) {
      rk.t += dt;
      if (rk.t < 0 || rk.done) continue;
      const p = Math.min(1, rk.t / rk.dur);
      const e = 1 - Math.pow(1 - p, 3);
      // an arc that leans out then rises to the burst point
      rk.x = rk.sx + (rk.tx - rk.sx) * e;
      rk.y = rk.sy + (rk.ty - rk.sy) * e - Math.sin(p * Math.PI) * 30;
      // trail
      const g = fx.createLinearGradient(rk.x, rk.y, rk.x, rk.y + 26 * (1 - p) + 6);
      g.addColorStop(0, 'rgba(255,235,190,0.9)'); g.addColorStop(1, 'rgba(255,235,190,0)');
      fx.strokeStyle = g; fx.lineWidth = 1.6; fx.lineCap = 'round';
      fx.beginPath(); fx.moveTo(rk.x, rk.y); fx.lineTo(rk.x + (Math.random() - 0.5) * 2, rk.y + 26 * (1 - p) + 6); fx.stroke();
      fx.fillStyle = 'rgba(255,245,215,0.95)';
      fx.beginPath(); fx.arc(rk.x, rk.y, 1.8, 0, TAU); fx.fill();
      if (p >= 1) { rk.done = true; burst(rk); }
    }
    rockets = rockets.filter(rk => !rk.done);

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age > s.life) { sparks.splice(i, 1); continue; }
      if (s.tx != null) {
        if (s.age < 0.3) {
          s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.9; s.vy *= 0.9;
        } else if (s.age < s.life - 1.6) {
          // drawn into place, like iron filings
          const k = 14, d = 7.5;
          s.vx += (s.tx - s.x) * k * dt - s.vx * d * dt;
          s.vy += (s.ty - s.y) * k * dt - s.vy * d * dt;
          s.x += s.vx * dt; s.y += s.vy * dt;
        } else {
          s.vy += 26 * dt; s.vx *= 0.995;
          s.x += s.vx * dt + Math.sin(t * 3 + s.ph) * 6 * dt; s.y += s.vy * dt;
        }
      } else {
        s.vy += 70 * dt; s.vx *= 0.985; s.vy *= 0.985;
        s.x += s.vx * dt; s.y += s.vy * dt;
      }
      let a;
      if (s.tx != null) {
        const fadeIn = Math.min(1, s.age / 0.25);
        const fadeOut = clamp((s.life - s.age) / 1.6, 0, 1);
        const tw = 0.92 + 0.08 * Math.sin(t * 6 + s.ph);
        a = fadeIn * fadeOut * tw;
      } else {
        a = clamp(1 - s.age / s.life, 0, 1);
      }
      fx.fillStyle = s.color;
      fx.globalAlpha = a * 0.22;
      fx.beginPath(); fx.arc(s.x, s.y, s.r * 3, 0, TAU); fx.fill();
      fx.globalAlpha = a;
      fx.beginPath(); fx.arc(s.x, s.y, s.r, 0, TAU); fx.fill();
      if (s.tx != null) {
        // a bright white heart to each spark, so the letters read crisply
        fx.fillStyle = '#fffaf0';
        fx.globalAlpha = a * 0.75;
        fx.beginPath(); fx.arc(s.x, s.y, s.r * 0.6, 0, TAU); fx.fill();
      }
    }
    fx.globalAlpha = 1;
  }

  // ---------- SVG flowers, grass, fences ----------
  const NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // ---------- the piano truck ----------
  // It waits off to the right. After the fireworks it drives in along the
  // crest of the farm hill and pulls up short of the launcher; the sign pops
  // up from behind the bed, the bulbs come on, the man plays the birthday
  // song, and when it ends the sign folds and the truck drives off to the left.
  const truck = document.getElementById('truck');
  const TRUCK_STOP = 815, TRUCK_IN = 1900, TRUCK_OUT = -320, AXLE = 55;
  let truckX = TRUCK_IN, drive = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const snd = (name, delay, ...args) => window.NimmiSound && window.NimmiSound.play(name, delay, ...args);
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const easeIn = p => p * p;

  function buildBulbs() {
    const g = document.getElementById('truckBulbs');
    g.innerHTML = '';
    const x0 = -46, x1 = 106, y0 = -124, y1 = -84;
    for (let i = 0; i <= 14; i++) {
      const x = x0 + (x1 - x0) * i / 14;
      g.appendChild(el('circle', { cx: x.toFixed(1), cy: y0, r: 1.7 }));
      g.appendChild(el('circle', { cx: x.toFixed(1), cy: y1, r: 1.7 }));
    }
    for (const y of [-114, -104, -94]) {
      g.appendChild(el('circle', { cx: x0, cy: y, r: 1.7 }));
      g.appendChild(el('circle', { cx: x1, cy: y, r: 1.7 }));
    }
  }

  // set the truck down on the crest at x, tilted to the slope under its wheels
  function placeTruck(x, moving) {
    const crest = document.getElementById('crestB');
    const yr = crestY(crest, x + AXLE), yf = crestY(crest, x - AXLE);
    const ang = Math.atan2(yr - yf, AXLE * 2) * 180 / Math.PI;
    const bob = moving && !reduceMotion ? Math.sin(t * 40) * 0.5 : 0;
    truck.setAttribute('transform', `translate(${x.toFixed(1)} ${((yr + yf) / 2 + bob).toFixed(1)}) rotate(${ang.toFixed(2)})`);
  }

  function driveTo(to, dur, ease) {
    return new Promise(res => {
      drive = { from: truckX, to, dur, t: 0, ease, res };
      truck.classList.add('is-driving');
    });
  }
  function moveTruck(dt) {
    if (!drive) return;
    drive.t += dt;
    const p = Math.min(1, drive.t / drive.dur);
    truckX = drive.from + (drive.to - drive.from) * drive.ease(p);
    placeTruck(truckX, p < 1);
    if (p >= 1) { const d = drive; drive = null; truck.classList.remove('is-driving'); d.res(); }
  }

  async function parade() {
    const inDur = reduceMotion ? 0.05 : 5.5, outDur = reduceMotion ? 0.05 : 5;
    snd('engine', 0, inDur, 76, 42);
    await driveTo(TRUCK_STOP, inDur, easeOut);
    snd('horn', 0.3);
    await wait(1000);
    truck.classList.add('is-up'); snd('pop');
    await wait(850);
    truck.classList.add('is-lit'); snd('lights');
    await wait(800);
    const len = snd('song') || (window.NimmiSound ? window.NimmiSound.songLength() : 21);
    truck.classList.add('is-playing');
    await wait(len * 1000 + 400);
    truck.classList.remove('is-playing');
    await wait(500);
    truck.classList.remove('is-lit');
    await wait(450);
    truck.classList.remove('is-up'); snd('pop', 0, true);
    await wait(1000);
    snd('engine', 0, outDur, 42, 80);
    await driveTo(TRUCK_OUT, outDur, easeIn);
    truckX = TRUCK_IN;
    placeTruck(truckX, false);
    showUntil = 0;
  }
  const PETALS = ['#b98a94', '#8f86b3', '#c9c08a', '#7f9bb0', '#c7cdc0', '#b7809a', '#a8b58c'];
  const CENTERS = ['#d9c37a', '#e1d3a0', '#c9a36b'];

  function crestY(pathEl, x) {
    // sample the crest path for the y at a given x (paths run left to right)
    const L = pathEl.getTotalLength();
    let lo = 0, hi = L;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (pathEl.getPointAtLength(mid).x < x) lo = mid; else hi = mid;
    }
    return pathEl.getPointAtLength((lo + hi) / 2).y;
  }

  function makeFlower(r, x, y, s, dim) {
    const g = el('g', { class: 'flower', style: `--dur:${(3.2 + r() * 3).toFixed(2)}s;--delay:${(-r() * 6).toFixed(2)}s` });
    const h = (26 + r() * 30) * s;
    const lean = (r() - 0.5) * 10 * s;
    g.appendChild(el('path', { d: `M${x} ${y} Q${x + lean} ${y - h * 0.55} ${x + lean * 1.4} ${y - h}`, fill: 'none', stroke: '#0b1c15', 'stroke-width': (1.2 * s).toFixed(2) }));
    // a leaf
    g.appendChild(el('path', { d: `M${x + lean * 0.4} ${y - h * 0.4} q${6 * s} ${-3 * s} ${9 * s} ${-9 * s} q${-8 * s} ${1 * s} ${-9 * s} ${9 * s} z`, fill: '#0b1c15' }));
    const hx = x + lean * 1.4, hy = y - h;
    const col = PETALS[Math.floor(r() * PETALS.length)];
    const op = dim ? 0.5 : 0.78;
    const type = r();
    if (type < 0.45) {
      // daisy
      const n = 5 + Math.floor(r() * 2), pr = (3.2 + r() * 1.6) * s;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 360;
        g.appendChild(el('ellipse', { cx: hx, cy: hy - pr * 1.1, rx: pr * 0.55, ry: pr * 1.1, fill: col, opacity: op, transform: `rotate(${a} ${hx} ${hy})` }));
      }
      g.appendChild(el('circle', { cx: hx, cy: hy, r: pr * 0.55, fill: CENTERS[Math.floor(r() * CENTERS.length)], opacity: op + 0.1 }));
    } else if (type < 0.75) {
      // tulip / bell
      const pw = (4 + r() * 2) * s, ph = (6 + r() * 3) * s;
      g.appendChild(el('path', { d: `M${hx - pw} ${hy} q${pw * 0.2} ${-ph * 1.3} ${pw} ${-ph} q${pw * 0.8} ${-ph * 0.3} ${pw} ${ph} q${-pw * 0.5} ${ph * 0.5} ${-pw} ${ph * 0.55} q${-pw * 0.5} ${0} ${-pw} ${-ph * 0.55} z`, fill: col, opacity: op }));
    } else {
      // lavender spike
      for (let i = 0; i < 5; i++) {
        const k = i / 4;
        g.appendChild(el('ellipse', { cx: hx + (r() - 0.5) * 2 * s, cy: hy + (k * 10 - 4) * s, rx: (2.6 - k * 0.8) * s, ry: (2 - k * 0.5) * s, fill: col, opacity: op }));
      }
    }
    return g;
  }

  function buildFlora() {
    const r = mulberry32(41);
    const crestD = document.getElementById('crestD');
    const crestC = document.getElementById('crestC');
    const fd = document.getElementById('flowersD');
    const fc = document.getElementById('flowersC');
    const gd = document.getElementById('grassD');
    fd.innerHTML = ''; fc.innerHTML = ''; gd.innerHTML = '';
    // near hill: flowers everywhere except right around the two of them
    let placed = 0, tries = 0;
    while (placed < 64 && tries < 400) {
      tries++;
      const x = 20 + r() * 1560;
      const base = crestY(crestD, x);
      const y = base + 6 + r() * r() * 130;
      if (x > 690 && x < 990 && y < base + 60) continue;
      if (x > 940 && x < 1045 && y < base + 80) continue;   // keep the reels' labels clear
      const s = 0.75 + (y - base) / 130 * 0.9;
      fd.appendChild(makeFlower(r, x, y, s, false));
      placed++;
    }
    // grass blades on the near crest
    for (let i = 0; i < 160; i++) {
      const x = r() * 1600;
      const base = crestY(crestD, x) + r() * 60;
      if (x > 720 && x < 1040 && base < crestY(crestD, x) + 24) continue;
      const h = 8 + r() * 16, lean = (r() - 0.5) * 8;
      gd.appendChild(el('path', { class: 'blade', style: `--dur:${(2.5 + r() * 2.5).toFixed(2)}s;--delay:${(-r() * 5).toFixed(2)}s`, d: `M${x} ${base} q${lean * 0.3} ${-h * 0.5} ${lean} ${-h}`, fill: 'none', stroke: '#0b1c16', 'stroke-width': 1.3, 'stroke-linecap': 'round' }));
    }
    // a scattering on the hay hill, smaller and dimmer
    for (let i = 0; i < 26; i++) {
      const x = 20 + r() * 1560;
      const base = crestY(crestC, x);
      fc.appendChild(makeFlower(r, x, base + 4 + r() * 30, 0.55, true));
    }
    // fences
    for (const [id, target, x0, x1, gap] of [['crestB', 'fenceB', 690, 1010, 34], ['crestC', 'fenceC', 1090, 1560, 40]]) {
      const crest = document.getElementById(id), grp = document.getElementById(target);
      grp.innerHTML = '';
      let prev = null;
      for (let x = x0; x <= x1; x += gap) {
        const y = crestY(crest, x);
        const h = id === 'crestB' ? 13 : 16;
        grp.appendChild(el('line', { x1: x, y1: y + 2, x2: x, y2: y - h, stroke: '#3a2414', 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
        if (prev) {
          grp.appendChild(el('line', { x1: prev[0], y1: prev[1] - h * 0.75, x2: x, y2: y - h * 0.75, stroke: '#3a2414', 'stroke-width': 1.4 }));
          grp.appendChild(el('line', { x1: prev[0], y1: prev[1] - h * 0.3, x2: x, y2: y - h * 0.3, stroke: '#3a2414', 'stroke-width': 1.4 }));
        }
        prev = [x, y];
      }
    }
  }

  // ---------- sizing ----------
  function resize() {
    W = sky.clientWidth; H = sky.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [skyCanvas, fxCanvas]) { c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr); }
    S = Math.max(W / 1600, H / 1000);
    OX = (W - 1600 * S) / 2;
    OY = H - 1000 * S;
    buildBackground();
    buildStars();
    buildFlies();
  }
  let resizeTimer = null;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });

  // ---------- input ----------
  sky.addEventListener('pointermove', e => {
    const r = sky.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  sky.addEventListener('pointerleave', () => { mouse.x = -9999; mouse.y = -9999; });
  sky.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('a, nav, header')) return;
    const r = sky.getBoundingClientRect();
    const y = e.clientY - r.top;
    if (y < sceneToScreen(0, 640)[1]) launchShootingStar(e.clientX - r.left, y);
    else launchShootingStar();
  });
  const nimmi = document.getElementById('nimmi');
  const cat = document.getElementById('cat');
  let breezeTimer = null;
  function breeze() {
    nimmi.classList.add('is-breezy'); cat.classList.add('is-breezy');
    clearTimeout(breezeTimer);
    breezeTimer = setTimeout(() => { nimmi.classList.remove('is-breezy'); cat.classList.remove('is-breezy'); }, 2200);
  }
  const launcher = document.getElementById('launcher');
  launcher.addEventListener('click', e => {
    e.stopPropagation();
    launcher.classList.add('is-lit');
    const [lx, ly] = sceneToScreen(688, 690);
    launchFireworks(lx, ly);
  });
  nimmi.addEventListener('pointerenter', breeze);
  cat.addEventListener('pointerenter', breeze);
  cat.addEventListener('click', e => { e.stopPropagation(); breeze(); });
  nimmi.addEventListener('click', e => { e.stopPropagation(); breeze(); launchShootingStar(); });

  // ---------- loop ----------
  let last = performance.now(), t = 0, nextShot = 4;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    if (!reduceMotion && t > nextShot) { launchShootingStar(); nextShot = t + 7 + Math.random() * 9; }
    drawSky(t, dt);
    drawFlies(t, dt);
    drawFireworks(t, dt);
    moveTruck(dt);
    requestAnimationFrame(frame);
  }

  buildFlora();
  buildBulbs();
  placeTruck(truckX, false);
  resize();
  requestAnimationFrame(frame);
})();
