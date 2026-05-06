#!/usr/bin/env python3
"""
Tiny-TID development server (no Node/PHP required)

Serves static files from the project root and reverse-proxies
`/api/v3/*` to `https://www.train-guide.westjr.co.jp/api/v3/*`.

Usage:
  python dev_proxy.py            # serve ./ at http://localhost:8000
  python dev_proxy.py 9000 .     # serve ./ at http://localhost:9000

This is for local development only. For production, use Cloudflare Workers
or a reverse proxy on your host as discussed.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import sys
import os

UPSTREAM = "https://www.train-guide.westjr.co.jp"
UPSTREAM_TIMEOUT = 10


class ProxyHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path.startswith("/api/v3/"):
            self._proxy_to_upstream()
            return
        return super().do_GET()

    def _proxy_to_upstream(self):
        target = f"{UPSTREAM}{self.path}"
        try:
            req = Request(
                target,
                headers={
                    "User-Agent": "TinyTID-DevProxy/1.0",
                    "Accept": self.headers.get("Accept", "*/*"),
                    "Connection": "close",
                },
            )
            with urlopen(req, timeout=UPSTREAM_TIMEOUT) as res:
                body = res.read()
                self.send_response(res.status)
                excluded = {
                    "transfer-encoding",
                    "content-encoding",
                    "content-length",
                    "connection",
                }
                for k, v in res.headers.items():
                    if k.lower() not in excluded:
                        self.send_header(k, v)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Connection", "close")
                if "cache-control" not in {k.lower() for k in res.headers.keys()}:
                    self.send_header("Cache-Control", "public, max-age=60")
                self.end_headers()
                self.wfile.write(body)
                self.wfile.flush()
        except HTTPError as e:
            try:
                body = e.read()
            except Exception:
                body = b""
            self.send_response(e.code, e.reason)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            if body:
                self.wfile.write(body)
                self.wfile.flush()
        except URLError as e:
            msg = f"Upstream unreachable: {e.reason}"
            body = msg.encode("utf-8")
            self.send_response(502, "Bad Gateway")
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
        except Exception as e:
            msg = f"Proxy error: {e}"
            body = msg.encode("utf-8")
            self.send_response(500, "Internal Server Error")
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()

    def log_message(self, format, *args):
        if "/api/v3/" in (args[0] if args else ""):
            print(f"[proxy] {args[0]}")
        else:
            super().log_message(format, *args)


class ReuseableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def run(port, directory):
    if not os.path.isdir(directory):
        raise SystemExit(f"Directory not found: {directory}")

    handler = lambda *args, **kwargs: ProxyHandler(*args, directory=directory, **kwargs)
    with ReuseableThreadingHTTPServer(("", port), handler) as httpd:
        print(f"Serving {os.path.abspath(directory)} at http://localhost:{port}")
        print(f"Proxy active: http://localhost:{port}/api/v3/ -> {UPSTREAM}/api/v3/")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down.")
            httpd.shutdown()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8000
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    run(port, directory)
