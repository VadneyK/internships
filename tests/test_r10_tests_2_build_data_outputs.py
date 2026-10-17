"""2026-10-16: tools/build_data.py run on four made-up cards into a temporary folder, with every output file checked.

A mutation run of build_data.py found that a key could be dropped from most of the small files (entries-core,
entries-map, entries-home, the lite and detail chunks) and no test noticed. The pages filter by age, status and
place from those files, so a missing min_age or deadline_iso would quietly show a teen the wrong programs.
Run with: python3 -m unittest tests.test_r10_tests_2_build_data_outputs
"""
import contextlib
import csv
import io
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import build_data  # noqa: E402
import proglib  # noqa: E402

with open(os.path.join(ROOT, "data", "calendar.json"), encoding="utf-8") as _f:
    CAL_ID = json.load(_f)["items"][0]["id"]
GROUPS = build_data.pick_groups()
G1, G2 = GROUPS[0], GROUPS[1]
R1, R2 = sorted(G1[2])[0], sorted(G2[2])[0]


def full_card(id_, **over):
    d = {
        "id": id_, "name": "Name " + id_, "org": "Org " + id_, "city": "Town", "url": "https://example.org/" + id_,
        "apply_url": None, "paid_type": "paid", "pay_detail": "$15 an hour", "type": "internship", "fields": ["health"],
        "grades": "9 to 12", "needs_work_permit": True, "verified": "fetched", "verified_on": "2026-10-01", "priority": 2,
        "deadline_confidence": "confirmed-2026-27", "min_age": 14, "max_age": 18, "status": "open-now",
        "deadline_iso": "2026-12-01", "deadline_text": "Apply by Dec 1, 2026.", "opens_iso": "2026-09-01", "regions": [R1],
        "season": "summer", "duration": "6 weeks", "who_can_apply": "Teens age 14 to 18.", "what_you_do": "Help out.",
        "how_to_apply": "Apply on the official page.", "notes": "A note.", "sources_fetched": ["https://example.org/" + id_],
    }
    d.update(over)
    return d


CARDS = [
    full_card("b-full"),
    full_card("a-sparse", name="Zed Club", min_age=None, max_age=None, deadline_iso=None, opens_iso=None, status="rolling",
              deadline_confidence="last-year-pattern", verified="snippet-only", verified_on="2026-10-05", regions=[R1, R2],
              who_can_apply="Girls in grades 9 to 12.", pay_detail=None, duration=None),
    full_card("c-online", regions=["virtual", R2], verified_on="2026-09-15", who_can_apply="Boys and girls are welcome."),
    full_card(CAL_ID, regions=[R2], verified_on="2026-08-01"),
]


