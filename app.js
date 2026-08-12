// Rule: minor.major.build in VERSION build++ on module regeneration
const VERSION = "0.5.67";
const CACHE_VERSION = "4"; 
 
const LS_KEY = "fm_adapter_calc_v10"; 
const LS_THEME_KEY = "fm_adapter_theme";

const RU_MIN = 87.5;
const RU_MAX = 108.0;
const FM_BAND_MIN = 76.0;
const FM_BAND_MAX = 108.0;

const EXCELJS_BORDER = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
};

const TEMPLATES = [
    { name: "Россия / Европа", short: "ru/eu", range: [RU_MIN, RU_MAX] },
    { name: "Япония (до ~2014)", short: "jp-old", range: [76.0, 90.0] },
    { name: "Япония (≈2014–2020)", short: "jp-wide", range: [76.0, 95.0] },
    { name: "Япония (≈2020+)", short: "jp-ext", range: [76.0, 99.0] },
    { name: "США / Канада", short: "us/ca", range: [87.9, 107.9] },
    { name: "Китай", short: "cn", range: [87.5, 108.0] },
    { name: "Корея", short: "kr", range: [88.0, 108.0] },
    { name: "OIRT / СССР", short: "oirt", range: [65.9, 74.0] },
    { name: "Свой диапазон", short: "custom", range: [76.0, 108.0] }
];

const SHIFTS = [0, 10, 12, 14, 16, 18, 20, 24, 28, 30];
const EASY_SHIFTS = [0, 10, 20, 30, 12, 24, 14, 16, 18, 28];

const DEFAULT_STATE = {
    city: "Москва",
    template: "Россия / Европа",
    templateShort: "ru/eu",
    min: RU_MIN,
    max: RU_MAX,
    shift: 0,
    stations: [],
    settingsMode: false,
    viewMode: 'setup',
    bands: 1,
    presets: 6,
    cityData: {},
    lastModified: 0 
};

let state = { ...DEFAULT_STATE };
let citiesMap = JSON.parse(localStorage.getItem("fm_cities_map") || "{}");
let activePresetMenu = null;
let saveStateTimer = null;
let selectedTransferCity = null;
let lastDataSource = '';

// THEME
function initTheme() {
    const savedTheme = localStorage.getItem(LS_THEME_KEY);
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (systemDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem(LS_THEME_KEY)) {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            updateThemeIcon();
        }
    });
}
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(LS_THEME_KEY, newTheme);
    updateThemeIcon();
}
function updateThemeIcon() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const themeBtn = document.getElementById('themeBtn');
    themeBtn.textContent = currentTheme === 'dark' ? '☀' : '☾';
    themeBtn.setAttribute('aria-pressed', currentTheme === 'dark' ? 'true' : 'false');
}

// LOGIC
function evaluateShifts() {
    if (state.stations.length === 0) return { statuses: {}, best: 0 };
    if (state.min === RU_MIN && state.max === RU_MAX) return { statuses: {}, best: 0 };
    const statuses = {};
    const fullShifts = [];
    SHIFTS.forEach(s => {
        let validCount = 0;
        state.stations.forEach(st => {
            const shifted = st.freq - s;
            if (shifted >= state.min && shifted <= state.max) validCount++;
        });
        if (validCount === state.stations.length) { statuses[s] = { type: 'full' }; fullShifts.push(s); }
        else if (validCount > 0) { statuses[s] = { type: 'partial', ratio: validCount / state.stations.length }; }
        else { statuses[s] = { type: 'none' }; }
    });
    let best = -1;
    if (fullShifts.includes(0)) best = 0;
    else if (fullShifts.length > 0) best = EASY_SHIFTS.find(s => s > 0 && fullShifts.includes(s)) || Math.min(...fullShifts);
    return { statuses, best: best === -1 ? 0 : best };
}
function calcShiftedFreq(freq) {
    if (state.shift === 0 || (state.min === RU_MIN && state.max === RU_MAX)) return freq;
    return parseFloat((freq - state.shift).toFixed(2));
}
function formatFreq(f) {
    if (typeof f !== 'number' || isNaN(f)) return '—';
    return f.toFixed(1).replace('.', ',');
}
function isAvailable(freq) {
    const shifted = calcShiftedFreq(freq);
    return shifted >= state.min && shifted <= state.max;
}

// SETTINGS MODE LOGIC
function toggleSettings() {
    state.settingsMode = !state.settingsMode;
    commitState();
    applySettingsMode();
    render();
}
function applySettingsMode() {
    const isPlayer = state.viewMode === 'player';
    const showStatus = state.settingsMode || isPlayer;
    const display = state.settingsMode ? 'block' : 'none';
    document.getElementById('bands').style.display = display;
    document.getElementById('presets').style.display = display;
    document.getElementById('statusHeader').style.display = showStatus ? 'block' : 'none';
    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn.classList.toggle('active', state.settingsMode);
    settingsBtn.setAttribute('aria-pressed', state.settingsMode ? 'true' : 'false');
}
function toggleViewMode() {
    state.viewMode = state.viewMode === 'player' ? 'setup' : 'player';
    commitState();
    applyViewMode();
    render();
}
function applyViewMode() {
    document.body.classList.toggle('player-mode', state.viewMode === 'player');
    const modeBtn = document.getElementById('modeBtn');
    if (state.viewMode === 'player') {
        modeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>';
        modeBtn.title = "Режим: Плеер (нажмите для Настройки)";
    } else {
        modeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
        modeBtn.title = "Режим: Настройка (нажмите для Плеера)";
    }
    applySettingsMode();
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
    const data = ensureStationData(name);
    if (data.type === 'normal') data.type = 'fav';
    else if (data.type === 'fav') data.type = 'cand';
    else if (data.type === 'cand') data.type = 'trash';
    else data.type = 'normal';
    updateCityStats(state.city);
    commitState();
    render();
}
function formatPreset(presetIndex, bands, presets) {
    if (!presetIndex) return '';
    if (bands === 1) return `${presetIndex}`;
    const band = Math.ceil(presetIndex / presets);
    const preset = presetIndex % presets === 0 ? presets : presetIndex % presets;
    return `${band}.${preset}`;
}
function isPresetVisible(presetIndex) {
    return presetIndex && presetIndex <= (state.bands * state.presets);
}
function assignPreset(name, presetIndex) {
    const data = ensureStationData(name);
    const cityStations = state.cityData[state.city].stations;
    if (presetIndex) {
        Object.keys(cityStations).forEach(n => {
            if (cityStations[n].presetIndex === presetIndex && n !== name) cityStations[n].presetIndex = null;
        });
    }
    data.presetIndex = data.presetIndex === presetIndex ? null : presetIndex;
    updateCityStats(state.city);
    commitState();
    render();
}
function openPresetMenu(btn, name) {
    closePresetMenu();
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu preset-menu show';
    const maxPresets = state.bands * state.presets;
    const cityStations = state.cityData[state.city]?.stations || {};
    const currentData = getStationData(name);
    let firstFreeItem = null;
    for (let p = 1; p <= maxPresets; p++) {
        let occupiedBy = '';
        Object.keys(cityStations).forEach(n => {
            if (cityStations[n].presetIndex === p) { occupiedBy = n; }
        });
        const item = document.createElement('div');
        const isCurrent = currentData.presetIndex === p;
        item.className = 'dropdown-item preset-item' + (occupiedBy && !isCurrent ? ' occupied' : '');
        if (isCurrent) item.classList.add('current');
        const numSpan = document.createElement('span');
        numSpan.className = 'preset-num';
        numSpan.textContent = formatPreset(p, state.bands, state.presets);
        item.appendChild(numSpan);
        const nameSpan = document.createElement('span');
        nameSpan.className = 'preset-name';
        nameSpan.textContent = occupiedBy ? occupiedBy : 'Свободно';
        if (occupiedBy) nameSpan.title = occupiedBy;
        item.appendChild(nameSpan);
        item.onclick = (e) => { e.stopPropagation(); assignPreset(name, p); closePresetMenu(); };
        menu.appendChild(item);
        if (!occupiedBy && !firstFreeItem) firstFreeItem = item;
    }
    const clearItem = document.createElement('div');
    clearItem.className = 'dropdown-item preset-item preset-clear';
    clearItem.textContent = '✕ Очистить';
    clearItem.onclick = (e) => { e.stopPropagation(); assignPreset(name, null); closePresetMenu(); };
    menu.appendChild(clearItem);
    btn.parentElement.appendChild(menu);
    activePresetMenu = menu;
    if (firstFreeItem) firstFreeItem.scrollIntoView({ block: 'center' });
}
function closePresetMenu() {
    if (activePresetMenu) { activePresetMenu.remove(); activePresetMenu = null; }
}

