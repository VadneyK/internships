# One-off generator for the QR codes on share.html (static SVG files in assets/qr/).
# Needs the segno package: python3 -m venv v && v/bin/pip install segno && v/bin/python tools/make_qr.py
# Not part of tools/build.py, so CI does not need segno. Re-run only when a link below changes.
import os, segno
BASE = "https://vadneyk.github.io/internships/"
LINKS = [
    ("home", ""), ("norcal", "find.html?where=oak"), ("socal", "find.html?where=socal"), ("atlanta", "find.html?where=atl"),
    ("new-york", "find.html?where=nyc"), ("chicago", "find.html?where=chi"), ("permit", "permit.html"), ("interview", "interview.html"),
    ("younger", "younger.html"), ("parents", "parents.html"),
]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "qr")
os.makedirs(out, exist_ok=True)
for name, path in LINKS:
    q = segno.make(BASE + path, error="m")
    q.save(os.path.join(out, name + ".svg"), scale=8, border=2, dark="#111111", light="#ffffff", xmldecl=False, svgns=True, title=BASE + path, desc="QR code for " + BASE + path)
    print(name, BASE + path)
