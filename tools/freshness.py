#!/usr/bin/env python3
"""List programs that need a person to re-read the official page. Writes a Markdown checklist.

A program needs a refresh when:
  - nobody has verified it in the last --days days (default 120), or
  - its deadline passed more than a week ago and it is not rolling, so the next cycle's dates are probably posted, or
  - it is still marked snippet-only (we never read the official page).

  python3 tools/freshness.py [--days 120] [--today 2026-11-01] [--out refresh.md]
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
    if close and (today - close).days > 7 and d["status"] not in ("rolling", "year-round"):
        reasons.append("deadline %s has passed; look for next year's dates" % d["deadline_iso"])
    if d["verified"] != "fetched":
        reasons.append("official page was never read")
    return reasons


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=120)
    ap.add_argument("--today")
    ap.add_argument("--out")
    args = ap.parse_args()
    today = dt.date.fromisoformat(args.today) if args.today else dt.date.today()

    rows = []
    for _, d in proglib.load_programs():
        r = needs_refresh(d, today, args.days)
        if r:
            rows.append((d, r))
    rows.sort(key=lambda x: (x[0]["regions"][0], x[0]["name"]))
    lines = ["# Refresh list for %s" % today.isoformat(), "",
             "%d programs need a person to re-read the official page. See docs/VERIFYING.md for the checklist." % len(rows), ""]
    for d, r in rows:
        lines.append("- [ ] **%s** (`%s`, %s): %s. %s" % (d["name"], d["id"], "/".join(d["regions"][:2]), "; ".join(r), d["url"]))
    text = "\n".join(lines)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
