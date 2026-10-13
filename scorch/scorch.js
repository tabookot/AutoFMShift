// scorch.js - loader: one generated bundle (scorch.bundle.js).
(() => {
  const SC_BUILD = '0.8.17'; // меняет tools/set_version.py
  if (window.Scorch) return; // already loaded
  const base = (document.currentScript && document.currentScript.src || location.href)
    .replace(/[^/]*$/, '');
  const s = document.createElement('script');
  s.src = base + 'scorch.bundle.js?v=' + SC_BUILD;
  s.async = true;
  s.onerror = () => {
    console.error('[Scorch] bundle failed to load');
    if (typeof showToast === 'function') showToast('Игра не загрузилась: обнови страницу');
  };
  document.head.appendChild(s);
})();
