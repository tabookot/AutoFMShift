// compat.js - guard for old browsers (moved out of index.html for CSP).
(function () {
    var isCompatible = true;
    if (!window.fetch || !window.Promise || !window.URLSearchParams) {
        isCompatible = false;
    }
    try {
        var el = document.createElement('div');
        el.style.setProperty('--test', '1');
        if (el.style.getPropertyValue('--test') !== '1') {
            isCompatible = false;
        }
    } catch (e) {
        isCompatible = false;
    }

    if (!isCompatible) {
        var blocker = document.createElement('div');
        blocker.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#1a1a1a;color:#f1f1f1;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:20px;text-align:center;';

        var container = document.createElement('div');
        container.style.cssText = 'max-width:500px;line-height:1.6;';

        container.innerHTML =
            '<h2 style="color:#ff4757;margin-bottom:20px;font-size:24px;">Браузер не поддерживается</h2>' +
            '<p style="font-size:16px;margin-bottom:20px;">Ваш браузер устарел и не поддерживает технологии, необходимые для работы этого приложения.</p>' +
            '<p style="font-size:16px;margin-bottom:30px;">Пожалуйста, обновите ваш браузер до последней версии (Chrome, Firefox, Safari, Edge) или используйте современное устройство.</p>' +
            '<a href="https://www.google.com/chrome/" target="_blank" rel="noopener" style="background:#0096c7;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Скачать Chrome</a>';

        blocker.appendChild(container);
        document.documentElement.appendChild(blocker);

        throw new Error("Browser not supported. Stopping execution.");
    }
})();
