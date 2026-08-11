let fs;
if (typeof require !== 'undefined') {
    fs = require('fs');
    const FMUse = require('./fmuse.js');
    global.FMUse = FMUse; 
    const Api = require('./api.js');
    global.Api = Api;
}

// --- ПОРОГИ СОВПАДЕНИЯ ДЛЯ RADIO-BROWSER.INFO ---
// Баланс между поиском всех рабочих потоков и защитой от "чужих" станций.
// Очистка имени (normalizeName) превращает "Красноярск FM" в "красноярск".
// 0.65: Строго. Отсекает "Рекорд Красноярск" (score 0.5), но теряет до 40% рабочих потоков и логотипов.
// 0.40: Золотая середина. Находит большинство потоков, изредка пропуская "чужих" (которые фильтруются на стороне плеера).
// 0.35: Мягко. Максимальный сбор потоков, но высокий риск прилипания станций с общими словами.
// Для перегенерации и теста: запустите data/sandbox.html, выполните Шаг 4 и проверьте выдачу.

// Отвечает за выбор ГЛАВНОГО совпадения (bestMatch).
// Из этой записи берутся базовые данные станции (сайт, логотип, жанры).
// Должен быть строже, чтобы ошибочно не подменить суть станции (например, приписать "Радио Веру" к "Шансону").
const SCORE_THRESHOLD_MAIN_MATCH = 0.4;

// Отвечает за сбор ДОПОЛНИТЕЛЬНЫХ потоков и поиск недостающих логотипов/жанров в других записях API.
// Может быть чуть мягче, так как сбор лишнего URL не критичен (нерабочие или чужие отсеются в плеере),
// а слишком жесткий порог лишит нас альтернативных потоков и логотипов для многих станций.
const SCORE_THRESHOLD_STREAMS = 0.55;

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
    const newData = await Api.generateApiBackup(citiesMap, "0.5.1-github-action", () => false);

    const listsData = generateLists(newData, citiesMap);
    
    let oldEnrichedList = [];
    if (fs && fs.existsSync('data/stations_data.json')) {
        try { oldEnrichedList = JSON.parse(fs.readFileSync('data/stations_data.json', 'utf8')); } catch (e) {}
    }
    const enrichResult = await enrichStationsData(listsData.groups, oldEnrichedList);
    
    const compareReport = compareData(oldData, newData);
    report = { ...report, ...compareReport };
    report.radioBrowser = {
        new: enrichResult.new,
        changed: enrichResult.changed,
        deleted: enrichResult.deleted,
        changedStations: enrichResult.changedStations
    };
    
    if (report.requiresAttention) {
        report.attentionReasons.forEach(r => console.warn(`Внимание: ${r}`));
    }

    if (fs) {
        fs.writeFileSync('data/backup-api.json', JSON.stringify(newData, null, 2));
        console.log("Готово! data/backup-api.json обновлен.");
        fs.writeFileSync('data/stations_data.json', JSON.stringify(enrichResult.list, null, 2));
        console.log(`Сохранен data/stations_data.json (${enrichResult.list.length} записей)`);
    }

    saveHistory(null, report);

    if (report.requiresAttention) {
        await createIssue(report);
    }
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
        const cityMatches = FMUse.matchArrays(oldCities, newCities, 0.65);
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
            
            const stMatches = FMUse.matchArrays(oldStations, newStations, 0.65);
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
    const cityNames = Object.keys(citiesMap).sort();
    let citiesMd = `# Список городов (${cityNames.length} шт.)\n\n`;
    cityNames.forEach((c, i) => citiesMd += `${i + 1}. ${c}\n`);

    const freqMap = {};
    Object.values(data.cities).forEach(city => {
        city.stations.forEach(st => {
            const name = st.name.trim();
            if (!freqMap[name]) freqMap[name] = 0;
            freqMap[name]++;
        });
    });

    const uniqueStations = Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a]);
    const groups = [];

    for (const stName of uniqueStations) {
        let foundGroup = null;
        for (const group of groups) {
            if (FMUse.compareSets(stName, group.mainName) > 0.65) { foundGroup = group; break; }
            for (const variant of group.variants) {
                if (FMUse.compareSets(stName, variant) > 0.65) { foundGroup = group; break; }
            }
            if (foundGroup) break;
        }

        if (foundGroup) {
            foundGroup.variants.push(stName);
            foundGroup.count += freqMap[stName];
        } else {
            // Clean name from brackets (e.g., "Station (City)" -> "Station")
            const cleanName = stName.replace(/\s*\(.*?\)\s*/g, '').trim();
            groups.push({ mainName: cleanName, count: freqMap[stName], variants: [stName] });
        }
    }

    groups.sort((a, b) => b.count - a.count);

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

