// player.js
let stationStreamMap = {};
let audioPlayer = null;
let currentPlayingStation = null;
let currentStreamIndex = 0;
let playTimeout = null;
let isSwitchingStream = false;
let titleRotationInterval = null;
let titleRotationStation = null;
let audioContext = null;
let analyser = null;
let sourceNode = null;
let spectrumCanvas = null;
let spectrumCtx = null;
let isRestoringPlayback = false;
let playbackToken = 0; // Token to handle rapid skipping and aborts correctly

async function loadStationsData() {
  try {
    const isL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const v = isL ? Date.now() : (typeof VERSION !== 'undefined' ? VERSION : '1');
    const r = await fetch(`data/stations_data.json?v=${v}`, { cache: 'no-cache' });
    if (r.ok) {
      const d = await r.json();
      d.forEach((st) => {
        if (st.streams) {
          const c = FMUse.generateCodeName(st.name);
          stationStreamMap[c] = st;
          if (!state.streamsData) state.streamsData = {};
          state.streamsData[c] = st;
        }
      });
    }
  } catch (e) {}
  if (state.streamsData) {
    Object.keys(state.streamsData).forEach((c) => {
      if (!stationStreamMap[c]) stationStreamMap[c] = state.streamsData[c];
    });
  }
}

function hideStationButton(n) {
  document.querySelectorAll('.play-btn-row').forEach((b) => {
    if (b.dataset.name === n) b.classList.add('hidden');
  });
}

function setPlayerLoading(iL, hT = 'Подключение к потоку...') {
  const b = document.getElementById('playerPlayBtn');
  const mB = document.getElementById('mobilePlayBtn');
  const h = document.getElementById('playerHint');
  if (!b) return;
  b.classList.toggle('loading', iL);
  if (mB) mB.classList.toggle('loading', iL);
  if (h) {
    h.textContent = hT;
    h.classList.toggle('show', iL);
  }
  b.title = iL ? hT : (audioPlayer.paused ? 'Воспроизвести' : 'Пауза');
}

function cancelRestorePlayback() {
  if (isRestoringPlayback) {
    isRestoringPlayback = false;
    setPlayerLoading(false);
  }
}

async function restorePlayback() {
  if (!currentPlayingStation) return;
  isRestoringPlayback = true;
  setPlayerLoading(true, 'Восстановление...');
  const sI = parseInt(localStorage.getItem('fm_working_stream_' + FMUse.generateCodeName(currentPlayingStation)));
  if (!isNaN(sI) && sI >= 0) {
    const sd = stationStreamMap[FMUse.generateCodeName(currentPlayingStation)];
    if (sd && sI < sd.streams.length) currentStreamIndex = sI;
  }
  const r = await attemptPlay(currentPlayingStation, currentStreamIndex);
  if (isRestoringPlayback) {
    isRestoringPlayback = false;
    if (r === true) {
      localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(currentPlayingStation), currentStreamIndex);
      updatePlayerUI();
      updateUrl();
    } else if (r === 'blocked') {
      setPlayerLoading(false);
      updatePlayerUI();
      showToast('Нажмите Play');
    } else {
      setPlayerLoading(false);
      showToast('Поток недоступен');
      stopPlayer();
    }
  }
}

