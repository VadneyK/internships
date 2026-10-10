"""Tests for tools/hygiene.py. Synthetic cards only."""
import contextlib
import copy
import io
import os
import sys
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import hygiene  # noqa: E402
import proglib  # noqa: E402

GOOD = {
    "id": "example-program", "name": "Example Program", "regions": ["oakland"],
    "min_age": 16, "max_age": 19, "status": "open-now",
    "deadline_text": "Closes Jan 8, 2027", "notes": "",
    "url": "https://example.org/program", "sources_fetched": ["https://example.org/program"],
}


def card(**over):
    d = copy.deepcopy(GOOD)
    d.update(over)
    return d


class SoftChecks(unittest.TestCase):
    def test_clean_card_has_no_reasons(self):
        self.assertEqual(hygiene.soft_checks(card()), [])

    def test_a_no_year_positive(self):
        r = hygiene.soft_checks(card(deadline_text="The page shows weekdays but no year."))
        self.assertEqual(len(r), 1)
        self.assertIn("no year", r[0])
        self.assertTrue(hygiene.soft_checks(card(status="opens-soon", notes="The page does not state a year.")))

    def test_a_no_year_negative(self):
        self.assertEqual(hygiene.soft_checks(card(status="rolling", deadline_text="No year printed, no year")), [])
        self.assertEqual(hygiene.soft_checks(card(deadline_text="Closes Jan 8, 2027")), [])

    def test_b_full_or_waitlist_positive(self):
        self.assertTrue(hygiene.soft_checks(card(status="rolling", deadline_text="Currently full. Join the waitlist.")))
        self.assertTrue(hygiene.soft_checks(card(status="year-round", deadline_text="Not accepting new volunteers")))

    def test_b_full_or_waitlist_negative(self):
        self.assertEqual(hygiene.soft_checks(card(status="closed-expect-reopen", deadline_text="Closed for now")), [])
        self.assertEqual(hygiene.soft_checks(card(status="rolling", deadline_text="Apply any time. Fulfilling work.")), [])

    def test_c_age_positive(self):
        self.assertTrue(hygiene.soft_checks(card(min_age=10)))
        self.assertTrue(hygiene.soft_checks(card(max_age=13)))
        self.assertTrue(hygiene.soft_checks(card(max_age=30)))

    def test_c_age_negative(self):
        self.assertEqual(hygiene.soft_checks(card(min_age=12, max_age=14)), [])
        self.assertEqual(hygiene.soft_checks(card(min_age=None, max_age=25)), [])
        self.assertEqual(hygiene.soft_checks(card(min_age=None, max_age=None)), [])

    def test_d_home_page_positive(self):
        r = hygiene.soft_checks(card(url="https://example.org/", sources_fetched=["https://example.org/", "https://example.org/teens/apply"]))
        self.assertEqual(len(r), 1)
        self.assertIn("https://example.org/teens/apply", r[0])

    def test_d_home_page_negative(self):
        self.assertEqual(hygiene.soft_checks(card(url="https://example.org/", sources_fetched=["https://example.org/"])), [])
        self.assertEqual(hygiene.soft_checks(card(url="https://example.org", sources_fetched=["https://other.org/deep/page"])), [])
        self.assertEqual(hygiene.soft_checks(card(url="https://example.org/teens", sources_fetched=["https://example.org/teens/apply"])), [])


class Main(unittest.TestCase):
    def test_main_exits_zero_and_lists_known_id_sorted(self):
        progs = [
            ("b.json", card(id="zeta-program", name="Zeta", regions=["sacramento"], min_age=9)),
            ("g.json", card(id="georgia-governors-honors-program", name="Georgia Governors Honors Program", regions=["georgia"],
                            deadline_text="The page shows weekdays but no year.")),
            ("c.json", card(id="clean-program", name="Clean")),
            ("a.json", card(id="alpha-program", name="Alpha", regions=["davis"], max_age=40)),
        ]
        out = io.StringIO()
        with mock.patch.object(proglib, "load_programs", return_value=progs), contextlib.redirect_stdout(out):
            code = hygiene.main([])
        text = out.getvalue()
        self.assertEqual(code, 0)
        self.assertIn("georgia-governors-honors-program", text)
        self.assertNotIn("clean-program", text)
        self.assertLess(text.index("alpha-program"), text.index("georgia-governors-honors-program"))
        self.assertLess(text.index("georgia-governors-honors-program"), text.index("zeta-program"))

    def test_main_writes_out_file(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "h.md")
            with mock.patch.object(proglib, "load_programs", return_value=[("x.json", card(min_age=8))]), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(hygiene.main(["--out", path]), 0)
            with open(path, encoding="utf-8") as f:
                self.assertIn("example-program", f.read())

    def test_real_data_runs_clean_and_flags_georgia(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(hygiene.main([]), 0)
        self.assertIn("georgia-governors-honors-program", out.getvalue())


if __name__ == "__main__":
    unittest.main()
