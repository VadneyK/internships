#!/usr/bin/env python3
"""Geocode every program card to a point, a no-point class, or an unmatched entry.

Standard library only. Inputs:
  - cards:      data/programs/*.json  (read only)
  - gazetteer:  tools/geo/raw/2026_Gaz_*_national.txt  (US Census Bureau, public domain; never committed,
                see tools/geo/README.md for how to download them)
  - overrides:  data/geo-overrides.json  (every hand fix, with a reason)
Outputs (next to this script): points.json, REPORT.md, trace.tsv. Then run node tools/build_map.mjs to write data/map.json.

Usage: python3 tools/geo/geocode.py [--cards DIR] [--raw DIR] [--date YYYY-MM-DD]
"""
import csv
import glob
import json
import math
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CARDS = os.path.join(ROOT, "data", "programs")
RAW = os.path.join(HERE, "raw")
GAZ_YEAR = "2026"
GAZ_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/"
READ_DATE = __import__("datetime").date.today().isoformat()  # the day the card cities were read; --date YYYY-MM-DD to rerun for an old day

args = sys.argv[1:]
while args:
    a = args.pop(0)
    if a == "--cards":
        CARDS = args.pop(0)
    elif a == "--raw":
        RAW = args.pop(0)
    elif a == "--date":
        READ_DATE = args.pop(0)

CA_PROVINCES = {"BC", "AB", "ON", "QC"}  # only BC appears in the cards today
GENERIC_SLUGS = {"national", "statewide", "virtual"}


# ---------------------------------------------------------------- text helpers
def fold(s):
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


WORD_MAP = {"st": "saint", "ste": "sainte", "ft": "fort", "mt": "mount"}


def norm(s):
    s = fold(s).lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return " ".join(WORD_MAP.get(w, w) for w in s.split())


def strip_parens(s):
    """Return (text without parentheticals, list of parenthetical contents)."""
    parens = []
    while True:
        m = re.search(r"\(([^()]*)\)", s)
        if not m:
            break
        parens.append(m.group(1))
        s = s[: m.start()] + " " + s[m.end():]
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s+([,;])", r"\1", s).strip(" ,")
    return s, parens


