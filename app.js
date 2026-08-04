// 0.1.38 | Rule: minor.major.build. build++ on full regen
const VERSION = "0.1.38";
const API_URL = "https://radiopedia.fandom.com/ru/api.php";
const MAIN_PAGE = "Частотные планы радиостанций в городах России";
const LS_KEY = "fm_adapter_calc_v6";
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
    stations: []
};

let state = { ...DEFAULT_STATE };
let citiesMap = {};

// THEME
function initTheme() {
    const savedTheme = localStorage.getItem(LS_THEME_KEY);
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    updateThemeIcon();
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDarkDefault = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let newTheme;
    if (currentTheme) {
        newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    } else {
        newTheme = isDarkDefault ? 'light' : 'dark';
    }
    
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
    } catch { 
        return null; 
    }
}

function parseCities(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cities = {};
    doc.querySelectorAll("a[title]").forEach(a => {
        const title = a.getAttribute("title");
        if (title.startsWith(MAIN_PAGE + "/")) {
            const city = title.split("/").pop().replace(/_/g, " ").trim();
            if (city && !["Сводная таблица", "Россия"].includes(city)) {
                cities[city] = title;
            }
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
                if (a && a.getAttribute('title') && !name) {
                    name = a.getAttribute('title').replace(/_/g, " ").trim();
                }
                
                const text = col.textContent.trim();
                if (!text) return;
                
                const match = text.match(/(\d{2,3}[.,]\d{1,3})/);
                if (match && !freq) {
                    const f = parseFloat(match[1].replace(",", "."));
                    if (f >= 76.0 && f <= 108.0) freq = f;
                } else if (!name && text.length > 2) {
                    const lower = text.toLowerCase();
                    if (!["частота", "радиостанция", "мгц", "квт", "мощность", "передатчик", "вт"].some(x => lower.includes(x))) {
                        name = text.replace(/\[\d+\]/g, "").trim();
                    }
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
        
        if (validCount === state.stations.length) {
            statuses[s] = { type: 'full' };
            fullShifts.push(s);
        } else if (validCount > 0) {
            statuses[s] = { type: 'partial', ratio: validCount / state.stations.length };
        } else {
            statuses[s] = { type: 'none' };
        }
    });
    
    let best = -1;
    if (fullShifts.includes(0)) {
        best = 0;
    } else if (fullShifts.length > 0) {
        best = EASY_SHIFTS.find(s => s > 0 && fullShifts.includes(s)) || Math.min(...fullShifts);
    }
    
    return { statuses, best: best === -1 ? 0 : best };
}

function calcShiftedFreq(freq) {
    if (state.shift === 0 || (state.min === 87.5 && state.max === 108.0)) return freq;
    return parseFloat((freq - state.shift).toFixed(2));
}

function formatFreq(f) {
    if (typeof f !== 'number' || isNaN(f)) return '—';
    // Always show 1 decimal place
    return f.toFixed(1).replace('.', ',');
}

function isAvailable(freq) {
    const shifted = calcShiftedFreq(freq);
    return shifted >= state.min && shifted <= state.max;
}

// EXPORT LOGIC
function generateCanvas() {
    const isMobile = window.innerWidth < 600;
    const cols = isMobile ? 1 : 2;
    const padding = 20;
    const rowHeight = 28;
    const headerHeight = 35;
    const titleHeight = 60;
    
    const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
    const half = Math.ceil(sorted.length / 2);
    const parts = [sorted.slice(0, half), sorted.slice(half)];
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.font = 'bold 12px Arial';
    const nameHeaderW = tempCtx.measureText('Станция').width;
    const freqHeaderW = tempCtx.measureText('Частота').width;
    const shiftHeaderW = tempCtx.measureText('На ГУ').width;
    
    tempCtx.font = '12px Arial';
    
    let maxNameWidth = nameHeaderW;
    let maxFreqWidth = freqHeaderW;
    let maxShiftedWidth = shiftHeaderW;
    
    state.stations.forEach(st => {
        maxNameWidth = Math.max(maxNameWidth, tempCtx.measureText(st.name).width);
        maxFreqWidth = Math.max(maxFreqWidth, tempCtx.measureText(formatFreq(st.freq)).width);
        const shifted = calcShiftedFreq(st.freq);
        maxShiftedWidth = Math.max(maxShiftedWidth, tempCtx.measureText(shifted >= 76 ? formatFreq(shifted) : '—').width);
    });
    
    const isStandard = state.min === 87.5 && state.max === 108.0;
    const padX = 10;
    const colWidth = Math.ceil(maxNameWidth + maxFreqWidth + (isStandard ? 0 : maxShiftedWidth) + padX * 4); 
    
    const canvasWidth = cols * colWidth + (cols - 1) * padding + padding * 2;
    const maxRows = half;
    const canvasHeight = titleHeight + headerHeight + maxRows * rowHeight + padding;
    
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
    const shiftText = isStandard ? "Стандарт" : `${state.shift} МГц`;
    const titleText = `Город: ${state.city} | Диапазон: ${state.min} - ${state.max} МГц | Сдвиг: ${shiftText}`;
    ctx.fillText(titleText, padding, titleHeight / 2);
    
    for (let c = 0; c < cols; c++) {
        const part = parts[c];
        if (!part || part.length === 0) continue;
        const xOffset = padding + c * (colWidth + padding);
        let y = titleHeight;
        
        ctx.fillStyle = '#f1f3f5';
        ctx.fillRect(xOffset, y, colWidth, headerHeight);
        ctx.strokeStyle = '#dee2e6';
        ctx.strokeRect(xOffset, y, colWidth, headerHeight);
        
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        
        let currentX = xOffset + padX;
        ctx.fillText('Станция', currentX, y + headerHeight / 2);
        currentX += maxNameWidth + padX;
        
        ctx.fillText('Частота', currentX, y + headerHeight / 2);
        currentX += maxFreqWidth + padX;
        
        if (!isStandard) {
            ctx.fillText('На ГУ', currentX, y + headerHeight / 2);
        }
        
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
            
            let name = st.name;
            while (ctx.measureText(name).width > maxNameWidth && name.length > 0) {
                name = name.slice(0, -1);
            }
            if (name !== st.name) name += '...';
            ctx.fillText(name, xOffset + padX, y + rowHeight / 2);
            
            ctx.fillText(formatFreq(st.freq), xOffset + padX + maxNameWidth + padX, y + rowHeight / 2);
            
            if (!isStandard) {
                ctx.fillStyle = isAvail ? '#27ae60' : '#e74c3c';
                ctx.fillText(shifted >= 76 ? formatFreq(shifted) : '—', xOffset + padX + maxNameWidth + padX + maxFreqWidth + padX, y + rowHeight / 2);
            }
            
            y += rowHeight;
        });
        
        ctx.strokeRect(xOffset, titleHeight, colWidth, headerHeight + maxRows * rowHeight);
    }
    return canvas;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
  } catch (e) {
    return null;
  }
}

