"""Tests for tools/flip_dates.py: status flips from the dates already on a card."""
import datetime as dt
import json
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import flip_dates  # noqa: E402

TODAY = dt.date(2026, 10, 20)


def card(**over):
    d = {"id": "x", "status": "opens-soon", "opens_iso": None, "deadline_iso": None,
         "deadline_text": "Applications open Oct 15, 2026."}
    d.update(over)
    return d


class PlanFlipTests(unittest.TestCase):
    def test_opening_day_arrived_flips_to_open(self):
        change, held = flip_dates.plan_flip(card(opens_iso="2026-10-20", deadline_iso="2026-11-01"), TODAY)
        self.assertEqual(change, {"status": "open-now", "opens_iso": None})
        self.assertIsNone(held)

    def test_opening_day_in_future_is_left_alone(self):
        self.assertEqual(flip_dates.plan_flip(card(opens_iso="2026-10-21"), TODAY), (None, None))

    def test_deadline_day_itself_is_still_open(self):
        self.assertEqual(flip_dates.plan_flip(card(status="open-now", deadline_iso="2026-10-20"), TODAY), (None, None))

    def test_passed_deadline_flips_to_closed_and_clears_dates(self):
        for status in ("open-now", "opens-soon"):
            change, held = flip_dates.plan_flip(
                card(status=status, opens_iso="2026-10-01", deadline_iso="2026-10-19",
                     deadline_text="Due Oct 19, 2026."), TODAY)
            self.assertEqual(change, {"status": "closed-expect-reopen", "deadline_iso": None, "opens_iso": None})
            self.assertIsNone(held)

    def test_passed_deadline_with_open_text_is_held(self):
        change, held = flip_dates.plan_flip(
            card(status="open-now", deadline_iso="2026-10-19", deadline_text="Applications are open now."), TODAY)
        self.assertIsNone(change)
        self.assertIn("2026-10-19", held)

    def test_past_event_is_held_not_written(self):
        change, held = flip_dates.plan_flip(card(status="event", deadline_iso="2026-10-14"), TODAY)
        self.assertIsNone(change)
        self.assertIn("event day 2026-10-14 has passed", held)

    def test_event_today_or_later_is_left_alone(self):
        for day in ("2026-10-20", "2026-11-07"):
            self.assertEqual(flip_dates.plan_flip(card(status="event", deadline_iso=day), TODAY), (None, None))

    def test_other_statuses_are_never_touched(self):
        for status in ("rolling", "year-round", "closed-expect-reopen"):
            self.assertEqual(flip_dates.plan_flip(card(status=status, deadline_iso="2020-01-01"), TODAY), (None, None))


class SetFieldTests(unittest.TestCase):
    def test_changes_only_the_named_line(self):
        text = json.dumps({"status": "opens-soon", "opens_iso": "2026-10-20", "name": "A"}, indent=2) + "\n"
        out = flip_dates.set_field(flip_dates.set_field(text, "status", "open-now"), "opens_iso", None)
        self.assertEqual(json.loads(out), {"status": "open-now", "opens_iso": None, "name": "A"})
        self.assertTrue(out.endswith("}\n"))

    def test_missing_field_raises(self):
        with self.assertRaises(ValueError):
            flip_dates.set_field('{\n  "name": "A"\n}\n', "status", "open-now")


if __name__ == "__main__":
    unittest.main()