function attemptPlay(name, streamIndex) {
  const myToken = ++playbackToken; // Get a new token for this attempt
  return new Promise((resolve) => {
    const streamData = stationStreamMap[FMUse.generateCodeName(name)];
    if (!streamData || !streamData.streams || streamIndex >= streamData.streams.length || streamData.streams[streamIndex].broken) {
      resolve(false);
      return;
    }
    
    currentPlayingStation = name;
    currentStreamIndex = streamIndex;
    setPlayerLoading(true, 'Подключение...');
    updatePlayerUI();
    
    let url = streamData.streams[streamIndex].url;
    if (!url || url === 'null' || url === 'undefined' || url === '') {
      resolve(false);
      return;
    }
    if (window.location.protocol === 'https:' && url.startsWith('http:')) {
      url = 'https:' + url.substring(5);
    }
    
    let settled = false;
    const cleanup = () => {
      clearTimeout(playTimeout);
      audioPlayer.removeEventListener('playing', onPlaying);
      audioPlayer.removeEventListener('error', onError);
      audioPlayer.removeEventListener('abort', onAbort);
    };

    const onPlaying = () => { 
      if (myToken !== playbackToken) { // Request was superseded
        if (!settled) { settled = true; cleanup(); resolve('aborted'); }
        return;
      }
      if (settled) return; 
      settled = true; 
      cleanup(); 
      initAudioContext();
      updateMediaSession();
      localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(name), streamIndex);
      resolve(true); 
    };
    
    const onError = () => { 
      if (myToken !== playbackToken) { // Request was superseded
        if (!settled) { settled = true; cleanup(); resolve('aborted'); }
        return;
      }
      if (settled) return; 
      settled = true; 
      cleanup(); 
      resolve(false); 
    };
    
    const onAbort = () => {
      if (myToken !== playbackToken) { // Request was superseded
        if (!settled) { settled = true; cleanup(); resolve('aborted'); }
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      resolve('aborted');
    };
    
    playTimeout = setTimeout(() => { 
      if (myToken !== playbackToken) { // Request was superseded
        if (!settled) { settled = true; cleanup(); resolve('aborted'); }
        return;
      }
      if (settled) return; 
      settled = true; cleanup(); 
      audioPlayer.pause();
      audioPlayer.load(); 
      resolve(false); 
    }, 10000);
    
    audioPlayer.addEventListener('playing', onPlaying);
    audioPlayer.addEventListener('error', onError);
    audioPlayer.addEventListener('abort', onAbort);
    
    audioPlayer.src = url;
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => { 
        if (myToken !== playbackToken) { // Request was superseded
          if (!settled) { settled = true; cleanup(); resolve('aborted'); }
          return;
        }
        if (settled) return;
        if (e.name === 'NotAllowedError') {
          settled = true; cleanup();
          audioPlayer.pause();
          audioPlayer.load();
          resolve('blocked'); 
        } else if (e.name === 'AbortError') {
          settled = true; cleanup();
          resolve('aborted');
        } else {
          settled = true; cleanup(); 
          resolve(false); 
        }
      });
    }
  });
}

async function tryPlayStation(st) {
  const streamData = stationStreamMap[FMUse.generateCodeName(st.name)];
  if (!streamData || !streamData.streams || streamData.broken) return false;
  
  let played = false;
  let savedIdx = parseInt(localStorage.getItem('fm_working_stream_' + FMUse.generateCodeName(st.name)));
  if (!isNaN(savedIdx) && savedIdx < streamData.streams.length && !streamData.streams[savedIdx].broken) {
    played = await attemptPlay(st.name, savedIdx);
    if (played === true || played === 'blocked' || played === 'aborted') return played;
    if (!played) streamData.streams[savedIdx].broken = true;
  }
  
  let bestBitrate = -1, bestIdx = -1;
  streamData.streams.forEach((s, i) => { if (!s.broken && s.bitrate > bestBitrate) { bestBitrate = s.bitrate; bestIdx = i; } });
  if (bestIdx !== -1) {
    played = await attemptPlay(st.name, bestIdx);
    if (played === true || played === 'blocked' || played === 'aborted') return played;
    if (!played) streamData.streams[bestIdx].broken = true;
  }
  
  for (let i = 0; i < streamData.streams.length; i++) {
    if (!streamData.streams[i].broken) {
      played = await attemptPlay(st.name, i);
      if (played === true || played === 'blocked' || played === 'aborted') return played;
      if (!played) streamData.streams[i].broken = true;
    }
  }
  return false;
}

