const FMUse = {
    normalizeName(name) {
      if (!name) return '';
      let cleanName = name.toLowerCase();
      cleanName = cleanName.split('\n')[0].split('/')[0];
      cleanName = cleanName.replace(/&#160;|&nbsp;|\u00A0/g, ' ');
      cleanName = cleanName.replace(/\(план\)|\(тест\)|\(был план\)/g, ' ');
      cleanName = cleanName.replace(/\([^)]+\)/g, ' ').replace(/\[[^\]]+\]/g, ' ');
      cleanName = cleanName.replace(/(^|\s)(радио|radio|fm|ам|тв|tv|гтрк|трв|орр)(?=\s|$)/g, ' ');
      cleanName = cleanName.replace(/[^\p{L}\p{N}\s-]/gu, ' ');
      cleanName = cleanName.replace(/[-\s]+/g, ' ').trim();
      return cleanName;
    },
  
    tokenizeAndClean(name) {
      return { primary: this.normalizeName(name).split(' ').filter((w) => w.length > 0) };
    },
  
    wordSimilarity(w1, w2) {
      w1 = w1.replace(/\s+/g, '');
      w2 = w2.replace(/\s+/g, '');
      if (w1 === w2) return 1;
      if (w1.length < 2 || w2.length < 2) return 0;
  
      const firstBigrams = new Map();
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
  
    compareTwoStrings(first, second) {
      const t1 = this.tokenizeAndClean(first);
      const t2 = this.tokenizeAndClean(second);
      const allTokens1 = t1.primary;
      const allTokens2 = t2.primary;
  
      if (allTokens1.length === 0 || allTokens2.length === 0) return 0;
  
      let totalScore = 0;
      const matchedTokens2 = new Array(allTokens2.length).fill(false);
  
      for (const w1 of allTokens1) {
        let bestScore = 0;
        let bestIdx = -1;
        for (let i = 0; i < allTokens2.length; i++) {
          if (matchedTokens2[i]) continue;
          const score = this.wordSimilarity(w1, allTokens2[i]);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
        if (bestIdx !== -1 && bestScore > 0.7) {
          matchedTokens2[bestIdx] = true;
          totalScore += bestScore;
        }
      }
      return totalScore / Math.max(allTokens1.length, allTokens2.length);
    },
  
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
  
      scores.forEach((pair) => {
        if (!usedSources.has(pair.sourceIdx) && !usedTargets.has(pair.targetIdx)) {
          pairs.push(pair);
          usedSources.add(pair.sourceIdx);
          usedTargets.add(pair.targetIdx);
        }
      });
  
      return pairs;
    },
  
    compareSets(first, second) {
      const t1 = new Set(this.tokenizeAndClean(first).primary);
      const t2 = new Set(this.tokenizeAndClean(second).primary);
      if (t1.size === 0 || t2.size === 0) return 0;
  
      let intersection = 0;
      for (const word of t1) {
        if (t2.has(word)) intersection++;
      }
      return intersection / (t1.size + t2.size - intersection);
    },
  
    evaluateSync(oldData, newData) {
      if (newData.length === 0) return 0;
      if (oldData.length === 0) return 5;
  
      const oldNames = oldData.map((s) => s.name || s);
      const newNames = newData.map((s) => s.name || s);
      const matches = this.matchArrays(oldNames, newNames);
      const matchRate = matches.length / Math.min(oldData.length, newData.length);
      const avgScore = matches.length > 0 ? matches.reduce((acc, m) => acc + m.score, 0) / matches.length : 0;
  
      if (matchRate >= 0.99 && avgScore >= 0.95) return 5;
      if (matchRate >= 0.75 && avgScore >= 0.7) return 4;
      if (matchRate >= 0.5 && avgScore >= 0.5) return 3;
      if (matchRate >= 0.2) return 2;
      return 1;
    },
  
    cleanStreamName(name, stationName, cityName, tags) {
      if (!name) return '';
      let cleaned = name.toLowerCase();
  
      const removeStr = (str) => {
        if (!str) return;
        const escapedStr = str.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp(escapedStr, 'g'), ' ');
      };
  
      removeStr(this.normalizeName(stationName));
      removeStr(stationName.toLowerCase());
      removeStr(cityName);
      removeStr(tags);
  
      const junkWords = ['радио', 'radio', 'fm', 'фм', 'ам', 'тв', 'tv', 'гтрк', 'трв', 'орр', 'онлайн', 'online', 'прямой', 'эфир'];
      junkWords.forEach((word) => {
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapedWord}(?![\\p{L}\\p{N}])`, 'gu'), ' ');
      });
  
      cleaned = cleaned.replace(/[\[\]\(\)\{\}]/g, ' ');
      cleaned = cleaned.replace(/[-\/\\|_]+/g, ' ');
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
      return cleaned;
    },
  
    generateCodeName(name) {
      if (!name) return '';
      const slug = this.tokenizeAndClean(name).primary.join('_').substring(0, 25);
      if (!slug) {
        return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').substring(0, 25) || 'station';
      }
      return slug;
    },
  
    evaluateShifts(state, SHIFTS, RU_MIN, RU_MAX) {
      if (state.stations.length === 0) return { statuses: {}, best: 0 };
      if (state.min === RU_MIN && state.max === RU_MAX) return { statuses: {}, best: 0 };
  
      const statuses = {};
      const fullShifts = [];
  
      SHIFTS.forEach((s) => {
        let validCount = 0;
        state.stations.forEach((st) => {
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
        best = [0, 10, 20, 30, 12, 24, 14, 16, 18, 28].find((s) => s > 0 && fullShifts.includes(s)) || Math.min(...fullShifts);
      }
      return { statuses, best: best === -1 ? 0 : best };
    },
  
    calcShiftedFreq(freq, state, RU_MIN, RU_MAX) {
      if (state.shift === 0 || (state.min === RU_MIN && state.max === RU_MAX)) return freq;
      return parseFloat((freq - state.shift).toFixed(2));
    },
  
    formatFreq(f) {
      if (typeof f !== 'number' || isNaN(f)) return '—';
      return f.toFixed(1).replace('.', ',');
    },
  
    isAvailable(freq, state, RU_MIN, RU_MAX) {
      const shifted = this.calcShiftedFreq(freq, state, RU_MIN, RU_MAX);
      return shifted >= state.min && shifted <= state.max;
    },
  
    getDistance(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
      a = Math.min(1, Math.max(0, a));
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }
  };
  
  if (typeof module !== 'undefined' && module.exports) module.exports = FMUse;