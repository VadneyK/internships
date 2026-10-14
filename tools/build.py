#!/usr/bin/env python3
"""Stamp the shared header/footer onto each page in src/ and write plain static HTML to the repo root.

Each src/<name>.html starts with header lines (`title:`, `desc:`, `scripts:`) then a line `---`, then the body.
Tokens {{count}}, {{checked}} come from data/meta.json (written by tools/build_data.py).
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
    paths = sorted(glob.glob(os.path.join(ROOT, "assets", "css", "*.css")) + glob.glob(os.path.join(ROOT, "assets", "js", "*.js")) + glob.glob(os.path.join(ROOT, "data", "*.json")) + glob.glob(os.path.join(ROOT, "data", "programs", "*.json")))
    for pth in paths:
        if os.path.exists(pth):
            h.update(open(pth, "rb").read())
    return h.hexdigest()[:8]


ver = _asset_version()

layout = open(os.path.join(SRC, "_layout.html"), encoding="utf-8").read()
PAGES = ["find", "playbook", "resume", "ready", "jobs", "permit", "languages", "interview", "calendar", "younger", "parents", "handout", "paycheck", "safety", "share", "insights", "rules", "states", "contribute", "leaders", "about"]

def safety_static(body):
    """Fill {{safety:<section id>}} in src/safety.html from data/safety.json.

    The no-JavaScript view gets the same summary paragraph and point cards that assets/js/safety.js draws,
    so each claim sits next to its source link and a data update changes the static page too.
    """
    import html as _h
    data = json.load(open(os.path.join(ROOT, "data", "safety.json"), encoding="utf-8"))
    sections = {s["id"]: s for s in data["sections"]}

    # A phone number may appear in the static view only if it is a federal line or is on a state card in
    # data/permits.json. A card whose quote holds any other number keeps its text and source link but not the quote.
    # The live view (assets/js/safety.js) still shows the quote and the numbers from data/safety.json.
    permits_digits = re.sub(r"\D", "", open(os.path.join(ROOT, "data", "permits.json"), encoding="utf-8").read())
    federal = {"8003216742", "8664879243", "8006694000"}
    phone = re.compile(r"(?<![\d.-])(?:\+?1[-. ]?)?\(?(\d{3})\)?[-. ]?(\d{3})[-.](\d{4})(?!\d)")

    def static_ok(p):
        for m in phone.finditer(p["text"] + " " + p["quote"]):
            d = "".join(m.groups())
            if d not in federal and d not in permits_digits:
                return False
        return True

    def card(p):
        quote = ('<p class="small"><q>%s</q></p>' % _h.escape(p["quote"], quote=False)) if static_ok(p) else ""
        return ('<article class="card"><p>%s</p>%s<p class="small muted">Source: '
                '<a href="%s" target="_blank" rel="noopener">%s</a></p></article>') % (
            _h.escape(p["text"], quote=False), quote,
            _h.escape(p["url"]), _h.escape(p["source"], quote=False))

    def fill(m):
        s = sections[m.group(1)]
        cards = '<div class="grid g2" style="align-items:start;">' + "".join(card(p) for p in s["points"]) + "</div>"
        return "<p>%s</p>%s" % (_h.escape(s["plain"], quote=False), cards)

    return re.sub(r"\{\{safety:(\w+)\}\}", fill, body)


def younger_options(body):
    """Fill {{state_options}} in src/younger.html: All four states, the four full states from data/younger.json,
    then every other state in data/states-lite.json by name. Built here so the picker cannot drift from the data."""
    import html as _h
    yj = json.load(open(os.path.join(ROOT, "data", "younger.json"), encoding="utf-8"))
    lite = json.load(open(os.path.join(ROOT, "data", "states-lite.json"), encoding="utf-8"))
    four = [s[0] for s in yj["states"]]
    opts = ['<option value="">All four states</option>']
    opts += ['<option value="%s">%s</option>' % (_h.escape(s[0]), _h.escape(s[1])) for s in yj["states"]]
    opts += ['<option value="%s">%s</option>' % (_h.escape(s["id"]), _h.escape(s["name"]))
             for s in sorted(lite["states"], key=lambda s: s["name"]) if s["id"] not in four]
    return body.replace("{{state_options}}", "".join(opts))


def fill_csp_hashes(page):
    """Fill {{script_hashes}} in the Content-Security-Policy meta tag with a sha256 source for every inline script.

    The hash is taken from the built page itself, so editing the theme script in src/_layout.html (or adding an inline
    script to a page) changes the policy with it and the page cannot silently stop running its script."""
    import base64
    import hashlib
    if "{{script_hashes}}" not in page:
        print("ERROR {{script_hashes}} is missing from the page; the CSP meta tag needs it")
        sys.exit(1)
    hashes = []
    for m in re.finditer(r"<script(?![^>]*\ssrc=)[^>]*>(.*?)</script>", page, flags=re.S):
        digest = base64.b64encode(hashlib.sha256(m.group(1).encode("utf-8")).digest()).decode("ascii")
        src = " 'sha256-%s'" % digest
        if src not in hashes:
            hashes.append(src)
    if not hashes:
        print("ERROR no inline script hash found; the theme script must be inline on every page")
        sys.exit(1)
    return page.replace("{{script_hashes}}", "".join(hashes))


def build(name):
    raw = open(os.path.join(SRC, name + ".html"), encoding="utf-8").read()
    head, body = raw.split("\n---\n", 1)
    if name == "safety":
        body = safety_static(body)
    if name == "younger":
        body = younger_options(body)
    fields = dict(re.findall(r"^(\w+):\s*(.*)$", head, flags=re.M))
    scripts = "".join(
        '<script src="assets/js/%s.js?v=%s"></script>\n' % (s.strip(), ver)
        for s in fields.get("scripts", "").split(",") if s.strip()
    )
    # lib.js (filter, date and permit logic) only loads on pages that have a script of their own.
    # A page whose script never reads lib.js says `lib: none` in its header, so teens on slow data skip the download.
    libscript = '<script src="assets/js/lib.js?v=%s"></script>\n' % ver if scripts and fields.get("lib", "").strip() != "none" else ""
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
    out = fill_csp_hashes(out)
    left = re.findall(r"\{\{(\w+)\}\}", out)
    if left:
        print("WARNING unreplaced tokens in", name, set(left))
    if name == "404":
        # GitHub Pages serves 404.html for any bad path at any depth, so relative links would resolve against the deep URL.
        # Root-anchor every relative href and src on this one page. Other pages stay relative so local previews work.
        # Limit: the "/internships/" prefix is hard-coded here, so 404.html only works where the site is served from
        # /internships/ (the GitHub Pages project URL). A fork or custom domain must change this prefix (and BASE above).
        # A <base href> from location.pathname was not used: a 404 page at a deep URL cannot tell where the site root is.
        out = re.sub(r'(\s(?:href|src)=")(?![a-zA-Z][a-zA-Z0-9+.-]*:|#|/)([^"]*")', lambda m: m.group(1) + "/internships/" + m.group(2), out)
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
