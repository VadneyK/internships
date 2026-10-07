"""Shared helpers for the data tools: load program files, validate them, format dates."""
import datetime as dt
import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROGRAMS_DIR = os.path.join(ROOT, "data", "programs")
SCHEMA_PATH = os.path.join(ROOT, "data", "schema", "program.schema.json")
DASHES = ("\u2014", "\u2013")  # em dash and en dash are not allowed anywhere in our text


def load_schema():
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_programs(directory=PROGRAMS_DIR):
    """Return [(path, data)] sorted by file name."""
    out = []
    for path in sorted(glob.glob(os.path.join(directory, "*.json"))):
        if os.path.basename(path).startswith("_"):
            continue  # files starting with an underscore are templates, not programs
        with open(path, encoding="utf-8") as f:
            out.append((path, json.load(f)))
    return out


def iter_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from iter_strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from iter_strings(v)


def parse_iso(s):
    return dt.date.fromisoformat(s) if s else None


def validate_program(path, data, schema=None):
    """Return a list of human-readable problems (empty list means the file is fine)."""
    problems = []
    name = os.path.basename(path)
    try:
        import jsonschema  # type: ignore
        validator = jsonschema.Draft202012Validator(schema or load_schema())
        for err in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
            where = ".".join(str(p) for p in err.path) or "(file)"
            problems.append("%s: %s: %s" % (name, where, err.message))
    except ImportError:
        problems.append("%s: install jsonschema to validate (pip install jsonschema)" % name)
        return problems

    if data.get("id") and name != data["id"] + ".json":
        problems.append("%s: file name must be <id>.json (id is %r)" % (name, data["id"]))
    for text in iter_strings(data):
        for ch in DASHES:
            if ch in text:
                problems.append("%s: contains a dash character U+%04X; use a comma, colon or the word 'to'" % (name, ord(ch)))
                break
    for key in ("deadline_iso", "verified_on", "opens_iso"):
        val = data.get(key)
        if val:
            try:
                dt.date.fromisoformat(val)
            except ValueError:
                problems.append("%s: %s is not a real date: %s" % (name, key, val))
    lo, hi = data.get("min_age"), data.get("max_age")
    if lo is not None and hi is not None and lo > hi:
        problems.append("%s: min_age is greater than max_age" % name)
    if data.get("status") == "opens-soon" and not data.get("opens_iso"):
        problems.append("%s: status opens-soon needs opens_iso" % name)
    if data.get("deadline_iso") and data.get("deadline_confidence") != "confirmed-2026-27":
        problems.append("%s: deadline_iso is only for dates confirmed for 2026-27; leave it null and put last year's dates in deadline_text" % name)
    if data.get("verified") == "fetched" and not data.get("sources_fetched"):
        problems.append("%s: verified=fetched but sources_fetched is empty" % name)
    if data.get("paid_type") == "fee-based" and not data.get("pay_detail"):
        problems.append("%s: fee-based programs must say the cost in pay_detail" % name)
    if data.get("url") and re.search(r"\s", data["url"]):
        problems.append("%s: url contains whitespace" % name)
    return problems


def date_label(iso):
    d = dt.date.fromisoformat(iso)
    return d.strftime("%b ") + str(d.day) + d.strftime(", %Y")
