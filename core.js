// core.js
const VERSION = '0.7.17';
const CACHE_VERSION = '4';
const LS_KEY = 'fm_adapter_calc_v10';
const LS_THEME_KEY = 'fm_adapter_theme';
const RU_MIN = 87.5;
const RU_MAX = 108.0;
const FM_BAND_MIN = 76.0;
const FM_BAND_MAX = 108.0;
const SHIFTS = [0, 10, 12, 14, 16, 18, 20, 24, 28, 30];
const TEMPLATES = [
  { name: 'Россия / Европа', short: 'ru/eu', range: [RU_MIN, RU_MAX] },
  { name: 'Япония (до ~2014)', short: 'jp-old', range: [76.0, 90.0] },
  { name: 'Япония (≈2014–2020)', short: 'jp-wide', range: [76.0, 95.0] },
  { name: 'Япония (≈2020+)', short: 'jp-ext', range: [76.0, 99.0] },
  { name: 'США / Канада', short: 'us/ca', range: [87.9, 107.9] },
  { name: 'Китай', short: 'cn', range: [87.5, 108.0] },
  { name: 'Корея', short: 'kr', range: [88.0, 108.0] },
  { name: 'OIRT / СССР', short: 'oirt', range: [65.9, 74.0] },
  { name: 'Свой диапазон', short: 'custom', range: [76.0, 108.0] }
];
const ALL_CITIES = 'Избранное';
const DEFAULT_STATE = {
  city: 'Москва',
  template: 'Россия / Европа',
  templateShort: 'ru/eu',
  min: RU_MIN,
  max: RU_MAX,
  shift: 0,
  stations: [],
  viewMode: 'setup',
  dialView: 'narrow',
  dialFreqView: 'orig',
  dialCurrentBand: 1,
  skipMode: 'presets',
  dialControlsVisible: null,
  bands: 1,
  presets: 6,
  cityData: {},
  trackMeta: false,
  lastModified: 0
};

let state = { ...DEFAULT_STATE };
let citiesMap = JSON.parse(localStorage.getItem('fm_cities_map') || '{}');
let activePresetMenu = null;
let saveStateTimer = null;
let selectedTransferCity = null;
let lastDataSource = '';

// Wrappers for backward compatibility with exports.js
function calcShiftedFreq(freq) {
  return FMUse.calcShiftedFreq(freq, state, RU_MIN, RU_MAX);
}
function formatFreq(f) {
  return FMUse.formatFreq(f);
}
function isAvailable(freq) {
  return FMUse.isAvailable(freq, state, RU_MIN, RU_MAX);
}

function getAccentGlow(color) {
  let r = 0, g = 0, b = 0;
  if (color.startsWith('#')) {
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (color.startsWith('rgb')) {
    const m = color.match(/\d+/g);
    if (m && m.length >= 3) {
      r = parseInt(m[0]);
      g = parseInt(m[1]);
      b = parseInt(m[2]);
    } else {
      return color;
    }
  } else {
    return color;
  }
  r = Math.round(r * 0.5 + 128 * 0.5);
  g = Math.round(g * 0.5 + 128 * 0.5);
  b = Math.round(b * 0.5 + 128 * 0.5);
  return `rgba(${r}, ${g}, ${b}, 0.25)`;
}

function updateAccentColor(statuses) {
  const root = document.documentElement;
  const isDark = root.getAttribute('data-theme') === 'dark' || !root.getAttribute('data-theme');
  let accentColor;

  if (state.min === RU_MIN && state.max === RU_MAX || state.shift === 0) {
    accentColor = isDark ? '#00d4ff' : '#0096c7';
  } else {
    const status = statuses[state.shift] || { type: 'none' };
    const ratio = status.ratio || 0;
    if (status.type === 'full' || status.type === 'best') {
      accentColor = isDark ? '#2ecc71' : '#27ae60';
    } else if (status.type === 'partial') {
      const sY = isDark ? { r: 241, g: 196, b: 15 } : { r: 243, g: 156, b: 18 };
      const eP = isDark ? { r: 255, g: 71, b: 87 } : { r: 231, g: 76, b: 60 };
      accentColor = `rgb(${Math.round(sY.r + (eP.r - sY.r) * (1 - ratio))}, ${Math.round(sY.g + (eP.g - sY.g) * (1 - ratio))}, ${Math.round(sY.b + (eP.b - sY.b) * (1 - ratio))})`;
    } else {
      accentColor = getComputedStyle(root).getPropertyValue('--pink').trim() || '#ff4757';
    }
  }
  root.style.setProperty('--accent', accentColor);
  root.style.setProperty('--knob', accentColor);
  root.style.setProperty('--accent-glow', getAccentGlow(accentColor));
}

function initTheme() {
  const t = localStorage.getItem(LS_THEME_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
  updateThemeIcon();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(LS_THEME_KEY)) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      updateThemeIcon();
    }
  });
}

function toggleTheme() {
  const ct = document.documentElement.getAttribute('data-theme') || 'dark';
  const nt = ct === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nt);
  localStorage.setItem(LS_THEME_KEY, nt);
  updateThemeIcon();
}