// UI RENDER
function renderAdapters() {
    const panel = document.getElementById("adapterPanel");
    const chips = document.getElementById("adapterChips");
    chips.innerHTML = "";
    const isStandard = state.min === RU_MIN && state.max === RU_MAX;
    if (isStandard) { panel.style.display = "none"; return; }
    panel.style.display = "block";
    const { statuses, best } = evaluateShifts();
    updateAccentColor(statuses);
    const addChip = (shift, statusData) => {
        const chip = document.createElement("button");
        const statusType = statusData.type;
        const ratio = statusData.ratio || 0;
        chip.className = `chip ${statusType || ''}`;
        let tipText = shift === 0 ? "Без сдвига. " : `Сдвиг ${shift} МГц. `;
        if (statusType === 'full') tipText += "Все станции доступны.";
        else if (statusType === 'partial') tipText += `Доступно ${Math.round(ratio * 100)}% станций.`;
        else tipText += "Станции недоступны.";
        if (shift === best && statusType === 'full') tipText += " Лучший выбор!";
        chip.setAttribute('title', tipText);
        if (shift === best && statusType === 'full') chip.classList.add('best');
        if (shift === state.shift) chip.classList.add("active");
        chip.textContent = shift === 0 ? "0" : shift;
        
        if (statusType === 'partial') {
            const r = Math.round(255 - 14 * ratio);
            const g = Math.round(71 + 125 * ratio);
            const b = Math.round(87 - 72 * ratio);
            const color = `rgb(${r}, ${g}, ${b})`;
            chip.style.color = color; chip.style.borderColor = color;
            if (shift === state.shift) { chip.style.backgroundColor = color; chip.style.color = 'var(--bg)'; }
        } else if (shift === 0 && shift === state.shift) {
            chip.style.color = 'var(--bg)';
            chip.style.borderColor = 'var(--accent)';
            chip.style.backgroundColor = 'var(--accent)';
        }
        chip.onclick = (e) => { state.shift = shift; commitState(); render(); };
        chips.appendChild(chip);
    };
    SHIFTS.forEach(s => addChip(s, statuses[s] || { type: 'none' }));
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
            const darkYellow = { r: 241, g: 196, b: 15 };
            const darkPink = { r: 255, g: 71, b: 87 };
            const lightYellow = { r: 243, g: 156, b: 18 };
            const lightPink = { r: 231, g: 76, b: 60 };
            
            const start = isDark ? darkYellow : lightYellow;
            const end = isDark ? darkPink : lightPink;
            
            const r = Math.round(start.r + (end.r - start.r) * (1 - ratio));
            const g = Math.round(start.g + (end.g - start.g) * (1 - ratio));
            const b = Math.round(start.b + (end.b - start.b) * (1 - ratio));
            
            accentColor = `rgb(${r}, ${g}, ${b})`;
        } else { 
            accentColor = getComputedStyle(root).getPropertyValue('--pink').trim() || '#ff4757';
        }
    }
    
    root.style.setProperty('--accent', accentColor);
    root.style.setProperty('--knob', accentColor); 
}

function renderStations() {
    const list = document.getElementById("stationsList");
    list.innerHTML = "";
    if (state.stations.length === 0) { 
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'loading-msg';
        emptyDiv.textContent = 'Нет данных';
        list.appendChild(emptyDiv);
        return; 
    }
    const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
    const isStandard = state.min === RU_MIN && state.max === RU_MAX;
    const isPlayer = state.viewMode === 'player';
    const frag = document.createDocumentFragment();
    sorted.forEach(st => {
        const item = document.createElement("div");
        item.className = "station-item";
        item.dataset.source = state.stationsSource || 'cache';
        const shiftedNum = calcShiftedFreq(st.freq);
        const isAvail = isAvailable(st.freq);
        const freqClass = isAvail ? 'ok' : 'err';
        if (!isAvail) item.classList.add("unavailable");
        const streamData = stationStreamMap[FMUse.generateCodeName(st.name)];
        
        const logoDiv = document.createElement('div');
        logoDiv.className = 'station-logo';
        if (streamData && streamData.favicon && streamData.favicon !== 'null' && streamData.favicon !== 'undefined') {
            const img = document.createElement('img');
            img.src = streamData.favicon;
            img.alt = '';
            img.onerror = () => logoDiv.classList.add('no-logo');
            logoDiv.appendChild(img);
        } else {
            logoDiv.classList.add('no-logo');
        }
        item.appendChild(logoDiv);

        const freqDiv = document.createElement('div');
        freqDiv.className = 'freq';
        freqDiv.textContent = formatFreq(st.freq);
        const freqHint = `Оригинальная частота: ${formatFreq(st.freq)} МГц`;
        freqDiv.title = freqHint;
        freqDiv.style.cursor = 'pointer';
        freqDiv.addEventListener('click', (e) => { e.stopPropagation(); showToast(freqHint); });
        item.appendChild(freqDiv);
        if (state.settingsMode || isPlayer) {
            const data = getStationData(st.name);
            if (data.type === 'trash') item.classList.add('trash');
            let iconClass = 'normal';
            let iconChar = '○';
            let iconTitle = 'Кликни для выбора - любимое, интересное, пропушенное';
            if (data.type === 'fav') { iconClass = 'fav'; iconChar = '♥'; iconTitle = 'Любимое'; }
            else if (data.type === 'cand') { iconClass = 'cand'; iconChar = '★'; iconTitle = 'Интересное'; }
            else if (data.type === 'trash') { iconClass = 'trash'; iconChar = '⊘'; iconTitle = 'Пропущено (исключается из экспорта и прокрутки станций)'; }
            const visible = isPresetVisible(data.presetIndex);
            const presetStr = visible ? formatPreset(data.presetIndex, state.bands, state.presets) : '';
            const displayStr = visible ? presetStr : '+';
            const isActive = visible;
            const btnTitle = isActive ? `Кнопка ${presetStr}` : 'Назначить кнопку магнитолы';
            const statusCell = document.createElement('div');
            statusCell.className = 'status-cell';
            const iconSpan = document.createElement('span');
            iconSpan.className = `status-icon ${iconClass}`;
            iconSpan.dataset.name = st.name;
            iconSpan.textContent = iconChar;
            iconSpan.setAttribute('tabindex', '0');
            iconSpan.setAttribute('role', 'button');
            if (iconTitle) iconSpan.title = iconTitle;
            statusCell.appendChild(iconSpan);
            const presetDropdown = document.createElement('div');
            presetDropdown.className = 'preset-dropdown';
            const presetBtn = document.createElement('button');
            presetBtn.className = `preset-btn ${isActive ? 'active' : ''}`;
            presetBtn.dataset.name = st.name;
            presetBtn.textContent = displayStr;
            if (btnTitle) presetBtn.title = btnTitle;
            presetDropdown.appendChild(presetBtn);
            statusCell.appendChild(presetDropdown);
            item.appendChild(statusCell);
        }
        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        
        const nameText = document.createElement('span');
        nameText.className = 'name-text';
        nameText.textContent = st.name;
        nameText.style.cursor = 'pointer';
        nameText.setAttribute('title', st.name);
        nameText.addEventListener('click', (e) => {
            e.stopPropagation();
            showToast(st.name);
        });
        nameDiv.appendChild(nameText);

        if (streamData && (streamData.tags || (streamData.streams && streamData.streams.length > 0 && streamData.streams[0].name))) {
            const tagsSpan = document.createElement('span');
            tagsSpan.className = 'tags';
            let tagsText = streamData.tags || "";
            if (streamData.streams && streamData.streams.length > 0 && streamData.streams[0].name) {
                const cleanedName = FMUse.cleanStreamName(streamData.streams[0].name, st.name, state.city, tagsText);
                if (cleanedName) {
                    tagsText = tagsText ? `${tagsText} (${cleanedName})` : `(${cleanedName})`;
                }
            }
            tagsSpan.textContent = tagsText;
            tagsSpan.title = tagsText;
            tagsSpan.style.cursor = 'pointer';
            tagsSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                showToast(tagsText);
            });
            nameDiv.appendChild(tagsSpan);
        }

        const playBtn = document.createElement('button');
        playBtn.className = 'play-btn-row';
        const hasStream = streamData && streamData.streams && streamData.streams.length > 0;
        if (!hasStream || streamData.broken) {
            playBtn.classList.add('hidden');
        }
        playBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        playBtn.dataset.name = st.name;
        if (hasStream) {
            const bitrates = streamData.streams.map(s => s.bitrate ? `${s.bitrate}k` : '?').join(', ');
            playBtn.title = `Потоки: ${bitrates}`;
            playBtn.onclick = (e) => { e.stopPropagation(); togglePlay(st.name); };
        }
        nameDiv.appendChild(playBtn);
        item.appendChild(nameDiv);
        if (!isStandard) {
            const shiftedDiv = document.createElement('div');
            shiftedDiv.className = `shifted-freq ${freqClass}`;
            shiftedDiv.textContent = shiftedNum >= FM_BAND_MIN ? formatFreq(shiftedNum) : "—";
            const shiftedHint = shiftedNum >= FM_BAND_MIN ? `На ГУ (с адаптером): ${formatFreq(shiftedNum)} МГц` : "Вне диапазона ГУ";
            shiftedDiv.title = shiftedHint;
            shiftedDiv.style.cursor = 'pointer';
            shiftedDiv.addEventListener('click', (e) => { e.stopPropagation(); showToast(shiftedHint); });
            item.appendChild(shiftedDiv);
        }
        frag.appendChild(item);
    });
    list.appendChild(frag);
}