# ---------------------------------------------------------------- gazetteer
def read_gaz(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        rows = csv.reader(f, delimiter="|")
        head = [h.strip() for h in next(rows)]
        for r in rows:
            if len(r) >= len(head):
                yield dict(zip(head, [x.strip() for x in r]))


STATE_NAME = {}  # code -> name
STATE_BY_NAME = {}  # norm(name) -> code
for r in read_gaz(os.path.join(RAW, "%s_Gaz_state_national.txt" % GAZ_YEAR)):
    STATE_NAME[r["USPS"]] = r["NAME"]
    STATE_BY_NAME[norm(r["NAME"])] = r["USPS"]
STATE_CODES = set(STATE_NAME)
STATE_NAME["BC"] = "British Columbia"  # Canada: only used to spot province names in text
STATE_BY_NAME["british columbia"] = "BC"

PLACE_SUFFIX = re.compile(
    r"^(?P<name>.*?)"
    r"(?: (?P<kind>city and borough|metropolitan government|metro government|consolidated government"
    r"|unified government|urban county|zona urbana|comunidad|municipality|corporation|village|borough"
    r"|town|city|CDP|government))?"
    r"(?P<bal> \(balance\))?$"
)

# index: (state, normname) -> list of candidate dicts
IDX = defaultdict(list)
COUNTY_IDX = defaultdict(list)


def add_cand(st, name, display, tier, kind, lat, lon, aland, src):
    c = {"st": st, "display": display, "tier": tier, "kind": kind, "lat": lat, "lon": lon,
         "aland": aland, "src": src}
    n = norm(name)
    if not n:
        return
    lst = IDX[(st, n)]
    for o in lst:  # drop near-duplicates (same place appearing in two files)
        if abs(o["lat"] - lat) < 0.02 and abs(o["lon"] - lon) < 0.02:
            if tier < o["tier"]:
                o.update(c)
            return
    lst.append(c)


for r in read_gaz(os.path.join(RAW, "%s_Gaz_place_national.txt" % GAZ_YEAR)):
    full = r["NAME"]
    m = PLACE_SUFFIX.match(full)
    name, kind = m.group("name"), (m.group("kind") or "")
    if not name:
        continue
    tier = 3 if kind in ("CDP", "zona urbana", "comunidad") else 1
    lat, lon, al = float(r["INTPTLAT"]), float(r["INTPTLONG"]), float(r["ALAND"] or 0)
    add_cand(r["USPS"], name, name, tier, kind or "place", lat, lon, al, "place")
    if (kind in ("metro government", "metropolitan government", "consolidated government",
                 "unified government", "urban county", "government") or "/" in name
            or (m.group("bal") and re.search(r"[-/]", name))):
        first = re.split(r"[-/,]", name)[0].strip()
        if first and first != name:
            add_cand(r["USPS"], first, first, 1.5, kind + "-alias", lat, lon, al, "place")  # 1.5: loses to a real place of that name

COUSUB_OK = re.compile(
    r"^(?P<name>.*?) (?P<kind>charter township|township|town|city|village|borough|plantation|municipality)$")
for r in read_gaz(os.path.join(RAW, "%s_Gaz_cousubs_national.txt" % GAZ_YEAR)):
    full = r["NAME"]
    m = COUSUB_OK.match(full)
    if not m:
        continue  # CCDs, districts, precincts, unorganized territories etc. are not places
    name = m.group("name")
    lat, lon, al = float(r["INTPTLAT"]), float(r["INTPTLONG"]), float(r["ALAND"] or 0)
    add_cand(r["USPS"], name, name, 2, "cousub-" + m.group("kind"), lat, lon, al, "cousub")
    if name.endswith(" Town"):  # Gazetteer writes some MA towns as "Amherst Town town"
        short = name[:-5]
        add_cand(r["USPS"], short, short, 2, "cousub-" + m.group("kind"), lat, lon, al, "cousub")

for r in read_gaz(os.path.join(RAW, "%s_Gaz_counties_national.txt" % GAZ_YEAR)):
    COUNTY_IDX[(r["USPS"], norm(r["NAME"]))].append(
        {"st": r["USPS"], "display": r["NAME"], "tier": 0, "kind": "county",
         "lat": float(r["INTPTLAT"]), "lon": float(r["INTPTLONG"]),
         "aland": float(r["ALAND"] or 0), "src": "county"})

ZCTA = {}
for r in read_gaz(os.path.join(RAW, "%s_Gaz_zcta_national.txt" % GAZ_YEAR)):
    ZCTA[r["GEOID"]] = (float(r["INTPTLAT"]), float(r["INTPTLONG"]))

# ---------------------------------------------------------------- overrides
with open(os.path.join(ROOT, "data", "geo-overrides.json"), encoding="utf-8") as f:
    OV = json.load(f)
OV_CITY = OV.get("byCity", {})
OV_ID = OV.get("byId", {})
OV_ALIAS = {k.lower(): v for k, v in OV.get("aliases", {}).items()}
OV_MANUAL = {k.lower(): v for k, v in OV.get("manualPoints", {}).items()}
OV_USED = Counter()

# ---------------------------------------------------------------- load cards
cards = []
for p in sorted(glob.glob(os.path.join(CARDS, "*.json"))):
    with open(p, encoding="utf-8") as f:
        d = json.load(f)
    assert d["id"] == os.path.splitext(os.path.basename(p))[0], p
    cards.append({"id": d["id"], "city": d["city"], "regions": d.get("regions") or []})
ids_seen = [c["id"] for c in cards]
assert len(ids_seen) == len(set(ids_seen))

# ---------------------------------------------------------------- region -> state
votes = defaultdict(Counter)
STD = re.compile(r"^[^,(;/]+, ([A-Z]{2})\b")
for c in cards:
    m = STD.match(c["city"])
    if m and m.group(1) in STATE_CODES and " and " not in c["city"].split(",")[0]:
        for r in c["regions"]:
            votes[r][m.group(1)] += 1
REGION_STATE = {}
for r, cnt in votes.items():
    if r in GENERIC_SLUGS:
        continue
    st, n = cnt.most_common(1)[0]
    if n / sum(cnt.values()) >= 0.7:
        REGION_STATE[r] = st
for slug, nm in STATE_NAME.items():  # slugs that are plain state names
    s = nm.lower().replace(" ", "-")
    REGION_STATE.setdefault(s, slug)
REGION_STATE.setdefault("new-york-state", "NY")
REGION_STATE.setdefault("new-york-city", "NY")


def region_states(regions):
    return {REGION_STATE[r] for r in regions if r in REGION_STATE}


def states_in_text(text):
    """Full US state names mentioned in text (longest names first, spans masked)."""
    t = " " + norm(text) + " "
    found = []
    for nm in sorted(STATE_BY_NAME, key=len, reverse=True):
        pat = " " + nm + " "
        while pat in t:
            found.append(STATE_BY_NAME[nm])
            t = t.replace(pat, " # ", 1)
    return found


# ---------------------------------------------------------------- resolution
def dist(a, b):
    return math.hypot(a[0] - b[0], (a[1] - b[1]) * math.cos(math.radians(a[0])))


REGION_CENTER = {}  # filled after a first pass of unambiguous matches


def pick(cands, regions, notes):
    """Choose among candidates already filtered to the best tier."""
    if len(cands) == 1:
        return cands[0]
    spread = max(dist((a["lat"], a["lon"]), (b["lat"], b["lon"])) for a in cands for b in cands)
    centers = [REGION_CENTER[r] for r in regions if r in REGION_CENTER]
    if centers:
        best = min(cands, key=lambda c: min(dist((c["lat"], c["lon"]), ct) for ct in centers))
        notes.append("ambiguous(%d), picked nearest region center" % len(cands))
        return best
    if spread > 0.5:
        notes.append("ambiguous(%d) spread %.2f deg" % (len(cands), spread))
        return None
    best = max(cands, key=lambda c: c["aland"])
    notes.append("ambiguous(%d), picked largest land area" % len(cands))
    return best


def query_variants(q):
    n = norm(q)
    out = [n]
    n2 = re.sub(r"^(metro|downtown|greater|the) ", "", n)
    n2 = re.sub(r" (area|region|metro|metropolitan area|metro area)$", "", n2)
    if n2 != n:
        out.append(n2)
    n3 = re.sub(r" (township|twp|town|village|borough|city)$", "", n2)
    if n3 != n2:
        out.append(n3)
    return out


def resolve_place(q, st, regions, notes):
    alias = OV_ALIAS.get(("%s, %s" % (q, st)).lower())
    if alias:
        OV_USED["alias:" + ("%s, %s" % (q, st))] += 1
        notes.append("alias: " + alias["reason"])
        tgt = alias["county"]
        cs = COUNTY_IDX.get((st, norm(tgt.rsplit(",", 1)[0])))
        if not cs:
            return None, "alias target not found: " + tgt
        c = cs[0]
        return {"key": "%s, %s" % (q, st), "st": st, "lat": c["lat"], "lon": c["lon"],
                "precision": "county", "src": alias["reason"]}, None
    mc = re.match(r"^(.*?)\s+(County|Parish)$", q, re.I)
    if mc:
        full = norm(q)
        cs = COUNTY_IDX.get((st, full))
        if cs:
            c = cs[0]
            return {"key": "%s, %s" % (c["display"], st), "st": st, "lat": c["lat"], "lon": c["lon"],
                    "precision": "county", "src": "county"}, None
        return None, "county not in Gazetteer for %s" % st
    for v in query_variants(q):
        cands = IDX.get((st, v))
        if not cands:
            continue
        best_tier = min(c["tier"] for c in cands)
        cands = [c for c in cands if c["tier"] == best_tier]
        c = pick(cands, regions, notes)
        if c is None:
            return None, "ambiguous: %d places named %s in %s" % (len(cands), q, st)
        return {"key": "%s, %s" % (c["display"], st), "st": st, "lat": c["lat"], "lon": c["lon"],
                "precision": "city", "src": c["src"] + ":" + c["kind"]}, None
    return None, "no Gazetteer place or county named %r in %s" % (q, st)


def resolve_override_target(spec):
    """spec: {'place': 'Name, ST'} or {'county': 'X County, ST'} or {'manual': {...}}"""
    if "zcta" in spec:
        z = spec["zcta"]
        lat, lon = ZCTA[z["zip"]]
        return {"key": z["key"], "st": z["state"], "lat": lat, "lon": lon, "precision": "manual",
                "src": "Census Gazetteer ZCTA %s (%s) internal point" % (z["zip"], z["key"])}, None
    if "manual" in spec:
        m = spec["manual"]
        return {"key": spec.get("key") or m["key"], "st": m["state"], "lat": m["lat"], "lon": m["lon"],
                "precision": "manual", "src": m["source"]}, None
    target = spec.get("place") or spec.get("county")
    name, st = target.rsplit(",", 1)
    st = st.strip()
    return resolve_place(name.strip(), st, [], [])


MULTI_WORD = re.compile(r"\b(and|or)\b|/| & ")
DIRECTIONAL = re.compile(r"^(northern|southern|eastern|western|central|southeast|southwest|northwest|northeast|"
                         r"north|south|east|west|upper|lower)\b", re.I)


def classify(city, regions):
    """Return dict(cls=..., ...) for one city string. cls in point|statewide|online|national|multi|unmatched."""
    notes = []
    s0 = re.sub(r"\s+", " ", city).strip()
    if s0 in OV_CITY:
        return apply_override(OV_CITY[s0], "byCity:" + s0, regions, notes)

    base, parens = strip_parens(s0)
    bl = base.lower()

    # fully online by parenthetical, e.g. "Madison, WI (online)"; hybrids stay on the map
    for p in parens:
        pl = p.strip().lower()
        if re.match(r"^(online|virtual|live online|live on zoom)\b", pl) and not re.search(
                r"\b(in person|in-person|campus|hybrid|also|or|some|residency|academy)\b", pl):
            return {"cls": "online", "notes": notes + ["parenthetical says fully online: " + p]}

    # online and national
    if re.match(r"^(online|virtual|mostly in-person events|school-based)\b", bl):
        return {"cls": "online", "notes": notes}
    if re.match(r"^(nationwide|school chapters$|school chapters across the us|participating national parks|"
                r"at your high school)", bl):
        return {"cls": "national", "notes": notes}

    # statewide forms
    if re.match(r"^statewide\b", bl):
        sts = set()
        for t in re.split(r",\s*", base):
            if t in STATE_CODES:
                sts.add(t)
        if not sts:
            sts |= set(states_in_text(base))
        if not sts:
            for p in parens:
                sts |= {t for t in re.split(r"[ ,]+", p) if t in STATE_CODES}
                sts |= set(states_in_text(p))
        if not sts:
            sts |= region_states(regions)
        if len(sts) == 1:
            return {"cls": "statewide", "state": next(iter(sts)), "notes": notes}
        return {"cls": "unmatched", "reason": "Statewide card without a single state (%s)" % sorted(sts),
                "notes": notes}

    # New York City shorthand
    base = re.sub(r"^New York City\b", "New York, NY", base)
    tokens = [t.strip() for t in base.split(", ") if t.strip()]

    # find the state code token
    i_st = None
    for i, t in enumerate(tokens):
        m = re.match(r"^([A-Z]{2})\b", t)
        if m and (m.group(1) in STATE_CODES or m.group(1) in CA_PROVINCES) and i > 0:
            i_st = i
            break

    if i_st is not None:
        return city_path(city, base, tokens, i_st, parens, regions, notes)

    # no state code: state names, regional text, bare city
    names = states_in_text(base + " " + " ".join(parens))
    base_names = states_in_text(base)
    if base_names or (not tokens or True) and base_names:
        pass
    if DIRECTIONAL.match(base) and base_names:
        return {"cls": "multi", "notes": notes + ["sub-state region"]}
    if len(set(base_names)) > 1:
        return {"cls": "multi", "notes": notes + ["several states"]}
    if len(set(base_names)) == 1:
        leading = norm(base).startswith(norm(STATE_NAME[base_names[0]]))
        if not leading and (MULTI_WORD.search(base) or "," in base.replace(", " + STATE_NAME[base_names[0]], "")):
            # e.g. "Albuquerque and central New Mexico", "Linn, Marion ... Oregon counties"
            if not re.match(r"^[A-Za-z .'-]+,? (including|with)\b", base):
                return {"cls": "multi", "notes": notes + ["places plus a state name"]}
        return {"cls": "statewide", "state": base_names[0], "notes": notes}
    # no state at all in the text: a bare place name, use the card's regions for the state
    rs = region_states(regions)
    if MULTI_WORD.search(base) or "," in base:
        return {"cls": "unmatched", "reason": "several places and no state in the text", "notes": notes}
    if len(rs) == 1:
        st = next(iter(rs))
        res, err = resolve_place(base, st, regions, notes)
        if res:
            res["notes"] = notes + ["state %s taken from regions %s" % (st, regions)]
            return {"cls": "point", "res": res, "notes": res["notes"]}
        return {"cls": "unmatched", "reason": err, "notes": notes}
    return {"cls": "unmatched", "reason": "no state in the text and regions give %s" % sorted(rs), "notes": notes}


def city_path(city, base, tokens, i, parens, regions, notes):
    m = re.match(r"^([A-Z]{2})\b\s*(.*)$", tokens[i])
    st, tail = m.group(1), m.group(2).strip()
    places = tokens[:i]
    rest = tokens[i + 1:]
    if ";" in base:
        return {"cls": "multi", "notes": notes + ["semicolon list"]}
    for t in rest:
        mm = re.match(r"^([A-Z]{2})\b", t)
        if mm and (mm.group(1) in STATE_CODES or mm.group(1) in CA_PROVINCES):
            return {"cls": "multi", "notes": notes + ["second place with a state code"]}
    if tail.lower().startswith("and "):
        after = tail[4:].strip()
        if after and after[0].isupper() and not re.match(r"(Other|Online|Virtual)\b", after):
            return {"cls": "multi", "notes": notes + ["second place after 'and': " + after]}
    last = places[-1]
    if MULTI_WORD.search(last):
        if not re.match(r"^.* and other\b", last):
            return {"cls": "multi", "notes": notes + ["several places before the state"]}
        last = re.split(r" and other\b", last)[0]
    if re.search(r"\bCounties$", last):
        return {"cls": "multi", "notes": notes + ["several counties"]}
    if len(places) >= 2 and re.search(r"\b(County|Parish)$", last) and any(MULTI_WORD.search(p) for p in places[:-1]):
        return {"cls": "multi", "notes": notes + ["several places and a county"]}
    INSTITUTION = re.compile(r"\d|\b(University|College|Campus|campus|School|Hospital|Center|Library|Park|Museum|Institute)\b")
    if len(places) >= 3 and not any(INSTITUTION.search(p) for p in places[:-1]):
        return {"cls": "multi", "notes": notes + ["list of places before the state"]}
    if len(places) >= 3:
        notes.append("%d name tokens before state, used the last (%s)" % (len(places), last))
    elif len(places) == 2:
        notes.append("used the second name (%s) over the first (%s)" % (last, places[0]))

    if st in CA_PROVINCES:
        key = ("%s, %s" % (last, st)).lower()
        mp = OV_MANUAL.get(key)
        if mp:
            OV_USED["manual:" + mp["key"]] += 1
            return {"cls": "point", "res": {"key": mp["key"], "st": st, "lat": mp["lat"], "lon": mp["lon"],
                                            "precision": "manual", "src": mp["source"]}, "notes": notes}
        return {"cls": "unmatched", "reason": "Canadian place %s not in manual table" % key, "notes": notes}

    res, err = resolve_place(last, st, regions, notes)
    if res:
        return {"cls": "point", "res": res, "notes": notes}
    if len(places) == 2:  # try the first name as a fallback
        res, err2 = resolve_place(places[0], st, regions, notes)
        if res:
            notes.append("fell back to first name")
            return {"cls": "point", "res": res, "notes": notes}
    return {"cls": "unmatched", "reason": err, "notes": notes}


def apply_override(spec, tag, regions, notes):
    OV_USED[tag] += 1
    notes = notes + ["override: " + spec["reason"]]
    cls = spec.get("class")
    if cls in ("online", "national", "multi"):
        return {"cls": cls, "notes": notes}
    if cls == "statewide":
        return {"cls": "statewide", "state": spec["state"], "notes": notes}
    if cls == "unmatched":
        return {"cls": "unmatched", "reason": spec["reason"], "notes": notes}
    res, err = resolve_override_target(spec)
    if res:
        if spec.get("key"):
            res["key"] = spec["key"]
        return {"cls": "point", "res": res, "notes": notes}
    return {"cls": "unmatched", "reason": "override target failed: " + str(err), "notes": notes}


# ---------------------------------------------------------------- pass 1 and 2
# Pass 1 resolves everything without region centers (used to build them), pass 2 redoes it with them.
def run_all():
    out = {}
    for c in cards:
        if c["id"] in OV_ID:
            out[c["id"]] = apply_override(OV_ID[c["id"]], "byId:" + c["id"], c["regions"], [])
        else:
            out[c["id"]] = classify(c["city"], c["regions"])
    return out


OV_USED.clear()
first = run_all()
pts = defaultdict(list)
for c in cards:
    r = first[c["id"]]
    if r["cls"] == "point" and not any("ambiguous" in n for n in r["notes"]):
        for rg in c["regions"]:
            if rg not in GENERIC_SLUGS:
                pts[rg].append((r["res"]["lat"], r["res"]["lon"]))
for rg, lst in pts.items():
    if len(lst) >= 2:
        lats = sorted(p[0] for p in lst)
        lons = sorted(p[1] for p in lst)
        REGION_CENTER[rg] = (lats[len(lats) // 2], lons[len(lons) // 2])
OV_USED.clear()
final = run_all()

# ---------------------------------------------------------------- assemble
cities = {}
no_point = {"statewide": defaultdict(list), "online": [], "national": [], "multi": []}
unmatched = []
trace = []
ambiguous = []
zcta_keys = set()
for c in cards:
    r = final[c["id"]]
    cls = r["cls"]
    note = "; ".join(r.get("notes", []))
    if cls == "point":
        res = r["res"]
        k = (res["key"], res["st"])
        e = cities.setdefault(k, {"key": res["key"], "state": res["st"], "lat": round(res["lat"], 4),
                                  "lon": round(res["lon"], 4), "precision": res["precision"], "ids": []})
        e["ids"].append(c["id"])
        if "ZCTA" in res["src"]:
            zcta_keys.add(k)
        trace.append((c["id"], c["city"], "point", res["key"], res["precision"], res["src"], note))
        if "ambiguous" in note:
            ambiguous.append((c["city"], res["key"], note))
    elif cls == "statewide":
        no_point["statewide"][r["state"]].append(c["id"])
        trace.append((c["id"], c["city"], "statewide", r["state"], "", "", note))
    elif cls in ("online", "national", "multi"):
        no_point[cls].append(c["id"])
        trace.append((c["id"], c["city"], cls, "", "", "", note))
    else:
        unmatched.append({"id": c["id"], "city": c["city"], "reason": r["reason"]})
        trace.append((c["id"], c["city"], "unmatched", "", "", "", r["reason"]))

# integrity: one key must mean one coordinate
coord_of = {}
for c in cards:
    r = final[c["id"]]
    if r["cls"] == "point":
        k = (r["res"]["key"], r["res"]["st"])
        xy = (round(r["res"]["lat"], 4), round(r["res"]["lon"], 4))
        assert coord_of.setdefault(k, xy) == xy, "key %r resolved to two coordinates" % (k,)


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


STATE_SLUGS = {nm.lower().replace(" ", "-") for nm in STATE_NAME.values()} | {"new-york-state"}
outliers = []
for c in cards:
    r = final[c["id"]]
    if r["cls"] != "point":
        continue
    # only metro style regions; state-wide regions are too large for a distance test to mean anything
    cs = [REGION_CENTER[g] for g in c["regions"] if g in REGION_CENTER and g not in STATE_SLUGS]
    if cs:
        d = min(km((r["res"]["lat"], r["res"]["lon"]), ct) for ct in cs)
        if d > 150:
            outliers.append((d, c["id"], c["city"], r["res"]["key"], c["regions"]))
outliers.sort(reverse=True)

city_list = sorted(cities.values(), key=lambda e: (e["state"], e["key"]))
for e in city_list:
    e["ids"].sort()
for k in ("online", "national", "multi"):
    no_point[k].sort()
no_point["statewide"] = {k: sorted(v) for k, v in sorted(no_point["statewide"].items())}

out = {
    "read": READ_DATE,
    "cities": city_list,
    "noPoint": no_point,
    "unmatched": unmatched,
    "source": ("US Census Bureau Gazetteer Files, %s edition (public domain): places, county subdivisions "
               "counties and ZIP code tabulation area (ZCTA) national files, plus the state file for names. %s . "
               "British Columbia points are a manual table from the Canadian Geographical Names Database "
               "(Natural Resources Canada). %d neighborhood and island city points use ZCTA centroids."
               % (GAZ_YEAR, GAZ_URL, len(zcta_keys))),
}

# integrity checks: every card exactly once
accounted = []
for e in city_list:
    accounted += e["ids"]
for v in no_point["statewide"].values():
    accounted += v
for k in ("online", "national", "multi"):
    accounted += no_point[k]
accounted += [u["id"] for u in unmatched]
assert sorted(accounted) == sorted(ids_seen), "cards lost or duplicated"

with open(os.path.join(HERE, "points.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
    f.write("\n")
with open(os.path.join(HERE, "trace.tsv"), "w", encoding="utf-8") as f:
    f.write("id\tcity\tclass\tresult\tprecision\tsource\tnotes\n")
    for row in trace:
        f.write("\t".join(x.replace("\t", " ") for x in row) + "\n")

# ---------------------------------------------------------------- report
n = len(cards)
n_pt = sum(len(e["ids"]) for e in city_list)
n_sw = sum(len(v) for v in no_point["statewide"].values())
prec = Counter(e["precision"] for e in city_list)
prec_cards = Counter()
for e in city_list:
    prec_cards[e["precision"]] += len(e["ids"])
distinct = len({c["city"] for c in cards})
lines = []
w = lines.append
w("# Geocode report")
w("")
w("Source: US Census Bureau Gazetteer %s (public domain), %s" % (GAZ_YEAR, GAZ_URL))
w("Files used: %s_Gaz_place_national, %s_Gaz_cousubs_national, %s_Gaz_counties_national, "
  "%s_Gaz_state_national, %s_Gaz_zcta_national. County subdivisions are used for New England towns and "
  "township states (the places file only lists their CDPs). ZCTA (ZIP code area) centroids are used for "
  "a few neighborhoods the places file lacks." % ((GAZ_YEAR,) * 5))
w("Canada: manual table in data/geo-overrides.json from the Canadian Geographical Names Database (Natural Resources Canada).")
w("Precision 'manual' covers both the British Columbia table and the ZIP-centroid points; each one carries "
  "its source in data/geo-overrides.json or trace.tsv. Province wide British Columbia cards are listed under "
  "noPoint.statewide with the key BC, which is a province code and not a US state.")
w("")
w("## Counts")
w("")
w("| What | Cards |")
w("|---|---|")
w("| All cards | %d |" % n)
w("| With a point | %d (%.1f%%) |" % (n_pt, 100.0 * n_pt / n))
w("| Statewide (no point) | %d |" % n_sw)
w("| Online (no point) | %d |" % len(no_point["online"]))
w("| National (no point) | %d |" % len(no_point["national"]))
w("| Many places (no point) | %d |" % len(no_point["multi"]))
w("| Unmatched | %d (%.2f%%) |" % (len(unmatched), 100.0 * len(unmatched) / n))
w("")
w("Distinct city strings: %d. Distinct map points (cities list): %d." % (distinct, len(city_list)))
w("")
w("Points by precision (points / cards): " + ", ".join(
    "%s %d / %d" % (k, prec[k], prec_cards[k]) for k in ("city", "county", "manual")))
w("")
w("Statewide by state: " + ", ".join("%s %d" % (k, len(v)) for k, v in no_point["statewide"].items()))
w("")
w("## Unmatched")
w("")
if unmatched:
    for u in unmatched:
        w("- `%s` | %s | %s" % (u["id"], u["city"], u["reason"]))
else:
    w("None.")
w("")
w("## Overrides")
w("")
w("Entries in data/geo-overrides.json: byCity %d, byId %d, aliases %d, manualPoints %d. "
  "Every entry carries a reason. Entries that fired this run: %d." % (
      len(OV_CITY), len(OV_ID), len(OV.get("aliases", {})), len(OV.get("manualPoints", {})),
      len(OV_USED)))
unused = [k for k in OV_CITY if ("byCity:" + k) not in OV_USED]
unused += [k for k in OV_ID if ("byId:" + k) not in OV_USED]
if unused:
    w("")
    w("Override entries that never fired (check for stale keys):")
    for k in unused:
        w("- " + k)
w("")
w("## Ambiguous matches (picked by region center or land area)")
w("")
seen = set()
for city, key, note in ambiguous:
    if (city, key) in seen:
        continue
    seen.add((city, key))
    w("- %s -> %s (%s)" % (city, key, note))
if not ambiguous:
    w("None.")
w("")
w("## Distance outliers (more than 150 km from the median point of the card's own metro regions)")
w("")
w("Listed for eyeballing; a long distance is normal for multi-state or travel programs.")
w("")
for d, i, cty, key, rg in outliers:
    w("- %.0f km | %s | %s -> %s | regions %s" % (d, i, cty, key, ",".join(rg)))
if not outliers:
    w("None.")
w("")
w("## Region to state map used when the city text has no state")
w("")
w(", ".join("%s=%s" % (k, v) for k, v in sorted(REGION_STATE.items())))
w("")
w("## Method")
w("")
w("1. Parentheticals are dropped from the city text (they name buildings, campuses or neighborhoods).")
w("2. Text starting with Online or Virtual is online, and so is text whose parenthetical begins with "
  "online, virtual, live online or live on Zoom unless it also says in person, campus, hybrid, also, or, "
  "some, residency or academy (hybrids keep their pin). Nationwide, school chapters across the US and park "
  "lists are national. Statewide text, or a bare state name, is statewide with the state code.")
w("3. Otherwise the first state code splits the text: the name just before it is matched to a Gazetteer "
  "place (incorporated place first, then county subdivision, then CDP), or to a county when it ends in "
  "County or Parish. St./Saint, Ft./Fort and Mt./Mount are folded together.")
w("4. Two or more places before the state (\"Fremont, Newark and Union City, CA\"), a second place after it, "
  "semicolon lists, or a sub-state region are classified as multi and get no point.")
w("5. Text with no state uses the state of the card's regions (found by majority vote among cards that do "
  "carry a state).")
w("6. Every other hand fix is in data/geo-overrides.json with a reason. trace.tsv lists how each card was resolved.")
with open(os.path.join(HERE, "REPORT.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print("cards %d  points %d (%d map points)  statewide %d  online %d  national %d  multi %d  unmatched %d"
      % (n, n_pt, len(city_list), n_sw, len(no_point["online"]), len(no_point["national"]),
         len(no_point["multi"]), len(unmatched)))
