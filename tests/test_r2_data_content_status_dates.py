"""Status and date checks for data/entries.json, run against a fixed clock date.

A card with a confirmed deadline cannot be unconfirmed, a closed card cannot keep a
past deadline, and an opens-soon card cannot have an opening date on or before today.
The clock date is a constant so the result never depends on the real date.
Run: python3 -m unittest discover -s tests -v"""
import copy
import json
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ENTRIES_PATH = os.path.join(ROOT, "data", "entries.json")

# Fixed clock. Dates are ISO strings (YYYY-MM-DD), so string comparison is date comparison.
TODAY = "2026-10-10"


def status_date_problems(entries, today=TODAY):
    """Return a list of human-readable problems. An empty list means the rules hold."""
    found = []
    for card in entries:
        cid = card.get("id", "?")
        status = card.get("status")
        iso = card.get("deadline_iso")
        if status == "unconfirmed" and card.get("deadline_confidence") == "confirmed-2026-27" and iso:
            found.append(f"{cid}: unconfirmed card has a confirmed-2026-27 deadline ({iso})")
        if status == "closed-expect-reopen" and iso and iso < today:
            found.append(f"{cid}: closed-expect-reopen card has a past deadline ({iso} before {today})")
        if status == "opens-soon" and iso and iso <= today:
            found.append(f"{cid}: opens-soon card has an opening date on or before {today} ({iso})")
    return found


def load_entries():
    with open(ENTRIES_PATH, encoding="utf-8") as fh:
        return json.load(fh)


class StatusDateRuleTests(unittest.TestCase):
    def test_real_entries_pass_the_status_date_rules(self):
        self.assertEqual(status_date_problems(load_entries()), [])

    def test_a_changed_copy_fails_each_rule(self):
        # Start from a clean copy and make one card break each rule in turn.
        base = load_entries()
        clean = [c for c in base if c.get("status") not in ("unconfirmed", "closed-expect-reopen", "opens-soon")]
        self.assertEqual(status_date_problems(clean), [])

        cases = (
            ("unconfirmed", {"status": "unconfirmed", "deadline_confidence": "confirmed-2026-27",
                             "deadline_iso": "2026-12-01"}, "confirmed-2026-27"),
            ("closed", {"status": "closed-expect-reopen", "deadline_iso": "2026-10-02"}, "past deadline"),
            ("opens-soon", {"status": "opens-soon", "deadline_iso": "2026-10-10"}, "opening date"),
        )
        for label, changes, needle in cases:
            with self.subTest(label=label):
                card = copy.deepcopy(clean[0])
                card.update(changes)
                found = status_date_problems(clean + [card])
                self.assertTrue(any(needle in p for p in found), found)

    def test_boundary_dates_follow_the_rules(self):
        base = {"id": "boundary-card"}
        # Closed card: the clock date itself is not past, so it passes. The day before fails.
        closed = dict(base, status="closed-expect-reopen", deadline_iso=TODAY)
        self.assertEqual(status_date_problems([closed]), [])
        closed_past = dict(base, status="closed-expect-reopen", deadline_iso="2026-10-09")
        self.assertEqual(len(status_date_problems([closed_past])), 1)
        # Opens-soon card: the clock date counts as "on or before", so it fails.
        soon = dict(base, status="opens-soon", deadline_iso=TODAY)
        self.assertEqual(len(status_date_problems([soon])), 1)
        soon_later = dict(base, status="opens-soon", deadline_iso="2026-10-11")
        self.assertEqual(status_date_problems([soon_later]), [])
        # Unconfirmed card with the confirmed label fails even on a later date.
        unconf = dict(base, status="unconfirmed", deadline_confidence="confirmed-2026-27",
                      deadline_iso="2027-01-15")
        self.assertEqual(len(status_date_problems([unconf])), 1)


if __name__ == "__main__":
    unittest.main()
