"""Write the two areas tools/geo/tiles/build.sh cuts from the Protomaps planet file.

base.geojson: boxes around the lower 48 states, Alaska, Hawaii and southwest British Columbia (zooms 7 and 8; build.sh
takes zooms 0 to 6 for all of North America).
detail.geojson: a square RADIUS_KM around every city point in data/map.json (zooms 9 to 11, so streets show
near the places that have programs). Standard library only.

usage: python3 tools/geo/tiles/regions.py <out-folder>
"""
import json, math, os, sys

RADIUS_KM = 25
BASE_BOXES = [
    (-125.0, 24.3, -66.8, 49.5),   # lower 48
    (-169.0, 51.0, -129.9, 71.5),  # Alaska
    (-160.6, 18.8, -154.6, 22.4),  # Hawaii
    (-128.5, 48.2, -114.0, 51.5),  # southwest British Columbia
]


def square(lon, lat, km):
    dlat = km / 111.0
    dlon = km / (111.0 * math.cos(math.radians(lat)))
    a, b, c, d = lon - dlon, lat - dlat, lon + dlon, lat + dlat
    return [[[a, b], [c, b], [c, d], [a, d], [a, b]]]


def box(a, b, c, d):
    return [[[a, b], [c, b], [c, d], [a, d], [a, b]]]


def main():
    out = sys.argv[1]
    root = os.path.join(os.path.dirname(__file__), "..", "..", "..")
    m = json.load(open(os.path.join(root, "data", "map.json")))
    pts = m["points"] + m["bc"]
    with open(os.path.join(out, "base.geojson"), "w") as f:
        json.dump({"type": "MultiPolygon", "coordinates": [box(*b) for b in BASE_BOXES]}, f)
    with open(os.path.join(out, "detail.geojson"), "w") as f:
        json.dump({"type": "MultiPolygon", "coordinates": [square(p["lon"], p["lat"], RADIUS_KM) for p in pts]}, f)
    print("%d city squares of %d km" % (len(pts), RADIUS_KM))


main()
