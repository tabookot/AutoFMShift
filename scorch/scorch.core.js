//scorch.core.js
// ВНИМАНИЕ: файл НЕ завёрнут в IIFE — три classic-скрипта делят общий
// верхний уровень; порядок подключения строго core → world → ui
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
const TURN_INTRO = 3;
// LAST STAND: hp 0 during the fighter's OWN aim turn opens a short dying
// window with ONE final shot; canAct/canHurt gate every damage/fire path
const LAST_STAND = 2.6;
// BARREL ARC: 220° sweep, the straight-down sector excluded
const AIM_MIN = -20, AIM_MAX = 200;
// liquid-lava timings (seconds on the column clock)
const LAVA_MELT = 6, LAVA_COOL = 17;
const LAVA_FILL = 2.4, LAVA_FILL_WET = 5.2, LAVA_BURN = 0.55;
// UNDERGROUND: cave levels spawn only on vegetation-free biomes; the
// cave-capable ones are 70% of the pool and the roll there is 43%, which
// is ~30% of ALL rounds. Ceiling / light / vent data lives in ceil,
// caveLights and caveVents (see genTerrain)
const CAVE_BIOMES = ['desert', 'arctic', 'volcanic', 'rust', 'ashen'];
const CRYSTAL_COLS = ['110,225,255', '185,140,255', '255,214,120', '140,255,190'];
// fossil-seam palette for the CAVE levels — their biomes carry no `fuel`
// of their own, so the underground rounds use this shared look
const CAVE_FUEL = { col: '34,24,16', spark: '255,180,90' };
// 1 = lakes, 2 = full-width sea with islands
let WATER_MODE = 1;
// 1 = player vs computer, 2 = two players hot-seat
let GMODE = 1;

const ARSENAL = [
  { key: 'MISSILE',  name: 'Missile',       r: 30, type: 'missile',  ammo: Infinity, col: '#d8d8d8', dmg: 36, wind: 0.35, shape: 'rocket',   water: 'sink' },
  { key: 'FUNKY',    name: 'Funky Bomb',    r: 40, type: 'funky',    ammo: 3,  col: '#9a8ac8', dmg: 24, wind: 0.3,  shape: 'cluster',  water: 'surface' },
  { key: 'DEATH',    name: "Death's Head",  r: 62, type: 'death',    ammo: 2,  col: '#e8c14a', dmg: 80, wind: 0.15, shape: 'bomb',     water: 'bottom' },
  { key: 'NUKE',     name: 'Nuke',          r: 78, type: 'nuke',     ammo: 1,  col: '#ffd23f', dmg: 105, wind: 0.12, shape: 'bomb',    water: 'surface' },
  { key: 'PLASMA',   name: 'Plasma',        r: 48, type: 'plasma',   ammo: 2,  col: '#d06050', dmg: 32, wind: 0.2,  shape: 'mirv',     water: 'fizzle' },
  { key: 'NAPALM',   name: 'Napalm',        r: 50, type: 'napalm',   ammo: 2,  col: '#d85a18', dmg: 10, wind: 0.55, shape: 'canister', water: 'fizzle' },
  { key: 'ROLLER',   name: 'Roller',        r: 34, type: 'roller',   ammo: 3,  col: '#5aa8a0', dmg: 56, wind: 0.05, shape: 'ball',     water: 'sink' },
  { key: 'DIGGER',   name: 'Digger',        r: 56, type: 'digger',   ammo: 3,  col: '#8a6a3a', dmg: 0,  wind: 0.2,  shape: 'drill',    water: 'sink' },
  { key: 'DIRT',     name: 'Dirt Ball',     r: 70, type: 'dirt',     ammo: 3,  col: '#cbb490', dmg: 0,  wind: 0.3,  shape: 'ball',     water: 'sink' },
  { key: 'MIRV',     name: 'MIRV',          r: 34, type: 'mirv',     ammo: 2,  col: '#c05a4a', dmg: 30, wind: 0.25, shape: 'mirv', subs: 5, water: 'surface' }
];
const TERRAIN_WEAPONS = ['digger', 'dirt'];
const isTerr = (t) => TERRAIN_WEAPONS.includes(t);
// per-weapon blast accents: tint the layered explosion fx
const BLAST_COL = {
  missile: '255,190,110', funky: '185,165,255', death: '255,214,90', nuke: '255,244,214',
  napalm: '255,150,60', roller: '140,235,215', plasma: '255,110,80',
  digger: '235,205,150', dirt: '235,215,175', mirv: '230,150,130'
};

