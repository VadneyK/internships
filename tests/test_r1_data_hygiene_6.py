"""Ratchet: a new program card may not use a bare home page as its url.

A root url (path '' or '/' and no query) is allowed only for the cards in ROOT_URL_ALLOW.
A card that gains a path must be removed from the list, and a listed id that no longer
exists or no longer has a root url fails the stale-entry test.
Run: python3 -m unittest discover -s tests -v
"""
import os
import sys
import unittest
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import proglib  # noqa: E402

# Root urls are allowed only when the card is about the whole organization, not one program page.
ROOT_URL_ALLOW = (
    # Added 2026-10-11 for ticket p7-regions-1: the program runs from its own site, and that home page is the page the card was checked against.
    "eugene-uo-sail-student-academy",
    "florida-miami-dade-schools-summer-youth-internship-program",
    "kentucky-governors-scholars-program",
    "tucson-ua-bio5-keys-research-internship",
    "uccs-pre-collegiate-program-colorado-springs",
    "black-girls-code",
    "camp-ignite-bc-firefighting-camp-for-young-women",  # one-page camp site, no deeper page exists
    "california-ffa",
    "ebayc-volunteer-and-internships",
    "exploring-learning-for-life",
    "forage-job-simulations",
    "georgia-fbla-state-association",
    "hack-club",
    "hacktoberfest-2026",
    "hire-las-youth",
    "indiana-hoosier-boys-state",
    "job-corps-georgia-brunswick-turner",
    "job-corps-minnesota-hubert-h-humphrey",
    "job-corps-texas-gary-san-marcos",
    "job-corps-washington-centers",
    "junior-achievement-norcal",
    "major-league-hacking",
    "md-ffa-association",
    "new-jersey-4h-youth-development",
    "new-jersey-governors-school-engineering-technology",
    "ryse-center-richmond",
    "san-mateo-county-jobs-for-youth",
    "seattle-childrens-hospital-volunteer",
    "seattle-uw-changemakers-in-computing",
    "sf-fire-youth-academy",
    "sf-new-door-ventures",
    "sf-youth-art-exchange",
    "slac-sage-camp",
    "south-bay-youth-one-stop-work-experience",
    "stanford-pre-collegiate-summer-institutes",
    "stanford-simr",
    "svcte-silicon-valley-career-technical-education",
    "tri-valley-rop",
    "uc-scout",
    "uci-cosmos",
    "ucr-trio-upward-bound-and-talent-search",
    "va-girls-state",
    "virtual-enterprises-international",
    "washington-evergreen-boys-and-girls-state",
    "wisconsin-badger-girls-state",
    "wisconsin-ymca-youth-in-government",
    "yep-youth-employment-partnership",
    "youth-community-service-palo-alto",
    "youth-radio-oakland",
    "youth-spirit-artworks-berkeley",
    "youth-uprising-summer-jobs",
    "youthbeat-media-careers",
    "college-park-umd-brin-maryland-mathematics-camp",  # own site for this one camp
    "fairfax-gmu-washington-journalism-and-media-conference",  # own site for this one conference
    "fairfax-gmu-wyse-washington-youth-summit-environment",  # own site for this one summit
    "minnesota-youth-institute-mnyi",  # own site for this one program
    "philadelphia-police-explorer-cadets-post-991",  # own site for this one post
    "baltimore-youthworks-summer-jobs",  # own site for this one program
    "michigan-detroit-grow-detroits-young-talent",  # own site for this one program
    "michigan-hosa-state-association",  # own site for this one state group
    "ucr-stride-stem-cell-research-summer",  # own site for this one program
    "colorado-ffa-association",  # own site for this one state group, added 2026-10-12 for the new state cards
    "georgia-envirothon",  # own site for this one competition, added 2026-10-12 for the new state cards
    "georgia-ga-ryse-independent-living-program",  # own site for this one program, added 2026-10-12 for the new state cards
    "illinois-fbla-state-association",  # own site for this one state group, added 2026-10-12 for the new state cards
    "iowa-ffa-association",  # own site for this one state group, added 2026-10-12 for the new state cards
    "kentucky-4h-youth-development",  # state 4-H home page; the sign-up link is the apply_url, added 2026-10-12 for the new state cards
    "kentucky-ffa-association",  # own site for this one state group, added 2026-10-12 for the new state cards
    "los-angeles-my-friends-place-youth-support",  # whole-organization card; the home page is the page checked, added 2026-10-12 for the new state cards
    "missouri-ffa-association",  # own site for this one state group, added 2026-10-12 for the new state cards
    "national-youthbuild-programs-ages-16-24",  # national network; the home page is the entry and the programs page is the apply_url, added 2026-10-12 for the new state cards
    "new-mexico-ffa-association",  # own site for this one state group, added 2026-10-12 for the new state cards
    "stock-market-game-sifma-foundation",  # own site for this one program, added 2026-10-12 for the new state cards
    "tennessee-4h-youth-development",  # state 4-H home page is the page checked, added 2026-10-12 for the new state cards
    "texas-youth-range-workshop",  # own site for this one workshop, added 2026-10-12 for the new state cards
)


def has_root_url(data):
    parsed = urllib.parse.urlparse(data.get("url") or "")
    return parsed.path in ("", "/") and not parsed.query


def root_url_ids(programs):
    return sorted(data.get("id") for _, data in programs if has_root_url(data))


class RootUrlRatchetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.programs = proglib.load_programs()

    def test_every_root_url_card_is_allowlisted(self):
        allowed = set(ROOT_URL_ALLOW)
        new = [card_id for card_id in root_url_ids(self.programs) if card_id not in allowed]
        self.assertEqual(
            new, [],
            "these cards use a bare home page as their url; link the program page instead, "
            "or add the id to ROOT_URL_ALLOW with a reason: %s" % new,
        )

    def test_every_allowlist_id_still_has_a_root_url(self):
        by_id = {data.get("id"): data for _, data in self.programs}
        stale = [
            card_id for card_id in ROOT_URL_ALLOW
            if card_id not in by_id or not has_root_url(by_id[card_id])
        ]
        self.assertEqual(
            stale, [],
            "remove these ids from ROOT_URL_ALLOW (missing card or url now has a path): %s" % stale,
        )

    def test_self_check_reports_root_url_only(self):
        fixtures = [
            ("root-card.json", {"id": "root-card", "url": "https://example.org/"}),
            ("path-card.json", {"id": "path-card", "url": "https://example.org/teens"}),
        ]
        self.assertEqual(root_url_ids(fixtures), ["root-card"])


if __name__ == "__main__":
    unittest.main()
