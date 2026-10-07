#!/usr/bin/env python3
"""Generate the paint-splatter, brush-swoosh and flame SVGs used by the site. Deterministic (seeded)."""
import math, os, random

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "img")
os.makedirs(OUT, exist_ok=True)


def smooth_closed(pts):
    """Catmull-Rom spline through pts as a closed cubic bezier path."""
    n = len(pts)
    d = "M%.1f %.1f" % pts[0]
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += "C%.1f %.1f %.1f %.1f %.1f %.1f" % (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    return d + "Z"


def blob(rng, cx, cy, r, lobes=14, spike=0.55):
    pts = []
    for i in range(lobes * 2):
        a = 2 * math.pi * i / (lobes * 2)
        rr = r * (1 + (spike if i % 2 == 0 else -0.18) * rng.uniform(0.35, 1.0))
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return smooth_closed(pts)


def splat(seed, color, size=800, drops=34):
    rng = random.Random(seed)
    c = size / 2
    parts = ['<path d="%s" fill="%s"/>' % (blob(rng, c, c, size * 0.2, 16, 0.7), color)]
    for _ in range(drops):
        a = rng.uniform(0, 2 * math.pi)
        dist = size * rng.uniform(0.27, 0.46)
        r = size * rng.uniform(0.006, 0.035) * (1.3 if dist < size * 0.34 else 1)
        x, y = c + dist * math.cos(a), c + dist * math.sin(a)
        if rng.random() < 0.35:
            # streak toward the center
            L = size * rng.uniform(0.04, 0.12)
            x2, y2 = x - L * math.cos(a), y - L * math.sin(a)
            parts.append('<path d="M%.1f %.1f L%.1f %.1f" stroke="%s" stroke-width="%.1f" stroke-linecap="round" fill="none"/>' % (x, y, x2, y2, color, r * 1.4))
        parts.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (x, y, r, color))
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" aria-hidden="true">%s</svg>' % (size, size, "".join(parts))


def swoosh(color="#151515"):
    # a dry-brush underline: tapered stroke plus a few hairline streaks
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 60" aria-hidden="true">'
            '<path d="M6 40 C90 18 210 10 340 16 C440 20 520 30 594 22 C560 40 470 48 350 44 C220 40 110 50 6 40Z" fill="%s"/>'
            '<path d="M40 52 C160 42 300 46 430 50" stroke="%s" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>'
            '<path d="M120 12 C220 6 330 8 420 12" stroke="%s" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".5"/>'
            '</svg>') % (color, color, color)


FLAME_OUTER = "M34 2C36 12 46 18 50 30C54 42 46 58 32 61C18 58 10 46 14 34C16 28 21 25 23 19C24 24 28 26 29 21C30 15 31 8 34 2Z"
FLAME_INNER = "M32 59C25 57 21 51 23 45C24 41 28 39 29 35C33 39 38 42 38 49C38 54 36 58 32 59Z"


def flame(fill="#151515", inner="#f6c431"):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="%s" fill="%s"/><path d="%s" fill="%s"/></svg>'
            % (FLAME_OUTER, fill, FLAME_INNER, inner))


files = {
    "splat-orange.svg": splat(7, "#e9572b"),
    "splat-yellow.svg": splat(21, "#f6c431", drops=40),
    "swoosh.svg": swoosh(),
    "favicon.svg": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#f6c431"/>'
                    '<g transform="translate(6 4) scale(.82)"><path d="%s" fill="#151515"/><path d="%s" fill="#e9572b"/></g></svg>') % (FLAME_OUTER, FLAME_INNER),
}
for name, svg in files.items():
    open(os.path.join(OUT, name), "w").write(svg)
    print("wrote", name)
print("FLAME_OUTER", FLAME_OUTER)
print("FLAME_INNER", FLAME_INNER)