// CITY STATS & UI
function pluralize(num, one, few, many) {
    const mod10 = num % 10;
    const mod100 = num % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
}
function updateCityStats(city) {
    if (!state.cityData[city]) state.cityData[city] = { stations: {} };
    if (!state.cityData[city].allStations && state.city === city && state.stations.length > 0) {
        state.cityData[city].allStations = state.stations.map(s => ({ name: s.name, freq: s.freq }));
    }
    if (state.city === city && state.stations.length > 0) {
        state.cityData[city].totalStations = state.stations.length;
    }
    const cityStations = state.cityData[city].stations || {};
    const cleanStations = {};
    let fav = 0, cand = 0, trash = 0, presets = 0;
    Object.keys(cityStations).forEach(name => {
        const s = cityStations[name];
        if (s.type !== 'normal' || s.presetIndex) {
            cleanStations[name] = s;
            if (s.type === 'fav') fav++;
            else if (s.type === 'cand') cand++;
            else if (s.type === 'trash') trash++;
            if (s.presetIndex && isPresetVisible(s.presetIndex)) presets++;
        }
    });
    state.cityData[city].stations = cleanStations;
    state.cityData[city].stats = {
        total: state.cityData[city].totalStations || 0,
        fav: fav, cand: cand, trash: trash,
        statused: fav + cand + trash,
        presets: presets
    };
    state.cityData[city].lastModified = Date.now();
}
function getStatsTooltip(stats) {
    if (!stats) return '';
    const textParts = [];
    if (stats.total) textParts.push(`${stats.total} ${pluralize(stats.total, 'станция', 'станции', 'станций')}`);
    if (stats.fav) textParts.push(`${stats.fav} ${pluralize(stats.fav, 'любимое', 'любимые', 'любимых')}`);
    if (stats.cand) textParts.push(`${stats.cand} ${pluralize(stats.cand, 'интересная', 'интересные', 'интересных')}`);
    if (stats.trash) textParts.push(`${stats.trash} ${pluralize(stats.trash, 'пропущена', 'пропущены', 'пропущено')}`);
    if (stats.presets) textParts.push(`${stats.presets} ${pluralize(stats.presets, 'кнопка', 'кнопки', 'кнопок')}`);
    return textParts.join(', ');
}
function formatCityStatsHTML(stats) {
    if (!stats || (stats.total === 0 && stats.statused === 0 && stats.presets === 0)) return '';
    const subMap = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};
    const sub = (num) => String(num).split('').map(d => subMap[d] || d).join('');
    const parts = [];
    if (stats.total) parts.push(`📻${sub(stats.total)}`);
    if (stats.statused) parts.push(`☑${sub(stats.statused)}`);
    if (stats.presets) parts.push(`▣${sub(stats.presets)}`);
    return parts.join(' ');
}

function renderCitySelectMenu() {
    const citySelectMenu = document.getElementById("citySelectMenu");
    const citySelectTrigger = document.getElementById("citySelectTrigger");
    if (!citySelectMenu || !citySelectTrigger) return;
    
    citySelectMenu.innerHTML = "";
    const allCities = new Set([...Object.keys(citiesMap), ...Object.keys(state.cityData)]);
    Array.from(allCities).sort().forEach(c => {
        const item = document.createElement("div");
        item.className = "custom-select-option";
        item.dataset.value = c;
        if (c === state.city) item.classList.add('active');
        const nameSpan = document.createElement("span");
        nameSpan.className = "city-name";
        nameSpan.textContent = c;
        nameSpan.title = c; 
        item.appendChild(nameSpan);
        const statsSpan = document.createElement("span");
        statsSpan.className = "city-stats";
        const statsInit = state.cityData[c]?.stats;
        statsSpan.innerHTML = formatCityStatsHTML(statsInit);
        statsSpan.title = getStatsTooltip(statsInit);
        item.appendChild(statsSpan);
        item.onclick = (e) => {
            e.stopPropagation();
            state.city = c;
            commitState();
            loadCity(c);
            citySelectMenu.classList.remove('show');
        };
        citySelectMenu.appendChild(item);
    });

    citySelectTrigger.onclick = (e) => {
        e.stopPropagation();
        citySelectMenu.classList.toggle('show');
        const activeItem = citySelectMenu.querySelector('.active');
        if (activeItem) activeItem.scrollIntoView({ block: 'center' });
    };
}

function render() {
    const minInput = document.getElementById("minFreq");
    const maxInput = document.getElementById("maxFreq");
    const citySelectTrigger = document.getElementById("citySelectTrigger");
    const citySelectMenu = document.getElementById("citySelectMenu");
    const transferBtn = document.getElementById('transferBtn');
    
    if (document.activeElement !== minInput) minInput.value = state.min;
    if (document.activeElement !== maxInput) maxInput.value = state.max;
    if (document.activeElement !== document.getElementById('bands')) document.getElementById('bands').value = state.bands;
    if (document.activeElement !== document.getElementById('presets')) document.getElementById('presets').value = state.presets;
    
    if (citySelectTrigger) {
        const c = state.city;
        updateCityStats(c);
        citySelectTrigger.textContent = c;
        const oldActive = citySelectMenu.querySelector('.active');
        if (oldActive) oldActive.classList.remove('active');
        const items = citySelectMenu.querySelectorAll('.custom-select-option');
        items.forEach(item => {
            if (item.dataset.value === c) {
                item.classList.add('active');
                const stats = state.cityData[c]?.stats;
                const statsSpan = item.querySelector('.city-stats');
                statsSpan.innerHTML = formatCityStatsHTML(stats);
                statsSpan.title = getStatsTooltip(stats); 
            }
        });
    }
    document.getElementById("templatesBtn").textContent = state.templateShort || "свой";
    renderAdapters(); 
    renderStations();
    
    if (state.settingsMode) {
        transferBtn.style.display = 'flex';
        transferBtn.classList.remove('blink');
        transferBtn.title = "Скопировать настройки от другого города";
    } else {
        transferBtn.style.display = 'none';
        transferBtn.classList.remove('blink');
    }
}

