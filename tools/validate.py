#!/usr/bin/env python3
"""Validate every file in data/programs/. Exit code 1 if anything is wrong.

Run it before you open a pull request:  python3 tools/validate.py
"""
import collections
import sys

import proglib


def main():
    schema = proglib.load_schema()
    programs = proglib.load_programs()
    problems = []
    urls = collections.defaultdict(list)
    ids = collections.Counter()
    for path, data in programs:
        problems += proglib.validate_program(path, data, schema)
        ids[data.get("id")] += 1
        if data.get("url"):
            urls[data["url"].rstrip("/").lower()].append(data.get("id"))
    for i, n in ids.items():
        if n > 1:
            problems.append("duplicate id: %s" % i)
    for u, owners in urls.items():
        if len(owners) > 1:
            problems.append("same official url used by %s: %s (merge them or make the url specific)" % (", ".join(owners), u))
    if problems:
        print("\n".join(problems))
        print("\n%d problem(s) in %d programs" % (len(problems), len(programs)))
        return 1
    print("OK: %d programs valid" % len(programs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
