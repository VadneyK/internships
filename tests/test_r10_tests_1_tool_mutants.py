"""2026-10-16: tests that kill the mutants a mutation run of the data tools left alive.

A small AST mutation tester flipped comparisons, dropped branches and changed constants in tools/proglib.py,
flip_dates.py, freshness.py and validate.py; these cases pin the behaviour no test noticed changing. The
ones that matter most to a teen come first: a card whose status flips to open or closed on the wrong day,
an age range check that lets a bad card through, and the validator letting two cards share an id or url.
Run with: python3 -m unittest tests.test_r10_tests_1_tool_mutants
"""
import contextlib
import copy
import datetime as dt
import io
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import flip_dates  # noqa: E402
import freshness  # noqa: E402
import proglib  # noqa: E402
import validate  # noqa: E402

try:
    import jsonschema  # noqa: F401
    HAVE_JSONSCHEMA = True
except ImportError:  # CI installs it from requirements-dev.txt
    HAVE_JSONSCHEMA = False

REAL_LOAD = proglib.load_programs  # the tests patch proglib.load_programs to read a temporary folder

# A schema-valid card. Each test changes one field and looks for exactly the problem that field causes.
BASE = {
    "grades": None,
    "apply_url": None,
    "verified": "fetched",
    "verified_on": "2026-10-09",
    "id": "test-card",
    "name": "Seasonal Youth Apprenticeship",
    "org": "Test Org",
    "regions": ["cincinnati"],
    "city": "Cincinnati, OH",
    "type": "paid-youth-program",
    "fields": ["arts-media"],
    "what_you_do": "You work on a team that makes public art such as murals.",
    "min_age": 14,
    "max_age": 18,
    "who_can_apply": "Must be 14 to 18 years old at the start of employment.",
    "paid_type": "paid",
    "pay_detail": "$13 an hour",
    "season": "summer",
    "duration": "8 weeks, June to July",
    "status": "closed-expect-reopen",
    "deadline_text": "The 2026 application has passed.",
    "deadline_iso": None,
    "deadline_confidence": "last-year-pattern",
    "how_to_apply": "Complete the application on the official page.",
    "needs_work_permit": True,
    "url": "https://example.org/apprenticeship",
    "sources_fetched": ["https://example.org/apprenticeship"],
    "priority": 1,
    "notes": "A test card.",
}


def card(**over):
    d = copy.deepcopy(BASE)
    d.update(over)
    return d


def problems(d, name=None):
    return proglib.validate_program(name or (d.get("id", "x") + ".json"), d)


def write_cards(directory, cards):
    for c in cards:
        with open(os.path.join(directory, c["id"] + ".json"), "w", encoding="utf-8") as f:
            json.dump(c, f, indent=2)
            f.write("\n")


# ---------------------------------------------------------------- flip_dates: open and closed status
class FlipPlanEdges(unittest.TestCase):
    TODAY = dt.date(2026, 10, 20)

    def flip(self, **over):
        d = {"id": "x", "status": "open-now", "opens_iso": None, "deadline_iso": None, "deadline_text": None}
        d.update(over)
        return flip_dates.plan_flip(d, self.TODAY)

    def test_passed_deadline_with_no_deadline_text_still_closes(self):
        # deadline_text null must read as "says nothing", not crash the daily job
        change, held = self.flip(deadline_iso="2026-10-19", deadline_text=None)
        self.assertEqual(change, {"status": "closed-expect-reopen", "deadline_iso": None, "opens_iso": None})
        self.assertIsNone(held)

    def test_deadline_today_is_still_open(self):
        self.assertEqual(self.flip(deadline_iso="2026-10-20"), (None, None))

    def test_closed_cards_are_never_flipped(self):
        for status in ("closed-expect-reopen", "rolling", "year-round", "event"):
            self.assertEqual(self.flip(status=status, deadline_iso="2026-01-01", opens_iso="2026-01-01"), (None, None), status)

    def test_open_now_with_an_arrived_opening_day_is_left_alone(self):
        self.assertEqual(self.flip(status="open-now", opens_iso="2026-10-01"), (None, None))


