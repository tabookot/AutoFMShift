// PLAYER VARIABLES
let stationStreamMap = {};
let audioPlayer = null;
let currentPlayingStation = null;
let currentStreamIndex = 0;
let playTimeout = null;
let isSkipping = false;
let isSwitchingStream = false;
let titleRotationInterval = null;
let titleRotationStation = null;
let audioContext = null;
let analyser = null;
let sourceNode = null;
let spectrumCanvas = null;
let spectrumCtx = null;
let isRestoringPlayback = false;

async function skipPreset(dir) {
    cancelRestorePlayback();
    audioPlayer.pause();
    audioPlayer.load();
    
    const bandStart = (state.dialCurrentBand - 1) * state.presets + 1;
    const bandEnd = bandStart + state.presets - 1;
    
    const cityStations = state.cityData[state.city]?.stations || {};
    const presetStations = [];
    for (const name in cityStations) {
        const idx = cityStations[name].presetIndex;
        if (idx >= bandStart && idx <= bandEnd) {
            const streamData = stationStreamMap[FMUse.generateCodeName(name)];
            const hasStreams = streamData && streamData.streams && streamData.streams.length > 0 && !streamData.broken;
            if (hasStreams) {
                presetStations.push({ name, idx });
            }
        }
    }
    presetStations.sort((a, b) => a.idx - b.idx);
    
    if (presetStations.length === 0) {
        showToast("Нет доступных станций на кнопках");
        return;
    }
    
    let currentIdx = currentPlayingStation ? presetStations.findIndex(s => s.name === currentPlayingStation) : -1;
    let nextIdx;
    if (currentIdx === -1) {
        nextIdx = dir === 1 ? 0 : presetStations.length - 1;
    } else {
        nextIdx = currentIdx + dir;
        if (nextIdx < 0) nextIdx = presetStations.length - 1;
        if (nextIdx >= presetStations.length) nextIdx = 0;
    }

    let attempts = 0;
    while (attempts <= presetStations.length) {
        const stName = presetStations[nextIdx].name;
        const streamData = stationStreamMap[FMUse.generateCodeName(stName)];
        let played = false;
        
        let savedIdx = parseInt(localStorage.getItem('fm_working_stream_' + FMUse.generateCodeName(stName)));
        if (!isNaN(savedIdx) && savedIdx < streamData.streams.length && !streamData.streams[savedIdx].broken) {
            played = await attemptPlay(stName, savedIdx);
            if (!played) streamData.streams[savedIdx].broken = true;
        }
        
        if (!played) {
            for (let i = 0; i < streamData.streams.length; i++) {
                if (!streamData.streams[i].broken) {
                    played = await attemptPlay(stName, i);
                    if (played) break;
                    streamData.streams[i].broken = true;
                }
            }
        }
        
        if (played) {
            localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(stName), currentStreamIndex);
            updatePlayerUI();
            updateUrl();
            return;
        } else {
            streamData.broken = true;
            hideStationButton(stName);
            updatePlayerUI(); // Немедленно помечаем кнопку как недоступную
        }
        
        nextIdx += dir;
        if (nextIdx < 0) nextIdx = presetStations.length - 1;
        if (nextIdx >= presetStations.length) nextIdx = 0;
        attempts++;
    }
    
    showToast("Рабочие потоки не найдены");
    stopPlayer();
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
    
    for (let i = 0; i < streamData.streams.length; i++) {
        if (!streamData.streams[i].broken) {
            played = await attemptPlay(st.name, i);
            if (played === true || played === 'blocked' || played === 'aborted') return played;
            streamData.streams[i].broken = true;
        }
    }
    return false;
}

