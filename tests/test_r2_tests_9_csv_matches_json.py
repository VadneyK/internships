"""data/entries.csv is a faithful export of data/entries.json.

Teachers and researchers download the csv. This checks, for every program, that the csv row has the
same id as the json entry at the same position, and that the csv cells for status, deadline_iso,
min_age, max_age, name, org, url and paid_type equal the json values after string conversion (a null
is an empty cell). It also checks the csv row order equals the json order, the header has no
duplicate column names, the file is valid utf-8 with no byte order mark, and it has no em dash or en dash.

The real files are only read, never written.
"""
import csv
import io
import json
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "entries.csv")
JSON_PATH = os.path.join(ROOT, "data", "entries.json")
CHECKED_COLUMNS = ["status", "deadline_iso", "min_age", "max_age", "name", "org", "url", "paid_type"]
DASHES = ("\u2014", "\u2013")  # em dash, en dash


def _cell(value):
    """The csv text for a json value: null is empty, anything else is its string form."""
    if value is None:
        return ""
    if isinstance(value, list):
        return "; ".join(str(v) for v in value)
    return str(value)


class CsvMatchesJsonTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(CSV_PATH, "rb") as f:
            cls.raw = f.read()
        with open(JSON_PATH, "rb") as f:
            cls.programs = json.loads(f.read().decode("utf-8"))
        cls.text = cls.raw.decode("utf-8")  # raises if the file is not valid utf-8
        cls.rows = list(csv.reader(io.StringIO(cls.text, newline="")))
        cls.header = cls.rows[0]
        cls.body = cls.rows[1:]

    def test_file_is_utf8_without_bom(self):
        self.assertFalse(self.raw.startswith(b"\xef\xbb\xbf"), "entries.csv starts with a byte order mark")
        self.raw.decode("utf-8")

    def test_no_dash_characters(self):
        for ch in DASHES:
            self.assertNotIn(ch, self.text, "entries.csv contains a dash character %r" % ch)

    def test_header_has_no_duplicate_columns(self):
        dupes = sorted({c for c in self.header if self.header.count(c) > 1})
        self.assertEqual(dupes, [], "entries.csv header repeats column names: %s" % dupes)

    def test_checked_columns_are_in_header(self):
        for col in ["id"] + CHECKED_COLUMNS:
            self.assertIn(col, self.header, "entries.csv has no %r column" % col)

    def test_row_count_and_order_match_json(self):
        self.assertEqual(len(self.body), len(self.programs), "csv row count differs from entries.json")
        id_col = self.header.index("id")
        csv_ids = [r[id_col] for r in self.body]
        json_ids = [p["id"] for p in self.programs]
        self.assertEqual(csv_ids, json_ids, "csv row order or ids differ from entries.json")

    def test_every_row_has_the_header_width(self):
        width = len(self.header)
        bad = [i for i, r in enumerate(self.body) if len(r) != width]
        self.assertEqual(bad, [], "csv rows with the wrong number of cells (row indexes): %s" % bad[:10])

    def test_checked_cells_equal_json_values(self):
        idx = {c: self.header.index(c) for c in CHECKED_COLUMNS}
        mismatches = []
        for row, prog in zip(self.body, self.programs):
            for col in CHECKED_COLUMNS:
                want = _cell(prog.get(col))
                got = row[idx[col]]
                if got != want:
                    mismatches.append((prog["id"], col, got, want))
        self.assertEqual(
            mismatches, [],
            "csv cells differ from entries.json (id, column, csv, json), first 10: %r" % mismatches[:10],
        )


if __name__ == "__main__":
    unittest.main()
