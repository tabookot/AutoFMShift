// 0.3.1 | Rule: minor.major.build. build++ on full regen
const VERSION = "0.3.1";
const API_URL = "https://radiopedia.fandom.com/ru/api.php";
const MAIN_PAGE = "Частотные планы радиостанций в городах России";
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
    { name: "Япония (до 2014)", short: "jp-old", range: [76.0, 90.0] },
    { name: "Япония (Wide FM)", short: "jp-wide", range: [76.0, 95.0] },
    { name: "США", short: "usa", range: [87.9, 107.9] },
    { name: "OIRT / СССР / Восточная Европа", short: "oirt", range: [65.9, 74.0] },
    { name: "Свой вариант", short: "свой", range: [76.0, 108.0] }
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
    bands: 1,
    presets: 6,
    cityData: {},
    isGuestMode: false,
    lastModified: 0 
};

let state = { ...DEFAULT_STATE };
let citiesMap = {};
let activePresetMenu = null;
let saveStateTimer = null;

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

// API & PARSING
async function fetchPage(title) {
    const url = `${API_URL}?action=parse&page=${encodeURIComponent(title)}&format=json&prop=text&origin=*`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Network response was not ok: ${res.status}`);
        const data = await res.json();
        return data.parse?.text?.["*"] || null;
    } catch { return null; }
}

function parseCities(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cities = {};
    doc.querySelectorAll("a[title]").forEach(a => {
        const title = a.getAttribute("title");
        if (title.startsWith(MAIN_PAGE + "/")) {
            const city = title.split("/").pop().replace(/_/g, " ").trim();
            if (city && !["Сводная таблица", "Россия"].includes(city)) cities[city] = title;
        }
    });
    return cities;
}

function parseStations(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const stations = [];
    doc.querySelectorAll("table").forEach(table => {
        table.querySelectorAll("tr").forEach(row => {
            const cols = row.querySelectorAll("td, th");
            if (cols.length < 2) return;
            let freq = null, name = "";
            cols.forEach(col => {
                const a = col.querySelector("a");
                if (a && a.getAttribute('title') && !name) name = a.getAttribute('title').replace(/_/g, " ").trim();
                const text = col.textContent.trim();
                if (!text) return;
                const match = text.match(/(\d{2,3}[.,]\d{1,3})/);
                if (match && !freq) {
                    const f = parseFloat(match[1].replace(",", "."));
                    if (!isNaN(f) && f >= FM_BAND_MIN && f <= FM_BAND_MAX) freq = f;
                } else if (!name && text.length > 2) {
                    const lower = text.toLowerCase();
                    if (!["частота", "радиостанция", "мгц", "квт", "мощность", "передатчик", "вт"].some(x => lower.includes(x))) name = text.replace(/\[\d+\]/g, "").trim();
                }
            });
            if (freq && name) stations.push({ freq, name });
        });
    });
    return stations;
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
    const display = state.settingsMode ? 'block' : 'none';
    document.getElementById('bands').style.display = display;
    document.getElementById('presets').style.display = display;
    document.getElementById('statusHeader').style.display = state.settingsMode ? 'block' : 'none';
    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn.classList.toggle('active', state.settingsMode);
    settingsBtn.setAttribute('aria-pressed', state.settingsMode ? 'true' : 'false');
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
    const cityStations = state.cityData[state.city].stations;
    if (presetIndex) {
        Object.keys(cityStations).forEach(n => {
            if (cityStations[n].presetIndex === presetIndex && n !== name) cityStations[n].presetIndex = null;
        });
    }
    const data = ensureStationData(name);
    data.presetIndex = data.presetIndex === presetIndex ? null : presetIndex;
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
    
    for (let p = 1; p <= maxPresets; p++) {
        let occupiedBy = '';
        Object.keys(cityStations).forEach(n => {
            if (cityStations[n].presetIndex === p && n !== name) { occupiedBy = n; }
        });
        
        const item = document.createElement('div');
        item.className = 'dropdown-item preset-item' + (occupiedBy ? ' occupied' : '');
        if (currentData.presetIndex === p) item.classList.add('current');
        
        const numSpan = document.createElement('span');
        numSpan.className = 'preset-num';
        numSpan.textContent = formatPreset(p, state.bands, state.presets);
        item.appendChild(numSpan);
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'preset-name';
        nameSpan.textContent = occupiedBy ? occupiedBy : 'Свободно';
        if (occupiedBy) nameSpan.title = occupiedBy;
        item.appendChild(nameSpan);
        
        item.onclick = (e) => { 
            e.stopPropagation(); 
            assignPreset(name, p); 
            closePresetMenu(); 
        };
        menu.appendChild(item);
    }
    
    const clearItem = document.createElement('div');
    clearItem.className = 'dropdown-item preset-item preset-clear';
    clearItem.textContent = '✕ Очистить';
    clearItem.onclick = (e) => { 
        e.stopPropagation(); 
        assignPreset(name, null); 
        closePresetMenu(); 
    };
    menu.appendChild(clearItem);

    btn.parentElement.appendChild(menu);
    activePresetMenu = menu;
}

function closePresetMenu() {
    if (activePresetMenu) { activePresetMenu.remove(); activePresetMenu = null; }
}

// EXPORT LOGIC
function getStatusExportData(name) {
    const data = getStationData(name);
    const visible = isPresetVisible(data.presetIndex);
    const presetStr = visible ? formatPreset(data.presetIndex, state.bands, state.presets) : '';
    let icon = '';
    let color = null;
    if (data.type === 'fav') { icon = '♥'; color = [231, 76, 60]; }
    else if (data.type === 'cand') { icon = '★'; color = [241, 196, 15]; }
    return { icon, preset: presetStr, color, type: data.type };
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
}

function generateSetupInstruction(stations) {
    const setupStations = stations.filter(st => {
        const data = getStationData(st.name);
        return data.presetIndex && isPresetVisible(data.presetIndex) && isAvailable(st.freq);
    }).map(st => {
        const presetStr = formatPreset(getStationData(st.name).presetIndex, state.bands, state.presets);
        // Используем ⟦ ⟧ — они выглядят как цельные квадратные скобки и поддерживаются во всех шрифтах
        const button = `⟦ ${presetStr} ⟧`;
        return { freq: calcShiftedFreq(st.freq), button: button };
    }).sort((a, b) => a.freq - b.freq);

    if (setupStations.length === 0) return "";
    
    const steps = setupStations.map(s => `${formatFreq(s.freq)} ${s.button}`);
    return "Настройка: " + steps.join("  →  ");
}

function generateCanvas() {
    const isMobile = window.innerWidth < 600;
    const cols = isMobile ? 1 : 2;
    const padding = 20;
    const rowHeight = 28;
    const headerHeight = 35;
    const titleHeightBase = 60;
    
    const validStations = state.settingsMode 
        ? state.stations.filter(st => getStationData(st.name).type !== 'trash') 
        : state.stations;
        
    const sorted = [...validStations].sort((a, b) => a.freq - b.freq);
    const half = cols === 1 ? sorted.length : Math.ceil(sorted.length / 2);
    const parts = cols === 1 ? [sorted] : [sorted.slice(0, half), sorted.slice(half)];
    
    const instructionText = generateSetupInstruction(validStations);
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.font = 'bold 12px Arial';
    const nameHeaderW = tempCtx.measureText('Станция').width;
    const freqHeaderW = tempCtx.measureText('Частота').width;
    const shiftHeaderW = tempCtx.measureText('На ГУ').width;
    const markHeaderW = tempCtx.measureText('Пометки').width;
    
    tempCtx.font = '12px Arial';
    let maxNameWidth = nameHeaderW;
    let maxFreqWidth = freqHeaderW;
    let maxShiftedWidth = shiftHeaderW;
    let maxMarkWidth = markHeaderW;
    
    validStations.forEach(st => {
        maxNameWidth = Math.max(maxNameWidth, tempCtx.measureText(st.name).width);
        maxFreqWidth = Math.max(maxFreqWidth, tempCtx.measureText(formatFreq(st.freq)).width);
        const shifted = calcShiftedFreq(st.freq);
        maxShiftedWidth = Math.max(maxShiftedWidth, tempCtx.measureText(shifted >= FM_BAND_MIN ? formatFreq(shifted) : '—').width);
        if (state.settingsMode) {
            const statusData = getStatusExportData(st.name);
            const text = `${statusData.icon} ${statusData.preset}`.trim();
            maxMarkWidth = Math.max(maxMarkWidth, tempCtx.measureText(text).width);
        }
    });
    
    const isStandard = state.min === RU_MIN && state.max === RU_MAX;
    const padX = 10;
    const markWidth = state.settingsMode ? Math.max(50, maxMarkWidth + padX * 2) : 0;
    const colWidth = Math.ceil(markWidth + maxNameWidth + maxFreqWidth + (isStandard ? 0 : maxShiftedWidth) + padX * 4); 
    
    const canvasWidth = cols * colWidth + (cols - 1) * padding + padding * 2;
    const maxRows = cols === 1 ? sorted.length : half;
    
    tempCtx.font = 'bold 16px Arial';
    const shiftText = isStandard ? "Стандарт" : `${state.shift} МГц`;
    const titleText = `Город: ${state.city} | Диапазон: ${state.min} - ${state.max} МГц | Сдвиг: ${shiftText}`;
    const maxTextWidth = canvasWidth - padding * 2;
    const titleLines = wrapText(tempCtx, titleText, maxTextWidth);
    const finalTitleHeight = titleHeightBase + (titleLines.length - 1) * 20;
    
    let instructionLines = [];
    let instructionHeight = 0;
    if (instructionText) {
        tempCtx.font = '12px Arial';
        instructionLines = wrapText(tempCtx, instructionText, maxTextWidth);
        instructionHeight = instructionLines.length * 16 + 20;
    }
    
    const canvasHeight = finalTitleHeight + headerHeight + maxRows * rowHeight + padding + instructionHeight;
    
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.textBaseline = 'middle';
    
    titleLines.forEach((line, index) => {
        const y = (finalTitleHeight / 2) + (index - (titleLines.length - 1) / 2) * 20;
        ctx.fillText(line, padding, y);
    });
    
    for (let c = 0; c < cols; c++) {
        const part = parts[c];
        if (!part || part.length === 0) continue;
        const xOffset = padding + c * (colWidth + padding);
        let y = finalTitleHeight;
        
        ctx.fillStyle = '#f1f3f5';
        ctx.fillRect(xOffset, y, colWidth, headerHeight);
        ctx.strokeStyle = '#dee2e6';
        ctx.strokeRect(xOffset, y, colWidth, headerHeight);
        
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        
        let currentX = xOffset + padX;
        if (state.settingsMode) {
            ctx.fillText('Пометки', currentX, y + headerHeight / 2);
            currentX += markWidth;
        }
        ctx.fillText('Частота', currentX, y + headerHeight / 2);
        currentX += maxFreqWidth + padX;
        ctx.fillText('Станция', currentX, y + headerHeight / 2);
        currentX += maxNameWidth + padX;
        if (!isStandard) ctx.fillText('На ГУ', currentX, y + headerHeight / 2);
        
        y += headerHeight;
        ctx.font = '12px Arial';
        part.forEach(st => {
            const shifted = calcShiftedFreq(st.freq);
            const isAvail = isAvailable(st.freq);
            ctx.strokeStyle = '#dee2e6';
            ctx.beginPath();
            ctx.moveTo(xOffset, y);
            ctx.lineTo(xOffset + colWidth, y);
            ctx.stroke();
            
            ctx.fillStyle = '#212529';
            currentX = xOffset + padX;
            
            if (state.settingsMode) {
                const statusData = getStatusExportData(st.name);
                const iconText = statusData.icon;
                const presetText = statusData.preset;
                if (iconText) {
                    if (statusData.color) ctx.fillStyle = `rgb(${statusData.color.join(',')})`;
                    else ctx.fillStyle = '#212529';
                    ctx.fillText(iconText, currentX, y + rowHeight / 2);
                }
                if (presetText) {
                    ctx.fillStyle = '#212529';
                    const iconW = iconText ? ctx.measureText(iconText).width + 4 : 0;
                    ctx.fillText(presetText, currentX + iconW, y + rowHeight / 2);
                }
                ctx.fillStyle = '#212529';
                currentX += markWidth;
            }
            
            ctx.fillText(formatFreq(st.freq), currentX, y + rowHeight / 2);
            currentX += maxFreqWidth + padX;
            
            let name = st.name;
            while (ctx.measureText(name).width > maxNameWidth && name.length > 0) name = name.slice(0, -1);
            if (name !== st.name) name += '...';
            ctx.fillText(name, currentX, y + rowHeight / 2);
            currentX += maxNameWidth + padX;
            
            if (!isStandard) {
                ctx.fillStyle = isAvail ? '#27ae60' : '#e74c3c';
                ctx.fillText(shifted >= FM_BAND_MIN ? formatFreq(shifted) : '—', currentX, y + rowHeight / 2);
            }
            y += rowHeight;
        });
        ctx.strokeRect(xOffset, finalTitleHeight, colWidth, headerHeight + maxRows * rowHeight);
    }
    
    // Отрисовка инструкции
    if (instructionLines.length > 0) {
        ctx.fillStyle = '#333333'; // Мягкий темно-серый
        ctx.font = '12px Arial';   // Обычный шрифт
        ctx.textAlign = 'left';
        const yStart = finalTitleHeight + headerHeight + maxRows * rowHeight + 10;
        instructionLines.forEach((line, index) => {
            ctx.fillText(line, padding, yStart + index * 16);
        });
    }
    
    return canvas;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

function exportPNG() {
    if (state.stations.length === 0) return showToast("Нет данных для экспорта");
    const canvas = generateCanvas();
    canvas.toBlob(blob => downloadBlob(blob, `FM_${state.city}.png`));
}

let _cyrillicFontB64 = null;
async function loadCyrillicFont() {
  if (_cyrillicFontB64) return _cyrillicFontB64;
  try {
    const url = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    const blob = await res.blob();
    _cyrillicFontB64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
    return _cyrillicFontB64;
  } catch (e) { return null; }
}

function exportPDF() {
    if (state.stations.length === 0) return showToast("Нет данных для экспорта");
    if (!_cyrillicFontB64) return showToast("Шрифт еще загружается, попробуйте через секунду");
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        
        doc.addFileToVFS("DejaVuSans.ttf", _cyrillicFontB64);
        doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
        doc.setFont("DejaVuSans");
        const fontName = 'DejaVuSans';
        
        const isStandard = state.min === RU_MIN && state.max === RU_MAX;
        const shiftText = isStandard ? "Стандарт" : `${state.shift} МГц`;
        const title = `Город: ${state.city} | Диапазон: ${state.min} - ${state.max} МГц | Сдвиг: ${shiftText}`;
        
        const validStations = state.settingsMode 
            ? state.stations.filter(st => getStationData(st.name).type !== 'trash') 
            : state.stations;
            
        const sorted = [...validStations].sort((a, b) => a.freq - b.freq);
        const half = Math.ceil(sorted.length / 2);
        const p1 = sorted.slice(0, half);
        const p2 = sorted.slice(half);
        
        const instructionText = generateSetupInstruction(validStations);
        
        const headers = isStandard ? ["Пометки", "Частота", "Станция"] : ["Пометки", "Частота", "Станция", "На ГУ"];
        const headerRow = [...headers, '', ...headers];
        
        const multiBody = [];
        for (let i = 0; i < half; i++) {
            const r1 = p1[i];
            const r2 = p2[i];
            const row = [];
            if (r1) {
                let statusText = "";
                if (state.settingsMode) {
                    const statusData = getStatusExportData(r1.name);
                    statusText = `${statusData.icon} ${statusData.preset}`.trim();
                }
                row.push(statusText);
                row.push(formatFreq(r1.freq));
                row.push(r1.name);
                if (!isStandard) {
                    const s1 = calcShiftedFreq(r1.freq);
                    row.push(s1 >= FM_BAND_MIN ? formatFreq(s1) : "—");
                }
            } else { row.push(...Array(headers.length).fill("")); }
            row.push("");
            if (r2) {
                let statusText = "";
                if (state.settingsMode) {
                    const statusData = getStatusExportData(r2.name);
                    statusText = `${statusData.icon} ${statusData.preset}`.trim();
                }
                row.push(statusText);
                row.push(formatFreq(r2.freq));
                row.push(r2.name);
                if (!isStandard) {
                    const s2 = calcShiftedFreq(r2.freq);
                    row.push(s2 >= FM_BAND_MIN ? formatFreq(s2) : "—");
                }
            } else { row.push(...Array(headers.length).fill("")); }
            multiBody.push(row);
        }
        
        const colStyles = {};
        headerRow.forEach((h, i) => {
            if (h === 'Пометки') colStyles[i] = { cellWidth: 25, halign: 'left' };
            else if (h === 'Станция') colStyles[i] = { cellWidth: 'auto' };
            else if (h === 'Частота') colStyles[i] = { cellWidth: 20, halign: 'center' };
            else if (h === 'На ГУ') colStyles[i] = { cellWidth: 20, halign: 'center' };
            else if (h === '') colStyles[i] = { cellWidth: 5, fillColor: [255, 255, 255], lineColor: [255, 255, 255] };
        });
        
        doc.setFontSize(14);
        doc.text(title, 14, 15);
        
        doc.autoTable({
            head: [headerRow],
            body: multiBody,
            startY: 20,
            theme: 'grid',
            styles: { font: fontName, fontSize: 10, cellPadding: 2, overflow: 'linebreak' },
            headStyles: { fillColor: [0, 0, 0], textColor: 255, halign: 'center', fontStyle: 'bold' },
            columnStyles: colStyles,
            didParseCell: function (data) {
                if (data.section === 'body') {
                    const colIndex = data.column.index;
                    const rowIdx = data.row.index;
                    const isLeft = colIndex < headers.length;
                    const currentStation = isLeft ? p1[rowIdx] : p2[rowIdx];
                    const colName = headerRow[colIndex];
                    if (colName === 'Пометки' && state.settingsMode) data.cell.styles.fillColor = [240, 240, 240];
                    if (currentStation && !isAvailable(currentStation.freq)) data.cell.styles.textColor = [153, 153, 153];
                    
                    if (colName === 'Пометки' && currentStation && state.settingsMode) {
                        const statusData = getStatusExportData(currentStation.name);
                        data.cell.custom = {
                            icon: statusData.icon,
                            preset: statusData.preset,
                            color: statusData.color
                        };
                        data.cell.text = [];
                    }
                    if (colName === 'На ГУ') {
                        if (currentStation && !isAvailable(currentStation.freq)) data.cell.styles.textColor = [231, 76, 60];
                        else if (currentStation) data.cell.styles.textColor = [39, 174, 96];
                    }
                }
            },
            didDrawCell: function(data) {
                if (data.section === 'body' && data.cell.custom) {
                    const { icon, preset, color } = data.cell.custom;
                    
                    doc.setFont(fontName);
                    doc.setFontSize(10);
                    
                    const x = data.cell.x + 2;
                    const y = data.cell.y + data.cell.height / 2;
                    
                    let currentX = x;
                    if (icon) {
                        if (color) {
                            doc.setTextColor(color[0], color[1], color[2]);
                        } else {
                            doc.setTextColor(33, 37, 41);
                        }
                        doc.text(icon, currentX, y, { baseline: 'middle' });
                        currentX += doc.getTextWidth(icon) + 1;
                    }
                    if (preset) {
                        doc.setTextColor(33, 37, 41);
                        doc.text(preset, currentX, y, { baseline: 'middle' });
                    }
                }
            }
        });
        
        // Отрисовка инструкции под таблицей
        if (instructionText) {
            const finalY = doc.lastAutoTable.finalY;
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14;
            const maxWidth = pageWidth - margin * 2;
            
            doc.setFontSize(9);
            doc.setFont(fontName, "normal"); 
            doc.setTextColor(50, 50, 50); 
            
            const instructionLines = doc.splitTextToSize(instructionText, maxWidth);
            doc.text(instructionLines, margin, finalY + 10);
        }
        
        const pdfBlob = doc.output('blob');
        downloadBlob(pdfBlob, `FM_${state.city}.pdf`);
    } catch (e) {
        console.error("PDF generation error:", e);
        showToast("Ошибка генерации PDF");
    }
}

// XLSX Export using ExcelJS (Dynamic A4 Fit)
async function exportXLSX() {
    if (state.stations.length === 0) return showToast("Нет данных для экспорта");
    
    const isStandard = state.min === RU_MIN && state.max === RU_MAX;
    const shiftText = isStandard ? "Стандарт" : `${state.shift} МГц`;
    const title = `Город: ${state.city} | Диапазон: ${state.min} - ${state.max} МГц | Сдвиг: ${shiftText}`;
    
    const validStations = state.settingsMode 
        ? state.stations.filter(st => getStationData(st.name).type !== 'trash') 
        : state.stations;
        
    const sorted = [...validStations].sort((a, b) => a.freq - b.freq);
    const half = Math.ceil(sorted.length / 2);
    const p1 = sorted.slice(0, half);
    const p2 = sorted.slice(half);
    
    const instructionText = generateSetupInstruction(validStations);
    const hasInstruction = instructionText.length > 0;
    
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Stations');
    
    ws.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToWidth: 1,
        fitToHeight: 1,
        margins: { left: 0.2, right: 0.2, top: 0.1, bottom: 0.1, header: 0.0, footer: 0.0 }
    };
    ws.properties.defaultRowHeight = 18;
    ws.views = [{ showGridLines: false }];
    
    const colWidths = isStandard ? [8, 12, 33, 2, 8, 12, 33] : [8, 12, 33, 12, 2, 8, 12, 33, 12];
    colWidths.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
    });
    
    const headers = isStandard ? ["№", "Частота\n(МГц)", "Название станции"] : ["№", "Частота\n(МГц)", "Название станции", "На ГУ\n(МГц)"];
    const totalCols = headers.length * 2 + 1;
    
    const headerFont = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    
    const titleRow = ws.addRow([title]);
    ws.mergeCells(1, 1, 1, totalCols);
    titleRow.getCell(1).font = { name: 'Arial', size: 14, bold: true };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 25;
    
    const headerValues = [...headers, '', ...headers];
    const headerRow = ws.addRow(headerValues);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder;
    });
    
    const stationColWidth = 33; 
    const maxPixels = (stationColWidth * 7) - 10; 
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const isOverflowing = (station) => {
        if (!station || !station.name) return false;
        const data = getStationData(station.name);
        const isBold = data.type === 'fav' || data.type === 'cand';
        ctx.font = `${isBold ? 'bold ' : ''}14pt Arial`; 
        return ctx.measureText(station.name).width > maxPixels;
    };
    
    let isLongCount = 0;
    for (let i = 0; i < half; i++) {
        const r1 = p1[i];
        const r2 = p2[i];
        const isLong1 = r1 && isOverflowing(r1);
        const isLong2 = r2 && isOverflowing(r2);
        if (isLong1 || isLong2) isLongCount++;
    }
    
    const N = half;
    const availableHeight = 580; 
    const titleHeaderHeight = 55; 
    const instructionHeight = hasInstruction ? 40 : 0; 
    const dataAvailableHeight = availableHeight - titleHeaderHeight - instructionHeight;
    
    let baseHeight = 18; 
    if (N > 0) {
        baseHeight = (dataAvailableHeight - isLongCount * 11) / N;
        baseHeight = Math.min(18, baseHeight); 
        baseHeight = Math.max(15, baseHeight); 
        baseHeight = Math.round(baseHeight);
    }
    const longHeight = Math.max(26, baseHeight + 11); 
    
    const rowHeights = {};
    
    for (let i = 0; i < half; i++) {
        const r1 = p1[i];
        const r2 = p2[i];
        const rowValues = [];
        
        if (r1) {
            let numStr = "";
            if (state.settingsMode) {
                const statusData = getStatusExportData(r1.name);
                numStr = statusData.preset;
            }
            rowValues.push(numStr, formatFreq(r1.freq), r1.name);
            if (!isStandard) {
                const s1 = calcShiftedFreq(r1.freq);
                rowValues.push(s1 >= FM_BAND_MIN ? formatFreq(s1) : "—");
            }
        } else {
            rowValues.push(...(isStandard ? ["", "", ""] : ["", "", "", ""]));
        }
        
        rowValues.push(""); // Spacer
        
        if (r2) {
            let numStr = "";
            if (state.settingsMode) {
                const statusData = getStatusExportData(r2.name);
                numStr = statusData.preset;
            }
            rowValues.push(numStr, formatFreq(r2.freq), r2.name);
            if (!isStandard) {
                const s2 = calcShiftedFreq(r2.freq);
                rowValues.push(s2 >= FM_BAND_MIN ? formatFreq(s2) : "—");
            }
        } else {
            rowValues.push(...(isStandard ? ["", "", ""] : ["", "", "", ""]));
        }
        
        const row = ws.addRow(rowValues);
        const currentRowNum = i + 3; 
        
        const isLong1 = r1 && isOverflowing(r1);
        const isLong2 = r2 && isOverflowing(r2);
        const isLong = isLong1 || isLong2; 
        
        rowHeights[currentRowNum] = isLong ? longHeight : baseHeight;
        
        row.eachCell((cell, colNumber) => {
            cell.border = thinBorder;
            
            const colName = headerValues[colNumber - 1];
            const isLeftCol = colNumber <= headers.length;
            const currentStation = isLeftCol ? r1 : r2;
            
            const isCurrentLong = isLeftCol ? isLong1 : isLong2;
            
            let fontSize = 14; 
            let fontColor = { argb: 'FF000000' };
            let isBold = false;
            let isItalic = false;
            let isStrike = false;
            let cellFill = null;
            
            if (isCurrentLong && colName === 'Название станции') {
                fontSize = 11;
            }
            
            if (currentStation) {
                const data = getStationData(currentStation.name);
                const isAvail = isAvailable(currentStation.freq);
                
                if (!isAvail) {
                    fontColor = { argb: 'FF999999' };
                    isStrike = true;
                } else if (data.type === 'fav') {
                    isBold = true;
                    cellFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
                } else if (data.type === 'cand') {
                    isBold = true;
                    isItalic = true;
                    cellFill = { type: 'pattern', pattern: 'gray0625' };
                }
            }
            
            cell.font = { name: 'Arial', size: fontSize, bold: isBold, italic: isItalic, color: fontColor, strike: isStrike };
            
            let alignment = { vertical: 'middle' }; 
            
            if (colName === '№') {
                alignment.horizontal = 'center'; 
            } else if (colName === 'Название станции') {
                alignment.horizontal = 'left';
                alignment.indent = 1;
                if (isCurrentLong) {
                    alignment.wrapText = true; 
                }
            } else if (colName === '') {
                alignment.horizontal = 'center';
                cell.border = null; 
            } else {
                alignment.horizontal = 'center';
            }
            
            cell.alignment = alignment;
            if (cellFill) cell.fill = cellFill;
        });
    }
    
    for (let r = 3; r <= half + 2; r++) {
        ws.getRow(r).height = rowHeights[r] || baseHeight;
    }
    
    // 7. Добавление строки инструкции под таблицей
    if (hasInstruction) {
        const instrRow = ws.addRow([instructionText]);
        ws.mergeCells(instrRow.number, 1, instrRow.number, totalCols);
        instrRow.height = instructionHeight;
        const cell = instrRow.getCell(1);
        cell.font = { name: 'Arial', size: 10, color: { argb: 'FF333333' } }; 
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
        cell.border = thinBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; 
        
        for (let i = 2; i <= totalCols; i++) {
            const c = instrRow.getCell(i);
            c.border = thinBorder;
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
        }
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, `FM_${state.city}.xlsx`);
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
    const addChip = (shift, statusData) => {
        const chip = document.createElement("button");
        const statusType = statusData.type;
        const ratio = statusData.ratio || 0;
        chip.className = `chip ${statusType || ''}`;
        
        let tipText = `Сдвиг ${shift} МГц. `;
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
        }
        chip.onclick = (e) => { state.shift = shift; commitState(); render(); };
        chips.appendChild(chip);
    };
    SHIFTS.forEach(s => addChip(s, statuses[s] || { type: 'none' }));
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
    
    const frag = document.createDocumentFragment();
    
    sorted.forEach(st => {
        const item = document.createElement("div");
        item.className = "station-item";
        const shiftedNum = calcShiftedFreq(st.freq);
        const isAvail = isAvailable(st.freq);
        const freqClass = isAvail ? 'ok' : 'err';
        if (!isAvail) item.classList.add("unavailable");
        
        const freqDiv = document.createElement('div');
        freqDiv.className = 'freq';
        freqDiv.textContent = formatFreq(st.freq);
        item.appendChild(freqDiv);

        if (state.settingsMode) {
            const data = getStationData(st.name);
            if (data.type === 'trash') item.classList.add('trash');
            let iconClass = '';
            let iconChar = '○';
            let iconTitle = '';
            if (data.type === 'fav') { iconClass = 'fav'; iconChar = '♥'; iconTitle = 'Избранное'; }
            else if (data.type === 'cand') { iconClass = 'cand'; iconChar = '★'; iconTitle = 'Интересное'; }
            else if (data.type === 'trash') { iconClass = 'trash'; iconChar = '✖'; iconTitle = 'Мусор (исключается из экспорта)'; }
            
            const visible = isPresetVisible(data.presetIndex);
            const presetStr = visible ? formatPreset(data.presetIndex, state.bands, state.presets) : '';
            const displayStr = visible ? presetStr : '+';
            const isActive = visible;
            const btnTitle = isActive ? `Кнопка ${presetStr}` : '';
            
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
        nameDiv.textContent = st.name;
        nameDiv.setAttribute('title', st.name);
        nameDiv.style.cursor = 'pointer';
        nameDiv.addEventListener('click', () => showToast(st.name)); 
        item.appendChild(nameDiv);

        if (!isStandard) {
            const shiftedDiv = document.createElement('div');
            shiftedDiv.className = `shifted-freq ${freqClass}`;
            shiftedDiv.textContent = shiftedNum >= FM_BAND_MIN ? formatFreq(shiftedNum) : "—";
            item.appendChild(shiftedDiv);
        }

        frag.appendChild(item);
    });
    list.appendChild(frag);
}

function render() {
    const minInput = document.getElementById("minFreq");
    const maxInput = document.getElementById("maxFreq");
    const citySelect = document.getElementById("citySelect");
    if (document.activeElement !== minInput) minInput.value = state.min;
    if (document.activeElement !== maxInput) maxInput.value = state.max;
    if (document.activeElement !== document.getElementById('bands')) document.getElementById('bands').value = state.bands;
    if (document.activeElement !== document.getElementById('presets')) document.getElementById('presets').value = state.presets;
    if (citySelect.value !== state.city) citySelect.value = state.city;
    
    document.getElementById("templatesBtn").textContent = state.templateShort || "свой";
    
    renderAdapters(); 
    renderStations();
}

// STATE & PERSISTENCE
function commitState() {
    state.lastModified = Date.now();
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    updateUrl();
}

function saveState() {
    if (state.isGuestMode) {
        const ls = localStorage.getItem(LS_KEY);
        if (!ls) {
            state.isGuestMode = false;
            commitState();
        } else {
            showGuestPrompt();
        }
        return; 
    }
    clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(commitState, 300);
}

function showGuestPrompt() {
    const ls = localStorage.getItem(LS_KEY);
    let cacheDate = "Нет данных";
    if (ls) {
        try {
            const parsed = JSON.parse(ls);
            if (parsed.lastModified) cacheDate = new Date(parsed.lastModified).toLocaleString('ru-RU');
        } catch {}
    }
    document.getElementById('cacheDate').textContent = cacheDate;
    document.getElementById('linkDate').textContent = state.lastModified ? new Date(state.lastModified).toLocaleString('ru-RU') : "Только что";
    document.getElementById('guestModal').classList.add('show');
}

function serializeCityData(city) {
    if (!state.cityData[city]) return '';
    try {
        const stations = state.cityData[city].stations;
        const arr = Object.keys(stations).map(name => {
            const d = stations[name];
            return { n: name, t: d.type, p: d.presetIndex };
        });
        return encodeURIComponent(JSON.stringify(arr));
    } catch { return ''; }
}

function deserializeCityData(str, city) {
    if (!str) return null;
    try {
        const arr = JSON.parse(decodeURIComponent(str));
        const stations = {};
        arr.forEach(item => {
            if (item.n) {
                stations[item.n] = { type: item.t || 'normal', presetIndex: item.p || null };
            }
        });
        return stations;
    } catch { return null; }
}

function updateUrl() {
    const params = new URLSearchParams({
        city: state.city,
        min: state.min,
        max: state.max,
        shift: state.shift,
        mode: state.settingsMode ? 1 : 0,
        bands: state.bands,
        presets: state.presets,
        ts: state.lastModified || Date.now(),
        data: serializeCityData(state.city)
    });
    history.replaceState(null, "", `#${params.toString()}`);
}

