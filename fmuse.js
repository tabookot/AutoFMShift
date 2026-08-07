const FMUse = {
    // Очистка названий от мусора
    normalizeName(name) {
        if (!name) return '';
        let cleanName = name.toLowerCase();
        
        // 1. Отрезаем историю (всё, что после переноса строки) и вторые станции (после /)
        cleanName = cleanName.split('\n')[0].split('/')[0];
        
        // 2. Жестко удаляем любые HTML-сущности (&#160;, &nbsp; и т.д.)
        cleanName = cleanName.replace(/&[a-z0-9]+;/gi, ' ').replace(/\u00A0/g, ' ');
        
        // 3. Удаляем служебные пометки Fandom
        cleanName = cleanName.replace(/\(план\)|\(тест\)|\(был план\)/g, ' ');
        
        // 4. Удаляем всё в круглых и квадратных скобках (уточнения городов, регионов, дат)
        cleanName = cleanName.replace(/\([^)]+\)/g, ' ').replace(/\[[^\]]+\]/g, ' ');
        
        // 5. Удаляем мусорные слова и аббревиатуры вещателей (ГТРК, ТРВ и т.д.)
        // Используем проверку пробелов вместо \b, так как \b не работает с кириллицей
        cleanName = cleanName.replace(/(^|\s)(радио|radio|fm|ам|тв|tv|комедия|comedy|гтрк|трв|орр)(?=\s|$)/g, ' ');
        
        // 6. Оставляем только буквы, цифры и пробелы
        cleanName = cleanName.replace(/[^\p{L}\p{N}\s-]/gu, ' ');
        
        // 7. Удаляем лишние пробелы и дефисы по краям
        cleanName = cleanName.replace(/[-\s]+/g, ' ').trim();
        
        return cleanName;
    },

    // Разбивает название на первичные слова и вторичные
    tokenizeAndClean(name) {
        const cleanName = this.normalizeName(name);
        return { primary: cleanName.split(' ').filter(w => w.length > 0) };
    },

    // Похожесть двух отдельных слов (алгоритм Сёренсена-Дайса)
    wordSimilarity(w1, w2) {
        w1 = w1.replace(/\s+/g, '');
        w2 = w2.replace(/\s+/g, '');
        if (w1 === w2) return 1;
        if (w1.length < 2 || w2.length < 2) return 0;
        
        let firstBigrams = new Map();
        for (let i = 0; i < w1.length - 1; i++) {
            const bigram = w1.substring(i, i + 2);
            const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) + 1 : 1;
            firstBigrams.set(bigram, count);
        }
        
        let intersectionSize = 0;
        for (let i = 0; i < w2.length - 1; i++) {
            const bigram = w2.substring(i, i + 2);
            const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) : 0;
            if (count > 0) {
                intersectionSize++;
                firstBigrams.set(bigram, count - 1);
            }
        }
        return (2.0 * intersectionSize) / (w1.length + w2.length - 2);
    },

    // Главная функция сравнения двух строк с учетом весов
    compareTwoStrings(first, second) {
        const t1 = this.tokenizeAndClean(first);
        const t2 = this.tokenizeAndClean(second);
        
        const allTokens1 = t1.primary;
        const allTokens2 = t2.primary;
        
        if (allTokens1.length === 0 || allTokens2.length === 0) return 0;
        
        let totalScore = 0;
        let matchedTokens2 = new Array(allTokens2.length).fill(false);
        
        for (let w1 of allTokens1) {
            let bestScore = 0;
            let bestIdx = -1;
            for (let i = 0; i < allTokens2.length; i++) {
                if (matchedTokens2[i]) continue;
                let score = this.wordSimilarity(w1, allTokens2[i]);
                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = i;
                }
            }
            if (bestIdx !== -1 && bestScore > 0.7) { // Порог совпадения слова 70%
                matchedTokens2[bestIdx] = true;
                totalScore += bestScore;
            }
        }
        
        return totalScore / Math.max(allTokens1.length, allTokens2.length);
    },

    // Сопоставление двух массивов строк 1-к-1
    // Для станций используем строгий порог 0.8, чтобы избежать ложных срабатываний
    matchArrays(sourceArr, targetArr, threshold = 0.8) {
        const pairs = [];
        const usedTargets = new Set();
        const scores = [];
        
        for (let i = 0; i < sourceArr.length; i++) {
            for (let j = 0; j < targetArr.length; j++) {
                const score = this.compareTwoStrings(sourceArr[i], targetArr[j]);
                if (score >= threshold) {
                    scores.push({ source: sourceArr[i], target: targetArr[j], sourceIdx: i, targetIdx: j, score });
                }
            }
        }
        
        scores.sort((a, b) => b.score - a.score);
        const usedSources = new Set();
        
        scores.forEach(pair => {
            if (!usedSources.has(pair.sourceIdx) && !usedTargets.has(pair.targetIdx)) {
                pairs.push(pair);
                usedSources.add(pair.sourceIdx);
                usedTargets.add(pair.targetIdx);
            }
        });
        
        return pairs;
    },

    // Сравнение двух строк как множеств слов (индекс Жаккара)
    // Идеально для группировки, когда одно название может быть частью другого (Maximum vs Радио Maximum)
    compareSets(first, second) {
        const t1 = new Set(this.tokenizeAndClean(first).primary);
        const t2 = new Set(this.tokenizeAndClean(second).primary);
        if (t1.size === 0 || t2.size === 0) return 0;
        
        let intersection = 0;
        for (const word of t1) {
            if (t2.has(word)) intersection++;
        }
        const union = t1.size + t2.size - intersection;
        return intersection / union;
    },

    // Оценка качества сведения (0-5)
    evaluateSync(oldData, newData) {
        if (newData.length === 0) return 0; 
        if (oldData.length === 0) return 5; 

        const oldNames = oldData.map(s => s.name || s);
        const newNames = newData.map(s => s.name || s);
        
        const matches = this.matchArrays(oldNames, newNames);
        const matchRate = matches.length / Math.min(oldData.length, newData.length);
        const avgScore = matches.length > 0 ? matches.reduce((acc, m) => acc + m.score, 0) / matches.length : 0;
        
        if (matchRate >= 0.99 && avgScore >= 0.95) return 5; 
        if (matchRate >= 0.75 && avgScore >= 0.7) return 4;  
        if (matchRate >= 0.5 && avgScore >= 0.5) return 3;   
        if (matchRate >= 0.2) return 2;                      
        return 1; 
    },

    // Генерация код-названия (slug)
    generateCodeName(name) {
        if (!name) return '';
        return this.tokenizeAndClean(name).primary.join('_').substring(0, 25);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FMUse;
}