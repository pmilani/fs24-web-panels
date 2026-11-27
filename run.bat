@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 (
    set "PYTHON=py -3"
) else (
    where python >nul 2>nul
    if errorlevel 1 goto no_python
    set "PYTHON=python"
)

if not exist ".venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    %PYTHON% -m venv .venv
    if errorlevel 1 goto failed
)

echo Checking/installing requirements...
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto failed

echo Starting DesktopXR overlay server...
".venv\Scripts\python.exe" app.py %*
exit /b %errorlevel%

:no_python
echo Python 3 was not found. Install 64-bit Python 3.10 or newer, then try again.
echo https://www.python.org/downloads/windows/
goto failed

:failed
echo.
echo The app could not be started. Review the error above.
pause
exit /b 1
