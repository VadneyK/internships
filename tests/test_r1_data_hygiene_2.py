"""Tests for the data hygiene rules: stray whitespace, age band, short how_to_apply, duplicate org plus name.
Run: python3 -m unittest discover -s tests -v"""
import contextlib
import copy
import io
import os
import sys
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "tools"))
import proglib  # noqa: E402
import validate  # noqa: E402
from test_tools import GOOD, problems  # noqa: E402


def bad_with(**changes):
    d = copy.deepcopy(GOOD)
    d.update(changes)
    return d


# GOOD has a very short how_to_apply, so every case here starts from a long enough one.
LONG_HOW = "Fill out the online form on the program page."


def ok_with(**changes):
    return bad_with(**{"how_to_apply": LONG_HOW, **changes})


class WhitespaceRuleTests(unittest.TestCase):
    def test_clean_strings_pass(self):
        self.assertEqual(problems(ok_with()), [])

    def test_each_kind_of_stray_whitespace_fails(self):
        for label, text in (("leading", " Help out."), ("trailing", "Help out. "), ("tab", "Help\tout."),
                            ("newline", "Help\nout."), ("double space", "Help  out.")):
            with self.subTest(label=label):
                found = problems(ok_with(notes=text))
                self.assertTrue(any("notes" in p and "whitespace" in p for p in found), found)

    def test_only_top_level_strings_are_checked(self):
        self.assertEqual(problems(ok_with(fields=["health"])), [])


class AgeBandRuleTests(unittest.TestCase):
    def test_min_age_18_passes_and_19_fails(self):
        self.assertEqual(problems(ok_with(min_age=18, max_age=None)), [])
        found = problems(ok_with(min_age=19, max_age=None))
        self.assertTrue(any("min_age is over 18" in p for p in found), found)

    def test_max_age_12_passes_and_11_fails(self):
        self.assertEqual(problems(ok_with(min_age=None, max_age=12)), [])
        found = problems(ok_with(min_age=None, max_age=11))
        self.assertTrue(any("max_age is under 12" in p for p in found), found)


class HowToApplyRuleTests(unittest.TestCase):
    def test_twenty_characters_passes(self):
        self.assertEqual(problems(ok_with(how_to_apply="a" * 19 + "b")), [])

    def test_short_or_blank_fails(self):
        for text in ("", "Apply.", "a" * 19):
            with self.subTest(text=text):
                found = problems(ok_with(how_to_apply=text))
                self.assertTrue(any("how_to_apply is too short" in p for p in found), found)


class DuplicateNameTests(unittest.TestCase):
    def run_main(self, programs):
        loaded = [(os.path.join("tmp", name), data) for name, data in programs]
        out = io.StringIO()
        with mock.patch.object(proglib, "load_programs", return_value=loaded), contextlib.redirect_stdout(out):
            code = validate.main()
        return code, out.getvalue()

    def test_different_names_pass(self):
        b = ok_with(id="second-program", name="Another Program", url="https://example.org/second")
        code, text = self.run_main([("example-program.json", ok_with()), ("second-program.json", b)])
        self.assertEqual(code, 0, text)

    def test_same_org_and_name_ignoring_case_and_punctuation_flagged(self):
        b = ok_with(id="second-program", org="EXAMPLE org.", name="example   program!", url="https://example.org/second")
        code, text = self.run_main([("example-program.json", ok_with()), ("second-program.json", b)])
        self.assertEqual(code, 1)
        self.assertIn("same org and name on more than one card (example-program, second-program)", text)


if __name__ == "__main__":
    unittest.main()
