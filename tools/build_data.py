#!/usr/bin/env python3
"""Combine data/programs/*.json into the files the website reads:

  data/entries.json  all programs, one array
  data/entries.csv   same, as a spreadsheet
  data/meta.json     counts and the "last checked" date shown in the footer

Run:  python3 tools/build_data.py        (then python3 tools/build.py for the pages)
"""
import csv
import json
import os
import sys

import proglib

OUT_DIR = os.path.join(proglib.ROOT, "data")
CSV_COLUMNS = [
    "id", "name", "org", "city", "regions", "type", "fields", "min_age", "max_age", "grades", "paid_type", "pay_detail",
    "season", "duration", "status", "deadline_text", "deadline_iso", "deadline_confidence", "needs_work_permit",
    "who_can_apply", "how_to_apply", "url", "apply_url", "verified", "verified_on", "notes",
]


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
