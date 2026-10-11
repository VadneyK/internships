"""Tests for the core data file, tools/freshness.py, tools/proglib.py helpers and tools/art.py.

No network. Run: python3 -m unittest discover -s tests -v
"""
import contextlib
import datetime as dt
import importlib.util
import io
import json
import os
import re
import shutil
import sys
import tempfile
import unittest
import warnings
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(HERE, "..", "tools")
sys.path.insert(0, TOOLS_DIR)
sys.path.insert(0, HERE)

import proglib  # noqa: E402
import build_data  # noqa: E402
import freshness  # noqa: E402
from test_r2_tools import build_into_temp, read_bytes  # noqa: E402

DATA_DIR = os.path.join(proglib.ROOT, "data")
TODAY = "2026-10-09"


class CoreFileTests(unittest.TestCase):
    """data/entries-core.json must match a fresh build and be a projection of entries.json."""

    @classmethod
    def setUpClass(cls):
        cls.tmp, _ = build_into_temp()

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_committed_core_file_is_byte_identical_to_fresh_build(self):
        self.assertEqual(
            read_bytes(DATA_DIR, "entries-core.json"),
            read_bytes(self.tmp.name, "entries-core.json"),
            "run python3 tools/build_data.py",
        )

    def test_every_core_row_is_the_core_projection_of_its_entries_row(self):
        with open(os.path.join(DATA_DIR, "entries.json"), encoding="utf-8") as f:
            entries = json.load(f)
        with open(os.path.join(DATA_DIR, "entries-core.json"), encoding="utf-8") as f:
            core = json.load(f)
        self.assertEqual(len(core), len(entries))
        by_id = {d["id"]: d for d in entries}
        self.assertEqual(len(by_id), len(entries), "ids must be unique")
        for row in core:
            with self.subTest(id=row.get("id")):
                self.assertIn(row["id"], by_id)
                expected = {k: by_id[row["id"]][k] for k in build_data.CORE_KEYS if k in by_id[row["id"]]}
                self.assertEqual(row, expected)
                self.assertEqual(list(row.keys()), [k for k in build_data.CORE_KEYS if k in expected])


class StatsFileTests(unittest.TestCase):
    """data/entries-stats.json: only what lib.insights() reads, same ids and order as entries.json."""

    @classmethod
    def setUpClass(cls):
        cls.tmp, _ = build_into_temp()
        with open(os.path.join(DATA_DIR, "entries.json"), encoding="utf-8") as f:
            cls.entries = json.load(f)
        with open(os.path.join(DATA_DIR, "entries-stats.json"), encoding="utf-8") as f:
            cls.stats = json.load(f)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_committed_file_is_byte_identical_to_fresh_build(self):
        self.assertEqual(read_bytes(DATA_DIR, "entries-stats.json"), read_bytes(self.tmp.name, "entries-stats.json"), "run python3 tools/build_data.py")

    def test_same_ids_and_order_and_equal_values(self):
        self.assertEqual([r["id"] for r in self.stats], [e["id"] for e in self.entries])
        for r, e in zip(self.stats, self.entries):
            for k, v in r.items():
                self.assertEqual(v, e[k], (r["id"], k))
            for k in build_data.STATS_KEYS:
                if k not in r:
                    self.assertIsNone(e.get(k), (r["id"], k))

    def test_keys_are_only_the_ones_insights_reads(self):
        with open(os.path.join(HERE, "..", "assets", "js", "lib.js"), encoding="utf-8") as f:
            lib = f.read()
        start = lib.index("function insights(list, now)")
        body = lib[start:lib.index("function gradePhrase", start)]
        used = set(re.findall(r"\be\.([a-z_]+)", body))
        # insights() passes e to effStatus, ageOk, hubsOf and futureDeadline, which read these keys
        for fn in ("effStatus", "ageOk", "hubsOf", "futureDeadline"):
            m = re.search(r"function " + fn + r"\(.*?\n  }\n", lib, re.S)
            used |= set(re.findall(r"\be\.([a-z_]+)", m.group(0)))
        used |= {"deadline_iso", "opens_iso"}  # read through parseISO(e.deadline_iso) in the helpers
        self.assertEqual(set(build_data.STATS_KEYS), used)
        for r in self.stats:
            self.assertLessEqual(set(r), used)

    def test_compact_and_under_60_percent_of_card_file(self):
        raw = read_bytes(DATA_DIR, "entries-stats.json")
        self.assertEqual(raw.decode("utf-8"), json.dumps(self.stats, ensure_ascii=False, separators=(",", ":")) + "\n")
        self.assertLess(len(raw), 0.6 * len(read_bytes(DATA_DIR, "entries-card.json")))