async function skipStation(dir) {
    cancelRestorePlayback();
    audioPlayer.pause();
    audioPlayer.load();
    
    if (state.stations.length === 0) {
        showToast("Нет доступных станций с потоками");
        stopPlayer();
        renderStations(); 
        return;
    }

    // Ищем индекс текущей станции в полном списке, а не в отфильтрованном
    let currentIdx = state.stations.findIndex(st => st.name === currentPlayingStation);
    let nextIdx = currentIdx;

    for (let i = 0; i < state.stations.length; i++) {
        nextIdx += dir;
        if (nextIdx < 0) nextIdx = state.stations.length - 1;
        if (nextIdx >= state.stations.length) nextIdx = 0;

        const st = state.stations[nextIdx];
        const streamData = stationStreamMap[FMUse.generateCodeName(st.name)];
        if (!streamData || !streamData.streams || streamData.broken) continue;

        if (state.settingsMode || state.viewMode === 'player') {
            const stationData = getStationData(st.name);
            if (stationData.type === 'trash') continue;
        }

        const result = await tryPlayStation(st);
        
        if (result === true) {
            localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(st.name), currentStreamIndex);
            updatePlayerUI();
            updateUrl();
            return;
        } else if (result === 'blocked' || result === 'aborted') {
            break;
        } else {
            streamData.broken = true;
            hideStationButton(st.name);
            if (typeof renderDialControls === 'function') renderDialControls();
        }
    }
    
    showToast("Рабочие потоки не найдены");
    stopPlayer();
    renderStations(); 
}

async function skipPreset(dir) {
    cancelRestorePlayback();
    audioPlayer.pause();
    audioPlayer.load();
    
    const bandStart = (state.dialCurrentBand - 1) * state.presets + 1;
    const bandEnd = bandStart + state.presets - 1;
    
    const cityStations = state.cityData[state.city]?.stations || {};
    const presetStations = [];
    for (const name in cityStations) {
        const idx = cityStations[name].presetIndex;
        if (idx >= bandStart && idx <= bandEnd) {
            const streamData = stationStreamMap[FMUse.generateCodeName(name)];
            const hasStreams = streamData && streamData.streams && streamData.streams.length > 0 && !streamData.broken;
            if (hasStreams) {
                presetStations.push({ name, idx });
            }
        }
    }
    presetStations.sort((a, b) => a.idx - b.idx);
    
    if (presetStations.length === 0) {
        showToast("Нет доступных станций на кнопках");
        return;
    }
    
    let currentIdx = currentPlayingStation ? presetStations.findIndex(s => s.name === currentPlayingStation) : -1;
    let nextIdx;
    if (currentIdx === -1) {
        nextIdx = dir === 1 ? 0 : presetStations.length - 1;
    } else {
        nextIdx = currentIdx + dir;
        if (nextIdx < 0) nextIdx = presetStations.length - 1;
        if (nextIdx >= presetStations.length) nextIdx = 0;
    }

    let attempts = 0;
    while (attempts <= presetStations.length) {
        const stName = presetStations[nextIdx].name;
        const result = await tryPlayStation({ name: stName });
        
        if (result === true) {
            localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(stName), currentStreamIndex);
            updatePlayerUI();
            updateUrl();
            return;
        } else if (result === 'blocked' || result === 'aborted') {
            break;
        } else {
            const streamData = stationStreamMap[FMUse.generateCodeName(stName)];
            streamData.broken = true;
            hideStationButton(stName);
            if (typeof renderDialControls === 'function') renderDialControls();
        }
        
        nextIdx += dir;
        if (nextIdx < 0) nextIdx = presetStations.length - 1;
        if (nextIdx >= presetStations.length) nextIdx = 0;
        attempts++;
    }
    
    showToast("Рабочие потоки не найдены");
    stopPlayer();
}

// PLAYER LOGIC
async function loadStationsData() {
    try {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const ver = isLocalhost ? Date.now() : (typeof VERSION !== 'undefined' ? VERSION : '1');
        const res = await fetch(`data/stations_data.json?v=${ver}`, { cache: 'no-cache' });
        if (res.ok) {
            const data = await res.json();
            data.forEach(st => {
                if (st.streams) { // Убрали проверку length > 0, чтобы перезаписывать пустые массивы
                    const code = FMUse.generateCodeName(st.name);
                    stationStreamMap[code] = st;
                    if (!state.streamsData) state.streamsData = {};
                    state.streamsData[code] = st;
                }
            });
        }
    } catch (e) {}

    if (state.streamsData) {
        Object.keys(state.streamsData).forEach(code => {
            if (!stationStreamMap[code]) {
                stationStreamMap[code] = state.streamsData[code];
            }
        });
    }
}

function hideStationButton(name) {
    document.querySelectorAll('.play-btn-row').forEach(btn => {
        if (btn.dataset.name === name) btn.classList.add('hidden');
    });
}

