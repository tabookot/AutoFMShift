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

// ================= sound design v3: «живые» инструменты =================
// Сэмплы (если лежат рядом в samples/) + эмуляция гитарного усилителя + синты 90-х + наборы ударных.
// Блок вставлен скриптом apply_live_music.py. Повторный запуск скрипта пересобирает его с нуля.
// Если сэмплов нет — каждый голос автоматически играет синтезом, ничего не ломается.

let mNoiseBuf = null;

// сэмплы лежат в папке samples/ рядом с этим файлом
const MSAMP_BASE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src)
  ? document.currentScript.src.replace(/[^\/]*$/, '') + 'samples/' : 'samples/';

// быстрый баланс громкости по группам (1 = как есть)
const MLEV = { gtr: 1, clean: 1, lead: 1, bass: 1, synth: 1, drum: 1 };

const mJit = a => (Math.random() * 2 - 1) * a;
let mVerb = null, mComp = null;

// ---------- реверб: затухающий шум, у которого высокие частоты уходят первыми ----------
function mMakeIR(sec, decay) {
  const n = (AC.sampleRate * sec) | 0;
  const b = AC.createBuffer(2, n, AC.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      lp += ((Math.random() * 2 - 1) - lp) * (0.6 - 0.45 * k);
      d[i] = lp * Math.pow(1 - k, decay);
    }
  }
  return b;
}

// ---------- усилитель: компрессор-«сустейнер» -> драйв -> тон-стек -> кабинет ----------
function mCurve(k, b) {
  const n = 1024, c = new Float32Array(n), b0 = Math.tanh(b);
  for (let i = 0; i < n; i++) { const x = i * 2 / (n - 1) - 1; c[i] = Math.tanh(k * x + b) - b0; }
  return c;
}

// hp — срез низов перед искажением (тугость), g — драйв, k/b — характер клиппинга (b даёт чётные гармоники),
// eq — [частота, дБ, добротность], lp — «кабинет», out — уровень после искажения
const MAMP = {
  crunch:  { hp: 80,  g: 6,  k: 2.2, b: 0.10, out: 0.30, eq: [[1800, 3, 0.9], [350, -2, 0.8]], lp: 5200, echo: 0.18, verb: 0.20 },
  fuzz:    { hp: 110, g: 20, k: 3.4, b: 0.25, out: 0.22, eq: [[800, -5, 0.7], [2800, 2, 1]], lp: 4300, echo: 0.10, verb: 0.15 },
  metal:   { hp: 150, g: 45, k: 4.0, b: 0.05, out: 0.20, eq: [[500, -4, 0.8], [3200, 4, 1.1]], lp: 5600, echo: 0.04, verb: 0.10 },
  lead:    { hp: 120, g: 16, k: 3.0, b: 0.15, out: 0.24, eq: [[1500, 4, 0.9]], lp: 4800, echo: 0.28, verb: 0.30 },
  bassdrv: { hp: 45,  g: 8,  k: 2.6, b: 0.0,  out: 0.28, eq: [[250, 2, 0.8]], lp: 3200, dc: 28, echo: 0, verb: 0.02 },
  acid:    { hp: 70,  g: 4,  k: 2.4, b: 0.05, out: 0.45, eq: [], lp: 6500, echo: 0.22, verb: 0.15 }
};

