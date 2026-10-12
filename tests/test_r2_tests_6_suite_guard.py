"""Suite meta guard: every test file can run in CI, none are silently skipped, and header run lines name real files.

Stdlib only. The guard scans every tests/*.mjs and tests/*.py file except itself. Each rule has a seeded-bad
fixture (written to a temp folder) that must make the rule fire, so a broken rule cannot pass unnoticed.
"""
import os
import re
import shutil
import tempfile
import unittest

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
THIS_FILE = os.path.basename(os.path.abspath(__file__))

# (test file name, test method name) -> reason. Each entry is a known gap that stays marked on purpose.
EXPECTED_FAILURES = {
    ("test_r3_tools.py", "test_parse_iso_bad_string_is_none"):
        "Known gap: proglib.parse_iso raises ValueError on a bad string instead of returning None. "
        "The fix lives in tools/proglib.py, outside the r2-tests-6 ticket.",
}

# Helper files that are allowed to sit in tests/ without the .test.mjs ending.
MJS_HELPERS = {"dom-helper.mjs", "r1-tests-1-tzworker.mjs"}

# Round files: r<round>-<area>-<number>, with an optional short label. Areas come from docs/TESTING.md.
# Any round digit counts (r4, r9, r10, ...), so rounds 4 and later get the same checks as rounds 1 to 3.
ROUND_PREFIX = re.compile(r"^r[1-9][0-9]*-")
ROUND_NAME = re.compile(
    r"^r[1-9][0-9]*-(?:a11y-perf|accuracy|data-content|docs-ops|handout|oc|perf-scale|ranking-ux|teen-flow|tests)"
    r"-\d+(?:-[a-z0-9]+)*\.(?:test\.)?mjs$"
)

# Older round files whose names do not follow the rule yet. Each one is kept on purpose until it is renamed.
# An entry fails the guard when its file is gone, or when the name now matches the rule (then remove the entry).
LEGACY_NAMES = {
    "r4-share.test.mjs":
        "Area 'share' is not in the docs/TESTING.md area list. Rename it to a listed area, or add the area to "
        "docs/TESTING.md and ROUND_NAME, then remove this entry.",
    "r4-states-1.test.mjs":
        "Area 'states' is not in the docs/TESTING.md area list. Rename it to a listed area, or add the area to "
        "docs/TESTING.md and ROUND_NAME, then remove this entry.",
    "r4-tiles.test.mjs":
        "Area 'tiles' is not in the docs/TESTING.md area list. Rename it to a listed area, or add the area to "
        "docs/TESTING.md and ROUND_NAME, then remove this entry.",
}

TEST_CALL = re.compile(r"(?<![\w.$])test\s*\(")
RUN_WITH = "Run with"
NODE_TEST_TARGET = re.compile(r"node --test\s+tests/([^\s`'\"()]+)")
EXPECTED_FAILURE = re.compile(r"@unittest\.expectedFailure\b")
DEF_NAME = re.compile(r"^\s*def\s+(\w+)\s*\(", re.M)

# Markers that let a test silently not run (or be allowed to fail).
FORBIDDEN_MARKERS = [
    re.compile(r"\b(?:test|describe|it|suite)\.(?:only|skip|todo)\b"),
    re.compile(r"[{,(]\s*(?:skip|todo)\s*:"),
    re.compile(r"\bunittest\.(?:skip|skipIf|skipUnless)\b"),
    re.compile(r"\bself\.skipTest\("),
]


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _test_files(directory):
    names = []
    for name in sorted(os.listdir(directory)):
        if name == THIS_FILE:
            continue
        if not os.path.isfile(os.path.join(directory, name)):
            continue
        if name.endswith(".mjs") or name.endswith(".py"):
            names.append(name)
    return names


