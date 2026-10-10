"""A card's city state code must agree with its regions.

A card can say 'Cambridge, MA' or 'Newark, NJ' in city while its regions point somewhere
else or nowhere. This test checks every card in data/programs. The allowlist is empty on
purpose: fix the card, do not excuse it.

lib.js STATE_OF is not reused because it leaves out NJ, PA, MA, MD, VA, NC and MI regions,
so this file carries its own region to state map.

No network. Run: python3 -m unittest discover -s tests -v
"""
import os
import re
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))

import proglib  # noqa: E402

_GROUPS = {
    "CA": "statewide davis sacramento yolo silicon-valley san-jose peninsula fremont oakland "
          "berkeley alameda east-bay san-francisco santa-barbara merced orange-county "
          "los-angeles inland-empire san-diego",
    "WA": "seattle washington",
    "BC": "vancouver british-columbia",
    "TX": "austin texas",
    "MN": "twin-cities minnesota",
    "IL": "champaign chicago illinois",
    "WI": "madison wisconsin",
    "IN": "lafayette bloomington indiana",
    "OH": "columbus cincinnati ohio",
    "MI": "ann-arbor lansing michigan",
    "NC": "triangle north-carolina",
    "MD": "college-park maryland",
    "VA": "fairfax charlottesville blacksburg virginia",
    "NJ": "new-brunswick new-jersey",
    "PA": "pittsburgh philadelphia pennsylvania",
    "MA": "boston massachusetts",
    "GA": "atlanta georgia",
    "NY": "new-york-city new-york-state",
}
REGION_STATE = {r: st for st, rs in _GROUPS.items() for r in rs.split()}
NO_STATE = {"virtual", "national"}

CODE_RE = re.compile(
    r"(?<![A-Za-z])(CA|GA|IL|IN|MA|MD|MI|MN|NC|NJ|NY|OH|PA|TX|VA|WA|WI|BC)(?![A-Za-z])")

ALLOWLIST = {}  # must stay empty


def city_codes(city):
    return set(CODE_RE.findall(city or ""))


def region_states(regions):
    return {REGION_STATE[r] for r in regions if r in REGION_STATE}


def problems_for(card):
    """Return a list of problems for one card (empty list means fine)."""
    codes = city_codes(card.get("city"))
    if not codes:
        return []
    regions = card.get("regions") or []
    if set(regions) <= NO_STATE:
        return ["city has %s but regions %s name no state" % (sorted(codes), regions)]
    if not codes & region_states(regions):
        return ["city has %s but regions %s are in %s"
                % (sorted(codes), regions, sorted(region_states(regions)))]
    return []


class CityStateMatchesRegions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cards = proglib.load_programs()

    def test_map_covers_every_schema_region(self):
        enum = proglib.load_schema()["properties"]["regions"]["items"]["enum"]
        for r in enum:
            self.assertTrue(r in REGION_STATE or r in NO_STATE, "region %r has no state mapping" % r)
        self.assertFalse(set(REGION_STATE) & NO_STATE)
        self.assertEqual(set(REGION_STATE) | NO_STATE, set(enum))

    def test_cards_loaded(self):
        self.assertGreater(len(self.cards), 50)

    def test_a_city_state_code_agrees_with_a_region(self):
        """Test A: if city has a state code, one region must be in that state."""
        bad = []
        for path, card in self.cards:
            codes = city_codes(card.get("city"))
            regions = card.get("regions") or []
            if codes and not set(regions) <= NO_STATE and not codes & region_states(regions):
                bad.append("%s: %s" % (card.get("id"), problems_for(card)[0]))
        self.assertEqual(bad, [], "city state code disagrees with regions:\n" + "\n".join(bad))

    def test_b_national_or_virtual_cards_have_no_state_code_in_city(self):
        """Test B: regions only national and virtual means no state code in city."""
        bad = []
        for path, card in self.cards:
            regions = card.get("regions") or []
            if regions and set(regions) <= NO_STATE and city_codes(card.get("city")):
                bad.append("%s: city %r, regions %s"
                           % (card.get("id"), card.get("city"), regions))
        self.assertEqual(bad, [], "state code in city of a no-state card:\n" + "\n".join(bad))

    def test_allowlist_is_empty(self):
        self.assertEqual(ALLOWLIST, {})

    def test_c_self_check_fixtures(self):
        """Test C: the checker flags a wrong region and accepts a right one."""
        self.assertTrue(problems_for({"city": "Newark, NJ", "regions": ["new-york-city"]}))
        self.assertEqual(
            problems_for({"city": "Newark, NJ", "regions": ["new-york-city", "new-jersey"]}), [])
        self.assertTrue(problems_for({"city": "Newark, NJ", "regions": ["national"]}))
        self.assertTrue(problems_for({"city": "Boston, MA", "regions": ["virtual", "national"]}))
        self.assertEqual(problems_for({"city": "Anywhere", "regions": ["national"]}), [])
        # a word that only contains letters of a code must not match
        self.assertEqual(city_codes("CAMBRIDGE, MAINE"), set())
        self.assertEqual(city_codes("Cambridge, MA"), {"MA"})


if __name__ == "__main__":
    unittest.main()
