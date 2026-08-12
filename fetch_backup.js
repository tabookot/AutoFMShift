let fs;
if (typeof require !== 'undefined') {
    fs = require('fs');
    const FMUse = require('./fmuse.js');
    global.FMUse = FMUse; 
    const Api = require('./api.js');
    global.Api = Api;
}

// --- ПОРОГИ СРАВНЕНИЯ И ГРУППИРОВКИ ДАННЫХ API FANDOM ---
// Отвечает за определение переименования города в compareData и mergeData (если score > порога, считаем что это переименование, а не удаление).
const SCORE_THRESHOLD_CITY_RENAME = 0.65; // 0.65 рекомендуется

// Отвечает за определение переименования станции в compareData и mergeData.
const SCORE_THRESHOLD_STATION_RENAME = 0.65; // 0.65 рекомендуется

// Отвечает за объединение одинаковых станций в одну группу в generateLists (например, "Радио 7" и "Радио 7 на семи холмах" сольются в 1 группу).
const SCORE_THRESHOLD_GROUP_MERGE = 0.65; // 0.65 рекомендуется

// Отвечает за поиск переименования города при слиянии (merge), чтобы не восстановить город как удаленный.
const MERGE_CITY_RENAME_PROB = 0.8; // 0.8 рекомендуется

// ВТОРОЙ ПРОХОД: ОПТИМИЗАЦИЯ ПРИВЯЗКИ ПОТОКОВ
// Буфер для переноса потока. Если другая станция совпадает с именем потока лучше текущей минимум на это значение, поток переносится к ней.
const SCORE_BUFFER_STREAM_MOVE = 0.1; // 0.1 рекомендуется


// --- ПОРОГИ СОВПАДЕНИЯ ДЛЯ RADIO-BROWSER.INFO ---
// Баланс между поиском всех рабочих потоков и защитой от "чужих" станций.
// Очистка имени (normalizeName) превращает "Красноярск FM" в "красноярск".
// Для перегенерации и теста: запустите data/sandbox.html, выполните Шаг 4 и проверьте выдачу.

// Отвечает за выбор ГЛАВНОГО совпадения (bestMatch).
const SCORE_THRESHOLD_MAIN_MATCH = 0.40; // 0.40 рекомендуется

// Отвечает за сбор потоков для ОБЫЧНЫХ станций (например "Вера", "Дорожное Радио").
const SCORE_THRESHOLD_STREAMS = 0.35; // 0.40 рекомендуется

// Отвечает за сбор потоков для СТАНЦИЙ ГРУППЫ РИСКА (содержат название города или слова Радио/FM).
// Алгоритм compareSets("красноярск", "новое радио красноярск") = 1/3 = 0.33.
// Строгий порог 0.60 надежно отсекает такие прилипания, оставляя только прямые совпадения.
const SCORE_THRESHOLD_STREAMS_STRICT = 0.60; // 0.60 рекомендуется

// --- МАГИЧЕСКИЕ ПАРАМЕТРЫ АЛГОРИТМА ЗАЩИТЫ ОТ СБОЕВ API ---
// Рассчитывают, было ли удаление штатным или это сбой парсера/API.
// timeDiff: время между запусками в часах.
// Если данные пропали из API, но timeDiff < GLITCH_THRESHOLD_HOURS, считаем это сбоем и восстанавливаем данные из прошлого бэкапа, помечая как восстановленные.
// Если timeDiff больше, помечаем как isDeleted (в UI не отображаются, но в базе остаются).
const MAGIC_PARAMS = {
    GLITCH_THRESHOLD_HOURS: 72, // 72 (3 дня) рекомендуется
    CITY_DELETE_PROB: 0,        // 0 (города не удаляются) рекомендуется
    STATION_RENAME_PROB: 0.8     // 0.8 рекомендуется
};

