"""Ratchet: data cards link a program page, not a bare home page.

Uses the home-page check in tools/hygiene.py (soft_checks, reason "url is a home page ...").
Two rules:
  1. The ids fixed in the r1-data-content-3, -4 and -5 rounds must not be flagged.
  2. The total number of flagged cards may not go above MAX_FLAGGED_HOME_PAGE_CARDS.
     That ceiling was 30 when this test was written. It can only go down: lower it when cards are fixed.
Run: python3 -m unittest discover -s tests -v
"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import hygiene  # noqa: E402
import proglib  # noqa: E402

# Ceiling on cards flagged as a home page url when a deeper page was read. Measured 2026-10-10 as 30.
MAX_FLAGGED_HOME_PAGE_CARDS = 30

# Ids named in the r1-data-content-3, -4 and -5 tests (those files pin the fixed cards).
# TODO: the ticket asked for 24 fixed ids. The repo only names these 11, so add the rest here
# when the list is known. Skip any id that was deliberately kept as a home page url.
FIXED_IDS = (
    # r1-data-content-3
    "nyc-dycd-work-learn-grow",
    "pittsburgh-warhol-youth-arts-council",
    # r1-data-content-4
    "ann-arbor-trinity-health-teen-volunteer",
    "habitat-greater-sacramento-volunteers",
    "riverside-public-library-volunteer-14-plus",
    "slac-regional-science-bowl-high-school",
    "capital-area-nextgen-youth-services",
    "atlanta-parks-rec-teen-leaders",
    "san-diego-city-pool-guard-recreation-aide",
    "seattle-parks-lifeguard-jobs",
    # r1-data-content-5
    "sf-ucsf-immunoexplore",
)

HOME_PAGE_REASON = "url is a home page"


def home_page_flagged(card):
    """True when hygiene.soft_checks reports the home-page reason for this card."""
    return any(HOME_PAGE_REASON in reason for reason in hygiene.soft_checks(card))


class DeepUrlRatchetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.programs = proglib.load_programs()
        cls.by_id = {data.get("id"): data for _, data in cls.programs}

    def test_fixed_ids_exist(self):
        missing = [card_id for card_id in FIXED_IDS if card_id not in self.by_id]
        self.assertEqual(missing, [], "fixed ids with no program file: %s" % missing)

    def test_fixed_ids_are_not_flagged_as_home_page_urls(self):
        flagged = [card_id for card_id in FIXED_IDS if home_page_flagged(self.by_id[card_id])]
        self.assertEqual(
            flagged, [],
            "these fixed cards are linked to a home page again; link the program page: %s" % flagged,
        )

    def test_flagged_count_does_not_exceed_ceiling(self):
        flagged = [data.get("id") for _, data in self.programs if home_page_flagged(data)]
        self.assertLessEqual(
            len(flagged), MAX_FLAGGED_HOME_PAGE_CARDS,
            "home-page url count rose from %d to %d; link program pages instead"
            % (MAX_FLAGGED_HOME_PAGE_CARDS, len(flagged)),
        )

    def test_self_check_flags_home_page_only(self):
        home = {
            "id": "home-card", "name": "Home", "url": "https://example.org/",
            "sources_fetched": ["https://example.org/teens"], "regions": ["X"],
        }
        deep = dict(home, id="deep-card", url="https://example.org/teens")
        self.assertTrue(home_page_flagged(home))
        self.assertFalse(home_page_flagged(deep))


if __name__ == "__main__":
    unittest.main()