// STATE & PERSISTENCE
function commitState() {
    state.lastModified = Date.now();
    
    const cleanCityData = {};
    Object.keys(state.cityData).forEach(c => {
        const stats = state.cityData[c]?.stats;
        const hasData = stats && (stats.statused > 0 || stats.presets > 0);
        const hasStations = state.cityData[c]?.allStations?.length > 0;
        if (hasData || hasStations) {
            cleanCityData[c] = state.cityData[c];
        }
    });
    state.cityData = cleanCityData;
    
    // Clean broken flags before saving
    const stateToSave = JSON.parse(JSON.stringify(state));
    if (stateToSave.streamsData) {
        Object.values(stateToSave.streamsData).forEach(data => {
            data.broken = false;
            if (data.streams) data.streams.forEach(s => s.broken = false);
        });
    }
    
    localStorage.setItem(LS_KEY, JSON.stringify(stateToSave));
    updateUrl();
}
function saveState() {
    clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(commitState, 300);
}
function updateUrl() {
    const params = new URLSearchParams({
        city: state.city, min: state.min, max: state.max, shift: state.shift,
        mode: state.settingsMode ? 1 : 0, bands: state.bands, presets: state.presets
    });
    if (state.viewMode === 'player') params.set('view', 'player');
    if (currentPlayingStation) {
        params.set('play', currentPlayingStation);
        params.set('stream', currentStreamIndex);
    }
    history.replaceState(null, "", `#${params.toString()}`);
}
function loadFromUrl() {
    if (location.hash.length < 2) return false;
    const params = new URLSearchParams(location.hash.slice(1));
    const city = params.get("city"); if (city) state.city = city;
    const min = parseFloat(params.get("min")); if (!isNaN(min) && min >= 64 && min <= 110) state.min = min;
    const max = parseFloat(params.get("max")); if (!isNaN(max) && max >= 64 && max <= 110 && max > state.min) state.max = max;
    const shift = parseInt(params.get("shift")); if (!isNaN(shift) && shift >= 0 && shift <= 30) state.shift = shift;
    const mode = params.get("mode"); if (mode === "1") state.settingsMode = true;
    const view = params.get("view"); state.viewMode = view === 'player' ? 'player' : 'setup';
    const bands = parseInt(params.get("bands")); if (!isNaN(bands) && bands >= 1 && bands <= 5) state.bands = bands;
    const presets = parseInt(params.get("presets")); if (!isNaN(presets) && presets >= 1 && presets <= 18) state.presets = presets;
    const matched = TEMPLATES.find(t => t.range[0] === state.min && t.range[1] === state.max);
    state.template = matched ? matched.name : "Свой вариант";
    state.templateShort = matched ? matched.short : "свой";
    return true;
}
function loadFromLS() {
    const ls = localStorage.getItem(LS_KEY);
    if (!ls) return false;
    try { state = { ...state, ...JSON.parse(ls) }; return true; } catch { return false; }
}
function resetAll() {
    const keysToRemove = ["fm_adapter_calc", "fm_adapter_calc_v2", "fm_adapter_calc_v3", "fm_adapter_calc_v4", "fm_adapter_calc_v5", "fm_adapter_calc_v6", "fm_adapter_calc_v7", "fm_adapter_calc_v8", "fm_adapter_calc_v9", LS_KEY, LS_THEME_KEY, "geo_checked", "fm_cities_map"];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem("fm_cache_version", CACHE_VERSION);
    history.replaceState(null, "", window.location.pathname);
    showToast("Полный сброс выполнен");
    setTimeout(() => window.location.reload(), 600);
}
function resetCurrentCity() {
    const city = state.city;
    if (!citiesMap[city]) return;
    if (state.cityData[city]) {
        state.cityData[city].stations = {};
    }
    commitState(); 
    showToast("Сброс станций текущего города...");
    loadCity(city);
    document.getElementById("helpModal").classList.remove("show");
}
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180; 
    const dLon = (lon2 - lon1) * Math.PI / 180;
    let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    a = Math.min(1, Math.max(0, a)); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c;
}

// TRANSFER LOGIC
function openTransferModal() {
    const list = document.getElementById('transferCityList');
    list.innerHTML = '';
    selectedTransferCity = null;
    let citiesWithStats = [];
    Object.keys(state.cityData).forEach(c => {
        const stats = state.cityData[c]?.stats;
        const hasData = stats && (stats.statused > 0 || stats.presets > 0);
        if (hasData && c !== state.city) {
            citiesWithStats.push({ name: c, time: state.cityData[c]?.lastModified || 0 });
        }
    });
    citiesWithStats.sort((a, b) => b.time - a.time);
    if (citiesWithStats.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim);">Нет городов с сохраненными настройками</div>';
    } else {
        citiesWithStats.forEach(cityObj => {
            const c = cityObj.name;
            const item = document.createElement("div");
            item.className = "custom-select-option";
            item.dataset.value = c;
            const nameSpan = document.createElement("span");
            nameSpan.className = "city-name";
            nameSpan.textContent = c;
            item.appendChild(nameSpan);
            const statsSpan = document.createElement("span");
            statsSpan.className = "city-stats";
            const stats = state.cityData[c]?.stats;
            statsSpan.innerHTML = formatCityStatsHTML(stats);
            statsSpan.title = getStatsTooltip(stats);
            item.appendChild(statsSpan);
            item.onclick = () => {
                list.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                selectedTransferCity = c;
            };
            list.appendChild(item);
        });
    }
    document.getElementById('transferModal').classList.add('show');
}
function doTransfer() {
    if (!selectedTransferCity) {
        showToast("Выберите город-источник");
        return;
    }
    
    const targetCity = state.city;
    const sourceCityData = state.cityData[selectedTransferCity];
    if (!sourceCityData || !sourceCityData.stations) {
        showToast("В городе-источнике нет настроек");
        return;
    }
    
    const targetStats = state.cityData[targetCity]?.stats;
    if (targetStats && (targetStats.statused > 0 || targetStats.presets > 0)) {
        if (!confirm('У текущего города уже есть настройки. Вы уверены, что хотите их перезаписать?')) return;
    }
    
    const transferStatuses = document.getElementById('transferStatuses').checked;
    const transferPresets = document.getElementById('transferPresets').checked;
    
    const sourceStations = sourceCityData.stations;
    const sourceNames = Object.keys(sourceStations);
    const targetNames = state.stations.map(s => s.name);
    
    if (sourceNames.length === 0 || targetNames.length === 0) {
        showToast("Нет данных для копирования");
        return;
    }
    
    const matches = FMUse.matchArrays(sourceNames, targetNames, 0.65); 
    let newTargetData = {};
    let transferredCount = 0;
    
    matches.forEach(m => {
        const sourceData = JSON.parse(JSON.stringify(sourceStations[m.source]));
        let newData = { type: 'normal', presetIndex: null };
        if (sourceData.type !== 'normal' && transferStatuses) newData.type = sourceData.type;
        if (sourceData.presetIndex && transferPresets) newData.presetIndex = sourceData.presetIndex;
        
        if (newData.type !== 'normal' || newData.presetIndex) {
            newTargetData[m.target] = newData;
            transferredCount++;
        }
    });
    
    if (!state.cityData[targetCity]) state.cityData[targetCity] = { stations: {} };
    state.cityData[targetCity].stations = newTargetData;
    updateCityStats(targetCity);
    
    commitState();
    render();
    
    document.getElementById('transferModal').classList.remove('show');
    
    if (transferredCount > 0) {
        showToast(`Скопировано: ${transferredCount} из ${matches.length} пар`);
    } else if (matches.length > 0) {
        showToast(`Совпадений: ${matches.length}, но нет настроек для копирования`);
    } else {
        showToast("Совпадающих станций не найдено");
    }
}

// EXPORT / IMPORT JSON
function openExportModal() {
    const list = document.getElementById('exportCityList');
    list.innerHTML = '';
    
    let citiesWithStats = [];
    Object.keys(state.cityData).forEach(c => {
        const stats = state.cityData[c]?.stats;
        const hasData = stats && (stats.statused > 0 || stats.presets > 0);
        if (hasData) {
            citiesWithStats.push({ name: c, time: state.cityData[c]?.lastModified || 0 });
        }
    });
    citiesWithStats.sort((a, b) => b.time - a.time);
    
    if (citiesWithStats.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim);">Нет городов с сохраненными настройками</div>';
    } else {
        citiesWithStats.forEach(cityObj => {
            const c = cityObj.name;
            const item = document.createElement("div");
            item.className = "export-city-item";
            
            const label = document.createElement("label");
            label.className = "checkbox-wrap";
            
            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = c;
            if (c === state.city) input.checked = true;
            else if (citiesWithStats.length > 0 && c === citiesWithStats[0].name) input.checked = true;
            
            const customSpan = document.createElement("span");
            customSpan.className = "checkbox-custom";
            
            const nameSpan = document.createElement("span");
            nameSpan.textContent = c;
            
            label.appendChild(input);
            label.appendChild(customSpan);
            label.appendChild(nameSpan);
            item.appendChild(label);
            list.appendChild(item);
        });
    }
    document.getElementById('toggleAllExportBtn').textContent = 'Выделить все';
    document.getElementById('exportModal').classList.add('show');
}