async function exportPDF() {
    if (state.stations.length === 0) return showToast("Нет данных для экспорта");
    showToast("Подготовка PDF...");
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        
        const fontBase64 = await loadCyrillicFont();
        let fontName = 'helvetica';
        
        if (fontBase64) {
            doc.addFileToVFS("DejaVuSans.ttf", fontBase64);
            doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
            doc.setFont("DejaVuSans");
            fontName = 'DejaVuSans';
        } else {
            showToast("Шрифт не загружен, кириллица может не отображаться");
        }
        
        const isStandard = state.min === 87.5 && state.max === 108.0;
        const shiftText = isStandard ? "Стандарт" : `${state.shift} МГц`;
        const title = `Город: ${state.city} | Диапазон: ${state.min} - ${state.max} МГц | Сдвиг: ${shiftText}`;
        
        const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
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
                row.push("");
                row.push(r1.name);
                row.push(formatFreq(r1.freq));
                if (!isStandard) {
                    const s1 = calcShiftedFreq(r1.freq);
                    row.push(s1 >= 76 ? formatFreq(s1) : "—");
                }
            } else {
                row.push(...(isStandard ? ["", "", ""] : ["", "", "", ""]));
            }
            
            row.push("");
            
            if (r2) {
                row.push("");
                row.push(r2.name);
                row.push(formatFreq(r2.freq));
                if (!isStandard) {
                    const s2 = calcShiftedFreq(r2.freq);
                    row.push(s2 >= 76 ? formatFreq(s2) : "—");
                }
            } else {
                row.push(...(isStandard ? ["", "", ""] : ["", "", "", ""]));
            }
            
            multiBody.push(row);
        }
        
        const colStyles = {};
        headerRow.forEach((h, i) => {
            if (h === 'Пометки') colStyles[i] = { cellWidth: 15, halign: 'center' };
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
                    
                    // Determine if it's left or right column block
                    const isLeft = colIndex < (isStandard ? 3 : 4);
                    const currentStation = isLeft ? p1[rowIdx] : p2[rowIdx];
                    
                    const colName = headerRow[colIndex];
                    
                    if (colName === 'Пометки') {
                        data.cell.styles.fillColor = [240, 240, 240]; // Light gray for notes column
                    }
                    
                    if (currentStation && !isAvailable(currentStation.freq)) {
                        data.cell.styles.textColor = [153, 153, 153]; // Gray text for unavailable stations
                    }
                    
                    if (colName === 'На ГУ') {
                        if (data.cell.raw === '—') {
                            data.cell.styles.textColor = [231, 76, 60]; // Red for dash
                        } else if (data.cell.raw !== '') {
                            data.cell.styles.textColor = [39, 174, 96]; // Green for available shifted freq
                        }
                    }
                }
            }
        });
        
        doc.save(`FM_${state.city}.pdf`);
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
    
    const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
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
            row.push("");
            row.push(r1.name);
            row.push(formatFreq(r1.freq));
            if (!isStandard) {
                const s1 = calcShiftedFreq(r1.freq);
                row.push(s1 >= 76 ? formatFreq(s1) : "—");
            }
        } else {
            row.push(...(isStandard ? ["", "", ""] : ["", "", "", ""]));
        }
        
        row.push("");
        
        if (r2) {
            row.push("");
            row.push(r2.name);
            row.push(formatFreq(r2.freq));
            if (!isStandard) {
                const s2 = calcShiftedFreq(r2.freq);
                row.push(s2 >= 76 ? formatFreq(s2) : "—");
            }
        } else {
            row.push(...(isStandard ? ["", "", ""] : ["", "", "", ""]));
        }
        
        aoa.push(row);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    const totalCols = headerRow.length;
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];
    
    if (isStandard) {
        ws['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 15 }, { wch: 3 }, { wch: 10 }, { wch: 35 }, { wch: 15 }];
    } else {
        ws['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 3 }, { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
    }
    
    ws['!pageSetup'] = { 
        orientation: 'landscape', 
        fitToWidth: 1, 
        fitToHeight: 0,
        paperSize: 9 
    };
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
                if (colName === 'Пометки') {
                    cell.s.fill = { patternType: "solid", fgColor: { rgb: "EEEEEE" } };
                }
                
                if (!isStandard && colName === 'На ГУ') {
                    if (cell.v === '—') {
                        cell.s.font = { strike: true, color: { rgb: "999999" }, sz: 14 };
                    } else if (cell.v !== '') {
                        cell.s.font = { bold: true, sz: 14 };
                    }
                }
                
                const rowIdx = R - 3;
                const isLeftCol = C < (isStandard ? 3 : 4);
                const currentStation = isLeftCol ? p1[rowIdx] : p2[rowIdx];
                
                if (currentStation && !isAvailable(currentStation.freq)) {
                    cell.s.font = { ...cell.s.font, color: { rgb: "999999" } };
                }
                
                if (colName === 'Станция') {
                    cell.s.alignment = { horizontal: 'left', vertical: 'center' };
                } else {
                    cell.s.alignment = { horizontal: 'center', vertical: 'center' };
                }
            }
        }
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stations");
    XLSX.writeFile(wb, `FM_${state.city}.xlsx`);
}

