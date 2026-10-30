@echo off
title Cricket App - Launcher
color 0A

echo.
echo  ================================================
echo   🏏  CRICKET APP LAUNCHER
echo  ================================================
echo.

:: Step 1 - Start MongoDB Service
echo  [1/3] Starting MongoDB...
net start MongoDB >nul 2>&1
if %errorlevel%==0 (
    echo  ✅ MongoDB started!
) else (
    echo  ✅ MongoDB already running!
)

timeout /t 2 /nobreak >nul

:: Step 2 - Start Backend
echo.
echo  [2/3] Starting Backend Server (port 5000)...
start "🏏 Cricket Backend" cmd /k "cd /d "%~dp0backend" && node server.js"

timeout /t 3 /nobreak >nul

:: Step 3 - Start Frontend
echo.
echo  [3/3] Starting Expo Web App (port 8081)...
start "🌐 Cricket Frontend" cmd /k "cd /d "%~dp0mobile_frontend" && npm run web"

timeout /t 5 /nobreak >nul

:: Step 4 - Open Browser
echo.
echo  [4/4] Opening website in browser...
start "" "http://localhost:8081"

echo.
echo  ================================================
echo   ✅ ALL SERVICES STARTED!
echo.
echo   🌐 Website  : http://localhost:8081
echo   🔧 Backend  : http://localhost:5000
echo   🍃 MongoDB  : localhost:27017
echo  ================================================
echo.
echo  Close this window anytime. App keeps running.
pause