function doExport() {
    const selectedCheckboxes = document.querySelectorAll('#exportCityList input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
        showToast("Выберите хотя бы один город");
        return;
    }
    
    const exportData = {
        type: "user-backup",
        appVersion: VERSION,
        exportDate: Date.now(),
        totalCities: Object.keys(citiesMap).length,
        source: "AutoFMShift User Backup",
        cities: {}
    };
    
    selectedCheckboxes.forEach(cb => {
        const c = cb.value;
        const cityData = state.cityData[c];
        if (!cityData) return;
        
        let allStations = (c === state.city) 
            ? state.stations.map(s => ({ name: s.name, freq: s.freq })) 
            : (cityData.allStations || []);
            
        allStations.sort((a, b) => a.freq - b.freq);
        
        const stationsExport = allStations.map(st => {
            const sData = cityData.stations[st.name] || {};
            const streamData = state.streamsData?.[FMUse.generateCodeName(st.name)] || {};
            return {
                name: st.name,
                freq: st.freq,
                type: sData.type || 'normal',
                presetIndex: sData.presetIndex || null,
                streams: streamData.streams || [],
                favicon: streamData.favicon || "",
                tags: streamData.tags || "",
                homepage: streamData.homepage || ""
            };
        });
        
        exportData.cities[FMUse.generateCodeName(c)] = {
            name: c,
            lastModified: cityData.lastModified || Date.now(),
            stations: stationsExport
        };
    });
    
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `AutoFMShift_Backup_${dateStr}.json`);
    document.getElementById('exportModal').classList.remove('show');
    showToast("Экспорт завершен");
}

async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.cities) throw new Error("Invalid format");
            
            if (data.type === 'api-cache') {
                if (!confirm('Импортировать резервный кэш API? Это дополнит вашу базу городов станциями без удаления текущих настроек.')) return;
                await Api.importApiBackup(data, state, citiesMap, FMUse, true);
                localStorage.setItem("fm_cities_map", JSON.stringify(citiesMap));
                commitState();
                renderCitySelectMenu();
                await loadCity(state.city);
                render();
                showToast("Импорт бэкапа API завершен");
                document.getElementById("helpModal").classList.remove("show");
                return;
            } else {
                if (!confirm('Импорт перезапишет настройки для городов, найденных в файле. Продолжить?')) return;
            }
            
            Object.keys(data.cities).forEach(citySlug => {
                const impCity = data.cities[citySlug];
                const cityName = impCity.name || citySlug;
                
                if (!state.cityData[cityName]) state.cityData[cityName] = { stations: {} };
                
                const newSettings = {};
                const newAllStations = [];
                
                const impStations = Array.isArray(impCity.stations) 
                    ? impCity.stations 
                    : Object.values(impCity.stations);
                    
                    impStations.forEach(st => {
                        if (st.freq) newAllStations.push({ name: st.name, freq: st.freq });
                        if (st.type !== 'normal' || st.presetIndex) {
                            newSettings[st.name] = {
                                type: st.type || 'normal',
                                presetIndex: st.presetIndex || null
                            };
                        }
                        if (st.streams && st.streams.length > 0) {
                            const code = FMUse.generateCodeName(st.name);
                            if (!state.streamsData) state.streamsData = {};
                            state.streamsData[code] = {
                                name: st.name,
                                streams: st.streams,
                                favicon: st.favicon || "",
                                tags: st.tags || "",
                                homepage: st.homepage || ""
                            };
                            stationStreamMap[code] = state.streamsData[code];
                        }
                    });
                
                state.cityData[cityName].stations = newSettings;
                state.cityData[cityName].allStations = newAllStations;
                state.cityData[cityName].lastModified = impCity.lastModified || Date.now();
                updateCityStats(cityName);
            });
            
            Object.keys(data.cities).forEach(citySlug => {
                const impCity = data.cities[citySlug];
                const cityName = impCity.name || citySlug;
                if (!citiesMap[cityName]) citiesMap[cityName] = cityName;
            });
            localStorage.setItem("fm_cities_map", JSON.stringify(citiesMap));
            
            document.getElementById("errorMsg").style.display = "none";
            
            if (!state.cityData[state.city]) {
                const firstCitySlug = Object.keys(data.cities)[0];
                state.city = data.cities[firstCitySlug].name || firstCitySlug;
            }
            
            commitState();
            renderCitySelectMenu();
            await loadCity(state.city);
            render();
            showToast("Импорт успешно завершен");
            document.getElementById("helpModal").classList.remove("show");
        } catch (err) {
            showToast("Ошибка чтения файла JSON");
            console.error(err);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

// EVENTS
function initMobilePlayerControls() {
    if (document.getElementById('mobilePlayerControls')) return;
    const header = document.querySelector('.app-header');
    const controls = document.createElement('div');
    controls.id = 'mobilePlayerControls';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'player-btn';
    prevBtn.title = "Предыдущая";
    prevBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>';
    prevBtn.onclick = () => skipStation(-1);
    
    const playBtn = document.createElement('button');
    playBtn.className = 'player-btn';
    playBtn.id = 'mobilePlayBtn';
    playBtn.title = "Воспроизведение/Пауза";
    playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    playBtn.onclick = () => {
        cancelRestorePlayback();
        if (currentPlayingStation) {
            if (audioPlayer.paused) {
                if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                    setPlayerLoading(true, "Подключение к потоку...");
                    attemptPlay(currentPlayingStation, currentStreamIndex).then(played => {
                        if (played) {
                            localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(currentPlayingStation), currentStreamIndex);
                            updatePlayerUI();
                            updateUrl();
                        } else {
                            showToast("Поток недоступен");
                            stopPlayer();
                        }
                    });
                } else {
                    setPlayerLoading(true, "Возобновление...");
                    audioPlayer.play().catch(() => { setPlayerLoading(false); updatePlayerUI(); });
                }
            } else {
                audioPlayer.pause();
            }
            updatePlayerUI();
        }
    };

    const stopBtn = document.createElement('button');
    stopBtn.className = 'player-btn';
    stopBtn.title = "Стоп";
    stopBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>';
    stopBtn.onclick = () => { stopPlayer(); renderStations(); };

    const nextBtn = document.createElement('button');
    nextBtn.className = 'player-btn';
    nextBtn.title = "Следующая";
    nextBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>';
    nextBtn.onclick = () => skipStation(1);

    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.id = 'mobileVolumeSlider';
    volSlider.className = 'mobile-volume-slider';
    volSlider.min = '0'; volSlider.max = '1'; volSlider.step = '0.01';
    volSlider.title = 'Громкость';
    
    controls.appendChild(prevBtn);
    controls.appendChild(playBtn);
    controls.appendChild(stopBtn);
    controls.appendChild(nextBtn);
    controls.appendChild(volSlider);
    header.appendChild(controls);
}

