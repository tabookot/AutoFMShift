// scorch.js — loader of the split build: fetches the three parts and runs
// them as ONE function body. Top-level let/const stay private to the game
// (no collisions with host-page globals like `state`); cross-references
// between core/world/ui work exactly as in the old single-file IIFE
(() => {
    if (window.Scorch) return; // already loaded
    const base = (document.currentScript && document.currentScript.src || location.href)
      .replace(/[^/]*$/, '');
    const parts = ['scorch.core.js', 'scorch.world.js', 'scorch.ui.js'];
    Promise.all(parts.map(u => fetch(base + u).then(r => {
      if (!r.ok) throw new Error(u + ' \u2192 HTTP ' + r.status);
      return r.text();
    }))).then(srcs => {
      new Function(srcs.join('\n;\n'))();
    }).catch(e => console.error('[Scorch] load failed:', e.message));
  })();