function updateThemeIcon() {
  const t = document.documentElement.getAttribute('data-theme') || 'dark';
  const b = document.getElementById('themeBtn');
  b.textContent = t === 'dark' ? '☀' : '☾';
  b.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
}

function renderAdapters() {
  const panel = document.getElementById('adapterPanel');
  const chips = document.getElementById('adapterChips');
  chips.innerHTML = '';
  const isStandard = state.min === RU_MIN && state.max === RU_MAX;
  if (isStandard) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  const { statuses, best } = FMUse.evaluateShifts(state, SHIFTS, RU_MIN, RU_MAX);
  updateAccentColor(statuses);

  const addChip = (shift, sd) => {
    const c = document.createElement('button');
    c.className = `chip ${sd.type || ''}`;
    let t = shift === 0 ? 'Без сдвига. ' : `Сдвиг ${shift} МГц. `;
    if (sd.type === 'full') t += 'Все станции доступны.';
    else if (sd.type === 'partial') t += `Доступно ${Math.round(sd.ratio * 100)}% станций.`;
    else t += 'Станции недоступны.';
    if (shift === best && sd.type === 'full') t += ' Лучший выбор!';
    c.title = t;
    if (shift === best && sd.type === 'full') c.classList.add('best');
    if (shift === state.shift) c.classList.add('active');
    c.textContent = shift === 0 ? '0' : shift;
    if (sd.type === 'partial') {
      const r = Math.round(255 - 14 * sd.ratio);
      const g = Math.round(71 + 125 * sd.ratio);
      const b = Math.round(87 - 72 * sd.ratio);
      const col = `rgb(${r}, ${g}, ${b})`;
      c.style.color = col;
      c.style.borderColor = col;
      if (shift === state.shift) {
        c.style.backgroundColor = col;
        c.style.color = 'var(--bg)';
      }
    } else if (shift === 0 && shift === state.shift) {
      c.style.color = 'var(--bg)';
      c.style.borderColor = 'var(--accent)';
      c.style.backgroundColor = 'var(--accent)';
    }
    c.onclick = () => {
      state.shift = shift;
      commitState();
      render();
    };
    chips.appendChild(c);
  };
  SHIFTS.forEach((s) => addChip(s, statuses[s] || { type: 'none' }));
}

