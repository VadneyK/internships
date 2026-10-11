"""Hygiene sweep over every data/programs/*.json file.

For each program file this checks:
- the file parses with no repeated key (json.load would silently keep the last
  copy, which drops data),
- the file name (without .json) equals the card's "id",
- every key is a property in data/schema/program.schema.json,
- no key and no string value has leading or trailing whitespace, and no
  string value has a double space.

A failure names the file, the id and the key or value involved.

Run: python3 -m unittest tests.test_r2_tests_10_program_file_hygiene -v
"""
import glob
import json
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
PROGRAMS_DIR = os.path.join(ROOT, "data", "programs")
SCHEMA_PATH = os.path.join(ROOT, "data", "schema", "program.schema.json")


class DuplicateKeyError(ValueError):
    pass


def _no_duplicate_keys(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise DuplicateKeyError("repeated key %r" % key)
        out[key] = value
    return out


def _load_schema_properties():
    with open(SCHEMA_PATH, encoding="utf-8") as fh:
        schema = json.load(fh)
    return set(schema["properties"].keys())


def _walk_strings(value, path="$"):
    """Yield (path, string) for every string value under value."""
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from _walk_strings(v, path + "." + k)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            yield from _walk_strings(v, "%s[%d]" % (path, i))


def check_program_data(file_name, data, schema_props):
    """Return a list of problem strings for one parsed program card."""
    problems = []
    stem = file_name[: -len(".json")] if file_name.endswith(".json") else file_name
    card_id = data.get("id") if isinstance(data, dict) else None
    label = "%s (id %r)" % (file_name, card_id)

    if not isinstance(data, dict):
        return [label + ": top level is not an object"]

    if card_id != stem:
        problems.append("%s: file name must equal id, got id %r" % (file_name, card_id))

    for key in data.keys():
        if key != key.strip():
            problems.append("%s: key %r has leading or trailing space" % (label, key))
        if key not in schema_props:
            problems.append("%s: key %r is not in program.schema.json properties" % (label, key))

    for path, text in _walk_strings(data):
        if text != text.strip():
            problems.append("%s: value at %s has leading or trailing whitespace" % (label, path))
        if "  " in text:
            problems.append("%s: value at %s has a double space" % (label, path))

    return problems


def check_file(path, schema_props):
    """Parse one program file with the duplicate-key hook and return its problems."""
    file_name = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh, object_pairs_hook=_no_duplicate_keys)
    except DuplicateKeyError as exc:
        return ["%s: %s" % (file_name, exc)]
    except ValueError as exc:
        return ["%s: does not parse: %s" % (file_name, exc)]
    return check_program_data(file_name, data, schema_props)


class ProgramFileHygieneTest(unittest.TestCase):
    def test_every_program_file_is_clean(self):
        paths = sorted(glob.glob(os.path.join(PROGRAMS_DIR, "*.json")))
        self.assertGreater(len(paths), 0, "no program files found")
        schema_props = _load_schema_properties()
        problems = []
        for path in paths:
            problems.extend(check_file(path, schema_props))
        self.assertEqual(problems, [], "\n".join(problems[:50]))


class ProgramFileHygieneDetectorTest(unittest.TestCase):
    """Negative controls: the detector must catch each rule on a bad input."""

    def setUp(self):
        self.props = _load_schema_properties()
        self.good = {"id": "sample-program", "name": "Sample", "min_age": 14}

    def test_clean_card_passes(self):
        self.assertEqual(check_program_data("sample-program.json", self.good, self.props), [])

    def test_name_mismatch_is_caught(self):
        out = check_program_data("other-name.json", self.good, self.props)
        self.assertTrue(any("file name must equal id" in p for p in out), out)

    def test_unknown_key_is_caught(self):
        bad = dict(self.good, not_a_field="x")
        out = check_program_data("sample-program.json", bad, self.props)
        self.assertTrue(any("'not_a_field'" in p for p in out), out)

    def test_key_padding_is_caught(self):
        bad = dict(self.good, **{" name": "Sample"})
        out = check_program_data("sample-program.json", bad, self.props)
        self.assertTrue(any("leading or trailing space" in p for p in out), out)

    def test_value_padding_is_caught(self):
        bad = dict(self.good, name=" Sample ")
        out = check_program_data("sample-program.json", bad, self.props)
        self.assertTrue(any("leading or trailing whitespace" in p for p in out), out)

    def test_double_space_is_caught(self):
        bad = dict(self.good, name="Sample  Name")
        out = check_program_data("sample-program.json", bad, self.props)
        self.assertTrue(any("double space" in p for p in out), out)

    def test_nested_double_space_is_caught(self):
        bad = dict(self.good, regions=["davis", "sac  ramento"])
        out = check_program_data("sample-program.json", bad, self.props)
        self.assertTrue(any("regions[1]" in p and "double space" in p for p in out), out)

    def test_repeated_key_is_caught(self):
        raw = '{"id": "sample-program", "name": "A", "name": "B"}'
        with self.assertRaises(DuplicateKeyError):
            json.loads(raw, object_pairs_hook=_no_duplicate_keys)


if __name__ == "__main__":
    unittest.main()
