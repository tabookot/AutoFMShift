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
        return; // Недоступность API не требует внимания
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
            
            // Ищем соответствующий старый город (по slug или по переименованию)
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
                        // Точное совпадение имени — проверяем частоту
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

    // Сохраняем новый бэкап
    fs.writeFileSync('backup-api.json', JSON.stringify(newData, null, 2));
    console.log("Готово! backup-api.json обновлен.");

    saveHistory(report);

    if (report.requiresAttention) {
        await createIssue(report);
    }
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