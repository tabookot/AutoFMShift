// app.js
async function init() {
    const cacheVer = localStorage.getItem('fm_cache_version');
    if (cacheVer === null) localStorage.setItem('fm_cache_version', CACHE_VERSION);
    else if (cacheVer !== CACHE_VERSION) {
      document.getElementById('cacheModal').classList.add('show');
      return;
    }
  
    initTheme();
    await loadCyrillicFont();
    document.getElementById('appVersion').textContent = 'v' + VERSION;
    document.getElementById('logoBtn').title = `AutoFMShift v${VERSION}`;
  
    TEMPLATES.forEach((t) => {
      const i = document.createElement('div');
      i.className = 'dropdown-item';
      i.textContent = t.name;
      i.onclick = () => {
        state.template = t.name;
        state.templateShort = t.short;
        state.min = t.range[0];
        state.max = t.range[1];
        state.shift = 0;
        commitState();
        render();
        document.getElementById('templatesMenu').classList.remove('show');
      };
      document.getElementById('templatesMenu').appendChild(i);
    });
    
    document.getElementById('stationsList').addEventListener('click', (e) => {
      const ic = e.target.closest('.status-icon');
      const bt = e.target.closest('.preset-btn');
      if (ic) {
        e.stopPropagation();
        cycleStationStatus(ic.dataset.name);
      } else if (bt) {
        e.stopPropagation();
        openPresetMenu(bt, bt.dataset.name);
      }
    });
  
    const hT = document.getElementById('hoverTrigger');
    const bB = document.getElementById('bgBandit');
    if (hT && bB) {
      const sBg = () => bB.classList.add('hovered');
      const hBg = () => bB.classList.remove('hovered');
      hT.addEventListener('mouseenter', sBg);
      hT.addEventListener('mouseleave', hBg);
      hT.addEventListener('touchstart', (e) => {
        e.preventDefault();
        sBg();
      }, { passive: false });
      hT.addEventListener('touchend', hBg);
      hT.addEventListener('touchcancel', hBg);
    }
  
    document.getElementById('downloadBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('downloadMenu').classList.toggle('show');
      document.getElementById('templatesMenu').classList.remove('show');
    });
    document.querySelectorAll('#downloadMenu .dropdown-item').forEach((i) =>
      i.addEventListener('click', (e) => {
        const f = e.target.getAttribute('data-format');
        if (f === 'png') exportPNG();
        if (f === 'pdf') exportPDF();
        if (f === 'xlsx') exportXLSX();
        if (f === 'json') openExportModal();
        document.getElementById('downloadMenu').classList.remove('show');
      })
    );
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', handleFileImport);
    document.getElementById('toggleAllExportBtn').addEventListener('click', () => {
      const cb = document.querySelectorAll('#exportCityList input[type="checkbox"]');
      const bt = document.getElementById('toggleAllExportBtn');
      const ac = Array.from(cb).every((c) => c.checked);
      cb.forEach((c) => (c.checked = !ac));
      bt.textContent = ac ? 'Выделить все' : 'Снять все';
    });
    document.getElementById('apiBackupBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      if (Object.keys(citiesMap).length === 0) return showToast('Список городов пуст');
      if (!confirm('Сформировать бэкап API?')) return;
      const m = document.getElementById('loadingModal');
      const lT = document.getElementById('loadingText');
      let isC = false;
      document.getElementById('cancelLoadingBtn').onclick = () => (isC = true);
      m.classList.add('show');
      lT.textContent = 'Сбор городов...';
      try {
        const d = await Api.generateApiBackup(citiesMap, VERSION, () => isC);
        const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
        const dt = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        downloadBlob(b, `backup-api_${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}_${pad(dt.getHours())}-${pad(dt.getMinutes())}.json`);
        showToast('Бэкап сформирован');
      } catch (er) {
        showToast(er.message === 'Canceled' ? 'Отменено' : 'Ошибка');
      } finally {
        m.classList.remove('show');
      }
    });
    document.getElementById('closeExportBtn').addEventListener('click', () => document.getElementById('exportModal').classList.remove('show'));
    document.getElementById('cancelExportBtn').addEventListener('click', () => document.getElementById('exportModal').classList.remove('show'));
    document.getElementById('doExportBtn').addEventListener('click', doExport);
  
    document.getElementById('modeBtn').addEventListener('click', toggleViewMode);
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
      document.getElementById('resetMenu').classList.toggle('show');
      document.getElementById('downloadMenu').classList.remove('show');
      document.getElementById('menuDropdown').classList.remove('show');
    });
    document.querySelectorAll('#resetMenu .dropdown-item').forEach((i) =>
      i.addEventListener('click', (e) => {
        const t = e.target.getAttribute('data-reset');
        if (t === 'all') {
          if (confirm('Полный сброс?')) resetAll();
        } else if (t === 'city') {
          if (confirm('Сбросить станции для текущего города?')) resetCurrentCity();
        }
        document.getElementById('resetMenu').classList.remove('show');
      })
    );
    document.getElementById('menuBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const m = document.getElementById('menuDropdown');
      if (!m.classList.contains('show')) {
        const iD = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
        const iS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
        const iT = '<span style="display:inline-block; width:14px; text-align:center; margin-right:8px;">☾</span>';
        const iH = '<span style="display:inline-block; width:14px; text-align:center; margin-right:8px; font-weight:bold;">?</span>';
        const iM = state.viewMode === 'player' ? '<span style="display:inline-block; width:14px; text-align:center; margin-right:8px;">⚙️</span>' : '<span style="display:inline-block; width:14px; text-align:center; margin-right:8px;">🎧</span>';
        const tM = state.viewMode === 'player' ? 'Настройка' : 'Плеер';
        m.innerHTML = `<div class="dropdown-item" data-action="download-png">${iD}PNG</div><div class="dropdown-item" data-action="download-pdf">${iD}PDF</div><div class="dropdown-item" data-action="download-xlsx">${iD}XLSX</div><div class="dropdown-item" data-action="download-json">${iD}JSON</div><div class="dropdown-item" data-action="share">${iS}Поделиться</div><div class="dropdown-item" data-action="theme">${iT}Тема</div><div class="dropdown-item" data-action="help">${iH}Инструкция</div><div class="dropdown-item" data-action="viewmode">${iM}Режим: ${tM}</div>`;
      }
      m.classList.toggle('show');
      document.getElementById('resetMenu').classList.remove('show');
      document.getElementById('downloadMenu').classList.remove('show');
    });
    document.getElementById('menuDropdown').addEventListener('click', (e) => {
      const i = e.target.closest('.dropdown-item');
      if (!i) return;
      const a = i.dataset.action;
      if (a === 'theme') toggleTheme();
      else if (a === 'help') document.getElementById('helpModal').classList.add('show');
      else if (a === 'download-png') exportPNG();
      else if (a === 'download-pdf') exportPDF();
      else if (a === 'download-xlsx') exportXLSX();
      else if (a === 'download-json') openExportModal();
      else if (a === 'share') copyShareLink();
      else if (a === 'viewmode') toggleViewMode();
      document.getElementById('menuDropdown').classList.remove('show');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.preset-dropdown') && !e.target.closest('.preset-menu') && !e.target.closest('.preset-btn')) closePresetMenu();
      if (!e.target.closest('#templatesBtn') && !e.target.closest('#templatesMenu')) document.getElementById('templatesMenu').classList.remove('show');
      if (!e.target.closest('#downloadBtn') && !e.target.closest('#downloadMenu')) document.getElementById('downloadMenu').classList.remove('show');
      if (!e.target.closest('#citySelect')) document.getElementById('citySelectMenu').classList.remove('show');
      if (!e.target.closest('#resetBtn') && !e.target.closest('#resetMenu')) document.getElementById('resetMenu').classList.remove('show');
      if (!e.target.closest('#menuBtn') && !e.target.closest('#menuDropdown')) document.getElementById('menuDropdown').classList.remove('show');
    });
  
    loadFromLS();
    const hU = loadFromUrl();
    if (state.streamsData) {
      Object.keys(state.streamsData).forEach((c) => {
        if (!stationStreamMap[c]) stationStreamMap[c] = state.streamsData[c];
      });
    }
  
    await loadStationsData();
    applyViewMode();
    if (typeof initDial === 'function') initDial();
    
    const dB = document.getElementById('dialToggleBtn');
    if (dB) {
      dB.addEventListener('click', () => {
        state.dialView = state.dialView === 'full' ? 'narrow' : 'full';
        if (typeof dialAnim !== 'undefined') dialAnim.x = 0;
        render();
      });
    }
    const dFB = document.getElementById('dialFreqToggleBtn');
    if (dFB) {
      dFB.addEventListener('click', () => {
        state.dialFreqView = state.dialFreqView === 'shifted' ? 'orig' : 'shifted';
        if (typeof dialAnim !== 'undefined') dialAnim.x = 0;
        render();
      });
    }
    const dCB = document.getElementById('dialControlsToggleBtn');
    if (dCB) {
      dCB.addEventListener('click', () => {
        const cV = state.dialControlsVisible !== null ? state.dialControlsVisible : state.settingsMode;
        state.dialControlsVisible = !cV;
        commitState();
        render();
      });
    }
  
    audioPlayer = document.getElementById('audioPlayer');
    const savedVol = localStorage.getItem('fm_player_volume');
    audioPlayer.volume = savedVol !== null ? parseFloat(savedVol) : 1;
    initMobilePlayerControls();
    const mVS = document.getElementById('mobileVolumeSlider');
    document.getElementById('logoBtn').onclick = () => window.open('https://github.com/tabookot/AutoFMShift', '_blank', 'noopener');
    const vS = document.getElementById('volumeSlider');
    vS.value = audioPlayer.volume;
    window.updateVolume = (val) => {
      val = Math.max(0, Math.min(1, val));
      vS.value = val;
      if (mVS) mVS.value = val;
      audioPlayer.volume = val;
      localStorage.setItem('fm_player_volume', val);
      const p = Math.round(val * 100);
      vS.style.background = `linear-gradient(to top, var(--accent) ${p}%, var(--border) ${p}%)`;
      if (mVS) {
        mVS.style.background = `linear-gradient(to right, var(--accent) ${p}%, var(--border) ${p}%)`;
        mVS.title = `Громкость: ${p}%`;
      }
      vS.title = `Громкость: ${p}%`;
      if (typeof window.updateDialKnob === 'function') window.updateDialKnob();
    };
    updateVolume(audioPlayer.volume);
    vS.addEventListener('input', (e) => updateVolume(parseFloat(e.target.value)));
    if (mVS) {
      mVS.addEventListener('input', (e) => updateVolume(parseFloat(e.target.value)));
      mVS.addEventListener('wheel', (e) => {
        e.preventDefault();
        let v = parseFloat(mVS.value);
        if (e.deltaY < 0) v += 0.02;
        else v -= 0.02;
        updateVolume(v);
      }, { passive: false });
    }
    document.getElementById('playerPanel').addEventListener('wheel', (e) => {
      e.preventDefault();
      let v = parseFloat(vS.value);
      if (e.deltaY < 0) v += 0.02;
      else v -= 0.02;
      updateVolume(v);
    }, { passive: false });
    let vTY = null;
    vS.addEventListener('touchstart', (e) => (vTY = e.touches[0].clientY), { passive: true });
    vS.addEventListener('touchmove', (e) => {
      if (vTY === null) return;
      e.preventDefault();
      const cY = e.touches[0].clientY;
      const dY = vTY - cY;
      let v = parseFloat(vS.value) + dY / 100;
      updateVolume(v);
      vTY = cY;
    }, { passive: false });
    spectrumCanvas = document.getElementById('spectrumCanvas');
    spectrumCtx = spectrumCanvas.getContext('2d');
    drawSpectrum();
  
    const hP = new URLSearchParams(location.hash.slice(1));
    const isS = hP.get('shared') === '1';
    if (isS) {
      hP.delete('shared');
      history.replaceState(null, '', `#${hP.toString()}`);
    }
    const pN = hP.get('play');
    const sI = hP.get('stream');
    let sR = false;
    if (pN) {
      const dN = decodeURIComponent(pN);
      const sd = stationStreamMap[FMUse.generateCodeName(dN)];
      if (sd && sd.streams && sd.streams.length > 0) {
        let i = sI !== null ? parseInt(sI) : 0;
        if (isNaN(i) || i >= sd.streams.length) i = 0;
        currentPlayingStation = dN;
        currentStreamIndex = i;
        if (!isS && localStorage.getItem('fm_player_playing') === currentPlayingStation) sR = true;
        updatePlayerUI();
      }
    } else {
      localStorage.removeItem('fm_player_playing');
    }
  
    audioPlayer.addEventListener('playing', () => {
      setPlayerLoading(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      updatePlayerUI();
    });
    audioPlayer.addEventListener('waiting', () => {
      setPlayerLoading(true);
      updatePlayerUI();
    });
    audioPlayer.addEventListener('pause', () => {
      setPlayerLoading(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      updatePlayerUI();
    });
    document.getElementById('playerPlayBtn').addEventListener('click', () => {
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
            setPlayerLoading(true);
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
    });
    document.getElementById('playerStopBtn').addEventListener('click', () => {
      stopPlayer();
      renderStations();
    });
    document.getElementById('playerPrevBtn').addEventListener('click', () => skipStation(-1));
    document.getElementById('playerNextBtn').addEventListener('click', () => skipStation(1));
    document.getElementById('playerStreamInfo').addEventListener('click', async (e) => {
      e.preventDefault();
      if (isSwitchingStream || !currentPlayingStation) return;
      cancelRestorePlayback();
      isSwitchingStream = true;
      const sd = stationStreamMap[FMUse.generateCodeName(currentPlayingStation)];
      if (sd && sd.streams && sd.streams.length > 1) {
        const oI = currentStreamIndex;
        let a = 0;
        let f = false;
        while (a < sd.streams.length) {
          currentStreamIndex = (currentStreamIndex + 1) % sd.streams.length;
          if (sd.streams[currentStreamIndex].broken) {
            a++;
            continue;
          }
          const p = await attemptPlay(currentPlayingStation, currentStreamIndex);
          if (p === true) {
            localStorage.setItem('fm_working_stream_' + FMUse.generateCodeName(currentPlayingStation), currentStreamIndex);
            updatePlayerUI();
            updateUrl();
            f = true;
            break;
          } else {
            sd.streams[currentStreamIndex].broken = true;
          }
          a++;
        }
        if (!f) {
          showToast('Другие потоки недоступны');
          currentStreamIndex = oI;
          await attemptPlay(currentPlayingStation, oI);
          updatePlayerUI();
        }
      }
      isSwitchingStream = false;
    });
    document.getElementById('playerName').addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (currentPlayingStation) showToast(currentPlayingStation);
    }, { passive: false });
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        if (currentPlayingStation && audioPlayer.paused) {
          setPlayerLoading(true);
          audioPlayer.load();
          audioPlayer.play().catch(() => {
            setPlayerLoading(false);
            updatePlayerUI();
          });
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => audioPlayer.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => skipStation(-1));
      navigator.mediaSession.setActionHandler('nexttrack', () => skipStation(1));
      navigator.mediaSession.setActionHandler('stop', () => {
        stopPlayer();
        renderStations();
      });
      // Фикс для iOS/Safari: он игнорирует previoustrack/nexttrack для live-стримов,
      // превращая их в кнопки перемотки на 15с. Вешаем переключение станций на них.
      try { navigator.mediaSession.setActionHandler('seekbackward', () => skipStation(-1)); } catch (e) {}
      try { navigator.mediaSession.setActionHandler('seekforward', () => skipStation(1)); } catch (e) {}
      try { navigator.mediaSession.setActionHandler('seekto', null); } catch (e) {}
    }
  
    const h = await Api.fetchPage(Api.MAIN_PAGE);
    if (h) {
      const nC = Api.parseCities(h);
      if (Object.keys(nC).length > 0) {
        citiesMap = nC;
        localStorage.setItem('fm_cities_map', JSON.stringify(citiesMap));
      }
    } else {
      try {
        const r = await fetch('data/backup-api.json');
        if (r.ok) {
          const d = await r.json();
          if (d.type === 'api-cache') {
            window.apiBackupData = d;
            Object.keys(d.cities).forEach((s) => {
              const c = d.cities[s].name || s;
              if (!citiesMap[c]) citiesMap[c] = c;
            });
            localStorage.setItem('fm_cities_map', JSON.stringify(citiesMap));
            showToast('API недоступен. Загружен резервный кэш');
          }
        }
      } catch (e) {}
      if (Object.keys(citiesMap).length === 0 && Object.keys(state.cityData).length === 0) {
        document.getElementById('errorMsg').style.display = 'block';
        document.getElementById('errorMsg').innerHTML = 'Сайт недоступен.<br><button id="importFallbackBtn" class="btn-text">Импорт JSON</button>';
        document.getElementById('importFallbackBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
        return;
      }
    }
    renderCitySelectMenu();
    document.getElementById('citySelectTrigger').onclick = (e) => {
      e.stopPropagation();
      document.getElementById('citySelectMenu').classList.toggle('show');
      const a = document.getElementById('citySelectMenu').querySelector('.active');
      if (a) a.scrollIntoView({ block: 'center' });
    };
    if (!citiesMap[state.city]) state.city = DEFAULT_STATE.city;
    await loadCity(state.city);
    render();
    updateUrl();
    if (sR) restorePlayback();
    if (!hU && !localStorage.getItem('geo_checked')) checkGeo(false);
  }
  
  function toggleSettings() {
    state.settingsMode = !state.settingsMode;
    commitState();
    applySettingsMode();
    render();
  }
  
  function applySettingsMode() {
    const isP = state.viewMode === 'player';
    const sS = state.settingsMode || isP;
    const d = state.settingsMode ? 'block' : 'none';
    document.getElementById('bands').style.display = d;
    document.getElementById('presets').style.display = d;
    document.getElementById('statusHeader').style.display = sS ? 'block' : 'none';
    const sB = document.getElementById('settingsBtn');
    sB.classList.toggle('active', state.settingsMode);
    sB.setAttribute('aria-pressed', state.settingsMode ? 'true' : 'false');
  }
  
  function toggleViewMode() {
    state.viewMode = state.viewMode === 'player' ? 'setup' : 'player';
    commitState();
    applyViewMode();
    render();
  }
  
  function applyViewMode() {
    document.body.classList.toggle('player-mode', state.viewMode === 'player');
    const mB = document.getElementById('modeBtn');
    if (state.viewMode === 'player') {
      mB.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
      mB.title = 'Перейти в режим: Настройка';
    } else {
      mB.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>';
      mB.title = 'Перейти в режим: Плеер';
    }
    applySettingsMode();
  }
  
  async function loadCity(city) {
    if (!citiesMap[city] && !state.cityData[city]?.allStations) return;
    state.city = city;
    Object.values(stationStreamMap).forEach((d) => {
      d.broken = false;
      if (d.streams) d.streams.forEach((s) => (s.broken = false));
    });
    state.stations = [];
    const l = document.getElementById('stationsList');
    l.innerHTML = '<div class="loading-msg">Загрузка станций...</div>';
    render();
    const h = await Api.fetchPage(citiesMap[city]);
    let nS = [];
    let src = 'cache';
    if (h) {
      nS = Api.parseStations(h);
      src = 'api';
      lastDataSource = 'api';
      if (nS.length === 0) {
        showToast('Ошибка парсинга.');
        nS = [];
      }
    } else if (window.apiBackupData && window.apiBackupData.cities[FMUse.generateCodeName(city)]) {
      nS = window.apiBackupData.cities[FMUse.generateCodeName(city)].stations.filter((s) => !s.isDeleted).map((s) => ({ name: s.name, freq: s.freq }));
      src = 'backup';
      if (lastDataSource !== 'backup') {
        showToast('Нет сети. Используем backup-api.json');
        lastDataSource = 'backup';
      }
    } else if (state.cityData[city]?.allStations) {
      nS = state.cityData[city].allStations;
      src = 'cache';
      if (lastDataSource !== 'cache') {
        showToast('Нет сети. Используем кэш станций.');
        lastDataSource = 'cache';
      }
    } else {
      if (lastDataSource !== 'none') {
        showToast('Сеть недоступна.');
        lastDataSource = 'none';
      }
    }
    if (nS.length > 0) {
      state.stations = nS;
      state.stationsSource = src;
      if (!state.cityData[city]) state.cityData[city] = { stations: {} };
      state.cityData[city].allStations = nS.map((s) => ({ name: s.name, freq: s.freq }));
      state.cityData[city].totalStations = state.stations.length;
      const ls = localStorage.getItem(LS_KEY);
      let cS = {};
      if (ls) {
        try {
          const p = JSON.parse(ls);
          if (p.cityData && p.cityData[city]) cS = p.cityData[city].stations || {};
        } catch {}
      }
      const sK = Object.keys(cS);
      if (sK.length > 0) {
        const sc = FMUse.evaluateSync(sK.map((n) => ({ name: n })), nS);
        if (sc >= 3) {
          const m = FMUse.matchArrays(sK, nS.map((s) => s.name));
          let sS = {};
          m.forEach((mt) => {
            const oD = cS[mt.source];
            if (oD && (oD.type !== 'normal' || oD.presetIndex)) sS[mt.target] = { ...oD };
          });
          state.cityData[city].stations = sS;
          if (sc === 4) showToast('Данные обновлены, настройки перенесены.');
        } else {
          state.cityData[city].stations = cS;
          showToast(`Данные API изменились (балл ${sc}). Настройки сохранены.`);
        }
      } else {
        state.cityData[city].stations = {};
      }
      updateCityStats(city);
      commitState();
      render();
    } else {
      l.innerHTML = '<div class="loading-msg">Нет данных</div>';
    }
  }
  
  async function checkGeo(isM = false) {
    const hU = location.hash.includes('city=');
    try {
      const r = await fetch('https://get.geojs.io/v1/ip/geo.json');
      if (!r.ok) throw new Error();
      const d = await r.json();
      const la = parseFloat(d.latitude);
      const lo = parseFloat(d.longitude);
      if (!isNaN(la) && !isNaN(lo) && typeof CITY_CENTERS !== 'undefined') {
        let cC = null;
        let mD = Infinity;
        CITY_CENTERS.forEach((c) => {
          const ds = FMUse.getDistance(la, lo, c.lat, c.lon);
          if (ds < mD) {
            mD = ds;
            cC = c;
          }
        });
        if (cC) {
          if (mD <= 50) {
            if (citiesMap[cC.name]) {
              if (isM || !hU) {
                state.city = cC.name;
                await loadCity(state.city);
                showToast(`Автоопределение: ${cC.name} (${Math.round(mD)} км)`);
              }
            } else {
              showToast(`Автоопределение: ${cC.name} нет в базе`);
            }
          } else {
            showToast('Автоопределение: город слишком далеко');
          }
        } else {
          showToast('Автоопределение: координаты не получены');
        }
      }
    } catch (e) {
      showToast('Автоопределение: ошибка сети');
    }
    localStorage.setItem('geo_checked', '1');
  }
  
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }
  
  async function copyShareLink() {
    let u = window.location.href.replace(/&shared=1|#shared=1/, '');
    u += (location.hash ? '&' : '#') + 'shared=1';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(u);
        showToast('Ссылка скопирована');
      } catch {
        fC(u);
      }
    } else {
      fC(u);
    }
  }
  
  function fC(t) {
    const tA = document.createElement('textarea');
    tA.value = t;
    tA.style.top = '-9999px';
    tA.style.left = '-9999px';
    tA.style.position = 'fixed';
    document.body.appendChild(tA);
    tA.focus();
    tA.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(tA);
      showToast('Скопировано');
    } catch {
      document.body.removeChild(tA);
      prompt('Скопируйте:', t);
    }
  }
  
  function setupWheelInput(id, min, max, step, stateProp) {
    const el = document.getElementById(id);
    el.setAttribute('min', min);
    el.setAttribute('max', max);
    const uS = (val, fC = false) => {
      if (isNaN(val)) return false;
      if (fC) val = Math.max(min, Math.min(max, val));
      val = Math.round(val * 100) / 100;
      if (stateProp === 'min' || stateProp === 'max') {
        if (stateProp === 'min') state.min = val;
        else state.max = val;
        const m = TEMPLATES.find((t) => t.range[0] === state.min && t.range[1] === state.max);
        state.template = m ? m.name : 'Свой вариант';
        state.templateShort = m ? m.short : 'свой';
      } else {
        val = Math.round(val);
        if (state[stateProp] === val) return false;
        state[stateProp] = val;
      }
      return true;
    };
    el.addEventListener('input', (e) => {
      if (e.target.value === '' || isNaN(parseFloat(e.target.value))) return;
      if (uS(parseFloat(e.target.value), false)) {
        saveState();
        render();
      }
    });
    el.addEventListener('blur', () => {
      let v = parseFloat(el.value);
      if (isNaN(v)) v = min;
      uS(v, true);
      el.value = state[stateProp];
      commitState();
      render();
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      let v = parseFloat(el.value) || min;
      if (e.deltaY < 0) v += step;
      else v -= step;
      if (uS(v, true)) {
        el.value = Math.max(min, Math.min(max, Math.round(v * 100) / 100));
        saveState();
        render();
      }
    }, { passive: false });
    let tSY = null;
    let tSV = null;
    el.addEventListener('touchstart', (e) => {
      tSY = e.touches[0].clientY;
      tSV = parseFloat(el.value) || min;
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (tSY === null) return;
      e.preventDefault();
      const cY = e.touches[0].clientY;
      const dY = tSY - cY;
      const s = Math.round(dY / 15);
      let nV = tSV + s * step;
      if (uS(nV, true)) el.value = Math.max(min, Math.min(max, Math.round(nV * 100) / 100));
    }, { passive: false });
    el.addEventListener('touchend', () => {
      if (tSY !== null) {
        commitState();
        render();
      }
      tSY = null;
    });
  }
  
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
  document.getElementById('templatesBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('templatesMenu').classList.toggle('show');
    document.getElementById('downloadMenu').classList.remove('show');
  });
  document.getElementById('cacheResetBtn').addEventListener('click', () => {
    ['fm_adapter_calc', 'fm_adapter_calc_v2', 'fm_adapter_calc_v3', 'fm_adapter_calc_v4', 'fm_adapter_calc_v5', 'fm_adapter_calc_v6', 'fm_adapter_calc_v7', 'fm_adapter_calc_v8', 'fm_adapter_calc_v9', LS_KEY, LS_THEME_KEY, 'geo_checked', 'fm_cities_map'].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('fm_cache_version', CACHE_VERSION);
    window.location.reload();
  });
  setupWheelInput('minFreq', 64, 110, 0.1, 'min');
  setupWheelInput('maxFreq', 64, 110, 0.1, 'max');
  setupWheelInput('bands', 1, 5, 1, 'bands');
  setupWheelInput('presets', 1, 18, 1, 'presets');
  document.getElementById('shareBtn').addEventListener('click', copyShareLink);
  document.getElementById('geoBtn').addEventListener('click', () => checkGeo(true));
  document.getElementById('helpBtn').addEventListener('click', () => document.getElementById('helpModal').classList.add('show'));
  document.getElementById('closeHelpBtn').addEventListener('click', () => document.getElementById('helpModal').classList.remove('show'));
  document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target.id === 'helpModal') e.target.classList.remove('show');
  });
  init();