async function init() {
    const savedCacheVersion = localStorage.getItem("fm_cache_version");
    if (savedCacheVersion === null) {
        localStorage.setItem("fm_cache_version", CACHE_VERSION);
    } else if (savedCacheVersion !== CACHE_VERSION) {
        document.getElementById('cacheModal').classList.add('show');
        return;
    }

    initTheme();
    await loadCyrillicFont();
    document.getElementById('appVersion').textContent = 'v' + VERSION;
    document.getElementById('logoBtn').title = `AutoFMShift v${VERSION}`;
    
    const citySelectMenu = document.getElementById("citySelectMenu");
    const citySelectTrigger = document.getElementById("citySelectTrigger");
    const templatesMenu = document.getElementById("templatesMenu");
    const stationsList = document.getElementById("stationsList");
    
    if (!citySelectMenu || !templatesMenu || !stationsList) {
        console.error("DOM initialization failed: missing elements.");
        return;
    }
    
    TEMPLATES.forEach(t => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = t.name; 
        item.onclick = () => {
            state.template = t.name; state.templateShort = t.short;
            state.min = t.range[0]; state.max = t.range[1]; state.shift = 0;
            commitState(); render();
            templatesMenu.classList.remove("show");
        };
        templatesMenu.appendChild(item);
    });
    
    stationsList.addEventListener('click', (e) => {
        const icon = e.target.closest('.status-icon');
        const btn = e.target.closest('.preset-btn');
        if (icon) { e.stopPropagation(); cycleStationStatus(icon.dataset.name); } 
        else if (btn) { e.stopPropagation(); openPresetMenu(btn, btn.dataset.name); }
    });

    const hoverTrigger = document.getElementById('hoverTrigger');
    const bgBandit = document.getElementById('bgBandit');
    if (hoverTrigger && bgBandit) {
        const showBg = () => bgBandit.classList.add('hovered');
        const hideBg = () => bgBandit.classList.remove('hovered');
        hoverTrigger.addEventListener('mouseenter', showBg);
        hoverTrigger.addEventListener('mouseleave', hideBg);
        hoverTrigger.addEventListener('touchstart', (e) => { e.preventDefault(); showBg(); }, { passive: false });
        hoverTrigger.addEventListener('touchend', hideBg);
        hoverTrigger.addEventListener('touchcancel', hideBg);
    }
    
    document.getElementById('downloadBtn').addEventListener('click', (e) => {
        e.stopPropagation(); document.getElementById("downloadMenu").classList.toggle("show"); document.getElementById("templatesMenu").classList.remove("show");
    });
    document.querySelectorAll('#downloadMenu .dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const format = e.target.getAttribute('data-format');
            if (format === 'png') exportPNG();
            if (format === 'pdf') exportPDF();
            if (format === 'xlsx') exportXLSX();
            if (format === 'json') openExportModal();
            document.getElementById("downloadMenu").classList.remove("show");
        });
    });
    
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', handleFileImport);
    
    document.getElementById('toggleAllExportBtn').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#exportCityList input[type="checkbox"]');
        const btn = document.getElementById('toggleAllExportBtn');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
        btn.textContent = allChecked ? 'Выделить все' : 'Снять все';
    });

    document.getElementById('apiBackupBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        if (Object.keys(citiesMap).length === 0) return showToast("Список городов пуст");
        if (!confirm('Сформировать полный бэкап API? Это может занять около минуты. Не закрывайте страницу.')) return;
        
        const modal = document.getElementById('loadingModal');
        const loadingText = document.getElementById('loadingText');
        let isCancelled = false;
        
        document.getElementById('cancelLoadingBtn').onclick = () => { isCancelled = true; };
        modal.classList.add('show');
        loadingText.textContent = "Сбор городов...";
        
        try {
            const data = await Api.generateApiBackup(citiesMap, VERSION, () => isCancelled);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const d = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
            downloadBlob(blob, `backup-api_${dateStr}.json`);
            showToast("Бэкап API сформирован");
        } catch (err) {
            if (err.message === 'Canceled') showToast("Операция отменена");
            else showToast("Ошибка формирования бэкапа");
        } finally {
            modal.classList.remove('show');
        }
    });
    
    document.getElementById('closeExportBtn').addEventListener('click', () => document.getElementById('exportModal').classList.remove('show'));
    document.getElementById('cancelExportBtn').addEventListener('click', () => document.getElementById('exportModal').classList.remove('show'));
    document.getElementById('doExportBtn').addEventListener('click', doExport);

    document.getElementById('modeBtn').addEventListener('click', toggleViewMode);
    document.getElementById('settingsBtn').addEventListener('click', (e) => { 
        e.stopPropagation(); 
        toggleSettings(); 
    });
    
    document.getElementById('transferBtn').addEventListener('click', openTransferModal);
    document.getElementById('closeTransferBtn').addEventListener('click', () => document.getElementById('transferModal').classList.remove('show'));
    document.getElementById('cancelTransferBtn').addEventListener('click', () => document.getElementById('transferModal').classList.remove('show'));
    document.getElementById('doTransferBtn').addEventListener('click', doTransfer);

    document.getElementById('resetBtn').addEventListener('click', (e) => {
        e.stopPropagation(); 
        document.getElementById("resetMenu").classList.toggle("show"); 
        document.getElementById("downloadMenu").classList.remove("show");
        document.getElementById("menuDropdown").classList.remove("show");
    });

    document.querySelectorAll('#resetMenu .dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const type = e.target.getAttribute('data-reset');
            if (type === 'all') {
                if (confirm('Вы уверены, что хотите полностью сбросить настройки и кэш?')) { resetAll(); }
            } else if (type === 'city') {
                if (confirm('Сбросить станции для текущего города? Настройки частот и сдвига сохранятся.')) {
                    resetCurrentCity();
                }
            }
            document.getElementById("resetMenu").classList.remove("show");
        });
    });

    document.getElementById('menuBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('menuDropdown');
        if (!menu.classList.contains('show')) {
            const iconDownload = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
            const iconShare = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
            const iconTheme = '<span style="display:inline-block; width:14px; text-align:center; margin-right:8px;">☾</span>';
            const iconHelp = '<span style="display:inline-block; width:14px; text-align:center; margin-right:8px; font-weight:bold;">?</span>';
            const iconMode = state.viewMode === 'player' 
                ? '<span style="display:inline-block; width:14px; text-align:center; margin-right:8px;">⚙️</span>' 
                : '<span style="display:inline-block; width:14px; text-align:center; margin-right:8px;">🎧</span>';
            const textMode = state.viewMode === 'player' ? 'Настройка' : 'Плеер';
            
            menu.innerHTML = `
                <div class="dropdown-item" data-action="download-png">${iconDownload}Скачать PNG</div>
                <div class="dropdown-item" data-action="download-pdf">${iconDownload}Скачать PDF</div>
                <div class="dropdown-item" data-action="download-xlsx">${iconDownload}Скачать XLSX</div>
                <div class="dropdown-item" data-action="download-json">${iconDownload}Экспорт JSON</div>
                <div class="dropdown-item" data-action="share">${iconShare}Поделиться</div>
                <div class="dropdown-item" data-action="theme">${iconTheme}Сменить тему</div>
                <div class="dropdown-item" data-action="help">${iconHelp}Инструкция</div>
                <div class="dropdown-item" data-action="viewmode">${iconMode}Режим: ${textMode}</div>
            `;
        }
        menu.classList.toggle('show');
        document.getElementById("resetMenu").classList.remove("show");
        document.getElementById("downloadMenu").classList.remove("show");
    });

    document.getElementById('menuDropdown').addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        const action = item.dataset.action;
        if (action === 'theme') toggleTheme();
        else if (action === 'help') document.getElementById("helpModal").classList.add("show");
        else if (action === 'download-png') exportPNG();
        else if (action === 'download-pdf') exportPDF();
        else if (action === 'download-xlsx') exportXLSX();
        else if (action === 'download-json') openExportModal();
        else if (action === 'share') copyShareLink();
        else if (action === 'viewmode') toggleViewMode();
        document.getElementById('menuDropdown').classList.remove('show');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.preset-dropdown') && !e.target.closest('.preset-menu') && !e.target.closest('.preset-btn')) closePresetMenu();
        if (!e.target.closest('#templatesBtn') && !e.target.closest('#templatesMenu')) document.getElementById("templatesMenu").classList.remove("show");
        if (!e.target.closest('#downloadBtn') && !e.target.closest('#downloadMenu')) document.getElementById("downloadMenu").classList.remove("show");
        if (!e.target.closest('#citySelect')) citySelectMenu.classList.remove("show");
        if (!e.target.closest('#resetBtn') && !e.target.closest('#resetMenu')) document.getElementById("resetMenu").classList.remove("show");
        if (!e.target.closest('#menuBtn') && !e.target.closest('#menuDropdown')) document.getElementById("menuDropdown").classList.remove("show");
    });

    loadFromLS();
    const hasUrl = loadFromUrl();
    
    if (state.streamsData) {
        Object.keys(state.streamsData).forEach(code => {
            if (!stationStreamMap[code]) stationStreamMap[code] = state.streamsData[code];
        });
    }
    
    await loadStationsData();
    applyViewMode();

    audioPlayer = document.getElementById('audioPlayer');
    const savedVol = localStorage.getItem('fm_player_volume');
    audioPlayer.volume = savedVol !== null ? parseFloat(savedVol) : 1;
    
    initMobilePlayerControls();
    const mobileVolSlider = document.getElementById('mobileVolumeSlider');
    
    document.getElementById('logoBtn').onclick = () => window.open('https://github.com/tabookot/AutoFMShift', '_blank', 'noopener');

    const volumeSlider = document.getElementById('volumeSlider');
    volumeSlider.value = audioPlayer.volume;
    
    const updateVolume = (val) => {
        val = Math.max(0, Math.min(1, val));
        volumeSlider.value = val;
        if (mobileVolSlider) mobileVolSlider.value = val;
        audioPlayer.volume = val;
        localStorage.setItem('fm_player_volume', val);
        
        const percent = Math.round(val * 100);
        volumeSlider.style.background = `linear-gradient(to top, var(--accent) ${percent}%, var(--border) ${percent}%)`;
        if (mobileVolSlider) {
            mobileVolSlider.style.background = `linear-gradient(to right, var(--accent) ${percent}%, var(--border) ${percent}%)`;
            mobileVolSlider.title = `Громкость: ${percent}%`;
        }
        volumeSlider.title = `Громкость: ${percent}%`;
    };
    updateVolume(audioPlayer.volume); 

    volumeSlider.addEventListener('input', (e) => updateVolume(parseFloat(e.target.value)));
    if (mobileVolSlider) {
        mobileVolSlider.addEventListener('input', (e) => updateVolume(parseFloat(e.target.value)));
        mobileVolSlider.addEventListener('wheel', (e) => {
            e.preventDefault();
            let val = parseFloat(mobileVolSlider.value);
            if (e.deltaY < 0) val += 0.02; else val -= 0.02;
            updateVolume(val);
        }, { passive: false });
    }
    const playerPanel = document.getElementById('playerPanel');
    playerPanel.addEventListener('wheel', (e) => {
        e.preventDefault();
        let val = parseFloat(volumeSlider.value);
        if (e.deltaY < 0) val += 0.02; else val -= 0.02;
        updateVolume(val);
    }, { passive: false });
    let volTouchY = null;
    volumeSlider.addEventListener('touchstart', (e) => { volTouchY = e.touches[0].clientY; }, { passive: true });
    volumeSlider.addEventListener('touchmove', (e) => {
        if (volTouchY === null) return;
        e.preventDefault();
        const currentY = e.touches[0].clientY;
        const deltaY = volTouchY - currentY;
        let val = parseFloat(volumeSlider.value) + (deltaY / 100);
        updateVolume(val);
        volTouchY = currentY;
    }, { passive: false });

    spectrumCanvas = document.getElementById('spectrumCanvas');
    spectrumCtx = spectrumCanvas.getContext('2d');
    drawSpectrum();

    const hashParams = new URLSearchParams(location.hash.slice(1));
    const isSharedLink = hashParams.get("shared") === "1";
    if (isSharedLink) {
        hashParams.delete("shared");
        history.replaceState(null, "", `#${hashParams.toString()}`);
    }
    
    const playName = hashParams.get("play");
    const streamIdxParam = hashParams.get("stream");
    let shouldRestore = false;
    if (playName) {
        const decodedName = decodeURIComponent(playName);
        const streamData = stationStreamMap[FMUse.generateCodeName(decodedName)];
        if (streamData && streamData.streams && streamData.streams.length > 0) {
            let idx = streamIdxParam !== null ? parseInt(streamIdxParam) : 0;
            if (isNaN(idx) || idx >= streamData.streams.length) idx = 0;
            
            currentPlayingStation = decodedName;
            currentStreamIndex = idx;
            
            if (!isSharedLink && localStorage.getItem('fm_player_playing') === currentPlayingStation) {
                shouldRestore = true;
            }
            updatePlayerUI(); 
        }
    } else {
        localStorage.removeItem('fm_player_playing');
    }


    audioPlayer.addEventListener('playing', () => {
        setPlayerLoading(false);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
        updatePlayerUI();
    });
    audioPlayer.addEventListener('waiting', () => {
        setPlayerLoading(true);
        updatePlayerUI();
    });
    audioPlayer.addEventListener('pause', () => {
        setPlayerLoading(false);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
        updatePlayerUI();
    });

    document.getElementById('playerPlayBtn').addEventListener('click', () => {
        cancelRestorePlayback();
        if (currentPlayingStation) {
            if (audioPlayer.paused) {
                if (!audioPlayer.src || audioPlayer.src === window.location.href) {
                    setPlayerLoading(true, "Подключение к потоку...");
                    attemptPlay(currentPlayingStation, currentStreamIndex).then(played => {
                        if (played) {
                            localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(currentPlayingStation), currentStreamIndex);
                            updatePlayerUI();
                            updateUrl();
                        } else {
                            showToast("Поток недоступен");
                            stopPlayer();
                        }
                    });
                } else {
                    setPlayerLoading(true);
                    audioPlayer.play().catch(() => { setPlayerLoading(false); updatePlayerUI(); });
                }
            } else {
                audioPlayer.pause();
            }
            updatePlayerUI();
        }
    });
    document.getElementById('playerStopBtn').addEventListener('click', () => {
        stopPlayer();
        renderStations();
    });
    document.getElementById('playerPrevBtn').addEventListener('click', () => skipStation(-1));
    document.getElementById('playerNextBtn').addEventListener('click', () => skipStation(1));
    
    document.getElementById('playerStreamInfo').addEventListener('click', async (e) => {
        e.preventDefault();
        if (isSwitchingStream || !currentPlayingStation) return;
        cancelRestorePlayback();
        isSwitchingStream = true;
        
        const streamData = stationStreamMap[FMUse.generateCodeName(currentPlayingStation)];
        if (streamData && streamData.streams && streamData.streams.length > 1) {
            const oldStreamIndex = currentStreamIndex;
            let attempts = 0;
            let foundWorking = false;
            
            while (attempts < streamData.streams.length) {
                currentStreamIndex = (currentStreamIndex + 1) % streamData.streams.length;
                
                if (streamData.streams[currentStreamIndex].broken) {
                    attempts++;
                    continue;
                }
                
                const played = await attemptPlay(currentPlayingStation, currentStreamIndex);
                if (played === true) {
                    localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(currentPlayingStation), currentStreamIndex);
                    updatePlayerUI();
                    updateUrl();
                    foundWorking = true;
                    break;
                } else {
                    streamData.streams[currentStreamIndex].broken = true;
                }
                attempts++;
            }
            
            if (!foundWorking) {
                showToast("Другие потоки недоступны. Возврат к текущему...");
                currentStreamIndex = oldStreamIndex;
                await attemptPlay(currentPlayingStation, oldStreamIndex, true);
                updatePlayerUI();
            }
        }
        isSwitchingStream = false;
    });

    const playerNameEl = document.getElementById('playerName');
    playerNameEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (currentPlayingStation) showToast(currentPlayingStation);
    }, { passive: false });    
    
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => { 
            if (currentPlayingStation && audioPlayer.paused) {
                setPlayerLoading(true);
                audioPlayer.load(); 
                audioPlayer.play().catch(() => { setPlayerLoading(false); updatePlayerUI(); });
            }
        });
        navigator.mediaSession.setActionHandler('pause', () => audioPlayer.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => skipStation(-1));
        navigator.mediaSession.setActionHandler('nexttrack', () => skipStation(1));
        navigator.mediaSession.setActionHandler('stop', () => { stopPlayer(); renderStations(); });
        
        try {
            navigator.mediaSession.setActionHandler('seekto', null);
            navigator.mediaSession.setActionHandler('seekbackward', null);
            navigator.mediaSession.setActionHandler('seekforward', null);
        } catch(e) {}
    }

    const html = await Api.fetchPage(Api.MAIN_PAGE);
    if (html) {
        const newCities = Api.parseCities(html);
        if (Object.keys(newCities).length > 0) {
            citiesMap = newCities;
            localStorage.setItem("fm_cities_map", JSON.stringify(citiesMap));
        }
    } else {
        try {
            const res = await fetch('data/backup-api.json');
            if (res.ok) {
                const data = await res.json();
                if (data.type === 'api-cache') {
                    window.apiBackupData = data;
                    Object.keys(data.cities).forEach(slug => {
                        const cName = data.cities[slug].name || slug;
                        if (!citiesMap[cName]) citiesMap[cName] = cName;
                    });
                    localStorage.setItem("fm_cities_map", JSON.stringify(citiesMap));
                    showToast("API недоступен. Загружен резервный кэш (backup-api.json)");
                }
            }
        } catch (e) {}
        
        if (Object.keys(citiesMap).length === 0 && Object.keys(state.cityData).length === 0) {
            document.getElementById("errorMsg").style.display = "block";
            document.getElementById("errorMsg").innerHTML = "Сайт недоступен. Приносим дикие извинения за неудобства!<br><br><button id='importFallbackBtn' class='btn-text' style='height:35px; width:auto; padding:0 15px; display:inline-flex;'>Импортировать JSON</button>";
            document.getElementById('importFallbackBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
            return;
        }
    }
    
    renderCitySelectMenu();

    citySelectTrigger.onclick = (e) => {
        e.stopPropagation();
        citySelectMenu.classList.toggle('show');
        const activeItem = citySelectMenu.querySelector('.active');
        if (activeItem) activeItem.scrollIntoView({ block: 'center' });
    };
    
    if (!citiesMap[state.city]) state.city = DEFAULT_STATE.city;
    await loadCity(state.city);
    render();
    updateUrl();
    if (shouldRestore) restorePlayback();
    if (!hasUrl && !localStorage.getItem("geo_checked")) checkGeo(false);
}

