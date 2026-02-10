#!/usr/bin/env python3
"""
Enhanced HTTP server with aggressive cache-busting for Daily Shapes v4.0
Forces browsers to always load fresh content
"""

import http.server
import socketserver
import socket
import webbrowser
import os
import sys
import time
from datetime import datetime

class FreshContentHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Current timestamp for maximum freshness
        timestamp = datetime.now().strftime("%a, %d %b %Y %H:%M:%S GMT")
        
        # Extremely aggressive no-cache headers
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, private, max-age=0, s-maxage=0, proxy-revalidate, no-transform')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Last-Modified', timestamp)
        self.send_header('ETag', f'"{int(time.time() * 1000)}"')
        
        # Vary header to prevent any caching
        self.send_header('Vary', '*')
        
        # CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        
        # Additional headers to prevent caching
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        
        super().end_headers()
    
    def do_GET(self):
        # Add timestamp to HTML files to force reload
        if self.path == '/' or self.path.endswith('.html'):
            if '?' not in self.path:
                self.path = self.path + '?t=' + str(int(time.time() * 1000))
        
        # Log the request
        print(f"[{datetime.now().strftime('%H:%M:%S')}] GET {self.path}")
        
        return super().do_GET()
    
    def log_message(self, format, *args):
        # Custom logging with timestamp
        if len(args) > 1 and '404' not in str(args[1]):
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}")

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

def get_local_ip():
    """Get the local IP address for network access"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"

def main():
    PORTS = [9001, 9000, 8000, 8080, 3000, 5000]
    
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    PORT = None
    httpd = None
    
    # Try to bind to a port
    for port in PORTS:
        try:
            httpd = ThreadedTCPServer(("", port), FreshContentHTTPRequestHandler)
            PORT = port
            break
        except OSError:
            continue
    
    if httpd is None:
        print("❌ All common ports are in use!")
        sys.exit(1)
    
    try:
        with httpd:
            local_ip = get_local_ip()
            
            print("\n" + "="*60)
            print("🎮 DAILY SHAPES v4.0 - FRESH CONTENT SERVER")
            print("="*60)
            print(f"🖥️  Local:    http://localhost:{PORT}")
            print(f"🌐 Network:  http://{local_ip}:{PORT}")
            print(f"🧹 Clear:    http://localhost:{PORT}/clear-cache.html")
            print("="*60)
            print("⚡ FEATURES:")
            print("   • Forces fresh content on every load")
            print("   • Aggressive cache prevention")
            print("   • Timestamp-based cache busting")
            print("   • Service worker clearing page included")
            print("="*60)
            print("📝 TROUBLESHOOTING:")
            print("   1. Visit /clear-cache.html first")
            print("   2. Use Ctrl+Shift+R for hard refresh")
            print("   3. Open DevTools > Network > Disable cache")
            print("   4. Try incognito/private browsing mode")
            print("="*60)
            print(f"\n🚀 Server running on port {PORT}...")
            print("📊 All requests will be logged below:")
            print("-"*60)
            
            # Try to open browser
            try:
                webbrowser.open(f"http://localhost:{PORT}/clear-cache.html")
                print("🌐 Opening cache clearing page in browser...")
            except:
                pass
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n✅ Server stopped successfully!")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()