async function enrichStationsData(groups, oldEnrichedList = [], onProgress = null) {
    let oldList = oldEnrichedList;
    if (!oldList || oldList.length === 0) {
        if (fs && fs.existsSync('data/stations_data.json')) {
            try { oldList = JSON.parse(fs.readFileSync('data/stations_data.json', 'utf8')); } catch (e) {}
        }
    }
    const oldStreamsMap = new Map(oldList.map(s => [s.name, s]));

    const enrichedList = [];
    const baseUrl = "https://de1.api.radio-browser.info/json/stations/search";
    const changedStations = [];
    const norm = (val) => JSON.stringify(val || "");

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        // Глубоко очищаем имя для запроса: убираем "Радио", "FM", скобки и т.д.
        // Это позволяет найти "Вера" вместо "Радио Вера (Москва)"
        const cleanSearchName = FMUse.normalizeName(group.mainName);
        const searchName = encodeURIComponent(cleanSearchName || group.mainName);
        
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
                if (score > bestScore) { 
                    bestScore = score; bestMatch = st; 
                } else if (score === bestScore && bestMatch) {
                    // При равном рейтинге предпочитаем запись с логотипом и потоками
                    const oldHasFav = bestMatch.favicon && bestMatch.favicon !== 'null';
                    const newHasFav = st.favicon && st.favicon !== 'null';
                    if (!oldHasFav && newHasFav) bestMatch = st;
                }
            }
            
            if (bestMatch && bestScore >= SCORE_THRESHOLD_MAIN_MATCH) {
                const findFirst = (field, isTags = false) => {
                    for (const st of apiData) {
                        if (FMUse.compareSets(cleanSearchName, st.name) >= SCORE_THRESHOLD_STREAMS && st[field] && st[field] !== 'null' && st[field] !== 'undefined') {
                            if (isTags) return st[field].split(',').slice(0, 5).join(', ');
                            return st[field];
                        }
                    }
                    return "";
                };

                // (Этот блок удален, так как логотип и жанры теперь берутся из потоков выше)
                
                const seenUrls = new Set();
                for (const st of apiData) {
                    if (stationInfo.streams.length >= 5) break;
                    const streamUrl = st.url_resolved || st.url;
                    if (!streamUrl || streamUrl === 'null' || streamUrl === 'undefined') continue;
                    
                    if (FMUse.compareSets(cleanSearchName, st.name) >= SCORE_THRESHOLD_STREAMS && !seenUrls.has(streamUrl)) {
                        stationInfo.streams.push({ 
                            name: st.name || "", // Имя станции из ответа API
                            url: streamUrl, 
                            bitrate: st.bitrate, 
                            codec: st.codec,
                            favicon: st.favicon || "",
                            tags: st.tags ? st.tags.split(',').slice(0, 5).join(', ') : ""
                        });
                        seenUrls.add(streamUrl);
                    }
                }
                
                // Берем данные из bestMatch, но если их нет - ищем в других записях
                stationInfo.homepage = bestMatch.homepage || findFirst('homepage');
                
                // Для станции берем первый попавшийся непустой логотип и жанр из собранных потоков
                const firstWithFav = stationInfo.streams.find(s => s.favicon && s.favicon !== 'null' && s.favicon !== 'undefined');
                stationInfo.favicon = firstWithFav ? firstWithFav.favicon : "";
                
                const firstWithTags = stationInfo.streams.find(s => s.tags);
                stationInfo.tags = firstWithTags ? firstWithTags.tags : "";
            }
        }
        enrichedList.push(stationInfo);

        // Track changes
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
    // 1. Поиск лучшей станции для каждого потока и перенос
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
                // Переносим только если другая станция подходит ЗНАЧИТЕЛЬНО лучше (буфер 0.1)
                if (score > bestScore + 0.1) {
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

    // 2. Сортировка потоков внутри станции по релевантности названия
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
    window.FetchBackup = { generateLists, enrichStationsData, compareData, saveHistory };
}