async function togglePlay(name) {
  cancelRestorePlayback();
  if (currentPlayingStation === name && !audioPlayer.paused) {
    audioPlayer.pause();
    updatePlayerUI();
    return;
  }
  if (currentPlayingStation === name && audioPlayer.paused && audioPlayer.src && audioPlayer.src !== window.location.href) {
    setPlayerLoading(true, 'Возобновление...');
    playbackToken++; // Invalidate previous pending attempts
    audioPlayer.play().catch(() => {
      setPlayerLoading(false);
      updatePlayerUI();
    });
    updatePlayerUI();
    return;
  }
  
  playbackToken++; // Invalidate previous pending attempts
  const oS = currentPlayingStation;
  const oI = currentStreamIndex;
  
  const streamData = stationStreamMap[FMUse.generateCodeName(name)];
  if (!streamData || !streamData.streams || streamData.streams.length === 0) {
    showToast('Нет потока');
    return;
  }
  
  const result = await tryPlayStation({ name: name });
  
  if (result === true) {
    localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(name), currentStreamIndex);
    updatePlayerUI();
    updateUrl();
  } else if (result === 'blocked') {
    showToast('Нажмите Play для возобновления');
  } else if (result === 'aborted') {
    // Do nothing, user clicked another station
  } else {
    streamData.broken = true;
    hideStationButton(name);
    showToast('Станция недоступна');
    updatePlayerUI();
    if (oS) {
      currentPlayingStation = oS;
      currentStreamIndex = oI;
      await attemptPlay(oS, oI);
      updatePlayerUI();
    } else {
      stopPlayer();
    }
  }
}

async function skipStation(dir) {
  cancelRestorePlayback();
  audioPlayer.pause();
  playbackToken++; // Invalidate previous pending attempts
  
  if (state.stations.length === 0) {
    showToast('Нет станций');
    stopPlayer();
    renderStations();
    return;
  }
  
  const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
  let cI = sorted.findIndex((st) => st.name === currentPlayingStation);
  if (cI === -1) cI = dir === 1 ? -1 : sorted.length;
  let nI = cI;
  
  for (let i = 0; i < sorted.length; i++) {
    nI += dir;
    if (nI < 0) nI = sorted.length - 1;
    if (nI >= sorted.length) nI = 0;
    
    const st = sorted[nI];
    const sd = stationStreamMap[FMUse.generateCodeName(st.name)];
    if (!sd || !sd.streams || sd.broken) continue;
    
    if (state.settingsMode || state.viewMode === 'player') {
      const sD = getStationData(st.name);
      if (sD.type === 'trash') continue;
    }
    
    const r = await tryPlayStation(st);
    
    if (r === true) {
      localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(st.name), currentStreamIndex);
      updatePlayerUI();
      updateUrl();
      return;
    } else if (r === 'blocked') {
      break; // Stop skipping if browser blocked autoplay
    } else if (r === 'aborted') {
      return; // Exit silently if a new skip started
    } else {
      // Real stream error
      sd.broken = true;
      hideStationButton(st.name);
      if (typeof renderDialControls === 'function') renderDialControls();
    }
  }
  
  showToast('Потоки не найдены');
  stopPlayer();
  renderStations();
}

