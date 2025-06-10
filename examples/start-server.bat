@echo off
REM Audio Inspect Examples Server Launcher for Windows
REM Automatically detects available tools and starts the best HTTP server

echo 🎵 Audio Inspect Examples - Server Launcher
echo ==============================================

REM Check if we're in the examples directory
if not exist "index.html" (
    echo ❌ Error: Please run this script from the examples directory
    echo    Expected to find index.html in current directory
    pause
    exit /b 1
)

set PORT=8080

REM Try Node.js http-server (best option)
where npx >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Found Node.js with npx
    echo 🚀 Starting http-server...
    echo 📡 Server will be available at: http://localhost:%PORT%
    echo 🔴 Press Ctrl+C to stop
    echo ----------------------------------------------
    
    REM Open browser after delay
    timeout /t 3 /nobreak >nul
    start "" "http://localhost:%PORT%"
    
    npx http-server . -p %PORT% -c-1 --cors
    goto :end
)

REM Try Python 3
where python >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Found Python
    echo 🚀 Starting Python HTTP server...
    echo 📡 Server will be available at: http://localhost:%PORT%
    echo 🔴 Press Ctrl+C to stop
    echo ----------------------------------------------
    
    REM Open browser after delay
    start /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:%PORT%"
    
    python server.py %PORT%
    goto :end
)

REM Try PHP
where php >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Found PHP
    echo 🚀 Starting PHP development server...
    echo 📡 Server will be available at: http://localhost:%PORT%
    echo 🔴 Press Ctrl+C to stop
    echo ----------------------------------------------
    
    REM Open browser after delay
    start /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:%PORT%"
    
    php -S localhost:%PORT%
    goto :end
)

REM No suitable server found
echo ❌ No suitable HTTP server found!
echo.
echo Please install one of the following:
echo   • Node.js (recommended): https://nodejs.org/
echo   • Python 3: https://python.org/
echo   • PHP: https://php.net/
echo.
echo Or manually serve this directory with any HTTP server.
echo Make sure to enable CORS headers for Web Audio API to work.
pause
exit /b 1

:end
pause