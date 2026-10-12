"""An event card with no deadline_iso must not read as Apply any time when its own text only dates a past event.

Ticket r2-tests-2. An event card has status "event" and no deadline_iso, so the site shows
it as "Apply any time". If the card's deadline_text only names dates that have already
passed (and no later year as an upcoming date), the card is probably out of date and
should be closed-expect-reopen instead. A card on ALLOW_PAST_EVENT keeps the status with a reason.

Date reading rules (fixed test day, 2026-10-10):
- A full date ("Feb 7, 2026", "May 17 to 19, 2026") counts as a date. Full names and short
  names are both read. The end of a "to" range is read too.
- A bare 4 digit year counts only in a sentence with no negation (not, no, never, pending,
  TBA, TBD). So "2027 date not posted" does not count as a later year.
- If there is any full date, the latest full date is the latest date. A bare year alone is
  read as December 31 of that year, so a current-year mention is never called past.
- A date on or after 2026-10-10, or a bare year after 2026, means upcoming. Such a card is not flagged.
"""
import glob
import json
import os
import re
import unittest
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROGRAMS = os.path.join(ROOT, "data", "programs")
TODAY = date(2026, 10, 10)

MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
MONTH_NAMES = (r"January|February|March|April|May|June|July|August|September|October|November|December"
               r"|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec")
FULL_DATE = re.compile(r"\b(%s)\.?\s+(\d{1,2})(?:\s+to\s+(\d{1,2}))?,\s*(\d{4})\b" % MONTH_NAMES, re.I)
BARE_YEAR = re.compile(r"\b(?:19|20)\d{2}\b")
NEGATED = re.compile(r"\bnot\b|\bno\b|\bnever\b|\bpending\b|\bTBA\b|\bTBD\b", re.I)
SENTENCE_END = re.compile(r"(?<=[.;!?])\s+")

# id -> reason. Empty: the two cards that broke this rule (albuquerque-youth-job-and-volunteer-fair
# and pennsylvania-junior-academy-of-science) were moved to closed-expect-reopen on 2026-10-10.
ALLOW_PAST_EVENT = {}


def _date_or_none(year, month_name, day):
    try:
        return date(int(year), MONTHS[month_name[:3].lower()], int(day))
    except (KeyError, ValueError):
        return None


def read_dates(text):
    """Return (full_dates, upcoming_bare_years, past_bare_years) read from a deadline_text."""
    full_dates = []
    rest = text or ""
    for m in FULL_DATE.finditer(text or ""):
        month_name, d1, d2, year = m.group(1), m.group(2), m.group(3), m.group(4)
        for day in (d1, d2):
            if day is None:
                continue
            d = _date_or_none(year, month_name, day)
            if d is not None:
                full_dates.append(d)
    rest = FULL_DATE.sub(" ", rest)
    bare_years = []
    for sentence in SENTENCE_END.split(rest):
        if NEGATED.search(sentence):
            continue
        bare_years += [int(y) for y in BARE_YEAR.findall(sentence)]
    return full_dates, bare_years


def is_past_only(text, today=TODAY):
    """True when the text dates something, every date is before today, and no later year is upcoming."""
    full_dates, bare_years = read_dates(text)
    if not full_dates and not bare_years:
        return False
    if any(d >= today for d in full_dates):
        return False
    if any(y > today.year for y in bare_years):
        return False
    if full_dates:
        latest = max(full_dates)
    else:
        latest = date(max(bare_years), 12, 31)
    return latest < today


def card_flagged(card, today=TODAY):
    """An event card with no deadline_iso whose deadline_text only names past dates."""
    if card.get("status") != "event" or card.get("deadline_iso"):
        return False
    return is_past_only(card.get("deadline_text") or "", today)


def load_programs():
    out = {}
    for path in sorted(glob.glob(os.path.join(PROGRAMS, "*.json"))):
        with open(path, encoding="utf-8") as f:
            card = json.load(f)
        out[card["id"]] = card
    return out


ALBUQUERQUE = ("2026 fair was Saturday Feb 7, 2026, 10 a.m. to 2 p.m. at the Berna Facio "
               "Professional Development Center. 2027 date not posted.")
PA_JUNIOR = ("The 2026 State Meet was May 17 to 19, 2026 at Penn State University Park. "
             "Each region sets its own deadlines. The program pages do not list 2027 dates.")


class PastEventFixtures(unittest.TestCase):
    def test_rule_fires_on_past_only_text(self):
        self.assertTrue(is_past_only(ALBUQUERQUE))
        self.assertTrue(is_past_only(PA_JUNIOR))
        self.assertTrue(is_past_only("The fair was March 3, 2025."))
        self.assertTrue(is_past_only("Held in 2025 only."))
        self.assertTrue(is_past_only("The 2025 event was Oct 1 to 2, 2025."))

    def test_rule_does_not_fire(self):
        self.assertFalse(is_past_only("Provincials: April 14, 2027"))
        self.assertFalse(is_past_only("Round 2 is October 20 to 21, 2026."))
        self.assertFalse(is_past_only("Opens in 2027. The 2025 fair was March 3, 2025."))
        self.assertFalse(is_past_only("Apply any time"))
        self.assertFalse(is_past_only(""))
        self.assertFalse(is_past_only(None))
        self.assertFalse(is_past_only("2027 dates not posted"))
        self.assertFalse(is_past_only("The 2026 fair was in the spring."))
        self.assertFalse(is_past_only("Feb 30, 2025"))

    def test_only_event_cards_with_null_deadline_iso_are_checked(self):
        past = "The fair was March 3, 2025."
        self.assertTrue(card_flagged({"status": "event", "deadline_iso": None, "deadline_text": past}))
        self.assertFalse(card_flagged({"status": "rolling", "deadline_iso": None, "deadline_text": past}))
        self.assertFalse(card_flagged({"status": "event", "deadline_iso": "2026-11-01", "deadline_text": past}))
        self.assertTrue(card_flagged({"status": "event", "deadline_text": past}))

    def test_negated_later_year_does_not_block_the_rule(self):
        self.assertTrue(is_past_only(ALBUQUERQUE))
        self.assertTrue(is_past_only("Held Feb 7, 2026. 2027 dates are not posted."))


class PastEventCards(unittest.TestCase):
    def test_event_cards_with_only_past_dates_are_allow_listed(self):
        programs = load_programs()
        self.assertTrue(programs, "no program files found")
        flagged = sorted(cid for cid, card in programs.items() if card_flagged(card))
        unlisted = [cid for cid in flagged if cid not in ALLOW_PAST_EVENT]
        self.assertEqual(
            unlisted, [],
            "event cards with null deadline_iso whose deadline_text only dates past events "
            "(set status closed-expect-reopen, or add the id to ALLOW_PAST_EVENT with a reason): "
            + ", ".join(unlisted))

    def test_allow_list_entries_still_break_the_rule(self):
        programs = load_programs()
        for cid, reason in ALLOW_PAST_EVENT.items():
            self.assertTrue(reason, cid + " needs a reason")
            card = programs.get(cid)
            self.assertIsNotNone(card, cid + " is not a program file")
            self.assertTrue(card_flagged(card),
                            cid + ": remove this allow-list entry, the card is fixed")


if __name__ == "__main__":
    unittest.main()
