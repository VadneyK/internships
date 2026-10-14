"""A program's age fields, status and dates must agree with its own text.

Only clear patterns are flagged. Each check is a function over one card
(a dict), so the fixture tests below can prove it fails on a bad card.
Known multi-tier or not-yet-fixed cards go in the allow-lists with a reason.
Remove an entry when the card is fixed.
"""
import glob
import json
import os
import re
import unittest
from datetime import date, datetime, timezone



def utc_today():
    """Today's date in UTC, the clock CI runs on. Local Pacific time is a day behind
    every evening, so date.today() let pushes go out green locally and red in CI."""
    return datetime.now(timezone.utc).date()


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def check_today():
    """The date the real-data date checks compare against.

    Default: the build date in data/meta.json (field "checked"), so a push is not failed by a date
    that passed overnight. With DATE_CHECK_TODAY=utc (the daily dates workflow) it is today in UTC.
    """
    if os.environ.get("DATE_CHECK_TODAY") == "utc":
        return utc_today()
    with open(os.path.join(ROOT, "data", "meta.json"), encoding="utf-8") as f:
        return date.fromisoformat(json.load(f)["checked"])


MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
DUE = re.compile(r"\bdue\s+([A-Z][a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})")
AGES = re.compile(r"\bages?\s+(\d{1,2})\s+(?:to|through)\s+(\d{1,2})\b", re.I)
ADULT_OR = re.compile(r"with an adult|\bor\b", re.I)
SAYS_OPEN = re.compile(r"\bpage (?:still )?says\b[^.]*?\b(?:is|are) (?:now )?open", re.I)
NOT_OPEN_NOW = re.compile(r"\bno\b|\bnot\b|each year|every ", re.I)

# id -> reason
ALLOW_DATE = {
}
ALLOW_AGES = {
    "portland-multnomah-county-library-teen-council": "max_age 18 covers middle and high school students; the 9 to 12 range is a separate Tween Council named in the text",
    "boston-futurebos-youth-jobs": "max_age 24 covers a young-adult tier; text names the teen tier",
    "lansing-umh-sparrow-teen-volunteer": "min_age 16 but text says ages 17 to 18; needs a data fix",
}
ALLOW_OPEN = {
}
ALLOW_OPEN_LABEL = {
    "college-park-umd-sparc-robotics-certificate": "open-now, text says the page does not say whether applications are closed; needs a data fix",
}
ALLOW_SOON = {}
ALLOW_PAY = {
    "atlanta-parks-rec-teen-leaders": "mixed, pay_detail says pay is not stated; needs a data fix",
    "champaign-county-rpc-youth-services": "mixed, pay_detail starts with not stated; needs a data fix",
}
ALLOW_NOT_STATED_PAY = {
    "berkeley-rep-teen-council": "not-stated, pay_detail says a transportation stipend is paid; needs a data fix",
    "minnesota-house-high-school-page-program": "not-stated, pay_detail says a small meal stipend is paid; needs a data fix",
    "seattle-childrens-research-training-program-high-school": "not-stated, pay_detail says a stipend is paid; needs a data fix",
}

UNSURE_OPEN = re.compile(r"does not say whether|do not say whether|doesn't say whether", re.I)
ALL_CLOSED = re.compile(r"\ball (?:the )?(?:roles|positions|spots|openings|slots|sessions)\b[^.]*?\b(?:are|is)\s+(?:now\s+)?(?:closed|full)", re.I)
PAY_WORDS = re.compile(r"paid|stipend|unpaid|volunteer|\$|dollar", re.I)
NOT_STATED_CARD = re.compile(r"\bnot stated?\b", re.I)
PAID_CLAIM = re.compile(r"\bstipends?\b|\bpaid\b|\$\s?\d|\bdollars?\b|\bper hour\b|\bhourly\b|\bwages?\b", re.I)
NO_CLAIM = re.compile(r"\bunpaid\b|\bno\b|\bnothing\b|\bwhether\b|\bif\b|\bask\b|\bnot (?:say|mention|list|stated|state)|\bdoes not\b|\bdo not\b|n't\b", re.I)


def date_problem(card, today):
    """Open-now or opens-soon, no deadline_iso, text says 'due <Month> <d>, <yyyy>' in the future."""
    if card.get("status") not in ("open-now", "opens-soon") or card.get("deadline_iso"):
        return None
    for mon, day, year in DUE.findall(card.get("deadline_text") or ""):
        m = MONTHS.get(mon[:3].lower())
        if m is None:
            continue
        try:
            d = date(int(year), m, int(day))
        except ValueError:
            continue
        if d > today:
            return "deadline_iso is null but deadline_text says due %s %s, %s" % (mon, day, year)
    return None


