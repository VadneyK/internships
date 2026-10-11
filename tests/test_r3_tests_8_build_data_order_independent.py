"""build_data output must not depend on file order or the OS locale.

CI fails a PR when the built data differs from what is committed, so a result
that changes with os.listdir order or with the locale (a Mac versus the Ubuntu
runner) would only show up after the push. This runs the real build_data.main()
on a 60 file sample in a temp dir, in several file orders and locales, and
checks every output file is byte for byte the same.

Entries are sorted by one key: the program id, compared by code point.
Nothing is written to the repo data folder.
"""
import contextlib
import csv
import glob
import io
import json
import locale
import os
import random
import shutil
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import build_data  # noqa: E402
import proglib  # noqa: E402

OUTPUTS = (
    "entries.json", "entries.csv", "meta.json", "entries-lite.json", "entries-core.json",
    "entries-cal.json", "entries-stats.json", "entries-home.json", "entries-detail.json",
)


def sample_files():
    """First 40 real files by sorted name, then 18 real ones spread across the rest."""
    real = sorted(
        p for p in glob.glob(os.path.join(proglib.PROGRAMS_DIR, "*.json"))
        if not os.path.basename(p).startswith("_")
    )
    rest = real[40:]
    step = max(1, len(rest) // 18)
    return real[:40] + rest[::step][:18]


def make_sample(tmp):
    """Copy the sample into tmp/programs. Add 2 made-up copies whose ids have an
    accent or mixed case: the real data has neither, and those are the ids a
    locale-aware sort would order differently from a code point sort."""
    src = os.path.join(tmp, "programs")
    os.makedirs(src)
    paths = []
    for p in sample_files():
        dest = os.path.join(src, os.path.basename(p))
        shutil.copyfile(p, dest)
        paths.append(dest)
    with open(paths[0], encoding="utf-8") as f:
        base = json.load(f)
    for new_id in ("Éclair-probe", "alpha-MIXED-probe"):
        d = dict(base)
        d["id"] = new_id
        d["name"] = new_id
        dest = os.path.join(src, new_id + ".json")
        with open(dest, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False)
        paths.append(dest)
    return paths


def available_locale(names):
    old = locale.setlocale(locale.LC_ALL)
    try:
        for n in names:
            try:
                locale.setlocale(locale.LC_ALL, n)
                return n
            except locale.Error:
                continue
    finally:
        locale.setlocale(locale.LC_ALL, old)
    return None


class BuildDataOrderIndependent(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="bd-order-")
        cls.paths = make_sample(cls.tmp)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def build(self, ordered_paths, loc, tag):
        """Run build_data.main() with the given file order and locale; return {file: bytes}."""
        out = os.path.join(self.tmp, "out-" + tag)
        os.makedirs(out)

        def load_programs(directory=None):
            res = []
            for p in ordered_paths:
                with open(p, encoding="utf-8") as f:
                    res.append((p, json.load(f)))
            return res

        old_loc = locale.setlocale(locale.LC_ALL)
        old = (build_data.OUT_DIR, proglib.load_programs)
        env_old = {k: os.environ.get(k) for k in ("LC_ALL", "LANG")}
        try:
            if loc:
                locale.setlocale(locale.LC_ALL, loc)
                os.environ["LC_ALL"] = loc
            build_data.OUT_DIR = out
            proglib.load_programs = load_programs
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(build_data.main(), 0)
        finally:
            build_data.OUT_DIR, proglib.load_programs = old
            locale.setlocale(locale.LC_ALL, old_loc)
            for k, v in env_old.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
        result = {}
        for name in OUTPUTS:
            with open(os.path.join(out, name), "rb") as f:
                result[name] = f.read()
        return result

    def test_sample_size(self):
        self.assertEqual(len(self.paths), 60)

    def test_same_bytes_in_every_order_and_locale(self):
        sorted_paths = sorted(self.paths)
        shuffled = list(sorted_paths)
        random.Random(20261010).shuffle(shuffled)
        self.assertNotEqual(shuffled, sorted_paths)
        orders = {"sorted": sorted_paths, "reversed": sorted_paths[::-1], "shuffled": shuffled}
        locales = {"default": None, "C": "C"}
        us = available_locale(["en_US.UTF-8", "en_US.utf8"])
        if us:
            locales["en_US"] = us
        baseline = self.build(sorted_paths, None, "baseline")
        for oname, order in orders.items():
            for lname, loc in locales.items():
                with self.subTest(order=oname, locale=lname):
                    got = self.build(order, loc, oname + "-" + lname)
                    for name in OUTPUTS:
                        self.assertEqual(got[name], baseline[name], name)

    def test_real_loader_ignores_directory_listing_order(self):
        """The real proglib.load_programs sorts by name, so a shuffled glob result gives the same list."""
        src = os.path.join(self.tmp, "programs")
        want = [os.path.basename(p) for p, _ in proglib.load_programs(src)]
        names = glob.glob(os.path.join(src, "*.json"))
        random.Random(7).shuffle(names)
        real_glob = glob.glob
        glob.glob = lambda pattern, *a, **k: list(names)
        try:
            got = [os.path.basename(p) for p, _ in proglib.load_programs(src)]
        finally:
            glob.glob = real_glob
        self.assertEqual(got, want)
        self.assertEqual(got, sorted(got))

    def test_entries_sorted_by_id_and_ids_unique(self):
        out = self.build(self.paths[::-1], "C", "sortcheck")
        ids = [e["id"] for e in json.loads(out["entries.json"].decode("utf-8"))]
        self.assertEqual(len(ids), 60)
        self.assertEqual(len(set(ids)), len(ids), "ids must be unique")
        self.assertEqual(ids, sorted(ids), "entries are sorted by id, by code point")
        for name in ("entries-lite.json", "entries-core.json", "entries-stats.json", "entries-home.json", "entries-detail.json"):
            other = [e["id"] for e in json.loads(out[name].decode("utf-8"))]
            self.assertEqual(other, ids, name)
        rows = list(csv.reader(io.StringIO(out["entries.csv"].decode("utf-8"), newline="")))
        self.assertEqual([r[0] for r in rows[1:]], ids)
        self.assertEqual(json.loads(out["meta.json"].decode("utf-8"))["count"], 60)


if __name__ == "__main__":
    unittest.main()
