@echo off
TITLE Master Assist POS Server
echo Starting Master Assist Local Server...

cd server

:: Check if port 4000 is in use
netstat -ano | findstr :4000 >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 4000 is already in use. Attempting to kill the existing process...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000') do taskkill /f /pid %%a >nul 2>&1
)

:: Start the server in the background
start /B node server.js > server_log.txt 2>&1

:: Wait a few seconds for the server to start
timeout /t 3 /nobreak >nul

:: Check the log file for critical errors
findstr /C:"CRITICAL ERROR" server_log.txt >nul
if %errorlevel% equ 0 (
    echo.
    echo ======================================================
    echo X SERVER FAILED TO START!
    echo ======================================================
    type server_log.txt
    echo ======================================================
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

:: Open the frontend
echo Opening POS application...
start http://localhost:4000/index.html

echo.
echo Master Assist is running. Keep this terminal open.
echo Press Ctrl+C to stop the server and exit.
echo.

:: Keep the script running to keep the Node server process context
pause
