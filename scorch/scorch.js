// scorch.js - loader. Primary: one generated bundle (scorch.bundle.js).
// Fallback (legacy, removed in step 17): fetch the parts and run them
// as ONE function body (top-level let/const stay private to the game).
(() => {
  const SC_BUILD = '0.8.9'; // меняет tools/set_version.py
  if (window.Scorch) return; // already loaded
  const base = (document.currentScript && document.currentScript.src || location.href)
    .replace(/[^/]*$/, '');
  // scorch.music.js is OPTIONAL: a missing file only means no chiptune
  const must = ['scorch.core.js', 'scorch.world.js', 'scorch.ui.js'];
  const opt = ['scorch.music.js'];
  function legacyLoad() {
    const get = (u, soft) => fetch(base + u + '?v=' + SC_BUILD).then(r => {
      if (!r.ok) { if (soft) return ''; throw new Error(u + ' \u2192 HTTP ' + r.status); }
      return r.text();
    }).catch(e => { if (soft) return ''; throw e; });
    Promise.all(must.map(u => get(u, false)).concat(opt.map(u => get(u, true))))
      .then(srcs => {
        // music slots in right after core: same shared scope either way
        new Function('var __scBase = ' + JSON.stringify(base) + ';\n'
          + [srcs[0], srcs[3], srcs[1], srcs[2]].join('\n;\n'))();
      })
      .catch(e => console.error('[Scorch] load failed:', e.message));
  }
  const s = document.createElement('script');
  s.src = base + 'scorch.bundle.js?v=' + SC_BUILD;
  s.async = true;
  s.onerror = () => { console.warn('[Scorch] bundle failed, legacy loader'); legacyLoad(); };
  document.head.appendChild(s);
})();
