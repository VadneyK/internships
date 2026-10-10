"""Deadline confidence and max age must not contradict the card's own text.

An unconfirmed card whose text says the page gives no deadline cannot claim 'rolling'
(you can apply any time). A card that says 'and up' cannot have a max_age.

The only unconfirmed plus rolling card allowed is la-county-youth-at-work, whose text
supports either value. The allowlist fails if that id stops matching, so it cannot go stale.

No network. Run: python3 -m unittest discover -s tests -v
"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))

import proglib  # noqa: E402

ALLOWED_UNCONFIRMED_ROLLING = {"la-county-youth-at-work"}


class DeadlineAndAgeMatchText(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cards = {d["id"]: d for _, d in proglib.load_programs()}

    def test_unconfirmed_cards_with_no_stated_deadline_are_unknown(self):
        for cid in ("capital-area-nextgen-youth-services",
                    "nyc-brooklyn-maimonides-high-school-volunteer"):
            self.assertEqual(self.cards[cid]["deadline_confidence"], "unknown", cid)

    def test_hornet_16_plus_has_no_max_age(self):
        card = self.cards["uss-hornet-volunteer-16-plus"]
        self.assertIsNone(card["max_age"])
        self.assertEqual(card["min_age"], 16)

    def test_unconfirmed_rolling_only_on_allowlist(self):
        found = {cid for cid, d in self.cards.items()
                 if d.get("status") == "unconfirmed" and d.get("deadline_confidence") == "rolling"}
        self.assertEqual(found, ALLOWED_UNCONFIRMED_ROLLING)


if __name__ == "__main__":
    unittest.main()
