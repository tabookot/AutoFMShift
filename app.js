// 0.1.28 | Rule: minor.major.build. build++ on full regen
const VERSION = "0.1.28";
const API_URL = "https://radiopedia.fandom.com/ru/api.php";
const MAIN_PAGE = "Частотные планы радиостанций в городах России";
const LS_KEY = "fm_adapter_calc_v6";
const LS_THEME_KEY = "fm_adapter_theme";

const TEMPLATES = [
    { name: "Россия / Европа", short: "ru/eu", range: [87.5, 108.0] },
    { name: "Япония (до 2014)", short: "jp-old", range: [76.0, 90.0] },
    { name: "Япония (Wide FM)", short: "jp-wide", range: [76.0, 95.0] },
    { name: "Япония (JDM 78-99)", short: "jp-jdm", range: [78.0, 99.0] },
    { name: "США", short: "usa", range: [87.9, 107.9] },
    { name: "Свой вариант", short: "свой", range: [76.0, 108.0] }
];

const SHIFTS = [0, 10, 12, 14, 16, 18, 20, 24, 28, 30];
const EASY_SHIFTS = [0, 10, 20, 30, 12, 24, 14, 16, 18, 28];

const DEFAULT_STATE = {
    city: "Москва",
    template: "Россия / Европа",
    min: 87.5,
    max: 108.0,
    shift: 0,
    stations: []
};

let state = { ...DEFAULT_STATE };
let citiesMap = {};

// THEME
function initTheme() {
    const savedTheme = localStorage.getItem(LS_THEME_KEY);
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    updateThemeIcon();
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDarkDefault = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let newTheme;
    if (currentTheme) {
        newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    } else {
        newTheme = isDarkDefault ? 'light' : 'dark';
    }
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(LS_THEME_KEY, newTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDarkDefault = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = currentTheme ? currentTheme === 'dark' : isDarkDefault;
    
    document.getElementById('themeBtn').textContent = isDark ? '☀' : '☾';
}

// API & PARSING
async function fetchPage(title) {
    const url = `${API_URL}?action=parse&page=${encodeURIComponent(title)}&format=json&prop=text&origin=*`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.parse?.text?.["*"] || null;
    } catch { 
        return null; 
    }
}

function parseCities(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cities = {};
    doc.querySelectorAll("a[title]").forEach(a => {
        const title = a.getAttribute("title");
        if (title.startsWith(MAIN_PAGE + "/")) {
            const city = title.split("/").pop().replace(/_/g, " ").trim();
            if (city && !["Сводная таблица", "Россия"].includes(city)) {
                cities[city] = title;
            }
        }
    });
    return cities;
}

function parseStations(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const stations = [];
    
    doc.querySelectorAll("table").forEach(table => {
        table.querySelectorAll("tr").forEach(row => {
            const cols = row.querySelectorAll("td, th");
            if (cols.length < 2) return;
            
            let freq = null, name = "";
            cols.forEach(col => {
                const a = col.querySelector("a");
                if (a && a.getAttribute('title') && !name) {
                    name = a.getAttribute('title').replace(/_/g, " ").trim();
                }
                
                const text = col.textContent.trim();
                if (!text) return;
                
                const match = text.match(/(\d{2,3}[.,]\d{1,3})/);
                if (match && !freq) {
                    const f = parseFloat(match[1].replace(",", "."));
                    if (f >= 76.0 && f <= 108.0) freq = f;
                } else if (!name && text.length > 2) {
                    const lower = text.toLowerCase();
                    if (!["частота", "радиостанция", "мгц", "квт", "мощность", "передатчик", "вт"].some(x => lower.includes(x))) {
                        name = text.replace(/\[\d+\]/g, "").trim();
                    }
                }
            });
            
            if (freq && name) stations.push({ freq, name });
        });
    });
    return stations;
}

