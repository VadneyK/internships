"""Duplicate-key and file-format guard for the top-level data/*.json files.

json.load and JSON.parse silently keep the last of two equal keys. The program
files under data/programs are guarded by test_r2_tests_10. This test covers the
hand-edited shared files directly under data/ (permits, interview, money,
parents, safety, younger, languages, employers, calendar, transit, gaps,
expiring-dates, meta, and the rest), so a pasted duplicate key cannot hide a
sourced rule.

For each file this checks:
- the file parses as UTF-8 with no byte order mark,
- the file ends with a newline,
- no object repeats a key, at any depth.

A failure names the file and the key path. The programs directory is skipped.

Run: python3 -m unittest tests.test_r3_tests_5_data_duplicate_keys -v
"""
import glob
import json
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DATA_DIR = os.path.join(ROOT, "data")
UTF8_BOM = b"\xef\xbb\xbf"


class DuplicateKeyError(ValueError):
    pass


def _make_hook(path_label):
    """Return an object_pairs_hook that raises on a repeated key, naming the path."""

    def hook(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise DuplicateKeyError("%s: repeated key %r" % (path_label, key))
            out[key] = value
        return out

    return hook


def _data_json_paths():
    """Every data/*.json file directly under data/ (not data/programs/)."""
    return sorted(glob.glob(os.path.join(DATA_DIR, "*.json")))


def check_text(file_name, raw_bytes):
    """Return a list of problem strings for one file's raw bytes."""
    problems = []
    if raw_bytes.startswith(UTF8_BOM):
        problems.append("%s: starts with a UTF-8 byte order mark" % file_name)
    if not raw_bytes.endswith(b"\n"):
        problems.append("%s: does not end with a newline" % file_name)
    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        return problems + ["%s: is not valid UTF-8: %s" % (file_name, exc)]
    try:
        json.loads(text, object_pairs_hook=_make_hook(file_name))
    except DuplicateKeyError as exc:
        problems.append(str(exc))
    except ValueError as exc:
        problems.append("%s: does not parse: %s" % (file_name, exc))
    return problems


def _check_path(file_name, path):
    with open(path, "rb") as fh:
        return check_text(file_name, fh.read())


class DataJsonDuplicateKeyTest(unittest.TestCase):
    def test_every_top_level_data_file_is_clean(self):
        paths = _data_json_paths()
        self.assertGreater(len(paths), 0, "no data/*.json files found")
        problems = []
        for path in paths:
            problems.extend(_check_path(os.path.basename(path), path))
        self.assertEqual(problems, [], "\n".join(problems[:50]))


class DataJsonDuplicateKeyDetectorTest(unittest.TestCase):
    """Negative controls: the detector must catch each rule on a bad input."""

    def test_clean_document_passes(self):
        raw = b'{"a": 1, "b": {"c": 2}}\n'
        self.assertEqual(check_text("sample.json", raw), [])

    def test_top_level_duplicate_is_caught(self):
        raw = b'{"a": 1, "a": 2}\n'
        out = check_text("sample.json", raw)
        self.assertTrue(any("repeated key 'a'" in p for p in out), out)

    def test_nested_duplicate_is_caught_with_file_name(self):
        raw = b'{"outer": {"inner": {"k": 1, "k": 2}}}\n'
        out = check_text("sample.json", raw)
        self.assertTrue(any("sample.json" in p and "repeated key 'k'" in p for p in out), out)

    def test_duplicate_inside_list_item_is_caught(self):
        raw = b'{"rows": [{"x": 1}, {"y": 1, "y": 2}]}\n'
        out = check_text("sample.json", raw)
        self.assertTrue(any("repeated key 'y'" in p for p in out), out)

    def test_missing_trailing_newline_is_caught(self):
        out = check_text("sample.json", b'{"a": 1}')
        self.assertTrue(any("does not end with a newline" in p for p in out), out)

    def test_byte_order_mark_is_caught(self):
        out = check_text("sample.json", UTF8_BOM + b'{"a": 1}\n')
        self.assertTrue(any("byte order mark" in p for p in out), out)

    def test_invalid_utf8_is_caught(self):
        out = check_text("sample.json", b'{"a": "\xff"}\n')
        self.assertTrue(any("not valid UTF-8" in p for p in out), out)


if __name__ == "__main__":
    unittest.main()