class BuildDataOutputs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        out = cls.tmp.name
        progs = os.path.join(out, "programs")
        os.makedirs(progs)
        for c in CARDS:
            with open(os.path.join(progs, c["id"] + ".json"), "w", encoding="utf-8") as f:
                json.dump(c, f)
        real = proglib.load_programs
        buf = io.StringIO()
        with mock.patch.object(build_data, "OUT_DIR", out), mock.patch.object(build_data.proglib, "load_programs", lambda: real(progs)), \
                contextlib.redirect_stdout(buf):
            cls.rc = build_data.main()
        cls.stdout = buf.getvalue()

        def read(name):
            with open(os.path.join(out, name), encoding="utf-8") as f:
                text = f.read()
            assert text.endswith("\n"), name + " has no trailing newline"
            return json.loads(text) if name.endswith(".json") else text
        cls.read = staticmethod(read)
        cls.ids = sorted(c["id"] for c in CARDS)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def by_id(self, rows):
        return {r["id"]: r for r in rows}

    def test_main_reports_and_writes_meta(self):
        self.assertEqual(self.rc, 0)
        meta = self.read("meta.json")
        self.assertEqual(meta, {"count": 4, "verified_on_official_site": 3, "checked": "2026-10-05", "checked_label": "Oct 5, 2026"})
        self.assertEqual(self.stdout.strip(), "built 4 programs (3 read on official site), last checked Oct 5, 2026")

    def test_entries_json_is_sorted_by_id_with_labels_and_limited(self):
        rows = self.read("entries.json")
        self.assertEqual([r["id"] for r in rows], self.ids)
        by = self.by_id(rows)
        self.assertEqual(by["b-full"]["verified_on_label"], "Oct 1, 2026")
        self.assertIs(by["a-sparse"].get("limited"), True, "girls only is a limit")
        self.assertNotIn("limited", by["c-online"], "boys and girls is not a limit")
        self.assertNotIn("limited", by["b-full"])

    def test_lite_drops_only_the_long_fields(self):
        rows = self.read("entries-lite.json")
        self.assertEqual([r["id"] for r in rows], self.ids)
        full = self.by_id(self.read("entries.json"))
        for r in rows:
            want = {k: v for k, v in full[r["id"]].items() if k not in build_data.LITE_DROP}
            self.assertEqual(r, want)
        self.assertEqual(set(build_data.LITE_DROP), {"notes", "sources_fetched", "how_to_apply", "who_can_apply", "duration", "pay_detail", "verified_on"})

    def test_core_has_every_key_the_age_filter_reads(self):
        rows = self.by_id(self.read("entries-core.json"))
        self.assertEqual(rows["b-full"], {"id": "b-full", "min_age": 14, "max_age": 18, "status": "open-now", "deadline_iso": "2026-12-01",
                                          "opens_iso": "2026-09-01", "regions": [R1], "season": "summer"})
        self.assertIsNone(rows["a-sparse"]["min_age"], "core keeps nulls")

    def test_calendar_file_holds_only_calendar_cards_with_card_keys(self):
        rows = self.read("entries-cal.json")
        self.assertEqual([r["id"] for r in rows], [CAL_ID])
        self.assertEqual(list(rows[0]), [k for k in build_data.CARD_KEYS])
        self.assertEqual(rows[0]["deadline_iso"], "2026-12-01")

    def test_stats_rows_leave_out_nulls(self):
        rows = self.by_id(self.read("entries-stats.json"))
        self.assertEqual(set(rows["b-full"]), set(build_data.STATS_KEYS))
        self.assertNotIn("min_age", rows["a-sparse"])
        self.assertNotIn("deadline_iso", rows["a-sparse"])
        self.assertEqual(rows["a-sparse"]["status"], "rolling")

    def test_home_rows_in_name_order_with_soon_keys_only_when_confirmed(self):
        rows = self.read("entries-home.json")
        self.assertEqual([r["id"] for r in rows], sorted(self.ids, key=lambda i: ("Zed Club" if i == "a-sparse" else "Name " + i, i)))
        by = self.by_id(rows)
        self.assertEqual(set(by["b-full"]), set(build_data.HOME_KEYS))
        self.assertEqual(by["b-full"]["deadline_confidence"], "confirmed-2026-27")
        sparse = by["a-sparse"]
        for k in ("name", "org", "city", "url", "deadline_confidence", "min_age", "deadline_iso"):
            self.assertNotIn(k, sparse, k)
        self.assertEqual(sparse["verified"], "snippet-only", "lib.rank reads verified on every row")

    def test_map_rows_have_what_the_map_filters_read(self):
        rows = self.by_id(self.read("entries-map.json"))
        self.assertEqual(rows["b-full"], {k: CARDS[0][k] for k in build_data.MAP_KEYS})
        self.assertEqual(build_data.MAP_KEYS, ("id", "name", "org", "paid_type", "min_age", "max_age", "status", "deadline_iso", "opens_iso", "regions"))
        self.assertNotIn("min_age", rows["a-sparse"])

    def test_detail_rows_hold_the_long_text(self):
        rows = self.by_id(self.read("entries-detail.json"))
        self.assertEqual(rows["b-full"], {"id": "b-full", "who_can_apply": "Teens age 14 to 18.", "how_to_apply": "Apply on the official page.",
                                          "notes": "A note.", "duration": "6 weeks", "pay_detail": "$15 an hour"})
        self.assertEqual(rows["a-sparse"]["duration"], None, "a null long field is kept as null")

    def test_chunks_put_each_card_where_its_regions_are(self):
        lite_dir = os.path.join(self.tmp.name, "lite")
        names = sorted(os.listdir(lite_dir))
        self.assertEqual(names, sorted(["shared.json"] + [g[0] + ".json" for g in GROUPS]), "every group file is written, even empty")
        self.assertEqual(sorted(os.listdir(os.path.join(self.tmp.name, "detail"))), names)
        ids = lambda folder, slug: [r["id"] for r in self.read(os.path.join(folder, slug + ".json"))]
        self.assertEqual(ids("lite", "shared"), ["c-online"], "an online card is only in shared")
        self.assertEqual(ids("lite", G1[0]), ["a-sparse", "b-full"])
        self.assertEqual(ids("lite", G2[0]), ["a-sparse", CAL_ID], "a card in two groups is in both")
        for slug in [g[0] for g in GROUPS[2:]]:
            self.assertEqual(ids("lite", slug), [], slug)
        lite = self.by_id(self.read("entries-lite.json"))
        detail = self.by_id(self.read("entries-detail.json"))
        for g in [G1[0], G2[0], "shared"]:
            self.assertEqual(self.read(os.path.join("lite", g + ".json")), [lite[i] for i in ids("lite", g)])
            self.assertEqual(self.read(os.path.join("detail", g + ".json")), [detail[i] for i in ids("lite", g)])
        with open(os.path.join(self.tmp.name, "lite", "shared.json"), encoding="utf-8") as f:
            raw = f.read()
        self.assertNotIn(": ", raw, "chunks are written compact")

    def test_csv_matches_the_columns(self):
        rows = list(csv.reader(io.StringIO(self.read("entries.csv"))))
        self.assertEqual(rows[0], build_data.CSV_COLUMNS)
        # Spreadsheet users rely on these column names; spell them out so a renamed key in CSV_COLUMNS fails here.
        self.assertEqual(rows[0], ["id", "name", "org", "city", "regions", "type", "fields", "min_age", "max_age", "grades", "paid_type", "pay_detail", "season", "duration", "status", "deadline_text", "deadline_iso", "deadline_confidence", "needs_work_permit", "who_can_apply", "how_to_apply", "url", "apply_url", "verified", "verified_on", "notes"])
        b_all = dict(zip(rows[0], rows[[r[0] for r in rows].index("b-full")]))
        for col in build_data.CSV_COLUMNS:
            if col not in ("regions", "fields", "verified_on_label"):
                want = CARDS[0].get(col)
                self.assertEqual(b_all[col], "" if want is None else str(want), col)
        self.assertEqual(len(rows), 5)
        b = dict(zip(rows[0], rows[[r[0] for r in rows].index("b-full")]))
        self.assertEqual(b["regions"], R1)
        self.assertEqual(b["fields"], "health")
        self.assertEqual(b["min_age"], "14")
        a = dict(zip(rows[0], rows[[r[0] for r in rows].index("a-sparse")]))
        self.assertEqual(a["regions"], R1 + "; " + R2)
        self.assertEqual(a["min_age"], "")