function setPlayerLoading(isLoading, hintText = "Подключение к потоку...") {
    const btn = document.getElementById('playerPlayBtn');
    const mobileBtn = document.getElementById('mobilePlayBtn');
    const hint = document.getElementById('playerHint');
    if (!btn) return;
    btn.classList.toggle('loading', isLoading);
    if (mobileBtn) mobileBtn.classList.toggle('loading', isLoading);
    if (hint) {
        hint.textContent = hintText;
        hint.classList.toggle('show', isLoading);
    }
    btn.title = isLoading ? hintText : (audioPlayer.paused ? 'Воспроизвести' : 'Пауза');
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
    setPlayerLoading(true, "Восстановление воспроизведения...");
    
    const savedIdx = parseInt(localStorage.getItem('fm_working_stream_' + FMUse.generateCodeName(currentPlayingStation)));
    if (!isNaN(savedIdx) && savedIdx >= 0) {
        const streamData = stationStreamMap[FMUse.generateCodeName(currentPlayingStation)];
        if (streamData && savedIdx < streamData.streams.length) {
            currentStreamIndex = savedIdx;
        }
    }
    
    const result = await attemptPlay(currentPlayingStation, currentStreamIndex);
    
    if (isRestoringPlayback) {
        isRestoringPlayback = false;
        if (result === true) {
            localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(currentPlayingStation), currentStreamIndex);
            updatePlayerUI();
            updateUrl();
        } else if (result === 'blocked') {
            setPlayerLoading(false);
            updatePlayerUI();
            showToast("Нажмите Play для возобновления");
        } else {
            setPlayerLoading(false);
            showToast("Поток недоступен");
            stopPlayer();
        }
    }
}

function attemptPlay(name, streamIndex) {
    return new Promise((resolve) => {
        const streamData = stationStreamMap[FMUse.generateCodeName(name)];
        if (!streamData || !streamData.streams || streamIndex >= streamData.streams.length || streamData.streams[streamIndex].broken) {
            resolve(false); return;
        }
        
        currentPlayingStation = name;
        currentStreamIndex = streamIndex;
        setPlayerLoading(true, "Подключение к потоку...");
        updatePlayerUI();
        
        let url = streamData.streams[streamIndex].url;
        if (!url || url === 'null' || url === 'undefined' || url === '') {
            resolve(false); return;
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
            if (settled) return; 
            if (name !== currentPlayingStation) { settled = true; cleanup(); resolve('aborted'); return; }
            settled = true; 
            cleanup(); 
            initAudioContext();
            updateMediaSession();
            localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(name), streamIndex);
            resolve(true); 
        };
        const onError = () => { 
            if (settled) return; 
            if (name !== currentPlayingStation) { settled = true; cleanup(); resolve('aborted'); return; }
            settled = true; 
            cleanup(); 
            resolve(false); 
        };
        
        playTimeout = setTimeout(() => { 
            if (settled) return; 
            if (name !== currentPlayingStation) { settled = true; cleanup(); resolve('aborted'); return; }
            settled = true; cleanup(); 
            audioPlayer.pause();
            audioPlayer.load(); 
            resolve(false); 
        }, 10000);
        
        audioPlayer.addEventListener('playing', onPlaying);
        audioPlayer.addEventListener('error', onError);
        
        audioPlayer.src = url;
        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => { 
                if (settled) return;
                if (e.name === 'NotAllowedError') {
                    settled = true; cleanup();
                    audioPlayer.pause();
                    audioPlayer.load();
                    resolve('blocked'); 
                } else if (e.name !== 'AbortError') {
                    settled = true; cleanup(); 
                    resolve(false); 
                }
            });
        }
    });
}

