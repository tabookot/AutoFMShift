// scorch.js — modern Scorched Earth successor; experimental branch of game.js
(() => {
  const LS_KEY = 'scorch_records';
  const MAX_REC = 10;
  const ROUNDS_MAX = 5;
  const GRAV = 195;
  const VMAX = 800;
  const WINDF = 30;
  const TANK_HP = 100;
  const NCOL = () => Math.max(300, Math.round(Wc / 1.5));
  const DAY_CYCLE = 480;
  const TERR_DMG_MAX = 30;
  const FIERY = ['missile', 'funky', 'death', 'nuke', 'napalm'];
  const DIG_SPEED0 = 120;
  const DIG_SPEED1 = 26;
  const DIG_LEN = 0.42;
  const DIG_RADIUS_F = 0.24;
  const TUN_MAX = 46;
  const DIG_DEPTH = 56;
  const TURN_TIME = 60;

  const ARSENAL = [
    { key: 'MISSILE',  name: 'Missile',       r: 30, type: 'missile',  ammo: Infinity, col: '#d8d8d8', dmg: 38, wind: 0.35, shape: 'rocket',   water: 'sink' },
    { key: 'FUNKY',    name: 'Funky Bomb',    r: 40, type: 'funky',    ammo: 3,  col: '#9a8ac8', dmg: 30, wind: 0.3,  shape: 'cluster',  water: 'surface' },
    { key: 'DEATH',    name: "Death's Head",  r: 62, type: 'death',    ammo: 2,  col: '#e8c14a', dmg: 90, wind: 0.15, shape: 'bomb',     water: 'bottom' },
    { key: 'NUKE',     name: 'Nuke',          r: 78, type: 'nuke',     ammo: 1,  col: '#ffd23f', dmg: 100, wind: 0.12, shape: 'bomb',    water: 'surface' },
    { key: 'PLASMA',   name: 'Plasma',        r: 48, type: 'plasma',   ammo: 2,  col: '#d06050', dmg: 55, wind: 0.2,  shape: 'mirv',     water: 'fizzle' },
    { key: 'NAPALM',   name: 'Napalm',        r: 50, type: 'napalm',   ammo: 2,  col: '#d85a18', dmg: 10, wind: 0.6,  shape: 'canister', water: 'fizzle' },
    { key: 'ROLLER',   name: 'Roller',        r: 30, type: 'roller',   ammo: 3,  col: '#5aa8a0', dmg: 50, wind: 0.05, shape: 'ball',     water: 'sink' },
    { key: 'DIGGER',   name: 'Digger',        r: 56, type: 'digger',   ammo: 3,  col: '#8a6a3a', dmg: 0,  wind: 0.2,  shape: 'drill',    water: 'sink' },
    { key: 'DIRT',     name: 'Dirt Ball',     r: 70, type: 'dirt',     ammo: 3,  col: '#cbb490', dmg: 0,  wind: 0.3,  shape: 'ball',     water: 'sink' },
    { key: 'MIRV',     name: 'MIRV',          r: 34, type: 'mirv',     ammo: 2,  col: '#c05a4a', dmg: 32, wind: 0.25, shape: 'mirv', subs: 5, water: 'surface' }
  ];
  const TERRAIN_WEAPONS = ['digger', 'dirt'];
  const isTerr = (t) => TERRAIN_WEAPONS.includes(t);

  const BIOMES = {
    green:    { surf: '#5d8a3a', surfHi: '#79a84c', sub: ['#6b4a2c', '#4a3420', '#221507'], mat: { depthF: 1.0, rimF: 0.32, slope: 3.2, drift: 0, dustN: 26, chunkN: 14, dustCol: '150,120,80',  chunks: ['#5a4428', '#3b2c1a', '#6b4a2c'] } },
    desert:   { surf: '#c9a45e', surfHi: '#e0be74', sub: ['#a87f48', '#7c5a2e', '#3a2a12'], mat: { depthF: 1.25, rimF: 0.42, slope: 2.2, drift: 1, dustN: 42, chunkN: 8,  dustCol: '200,170,110', chunks: ['#a87f48', '#8a6435'] } },
    arctic:   { surf: '#dfe8ee', surfHi: '#f4f9fc', sub: ['#7d8ea0', '#54627a', '#2c3546'], mat: { depthF: 0.9, rimF: 0.45, slope: 4.5, drift: 1, dustN: 30, chunkN: 10, dustCol: '230,240,250', chunks: ['#9aacbe', '#7d8ea0'] } },
    volcanic: { surf: '#4a4442', surfHi: '#5c5654', sub: ['#3a3432', '#2a2523', '#151210'], mat: { depthF: 0.7, rimF: 0.5, slope: 7.5, drift: 0, dustN: 16, chunkN: 24, dustCol: '110,100,95',  chunks: ['#2a2523', '#44403e', '#5c3a1e'] } }
  };
  const TOD = {
    day:    { stops: ['#7ab3d8', '#a8cde6', '#d8e8f0'], sun: '#fff6d8', sunHalo: 'rgba(255,246,216,0.35)', stars: false, clouds: 0.55, haze: 'rgba(220,235,245,0.25)' },
    sunset: { stops: ['#2a2a55', '#7a4a78', '#d88a4a', '#f0b060'], sun: '#ffd9a0', sunHalo: 'rgba(255,150,80,0.4)', stars: 'dim', clouds: 0.4, haze: 'rgba(240,170,110,0.3)' },
    night:  { stops: ['#060a18', '#0c1526', '#1a2a44'], sun: '#e8ecf2', sunHalo: 'rgba(200,215,235,0.2)', stars: true, clouds: 0.12, haze: 'rgba(40,60,100,0.25)' }
  };
  const TOD_KEYS = [
    { p: 0.00, k: 'day' }, { p: 0.38, k: 'day' }, { p: 0.47, k: 'sunset' }, { p: 0.56, k: 'night' },
    { p: 0.88, k: 'night' }, { p: 0.96, k: 'sunset' }, { p: 1.00, k: 'day' }
  ];
  const BANNERS = {
    win: [
      'FATALITY!', 'YOU WIN!', 'FLAWLESS VICTORY!', 'VICTORY!', 'WINNER!',
      'PLAYER 1 WINS', 'PLAYER 2 WINS', 'MISSION ACCOMPLISHED', 'CONGRATULATIONS!', 'PERFECT!',
      'CHAMPION!', 'YOU ARE THE WINNER', 'TOTAL VICTORY', 'ANNIHILATION', 'HUMILIATION',
      'GAME WON', 'VICTORY IS YOURS', 'MISSION COMPLETE', 'YOU HAVE WON', 'ПОБЕДА!'
    ],
    lose: [
      'ПОТРАЧЕНО', 'WASTED', 'YOU DIED', 'GAME OVER', 'DEFEAT',
      'YOU LOSE', 'MISSION FAILED', 'BUSTED', 'YOU ARE DEAD', 'FRAGGED',
      'YOU HAVE BEEN DEFEATED', 'GAME LOST', 'PLAYER 1 LOSES', 'PLAYER 2 LOSES', 'TRY AGAIN',
      'BETTER LUCK NEXT TIME', 'TOTAL DEFEAT', 'YOU HAVE LOST', 'DEFEATED', 'ПОРАЖЕНИЕ!'
    ],
    draw: [
      'DRAW!', "IT'S A DRAW!", 'TIE!', 'DRAW GAME', 'STALEMATE',
      'DEAD HEAT', 'NO WINNER', 'EVEN MATCH', 'MATCH DRAWN', 'BOTH LOSE',
      'NOBODY WINS', 'NO CONTEST', 'DRAW! DRAW! DRAW!', 'STALEMATE!', 'НИЧЬЯ!',
      'НИКТО НЕ ПОБЕДИЛ', 'ОБА ПРОИГРАЛИ', 'БЕЗ ПОБЕДИТЕЛЯ', 'РАВНЫЙ БОЙ', 'ВСЕ ПРОИГРАЛИ'
    ]
  };
  const BANNER_COL = { win: '#ffd23f', lose: '#ff4a3a', draw: '#ff9a3a' };

  let overlay, cv, ctx, Wc, Hc;
  let cols, waterLevel, biome, seed, S, noise, archetype, moonBite, moonBiteR;
  let volcano = null;
  let lavaBits = [];
  let cloudCount = 8;
  let groundPat = null;
  let tod = { stops: ['#7ab3d8', '#a8cde6', '#d8e8f0'], sun: '#fff6d8', sunHalo: 'rgba(255,246,216,0.35)', stars: false, clouds: 0.55, haze: 'rgba(220,235,245,0.25)' };
  let cycleT = 0, dayness = 1;
  let tanks, wind, windDir, aiSkill;
  let ammoInv = {}, aiAmmo = {}, cur = 0, turn, state, turnOrder = 0;
  let shot = null, subshots = [], liquids = [], debris = [], remains = [], sinkers = [], windParts = [], comets = [];
  let fx = [];
  let firePatches = [];
  let terraJobs = [];
  let events = [];
  let stars = [];
  let skyLight = { x: -999, col: '255,255,255', a: 0 };
  let digSid = 0;
  let dirtyA = 0, dirtyB = 0;
  let raf = null, last = 0, gt = 0, skyT = 0, cloudOff = 0;
  let aim = { ang: 45, pow: 55 }, aiAim = 55;
  let score = 0, shots = 0, roundStart = 0, round = 1;
  let wins = 0;
  let drag = null, killed = null, helpOpen = false, lastHitInfo = null;
  let sliderOpen = null, sliderDrag = false, sliderGeom = null;
  let moonCv = null, moonCtx = null;
  let shake = 0;
  let touchUI = false, powBar = null, powRange = null, powVal = null;
  let lastKillMethod = 'weapon', lastShotApex = 0;
  let turnTimer = 0, warnedAt = {};
  let driftT = 0;
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
  function parseCol(c) {
    if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
    const m = c.match(/[\d.]+/g);
    return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
  }
  function mixColA(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
  }
  const rgbaStr = (c) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3].toFixed(3)})`;
  function sampleStops(stops, u) {
    const seg = (stops.length - 1) * clamp(u, 0, 1);
    const i = Math.min(stops.length - 2, Math.floor(seg));
    return mixColA(parseCol(stops[i]), parseCol(stops[i + 1]), seg - i);
  }
  function updateTod() {
    const p = cycleT;
    let a = TOD_KEYS[0], b = TOD_KEYS[1];
    for (let i = 0; i < TOD_KEYS.length - 1; i++) {
      if (p >= TOD_KEYS[i].p && p <= TOD_KEYS[i + 1].p) { a = TOD_KEYS[i]; b = TOD_KEYS[i + 1]; break; }
    }
    const f = (p - a.p) / Math.max(1e-6, b.p - a.p);
    const A = TOD[a.k], B = TOD[b.k];
    const stops = [];
    for (let s = 0; s <= 4; s++) stops.push(rgbaStr(mixColA(sampleStops(A.stops, s / 4), sampleStops(B.stops, s / 4), f)));
    tod.stops = stops;
    tod.sun = rgbaStr(mixColA(parseCol(A.sun), parseCol(B.sun), f));
    tod.sunHalo = rgbaStr(mixColA(parseCol(A.sunHalo), parseCol(B.sunHalo), f));
    tod.haze = rgbaStr(mixColA(parseCol(A.haze), parseCol(B.haze), f));
    const dA = a.k === 'day' ? 1 : a.k === 'sunset' ? 0.5 : 0;
    const dB = b.k === 'day' ? 1 : b.k === 'sunset' ? 0.5 : 0;
    dayness = dA + (dB - dA) * f;
    tod.clouds = 0.12 + dayness * 0.43;
    const nn = 1 - dayness;
    tod.stars = nn > 0.75 ? true : nn > 0.35 ? 'dim' : false;
  }

  function rrectPath(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ptrPos(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (Wc / r.width), y: (e.clientY - r.top) * (Hc / r.height) };
  }
  const inRect = (p, r) => !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  const blastRange = (x, r) => [clamp(Math.round((x - r * 1.5) / cols.step), 1, cols.length - 2), clamp(Math.round((x + r * 1.5) / cols.step), 1, cols.length - 2)];

  function updateAimFromPointer(p) {
    const t = tanks[0], dir = playerDir();
    const dx = p.x - t.x, dy = (t.y - 14) - p.y;
    const dist = Math.hypot(dx, dy);
    const ax = Math.abs(dx) < 4 ? 4 : dx * dir;
    aim.ang = clamp(Math.round(Math.atan2(Math.max(dy, 2), ax) * 180 / Math.PI), 0, 88);
    const reach = Math.min(Wc * 0.42, 300);
    aim.pow = clamp(Math.round(5 + 95 * (dist - 26) / reach), 5, 100);
    draw();
  }
  function applySliderVal(px) {
    const g = sliderGeom;
    if (!g) return;
    const v = Math.round(g.min + clamp((px - g.tx0) / (g.tx1 - g.tx0), 0, 1) * (g.max - g.min));
    if (sliderOpen === 'ang') aim.ang = clamp(v, 0, 90);
    else aim.pow = clamp(v, 5, 100);
    draw();
  }
  function closeSlider() { sliderOpen = null; sliderDrag = false; draw(); }

  function trailLife(w) {
    switch (w.type) {
      case 'plasma': return 0.55;
      case 'missile': case 'mirv': return 1.15;
      case 'death': case 'nuke': return 1.6;
      case 'napalm': return 0.9;
      case 'roller': return 0.8;
      case 'digger': return 1.0;
      case 'dirt': return 1.2;
      default: return 1.0;
    }
  }
  function drawTrail(p) {
    const n = p.trail.length;
    if (!n) return;
    const life = trailLife(p.w);
    const type = p.w.type;
    ctx.save();
    if (type === 'plasma') ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const q = p.trail[i];
      const age = clamp((gt - q.t) / life, 0, 1);
      const k = 1 - age;
      if (k <= 0) continue;
      if (type === 'death' || type === 'nuke') {
        ctx.globalAlpha = k * 0.45;
        ctx.fillStyle = age < 0.4 ? '#5a5a5f' : '#2c2c30';
        ctx.beginPath(); ctx.arc(q.x, q.y, 2 + age * 10, 0, Math.PI * 2); ctx.fill();
        if (age < 0.12) {
          ctx.globalAlpha = k;
          ctx.fillStyle = '#ff9a3a';
          ctx.beginPath(); ctx.arc(q.x, q.y, 2.4, 0, Math.PI * 2); ctx.fill();
        }
      } else if (type === 'plasma') {
        ctx.globalAlpha = k * 0.55;
        ctx.fillStyle = hexA(p.w.col, 0.8);
        ctx.beginPath(); ctx.arc(q.x, q.y, 2 + age * 6, 0, Math.PI * 2); ctx.fill();
        if (age < 0.2) {
          ctx.globalAlpha = k * 0.9;
          ctx.fillStyle = '#fff2dd';
          ctx.beginPath(); ctx.arc(q.x, q.y, 2.2, 0, Math.PI * 2); ctx.fill();
        }
      } else if (type === 'funky') {
        ctx.globalAlpha = k * 0.85;
        ctx.fillStyle = ['#a29bff', '#ffd23f', '#ff6b9d', '#7bffc4'][(i + ((q.t * 10) | 0)) % 4];
        const s = 1.8 + Math.sin(i * 2.7) * 0.8;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(i * 1.3);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (type === 'napalm') {
        ctx.globalAlpha = k * 0.85;
        ctx.fillStyle = age < 0.5 ? '#ffd23f' : '#d85a18';
        ctx.beginPath(); ctx.arc(q.x, q.y, 2 + age * 3.5, 0, Math.PI * 2); ctx.fill();
      } else if (type === 'roller') {
        ctx.globalAlpha = k * 0.35;
        ctx.fillStyle = '#c2ab86';
        ctx.beginPath(); ctx.arc(q.x, q.y - age * 4, 1.5 + age * 4, 0, Math.PI * 2); ctx.fill();
      } else if (type === 'digger') {
        ctx.globalAlpha = k * 0.7;
        ctx.fillStyle = i % 2 ? '#8a6a3a' : '#6b4a2c';
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(i * 0.9);
        ctx.fillRect(-1.4, -1.4, 2.8, 2.8);
        ctx.restore();
      } else if (type === 'dirt') {
        ctx.globalAlpha = k * 0.3;
        ctx.fillStyle = '#cbb490';
        ctx.beginPath(); ctx.arc(q.x, q.y, 2 + age * 6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = k * 0.3;
        ctx.fillStyle = age < 0.3 ? '#e8e2d8' : '#b0b4bb';
        ctx.beginPath(); ctx.arc(q.x, q.y, 1.6 + age * 7, 0, Math.PI * 2); ctx.fill();
        if (age < 0.18) {
          ctx.globalAlpha = k * 0.9;
          ctx.fillStyle = '#ffd88a';
          ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawSlider() {
    if (!sliderOpen || state !== 'aim' || turn !== 0) return;
    const isAng = sliderOpen === 'ang';
    const w = clamp(Wc * 0.72, 240, 380), h = 112;
    const x = (Wc - w) / 2, y = Math.max(56, Hc * 0.26);
    const tx0 = x + 30, tx1 = x + w - 30, ty = y + 62;
    const min = isAng ? 0 : 5, max = isAng ? 90 : 100;
    const val = isAng ? aim.ang : aim.pow;
    const hx = tx0 + (tx1 - tx0) * ((val - min) / (max - min));
    const acc = isDayT() ? '#e67e22' : '#ffb020';
    sliderGeom = { body: { x, y, w, h }, close: { x: x + w - 34, y: y + 12, w: 22, h: 22 }, tx0, tx1, ty, min, max };
    ctx.save();
    ctx.fillStyle = 'rgba(4,8,14,0.5)';
    ctx.fillRect(0, 0, Wc, Hc);
    rrectPath(ctx, x, y, w, h, 12);
    ctx.fillStyle = 'rgba(12,18,30,0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '600 12px Orbitron, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText(isAng ? 'УГОЛ' : 'СИЛА', x + 18, y + 30);
    ctx.font = '700 24px Orbitron, monospace';
    ctx.fillStyle = acc;
    ctx.textAlign = 'right';
    ctx.fillText(isAng ? val + '°' : '' + val, x + w - 44, y + 34);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const cl = sliderGeom.close;
    ctx.beginPath();
    ctx.moveTo(cl.x + 6, cl.y + 6); ctx.lineTo(cl.x + 16, cl.y + 16);
    ctx.moveTo(cl.x + 16, cl.y + 6); ctx.lineTo(cl.x + 6, cl.y + 16);
    ctx.stroke();
    rrectPath(ctx, tx0, ty - 4, tx1 - tx0, 8, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
    rrectPath(ctx, tx0, ty - 4, Math.max(8, hx - tx0), 8, 4);
    ctx.fillStyle = acc;
    ctx.fill();
    ctx.beginPath(); ctx.arc(hx, ty, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = acc;
    ctx.stroke();
    ctx.font = '600 11px Orbitron, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left'; ctx.fillText('' + min, tx0, ty + 28);
    ctx.textAlign = 'right'; ctx.fillText('' + max, tx1, ty + 28);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('тяните ручку, X или клик мимо - закрыть', x + w / 2, y + h - 10);
    ctx.restore();
  }

  function drawTurretBody(c, x, y, col, o) {
    o = o || {};
    const dir = o.dir || 1;
    const ang = o.ang === undefined ? 45 : o.ang;
    const hpF = clamp(o.hpF || 0, 0, 1);
    const wreck = !!o.wreck;
    const rec = clamp(o.recoil || 0, 0, 1);
    const tilt = o.tilt || 0;
    const sd = o.seed || 0;
    c.save();
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    c.translate(Math.round(x), Math.round(y));
    if (tilt) c.rotate(tilt);
    const hull = wreck ? '#2a251d' : mixColor(col, '#241a10', hpF * 0.7);
    const P = (dx, dy, w, h, colr) => { c.fillStyle = colr; c.fillRect(Math.round(dx), Math.round(dy), w, h); };
    if (!o.noShadow) {
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(0, 1, 13, 3.2, 0, 0, Math.PI * 2); c.fill();
    }
    P(-12, -5, 24, 5, shade(hull, 0.5));
    P(-12, -5, 24, 1, shade(hull, 0.78));
    [-9, 0, 9].forEach(bx => P(bx, -3, 1, 1, shade(hull, 0.35)));
    P(-9, -13, 18, 8, hull);
    P(-9, -13, 18, 1, shade(hull, 1.3));
    P(-9, -6, 18, 1, shade(hull, 0.5));
    c.fillStyle = shade(hull, 0.55);
    c.fillRect(-3, -12, 1, 6);
    c.fillRect(4, -12, 1, 6);
    P(-7, -11, 4, 3, shade(hull, 0.85));
    P(-7, -11, 4, 1, shade(hull, 1.15));
    P(5, -11, 3, 2, shade(hull, 0.7));
    c.fillStyle = shade(hull, 0.45);
    c.fillRect(5, -10, 3, 1);
    c.beginPath();
    c.arc(0, -14, 8, Math.PI, 0);
    c.lineTo(8, -12); c.lineTo(-8, -12); c.closePath();
    c.fillStyle = hull;
    c.fill();
    c.save();
    c.clip();
    P(-8, -22, 5, 10, 'rgba(255,255,255,0.14)');
    P(4, -22, 4, 10, 'rgba(0,0,0,0.25)');
    [-5, 0, 5].forEach(rx => P(rx, -19, 1, 1, shade(hull, 0.4)));
    c.restore();
    P(-8, -13, 16, 1, shade(hull, 0.6));
    P(-3, -24, 6, 3, shade(hull, 0.95));
    P(-3, -24, 6, 1, shade(hull, 1.25));
    P(-1, -26, 3, 2, '#4d545c');
    if (!wreck) {
      const glow = clamp((1 - dayness) * 0.9, 0, 0.9);
      if (glow > 0.1) { c.fillStyle = `rgba(255,214,120,${glow.toFixed(3)})`; c.fillRect(0, -26, 1, 1); }
    }
    c.save();
    c.translate(0, -14);
    c.rotate((dir === 1 ? -ang : ang - 180) * Math.PI / 180 + (wreck ? 0.35 : 0));
    c.translate(-rec * 5, 0);
    const bl = wreck ? 13 : 20;
    P(0, -3, 5, 6, '#495057');
    P(0, -3, 5, 1, '#6d757e');
    P(5, -2, bl - 8, 4, '#5a6168');
    P(5, -2, bl - 8, 1, '#7d858d');
    P(8, -3, 2, 6, '#454c53');
    P(13, -3, 2, 6, '#454c53');
    P(bl - 3, -3, 3, 6, '#3d444b');
    if (!wreck) {
      c.fillStyle = '#20252b';
      c.fillRect(bl - 2, -2, 1, 1);
      c.fillRect(bl - 2, 1, 1, 1);
    }
    c.restore();
    if (!wreck) {
      const swy = Math.sin(gt * 2.2 + sd) * clamp(Math.abs(wind) * 0.4, 0, 2);
      c.strokeStyle = '#3f474e';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-6, -13);
      c.quadraticCurveTo(-6.5, -19, -6 + swy, -24);
      c.stroke();
      c.fillStyle = '#8d96a0';
      c.fillRect(Math.round(-6 + swy), -25, 1, 1);
    } else {
      c.strokeStyle = '#33383d';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-6, -13); c.lineTo(-7, -17); c.stroke();
    }
    const dmg = wreck ? 1 : hpF;
    if (dmg > 0.3) {
      c.strokeStyle = 'rgba(20,16,10,0.6)';
      c.lineWidth = 1;
      const nCr = Math.round(dmg * 3);
      for (let k = 0; k < nCr; k++) {
        const sx = -6 + ((sd * 37 + k * 53) % 13);
        const sy = -22 + ((sd * 17 + k * 71) % 8);
        c.beginPath();
        c.moveTo(sx, sy); c.lineTo(sx + 2, sy + 2); c.lineTo(sx + 1, sy + 4);
        c.stroke();
      }
    }
    if (dmg > 0.55) {
      P(-5, -18, 4, 3, 'rgba(15,12,8,0.45)');
      P(2, -11, 5, 3, 'rgba(15,12,8,0.4)');
    }
    c.restore();
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
  function beep(freq, dur, vol) {
    if (!AC) return;
    try {
      const o = AC.createOscillator();
      const g = AC.createGain();
      o.frequency.value = freq;
      o.type = 'square';
      g.gain.setValueAtTime(vol, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
      o.connect(g); g.connect(AC.destination);
      o.start(); o.stop(AC.currentTime + dur);
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
    cloudCount = 7 + ((Math.random() * 5) | 0);
  }

  function buildGroundTex() {
    if (!ctx) return;
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const bk = biomeKey();
    g.fillStyle = biome.sub[1];
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 200; i++) {
      g.fillStyle = Math.random() < 0.5 ? biome.sub[0] : biome.sub[2];
      g.globalAlpha = R(0.3, 0.8);
      g.fillRect(Math.random() * 64, Math.random() * 64, R(1, 3.2), R(1, 3.2));
    }
    g.globalAlpha = 1;
    if (bk === 'desert') {
      g.strokeStyle = 'rgba(122,92,52,0.4)';
      g.lineWidth = 1;
      g.beginPath();
      for (let y = 4; y < 64; y += 9) {
        g.moveTo(0, y);
        for (let x = 0; x <= 64; x += 8) g.lineTo(x, y + Math.sin(x * 0.2 + y) * 2.5);
      }
      g.stroke();
    } else if (bk === 'volcanic') {
      g.strokeStyle = 'rgba(12,10,9,0.7)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < 9; i++) {
        let x = Math.random() * 64, y = Math.random() * 64;
        g.moveTo(x, y);
        for (let s = 0; s < 4; s++) { x += R(-10, 10); y += R(3, 10); g.lineTo(x, y); }
      }
      g.stroke();
    } else if (bk === 'green') {
      g.strokeStyle = 'rgba(40,70,25,0.6)';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i < 55; i++) {
        const x = Math.random() * 64, y = Math.random() * 64;
        g.moveTo(x, y); g.lineTo(x + R(-1.5, 1.5), y - R(2, 5));
      }
      g.stroke();
    } else if (bk === 'arctic') {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 64, Math.random() * 64, R(1, 4), 1);
      g.fillStyle = 'rgba(120,140,160,0.35)';
      for (let i = 0; i < 16; i++) g.fillRect(Math.random() * 64, Math.random() * 64, R(1, 3), R(1, 2));
    }
    groundPat = ctx.createPattern(c, 'repeat');
  }

  function genTerrain() {
    seed = (Math.random() * 1e9) | 0;
    S = mulberry32(seed);
    noise = makeNoise(S);
    archetype = ARCH[Math.floor(S() * ARCH.length)];
    biome = BIOMES[Object.keys(BIOMES)[Math.floor(S() * Object.keys(BIOMES).length)]];
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
      cols.push({ top: Math.round(Hc * 0.9 - h * Hc * 0.68), surf: 5 + Math.round(noise(u * 40) * 5), burn: 0, melt: 0, h0: 0, h1: 0, sid: 0 });
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

    if (biomeKey() === 'volcanic') {
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
    }
  }

  const colAt = (x) => cols[clamp(Math.round(x / cols.step), 0, cols.length - 1)];
  function surfaceAt(x) { return colAt(x).top; }
  function slopeAt(x) { const i = clamp(Math.round(x / cols.step), 0, cols.length - 1); const a = cols[clamp(i - 1, 0, cols.length - 1)].top, b = cols[clamp(i + 1, 0, cols.length - 1)].top; return (b - a) / (2 * cols.step); }
  function inVoid(x, y) { const c = colAt(x); return c.h1 > 0 && y >= c.h0 - 2 && y < c.h1; }
  function shotBlocked(x, y, ownSid) {
    const c = colAt(x);
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
  function coneTopAt(x) {
    const dx = Math.abs(x - volcano.x);
    if (dx < 5) return volcano.y;
    return volcano.y + (dx - 5) * 2;
  }
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
    if (cr.length > 12) {
      const stride = Math.ceil(cr.length / 12);
      volcano.craters = cr.filter((c, idx) => idx % stride === 0);
    } else {
      volcano.craters = cr;
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
      fx.push({ k: 'flash', x: v.x, y: v.y - 10, r: 30, t: 0, life: 0.16, col: '#ff9a3a' });
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
      fx.push({ k: 'flash', x, y, r: 18, t: 0, life: 0.12, col: '#ff9a3a' });
      fx.push({ k: 'fire', x, y, r: 14, t: 0, life: 0.5 });
      spawnWisps(x, y, 5);
      meltShaft(4);
      volcano.power = clamp(volcano.power + 0.25, 0, 1.3);
      volcano.doused = 0;
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
  }
  function landLava(lb) {
    firePatches.push({ x: lb.x, y: lb.y, life: R(2.5, 5), volc: true });
    const ci = clamp(Math.round(lb.x / cols.step), 0, cols.length - 1);
    const c = cols[ci];
    c.burn = Math.max(c.burn, 0.85);
    if (c.top < Hc - 6 && c.h1 <= 0) {
      c.top += 0.5;
      dirtyA = Math.min(dirtyA, ci); dirtyB = Math.max(dirtyB, ci + 1);
    }
    if (Math.random() < 0.3) fx.push({ k: 'wisp', x: lb.x, y: lb.y - 2, vx: R(-5, 5), vy: -R(14, 26), ph: R(0, 6.28), t: 0, life: R(0.7, 1.4) });
  }
  function stepLavaBits(dt) {
    lavaBits = lavaBits.filter(lb => {
      lb.t += dt;
      if (lb.t > lb.life) return false;
      lb.vy += GRAV * 0.5 * dt;
      lb.vx += wind * 0.12 * WINDF * dt;
      lb.x += lb.vx * dt; lb.y += lb.vy * dt;
      if (lb.x < -20 || lb.x > Wc + 20 || lb.y > Hc) return false;
      const wy = waterAt(lb.x);
      if (lb.y >= wy && surfaceAt(lb.x) > waterLevel + 4) {
        spawnWisps(lb.x, wy, 2);
        pushRipple(lb.x, 3);
        return false;
      }
      for (let i = 0; i < tanks.length; i++) {
        const tk = tanks[i];
        if (!tk.dead && Math.abs(lb.x - tk.x) < 11 && lb.y > tk.y - 30 && lb.y < tk.y + 8) {
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
  const WP = {
    speed: 130, decay: 0.0012, ampBass: 13, ampMid: 7, ampTrb: 3,
    beatSense: 1.45, beatCooldown: 0.16, maxRipples: 16, specular: 0.55
  };
  const WB = 22;
  let ripples = [];
  let waterH = null;
  let bands = new Float32Array(WB);
  const wPhaseB = new Float32Array(WB);
  let idlePh = 0;
  let aState = { bass: 0, mid: 0, treble: 0, bassAvg: 0, bassPeak: 0.2, lastBeat: -1 };
  let audioLive = false;

  function waterReset() { ripples = []; waterH = null; bands = new Float32Array(WB); aState = { bass: 0, mid: 0, treble: 0, bassAvg: 0, bassPeak: 0.2, lastBeat: -1 }; }

  function readAudio() {
    const ap = document.getElementById('audioPlayer');
    audioLive = !!ap && !ap.paused && !!window.scAnalyser;
    if (!audioLive) { aState.bass *= 0.8; aState.mid *= 0.8; aState.treble *= 0.8; for (let b = 0; b < WB; b++) bands[b] *= 0.82; return; }
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
  }

// part 2
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
      if (volcano && Math.abs(i * cols.step - volcano.x) < volcano.r + 60) return false;
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
      { x: pi * cols.step, hp: TANK_HP, col: '#2ecc71', dead: false, fallFrom: undefined, wreck: 0, shield: 1, recoil: 0, terrDmg: 0, riseAcc: 0, dmgAcc: 0 },
      { x: ei * cols.step, hp: TANK_HP, col: '#ff4757', dead: false, fallFrom: undefined, wreck: 0, shield: 1, recoil: 0, terrDmg: 0, riseAcc: 0, dmgAcc: 0 }
    ];
    tanks.forEach(t => { t.x = clamp(t.x, 20, Wc - 20); t.y = surfaceAt(t.x); });

    const minGap = Math.max(90, Wc * 0.22);
    if (Math.abs(tanks[0].x - tanks[1].x) < minGap) {
      const px = tanks[0].x;
      const want = px < Wc / 2 ? 1 : -1;
      let bestI = -1, bestScore = -1;
      for (let i = 6; i < N - 6; i++) {
        const cx = i * cols.step;
        if (volcano && Math.abs(cx - volcano.x) < volcano.r + 60) continue;
        const gap = (cx - px) * want;
        if (gap < minGap) continue;
        if (cols[i].top > waterLevel - 14) continue;
        let flat = 0;
        for (let k = -3; k <= 3; k++) flat = Math.max(flat, Math.abs(cols[clamp(i + k, 0, N - 1)].top - cols[i].top));
        if (flat >= 12) continue;
        const score = Math.min(gap, Wc * 0.6) - flat * 3;
        if (score > bestScore) { bestScore = score; bestI = i; }
      }
      if (bestI < 0) {
        let ex = clamp(px + want * Math.max(minGap * 1.4, Wc * 0.3), 30, Wc - 30);
        if (volcano && Math.abs(ex - volcano.x) < volcano.r + 70) {
          ex = clamp(volcano.x + (ex < volcano.x ? -1 : 1) * (volcano.r + 100), 30, Wc - 30);
        }
        const ci = clamp(Math.round(ex / cols.step), 4, N - 5);
        const target = waterLevel - 26;
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
  }

  function newRound(first) {
    genTerrain();
    wind = windDir * R(0.3, 4);
    placeTanks();
    turn = turnOrder;
    state = 'aim';
    aim = { ang: R(35, 55), pow: R(45, 65) };
    aiAim = 55;
    cycleT = Math.random() < 0.7 ? R(0, 0.36) : R(0.56, 0.9);
    updateTod();
    shot = null; subshots = []; liquids = []; debris = []; remains = []; terraJobs = []; events = []; sinkers = []; fx = []; firePatches = [];
    windParts = []; comets = []; lavaBits = []; lastHitInfo = null; killed = null; lastKillMethod = 'weapon'; lastShotApex = 0;
    sliderOpen = null; sliderDrag = false; shake = 0;
    skyLight = { x: -999, col: '255,255,255', a: 0 };
    roundStart = Date.now();
    turnTimer = TURN_TIME;
    warnedAt = {};
    if (!first) round++;
    draw();
  }

  // ================= DEFORMATION =================
  function craterMask(cx, r, pow, mode, form, melt) {
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
        if (Math.abs(dx) < 1.05) to = cols[i].top - r * 2.1 * shape * Math.sqrt(Math.max(0, 1.06 - dx * dx)) * j;
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
        list.push({ i, from: cols[i].top, to, delay: Math.abs(dx) * 0.22 + noise(i * 9.1) * 0.08, dur: 0.3 + noise(i * 5.3) * 0.15, isCrater, isRim, melt: melt || 0, fill: mode === 'add' });
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

  // the void TRACKS the drill: floor extends to it, ceiling rises with it —
  // the column's total void height is capped, so it can never self-backfill
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
        if (tk.dead) return;
        const cc = cols[clamp(Math.round(tk.x / cols.step), 0, N - 1)];
        if (cc.h1 <= 0 && tk.y > cc.top + 8) addTerrDmg(i, 14, 'обвал');
      });
      slump(i0, i1, 5);
    }
  }

  function slump(i0, i1, rounds) {
    const N = cols.length;
    i0 = clamp(i0, 1, N - 2);
    i1 = clamp(i1, 1, N - 2);
    const stable = M().slope * 2.2;
    for (let it = 0; it < rounds; it++) {
      let moved = false;
      for (let i = i0; i < i1; i++) {
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
    if (t.dead || dmg <= 0) return;
    const room = TERR_DMG_MAX - (t.terrDmg || 0);
    if (room <= 0) return;
    dmg = Math.min(dmg, room);
    t.terrDmg = (t.terrDmg || 0) + dmg;
    t.hp -= dmg;
    lastHitInfo = `${t === tanks[0] ? 'Вы' : 'Враг'}: -${Math.round(dmg)} hp (${src})`;
    popDmg(t, dmg);
    if (t.hp <= 0) killTank(i, 'crush');
  }
  function popDmg(t, dmg) {
    if (dmg < 1 || fx.length > 380) return;
    fx.push({ k: 'hp', x: t.x + R(-8, 8), y: t.y - 36, val: Math.round(dmg), t: 0, life: 2.8 });
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
      return j.cols.some(c => j.t < c.delay + c.dur);
    });
    const ms = M().slope * 1.6;
    const K = 3 * dt;
    for (let i = Math.max(1, dirtyA); i < Math.min(cols.length - 1, dirtyB); i++) {
      const diff = cols[i + 1].top - cols[i].top;
      if (diff > ms) { const q = Math.min((diff - ms) * 0.25, K * 20); cols[i].top += q; cols[i + 1].top -= q; }
      else if (diff < -ms) { const q = Math.min((-diff - ms) * 0.25, K * 20); cols[i].top -= q; cols[i + 1].top += q; }
    }
    // wind-driven creep: dunes / snowdrifts migrate downwind (drift biomes)
    if (biome.mat.drift) {
      driftT += dt;
      if (driftT > 0.1) {
        driftT = 0;
        const N = cols.length;
        const rate = clamp(Math.abs(wind) * 0.3, 0.3, 2.2);
        const sgn = Math.sign(wind) || 1;
        if (sgn > 0) {
          for (let i = N - 2; i >= 2; i--) {
            const diff = cols[i].top - cols[i + 1].top;
            if (diff > 1.2) {
              const q = Math.min(diff * 0.5, rate) * (0.5 + noise(i * 2.7) * 0.8);
              cols[i].top -= q; cols[i + 1].top += q;
            }
          }
        } else {
          for (let i = 2; i <= N - 2; i++) {
            const diff = cols[i].top - cols[i - 1].top;
            if (diff > 1.2) {
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
      if (t.y - waterLevel > 12) killTank(i, 'drown');
    });
  }

  // ================= EXPLOSIONS =================
  function hitFx(x, y, r, nuke) { shake = Math.min(10, shake + r * 0.08 + (nuke ? 3 : 0)); }

  function boomsAt(x, y, r, style, dmg, noTerr, noDouble) {
    dmg = dmg || 0;
    const m = M();
    const nuke = style === 'nuke';
    hitFx(x, y, r, nuke);
    fx.push({ k: 'flash', x, y, r: r * 1.6, t: 0, life: nuke ? 0.22 : 0.11 });
    fx.push({ k: 'shock', x, y, r0: r * 0.4, r1: r * (nuke ? 4.2 : 2.2), t: 0, life: nuke ? 0.5 : 0.28 });
    fx.push({ k: 'fire', x, y, r, t: 0, life: nuke ? 1.4 : 0.45, nuke });
    if (!noTerr) {
      schedule(() => craterMask(x, r * (nuke ? 1.15 : 1), nuke ? 1.4 : 1.25, 'blast'), 0.12);
      schedule(() => spawnChunks(x, y, r, m.chunkN * (nuke ? 1.8 : 1)), 0.16);
      schedule(() => spawnDust(x, y, r, m.dustN * (nuke ? 1.6 : 1)), 0.22);
      const [sa, sb] = blastRange(x, r);
      schedule(() => slump(sa, sb, nuke ? 10 : 5), 0.75);
      schedule(() => collapseHoles(x, r * 1.15), 0.2);
      volcAgitate(x, y, nuke ? 0.5 : 0.25);
    }
    if (!noDouble && dmg > 0 && volcano && FIERY.includes(style) && !volcano.doused && nearCrater(x, y)) {
      schedule(() => {
        boomsAt(x, y, r * 1.1, style, dmg, noTerr, true);
        volcAgitate(x, y, 0.4);
      }, 0.16);
    }
    if (nuke) {
      schedule(() => fx.push({ k: 'mush', x, y: y - r * 0.4, r, t: 0, life: 3.4 }), 0.35);
      if (!noTerr) {
        schedule(() => spawnDust(x, y - r * 0.6, r * 0.7, m.dustN), 0.5);
        schedule(() => spawnDust(x + R(-r, r), y, r * 0.5, m.dustN * 0.5), 0.75);
        schedule(() => craterMask(x, r * 0.45, 0.5, 'add', 'ellipse'), 0.55);
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
      if (!tk.dead && Math.hypot(tk.x - x, tk.y - 6 - y) < r * (nuke ? 3.2 : 2.2)) damageTank(i, dmg, style, x, y);
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

  function stepFx(dt) {
    shake = Math.max(0, shake - dt * (4 + shake * 4));
    fx = fx.filter(f => {
      f.t += dt;
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
        if (f.y >= surfaceAt(f.x) - 1) {
          f.t = f.life;
          if (Math.random() < 0.35 && fx.length < 380) fx.push({ k: 'dust', x: f.x, y: f.y, vx: 0, vy: -10, r: 2, t: 0, life: 0.4, col: M().dustCol });
        }
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
          cols[ci].burn = Math.max(cols[ci].burn, 0.8);
          f.burnT += dt;
          if (f.burnT > 0.5) { f.burnT = 0; firePatches.push({ x: f.x, y: f.y, life: R(0.8, 1.6), volc: true }); }
          if (Math.random() < dt * 0.9) fx.push({ k: 'wisp', x: f.x, y: f.y - 3, vx: R(-3, 3), vy: -R(8, 16), ph: R(0, 6.28), t: 0, life: R(0.6, 1.2) });
          if (f.y > waterAt(f.x) - 1) { spawnWisps(f.x, waterAt(f.x), 3); f.t = f.life; }
          if (Math.abs(f.vx) < 2.5 && Math.abs(sl) < 0.08 && f.t > 3) f.t = f.life;
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
        const fl = floorAt(d.x, d.y);
        if (d.y >= fl - d.s / 2 && d.y > waterAt(d.x) - d.s) {
          d.settled = true; d.y = fl - d.s / 2; d.vr = 0;
          const ci = clamp(Math.round(d.x / cols.step), 0, cols.length - 1);
          const c = cols[ci];
          if (d.s > 1.6 && d.y < c.top + 2 && !(c.h1 > 0 && d.y >= c.h0 - 2)) {
            c.top = Math.min(c.top, Math.max(6, d.y + d.s * 0.3));
            dirtyA = Math.min(dirtyA, ci); dirtyB = Math.max(dirtyB, ci);
          }
          if (d.s > 3 && Math.random() < 0.5) fx.push({ k: 'dust', x: d.x, y: d.y, vx: 0, vy: -8, r: 2.5, t: 0, life: 0.5, col: M().dustCol });
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
      const fy = fp.y === undefined ? surfaceAt(fp.x) : fp.y;
      if (!fp.volc && Math.random() < dt * 2) fx.push({ k: 'smoke', x: fp.x + R(-4, 4), y: fy - 4, r: 3, t: 0, life: 1.6 });
      const ci = clamp(Math.round(fp.x / cols.step), 0, cols.length - 1);
      cols[ci].burn = Math.max(cols[ci].burn, 0.5);
      tanks.forEach((tk, i) => {
        if (!tk.dead && Math.abs(tk.x - fp.x) < 13 && Math.abs(tk.y - fy) < 16) damageTank(i, 14 * dt, 'napalm', fp.x, fy);
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
    t.recoil = 1;
    const tipX = t.x + Math.cos(rad) * 24 * dir;
    const tipY = t.y - 14 - Math.sin(rad) * 24;
    fx.push({ k: 'flash', x: tipX, y: tipY, r: 11, t: 0, life: 0.08 });
    for (let k = 0; k < 3; k++) fx.push({ k: 'smoke', x: tipX - Math.cos(rad) * (6 + k * 5) * dir, y: tipY + Math.sin(rad) * (6 + k * 5) + R(-2, 2), r: 2.5 + k, t: 0, life: R(0.5, 0.9) });
    fx.push({ k: 'dust', x: t.x, y: t.y, vx: R(-10, 10), vy: -14, r: 4, t: 0, life: 0.5, col: M().dustCol });
    shot = {
      x: tipX, y: tipY,
      vx: Math.cos(rad) * pow * (VMAX / 100) * dir, vy: -Math.sin(rad) * pow * (VMAX / 100),
      w, trail: [], dir, t0: gt, apex: t.y - 12, rot: 0,
      owner: tanks.indexOf(t), arm: gt + 0.3
    };
    state = 'fly'; turn = who; drag = null; sliderOpen = null; sliderDrag = false;
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
      if (pos.x >= 0 && pos.x <= Wc && shotBlocked(pos.x, pos.y)) return { x: pos.x, y: pos.y };
    }
    return null;
  }

  // ============ DIGGER: charge-based bore ============
  // Charge = 0.42*Wc of TOTAL drilling; flight in the air is FREE and does not
  // burn it. In rock: fixed slow schedule. The drill holds depth under the LOCAL
  // surface. Air exit: ballistic continuation with the stored heading; a new bite
  // into rock continues at the SAME dy cap as a barrel-shot entry (~horizontal),
  // so air-then-rock tunnels are identical to ground-start tunnels.
  function digEnter(p) {
    p.digging = true;
    p.sid = ++digSid;
    p.digT = 0;
    if (p.charge === undefined) p.charge = Wc * DIG_LEN;
    p.dugLen = 0;
    const sp = Math.hypot(p.vx, p.vy) || 1;
    let dx = p.vx / sp, dy = p.vy / sp;
    if (Math.abs(dx) < 0.3) dx = (p.dir || 1) * 0.95;
    if (dy > 0.06) dy = 0.06;
    if (dy < -0.06) dy = -0.06;
    const n = Math.hypot(dx, dy);
    p.dvx = dx / n; p.dvy = dy / n;
    sfx(0.5);
    shake = Math.min(10, shake + 2.5);
    for (let k = 0; k < 8; k++) {
      debris.push({ x: p.x + R(-8, 8), y: surfaceAt(p.x) - R(0, 6), vx: R(-80, 80), vy: -R(120, 260), rot: R(0, 6), vr: R(-7, 7), s: R(1.5, 3.5), col: M().chunks[(Math.random() * M().chunks.length) | 0], settled: false, life: 11 });
    }
  }
  function digMotion(p, dt) {
    if (p.y < surfaceAt(p.x) - 4 && !inVoid(p.x, p.y)) {
      // broke out into open air: FREE ballistic flight, charge preserved,
      // heading stored — the drill will bite the next hill the same way
      p.digging = false;
      const sp = Math.max(Math.hypot(p.vx, p.vy), 240);
      p.vx = p.dvx * sp;
      p.vy = p.dvy * sp - 40;
      return;
    }
    const speed = DIG_SPEED1 + (DIG_SPEED0 - DIG_SPEED1) * Math.pow(1 - clamp(p.dugLen / Math.max(1, p.charge), 0, 1), 1.6);
    const roof = p.y - surfaceAt(p.x);
    const want = clamp((DIG_DEPTH - roof) * 0.02, -0.18, 0.6);
    p.dvy += (want - p.dvy) * Math.min(1, dt * 3);
    const n = Math.hypot(p.dvx, p.dvy) || 1;
    p.dvx /= n; p.dvy /= n;
    p.vx = p.dvx * speed; p.vy = p.dvy * speed;
    const nx = p.x + p.vx * dt;
    const ny = Math.min(p.y + p.vy * dt, Hc - 10);
    if (nx < 4 || nx > Wc - 4) { p.dead = true; p.dug = true; return; }
    carveLine(p.x, p.y, nx, ny, p.w.r * DIG_RADIUS_F, p.sid);
    p.dugLen += Math.hypot(nx - p.x, ny - p.y);
    p.charge -= Math.hypot(nx - p.x, ny - p.y);
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
      if (!isTerr(p.w.type) && p.w.water !== 'sink') {
        tanks.forEach((tk, i) => {
          if (tk.dead) return;
          if (i === p.owner && gt < (p.arm || 0)) return;
          if (Math.abs(p.x - tk.x) < 16 && p.y > tk.y - 34 && p.y < tk.y + 8) {
            p.dead = true;
            if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
            else damageTank(i, p.w.dmg, p.w.type, p.x, p.y);
          }
        });
        if (p.dead) return;
      }
      const surf = surfaceAt(p.x);
      if (p.w.type === 'roller' && !p.rollDrop && p.y >= surf - 6 && p.y < surf + 16) {
        const c = colAt(p.x);
        if (c.h1 > 0 && c.h0 <= c.top + 2) { p.rollDrop = true; return; }
        if (surf > waterLevel + 4) { p.dead = true; p.wet = true; return; }
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
            else damageTank(i, p.w.dmg, 'roller', p.x, p.y);
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
        // sinking weapons: no splash-detonation, they just sink (rockets etc.)
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
    if (l.y >= waterAt(l.x) && surfaceAt(l.x) > waterLevel + 4) { l.dead = true; fx.push({ k: 'splash', x: l.x, y: waterAt(l.x), r: 12, t: 0, life: 0.5 }); return; }
    if (l.y >= surfaceAt(l.x) && !inVoid(l.x, l.y)) {
      firePatches.push({ x: l.x, y: l.y, life: R(4, 8) });
      l.dead = true;
      return;
    }
  }

  //part 3
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
            fx.push({ k: 'flash', x: bx, y: by, r: br * 1.4, t: 0, life: 0.09, col: ['#a29bff', '#ffd23f', '#ff6b9d', '#7bffc4'][(Math.random() * 4) | 0] });
            craterMask(bx, br, 1, 'blast', 'circle');
            spawnChunks(bx, by, br, 6);
            collapseHoles(bx, br * 1.2);
            sfx(0.25);
            tanks.forEach((tk, i) => {
              if (!tk.dead && Math.hypot(tk.x - bx, tk.y - 6 - by) < br * 1.7) {
                if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
                else damageTank(i, w.dmg, 'funky', bx, by);
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
        fx.push({ k: 'flash', x, y, r: w.r * 2, t: 0, life: 0.16 });
        fx.push({ k: 'skyflash', t: 0, life: 0.5, col: 'rgba(255,236,200,', a: 0.3 });
        fx.push({ k: 'shock', x, y, r0: w.r * 0.5, r1: w.r * 3.4, t: 0, life: 0.55 });
        fx.push({ k: 'shock', x, y, r0: w.r * 0.2, r1: w.r * 2.2, t: 0, life: 0.35 });
        fx.push({ k: 'fire', x, y, r: w.r, t: 0, life: 1.4, nuke: true });
        schedule(() => craterMask(x, w.r, 1.45, 'blast', 'ellipse'), 0.12);
        schedule(() => spawnChunks(x, y, w.r, M().chunkN * 1.6), 0.15);
        schedule(() => spawnDust(x, y, w.r, M().dustN * 1.4), 0.2);
        schedule(() => spawnDust(x + R(-w.r, w.r), y, w.r * 0.6, M().dustN * 0.6), 0.45);
        schedule(() => collapseHoles(x, w.r * 1.3), 0.2);
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
          if (!tk.dead && Math.hypot(tk.x - x, tk.y - 6 - y) < w.r * 2.6) {
            if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
            else damageTank(i, w.dmg, 'death', x, y);
          }
        });
        break;
      }
      case 'nuke': {
        boomsAt(x, y, w.r, 'nuke', w.dmg);
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
        break;
      }
      case 'plasma': {
        hitFx(x, y, w.r * 0.55, false);
        fx.push({ k: 'plasmaOrb', x, y, r: w.r, t: 0, life: 3.4 });
        fx.push({ k: 'skyflash', t: 0, life: 0.4, col: 'rgba(255,120,80,', a: 0.22 });
        schedule(() => craterMask(x, w.r, 1.1, 'blast', 'star', 1), 0.05);
        schedule(() => collapseHoles(x, w.r), 0.2);
        [0.3, 0.85, 1.4].forEach(dl => {
          schedule(() => fx.push({ k: 'ring', x, y, t: 0, life: 0.8, r0: w.r * 0.3, r1: w.r * 2.4, col: '255,90,50' }), dl);
        });
        schedule(() => craterMask(x, w.r * 0.6, 0.7, 'blast', 'star', 1), 0.9);
        schedule(() => { const [sa, sb] = blastRange(x, w.r); slump(sa, sb, 4); }, 1.6);
        schedule(() => spawnWisps(x, y - 6, 6), 2.0);
        if (volcano && !volcano.doused && nearCrater(x, y)) {
          schedule(() => { boomsAt(x, y, w.r, 'plasma', w.dmg, false, true); volcAgitate(x, y, 0.4); }, 0.16);
        }
        sfx(0.7);
        tanks.forEach((tk, i) => {
          if (!tk.dead && Math.hypot(tk.x - x, tk.y - 6 - y) < w.r * 1.9) {
            if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
            else damageTank(i, w.dmg, 'plasma', x, y);
          }
        });
        break;
      }
      case 'napalm': {
        fx.push({ k: 'flash', x, y, r: w.r * 0.6, t: 0, life: 0.08, col: '#ffb84a' });
        for (let i = 0; i < 18; i++) liquids.push({ x: x + R(-w.r / 2, w.r / 2), y, vx: R(-45, 45), vy: R(-100, -25), t: 0, w });
        firePatches.push({ x, y, life: R(5, 9) });
        schedule(() => craterMask(x, w.r * 0.5, 0.35, 'blast', 'ellipse'), 0.6);
        schedule(() => { for (let k = 0; k < 3; k++) liquids.push({ x: x + R(-w.r / 2, w.r / 2), y: y - 6, vx: R(-60, 60), vy: -R(80, 160), t: 0, w }); }, 0.9);
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
          boomsAt(x, y, 26, 'missile', 16);
          for (let k = 0; k < 10; k++) {
            const dx = x + R(-14, 14);
            debris.push({ x: dx, y: surfaceAt(dx) - R(4, 20), vx: R(-40, 40), vy: -R(80, 200), rot: R(0, 6), vr: R(-6, 6), s: R(1.5, 3.5), col: M().chunks[(Math.random() * M().chunks.length) | 0], settled: false, life: 12 });
          }
          fx.push({ k: 'dustc', x, y: surfaceAt(x) - 10, r: 14, t: 0, life: 0.9, col: M().dustCol });
        } else {
          fx.push({ k: 'shock', x, y, r0: 6, r1: w.r, t: 0, life: 0.25 });
          digTrench(x, y, ang, w.r * 1.7, w.r * DIG_RADIUS_F);
          sfx(0.4);
        }
        break;
      }
      case 'dirt': {
        craterMask(x, w.r, 1, 'add', 'ellipse');
        spawnDirtFall(x, w.r);
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
    schedule(() => { state = 'aim'; turnOrder = 1 - turnOrder; turn = turnOrder; turnTimer = TURN_TIME; warnedAt = {}; draw(); }, 0.6);
  }

  function wetHit(p) {
    state = 'boom';
    lastShotApex = p.apex || 0;
    const w = p.w, x = p.x, y = p.y;
    const yw = waterAt(x);
    if (p.bed) {
      if (w.water === 'bottom') {
        hitFx(x, y, w.r, true);
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
          if (!tk.dead && Math.hypot(tk.x - x, tk.y - 6 - y) < w.r * 2.4) damageTank(i, w.dmg, 'death', x, y);
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

  function damageTank(i, baseDmg, style, x, y) {
    const t = tanks[i];
    if (t.dead || baseDmg <= 0) return;
    if (style === 'lava') {
      t.hp -= baseDmg;
      popDmg(t, baseDmg);
      if (t.hp <= 0) killTank(i, 'weapon', 'lava');
      draw();
      return;
    }
    const d = Math.hypot(t.x - x, (t.y - 6 - y) * 0.55);
    const wref = ARSENAL.find(w => w.key === style || w.type === style);
    const r = wref ? wref.r : 30;
    const factor = clamp(1 - d / (r * 2.1), 0.18, 1);
    const dmg = baseDmg * factor;
    t.hp -= dmg;
    lastHitInfo = `${t === tanks[0] ? 'Вы' : 'Враг'}: -${Math.round(dmg)} hp`;
    t.dmgAcc = (t.dmgAcc || 0) + dmg;
    if (t.dmgAcc >= 9) { popDmg(t, t.dmgAcc); t.dmgAcc = 0; }
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
      boomsAt(t.x, t.y - 10, 34, 'missile', 0);
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
    turnOrder = 1 - turnOrder;
    turn = turnOrder;
    turnTimer = TURN_TIME;
    warnedAt = {};
    draw();
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
    if (res === 'win') {
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
    } else if (res === 'lose') {
      aiSkill = Math.max(0.2, aiSkill - 0.05);
    } else {
      score += 30;
    }
    const list = BANNERS[res];
    fx.push({ k: 'banner', txt: list[(Math.random() * list.length) | 0], col: BANNER_COL[res], t: 0, life: 2.3 });
    if (round >= ROUNDS_MAX) { schedule(() => showOver(), 2.3); return; }
    schedule(() => newRound(false), 2.3);
  }

  function showOver() {
    const won = wins >= Math.ceil(ROUNDS_MAX / 2);
    if (score > 0) saveRec();
    const before = records();
    const recs = records();
    const myIdx = recs.findIndex(r => !before.includes(r));
    $('.sc-over-title').textContent = won ? '🏆 Победа!' : '💥 Поражение';
    $('.sc-over-res').innerHTML = `Очки: <b style="color:var(--accent)">${score}</b>&nbsp;&nbsp;побед: <b>${wins}</b> из ${ROUNDS_MAX}`;
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
    turnOrder = Math.random() < 0.5 ? 0 : 1;
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
    cycleT = (cycleT + dt / DAY_CYCLE) % 1;
    updateTod();
    for (let i = events.length - 1; i >= 0; i--) if (gt >= events[i].at) { const fn = events[i].fn; events.splice(i, 1); fn(); }

    if (state === 'aim' && turn === 0) {
      const before = turnTimer;
      turnTimer -= dt;
      // countdown beeps at 10, 5 and 1 s
      for (const m of [10, 5, 1]) {
        if (before > m && turnTimer <= m && !warnedAt[m]) {
          warnedAt[m] = 1;
          beep(m <= 1 ? 1200 : 880, 0.09, 0.22);
        }
      }
      if (turnTimer <= 0) {
        turnTimer = 0;
        drag = null; sliderOpen = null; sliderDrag = false;
        lastHitInfo = 'Время вышло — ход пропущен';
        endTurn();
      }
    }

    if (state === 'fly' && shot) {
      updateProjectile(shot, dt);
      if (shot && shot.dead) { resolveHit(shot); shot = null; }
    }
    subshots = subshots.filter(s => { updateProjectile(s, dt); if (s.dead) { resolveHit(s); return false; } return true; });
    liquids = liquids.filter(l => { updateLiquid(l, dt); return !l.dead; });
    sinkers = sinkers.filter(sk => {
      sk.t += dt; sk.y += 26 * dt; sk.x += Math.sin(sk.t * 2) * 0.4;
      if (Math.random() < dt * 3) fx.push({ k: 'sed', x: sk.x + R(-6, 6), y: sk.y - 6, vx: 0, vy: R(3, 8), t: 0, life: R(0.6, 1.4), s: R(1, 1.8) });
      return sk.y < Hc - 4 && sk.t < 6;
    });
    stepTerra(dt * 2.2);
    stepFx(dt * 1.6);
    stepWater(dt);
    stepLavaBits(dt);

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
        fx.push({ k: 'flash', x: bx, y: surfaceAt(bx) - 10, r: 34, t: 0, life: 0.18, col: '#ffb054' });
        sfx(1.0);
        shake = Math.min(10, shake + 5);
      }
      volcano.power += (0.3 - volcano.power) * dt * 0.012;
      const dz = !!volcano.doused;
      const capY = Math.min(volcano.coneBot, Hc - 10);
      volcano.craters.forEach(cr => {
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
    if (nn > 0.6 && Math.random() < dt * 0.08) {
      comets.push({ x: R(0, Wc * 1.1), y: R(10, Hc * 0.3), vx: -R(160, 380), vy: R(30, 110), t: 0, life: R(0.8, 2), sz: R(1, 2.4) });
    }
    comets.forEach(c => { c.x += c.vx * dt; c.y += c.vy * dt; c.t += dt; });
    comets = comets.filter(c => c.t < c.life);

    const want = windKind() === 'snow' ? 0 : Math.round(clamp(Math.abs(wind), 0.3, 4) * 14);
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
    if (boomsIdle() && !shot && subshots.length === 0) {
      if (killed !== null && state !== 'wait' && state !== 'over' && state !== 'closing') endRound();
      else if (state === 'boom') endTurn();
    }
    if (state !== 'closing' && state !== 'over') draw();
  }
  const boomsIdle = () => booms0() && events.length === 0;
  function booms0() { return !fx.some(f => f.k === 'fire' || f.k === 'flash' || f.k === 'shock' || f.k === 'plasmaOrb') && terraJobs.length === 0 && liquids.length === 0 && !debris.some(d => !d.settled) && !firePatches.some(fp => !fp.volc); }

  // ================= RENDER =================
  function draw() {
    if (!ctx || !Wc || !cols) return;
    const sh = shake > 0.3 ? shake : 0;
    const shx = sh ? (noise(gt * 61) - 0.5) * 2 * sh : 0;
    const shy = sh ? (noise(gt * 47 + 9.7) - 0.5) * 2 * sh : 0;
    ctx.save();
    if (sh) ctx.translate(shx, shy);
    drawSky();
    drawTerrain();
    drawRemains();
    drawDebris();
    drawSinkers();
    drawTanks();
    drawWater();
    if (shot) drawShot(shot);
    subshots.forEach(drawShot);
    drawLiquids();
    drawFire();
    drawFx();
    drawLavaBits();
    drawWindParts();
    drawFog();
    drawHpLate();
    drawBanners();
    drawOffscreenMarks();
    if (state === 'aim' && turn === 0 && !helpOpen && !sliderOpen) drawAim();
    ctx.restore();
    drawHUD();
    drawSlider();
  }

  function drawSky() {
    const p = cycleT;
    skyLight = { x: -999, col: '255,255,255', a: 0 };
    const g = ctx.createLinearGradient(0, 0, 0, Hc);
    tod.stops.forEach((c, i) => g.addColorStop(i / (tod.stops.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, Wc + 60, Hc + 60);
    const nn = 1 - dayness;
    const starA = clamp((nn - 0.25) / 0.5, 0, 1);
    if (starA > 0.02) {
      stars.forEach(st => {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(skyT * st.tw + st.ph));
        ctx.globalAlpha = tw * starA * 0.9;
        ctx.fillStyle = st.col;
        ctx.fillRect(st.x, st.y, st.sz, st.sz);
        if (st.cross && st.sz > 1.8) {
          ctx.globalAlpha = tw * 0.35 * starA;
          ctx.fillRect(st.x - st.sz, st.y + st.sz / 2 - 0.5, st.sz * 3, 1);
          ctx.fillRect(st.x + st.sz / 2 - 0.5, st.y - st.sz, 1, st.sz * 3);
        }
      });
      ctx.globalAlpha = 0.07 * starA;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 80; i++) {
        const t = (i * 61.7) % 100 / 100;
        ctx.fillRect(t * Wc, Hc * 0.1 + t * Hc * 0.35 + (noise(i * 3.3) - 0.5) * 50, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    {
      const inNight = p >= 0.51 && p <= 0.97;
      const mp = inNight ? (p - 0.53) / 0.44 : -0.35;
      const mx = -60 + mp * (Wc + 120);
      const my = Hc * (0.30 - Math.sin(clamp(mp, 0, 1) * Math.PI) * 0.18);
      const shimmer = 0.92 + Math.sin(skyT * 1.3) * 0.06;
      const Rm = 16 * shimmer;
      const bx = mx + moonBite * shimmer;
      const by = my - Math.abs(moonBite) * 0.3;
      const br = moonBiteR * shimmer;
      const hg = ctx.createRadialGradient(mx, my, Rm * 0.5, mx, my, Rm * 2.1);
      hg.addColorStop(0, 'rgba(200,215,235,0.28)');
      hg.addColorStop(1, 'rgba(200,215,235,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(mx, my, Rm * 2.1, 0, Math.PI * 2); ctx.fill();
      if (!moonCv) { moonCv = document.createElement('canvas'); moonCv.width = 96; moonCv.height = 96; moonCtx = moonCv.getContext('2d'); }
      const MC = 48;
      moonCtx.globalCompositeOperation = 'source-over';
      moonCtx.clearRect(0, 0, 96, 96);
      moonCtx.beginPath(); moonCtx.arc(MC, MC, Rm, 0, Math.PI * 2);
      moonCtx.fillStyle = '#dfe4ea';
      moonCtx.fill();
      moonCtx.globalCompositeOperation = 'destination-out';
      moonCtx.beginPath(); moonCtx.arc(MC + bx - mx, MC + by - my, br, 0, Math.PI * 2);
      moonCtx.fill();
      ctx.drawImage(moonCv, mx - MC, my - MC);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = 'rgba(150,160,175,0.6)';
      [[-6, 2, 3], [4, 6, 2.2]].forEach(c => {
        const cx = mx + c[0], cy = my + c[1];
        if (Math.hypot(cx - bx, cy - by) > br * 0.95) {
          ctx.beginPath(); ctx.arc(cx, cy, c[2], 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      if (mx > 20 && mx < Wc - 20) skyLight = { x: mx, col: '205,220,240', a: 0.55 * starA + 0.1 };
    }
    comets.forEach(c => {
      const cp = c.t / c.life;
      const sz = c.sz || 1.5;
      ctx.strokeStyle = `rgba(200,230,255,${0.85 * (1 - cp) * starA})`;
      ctx.lineWidth = sz;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x - c.vx * 0.5, c.y - c.vy * 0.5);
      ctx.stroke();
      ctx.fillStyle = `rgba(240,250,255,${(1 - cp) * 0.9 * starA})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, sz, 0, Math.PI * 2); ctx.fill();
    });
    ctx.lineWidth = 1;
    {
      const sunP = p >= 0.95 ? (p - 0.95) / 0.55 : (p + 0.05) / 0.55;
      const sx = -60 + sunP * (Wc + 120);
      const sy = Hc * (0.30 - Math.sin(clamp(sunP, 0, 1) * Math.PI) * 0.20);
      const alt = clamp((Hc * 0.30 - sy) / (Hc * 0.17), 0, 1);
      const hot = mixColA(parseCol('#ff6a3a'), parseCol(tod.sun), alt);
      const halo = mixColA(parseCol('rgba(255,110,70,0.4)'), parseCol(tod.sunHalo), alt);
      const shimmer = 1 + Math.sin(skyT * 1.1) * 0.05;
      ctx.fillStyle = rgbaStr(halo);
      ctx.beginPath(); ctx.arc(sx, sy, 52 * shimmer, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgbaStr(hot);
      ctx.beginPath(); ctx.arc(sx, sy, 24 * shimmer, 0, Math.PI * 2); ctx.fill();
      if (sx > 20 && sx < Wc - 20) skyLight = { x: sx, col: '255,238,190', a: 0.2 + alt * 0.55 };
    }
    for (let c = 0; c < cloudCount; c++) {
      const depth = 0.4 + noise(c * 1.7) * 0.65;
      const cy = Hc * (0.04 + noise(c * 7.7) * 0.26);
      const cw = 110 + noise(c * 3.1) * 150;
      const cx = (((cloudOff * depth) + noise(c * 13) * Wc * 1.4) % (Wc + 420) + (Wc + 420)) % (Wc + 420) - 210;
      const cl = mixColA([56, 64, 84, 1], [255, 255, 255, 1], dayness);
      const a = (0.16 + noise(c * 5) * 0.10) * (0.5 + 0.5 * dayness) + 0.24 * (1 - dayness);
      const lobes = 16 + ((noise(c * 11.3) * 12) | 0);
      const lob = (b, shrink, lift) => {
        const u = b / (lobes - 1);
        const lx = cx + (u - 0.5) * cw * (1 - shrink * 0.3);
        const lr = Math.max(4, cw * 0.3 * Math.sin(Math.PI * clamp(u * 1.1 + 0.08, 0.08, 0.92)) * (0.65 + noise(c * 17 + b * 3) * 0.7) * (1 - shrink * 0.5));
        const ly = cy - lr * 0.3 - lift + Math.sin(b * 2.3 + c * 1.7) * 3;
        return [lx, ly, lr];
      };
      ctx.fillStyle = `rgba(${cl[0] | 0},${cl[1] | 0},${cl[2] | 0},${a.toFixed(3)})`;
      ctx.beginPath();
      for (let b = 0; b < lobes; b++) { const [lx, ly, lr] = lob(b, 0, 0); ctx.moveTo(lx + lr, ly); ctx.arc(lx, ly, lr, 0, Math.PI * 2); }
      ctx.fill();
      ctx.fillStyle = `rgba(${cl[0] | 0},${cl[1] | 0},${cl[2] | 0},${(a * 0.95).toFixed(3)})`;
      ctx.beginPath();
      for (let b = 1; b < lobes - 1; b += 2) { const [lx, ly, lr] = lob(b, 0.5, cw * 0.07); ctx.moveTo(lx + lr, ly); ctx.arc(lx, ly, lr, 0, Math.PI * 2); }
      ctx.fill();
      const dk = mixColA(cl, [16, 20, 32, 1], 0.45);
      ctx.fillStyle = `rgba(${dk[0] | 0},${dk[1] | 0},${dk[2] | 0},${(a * 0.8).toFixed(3)})`;
      ctx.beginPath();
      for (let b = 0; b < lobes; b++) { const [lx, ly, lr] = lob(b, 0, 0); ctx.moveTo(lx + lr * 0.92, ly + lr * 0.3); ctx.arc(lx, ly + lr * 0.3, lr * 0.92, 0, Math.PI); }
      ctx.fill();
    }
    const hz = ctx.createLinearGradient(0, Hc * 0.45, 0, Hc * 0.75);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(1, tod.haze);
    ctx.fillStyle = hz;
    ctx.fillRect(-30, Hc * 0.45, Wc + 60, Hc * 0.3);
  }

  function drawTerrain() {
    const N = cols.length;
    const bk = biomeKey();
    ctx.beginPath();
    ctx.moveTo(-30, Hc + 30);
    ctx.lineTo(-30, cols[0].top);
    for (let i = 0; i < N; i++) ctx.lineTo(i * cols.step, cols[i].top);
    ctx.lineTo(Wc + 30, cols[N - 1].top);
    ctx.lineTo(Wc + 30, Hc + 30);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, Hc * 0.25, 0, Hc);
    g.addColorStop(0, biome.sub[0]); g.addColorStop(0.5, biome.sub[1]); g.addColorStop(1, biome.sub[2]);
    ctx.fillStyle = g;
    ctx.fill();
    if (groundPat) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = groundPat;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
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
      const mouth = c.h1 > 0 && c.h0 <= c.top + 2;
      if (c.surf > 0 && !mouth) {
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
      if (c.melt > 0) {
        ctx.globalAlpha = c.melt * 0.8;
        ctx.fillStyle = '#ff6a20';
        ctx.fillRect(x, c.top, w, 3 + c.melt * 6);
        ctx.globalAlpha = c.melt * 0.55;
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x, c.top, w, 2);
        ctx.globalAlpha = 1;
      }
    }
    {
      let i = 0;
      while (i < N) {
        if (cols[i].h1 <= 0) { i++; continue; }
        let j = i + 1;
        while (j < N && cols[j].h1 > 0) j++;
        const vA = (k) => Math.max(cols[k].h0, cols[k].top);
        const x0 = i * cols.step - 0.5;
        const x1 = (j - 1) * cols.step + cols.step;
        ctx.beginPath();
        ctx.moveTo(x0, vA(i));
        for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, vA(k));
        for (let k = j - 1; k >= i; k--) ctx.lineTo(k * cols.step, cols[k].h1);
        ctx.closePath();
        const gg = ctx.createLinearGradient(0, vA(i), 0, Math.max(cols[i].h1, vA(i) + 1));
        gg.addColorStop(0, shade(biome.sub[0], 0.5));
        gg.addColorStop(0.35, shade(biome.sub[1], 0.34));
        gg.addColorStop(1, shade(biome.sub[2], 0.42));
        ctx.fillStyle = gg;
        ctx.fill();
        if (groundPat) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = groundPat;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, (vA(i) + cols[i].h1) / 2);
        for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, (vA(k) + cols[k].h1) / 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(196,168,132,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x0, vA(i) + 0.5);
        for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, vA(k) + 0.5);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(150,116,82,0.4)';
        ctx.beginPath();
        ctx.moveTo(x0, cols[i].h1 - 0.5);
        for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, cols[k].h1 - 0.5);
        ctx.stroke();
        ctx.lineWidth = 1;
        const mouth = (k) => {
          const c = cols[k];
          if (c.h0 <= c.top + 2) {
            ctx.fillStyle = 'rgba(255,214,150,0.5)';
            ctx.fillRect(k * cols.step - 1, c.top + 1, 2, 2);
            ctx.fillRect(k * cols.step - 1, c.top + 4, 2, 1);
          }
        };
        mouth(i); mouth(j - 1);
        i = j;
      }
    }
    if (bk === 'green') {
      ctx.strokeStyle = 'rgba(52,92,32,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < N; i += 3) {
        const c = cols[i];
        if (c.surf <= 0 || c.burn > 0.2 || (c.h1 > 0 && c.h0 <= c.top + 2)) continue;
        if (noise(i * 13.7) < 0.55) continue;
        const x = i * cols.step;
        const h = 3 + noise(i * 3.3) * 4;
        const sway = Math.sin(gt * 1.6 + i * 0.7) * 1.2;
        ctx.moveTo(x, c.top + 1);
        ctx.lineTo(x + sway, c.top - h);
        if (noise(i * 7.7) > 0.5) {
          ctx.moveTo(x + 2, c.top + 1);
          ctx.lineTo(x + 2 + sway * 0.7, c.top - h * 0.7);
        }
      }
      ctx.stroke();
    } else if (bk === 'desert') {
      ctx.strokeStyle = 'rgba(122,92,52,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < N; i += 6) {
        const c = cols[i];
        if (c.surf <= 0) continue;
        const x = i * cols.step;
        ctx.moveTo(x, c.top + 3);
        ctx.quadraticCurveTo(x + 4, c.top + 1, x + 8, c.top + 3.5);
      }
      ctx.stroke();
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
    if (volcano) {
      volcano.craters.forEach(cr => {
        if (cr.y > waterAt(cr.x)) return;
        const gg = ctx.createRadialGradient(cr.x, cr.y, 1, cr.x, cr.y, 8);
        gg.addColorStop(0, `rgba(255,150,50,${(0.25 + volcano.power * 0.2).toFixed(3)})`);
        gg.addColorStop(1, 'rgba(255,150,50,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(cr.x, cr.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff9a30';
        ctx.fillRect(cr.x - 2, cr.y - 1, 4, 2);
      });
    }
  }

  function drawWater() {
    if (!waterH) return;
    const dark = !isDayT();
    const N = cols.length;
    const sky = parseCol(tod.stops[0]);
    const sc = [
      Math.round(dark ? 45 : sky[0] * 0.35 + 150),
      Math.round(dark ? 85 : sky[1] * 0.35 + 150),
      Math.round(dark ? 140 : sky[2] * 0.3 + 160)
    ];
    const dc = dark ? [8, 18, 38] : [14, 34, 66];
    let i = 0;
    while (i < N) {
      const y0 = waterLevel + waterH[i];
      if (cols[i].top <= y0) { i++; continue; }
      let j = i + 1;
      while (j < N && cols[j].top > waterLevel + waterH[j]) j++;
      const x0 = i * cols.step, x1 = (j - 1) * cols.step;
      const g = ctx.createLinearGradient(0, waterLevel - 14, 0, Hc * 0.98);
      g.addColorStop(0, `rgba(${sc[0]},${sc[1]},${sc[2]},0.5)`);
      g.addColorStop(0.45, `rgba(${(sc[0] * 0.45 + dc[0] * 0.55) | 0},${(sc[1] * 0.45 + dc[1] * 0.55) | 0},${(sc[2] * 0.45 + dc[2] * 0.55) | 0},0.66)`);
      g.addColorStop(1, `rgba(${dc[0]},${dc[1]},${dc[2]},0.88)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, waterLevel + waterH[i]);
      for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, waterLevel + waterH[k]);
      ctx.lineTo(x1, Hc);
      ctx.lineTo(x0, Hc);
      ctx.closePath();
      ctx.fill();
      i = j;
    }
    for (let k = 0; k < N; k++) {
      const c = cols[k];
      if (c.h1 <= 0) continue;
      const v0 = Math.max(c.h0, c.top);
      const wy = Math.max(v0, waterLevel + waterH[k] * 0.5);
      if (c.h1 > wy + 1) {
        ctx.fillStyle = `rgba(${sc[0]},${sc[1]},${sc[2]},0.55)`;
        ctx.fillRect(k * cols.step, wy, cols.step + 0.5, c.h1 - wy);
        ctx.fillStyle = `rgba(${dc[0]},${dc[1]},${dc[2]},0.55)`;
        ctx.fillRect(k * cols.step, c.h1 - 3, cols.step + 0.5, 3);
        if (waterLevel > v0) {
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fillRect(k * cols.step, waterLevel + waterH[k] * 0.5, cols.step + 0.5, 1);
        }
      }
    }
    const surfPath = () => {
      ctx.beginPath();
      let started = false;
      for (let k = 0; k < N; k++) {
        const x = k * cols.step, y = waterLevel + waterH[k];
        if (cols[k].top <= y) { started = false; continue; }
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
    };
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = `rgba(${Math.min(255, sc[0] + 70)},${Math.min(255, sc[1] + 70)},${Math.min(255, sc[2] + 60)},0.8)`;
    surfPath(); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(6,20,40,0.3)';
    ctx.save();
    ctx.translate(0, 1.6);
    surfPath(); ctx.stroke();
    ctx.restore();
    const starA = clamp(((1 - dayness) - 0.25) / 0.5, 0, 1);
    if (starA > 0.35) {
      ctx.fillStyle = `rgba(230,240,255,${(0.5 * starA).toFixed(3)})`;
      for (let k = 0; k < 14; k++) {
        const x = (noise(k * 5.3 + 11) * Wc) % Wc;
        const y = waterAt(x);
        if (surfaceAt(x) <= y) continue;
        const tw = Math.abs(Math.sin(gt * (1.5 + noise(k) * 2) + k * 2.4));
        if (tw > 0.6) ctx.fillRect(x, y - 0.8, 1.4, 1.4);
      }
    }
    if (skyLight.a > 0.08 && skyLight.x > 10 && skyLight.x < Wc - 10 && surfaceAt(skyLight.x) > waterLevel + 6) {
      const baseA = skyLight.a * 0.22;
      for (let k = 0; k < 9; k++) {
        const yy = waterAt(skyLight.x) + 2 + k * 5;
        if (surfaceAt(skyLight.x) <= yy) break;
        const wob = Math.sin(gt * 1.4 + k * 1.7) * 4;
        const w2 = (14 - k) * (0.7 + 0.5 * noise(k * 3.1 + gt * 0.7));
        ctx.fillStyle = `rgba(${skyLight.col},${(baseA * (1 - k * 0.09)).toFixed(3)})`;
        ctx.fillRect(skyLight.x - w2 / 2 + wob, yy, w2, 1.6);
      }
    }
  }

  function drawFog() {
    const bk = biomeKey();
    const nn = 1 - dayness;
    let amt = nn * 0.5;
    if (bk === 'arctic') amt = 0.6 + nn * 0.4;
    else if (tod.stars === 'dim') amt += 0.2;
    if (amt < 0.12) return;
    for (let L = 0; L < 3; L++) {
      const yb = L * 5;
      for (let x = 0; x < Wc; x += 26) {
        const a = amt * 0.06 * (0.4 + 0.6 * noise(x * 0.015 + L * 7.3 + Math.sin(gt * 0.05 + L) * 2));
        if (a < 0.012) continue;
        const sy = surfaceAt(x + 13) - 10 - yb + Math.sin(gt * 0.3 + x * 0.02 + L) * 2;
        ctx.fillStyle = `rgba(206,218,234,${a.toFixed(3)})`;
        ctx.fillRect(x, sy, 26, 7 + L * 2);
      }
    }
  }

  function drawHpLate() {
    fx.forEach(f => {
      if (f.k !== 'hp') return;
      const p = f.t / f.life;
      const a = 1 - p;
      const yy = f.y - ease(p) * 34;
      ctx.font = '700 18px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = clamp(a * 1.4, 0, 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText('-' + f.val, f.x, yy);
      ctx.fillStyle = f.val >= 25 ? '#ff5a4a' : '#ffd23f';
      ctx.fillText('-' + f.val, f.x, yy);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    });
  }

  function drawBanners() {
    fx.forEach(f => {
      if (f.k !== 'banner') return;
      const p = f.t / f.life;
      const inT = clamp(f.t / 0.22, 0, 1);
      const outA = clamp((1 - p) * 3, 0, 1);
      const sc = 1 + (1 - ease(inT)) * 0.5;
      const fs = clamp(Wc * 0.085, 36, 74) * sc;
      ctx.save();
      ctx.translate(Wc / 2, Hc * 0.34);
      ctx.globalAlpha = outA;
      ctx.textAlign = 'center';
      ctx.font = `900 ${fs}px Orbitron, monospace`;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = Math.max(4, fs * 0.1);
      ctx.strokeText(f.txt, 0, 0);
      const g = ctx.createLinearGradient(0, -fs * 0.6, 0, fs * 0.2);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.55, f.col);
      g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g;
      ctx.fillText(f.txt, 0, 0);
      ctx.restore();
    });
  }

  function drawLavaBits() {
    if (!lavaBits.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,130,40,0.4)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    lavaBits.forEach(lb => { ctx.moveTo(lb.x - lb.vx * 0.035, lb.y - lb.vy * 0.035); ctx.lineTo(lb.x, lb.y); });
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,100,20,0.85)';
    ctx.beginPath();
    lavaBits.forEach(lb => { ctx.moveTo(lb.x + lb.s, lb.y); ctx.arc(lb.x, lb.y, lb.s, 0, Math.PI * 2); });
    ctx.fill();
    ctx.fillStyle = 'rgba(255,225,130,0.9)';
    ctx.beginPath();
    lavaBits.forEach(lb => { ctx.moveTo(lb.x + lb.s * 0.45, lb.y); ctx.arc(lb.x, lb.y, lb.s * 0.45, 0, Math.PI * 2); });
    ctx.fill();
    ctx.restore();
  }

  // part 4
  function drawFx() {
    fx.forEach(f => {
      const p = f.t / f.life;
      if (f.k === 'flash') {
        ctx.globalAlpha = Math.max(0, 1 - p) * 0.95;
        ctx.fillStyle = f.col || '#fff';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + p * 0.5), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        if (f.x > 10 && f.x < Wc - 10 && surfaceAt(f.x) > waterLevel + 4 && f.y < waterLevel + 40) {
          const wy = waterAt(f.x);
          const a = (1 - p) * 0.3;
          ctx.globalAlpha = a;
          ctx.fillStyle = f.col || '#fff';
          const w1 = f.r * 0.9 * (0.7 + 0.3 * Math.sin(gt * 7));
          ctx.fillRect(f.x - w1 / 2, wy, w1, 2);
          ctx.globalAlpha = a * 0.5;
          const w2 = f.r * 0.5 * (0.7 + 0.3 * Math.sin(gt * 6 + 2));
          ctx.fillRect(f.x - w2 / 2, wy + 6, w2, 1.6);
          ctx.globalAlpha = 1;
        }
      } else if (f.k === 'skyflash') {
        ctx.fillStyle = f.col + (f.a * (1 - p) * (1 - p)).toFixed(3) + ')';
        ctx.fillRect(-40, -40, Wc + 80, Hc + 80);
      } else if (f.k === 'ring') {
        const r = f.r0 + (f.r1 - f.r0) * ease(p);
        ctx.strokeStyle = `rgba(${f.col},${(0.55 * (1 - p)).toFixed(3)})`;
        ctx.lineWidth = 2.5 * (1 - p) + 0.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      } else if (f.k === 'ember') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const a = 1 - p;
        const col = p < 0.35 ? '255,210,110' : p < 0.65 ? '255,130,40' : '170,50,20';
        ctx.fillStyle = `rgba(${col},${(a * 0.9).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,220,${(a * 0.5).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.s * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (f.k === 'jet') {
        const a = 1 - p;
        const h = f.h === undefined ? f.hMax * 0.3 : f.h;
        const flick = 1 + Math.sin(gt * 24 + f.x) * 0.15;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.75;
        const g = ctx.createLinearGradient(0, f.y, 0, f.y - h);
        g.addColorStop(0, 'rgba(255,190,80,0.85)');
        g.addColorStop(0.5, 'rgba(255,90,30,0.5)');
        g.addColorStop(1, 'rgba(200,40,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(f.x - f.w * 0.5 * flick, f.y - h, f.w * flick, h);
        ctx.restore();
      } else if (f.k === 'lflow') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        const tr = f.trail || [];
        const n = tr.length;
        for (let s = 1; s < n; s++) {
          const a = s / n;
          ctx.strokeStyle = `rgba(255,${(80 + 120 * a) | 0},18,${(0.2 + 0.5 * a).toFixed(3)})`;
          ctx.lineWidth = 1 + f.s * 1.7 * a;
          ctx.beginPath();
          ctx.moveTo(tr[s - 1].x, tr[s - 1].y);
          ctx.lineTo(tr[s].x, tr[s].y);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.s * 2.4);
        g.addColorStop(0, 'rgba(255,235,150,0.95)');
        g.addColorStop(0.45, 'rgba(255,90,10,0.75)');
        g.addColorStop(1, 'rgba(200,40,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.s * 1.6, f.s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (f.k === 'vsmoke') {
        const a = 1 - p;
        const col = f.steam ? `rgba(215,228,240,${(0.25 * a).toFixed(3)})` : `rgba(28,24,22,${(0.36 * a).toFixed(3)})`;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 1.15, f.r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
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
        if (p < 0.55) {
          ctx.globalAlpha = (1 - p / 0.55) * 0.75;
          ctx.fillStyle = '#fff6dc';
          ctx.beginPath(); ctx.arc(f.x, f.y, r * (0.28 + p * 0.2), 0, Math.PI * 2); ctx.fill();
        }
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
      } else if (f.k === 'wisp') {
        ctx.strokeStyle = `rgba(226,238,244,${(0.18 * (1 - p)).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const sw = Math.sin(gt * 2 + (f.ph || 0)) * 3;
        ctx.moveTo(f.x - 2, f.y);
        ctx.quadraticCurveTo(f.x + sw, f.y - 5, f.x - 1, f.y - 10);
        ctx.quadraticCurveTo(f.x - sw - 2, f.y - 15, f.x + 1, f.y - 20);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (f.k === 'sed') {
        ctx.fillStyle = `rgba(40,46,42,${(0.4 * (1 - p)).toFixed(3)})`;
        ctx.fillRect(f.x, f.y, f.s, f.s);
      } else if (f.k === 'bubble') {
        ctx.strokeStyle = `rgba(200,230,255,${0.55 * (1 - p)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      } else if (f.k === 'drop') {
        ctx.fillStyle = `rgba(178,215,242,${0.8 * (1 - p * 0.4)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, Math.PI * 2); ctx.fill();
      } else if (f.k === 'wcol') {
        const a = 1 - p;
        const hgt = Math.sin(Math.min(1, p * 1.35) * Math.PI) * f.r * 1.6;
        ctx.fillStyle = `rgba(185,218,240,${0.5 * a})`;
        ctx.beginPath();
        ctx.moveTo(f.x - f.r * 0.16, f.y);
        ctx.quadraticCurveTo(f.x - f.r * 0.09, f.y - hgt * 0.55, f.x, f.y - hgt);
        ctx.quadraticCurveTo(f.x + f.r * 0.09, f.y - hgt * 0.55, f.x + f.r * 0.16, f.y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(225,242,252,${0.4 * a})`;
        ctx.beginPath(); ctx.ellipse(f.x, f.y - 2, f.r * 0.3, 4 + p * 3, 0, 0, Math.PI * 2); ctx.fill();
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
      const y = fp.y === undefined ? surfaceAt(fp.x) : fp.y;
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
      if (rm.sunk) return;
      const tilt = rm.style === 'nuke' ? 0.14 : rm.style === 'plasma' ? -0.12 : rm.style === 'sand' ? 0.05 : 0.08;
      drawTurretBody(ctx, rm.x, rm.y, rm.col, { wreck: true, ang: rm.style === 'nuke' ? 12 : 26, tilt, alpha: rm.wreck === 1 ? 0.92 : 0.8, seed: Math.round(rm.x) });
      if (rm.wreck === 1) {
        const fl = 4 + Math.abs(Math.sin(gt * 11)) * 5;
        ctx.fillStyle = 'rgba(255,110,20,0.85)';
        ctx.beginPath(); ctx.moveTo(rm.x - 4, rm.y - 24); ctx.lineTo(rm.x, rm.y - 24 - fl); ctx.lineTo(rm.x + 4, rm.y - 24); ctx.fill();
        ctx.fillStyle = 'rgba(255,200,60,0.9)';
        ctx.beginPath(); ctx.moveTo(rm.x - 2, rm.y - 24); ctx.lineTo(rm.x, rm.y - 24 - fl * 0.6); ctx.lineTo(rm.x + 2, rm.y - 24); ctx.fill();
      }
    });
  }
  function drawSinkers() {
    sinkers.forEach(sk => {
      drawTurretBody(ctx, sk.x, sk.y, sk.col, { wreck: true, ang: 30, tilt: 0.06, alpha: clamp(1 - sk.t / 6, 0.2, 0.9), seed: Math.round(sk.x) });
    });
  }

  function drawShield(t) {
    const cy = t.y - 14, rr = 26;
    const pulse = 0.7 + Math.sin(skyT * 2.4 + t.x) * 0.18;
    const x0 = t.x - rr - 2, x1 = t.x + rr + 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, -60);
    ctx.lineTo(x0, surfaceAt(x0));
    for (let x = x0; x <= x1; x += 4) ctx.lineTo(x, surfaceAt(x));
    ctx.lineTo(x1, surfaceAt(x1));
    ctx.lineTo(x1, -60);
    ctx.closePath();
    ctx.clip();
    const gg = ctx.createRadialGradient(t.x, cy, rr * 0.4, t.x, cy, rr);
    gg.addColorStop(0, hexA(t.col, 0.10 * pulse));
    gg.addColorStop(0.8, hexA(t.col, 0.3 * pulse));
    gg.addColorStop(1, hexA(t.col, 0.02));
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(t.x, cy, rr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hexA(t.col, 0.55 * pulse);
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(t.x, cy, rr * 0.94, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1;
  }

  function drawTanks() {
    tanks.forEach((t, i) => {
      if (t.dead) return;
      const hpF = 1 - t.hp / TANK_HP;
      const submerged = t.y > waterLevel + 2;
      ctx.save();
      if (submerged) ctx.globalAlpha = 0.65;
      drawTurretBody(ctx, t.x, t.y, t.col, {
        dir: i === 0 ? playerDir() : (tanks[1].x < tanks[0].x ? 1 : -1),
        ang: i === 0 ? aim.ang : aiAim,
        hpF, recoil: t.recoil || 0, seed: i * 7 + 3
      });
      ctx.restore();
      if (t.shield > 0) drawShield(t);
      if (t.hp < 50 && t.shield === 0) {
        ctx.globalAlpha = 0.28 + 0.2 * Math.sin(skyT * 3 + t.x);
        ctx.fillStyle = '#555';
        ctx.fillRect(t.x + R(-2, 2), t.y - 28 - Math.sin(skyT * 2) * 3, 3, 3);
        ctx.globalAlpha = 1;
      }
      if (t.hp < 25 && t.shield === 0) {
        const fl = 3 + Math.abs(Math.sin(skyT * 9)) * 3;
        ctx.fillStyle = '#ff6a00';
        ctx.beginPath(); ctx.moveTo(t.x - 3, t.y - 24); ctx.lineTo(t.x, t.y - 24 - fl); ctx.lineTo(t.x + 3, t.y - 24); ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(t.x - 1.5, t.y - 24); ctx.lineTo(t.x, t.y - 24 - fl * 0.6); ctx.lineTo(t.x + 1.5, t.y - 24); ctx.fill();
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
    drawTrail(p);
    ctx.save();
    if (p.inWater) ctx.globalAlpha = 0.6;
    ctx.translate(p.x, p.y);
    ctx.rotate((p.w.type === 'roller' ? p.rot : Math.atan2(p.vy, p.vx)) + (p.digging ? Math.sin(gt * 30) * 0.12 : 0));
    drawProjectileShape(ctx, p.w);
    ctx.restore();
    if (p.digging) {
      const frac = clamp((p.dugLen || 0) / Math.max(1, p.charge), 0, 1);
      const label = `БУР ${Math.round(frac * 100)}%`;
      ctx.font = '700 10px Orbitron, monospace';
      ctx.textAlign = 'center';
      const lx = clamp(p.x, 44, Wc - 44);
      const ly = Math.max(28, surfaceAt(lx) - 16);
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 3;
      ctx.strokeText(label, lx, ly);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(label, lx, ly);
      ctx.textAlign = 'left';
    }
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
        ctx.fillStyle = `rgba(140,190,110,${p.a * 0.3})`;
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
    let hit = null;
    const pts = [];
    for (let i = 0; i < 140; i++) {
      integrate(pos, vel, 0, dt);
      pts.push({ x: pos.x, y: pos.y });
      if (!apex || pos.y < apex.y) apex = { x: pos.x, y: pos.y };
      if (pos.x < 0 || pos.x > Wc || pos.y > Hc) break;
      if (shotBlocked(pos.x, pos.y)) { hit = { x: pos.x, y: pos.y }; break; }
    }
    const halo = isDayT() ? 'rgba(15,30,55,0.8)' : 'rgba(255,255,255,0.85)';
    for (let i = 5; i < pts.length; i += 6) {
      const q = pts[i];
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(gt * 4 - i * 0.22);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(q.x, q.y, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = indColHi();
      ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (hit) {
      ctx.strokeStyle = indColHi();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hit.x - 5, hit.y - 5); ctx.lineTo(hit.x + 5, hit.y + 5);
      ctx.moveTo(hit.x + 5, hit.y - 5); ctx.lineTo(hit.x - 5, hit.y + 5);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(hit.x, hit.y, ARSENAL[cur].r * 0.4, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
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
    if (drag && drag.moved) {
      const cy = t.y - 12;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(t.x, cy); ctx.lineTo(drag.x, drag.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = indColHi();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, cy, 14 + aim.pow * 0.45, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      const label = `${Math.round(aim.ang)}°  ${Math.round(aim.pow)}`;
      ctx.font = '700 12px Orbitron, monospace';
      const tw = ctx.measureText(label).width + 16;
      let lx = drag.x + 14, ly = drag.y - 26;
      if (lx + tw > Wc - 8) lx = drag.x - tw - 14;
      if (ly < 40) ly = drag.y + 16;
      rrectPath(ctx, lx, ly, tw, 22, 6);
      ctx.fillStyle = 'rgba(8,12,20,0.85)';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(label, lx + 8, ly + 15);
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
    const t0 = tanks[0], t1 = tanks[1];
    const shd = (t) => t && t.shield > 0 ? ' <i class="sc-shd"></i>' : '';
    $('.sc-you').innerHTML = `${biomeLabel()}&nbsp;&nbsp;вы <b>${Math.max(0, Math.round(t0 ? t0.hp : 0))}</b>${shd(t0)}`;
    $('.sc-enemy').innerHTML = `враг <b>${Math.max(0, Math.round(t1 ? t1.hp : 0))}</b>${shd(t1)}`;
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
    if (powBar) {
      powBar.classList.toggle('show', touchUI && state === 'aim' && turn === 0 && !helpOpen && !sliderOpen);
      powVal.textContent = Math.round(aim.pow);
      powRange.value = Math.round(aim.pow);
    }
    if (state === 'aim' && turn === 0 && Wc > 420) {
      const tleft = Math.ceil(Math.max(0, turnTimer));
      const warn = turnTimer < 10;
      const blink = warn && Math.sin(gt * (turnTimer < 5 ? 12 : 7) < 0);
      ctx.save();
      ctx.font = `800 ${warn ? 16 : 13}px Orbitron, monospace`;
      ctx.textAlign = 'right';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(`${tleft}s`, Wc - 56, 28);
      ctx.fillStyle = blink ? '#ff2a1a' : warn ? '#ff5a4a' : 'rgba(255,255,255,0.85)';
      ctx.fillText(`${tleft}s`, Wc - 56, 28);
      ctx.restore();
    }
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
      .sc-hud { position: absolute; left: 0; right: 0; top: 0; z-index: 4; display: flex; gap: 8px 20px; align-items: center; padding: 8px 52px 8px 14px; font-family: 'Orbitron', monospace; font-size: 22px; color: var(--text-dim); text-shadow: 0 0 5px #000; pointer-events: none; flex-wrap: wrap; line-height: 1.3; }
      .sc-hud b { color: var(--accent); }
      .sc-hud .sc-lasthit { color: var(--yellow); max-width: 360px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 18px; }
      .sc-hud .sc-aimctl { pointer-events: auto; cursor: pointer; border: 1px solid transparent; border-radius: 6px; padding: 3px 8px; }
      .sc-hud .sc-aimctl:hover { border-color: var(--accent); color: var(--text); }
      .sc-hud .sc-aimctl:hover b { color: var(--yellow); }
      .sc-wpn { pointer-events: auto; cursor: pointer; border: 1px solid var(--border); padding: 3px 10px; border-radius: 6px; color: var(--text); background: rgba(5,7,10,0.7); display: flex; gap: 8px; align-items: center; }
      .sc-wpn:hover { border-color: var(--accent); }
      .sc-wpn .sc-ammo { color: var(--green); } .sc-wpn .sc-ammo.limited { color: var(--yellow); } .sc-wpn .sc-ammo.critical { color: var(--pink); }
      .sc-helpbtn { pointer-events: auto; cursor: pointer; color: var(--text-dim); border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; background: rgba(5,7,10,0.7); }
      .sc-helpbtn:hover { color: var(--accent); border-color: var(--accent); }
      canvas.sc-cv { display: block; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
      .sc-help { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 6; background: var(--panel); border: 1px solid var(--accent); border-radius: 10px; padding: 20px 24px; max-width: 500px; font-size: 12px; line-height: 1.8; color: var(--text); display: none; max-height: 80vh; overflow-y: auto; }
      .sc-help.show { display: block; }
      .sc-help h4 { color: var(--accent); margin-bottom: 10px; } .sc-help h5 { margin: 12px 0 4px; }
      .sc-help td { padding: 2px 8px; } .sc-help td:first-child { color: var(--accent); font-family: monospace; white-space: nowrap; }
      .sc-lives { position: absolute; left: 14px; bottom: 10px; z-index: 4; display: flex; gap: 22px; font-family: 'Orbitron', monospace; font-size: 22px; pointer-events: none; text-shadow: 0 0 5px #000; }
      .sc-lives b { font-weight: 700; }
      .sc-lives .sc-you { color: var(--green); } .sc-lives .sc-enemy { color: var(--pink); }
      .sc-lives .sc-shd { display: inline-block; width: 13px; height: 13px; border: 2px solid #4ac0ff; border-radius: 50%; vertical-align: -1px; opacity: 0.85; margin-left: 5px; }
      .sc-windbar { position: absolute; right: 14px; bottom: 12px; z-index: 4; pointer-events: none; display: flex; align-items: center; gap: 10px; font-family: 'Orbitron', monospace; font-size: 28px; color: var(--text-dim); text-shadow: 0 0 6px #000; }
      .sc-windarrow { font-size: 40px; letter-spacing: -4px; }
      .sc-powbar { position: absolute; left: 50%; transform: translateX(-50%); bottom: 10px; z-index: 5; display: none; align-items: center; gap: 8px; background: rgba(6,10,18,0.78); border: 1px solid var(--border); border-radius: 9px; padding: 5px 10px; font-family: 'Orbitron', monospace; font-size: 10px; color: var(--text-dim); pointer-events: auto; }
      .sc-powbar.show { display: flex; }
      .sc-powbar input { width: clamp(120px, 34vw, 260px); accent-color: var(--accent); cursor: pointer; }
      .sc-powbar b { color: var(--accent); min-width: 26px; text-align: right; font-size: 12px; }
      .sc-pb-btn { width: 36px; height: 36px; border-radius: 7px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text); font-size: 20px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; -webkit-user-select: none; user-select: none; touch-action: manipulation; }
      .sc-pb-btn:active { background: var(--accent); color: var(--bg); }
      @media (max-width: 640px) { .sc-lives { bottom: 72px; } .sc-windbar { bottom: 70px; } }
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
          <span class="sc-aimctl" data-k="ang" title="Открыть ползунок угла">Угол <b class="sc-ang"></b>°</span>
          <span class="sc-aimctl" data-k="pow" title="Открыть ползунок силы">Сила <b class="sc-pow"></b></span>
          <span class="sc-wpn"><span class="sc-wname"></span><span class="sc-ammo"></span></span>
          <span class="sc-helpbtn">?</span>
          <span>Раунд <b class="sc-round"></b></span>
          <span>Побед <b class="sc-wins"></b></span>
          <span>Счёт <b class="sc-score"></b></span>
          <span class="sc-lasthit"></span>
        </div>
        <div class="sc-windbar"><span class="sc-windarrow"></span><span class="sc-windval"></span><span style="font-size:14px">ветер</span></div>
        <div class="sc-wmenu"></div>
        <canvas class="sc-cv"></canvas>
        <div class="sc-lives"><span class="sc-you"></span><span class="sc-enemy"></span></div>
        <div class="sc-powbar"><span>СИЛА</span><button class="sc-pb-btn" data-d="-1">−</button><input type="range" min="5" max="100" step="1"><button class="sc-pb-btn" data-d="1">+</button><b class="sc-pv"></b></div>
        <div class="sc-help">
          <h4>Scorched Earth</h4>
          <table>
            <tr><td>Drag / свайп</td><td>прицел: направление от турели - угол, расстояние - сила (ближе - слабее)</td></tr>
            <tr><td>Клик «Угол» / «Сила»</td><td>ползунок: тянуть ручку; X / клик мимо / Esc - закрыть</td></tr>
            <tr><td>Слайдер снизу (тач)</td><td>точная сила выстрела; кнопки −/+ шаг по 1</td></tr>
            <tr><td>Колесо / ↑↓ / ←→</td><td>сила / угол ствола</td></tr>
            <tr><td>Space / клик / тап</td><td>огонь</td></tr>
            <td>1–9, 0 / W / клик по оружию</td><td>выбор оружия</td></tr>
            <tr><td>Esc / ☢ / клик мимо</td><td>выход (☢ - всё взрывается)</td></tr>
          </table>
          <h5>Правила</h5>
          <div style="color:var(--text-dim);font-size:11px">
            5 раундов, боезапас на всю игру. На ход даётся 60 секунд: на 10, 5 и 1 секунде - звук и мигание,
            по истечении ход пропускается. Обычные ракеты в воде просто тонут.
            Лава вулкана жалит на 1-3 hp за шарик. В песке и снеге поверхность медленно
            ползёт по ветру: барханы и сугробы мигрируют.
          </div>
          <h5>Вулкан</h5>
          <div style="color:var(--text-dim);font-size:11px">
            Под горой - виртуальный конус магмии. Дошедшее до магмы оружие взрывается
            своим эффектом, огневое - с двойной силой; Digger и Plasma сгорают в магме,
            Dirt Ball обрушивает грунт и затыкает жерло на время (потом магма прожигает).
            Из кратеров летит лава и вниз по склонам текут огненные реки.
            Если вулкан добивает победителя - ничья.
          </div>
          <h5>Как читать мир</h5>
          <div style="color:var(--text-dim);font-size:11px">
            День и ночь по кругу. Digger вгрызается в склон и сверлит по расписанию (счётчик БУР % над буром): заряд на 0.42 экрана суммарного бурения, полёт в воздухе бесплатный - долетает до следующей горы и продолжает с остатком. Сквозь туннели пролетают снаряды, вода затекает и колышется, две трубы в стопку - обвал. Редкое оружие бьет в несколько стадий. Движение грунта не убивает - максимум 30 hp за раунд. У туррелей щит. Вода живёт от музыки.
          </div>
          <h5>Оружие</h5>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:11px">
            <div>1 Missile 38hp ∞</div><div>2 Funky Bomb ×3</div>
            <div>3 Death's Head ×2</div><div>4 Nuke ×1</div>
            <div>5 Plasma ×2</div><div>6 Napalm ×2</div>
            <div>7 Roller ×3</div><div>8 Digger ×3 - сверлит</div>
            <div>9 Dirt Ball ×3 - грунт</div><div>0 MIRV ×2</div>
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
    powBar = overlay.querySelector('.sc-powbar');
    powRange = powBar.querySelector('input');
    powVal = powBar.querySelector('.sc-pv');
    touchUI = !!(window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window));
    powBar.addEventListener('pointerdown', (e) => e.stopPropagation());
    powRange.addEventListener('input', () => { aim.pow = clamp(+powRange.value, 5, 100); draw(); });
    overlay.querySelectorAll('.sc-pb-btn').forEach(b => {
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state !== 'aim' || turn !== 0) return;
        aim.pow = clamp(aim.pow + (+b.dataset.d), 5, 100);
        draw();
      });
    });
    const helpEl = overlay.querySelector('.sc-help');
    const wmenu = overlay.querySelector('.sc-wmenu');
    $('.sc-helpbtn').onclick = (e) => { e.stopPropagation(); helpEl.classList.toggle('show'); helpOpen = !helpOpen; };
    helpEl.onclick = (e) => e.stopPropagation();
    $('.sc-again').onclick = (e) => { e.stopPropagation(); $('.sc-over').classList.remove('show'); start(); };
    $('.sc-over-close').onclick = (e) => { e.stopPropagation(); $('.sc-over').classList.remove('show'); close(false); };
    $('.sc-wpn').onclick = (e) => { e.stopPropagation(); renderWeaponMenu(); wmenu.classList.toggle('show'); };
    wmenu.onclick = (e) => e.stopPropagation();
    overlay.querySelectorAll('.sc-aimctl').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state !== 'aim' || turn !== 0 || helpOpen) return;
        sliderOpen = el.dataset.k;
        draw();
      });
    });
    document.addEventListener('click', () => wmenu.classList.remove('show'));

    window.addEventListener('resize', resize);
    cv.addEventListener('pointerdown', (e) => {
      if (helpOpen) { helpEl.classList.remove('show'); helpOpen = false; return; }
      if (wmenu.classList.contains('show')) { wmenu.classList.remove('show'); return; }
      const p = ptrPos(e);
      if (sliderOpen) {
        if (inRect(p, sliderGeom && sliderGeom.close)) { closeSlider(); return; }
        if (inRect(p, sliderGeom && sliderGeom.body) && Math.abs(p.y - sliderGeom.ty) < 26) { sliderDrag = true; applySliderVal(p.x); return; }
        if (inRect(p, sliderGeom && sliderGeom.body)) return;
        closeSlider();
        return;
      }
      if (state !== 'aim' || turn !== 0) return;
      drag = { x: p.x, y: p.y, moved: false };
      try { cv.setPointerCapture(e.pointerId); } catch {}
    });
    cv.addEventListener('pointermove', (e) => {
      const p = ptrPos(e);
      if (sliderDrag) { applySliderVal(p.x); return; }
      if (!drag || state !== 'aim' || turn !== 0) return;
      if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) > 5) drag.moved = true;
      if (drag.moved) { drag.x = p.x; drag.y = p.y; updateAimFromPointer(p); }
    });
    cv.addEventListener('pointerup', () => { if (drag && !drag.moved && state === 'aim' && turn === 0) fire(); drag = null; sliderDrag = false; });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (state !== 'aim' || turn !== 0) return;
      if (sliderOpen) {
        const d = e.deltaY < 0 ? 1 : -1;
        if (sliderOpen === 'ang') aim.ang = clamp(aim.ang + d, 0, 90);
        else aim.pow = clamp(aim.pow + d, 5, 100);
        draw();
        return;
      }
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
    if (e.key === 'Escape') { if (sliderOpen) { closeSlider(); return; } close(false); return; }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const idx = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
      if (idx < ARSENAL.length && (ammoInv[ARSENAL[idx].key] > 0 || ARSENAL[idx].ammo === Infinity) ) { cur = idx; overlay.querySelector('.sc-wmenu').classList.remove('show'); draw(); }
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
    let tapStart = 0, lastTap = 0, holdTimer = null, moved = false;
    const bB = document.getElementById('bgBandit');
    const sBg = () => bB && bB.classList.add('hovered');
    const hBg = () => bB && bB.classList.remove('hovered');
    zone.addEventListener('touchstart', (e) => {
      tapStart = Date.now();
      moved = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(sBg, 120);
      const t = e.touches[0];
      if (t) {
        const sx = t.clientX, sy = t.clientY;
        const move = (ev) => {
          if (ev.touches[0] && (Math.abs(ev.touches[0].clientX - sx) > 12 || Math.abs(ev.touches[0].clientY - sy) > 12)) {
            moved = true;
            clearTimeout(holdTimer);
            hBg();
          }
        };
        zone.addEventListener('touchmove', move, { passive: true });
        setTimeout(() => zone.removeEventListener('touchmove', move), 700);
      }
    }, { passive: true });
    zone.addEventListener('touchend', (e) => {
      const held = Date.now() - tapStart;
      clearTimeout(holdTimer);
      if (moved) { hBg(); return; }
      if (held > 350) {
        setTimeout(hBg, 1500);
        return;
      }
      hBg();
      const now = Date.now();
      if (now - lastTap < 400 && now - lastTap > 40) {
        e.preventDefault();
        open();
        lastTap = 0;
      } else {
        lastTap = now;
      }
    }, { passive: false });
    zone.addEventListener('touchcancel', () => { clearTimeout(holdTimer); hBg(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.Scorch = { open, close };
})();