function mAmpGet(name) {
  const bus = mBus;
  bus.amps = bus.amps || {};
  if (bus.amps[name]) return bus.amps[name];
  const P = MAMP[name] || MAMP.crunch, nodes = [];
  const mk = n => { nodes.push(n); return n; };
  const inp = mk(AC.createGain());
  const cmp = mk(AC.createDynamicsCompressor());
  cmp.threshold.value = -30; cmp.knee.value = 20; cmp.ratio.value = 6; cmp.attack.value = 0.003; cmp.release.value = 0.2;
  const hp = mk(AC.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = P.hp;
  const drv = mk(AC.createGain()); drv.gain.value = P.g;
  const ws = mk(AC.createWaveShaper()); ws.curve = mCurve(P.k, P.b); ws.oversample = '4x';
  inp.connect(cmp); cmp.connect(hp); hp.connect(drv); drv.connect(ws);
  let cur = ws;
  P.eq.forEach(e => {
    const f = mk(AC.createBiquadFilter());
    f.type = 'peaking'; f.frequency.value = e[0]; f.gain.value = e[1]; f.Q.value = e[2];
    cur.connect(f); cur = f;
  });
  const lp = mk(AC.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = P.lp; lp.Q.value = 0.7; cur.connect(lp);
  const dc = mk(AC.createBiquadFilter()); dc.type = 'highpass'; dc.frequency.value = P.dc || 70; lp.connect(dc);  // убираем сдвиг от асимметрии
  const out = mk(AC.createGain()); out.gain.value = P.out; dc.connect(out);
  out.connect(bus);
  if (P.echo && mDelay) { const s = mk(AC.createGain()); s.gain.value = P.echo; out.connect(s); s.connect(mDelay); }
  if (P.verb && bus.rv) { const s = mk(AC.createGain()); s.gain.value = P.verb; out.connect(s); s.connect(bus.rv); }
  return (bus.amps[name] = { in: inp, nodes });
}

// ---------- хорус для чистых гитар: две модулируемые линии задержки, разведённые по панораме ----------
function mChorusGet() {
  const bus = mBus;
  if (bus.chorus) return bus.chorus;
  const nodes = [], inp = AC.createGain();
  nodes.push(inp);
  inp.connect(bus);
  [[-0.55, 0.42, 0.0045, 0.019], [0.55, 0.57, 0.0038, 0.024]].forEach(c => {
    const dl = AC.createDelay(0.1); dl.delayTime.value = c[3];
    const lf = AC.createOscillator(); lf.frequency.value = c[1];
    const lg = AC.createGain(); lg.gain.value = c[2];
    lf.connect(lg); lg.connect(dl.delayTime); lf.start();
    const w = AC.createGain(); w.gain.value = 0.55;
    inp.connect(dl); dl.connect(w);
    nodes.push(dl, lf, lg, w);
    if (AC.createStereoPanner) {
      const p = AC.createStereoPanner(); p.pan.value = c[0];
      w.connect(p); p.connect(bus); nodes.push(p);
    } else w.connect(bus);
  });
  return (bus.chorus = { in: inp, nodes });
}

// освобождение шины: плавное затухание + отключение всех узлов (усилители, хорус, реверб-посылка)
function mBusFree(ob, t) {
  try {
    ob.gain.cancelScheduledValues(t);
    ob.gain.setValueAtTime(ob.gain.value, t);
    ob.gain.linearRampToValueAtTime(0, t + 0.05);
    if (ob.rv) {
      ob.rv.gain.cancelScheduledValues(t);
      ob.rv.gain.setValueAtTime(ob.rv.gain.value, t);
      ob.rv.gain.linearRampToValueAtTime(0, t + 0.05);
    }
  } catch (e) {}
  setTimeout(() => {
    const kill = n => { try { if (n.stop) n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} };
    Object.keys(ob.amps || {}).forEach(k => ob.amps[k].nodes.forEach(kill));
    if (ob.chorus) ob.chorus.nodes.forEach(kill);
    kill(ob);
    if (ob.rv) kill(ob.rv);
  }, 180);
}

// ---------- мастер: компрессор «склеивает» микс, реверб даёт воздух ----------
function mSetupMaster() {
  mComp = AC.createDynamicsCompressor();
  mComp.threshold.value = -16; mComp.knee.value = 12; mComp.ratio.value = 3; mComp.attack.value = 0.005; mComp.release.value = 0.15;
  mGain.connect(mComp); mComp.connect(AC.destination);
  mVerb = AC.createConvolver();
  mVerb.buffer = mMakeIR(1.9, 2.6);
  const w = AC.createGain(); w.gain.value = 0.5;
  mVerb.connect(w); w.connect(mGain);
  mVerb.out = w;
  mSampLoad();
}

function mTeardownMaster() {
  if (mVerb) { try { mVerb.disconnect(); mVerb.out.disconnect(); } catch (e) {} mVerb = null; }
  if (mComp) { try { mComp.disconnect(); } catch (e) {} mComp = null; }
}

// ---------- единая маршрутизация: панорама -> (усилитель | хорус | шина) + дилей/реверб ----------
function mRoute(node, o) {
  let out = node;
  if (o.pan && AC.createStereoPanner) {
    const p = AC.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    node.connect(p);
    out = p;
  }
  if (o.amp) { out.connect(mAmpGet(o.amp).in); return; }  // посылки дилея/реверба уже внутри усилителя
  if (o.chorus) out.connect(mChorusGet().in); else out.connect(mBus);
  if (o.echo && mDelay) { const s = AC.createGain(); s.gain.value = o.echo; out.connect(s); s.connect(mDelay); }
  if (o.verb && mBus.rv) { const s = AC.createGain(); s.gain.value = o.verb; out.connect(s); s.connect(mBus.rv); }
}

// ---------- ударные ----------
function mNoise(t, dur, type, fq, v, o) {
  o = o || {};
  const src = AC.createBufferSource();
  src.buffer = mNoiseBufGet();
  const f = AC.createBiquadFilter();
  f.type = type;
  f.frequency.value = fq;
  f.Q.value = o.q || 0.7;
  const g = AC.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g);
  mRoute(g, o);
  src.start(t, Math.random() * 0.4, dur + 0.02);
}

function mBody(t, f0, f1, dur, v) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * 0.8);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); mRoute(g, {});
  o.start(t); o.stop(t + dur + 0.03);
}

