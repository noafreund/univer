@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".next\BUILD_ID" (
  echo Run setup.bat first.
  pause
  exit /b 1
)
start "" http://localhost:3000
echo The office system is running. Keep this window open (you can minimize it).
call npm start
pause