def check_dir(directory, expected_failures=None, legacy_names=None):
    """Return a list of (rule, file name, detail) tuples. An empty list means the folder passes."""
    if expected_failures is None:
        expected_failures = EXPECTED_FAILURES
    if legacy_names is None:
        legacy_names = LEGACY_NAMES
    names = _test_files(directory)
    texts = {name: _read(os.path.join(directory, name)) for name in names}
    problems = []

    for name, _reason in legacy_names.items():
        if name not in names:
            problems.append(("legacy-stale", name, "listed in LEGACY_NAMES but the file does not exist"))
        elif ROUND_NAME.match(name) or not ROUND_PREFIX.match(name):
            problems.append(("legacy-stale", name, "listed in LEGACY_NAMES but it now matches the rule (remove the entry)"))

    for name in names:
        text = texts[name]

        if name.endswith(".mjs"):
            if name not in MJS_HELPERS and not name.endswith(".test.mjs"):
                problems.append(("mjs-name", name, "not dom-helper.mjs, not the tzworker, and not *.test.mjs"))
            if name.endswith(".test.mjs") and not TEST_CALL.search(text):
                problems.append(("no-test-call", name, "a .test.mjs file has no test( call"))
        elif not name.startswith("test_"):
            problems.append(("py-name", name, "a tests/*.py file must start with test_"))

        if ROUND_PREFIX.match(name) and not ROUND_NAME.match(name) and name not in legacy_names:
            problems.append(("round-name", name, "does not match r<round>-<area>-<number>[-label].test.mjs"))

        for marker in FORBIDDEN_MARKERS:
            for match in marker.finditer(text):
                line_no = text.count("\n", 0, match.start()) + 1
                problems.append(("forbidden-marker", name, "line %d: %s" % (line_no, match.group(0))))

        header = "\n".join(text.splitlines()[:12])
        if RUN_WITH in header:
            for match in NODE_TEST_TARGET.finditer(header):
                target = match.group(1).rstrip(".,;:")
                if any(ch in target for ch in "*?["):
                    continue
                if not os.path.isfile(os.path.join(directory, target)):
                    problems.append(("run-line", name, "header names tests/%s, which does not exist" % target))

        for match in EXPECTED_FAILURE.finditer(text):
            after = DEF_NAME.search(text, match.end())
            method = after.group(1) if after else "?"
            key = (name, method)
            if key not in expected_failures:
                problems.append(("expected-failure", name, "@unittest.expectedFailure on %s is not allowlisted" % method))

    return problems


def _rules(problems):
    return {rule for rule, _name, _detail in problems}


def _check_fixture(files, expected_failures=None, legacy_names=None):
    folder = tempfile.mkdtemp(prefix="suite-guard-")
    try:
        for name, text in files.items():
            with open(os.path.join(folder, name), "w", encoding="utf-8") as f:
                f.write(text)
        # Fixtures get no legacy list unless the test passes one, so the real LEGACY_NAMES do not leak in.
        return check_dir(folder, expected_failures, {} if legacy_names is None else legacy_names)
    finally:
        shutil.rmtree(folder, ignore_errors=True)


CLEAN = {
    "dom-helper.mjs": "export const helper = 1;\n",
    "r1-tests-1-tzworker.mjs": "// worker, not a test file\n",
    "lib.test.mjs": "import test from \"node:test\";\n// Run with: node --test tests/lib.test.mjs\ntest(\"a\", () => {});\n",
    "r5-teen-flow-9.test.mjs": "import test from \"node:test\";\ntest(\"a\", () => {});\n",
    "test_ok.py": "import unittest\n\n\nclass T(unittest.TestCase):\n    def test_a(self):\n        pass\n",
}


