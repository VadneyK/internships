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
    "ala-girls-state-california",
    "black-girls-code",
    "ca-boys-girls-state",
    "camp-ignite-bc-firefighting-camp-for-young-women",  # one-page camp site, no deeper page exists
    "california-ffa",
    "cassadaga-job-corps-center",
    "congressional-app-challenge",
    "delawarevalley-job-corps-center",
    "ebayc-volunteer-and-internships",
    "edison-job-corps-center",
    "exploring-learning-for-life",
    "forage-job-simulations",
    "georgia-4h-uga-extension",
    "georgia-boys-state",
    "georgia-fbla-state-association",
    "glenmont-job-corps-center",
    "grafton-job-corps-center",
    "hack-club",
    "hacktoberfest-2026",
    "hire-las-youth",
    "illinois-4h-youth-development",
    "illinois-boys-state",
    "illinois-girls-state",
    "indiana-hoosier-boys-state",
    "iroquois-job-corps-center",
    "job-corps-georgia-brunswick-turner",
    "job-corps-minnesota-hubert-h-humphrey",
    "job-corps-texas-gary-san-marcos",
    "job-corps-washington-centers",
    "junior-achievement-norcal",
    "key-club-high-school",
    "keystone-job-corps-center",
    "major-league-hacking",
    "massachusetts-american-legion-boys-state",
    "md-ffa-association",
    "md-job-corps-woodstock",
    "nc-tar-heel-boys-state",
    "new-jersey-4h-youth-development",
    "new-jersey-governors-school-engineering-technology",
    "oneonta-job-corps-center",
    "pathful-explore",
    "pennsylvania-keystone-girls-state",
    "philadelphia-job-corps-center",
    "pittsburgh-job-corps-center",
    "redrock-job-corps-center",
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
    "us-senate-youth-program",
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
    "zooniverse",
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
