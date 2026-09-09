//scorch.world.js part01
// вулкан, лава, вода, снаряды, взрывы, урон/смерть, цикл симуляции
const ARCH = ['hills', 'mountain', 'craterValley', 'mesa', 'island', 'badlands'];
const gauss = (u, c, w, a) => a * Math.exp(-((u - c) / w) * ((u - c) / w));
// live rare events: the sandworm (desert/rust) and the orbital junk rain
let worm = null;
let junks = [];
// 3D-precalc moon system of the planet sky + the round's event plans
let moonSys = null;
let wormPlan = { q: 0, at: [], n: 0 };
let junkPlan = { q: 0, at: [], n: 0 };
// round-relative clock for the event plans
let rgt = 0;
// PROCEDURAL PLANET MASK for the moon-biome skies: a per-round land/ocean
// grid generated on the SPHERE (see genPlanetMask / planetMask) — the ui
// paints the home planet disc from it
let planetMask = null;

// ================= TERRAIN =================
function genSky() {
  stars = [];
  stars.w = Wc;
  genPlanetMask();
  genMoonSys();
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
  cloudCount = 7 + ((Math.random() * 5) | 0);
}

function buildGroundTex() {
  if (!ctx) return;
  const T = 256;
  const c = document.createElement('canvas');
  c.width = T; c.height = T;
  const g = c.getContext('2d');
  const bk = biomeKey();
  g.fillStyle = biome.sub[1];
  g.fillRect(0, 0, T, T);
  const blob = (cx, cy, r, col) => {
    for (let ox = -T; ox <= T; ox += T) for (let oy = -T; oy <= T; oy += T) {
      const gr = g.createRadialGradient(cx + ox, cy + oy, r * 0.15, cx + ox, cy + oy, r);
      gr.addColorStop(0, hexA(col, 0.3));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(cx + ox, cy + oy, r, 0, Math.PI * 2); g.fill();
    }
  };
  for (let i = 0; i < 12; i++) blob(R(0, T), R(0, T), R(30, 85), Math.random() < 0.5 ? biome.sub[0] : biome.sub[2]);
  for (let i = 0; i < 26; i++) blob(R(0, T), R(0, T), R(10, 24), Math.random() < 0.6 ? biome.sub[0] : biome.sub[2]);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = Math.random() < 0.5 ? biome.sub[0] : biome.sub[2];
    g.globalAlpha = R(0.25, 0.7);
    g.fillRect(R(0, T), R(0, T), R(1, 3), R(1, 3));
  }
  g.globalAlpha = 1;
  if (bk === 'desert' || bk === 'rust') {
    g.strokeStyle = bk === 'rust' ? 'rgba(80,35,25,0.45)' : 'rgba(122,92,52,0.4)';
    g.lineWidth = 1;
    g.beginPath();
    const k = 4;
    for (let y = 6; y < T - 6; y += 11) {
      g.moveTo(0, y);
      for (let x = 0; x <= T; x += 8) g.lineTo(x, y + Math.sin(x * Math.PI * 2 * k / T + y * 0.7) * 2.5);
    }
    g.stroke();
  } else if (bk === 'volcanic' || bk === 'xeno') {
    g.strokeStyle = bk === 'xeno' ? 'rgba(24,10,36,0.7)' : 'rgba(12,10,9,0.7)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 14; i++) {
      let x = R(16, T - 16), y = R(16, T - 16);
      g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x = clamp(x + R(-10, 10), 12, T - 12); y = clamp(y + R(3, 10), 12, T - 12); g.lineTo(x, y); }
    }
    g.stroke();
    if (bk === 'xeno') {
      g.fillStyle = 'rgba(110,225,255,0.5)';
      for (let i = 0; i < 46; i++) g.fillRect(R(2, T - 3), R(2, T - 3), 1.5, 1.5);
    }
  } else if (bk === 'green') {
    g.strokeStyle = 'rgba(40,70,25,0.6)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 160; i++) {
      const x = R(2, T - 3), y = R(2, T - 3);
      g.moveTo(x, y); g.lineTo(x + R(-1.5, 1.5), y - R(2, 5));
    }
    g.stroke();
  } else if (bk === 'arctic') {
    g.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 120; i++) g.fillRect(R(1, T - 4), R(1, T - 4), R(1, 4), 1);
    g.fillStyle = 'rgba(120,140,160,0.35)';
    for (let i = 0; i < 50; i++) g.fillRect(R(1, T - 4), R(1, T - 4), R(1, 3), R(1, 2));
  } else if (bk === 'ashen') {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 34; i++) {
      const r = R(2, 6);
      g.beginPath(); g.arc(R(4, T - 4), R(4, T - 4), r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(140,140,150,0.25)';
      g.beginPath(); g.arc(R(4, T - 4), R(4, T - 4), r * 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.3)';
    }
  }
  // rusty scrap of the orbital era: every world's soil carries it
  for (let i = 0; i < 24; i++) {
    const bx = R(2, T - 3), by = R(2, T - 3);
    const len = R(5, 15), a = R(0, 6.28);
    g.save();
    g.translate(bx, by);
    g.rotate(a);
    g.fillStyle = Math.random() < 0.5 ? 'rgba(138,69,48,0.8)' : 'rgba(94,44,30,0.8)';
    g.fillRect(-len / 2, -2, len, 4);
    g.fillStyle = 'rgba(200,120,80,0.55)';
    g.fillRect(-len / 2, -2, len, 1.4);
    g.fillStyle = 'rgba(40,20,12,0.5)';
    g.fillRect(len / 2 - 2, -2, 2, 4);
    g.restore();
  }
  groundPat = ctx.createPattern(c, 'repeat');
  if (groundPat.setTransform) {
    try {
      groundPat.setTransform(new DOMMatrix().translate(R(0, T), R(0, T)).rotate(R(2, 9) * (Math.random() < 0.5 ? 1 : -1)));
    } catch (e) {}
  }
}

