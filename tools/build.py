#!/usr/bin/env python3
"""Stamp the shared header/footer onto each page in src/ and write plain static HTML to the repo root.

Each src/<name>.html starts with header lines (`title:`, `desc:`, `scripts:`) then a line `---`, then the body.
Tokens {{count}}, {{checked}} come from data/meta.json (written by tools/merge.py).
"""
import json, os, re, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
BASE = "https://vadneyk.github.io/internships/"
ISSUES = "https://github.com/VadneyK/internships/issues"

meta_path = os.path.join(ROOT, "data", "meta.json")
meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {"count": 0, "checked_label": "Oct 7, 2026"}
def _asset_version():
    """Cache-busting version: a hash of the CSS, JS and data files, so rebuilding without changes gives identical pages."""
    import glob
    import hashlib
    h = hashlib.sha1()
    paths = sorted(glob.glob(os.path.join(ROOT, "assets", "css", "*.css")) + glob.glob(os.path.join(ROOT, "assets", "js", "*.js")) + [os.path.join(ROOT, "data", "entries.json")])
    for pth in paths:
        if os.path.exists(pth):
            h.update(open(pth, "rb").read())
    return h.hexdigest()[:8]


ver = _asset_version()

layout = open(os.path.join(SRC, "_layout.html"), encoding="utf-8").read()
PAGES = ["find", "playbook", "resume", "ready", "permit", "languages", "interview", "calendar", "younger", "paycheck", "insights", "rules", "states", "contribute", "leaders", "about"]

def build(name):
    raw = open(os.path.join(SRC, name + ".html"), encoding="utf-8").read()
    head, body = raw.split("\n---\n", 1)
    fields = dict(re.findall(r"^(\w+):\s*(.*)$", head, flags=re.M))
    scripts = "".join(
        '<script src="assets/js/%s.js?v=%s"></script>\n' % (s.strip(), ver)
        for s in fields.get("scripts", "").split(",") if s.strip()
    )
    # lib.js (filter, date and permit logic) only loads on pages that have a script of their own
    libscript = '<script src="assets/js/lib.js?v=%s"></script>\n' % ver if scripts else ""
    page = name
    out = layout
    rep = {
        "title": fields["title"],
        "desc": fields["desc"],
        "base": BASE,
        "file": "" if name == "index" else name + ".html",
        "ver": ver,
        "page": page,
        "content": body,
        "scripts": scripts,
        "libscript": libscript,
        "count": str(meta.get("count", 0)),
        "checked": meta.get("checked_label", ""),
        "issues": ISSUES,
        "robots": '\n<meta name="robots" content="noindex">' if fields.get("noindex") == "true" else "",
    }
    gaps = json.load(open(os.path.join(ROOT, "data", "gaps.json"), encoding="utf-8"))
    import html as _html
    rep["gaps_list"] = "\n".join(
        '      <li><b>%s.</b> %s <a href="%s/%d">Issue %d</a></li>' % (_html.escape(g["title"]), _html.escape(g["text"]), ISSUES, g["issue"], g["issue"]) for g in gaps)
    nav_page = fields.get("navparent", "").strip() or name
    for p in PAGES:
        rep["cur_" + p] = ' aria-current="page"' if p == nav_page else ""
    # body first so tokens inside the body are replaced too
    for k, v in rep.items():
        out = out.replace("{{" + k + "}}", v)
    for k, v in rep.items():
        out = out.replace("{{" + k + "}}", v)
    left = re.findall(r"\{\{(\w+)\}\}", out)
    if left:
        print("WARNING unreplaced tokens in", name, set(left))
    for ch in ("\u2014", "\u2013"):
        if ch in out:
            print("ERROR dash character U+%04X in %s" % (ord(ch), name))
            sys.exit(1)
    dest = os.path.join(ROOT, name + ".html")
    open(dest, "w", encoding="utf-8").write(out)
    print("wrote", dest)

for fn in sorted(os.listdir(SRC)):
    if fn.startswith("_") or not fn.endswith(".html"):
        continue
    build(fn[:-5])


# robots.txt and sitemap.xml
import datetime as _dt
_pages = ["index"] + [p for p in PAGES if p != "leaders"]  # leaders is unlisted until the owner approves it
_today = meta.get("checked", _dt.date.today().isoformat())
_urls = "".join("  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>\n" % (BASE, "" if p == "index" else p + ".html", _today) for p in _pages)
open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + _urls + "</urlset>\n")
open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8").write("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % BASE)
print("wrote sitemap.xml and robots.txt")