def run_freshness(*argv):
    # The default cap of 150 rows is for the GitHub issue; these tests look at every row.
    if "--max-items" not in argv:
        argv = (*argv, "--max-items", "1000000")
    out = io.StringIO()
    with mock.patch.object(sys, "argv", ["freshness.py", *argv]), contextlib.redirect_stdout(out):
        code = freshness.main()
    return code, out.getvalue()


def item_lines(text):
    return [line for line in text.splitlines() if line.startswith("- [ ] ")]


def program_for_line(line, programs_by_id):
    match = re.search(r"\(`([^`]+)`", line)
    assert match, line
    return programs_by_id[match.group(1)]


class FreshnessMainTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.today = dt.date.fromisoformat(TODAY)
        cls.programs = [d for _, d in proglib.load_programs()]
        cls.by_id = {d["id"]: d for d in cls.programs}

    def test_exit_code_is_zero(self):
        code, _ = run_freshness("--today", TODAY)
        self.assertEqual(code, 0)

    def test_header_and_count_match_the_refresh_rule(self):
        _, text = run_freshness("--today", TODAY)
        lines = text.splitlines()
        self.assertEqual(lines[0], "# Refresh list for %s" % TODAY)
        expected = sum(1 for d in self.programs if freshness.needs_refresh(d, self.today, 120))
        self.assertEqual(
            lines[2],
            "%d programs need a person to re-read the official page. See docs/VERIFYING.md for the checklist." % expected,
        )
        self.assertEqual(len(item_lines(text)), expected)

    def test_rows_are_sorted_by_urgency_then_oldest_check_then_region_then_name(self):
        _, text = run_freshness("--today", TODAY)
        keys = []
        for line in item_lines(text):
            d = program_for_line(line, self.by_id)
            keys.append(freshness.urgency_key(d, self.today))
        self.assertEqual(keys, sorted(keys))

    def test_each_row_carries_its_program_url_and_a_reason(self):
        _, text = run_freshness("--today", TODAY)
        for line in item_lines(text):
            d = program_for_line(line, self.by_id)
            self.assertIn("**%s**" % d["name"], line)
            self.assertTrue(line.endswith(d["url"]), line)
            self.assertIn("): ", line)

    def test_out_file_holds_the_same_text_as_stdout(self):
        printed = run_freshness("--today", TODAY)[1]
        with tempfile.TemporaryDirectory() as tmp:
            out_path = os.path.join(tmp, "refresh.md")
            _, printed_with_out = run_freshness("--today", TODAY, "--out", out_path)
            with open(out_path, encoding="utf-8") as f:
                written = f.read()
        self.assertEqual(printed, printed_with_out)
        self.assertEqual(written, printed)

    def test_huge_days_drops_the_last_verified_reason(self):
        _, text = run_freshness("--today", TODAY, "--days", "100000")
        self.assertNotIn("last verified", text)
        allowed = ("official page was never read", "status says", "has passed; look for next year's dates")
        for line in item_lines(text):
            self.assertTrue(any(phrase in line for phrase in allowed), line)

    def test_days_flag_actually_controls_the_last_verified_reason(self):
        # On TODAY the data is too fresh for the age rule to fire, so use a date far enough
        # after the newest verification that the default 120 days flags programs.
        later = dt.date(2027, 6, 1)
        _, default_text = run_freshness("--today", later.isoformat())
        _, huge_text = run_freshness("--today", later.isoformat(), "--days", "100000")
        self.assertIn("last verified", default_text)
        self.assertNotIn("last verified", huge_text)
        expected = sum(1 for d in self.programs if freshness.needs_refresh(d, later, 120))
        self.assertEqual(len(item_lines(default_text)), expected)

    def test_huge_days_never_shows_more_rows_than_default(self):
        _, default_text = run_freshness("--today", TODAY)
        _, huge_text = run_freshness("--today", TODAY, "--days", "100000")
        self.assertLessEqual(len(item_lines(huge_text)), len(item_lines(default_text)))

    def test_two_runs_print_identical_output(self):
        first = run_freshness("--today", TODAY)[1]
        second = run_freshness("--today", TODAY)[1]
        self.assertEqual(first, second)


