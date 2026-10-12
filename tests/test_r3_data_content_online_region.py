"""A card whose city says online, virtual or Zoom must list the 'virtual' region.

Tickets 1 and 2 fixed the cards that already had the gap. This test keeps it
from coming back when new cards are added: over every card in
data/entries.json, a city that matches /online|virtual|zoom/i must come with
'virtual' in regions. A card that is in-person first can sit in ALLOW with a
one-line reason. An ALLOW entry must still be needed, so a stale one fails.

Run: python3 -m unittest tests.test_r3_data_content_online_region -v
"""
import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRIES = os.path.join(ROOT, "data", "entries.json")

ONLINE_CITY = re.compile(r"online|virtual|zoom", re.I)
VIRTUAL = "virtual"

# id -> one-line reason. Only cards that are in person first belong here.
ALLOW = {
    "nyc-transportation-alternatives-youth-activist-committee": "Citywide committee that meets in person first, with an online option.",
}


def missing_virtual(cards, allow=None):
    """Return (id, city, regions) for each card whose city says online but whose regions lack 'virtual'."""
    allow = ALLOW if allow is None else allow
    out = []
    for card in cards:
        city = card.get("city") or ""
        if not ONLINE_CITY.search(city):
            continue
        if VIRTUAL in (card.get("regions") or []):
            continue
        if card.get("id") in allow:
            continue
        out.append((card.get("id"), city, card.get("regions")))
    return out


def load_cards():
    with open(ENTRIES, encoding="utf-8") as fh:
        return json.load(fh)


class OnlineCityListsVirtualRegion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cards = load_cards()

    def test_every_online_city_lists_virtual(self):
        bad = missing_virtual(self.cards)
        self.assertEqual(
            bad, [],
            "cards whose city says online, virtual or Zoom but whose regions lack 'virtual' "
            "(add 'virtual' to regions, or add the id to ALLOW with a reason): "
            + "; ".join(f"{cid} ({city!r}, regions {regions!r})" for cid, city, regions in bad),
        )

    def test_allow_entries_have_a_reason_and_are_still_needed(self):
        ids = {card.get("id") for card in self.cards}
        for cid, reason in ALLOW.items():
            with self.subTest(id=cid):
                self.assertIn(cid, ids, "ALLOW names an id that is not in data/entries.json")
                self.assertTrue(reason and reason.strip(), "ALLOW entry needs a reason")
                self.assertNotIn("\n", reason, "ALLOW reason must be one line")
                still_bad = [c for c in self.cards if c.get("id") == cid
                             and missing_virtual([c], allow={})]
                self.assertTrue(still_bad, "ALLOW entry is no longer needed; remove it")


class NegativeControls(unittest.TestCase):
    def test_online_city_without_virtual_is_reported(self):
        fake = {"id": "fake-online-card", "city": "Online (X)", "regions": ["x"]}
        bad = missing_virtual([fake], allow={})
        self.assertEqual(bad, [("fake-online-card", "Online (X)", ["x"])])

    def test_online_city_with_virtual_is_not_reported(self):
        fake = {"id": "fake-virtual-card", "city": "Online (X)", "regions": ["virtual"]}
        self.assertEqual(missing_virtual([fake], allow={}), [])

    def test_zoom_city_without_virtual_is_reported(self):
        fake = {"id": "fake-zoom-card", "city": "Live on Zoom", "regions": ["x"]}
        self.assertEqual(len(missing_virtual([fake], allow={})), 1)

    def test_allow_list_suppresses_a_reported_card(self):
        fake = {"id": "fake-allowed-card", "city": "Online (X)", "regions": ["x"]}
        self.assertEqual(missing_virtual([fake], allow={"fake-allowed-card": "in person first"}), [])

    def test_city_without_online_words_is_not_checked(self):
        fake = {"id": "fake-in-person", "city": "Oakland, CA", "regions": ["oakland"]}
        self.assertEqual(missing_virtual([fake], allow={}), [])


if __name__ == "__main__":
    unittest.main()