function loadFromUrl() {
    if (location.hash.length < 2) return false;
    const params = new URLSearchParams(location.hash.slice(1));
    
    const city = params.get("city");
    if (city) state.city = city;
    
    const min = parseFloat(params.get("min"));
    if (!isNaN(min) && min >= 64 && min <= 110) state.min = min;
    
    const max = parseFloat(params.get("max"));
    if (!isNaN(max) && max >= 64 && max <= 110 && max > state.min) state.max = max;
    
    const shift = parseInt(params.get("shift"));
    if (!isNaN(shift) && shift >= 0 && shift <= 30) state.shift = shift;
    
    const mode = params.get("mode");
    if (mode === "1") state.settingsMode = true;
    
    const bands = parseInt(params.get("bands"));
    if (!isNaN(bands) && bands >= 1 && bands <= 5) state.bands = bands;
    
    const presets = parseInt(params.get("presets"));
    if (!isNaN(presets) && presets >= 1 && presets <= 18) state.presets = presets;
    
    const ts = parseInt(params.get("ts"));
    if (!isNaN(ts) && Number.isFinite(ts)) state.lastModified = ts;
    
    const dataStr = params.get("data");
    if (dataStr) {
        const stations = deserializeCityData(dataStr, state.city);
        if (stations) {
            if (!state.cityData[state.city]) state.cityData[state.city] = { stations: {} };
            state.cityData[state.city].stations = stations;
        }
    }
    
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
    const keysToRemove = [
        "fm_adapter_calc",
        "fm_adapter_calc_v2",
        "fm_adapter_calc_v3",
        "fm_adapter_calc_v4",
        "fm_adapter_calc_v5",
        "fm_adapter_calc_v6",
        "fm_adapter_calc_v7",
        "fm_adapter_calc_v8",
        "fm_adapter_calc_v9",
        LS_KEY, 
        LS_THEME_KEY,
        "geo_checked"
    ];
    
    keysToRemove.forEach(k => localStorage.removeItem(k));
    history.replaceState(null, "", window.location.pathname);
    showToast("Полный сброс выполнен");
    setTimeout(() => window.location.reload(), 600);
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

// EVENTS
async function init() {
    initTheme();
    await loadCyrillicFont();
    document.getElementById('appVersion').textContent = 'v' + VERSION;
    
    const citySelect = document.getElementById("citySelect");
    const templatesMenu = document.getElementById("templatesMenu");
    const stationsList = document.getElementById("stationsList");
    
    if (!citySelect || !templatesMenu || !stationsList) {
        console.error("DOM initialization failed: missing elements.");
        return;
    }
    
    TEMPLATES.forEach(t => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = t.name; 
        item.onclick = () => {
            state.template = t.name;
            state.templateShort = t.short;
            state.min = t.range[0]; 
            state.max = t.range[1]; 
            state.shift = 0;
            commitState(); render();
            templatesMenu.classList.remove("show");
        };
        templatesMenu.appendChild(item);
    });
    
    stationsList.addEventListener('click', (e) => {
        const icon = e.target.closest('.status-icon');
        const btn = e.target.closest('.preset-btn');
        if (icon) {
            e.stopPropagation();
            cycleStationStatus(icon.dataset.name);
        } else if (btn) {
            e.stopPropagation();
            openPresetMenu(btn, btn.dataset.name);
        }
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
            document.getElementById("downloadMenu").classList.remove("show");
        });
    });
    document.getElementById('settingsBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleSettings(); });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.preset-dropdown') && !e.target.closest('.preset-menu') && !e.target.closest('.preset-btn')) closePresetMenu();
        if (!e.target.closest('#templatesBtn') && !e.target.closest('#templatesMenu')) document.getElementById("templatesMenu").classList.remove("show");
        if (!e.target.closest('#downloadBtn') && !e.target.closest('#downloadMenu')) document.getElementById("downloadMenu").classList.remove("show");
    });

    loadFromLS();
    const hasUrl = loadFromUrl();
    
    if (hasUrl) {
        const ls = localStorage.getItem(LS_KEY);
        let lsTs = 0;
        if (ls) {
            try {
                const parsed = JSON.parse(ls);
                if (parsed.lastModified) lsTs = parsed.lastModified;
            } catch {}
        }
        if (Number.isFinite(state.lastModified) && state.lastModified !== lsTs) {
            state.isGuestMode = true;
        } else {
            loadFromLS(); 
            state.isGuestMode = false;
        }
    } else {
        state.isGuestMode = false;
    }

    applySettingsMode();
    const html = await fetchPage(MAIN_PAGE);
    if (!html) {
        document.getElementById("errorMsg").style.display = "block";
        document.getElementById("errorMsg").textContent = "Сайт недоступен. Приносим дикие извинения за неудобства!";
        return;
    }
    citiesMap = parseCities(html);
    citySelect.innerHTML = "";
    Object.keys(citiesMap).sort().forEach(c => {
        const opt = document.createElement("option");
        opt.value = c; opt.textContent = c;
        citySelect.appendChild(opt);
    });
    if (!citiesMap[state.city]) state.city = DEFAULT_STATE.city;
    await loadCity(state.city);
    render();
    updateUrl();
    if (!hasUrl && !localStorage.getItem("geo_checked")) checkGeo(false);
}

