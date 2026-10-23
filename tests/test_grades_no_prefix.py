"""A card's grades text must not start with "Grade" or "Grades".

lib.js ageText shows the field as "Grades " + grades, so a card that wrote
"Grades 9 to 11" showed "Grades Grades 9 to 11" on its tag (139 cards until
2026-10-22). Write the grades alone, for example "9 to 11" or "11 and 12".

Run: python3 -m unittest tests.test_grades_no_prefix -v
"""
import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRIES = os.path.join(ROOT, "data", "entries.json")
PREFIX = re.compile(r"grades?\b", re.I)


def doubled(cards):
    """Return (id, grades) for each card whose grades text starts with the word grade or grades."""
    return [(c.get("id"), c.get("grades")) for c in cards if isinstance(c.get("grades"), str) and PREFIX.match(c["grades"])]


class GradesHaveNoPrefix(unittest.TestCase):
    def test_no_card_repeats_the_word(self):
        with open(ENTRIES, encoding="utf-8") as fh:
            cards = json.load(fh)
        self.assertEqual(doubled(cards), [])

    def test_the_check_catches_both_forms(self):
        cards = [{"id": "a", "grades": "Grades 9 to 11"}, {"id": "b", "grades": "grade 12"}, {"id": "c", "grades": "9 to 12"},
                 {"id": "d", "grades": "Graduating seniors"}, {"id": "e", "grades": None}]
        self.assertEqual([i for i, _ in doubled(cards)], ["a", "b"])


if __name__ == "__main__":
    unittest.main()
