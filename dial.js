// dial.js
let dialCanvas, dialCtx;
let dialAnim = { x: 0, target: 0 };
let dialTouchStartX = 0;
let dialAnimId = null;
let hoveredStation = null;
let tooltip = null;

function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getRGBA(color, alpha = 1) {
    if (!color) return `rgba(0,0,0,${alpha})`;
    color = color.trim();
    if (color.startsWith('#')) {
        let hex = color.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } else if (color.startsWith('rgb')) {
        const match = color.match(/\d+/g);
        if (match && match.length >= 3) return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`;
    }
    return color;
}

function getDialRange() {
    const FM_MIN = 76.0;
    const FM_MAX = 108.0;
    if (typeof state === 'undefined' || !state) return { min: FM_MIN, max: FM_MAX };
    
    const isShifted = state.dialFreqView === 'shifted';
    let minF = isShifted ? state.min : FM_MIN;
    let maxF = isShifted ? state.max : FM_MAX;

    if (state.dialView === 'narrow') {
        if (!state.stations || state.stations.length === 0) return { min: minF, max: maxF };
        const freqs = state.stations.map(s => isShifted ? calcShiftedFreq(s.freq) : s.freq).filter(f => f >= minF && f <= maxF);
        if (freqs.length > 0) {
            minF = Math.max(minF, Math.min(...freqs) - 1);
            maxF = Math.min(maxF, Math.max(...freqs) + 1);
        }
    }
    return { min: minF, max: maxF };
}

function getStationAtX(x) {
    const { min: minFreq, max: maxFreq } = getDialRange();
    const range = maxFreq - minFreq;
    const padX = 25;
    const rect = dialCanvas.getBoundingClientRect();
    const trackW = rect.width - padX * 2;
    const targetFreq = minFreq + ((x - padX) / trackW) * range;
    
    const isShifted = state.dialFreqView === 'shifted';
    
    let closest = null;
    let minDiff = Infinity;
    state.stations.forEach(st => {
        const freq = isShifted ? calcShiftedFreq(st.freq) : st.freq;
        if (freq < minFreq || freq > maxFreq) return;
        const diff = Math.abs(freq - targetFreq);
        if (diff < minDiff) { minDiff = diff; closest = st; }
    });
    const pixelDiff = (minDiff / range) * trackW;
    return pixelDiff < 15 ? closest : null;
}

function handleHover(clientX) {
    const rect = dialCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const hovered = getStationAtX(x);
    const isShifted = state.dialFreqView === 'shifted';
    
    if (hovered !== hoveredStation) {
        hoveredStation = hovered;
        if (hovered) {
            const streamData = stationStreamMap[FMUse.generateCodeName(hovered.name)];
            const displayFreq = isShifted ? calcShiftedFreq(hovered.freq) : hovered.freq;
            let logoHtml = streamData && streamData.favicon ? `<img src="${streamData.favicon}" onerror="this.style.display='none'">` : '';
            let tagsHtml = streamData && streamData.tags ? `<div class="dial-tags">${streamData.tags}</div>` : '';
            let freqHtml = `<div class="dial-freq">${formatFreq(displayFreq)}</div>`;
            let nameHtml = `<div class="dial-name">${hovered.name}</div>`;
            
            let html = `${logoHtml}<div>${freqHtml}${nameHtml}${tagsHtml}</div>`;
            if (tooltip) {
                tooltip.innerHTML = html;
                tooltip.style.opacity = '1';
                tooltip.style.pointerEvents = 'auto';
            }
        } else {
            if (tooltip) {
                tooltip.style.opacity = '0';
                tooltip.style.pointerEvents = 'none';
            }
        }
    }
    
    if (hovered && tooltip) {
        const { min: minFreq, max: maxFreq } = getDialRange();
        const range = maxFreq - minFreq;
        const padX = 25;
        const trackW = rect.width - padX * 2;
        const freq = isShifted ? calcShiftedFreq(hovered.freq) : hovered.freq;
        const tickX = padX + ((freq - minFreq) / range) * trackW;
        
        let leftPos = rect.left + tickX;
        const tooltipHalfWidth = 110; 
        
        if (leftPos < tooltipHalfWidth) leftPos = tooltipHalfWidth;
        if (leftPos > window.innerWidth - tooltipHalfWidth) leftPos = window.innerWidth - tooltipHalfWidth;
        
        tooltip.style.left = `${leftPos}px`;
        tooltip.style.top = `${rect.top - 5}px`; 
    }
}

function initDial() {
    dialCanvas = document.getElementById('fmDialCanvas');
    if (!dialCanvas) return;
    dialCtx = dialCanvas.getContext('2d');
    tooltip = document.getElementById('dialTooltip');
    
    if (tooltip && tooltip.parentElement !== document.body) {
        document.body.appendChild(tooltip);
    }
    
    dialCanvas.addEventListener('click', (e) => {
        const rect = dialCanvas.getBoundingClientRect();
        const st = getStationAtX(e.clientX - rect.left);
        if (st && typeof togglePlay !== 'undefined') togglePlay(st.name);
    });
    
    dialCanvas.addEventListener('mousemove', (e) => {
        handleHover(e.clientX);
    });
    
    dialCanvas.addEventListener('mouseleave', () => {
        hoveredStation = null;
        if (tooltip) {
            tooltip.style.opacity = '0';
            tooltip.style.pointerEvents = 'none';
        }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    let isTouchMoved = false;

    dialCanvas.addEventListener('touchstart', (e) => {
        if (!e.touches[0]) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isTouchMoved = false;
        handleHover(touchStartX);
    }, { passive: true });

    dialCanvas.addEventListener('touchmove', (e) => {
        if (!e.touches[0]) return;
        e.preventDefault();
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        
        if (Math.abs(touchX - touchStartX) > 5 || Math.abs(touchY - touchStartY) > 5) {
            isTouchMoved = true;
        }
        handleHover(touchX);
    }, { passive: false });

    dialCanvas.addEventListener('touchend', (e) => {
        if (!isTouchMoved) {
            const rect = dialCanvas.getBoundingClientRect();
            const st = getStationAtX(touchStartX - rect.left);
            if (st && typeof togglePlay !== 'undefined') togglePlay(st.name);
        }
    });

    if (tooltip) {
        tooltip.addEventListener('click', (e) => {
            e.stopPropagation();
            if (hoveredStation && typeof togglePlay !== 'undefined') {
                togglePlay(hoveredStation.name);
            }
            tooltip.style.opacity = '0';
            tooltip.style.pointerEvents = 'none';
            hoveredStation = null;
        });
    }

    const closeTooltip = (e) => {
        if (tooltip && tooltip.style.opacity === '1') {
            if (!e.target.closest('.dial-tooltip') && !e.target.closest('#fmDialCanvas')) {
                tooltip.style.opacity = '0';
                tooltip.style.pointerEvents = 'none';
                hoveredStation = null;
            }
        }
    };
    document.addEventListener('click', closeTooltip);
    document.addEventListener('touchstart', closeTooltip, { passive: true });

    window.addEventListener('resize', () => { renderDialCanvas(); });
}

function dialLoop() {
    renderDialCanvas();
    dialAnimId = requestAnimationFrame(dialLoop);
}

function renderDialCanvas() {
    if (!dialCanvas || typeof state === 'undefined') return;
    const ctx = dialCtx;
    const dpr = window.devicePixelRatio || 1;
    const rect = dialCanvas.getBoundingClientRect();
    
    if (dialCanvas.width !== rect.width * dpr || dialCanvas.height !== rect.height * dpr) {
        dialCanvas.width = rect.width * dpr;
        dialCanvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    }
    
    const W = rect.width;
    const H = rect.height;
    const trackY = H - 35; // Сдвинули линию шкалы вверх, чтобы текст внизу не обрезался
    const padX = 25;
    const trackW = W - padX * 2;

    const { min: minFreq, max: maxFreq } = getDialRange();
    const range = maxFreq - minFreq;
    if (range <= 0) return;

    const isShifted = state.dialFreqView === 'shifted';

    ctx.clearRect(0, 0, W, H);

    const accent = getCSSVar('--accent');
    const pink = getCSSVar('--pink');
    const yellow = getCSSVar('--yellow');
    const textDim = getCSSVar('--text-dim');
    const trashColor = getCSSVar('--trash');
    const textCol = getCSSVar('--text');
    const greenCol = '#2ecc71';
    const redCol = '#ff4757';

    // 1. Draw Available/Unavailable Segments with Neon Glow
    let availMin, availMax;
    if (isShifted) {
        availMin = state.min;
        availMax = state.max;
    } else {
        availMin = state.min + state.shift;
        availMax = state.max + state.shift;
    }
    
    const drawSegment = (fStart, fEnd, color, glowColor) => {
        const startRatio = Math.max(0, (fStart - minFreq) / range);
        const endRatio = Math.min(1, (fEnd - minFreq) / range);
        if (endRatio <= startRatio) return;
        
        const x1 = padX + startRatio * trackW;
        const x2 = padX + endRatio * trackW;
        
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(x1, trackY);
        ctx.lineTo(x2, trackY);
        ctx.stroke();
        ctx.shadowBlur = 0;
    };
    
    drawSegment(minFreq, Math.min(availMin, maxFreq), getRGBA(redCol, 0.6), redCol);
    drawSegment(Math.max(availMin, minFreq), Math.min(availMax, maxFreq), getRGBA(greenCol, 0.8), greenCol);
    drawSegment(Math.max(availMax, minFreq), maxFreq, getRGBA(redCol, 0.6), redCol);

    // Draw Spectrum on Scale Line
    if (typeof analyser !== 'undefined' && analyser && currentPlayingStation && !audioPlayer.paused) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        const barWidth = trackW / bufferLength;
        let x = padX;
        
        ctx.shadowColor = accent;
        ctx.shadowBlur = 4;
        
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * 24; 
            const bw = Math.max(1, barWidth - 1);
            
            const grad = ctx.createLinearGradient(0, trackY, 0, trackY - barHeight);
            grad.addColorStop(0, getRGBA(accent, 0.8));
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            
            ctx.fillRect(x, trackY - 2 - barHeight, bw, barHeight);
            x += barWidth;
        }
        ctx.shadowBlur = 0;
    }

    // 2. Draw Indicator Line (Neon Tube)
    let playingX = -1;
    if (typeof currentPlayingStation !== 'undefined' && currentPlayingStation) {
        const st = state.stations.find(s => s.name === currentPlayingStation);
        if (st) {
            const playingFreq = isShifted ? calcShiftedFreq(st.freq) : st.freq;
            if (playingFreq >= minFreq && playingFreq <= maxFreq) {
                playingX = padX + ((playingFreq - minFreq) / range) * trackW;
                dialAnim.target = playingX;
                if (dialAnim.x === 0 || Math.abs(dialAnim.x - dialAnim.target) > 50) dialAnim.x = dialAnim.target;
                if (Math.abs(dialAnim.target - dialAnim.x) > 0.5) {
                    dialAnim.x += (dialAnim.target - dialAnim.x) * 0.15;
                } else {
                    dialAnim.x = dialAnim.target;
                }
                
                const flicker = 0.9 + Math.random() * 0.1;
                
                ctx.shadowColor = accent;
                ctx.shadowBlur = 20 * flicker;
                ctx.strokeStyle = getRGBA(accent, 0.8 * flicker);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(dialAnim.x, trackY - 5);
                ctx.lineTo(dialAnim.x, 25);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }
    }

    // 3. Draw Station Ticks & Labels
    const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
    const lanes = [-1, -1, -1, -1];
    const minDist = 35;

    sorted.forEach(st => {
        const freq = isShifted ? calcShiftedFreq(st.freq) : st.freq;
        if (freq < minFreq || freq > maxFreq) return;
        
        const x = padX + ((freq - minFreq) / range) * trackW;
        const data = getStationData(st.name);
        const streamData = stationStreamMap[FMUse.generateCodeName(st.name)];
        const hasStream = streamData && streamData.streams && streamData.streams.length > 0;
        
        let tickH = 10, color = textCol, w = 2, glow = 0;
        if (data.type === 'fav') { tickH = 16; color = pink; w = 2; glow = 8; }
        else if (data.type === 'cand') { tickH = 14; color = yellow; w = 2; glow = 6; }
        else if (data.type === 'trash') { tickH = 4; color = getRGBA(trashColor, 0.6); w = 1; }
        
        if (!hasStream && data.type !== 'trash') {
            color = getRGBA(color, 0.4);
            glow = 0;
        }
        
        ctx.shadowColor = color;
        ctx.shadowBlur = glow;
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x, trackY - 5);
        ctx.lineTo(x, trackY - 5 - tickH);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (data.type === 'fav' || data.type === 'cand') {
            let lane = 0;
            for (let i = 0; i < 3; i++) {
                if (lanes[i] === -1 || Math.abs(x - lanes[i]) >= minDist) {
                    lane = i; lanes[i] = x; break;
                }
            }
            ctx.fillStyle = color;
            ctx.font = 'bold 10px Orbitron, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(formatFreq(freq), x, trackY - 22 - lane * 13);
        }
    });

    // 4. Draw Scale Marks & Labels (Below Track)
    const drawScaleLabel = (f, isEdge) => {
        const x = padX + ((f - minFreq) / range) * trackW;
        ctx.strokeStyle = textDim;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, trackY + 3);
        ctx.lineTo(x, trackY + 3 + (isEdge ? 8 : 12));
        ctx.stroke();
        
        ctx.fillStyle = getRGBA(accent, 0.9);
        ctx.font = 'bold 10px Orbitron, monospace';
        ctx.shadowColor = accent;
        ctx.shadowBlur = 6;
        ctx.textAlign = isEdge ? (f === minFreq ? 'left' : 'right') : 'center';
        ctx.fillText(f.toFixed(isEdge ? 1 : 0), x, trackY + 22);
        ctx.shadowBlur = 0;
    };
    
    drawScaleLabel(minFreq, true);
    drawScaleLabel(maxFreq, true);
    
    const startFreq = Math.ceil(minFreq / 5) * 5;
    for (let f = startFreq; f <= maxFreq; f += 5) {
        if (f > minFreq && f < maxFreq) {
            const x = padX + ((f - minFreq) / range) * trackW;
            ctx.strokeStyle = textDim;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, trackY + 3);
            ctx.lineTo(x, trackY + 3 + (f % 10 === 0 ? 10 : 5));
            ctx.stroke();
            
            if (f % 10 === 0) {
                ctx.fillStyle = getRGBA(accent, 0.9);
                ctx.font = 'bold 10px Orbitron, monospace';
                ctx.shadowColor = accent;
                ctx.shadowBlur = 6;
                ctx.textAlign = 'center';
                ctx.fillText(f.toFixed(0), x, trackY + 22);
                ctx.shadowBlur = 0;
            }
        }
    }

    // 5. Draw Playing Station Text & Electric Arc
    if (playingX !== -1) {
        const flicker = 0.9 + Math.random() * 0.1;
        const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
        
        ctx.beginPath();
        ctx.moveTo(playingX, trackY - 5);
        const arcSteps = 4;
        for (let i = 1; i <= arcSteps; i++) {
            const t = i / arcSteps;
            const y = (trackY - 5) - t * (trackY - 22 - pulse * 5);
            const x = playingX + (Math.random() - 0.5) * 6 * t;
            ctx.lineTo(x, y);
        }
        ctx.strokeStyle = getRGBA(accent, 0.5 + pulse * 0.3);
        ctx.lineWidth = 1.5;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.shadowColor = accent;
        ctx.shadowBlur = 15 * flicker;
        ctx.fillStyle = getRGBA(accent, flicker);
        ctx.font = 'bold 16px Orbitron, monospace';
        ctx.textAlign = 'center';
        const st = state.stations.find(s => s.name === currentPlayingStation);
        const playingFreq = isShifted ? calcShiftedFreq(st.freq) : st.freq;
        const txt = formatFreq(st ? playingFreq : 0);
        ctx.fillText(txt, playingX, 25);
        
        // Ядро текста (эффект раскаленной нити)
        ctx.shadowBlur = 4;
        const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
        ctx.fillStyle = isLightTheme ? `rgba(0, 0, 0, ${0.8 * flicker})` : `rgba(255, 255, 255, ${0.8 * flicker})`;
        ctx.fillText(txt, playingX, 20);
        
        ctx.shadowBlur = 10 + pulse * 10;
        ctx.fillStyle = getRGBA(accent, 1);
        ctx.beginPath();
        ctx.arc(playingX, trackY, 5 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // 6. Draw Hovered Station Pulse
    if (hoveredStation) {
        const freq = isShifted ? calcShiftedFreq(hoveredStation.freq) : hoveredStation.freq;
        if (freq >= minFreq && freq <= maxFreq) {
            const x = padX + ((freq - minFreq) / range) * trackW;
            const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
            ctx.strokeStyle = getRGBA(textCol, 0.3 + pulse * 0.4);
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(x, trackY - 5);
            ctx.lineTo(x, trackY - 20);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}