async function togglePlay(name) {
    cancelRestorePlayback();
    if (currentPlayingStation === name && !audioPlayer.paused) {
        audioPlayer.pause();
        updatePlayerUI();
        return;
    }
    if (currentPlayingStation === name && audioPlayer.paused && audioPlayer.src && audioPlayer.src !== window.location.href) {
        setPlayerLoading(true, "Возобновление...");
        audioPlayer.play().catch(() => { setPlayerLoading(false); updatePlayerUI(); });
        updatePlayerUI();
        return;
    }
    
    const oldStation = currentPlayingStation;
    const oldStreamIndex = currentStreamIndex;
    
    const streamData = stationStreamMap[FMUse.generateCodeName(name)];
    if (!streamData || !streamData.streams || streamData.streams.length === 0) {
        showToast("Нет потока для этой станции");
        return;
    }
    
    let played = false;
    
    let savedIdx = parseInt(localStorage.getItem('fm_working_stream_' + FMUse.generateCodeName(name)));
    if (!isNaN(savedIdx) && savedIdx < streamData.streams.length && !streamData.streams[savedIdx].broken) {
        played = await attemptPlay(name, savedIdx);
        if (played === 'blocked') played = false;
        else if (!played) streamData.streams[savedIdx].broken = true;
    }
    
    if (!played) {
        let bestBitrate = -1, bestIdx = -1;
        streamData.streams.forEach((s, i) => { if (!s.broken && s.bitrate > bestBitrate) { bestBitrate = s.bitrate; bestIdx = i; } });
        if (bestIdx !== -1) {
            played = await attemptPlay(name, bestIdx);
            if (played === 'blocked') played = false;
            else if (!played) streamData.streams[bestIdx].broken = true;
        }
    }
    
    if (!played) {
        for (let i = 0; i < streamData.streams.length; i++) {
            if (!streamData.streams[i].broken) {
                played = await attemptPlay(name, i);
                if (played === 'blocked') { played = false; break; }
                if (played) break;
                streamData.streams[i].broken = true;
            }
        }
    }
    
    if (played) {
        localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(name), currentStreamIndex);
        updatePlayerUI();
        updateUrl();
    } else {
        streamData.broken = true;
        hideStationButton(name);
        showToast("Станция недоступна");
        updatePlayerUI(); // Обновляем кнопки под шкалой
        
        if (oldStation) {
            currentPlayingStation = oldStation;
            currentStreamIndex = oldStreamIndex;
            await attemptPlay(oldStation, oldStreamIndex);
            updatePlayerUI();
        } else {
            stopPlayer();
        }
    }
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
    
    for (let i = 0; i < streamData.streams.length; i++) {
        if (!streamData.streams[i].broken) {
            played = await attemptPlay(st.name, i);
            if (played === true || played === 'blocked' || played === 'aborted') return played;
            streamData.streams[i].broken = true;
        }
    }
    return false;
}

async function skipStation(dir) {
    cancelRestorePlayback();
    audioPlayer.pause();
    audioPlayer.load();
    
    if (state.stations.length === 0) {
        showToast("Нет доступных станций с потоками");
        stopPlayer();
        renderStations(); 
        return;
    }

    // Обязательно сортируем станции по частоте, чтобы перемотка шла строго по шкале!
    const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);

    // Ищем индекс текущей станции в полном списке, а не в отфильтрованном
    let currentIdx = sorted.findIndex(st => st.name === currentPlayingStation);
    if (currentIdx === -1) {
        // Если станция не найдена, начинаем с начала (или конца) списка
        currentIdx = dir === 1 ? -1 : sorted.length;
    }

    let nextIdx = currentIdx;

    for (let i = 0; i < sorted.length; i++) {
        nextIdx += dir;
        if (nextIdx < 0) nextIdx = sorted.length - 1;
        if (nextIdx >= sorted.length) nextIdx = 0;

        const st = sorted[nextIdx];
        const streamData = stationStreamMap[FMUse.generateCodeName(st.name)];
        if (!streamData || !streamData.streams || streamData.broken) continue;

        // Пропускаем станции, помеченные как мусор
        if (state.settingsMode || state.viewMode === 'player') {
            const stationData = getStationData(st.name);
            if (stationData.type === 'trash') continue;
        }

        const result = await tryPlayStation(st);
        
        if (result === true) {
            localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(st.name), currentStreamIndex);
            updatePlayerUI();
            updateUrl();
            return;
        } else if (result === 'blocked' || result === 'aborted') {
            break; // Прерываем перемотку, если браузер заблокировал автовоспроизведение
        } else {
            streamData.broken = true;
            hideStationButton(st.name);
            if (typeof renderDialControls === 'function') renderDialControls();
        }
    }
    
    showToast("Рабочие потоки не найдены");
    stopPlayer();
    renderStations(); 
}

function stopPlayer() {
    cancelRestorePlayback();
    audioPlayer.pause();
    audioPlayer.src = '';
    currentPlayingStation = null;
    updatePlayerUI();
    updateUrl();
}

