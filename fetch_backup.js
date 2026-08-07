const fs = require('fs');
const FMUse = require('./fmuse.js');
global.FMUse = FMUse; 
const Api = require('./api.js');

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
    if (fs.existsSync('backup-api.json')) {
        try {
            oldData = JSON.parse(fs.readFileSync('backup-api.json', 'utf8'));
        } catch (e) {
            console.log("Старый backup-api.json поврежден, игнорируем.");
        }
    }

    console.log("Получение списка городов с API...");
    const html = await Api.fetchPage(Api.MAIN_PAGE);
    
    if (!html) {
        report.status = "api_error";
        report.changes = null;
        console.error("Ошибка: API недоступно.");
        saveHistory(report);
        return;
    }

    const citiesMap = Api.parseCities(html);
    if (Object.keys(citiesMap).length === 0) {
        report.status = "parse_error";
        report.requiresAttention = true;
        report.attentionReasons.push("Сломан парсинг списка городов (0 городов). Требуется доработка api.js.");
        console.error("Ошибка парсинга городов!");
        saveHistory(report);
        await createIssue(report);
        return;
    }

    console.log(`Найдено городов: ${Object.keys(citiesMap).length}. Начинаем сбор станций...`);
    const newData = await Api.generateApiBackup(citiesMap, "0.5.1-github-action", () => false);

    // --- ГЕНЕРАЦИЯ СПИСКОВ ---
    generateLists(newData, citiesMap);
    // -------------------------

    // 1. Сравнение городов
    const oldCities = oldData ? Object.values(oldData.cities).map(c => c.name) : [];
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

    // 2. Сравнение станций
    if (oldData) {
        for (const slug in newData.cities) {
            const newCity = newData.cities[slug];
            let oldCity = oldData.cities[slug];
            if (!oldCity) {
                const renamed = report.changes.cities.renamed.find(r => r.to === newCity.name);
                if (renamed) oldCity = oldData.cities[FMUse.generateCodeName(renamed.from)];
            }

            if (oldCity && oldCity.stations.length > 0) {
                const oldStations = oldCity.stations.map(s => s.name);
                const newStations = newCity.stations.map(s => s.name);
                
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
    }

    fs.writeFileSync('backup-api.json', JSON.stringify(newData, null, 2));
    console.log("Готово! backup-api.json обновлен.");

    saveHistory(report);

    if (report.requiresAttention) {
        await createIssue(report);
    }
}

// --- ФУНКЦИИ ГЕНЕРАЦИИ СПИСКОВ ---
function generateLists(data, citiesMap) {
    if (!fs.existsSync('lists')) {
        fs.mkdirSync('lists', { recursive: true });
    }

    // 1. Список городов (Markdown)
    const cityNames = Object.keys(citiesMap).sort();
    let citiesMd = `# Список городов (${cityNames.length} шт.)\n\n`;
    cityNames.forEach((c, i) => citiesMd += `${i + 1}. ${c}\n`);
    fs.writeFileSync('lists/cities_list.md', citiesMd);
    console.log("Сохранен lists/cities_list.md");

    // 2. Группировка станций
    const freqMap = {};
    Object.values(data.cities).forEach(city => {
        city.stations.forEach(st => {
            const name = st.name.trim();
            if (!freqMap[name]) freqMap[name] = 0;
            freqMap[name]++;
        });
    });

    // Сортируем по частоте (самые частые первыми)
    const uniqueStations = Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a]);
    const groups = [];

    for (const stName of uniqueStations) {
        let foundGroup = null;
        for (const group of groups) {
            // Проверяем схожесть с главным именем группы
            if (FMUse.compareSets(stName, group.mainName) > 0.65) {
                foundGroup = group;
                break;
            }
            // И с вариантами
            for (const variant of group.variants) {
                if (FMUse.compareSets(stName, variant) > 0.65) {
                    foundGroup = group;
                    break;
                }
            }
            if (foundGroup) break;
        }

        if (foundGroup) {
            foundGroup.variants.push(stName);
            foundGroup.count += freqMap[stName];
        } else {
            groups.push({ mainName: stName, count: freqMap[stName], variants: [stName] });
        }
    }

    // Сортируем группы по количеству упоминаний
    groups.sort((a, b) => b.count - a.count);

    // Сохраняем станции в JSON (для API запросов)
    fs.writeFileSync('lists/stations_groups.json', JSON.stringify(groups, null, 2));
    console.log(`Сохранен lists/stations_groups.json (${groups.length} уникальных групп)`);

    // Сохраняем в Markdown (для чтения нейросетью/человеком)
    let stationsMd = `# Список станций (${groups.length} групп)\n\n`;
    groups.forEach((g, i) => {
        stationsMd += `### ${i + 1}. ${g.mainName} (упоминаний: ${g.count})\n`;
        if (g.variants.length > 1) {
            stationsMd += `*Варианты:* ${g.variants.filter(v => v !== g.mainName).join(', ')}\n\n`;
        } else {
            stationsMd += `\n`;
        }
    });
    fs.writeFileSync('lists/stations_list.md', stationsMd);
    console.log("Сохранен lists/stations_list.md");

    // 3. Обогащение данных через radio-browser.info
    await enrichStationsData(groups);
}

