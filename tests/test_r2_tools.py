"""Tests for tools/linkcheck.py and tools/build_data.py. Run: python3 -m unittest discover -s tests -v"""
import contextlib
import copy
import csv
import io
import json
import os
import random
import socket
import sys
import tempfile
import unittest
import urllib.error
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import proglib  # noqa: E402
import linkcheck  # noqa: E402
import build_data  # noqa: E402

DATA_DIR = os.path.join(proglib.ROOT, "data")


def http_error(code):
    return urllib.error.HTTPError("https://example.org/x", code, "scripted", {}, None)


def scripted(*steps):
    """Fake linkcheck.fetch. Each step is a status int (returned) or an exception (raised).
    Returns (fake, calls). The last step repeats if the checker keeps asking."""
    calls = []

    def fake(url, method):
        calls.append(method)
        step = steps[min(len(calls) - 1, len(steps) - 1)]
        if isinstance(step, BaseException):
            raise step
        return step

    return fake, calls


def run_check(*steps):
    fake, calls = scripted(*steps)
    with mock.patch.object(linkcheck, "fetch", fake):
        return linkcheck.check("https://example.org/x"), calls


class LinkcheckClassifyTests(unittest.TestCase):
    def test_200_is_ok(self):
        result, calls = run_check(200)
        self.assertEqual(result, ("ok", 200))
        self.assertEqual(calls, ["HEAD"])

    def test_head_405_then_get_200_is_ok(self):
        result, calls = run_check(http_error(405), 200)
        self.assertEqual(result, ("ok", 200))
        self.assertEqual(calls, ["HEAD", "GET"])

    def test_404_on_both_is_broken(self):
        result, calls = run_check(http_error(404), http_error(404))
        self.assertEqual(result, ("broken", 404))
        self.assertEqual(calls, ["HEAD", "GET"])

    def test_410_is_broken(self):
        result, _ = run_check(http_error(410), http_error(410))
        self.assertEqual(result, ("broken", 410))

    def test_403_is_blocked(self):
        result, _ = run_check(http_error(403), http_error(403))
        self.assertEqual(result, ("blocked", 403))

    def test_429_is_blocked(self):
        result, _ = run_check(http_error(429), http_error(429))
        self.assertEqual(result, ("blocked", 429))

    def test_999_is_blocked(self):
        result, _ = run_check(http_error(999), http_error(999))
        self.assertEqual(result, ("blocked", 999))

    def test_timeout_is_blocked(self):
        result, _ = run_check(urllib.error.URLError(TimeoutError("timed out")))
        self.assertEqual(result, ("blocked", "timeout"))

    def test_dns_failure_is_broken(self):
        err = urllib.error.URLError(socket.gaierror(8, "nodename nor servname provided, or not known"))
        result, calls = run_check(err)
        self.assertEqual(result[0], "broken")
        self.assertIn("nodename", result[1])
        self.assertEqual(len(calls), 4)  # HEAD and GET, twice

    def test_500_twice_is_broken(self):
        result, calls = run_check(http_error(500), http_error(500), http_error(500), http_error(500))
        self.assertEqual(result, ("broken", 500))
        self.assertEqual(len(calls), 4)

    def test_500_then_200_is_ok(self):
        result, _ = run_check(http_error(500), 200)
        self.assertEqual(result, ("ok", 200))


class LinkcheckMainTests(unittest.TestCase):
    PROGRAMS = [
        ("a.json", {"id": "prog-a", "name": "Program A", "url": "https://example.org/a", "apply_url": None}),
        ("b.json", {"id": "prog-b", "name": "Program B", "url": "https://example.org/b", "apply_url": None}),
    ]

    def run_main(self, results, *flags):
        def fake_check(url):
            return results[url]

        out = io.StringIO()
        with mock.patch.object(linkcheck, "check", fake_check), \
                mock.patch.object(proglib, "load_programs", lambda: copy.deepcopy(self.PROGRAMS)), \
                mock.patch.object(sys, "argv", ["linkcheck.py", *flags]), \
                contextlib.redirect_stdout(out):
            code = linkcheck.main()
        return code, out.getvalue()

    def test_strict_fails_only_when_a_link_is_broken(self):
        code, report = self.run_main({"https://example.org/a": ("ok", 200), "https://example.org/b": ("broken", 404)}, "--strict")
        self.assertEqual(code, 1)
        self.assertIn("## Broken", report)

    def test_strict_passes_when_links_are_only_blocked(self):
        code, report = self.run_main({"https://example.org/a": ("ok", 200), "https://example.org/b": ("blocked", 403)}, "--strict")
        self.assertEqual(code, 0)
        self.assertNotIn("## Broken", report)
        self.assertIn("## Blocked", report)

    def test_not_strict_never_fails(self):
        code, _ = self.run_main({"https://example.org/a": ("broken", 404), "https://example.org/b": ("broken", 404)})
        self.assertEqual(code, 0)


