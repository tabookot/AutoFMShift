// scorch.music.js — alternative / grunge / industrial / bigbeat chiptune module
// Re-tuned for Scorch Arena with soft 16-bit aesthetic and classic 90s riffs.

const LS_MVOL = 'scorch_mvol';
const LS_MSTATE = 'scorch_mstate';
let mVolSaved = NaN;
try { mVolSaved = parseFloat(localStorage.getItem(LS_MVOL)); } catch (e) {}

let mStopped = false;
try { mStopped = localStorage.getItem(LS_MSTATE) === '1'; } catch (e) {}

const MTRACKS = [
  // 1. Alt-Rock / Grunge (Nirvana / Soundgarden style) - drop-D vibe in Dm
  { name: 'Запах жестяной дуэли', artist: 'Душители Клупа', bpm: 116, parts: [
    { rep: 2, ch: [
      { s: 'bass', d: 2, p: 'd2 ~ d2 f2 ~ d2 c2 ~ d2 ~ d2 f2 ~ g2 ab2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd bd sd <hh oh>' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'd4 ~ d4 f4 ~ d4 c4 ~ d4 ~ d4 f4 ~ g4 ab4 g4 f4 ~ d4 f4 ~ d4 c4 ~ d4 ~ f4 ~ g4 ~ f4 ~' },
      { s: 'bass', d: 2, p: 'd2 ~ d2 f2 ~ d2 c2 ~ d2 ~ d2 f2 ~ g2 ab2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd bd sd <hh oh>' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'f4 ~ f4 f4 ~ g4 a4 ~ bb4 ~ bb4 a4 ~ g4 f4 g4 ~ g4 g4 ~ a4 bb4 ~ c5 ~ c5 b4 ~ a4 g4' },
      { s: 'pluck', d: 1, p: 'f3 a3 c4 f4 a3 c4 f3 a3 g3 bb3 d4 g4 bb3 d4 g3 bb3 a3 c4 e4 a4 c4 e4 a3 c4 g3 b3 d4 g4 b3 d4 g3 b3' },
      { s: 'bass', d: 2, p: 'f2 ~ f2 ~ f2 ~ c2 ~ g2 ~ g2 ~ g2 ~ d2 ~ a2 ~ a2 ~ a2 ~ e2 ~ g2 ~ g2 ~ g2 ~ d2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'd5 ~ ~ c5 ~ d5 f5 ~ d5 ~ ~ c5 ~ a4 c5 ~ d5 ~ ~ c5 ~ d5 f5 ~ g5 ~ f5 ~ e5 d5 c5' },
      { s: 'bass', d: 2, p: 'd2 ~ d2 f2 ~ d2 c2 ~ d2 ~ d2 f2 ~ g2 ab2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd bd sd cp' }
    ] }
  ] },

  // 2. Big Beat / Electronic Rock (The Prodigy style) - explosive syncopated synth
  { name: 'Вуду-Фугас', artist: 'Форсаж Свалки', bpm: 136, parts: [
    { rep: 2, ch: [
      { s: 'bass', d: 1, p: 'f#2 ~ f#2 f#2 a2 ~ f#2 ~ c3 ~ f#2 f#2 a2 ~ g2 ~' },
      { s: 'drum', d: 1, p: 'bd ~ ~ bd sd ~ bd ~ ~ bd ~ bd sd ~ hh oh' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 1, p: 'f#4 f#4 c5 f#4 f#4 a4 f#4 ~ f#4 f#4 c5 f#4 eb4 ~ d4 ~ f#4 f#4 c5 f#4 f#4 a4 f#4 ~ c5 ~ b4 ~ a4 ~ g4 ~' },
      { s: 'bass', d: 1, p: 'f#2 ~ f#2 f#2 a2 ~ f#2 ~ c3 ~ f#2 f#2 a2 ~ g2 ~' },
      { s: 'drum', d: 1, p: 'bd ~ ~ bd sd ~ bd ~ ~ bd ~ bd sd ~ hh oh' }
    ] },
    { rep: 2, ch: [
      { s: 'arp', d: 1, p: 'f#3 a3 c4 f#4 c4 a3 f#3 a3 f#3 a3 c4 f#4 c4 a3 f#3 a3 g3 b3 d4 g4 d4 b3 g3 b3 g3 b3 d4 g4 d4 b3 g3 b3' },
      { s: 'lead', d: 2, p: 'a4 ~ a4 ~ c5 ~ a4 ~ g4 ~ f#4 ~ e4 ~ d4 ~ a4 ~ a4 ~ c5 ~ d5 ~ eb5 ~ d5 ~ c5 ~ a4 ~' },
      { s: 'bass', d: 2, p: 'f#2 ~ f#2 ~ c3 ~ f#2 ~ g2 ~ g2 ~ d3 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd bd sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 1, p: 'f#4 f#4 c5 f#4 f#4 a4 f#4 ~ f#4 f#4 c5 f#4 eb4 ~ d4 ~ f#4 f#4 c5 f#4 f#4 a4 f#4 ~ c5 ~ b4 ~ a4 ~ g4 ~' },
      { s: 'bass', d: 1, p: 'f#2 ~ f#2 f#2 a2 ~ f#2 ~ c3 ~ f#2 f#2 a2 ~ g2 ~' },
      { s: 'drum', d: 1, p: 'bd bd sd bd bd bd sd cp bd bd sd bd bd bd sd <sd cp>' }
    ] }
  ] },

  // 3. Industrial / Cyber-Rock (Nine Inch Nails / Rammstein) - heavy mechanical drive
  { name: 'Ржавый Гвоздь', artist: 'Цех Тяжёлого Машиностроения', bpm: 128, parts: [
    { rep: 2, ch: [
      { s: 'bass', d: 1, p: 'e2 e2 e2 ~ e2 e2 g2 ~ e2 e2 e2 ~ bb2 ~ a2 ~' },
      { s: 'drum', d: 1, p: 'bd ~ sd ~ bd bd sd ~ bd ~ sd ~ bd bd sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 1, p: 'e4 e4 g4 e4 ~ e4 bb4 a4 e4 e4 g4 e4 d4 ~ b3 ~ e4 e4 g4 e4 ~ e4 bb4 a4 g4 ~ f#4 ~ e4 ~ d4 ~' },
      { s: 'bass', d: 1, p: 'e2 e2 e2 ~ e2 e2 g2 ~ e2 e2 e2 ~ bb2 ~ a2 ~' },
      { s: 'drum', d: 1, p: 'bd ~ sd ~ bd bd sd ~ bd ~ sd ~ bd bd sd cp' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{c3@14 e3@14 g3@14} ~ ~ ~ {b2@14 d3@14 f#3@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~ {b2@14 d3@14 f#3@14} ~ ~ ~' },
      { s: 'pluck', d: 2, p: 'e4 ~ g4 ~ b4 ~ e5 ~ d5 ~ b4 ~ g4 ~ f#4 ~ c5 ~ b4 ~ a4 ~ g4 ~ f#4 ~ d4 ~ e4 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'c2 ~ c2 ~ g2 ~ c2 ~ b2 ~ b2 ~ f#2 ~ b2 ~ a2 ~ a2 ~ e2 ~ a2 ~ b2 ~ b2 ~ f#2 ~ b2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 1, p: 'e4 e4 g4 e4 ~ e4 bb4 a4 e4 e4 g4 e4 d4 ~ b3 ~ e4 e4 g4 e4 ~ e4 bb4 a4 g4 ~ f#4 ~ e4 ~ d4 ~' },
      { s: 'bass', d: 1, p: 'e2 e2 e2 ~ e2 e2 g2 ~ e2 e2 e2 ~ bb2 ~ a2 ~' },
      { s: 'drum', d: 1, p: 'bd ~ sd ~ bd bd sd ~ bd ~ sd ~ bd bd sd cp' }
    ] }
  ] },

  // 4. Nu-Metal / Heavy Groove (Korn / Deftones) - dark downtuned atmospheric bounce
  { name: 'Подача Слепых', artist: 'Яма Вейл', bpm: 98, parts: [
    { rep: 2, ch: [
      { s: 'bass', d: 1, p: 'c#2 c#2 ~ c#2 d2 ~ c#2 ~ c#2 c#2 ~ c#2 g2 ~ f#2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ ~ sd ~ bd sd ~' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'c#4 ~ c#4 d4 ~ c#4 ~ ~ c#4 ~ c#4 g4 ~ f#4 ~ c#4 ~ c#4 d4 ~ c#4 ~ ~ f#4 ~ f4 ~ e4 ~ d4 ~' },
      { s: 'bass', d: 1, p: 'c#2 c#2 ~ c#2 d2 ~ c#2 ~ c#2 c#2 ~ c#2 g2 ~ f#2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ hh sd bd ~ sd <hh oh>' }
    ] },
    { rep: 2, ch: [
      { s: 'bell', d: 2, p: 'g#5 ~ f#5 ~ e5 ~ d#5 ~ c#5 ~ ~ ~ ~ ~ ~ ~ f#5 ~ e5 ~ d#5 ~ c#5 ~ b4 ~ ~ ~ ~ ~ ~ ~' },
      { s: 'pad', d: 4, p: '{f#2@14 a2@14 c#3@14} ~ ~ ~ {g#2@14 b2@14 d#3@14} ~ ~ ~ {a2@14 c#3@14 e3@14} ~ ~ ~ {g#2@14 b2@14 d#3@14} ~ ~ ~' },
      { s: 'bass', d: 2, p: 'f#2 ~ f#2 ~ c#3 ~ f#2 ~ g#2 ~ g#2 ~ d#3 ~ g#2 ~ a2 ~ a2 ~ e3 ~ a2 ~ g#2 ~ g#2 ~ d#3 ~ g#2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ sd ~ bd ~ sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'c#4 ~ c#4 d4 ~ c#4 ~ ~ c#4 ~ c#4 g4 ~ f#4 ~ c#4 ~ c#4 d4 ~ c#4 ~ ~ f#4 ~ f4 ~ e4 ~ d4 ~' },
      { s: 'bass', d: 1, p: 'c#2 c#2 ~ c#2 d2 ~ c#2 ~ c#2 c#2 ~ c#2 g2 ~ f#2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ hh sd bd ~ sd cp' }
    ] }
  ] },

  // 5. Melodic Death Metal / Metal Riffing (Amorphis / Carcass) - melancholic fast lead
  { name: 'Элегия Бесконечной Зимы', artist: 'Охладители Кратера', bpm: 144, parts: [
    { rep: 2, ch: [
      { s: 'arp', d: 1, p: 'b2 f#3 b3 d4 f#4 d4 b3 f#3 b2 f#3 b3 d4 f#4 d4 b3 f#3 g2 d3 g3 b3 d4 b3 g3 d3 a2 e3 a3 c#4 e4 c#4 a3 e3' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'f#5 ~ e5 d5 c#5 ~ d5 ~ e5 ~ f#5 ~ d5 ~ b4 ~ c#5 ~ d5 ~ e5 ~ c#5 ~ a4 ~ b4 ~ ~ ~ ~ ~ ~ ~' },
      { s: 'bass', d: 2, p: 'b2 ~ b2 ~ f#2 ~ b2 ~ g2 ~ g2 ~ d3 ~ g2 ~ a2 ~ a2 ~ e3 ~ a2 ~ f#2 ~ f#2 ~ c#3 ~ f#2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'd5 ~ f#5 ~ a5 ~ g5 f#5 e5 ~ g5 ~ b5 ~ a5 g5 f#5 ~ a5 ~ d6 ~ c#6 b5 a5 ~ b5 ~ ~ ~ ~ ~ ~ ~' },
      { s: 'arp', d: 1, p: 'd3 f#3 a3 d4 a3 f#3 d3 f#3 g3 b3 d4 g4 d4 b3 g3 b3 a3 c#4 e4 a4 e4 c#4 a3 c#4 b2 f#3 b3 d4 f#4 d4 b3 f#3' },
      { s: 'bass', d: 2, p: 'd2 ~ d2 ~ a2 ~ d2 ~ g2 ~ g2 ~ d3 ~ g2 ~ a2 ~ a2 ~ e3 ~ a2 ~ b2 ~ b2 ~ f#2 ~ b2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'f#5 ~ e5 d5 c#5 ~ d5 ~ e5 ~ f#5 ~ d5 ~ b4 ~ c#5 ~ d5 ~ e5 ~ c#5 ~ a4 ~ b4 ~ ~ ~ ~ ~ ~ ~' },
      { s: 'bass', d: 2, p: 'b2 ~ b2 ~ f#2 ~ b2 ~ g2 ~ g2 ~ d3 ~ g2 ~ a2 ~ a2 ~ e3 ~ a2 ~ f#2 ~ f#2 ~ c#3 ~ f#2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] }
  ] },

  // 6. Funk-Metal / Alt-Funk (Red Hot Chili Peppers / Faith No More) - bouncy bassline
  { name: 'Заряд в Печенку', artist: 'Басисты Завода', bpm: 108, parts: [
    { rep: 2, ch: [
      { s: 'bass', d: 1, p: 'a2 ~ a2 c3 ~ a2 d3 ~ a2 ~ a2 c3 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd <hh oh>' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'a4 ~ c5 ~ d5 ~ e5 ~ g5 ~ e5 ~ d5 c5 a4 ~ a4 ~ c5 ~ d5 ~ eb5 ~ d5 ~ c5 ~ a4 ~ ~ ~' },
      { s: 'bass', d: 1, p: 'a2 ~ a2 c3 ~ a2 d3 ~ a2 ~ a2 c3 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 2, ch: [
      { s: 'pluck', d: 2, p: 'c5 ~ e5 ~ g5 ~ a5 ~ g5 ~ e5 ~ c5 ~ d5 ~ d5 ~ f5 ~ a5 ~ c6 ~ a5 ~ f5 ~ d5 ~' },
      { s: 'bass', d: 2, p: 'c2 ~ c2 ~ g2 ~ c2 ~ e2 ~ e2 ~ b2 ~ e2 ~ d2 ~ d2 ~ a2 ~ d2 ~ f2 ~ f2 ~ c3 ~ f2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'a4 ~ c5 ~ d5 ~ e5 ~ g5 ~ e5 ~ d5 c5 a4 ~ a4 ~ c5 ~ d5 ~ eb5 ~ d5 ~ c5 ~ a4 ~ ~ ~' },
      { s: 'bass', d: 1, p: 'a2 ~ a2 c3 ~ a2 d3 ~ a2 ~ a2 c3 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] }
  ] },

  // 7. Trip-Hop / Dark Downtempo (Massive Attack / Portishead style) - atmospheric chill
  { name: 'Ночной Обстрел Радаров', artist: 'Призраки Эфира', bpm: 82, parts: [
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{c3@14 eb3@14 g3@14} ~ ~ ~ {ab2@14 c3@14 eb3@14} ~ ~ ~ {f2@14 ab2@14 c3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'drum', d: 2, p: 'bd ~ ~ ~ sd ~ ~ hh' }
    ] },
    { rep: 2, ch: [
      { s: 'bell', d: 2, p: 'g5 ~ ~ ~ eb5 ~ ~ ~ c5 ~ ~ ~ b4 ~ ~ ~ ab4 ~ ~ ~ c5 ~ ~ ~ g4 ~ ~ ~ ~ ~ ~ ~' },
      { s: 'pad', d: 4, p: '{c3@14 eb3@14 g3@14} ~ ~ ~ {ab2@14 c3@14 eb3@14} ~ ~ ~ {f2@14 ab2@14 c3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'bass', d: 4, p: 'c2 ~ ~ ~ ab2 ~ ~ ~ f2 ~ ~ ~ g2 ~ ~ ~' },
      { s: 'drum', d: 2, p: 'bd ~ ~ hh sd ~ ~ hh' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'c5 ~ ~ eb5 ~ ~ d5 ~ c5 ~ bb4 ~ ab4 ~ g4 ~ c5 ~ ~ eb5 ~ ~ f5 ~ g5 ~ ~ ~ ~ ~ ~ ~' },
      { s: 'pluck', d: 1, p: 'c3 eb3 g3 c4 eb3 g3 c3 eb3 ab2 c3 eb3 ab3 eb3 c3 ab2 c3 f2 ab2 c3 f3 c3 ab2 f2 ab2 g2 b2 d3 g3 d3 b2 g2 b2' },
      { s: 'bass', d: 4, p: 'c2 ~ ~ ~ ab2 ~ ~ ~ f2 ~ ~ ~ g2 ~ ~ ~' },
      { s: 'drum', d: 2, p: 'bd ~ ~ hh sd ~ ~ <hh oh>' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{c3@14 eb3@14 g3@14} ~ ~ ~ {ab2@14 c3@14 eb3@14} ~ ~ ~ {f2@14 ab2@14 c3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'drum', d: 2, p: 'bd ~ ~ ~ sd ~ ~ hh' }
    ] }
  ] },

  // 8. Synth-Metal / Industrial DnB (Prodigy / Celldweller style) - hyper active roll
  { name: 'Турбо-Таран', artist: 'Кибернетика Гнева', bpm: 165, parts: [
    { rep: 2, ch: [
      { s: 'bass', d: 1, p: 'e2 e2 e3 e2 e2 e3 e2 e2 g2 g2 g3 g2 a2 a2 a3 a2' },
      { s: 'drum', d: 1, p: 'bd ~ ~ sd ~ ~ bd ~ ~ bd ~ sd ~ ~ sd ~' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'e5 ~ e5 g5 ~ e5 ~ d5 ~ e5 ~ b4 ~ d5 ~ e5 ~ e5 g5 ~ a5 ~ b5 ~ a5 g5 e5 ~ ~ ~' },
      { s: 'bass', d: 1, p: 'e2 e2 e3 e2 e2 e3 e2 e2 g2 g2 g3 g2 a2 a2 a3 a2' },
      { s: 'drum', d: 1, p: 'bd ~ ~ sd ~ ~ bd ~ ~ bd ~ sd ~ ~ sd cp' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'c6 ~ b5 a5 g5 ~ a5 ~ b5 ~ a5 g5 e5 ~ d5 ~ c5 ~ e5 ~ g5 ~ a5 ~ b5 ~ c6 ~ d6 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'c3 e3 g3 c4 g3 e3 c3 e3 g3 b3 d4 g4 d4 b3 g3 b3 a3 c4 e4 a4 e4 c4 a3 c4 e3 g3 b3 e4 b3 g3 e3 g3' },
      { s: 'bass', d: 2, p: 'c2 ~ c2 ~ g2 ~ c2 ~ g2 ~ g2 ~ d3 ~ g2 ~ a2 ~ a2 ~ e3 ~ a2 ~ e2 ~ e2 ~ b2 ~ e2 ~' },
      { s: 'drum', d: 1, p: 'bd ~ ~ sd ~ ~ bd ~ ~ bd ~ sd ~ ~ sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'e5 ~ e5 g5 ~ e5 ~ d5 ~ e5 ~ b4 ~ d5 ~ e5 ~ e5 g5 ~ a5 ~ b5 ~ a5 g5 e5 ~ ~ ~' },
      { s: 'bass', d: 1, p: 'e2 e2 e3 e2 e2 e3 e2 e2 g2 g2 g3 g2 a2 a2 a3 a2' },
      { s: 'drum', d: 1, p: 'bd ~ ~ sd ~ ~ bd ~ ~ bd ~ sd ~ ~ sd cp' }
    ] }
  ] },

  // 9. Post-Grunge / Melodic Rock (Deftones / Foo Fighters) - driving atmospheric chorus
  { name: 'Сигнал над Горизонтом', artist: 'Обитатели Купола', bpm: 122, parts: [
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{f#2@14 a2@14 c#3@14} ~ ~ ~ {d2@14 f#2@14 a2@14} ~ ~ ~ {a2@14 c#3@14 e3@14} ~ ~ ~ {e2@14 g#2@14 b2@14} ~ ~ ~' },
      { s: 'pluck', d: 2, p: 'f#3 ~ c#4 ~ a3 ~ c#4 ~ d3 ~ a3 ~ f#3 ~ a3 ~ a3 ~ e4 ~ c#4 ~ e4 ~ e3 ~ b3 ~ g#3 ~ b3 ~' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'f#4 ~ f#4 a4 ~ f#4 e4 ~ f#4 ~ a4 ~ b4 ~ c#5 ~ a4 ~ ~ ~ f#4 ~ e4 ~ f#4 ~ a4 ~ b4 ~ g#4 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'f#2 ~ f#2 ~ c#3 ~ f#2 ~ d2 ~ d2 ~ a2 ~ d2 ~ a2 ~ a2 ~ e3 ~ a2 ~ e2 ~ e2 ~ b2 ~ e2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'c#5 ~ c#5 ~ d5 ~ e5 ~ f#5 ~ e5 ~ d5 ~ c#5 ~ b4 ~ b4 ~ c#5 ~ d5 ~ e5 ~ d5 ~ c#5 ~ b4 ~' },
      { s: 'arp', d: 1, p: 'f#3 a3 c#4 f#4 c#4 a3 f#3 a3 d3 f#3 a3 d4 a3 f#3 d3 f#3 a3 c#4 e4 a4 e4 c#4 a3 c#4 e3 g#3 b3 e4 b3 g#3 e3 g#3' },
      { s: 'bass', d: 2, p: 'f#2 ~ f#2 ~ c#3 ~ f#2 ~ d2 ~ d2 ~ a2 ~ d2 ~ a2 ~ a2 ~ e3 ~ a2 ~ e2 ~ e2 ~ b2 ~ e2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'f#4 ~ f#4 a4 ~ f#4 e4 ~ f#4 ~ a4 ~ b4 ~ c#5 ~ a4 ~ ~ ~ f#4 ~ e4 ~ f#4 ~ a4 ~ b4 ~ g#4 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'f#2 ~ f#2 ~ c#3 ~ f#2 ~ d2 ~ d2 ~ a2 ~ d2 ~ a2 ~ a2 ~ e3 ~ a2 ~ e2 ~ e2 ~ b2 ~ e2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] }
  ] },

  // SPLASH THEME: Calm, ambient & slow - background starfield loop
  { name: 'Забытые Координаты', artist: 'Кочевники Пепла', splash: true, bpm: 68, parts: [
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'bell', d: 4, p: '~ ~ ~ ~ e5@6 ~ ~ ~ ~ ~ ~ ~ c5@6 ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'pluck', d: 2, p: 'a3 ~ e4 ~ c4 ~ e4 ~ f3 ~ c4 ~ a3 ~ c4 ~ g3 ~ c4 ~ e4 ~ c4 ~ g3 ~ d4 ~ b3 ~ d4 ~' },
      { s: 'bell', d: 2, p: 'e5 ~ ~ ~ ~ ~ ~ ~ c5 ~ ~ ~ ~ ~ ~ ~ d5 ~ ~ ~ ~ ~ ~ ~ b4 ~ ~ ~ ~ ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{d3@14 f3@14 a3@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~ {e2@14 g#2@14 b2@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~' },
      { s: 'bell', d: 2, p: 'd5 ~ ~ ~ ~ ~ ~ ~ c5 ~ ~ ~ ~ ~ ~ ~ b4 ~ ~ ~ a4 ~ ~ ~ e4 ~ ~ ~ ~ ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~' },
      { s: 'pluck', d: 2, p: 'a3 ~ e4 ~ c4 ~ e4 ~ f3 ~ c4 ~ a3 ~ c4 ~ g3 ~ c4 ~ e4 ~ c4 ~ g3 ~ d4 ~ b3 ~ d4 ~' }
    ] }
  ] }
];

// ================= notation: the mini-notation parser =================
const MDRUM = { bd: 1, sd: 1, hh: 1, oh: 1, cp: 1, tm: 1 };
function mNoteHz(n) {
  const m = /^([a-g])([#b]?)(\d)$/.exec(n);
  if (!m) return 0;
  const st = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (st + (+m[3] + 1) * 12 - 69) / 12);
}
function mAtom(t) {
  if (t === '~' || t === '.') return null;
  const m = /^([^@*]+?)(?:@([\d.]+))?(?:\*(\d+))?$/.exec(t);
  if (!m) return null;
  const a = { sus: m[2] ? +m[2] : 0, rep: m[3] ? +m[3] : 1 };
  if (MDRUM[m[1]]) a.d = m[1];
  else {
    const h = /^([a-g][#b]?)(\d)?$/.exec(m[1]);
    if (!h) return null;
    a.f = mNoteHz(h[1] + (h[2] || '4'));
  }
  return a;
}
function mParse(pat, div) {
  const toks = pat.replace(/([\[\]<>{}])/g, ' $1 ').trim().split(/\s+/).filter(Boolean);
  const map = {};
  const read = (i, close) => {
    const items = [];
    while (i < toks.length) {
      const t = toks[i];
      if (close && t === close) return [items, i + 1];
      if (t === ']' || t === '>' || t === '}') { i++; continue; }
      if (t === '[' || t === '{' || t === '<') {
        const cl = { '[': ']', '{': '}', '<': '>' }[t];
        const g = read(i + 1, cl);
        items.push(t === '[' ? { g: g[0] } : t === '{' ? { p: g[0] } : { a: g[0] });
        i = g[1];
        continue;
      }
      items.push(t);
      i++;
    }
    return [items, i];
  };
  const top = read(0, null)[0];
  const len = top.length ? top.length * div * 4 : 4;
  const put = (pos, a, slot) => {
    a.dur = a.sus > 0 ? a.sus * 4 : Math.max(1, Math.round(slot));
    const k = Math.round(pos);
    (map[k] || (map[k] = [])).push(a);
  };
  const place = (items, at, span) => {
    const n = items.length || 1;
    items.forEach((it, k) => {
      const s0 = at + span * k / n;
      const sw = span / n;
      if (typeof it === 'string') {
        const a = mAtom(it);
        if (!a) return;
        if (a.rep > 1) for (let q = 0; q < a.rep; q++) put(s0 + sw * q / a.rep, { ...a, rep: 1, sus: 0 }, sw / a.rep);
        else put(s0, a, sw);
      } else if (it.g) place(it.g, s0, sw);
      else if (it.p) it.p.forEach(x => { if (typeof x === 'string') { const a = mAtom(x); if (a) put(s0, a, sw); } });
      else if (it.a) put(s0, { alt: it.a.map(x => (typeof x === 'string' ? mAtom(x) : null)) }, sw);
    });
  };
  place(top, 0, len);
  return { map, len };
}

// ================= sound design: non-harsh rounded synthesis =================
let mNoiseBuf = null;
function mNoise(t, dur, type, fq, v) {
  const src = AC.createBufferSource();
  src.buffer = mNoiseBufGet();
  const f = AC.createBiquadFilter();
  f.type = type;
  f.frequency.value = fq;
  const g = AC.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(mBus);
  src.start(t, Math.random() * 0.4, dur + 0.02);
}

function mDrum(t, d) {
  if (d === 'hh') return mNoise(t, 0.035, 'highpass', 6000, 0.10);
  if (d === 'oh') return mNoise(t, 0.12, 'highpass', 5000, 0.09);
  if (d === 'sd') return mNoise(t, 0.11, 'bandpass', 1500, 0.22);
  if (d === 'cp') return mNoise(t, 0.08, 'bandpass', 1000, 0.20);
  const o = AC.createOscillator(), g = AC.createGain();
  const bd = d === 'bd';
  o.type = 'sine';
  o.frequency.setValueAtTime(bd ? 130 : 280, t);
  o.frequency.exponentialRampToValueAtTime(bd ? 38 : 130, t + (bd ? 0.14 : 0.16));
  g.gain.setValueAtTime(bd ? 0.45 : 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (bd ? 0.16 : 0.18));
  o.connect(g); g.connect(mBus);
  o.start(t); o.stop(t + 0.22);
}

function mTone(t, f, dur, v, o) {
  o = o || {};
  const osc = AC.createOscillator();
  osc.type = o.type || 'triangle';
  osc.frequency.value = f;
  if (o.det) osc.detune.value = o.det;
  let node = osc;
  if (o.cut) {
    const flt = AC.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = o.cut;
    osc.connect(flt); node = flt;
  }
  const g = AC.createGain();
  const a = o.att || 0.01;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + a);
  g.gain.setValueAtTime(v, t + Math.max(a, dur * 0.7));
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
  node.connect(g); g.connect(mBus);
  if (o.echo && mDelay) {
    const s = AC.createGain();
    s.gain.value = o.echo;
    g.connect(s); s.connect(mDelay);
  }
  if (o.vib) {
    const lf = AC.createOscillator();
    lf.frequency.value = 5.2;
    const lg = AC.createGain();
    lg.gain.value = o.vib;
    lf.connect(lg); lg.connect(osc.detune);
    lf.start(t); lf.stop(t + dur + 0.05);
  }
  osc.start(t); osc.stop(t + dur + 0.05);
}

// Warm, rich voices tuned specifically to avoid annoying high-register squeaks
const MVOICE = {
  lead: (t, f, d) => mTone(t, f, Math.max(d, 0.14), 0.15, { type: 'sawtooth', cut: 1800, vib: 7, echo: 0.20 }),
  pluck: (t, f, d) => mTone(t, f, 0.16, 0.14, { type: 'triangle', cut: 2400, echo: 0.18 }),
  arp: (t, f, d) => mTone(t, f, 0.12, 0.10, { type: 'sawtooth', cut: 2200, echo: 0.22 }),
  bass: (t, f, d) => mTone(t, f, Math.min(Math.max(d, 0.18), 0.45), 0.26, { type: 'sawtooth', cut: 650 }),
  bell: (t, f, d) => { mTone(t, f, Math.max(d, 0.35), 0.10, { type: 'sine', vib: 4, echo: 0.28 }); mTone(t, f * 2, d, 0.03, { type: 'sine', echo: 0.25 }); },
  pad: (t, f, d) => { mTone(t, f, d * 1.2, 0.06, { type: 'sawtooth', det: -6, att: 0.2, cut: 900 }); mTone(t, f, d * 1.2, 0.06, { type: 'sawtooth', det: 6, att: 0.22, cut: 900 }); }
};

// ============ shot sounds: the launch punch + the flight loops ============
const MSHOT = {
  missile: { n: [1600, 'bandpass', 500], f: 130, fd: 45, dur: 0.13 },
  funky:   { n: [2800, 'highpass', 1400], f: 240, fd: 110, dur: 0.09 },
  death:   { n: [600, 'lowpass', 180], f: 75, fd: 28, dur: 0.28 },
  nuke:    { n: [380, 'lowpass', 110], f: 60, fd: 22, dur: 0.36 },
  plasma:  { n: [3400, 'bandpass', 900], f: 620, fd: 140, dur: 0.2, ot: 'square' },
  napalm:  { n: [800, 'lowpass', 260], f: 160, fd: 60, dur: 0.15 },
  roller:  { n: [1000, 'bandpass', 320], f: 110, fd: 50, dur: 0.14 },
  digger:  { n: [900, 'bandpass', 2400], f: 150, fd: 330, dur: 0.22, ot: 'sawtooth' },
  dirt:    { n: [450, 'lowpass', 140], f: 95, fd: 35, dur: 0.2 },
  mirv:    { n: [2000, 'bandpass', 700], f: 170, fd: 80, dur: 0.12 }
};

const MFLY = {
  missile: { mode: 'noise', fq: 1300, ft: 'bandpass', lfo: 700 },
  funky:   { mode: 'noise', fq: 2500, ft: 'highpass' },
  death:   { mode: 'noise', fq: 240, ft: 'lowpass', am: 5 },
  nuke:    { mode: 'osc', f0: 66, f1: 88, vib: 0.35 },
  plasma:  { mode: 'noise', fq: 4200, ft: 'highpass', am: 24 },
  napalm:  { mode: 'noise', fq: 950, ft: 'lowpass', am: 8 },
  roller:  { mode: 'noise', fq: 210, ft: 'lowpass', am: 6 },
  digger:  { mode: 'osc', f0: 135, f1: 168, saw: true, am: 11 },
  dirt:    { mode: 'noise', fq: 480, ft: 'lowpass' },
  mirv:    { mode: 'osc', f0: 1500, f1: 850 }
};

let mFly = null;

function mBlastVol(w) { return clamp(0.12 * ((w && w.r) || 30) / 45, 0.06, 0.5) * sVol; }

function mNoiseBufGet() {
  if (!mNoiseBuf) {
    mNoiseBuf = AC.createBuffer(1, AC.sampleRate | 0, AC.sampleRate);
    const d = mNoiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return mNoiseBuf;
}

function shotLaunchSfx(w) {
  if (!AC || AC.state !== 'running') return;
  const c = MSHOT[w.type] || MSHOT.missile;
  const t = AC.currentTime;
  const src = AC.createBufferSource();
  src.buffer = mNoiseBufGet();
  const flt = AC.createBiquadFilter();
  flt.type = c.n[1];
  flt.frequency.setValueAtTime(c.n[0], t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(60, c.n[2]), t + c.dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(mBlastVol(w) * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + c.dur);
  src.connect(flt); flt.connect(g); g.connect(AC.destination);
  src.start(t, Math.random() * 0.4, c.dur + 0.02);
  const o = AC.createOscillator();
  o.type = c.ot || 'sine';
  o.frequency.setValueAtTime(c.f, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, c.fd), t + c.dur);
  const og = AC.createGain();
  og.gain.setValueAtTime(mBlastVol(w) * 0.4, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + c.dur + 0.04);
  o.connect(og); og.connect(AC.destination);
  o.start(t); o.stop(t + c.dur + 0.06);
}

function mFlyStop() {
  if (!mFly) return;
  const f = mFly;
  mFly = null;
  try {
    const t = AC.currentTime;
    f.g.gain.cancelScheduledValues(t);
    f.g.gain.setValueAtTime(f.g.gain.value, t);
    f.g.gain.linearRampToValueAtTime(0, t + 0.08);
    [f.src, f.osc, f.lfo, f.am].forEach(n => { if (n) { try { n.stop(t + 0.12); } catch (e) {} } });
    setTimeout(() => { try { f.g.disconnect(); } catch (e) {} }, 250);
  } catch (e) {}
}

function flySync() {
  let w = null;
  if (shot && !shot.dead) w = shot.w;
  else for (let i = subshots.length - 1; i >= 0; i--) if (!subshots[i].dead) { w = subshots[i].w; break; }
  if (!w) { mFlyStop(); return; }
  if (mFly && mFly.type === w.type) return;
  mFlyStop();
  if (!AC || AC.state !== 'running') return;
  const c = MFLY[w.type] || MFLY.missile;
  const g = AC.createGain();
  g.gain.value = mBlastVol(w) * 0.125;
  g.connect(AC.destination);
  const f = { type: w.type, g };
  if (c.mode === 'osc') {
    const o = AC.createOscillator();
    o.type = c.saw ? 'sawtooth' : 'sine';
    o.frequency.setValueAtTime(c.f0, AC.currentTime);
    o.frequency.linearRampToValueAtTime(c.f1, AC.currentTime + 2.5);
    o.connect(g);
    o.start();
    f.osc = o;
    if (c.vib) {
      const lf = AC.createOscillator();
      lf.frequency.value = c.vib;
      const lg = AC.createGain();
      lg.gain.value = Math.max(1, c.f0 * 0.05);
      lf.connect(lg); lg.connect(o.frequency);
      lf.start();
      f.lfo = lf;
    }
  } else {
    const src = AC.createBufferSource();
    src.buffer = mNoiseBufGet();
    src.loop = true;
    const flt = AC.createBiquadFilter();
    flt.type = c.ft;
    flt.frequency.value = c.fq;
    src.connect(flt); flt.connect(g);
    src.start();
    f.src = src;
    if (c.lfo) {
      const lf = AC.createOscillator();
      lf.frequency.value = 1.6;
      const lg = AC.createGain();
      lg.gain.value = c.lfo * 0.5;
      lf.connect(lg); lg.connect(flt.frequency);
      lf.start();
      f.lfo = lf;
    }
  }
  if (c.am) {
    const am = AC.createOscillator();
    am.frequency.value = c.am;
    const ag = AC.createGain();
    ag.gain.value = mBlastVol(w) * 0.05;
    am.connect(ag); ag.connect(g.gain);
    am.start();
    f.am = am;
  }
  mFly = f;
}

// ================= the player =================
let mOn = false, mTimer = null, mGain = null, mDelay = null, mFB = null, mBus = null;
let mAnalyser = null;
let mTrack = -1, mOrder = [], mPos = 0, mExt = false, mFollow = false, mPaused = false;
let mPart = 0, mPass = 0, mQ = 0, mNextT = 0, mCur = null;
let mSess = false;
const mCache = {};
const mPool = MTRACKS.map((t, i) => (t.splash ? -1 : i)).filter(i => i >= 0);

function musicVol() { return isNaN(mVolSaved) ? 0.005 : clamp(mVolSaved, 0, 1); }
function musicSync() { if (mGain) mGain.gain.value = musicVol(); }
function musicSetVol(v) {
  mVolSaved = clamp(v, 0, 1);
  try { localStorage.setItem(LS_MVOL, String(mVolSaved)); } catch (e) {}
  musicSync();
}

const mSessActs = {
  play: () => { if (!mOn) musicStart(); musicResume(); },
  pause: () => musicPause(),
  previoustrack: () => musicSkip(-1),
  nexttrack: () => musicSkip(1),
  stop: () => musicHalt()
};

function mSessionMeta() {
  if (!mSess || !('mediaSession' in navigator)) return;
  const tr = MTRACKS[mTrack];
  if (!tr) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: tr.name, artist: tr.artist || '', album: 'Scorch Arena' });
  } catch (e) {}
}

function mSessionSet(on) {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  const acts = ['play', 'pause', 'previoustrack', 'nexttrack', 'stop'];
  if (on) {
    mSessionMeta();
    acts.forEach(a => { try { ms.setActionHandler(a, mSessActs[a]); } catch (e) {} });
    try { ms.playbackState = mPaused ? 'paused' : 'playing'; } catch (e) {}
  } else {
    acts.forEach(a => { try { ms.setActionHandler(a, null); } catch (e) {} });
    try { ms.metadata = null; } catch (e) {}
    try { ms.playbackState = 'none'; } catch (e) {}
  }
}

function mSessionSync() {
  if (!('mediaSession' in navigator)) return;
  const want = mOn && !mExt;
  if (want !== mSess) {
    mSess = want;
    mSessionSet(want);
  } else if (mSess) {
    try { navigator.mediaSession.playbackState = mPaused ? 'paused' : 'playing'; } catch (e) {}
  }
}

function musicExternal(on) {
  const v = !!on;
  if (v === mExt) return;
  mExt = v;
  mSessionSync();
}

function musicAnalyserOn() { return !!(mOn && mAnalyser && mGain && mGain.gain.value > 0.0005); }
function musicAnalyser() { return mAnalyser || null; }
function musicAlive() { return mOn; }
function mgcd(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }

function mShuffle() {
  mOrder = mPool.slice();
  for (let i = mOrder.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const q = mOrder[i]; mOrder[i] = mOrder[j]; mOrder[j] = q;
  }
  mPos = 0;
}

function mCompile(i) {
  if (mCache[i]) return mCache[i];
  const tr = MTRACKS[i];
  const parts = (tr.parts || [{ rep: tr.bars || 4, ch: tr.ch }]).map(pt => {
    const chs = pt.ch.map(c => { const p = mParse(c.p, c.d || 1); return { s: c.s, map: p.map, len: Math.max(4, p.len) }; });
    const lcm = chs.reduce((a, c) => a * c.len / mgcd(a, c.len), 1);
    return { chs, len: lcm, rep: Math.max(1, pt.rep || 1) };
  });
  const sd = 60 / tr.bpm / 4;
  let acc = 0;
  const starts = parts.map(p => { const s = acc; acc += p.len * p.rep * sd / 4; return s; });
  return mCache[i] = { parts, starts, total: acc, stepDur: sd, delay: sd * 3 };
}

function musicTrackDur(i) {
  const t = MTRACKS[i];
  return t ? (mCache[i] || mCompile(i)).total || 0 : 0;
}

function mNewBus() {
  const b = AC.createGain();
  b.gain.value = 1;
  b.connect(mGain);
  return b;
}

function mCut() {
  if (!AC || !mGain) return;
  const t = AC.currentTime;
  if (mBus) {
    const ob = mBus;
    try {
      ob.gain.cancelScheduledValues(t);
      ob.gain.setValueAtTime(ob.gain.value, t);
      ob.gain.linearRampToValueAtTime(0, t + 0.05);
    } catch (e) {}
    setTimeout(() => { try { ob.disconnect(); } catch (e) {} }, 180);
  }
  mBus = mNewBus();
  if (mDelay) {
    try { mDelay.disconnect(); mFB.disconnect(); } catch (e) {}
    mDelay = AC.createDelay(1);
    mFB = AC.createGain();
    mFB.gain.value = 0.25;
    mDelay.connect(mFB);
    mFB.connect(mDelay);
    mDelay.connect(mGain);
    try { mDelay.delayTime.value = mCur ? mCur.delay : 0.2; } catch (e) {}
  }
}

function musicNext() {
  if (!mPool.length) return;
  if (mPos >= mOrder.length) mShuffle();
  mTrack = mOrder[mPos++];
  mCur = mCompile(mTrack);
  mPart = 0; mPass = 0; mQ = 0;
  mFollow = false;
  mPaused = false;
  mStopped = false;
  try { localStorage.removeItem(LS_MSTATE); } catch (e) {}
  mCut();
  mNextT = AC ? AC.currentTime + 0.2 : 0;
  if (mDelay && AC) mDelay.delayTime.setTargetAtTime(mCur.delay, AC.currentTime, 0.05);
  mSessionMeta();
  mSessionSync();
}

function musicPlayIdx(i) {
  if (!MTRACKS.length) return;
  ensureAudio();
  if (!mOn) musicStart();
  mTrack = ((i % MTRACKS.length) + MTRACKS.length) % MTRACKS.length;
  mCur = mCompile(mTrack);
  mPart = 0; mPass = 0; mQ = 0;
  mFollow = true;
  mPaused = false;
  mStopped = false;
  try { localStorage.removeItem(LS_MSTATE); } catch (e) {}
  mCut();
  mNextT = AC ? AC.currentTime + 0.2 : 0;
  if (mDelay && AC) mDelay.delayTime.setTargetAtTime(mCur.delay, AC.currentTime, 0.05);
  mSessionMeta();
  mSessionSync();
}

function musicPause() {
  if (mOn) { mPaused = true; mCut(); }
  mSessionSync();
}

function musicResume() {
  if (!mOn) musicStart();
  if (mExt || !AC) return;
  mPaused = false;
  mStopped = false;
  try { localStorage.removeItem(LS_MSTATE); } catch (e) {}
  mNextT = AC.currentTime + 0.15;
  mSessionSync();
}

function musicStopped() { return mStopped; }

function musicHalt() {
  mPaused = true;
  mPart = 0; mPass = 0; mQ = 0;
  mCut();
  mStopped = true;
  try { localStorage.setItem(LS_MSTATE, '1'); } catch (e) {}
}

function musicSkip(d) { if (MTRACKS.length) musicPlayIdx(mTrack + d); }

function musicSeek(t) {
  if (!mCur) return;
  t = clamp(t, 0, Math.max(0.01, mCur.total - 0.1));
  let pi = 0;
  while (pi < mCur.parts.length - 1 && t >= mCur.starts[pi + 1]) pi++;
  const P = mCur.parts[pi];
  const qTot = (t - mCur.starts[pi]) * 4 / mCur.stepDur;
  mPart = pi;
  mPass = Math.min(P.rep - 1, Math.floor(qTot / P.len));
  mQ = Math.max(0, Math.min(P.len - 4, Math.floor(qTot / 4) * 4));
  mCut();
  if (AC) mNextT = AC.currentTime + 0.15;
}

function musicInfo() {
  if (!mCur || mTrack < 0 || !MTRACKS[mTrack]) return null;
  const P = mCur.parts[mPart];
  const pos = mCur.starts[mPart] + (mPass * P.len + mQ) * mCur.stepDur / 4;
  return { idx: mTrack, name: MTRACKS[mTrack].name, artist: MTRACKS[mTrack].artist || '', pos, dur: mCur.total || 0, playing: mOn && !mPaused && !mExt, paused: mPaused, stopped: mStopped };
}

function mStepSchedule(t, q) {
  mCur.parts[mPart].chs.forEach(ch => {
    const list = ch.map[q % ch.len];
    if (!list) return;
    list.forEach(ev => {
      let a = ev;
      if (ev.alt) {
        a = ev.alt[Math.floor(q / ch.len) % ev.alt.length];
        if (!a) return;
      }
      const durQ = a.sus > 0 ? a.sus * 4 : (ev.dur || 4);
      const dsec = Math.max(0.09, durQ / 4 * mCur.stepDur * 0.92);
      if (a.d) mDrum(t, a.d);
      else if (a.f) MVOICE[ch.s](t, a.f, dsec);
    });
  });
}

function mTick() {
  if (!AC || !mOn || mPaused || !mCur || mTrack < 0) return;
  mSessionSync();
  const hz = AC.currentTime + 0.4;
  while (mNextT < hz) {
    if (mExt || AC.state !== 'running') { mNextT = AC.currentTime + 0.15; break; }
    const P = mCur.parts[mPart];
    if (mQ >= P.len) {
      mQ = 0;
      if (++mPass >= P.rep) {
        mPass = 0;
        if (++mPart >= mCur.parts.length) {
          if (mFollow) musicPlayIdx((mTrack + 1) % MTRACKS.length);
          else musicNext();
          return;
        }
      }
      continue;
    }
    if (mNextT >= AC.currentTime - 0.06) mStepSchedule(mNextT, mQ);
    mQ += 4;
    mNextT += mCur.stepDur;
  }
}

function musicStart() {
  ensureAudio();
  if (!AC || mOn) return;
  mOn = true;
  mPaused = false;
  mGain = AC.createGain();
  mGain.gain.value = musicVol();
  mGain.connect(AC.destination);
  mAnalyser = AC.createAnalyser();
  mAnalyser.fftSize = 1024;
  mAnalyser.smoothingTimeConstant = 0.7;
  mGain.connect(mAnalyser);
  mDelay = AC.createDelay(1);
  mDelay.delayTime.value = 0.2;
  mFB = AC.createGain();
  mFB.gain.value = 0.25;
  mDelay.connect(mFB);
  mFB.connect(mDelay);
  mDelay.connect(mGain);
  mBus = mNewBus();
  mSessionSync();
  mNextT = AC.currentTime + 0.2;
  mTimer = setInterval(mTick, 110);
}

function musicStop() {
  mOn = false;
  mExt = false;
  mPaused = false;
  mFlyStop();
  mSessionSync();
  if (mTimer) { clearInterval(mTimer); mTimer = null; }
  if (mAnalyser) { try { mAnalyser.disconnect(); } catch (e) {} mAnalyser = null; }
  if (mBus) { try { mBus.disconnect(); } catch (e) {} mBus = null; }
  if (mGain) { try { mGain.disconnect(); } catch (e) {} mGain = null; }
  if (mDelay) { try { mDelay.disconnect(); mFB.disconnect(); } catch (e) {} mDelay = null; mFB = null; }
  mCur = null;
}