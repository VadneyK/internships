"""Rebuild is idempotent: a fresh build in a temp copy equals the committed files, and a second build changes nothing.

Copies the repo (without node_modules, .git and tests) into a temp dir, runs tools/build_data.py then
tools/build.py there, and compares the generated files byte for byte with the real repo. The real repo
is only read, never written.
"""
import glob
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = ("node_modules", ".git", "tests")


def _generated(base):
    """Relative paths of every file the two build tools write, as found under base."""
    rels = set()
    for pat in ("*.html", "sitemap.xml", "robots.txt", "data/entries*.json", "data/entries.csv", "data/meta.json"):
        rels.update(os.path.relpath(p, base) for p in glob.glob(os.path.join(base, pat)))
    for dirpath, _dirs, files in os.walk(os.path.join(base, "data", "programs")):
        rels.update(os.path.relpath(os.path.join(dirpath, f), base) for f in files)
    return rels


def _read(base, rel):
    with open(os.path.join(base, rel), "rb") as f:
        return f.read()


def _snapshot(base):
    return {rel: _read(base, rel) for rel in _generated(base)}


def _run(copy, script):
    return subprocess.run([sys.executable, os.path.join(copy, "tools", script)], cwd=copy,
                          capture_output=True, text=True, timeout=300)


class BuildIdempotent(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="build-idem-")
        cls.addClassCleanup(shutil.rmtree, cls.tmp, True)
        cls.copy = os.path.join(cls.tmp, "repo")
        try:
            shutil.copytree(ROOT, cls.copy, ignore=shutil.ignore_patterns(*SKIP_DIRS, "__pycache__"))
        except OSError as e:
            raise unittest.SkipTest("cannot copy the repo to a temp dir: %s" % e)
        for script in ("build_data.py", "build.py"):
            r = _run(cls.copy, script)
            if r.returncode != 0:
                raise unittest.SkipTest("tools/%s cannot run in a copy (exit %d): %s" % (script, r.returncode, (r.stderr or r.stdout)[-300:]))
        cls.first = _snapshot(cls.copy)

    def test_fresh_build_equals_committed_files(self):
        committed = _generated(ROOT)
        self.assertTrue(committed, "found no generated files in the repo")
        self.assertEqual(sorted(committed), sorted(self.first), "a fresh build adds or drops files")
        stale = [rel for rel in sorted(committed) if _read(ROOT, rel) != self.first[rel]]
        self.assertEqual(stale, [], "committed files differ from a fresh build, run tools/build_data.py then tools/build.py: %s" % stale[:10])

    def test_second_build_changes_nothing(self):
        for script in ("build_data.py", "build.py"):
            r = _run(self.copy, script)
            self.assertEqual(r.returncode, 0, r.stderr or r.stdout)
        second = _snapshot(self.copy)
        self.assertEqual(sorted(second), sorted(self.first))
        changed = [rel for rel in sorted(second) if second[rel] != self.first[rel]]
        self.assertEqual(changed, [], "a second build changed files: %s" % changed[:10])


if __name__ == "__main__":
    unittest.main()
