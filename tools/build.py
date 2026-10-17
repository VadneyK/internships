#!/usr/bin/env python3
"""Stamp the shared header/footer onto each page in src/ and write plain static HTML to the repo root.

Each src/<name>.html starts with header lines (`title:`, `desc:`, `scripts:`) then a line `---`, then the body.
Tokens {{count}}, {{checked}} come from data/meta.json (written by tools/build_data.py).

Spanish pages (docs/adr/0008-spanish-pages.md): src/es/<name>.html is built to es/<name>.html with the same layout, its
words swapped from src/es/_layout.json. Links to pages with no Spanish twin get "../" and hreflang="en". A page and its
twin link to each other (hreflang alternates in the head and a language link at the end of the nav).
"""
import json, os, re, sys

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
ES_DIR = os.path.join(SRC, "es")
# Pages that have a Spanish twin in src/es/ (index, playbook and rules on 2026-10-16).
ES_PAGES = sorted(f[:-5] for f in os.listdir(ES_DIR) if f.endswith(".html") and not f.startswith("_")) if os.path.isdir(ES_DIR) else []
ES_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def es_date(iso):
    """2026-10-14 as a Spanish date: 14 de octubre de 2026."""
    y, m, d = (int(x) for x in iso.split("-"))
    return "%d de %s de %d" % (d, ES_MONTHS[m - 1], y)


def es_layout(text):
    """The shared layout with its English words swapped for the Spanish ones in src/es/_layout.json.

    Every English string must be found in the layout, so a layout edit that drops or rewords one stops the build
    instead of leaving English in a Spanish page. tests/es-pages.test.mjs checks the other way: no layout text is left in English."""
    pairs = json.load(open(os.path.join(ES_DIR, "_layout.json"), encoding="utf-8"))["pairs"]
    text = text.replace('<html lang="en">', '<html lang="es">', 1)
    for en, es in pairs:
        if en not in text:
            print("ERROR src/es/_layout.json: %r is not in src/_layout.html any more; update the Spanish layout words" % en)
            sys.exit(1)
        text = text.replace(en, es)
    return text


def page_url(name, lang):
    return ("es/" if lang == "es" else "") + ("" if name == "index" else name + ".html")


def es_links(out):
    """Relative links on a page in es/: a page with a Spanish twin stays in es/, anything else gets "../" (English pages
    also get hreflang="en", so a reader knows the link leaves Spanish). Absolute, hash-only, scheme and "../" links are left alone."""
    twins = set(p + ".html" for p in ES_PAGES)
    def anchor(m):
        tag, href = m.group(0), m.group(2)
        path = href.split("#")[0].split("?")[0]
        if path.endswith(".html") and path not in twins and "hreflang=" not in tag:
            return tag[:-1] + ' hreflang="en">'
        return tag
    out = re.sub(r'<a\s[^>]*?href="((?![a-zA-Z][a-zA-Z0-9+.-]*:|#|/|\.\./)([^"]*))"[^>]*>', anchor, out)
    def rel(m):
        path = m.group(2).split("#")[0].split("?")[0]
        if path in twins:
            return m.group(0)
        return m.group(1) + "../" + m.group(2)
    return re.sub(r'(\s(?:href|src)=")((?![a-zA-Z][a-zA-Z0-9+.-]*:|#|/|\.\./)[^"]*)', rel, out)


PAGES = ["find", "map", "playbook", "resume", "ready", "jobs", "permit", "languages", "interview", "calendar", "younger", "parents", "handout", "paycheck", "safety", "share", "insights", "rules", "states", "contribute", "leaders", "about"]

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


def pre_tiles(labels):
    """The tap tiles assets/js/common.js tilePicker paints for a short list, as static markup. tilePicker adopts this block (data-pre)
    and repaints it with the same tiles, so a picker whose options arrive after load takes its final space from the first paint."""
    import html as _h
    btns = "".join('<button type="button" class="tile" aria-pressed="false" tabindex="-1">%s</button>' % _h.escape(t) for t in labels)
    return '<div class="tp" data-pre aria-hidden="true"><div class="tp-row">%s</div></div>' % btns


def permit_static():
    """Tiles for the three pickers on the permit page, in the order assets/js/permit.js adds their options."""
    d = json.load(open(os.path.join(ROOT, "data", "permits.json"), encoding="utf-8"))
    first = ["ca", "ga", "ny", "il"]
    rest = sorted((k for k in d["states"] if k not in first), key=lambda k: d["states"][k]["name"])
    states = [d["states"][k]["name"] for k in first + rest] + ["Another state", "My state is not listed"]
    ages = [str(a) for a in range(12, 18)] + ["18 or older"]
    return {"pre_pState": pre_tiles(states), "pre_pAge": pre_tiles(ages), "pre_pKind": pre_tiles([k[1] for k in d["kinds"]])}


def calendar_static():
    """Static copies of what assets/js/calendar.js fills in after its data loads, so the page does not jump when it runs.
    The note comes from data/calendar.json. The month buttons are the same buttons the script paints (it replaces them once the data is in)."""
    import html as _h
    cal = json.load(open(os.path.join(ROOT, "data", "calendar.json"), encoding="utf-8"))
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    chips = "".join('<button class="chip" type="button" data-m="%d" aria-pressed="false">%s<span class="n">0</span></button>' % (i + 1, m) for i, m in enumerate(months))
    return {"calendar_note": _h.escape(cal["note"]), "calendar_months": chips, "pre_cAge": pre_tiles(["Any age"] + [str(a) for a in range(12, 19)])}


