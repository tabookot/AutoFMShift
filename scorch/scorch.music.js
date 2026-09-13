// scorch.music.js — the chiptune module: 11 original 16-bit-style themes
// for the duels of the Vale system, strudel-mini patterns on Web Audio.
//
// HOW TO EDIT — the file is data-first, free to reshape:
//   · MTRACKS is the setlist: add / remove / reorder tracks freely. The
//     player shuffles the non-splash list, pulls the NEXT track every
//     round (newRound → musicNext) and when a track ends; the splash
//     player (index.html) browses ALL of them. An empty list = silence.
//   · Track: { name, artist, bpm, parts: [ { rep, ch: [...] }, ... ] }
//       name/artist — free text (shown in the playlist and the OS
//         media-session overlay)
//       bpm — tempo        splash: true — the calm splash-screen theme,
//         excluded from the round rotation but playable from the playlist
//       parts — the SONG STRUCTURE: intro / verse / chorus / break,
//         played in order; each part loops `rep` times (one pass = all
//         channels realigned, the LCM of their loop lengths) — minutes of
//         music from short patterns. Legacy { bars, ch } still works.
//   · Channel: { s: voice, d: steps-per-token, p: 'pattern' }
//       s — lead pluck arp bass pad bell drum (see MVOICE)
//       d — the channel's rhythmic grid: 1 = a 16th per token, 2 = an
//           8th, 4 = a quarter (default 1)
//   · Pattern notation (strudel-inspired mini-notation):
//       c4 f#3 bb2   notes (~ or . = rest)   [a b c] subdivision
//       {a b}        polyphony (chord)       <a b>    alternation per
//       n*3          replicate               n@4     sustain (16th steps)
//       drum channel — words: bd sd hh oh cp tm
//
// Player API used by the UIs (all guarded by typeof elsewhere):
//   musicStart/Stop, musicNext (round hook), musicPlayIdx(i),
//   musicPause/Resume, musicHalt (stop+reset), musicSkip(±1),
//   musicSeek(sec), musicInfo() {idx,name,artist,pos,dur,playing,paused},
//   musicAlive(), musicTrackDur(i), musicVol/SetVol/Sync (default 0.5%,
//   LS 'scorch_mvol'), musicExternal(master) — the handshake with
//   readAudio: while the host stream is MASTER (playing or paused) the
//   chiptune clock holds; musicStart/External also grab/release the
//   system MediaSession, so hardware media keys drive whichever source
//   owns the stage.

const LS_MVOL = 'scorch_mvol';
const LS_MSTATE = 'scorch_mstate';
let mVolSaved = NaN;
try { mVolSaved = parseFloat(localStorage.getItem(LS_MVOL)); } catch (e) {}
// the player's stop state persists across sessions: 1 = the tracks were
// HALTED by the STOP button (musicHalt) — the splash and the duel stay
// silent until someone presses play; cleared by any playback start
let mStopped = false;
try { mStopped = localStorage.getItem(LS_MSTATE) === '1'; } catch (e) {}