function genTerrain() {
  seed = (Math.random() * 1e9) | 0;
  S = mulberry32(seed);
  noise = makeNoise(S);
  archetype = ARCH[Math.floor(S() * ARCH.length)];
  biome = BIOMES[BIOME_POOL[Math.floor(S() * BIOME_POOL.length)]];
  // underground levels: only vegetation-free worlds; the cave-capable
  // biomes are 70% of the pool, so a 43% roll there ≈ 30% of ALL rounds
  UNDER = CAVE_BIOMES.includes(biomeKey()) && S() < 0.43 ? 1 : 0;
  if (UNDER) WATER_MODE = 1;
  else WATER_MODE = Math.random() < 0.5 ? 1 : 2;
  genSky();
  volcano = null;
  lavaBits = [];
  driftT = 0;
  buildGroundTex();

  const N = NCOL();
  const sf = clamp(Wc / 900, 0.45, 1);
  const feats = [];
  const addG = (c, w, a, cap) => feats.push([c, w, a, cap]);
  let base = 0.32;
  if (archetype === 'hills') { base = 0.3; for (let k = 0; k < 4; k++) addG(0.1 + S() * 0.8, 0.1 + S() * 0.16, 0.12 + S() * 0.18); }
  if (archetype === 'mountain') { base = 0.16; addG(0.25 + S() * 0.5, 0.08 + S() * 0.06, 0.55 + S() * 0.25); addG(0.2 + S() * 0.6, 0.07 + S() * 0.05, 0.35 + S() * 0.2); for (let k = 0; k < 2; k++) addG(S(), 0.14, 0.12); }
  if (archetype === 'craterValley') { base = 0.55; for (let k = 0; k < 2; k++) { const c = 0.2 + S() * 0.6; addG(c, 0.07 + S() * 0.03, -0.3); addG(c - 0.1, 0.05, 0.16); addG(c + 0.1, 0.05, 0.16); } addG(S(), 0.2, 0.2); }
  if (archetype === 'mesa') { base = 0.24; for (let k = 0; k < 3; k++) { const c = 0.15 + S() * 0.7, w = 0.06 + S() * 0.05, a = 0.35 + S() * 0.3; addG(c, w * 2.2, a, 'cap'); } }
  if (archetype === 'island') { base = 0.08; addG(0.3 + S() * 0.15, 0.09, 0.55); addG(0.6 + S() * 0.15, 0.08, 0.5); }
  if (archetype === 'badlands') { base = 0.34; for (let k = 0; k < 5; k++) addG(S(), 0.07 + S() * 0.05, 0.2 + S() * 0.25); }

  const detail = (archetype === 'badlands' ? 0.1 : archetype === 'mesa' ? 0.03 : 0.05) * (0.55 + 0.45 * sf);
  cols = [];
  for (let i = 0; i < N; i++) {
    const u = i / N;
    let h = base;
    feats.forEach(f => { h += gauss(u, f[0], f[1], f[2]); });
    if (archetype === 'mesa') feats.forEach(f => { if (f[3] === 'cap' && Math.abs(u - f[0]) < f[1]) h = Math.min(h, base + f[2] * 0.92 + 0.04); });
    h += (fbm(u * 6 * sf + 50, 4) - 0.5) * 2 * detail;
    if (archetype === 'badlands') h += (1 - Math.abs(2 * fbm(u * 11 * sf + 90, 3) - 1)) * 0.14;
    h = clamp(h, 0.03, 0.95);
    cols.push({ top: Math.round(Hc * 0.9 - h * Hc * 0.68), surf: 5 + Math.round(noise(u * 40) * 5), burn: 0, melt: 0, h0: 0, h1: 0, sid: 0, lava: 0, lavaT: 0 });
  }
  cols.step = Wc / N;

  if (sf < 0.95) {
    const k = clamp(Math.round((1 - sf) * 34 / cols.step), 2, 16);
    for (let pass = 0; pass < 2; pass++) {
      const src = cols.map(c => c.top);
      let s = 0;
      for (let j = -k; j <= k; j++) s += src[clamp(j, 0, N - 1)];
      for (let i = 0; i < N; i++) {
        cols[i].top = s / (2 * k + 1);
        s += src[clamp(i + k + 1, 0, N - 1)] - src[clamp(i - k, 0, N - 1)];
      }
    }
  }

  if (WATER_MODE === 2) {
    const tops = [];
    for (let i = 4; i < N - 4; i++) tops.push(cols[i].top);
    tops.sort((a, b) => a - b);
    // 78th percentile: the sea keeps its full-width presence but floods
    // only the lowest fifth of the map (the 55th drowned almost half)
    waterLevel = tops[Math.floor(tops.length * 0.78)] + R(0, 8);
  } else if (archetype === 'island') {
    // more island above the waterline — a stock of dry land instead of
    // a ring of barely-poking atoll tips, the sea still rings the shore
    waterLevel = Hc * 0.63;
  } else {
    // lakes sit lower on the screen: fewer flooded valleys, water stays
    // clearly visible in the deepest ones (plus the carved basins below)
    waterLevel = Hc * (0.84 + S() * 0.04);
    const nb = S() < 0.7 ? 1 + (S() < 0.4 ? 1 : 0) : 0;
    for (let b = 0; b < nb; b++) {
      const c = 0.15 + S() * 0.7, w = 0.05 + S() * 0.06;
      for (let i = 0; i < N; i++) {
        const d = Math.abs(i / N - c) / w;
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

  // ============ UNDERGROUND: build the cave ============
  if (UNDER) {
    // the floor relief is RE-CENTRED into a mid-screen band instead of
    // being dumped onto the bottom: the cave ground sits higher, mounds
    // and pits survive as real relief (no flat bottom plane), and the
    // dark water shrinks to the deepest basins
    let fMin = Hc, fMax = 0;
    cols.forEach(c => { if (c.top < fMin) fMin = c.top; if (c.top > fMax) fMax = c.top; });
    const fShift = (Hc * 0.55 - (fMin + fMax) / 2) * 0.7;
    cols.forEach(c => { c.top = clamp(c.top + fShift, Hc * 0.46, Hc - 80); });
    // local dark lakes: the waterline chases the 78th percentile and is
    // pinned ~20px above the deepest pit only — visible water, no floods
    const tops2 = cols.map(c => c.top).sort((a, b) => a - b);
    waterLevel = clamp(tops2[Math.floor(tops2.length * 0.78)] + 8, Hc * 0.5, Math.max(Hc * 0.52, tops2[tops2.length - 1] - 20));
    // the CEILING: a low inverted landscape spanning the full width,
    // with occasional stalactite spikes; no volcanoes live up there
    ceil = [];
    for (let i = 0; i < N; i++) {
      const u = i / N;
      let h = 44 + fbm(u * 5 + 200, 4) * 58;
      const spike = noise(u * 26 + 33);
      if (spike > 0.78) h += (spike - 0.78) * 190 * noise(u * 60 + 7);
      ceil.push(clamp(Math.round(h), 30, Math.min(190, Hc * 0.42)));
    }
    // fossil vents in the ceiling: a blast near one pours fire and earth
    // DOWN (see hitVents / eruptVent)
    caveVents = [];
    const nv = 2 + (S() < 0.6 ? 1 : 0);
    for (let k = 0; k < nv; k++) {
      const ci = clamp(Math.round(R(0.1, 0.9) * N), 12, N - 13);
      const w = R(24, 54);
      caveVents.push({ x0: ci * cols.step - w / 2, x1: ci * cols.step + w / 2, cix: ci, state: 0, waves: 0 });
    }
    // STATIC LIGHTING: crystals on the walls + SWEEPING spot beams on the
    // ceiling. Crystal radii are BAKED at placement (clipped to the rock
    // faces); the beams tilt ±sw around the vertical at their own speed
    // and find their target per frame (see drawCaveShade). Crystals come
    // in varied shapes (slim needles / fat prisms / squat druses / forked
    // twins), sizes and facet counts — geometry baked at placement
    caveLights = [];
    const ncr = 9 + (S() * 5 | 0);
    const CRY_SHAPES = ['needle', 'prism', 'druse', 'twin'];
    for (let k = 0; k < ncr; k++) {
      const i = clamp(Math.round(R(0.05, 0.95) * N), 4, N - 5);
      const x = i * cols.step;
      const onCeil = S() < 0.5;
      const y = onCeil ? ceil[i] + R(4, 10) : cols[i].top - R(4, 10);
      const room = onCeil ? cols[i].top - y : y - ceil[i];
      const r = Math.min(R(60, 150), room * 1.25);
      const shape = CRY_SHAPES[(S() * CRY_SHAPES.length) | 0];
      const grow = shape === 'needle' ? R(7, 15) : shape === 'prism' ? R(4, 8) : shape === 'druse' ? R(2.5, 4.5) : R(4, 7);
      caveLights.push({ x, y, r, k: 'cry', col: CRYSTAL_COLS[(S() * CRYSTAL_COLS.length) | 0], ph: R(0, 6.28), fl: R(0.5, 1.6), shape, g: grow, rot: R(-0.4, 0.4), heads: shape === 'twin' || shape === 'druse' ? 2 + (S() * 3 | 0) : 1 });
    }
      const nbm = 1 + (S() * 5 | 0);
      for (let k = 0; k < nbm; k++) {
        // lamps sit in even slots with jitter, so the pack sweeps the FULL
        // floor width again and again; the wide tilt angles reach shore to
        // shore from any lamp. The sweep is slow (a ~35-70 s period), and
        // each lamp burns its own random colour temperature — 2700K amber
        // to 6000K near-white, baked into `col` as an 'r,g,b' triplet
        const i = clamp(Math.round(((k + 0.5) / nbm + R(-0.09, 0.09)) * N), 10, N - 11);
        const x = i * cols.step;
        const kt = R(0, 1);
        const bcol = `255,${Math.round(178 + 62 * kt)},${Math.round(96 + 130 * kt)}`;
        caveLights.push({ x, y: ceil[i] - 2, fy: cols[i].top, k: 'beam', w: R(14, 24), col: bcol, ph: R(0, 6.28), sw: R(0.62, 1.15), spd: R(0.09, 0.18) });
      }
  } else {
    ceil = null; caveVents = []; caveLights = [];
  }

  // the volcano: on volcanic + the two alien rock worlds, on the FLOOR —
  // in a cave it sits on the cave bottom (the ceiling never gets one)
  if (VOLC_BIOMES.includes(biomeKey())) {
    let hiI = 8;
    for (let i = 10; i < N - 10; i++) if (cols[i].top < cols[hiI].top) hiI = i;
    const vr = clamp(Wc * 0.075, 36, 66);
    const vx = hiI * cols.step;
    const i0 = clamp(Math.round((vx - vr) / cols.step), 0, N - 1);
    const i1 = clamp(Math.round((vx + vr) / cols.step), 0, N - 1);
    for (let i = i0; i <= i1; i++) {
      const dx = Math.abs(i * cols.step - vx) / vr;
      if (dx < 1) cols[i].top += (1 - dx * dx) * vr * 0.3;
    }
    const vy = surfaceAt(vx);
    volcano = { x: vx, y: vy, r: vr, coneBot: vy + Hc * 0.17, power: 0.35, doused: 0, craters: [] };
    // in a cave the cone must never punch through the ceiling
    if (UNDER && ceil) {
      const ci = clamp(Math.round(vx / cols.step), 0, N - 1);
      const room = ceil[ci] - volcano.coneBot;
      if (room < 30) volcano.coneBot = Math.min(volcano.y + vr, ceil[ci] - 30);
    }
  }

  // combustible / explosive deposits — the biome's own seams on the
  // surface, plus the shared FOSSIL seams in the caves (CAVE_FUEL look).
  // Elongated RAGGED lenses (~3-6:1) built as a chain of stretched
  // jittered ellipses that pinch out toward the tips; buried DEEP enough
  // to need 2-3 missile digs (placeTanks sinks the seams under a turret
  // deeper still); rare GIANT seams sit at great depth and go up
  // catastrophically. The oval body (cx/cy/ra/rb/vol/dep) is the ONE
  // hit-test shape every heat source uses (heatHits / igniteAt)
  pockets = [];
  if (UNDER || biome.fuel) {
    const npk = 2 + (S() < 0.7 ? 1 : 0) + (S() < 0.45 ? 1 : 0);
    for (let k = 0; k < npk; k++) {
      for (let a = 0; a < 10; a++) {
        const cx = R(Wc * 0.10, Wc * 0.90);
        if (volcano && Math.abs(cx - volcano.x) < volcano.r + 40) continue;
        const cy0 = surfaceAt(cx);
        if (cy0 > waterLevel - 30) continue;
        if (pockets.some(pk => cx > pk.x0 - 30 && cx < pk.x1 + 30)) continue;
        const giant = S() < 0.035;
        const mega = giant || S() < 0.1;
        // the seam width is PROPORTIONAL to the screen — the look of a
        // narrow-start scene stretched 4x: very elongated layered lenses;
        // height and burial depth stay absolute, like a real seam
        const w = giant ? Wc * R(0.68, 0.88) : mega ? Wc * R(0.44, 0.66) : Wc * R(0.22, 0.4);
        const h = clamp(w * R(0.11, 0.23), 10, giant ? 37 : mega ? 31 : 20);
        const depth = giant ? R(95, 135) : mega ? R(55, 85) : R(34, 58);
        let y0 = cy0 + depth;
        let y1 = Math.min(y0 + h, Hc - 8);
        if (y1 - y0 < (giant ? 24 : 9)) continue;
        let hh = y1 - y0;
        // flank cover on slopes: the seam must hide behind the hillside
        // rock, not only under the topsoil — measure the thinnest rock
        // between the lens and the surface across its whole span and
        // sink the seam until the flank cover too is ~20px
        let sink = 0;
        const cyc = y0 + hh / 2;
        for (let sx = cx - w / 2; sx <= cx + w / 2; sx += cols.step) {
          const t = clamp((sx - cx) / (w / 2), -1, 1);
          const edge = cyc - (hh / 2) * Math.sqrt(Math.max(0, 1 - t * t));
          sink = Math.max(sink, 20 + surfaceAt(sx) - edge);
        }
        if (sink > 0) {
          y0 += sink;
          y1 = Math.min(y0 + hh, Hc - 8);
          if (y1 - y0 < (giant ? 24 : 9)) continue;
          hh = y1 - y0;
        }
        // visual blobs: a chain of stretched, jittered ellipses along the
        // seam's own wavy axis, tapering (pinching out) toward the tips
        const bl = [];
        const nb = Math.min(32, 5 + ((w / 20) | 0));
        const wav = R(-0.07, 0.07);
        for (let q = 0; q < nb; q++) {
          const t = (q + 0.5) / nb * 2 - 1;
          const taper = Math.sqrt(Math.max(0, 1 - t * t));
          bl.push([
            t * 0.44 + R(-0.05, 0.05),
            wav * t + R(-0.14, 0.14),
            (0.13 + R(0, 0.11)) * (0.45 + taper * 0.75),
            (0.34 + R(0, 0.4)) * (0.3 + taper * 0.8)
          ]);
        }
        pockets.push({ x0: cx - w / 2, x1: cx + w / 2, y0, y1, cx, cy: y0 + hh / 2, ra: w / 2, rb: hh / 2, vol: w * hh, dep: depth + sink, bl, mega, t: 0, state: 0, mode: 0, dur: clamp(w * hh / 170, 2.5, 9) });
        break;
      }
    }
  }
}

// ================= SURFACE QUERIES =================
const colAt = (x) => cols[clamp(Math.round(x / cols.step), 0, cols.length - 1)];
function surfaceAt(x) { return colAt(x).top; }
// the cave ceiling edge (y of the rock bottom); -999 on surface levels
const ceilAt = (x) => ceil ? ceil[clamp(Math.round(x / cols.step), 0, ceil.length - 1)] : -999;
function slopeAt(x) { const i = clamp(Math.round(x / cols.step), 0, cols.length - 1); const a = cols[clamp(i - 1, 0, cols.length - 1)].top, b = cols[clamp(i + 1, 0, cols.length - 1)].top; return (b - a) / (2 * cols.step); }
function inVoid(x, y) { const c = colAt(x); return c.h1 > 0 && y >= c.h0 - 2 && y < c.h1; }
function shotBlocked(x, y, ownSid) {
  const ci = clamp(Math.round(x / cols.step), 0, cols.length - 1);
  // the cave ceiling is solid rock: shots detonate on its underside
  if (UNDER && ceil && y < ceil[ci] - 1) return true;
  const c = cols[ci];
  if (c.lava > 1.5 && y >= c.top - c.lava) return true;
  if (y < c.top) return false;
  if (c.h1 > 0 && y >= c.h0 - 2 && y < c.h1) return ownSid !== undefined && c.sid === ownSid;
  return true;
}
function floorAt(x, y) {
  const c = colAt(x);
  if (c.h1 > 0) {
    if (y >= c.h0 - 1) return c.h1;
    if (c.h0 <= c.top + 2) return c.h1;
  }
  return c.top;
}
function inVolcCone(x, y) {
  if (!volcano) return false;
  if (y < volcano.y + 6 || y > volcano.coneBot) return false;
  if (y < surfaceAt(x)) return false;
  const dy = y - volcano.y;
  return Math.abs(x - volcano.x) < 5 + dy * 0.5;
}
function coneTopAt(x) { const dx = Math.abs(x - volcano.x); if (dx < 5) return volcano.y; return volcano.y + (dx - 5) * 2; }
function nearVolcano(x, y) {
  return !!volcano && Math.abs(x - volcano.x) < volcano.r * 1.3 && y > volcano.y - volcano.r * 1.8 && y < volcano.coneBot + 50;
}

// ================= VOLCANO =================
function volcScan() {
  if (!volcano) return;
  const N = cols.length;
  const cr = [];
  const i0 = clamp(Math.round((volcano.x - 60) / cols.step), 1, N - 2);
  const i1 = clamp(Math.round((volcano.x + 60) / cols.step), 1, N - 2);
  for (let i = i0; i <= i1; i += 2) {
    const x = i * cols.step;
    const ct = coneTopAt(x);
    if (ct > volcano.coneBot) continue;
    if (cols[i].top >= ct) {
      const sl = (cols[clamp(i + 1, 0, N - 1)].top - cols[clamp(i - 1, 0, N - 1)].top) / (2 * cols.step);
      const nx = -sl, ny = -1;
      const l = Math.hypot(nx, ny) || 1;
      cr.push({ x, y: cols[i].top, nx: nx / l, ny: ny / l, i });
    }
  }
  const ex = volcano.extra || [];
  if (cr.length > 12) {
    const stride = Math.ceil(cr.length / 12);
    volcano.craters = cr.filter((c, idx) => idx % stride === 0).concat(ex);
  } else {
    volcano.craters = cr.concat(ex);
  }
}
function emitLavaFrom(cr, burst) {
  if (lavaBits.length > 55) return;
  const far = Math.random() < (burst ? 0.12 : 0.03);
  const sp = (far ? R(150, 240) : R(45, 115)) * (0.8 + volcano.power * 0.6) * (burst ? 1.2 : 1);
  const jx = cr.nx + R(-0.35, 0.35), jy = cr.ny - R(0, 0.3);
  lavaBits.push({
    x: cr.x + R(-3, 3), y: cr.y - 3,
    vx: jx * sp + wind * 3, vy: jy * sp,
    t: 0, life: R(1.8, 3.2), s: R(1.6, 3)
  });
}
function spawnLFlow(cr) {
  if (fx.length > 340) return;
  const sl = slopeAt(cr.x);
  const dir = sl > 0.02 ? 1 : sl < -0.02 ? -1 : (Math.sign(cr.nx) || 1);
  const y0 = surfaceAt(cr.x) - 2;
  fx.push({ k: 'lflow', x: cr.x, y: y0, vx: dir * R(6, 12), t: 0, life: R(9, 15), s: R(2.5, 4), burnT: 0, tp: 0, trail: [{ x: cr.x, y: y0 }] });
}
function nearCrater(x, y) {
  if (!volcano) return null;
  for (let k = 0; k < volcano.craters.length; k++) {
    const cr = volcano.craters[k];
    if (Math.abs(cr.x - x) < 16 && Math.abs(cr.y - y) < 18) return cr;
  }
  return null;
}
function volcAgitate(x, y, amt) {
  if (!volcano || !nearVolcano(x, y)) return;
  if (volcano.doused) {
    if (amt < 0.45) return;
    volcano.doused = 0;
  }
  volcano.power = clamp(volcano.power + amt, 0, 1.3);
  let v = null, bd = 1e9;
  volcano.craters.forEach(vv => { const d = Math.hypot(vv.x - x, vv.y - y); if (d < bd) { bd = d; v = vv; } });
  if (v) {
    const n = 5 + Math.round(amt * 30);
    for (let k = 0; k < n; k++) emitLavaFrom(v, true);
    fx.push({ k: 'flash', x: v.x, y: v.y - 10, r: 30, t: 0, life: 0.16, col: `rgb(${lav().glow})` });
  }
  sfx(0.8);
  shake = Math.min(10, shake + 3);
}
function volcBreach(x, y, w) {
  const t = w.type;
  const meltShaft = (halfW) => {
    const a = clamp(Math.round((x - halfW) / cols.step), 1, cols.length - 2);
    const b = clamp(Math.round((x + halfW) / cols.step), 1, cols.length - 2);
    for (let i = a; i <= b; i++) {
      const ct = coneTopAt(i * cols.step);
      if (ct <= volcano.coneBot && cols[i].top < ct + 1) {
        cols[i].top = ct + 1;
        cols[i].melt = 1; cols[i].surf = 0;
      }
    }
    dirtyA = Math.min(dirtyA, a); dirtyB = Math.max(dirtyB, b);
  };
  if (t === 'digger' || t === 'plasma') {
    fx.push({ k: 'flash', x, y, r: 18, t: 0, life: 0.12, col: `rgb(${lav().glow})` });
    fx.push({ k: 'fire', x, y, r: 14, t: 0, life: 0.5 });
    spawnWisps(x, y, 5);
    meltShaft(4);
    volcano.power = clamp(volcano.power + 0.25, 0, 1.3);
    volcano.doused = 0;
    if (t === 'digger') {
      boomsAt(x, y, 30, 'missile', 30, true);
      const ci = clamp(Math.round(x / cols.step), 0, cols.length - 1);
      const ncr = { x, y, nx: 0, ny: -1, i: ci, tun: 1 };
      (volcano.extra = volcano.extra || []).push(ncr);
      volcano.burst = ncr;
    }
    sfx(0.5);
  } else if (t === 'dirt') {
    const [ca, cb] = blastRange(x, 26);
    slump(ca, cb, 8);
    craterMask(x, surfaceAt(x), 22, 'blast', 'ellipse');
    spawnDirtFall(x, 22);
    volcano.doused = gt + 6.5;
    volcano.craters.forEach(cr => spawnWisps(cr.x, cr.y - 2, 3));
    sfx(0.6);
    shake = Math.min(10, shake + 3);
  } else {
    const fiery = FIERY.includes(t);
    const r = w.r * (fiery ? 1.15 : 1);
    const dmg = Math.round(w.dmg * (fiery ? 2 : 1));
    boomsAt(x, y, r, (t === 'death' || t === 'nuke') ? 'nuke' : t, dmg, false, true);
    if (fiery) {
      fx.push({ k: 'fire', x, y, r: w.r, t: 0, life: 1.2, nuke: true });
      volcAgitate(x, y, 0.5);
    } else {
      volcAgitate(x, y, 0.3);
    }
    meltShaft(9);
    volcano.power = clamp(volcano.power + (fiery ? 0.6 : 0.35), 0, 1.3);
    volcano.doused = 0;
    sfx(1.0);
    shake = Math.min(10, shake + 4);
  }
  volcScan();
  const v = volcano.craters[0];
  if (v) for (let k = 0; k < 10; k++) emitLavaFrom(v, true);
  if (volcano.burst) {
    for (let k = 0; k < 12; k++) emitLavaFrom(volcano.burst, true);
    volcano.burst = null;
  }
}
// lava LANDING feeds the column's liquid pool — and heats the seam below
function landLava(lb) {
  const ci = clamp(Math.round(lb.x / cols.step), 0, cols.length - 1);
  const c = cols[ci];
  c.lava = Math.min(30, c.lava + lb.s * 1.4);
  c.lavaT = 0;
  c.burn = Math.max(c.burn, 0.85);
  dirtyA = Math.min(dirtyA, ci); dirtyB = Math.max(dirtyB, ci + 1);
  igniteAt(lb.x, lb.y, 9, 'lava');
  if (Math.random() < 0.35) firePatches.push({ x: lb.x, y: c.top - c.lava, life: R(0.8, 1.6), volc: true });
  if (Math.random() < 0.3) fx.push({ k: 'wisp', x: lb.x, y: c.top - c.lava - 2, vx: R(-5, 5), vy: -R(14, 26), ph: R(0, 6.28), t: 0, life: R(0.7, 1.4) });
}
function stepLavaBits(dt) {
  lavaBits = lavaBits.filter(lb => {
    lb.t += dt;
    if (lb.t > lb.life) return false;
    lb.vy += GRAV * 0.5 * dt;
    lb.vx += wind * 0.12 * WINDF * dt;
    lb.x += lb.vx * dt; lb.y += lb.vy * dt;
    if (lb.x < -20 || lb.x > Wc + 20 || lb.y > Hc) return false;
    // in a cave the ceiling bounces the bombs back down
    if (UNDER && lb.y < ceilAt(lb.x)) { lb.y = ceilAt(lb.x) + 1; lb.vy = Math.abs(lb.vy) * 0.35; lb.vx += R(-20, 20); }
    const wy = waterAt(lb.x);
    if (lb.y >= wy && surfaceAt(lb.x) > waterLevel + 4) {
      spawnWisps(lb.x, wy, 2);
      pushRipple(lb.x, 3);
      return false;
    }
    for (let i = 0; i < tanks.length; i++) {
      const tk = tanks[i];
      if (canHurt(i) && Math.abs(lb.x - tk.x) < 11 && lb.y > tk.y - 30 && lb.y < tk.y + 8) {
        damageTank(i, 1 + Math.random() * 2, 'lava', lb.x, lb.y);
        return false;
      }
    }
    if (lb.y >= surfaceAt(lb.x) && !inVoid(lb.x, lb.y)) { landLava(lb); return false; }
    if (inVoid(lb.x, lb.y)) {
      const c = colAt(lb.x);
      if (lb.y >= c.h1 - 2) { landLava(lb); return false; }
    }
    return true;
  });
}

// ================= WATER =================
const WP = { speed: 130, decay: 0.0012, ampBass: 13, ampMid: 7, ampTrb: 3, beatSense: 1.45, beatCooldown: 0.16, maxRipples: 16, specular: 0.55 };
const WB = 22;
const wPhaseB = new Float32Array(WB);
function waterReset() { ripples = []; waterH = null; bands = new Float32Array(WB); aState = { bass: 0, mid: 0, treble: 0, bassAvg: 0, bassPeak: 0.2, lastBeat: -1 }; }

function ensureWaterFx() {
  if (glints.length !== 110 || (glints.length && glints[0].wc !== Wc)) {
    glints = [];
    for (let i = 0; i < 110; i++) {
      const axis = Math.random() < 0.9;
      glints.push({
        x: R(0, Wc || 800), axis,
        u: axis ? (R(-1, 1) + R(-1, 1)) * 0.5 : 0,
        dy: 2 + Math.pow(Math.random(), 1.3) * 115,
        len: R(1.5, 5.5), wdt: R(1, 2.6),
        drift: R(3, 10) * (Math.random() < 0.5 ? 1 : -1),
        jit: R(0, 6.28),
        cd: R(0.2, 3), fl: -1, dur: R(0.35, 0.9),
        rise: R(0.18, 0.35), hold: R(0.12, 0.3),
        wc: Wc || 800
      });
    }
  }
  if (!wBands.length) {
    for (let i = 0; i < 5; i++) wBands.push({ ph: R(0, 6.28), sp: R(0.1, 0.25) * (Math.random() < 0.5 ? 1 : -1), d: 12 + i * 24, w: 0.3 + i * 0.15 });
  }
  if (!wBlobs.length) {
    for (let i = 0; i < 32; i++) wBlobs.push({ fx: Math.random(), d: R(12, 130), ph: R(0, 6.28), sp: R(0.004, 0.02) * (Math.random() < 0.5 ? 1 : -1), s: R(0.7, 1.9), a: R(0.35, 0.85) });
  }
}

function readAudio() {
  if (!apEl || !apEl.isConnected) apEl = document.getElementById('audioPlayer');
  const an = window.scAnalyser;
  audioLive = !!apEl && !apEl.paused && !!an;
  if (!audioLive) { aState.bass *= 0.8; aState.mid *= 0.8; aState.treble *= 0.8; for (let b = 0; b < WB; b++) bands[b] *= 0.82; return; }
  try {
    if (!apBuf || apBuf.length !== an.frequencyBinCount) apBuf = new Uint8Array(an.frequencyBinCount);
    const dA = apBuf;
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
    const maxBin = Math.max(8, Math.floor(n * 0.7));
    for (let b = 0; b < WB; b++) {
      const f0 = Math.max(1, Math.floor(Math.pow(maxBin, b / WB)));
      const f1 = Math.max(f0 + 1, Math.floor(Math.pow(maxBin, (b + 1) / WB)));
      let s = 0;
      for (let i = f0; i < f1; i++) s += dA[i];
      const v = s / (f1 - f0) / 255;
      bands[b] = v > bands[b] ? bands[b] * 0.4 + v * 0.6 : bands[b] * 0.86 + v * 0.14;
    }
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
function pushRipple(x, amp) {
  if (ripples.length >= WP.maxRipples + 4) ripples.shift();
  ripples.push({ x, radius: 6, amp, speed: WP.speed * 0.8, decay: WP.decay, width: 260, t: 0 });
  if (amp >= 6 && fx.length < 380) {
    const y = waterAt(x);
    fx.push({ k: 'wring', x, y, r: 2, vr: 65, t: 0, life: 0.9 });
    fx.push({ k: 'wring', x, y, r: 2, vr: 38, t: 0, life: 1.5 });
  }
}

function stepWater(dt) {
  readAudio();
  idlePh += dt;
  ripples = ripples.filter(rp => {
    rp.radius += rp.speed * dt;
    rp.t += dt;
    rp.amp *= (1 - rp.decay * rp.radius * dt * 0.02);
    return rp.amp > 0.25 && rp.radius < Wc * 1.4;
  });
  const N = cols.length;
  if (!waterH || waterH.length !== N) waterH = new Float32Array(N);
  if (audioLive) {
    for (let b = 0; b < WB; b++) wPhaseB[b] += dt * (0.5 + b * 0.2) * (0.7 + bands[b] * 2.5);
    for (let i = 0; i < N; i++) {
      const x = i * cols.step;
      let h = Math.sin(x * 0.006 + wPhaseB[0] * 0.35) * (1.2 + bands[0] * 5);
      for (let b = 1; b < WB; b++) {
        const A = bands[b];
        if (A < 0.025) continue;
        const wl = Wc / (0.7 + b * 1.18);
        h += Math.sin(x * 6.2832 / wl + wPhaseB[b]) * A * (2 + 12 / (1 + b * 0.4));
      }
      waterH[i] = h;
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
    for (let i = 0; i < N; i++) {
      const x = i * cols.step;
      waterH[i] = waterH[i] * 0.88 + (Math.sin(x * 0.012 + idlePh * 0.8) * 1.5 + Math.sin(x * 0.031 - idlePh * 0.5) * 0.7) * 0.12;
    }
  }
  for (let i = 0; i < N; i++) {
    const c = cols[i];
    if (c.h1 > 0 && waterLevel > c.h0 + 2) {
      const depth = clamp((waterLevel - c.h0) / Math.max(1, c.h1 - c.h0), 0, 1);
      if (depth > 0.15) waterH[i] = waterH[i] * 0.6 + (waterH[i] || 0) * 0.4 * depth;
    }
  }
  if (glints.length) {
    const lightOn = skyLight.x > 10 && skyLight.x < Wc - 10 && skyLight.a > 0.06;
    for (let q = 0; q < glints.length; q++) {
      const gl = glints[q];
      if (gl.axis) {
        if (lightOn) gl.x = skyLight.x + gl.u * (5 + gl.dy * 0.55);
      } else {
        gl.x += gl.drift * dt;
        if (gl.x < -14) gl.x += Wc + 28; else if (gl.x > Wc + 14) gl.x -= Wc + 28;
      }
      if (gl.fl >= 0) {
        gl.fl += dt;
        if (gl.fl >= gl.dur) { gl.fl = -1; gl.cd = R(0.5, 1.4) * (Math.abs(gl.u) < 0.4 ? 1 : 3); }
      } else {
        gl.cd -= dt;
        if (gl.cd <= 0) {
          if (!lightOn) gl.cd = 0.4;
          else {
            const h = waterAt(gl.x) - waterLevel, near = Math.abs(gl.u) < 0.4;
            if (h > 0.5 || Math.random() < (near ? 0.55 : 0.12)) { gl.fl = 0; gl.dur = R(0.35, 0.9); gl.rise = R(0.18, 0.35); gl.hold = R(0.12, 0.3); gl.jit = R(0, 6.28); }
            else gl.cd = R(0.25, 1);
          }
        }
      }
    }
    for (let b = 0; b < wBlobs.length; b++) {
      const wb = wBlobs[b];
      wb.fx += wb.sp * dt;
      if (wb.fx < -0.08) wb.fx += 1.16; else if (wb.fx > 1.08) wb.fx -= 1.16;
    }
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
function placeTanks(final) {
  const N = cols.length;
  // water headroom budget: ~2-3 missile craters of rock between a fighter
  // and the waterline (scaled by the world's blast depth) — the first
  // shot can no longer flood anyone, the third one can; this mirrors the
  // digging budget the seams got
  const head = clamp(Math.round(95 * M().depthF), 72, 108);
  const standable = (i, dryGap, slMax, win) => {
    if (cols[i].top > waterLevel - dryGap) return false;
    if (volcano && Math.abs(i * cols.step - volcano.x) < volcano.r + 60) return false;
    let s = 0;
    for (let k = -win; k <= win; k++) s = Math.max(s, Math.abs(cols[clamp(i + k, 0, N - 1)].top - cols[i].top));
    return s < slMax;
  };
  let spots = [];
  for (let i = 4; i < N - 4; i++) if (standable(i, 30, 14, 3)) spots.push(i);
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
        if (volcano && Math.abs(j * cols.step - volcano.x) < volcano.r + 50) continue;
        const h = waterLevel - cols[j].top;
        if (h > bh) { bh = h; best = j; }
      }
      return best;
    };
    const p1 = pick(dryIdx.length ? dryIdx[Math.floor(dryIdx.length * 0.25)] : Math.floor(N * 0.22));
    let p2 = pick(dryIdx.length ? dryIdx[Math.floor(dryIdx.length * 0.75)] : Math.floor(N * 0.78));
    // never let the emergency fallback pick the SAME spot twice — the
    // stacked-pair bug starts right here
    if (p2 === p1) p2 = clamp(p1 > N / 2 ? p1 - Math.round(N * 0.25) : p1 + Math.round(N * 0.25), 6, N - 7);
    [p1, p2].forEach(c => {
      const target = waterLevel - head;
      for (let k = -5; k <= 5; k++) {
        const j = clamp(c + k, 0, N - 1);
        const fall = 1 - Math.abs(k) / 7;
        cols[j].top = Math.min(cols[j].top, target + (1 - fall) * 16);
      }
      spots.push(c);
    });
  }
  // ============ SAFE-PAIR SELECTION ============
  // the placement must ALWAYS leave both fighters a real platform: high
  // enough above the waterline that neither the rising pools nor the
  // creeping dunes reach it in seconds, out of the volcano's lava reach,
  // and ideally separated by a ridge — no instant direct kill. Danger
  // that needs MINUTES to arrive (a slow lava tongue, drifting sand) is
  // legitimate: the exposed fighter still has time to act
  const safety = (i) => {
    const x = i * cols.step;
    let s = clamp((waterLevel - cols[i].top - 10) / 55, 0, 1) * 45;
    if (volcano) s += clamp((Math.abs(x - volcano.x) - volcano.r * 2.2) / (Wc * 0.3), 0, 1) * 25;
    if (biome.mat.drift) {
      // the drifting worlds migrate the relief downwind: a spot whose
      // downwind run meets water within ~120px slides into it in minutes
      const sgn = Math.sign(wind) || 1;
      let run = 0;
      for (let k = 1; k <= 8 && !run; k++) {
        const j = clamp(i + sgn * k * 5, 0, N - 1);
        if (cols[j].top > waterLevel - 6) run = k;
      }
      s -= clamp(run * 1.6, 0, 12);
    }
    s -= clamp(Math.abs(slopeAt(x)) * 6, 0, 12);
    return s;
  };
  // a ridge between the platforms blocks the instant direct kill
  const occluded = (a, b) => {
    const ax = a * cols.step, ay = cols[a].top - 22;
    const bx = b * cols.step, by = cols[b].top - 22;
    for (let t = 0.08; t < 0.93; t += 0.07) {
      if (ay + (by - ay) * t >= surfaceAt(ax + (bx - ax) * t) - 1) return true;
    }
    return false;
  };
  const pool = spots.length > 260 ? spots.filter((_, q) => q % Math.ceil(spots.length / 260) === 0) : spots;
  const sf = pool.map(safety);
  const gapMin = Math.max(110, Wc * 0.22);
  let bestPair = null, bestSc = -1e9;
  for (let a = 0; a < pool.length; a++) {
    for (let b = a + 1; b < pool.length; b++) {
      const gap = Math.abs(pool[a] - pool[b]) * cols.step;
      if (gap < gapMin) continue;
      const sc = sf[a] + sf[b] + clamp(gap / Wc, 0, 1) * 20 + (occluded(pool[a], pool[b]) ? 18 : 0);
      if (sc > bestSc) { bestSc = sc; bestPair = [pool[a], pool[b]]; }
    }
  }
  if (!bestPair) {
    const ss = spots.slice().sort((x, y) => x - y);
    bestPair = [ss[0], ss[ss.length - 1]];
  }
  const greenFirst = Math.random() < 0.5;
  const pi = greenFirst ? bestPair[0] : bestPair[1];
  const ei = greenFirst ? bestPair[1] : bestPair[0];
  // dry-headroom guarantee: a chosen platform sitting low is lifted into
  // a flat mesa a full head budget above the water — 2-3 missile craters
  // of rock; the slow floods still need minutes
  [pi, ei].forEach(c => {
    const need = waterLevel - head;
    if (cols[c].top > need) {
      for (let k = -6; k <= 6; k++) {
        const j = clamp(c + k, 0, N - 1);
        const fall = 1 - Math.abs(k) / 8;
        cols[j].top = Math.min(cols[j].top, need + (1 - fall) * 20);
      }
      dirtyA = Math.min(dirtyA, c - 7); dirtyB = Math.max(dirtyB, c + 7);
    }
  });
  tanks = [
    { x: pi * cols.step, hp: TANK_HP, col: players[0].col, hull: players[0].hull, dispAng: 45, dead: false, dying: false, lsUntil: 0, lsShot: false, fallFrom: undefined, wreck: 0, shield: 1, recoil: 0, terrDmg: 0, riseAcc: 0, dmgAcc: 0 },
    { x: ei * cols.step, hp: TANK_HP, col: players[1].col, hull: players[1].hull, dispAng: 45, dead: false, dying: false, lsUntil: 0, lsShot: false, fallFrom: undefined, wreck: 0, shield: 1, recoil: 0, terrDmg: 0, riseAcc: 0, dmgAcc: 0 }
  ];
  tanks.forEach(t => { t.x = clamp(t.x, 20, Wc - 20); t.y = surfaceAt(t.x); });

  // min-gap enforcement: the floor scales with the screen; the direction
  // FLIPS if the screen edge clamps the first pick back into the gap zone
  const minGap = Math.max(110, Wc * 0.22);
  if (Math.abs(tanks[0].x - tanks[1].x) < minGap) {
    const px = tanks[0].x;
    const want = px < Wc / 2 ? 1 : -1;
    let bestI = -1, bestScore = -1;
    for (let i = 6; i < N - 6; i++) {
      const cx = i * cols.step;
      if (volcano && Math.abs(cx - volcano.x) < volcano.r + 60) continue;
      const gap = (cx - px) * want;
      if (gap < minGap) continue;
      if (cols[i].top > waterLevel - head) continue;
      let flat = 0;
      for (let k = -3; k <= 3; k++) flat = Math.max(flat, Math.abs(cols[clamp(i + k, 0, N - 1)].top - cols[i].top));
      if (flat >= 12) continue;
      const score = Math.min(gap, Wc * 0.6) - flat * 3;
      if (score > bestScore) { bestScore = score; bestI = i; }
    }
    if (bestI < 0) {
      const need = Math.max(minGap * 1.4, Wc * 0.3);
      let ex = clamp(px + want * need, 30, Wc - 30);
      if (Math.abs(ex - px) < minGap) ex = clamp(px - want * need, 30, Wc - 30);
      if (Math.abs(ex - px) < minGap) ex = clamp(px < Wc / 2 ? Wc - 34 : 34, 30, Wc - 30);
      if (volcano && Math.abs(ex - volcano.x) < volcano.r + 70) {
        const side = ex < volcano.x ? -1 : 1;
        ex = clamp(volcano.x + side * (volcano.r + 100), 30, Wc - 30);
        if (Math.abs(ex - px) < minGap) ex = clamp(px - want * need, 30, Wc - 30);
      }
      const ci = clamp(Math.round(ex / cols.step), 4, N - 5);
      const target = waterLevel - head;
      for (let k = -6; k <= 6; k++) {
        const j = clamp(ci + k, 0, N - 1);
        const fall = 1 - Math.abs(k) / 8;
        cols[j].top = Math.min(cols[j].top, target + (1 - fall) * 22);
      }
      bestI = ci;
    }
    tanks[1].x = bestI * cols.step;
    tanks[1].y = surfaceAt(tanks[1].x);
  }

  // hard guarantee: the pair is NEVER stacked on one spot. If this map
  // cannot split them, report failure — newRound regenerates the scene;
  // on the final attempt two synthetic quarter platforms are force-built
  if (Math.abs(tanks[0].x - tanks[1].x) < 60) {
    if (!final) return false;
    [0.25, 0.75].forEach((fxp, q) => {
      const c = clamp(Math.round(fxp * Wc / cols.step), 6, N - 7);
      const target = clamp(waterLevel - head, Hc * 0.18, Hc * 0.45);
      for (let k = -7; k <= 7; k++) {
        const j = clamp(c + k, 0, N - 1);
        const fall = 1 - Math.abs(k) / 8;
        cols[j].top = Math.min(cols[j].top, target + (1 - fall) * 18);
      }
      tanks[q].x = c * cols.step;
      tanks[q].y = surfaceAt(tanks[q].x);
    });
  }

  // lava defence: moat + rampart between the volcano and each turret
  if (volcano) {
    const NP = cols.length;
    tanks.forEach(t => {
      const away = t.x >= volcano.x ? 1 : -1;
      const dist = Math.abs(t.x - volcano.x);
      if (dist > volcano.r + 500) return;
      const s = clamp(1 - (dist - volcano.r) / 700, 0.4, 1);
      const appr = surfaceAt(clamp(t.x - away * 90, 8, Wc - 8));
      const crest = clamp(Math.min(t.y - 10 - 46 * s, appr - 8), t.y - 150, t.y - 34);
      const mi = clamp(Math.round((t.x - away * 104) / cols.step), 18, NP - 19);
      for (let k = -15; k <= 15; k++) {
        const j = clamp(mi + k, 0, NP - 1);
        if (tanks.some(o => o !== t && Math.abs(o.x - j * cols.step) < 34)) continue;
        cols[j].top = Math.max(cols[j].top, t.y + 4 + 14 * (1 - Math.abs(k) / 16));
      }
      const ci = clamp(Math.round((t.x - away * 46) / cols.step), 26, NP - 27);
      for (let k = -24; k <= 24; k++) {
        const j = clamp(ci + k, 0, NP - 1);
        const fall = 1 - Math.abs(k) / 25;
        cols[j].top = Math.min(cols[j].top, crest + 36 * (1 - fall));
      }
      dirtyA = Math.min(dirtyA, mi - 16); dirtyB = Math.max(dirtyB, ci + 25);
    });
  }

  // a fighter standing on a slope gets a built-out LEDGE: flat ground
  // under the tracks, then a shoulder at a stable scree angle running
  // downhill until it MERGES into the hillside — no hanging base, no
  // first-frame slide, and the ledge survives the ground relaxation
  tanks.forEach(t => {
    const rs = 2.2 / cols.step;
    for (const sgn of [-1, 1]) {
      for (let d = 0; d <= 66; d += cols.step) {
        const x = t.x + sgn * d;
        if (x < 4 || x > Wc - 4) break;
        const i = clamp(Math.round(x / cols.step), 0, N - 1);
        const bench = d < 14 ? t.y + 0.4 : t.y + 0.4 + (d - 14) * rs;
        if (cols[i].top > bench) {
          cols[i].top = bench;
          dirtyA = Math.min(dirtyA, i); dirtyB = Math.max(dirtyB, i + 1);
        } else if (d >= 14) break;
      }
    }
  });

  // seams beneath a fighter sit deeper still: digging one out from under
  // a turret must take a few deliberate hits, not one lucky missile
  tanks.forEach(t => {
    pockets.forEach(pk => {
      if (t.x <= pk.x0 - 16 || t.x >= pk.x1 + 16) return;
      const add = R(14, 26);
      if (pk.y1 + add < Hc - 6) { pk.y0 += add; pk.y1 += add; pk.cy += add; pk.dep += add; }
    });
  });
  return true;
}

function newRound(first) {
  // the pair must never land stacked on one spot: if this scene cannot
  // split the two fighters, regenerate it — up to 4 tries, the last one
  // force-builds quarter platforms (see placeTanks)
  let placed = false;
  for (let tries = 0; tries < 4 && !placed; tries++) {
    genTerrain();
    wind = windDir * R(0.3, 4);
    placed = placeTanks(tries === 3);
  }
  if (first) roundOpener = firstShooter;
  else roundOpener = 1 - roundOpener;
  turnOrder = roundOpener;
  turn = turnOrder;
  state = 'aim';
  aim = { ...seatAim[turn] };
  aiAim = 55;
  cur2 = 0;
  cycleT = Math.random() < 0.7 ? R(0, 0.36) : R(0.56, 0.9);
  updateTod();
  shot = null; subshots = []; liquids = []; debris = []; remains = []; terraJobs = []; events = []; sinkers = []; fx = []; firePatches = []; wreckBits = []; worm = null; junks = [];
  rgt = 0;
  // rare-event plans: 0-2 sightings per ~5 minutes, never early; the
  // times are ROUND-RELATIVE (rgt — the cumulative game clock gt made
  // the worm spawn at second 0 of every round after the first); test
  // summons bypass the plans
  wormPlan = { q: 0, at: [], n: 0 };
  junkPlan = { q: 0, at: [], n: 0 };
  const wq = Math.random();
  if (wq > 0.8) { wormPlan.q = wq > 0.95 ? 2 : 1; wormPlan.at = [R(70, 200), R(210, 290)]; }
  if (!UNDER) {
    const jq = Math.random();
    if (jq > 0.85) { junkPlan.q = jq > 0.97 ? 2 : 1; junkPlan.at = [R(90, 220), R(240, 320)]; }
  }
  windParts = []; comets = []; grains = []; lavaBits = []; lastHitInfo = null; killed = null; lastKillMethod = 'weapon'; lastShotApex = 0;
  shake = 0;
  skyLight = { x: -999, col: '255,255,255', a: 0 };
  roundStart = Date.now();
  turnTimer = TURN_TIME;
  warnedAt = {};
  confirmClose = false;
  turnCard = null;
  if (GMODE === 2) { turnIntro = TURN_INTRO; announceTurn(); }
  if (!first) round++;
  draw();
}

// hot-seat hand-over: a 3s "ХОД ПЕРЕДАН — ИМЯ" card between turns
function announceTurn() {
  const pl = players[turnOrder];
  turnCard = { txt: pl.name.toUpperCase(), col: pl.col };
  beep(880, 0.09, 0.12);
  schedule(() => beep(880, 0.09, 0.12), 0.5);
}
function handOverTurn() {
  state = 'aim';
  turnOrder = 1 - turnOrder;
  turn = turnOrder;
  aim = { ...seatAim[turn] };
  turnTimer = TURN_TIME;
  warnedAt = {};
  turnIntro = TURN_INTRO;
  announceTurn();
  draw();
}
function syncSeatAim() { seatAim[turn] = { ...aim }; }

// ================= DEFORMATION =================
function craterMask(cx, r, pow, mode, form, melt) {
  pow = pow || 1;
  const N = cols.length;
  form = form || 'circle';
  // per-impact random ASYMMETRY for the blast bowl: each hit picks its
  // own stretch and skew, so repeated craters stop cloning one identical
  // (triangular) stamp; the wall jitter runs on LOW-frequency noise
  const blast = mode !== 'add' && mode !== 'smooth';
  const ash = (cx * 13.7 + r * 7.3 + seed) | 0;
  const str = blast ? 0.85 + noise(ash * 0.71) * 0.35 : 1;
  const skw = blast ? (noise(ash * 1.37) - 0.5) * 0.5 : 0;
  const i0 = clamp(Math.round((cx - r * 1.35) / cols.step), 0, N - 1);
  const i1 = clamp(Math.round((cx + r * 1.35) / cols.step), 0, N - 1);
  const list = [];
  for (let i = i0; i <= i1; i++) {
    const dx = (i * cols.step - cx) / r;
    const j = 0.9 + noise(i * 1.1 + cx * 0.03) * 0.2;
    let shape = 1;
    if (form === 'star') {
      const ray = Math.pow(Math.abs(Math.sin(dx * Math.PI * 6)), 0.35);
      shape = Math.abs(dx) < 1 ? (ray * 1.25 + 0.25) : 0.3;
    } else if (form === 'ellipse') {
      shape = Math.pow(Math.max(0, 1 - dx * dx), 0.25);
    } else if (form === 'line') {
      shape = Math.abs(dx) < 0.4 ? 1.2 : 0.15;
    }
    const ax = dx * str + skw;
    let to = null;
    if (mode === 'add') {
      if (Math.abs(dx) < 1.05) to = cols[i].top - r * 2.1 * shape * Math.sqrt(Math.max(0, 1.06 - dx * dx)) * j;
    } else if (mode === 'smooth') {
      const prev = cols[clamp(i - 1, 0, N - 1)].top, next = cols[clamp(i + 1, 0, N - 1)].top;
      to = (cols[i].top * 2 + prev + next) / 4;
    } else {
      if (Math.abs(ax) < 0.74) to = cols[i].top + r * M().depthF * pow * shape * Math.pow(1 - ax * ax, 0.75) * j;
      else if (Math.abs(ax) < 1.06) {
        const f = 1 - (Math.abs(ax) - 0.74) / 0.32;
        to = cols[i].top - r * M().rimF * pow * shape * Math.pow(f, 1.2) * j;
      }
    }
    if (to !== null && Math.abs(to - cols[i].top) > 0.5) {
      const isCrater = mode !== 'add' && mode !== 'smooth' && Math.abs(ax) < 0.74;
      const isRim = mode !== 'add' && mode !== 'smooth' && Math.abs(ax) >= 0.74;
      list.push({ i, from: cols[i].top, to, delay: Math.abs(ax) * 0.22 + noise(i * 9.1) * 0.08, dur: 0.3 + noise(i * 5.3) * 0.15, isCrater, isRim, melt: melt || 0, fill: mode === 'add' });
    }
  }
  if (list.length) {
    terraJobs.push({ t: 0, cols: list });
    dirtyA = Math.min(dirtyA, i0); dirtyB = Math.max(dirtyB, i1);
  }
}

function subsideColumn(i, quiet) {
  const c = cols[i];
  if (c.h1 <= 0) return 0;
  const covered = c.h0 > c.top + 2;
  const newTop = covered ? c.top + (c.h1 - c.h0) : c.h1;
  const drop = clamp(newTop - c.top, 0, Hc - 4 - c.top);
  c.top += drop;
  c.h0 = 0; c.h1 = 0; c.sid = 0;
  c.surf *= 0.7;
  if (!quiet && Math.random() < 0.5 && fx.length < 380) fx.push({ k: 'dust', x: i * cols.step, y: c.top, vx: R(-10, 10), vy: -R(10, 40), r: R(2, 5), t: 0, life: R(0.5, 1.1), col: M().dustCol });
  dirtyA = Math.min(dirtyA, i); dirtyB = Math.max(dirtyB, i + 1);
  return drop;
}
//scorch.world.js part02
// the void TRACKS the drill: floor extends to it, ceiling rises with it
function carve(x, y, rad, sid) {
  const N = cols.length;
  const i0 = clamp(Math.round((x - rad) / cols.step), 0, N - 1);
  const i1 = clamp(Math.round((x + rad) / cols.step), 0, N - 1);
  for (let i = i0; i <= i1; i++) {
    const c = cols[i];
    const dx = (i * cols.step - x) / rad;
    if (Math.abs(dx) > 1) continue;
    const half = rad * Math.sqrt(1 - dx * dx);
    let a = y - half, b = y + half;
    if (a < c.top) a = c.top;
    if (b > Hc - 6) b = Hc - 6;
    if (b - a < 3) continue;
    if (c.h1 > 0 && c.sid !== sid) {
      const overlap = Math.min(c.h1, b) - Math.max(c.h0, a);
      if (overlap > TUN_MAX * 0.5) { subsideColumn(i, false); continue; }
    }
    let h0, h1;
    if (c.h1 > 0) {
      h1 = Math.max(c.h1, b);
      h0 = Math.min(c.h0, a);
      if (h1 - h0 > TUN_MAX) h0 = h1 - TUN_MAX;
    } else {
      h0 = a; h1 = b;
      if (h1 - h0 > TUN_MAX) h0 = h1 - TUN_MAX;
    }
    c.h0 = h0; c.h1 = h1; c.sid = sid;
    if (c.h1 > 0 && c.h1 <= c.h0 + 2) { c.h0 = 0; c.h1 = 0; c.sid = 0; }
    if (c.h1 > 0 && c.h0 <= c.top + 2) c.surf *= 0.9;
  }
  dirtyA = Math.min(dirtyA, i0); dirtyB = Math.max(dirtyB, i1);
}

function carveLine(x0, y0, x1, y1, rad, sid) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(d / Math.max(2, cols.step)));
  for (let s = 0; s <= steps; s++) {
    carve(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps, rad, sid);
  }
}

function collapseHoles(cx, r) {
  const N = cols.length;
  const i0 = clamp(Math.round((cx - r) / cols.step), 1, N - 2);
  const i1 = clamp(Math.round((cx + r) / cols.step), 1, N - 2);
  let did = false;
  for (let i = i0; i <= i1; i++) {
    const c = cols[i];
    if (c.h1 > 0 && c.h0 - c.top < r) {
      if (subsideColumn(i, false) >= 0) did = true;
    }
  }
  if (did) {
    tanks.forEach((tk, i) => {
      if (!canHurt(i)) return;
      const cc = cols[clamp(Math.round(tk.x / cols.step), 0, N - 1)];
      if (cc.h1 <= 0 && tk.y > cc.top + 8) addTerrDmg(i, 14, 'обвал');
    });
    // the per-column drops leave a staircase — relax it into a slope
    smoothGround(i0 - 3, i1 + 3);
  }
}

function slump(i0, i1, rounds) {
  const N = cols.length;
  i0 = clamp(i0, 1, N - 2);
  i1 = clamp(i1, 1, N - 2);
  // the rest angle varies PER COLUMN and per pass: a uniform threshold
  // grades every slope to the same straight line — the source of the
  // triangular ridges. Alternating sweep direction removes the bias
  const st0 = M().slope * 2.2;
  for (let it = 0; it < rounds; it++) {
    let moved = false;
    const fwd = it & 1;
    for (let k = 0; k < i1 - i0; k++) {
      const i = fwd ? i0 + k : i1 - 1 - k;
      const stable = st0 * (0.6 + noise(i * 0.53 + it * 7.7) * 0.8);
      const diff = cols[i + 1].top - cols[i].top;
      if (diff > stable) {
        const q = (diff - stable) * 0.5;
        cols[i].top += q; cols[i + 1].top -= q;
        moved = true;
      } else if (diff < -stable) {
        const q = (-diff - stable) * 0.5;
        cols[i].top -= q; cols[i + 1].top += q;
        moved = true;
      }
    }
    if (!moved) break;
  }
  dirtyA = Math.min(dirtyA, i0); dirtyB = Math.max(dirtyB, i1);
  for (let i = i0; i <= i1; i += 3) {
    if (Math.random() < 0.4 && fx.length < 380) fx.push({ k: 'dust', x: i * cols.step, y: surfaceAt(i * cols.step) - 2, vx: R(-8, 8), vy: -R(6, 20), r: R(2, 4), t: 0, life: R(0.5, 1), col: M().dustCol });
  }
}

// relaxation pass over a damaged stretch: material flows down steps
// steeper than the material's rest angle, then a light low-pass files
// off single-column spikes — blast staircases, rim teeth and collapse
// combs settle into natural-looking slopes
function smoothGround(i0, i1, rounds) {
  const N = cols.length;
  i0 = clamp(i0, 1, N - 2);
  i1 = clamp(i1, 1, N - 2);
  if (i1 <= i0 + 1) return;
  // the rest angle varies PER COLUMN (noise-seeded): a uniform threshold
  // relaxes every slope to the same straight grade — that is where the
  // triangular ridges and cone craters came from
  const st0 = Math.max(1.5, M().slope * 0.55);
  for (let it = 0; it < (rounds || 10); it++) {
    let moved = false;
    const fwd = it & 1;
    for (let k = 0; k < i1 - i0; k++) {
      const i = fwd ? i0 + k : i1 - 1 - k;
      const stable = st0 * (0.55 + noise(i * 0.63 + it * 3.1) * 0.9);
      const diff = cols[i + 1].top - cols[i].top;
      if (diff > stable) { const q = (diff - stable) * 0.5; cols[i].top += q; cols[i + 1].top -= q; moved = true; }
      else if (diff < -stable) { const q = (-diff - stable) * 0.5; cols[i].top -= q; cols[i + 1].top += q; moved = true; }
    }
    if (!moved) break;
  }
  // a WIDE 5-tap low-pass, 3 passes: kills single-column spikes and
  // straight-line artifacts alike, leaving rounded organic humps
  for (let pass = 0; pass < 3; pass++) {
    const src = [];
    for (let i = i0; i <= i1; i++) src.push(cols[i].top);
    for (let k = 2; k < src.length - 2; k++) {
      cols[i0 + k].top = src[k] * 0.42 + (src[k - 1] + src[k + 1]) * 0.2 + (src[k - 2] + src[k + 2]) * 0.09;
    }
  }
  dirtyA = Math.min(dirtyA, i0); dirtyB = Math.max(dirtyB, i1 + 1);
}

function digTrench(x, y, ang, len, rad) {
  const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
  carveLine(x, y, x1, y1, rad, ++digSid);
  for (let k = 0; k < 16; k++) {
    const px = x + Math.cos(ang) * R(0, len);
    debris.push({ x: px, y: surfaceAt(px) - R(2, 12), vx: Math.cos(ang) * R(-30, 60) + R(-40, 40), vy: -R(60, 190), rot: R(0, 6), vr: R(-6, 6), s: R(1.5, 4), col: M().chunks[(Math.random() * M().chunks.length) | 0], settled: false, life: 12 });
  }
  const [sa, sb] = blastRange(x, len);
  slump(sa, sb, 4);
}

function addTerrDmg(i, dmg, src) {
  const t = tanks[i];
  if (!canHurt(i) || dmg <= 0) return;
  const room = TERR_DMG_MAX - (t.terrDmg || 0);
  if (room <= 0) return;
  dmg = Math.min(dmg, room);
  t.terrDmg = (t.terrDmg || 0) + dmg;
  t.hp -= dmg;
  lastHitInfo = `${players[i].name}: -${Math.round(dmg)} hp (${src})`;
  popDmg(t, dmg);
  if (t.hp <= 0) killTank(i, 'crush');
}
function popDmg(t, dmg) {
  if (dmg < 1 || fx.length > 380) return;
  fx.push({ k: 'hp', x: t.x + R(-8, 8), y: t.y - 36, val: Math.round(dmg), t: 0, life: 2.8 });
}

// ============ CAVE: ceiling rupture + fossil vents ============
// a blast near the ceiling tears the INVERTED ground open: the rock edge
// retreats upward and the torn mass rains down as debris that settles on
// the floor and raises it — exactly like a Dirt Ball
function ceilingCrush(x, r) {
  const N = cols.length;
  const i0 = clamp(Math.round((x - r * 1.3) / cols.step), 0, N - 1);
  const i1 = clamp(Math.round((x + r * 1.3) / cols.step), 0, N - 1);
  let mass = 0;
  for (let i = i0; i <= i1; i++) {
    const dx = (i * cols.step - x) / r;
    if (Math.abs(dx) > 1) continue;
    const j = 0.8 + noise(i * 5.1) * 0.4;
    const drop = r * 0.55 * Math.pow(Math.max(0, 1 - dx * dx), 0.8) * j;
    const before = ceil[i];
    ceil[i] = Math.max(26, ceil[i] - drop);
    mass += (before - ceil[i]) * cols.step;
  }
  const n = Math.round(clamp(mass / 90, 4, 26));
  for (let k = 0; k < n; k++) {
    const cx = x + R(-r * 0.5, r * 0.5);
    debris.push({ x: cx, y: ceilAt(cx) - R(2, 10), vx: R(-24, 24), vy: R(30, 90), rot: R(0, 6.28), vr: R(-5, 5), s: R(1.6, 3.6), col: M().chunks[(Math.random() * M().chunks.length) | 0], settled: false, life: 12 });
  }
  sfx(0.6);
}

// a nuke tearing into the cave ceiling: the torn rock pours back down as
// a FULL-HEIGHT column, floor to ceiling — a turret caught inside takes
// a partial crush while the rising earth lifts it onto the column's top
function growCeilColumn(x, r) {
  const N = cols.length;
  const i0 = clamp(Math.round((x - r) / cols.step), 1, N - 2);
  const i1 = clamp(Math.round((x + r) / cols.step), 1, N - 2);
  const list = [];
  for (let i = i0; i <= i1; i++) {
    const dx = Math.abs(i * cols.step - x) / r;
    if (dx >= 1) continue;
    const to = ceilAt(i * cols.step) + 2 + (1 - Math.sqrt(Math.max(0, 1 - dx * dx))) * 10;
    if (to < cols[i].top - 0.5) list.push({ i, from: cols[i].top, to, delay: Math.abs(dx) * 0.3 + R(0, 0.08), dur: 0.5, fill: true });
  }
  if (list.length) {
    terraJobs.push({ t: 0, cols: list });
    dirtyA = Math.min(dirtyA, i0); dirtyB = Math.max(dirtyB, i1);
  }
  tanks.forEach((tk, i) => {
    if (canHurt(i) && Math.abs(tk.x - x) < r * 0.85) addTerrDmg(i, 18, 'завал');
  });
  spawnDirtFall(x, r * 0.7);
  sfx(0.7);
  shake = Math.min(10, shake + 3);
}

// fossil pockets in the ceiling: a blast nearby cracks one open and it
// pours FIRE and EARTH downward in waves
function hitVents(x, y, r) {
  caveVents.forEach(v => {
    if (v.state !== 0) return;
    const vx = (v.x0 + v.x1) / 2;
    const vy = ceilAt(vx);
    if (Math.hypot(x - vx, (y - vy) * 0.7) < r + 26) { v.state = 1; eruptVent(v); }
  });
}
function eruptVent(v) {
  v.waves = 3 + (Math.random() * 3 | 0);
  const wave = () => {
    if (v.state !== 1) return;
    const cx = (v.x0 + v.x1) / 2;
    const cy = ceilAt(cx);
    fx.push({ k: 'flash', x: cx, y: cy + 4, r: 18, t: 0, life: 0.15, col: `rgb(${lav().glow})` });
    sfx(0.6);
    shake = Math.min(10, shake + 2);
    for (let k = 0; k < 9; k++) debris.push({ x: cx + R(-14, 14), y: cy - R(2, 12), vx: R(-26, 26), vy: R(40, 120), rot: R(0, 6.28), vr: R(-5, 5), s: R(1.6, 3.6), col: M().chunks[(Math.random() * M().chunks.length) | 0], settled: false, life: 12 });
    for (let k = 0; k < 4; k++) if (lavaBits.length < 55) lavaBits.push({ x: cx + R(-10, 10), y: cy + 4, vx: R(-30, 30), vy: R(60, 160), t: 0, life: R(1.2, 2.2), s: R(1.4, 2.6) });
    schedule(() => { const fxp = R(v.x0, v.x1); firePatches.push({ x: fxp, y: surfaceAt(fxp) - 2, life: R(1.5, 3) }); }, 0.5);
    if (--v.waves > 0) schedule(wave, 0.28);
    else v.state = 2;
  };
  wave();
}

function stepTerra(dt) {
  terraJobs = terraJobs.filter(j => {
    j.t += dt;
    j.cols.forEach(c => {
      if (j.t < c.delay) return;
      const k = ease(Math.min(1, (j.t - c.delay) / c.dur));
      cols[c.i].top = c.from + (c.to - c.from) * k;
      if (c.isCrater) {
        cols[c.i].surf = 0;
        cols[c.i].burn = Math.max(cols[c.i].burn, 0.9 * k);
        if (c.melt) cols[c.i].melt = Math.max(cols[c.i].melt || 0, c.melt * k);
      }
      if (c.isRim) cols[c.i].surf *= 0.985;
      if (c.fill && k > 0.15) { cols[c.i].h1 = 0; cols[c.i].h0 = 0; cols[c.i].sid = 0; }
    });
    const live = j.cols.some(c => j.t < c.delay + c.dur);
    // a finished deformation SETTLES: jagged blast edges, rim spikes and
    // staircases relax into natural slopes (smoothGround)
    if (!live) {
      let ja = 1e9, jb = -1;
      j.cols.forEach(c => { if (c.i < ja) ja = c.i; if (c.i > jb) jb = c.i; });
      smoothGround(ja - 2, jb + 2);
    }
    return live;
  });
  const ms = M().slope * 1.6;
  const K = 3 * dt;
  // per-column threshold jitter: the continuous relaxation otherwise
  // planes every slope to one identical angle — straight triangle walls
  for (let i = Math.max(1, dirtyA); i < Math.min(cols.length - 1, dirtyB); i++) {
    const msi = ms * (0.55 + noise(i * 0.47) * 0.9);
    const diff = cols[i + 1].top - cols[i].top;
    if (diff > msi) { const q = Math.min((diff - msi) * 0.25, K * 20); cols[i].top += q; cols[i + 1].top -= q; }
    else if (diff < -msi) { const q = Math.min((-diff - msi) * 0.25, K * 20); cols[i].top -= q; cols[i + 1].top += q; }
  }
  // wind-driven creep of the drift worlds
  if (biome.mat.drift) {
    driftT += dt;
    if (driftT > 0.1) {
      driftT = 0;
      const N = cols.length;
      const rate = clamp(Math.abs(wind) * 0.15, 0.2, 1.0);
      const sgn = Math.sign(wind) || 1;
      if (sgn > 0) {
        for (let i = N - 2; i >= 2; i--) {
          const diff = cols[i].top - cols[i + 1].top;
          if (diff > 4) {
            const q = Math.min(diff * 0.5, rate) * (0.5 + noise(i * 2.7) * 0.8);
            cols[i].top -= q; cols[i + 1].top += q;
          }
        }
      } else {
        for (let i = 2; i <= N - 2; i++) {
          const diff = cols[i].top - cols[i - 1].top;
          if (diff > 4) {
            const q = Math.min(diff * 0.5, rate) * (0.5 + noise(i * 2.7) * 0.8);
            cols[i].top -= q; cols[i - 1].top += q;
          }
        }
      }
      dirtyA = 2; dirtyB = N - 2;
    }
  }
  cols.forEach(c => {
    if (c.burn > 0) c.burn = Math.max(0, c.burn - dt * 0.05);
    if (c.melt > 0) c.melt = Math.max(0, c.melt - dt * 0.06);
  });
  // ============ LIQUID LAVA POOLS ============
  // molten: burns slowly INTO the ground, levels into neighbours like a
  // fluid, scalds and sets fire to any turret it submerges; cooling: the
  // mass hardens from the bottom up into a layer of EARTH (the pit fills —
  // the gain always beats the burn, so lava flows on over new ground).
  // Under water the lava quenches — no burn stage, double fill rate
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (c.lava <= 0.4) { if (c.lava) c.lava = 0; continue; }
    const x = i * cols.step;
    const wet = c.top > waterLevel + 2;
    c.lavaT += wet ? dt * 2.6 : dt;
    if (wet) {
      c.lavaT = Math.max(c.lavaT, LAVA_MELT + 0.01); // quench: no burn stage
      if (Math.random() < dt * 2) fx.push({ k: 'wisp', x, y: waterAt(x), vx: R(-4, 4), vy: -R(16, 30), ph: R(0, 6.28), t: 0, life: R(0.8, 1.6) });
    }
    if (c.lavaT < LAVA_MELT) {
      c.top = Math.min(Hc - 6, c.top + dt * (LAVA_BURN + c.lava * 0.05));
      c.burn = Math.max(c.burn, 0.9); c.surf *= 0.92; c.melt = Math.max(c.melt || 0, 0.85);
      if (Math.random() < dt * 1.5) igniteAt(x, c.top + 6, 8 + c.lava * 0.4, 'lava');
      tanks.forEach((tk, ti) => {
        if (!canHurt(ti) || Math.abs(tk.x - x) > cols.step + 6) return;
        if (tk.y > c.top - c.lava - 8 && tk.y < c.top + 10) {
          damageTank(ti, 8 * dt, 'lava', x, c.top - c.lava);
          if (Math.random() < dt * 2.5) firePatches.push({ x: tk.x + R(-3, 3), y: tk.y - 2, life: R(0.5, 1.1), volc: true });
        }
      });
      const s = c.top - c.lava;
      [i - 1, i + 1].forEach(j => {
        j = clamp(j, 0, cols.length - 1);
        const nb = cols[j];
        if (nb.h1 > 0) return; // never pour into tunnel voids
        const ns = nb.top - nb.lava;
        if (s > ns + 0.4) {
          const q = Math.min(c.lava * 0.5, (s - ns) * 0.45, 30 * dt);
          c.lava -= q; nb.lava += q;
          nb.lavaT = Math.min(nb.lavaT, 3); // fresh lava is hot again
        }
      });
      if (c.lava <= 0.4) c.lava = 0;
    } else if (c.lavaT < LAVA_COOL) {
      const q = Math.min(c.lava, (wet ? LAVA_FILL_WET : LAVA_FILL) * dt);
      c.lava -= q; c.top -= q;
      if (c.lava <= 0.4) { c.lava = 0; c.melt *= 0.4; }
    } else c.lava = 0;
    dirtyA = Math.min(dirtyA, i); dirtyB = Math.max(dirtyB, i + 1);
  }
  // burning fuel seams — mode 1 FLAME (fire source) spits fire/embers/
  // smoke, mode 2 LAVA GEYSER (lava source) fountains lava bombs; the
  // burn time was set by VOLUME at ignition, and both end in a carved
  // void + collapse that visibly reshapes the relief
  pockets.forEach(pk => {
    if (pk.state !== 1) return;
    pk.t += dt;
    const pr = clamp(pk.t / pk.dur, 0, 1);
    const wP = pk.x1 - pk.x0;
    if (pk.mode === 2) {
      if (Math.random() < dt * 2.2) {
        const gx = R(pk.x0 + 4, pk.x1 - 4);
        const gy = surfaceAt(gx) - 2;
        fx.push({ k: 'flash', x: gx, y: gy, r: 9, t: 0, life: 0.1, col: `rgb(${lav().glow})` });
        const nq = 2 + (pk.vol > 900 ? 2 : 0);
        for (let q = 0; q < nq && lavaBits.length < 55; q++) {
          lavaBits.push({ x: gx + R(-4, 4), y: gy, vx: R(-30, 30), vy: -R(140, 260), t: 0, life: R(1.1, 2), s: R(1.4, 2.4) });
        }
        if (Math.random() < 0.3) sfx(0.3);
      }
      if (Math.random() < dt * 3) {
        const fxp = R(pk.x0 + 3, pk.x1 - 3);
        firePatches.push({ x: fxp, y: surfaceAt(fxp) - R(0, 3), life: R(0.5, 1.2), volc: true });
      }
      if (Math.random() < dt * 1.2) fx.push({ k: 'wisp', x: R(pk.x0, pk.x1), y: surfaceAt(R(pk.x0, pk.x1)) - 4, vx: R(-4, 4), vy: -R(18, 34), ph: R(0, 6.28), t: 0, life: R(0.8, 1.6) });
    } else {
      if (Math.random() < dt * (3 + pk.vol / 700)) {
        const fxp = R(pk.x0 + 3, pk.x1 - 3);
        firePatches.push({ x: fxp, y: surfaceAt(fxp) - R(0, 4), life: R(0.6, 1.4) });
        if (Math.random() < 0.4) fx.push({ k: 'ember', x: fxp, y: surfaceAt(fxp) - 2, vx: R(-20, 20), vy: -R(60, 140), t: 0, life: R(0.6, 1.2), s: R(1, 2) });
      }
      if (Math.random() < dt * 2) fx.push({ k: 'smoke', x: R(pk.x0, pk.x1), y: surfaceAt(R(pk.x0, pk.x1)) - 6, r: R(3, 6), t: 0, life: R(1, 2) });
    }
    if (pr >= 1) {
      pk.state = 2;
      const cy = (pk.y0 + pk.y1) / 2;
      const sid = ++digSid;
      for (let k = 0; k < 3; k++) {
        const fxp = pk.x0 + 8 + (wP - 16) * (k / 2);
        carve(fxp, cy, Math.max(6, (pk.y1 - pk.y0) / 2), sid);
      }
      // deep seams still cave the surface in: the collapse reach grows
      // with the burial depth, not just the seam width
      collapseHoles((pk.x0 + pk.x1) / 2, wP * 0.6 + pk.dep * 0.55);
      if (pk.mode === 2) {
        // the geyser's finale: a small lava pool settles into the crater
        const [ga, gb] = blastRange((pk.x0 + pk.x1) / 2, wP * 0.3);
        for (let i = ga; i <= gb; i++) {
          cols[i].lava = Math.min(12, cols[i].lava + R(3, 7));
          cols[i].lavaT = Math.min(cols[i].lavaT, 2);
          cols[i].burn = Math.max(cols[i].burn, 0.6);
        }
        for (let k = 0; k < 4 && lavaBits.length < 55; k++) {
          const gx = R(pk.x0, pk.x1);
          lavaBits.push({ x: gx, y: surfaceAt(gx) - 2, vx: R(-40, 40), vy: -R(120, 220), t: 0, life: R(1, 1.8), s: R(1.4, 2.2) });
        }
        dirtyA = Math.min(dirtyA, ga); dirtyB = Math.max(dirtyB, gb + 1);
      } else {
        for (let k = 0; k < 3; k++) {
          const fxp = R(pk.x0, pk.x1);
          firePatches.push({ x: fxp, y: surfaceAt(fxp) - 2, life: R(1.5, 3) });
        }
      }
      sfx(0.8);
      shake = Math.min(10, shake + 3);
    }
  });
  // tank support / fall / crush / drown
  tanks.forEach((t, i) => {
    if (t.dead) return;
    if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 2.2);
    const c = cols[clamp(Math.round(t.x / cols.step), 0, cols.length - 1)];
    const inTun = c.h1 > 0 && t.y >= c.h0 - 2 && t.y < c.h1 + 14;
    const fl = floorAt(t.x, t.y);
    if (fl > t.y + 0.5) {
      if (t.fallFrom === undefined) t.fallFrom = t.y;
      t.y = Math.min(t.y + 340 * dt, fl);
      if (t.y >= fl - 0.5) {
        const fall = t.fallFrom - fl;
        if (fall > 8) {
          addTerrDmg(i, fall * 0.45, 'падение');
          fx.push({ k: 'dust', x: t.x, y: t.y, vx: R(-14, 14), vy: -20, r: 5, t: 0, life: 0.6, col: M().dustCol });
        }
        t.fallFrom = undefined;
      }
    } else if (c.top < t.y - 0.5 && !inTun) {
      t.riseAcc = (t.riseAcc || 0) + (t.y - c.top);
      t.y = c.top;
      t.fallFrom = undefined;
    } else {
      if ((t.riseAcc || 0) > 1.2) {
        addTerrDmg(i, Math.min(2.4, t.riseAcc * 0.18), 'грунт');
        fx.push({ k: 'dust', x: t.x, y: t.y, vx: R(-10, 10), vy: -14, r: 4, t: 0, life: 0.5, col: M().dustCol });
      }
      t.riseAcc = 0;
      t.fallFrom = undefined;
    }
    // a turret drowns only once fully submerged — a single crater can
    // no longer kill through the waterline
    if (t.y - waterLevel > 26) killTank(i, 'drown');
  });
}
// ================= EXPLOSIONS =================
function hitFx(x, y, r, nuke) { shake = Math.min(10, shake + r * 0.08 + (nuke ? 3 : 0)); }

// pocket ignition, shared by EVERY heat source EXCEPT the exceptions the
// spec lists (the digger WHILE DRILLING, dirt, the roller while rolling).
// heatHits: the source point (x,y) with radius r against the seam's
// flattened oval body — an inflated-ellipse test with the FULL heat radius
// (the old half-r AABB is why direct hits often did nothing)
function heatHits(pk, x, y, r) {
  const dx = x - pk.cx, dy = y - pk.cy;
  const ax = pk.ra + r, ay = pk.rb + r;
  return (dx * dx) / (ax * ax) + (dy * dy) / (ay * ay) <= 1;
}
function igniteAt(x, y, r, kind) {
  pockets.forEach(pk => {
    if (pk.state !== 0) return;
    if (heatHits(pk, x, y, r)) ignitePocket(pk, r, kind || 'fire');
  });
}
// graded combustion: a SMALL source lights a timed burn — FLAME for a fire
// source, a LAVA GEYSER for a lava one — lasting by the seam VOLUME; a
// blast that tears most of the seam's PERIMETER at once (or a giant MEGA
// seam) detonates the whole pocket instead
function ignitePocket(pk, r, kind) {
  if (pk.mega || r * 2 >= (pk.x1 - pk.x0) * 1.4) {
    pk.state = 2;
    schedule(() => pocketDetonate(pk), R(0.06, 0.25));
    return;
  }
  pk.state = 1;
  pk.mode = kind === 'lava' ? 2 : 1;
  pk.t = 0;
  pk.dur = clamp(pk.vol / 170, 2.5, 9);
  fx.push({ k: 'flash', x: pk.cx, y: pk.cy, r: 12, t: 0, life: 0.12, col: '#ff9a3a' });
  lastHitInfo = pk.mode === 2 ? 'лавовый гейзер из залежи!' : 'залежь воспламенилась!';
  beep(pk.mode === 2 ? 300 : 520, 0.09, 0.13);
}

// a seam going up all at once: staged blasts scaled by its size, a carved
// void, collapse, fires. The fire is weak (soft) — the real punch is the
// DISPLACEMENT: a fighter over the span takes a medium heave, then the
// fall damage of the caving ground
function pocketDetonate(pk) {
  const cx = (pk.x0 + pk.x1) / 2;
  const wP = pk.x1 - pk.x0;
  const big = pk.mega;
  const n = big ? clamp(Math.round(wP / 40), 4, 8) : Math.max(2, Math.round(wP / 36));
  fx.push({ k: 'skyflash', t: 0, life: 0.9, col: 'rgba(255,214,150,', a: big ? 0.4 : 0.25 });
  for (let k = 0; k < n; k++) {
    schedule(() => {
      const bx = cx + (k / (n - 1) - 0.5) * wP * 0.85;
      boomsAt(bx, surfaceAt(bx) - 6, Math.min((big ? 30 : 20) + wP * 0.2, 160), 'nuke', big ? 3 : 2, false, true);
    }, 0.1 + k * 0.15);
  }
  schedule(() => {
    const cy = (pk.y0 + pk.y1) / 2;
    const sid = ++digSid;
    for (let k = 0; k < (big ? 4 : 3); k++) carve(cx + (k - (big ? 1.5 : 1)) * wP * 0.24, cy, Math.max(8, wP * 0.3), sid);
    collapseHoles(cx, wP * 0.8 + pk.dep * 0.5);
    tanks.forEach((tk, i) => {
      if (canHurt(i) && tk.x > pk.x0 - 12 && tk.x < pk.x1 + 12) addTerrDmg(i, big ? 14 : 10, 'смещение');
    });
    const [sa, sb] = blastRange(cx, wP * 0.9);
    slump(sa, sb, 10);
    spawnDirtFall(cx, Math.min(150, wP * 1.1));
    spawnEmbers(cx, surfaceAt(cx) - 10, big ? 24 : 14, wP * 0.5);
    for (let k = 0; k < (big ? 5 : 3); k++) {
      const fxp = R(pk.x0, pk.x1);
      firePatches.push({ x: fxp, y: surfaceAt(fxp) - 2, life: R(2.5, 5), soft: 1 });
    }
    shake = Math.min(12, shake + (big ? 9 : 6));
    sfx(big ? 1.4 : 1.0);
  }, 0.12);
}

// the layered blast signature: jagged STAR + SPARK fan + CRACKLE ring
function pushBlastFx(x, y, r, style, nuke) {
  const acc = BLAST_COL[style] || '255,190,110';
  fx.push({ k: 'star', x, y, r, t: 0, life: nuke ? 0.5 : 0.34, col: acc, spikes: Math.round(6 + r / 12), rot: R(0, 6.28) });
  const pts = [], ns = Math.min(14, 6 + (r / 8 | 0));
  for (let k = 0; k < ns; k++) pts.push({ a: R(0, 6.28), l: R(0.3, 0.8), w: R(1, 2.4), spin: R(-1.5, 1.5) });
  fx.push({ k: 'spark', x, y, r, t: 0, life: 0.5, col: acc, pts });
  fx.push({ k: 'crackle', x, y, r, t: 0, life: 0.55, col: acc, rot: R(0, 6.28) });
  return acc;
}

function boomsAt(x, y, r, style, dmg, noTerr, noDouble) {
  dmg = dmg || 0;
  const m = M();
  const nuke = style === 'nuke';
  // a cave blast hugging the ceiling BURSTS the inverted ground instead
  // of digging a floor crater — decided once, used by the terrain block
  // and the nuke package below
  const ceilY = ceilAt(x);
  const hitCeil = UNDER && (y - ceilY) < (surfaceAt(x) - y);
  hitFx(x, y, r, nuke);
  igniteAt(x, y, r);
  if (UNDER) {
    hitVents(x, y, r);
    // a blast tearing into the lamp's mount (or a direct hit on the
    // fixture) kills the searchlight — it bursts into sparks like a
    // volcano bomb, in its own Kelvin colour
    for (let q = caveLights.length - 1; q >= 0; q--) {
      const L = caveLights[q];
      if (L.k !== 'beam') continue;
      if (Math.hypot(x - L.x, y - (L.y + 2)) < r + 16) {
        caveLights.splice(q, 1);
        fx.push({ k: 'flash', x: L.x, y: L.y + 2, r: 15, t: 0, life: 0.14, col: `rgb(${L.col})` });
        spawnEmbers(L.x, L.y + 2, 9, 26);
        sfx(0.35);
      }
    }
    // a blast on a crystal: 50% chance it detonates like a volcano vent —
    // a bigger boom, fire at the crater and a fan of sparks; the DAMAGE
    // is sparks-only now, a few percent of a missile hit
    for (let q = caveLights.length - 1; q >= 0; q--) {
      const L = caveLights[q];
      if (L.k !== 'cry') continue;
      if (Math.hypot(x - L.x, y - L.y) < r + 10 && Math.random() < 0.5) {
        const cc = `rgba(${L.col},`;
        caveLights.splice(q, 1);
        fx.push({ k: 'flash', x: L.x, y: L.y, r: L.r * 0.8, t: 0, life: 0.2, col: `rgb(${L.col})` });
        fx.push({ k: 'skyflash', t: 0, life: 0.4, col: cc, a: 0.18 });
        boomsAt(L.x, L.y, Math.max(34, L.r * 0.55), 'missile', 1, true, true);
        spawnEmbers(L.x, L.y, 16, L.r * 0.6);
        for (let w = 0; w < 3; w++) firePatches.push({ x: L.x + R(-16, 16), y: surfaceAt(L.x) - 2, life: R(1.5, 3.4), volc: true, soft: 1 });
        shake = Math.min(10, shake + 3);
        sfx(0.8);
      }
    }
  }
  const acc = pushBlastFx(x, y, r, style, nuke);
  fx.push({ k: 'flash', x, y, r: r * 1.6, t: 0, life: nuke ? 0.22 : 0.11, col: `rgb(${acc})` });
  fx.push({ k: 'shock', x, y, r0: r * 0.4, r1: r * (nuke ? 4.2 : 2.2), t: 0, life: nuke ? 0.5 : 0.28 });
  fx.push({ k: 'fire', x, y, r, t: 0, life: nuke ? 1.4 : 0.45, nuke, col: acc });
  if (!noTerr) {
    if (hitCeil) {
      schedule(() => ceilingCrush(x, r * (nuke ? 1.2 : 1)), 0.1);
    } else {
      schedule(() => craterMask(x, r * (nuke ? 1.15 : 1), nuke ? 1.4 : 1.25, 'blast'), 0.12);
      schedule(() => collapseHoles(x, r * 1.15), 0.2);
    }
    schedule(() => spawnChunks(x, y, r, m.chunkN * (nuke ? 1.8 : 1)), 0.16);
    schedule(() => spawnDust(x, y, r, m.dustN * (nuke ? 1.6 : 1)), 0.22);
    const [sa, sb] = blastRange(x, r);
    schedule(() => slump(sa, sb, nuke ? 10 : 5), 0.75);
    volcAgitate(x, y, nuke ? 0.5 : 0.25);
  }
  if (!noDouble && dmg > 0 && volcano && FIERY.includes(style) && !volcano.doused && nearCrater(x, y)) {
    schedule(() => {
      boomsAt(x, y, r * 1.1, style, dmg, noTerr, true);
      volcAgitate(x, y, 0.4);
    }, 0.16);
  }
  if (nuke) {
    // on a ceiling hit the "stem" is the rock COLUMN now — no mushroom
    if (!hitCeil) schedule(() => fx.push({ k: 'mush', x, y: y - r * 0.4, r, t: 0, life: 3.4 }), 0.35);
    if (!noTerr) {
      schedule(() => spawnDust(x, hitCeil ? surfaceAt(x) - r * 0.4 : y - r * 0.6, r * 0.7, m.dustN), 0.5);
      schedule(() => spawnDust(x + R(-r, r), y, r * 0.5, m.dustN * 0.5), 0.75);
      // the center fill: on a CEILING hit it becomes the full-height rock
      // column (growCeilColumn) instead of a harmless floor mound
      schedule(() => { if (hitCeil) growCeilColumn(x, Math.max(30, r * 0.5)); else craterMask(x, r * 0.45, 0.5, 'add', 'ellipse'); }, 0.55);
      schedule(() => {
        const [ga, gb] = blastRange(x, r * 1.1);
        for (let i = ga; i <= gb; i++) {
          const mm = 0.3 * clamp(1 - Math.abs(i * cols.step - x) / (r * 1.1), 0, 1);
          if (mm > 0) cols[i].melt = Math.max(cols[i].melt || 0, mm);
        }
      }, 1.0);
    }
  }
  schedule(() => { for (let k = 0; k < 2; k++) fx.push({ k: 'smoke', x: x + R(-r * 0.4, r * 0.4), y: y - r * 0.3, r: r * 0.22, t: 0, life: 1.2 + R(0, 0.5) }); }, 0.8);
  sfx(r / 45);
  if (dmg > 0) tanks.forEach((tk, i) => {
    if (canHurt(i) && Math.hypot(tk.x - x, tk.y - 6 - y) < r * (nuke ? 3.2 : 2.2)) { damageTank(i, dmg, style, x, y); confirmClose = true; }
  });
}

// the NUKE weapon's FULL impact package — shared by the fired nuke and
// the closing apocalypse
function nukeStrike(x, y, w, noTerr) {
  boomsAt(x, y, w.r, 'nuke', w.dmg, noTerr);
  fx.push({ k: 'skyflash', t: 0, life: 1.1, col: 'rgba(255,246,220,', a: 0.55 });
  schedule(() => fx.push({ k: 'ring', x, y, t: 0, life: 1.0, r0: w.r * 0.5, r1: w.r * 3.8, col: '255,224,150' }), 0.22);
  schedule(() => spawnEmbers(x, y, 26, w.r), 0.5);
  schedule(() => {
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2;
      firePatches.push({ x: x + Math.cos(a) * w.r * 1.15, life: R(2, 3.6) });
    }
  }, 1.1);
  schedule(() => spawnDust(x, y - w.r * 0.8, w.r * 0.6, M().dustN * 0.8), 1.7);
  schedule(() => spawnDust(x + R(-w.r, w.r), y, w.r * 0.5, M().dustN * 0.6), 2.2);
  for (let k = 0; k < 7; k++) {
    schedule(() => fx.push({ k: 'smoke', x: x + R(-w.r * 0.5, w.r * 0.5), y: y - w.r * 0.5, r: w.r * R(0.2, 0.4), t: 0, life: R(2, 3.5) }), 2.0 + k * 0.3);
  }
  schedule(() => { const [sa, sb] = blastRange(x, w.r * 1.4); slump(sa, sb, 10); }, 2.6);
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
  for (let i = 0; i < Math.min(150, r * 3); i++) {
    debris.push({ x: x + R(-r, r), y: surfaceAt(x) - R(50, 130), vx: R(-12, 12), vy: R(-5, 5), rot: 0, vr: 0, s: R(1.5, 3.5), col: col || M().chunks[0], settled: false, life: 10 });
  }
}
function spawnDrops(x, y, n, sp) {
  if (fx.length > 380) return;
  for (let k = 0; k < n; k++) {
    fx.push({ k: 'drop', x: x + R(-4, 4), y: y - 2, vx: R(-sp * 0.6, sp * 0.6), vy: -R(sp * 0.5, sp * 1.05), t: 0, life: R(0.6, 1.3) });
  }
}
function spawnSed(x, y, n) {
  if (fx.length > 380) return;
  for (let k = 0; k < n; k++) {
    fx.push({ k: 'sed', x: x + R(-7, 7), y: y + R(-4, 4), vx: R(-6, 6), vy: R(3, 13), t: 0, life: R(1.4, 3.2), s: R(1, 2.2) });
  }
}
function spawnWisps(x, y, n) {
  if (fx.length > 380) return;
  for (let k = 0; k < n; k++) {
    fx.push({ k: 'wisp', x: x + R(-5, 5), y: y - 2, vx: R(-8, 8), vy: -R(14, 32), ph: R(0, 6.28), t: 0, life: R(0.9, 1.8) });
  }
}
function spawnEmbers(x, y, n, r) {
  if (fx.length > 360) return;
  for (let k = 0; k < n; k++) {
    fx.push({
      k: 'ember',
      x: x + R(-r * 0.35, r * 0.35), y: y - R(0, 10),
      vx: R(-90, 90), vy: -R(120, 320),
      t: 0, life: R(1, 2.2), s: R(1, 2.4)
    });
  }
}

