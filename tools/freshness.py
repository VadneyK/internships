#!/usr/bin/env python3
"""List programs that need a person to re-read the official page. Writes a Markdown checklist.

A program needs a refresh when:
  - nobody has verified it in the last --days days (default 120), or
  - its status is open-now or opens-soon and its deadline has passed (flagged the same day), or
  - its status is opens-soon and its opening date has arrived (flagged the same day), or
  - its status is open-now and its opening date is still in the future, or
  - its deadline passed more than a week ago and it is not rolling, so the next cycle's dates are probably posted, or
  - it is still marked snippet-only (we never read the official page).

The checklist in --out lists only the --max-items most urgent programs (default 150), because
GitHub limits an issue body to 65,536 characters. --full-out writes every program, same order.
Urgency order: status says open but the dates disagree, then a deadline passed more than a week ago,
then never read on the official page, then everything else. Inside each group the oldest verified_on
comes first, ties by region then name.

  python3 tools/freshness.py [--days 120] [--today 2026-11-01] [--out refresh.md]
                             [--max-items 150] [--full-out refresh-full.md]
"""
import argparse
import datetime as dt
import sys

import proglib


def needs_refresh(d, today, days):
    reasons = []
    verified = dt.date.fromisoformat(d["verified_on"])
    age = (today - verified).days
    if age > days:
        reasons.append("last verified %d days ago" % age)
    close = proglib.parse_iso(d.get("deadline_iso"))
    if close and d["status"] in ("open-now", "opens-soon") and close < today:
        reasons.append("status says open but the deadline %s has passed; mark it closed-expect-reopen" % d["deadline_iso"])
    elif close and (today - close).days > 7 and d["status"] not in ("rolling", "year-round"):
        reasons.append("deadline %s has passed; look for next year's dates" % d["deadline_iso"])
    opens = proglib.parse_iso(d.get("opens_iso"))
    if opens and d["status"] == "opens-soon" and opens <= today:
        reasons.append("status says opens soon but the opening date %s has arrived; mark it open-now" % d["opens_iso"])
    if opens and d["status"] == "open-now" and opens > today:
        reasons.append("status says open now but it does not open until %s" % d["opens_iso"])
    if d["verified"] != "fetched":
        reasons.append("official page was never read")
    return reasons


def urgency_tier(d, today):
    """0 = status contradicts the dates, 1 = deadline passed over a week ago, 2 = never read, 3 = just old."""
    close = proglib.parse_iso(d.get("deadline_iso"))
    opens = proglib.parse_iso(d.get("opens_iso"))
    if close and d["status"] in ("open-now", "opens-soon") and close < today:
        return 0
    if opens and d["status"] == "opens-soon" and opens <= today:
        return 0
    if opens and d["status"] == "open-now" and opens > today:
        return 0
    if close and (today - close).days > 7 and d["status"] not in ("rolling", "year-round"):
        return 1
    if d["verified"] != "fetched":
        return 2
    return 3


def urgency_key(d, today):
    return (urgency_tier(d, today), d["verified_on"], d["regions"][0], d["name"])


def build_text(today, rows, intro):
    lines = ["# Refresh list for %s" % today.isoformat(), "", intro, ""]
    for d, r in rows:
        lines.append("- [ ] **%s** (`%s`, %s): %s. %s" % (d["name"], d["id"], "/".join(d["regions"][:2]), "; ".join(r), d["url"]))
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=120)
    ap.add_argument("--today")
    ap.add_argument("--out")
    ap.add_argument("--max-items", type=int, default=150,
                    help="most programs to put in --out (default 150); the rest only go in --full-out")
    ap.add_argument("--full-out", help="write the complete list, same order, to this path")
    args = ap.parse_args()
    if args.max_items < 1:
        ap.error("--max-items must be at least 1")
    today = dt.date.fromisoformat(args.today) if args.today else dt.date.today()

    rows = []
    for _, d in proglib.load_programs():
        r = needs_refresh(d, today, args.days)
        if r:
            rows.append((d, r))
    rows.sort(key=lambda x: urgency_key(x[0], today))
    total = len(rows)
    full_intro = "%d programs need a person to re-read the official page. See docs/VERIFYING.md for the checklist." % total
    shown = rows[:args.max_items]
    if len(shown) < total:
        intro = "%d programs need a look. Showing the %d most urgent." % (total, len(shown))
        if args.full_out:
            intro += " The full list is attached to the workflow run."
        intro += " See docs/VERIFYING.md for the checklist."
    else:
        intro = full_intro
    text = build_text(today, shown, intro)
    if args.full_out:
        with open(args.full_out, "w", encoding="utf-8") as f:
            f.write(build_text(today, rows, full_intro) + "\n")
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