async function skipPreset(dir) {
  cancelRestorePlayback();
  audioPlayer.pause();
  playbackToken++; // Invalidate previous pending attempts
  
  const bS = (state.dialCurrentBand - 1) * state.presets + 1;
  const bE = bS + state.presets - 1;
  const cs = state.cityData[state.city]?.stations || {};
  const pS = [];
  for (const n in cs) {
    const i = cs[n].presetIndex;
    if (i >= bS && i <= bE) {
      const sd = stationStreamMap[FMUse.generateCodeName(n)];
      if (sd && sd.streams && sd.streams.length > 0 && !sd.broken) pS.push({ name: n, idx: i });
    }
  }
  pS.sort((a, b) => a.idx - b.idx);
  
  if (pS.length === 0) {
    showToast('Нет станций на кнопках');
    return;
  }
  
  let cI = currentPlayingStation ? pS.findIndex((s) => s.name === currentPlayingStation) : -1;
  let nI;
  if (cI === -1) nI = dir === 1 ? 0 : pS.length - 1;
  else {
    nI = cI + dir;
    if (nI < 0) nI = pS.length - 1;
    if (nI >= pS.length) nI = 0;
  }
  
  let a = 0;
  while (a <= pS.length) {
    const sN = pS[nI].name;
    const r = await tryPlayStation({ name: sN });
    
    if (r === true) {
      localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(sN), currentStreamIndex);
      updatePlayerUI();
      updateUrl();
      return;
    } else if (r === 'blocked') {
      break;
    } else if (r === 'aborted') {
      return; // Exit silently
    } else {
      const sd = stationStreamMap[FMUse.generateCodeName(sN)];
      sd.broken = true;
      hideStationButton(sN);
      if (typeof renderDialControls === 'function') renderDialControls();
    }
    
    nI += dir;
    if (nI < 0) nI = pS.length - 1;
    if (nI >= pS.length) nI = 0;
    a++;
  }
  
  showToast('Потоки не найдены');
  stopPlayer();
}

function stopPlayer() {
  cancelRestorePlayback();
  audioPlayer.pause();
  playbackToken++; // Invalidate previous pending attempts
  currentPlayingStation = null;
  updatePlayerUI();
  updateUrl();
}

function initAudioContext() {
  if (audioContext && audioContext.state !== 'closed') {
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return;
  }
  try {
    if (audioContext) audioContext.close();
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    sourceNode = audioContext.createMediaElementSource(audioPlayer);
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch (e) {
    audioContext = null;
    analyser = null;
  }
}

function drawSpectrum() {
  if (!spectrumCtx) {
    requestAnimationFrame(drawSpectrum);
    return;
  }
  if (spectrumCanvas.offsetWidth > 0) spectrumCanvas.width = spectrumCanvas.offsetWidth;
  if (spectrumCanvas.offsetHeight > 0) spectrumCanvas.height = spectrumCanvas.offsetHeight;
  const w = spectrumCanvas.width;
  const h = spectrumCanvas.height;
  if (w === 0 || h === 0) {
    requestAnimationFrame(drawSpectrum);
    return;
  }
  spectrumCtx.clearRect(0, 0, w, h);
  if (analyser && !audioPlayer.paused && currentPlayingStation) {
    const bL = analyser.frequencyBinCount;
    const dA = new Uint8Array(bL);
    analyser.getByteFrequencyData(dA);
    const bW = w / bL;
    let x = 0;
    const aC = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00d4ff';
    spectrumCtx.shadowBlur = 4;
    spectrumCtx.shadowColor = aC;
    for (let i = 0; i < bL; i++) {
      const bH = (dA[i] / 255) * h * 0.95;
      const bw = Math.max(1, bW - 2);
      const g = spectrumCtx.createLinearGradient(0, h, 0, h - bH);
      g.addColorStop(0, aC);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      spectrumCtx.fillStyle = g;
      spectrumCtx.beginPath();
      if (spectrumCtx.roundRect) spectrumCtx.roundRect(x, h - bH, bw, bH, [2, 2, 0, 0]);
      else spectrumCtx.rect(x, h - bH, bw, bH);
      spectrumCtx.fill();
      x += bW;
    }
  }
  requestAnimationFrame(drawSpectrum);
}

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !currentPlayingStation) return;
  const sd = stationStreamMap[FMUse.generateCodeName(currentPlayingStation)];
  if (!sd) return;
  let iS = state.city;
  if (sd.streams && sd.streams[currentStreamIndex]) {
    const s = sd.streams[currentStreamIndex];
    const iP = [];
    if (sd.streams.length > 1) iP.push(`Поток ${currentStreamIndex + 1}/${sd.streams.length}`);
    if (s.bitrate) iP.push(`${s.bitrate}k`);
    if (s.codec) iP.push(s.codec.toUpperCase());
    if (iP.length > 0) iS += ` • ${iP.join(' ')}`;
  }
  const a = sd.favicon ? [
    { src: sd.favicon, sizes: '96x96', type: 'image/png' },
    { src: sd.favicon, sizes: '256x256', type: 'image/png' },
    { src: sd.favicon, sizes: '512x512', type: 'image/png' }
  ] : [
    { src: 'img/logo_100.png', sizes: '96x96', type: 'image/png' },
    { src: 'img/logo_100.png', sizes: '256x256', type: 'image/png' }
  ];
  navigator.mediaSession.metadata = new MediaMetadata({
    title: currentPlayingStation,
    artist: iS,
    album: 'AutoFMShift',
    artwork: a
  });
  navigator.mediaSession.playbackState = audioPlayer.paused ? 'paused' : 'playing';
}