class FlipSetField(unittest.TestCase):
    def test_changes_only_the_first_top_level_line(self):
        text = '{\n  "status": "open-now",\n  "status": "open-now"\n}\n'
        self.assertEqual(flip_dates.set_field(text, "status", "closed-expect-reopen"),
                         '{\n  "status": "closed-expect-reopen",\n  "status": "open-now"\n}\n')

    def test_missing_key_raises(self):
        with self.assertRaises(ValueError):
            flip_dates.set_field('{\n  "id": "x"\n}\n', "status", "open-now")


class FlipMain(unittest.TestCase):
    """main() end to end on a temporary programs folder: what is written, what is held, and the exit code."""

    def run_main(self, cards, argv):
        with tempfile.TemporaryDirectory() as tmp:
            write_cards(tmp, cards)
            out = io.StringIO()
            with mock.patch.object(flip_dates.proglib, "load_programs", lambda: REAL_LOAD(tmp)), contextlib.redirect_stdout(out):
                rc = flip_dates.main(argv)
            after = {c["id"]: json.load(open(os.path.join(tmp, c["id"] + ".json"), encoding="utf-8")) for c in cards}
            raw = {c["id"]: open(os.path.join(tmp, c["id"] + ".json"), encoding="utf-8").read() for c in cards}
        return rc, out.getvalue(), after, raw

    def cards(self):
        return [
            card(id="opens", status="opens-soon", opens_iso="2026-10-20", deadline_iso="2026-11-30", deadline_confidence="confirmed-2026-27"),
            card(id="closes", status="open-now", deadline_iso="2026-10-01", deadline_confidence="confirmed-2026-27", opens_iso=None),
            card(id="held", status="open-now", deadline_iso="2026-10-01", deadline_confidence="confirmed-2026-27", deadline_text="Applications are open now."),
            card(id="quiet", status="open-now", deadline_iso="2026-12-01", deadline_confidence="confirmed-2026-27"),
        ]

    def test_write_flips_due_cards_holds_the_contradiction_and_exits_1(self):
        rc, out, after, raw = self.run_main(self.cards(), ["--today", "2026-10-20", "--write"])
        self.assertEqual(rc, 1, "a held card must fail the job so a person looks")
        self.assertEqual(after["opens"]["status"], "open-now")
        self.assertIsNone(after["opens"]["opens_iso"])
        self.assertEqual(after["opens"]["deadline_iso"], "2026-11-30", "an open flip keeps the deadline")
        self.assertEqual(after["closes"]["status"], "closed-expect-reopen")
        self.assertIsNone(after["closes"]["deadline_iso"])
        self.assertEqual(after["held"]["status"], "open-now", "a held card is not written")
        self.assertEqual(after["quiet"]["status"], "open-now")
        self.assertIn("flipped opens: opens-soon to open-now", out)
        self.assertIn("flipped closes: open-now to closed-expect-reopen", out)
        self.assertIn("HOLD held: deadline 2026-10-01 passed but deadline_text says it is open", out)
        self.assertIn("2 flip(s), 1 held, date 2026-10-20", out)
        self.assertNotIn("dry run", out)
        # opens_iso was already null on "closes": the file keeps its own layout, only the changed lines move
        self.assertTrue(raw["closes"].endswith('  "opens_iso": null\n}\n'), raw["closes"][-40:])

    def test_dry_run_writes_nothing_and_exits_0_with_no_hold(self):
        cards = self.cards()[:2]
        rc, out, after, _ = self.run_main(cards, ["--today", "2026-10-20"])
        self.assertEqual(rc, 0)
        self.assertEqual(after["opens"]["status"], "opens-soon")
        self.assertEqual(after["closes"]["status"], "open-now")
        self.assertIn("would flip opens: opens-soon to open-now", out)
        self.assertIn("2 flip(s), 0 held, date 2026-10-20 (dry run)", out)

    def test_default_date_is_today_in_utc(self):
        class FakeDT(dt.datetime):
            @classmethod
            def now(cls, tz=None):
                return dt.datetime(2026, 10, 21, 2, 0, tzinfo=dt.timezone.utc)  # Oct 20 in California, Oct 21 in UTC
        with mock.patch.object(flip_dates.dt, "datetime", FakeDT):
            rc, out, _, _ = self.run_main([card(id="opens", status="opens-soon", opens_iso="2026-10-21")], [])
        self.assertEqual(rc, 0)
        self.assertIn("would flip opens", out)
        self.assertIn("date 2026-10-21", out)


