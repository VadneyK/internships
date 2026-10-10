"""More tests for the data and build tools. No network. Run: python3 -m unittest discover -s tests -v"""
import contextlib
import copy
import datetime as dt
import glob
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "tools"))
import freshness  # noqa: E402
import proglib  # noqa: E402
import validate  # noqa: E402
from test_tools import GOOD, problems  # noqa: E402


def bad_with(**changes):
    d = copy.deepcopy(GOOD)
    d.update(changes)
    return d


class EnumTests(unittest.TestCase):
    def test_each_enum_rejects_unknown_value(self):
        for key in ("status", "paid_type", "season", "type", "deadline_confidence", "verified"):
            with self.subTest(key=key):
                self.assertTrue(problems(bad_with(**{key: "not-a-real-value"})))

    def test_unknown_region_rejected(self):
        self.assertTrue(problems(bad_with(regions=["atlantis"])))

    def test_unknown_field_tag_rejected(self):
        self.assertTrue(problems(bad_with(fields=["underwater-basket-weaving"])))

    def test_bad_priority_rejected(self):
        self.assertTrue(problems(bad_with(priority=4)))


class AgeTests(unittest.TestCase):
    def test_min_age_range(self):
        for age in (4, 26, -1):
            with self.subTest(age=age):
                self.assertTrue(problems(bad_with(min_age=age, max_age=None)))
        for age in (5, 25):
            with self.subTest(age=age):
                self.assertEqual(problems(bad_with(min_age=age, max_age=None)), [])

    def test_non_integer_ages_rejected(self):
        for age in (15.5, "15", True, [15]):
            with self.subTest(min_age=age):
                self.assertTrue(problems(bad_with(min_age=age, max_age=None)))
            with self.subTest(max_age=age):
                self.assertTrue(problems(bad_with(min_age=None, max_age=age)))

    def test_null_ages_allowed(self):
        self.assertEqual(problems(bad_with(min_age=None, max_age=None)), [])


class DeadlineAndSourceTests(unittest.TestCase):
    def test_deadline_iso_needs_confirmed_confidence(self):
        for conf in ("last-year-pattern", "rolling", "unknown"):
            with self.subTest(conf=conf):
                out = problems(bad_with(deadline_confidence=conf))
                self.assertTrue(any("deadline_iso" in p for p in out), out)

    def test_null_deadline_with_other_confidence_is_fine(self):
        self.assertEqual(problems(bad_with(deadline_iso=None, deadline_confidence="last-year-pattern")), [])

    def test_fetched_needs_sources(self):
        out = problems(bad_with(sources_fetched=[]))
        self.assertTrue(any("sources_fetched" in p for p in out), out)

    def test_snippet_only_may_have_no_sources(self):
        self.assertEqual(problems(bad_with(verified="snippet-only", sources_fetched=[])), [])

    def test_http_urls_rejected(self):
        self.assertTrue(problems(bad_with(url="http://example.org/program")))
        self.assertTrue(problems(bad_with(apply_url="http://example.org/apply")))

    def test_https_apply_url_accepted(self):
        self.assertEqual(problems(bad_with(apply_url="https://example.org/apply")), [])

    def test_url_with_space_rejected(self):
        out = problems(bad_with(url="https://example.org/a b"))
        self.assertTrue(any("whitespace" in p for p in out), out)

    def test_sources_fetched_entry_must_be_a_web_address(self):
        # The schema pattern is ^https?://, so only non-web entries are caught today.
        for bad in ("ftp://example.org/program", "example.org/program", ""):
            with self.subTest(bad=bad):
                self.assertTrue(problems(bad_with(sources_fetched=["https://example.org/program", bad])))

    def test_unknown_key_rejected(self):
        out = problems(bad_with(surprise="hi"))
        self.assertTrue(any("surprise" in p for p in out), out)

    def test_bad_id_shape_rejected(self):
        self.assertTrue(problems(bad_with(id="Bad_ID"), "Bad_ID.json"))