// UI RENDER
function renderAdapters() {
    const panel = document.getElementById("adapterPanel");
    const chips = document.getElementById("adapterChips");
    chips.innerHTML = "";
    
    const isStandard = state.min === 87.5 && state.max === 108.0;
    if (isStandard) {
        panel.style.display = "none";
        return;
    }
    
    panel.style.display = "block";
    const { statuses, best } = evaluateShifts();
    
    const addChip = (shift, statusData) => {
        const chip = document.createElement("button");
        const statusType = statusData.type;
        const ratio = statusData.ratio || 0;
        
        chip.className = `chip ${statusType || ''}`;
        if (shift === best && statusType === 'full') chip.classList.add('best');
        if (shift === state.shift) chip.classList.add("active");
        
        if (shift === 0) {
            chip.textContent = "0";
            chip.setAttribute('data-tip', 'Без адаптера');
        } else {
            chip.textContent = shift;
        }

        if (statusType === 'partial') {
            const r = Math.round(255 - 14 * ratio);
            const g = Math.round(71 + 125 * ratio);
            const b = Math.round(87 - 72 * ratio);
            const color = `rgb(${r}, ${g}, ${b})`;
            chip.style.color = color;
            chip.style.borderColor = color;
            if (shift === state.shift) {
                chip.style.backgroundColor = color;
                chip.style.color = 'var(--bg)';
            }
        }
        
        chip.onclick = (e) => {
            state.shift = shift;
            saveState();
            render();
        };
        chips.appendChild(chip);
    };

    SHIFTS.forEach(s => addChip(s, statuses[s] || { type: 'none' }));
}