def build_into_temp(programs=None):
    """Run build_data.main() with OUT_DIR pointed at a temp folder. Returns (TemporaryDirectory, stdout)."""
    tmp = tempfile.TemporaryDirectory()
    out = io.StringIO()
    patches = [mock.patch.object(build_data, "OUT_DIR", tmp.name)]
    if programs is not None:
        patches.append(mock.patch.object(proglib, "load_programs", lambda: [(p["id"] + ".json", copy.deepcopy(p)) for p in programs]))
    with contextlib.ExitStack() as stack:
        for p in patches:
            stack.enter_context(p)
        stack.enter_context(contextlib.redirect_stdout(out))
        code = build_data.main()
    assert code == 0
    return tmp, out.getvalue()


def read_bytes(folder, name):
    with open(os.path.join(folder, name), "rb") as f:
        return f.read()


def expected_cell(value):
    if isinstance(value, list):
        value = "; ".join(value)
    return "" if value is None else str(value)


class BuildDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp, _ = build_into_temp()
        cls.programs = sorted((d for _, d in proglib.load_programs()), key=lambda d: d["id"])

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_committed_data_files_match_a_fresh_build(self):
        for name in ("entries.json", "entries-lite.json", "entries.csv", "meta.json"):
            with self.subTest(file=name):
                self.assertEqual(read_bytes(DATA_DIR, name), read_bytes(self.tmp.name, name), "run python3 tools/build_data.py")

    def test_csv_row_count_and_width(self):
        with open(os.path.join(self.tmp.name, "meta.json"), encoding="utf-8") as f:
            meta = json.load(f)
        with open(os.path.join(self.tmp.name, "entries.csv"), encoding="utf-8", newline="") as f:
            rows = list(csv.reader(f))
        self.assertEqual(rows[0], build_data.CSV_COLUMNS)
        self.assertEqual(len(rows), meta["count"] + 1)
        for row in rows:
            self.assertEqual(len(row), len(build_data.CSV_COLUMNS), row[:1])

    def test_csv_list_fields_joined_and_none_blank(self):
        with open(os.path.join(self.tmp.name, "entries.csv"), encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), len(self.programs))
        rng = random.Random(7)
        picks = rng.sample(range(len(self.programs)), min(25, len(self.programs)))
        for i in picks:
            d, row = self.programs[i], rows[i]
            self.assertEqual(row["id"], d["id"])
            self.assertEqual(row["regions"], "; ".join(d["regions"]))
            for col in build_data.CSV_COLUMNS:
                if d.get(col) is None:
                    self.assertEqual(row[col], "", "%s %s" % (d["id"], col))
        # every cell of every program, not just the sample
        for d, row in zip(self.programs, rows):
            for col in build_data.CSV_COLUMNS:
                self.assertEqual(row[col], expected_cell(d.get(col)), "%s %s" % (d["id"], col))

    def test_csv_round_trips_commas_quotes_and_newlines(self):
        base = copy.deepcopy(self.programs[0])
        tricky = 'Line one, with a comma.\nLine two has "quotes" and ; a semicolon.\r\nThird line.'
        base["notes"] = tricky
        base["how_to_apply"] = 'Say "hi", then apply.'
        base["fields"] = ["health", "arts, crafts"]
        base["regions"] = ["oakland", "san-francisco"]
        base["max_age"] = None
        tmp, _ = build_into_temp([base])
        try:
            with open(os.path.join(tmp.name, "entries.csv"), encoding="utf-8", newline="") as f:
                rows = list(csv.DictReader(f))
        finally:
            tmp.cleanup()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["notes"], tricky)
        self.assertEqual(rows[0]["how_to_apply"], 'Say "hi", then apply.')
        self.assertEqual(rows[0]["fields"], "health; arts, crafts")
        self.assertEqual(rows[0]["regions"], "oakland; san-francisco")
        self.assertEqual(rows[0]["max_age"], "")

    def test_real_data_folder_untouched_by_temp_build(self):
        before = {n: os.path.getmtime(os.path.join(DATA_DIR, n)) for n in ("entries.json", "entries.csv", "meta.json")}
        tmp, _ = build_into_temp()
        tmp.cleanup()
        after = {n: os.path.getmtime(os.path.join(DATA_DIR, n)) for n in before}
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