# ---------------------------------------------------------------- freshness: which cards a person re-reads
class FreshnessEdges(unittest.TestCase):
    TODAY = dt.date(2026, 10, 20)

    def reasons(self, **over):
        d = {"id": "x", "name": "X", "regions": ["bay-area"], "url": "https://example.org", "verified": "fetched",
             "verified_on": "2026-10-01", "status": "open-now", "deadline_iso": None, "opens_iso": None}
        d.update(over)
        return freshness.needs_refresh(d, self.TODAY, 120), freshness.urgency_tier(d, self.TODAY)

    def test_open_card_with_deadline_today_is_fine(self):
        self.assertEqual(self.reasons(deadline_iso="2026-10-20"), ([], 3))

    def test_open_card_with_deadline_yesterday_is_flagged_first(self):
        for status in ("open-now", "opens-soon"):
            r, tier = self.reasons(status=status, deadline_iso="2026-10-19")
            self.assertEqual(r, ["status says open but the deadline 2026-10-19 has passed; mark it closed-expect-reopen"], status)
            self.assertEqual(tier, 0)

    def test_closed_card_deadline_seven_days_ago_waits_eight_days_flags(self):
        self.assertEqual(self.reasons(status="closed-expect-reopen", deadline_iso="2026-10-13"), ([], 3))
        r, tier = self.reasons(status="closed-expect-reopen", deadline_iso="2026-10-12")
        self.assertEqual(r, ["deadline 2026-10-12 has passed; look for next year's dates"])
        self.assertEqual(tier, 1)

    def test_rolling_and_year_round_never_ask_for_next_year(self):
        for status in ("rolling", "year-round"):
            self.assertEqual(self.reasons(status=status, deadline_iso="2026-01-01"), ([], 3), status)

    def test_opens_soon_flags_on_the_opening_day_not_before(self):
        self.assertEqual(self.reasons(status="opens-soon", opens_iso="2026-10-21"), ([], 3))
        r, tier = self.reasons(status="opens-soon", opens_iso="2026-10-20")
        self.assertEqual(r, ["status says opens soon but the opening date 2026-10-20 has arrived; mark it open-now"])
        self.assertEqual(tier, 0)

    def test_open_now_flags_only_a_future_opening_day(self):
        self.assertEqual(self.reasons(status="open-now", opens_iso="2026-10-20"), ([], 3))
        r, tier = self.reasons(status="open-now", opens_iso="2026-10-21")
        self.assertEqual(r, ["status says open now but it does not open until 2026-10-21"])
        self.assertEqual(tier, 0)

    def test_closed_card_with_an_opening_day_is_not_a_contradiction(self):
        self.assertEqual(self.reasons(status="closed-expect-reopen", opens_iso="2026-10-01")[1], 3)

    def test_never_read_is_tier_2(self):
        self.assertEqual(self.reasons(verified="snippet-only"), (["official page was never read"], 2))

    def test_missing_verified_on_sorts_first_in_its_tier(self):
        a = {"verified_on": None, "verified": "snippet-only", "status": "rolling", "regions": ["z"], "name": "Z"}
        b = {"verified_on": "2026-01-01", "verified": "snippet-only", "status": "rolling", "regions": ["a"], "name": "A"}
        self.assertLess(freshness.urgency_key(a, self.TODAY), freshness.urgency_key(b, self.TODAY))


