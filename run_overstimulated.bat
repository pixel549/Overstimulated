@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM === Overstimulated launcher ===
REM Place this file next to index.html and double-click.

cd /d "%~dp0"

if not exist "index.html" (
  echo [ERROR] index.html not found in: %CD%
  echo Put this .bat in the project folder next to index.html.
  pause
  exit /b 1
)

REM Find Python
set "PY="
for %%P in (python py python3) do (
  where %%P >nul 2>nul && (
    set "PY=%%P"
    goto :found_py
  )
)

:found_py
if "%PY%"=="" (
  echo [ERROR] Python not found on PATH.
  echo Install Python 3, then re-run. (Make sure "Add to PATH" is ticked.)
  pause
  exit /b 1
)

set "PORT=8000"

REM Try ports 8000-8010
for /L %%A in (8000,1,8010) do (
  netstat -ano | findstr /R /C:":%%A .*LISTENING" >nul
  if errorlevel 1 (
    set "PORT=%%A"
    goto :start
  )
)

:start
echo Starting local server on port %PORT%...
start "Overstimulated Server" /min cmd /c "%PY% -m http.server %PORT%"

REM Give server a moment
timeout /t 1 /nobreak >nul

set "URL=http://localhost:%PORT%/"
echo Opening %URL%
start "" "%URL%"

echo.
echo If the browser shows a blank page, refresh once.
echo Close this window to stop nothing (server runs in the other window).
echo Close the "Overstimulated Server" window to stop the server.
echo.
pause
