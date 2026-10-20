"""Minimal Mapbox Vector Tile protobuf reader/writer for filtering layers and features without decoding geometry."""
import gzip


def varint(buf, i):
    shift = 0
    out = 0
    while True:
        b = buf[i]
        i += 1
        out |= (b & 0x7F) << shift
        if b < 0x80:
            return out, i
        shift += 7


def enc_varint(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def fields(buf):
    """Yield (field_number, wire_type, value_bytes_or_int, raw_slice) for each top-level field."""
    i = 0
    n = len(buf)
    while i < n:
        start = i
        key, i = varint(buf, i)
        fn, wt = key >> 3, key & 7
        if wt == 0:
            v, i = varint(buf, i)
        elif wt == 2:
            ln, i = varint(buf, i)
            v = buf[i:i + ln]
            i += ln
        elif wt == 1:
            v = buf[i:i + 8]
            i += 8
        elif wt == 5:
            v = buf[i:i + 4]
            i += 4
        else:
            raise ValueError("wire type %d" % wt)
        yield fn, wt, v, buf[start:i]


def value_str(vbuf):
    for fn, wt, v, _ in fields(vbuf):
        if fn == 1:
            return bytes(v).decode("utf8", "replace")
        if wt == 0:
            return v
        if fn in (2, 3):
            import struct
            return struct.unpack("<f" if fn == 2 else "<d", v)[0]
    return None


def packed(v):
    out = []
    i = 0
    while i < len(v):
        x, i = varint(v, i)
        out.append(x)
    return out


def parse_layer(lbuf):
    name = None
    keys, values, feats, other = [], [], [], []
    for fn, wt, v, raw in fields(lbuf):
        if fn == 1:
            name = bytes(v).decode()
        elif fn == 2:
            feats.append(v)
        elif fn == 3:
            keys.append(bytes(v).decode())
        elif fn == 4:
            values.append(value_str(v))
        else:
            other.append(raw)
    return name, keys, values, feats, other


def feature_props(fbuf, keys, values):
    props = {}
    for fn, wt, v, _ in fields(fbuf):
        if fn == 2:
            t = packed(v)
            for a in range(0, len(t) - 1, 2):
                props[keys[t[a]]] = values[t[a + 1]]
    return props


def layer_name(lbuf):
    for fn, wt, v, _ in fields(lbuf):
        if fn == 1:
            return bytes(v).decode()


def tile_layers(tile):
    """tile: uncompressed bytes. Yield (name, layer_bytes, raw_field)."""
    for fn, wt, v, raw in fields(tile):
        if fn == 3:
            yield layer_name(v), v, raw


def rebuild_layer(lbuf, keep_feature):
    """Return new layer bytes keeping features where keep_feature(props) is truthy, or None if none kept.

    Unused keys/values stay in the tables; that is valid MVT and costs a few bytes."""
    name, keys, values, feats, other = parse_layer(lbuf)
    out = bytearray()
    kept = 0
    for fn, wt, v, raw in fields(lbuf):
        if fn == 2:
            if keep_feature(feature_props(v, keys, values)):
                out += raw
                kept += 1
        else:
            out += raw
    return bytes(out) if kept else None


def wrap(fn, payload):
    return enc_varint((fn << 3) | 2) + enc_varint(len(payload)) + payload


def ungz(b):
    return gzip.decompress(b) if b[:2] == b"\x1f\x8b" else b
