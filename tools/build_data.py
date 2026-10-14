#!/usr/bin/env python3
"""Combine data/programs/*.json into the files the website reads:

  data/entries.json  all programs, one array
  data/entries.csv   same, as a spreadsheet
  data/entries-lite.json  same ids and order, without the long text fields (small file for pages that show a few fields)
  data/entries-core.json  same ids and order, only the keys lib.js needs to match by age (tiny file for the Ages 12 to 14 page)
  data/entries-cal.json  same card keys and order, only the programs named in data/calendar.json (the Calendar page)
  data/entries-stats.json  same ids and order, only the keys the Numbers page counts with
  data/entries-home.json  same ids and order, only the keys the Home picker reads
  data/entries-detail.json  same ids and order, only id plus the long text (who_can_apply, how_to_apply, notes) a program has, read when a card is opened
  data/lite/<group>.json  the lite cards of one Where group (see PICK_GROUPS in assets/js/lib.js), same card shape and id order as entries-lite.json;
                          data/lite/shared.json holds the online and national cards every place can see
  data/detail/<group>.json  the detail rows (same shape as entries-detail.json) for the same cards as the matching data/lite file
  data/meta.json     counts and the "last checked" date shown in the footer

Run:  python3 tools/build_data.py        (then python3 tools/build.py for the pages)
"""
import csv
import json
import os
import re
import sys

import proglib

OUT_DIR = os.path.join(proglib.ROOT, "data")
# Cards only some teens can join: one place's residents, or girls or boys only. The lite cards carry "limited": true so the
# Programs page can keep them out of "Good fit for you" when open cards fit. Statewide or national residency is not a limit here.
_STATES = ("alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|"
           "kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|"
           "new mexico|new york state|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|"
           "texas|utah|vermont|virginia|washington state|west virginia|wisconsin|wyoming|british columbia|u\\.?s\\.?|united states|state")
NOT_A_LIMIT = re.compile(r"boys (?:&|and) girls|not (?:just|only) for (?:girls|boys)|(?:any|all) genders?|live in (?:the )?(?:\w+ )?dorms?|"
                         r"live in (?:leadership|program)|permanent residents?|(?:%s) residents?|residents? of (?:the )?(?:%s)" % (_STATES, _STATES), re.I)
LIMIT = re.compile(r"\bresidents?\b|\bmust live\b|\blives? in\b|\bgirls\b|\byoung women\b|\bboys\b|\byoung men\b|\bgender", re.I)


def is_limited(d):
    text = " ".join(str(d.get(k) or "") for k in ("who_can_apply", "what_you_do", "name"))
    return bool(LIMIT.search(NOT_A_LIMIT.sub("", text)))


LITE_DROP = ("notes", "sources_fetched", "how_to_apply", "who_can_apply", "duration", "pay_detail", "verified_on")
CORE_KEYS = ("id", "min_age", "max_age", "status", "deadline_iso", "opens_iso", "regions", "season")
CARD_KEYS = (
    "id", "name", "org", "city", "url", "paid_type", "type", "fields", "grades", "needs_work_permit", "verified", "priority",
    "deadline_confidence", "min_age", "max_age", "status", "deadline_iso", "opens_iso", "regions", "season",
)
# Only the keys lib.insights() reads (the Numbers page): type, fields, paid_type, regions, status, ages, season, verified, needs_work_permit, deadline dates, id, name.
STATS_KEYS = (
    "id", "name", "paid_type", "type", "fields", "needs_work_permit", "verified", "min_age", "max_age", "status",
    "deadline_iso", "opens_iso", "regions", "season",
)
# Only the keys home.js, L.matches, L.sortList, L.placeCounts and L.futureDeadline read (found with a Proxy run in tests/r2-a11y-perf-6-home-file.test.mjs). url is read for the closing-soon "Official page" link.
HOME_KEYS = (
    "id", "name", "org", "city", "url", "paid_type", "fields", "priority", "deadline_confidence", "min_age", "max_age",
    "status", "deadline_iso", "opens_iso", "regions", "verified",
)
SOON_ONLY_KEYS = ("name", "org", "city", "url")
DETAIL_KEYS = ("who_can_apply", "how_to_apply", "notes", "duration", "pay_detail")
CSV_COLUMNS = [
    "id", "name", "org", "city", "regions", "type", "fields", "min_age", "max_age", "grades", "paid_type", "pay_detail",
    "season", "duration", "status", "deadline_text", "deadline_iso", "deadline_confidence", "needs_work_permit",
    "who_can_apply", "how_to_apply", "url", "apply_url", "verified", "verified_on", "notes",
]


