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

## Street map tiles

Where the browser has WebGL 2, the Map page swaps the drawn map for a street map you can drag and zoom
(`assets/js/map-gl.js`, MapLibre GL JS 6.11.2 in `assets/vendor/maplibre/`). Every file it loads comes from this
site, so the page still makes no request to any other site. Without WebGL 2, with the browser's data saver on (until
the reader taps the load button), or if the street map fails, the drawn map stays.

| File | What it does |
|---|---|
| `tiles/build.sh` | Cuts the tiles from a Protomaps planet build: zooms 0 to 6 for North America and 7 to 8 for the US, Alaska, Hawaii and southwest British Columbia (`base.pmtiles.gz`), and zooms 9 to 11 within 25 km of every city on the map (`detail.pmtiles.gz`). MapLibre stretches the last zoom further in. |
| `tiles/regions.py` | Writes the two areas from `data/map.json`. |
| `tiles/slim.py`, `tiles/mvt.py` | Keep only what the map draws (land, water, parks and schools, roads from tertiary up, boundaries, place names in English and Spanish). Buildings, points of interest and most land cover go. Geometry is kept byte for byte. |
| `tiles/BUILD`, `tiles/SHA256SUMS` | The Protomaps build date and the bytes of the two files the deploy must find. |

The tiles (about 28 MB and 49 MB) are not in git. They live as files of the release `map-tiles-<BUILD>`, and the
deploy job copies them into the site and checks them against `SHA256SUMS`. The `.gz` name is only a label (the files
are not gzipped): GitHub Pages leaves a `.gz` file as it is, while it would gzip a `.pmtiles` file on the fly and break
the byte ranges the map reads in Firefox (https://github.com/protomaps/PMTiles/issues/584). The deploy's smoke test
checks this on the live site.

### Previewing the street map on this computer

`python3 -m http.server` ignores Range requests, so the street map would load whole files or fail. Use the small
server here, which answers them as GitHub Pages does (the tiles must be in `assets/map/tiles/`, from `build.sh` or the
release):

```bash
python3 tools/geo/tiles/rangeserve.py . 8198    # then open http://127.0.0.1:8198/map.html
```

### Rebuilding the tiles (only after cities move far, or once a year for fresher streets)

```bash
go install github.com/protomaps/go-pmtiles@v1.31.2            # the pmtiles command, into ~/go/bin
python3 -m venv .venv-tiles && .venv-tiles/bin/pip install pmtiles==3.4.1
# pick a build date listed at https://maps.protomaps.com/builds/ (they are not kept forever)
PMTILES=~/go/bin/go-pmtiles PY=.venv-tiles/bin/python sh tools/geo/tiles/build.sh 20261015
```

Then publish the two files from `assets/map/tiles/` as a new release named `map-tiles-<date>`, and commit `BUILD` and
`SHA256SUMS`. A new city more than 25 km from every old one shows without street detail until the next rebuild; its
dot and the base map still show. Check the result in a real browser (the jsdom tests stand in for MapLibre).
Licenses: `licenses/map-data-sources.txt`.

### Updating MapLibre or PMTiles

Copy the new `dist` files into `assets/vendor/` (MapLibre: `maplibre-gl.mjs`, `maplibre-gl-shared.mjs`,
`maplibre-gl-worker.mjs`, `maplibre-gl.css`; PMTiles: `pmtiles.js`), drop each `sourceMappingURL` line, and pin the same
versions in `package.json`. MapLibre 6.11.2's shared module has one literal en dash and one em dash as object keys
(a table for vertical text); the site's dash check rejects them, so they are written as `"\u2013":` and `"\u2014":`,
which is the same string to JavaScript. Then update the rows in `tests/r3-tests-4-size-ratchet.test.mjs` and the
versions in `licenses/map-data-sources.txt`.
