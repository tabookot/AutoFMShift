// 0.1.54 | Rule: minor.major.build. build++ on full regen
const VERSION = "0.1.54";
const API_URL = "https://radiopedia.fandom.com/ru/api.php";
const MAIN_PAGE = "Частотные планы радиостанций в городах России";
const LS_KEY = "fm_adapter_calc_v10"; 
const LS_THEME_KEY = "fm_adapter_theme";

const TEMPLATES = [
    { name: "Россия / Европа", short: "ru/eu", range: [87.5, 108.0] },
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
    min: 87.5,
    max: 108.0,
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

// THEME
function initTheme() {
    const savedTheme = localStorage.getItem(LS_THEME_KEY);
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon();
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDarkDefault = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let newTheme;
    if (currentTheme) newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    else newTheme = isDarkDefault ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(LS_THEME_KEY, newTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDarkDefault = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = currentTheme ? currentTheme === 'dark' : isDarkDefault;
    document.getElementById('themeBtn').textContent = isDark ? '☀' : '☾';
}

// API & PARSING
async function fetchPage(title) {
    const url = `${API_URL}?action=parse&page=${encodeURIComponent(title)}&format=json&prop=text&origin=*`;
    try {
        const res = await fetch(url);
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
                    if (f >= 76.0 && f <= 108.0) freq = f;
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
    if (state.min === 87.5 && state.max === 108.0) return { statuses: {}, best: 0 };
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
    if (state.shift === 0 || (state.min === 87.5 && state.max === 108.0)) return freq;
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
    saveState();
    applySettingsMode();
    render();
}

function applySettingsMode() {
    const display = state.settingsMode ? 'block' : 'none';
    document.getElementById('bands').style.display = display;
    document.getElementById('presets').style.display = display;
    document.getElementById('statusHeader').style.display = state.settingsMode ? 'block' : 'none';
    document.getElementById('settingsBtn').classList.toggle('active', state.settingsMode);
}

function getStationData(name) {
    if (!state.cityData[state.city]) state.cityData[state.city] = { stations: {} };
    if (!state.cityData[state.city].stations[name]) {
        state.cityData[state.city].stations[name] = { type: 'normal', presetIndex: null };
    }
    return state.cityData[state.city].stations[name];
}

function cycleStationStatus(name) {
    const data = getStationData(name);
    if (data.type === 'normal') data.type = 'fav';
    else if (data.type === 'fav') data.type = 'cand';
    else if (data.type === 'cand') data.type = 'trash';
    else data.type = 'normal';
    saveState();
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
        for (let n in cityStations) {
            if (cityStations[n].presetIndex === presetIndex && n !== name) cityStations[n].presetIndex = null;
        }
    }
    const data = getStationData(name);
    data.presetIndex = data.presetIndex === presetIndex ? null : presetIndex;
    saveState();
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
        for (let n in cityStations) {
            if (cityStations[n].presetIndex === p && n !== name) { occupiedBy = n; break; }
        }
        
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
        
        item.onclick = () => { assignPreset(name, p); closePresetMenu(); };
        menu.appendChild(item);
    }
    
    const clearItem = document.createElement('div');
    clearItem.className = 'dropdown-item preset-item preset-clear';
    clearItem.textContent = '✕ Очистить';
    clearItem.onclick = () => { assignPreset(name, null); closePresetMenu(); };
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
        maxShiftedWidth = Math.max(maxShiftedWidth, tempCtx.measureText(shifted >= 76 ? formatFreq(shifted) : '—').width);
        if (state.settingsMode) {
            const statusData = getStatusExportData(st.name);
            const text = `${statusData.icon} ${statusData.preset}`.trim();
            maxMarkWidth = Math.max(maxMarkWidth, tempCtx.measureText(text).width);
        }
    });
    
    const isStandard = state.min === 87.5 && state.max === 108.0;
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
    
    const canvasHeight = finalTitleHeight + headerHeight + maxRows * rowHeight + padding;
    
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
        ctx.fillText('Станция', currentX, y + headerHeight / 2);
        currentX += maxNameWidth + padX;
        ctx.fillText('Частота', currentX, y + headerHeight / 2);
        currentX += maxFreqWidth + padX;
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
            
            let name = st.name;
            while (ctx.measureText(name).width > maxNameWidth && name.length > 0) name = name.slice(0, -1);
            if (name !== st.name) name += '...';
            ctx.fillText(name, currentX, y + rowHeight / 2);
            ctx.fillText(formatFreq(st.freq), currentX + maxNameWidth + padX, y + rowHeight / 2);
            if (!isStandard) {
                ctx.fillStyle = isAvail ? '#27ae60' : '#e74c3c';
                ctx.fillText(shifted >= 76 ? formatFreq(shifted) : '—', currentX + maxNameWidth + padX + maxFreqWidth + padX, y + rowHeight / 2);
            }
            y += rowHeight;
        });
        ctx.strokeRect(xOffset, finalTitleHeight, colWidth, headerHeight + maxRows * rowHeight);
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
        
        const isStandard = state.min === 87.5 && state.max === 108.0;
        const shiftText = isStandard ? "Стандарт" : `${state.shift} МГц`;
        const title = `Город: ${state.city} | Диапазон: ${state.min} - ${state.max} МГц | Сдвиг: ${shiftText}`;
        
        const validStations = state.settingsMode 
            ? state.stations.filter(st => getStationData(st.name).type !== 'trash') 
            : state.stations;
            
        const sorted = [...validStations].sort((a, b) => a.freq - b.freq);
        const half = Math.ceil(sorted.length / 2);
        const p1 = sorted.slice(0, half);
        const p2 = sorted.slice(half);
        
        const headers = isStandard ? ["Пометки", "Станция", "Частота"] : ["Пометки", "Станция", "Частота", "На ГУ"];
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
                row.push(r1.name);
                row.push(formatFreq(r1.freq));
                if (!isStandard) {
                    const s1 = calcShiftedFreq(r1.freq);
                    row.push(s1 >= 76 ? formatFreq(s1) : "—");
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
                row.push(r2.name);
                row.push(formatFreq(r2.freq));
                if (!isStandard) {
                    const s2 = calcShiftedFreq(r2.freq);
                    row.push(s2 >= 76 ? formatFreq(s2) : "—");
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
                        if (statusData.preset) data.cell.styles.textColor = [33, 37, 41]; 
                        else if (statusData.color) data.cell.styles.textColor = statusData.color; 
                    }
                    if (colName === 'На ГУ') {
                        if (currentStation && !isAvailable(currentStation.freq)) data.cell.styles.textColor = [231, 76, 60];
                        else if (currentStation) data.cell.styles.textColor = [39, 174, 96];
                    }
                }
            }
        });
        
        const pdfBlob = doc.output('blob');
        downloadBlob(pdfBlob, `FM_${state.city}.pdf`);
    } catch (e) {
        console.error("PDF generation error:", e);
        showToast("Ошибка генерации PDF");
    }
}

