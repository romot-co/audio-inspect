#!/bin/bash

# Audio Inspect Examples Server Launcher
# Automatically detects available tools and starts the best HTTP server

echo "🎵 Audio Inspect Examples - Server Launcher"
echo "=============================================="

# Check if we're in the examples directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: Please run this script from the examples directory"
    echo "   Expected to find index.html in current directory"
    exit 1
fi

PORT=8080
OPENED=false

# Function to open browser
open_browser() {
    if [ "$OPENED" = false ]; then
        echo "🌐 Opening browser..."
        sleep 2
        if command -v open >/dev/null 2>&1; then
            # macOS
            open "http://localhost:$PORT"
        elif command -v xdg-open >/dev/null 2>&1; then
            # Linux
            xdg-open "http://localhost:$PORT"
        elif command -v start >/dev/null 2>&1; then
            # Windows
            start "http://localhost:$PORT"
        else
            echo "📋 Please manually open: http://localhost:$PORT"
        fi
        OPENED=true
    fi
}

# Try Node.js http-server (best option)
if command -v npx >/dev/null 2>&1; then
    echo "✅ Found Node.js with npx"
    echo "🚀 Starting http-server..."
    echo "📡 Server will be available at: http://localhost:$PORT"
    echo "🔴 Press Ctrl+C to stop"
    echo "----------------------------------------------"
    
    # Start server and open browser in background
    (sleep 3 && open_browser) &
    
    npx http-server . -p $PORT -c-1 --cors -s
    exit 0
fi

# Try Python 3
if command -v python3 >/dev/null 2>&1; then
    echo "✅ Found Python 3"
    echo "🚀 Starting Python HTTP server..."
    echo "📡 Server will be available at: http://localhost:$PORT"
    echo "🔴 Press Ctrl+C to stop"
    echo "----------------------------------------------"
    
    # Start server and open browser in background
    (sleep 3 && open_browser) &
    
    python3 server.py $PORT
    exit 0
fi

# Try Python 2 (fallback)
if command -v python >/dev/null 2>&1; then
    echo "✅ Found Python (version 2)"
    echo "🚀 Starting Python HTTP server..."
    echo "📡 Server will be available at: http://localhost:$PORT"
    echo "🔴 Press Ctrl+C to stop"
    echo "----------------------------------------------"
    
    # Start server and open browser in background
    (sleep 3 && open_browser) &
    
    python -m SimpleHTTPServer $PORT
    exit 0
fi

# Try PHP (if available)
if command -v php >/dev/null 2>&1; then
    echo "✅ Found PHP"
    echo "🚀 Starting PHP development server..."
    echo "📡 Server will be available at: http://localhost:$PORT"
    echo "🔴 Press Ctrl+C to stop"
    echo "----------------------------------------------"
    
    # Start server and open browser in background
    (sleep 3 && open_browser) &
    
    php -S localhost:$PORT
    exit 0
fi

# No suitable server found
echo "❌ No suitable HTTP server found!"
echo ""
echo "Please install one of the following:"
echo "  • Node.js (recommended): https://nodejs.org/"
echo "  • Python 3: https://python.org/"
echo "  • PHP: https://php.net/"
echo ""
echo "Or manually serve this directory with any HTTP server."
echo "Make sure to enable CORS headers for Web Audio API to work."
exit 1