const MTRACKS = [
  { name: 'Первый луч над свалкой', artist: 'Гильдия Огня', bpm: 126, parts: [
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{c3@14 e3@14 g3@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'bell', d: 4, p: 'e5@6 ~ ~ ~ g5@6 ~ ~ ~ c6@12 ~ ~ ~ ~ ~ ~ ~' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'e5 ~ g5 ~ c6 ~ b5 a5 g5 ~ e5 ~ d5 ~ e5 ~ f5 ~ a5 ~ c6 ~ b5 a5 g5 ~ d5 e5 c5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'c3 ~ c3 ~ g2 ~ c3 ~ a2 ~ a2 ~ e2 ~ a2 ~ f2 ~ f2 ~ c3 ~ f2 ~ g2 ~ g2 ~ d3 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd <hh oh>' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'a5 ~ a5 g5 a5 ~ c6 ~ b5 a5 g5 a5 e5 ~ ~ ~ c6 ~ b5 a5 g5 ~ e5 ~ d5 e5 d5 b4 c5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'a2 ~ a2 ~ e2 ~ a2 ~ f2 ~ f2 ~ c3 ~ f2 ~ c3 ~ c3 ~ g2 ~ c3 ~ g2 ~ g2 ~ d3 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd sd' }
    ] },
    { rep: 2, ch: [
      { s: 'arp', d: 1, p: 'a3 c4 e4 a4 e4 c4 a3 c4 a3 c4 e4 a4 e4 c4 a3 c4 f3 a3 c4 f4 c4 a3 f3 a3 f3 a3 c4 f4 c4 a3 f3 a3 c4 e4 g4 c5 g4 e4 c4 e4 g4 c5 g4 e4 c4 e4 g3 b3 d4 g4 d4 b3 g3 b3 g3 b3 d4 g4 d4 b3 g3 b3' },
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'drum', d: 2, p: 'hh ~ hh ~ cp ~ ~ ~' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'e6 ~ d6 c6 b5 ~ c6 ~ a5 ~ b5 ~ c6 ~ d6 ~ e6 ~ d6 c6 b5 ~ a5 ~ g5 a5 b5 c6 d6 e6 f6 g6' },
      { s: 'arp', d: 1, p: 'c4 e4 g4 c5 g4 e4 c4 e4 c4 e4 g4 c5 g4 e4 c4 e4 a3 c4 e4 a4 e4 c4 a3 c4 a3 c4 e4 a4 e4 c4 a3 c4 f3 a3 c4 f4 c4 a3 f3 a3 f3 a3 c4 f4 c4 a3 f3 a3 g3 b3 d4 g4 d4 b3 g3 b3 g3 b3 d4 g4 d4 b3 g3 b3' },
      { s: 'bass', d: 2, p: 'c3 ~ c3 ~ g2 ~ c3 ~ a2 ~ a2 ~ e2 ~ a2 ~ f2 ~ f2 ~ c3 ~ f2 ~ g2 ~ g2 ~ d3 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd <cp sd>' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{c3@14 e3@14 g3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~' },
      { s: 'bell', d: 4, p: 'g5@6 ~ ~ ~ e5@6 ~ ~ ~ c5@12 ~ ~ ~ ~ ~ ~ ~' }
    ] }
  ] },
  { name: 'Гнев на заклёпках', artist: 'Кузнецы Шлака', bpm: 152, parts: [
    { rep: 2, ch: [
      { s: 'bass', d: 1, p: 'e2 e2 e3 e2 e2 e3 e2 e2 e2 e2 e3 e2 e2 e3 e2 b2' },
      { s: 'drum', d: 1, p: 'bd ~ bd bd ~ sd ~ bd bd ~ bd ~ sd sd cp cp' }
    ] },
    { rep: 6, ch: [
      { s: 'lead', d: 1, p: 'e4 e4 ~ e4 e4 ~ g4 a4 b4 ~ a4 g4 e4 ~ ~ ~ c5 ~ b4 a4 g4 ~ f#4 g4 a4 ~ g4 f#4 e4 ~ ~ ~' },
      { s: 'bass', d: 1, p: 'e2 e2 e3 e2 e2 e3 e2 e2 e2 e2 e3 e2 e2 e3 e2 b2 c2 c2 c3 c2 c2 c3 c2 c2 g2 g2 g3 g2 g2 g3 g2 g2' },
      { s: 'drum', d: 1, p: 'bd ~ bd bd ~ sd ~ bd bd ~ bd ~ sd sd cp cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'b4 ~ b4 c5 d5 ~ d5 ~ e5 ~ d5 b4 a4 ~ b4 ~ g4 ~ a4 b4 e5 ~ d5 ~ c5 ~ b4 a4 b4 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'g3 b3 d4 g4 d4 b3 g3 b3 g3 b3 d4 g4 d4 b3 g3 b3 d3 f#3 a3 d4 a3 f#3 d3 f#3 d3 f#3 a3 d4 a3 f#3 d3 f#3 e3 g3 b3 e4 b3 g3 e3 g3 e3 g3 b3 e4 b3 g3 e3 g3 c3 e3 g3 c4 g3 e3 c3 e3 c3 e3 g3 c4 g3 e3 c3 e3' },
      { s: 'bass', d: 2, p: 'g2 ~ g2 ~ d3 ~ g2 ~ d2 ~ d2 ~ a2 ~ d2 ~ e2 ~ e2 ~ b2 ~ e2 ~ c2 ~ c2 ~ g2 ~ c2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 1, p: 'e4 e4 ~ e4 e4 ~ g4 a4 b4 ~ a4 g4 e4 ~ ~ ~ c5 ~ b4 a4 g4 ~ f#4 g4 a4 ~ g4 f#4 e4 ~ ~ ~' },
      { s: 'bass', d: 1, p: 'e2 e2 e3 e2 e2 e3 e2 e2 e2 e2 e3 e2 e2 e3 e2 b2 c2 c2 c3 c2 c2 c3 c2 c2 g2 g2 g3 g2 g2 g3 g2 g2' },
      { s: 'drum', d: 1, p: 'bd ~ bd bd ~ sd ~ bd bd ~ bd ~ sd sd cp cp' }
    ] },
    { rep: 3, ch: [
      { s: 'pluck', d: 2, p: 'b4 e5 g5 b5 a5 g5 e5 d5 e5 ~ b4 ~ g4 a4 b4 ~ c5 e5 g5 c6 b5 a5 g5 e5 d5 ~ a4 ~ b4 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'e2 ~ e2 ~ b2 ~ e2 ~ e2 ~ e2 ~ g2 ~ e2 ~ c2 ~ c2 ~ g2 ~ c2 ~ d2 ~ d2 ~ a2 ~ d2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd <cp cp>' }
    ] },
    { rep: 1, ch: [
      { s: 'pad', d: 4, p: '{e2@14 b2@14 e3@14} ~ ~ ~ {e2@14 b2@14 e3@14} ~ ~ ~ {c3@14 eb3@14 g3@14} ~ ~ ~ {b2@14 d3@14 f#3@14} ~ ~ ~' },
      { s: 'drum', d: 4, p: 'tm ~ ~ ~ sd ~ sd sd' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'b4 ~ b4 c5 d5 ~ d5 ~ e5 ~ d5 b4 a4 ~ b4 ~ g4 ~ a4 b4 e5 ~ d5 ~ c5 ~ b4 a4 b4 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'g3 b3 d4 g4 d4 b3 g3 b3 g3 b3 d4 g4 d4 b3 g3 b3 d3 f#3 a3 d4 a3 f#3 d3 f#3 d3 f#3 a3 d4 a3 f#3 d3 f#3 e3 g3 b3 e4 b3 g3 e3 g3 e3 g3 b3 e4 b3 g3 e3 g3 c3 e3 g3 c4 g3 e3 c3 e3 c3 e3 g3 c4 g3 e3 c3 e3' },
      { s: 'bass', d: 2, p: 'g2 ~ g2 ~ d3 ~ g2 ~ d2 ~ d2 ~ a2 ~ d2 ~ e2 ~ e2 ~ b2 ~ e2 ~ c2 ~ c2 ~ g2 ~ c2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 1, p: 'e4 e4 ~ e4 e4 ~ g4 a4 b4 ~ a4 g4 e4 ~ ~ ~ c5 ~ b4 a4 g4 ~ f#4 g4 a4 ~ g4 f#4 e4 ~ ~ ~' },
      { s: 'drum', d: 1, p: 'bd ~ bd bd ~ sd ~ bd bd ~ bd ~ sd sd cp cp' }
    ] }
  ] },
  { name: 'Сумрак Строителей', artist: 'Кочевники Пепла', bpm: 92, parts: [
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{d3@14 f3@14 a3@14} ~ ~ ~ {bb2@14 d3@14 f3@14} ~ ~ ~ {g2@14 bb2@14 d3@14} ~ ~ ~ {a2@14 c#3@14 e3@14} ~ ~ ~' },
      { s: 'bell', d: 4, p: 'a5@6 ~ ~ ~ f5@6 ~ ~ ~ e5@12 ~ ~ ~ ~ ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'd5 ~ f5 ~ a5 ~ g5 f5 f5 ~ e5 ~ d5 ~ c5 ~ bb4 ~ d5 ~ g5 ~ f5 e5 d5 ~ c#5 d5 a4 ~ ~ ~' },
      { s: 'bass', d: 4, p: 'd2 ~ ~ ~ a2 ~ d3 ~ bb2 ~ ~ ~ f2 ~ bb2 ~ g2 ~ ~ ~ d2 ~ g2 ~ a2 ~ ~ ~ e2 ~ a2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ ~ ~ cp ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'arp', d: 1, p: 'd5 ~ ~ a4 ~ ~ f5 ~ ~ a4 ~ ~ e5 ~ ~ a4 ~ ~ d5 ~ ~ a4 ~ ~ f5 ~ ~ e5 ~ ~ a4 ~ ~' },
      { s: 'pad', d: 4, p: '{d3@14 f3@14 a3@14} ~ ~ ~ {bb2@14 d3@14 f3@14} ~ ~ ~ {g2@14 bb2@14 d3@14} ~ ~ ~ {a2@14 c#3@14 e3@14} ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'd5 ~ f5 ~ a5 ~ g5 f5 f5 ~ e5 ~ d5 ~ c5 ~ bb4 ~ d5 ~ g5 ~ f5 e5 d5 ~ c#5 d5 a4 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'd5 ~ ~ a4 ~ ~ f5 ~ ~ a4 ~ ~ e5 ~ ~ a4 ~ ~ d5 ~ ~ a4 ~ ~ f5 ~ ~ e5 ~ ~ a4 ~ ~' },
      { s: 'bass', d: 4, p: 'd2 ~ ~ ~ a2 ~ d3 ~ bb2 ~ ~ ~ f2 ~ bb2 ~ g2 ~ ~ ~ d2 ~ g2 ~ a2 ~ ~ ~ e2 ~ a2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ ~ ~ cp ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{d3@14 f3@14 a3@14} ~ ~ ~ {eb3@14 g3@14 bb3@14} ~ ~ ~ {d3@14 f3@14 a3@14} ~ ~ ~ {a2@14 c#3@14 e3@14} ~ ~ ~' },
      { s: 'pluck', d: 4, p: 'd5@4 ~ ~ ~ eb5@4 ~ ~ ~ d5@4 ~ ~ ~ c#5@4 ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'a5 ~ g5 ~ f5 ~ e5 ~ f5 ~ g5 ~ a5 ~ ~ ~ bb4 ~ a4 ~ g5 ~ f5 ~ e5 ~ d5 ~ c#5 ~ d5 ~' },
      { s: 'bass', d: 4, p: 'd2 ~ ~ ~ a2 ~ d3 ~ bb2 ~ ~ ~ f2 ~ bb2 ~ g2 ~ ~ ~ d2 ~ g2 ~ a2 ~ ~ ~ e2 ~ a2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ sd ~ cp ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{d3@14 f3@14 a3@14} ~ ~ ~ {a2@14 d3@14 f3@14} ~ ~ ~ {d3@14 f3@14 a3@14} ~ ~ ~ {d2@14 f3@14 a3@14} ~ ~ ~' }
    ] }
  ] },
  { name: 'Замёрзшая молитва', artist: 'Хор мёртвых охладителей', bpm: 76, parts: [
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'bell', d: 4, p: 'e5@6 ~ ~ ~ c5@6 ~ ~ ~ a4@12 ~ ~ ~ ~ ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'bell', d: 2, p: 'a5 ~ g5 ~ f5 ~ e5 ~ d5 ~ e5 ~ f5 ~ ~ ~ e5 ~ g5 ~ c6 ~ b5 ~ a5 ~ g5 ~ a5 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'a3 e4 a4 e4 a3 e4 a4 e4 a3 e4 a4 e4 a3 e4 a4 e4 f3 c4 f4 c4 f3 c4 f4 c4 f3 c4 f4 c4 f3 c4 f4 c4 c3 e3 g3 c4 g3 e3 c3 e3 c3 e3 g3 c4 g3 e3 c3 e3 g3 b3 d4 b3 g3 b3 d4 b3 g3 b3 d4 b3 g3 b3 d4 b3' },
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'bell', d: 2, p: 'a5 ~ g5 ~ f5 ~ e5 ~ d5 ~ e5 ~ f5 ~ ~ ~ e5 ~ g5 ~ c6 ~ b5 ~ a5 ~ g5 ~ a5 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'a3 e4 a4 e4 a3 e4 a4 e4 a3 e4 a4 e4 a3 e4 a4 e4 f3 c4 f4 c4 f3 c4 f4 c4 f3 c4 f4 c4 f3 c4 f4 c4 c3 e3 g3 c4 g3 e3 c3 e3 c3 e3 g3 c4 g3 e3 c3 e3 g3 b3 d4 b3 g3 b3 d4 b3 g3 b3 d4 b3 g3 b3 d4 b3' },
      { s: 'bass', d: 4, p: 'a2 ~ ~ ~ e2 ~ a2 ~ f2 ~ ~ ~ c2 ~ f2 ~ c2 ~ ~ ~ g2 ~ c2 ~ g2 ~ ~ ~ d2 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ ~ ~ hh ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'c6 ~ b5 ~ a5 ~ e5 ~ f5 ~ a5 ~ c6 ~ ~ ~ g5 ~ e5 ~ g5 ~ c6 ~ b5 ~ a5 ~ g5 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'a3 e4 a4 e4 a3 e4 a4 e4 a3 e4 a4 e4 a3 e4 a4 e4 f3 c4 f4 c4 f3 c4 f4 c4 f3 c4 f4 c4 f3 c4 f4 c4 c3 e3 g3 c4 g3 e3 c3 e3 c3 e3 g3 c4 g3 e3 c3 e3 g3 b3 d4 b3 g3 b3 d4 b3 g3 b3 d4 b3 g3 b3 d4 b3' },
      { s: 'bass', d: 4, p: 'a2 ~ ~ ~ e2 ~ a2 ~ f2 ~ ~ ~ c2 ~ f2 ~ c2 ~ ~ ~ g2 ~ c2 ~ g2 ~ ~ ~ d2 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ hh ~ sd ~ ~ ~' }
    ] },
    { rep: 1, ch: [
      { s: 'pad', d: 4, p: '{f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~' },
      { s: 'arp', d: 1, p: 'f3 c4 f4 c4 f3 c4 f4 c4 f3 c4 f4 c4 f3 c4 f4 c4 c3 e3 g3 c4 g3 e3 c3 e3 c3 e3 g3 c4 g3 e3 c3 e3 g3 b3 d4 b3 g3 b3 d4 b3 g3 b3 d4 b3 g3 b3 d4 b3 a3 e4 a4 e4 a3 e4 a4 e4 a3 e4 a4 e4 a3 e4 a4 e4' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'c6 ~ b5 ~ a5 ~ e5 ~ f5 ~ a5 ~ c6 ~ ~ ~ g5 ~ e5 ~ g5 ~ c6 ~ b5 ~ a5 ~ g5 ~ ~ ~' },
      { s: 'bell', d: 2, p: 'a5 ~ g5 ~ f5 ~ e5 ~ d5 ~ e5 ~ f5 ~ ~ ~ e5 ~ g5 ~ c6 ~ b5 ~ a5 ~ g5 ~ a5 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'a3 e4 a4 e4 a3 e4 a4 e4 a3 e4 a4 e4 a3 e4 a4 e4 f3 c4 f4 c4 f3 c4 f4 c4 f3 c4 f4 c4 f3 c4 f4 c4 c3 e3 g3 c4 g3 e3 c3 e3 c3 e3 g3 c4 g3 e3 c3 e3 g3 b3 d4 b3 g3 b3 d4 b3 g3 b3 d4 b3 g3 b3 d4 b3' },
      { s: 'bass', d: 4, p: 'a2 ~ ~ ~ e2 ~ a2 ~ f2 ~ ~ ~ c2 ~ f2 ~ c2 ~ ~ ~ g2 ~ c2 ~ g2 ~ ~ ~ d2 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ hh ~ sd ~ cp ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~' }
    ] }
  ] },
  { name: 'Караван сквозь пыль', artist: 'Дюнанавты', bpm: 112, parts: [
    { rep: 2, ch: [
      { s: 'bass', d: 2, p: 'd2 ~ ~ d2 ~ ~ a2 ~ bb2 ~ ~ bb2 ~ ~ f2 ~ g2 ~ ~ g2 ~ ~ d2 ~ a2 ~ ~ a2 e2 f2 g2' },
      { s: 'drum', d: 1, p: 'tm ~ hh ~ tm tm hh ~ sd ~ tm hh tm ~ oh ~' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'd5 ~ ~ f5 ~ e5 d5 ~ ~ c5 d5 ~ bb4 ~ ~ ~ a4 ~ bb4 c5 ~ d5 ~ f5 e5 ~ d5 c5 d5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'd2 ~ ~ d2 ~ ~ a2 ~ bb2 ~ ~ bb2 ~ ~ f2 ~ g2 ~ ~ g2 ~ ~ d2 ~ a2 ~ ~ a2 e2 f2 g2' },
      { s: 'drum', d: 1, p: 'tm ~ hh ~ tm tm hh ~ sd ~ tm hh tm ~ <oh ~>' }
    ] },
    { rep: 3, ch: [
      { s: 'lead', d: 2, p: 'f5 ~ g5 a5 bb5 ~ a5 ~ g5 ~ f5 ~ g5 ~ ~ ~ a5 ~ bb5 ~ a5 ~ g5 ~ f5 ~ e5 ~ d5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'f2 ~ f2 ~ c2 ~ f2 ~ c2 ~ c2 ~ g2 ~ c2 ~ d2 ~ d2 ~ a2 ~ d2 ~ bb2 ~ bb2 ~ f2 ~ bb2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd <cp oh>' }
    ] },
    { rep: 2, ch: [
      { s: 'pluck', d: 2, p: 'a4 ~ d5 ~ f5 ~ d5 ~ bb4 ~ d5 ~ g5 ~ d5 ~ f5 ~ bb4 ~ d5 ~ f5 ~ e5 ~ c#5 ~ a4 ~ ~ ~' },
      { s: 'pad', d: 4, p: '{d3@14 f3@14 a3@14} ~ ~ ~ {g2@14 bb2@14 d3@14} ~ ~ ~ {bb2@14 d3@14 f3@14} ~ ~ ~ {a2@14 c#3@14 e3@14} ~ ~ ~' },
      { s: 'drum', d: 1, p: 'hh ~ ~ ~ tm ~ ~ ~ hh ~ ~ ~ tm ~ oh ~' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'd5 ~ ~ f5 ~ e5 d5 ~ ~ c5 d5 ~ bb4 ~ ~ ~ a4 ~ bb4 c5 ~ d5 ~ f5 e5 ~ d5 c5 d5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'd2 ~ ~ d2 ~ ~ a2 ~ bb2 ~ ~ bb2 ~ ~ f2 ~ g2 ~ ~ g2 ~ ~ d2 ~ a2 ~ ~ a2 e2 f2 g2' },
      { s: 'drum', d: 1, p: 'tm ~ hh ~ tm tm hh ~ sd ~ tm hh tm ~ oh ~' }
    ] },
    { rep: 3, ch: [
      { s: 'lead', d: 2, p: 'f5 ~ g5 a5 bb5 ~ a5 ~ g5 ~ f5 ~ g5 ~ ~ ~ a5 ~ bb5 ~ a5 ~ g5 ~ f5 ~ e5 ~ d5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'f2 ~ f2 ~ c2 ~ f2 ~ c2 ~ c2 ~ g2 ~ c2 ~ d2 ~ d2 ~ a2 ~ d2 ~ bb2 ~ bb2 ~ f2 ~ bb2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd <cp oh>' }
    ] },
    { rep: 2, ch: [
      { s: 'bass', d: 2, p: 'd2 ~ ~ d2 ~ ~ a2 ~ bb2 ~ ~ bb2 ~ ~ f2 ~ a2 ~ ~ a2 ~ ~ e2 ~ d2 ~ ~ ~ ~ ~ ~ ~' },
      { s: 'drum', d: 1, p: 'tm ~ hh ~ tm tm hh ~ sd ~ tm hh tm ~ oh ~' }
    ] }
  ] },
  { name: 'Печь Второй Чистки', artist: 'Кузнецы Шлака', bpm: 160, parts: [
    { rep: 2, ch: [
      { s: 'bass', d: 1, p: 'c2 c2 c3 c2 c2 c3 c2 c2 c2 c2 c3 c2 c2 c3 c2 c2 ab2 ab2 ab2 ab2 ab2 ab2 ab2 ab2 g2 g2 g3 g2 g2 g3 g2 g2' },
      { s: 'drum', d: 1, p: 'bd bd sd bd bd sd bd cp' }
    ] },
    { rep: 6, ch: [
      { s: 'lead', d: 1, p: 'c4 c4 eb4 c4 f4 c4 eb4 ~ c4 c4 eb4 c4 g4 f4 eb4 ~ c4 c4 eb4 c4 ab4 g4 f4 eb4 f4 ~ eb4 ~ c4 ~ bb3 ~' },
      { s: 'bass', d: 1, p: 'c2 c2 c3 c2 c2 c3 c2 c2 c2 c2 c3 c2 c2 c3 c2 c2 ab2 ab2 ab2 ab2 ab2 ab2 ab2 ab2 g2 g2 g3 g2 g2 g3 g2 g2' },
      { s: 'drum', d: 1, p: 'bd bd sd bd bd sd bd <bd cp>' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'g4 ~ bb4 ~ eb5 ~ d5 ~ c5 ~ bb4 ~ c5 ~ ~ ~ ab4 ~ bb4 ~ c5 ~ eb5 ~ f5 ~ eb5 ~ d5 ~ ~ ~' },
      { s: 'pad', d: 4, p: '{c3@14 eb3@14 g3@14} ~ ~ ~ {c3@14 eb3@14 g3@14} ~ ~ ~ {ab2@14 c3@14 eb3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'bass', d: 2, p: 'c2 ~ c2 ~ g2 ~ c2 ~ c2 ~ c2 ~ g2 ~ c2 ~ ab2 ~ ab2 ~ eb2 ~ ab2 ~ g2 ~ g2 ~ d2 ~ g2 ~' },
      { s: 'drum', d: 2, p: 'bd ~ sd ~ bd ~ sd cp' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 1, p: 'c4 c4 eb4 c4 f4 c4 eb4 ~ c4 c4 eb4 c4 g4 f4 eb4 ~ c4 c4 eb4 c4 ab4 g4 f4 eb4 f4 ~ eb4 ~ c4 ~ bb3 ~' },
      { s: 'bass', d: 1, p: 'c2 c2 c3 c2 c2 c3 c2 c2 c2 c2 c3 c2 c2 c3 c2 c2 ab2 ab2 ab2 ab2 ab2 ab2 ab2 ab2 g2 g2 g3 g2 g2 g3 g2 g2' },
      { s: 'drum', d: 1, p: 'bd bd sd bd bd sd bd cp' }
    ] },
    { rep: 2, ch: [
      { s: 'drum', d: 1, p: 'tm ~ sd ~ tm tm sd ~ tm ~ sd sd tm tm sd cp' },
      { s: 'bass', d: 1, p: 'c2 ~ c2 ~ c2 ~ c2 ~ c2 ~ c2 ~ c2 ~ c2 ~ ab2 ~ ab2 ~ ab2 ~ ab2 ~ g2 ~ g2 ~ g2 ~ g2 ~' }
    ] },
    { rep: 6, ch: [
      { s: 'lead', d: 1, p: 'c4 c4 eb4 c4 f4 c4 eb4 ~ c4 c4 eb4 c4 g4 f4 eb4 ~ c4 c4 eb4 c4 ab4 g4 f4 eb4 f4 ~ eb4 ~ c4 ~ bb3 ~' },
      { s: 'bass', d: 1, p: 'c2 c2 c3 c2 c2 c3 c2 c2 c2 c2 c3 c2 c2 c3 c2 c2 ab2 ab2 ab2 ab2 ab2 ab2 ab2 ab2 g2 g2 g3 g2 g2 g3 g2 g2' },
      { s: 'drum', d: 1, p: 'bd bd sd bd bd sd bd <bd cp>' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'eb5 ~ ~ d5 eb5 ~ g5 ~ ab5 ~ g5 f5 g5 ~ ~ ~ bb5 ~ ab5 g5 f5 ~ g5 ~ ab5 g5 f5 eb5 c5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'eb2 ~ eb2 ~ bb2 ~ eb2 ~ ab2 ~ ab2 ~ eb2 ~ ab2 ~ bb2 ~ bb2 ~ f2 ~ bb2 ~ c2 ~ c2 ~ g2 ~ c2 ~' },
      { s: 'drum', d: 2, p: 'bd hh sd hh bd hh sd cp' }
    ] }
  ] },
  { name: 'Корона из вентилей', artist: 'Бароны Свалки', bpm: 140, parts: [
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'g4 g4 g4 ~ c5 ~ c5 ~ e5 ~ d5 ~ c5 ~ ~ ~ f5 f5 f5 ~ d5 ~ b4 ~ c5 ~ d5 e5 c5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'c3 ~ g2 ~ c3 ~ g2 ~ c3 ~ g2 ~ e2 ~ g2 ~ f2 ~ c3 ~ g2 ~ g2 ~ c3 ~ g2 ~ c3 ~ ~ ~' },
      { s: 'drum', d: 2, p: 'tm ~ sd ~ tm ~ sd sd' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'g4 g4 g4 ~ c5 ~ c5 ~ e5 ~ d5 ~ c5 ~ ~ ~ f5 f5 f5 ~ d5 ~ b4 ~ c5 ~ d5 e5 c5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'c3 ~ g2 ~ c3 ~ g2 ~ c3 ~ g2 ~ e2 ~ g2 ~ f2 ~ c3 ~ g2 ~ g2 ~ c3 ~ g2 ~ c3 ~ ~ ~' },
      { s: 'drum', d: 2, p: 'bd ~ sd ~ bd ~ sd cp' }
    ] },
    { rep: 2, ch: [
      { s: 'pluck', d: 2, p: 'f4 ~ a4 ~ c5 ~ ~ ~ g4 ~ b4 ~ d5 ~ ~ ~ e4 ~ g4 ~ c5 ~ b4 ~ a4 ~ b4 ~ c5 ~ ~ ~' },
      { s: 'pad', d: 4, p: '{f2@14 a2@14 c3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~' },
      { s: 'drum', d: 2, p: 'hh ~ ~ ~ cp ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'g4 g4 g4 ~ c5 ~ c5 ~ e5 ~ d5 ~ c5 ~ ~ ~ f5 f5 f5 ~ d5 ~ b4 ~ c5 ~ d5 e5 c5 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'g3 b3 d4 g4 d4 b3 g3 b3 g3 b3 d4 g4 d4 b3 g3 b3 d3 f#3 a3 d4 a3 f#3 d3 f#3 d3 f#3 a3 d4 a3 f#3 d3 f#3 e3 g3 b3 e4 b3 g3 e3 g3 e3 g3 b3 e4 b3 g3 e3 g3 c3 e3 g3 c4 g3 e3 c3 e3 c3 e3 g3 c4 g3 e3 c3 e3' },
      { s: 'bass', d: 2, p: 'c3 ~ g2 ~ c3 ~ g2 ~ c3 ~ g2 ~ e2 ~ g2 ~ f2 ~ c3 ~ g2 ~ g2 ~ c3 ~ g2 ~ c3 ~ ~ ~' },
      { s: 'drum', d: 2, p: 'bd ~ sd ~ bd ~ sd cp' }
    ] },
    { rep: 1, ch: [
      { s: 'drum', d: 1, p: 'tm ~ tm ~ tm tm sd ~ tm ~ tm ~ sd sd cp cp' },
      { s: 'bass', d: 2, p: 'c3 ~ ~ ~ g2 ~ ~ ~ f2 ~ ~ ~ g2 ~ ~ ~' }
    ] },
    { rep: 3, ch: [
      { s: 'lead', d: 2, p: 'c5 c5 c5 ~ e5 ~ e5 ~ g5 ~ f5 ~ e5 ~ ~ ~ a5 a5 a5 ~ f5 ~ d5 ~ e5 ~ f5 g5 c5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'c3 ~ g2 ~ c3 ~ g2 ~ c3 ~ g2 ~ e2 ~ g2 ~ f2 ~ c3 ~ g2 ~ g2 ~ c3 ~ g2 ~ c3 ~ ~ ~' },
      { s: 'drum', d: 2, p: 'bd ~ sd ~ bd ~ sd cp' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{c3@14 e3@14 g3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~' },
      { s: 'bell', d: 4, p: 'g5@6 ~ ~ ~ e5@6 ~ ~ ~ c5@14 ~ ~ ~ ~ ~ ~ ~' }
    ] }
  ] },
  { name: 'Ржавый рассвет', artist: 'Одинокий Оператор', bpm: 66, parts: [
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'pluck', d: 2, p: 'a3 ~ e4 ~ c4 ~ e4 ~ f3 ~ c4 ~ a3 ~ c4 ~ g3 ~ c4 ~ e4 ~ c4 ~ g3 ~ d4 ~ b3 ~ d4 ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'pluck', d: 2, p: 'a3 ~ e4 ~ c4 ~ e4 ~ f3 ~ c4 ~ a3 ~ c4 ~ g3 ~ c4 ~ e4 ~ c4 ~ g3 ~ d4 ~ b3 ~ d4 ~' },
      { s: 'bell', d: 4, p: 'e5@6 ~ ~ ~ c5@6 ~ ~ ~ b4@12 ~ ~ ~ a4@6 ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'e5 ~ ~ c5 ~ ~ a4 ~ b4 ~ ~ ~ ~ ~ ~ ~ c5 ~ ~ d5 ~ ~ e5 ~ d5 ~ ~ ~ b4 ~ ~ ~ ~' },
      { s: 'pluck', d: 2, p: 'a3 ~ e4 ~ c4 ~ e4 ~ f3 ~ c4 ~ a3 ~ c4 ~ g3 ~ c4 ~ e4 ~ c4 ~ g3 ~ d4 ~ b3 ~ d4 ~' },
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {g2@14 b2@14 d3@14} ~ ~ ~' },
      { s: 'drum', d: 2, p: 'bd ~ ~ ~ ~ ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{d3@14 f3@14 a3@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~ {e2@14 g#2@14 b2@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~' },
      { s: 'bell', d: 4, p: 'd5@6 ~ ~ ~ c5@6 ~ ~ ~ b4@12 ~ ~ ~ a4@6 ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'e5 ~ ~ c5 ~ ~ a4 ~ b4 ~ ~ ~ ~ ~ ~ ~ c5 ~ ~ d5 ~ ~ e5 ~ d5 ~ ~ ~ b4 ~ ~ ~ ~' },
      { s: 'bell', d: 2, p: 'a5 ~ ~ ~ ~ ~ ~ ~ g5 ~ ~ ~ ~ ~ ~ ~ f5 ~ ~ ~ e5 ~ ~ ~ d5 ~ ~ ~ ~ ~ ~ ~' },
      { s: 'pluck', d: 2, p: 'a3 ~ e4 ~ c4 ~ e4 ~ f3 ~ c4 ~ a3 ~ c4 ~ g3 ~ c4 ~ e4 ~ c4 ~ g3 ~ d4 ~ b3 ~ d4 ~' },
      { s: 'drum', d: 2, p: 'bd ~ ~ ~ ~ ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{a2@14 c3@14 e3@14} ~ ~ ~ {f2@14 a2@14 c3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {a2@14 c3@14 e3@14} ~ ~ ~' }
    ] }
  ] },
  { name: 'Орбита свидетелей', artist: 'Кольцо СКОРЧ', bpm: 96, parts: [
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{f3@14 a3@14 c4@14} ~ ~ ~ {bb2@14 d3@14 f3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {f3@14 a3@14 c4@14} ~ ~ ~' },
      { s: 'bell', d: 4, p: 'c5@6 ~ ~ ~ f5@6 ~ ~ ~ a5@12 ~ ~ ~ ~ ~ ~ ~' }
    ] },
    { rep: 3, ch: [
      { s: 'lead', d: 2, p: 'f5 ~ a5 ~ c6 ~ bb5 a5 g5 ~ f5 ~ g5 ~ ~ ~ a5 ~ bb5 ~ c6 ~ d6 ~ c6 ~ bb5 a5 f5 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'f2 ~ c3 ~ f2 ~ c3 ~ bb2 ~ f2 ~ bb2 ~ f2 ~ c2 ~ g2 ~ c2 ~ g2 ~ f2 ~ c3 ~ f2 ~ c3 ~' },
      { s: 'drum', d: 2, p: 'hh ~ hh ~ cp ~ ~ ~' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'd5 ~ f5 ~ a5 ~ bb5 ~ a5 ~ g5 ~ f5 ~ ~ ~ e5 ~ g5 ~ c5 ~ d5 ~ c5 ~ a4 ~ f4 ~ ~ ~' },
      { s: 'bass', d: 2, p: 'd2 ~ a2 ~ d2 ~ a2 ~ bb2 ~ f2 ~ bb2 ~ f2 ~ c2 ~ g2 ~ c2 ~ g2 ~ f2 ~ c3 ~ f2 ~ c3 ~' },
      { s: 'drum', d: 2, p: 'bd ~ hh ~ sd ~ hh ~' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'f5 ~ a5 ~ c6 ~ bb5 a5 g5 ~ f5 ~ g5 ~ ~ ~ a5 ~ bb5 ~ c6 ~ d6 ~ c6 ~ bb5 a5 f5 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'f3 a3 c4 f4 c4 a3 f3 a3 f3 a3 c4 f4 c4 a3 f3 a3 bb2 d3 f3 bb3 f3 d3 bb2 d3 bb2 d3 f3 bb3 f3 d3 bb2 d3 c3 e3 g3 c4 g3 e3 c3 e3 c3 e3 g3 c4 g3 e3 c3 e3 f3 a3 c4 f4 c4 a3 f3 a3 f3 a3 c4 f4 c4 a3 f3 a3' },
      { s: 'bass', d: 2, p: 'f2 ~ c3 ~ f2 ~ c3 ~ bb2 ~ f2 ~ bb2 ~ f2 ~ c2 ~ g2 ~ c2 ~ g2 ~ f2 ~ c3 ~ f2 ~ c3 ~' },
      { s: 'drum', d: 2, p: 'bd ~ hh ~ sd ~ hh ~' }
    ] },
    { rep: 3, ch: [
      { s: 'lead', d: 2, p: 'c6 ~ bb5 a5 g5 ~ a5 ~ bb5 ~ c6 ~ d6 ~ ~ ~ c6 ~ bb5 a5 g5 ~ f5 ~ g5 ~ a5 ~ bb5 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'f3 a3 c4 f4 c4 a3 f3 a3 f3 a3 c4 f4 c4 a3 f3 a3 bb2 d3 f3 bb3 f3 d3 bb2 d3 bb2 d3 f3 bb3 f3 d3 bb2 d3 c3 e3 g3 c4 g3 e3 c3 e3 c3 e3 g3 c4 g3 e3 c3 e3 f3 a3 c4 f4 c4 a3 f3 a3 f3 a3 c4 f4 c4 a3 f3 a3' },
      { s: 'bass', d: 2, p: 'f2 ~ c3 ~ f2 ~ c3 ~ bb2 ~ f2 ~ bb2 ~ f2 ~ c2 ~ g2 ~ c2 ~ g2 ~ f2 ~ c3 ~ f2 ~ c3 ~' },
      { s: 'drum', d: 2, p: 'bd ~ hh ~ sd ~ cp ~' }
    ] },
    { rep: 2, ch: [
      { s: 'pad', d: 4, p: '{f3@14 a3@14 c4@14} ~ ~ ~ {bb2@14 d3@14 f3@14} ~ ~ ~ {c3@14 e3@14 g3@14} ~ ~ ~ {f3@14 a3@14 c4@14} ~ ~ ~' },
      { s: 'bell', d: 4, p: 'a5@6 ~ ~ ~ g5@6 ~ ~ ~ f5@14 ~ ~ ~ ~ ~ ~ ~' }
    ] }
  ] },
  { name: 'Вхождение в атмосферу', artist: 'Орбитальный десант Вейл', bpm: 172, parts: [
    { rep: 2, ch: [
      { s: 'arp', d: 1, p: 'g3 bb3 d4 g4 d4 bb3 g3 bb3 g3 bb3 d4 g4 d4 bb3 g3 bb3 eb3 g3 bb3 eb4 bb3 g3 eb3 g3 eb3 g3 bb3 eb4 bb3 g3 eb3 g3' },
      { s: 'drum', d: 1, p: 'bd ~ ~ sd bd ~ ~ sd bd ~ ~ sd bd ~ cp cp' }
    ] },
    { rep: 6, ch: [
      { s: 'lead', d: 2, p: 'g5 ~ f5 d5 bb4 ~ d5 ~ f5 ~ g5 ~ bb5 ~ ~ ~ c6 ~ bb5 a5 g5 ~ a5 ~ bb5 ~ a5 g5 f5 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'g3 bb3 d4 g4 d4 bb3 g3 bb3 g3 bb3 d4 g4 d4 bb3 g3 bb3 eb3 g3 bb3 eb4 bb3 g3 eb3 g3 eb3 g3 bb3 eb4 bb3 g3 eb3 g3 f3 a3 c4 f4 c4 a3 f3 a3 f3 a3 c4 f4 c4 a3 f3 a3 g3 bb3 d4 g4 d4 bb3 g3 bb3 g3 bb3 d4 g4 d4 bb3 g3 bb3' },
      { s: 'bass', d: 2, p: 'g2 g2 g3 g2 g2 g3 g2 g2 eb2 eb2 eb3 eb2 eb2 eb3 eb2 eb2 f2 f2 f3 f2 f2 f3 f2 f2 g2 g2 g3 g2 g2 g3 g2 g2' },
      { s: 'drum', d: 1, p: 'bd ~ sd ~ bd ~ sd cp bd ~ sd ~ bd ~ sd <cp sd>' }
    ] },
    { rep: 3, ch: [
      { s: 'lead', d: 2, p: 'bb5 ~ a5 g5 f5 ~ g5 ~ bb5 ~ c6 ~ d6 ~ ~ ~ c6 ~ bb5 ~ a5 ~ g5 ~ f5 ~ g5 ~ bb5 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'bb2 d3 f3 bb3 f3 d3 bb2 d3 bb2 d3 f3 bb3 f3 d3 bb2 d3 g3 bb3 d4 g4 d4 bb3 g3 bb3 g3 bb3 d4 g4 d4 bb3 g3 bb3 eb3 g3 bb3 eb4 bb3 g3 eb3 g3 eb3 g3 bb3 eb4 bb3 g3 eb3 g3 f3 a3 c4 f4 c4 a3 f3 a3 f3 a3 c4 f4 c4 a3 f3 a3' },
      { s: 'bass', d: 2, p: 'bb2 bb2 bb3 bb2 bb2 bb3 bb2 bb2 g2 g2 g3 g2 g2 g3 g2 g2 eb2 eb2 eb3 eb2 eb2 eb3 eb2 eb2 f2 f2 f3 f2 f2 f3 f2 f2' },
      { s: 'drum', d: 1, p: 'bd bd sd bd bd sd bd cp bd bd sd bd bd sd cp cp' }
    ] },
    { rep: 2, ch: [
      { s: 'drum', d: 1, p: 'tm ~ tm tm tm ~ tm ~ tm ~ tm tm tm ~ sd sd' },
      { s: 'bass', d: 2, p: 'g2 ~ g2 ~ g2 ~ g2 ~ g2 ~ g2 ~ g2 ~ g2 ~ f#2 ~ f#2 ~ f#2 ~ f#2 ~ f#2 ~ f#2 ~ f#2 ~ f#2 ~' }
    ] },
    { rep: 4, ch: [
      { s: 'lead', d: 2, p: 'd6 ~ c6 bb5 a5 ~ g5 ~ bb5 ~ c6 ~ d6 ~ ~ ~ eb6 ~ d6 c6 bb5 ~ a5 ~ g5 ~ f#5 ~ g5 ~ ~ ~' },
      { s: 'arp', d: 1, p: 'g3 bb3 d4 g4 d4 bb3 g3 bb3 g3 bb3 d4 g4 d4 bb3 g3 bb3 eb3 g3 bb3 eb4 bb3 g3 eb3 g3 eb3 g3 bb3 eb4 bb3 g3 eb3 g3 f3 a3 c4 f4 c4 a3 f3 a3 f3 a3 c4 f4 c4 a3 f3 a3 g3 bb3 d4 g4 d4 bb3 g3 bb3 g3 bb3 d4 g4 d4 bb3 g3 bb3' },
      { s: 'bass', d: 2, p: 'g2 g2 g3 g2 g2 g3 g2 g2 eb2 eb2 eb3 eb2 eb2 eb3 eb2 eb2 f2 f2 f3 f2 f2 f3 f2 f2 g2 g2 g3 g2 g2 g3 g2 g2' },
      { s: 'drum', d: 1, p: 'bd bd sd bd bd sd bd cp bd bd sd bd bd sd cp cp' }
    ] },
    { rep: 2, ch: [
      { s: 'lead', d: 2, p: 'g5 ~ f5 d5 bb4 ~ d5 ~ f5 ~ g5 ~ bb5 ~ ~ ~ g5 ~ f5 ~ d5 ~ ~ ~ g4 ~ bb4 ~ g4 ~ ~ ~' },
      { s: 'drum', d: 2, p: 'bd ~ sd ~ bd ~ sd cp' }
    ] }
  ] },
  // the SPLASH theme: quiet, drumless, slow — pads, soft bells and a
  // gentle pluck; excluded from the round rotation (splash flag)
  { name: 'Маяки Строителей', artist: 'Кочевники Пепла', splash: true, bpm: 63, parts: [
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
// pattern → { map: {quarterStep: [ev,…]}, len } — the grid runs at 4
// quarter-steps per 16th, so triplets and 32nds land on integer slots
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

// ================= the 16-bit voices =================
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
    if (d === 'hh') return mNoise(t, 0.04, 'highpass', 7000, 0.14);
    if (d === 'oh') return mNoise(t, 0.16, 'highpass', 6000, 0.12);
    if (d === 'sd') return mNoise(t, 0.12, 'bandpass', 1900, 0.3);
    if (d === 'cp') return mNoise(t, 0.09, 'bandpass', 1100, 0.26);
    const o = AC.createOscillator(), g = AC.createGain();
    const bd = d === 'bd';
    o.type = 'sine';
    o.frequency.setValueAtTime(bd ? 150 : 320, t);
    o.frequency.exponentialRampToValueAtTime(bd ? 42 : 150, t + (bd ? 0.13 : 0.17));
    g.gain.setValueAtTime(bd ? 0.5 : 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (bd ? 0.16 : 0.2));
    o.connect(g); g.connect(mBus);
    o.start(t); o.stop(t + 0.26);
  }
  function mTone(t, f, dur, v, o) {
    o = o || {};
    const osc = AC.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.value = f;
    if (o.det) osc.detune.value = o.det;
    let node = osc;
    if (o.cut) {
      const flt = AC.createBiquadFilter();
      flt.frequency.value = o.cut;
      osc.connect(flt); node = flt;
    }
    const g = AC.createGain();
    const a = o.att || 0.005;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + Math.max(a, dur * 0.75));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
    node.connect(g); g.connect(mBus);
    if (o.echo && mDelay) {
      const s = AC.createGain();
      s.gain.value = o.echo;
      g.connect(s); s.connect(mDelay);
    }
    if (o.vib) {
      const lf = AC.createOscillator();
      lf.frequency.value = 5.7;
      const lg = AC.createGain();
      lg.gain.value = o.vib;
      lf.connect(lg); lg.connect(osc.detune);
      lf.start(t); lf.stop(t + dur + 0.05);
    }
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  const MVOICE = {
    lead: (t, f, d) => mTone(t, f, Math.max(d, 0.12), 0.16, { vib: 9, echo: 0.22 }),
    pluck: (t, f, d) => mTone(t, f, 0.14, 0.15, { echo: 0.18 }),
    arp: (t, f, d) => mTone(t, f, 0.11, 0.10, { cut: 2800, echo: 0.26 }),
    bass: (t, f, d) => mTone(t, f, Math.min(Math.max(d, 0.16), 0.4), 0.24, { type: 'triangle', cut: 700 }),
    bell: (t, f, d) => { mTone(t, f, Math.max(d, 0.3), 0.12, { vib: 5, echo: 0.3 }); mTone(t, f * 2, d, 0.045, { echo: 0.3 }); },
    pad: (t, f, d) => { mTone(t, f, d * 1.3, 0.06, { type: 'sawtooth', det: -7, att: 0.25, cut: 1100 }); mTone(t, f, d * 1.3, 0.06, { type: 'sawtooth', det: 7, att: 0.3, cut: 1100 }); }
  };
  
  // ============ shot sounds: the launch punch + the flight loops ============
  // launch: a short medium crack at the muzzle; flight: a quiet per-weapon
  // loop while any shell is airborne — flySync (world.js step) keeps it
  // glued to the live shot, so MIRV heads and background rollers keep
  // their hum too. Both ride the EFFECTS volume (sVol), not the music's
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
  // a weapon's OWN blast level — the exact curve sfx() gives its explosion
  // (clamp(0.12*r/45, .06, .5)): the launch plays at HALF of it, the
  // flight hum at an eighth. Deriving from the weapon's own blast is what
  // keeps shots quieter than explosions for EVERY weapon, big or small
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
// master gain rides the music volume; a dotted-eighth feedback delay
// gives the leads their Amiga shimmer
let mOn = false, mTimer = null, mGain = null, mDelay = null, mFB = null, mBus = null;
let mAnalyser = null;
let mTrack = -1, mOrder = [], mPos = 0, mExt = false, mFollow = false, mPaused = false;
let mPart = 0, mPass = 0, mQ = 0, mNextT = 0, mCur = null;
let mSess = false;
const mCache = {};
// round rotation = non-splash tracks only
const mPool = MTRACKS.map((t, i) => (t.splash ? -1 : i)).filter(i => i >= 0);
// music volume: a whisper by default (0.5%), independent of the effects
// volume; once its own control is touched it lives in LS on its own
function musicVol() { return isNaN(mVolSaved) ? 0.005 : clamp(mVolSaved, 0, 1); }
function musicSync() { if (mGain) mGain.gain.value = musicVol(); }
function musicSetVol(v) {
  mVolSaved = clamp(v, 0, 1);
  try { localStorage.setItem(LS_MVOL, String(mVolSaved)); } catch (e) {}
  musicSync();
}
// ================= MediaSession: the system media keys =================
// captured while the chiptune owns the stage, RELEASED (handlers nulled →
// the browser's default integration for the host's <audio> returns) the
// moment the external stream takes over — see musicExternal
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
  // DYNAMIC ownership: the chiptune holds the system media keys exactly
  // while it is the running source and every external stream is fully
  // stopped (or none ever was). An external stream that starts or resumes
  // takes the stage back at once (musicExternal); once it is over and the
  // built-in player runs, the hardware keys and the OS overlay drive the
  // chiptune — the same commands the HUD buttons send
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
// compile a track: parsed channels, part loop lengths (LCM), the part
// start offsets and the total duration — cached per index
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
  // every voice and drum routes through a per-cut bus node into mGain —
  // the one node a track switch can silence instantly
  function mNewBus() {
    const b = AC.createGain();
    b.gain.value = 1;
    b.connect(mGain);
    return b;
  }
  // hard cut of everything already scheduled: switching, seeking, pausing
  // or stopping must not let the old track's long pads and echo tails ring
  // over the new one (the "two tracks at once" bug) — the voice bus and the
  // feedback delay are swapped for fresh nodes, the old ones fade in 50ms
  // and get dropped
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
      mFB.gain.value = 0.3;
      mDelay.connect(mFB);
      mFB.connect(mDelay);
      mDelay.connect(mGain);
      try { mDelay.delayTime.value = mCur ? mCur.delay : 0.2; } catch (e) {}
    }
  }
// the round hook: next theme from the shuffled non-splash setlist
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
  // the playlist entry point: play a given track (sequential follow)
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
    // a resume IS an un-stop: the persisted halt flag must go too, or the
    // next page load stays silent after the user pressed play
    mStopped = false;
    try { localStorage.removeItem(LS_MSTATE); } catch (e) {}
    mNextT = AC.currentTime + 0.15;
    mSessionSync();
  }
// stop: pause + rewind to the track's start
// the RAW stop flag: musicInfo() is null until a track is loaded, and
// the splash sync / round 1 run BEFORE that — they must read the
// persisted state directly, not through musicInfo
function musicStopped() { return mStopped; }

function musicHalt() {
  mPaused = true;
    mPart = 0; mPass = 0; mQ = 0;
    mCut();
    // STOP is a decision, not a pause: remember it — no auto-resume of any
    // kind (splash sync, duel start, round hooks) until play is pressed
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
// lookahead scheduler: 110ms ticks, 0.4s headroom; walks the part list
// pass by pass, then rolls on (sequentially in playlist mode, shuffled
// after a round hook). While the external stream is MASTER the clock
// holds its position; a paused clock just waits; late steps (a throttled
// tab) are skipped silently
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
    // the water's tap: post-gain, so the waves follow the audible level
    mAnalyser = AC.createAnalyser();
    mAnalyser.fftSize = 1024;
    mAnalyser.smoothingTimeConstant = 0.7;
    mGain.connect(mAnalyser);
    mDelay = AC.createDelay(1);
    mDelay.delayTime.value = 0.2;
    mFB = AC.createGain();
    mFB.gain.value = 0.3;
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