async function loadCity(city) {
    if (!citiesMap[city]) return;
    state.city = city;
    const ls = localStorage.getItem(LS_KEY);
    const list = document.getElementById('stationsList');
    
    if (ls) {
        const parsed = JSON.parse(ls);
        if (parsed.city === city && parsed.stations?.length > 0) { 
            state.stations = parsed.stations; 
            render(); 
        } else {
            list.innerHTML = '<div class="loading-msg">Загрузка станций...</div>';
        }
    } else {
        list.innerHTML = '<div class="loading-msg">Загрузка станций...</div>';
    }

    const html = await fetchPage(citiesMap[city]);
    if (html) {
        const parsed = parseStations(html);
        if (parsed.length > 0) {
            state.stations = parsed;
            commitState();
            render();
        } else {
            showToast("Ошибка парсинга. Используем кэш.");
        }
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

// Clipboard API Fallback
async function copyShareLink() {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(url);
            showToast("Ссылка скопирована в буфер обмена");
        } catch (err) {
            fallbackCopyTextToClipboard(url);
        }
    } else {
        fallbackCopyTextToClipboard(url);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
            showToast("Ссылка скопирована (старый метод)");
        } else {
            window.prompt("Скопируйте ссылку вручную (Ctrl+C):", text);
        }
    } catch (err) {
        document.body.removeChild(textArea);
        window.prompt("Скопируйте ссылку вручную (Ctrl+C):", text);
    }
}