function renderStations() {
  const list = document.getElementById('stationsList');
  list.innerHTML = '';
  if (state.stations.length === 0) {
    list.innerHTML = '<div class="loading-msg">Нет данных</div>';
    return;
  }
  const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
  const isStandard = state.min === RU_MIN && state.max === RU_MAX;
  const isPlayer = state.viewMode === 'player';
  const frag = document.createDocumentFragment();
  
  sorted.forEach((st) => {
    const item = document.createElement('div');
    item.className = 'station-item';
    item.dataset.source = state.stationsSource || 'cache';
    const shiftedNum = FMUse.calcShiftedFreq(st.freq, state, RU_MIN, RU_MAX);
    const isAvail = FMUse.isAvailable(st.freq, state, RU_MIN, RU_MAX);
    const freqClass = isAvail ? 'ok' : 'err';
    if (!isAvail) item.classList.add('unavailable');
    const streamData = stationStreamMap[FMUse.generateCodeName(st.name)];

    const logoEl = document.createElement('div');
    logoEl.className = 'station-logo';
    if (streamData && streamData.favicon && streamData.favicon !== 'null' && streamData.favicon !== 'undefined') {
      const img = document.createElement('img');
      img.src = streamData.favicon;
      img.alt = '';
      img.onerror = () => img.remove();
      logoEl.appendChild(img);
    }
    item.appendChild(logoEl);

    const freqDiv = document.createElement('div');
    freqDiv.className = 'freq';
    freqDiv.textContent = FMUse.formatFreq(st.freq);
    freqDiv.title = `Оригинальная частота: ${FMUse.formatFreq(st.freq)} МГц`;
    freqDiv.style.cursor = 'pointer';
    freqDiv.onclick = (e) => {
      e.stopPropagation();
      showToast(freqDiv.title);
    };
    item.appendChild(freqDiv);

    if (state.viewMode === 'setup' || isPlayer) {
      const data = getStationData(st.name);
      if (data.type === 'trash') item.classList.add('trash');
      let iconClass = 'normal';
      let iconChar = '○';
      let iconTitle = 'Кликни для выбора - любимое, интересное, пропушенное';
      if (data.type === 'fav') {
        iconClass = 'fav';
        iconChar = '♥';
        iconTitle = 'Любимое';
      } else if (data.type === 'cand') {
        iconClass = 'cand';
        iconChar = '★';
        iconTitle = 'Интересное';
      } else if (data.type === 'trash') {
        iconClass = 'trash';
        iconChar = '⊘';
        iconTitle = 'Пропущено';
      }
      const visible = isPresetVisible(data.presetIndex);
      const presetStr = visible ? formatPreset(data.presetIndex, state.bands, state.presets) : '';
      const displayStr = visible ? presetStr : '+';
      const btnTitle = visible ? `Кнопка ${presetStr}` : 'Назначить кнопку магнитолы';
      const statusCell = document.createElement('div');
      statusCell.className = 'status-cell';
      const iconSpan = document.createElement('span');
      iconSpan.className = `status-icon ${iconClass}`;
      iconSpan.dataset.name = st.name;
      iconSpan.textContent = iconChar;
      iconSpan.setAttribute('tabindex', '0');
      iconSpan.setAttribute('role', 'button');
      iconSpan.title = iconTitle;
      statusCell.appendChild(iconSpan);
      const pd = document.createElement('div');
      pd.className = 'preset-dropdown';
      const pb = document.createElement('button');
      pb.className = `preset-btn ${visible ? 'active' : ''}`;
      pb.dataset.name = st.name;
      pb.textContent = displayStr;
      pb.title = btnTitle;
      pd.appendChild(pb);
      statusCell.appendChild(pd);
      item.appendChild(statusCell);
    }

    const nameDiv = document.createElement('div');
    nameDiv.className = 'name';
    const nameText = document.createElement('span');
    nameText.className = 'name-text';
    nameText.textContent = st.name;
    nameText.style.cursor = 'pointer';
    nameText.title = st.name;
    nameText.onclick = (e) => {
      e.stopPropagation();
      showToast(st.name);
    };
    nameDiv.appendChild(nameText);

    if (streamData && (streamData.tags || (streamData.streams && streamData.streams.length > 0 && streamData.streams[0].name))) {
      const ts = document.createElement('span');
      ts.className = 'tags';
      let tt = streamData.tags || '';
      if (streamData.streams && streamData.streams.length > 0 && streamData.streams[0].name) {
        const cn = FMUse.cleanStreamName(streamData.streams[0].name, st.name, state.city, tt);
        if (cn) tt = tt ? `${tt} (${cn})` : `(${cn})`;
      }
      ts.textContent = tt;
      ts.title = tt;
      ts.style.cursor = 'pointer';
      ts.onclick = (e) => {
        e.stopPropagation();
        showToast(tt);
      };
      nameDiv.appendChild(ts);
    }

    const playBtn = document.createElement('button');
    playBtn.className = 'play-btn-row';
    const hasStream = streamData && streamData.streams && streamData.streams.length > 0;
    if (!hasStream || streamData.broken) playBtn.classList.add('hidden');
    playBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    playBtn.dataset.name = st.name;
    if (hasStream) {
      playBtn.title = `Потоки: ${streamData.streams.map((s) => s.bitrate ? `${s.bitrate}k` : '?').join(', ')}`;
      playBtn.onclick = (e) => {
        e.stopPropagation();
        togglePlay(st.name);
      };
    }
    nameDiv.appendChild(playBtn);
    item.appendChild(nameDiv);

    if (!isStandard) {
      const sd = document.createElement('div');
      sd.className = `shifted-freq ${freqClass}`;
      sd.textContent = shiftedNum >= FM_BAND_MIN ? FMUse.formatFreq(shiftedNum) : '—';
      sd.title = shiftedNum >= FM_BAND_MIN ? `На ГУ (с адаптером): ${FMUse.formatFreq(shiftedNum)} МГц` : 'Вне диапазона ГУ';
      sd.style.cursor = 'pointer';
      sd.onclick = (e) => {
        e.stopPropagation();
        showToast(sd.title);
      };
      item.appendChild(sd);
    }
    frag.appendChild(item);
  });
  list.appendChild(frag);
}

function pluralize(n, o, f, m) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return o;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return f;
  return m;
}

function updateCityStats(city) {
  if (!state.cityData[city]) state.cityData[city] = { stations: {} };
  if (!state.cityData[city].allStations && state.city === city && state.stations.length > 0) {
    state.cityData[city].allStations = state.stations.map((s) => ({ name: s.name, freq: s.freq }));
  }
  if (state.city === city && state.stations.length > 0) {
    state.cityData[city].totalStations = state.stations.length;
  }
  const cs = state.cityData[city].stations || {};
  const clean = {};
  let fav = 0, cand = 0, trash = 0, presets = 0;
  Object.keys(cs).forEach((n) => {
    const s = cs[n];
    if (s.type !== 'normal' || s.presetIndex) {
      clean[n] = s;
      if (s.type === 'fav') fav++;
      else if (s.type === 'cand') cand++;
      else if (s.type === 'trash') trash++;
      if (s.presetIndex && isPresetVisible(s.presetIndex)) presets++;
    }
  });
  state.cityData[city].stations = clean;
  state.cityData[city].stats = { total: state.cityData[city].totalStations || 0, fav, cand, trash, statused: fav + cand + trash, presets };
  state.cityData[city].lastModified = Date.now();
}

function getStatsTooltip(s) {
  if (!s) return '';
  const p = [];
  if (s.total) p.push(`${s.total} ${pluralize(s.total, 'станция', 'станции', 'станций')}`);
  if (s.fav) p.push(`${s.fav} ${pluralize(s.fav, 'любимое', 'любимые', 'любимых')}`);
  if (s.cand) p.push(`${s.cand} ${pluralize(s.cand, 'интересная', 'интересные', 'интересных')}`);
  if (s.trash) p.push(`${s.trash} ${pluralize(s.trash, 'пропущена', 'пропущены', 'пропущено')}`);
  if (s.presets) p.push(`${s.presets} ${pluralize(s.presets, 'кнопка', 'кнопки', 'кнопок')}`);
  return p.join(', ');
}