class FreshnessMain(unittest.TestCase):
    def run_main(self, cards, argv):
        with tempfile.TemporaryDirectory() as tmp:
            write_cards(tmp, cards)
            out, err = io.StringIO(), io.StringIO()
            with mock.patch.object(freshness.proglib, "load_programs", lambda: REAL_LOAD(tmp)), \
                    mock.patch.object(sys, "argv", ["freshness.py"] + argv), contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                try:
                    rc = freshness.main()
                except SystemExit as e:
                    rc = e.code
        return rc, out.getvalue(), err.getvalue()

    def test_default_window_is_120_days(self):
        cards = [card(id="old", verified_on="2026-06-22"), card(id="older", verified_on="2026-06-21", url="https://example.org/older")]
        rc, out, _ = self.run_main(cards, ["--today", "2026-10-20"])
        self.assertEqual(rc, 0)
        self.assertIn("`older`", out)
        self.assertIn("last verified 121 days ago", out)
        self.assertNotIn("`old`", out, "120 days is still inside the window")
        self.assertIn("1 programs need a person to re-read", out)

    def test_max_items_must_be_at_least_1(self):
        rc, _, err = self.run_main([card()], ["--today", "2026-10-20", "--max-items", "0"])
        self.assertEqual(rc, 2)
        self.assertIn("--max-items must be at least 1", err)
        rc, out, _ = self.run_main([card(verified="snippet-only")], ["--today", "2026-10-20", "--max-items", "1"])
        self.assertEqual(rc, 0)
        self.assertIn("1 programs need a person", out)

    def test_full_out_lists_every_card_with_a_trailing_newline(self):
        cards = [card(id="a%d" % i, verified="snippet-only", url="https://example.org/%d" % i) for i in range(3)]
        with tempfile.TemporaryDirectory() as tmp:
            full = os.path.join(tmp, "full.md")
            rc, out, _ = self.run_main(cards, ["--today", "2026-10-20", "--max-items", "2", "--full-out", full])
            text = open(full, encoding="utf-8").read()
        self.assertEqual(rc, 0)
        self.assertTrue(text.endswith(".\n") or text.endswith("/2\n"), repr(text[-20:]))
        self.assertEqual(text.count("- [ ] "), 3)
        self.assertEqual(out.count("- [ ] "), 2)


# ---------------------------------------------------------------- proglib.validate_program: card rules
@unittest.skipUnless(HAVE_JSONSCHEMA, "needs jsonschema (pip install -r requirements-dev.txt)")
class ValidateProgramRules(unittest.TestCase):
    def assertOnly(self, d, needle, name=None):
        got = problems(d, name)
        self.assertEqual(len(got), 1, got)
        self.assertIn(needle, got[0])

    def test_base_card_is_clean(self):
        self.assertEqual(problems(card()), [])

    def test_file_name_must_match_id(self):
        self.assertOnly(card(), "file name must be <id>.json", name="other.json")

    def test_each_dash_is_reported_once_per_string(self):
        got = problems(card(notes="One — two – three — four"))
        self.assertEqual(len([p for p in got if "dash character" in p]), 1, got)
        self.assertIn("U+2014", got[0])
        got = problems(card(fields=["arts-media"], what_you_do="Paint – draw"))
        self.assertTrue(any("U+2013" in p for p in got), got)

    def test_impossible_dates_are_reported(self):
        for key in ("verified_on", "opens_iso"):
            got = problems(card(**{key: "2026-02-30"}))
            self.assertTrue(any("%s is not a real date: 2026-02-30" % key in p for p in got), (key, got))
        got = problems(card(deadline_iso="2027-02-30", deadline_confidence="confirmed-2026-27"))
        self.assertTrue(any("deadline_iso is not a real date: 2027-02-30" in p for p in got), got)

    def test_schema_error_at_the_top_says_file(self):
        d = card()
        del d["name"]
        got = problems(d)
        self.assertIn("test-card.json: (file): 'name' is a required property", got)

    def test_min_age_above_max_age(self):
        self.assertOnly(card(min_age=16, max_age=15), "min_age is greater than max_age")
        self.assertEqual(problems(card(min_age=15, max_age=15)), [], "a single-age program is fine")
        self.assertEqual(problems(card(min_age=None, max_age=12)), [])
        self.assertEqual(problems(card(min_age=14, max_age=None)), [])

    def test_age_range_must_touch_12_to_18(self):
        self.assertEqual(problems(card(min_age=18, max_age=21)), [])
        self.assertOnly(card(min_age=19, max_age=21), "min_age is over 18")
        self.assertEqual(problems(card(min_age=10, max_age=12)), [])
        self.assertOnly(card(min_age=9, max_age=11), "max_age is under 12")

    def test_opens_soon_needs_an_opening_day(self):
        self.assertOnly(card(status="opens-soon", opens_iso=None), "status opens-soon needs opens_iso")
        self.assertEqual(problems(card(status="opens-soon", opens_iso="2026-11-01")), [])
        self.assertEqual(problems(card(status="open-now", opens_iso=None)), [])

    def test_deadline_iso_only_when_confirmed(self):
        self.assertOnly(card(deadline_iso="2027-01-15"), "deadline_iso is only for dates confirmed for 2026-27")
        self.assertEqual(problems(card(deadline_iso="2027-01-15", deadline_confidence="confirmed-2026-27")), [])
        self.assertEqual(problems(card(deadline_iso=None, deadline_confidence="last-year-pattern")), [])

    def test_fetched_needs_sources(self):
        self.assertTrue(any("verified=fetched but sources_fetched is empty" in p for p in problems(card(sources_fetched=[]))))
        self.assertFalse(any("sources_fetched is empty" in p for p in problems(card(verified="snippet-only", sources_fetched=[]))))

    def test_fee_based_needs_a_cost(self):
        self.assertTrue(any("fee-based programs must say the cost" in p for p in problems(card(paid_type="fee-based", pay_detail=None))))
        self.assertEqual(problems(card(paid_type="fee-based", pay_detail="$200 a week")), [])
        self.assertFalse(any("must say the cost" in p for p in problems(card(paid_type="unpaid", pay_detail=None))))

    def test_url_with_a_space(self):
        self.assertTrue(any("url contains whitespace" in p for p in problems(card(url="https://example.org/a b"))))

    def test_stray_whitespace_each_kind(self):
        for bad in (" lead", "trail ", "tab\there", "new\nline", "two  spaces"):
            self.assertTrue(any("notes has stray whitespace" in p for p in problems(card(notes=bad))), repr(bad))
        self.assertFalse(any("stray whitespace" in p for p in problems(card(notes="one space each"))))

    def test_how_to_apply_needs_20_characters(self):
        self.assertTrue(any("how_to_apply is too short" in p for p in problems(card(how_to_apply="Apply on the site."))))  # 18
        self.assertTrue(any("how_to_apply is too short" in p for p in problems(card(how_to_apply="Apply on the websit"))))  # 19
        self.assertFalse(any("too short" in p for p in problems(card(how_to_apply="Apply on the website"))))  # exactly 20