async function run() {
    let report = {
        timestamp: new Date().toISOString(),
        status: "success",
        requiresAttention: false,
        attentionReasons: [],
        changes: {
            cities: { new: [], deleted: [], renamed: [] },
            stations: { new: [], deleted: [], renamed: [], frequency_migrated: [] }
        }
    };

    let oldData = null;
    if (fs && fs.existsSync('data/backup-api.json')) {
        try {
            oldData = JSON.parse(fs.readFileSync('data/backup-api.json', 'utf8'));
        } catch (e) {
            console.log("Старый data/backup-api.json поврежден, игнорируем.");
        }
    }

    console.log("Получение списка городов с API...");
    const html = await Api.fetchPage(Api.MAIN_PAGE);
    
    if (!html) {
        report.status = "api_error";
        report.changes = null;
        console.error("Ошибка: API недоступно.");
        saveHistory(null, report);
        return;
    }

    const citiesMap = Api.parseCities(html);
    if (Object.keys(citiesMap).length === 0) {
        report.status = "parse_error";
        report.requiresAttention = true;
        report.attentionReasons.push("Сломан парсинг списка городов (0 городов). Требуется доработка api.js.");
        console.error("Ошибка парсинга городов!");
        saveHistory(null, report);
        await createIssue(report);
        return;
    }

    console.log(`Найдено городов: ${Object.keys(citiesMap).length}. Начинаем сбор станций...`);
    const apiData = await Api.generateApiBackup(citiesMap, "0.5.1-github-action", () => false);
    apiData.exportDate = Date.now();

    // Сливаем старые и новые данные, защищаясь от сбоев
    const mergedData = mergeData(oldData, apiData);

    const listsData = generateLists(mergedData, citiesMap);
    
    let oldEnrichedList = [];
    if (fs && fs.existsSync('data/stations_data.json')) {
        try { oldEnrichedList = JSON.parse(fs.readFileSync('data/stations_data.json', 'utf8')); } catch (e) {}
    }
    const enrichResult = await enrichStationsData(listsData.groups, oldEnrichedList, null, citiesMap);
    
    const compareReport = compareData(oldData, mergedData);
    report = { ...report, ...compareReport };
    report.radioBrowser = {
        new: enrichResult.new,
        changed: enrichResult.changed,
        deleted: enrichResult.deleted,
        changedStations: enrichResult.changedStations
    };
    report.restored = mergedData.restoredLog || [];
    
    if (report.requiresAttention) {
        report.attentionReasons.forEach(r => console.warn(`Внимание: ${r}`));
    }

    if (fs) {
        fs.writeFileSync('data/backup-api.json', JSON.stringify(mergedData, null, 2));
        console.log("Готово! data/backup-api.json обновлен.");
        fs.writeFileSync('data/stations_data.json', JSON.stringify(enrichResult.list, null, 2));
        console.log(`Сохранен data/stations_data.json (${enrichResult.list.length} записей)`);
    }

    saveHistory(null, report);

    if (report.requiresAttention) {
        await createIssue(report);
    }
}

function mergeData(oldData, newData) {
    const restoredLog = [];
    if (!oldData || !oldData.cities) {
        newData.exportDate = Date.now();
        return newData;
    }
    
    const timeDiffHours = oldData.exportDate ? (Date.now() - oldData.exportDate) / 3600000 : 24;
    const finalCities = {};
    
    // Ищем переименованные города, чтобы не восстанавливать старые названия
    const oldCityNames = Object.values(oldData.cities).map(c => c.name);
    const newCityNames = Object.values(newData.cities).map(c => c.name);
    const cityRenames = FMUse.matchArrays(oldCityNames, newCityNames, MERGE_CITY_RENAME_PROB);
    const renamedOldCityNames = new Set(cityRenames.map(r => r.source));
    
    // Обрабатываем города, которые есть в новых данных
    for (const slug in newData.cities) {
        const newCity = newData.cities[slug];
        const oldCity = oldData.cities[slug] || { stations: [] };
        
        const finalStations = [];
        const oldStMap = new Map(oldCity.stations.map(s => [s.name, s]));
        
        // Ищем переименованные станции
        const oldStNames = oldCity.stations.map(s => s.name);
        const newStNames = newCity.stations.map(s => s.name);
        const stRenames = FMUse.matchArrays(oldStNames, newStNames, MAGIC_PARAMS.STATION_RENAME_PROB);
        const renamedOldStNames = new Set(stRenames.map(r => r.source));
        
        for (const newSt of newCity.stations) {
            finalStations.push({ ...newSt, isDeleted: false, deletedAt: null });
        }
        
        // Проверяем пропавшие станции
        for (const oldSt of oldCity.stations) {
            if (!newCity.stations.find(s => s.name === oldSt.name)) {
                if (renamedOldStNames.has(oldSt.name)) continue; // Была переименована
                
                if (timeDiffHours < MAGIC_PARAMS.GLITCH_THRESHOLD_HOURS) {
                    // Сбой! Восстанавливаем
                    finalStations.push({ ...oldSt, isDeleted: false, deletedAt: null });
                    restoredLog.push({ type: 'station', city: newCity.name, name: oldSt.name, reason: 'glitch_protect' });
                } else if (!oldSt.isDeleted) {
                    // Реальное удаление
                    finalStations.push({ ...oldSt, isDeleted: true, deletedAt: Date.now() });
                } else {
                    finalStations.push(oldSt);
                }
            }
        }
        
        // Сортировка станций по алфавиту
        finalStations.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
        finalCities[slug] = { ...newCity, stations: finalStations };
    }
    
    // Проверяем пропавшие города
    for (const slug in oldData.cities) {
        if (!newData.cities[slug]) {
            const oldCity = oldData.cities[slug];
            if (renamedOldCityNames.has(oldCity.name)) continue;
            
            if (MAGIC_PARAMS.CITY_DELETE_PROB === 0 || timeDiffHours < MAGIC_PARAMS.GLITCH_THRESHOLD_HOURS) {
                finalCities[slug] = { ...oldCity, isDeleted: false, deletedAt: null };
                restoredLog.push({ type: 'city', name: oldCity.name, reason: 'glitch_protect' });
            } else if (!oldCity.isDeleted) {
                finalCities[slug] = { ...oldCity, isDeleted: true, deletedAt: Date.now() };
            } else {
                finalCities[slug] = oldCity;
            }
        }
    }
    
    // Сортировка городов по алфавиту (по имени)
    const sortedCities = {};
    Object.keys(finalCities).sort((a, b) => (finalCities[a].name || a).localeCompare(finalCities[b].name || b, 'ru')).forEach(slug => {
        sortedCities[slug] = finalCities[slug];
    });
    
    newData.cities = sortedCities;
    newData.exportDate = Date.now();
    newData.restoredLog = restoredLog;
    return newData;
}

