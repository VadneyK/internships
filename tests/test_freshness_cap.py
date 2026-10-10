"""Tests for the --max-items cap and --full-out file in tools/freshness.py."""
import contextlib
import datetime as dt
import io
import os
import re
import sys
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import freshness  # noqa: E402
import proglib  # noqa: E402

TODAY = "2027-02-15"
REGIONS = ["davis", "east-bay", "sacramento", "san-francisco"]


def make_program(i, **over):
    d = {
        "id": "fake-%04d" % i,
        "name": "Fake Program %04d" % i,
        "regions": [REGIONS[i % len(REGIONS)]],
        "status": "rolling",
        "verified": "fetched",
        "verified_on": "2026-01-%02d" % (1 + i % 28),
        "deadline_iso": None,
        "opens_iso": None,
        "url": "https://example.org/program-%04d" % i,
    }
    d.update(over)
    return d


def run_main(programs, *argv):
    pairs = [("fake-%d.json" % i, d) for i, d in enumerate(programs)]
    out = io.StringIO()
    with mock.patch.object(proglib, "load_programs", return_value=pairs), \
            mock.patch.object(sys, "argv", ["freshness.py", *argv]), \
            contextlib.redirect_stdout(out):
        code = freshness.main()
    return code, out.getvalue()


def checkbox_lines(text):
    return [line for line in text.splitlines() if line.startswith("- [ ] ")]


def line_id(line):
    return re.search(r"\(`([^`]+)`", line).group(1)


class FreshnessCapTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def path(self, name):
        return os.path.join(self.tmp.name, name)

    def test_cap_full_list_and_order(self):
        programs = [make_program(i) for i in range(400)]
        # Put the one that must come first near the end of the input, with a recent verified_on.
        programs[399] = make_program(399, status="open-now", deadline_iso="2027-02-01", verified_on="2027-02-10")
        programs[398] = make_program(398, verified="snippet-only", verified_on="2027-02-10")
        programs[397] = make_program(397, status="closed-expect-reopen", deadline_iso="2027-01-01", verified_on="2027-02-10")
        out_path, full_path = self.path("refresh.md"), self.path("full.md")
        code, printed = run_main(programs, "--today", TODAY, "--max-items", "50", "--out", out_path, "--full-out", full_path)
        self.assertEqual(code, 0)
        with open(out_path, encoding="utf-8") as f:
            short = f.read()
        with open(full_path, encoding="utf-8") as f:
            full = f.read()
        self.assertEqual(short, printed)
        shown = checkbox_lines(short)
        self.assertEqual(len(shown), 50)
        self.assertEqual(len(checkbox_lines(full)), 400)
        # Order rule: open-but-past-deadline, then deadline over a week gone, then never read, then the rest.
        ids = [line_id(line) for line in checkbox_lines(full)]
        self.assertEqual(ids[:3], ["fake-0399", "fake-0397", "fake-0398"])
        self.assertEqual([line_id(line) for line in shown], ids[:50])
        # The rest are oldest verified_on first.
        by_id = {d["id"]: d for d in programs}
        dates = [by_id[i]["verified_on"] for i in ids[3:]]
        self.assertEqual(dates, sorted(dates))
        self.assertIn("400 programs need a look. Showing the 50 most urgent.", short)
        self.assertIn("The full list is attached to the workflow run.", short)
        self.assertNotIn("Showing", full)
        self.assertIn("400 programs need a person", full)

    def test_summary_is_not_false_when_nothing_is_cut(self):
        programs = [make_program(i) for i in range(5)]
        _, text = run_main(programs, "--today", TODAY, "--max-items", "50")
        self.assertEqual(len(checkbox_lines(text)), 5)
        self.assertNotIn("Showing", text)
        self.assertNotIn("most urgent", text)
        self.assertIn("5 programs need a person to re-read the official page.", text)

    def test_no_attached_claim_without_full_out(self):
        programs = [make_program(i) for i in range(10)]
        _, text = run_main(programs, "--today", TODAY, "--max-items", "3")
        self.assertIn("10 programs need a look. Showing the 3 most urgent.", text)
        self.assertNotIn("attached", text)

    def test_ties_break_by_region_then_name(self):
        programs = [make_program(i, regions=[r], name=n, verified_on="2026-01-01")
                    for i, (r, n) in enumerate([("sacramento", "B"), ("davis", "Z"), ("davis", "A"), ("sacramento", "A")])]
        _, text = run_main(programs, "--today", TODAY)
        names = [re.search(r"\*\*(.+?)\*\*", line).group(1) for line in checkbox_lines(text)]
        self.assertEqual(names, ["A", "Z", "A", "B"])

    def test_default_cap_keeps_the_body_under_the_github_limit(self):
        programs = [make_program(i, name="Fake Program %04d with a longer name to be realistic" % i,
                                 url="https://example.org/a/long/path/for/program-%04d" % i,
                                 status="open-now", deadline_iso="2027-02-01")
                    for i in range(1187)]
        out_path, full_path = self.path("refresh.md"), self.path("full.md")
        run_main(programs, "--today", TODAY, "--out", out_path, "--full-out", full_path)
        with open(full_path, encoding="utf-8") as f:
            self.assertEqual(len(checkbox_lines(f.read())), 1187)
        with open(out_path, "rb") as f:
            data = f.read()
        self.assertLess(len(data), 65536)
        self.assertEqual(len(checkbox_lines(data.decode("utf-8"))), 150)

    def test_needs_refresh_is_unchanged(self):
        d = make_program(1)
        self.assertEqual(freshness.needs_refresh(d, dt.date(2026, 2, 1), 120), [])
        self.assertEqual(len(freshness.needs_refresh(d, dt.date(2027, 2, 15), 120)), 1)


if __name__ == "__main__":
    unittest.main()