document.getElementById("themeBtn").addEventListener("click", toggleTheme);

document.getElementById("citySelect").addEventListener("change", (e) => { 
    state.city = e.target.value; 
    commitState(); 
    loadCity(state.city); 
});

document.getElementById("templatesBtn").addEventListener("click", (e) => {
    e.stopPropagation(); document.getElementById("templatesMenu").classList.toggle("show"); document.getElementById("downloadMenu").classList.remove("show");
});

document.getElementById('overwriteBtn').addEventListener('click', () => {
    state.isGuestMode = false;
    commitState();
    document.getElementById('guestModal').classList.remove('show');
    showToast("Настройки перезаписаны");
});
document.getElementById('restoreBtn').addEventListener('click', () => {
    state.isGuestMode = false;
    const ls = localStorage.getItem(LS_KEY);
    if (ls) {
        state = { ...state, ...JSON.parse(ls) };
        if (!state.cityData) state.cityData = {};
    }
    applySettingsMode();
    render();
    document.getElementById('guestModal').classList.remove('show');
    showToast("Возвращены ваши настройки");
    updateUrl();
});

(function() {
    let clickCount = 0; let clickTimer = null;
    const logoBtn = document.getElementById('logoBtn');
    
    const triggerReset = () => {
        clearTimeout(clickTimer);
        clickCount = 0;
        if (confirm('Вы уверены, что хотите полностью сбросить настройки и кэш?')) {
            resetAll();
        }
    };
    
    logoBtn.addEventListener('click', () => {
        clickCount++;
        if (clickCount === 1) clickTimer = setTimeout(() => clickCount = 0, 600);
        else if (clickCount === 3) triggerReset();
    });
    
    logoBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerReset();
        }
    });
})();

