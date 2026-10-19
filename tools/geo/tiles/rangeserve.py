"""Static server with HTTP Range support (like GitHub Pages), for previewing the Map page street map (PMTiles tiles).
Not part of the site or the tests; see tools/geo/README.md.
usage: python3 rangeserve.py <root> <port>"""
import http.server, os, re, sys, functools


class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".pbf": "application/x-protobuf", ".pmtiles": "application/octet-stream"}

    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)$", rng.strip())
        size = os.path.getsize(path)
        if not m:
            self.send_error(416)
            return None
        a, b = m.group(1), m.group(2)
        if a == "":
            start, end = max(0, size - int(b)), size - 1
        else:
            start, end = int(a), min(int(b) if b else size - 1, size - 1)
        if start >= size:
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self._left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, "_left", None)
        if left is None:
            return super().copyfile(source, outputfile)
        while left > 0:
            chunk = source.read(min(65536, left))
            if not chunk:
                break
            outputfile.write(chunk)
            left -= len(chunk)
        self._left = None

    def log_message(self, *a):
        pass


root, port = sys.argv[1], int(sys.argv[2])
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(H, directory=root)).serve_forever()