function compareData(oldData, newData) {
    let report = {
        timestamp: new Date().toISOString(),
        status: "success",
        requiresAttention: false,
        attentionReasons: [],
        changes: {
            cities: { new: [], deleted: [], renamed: [] },
            stations: { new: [], deleted: [], renamed: [], frequency_migrated: [] }
        }
    };

    if (!oldData) {
        report.changes.cities.new = Object.values(newData.cities).map(c => c.name);
        return report;
    }

    const oldCities = Object.values(oldData.cities).map(c => c.name);
    const newCities = Object.values(newData.cities).map(c => c.name);

    if (oldCities.length > 0) {
        const cityMatches = FMUse.matchArrays(oldCities, newCities, SCORE_THRESHOLD_CITY_RENAME);
        const matchedOld = new Set();
        const matchedNew = new Set();

        cityMatches.forEach(m => {
            matchedOld.add(m.source);
            matchedNew.add(m.target);
            if (m.score < 0.99) {
                report.changes.cities.renamed.push({ from: m.source, to: m.target, score: m.score });
            }
        });

        oldCities.forEach(c => { if (!matchedOld.has(c)) report.changes.cities.deleted.push(c); });
        newCities.forEach(c => {
            if (!matchedNew.has(c)) {
                report.changes.cities.new.push(c);
                report.requiresAttention = true;
                report.attentionReasons.push(`Новый город: '${c}'. Требуется доработка cities.js для GeoIP.`);
            }
        });
    }

    for (const slug in newData.cities) {
        const newCity = newData.cities[slug];
        let oldCity = oldData.cities[slug];
        if (!oldCity) {
            const renamed = report.changes.cities.renamed.find(r => r.to === newCity.name);
            if (renamed) oldCity = oldData.cities[FMUse.generateCodeName(renamed.from)];
        }

        if (oldCity && oldCity.stations.length > 0) {
            const oldStations = [...new Set(oldCity.stations.map(s => s.name))].filter(n => FMUse.normalizeName(n) !== '');
            const newStations = [...new Set(newCity.stations.map(s => s.name))].filter(n => FMUse.normalizeName(n) !== '');
            
            const stMatches = FMUse.matchArrays(oldStations, newStations, SCORE_THRESHOLD_STATION_RENAME);
            const matchedOldSt = new Set();
            const matchedNewSt = new Set();

            stMatches.forEach(m => {
                matchedOldSt.add(m.source);
                matchedNewSt.add(m.target);
                if (m.score < 0.99) {
                    report.changes.stations.renamed.push({ city: newCity.name, from: m.source, to: m.target, score: m.score });
                } else {
                    const oldFreq = oldCity.stations.find(s => s.name === m.source).freq;
                    const newFreq = newCity.stations.find(s => s.name === m.target).freq;
                    if (oldFreq !== newFreq) {
                        report.changes.stations.frequency_migrated.push({ city: newCity.name, name: m.target, oldFreq: oldFreq, newFreq: newFreq });
                    }
                }
            });

            oldStations.forEach(s => { if (!matchedOldSt.has(s)) report.changes.stations.deleted.push({ city: newCity.name, name: s }); });
            newStations.forEach(s => { if (!matchedNewSt.has(s)) report.changes.stations.new.push({ city: newCity.name, name: s }); });
        }
    }
    return report;
}

