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
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
SCHEMA_DIR = os.path.join(DATA, "schema")
# Hand-edited data files that have a JSON Schema: name -> (data file, schema file).
SCHEMA_FILES = {
    "permits": os.path.join(DATA, "permits.json"),
    "states-lite": LITE,
    "state-wages": WAGES,
    "employers": os.path.join(DATA, "employers.json"),
}
# The schema file for each name above, spelled out so a search for a data file finds its user.
SCHEMA_NAMES = {
    "permits": "permits.schema.json",
    "states-lite": "states-lite.schema.json",
    "state-wages": "state-wages.schema.json",
    "employers": "employers.schema.json",
}
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
                if fig in quote:
                    continue
                if field == "wage":
                    out.append("state-wages %s: %s figure %s is not in quote" % (row.get("id"), field, fig))
                    continue
                # A youth figure that the state quote does not hold needs its own
                # federal source: youth_url (https) and youth_quote, both present,
                # and the youth_quote must contain the figure.
                url, yq = row.get("youth_url"), row.get("youth_quote")
                if not isinstance(url, str) or not url.startswith("https://") or not isinstance(yq, str) or not yq.strip():
                    out.append("state-wages %s: youth figure %s is not in quote and needs a youth_url (https) and a youth_quote" % (row.get("id"), fig))
                elif fig not in yq:
                    out.append("state-wages %s: youth figure %s is not in youth_quote" % (row.get("id"), fig))
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


def schema_problems(files=None):
    """Check permits, states-lite, state-wages and employers against data/schema/<name>.schema.json.

    Returns one line per problem, as "<name>: <where>: <message>". `files` maps a name to a data
    path (tests use it to point at fixtures). Employer groups must come from the file's own groups list.
    """
    try:
        import jsonschema  # type: ignore
    except ImportError:
        return ["data schemas: install jsonschema to validate (pip install jsonschema)"]
    out = []
    for name, default_path in SCHEMA_FILES.items():
        path = (files or {}).get(name, default_path)
        with open(os.path.join(SCHEMA_DIR, SCHEMA_NAMES[name]), encoding="utf-8") as f:
            schema = json.load(f)
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError) as err:
            out.append("%s: cannot read %s: %s" % (name, os.path.basename(path), err))
            continue
        validator = jsonschema.Draft202012Validator(schema)
        for err in sorted(validator.iter_errors(data), key=lambda e: [str(p) for p in e.path]):
            where = ".".join(str(p) for p in err.path) or "(file)"
            out.append("%s: %s: %s" % (name, where, err.message.splitlines()[0][:200]))
        if name == "employers" and isinstance(data, dict):
            ids = {g[0] for g in data.get("groups", []) if isinstance(g, list) and g}
            for i, row in enumerate(data.get("employers", [])):
                if isinstance(row, dict) and row.get("group") not in ids:
                    out.append("employers: employers.%d.group: %r is not in the file's groups list" % (i, row.get("group")))
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
    problems += schema_problems()
    if problems:
        print("\n".join(problems))
        print("\n%d problem(s) in %d programs" % (len(problems), len(programs)))
        return 1
    print("OK: %d programs valid" % len(programs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