class ProglibTests(unittest.TestCase):
    def test_parse_iso_none_is_none(self):
        self.assertIsNone(proglib.parse_iso(None))

    def test_parse_iso_empty_string_is_none(self):
        self.assertIsNone(proglib.parse_iso(""))

    def test_parse_iso_reads_a_real_date(self):
        self.assertEqual(proglib.parse_iso("2026-10-09"), dt.date(2026, 10, 9))

    def test_parse_iso_bad_string_is_none(self):
        self.assertIsNone(proglib.parse_iso("not a date"))
        self.assertIsNone(proglib.parse_iso("2026-13-40"))
        self.assertIsNone(proglib.parse_iso(5))

    def test_validate_program_flags_impossible_deadline_date(self):
        data = {"deadline_iso": "2026-13-40", "deadline_confidence": "confirmed-2026-27"}
        problems = proglib.validate_program("x.json", data)
        self.assertTrue(
            any("deadline_iso is not a real date: 2026-13-40" in p for p in problems),
            problems,
        )

    def test_date_label_style_and_no_zero_padding(self):
        self.assertEqual(proglib.date_label("2026-10-09"), "Oct 9, 2026")
        self.assertEqual(proglib.date_label("2026-01-01"), "Jan 1, 2026")
        self.assertEqual(proglib.date_label("2026-09-05"), "Sep 5, 2026")
        self.assertEqual(proglib.date_label("2026-10-12"), "Oct 12, 2026")
        self.assertEqual(proglib.date_label("2026-12-31"), "Dec 31, 2026")

    def test_date_label_days_one_to_nine_have_no_leading_zero(self):
        for day in range(1, 10):
            with self.subTest(day=day):
                self.assertEqual(proglib.date_label("2026-10-%02d" % day), "Oct %d, 2026" % day)

    def test_date_label_matches_the_checked_date_in_meta(self):
        with open(os.path.join(DATA_DIR, "meta.json"), encoding="utf-8") as f:
            meta = json.load(f)
        self.assertEqual(proglib.date_label(meta["checked"]), meta["checked_label"])

    def test_iter_strings_walks_nested_lists_and_dicts_and_skips_non_strings(self):
        value = {
            "a": ["x", {"b": "y", "c": [None, 3, "z"]}],
            "d": None,
            "e": 4,
            "f": 2.5,
            "g": True,
        }
        self.assertEqual(list(proglib.iter_strings(value)), ["x", "y", "z"])

    def test_iter_strings_bare_values(self):
        self.assertEqual(list(proglib.iter_strings("hi")), ["hi"])
        self.assertEqual(list(proglib.iter_strings(5)), [])
        self.assertEqual(list(proglib.iter_strings(None)), [])
        self.assertEqual(list(proglib.iter_strings([])), [])


class ArtTests(unittest.TestCase):
    """tools/art.py writes SVGs into assets/img when imported, so it is loaded from a temp copy.

    The repo's assets/img folder is never touched by these tests.
    """

    @classmethod
    def setUpClass(cls):
        cls.src = os.path.join(TOOLS_DIR, "art.py")

    def load_art_in_temp(self, root):
        tools = os.path.join(root, "tools")
        os.makedirs(tools)
        copy = os.path.join(tools, "art.py")
        shutil.copy(self.src, copy)
        spec = importlib.util.spec_from_file_location("art_copy_%s" % os.path.basename(root), copy)
        module = importlib.util.module_from_spec(spec)
        # art.py leaves its output files open at import time; that noise is not this test's concern.
        with contextlib.redirect_stdout(io.StringIO()), warnings.catch_warnings():
            warnings.simplefilter("ignore", ResourceWarning)
            spec.loader.exec_module(module)
        return module

    def test_same_seed_gives_identical_splat(self):
        with tempfile.TemporaryDirectory() as root:
            art = self.load_art_in_temp(root)
            self.assertEqual(art.splat(7, "#e9572b"), art.splat(7, "#e9572b"))

    def test_different_seed_gives_different_splat(self):
        with tempfile.TemporaryDirectory() as root:
            art = self.load_art_in_temp(root)
            self.assertNotEqual(art.splat(7, "#e9572b"), art.splat(8, "#e9572b"))

    def test_two_fresh_runs_write_identical_svg_files(self):
        names = ("splat-orange.svg", "splat-yellow.svg", "swoosh.svg", "favicon.svg")
        contents = []
        for _ in range(2):
            with tempfile.TemporaryDirectory() as root:
                self.load_art_in_temp(root)
                out = os.path.join(root, "assets", "img")
                files = {}
                for name in names:
                    with open(os.path.join(out, name), encoding="utf-8") as f:
                        files[name] = f.read()
                contents.append(files)
        self.assertEqual(contents[0], contents[1])


if __name__ == "__main__":
    unittest.main()
