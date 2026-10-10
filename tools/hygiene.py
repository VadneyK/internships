#!/usr/bin/env python3
"""Soft data checks that need a person's eye. Writes a Markdown checklist.

These are not validator errors, because each one needs judgment. The report is read only:
it never edits data, makes no network calls, and always exits 0, so it cannot fail CI.

A program is listed when:
  (a) its status is open-now or opens-soon and its deadline_text or notes admit the page printed no year,
  (b) its status is rolling, open-now or year-round and its deadline_text says full, closed or waitlist,
  (c) its min_age is under 12, or its max_age is under 14 or over 25,
  (d) its url is a site home page but sources_fetched has a deeper page on the same host.

Same list order as the other reports: first region, then name.

  python3 tools/hygiene.py [--out hygiene.md]
"""
import argparse
import re
import sys
from urllib.parse import urlsplit

import proglib

NO_YEAR = re.compile(r"no year|without a year|year is not|not (give|state|show|print)\w* (a |the )?year", re.I)
CLOSED_WORDS = re.compile(r"\b(full|waitlist|wait list|closed|not accepting|no longer accepting)\b", re.I)


def _is_root(path):
    return path in ("", "/")


def soft_checks(card):
    """Return a list of reason strings for one program (empty list means nothing to look at)."""
    reasons = []
    status = card.get("status")
    text = card.get("deadline_text") or ""
    notes = card.get("notes") or ""

    if status in ("open-now", "opens-soon") and (NO_YEAR.search(text) or NO_YEAR.search(notes)):
        reasons.append("status says %s but the page printed no year; check the dates against the official page" % status)

    if status in ("rolling", "open-now", "year-round") and CLOSED_WORDS.search(text):
        reasons.append("status is %s but the deadline text mentions full, closed or a waitlist; check if it is really taking applications" % status)

    lo, hi = card.get("min_age"), card.get("max_age")
    if isinstance(lo, int) and lo < 12:
        reasons.append("min_age %d is under 12; check the age rule on the page" % lo)
    if isinstance(hi, int) and hi < 14:
        reasons.append("max_age %d is under 14; check the age rule on the page" % hi)
    elif isinstance(hi, int) and hi > 25:
        reasons.append("max_age %d is over 25; check the age rule on the page" % hi)

    url = card.get("url") or ""
    parts = urlsplit(url)
    if parts.netloc and _is_root(parts.path):
        for src in card.get("sources_fetched") or []:
            sp = urlsplit(src)
            if sp.netloc.lower() == parts.netloc.lower() and not _is_root(sp.path):
                reasons.append("url is a home page but a deeper page was read: %s; consider linking to it" % src)
                break
    return reasons


def build_text(rows):
    intro = "%d programs have a soft data problem that needs a person's eye. Nothing here is a hard error." % len(rows)
    lines = ["# Data hygiene report", "", intro, ""]
    for d, r in rows:
        lines.append("- [ ] **%s** (`%s`, %s): %s. %s" % (d["name"], d["id"], "/".join(d["regions"][:2]), "; ".join(r), d["url"]))
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="also write the checklist to this path")
    args = ap.parse_args(argv)

    rows = []
    for _, d in proglib.load_programs():
        r = soft_checks(d)
        if r:
            rows.append((d, r))
    rows.sort(key=lambda x: (x[0]["regions"][0], x[0]["name"]))
    text = build_text(rows)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