async function loadCity(city) {
    if (!citiesMap[city] && !state.cityData[city]?.allStations) return;
    state.city = city;
    
    Object.values(stationStreamMap).forEach(data => {
        data.broken = false;
        if (data.streams) data.streams.forEach(s => s.broken = false);
    });
    
    state.stations = []; 
    const list = document.getElementById('stationsList');
    list.innerHTML = '<div class="loading-msg">Загрузка станций...</div>';
    render(); 

    const html = await Api.fetchPage(citiesMap[city]);
    let newStations = [];
    let source = "cache";
    if (html) {
        newStations = Api.parseStations(html);
        source = "api";
        lastDataSource = 'api';
        if (newStations.length === 0) {
            showToast("Ошибка парсинга.");
            newStations = [];
        }
    } else if (window.apiBackupData && window.apiBackupData.cities[FMUse.generateCodeName(city)]) {
        newStations = window.apiBackupData.cities[FMUse.generateCodeName(city)].stations.filter(s => !s.isDeleted).map(s => ({ name: s.name, freq: s.freq }));
        source = "backup";
        if (lastDataSource !== 'backup') { showToast("Нет сети. Используем backup-api.json"); lastDataSource = 'backup'; }
    } else if (state.cityData[city]?.allStations) {
        newStations = state.cityData[city].allStations;
        source = "cache";
        if (lastDataSource !== 'cache') { showToast("Нет сети. Используем кэш станций."); lastDataSource = 'cache'; }
    } else {
        if (lastDataSource !== 'none') { showToast("Сеть недоступна."); lastDataSource = 'none'; }
    }

    if (newStations.length > 0) {
        state.stations = newStations;
        state.stationsSource = source;
        if (!state.cityData[city]) state.cityData[city] = { stations: {} };
        state.cityData[city].allStations = newStations.map(s => ({ name: s.name, freq: s.freq }));
        state.cityData[city].totalStations = state.stations.length;
        
        // Блок удален: он перезаписывал свежие потоки из stations_data.json 
        // старыми данными из LocalStorage.
        
        const ls = localStorage.getItem(LS_KEY);
        let cachedSettings = {};
        if (ls) {
            try {
                const parsed = JSON.parse(ls);
                if (parsed.cityData && parsed.cityData[city]) {
                    cachedSettings = parsed.cityData[city].stations || {};
                }
            } catch {}
        }
        
        const settingKeys = Object.keys(cachedSettings);
        if (settingKeys.length > 0) {
            const score = FMUse.evaluateSync(settingKeys.map(n => ({name: n})), newStations);
            if (score >= 3) {
                const matches = FMUse.matchArrays(settingKeys, newStations.map(s => s.name));
                let syncedSettings = {};
                matches.forEach(m => {
                    const oldData = cachedSettings[m.source];
                    if (oldData && (oldData.type !== 'normal' || oldData.presetIndex)) {
                        syncedSettings[m.target] = { ...oldData };
                    }
                });
                state.cityData[city].stations = syncedSettings;
                if (score === 4) showToast("Данные обновлены, настройки перенесены.");
            } else {
                state.cityData[city].stations = cachedSettings;
                showToast(`Данные API изменились (балл ${score}). Настройки сохранены.`);
            }
        } else {
            state.cityData[city].stations = {};
        }
        
        updateCityStats(city);
        commitState();
        render();
    } else {
        list.innerHTML = '<div class="loading-msg">Нет данных</div>';
    }
}