function formatCityStatsHTML(s) {
  if (!s || (s.total === 0 && s.statused === 0 && s.presets === 0)) return '';
  const m = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  const sub = (n) => String(n).split('').map((d) => m[d] || d).join('');
  const p = [];
  if (s.total) p.push(`📻${sub(s.total)}`);
  if (s.statused) p.push(`☑${sub(s.statused)}`);
  if (s.presets) p.push(`▣${sub(s.presets)}`);
  return p.join(' ');
}

function renderCitySelectMenu() {
  const m = document.getElementById('citySelectMenu');
  const t = document.getElementById('citySelectTrigger');
  if (!m || !t) return;
  m.innerHTML = '';
  const all = new Set([...Object.keys(citiesMap), ...Object.keys(state.cityData)]);
  all.delete(ALL_CITIES);
  const addOption = (c) => {
    const i = document.createElement('div');
    i.className = 'custom-select-option';
    i.dataset.value = c;
    if (c === state.city) i.classList.add('active');
    const ns = document.createElement('span');
    ns.className = 'city-name';
    ns.textContent = c;
    ns.title = c;
    i.appendChild(ns);
    const ss = document.createElement('span');
    ss.className = 'city-stats';
    const si = state.cityData[c]?.stats;
    ss.innerHTML = formatCityStatsHTML(si);
    ss.title = getStatsTooltip(si);
    i.appendChild(ss);
    i.onclick = (e) => {
      e.stopPropagation();
      state.city = c;
      commitState();
      loadCity(c);
      m.classList.remove('show');
    };
    m.appendChild(i);
  };
  addOption(ALL_CITIES);
  Array.from(all).sort().forEach(addOption);
  t.onclick = (e) => {
    e.stopPropagation();
    m.classList.toggle('show');
    const ai = m.querySelector('.active');
    if (ai) ai.scrollIntoView({ block: 'center' });
  };
}

function render() {
  const minI = document.getElementById('minFreq');
  const maxI = document.getElementById('maxFreq');
  const cT = document.getElementById('citySelectTrigger');
  const cM = document.getElementById('citySelectMenu');
  const tB = document.getElementById('transferBtn');
  if (document.activeElement !== minI) minI.value = state.min;
  if (document.activeElement !== maxI) maxI.value = state.max;
  if (document.activeElement !== document.getElementById('bands')) document.getElementById('bands').value = state.bands;
  if (document.activeElement !== document.getElementById('presets')) document.getElementById('presets').value = state.presets;
  if (cT) {
    updateCityStats(state.city);
    cT.textContent = state.city;
    const oa = cM.querySelector('.active');
    if (oa) oa.classList.remove('active');
    cM.querySelectorAll('.custom-select-option').forEach((i) => {
      if (i.dataset.value === state.city) {
        i.classList.add('active');
        const s = state.cityData[state.city]?.stats;
        const ss = i.querySelector('.city-stats');
        ss.innerHTML = formatCityStatsHTML(s);
        ss.title = getStatsTooltip(s);
      }
    });
  }
  document.getElementById('templatesBtn').textContent = state.templateShort || 'свой';
  
  if (document.getElementById('fmDialWrapper')) {
    const dT = document.getElementById('dialToggleBtn');
    const dFT = document.getElementById('dialFreqToggleBtn');
    const dCT = document.getElementById('dialControlsToggleBtn');
    if (state.stations.length > 0) {
      document.getElementById('fmDialWrapper').style.display = 'block';
      const showFT = true; // Всегда показываем кнопку частот, чтобы можно было долго нажимать
      dFT.style.display = showFT ? 'flex' : 'none';
      const isSV = state.dialFreqView === 'shifted';
      dFT.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path><circle cx="12" cy="12" r="2"></circle><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19.1"></path></svg>';
      dFT.title = isSV ? 'Показывать оригинальные частоты' : 'Показывать частоты на ГУ';
      dFT.style.color = isSV ? 'var(--accent)' : 'var(--text-dim)';
      
      // Обновление кнопки режима перемотки
      const dSMB = document.getElementById('dialSkipModeBtn');
      if (dSMB) {
        const isFreq = state.skipMode === 'freq';
        dSMB.innerHTML = isFreq 
          ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>'
          : '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>';
        dSMB.title = isFreq ? 'Режим перемотки: По частотам' : 'Режим перемотки: По кнопкам';
        dSMB.style.color = isFreq ? 'var(--text-dim)' : 'var(--accent)';
      }
      
      const cV = state.dialControlsVisible !== null ? state.dialControlsVisible : state.viewMode === 'setup';
      document.getElementById('fmDialWrapper').classList.toggle('controls-hidden', !cV);
      dCT.style.display = 'flex';
      dCT.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect><path d="M6 10h0M10 10h0M14 10h0M18 10h0M8 14h8"></path></svg>';
      dCT.title = cV ? 'Скрыть кнопки шкалы' : 'Показать кнопки шкалы';
      dCT.style.color = cV ? 'var(--accent)' : 'var(--text-dim)';
      if (typeof renderDialControls === 'function' && cV) renderDialControls();
      if (typeof dialAnimId !== 'undefined' && !dialAnimId && typeof dialLoop !== 'undefined') dialLoop();
    } else {
      document.getElementById('fmDialWrapper').style.display = 'none';
      if (typeof dialAnimId !== 'undefined' && dialAnimId) {
        cancelAnimationFrame(dialAnimId);
        dialAnimId = null;
      }
    }
  }
  
  renderAdapters();
  renderStations();
  if (state.viewMode === 'setup') {
    tB.style.display = 'flex';
    tB.classList.remove('blink');
    tB.title = 'Скопировать настройки от другого города';
  } else {
    tB.style.display = 'none';
    tB.classList.remove('blink');
  }
  if (currentPlayingStation && typeof updatePlayerUI !== 'undefined') updatePlayerUI();
}

