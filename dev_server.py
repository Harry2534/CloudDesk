from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from pathlib import Path
import os

FRONTEND = Path(__file__).resolve().parent / "frontend"

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND), **kwargs)

    def proxy(self):
        path = self.path.removeprefix("/api")
        body = None

        if self.command in ("POST", "PUT"):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)

        request = Request(
            f"http://127.0.0.1:8000{path}",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": self.headers.get("Authorization", "")
            },
            method=self.command
        )

        try:
            response = urlopen(request, timeout=10)
        except HTTPError as error:
            response = error
        except URLError:
            self.send_error(502, "Demo backend is not running")
            return

        with response:
            self.send_response(response.status)
            self.send_header(
                "Content-Type",
                response.headers.get("Content-Type", "application/json")
            )
            self.end_headers()
            self.wfile.write(response.read())

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.proxy()
        else:
            super().do_GET()

    def do_POST(self):
        self.proxy()

    def do_PUT(self):
        self.proxy()

    def do_DELETE(self):
        self.proxy()

os.chdir(FRONTEND)
print("CloudDesk available at http://127.0.0.1:5501")
ThreadingHTTPServer(("127.0.0.1", 5501), Handler).serve_forever()
