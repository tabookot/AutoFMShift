@echo off
REM ============================================================
REM  AutoFMShift - post-patch release script
REM  Лежит в AutoFMShift\tools\post_patch.bat (tools/ в гите,
REM  файл едёт в репозиторий вместе с проектом)
REM
REM  Использование (из любого места, можно двойным кликом):
REM    post_patch.bat            - авто-версия: X.Y.(Z+1) из core.js
REM    post_patch.bat 1.2.0      - явная версия X.Y.Z
REM    post_patch.bat /test      - то же + поднять сервер и открыть тесты
REM    post_patch.bat 1.2.0 /test
REM
REM  Воркфлоу после патчей:
REM    git am patches\<имя-патча>.patch   (patches\ - локальная папка)
REM    tools\post_patch.bat /test
REM    git add -A  &  git commit -m "Release X.Y.Z"  &  git push
REM
REM  Что делает (по правилам tools/README.md):
REM    1. Пересобирает scorch\scorch.bundle.js из scorch.*.js
REM    2. Проверяет scorch.credits.js (перегенерирует, если устарел)
REM    3. Сдвигает версию: VERSION в core.js, ?v= в index.html /
REM       data\sandbox.html / scorch\index.html, SC_BUILD в scorch\scorch.js
REM    4. Контрольная проверка свежести бандла (--check)
REM    5. Обновляет tools\REPO_MAP.md
REM    6. Показывает git-статус и подсказку по коммиту
REM ============================================================
chcp 65001 >nul
setlocal EnableExtensions
REM поднимаемся из tools\ в корень репозитория
cd /d "%~dp0.."

if not exist "tools\set_version.py" (
    echo [ОШИБКА] Не вижу tools\set_version.py после подъёма на уровень выше.
    echo          Bat должен лежать в AutoFMShift\tools\post_patch.bat,
    echo          а скрипты из tools\ - оставаться в репозитории.
    exit /b 1
)

REM --- поиск Python ---
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY ( where py >nul 2>nul && set "PY=py -3" )
if not defined PY (
    echo [ОШИБКА] Python 3 не найден. Установи с python.org и добавь в PATH.
    exit /b 1
)
REM защита от заглушки python из Microsoft Store ( есть в PATH, но не работает )
%PY% -c "print(1)" >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] "%PY%" найден, но не запускается. Отключи заглушку python в Microsoft Store:
    echo          Параметры - Приложения - Псевдонимы выполнения приложений, либо поставь
    echo          настоящий Python с python.org и добавь в PATH.
    exit /b 1
)

REM --- разбор аргументов ---
set "VER="
set "TEST="
:parse
if "%~1"=="" goto parsed
if /i "%~1"=="/test" ( set "TEST=1" & shift & goto parse )
set "VER=%~1"
shift
goto parse
:parsed

if defined VER (
    echo(%VER%| findstr /r "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul
    if errorlevel 1 (
        echo [ОШИБКА] Версия "%VER%" не в формате X.Y.Z
        exit /b 1
    )
) else (
    REM авто-инкремент patch-части текущей версии из core.js
    for /f "usebackq delims=" %%v in (`%PY% -c "import re;s=open('core.js',encoding='utf-8').read();v=re.search(r'VERSION = .([0-9.]+).',s).group(1).split('.');print(v[0]+'.'+v[1]+'.'+str(int(v[2])+1))"`) do set "VER=%%v"
    if not defined VER (
        echo [ОШИБКА] Не удалось прочитать VERSION из core.js
        exit /b 1
    )
)

echo ============================================================
echo  AutoFMShift post-patch: версия %VER%
echo ============================================================
echo.

echo [1/5] Сборка scorch\scorch.bundle.js из scorch.*.js ...
%PY% tools\build_scorch.py
if errorlevel 1 ( echo [ОШИБКА] Сборка бандла не удалась & exit /b 1 )
echo.

echo [2/5] Проверка scorch.credits.js ...
%PY% tools\embed_attribution.py --check >nul 2>nul
if errorlevel 1 (
    echo         credits устарел - перегенерирую
    %PY% tools\embed_attribution.py
    if errorlevel 1 ( echo [ОШИБКА] embed_attribution не удался & exit /b 1 )
) else (
    echo         ok
)
echo.

echo [3/5] Сдвиг версии: core.js VERSION, ?v= штампы, SC_BUILD ...
%PY% tools\set_version.py %VER%
if errorlevel 1 ( echo [ОШИБКА] set_version не удался & exit /b 1 )
echo.

echo [4/5] Контроль: бандл должен быть свежим ...
%PY% tools\build_scorch.py --check
if errorlevel 1 ( echo [ОШИБКА] Бандл всё ещё stale - что-то перезаписало его после сборки & exit /b 1 )
echo.

echo [5/5] Обновление tools\REPO_MAP.md ...
%PY% tools\repo_map.py --out tools/REPO_MAP.md
if errorlevel 1 ( echo [ОШИБКА] repo_map не удался & exit /b 1 )
echo.

echo ============================================================
echo  Итог - изменённые файлы:
echo ============================================================
where git >nul 2>nul
if not errorlevel 1 (
    git --no-pager diff --stat
    echo.
    git status --short
) else (
    echo (git не найден - открой папку и посмотри изменённые файлы руками^)
)
echo.
echo  Дальше вручную:
echo    git add -A
echo    git commit -m "Release %VER%"
echo    git push
echo.

if defined TEST (
    echo Поднимаю http://localhost:8000 и открываю тесты...
    start "AutoFMShift test server" cmd /k "%PY% -m http.server 8000"
    timeout /t 2 >nul
    start "" http://localhost:8000/tests/syntax.html
    start "" http://localhost:8000/tests/smoke.html
    echo Обе страницы должны быть зелёными. Сервер - в отдельном окне (закрой по готовности^).
)

echo [OK] Готово: версия %VER%, бандл пересобран и свежий.
endlocal
exit /b 0