function updatePlayerUI() {
  localStorage.setItem('fm_player_playing', (!audioPlayer.paused && currentPlayingStation) ? currentPlayingStation : '');
  const pP = document.getElementById('playerPanel');
  const mC = document.getElementById('mobilePlayerControls');
  const mB = document.getElementById('mobilePlayBtn');
  const pB = document.getElementById('playerPlayBtn');
  const pL = document.getElementById('playerLogo');
  const pN = document.getElementById('playerName');
  const pS = document.getElementById('playerStreamInfo');
  if (currentPlayingStation) {
    const sd = stationStreamMap[FMUse.generateCodeName(currentPlayingStation)];
    if (sd) {
      pP.style.display = 'flex';
      if (mC) mC.classList.add('show');
      const lB = document.getElementById('logoBtn');
      const oL = 'img/logo_100.png';
      const hF = document.getElementById('headerFreq');
      const st = state.stations.find((s) => s.name === currentPlayingStation);
      if (st) {
        const isSV = state.dialFreqView === 'shifted';
        const dF = isSV ? FMUse.calcShiftedFreq(st.freq, state, RU_MIN, RU_MAX) : st.freq;
        hF.textContent = FMUse.formatFreq(dF);
        hF.style.display = 'flex';
        const cF = (sd.streams[currentStreamIndex] && sd.streams[currentStreamIndex].favicon && sd.streams[currentStreamIndex].favicon !== 'null') ? sd.streams[currentStreamIndex].favicon : (sd.favicon && sd.favicon !== 'null' ? sd.favicon : null);
        if (cF) {
          const img = new Image();
          img.onload = () => {
            lB.style.backgroundImage = `url('${cF}')`;
            pL.style.display = 'none';
          };
          img.onerror = () => {
            lB.style.backgroundImage = `url('${oL}')`;
            pL.style.display = 'none';
          };
          img.src = cF;
        } else {
          lB.style.backgroundImage = `url('${oL}')`;
          pL.style.display = 'none';
        }
      }
      pN.textContent = currentPlayingStation;
      pN.href = sd.homepage || '#';
      if (pN.offsetWidth < pN.scrollWidth) pN.title = currentPlayingStation;
      else pN.removeAttribute('title');
      if (sd.streams && sd.streams[currentStreamIndex]) {
        const s = sd.streams[currentStreamIndex];
        const g = s.tags ? s.tags : (sd.tags || '');
        const p = [];
        const tP = [`Поток ${currentStreamIndex + 1}/${sd.streams.length}`];
        if (sd.streams.length > 1) p.push(`${currentStreamIndex + 1}/${sd.streams.length}`);
        if (s.bitrate) {
          p.push(`${s.bitrate}k`);
          tP.push(`${s.bitrate}k`);
        }
        if (s.codec) {
          p.push(s.codec.toUpperCase());
          tP.push(s.codec.toUpperCase());
        }
        if (g) {
          p.push(g);
          tP.push(g);
        }
        pS.textContent = p.join(' • ');
        pS.title = tP.join(' • ');
        if (sd.streams.length > 1) {
          pS.classList.add('active-link');
          pS.setAttribute('href', '#');
        } else {
          pS.classList.remove('active-link');
          pS.removeAttribute('href');
        }
      }
      const pI = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      const pA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
      pB.innerHTML = audioPlayer.paused ? pI : pA;
      if (mB) mB.innerHTML = audioPlayer.paused ? pI : pA;
      pB.title = audioPlayer.paused ? 'Воспроизвести' : 'Пауза';
      updateMediaSession();
    }
  } else {
    pP.style.display = 'none';
    if (mC) mC.classList.remove('show');
    document.getElementById('logoBtn').style.backgroundImage = `url('img/logo_100.png')`;
    const hF = document.getElementById('headerFreq');
    if (hF) hF.style.display = 'none';
  }
  if (currentPlayingStation && !audioPlayer.paused) {
    if (!titleRotationInterval || titleRotationStation !== currentPlayingStation) {
      if (titleRotationInterval) clearInterval(titleRotationInterval);
      titleRotationStation = currentPlayingStation;
      let tS = `AutoFMShift ▶ ${currentPlayingStation} • • • `;
      titleRotationInterval = setInterval(() => {
        tS = tS.substring(1) + tS.charAt(0);
        document.title = tS;
      }, 350);
    }
  } else {
    if (titleRotationInterval) {
      clearInterval(titleRotationInterval);
      titleRotationInterval = null;
    }
    document.title = 'AutoFMShift';
  }
  document.querySelectorAll('.station-item').forEach((i) => {
    const b = i.querySelector('.play-btn-row');
    if (!b) return;
    const iN = b.dataset.name;
    if (iN === currentPlayingStation) {
      b.classList.add('active');
      b.innerHTML = audioPlayer.paused ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' : '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
    } else {
      b.classList.remove('active');
      b.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }
  });
  if (typeof renderDialControls === 'function') renderDialControls();
}