class IsLimited(unittest.TestCase):
    def test_limits(self):
        for text in ("Oakland residents only.", "You must live in Fremont.", "For girls in grades 9 to 12.", "Young women ages 14 to 18.",
                     "Open to boys.", "Young men of color.", "Students who identify with this gender."):
            self.assertTrue(build_data.is_limited({"who_can_apply": text}), text)
        self.assertTrue(build_data.is_limited({"name": "Girls Who Code Club"}), "the name counts")
        self.assertTrue(build_data.is_limited({"what_you_do": "Mentoring for young women in tech."}), "what_you_do counts")

    def test_not_limits(self):
        for text in ("Boys and girls welcome.", "Not just for girls.", "Any gender.", "California residents.", "Residents of the United States.",
                     "Permanent residents may apply.", "Participants live in dorms.", "Ages 14 to 18.", None):
            self.assertFalse(build_data.is_limited({"who_can_apply": text, "name": "Program"}), text)


class JsValue(unittest.TestCase):
    def test_reads_nested_arrays_with_escapes_and_comments(self):
        src = 'var X = 1;\nvar LIST = [["a", "b \\"q\\" ]"], /* a note */ ["c", ["d"]]];\nvar Y = [];'
        self.assertEqual(build_data._js_value(src, "LIST"), [["a", 'b "q" ]'], ["c", ["d"]]])

    def test_missing_or_unbalanced(self):
        with self.assertRaises(SystemExit):
            build_data._js_value("var Z = [1];", "LIST")
        with self.assertRaises(SystemExit):
            build_data._js_value('var LIST = [["a"]', "LIST")

    def test_groups_cover_the_cities_and_states_listed(self):
        slugs = [g[0] for g in GROUPS]
        self.assertEqual(len(slugs), len(set(slugs)))
        for slug, label, regions in GROUPS:
            self.assertRegex(slug, r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
            self.assertTrue(regions, label)
        self.assertIn("east-bay", set().union(*[g[2] for g in GROUPS]), "a group's regions come from its cities")
        self.assertIn("ohio", set().union(*[g[2] for g in GROUPS]), "and from its states")


if __name__ == "__main__":
    unittest.main()