// LOGIC
function evaluateShifts() {
    if (state.stations.length === 0) return { statuses: {}, best: 0 };
    if (state.min === 87.5 && state.max === 108.0) return { statuses: {}, best: 0 };

    const statuses = {};
    const fullShifts = [];
    
    SHIFTS.forEach(s => {
        let validCount = 0;
        state.stations.forEach(st => {
            const shifted = st.freq - s;
            if (shifted >= state.min && shifted <= state.max) validCount++;
        });
        
        if (validCount === state.stations.length) {
            statuses[s] = { type: 'full' };
            fullShifts.push(s);
        } else if (validCount > 0) {
            statuses[s] = { type: 'partial', ratio: validCount / state.stations.length };
        } else {
            statuses[s] = { type: 'none' };
        }
    });
    
    let best = -1;
    if (fullShifts.includes(0)) {
        best = 0;
    } else if (fullShifts.length > 0) {
        best = EASY_SHIFTS.find(s => s > 0 && fullShifts.includes(s)) || Math.min(...fullShifts);
    }
    
    return { statuses, best: best === -1 ? 0 : best };
}

function getShiftedFreq(freq) {
    if (state.shift === 0 || (state.min === 87.5 && state.max === 108.0)) return freq;
    return parseFloat((freq - state.shift).toFixed(2));
}

function isAvailable(freq) {
    const shifted = getShiftedFreq(freq);
    return shifted >= state.min && shifted <= state.max;
}

// UI RENDER
function renderAdapters() {
    const panel = document.getElementById("adapterPanel");
    const chips = document.getElementById("adapterChips");
    chips.innerHTML = "";
    
    const isStandard = state.min === 87.5 && state.max === 108.0;
    if (isStandard) {
        panel.style.display = "none";
        return;
    }
    
    panel.style.display = "block";
    const { statuses, best } = evaluateShifts();
    
    const addChip = (shift, statusData) => {
        const chip = document.createElement("button");
        const statusType = statusData.type;
        const ratio = statusData.ratio || 0;
        
        chip.className = `chip ${statusType || ''}`;
        if (shift === best && statusType === 'full') chip.classList.add('best');
        if (shift === state.shift) chip.classList.add("active");
        
        if (shift === 0) {
            chip.textContent = "0";
            chip.setAttribute('data-tip', 'Без адаптера');
        } else {
            chip.textContent = shift;
        }

        if (statusType === 'partial') {
            const r = Math.round(255 - 14 * ratio);
            const g = Math.round(71 + 125 * ratio);
            const b = Math.round(87 - 72 * ratio);
            const color = `rgb(${r}, ${g}, ${b})`;
            chip.style.color = color;
            chip.style.borderColor = color;
            if (shift === state.shift) {
                chip.style.backgroundColor = color;
                chip.style.color = 'var(--bg)';
            }
        }
        
        chip.onclick = (e) => {
            state.shift = shift;
            saveState();
            render();
        };
        chips.appendChild(chip);
    };

    SHIFTS.forEach(s => addChip(s, statuses[s] || { type: 'none' }));
}

function renderStations() {
    const list = document.getElementById("stationsList");
    list.innerHTML = "";
    
    if (state.stations.length === 0) {
        list.innerHTML = `<div style="text-align:center;color:var(--text-dim);padding:20px;">Нет данных</div>`;
        return;
    }

    const sorted = [...state.stations].sort((a, b) => a.freq - b.freq);
    const isStandard = state.min === 87.5 && state.max === 108.0;

    sorted.forEach(st => {
        const item = document.createElement("div");
        item.className = "station-item";
        const shifted = getShiftedFreq(st.freq);
        const isAvail = isAvailable(st.freq);
        const freqClass = isAvail ? 'ok' : 'err';
        
        if (!isAvail) item.classList.add("unavailable");
        
        if (isStandard) {
            item.innerHTML = `
                <div class="freq">${st.freq.toFixed(2).replace(".", ",")}</div>
                <div class="name">${st.name}</div>
            `;
        } else {
            item.innerHTML = `
                <div class="freq">${st.freq.toFixed(2).replace(".", ",")}</div>
                <div class="name">${st.name}</div>
                <div class="shifted-freq ${freqClass}">${shifted >= 76 ? shifted.toFixed(2).replace(".", ",") : "—"}</div>
            `;
        }
        list.appendChild(item);
    });
}

function render() {
    const minInput = document.getElementById("minFreq");
    const maxInput = document.getElementById("maxFreq");
    const citySelect = document.getElementById("citySelect");
    
    if (document.activeElement !== minInput) minInput.value = state.min;
    if (document.activeElement !== maxInput) maxInput.value = state.max;
    if (citySelect.value !== state.city) citySelect.value = state.city;
    
    const tmpl = TEMPLATES.find(t => t.name === state.template) || TEMPLATES.find(t => t.name === "Свой вариант");
    document.getElementById("templatesBtn").textContent = tmpl ? tmpl.short : "свой";
    
    renderAdapters();
    renderStations();
    updateUrl();
}

