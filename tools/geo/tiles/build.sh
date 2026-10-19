#!/bin/sh
# Rebuilds the Map page's street map tiles (assets/map/tiles/base.pmtiles.gz and detail.pmtiles.gz) from a Protomaps
# planet build. See tools/geo/README.md, "Street map tiles". Run from the repo root:
#   sh tools/geo/tiles/build.sh 20261015
# Needs: the pmtiles command (go install github.com/protomaps/go-pmtiles@v1.31.2) and Python with pmtiles 3.4.1
# (python3 -m venv .venv-tiles && .venv-tiles/bin/pip install pmtiles==3.4.1, then PY=.venv-tiles/bin/python).
set -eu
BUILD="${1:?usage: build.sh YYYYMMDD (a build listed at https://maps.protomaps.com/builds/)}"
PMTILES="${PMTILES:-pmtiles}"
PY="${PY:-python3}"
SRC="https://build.protomaps.com/${BUILD}.pmtiles"
WORK="${WORK:-$(mktemp -d)}"
OUT=assets/map/tiles
mkdir -p "$OUT"
python3 tools/geo/tiles/regions.py "$WORK"
# zooms 0 to 6 for all of North America (so a zoomed-out map has no blank corners), 7 and 8 for the boxes only
"$PMTILES" extract "$SRC" "$WORK/base-wide.pmtiles" --bbox=-180,5,-30,78 --maxzoom=6
"$PMTILES" extract "$SRC" "$WORK/base-raw.pmtiles" --region="$WORK/base.geojson" --minzoom=7 --maxzoom=8
"$PMTILES" extract "$SRC" "$WORK/detail-raw.pmtiles" --region="$WORK/detail.geojson" --minzoom=9 --maxzoom=11
"$PY" tools/geo/tiles/slim.py "$OUT/base.pmtiles" "$WORK/base-wide.pmtiles" "$WORK/base-raw.pmtiles"
MINZ=9 "$PY" tools/geo/tiles/slim.py "$OUT/detail.pmtiles" "$WORK/detail-raw.pmtiles"
"$PMTILES" verify "$OUT/base.pmtiles"
"$PMTILES" verify "$OUT/detail.pmtiles"
# The .gz name is only a label: the files are not gzipped. GitHub Pages gzips other files on the fly and then
# answers a Range request with bytes of the gzipped copy (Firefox asks for gzip), which breaks PMTiles. A .gz
# file is served as it is (checked 2026-10-16; see https://github.com/protomaps/PMTiles/issues/584).
mv "$OUT/base.pmtiles" "$OUT/base.pmtiles.gz"
mv "$OUT/detail.pmtiles" "$OUT/detail.pmtiles.gz"
printf '%s\n' "$BUILD" > tools/geo/tiles/BUILD
(cd "$OUT" && shasum -a 256 base.pmtiles.gz detail.pmtiles.gz) > tools/geo/tiles/SHA256SUMS
cat tools/geo/tiles/SHA256SUMS
