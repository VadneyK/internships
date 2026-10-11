"""Guard: open statuses need a dated reason, and a few basic fields must agree.

TODAY is fixed on purpose so the test does not change as days pass. Move it
forward when the data is refreshed.
"""
import json
import os
import re
import unittest
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = date(2026, 10, 9)
NOW_OPEN = re.compile(r"is now open|Registration is Now Open", re.I)

# id -> reason. Remove an entry when the card is fixed.
ALLOW_NOW_OPEN = {
    "cincinnati-uc-early-it-summer-camp": "text says registration is open but status is closed-expect-reopen; ticket 2 fixes it",
}


def load():
    with open(os.path.join(ROOT, "data", "entries.json"), encoding="utf-8") as f:
        return json.load(f)


def problems(entries):
    out = []
    for e in entries:
        i = e.get("id")
        st = e.get("status")
        iso = e.get("deadline_iso")
        if st in ("open-now", "opens-soon") and iso and date.fromisoformat(iso) < TODAY:
            out.append(f"{i}: {st} but deadline_iso {iso} is before {TODAY}")
        lo, hi = e.get("min_age"), e.get("max_age")
        if lo is not None and hi is not None and lo > hi:
            out.append(f"{i}: min_age {lo} is above max_age {hi}")
        if e.get("paid_type") == "paid" and not (e.get("pay_detail") or "").strip():
            out.append(f"{i}: paid_type paid but pay_detail is empty")
        if st == "closed-expect-reopen" and i not in ALLOW_NOW_OPEN:
            for k in ("deadline_text", "notes", "how_to_apply", "what_you_do"):
                if NOW_OPEN.search(e.get(k) or ""):
                    out.append(f"{i}: closed-expect-reopen but {k} says it is now open")
                    break
    return out


class StatusDates(unittest.TestCase):
    def test_entries_agree(self):
        bad = problems(load())
        self.assertEqual(bad, [], "\n" + "\n".join(bad))

    def test_undated_open_count_only(self):
        n = sum(1 for e in load() if e.get("status") in ("open-now", "opens-soon")
                and not e.get("deadline_iso"))
        print(f"open-now/opens-soon cards with no deadline_iso: {n}")

    def test_allowlist_not_stale(self):
        ids = {e["id"] for e in load() if e.get("status") == "closed-expect-reopen"}
        for i in ALLOW_NOW_OPEN:
            self.assertIn(i, ids, f"{i} no longer needs the allowlist")

    def test_guard_fails_on_bad_cards(self):
        bad = [
            {"id": "a", "status": "open-now", "deadline_iso": "2026-10-01"},
            {"id": "b", "min_age": 18, "max_age": 14},
            {"id": "c", "paid_type": "paid", "pay_detail": " "},
            {"id": "d", "status": "closed-expect-reopen", "notes": "Registration is Now Open"},
        ]
        self.assertEqual(len(problems(bad)), 4)


if __name__ == "__main__":
    unittest.main()
