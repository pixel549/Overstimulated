@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

if not exist "direct_player_bot.py" (
  echo [ERROR] direct_player_bot.py not found in: %CD%
  pause
  exit /b 1
)

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
  echo Install Python 3 and try again.
  pause
  exit /b 1
)

%PY_CMD% -c "import selenium" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Selenium is not installed for this Python.
  echo Run: %PY_CMD% -m pip install selenium
  pause
  exit /b 1
)

echo Launching the direct player bot...
echo A browser window should open so you can watch it play.
echo.
%PY_CMD% direct_player_bot.py --runs 1

echo.
echo The direct player bot finished.
echo Reports are saved in the playtest_reports folder.
echo.
pause