function generateLists(data, citiesMap) {
    const cityNames = Object.keys(citiesMap).sort((a, b) => a.localeCompare(b, 'ru'));
    let citiesMd = `# Список городов (${cityNames.length} шт.)\n\n`;
    cityNames.forEach((c, i) => citiesMd += `${i + 1}. ${c}\n`);

    const freqMap = {};
    Object.values(data.cities).forEach(city => {
        if (city.isDeleted) return;
        city.stations.forEach(st => {
            if (st.isDeleted) return;
            
            let name = st.name || "";
            // 1. Заменяем HTML-сущности (&#160;, &nbsp; и т.д.) на обычные пробелы
            name = name.replace(/&#160;|&nbsp;|\u00A0/g, ' ');
            // 2. Разбиваем по переносу строки или слешу и берем первую часть (главное название)
            name = name.split(/[\n\/]/)[0].trim();
            // 3. Удаляем текст в скобках (города, пометки ПЛАН, ТЕСТ)
            name = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
            // 4. Сворачиваем лишние пробелы
            name = name.replace(/\s+/g, ' ').trim();
            
            // 5. Фильтруем мусор (даты, одиночные символы, цифры)
            if (!name) return;
            if (/^[\d\s\.\-—?,]+$/.test(name)) return; // Состоит только из цифр, точек, тире (даты)
            if (name.length < 2) return; // Слишком короткое
            if (name === '?') return;
            
            if (!freqMap[name]) freqMap[name] = 0;
            freqMap[name]++;
        });
    });

    const uniqueStations = Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a]);
    const groups = [];

    for (const stName of uniqueStations) {
        let foundGroup = null;
        for (const group of groups) {
            if (FMUse.compareSets(stName, group.mainName) > SCORE_THRESHOLD_GROUP_MERGE) { foundGroup = group; break; }
            for (const variant of group.variants) {
                if (FMUse.compareSets(stName, variant) > SCORE_THRESHOLD_GROUP_MERGE) { foundGroup = group; break; }
            }
            if (foundGroup) break;
        }

        if (foundGroup) {
            foundGroup.variants.push(stName);
            foundGroup.count += freqMap[stName];
        } else {
            // Имя уже очищено на предыдущих этапах, дополнительно скобки резать не нужно
            groups.push({ mainName: stName, count: freqMap[stName], variants: [stName] });
        }
    }

    // Сортировка групп по алфавиту
    groups.sort((a, b) => a.mainName.localeCompare(b.mainName, 'ru'));

    let stationsMd = `# Список станций (${groups.length} групп)\n\n`;
    groups.forEach((g, i) => {
        stationsMd += `### ${i + 1}. ${g.mainName} (упоминаний: ${g.count})\n`;
        if (g.variants.length > 1) {
            stationsMd += `*Варианты:* ${g.variants.filter(v => v !== g.mainName).join(', ')}\n\n`;
        } else {
            stationsMd += `\n`;
        }
    });

    if (fs) {
        if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true });
        fs.writeFileSync('data/cities_list.md', citiesMd);
        fs.writeFileSync('data/stations_groups.json', JSON.stringify(groups, null, 2));
        fs.writeFileSync('data/stations_list.md', stationsMd);
    }

    return { citiesMd, stationsMd, groups };
}

