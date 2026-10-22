"""Edge-case tests for tools/freshness.py, tools/hygiene.py and tools/make_qr.py.

Synthetic data and temp directories only. Nothing is written under data/ or assets/.
"""
import contextlib
import datetime as dt
import hashlib
import io
import os
import runpy
import shutil
import sys
import tempfile
import types
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
sys.path.insert(0, TOOLS)

import freshness  # noqa: E402
import hygiene  # noqa: E402
import proglib  # noqa: E402

TODAY = dt.date(2027, 2, 15)
CAP = 120  # the default --days value in tools/freshness.py


def program(**over):
    d = {
        "id": "edge-program",
        "name": "Edge Program",
        "regions": ["oakland"],
        "status": "rolling",
        "verified": "fetched",
        "verified_on": (TODAY - dt.timedelta(days=CAP)).isoformat(),
        "deadline_iso": None,
        "opens_iso": None,
        "url": "https://example.org/edge",
    }
    d.update(over)
    return d


def reasons_for(d, days=CAP):
    return freshness.needs_refresh(d, TODAY, days)


class FreshnessCapBoundary(unittest.TestCase):
    def test_exactly_at_cap_is_not_flagged_for_age(self):
        reasons = reasons_for(program(verified_on=(TODAY - dt.timedelta(days=CAP)).isoformat()))
        self.assertEqual(reasons, [])

    def test_one_day_over_cap_is_flagged(self):
        reasons = reasons_for(program(verified_on=(TODAY - dt.timedelta(days=CAP + 1)).isoformat()))
        self.assertEqual(reasons, ["last verified %d days ago" % (CAP + 1)])

    def test_cap_is_read_from_days_argument(self):
        d = program(verified_on=(TODAY - dt.timedelta(days=30)).isoformat())
        self.assertEqual(reasons_for(d, days=30), [])
        self.assertEqual(reasons_for(d, days=29), ["last verified 30 days ago"])

    def test_verified_today_is_not_flagged(self):
        self.assertEqual(reasons_for(program(verified_on=TODAY.isoformat())), [])


class FreshnessMissingOrBadDate(unittest.TestCase):
    def test_missing_verified_on_is_reported_not_raised(self):
        # A program with no verified_on is reported as a reason, not raised as a KeyError.
        d = program()
        del d["verified_on"]
        reasons = reasons_for(d)
        self.assertTrue(any("verified" in r for r in reasons))

    def test_malformed_verified_on_is_reported_not_raised(self):
        # An unparseable verified_on is reported as a reason, not raised as a ValueError.
        reasons = reasons_for(program(verified_on="2026-13-40"))
        self.assertTrue(any("verified" in r for r in reasons))


class HygieneEmptyData(unittest.TestCase):
    def run_main(self, *argv):
        out = io.StringIO()
        with mock.patch.object(proglib, "load_programs", return_value=[]), \
                mock.patch.object(sys, "argv", ["hygiene.py", *argv]), \
                contextlib.redirect_stdout(out):
            code = hygiene.main(list(argv))
        return code, out.getvalue()

    def test_empty_data_exits_zero_with_empty_checklist(self):
        code, text = self.run_main()
        self.assertEqual(code, 0)
        self.assertIn("# Data hygiene report", text)
        self.assertIn("0 programs have a soft data problem", text)
        self.assertEqual([ln for ln in text.splitlines() if ln.startswith("- [ ] ")], [])

    def test_empty_data_writes_empty_checklist_to_out(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp, True)
        out_path = os.path.join(tmp, "hygiene.md")
        code, _ = self.run_main("--out", out_path)
        self.assertEqual(code, 0)
        with open(out_path, encoding="utf-8") as f:
            text = f.read()
        self.assertIn("0 programs", text)
        self.assertNotIn("- [ ] ", text)


class MakeQrDeterminism(unittest.TestCase):
    """make_qr.py has no input and no empty-input branch, so only its output is tested here.

    segno is not a stdlib package, so a fake module stands in for it. The fake writes the
    text it was given, which lets the test check the script's own inputs (links, file names,
    titles) and that two runs give the same bytes.
    """

    def run_script_into(self, dest_root):
        # Copy the script into a temp tools/ folder so its output path lands in the temp dir.
        tools_dir = os.path.join(dest_root, "tools")
        os.makedirs(tools_dir)
        shutil.copy(os.path.join(TOOLS, "make_qr.py"), os.path.join(tools_dir, "make_qr.py"))

        written = {}

        class FakeCode:
            def __init__(self, text):
                self.text = text

            def save(self, path, **kw):
                payload = repr((self.text, sorted(kw.items()))).encode("utf-8")
                written[os.path.basename(path)] = payload
                with open(path, "wb") as f:
                    f.write(payload)

        fake = types.ModuleType("segno")
        fake.make = lambda text, error=None: FakeCode(text)
        out = io.StringIO()
        with mock.patch.dict(sys.modules, {"segno": fake}), contextlib.redirect_stdout(out):
            runpy.run_path(os.path.join(tools_dir, "make_qr.py"), run_name="__main__")
        return os.path.join(dest_root, "assets", "qr"), written

    def test_two_runs_give_identical_bytes(self):
        first_root = tempfile.mkdtemp()
        second_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, first_root, True)
        self.addCleanup(shutil.rmtree, second_root, True)
        out1, _ = self.run_script_into(first_root)
        out2, _ = self.run_script_into(second_root)
        names1 = sorted(os.listdir(out1))
        self.assertEqual(names1, sorted(os.listdir(out2)))
        self.assertEqual(len(names1), 11)
        for name in names1:
            with open(os.path.join(out1, name), "rb") as f1, open(os.path.join(out2, name), "rb") as f2:
                self.assertEqual(hashlib.sha256(f1.read()).hexdigest(), hashlib.sha256(f2.read()).hexdigest(), name)

    def test_generated_links_are_plain_ascii(self):
        root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, root, True)
        _, written = self.run_script_into(root)
        self.assertIn("home.svg", written)
        self.assertIn("https://vadneyk.github.io/internships/".encode("utf-8"), written["home.svg"])
        for name, payload in written.items():
            payload.decode("ascii")  # every generated link is plain ASCII


if __name__ == "__main__":
    unittest.main()