function initMobilePlayerControls() {
  if (document.getElementById('mobilePlayerControls')) return;
  const h = document.querySelector('.app-header');
  const c = document.createElement('div');
  c.id = 'mobilePlayerControls';
  const pB = document.createElement('button');
  pB.className = 'player-btn';
  pB.title = 'Пред.';
  pB.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>';
  pB.onclick = () => skipStation(-1);
  const plB = document.createElement('button');
  plB.className = 'player-btn';
  plB.id = 'mobilePlayBtn';
  plB.title = 'Play/Pause';
  plB.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  plB.onclick = () => {
    cancelRestorePlayback();
    if (currentPlayingStation) {
      if (audioPlayer.paused) {
        if (!audioPlayer.src || audioPlayer.src === window.location.href) {
          setPlayerLoading(true, 'Подключение...');
          attemptPlay(currentPlayingStation, currentStreamIndex).then((p) => {
            if (p) {
              localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(currentPlayingStation), currentStreamIndex);
              updatePlayerUI();
              updateUrl();
            } else {
              showToast('Недоступно');
              stopPlayer();
            }
          });
        } else {
          setPlayerLoading(true, 'Возобновление...');
          playbackToken++; // Invalidate pending attempts
          audioPlayer.play().catch(() => {
            setPlayerLoading(false);
            updatePlayerUI();
          });
        }
      } else {
        audioPlayer.pause();
      }
      updatePlayerUI();
    }
  };
  const sB = document.createElement('button');
  sB.className = 'player-btn';
  sB.title = 'Стоп';
  sB.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>';
  sB.onclick = () => {
    stopPlayer();
    renderStations();
  };
  const nB = document.createElement('button');
  nB.className = 'player-btn';
  nB.title = 'След.';
  nB.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>';
  nB.onclick = () => skipStation(1);
  const vS = document.createElement('input');
  vS.type = 'range';
  vS.id = 'mobileVolumeSlider';
  vS.className = 'mobile-volume-slider';
  vS.min = '0';
  vS.max = '1';
  vS.step = '0.01';
  vS.title = 'Громкость';
  c.appendChild(pB);
  c.appendChild(plB);
  c.appendChild(sB);
  c.appendChild(nB);
  c.appendChild(vS);
  h.appendChild(c);
}