// «металлический» хэт в стиле драм-машин: шесть расстроенных прямоугольных осцилляторов
function mMetalHat(t, hp, dur, v, pan) {
  const g = AC.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 10000; bp.Q.value = 0.8;
  const hf = AC.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = hp;
  bp.connect(hf); hf.connect(g);
  [205.3, 304.4, 369.6, 522.7, 540, 800].forEach(fr => {
    const o = AC.createOscillator();
    o.type = 'square';
    o.frequency.value = fr * (1 + mJit(0.01));
    const og = AC.createGain(); og.gain.value = 0.17;
    o.connect(og); og.connect(bp);
    o.start(t); o.stop(t + dur + 0.02);
  });
  mRoute(g, { pan: pan });
}

// bd:[f0,f1,длит.,громк.,клик]  sd:[шум Гц, длит. шума, тон тела Гц, громк. тела]
const MKIT = {
  base: { bd: [150, 42, 0.20, 0.44, 0.10], sd: [1900, 0.16, 185, 0.16], hat: 'noise', hp: 7000, oh: 0.22, cp: 0.15, rv: 0.18 },
  rock: { bd: [120, 50, 0.25, 0.50, 0.07], sd: [2100, 0.20, 200, 0.20], hat: 'noise', hp: 6500, oh: 0.30, cp: 0.12, rv: 0.35 },
  e909: { bd: [165, 46, 0.30, 0.55, 0.14], sd: [2400, 0.16, 190, 0.14], hat: 'metal', hp: 7000, oh: 0.25, cp: 0.18, rv: 0.20 },
  trip: { bd: [110, 45, 0.28, 0.42, 0.03], sd: [1400, 0.22, 170, 0.16], hat: 'noise', hp: 5000, oh: 0.18, cp: 0.12, rv: 0.50 },
  dnb:  { bd: [180, 48, 0.18, 0.50, 0.12], sd: [2800, 0.12, 230, 0.18], hat: 'metal', hp: 8000, oh: 0.20, cp: 0.16, rv: 0.15 }
};

function mDrum(t, d, vel, kit) {
  vel = (vel || 1) * MLEV.drum;
  const K = MKIT[kit] || MKIT.base;
  if (d === 'bd') {
    mBody(t, K.bd[0] * (1 + mJit(0.03)), K.bd[1], K.bd[2], K.bd[3] * vel);
    mNoise(t, 0.012, 'highpass', 2500, K.bd[4] * vel);
    return;
  }
  if (d === 'sd') {
    mNoise(t, K.sd[1], 'bandpass', K.sd[0] + mJit(150), 0.20 * vel, { q: 0.6, verb: K.rv });
    mNoise(t, 0.05, 'highpass', 4000, 0.07 * vel);
    mBody(t, K.sd[2] * (1 + mJit(0.03)), K.sd[2] * 0.55, 0.10, K.sd[3] * vel);
    mBody(t, K.sd[2] * 1.75 * (1 + mJit(0.03)), K.sd[2] * 1.7, 0.08, K.sd[3] * 0.6 * vel);
    return;
  }
  if (d === 'hh' || d === 'oh') {
    const open = d === 'oh', dur = open ? K.oh : 0.04 + mJit(0.008), pan = mJit(0.25);
    if (K.hat === 'metal') mMetalHat(t, K.hp, dur, (open ? 0.09 : 0.10) * vel, pan);
    else mNoise(t, dur, 'highpass', K.hp + mJit(700), (open ? 0.08 : 0.09) * vel, { pan: pan, verb: open ? 0.1 : 0 });
    return;
  }
  if (d === 'cp') {
    [0, 0.011, 0.023].forEach(dt => mNoise(t + dt, 0.02, 'bandpass', 1200, K.cp * vel, { q: 1.2 }));
    mNoise(t + 0.03, 0.14, 'bandpass', 1100, K.cp * 0.9 * vel, { q: 0.9, verb: K.rv + 0.1 });
    return;
  }
  mBody(t, 220 * (1 + mJit(0.03)), 95, 0.28, 0.32 * vel);  // tm
}

// ---------- ноты ----------
function mVib(t, stop, o) {  // вибрато «вступает» не сразу и нарастает — как у живого исполнителя
  if (!o.vib) return null;
  const lf = AC.createOscillator();
  lf.frequency.value = (o.vr || 5) + mJit(0.5);
  const lg = AC.createGain(), vd = o.vd == null ? 0.1 : o.vd;
  lg.gain.setValueAtTime(0, t);
  lg.gain.setValueAtTime(0, t + vd);
  lg.gain.linearRampToValueAtTime(o.vib, t + vd + (o.vf || 0.25));
  lf.connect(lg); lf.start(t); lf.stop(stop);
  return lg;
}

