# Map tools

These make the Map page (`map.html`) data. Nothing here runs in a visitor's browser.

| File | What it does |
|---|---|
| `geocode.py` | Finds a point for the city named on every card in `data/programs/`, or files the card as statewide, online, national or several places. Standard library only. Writes `points.json`, `REPORT.md` and `trace.tsv` (one line per card: how it was placed). |
| `points.json` | The geocoder's output, committed so the map can be rebuilt without the Census files. |
| `../build_map.mjs` | Turns `points.json` into `data/map.json`, with x and y on the map drawing. |
| `project.mjs` | Latitude and longitude to x and y on `assets/img/us-states.svg` (the same projection that drew it), plus the British Columbia box. |
| `check_points.mjs`, `state-check.mjs`, `fips.mjs` | Checks that every point sits inside its own state and inside the map. |
| `make_basemap.mjs` | Rebuilds `assets/img/us-states.svg` from the us-atlas package. Only needed to change the drawing. |

The hand fixes the geocoder uses are in `data/geo-overrides.json`. Every entry has a reason or a source link.
Licenses and sources: `licenses/us-atlas-ISC.txt` and `licenses/map-data-sources.txt`.

## When a card is added or its city changes

`tests/r3-tests-8-map-data.test.mjs` fails until every card is on the map. Run these from the repo root:

```bash
npm ci                                   # once: installs the pinned map tools (d3-geo, topojson, us-atlas)
# 1. Download the Census Gazetteer files (public domain) into tools/geo/raw/. They are about 10 MB unzipped and are never committed (.gitignore).
mkdir -p tools/geo/raw && cd tools/geo/raw
for f in place cousubs counties zcta state; do
  curl -fsSLO "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_${f}_national.zip"
  unzip -o "2026_Gaz_${f}_national.zip"
done
cd ../../..
# 2. Place every card, check the points, and write the map file
python3 tools/geo/geocode.py              # or: --raw <folder> if the files are somewhere else
node tools/geo/check_points.mjs          # every point inside its own state and the map
node tools/build_map.mjs                 # writes data/map.json
```

Read `tools/geo/REPORT.md` after step 2. A card the geocoder cannot place is listed under Unmatched; add a fix
for it to `data/geo-overrides.json` (with a reason) and run step 2 again.
