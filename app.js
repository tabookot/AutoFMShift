// 0.5.5 | Rule: minor.major.build. build++ on full regen
const VERSION = "0.5.5";
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
        } else { currentLine = testLine; }
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
        const button = `⟦ ${presetStr} ⟧`;
        return { freq: calcShiftedFreq(st.freq), button: button };
    }).sort((a, b) => a.freq - b.freq);
    if (setupStations.length === 0) return "";
    const steps = setupStations.map(s => `${formatFreq(s.freq)} ${s.button}`);
    return "Настройка: " + steps.join("  →  ");
}

// CANVAS (PNG)
function generateCanvas() {
    const isMobile = window.innerWidth < 600;
    const cols = isMobile ? 1 : 2;
    const padding = 20;
    const rowHeight = 28;
    const headerHeight = 35;
    const titleHeightBase = 60;
    const validStations = state.settingsMode ? state.stations.filter(st => getStationData(st.name).type !== 'trash') : state.stations;
    const sorted = [...validStations].sort((a, b) => a.freq - b.freq);
    const half = cols === 1 ? sorted.length : Math.ceil(sorted.length / 2);
    const parts = cols === 1 ? [sorted] : [sorted.slice(0, half), sorted.slice(half)];
    const instructionText = state.settingsMode ? generateSetupInstruction(validStations) : "";
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
        if (state.settingsMode) { ctx.fillText('Пометки', currentX, y + headerHeight / 2); currentX += markWidth; }
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
    if (instructionLines.length > 0) {
        ctx.fillStyle = '#333333';
        ctx.font = '12px Arial';
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

// PDF
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
        const validStations = state.settingsMode ? state.stations.filter(st => getStationData(st.name).type !== 'trash') : state.stations;
        const sorted = [...validStations].sort((a, b) => a.freq - b.freq);
        const half = Math.ceil(sorted.length / 2);
        const p1 = sorted.slice(0, half);
        const p2 = sorted.slice(half);
        const instructionText = state.settingsMode ? generateSetupInstruction(validStations) : "";
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
                        data.cell.custom = { icon: statusData.icon, preset: statusData.preset, color: statusData.color };
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
                        if (color) { doc.setTextColor(color[0], color[1], color[2]); } else { doc.setTextColor(33, 37, 41); }
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

// XLSX
async function exportXLSX() {
    if (state.stations.length === 0) return showToast("Нет данных для экспорта");
    const isStandard = state.min === RU_MIN && state.max === RU_MAX;
    const shiftText = isStandard ? "Стандарт" : `${state.shift} МГц`;
    const title = `Город: ${state.city} | Диапазон: ${state.min} - ${state.max} МГц | Сдвиг: ${shiftText}`;
    const validStations = state.settingsMode ? state.stations.filter(st => getStationData(st.name).type !== 'trash') : state.stations;
    const sorted = [...validStations].sort((a, b) => a.freq - b.freq);
    const half = Math.ceil(sorted.length / 2);
    const p1 = sorted.slice(0, half);
    const p2 = sorted.slice(half);
    const instructionText = state.settingsMode ? generateSetupInstruction(validStations) : "";
    const hasInstruction = instructionText.length > 0;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Stations');
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.2, right: 0.2, top: 0.1, bottom: 0.1, header: 0.0, footer: 0.0 } };
    ws.properties.defaultRowHeight = 18;
    ws.views = [{ showGridLines: false }];
    const colWidths = isStandard ? [8, 12, 33, 2, 8, 12, 33] : [8, 12, 33, 12, 2, 8, 12, 33, 12];
    colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const headers = isStandard ? ["№", "Частота\n(МГц)", "Название станции"] : ["№", "Частота\n(МГц)", "Название станции", "На ГУ\n(МГц)"];
    const totalCols = headers.length * 2 + 1;
    const headerFont = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    const thinBorder = { top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } };
    const titleRow = ws.addRow([title]);
    ws.mergeCells(1, 1, 1, totalCols);
    titleRow.getCell(1).font = { name: 'Arial', size: 14, bold: true };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 25;
    const headerValues = [...headers, '', ...headers];
    const headerRow = ws.addRow(headerValues);
    headerRow.height = 30;
    headerRow.eachCell((cell) => { cell.font = headerFont; cell.fill = headerFill; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = thinBorder; });
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
        const r1 = p1[i]; const r2 = p2[i];
        const isLong1 = r1 && isOverflowing(r1);
        const isLong2 = r2 && isOverflowing(r2);
        if (isLong1 || isLong2) isLongCount++;
    }
    const N = half;
    const availableHeight = 580; 
    const titleHeaderHeight = 55; 
    let instructionHeight = 0;
    if (hasInstruction) {
        const totalColWidth = colWidths.reduce((a, b) => a + b, 0);
        const maxPixelsInstr = (totalColWidth * 7) - 20; 
        ctx.font = '10pt Arial'; 
        const textWidth = ctx.measureText(instructionText).width;
        const lines = Math.max(1, Math.ceil(textWidth / maxPixelsInstr));
        instructionHeight = lines * 12 + 8; 
    }
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
        const r1 = p1[i]; const r2 = p2[i]; const rowValues = [];
        if (r1) {
            let numStr = "";
            if (state.settingsMode) { const statusData = getStatusExportData(r1.name); numStr = statusData.preset; }
            rowValues.push(numStr, formatFreq(r1.freq), r1.name);
            if (!isStandard) { const s1 = calcShiftedFreq(r1.freq); rowValues.push(s1 >= FM_BAND_MIN ? formatFreq(s1) : "—"); }
        } else { rowValues.push(...(isStandard ? ["", "", ""] : ["", "", "", ""])); }
        rowValues.push(""); 
        if (r2) {
            let numStr = "";
            if (state.settingsMode) { const statusData = getStatusExportData(r2.name); numStr = statusData.preset; }
            rowValues.push(numStr, formatFreq(r2.freq), r2.name);
            if (!isStandard) { const s2 = calcShiftedFreq(r2.freq); rowValues.push(s2 >= FM_BAND_MIN ? formatFreq(s2) : "—"); }
        } else { rowValues.push(...(isStandard ? ["", "", ""] : ["", "", "", ""])); }
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
            let fontSize = 14; let fontColor = { argb: 'FF000000' }; let isBold = false; let isItalic = false; let isStrike = false; let cellFill = null;
            if (isCurrentLong && colName === 'Название станции') { fontSize = 11; }
            if (currentStation) {
                const data = getStationData(currentStation.name);
                const isAvail = isAvailable(currentStation.freq);
                if (!isAvail) { fontColor = { argb: 'FF999999' }; isStrike = true; } 
                else if (data.type === 'fav') { isBold = true; cellFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }; } 
                else if (data.type === 'cand') { isBold = true; isItalic = true; cellFill = { type: 'pattern', pattern: 'gray0625' }; }
            }
            cell.font = { name: 'Arial', size: fontSize, bold: isBold, italic: isItalic, color: fontColor, strike: isStrike };
            let alignment = { vertical: 'middle' }; 
            if (colName === '№') { alignment.horizontal = 'center'; } 
            else if (colName === 'Название станции') { alignment.horizontal = 'left'; alignment.indent = 1; if (isCurrentLong) { alignment.wrapText = true; } } 
            else if (colName === '') { alignment.horizontal = 'center'; cell.border = null; } 
            else { alignment.horizontal = 'center'; }
            cell.alignment = alignment;
            if (cellFill) cell.fill = cellFill;
        });
    }
    for (let r = 3; r <= half + 2; r++) { ws.getRow(r).height = rowHeights[r] || baseHeight; }
    if (hasInstruction) {
        const instrRow = ws.addRow([instructionText]);
        ws.mergeCells(instrRow.number, 1, instrRow.number, totalCols);
        instrRow.height = instructionHeight;
        const cell = instrRow.getCell(1);
        cell.font = { name: 'Arial', size: 10, color: { argb: 'FF333333' } }; 
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
        cell.border = thinBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; 
        for (let i = 2; i <= totalCols; i++) { const c = instrRow.getCell(i); c.border = thinBorder; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }; }
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
        item.dataset.source = state.stationsSource || 'cache';
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
    if (stats.fav) textParts.push(`${stats.fav} ${pluralize(stats.fav, 'любимая', 'любимые', 'любимых')}`);
    if (stats.cand) textParts.push(`${stats.cand} ${pluralize(stats.cand, 'интересная', 'интересные', 'интересных')}`);
    if (stats.trash) textParts.push(`${stats.trash} ${pluralize(stats.trash, 'мусорная', 'мусорные', 'мусорных')}`);
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

    // Гарантируем, что обработчик клика всегда привязан, даже если init() прервался из-за ошибки сети
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
    
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    updateUrl();
}
function saveState() {
    if (state.isGuestMode) {
        const ls = localStorage.getItem(LS_KEY);
        if (!ls) { state.isGuestMode = false; commitState(); } 
        else { showGuestPrompt(); }
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
            if (item.n) { stations[item.n] = { type: item.t || 'normal', presetIndex: item.p || null }; }
        });
        return stations;
    } catch { return null; }
}
function updateUrl() {
    const params = new URLSearchParams({
        city: state.city, min: state.min, max: state.max, shift: state.shift,
        mode: state.settingsMode ? 1 : 0, bands: state.bands, presets: state.presets,
        ts: state.lastModified || Date.now(), data: serializeCityData(state.city)
    });
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
    const bands = parseInt(params.get("bands")); if (!isNaN(bands) && bands >= 1 && bands <= 5) state.bands = bands;
    const presets = parseInt(params.get("presets")); if (!isNaN(presets) && presets >= 1 && presets <= 18) state.presets = presets;
    const ts = parseInt(params.get("ts")); if (!isNaN(ts) && Number.isFinite(ts)) state.lastModified = ts;
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
            return {
                name: st.name,
                freq: st.freq,
                type: sData.type || 'normal',
                presetIndex: sData.presetIndex || null
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
async function init() {
    const savedCacheVersion = localStorage.getItem("fm_cache_version");
    if (savedCacheVersion !== CACHE_VERSION) {
        document.getElementById('cacheModal').classList.add('show');
        return;
    }

    initTheme();
    await loadCyrillicFont();
    document.getElementById('appVersion').textContent = 'v' + VERSION;
    
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
            
            menu.innerHTML = `
                <div class="dropdown-item" data-action="download-png">${iconDownload}Скачать PNG</div>
                <div class="dropdown-item" data-action="download-pdf">${iconDownload}Скачать PDF</div>
                <div class="dropdown-item" data-action="download-xlsx">${iconDownload}Скачать XLSX</div>
                <div class="dropdown-item" data-action="download-json">${iconDownload}Экспорт JSON</div>
                <div class="dropdown-item" data-action="share">${iconShare}Поделиться</div>
                <div class="dropdown-item" data-action="theme">${iconTheme}Сменить тему</div>
                <div class="dropdown-item" data-action="help">${iconHelp}Инструкция</div>
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
    
    const html = await Api.fetchPage(Api.MAIN_PAGE);
    if (html) {
        const newCities = Api.parseCities(html);
        if (Object.keys(newCities).length > 0) {
            citiesMap = newCities;
            localStorage.setItem("fm_cities_map", JSON.stringify(citiesMap));
        }
    } else {
        try {
            const res = await fetch('backup-api.json');
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
    if (!hasUrl && !localStorage.getItem("geo_checked")) checkGeo(false);
}

async function loadCity(city) {
    if (!citiesMap[city] && !state.cityData[city]?.allStations) return;
    state.city = city;
    
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
        newStations = window.apiBackupData.cities[FMUse.generateCodeName(city)].stations.map(s => ({ name: s.name, freq: s.freq }));
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
    const url = window.location.href;
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
document.getElementById('overwriteBtn').addEventListener('click', () => {
    state.isGuestMode = false; commitState();
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
    applySettingsMode(); render();
    document.getElementById('guestModal').classList.remove('show');
    showToast("Возвращены ваши настройки");
    updateUrl();
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