// earth biomes plus three off-world ones
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
// the volcano is REUSED on three worlds — only the lava palette differs
const VOLC_BIOMES = ['volcanic', 'xeno', 'ashen'];
const LAVA_STYLES = {
  volcanic: { core: '255,235,160', hot: '255,110,30',  deep: '210,55,10',  glow: '255,150,50' },
  xeno:     { core: '220,255,250', hot: '70,240,225',  deep: '15,130,120', glow: '90,250,235' },
  ashen:    { core: '255,245,235', hot: '225,120,255', deep: '120,35,150', glow: '220,130,255' }
};

const TOD = {
  day:    { stops: ['#7ab3d8', '#a8cde6', '#d8e8f0'], sun: '#fff6d8', sunHalo: 'rgba(255,246,216,0.35)', stars: false, clouds: 0.55, haze: 'rgba(220,235,245,0.25)' },
  sunset: { stops: ['#2a2a55', '#7a4a78', '#d88a4a', '#f0b060'], sun: '#ffd9a0', sunHalo: 'rgba(255,150,80,0.4)', stars: 'dim', clouds: 0.4, haze: 'rgba(240,170,110,0.3)' },
  dawn:   { stops: ['#10102e', '#2e2450', '#8e4a62', '#f2a06a'], sun: '#ffd0a0', sunHalo: 'rgba(255,170,120,0.4)', stars: 'dim', clouds: 0.4, haze: 'rgba(235,180,150,0.28)' },
  night:  { stops: ['#060a18', '#0c1526', '#1a2a44'], sun: '#e8ecf2', sunHalo: 'rgba(200,215,235,0.2)', stars: true, clouds: 0.12, haze: 'rgba(40,60,100,0.25)' }
};
const TOD_KEYS = [
  { p: 0.00, k: 'dawn' }, { p: 0.07, k: 'day' }, { p: 0.36, k: 'day' }, { p: 0.46, k: 'sunset' },
  { p: 0.55, k: 'night' }, { p: 0.90, k: 'night' }, { p: 0.965, k: 'dawn' }, { p: 1.00, k: 'dawn' }
];
// canonical round-end phrases (Scorch / MK heritage), {N} splices the name
const BANNERS = {
  win: ['FATALITY!', '{N} WINS!', 'FLAWLESS VICTORY!', 'VICTORY!', 'WINNER!', 'MISSION ACCOMPLISHED', 'CONGRATULATIONS, {N}!', 'PERFECT!', 'CHAMPION!', '{N} IS THE WINNER', 'TOTAL VICTORY', 'ANNIHILATION', 'HUMILIATION', 'GAME WON', 'VICTORY IS {N}\'S', 'MISSION COMPLETE', '{N} HAS WON', 'ПОБЕДА, {N}!'],
  lose: ['ПОТРАЧЕНО, {N}!', '{N} WASTED', 'YOU DIED, {N}', 'GAME OVER', 'DEFEAT', 'YOU LOSE', 'MISSION FAILED', 'BUSTED, {N}', 'YOU ARE DEAD', '{N} FRAGGED', 'YOU HAVE BEEN DEFEATED', 'GAME LOST', '{N} LOSES', 'TRY AGAIN, {N}', 'BETTER LUCK NEXT TIME', 'TOTAL DEFEAT', '{N} HAS LOST', '{N} DEFEATED', 'ПОРАЖЕНИЕ, {N}!'],
  draw: ['DRAW!', "IT'S A DRAW!", 'TIE!', 'DRAW GAME', 'STALEMATE', 'DEAD HEAT', 'NO WINNER', 'EVEN MATCH', 'MATCH DRAWN', 'BOTH LOSE', 'NOBODY WINS', 'NO CONTEST', 'DRAW! DRAW! DRAW!', 'STALEMATE!', 'НИЧЬЯ!', 'НИКТО НЕ ПОБЕДИЛ', 'ОБА ПРОИГРАЛИ', 'БЕЗ ПОБЕДИТЕЛЯ', 'РАВНЫЙ БОЙ', 'ВСЕ ПРОИГРАЛИ']
};
const BANNER_COL = { win: '#ffd23f', lose: '#ff4a3a', draw: '#ff9a3a' };

