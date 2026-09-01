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
let lastVolume = 1;
let dialPlayerInView = false;

// Hides header player while dial player display is on screen
function initHeaderPlayerSync() {
  const target = document.getElementById('dialMarqueeContainer');
  if (!target) return;
  const measure = () => {
    const r = target.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  };
  const apply = (v) => {
    if (dialPlayerInView === v) return;
    dialPlayerInView = v;
    if (audioPlayer) updatePlayerUI();
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => apply(e[0].isIntersecting), { threshold: 0 }).observe(target);
  } else {
    window.addEventListener('scroll', () => apply(measure()), { passive: true });
    window.addEventListener('resize', () => apply(measure()), { passive: true });
  }
  apply(measure());
}

function setHeaderBrand(show) {
  const b = document.getElementById('headerBrand');
  if (b) b.style.display = show ? 'flex' : 'none';
}

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

function attemptPlay(name, streamIndex, corsRetry) {
  const myToken = ++playbackToken;
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
    };

    const onPlaying = () => { 
      if (myToken !== playbackToken) { 
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
      if (myToken !== playbackToken) { 
        if (!settled) { settled = true; cleanup(); resolve('aborted'); }
        return;
      }
      if (settled) return; 
      settled = true; 
      cleanup(); 
      // CORS mode failed -> retry same stream without crossorigin, no spectrum but sound
      if (corsRetry && audioPlayer.crossOrigin === 'anonymous') {
        audioPlayer.crossOrigin = null;
        resolve('retry-plain');
        return;
      }
      resolve(false); 
    };
    
    playTimeout = setTimeout(() => { 
      if (myToken !== playbackToken) { 
        if (!settled) { settled = true; cleanup(); resolve('aborted'); }
        return;
      }
      if (settled) return; 
      settled = true; cleanup(); 
      audioPlayer.pause();
      audioPlayer.load(); 
      resolve(false); 
    }, 5000);
    
    audioPlayer.addEventListener('playing', onPlaying);
    audioPlayer.addEventListener('error', onError);
    
    audioPlayer.crossOrigin = corsRetry === false ? null : 'anonymous';
    audioPlayer.src = url;
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => { 
        if (myToken !== playbackToken) { 
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
    if (played === 'retry-plain') {
      audioPlayer.pause();
      played = await attemptPlay(st.name, savedIdx, false);
    }
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
    
    if (state.viewMode === 'setup' || state.viewMode === 'player') {
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
      // Real stream error - mark as broken and CONTINUE skipping!
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
  
  let cI = -1;
  if (currentPlayingStation) {
    cI = pS.findIndex((s) => s.name === currentPlayingStation);
    if (cI === -1) {
      // Если у текущей станции нет пресета, ищем ближайшую по частоте
      const currentSt = state.stations.find((st) => st.name === currentPlayingStation);
      const currentFreq = currentSt ? currentSt.freq : (dir === 1 ? -Infinity : Infinity);
      let minDiff = Infinity;
      pS.forEach((s, idx) => {
        const st = state.stations.find((stn) => stn.name === s.name);
        if (st) {
          const diff = Math.abs(st.freq - currentFreq);
          if (diff < minDiff) {
            minDiff = diff;
            cI = idx;
          }
        }
      });
    }
  }
  
  let nI;
  if (cI === -1) {
    nI = dir === 1 ? 0 : pS.length - 1;
  } else {
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
      // Continue loop to next preset
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
    window.scAnalyser = analyser;
    audioContext.resume().catch(() => {});
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
  if (analyser && !audioPlayer.paused && currentPlayingStation && audioPlayer.crossOrigin === 'anonymous') {
    const bL = analyser.frequencyBinCount;
    const dA = new Uint8Array(bL);
    analyser.getByteFrequencyData(dA);
    let sum = 0; for (let i = 0; i < bL; i++) sum += dA[i];
    if (sum === 0) { requestAnimationFrame(drawSpectrum); return; } // non-CORS: silent canvas, no garbage
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

// --- ICY "now playing": opt-in parallel metadata connection ---
let nowPlayingTrack = '';
let metaAbort = null;
const metaStats = { status: 'off', detail: '', updates: 0 };

function metaTitleText() {
  if (!state.trackMeta) return 'Инфо о треке: выкл';
  const s = metaStats.status;
  if (s === 'connecting') return 'Инфо о треке: вкл. Подключаюсь к потоку...';
  if (s === 'receiving') return `Инфо о треке: вкл. Читаю поток, обновлений: ${metaStats.updates}${metaStats.detail ? `. Сейчас: ${metaStats.detail}` : ''}`;
  if (s === 'no-meta') return 'Инфо о треке: вкл. Сервер не отдал icy-metaint: метаданных нет или заголовок скрыт CORS';
  if (s === 'paused') return 'Инфо о треке: вкл. Пауза, чтение остановлено';
  if (s === 'error') return `Инфо о треке: вкл. Ошибка: ${metaStats.detail}`;
  return 'Инфо о треке: вкл. Ожидаю запуск воспроизведения';
}

function setMeta(status, detail) {
  metaStats.status = status;
  if (detail !== undefined) metaStats.detail = detail;
  updateMetaBtn();
  if (typeof showToast === 'function' && status === 'receiving' && detail && metaStats.lastToast !== detail) {
    metaStats.lastToast = detail;
    showToast(detail);
  }
}

function updateMetaBtn() {
  const b = document.getElementById('dialMetaBtn');
  if (!b) return;
  b.title = metaTitleText();
  b.classList.remove('meta-connecting', 'meta-live', 'meta-warn', 'meta-err');
  if (!state.trackMeta) { b.style.color = ''; return; }
  const s = metaStats.status;
  if (s === 'connecting') b.classList.add('meta-connecting');
  else if (s === 'receiving') b.classList.add(metaStats.updates > 0 ? 'meta-live' : 'meta-warn');
  else if (s === 'no-meta' || s === 'error') b.classList.add('meta-err');
  else b.classList.add(metaStats.updates > 0 ? 'meta-live' : 'meta-warn'); // paused/idle while enabled
}

function stopTrackMeta() {
  if (metaAbort) { metaAbort.abort(); metaAbort = null; }
  setMeta(state.trackMeta ? 'paused' : 'off');
  if (nowPlayingTrack) { nowPlayingTrack = ''; updatePlayerUI(); }
}

function setTrack(title) {
  const t = String(title).replace(/\s+/g, ' ').trim().slice(0, 100);
  if (t === nowPlayingTrack) return;
  nowPlayingTrack = t;
  metaStats.updates++;
  setMeta('receiving', t);
  updatePlayerUI();
  updateUrl();
}

async function startTrackMeta(url) {
  stopTrackMeta();
  metaStats.updates = 0;
  const ctl = new AbortController();
  metaAbort = ctl;
  setMeta('connecting', '');
  try {
    const res = await fetch(url, { headers: { 'Icy-MetaData': '1' }, signal: ctl.signal });
    if (!res.ok) { setMeta('error', `HTTP ${res.status}`); return; }
    const metaint = parseInt(res.headers.get('icy-metaint'), 10);
    if (!metaint || !res.body) { if (res.body) res.body.cancel(); setMeta('no-meta'); return; }
    setMeta('receiving', '');
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let audioRemain = metaint, metaRemain = 0, metaParts = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done || ctl.signal.aborted) break;
      let i = 0;
      while (i < value.length) {
        if (audioRemain > 0) {
          const take = Math.min(audioRemain, value.length - i);
          i += take;
          audioRemain -= take;
        } else if (metaRemain > 0) {
          const take = Math.min(metaRemain, value.length - i);
          metaParts.push(dec.decode(value.subarray(i, i + take)));
          i += take;
          metaRemain -= take;
          if (metaRemain === 0) {
            const m = metaParts.join('').match(/StreamTitle='((?:\\.|[^'])*)'/);
            if (m) setTrack(m[1].replace(/\\'/g, "'"));
            metaParts = [];
            audioRemain = metaint;
          }
        } else {
          const len = value[i++] * 16;
          if (len > 0) metaRemain = len;
          else audioRemain = metaint;
        }
      }
    }
    if (!ctl.signal.aborted) setMeta('error', 'сервер закрыл соединение');
  } catch (e) {
    if (e.name !== 'AbortError') setMeta('error', e.name === 'TypeError' ? 'запрос заблокирован (CORS или сеть)' : e.message);
  } finally { if (metaAbort === ctl) metaAbort = null; }
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
      pP.style.visibility = dialPlayerInView ? 'hidden' : 'visible';
      setHeaderBrand(dialPlayerInView);
      if (mC) mC.classList.toggle('show', !dialPlayerInView);
      const lB = document.getElementById('logoBtn');
      const oL = 'img/logo_100.png';
      const pF = document.getElementById('playerStreamInfo');
      const st = state.stations.find((s) => s.name === currentPlayingStation);
      if (st && !dialPlayerInView) {
        const isSV = state.dialFreqView === 'shifted';
        const dF = isSV ? FMUse.calcShiftedFreq(st.freq, state, RU_MIN, RU_MAX) : st.freq;
        if (pF) pF.setAttribute('data-freq', FMUse.formatFreq(dF));
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
      if (dialPlayerInView) document.getElementById('logoBtn').style.backgroundImage = "url('img/logo_100.png')";
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
        const fQ = pF.getAttribute('data-freq');
        pS.textContent = '';
        if (fQ) {
            const fEl = document.createElement('strong');
            fEl.textContent = fQ;
            pS.appendChild(fEl);
            pS.appendChild(document.createTextNode(' • '));
        }
        pS.appendChild(document.createTextNode(p.join(' • ')));
        pS.title = nowPlayingTrack ? `${tP.join(' • ')}\n♪ ${nowPlayingTrack}` : tP.join(' • ');
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

      // --- ОБНОВЛЕНИЕ ДИСПЛЕЯ НА ШКАЛЕ ---
      const dialLogo = document.getElementById('dialPlayerLogo');
      const dialMarquee = document.getElementById('dialMarquee');
      const dialContainer = document.getElementById('dialMarqueeContainer');
      if (dialLogo && dialMarquee && dialContainer) {
        const stream = sd.streams[currentStreamIndex];
        const cF = (stream && stream.favicon && stream.favicon !== 'null') ? stream.favicon : (sd.favicon && sd.favicon !== 'null' ? sd.favicon : null);
        
        if (cF) {
          const img = document.createElement('img');
          img.src = cF;
          img.onerror = () => { dialLogo.textContent = FMUse.formatFreq(st ? st.freq : 0); };
          dialLogo.innerHTML = '';
          dialLogo.appendChild(img);
        } else {
          dialLogo.textContent = FMUse.formatFreq(st ? st.freq : 0);
        }
        dialLogo.style.display = 'flex';

        const genres = stream && stream.tags ? stream.tags : (sd.tags || '');
        const cleanedName = stream && stream.name ? FMUse.cleanStreamName(stream.name, currentPlayingStation, state.city, genres) : '';
        
        let text = '';
        if (st) {
          text += `${FMUse.formatFreq(st.freq)} • `;
        }
        text += currentPlayingStation.toUpperCase();
        if (nowPlayingTrack) text += ` • ♪ ${nowPlayingTrack}`;
        if (stream && stream.bitrate) text += ` • ${stream.bitrate}k`;
        if (genres) text += ` • ${genres}`;
        if (cleanedName) text += ` • ${cleanedName}`;
        
        // Передаем текст напрямую в функцию проверки
        dialMarquee.dataset.text = text;
        dialContainer.title = text;
        checkMarqueeScroll(text);
      }
      // ------------------------------------
    }
  } else {
    pP.style.display = 'none';
    if (mC) mC.classList.remove('show');
    setHeaderBrand(true);
    document.getElementById('logoBtn').style.backgroundImage = `url('img/logo_100.png')`;
    const pF = document.getElementById('playerFreq');
    if (pF) pF.textContent = '';
    
    // --- ДИСПЛЕЙ НА ШКАЛЕ (когда ничего не играет) ---
    const dialLogo = document.getElementById('dialPlayerLogo');
    const dialContainer = document.getElementById('dialMarqueeContainer');
    if (dialLogo) dialLogo.style.display = 'none';
    if (dialContainer) {
      dialContainer.title = 'ВЫБЕРИТЕ СТАНЦИЮ';
      const dialMarquee = document.getElementById('dialMarquee');
      if (dialMarquee) {
        dialMarquee.dataset.text = 'ВЫБЕРИТЕ СТАНЦИЮ';
        checkMarqueeScroll('ВЫБЕРИТЕ СТАНЦИЮ');
      }
    }
    // -------------------------------------------------
  }
  if (currentPlayingStation && !audioPlayer.paused) {
    const trackLine = nowPlayingTrack ? `♪ ${nowPlayingTrack} • ` : '';
    if (titleRotationStation !== `${currentPlayingStation}|${nowPlayingTrack}`) {
      titleRotationStation = `${currentPlayingStation}|${nowPlayingTrack}`;
      if (titleRotationInterval) clearInterval(titleRotationInterval);
      let tS = `AutoFMShift ▶ ${trackLine}${currentPlayingStation} • • • `;
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

// Проверка необходимости прокрутки бегущей строки (текст передается напрямую)
function checkMarqueeScroll(text) {
  const dialMarquee = document.getElementById('dialMarquee');
  const dialContainer = document.getElementById('dialMarqueeContainer');
  if (!dialMarquee || !dialContainer || !text) return;
  
  // Сбрасываем для точного измерения
  dialMarquee.classList.remove('scroll-active');
  dialMarquee.textContent = text;
  void dialMarquee.offsetWidth; // Форсируем reflow
  
  if (dialMarquee.scrollWidth > dialContainer.clientWidth) {
    // Дублируем текст для бесшовной прокрутки
    dialMarquee.textContent = text + '   •   ' + text;
    void dialMarquee.offsetWidth; 
    dialMarquee.classList.add('scroll-active');
  } else {
    dialMarquee.textContent = text;
  }
}

// Обновляем параметры при изменении размера окна
window.addEventListener('resize', () => {
  const dialMarquee = document.getElementById('dialMarquee');
  if (dialMarquee) {
    checkMarqueeScroll(dialMarquee.dataset.text || 'ВЫБЕРИТЕ СТАНЦИЮ');
  }
});

// Открытие меню выбора потока по долгому клику
function openStreamMenu(btn) {
  closePresetMenu();
  if (!currentPlayingStation) return;
  const sd = stationStreamMap[FMUse.generateCodeName(currentPlayingStation)];
  if (!sd || !sd.streams || sd.streams.length === 0) return;

  const menu = document.createElement('div');
  menu.className = 'stream-menu';
  
  sd.streams.forEach((stream, i) => {
    const item = document.createElement('div');
    let classes = 'stream-item';
    if (i === currentStreamIndex) classes += ' current';
    if (stream.broken) classes += ' disabled';
    item.className = classes;
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'stream-name';
    const rawName = stream.name ? FMUse.cleanStreamName(stream.name, currentPlayingStation, state.city, stream.tags || '') : `Поток ${i+1}`;
    const safeName = rawName.replace(/[!\n\r]/g, '').trim() || `Поток ${i+1}`;
    nameDiv.textContent = safeName;
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'stream-info';
    let infoText = `№${i+1} • ${stream.bitrate || '?'}k • ${(stream.codec || '').replace(/[!\n\r]/g, '').trim()}`;
    if (safeName && safeName !== `Поток ${i+1}`) infoText += ` • ${safeName}`;
    infoDiv.textContent = infoText;
    
    if (stream.broken) item.classList.add('disabled');
    
    item.appendChild(nameDiv);
    item.appendChild(infoDiv);
    item.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
    item.onclick = async (e) => {
      e.stopPropagation();
      if (stream.broken) return;
      closePresetMenu();
      const played = await attemptPlay(currentPlayingStation, i);
      if (played === true) {
        localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(currentPlayingStation), i);
        updatePlayerUI();
        updateUrl();
      } else if (!played) {
        sd.streams[i].broken = true;
        showToast('Поток недоступен');
      }
    };
    menu.appendChild(item);
  });
  
  document.body.appendChild(menu);
  const rect = btn.getBoundingClientRect();
  menu.style.left = `${rect.left + rect.width / 2}px`;
  menu.style.top = `${rect.top}px`;
  
  activePresetMenu = menu;
  
  // Устанавливаем флаг, чтобы глобальный обработчик клика не закрыл меню сразу же
  window.menuJustOpened = true;
  setTimeout(() => { window.menuJustOpened = false; }, 300);
}

// Единая функция умной перемотки
async function smartSkip(dir) {
  if (state.skipMode === 'presets') {
    const bS = (state.dialCurrentBand - 1) * state.presets + 1;
    const bE = bS + state.presets - 1;
    const cs = state.cityData[state.city]?.stations || {};
    let count = 0;
    for (const n in cs) {
      const i = cs[n].presetIndex;
      if (i >= bS && i <= bE) {
        const sd = stationStreamMap[FMUse.generateCodeName(n)];
        if (sd && sd.streams && sd.streams.length > 0 && !sd.broken) count++;
      }
    }
    if (count >= 2) {
      await skipPreset(dir);
      return;
    }
  }
  await skipStation(dir);
}

function toggleMute() {
  if (audioPlayer.volume === 0) {
    window.updateVolume(lastVolume || 1);
  } else {
    lastVolume = audioPlayer.volume;
    window.updateVolume(0);
  }
}