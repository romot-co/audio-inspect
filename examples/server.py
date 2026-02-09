#!/usr/bin/env python3
"""
Simple HTTP server for Audio Inspect Examples
Supports CORS headers needed for audio analysis demos
"""

import http.server
import socketserver
import sys
import os

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with CORS support."""

    def do_GET(self):
        if self.path == "/":
            self.path = "/examples/index.html"
        super().do_GET()

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
        """Handle OPTIONS requests for CORS preflight."""
        self.send_response(200)
        self.end_headers()

    def log_message(self, format, *args):
        """Override to provide cleaner log messages."""
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

    # Serve repository root so /examples and /dist are both available.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    os.chdir(repo_root)

    with socketserver.TCPServer(("", port), CORSHTTPRequestHandler) as httpd:
        print("=" * 60)
        print("Audio Inspect Examples Server")
        print("=" * 60)
        print(f"📡 Server running at: http://localhost:{port}")
        print(f"Serving directory: {os.getcwd()}")
        print(f"Demo entry: http://localhost:{port}/examples/index.html")
        print("🔴 Press Ctrl+C to stop the server")
        print("=" * 60)

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nServer stopped by user")


if __name__ == "__main__":
    main()