async function checkGeo(isManual = false) {
    const hasUrlCity = location.hash.includes("city=");
    try {
        const res = await fetch("https://get.geojs.io/v1/ip/geo.json");
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();
        const lat = parseFloat(data.latitude); const lon = parseFloat(data.longitude);
        if (!isNaN(lat) && !isNaN(lon) && typeof CITY_CENTERS !== 'undefined') {
            let closestCity = null; let minDist = Infinity;
            CITY_CENTERS.forEach(c => {
                const dist = getDistance(lat, lon, c.lat, c.lon);
                if (dist < minDist) { minDist = dist; closestCity = c; }
            });
            if (closestCity) {
                if (minDist <= 50) {
                    if (citiesMap[closestCity.name]) {
                        if (isManual || !hasUrlCity) {
                            state.city = closestCity.name; await loadCity(state.city);
                            showToast(`Автоопределение: ${closestCity.name} (${Math.round(minDist)} км)`);
                        }
                    } else showToast(`Автоопределение: ${closestCity.name} нет в базе`);
                } else showToast("Автоопределение: ближайший город слишком далеко");
            }
        } else showToast("Автоопределение: координаты не получены");
    } catch (e) { showToast("Автоопределение: ошибка сети"); }
    localStorage.setItem("geo_checked", "1");
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
}

async function copyShareLink() {
    let url = window.location.href.replace(/&shared=1|#shared=1/, '');
    url += (location.hash ? '&' : '#') + 'shared=1';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try { await navigator.clipboard.writeText(url); showToast("Ссылка скопирована в буфер обмена"); } 
        catch (err) { fallbackCopyTextToClipboard(url); }
    } else { fallbackCopyTextToClipboard(url); }
}
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "-9999px"; textArea.style.left = "-9999px"; textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) { showToast("Ссылка скопирована (старый метод)"); } 
        else { window.prompt("Скопируйте ссылку вручную (Ctrl+C):", text); }
    } catch (err) {
        document.body.removeChild(textArea);
        window.prompt("Скопируйте ссылку вручную (Ctrl+C):", text);
    }
}

document.getElementById("themeBtn").addEventListener("click", toggleTheme);
document.getElementById("templatesBtn").addEventListener("click", (e) => {
    e.stopPropagation(); document.getElementById("templatesMenu").classList.toggle("show"); document.getElementById("downloadMenu").classList.remove("show");
});

document.getElementById('cacheResetBtn').addEventListener('click', () => {
    const keysToRemove = ["fm_adapter_calc", "fm_adapter_calc_v2", "fm_adapter_calc_v3", "fm_adapter_calc_v4", "fm_adapter_calc_v5", "fm_adapter_calc_v6", "fm_adapter_calc_v7", "fm_adapter_calc_v8", "fm_adapter_calc_v9", LS_KEY, LS_THEME_KEY, "geo_checked", "fm_cities_map"];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem("fm_cache_version", CACHE_VERSION);
    window.location.reload();
});

function setupWheelInput(id, min, max, step, stateProp) {
    const el = document.getElementById(id);
    el.setAttribute("min", min); el.setAttribute("max", max);
    const applyChange = (val) => {
        if (isNaN(val)) return false;
        val = Math.max(min, Math.min(max, val));
        val = Math.round(val * 100) / 100;
        if (parseFloat(el.value) === val) return false;
        el.value = val;
        if (stateProp === 'min' || stateProp === 'max') {
             if (stateProp === 'min') state.min = val; else state.max = val;
             const matched = TEMPLATES.find(t => t.range[0] === state.min && t.range[1] === state.max);
             state.template = matched ? matched.name : "Свой вариант";
             state.templateShort = matched ? matched.short : "свой";
        } else { state[stateProp] = Math.round(val); }
        return true;
    };
    el.addEventListener("input", (e) => {
        if (e.target.value === "") return; 
        let val = parseFloat(e.target.value);
        if (applyChange(val)) { saveState(); render(); }
    });
    el.addEventListener("blur", () => {
        if (el.value === "" || isNaN(parseFloat(el.value))) { applyChange(min); commitState(); render(); }
    });
    el.addEventListener("wheel", (e) => {
        e.preventDefault();
        let val = parseFloat(el.value) || min;
        if (e.deltaY < 0) val += step; else val -= step;
        if (applyChange(val)) { saveState(); render(); }
    }, { passive: false });
    let touchStartY = null; let touchStartVal = null;
    el.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY; touchStartVal = parseFloat(el.value) || min;
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
        if (touchStartY === null) return;
        e.preventDefault();
        const currentY = e.touches[0].clientY;
        const deltaY = touchStartY - currentY;
        const steps = Math.round(deltaY / 15);
        let newVal = touchStartVal + (steps * step);
        if (applyChange(newVal)) { /* Throttle render */ }
    }, { passive: false });
    el.addEventListener('touchend', () => {
        if (touchStartY !== null) { commitState(); render(); }
        touchStartY = null;
    });
}

setupWheelInput("minFreq", 64, 110, 0.1, "min");
setupWheelInput("maxFreq", 64, 110, 0.1, "max");
setupWheelInput("bands", 1, 5, 1, "bands");
setupWheelInput("presets", 1, 18, 1, "presets");

document.getElementById("shareBtn").addEventListener("click", copyShareLink);
document.getElementById("geoBtn").addEventListener("click", () => checkGeo(true));
document.getElementById("helpBtn").addEventListener("click", () => document.getElementById("helpModal").classList.add("show"));
document.getElementById("closeHelpBtn").addEventListener("click", () => document.getElementById("helpModal").classList.remove("show"));
document.getElementById("helpModal").addEventListener("click", (e) => { if (e.target.id === 'helpModal') e.target.classList.remove("show"); });

init();