class ProglibHelpers(unittest.TestCase):
    def test_load_programs_skips_templates_and_sorts(self):
        with tempfile.TemporaryDirectory() as tmp:
            write_cards(tmp, [{"id": "b"}, {"id": "a"}, {"id": "_template"}])
            with open(os.path.join(tmp, "notes.txt"), "w") as f:
                f.write("not a card")
            got = proglib.load_programs(tmp)
        self.assertEqual([os.path.basename(p) for p, _ in got], ["a.json", "b.json"])
        self.assertEqual([d["id"] for _, d in got], ["a", "b"])

    def test_iter_strings_walks_nested_values(self):
        self.assertEqual(sorted(proglib.iter_strings({"a": "x", "b": ["y", {"c": "z", "d": 3}], "e": None})), ["x", "y", "z"])

    def test_parse_iso(self):
        self.assertEqual(proglib.parse_iso("2026-10-20"), dt.date(2026, 10, 20))
        for bad in (None, "", "2026-13-01", 20261020, ["2026-10-20"]):
            self.assertIsNone(proglib.parse_iso(bad), repr(bad))

    def test_date_label(self):
        self.assertEqual(proglib.date_label("2026-10-07"), "Oct 7, 2026")
        self.assertEqual(proglib.date_label("2027-01-31"), "Jan 31, 2027")

    def test_dash_characters_are_em_and_en(self):
        self.assertEqual(proglib.DASHES, ("—", "–"))


