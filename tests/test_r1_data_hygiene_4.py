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
    "AZ": "arizona",
    "NV": "nevada",
    "CO": "colorado",
    "UT": "utah",
    "FL": "florida",
    "HI": "hawaii",
    "OR": "oregon",
    "TN": "tennessee",
    "KY": "kentucky",
    "MO": "missouri",
    "NM": "new-mexico",
    "NE": "nebraska",
    "KS": "kansas",
    "IA": "iowa",
    "SD": "south-dakota",
    "ND": "north-dakota",
    "MT": "montana",
    "WY": "wyoming",
    "ID": "idaho",
}
REGION_STATE = {r: st for st, rs in _GROUPS.items() for r in rs.split()}
NO_STATE = {"virtual", "national"}

CODE_RE = re.compile(
    r"(?<![A-Za-z])(CA|GA|IL|IN|MA|MD|MI|MN|NC|NJ|NY|OH|PA|TX|VA|WA|WI|BC|AZ|NV|CO|UT|FL|HI|OR|TN|KY|MO|NM|NE|KS|IA|SD|ND|MT|WY|ID)(?![A-Za-z])")

ALLOWLIST = {}  # must stay empty

# Test D (ticket p9-regions-1). A card tagged national or virtual is shown to teens in every state,
# so its city must not name one state unless the program really is open from anywhere. Each entry
# below says why. Added 2026-10-10. A new card that trips this test should be retagged to its
# real region, not added here.
ANYWHERE_OK = {
    "bloomington-iu-kelley-womens-leadership-institute": "card says the experience is open to all students",
    "bloomington-iu-sese-sustainability-experience": "card says the program is entirely online and students anywhere can join",
    "boston-mit-beaver-works-summer-institute": "card says students who live or attend high school in the United States may apply",
    "madison-uw-accelerated-learning-program": "card says students from across the U.S. and abroad may apply",
    "madison-uw-badger-summer-scholars": "card lists tuition for domestic and international students and says peers come from across the country",
    "madison-uw-engineering-summer-program": "card says U.S. citizens or permanent residents may apply",
    "morehouse-summer-pre-college-program": "card notes say the program serves students from metro Atlanta and beyond, and courses are online",
    "nasa-genelab-for-high-schools": "card says U.S. citizens or permanent residents at a U.S.-based high school may apply",
    "pittsburgh-make-a-wish-youth-leadership-council": "card says the virtual group is for students beyond the Greater Pittsburgh Area",
    "regeneron-isef": "card notes say students from nearly every state and 60+ countries compete at affiliated fairs",
    "rsi-mit-cee": "card says open to US citizens, permanent residents and students from participating countries",
    "san-diego-ucsd-bioengineering-research-scholars": "card notes say international students can take part in the last call",
    "stanford-pre-collegiate-summer-institutes": "card says domestic and international students may apply",
    "ut-austin-csr-sees-internship": "card says the internship is open to U.S. citizens",
    "ut-cockrell-mite-engineering-camp": "card says students who live in the United States may apply",
}
# Phrases that show a card itself says who may join beyond one state. An absent residence rule
# does not count: a kept card must carry one of these in its own text (see test_d_kept_cards_state_openness).
OPENNESS_PHRASES = ("united states", "u.s.", "us citizens", "across the", "all students", "international",
                    "beyond", "anywhere", "domestic", "every state", "countries", "abroad")
US_CODES = ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH "
            "NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY BC").split()
COMMA_CODE_RE = re.compile(r",\s*(%s)\b" % "|".join(US_CODES))


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

    def test_d_national_or_virtual_cards_do_not_name_one_state_in_city(self):
        """Test D: national or virtual plus a ', XX' state code in city needs a reason in ANYWHERE_OK."""
        bad = []
        seen = set()
        for path, card in self.cards:
            regions = set(card.get("regions") or [])
            if regions & {"national", "virtual"} and COMMA_CODE_RE.search(card.get("city") or ""):
                seen.add(card.get("id"))
                if card.get("id") not in ANYWHERE_OK:
                    bad.append("%s: city %r, regions %s" % (card.get("id"), card.get("city"), sorted(regions)))
        self.assertEqual(bad, [], "single-state card tagged national or virtual:\n" + "\n".join(bad))
        stale = sorted(set(ANYWHERE_OK) - seen)
        self.assertEqual(stale, [], "ANYWHERE_OK entries that no longer need a reason: %s" % stale)
        for reason in ANYWHERE_OK.values():
            self.assertTrue(reason.strip())
            self.assertNotIn("residence", reason.lower(), "an absent residence rule is not an exemption: %r" % reason)

    def test_d_kept_cards_state_openness(self):
        """Test D (narrowed): each ANYWHERE_OK card must say, in its own text, that people beyond one state may join."""
        by_id = {card.get("id"): card for _, card in self.cards}
        weak = []
        for pid in ANYWHERE_OK:
            card = by_id.get(pid) or {}
            text = " ".join(str(card.get(k) or "") for k in ("city", "who_can_apply", "how_to_apply", "notes")).lower()
            if not any(phrase in text for phrase in OPENNESS_PHRASES):
                weak.append(pid)
        self.assertEqual(weak, [], "ANYWHERE_OK cards whose own text does not say who may join: %s" % weak)

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
        self.assertEqual(city_codes("Des Moines, IA"), {"IA"})
        self.assertTrue(COMMA_CODE_RE.search("Des Moines, IA"))
        self.assertFalse(COMMA_CODE_RE.search("Online (anywhere)"))


if __name__ == "__main__":
    unittest.main()
