const Api = {
    MAIN_PAGE: "Частотные планы радиостанций в городах России",
    API_URL: "https://radiopedia.fandom.com/ru/api.php",

    async fetchPage(title) {
        const url = `${this.API_URL}?action=parse&page=${encodeURIComponent(title)}&format=json&prop=text&origin=*`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Network response was not ok: ${res.status}`);
            const data = await res.json();
            return data.parse?.text?.["*"] || null;
        } catch { return null; }
    },

    parseCities(html) {
        const cities = {};
        if (typeof DOMParser !== 'undefined') {
            const doc = new DOMParser().parseFromString(html, "text/html");
            doc.querySelectorAll("a[title]").forEach(a => {
                const title = a.getAttribute("title");
                if (title.startsWith(this.MAIN_PAGE + "/")) {
                    const city = title.split("/").pop().replace(/_/g, " ").trim();
                    if (city && !["Сводная таблица", "Россия"].includes(city)) cities[city] = title;
                }
            });
        } else {
            const regex = new RegExp(`title="(${this.MAIN_PAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^"]+)"`, 'g');
            let match;
            while ((match = regex.exec(html)) !== null) {
                const title = match[1];
                const city = title.split("/").pop().replace(/_/g, " ").trim();
                if (city && !["Сводная таблица", "Россия"].includes(city)) cities[city] = title;
            }
        }
        return cities;
    },

    parseStations(html) {
        const stations = [];
        if (typeof DOMParser !== 'undefined') {
            const doc = new DOMParser().parseFromString(html, "text/html");
            doc.querySelectorAll("table").forEach(table => {
                table.querySelectorAll("tr").forEach(row => {
                    const cols = row.querySelectorAll("td, th");
                    if (cols.length < 2) return;
                    let freq = null, name = "";
                    cols.forEach(col => {
                        const a = col.querySelector("a");
                        if (a && a.getAttribute('title') && !name) name = a.getAttribute('title').replace(/_/g, " ").trim();
                        const text = col.textContent.trim();
                        if (!text) return;
                        const match = text.match(/(\d{2,3}[.,]\d{1,3})/);
                        if (match && !freq) {
                            const f = parseFloat(match[1].replace(",", "."));
                            if (!isNaN(f) && f >= 76.0 && f <= 108.0) freq = f;
                        } else if (!name && text.length > 2) {
                            const lower = text.toLowerCase();
                            if (!["частота", "радиостанция", "мгц", "квт", "мощность", "передатчик", "вт"].some(x => lower.includes(x))) name = text.replace(/\[\d+\]/g, "").trim();
                        }
                    });
                    if (freq && name) stations.push({ freq, name });
                });
            });
        } else {
             const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
             let rowMatch;
             while ((rowMatch = rowRegex.exec(html)) !== null) {
                 const rowHtml = rowMatch[1];
                 const cols = rowHtml.split(/<t[d][^>]*>/).slice(1);
                 if (cols.length < 2) continue;
                 let freq = null, name = "";
                 cols.forEach(colHtml => {
                     const text = colHtml.replace(/<[^>]+>/g, '').trim();
                     if (!text) return;
                     const aMatch = colHtml.match(/title="([^"]+)"/);
                     if (aMatch && !name) name = aMatch[1].replace(/_/g, " ").trim();
                     const match = text.match(/(\d{2,3}[.,]\d{1,3})/);
                     if (match && !freq) {
                         const f = parseFloat(match[1].replace(",", "."));
                         if (!isNaN(f) && f >= 76.0 && f <= 108.0) freq = f;
                     } else if (!name && text.length > 2) {
                         const lower = text.toLowerCase();
                         if (!["частота", "радиостанция", "мгц", "квт", "мощность", "передатчик", "вт"].some(x => lower.includes(x))) name = text.replace(/\[\d+\]/g, "").trim();
                     }
                 });
                 if (freq && name) stations.push({ freq, name });
             }
        }
        return stations;
    },

    async generateApiBackup(citiesMap, appVersion, onCancel) {
        const backupData = {
            type: "api-cache",
            appVersion: appVersion,
            exportDate: Date.now(),
            totalCities: Object.keys(citiesMap).length,
            source: "AutoFMShift API Backup",
            cities: {}
        };
        
        const cityKeys = Object.keys(citiesMap);
        for (let i = 0; i < cityKeys.length; i++) {
            if (onCancel && onCancel()) throw new Error("Canceled");
            const c = cityKeys[i];
            const html = await this.fetchPage(citiesMap[c]);
            if (html) {
                const stations = this.parseStations(html);
                if (stations.length > 0) {
                    backupData.cities[FMUse.generateCodeName(c)] = {
                        name: c,
                        stations: stations.map(s => ({ name: s.name, freq: s.freq }))
                    };
                }
            }
        }
        return backupData;
    },

    async importApiBackup(data, state, citiesMap, fmuse, isManual = false) {
        const backupDate = data.exportDate || 0;
        const lsDate = state.lastModified || 0;
        const lsCityCount = Object.keys(citiesMap).length;
        const backupCityCount = Object.keys(data.cities).length;

        // 1. Города
        if (lsCityCount === 0) {
            Object.keys(data.cities).forEach(slug => {
                const cName = data.cities[slug].name || slug;
                citiesMap[cName] = cName;
            });
        } else if (lsCityCount < backupCityCount && lsDate > backupDate) {
            Object.keys(data.cities).forEach(slug => {
                const cName = data.cities[slug].name || slug;
                if (!citiesMap[cName]) citiesMap[cName] = cName;
            });
        } else {
            Object.keys(data.cities).forEach(slug => {
                const cName = data.cities[slug].name || slug;
                if (!citiesMap[cName]) citiesMap[cName] = cName;
            });
        }

        // 2. Станции
        Object.keys(data.cities).forEach(slug => {
            const bCity = data.cities[slug];
            const cName = bCity.name || slug;
            const bStations = bCity.stations.map(s => ({ name: s.name, freq: s.freq }));
            
            const cityData = state.cityData[cName] || { stations: {} };
            const cityModifiedDate = cityData.lastModified || 0;
            const hasUserSettings = Object.values(cityData.stations || {}).some(s => s.type !== 'normal' || s.presetIndex);

            // Если в LS есть настройки и они новее бэкапа - пропускаем обновление станций
            if (hasUserSettings && cityModifiedDate > backupDate && !isManual) {
                return; 
            }

            if (!state.cityData[cName]) state.cityData[cName] = { stations: {} };
            
            const oldSettings = state.cityData[cName].stations || {};
            const oldNames = Object.keys(oldSettings);
            let syncedSettings = {};

            if (oldNames.length > 0) {
                const matches = fmuse.matchArrays(oldNames, bStations.map(s => s.name));
                matches.forEach(m => {
                    const oldData = oldSettings[m.source];
                    if (oldData && (oldData.type !== 'normal' || oldData.presetIndex)) {
                        syncedSettings[m.target] = { ...oldData };
                    }
                });
            }
            
            state.cityData[cName].stations = syncedSettings;
            state.cityData[cName].allStations = bStations;
            state.cityData[cName].totalStations = bStations.length;
            state.cityData[cName].lastModified = Date.now();
        });
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Api;
}