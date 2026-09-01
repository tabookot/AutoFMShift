// scorch.js — modern Scorched Earth successor; experimental branch of game.js
// LANDSCAPE IS THE GAME: shot → impact → crater → debris → settle → consequence.
(() => {
  const LS_KEY = 'scorch_records';
  const MAX_REC = 10;
  const ROUNDS_MAX = 5;
  const GRAV = 195;
  const VMAX = 650;
  const WINDF = 30;
  const TANK_HP = 100;
  const NCOL = () => Math.max(300, Math.round(Wc / 1.5));

  const ARSENAL = [
    { key: 'MISSILE',  name: 'Ракета',      r: 30, type: 'missile',  ammo: Infinity, col: '#d8d8d8', dmg: 38, wind: 0.35, shape: 'rocket' },
    { key: 'FUNKY',    name: 'Фанки',       r: 40, type: 'funky',    ammo: 3,  col: '#9a8ac8', dmg: 30, wind: 0.3,  shape: 'cluster' },
    { key: 'DEATH',    name: 'Смерть',      r: 62, type: 'death',    ammo: 2,  col: '#e8c14a', dmg: 90, wind: 0.15, shape: 'bomb' },
    { key: 'NUKE',     name: 'Ядерный',     r: 78, type: 'nuke',     ammo: 1,  col: '#ffd23f', dmg: 100, wind: 0.12, shape: 'bomb' },
    { key: 'PLASMA',   name: 'Плазма',      r: 48, type: 'plasma',   ammo: 2,  col: '#d06050', dmg: 55, wind: 0.2,  shape: 'mirv' },
    { key: 'NAPALM',   name: 'Напалм',      r: 50, type: 'napalm',   ammo: 2,  col: '#d85a18', dmg: 7,  wind: 0.6,  shape: 'canister' },
    { key: 'ROLLER',   name: 'Роллер',      r: 30, type: 'roller',   ammo: 3,  col: '#5aa8a0', dmg: 50, wind: 0.05, shape: 'ball' },
    { key: 'DIGGER',   name: 'Копатель',    r: 56, type: 'digger',   ammo: 3,  col: '#8a6a3a', dmg: 0,  wind: 0.2,  shape: 'drill' },
    { key: 'DIRT',     name: 'Грязь',       r: 70, type: 'dirt',     ammo: 3,  col: '#cbb490', dmg: 0,  wind: 0.3,  shape: 'ball' },
    { key: 'MIRV',     name: 'МИРВ',        r: 34, type: 'mirv',     ammo: 2,  col: '#c05a4a', dmg: 32, wind: 0.25, shape: 'mirv', subs: 5 }
  ];
  const TERRAIN_WEAPONS = ['digger', 'dirt'];
  const isTerr = (t) => TERRAIN_WEAPONS.includes(t);

  const BIOMES = {
    green:    { surf: '#5d8a3a', surfHi: '#79a84c', sub: ['#6b4a2c', '#4a3420', '#221507'], mat: { depthF: 1.0, rimF: 0.32, slope: 3.2, dustN: 26, chunkN: 14, dustCol: '150,120,80',  chunks: ['#5a4428', '#3b2c1a', '#6b4a2c'] } },
    desert:   { surf: '#c9a45e', surfHi: '#e0be74', sub: ['#a87f48', '#7c5a2e', '#3a2a12'], mat: { depthF: 1.25, rimF: 0.42, slope: 2.2, dustN: 42, chunkN: 8,  dustCol: '200,170,110', chunks: ['#a87f48', '#8a6435'] } },
    arctic:   { surf: '#dfe8ee', surfHi: '#f4f9fc', sub: ['#7d8ea0', '#54627a', '#2c3546'], mat: { depthF: 0.9, rimF: 0.45, slope: 4.5, dustN: 30, chunkN: 10, dustCol: '230,240,250', chunks: ['#9aacbe', '#7d8ea0'] } },
    volcanic: { surf: '#4a4442', surfHi: '#5c5654', sub: ['#3a3432', '#2a2523', '#151210'], mat: { depthF: 0.7, rimF: 0.5, slope: 7.5, dustN: 16, chunkN: 24, dustCol: '110,100,95',  chunks: ['#2a2523', '#44403e', '#5c3a1e'] } }
  };
  const TOD = {
    day:    { stops: ['#7ab3d8', '#a8cde6', '#d8e8f0'], sun: '#fff6d8', sunHalo: 'rgba(255,246,216,0.35)', stars: false, clouds: 0.55, haze: 'rgba(220,235,245,0.25)' },
    sunset: { stops: ['#2a2a55', '#7a4a78', '#d88a4a', '#f0b060'], sun: '#ffd9a0', sunHalo: 'rgba(255,150,80,0.4)', stars: 'dim', clouds: 0.4, haze: 'rgba(240,170,110,0.3)' },
    night:  { stops: ['#060a18', '#0c1526', '#1a2a44'], sun: '#e8ecf2', sunHalo: 'rgba(200,215,235,0.2)', stars: true, clouds: 0.12, haze: 'rgba(40,60,100,0.25)' }
  };

  let overlay, cv, ctx, Wc, Hc;
  let cols, waterLevel, biome, tod, seed, S, noise, archetype, moonBite, moonBiteR;
  let tanks, wind, windDir, aiSkill;
  let ammoInv = {}, aiAmmo = {}, cur = 0, turn, state, turnOrder = 0;
  let shot = null, subshots = [], liquids = [], debris = [], remains = [], sinkers = [], windParts = [], comets = [];
  let fx = [];
  let firePatches = [];
  let terraJobs = [];
  let events = [];
  let stars = [];
  let dirtyA = 0, dirtyB = 0;
  let raf = null, last = 0, gt = 0, skyT = 0, cloudOff = 0;
  let aim = { ang: 45, pow: 55 }, aiAim = 55;
  let score = 0, shots = 0, roundStart = 0, round = 1;
  let wins = 0;
  let drag = null, killed = null, helpOpen = false, lastHitInfo = null;
  let lastKillMethod = 'weapon', lastShotApex = 0;
  let AC = null;

  const $ = (s) => overlay.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const R = (a, b) => a + Math.random() * (b - a);
  const ease = (p) => 1 - Math.pow(1 - p, 2);
  const playerDir = () => (tanks[0].x < tanks[1].x ? 1 : -1);
  const M = () => biome.mat;
  const isDayT = () => tod && tod.stars === false;
  const indCol = () => isDayT() ? '#1b3f8f' : '#00d4ff';
  const indColHi = () => isDayT() ? '#b34a00' : '#ffb020';
  const biomeKey = () => Object.keys(BIOMES).find(k => BIOMES[k] === biome);
  const biomeLabel = () => ({ green: 'Холмы', desert: 'Пустыня', arctic: 'Арктика', volcanic: 'Вулкан' }[biomeKey()] || '');
  const windKind = () => ({ green: 'leaf', desert: 'sand', arctic: 'snow', volcanic: 'ash' }[biomeKey()] || 'dust');
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeNoise(rnd) {
    const T = new Float32Array(256);
    for (let i = 0; i < 256; i++) T[i] = rnd();
    return (x) => {
      const xi = Math.floor(x), f = x - xi;
      const a = T[xi & 255], b = T[(xi + 1) & 255];
      const u = f * f * (3 - 2 * f);
      return a + (b - a) * u;
    };
  }
  const fbm = (x, oct) => { let s = 0, a = 1, f = 1, t = 0; for (let o = 0; o < oct; o++) { s += noise(x * f) * a; t += a; a *= 0.5; f *= 2.03; } return s / t; };

  function ensureAudio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); }
  function sfx(size) {
    if (!AC) return;
    try {
      const dur = clamp(0.25 + size * 0.5, 0.2, 1.4);
      const buf = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.8);
      const src = AC.createBufferSource(); src.buffer = buf;
      const flt = AC.createBiquadFilter(); flt.type = 'lowpass';
      flt.frequency.value = 300 / size + 250;
      const g = AC.createGain();
      g.gain.value = clamp(0.12 * size, 0.06, 0.5);
      src.connect(flt); flt.connect(g); g.connect(AC.destination);
      src.start();
    } catch (e) {}
  }

  function records() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
  function saveRec() {
    const recs = records();
    recs.push({ score, wins, rounds: round, date: new Date().toLocaleString('ru-RU') });
    recs.sort((a, b) => b.score - a.score);
    localStorage.setItem(LS_KEY, JSON.stringify(recs.slice(0, MAX_REC)));
  }
  function schedule(fn, delay) { events.push({ at: gt + delay, fn }); }

  function open() {
    build();
    ensureAudio();
    overlay.classList.add('show');
    setTimeout(() => { resize(); start(); }, 60);
  }
  function close(boom) { if (boom) apocalypsis(); else { stop(); overlay.classList.remove('show'); } }
  function apocalypsis() {
    if (state === 'closing') return;
    state = 'closing';
    shot = null; subshots = []; liquids = []; events = []; firePatches = [];
    tanks.forEach((t, i) => {
      boomsAt(t.x, t.y - 10, 60, 'nuke', 0);
      t.dead = true; killed = i;
      remains.push({ x: t.x, y: t.y, col: t.col, style: 'nuke', falling: true, sunk: false, wreck: 1 });
      tankParts(t);
    });
    for (let i = 0; i < 4; i++) {
      const bx = R(Wc * 0.15, Wc * 0.85);
      schedule(() => boomsAt(bx, surfaceAt(bx) - 10, 80, 'nuke', 0), 0.12 + i * 0.14);
    }
    let fr = 0;
    const fin = () => {
      fr++;
      gt += 1 / 60;
      for (let i = events.length - 1; i >= 0; i--) if (gt >= events[i].at) { const fn = events[i].fn; events.splice(i, 1); fn(); }
      stepTerra(1 / 30);
      stepFx(1 / 30);
      stepWater(1 / 30);
      draw();
      if (fr > 55) { stop(); overlay.classList.remove('show'); return; }
      requestAnimationFrame(fin);
    };
    requestAnimationFrame(fin);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; events = []; }

  // ================= TERRAIN =================
  const ARCH = ['hills', 'mountain', 'craterValley', 'mesa', 'island', 'badlands'];
  const gauss = (u, c, w, a) => a * Math.exp(-((u - c) / w) * ((u - c) / w));

  function genSky() {
    stars = [];
    for (let i = 0; i < 130; i++) {
      stars.push({
        x: Math.random() * Wc, y: Math.random() * Hc * 0.5,
        sz: R(0.8, 2.6),
        col: ['#ffffff', '#cfe0ff', '#fff2c2', '#ffd9c2', '#e8d1ff', '#c2d4ff'][(Math.random() * 6) | 0],
        tw: R(0.15, 0.7), ph: R(0, 6.28), cross: Math.random() < 0.12
      });
    }
    moonBite = R(0.3, 0.95) * 16 * (Math.random() < 0.5 ? -1 : 1);
    moonBiteR = R(0.75, 1.05) * 16;
  }

  function genTerrain() {
    seed = (Math.random() * 1e9) | 0;
    S = mulberry32(seed);
    noise = makeNoise(S);
    archetype = ARCH[Math.floor(S() * ARCH.length)];
    biome = BIOMES[Object.keys(BIOMES)[Math.floor(S() * Object.keys(BIOMES).length)]];
    tod = TOD[Object.keys(TOD)[Math.floor(S() * Object.keys(TOD).length)]];
    genSky();

    const N = NCOL();
    const feats = [];
    const addG = (c, w, a, cap) => feats.push([c, w, a, cap]);
    let base = 0.32;
    if (archetype === 'hills') { base = 0.3; for (let k = 0; k < 4; k++) addG(0.1 + S() * 0.8, 0.1 + S() * 0.16, 0.12 + S() * 0.18); }
    if (archetype === 'mountain') { base = 0.16; addG(0.25 + S() * 0.5, 0.08 + S() * 0.06, 0.55 + S() * 0.25); addG(0.2 + S() * 0.6, 0.07 + S() * 0.05, 0.35 + S() * 0.2); for (let k = 0; k < 2; k++) addG(S(), 0.14, 0.12); }
    if (archetype === 'craterValley') { base = 0.55; for (let k = 0; k < 2; k++) { const c = 0.2 + S() * 0.6; addG(c, 0.07 + S() * 0.03, -0.3); addG(c - 0.1, 0.05, 0.16); addG(c + 0.1, 0.05, 0.16); } addG(S(), 0.2, 0.2); }
    if (archetype === 'mesa') { base = 0.24; for (let k = 0; k < 3; k++) { const c = 0.15 + S() * 0.7, w = 0.06 + S() * 0.05, a = 0.35 + S() * 0.3; addG(c, w * 2.2, a, 'cap'); } }
    if (archetype === 'island') { base = 0.08; addG(0.3 + S() * 0.15, 0.09, 0.55); addG(0.6 + S() * 0.15, 0.08, 0.5); }
    if (archetype === 'badlands') { base = 0.34; for (let k = 0; k < 5; k++) addG(S(), 0.07 + S() * 0.05, 0.2 + S() * 0.25); }

    const detail = archetype === 'badlands' ? 0.1 : archetype === 'mesa' ? 0.03 : 0.05;
    cols = [];
    for (let i = 0; i < N; i++) {
      const u = i / N;
      let h = base;
      feats.forEach(f => { h += gauss(u, f[0], f[1], f[2]); });
      if (archetype === 'mesa') feats.forEach(f => { if (f[3] === 'cap' && Math.abs(u - f[0]) < f[1]) h = Math.min(h, base + f[2] * 0.92 + 0.04); });
      h += (fbm(u * 6 + 50, 4) - 0.5) * 2 * detail;
      if (archetype === 'badlands') h += (1 - Math.abs(2 * fbm(u * 11 + 90, 3) - 1)) * 0.14;
      h = clamp(h, 0.03, 0.95);
      cols.push({ top: Math.round(Hc * 0.9 - h * Hc * 0.68), surf: 5 + Math.round(noise(u * 40) * 5), burn: 0 });
    }
    cols.step = Wc / N;

    if (archetype === 'island') waterLevel = Hc * 0.55;
    else {
      waterLevel = Hc * (0.78 + S() * 0.06);
      const nb = S() < 0.7 ? 1 + (S() < 0.4 ? 1 : 0) : 0;
      for (let b = 0; b < nb; b++) {
        const c = 0.15 + S() * 0.7, w = 0.05 + S() * 0.06;
        for (let i = 0; i < N; i++) {
          const u = i / N;
          const d = Math.abs(u - c) / w;
          if (d < 1) cols[i].top = Math.max(cols[i].top, waterLevel + 8 + (1 - d * d) * 38);
        }
      }
    }
    let hi = Hc;
    for (let i = 4; i < N - 4; i++) hi = Math.min(hi, cols[i].top);
    if (waterLevel < hi + 26) waterLevel = hi + 26;
    windDir = S() < 0.5 ? -1 : 1;
    dirtyA = 0; dirtyB = N - 1;
    waterReset();
  }

  function surfaceAt(x) { const i = clamp(Math.round(x / cols.step), 0, cols.length - 1); return cols[i].top; }
  function slopeAt(x) { const i = clamp(Math.round(x / cols.step), 0, cols.length - 1); const a = cols[clamp(i - 1, 0, cols.length - 1)].top, b = cols[clamp(i + 1, 0, cols.length - 1)].top; return (b - a) / (2 * cols.step); }

  // ================= WATER =================
  const WP = {
    speed: 130, decay: 0.0012, ampBass: 13, ampMid: 7, ampTrb: 3,
    beatSense: 1.45, beatCooldown: 0.16, maxRipples: 16, specular: 0.55
  };
  let ripples = [];
  let waterH = null;
  const wPhase = { b: 0, m: 0, t: 0 };
  let aState = { bass: 0, mid: 0, treble: 0, bassAvg: 0, bassPeak: 0.2, lastBeat: -1 };
  let audioLive = false;

  function waterReset() { ripples = []; waterH = null; aState = { bass: 0, mid: 0, treble: 0, bassAvg: 0, bassPeak: 0.2, lastBeat: -1 }; }

  function readAudio() {
    const ap = document.getElementById('audioPlayer');
    audioLive = !!ap && !ap.paused && !!window.scAnalyser;
    if (!audioLive) { aState.bass *= 0.8; aState.mid *= 0.8; aState.treble *= 0.8; return; }
    const an = window.scAnalyser;
    try {
      const dA = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(dA);
      const band = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += dA[i]; return s / (b - a) / 255; };
      const n = an.frequencyBinCount;
      const bass = band(1, Math.max(3, Math.floor(n * 0.08)));
      const mid = band(Math.floor(n * 0.08), Math.floor(n * 0.3));
      const tre = band(Math.floor(n * 0.3), Math.floor(n * 0.7));
      const sm = (cur, v) => v > cur ? cur * 0.5 + v * 0.5 : cur * 0.9 + v * 0.1;
      aState.bass = sm(aState.bass, bass);
      aState.mid = sm(aState.mid, mid);
      aState.treble = sm(aState.treble, tre);
      aState.bassAvg = aState.bassAvg * 0.96 + bass * 0.04;
      const thr = Math.max(aState.bassAvg * WP.beatSense, aState.bassPeak * 0.45, 0.18);
      if (bass > thr && gt - aState.lastBeat > WP.beatCooldown) {
        aState.lastBeat = gt;
        aState.bassPeak = Math.max(aState.bassPeak * 0.92, bass);
        spawnRipple('bass', clamp(bass / Math.max(0.4, aState.bassPeak), 0.3, 1));
        if (mid > 0.3) spawnRipple('mid', mid);
      } else if (tre > 0.5 && gt - aState.lastBeat > WP.beatCooldown * 2) {
        spawnRipple('treble', tre * 0.6);
        aState.lastBeat = gt;
      }
    } catch (e) {}
  }

  function spawnRipple(kind, level) {
    if (ripples.length >= WP.maxRipples) ripples.shift();
    const bass = kind === 'bass';
    const mid = kind === 'mid';
    ripples.push({
      x: R(Wc * 0.08, Wc * 0.92),
      radius: bass ? R(4, 14) : R(2, 8),
      amp: bass ? WP.ampBass * clamp(level, 0.3, 1) : mid ? WP.ampMid * level : WP.ampTrb * level,
      speed: bass ? WP.speed * 0.65 : mid ? WP.speed * 0.9 : WP.speed * 1.3,
      decay: bass ? WP.decay : mid ? WP.decay * 1.6 : WP.decay * 2.4,
      width: bass ? 220 : mid ? 120 : 60,
      t: 0
    });
  }

  function stepWater(dt) {
    readAudio();
    ripples = ripples.filter(rp => {
      rp.radius += rp.speed * dt;
      rp.t += dt;
      rp.amp *= (1 - rp.decay * rp.radius * dt * 0.02);
      return rp.amp > 0.25 && rp.radius < Wc * 1.4;
    });
    const N = cols.length;
    if (!waterH || waterH.length !== N) waterH = new Float32Array(N);
    const playing = audioLive && (aState.bass + aState.mid + aState.treble > 0.02);
    if (playing) {
      const bAmp = aState.bass * 6.5, mAmp = aState.mid * 3.5, tAmp = aState.treble * 1.8;
      wPhase.b += (0.8 + aState.bass * 6) * dt;
      wPhase.m += (0.55 + aState.mid * 4) * dt;
      wPhase.t += (2.2 + aState.treble * 5) * dt;
      for (let i = 0; i < N; i++) {
        const x = i * cols.step;
        waterH[i] = Math.sin(x * 0.05 + wPhase.b) * bAmp
                  + Math.sin(x * 0.013 - wPhase.m) * mAmp
                  + Math.sin(x * 0.21 + wPhase.t) * tAmp
                  + (noise(x * 0.05 + wPhase.t * 0.3) - 0.5) * (0.3 + aState.bass * 0.9);
      }
      ripples.forEach(rp => {
        const i0 = clamp(Math.floor((rp.x - rp.radius - 40) / cols.step), 0, N - 1);
        const i1 = clamp(Math.ceil((rp.x + rp.radius + 40) / cols.step), 0, N - 1);
        for (let i = i0; i <= i1; i++) {
          const d = Math.abs(i * cols.step - rp.x);
          const fr = d - rp.radius;
          const ir = 1 + (noise(i * 3.1 + rp.x * 0.02) - 0.5) * 0.5;
          waterH[i] += Math.exp(-(fr * fr) / rp.width) * rp.amp * ir
                     * Math.cos(clamp(0.9 - fr / 130, -1, 1) * Math.PI) * 0.5;
        }
      });
    } else {
      for (let i = 0; i < N; i++) waterH[i] *= (1 - dt * 2.5);
    }
  }

  function waterAt(x) {
    if (!waterH) return waterLevel;
    const fi = x / cols.step;
    const i = Math.floor(fi);
    if (i < 0 || i >= waterH.length - 1) return waterLevel;
    const f = fi - i;
    return waterLevel + waterH[i] * (1 - f) + waterH[i + 1] * f;
  }

  // ================= PLACEMENT =================
  function placeTanks() {
    const N = cols.length;
    const standable = (i, dryGap, slMax, win) => {
      if (cols[i].top > waterLevel - dryGap) return false;
      let s = 0;
      for (let k = -win; k <= win; k++) s = Math.max(s, Math.abs(cols[clamp(i + k, 0, N - 1)].top - cols[i].top));
      return s < slMax;
    };
    let spots = [];
    for (let i = 4; i < N - 4; i++) if (standable(i, 24, 14, 3)) spots.push(i);
    if (spots.length < 2) {
      spots = [];
      for (let i = 4; i < N - 4; i++) if (standable(i, 4, 26, 1)) spots.push(i);
    }
    if (spots.length < 2) {
      const dryIdx = [];
      for (let i = 4; i < N - 4; i++) if (cols[i].top <= waterLevel - 2) dryIdx.push(i);
      const pick = (from) => {
        const c = clamp(from, 4, N - 5);
        let best = c, bh = -1;
        for (let k = -6; k <= 6; k++) {
          const j = clamp(c + k, 0, N - 1);
          const h = waterLevel - cols[j].top;
          if (h > bh) { bh = h; best = j; }
        }
        return best;
      };
      const p1 = pick(dryIdx.length ? dryIdx[Math.floor(dryIdx.length * 0.25)] : Math.floor(N * 0.22));
      const p2 = pick(dryIdx.length ? dryIdx[Math.floor(dryIdx.length * 0.75)] : Math.floor(N * 0.78));
      [p1, p2].forEach(c => {
        const target = waterLevel - 26;
        for (let k = -5; k <= 5; k++) {
          const j = clamp(c + k, 0, N - 1);
          const fall = 1 - Math.abs(k) / 7;
          cols[j].top = Math.min(cols[j].top, target + (1 - fall) * 16);
        }
        spots.push(c);
      });
    }
    let bestPair = null, bestGap = -1;
    for (let t = 0; t < 40; t++) {
      const a = spots[(Math.random() * spots.length) | 0];
      const b = spots[(Math.random() * spots.length) | 0];
      if (a === b) continue;
      const gap = Math.abs(a - b);
      if (gap > bestGap) { bestGap = gap; bestPair = [a, b]; }
    }
    if (!bestPair) bestPair = [spots[0], spots[Math.min(spots.length - 1, Math.floor(spots.length / 2))]];
    const greenFirst = Math.random() < 0.5;
    const pi = greenFirst ? bestPair[0] : bestPair[1];
    const ei = greenFirst ? bestPair[1] : bestPair[0];
    tanks = [
      { x: pi * cols.step, hp: TANK_HP, col: '#2ecc71', dead: false, fallFrom: undefined, wreck: 0, shield: 1 },
      { x: ei * cols.step, hp: TANK_HP, col: '#ff4757', dead: false, fallFrom: undefined, wreck: 0, shield: 1 }
    ];
    tanks.forEach(t => { t.x = clamp(t.x, 20, Wc - 20); t.y = surfaceAt(t.x); });
  }

  function newRound(first) {
    genTerrain();
    wind = windDir * R(0.3, 4);
    placeTanks();
    turn = turnOrder; // alternation continues; random first only in start()
    state = 'aim';
    aim = { ang: R(35, 55), pow: R(45, 65) };
    aiAim = 55;
    shot = null; subshots = []; liquids = []; debris = []; remains = []; terraJobs = []; events = []; sinkers = []; fx = []; firePatches = [];
    windParts = []; comets = []; lastHitInfo = null; killed = null; lastKillMethod = 'weapon'; lastShotApex = 0;
    roundStart = Date.now();
    if (!first) round++;
    draw();
  }

  // ================= DEFORMATION =================
  function craterMask(cx, r, pow, mode, form) {
    pow = pow || 1;
    const N = cols.length;
    form = form || 'circle';
    const i0 = clamp(Math.round((cx - r * 1.35) / cols.step), 0, N - 1);
    const i1 = clamp(Math.round((cx + r * 1.35) / cols.step), 0, N - 1);
    const list = [];
    for (let i = i0; i <= i1; i++) {
      const dx = (i * cols.step - cx) / r;
      const j = 0.82 + noise(i * 3.7) * 0.36;
      let shape = 1;
      if (form === 'star') {
        const ray = Math.pow(Math.abs(Math.sin(dx * Math.PI * 6)), 0.35);
        shape = Math.abs(dx) < 1 ? (ray * 1.25 + 0.25) : 0.3;
      } else if (form === 'ellipse') {
        shape = Math.pow(Math.max(0, 1 - dx * dx), 0.25);
      } else if (form === 'line') {
        shape = Math.abs(dx) < 0.4 ? 1.2 : 0.15;
      }
      let to = null;
      if (mode === 'add') {
        if (Math.abs(dx) < 1.05) to = cols[i].top - r * 0.7 * shape * Math.sqrt(Math.max(0, 1.06 - dx * dx)) * j;
      } else if (mode === 'smooth') {
        const prev = cols[clamp(i - 1, 0, N - 1)].top, next = cols[clamp(i + 1, 0, N - 1)].top;
        to = (cols[i].top * 2 + prev + next) / 4;
      } else {
        if (Math.abs(dx) < 0.74) to = cols[i].top + r * M().depthF * pow * shape * Math.pow(1 - dx * dx, 0.75) * j;
        else if (Math.abs(dx) < 1.06) {
          const f = 1 - (Math.abs(dx) - 0.74) / 0.32;
          to = cols[i].top - r * M().rimF * pow * shape * Math.pow(f, 1.2) * j;
        }
      }
      if (to !== null && Math.abs(to - cols[i].top) > 0.5) {
        const isCrater = mode !== 'add' && mode !== 'smooth' && Math.abs(dx) < 0.74;
        const isRim = mode !== 'add' && mode !== 'smooth' && Math.abs(dx) >= 0.74;
        list.push({ i, from: cols[i].top, to, delay: Math.abs(dx) * 0.22 + noise(i * 9.1) * 0.08, dur: 0.3 + noise(i * 5.3) * 0.15, isCrater, isRim });
      }
    }
    if (list.length) {
      terraJobs.push({ t: 0, cols: list });
      dirtyA = Math.min(dirtyA, i0); dirtyB = Math.max(dirtyB, i1);
    }
  }

  function digTrench(x, y, ang, len, rad) {
    for (let k = 0; k <= 8; k++) {
      const px = x + Math.cos(ang) * (k * len / 8), py = y + Math.sin(ang) * (k * len / 8);
      if (px < 4 || px > Wc - 4 || py > Hc - 4) break;
      craterMask(px, rad, 1.15, 'blast', 'line');
    }
    for (let k = 0; k < 16; k++) {
      const px = x + Math.cos(ang) * R(0, len);
      debris.push({ x: px, y: surfaceAt(px), vx: Math.cos(ang) * R(-30, 60) + R(-40, 40), vy: -R(60, 190), rot: R(0, 6), vr: R(-6, 6), s: R(1.5, 4), col: M().chunks[(Math.random() * M().chunks.length) | 0], settled: false, life: 12 });
    }
  }

  function stepTerra(dt) {
    terraJobs = terraJobs.filter(j => {
      j.t += dt;
      j.cols.forEach(c => {
        if (j.t < c.delay) return;
        const k = ease(Math.min(1, (j.t - c.delay) / c.dur));
        cols[c.i].top = c.from + (c.to - c.from) * k;
        if (c.isCrater) { cols[c.i].surf = 0; cols[c.i].burn = Math.max(cols[c.i].burn, 0.9 * k); }
        if (c.isRim) cols[c.i].surf *= 0.985;
      });
      return j.cols.some(c => j.t < c.delay + c.dur);
    });
    const ms = M().slope * 1.6;
    const K = 3 * dt;
    for (let i = Math.max(1, dirtyA); i < Math.min(cols.length - 1, dirtyB); i++) {
      const diff = cols[i + 1].top - cols[i].top;
      if (diff > ms) { const q = Math.min((diff - ms) * 0.25, K * 20); cols[i].top += q; cols[i + 1].top -= q; }
    }
    cols.forEach(c => { if (c.burn > 0) c.burn = Math.max(0, c.burn - dt * 0.05); });
    tanks.forEach((t, i) => {
      if (t.dead) return;
      const c = cols[clamp(Math.round(t.x / cols.step), 0, cols.length - 1)];
      if (c.top > t.y + 0.5) {
        if (t.fallFrom === undefined) t.fallFrom = t.y;
        t.y = Math.min(t.y + 340 * dt, c.top);
        if (t.y >= c.top - 0.5) {
          if (t.fallFrom - c.top > 30) killTank(i, 'crush');
          t.fallFrom = undefined;
        }
      } else if (c.top < t.y - 0.5) {
        t.y = c.top;
        t.fallFrom = undefined;
      }
      if (t.y - waterLevel > 12) killTank(i, 'drown');
    });
  }

  // ================= EXPLOSIONS =================
  function boomsAt(x, y, r, style, dmg) {
    dmg = dmg || 0;
    const m = M();
    const nuke = style === 'nuke';
    fx.push({ k: 'flash', x, y, r: r * 1.6, t: 0, life: nuke ? 0.22 : 0.11 });
    fx.push({ k: 'shock', x, y, r0: r * 0.4, r1: r * (nuke ? 4.2 : 2.2), t: 0, life: nuke ? 0.5 : 0.28 });
    fx.push({ k: 'fire', x, y, r, t: 0, life: nuke ? 1.0 : 0.45, nuke });
    schedule(() => craterMask(x, r * (nuke ? 1.15 : 1), nuke ? 1.4 : 1, 'blast'), 0.12);
    schedule(() => spawnChunks(x, y, r, m.chunkN * (nuke ? 1.8 : 1)), 0.16);
    schedule(() => spawnDust(x, y, r, m.dustN * (nuke ? 1.6 : 1)), 0.22);
    if (nuke) {
      schedule(() => fx.push({ k: 'mush', x, y: y - r * 0.4, r, t: 0, life: 2.4 }), 0.35);
      schedule(() => spawnDust(x, y - r * 0.6, r * 0.7, m.dustN), 0.5);
      schedule(() => spawnDust(x + R(-r, r), y, r * 0.5, m.dustN * 0.5), 0.75);
    }
    schedule(() => { for (let k = 0; k < 2; k++) fx.push({ k: 'smoke', x: x + R(-r * 0.4, r * 0.4), y: y - r * 0.3, r: r * 0.22, t: 0, life: 1.2 + R(0, 0.5) }); }, 0.8);
    sfx(r / 45);
    if (dmg > 0) tanks.forEach((tk, i) => {
      if (!tk.dead && Math.hypot(tk.x - x, tk.y - 6 - y) < r * 1.6) damageTank(i, dmg, style, x, y);
    });
  }

  function spawnChunks(x, y, r, n) {
    const ch = M().chunks;
    for (let k = 0; k < n; k++) {
      const a = R(-Math.PI, -Math.PI * 0.15), sp = R(60, 240);
      debris.push({
        x: x + R(-r * 0.3, r * 0.3), y: y - 4,
        vx: Math.cos(a) * sp, vy: -Math.abs(Math.sin(a)) * sp * (1 + r / 60),
        rot: R(0, 6.28), vr: R(-7, 7), s: R(2, 3 + r / 18),
        col: ch[(Math.random() * ch.length) | 0], settled: false, life: 14
      });
    }
  }
  function spawnDust(x, y, r, n) {
    const dc = M().dustCol;
    for (let k = 0; k < n; k++) {
      fx.push({
        k: 'dust', x: x + R(-r * 0.5, r * 0.5), y: y - R(0, r * 0.3),
        vx: R(-14, 14) + wind * 3, vy: -R(12, 45) - r * 0.25,
        r: R(3, 6) + r * 0.08, t: 0, life: R(1.4, 2.6), col: dc
      });
    }
  }
  function spawnDirtFall(x, r, col) {
    for (let i = 0; i < Math.min(50, r); i++) {
      debris.push({ x: x + R(-r, r), y: surfaceAt(x) - R(50, 130), vx: R(-12, 12), vy: R(-5, 5), rot: 0, vr: 0, s: R(1.5, 3.5), col: col || M().chunks[0], settled: false, life: 10 });
    }
  }

  function stepFx(dt) {
    fx = fx.filter(f => {
      f.t += dt;
      if (f.k === 'dust') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy *= (1 - dt * 0.6); f.r += 14 * dt; }
      if (f.k === 'smoke') { f.x += (f.vx || 0) * dt + wind * 8 * dt; f.y -= 12 * dt; f.r += 9 * dt; }
      return f.t < f.life;
    });
    debris = debris.filter(d => {
      d.life -= dt;
      if (d.life <= 0) return false;
      if (!d.settled) {
        d.vy += GRAV * 0.65 * dt; d.vx += wind * 0.25 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
        if (d.x < 0 || d.x > Wc || d.y > Hc) return false;
        if (d.y >= surfaceAt(d.x) - d.s / 2 && d.y > waterAt(d.x) - d.s) {
          d.settled = true; d.y = surfaceAt(d.x) - d.s / 2; d.vr = 0;
          if (d.s > 3 && Math.random() < 0.5) fx.push({ k: 'dust', x: d.x, y: d.y, vx: 0, vy: -8, r: 2.5, t: 0, life: 0.5, col: M().dustCol });
        }
      } else {
        d.y = surfaceAt(d.x) - d.s / 2;
        if (d.y > waterAt(d.x)) return false;
      }
      return true;
    });
    if (debris.length > 240) debris.splice(0, debris.length - 240);
    // wrecks chase ground/water every frame — no hovering
    remains.forEach(rm => {
      if (rm.sunk) return;
      const gy = surfaceAt(rm.x);
      const wy = waterAt(rm.x);
      if (gy > wy) {
        if (rm.y < wy - 6) {
          rm.y += 300 * dt;
          if (rm.y >= wy - 6) {
            rm.sunk = true; rm.falling = false;
            fx.push({ k: 'splash', x: rm.x, y: wy, r: 14, t: 0, life: 0.5 });
            sinkers.push({ x: rm.x, y: rm.y, t: 0, col: rm.col });
          }
        } else {
          rm.sunk = true; rm.falling = false;
          fx.push({ k: 'splash', x: rm.x, y: wy, r: 14, t: 0, life: 0.5 });
          sinkers.push({ x: rm.x, y: rm.y, t: 0, col: rm.col });
        }
        return;
      }
      if (rm.y < gy - 0.5) {
        rm.y = Math.min(rm.y + 300 * dt, gy);
      } else {
        rm.y = gy;
      }
      rm.falling = rm.y < gy - 0.5;
      if (rm.wreck === 2 && Math.random() < dt * 1.5) fx.push({ k: 'smoke', x: rm.x + R(-5, 5), y: rm.y - 12, r: 3, t: 0, life: 1.4 });
      if (rm.wreck === 1) { rm.wt = (rm.wt || 0) + dt; if (rm.wt > 4) rm.wreck = 2; }
    });
    firePatches = firePatches.filter(fp => {
      fp.life -= dt;
      if (Math.random() < dt * 2) fx.push({ k: 'smoke', x: fp.x + R(-4, 4), y: surfaceAt(fp.x) - 4, r: 3, t: 0, life: 1.6 });
      const ci = clamp(Math.round(fp.x / cols.step), 0, cols.length - 1);
      cols[ci].burn = Math.max(cols[ci].burn, 0.5);
      tanks.forEach((tk, i) => {
        if (!tk.dead && Math.abs(tk.x - fp.x) < 11 && Math.abs(tk.y - surfaceAt(fp.x)) < 14) damageTank(i, 9 * dt, 'napalm', fp.x, surfaceAt(fp.x));
      });
      return fp.life > 0;
    });
  }

  // ================= PROJECTILES =================
  function integrate(pos, vel, w, dt) {
    vel.vy += GRAV * dt;
    vel.vx += wind * w * WINDF * dt;
    pos.x += vel.vx * dt; pos.y += vel.vy * dt;
  }

  function fire() {
    if (state !== 'aim' || turn !== 0) return;
    const w = ARSENAL[cur];
    if (ammoInv[w.key] <= 0 && w.ammo !== Infinity) { cur = 0; draw(); return; }
    if (w.ammo !== Infinity) ammoInv[w.key]--;
    launch(tanks[0], aim.ang, aim.pow, playerDir(), w, 1);
    shots++;
  }

  function launch(t, ang, pow, dir, w, who) {
    const rad = ang * Math.PI / 180;
    shot = {
      x: t.x + Math.cos(rad) * 18 * dir, y: t.y - 12 - Math.sin(rad) * 18,
      vx: Math.cos(rad) * pow * (VMAX / 100) * dir, vy: -Math.sin(rad) * pow * (VMAX / 100),
      w, trail: [], dir, t0: gt, apex: t.y - 12, rot: 0
    };
    state = 'fly'; turn = who; drag = null;
    draw();
  }

  function aiPickWeapon() {
    const pool = [];
    pool.push(ARSENAL[0], ARSENAL[0]);
    if (aiAmmo.DEATH > 0 && tanks[0].hp > 50) pool.push(ARSENAL[2]);
    if (aiAmmo.FUNKY > 0) pool.push(ARSENAL[1]);
    if (aiAmmo.PLASMA > 0) pool.push(ARSENAL[4]);
    if (aiAmmo.ROLLER > 0) pool.push(ARSENAL[6]);
    if (aiAmmo.NAPALM > 0) pool.push(ARSENAL[5]);
    if (aiAmmo.NUKE > 0 && round >= ROUNDS_MAX - 1) pool.push(ARSENAL[3]);
    return pool[(Math.random() * pool.length) | 0];
  }
  function aiTurn() {
    if (state !== 'aim' || turn !== 1) return;
    turn = 3;
    const me = tanks[1], foe = tanks[0];
    const dir = foe.x > me.x ? 1 : -1;
    let w = aiPickWeapon();
    let best = null;
    for (let strat = 0; strat < 4; strat++) {
      const angBase = [35, 45, 55, 65][strat];
      for (let ang = angBase - 10; ang <= angBase + 10; ang += 2) {
        for (let p = 10; p <= 100; p += 3) {
          const sim = simulateShot(me.x, me.y - 12, ang, p, dir, w.wind);
          if (sim && (!best || Math.abs(sim.x - foe.x) < best.dist)) best = { ang, p, dist: Math.abs(sim.x - foe.x) };
        }
      }
    }
    if (!best) best = { ang: 45, p: 60, dist: 999 };
    const err = 1 - aiSkill;
    const ang = clamp(best.ang + R(-12, 12) * err, 10, 85);
    const p = clamp(best.p * (1 + R(-0.18, 0.18) * err), 10, 100);
    const start = aiAim; let s = 0;
    const anim = () => {
      s++; aiAim = start + (ang - start) * (s / 14); draw();
      if (s < 14) schedule(anim, 0.03);
      else {
        if (w.ammo !== Infinity && aiAmmo[w.key] > 0) aiAmmo[w.key]--;
        else if (w.ammo !== Infinity) w = ARSENAL[0];
        launch(me, ang, p, dir, w, 2);
      }
    };
    schedule(anim, 0.03);
  }
  function simulateShot(x0, y0, ang, pow, dir, wa) {
    const rad = ang * Math.PI / 180;
    const pos = { x: x0, y: y0 };
    const vel = { vx: Math.cos(rad) * pow * (VMAX / 100) * dir, vy: -Math.sin(rad) * pow * (VMAX / 100) };
    const dt = 1 / 60;
    for (let t = 0; t < 10; t += dt) {
      integrate(pos, vel, wa, dt);
      if (pos.x < -50 || pos.x > Wc + 50) return null;
      if (pos.x >= 0 && pos.x <= Wc && pos.y >= surfaceAt(pos.x)) return { x: pos.x, y: pos.y };
    }
    return null;
  }

  function updateProjectile(p, dt) {
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 46) p.trail.shift();
    integrate(p, p, p.w.wind, dt);
    p.rot += dt * 6;
    if (p.y < p.apex) p.apex = p.y;
    if (p.x < -200 || p.x > Wc + 200) { p.dead = true; return; }

    if (p.w.type === 'mirv' && !p.split && p.vy >= 0 && gt - p.t0 > 0.5) {
      p.split = true; p.dead = true;
      fx.push({ k: 'flash', x: p.x, y: p.y, r: 20, t: 0, life: 0.09 });
      for (let i = 0; i < p.w.subs; i++) {
        subshots.push({
          x: p.x + R(-12, 12), y: p.y + i * 3,
          vx: p.vx * R(0.45, 1.1) + R(-55, 55), vy: R(-70, 30) - i * 9,
          w: { ...p.w, type: 'missile', r: p.w.r * 0.75, wind: p.w.wind },
          trail: [], t0: gt, apex: p.apex, rot: 0
        });
      }
      return;
    }

    if (p.x >= 0 && p.x <= Wc) {
      if (!isTerr(p.w.type) && p.w.type !== 'napalm') {
        tanks.forEach((tk, i) => {
          if (!tk.dead && Math.abs(p.x - tk.x) < 16 && p.y > tk.y - 34 && p.y < tk.y + 8) {
            p.dead = true;
            if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
            else damageTank(i, p.w.dmg, p.w.style || 'plain', p.x, p.y);
          }
        });
        if (p.dead) return;
      }
      const surf = surfaceAt(p.x);
      if (p.w.type === 'roller' && p.y >= surf - 6 && p.y < surf + 16) {
        if (surf > waterLevel + 4) { p.dead = true; fx.push({ k: 'splash', x: p.x, y: waterAt(p.x), r: 12, t: 0, life: 0.5 }); return; }
        const sl = slopeAt(p.x);
        p.vx += sl * 900 * dt;
        p.vx *= (1 - dt * 0.4);
        p.vy = 0; p.y = surf - 4; p.rot += p.vx * dt * 0.4;
        p.rollT = (p.rollT || 0) + dt;
        if (Math.random() < dt * 8) craterMask(p.x, 6, 0.4, 'blast', 'circle');
        const slow = Math.abs(p.vx) < 7 && Math.abs(sl) < 0.12;
        if (p.rollT > 4.5 || slow) p.dead = true;
        tanks.forEach((tk, i) => {
          if (!tk.dead && Math.abs(p.x - tk.x) < 13) {
            p.dead = true;
            if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
            else killed = i;
          }
        });
        return;
      }
      if (p.y >= surf) p.dead = true;
    }
  }

  function updateLiquid(l, dt) {
    l.vy += GRAV * 0.3 * dt;
    l.vx += wind * 0.5 * WINDF * dt;
    l.x += l.vx * dt; l.y += l.vy * dt;
    l.t += dt;
    if (l.x < 0 || l.x > Wc || l.y > Hc) { l.dead = true; return; }
    if (l.y >= waterAt(l.x) && surfaceAt(l.x) > waterLevel + 4) { l.dead = true; fx.push({ k: 'splash', x: l.x, y: waterAt(l.x), r: 12, t: 0, life: 0.5 }); return; }
    if (l.y >= surfaceAt(l.x)) {
      firePatches.push({ x: l.x, life: R(3, 6) });
      l.dead = true;
      return;
    }
  }

  // ================= WEAPON IMPACTS =================
  function resolveHit(p) {
    const w = p.w, x = p.x, y = p.y;
    state = 'boom';
    lastShotApex = p.apex || 0;
    const ang = Math.atan2(p.vy, p.vx);
    switch (w.type) {
      case 'missile':
        boomsAt(x, y, w.r, 'plain', w.dmg);
        break;
      case 'funky': {
        const n = 5;
        for (let i = 0; i < n; i++) {
          schedule(() => {
            const bx = x + R(-w.r * 1.4, w.r * 1.4);
            const by = y + R(-w.r * 0.8, w.r * 0.4);
            const br = w.r * R(0.35, 0.6);
            fx.push({ k: 'flash', x: bx, y: by, r: br * 1.4, t: 0, life: 0.09, col: ['#a29bff', '#ffd23f', '#ff6b9d', '#7bffc4'][(Math.random() * 4) | 0] });
            craterMask(bx, br, 0.8, 'blast', 'circle');
            spawnChunks(bx, by, br, 6);
            sfx(0.25);
            tanks.forEach((tk, i) => {
              if (!tk.dead && Math.hypot(tk.x - bx, tk.y - 6 - by) < br * 1.5) {
                if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
                else damageTank(i, w.dmg, 'funky', bx, by);
              }
            });
          }, 0.13 * i + R(0, 0.05));
        }
        schedule(() => boomsAt(x, y, w.r, 'plain', w.dmg), n * 0.13 + 0.2);
        break;
      }
      case 'death': {
        fx.push({ k: 'flash', x, y, r: w.r * 2, t: 0, life: 0.16 });
        fx.push({ k: 'shock', x, y, r0: w.r * 0.5, r1: w.r * 3.4, t: 0, life: 0.55 });
        fx.push({ k: 'fire', x, y, r: w.r, t: 0, life: 0.9, nuke: true });
        schedule(() => craterMask(x, w.r, 1.25, 'blast', 'ellipse'), 0.12);
        schedule(() => spawnChunks(x, y, w.r, M().chunkN * 1.6), 0.15);
        schedule(() => spawnDust(x, y, w.r, M().dustN * 1.4), 0.2);
        schedule(() => spawnDust(x + R(-w.r, w.r), y, w.r * 0.6, M().dustN * 0.6), 0.45);
        sfx(1.2);
        tanks.forEach((tk, i) => {
          if (!tk.dead && Math.hypot(tk.x - x, tk.y - 6 - y) < w.r * 1.7) {
            if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
            else damageTank(i, w.dmg, 'plain', x, y);
          }
        });
        break;
      }
      case 'nuke': {
        boomsAt(x, y, w.r, 'nuke', w.dmg);
        for (let k = 0; k < 5; k++) {
          schedule(() => spawnDust(x + R(-w.r * 0.2, w.r * 0.2), y - k * w.r * 0.3, w.r * 0.4, M().dustN * 0.5), 0.3 + k * 0.12);
        }
        for (let k = 0; k < 6; k++) {
          schedule(() => fx.push({ k: 'smoke', x: x + R(-w.r * 0.5, w.r * 0.5), y: y - w.r * 0.5, r: w.r * R(0.2, 0.4), t: 0, life: R(2, 3.5) }), 0.8 + k * 0.3);
        }
        schedule(() => craterMask(x, w.r * 0.6, 0.8, 'blast', 'circle'), 1.4);
        break;
      }
      case 'plasma': {
        fx.push({ k: 'plasmaOrb', x, y, r: w.r, t: 0, life: 2.2 });
        schedule(() => craterMask(x, w.r, 1.1, 'blast', 'star'), 0.05);
        sfx(0.7);
        tanks.forEach((tk, i) => {
          if (!tk.dead && Math.hypot(tk.x - x, tk.y - 6 - y) < w.r * 1.5) {
            if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
            else damageTank(i, w.dmg, 'plasma', x, y);
          }
        });
        break;
      }
      case 'napalm': {
        fx.push({ k: 'flash', x, y, r: w.r * 0.6, t: 0, life: 0.08, col: '#ffb84a' });
        for (let i = 0; i < 18; i++) liquids.push({ x: x + R(-w.r / 2, w.r / 2), y, vx: R(-45, 45), vy: R(-100, -25), t: 0, w });
        firePatches.push({ x, life: R(4, 7) });
        schedule(() => craterMask(x, w.r * 0.5, 0.35, 'blast', 'ellipse'), 0.6);
        sfx(0.4);
        break;
      }
      case 'roller':
        boomsAt(x, y, w.r, 'plain', w.dmg);
        break;
      case 'digger':
        fx.push({ k: 'shock', x, y, r0: 6, r1: w.r, t: 0, life: 0.25 });
        spawnDust(x, y, w.r * 0.5, M().dustN * 0.7);
        digTrench(x, y, ang, w.r * 1.6, w.r * 0.55);
        sfx(0.4);
        break;
      case 'dirt': {
        craterMask(x, w.r, 1, 'add', 'ellipse');
        spawnDirtFall(x, w.r);
        fx.push({ k: 'dustc', x, y: surfaceAt(x) - w.r * 0.5, r: w.r * 0.5, t: 0, life: 1.2, col: M().dustCol });
        sfx(0.35);
        break;
      }
      case 'mirv': break;
    }
  }

  function damageTank(i, baseDmg, style, x, y) {
    const t = tanks[i];
    if (t.dead || baseDmg <= 0) return;
    const d = Math.hypot(t.x - x, (t.y - 6) - y);
    const wref = ARSENAL.find(w => w.key === style);
    const r = wref ? wref.r : 30;
    const factor = clamp(1 - d / (r * 1.6), 0.15, 1);
    const dmg = baseDmg * factor;
    t.hp -= dmg;
    lastHitInfo = `${t === tanks[0] ? 'Вы' : 'Враг'}: −${Math.round(dmg)} hp`;
    if (t.hp <= 0) killTank(i, 'weapon', style);
    else if (dmg >= 25) fx.push({ k: 'fire', x: t.x, y: t.y - 12, r: 16, t: 0, life: 0.3 });
    draw();
  }

  function killTank(i, cause, style) {
    const t = tanks[i];
    if (t.dead) return;
    t.dead = true; killed = i; lastKillMethod = cause;
    if (cause === 'drown') {
      sinkers.push({ x: t.x, y: t.y, t: 0, col: t.col });
      fx.push({ k: 'splash', x: t.x, y: waterAt(t.x), r: 14, t: 0, life: 0.5 });
    } else if (cause === 'crush') {
      fx.push({ k: 'dustc', x: t.x, y: t.y - 10, r: 20, t: 0, life: 0.8, col: M().dustCol });
      remains.push({ x: t.x, y: t.y, col: t.col, style: 'sand', falling: false, sunk: false, wreck: 2 });
    } else {
      boomsAt(t.x, t.y - 10, 34, 'plain', 0);
      remains.push({ x: t.x, y: t.y, col: t.col, style: style || 'plain', falling: true, sunk: false, wreck: 1 });
      tankParts(t);
    }
  }
  function tankParts(t) {
    for (let k = 0; k < 13; k++) {
      debris.push({ x: t.x + R(-8, 8), y: t.y - 10, vx: R(-90, 90), vy: R(-180, -60), rot: R(0, 6), vr: R(-8, 8), s: R(2, k === 0 ? 7 : 4), col: k % 3 === 0 ? '#7a7a7a' : t.col, settled: false, life: 12 });
    }
  }

  function endTurn() {
    state = 'aim';
    turnOrder = 1 - turnOrder; // strict alternation after each shot
    turn = turnOrder;
    draw();
  }

  function endRound() {
    const won = killed === 1;
    killed = null; state = 'wait';
    if (won) {
      wins++;
      const dt = (Date.now() - roundStart) / 1000;
      let pts = 100;
      pts += Math.max(0, Math.round(300 - dt * 2));
      if (['MISSILE', 'ROLLER', 'DIGGER', 'DIRT'].includes(ARSENAL[cur].key)) pts = Math.round(pts * 1.5);
      if (lastShotApex < tanks[1].y - 120) pts += 120;
      if (lastKillMethod === 'drown') pts += 150;
      if (lastKillMethod === 'crush') pts += 120;
      pts += Math.max(0, 40 - shots * 8);
      score += pts;
      aiSkill = Math.min(0.95, aiSkill + 0.08);
    } else {
      aiSkill = Math.max(0.2, aiSkill - 0.05);
    }
    if (round >= ROUNDS_MAX) { schedule(() => showOver(), 1.2); return; }
    schedule(() => newRound(false), 1.0);
  }

  function showOver() {
    const won = wins >= Math.ceil(ROUNDS_MAX / 2);
    if (score > 0) saveRec();
    const before = records();
    const recs = records();
    const myIdx = recs.findIndex(r => !before.includes(r));
    $('.sc-over-title').textContent = won ? '🏆 Победа!' : '💥 Поражение';
    $('.sc-over-res').innerHTML = `Очки: <b style="color:var(--accent)">${score}</b> · Побед: <b>${wins}</b> из ${ROUNDS_MAX}`;
    $('.sc-rectab').innerHTML = '<tr><th>#</th><th>Очки</th><th>Побед</th><th>Дата</th></tr>' +
      recs.slice(0, MAX_REC).map((r, i) => `<tr${i === myIdx ? ' class="me"' : ''}><td>${i + 1}</td><td>${r.score}</td><td>${r.wins || 0}</td><td>${r.date}</td></tr>`).join('');
    $('.sc-over').classList.add('show');
    state = 'over';
  }

  // ================= LOOP =================
  function start() {
    score = 0; wins = 0; round = 1; shots = 0; aiSkill = 0.35;
    ammoInv = {}; aiAmmo = {};
    ARSENAL.forEach(w => { ammoInv[w.key] = w.ammo; aiAmmo[w.key] = w.ammo; });
    cur = 0;
    turnOrder = Math.random() < 0.5 ? 0 : 1; // random FIRST shooter, once per game
    newRound(true);
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((t - last) / 1000, 0.05); last = t;
    if (overlay && overlay.classList.contains('show')) step(dt);
  }
  function step(dt) {
    gt += dt; skyT += dt; cloudOff += windDir * 6 * dt;
    for (let i = events.length - 1; i >= 0; i--) if (gt >= events[i].at) { const fn = events[i].fn; events.splice(i, 1); fn(); }

    if (state === 'fly' && shot) {
      updateProjectile(shot, dt);
      if (shot && shot.dead) { resolveHit(shot); shot = null; }
    }
    subshots = subshots.filter(s => { updateProjectile(s, dt); if (s.dead) { resolveHit(s); return false; } return true; });
    liquids = liquids.filter(l => { updateLiquid(l, dt); return !l.dead; });
    sinkers = sinkers.filter(sk => {
      sk.t += dt; sk.y += 26 * dt; sk.x += Math.sin(sk.t * 2) * 0.4;
      if (Math.random() < dt * 3) fx.push({ k: 'dust', x: sk.x + R(-6, 6), y: sk.y - 6, vx: 0, vy: -20, r: 1.5, t: 0, life: 0.6, col: '180,220,255' });
      return sk.y < Hc - 4 && sk.t < 6;
    });
    stepTerra(dt * 2.2);
    stepFx(dt * 1.6);
    stepWater(dt);

    if (!isDayT() && Math.random() < dt * 0.07) {
      comets.push({ x: R(0, Wc * 1.1), y: R(10, Hc * 0.3), vx: -R(160, 380), vy: R(30, 110), t: 0, life: R(0.8, 2), sz: R(1, 2.4) });
    }
    comets.forEach(c => { c.x += c.vx * dt; c.y += c.vy * dt; c.t += dt; });
    comets = comets.filter(c => c.t < c.life);

    const want = Math.round(clamp(Math.abs(wind), 0.3, 4) * 14);
    while (windParts.length < want) windParts.push({ x: R(0, Wc), y: R(20, Hc * 0.9), ph: R(0, 6.28), ph2: R(0, 6.28), spd: R(0.6, 1.4), s: R(1.4, 3.4), a: R(0.75, 1.0), kind: windKind() });
    while (windParts.length > want) windParts.pop();
    windParts.forEach(p => {
      p.ph += dt * (1.5 + p.spd); p.ph2 += dt * 2.2;
      p.x += wind * (40 + 55 * p.spd) * dt;
      p.y += Math.sin(p.ph) * 18 * dt + Math.cos(p.ph2) * 8 * dt;
      if (p.x < -6) p.x = Wc + 4; if (p.x > Wc + 6) p.x = -4;
      if (p.y < 20) p.y = Hc * 0.9; if (p.y > Hc) p.y = 20;
    });

    if (state === 'aim' && turn === 1 && !shot && subshots.length === 0 && boomsIdle()) schedule(aiTurn, 0.9);
    if (state === 'boom' && boomsIdle()) { if (killed !== null) endRound(); else endTurn(); }
    if (state !== 'closing' && state !== 'over') draw();
  }
  const boomsIdle = () => booms0() && events.length === 0;
  function booms0() { return !fx.some(f => f.k === 'fire' || f.k === 'flash' || f.k === 'shock' || f.k === 'plasmaOrb') && terraJobs.length === 0 && liquids.length === 0 && !debris.some(d => !d.settled) && firePatches.length === 0; }

  // ================= RENDER =================
  function draw() {
    if (!ctx || !Wc || !cols) return;
    drawSky();
    drawWater(); // water ABOVE terrain: translucent layer over ground silhouette
    drawTerrain();
    drawRemains();
    drawDebris();
    drawSinkers();
    drawTanks();
    if (shot) drawShot(shot);
    subshots.forEach(drawShot);
    drawLiquids();
    drawFire();
    drawFx();
    drawWindParts();
    drawOffscreenMarks();
    if (state === 'aim' && turn === 0 && !helpOpen) drawAim();
    drawHUD();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, Hc);
    tod.stops.forEach((c, i) => g.addColorStop(i / (tod.stops.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Wc, Hc);
    if (tod.stars) {
      stars.forEach(st => {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(skyT * st.tw + st.ph));
        ctx.globalAlpha = tw * (tod.stars === 'dim' ? 0.4 : 0.9);
        ctx.fillStyle = st.col;
        ctx.fillRect(st.x, st.y, st.sz, st.sz);
        if (st.cross && st.sz > 1.8) {
          ctx.globalAlpha = tw * 0.35;
          ctx.fillRect(st.x - st.sz, st.y + st.sz / 2 - 0.5, st.sz * 3, 1);
          ctx.fillRect(st.x + st.sz / 2 - 0.5, st.y - st.sz, 1, st.sz * 3);
        }
      });
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 80; i++) {
        const t = (i * 61.7) % 100 / 100;
        ctx.fillRect(t * Wc, Hc * 0.1 + t * Hc * 0.35 + (noise(i * 3.3) - 0.5) * 50, 1, 1);
      }
      ctx.globalAlpha = 1;
      // moon: transparent crescent (sky visible through bite), slow wrap, shimmer
      const mu = (skyT * 0.002) % 1;
      const mx = -60 + mu * (Wc + 120);
      const my = Hc * (0.3 - Math.sin(mu * Math.PI) * 0.18);
      const shimmer = 0.92 + Math.sin(skyT * 1.3) * 0.06;
      const Rm = 16 * shimmer;
      const bx = mx + moonBite * shimmer;
      const by = my - Math.abs(moonBite) * 0.3;
      const br = moonBiteR * shimmer;
      // halo first (gradient glow around crescent)
      const hg = ctx.createRadialGradient(mx, my, Rm * 0.5, mx, my, Rm * 2.1);
      hg.addColorStop(0, 'rgba(200,215,235,0.28)');
      hg.addColorStop(1, 'rgba(200,215,235,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(mx, my, Rm * 2.1, 0, Math.PI * 2); ctx.fill();
      // single disc with transparent bite punched out
      ctx.save();
      ctx.beginPath(); ctx.arc(mx, my, Rm, 0, Math.PI * 2);
      ctx.fillStyle = '#dfe4ea';
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // craters only outside the bite
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = 'rgba(150,160,175,0.6)';
      [[-6, 2, 3], [4, 6, 2.2]].forEach(c => {
        const cx = mx + c[0], cy = my + c[1];
        if (Math.hypot(cx - bx, cy - by) > br * 0.95) {
          ctx.beginPath(); ctx.arc(cx, cy, c[2], 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      comets.forEach(c => {
        const p = c.t / c.life;
        const sz = c.sz || 1.5;
        ctx.strokeStyle = `rgba(200,230,255,${0.85 * (1 - p)})`;
        ctx.lineWidth = sz;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x - c.vx * 0.5, c.y - c.vy * 0.5);
        ctx.stroke();
        ctx.fillStyle = `rgba(240,250,255,${(1 - p) * 0.9})`;
        ctx.beginPath(); ctx.arc(c.x, c.y, sz, 0, Math.PI * 2); ctx.fill();
      });
      ctx.lineWidth = 1;
    } else {
      const isSunset = tod.stops === TOD.sunset.stops;
      const su = (skyT * 0.0027) % 1;
      const sx = -60 + su * (Wc + 120);
      const sy = Hc * ((isSunset ? 0.3 : 0.13) + Math.sin(su * Math.PI) * -0.06);
      const shimmer = 1 + Math.sin(skyT * 1.1) * 0.05;
      ctx.fillStyle = tod.sunHalo;
      ctx.beginPath(); ctx.arc(sx, sy, 52 * shimmer, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = tod.sun;
      ctx.beginPath(); ctx.arc(sx, sy, 24 * shimmer, 0, Math.PI * 2); ctx.fill();
      const nC = Math.round(tod.clouds * 6);
      for (let c = 0; c < nC; c++) {
        const cy = Hc * (0.08 + noise(c * 7.7) * 0.3);
        const cw = 60 + noise(c * 3.1) * 90;
        let cx = ((cloudOff * (0.5 + noise(c) * 0.7)) + noise(c * 13) * Wc * 1.4) % (Wc + 300) - 150;
        ctx.fillStyle = `rgba(255,255,255,${0.16 + noise(c * 5) * 0.18})`;
        for (let b = 0; b < 5; b++) {
          ctx.beginPath();
          ctx.ellipse(cx + b * cw * 0.22, cy + Math.sin(b * 2.1 + c) * 6, cw * (0.3 - b * 0.03), 11 - b, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    const hz = ctx.createLinearGradient(0, Hc * 0.45, 0, Hc * 0.75);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(1, tod.haze);
    ctx.fillStyle = hz;
    ctx.fillRect(0, Hc * 0.45, Wc, Hc * 0.3);
  }

  function drawTerrain() {
    const N = cols.length;
    ctx.beginPath();
    ctx.moveTo(0, Hc);
    for (let i = 0; i < N; i++) ctx.lineTo(i * cols.step, cols[i].top);
    ctx.lineTo(Wc, Hc);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, Hc * 0.25, 0, Hc);
    g.addColorStop(0, biome.sub[0]); g.addColorStop(0.5, biome.sub[1]); g.addColorStop(1, biome.sub[2]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = biome.sub[1];
    for (let b = 0; b < 2; b++) {
      ctx.beginPath();
      ctx.moveTo(0, Hc);
      for (let x = 0; x <= Wc; x += 14) {
        const i = clamp(Math.round(x / cols.step), 0, N - 1);
        ctx.lineTo(x, cols[i].top + 26 + b * 34 + Math.sin(x * 0.02 + b * 5 + seed % 7) * 9);
      }
      ctx.lineTo(Wc, Hc);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 3; i < N; i += 5) {
      if (noise(i * 4.9) > 0.68) {
        const y = cols[i].top + 14 + noise(i * 2.7) * 60;
        if (y < Hc - 6) ctx.fillRect(i * cols.step, y, 2 + noise(i) * 2.5, 1.6 + noise(i * 1.7) * 1.6);
      }
    }
    ctx.restore();
    for (let i = 0; i < N; i++) {
      const c = cols[i];
      const x = i * cols.step, w = cols.step + 0.5;
      const prev = i > 0 ? cols[i - 1].top : c.top;
      const sl = (c.top - prev);
      if (c.surf > 0) {
        ctx.fillStyle = biome.surf;
        ctx.fillRect(x, c.top, w, c.surf);
        ctx.fillStyle = biome.surfHi;
        ctx.fillRect(x, c.top, w, 1.5);
        ctx.fillStyle = sl > 1 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, c.top + 1.5, w, Math.max(0, c.surf - 1.5));
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, c.top, w, 2.5);
      }
      if (c.burn > 0) {
        ctx.globalAlpha = c.burn * 0.5;
        ctx.fillStyle = '#c84818';
        ctx.fillRect(x, c.top, w, 6 + c.burn * 7);
        ctx.globalAlpha = 1;
      }
    }
    const edgePath = () => {
      ctx.beginPath();
      ctx.moveTo(0, cols[0].top);
      for (let i = 1; i < N; i++) ctx.lineTo(i * cols.step, cols[i].top);
    };
    ctx.strokeStyle = isDayT() ? 'rgba(80,160,60,0.55)' : 'rgba(46,204,113,0.4)';
    ctx.lineWidth = 1.6;
    edgePath(); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = isDayT() ? 'rgba(190,240,160,0.3)' : 'rgba(150,255,190,0.22)';
    ctx.save();
    ctx.translate(0, 0.5);
    edgePath(); ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1;
  }

  // Water ABOVE terrain (drawn before it): translucent layer behind ground silhouette
  function drawWater() {
    if (!waterH) return;
    const dark = !isDayT();
    const N = cols.length;
    const topA = dark ? [34, 70, 120] : [50, 100, 165];
    const botA = dark ? [10, 24, 52] : [18, 46, 95];
    for (let i = 0; i < N; i++) {
      const x = i * cols.step;
      const hgt = waterH[i];
      const y = waterLevel + hgt;
      if (cols[i].top <= y) continue;
      const w = cols.step + 0.5;
      const depth = cols[i].top - y;
      if (depth <= 0) continue;
      const hL = i > 0 ? waterH[i - 1] : hgt;
      const hR = i < N - 1 ? waterH[i + 1] : hgt;
      const gx = (hR - hL) / (2 * cols.step);
      const litK = clamp(0.5 + gx * 6, 0, 1);
      const spec = Math.pow(clamp(Math.abs(gx) * 10 + aState.treble * 0.3, 0, 1), 3) * WP.specular;
      const hi = clamp(hgt / 8, -0.5, 0.5);
      const r = Math.round(topA[0] * (0.75 + litK * 0.3 + hi) + botA[0] * 0.2);
      const g = Math.round(topA[1] * (0.75 + litK * 0.3 + hi) + botA[1] * 0.2);
      const b = Math.round(topA[2] * (0.75 + litK * 0.3 + hi) + botA[2] * 0.2);
      ctx.globalAlpha = dark ? 0.45 : 0.5;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, w, depth);
      ctx.globalAlpha = 1;
      if (spec > 0.3) {
        ctx.fillStyle = `rgba(255,255,255,${(spec - 0.3) * 0.35})`;
        ctx.fillRect(x, y, w, 1.2);
      }
    }
    ctx.strokeStyle = dark ? 'rgba(120,180,240,0.3)' : 'rgba(40,100,190,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < N; i++) {
      const x = i * cols.step, y = waterLevel + waterH[i];
      if (cols[i].top <= y) { started = false; continue; }
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawFx() {
    fx.forEach(f => {
      const p = f.t / f.life;
      if (f.k === 'flash') {
        ctx.globalAlpha = Math.max(0, 1 - p) * 0.95;
        ctx.fillStyle = f.col || '#fff';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + p * 0.5), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.k === 'shock') {
        const r = f.r0 + (f.r1 - f.r0) * ease(p);
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - p)})`;
        ctx.lineWidth = 2.5 - p;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.2 * (1 - p)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.8, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      } else if (f.k === 'shieldPop') {
        // shield break: expanding glow arc, tinted with turret color
        const a = 1 - p;
        ctx.strokeStyle = hexA(f.col, 0.7 * a);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, 16 + p * 20, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.fillStyle = hexA(f.col, 0.25 * a);
        ctx.beginPath(); ctx.arc(f.x, f.y, 16 + p * 20, Math.PI, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1;
      } else if (f.k === 'plasmaOrb') {
        const r = p < 0.15 ? f.r * (0.3 + (p / 0.15) * 0.7) : f.r;
        if (p < 0.2) {
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = '#ff7a5a';
          ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.globalAlpha = clamp(1 - p * 0.7, 0, 0.85);
        for (let b = 0; b < 7; b++) {
          const a = b / 7 * Math.PI * 2 + gt * (1.5 + b * 0.3);
          const rr = r * (0.25 + 0.45 * Math.abs(Math.sin(gt * (2 + b) + b)));
          const bx = f.x + Math.cos(a) * rr;
          const by = f.y + Math.sin(a) * rr;
          const brr = r * (0.18 + 0.12 * Math.abs(Math.sin(gt * 3 + b * 2)));
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, brr);
          g.addColorStop(0, b % 2 ? 'rgba(255,60,30,0.9)' : 'rgba(20,8,8,0.95)');
          g.addColorStop(1, 'rgba(120,30,20,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(bx, by, brr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (f.k === 'fire') {
        const r = f.r * (0.5 + ease(p) * 0.7);
        const flick = Math.sin(gt * 31 + f.x) * 0.12;
        ctx.globalAlpha = Math.max(0, 1 - p * 1.15);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        if (f.nuke) { g.addColorStop(0, '#fff8e0'); g.addColorStop(0.5, '#ffc23a'); g.addColorStop(1, '#b83a10'); }
        else { g.addColorStop(0, '#ffe8b0'); g.addColorStop(0.55, '#e8802a'); g.addColorStop(1, 'rgba(120,40,10,0)'); }
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, r * (1 + flick), r * (1 - flick * 0.6), 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.k === 'dust' || f.k === 'dustc') {
        const r = f.r * (1 + p * 1.8);
        const col = f.col || M().dustCol;
        ctx.fillStyle = `rgba(${col},${0.34 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (f.k === 'smoke') {
        const r = f.r * (1 + p * 1.2);
        ctx.fillStyle = `rgba(62,58,54,${0.2 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (f.k === 'mush') {
        ctx.globalAlpha = 0.5 * (1 - p * 0.8);
        const rise = ease(p) * f.r * 0.9;
        const capY = f.y - rise;
        ctx.fillStyle = 'rgba(120,105,95,0.55)';
        for (let b = 0; b < 5; b++) {
          const a = b / 5 * Math.PI * 2 + gt * 0.3;
          ctx.beginPath();
          ctx.ellipse(f.x + Math.cos(a) * f.r * 0.4, capY + Math.sin(a) * f.r * 0.12, f.r * (0.55 - b * 0.06), f.r * (0.3 - b * 0.03), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(100,88,78,0.5)';
        ctx.fillRect(f.x - f.r * 0.2, capY, f.r * 0.4, rise + f.r * 0.4);
        ctx.globalAlpha = 1;
      } else if (f.k === 'splash') {
        ctx.strokeStyle = `rgba(200,230,255,${0.7 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + p), Math.PI, Math.PI * 2); ctx.stroke();
      }
    });
  }

  function drawDebris() {
    debris.forEach(d => {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.col;
      ctx.fillRect(-d.s / 2, -d.s / 2, d.s, d.s * 0.8);
      ctx.restore();
    });
  }

  function drawLiquids() {
    liquids.forEach(l => {
      ctx.fillStyle = l.w.col;
      ctx.beginPath(); ctx.arc(l.x, l.y, 2.2, 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawFire() {
    firePatches.forEach(fp => {
      const y = surfaceAt(fp.x);
      const k = clamp(fp.life / 2, 0, 1);
      const h = (6 + Math.abs(Math.sin(gt * 9 + fp.x)) * 6) * k;
      ctx.fillStyle = 'rgba(255,110,20,0.75)';
      ctx.beginPath(); ctx.moveTo(fp.x - 4, y); ctx.lineTo(fp.x, y - h); ctx.lineTo(fp.x + 4, y); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,60,0.8)';
      ctx.beginPath(); ctx.moveTo(fp.x - 2, y); ctx.lineTo(fp.x, y - h * 0.6); ctx.lineTo(fp.x + 2, y); ctx.fill();
    });
  }

  function drawRemains() {
    remains.forEach(rm => {
      const px = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(rm.x + dx), Math.round(rm.y + dy), w, h); };
      ctx.globalAlpha = rm.sunk ? 0.35 : 0.85;
      px(-10, -8, 20, 6, '#1c1a18');
      px(-12, -3, 24, 4, '#12100e');
      px(-3, -12, 6, 4, rm.wreck === 1 ? '#242220' : '#2a2826');
      px(-10, -2, 20, 1, '#3a3632');
      if (rm.wreck === 1) {
        const fl = 4 + Math.abs(Math.sin(gt * 11)) * 5;
        ctx.fillStyle = 'rgba(255,110,20,0.85)';
        ctx.beginPath(); ctx.moveTo(rm.x - 4, rm.y - 12); ctx.lineTo(rm.x, rm.y - 12 - fl); ctx.lineTo(rm.x + 4, rm.y - 12); ctx.fill();
        ctx.fillStyle = 'rgba(255,200,60,0.9)';
        ctx.beginPath(); ctx.moveTo(rm.x - 2, rm.y - 12); ctx.lineTo(rm.x, rm.y - 12 - fl * 0.6); ctx.lineTo(rm.x + 2, rm.y - 12); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }
  function drawSinkers() {
    sinkers.forEach(sk => {
      ctx.globalAlpha = clamp(1 - sk.t / 6, 0.2, 0.9);
      ctx.fillStyle = sk.col;
      ctx.fillRect(Math.round(sk.x - 10), Math.round(sk.y - 10), 20, 7);
      ctx.fillStyle = '#12100e';
      ctx.fillRect(Math.round(sk.x - 12), Math.round(sk.y - 4), 24, 4);
      ctx.globalAlpha = 1;
    });
  }

  // Turrets: pedestal+tower, ground-mounted; shield = pulsing upper-arc glow
  function drawTanks() {
    tanks.forEach((t, i) => {
      if (t.dead) return;
      const dmgF = 1 - t.hp / TANK_HP;
      const hull = mixColor(t.col, '#241a10', dmgF * 0.85);
      const px = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(t.x + dx), Math.round(t.y + dy), w, h); };
      const submerged = t.y > waterLevel + 2;
      ctx.save();
      if (submerged) ctx.globalAlpha = 0.65;
      // pedestal + turret head (no concrete base)
      px(-7, -9, 14, 9, hull);
      px(-7, -9, 14, 1, shade(t.col, 1.4));
      px(-7, -1, 14, 1, shade(hull, 0.55));
      px(-5, -8, 3, 2, shade(hull, 0.75)); // hatch
      px(3, -8, 2, 2, shade(hull, 1.15));  // vent
      px(-5, -14, 10, 6, shade(hull, 0.9));
      px(-5, -14, 10, 1, shade(t.col, 1.2));
      px(-2, -15, 4, 2, shade(hull, 1.05)); // cupola
      const ang = i === 0 ? aim.ang : aiAim;
      const dir = i === 0 ? playerDir() : (tanks[1].x < tanks[0].x ? 1 : -1);
      ctx.translate(t.x, t.y - 12);
      ctx.rotate((dir === 1 ? -ang : ang - 180) * Math.PI / 180);
      ctx.fillStyle = '#6a6f78';
      ctx.fillRect(0, -2, 19, 4);
      ctx.fillStyle = '#4a4e55';
      ctx.fillRect(4, -2, 2, 4);
      ctx.fillRect(15, -2.5, 5, 5);
      ctx.fillStyle = '#8a9099';
      ctx.fillRect(0, -2, 19, 1);
      ctx.restore();
      // shield: pulsing translucent glow, upper half only, above ground
      if (t.shield > 0) {
        const pulse = 0.7 + Math.sin(skyT * 2.4 + t.x) * 0.18;
        const cy = t.y - 12;
        const rr = 24;
        const gg = ctx.createRadialGradient(t.x, cy, rr * 0.45, t.x, cy, rr);
        gg.addColorStop(0, hexA(t.col, 0.16 * pulse));
        gg.addColorStop(0.75, hexA(t.col, 0.3 * pulse));
        gg.addColorStop(1, hexA(t.col, 0));
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(t.x, cy, rr, Math.PI, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hexA(t.col, 0.5 * pulse);
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(t.x, cy, rr * 0.92, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (t.hp < 50 && t.shield === 0) {
        ctx.globalAlpha = 0.28 + 0.2 * Math.sin(skyT * 3 + t.x);
        ctx.fillStyle = '#555';
        ctx.fillRect(t.x + R(-2, 2), t.y - 24 - Math.sin(skyT * 2) * 3, 3, 3);
        ctx.globalAlpha = 1;
      }
      if (t.hp < 25 && t.shield === 0) {
        const fl = 3 + Math.abs(Math.sin(skyT * 9)) * 3;
        ctx.fillStyle = '#ff6a00';
        ctx.beginPath(); ctx.moveTo(t.x - 3, t.y - 14); ctx.lineTo(t.x, t.y - 14 - fl); ctx.lineTo(t.x + 3, t.y - 14); ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(t.x - 1.5, t.y - 14); ctx.lineTo(t.x, t.y - 14 - fl * 0.6); ctx.lineTo(t.x + 1.5, t.y - 14); ctx.fill();
      }
    });
  }
  function mixColor(h1, h2, k) {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    return `rgb(${Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k)},${Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k)},${Math.round((a & 255) * (1 - k) + (b & 255) * k)})`;
  }
  function shade(c, k) {
    let r, g, b;
    if (c[0] === '#') { const n = parseInt(c.slice(1), 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
    else { const m = c.match(/\d+/g); r = +m[0]; g = +m[1]; b = +m[2]; }
    return `rgb(${clamp(Math.round(r * k), 0, 255)},${clamp(Math.round(g * k), 0, 255)},${clamp(Math.round(b * k), 0, 255)})`;
  }

  function drawShot(p) {
    if (!p || p.dead) return;
    p.trail.forEach((pt, i) => {
      const a = i / p.trail.length * 0.35;
      ctx.fillStyle = `rgba(200,195,190,${a})`;
      ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
    });
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.w.type === 'roller' ? p.rot : Math.atan2(p.vy, p.vx));
    drawProjectileShape(ctx, p.w);
    ctx.restore();
  }
  function drawProjectileShape(c, w) {
    c.fillStyle = w.col || '#d8d8d8';
    switch (w.shape) {
      case 'rocket':
        c.fillRect(-6, -2, 10, 4);
        c.fillStyle = '#b03a2a';
        c.beginPath(); c.moveTo(4, -2); c.lineTo(8, 0); c.lineTo(4, 2); c.fill();
        c.beginPath(); c.moveTo(-6, -2); c.lineTo(-9, -4); c.lineTo(-6, 0); c.fill();
        c.beginPath(); c.moveTo(-6, 2); c.lineTo(-9, 4); c.lineTo(-6, 0); c.fill();
        break;
      case 'bomb':
        c.beginPath(); c.ellipse(0, 0, 5, 7, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#6a6a6a';
        c.fillRect(-1.5, -9, 3, 4);
        break;
      case 'mirv':
        c.beginPath(); c.moveTo(-6, -4); c.lineTo(6, 0); c.lineTo(-6, 4); c.closePath(); c.fill();
        c.fillStyle = '#fff';
        c.fillRect(-1, -1, 2, 2);
        break;
      case 'cluster':
        c.beginPath();
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; c.arc(Math.cos(a) * 3, Math.sin(a) * 3, 2, 0, Math.PI * 2); }
        c.fill();
        break;
      case 'ball':
        c.beginPath(); c.arc(0, 0, 4.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.beginPath(); c.arc(-1.5, -1.5, 2, 0, Math.PI * 2); c.fill();
        break;
      case 'canister':
        c.fillRect(-4, -3, 8, 6);
        c.fillStyle = '#333';
        c.fillRect(-4, -3, 2, 6);
        break;
      case 'drill':
        c.beginPath(); c.moveTo(-7, 0); c.lineTo(2, -3.5); c.lineTo(2, 3.5); c.closePath(); c.fill();
        c.fillStyle = '#666';
        c.fillRect(2, -1.5, 5, 3);
        break;
      default:
        c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill();
    }
  }

  function drawOffscreenMarks() {
    [shot, ...subshots].filter(p => p && !p.dead && p.y < -8).forEach(p => {
      const x = clamp(p.x, 16, Wc - 16);
      ctx.fillStyle = p.w.col || '#fff';
      ctx.beginPath(); ctx.moveTo(x, 24); ctx.lineTo(x - 6, 34); ctx.lineTo(x + 6, 34); ctx.closePath(); ctx.fill();
      ctx.font = 'bold 9px Orbitron, monospace';
      ctx.fillText(`${Math.round(-p.y / 10)}`, x + 9, 33);
    });
  }

  function drawWindParts() {
    windParts.forEach(p => {
      const sw = Math.sin(p.ph);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.kind === 'leaf' ? sw * 0.6 : 0);
      if (p.kind === 'leaf') {
        ctx.fillStyle = `rgba(140,190,110,${p.a})`;
        ctx.beginPath(); ctx.ellipse(0, 0, p.s * 2.2, p.s, sw * 0.5, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'sand') {
        ctx.fillStyle = `rgba(222,190,130,${p.a})`;
        ctx.fillRect(-p.s * 0.6, -p.s * 0.35, p.s * 1.2, p.s * 0.7);
      } else if (p.kind === 'snow') {
        ctx.fillStyle = `rgba(255,255,255,${p.a})`;
        ctx.beginPath(); ctx.arc(0, 0, p.s * 0.55, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(130,125,120,${p.a})`;
        ctx.fillRect(-p.s * 0.4, -p.s * 0.4, p.s * 0.8, p.s * 0.8);
      }
      ctx.restore();
    });
  }

  function drawAim() {
    const t = tanks[0];
    const dir = playerDir();
    const rad = aim.ang * Math.PI / 180;
    const pos = { x: t.x + Math.cos(rad) * 18 * dir, y: t.y - 12 - Math.sin(rad) * 18 };
    const vel = { vx: Math.cos(rad) * aim.pow * (VMAX / 100) * dir, vy: -Math.sin(rad) * aim.pow * (VMAX / 100) };
    const dt = 1 / 60;
    let apex = null;
    const ink = indCol();
    for (let i = 0; i < 140; i++) {
      integrate(pos, vel, 0, dt);
      if (!apex || pos.y < apex.y) apex = { x: pos.x, y: pos.y };
      if (i % 6 === 0) {
        ctx.globalAlpha = 1 - i / 180;
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.fillStyle = ink;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 2.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (pos.x < 0 || pos.x > Wc || pos.y > Hc) break;
      if (pos.y >= surfaceAt(pos.x)) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.fillStyle = ink;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
    }
    if (apex && Math.abs(wind) > 0.8) {
      const ch = wind < 0 ? '‹' : '›';
      ctx.font = 'bold 13px Orbitron, monospace';
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(ch.repeat(Math.round(Math.abs(wind))), apex.x - 14, apex.y - 10);
      ctx.fillStyle = indColHi();
      ctx.fillText(ch.repeat(Math.round(Math.abs(wind))), apex.x - 14, apex.y - 10);
    }
  }

  function drawHUD() {
    const w = ARSENAL[cur];
    $('.sc-ang').textContent = Math.round(aim.ang);
    $('.sc-pow').textContent = Math.round(aim.pow);
    $('.sc-wname').textContent = w.name;
    const a = $('.sc-ammo');
    a.textContent = w.ammo === Infinity ? '∞' : ammoInv[w.key];
    a.className = 'sc-ammo' + (w.ammo === Infinity ? '' : ammoInv[w.key] <= 1 ? ' critical' : ' limited');
    $('.sc-round').textContent = `${round}/${ROUNDS_MAX}`;
    $('.sc-wins').textContent = wins;
    $('.sc-score').textContent = score;
    $('.sc-you').textContent = `${biomeLabel()}: вы${tanks[0] && tanks[0].shield > 0 ? ' 🛡' : ''}`;
    $('.sc-enemy').textContent = `Враг${tanks[1] && tanks[1].shield > 0 ? ' 🛡' : ''}`;
    $('.sc-lasthit').textContent = lastHitInfo || '';
    const strength = Math.round(Math.abs(wind));
    const ch = wind < 0 ? '‹' : '›';
    const light = isDayT();
    const arrowEl = $('.sc-windarrow');
    arrowEl.textContent = ch.repeat(Math.max(1, strength));
    const wc = w.wind > 0.45 ? (light ? '#a03030' : '#ff6a7a') : w.wind > 0.2 ? (light ? '#9a6a00' : '#f1c40f') : (light ? '#1b3f8f' : '#00d4ff');
    arrowEl.style.color = wc;
    $('.sc-windval').style.color = wc;
    $('.sc-windval').textContent = Math.abs(wind).toFixed(1);
    const lbl = overlay.querySelector('.sc-windbar span:last-child');
    if (lbl) lbl.style.color = light ? 'rgba(20,25,40,0.75)' : 'rgba(139,144,154,0.9)';
  }

  // ================= UI =================
  function build() {
    if (overlay) return;
    const css = document.createElement('style');
    css.textContent = `
      .sc-overlay { position: fixed; inset: 0; z-index: 3000; background: rgba(5,7,10,0.92); display: none; align-items: center; justify-content: center; }
      .sc-overlay.show { display: flex; }
      .sc-wrap { position: relative; width: 92vw; height: 92vh; border: 1px solid var(--accent); border-radius: var(--radius); overflow: hidden; background: #03050a; }
      .sc-close { position: absolute; right: 10px; top: 10px; z-index: 5; width: 34px; height: 34px; background: var(--panel-light); border: 1px solid var(--pink); color: var(--pink); border-radius: 6px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
      .sc-close:hover { background: var(--pink); color: var(--bg); }
      .sc-hud { position: absolute; left: 0; right: 0; top: 0; z-index: 4; display: flex; gap: 10px 14px; align-items: center; padding: 6px 52px 6px 12px; font-family: 'Orbitron', monospace; font-size: 11px; color: var(--text-dim); text-shadow: 0 0 4px #000; pointer-events: none; flex-wrap: wrap; }
      .sc-hud b { color: var(--accent); }
      .sc-hud .sc-lasthit { color: var(--yellow); max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sc-wpn { pointer-events: auto; cursor: pointer; border: 1px solid var(--border); padding: 2px 8px; border-radius: 4px; color: var(--text); background: rgba(5,7,10,0.7); display: flex; gap: 6px; align-items: center; }
      .sc-wpn:hover { border-color: var(--accent); }
      .sc-wpn .sc-ammo { color: var(--green); } .sc-wpn .sc-ammo.limited { color: var(--yellow); } .sc-wpn .sc-ammo.critical { color: var(--pink); }
      .sc-helpbtn { pointer-events: auto; cursor: pointer; color: var(--text-dim); border: 1px solid var(--border); border-radius: 4px; padding: 2px 8px; background: rgba(5,7,10,0.7); }
      .sc-helpbtn:hover { color: var(--accent); border-color: var(--accent); }
      canvas.sc-cv { display: block; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
      .sc-help { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 6; background: var(--panel); border: 1px solid var(--accent); border-radius: 10px; padding: 20px 24px; max-width: 500px; font-size: 12px; line-height: 1.8; color: var(--text); display: none; max-height: 80vh; overflow-y: auto; }
      .sc-help.show { display: block; }
      .sc-help h4 { color: var(--accent); margin-bottom: 10px; } .sc-help h5 { margin: 12px 0 4px; }
      .sc-help td { padding: 2px 8px; } .sc-help td:first-child { color: var(--accent); font-family: monospace; white-space: nowrap; }
      .sc-lives { position: absolute; left: 12px; bottom: 8px; z-index: 4; display: flex; gap: 16px; font-family: 'Orbitron', monospace; font-size: 11px; pointer-events: none; }
      .sc-lives .sc-you { color: var(--green); } .sc-lives .sc-enemy { color: var(--pink); }
      .sc-windbar { position: absolute; right: 52px; top: 6px; z-index: 4; pointer-events: none; display: flex; align-items: center; gap: 8px; font-family: 'Orbitron', monospace; font-size: 14px; color: var(--text-dim); }
      .sc-windarrow { font-size: 20px; letter-spacing: -2px; }
      .sc-over { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 8; background: var(--panel); border: 1px solid var(--accent); border-radius: 10px; padding: 24px 28px; min-width: 320px; max-width: 90%; max-height: 85vh; overflow-y: auto; display: none; text-align: center; }
      .sc-over.show { display: block; }
      .sc-over h3 { color: var(--accent); margin-bottom: 10px; font-size: 18px; }
      .sc-over .sc-over-res { margin-bottom: 14px; font-size: 13px; }
      .sc-rectab { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
      .sc-rectab th { color: var(--accent); border-bottom: 1px solid var(--border); padding: 4px 6px; text-align: left; }
      .sc-rectab td { padding: 3px 6px; border-bottom: 1px solid var(--border); }
      .sc-rectab tr.me td { color: var(--yellow); }
      .sc-rectab tr.me { animation: sc-me 1.2s ease-in-out infinite; }
      @keyframes sc-me { 0%, 100% { background: transparent; } 50% { background: rgba(241,196,15,0.15); } }
      .sc-over button { margin: 0 6px; padding: 8px 18px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text); cursor: pointer; font-size: 12px; }
      .sc-over button:hover { border-color: var(--accent); color: var(--accent); }
      .sc-wmenu { position: absolute; z-index: 7; background: var(--panel); border: 1px solid var(--accent); border-radius: 8px; padding: 4px; display: none; }
      .sc-wmenu.show { display: block; }
      .sc-wmenu .sc-witem { display: flex; gap: 8px; align-items: center; padding: 4px 8px; border-radius: 5px; cursor: pointer; font-size: 12px; color: var(--text); }
      .sc-wmenu .sc-witem:hover { background: var(--panel-light); }
      .sc-wmenu .sc-witem.sel { background: var(--accent); color: var(--bg); }
      .sc-wmenu .sc-witem canvas { flex-shrink: 0; }
      .sc-wmenu .sc-witem .num { color: var(--accent); font-family: monospace; width: 12px; }
      .sc-wmenu .sc-witem.sel .num { color: var(--bg); }
      .sc-wmenu .sc-witem .cnt { margin-left: auto; color: var(--text-dim); font-size: 10px; min-width: 18px; text-align: right; }
      .sc-wmenu .sc-witem.noammo { opacity: 0.35; cursor: not-allowed; }
    `;
    document.head.appendChild(css);
    overlay = document.createElement('div');
    overlay.className = 'sc-overlay';
    overlay.innerHTML = `
      <div class="sc-wrap">
        <button class="sc-close" title="Ядерный выход">☢</button>
        <div class="sc-hud">
          <span>Угол <b class="sc-ang"></b>°</span>
          <span>Сила <b class="sc-pow"></b></span>
          <span class="sc-wpn"><span class="sc-wname"></span><span class="sc-ammo"></span></span>
          <span class="sc-helpbtn">?</span>
          <span>Раунд <b class="sc-round"></b></span>
          <span>Побед <b class="sc-wins"></b></span>
          <span>Счёт <b class="sc-score"></b></span>
          <span class="sc-lasthit"></span>
        </div>
        <div class="sc-windbar"><span class="sc-windarrow"></span><span class="sc-windval"></span><span style="font-size:11px">ветер</span></div>
        <div class="sc-wmenu"></div>
        <canvas class="sc-cv"></canvas>
        <div class="sc-lives"><span class="sc-you"></span><span class="sc-enemy"></span></div>
        <div class="sc-help">
          <h4>Scorched Earth</h4>
          <table>
            <tr><td>Drag / свайп</td><td>прицел: вертикаль — угол, горизонталь — сила</td></tr>
            <tr><td>Колесо / ↑↓ / ←→</td><td>сила / угол ствола</td></tr>
            <tr><td>Space / клик / тап</td><td>огонь</td></tr>
            <tr><td>1–9, 0 / W / клик по оружию</td><td>выбор оружия</td></tr>
            <tr><td>Esc / ☢ / клик мимо</td><td>выход (☢ — всё взрывается)</td></tr>
          </table>
          <h5>Как читать мир</h5>
          <div style="color:var(--text-dim);font-size:11px">
            5 раундов, боезапас на всю игру. Выстрелы по очереди, первый — случайный.
            У туррелей защитный купол: первый удар снимает его, дальше — корпус.
            Прицел — без ветра, поправка за вами. Вода живёт от музыки (CORS-станции).
          </div>
          <h5>Оружие</h5>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:11px">
            <div>1 Ракета 38hp ∞</div><div>2 Фанки ×3</div>
            <div>3 Смерть 90hp ×2</div><div>4 Ядерный ×1</div>
            <div>5 Плазма 55hp ×2</div><div>6 Напалм ×2</div>
            <div>7 Роллер 50hp ×3</div><div>8 Копатель ×3</div>
            <div>9 Грязь ×3</div><div>0 МИРВ ×2</div>
          </div>
        </div>
        <div class="sc-over">
          <h3 class="sc-over-title"></h3>
          <div class="sc-over-res"></div>
          <table class="sc-rectab"></table>
          <button class="sc-again">⟳ Заново</button><button class="sc-over-close">Закрыть</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    cv = overlay.querySelector('canvas.sc-cv');
    ctx = cv.getContext('2d');
    const helpEl = overlay.querySelector('.sc-help');
    const wmenu = overlay.querySelector('.sc-wmenu');
    $('.sc-helpbtn').onclick = (e) => { e.stopPropagation(); helpEl.classList.toggle('show'); helpOpen = !helpOpen; };
    helpEl.onclick = (e) => e.stopPropagation();
    $('.sc-again').onclick = (e) => { e.stopPropagation(); $('.sc-over').classList.remove('show'); start(); };
    $('.sc-over-close').onclick = (e) => { e.stopPropagation(); $('.sc-over').classList.remove('show'); close(false); };
    $('.sc-wpn').onclick = (e) => { e.stopPropagation(); renderWeaponMenu(); wmenu.classList.toggle('show'); };
    wmenu.onclick = (e) => e.stopPropagation();
    document.addEventListener('click', () => wmenu.classList.remove('show'));

    window.addEventListener('resize', resize);
    cv.addEventListener('pointerdown', (e) => {
      if (helpOpen) { helpEl.classList.remove('show'); helpOpen = false; return; }
      if (wmenu.classList.contains('show')) { wmenu.classList.remove('show'); return; }
      if (state !== 'aim' || turn !== 0) return;
      drag = { x: e.clientX, y: e.clientY, ang: aim.ang, pow: aim.pow, moved: false };
      try { cv.setPointerCapture(e.pointerId); } catch {}
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag || state !== 'aim' || turn !== 0) return;
      const dx = e.clientX - drag.x, dy = drag.y - e.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      aim.ang = clamp(drag.ang + dy / 3, 5, 85);
      aim.pow = clamp(drag.pow + Math.abs(dx) / 4, 10, 100);
      draw();
    });
    cv.addEventListener('pointerup', () => { if (drag && !drag.moved && state === 'aim' && turn === 0) fire(); drag = null; });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (state !== 'aim' || turn !== 0) return;
      aim.pow = clamp(aim.pow + (e.deltaY < 0 ? 1 : -1), 10, 100);
      draw();
    }, { passive: false });
    window.addEventListener('keydown', keyH, true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.querySelector('.sc-close').onclick = () => close(true);
  }

  function renderWeaponMenu() {
    const wmenu = overlay.querySelector('.sc-wmenu');
    const chip = overlay.querySelector('.sc-wpn');
    const wrap = overlay.querySelector('.sc-wrap');
    const cr = chip.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    wmenu.style.left = Math.max(4, cr.left - wr.left) + 'px';
    wmenu.style.top = (cr.bottom - wr.top + 4) + 'px';
    wmenu.innerHTML = '';
    ARSENAL.forEach((w, i) => {
      const has = ammoInv[w.key] > 0 || w.ammo === Infinity;
      const item = document.createElement('div');
      item.className = 'sc-witem' + (i === cur ? ' sel' : '') + (has ? '' : ' noammo');
      const mini = document.createElement('canvas');
      mini.width = 26; mini.height = 26;
      const mc = mini.getContext('2d');
      mc.translate(13, 13); mc.rotate(-Math.PI / 4);
      drawProjectileShape(mc, w);
      item.appendChild(mini);
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = (i + 1) % 10;
      item.appendChild(num);
      const nm = document.createElement('span');
      nm.textContent = w.name;
      item.appendChild(nm);
      const cnt = document.createElement('span');
      cnt.className = 'cnt';
      cnt.textContent = w.ammo === Infinity ? '∞' : ammoInv[w.key];
      item.appendChild(cnt);
      item.onclick = (e) => { e.stopPropagation(); if (!has) return; cur = i; wmenu.classList.remove('show'); draw(); };
      wmenu.appendChild(item);
    });
  }

  function resize() {
    if (!overlay) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) { setTimeout(resize, 60); return; }
    const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Wc = r.width; Hc = r.height;
    if (cols) draw();
  }

  function keyH(e) {
    if (!overlay || !overlay.classList.contains('show')) return;
    if (e.key === 'Escape') { close(false); return; }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const idx = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
      if (idx < ARSENAL.length && (ammoInv[ARSENAL[idx].key] > 0 || ARSENAL[idx].ammo === Infinity)) { cur = idx; overlay.querySelector('.sc-wmenu').classList.remove('show'); draw(); }
      return;
    }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','w','W','ц','Ц'].includes(e.key)) e.preventDefault();
    if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') { nextWeapon(); return; }
    if (state !== 'aim' || turn !== 0) return;
    if (e.key === 'ArrowUp') aim.pow = clamp(aim.pow + 1, 10, 100);
    if (e.key === 'ArrowDown') aim.pow = clamp(aim.pow - 1, 10, 100);
    if (e.key === 'ArrowLeft') aim.ang = clamp(aim.ang + 1, 5, 85);
    if (e.key === 'ArrowRight') aim.ang = clamp(aim.ang - 1, 5, 85);
    if (e.key === ' ') { fire(); return; }
    draw();
  }
  function nextWeapon() {
    for (let i = 1; i <= ARSENAL.length; i++) {
      const idx = (cur + i) % ARSENAL.length;
      if (ammoInv[ARSENAL[idx].key] > 0 || ARSENAL[idx].ammo === Infinity) { cur = idx; draw(); return; }
    }
    cur = 0; draw();
  }

  function boot() {
    const zone = document.getElementById('hoverTrigger') || document.getElementById('bgBandit');
    if (!zone) return;
    zone.addEventListener('dblclick', (e) => { e.preventDefault(); open(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.Scorch = { open, close };
})();