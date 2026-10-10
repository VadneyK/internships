#!/usr/bin/env python3
"""Validate every file in data/programs/. Exit code 1 if anything is wrong.

Run it before you open a pull request:  python3 tools/validate.py
"""
import collections
import re
import sys

import proglib


def main():
    schema = proglib.load_schema()
    programs = proglib.load_programs()
    problems = []
    urls = collections.defaultdict(list)
    ids = collections.Counter()
    names = collections.defaultdict(list)
    for path, data in programs:
        problems += proglib.validate_program(path, data, schema)
        ids[data.get("id")] += 1
        if data.get("url"):
            urls[data["url"].rstrip("/").lower()].append(data.get("id"))
        if isinstance(data.get("org"), str) and isinstance(data.get("name"), str):
            key = tuple(re.sub(r"[^a-z0-9]+", " ", s.lower()).strip() for s in (data["org"], data["name"]))
            names[key].append(data.get("id"))
    for i, n in ids.items():
        if n > 1:
            problems.append("duplicate id: %s" % i)
    for u, owners in urls.items():
        if len(owners) > 1:
            problems.append("same official url used by %s: %s (merge them or make the url specific)" % (", ".join(owners), u))
    for (org, name), owners in names.items():
        if len(owners) > 1:
            problems.append("same org and name on more than one card (%s): %s %s" % (", ".join(owners), org, name))
    if problems:
        print("\n".join(problems))
        print("\n%d problem(s) in %d programs" % (len(problems), len(programs)))
        return 1
    print("OK: %d programs valid" % len(programs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