function getStationData(name) {
  return state.cityData[state.city]?.stations?.[name] || { type: 'normal', presetIndex: null };
}

function ensureStationData(name) {
  if (!state.cityData[state.city]) state.cityData[state.city] = { stations: {} };
  if (!state.cityData[state.city].stations[name]) {
    state.cityData[state.city].stations[name] = { type: 'normal', presetIndex: null };
  }
  return state.cityData[state.city].stations[name];
}

function cycleStationStatus(name) {
  const d = ensureStationData(name);
  if (d.type === 'normal') d.type = 'fav';
  else if (d.type === 'fav') d.type = 'cand';
  else if (d.type === 'cand') d.type = 'trash';
  else d.type = 'normal';
  updateCityStats(state.city);
  commitState();
  render();
}

function formatPreset(p, b, ps) {
  if (!p) return '';
  if (b === 1) return `${p}`;
  const bd = Math.ceil(p / ps);
  const pr = p % ps === 0 ? ps : p % ps;
  return `${bd}.${pr}`;
}

function isPresetVisible(pi) {
  return pi && pi <= state.bands * state.presets;
}

function assignPreset(name, pi) {
  const d = ensureStationData(name);
  const cs = state.cityData[state.city].stations;
  if (pi) {
    Object.keys(cs).forEach((n) => {
      if (cs[n].presetIndex === pi && n !== name) cs[n].presetIndex = null;
    });
  }
  d.presetIndex = d.presetIndex === pi ? null : pi;
  updateCityStats(state.city);
  commitState();
  render();
}

function openPresetMenu(btn, name) {
  closePresetMenu();
  const m = document.createElement('div');
  m.className = 'dropdown-menu preset-menu show';
  const mp = state.bands * state.presets;
  const cs = state.cityData[state.city]?.stations || {};
  const cd = getStationData(name);
  let ffi = null;
  for (let p = 1; p <= mp; p++) {
    let ob = '';
    Object.keys(cs).forEach((n) => {
      if (cs[n].presetIndex === p) ob = n;
    });
    const i = document.createElement('div');
    const isc = cd.presetIndex === p;
    i.className = 'dropdown-item preset-item' + (ob && !isc ? ' occupied' : '');
    if (isc) i.classList.add('current');
    const ns = document.createElement('span');
    ns.className = 'preset-num';
    ns.textContent = formatPreset(p, state.bands, state.presets);
    i.appendChild(ns);
    const nss = document.createElement('span');
    nss.className = 'preset-name';
    nss.textContent = ob ? ob : 'Свободно';
    if (ob) nss.title = ob;
    i.appendChild(nss);
    i.onclick = (e) => {
      e.stopPropagation();
      assignPreset(name, p);
      closePresetMenu();
    };
    m.appendChild(i);
    if (!ob && !ffi) ffi = i;
  }
  const cl = document.createElement('div');
  cl.className = 'dropdown-item preset-item preset-clear';
  cl.textContent = '✕ Очистить';
  cl.onclick = (e) => {
    e.stopPropagation();
    assignPreset(name, null);
    closePresetMenu();
  };
  m.appendChild(cl);
  btn.parentElement.appendChild(m);
  activePresetMenu = m;
  if (ffi) ffi.scrollIntoView({ block: 'center' });
}

function closePresetMenu() {
  if (activePresetMenu) {
    activePresetMenu.remove();
    activePresetMenu = null;
  }
}

function commitState() {
  state.lastModified = Date.now();
  const ccd = {};
  Object.keys(state.cityData).forEach((c) => {
    const s = state.cityData[c]?.stats;
    const hd = s && (s.statused > 0 || s.presets > 0);
    const hs = state.cityData[c]?.allStations?.length > 0;
    if (hd || hs) ccd[c] = state.cityData[c];
  });
  state.cityData = ccd;
  const sts = JSON.parse(JSON.stringify(state));
  if (sts.streamsData) {
    Object.values(sts.streamsData).forEach((d) => {
      d.broken = false;
      if (d.streams) d.streams.forEach((s) => s.broken = false);
    });
  }
  localStorage.setItem(LS_KEY, JSON.stringify(sts));
  updateUrl();
}