function exportXLSX() {
    if (state.stations.length === 0) return showToast("Нет данных для экспорта");
    
    const isStandard = state.min === 87.5 && state.max === 108.0;
    const shiftText = isStandard ? "Стандарт" : `${state.shift} МГц`;
    const title = `Город: ${state.city} | Диапазон: ${state.min} - ${state.max} МГц | Сдвиг: ${shiftText}`;
    
    const validStations = state.settingsMode 
        ? state.stations.filter(st => getStationData(st.name).type !== 'trash') 
        : state.stations;
        
    const sorted = [...validStations].sort((a, b) => a.freq - b.freq);
    const half = Math.ceil(sorted.length / 2);
    const p1 = sorted.slice(0, half);
    const p2 = sorted.slice(half);
    
    const headers = isStandard ? ["Пометки", "Станция", "Частота"] : ["Пометки", "Станция", "Частота", "На ГУ"];
    const headerRow = [...headers, '', ...headers];
    
    const aoa = [[title], [], headerRow];
    
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
            row.push(r1.name);
            row.push(formatFreq(r1.freq));
            if (!isStandard) {
                const s1 = calcShiftedFreq(r1.freq);
                row.push(s1 >= 76 ? formatFreq(s1) : "—");
            }
        } else { row.push(...(isStandard ? ["", "", ""] : ["", "", "", ""])); }
        row.push("");
        if (r2) {
            let statusText = "";
            if (state.settingsMode) {
                const statusData = getStatusExportData(r2.name);
                statusText = `${statusData.icon} ${statusData.preset}`.trim();
            }
            row.push(statusText);
            row.push(r2.name);
            row.push(formatFreq(r2.freq));
            if (!isStandard) {
                const s2 = calcShiftedFreq(r2.freq);
                row.push(s2 >= 76 ? formatFreq(s2) : "—");
            }
        } else { row.push(...(isStandard ? ["", "", ""] : ["", "", "", ""])); }
        aoa.push(row);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    const totalCols = headerRow.length;
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];
    
    if (isStandard) ws['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 15 }, { wch: 3 }, { wch: 12 }, { wch: 35 }, { wch: 15 }];
    else ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 3 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
    
    ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9, scale: 100 };
    ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 };
    ws['!sheetView'] = { showGridLines: false };
    
    const borderStyle = {
        top: { style: 'thin', color: { rgb: "000000" } },
        bottom: { style: 'thin', color: { rgb: "000000" } },
        left: { style: 'thin', color: { rgb: "000000" } },
        right: { style: 'thin', color: { rgb: "000000" } }
    };
    
    for (let R = 0; R <= range.e.r; R++) {
        for (let C = 0; C <= range.e.c; C++) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellAddress];
            if (!cell) continue;
            cell.s = {};
            if (R === 0) {
                cell.s.font = { bold: true, sz: 16 };
                cell.s.alignment = { horizontal: 'center', vertical: 'center' };
            } else if (R === 2) {
                cell.s.font = { bold: true, color: { rgb: "FFFFFF" }, sz: 14 };
                cell.s.fill = { patternType: "solid", fgColor: { rgb: "000000" } };
                cell.s.alignment = { horizontal: 'center', vertical: 'center' };
                cell.s.border = borderStyle;
            } else if (R > 2) {
                cell.s.font = { sz: 14 };
                cell.s.border = borderStyle;
                const colName = headerRow[C];
                if (colName === 'Пометки' && state.settingsMode) {
                    cell.s.fill = { patternType: "solid", fgColor: { rgb: "EEEEEE" } };
                    cell.s.alignment = { horizontal: 'left', vertical: 'center' };
                }
                if (!isStandard && colName === 'На ГУ') {
                    if (cell.v === '—') cell.s.font = { strike: true, color: { rgb: "999999" }, sz: 14 };
                    else if (cell.v !== '') cell.s.font = { bold: true, sz: 14 };
                }
                const rowIdx = R - 3;
                const isLeftCol = C < (isStandard ? 3 : 4);
                const currentStation = isLeftCol ? p1[rowIdx] : p2[rowIdx];
                if (currentStation && !isAvailable(currentStation.freq)) cell.s.font = { ...cell.s.font, color: { rgb: "999999" } };
                if (colName === 'Станция') cell.s.alignment = { horizontal: 'left', vertical: 'center' };
                else if (colName !== 'Пометки' || !state.settingsMode) cell.s.alignment = { horizontal: 'center', vertical: 'center' };
            }
        }
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stations");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    downloadBlob(blob, `FM_${state.city}.xlsx`);
}