async function enrichStationsData(groups, oldEnrichedList = [], onProgress = null, citiesMap = {}) {
    let oldList = oldEnrichedList;
    if (!oldList || oldList.length === 0) {
        if (fs && fs.existsSync('data/stations_data.json')) {
            try { oldList = JSON.parse(fs.readFileSync('data/stations_data.json', 'utf8')); } catch (e) {}
        }
    }
    const oldStreamsMap = new Map(oldList.map(s => [s.name, s]));
    const cityNames = Object.values(citiesMap).map(c => c.toLowerCase());

    const enrichedList = [];
    const baseUrl = "https://de1.api.radio-browser.info/json/stations/search";
    const changedStations = [];
    const norm = (val) => JSON.stringify(val || "");

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const cleanSearchName = FMUse.normalizeName(group.mainName);
        const searchName = encodeURIComponent(cleanSearchName || group.mainName);
        
        // Определяем станцию группы риска (содержит название города, "радио" или "fm")
        const lowerName = group.mainName.toLowerCase();
        const isHighRisk = cityNames.some(c => lowerName.includes(c.toLowerCase())) || lowerName.includes('радио') || lowerName.includes('fm');
        const currentStreamThreshold = isHighRisk ? SCORE_THRESHOLD_STREAMS_STRICT : SCORE_THRESHOLD_STREAMS;
        
        const url = `${baseUrl}?name=${searchName}&countrycode=RU&hidebroken=true&limit=50&order=clickcount&reverse=true`;
        
        let apiData = null;
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'AutoFMShift-GitHubAction/1.0' } });
            if (res.ok) apiData = await res.json();
        } catch (e) {}

        let stationInfo = { name: group.mainName, streams: [] };
        if (apiData && apiData.length > 0) {
            let bestMatch = null;
            let bestScore = 0;
            for (const st of apiData) {
                const score = FMUse.compareSets(group.mainName, st.name);
                if (score > bestScore) { bestScore = score; bestMatch = st; }
            }
            
            if (bestMatch && bestScore >= SCORE_THRESHOLD_MAIN_MATCH) {
                const findFirst = (field, isTags = false) => {
                    for (const st of apiData) {
                        if (FMUse.compareSets(cleanSearchName, st.name) >= currentStreamThreshold && st[field] && st[field] !== 'null' && st[field] !== 'undefined') {
                            if (isTags) return st[field].split(',').slice(0, 5).join(', ');
                            return st[field];
                        }
                    }
                    return "";
                };

                stationInfo.homepage = bestMatch.homepage || findFirst('homepage');
                
                // Ищем логотип и жанры по всем 50 записям API, а не только в собранных потоках!
                stationInfo.favicon = (bestMatch.favicon && bestMatch.favicon !== 'null' && bestMatch.favicon !== 'undefined') 
                    ? bestMatch.favicon 
                    : findFirst('favicon');
                    
                stationInfo.tags = bestMatch.tags 
                    ? bestMatch.tags.split(',').slice(0, 5).join(', ') 
                    : findFirst('tags', true);

                const seenUrls = new Set();
                for (const st of apiData) {
                    if (stationInfo.streams.length >= 5) break;
                    const streamUrl = st.url_resolved || st.url;
                    if (!streamUrl || streamUrl === 'null' || streamUrl === 'undefined') continue;
                    
                    if (FMUse.compareSets(cleanSearchName, st.name) >= currentStreamThreshold && !seenUrls.has(streamUrl)) {
                        stationInfo.streams.push({ 
                            name: st.name || "", 
                            url: streamUrl, 
                            bitrate: st.bitrate, 
                            codec: st.codec,
                            // Сохраняем логотип и теги на уровне потока тоже
                            favicon: st.favicon || "",
                            tags: st.tags ? st.tags.split(',').slice(0, 5).join(', ') : ""
                        });
                        seenUrls.add(streamUrl);
                    }
                }
            }
        }
        enrichedList.push(stationInfo);

        const oldSt = oldStreamsMap.get(stationInfo.name);
        if (!oldSt) {
            // newCount tracked outside
        } else {
            let changes = [];
            if (norm(oldSt.homepage) !== norm(stationInfo.homepage)) changes.push('homepage');
            if (norm(oldSt.favicon) !== norm(stationInfo.favicon)) changes.push('favicon');
            if (norm(oldSt.tags) !== norm(stationInfo.tags)) changes.push('tags');
            if (norm(oldSt.streams) !== norm(stationInfo.streams)) changes.push('streams');
            
            if (changes.length > 0) {
                changedStations.push({ name: stationInfo.name, changes });
            }
        }

        if (onProgress) {
            const percent = Math.round(((i + 1) / groups.length) * 100);
            onProgress(percent);
        } else if (fs) {
            await new Promise(r => setTimeout(r, 250));
        }
    }

    // --- ВТОРОЙ ПРОХОД: ОПТИМИЗАЦИЯ ПРИВЯЗКИ ПОТОКОВ ---
    const allStationNames = enrichedList.map(s => s.name);
    const stationMap = new Map(enrichedList.map(s => [s.name, s]));
    const streamsToMove = [];

    for (const stationInfo of enrichedList) {
        for (const stream of stationInfo.streams) {
            if (!stream.name) continue;
            
            let bestStationName = stationInfo.name;
            let bestScore = FMUse.compareSets(stationInfo.name, stream.name);
            
            for (const targetName of allStationNames) {
                if (targetName === stationInfo.name) continue;
                const score = FMUse.compareSets(targetName, stream.name);
                if (score > bestScore + SCORE_BUFFER_STREAM_MOVE) {
                    bestScore = score;
                    bestStationName = targetName;
                }
            }
            
            if (bestStationName !== stationInfo.name) {
                streamsToMove.push({ from: stationInfo.name, to: bestStationName, stream });
            }
        }
    }

    for (const move of streamsToMove) {
        const fromStation = stationMap.get(move.from);
        const toStation = stationMap.get(move.to);
        if (fromStation && toStation) {
            fromStation.streams = fromStation.streams.filter(s => s.url !== move.stream.url);
            if (!toStation.streams.some(s => s.url === move.stream.url)) {
                toStation.streams.push(move.stream);
            }
        }
    }

    for (const stationInfo of enrichedList) {
        stationInfo.streams.sort((a, b) => {
            const scoreA = a.name ? FMUse.compareSets(stationInfo.name, a.name) : 0;
            const scoreB = b.name ? FMUse.compareSets(stationInfo.name, b.name) : 0;
            return scoreB - scoreA;
        });
    }

    let newCount = 0, changedCount = 0, deletedCount = 0;
    for (const newSt of enrichedList) {
        const oldSt = oldStreamsMap.get(newSt.name);
        if (!oldSt) newCount++;
        else if (norm(oldSt.homepage) !== norm(newSt.homepage) || norm(oldSt.favicon) !== norm(newSt.favicon) || norm(oldSt.tags) !== norm(newSt.tags) || norm(oldSt.streams) !== norm(newSt.streams)) {
            changedCount++;
        }
    }
    const newStreamsSet = new Set(enrichedList.map(s => s.name));
    for (const oldSt of oldList) {
        if (!newStreamsSet.has(oldSt.name)) deletedCount++;
    }

    return { new: newCount, changed: changedCount, deleted: deletedCount, list: enrichedList, changedStations };
}