class ValidateMainTests(unittest.TestCase):
    """Run validate.main() against a temp folder of programs. Nothing touches data/programs."""

    def run_main(self, programs):
        """programs: list of (file name, dict). Returns (exit code, printed text)."""
        loaded = [(os.path.join("tmp", name), data) for name, data in programs]
        out = io.StringIO()
        with mock.patch.object(proglib, "load_programs", return_value=loaded), contextlib.redirect_stdout(out):
            code = validate.main()
        return code, out.getvalue()

    def test_clean_set_passes(self):
        b = bad_with(id="second-program", url="https://example.org/second")
        code, text = self.run_main([("example-program.json", GOOD), ("second-program.json", b)])
        self.assertEqual(code, 0, text)
        self.assertIn("OK: 2 programs valid", text)

    def test_duplicate_id_flagged(self):
        b = bad_with(url="https://example.org/other")
        code, text = self.run_main([("example-program.json", GOOD), ("example-program.json", b)])
        self.assertEqual(code, 1)
        self.assertIn("duplicate id: example-program", text)

    def test_duplicate_url_flagged_ignoring_case_and_trailing_slash(self):
        b = bad_with(id="second-program", url="https://EXAMPLE.org/program/")
        code, text = self.run_main([("example-program.json", GOOD), ("second-program.json", b)])
        self.assertEqual(code, 1)
        self.assertIn("same official url used by example-program, second-program", text)

    def test_problem_count_is_reported(self):
        b = bad_with(id="second-program", url="https://example.org/second", status="nope")
        code, text = self.run_main([("example-program.json", GOOD), ("second-program.json", b)])
        self.assertEqual(code, 1)
        self.assertRegex(text, r"\d+ problem\(s\) in 2 programs")

    def test_load_programs_skips_underscore_templates(self):
        import json
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("_template.json", "example-program.json"):
                with open(os.path.join(tmp, name), "w", encoding="utf-8") as f:
                    json.dump(GOOD, f)
            names = [os.path.basename(p) for p, _ in proglib.load_programs(tmp)]
        self.assertEqual(names, ["example-program.json"])


class FreshnessEdgeTests(unittest.TestCase):
    def setUp(self):
        self.d = bad_with(deadline_iso=None, deadline_confidence="unknown")
        self.verified = dt.date.fromisoformat(self.d["verified_on"])

    def test_quiet_on_the_boundary_day_and_flags_the_day_after(self):
        for days in (1, 30, 120):
            with self.subTest(days=days):
                edge = self.verified + dt.timedelta(days=days)
                self.assertEqual(freshness.needs_refresh(self.d, edge, days), [])
                after = freshness.needs_refresh(self.d, edge + dt.timedelta(days=1), days)
                self.assertEqual(len(after), 1)
                self.assertIn("last verified %d days ago" % (days + 1), after[0])

    def test_same_day_is_quiet(self):
        self.assertEqual(freshness.needs_refresh(self.d, self.verified, 120), [])

    def test_deadline_grace_period_is_seven_days(self):
        d = bad_with(status="closed-expect-reopen")  # deadline 2027-01-08
        close = dt.date(2027, 1, 8)
        quiet = close + dt.timedelta(days=7)
        self.assertFalse(any("deadline" in r for r in freshness.needs_refresh(d, quiet, 9999)))
        self.assertTrue(any("deadline" in r for r in freshness.needs_refresh(d, quiet + dt.timedelta(days=1), 9999)))

    def test_open_status_is_quiet_on_the_deadline_day(self):
        d = bad_with()  # deadline 2027-01-08, status open-now
        self.assertFalse(any("deadline" in r for r in freshness.needs_refresh(d, dt.date(2027, 1, 8), 9999)))

    def test_year_round_deadline_never_flagged(self):
        d = bad_with(status="year-round")
        self.assertFalse(any("deadline" in r for r in freshness.needs_refresh(d, dt.date(2030, 1, 1), 99999)))

    def test_reasons_stack(self):
        d = bad_with(verified="snippet-only")
        reasons = freshness.needs_refresh(d, dt.date(2027, 6, 1), 120)
        self.assertEqual(len(reasons), 3, reasons)


