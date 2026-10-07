"""Tests for the data tools. Run: python3 -m unittest discover -s tests -v"""
import copy
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import proglib  # noqa: E402
import freshness  # noqa: E402
import datetime as dt  # noqa: E402

GOOD = {
    "id": "example-program", "name": "Example Program", "org": "Example Org", "regions": ["oakland"], "city": "Oakland, CA",
    "type": "paid-youth-program", "fields": ["health"], "what_you_do": "Help in a clinic and learn how a team works.",
    "min_age": 16, "max_age": 19, "grades": None, "who_can_apply": "Oakland students.", "paid_type": "paid",
    "pay_detail": "$20 per hour", "season": "summer", "duration": "6 weeks", "status": "open-now",
    "deadline_text": "Closes Jan 8, 2027", "deadline_iso": "2027-01-08", "deadline_confidence": "confirmed-2026-27",
    "how_to_apply": "Online form.", "needs_work_permit": True, "url": "https://example.org/program", "apply_url": None,
    "sources_fetched": ["https://example.org/program"], "verified": "fetched", "verified_on": "2026-10-07", "priority": 1, "notes": "",
}


def problems(data, filename="example-program.json"):
    return proglib.validate_program(os.path.join("x", filename), data)


class ValidateTests(unittest.TestCase):
    def test_good_entry_passes(self):
        self.assertEqual(problems(GOOD), [])

    def test_missing_field_fails(self):
        bad = copy.deepcopy(GOOD); del bad["url"]
        self.assertTrue(problems(bad))

    def test_dash_characters_rejected(self):
        for ch in ("\u2014", "\u2013"):
            bad = copy.deepcopy(GOOD); bad["notes"] = "ages 14" + ch + "17"
            self.assertTrue(any("dash" in p for p in problems(bad)), ch)

    def test_filename_must_match_id(self):
        self.assertTrue(any("file name" in p for p in problems(GOOD, "other.json")))

    def test_bad_date_rejected(self):
        bad = copy.deepcopy(GOOD); bad["deadline_iso"] = "2027-02-30"
        self.assertTrue(problems(bad))

    def test_age_order(self):
        bad = copy.deepcopy(GOOD); bad["min_age"], bad["max_age"] = 18, 14
        self.assertTrue(any("min_age" in p for p in problems(bad)))

    def test_opens_soon_needs_opens_iso(self):
        bad = copy.deepcopy(GOOD); bad["status"] = "opens-soon"
        self.assertTrue(any("opens_iso" in p for p in problems(bad)))

    def test_fee_based_needs_cost(self):
        bad = copy.deepcopy(GOOD); bad["paid_type"] = "fee-based"; bad["pay_detail"] = None
        self.assertTrue(any("fee-based" in p for p in problems(bad)))

    def test_http_url_rejected(self):
        bad = copy.deepcopy(GOOD); bad["url"] = "http://example.org"
        self.assertTrue(problems(bad))

    def test_every_real_program_is_valid(self):
        schema = proglib.load_schema()
        bad = []
        for path, data in proglib.load_programs():
            bad += proglib.validate_program(path, data, schema)
        self.assertEqual(bad, [])


class FreshnessTests(unittest.TestCase):
    def test_old_verification_flagged(self):
        d = copy.deepcopy(GOOD)
        self.assertEqual(freshness.needs_refresh(d, dt.date(2026, 10, 8), 120), [])
        self.assertTrue(freshness.needs_refresh(d, dt.date(2027, 3, 1), 120))

    def test_passed_deadline_flagged_unless_rolling(self):
        d = copy.deepcopy(GOOD)
        self.assertTrue(any("deadline" in r for r in freshness.needs_refresh(d, dt.date(2027, 1, 20), 999)))
        d["status"] = "rolling"
        self.assertFalse(any("deadline" in r for r in freshness.needs_refresh(d, dt.date(2027, 1, 20), 999)))

    def test_snippet_only_flagged(self):
        d = copy.deepcopy(GOOD); d["verified"] = "snippet-only"
        self.assertTrue(any("never read" in r for r in freshness.needs_refresh(d, dt.date(2026, 10, 8), 120)))


if __name__ == "__main__":
    unittest.main()
