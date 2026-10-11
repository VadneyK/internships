"""Validator rules in tools/proglib.validate_program that had no test naming them.

Each case starts from a copy of GOOD (tests/test_tools.py), breaks one field, and checks
that the problem list is not empty and names the field. Run: python3 -m unittest discover -s tests -v
"""
import copy
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import proglib  # noqa: E402
from test_tools import GOOD  # noqa: E402

FILENAME = "example-program.json"


def problems(data):
    return proglib.validate_program(os.path.join("x", FILENAME), data)


def mutate(change):
    data = copy.deepcopy(GOOD)
    change(data)
    return data


class ValidatorRuleTests(unittest.TestCase):
    def assertNamesField(self, data, field, must_contain=None):
        found = problems(data)
        self.assertTrue(found, "expected a problem for %s" % field)
        hits = [p for p in found if field in p and (must_contain is None or must_contain in p)]
        self.assertTrue(hits, "no problem names %r (got %r)" % (field, found))

    def test_good_entry_has_no_problems(self):
        self.assertEqual(problems(GOOD), [])

    def test_fetched_with_empty_sources_is_rejected(self):
        cases = {
            "fetched with no sources": mutate(lambda d: d.update(verified="fetched", sources_fetched=[])),
        }
        for label, data in cases.items():
            with self.subTest(case=label):
                self.assertNamesField(data, "sources_fetched", must_contain="verified=fetched")

    def test_deadline_iso_needs_confirmed_confidence(self):
        data = mutate(lambda d: d.update(deadline_confidence="unconfirmed", deadline_iso="2027-01-08"))
        with self.subTest(case="deadline_iso with unconfirmed confidence"):
            self.assertNamesField(data, "deadline_iso", must_contain="only for dates confirmed")

    def test_url_with_whitespace_is_rejected(self):
        data = mutate(lambda d: d.update(url="https://example.org/a b"))
        with self.subTest(case="url with a space"):
            self.assertNamesField(data, "url", must_contain="whitespace")

    def test_status_outside_enum_is_rejected(self):
        data = mutate(lambda d: d.update(status="maybe"))
        with self.subTest(case="status maybe"):
            self.assertNamesField(data, "status")

    def test_paid_type_outside_enum_is_rejected(self):
        data = mutate(lambda d: d.update(paid_type="free-ish"))
        with self.subTest(case="paid_type free-ish"):
            self.assertNamesField(data, "paid_type")

    def test_unknown_extra_key_is_rejected(self):
        data = mutate(lambda d: d.update(surprise_field="x"))
        with self.subTest(case="unknown extra key"):
            self.assertNamesField(data, "surprise_field")

    def test_priority_as_string_is_rejected(self):
        data = mutate(lambda d: d.update(priority="1"))
        with self.subTest(case="priority as string"):
            self.assertNamesField(data, "priority")

    def test_min_age_bool_is_rejected(self):
        data = mutate(lambda d: d.update(min_age=True))
        with self.subTest(case="min_age True"):
            self.assertNamesField(data, "min_age")


if __name__ == "__main__":
    unittest.main()
