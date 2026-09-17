/* =========================================================================
   Sound. The night ambience, the fireworks, the birthday song, the
   projector and the cat's meow are recorded tracks in assets/; every other
   effect is synthesised with the Web Audio API.
   Everything is quiet and starts only after the first tap or click, as
   browsers require.
   ========================================================================= */
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { window.NimmiSound = { play() {}, enabled: false }; return; }

  let ctx = null, master = null, noiseBuf = null, ambience = null, hum = null;
  let fireworksBuf = null, songBuf = null, showEnd = 0;
  let projectorBuf = null, humWanted = false, meowBuf = null;
  let enabled = true;
  try { enabled = localStorage.getItem('nimmi-sound') !== 'off'; } catch (e) {}

  function boot() {
    if (ctx) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    // two seconds of white noise, reused by everything noisy
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startAmbience();
    loadTrack(FIREWORKS_SRC, b => { fireworksBuf = b; });
    loadTrack(SONG_SRC, b => { songBuf = b; });
    loadTrack(PROJECTOR_SRC, b => { projectorBuf = b; if (humWanted) startHum(); });
    loadTrack(MEOW_SRC, b => { meowBuf = b; });
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  const now = () => ctx.currentTime;
  function noise(t0, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.start(t0); s.stop(t0 + dur + 0.05);
    return s;
  }
  function env(node, t0, a, peak, dur, curve) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g);
    return g;
  }
  function tone(type, f0, t0, dur, peak, f1, a = 0.005) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = env(o, t0, a, peak, dur, 'exp');
    o.start(t0); o.stop(t0 + dur + 0.05);
    return g;
  }

  // ---------- the effects ----------
  const fx = {
    // the firecracker show: one recorded run of bangs, started by the first
    // burst, then the birthday song once the bangs have died away. Later
    // bursts in the same show are ignored. Returns how long the greeting
    // should stay in the sky from this burst, so it lasts until the song ends.
    burst(t0 = now()) {
      if (t0 < showEnd) return showEnd - t0;
      if (!fireworksBuf) return;
      const f = ctx.createBufferSource();
      f.buffer = fireworksBuf;
      const fg = ctx.createGain(); fg.gain.value = FIREWORKS_LEVEL;
      f.connect(fg).connect(master);
      f.start(t0);
      showEnd = t0 + fireworksBuf.duration;
      if (songBuf) {
        const songAt = t0 + SONG_AFTER;
        const s = ctx.createBufferSource();
        s.buffer = songBuf;
        const sg = ctx.createGain(); sg.gain.value = SONG_LEVEL;
        s.connect(sg).connect(master);
        s.start(songAt);
        showEnd = songAt + songBuf.duration;
      }
      return showEnd - t0;
    },
    // the projector switch
    click(t0 = now()) {
      const n = noise(t0, 0.03);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      n.connect(hp);
      env(hp, t0, 0.001, 0.35, 0.03, 'exp').connect(master);
      tone('square', 900, t0, 0.02, 0.06, 500).connect(master);
    },
    // the cloth screen unfurling on its rope
    cloth(t0 = now()) {
      const n = noise(t0, 2.6);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(300, t0); lp.frequency.linearRampToValueAtTime(900, t0 + 1.2); lp.frequency.linearRampToValueAtTime(250, t0 + 2.6);
      n.connect(lp);
      env(lp, t0, 0.9, 0.09, 2.6).connect(master);
      // a little rope creak
      const c = noise(t0 + 0.3, 0.7);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 14;
      bp.frequency.setValueAtTime(520, t0 + 0.3); bp.frequency.linearRampToValueAtTime(740, t0 + 1.0);
      c.connect(bp);
      env(bp, t0 + 0.3, 0.2, 0.05, 0.7).connect(master);
    },
    // the gift lid
    lid(t0 = now()) {
      fx.click(t0);
      tone('sine', 520, t0 + 0.02, 0.12, 0.12, 380).connect(master);
    },
    // the reel clacking into the projector
    clack(t0 = now()) {
      fx.click(t0); fx.click(t0 + 0.07);
      tone('triangle', 300, t0 + 0.07, 0.15, 0.1, 200).connect(master);
    },
    // the leader beep
    beep(t0 = now()) {
      tone('sine', 1000, t0, 0.16, 0.14, 1000, 0.01).connect(master);
    },
    // a soft padding footstep
    pad(t0 = now()) {
      const n = noise(t0, 0.06);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      n.connect(lp);
      env(lp, t0, 0.005, 0.07, 0.06, 'exp').connect(master);
    },
    // the cat: a recorded meow, said twice to match "Meow! meow!"
    meow(t0 = now()) {
      if (!meowBuf) return;
      const one = (t, rate, level) => {
        const s = ctx.createBufferSource();
        s.buffer = meowBuf; s.playbackRate.value = rate;
        const g = ctx.createGain(); g.gain.value = level;
        s.connect(g).connect(master);
        s.start(t);
      };
      one(t0, 1, MEOW_LEVEL);
      one(t0 + MEOW_GAP, 1.06, MEOW_LEVEL * 0.85);
    },
    // a single, questioning meow
    mew(t0 = now()) {
      if (!meowBuf) return;
      const s = ctx.createBufferSource();
      s.buffer = meowBuf; s.playbackRate.value = 1.1;
      const g = ctx.createGain(); g.gain.value = MEOW_LEVEL * 0.9;
      s.connect(g).connect(master);
      s.start(t0);
    },
    // the reels rattling in the box
    rattle(t0 = now()) {
      for (let i = 0; i < 7; i++) {
        const t = t0 + i * 0.13 + Math.random() * 0.03;
        tone('triangle', 520 + Math.random() * 200, t, 0.06, 0.05, 300).connect(master);
        fx.click(t);
      }
    },
    // the end of a reel slapping round in the gate
    flap(t0 = now()) {
      for (let i = 0; i < 14; i++) {
        const t = t0 + i * 0.12;
        const n = noise(t, 0.035);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.5;
        n.connect(bp);
        env(bp, t, 0.003, 0.09, 0.035, 'exp').connect(master);
      }
    },
  };

  // ---------- the projector: a recorded motor, running while the lights are down ----------
  // The clip spins up over its first two seconds, runs steadily, then winds
  // down from about nineteen seconds. It plays from the start when the
  // projector is switched on, loops the steady stretch while it stays on, and
  // the wind-down is played when it is switched off. Kept quiet so the films
  // come through over it.
  const PROJECTOR_SRC = 'assets/projector.mp3';
  const PROJECTOR_LEVEL = 0.12;
  const PROJECTOR_LOOP = [2.0, 18.5];
  const PROJECTOR_DOWN = 18.6;
  function projectorSource(t0, offset, loop) {
    const s = ctx.createBufferSource();
    s.buffer = projectorBuf;
    if (loop) { s.loop = true; s.loopStart = PROJECTOR_LOOP[0]; s.loopEnd = PROJECTOR_LOOP[1]; }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(PROJECTOR_LEVEL, t0 + 0.3);
    s.connect(g).connect(master);
    s.start(t0, offset);
    return { s, g };
  }
  function startHum() {
    humWanted = true;
    if (!ctx || hum || !projectorBuf) return;
    hum = projectorSource(now(), 0, true);
  }
  function stopHum() {
    humWanted = false;
    if (!hum) return;
    const { s, g } = hum;
    hum = null;
    const t = now();
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.35);
    s.stop(t + 0.4);
    // the motor winding down
    const tail = projectorSource(t, PROJECTOR_DOWN, false);
    tail.s.stop(t + projectorBuf.duration - PROJECTOR_DOWN);
  }

  // ---------- the cat's meow ----------
  const MEOW_SRC = 'assets/meow.mp3';
  const MEOW_LEVEL = 0.5;
  const MEOW_GAP = 1.05; // seconds between the two meows

  // ---------- fireworks and the birthday song: recorded tracks, decoded once ----------
  const FIREWORKS_SRC = 'assets/fireworks.mp3';
  const FIREWORKS_LEVEL = 0.7;
  const SONG_SRC = 'assets/happy-birthday.mp3';
  const SONG_LEVEL = 0.6;
  const SONG_AFTER = 4.0; // seconds after the first bang, when the crackle has died away
  function loadTrack(src, done) {
    fetch(src)
      .then(r => r.arrayBuffer())
      .then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .then(done)
      .catch(() => {});
  }
  // how long a show lasts from its first burst (used before the burst, to size the show)
  function showLength() {
    if (!fireworksBuf) return 0;
    return songBuf ? SONG_AFTER + songBuf.duration : fireworksBuf.duration;
  }

  // ---------- night ambience: a recorded track, looped and faded in ----------
  const AMBIENCE_SRC = 'assets/night-ambience.mp3';
  const AMBIENCE_LEVEL = 0.4;
  function startAmbience() {
    if (!ctx || ambience) return;
    const el = new Audio(AMBIENCE_SRC);
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    const g = ctx.createGain(); g.gain.value = 0;
    let src;
    try {
      src = ctx.createMediaElementSource(el);
      src.connect(g).connect(master);
    } catch (e) {
      // if the element cannot be routed through the graph, play it directly
      el.volume = AMBIENCE_LEVEL;
    }
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    g.gain.linearRampToValueAtTime(AMBIENCE_LEVEL, now() + 4);
    ambience = { el, stop() { g.gain.linearRampToValueAtTime(0.0001, now() + 0.5); setTimeout(() => el.pause(), 600); } };
  }

  // ---------- public ----------
  function play(name, delay = 0) {
    if (!ctx || !enabled || !fx[name]) return;
    resume();
    return fx[name](now() + delay);
  }
  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem('nimmi-sound', on ? 'on' : 'off'); } catch (e) {}
    if (ctx) { resume(); master.gain.linearRampToValueAtTime(on ? 1 : 0, now() + 0.2); }
    updateButton();
  }
  const btn = document.getElementById('soundToggle');
  function updateButton() {
    if (!btn) return;
    btn.textContent = enabled ? '♪ sound on' : '♪ sound off';
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }
  if (btn) {
    btn.addEventListener('click', e => { e.stopPropagation(); boot(); setEnabled(!enabled); });
    updateButton();
  }
  // browsers only allow audio after a gesture; start on the first one anywhere
  const first = () => { boot(); resume(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, first, { once: true, passive: true }));

  window.NimmiSound = { play, startHum, stopHum, get enabled() { return enabled; }, get ambience() { return ambience && ambience.el; }, get fireworks() { return fireworksBuf; }, get song() { return songBuf; }, get projector() { return projectorBuf; }, get meow() { return meowBuf; }, get hum() { return !!hum; }, showLength };
})();
