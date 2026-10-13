# tools/ — вспомогательные скрипты AutoFMShift

Python 3.8+, только стандартная библиотека. Запускаются из корня репозитория.

| Файл | Назначение |
|---|---|
| set_version.py | Меняет `VERSION` в core.js, `?v=` у локальных `<script>`/`<link>` и `SC_BUILD` в scorch/scorch.js. Использование: `python tools/set_version.py X.Y.Z` |
| build_scorch.py | Собирает `scorch/scorch.bundle.js` из частей Scorch. `--check` возвращает код 1, если бандл устарел |
| embed_attribution.py | Превращает `scorch/samples/ATTRIBUTION.txt` в `scorch/scorch.credits.js` |
| extract.py | Вырезает функцию, константу или диапазон строк для вставки в чат. Ключи `--outline` и `--grep` |
| sri.py | Считает sha384 для CDN-скриптов (значения `integrity`). SRI (Subresource Integrity) — проверка, что скрипт с чужого сервера не подменили |
| repo_map.py, repo_map.bat | Пересоздаёт `REPO_MAP.md` (файлы, размеры, порядок подключения, индекс символов) |
| REPO_MAP.md | Карта репозитория. Генерируется, руками не править |

## Правила

- `VERSION` меняется только через `set_version.py`. Версия, `?v=` и `SC_BUILD` должны совпадать.
- `CACHE_VERSION` и `LS_KEY` в core.js не трогать: при изменении у пользователей сбрасываются города и статусы.
- После правки любого `scorch/scorch.*.js` запускать `python tools/build_scorch.py`, затем `--check`. Пока бандл используется, без этого игра на главной странице получит старый код.
- `scorch/scorch.credits.js` генерируется: после правки `ATTRIBUTION.txt` запустить `embed_attribution.py`.
- После значимых изменений обновлять карту через `repo_map.py`.

## Тесты

Лежат в `tests/`: `syntax.html` (все JS парсятся) и `smoke.html` (логика fmuse.js). Описание в `tests/README.md`.