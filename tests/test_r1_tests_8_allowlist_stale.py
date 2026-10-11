"""Every allow-list entry must still point at a real card that still breaks its rule.

test_data_text_agreement.py lets known problem cards skip a check through allow-lists.
Nothing else checks those lists, so an excuse can outlive its fix. This file re-runs
the same predicate on each excused card. If the card no longer fails the rule, the
entry is stale and the test names it so the entry can be removed.

Only the Python allow-lists are covered. The JS allow-lists are out of scope.
Run: python3 -m unittest discover -s tests -v
"""
import os
import sys
import unittest
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import test_data_text_agreement as agreement  # noqa: E402

STALE_NOTE = "remove this allow-list entry, the card is fixed"

# name -> (allow-list dict, predicate taking one card and returning a problem or None,
#          source of cards: "programs" for data/programs/*.json, "entries" for data/entries.json)
ALLOW_LISTS = {
    "ALLOW_DATE": (agreement.ALLOW_DATE,
                   lambda c: agreement.date_problem(c, date.today()), "programs"),
    "ALLOW_AGES": (agreement.ALLOW_AGES, agreement.age_problem, "programs"),
    "ALLOW_OPEN": (agreement.ALLOW_OPEN, agreement.open_problem, "programs"),
    "ALLOW_OPEN_LABEL": (agreement.ALLOW_OPEN_LABEL, agreement.open_label_problem, "entries"),
    "ALLOW_SOON": (agreement.ALLOW_SOON,
                   lambda c: agreement.soon_problem(c, date.today()), "entries"),
    "ALLOW_PAY": (agreement.ALLOW_PAY, agreement.pay_problem, "entries"),
}


def find_stale(allow, cards_by_id, predicate):
    """Return ids in allow whose card is missing or no longer fails the predicate."""
    stale = []
    for cid in allow:
        card = cards_by_id.get(cid)
        if card is None or predicate(card) is None:
            stale.append(cid)
    return stale


def find_missing(allow, cards_by_id):
    return [cid for cid in allow if cid not in cards_by_id]


def find_blank_reasons(allow):
    return [cid for cid, reason in allow.items()
            if not isinstance(reason, str) or not reason.strip()]


_CACHE = {}


def _cards_by_id(source):
    if source not in _CACHE:
        rows = agreement.load_cards() if source == "programs" else agreement.load_entries()
        _CACHE[source] = {c["id"]: c for c in rows if "id" in c}
    return _CACHE[source]


class AllowListStaleFixtureTests(unittest.TestCase):
    """Prove the staleness check catches a fixed card and a missing id."""

    def test_fixed_card_is_reported_stale(self):
        cards = {"fixed": {"min_age": 14, "max_age": 18,
                           "who_can_apply": "Open to teens ages 14 to 18."}}
        self.assertEqual(find_stale({"fixed": "reason"}, cards, agreement.age_problem), ["fixed"])

    def test_still_broken_card_is_not_stale(self):
        cards = {"broken": {"min_age": 14, "max_age": 24,
                            "who_can_apply": "Open to teens ages 14 to 18."}}
        self.assertEqual(find_stale({"broken": "reason"}, cards, agreement.age_problem), [])

    def test_missing_card_is_reported_stale_and_missing(self):
        self.assertEqual(find_stale({"gone": "reason"}, {}, agreement.age_problem), ["gone"])
        self.assertEqual(find_missing({"gone": "reason"}, {}), ["gone"])

    def test_blank_or_non_string_reason_is_flagged(self):
        self.assertEqual(find_blank_reasons({"a": "", "b": "   ", "c": None, "d": "ok"}),
                         ["a", "b", "c"])


class AllowListNotStaleTests(unittest.TestCase):
    def test_every_allow_list_id_is_a_real_card(self):
        missing = []
        for name, (allow, _pred, source) in ALLOW_LISTS.items():
            cards = _cards_by_id(source)
            for cid in find_missing(allow, cards):
                missing.append("%s: %s (no card under %s)" % (name, cid,
                                                              "data/programs" if source == "programs"
                                                              else "data/entries.json"))
        self.assertEqual(missing, [], "\n" + "\n".join(missing))

    def test_every_allow_list_entry_has_a_reason(self):
        bad = []
        for name, (allow, _pred, _source) in ALLOW_LISTS.items():
            for cid in find_blank_reasons(allow):
                bad.append("%s: %s has an empty or missing reason" % (name, cid))
        self.assertEqual(bad, [], "\n" + "\n".join(bad))

    def test_every_allow_list_entry_still_fails_its_rule(self):
        stale = []
        for name, (allow, pred, source) in ALLOW_LISTS.items():
            cards = _cards_by_id(source)
            for cid in find_stale(allow, cards, pred):
                # A missing id is reported by test_every_allow_list_id_is_a_real_card.
                if cid in cards:
                    stale.append("%s: %s, %s" % (name, cid, STALE_NOTE))
        self.assertEqual(stale, [], "\n" + "\n".join(stale))


if __name__ == "__main__":
    unittest.main()
