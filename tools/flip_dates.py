#!/usr/bin/env python3
"""Flip a program's status when a date already on its card arrives or passes.

Two flips only, and only from opens_iso and deadline_iso (no text is read or changed):
  - opens-soon and opens_iso has arrived, deadline not passed: status open-now, opens_iso null.
  - open-now or opens-soon and deadline_iso has passed: status closed-expect-reopen,
    deadline_iso null (and opens_iso null).
A flip to closed is held for a person when deadline_text says the program is open, because
the closed card would then say open in its own text. Held cards are listed, not written.

The default date is today in UTC, the clock CI runs on. Dry run unless --write.

  python3 tools/flip_dates.py [--today 2026-10-13] [--write]
"""
import argparse
import datetime as dt
import json
import re
import sys

import proglib

SAYS_OPEN = re.compile(r"\b(?:is|are|now)\s+open\b|\bopen now\b|\baccepting\b", re.I)


def plan_flip(card, today):
    """Return (new_fields, None), (None, reason to hold) or (None, None) when nothing is due."""
    status = card.get("status")
    if status not in ("open-now", "opens-soon"):
        return None, None
    opens = proglib.parse_iso(card.get("opens_iso"))
    close = proglib.parse_iso(card.get("deadline_iso"))
    if close and close < today:
        if SAYS_OPEN.search(card.get("deadline_text") or ""):
            return None, "deadline %s passed but deadline_text says it is open" % card["deadline_iso"]
        return {"status": "closed-expect-reopen", "deadline_iso": None, "opens_iso": None}, None
    if status == "opens-soon" and opens and opens <= today:
        return {"status": "open-now", "opens_iso": None}, None
    return None, None


def set_field(text, key, value):
    """Change one top-level "key": value line in a card file, keeping the file's own layout."""
    pat = re.compile(r'^(  "%s": )(?:"[^"\n]*"|null)(,?)$' % re.escape(key), re.M)
    new, n = pat.subn(lambda m: m.group(1) + json.dumps(value) + m.group(2), text, count=1)
    if n != 1:
        raise ValueError("field %s not found on its own line" % key)
    return new


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--today", help="YYYY-MM-DD, default today in UTC")
    ap.add_argument("--write", action="store_true", help="write the flips (default is a dry run)")
    args = ap.parse_args(argv)
    today = dt.date.fromisoformat(args.today) if args.today else dt.datetime.now(dt.timezone.utc).date()
    flips, held = [], []
    for path, card in proglib.load_programs():
        change, reason = plan_flip(card, today)
        if reason:
            held.append((card["id"], reason))
        if not change:
            continue
        flips.append((card["id"], card["status"], change["status"]))
        if args.write:
            with open(path, encoding="utf-8") as f:
                text = f.read()
            for key, value in change.items():
                if card.get(key) != value:
                    text = set_field(text, key, value)
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
    for cid, old, new in flips:
        print("%s %s: %s to %s" % ("flipped" if args.write else "would flip", cid, old, new))
    for cid, reason in held:
        print("HOLD %s: %s (fix by hand from the official page)" % (cid, reason))
    print("%d flip(s), %d held, date %s%s" % (len(flips), len(held), today, "" if args.write else " (dry run)"))
    return 1 if held else 0


if __name__ == "__main__":
    sys.exit(main())
