#!/usr/bin/env python3
"""Validate every file in data/programs/. Exit code 1 if anything is wrong.

Run it before you open a pull request:  python3 tools/validate.py
"""
import collections
import json
import os
import re
import sys

import proglib

LITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "states-lite.json")
WAGES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "state-wages.json")
DOLLAR = re.compile(r"\$\d+(?:,\d{3})*(?:\.\d+)?")


def wage_problems():
    """Each state-wages row needs a quote, and every dollar figure in its wage or youth text must appear in that quote."""
    with open(WAGES, encoding="utf-8") as f:
        rows = json.load(f)["states"]
    out = []
    for row in rows:
        quote = row.get("quote")
        if not isinstance(quote, str) or not quote.strip():
            out.append("state-wages %s: no quote" % row.get("id"))
            continue
        for field in ("wage", "youth"):
            for fig in DOLLAR.findall(row.get(field) or ""):
                if fig not in quote:
                    out.append("state-wages %s: %s figure %s is not in quote" % (row.get("id"), field, fig))
    return out


def lite_problems():
    """Each states-lite row needs a source_excerpt, and its quote must appear word for word in that excerpt."""
    with open(LITE, encoding="utf-8") as f:
        rows = json.load(f)["states"]
    out = []
    for row in rows:
        ex, quote = row.get("source_excerpt"), row.get("quote")
        if not isinstance(ex, str) or not ex.strip():
            out.append("states-lite %s: no source_excerpt" % row.get("id"))
        elif not isinstance(quote, str) or quote not in ex:
            out.append("states-lite %s: quote is not in source_excerpt" % row.get("id"))
    return out


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
    problems += lite_problems()
    problems += wage_problems()
    if problems:
        print("\n".join(problems))
        print("\n%d problem(s) in %d programs" % (len(problems), len(programs)))
        return 1
    print("OK: %d programs valid" % len(programs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
