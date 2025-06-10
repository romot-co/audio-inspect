#!/usr/bin/env python3
"""
Simple HTTP server for Audio Inspect Examples
Supports CORS headers needed for audio analysis demos
"""

import http.server
import socketserver
import sys
import os
from urllib.parse import unquote

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with CORS support"""
    
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.end_headers()
    
    def log_message(self, format, *args):
        """Override to provide cleaner log messages"""
        print(f"[{self.address_string()}] {format % args}")

def main():
    port = 8080
    
    # Check if port is specified as command line argument
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port number: {sys.argv[1]}")
            sys.exit(1)
    
    # Change to the script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", port), CORSHTTPRequestHandler) as httpd:
        print("=" * 60)
        print("🎵 Audio Inspect Examples Server")
        print("=" * 60)
        print(f"📡 Server running at: http://localhost:{port}")
        print(f"📁 Serving directory: {os.getcwd()}")
        print("🔴 Press Ctrl+C to stop the server")
        print("=" * 60)
        print("📋 Available demos:")
        print("  • Time Domain Features")
        print("  • Frequency Domain Features") 
        print("  • Spectral Features")
        print("  • Loudness Measurement (LUFS)")
        print("  • VAD (Voice Activity Detection)")
        print("  • Stereo Analysis")
        print("=" * 60)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n🛑 Server stopped by user")
            print("Thanks for using Audio Inspect Examples!")

if __name__ == "__main__":
    main()