// cosmetic turret variants: strong silhouettes, equal iron mass
const HULLS = [
  { key: 'classic', name: 'Классика' }, { key: 'double', name: 'Двустволка' },
  { key: 'heavy', name: 'Тяжёлый' }, { key: 'stealth', name: 'Стелс' },
  { key: 'retro', name: 'Ретро' }, { key: 'rail', name: 'Рельсотрон' },
  { key: 'howitzer', name: 'Гаубица' }, { key: 'bunker', name: 'Бункер' }
];
const HULL_COLORS = ['#2ecc71', '#ff4757', '#3498db', '#ffd23f', '#9b59b6', '#e67e22', '#1abc9c', '#ff6ab8'];

// ================== SHARED RUNTIME STATE ==================
let overlay, cv, ctx, Wc, Hc;
let cols, waterLevel, biome, seed, S, noise, archetype, moonBite, moonBiteR;
let UNDER = 0;          // cave level flag for the current round
let ceil = null;        // cave ceiling profile (y of the inverted ground edge)
let caveLights = [];    // crystals + spot beams (static lighting, baked radii)
let caveVents = [];     // fossil pockets in the ceiling, erupt DOWN on blast
let volcano = null;
let lavaBits = [];
let cloudCount = 8;
let groundPat = null;
let tod = { stops: ['#7ab3d8', '#a8cde6', '#d8e8f0'], sun: '#fff6d8', sunHalo: 'rgba(255,246,216,0.35)', stars: false, clouds: 0.55, haze: 'rgba(220,235,245,0.25)' };
let cycleT = 0, dayness = 1, todT = 0;
let tanks, wind, windDir, aiSkill;
let ammoInv = {}, aiAmmo = {}, cur = 0, cur2 = 0, turn, state, turnOrder = 0;
let roundOpener = 0;
let shot = null, subshots = [], liquids = [], debris = [], remains = [], sinkers = [], windParts = [], comets = [], grains = [], wreckBits = [];
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
let seatAim = [{ ang: 45, pow: 55 }, { ang: 45, pow: 55 }];
let score = 0, shots = 0, shots2 = 0, roundStart = 0, round = 1;
let wins = 0, wins2 = 0, score2 = 0;
let drag = null, killed = null, helpOpen = false, lastHitInfo = null;
let tctlOpen = false;
let moonCv = null, moonCtx = null, giantCv = null, giantCtx = null, giantKey = '';
let shake = 0;
let touchUI = false, tctlEl = null, angRange = null, powRange = null, angVal = null, powVal = null, hudRefs = null, apEl = null, apBuf = null;
let lastKillMethod = 'weapon', lastShotApex = 0, lastWeapon = 'MISSILE';
let turnTimer = 0, warnedAt = {};
let shotOwner = 0;
let turnCard = null;
let driftT = 0;
let AC = null;
let pockets = [];
let players = [
  { name: 'Player1', col: '#2ecc71', hull: 'classic', ai: false },
  { name: 'GLM',     col: '#ff4757', hull: 'classic', ai: true }
];
let confirmClose = false;
let turnIntro = 0;
let setupOpen = false, confirmOpen = false;
let confirmAction = null;
let firstShooter = Math.random() < 0.5 ? 0 : 1;
// water module state (filled by world, declared here for sharing)
let ripples = [], waterH = null, bands = new Float32Array(22);
let idlePh = 0;
let aState = { bass: 0, mid: 0, treble: 0, bassAvg: 0, bassPeak: 0.2, lastBeat: -1 };
let audioLive = false;
let glints = [], wBands = [], wBlobs = [], soilTw = [];

