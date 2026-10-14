"""JSON schemas for the hand-edited data files (permits, states-lite, state-wages, employers).

The real files must pass tools/validate.py schema_problems(), and small broken copies must fail with a
line that names the file, the place and the problem. Fixtures are copies of the real files written to a
temp folder, so the tests run offline.

Run: python3 -m unittest tests.test_r3_tests_3_data_file_schemas -v
"""
import copy
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))

import validate  # noqa: E402

REAL = dict(validate.SCHEMA_FILES)


def load(name):
    with open(REAL[name], encoding="utf-8") as f:
        return json.load(f)


class DataSchemaTests(unittest.TestCase):
    def check(self, name, data):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = os.path.join(tmp.name, name + ".json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        return [p for p in validate.schema_problems({name: path}) if p.startswith(name + ":")]

    def assertProblem(self, found, *parts):
        self.assertTrue(any(all(p in line for p in parts) for line in found), "no line with %r in %r" % (parts, found))

    def test_real_files_pass(self):
        self.assertEqual(validate.schema_problems(), [])

    def test_schema_files_exist_and_are_2020_12(self):
        for name in REAL:
            with open(os.path.join(validate.SCHEMA_DIR, name + ".schema.json"), encoding="utf-8") as f:
                self.assertEqual(json.load(f)["$schema"], "https://json-schema.org/draft/2020-12/schema")

    def test_missing_required_field_fails(self):
        for name, getrow in (
            ("permits", lambda d: d["states"]["ca"]),
            ("states-lite", lambda d: d["states"][0]),
            ("state-wages", lambda d: d["states"][0]),
            ("employers", lambda d: d["employers"][0]),
        ):
            with self.subTest(file=name):
                data = copy.deepcopy(load(name))
                row = getrow(data)
                del row["url" if "url" in row else "issuer"]
                found = self.check(name, data)
                self.assertProblem(found, name + ":", "is a required property")

    def test_http_url_fails(self):
        for name, getrow in (
            ("states-lite", lambda d: d["states"][0]),
            ("state-wages", lambda d: d["states"][0]),
            ("employers", lambda d: d["employers"][0]),
        ):
            with self.subTest(file=name):
                data = copy.deepcopy(load(name))
                getrow(data)["url"] = "http://example.org/page"
                self.assertProblem(self.check(name, data), name + ":", ".url:", "does not match")
        data = copy.deepcopy(load("permits"))
        data["states"]["ca"]["links"][0]["u"] = "http://example.org/page"
        self.assertProblem(self.check("permits", data), "permits:", "links.0.u", "does not match")

    def test_wrong_type_fails(self):
        data = copy.deepcopy(load("employers"))
        data["employers"][0]["min_age"] = "14"
        self.assertProblem(self.check("employers", data), "employers:", "employers.0.min_age", "is not of type 'integer'")
        data = copy.deepcopy(load("permits"))
        data["states"]["ca"]["needBelow"] = "18"
        self.assertProblem(self.check("permits", data), "permits:", "states.ca.needBelow", "is not of type 'integer'")
        data = copy.deepcopy(load("state-wages"))
        data["states"][0]["below_federal"] = "yes"
        self.assertProblem(self.check("state-wages", data), "state-wages:", "below_federal", "is not of type 'boolean'")

    def test_unknown_field_fails(self):
        data = copy.deepcopy(load("states-lite"))
        data["states"][0]["surprise"] = "x"
        self.assertProblem(self.check("states-lite", data), "states-lite:", "surprise")

    def test_employer_group_must_be_in_groups_list(self):
        data = copy.deepcopy(load("employers"))
        data["employers"][0]["group"] = "nope"
        found = self.check("employers", data)
        self.assertProblem(found, "employers:", "employers.0.group")
        data = copy.deepcopy(load("employers"))
        data["groups"] = [g for g in data["groups"] if g[0] != data["employers"][0]["group"]]
        self.assertProblem(self.check("employers", data), "employers.0.group", "groups list")

    def test_unreadable_file_is_one_line(self):
        found = validate.schema_problems({"permits": os.path.join(HERE, "no-such-file.json")})
        self.assertProblem(found, "permits: cannot read no-such-file.json")


if __name__ == "__main__":
    unittest.main()
