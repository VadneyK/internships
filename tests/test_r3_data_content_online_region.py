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

# id -> one-line reason. Cards that are in person first, or online but only for one state or area, belong here.
ALLOW = {
    "nyc-transportation-alternatives-youth-activist-committee": "Citywide committee that meets in person first, with an online option.",
    "chicago-uchicago-hero-oncology": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "fulton-county-connected-youth-leadership-program": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "georgia-tech-dual-enrollment": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "huntsman-cancer-institute-cancer-research-high-school-program": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "huntsman-cancer-institute-hci-rise-virtual-program": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "legischool-civics-virtual-institute": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "madison-uw-carbone-hero-cancer-research": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "mtc-high-school-internship-program": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "vancouver-bcchr-mini-med-school": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "vancouver-bcchr-pathways-to-science": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "virginia-vsgc-vasts-nasa-langley": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "washington-aerospace-scholars": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "ywca-nextstep-youth-employment": "Online but open only to people from one state or area, so it is not tagged virtual (p9-regions-1, 2026-10-10).",
    "atlanta-youth-mean-business-ymb-fuel": "In person first, with an online option. Listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "nyc-manhattan-university-omalley-business-pre-college": "In person first, with an online option. Listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "nyc-queens-st-johns-summer-high-school-scholars": "In person first, with an online option. Listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "massachusetts-umass-amherst-pre-college": "In person first, with an online option. Listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "sjsu-summer-open-university-high-school": "In person first, with an online option. Listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "fairfax-gmu-health-services-mentorship-program": "Online course. The page does not say who can join, so it is listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "imsa-ai-credential-online": "Online course. The page does not say who can join, so it is listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "imsa-research-fundamentals-online": "Online course. The page does not say who can join, so it is listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "imsa-rise-online-research-program": "Online course. The page does not say who can join, so it is listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "lafayette-purdue-saturday-morning-astrophysics": "Online course. The page does not say who can join, so it is listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "louisville-kentucky-science-center-youth-science-summit": "Online course. The page does not say who can join, so it is listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "madison-uw-badger-precollege-college-ready": "Online course. The page does not say who can join, so it is listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "northwestern-nhsi-debate-institute": "Online course. The page does not say who can join, so it is listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "stanford-medcsi": "Online course. The page does not say who can join, so it is listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
    "san-diego-ucsd-marine-science-research-scholars": "Online course. The page does not say who can join, so it is listed under its host place only, not tagged virtual (p9-regions-1, 2026-10-10).",
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