function initAudioContext() {
    if (audioContext && audioContext.state !== 'closed') {
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }
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
        
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }
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
    
    if (spectrumCanvas.offsetWidth > 0) {
        spectrumCanvas.width = spectrumCanvas.offsetWidth;
    }
    if (spectrumCanvas.offsetHeight > 0) {
        spectrumCanvas.height = spectrumCanvas.offsetHeight;
    }
    
    const w = spectrumCanvas.width;
    const h = spectrumCanvas.height;
    
    if (w === 0 || h === 0) {
        requestAnimationFrame(drawSpectrum);
        return;
    }
    
    spectrumCtx.clearRect(0, 0, w, h);
    
    if (analyser && !audioPlayer.paused && currentPlayingStation) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        const barWidth = w / bufferLength;
        let x = 0;
        
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00d4ff';
        spectrumCtx.shadowBlur = 4;
        spectrumCtx.shadowColor = accentColor;
        
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * h * 0.95;
            const bw = Math.max(1, barWidth - 2);
            
            const grad = spectrumCtx.createLinearGradient(0, h, 0, h - barHeight);
            grad.addColorStop(0, accentColor);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            spectrumCtx.fillStyle = grad;
            
            spectrumCtx.beginPath();
            if (spectrumCtx.roundRect) {
               spectrumCtx.roundRect(x, h - barHeight, bw, barHeight, [2, 2, 0, 0]);
            } else {
               spectrumCtx.rect(x, h - barHeight, bw, barHeight);
            }
            spectrumCtx.fill();
            x += barWidth;
        }
    }
    requestAnimationFrame(drawSpectrum);
}

function updateMediaSession() {
    if (!('mediaSession' in navigator) || !currentPlayingStation) return;
    
    const streamData = stationStreamMap[FMUse.generateCodeName(currentPlayingStation)];
    if (!streamData) return;

    let infoStr = state.city;
    if (streamData.streams && streamData.streams[currentStreamIndex]) {
        const stream = streamData.streams[currentStreamIndex];
        const infoParts = [];
        if (streamData.streams.length > 1) infoParts.push(`Поток ${currentStreamIndex + 1}/${streamData.streams.length}`);
        if (stream.bitrate) infoParts.push(`${stream.bitrate}k`);
        if (stream.codec) infoParts.push(stream.codec.toUpperCase());
        if (infoParts.length > 0) infoStr += ` • ${infoParts.join(' ')}`;
    }

    const artwork = streamData.favicon ? [
        { src: streamData.favicon, sizes: '96x96', type: 'image/png' },
        { src: streamData.favicon, sizes: '256x256', type: 'image/png' },
        { src: streamData.favicon, sizes: '512x512', type: 'image/png' }
    ] : [
        { src: 'img/logo_100.png', sizes: '96x96', type: 'image/png' },
        { src: 'img/logo_100.png', sizes: '256x256', type: 'image/png' }
    ];

    navigator.mediaSession.metadata = new MediaMetadata({
        title: currentPlayingStation,
        artist: infoStr,
        album: 'AutoFMShift',
        artwork: artwork
    });
    
    navigator.mediaSession.playbackState = audioPlayer.paused ? "paused" : "playing";
}