def age_problem(card):
    """min_age or max_age outside the one 'ages N to M' in who_can_apply."""
    who = card.get("who_can_apply") or ""
    found = AGES.findall(who)
    if len(found) != 1 or ADULT_OR.search(who):
        return None
    lo_t, hi_t = map(int, found[0])
    lo, hi = card.get("min_age"), card.get("max_age")
    if (lo is not None and lo < lo_t) or (hi is not None and hi > hi_t):
        return "min_age %s, max_age %s but who_can_apply says ages %d to %d" % (lo, hi, lo_t, hi_t)
    return None


def open_problem(card):
    """closed-expect-reopen but the text says the page is open."""
    if card.get("status") != "closed-expect-reopen":
        return None
    for sentence in re.split(r"(?<=\.)\s+", card.get("deadline_text") or ""):
        if SAYS_OPEN.search(sentence) and not NOT_OPEN_NOW.search(sentence):
            return "status is closed-expect-reopen but deadline_text says the page is open"
    return None


def open_label_problem(card):
    """open-now or rolling, but deadline_text says it does not know if applications are open, or all roles are closed or full."""
    if card.get("status") not in ("open-now", "rolling"):
        return None
    text = card.get("deadline_text") or ""
    if UNSURE_OPEN.search(text):
        return "status is %s but deadline_text says the page does not say whether it is open" % card["status"]
    if ALL_CLOSED.search(text):
        return "status is %s but deadline_text says all roles are closed or full" % card["status"]
    return None


def soon_problem(card, today):
    """opens-soon with no opens_iso, or an opens_iso that is already past."""
    if card.get("status") != "opens-soon":
        return None
    iso = card.get("opens_iso")
    if not iso:
        return "status is opens-soon but opens_iso is empty"
    try:
        d = date.fromisoformat(iso)
    except ValueError:
        return "opens_iso %r is not a date" % iso
    if d < today:
        return "status is opens-soon but opens_iso %s is in the past" % iso
    return None


def pay_problem(card):
    """paid_type mixed, but pay_detail has no pay words and says 'not stated'."""
    if card.get("paid_type") != "mixed":
        return None
    detail = card.get("pay_detail") or ""
    if not PAY_WORDS.search(detail) and re.search(r"not stated", detail, re.I):
        return "paid_type is mixed but pay_detail only says not stated"
    return None


def not_stated_pay_problem(card):
    """paid_type not-stated, but pay_detail says a stipend is paid, a paid role or a dollar wage, and never says it is not stated."""
    if card.get("paid_type") != "not-stated":
        return None
    detail = card.get("pay_detail") or ""
    if NOT_STATED_CARD.search(detail):
        return None
    for sentence in re.split(r"(?<=[.;])\s+", detail):
        if PAID_CLAIM.search(sentence) and not NO_CLAIM.search(sentence):
            return "paid_type is not-stated but pay_detail says pay: %s" % sentence.strip()
    return None


def load_entries():
    with open(os.path.join(ROOT, "data", "entries.json"), encoding="utf-8") as fh:
        return json.load(fh)


def load_cards():
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, "data", "programs", "*.json"))):
        with open(f, encoding="utf-8") as fh:
            out.append(json.load(fh))
    return out


