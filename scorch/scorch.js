// scorch.js — loader of the split build: fetches the parts and runs
// them as ONE function body. Top-level let/const stay private to the game
// (no collisions with host-page globals like `state`); cross-references
// between core/world/ui work exactly as in the old single-file IIFE
(() => {
  if (window.Scorch) return; // already loaded
  const base = (document.currentScript && document.currentScript.src || location.href)
    .replace(/[^/]*$/, '');
  // scorch.music.js is OPTIONAL: a missing file only means the duel
  // plays no chiptune — the core hooks guard on typeof, so an old
  // deploy without it keeps working untouched
  const must = ['scorch.core.js', 'scorch.world.js', 'scorch.ui.js'];
  const opt = ['scorch.music.js'];
  const get = (u, soft) => fetch(base + u).then(r => {
    if (!r.ok) { if (soft) return ''; throw new Error(u + ' \u2192 HTTP ' + r.status); }
    return r.text();
  }).catch(e => { if (soft) return ''; throw e; });
  Promise.all(must.map(u => get(u, false)).concat(opt.map(u => get(u, true))))
    .then(srcs => {
      // music slots in right after core: same shared scope either way
      new Function([srcs[0], srcs[3], srcs[1], srcs[2]].join('\n;\n'))();
    })
    .catch(e => console.error('[Scorch] load failed:', e.message));
})();