function saveState() {
  clearTimeout(saveStateTimer);
  saveStateTimer = setTimeout(commitState, 300);
}

function updateUrl() {
  const p = new URLSearchParams({ city: state.city, min: state.min, max: state.max, shift: state.shift, bands: state.bands, presets: state.presets });
  if (state.viewMode === 'player') p.set('view', 'player');
  if (state.dialView === 'full') p.set('dial', 'full');
  if (state.dialFreqView === 'shifted') p.set('dfreq', 'shifted');
  if (state.skipMode === 'freq') p.set('skip', 'freq');
  if (state.dialControlsVisible !== null) p.set('dctrl', state.dialControlsVisible ? '1' : '0');
  if (state.trackMeta) p.set('meta', '1');
  if (currentPlayingStation) {
    p.set('play', currentPlayingStation);
    p.set('stream', currentStreamIndex);
  }
  history.replaceState(null, '', `#${p.toString()}`);
}

function loadFromUrl() {
  if (location.hash.length < 2) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  const c = p.get('city');
  if (c) state.city = c;
  const mn = parseFloat(p.get('min'));
  if (!isNaN(mn) && mn >= 64 && mn <= 110) state.min = mn;
  const mx = parseFloat(p.get('max'));
  if (!isNaN(mx) && mx >= 64 && mx <= 110 && mx > state.min) state.max = mx;
  const sh = parseInt(p.get('shift'));
  if (!isNaN(sh) && sh >= 0 && sh <= 30) state.shift = sh;
  const v = p.get('view');
  state.viewMode = v === 'player' ? 'player' : 'setup';
  const d = p.get('dial');
  state.dialView = d === 'full' ? 'full' : 'narrow';
  const df = p.get('dfreq');
  state.dialFreqView = df === 'shifted' ? 'shifted' : 'orig';
  const sk = p.get('skip');
  state.skipMode = sk === 'freq' ? 'freq' : 'presets';
  const dc = p.get('dctrl');
  state.dialControlsVisible = dc === '1' ? true : dc === '0' ? false : null;
  state.trackMeta = p.get('meta') === '1';
  const b = parseInt(p.get('bands'));
  if (!isNaN(b) && b >= 1 && b <= 5) state.bands = b;
  const ps = parseInt(p.get('presets'));
  if (!isNaN(ps) && ps >= 1 && ps <= 18) state.presets = ps;
  const mt = TEMPLATES.find((t) => t.range[0] === state.min && t.range[1] === state.max);
  state.template = mt ? mt.name : 'Свой вариант';
  state.templateShort = mt ? mt.short : 'свой';
  return true;
}

function loadFromLS() {
  const ls = localStorage.getItem(LS_KEY);
  if (!ls) return false;
  try {
    state = { ...state, ...JSON.parse(ls) };
    // Migrate pre-rename pseudo-city, keeping custom statuses/presets
    const oldFav = state.cityData['Все города'];
    if (oldFav) {
      const cur = state.cityData[ALL_CITIES];
      if (cur) {
        oldFav.stations = { ...(oldFav.stations || {}), ...(cur.stations || {}) };
        if (cur.allStations && cur.allStations.length) oldFav.allStations = cur.allStations;
      }
      state.cityData[ALL_CITIES] = oldFav;
      delete state.cityData['Все города'];
    }
    if (state.city === 'Все города') state.city = ALL_CITIES;
    return true;
  } catch {
    return false;
  }
}

function resetAll() {
  ['fm_adapter_calc', 'fm_adapter_calc_v2', 'fm_adapter_calc_v3', 'fm_adapter_calc_v4', 'fm_adapter_calc_v5', 'fm_adapter_calc_v6', 'fm_adapter_calc_v7', 'fm_adapter_calc_v8', 'fm_adapter_calc_v9', LS_KEY, LS_THEME_KEY, 'geo_checked', 'fm_cities_map'].forEach((k) => localStorage.removeItem(k));
  localStorage.setItem('fm_cache_version', CACHE_VERSION);
  history.replaceState(null, '', window.location.pathname);
  showToast('Полный сброс выполнен');
  setTimeout(() => window.location.reload(), 600);
}

function resetCurrentCity() {
  const c = state.city;
  if (c === ALL_CITIES) {
    // Wipe custom statuses/presets, then rebuild fav/cand from all cities
    state.cityData[ALL_CITIES] = { stations: {}, allStations: [] };
    showToast('Избранное пересобрано');
    loadCity(ALL_CITIES);
    document.getElementById('helpModal').classList.remove('show');
    return;
  }
  if (!citiesMap[c]) return;
  if (state.cityData[c]) state.cityData[c].stations = {};
  commitState();
  showToast('Сброс станций текущего города...');
  loadCity(c);
  document.getElementById('helpModal').classList.remove('show');
}

