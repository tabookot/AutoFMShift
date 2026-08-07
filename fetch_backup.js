const fs = require('fs');
const FMUse = require('./fmuse.js');
global.FMUse = FMUse; // Делаем доступным для api.js
const Api = require('./api.js');

async function run() {
    console.log("Получение списка городов с API...");
    const html = await Api.fetchPage(Api.MAIN_PAGE);
    if (!html) {
        console.error("Ошибка: не удалось получить главную страницу API");
        process.exit(1);
    }

    const citiesMap = Api.parseCities(html);
    const cityCount = Object.keys(citiesMap).length;
    console.log(`Найдено городов: ${cityCount}. Начинаем сбор станций...`);

    const data = await Api.generateApiBackup(citiesMap, "0.5.1-github-action", () => false);
    
    fs.writeFileSync('backup-api.json', JSON.stringify(data, null, 2));
    console.log(`Готово! Файл backup-api.json сформирован и сохранен.`);
}

run().catch(err => {
    console.error("Критическая ошибка:", err);
    process.exit(1);
});