const FMUse = {
    // Разбивает название на первичные слова и вторичные (в скобках)
    tokenizeAndClean(name) {
        let cleanName = name.toLowerCase();
        // Удаляем мусорные слова
        cleanName = cleanName.replace(/\b(радио|radio|fm|ам|м|тв|tv)\b/g, ' ');
        
        // Отделяем текст в скобках
        let primaryStr = cleanName.replace(/\([^)]+\)/g, ' ');
        let secondaryStr = (cleanName.match(/\(([^)]+)\)/) || ['', ''])[1];
        
        const splitWords = (str) => str.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 0);
        
        return {
            primary: splitWords(primaryStr),
            secondary: splitWords(secondaryStr)
        };
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
        
        const allTokens1 = [...t1.primary, ...t1.secondary];
        const allTokens2 = [...t2.primary, ...t2.secondary];
        
        if (allTokens1.length === 0 || allTokens2.length === 0) return 0;
        
        // 1. Проверка первичных слов (строгий фильтр)
        if (t1.primary.length > 0 && t2.primary.length > 0) {
            let bestPrimaryScore = 0;
            for (let p1 of t1.primary) {
                for (let p2 of t2.primary) {
                    let s = this.wordSimilarity(p1, p2);
                    if (s > bestPrimaryScore) bestPrimaryScore = s;
                }
            }
            // Если первичные слова не совпали хотя бы на 50% — строки не подходят друг другу
            if (bestPrimaryScore < 0.5) return 0.1; 
        }
        
        // 2. Расчет общего балла похожести по всем словам
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
            if (bestIdx !== -1 && bestScore > 0.5) {
                matchedTokens2[bestIdx] = true;
                totalScore += bestScore;
            }
        }
        
        return totalScore / Math.max(allTokens1.length, allTokens2.length);
    },

    // Сопоставление двух массивов строк 1-к-1
    matchArrays(sourceArr, targetArr, threshold = 0.5) {
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