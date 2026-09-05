// scorch.js — modern Scorched Earth successor; experimental branch of game.js
//scorch.js part01
(() => {
  const LS_KEY = 'scorch_records';
  const LS_PROFILE = 'scorch_profiles';
  const LS_LAST = 'scorch_last';
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
  const DIG_COLLAPSE_H = 34;
  const TURN_TIME = 60;
  // hand-over card duration — the card is driven by turnIntro directly, so
  // it vanishes and the firing lock lifts on the SAME frame
  const TURN_INTRO = 3;
  // water layer display, randomized per round: 1 = lakes in basins,
  // 2 = full-width sea with islands (the sea line sits at the 55th height
  // percentile, so roughly half the screen width stays dry land)
  let WATER_MODE = 1;
  // game mode: 1 = player vs computer, 2 = two players hot-seat
  let GMODE = 1;

  const ARSENAL = [
    { key: 'MISSILE',  name: 'Missile',       r: 30, type: 'missile',  ammo: Infinity, col: '#d8d8d8', dmg: 36, wind: 0.35, shape: 'rocket',   water: 'sink' },
    { key: 'FUNKY',    name: 'Funky Bomb',    r: 40, type: 'funky',    ammo: 3,  col: '#9a8ac8', dmg: 24, wind: 0.3,  shape: 'cluster',  water: 'surface' },
    { key: 'DEATH',    name: "Death's Head",  r: 62, type: 'death',    ammo: 2,  col: '#e8c14a', dmg: 80, wind: 0.15, shape: 'bomb',     water: 'bottom' },
    { key: 'NUKE',     name: 'Nuke',          r: 78, type: 'nuke',     ammo: 1,  col: '#ffd23f', dmg: 105, wind: 0.12, shape: 'bomb',    water: 'surface' },
    { key: 'PLASMA',   name: 'Plasma',        r: 48, type: 'plasma',   ammo: 2,  col: '#d06050', dmg: 50, wind: 0.2,  shape: 'mirv',     water: 'fizzle' },
    { key: 'NAPALM',   name: 'Napalm',        r: 50, type: 'napalm',   ammo: 2,  col: '#d85a18', dmg: 10, wind: 0.55, shape: 'canister', water: 'fizzle' },
    { key: 'ROLLER',   name: 'Roller',        r: 30, type: 'roller',   ammo: 3,  col: '#5aa8a0', dmg: 42, wind: 0.05, shape: 'ball',     water: 'sink' },
    { key: 'DIGGER',   name: 'Digger',        r: 56, type: 'digger',   ammo: 3,  col: '#8a6a3a', dmg: 0,  wind: 0.2,  shape: 'drill',    water: 'sink' },
    { key: 'DIRT',     name: 'Dirt Ball',     r: 70, type: 'dirt',     ammo: 3,  col: '#cbb490', dmg: 0,  wind: 0.3,  shape: 'ball',     water: 'sink' },
    { key: 'MIRV',     name: 'MIRV',          r: 34, type: 'mirv',     ammo: 2,  col: '#c05a4a', dmg: 30, wind: 0.25, shape: 'mirv', subs: 5, water: 'surface' }
  ];
  const TERRAIN_WEAPONS = ['digger', 'dirt'];
  const isTerr = (t) => TERRAIN_WEAPONS.includes(t);

  // earth biomes plus three off-world ones. `pal` recolours sky/sun/clouds/
  // haze/water for the alien worlds; `under` drives the underground strata,
  // the surface signature layer (dec) and the DEEP deposits (dep + twink);
  // `fuel` marks worlds with combustible buried pockets (peat / biomass)
  const BIOMES = {
    green:    { surf: '#5d8a3a', surfHi: '#79a84c', sub: ['#6b4a2c', '#4a3420', '#221507'], mat: { depthF: 1.0, rimF: 0.32, slope: 3.2, drift: 0, dustN: 26, chunkN: 14, dustCol: '150,120,80',  chunks: ['#5a4428', '#3b2c1a', '#6b4a2c'] }, under: { strata: [['#5a4428', 26], ['#3b2c1a', 54]], wobble: 9, dec: 'root', dep: 'dot', twink: '255,214,120', twN: 26 }, fuel: { col: '40,26,14', spark: '255,150,60' } },
    desert:   { surf: '#c9a45e', surfHi: '#e0be74', sub: ['#a87f48', '#7c5a2e', '#3a2a12'], mat: { depthF: 1.35, rimF: 0.5, slope: 2.0, drift: 1, dustN: 46, chunkN: 7,  dustCol: '200,170,110', chunks: ['#a87f48', '#8a6435'] }, under: { strata: [['#a87f48', 24], ['#8a6435', 50], ['#6a4a26', 76]], wobble: 5, dec: 'cross', dep: 'dot', twink: '255,230,160', twN: 22 } },
    arctic:   { surf: '#dfe8ee', surfHi: '#f4f9fc', sub: ['#7d8ea0', '#54627a', '#2c3546'], mat: { depthF: 0.9, rimF: 0.45, slope: 4.5, drift: 1, dustN: 30, chunkN: 10, dustCol: '230,240,250', chunks: ['#9aacbe', '#7d8ea0'] }, under: { strata: [['#9aacbe', 28], ['#7d8ea0', 58]], wobble: 12, dec: 'lens', dep: 'shard', twink: '190,230,255', twN: 30 } },
    volcanic: { surf: '#4a4442', surfHi: '#5c5654', sub: ['#3a3432', '#2a2523', '#151210'], mat: { depthF: 0.6, rimF: 0.5, slope: 8.0, drift: 0, dustN: 16, chunkN: 26, dustCol: '110,100,95',  chunks: ['#2a2523', '#44403e', '#5c3a1e'] }, under: { strata: [['#2a2523', 22], ['#44403e', 46]], wobble: 4, dec: 'magma', dep: 'crack', twink: '255,120,40', twN: 26 } },
    xeno:     { surf: '#7a4a9c', surfHi: '#a06ad0', sub: ['#4a2a5e', '#331a44', '#150a1c'], mat: { depthF: 1.05, rimF: 0.4, slope: 3.6, drift: 0, dustN: 30, chunkN: 12, dustCol: '170,120,220', chunks: ['#5a3a78', '#3a2050'], partCol: '150,120,220' }, sky: { twin: '#6ad0ff' }, pal: { day: ['#3f7d8c', '#6fb8b4', '#b2e2d4'], sun: '#fff2cc', sunHalo: 'rgba(255,240,200,0.35)', cloud: '#5a8a8a', haze: 'rgba(180,225,215,0.25)', water: { top: '#5cb8ac', deep: '#0a3230' } }, under: { strata: [['#5a3a78', 26], ['#3a2050', 54]], wobble: 8, dec: 'spore', dep: 'vein', twink: '110,225,255', twN: 34 }, fuel: { col: '30,16,48', spark: '110,225,255' } },
    rust:     { surf: '#b06040', surfHi: '#d88a58', sub: ['#8a4530', '#5e2c1e', '#2a120a'], mat: { depthF: 1.3, rimF: 0.5, slope: 2.2, drift: 1, dustN: 40, chunkN: 8,  dustCol: '220,140,90',  chunks: ['#8a4530', '#6a3020'] }, sky: { giant: { col: '#d0b8a0', ring: 'rgba(235,205,165,0.55)' } }, pal: { day: ['#a8743c', '#cf9a5e', '#ead0a0'], sun: '#fff4dc', sunHalo: 'rgba(255,220,170,0.35)', cloud: '#8a6a4a', haze: 'rgba(225,190,140,0.3)', water: { top: '#7da892', deep: '#1a3428' } }, under: { strata: [['#8a4530', 25], ['#6a3020', 52]], wobble: 6, dec: 'grit', dep: 'dot', twink: '255,215,150', twN: 26 } },
    ashen:    { surf: '#6a6a72', surfHi: '#8c8c96', sub: ['#4c4c54', '#33333a', '#141418'], mat: { depthF: 0.85, rimF: 0.45, slope: 5.0, drift: 0, dustN: 22, chunkN: 16, dustCol: '120,120,130', chunks: ['#55555e', '#3a3a42'] }, sky: { giant: { col: '#9c86b8', ring: 'rgba(205,185,255,0.45)' } }, pal: { day: ['#78748e', '#a09cb4', '#d4d2e0'], sun: '#f4f2ec', sunHalo: 'rgba(240,240,235,0.3)', cloud: '#5c5c70', haze: 'rgba(190,190,205,0.28)', water: { top: '#6f7f88', deep: '#101e28' } }, under: { strata: [['#55555e', 24], ['#3a3a42', 50]], wobble: 7, dec: 'ember', dep: 'dot', twink: '170,190,255', twN: 20 } }
  };
  const BIOME_POOL = ['green', 'green', 'desert', 'desert', 'arctic', 'arctic', 'volcanic', 'xeno', 'rust', 'ashen'];
  const TOD = {
    day:    { stops: ['#7ab3d8', '#a8cde6', '#d8e8f0'], sun: '#fff6d8', sunHalo: 'rgba(255,246,216,0.35)', stars: false, clouds: 0.55, haze: 'rgba(220,235,245,0.25)' },
    // dusk and dawn each get their OWN palette: sunset burns orange-purple,
    // dawn glows rose-gold. The dawn phase is scheduled where the sun
    // actually rises (p 0.96–1.0 + early wrap), so the sky ignites together
    // with the luminary instead of staying plain day
    sunset: { stops: ['#2a2a55', '#7a4a78', '#d88a4a', '#f0b060'], sun: '#ffd9a0', sunHalo: 'rgba(255,150,80,0.4)', stars: 'dim', clouds: 0.4, haze: 'rgba(240,170,110,0.3)' },
    dawn:   { stops: ['#10102e', '#2e2450', '#8e4a62', '#f2a06a'], sun: '#ffd0a0', sunHalo: 'rgba(255,170,120,0.4)', stars: 'dim', clouds: 0.4, haze: 'rgba(235,180,150,0.28)' },
    night:  { stops: ['#060a18', '#0c1526', '#1a2a44'], sun: '#e8ecf2', sunHalo: 'rgba(200,215,235,0.2)', stars: true, clouds: 0.12, haze: 'rgba(40,60,100,0.25)' }
  };
  const TOD_KEYS = [
    { p: 0.00, k: 'dawn' }, { p: 0.07, k: 'day' }, { p: 0.36, k: 'day' }, { p: 0.46, k: 'sunset' },
    { p: 0.55, k: 'night' }, { p: 0.90, k: 'night' }, { p: 0.965, k: 'dawn' }, { p: 1.00, k: 'dawn' }
  ];
  const BANNERS = {
    win: [
      'FATALITY!', '{N} ПОБЕЖДАЕТ!', 'FLAWLESS VICTORY!', 'ПОБЕДА!', '{N} — ЧЕМПИОН!',
      '{N} РАЗНОСИТ ВСЁ', 'ANNIHILATION', '{N} — WINNER', 'TOTAL VICTORY', '{N} СЛИВАЕТ СОПЕРНИКА',
      'МИССИЯ ВЫПОЛНЕНА — {N}', 'ПОБЕДА БЕЗ ШАНСОВ', 'HUMILIATION', '{N} — ЛЕГЕНДА АРЕНЫ', '{N} WINNER WINNER',
      '{N} ЛОВИТ ПОБЕДУ', 'GAME WON', 'VICTORY IS {N}\'S', 'МИССИЯ ПРОЙДЕНА — {N}', 'ПОБЕДА!'
    ],
    lose: [
      'ПОТРАЧЕНО, {N}!', '{N} WASTED', 'YOU DIED, {N}', 'GAME OVER ДЛЯ {N}', 'DEFEAT',
      '{N} ПРОИГРЫВАЕТ', 'MISSION FAILED: {N}', '{N} BUSTED', '{N} ВЫБЫВАЕТ', 'FRAGGED',
      '{N} РАЗОБРАН НА ЗАПЧАСТИ', 'GAME LOST', '{N} УСТРАИВАЕТ СЕБЕ ОТДЫХ', '{N} BUSTED AGAIN', 'TRY AGAIN',
      '{N} — ЭТО БЫЛО БОЛЬНО', 'TOTAL DEFEAT', '{N} ПРОСИТ РЕВАНШ', 'DEFEATED', 'ПОРАЖЕНИЕ!'
    ],
    draw: [
      'DRAW!', "IT'S A DRAW!", 'НИЧЬЯ!', 'DEAD HEAT', 'ОБА В АУТЕ',
      'НИКТО НЕ ПОБЕДИЛ', 'ОБА ПРОИГРАЛИ', 'БЕЗ ПОБЕДИТЕЛЯ', 'РАВНЫЙ БОЙ', 'ДВЕ ЛОЖКИ ДЁГТЯ',
      'NO WINNER', 'NO CONTEST', 'ВЗАИМНОЕ УНИЧТОЖЕНИЕ', 'STALEMATE!', 'НИЧЬЯ',
      'ОТЛИЧНЫЙ ВЫСТРЕЛ — ПЛОХОЙ ИСХОД', 'EVEN MATCH', 'ВТОРАЯ КРУГЛАЯ?', 'РАВНЫЙ БОЙ', 'ВСЕ ПРОИГРАЛИ'
    ]
  };
  const BANNER_COL = { win: '#ffd23f', lose: '#ff4a3a', draw: '#ff9a3a' };

  // cosmetic turret variants: strong silhouettes, equal iron mass, the same
  // 26px shield circle — looks only, zero combat difference. 8 hulls fill
  // both rows of the setup matrix
  const HULLS = [
    { key: 'classic', name: 'Классика' },
    { key: 'double',  name: 'Двустволка' },
    { key: 'heavy',   name: 'Тяжёлый' },
    { key: 'stealth', name: 'Стелс' },
    { key: 'retro',   name: 'Ретро' },
    { key: 'rail',    name: 'Рельсотрон' },
    { key: 'howitzer', name: 'Гаубица' },
    { key: 'bunker',  name: 'Бункер' }
  ];
  const HULL_COLORS = ['#2ecc71', '#ff4757', '#3498db', '#ffd23f', '#9b59b6', '#e67e22', '#1abc9c', '#ff6ab8'];

  let overlay, cv, ctx, Wc, Hc;
  let cols, waterLevel, biome, seed, S, noise, archetype, moonBite, moonBiteR;
  let volcano = null;
  let lavaBits = [];
  let cloudCount = 8;
  let groundPat = null;
  let tod = { stops: ['#7ab3d8', '#a8cde6', '#d8e8f0'], sun: '#fff6d8', sunHalo: 'rgba(255,246,216,0.35)', stars: false, clouds: 0.55, haze: 'rgba(220,235,245,0.25)' };
  let cycleT = 0, dayness = 1, todT = 0;
  let tanks, wind, windDir, aiSkill;
  let ammoInv = {}, aiAmmo = {}, cur = 0, cur2 = 0, turn, state, turnOrder = 0;
  let shot = null, subshots = [], liquids = [], debris = [], remains = [], sinkers = [], windParts = [], comets = [], grains = [], wreckBits = [];
  let fx = [];
  let firePatches = [];
  let terraJobs = [];
  let events = [];
  let stars = [];
  // the ONE live sky light (sun by day / moon at night): x, 'r,g,b' colour
  // and intensity — set ONLY while the luminary is actually on screen;
  // water glints bind to it strictly
  let skyLight = { x: -999, col: '255,255,255', a: 0 };
  let digSid = 0;
  let dirtyA = 0, dirtyB = 0;
  let raf = null, last = 0, gt = 0, skyT = 0, cloudOff = 0;
  let aim = { ang: 45, pow: 55 }, aiAim = 55;
  // per-seat aim state — restored on every hand-over, so each fighter
  // keeps their own angle/power while the turn card counts down
  let seatAim = [{ ang: 45, pow: 55 }, { ang: 45, pow: 55 }];
  let score = 0, shots = 0, roundStart = 0, round = 1;
  let wins = 0;
  let wins2 = 0, score2 = 0;
  let drag = null, killed = null, helpOpen = false, lastHitInfo = null;
  let sliderOpen = null, sliderDrag = false, sliderGeom = null;
  let moonCv = null, moonCtx = null, giantCv = null, giantCtx = null, giantKey = '';
  let shake = 0;
  let touchUI = false, powBar = null, powRange = null, powVal = null, hudRefs = null, apEl = null, apBuf = null;
  let lastKillMethod = 'weapon', lastShotApex = 0, lastWeapon = 'MISSILE';
  let turnTimer = 0, warnedAt = {};
  // whose shot is in the air — the round digit wears that fighter's colour
  let shotOwner = 0;
  // hand-over card payload; drawn straight from turnIntro, not from fx —
  // fx advance at 1.6x speed which used to desync card fade vs fire lock
  let turnCard = null;
  let driftT = 0;
  let AC = null;
  // combustible deposits (peat / xeno biomass): ignite, burn out, cave in
  let pockets = [];
  // player identities for both modes; index 0 = left seat, 1 = right seat
  // { name, col, hull } — for GMODE 1 the right seat is the computer
  let players = [
    { name: 'Player1', col: '#2ecc71', hull: 'classic', ai: false },
    { name: 'GLM',     col: '#ff4757', hull: 'classic', ai: true }
  ];
  let confirmClose = false;
  let turnIntro = 0;
  let setupOpen = false, confirmOpen = false;
  // first shooter of round 1 is random; rounds 2-5 alternate
  let firstShooter = Math.random() < 0.5 ? 0 : 1;

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
  const biomeLabel = () => ({ green: 'Холмы', desert: 'Пустыня', arctic: 'Арктика', volcanic: 'Вулкан', xeno: 'Ксено', rust: 'Ржавые дюны', ashen: 'Пепел' }[biomeKey()] || '');
  const windKind = () => ({ green: 'leaf', desert: 'sand', arctic: 'snow', volcanic: 'ash', xeno: 'dust', rust: 'sand', ashen: 'ash' }[biomeKey()] || 'dust');
  // hot-seat plumbing: whose seat is human, which tank aims now, and the
  // active seat's firing direction (toward the foe)
  const isHumanSeat = (i) => i === 0 || (GMODE === 2 && i === 1);
  const activeTank = () => tanks[turn] || tanks[0];
  const activeDir = () => { const me = activeTank(); const foe = tanks[turn === 0 ? 1 : 0]; return foe.x > me.x ? 1 : -1; };
  const modalOpen = () => helpOpen || setupOpen || confirmOpen || !!sliderOpen;
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  // whose colour the round digit wears: the aiming seat, or the shooter
  // while their shot is still resolving
  const hudSeat = () => (state === 'aim' ? (turn === 0 ? 0 : 1) : shotOwner);
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
    const val = (k) => k === 'day' ? 1 : (k === 'sunset' || k === 'dawn') ? 0.5 : 0;
    dayness = val(a.k) + (val(b.k) - val(a.k)) * f;
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
    const t = activeTank(), dir = activeDir();
    const dx = p.x - t.x, dy = (t.y - 14) - p.y;
    const dist = Math.hypot(dx, dy);
    const ax = Math.abs(dx) < 4 ? 4 : dx * dir;
    aim.ang = clamp(Math.round(Math.atan2(Math.max(dy, 2), ax) * 180 / Math.PI), 0, 88);
    const reach = Math.min(Wc * 0.42, 300);
    aim.pow = clamp(Math.round(5 + 95 * (dist - 26) / reach), 5, 100);
  }
  function applySliderVal(px) {
    const g = sliderGeom;
    if (!g) return;
    const v = Math.round(g.min + clamp((px - g.tx0) / (g.tx1 - g.tx0), 0, 1) * (g.max - g.min));
    if (sliderOpen === 'ang') aim.ang = clamp(v, 0, 90);
    else aim.pow = clamp(v, 5, 100);
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
        const sz = 2.4 + age * 6;
        ctx.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz);
        if (age < 0.2) {
          ctx.globalAlpha = k * 0.9;
          ctx.fillStyle = '#fff2dd';
          ctx.fillRect(q.x - 1.1, q.y - 1.1, 2.2, 2.2);
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
    if (!sliderOpen || state !== 'aim') return;
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

  // ============ TURRET BODIES: eight silhouettes, equal iron ============
  // classic — the default; double — twin tubes; heavy — wide skirts, fat
  // barrel, chunky brake; stealth — chamfered wedge, long thin needle;
  // retro — riveted box, cylindrical cap, oversized muzzle brake;
  // rail — low sleigh with two long parallel rails; howitzer — tall
  // blockhouse, stub barrel under a huge boxy brake; bunker — extra-wide
  // raft with a sloped cap and a stub gun
  function drawTurretBody(c, x, y, col, o) {
    o = o || {};
    const dir = o.dir || 1;
    const ang = o.ang === undefined ? 45 : o.ang;
    const hpF = clamp(o.hpF || 0, 0, 1);
    const wreck = !!o.wreck;
    const rec = clamp(o.recoil || 0, 0, 1);
    const tilt = o.tilt || 0;
    const sd = o.seed || 0;
    const hull = o.hull || 'classic';
    c.save();
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    c.translate(Math.round(x), Math.round(y));
    if (tilt) c.rotate(tilt);
    const base = wreck ? '#2a251d' : mixColor(col, '#241a10', hpF * 0.7);
    const P = (dx, dy, w, h, colr) => { c.fillStyle = colr; c.fillRect(Math.round(dx), Math.round(dy), w, h); };
    if (!o.noShadow) {
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(0, 1, 13, 3.2, 0, 0, Math.PI * 2); c.fill();
    }
    // tracks — shared
    P(-12, -5, 24, 5, shade(base, 0.5));
    P(-12, -5, 24, 1, shade(base, 0.78));
    [-9, 0, 9].forEach(bx => P(bx, -3, 1, 1, shade(base, 0.35)));

    // superstructure
    if (hull === 'stealth') {
      c.fillStyle = base;
      c.beginPath();
      c.moveTo(-10, -5); c.lineTo(-8, -13); c.lineTo(-3, -16);
      c.lineTo(3, -16); c.lineTo(8, -13); c.lineTo(10, -5);
      c.closePath(); c.fill();
      c.fillStyle = shade(base, 1.25);
      c.beginPath(); c.moveTo(-8, -13); c.lineTo(-3, -16); c.lineTo(3, -16); c.lineTo(8, -13); c.closePath(); c.fill();
      c.strokeStyle = shade(base, 0.55); c.lineWidth = 1;
      c.beginPath(); c.moveTo(-6, -12); c.lineTo(6, -12); c.stroke();
      c.fillStyle = shade(base, 0.7);
      c.fillRect(-7, -11, 2, 5);
      c.fillRect(5, -11, 2, 5);
    } else if (hull === 'heavy') {
      P(-11, -12, 22, 7, base);
      P(-11, -12, 22, 1, shade(base, 1.3));
      P(-11, -6, 22, 1, shade(base, 0.5));
      P(-11, -10, 3, 8, shade(base, 0.72));
      P(8, -10, 3, 8, shade(base, 0.72));
      P(-6, -11, 3, 2, shade(base, 0.6));
      P(3, -11, 3, 2, shade(base, 0.6));
    } else if (hull === 'retro') {
      P(-9, -14, 18, 9, base);
      P(-9, -14, 18, 1, shade(base, 1.3));
      P(-9, -6, 18, 1, shade(base, 0.5));
      c.fillStyle = shade(base, 1.5);
      [-7, -4, 2, 5].forEach(rx => { c.fillRect(rx, -13, 1, 1); c.fillRect(rx, -8, 1, 1); });
    } else if (hull === 'rail') {
      P(-11, -9, 22, 4, base);
      P(-11, -9, 22, 1, shade(base, 1.3));
      P(-11, -6, 22, 1, shade(base, 0.5));
      P(-10, -12, 5, 3, shade(base, 0.72));
      P(5, -12, 5, 3, shade(base, 0.72));
    } else if (hull === 'howitzer') {
      P(-8, -16, 16, 11, base);
      P(-8, -16, 16, 1, shade(base, 1.3));
      P(-8, -6, 16, 1, shade(base, 0.5));
      P(-8, -14, 2, 8, shade(base, 0.72));
      P(6, -14, 2, 8, shade(base, 0.72));
    } else if (hull === 'bunker') {
      P(-12, -8, 24, 3, base);
      P(-12, -8, 24, 1, shade(base, 1.3));
      P(-12, -6, 24, 1, shade(base, 0.5));
      P(-7, -13, 14, 5, base);
      P(-7, -13, 14, 1, shade(base, 1.25));
    } else {
      P(-9, -13, 18, 8, base);
      P(-9, -13, 18, 1, shade(base, 1.3));
      P(-9, -6, 18, 1, shade(base, 0.5));
      c.fillStyle = shade(base, 0.55);
      c.fillRect(-3, -12, 1, 6);
      c.fillRect(4, -12, 1, 6);
    }

    // turret / dome
    if (hull === 'stealth') {
      c.fillStyle = base;
      c.beginPath(); c.moveTo(-6, -13); c.lineTo(0, -19); c.lineTo(6, -13); c.closePath(); c.fill();
      c.fillStyle = shade(base, 1.2);
      c.beginPath(); c.moveTo(-2, -13); c.lineTo(0, -18); c.lineTo(2, -13); c.closePath(); c.fill();
    } else if (hull === 'heavy') {
      c.fillStyle = base;
      c.beginPath(); c.ellipse(0, -12, 9.5, 7, 0, Math.PI, 0); c.lineTo(9.5, -12); c.closePath(); c.fill();
      c.fillStyle = shade(base, 1.15);
      c.beginPath(); c.ellipse(0, -12, 9.5, 7, 0, Math.PI, Math.PI * 1.4); c.closePath(); c.fill();
      c.strokeStyle = shade(base, 0.6); c.lineWidth = 1;
      c.beginPath(); c.moveTo(-9, -12); c.lineTo(9, -12); c.stroke();
    } else if (hull === 'retro') {
      P(-6, -20, 12, 6, base);
      c.fillStyle = base;
      c.beginPath(); c.arc(0, -20, 6, Math.PI, 0); c.closePath(); c.fill();
      c.strokeStyle = shade(base, 0.6); c.lineWidth = 1;
      c.beginPath(); c.moveTo(-6, -17); c.lineTo(6, -17); c.stroke();
    } else if (hull === 'rail') {
      c.fillStyle = base;
      c.beginPath(); c.ellipse(0, -12, 9, 4.5, 0, Math.PI, 0); c.lineTo(9, -12); c.closePath(); c.fill();
      c.fillStyle = shade(base, 1.2);
      c.beginPath(); c.ellipse(0, -12, 9, 4.5, 0, Math.PI, Math.PI * 1.4); c.closePath(); c.fill();
      c.strokeStyle = shade(base, 0.6); c.lineWidth = 1;
      c.beginPath(); c.moveTo(-8, -12); c.lineTo(8, -12); c.stroke();
    } else if (hull === 'howitzer') {
      c.fillStyle = base;
      c.beginPath(); c.arc(0, -16, 6.5, Math.PI, 0); c.lineTo(6.5, -13); c.lineTo(-6.5, -13); c.closePath(); c.fill();
      c.fillStyle = shade(base, 1.15);
      c.beginPath(); c.arc(0, -16, 6.5, Math.PI, Math.PI * 1.35); c.closePath(); c.fill();
      c.strokeStyle = shade(base, 0.6); c.lineWidth = 1;
      c.beginPath(); c.moveTo(-5, -14); c.lineTo(5, -14); c.stroke();
    } else if (hull === 'bunker') {
      c.fillStyle = shade(base, 1.12);
      c.beginPath(); c.moveTo(-7, -13); c.lineTo(-4, -16.5); c.lineTo(4, -16.5); c.lineTo(7, -13); c.closePath(); c.fill();
      c.strokeStyle = shade(base, 0.6); c.lineWidth = 1;
      c.beginPath(); c.moveTo(-5, -14.5); c.lineTo(5, -14.5); c.stroke();
    } else {
      c.beginPath();
      c.arc(0, -14, hull === 'double' ? 7 : 8, Math.PI, 0);
      c.lineTo(8, -12); c.lineTo(-8, -12); c.closePath();
      c.fillStyle = base;
      c.fill();
      c.save();
      c.clip();
      P(-8, -22, 5, 10, 'rgba(255,255,255,0.14)');
      P(4, -22, 4, 10, 'rgba(0,0,0,0.25)');
      if (hull === 'double') { P(-4, -18, 3, 5, shade(base, 0.7)); P(2, -18, 3, 5, shade(base, 0.7)); }
      else { [-5, 0, 5].forEach(rx => P(rx, -19, 1, 1, shade(base, 0.4))); }
      c.restore();
    }

    // periscope + lamp — shared, hull-specific heights
    const topY = hull === 'stealth' ? -19 : hull === 'heavy' ? -18 : hull === 'retro' ? -25 : hull === 'howitzer' ? -23 : (hull === 'rail' || hull === 'bunker') ? -17 : -24;
    P(-3, topY, 6, 3, shade(base, 0.95));
    P(-3, topY, 6, 1, shade(base, 1.25));
    P(-1, topY - 2, 3, 2, '#4d545c');
    if (!wreck) {
      const glow = clamp((1 - dayness) * 0.9, 0, 0.9);
      if (glow > 0.1) { c.fillStyle = `rgba(255,214,120,${glow.toFixed(3)})`; c.fillRect(0, topY - 2, 1, 1); }
    }

    // barrel
    const pivY = hull === 'stealth' ? -13 : hull === 'heavy' ? -12 : hull === 'retro' ? -18 : hull === 'howitzer' ? -15 : (hull === 'rail' || hull === 'bunker') ? -13 : -14;
    c.save();
    c.translate(0, pivY);
    c.rotate((dir === 1 ? -ang : ang - 180) * Math.PI / 180 + (wreck ? 0.35 : 0));
    c.translate(-rec * 5, 0);
    const bl = wreck ? 12 : (hull === 'heavy' ? 15 : hull === 'stealth' ? 23 : hull === 'retro' ? 16 : hull === 'rail' ? 26 : hull === 'howitzer' ? 14 : hull === 'bunker' ? 15 : 20);
    if (hull === 'double' && !wreck) {
      P(4, -4, bl - 8, 3, '#5a6168'); P(4, 1, bl - 8, 3, '#5a6168');
      P(4, -4, bl - 8, 1, '#7d858d'); P(4, 1, bl - 8, 1, '#7d858d');
      P(bl - 2, -4, 2, 3, '#454c53'); P(bl - 2, 1, 2, 3, '#454c53');
    } else if (hull === 'heavy') {
      P(3, -3.5, bl - 5, 7, '#5a6168');
      P(3, -3.5, bl - 5, 1.5, '#7d858d');
      P(5, -4.5, 2, 9, '#454c53');
      P(bl - 3, -4.5, 3, 9, '#3d444b');
    } else if (hull === 'stealth') {
      P(4, -1.5, bl - 5, 3, '#454c53');
      P(4, -1.5, bl - 5, 1, '#6d757e');
      P(bl - 2, -2, 2, 4, '#33383d');
    } else if (hull === 'retro') {
      P(3, -2.5, bl - 6, 5, '#5a6168');
      P(3, -2.5, bl - 6, 1, '#7d858d');
      P(5, -3.5, 2, 7, '#454c53');
      P(9, -3.5, 2, 7, '#454c53');
      P(bl - 4, -4, 4, 8, '#495057');
    } else if (hull === 'rail') {
      P(3, -2.4, bl - 5, 1.6, '#5a6168');
      P(3, 0.8, bl - 5, 1.6, '#5a6168');
      P(3, -2.4, bl - 5, 0.7, '#7d858d');
      P(3, 0.8, bl - 5, 0.7, '#7d858d');
      P(5, -3, 1.6, 6, '#454c53');
      P(bl - 5, -3, 1.6, 6, '#454c53');
      P(bl - 2, -3.2, 2, 6.4, '#3d444b');
    } else if (hull === 'howitzer') {
      P(2, -3, bl - 5, 6, '#5a6168');
      P(2, -3, bl - 5, 1.5, '#7d858d');
      P(4, -4, 2, 8, '#454c53');
      P(bl - 4, -5, 4, 10, '#3d444b');
    } else if (hull === 'bunker') {
      P(2, -2.5, bl - 4, 5, '#5a6168');
      P(2, -2.5, bl - 4, 1, '#7d858d');
      P(bl - 3, -3.5, 3, 7, '#3d444b');
    } else {
      P(0, -3, 5, 6, '#495057');
      P(0, -3, 5, 1, '#6d757e');
      P(5, -2, bl - 8, 4, '#5a6168');
      P(5, -2, bl - 8, 1, '#7d858d');
      P(8, -3, 2, 6, '#454c53');
      P(13, -3, 2, 6, '#454c53');
      P(bl - 3, -3, 3, 6, '#3d444b');
    }
    if (!wreck) {
      c.fillStyle = '#20252b';
      c.fillRect(bl - 2, -2, 1, 1);
      c.fillRect(bl - 2, 1, 1, 1);
    }
    c.restore();

    // antenna
    if (!wreck) {
      const swy = Math.sin(gt * 2.2 + sd) * clamp(Math.abs(wind) * 0.4, 0, 2);
      c.strokeStyle = hull === 'stealth' ? '#2a3238' : '#3f474e';
      c.lineWidth = 1;
      const aTop = hull === 'retro' ? -26 : topY - 1;
      c.beginPath();
      c.moveTo(-6, hull === 'stealth' ? -14 : -13);
      c.quadraticCurveTo(-6.5, -19, -6 + swy, aTop);
      c.stroke();
      c.fillStyle = hull === 'stealth' ? '#1f262c' : '#8d96a0';
      c.fillRect(Math.round(-6 + swy), aTop - 1, 1, 1);
    } else {
      c.strokeStyle = '#33383d';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-6, -13); c.lineTo(-7, -17); c.stroke();
    }

    // damage decals
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

  // scaled turret icon for menus / records / gallery
  function drawMiniTurret(c2, size, col, hull) {
    c2.clearRect(0, 0, size, size);
    c2.save();
    c2.translate(size / 2, size * 0.76);
    const s = size / 38;
    c2.scale(s, s);
    drawTurretBody(c2, 0, 0, col, { noShadow: true, hull, seed: 5, dir: 1, ang: 25 });
    c2.restore();
  }

//scorch.js part02
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
  function saveRec(pl, pts, wn) {
    // zero results (no wins or no points) never enter the table
    if ((pts | 0) <= 0 || (wn | 0) <= 0) return;
    try {
      const recs = records();
      recs.push({ score: pts, wins: wn, rounds: round, date: new Date().toLocaleString('ru-RU'), pname: pl.name, pcol: pl.col, phull: pl.hull });
      recs.sort((a, b) => b.score - a.score);
      localStorage.setItem(LS_KEY, JSON.stringify(recs.slice(0, MAX_REC)));
    } catch (e) {}
  }
  function profiles() { try { return JSON.parse(localStorage.getItem(LS_PROFILE)) || []; } catch { return []; } }
  function saveProfiles(p) {
    try { localStorage.setItem(LS_PROFILE, JSON.stringify(p.slice(0, 20))); } catch (e) {}
  }
  // last-used fighters per game mode: { mode, 1: {p0,p1}, 2: {p0,p1} } —
  // restored on open and when switching modes in setup, so the computer's
  // look never leaks from PvP player 2
  function lastCfg() { try { return JSON.parse(localStorage.getItem(LS_LAST)) || {}; } catch { return {}; } }
  function saveLastCfg(mode, p0, p1) {
    try {
      const c = lastCfg();
      c.mode = mode;
      c[mode] = { p0: { name: p0.name, col: p0.col, hull: p0.hull }, p1: { name: p1.name, col: p1.col, hull: p1.hull } };
      localStorage.setItem(LS_LAST, JSON.stringify(c));
    } catch (e) {}
  }
  function applyLastPlayers() {
    const c = lastCfg()[GMODE];
    if (!c) return;
    players[0] = { name: (c.p0 && c.p0.name) || 'Player1', col: (c.p0 && c.p0.col) || '#2ecc71', hull: (c.p0 && c.p0.hull) || 'classic', ai: false };
    players[1] = GMODE === 1
      ? { name: 'GLM', col: (c.p1 && c.p1.col) || '#ff4757', hull: (c.p1 && c.p1.hull) || 'classic', ai: true }
      : { name: (c.p1 && c.p1.name) || 'Player2', col: (c.p1 && c.p1.col) || '#3498db', hull: (c.p1 && c.p1.hull) || 'classic', ai: false };
  }
  function schedule(fn, delay) { events.push({ at: gt + delay, fn }); }

  function open() {
    build();
    ensureAudio();
    // restore the last session: mode + both fighters' looks
    const lc = lastCfg();
    if (lc.mode === 1 || lc.mode === 2) GMODE = lc.mode;
    applyLastPlayers();
    overlay.classList.add('show');
    setTimeout(() => { resize(); start(); }, 60);
  }
  function close(boom) { if (boom) apocalypsis(); else { stop(); overlay.classList.remove('show'); } }
  function apocalypsis() {
    if (state === 'closing') return;
    stop();
    state = 'closing';
    shot = null; subshots = []; liquids = []; events = []; firePatches = [];
    tanks.forEach((t, i) => {
      boomsAt(t.x, t.y - 10, 60, 'nuke', 0);
      t.dead = true; killed = i;
      remains.push({ x: t.x, y: t.y, col: t.col, hull: t.hull, style: 'nuke', falling: true, sunk: false, wreck: 1 });
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
        // bioluminescent freckles in the crystal veins
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
      // little impact craters in the cinder
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let i = 0; i < 34; i++) {
        const r = R(2, 6);
        g.beginPath(); g.arc(R(4, T - 4), R(4, T - 4), r, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(140,140,150,0.25)';
        g.beginPath(); g.arc(R(4, T - 4), R(4, T - 4), r * 0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.3)';
      }
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
    WATER_MODE = Math.random() < 0.5 ? 1 : 2;
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

    if (WATER_MODE === 2) {
      // full-width sea at the 55th height percentile: about half of the
      // columns stay above the waterline as dry land
      const tops = [];
      for (let i = 4; i < N - 4; i++) tops.push(cols[i].top);
      tops.sort((a, b) => a - b);
      waterLevel = tops[Math.floor(tops.length * 0.55)] + R(0, 8);
    } else if (archetype === 'island') {
      waterLevel = Hc * 0.55;
    } else {
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

    // combustible deposits: 1-2 buried pockets on fuel worlds, dry ground
    // only, clear of the volcano — find them by blasting or digging.
    // `bl` is the cloud blob set (fractions of the pocket box) — the deposit
    // is drawn as an irregular rounded cloud, not a rectangle
    pockets = [];
    if (biome.fuel) {
      const npk = 1 + (S() < 0.6 ? 1 : 0);
      for (let k = 0; k < npk; k++) {
        for (let a = 0; a < 8; a++) {
          const cx = R(Wc * 0.12, Wc * 0.88);
          if (volcano && Math.abs(cx - volcano.x) < volcano.r + 40) continue;
          const cy0 = surfaceAt(cx);
          if (cy0 > waterLevel - 30) continue;
          const w = R(28, 64);
          const y0 = cy0 + R(8, 24);
          const y1 = Math.min(y0 + R(12, 30), Hc - 8);
          if (y1 - y0 < 10) continue;
          const bl = [];
          const nb = 5 + ((w / 16) | 0);
          for (let q = 0; q < nb; q++) bl.push([R(-0.3, 0.3), R(-0.3, 0.32), R(0.3, 0.5)]);
          bl.push([0, R(-0.1, 0.1), R(0.5, 0.62)]);
          pockets.push({ x0: cx - w / 2, x1: cx + w / 2, y0, y1, bl, t: 0, state: 0, dur: (y1 - y0 + w) / 16 });
          break;
        }
      }
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

//scorch.js part03
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
  // glints: the sun road. 90% of the anchors ride an INVERTED PYRAMID under
  // the sky's light — a narrow tip at the waterline right below the light,
  // widening with depth (spread = 5 + dy*0.55, dy biased upward). Off-axis
  // position u is triangular (dense on the axis, sparse at the fringe), and
  // anchors near the axis flare far more often. Each flare is a short random
  // curve repeating the wave's shape (<=5.5px wide, <=3px tall, 1-2.6px fat)
  // in the light's live colour with an additive glow — fast flash, fast fade.
  // STRICT binding: no visible light on screen → no road at all
  let glints = [];
  let wBands = [];
  let wBlobs = [];
  let soilTw = [];

  function waterReset() { ripples = []; waterH = null; bands = new Float32Array(WB); aState = { bass: 0, mid: 0, treble: 0, bassAvg: 0, bassPeak: 0.2, lastBeat: -1 }; }

  function ensureWaterFx() {
    if (glints.length !== 110 || (glints.length && glints[0].wc !== Wc)) {
      glints = [];
      for (let i = 0; i < 110; i++) {
        const axis = Math.random() < 0.9;
        glints.push({
          x: R(0, Wc || 800),
          axis,
          u: axis ? (R(-1, 1) + R(-1, 1)) * 0.5 : 0,
          dy: 2 + Math.pow(Math.random(), 1.3) * 115,
          len: R(1.5, 5.5),
          wdt: R(1, 2.6),
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
    // real hits also emit a pair of expanding surface rings
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
    // glint lifecycle: strictly bound to the VISIBLE light (one frame behind
    // render is fine). Axis anchors re-anchor to the light's live x — no
    // wrap-around to the opposite side, no fallback to a hidden sun
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
              const h = waterAt(gl.x) - waterLevel;
              const near = Math.abs(gl.u) < 0.4;
              if (h > 0.5 || Math.random() < (near ? 0.55 : 0.12)) {
                gl.fl = 0;
                gl.dur = R(0.35, 0.9);
                gl.rise = R(0.18, 0.35);
                gl.hold = R(0.12, 0.3);
                gl.jit = R(0, 6.28);
              } else gl.cd = R(0.25, 1);
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
          // never grab the volcano slope itself: lava craters sit above it
          if (volcano && Math.abs(j * cols.step - volcano.x) < volcano.r + 50) continue;
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
      { x: pi * cols.step, hp: TANK_HP, col: players[0].col, hull: players[0].hull, dispAng: 45, dead: false, fallFrom: undefined, wreck: 0, shield: 1, recoil: 0, terrDmg: 0, riseAcc: 0, dmgAcc: 0 },
      { x: ei * cols.step, hp: TANK_HP, col: players[1].col, hull: players[1].hull, dispAng: 45, dead: false, fallFrom: undefined, wreck: 0, shield: 1, recoil: 0, terrDmg: 0, riseAcc: 0, dmgAcc: 0 }
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

    // lava defence for anyone camped within reach of the flows: a moat and a
    // rampart BETWEEN the volcano and the turret (uphill side). Flows stall
    // and pool in the moat, beat against the rampart wall — both well
    // outside the burn radius — and hold until somebody blasts the mound away
    if (volcano) {
      const NP = cols.length;
      tanks.forEach(t => {
        const away = t.x >= volcano.x ? 1 : -1; // volcano -> turret direction
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
  }

  function newRound(first) {
    genTerrain();
    wind = windDir * R(0.3, 4);
    placeTanks();
    // round 1 starts with the random first shooter; every later round
    // alternates from the previous round's opener
    if (first) turnOrder = firstShooter;
    else turnOrder = 1 - turnOrder;
    turn = turnOrder;
    state = 'aim';
    aim = { ...seatAim[turn] };
    aiAim = 55;
    cur2 = 0;
    cycleT = Math.random() < 0.7 ? R(0, 0.36) : R(0.56, 0.9);
    updateTod();
    shot = null; subshots = []; liquids = []; debris = []; remains = []; terraJobs = []; events = []; sinkers = []; fx = []; firePatches = []; wreckBits = [];
    windParts = []; comets = []; grains = []; lavaBits = []; lastHitInfo = null; killed = null; lastKillMethod = 'weapon'; lastShotApex = 0;
    sliderOpen = null; sliderDrag = false; shake = 0;
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

  // hot-seat hand-over: a 3s "ХОД ПЕРЕДАН — ИМЯ" card between turns,
  // styled exactly like the final banner, in the incoming player's colour;
  // the card counts 3-2-1 so it's clear WHEN firing unlocks — it is driven
  // straight by turnIntro, so the fade-out and the fire unlock land on the
  // same frame
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
  // any change to the live aim from the ACTIVE seat writes back to that seat
  function syncSeatAim() { seatAim[turn] = { ...aim }; }

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
    lastHitInfo = `${players[i].name}: -${Math.round(dmg)} hp (${src})`;
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
    // wind-driven creep: big steps still migrate downwind, but small dunelets
    // (under 4px) are left alone so the saltation grains can build and keep them
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
    // burning fuel pockets: fire breaks through the surface, the burn front
    // eats the deposit; when it's gone the volume becomes a REAL void
    // (carve) and a big shallow one drags the overburden down
    pockets.forEach(pk => {
      if (pk.state !== 1) return;
      pk.t += dt;
      const pr = clamp(pk.t / pk.dur, 0, 1);
      if (Math.random() < dt * 5) {
        const fxp = R(pk.x0 + 3, pk.x1 - 3);
        firePatches.push({ x: fxp, y: surfaceAt(fxp) - R(0, 4), life: R(0.6, 1.4) });
        if (Math.random() < 0.4) fx.push({ k: 'ember', x: fxp, y: surfaceAt(fxp) - 2, vx: R(-20, 20), vy: -R(60, 140), t: 0, life: R(0.6, 1.2), s: R(1, 2) });
      }
      if (Math.random() < dt * 2) fx.push({ k: 'smoke', x: R(pk.x0, pk.x1), y: surfaceAt(R(pk.x0, pk.x1)) - 6, r: R(3, 6), t: 0, life: R(1, 2) });
      if (pr >= 1) {
        pk.state = 2;
        const cy = (pk.y0 + pk.y1) / 2;
        const sid = ++digSid;
        for (let k = 0; k < 3; k++) {
          const fxp = pk.x0 + 8 + (pk.x1 - pk.x0 - 16) * (k / 2);
          carve(fxp, cy, Math.max(6, (pk.y1 - pk.y0) / 2), sid);
        }
        collapseHoles((pk.x0 + pk.x1) / 2, (pk.x1 - pk.x0) * 0.6);
        sfx(0.8);
        shake = Math.min(10, shake + 3);
      }
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

//scorch.js part04
  // ================= EXPLOSIONS =================
  function hitFx(x, y, r, nuke) { shake = Math.min(10, shake + r * 0.08 + (nuke ? 3 : 0)); }

  function boomsAt(x, y, r, style, dmg, noTerr, noDouble) {
    dmg = dmg || 0;
    const m = M();
    const nuke = style === 'nuke';
    hitFx(x, y, r, nuke);
    // a blast landing inside (or in touch with) a combustible pocket ignites it
    pockets.forEach(pk => {
      if (pk.state !== 0) return;
      if (x > pk.x0 - r * 0.5 && x < pk.x1 + r * 0.5 && y > pk.y0 - r * 0.5 && y < pk.y1 + r * 0.5) {
        pk.state = 1; pk.t = 0;
        fx.push({ k: 'flash', x, y, r: 12, t: 0, life: 0.12, col: '#ff9a3a' });
      }
    });
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
      if (!tk.dead && Math.hypot(tk.x - x, tk.y - 6 - y) < r * (nuke ? 3.2 : 2.2)) { damageTank(i, dmg, style, x, y); confirmClose = true; }
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
        if (f.y >= surfaceAt(f.x) - 1) f.t = f.life;
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
      // napalm/forest fire sitting on top of a fuel pocket seeps into it
      if (!fp.volc && fp.life > 0.5) {
        for (let q = 0; q < pockets.length; q++) {
          const pk = pockets[q];
          if (pk.state === 0 && fp.x > pk.x0 && fp.x < pk.x1 && Math.abs(fy - pk.y0) < 40) { pk.state = 1; pk.t = 0; }
        }
      }
      const ci = clamp(Math.round(fp.x / cols.step), 0, cols.length - 1);
      const c = cols[ci];
      c.burn = Math.max(c.burn, 0.5);
      // napalm really eats into the ground: the burn leaves charred pits
      if (!fp.volc && c.h1 <= 0 && c.top < Hc - 8 && Math.random() < dt * 5) {
        c.top += 0.22;
        dirtyA = Math.min(dirtyA, ci); dirtyB = Math.max(dirtyB, ci + 1);
      }
      for (let i = 0; i < tanks.length; i++) {
        const tk = tanks[i];
        if (!tk.dead && Math.abs(tk.x - fp.x) < 13 && Math.abs(tk.y - fy) < 16) { burnN[i]++; confirmClose = true; }
      }
      return fp.life > 0;
    });
    // burn damage counts at most two overlapping patches: calm-wind napalm
    // no longer stacks five fires into an instant kill
    for (let i = 0; i < tanks.length; i++) {
      if (!tanks[i].dead && burnN[i]) damageTank(i, Math.min(burnN[i], 2) * 7 * dt, 'napalm', tanks[i].x, tanks[i].y - 10);
    }
  }

  // persistent hull chunks from overkill deaths: they land, stay forever and
  // sink to the bed in water, like the turret wreck does
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
    if (state !== 'aim' || turn !== 0 || turnIntro > 0) return;
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
    if (state !== 'aim' || turn !== 1 || GMODE !== 2 || turnIntro > 0) return;
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
    t.recoil = 1;
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
    if (state !== 'aim' || turn !== 1 || GMODE !== 1) return;
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
    // terrain weapons, used with intent: bury a foe caught in a pit with dirt,
    // or punch a tunnel toward a foe the ballistics can't reach
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
  // burn it. The bore keeps its entry heading (the aim line), so a tunnel can
  // be punched toward the enemy. Tunnels deeper than DIG_COLLAPSE_H collapse,
  // dropping all ground above; the drill grinds tanks it passes (rock pressure
  // ticks), and its final burst hits like a missile. Drilling into a buried
  // fuel pocket ignites it.
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
      sfx(0.7);
      shake = Math.min(10, shake + 2.5);
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
    p.vx = p.dvx * speed; p.vy = p.dvy * speed;
    const nx = p.x + p.vx * dt;
    const ny = Math.min(p.y + p.vy * dt, Hc - 10);
    if (nx < 4 || nx > Wc - 4) { p.dead = true; p.dug = true; return; }
    carveLine(p.x, p.y, nx, ny, p.w.r * DIG_RADIUS_F, p.sid);
    // the drill grinding through a fuel pocket sets it alight
    for (let q = 0; q < pockets.length; q++) {
      const pk = pockets[q];
      if (pk.state === 0 && p.x > pk.x0 - 4 && p.x < pk.x1 + 4 && p.y > pk.y0 - 4 && p.y < pk.y1 + 4) {
        pk.state = 1; pk.t = 0;
        fx.push({ k: 'flash', x: p.x, y: p.y, r: 12, t: 0, life: 0.12, col: '#ff9a3a' });
      }
    }
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
        if (tk.dead) continue;
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
      if (!isTerr(p.w.type)) {
        tanks.forEach((tk, i) => {
          if (tk.dead) return;
          if (i === p.owner && gt < (p.arm || 0)) return;
          if (Math.abs(p.x - tk.x) < 16 && p.y > tk.y - 34 && p.y < tk.y + 8) {
            p.dead = true;
            if (tk.shield > 0) { tk.shield = 0; fx.push({ k: 'shieldPop', x: tk.x, y: tk.y - 12, col: tk.col, t: 0, life: 0.45 }); }
            else { damageTank(i, p.w.dmg, p.w.type, p.x, p.y); confirmClose = true; }
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

//scorch.js part05
  function updateLiquid(l, dt) {
    l.vy += GRAV * 0.3 * dt;
    l.vx += wind * 0.5 * WINDF * dt;
    l.x += l.vx * dt; l.y += l.vy * dt;
    l.t += dt;
    if (l.x < 0 || l.x > Wc || l.y > Hc) { l.dead = true; return; }
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
                else { damageTank(i, w.dmg, 'funky', bx, by); confirmClose = true; }
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
            else { damageTank(i, w.dmg, 'death', x, y); confirmClose = true; }
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
        // a Life colony (B3/S23) instead of blobs — the plasma boils and starves
        const GW = 34;
        const grid = new Uint8Array(GW * GW);
        for (let gy = 0; gy < GW; gy++) {
          for (let gx = 0; gx < GW; gx++) {
            const dx = (gx - GW / 2 + 0.5) / (GW * 0.36);
            const dy = (gy - GW / 2 + 0.5) / (GW * 0.36);
            grid[gy * GW + gx] = Math.random() < clamp(0.6 - Math.hypot(dx, dy) * 0.55, 0.05, 0.6) ? 1 : 0;
          }
        }
        fx.push({ k: 'plasmaOrb', x, y, r: w.r, t: 0, life: 3.4, gw: GW, grid, gen: 0 });
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
            else { damageTank(i, w.dmg, 'plasma', x, y); confirmClose = true; }
          }
        });
        break;
      }
      case 'napalm': {
        fx.push({ k: 'flash', x, y, r: w.r * 0.6, t: 0, life: 0.08, col: '#ffb84a' });
        for (let i = 0; i < 14; i++) liquids.push({ x: x + R(-w.r / 2, w.r / 2), y, vx: R(-45, 45), vy: R(-100, -25), t: 0, w });
        firePatches.push({ x, y, life: R(4, 7) });
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
          if (!tk.dead && Math.hypot(tk.x - x, tk.y - 6 - y) < w.r * 2.4) { damageTank(i, w.dmg, 'death', x, y); confirmClose = true; }
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

  function killTank(i, cause, style, overkill) {
    const t = tanks[i];
    if (t.dead) return;
    t.dead = true; killed = i; lastKillMethod = cause;
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
    fx.push({ k: 'flash', x: t.x, y: t.y - 12, r: 64, t: 0, life: 0.18 });
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
    // round-lead bookkeeping: seat 0 and seat 1 have their own win/score tallies
    let lead0 = 0, lead1 = 0;
    if (res === 'win') {
      lead0 = 1;
      wins++;
      const dt = (Date.now() - roundStart) / 1000;
      let pts = 100;
      pts += Math.max(0, Math.round(300 - dt * 2));
      if (['MISSILE', 'ROLLER', 'DIGGER', 'DIRT'].includes(lastWeapon)) pts = Math.round(pts * 1.5);
      if (lastShotApex < tanks[1].y - 120) pts += 120;
      if (lastKillMethod === 'drown') pts += 150;
      if (lastKillMethod === 'crush') pts += 120;
      pts += Math.max(0, 40 - shots * 8);
      score += pts;
      score2 += Math.max(0, Math.round(30 - shots));
      aiSkill = Math.min(0.95, aiSkill + 0.08);
    } else if (res === 'lose') {
      lead1 = 1;
      wins2++;
      score2 += 120;
      score += Math.max(0, Math.round(30 - shots));
      aiSkill = Math.max(0.2, aiSkill - 0.05);
    } else {
      score += 30;
      score2 += 30;
    }
    // who the final phrase addresses: PvP — randomly the winner or the loser
    // (the phrase matches THAT player); PvC — always the human
    let kind = res, whoIdx = 0;
    if (res === 'draw') { kind = 'draw'; whoIdx = -1; }
    else if (GMODE === 2) {
      const winIdx = res === 'win' ? 0 : 1;
      const useWin = Math.random() < 0.5;
      kind = useWin ? 'win' : 'lose';
      whoIdx = useWin ? winIdx : 1 - winIdx;
    } else {
      kind = res;
      whoIdx = 0;
    }
    const list = BANNERS[kind];
    const txt = list[(Math.random() * list.length) | 0].replace('{N}', whoIdx >= 0 ? players[whoIdx].name : '');
    const bcol = whoIdx >= 0 ? players[whoIdx].col : BANNER_COL.draw;
    fx.push({ k: 'banner', txt, col: bcol, t: 0, life: 2.3 });
    if (round >= ROUNDS_MAX) { schedule(() => showOver(), 2.3); return; }
    schedule(() => newRound(false), 2.3);
  }

  function renderRecords(hlIdx) {
    const tab = $('.sc-rectab');
    tab.innerHTML = '';
    const hr = document.createElement('tr');
    ['#', 'Очки', 'Побед', 'Игрок', 'Дата'].forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });
    tab.appendChild(hr);
    records().slice(0, MAX_REC).forEach((r, i) => {
      const tr = document.createElement('tr');
      if (i === hlIdx) tr.className = 'me';
      const td0 = document.createElement('td');
      td0.textContent = i + 1;
      tr.appendChild(td0);
      [r.score, r.wins || 0].forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
      const tdp = document.createElement('td');
      tdp.className = 'sc-recpl';
      const chip = document.createElement('canvas');
      chip.width = 36; chip.height = 36;
      drawMiniTurret(chip.getContext('2d'), 36, r.pcol || '#2ecc71', r.phull || 'classic');
      tdp.appendChild(chip);
      const nm = document.createElement('span');
      nm.textContent = r.pname || 'Player1';
      nm.style.color = r.pcol || '#2ecc71';
      tdp.appendChild(nm);
      tr.appendChild(tdp);
      const td4 = document.createElement('td');
      td4.textContent = r.date;
      tr.appendChild(td4);
      tab.appendChild(tr);
    });
  }

  function showOver() {
    const won = wins >= Math.ceil(ROUNDS_MAX / 2);
    const key = (r) => r.date + '|' + r.score + '|' + (r.wins || 0);
    const before = records().map(key);
    // BOTH fighters get their own record row — the table is global by score,
    // so the weaker fighter isn't pushed out by the mode's winner
    saveRec(players[0], score, wins);
    if (GMODE === 2) saveRec(players[1], score2, wins2);
    const recs = records();
    const myIdx = recs.findIndex(r => !before.includes(key(r)));
    const titleEl = $('.sc-over-title');
    if (GMODE === 2) {
      const winner = won ? players[0] : players[1];
      titleEl.textContent = `🏆 ${winner.name} побеждает!`;
      titleEl.style.color = winner.col;
    } else {
      titleEl.textContent = won ? '🏆 Победа!' : '💥 Поражение';
      titleEl.style.color = '';
    }
    const res = $('.sc-over-res');
    res.innerHTML = '';
    res.appendChild(document.createTextNode('Очки: '));
    const sb = document.createElement('b');
    sb.style.color = 'var(--accent)';
    sb.textContent = score;
    res.appendChild(sb);
    if (GMODE === 2) {
      res.appendChild(document.createTextNode(' — '));
      const sb2 = document.createElement('b');
      sb2.style.color = players[1].col;
      sb2.textContent = score2;
      res.appendChild(sb2);
      res.appendChild(document.createTextNode(`   побед: ${wins} : ${wins2}`));
    } else {
      res.appendChild(document.createTextNode(`\u00a0\u00a0побед: ${wins} : ${wins2}`));
    }
    renderRecords(myIdx);
    $('.sc-over').classList.add('show');
    state = 'over';
  }

  // ================= LOOP =================
  function start() {
    score = 0; wins = 0; shots = 0; aiSkill = 0.35;
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
    gt += dt; skyT += dt; cloudOff += windDir * 6 * dt;
    cycleT = (cycleT + dt / DAY_CYCLE) % 1;
    todT += dt;
    if (todT > 0.25) { todT = 0; updateTod(); }
    for (let i = events.length - 1; i >= 0; i--) if (gt >= events[i].at) { const fn = events[i].fn; events.splice(i, 1); fn(); }

    // turn clock runs only for a HUMAN seat, is frozen for the 3s hand-over
    // card and whenever a modal window (help / setup / confirm / slider) is up
    if (state === 'aim' && isHumanSeat(turn) && turnIntro <= 0 && !modalOpen()) {
      const before = turnTimer;
      turnTimer -= dt;
      // countdown beeps at 10, 5 and 1 s (quiet)
      for (const m of [10, 5, 1]) {
        if (before > m && turnTimer <= m && !warnedAt[m]) {
          warnedAt[m] = 1;
          beep(m <= 1 ? 1200 : 880, 0.08, 0.09);
        }
      }
      if (turnTimer <= 0) {
        turnTimer = 0;
        drag = null; sliderOpen = null; sliderDrag = false;
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
      // drowned things settle on the lakebed/seabed — the hidden part of the
      // surface — and keep stirring the waterline with small ripples
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
    if (nn > 0.6 && Math.random() < dt * 0.08) {
      comets.push({ x: R(0, Wc * 1.1), y: R(10, Hc * 0.3), vx: -R(160, 380), vy: R(30, 110), t: 0, life: R(0.8, 2), sz: R(1, 2.4) });
    }
    comets.forEach(c => { c.x += c.vx * dt; c.y += c.vy * dt; c.t += dt; });
    comets = comets.filter(c => c.t < c.life);

    stepGrains(dt);
    const want = (windKind() === 'snow' || windKind() === 'sand') ? 0 : Math.round(clamp(Math.abs(wind), 0.3, 4) * 14);
    while (windParts.length < want) windParts.push({ x: R(0, Wc), y: R(20, Hc * 0.9), ph: R(0, 6.28), ph2: R(0, 6.28), spd: R(0.6, 1.4), s: R(1.4, 3.4), a: R(0.75, 1.0), kind: windKind() });
    while (windParts.length > want) windParts.pop();
    windParts.forEach(p => {
      p.ph += dt * (1.5 + p.spd); p.ph2 += dt * 2.2;
      p.x += wind * (40 + 55 * p.spd) * dt;
      p.y += Math.sin(p.ph) * 18 * dt + Math.cos(p.ph2) * 8 * dt;
      if (p.x < -6) p.x = Wc + 4; if (p.x > Wc + 6) p.x = -4;
      if (p.y < 20) p.y = Hc * 0.9; if (p.y > Hc) p.y = 20;
    });

    if (state === 'aim' && turn === 1 && GMODE === 1 && !shot && subshots.length === 0 && turnReady()) schedule(aiTurn, 0.9);
    if (boomsIdle() && !shot && subshots.length === 0 && killed !== null && state !== 'wait' && state !== 'over' && state !== 'closing') endRound();
    if (state === 'boom' && killed === null && !shot && subshots.length === 0 && turnReady()) endTurn();
    if (state !== 'closing' && state !== 'over') draw();
  }
  // dead-hand pacing: control returns once the blast fades and the tanks
  // settle, while debris, embers and napalm keep working in the background;
  // a delayed kill still triggers endRound after the fires burn out
  const turnReady = () => !fx.some(f => f.k === 'fire' || f.k === 'flash' || f.k === 'shock' || f.k === 'plasmaOrb') && terraJobs.length === 0 && events.length === 0 && tanks.every(t => t.dead || t.fallFrom === undefined);
  const boomsIdle = () => turnReady() && liquids.length === 0 && !debris.some(d => !d.settled) && !firePatches.some(fp => !fp.volc);

//scorch.js part06
  // ================= GROUND SNOW / SAND GRAINS =================
  // saltation terraforming: a grain rips real ground where the wind picks it
  // up and welds it back where it drops — flat ground sheds grains freely,
  // slopes hold them. Deposits may pile 5px above the neighbours, so dunelets
  // grow, get torn off again and the relief visibly migrates downwind
  function newGrain() {
    const x = R(0, Wc);
    const ci = clamp(Math.round(x / cols.step), 0, cols.length - 1);
    const c = cols[ci];
    if (c.h1 > 0 || c.burn > 0.2 || c.surf <= 0) return null;
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
      if (g.y < surfaceAt(g.x) - 24) g.vy += GRAV * 0.8 * dt; // hug the ground
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
  function drawGrains() {
    if (!grains.length) return;
    ctx.fillStyle = biome.surf;
    grains.forEach(g => ctx.fillRect(g.x, g.y, g.s, g.s));
  }

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
    drawWreckBits();
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
    drawGrains();
    drawHpLate();
    drawBanners();
    drawTurnCards();
    // the trajectory is live during the 3s hand-over card too — only the
    // SHOT stays locked until the countdown ends
    if (state === 'aim' && isHumanSeat(turn) && !helpOpen && !sliderOpen && !setupOpen && !confirmOpen) drawAim();
    ctx.restore();
    drawHUD();
    // the off-screen projectile indicator is a DOM layer ABOVE the HUD —
    // the canvas marks used to hide behind the HUD bar
    drawOffscreenMarks();
    drawSlider();
  }

  function drawSky() {
    const p = cycleT;
    skyLight = { x: -999, col: '255,255,255', a: 0 };
    const pal = biome.pal;
    const g = ctx.createLinearGradient(0, 0, 0, Hc);
    if (pal && pal.day) {
      // alien day sky fades into the common night as dayness drops
      for (let s = 0; s <= 4; s++) {
        const u = s / 4;
        const pc = sampleStops(pal.day, u);
        const nc = sampleStops(tod.stops, u);
        g.addColorStop(u, rgbaStr(mixColA(nc, pc, dayness)));
      }
    } else {
      tod.stops.forEach((c, i) => g.addColorStop(i / (tod.stops.length - 1), c));
    }
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
      // the moon registers itself as the live light — its true pale colour
      if (mx > 20 && mx < Wc - 20) skyLight = { x: mx, col: '223,228,234', a: 0.45 * starA + 0.1 };
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
      const sunC = pal && pal.sun ? pal.sun : tod.sun;
      const haloC = pal && pal.sunHalo ? pal.sunHalo : tod.sunHalo;
      const hot = mixColA(parseCol('#ff6a3a'), parseCol(sunC), alt);
      const halo = mixColA(parseCol('rgba(255,110,70,0.4)'), parseCol(haloC), alt);
      const shimmer = 1 + Math.sin(skyT * 1.1) * 0.05;
      ctx.fillStyle = rgbaStr(halo);
      ctx.beginPath(); ctx.arc(sx, sy, 52 * shimmer, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgbaStr(hot);
      ctx.beginPath(); ctx.arc(sx, sy, 24 * shimmer, 0, Math.PI * 2); ctx.fill();
      // the sun registers itself as the live light ONLY while actually on
      // screen — its true drawn colour (red at the horizon, gold high) and
      // its altitude-scaled intensity; water glints bind to this exactly
      if (sx > 20 && sx < Wc - 20) skyLight = { x: sx, col: `${hot[0] | 0},${hot[1] | 0},${hot[2] | 0}`, a: 0.25 + alt * 0.6 };
    }
    // off-world celestials: a binary companion star rides the same arc with a
    // phase offset; a ringed gas giant hangs fixed on the horizon side
    if (biome.sky && biome.sky.twin) {
      const tp = (p + 0.58) % 1;
      const sp2 = tp >= 0.95 ? (tp - 0.95) / 0.55 : (tp + 0.05) / 0.55;
      const tx2 = -40 + sp2 * (Wc + 80);
      const ty2 = Hc * (0.24 - Math.sin(clamp(sp2, 0, 1) * Math.PI) * 0.14);
      const vis = clamp(dayness + 0.25, 0, 1);
      const c2 = parseCol(biome.sky.twin);
      const halo2 = mixColA([c2[0], c2[1], c2[2], 0.35], parseCol(tod.sunHalo), 0.3);
      ctx.fillStyle = rgbaStr(halo2);
      ctx.beginPath(); ctx.arc(tx2, ty2, 28, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = vis;
      ctx.fillStyle = rgbaStr(mixColA(c2, parseCol(tod.sun), 0.25));
      ctx.beginPath(); ctx.arc(tx2, ty2, 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (biome.sky && biome.sky.giant) {
      const gg = biome.sky.giant;
      const gx = Wc * 0.78, gy = Hc * 0.16, gr = clamp(Wc * 0.045, 20, 38);
      const gh = ctx.createRadialGradient(gx, gy, gr * 0.5, gx, gy, gr * 1.8);
      gh.addColorStop(0, 'rgba(255,255,255,0.1)');
      gh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gh;
      ctx.beginPath(); ctx.arc(gx, gy, gr * 1.8, 0, Math.PI * 2); ctx.fill();
      // banded disc on an offscreen canvas; the night side is carved away by
      // an offset circle (destination-out), same technique as the moon's bite.
      // The ring is stroked ONLY over its front half, so no part of it is
      // ever layered on top of the disc from behind
      if (!giantCv) { giantCv = document.createElement('canvas'); giantCv.width = 96; giantCv.height = 96; giantCtx = giantCv.getContext('2d'); }
      if (giantKey !== gg.col) {
        giantKey = gg.col;
        const GC = 48, PR = 34;
        giantCtx.globalCompositeOperation = 'source-over';
        giantCtx.clearRect(0, 0, 96, 96);
        giantCtx.save();
        giantCtx.translate(GC, GC);
        giantCtx.fillStyle = gg.col;
        giantCtx.beginPath(); giantCtx.arc(0, 0, PR, 0, Math.PI * 2); giantCtx.fill();
        // latitude bands, CLIPPED to the disc — no raw rectangles bleeding
        // past the edge, so nothing reads as free-floating stripes
        giantCtx.beginPath(); giantCtx.arc(0, 0, PR - 0.5, 0, Math.PI * 2); giantCtx.clip();
        giantCtx.globalAlpha = 0.16;
        giantCtx.fillStyle = '#1a1420';
        giantCtx.fillRect(-PR, -PR * 0.42, PR * 2, 6);
        giantCtx.fillRect(-PR, -PR * 0.02, PR * 2, 7);
        giantCtx.fillRect(-PR, PR * 0.34, PR * 2, 5);
        giantCtx.globalAlpha = 0.2;
        giantCtx.fillStyle = '#ffffff';
        giantCtx.fillRect(-PR, -PR * 0.55, PR * 2, 3);
        giantCtx.restore();
        giantCtx.globalCompositeOperation = 'destination-out';
        giantCtx.beginPath(); giantCtx.arc(GC + PR * 0.72, GC - PR * 0.5, PR, 0, Math.PI * 2); giantCtx.fill();
        giantCtx.globalCompositeOperation = 'source-over';
      }
      const gs = 96 * (gr / 34);
      ctx.drawImage(giantCv, gx - gs / 2, gy - gs / 2, gs, gs);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(-0.32);
      ctx.strokeStyle = gg.ring;
      ctx.lineWidth = Math.max(2, gr * 0.12);
      ctx.beginPath(); ctx.ellipse(0, 0, gr * 1.75, gr * 0.34, 0, 0, Math.PI); ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1, gr * 0.05);
      ctx.beginPath(); ctx.ellipse(0, 0, gr * 1.45, gr * 0.26, 0, 0, Math.PI); ctx.stroke();
      ctx.restore();
    }
    for (let c = 0; c < cloudCount; c++) {
      const depth = 0.4 + noise(c * 1.7) * 0.65;
      const cy = Hc * (0.04 + noise(c * 7.7) * 0.26);
      const cw = 110 + noise(c * 3.1) * 150;
      const cx = (((cloudOff * depth) + noise(c * 13) * Wc * 1.4) % (Wc + 420) + (Wc + 420)) % (Wc + 420) - 210;
      const cl = mixColA(pal && pal.cloud ? parseCol(pal.cloud) : [56, 64, 84, 1], [255, 255, 255, 1], dayness);
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
    hz.addColorStop(1, (pal && pal.haze) || tod.haze);
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
    // per-biome underground: layered strata in the biome's own rock colors,
    // each band following the surface at its own depth and wobble
    const un = biome.under || { strata: [[biome.sub[1], 26], [biome.sub[2], 54]], wobble: 8, dec: 'root', dep: 'dot', twink: '255,255,255', twN: 0 };
    for (let b = 0; b < un.strata.length; b++) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = un.strata[b][0];
      ctx.beginPath();
      ctx.moveTo(0, Hc);
      for (let x = 0; x <= Wc; x += 14) {
        const i = clamp(Math.round(x / cols.step), 0, N - 1);
        ctx.lineTo(x, cols[i].top + un.strata[b][1] + Math.sin(x * 0.02 + b * 5 + seed % 7) * un.wobble);
      }
      ctx.lineTo(Wc, Hc);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // scattered stones, common to all worlds
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 3; i < N; i += 5) {
      if (noise(i * 4.9) > 0.68) {
        const y = cols[i].top + 14 + noise(i * 2.7) * 60;
        if (y < Hc - 6) ctx.fillRect(i * cols.step, y, 2 + noise(i) * 2.5, 1.6 + noise(i * 1.7) * 1.6);
      }
    }
    // surface signature layer: roots / cross-beds / ice lenses / pulsing
    // magma veins / spore pockets / metal grit / embers — hugging the surface
    for (let i = 3; i < N; i += 5) {
      const x = i * cols.step;
      const st = cols[i].top;
      const nz = noise(i * 4.9), nz2 = noise(i * 2.7);
      if (un.dec === 'root' && nz > 0.55) {
        ctx.strokeStyle = shade(un.strata[0][0], 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const rl = 6 + nz2 * 12;
        ctx.moveTo(x, st + 3);
        ctx.quadraticCurveTo(x + (nz2 - 0.5) * 8, st + 3 + rl * 0.5, x + (nz - 0.5) * 10, st + 3 + rl);
        ctx.stroke();
      } else if (un.dec === 'cross' && nz > 0.58) {
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = 1;
        const y0 = st + 12 + nz2 * 52;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 7, y0 + 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 3, y0 - 5); ctx.lineTo(x + 10, y0 - 1); ctx.stroke();
      } else if (un.dec === 'lens' && nz > 0.62) {
        ctx.fillStyle = 'rgba(215,235,248,0.3)';
        const y0 = st + 14 + nz2 * 46;
        ctx.fillRect(x, y0, 10 + nz * 12, 2);
        ctx.fillRect(x + 3, y0 + 5, 6 + nz * 6, 1.5);
      } else if (un.dec === 'magma' && nz > 0.5) {
        // the hot vein breathes — part of the soil's pixel animation
        const pul = 0.3 + 0.45 * Math.max(0, Math.sin(gt * 1.4 + i * 0.7));
        ctx.strokeStyle = `rgba(255,110,30,${pul.toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const y0 = st + 12 + nz2 * 42;
        ctx.moveTo(x, y0);
        ctx.quadraticCurveTo(x + 6, y0 - 5 - Math.sin(gt * 0.9 + i) * 2, x + 12, y0);
        ctx.stroke();
      } else if (un.dec === 'spore' && nz > 0.52) {
        ctx.fillStyle = `rgba(${un.twink},0.22)`;
        const y0 = st + 10 + nz2 * 46;
        ctx.fillRect(x, y0, 2, 2);
        ctx.fillRect(x + 4, y0 + 4, 1.5, 1.5);
        ctx.fillRect(x - 3, y0 + 7, 1.5, 1.5);
      } else if (un.dec === 'grit' && nz > 0.56) {
        ctx.fillStyle = 'rgba(255,220,170,0.3)';
        const y0 = st + 12 + nz2 * 50;
        ctx.fillRect(x, y0, 3, 1.4);
        ctx.fillRect(x + 4, y0 + 3, 2, 1.2);
      } else if (un.dec === 'ember' && nz > 0.6) {
        ctx.fillStyle = `rgba(${un.twink},0.22)`;
        const y0 = st + 12 + nz2 * 46;
        ctx.fillRect(x, y0, 2, 2);
      }
    }
    ctx.lineWidth = 1;
    // DEEP deposits spread over the whole underground height: dot = ore
    // specks, shard = ice needles, crack = breathing magma fissures,
    // vein = flaring crystal veins. Fixed points; blinking/flaring via sin,
    // all clipped to the ground and skipped inside tunnels
    if (soilTw.length !== un.twN || (soilTw.length && (soilTw[0].sd !== seed || soilTw[0].wc !== Wc))) {
      soilTw = [];
      for (let k = 0; k < un.twN; k++) {
        const x = R(0, Wc);
        const base = surfaceAt(x);
        const y = clamp(base + R(12, Math.max(16, Hc - 6 - base)), base + 12, Hc - 4);
        soilTw.push({ x, y, ph: R(0, 6.28), sp: R(0.5, 2.2), s: R(1.4, 2.6), seg: [R(-4, 4), R(-4, 4), R(-4, 4)], l: R(8, 18), sd: seed, wc: Wc });
      }
    }
    for (let k = 0; k < soilTw.length; k++) {
      const tw = soilTw[k];
      if (inVoid(tw.x, tw.y) || tw.y < surfaceAt(tw.x) + 3) continue;
      let a;
      if (tw.dep === undefined) tw.dep = un.dep;
      if (un.dep === 'crack') a = 0.3 + 0.4 * Math.max(0, Math.sin(gt * tw.sp + tw.ph));
      else a = Math.pow(Math.max(0, Math.sin(gt * tw.sp + tw.ph)), un.dep === 'shard' ? 3 : 2);
      if (a < 0.05) continue;
      ctx.strokeStyle = `rgba(${un.twink},${(a * 0.9).toFixed(3)})`;
      ctx.fillStyle = `rgba(${un.twink},${(a * 0.9).toFixed(3)})`;
      if (un.dep === 'crack' || un.dep === 'vein') {
        ctx.lineWidth = un.dep === 'crack' ? 1.5 : 1.2;
        ctx.beginPath();
        ctx.moveTo(tw.x, tw.y);
        ctx.lineTo(tw.x + tw.seg[0], tw.y + tw.l * 0.35);
        ctx.lineTo(tw.x + tw.seg[0] + tw.seg[1], tw.y + tw.l * 0.7);
        ctx.lineTo(tw.x + tw.seg[0] + tw.seg[1] + tw.seg[2], tw.y + tw.l);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (un.dep === 'shard') {
        ctx.fillRect(tw.x, tw.y, 1.6, tw.l * 0.5 + 4);
        ctx.fillRect(tw.x - 1, tw.y + 2, 0.8, 3);
      } else {
        ctx.fillRect(tw.x - tw.s / 2, tw.y, tw.s, tw.s);
      }
    }
    // fuel pockets: peat / alien biomass. The deposit is an irregular rounded
    // CLOUD (blob set in fractions of the pocket box — resize-safe); the
    // burn front eats it from the top, the burnt crown reads as charred, and
    // blob overlaps deepen the fill for a layered organic look
    const fuel = biome.fuel;
    pockets.forEach(pk => {
      if (pk.state === 2 || !fuel) return;
      const wP = pk.x1 - pk.x0, hP = pk.y1 - pk.y0;
      const ccx = (pk.x0 + pk.x1) / 2, ccy = (pk.y0 + pk.y1) / 2;
      const blobXY = (b) => [ccx + b[0] * wP, ccy + b[1] * hP, Math.max(5, b[2] * wP)];
      const blobPath = () => {
        ctx.beginPath();
        pk.bl.forEach(b => { const [bx, by, br] = blobXY(b); ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, Math.PI * 2); });
      };
      const pr = pk.state === 1 ? clamp(pk.t / pk.dur, 0, 1) : 0;
      const fy = pk.y0 + hP * pr;
      ctx.save();
      blobPath();
      ctx.clip();
      // fuel body: overlapping blobs, the overlaps read darker
      pk.bl.forEach(b => {
        const [bx, by, br] = blobXY(b);
        ctx.fillStyle = `rgba(${fuel.col},0.42)`;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      });
      if (pk.state === 1) {
        ctx.fillStyle = 'rgba(8,6,4,0.6)';
        ctx.fillRect(pk.x0 - wP, pk.y0 - hP * 2, wP * 3, Math.max(0, fy - pk.y0) + 2);
      }
      ctx.fillStyle = `rgba(${fuel.spark},0.5)`;
      for (let k = 0; k < 5; k++) {
        const sx = pk.x0 + ((seed * 31 + k * 47) % (pk.x1 - pk.x0 - 4)) + 2;
        const sy = Math.max(fy + 3, pk.y0 + 4 + ((seed * 17 + k * 53) % Math.max(1, pk.y1 - pk.y0 - 8)));
        ctx.fillRect(sx, sy, 2, 2);
      }
      if (pk.state === 1) {
        ctx.strokeStyle = 'rgba(255,140,40,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pk.x0, fy);
        for (let x = pk.x0 + 6; x < pk.x1; x += 7) ctx.lineTo(x, fy + Math.sin(x * 0.3 + gt * 7) * 2.5);
        ctx.lineTo(pk.x1, fy);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      ctx.restore();
      // soft cloud outline on top
      blobPath();
      ctx.strokeStyle = `rgba(${fuel.col},0.4)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (pk.state === 1) {
        const gl2 = ctx.createRadialGradient(ccx, fy, 2, ccx, fy, wP * 0.7);
        gl2.addColorStop(0, 'rgba(255,110,30,0.25)');
        gl2.addColorStop(1, 'rgba(255,110,30,0)');
        ctx.fillStyle = gl2;
        ctx.fillRect(pk.x0 - 6, fy - 20, pk.x1 - pk.x0 + 12, 40);
      }
    });
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
    } else if (bk === 'xeno') {
      // alien spore stalks glowing faintly above the purple crust
      for (let i = 0; i < N; i += 4) {
        const c = cols[i];
        if (c.surf <= 0 || c.burn > 0.2 || (c.h1 > 0 && c.h0 <= c.top + 2)) continue;
        if (noise(i * 9.3) < 0.6) continue;
        const x = i * cols.step;
        const h = 3 + noise(i * 3.3) * 5;
        const sway = Math.sin(gt * 1.3 + i * 0.5) * 1.2;
        ctx.strokeStyle = 'rgba(150,105,215,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, c.top + 1);
        ctx.quadraticCurveTo(x + sway * 0.4, c.top - h * 0.6, x + sway, c.top - h);
        ctx.stroke();
        ctx.fillStyle = 'rgba(140,235,255,0.85)';
        ctx.fillRect(x + sway - 1, c.top - h - 1, 2, 2);
      }
    } else if (bk === 'desert' || bk === 'rust') {
      ctx.strokeStyle = bk === 'rust' ? 'rgba(90,42,28,0.35)' : 'rgba(122,92,52,0.3)';
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

//scorch.js part07
  function drawWater() {
    if (!waterH) return;
    ensureWaterFx();
    const dark = !isDayT();
    const N = cols.length;
    const wp = biome.pal && biome.pal.water;
    // the water mirrors the sky just above the horizon, with a cool cast
    const L = tod.stops.length;
    const hz = mixColA(parseCol(tod.stops[Math.max(0, L - 2)]), parseCol(tod.stops[L - 1]), 0.5);
    let sc, dc;
    if (wp) {
      const m = mixColA(parseCol(wp.top), hz, dark ? 0.55 : 0.4);
      sc = [clamp(Math.round(m[0]), 0, 255), clamp(Math.round(m[1]), 0, 255), clamp(Math.round(m[2]), 0, 255)];
      dc = parseCol(wp.deep);
    } else {
      const f = dark ? 0.6 : 1;
      sc = [
        clamp(Math.round(hz[0] * 0.82 * f), 0, 255),
        clamp(Math.round(hz[1] * 0.92 * f + 4), 0, 255),
        clamp(Math.round(hz[2] * 0.98 * f + 14), 0, 255)
      ];
      dc = [
        clamp(Math.round(hz[0] * 0.22 + 6), 0, 255),
        clamp(Math.round(hz[1] * 0.3 + 12), 0, 255),
        clamp(Math.round(hz[2] * 0.4 + 26), 0, 255)
      ];
    }
    const g = ctx.createLinearGradient(0, waterLevel - 14, 0, Hc * 0.98);
    g.addColorStop(0, `rgba(${sc[0]},${sc[1]},${sc[2]},0.5)`);
    g.addColorStop(0.45, `rgba(${(sc[0] * 0.45 + dc[0] * 0.55) | 0},${(sc[1] * 0.45 + dc[1] * 0.55) | 0},${(sc[2] * 0.45 + dc[2] * 0.55) | 0},0.66)`);
    g.addColorStop(1, `rgba(${dc[0]},${dc[1]},${dc[2]},0.88)`);
    const bodyPath = () => {
      ctx.beginPath();
      if (WATER_MODE === 2) {
        ctx.moveTo(-30, waterLevel + waterH[0]);
        for (let k = 0; k < N; k++) ctx.lineTo(k * cols.step, waterLevel + waterH[k]);
        ctx.lineTo(Wc + 30, waterLevel + waterH[N - 1]);
        ctx.lineTo(Wc + 30, Hc + 30);
        ctx.lineTo(-30, Hc + 30);
        ctx.closePath();
      } else {
        let i = 0;
        while (i < N) {
          if (cols[i].top <= waterLevel) { i++; continue; }
          let j = i + 1;
          while (j < N && cols[j].top > waterLevel) j++;
          ctx.moveTo(i * cols.step, waterLevel + waterH[i]);
          for (let k = i + 1; k < j; k++) ctx.lineTo(k * cols.step, waterLevel + waterH[k]);
          for (let k = j - 1; k >= i; k--) ctx.lineTo(k * cols.step, cols[k].top);
          ctx.closePath();
          i = j;
        }
      }
    };
    ctx.fillStyle = g;
    bodyPath();
    ctx.fill();
    // in-water decor, clipped to the water body itself — soft sky bands,
    // drifting silt pixels and the sun-road glints. None of them ever
    // touches the waterH surface geometry
    ctx.save();
    bodyPath();
    ctx.clip();
    for (let b = 0; b < wBands.length; b++) {
      const wb = wBands[b];
      const bw = Math.max(150, Wc * wb.w);
      const span = Wc + bw;
      let bx = (gt * wb.sp * 50 + wb.ph * 90) % span;
      if (bx < 0) bx += span;
      bx = bx - bw + Math.sin(gt * 0.4 + wb.ph) * 14;
      const by = waterLevel + wb.d;
      const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(0.5, `rgba(${Math.min(255, sc[0] + 40)},${Math.min(255, sc[1] + 40)},${Math.min(255, sc[2] + 30)},0.12)`);
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(bx, by, bw, 5);
    }
    // internal volume: tiny drifting silt pixels instead of soft ovals
    ctx.fillStyle = `rgb(${Math.min(255, sc[0] + 30)},${Math.min(255, sc[1] + 30)},${Math.min(255, sc[2] + 20)})`;
    for (let b = 0; b < wBlobs.length; b++) {
      const wb = wBlobs[b];
      const x = wb.fx * Wc + Math.sin(gt * 0.25 + wb.ph) * 10;
      const y = waterLevel + wb.d + Math.sin(gt * 0.18 + wb.ph * 2) * 5;
      ctx.globalAlpha = clamp(wb.a * (0.45 + 0.55 * Math.sin(gt * 0.5 + wb.ph)), 0, 0.5);
      ctx.fillRect(x, y, 2.2 * wb.s, 1.4);
    }
    ctx.globalAlpha = 1;
    // sun road glints — STRICTLY the visible sky light: the pyramid axis is
    // re-anchored to the light's live x at render time, the colour is the
    // light's true drawn colour, and the brightness carries the light's
    // altitude intensity × cloudiness. No light on screen → no road at all
    const lOn = skyLight.x > 10 && skyLight.x < Wc - 10 && skyLight.a > 0.06;
    const cdim = 1 - 0.45 * clamp((tod.clouds - 0.2) / 0.35, 0, 1);
    const LI = lOn ? clamp(skyLight.a * cdim, 0, 1) : 0;
    if (LI > 0.03) {
      const lp = skyLight.col.split(',');
      const sr = Math.min(255, (clamp(+lp[0] || 0, 0, 255) | 0) + 25);
      const sg2 = Math.min(255, (clamp(+lp[1] || 0, 0, 255) | 0) + 25);
      const sb2 = Math.min(255, (clamp(+lp[2] || 0, 0, 255) | 0) + 25);
      for (let q = 0; q < glints.length; q++) {
        const gl = glints[q];
        if (gl.fl < 0) continue;
        const gx = gl.axis ? skyLight.x + gl.u * (5 + gl.dy * 0.55) : gl.x;
        const pr = gl.fl / gl.dur;
        let a;
        if (pr < gl.rise) a = pr / gl.rise;
        else if (pr < gl.rise + gl.hold) a = 1;
        else a = clamp(1 - (pr - gl.rise - gl.hold) / Math.max(0.01, 1 - gl.rise - gl.hold), 0, 1);
        const A = a * LI;
        if (A <= 0.02) continue;
        const yb = waterAt(gx);
        const yC = (xx) => yb + 1 + gl.dy + clamp(waterAt(xx) - yb, -1.5, 1.5);
        const ln = gl.len;
        const x0 = gx - ln / 2;
        ctx.strokeStyle = `rgba(${sr},${sg2},${sb2},${(A * 0.95).toFixed(3)})`;
        ctx.lineWidth = gl.wdt;
        ctx.beginPath();
        ctx.moveTo(x0, yC(x0));
        ctx.lineTo(gx, yC(gx));
        ctx.lineTo(x0 + ln, yC(x0 + ln));
        ctx.stroke();
        // glow halo: additive, wide and soft, same colour
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = A * 0.34;
        ctx.strokeStyle = `rgba(${sr},${sg2},${sb2},0.6)`;
        ctx.lineWidth = gl.wdt + 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, yC(gx));
        ctx.lineTo(x0 + ln, yC(gx));
        ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1;
        ctx.lineCap = 'butt';
      }
    }
    ctx.restore();
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
      if (WATER_MODE === 2) {
        ctx.moveTo(-30, waterLevel + waterH[0]);
        for (let k = 0; k < N; k++) ctx.lineTo(k * cols.step, waterLevel + waterH[k]);
      } else {
        let started = false;
        for (let k = 0; k < N; k++) {
          const x = k * cols.step, y = waterLevel + waterH[k];
          if (cols[k].top <= waterLevel) { started = false; continue; }
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
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
        if (WATER_MODE !== 2 && surfaceAt(x) <= waterLevel) continue;
        const y = waterAt(x);
        const tw = Math.abs(Math.sin(gt * (1.5 + noise(k) * 2) + k * 2.4));
        if (tw > 0.6) ctx.fillRect(x, y - 0.8, 1.4, 1.4);
      }
    }
    if (lOn && (WATER_MODE === 2 || surfaceAt(skyLight.x) > waterLevel + 6)) {
      const baseA = skyLight.a * 0.22 * cdim;
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

  // hot-seat turn hand-over card: styled EXACTLY like the final banner —
  // big gradient name with stroke, small caps header, and a 3-2-1 countdown
  // clock. Driven directly by turnIntro (not by the fx clock, which runs at
  // 1.6x): the card fully fades out on the very frame the fire lock lifts
  function drawTurnCards() {
    if (!turnCard || turnIntro <= 0) return;
    const outA = clamp(turnIntro * 2.5, 0, 1);
    const fs = clamp(Wc * 0.055, 26, 52);
    ctx.save();
    ctx.translate(Wc / 2, Hc * 0.42);
    ctx.globalAlpha = outA;
    ctx.textAlign = 'center';
    ctx.font = `700 ${fs * 0.38}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('ХОД ПЕРЕДАН', 0, -fs * 0.62);
    ctx.font = `900 ${fs}px Orbitron, monospace`;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(4, fs * 0.09);
    ctx.strokeText(turnCard.txt, 0, fs * 0.35);
    const g = ctx.createLinearGradient(0, -fs * 0.6, 0, fs * 0.2);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.55, turnCard.col);
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fillText(turnCard.txt, 0, fs * 0.35);
    const left = Math.max(1, Math.ceil(turnIntro));
    const blink = turnIntro <= 1;
    ctx.font = `900 ${fs * 0.7}px Orbitron, monospace`;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = Math.max(3, fs * 0.07);
    ctx.strokeText('' + left, 0, fs * 1.05);
    ctx.fillStyle = blink ? (Math.sin(gt * 10) < 0 ? '#ff2a1a' : '#ff5a4a') : turnCard.col;
    ctx.fillText('' + left, 0, fs * 1.05);
    ctx.restore();
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
  function drawFx() {
    fx.forEach(f => {
      const p = f.t / f.life;
      if (f.k === 'flash') {
        ctx.globalAlpha = Math.max(0, 1 - p) * 0.95;
        ctx.fillStyle = f.col || '#fff';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + p * 0.5), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.k === 'skyflash') {
        ctx.fillStyle = f.col + (f.a * (1 - p) * (1 - p)).toFixed(3) + ')';
        ctx.fillRect(-40, -40, Wc + 80, Hc + 80);
      } else if (f.k === 'ring') {
        const r = f.r0 + (f.r1 - f.r0) * ease(p);
        ctx.strokeStyle = `rgba(${f.col},${(0.55 * (1 - p)).toFixed(3)})`;
        ctx.lineWidth = 2.5 * (1 - p) + 0.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
      } else if (f.k === 'wring') {
        const a = 1 - p;
        ctx.strokeStyle = `rgba(200,230,255,${(0.55 * a).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, Math.max(1.5, f.r * 0.24), 0, 0, Math.PI * 2); ctx.stroke();
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
        // cellular automaton (Life: B3/S23 on a torus) instead of blobs —
        // the plasma colony boils, migrates and slowly starves with the blast
        const r = p < 0.15 ? f.r * (0.3 + (p / 0.15) * 0.7) : f.r;
        const GW = f.gw || 34;
        const cell = (2 * r) / GW;
        const want = Math.floor(f.t / 0.1);
        while (f.gen < want) {
          f.gen++;
          const src = f.grid;
          const dst = new Uint8Array(src.length);
          let pop = 0;
          for (let gy = 0; gy < GW; gy++) {
            for (let gx = 0; gx < GW; gx++) {
              let n = 0;
              for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                  if (ox || oy) n += src[((gy + oy + GW) % GW) * GW + ((gx + ox + GW) % GW)];
                }
              }
              const a = src[gy * GW + gx];
              const v = (n === 3 || (a && n === 2)) ? 1 : 0;
              dst[gy * GW + gx] = v;
              pop += v;
            }
          }
          f.grid = dst;
          for (let m = 0; m < 3; m++) {
            const rx = (Math.random() * GW) | 0, ry = (Math.random() * GW) | 0;
            if (Math.hypot(rx - GW / 2, ry - GW / 2) < GW * 0.42) f.grid[ry * GW + rx] = 1;
          }
          if (pop < 6) {
            for (let k = 0; k < 40; k++) {
              const rx = clamp((GW / 2 + R(-9, 9)) | 0, 0, GW - 1);
              const ry = clamp((GW / 2 + R(-9, 9)) | 0, 0, GW - 1);
              f.grid[ry * GW + rx] = 1;
            }
          }
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(1 - p * 0.55, 0.25, 0.9);
        const s = Math.max(1, cell * 0.85);
        for (let gy = 0; gy < GW; gy++) {
          for (let gx = 0; gx < GW; gx++) {
            if (!f.grid[gy * GW + gx]) continue;
            ctx.fillStyle = ((gx + gy) & 1) ? 'rgba(255,215,110,0.85)' : 'rgba(255,70,40,0.9)';
            ctx.fillRect(f.x - r + gx * cell, f.y - r + gy * cell, s, s);
          }
        }
        ctx.restore();
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

//scorch.js part08
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

  function drawWreckBits() {
    wreckBits.forEach(w => {
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.rot);
      ctx.fillStyle = w.col;
      ctx.fillRect(-w.s / 2, -w.s / 2, w.s, w.s * 0.75);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-w.s / 2, w.s * 0.25, w.s, w.s * 0.25);
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
      const y = fp.volc && fp.y !== undefined ? fp.y : surfaceAt(fp.x);
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
      drawTurretBody(ctx, rm.x, rm.y, rm.col, { wreck: true, hull: rm.hull, ang: rm.style === 'nuke' ? 12 : 26, tilt, alpha: rm.wreck === 1 ? 0.92 : 0.8, seed: Math.round(rm.x) });
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
      drawTurretBody(ctx, sk.x, sk.y, sk.col, { wreck: true, hull: sk.hull, ang: 30, tilt: 0.06, alpha: clamp(0.95 - sk.t / 14, 0.3, 0.9), seed: Math.round(sk.x) });
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
    // live barrel angle: the aiming seat follows aim.ang, the computer (PvC)
    // follows aiAim; the idle seat keeps its last angle
    if (state === 'aim') {
      if (isHumanSeat(turn)) tanks[turn].dispAng = aim.ang;
      if (GMODE === 1 && turn >= 1) tanks[1].dispAng = aiAim;
    }
    tanks.forEach((t, i) => {
      if (t.dead) return;
      const hpF = 1 - t.hp / TANK_HP;
      const submerged = t.y > waterLevel + 2;
      ctx.save();
      if (submerged) ctx.globalAlpha = 0.65;
      drawTurretBody(ctx, t.x, t.y, t.col, {
        dir: i === 0 ? playerDir() : (tanks[1].x < tanks[0].x ? 1 : -1),
        ang: t.dispAng === undefined ? 45 : t.dispAng,
        hpF, recoil: t.recoil || 0, seed: i * 7 + 3, hull: t.hull
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
    return `rgb(${Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k)},${Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k)},${Math.round((a & 255) * (1 - k) + (a & 255) * k)})`;
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

  // off-screen projectile indicator: a DOM layer ABOVE the HUD bar (the old
  // canvas marks sat at y 24-34 and were covered by the HUD strip)
  function drawOffscreenMarks() {
    const box = overlay.querySelector('.sc-offmark');
    if (!box) return;
    const list = [shot, ...subshots].filter(p => p && !p.dead && p.y < -8);
    if (!list.length) { if (box.childElementCount) box.innerHTML = ''; return; }
    let html = '';
    list.forEach(p => {
      const x = clamp(p.x, 20, Wc - 20) | 0;
      const col = p.w.col || '#fff';
      html += `<span class="sc-om" style="left:${x}px;color:${col}">\u25B2${Math.round(-p.y / 10)}</span>`;
    });
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  function drawWindParts() {
    windParts.forEach(p => {
      const sw = Math.sin(p.ph);
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.kind === 'leaf') {
        ctx.rotate(sw * 0.6);
        ctx.fillStyle = `rgba(140,190,110,${p.a * 0.3})`;
        ctx.beginPath(); ctx.ellipse(0, 0, p.s * 2.2, p.s, sw * 0.5, 0, Math.PI * 2); ctx.fill();
      } else {
        const pc = M().partCol || '130,125,120';
        ctx.fillStyle = `rgba(${pc},${p.a})`;
        ctx.fillRect(-p.s * 0.4, -p.s * 0.4, p.s * 0.8, p.s * 0.8);
      }
      ctx.restore();
    });
  }

  function drawAim() {
    const t = activeTank();
    const dir = activeDir();
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
      ctx.beginPath(); ctx.arc(hit.x, hit.y, ARSENAL[currentCur()].r * 0.4, 0, Math.PI * 2); ctx.stroke();
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
    if (!hudRefs) return;
    const H = hudRefs;
    const w = ARSENAL[currentCur()];
    H.ang.textContent = Math.round(aim.ang);
    H.pow.textContent = Math.round(aim.pow);
    H.wname.textContent = w.name;
    H.ammo.textContent = w.ammo === Infinity ? '∞' : currentInv()[w.key];
    H.ammo.className = 'sc-ammo' + (w.ammo === Infinity ? '' : currentInv()[w.key] <= 1 ? ' critical' : ' limited');
    H.round.textContent = `${round}/${ROUNDS_MAX}`;
    // BOTH fighters' tallies, each digit side in its own fighter colour —
    // the computer's wins and score are counted and shown in PvC too
    H.wins.innerHTML = `<b style="color:${players[0].col}">${wins}</b> : <b style="color:${players[1].col}">${wins2}</b>`;
    H.score.innerHTML = `<b style="color:${players[0].col}">${score}</b> : <b style="color:${players[1].col}">${score2}</b>`;
    const t0 = tanks[0], t1 = tanks[1];
    const shd = (t) => t && t.shield > 0 ? ' <i class="sc-shd"></i>' : '';
    H.you.innerHTML = `${biomeLabel()}&nbsp;&nbsp;<span style="color:${players[0].col}">${esc(players[0].name)}</span> <b>${Math.max(0, Math.round(t0 ? t0.hp : 0))}</b>${shd(t0)}`;
    H.enemy.innerHTML = `<span style="color:${players[1].col}">${esc(players[1].name)}</span> <b>${Math.max(0, Math.round(t1 ? t1.hp : 0))}</b>${shd(t1)}`;
    H.lasthit.textContent = lastHitInfo || '';
    const strength = Math.round(Math.abs(wind));
    const ch = wind < 0 ? '‹' : '›';
    const light = isDayT();
    H.windarrow.textContent = ch.repeat(Math.max(1, strength));
    const wc = w.wind > 0.45 ? (light ? '#a03030' : '#ff6a7a') : w.wind > 0.2 ? (light ? '#9a6a00' : '#f1c40f') : (light ? '#1b3f8f' : '#00d4ff');
    H.windarrow.style.color = wc;
    H.windval.style.color = wc;
    H.windval.textContent = Math.abs(wind).toFixed(1);
    if (H.windlbl) H.windlbl.style.color = light ? 'rgba(20,25,40,0.75)' : 'rgba(139,144,154,0.9)';
    // the round digit wears the ACTIVE fighter's colour; the labels keep
    // the common dim style with a dark outline, readable on any backdrop
    H.round.style.color = players[hudSeat()].col;
    if (powBar) {
      powBar.classList.toggle('show', touchUI && state === 'aim' && isHumanSeat(turn) && !helpOpen && !sliderOpen && !setupOpen && !confirmOpen);
      powVal.textContent = Math.round(aim.pow);
      powRange.value = Math.round(aim.pow);
    }
    if (state === 'aim' && isHumanSeat(turn) && Wc > 420 && turnIntro <= 0) {
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
      .sc-close { position: absolute; right: 10px; top: 10px; z-index: 5; width: 34px; height: 34px; background: var(--panel-light); border: 1px solid var(--pink); color: var(--pink); border-radius: 6px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; font-family: 'Segoe UI Symbol', 'Noto Sans Symbols', 'DejaVu Sans', sans-serif; }
      .sc-close:hover { background: var(--pink); color: var(--bg); }
      .sc-hud { position: absolute; left: 0; right: 0; top: 0; z-index: 4; display: flex; gap: 8px 20px; align-items: center; padding: 8px 56px 8px 14px; font-family: 'Orbitron', monospace; font-size: 22px; color: var(--text-dim); text-shadow: 0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.7); pointer-events: none; flex-wrap: wrap; line-height: 1.3; }
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
      .sc-pvpbtn { pointer-events: auto; cursor: pointer; color: var(--text-dim); border: 1px solid var(--border); border-radius: 6px; padding: 3px 10px; background: rgba(5,7,10,0.7); }
      .sc-pvpbtn:hover { color: var(--accent); border-color: var(--accent); }
      .sc-sym { font-style: normal; font-family: 'Segoe UI Symbol', 'Noto Sans Symbols', 'Noto Sans Symbols 2', 'DejaVu Sans', sans-serif; }
      .sc-offmark { position: absolute; left: 0; right: 0; top: 0; z-index: 5; pointer-events: none; }
      .sc-offmark .sc-om { position: absolute; top: 5px; transform: translateX(-50%); font-family: 'Orbitron', monospace; font-size: 10px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.85); white-space: nowrap; letter-spacing: 0.5px; }
      canvas.sc-cv { display: block; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
      .sc-help { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 6; background: var(--panel); border: 1px solid var(--accent); border-radius: 10px; padding: 20px 24px; max-width: 500px; font-size: 12px; line-height: 1.8; color: var(--text); display: none; max-height: 80vh; overflow-y: auto; }
      .sc-help.show { display: block; }
      .sc-help h4 { color: var(--accent); margin-bottom: 10px; } .sc-help h5 { margin: 12px 0 4px; }
      .sc-help td { padding: 2px 8px; } .sc-help td:first-child { color: var(--accent); font-family: monospace; white-space: nowrap; }
      .sc-helpx { position: absolute; right: 14px; top: 10px; width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text-dim); cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; }
      .sc-helpx:hover { border-color: var(--pink); color: var(--pink); }
      .sc-lives { position: absolute; left: 14px; bottom: 10px; z-index: 4; display: flex; gap: 22px; font-family: 'Orbitron', monospace; font-size: 22px; pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.7); }
      .sc-lives b { font-weight: 700; }
      .sc-lives .sc-shd { display: inline-block; width: 13px; height: 13px; border: 2px solid #4ac0ff; border-radius: 50%; vertical-align: -1px; opacity: 0.85; margin-left: 5px; }
      .sc-windbar { position: absolute; right: 14px; bottom: 12px; z-index: 4; pointer-events: none; display: flex; align-items: center; gap: 10px; font-family: 'Orbitron', monospace; font-size: 28px; color: var(--text-dim); text-shadow: 0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.7); }
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
      .sc-rectab { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; user-select: none; }
      .sc-rectab th { color: var(--accent); border-bottom: 1px solid var(--border); padding: 4px 6px; text-align: left; }
      .sc-rectab td { padding: 6px 6px; border-bottom: 1px solid var(--border); }
      .sc-rectab tr.me td { color: var(--yellow); }
      .sc-rectab tr.me { animation: sc-me 1.2s ease-in-out infinite; }
      .sc-rectab .sc-recpl { display: flex; align-items: center; gap: 8px; }
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
      .sc-setup { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 9; background: var(--panel); border: 2px solid var(--accent); border-radius: 12px; padding: 18px 22px; width: min(640px, 94%); max-height: 88vh; overflow-y: auto; display: none; font-size: 13px; }
      .sc-setup.show { display: block; }
      .sc-setup h3 { color: var(--accent); margin: 0 0 4px; font-size: 17px; letter-spacing: 2px; }
      .sc-setup .sc-setup-sub { color: var(--text-dim); font-size: 11px; margin-bottom: 14px; font-family: 'Orbitron', monospace; letter-spacing: 1px; }
      .sc-setup .sc-mode-row { display: flex; gap: 10px; margin-bottom: 14px; }
      .sc-setup .sc-mode-btn { flex: 1; padding: 9px; border-radius: 8px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text); cursor: pointer; font-size: 15px; text-align: center; }
      .sc-setup .sc-mode-btn .sc-mm { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 44px; }
      .sc-setup .sc-mode-btn .sc-mm b { color: var(--text-dim); font-size: 11px; letter-spacing: 1px; }
      .sc-setup .sc-mode-btn .sc-ic { font-style: normal; font-size: 22px; line-height: 1; font-family: 'Segoe UI Symbol', 'Noto Sans Symbols', 'Noto Sans Symbols 2', 'DejaVu Sans', sans-serif; }
      .sc-setup .sc-mode-btn small { display: block; font-size: 9px; letter-spacing: 1px; margin-top: 4px; color: var(--text-dim); }
      .sc-setup .sc-mode-btn.sel { border-color: var(--accent); color: var(--accent); background: rgba(20,40,60,0.5); box-shadow: 0 0 0 1px var(--accent) inset; }
      .sc-setup .sc-cols { display: flex; gap: 14px; }
      .sc-setup .sc-pl-block { flex: 1; min-width: 0; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: rgba(4,8,14,0.35); }
      .sc-setup .sc-pl-block.locked { opacity: 0.75; }
      .sc-setup .sc-pl-block .sc-pl-err { color: var(--pink); font-size: 10px; min-height: 14px; margin: 2px 0 4px; font-family: 'Orbitron', monospace; }
      .sc-setup .sc-pl-head { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; position: relative; }
      .sc-setup .sc-pl-head label { width: 74px; flex-shrink: 0; color: var(--accent); font-family: 'Orbitron', monospace; font-size: 11px; letter-spacing: 1px; }
      .sc-setup .sc-pl-head input { flex: 1; min-width: 0; padding: 7px 58px 7px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 13px; }
      .sc-setup .sc-pl-head input:disabled { opacity: 0.55; }
      .sc-setup .sc-pl-head input::placeholder { color: var(--text-dim); }
      .sc-setup .sc-pl-block input.sc-name-bad { border-color: var(--pink); }
      .sc-setup .sc-pl-tools { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: flex; gap: 3px; }
      .sc-setup .sc-pl-tools button { width: 22px; height: 22px; border-radius: 5px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text-dim); font-size: 11px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
      .sc-setup .sc-pl-tools button:hover { border-color: var(--accent); color: var(--accent); }
      .sc-setup .sc-pl-tools .sc-t-del:hover { border-color: var(--pink); color: var(--pink); }
      .sc-setup .sc-matrix { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
      .sc-setup .sc-mcell { border: 2px solid var(--border); border-radius: 8px; cursor: pointer; background: rgba(8,12,20,0.5); padding: 0; }
      .sc-setup .sc-mcell:hover { border-color: var(--accent); }
      .sc-setup .sc-mcell.sel { border-color: var(--accent); background: rgba(20,40,60,0.45); box-shadow: 0 0 0 1px var(--accent) inset; }
      .sc-setup .sc-matrix-title { font-size: 9px; color: var(--text-dim); letter-spacing: 1px; font-family: 'Orbitron', monospace; margin-bottom: 4px; }
      .sc-setup .sc-palette { display: flex; gap: 6px; flex-wrap: wrap; }
      .sc-setup .sc-sw { width: 24px; height: 24px; border-radius: 7px; border: 2px solid rgba(0,0,0,0.4); cursor: pointer; padding: 0; }
      .sc-setup .sc-sw.sel { border-color: #fff; box-shadow: 0 0 0 2px var(--accent); }
      .sc-setup .sc-sw.taken { opacity: 0.25; cursor: not-allowed; }
      .sc-setup .sc-suggest { position: absolute; left: 0; right: 0; top: 100%; margin-top: 3px; background: var(--panel); border: 1px solid var(--accent); border-radius: 6px; max-height: 170px; overflow-y: auto; z-index: 3; display: none; box-shadow: 0 6px 18px rgba(0,0,0,0.6); }
      .sc-setup .sc-suggest.show { display: block; }
      .sc-setup .sc-suggest .sc-sug-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; cursor: pointer; color: var(--text); font-size: 12px; border-bottom: 1px solid var(--border); }
      .sc-setup .sc-suggest .sc-sug-item:hover, .sc-setup .sc-suggest .sc-sug-item.hov { background: rgba(20,40,60,0.5); }
      .sc-setup .sc-suggest .sc-sug-item canvas { flex-shrink: 0; }
      .sc-setup .sc-suggest .sc-sug-item .sc-sug-del { margin-left: auto; width: 20px; height: 20px; border-radius: 5px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text-dim); font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; }
      .sc-setup .sc-suggest .sc-sug-item .sc-sug-del:hover { border-color: var(--pink); color: var(--pink); }
      .sc-setup .sc-setup-btns { display: flex; gap: 10px; margin-top: 14px; justify-content: flex-end; }
      .sc-setup .sc-setup-btns button { padding: 10px 18px; border-radius: 7px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text); cursor: pointer; font-size: 18px; }
      .sc-setup .sc-setup-btns .sc-go { border-color: var(--accent); color: var(--accent); font-size: 22px; }
      .sc-setup .sc-setup-btns button:hover { border-color: var(--accent); }
      .sc-hullgal { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
      .sc-hullgal .sc-hg-item { display: flex; flex-direction: column; align-items: center; gap: 3px; }
      .sc-hullgal .sc-hg-item span { font-size: 10px; color: var(--text-dim); }
      .sc-confirm { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 11; background: var(--panel); border: 2px solid var(--pink); border-radius: 10px; padding: 20px 24px; width: min(360px, 90%); display: none; text-align: center; }
      .sc-confirm.show { display: block; }
      .sc-confirm p { color: var(--text); font-size: 13px; margin: 0 0 16px; }
      .sc-confirm .sc-confirm-btns { display: flex; gap: 10px; justify-content: center; }
      .sc-confirm button { padding: 8px 18px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel-light); color: var(--text); cursor: pointer; font-size: 12px; }
      .sc-confirm .sc-yes { border-color: var(--pink); color: var(--pink); }
    `;
//scorch.js part09
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
          <span class="sc-helpbtn" title="Справка">?</span>
          <span class="sc-pvpbtn sc-sym" title="Игроки и режим">&#x2699;&#xFE0E;</span>
          <span>Раунд <b class="sc-round"></b></span>
          <span>Побед <b class="sc-wins"></b></span>
          <span>Счёт <b class="sc-score"></b></span>
          <span class="sc-lasthit"></span>
        </div>
        <div class="sc-windbar"><span class="sc-windarrow"></span><span class="sc-windval"></span><span style="font-size:14px">ветер</span></div>
        <div class="sc-wmenu"></div>
        <div class="sc-offmark"></div>
        <canvas class="sc-cv"></canvas>
        <div class="sc-lives"><span class="sc-you"></span><span class="sc-enemy"></span></div>
        <div class="sc-powbar"><span>СИЛА</span><button class="sc-pb-btn" data-d="-1">−</button><input type="range" min="5" max="100" step="1"><button class="sc-pb-btn" data-d="1">+</button><b class="sc-pv"></b></div>
        <div class="sc-help">
          <button class="sc-helpx" title="Закрыть справку">✕</button>
          <h4>Scorched Earth</h4>
          <table>
            <tr><td>Drag / свайп</td><td>прицел: направление от турели - угол, расстояние - сила (ближе - слабее)</td></tr>
            <tr><td>Клик «Угол» / «Сила»</td><td>ползунок: тянуть ручку; X / клик мимо / Esc - закрыть</td></tr>
            <tr><td>Слайдер снизу (тач)</td><td>точная сила выстрела; кнопки −/+ шаг по 1</td></tr>
            <tr><td>Колесо / ↑↓ / ←→</td><td>сила / угол ствола — свои у каждого игрока; выстрел — только в свой ход</td></tr>
            <tr><td>Space / клик / тап</td><td>огонь (после отсчёта 3-2-1)</td></tr>
            <tr><td>1–9, 0 / W / клик по оружию</td><td>выбор оружия</td></tr>
            <tr><td>Esc / ✕</td><td>закрыть окно (справку, выбор игроков); повтор — выход</td></tr>
            <tr><td>Esc / ☢ / клик мимо</td><td>выход (☢ - всё взрывается; из дуэли — через подтверждение)</td></tr>
          </table>
          <h5>Правила</h5>
          <div style="color:var(--text-dim);font-size:11px">
            5 раундов, боезапас на всю игру. Первый стрелок раунда 1 —
            случайный, дальше раунды чередуются. Карта случая: либо архипелаг -
            море на всю ширину окна и острова (суши ~половина экрана), либо
            материк с озёрами. Утонувшее оседает на дно. На ход даётся 60
            секунд (таймер стоит, пока открыто окно): на 10, 5 и 1 секунде -
            тихий сигнал, по истечении ход пропускается. Обычные ракеты в
            воде просто тонут. Напалм выжигает в земле ямы. Смерть с
            перевесом урона разваливает танк на куски. Лава вулкана жалит
            на 1-3 hp за шарик, у склона турель прикрывает вал с рвом. В
            песке, снегу и ржавых дюнах ветер переносит частицы грунта:
            рельеф мигрирует по ветру. Тройной клик по таблице рекордов
            сбрасывает её и записывает текущий результат (нули не пишутся).
          </div>
          <h5>Дуэль на одном устройстве</h5>
          <div style="color:var(--text-dim);font-size:11px">
            Кнопка «⚙» — режим: против компьютера или двое за одним экраном.
            Угол и сила у каждого игрока свои и восстанавливаются при
            передаче хода. Игроки с именами, цветом и видом турели
            сохраняются отдельно для каждого режима; цвет и вид компьютера
            тоже настраиваются, имя менять нельзя. В дуэли между ходами
            карточка «ХОД ПЕРЕДАН» с отсчётом 3-2-1 даёт время передать
            клавиатуру; как только она исчезла — сразу можно стрелять. Выход
            из начатой дуэли — только через подтверждение (Esc, клик мимо, ☢).
          </div>
          <h5>Миры</h5>
          <div style="color:var(--text-dim);font-size:11px">
            Земные: Холмы, Пустыня, Арктика, Вулкан. Инопланетные: Ксено -
            пурпурная кора с биолюминесцентными спорами под двойной звездой;
            Ржавые дюны - железный песок луны газового гиганта с кольцом
            (приливный ветер гонит дюны); Пепел - серый шлак кратеров,
            сосед-гигант висит в небе. В глубине у всех миров залежи и жилы:
            у вулкана дышат магматические трещины, в арктике мерцают ледяные
            иглы. У холмов и ксено под землёй горючие пласты: взрыв, напалм
            или бур поджигают их - пласт выгорает, а пустота обрушивает
            свод. У рассвета свои розово-золотые тона, у заката -
            оранжево-пурпурные; небо загорается вместе с светилом.
          </div>
          <h5>Как читать мир</h5>
          <div style="color:var(--text-dim);font-size:11px">
            День и ночь по кругу. Digger вгрызается в склон и сверлит по расписанию (счётчик БУР % над буром): заряд на 0.42 экрана суммарного бурения, полёт в воздухе бесплатный. Плазма после попадания живёт колонией клеточного автомата. Сквозь туннели пролетают снаряды, вода затекает и колышется, две трубы в стопку - обвал. Редкое оружие бьет в несколько стадий. Движение грунта не убивает - максимум 30 hp за раунд. У туррелей щит. Вода живёт от музыки: дорожка бликов под светилом — цвет и яркость светила, с учётом облачности.
          </div>
          <h5>Оружие</h5>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:11px">
            <div>1 Missile 38hp ∞</div><div>2 Funky Bomb ×3</div>
            <div>3 Death's Head ×2</div><div>4 Nuke ×1</div>
            <div>5 Plasma ×2</div><div>6 Napalm ×2</div>
            <div>7 Roller ×3</div><div>8 Digger ×3 - сверлит</div>
            <div>9 Dirt Ball ×3 - грунт</div><div>0 MIRV ×2</div>
          </div>
          <h5>Турели</h5>
          <div class="sc-hullgal"></div>
          <h5>Рекорды (топ-10)</h5>
          <div class="sc-rechelp" style="color:var(--text-dim);font-size:11px;line-height:1.7"></div>
        </div>
        <div class="sc-setup">
          <h3>SCORCH ARENA</h3>
          <div class="sc-setup-sub">SELECT YOUR FIGHTER</div>
          <div class="sc-mode-row">
            <button class="sc-mode-btn" data-m="1" title="1 игрок против компьютера"><span class="sc-mm"></span><small>ПРОТИВ КОМПЬЮТЕРА</small></button>
            <button class="sc-mode-btn" data-m="2" title="Дуэль на одном устройстве"><span class="sc-mm"></span><small>ДУЭЛЬ НА ОДНОМ ЭКРАНЕ</small></button>
          </div>
          <div class="sc-cols">
            <div class="sc-pl-block" data-p="0"></div>
            <div class="sc-pl-block" data-p="1"></div>
          </div>
          <div class="sc-setup-btns">
            <button class="sc-set-cancel" title="Отмена">✕</button>
            <button class="sc-go sc-sym" title="В бой!">&#x25B6;</button>
          </div>
        </div>
        <div class="sc-confirm">
          <p>Дуэль не окончена. Сдаться и выйти?</p>
          <div class="sc-confirm-btns">
            <button class="sc-no">Продолжить</button>
            <button class="sc-yes">Выйти</button>
          </div>
        </div>
        <div class="sc-over">
          <h3 class="sc-over-title"></h3>
          <div class="sc-over-res"></div>
          <table class="sc-rectab"></table>
          <button class="sc-again sc-sym" title="Новая игра">&#x21BB; Заново</button><button class="sc-over-close">Закрыть</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    cv = overlay.querySelector('canvas.sc-cv');
    ctx = cv.getContext('2d');
    powBar = overlay.querySelector('.sc-powbar');
    powRange = powBar.querySelector('input');
    powVal = powBar.querySelector('.sc-pv');
    hudRefs = {
      ang: $('.sc-ang'), pow: $('.sc-pow'), wname: $('.sc-wname'), ammo: $('.sc-ammo'),
      round: $('.sc-round'), wins: $('.sc-wins'), score: $('.sc-score'),
      you: $('.sc-you'), enemy: $('.sc-enemy'), lasthit: $('.sc-lasthit'),
      windarrow: $('.sc-windarrow'), windval: $('.sc-windval'), windlbl: overlay.querySelector('.sc-windbar span:last-child')
    };
    touchUI = !!(window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window));
    // hull gallery in help
    const gal = overlay.querySelector('.sc-hullgal');
    HULLS.forEach(h => {
      const it = document.createElement('div');
      it.className = 'sc-hg-item';
      const c3 = document.createElement('canvas');
      c3.width = 52; c3.height = 52;
      drawMiniTurret(c3.getContext('2d'), 52, '#8fa6c4', h.key);
      it.appendChild(c3);
      const lb = document.createElement('span');
      lb.textContent = h.name;
      it.appendChild(lb);
      gal.appendChild(it);
    });
    powBar.addEventListener('pointerdown', (e) => e.stopPropagation());
    powRange.addEventListener('input', () => { aim.pow = clamp(+powRange.value, 5, 100); draw(); });
    overlay.querySelectorAll('.sc-pb-btn').forEach(b => {
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state === 'over' || state === 'closing') return;
        aim.pow = clamp(aim.pow + (+b.dataset.d), 5, 100);
        draw();
      });
    });
    const helpEl = overlay.querySelector('.sc-help');
    const wmenu = overlay.querySelector('.sc-wmenu');
    const setupEl = overlay.querySelector('.sc-setup');
    const confirmEl = overlay.querySelector('.sc-confirm');
    const refreshHelpRecs = () => {
      const rh = helpEl.querySelector('.sc-rechelp');
      rh.innerHTML = '';
      const recs = records().slice(0, MAX_REC);
      if (!recs.length) { rh.textContent = 'рекордов пока нет'; return; }
      recs.forEach((r, i) => {
        const row = document.createElement('div');
        row.textContent = `${i + 1}. ${r.pname || 'Player1'} — ${r.score} очк. — побед: ${r.wins || 0} — ${r.date}`;
        rh.appendChild(row);
      });
    };
    const closeHelp = () => { helpEl.classList.remove('show'); helpOpen = false; };
    const closeSetup = () => { setupEl.classList.remove('show'); setupOpen = false; };
    const closeConfirm = () => { confirmEl.classList.remove('show'); confirmOpen = false; };
    $('.sc-helpbtn').onclick = (e) => {
      e.stopPropagation();
      const willOpen = !helpEl.classList.contains('show');
      closeSetup(); closeConfirm();
      helpEl.classList.toggle('show', willOpen);
      helpOpen = willOpen;
      if (willOpen) refreshHelpRecs();
    };
    overlay.querySelector('.sc-helpx').onclick = (e) => { e.stopPropagation(); closeHelp(); };
    helpEl.onclick = (e) => e.stopPropagation();
    $('.sc-again').onclick = (e) => { e.stopPropagation(); $('.sc-over').classList.remove('show'); start(); };
    $('.sc-over-close').onclick = (e) => { e.stopPropagation(); $('.sc-over').classList.remove('show'); close(false); };
    $('.sc-wpn').onclick = (e) => { e.stopPropagation(); renderWeaponMenu(); wmenu.classList.toggle('show'); };
    wmenu.onclick = (e) => e.stopPropagation();
    // hidden reset: TRIPLE click/tap the record table — wipes LS and
    // re-seeds it with the CURRENT run's results (zero results are skipped
    // by saveRec, so nothing phantom is left behind)
    let recClickN = 0, recClickT = 0;
    $('.sc-rectab').addEventListener('click', (e) => {
      e.stopPropagation();
      const now = Date.now();
      if (now - recClickT > 900) recClickN = 0;
      recClickT = now;
      if (++recClickN < 3) return;
      recClickN = 0;
      try { localStorage.removeItem(LS_KEY); } catch (e2) {}
      saveRec(players[0], score, wins);
      if (GMODE === 2) saveRec(players[1], score2, wins2);
      renderRecords(0);
      refreshHelpRecs();
    });
    // ============ MK-style setup, two side-by-side columns ============
    // picked[pi] = the profile row currently loaded/typed in column pi —
    // the ✕ button deletes exactly THAT fighter, never a namesake or the
    // other column's pick
    const setup = { mode: GMODE, blocks: [null, null], draft: [null, null], sug: [null, null], picked: [null, null] };
    // per-mode drafts: the LAST SAVED pair for that exact mode — switching
    // PvP↔PvC loads each side's own config, the PC's look never leaks from
    // PvP player 2; with nothing saved yet, sensible first-launch defaults
    const draftForMode = (mode) => {
      const c = lastCfg()[mode];
      const d0 = c && c.p0 ? { name: c.p0.name, col: c.p0.col, hull: c.p0.hull } : { name: 'Player1', col: '#2ecc71', hull: 'classic' };
      let d1;
      if (mode === 1) d1 = { name: 'GLM', col: c && c.p1 ? c.p1.col : '#ff4757', hull: c && c.p1 ? c.p1.hull : 'classic' };
      else d1 = c && c.p1 ? { name: c.p1.name, col: c.p1.col, hull: c.p1.hull } : { name: 'Player2', col: '#3498db', hull: 'classic' };
      return [d0, d1];
    };
    // mode icons: plain-text glyphs (☺ U+263A player, ⚙ U+2699+FE0E computer)
    // — early-unicode symbols present in Segoe UI Symbol / DejaVu / Noto,
    // so they never render as tofu boxes
    const renderModeIcons = () => {
      overlay.querySelectorAll('.sc-mode-btn').forEach(b => {
        const holder = b.querySelector('.sc-mm');
        if (!holder) return;
        holder.innerHTML = +b.dataset.m === 1
          ? '<i class="sc-ic">\u263A</i><b>VS</b><i class="sc-ic">\u2699\uFE0E</i>'
          : '<i class="sc-ic">\u263A</i><b>VS</b><i class="sc-ic">\u263A</i>';
      });
    };
    // per-column suggestion list (datalist can't be styled). Each column has
    // its own dropdown; opening one closes the other. GLM is the computer's
    // reserved name and is NEVER offered for selection
    const getSuggestions = (pi, showAll) => {
      const ps = profiles().filter(pr => pr.name !== 'GLM');
      const nm = (setup.draft[pi].name || '').trim().toLowerCase();
      if (showAll || !nm) return ps;
      return ps.filter(pr => pr.name.toLowerCase().indexOf(nm) === 0);
    };
    const closeSuggest = (pi) => { if (setup.sug[pi]) { setup.sug[pi].classList.remove('show'); } };
    // delete a saved fighter: exact name match (case-insensitive) against
    // the stored row; unrelated fighters and the other column are untouched
    const removeProfile = (pi, name, reopen) => {
      const nm = (name || '').trim();
      if (nm) saveProfiles(profiles().filter(q => q.name.toLowerCase() !== nm.toLowerCase()));
      if (nm && (setup.draft[pi].name || '').trim().toLowerCase() === nm.toLowerCase()) {
        setup.draft[pi].name = '';
        setup.picked[pi] = null;
        const inp = setup.blocks[pi] && setup.blocks[pi].querySelector('input');
        if (inp) inp.value = '';
      }
      renderSetupBlocks();
      if (reopen) renderSuggest(pi, true); else closeSuggest(pi);
    };
    const renderSuggest = (pi, showAll) => {
      const blk = setup.blocks[pi];
      if (!blk) return;
      closeSuggest(1 - pi);
      let sug = setup.sug[pi];
      if (!sug) {
        sug = document.createElement('div');
        sug.className = 'sc-suggest';
        blk.querySelector('.sc-pl-head').appendChild(sug);
        setup.sug[pi] = sug;
      }
      sug.innerHTML = '';
      const list = getSuggestions(pi, showAll).slice(0, 6);
      if (!list.length) { sug.classList.remove('show'); return; }
      list.forEach(pr => {
        const si = document.createElement('div');
        si.className = 'sc-sug-item';
        const cc = document.createElement('canvas');
        cc.width = 26; cc.height = 26;
        drawMiniTurret(cc.getContext('2d'), 26, pr.col, pr.hull);
        si.appendChild(cc);
        const nm = document.createElement('span');
        nm.textContent = pr.name;
        si.appendChild(nm);
        const del = document.createElement('button');
        del.className = 'sc-sug-del';
        del.title = 'Удалить бойца';
        del.textContent = '✕';
        del.onmousedown = (ev) => { ev.preventDefault(); ev.stopPropagation(); removeProfile(pi, pr.name, true); };
        del.onclick = (ev) => ev.stopPropagation();
        si.appendChild(del);
        si.onmousedown = (ev) => { ev.preventDefault(); ev.stopPropagation(); loadProfile(pi, pr); };
        sug.appendChild(si);
      });
      sug.classList.add('show');
    };
    const loadProfile = (pi, pr) => {
      setup.draft[pi].name = pr.name;
      setup.draft[pi].col = pr.col;
      setup.draft[pi].hull = pr.hull;
      setup.picked[pi] = pr.name;
      closeSuggest(pi);
      renderSetupBlocks();
    };
    // changing colour/hull under an EXISTING name edits that fighter's
    // saved profile right away (upsert)
    const upsertProfileNow = (pi) => {
      const d = setup.draft[pi];
      const nm = (d.name || '').trim();
      if (!nm || (pi === 1 && setup.mode === 1) || nm.toLowerCase() === 'glm') return;
      const ps = profiles();
      const i = ps.findIndex(pr => pr.name.toLowerCase() === nm.toLowerCase());
      if (i < 0) return; // a NEW fighter is stored when the battle starts
      ps[i] = { name: nm, col: d.col, hull: d.hull };
      saveProfiles(ps);
    };
    const checkName = (pi) => {
      const blk = setup.blocks[pi];
      if (!blk) return true;
      const inp = blk.querySelector('input');
      const err = blk.querySelector('.sc-pl-err');
      const nm = (setup.draft[pi].name || '').trim();
      let bad = '';
      if (nm && (setup.draft[1 - pi].name || '').trim().toLowerCase() === nm.toLowerCase()) bad = 'ИМЯ ЗАНЯТО СОПЕРНИКОМ';
      else if (pi === 0 && setup.mode === 2 && nm.toLowerCase() === 'glm') bad = 'ИМЯ ЗАНЯТО КОМПЬЮТЕРОМ';
      err.textContent = bad;
      if (inp) inp.classList.toggle('sc-name-bad', !!bad);
      return !bad;
    };
    const renderSetupBlocks = () => {
      setup.blocks.forEach((blk, pi) => {
        if (!blk) return;
        const p = setup.draft[pi];
        const locked = pi === 1 && setup.mode === 1;
        blk.classList.toggle('locked', locked);
        const input = blk.querySelector('input');
        if (input && input !== document.activeElement) input.value = p.name;
        const tools = blk.querySelector('.sc-pl-tools');
        if (tools) tools.style.display = locked ? 'none' : 'flex';
        blk.querySelectorAll('.sc-mcell').forEach((mc, i) => {
          mc.classList.toggle('sel', HULLS[i].key === p.hull);
          drawMiniTurret(mc.getContext('2d'), 52, setup.draft[pi].col, HULLS[i].key);
        });
        blk.querySelectorAll('.sc-sw').forEach((sw, i) => {
          sw.classList.toggle('sel', HULL_COLORS[i] === p.col);
          sw.classList.toggle('taken', setup.draft[1 - pi].col === HULL_COLORS[i]);
        });
        checkName(pi);
      });
      overlay.querySelectorAll('.sc-mode-btn').forEach(b => {
        b.classList.toggle('sel', +b.dataset.m === setup.mode);
      });
      renderModeIcons();
    };
    const buildBlock = (pi) => {
      const blk = setup.blocks[pi];
      blk.innerHTML = '';
      const head = document.createElement('div');
      head.className = 'sc-pl-head';
      const lbl = document.createElement('label');
      lbl.textContent = pi === 0 ? 'ИГРОК 1' : (setup.mode === 2 ? 'ИГРОК 2' : 'КОМПЬЮТЕР');
      head.appendChild(lbl);
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 14;
      input.value = setup.draft[pi].name;
      input.setAttribute('autocomplete', 'off');
      input.disabled = pi === 1 && setup.mode === 1;
      input.oninput = () => {
        setup.draft[pi].name = input.value;
        // typing an existing fighter's name loads their look and marks the
        // row as picked; a foreign name clears the pick
        const nmv = input.value.trim();
        if (nmv && !(pi === 1 && setup.mode === 1)) {
          const m = profiles().find(pr => pr.name.toLowerCase() === nmv.toLowerCase());
          setup.picked[pi] = m ? m.name : null;
          if (m) { setup.draft[pi].col = m.col; setup.draft[pi].hull = m.hull; }
        } else setup.picked[pi] = null;
        renderSetupBlocks();
        renderSuggest(pi);
      };
      input.onfocus = () => renderSuggest(pi);
      input.onblur = () => setTimeout(() => closeSuggest(pi), 150);
      head.appendChild(input);
      // ✕ deletes the PICKED fighter (the profile row this column loaded or
      // typed to a match); ▾ toggles this column's own saved-fighters list,
      // open even when a name is already typed
      const tools = document.createElement('span');
      tools.className = 'sc-pl-tools';
      const del = document.createElement('button');
      del.className = 'sc-t-del';
      del.textContent = '✕';
      del.title = 'Удалить выбранного бойца';
      del.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
      del.onclick = (e) => {
        e.stopPropagation();
        removeProfile(pi, setup.picked[pi] || setup.draft[pi].name, false);
      };
      tools.appendChild(del);
      const dd = document.createElement('button');
      dd.className = 'sc-t-dd';
      dd.textContent = '▾';
      dd.title = 'Сохранённые бойцы';
      dd.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
      dd.onclick = (e) => {
        e.stopPropagation();
        const open = setup.sug[pi] && setup.sug[pi].classList.contains('show');
        closeSuggest(0); closeSuggest(1);
        if (!open) renderSuggest(pi, true);
      };
      tools.appendChild(dd);
      head.appendChild(tools);
      blk.appendChild(head);
      const err = document.createElement('div');
      err.className = 'sc-pl-err';
      blk.appendChild(err);
      const mtt = document.createElement('div');
      mtt.className = 'sc-matrix-title';
      mtt.textContent = 'КОРПУС';
      blk.appendChild(mtt);
      const mtx = document.createElement('div');
      mtx.className = 'sc-matrix';
      HULLS.forEach(h => {
        const mc = document.createElement('canvas');
        mc.width = 52; mc.height = 52;
        mc.className = 'sc-mcell';
        mc.title = h.name;
        drawMiniTurret(mc.getContext('2d'), 52, setup.draft[pi].col, h.key);
        // hull & colour are selectable for the COMPUTER too — only its
        // NAME stays locked
        mc.onclick = () => { setup.draft[pi].hull = h.key; upsertProfileNow(pi); renderSetupBlocks(); };
        mtx.appendChild(mc);
      });
      blk.appendChild(mtx);
      const pal = document.createElement('div');
      pal.className = 'sc-palette';
      HULL_COLORS.forEach(cc => {
        const sw = document.createElement('button');
        sw.className = 'sc-sw';
        sw.style.background = cc;
        sw.onclick = () => {
          if (setup.draft[1 - pi].col === cc) return;
          setup.draft[pi].col = cc;
          upsertProfileNow(pi);
          renderSetupBlocks();
        };
        pal.appendChild(sw);
      });
      blk.appendChild(pal);
      setup.sug[pi] = null;
    };
    overlay.querySelectorAll('.sc-mode-btn').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        setup.mode = +b.dataset.m;
        // load THAT mode's own saved pair — no look leaks between modes
        setup.draft = draftForMode(setup.mode);
        setup.picked = [null, null];
        buildBlock(0);
        buildBlock(1);
        renderSetupBlocks();
      };
    });
    const openSetup = () => {
      setup.mode = GMODE;
      setup.draft = draftForMode(setup.mode);
      setup.picked = [null, null];
      setup.blocks = [overlay.querySelector('.sc-pl-block[data-p="0"]'), overlay.querySelector('.sc-pl-block[data-p="1"]')];
      buildBlock(0);
      buildBlock(1);
      closeHelp(); closeConfirm();
      renderSetupBlocks();
      setupEl.classList.add('show');
      setupOpen = true;
    };
    $('.sc-pvpbtn').onclick = (e) => { e.stopPropagation(); openSetup(); };
    $('.sc-set-cancel').onclick = (e) => { e.stopPropagation(); closeSetup(); };
    $('.sc-go').onclick = (e) => {
      e.stopPropagation();
      if (!checkName(0) || !checkName(1)) { beep(220, 0.12, 0.2); return; }
      GMODE = setup.mode;
      players[0] = { name: setup.draft[0].name.trim() || 'Player1', col: setup.draft[0].col, hull: setup.draft[0].hull, ai: false };
      players[1] = setup.mode === 1
        ? { name: 'GLM', col: setup.draft[1].col, hull: setup.draft[1].hull, ai: true }
        : { name: setup.draft[1].name.trim() || 'Player2', col: setup.draft[1].col, hull: setup.draft[1].hull, ai: false };
      if (players[1].col === players[0].col) {
        const ci = HULL_COLORS.indexOf(players[0].col);
        players[1].col = HULL_COLORS[(ci + 1) % HULL_COLORS.length];
      }
      // remember this exact pair for this mode — restored on next open
      // and when switching modes in setup
      saveLastCfg(setup.mode, players[0], players[1]);
      // profile store: upsert — but the placeholder names Player1/Player2
      // are ONLY stored if they already exist (first-launch defaults never
      // spawn new profile rows to delete later)
      const ps = profiles();
      const known = ps.map(q => q.name.toLowerCase());
      [players[0]].concat(setup.mode === 2 ? [players[1]] : []).forEach(pl => {
        if ((pl.name === 'Player1' || pl.name === 'Player2') && known.indexOf(pl.name.toLowerCase()) < 0) return;
        const i = ps.findIndex(pr => pr.name.toLowerCase() === pl.name.toLowerCase());
        if (i >= 0) ps[i] = { name: pl.name, col: pl.col, hull: pl.hull };
        else ps.push({ name: pl.name, col: pl.col, hull: pl.hull });
      });
      saveProfiles(ps);
      closeSetup();
      start();
    };
    // ============ exit confirmation — every exit route in pvp ============
    const requestExit = (boom) => {
      if (!boom && GMODE === 2 && confirmClose && state !== 'over') {
        confirmEl.classList.add('show');
        confirmOpen = true;
        return;
      }
      close(boom);
    };
    $('.sc-no').onclick = (e) => { e.stopPropagation(); closeConfirm(); };
    $('.sc-yes').onclick = (e) => { e.stopPropagation(); closeConfirm(); close(false); };
    overlay.querySelectorAll('.sc-aimctl').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state !== 'aim' || helpOpen) return;
        sliderOpen = el.dataset.k;
        draw();
      });
    });
    document.addEventListener('click', () => wmenu.classList.remove('show'));

    window.addEventListener('resize', resize);
    cv.addEventListener('pointerdown', (e) => {
      if (setupOpen || confirmOpen) return;
      if (helpOpen) { closeHelp(); return; }
      if (wmenu.classList.contains('show')) { wmenu.classList.remove('show'); return; }
      const p = ptrPos(e);
      if (sliderOpen) {
        if (inRect(p, sliderGeom && sliderGeom.close)) { closeSlider(); return; }
        if (inRect(p, sliderGeom && sliderGeom.body) && Math.abs(p.y - sliderGeom.ty) < 26) { sliderDrag = true; try { cv.setPointerCapture(e.pointerId); } catch {} applySliderVal(p.x); return; }
        if (inRect(p, sliderGeom && sliderGeom.body)) return;
        closeSlider();
        return;
      }
      if (state === 'over' || state === 'closing') return;
      if (state !== 'aim' || !isHumanSeat(turn)) return;
      drag = { x: p.x, y: p.y, moved: false };
      try { cv.setPointerCapture(e.pointerId); } catch {}
    });
    cv.addEventListener('pointermove', (e) => {
      const p = ptrPos(e);
      if (sliderDrag) { applySliderVal(p.x); return; }
      if (!drag) return;
      if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) > 5) drag.moved = true;
      if (drag.moved) { drag.x = p.x; drag.y = p.y; updateAimFromPointer(p); }
    });
    cv.addEventListener('pointerup', () => {
      if (drag && !drag.moved && state === 'aim' && isHumanSeat(turn) && turnIntro <= 0) {
        if (turn === 0) fire();
        else if (GMODE === 2) fire2();
      }
      drag = null; sliderDrag = false;
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (state !== 'aim' || !isHumanSeat(turn)) return;
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
    overlay.addEventListener('click', (e) => { if (e.target === overlay) requestExit(false); });
    overlay.querySelector('.sc-close').onclick = () => requestExit(true);
  }

  function renderWeaponMenu() {
    const wmenu = overlay.querySelector('.sc-wmenu');
    const chip = overlay.querySelector('.sc-wpn');
    const wrap = overlay.querySelector('.sc-wrap');
    const cr = chip.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    wmenu.style.left = Math.max(4, cr.left - wr.left) + 'px';
    wmenu.style.top = (cr.bottom - wr.top + 4) + 'px';
    wmenu.innerHTML = '';
    const inv = currentInv();
    const ccur = currentCur();
    ARSENAL.forEach((w, i) => {
      const has = inv[w.key] > 0 || w.ammo === Infinity;
      const item = document.createElement('div');
      item.className = 'sc-witem' + (i === ccur ? ' sel' : '') + (has ? '' : ' noammo');
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
      cnt.textContent = w.ammo === Infinity ? '∞' : inv[w.key];
      item.appendChild(cnt);
      item.onclick = (e) => { e.stopPropagation(); if (!has) return; setCurrentCur(i); wmenu.classList.remove('show'); draw(); };
      wmenu.appendChild(item);
    });
  }

  function rescaleWorld(oW, oH) {
    const kx = Wc / oW, ky = Hc / oH;
    const N = NCOL();
    const step = Wc / N;
    const nc = [];
    for (let i = 0; i < N; i++) {
      const oi = clamp(Math.round((i * step / kx) / cols.step), 0, cols.length - 1);
      const c = cols[oi];
      nc.push({
        top: c.top * ky, surf: c.surf, burn: c.burn, melt: c.melt,
        h0: c.h1 > 0 ? c.h0 * ky : 0, h1: c.h1 > 0 ? c.h1 * ky : 0, sid: c.sid
      });
    }
    nc.step = step;
    cols = nc;
    waterLevel *= ky;
    waterH = null;
    ripples = [];
    tanks.forEach(t => { t.x = clamp(t.x * kx, 20, Wc - 20); t.y *= ky; });
    remains.forEach(rm => { rm.x *= kx; rm.y *= ky; });
    sinkers.forEach(sk => { sk.x *= kx; sk.y *= ky; });
    wreckBits.forEach(w => { w.x *= kx; w.y *= ky; });
    pockets.forEach(pk => { pk.x0 *= kx; pk.x1 *= kx; pk.y0 *= ky; pk.y1 *= ky; });
    if (state === 'fly') { shot = null; subshots = []; endTurn(); }
    else { shot = null; subshots = []; }
    liquids = []; debris = []; windParts = []; grains = []; lavaBits = [];
    if (volcano) {
      volcano.x *= kx; volcano.y *= ky;
      volcano.r *= Math.sqrt(kx * ky);
      volcano.coneBot *= ky;
      volcano.extra = [];
      volcScan();
    }
    groundPat = null;
    buildGroundTex();
    dirtyA = 0; dirtyB = N - 1;
  }

  function resize() {
    if (!overlay) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) { setTimeout(resize, 60); return; }
    const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const oW = Wc, oH = Hc;
    Wc = r.width; Hc = r.height;
    if (cols && oW) rescaleWorld(oW, oH);
    if (cols) draw();
  }

  function keyH(e) {
    if (!overlay || !overlay.classList.contains('show')) return;
    if (e.key === 'Escape') {
      // Esc unwinds ONE modal at a time: weapon menu → confirm → setup →
      // slider → help, and only then considers leaving the game
      const wmenu = overlay.querySelector('.sc-wmenu');
      if (wmenu.classList.contains('show')) { wmenu.classList.remove('show'); return; }
      if (confirmOpen) { overlay.querySelector('.sc-confirm').classList.remove('show'); confirmOpen = false; return; }
      if (setupOpen) { overlay.querySelector('.sc-setup').classList.remove('show'); setupOpen = false; return; }
      if (sliderOpen) { closeSlider(); return; }
      if (helpOpen) { overlay.querySelector('.sc-help').classList.remove('show'); helpOpen = false; return; }
      if ($('.sc-over').classList.contains('show')) { $('.sc-over').classList.remove('show'); close(false); return; }
      // pvp in progress → confirmation, otherwise straight out
      if (GMODE === 2 && confirmClose && state !== 'over') { overlay.querySelector('.sc-confirm').classList.add('show'); confirmOpen = true; return; }
      close(false);
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      if (state !== 'aim' || !isHumanSeat(turn)) return;
      const idx = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
      const inv = currentInv();
      if (idx < ARSENAL.length && (inv[ARSENAL[idx].key] > 0 || ARSENAL[idx].ammo === Infinity)) { setCurrentCur(idx); overlay.querySelector('.sc-wmenu').classList.remove('show'); draw(); }
      return;
    }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','w','W','ц','Ц'].includes(e.key)) e.preventDefault();
    if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') { nextWeapon(); return; }
    if (state !== 'aim' || !isHumanSeat(turn)) return;
    // aiming is always live; firing and the trajectory are own-turn only.
    // Left arrow = counterclockwise on screen regardless of barrel side:
    // with the barrel to the right raising elevation is CCW, to the left it is CW
    const ccw = activeDir();
    if (e.key === 'ArrowLeft') aim.ang = clamp(aim.ang + ccw, 5, 85);
    if (e.key === 'ArrowRight') aim.ang = clamp(aim.ang - ccw, 5, 85);
    if (e.key === 'ArrowUp') aim.pow = clamp(aim.pow + 1, 10, 100);
    if (e.key === 'ArrowDown') aim.pow = clamp(aim.pow - 1, 10, 100);
    if (e.key === ' ') {
      if (turnIntro > 0) return;
      if (turn === 0) fire();
      else if (GMODE === 2) fire2();
      return;
    }
    if (e.key.startsWith('Arrow')) draw();
  }
  function nextWeapon() {
    const inv = currentInv();
    for (let i = 1; i <= ARSENAL.length; i++) {
      const idx = (currentCur() + i) % ARSENAL.length;
      if (inv[ARSENAL[idx].key] > 0 || ARSENAL[idx].ammo === Infinity) { setCurrentCur(idx); draw(); return; }
    }
    setCurrentCur(0); draw();
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