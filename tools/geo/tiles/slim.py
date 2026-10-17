"""Slim Protomaps basemap tiles for the teen guide map: keep only the layers, kinds and name fields the map draws.

usage: slim.py out.pmtiles in1.pmtiles [in2.pmtiles ...]   (later inputs win for the same tile)
       MINZ=9 slim.py ...   keeps only zoom 9 and up

Layers and kinds follow the Protomaps basemap tile schema (https://docs.protomaps.com/basemaps/layers).
Dropped: buildings, points of interest, most land cover, small roads and every name field except name, name:en
and name:es. The tiles keep their geometry byte for byte; only whole features and tags are removed.
"""
import sys, gzip, json, collections, functools
# The pmtiles Writer gzips the directories and metadata with the time of the run in the gzip header, so two runs on
# the same input gave different bytes and SHA256SUMS could never be checked by a rebuild. A fixed time makes it repeatable.
gzip.compress = functools.partial(gzip.compress, mtime=0)
from pmtiles.reader import MmapSource, all_tiles, Reader
from pmtiles.writer import Writer
from pmtiles.tile import zxy_to_tileid
import mvt

KEEP_LAYERS = {"earth", "water", "boundaries", "roads", "places", "landuse"}
LANDUSE_KEEP = {"park", "national_park", "nature_reserve", "school", "university", "college", "hospital", "zoo",
                "aerodrome", "stadium"}
ROAD_DROP = {"taxiway", "runway", "path", "other"}
NAME_KEYS = {"name", "name:en", "name:es"}


def keep_key(layer, k):
    if k.startswith("name") or k.startswith("pgf:") or k.startswith("script"):
        return k in NAME_KEYS
    return True


def keep_feature(layer, z, p):
    kind = p.get("kind")
    if layer == "landuse":
        if kind not in LANDUSE_KEEP:
            return False
        if kind in ("national_park", "nature_reserve"):
            return z <= 8  # broad green at country zooms only
        return z >= 9
    if layer == "roads":
        if kind in ROAD_DROP or p.get("kind_detail") in ROAD_DROP:
            return False
        if kind == "rail":
            return z >= 10
        if kind == "minor_road":
            return z >= 12
    if layer == "places":
        return kind in ("country", "region", "locality", "neighbourhood", "macrohood")
    if layer == "boundaries":
        return kind in ("country", "region") or (kind == "county" and z >= 8)
    return True


def rewrite_layer(lbuf, z):
    name, keys, values, feats, other = mvt.parse_layer(lbuf)
    # raw value messages so they can be re-emitted unchanged
    raw_values = [v for fn, wt, v, _ in mvt.fields(lbuf) if fn == 4]
    new_keys, key_ix = [], {}
    new_vals, val_ix = [], {}
    feat_out = []
    for fb in feats:
        props = mvt.feature_props(fb, keys, values)
        if not keep_feature(name, z, props):
            continue
        out = bytearray()
        for fn, wt, v, raw in mvt.fields(fb):
            if fn == 2:
                t = mvt.packed(v)
                nt = []
                for a in range(0, len(t) - 1, 2):
                    k = keys[t[a]]
                    if not keep_key(name, k):
                        continue
                    if k not in key_ix:
                        key_ix[k] = len(new_keys); new_keys.append(k)
                    rv = bytes(raw_values[t[a + 1]])
                    if rv not in val_ix:
                        val_ix[rv] = len(new_vals); new_vals.append(rv)
                    nt += [key_ix[k], val_ix[rv]]
                out += mvt.wrap(2, b"".join(mvt.enc_varint(x) for x in nt))
            else:
                out += raw
        feat_out.append(bytes(out))
    if not feat_out:
        return None
    body = bytearray()
    for fn, wt, v, raw in mvt.fields(lbuf):
        if fn == 1 or fn not in (2, 3, 4):
            body += raw
    for f in feat_out:
        body += mvt.wrap(2, f)
    for k in new_keys:
        body += mvt.wrap(3, k.encode())
    for v in new_vals:
        body += mvt.wrap(4, v)
    return bytes(body)


def slim_tile(data, z):
    t = mvt.ungz(data)
    out = bytearray()
    for name, lb, raw in mvt.tile_layers(t):
        if name not in KEEP_LAYERS:
            continue
        nl = rewrite_layer(lb, z)
        if nl:
            out += mvt.wrap(3, nl)
    return gzip.compress(bytes(out), 9, mtime=0)


def main():
    import os
    minz = int(os.environ.get("MINZ", "0"))
    out, ins = sys.argv[1], sys.argv[2:]
    tiles = {}
    meta = None
    stats = collections.defaultdict(int)
    for path in ins:
        f = open(path, "rb")
        src = MmapSource(f)
        if meta is None:
            meta = Reader(src).metadata()
        for (z, x, y), data in all_tiles(src):
            if z >= minz:
                tiles[zxy_to_tileid(z, x, y)] = (z, data)
    with open(out, "wb") as fo:
        w = Writer(fo)
        for tid in sorted(tiles):
            z, data = tiles[tid]
            s = slim_tile(data, z)
            stats[z] += len(s)
            w.write_tile(tid, s)
        meta["vector_layers"] = [l for l in meta["vector_layers"] if l["id"] in KEEP_LAYERS]
        for k in [k for k in meta if k.startswith("pgf:") or k.startswith("planetiler:")]:
            del meta[k]
        meta["description"] = "Teen guide map tiles: Protomaps basemap (OpenStreetMap data) slimmed to the layers the map draws"
        hdr = {"tile_type": 1, "tile_compression": 2, "min_lon_e7": -1800000000, "min_lat_e7": 150000000,
               "max_lon_e7": -600000000, "max_lat_e7": 720000000, "center_zoom": max(3, minz),
               "center_lon_e7": -980000000, "center_lat_e7": 390000000}
        from pmtiles.tile import Compression, TileType
        hdr["tile_type"] = TileType.MVT
        hdr["tile_compression"] = Compression.GZIP
        w.finalize(hdr, meta)
    for z in sorted(stats):
        print("z%d %.1fMB" % (z, stats[z] / 1e6))
    print("total %.1fMB" % (sum(stats.values()) / 1e6))


main()