class SuiteGuardTests(unittest.TestCase):
    def test_repo_suite_has_no_violations(self):
        names = _test_files(TESTS_DIR)
        self.assertTrue(any(n.endswith(".test.mjs") for n in names), "the guard found no .test.mjs files")
        self.assertTrue(any(n.startswith("test_") and n.endswith(".py") for n in names), "the guard found no test_*.py files")
        problems = check_dir(TESTS_DIR)
        self.assertEqual([], problems, "suite guard violations: %r" % (problems,))

    def test_allowlist_entries_have_reasons(self):
        for key, reason in EXPECTED_FAILURES.items():
            with self.subTest(key=key):
                self.assertTrue(reason.strip(), "allowlist entry %r needs a reason" % (key,))

    def test_clean_fixture_passes(self):
        self.assertEqual([], _check_fixture(CLEAN))

    def test_mjs_name_rule_fires(self):
        problems = _check_fixture(dict(CLEAN, **{"helper.mjs": "export const x = 1;\n"}))
        self.assertIn("mjs-name", _rules(problems))

    def test_py_name_rule_fires(self):
        problems = _check_fixture(dict(CLEAN, **{"check_things.py": "x = 1\n"}))
        self.assertIn("py-name", _rules(problems))

    def test_no_test_call_rule_fires(self):
        problems = _check_fixture(dict(CLEAN, **{"empty.test.mjs": "// nothing here\n"}))
        self.assertIn("no-test-call", _rules(problems))

    def test_forbidden_marker_rule_fires_for_each_marker(self):
        bad = {
            "only_test.test.mjs": "test.only(\"x\", () => {});\n",
            "only_it.test.mjs": "it.only(\"x\", () => {});\n",
            "only_describe.test.mjs": "describe.only(\"x\", () => {});\n",
            "skip_call.test.mjs": "test.skip(\"x\", () => {});\n",
            "todo_call.test.mjs": "test.todo(\"x\");\n",
            "skip_option.test.mjs": "test(\"x\", { skip: true }, () => {});\n",
            "todo_option.test.mjs": "test(\"x\", { todo: \"later\" }, () => {});\n",
            "test_skip_dec.py": "import unittest\n\n\n@unittest.skip(\"x\")\ndef test_a():\n    pass\n",
            "test_skipif_dec.py": "import unittest\n\n\n@unittest.skipIf(True, \"x\")\ndef test_a():\n    pass\n",
            "test_skip_runtime.py": "import unittest\n\n\ndef test_a(self):\n    self.skipTest(\"x\")\n",
        }
        for name, text in bad.items():
            with self.subTest(file=name):
                problems = _check_fixture(dict(CLEAN, **{name: text}))
                self.assertIn("forbidden-marker", _rules(problems))

    def test_forbidden_marker_ignores_plain_selectors(self):
        # a.skip is a CSS class name in the page tests, not a test skip.
        ok = {"page.test.mjs": "import test from \"node:test\";\ntest(\"a\", () => { const s = 'a.skip'; });\n"}
        self.assertEqual([], _check_fixture(dict(CLEAN, **ok)))

    def test_expected_failure_rule_fires_when_not_allowlisted(self):
        text = (
            "import unittest\n\n\nclass T(unittest.TestCase):\n"
            "    @unittest.expectedFailure\n"
            "    def test_new_gap(self):\n"
            "        self.fail()\n"
        )
        problems = _check_fixture(dict(CLEAN, **{"test_new.py": text}))
        self.assertIn("expected-failure", _rules(problems))

    def test_expected_failure_allowlisted_entry_passes(self):
        text = (
            "import unittest\n\n\nclass T(unittest.TestCase):\n"
            "    @unittest.expectedFailure\n"
            "    def test_parse_iso_bad_string_is_none(self):\n"
            "        self.assertIsNone(None)\n"
        )
        allow = {("test_r3_tools.py", "test_parse_iso_bad_string_is_none"): "seeded reason"}
        problems = _check_fixture(dict(CLEAN, **{"test_r3_tools.py": text}), allow)
        self.assertNotIn("expected-failure", _rules(problems))

    def test_run_line_rule_fires_for_missing_file(self):
        text = "// Run with: node --test tests/gone.test.mjs\ntest(\"a\", () => {});\n"
        problems = _check_fixture(dict(CLEAN, **{"header.test.mjs": text}))
        self.assertIn("run-line", _rules(problems))

    def test_run_line_rule_accepts_real_file_and_glob(self):
        good = "// Run with: node --test tests/header.test.mjs\ntest(\"a\", () => {});\n"
        glob = "// Run with: node --test tests/*.test.mjs\ntest(\"a\", () => {});\n"
        problems = _check_fixture(dict(CLEAN, **{"header.test.mjs": good, "glob.test.mjs": glob}))
        self.assertNotIn("run-line", _rules(problems))

    def test_round_name_rule_fires_for_bad_names(self):
        for name in [
            "r2-bogus-1.test.mjs", "r1-accuracy-missing.test.mjs", "r3-teen-flow.test.mjs", "r5-nope-4.test.mjs",
            "r7-nonsense.test.mjs", "r9-share-1.test.mjs", "r10-nope-2.test.mjs",
        ]:
            with self.subTest(file=name):
                problems = _check_fixture(dict(CLEAN, **{name: "test(\"a\", () => {});\n"}))
                self.assertIn("round-name", _rules(problems))

    def test_round_name_rule_accepts_label_and_ignores_other_prefixes(self):
        ok = {
            "r1-tests-2-ics-fold.test.mjs": "test(\"a\", () => {});\n",
            "r4-accuracy-1-checked-claim.test.mjs": "test(\"a\", () => {});\n",
            "r9-teen-flow-1-404-links.test.mjs": "test(\"a\", () => {});\n",
            "rev-accuracy-1-hours-checker.test.mjs": "test(\"a\", () => {});\n",
        }
        problems = _check_fixture(dict(CLEAN, **ok))
        self.assertNotIn("round-name", _rules(problems))

    def test_round_rule_fires_for_round_nine_bad_fixture_and_passes_good_one(self):
        bad = _check_fixture(dict(CLEAN, **{"r7-nonsense.test.mjs": "test(\"a\", () => {});\n"}))
        self.assertIn("round-name", _rules(bad))
        good = _check_fixture(dict(CLEAN, **{"r9-teen-flow-9-good-label.test.mjs": "test(\"a\", () => {});\n"}))
        self.assertEqual([], good)

    def test_legacy_names_are_grandfathered_only_while_listed(self):
        text = "test(\"a\", () => {});\n"
        legacy = {"r4-share.test.mjs": "seeded reason"}
        problems = _check_fixture(dict(CLEAN, **{"r4-share.test.mjs": text}), None, legacy)
        self.assertEqual([], problems)
        unlisted = _check_fixture(dict(CLEAN, **{"r4-share.test.mjs": text}))
        self.assertIn("round-name", _rules(unlisted))

    def test_legacy_entry_fails_when_file_is_missing(self):
        problems = _check_fixture(CLEAN, None, {"r4-gone.test.mjs": "seeded reason"})
        self.assertIn("legacy-stale", _rules(problems))

    def test_legacy_entry_fails_when_name_now_matches_rule(self):
        files = dict(CLEAN, **{"r9-teen-flow-1-404-links.test.mjs": "test(\"a\", () => {});\n"})
        problems = _check_fixture(files, None, {"r9-teen-flow-1-404-links.test.mjs": "seeded reason"})
        self.assertIn("legacy-stale", _rules(problems))

    def test_legacy_names_have_reasons_and_exact_members(self):
        for name, reason in LEGACY_NAMES.items():
            with self.subTest(file=name):
                self.assertTrue(reason.strip(), "legacy entry %r needs a reason" % (name,))
        self.assertEqual(
            {"r4-share.test.mjs", "r4-states-1.test.mjs", "r4-tiles.test.mjs"},
            set(LEGACY_NAMES),
        )


if __name__ == "__main__":
    unittest.main()