function renderStations() {
    const list = document.getElementById("stationsList");
    list.innerHTML = "";
    
    if (state.stations.length === 0) {
        list.innerHTML = `<div style="text-align:center;color:var(--text-dim);padding:20px;">Нет данных</div>`;
        return;
    }

    const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
    const isStandard = state.min === 87.5 && state.max === 108.0;

    sorted.forEach(st => {
        const item = document.createElement("div");
        item.className = "station-item";
        const shiftedNum = calcShiftedFreq(st.freq);
        const isAvail = isAvailable(st.freq);
        const freqClass = isAvail ? 'ok' : 'err';
        
        if (!isAvail) item.classList.add("unavailable");
        
        if (isStandard) {
            item.innerHTML = `
                <div class="freq">${formatFreq(st.freq)}</div>
                <div class="name">${st.name}</div>
            `;
        } else {
            item.innerHTML = `
                <div class="freq">${formatFreq(st.freq)}</div>
                <div class="name">${st.name}</div>
                <div class="shifted-freq ${freqClass}">${shiftedNum >= 76 ? formatFreq(shiftedNum) : "—"}</div>
            `;
        }
        list.appendChild(item);
    });
}

function render() {
    const minInput = document.getElementById("minFreq");
    const maxInput = document.getElementById("maxFreq");
    const citySelect = document.getElementById("citySelect");
    
    if (document.activeElement !== minInput) minInput.value = state.min;
    if (document.activeElement !== maxInput) maxInput.value = state.max;
    if (citySelect.value !== state.city) citySelect.value = state.city;
    
    const tmpl = TEMPLATES.find(t => t.name === state.template) || TEMPLATES.find(t => t.name === "Свой вариант");
    document.getElementById("templatesBtn").textContent = tmpl ? tmpl.short : "свой";
    
    renderAdapters();
    renderStations();
    updateUrl();
}