async function enrichStationsData(groups) {
    console.log("Начинаем обогащение данных с radio-browser.info...");
    const enrichedList = [];
    const baseUrl = "https://de1.api.radio-browser.info/json/stations/search";

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const searchName = encodeURIComponent(group.mainName);
        const url = `${baseUrl}?name=${searchName}&countrycode=RU&hidebroken=true&limit=10&order=clickcount&reverse=true`;
        
        let apiData = null;
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'AutoFMShift-GitHubAction/1.0' } });
            if (res.ok) {
                apiData = await res.json();
            }
        } catch (e) {
            // ignore fetch errors
        }

        let stationInfo = { name: group.mainName, streams: [] };

        if (apiData && apiData.length > 0) {
            let bestMatch = null;
            let bestScore = 0;
            
            for (const st of apiData) {
                const score = FMUse.compareSets(group.mainName, st.name);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = st;
                }
            }

            // Если совпадение слов больше 50% - берем данные
            if (bestMatch && bestScore >= 0.5) {
                stationInfo.homepage = bestMatch.homepage || "";
                stationInfo.favicon = bestMatch.favicon || "";
                stationInfo.tags = bestMatch.tags ? bestMatch.tags.split(',').slice(0, 5).join(', ') : "";
                
                const seenUrls = new Set();
                for (const st of apiData) {
                    if (FMUse.compareSets(group.mainName, st.name) >= 0.5 && st.url && !seenUrls.has(st.url)) {
                        stationInfo.streams.push({ url: st.url, bitrate: st.bitrate, codec: st.codec });
                        seenUrls.add(st.url);
                        if (stationInfo.streams.length >= 3) break; // Максимум 3 потока
                    }
                }
            }
        }
        
        enrichedList.push(stationInfo);

        // Пауза 250мс, чтобы не перегружать API
        await new Promise(r => setTimeout(r, 250));
    }

    fs.writeFileSync('lists/stations_data.json', JSON.stringify(enrichedList, null, 2));
    console.log(`Сохранен lists/stations_data.json (${enrichedList.length} записей)`);
}

function saveHistory(report) {
    let history = { sessions: [] };
    if (fs.existsSync('backup-api.history.json')) {
        try {
            history = JSON.parse(fs.readFileSync('backup-api.history.json', 'utf8'));
        } catch (e) {}
    }
    history.sessions.push(report);
    // Ограничиваем историю последними 100 записями
    if (history.sessions.length > 100) history.sessions.shift();
    fs.writeFileSync('backup-api.history.json', JSON.stringify(history, null, 2));
    console.log("История обновлена в backup-api.history.json");
}

async function createIssue(report) {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    if (!token || !repo) {
        console.log("GITHUB_TOKEN или GITHUB_REPOSITORY не заданы, создание Issue пропущено.");
        return;
    }

    const dateStr = report.timestamp.split('T')[0];
    const title = `⚠️ Требуется внимание: изменения API от ${dateStr}`;
    let body = `Автоматическая проверка API обнаружила события, требующие ручного вмешательства:\n\n`;
    
    report.attentionReasons.forEach(r => body += `- ${r}\n`);
    
    body += `\n**Детали изменений:**\n`;
    if (report.changes.cities.new.length > 0) body += `**Новые города:** ${report.changes.cities.new.join(', ')}\n`;
    if (report.changes.cities.deleted.length > 0) body += `**Удаленные города:** ${report.changes.cities.deleted.join(', ')}\n`;
    
    body += `\nПолный отчет доступен в файле \`backup-api.history.json\` в репозитории.`;

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
        if (res.ok) {
            console.log("Создано Issue для уведомления автора.");
        } else {
            console.error("Не удалось создать Issue:", await res.text());
        }
    } catch (e) {
        console.error("Ошибка при создании Issue:", e);
    }
}

run().catch(err => {
    console.error("Критическая ошибка:", err);
    process.exit(1);
});