function saveHistory(oldHistory, report) {
    let history = oldHistory || { sessions: [] };
    history.sessions.push(report);
    if (history.sessions.length > 100) history.sessions.shift();
    
    if (fs) {
        fs.writeFileSync('data/backup-api.history.json', JSON.stringify(history, null, 2));
    }
    return history;
}

async function createIssue(report) {
    if (typeof process === 'undefined' || !process.env || !process.env.GITHUB_TOKEN) return;
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    if (!token || !repo) return;

    const dateStr = report.timestamp.split('T')[0];
    const title = `⚠️ Требуется внимание: изменения API от ${dateStr}`;
    let body = `Автоматическая проверка API обнаружила события, требующие ручного вмешательства:\n\n`;
    
    report.attentionReasons.forEach(r => body += `- ${r}\n`);
    body += `\n**Детали изменений:**\n`;
    if (report.changes.cities.new.length > 0) body += `**Новые города:** ${report.changes.cities.new.join(', ')}\n`;
    if (report.changes.cities.deleted.length > 0) body += `**Удаленные города:** ${report.changes.cities.deleted.join(', ')}\n`;
    body += `\nПолный отчет доступен в файле \`data/backup-api.history.json\`.`;

    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'AutoFMShift-Action'
            },
            body: JSON.stringify({ title, body, labels: ['api-attention'] })
        });
        if (res.ok) console.log("Создано Issue для уведомления автора.");
    } catch (e) {}
}

if (typeof require !== 'undefined' && require.main === module) {
    run().catch(err => {
        console.error("Критическая ошибка:", err);
        process.exit(1);
    });
}

if (typeof window !== 'undefined') {
    window.FetchBackup = { generateLists, enrichStationsData, compareData, saveHistory, mergeData };
}