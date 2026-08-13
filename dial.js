// dial.js
let dialCanvas, dialCtx, tooltip = null;
let dialAnim = { x: 0, target: 0 };
let dialAnimId = null;
let hoveredStation = null;

function getCSSVar(n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
}

function getRGBA(c, a = 1) {
  if (!c) return `rgba(0,0,0,${a})`;
  c = c.trim();
  if (c.startsWith('#')) {
    let h = c.replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } else if (c.startsWith('rgb')) {
    const m = c.match(/\d+/g);
    if (m && m.length >= 3) return `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${a})`;
  }
  return c;
}

function getDialRange() {
  const F_MIN = 76.0;
  const F_MAX = 108.0;
  if (!state) return { min: F_MIN, max: F_MAX };
  const isS = state.dialFreqView === 'shifted';
  let minF = isS ? state.min : F_MIN;
  let maxF = isS ? state.max : F_MAX;
  if (state.dialView === 'narrow') {
    if (!state.stations || state.stations.length === 0) return { min: minF, max: maxF };
    const fr = state.stations.map((s) => isS ? FMUse.calcShiftedFreq(s.freq, state, RU_MIN, RU_MAX) : s.freq).filter((f) => f >= minF && f <= maxF);
    if (fr.length > 0) {
      minF = Math.max(minF, Math.min(...fr) - 1);
      maxF = Math.min(maxF, Math.max(...fr) + 1);
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
  const tF = minFreq + ((x - padX) / trackW) * range;
  const isS = state.dialFreqView === 'shifted';
  let c = null;
  let mD = Infinity;
  state.stations.forEach((st) => {
    const f = isS ? FMUse.calcShiftedFreq(st.freq, state, RU_MIN, RU_MAX) : st.freq;
    if (f < minFreq || f > maxFreq) return;
    const d = Math.abs(f - tF);
    if (d < mD) {
      mD = d;
      c = st;
    }
  });
  const pD = (mD / range) * trackW;
  return pD < 15 ? c : null;
}

function handleHover(clientX) {
  const rect = dialCanvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const h = getStationAtX(x);
  const isS = state.dialFreqView === 'shifted';
  if (h !== hoveredStation) {
    hoveredStation = h;
    if (h) {
      const sd = stationStreamMap[FMUse.generateCodeName(h.name)];
      const df = isS ? FMUse.calcShiftedFreq(h.freq, state, RU_MIN, RU_MAX) : h.freq;
      let lh = sd && sd.favicon ? `<img src="${sd.favicon}" onerror="this.style.display='none'">` : '';
      let th = sd && sd.tags ? `<div class="dial-tags">${sd.tags}</div>` : '';
      let fh = `<div class="dial-freq">${FMUse.formatFreq(df)}</div>`;
      let nh = `<div class="dial-name">${h.name}</div>`;
      let html = `${lh}<div>${fh}${nh}${th}</div>`;
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
  if (h && tooltip) {
    const { min: minFreq, max: maxFreq } = getDialRange();
    const range = maxFreq - minFreq;
    const padX = 25;
    const trackW = rect.width - padX * 2;
    const f = isS ? FMUse.calcShiftedFreq(h.freq, state, RU_MIN, RU_MAX) : h.freq;
    const tickX = padX + ((f - minFreq) / range) * trackW;
    let lP = rect.left + tickX;
    const tHW = 110;
    if (lP < tHW) lP = tHW;
    if (lP > window.innerWidth - tHW) lP = window.innerWidth - tHW;
    tooltip.style.left = `${lP}px`;
    tooltip.style.top = `${rect.top - 5}px`;
  }
}

function initDial() {
  dialCanvas = document.getElementById('fmDialCanvas');
  if (!dialCanvas) return;
  dialCtx = dialCanvas.getContext('2d');
  tooltip = document.getElementById('dialTooltip');
  if (tooltip && tooltip.parentElement !== document.body) document.body.appendChild(tooltip);
  
  dialCanvas.addEventListener('click', (e) => {
    const r = dialCanvas.getBoundingClientRect();
    const st = getStationAtX(e.clientX - r.left);
    if (st && typeof togglePlay !== 'undefined') togglePlay(st.name);
  });
  
  dialCanvas.addEventListener('mousemove', (e) => handleHover(e.clientX));
  dialCanvas.addEventListener('mouseleave', () => {
    hoveredStation = null;
    if (tooltip) {
      tooltip.style.opacity = '0';
      tooltip.style.pointerEvents = 'none';
    }
  });
  
  let tS = 0, tY = 0, isM = false;
  dialCanvas.addEventListener('touchstart', (e) => {
    if (!e.touches[0]) return;
    tS = e.touches[0].clientX;
    tY = e.touches[0].clientY;
    isM = false;
    handleHover(tS);
  }, { passive: true });
  
  dialCanvas.addEventListener('touchmove', (e) => {
    if (!e.touches[0]) return;
    e.preventDefault();
    const tX = e.touches[0].clientX;
    const tYy = e.touches[0].clientY;
    if (Math.abs(tX - tS) > 5 || Math.abs(tYy - tY) > 5) isM = true;
    handleHover(tX);
  }, { passive: false });
  
  dialCanvas.addEventListener('touchend', (e) => {
    if (!isM) {
      const r = dialCanvas.getBoundingClientRect();
      const st = getStationAtX(tS - r.left);
      if (st && typeof togglePlay !== 'undefined') togglePlay(st.name);
    }
  });
  
  if (tooltip) {
    tooltip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hoveredStation && typeof togglePlay !== 'undefined') togglePlay(hoveredStation.name);
      tooltip.style.opacity = '0';
      tooltip.style.pointerEvents = 'none';
      hoveredStation = null;
    });
  }
  
  const cT = (e) => {
    if (tooltip && tooltip.style.opacity === '1') {
      if (!e.target.closest('.dial-tooltip') && !e.target.closest('#fmDialCanvas')) {
        tooltip.style.opacity = '0';
        tooltip.style.pointerEvents = 'none';
        hoveredStation = null;
      }
    }
  };
  document.addEventListener('click', cT);
  document.addEventListener('touchstart', cT, { passive: true });
  window.addEventListener('resize', () => renderDialCanvas());
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
  const trackY = H - 35;
  const padX = 25;
  const trackW = W - padX * 2;
  const { min: minFreq, max: maxFreq } = getDialRange();
  const range = maxFreq - minFreq;
  if (range <= 0) return;
  const isS = state.dialFreqView === 'shifted';
  
  ctx.clearRect(0, 0, W, H);
  const accent = getCSSVar('--accent');
  const pink = getCSSVar('--pink');
  const yellow = getCSSVar('--yellow');
  const textDim = getCSSVar('--text-dim');
  const trashC = getCSSVar('--trash');
  const textC = getCSSVar('--text');
  
  let aMin, aMax;
  if (isS) {
    aMin = state.min;
    aMax = state.max;
  } else {
    aMin = state.min + state.shift;
    aMax = state.max + state.shift;
  }
  
  const dS = (fS, fE, c, gC) => {
    const sR = Math.max(0, (fS - minFreq) / range);
    const eR = Math.min(1, (fE - minFreq) / range);
    if (eR <= sR) return;
    const x1 = padX + sR * trackW;
    const x2 = padX + eR * trackW;
    ctx.shadowColor = gC;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = c;
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x1, trackY);
    ctx.lineTo(x2, trackY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  
  dS(minFreq, Math.min(aMin, maxFreq), getRGBA('#ff4757', 0.6), '#ff4757');
  dS(Math.max(aMin, minFreq), Math.min(aMax, maxFreq), getRGBA('#2ecc71', 0.8), '#2ecc71');
  dS(Math.max(aMax, minFreq), maxFreq, getRGBA('#ff4757', 0.6), '#ff4757');
  
  if (typeof analyser !== 'undefined' && analyser && currentPlayingStation && !audioPlayer.paused) {
    const bL = analyser.frequencyBinCount;
    const dA = new Uint8Array(bL);
    analyser.getByteFrequencyData(dA);
    const bW = trackW / bL;
    let x = padX;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 4;
    for (let i = 0; i < bL; i++) {
      const bH = (dA[i] / 255) * 12;
      const bw = Math.max(1, bW - 1);
      const g = ctx.createLinearGradient(0, trackY, 0, trackY - bH);
      g.addColorStop(0, getRGBA(accent, 0.8));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, trackY - 2 - bH, bw, bH);
      x += bW;
    }
    ctx.shadowBlur = 0;
  }
  
  let pX = -1;
  if (currentPlayingStation) {
    const st = state.stations.find((s) => s.name === currentPlayingStation);
    if (st) {
      const pF = isS ? FMUse.calcShiftedFreq(st.freq, state, RU_MIN, RU_MAX) : st.freq;
      if (pF >= minFreq && pF <= maxFreq) {
        pX = padX + ((pF - minFreq) / range) * trackW;
        dialAnim.target = pX;
        if (dialAnim.x === 0 || Math.abs(dialAnim.x - dialAnim.target) > 50) dialAnim.x = dialAnim.target;
        if (Math.abs(dialAnim.target - dialAnim.x) > 0.5) dialAnim.x += (dialAnim.target - dialAnim.x) * 0.15;
        else dialAnim.x = dialAnim.target;
        const fl = 0.9 + Math.random() * 0.1;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 20 * fl;
        ctx.strokeStyle = getRGBA(accent, 0.8 * fl);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dialAnim.x, trackY - 5);
        ctx.lineTo(dialAnim.x, 25);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }
  
  const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
  const lanes = [-1, -1, -1, -1];
  const minDist = 35;
  sorted.forEach((st) => {
    const f = isS ? FMUse.calcShiftedFreq(st.freq, state, RU_MIN, RU_MAX) : st.freq;
    if (f < minFreq || f > maxFreq) return;
    const x = padX + ((f - minFreq) / range) * trackW;
    const d = getStationData(st.name);
    const sd = stationStreamMap[FMUse.generateCodeName(st.name)];
    const hs = sd && sd.streams && sd.streams.length > 0;
    let tH = 10, c = textC, w = 2, gl = 0;
    if (d.type === 'fav') {
      tH = 16;
      c = pink;
      gl = 8;
    } else if (d.type === 'cand') {
      tH = 14;
      c = yellow;
      gl = 6;
    } else if (d.type === 'trash') {
      tH = 4;
      c = getRGBA(trashC, 0.6);
      w = 1;
    }
    if (!hs && d.type !== 'trash') {
      c = getRGBA(c, 0.4);
      gl = 0;
    }
    ctx.shadowColor = c;
    ctx.shadowBlur = gl;
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, trackY - 5);
    ctx.lineTo(x, trackY - 5 - tH);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (d.type === 'fav' || d.type === 'cand') {
      let l = 0;
      for (let i = 0; i < 3; i++) {
        if (lanes[i] === -1 || Math.abs(x - lanes[i]) >= minDist) {
          l = i;
          lanes[i] = x;
          break;
        }
      }
      ctx.fillStyle = c;
      ctx.font = 'bold 10px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(FMUse.formatFreq(f), x, trackY - 22 - l * 13);
    }
  });
  
  const dSL = (f, isE) => {
    const x = padX + ((f - minFreq) / range) * trackW;
    ctx.strokeStyle = textDim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, trackY + 3);
    ctx.lineTo(x, trackY + 3 + (isE ? 8 : 12));
    ctx.stroke();
    ctx.fillStyle = getRGBA(accent, 0.9);
    ctx.font = 'bold 10px Orbitron, monospace';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    ctx.textAlign = isE ? (f === minFreq ? 'left' : 'right') : 'center';
    ctx.fillText(f.toFixed(isE ? 1 : 0), x, trackY + 22);
    ctx.shadowBlur = 0;
  };
  dSL(minFreq, true);
  dSL(maxFreq, true);
  const sF = Math.ceil(minFreq / 5) * 5;
  for (let f = sF; f <= maxFreq; f += 5) {
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
  
  if (pX !== -1) {
    const fl = 0.9 + Math.random() * 0.1;
    const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
    ctx.beginPath();
    ctx.moveTo(pX, trackY - 5);
    const aS = 4;
    for (let i = 1; i <= aS; i++) {
      const t = i / aS;
      const y = (trackY - 5) - t * (trackY - 22 - pulse * 5);
      const x = pX + (Math.random() - 0.5) * 6 * t;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = getRGBA(accent, 0.5 + pulse * 0.3);
    ctx.lineWidth = 1.5;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 15 * fl;
    ctx.fillStyle = getRGBA(accent, fl);
    ctx.font = 'bold 16px Orbitron, monospace';
    ctx.textAlign = 'center';
    const st = state.stations.find((s) => s.name === currentPlayingStation);
    const pF = isS ? FMUse.calcShiftedFreq(st.freq, state, RU_MIN, RU_MAX) : st.freq;
    const txt = FMUse.formatFreq(st ? pF : 0);
    ctx.fillText(txt, pX, 25);
    ctx.shadowBlur = 4;
    const isL = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.fillStyle = isL ? `rgba(0,0,0,${0.8 * fl})` : `rgba(255,255,255,${0.8 * fl})`;
    ctx.fillText(txt, pX, 25);
    ctx.shadowBlur = 10 + pulse * 10;
    ctx.fillStyle = getRGBA(accent, 1);
    ctx.beginPath();
    ctx.arc(pX, trackY, 5 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  
  if (hoveredStation) {
    const f = isS ? FMUse.calcShiftedFreq(hoveredStation.freq, state, RU_MIN, RU_MAX) : hoveredStation.freq;
    if (f >= minFreq && f <= maxFreq) {
      const x = padX + ((f - minFreq) / range) * trackW;
      const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
      ctx.strokeStyle = getRGBA(textC, 0.3 + pulse * 0.4);
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

function renderDialControls() {
  const c = document.getElementById('dialPresets');
  if (!c) return;
  c.innerHTML = '';
  const kW = document.createElement('div');
  kW.className = 'dial-knob-wrap';
  const kC = document.createElement('canvas');
  kC.id = 'dialKnob';
  kC.width = 40;
  kC.height = 40;
  kW.appendChild(kC);
  c.appendChild(kW);
  initDialKnob(kC);
  
  const rA = document.createElement('div');
  rA.className = 'dial-right-area';
  const r1 = document.createElement('div');
  r1.className = 'dial-row dial-row-top';
  const ctrls = [
    { svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>', action: () => skipPreset(-1), title: 'Пред.' },
    { svg: audioPlayer.paused ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>', action: () => { if (currentPlayingStation) togglePlay(currentPlayingStation); }, title: 'Play/Pause' },
    { svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>', action: () => stopPlayer(), title: 'Стоп' },
    { svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>', action: () => skipPreset(1), title: 'След.' }
  ];
  ctrls.forEach((ctrl) => {
    const b = document.createElement('div');
    b.className = 'chip-btn control-chip';
    b.innerHTML = ctrl.svg;
    b.title = ctrl.title;
    b.onclick = ctrl.action;
    r1.appendChild(b);
  });
  
  if (currentPlayingStation) {
    const s = document.createElement('div');
    s.style.width = '8px';
    s.style.flexShrink = '0';
    r1.appendChild(s);
    const d = getStationData(currentPlayingStation);
    const sts = [
      { type: 'normal', char: '○', title: 'Без статуса' },
      { type: 'fav', char: '♥', title: 'Любимое' },
      { type: 'cand', char: '★', title: 'Интересное' },
      { type: 'trash', char: '⊘', title: 'Пропущено' }
    ];
    sts.forEach((st) => {
      const b = document.createElement('div');
      b.className = 'chip-btn status-chip' + (d.type === st.type ? ' assigned-active' : '');
      b.textContent = st.char;
      b.title = st.title;
      b.onclick = () => {
        const dd = ensureStationData(currentPlayingStation);
        dd.type = st.type;
        updateCityStats(state.city);
        commitState();
        render();
      };
      r1.appendChild(b);
    });
  }
  const sp = document.createElement('div');
  sp.className = 'dial-spacer';
  r1.appendChild(sp);
  if (state.bands > 1) {
    for (let b = 1; b <= state.bands; b++) {
      const btn = document.createElement('div');
      btn.className = 'chip-btn band-chip' + (state.dialCurrentBand === b ? ' active' : '');
      btn.textContent = `FM${b}`;
      btn.onclick = () => {
        state.dialCurrentBand = b;
        render();
      };
      r1.appendChild(btn);
    }
  }
  rA.appendChild(r1);
  
  const r2 = document.createElement('div');
  r2.className = 'dial-row dial-row-presets';
  const cs = state.cityData[state.city]?.stations || {};
  for (let i = 1; i <= state.presets; i++) {
    const aI = (state.dialCurrentBand - 1) * state.presets + i;
    const btn = document.createElement('div');
    btn.className = 'chip-btn';
    btn.textContent = i;
    let aS = null;
    let hs = false;
    for (const n in cs) {
      if (cs[n].presetIndex === aI) {
        aS = n;
        const sd = stationStreamMap[FMUse.generateCodeName(n)];
        hs = sd && sd.streams && sd.streams.length > 0 && !sd.broken;
        break;
      }
    }
    if (aS) {
      btn.classList.add('occupied');
      btn.title = aS + (hs ? '' : ' (нет потоков)');
      if (currentPlayingStation === aS) btn.classList.add('assigned-active');
      if (!hs) btn.classList.add('disabled');
    }
    let pT = null;
    let isL = false;
    const sP = (e) => {
      e.stopPropagation();
      isL = false;
      pT = setTimeout(() => {
        isL = true;
        window._skipNextClick = true;
        if (currentPlayingStation) {
          assignPreset(currentPlayingStation, aI);
          showToast(`Кнопка ${state.bands > 1 ? state.dialCurrentBand + '.' : ''}${i} назначена`);
        } else {
          showToast('Включите станцию');
        }
      }, 500);
    };
    const eP = (e) => {
      e.stopPropagation();
      if (pT) clearTimeout(pT);
      if (window._skipNextClick) {
        window._skipNextClick = false;
        return;
      }
      if (!isL && aS && hs) togglePlay(aS);
    };
    btn.addEventListener('mousedown', sP);
    btn.addEventListener('mouseup', eP);
    btn.addEventListener('mouseleave', () => { if (pT) clearTimeout(pT); });
    btn.addEventListener('touchstart', sP, { passive: true });
    btn.addEventListener('touchend', eP);
    r2.appendChild(btn);
  }
  rA.appendChild(r2);
  c.appendChild(rA);
}

function initDialKnob(canvas) {
  const ctx = canvas.getContext('2d');
  const dK = () => {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = 14;
    ctx.clearRect(0, 0, w, h);
    const vol = audioPlayer.volume;
    const sA = 0.75 * Math.PI;
    const eA = sA + (1.5 * Math.PI * vol);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.shadowColor = getCSSVar('--accent');
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clearRect(cx - r, cy - r, r * 2, r * 2);
    ctx.strokeStyle = getCSSVar('--accent');
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r, sA, eA);
    ctx.strokeStyle = getCSSVar('--accent');
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    const lA = sA + (1.5 * Math.PI * vol);
    const x1 = cx + Math.cos(lA) * r;
    const y1 = cy + Math.sin(lA) * r;
    const x2 = cx + Math.cos(lA) * (r - 6);
    const y2 = cy + Math.sin(lA) * (r - 6);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = getCSSVar('--accent');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.fillStyle = getCSSVar('--accent');
    ctx.font = 'bold 9px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(vol * 100), cx, cy);
    canvas.title = `Громкость: ${Math.round(vol * 100)}%`;
  };
  dK();
  window.updateDialKnob = dK; // Expose globally for header slider sync
  
  const uV = (dY) => {
    let v = audioPlayer.volume;
    if (dY < 0) v += 0.02;
    else v -= 0.02;
    if (window.updateVolume) window.updateVolume(v);
  };
  
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    uV(e.deltaY);
  }, { passive: false });
  
  const hM = (cX, cY) => {
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cX - cx;
    const dy = cY - cy;
    let a = Math.atan2(dy, dx);
    if (a < 0) a += Math.PI * 2;
    let mA = 0.75 * Math.PI;
    let maxA = 2.25 * Math.PI;
    if (a < mA && a > maxA - Math.PI * 2) a = mA;
    if (a > maxA) a = maxA;
    let v = (a - mA) / (maxA - mA);
    v = Math.max(0, Math.min(1, v));
    if (window.updateVolume) window.updateVolume(v);
  };
  
  let isD = false;
  canvas.addEventListener('mousedown', (e) => {
    isD = true;
    hM(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => {
    if (isD) hM(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => isD = false);
  canvas.addEventListener('touchstart', (e) => {
    isD = true;
    hM(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (isD && e.touches[0]) {
      e.preventDefault();
      hM(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  window.addEventListener('touchend', () => isD = false);
}