#!/usr/bin/env python3
"""
Enhanced HTTP server for Daily Shapes v4.0 with Edge browser compatibility
Starts a local server with no-cache headers and CORS support
"""

import http.server
import socketserver
import socket
import webbrowser
import os
import sys

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add aggressive no-cache headers for Edge compatibility
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Last-Modified', 'Thu, 01 Jan 1970 00:00:00 GMT')
        # Add CORS headers for Edge compatibility
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Suppress 404 errors for cleaner output (favicon, etc.)
        if len(args) > 1 and '404' in str(args[1]):
            return
        super().log_message(format, *args)

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    timeout = 1

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
    
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    PORT = None
    httpd = None
    
    for port in PORTS:
        try:
            httpd = ThreadedTCPServer(("", port), NoCacheHTTPRequestHandler)
            PORT = port
            break
        except OSError:
            continue
    
    if httpd is None:
        print("❌ All common ports are in use!")
        print("💡 Please stop other servers or try manually:")
        print("   python3 -m http.server 8888")
        sys.exit(1)
    
    try:
        with httpd:
            local_ip = get_local_ip()
            
            print("🎮 Daily Shapes v4.0 Server (Enhanced)")
            print("=" * 45)
            print(f"🖥️  Local access:   http://localhost:{PORT}")
            print(f"🌐 Network access: http://{local_ip}:{PORT}")
            print("=" * 45)
            print("✨ Enhanced Features:")
            print("   • No-cache headers (Edge compatible)")
            print("   • CORS enabled for cross-origin requests")
            print("   • Thread-safe request handling")
            print("   • Aggressive cache prevention")
            print("=" * 45)
            print("📝 Instructions:")
            print("   • Copy URL to Edge browser")
            print("   • Use Ctrl+F5 for hard refresh if needed")
            print("   • Press Ctrl+C to stop the server")
            print("=" * 45)
            
            try:
                webbrowser.open(f"http://localhost:{PORT}")
                print("🌐 Attempting to open browser automatically...")
            except:
                print("💡 Manually open your browser to the local access URL")
            
            print(f"\n🚀 Server running on port {PORT}...")
            print("📊 Serving files with no-cache headers...")
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped. Thanks for testing Daily Shapes v4.0!")
        sys.exit(0)
    except OSError as e:
        if e.errno == 98:
            print(f"❌ Port {PORT} is already in use!")
            print("💡 Try a different port or stop the existing server")
        else:
            print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()