class FixtureTests(unittest.TestCase):
    TODAY = date(2026, 10, 11)

    def test_date_flags_open_now_null_iso_future_due(self):
        card = {"status": "open-now", "deadline_iso": None,
                "deadline_text": "Applications are due March 1, 2027."}
        self.assertIsNotNone(date_problem(card, self.TODAY))

    def test_date_ok_with_iso_past_date_or_closed(self):
        t = "Applications are due March 1, 2027."
        self.assertIsNone(date_problem({"status": "open-now", "deadline_iso": "2027-03-01", "deadline_text": t}, self.TODAY))
        self.assertIsNone(date_problem({"status": "open-now", "deadline_iso": None, "deadline_text": "Due May 8, 2026."}, self.TODAY))
        self.assertIsNone(date_problem({"status": "closed-expect-reopen", "deadline_iso": None, "deadline_text": t}, self.TODAY))

    def test_age_flags_outside_range(self):
        for lo, hi in ((13, 18), (14, 20)):
            card = {"min_age": lo, "max_age": hi, "who_can_apply": "Open to teens ages 14 to 18."}
            self.assertIsNotNone(age_problem(card), (lo, hi))

    def test_age_ok_when_match_or_adult_or_or(self):
        ok = {"min_age": 14, "max_age": 18, "who_can_apply": "Open to teens ages 14 to 18."}
        self.assertIsNone(age_problem(ok))
        adult = {"min_age": 10, "max_age": 18, "who_can_apply": "Ages 14 to 18, or ages 10 to 13 with an adult."}
        self.assertIsNone(age_problem(adult))
        orr = {"min_age": 12, "max_age": 18, "who_can_apply": "Ages 14 to 18 or a rising ninth grader."}
        self.assertIsNone(age_problem(orr))

    def test_open_flags_closed_card_saying_open(self):
        card = {"status": "closed-expect-reopen", "deadline_text": "The page says Registration is Now Open."}
        self.assertIsNotNone(open_problem(card))
        card["status"] = "open-now"
        self.assertIsNone(open_problem(card))

    def test_open_label_flags_unsure_or_full(self):
        for t in ("The page does not say whether applications are open.",
                  "All roles are closed for now.", "All positions are full."):
            self.assertIsNotNone(open_label_problem({"status": "open-now", "deadline_text": t}), t)
        self.assertIsNotNone(open_label_problem({"status": "rolling", "deadline_text": "The page does not say whether it is open."}))

    def test_open_label_ok(self):
        self.assertIsNone(open_label_problem({"status": "open-now", "deadline_text": "Apply by May 1."}))
        self.assertIsNone(open_label_problem({"status": "unconfirmed", "deadline_text": "The page does not say whether it is open."}))

    def test_soon_flags_null_or_past(self):
        self.assertIsNotNone(soon_problem({"status": "opens-soon", "opens_iso": None}, self.TODAY))
        self.assertIsNotNone(soon_problem({"status": "opens-soon", "opens_iso": "2026-10-01"}, self.TODAY))

    def test_soon_ok(self):
        self.assertIsNone(soon_problem({"status": "opens-soon", "opens_iso": "2026-12-01"}, self.TODAY))
        self.assertIsNone(soon_problem({"status": "open-now", "opens_iso": None}, self.TODAY))

    def test_pay_flags_mixed_not_stated(self):
        self.assertIsNotNone(pay_problem({"paid_type": "mixed", "pay_detail": "Cost and pay are not stated on the page."}))

    def test_pay_ok(self):
        self.assertIsNone(pay_problem({"paid_type": "mixed", "pay_detail": "Paid for interns, unpaid for volunteers."}))
        self.assertIsNone(pay_problem({"paid_type": "mixed", "pay_detail": "Hourly wage varies."}))
        self.assertIsNone(pay_problem({"paid_type": "not-stated", "pay_detail": "Not stated."}))

    def test_not_stated_pay_flags_stipend_or_wage(self):
        for t in ("A stipend is paid to cover transportation and meals (amount not read).",
                  "Paid summer aide jobs are listed separately.",
                  "Pays $15 per hour."):
            self.assertIsNotNone(not_stated_pay_problem({"paid_type": "not-stated", "pay_detail": t}), t)

    def test_not_stated_pay_ok(self):
        for t in ("Not stated. A stipend is paid.",
                  "The page does not say if the interns are paid.",
                  "Free. No pay or stipend listed.",
                  "Unpaid. Volunteers get a badge.",
                  "The page does not state pay. Ask whether your group is paid."):
            self.assertIsNone(not_stated_pay_problem({"paid_type": "not-stated", "pay_detail": t}), t)
        self.assertIsNone(not_stated_pay_problem({"paid_type": "stipend", "pay_detail": "$200 training stipend"}))


class DataAgreementTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cards = load_cards()

    def _check(self, fn, allow):
        bad = []
        for c in self.cards:
            if c["id"] in allow:
                continue
            msg = fn(c)
            if msg:
                bad.append("%s: %s" % (c["id"], msg))
        self.assertEqual(bad, [], "\n" + "\n".join(bad))

    def test_dates_agree_with_text(self):
        self._check(lambda c: date_problem(c, check_today()), ALLOW_DATE)

    def test_ages_agree_with_text(self):
        self._check(age_problem, ALLOW_AGES)

    def test_closed_cards_do_not_say_open(self):
        self._check(open_problem, ALLOW_OPEN)

    def _check_entries(self, fn, allow):
        bad = []
        for c in load_entries():
            if c["id"] in allow:
                continue
            msg = fn(c)
            if msg:
                bad.append("%s: %s" % (c["id"], msg))
        self.assertEqual(bad, [], "\n" + "\n".join(bad))

    def test_open_labels_agree_with_text(self):
        self._check_entries(open_label_problem, ALLOW_OPEN_LABEL)

    def test_opens_soon_has_a_future_date(self):
        self._check_entries(lambda c: soon_problem(c, check_today()), ALLOW_SOON)

    def test_mixed_pay_says_something(self):
        self._check_entries(pay_problem, ALLOW_PAY)

    def test_not_stated_pay_does_not_hide_a_stipend(self):
        self._check_entries(not_stated_pay_problem, ALLOW_NOT_STATED_PAY)

    def test_allow_list_ids_exist(self):
        ids = {c["id"] for c in self.cards}
        for allow in (ALLOW_DATE, ALLOW_AGES, ALLOW_OPEN):
            for i in allow:
                self.assertIn(i, ids)
        entry_ids = {c["id"] for c in load_entries()}
        for allow in (ALLOW_OPEN_LABEL, ALLOW_SOON, ALLOW_PAY, ALLOW_NOT_STATED_PAY):
            for i in allow:
                self.assertIn(i, entry_ids)


if __name__ == "__main__":
    unittest.main()