function setupWheelInput(id, min, max, step, stateProp) {
    const el = document.getElementById(id);
    el.setAttribute("min", min);
    el.setAttribute("max", max);

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
        } else {
             state[stateProp] = Math.round(val);
        }
        return true;
    };

    el.addEventListener("input", (e) => {
        if (e.target.value === "") return; 
        let val = parseFloat(e.target.value);
        if (applyChange(val)) {
            saveState(); render();
        }
    });

    el.addEventListener("blur", () => {
        if (el.value === "" || isNaN(parseFloat(el.value))) {
            applyChange(min); 
            commitState(); render();
        }
    });

    el.addEventListener("wheel", (e) => {
        e.preventDefault();
        let val = parseFloat(el.value) || min;
        if (e.deltaY < 0) val += step;
        else val -= step;
        if (applyChange(val)) {
            saveState(); render();
        }
    }, { passive: false });

    let touchStartY = null;
    let touchStartVal = null;

    el.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
        touchStartVal = parseFloat(el.value) || min;
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
        if (touchStartY === null) return;
        e.preventDefault();
        const currentY = e.touches[0].clientY;
        const deltaY = touchStartY - currentY;
        const steps = Math.round(deltaY / 15);
        let newVal = touchStartVal + (steps * step);
        if (applyChange(newVal)) {
            // Throttle render
        }
    }, { passive: false });

    el.addEventListener('touchend', () => {
        if (touchStartY !== null) {
            commitState();
            render();
        }
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