function updatePlayerUI() {
    localStorage.setItem('fm_player_playing', (!audioPlayer.paused && currentPlayingStation) ? currentPlayingStation : '');
    const playerPanel = document.getElementById('playerPanel');
    const mobileControls = document.getElementById('mobilePlayerControls');
    const mobilePlayBtn = document.getElementById('mobilePlayBtn');
    const playerPlayBtn = document.getElementById('playerPlayBtn');
    const playerLogo = document.getElementById('playerLogo');
    const playerName = document.getElementById('playerName');
    const playerStreamInfo = document.getElementById('playerStreamInfo');

    if (currentPlayingStation) {
        const streamData = stationStreamMap[FMUse.generateCodeName(currentPlayingStation)];
        if (streamData) {
            playerPanel.style.display = 'flex';
            if (mobileControls) mobileControls.classList.add('show');
            
            const logoBtn = document.getElementById('logoBtn');
            const originalLogo = "img/logo_100.png";
            
            const currentStream = streamData.streams[currentStreamIndex];
            const currentFav = (currentStream && currentStream.favicon && currentStream.favicon !== 'null' && currentStream.favicon !== 'undefined') 
                ? currentStream.favicon 
                : (streamData.favicon && streamData.favicon !== 'null' && streamData.favicon !== 'undefined' ? streamData.favicon : null);
                
                const headerFreq = document.getElementById('headerFreq');
                const st = state.stations.find(s => s.name === currentPlayingStation);
                if (st) {
                    const isShiftedView = state.dialFreqView === 'shifted';
                    const displayFreq = isShiftedView ? calcShiftedFreq(st.freq) : st.freq;                    headerFreq.textContent = formatFreq(displayFreq);
                    headerFreq.style.display = 'flex';
                    // Убраны настройки opacity и background, теперь всегда только яркие цифры
                    if (currentFav) {
                        const img = new Image();
                        img.onload = () => {
                            logoBtn.style.backgroundImage = `url('${currentFav}')`;
                            playerLogo.style.display = 'none'; 
                        };
                        img.onerror = () => {
                            logoBtn.style.backgroundImage = `url('${originalLogo}')`;
                            playerLogo.style.display = 'none';
                        };
                        img.src = currentFav;
                    } else {
                        logoBtn.style.backgroundImage = `url('${originalLogo}')`;
                        playerLogo.style.display = 'none';
                    }
                } else {
                    if (headerFreq) headerFreq.style.display = 'none';
                }

            playerName.textContent = currentPlayingStation;
            playerName.href = streamData.homepage || '#';
            
            if (playerName.offsetWidth < playerName.scrollWidth) {
                playerName.title = currentPlayingStation;
            } else {
                playerName.removeAttribute('title');
            }
            
            if (streamData.streams && streamData.streams[currentStreamIndex]) {
                const stream = streamData.streams[currentStreamIndex];
                const genres = (currentStream && currentStream.tags) ? currentStream.tags : (streamData.tags || "");
                
                const parts = [];
                const titleParts = [`Поток ${currentStreamIndex + 1}/${streamData.streams.length}`];
                
                if (streamData.streams.length > 1) parts.push(`${currentStreamIndex + 1}/${streamData.streams.length}`);
                if (stream.bitrate) {
                    parts.push(`${stream.bitrate}k`);
                    titleParts.push(`${stream.bitrate}k`);
                }
                if (stream.codec) {
                    parts.push(stream.codec.toUpperCase());
                    titleParts.push(stream.codec.toUpperCase());
                }
                if (genres) {
                    parts.push(genres);
                    titleParts.push(genres);
                }
                
                playerStreamInfo.textContent = parts.join(' • ');
                playerStreamInfo.title = titleParts.join(' • ');
                
                if (streamData.streams.length > 1) {
                    playerStreamInfo.classList.add('active-link');
                    playerStreamInfo.setAttribute('href', '#');
                } else {
                    playerStreamInfo.classList.remove('active-link');
                    playerStreamInfo.removeAttribute('href');
                }
            }
            
            const playIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            const pauseIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
            playerPlayBtn.innerHTML = audioPlayer.paused ? playIcon : pauseIcon;
            if (mobilePlayBtn) mobilePlayBtn.innerHTML = audioPlayer.paused ? playIcon : pauseIcon;
            playerPlayBtn.title = audioPlayer.paused ? 'Воспроизвести' : 'Пауза';
            
            updateMediaSession();
        }
    } else {
        playerPanel.style.display = 'none';
        if (mobileControls) mobileControls.classList.remove('show');
        document.getElementById('logoBtn').style.backgroundImage = `url('img/logo_100.png')`;
        const headerFreq = document.getElementById('headerFreq');
        if (headerFreq) headerFreq.style.display = 'none';
    }

    if (currentPlayingStation && !audioPlayer.paused) {
        if (!titleRotationInterval || titleRotationStation !== currentPlayingStation) {
            if (titleRotationInterval) clearInterval(titleRotationInterval);
            titleRotationStation = currentPlayingStation;
            let titleStr = `AutoFMShift ▶ ${currentPlayingStation} • • • `;
            titleRotationInterval = setInterval(() => {
                titleStr = titleStr.substring(1) + titleStr.charAt(0);
                document.title = titleStr;
            }, 350);
        }
    } else {
        if (titleRotationInterval) {
            clearInterval(titleRotationInterval);
            titleRotationInterval = null;
        }
        document.title = 'AutoFMShift';
    }

    document.querySelectorAll('.station-item').forEach(item => {
        const btn = item.querySelector('.play-btn-row');
        if (!btn) return;
        const itemName = btn.dataset.name;
        if (itemName === currentPlayingStation) {
            btn.classList.add('active');
            btn.innerHTML = audioPlayer.paused 
                ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' 
                : '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        }
    });

    if (typeof renderDialControls === 'function') {
        renderDialControls();
    }
}