// STATE & PERSISTENCE
function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function updateUrl() {
    const params = new URLSearchParams({
        city: state.city,
        min: state.min,
        max: state.max,
        shift: state.shift
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
    
    const matched = TEMPLATES.find(t => t.range[0] === state.min && t.range[1] === state.max);
    state.template = matched ? matched.name : "Свой вариант";
    
    return true;
}

function loadFromLS() {
    const ls = localStorage.getItem(LS_KEY);
    if (!ls) return false;
    try {
        const parsed = JSON.parse(ls);
        state = { ...state, ...parsed };
        return true;
    } catch {
        return false;
    }
}

function resetAll() {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem("geo_checked");
    history.replaceState(null, "", window.location.pathname);
    state = { ...DEFAULT_STATE, stations: [] };
    document.getElementById('minFreq').value = state.min;
    document.getElementById('maxFreq').value = state.max;
    document.getElementById("citySelect").value = state.city;
    showToast("Состояние сброшено");
    loadCity(state.city).then(() => checkGeo(true));
}

// Haversine formula to calculate distance between two coordinates
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// EVENTS
async function init() {
    initTheme();
    document.getElementById('appVersion').textContent = 'v' + VERSION;
    const citySelect = document.getElementById("citySelect");
    const templatesMenu = document.getElementById("templatesMenu");
    
    TEMPLATES.forEach(t => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = t.name; 
        item.onclick = () => {
            state.template = t.name;
            state.min = t.range[0]; 
            state.max = t.range[1]; 
            state.shift = 0;
            saveState(); render();
            templatesMenu.classList.remove("show");
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
        e.stopPropagation();
        document.getElementById("downloadMenu").classList.toggle("show");
        document.getElementById("templatesMenu").classList.remove("show");
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

    loadFromLS();
    const hasUrl = loadFromUrl();

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

    if (!citiesMap[state.city]) {
        state.city = DEFAULT_STATE.city;
    }

    await loadCity(state.city);
    render();

    if (!hasUrl && !localStorage.getItem("geo_checked")) {
        checkGeo(false);
    }
}

async function loadCity(city) {
    if (!citiesMap[city]) return;
    state.city = city;
    
    const ls = localStorage.getItem(LS_KEY);
    if (ls) {
        const parsed = JSON.parse(ls);
        if (parsed.city === city && parsed.stations?.length > 0) {
            state.stations = parsed.stations;
            render();
        }
    }

    const html = await fetchPage(citiesMap[city]);
    if (html) {
        state.stations = parseStations(html);
        saveState();
        render();
    }
}

async function checkGeo(isManual = false) {
    const hasUrlCity = location.hash.includes("city=");
    
    try {
        const res = await fetch("https://get.geojs.io/v1/ip/geo.json");
        if (!res.ok) throw new Error("Network response was not ok");
        
        const data = await res.json();
        const lat = parseFloat(data.latitude);
        const lon = parseFloat(data.longitude);
        
        if (!isNaN(lat) && !isNaN(lon) && typeof CITY_CENTERS !== 'undefined') {
            let closestCity = null;
            let minDist = Infinity;
            
            CITY_CENTERS.forEach(c => {
                const dist = getDistance(lat, lon, c.lat, c.lon);
                if (dist < minDist) {
                    minDist = dist;
                    closestCity = c;
                }
            });
            
            if (closestCity) {
                if (minDist <= 50) {
                    if (citiesMap[closestCity.name]) {
                        if (isManual || !hasUrlCity) {
                            state.city = closestCity.name;
                            await loadCity(state.city);
                            showToast(`Автоопределение: ${closestCity.name} (${Math.round(minDist)} км)`);
                        }
                    } else {
                        showToast(`Автоопределение: ${closestCity.name} нет в базе`);
                    }
                } else {
                    showToast("Автоопределение: ближайший город слишком далеко");
                }
            }
        } else {
            showToast("Автоопределение: координаты не получены");
        }
    } catch (e) {
        showToast("Автоопределение: ошибка сети");
    }
    localStorage.setItem("geo_checked", "1");
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
}

document.getElementById("themeBtn").addEventListener("click", toggleTheme);

document.getElementById("citySelect").addEventListener("change", (e) => loadCity(e.target.value));

document.getElementById("templatesBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("templatesMenu").classList.toggle("show");
    document.getElementById("downloadMenu").classList.remove("show");
});

document.addEventListener("click", () => {
    document.getElementById("templatesMenu").classList.remove("show");
    document.getElementById("downloadMenu").classList.remove("show");
});

(function() {
    let clickCount = 0;
    let clickTimer = null;
    document.getElementById('logoBtn').addEventListener('click', () => {
        clickCount++;
        if (clickCount === 1) {
            clickTimer = setTimeout(() => clickCount = 0, 600);
        } else if (clickCount === 3) {
            clearTimeout(clickTimer);
            clickCount = 0;
            resetAll();
        }
    });
})();

function setupFreqInput(id, isMin) {
    const el = document.getElementById(id);
    
    el.addEventListener("input", (e) => {
        if (isMin) state.min = parseFloat(e.target.value) || 87.5; 
        else state.max = parseFloat(e.target.value) || 108.0;
        
        const matched = TEMPLATES.find(t => t.range[0] === state.min && t.range[1] === state.max);
        state.template = matched ? matched.name : "Свой вариант";
        
        saveState(); render();
    });

    el.addEventListener("wheel", (e) => {
        e.preventDefault(); 
        let val = parseFloat(el.value) || 0;
        if (e.deltaY < 0) val += 0.1;
        else val -= 0.1;
        val = Math.round(val * 10) / 10;
        
        if (val < 64) val = 64;
        if (val > 110) val = 110;
        
        el.value = val;
        
        if (isMin) state.min = val;
        else state.max = val;
        
        const matched = TEMPLATES.find(t => t.range[0] === state.min && t.range[1] === state.max);
        state.template = matched ? matched.name : "Свой вариант";
        
        saveState(); render();
    }, { passive: false });
}

setupFreqInput("minFreq", true);
setupFreqInput("maxFreq", false);

document.getElementById("shareBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        showToast("Ссылка скопирована в буфер обмена");
    }).catch(() => {
        showToast("Ошибка копирования ссылки");
    });
});

document.getElementById("geoBtn").addEventListener("click", () => {
    checkGeo(true);
});

document.getElementById("helpBtn").addEventListener("click", () => {
    document.getElementById("helpModal").classList.add("show");
});

document.getElementById("closeHelpBtn").addEventListener("click", () => {
    document.getElementById("helpModal").classList.remove("show");
});

document.getElementById("helpModal").addEventListener("click", (e) => {
    if (e.target.id === 'helpModal') {
        e.target.classList.remove("show");
    }
});

init();