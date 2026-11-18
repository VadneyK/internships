"""The "What is in this guide" table on the home page is counted from data/entries-stats.json at build time.
These tests recount it from the data, so a typed number or a stale build fails."""
import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(*parts):
    return open(os.path.join(ROOT, *parts), encoding="utf-8").read()


class HomeGuideTable(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = json.loads(read("data", "entries-stats.json"))
        cls.meta = json.loads(read("data", "meta.json"))
        html = read("index.html")
        m = re.search(r'<section id="inside">(.*?)</section>', html, flags=re.S)
        assert m, "the home page has no #inside section"
        cls.section = m.group(1)
        cls.table = {}
        for tr in re.findall(r"<tr><th scope=\"row\">(.*?)</tr>", cls.section, flags=re.S):
            label, rest = tr.split("</th>", 1)
            cls.table[label] = re.findall(r"<td>(.*?)</td>", rest)

    def test_types_in_lib_js_have_the_same_labels(self):
        src = read("tools", "build.py")
        labels = dict(re.findall(r'"([a-z-]+)": "([^"]+)"', src.split("TYPE_LABELS = {", 1)[1].split("}", 1)[0]))
        lib = read("assets", "js", "lib.js")
        js = dict(re.findall(r'"([a-z-]+)": "([^"]+)"', lib.split("var TYPES = {", 1)[1].split("}", 1)[0]))
        self.assertEqual(labels, js)
        self.assertEqual(set(labels), {e["type"] for e in self.rows})

    def test_every_row_matches_a_recount(self):
        src = read("tools", "build.py")
        labels = dict(re.findall(r'"([a-z-]+)": "([^"]+)"', src.split("TYPE_LABELS = {", 1)[1].split("}", 1)[0]))
        groups = {"All programs": self.rows}
        for e in self.rows:
            groups.setdefault(labels[e["type"]], []).append(e)
        self.assertEqual(set(self.table), set(groups))
        for label, items in groups.items():
            paid = sum(1 for e in items if e.get("paid_type") in ("paid", "stipend"))
            unpaid = sum(1 for e in items if e.get("paid_type") in ("unpaid", "unpaid-credit"))
            lo = [e["min_age"] for e in items if isinstance(e.get("min_age"), int)]
            hi = [e["max_age"] for e in items if isinstance(e.get("max_age"), int)]
            ages = "%d to %d" % (min(lo), max(hi)) if lo and hi else "Not stated"
            pay = "%d paid,<br>%d unpaid,<br>%d other" % (paid, unpaid, len(items) - paid - unpaid)
            self.assertEqual(self.table[label], [str(len(items)), pay, ages], label)

    def test_the_sentence_states_the_count_the_method_and_the_date(self):
        read_count = sum(1 for e in self.rows if e.get("verified") == "fetched")
        want = "As of %s, this guide lists %d programs for teens, and %d of them were read on the program&#39;s own official page." % (
            self.meta["checked_label"], len(self.rows), read_count)
        self.assertIn(want, self.section)
        self.assertEqual(len(self.rows), self.meta["count"])

    def test_nothing_in_the_section_is_hidden(self):
        self.assertNotRegex(self.section, r"\bhidden\b|display:\s*none|aria-hidden|visually-hidden|sr-only")


if __name__ == "__main__":
    unittest.main()