// UI RENDER
function renderAdapters() {
    const panel = document.getElementById("adapterPanel");
    const chips = document.getElementById("adapterChips");
    chips.innerHTML = "";
    const isStandard = state.min === 87.5 && state.max === 108.0;
    if (isStandard) { panel.style.display = "none"; return; }
    panel.style.display = "block";
    const { statuses, best } = evaluateShifts();
    const addChip = (shift, statusData) => {
        const chip = document.createElement("button");
        const statusType = statusData.type;
        const ratio = statusData.ratio || 0;
        chip.className = `chip ${statusType || ''}`;
        if (shift === best && statusType === 'full') chip.classList.add('best');
        if (shift === state.shift) chip.classList.add("active");
        if (shift === 0) { chip.textContent = "0"; chip.setAttribute('data-tip', 'Без адаптера'); }
        else chip.textContent = shift;
        if (statusType === 'partial') {
            const r = Math.round(255 - 14 * ratio);
            const g = Math.round(71 + 125 * ratio);
            const b = Math.round(87 - 72 * ratio);
            const color = `rgb(${r}, ${g}, ${b})`;
            chip.style.color = color; chip.style.borderColor = color;
            if (shift === state.shift) { chip.style.backgroundColor = color; chip.style.color = 'var(--bg)'; }
        }
        chip.onclick = (e) => { state.shift = shift; saveState(); render(); };
        chips.appendChild(chip);
    };
    SHIFTS.forEach(s => addChip(s, statuses[s] || { type: 'none' }));
}