// STATE & PERSISTENCE
function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function updateUrl() {
    const params = new URLSearchParams({
        city: state.city,
        min: state.min,
        max: state.max,
        shift: state.shift
    });
    history.replaceState(null, "", `#${params.toString()}`);
}

function loadFromUrl() {
    if (location.hash.length < 2) return false;
    const params = new URLSearchParams(location.hash.slice(1));
    state.city = params.get("city") || state.city;
    state.min = parseFloat(params.get("min")) || state.min;
    state.max = parseFloat(params.get("max")) || state.max;
    state.shift = parseInt(params.get("shift")) || 0;
    
    const matched = TEMPLATES.find(t => t.range[0] === state.min && t.range[1] === state.max);
    state.template = matched ? matched.name : "Свой вариант";
    
    return true;
}

function loadFromLS() {
    const ls = localStorage.getItem(LS_KEY);
    if (!ls) return false;
    try {
        const parsed = JSON.parse(ls);
        state = { ...state, ...parsed };
        return true;
    } catch {
        return false;
    }
}

function resetAll() {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem("geo_checked");
    history.replaceState(null, "", window.location.pathname);
    state = { ...DEFAULT_STATE, stations: [] };
    document.getElementById('minFreq').value = state.min;
    document.getElementById('maxFreq').value = state.max;
    document.getElementById("citySelect").value = state.city;
    showToast("Состояние сброшено");
    loadCity(state.city).then(() => checkGeo(true));
}

// Haversine formula to calculate distance between two coordinates
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// EVENTS
async function init() {
    initTheme();
    document.getElementById('appVersion').textContent = 'v' + VERSION;
    const citySelect = document.getElementById("citySelect");
    const templatesMenu = document.getElementById("templatesMenu");
    
    TEMPLATES.forEach(t => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = t.name; 
        item.onclick = () => {
            state.template = t.name;
            state.min = t.range[0]; 
            state.max = t.range[1]; 
            state.shift = 0;
            saveState(); render();
            templatesMenu.classList.remove("show");
        };
        templatesMenu.appendChild(item);
    });

    // Hover trigger logic for background image
    const hoverTrigger = document.getElementById('hoverTrigger');
    const bgBandit = document.getElementById('bgBandit');
    if (hoverTrigger && bgBandit) {
        const showBg = () => bgBandit.classList.add('hovered');
        const hideBg = () => bgBandit.classList.remove('hovered');
        hoverTrigger.addEventListener('mouseenter', showBg);
        hoverTrigger.addEventListener('mouseleave', hideBg);
        hoverTrigger.addEventListener('touchstart', (e) => { e.preventDefault(); showBg(); }, { passive: false });
        hoverTrigger.addEventListener('touchend', hideBg);
        hoverTrigger.addEventListener('touchcancel', hideBg);
    }

    loadFromLS();
    const hasUrl = loadFromUrl();

    const html = await fetchPage(MAIN_PAGE);
    if (!html) {
        document.getElementById("errorMsg").style.display = "block";
        document.getElementById("errorMsg").textContent = "Сайт недоступен. Приносим дикие извинения за неудобства!";
        return;
    }

    citiesMap = parseCities(html);
    
    citySelect.innerHTML = "";
    Object.keys(citiesMap).sort().forEach(c => {
        const opt = document.createElement("option");
        opt.value = c; opt.textContent = c;
        citySelect.appendChild(opt);
    });

    if (!citiesMap[state.city]) {
        state.city = DEFAULT_STATE.city;
    }

    await loadCity(state.city);
    render();

    if (!hasUrl && !localStorage.getItem("geo_checked")) {
        checkGeo(false);
    }
}

async function loadCity(city) {
    if (!citiesMap[city]) return;
    state.city = city;
    
    const ls = localStorage.getItem(LS_KEY);
    if (ls) {
        const parsed = JSON.parse(ls);
        if (parsed.city === city && parsed.stations?.length > 0) {
            state.stations = parsed.stations;
            render();
        }
    }

    const html = await fetchPage(citiesMap[city]);
    if (html) {
        state.stations = parseStations(html);
        saveState();
        render();
    }
}

