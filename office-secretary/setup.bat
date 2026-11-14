@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Installing / updating the office system...
call npm install --no-fund --no-audit
if errorlevel 1 goto fail
call npm run build
if errorlevel 1 goto fail
echo.
echo Done! Now double-click start.bat
pause
exit /b 0
:fail
echo.
echo Something went wrong. Take a screenshot of this window.
pause