// универсальный синт-голос: огибающие громкости и фильтра, несколько осцилляторов,
// вибрато, «подъезд» к ноте (scoop), легато-глиссандо, дрейф строя, LFO на фильтр
function mNote(t, f, dur, v, o) {
  const att = o.att || 0.008, dec = o.dec || 0.12, rel = o.rel || 0.08;
  const sus = o.sus == null ? 0.7 : o.sus;
  const end = t + Math.max(dur, att + dec);
  const stop = end + rel + 0.05;
  const sv = Math.max(0.0002, v * sus);

  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + att);
  g.gain.exponentialRampToValueAtTime(sv, t + att + dec);
  g.gain.setValueAtTime(sv, end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + rel);

  const flt = AC.createBiquadFilter();
  flt.type = 'lowpass';
  flt.Q.value = o.q || 0.8;
  flt.frequency.setValueAtTime(o.cut * (o.fenv || 1), t);
  flt.frequency.exponentialRampToValueAtTime(o.cut, t + (o.fdec || 0.15));
  flt.connect(g);
  if (o.flfo) {
    const l = AC.createOscillator(); l.frequency.value = o.flfo[0] + mJit(0.03);
    const lg2 = AC.createGain(); lg2.gain.value = o.flfo[1];
    l.connect(lg2); lg2.connect(flt.frequency); l.start(t); l.stop(stop);
  }

  const lg = mVib(t, stop, o);
  const legato = !!o.from;
  const from = o.from && o.from !== f ? o.from : 0;
  const drift = mJit(o.drift == null ? 5 : o.drift);

  o.osc.forEach(s => {
    const os = AC.createOscillator();
    os.type = s[0];
    const base = s[1] + drift, mult = s[2];
    if (from) {
      os.frequency.setValueAtTime(from * mult, t);
      os.frequency.exponentialRampToValueAtTime(f * mult, t + (o.glide || 0.05));
      os.detune.value = base;
    } else {
      os.frequency.value = f * mult;
      if (o.scoop && !legato) {
        os.detune.setValueAtTime(base + o.scoop, t);
        os.detune.linearRampToValueAtTime(base, t + (o.scoopT || 0.06));
      } else os.detune.value = base;
    }
    const og = AC.createGain();
    og.gain.value = s[3];
    os.connect(og); og.connect(flt);
    if (lg) lg.connect(os.detune);
    os.start(t); os.stop(stop);
  });

  mRoute(g, o);
}

// ---------- струна: Karplus–Strong (буфер считается один раз на длину периода) ----------
const mKSCache = {};
function mKSBuf(f) {
  const sr = AC.sampleRate;
  const P = Math.max(2, Math.round(sr / f));
  if (mKSCache[P]) return mKSCache[P];
  const n = (sr * 1.2) | 0;
  const buf = AC.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < P; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.65; d[i] = lp; }
  for (let i = P; i < n; i++) d[i] = 0.5 * (d[i - P] + d[i - P + 1]) * 0.9985;
  return (mKSCache[P] = { buf, P });
}