// the PLASMA orb: sticks to its prey, burns it under a hard 46 hp budget
function stepPlasmaOrbs(dt) {
  for (let i = 0; i < fx.length; i++) {
    const f = fx[i];
    if (!f || f.k !== 'plasmaOrb' || f.t >= f.life) continue;
    if (f.tid >= 0) {
      const tk = tanks[f.tid];
      if (!tk || tk.dead || tk.dying) f.tid = -1;
      else {
        f.x += (tk.x - f.x) * Math.min(1, dt * 8);
        f.y += ((tk.y - 10) - f.y) * Math.min(1, dt * 8);
        if (f.t < f.life * 0.6 && (f.dmgDone || 0) < 46) { f.dmgDone = (f.dmgDone || 0) + 9 * dt; damageTank(f.tid, 9 * dt, 'plasma', f.x, tk.y - 10); confirmClose = true; }
      }
    } else if (f.t < f.life * 0.6) {
      tanks.forEach((tk, ti) => {
        if (canHurt(ti) && Math.hypot(tk.x - f.x, (tk.y - 8 - f.y) * 0.7) < f.r * 1.35) f.tid = ti;
      });
    }
    f.eatT += dt;
    if (f.eatT > 0.3) {
      f.eatT = 0;
      craterMask(f.x, f.r * 0.45, 0.22, 'blast', 'star', 1);
      if (Math.random() < 0.5 && fx.length < 380) fx.push({ k: 'wisp', x: f.x + R(-8, 8), y: f.y - 4, vx: R(-6, 6), vy: -R(14, 30), ph: R(0, 6.28), t: 0, life: R(0.6, 1.2) });
      igniteAt(f.x, f.y + 10, 14);
    }
  }
}