def jobs_static():
    """The note under the jobs list, from data/employers.json, in the same markup assets/js/jobs.js writes after it loads."""
    import html as _h
    d = json.load(open(os.path.join(ROOT, "data", "employers.json"), encoding="utf-8"))
    return {"jobs_note": "<p>%s Last read %s.</p>" % (_h.escape(d["note"]), _h.escape(d["read"])), "pre_jAge": pre_tiles(["Under 14", "14", "15", "16", "17", "18"])}


def map_static():
    """The age tiles and the zoom buttons assets/js/map.js wires up, shipped in the markup so nothing moves when it runs.
    The zoom ids must match the views in map.js (makeViews)."""
    zoom = [("all", "Whole map"), ("ca", "California"), ("bay", "Bay Area"), ("socal", "Southern California"), ("pnw", "Pacific Northwest"),
            ("tx", "Texas"), ("mw", "Midwest"), ("ne", "Northeast"), ("se", "Southeast")]
    chips = "".join('<button class="chip" type="button" data-v="%s" aria-pressed="%s">%s</button>' % (v, "true" if v == "all" else "false", t) for v, t in zoom)
    return {"pre_mAge": pre_tiles(["Any age"] + [str(a) for a in range(12, 19)]), "map_zoom": chips}


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


def build(name, lang="en"):
    raw = open(os.path.join(ES_DIR if lang == "es" else SRC, name + ".html"), encoding="utf-8").read()
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
    out = es_layout(layout) if lang == "es" else layout
    rep = {
        "title": fields["title"],
        "desc": fields["desc"],
        "base": BASE,
        "file": page_url(name, lang),
        "ver": ver,
        "page": page,
        "content": body,
        "scripts": scripts,
        "libscript": libscript,
        "count": str(meta.get("count", 0)),
        "checked": es_date(meta["checked"]) if lang == "es" and meta.get("checked") else meta.get("checked_label", ""),
        "issues": ISSUES,
        "robots": '\n<meta name="robots" content="noindex">' if fields.get("noindex") == "true" or (lang == "es" and es_draft(fields)) else "",
        "alternates": "",
        "lang_switch": "",
    }
    # A page with a Spanish twin: hreflang alternates both ways, and a language link at the end of the nav (inside Menu on a phone).
    if name in ES_PAGES:
        rep["alternates"] = "".join('\n<link rel="alternate" hreflang="%s" href="%s%s">' % (h, BASE, page_url(name, l)) for h, l in (("en", "en"), ("es", "es"), ("x-default", "en")))
        if lang == "es":
            rep["lang_switch"] = '\n      <a href="../%s.html" hreflang="en" lang="en">English</a>' % name
        else:
            rep["lang_switch"] = '\n      <a href="es/%s.html" hreflang="es" lang="es">Español</a>' % name
    gaps = json.load(open(os.path.join(ROOT, "data", "gaps.json"), encoding="utf-8"))
    import html as _html
    rep["gaps_list"] = "\n".join(
        '      <li><b>%s.</b> %s <a href="%s/%d">Issue %d</a></li>' % (_html.escape(g["title"]), _html.escape(g["text"]), ISSUES, g["issue"], g["issue"]) for g in gaps)
    if name == "calendar":
        rep.update(calendar_static())
    if name == "jobs":
        rep.update(jobs_static())
    if name == "permit":
        rep.update(permit_static())
    if name == "map":
        rep.update(map_static())
    # The "Text this to a parent" link and Copy link button that assets/js/common.js adds to a .share-parent row, shipped in the
    # markup so the row does not grow when the script runs. shareToParent finds them and wires them up.
    if name == "younger":  # only where the row sits in the first screen; elsewhere it is below the fold and the pages are byte-budgeted
      rep["content"] = re.sub(r'(<p class="share-parent[^"]*" data-share="[^"]*">(?:(?!</p>).)*?)(</p>)',
          lambda m: m.group(1) + '<a class="btn sm alt" href="sms:">Text this to a parent</a> <button type="button" class="btn sm alt">Copy link</button>' + m.group(2),
          rep["content"], flags=re.S)
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
    if lang == "es":
        out = es_links(out)
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
    dest = os.path.join(ROOT, "es", name + ".html") if lang == "es" else os.path.join(ROOT, name + ".html")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    open(dest, "w", encoding="utf-8").write(out)
    print("wrote", dest)

def es_draft(fields):
    """A Spanish page is a draft until a fluent speaker has reviewed it (header line `review: pending`). A draft is noindex and stays out of the sitemap."""
    return fields.get("review", "pending").strip() == "pending"


for fn in sorted(os.listdir(SRC)):
    if fn.startswith("_") or not fn.endswith(".html"):
        continue
    build(fn[:-5])
for _p in ES_PAGES:
    if not os.path.exists(os.path.join(SRC, _p + ".html")):
        print("ERROR src/es/%s.html has no English page src/%s.html" % (_p, _p))
        sys.exit(1)
    build(_p, "es")


# robots.txt and sitemap.xml
import datetime as _dt
_pages = ["index"] + [p for p in PAGES if p != "leaders"]  # leaders is unlisted until the owner approves it
_today = meta.get("checked", _dt.date.today().isoformat())
_es_live = [p for p in ES_PAGES if not es_draft(dict(re.findall(r"^(\w+):\s*(.*)$", open(os.path.join(ES_DIR, p + ".html"), encoding="utf-8").read().split("\n---\n", 1)[0], flags=re.M)))]
_urls = "".join("  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>\n" % (BASE, page_url(p, "en"), _today) for p in _pages)
_urls += "".join("  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>\n" % (BASE, page_url(p, "es"), _today) for p in _es_live)
open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + _urls + "</urlset>\n")
open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8").write("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % BASE)
print("wrote sitemap.xml and robots.txt")
