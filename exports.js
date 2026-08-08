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