function stepFx(dt) {
  shake = Math.max(0, shake - dt * (4 + shake * 4));
  stepPlasmaOrbs(dt);
  fx = fx.filter(f => {
    f.t += dt;
    if (f.k === 'wring') { f.r += f.vr * dt; }
    if (f.k === 'dust') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy *= (1 - dt * 0.6); f.r += 14 * dt; }
    if (f.k === 'smoke') { f.x += (f.vx || 0) * dt + wind * 8 * dt; f.y -= 12 * dt; f.r += 9 * dt; }
    if (f.k === 'vsmoke') { f.x += (f.vx || 0) * dt + wind * 7 * dt; f.y += f.vy * dt; f.vy *= (1 - dt * 0.25); f.r += 7 * dt; }
    if (f.k === 'wisp') { f.x += (f.vx || 0) * dt + Math.sin(gt * 2 + (f.ph || 0)) * 7 * dt; f.y += (f.vy || -20) * dt; }
    if (f.k === 'sed') { f.x += (f.vx || 0) * dt + Math.sin(gt * 3 + f.y * 0.1) * 4 * dt; f.y += (f.vy || 8) * dt; if (f.y >= surfaceAt(f.x) - 1) f.vy = 0; }
    if (f.k === 'bubble') { f.y += f.vy * dt; f.x += Math.sin(gt * 6 + f.wob) * 12 * dt; if (f.y <= waterAt(f.x) + 1) f.t = f.life; }
    if (f.k === 'drop') { f.vy += GRAV * 0.9 * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.vy > 0 && f.y >= waterAt(f.x)) f.t = f.life; }
    if (f.k === 'ember') {
      f.vy += GRAV * 0.55 * dt;
      f.vx += wind * 0.3 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.y >= surfaceAt(f.x) - 1) { f.t = f.life; igniteAt(f.x, f.y + 2, 8); }
      if (UNDER && f.y < ceilAt(f.x)) f.vy = Math.abs(f.vy) * 0.4;
    }
    if (f.k === 'jet') { f.h = Math.min(f.hMax, (f.h === undefined ? f.hMax * 0.25 : f.h) + f.hMax * dt * 1.8); }
    if (f.k === 'lflow') {
      const sl = slopeAt(f.x);
      f.vx += sl * 55 * dt;
      f.vx = clamp(f.vx, -36, 36);
      f.x += f.vx * dt;
      f.tp += dt;
      if (f.tp > 0.06) { f.tp = 0; f.trail.push({ x: f.x, y: surfaceAt(f.x) - 2 }); if (f.trail.length > 46) f.trail.shift(); }
      if (f.x < 3 || f.x > Wc - 3) { f.t = f.life; }
      else {
        f.y = surfaceAt(f.x) - 2;
        const ci = clamp(Math.round(f.x / cols.step), 0, cols.length - 1);
        const c = cols[ci];
        c.burn = Math.max(c.burn, 0.8);
        f.burnT += dt;
        if (f.burnT > 0.5) {
          f.burnT = 0;
          firePatches.push({ x: f.x, y: f.y, life: R(0.8, 1.6), volc: true });
          c.lava = Math.min(24, c.lava + 1.2);
          c.lavaT = Math.min(c.lavaT, 3);
          dirtyA = Math.min(dirtyA, ci); dirtyB = Math.max(dirtyB, ci + 1);
          igniteAt(f.x, f.y + 2, 10, 'lava');
        }
        if (f.y > waterAt(f.x) - 1) { spawnWisps(f.x, waterAt(f.x), 3); f.t = f.life; }
        if (Math.abs(f.vx) < 2.5 && Math.abs(sl) < 0.08 && f.t > 3) {
          c.lava = Math.min(28, c.lava + f.s * 2);
          c.lavaT = 0;
          f.t = f.life;
        }
      }
    }
    return f.t < f.life;
  });
  debris = debris.filter(d => {
    d.life -= dt;
    if (d.life <= 0) return false;
    if (!d.settled) {
      d.vy += GRAV * 0.65 * dt; d.vx += wind * 0.25 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
      if (d.x < 0 || d.x > Wc || d.y > Hc) return false;
      // in a cave the rubble torn off the ceiling still falls DOWN — only
      // the headroom above y<0 clips it
      if (d.y < 0) return false;
      const fl = floorAt(d.x, d.y);
      if (d.y >= fl - d.s / 2 && d.y > waterAt(d.x) - d.s) {
        d.settled = true; d.y = fl - d.s / 2; d.vr = 0;
        const ci = clamp(Math.round(d.x / cols.step), 0, cols.length - 1);
        const c = cols[ci];
        if (d.s > 1.6 && d.y < c.top + 2 && !(c.h1 > 0 && d.y >= c.h0 - 2)) {
          c.top = Math.min(c.top, Math.max(6, d.y + d.s * 0.3));
          dirtyA = Math.min(dirtyA, ci); dirtyB = Math.max(dirtyB, ci);
        }
      }
    } else {
      d.y = floorAt(d.x, d.y) - d.s / 2;
      if (d.y > waterAt(d.x)) return false;
    }
    return true;
  });
  if (debris.length > 240) debris.splice(0, debris.length - 240);
  remains.forEach(rm => {
    if (rm.sunk) return;
    const gy = floorAt(rm.x, rm.y);
    const wy = waterAt(rm.x);
    if (gy > wy) {
      if (rm.y < wy - 6) {
        rm.y += 300 * dt;
        if (rm.y >= wy - 6) {
          rm.sunk = true; rm.falling = false;
          fx.push({ k: 'splash', x: rm.x, y: wy, r: 14, t: 0, life: 0.5 });
          pushRipple(rm.x, 7);
          sinkers.push({ x: rm.x, y: rm.y, t: 0, col: rm.col, hull: rm.hull });
        }
      } else {
        rm.sunk = true; rm.falling = false;
        fx.push({ k: 'splash', x: rm.x, y: wy, r: 14, t: 0, life: 0.5 });
        pushRipple(rm.x, 7);
        sinkers.push({ x: rm.x, y: rm.y, t: 0, col: rm.col, hull: rm.hull });
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
  const burnN = [0, 0];
  firePatches = firePatches.filter(fp => {
    fp.life -= dt;
    const fy = fp.volc && fp.y !== undefined ? fp.y : surfaceAt(fp.x);
    // ANY ground fire — napalm flames or lava fires alike — heats the seam
    // beneath it; lava-kind fires light the geyser variant
    if (fp.life > 0.5) {
      pockets.forEach(pk => {
        if (pk.state === 0 && heatHits(pk, fp.x, fy, 13)) ignitePocket(pk, 13, fp.volc ? 'lava' : 'fire');
      });
    }
    const ci = clamp(Math.round(fp.x / cols.step), 0, cols.length - 1);
    const c = cols[ci];
    c.burn = Math.max(c.burn, 0.5);
    if (!fp.volc && c.h1 <= 0 && c.top < Hc - 8 && Math.random() < dt * 5) {
      c.top += 0.22;
      dirtyA = Math.min(dirtyA, ci); dirtyB = Math.max(dirtyB, ci + 1);
    }
    // `soft` marks the fires of the seams and the cave crystals: they
    // weigh a few percent of a napalm burn in the scald counter
    for (let i = 0; i < tanks.length; i++) {
      const tk = tanks[i];
      if (canHurt(i) && Math.abs(tk.x - fp.x) < 13 && Math.abs(tk.y - fy) < 16) { burnN[i] += fp.soft ? 0.08 : 1; confirmClose = true; }
    }
    return fp.life > 0;
  });
  for (let i = 0; i < tanks.length; i++) {
    if (canHurt(i) && burnN[i]) damageTank(i, Math.min(burnN[i], 2) * 7 * dt, 'napalm', tanks[i].x, tanks[i].y - 10);
  }
}

// persistent hull chunks from overkill deaths
function stepWreckBits(dt) {
  wreckBits = wreckBits.filter(w => {
    if (!w.settled) {
      w.vy += GRAV * 0.65 * dt;
      w.vx += wind * 0.2 * dt;
      w.x += w.vx * dt; w.y += w.vy * dt; w.rot += w.vr * dt;
      if (w.x < 2 || w.x > Wc - 2) return false;
      const wy = waterAt(w.x);
      if (!w.wet && w.y >= wy && surfaceAt(w.x) > wy + 2) {
        w.wet = true;
        fx.push({ k: 'splash', x: w.x, y: wy, r: 7, t: 0, life: 0.35 });
        pushRipple(w.x, 4);
      }
      if (w.wet) {
        w.vx *= (1 - dt * 2);
        w.vy = Math.min(w.vy, 36) * (1 - dt);
        if (Math.random() < dt * 2.5) fx.push({ k: 'bubble', x: w.x + R(-2, 2), y: w.y - w.s, vy: -R(18, 40), wob: R(0, 6.28), t: 0, life: R(0.7, 1.4), s: R(1, 1.8) });
      }
      const fl = floorAt(w.x, w.y);
      if (w.y >= fl - w.s / 2) {
        w.settled = true; w.y = fl - w.s / 2; w.vr = 0;
      }
    } else {
      w.y = floorAt(w.x, w.y) - w.s / 2;
    }
    return w.y < Hc - 2;
  });
  if (wreckBits.length > 46) wreckBits.splice(0, wreckBits.length - 46);
}

// ================= PROJECTILES =================
function integrate(pos, vel, w, dt) {
  vel.vy += GRAV * dt;
  vel.vx += wind * w * WINDF * dt;
  pos.x += vel.vx * dt; pos.y += vel.vy * dt;
}

function currentInv() { return tanks[turn] ? (turn === 0 ? ammoInv : aiAmmo) : ammoInv; }
function currentCur() { return turn === 0 ? cur : (GMODE === 2 ? cur2 : cur); }
function setCurrentCur(v) { if (turn === 0) cur = v; else if (GMODE === 2) cur2 = v; }

function fire() {
  if (state !== 'aim' || turn !== 0 || turnIntro > 0 || !canAct(0)) return;
  syncSeatAim();
  const w = ARSENAL[cur];
  if (ammoInv[w.key] <= 0 && w.ammo !== Infinity) {
    lastHitInfo = w.name + ' закончился — стреляю Missile';
    beep(220, 0.12, 0.2);
    cur = 0; draw(); return;
  }
  if (w.ammo !== Infinity) ammoInv[w.key]--;
  lastHitInfo = '';
  launch(tanks[0], aim.ang, aim.pow, activeDir(), w, 1);
  shots++;
}
function fire2() {
  if (state !== 'aim' || turn !== 1 || GMODE !== 2 || turnIntro > 0 || !canAct(1)) return;
  syncSeatAim();
  const w = ARSENAL[cur2];
  if (aiAmmo[w.key] <= 0 && w.ammo !== Infinity) {
    lastHitInfo = w.name + ' закончился — стреляю Missile';
    beep(220, 0.12, 0.2);
    cur2 = 0; draw(); return;
  }
  if (w.ammo !== Infinity) aiAmmo[w.key]--;
  lastHitInfo = '';
  launch(tanks[1], aim.ang, aim.pow, activeDir(), w, 2);
}

function launch(t, ang, pow, dir, w, who) {
  const rad = ang * Math.PI / 180;
  shotOwner = tanks.indexOf(t);
  if (shotOwner) shots2++;
  t.recoil = 1;
  // last stand: this is the dying fighter's ONE shot
  if (t.dying) { t.lsShot = true; t.lsUntil = Math.min(t.lsUntil, gt + 1.5); }
  const tipX = t.x + Math.cos(rad) * 24 * dir;
  const tipY = t.y - 14 - Math.sin(rad) * 24;
  fx.push({ k: 'flash', x: tipX, y: tipY, r: 11, t: 0, life: 0.08 });
  for (let k = 0; k < 3; k++) fx.push({ k: 'smoke', x: tipX - Math.cos(rad) * (6 + k * 5) * dir, y: tipY + Math.sin(rad) * (6 + k * 5) + R(-2, 2), r: 2.5 + k, t: 0, life: R(0.5, 0.9) });
  fx.push({ k: 'dust', x: t.x, y: t.y, vx: R(-10, 10), vy: -14, r: 4, t: 0, life: 0.5, col: M().dustCol });
  lastWeapon = w.key;
  shot = {
    x: tipX, y: tipY,
    vx: Math.cos(rad) * pow * (VMAX / 100) * dir, vy: -Math.sin(rad) * pow * (VMAX / 100),
    w, trail: [], dir, t0: gt, apex: t.y - 12, rot: 0,
    owner: tanks.indexOf(t), arm: gt + 0.3
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
  if (state !== 'aim' || turn !== 1 || GMODE !== 1 || !canAct(1)) return;
  turn = 3;
  const me = tanks[1], foe = tanks[0];
  const dir = foe.x > me.x ? 1 : -1;
  let w = aiPickWeapon();
  let best = null;
  // mobile guard: the aim grid is searched SYNCHRONOUSLY (up to ~2600
  // simulated flights) — a slow phone freezes for seconds, which reads
  // as a hang right after big blasts settle and the PC's turn begins.
  // Hard wall-clock cap on the search
  const tSearch = performance.now();
  for (let strat = 0; strat < 4; strat++) {
    const angBase = [35, 45, 55, 65][strat];
    for (let ang = angBase - 10; ang <= angBase + 10; ang += 2) {
      if (performance.now() - tSearch > 200) break;
      for (let p = 10; p <= 100; p += 3) {
        const sim = simulateShot(me.x, me.y - 12, ang, p, dir, w.wind);
        if (sim && (!best || Math.abs(sim.x - foe.x) < best.dist)) best = { ang, p, dist: Math.abs(sim.x - foe.x) };
      }
    }
  }
  if (!best) best = { ang: 45, p: 60, dist: 999 };
  const pit = Math.min(surfaceAt(foe.x - 40), surfaceAt(foe.x + 40)) - foe.y;
  if (aiAmmo.DIRT > 0 && pit > 24 && best.dist < 50 && Math.random() < 0.75) {
    w = ARSENAL[8];
  } else if (aiAmmo.DIGGER > 0 && (best.dist > 90 || (me.y - foe.y > 60 && best.dist > 40)) && Math.random() < 0.65) {
    const dy = (me.y - 14) - (foe.y + 24);
    const dx = Math.abs(foe.x - me.x);
    best = { ang: clamp(Math.round(Math.atan2(dy, Math.max(30, dx)) * 180 / Math.PI), 8, 55), p: clamp(Math.round(Math.hypot(dx, dy) / 8.5), 15, 92), dist: 0 };
    w = ARSENAL[7];
  }
  const terr = isTerr(w.type);
  const err = (1 - aiSkill) * (terr ? 0.45 : 1);
  const ang = clamp(best.ang + R(-12, 12) * err, 10, 85);
  const p = clamp(best.p * (1 + R(-0.18, 0.18) * err), 10, 100);
  const start = aiAim; let s = 0;
  const anim = () => {
    s++; aiAim = start + (ang - start) * (s / 14); draw();
    if (s < 14) schedule(anim, 0.03);
    else {
      if (!canAct(1)) return; // died during the aiming animation
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
    if (pos.y > Hc) return null;
    if (pos.x >= 0 && pos.x <= Wc && shotBlocked(pos.x, pos.y)) return { x: pos.x, y: pos.y };
  }
  return null;
}

//scorch.world.js part03
// ============ DIGGER: charge-based bore ============
function digEnter(p) {
  p.digging = true;
  p.sid = ++digSid;
  p.digT = 0;
  if (p.charge === undefined) p.charge = Wc * DIG_LEN;
  p.dugLen = 0;
  const sp = Math.hypot(p.vx, p.vy) || 1;
  let dx = p.vx / sp, dy = clamp(p.vy / sp, -0.55, 0.55);
  const n = Math.hypot(dx, dy) || 1;
  p.dvx = dx / n; p.dvy = dy / n;
  sfx(0.5);
  shake = Math.min(10, shake + 2.5);
  for (let k = 0; k < 8; k++) {
    debris.push({ x: p.x + R(-8, 8), y: surfaceAt(p.x) - R(0, 6), vx: R(-80, 80), vy: -R(120, 260), rot: R(0, 6), vr: R(-7, 7), s: R(1.5, 3.5), col: M().chunks[(Math.random() * M().chunks.length) | 0], settled: false, life: 11 });
  }
}
function digCollapse(p) {
  const N = cols.length;
  const i0 = clamp(Math.round((p.x - 22) / cols.step), 1, N - 2);
  const i1 = clamp(Math.round((p.x + 22) / cols.step), 1, N - 2);
  let did = false;
  for (let i = i0; i <= i1; i++) {
    const c = cols[i];
    if (c.h1 > 0 && c.h1 - c.h0 > DIG_COLLAPSE_H && c.h0 > c.top + 6) {
      if (subsideColumn(i, false) > 0) did = true;
    }
  }
  if (did) {
    // per-column subsidence along the sloped tunnel leaves a comb —
    // settle it into a natural slope right away
    smoothGround(i0 - 4, i1 + 4);
    sfx(0.7);
    shake = Math.min(10, shake + 2.5);
  }
}
function digMotion(p, dt) {
  if (p.y < surfaceAt(p.x) - 4 && !inVoid(p.x, p.y)) {
    p.digging = false;
    const sp = Math.max(Math.hypot(p.vx, p.vy), 240);
    p.vx = p.dvx * sp;
    p.vy = p.dvy * sp - 40;
    return;
  }
  const speed = DIG_SPEED1 + (DIG_SPEED0 - DIG_SPEED1) * Math.pow(1 - clamp(p.dugLen / Math.max(1, p.charge), 0, 1), 1.6);
  p.vx = p.dvx * speed; p.vy = p.dvy * speed;
  const nx = p.x + p.vx * dt;
  const ny = Math.min(p.y + p.vy * dt, Hc - 10);
  if (nx < 4 || nx > Wc - 4) { p.dead = true; p.dug = true; return; }
  carveLine(p.x, p.y, nx, ny, p.w.r * DIG_RADIUS_F, p.sid);
  const mv = Math.hypot(nx - p.x, ny - p.y);
  p.dugLen += mv; p.charge -= mv;
  p.x = nx; p.y = ny;
  p.digT += dt;
  shake = Math.max(shake, 0.8 + Math.sin(gt * 21) * 0.45);
  p.puffT = (p.puffT || 0) + dt;
  if (p.puffT > 0.12) {
    p.puffT = 0;
    const sx = p.x + R(-7, 7);
    fx.push({ k: 'dust', x: sx, y: surfaceAt(sx) - 2, vx: R(-8, 8), vy: -R(10, 26), r: R(1.5, 3), t: 0, life: R(0.4, 0.8), col: M().dustCol });
  }
  if (Math.random() < dt * 4) {
    debris.push({ x: p.x + R(-6, 6), y: surfaceAt(p.x) - R(0, 4), vx: R(-35, 35), vy: -R(50, 140), rot: R(0, 6), vr: R(-5, 5), s: R(1, 2.5), col: M().chunks[(Math.random() * M().chunks.length) | 0], settled: false, life: 10 });
  }
  digCollapse(p);
  p.hitT = Math.max(0, (p.hitT || 0) - dt);
  if (p.hitT <= 0) {
    for (let i = 0; i < tanks.length; i++) {
      const tk = tanks[i];
      if (!canHurt(i)) continue;
      if (Math.abs(tk.x - p.x) < 15 && p.y > tk.y - 40 && p.y < tk.y + 10) {
        p.hitT = 0.45;
        damageTank(i, 14, 'digger', p.x, p.y);
        break;
      }
    }
  }
  if (volcano && inVolcCone(p.x, p.y)) {
    p.dead = true;
    p.breach = { x: p.x, y: p.y };
    return;
  }
  if (p.charge <= 0 || p.digT > 24) { p.dead = true; p.dug = true; }
}

function updateProjectile(p, dt) {
  if (!p.inWater) p.trail.push({ x: p.x, y: p.y, t: gt });
  while (p.trail.length > 90 || (p.trail.length && gt - p.trail[0].t > trailLife(p.w))) p.trail.shift();
  p.rot += dt * 6;
  if (p.y < p.apex) p.apex = p.y;

  if (p.w.type === 'digger') {
    if (p.digging) { digMotion(p, dt); return; }
    if (shotBlocked(p.x, p.y)) { digEnter(p); digMotion(p, dt); return; }
  }

  integrate(p, p, p.w.wind, dt);
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

  if (!p.digging) {
    if (volcano && inVolcCone(p.x, p.y)) {
      p.dead = true;
      p.breach = { x: p.x, y: p.y };
      return;
    }
    if (lavaBits.length) {
      for (let i = 0; i < lavaBits.length; i++) {
        const lb = lavaBits[i];
        if (Math.abs(lb.x - p.x) < 10 && Math.abs(lb.y - p.y) < 10) {
          lavaBits.splice(i, 1);
          p.dead = true;
          p.intercept = { x: (p.x + lb.x) / 2, y: (p.y + lb.y) / 2 };
          break;
        }
      }
      if (p.dead) return;
    }
  }

  if (p.x >= 0 && p.x <= Wc) {
    // the CAVE CEILING: any projectile (drill included) hitting the
    // inverted ground detonates there — boomsAt then decides floor vs
    // ceiling by proximity and collapses the rock
    if (UNDER && !p.digging && p.y <= ceilAt(p.x)) { p.dead = true; return; }
    if (!isTerr(p.w.type)) {
      // SWEPT hull test: a fast flat shot moves up to |v|*dt px per frame
      // (40+px on a slow phone) and can jump clean over the 32px hull
      // box in one step — that was the PC's direct shots flying through
      // the turret. Sample the whole prev→cur segment in ≤9px steps
      const nseg = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * dt / 9));
      for (let s = 0; s < nseg && !p.dead; s++) {
        const hx = p.x - p.vx * dt * (1 - (s + 0.5) / nseg);
        const hy = p.y - p.vy * dt * (1 - (s + 0.5) / nseg);
        tanks.forEach((tk, i) => {
          if (p.dead || !canHurt(i)) return;
          if (i === p.owner && gt < (p.arm || 0)) return;
          if (Math.abs(hx - tk.x) < 16 && hy > tk.y - 34 && hy < tk.y + 8) {
            p.dead = true;
            if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
            else { damageTank(i, p.w.dmg, p.w.type, hx, hy); confirmClose = true; }
          }
        });
      }
      if (p.dead) return;
    }
    const surf = surfaceAt(p.x);
    if (p.w.type === 'roller' && !p.rollDrop && p.y >= surf - 6 && p.y < surf + 16) {
      const c = colAt(p.x);
      if (c.h1 > 0 && c.h0 <= c.top + 2) { p.rollDrop = true; return; }
      if (c.lava > 2) { p.dead = true; p.y = surf - 4; return; } // rolled into a lava pool: detonate
      if (surf > waterLevel + 4) { p.dead = true; p.wet = true; return; }
      const sl = slopeAt(p.x);
      p.vx += sl * 1200 * dt;
      p.vx *= (1 - dt * 0.25);
      p.vy = 0; p.y = surf - 4; p.rot += p.vx * dt * 0.4;
      p.rollT = (p.rollT || 0) + dt;
      if (Math.random() < dt * 8) craterMask(p.x, 6, 0.4, 'blast', 'circle');
      const slow = Math.abs(p.vx) < 7 && Math.abs(sl) < 0.12;
      if (p.rollT > 6 || slow) p.dead = true;
      tanks.forEach((tk, i) => {
        if (canHurt(i) && Math.abs(p.x - tk.x) < 13) {
          p.dead = true;
          if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
          else { damageTank(i, p.w.dmg, 'roller', p.x, p.y); confirmClose = true; }
        }
      });
      return;
    }
    const yw = waterAt(p.x);
    const tun = inVoid(p.x, p.y);
    if (!p.inWater && p.y >= yw && (surf > waterLevel + 4 || tun)) {
      p.inWater = true;
      p.trail.length = 0;
      p.vx = 0;
      p.vy = clamp(p.vy, 0, 60);
      if (p.w.water === 'sink' && !tun) {
        fx.push({ k: 'splash', x: p.x, y: yw, r: 9, t: 0, life: 0.4 });
        pushRipple(p.x, 6);
      }
    }
    if (p.inWater) {
      p.vy += GRAV * 0.3 * dt;
      p.vy *= (1 - dt * 2.4);
      p.vx *= (1 - dt * 1.8);
      if (p.w.water === 'sink') {
        if (fx.length < 380 && Math.random() < dt * 4) fx.push({ k: 'bubble', x: p.x + R(-3, 3), y: p.y - 5, vy: -R(25, 55), wob: R(0, 6.28), t: 0, life: R(1, 2), s: R(1, 2.2) });
        const fl = inVoid(p.x, p.y) ? (colAt(p.x).h1 || surf) : surf;
        if (p.y >= fl) { p.dead = true; p.sunkSilent = true; return; }
        return;
      }
      if (fx.length < 380 && Math.random() < dt * 9) fx.push({ k: 'bubble', x: p.x + R(-3, 3), y: p.y - 5, vy: -R(25, 55), wob: R(0, 6.28), t: 0, life: R(1, 2), s: R(1, 2.6) });
      const fl = inVoid(p.x, p.y) ? (colAt(p.x).h1 || surf) : surf;
      if (p.y >= fl) { p.dead = true; p.wet = true; p.bed = true; return; }
      return;
    }
    if (p.w.type === 'digger') {
      if (shotBlocked(p.x, p.y)) { digEnter(p); digMotion(p, dt); return; }
    } else if (shotBlocked(p.x, p.y)) p.dead = true;
  }
}

function updateLiquid(l, dt) {
  l.vy += GRAV * 0.3 * dt;
  l.vx += wind * 0.5 * WINDF * dt;
  l.x += l.vx * dt; l.y += l.vy * dt;
  l.t += dt;
  if (l.x < 0 || l.x > Wc || l.y > Hc) { l.dead = true; return; }
  // napalm sloshing against the cave ceiling drips back down
  if (UNDER && l.y <= ceilAt(l.x)) { l.y = ceilAt(l.x) + 1; l.vy = Math.abs(l.vy) * 0.45 + 20; }
  if (l.y >= waterAt(l.x) && surfaceAt(l.x) > waterLevel + 4) { l.dead = true; fx.push({ k: 'splash', x: l.x, y: waterAt(l.x), r: 12, t: 0, life: 0.5 }); pushRipple(l.x, 5); return; }
  if (l.y >= surfaceAt(l.x) && !inVoid(l.x, l.y)) {
    firePatches.push({ x: l.x, y: l.y, life: R(4, 7) });
    l.dead = true;
    return;
  }
}

// ================= WEAPON IMPACTS =================
function resolveHit(p) {
  if (p.sunkSilent) { state = 'boom'; lastShotApex = p.apex || 0; endTurnWaterSink(); return; }
  if (p.wet) { wetHit(p); return; }
  const w = p.w, x = p.x, y = p.y;
  state = 'boom';
  lastShotApex = p.apex || 0;
  if (p.intercept) {
    boomsAt(p.intercept.x, p.intercept.y, Math.max(20, w.r * 0.55), 'missile', Math.round(w.dmg * 0.7));
    for (let k = 0; k < 6; k++) {
      if (lavaBits.length > 55) break;
      lavaBits.push({ x: p.intercept.x + R(-3, 3), y: p.intercept.y, vx: R(-90, 90), vy: -R(60, 160), t: 0, life: R(1.2, 2.2), s: R(1.4, 2.4) });
    }
    return;
  }
  if (p.breach) {
    volcBreach(p.breach.x, p.breach.y, w);
    for (let k = 0; k < 8; k++) {
      const dx = p.breach.x + R(-12, 12);
      debris.push({ x: dx, y: surfaceAt(dx) - R(4, 18), vx: R(-50, 50), vy: -R(90, 200), rot: R(0, 6), vr: R(-6, 6), s: R(1.5, 3.5), col: M().chunks[(Math.random() * M().chunks.length) | 0], settled: false, life: 12 });
    }
    return;
  }
  const ang = Math.atan2(p.vy, p.vx);
  const nearCeil = UNDER && (y - ceilAt(x)) < (surfaceAt(x) - y);
  switch (w.type) {
    case 'missile':
      boomsAt(x, y, w.r, 'missile', w.dmg);
      break;
    case 'funky': {
      const n = 8;
      for (let i = 0; i < n; i++) {
        schedule(() => {
          const bx = x + R(-w.r * 1.4, w.r * 1.4);
          const by = y + R(-w.r * 0.8, w.r * 0.4);
          const br = w.r * R(0.35, 0.6);
          const fc = ['#a29bff', '#ffd23f', '#ff6b9d', '#7bffc4'][(Math.random() * 4) | 0];
          fx.push({ k: 'flash', x: bx, y: by, r: br * 1.4, t: 0, life: 0.09, col: fc });
          fx.push({ k: 'star', x: bx, y: by, r: br, t: 0, life: 0.28, col: '185,165,255', spikes: 7, rot: R(0, 6.28) });
          igniteAt(bx, by, br);
          if (UNDER && (by - ceilAt(bx)) < (surfaceAt(bx) - by)) ceilingCrush(bx, br);
          else craterMask(bx, br, 1, 'blast', 'circle');
          spawnChunks(bx, by, br, 6);
          collapseHoles(bx, br * 1.2);
          sfx(0.25);
          tanks.forEach((tk, ti) => {
            if (canHurt(ti) && Math.hypot(tk.x - bx, tk.y - 6 - by) < br * 1.7) {
              if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
              else { damageTank(ti, w.dmg, 'funky', bx, by); confirmClose = true; }
            }
          });
          const [fa, fb] = blastRange(bx, br);
          schedule(() => slump(fa, fb, 3), 0.45);
        }, 0.24 * i + R(0, 0.06));
      }
      schedule(() => boomsAt(x, y, w.r, 'funky', w.dmg), n * 0.24 + 0.25);
      break;
    }
    case 'death': {
      hitFx(x, y, w.r, true);
      pushBlastFx(x, y, w.r, 'death', true);
      fx.push({ k: 'flash', x, y, r: w.r * 2, t: 0, life: 0.16, col: 'rgb(255,214,90)' });
      fx.push({ k: 'skyflash', t: 0, life: 0.5, col: 'rgba(255,236,200,', a: 0.3 });
      fx.push({ k: 'shock', x, y, r0: w.r * 0.5, r1: w.r * 3.4, t: 0, life: 0.55 });
      fx.push({ k: 'shock', x, y, r0: w.r * 0.2, r1: w.r * 2.2, t: 0, life: 0.35 });
      fx.push({ k: 'fire', x, y, r: w.r, t: 0, life: 1.4, nuke: true, col: BLAST_COL.death });
      igniteAt(x, y, w.r);
      if (UNDER) hitVents(x, y, w.r);
      if (nearCeil) schedule(() => ceilingCrush(x, w.r * 1.3), 0.12);
      else schedule(() => craterMask(x, w.r, 1.45, 'blast', 'ellipse'), 0.12);
      schedule(() => spawnChunks(x, y, w.r, M().chunkN * 1.6), 0.15);
      schedule(() => spawnDust(x, y, w.r, M().dustN * 1.4), 0.2);
      schedule(() => spawnDust(x + R(-w.r, w.r), y, w.r * 0.6, M().dustN * 0.6), 0.45);
      if (!nearCeil) schedule(() => collapseHoles(x, w.r * 1.3), 0.2);
      schedule(() => spawnEmbers(x, y, 18, w.r), 0.55);
      schedule(() => fx.push({ k: 'jet', x, y: surfaceAt(x) - 4, w: w.r * 0.5, hMax: w.r * 2.2, t: 0, life: 1.5 }), 0.7);
      schedule(() => spawnDust(x, y - w.r * 0.5, w.r * 0.5, M().dustN * 0.7), 1.3);
      const [sa, sb] = blastRange(x, w.r * 1.25);
      schedule(() => slump(sa, sb, 9), 0.8);
      for (let k = 0; k < 4; k++) schedule(() => fx.push({ k: 'smoke', x: x + R(-w.r * 0.4, w.r * 0.4), y: y - w.r * 0.3, r: w.r * 0.25, t: 0, life: R(1.6, 2.8) }), 1.2 + k * 0.35);
      if (volcano && !volcano.doused && nearCrater(x, y)) {
        schedule(() => { boomsAt(x, y, w.r, 'death', w.dmg, false, true); volcAgitate(x, y, 0.4); }, 0.16);
      }
      sfx(1.2);
      tanks.forEach((tk, i) => {
        if (canHurt(i) && Math.hypot(tk.x - x, tk.y - 6 - y) < w.r * 2.6) {
          if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
          else { damageTank(i, w.dmg, 'death', x, y); confirmClose = true; }
        }
      });
      break;
    }
    case 'nuke': {
      nukeStrike(x, y, w);
      break;
    }
    case 'plasma': {
      hitFx(x, y, w.r * 0.45, false);
      pushBlastFx(x, y, w.r * 0.8, 'plasma', false);
      const GW = 34;
      const grid = new Uint8Array(GW * GW);
      for (let gy = 0; gy < GW; gy++) {
        for (let gx = 0; gx < GW; gx++) {
          const dx = (gx - GW / 2 + 0.5) / (GW * 0.36);
          const dy = (gy - GW / 2 + 0.5) / (GW * 0.36);
          grid[gy * GW + gx] = Math.random() < clamp(0.6 - Math.hypot(dx, dy) * 0.55, 0.05, 0.6) ? 1 : 0;
        }
      }
      let ti = -1;
      tanks.forEach((tk, i) => { if (ti < 0 && canHurt(i) && Math.hypot(tk.x - x, (tk.y - 8 - y) * 0.7) < w.r * 1.35) ti = i; });
      const ox = ti >= 0 ? tanks[ti].x : x;
      const oy = ti >= 0 ? tanks[ti].y - 10 : y;
      fx.push({ k: 'plasmaOrb', x: ox, y: oy, r: w.r, t: 0, life: 3.0, gw: GW, grid, gen: 0, tid: ti, eatT: 0, dmgDone: 0 });
      fx.push({ k: 'skyflash', t: 0, life: 0.4, col: 'rgba(255,120,80,', a: 0.22 });
      schedule(() => craterMask(x, w.r * 0.4, 0.25, 'blast', 'star', 1), 0.05);
      igniteAt(x, y, w.r * 0.8);
      [0.25, 0.9].forEach(dl => {
        schedule(() => fx.push({ k: 'ring', x, y, t: 0, life: 0.8, r0: w.r * 0.3, r1: w.r * 2.2, col: '255,90,50' }), dl);
      });
      volcAgitate(x, y, 0.25);
      if (ti >= 0) { damageTank(ti, w.dmg, 'plasma', x, y); confirmClose = true; }
      sfx(0.7);
      break;
    }
    case 'napalm': {
      pushBlastFx(x, y, w.r * 0.6, 'napalm', false);
      fx.push({ k: 'flash', x, y, r: w.r * 0.6, t: 0, life: 0.08, col: '#ffb84a' });
      for (let i = 0; i < 14; i++) liquids.push({ x: x + R(-w.r / 2, w.r / 2), y, vx: R(-45, 45), vy: R(-100, -25), t: 0, w });
      firePatches.push({ x, y, life: R(4, 7) });
      igniteAt(x, y + 8, w.r * 0.5);
      if (UNDER) hitVents(x, y, w.r * 0.5);
      schedule(() => craterMask(x, w.r * 0.5, 0.35, 'blast', 'ellipse'), 0.6);
      schedule(() => { for (let k = 0; k < 2; k++) liquids.push({ x: x + R(-w.r / 2, w.r / 2), y: y - 6, vx: R(-60, 60), vy: -R(80, 160), t: 0, w }); }, 0.9);
      volcAgitate(x, y, 0.18);
      if (volcano && !volcano.doused && nearCrater(x, y)) {
        schedule(() => { boomsAt(x, y - 4, w.r * 0.85, 'missile', 30, false, true); volcAgitate(x, y, 0.4); }, 0.16);
      }
      sfx(0.4);
      break;
    }
    case 'roller':
      boomsAt(x, y, w.r, 'roller', w.dmg);
      break;
    case 'digger': {
      hitFx(x, y, w.r * 0.4, false);
      if (p.dug) {
        boomsAt(x, y, 30, 'missile', 38);
        for (let k = 0; k < 10; k++) {
          const dx = x + R(-14, 14);
          debris.push({ x: dx, y: surfaceAt(dx) - R(4, 20), vx: R(-40, 40), vy: -R(80, 200), rot: R(0, 6), vr: R(-6, 6), s: R(1.5, 3.5), col: M().chunks[(Math.random() * M().chunks.length) | 0], settled: false, life: 12 });
        }
        fx.push({ k: 'dustc', x, y: surfaceAt(x) - 10, r: 14, t: 0, life: 0.9, col: M().dustCol });
      } else if (nearCeil) {
        // a drill rammed into the cave ceiling: it gouges the inverted
        // ground and the mass rains down
        ceilingCrush(x, w.r * 0.9);
        fx.push({ k: 'shock', x, y, r0: 6, r1: w.r, t: 0, life: 0.25 });
        sfx(0.4);
      } else {
        fx.push({ k: 'shock', x, y, r0: 6, r1: w.r, t: 0, life: 0.25 });
        digTrench(x, y, ang, w.r * 1.7, w.r * DIG_RADIUS_F);
        sfx(0.4);
      }
      break;
    }
    case 'dirt': {
      if (nearCeil) {
        // a Dirt Ball bursting against the ceiling buries the floor below
        ceilingCrush(x, w.r);
        spawnDirtFall(x, w.r);
      } else {
        craterMask(x, w.r, 1, 'add', 'ellipse');
        spawnDirtFall(x, w.r);
      }
      fx.push({ k: 'dustc', x, y: surfaceAt(x) - w.r * 0.5, r: w.r * 0.5, t: 0, life: 1.2, col: M().dustCol });
      const [sa, sb] = blastRange(x, w.r * 1.2);
      schedule(() => slump(sa, sb, 10), 0.9);
      if (nearVolcano(x, y) && gt > volcano.doused) {
        volcano.doused = gt + 6.5;
        volcano.craters.forEach(cr => spawnWisps(cr.x, cr.y - 2, 4));
        sfx(0.5);
      }
      sfx(0.35);
      break;
    }
    case 'mirv': break;
  }
}

function endTurnWaterSink() {
  killed = null;
  state = 'wait';
  schedule(() => { state = 'aim'; if (GMODE === 2) handOverTurn(); else { turnOrder = 1 - turnOrder; turn = turnOrder; turnTimer = TURN_TIME; warnedAt = {}; } draw(); }, 0.6);
}

function wetHit(p) {
  state = 'boom';
  lastShotApex = p.apex || 0;
  const w = p.w, x = p.x, y = p.y;
  const yw = waterAt(x);
  if (p.bed) {
    if (w.water === 'bottom') {
      hitFx(x, y, w.r, true);
      pushBlastFx(x, y, w.r, w.type, true);
      fx.push({ k: 'wcol', x, y: yw, r: w.r, t: 0, life: 1.1 });
      fx.push({ k: 'splash', x, y: yw, r: w.r * 0.45, t: 0, life: 0.6 });
      spawnDrops(x, yw, 16, w.r * 2);
      spawnSed(x, y - 2, 16);
      pushRipple(x, 14);
      schedule(() => craterMask(x, w.r * 0.8, 1.35, 'blast', 'ellipse'), 0.12);
      const [sa, sb] = blastRange(x, w.r * 1.1);
      schedule(() => slump(sa, sb, 6), 0.75);
      sfx(1.1);
      tanks.forEach((tk, i) => {
        if (canHurt(i) && Math.hypot(tk.x - x, tk.y - 6 - y) < w.r * 2.4) { damageTank(i, w.dmg, 'death', x, y); confirmClose = true; }
      });
    } else if (w.type === 'digger') {
      spawnSed(x, y - 2, 10);
      fx.push({ k: 'bubble', x: x + R(-4, 4), y: y - 6, vy: -R(30, 60), wob: R(0, 6.28), t: 0, life: 1.5, s: R(1.5, 3) });
      digTrench(x, y, Math.atan2(p.vy, p.vx), w.r * 1.6, w.r * DIG_RADIUS_F);
      sfx(0.4);
    } else if (w.type === 'dirt') {
      spawnSed(x, y - 2, 14);
      craterMask(x, w.r, 1, 'add', 'ellipse');
      const [sa, sb] = blastRange(x, w.r * 1.2);
      schedule(() => slump(sa, sb, 9), 0.9);
      sfx(0.35);
    } else {
      spawnSed(x, y - 2, 8);
      fx.push({ k: 'bubble', x: x + R(-4, 4), y: y - 6, vy: -R(30, 60), wob: R(0, 6.28), t: 0, life: 1.5, s: R(1.5, 3) });
      sfx(0.2);
    }
    return;
  }
  if (w.water === 'fizzle') {
    spawnWisps(x, yw, 6);
    fx.push({ k: 'splash', x, y: yw, r: 9, t: 0, life: 0.4 });
    pushRipple(x, 5);
    sfx(0.15);
    return;
  }
  boomsAt(x, yw, w.r, w.type === 'nuke' ? 'nuke' : w.type, w.dmg, true);
  spawnDrops(x, yw, 12, w.r * 2);
  pushRipple(x, 12);
  if (w.type === 'funky') {
    for (let i = 0; i < 4; i++) schedule(() => fx.push({ k: 'flash', x: x + R(-w.r, w.r), y: yw - R(2, 16), r: w.r * 0.35, t: 0, life: 0.1, col: ['#a29bff', '#ffd23f', '#ff6b9d', '#7bffc4'][(Math.random() * 4) | 0] }), 0.11 * i);
  }
}

// ============ DAMAGE / DEATH / LAST STAND ============
function enterLastStand(i) {
  const t = tanks[i];
  t.hp = 0; t.dying = true; t.lsUntil = gt + LAST_STAND; t.lsShot = false;
  lastHitInfo = `${players[i].name}: ПОСЛЕДНИЙ ВЫСТРЕЛ!`;
  fx.push({ k: 'flash', x: t.x, y: t.y - 14, r: 20, t: 0, life: 0.25, col: 'rgb(255,90,60)' });
  beep(660, 0.15, 0.2);
}
function damageTank(i, baseDmg, style, x, y) {
  const t = tanks[i];
  if (!canHurt(i) || baseDmg <= 0) return;
  if (style === 'lava') {
    t.hp -= baseDmg;
    popDmg(t, baseDmg);
    confirmClose = true;
    if (t.hp <= 0) killTank(i, 'weapon', 'lava', t.hp);
    return;
  }
  const d = Math.hypot(t.x - x, (t.y - 6 - y) * 0.55);
  const wref = ARSENAL.find(w => w.key === style || w.type === style);
  const r = wref ? wref.r : 30;
  const factor = clamp(1 - d / (r * 2.1), 0.18, 1);
  const dmg = baseDmg * factor;
  t.hp -= dmg;
  lastHitInfo = `${players[i].name}: -${Math.round(dmg)} hp`;
  t.dmgAcc = (t.dmgAcc || 0) + dmg;
  if (t.dmgAcc >= 9) { popDmg(t, t.dmgAcc); t.dmgAcc = 0; }
  if (t.hp <= 0) killTank(i, 'weapon', style, t.hp);
  else if (dmg >= 25) fx.push({ k: 'fire', x: t.x, y: t.y - 12, r: 16, t: 0, life: 0.3 });
}

// killTank is the ONE death gate
function killTank(i, cause, style, overkill) {
  const t = tanks[i];
  if (t.dead) return;
  if (cause === 'weapon' && state === 'aim' && turn === i && !t.dying) { enterLastStand(i); return; }
  t.dead = true; t.dying = false; killed = i; lastKillMethod = cause;
  if (cause === 'drown') {
    sinkers.push({ x: t.x, y: t.y, t: 0, col: t.col, hull: t.hull });
    fx.push({ k: 'splash', x: t.x, y: waterAt(t.x), r: 14, t: 0, life: 0.5 });
    pushRipple(t.x, 10);
  } else if (cause === 'crush') {
    fx.push({ k: 'dustc', x: t.x, y: t.y - 10, r: 20, t: 0, life: 0.8, col: M().dustCol });
    remains.push({ x: t.x, y: t.y, col: t.col, hull: t.hull, style: 'sand', falling: false, sunk: false, wreck: 2 });
  } else if (style === 'nuke' || (overkill !== undefined && overkill < -15)) {
    obliterateTank(t);
  } else {
    boomsAt(t.x, t.y - 10, 34, 'missile', 0);
    remains.push({ x: t.x, y: t.y, col: t.col, hull: t.hull, style: style || 'plain', falling: true, sunk: false, wreck: 1 });
    tankParts(t);
  }
}
function obliterateTank(t) {
  hitFx(t.x, t.y - 12, 46, true);
  pushBlastFx(t.x, t.y - 12, 46, 'nuke', true);
  fx.push({ k: 'flash', x: t.x, y: t.y - 12, r: 64, t: 0, life: 0.18, col: 'rgb(255,244,214)' });
  fx.push({ k: 'shock', x: t.x, y: t.y - 12, r0: 12, r1: 92, t: 0, life: 0.5 });
  fx.push({ k: 'fire', x: t.x, y: t.y - 12, r: 38, t: 0, life: 1.1, nuke: true });
  sfx(1.3);
  shake = Math.min(12, shake + 7);
  const hullCols = ['#7a7a7a', '#4d545c', t.col, '#5a6168'];
  for (let k = 0; k < 7; k++) {
    const a = R(-Math.PI, Math.PI);
    const sp = R(90, 330);
    wreckBits.push({
      x: t.x + R(-8, 8), y: t.y - 14 + R(-8, 8),
      vx: Math.cos(a) * sp, vy: -Math.abs(Math.sin(a)) * sp * 1.1,
      rot: R(0, 6.28), vr: R(-6, 6),
      s: R(3.5, 7), col: hullCols[(Math.random() * hullCols.length) | 0],
      settled: false, wet: false
    });
  }
  for (let k = 0; k < 22; k++) {
    const a = R(-Math.PI, Math.PI);
    const sp = R(120, 430);
    debris.push({
      x: t.x + R(-8, 8), y: t.y - 14 + R(-9, 9),
      vx: Math.cos(a) * sp, vy: -Math.abs(Math.sin(a)) * sp * (1.15 - k / 40),
      rot: R(0, 6.28), vr: R(-9, 9),
      s: R(1.5, 4),
      col: k % 3 === 0 ? '#7a7a7a' : t.col,
      settled: false, life: 13
    });
  }
  spawnEmbers(t.x, t.y - 12, 22, 44);
  for (let k = 0; k < 3; k++) schedule(() => fx.push({ k: 'smoke', x: t.x + R(-10, 10), y: t.y - 18, r: R(4, 8), t: 0, life: R(1.6, 2.6) }), 0.3 + k * 0.35);
}
function tankParts(t) {
  for (let k = 0; k < 13; k++) {
    debris.push({ x: t.x + R(-8, 8), y: t.y - 10, vx: R(-90, 90), vy: R(-180, -60), rot: R(0, 6), vr: R(-8, 8), s: R(2, k === 0 ? 7 : 4), col: k % 3 === 0 ? '#7a7a7a' : t.col, settled: false, life: 12 });
  }
}

function endTurn() {
  state = 'aim';
  if (GMODE === 2) handOverTurn();
  else {
    turnOrder = 1 - turnOrder;
    turn = turnOrder;
    turnTimer = TURN_TIME;
    warnedAt = {};
    draw();
  }
}
function endRound() {
  state = 'wait';
  schedule(() => resolveRound(), 1.3);
}
function resolveRound() {
  const d0 = tanks[0].dead, d1 = tanks[1].dead;
  killed = null;
  let res = null;
  if (d0 && d1) res = 'draw';
  else if (d1) res = 'win';
  else if (d0) res = 'lose';
  if (!res) { endTurn(); return; }
  // fair scoring: the SAME formula runs for whoever wins — time, weapon
  // class, apex, kill method and the winner's OWN shot economy; the loser
  // gets a small consolation by his own shots. The computer used to earn
  // a flat 120 against the human's 200-600
  if (res === 'draw') {
    score += 30;
    score2 += 30;
  } else {
    const winIdx = res === 'win' ? 0 : 1;
    const loseIdx = 1 - winIdx;
    const winShots = winIdx === 0 ? shots : shots2;
    const loseShots = winIdx === 0 ? shots2 : shots;
    const dt = (Date.now() - roundStart) / 1000;
    let pts = 100;
    pts += Math.max(0, Math.round(300 - dt * 2));
    if (['MISSILE', 'ROLLER', 'DIGGER', 'DIRT'].includes(lastWeapon)) pts = Math.round(pts * 1.5);
    if (lastShotApex < tanks[loseIdx].y - 120) pts += 120;
    if (lastKillMethod === 'drown') pts += 150;
    if (lastKillMethod === 'crush') pts += 120;
    pts += Math.max(0, 40 - winShots * 8);
    if (winIdx === 0) {
      wins++;
      score += pts;
      score2 += Math.max(0, Math.round(30 - loseShots));
      aiSkill = Math.min(0.95, aiSkill + 0.08);
    } else {
      wins2++;
      score2 += pts;
      score += Math.max(0, Math.round(30 - loseShots));
      aiSkill = Math.max(0.2, aiSkill - 0.05);
    }
  }
  let kind = res, whoIdx = 0;
  if (res === 'draw') { kind = 'draw'; whoIdx = -1; }
  else if (GMODE === 2) {
    const wi = res === 'win' ? 0 : 1;
    const useWin = Math.random() < 0.5;
    kind = useWin ? 'win' : 'lose';
    whoIdx = useWin ? wi : 1 - wi;
  } else {
    kind = res;
    whoIdx = 0;
  }
  const who = whoIdx >= 0 ? players[whoIdx] : null;
  const list = BANNERS[kind];
  const txt = list[(Math.random() * list.length) | 0].replace('{N}', who ? who.name : '');
  const bcol = who ? who.col : BANNER_COL.draw;
  fx.push({ k: 'banner', txt, col: bcol, t: 0, life: 2.3 });
  if (round >= ROUNDS_MAX) { schedule(() => showOver(), 2.3); return; }
  schedule(() => newRound(false), 2.3);
}

// ================= GROUND SNOW / SAND GRAINS =================
function newGrain() {
  const x = R(0, Wc);
  const ci = clamp(Math.round(x / cols.step), 0, cols.length - 1);
  const c = cols[ci];
  if (c.h1 > 0 || c.burn > 0.2 || c.surf <= 0 || c.lava > 0) return null;
  const sy = c.top;
  if (sy < 12 || sy > waterAt(x) - 4) return null;
  const N = cols.length;
  const nb = Math.min(cols[clamp(ci - 2, 0, N - 1)].top, cols[clamp(ci + 2, 0, N - 1)].top);
  if (sy >= nb - 1) return null;
  const sl = Math.abs(slopeAt(x));
  if (Math.random() > clamp(0.85 - sl * 4, 0.1, 0.85)) return null;
  c.top += 0.9;
  dirtyA = Math.min(dirtyA, ci); dirtyB = Math.max(dirtyB, ci + 1);
  return { x, y: sy - 2, vx: wind * R(30, 60), vy: -R(4, 16), t: 0, s: R(1.4, 2.4), val: 0.9 };
}
function bakeGrain(g) {
  if (!g.val) return;
  const N = cols.length;
  const ci = clamp(Math.round(g.x / cols.step), 0, N - 1);
  const c = cols[ci];
  if (c.h1 > 0 || c.top < 8) return;
  const nb = Math.min(cols[clamp(ci - 2, 0, N - 1)].top, cols[clamp(ci + 2, 0, N - 1)].top);
  c.top = Math.max(c.top - g.val, nb - 5);
  dirtyA = Math.min(dirtyA, ci); dirtyB = Math.max(dirtyB, ci + 1);
}
function stepGrains(dt) {
  if (!biome.mat.drift || !cols) { grains.length = 0; return; }
  const want = Math.round(clamp(Math.abs(wind) * 22, 12, 100));
  let guard = 0;
  while (grains.length < want && guard++ < 240) {
    const g = newGrain();
    if (g) grains.push(g);
  }
  grains = grains.filter(g => {
    g.t += dt;
    if (g.t > 9) { bakeGrain(g); return false; }
    g.vx += (wind * 55 - g.vx) * dt * 1.8;
    g.vy += GRAV * 0.5 * dt;
    if (g.y < surfaceAt(g.x) - 24) g.vy += GRAV * 0.8 * dt;
    g.x += g.vx * dt; g.y += g.vy * dt;
    if (g.x < 1) { g.x += Wc - 2; } else if (g.x > Wc - 1) { g.x -= Wc - 2; }
    const wy = waterAt(g.x);
    if (g.y >= wy && surfaceAt(g.x) > wy + 2) {
      if (Math.random() < 0.25) pushRipple(g.x, 1.4);
      return false;
    }
    const sy = surfaceAt(g.x);
    if (g.y >= sy - 1) {
      const sl = slopeAt(g.x);
      const climb = sl * (g.vx > 0 ? 1 : -1) < -0.02;
      let stickP = 0.2 + clamp(Math.abs(sl) * 3.5, 0, 0.55);
      if (climb) stickP += 0.25;
      if (Math.abs(g.vx) < 16) stickP = 1;
      if (Math.random() < stickP) { bakeGrain(g); return false; }
      g.y = sy - 1;
      g.vy = -R(10, 36) * clamp(Math.abs(g.vx) / 90, 0.2, 1);
      g.vx *= 0.86;
    }
    return g.y < Hc;
  });
}

// ================= RARE EVENTS: sandworm & orbital junk =================
// the worm (desert/rust): up to twice per round by the round's plan (half
// the rounds see none); it enters from a flank at depth, from below, or
// just under the cave ceiling, crosses in ~10s, breaches out of the sand,
// swims across water, scorches in the volcano, swallows cave crystals,
// blows up searchlights and grinds through turrets; seams ignite from the
// churn, and the tunnel subsides behind it by the digger's void rule
function spawnWorm() {
  // in a cave it CRAWLS — hugging the ceiling or the floor; on the
  // surface it crosses at depth. Dune proportions: a THIRD thicker and
  // half as long. The WHOLE trajectory is precomputed against the live
  // landscape (buildWormPath) and simply ridden
  const mode = UNDER ? (Math.random() < 0.5 ? 'top' : 'floor') : (Math.random() < 0.3 ? 'bottom' : 'side');
  const side = Math.random() < 0.5 ? -1 : 1;
  const dir = -side;
  const x = mode === 'bottom' ? R(Wc * 0.3, Wc * 0.7) : (side < 0 ? -24 : Wc + 24);
  worm = {
    x, y: 0, mode,
    t: 0, hang: dir > 0 ? 0 : Math.PI,
    vx: dir * Wc / R(9.2, 11.2), hitT: 0, hp: 100,
    sndT: 0, ceilT: 0, ignT: 0, trT: 0, tr: [], sid: ++digSid,
    bw: 30, len: 150, path: [], pi: 0
  };
  buildWormPath(worm);
  lastHitInfo = 'ЧЕРВЬ!';
  sfx(0.8);
  shake = Math.min(10, shake + 4);
}
// the precomputed trajectory, sampled every 6px against the CURRENT
// landscape: buried under the smoothed surface (or glued to the cave
// ceiling/floor — in a cave it NEVER surfaces mid-height), with
// pre-planned breach windows and water swims, and a SLOPE LIMITER so
// the body never accelerates vertically — the pop-outs are gone
function buildWormPath(w) {
  const dir = Math.sign(w.vx);
  const step = 6;
  const n = Math.max(2, Math.ceil((dir > 0 ? Wc + 70 - w.x : w.x + 70) / step));
  const ph = R(0, 6.28);
  const amp = R(9, 17);
  // breach windows (surface worlds): 1-2 planned stretches above the sand
  const br = [];
  if (!UNDER) {
    const nb = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let b = 0; b < nb; b++) {
      const s = R(0.15, 0.7);
      br.push([s, Math.min(0.95, s + R(0.06, 0.15))]);
    }
  }
  const surfS = (x) => (surfaceAt(x - 12) + surfaceAt(x - 6) + surfaceAt(x) + surfaceAt(x + 6) + surfaceAt(x + 12)) / 5;
  const ceilS = (x) => (ceilAt(x - 12) + ceilAt(x - 6) + ceilAt(x) + ceilAt(x + 6) + ceilAt(x + 12)) / 5;
  const pts = [];
  let prevY = null;
  for (let i = 0; i <= n; i++) {
    const x = w.x + dir * step * i;
    const xc = clamp(x, 8, Wc - 8);
    const u = i / n;
    const surf = surfS(xc);
    const wy = waterAt(xc);
    const overWater = !UNDER && surf > wy + 8;
    const inBr = !UNDER && br.some(b => u >= b[0] && u <= b[1]);
    let ty, g = 1;
    if (overWater) { ty = wy + 4; g = 2; }
    else if (inBr) { ty = surf - 32; g = 0; }
    else if (w.mode === 'top') ty = ceilS(xc) + 21 + Math.sin(u * 8 + ph) * 4;
    else ty = surf + 24 + Math.sin(u * 6 + ph) * amp;
    // slope limiter — max ~0.9 vertical per 1 horizontal, no bursts
    let y = ty;
    if (prevY !== null) y = prevY + clamp(y - prevY, -step * 0.9, step * 0.9);
    // keep it in the ground (or glued under the cave ceiling)
    if (g === 1) {
      if (w.mode === 'top') y = Math.max(y, ceilS(xc) + 15);
      else y = Math.max(y, surf + 14);
    }
    prevY = y;
    pts.push({ x, y, g });
  }
  w.path = pts;
  w.pi = 0;
  w.y = pts[0].y;
}
// the end-of-run sweep: EVERY void of the worm's own dig session drops
// at once — the whole trench settles along its full span
function collapseWormTunnel(w) {
  const N = cols.length;
  const x0 = Math.min(w.path[0].x, w.path[w.path.length - 1].x);
  const x1 = Math.max(w.path[0].x, w.path[w.path.length - 1].x);
  const a = clamp(Math.round(x0 / cols.step), 1, N - 2);
  const b = clamp(Math.round(x1 / cols.step), 1, N - 2);
  let did = false;
  for (let i = a; i <= b; i++) {
    const c = cols[i];
    if (c.h1 > 0 && c.sid === w.sid) {
      if (subsideColumn(i, false) > 0) did = true;
    }
  }
  if (did) {
    smoothGround(a, b);
    sfx(0.9);
    shake = Math.min(10, shake + 5);
  }
}
function stepWorm(dt) {
  if (!biome || !cols || (biomeKey() !== 'desert' && biomeKey() !== 'rust')) { worm = null; return; }
  if (!worm && wormPlan.n < wormPlan.q && rgt >= wormPlan.at[wormPlan.n]) {
    wormPlan.n++;
    spawnWorm();
  }
  if (!worm) return;
  const w = worm;
  const px = w.x, py = w.y;
  w.t += dt;
  w.x += w.vx * dt;
  // the whole run rumbles: constant shake + a digger-grade growl
  shake = Math.max(shake, 1.4);
  w.sndT += dt;
  if (w.sndT > 0.7) { w.sndT = 0; sfx(0.4); }
  // PRECOMPUTED path (buildWormPath): the whole trajectory was laid out
  // at spawn against the live landscape — buried, with planned breach
  // windows and water swims, slope-limited. Ride it by index
  w.pi = clamp(Math.round(Math.abs(w.x - w.path[0].x) / 6), 0, w.path.length - 1);
  const pA = w.path[w.pi];
  const pB = w.path[Math.min(w.pi + 1, w.path.length - 1)];
  const f = clamp(Math.abs(w.x - pA.x) / (Math.abs(pB.x - pA.x) || 6), 0, 1);
  w.y = pA.y + (pB.y - pA.y) * f;
  const cur = w.path[w.pi];
  if (cur.g === 0 && Math.random() < dt * 20) fx.push({ k: 'dust', x: w.x + R(-10, 10), y: surfaceAt(w.x) - 4, vx: R(-40, 40), vy: -R(30, 90), r: R(3, 6), t: 0, life: R(0.5, 1), col: M().dustCol });
  if (cur.g === 2) {
    if (Math.random() < dt * 6) pushRipple(w.x, 2.5);
    if (Math.random() < dt * 8) fx.push({ k: 'splash', x: w.x, y: waterAt(w.x), r: 7, t: 0, life: 0.4 });
  }
  // the heading is low-passed HARD so the maw glides instead of twitching
  const ha = Math.atan2(w.y - py, w.x - px);
  let dh = ha - w.hang;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  w.hang += dh * Math.min(1, dt * 3);
  const underground = cur.g === 1;
  if (underground) {
    carveLine(px, py, w.x, w.y, 19, w.sid);
    // NO progressive subsidence: the tunnel stays open behind the body;
    // every void of its dig session collapses in ONE end-of-run sweep
    // (collapseWormTunnel on despawn)
    // the shudder of its passing: a small jolt for a fighter standing
    // right above the trench (the direct grind below is the big one)
    w.joltT = Math.max(0, (w.joltT || 0) - dt);
    if (w.joltT <= 0) {
      let near = false;
      tanks.forEach((tk, i) => {
        if (canHurt(i) && Math.abs(tk.x - w.x) < 28) { addTerrDmg(i, 3, 'сотрясение'); near = true; }
      });
      if (near) w.joltT = 0.8;
    }
    w.ignT += dt;
    if (w.ignT > 0.3) { w.ignT = 0; igniteAt(w.x, w.y, 22, 'fire'); }
    if (Math.random() < dt * 10) fx.push({ k: 'dust', x: w.x + R(-14, 14), y: surfaceAt(w.x) - 2, vx: R(-20, 20), vy: -R(10, 40), r: R(2, 5), t: 0, life: R(0.4, 0.9), col: M().dustCol });
  }
  // CEILING crawl: the rock it bolts to tears open behind it and rains
  // down; the searchlights it passes under blow up
  if (w.mode === 'top') {
    w.ceilT += dt;
    if (w.ceilT > 0.3) {
      w.ceilT = 0;
      ceilingCrush(w.x - Math.sign(w.vx) * 60, 30);
    }
  }
  // TURRETS: a direct pass grinds them down (50% of the old punch)
  w.hitT = Math.max(0, w.hitT - dt);
  if (w.hitT <= 0) {
    tanks.forEach((tk, i) => {
      if (!canHurt(i)) return;
      if (Math.abs(tk.x - w.x) < 25 && w.y > tk.y - 42 && w.y < tk.y + 12) {
        w.hitT = 0.5;
        damageTank(i, 30, 'worm', w.x, w.y);
        confirmClose = true;
      }
    });
  }
  // VOLCANO / lava: the worm scorches
  const cW = colAt(w.x);
  if ((volcano && inVolcCone(w.x, w.y)) || cW.lava > 2) {
    w.hp -= 42 * dt;
    if (Math.random() < dt * 14) fx.push({ k: 'ember', x: w.x + R(-10, 10), y: w.y, vx: R(-30, 30), vy: -R(40, 120), t: 0, life: R(0.4, 0.9), s: R(1, 2) });
    if (w.hp <= 0) {
      boomsAt(w.x, w.y, 40, 'missile', 12);
      lastHitInfo = 'червь сгорел в лаве';
      collapseWormTunnel(w);
      worm = null;
      return;
    }
  }
  // CRYSTALS are swallowed, SEARCHLIGHTS explode
  if (UNDER) {
    for (let q = caveLights.length - 1; q >= 0; q--) {
      const L = caveLights[q];
      if (L.k === 'cry' && Math.hypot(w.x - L.x, w.y - L.y) < 36) {
        caveLights.splice(q, 1);
        fx.push({ k: 'flash', x: L.x, y: L.y, r: L.r * 0.7, t: 0, life: 0.18, col: `rgb(${L.col})` });
        spawnEmbers(L.x, L.y, 8, 20);
        sfx(0.4);
        shake = Math.min(8, shake + 2);
      } else if (L.k === 'beam' && Math.abs(w.x - L.x) < 28 && w.y < L.y + 60) {
        caveLights.splice(q, 1);
        boomsAt(L.x, L.y + 4, 26, 'missile', 1, true, true);
        fx.push({ k: 'flash', x: L.x, y: L.y + 2, r: 16, t: 0, life: 0.14, col: `rgb(${L.col})` });
        spawnEmbers(L.x, L.y + 2, 9, 26);
        sfx(0.5);
      }
    }
  }
  // the body trail, trimmed to the body length
  w.trT += dt;
  if (w.trT > 0.045) {
    w.trT = 0;
    w.tr.push({ x: w.x, y: w.y });
    let acc = 0;
    for (let s = w.tr.length - 1; s > 0; s--) {
      acc += Math.hypot(w.tr[s].x - w.tr[s - 1].x, w.tr[s].y - w.tr[s - 1].y);
      if (acc > w.len) { w.tr.splice(0, s - 1); break; }
    }
  }
  if (w.x < -60 || w.x > Wc + 60 || w.t > 20 || w.pi >= w.path.length - 1) {
    // end of the run: the whole tunnel collapses at once
    collapseWormTunnel(w);
    worm = null;
  }
}
// orbital garbage (all worlds except caves): a rare rain of rust flakes
// from the Great Cleanup ring — the flakes settle and barely raise the
// ground; a few HEAVY angular chunks land with a small mound, and a
// direct hit on a turret hurts badly
function stepJunks(dt) {
  if (!cols || UNDER) return;
  if (!junks.length && junkPlan.n < junkPlan.q && rgt >= junkPlan.at[junkPlan.n]) {
    junkPlan.n++;
    garbageStrike();
  }
  junks = junks.filter(j => {
    j.t += dt;
    j.vy = Math.min(j.vy + GRAV * 0.9 * dt, 640);
    j.x += (j.vx + wind * 1.5) * dt;
    j.y += j.vy * dt;
    if (j.s >= 6 && Math.random() < dt * 8) fx.push({ k: 'wisp', x: j.x + R(-3, 3), y: j.y - j.s, vx: R(-4, 4), vy: -R(10, 26), ph: R(0, 6.28), t: 0, life: R(0.3, 0.7) });
    if (j.s >= 6 && Math.random() < dt * 5) fx.push({ k: 'ember', x: j.x + R(-3, 3), y: j.y - 4, vx: R(-14, 14), vy: -R(20, 60), t: 0, life: R(0.3, 0.6), s: R(1, 1.8) });
    for (let i = 0; i < tanks.length; i++) {
      const tk = tanks[i];
      if (j.s >= 6 && canHurt(i) && Math.abs(tk.x - j.x) < 13 + j.s && j.y > tk.y - 32 && j.y < tk.y + 10) {
        damageTank(i, Math.round(j.s * 3.5), 'junk', j.x, j.y);
        confirmClose = true;
        junkLand(j);
        return false;
      }
    }
    const wy = waterAt(j.x);
    if (j.y >= wy && surfaceAt(j.x) > wy + 2 && j.y < wy + 14) {
      fx.push({ k: 'splash', x: j.x, y: wy, r: 10, t: 0, life: 0.5 });
      pushRipple(j.x, 6);
    }
    if (j.y >= surfaceAt(j.x) - j.s * 0.5 && !inVoid(j.x, j.y)) { junkLand(j); return false; }
    if (inVoid(j.x, j.y) && j.y >= colAt(j.x).h1 - j.s * 0.5) { junkLand(j); return false; }
    return j.y < Hc + 40;
  });
}
function garbageStrike() {
  const cx = R(Wc * 0.15, Wc * 0.85);
  fx.push({ k: 'skyflash', t: 0, life: 0.7, col: 'rgba(255,130,60,', a: 0.14 });
  sfx(0.7);
  shake = Math.min(10, shake + 2);
  // the flake cloud — dots big enough to read, they barely lift the ground
  for (let k = 0; k < 60; k++) {
    debris.push({ x: cx + R(-90, 90), y: -R(10, 300), vx: R(-10, 10), vy: R(140, 300), rot: R(0, 6.28), vr: R(-6, 6), s: R(1.4, 2.8), col: ['#8a4530', '#6a3020', '#a06040'][(Math.random() * 3) | 0], settled: false, life: 15 });
  }
  const nBig = 2 + (Math.random() * 3 | 0);
  for (let k = 0; k < nBig; k++) {
    schedule(() => {
      const pts = [];
      const nv = 5 + (Math.random() * 3 | 0);
      for (let v = 0; v < nv; v++) pts.push(R(0.55, 1.15));
      const jx = clamp(cx + R(-70, 70), 16, Wc - 16);
      junks.push({ x: jx, y: -40, vx: R(-6, 6), vy: 300, t: 0, s: R(9, 16), pts });
      // dozens of pixel shards STREAK down right beside the big chunk —
      // they render as falling streaks (see drawJunks)
      for (let q = 0; q < 22; q++) {
        junks.push({ x: jx + R(-24, 24), y: -R(4, 80), vx: R(-5, 5), vy: 230 + R(0, 110), t: 0, s: R(1.3, 2.4) });
      }
      fx.push({ k: 'flash', x: cx, y: -8, r: 16, t: 0, life: 0.25, col: '#ff9a5a' });
      sfx(0.3);
    }, 0.4 + k * R(0.25, 0.7) + R(0, 0.3));
  }
  lastHitInfo = 'мусор с орбиты!';
}
function junkLand(j) {
  // pixel shards land with just a puff — no mound, no shake
  if (j.s < 3) {
    if (Math.random() < 0.4) fx.push({ k: 'dust', x: j.x, y: surfaceAt(j.x) - 2, vx: R(-6, 6), vy: -R(6, 16), r: R(1, 2), t: 0, life: R(0.3, 0.6), col: M().dustCol });
    return;
  }
  craterMask(j.x, j.s * 1.6, 0.4, 'add', 'ellipse');
  spawnDirtFall(j.x, j.s * 0.9);
  spawnEmbers(j.x, Math.min(j.y, surfaceAt(j.x) - 4), 10, j.s * 2);
  spawnDust(j.x, surfaceAt(j.x) - 4, j.s * 2, M().dustN * 0.6);
  // a NEAR miss still jolts the fighter standing beside the impact —
  // the direct hit above is the big one
  tanks.forEach((tk, i) => {
    if (canHurt(i) && Math.abs(tk.x - j.x) < j.s * 2.4) addTerrDmg(i, 4, 'обвал');
  });
  shake = Math.min(10, shake + 4);
  sfx(0.9);
}
// ============ the 3D-precalc moon system of the planet sky ============
// four moons on projected near-ecliptic orbits: sizes and speeds follow a
// Kepler-ish a^-1.5 law (inner small and quick, outer big and slow);
// positions, phases and shadow directions are computed live in drawSky
// against the star's current place in the sky
// ============ PROCEDURAL PLANET MASK (spherical) ============
// The continents are grown ON THE SPHERE, not as flat screen polygons:
// every grid cell maps to a hemisphere point (dx,dy,z). 6-8 seed
// continents pull a multi-scale noise field toward the sea level, the
// coast is distorted only in a narrow band around it, the mask is
// eroded/smoothed to kill noise artifacts, then small islands and
// archipelags with ragged radial profiles are sprinkled. Fully
// deterministic per round (the round's seeded `noise` + S)
function genPlanetMask() {
  const R2 = 64;                      // grid resolution (R2 x R2 cells)
  const rnd = mulberry32((seed ^ 0x5f3a) | 0);
  // continent centers as unit sphere vectors, random sizes/strengths
  const conts = [];
  const nC = 6 + (rnd() * 3 | 0);
  for (let k = 0; k < nC; k++) {
    const th = rnd() * Math.PI * 2, ph2 = Math.acos(rnd() * 1.6 - 0.8);
    conts.push({
      x: Math.sin(ph2) * Math.cos(th), y: Math.cos(ph2), z: Math.sin(ph2) * Math.sin(th),
      r: 0.34 + rnd() * 0.4,          // angular size
      s: 0.5 + rnd() * 0.6             // height strength
    });
  }
  // 3-4 mid-plateau bumps for inner seas / land bridges
  const mids = [];
  for (let k = 0; k < 4; k++) {
    const th = rnd() * Math.PI * 2, ph2 = Math.acos(rnd() * 1.4 - 0.7);
    mids.push({ x: Math.sin(ph2) * Math.cos(th), y: Math.cos(ph2), z: Math.sin(ph2) * Math.sin(th), r: 0.5 + rnd() * 0.45, s: 0.32 + rnd() * 0.3 });
  }
  // fractal-ish fbm over the ROUND noise (multi-scale, deterministic)
  const fbmS = (a, b, c) => {
    let v = 0, amp = 0.5, f = 1, tot = 0;
    for (let o = 0; o < 4; o++) {
      v += noise(a * f * 0.9 + o * 61) * b * f * 0.7 + noise(c * f * 1.1 + o * 37) * b * 0.3 * f;
      tot += b * f; amp *= 0.5; f *= 2.1;
    }
    return v / tot;
  };
  // continent field: smooth falloff from each seed over the sphere
  const field = (px2, py2, pz) => {
    let h = 0;
    conts.forEach(c => {
      const d = Math.acos(clamp(px2 * c.x + py2 * c.y + pz * c.z, -1, 1));
      if (d < c.r) h = Math.max(h, c.s * (1 - (d / c.r) * (d / c.r) * 0.85));
    });
    mids.forEach(m => {
      const d = Math.acos(clamp(px2 * m.x + py2 * m.y + pz * m.z, -1, 1));
      if (d < m.r) h = Math.max(h, m.s * (1 - d / m.r));
    });
    return h;
  };
  const sea = 0.34;                   // sea level of the mask field
  const m = new Float32Array(R2 * R2);
  for (let j = 0; j < R2; j++) {
    const dy = (j + 0.5) / R2 * 2 - 1;
    for (let i = 0; i < R2; i++) {
      const dx = (i + 0.5) / R2 * 2 - 1;
      const rr = dx * dx + dy * dy;
      if (rr >= 1) { m[j * R2 + i] = -1; continue; }
      const z = Math.sqrt(1 - rr);
      const h = field(dx, dy, z);
      // multi-scale noise: LOW shapes the mass, MID works mostly in the
      // narrow coastal band around sea level, HIGH adds fine grain
      const coast = clamp(1 - Math.abs(h - sea) / 0.22, 0, 1);
      const nLo = (fbmS(i * 0.11 + 500, 1, j * 0.11) - 0.5) * 0.34;
      const nMid = (fbmS(i * 0.42 + 300, 1, j * 0.42) - 0.5) * 0.26 * (0.25 + coast);
      const nHi = (noise(i * 1.7 + 90) - 0.5) * 0.08 * coast;
      m[j * R2 + i] = h + nLo + nMid + nHi;
    }
  }
  // EROSION: 3 passes of a center-weighted 3x3 blur — kills single-cell
  // noise specks, rounds the coast naturally (bays stay, spikes go)
  for (let it = 0; it < 3; it++) {
    const t = new Float32Array(R2 * R2);
    for (let j = 0; j < R2; j++) for (let i = 0; i < R2; i++) {
      let s = 0, w = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = clamp(i + di, 0, R2 - 1), b2 = clamp(j + dj, 0, R2 - 1);
        const v = m[b2 * R2 + a];
        if (v <= -0.5) continue;
        const cw = (di || dj) ? 1 : 3;
        s += v * cw; w += cw;
      }
      t[j * R2 + i] = w ? s / w : -1;
    }
    m.set(t);
  }
  // ISLANDS + ARCHIPELAGOS: small land seeds with a ragged radial profile
  const isles = [];
  const nI = 8 + (rnd() * 8 | 0);
  for (let q = 0; q < nI; q++) {
    const th = rnd() * Math.PI * 2, ph2 = Math.acos(rnd() * 1.5 - 0.75);
    const ix = Math.sin(ph2) * Math.cos(th), iy = Math.cos(ph2), iz = Math.sin(ph2) * Math.sin(th);
    const arch = q % 3 === 0;          // every 3rd becomes an archipelago
    const ir = arch ? 2 + (rnd() * 2 | 0) : 0;
    const cl = [];
    const nP = arch ? 3 + ir : 1;
    for (let p = 0; p < nP; p++) {
      const spr = p === 0 ? 0 : (0.06 + rnd() * 0.09);
      const jx = rnd() * 0.16 - 0.08, jz = rnd() * 0.16 - 0.08, jy = rnd() * 0.1 - 0.05;
      const l2 = Math.hypot(ix + jx * p, iy + jy * p, iz + jz * p) || 1;
      cl.push({
        x: (ix + jx * p) / l2, y: (iy + jy * p) / l2, z: (iz + jz * p) / l2,
        r: (arch ? 0.035 + rnd() * 0.03 : 0.05 + rnd() * 0.045),
        s: 0.4 + rnd() * 0.22
      });
    }
    isles.push({ cl });
  }
  // write the islands in CELL terms (already eroded once by their own
  // ragged profile) then one light smoothing pass over the deltas
  for (let j = 0; j < R2; j++) {
    const dy = (j + 0.5) / R2 * 2 - 1;
    for (let i = 0; i < R2; i++) {
      const dx = (i + 0.5) / R2 * 2 - 1;
      const rr = dx * dx + dy * dy;
      if (rr >= 1) continue;
      const z = Math.sqrt(1 - rr);
      let add = 0;
      isles.forEach(o => o.cl.forEach(c => {
        const d = Math.acos(clamp(dx * c.x + dy * c.y + z * c.z, -1, 1));
        if (d < c.r) {
          // ragged radial profile: 2 harmonic wobbling of the rim
          const a4 = Math.atan2(z, dx);
          const wob = 1 + Math.sin(a4 * 5 + c.x * 40) * 0.22 + Math.sin(a4 * 9 + c.z * 40) * 0.13;
          const dd = d / c.r;
          add = Math.max(add, c.s * (1 - dd * dd) * wob);
        }
      }));
      if (add > 0) m[j * R2 + i] = Math.max(m[j * R2 + i], sea + 0.02 + add * 0.5 - 0.18 * (1 - add));
    }
  }
  // a final gentle erosion over the island deltas only (one pass)
  {
    const t = new Float32Array(m);
    for (let j = 1; j < R2 - 1; j++) for (let i = 1; i < R2 - 1; i++) {
      const v = m[j * R2 + i];
      if (v <= -0.5) continue;
      let s = 0, w = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const n = m[(j + dj) * R2 + (i + di)];
        if (n <= -0.5) continue;
        const cw = (di || dj) ? 1 : 2;
        s += n * cw; w += cw;
      }
      t[j * R2 + i] = s / w;
    }
    m.set(t);
  }
  // INCLUSIONS (rust blooms / green flecks) — grown by the SAME
  // principle as the continents: seed centers on the sphere, smooth
  // radial falloff, the rim ragged by two harmonics + a mid noise
  // octave (strongest in the narrow band around the inclusion's own
  // coast), then a light erosion. Per-cell intensity grids, land-only;
  // green is weighted toward the hills. The ui paints them as cells
  const mkOverlay = (count, baseR, rSpread, hi) => {
    const g = new Float32Array(R2 * R2);
    const seeds = [];
    for (let q = 0; q < count; q++) {
      const th = rnd() * Math.PI * 2, ph2 = Math.acos(rnd() * 1.5 - 0.75);
      seeds.push({
        x: Math.sin(ph2) * Math.cos(th), y: Math.cos(ph2), z: Math.sin(ph2) * Math.sin(th),
        r: baseR + rnd() * rSpread, s: 0.6 + rnd() * 0.4
      });
    }
    for (let j = 0; j < R2; j++) {
      const dy = (j + 0.5) / R2 * 2 - 1;
      for (let i = 0; i < R2; i++) {
        const dx = (i + 0.5) / R2 * 2 - 1;
        const rr = dx * dx + dy * dy;
        if (rr >= 1) continue;
        const z = Math.sqrt(1 - rr);
        const h = m[j * R2 + i];
        if (h <= sea) continue;
        if (hi && h < sea + 0.07) continue;
        let v = 0;
        seeds.forEach(sd => {
          const d = Math.acos(clamp(dx * sd.x + dy * sd.y + z * sd.z, -1, 1));
          if (d >= sd.r) return;
          const a4 = Math.atan2(z, dx);
          const wob = 1 + Math.sin(a4 * 4 + sd.x * 55) * 0.24 + Math.sin(a4 * 7 + sd.z * 55) * 0.15;
          const dd = d / (sd.r * wob);
          const rim = clamp(1 - Math.abs(dd - 0.72) / 0.3, 0, 1);
          const nM = (noise(i * 0.5 + sd.x * 80 + 700) - 0.5) * 0.35 * (0.3 + rim);
          v = Math.max(v, sd.s * clamp(1 - dd * dd + nM, 0, 1));
        });
        g[j * R2 + i] = v;
      }
    }
    // one erosion pass, clamped to land — kills single-cell specks
    const t = new Float32Array(g);
    for (let j = 1; j < R2 - 1; j++) for (let i = 1; i < R2 - 1; i++) {
      if (m[j * R2 + i] <= sea) continue;
      let s = 0, w = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (m[(j + dj) * R2 + (i + di)] <= sea) continue;
        const cw = (di || dj) ? 1 : 2;
        s += g[(j + dj) * R2 + (i + di)] * cw; w += cw;
      }
      t[j * R2 + i] = w ? s / w : 0;
    }
    return t;
  };
  const rust = mkOverlay(22, 0.05, 0.07, false);
  const grn = mkOverlay(12, 0.035, 0.045, true);
  planetMask = { n: R2, m, sea, rust, grn };
}
function genMoonSys() {
  moonSys = [];
  const cols4 = ['#5c5654', '#a06ad0', '#d88a58', '#8c8c96'];
  for (let m = 0; m < 4; m++) {
    const a = 0.22 + m * 0.12;
    const mo = {
      a, ry: Hc * (0.02 + m * 0.012), cy: Hc * (0.07 + m * 0.042),
      ang: R(0, 6.28), spd: 0.05 * Math.pow(0.22 / a, 1.5),
      rr: [5, 8, 11, 15][m], col: cols4[m], crat: []
    };
    const nc = 2 + (Math.random() * 2 | 0);
    for (let k = 0; k < nc; k++) mo.crat.push([R(-0.5, 0.5), R(-0.5, 0.5), R(0.15, 0.35)]);
    moonSys.push(mo);
  }
}
function stepMoonSys(dt) {
  if (!moonSys) return;
  moonSys.forEach(mo => { mo.ang = (mo.ang + mo.spd * dt) % (Math.PI * 2); });
}
// ================= LOOP =================
function start() {
  score = 0; wins = 0; shots = 0; shots2 = 0; aiSkill = 0.35;
  score2 = 0; wins2 = 0;
  round = 1;
  ammoInv = {}; aiAmmo = {};
  ARSENAL.forEach(w => { ammoInv[w.key] = w.ammo; aiAmmo[w.key] = w.ammo; });
  cur = 0; cur2 = 0;
  seatAim = [{ ang: 45, pow: 55 }, { ang: 45, pow: 55 }];
  firstShooter = Math.random() < 0.5 ? 0 : 1;
  turnOrder = firstShooter;
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
  gt += dt; rgt += dt; skyT += dt; cloudOff += windDir * 6 * dt;
  cycleT = (cycleT + dt / DAY_CYCLE) % 1;
  todT += dt;
  if (todT > 0.25) { todT = 0; updateTod(); }
  for (let i = events.length - 1; i >= 0; i--) if (gt >= events[i].at) { const fn = events[i].fn; events.splice(i, 1); fn(); }

  // LAST STAND finalizer
  tanks.forEach((t, i) => { if (t.dying && !t.dead && gt >= t.lsUntil) killTank(i, 'weapon'); });

  // turn clock runs only for a HUMAN seat
  if (state === 'aim' && isHumanSeat(turn) && turnIntro <= 0 && !modalOpen()) {
    const before = turnTimer;
    turnTimer -= dt;
    for (const m of [10, 5, 1]) {
      if (before > m && turnTimer <= m && !warnedAt[m]) {
        warnedAt[m] = 1;
        beep(m <= 1 ? 1200 : 880, 0.08, 0.09);
      }
    }
    if (turnTimer <= 0) {
      turnTimer = 0;
      drag = null;
      lastHitInfo = 'Время вышло — ход пропущен';
      const msg = lastHitInfo;
      schedule(() => { if (lastHitInfo === msg) lastHitInfo = ''; }, 4);
      endTurn();
    }
  }
  if (turnIntro > 0) turnIntro -= dt;

  if (state === 'fly' && shot) {
    updateProjectile(shot, dt);
    if (shot && shot.dead) { resolveHit(shot); shot = null; }
  }
  subshots = subshots.filter(s => { updateProjectile(s, dt); if (s.dead) { resolveHit(s); return false; } return true; });
  liquids = liquids.filter(l => { updateLiquid(l, dt); return !l.dead; });
  sinkers = sinkers.filter(sk => {
    sk.t += dt;
    const bed = floorAt(sk.x, sk.y);
    if (sk.y < bed - 4) {
      sk.y = Math.min(sk.y + 26 * dt, bed - 4);
      sk.x += Math.sin(sk.t * 2) * 0.4;
      if (Math.random() < dt * 0.8) pushRipple(sk.x, 1.6);
      if (Math.random() < dt * 3) fx.push({ k: 'sed', x: sk.x + R(-6, 6), y: sk.y - 6, vx: 0, vy: R(3, 8), t: 0, life: R(0.6, 1.4), s: R(1, 1.8) });
    } else if (Math.random() < dt * 0.5) {
      fx.push({ k: 'bubble', x: sk.x + R(-3, 3), y: sk.y - 8, vy: -R(14, 30), wob: R(0, 6.28), t: 0, life: R(0.8, 1.6), s: R(1, 2) });
    }
    return sk.y < Hc - 2;
  });
  stepTerra(dt * 2.2);
  stepFx(dt * 1.6);
  stepWater(dt);
  stepLavaBits(dt);
  stepWreckBits(dt);
  if (UNDER && ceil) {
    // a searchlight dies when the ceiling rock it is bolted to is torn
    // away (crushed / blasted open): a burst of sparks, then darkness
    for (let q = caveLights.length - 1; q >= 0; q--) {
      const L = caveLights[q];
      if (L.k !== 'beam') continue;
      if (ceilAt(L.x) < L.y - 6) {
        caveLights.splice(q, 1);
        fx.push({ k: 'flash', x: L.x, y: L.y + 2, r: 15, t: 0, life: 0.14, col: `rgb(${L.col})` });
        spawnEmbers(L.x, L.y + 2, 9, 26);
        sfx(0.35);
      }
    }
  }

  if (volcano) {
    volcScan();
    if (volcano.doused && gt > volcano.doused) {
      volcano.doused = 0;
      volcano.power = 1.1;
      const side = Math.random() < 0.5 ? -1 : 1;
      const bx = volcano.x + side * R(0.25, 0.8) * (5 + (volcano.coneBot - volcano.y) * 0.5);
      const bi0 = clamp(Math.round((bx - 10) / cols.step), 1, cols.length - 2);
      const bi1 = clamp(Math.round((bx + 10) / cols.step), 1, cols.length - 2);
      for (let i = bi0; i <= bi1; i++) {
        const ct = coneTopAt(i * cols.step);
        if (ct <= volcano.coneBot && cols[i].top < ct + 1) {
          cols[i].top = ct + 1;
          cols[i].melt = 1; cols[i].surf = 0;
        }
      }
      dirtyA = Math.min(dirtyA, bi0); dirtyB = Math.max(dirtyB, bi1);
      volcScan();
      const v0 = volcano.craters[0];
      if (v0) for (let k = 0; k < 14; k++) emitLavaFrom(v0, true);
      fx.push({ k: 'flash', x: bx, y: surfaceAt(bx) - 10, r: 34, t: 0, life: 0.18, col: `rgb(${lav().glow})` });
      sfx(1.0);
      shake = Math.min(10, shake + 5);
    }
    volcano.power += (0.3 - volcano.power) * dt * 0.012;
    const dz = !!volcano.doused;
    const capY = Math.min(volcano.coneBot, Hc - 10);
    volcano.craters.forEach(cr => {
      if (cr.tun) {
        if (Math.random() < dt * 5 && lavaBits.length < 55) lavaBits.push({ x: cr.x + R(-3, 3), y: cr.y - 2, vx: R(-15, 15), vy: -R(30, 80), t: 0, life: R(0.8, 2), s: R(1.4, 2.4) });
        return;
      }
      const under = cr.y > waterAt(cr.x);
      if (dz) {
        if (!under && Math.random() < dt * 1.5) fx.push({ k: 'vsmoke', x: cr.x + R(-3, 3), y: cr.y - 3, vx: R(-3, 3), vy: -R(18, 30), r: R(3, 5), t: 0, life: R(2, 3.4), steam: true });
        return;
      }
      if (!under) {
        cols[cr.i].burn = Math.max(cols[cr.i].burn, 0.7);
        if (cols[cr.i].top < capY) {
          cols[cr.i].top += dt * 0.45;
          dirtyA = Math.min(dirtyA, cr.i); dirtyB = Math.max(dirtyB, cr.i + 1);
        }
        if (Math.random() < dt * 0.6) firePatches.push({ x: cr.x, y: cr.y, life: 0.6, volc: true });
        if (Math.random() < dt * (0.35 + volcano.power * 2.5)) emitLavaFrom(cr, false);
        if (Math.random() < dt * (0.07 + volcano.power * 0.16)) spawnLFlow(cr);
        if (Math.random() < dt * (2 + volcano.power * 3)) fx.push({ k: 'vsmoke', x: cr.x + R(-3, 3), y: cr.y - 3, vx: R(-3, 3), vy: -R(20, 34), r: R(3, 6), t: 0, life: R(2.6, 4.2) });
      } else {
        if (Math.random() < dt * (0.8 + volcano.power * 2) && lavaBits.length < 55) {
          lavaBits.push({ x: cr.x + R(-4, 4), y: cr.y, vx: R(-10, 10), vy: -R(20, 60), t: 0, life: 0.8, s: R(1.4, 2.4) });
        }
        if (Math.random() < dt * 5) fx.push({ k: 'vsmoke', x: cr.x + R(-4, 4), y: waterAt(cr.x), vx: R(-2, 2), vy: -R(22, 36), r: R(3, 6), t: 0, life: R(2, 3.4), steam: true });
        if (Math.random() < dt * 1.2) pushRipple(cr.x, 2);
      }
    });
  }

  const nn = 1 - dayness;
  if (!UNDER && nn > 0.6 && Math.random() < dt * 0.08) {
    comets.push({ x: R(0, Wc * 1.1), y: R(10, Hc * 0.3), vx: -R(160, 380), vy: R(30, 110), t: 0, life: R(0.8, 2), sz: R(1, 2.4) });
  }
  comets.forEach(c => { c.x += c.vx * dt; c.y += c.vy * dt; c.t += dt; });
  comets = comets.filter(c => c.t < c.life);

  stepWorm(dt);
  stepJunks(dt);
  stepMoonSys(dt);
  stepGrains(dt);
  // wind particles fly on the surface AND in the caves — drifting motes
  // in the shafts, kept strictly between the ceiling and the floor. On
  // the surface the snow/sand kinds stay with the saltation grains; in a
  // cave every world gets its motes
  const wk = windKind();
  const want = (!UNDER && (wk === 'snow' || wk === 'sand')) ? 0 : Math.round(clamp(Math.abs(wind), 0.3, 4) * 14);
  while (windParts.length < want) {
    const nx = R(0, Wc);
    const ny = UNDER ? R(ceilAt(nx) + 12, Math.max(ceilAt(nx) + 16, surfaceAt(nx) - 12)) : R(20, Hc * 0.9);
    windParts.push({ x: nx, y: ny, ph: R(0, 6.28), ph2: R(0, 6.28), spd: R(0.6, 1.4), s: R(1.4, 3.4), a: R(0.75, 1.0), kind: wk });
  }
  while (windParts.length > want) windParts.pop();
  windParts.forEach(p => {
    p.ph += dt * (1.5 + p.spd); p.ph2 += dt * 2.2;
    p.x += wind * (40 + 55 * p.spd) * dt;
    p.y += Math.sin(p.ph) * 18 * dt + Math.cos(p.ph2) * 8 * dt;
    if (p.x < -6) p.x = Wc + 4; if (p.x > Wc + 6) p.x = -4;
    if (UNDER) {
      const ct = ceilAt(p.x), ft = surfaceAt(p.x);
      if (p.y < ct + 6) p.y = ct + 6;
      if (p.y > ft - 6) p.y = ft - 6;
    } else {
      if (p.y < 20) p.y = Hc * 0.9; if (p.y > Hc) p.y = 20;
    }
  });

  if (state === 'aim' && turn === 1 && GMODE === 1 && !shot && subshots.length === 0 && canAct(1) && turnReady()) schedule(aiTurn, 0.9);
  if (boomsIdle() && !shot && subshots.length === 0 && killed !== null && state !== 'wait' && state !== 'over' && state !== 'closing') endRound();
  if (state === 'boom' && killed === null && !shot && subshots.length === 0 && turnReady()) endTurn();
  if (state !== 'closing' && state !== 'over') draw();
}
// dead-hand pacing: control returns once the blast fades and the tanks settle
const turnReady = () => !fx.some(f => f.k === 'fire' || f.k === 'flash' || f.k === 'shock' || f.k === 'star' || f.k === 'spark' || f.k === 'crackle' || f.k === 'plasmaOrb') && terraJobs.length === 0 && events.length === 0 && tanks.every(t => t.dead || t.fallFrom === undefined);
const boomsIdle = () => turnReady() && liquids.length === 0 && !debris.some(d => !d.settled) && !firePatches.some(fp => !fp.volc);