# ---------------------------------------------------------------- validate.main: cards that collide
class ValidateMain(unittest.TestCase):
    def run_main(self, cards):
        with tempfile.TemporaryDirectory() as tmp:
            write_cards(tmp, cards)
            out = io.StringIO()
            with mock.patch.object(validate.proglib, "load_programs", lambda: REAL_LOAD(tmp)), \
                    mock.patch.object(validate.proglib, "validate_program", lambda path, data, schema=None: []), \
                    mock.patch.object(validate, "lite_problems", lambda: []), mock.patch.object(validate, "wage_problems", lambda: []), \
                    mock.patch.object(validate, "schema_problems", lambda: []), contextlib.redirect_stdout(out):
                rc = validate.main()
        return rc, out.getvalue()

    def test_clean_cards_pass(self):
        rc, out = self.run_main([card(id="a", url="https://example.org/a", name="A"), card(id="b", url="https://example.org/b", name="B")])
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "OK: 2 programs valid")

    def test_same_url_on_two_cards_ignoring_case_and_trailing_slash(self):
        rc, out = self.run_main([card(id="a", url="https://Example.org/X/", name="A"), card(id="b", url="https://example.org/x", name="B")])
        self.assertEqual(rc, 1)
        self.assertIn("same official url used by a, b: https://example.org/x", out)
        self.assertIn("1 problem(s) in 2 programs", out)

    def test_same_org_and_name_ignoring_case_and_punctuation(self):
        rc, out = self.run_main([card(id="a", url="https://example.org/a", org="Test Org", name="Teen Corps!"),
                                 card(id="b", url="https://example.org/b", org="test org", name="teen  corps")])
        self.assertEqual(rc, 1)
        self.assertIn("same org and name on more than one card (a, b): test org teen corps", out)

    def test_duplicate_id(self):
        cards = [card(id="a", url="https://example.org/a", name="A"), card(id="a2", url="https://example.org/b", name="B")]
        cards[1]["id"] = "a"
        with tempfile.TemporaryDirectory() as tmp:
            for i, c in enumerate(cards):
                with open(os.path.join(tmp, "f%d.json" % i), "w", encoding="utf-8") as f:
                    json.dump(c, f)
            out = io.StringIO()
            with mock.patch.object(validate.proglib, "load_programs", lambda: REAL_LOAD(tmp)), \
                    mock.patch.object(validate.proglib, "validate_program", lambda path, data, schema=None: []), \
                    mock.patch.object(validate, "lite_problems", lambda: []), mock.patch.object(validate, "wage_problems", lambda: []), \
                    mock.patch.object(validate, "schema_problems", lambda: []), contextlib.redirect_stdout(out):
                rc = validate.main()
        self.assertEqual(rc, 1)
        self.assertIn("duplicate id: a", out.getvalue())

    def test_cards_without_url_or_name_do_not_collide(self):
        rc, out = self.run_main([card(id="a", url=None, name="A"), card(id="b", url=None, name="B"),
                                 card(id="c", url="https://example.org/c", org=None, name="Same"),
                                 card(id="d", url="https://example.org/d", org=None, name="Same")])
        self.assertEqual(rc, 0, out)


@unittest.skipUnless(HAVE_JSONSCHEMA, "needs jsonschema (pip install -r requirements-dev.txt)")
class ValidateEmployerGroups(unittest.TestCase):
    def test_group_must_be_in_the_files_groups_list(self):
        with open(os.path.join(ROOT, "data", "employers.json"), encoding="utf-8") as f:
            data = json.load(f)
        self.assertTrue(data["employers"] and data["groups"])
        data["employers"][1]["group"] = "no-such-group"
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "employers.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f)
            got = [p for p in validate.schema_problems({"employers": path}) if p.startswith("employers:")]
        self.assertIn("employers: employers.1.group: 'no-such-group' is not in the file's groups list", got)

    def test_real_files_have_no_problems(self):
        self.assertEqual(validate.schema_problems(), [])

    def test_unreadable_file_is_one_problem_not_a_crash(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "permits.json")
            with open(path, "w", encoding="utf-8") as f:
                f.write("{not json")
            got = validate.schema_problems({"permits": path})
        self.assertEqual(len(got), 1, got)
        self.assertTrue(got[0].startswith("permits: cannot read permits.json:"), got)

    def test_top_level_type_error_is_reported_at_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "permits.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump([], f)
            got = validate.schema_problems({"permits": path})
        self.assertTrue(got and all(p.startswith("permits: (file): ") for p in got), got)
        self.assertTrue(all(len(p) <= len("permits: (file): ") + 200 for p in got))


if __name__ == "__main__":
    unittest.main()
