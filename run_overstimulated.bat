@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM === Overstimulated launcher ===
REM Double-click this file to run the game locally.

cd /d "%~dp0"

if not exist "index.html" (
  echo [ERROR] index.html not found in: %CD%
  echo Put this launcher in the project folder next to index.html.
  pause
  exit /b 1
)

REM Find Python
set "PY_CMD="
for %%P in (python py python3) do (
  where %%P >nul 2>nul && (
    set "PY_CMD=%%P"
    goto :found_python
  )
)

:found_python
if "%PY_CMD%"=="" (
  echo [ERROR] Python not found on PATH.
  echo Install Python 3 and re-run this file.
  pause
  exit /b 1
)

set "PORT=8000"
for /L %%A in (8000,1,8010) do (
  netstat -ano | findstr /R /C:":%%A .*LISTENING" >nul
  if errorlevel 1 (
    set "PORT=%%A"
    goto :port_found
  )
)

:port_found
set "URL=http://127.0.0.1:%PORT%/"
echo Starting local server on port %PORT%...

start "Overstimulated Server" /min cmd /k "cd /d ""%CD%"" && %PY_CMD% -m http.server %PORT%"

set "READY="
for /L %%I in (1,1,15) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest '%URL%' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "READY=1"
    goto :server_ready
  )
  timeout /t 1 /nobreak >nul
)

if not defined READY (
  echo.
  echo [ERROR] The local server did not start successfully.
  echo A server window may still be open with the error details.
  echo You can also try running this manually:
  echo   %PY_CMD% -m http.server %PORT%
  echo.
  pause
  exit /b 1
)

:server_ready
echo Opening %URL%
start "" "%URL%"

echo.
echo The game is running locally in your browser.
echo Close the "Overstimulated Server" window when you are done playing.
echo.
pause
