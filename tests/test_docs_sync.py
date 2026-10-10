"""Docs-sync checks: build.py PAGES, src/, built pages, sitemap.xml, README, CONTRIBUTING, docs/*.md and the QR files.

Stdlib only. tools/build.py is read as text on purpose: importing it rebuilds every page.
"""
import glob
import json
import os
import re
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return f.read()


def exists(rel):
    return os.path.exists(os.path.join(ROOT, rel))


def _build_info():
    text = read("tools", "build.py")
    m = re.search(r"^PAGES\s*=\s*\[(.*?)\]", text, re.S | re.M)
    if not m:
        raise AssertionError("tools/build.py: could not find the PAGES list. Fix the regex in tests/test_docs_sync.py or restore 'PAGES = [...]'.")
    pages = re.findall(r'"([^"]+)"', m.group(1))
    line = re.search(r"^_pages\s*=.*$", text, re.M)
    if not line:
        raise AssertionError("tools/build.py: could not find the '_pages = ...' line used for the sitemap.")
    unlisted = re.findall(r'!=\s*"([^"]+)"', line.group(0))
    return pages, unlisted


PAGES, UNLISTED = _build_info()
PUBLIC = [p for p in PAGES if p not in UNLISTED]
PUBLIC_WITH_INDEX = ["index"] + PUBLIC


class PagesExist(unittest.TestCase):
    def test_a_every_page_has_source_and_built_file(self):
        self.assertTrue(PAGES, "tools/build.py PAGES is empty")
        for name in PAGES:
            self.assertTrue(exists("src/%s.html" % name), "tools/build.py lists '%s' in PAGES but src/%s.html is missing. Add the template or remove it from PAGES." % (name, name))
            self.assertTrue(exists("%s.html" % name), "%s.html is missing from the repo root. Run python3 tools/build.py and commit the result." % name)

    def test_d_every_src_page_is_known(self):
        known = set(PAGES) | {"index", "404"}
        for path in sorted(glob.glob(os.path.join(ROOT, "src", "*.html"))):
            fn = os.path.basename(path)
            if fn.startswith("_"):
                continue
            self.assertIn(fn[:-5], known, "src/%s is not index, 404 or in PAGES in tools/build.py. Add it to PAGES (and the README and sitemap) or delete the file." % fn)


class SitemapSync(unittest.TestCase):
    def test_b_sitemap_matches_public_pages(self):
        xml = read("sitemap.xml")
        locs = re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml)
        base = None
        names = set()
        for loc in locs:
            m = re.match(r"^(https://[^/]+/[^/]*/?)(?:([A-Za-z0-9_-]+)\.html)?$", loc)
            self.assertTrue(m, "sitemap.xml has a <loc> this test cannot read: %s. Run python3 tools/build.py." % loc)
            base = base or m.group(1)
            self.assertEqual(m.group(1), base, "sitemap.xml mixes base URLs: %s. Run python3 tools/build.py." % loc)
            names.add(m.group(2) or "index")
        for name in PUBLIC_WITH_INDEX:
            self.assertIn(name, names, "sitemap.xml has no <loc> for '%s'. Run python3 tools/build.py and commit sitemap.xml." % name)
        for name in sorted(names):
            self.assertIn(name, PUBLIC_WITH_INDEX, "sitemap.xml lists '%s' but it is not a public page in tools/build.py (unlisted or missing). Run python3 tools/build.py and commit sitemap.xml." % name)


class ReadmeSync(unittest.TestCase):
    def test_c_readme_names_every_public_page(self):
        readme = read("README.md")
        missing = [name + ".html" for name in PUBLIC if name + ".html" not in readme]
        if missing:
            self.fail("README.md does not mention: %s. Add a row for each to the page table in README.md." % ", ".join(missing))


PATH_PREFIXES = ("tools/", "tests/", "docs/", "data/", "assets/", "src/", ".github/")


def _doc_files():
    files = ["README.md", "CONTRIBUTING.md"]
    files += sorted("docs/" + os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "docs", "*.md")))
    return files


class NamedPaths(unittest.TestCase):
    def test_e_backticked_repo_paths_exist(self):
        for doc in _doc_files():
            for span in re.findall(r"`([^`\n]+)`", read(doc)):
                for word in span.split():
                    if not word.startswith(PATH_PREFIXES):
                        continue
                    if any(c in word for c in "<*{"):
                        continue
                    rel = word.split("#")[0].split("?")[0].rstrip(".,;:)")
                    self.assertTrue(exists(rel), "%s names `%s` but that path does not exist. Fix the path in %s or restore the file." % (doc, rel, doc))


class CountSync(unittest.TestCase):
    def test_f_program_counts_match_meta(self):
        count = json.loads(read("data", "meta.json"))["count"]
        for doc in ("README.md", "CONTRIBUTING.md"):
            for num in re.findall(r"(?<![\d,.])(\d[\d,]*)\s+programs\b", read(doc)):
                self.assertEqual(int(num.replace(",", "")), count, "%s says '%s programs' but data/meta.json count is %d. Update the number in %s." % (doc, num, count, doc))


def _qr_links():
    text = read("tools", "make_qr.py")
    base = re.search(r'^BASE\s*=\s*"([^"]+)"', text, re.M)
    block = re.search(r"^LINKS\s*=\s*\[(.*?)\n\]", text, re.S | re.M)
    if not base or not block:
        raise AssertionError("tools/make_qr.py: could not find BASE or LINKS. Fix the regex in tests/test_docs_sync.py.")
    return base.group(1), re.findall(r'\(\s*"([^"]+)"\s*,\s*"([^"]*)"\s*\)', block.group(1))


class QrSync(unittest.TestCase):
    def test_g_qr_links_match_share_page(self):
        base, links = _qr_links()
        self.assertTrue(links, "tools/make_qr.py LINKS is empty")
        share = read("share.html")
        for name, path in links:
            url = base + path
            svg_rel = "assets/qr/%s.svg" % name
            self.assertTrue(exists(svg_rel), "tools/make_qr.py lists '%s' but %s is missing. Re-run tools/make_qr.py." % (name, svg_rel))
            card = re.search(r'<article[^>]*data-name="%s"[^>]*>(.*?)</article>' % re.escape(name), share, re.S)
            self.assertTrue(card, 'share.html has no card with data-name="%s". Add it to src/share.html and rebuild.' % name)
            copy = re.search(r'data-copy-link="([^"]*)"', card.group(1))
            self.assertTrue(copy, 'share.html card "%s" has no data-copy-link. Fix src/share.html.' % name)
            self.assertEqual(copy.group(1), url, 'share.html card "%s" data-copy-link is %s but tools/make_qr.py says %s. Fix src/share.html or tools/make_qr.py.' % (name, copy.group(1), url))
            title = re.search(r"<title>([^<]*)</title>", read("assets", "qr", name + ".svg"))
            self.assertTrue(title, "%s has no <title>. Re-run tools/make_qr.py." % svg_rel)
            self.assertEqual(title.group(1), url, "%s <title> is %s but the link is %s. Re-run tools/make_qr.py." % (svg_rel, title.group(1), url))
        names = {n for n, _ in links}
        for path in sorted(glob.glob(os.path.join(ROOT, "assets", "qr", "*.svg"))):
            n = os.path.basename(path)[:-4]
            self.assertIn(n, names, "assets/qr/%s.svg has no entry in tools/make_qr.py LINKS. Delete the file or add the link." % n)


if __name__ == "__main__":
    unittest.main()