function renderStations() {
    const list = document.getElementById("stationsList");
    list.innerHTML = "";
    if (state.stations.length === 0) { list.innerHTML = `<div style="text-align:center;color:var(--text-dim);padding:20px;">Нет данных</div>`; return; }
    const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
    const isStandard = state.min === 87.5 && state.max === 108.0;
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
            if (data.type === 'fav') { iconClass = 'fav'; iconChar = '♥'; }
            else if (data.type === 'cand') { iconClass = 'cand'; iconChar = '★'; }
            else if (data.type === 'trash') { iconClass = 'trash'; iconChar = '✖'; }
            
            const visible = isPresetVisible(data.presetIndex);
            const presetStr = visible ? formatPreset(data.presetIndex, state.bands, state.presets) : '';
            const displayStr = visible ? presetStr : '+';
            const isActive = visible;
            
            const statusCell = document.createElement('div');
            statusCell.className = 'status-cell';
            statusCell.innerHTML = `
                <span class="status-icon ${iconClass}" data-name="${st.name}">${iconChar}</span>
                <div class="preset-dropdown">
                    <button class="preset-btn ${isActive ? 'active' : ''}" data-name="${st.name}">${displayStr}</button>
                </div>
            `;
            item.appendChild(statusCell);
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.textContent = st.name;
        nameDiv.title = st.name; 
        nameDiv.style.cursor = 'pointer';
        nameDiv.addEventListener('click', () => showToast(st.name)); 
        item.appendChild(nameDiv);

        if (!isStandard) {
            const shiftedDiv = document.createElement('div');
            shiftedDiv.className = `shifted-freq ${freqClass}`;
            shiftedDiv.textContent = shiftedNum >= 76 ? formatFreq(shiftedNum) : "—";
            item.appendChild(shiftedDiv);
        }

        list.appendChild(item);
    });
    if (state.settingsMode) {
        list.querySelectorAll('.status-icon').forEach(icon => icon.addEventListener('click', (e) => { e.stopPropagation(); cycleStationStatus(e.target.getAttribute('data-name')); }));
        list.querySelectorAll('.preset-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openPresetMenu(e.target, e.target.getAttribute('data-name')); }));
    }
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
    const tmpl = TEMPLATES.find(t => t.name === state.template) || TEMPLATES.find(t => t.name === "Свой вариант");
    document.getElementById("templatesBtn").textContent = tmpl ? tmpl.short : "свой";
    renderAdapters(); renderStations(); updateUrl();
}

// STATE & PERSISTENCE
function saveState() {
    if (state.isGuestMode) {
        const ls = localStorage.getItem(LS_KEY);
        if (!ls) {
            state.isGuestMode = false;
            state.lastModified = Date.now();
            localStorage.setItem(LS_KEY, JSON.stringify(state));
        } else {
            showGuestPrompt();
        }
        return; 
    }
    state.lastModified = Date.now();
    localStorage.setItem(LS_KEY, JSON.stringify(state));
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
    const stations = state.cityData[city].stations;
    return Object.keys(stations).map(name => {
        const d = stations[name];
        const t = d.type === 'fav' ? 'f' : d.type === 'cand' ? 'c' : d.type === 'trash' ? 't' : 'n';
        const p = d.presetIndex || '';
        return `${t}${p?'|'+p:''};${name}`;
    }).join(',');
}

