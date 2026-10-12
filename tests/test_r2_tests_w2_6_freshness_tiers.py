"""Unit tests for urgency_tier and build_text in tools/freshness.py. No network."""
import datetime as dt
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import freshness  # noqa: E402

TODAY = dt.date(2026, 10, 10)


def card(**over):
    d = {
        "id": "fake-program",
        "name": "Fake Program",
        "regions": ["davis", "east-bay", "sacramento"],
        "status": "rolling",
        "verified": "fetched",
        "verified_on": "2026-09-01",
        "deadline_iso": None,
        "opens_iso": None,
        "url": "https://example.org/fake-program",
    }
    d.update(over)
    return d


class UrgencyTierTests(unittest.TestCase):
    def test_table(self):
        cases = [
            # (label, card overrides, expected tier)
            ("open-now past deadline is tier 0",
             dict(status="open-now", deadline_iso="2026-10-01"), 0),
            ("opens-soon with opens_iso today is tier 0",
             dict(status="opens-soon", opens_iso="2026-10-10"), 0),
            ("open-now with future opens_iso is tier 0",
             dict(status="open-now", opens_iso="2026-11-01"), 0),
            ("closed 7 days past is not tier 1",
             dict(status="closed", deadline_iso="2026-10-03"), None),
            ("closed 8 days past is tier 1",
             dict(status="closed", deadline_iso="2026-10-02"), 1),
            ("rolling with old deadline_iso is not tier 1 (fetched)",
             dict(status="rolling", deadline_iso="2025-01-01", verified="fetched"), 3),
            ("rolling with old deadline_iso is not tier 1 (snippet-only)",
             dict(status="rolling", deadline_iso="2025-01-01", verified="snippet-only"), 2),
            ("year-round with old deadline_iso is not tier 1 (fetched)",
             dict(status="year-round", deadline_iso="2025-01-01", verified="fetched"), 3),
            ("year-round with old deadline_iso is not tier 1 (snippet-only)",
             dict(status="year-round", deadline_iso="2025-01-01", verified="snippet-only"), 2),
            ("verified snippet-only gives tier 2",
             dict(status="closed", verified="snippet-only"), 2),
            ("verified fetched with nothing odd gives tier 3",
             dict(status="closed", verified="fetched"), 3),
        ]
        for label, over, expected in cases:
            with self.subTest(label):
                d = card(**over)
                tier = freshness.urgency_tier(d, TODAY)
                if expected is None:
                    self.assertNotEqual(tier, 1, label)
                    self.assertIn(tier, (0, 2, 3), label)
                else:
                    self.assertEqual(tier, expected, label)

    def test_closed_seven_days_past_is_not_tier_one_exactly(self):
        d = card(status="closed", deadline_iso="2026-10-03", verified="fetched")
        self.assertEqual(freshness.urgency_tier(d, TODAY), 3)

    def test_missing_or_invalid_iso_does_not_raise(self):
        bad_values = [
            dict(deadline_iso=None, opens_iso=None),
            dict(deadline_iso="", opens_iso=""),
            dict(deadline_iso="not-a-date", opens_iso="also-bad"),
            dict(deadline_iso="2026-13-45", opens_iso="2026-02-30"),
            dict(deadline_iso=20261001, opens_iso=["2026-10-01"]),
        ]
        for over in bad_values:
            with self.subTest(over=over):
                d = card(status="closed", verified="fetched", **over)
                tier = freshness.urgency_tier(d, TODAY)
                self.assertEqual(tier, 3)
        # Keys entirely absent from the card must not raise either.
        d = card(status="closed", verified="fetched")
        del d["deadline_iso"]
        del d["opens_iso"]
        self.assertEqual(freshness.urgency_tier(d, TODAY), 3)

    def test_sorting_puts_tiers_in_order(self):
        cards = [
            card(id="t3", status="closed", verified="fetched"),
            card(id="t2", status="closed", verified="snippet-only"),
            card(id="t1", status="closed", deadline_iso="2026-09-01"),
            card(id="t0", status="open-now", deadline_iso="2026-10-01"),
            card(id="t1b", status="closed", deadline_iso="2026-09-20"),
            card(id="t2b", status="rolling", deadline_iso="2025-01-01", verified="snippet-only"),
            card(id="t0b", status="opens-soon", opens_iso="2026-10-10"),
            card(id="t3b", status="year-round", deadline_iso="2025-01-01", verified="fetched"),
        ]
        ordered = sorted(cards, key=lambda d: freshness.urgency_tier(d, TODAY))
        tiers = [freshness.urgency_tier(d, TODAY) for d in ordered]
        self.assertEqual(tiers, sorted(tiers))
        self.assertEqual(set(tiers), {0, 1, 2, 3})
        self.assertLess(tiers.index(0), tiers.index(1))
        self.assertLess(tiers.index(1), tiers.index(2))
        self.assertLess(tiers.index(2), tiers.index(3))
        self.assertEqual(
            [d["id"] for d in ordered if freshness.urgency_tier(d, TODAY) == 0],
            ["t0", "t0b"],
        )


class BuildTextTests(unittest.TestCase):
    def test_header_rows_and_format(self):
        d = card(id="prog-alpha", name="Alpha Jobs", regions=["davis", "east-bay", "sacramento"],
                 url="https://example.org/alpha")
        reasons = ["last verified 200 days ago", "official page was never read"]
        text = freshness.build_text(TODAY, [(d, reasons)], "1 program needs a look.")
        lines = text.splitlines()

        self.assertIn("2026-10-10", lines[0])
        self.assertTrue(lines[0].startswith("# "))
        self.assertIn("1 program needs a look.", lines)

        rows = [line for line in lines if line.startswith("- [ ] ")]
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertIn("Alpha Jobs", row)
        self.assertIn("`prog-alpha`", row)
        self.assertIn("davis/east-bay", row)
        self.assertNotIn("sacramento", row)
        self.assertIn("last verified 200 days ago; official page was never read", row)
        self.assertIn("https://example.org/alpha", row)

    def test_empty_rows_return_only_header_and_intro(self):
        text = freshness.build_text(TODAY, [], "0 programs need a look.")
        lines = text.splitlines()
        self.assertFalse([line for line in lines if line.startswith("- [ ] ")])
        self.assertTrue(lines[0].startswith("# "))
        self.assertIn("2026-10-10", lines[0])
        self.assertIn("0 programs need a look.", lines)
        self.assertEqual(len([line for line in lines if line.strip()]), 2)


if __name__ == "__main__":
    unittest.main()
