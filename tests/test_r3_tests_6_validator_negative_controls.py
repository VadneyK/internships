"""Negative controls for tools/proglib.py validate_program.

Each rule below gets one mutation applied to a real, clean program card. The
test asserts the matching message appears and that no other rule's message
appears, so a rule edited out of proglib.py fails here instead of shipping a
bad card.

Run: python3 -m unittest tests.test_r3_tests_6_validator_negative_controls -v
"""
import copy
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))

import proglib  # noqa: E402

EM_DASH = chr(0x2014)
EN_DASH = chr(0x2013)

# Substring of the message each rule produces. Every rule message in
# validate_program is listed here so the "no unrelated message" check can
# see all of them.
RULE_MESSAGES = {
    "file_name": "file name must be <id>.json",
    "age_order": "min_age is greater than max_age",
    "opens_soon": "status opens-soon needs opens_iso",
    "em_dash": "contains a dash character U+2014",
    "en_dash": "contains a dash character U+2013",
    "bad_date": "is not a real date",
}


def _clean_card():
    """Return (path, data) for the first real program card that validates with no problems."""
    schema = proglib.load_schema()
    for path, data in proglib.load_programs():
        if proglib.validate_program(path, data, schema) == []:
            return path, data
    raise AssertionError("no clean program card found in data/programs to use as a base")


def _only_rule(problems, rule_key):
    """Return the rule keys whose message substring appears in any problem."""
    hit = set()
    for key, substring in RULE_MESSAGES.items():
        if any(substring in p for p in problems):
            hit.add(key)
    return hit


class ValidatorNegativeControls(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path, cls.base = _clean_card()
        cls.schema = proglib.load_schema()

    def _check_mutation(self, rule_key, path, data):
        problems = proglib.validate_program(path, data, self.schema)
        expected = RULE_MESSAGES[rule_key]
        self.assertTrue(
            any(expected in p for p in problems),
            "rule %r: expected a message containing %r, got %r" % (rule_key, expected, problems),
        )
        unrelated = _only_rule(problems, rule_key) - {rule_key}
        self.assertFalse(
            unrelated,
            "rule %r: unrelated rule message(s) also fired: %r (all problems: %r)"
            % (rule_key, sorted(unrelated), problems),
        )

    def test_base_card_is_clean(self):
        problems = proglib.validate_program(self.path, self.base, self.schema)
        self.assertEqual(problems, [], "the base card must validate before any mutation")

    def test_file_name_must_match_id(self):
        wrong_path = os.path.join(os.path.dirname(self.path), "not-the-id.json")
        self._check_mutation("file_name", wrong_path, copy.deepcopy(self.base))

    def test_min_age_above_max_age(self):
        data = copy.deepcopy(self.base)
        data["min_age"] = 17
        data["max_age"] = 14
        self._check_mutation("age_order", self.path, data)

    def test_opens_soon_needs_opens_iso(self):
        data = copy.deepcopy(self.base)
        data["status"] = "opens-soon"
        data["opens_iso"] = None
        self._check_mutation("opens_soon", self.path, data)

    def test_em_dash_in_text_is_rejected(self):
        data = copy.deepcopy(self.base)
        data["who_can_apply"] = "Ages 14 " + EM_DASH + " 17 with a parent's permission."
        self._check_mutation("em_dash", self.path, data)

    def test_en_dash_in_text_is_rejected(self):
        data = copy.deepcopy(self.base)
        data["who_can_apply"] = "Ages 14 " + EN_DASH + " 17 with a parent's permission."
        self._check_mutation("en_dash", self.path, data)

    def test_impossible_calendar_date_is_rejected(self):
        data = copy.deepcopy(self.base)
        data["opens_iso"] = "2026-02-30"
        self._check_mutation("bad_date", self.path, data)


if __name__ == "__main__":
    unittest.main()