// ================== PURE HELPERS ==================
const scSel = (s) => overlay.querySelector(s);
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
// lava palette of the CURRENT world (volcanic by default)
const lav = () => LAVA_STYLES[biomeKey()] || LAVA_STYLES.volcanic;
// 'r,g,b' triplet helpers: hex → triplet and a lava→earth blend for the
// cooling pools (drawTerrain, ui)
const hexTri = (h) => { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
const mixTri = (a, b, t) => {
  const A = a.split(',').map(Number), B = b.split(',').map(Number);
  return `${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)}`;
};
const isHumanSeat = (i) => i === 0 || (GMODE === 2 && i === 1);
const activeTank = () => tanks[turn] || tanks[0];
const activeDir = () => { const me = activeTank(); const foe = tanks[turn === 0 ? 1 : 0]; return foe.x > me.x ? 1 : -1; };
// the ONE zombie rule: a DYING fighter may fire one shot inside its window
// and cannot be hurt; a DEAD one can do nothing at all
const canAct = (i) => { const t = tanks && tanks[i]; return !!t && !t.dead && (!t.dying || (gt < t.lsUntil && !t.lsShot)); };
const canHurt = (i) => { const t = tanks && tanks[i]; return !!t && !t.dead && !t.dying; };
const modalOpen = () => helpOpen || setupOpen || confirmOpen;
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const hudSeat = () => (state === 'aim' ? (turn === 0 ? 0 : 1) : shotOwner);
const blastRange = (x, r) => [clamp(Math.round((x - r * 1.5) / cols.step), 1, cols.length - 2), clamp(Math.round((x + r * 1.5) / cols.step), 1, cols.length - 2)];

// shared confirmation dialog; button LABELS adapt per use
function askConfirm(msg, act, labels) {
  if (!overlay) return;
  overlay.querySelector('.sc-confirm p').textContent = msg;
  overlay.querySelector('.sc-no').textContent = (labels && labels.no) || 'Продолжить';
  overlay.querySelector('.sc-yes').textContent = (labels && labels.yes) || 'Выйти';
  confirmAction = act;
  overlay.querySelector('.sc-confirm').classList.add('show');
  confirmOpen = true;
}
// LIGHT SITE THEME detection: first opaque background up the chain decides
function siteIsLight() {
  let el = document.body;
  while (el) {
    let c = null;
    try { c = getComputedStyle(el).backgroundColor; } catch (e) {}
    if (c && c !== 'transparent') {
      const m = c.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,]+([\d.]+))?\s*\)/);
      if (m && (m[4] === undefined || +m[4] > 0.05)) {
        return (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255 > 0.5;
      }
    }
    el = el.parentElement;
  }
  return true;
}
function syncLightTheme() {
  if (overlay) overlay.classList.toggle('sc-light', siteIsLight());
}
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

// color helpers used by the turret sprites and the terrain renderer
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

// ============ TURRET BODIES: eight silhouettes, equal iron ============
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
  P(-12, -5, 24, 5, shade(base, 0.5));
  P(-12, -5, 24, 1, shade(base, 0.78));
  [-9, 0, 9].forEach(bx => P(bx, -3, 1, 1, shade(base, 0.35)));
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
  const topY = hull === 'stealth' ? -19 : hull === 'heavy' ? -18 : hull === 'retro' ? -25 : hull === 'howitzer' ? -23 : (hull === 'rail' || hull === 'bunker') ? -17 : -24;
  P(-3, topY, 6, 3, shade(base, 0.95));
  P(-3, topY, 6, 1, shade(base, 1.25));
  P(-1, topY - 2, 3, 2, '#4d545c');
  if (!wreck) {
    // the lamp glows by night on the surface, ALWAYS in the caves
    const glow = UNDER ? 0.8 : clamp((1 - dayness) * 0.9, 0, 0.9);
    if (glow > 0.1) { c.fillStyle = `rgba(255,214,120,${glow.toFixed(3)})`; c.fillRect(0, topY - 2, 1, 1); }
  }
  // barrel — the rotation formula holds across the whole AIM arc
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

// the live projectile sprite, shared by the shot renderer and the menus
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

// ================== RNG / NOISE ==================
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

// ================== AUDIO ==================
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