async function checkGeo(isManual = false) {
    const hasUrlCity = location.hash.includes("city=");
    
    try {
        const res = await fetch("https://get.geojs.io/v1/ip/geo.json");
        if (!res.ok) throw new Error("Network response was not ok");
        
        const data = await res.json();
        const lat = parseFloat(data.latitude);
        const lon = parseFloat(data.longitude);
        
        if (!isNaN(lat) && !isNaN(lon) && typeof CITY_CENTERS !== 'undefined') {
            let closestCity = null;
            let minDist = Infinity;
            
            CITY_CENTERS.forEach(c => {
                const dist = getDistance(lat, lon, c.lat, c.lon);
                if (dist < minDist) {
                    minDist = dist;
                    closestCity = c;
                }
            });
            
            if (closestCity) {
                if (minDist <= 50) {
                    if (citiesMap[closestCity.name]) {
                        if (isManual || !hasUrlCity) {
                            state.city = closestCity.name;
                            await loadCity(state.city);
                            showToast(`Автоопределение: ${closestCity.name} (${Math.round(minDist)} км)`);
                        }
                    } else {
                        showToast(`Автоопределение: ${closestCity.name} нет в базе`);
                    }
                } else {
                    showToast("Автоопределение: ближайший город слишком далеко");
                }
            }
        } else {
            showToast("Автоопределение: координаты не получены");
        }
    } catch (e) {
        showToast("Автоопределение: ошибка сети");
    }
    localStorage.setItem("geo_checked", "1");
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
}

document.getElementById("themeBtn").addEventListener("click", toggleTheme);

document.getElementById("citySelect").addEventListener("change", (e) => loadCity(e.target.value));

document.getElementById("templatesBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("templatesMenu").classList.toggle("show");
});

document.addEventListener("click", () => {
    document.getElementById("templatesMenu").classList.remove("show");
});

(function() {
    let clickCount = 0;
    let clickTimer = null;
    document.getElementById('logoBtn').addEventListener('click', () => {
        clickCount++;
        if (clickCount === 1) {
            clickTimer = setTimeout(() => clickCount = 0, 600);
        } else if (clickCount === 3) {
            clearTimeout(clickTimer);
            clickCount = 0;
            resetAll();
        }
    });
})();

function setupFreqInput(id, isMin) {
    const el = document.getElementById(id);
    
    el.addEventListener("input", (e) => {
        if (isMin) state.min = parseFloat(e.target.value) || 87.5; 
        else state.max = parseFloat(e.target.value) || 108.0;
        
        const matched = TEMPLATES.find(t => t.range[0] === state.min && t.range[1] === state.max);
        state.template = matched ? matched.name : "Свой вариант";
        
        saveState(); render();
    });

    el.addEventListener("wheel", (e) => {
        e.preventDefault(); 
        let val = parseFloat(el.value) || 0;
        if (e.deltaY < 0) val += 0.1;
        else val -= 0.1;
        val = Math.round(val * 10) / 10;
        
        if (val < 64) val = 64;
        if (val > 110) val = 110;
        
        el.value = val;
        
        if (isMin) state.min = val;
        else state.max = val;
        
        const matched = TEMPLATES.find(t => t.range[0] === state.min && t.range[1] === state.max);
        state.template = matched ? matched.name : "Свой вариант";
        
        saveState(); render();
    }, { passive: false });
}

setupFreqInput("minFreq", true);
setupFreqInput("maxFreq", false);

document.getElementById("shareBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        showToast("Ссылка скопирована в буфер обмена");
    }).catch(() => {
        showToast("Ошибка копирования ссылки");
    });
});

document.getElementById("geoBtn").addEventListener("click", () => {
    checkGeo(true);
});

document.getElementById("helpBtn").addEventListener("click", () => {
    document.getElementById("helpModal").classList.add("show");
});

document.getElementById("closeHelpBtn").addEventListener("click", () => {
    document.getElementById("helpModal").classList.remove("show");
});

document.getElementById("helpModal").addEventListener("click", (e) => {
    if (e.target.id === 'helpModal') {
        e.target.classList.remove("show");
    }
});

init();