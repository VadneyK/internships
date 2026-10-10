"""Fuzzy near-duplicate guard for data/programs.

tests/r2-tests-8.test.mjs only catches exact normalized keys. This file catches cards that were re-added with a
slightly changed name, or with a copy-pasted what_you_do. Run: python3 -m unittest discover -s tests -v

Rules:
- Cards that share a normalized org and city must have name tokens that overlap less than 0.75 (Jaccard).
- Cards with the same normalized what_you_do must be one of the allow listed groups below. Each group is one
  real case where several hospitals or squadrons use the same text on purpose.
- Every allow listed group must still match real cards, so stale entries fail and get removed.
"""
import itertools
import os
import re
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import proglib  # noqa: E402

STOP_WORDS = frozenset({"the", "of", "and", "for", "a", "in", "at", "to"})
NEAR_DUPLICATE_THRESHOLD = 0.75

# Groups of cards that share one what_you_do on purpose. Each entry is one real case, with the reason in a comment.
IDENTICAL_WHAT_YOU_DO_ALLOW = [
    # Ascension: two hospitals share one volunteer portal and one description.
    frozenset({"ascension-alexian-brothers-teen-volunteer", "ascension-saint-alexius-teen-volunteer"}),
    # Endeavor Health: four hospitals share one volunteer description.
    frozenset({
        "endeavor-health-evanston-hospital-teen-volunteer",
        "endeavor-health-glenbrook-hospital-teen-volunteer",
        "endeavor-health-highland-park-hospital-teen-volunteer",
        "endeavor-health-skokie-hospital-teen-volunteer",
    }),
    # MemorialCare: two hospitals share one volunteer description.
    frozenset({"fountain-valley-memorialcare-orange-coast-volunteer", "laguna-hills-memorialcare-saddleback-volunteer"}),
    # Civil Air Patrol wings: four states share one cadet description.
    frozenset({
        "massachusetts-civil-air-patrol-cadets",
        "new-jersey-civil-air-patrol-cadets",
        "new-york-state-civil-air-patrol-cadets",
        "pennsylvania-civil-air-patrol-cadets",
    }),
    # Civil Air Patrol squadrons: three cities share one cadet description.
    frozenset({
        "charlottesville-civil-air-patrol-monticello-squadron-cadets",
        "philadelphia-civil-air-patrol-northeast-philadelphia-squadron-cadets",
        "pittsburgh-civil-air-patrol-allegheny-county-squadron-cadets",
    }),
]


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()


def name_tokens(name):
    """Words of a program name, without stop words.

    A plural s is folded away (for example "volunteers" becomes "volunteer"). The literal tokenizer scores the
    fixture "Teen Crew Volunteers" against "Teen Crew Volunteer" at 0.5, so without this fold a singular or plural
    re-add would slip past the guard. On the current data the highest overlap is 0.625 with or without the fold.
    """
    tokens = set()
    for word in norm(name).split():
        if word in STOP_WORDS:
            continue
        if len(word) > 3 and word.endswith("s"):
            word = word[:-1]
        tokens.add(word)
    return tokens


def jaccard(a, b):
    union = a | b
    return len(a & b) / len(union) if union else 0.0


def near_duplicate_pairs(cards, threshold=NEAR_DUPLICATE_THRESHOLD):
    """Return (overlap, id_a, id_b) for each same org and city pair whose name tokens overlap at or above threshold.

    The result is sorted with the highest overlap first. Test 1 and the self check both call this function.
    """
    groups = {}
    for card in cards:
        groups.setdefault((norm(card.get("org")), norm(card.get("city"))), []).append(card)
    found = []
    for members in groups.values():
        for a, b in itertools.combinations(members, 2):
            score = jaccard(name_tokens(a.get("name")), name_tokens(b.get("name")))
            if score >= threshold:
                found.append((round(score, 3), a["id"], b["id"]))
    return sorted(found, reverse=True)


def identical_what_you_do_groups(cards):
    """Return the set of frozensets of ids for each normalized what_you_do shared by two or more cards."""
    groups = {}
    for card in cards:
        key = norm(card.get("what_you_do"))
        if key:
            groups.setdefault(key, []).append(card["id"])
    return {frozenset(ids) for ids in groups.values() if len(ids) >= 2}


def describe(ids):
    return ", ".join(sorted(ids))


CARDS = [data for _, data in proglib.load_programs()]


class NearDuplicateNameTests(unittest.TestCase):
    def test_same_org_and_city_names_do_not_nearly_match(self):
        pairs = near_duplicate_pairs(CARDS)
        problems = ["%s and %s have name overlap %.3f" % (a, b, score) for score, a, b in pairs]
        self.assertEqual(
            problems,
            [],
            "These cards share an org and city and have nearly the same name. Check that they are separate programs, "
            "then merge the cards or change one name.",
        )

    def test_self_check_reports_seeded_near_duplicate(self):
        fixtures = [
            {"id": "crew-plural", "name": "Teen Crew Volunteers", "org": "Crew Org", "city": "Austin, TX",
             "what_you_do": "Help at the front desk."},
            {"id": "crew-singular", "name": "Teen Crew Volunteer", "org": "Crew Org", "city": "austin tx",
             "what_you_do": "Sort books on shelves."},
        ]
        self.assertEqual(near_duplicate_pairs(fixtures), [(1.0, "crew-plural", "crew-singular")])

    def test_self_check_ignores_clean_pairs(self):
        fixtures = [
            {"id": "garden-helpers", "name": "Garden Helpers", "org": "Garden Club", "city": "Reno, NV",
             "what_you_do": "Weed and water plants."},
            {"id": "library-aides", "name": "Library Aides", "org": "City Library", "city": "Reno, NV",
             "what_you_do": "Shelve books."},
            {"id": "garden-tours", "name": "Garden Tours", "org": "Garden Club", "city": "Reno, NV",
             "what_you_do": "Lead visitors on walks."},
        ]
        self.assertEqual(near_duplicate_pairs(fixtures), [])


class IdenticalWhatYouDoTests(unittest.TestCase):
    def test_identical_what_you_do_only_in_allow_listed_groups(self):
        allowed = set(IDENTICAL_WHAT_YOU_DO_ALLOW)
        unexpected = identical_what_you_do_groups(CARDS) - allowed
        problems = ["[%s] shares what_you_do" % describe(group) for group in unexpected]
        self.assertEqual(
            problems,
            [],
            "Cards share the same what_you_do. If the sharing is real, add the group to IDENTICAL_WHAT_YOU_DO_ALLOW "
            "in tests/test_r1_data_hygiene_8.py with a reason. Otherwise rewrite the text for each card.",
        )

    def test_every_allow_listed_group_still_matches_real_cards(self):
        found = identical_what_you_do_groups(CARDS)
        stale = [describe(group) for group in IDENTICAL_WHAT_YOU_DO_ALLOW if group not in found]
        self.assertEqual(
            stale,
            [],
            "IDENTICAL_WHAT_YOU_DO_ALLOW has entries that no longer match real cards. Remove them.",
        )

    def test_self_check_reports_identical_what_you_do(self):
        fixtures = [
            {"id": "one", "name": "Helper", "org": "A", "city": "X", "what_you_do": "Help with tours."},
            {"id": "two", "name": "Aide", "org": "B", "city": "Y", "what_you_do": "Help with  tours!"},
            {"id": "three", "name": "Guide", "org": "C", "city": "Z", "what_you_do": "Run a science lab."},
        ]
        self.assertEqual(identical_what_you_do_groups(fixtures), {frozenset({"one", "two"})})


if __name__ == "__main__":
    unittest.main()