LIB_JS = os.path.join(proglib.ROOT, "assets", "js", "lib.js")
SHARED_REGIONS = ("virtual", "national")


def _js_value(src, name):
    """The array literal after 'var NAME = ' in lib.js, read as JSON (the arrays there are plain nested lists of double-quoted strings)."""
    m = re.search(r"\bvar %s = \[" % name, src)
    if not m:
        raise SystemExit("build_data: cannot find %s in assets/js/lib.js" % name)
    start = m.end() - 1
    depth, i, in_str = 0, start, False
    while i < len(src):
        c = src[i]
        if in_str:
            if c == "\\":
                i += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return json.loads(re.sub(r"/\*.*?\*/", "", src[start:i + 1], flags=re.S))
        i += 1
    raise SystemExit("build_data: unbalanced brackets in %s" % name)


def pick_groups():
    """[(slug, label, set of region ids)] for each Where group in lib.js PICK_GROUPS, in order. A group's regions are the regions of its cities and states."""
    with open(LIB_JS, encoding="utf-8") as f:
        src = f.read()
    cities = {c[0]: c[2] for c in _js_value(src, "CITIES")}
    states = {x[0]: [x[2]] for x in _js_value(src, "STATES")}
    groups = _js_value(src, "PICK_GROUPS")
    for m in re.finditer(r"PICK_GROUPS\[(\d+)\]\.push\((\[[^\]]*\])\);", src):
        groups[int(m.group(1))].append(json.loads(m.group(2)))
    out = []
    for g in groups:
        regions = set()
        for cid in g[2]:
            regions.update(cities[cid])
        for sid in g[3]:
            regions.update(states[sid])
        out.append((re.sub(r"[^a-z0-9]+", "-", g[0].lower()).strip("-"), g[0], regions))
    return out


def write_chunks(lite, detail):
    """data/lite/<slug>.json and data/detail/<slug>.json per Where group, plus shared. Every file is written, even when empty, so the file set never changes with the data.
    A card is in shared when it has an online or national region. Otherwise it is in each group whose regions it touches (a card that spans groups is in each of them).
    A place loads its group chunks plus shared and gets every card L.matches shows for it, with or without the online and national widening."""
    groups = pick_groups()
    sets = [("shared", lambda c: any(r in SHARED_REGIONS for r in c.get("regions") or []))]
    for slug, _label, regions in groups:
        sets.append((slug, (lambda rs: lambda c: not any(r in SHARED_REGIONS for r in c.get("regions") or []) and any(r in rs for r in c.get("regions") or []))(regions)))
    for folder in ("lite", "detail"):
        os.makedirs(os.path.join(OUT_DIR, folder), exist_ok=True)
    for slug, test in sets:
        idx = [i for i, c in enumerate(lite) if test(c)]
        for folder, rows in (("lite", lite), ("detail", detail)):
            with open(os.path.join(OUT_DIR, folder, slug + ".json"), "w", encoding="utf-8") as f:
                json.dump([rows[i] for i in idx], f, ensure_ascii=False, separators=(",", ":"))
                f.write("\n")