function deserializeCityData(str, city) {
    if (!str) return null;
    const stations = {};
    try {
        str.split(',').forEach(item => {
            const [tp, name] = item.split(';');
            if (!name) return;
            let type = 'normal', presetIndex = null;
            if (tp.startsWith('f')) type = 'fav';
            else if (tp.startsWith('c')) type = 'cand';
            else if (tp.startsWith('t')) type = 'trash';
            if (tp.includes('|')) presetIndex = parseInt(tp.split('|')[1]);
            stations[name] = { type, presetIndex };
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
    state.city = params.get("city") || state.city;
    state.min = parseFloat(params.get("min")) || state.min;
    state.max = parseFloat(params.get("max")) || state.max;
    state.shift = parseInt(params.get("shift")) || 0;
    state.settingsMode = params.get("mode") === "1";
    state.bands = parseInt(params.get("bands")) || 1;
    state.presets = parseInt(params.get("presets")) || 6;
    state.lastModified = parseInt(params.get("ts")) || Date.now();
    
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
    return true;
}

function loadFromLS() {
    const ls = localStorage.getItem(LS_KEY);
    if (!ls) return false;
    try { state = { ...state, ...JSON.parse(ls) }; return true; } catch { return false; }
}

function resetAll() {
    localStorage.removeItem(LS_KEY); localStorage.removeItem("geo_checked");
    history.replaceState(null, "", window.location.pathname);
    state = { ...DEFAULT_STATE, stations: [] };
    document.getElementById('minFreq').value = state.min;
    document.getElementById('maxFreq').value = state.max;
    document.getElementById("citySelect").value = state.city;
    showToast("Состояние сброшено");
    loadCity(state.city).then(() => checkGeo(true));
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
}

// EVENTS
async function init() {
    initTheme();
    loadCyrillicFont(); // Preload font for PDF export
    document.getElementById('appVersion').textContent = 'v' + VERSION;
    const citySelect = document.getElementById("citySelect");
    const templatesMenu = document.getElementById("templatesMenu");
    TEMPLATES.forEach(t => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = t.name; 
        item.onclick = () => {
            state.template = t.name; state.min = t.range[0]; state.max = t.range[1]; state.shift = 0;
            saveState(); render(); templatesMenu.classList.remove("show");
        };
        templatesMenu.appendChild(item);
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
        if (!e.target.closest('.preset-dropdown') && !e.target.closest('.preset-btn')) closePresetMenu();
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
        if (state.lastModified !== lsTs) {
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
    if (!hasUrl && !localStorage.getItem("geo_checked")) checkGeo(false);
}

async function loadCity(city) {
    if (!citiesMap[city]) return;
    state.city = city;
    const ls = localStorage.getItem(LS_KEY);
    if (ls) {
        const parsed = JSON.parse(ls);
        if (parsed.city === city && parsed.stations?.length > 0) { state.stations = parsed.stations; render(); }
    }
    const html = await fetchPage(citiesMap[city]);
    if (html) {
        state.stations = parseStations(html);
        render();
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

document.getElementById("themeBtn").addEventListener("click", toggleTheme);
document.getElementById("citySelect").addEventListener("change", (e) => { saveState(); loadCity(e.target.value); });
document.getElementById("templatesBtn").addEventListener("click", (e) => {
    e.stopPropagation(); document.getElementById("templatesMenu").classList.toggle("show"); document.getElementById("downloadMenu").classList.remove("show");
});

document.getElementById('overwriteBtn').addEventListener('click', () => {
    state.isGuestMode = false;
    state.lastModified = Date.now();
    localStorage.setItem(LS_KEY, JSON.stringify(state));
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
});

(function() {
    let clickCount = 0; let clickTimer = null;
    document.getElementById('logoBtn').addEventListener('click', () => {
        clickCount++;
        if (clickCount === 1) clickTimer = setTimeout(() => clickCount = 0, 600);
        else if (clickCount === 3) { clearTimeout(clickTimer); clickCount = 0; resetAll(); }
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
        } else {
             state[stateProp] = Math.round(val);
        }
        return true;
    };

    el.addEventListener("input", (e) => {
        let val = parseFloat(e.target.value);
        if (applyChange(val)) {
            saveState(); render();
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
            render(); 
        }
    }, { passive: false });

    el.addEventListener('touchend', () => {
        if (touchStartY !== null) {
            saveState();
        }
        touchStartY = null;
    });
}

setupWheelInput("minFreq", 64, 110, 0.1, "min");
setupWheelInput("maxFreq", 64, 110, 0.1, "max");
setupWheelInput("bands", 1, 5, 1, "bands");
setupWheelInput("presets", 1, 18, 1, "presets");

document.getElementById("shareBtn").addEventListener("click", () => {
    if (!state.lastModified) {
        state.lastModified = Date.now();
        updateUrl();
    }
    navigator.clipboard.writeText(window.location.href).then(() => showToast("Ссылка скопирована в буфер обмена")).catch(() => showToast("Ошибка копирования ссылки"));
});
document.getElementById("geoBtn").addEventListener("click", () => checkGeo(true));
document.getElementById("helpBtn").addEventListener("click", () => document.getElementById("helpModal").classList.add("show"));
document.getElementById("closeHelpBtn").addEventListener("click", () => document.getElementById("helpModal").classList.remove("show"));
document.getElementById("helpModal").addEventListener("click", (e) => { if (e.target.id === 'helpModal') e.target.classList.remove("show"); });

init();