function openTransferModal() {
  const l = document.getElementById('transferCityList');
  l.innerHTML = '';
  selectedTransferCity = null;
  let cws = [];
  Object.keys(state.cityData).forEach((c) => {
    const s = state.cityData[c]?.stats;
    const hd = s && (s.statused > 0 || s.presets > 0);
    if (hd && c !== state.city) cws.push({ name: c, time: state.cityData[c]?.lastModified || 0 });
  });
  cws.sort((a, b) => b.time - a.time);
  if (cws.length === 0) {
    l.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim);">Нет городов с сохраненными настройками</div>';
  } else {
    cws.forEach((co) => {
      const c = co.name;
      const i = document.createElement('div');
      i.className = 'custom-select-option';
      i.dataset.value = c;
      const ns = document.createElement('span');
      ns.className = 'city-name';
      ns.textContent = c;
      i.appendChild(ns);
      const ss = document.createElement('span');
      ss.className = 'city-stats';
      const s = state.cityData[c]?.stats;
      ss.innerHTML = formatCityStatsHTML(s);
      ss.title = getStatsTooltip(s);
      i.appendChild(ss);
      i.onclick = () => {
        l.querySelectorAll('.active').forEach((el) => el.classList.remove('active'));
        i.classList.add('active');
        selectedTransferCity = c;
      };
      l.appendChild(i);
    });
  }
  document.getElementById('transferModal').classList.add('show');
}

function doTransfer() {
  if (!selectedTransferCity) {
    showToast('Выберите город-источник');
    return;
  }
  const tc = state.city;
  const sc = state.cityData[selectedTransferCity];
  if (!sc || !sc.stations) {
    showToast('В городе-источнике нет настроек');
    return;
  }
  const tSt = document.getElementById('transferStatuses').checked;
  const tPr = document.getElementById('transferPresets').checked;
  const ss = sc.stations;
  const sn = Object.keys(ss);
  if (sn.length === 0) {
    showToast('Нет данных');
    return;
  }
  if (!state.cityData[tc]) state.cityData[tc] = { stations: {}, allStations: [] };
  const cd = state.cityData[tc];
  cd.stations = cd.stations || {};
  // Preset guard: never touch buttons if target already has any assigned
  const hasPresets = Object.values(cd.stations).some((s) => s.presetIndex);
  let added = 0;

  if (tc === ALL_CITIES) {
    // Additive merge: append source's fav/cand missing here, keep everything else
    cd.allStations = cd.allStations || [];
    const seen = new Map(cd.allStations.map((s) => [FMUse.normalizeName(s.name), s.name]));
    const srcList = sc.allStations || [];
    if (tSt) sn.forEach((n) => {
      const sd = ss[n];
      if (sd.type !== 'fav' && sd.type !== 'cand') return;
      const key = FMUse.normalizeName(n);
      if (seen.has(key)) return;
      const src = srcList.find((s) => s.name === n);
      if (!src) return;
      seen.set(key, n);
      cd.allStations.push({ name: n, freq: src.freq });
      cd.stations[n] = { type: sd.type, presetIndex: null };
      added++;
    });
    if (tPr && !hasPresets) sn.forEach((n) => {
      if (!ss[n].presetIndex) return;
      const local = seen.get(FMUse.normalizeName(n));
      if (!local) return;
      cd.stations[local] = cd.stations[local] || { type: 'normal', presetIndex: null };
      cd.stations[local].presetIndex = ss[n].presetIndex;
    });
    cd.allStations.sort((a, b) => a.freq - b.freq);
    state.stations = cd.allStations.map((s) => ({ ...s }));
  } else {
    const tn = state.stations.map((s) => s.name);
    if (tn.length === 0) {
      showToast('Нет данных');
      return;
    }
    const m = FMUse.matchArrays(sn, tn, 0.65);
    if (tSt) m.forEach((mt) => {
      const sd = ss[mt.source];
      if (sd.type !== 'normal' && !cd.stations[mt.target]) {
        cd.stations[mt.target] = { type: sd.type, presetIndex: null };
        added++;
      }
    });
    if (tPr && !hasPresets) m.forEach((mt) => {
      const sd = ss[mt.source];
      if (!sd.presetIndex) return;
      cd.stations[mt.target] = cd.stations[mt.target] || { type: 'normal', presetIndex: null };
      cd.stations[mt.target].presetIndex = sd.presetIndex;
      added++;
    });
  }
  updateCityStats(tc);
  commitState();
  render();
  document.getElementById('transferModal').classList.remove('show');
  if (added > 0) showToast(`Добавлено: ${added}`);
  else if (tPr && hasPresets) showToast('Кнопки не перенесены: уже есть назначения');
  else showToast('Нечего добавлять');
}

