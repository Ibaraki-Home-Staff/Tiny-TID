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

from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import sys
import os

UPSTREAM = "https://www.train-guide.westjr.co.jp"


class ProxyHandler(SimpleHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        if self.path.startswith('/api/v3/'):
            self._proxy_to_upstream()
            return
        return super().do_GET()

    def _proxy_to_upstream(self):
        target = f"{UPSTREAM}{self.path}"
        try:
            req = Request(target, headers={
                'User-Agent': 'TinyTID-DevProxy/1.0',
                'Accept': self.headers.get('Accept', '*/*'),
            })
            with urlopen(req) as res:  # nosec - dev only
                body = res.read()
                self.send_response(res.status)
                # Copy headers with some exclusions
                excluded = {"transfer-encoding", "content-encoding", "content-length", "connection"}
                for k, v in res.headers.items():
                    if k.lower() in excluded:
                        continue
                    self.send_header(k, v)
                self.send_header('Content-Length', str(len(body)))
                # Keep caching modest during dev
                if 'cache-control' not in {k.lower() for k in res.headers.keys()}:
                    self.send_header('Cache-Control', 'public, max-age=60')
                self.end_headers()
                self.wfile.write(body)
        except HTTPError as e:
            self.send_error(e.code, e.reason)
        except URLError as e:
            self.send_error(502, f"Bad Gateway: {e.reason}")
        except Exception as e:  # pragma: no cover - best-effort dev server
            self.send_error(500, f"Proxy error: {e}")


def run(port: int, directory: str):
    # Python 3.7+: SimpleHTTPRequestHandler supports directory kwarg
    handler_cls = lambda *args, **kwargs: ProxyHandler(*args, directory=directory, **kwargs)
    with TCPServer(("", port), handler_cls) as httpd:
        print(f"Serving {os.path.abspath(directory)} at http://localhost:{port}")
        print(f"Proxy active: http://localhost:{port}/api/v3 -> {UPSTREAM}/api/v3/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down…")


if __name__ == '__main__':
    # Args: [port] [directory]
    port = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8000
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'
    run(port, directory)