def main():
    programs = [d for _, d in proglib.load_programs()]
    programs.sort(key=lambda d: d["id"])
    for d in programs:
        d["verified_on_label"] = proglib.date_label(d["verified_on"])
    latest = max((d["verified_on"] for d in programs), default="2026-10-07")
    meta = {
        "count": len(programs),
        "verified_on_official_site": sum(1 for d in programs if d["verified"] == "fetched"),
        "checked": latest,
        "checked_label": proglib.date_label(latest),
    }
    with open(os.path.join(OUT_DIR, "entries.json"), "w", encoding="utf-8") as f:
        json.dump(programs, f, ensure_ascii=False, indent=1)
        f.write("\n")
    lite = [dict({k: v for k, v in d.items() if k not in LITE_DROP}, **({"limited": True} if is_limited(d) else {})) for d in programs]
    with open(os.path.join(OUT_DIR, "entries-lite.json"), "w", encoding="utf-8") as f:
        json.dump(lite, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    core = [{k: d[k] for k in CORE_KEYS if k in d} for d in programs]
    with open(os.path.join(OUT_DIR, "entries-core.json"), "w", encoding="utf-8") as f:
        json.dump(core, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    card = [{k: d[k] for k in CARD_KEYS if k in d} for d in programs]
    # The card rows are only a step toward the calendar file; no page fetches them, so they are not written out.
    # Calendar file: the card rows whose id is an item in data/calendar.json, in card order.
    with open(os.path.join(proglib.ROOT, "data", "calendar.json"), encoding="utf-8") as f:
        cal_ids = {it["id"] for it in json.load(f)["items"]}
    cal = [c for c in card if c["id"] in cal_ids]
    with open(os.path.join(OUT_DIR, "entries-cal.json"), "w", encoding="utf-8") as f:
        json.dump(cal, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    # A key whose value is null is left out: lib.js reads a missing key and a null the same way (it tests for null, or parses a missing date as none).
    stats = [{k: d[k] for k in STATS_KEYS if d.get(k) is not None} for d in programs]
    with open(os.path.join(OUT_DIR, "entries-stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    # A key whose value is null is left out, as in the stats file: lib.js reads a missing key and a null the same way.
    # deadline_confidence is kept only when it is "confirmed-2026-27", the one value lib.futureDeadline and home.js test for; any other value reads the same as a missing key.
    # name, org, city and url are read only for the closing-soon list (home.js drawSoon), which draws only confirmed-2026-27 rows; the picker cards load each program's own file. verified stays on every row: lib.rank reads it.
    # Rows are written in name order (then id). lib.rank breaks ties by name, and the Home picker ranks by that order instead of the dropped name (see home.js).
    home_src = sorted(programs, key=lambda d: (d["name"], d["id"]))
    home = [{k: d[k] for k in HOME_KEYS if d.get(k) is not None and (k != "deadline_confidence" or d[k] == "confirmed-2026-27")
             and (k not in SOON_ONLY_KEYS or d.get("deadline_confidence") == "confirmed-2026-27")} for d in home_src]
    with open(os.path.join(OUT_DIR, "entries-home.json"), "w", encoding="utf-8") as f:
        json.dump(home, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    detail = [{"id": d["id"], **{k: d[k] for k in DETAIL_KEYS if k in d}} for d in programs]
    with open(os.path.join(OUT_DIR, "entries-detail.json"), "w", encoding="utf-8") as f:
        json.dump(detail, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    write_chunks(lite, detail)
    with open(os.path.join(OUT_DIR, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
        f.write("\n")
    with open(os.path.join(OUT_DIR, "entries.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(CSV_COLUMNS)
        for d in programs:
            row = []
            for c in CSV_COLUMNS:
                v = d.get(c)
                if isinstance(v, list):
                    v = "; ".join(v)
                row.append("" if v is None else v)
            w.writerow(row)
    print("built %d programs (%d read on official site), last checked %s" % (meta["count"], meta["verified_on_official_site"], meta["checked_label"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