class OpensDateFreshnessTests(unittest.TestCase):
    TODAY = dt.date(2026, 10, 9)

    def reasons(self, **changes):
        return freshness.needs_refresh(bad_with(**changes), self.TODAY, 120)

    def test_opens_soon_flagged_on_the_opening_day(self):
        reasons = self.reasons(status="opens-soon", opens_iso="2026-10-09")
        self.assertTrue(any("has arrived" in r and "2026-10-09" in r for r in reasons), reasons)

    def test_opens_soon_not_flagged_for_a_date_tomorrow(self):
        reasons = self.reasons(status="opens-soon", opens_iso="2026-10-10")
        self.assertFalse(any("has arrived" in r for r in reasons), reasons)

    def test_open_now_with_future_opening_date_flagged(self):
        reasons = self.reasons(status="open-now", opens_iso="2026-10-20")
        self.assertTrue(any("does not open until 2026-10-20" in r for r in reasons), reasons)

    def test_open_now_with_past_or_null_opening_date_not_flagged(self):
        for opens in ("2026-10-01", None):
            with self.subTest(opens_iso=opens):
                reasons = self.reasons(status="open-now", opens_iso=opens)
                self.assertFalse(any("does not open until" in r for r in reasons), reasons)


class BuildTests(unittest.TestCase):
    def built_files(self):
        return sorted(glob.glob(os.path.join(ROOT, "*.html"))) + [os.path.join(ROOT, "sitemap.xml"), os.path.join(ROOT, "robots.txt")]

    @staticmethod
    def read_all(paths):
        out = {}
        for p in paths:
            with open(p, "rb") as f:
                out[os.path.basename(p)] = f.read()
        return out

    def run_build(self):
        res = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "build.py")], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
        self.assertNotIn("WARNING", res.stdout)
        return res

    def test_build_is_deterministic(self):
        paths = self.built_files()
        with tempfile.TemporaryDirectory() as backup:
            for p in paths:
                shutil.copy2(p, backup)
            original = self.read_all(paths)
            try:
                self.run_build()
                first = self.read_all(self.built_files())
                self.run_build()
                second = self.read_all(self.built_files())
            finally:
                for p in paths:
                    shutil.copy2(os.path.join(backup, os.path.basename(p)), p)
        self.assertEqual(first, second, "two builds in a row gave different files")
        for name, data in original.items():
            self.assertEqual(first.get(name), data, "%s is out of date; run python3 tools/build.py" % name)
        self.assertEqual(self.read_all(self.built_files()), original, "files were not restored")

    def test_no_unreplaced_tokens_in_built_pages(self):
        for path in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
            with open(path, encoding="utf-8") as f:
                text = f.read()
            with self.subTest(page=os.path.basename(path)):
                self.assertNotIn("{{", text)


class WiringTests(unittest.TestCase):
    def src_pages(self):
        for path in sorted(glob.glob(os.path.join(ROOT, "src", "*.html"))):
            if os.path.basename(path).startswith("_"):
                continue
            yield path

    def scripts_for(self, path):
        with open(path, encoding="utf-8") as f:
            head = f.read().split("\n---\n", 1)[0]
        m = re.search(r"^scripts:\s*(.*)$", head, flags=re.M)
        return [s.strip() for s in m.group(1).split(",") if s.strip()] if m else []

    def test_every_named_script_exists(self):
        for path in self.src_pages():
            for name in self.scripts_for(path):
                with self.subTest(page=os.path.basename(path), script=name):
                    self.assertTrue(os.path.isfile(os.path.join(ROOT, "assets", "js", name + ".js")))

    def test_every_script_file_is_used_by_a_page(self):
        used = {n for p in self.src_pages() for n in self.scripts_for(p)}
        for path in sorted(glob.glob(os.path.join(ROOT, "assets", "js", "*.js"))):
            name = os.path.basename(path)[:-3]
            if name in ("lib", "common"):
                continue  # loaded by the layout, not named in a page header
            with self.subTest(script=name):
                self.assertIn(name, used)

    def test_layout_loads_lib_and_common(self):
        with open(os.path.join(ROOT, "src", "_layout.html"), encoding="utf-8") as f:
            layout = f.read()
        # lib.js comes from build.py through the {{libscript}} token, only on pages with a scripts: field
        self.assertIn("{{libscript}}", layout)
        self.assertRegex(layout, r"assets/js/common\.js")

    def test_built_pages_load_their_scripts(self):
        for path in self.src_pages():
            page = os.path.basename(path)
            with open(os.path.join(ROOT, page), encoding="utf-8") as f:
                built = f.read()
            for name in self.scripts_for(path):
                with self.subTest(page=page, script=name):
                    self.assertIn("assets/js/%s.js?v=" % name, built)


if __name__ == "__main__":
    unittest.main()