// ================== STORAGE ==================
function records() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
function saveRec(pl, pts, wn) {
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
// last-used fighters per game mode; a HUMAN fighter's look is re-merged
// from his PROFILE by name — one name = one fighter in every mode
function lastCfg() { try { return JSON.parse(localStorage.getItem(LS_LAST)) || {}; } catch { return {}; } }
function saveLastCfg(mode, p0, p1) {
  try {
    const c = lastCfg();
    c.mode = mode;
    c[mode] = { p0: { name: p0.name, col: p0.col, hull: p0.hull }, p1: { name: p1.name, col: p1.col, hull: p1.hull } };
    localStorage.setItem(LS_LAST, JSON.stringify(c));
  } catch (e) {}
}
const profLook = (name, fb) => {
  const pr = profiles().find(q => q.name.toLowerCase() === (name || '').toLowerCase());
  return pr ? { col: pr.col, hull: pr.hull } : fb;
};
function applyLastPlayers() {
  const c = lastCfg()[GMODE];
  if (!c) return;
  players[0] = { name: (c.p0 && c.p0.name) || 'Player1', ...profLook((c.p0 && c.p0.name) || 'Player1', { col: (c.p0 && c.p0.col) || '#2ecc71', hull: (c.p0 && c.p0.hull) || 'classic' }), ai: false };
  players[1] = GMODE === 1
    ? { name: 'GLM', col: (c.p1 && c.p1.col) || '#ff4757', hull: (c.p1 && c.p1.hull) || 'classic', ai: true }
    : { name: (c.p1 && c.p1.name) || 'Player2', ...profLook((c.p1 && c.p1.name) || 'Player2', { col: (c.p1 && c.p1.col) || '#3498db', hull: (c.p1 && c.p1.hull) || 'classic' }), ai: false };
}
function schedule(fn, delay) { events.push({ at: gt + delay, fn }); }

// ================== LIFECYCLE ==================
function openGame() {
  build();
  ensureAudio();
  syncLightTheme();
  const lc = lastCfg();
  if (lc.mode === 1 || lc.mode === 2) GMODE = lc.mode;
  applyLastPlayers();
  overlay.classList.add('show');
  setTimeout(() => { resize(); start(); }, 60);
}
function closeGame(boom) { if (boom) apocalypsis(); else { stopLoop(); overlay.classList.remove('show'); } }
// the closing apocalypse REUSES the NUKE impact package with zero damage;
// bounded by a HARD 2-second wall-clock budget
function apocalypsis() {
  if (state === 'closing') return;
  stopLoop();
  state = 'closing';
  shot = null; subshots = []; liquids = []; events = []; firePatches = [];
  const NUKE0 = { ...ARSENAL.find(w => w.key === 'NUKE'), dmg: 0 };
  tanks.forEach((t, i) => {
    nukeStrike(t.x, t.y - 10, { ...NUKE0, r: 60 });
    t.dead = true; t.dying = false; killed = i;
    remains.push({ x: t.x, y: t.y, col: t.col, hull: t.hull, style: 'nuke', falling: true, sunk: false, wreck: 1 });
    tankParts(t);
  });
  for (let i = 0; i < 4; i++) {
    const bx = R(Wc * 0.15, Wc * 0.85);
    schedule(() => nukeStrike(bx, surfaceAt(bx) - 10, NUKE0), 0.12 + i * 0.14);
  }
  const tEnd = performance.now() + 2000;
  let lastT = performance.now();
  const fin = () => {
    const now = performance.now();
    const dtr = clamp((now - lastT) / 1000, 0, 0.05); lastT = now;
    const adv = dtr * 2.2;
    const n = Math.max(1, Math.ceil(adv * 30));
    const sdt = adv / n;
    for (let s = 0; s < n; s++) {
      gt += sdt;
      for (let i = events.length - 1; i >= 0; i--) if (gt >= events[i].at) { const fn = events[i].fn; events.splice(i, 1); fn(); }
      stepTerra(sdt); stepFx(sdt); stepWater(sdt);
    }
    draw();
    const left = tEnd - now;
    if (left <= 0) { overlay.style.opacity = ''; stopLoop(); overlay.classList.remove('show'); return; }
    overlay.style.opacity = clamp(left / 250, 0, 1).toFixed(3);
    requestAnimationFrame(fin);
  };
  requestAnimationFrame(fin);
}
function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = null; events = []; }

// boot: dblclick / double-tap / long-press on the host trigger zone
function boot() {
  const zone = document.getElementById('hoverTrigger') || document.getElementById('bgBandit');
  if (!zone) return;
  zone.addEventListener('dblclick', (e) => { e.preventDefault(); openGame(); });
  let tapStart = 0, lastTap = 0, holdTimer = null, moved = false;
  const bB = document.getElementById('bgBandit');
  const sBg = () => bB && bB.classList.add('hovered');
  const hBg = () => bB && bB.classList.remove('hovered');
  zone.addEventListener('touchstart', (e) => {
    tapStart = Date.now(); moved = false;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(sBg, 120);
    const t = e.touches[0];
    if (t) {
      const sx = t.clientX, sy = t.clientY;
      const move = (ev) => {
        if (ev.touches[0] && (Math.abs(ev.touches[0].clientX - sx) > 12 || Math.abs(ev.touches[0].clientY - sy) > 12)) {
          moved = true; clearTimeout(holdTimer); hBg();
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
    if (held > 350) { setTimeout(hBg, 1500); return; }
    hBg();
    const now = Date.now();
    if (now - lastTap < 400 && now - lastTap > 40) { e.preventDefault(); openGame(); lastTap = 0; }
    else lastTap = now;
  }, { passive: false });
  zone.addEventListener('touchcancel', () => { clearTimeout(holdTimer); hBg(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

window.Scorch = { open: openGame, close: closeGame };