function mString(t, f, ring, v, o) {
  const k = mKSBuf(f);
  const src = AC.createBufferSource();
  src.buffer = k.buf;
  src.playbackRate.value = f * k.P / AC.sampleRate;
  const base = mJit(o.drift == null ? 5 : o.drift);
  const stop = t + ring + 0.05;
  if (o.scoop && !o.from) {
    src.detune.setValueAtTime(base + o.scoop, t);
    src.detune.linearRampToValueAtTime(base, t + (o.scoopT || 0.06));
  } else src.detune.value = base;
  const lg = mVib(t, stop, o);
  if (lg) lg.connect(src.detune);
  const flt = AC.createBiquadFilter();
  flt.type = 'lowpass';
  flt.Q.value = 0.6;
  const cut = o.cut || 3500;
  flt.frequency.setValueAtTime(cut * 1.6, t);
  flt.frequency.exponentialRampToValueAtTime(cut, t + 0.12);
  const g = AC.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.setValueAtTime(v, t + ring * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
  src.connect(flt); flt.connect(g);
  mRoute(g, o);
  src.start(t); src.stop(stop);
}

// ---------- сэмплер: манифест samples/manifest.json делает apply_live_music.py --samples ----------
const mS = {};
let mSampTried = false;

function mSampLoad() {
  if (mSampTried || !AC || typeof fetch !== 'function') return;
  mSampTried = true;
  fetch(MSAMP_BASE + 'manifest.json').then(r => (r.ok ? r.json() : null)).then(man => {
    if (!man) return;
    Object.keys(man).forEach(name => {
      const list = (mS[name] = []);
      (man[name].files || []).forEach(fn => {
        const nm = /^([A-G])(s|#|b)?(\d)\.[a-z0-9]+$/.exec(fn);
        if (!nm) return;
        const st = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[nm[1]] + (nm[2] === 's' || nm[2] === '#' ? 1 : nm[2] === 'b' ? -1 : 0);
        const midi = 12 * (+nm[3] + 1) + st;
        fetch(MSAMP_BASE + name + '/' + fn).then(r => r.arrayBuffer())
          .then(ab => new Promise((ok, no) => AC.decodeAudioData(ab, ok, no)))
          .then(buf => { list.push({ midi: midi, buf: buf }); list.sort((a, b) => a.midi - b.midi); })
          .catch(() => {});
      });
    });
  }).catch(() => {});
}

function mSampPick(name, f) {
  const L = mS[name];
  if (!L || !L.length) return null;
  const m = 69 + 12 * Math.log2(f / 440);
  let best = L[0];
  for (let i = 1; i < L.length; i++) if (Math.abs(L[i].midi - m) < Math.abs(best.midi - m)) best = L[i];
  const semis = m - best.midi;
  if (semis < -12 || semis > 5) return null;  // слишком далеко от записанной ноты — честнее сыграть синтезом
  return { buf: best.buf, rate: Math.pow(2, semis / 12) };
}

function mSampNote(t, name, f, dur, v, o) {
  const s = mSampPick(name, f);
  if (!s) return false;
  const rel = o.rel || 0.1, end = t + Math.max(dur, 0.05), stop = end + rel + 0.05;
  const src = AC.createBufferSource();
  src.buffer = s.buf;
  const from = o.from && o.from !== f ? o.from : 0;
  if (from) {
    src.playbackRate.setValueAtTime(s.rate * from / f, t);
    src.playbackRate.exponentialRampToValueAtTime(s.rate, t + (o.glide || 0.06));
  } else src.playbackRate.value = s.rate;
  const base = mJit(o.drift == null ? 4 : o.drift);
  if (o.scoop && !o.from) {
    src.detune.setValueAtTime(base + o.scoop, t);
    src.detune.linearRampToValueAtTime(base, t + (o.scoopT || 0.06));
  } else src.detune.value = base;
  const lg = mVib(t, stop, o);
  if (lg) lg.connect(src.detune);
  let node = src;
  if (o.lp) {
    const fl = AC.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = o.lp;
    src.connect(fl); node = fl;
  }
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + 0.003);
  g.gain.setValueAtTime(v, end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
  node.connect(g);
  mRoute(g, o);
  src.start(t); src.stop(stop);
  return true;
}

// гитарная нота: сэмпл электрогитары, а если его нет — струна Karplus–Strong
function mGtrNote(t, f, dur, v, o) {
  if (mSampNote(t, 'guitar-electric', f, dur, v, o)) return;
  mString(t, f, Math.max(dur * 1.3, 0.25), v * 0.9, o);
}

// ---------- электропиано (FM, как «родес») ----------
function mEPiano(t, f, d, vel) {
  const len = Math.max(d, 0.5) * 1.4, stop = t + len + 0.05;
  const c = AC.createOscillator(), m = AC.createOscillator(), mg = AC.createGain(), g = AC.createGain();
  c.type = 'sine'; m.type = 'sine';
  c.frequency.value = f; m.frequency.value = f;
  mg.gain.setValueAtTime(f * 1.8 * (0.6 + 0.6 * vel), t);
  mg.gain.exponentialRampToValueAtTime(f * 0.12, t + len * 0.5);
  m.connect(mg); mg.connect(c.frequency);
  const v = 0.16 * vel * MLEV.synth;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  c.connect(g);
  mRoute(g, { echo: 0.25, verb: 0.45, pan: mJit(0.15) });
  c.start(t); m.start(t); c.stop(stop); m.stop(stop);
  if (f * 14 < 9000) {  // «звон» зубца
    const tn = AC.createOscillator(), tg = AC.createGain();
    tn.type = 'sine'; tn.frequency.value = f * 14;
    tg.gain.setValueAtTime(v * 0.25, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    tn.connect(tg); mRoute(tg, { verb: 0.3 });
    tn.start(t); tn.stop(t + 0.1);
  }
}

// ---------- голоса ----------
// сигнатура: (t, f, длительность, громкость, x, P)
//   x = { from: частота предыдущей ноты (легато) или 0, flip: чередование панорамы, sd: длина шага }
//   P = параметры из MKITS для этого канала
// громкость vel ≈ 0.5…1.1: чем громче нота, тем ярче (фильтр открывается шире) — как у живых инструментов
const MLEGATO = { lead: 1, gtrLead: 1, acid: 1, moog: 1 };

const MVOICE = {
  // --- базовые (используются, если для трека не заданы замены) ---
  lead: (t, f, d, vel, x) => mNote(t, f, Math.max(d, 0.14), 0.13 * vel * MLEV.lead, {
    osc: [['sawtooth', -8, 1, 0.45], ['sawtooth', 8, 1, 0.45], ['triangle', 0, 2, 0.14]],
    cut: 1100 + 1500 * vel, fenv: 2.2, fdec: 0.16, q: 1.4, att: 0.012, dec: 0.1, sus: 0.75, rel: 0.1,
    vib: 14, vd: 0.12, vf: 0.3, vr: 5, scoop: -25, from: x.from, glide: 0.05, echo: 0.2, verb: 0.22, pan: -0.1
  }),
  pluck: (t, f, d, vel) => mString(t, f, Math.min(0.9, Math.max(d * 1.5, 0.35)), 0.2 * vel, { cut: 1800 + 2200 * vel, echo: 0.18, verb: 0.25, pan: 0.15 }),
  arp: (t, f, d, vel, x) => mString(t, f, Math.max(d, 0.14) * 1.2, 0.16 * vel, { cut: 2500 + 2500 * vel, echo: 0.22, verb: 0.2, pan: x.flip ? 0.3 : -0.3 }),
  bass: (t, f, d, vel) => mNote(t, f, Math.min(Math.max(d, 0.18), 0.45), 0.26 * vel * MLEV.bass, {
    osc: [['sawtooth', 0, 1, 0.45], ['sine', 0, 1, 0.65]],
    cut: 500 + 350 * vel, fenv: 2.8, fdec: 0.09, q: 2, att: 0.004, dec: 0.15, sus: 0.55, rel: 0.06, drift: 3
  }),
  bell: (t, f, d, vel) => {
    const len = Math.max(d, 0.5) * 1.6;
    [[1, 1, 1], [2.76, 0.32, 0.55], [5.4, 0.16, 0.35], [8.93, 0.07, 0.2]].forEach(p => {
      if (f * p[0] > 7000) return;
      const dd = len * p[2] + 0.15;
      mNote(t, f * p[0], dd, 0.11 * vel * p[1], {
        osc: [['sine', mJit(4), 1, 1]], cut: 9000, att: 0.003, dec: dd * 0.9, sus: 0.05, rel: 0.1,
        vib: p[0] === 1 ? 4 : 0, vr: 4.2, vd: 0.3, vf: 0.5, echo: 0.28, verb: 0.5, drift: 0
      });
    });
  },
  pad: (t, f, d, vel, x, P) => mNote(t, f, d * 1.1, 0.1 * MLEV.synth, {
    osc: [['sawtooth', -12, 1, 0.34], ['sawtooth', 0, 1, 0.3], ['sawtooth', 12, 1, 0.34]],
    cut: (P && P.cut) || 1000, fenv: 0.5, fdec: 1.4, q: 0.7, att: 0.4, dec: 0.5, sus: 0.9, rel: 0.6,
    vib: 7, vr: 0.4, vd: 0, vf: 1.5, drift: 8, verb: 0.55, echo: 0.1, pan: mJit(0.3)
  }),

  // --- гитары ---
  // риффовая: power-chord (корень + квинта), короткие ноты автоматически играются как «палм-мют»
  gtr: (t, f, d, vel, x, P) => {
    const pm = P.pm !== false && d < x.sd * 1.7;
    const base = f * Math.pow(2, P.oct || 0), amp = P.amp || 'crunch';
    const dur = pm ? 0.1 : Math.max(d, 0.14);
    const rs = P.chord === 2 ? [1, 1.4983, 2] : P.chord ? [1, 1.4983] : [1];
    rs.forEach((r, i) => mGtrNote(t + i * 0.005 + mJit(0.002), base * r, dur, 0.5 * vel * MLEV.gtr * (i ? 0.85 : 1),
      { amp: amp, lp: pm ? 1100 : 0, pan: P.pan || 0, drift: 6 }));
    mNoise(t, 0.012, 'bandpass', 2800, 0.02 * vel, { amp: amp });  // щелчок медиатора
  },
  // соло: вибрато, подъезд снизу, легато-слайд между нотами
  gtrLead: (t, f, d, vel, x, P) => mGtrNote(t, f, Math.max(d, 0.2), 0.5 * vel * MLEV.lead, {
    amp: P.amp || 'lead', vib: 18, vd: 0.18, vf: 0.35, vr: 5.2, scoop: -60, scoopT: 0.07, from: x.from, glide: 0.06, rel: 0.18
  }),
  // чистая гитара: хорус + эхо + реверб, панорама чередуется
  gtrClean: (t, f, d, vel, x) => mGtrNote(t, f, Math.max(d * 1.4, 0.3), 0.42 * vel * MLEV.clean, {
    chorus: true, echo: 0.3, verb: 0.35, pan: x.flip ? 0.2 : -0.2, cut: 3800 + 2000 * vel, rel: 0.25
  }),

  // --- басы ---
  bassPick: (t, f, d, vel, x, P) => {
    const dur = Math.min(Math.max(d, 0.18), 0.5);
    if (!mSampNote(t, 'bass-electric', f, dur, 0.55 * vel * MLEV.bass, { rel: 0.12, lp: 900 + 1400 * vel })) MVOICE.bass(t, f, d, vel, x, P);
  },
  bassDrive: (t, f, d, vel) => mNote(t, f, Math.min(Math.max(d, 0.18), 0.5), 0.3 * vel * MLEV.bass, {
    osc: [['sawtooth', 0, 1, 0.5], ['square', -7, 1, 0.3]], cut: 900, fenv: 2, fdec: 0.1, q: 1.5,
    att: 0.004, dec: 0.15, sus: 0.6, rel: 0.06, drift: 3, amp: 'bassdrv'
  }),
  reese: (t, f, d, vel) => mNote(t, f, Math.min(Math.max(d, 0.2), 0.6), 0.2 * vel * MLEV.bass, {
    osc: [['sawtooth', -22, 1, 0.4], ['sawtooth', 22, 1, 0.4], ['sawtooth', 0, 0.5, 0.3]],
    cut: 520, fenv: 1.5, fdec: 0.2, q: 3, flfo: [0.35, 200], att: 0.006, dec: 0.2, sus: 0.7, rel: 0.08, drift: 0
  }),

  // --- синты 90-х ---
  supersaw: (t, f, d, vel) => mNote(t, f, Math.max(d, 0.14), 0.12 * vel * MLEV.synth, {
    osc: [['sawtooth', -27, 1, 0.1], ['sawtooth', -17, 1, 0.14], ['sawtooth', -8, 1, 0.16], ['sawtooth', 0, 1, 0.2],
          ['sawtooth', 8, 1, 0.16], ['sawtooth', 17, 1, 0.14], ['sawtooth', 27, 1, 0.1]],
    cut: 2800 + 2200 * vel, fenv: 1.6, fdec: 0.25, q: 0.8, att: 0.01, dec: 0.2, sus: 0.8, rel: 0.12,
    drift: 0, echo: 0.25, verb: 0.3, pan: mJit(0.1)
  }),
  hoover: (t, f, d, vel) => mNote(t, f, Math.max(d, 0.16), 0.13 * vel * MLEV.synth, {
    osc: [['sawtooth', -35, 1, 0.3], ['sawtooth', 0, 1, 0.3], ['sawtooth', 35, 1, 0.3], ['square', 0, 0.5, 0.18]],
    cut: 2200, fenv: 2, fdec: 0.2, q: 3, att: 0.01, dec: 0.2, sus: 0.8, rel: 0.1,
    vib: 30, vr: 6, vd: 0.05, vf: 0.2, scoop: 700, scoopT: 0.14, echo: 0.2, verb: 0.25
  }),
  acid: (t, f, d, vel, x) => mNote(t, f, Math.max(d, 0.1), 0.2 * vel * MLEV.synth, {
    osc: [['sawtooth', 0, 1, 1]], cut: 350 + 500 * vel, fenv: 6 + 4 * vel, fdec: 0.16, q: 12,
    att: 0.003, dec: 0.1, sus: 0.7, rel: 0.04, from: x.from, glide: 0.06, drift: 2, amp: 'acid'
  }),
  moog: (t, f, d, vel, x) => mNote(t, f, Math.max(d, 0.16), 0.16 * vel * MLEV.synth, {
    osc: [['sawtooth', -6, 1, 0.5], ['square', 6, 1, 0.35]],
    cut: 1300 + 1200 * vel, fenv: 2.2, fdec: 0.3, q: 5, att: 0.02, dec: 0.15, sus: 0.8, rel: 0.15,
    vib: 10, vr: 4.8, vd: 0.2, vf: 0.3, from: x.from, glide: 0.09, echo: 0.3, verb: 0.3
  }),
  epiano: (t, f, d, vel) => mEPiano(t, f, d, vel)
};

// ---------- кто как звучит: замены голосов по трекам (ключ — название трека) ----------
// v — голос из MVOICE; amp — усилитель; chord: 1 = power-chord, 2 = +октава; oct — сдвиг октавы;
// pm:false — отключить палм-мют; legato — принудительно вкл/выкл; kit — набор ударных из MKIT
const MKITS = {
  'Запах жестяной дуэли': {  // гранж: фузз, «дроп-D», чистые арпеджио в припеве
    lead: { v: 'gtr', amp: 'fuzz', chord: 1, oct: -1 }, pluck: { v: 'gtrClean' }, bass: { v: 'bassPick' }, drum: { kit: 'rock' }
  },
  'Вуду-Фугас': {  // биг-бит: «хувер», 303, ризовый бас, 909
    lead: { v: 'hoover' }, arp: { v: 'acid' }, bass: { v: 'reese' }, drum: { kit: 'e909' }
  },
  'Ржавый Гвоздь': {  // индастриал: тугой металлический рифф, перегруженный бас
    lead: { v: 'gtr', amp: 'metal', chord: 1, oct: -1 }, pluck: { v: 'gtrClean' }, pad: { v: 'pad', cut: 700 },
    bass: { v: 'bassDrive' }, drum: { kit: 'e909' }
  },
  'Подача Слепых': {  // ню-метал: низко настроенные гитары
    lead: { v: 'gtr', amp: 'metal', chord: 1, oct: -1 }, bass: { v: 'bassDrive' }, drum: { kit: 'rock' }
  },
  'Элегия Бесконечной Зимы': {  // мелодик-дэт: чистые арпеджио + поющее соло
    arp: { v: 'gtrClean' }, lead: { v: 'gtrLead', amp: 'lead' }, bass: { v: 'bassPick' }, drum: { kit: 'rock' }
  },
  'Заряд в Печенку': {  // фанк-метал: сухой «квакающий» кранч, пальцевый бас
    lead: { v: 'gtr', amp: 'crunch', chord: 0, oct: 0 }, pluck: { v: 'gtrClean' }, bass: { v: 'bassPick' }, drum: { kit: 'rock' }
  },
  'Ночной Обстрел Радаров': {  // трип-хоп: родес, моог, чистая гитара «сёрф», тёмные ударные
    pad: { v: 'pad', cut: 800 }, bell: { v: 'epiano' }, lead: { v: 'moog' }, pluck: { v: 'gtrClean' }, drum: { kit: 'trip' }
  },
  'Турбо-Таран': {  // синтез-метал/DnB: супер-пила, 303, ризовый бас
    lead: { v: 'supersaw' }, arp: { v: 'acid' }, bass: { v: 'reese' }, drum: { kit: 'dnb' }
  },
  'Сигнал над Горизонтом': {  // пост-гранж: соло с вибрато, чистые гитары с дилеем
    lead: { v: 'gtrLead', amp: 'lead' }, pluck: { v: 'gtrClean' }, arp: { v: 'gtrClean' }, bass: { v: 'bassPick' }, drum: { kit: 'rock' }
  },
  'Забытые Координаты': {  // заставка: родес и чистая гитара
    pad: { v: 'pad', cut: 800 }, bell: { v: 'epiano' }, pluck: { v: 'gtrClean' }
  }
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
  return mCache[i] = { parts, starts, total: acc, stepDur: sd, delay: sd * 3, map: MKITS[tr.name] || {} };
}

function musicTrackDur(i) {
  const t = MTRACKS[i];
  return t ? (mCache[i] || mCompile(i)).total || 0 : 0;
}

function mNewBus() {
  const b = AC.createGain();
  b.gain.value = 1;
  b.connect(mGain);
  b.rv = AC.createGain();      // посылка в реверб у каждой шины своя: хвосты старой шины гасятся при смене трека
  b.rv.gain.value = 1;
  if (mVerb) b.rv.connect(mVerb);
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
    mBusFree(ob, t);
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
  const sd = mCur.stepDur, map = mCur.map || {};
  // q идёт шагами по 4 на шестнадцатую: 16 = доля, 64 = такт; сильные доли играются громче
  const accent = q % 64 === 0 ? 1.08 : q % 16 === 0 ? 1.0 : q % 8 === 0 ? 0.9 : 0.8;
  mCur.parts[mPart].chs.forEach(ch => {
    const list = ch.map[q % ch.len];
    if (!list) return;
    const P = map[ch.s] || {};
    list.forEach(ev => {
      let a = ev;
      if (ev.alt) {
        a = ev.alt[Math.floor(q / ch.len) % ev.alt.length];
        if (!a) return;
      }
      const durQ = a.sus > 0 ? a.sus * 4 : (ev.dur || 4);
      const dsec = Math.max(0.09, durQ / 4 * sd * 0.92);
      const vel = Math.max(0.3, Math.min(1.15, accent * (0.9 + Math.random() * 0.2)));

      if (a.d) {  // ударные: люфт ±3 мс
        mDrum(Math.max(AC.currentTime, t + mJit(0.003)), a.d, vel, P.kit);
        return;
      }
      if (!a.f) return;
      const vn = P.v || ch.s;
      const fn = MVOICE[vn] || MVOICE[ch.s];
      if (!fn) return;

      // легато: если нота начинается сразу после предыдущей — голос «едет» к ней, а не играет заново
      const leg = P.legato != null ? P.legato : !!MLEGATO[vn];
      const x = { from: 0, flip: !ch.flip, sd: sd };
      ch.flip = x.flip;
      if (leg && ch.lastEnd && Math.abs(t - ch.lastEnd) < sd * 0.8) x.from = ch.lastF;
      ch.lastF = a.f;
      ch.lastEnd = t + dsec;

      // человеческий «люфт»: бас плотно, мелодия слегка плавает
      const jit = ch.s === 'bass' ? mJit(0.004) : mJit(0.008) + (ch.s === 'lead' ? 0.004 : 0);
      fn(Math.max(AC.currentTime, t + jit), a.f, dsec, vel, x, P);
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
  mSetupMaster();
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
  if (mBus) { mBusFree(mBus, AC.currentTime); mBus = null; }
  mTeardownMaster();
  if (mGain) { try { mGain.disconnect(); } catch (e) {} mGain = null; }
  if (mDelay) { try { mDelay.disconnect(); mFB.disconnect(); } catch (e) {} mDelay = null; mFB = null; }
  mCur = null;
}