function openExportModal() {
  const l = document.getElementById('exportCityList');
  l.innerHTML = '';
  let cws = [];
  Object.keys(state.cityData).forEach((c) => {
    const s = state.cityData[c]?.stats;
    const hd = s && (s.statused > 0 || s.presets > 0);
    if (hd || c === ALL_CITIES) cws.push({ name: c, time: state.cityData[c]?.lastModified || 0 });
  });
  cws.sort((a, b) => b.time - a.time);
  cws.sort((a, b) => (a.name === ALL_CITIES ? -1 : b.name === ALL_CITIES ? 1 : 0) || a.name.localeCompare(b.name, 'ru'));
  if (cws.length === 0) {
    l.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim);">Нет городов</div>';
  } else {
    cws.forEach((co) => {
      const c = co.name;
      const i = document.createElement('div');
      const lb = document.createElement('label');
      lb.className = 'checkbox-wrap';
      const ip = document.createElement('input');
      ip.type = 'checkbox';
      ip.value = c;
      if (c === state.city) ip.checked = true;
      else if (c === cws.length > 0 && c === cws[0].name) ip.checked = true;
      const cs = document.createElement('span');
      cs.className = 'checkbox-custom';
      const ns = document.createElement('span');
      ns.textContent = c;
      lb.appendChild(ip);
      lb.appendChild(cs);
      lb.appendChild(ns);
      i.appendChild(lb);
      l.appendChild(i);
    });
  }
  document.getElementById('toggleAllExportBtn').textContent = 'Выделить все';
  document.getElementById('exportModal').classList.add('show');
  const firstCb = l.querySelector('input[type="checkbox"]');
  if (firstCb && !l.querySelector('input:checked')) firstCb.checked = true;
}

function doExport() {
  const cb = document.querySelectorAll('#exportCityList input[type="checkbox"]:checked');
  if (cb.length === 0) {
    showToast('Выберите город');
    return;
  }
  const ed = { type: 'user-backup', appVersion: VERSION, exportDate: Date.now(), totalCities: Object.keys(citiesMap).length, source: 'AutoFMShift', cities: {} };
  cb.forEach((c) => {
    const ci = c.value;
    const cd = state.cityData[ci];
    if (!cd) return;
    let as = ci === state.city ? state.stations.map((s) => ({ name: s.name, freq: s.freq })) : cd.allStations || [];
    as.sort((a, b) => a.freq - b.freq);
    const se = as.map((st) => {
      const sd = cd.stations[st.name] || {};
      const strd = state.streamsData?.[FMUse.generateCodeName(st.name)] || {};
      return { name: st.name, freq: st.freq, type: sd.type || 'normal', presetIndex: sd.presetIndex || null, streams: strd.streams || [], favicon: strd.favicon || '', tags: strd.tags || '', homepage: strd.homepage || '' };
    });
    ed.cities[FMUse.generateCodeName(ci)] = { name: ci, lastModified: cd.lastModified || Date.now(), stations: se };
  });
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  const blob = new Blob([JSON.stringify(ed, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `AutoFMShift_Backup_${ds}.json`);
  document.getElementById('exportModal').classList.remove('show');
  showToast('Экспорт завершен');
}

async function handleFileImport(event) {
  const f = event.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async function (e) {
    try {
      const d = JSON.parse(e.target.result);
      if (!d.cities) throw new Error('Invalid format');
      if (d.type === 'api-cache') {
        if (!confirm('Импортировать бэкап API?')) return;
        await Api.importApiBackup(d, state, citiesMap, FMUse, true);
        localStorage.setItem('fm_cities_map', JSON.stringify(citiesMap));
        commitState();
        renderCitySelectMenu();
        await loadCity(state.city);
        render();
        showToast('Импорт завершен');
        document.getElementById('helpModal').classList.remove('show');
        return;
      } else {
        if (!confirm('Перезаписать настройки?')) return;
      }
      Object.keys(d.cities).forEach((cs) => {
        const ic = d.cities[cs];
        const cn = ic.name || cs;
        if (!state.cityData[cn]) state.cityData[cn] = { stations: {} };
        const ns = {};
        const na = [];
        const iss = Array.isArray(ic.stations) ? ic.stations : Object.values(ic.stations);
        iss.forEach((st) => {
          if (st.freq) na.push({ name: st.name, freq: st.freq });
          if (st.type !== 'normal' || st.presetIndex) ns[st.name] = { type: st.type || 'normal', presetIndex: st.presetIndex || null };
          if (st.streams && st.streams.length > 0) {
            const code = FMUse.generateCodeName(st.name);
            if (!state.streamsData) state.streamsData = {};
            state.streamsData[code] = { name: st.name, streams: st.streams, favicon: st.favicon || '', tags: st.tags || '', homepage: st.homepage || '' };
            stationStreamMap[code] = state.streamsData[code];
          }
        });
        state.cityData[cn].stations = ns;
        state.cityData[cn].allStations = na;
        state.cityData[cn].lastModified = ic.lastModified || Date.now();
        updateCityStats(cn);
      });
      Object.keys(d.cities).forEach((cs) => {
        const ic = d.cities[cs];
        const cn = ic.name || cs;
        if (!citiesMap[cn]) citiesMap[cn] = cn;
      });
      localStorage.setItem('fm_cities_map', JSON.stringify(citiesMap));
      document.getElementById('errorMsg').style.display = 'none';
      if (!state.cityData[state.city]) {
        const fcs = Object.keys(d.cities)[0];
        state.city = d.cities[fcs].name || fcs;
      }
      commitState();
      renderCitySelectMenu();
      await loadCity(state.city);
      render();
      showToast('Импорт завершен');
      document.getElementById('helpModal').classList.remove('show');
    } catch (err) {
      showToast('Ошибка JSON');
      console.error(err);
    }
  };
  r.readAsText(f);
  event.target.value = '';
}