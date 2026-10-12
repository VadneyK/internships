"""Negative controls for tools/validate.py wage_problems() and lite_problems().

Each test points validate.WAGES or validate.LITE at a temp JSON file, runs the
check, and restores the real path afterwards. The fixtures are small and made
up, so the tests run offline. The last test runs both checks on the real data
files and expects no problems.

Run: python3 -m unittest tests.test_r2_tests_w2_5_wage_validators -v
"""
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))

import validate  # noqa: E402


class _JsonFixture(unittest.TestCase):
    """Writes rows to a temp JSON file and points one validate constant at it."""

    target = None  # "WAGES" or "LITE"

    def setUp(self):
        self._saved = getattr(validate, self.target)
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.addCleanup(setattr, validate, self.target, self._saved)

    def use_rows(self, rows):
        path = os.path.join(self._tmp.name, "rows.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"states": rows}, f)
        setattr(validate, self.target, path)


class WageProblemsTest(_JsonFixture):
    target = "WAGES"

    def test_row_without_quote_is_reported(self):
        self.use_rows([{"id": "zz", "wage": "$13.00 an hour", "youth": None}])
        problems = validate.wage_problems()
        self.assertEqual(len(problems), 1)
        self.assertIn("state-wages zz: no quote", problems[0])

    def test_blank_quote_is_reported_as_no_quote(self):
        self.use_rows([{"id": "zz", "quote": "   ", "wage": None, "youth": None}])
        self.assertEqual(validate.wage_problems(), ["state-wages zz: no quote"])

    def test_wage_figure_missing_from_quote_is_reported_by_id(self):
        self.use_rows([{
            "id": "zz",
            "quote": "The state minimum is set by law.",
            "wage": "$13.00 an hour",
            "youth": None,
        }])
        self.assertEqual(
            validate.wage_problems(),
            ["state-wages zz: wage figure $13.00 is not in quote"],
        )

    def test_wage_figure_inside_quote_is_clean(self):
        self.use_rows([{
            "id": "zz",
            "quote": "The minimum wage is $13.00 an hour.",
            "wage": "$13.00 an hour",
            "youth": None,
        }])
        self.assertEqual(validate.wage_problems(), [])

    def test_youth_figure_is_checked_too(self):
        self.use_rows([{
            "id": "zz",
            "quote": "The minimum wage is $13.00 an hour.",
            "wage": "$13.00 an hour",
            "youth": "Workers under 18 may be paid $9.50 an hour.",
        }])
        self.assertEqual(
            validate.wage_problems(),
            ["state-wages zz: youth figure $9.50 is not in quote and needs a youth_url (https) and a youth_quote"],
        )

    def _youth_row(self, **extra):
        row = {
            "id": "zz",
            "quote": "The minimum wage is $13.00 an hour.",
            "wage": None,
            "youth": "Workers under 20 may be paid $4.25 an hour.",
        }
        row.update(extra)
        return row

    def test_youth_figure_with_url_and_quote_containing_it_is_clean(self):
        self.use_rows([self._youth_row(
            youth_url="https://www.dol.gov/agencies/whd/fact-sheets/32-minimum-wage-youth",
            youth_quote="employers may pay a youth minimum wage of not less than $4.25 an hour",
        )])
        self.assertEqual(validate.wage_problems(), [])

    def test_youth_figure_with_quote_but_no_url_is_reported(self):
        self.use_rows([self._youth_row(youth_quote="a youth minimum wage of $4.25 an hour")])
        self.assertEqual(len(validate.wage_problems()), 1)
        self.assertIn("needs a youth_url", validate.wage_problems()[0])

    def test_youth_figure_with_url_but_no_quote_is_reported(self):
        self.use_rows([self._youth_row(youth_url="https://www.dol.gov/x")])
        self.assertIn("needs a youth_url", validate.wage_problems()[0])

    def test_youth_url_that_is_not_https_is_reported(self):
        self.use_rows([self._youth_row(
            youth_url="http://www.dol.gov/x",
            youth_quote="a youth minimum wage of $4.25 an hour",
        )])
        self.assertIn("needs a youth_url", validate.wage_problems()[0])

    def test_youth_quote_missing_the_figure_is_reported(self):
        self.use_rows([self._youth_row(
            youth_url="https://www.dol.gov/x",
            youth_quote="a youth minimum wage of $7.25 an hour",
        )])
        self.assertEqual(
            validate.wage_problems(),
            ["state-wages zz: youth figure $4.25 is not in youth_quote"],
        )

    def test_null_wage_and_youth_are_clean(self):
        self.use_rows([{
            "id": "zz",
            "quote": "The page gives no state rate.",
            "wage": None,
            "youth": None,
        }])
        self.assertEqual(validate.wage_problems(), [])


class LiteProblemsTest(_JsonFixture):
    target = "LITE"

    def test_missing_source_excerpt_is_reported(self):
        self.use_rows([{"id": "zz", "quote": "Ages 14 and 15 may work."}])
        self.assertEqual(validate.lite_problems(), ["states-lite zz: no source_excerpt"])

    def test_blank_source_excerpt_is_reported(self):
        self.use_rows([{"id": "zz", "source_excerpt": "   ", "quote": "Ages 14 and 15 may work."}])
        self.assertEqual(validate.lite_problems(), ["states-lite zz: no source_excerpt"])

    def test_quote_not_in_excerpt_is_reported(self):
        self.use_rows([{
            "id": "zz",
            "source_excerpt": "Ages 14 and 15 may work outside school hours.",
            "quote": "Ages 16 and 17 may work.",
        }])
        self.assertEqual(
            validate.lite_problems(),
            ["states-lite zz: quote is not in source_excerpt"],
        )

    def test_non_string_quote_is_reported(self):
        self.use_rows([{
            "id": "zz",
            "source_excerpt": "Ages 14 and 15 may work outside school hours.",
            "quote": None,
        }])
        self.assertEqual(
            validate.lite_problems(),
            ["states-lite zz: quote is not in source_excerpt"],
        )

    def test_matching_quote_is_clean(self):
        self.use_rows([{
            "id": "zz",
            "source_excerpt": "Ages 14 and 15 may work outside school hours.",
            "quote": "Ages 14 and 15 may work outside school hours.",
        }])
        self.assertEqual(validate.lite_problems(), [])


class RealDataTest(unittest.TestCase):
    def test_real_wage_and_lite_data_have_no_problems(self):
        self.assertEqual(validate.wage_problems(), [])
        self.assertEqual(validate.lite_problems(), [])


if __name__ == "__main__":
    unittest.main()
