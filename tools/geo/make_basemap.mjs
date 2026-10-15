// Build step: writes us-states.svg from us-atlas (BUILD TIME ONLY).
// Run from the repo root: node tools/geo/make_basemap.mjs   (needs the devDependencies us-atlas, topojson-client, topojson-simplify, d3-geo; npm ci installs them)
// Writes assets/img/us-states.svg. Licenses: licenses/us-atlas-ISC.txt.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { feature, merge } from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';
import { geoPath } from 'd3-geo';
import { FIPS_TO_USPS } from './fips.mjs';
import { BC_BOX } from './project.mjs';

const require = createRequire(import.meta.url);
const SIZE_LIMIT = 58000; // bytes; the hard requirement is < 60 KB
const MIN_AREA = 1.2;     // px^2: drop islands smaller than this (each state's largest piece is always kept)

// states-albers-10m is already projected with geoAlbersUsa().scale(1300).translate([487.5,305])
// into a 975 x 610 box, i.e. the same projection project.mjs uses.
const topo = require('us-atlas/states-albers-10m.json');
const planar = geoPath(); // identity: the data is already in SVG pixels
const area = (geom) => Math.abs(planar.area(geom));

const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (n) => {
  let s = r1(n).toString();
  if (s === '-0') s = '0';
  return s.replace(/^(-?)0\./, '$1.');
};
// join numbers with the shortest valid separator (a minus sign needs none)
const joinNums = (list) => list.reduce((out, s) => (out && !s.startsWith('-') ? out + ' ' + s : out + s), '');

// Absolute M, then relative l pairs; tracks the rounded position so error cannot accumulate.
function ringPath(ring) {
  const pts = ring.slice(0, -1);
  let [cx, cy] = [r1(pts[0][0]), r1(pts[0][1])];
  const nums = [];
  for (const [x, y] of pts.slice(1)) {
    const rx = r1(x), ry = r1(y);
    const dx = r1(rx - cx), dy = r1(ry - cy);
    if (dx === 0 && dy === 0) continue;
    nums.push(fmt(dx), fmt(dy));
    cx = rx; cy = ry;
  }
  if (nums.length < 4) return '';
  return 'M' + joinNums([fmt(pts[0][0]), fmt(pts[0][1])]) + 'l' + joinNums(nums) + 'z';
}

function geomToPath(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const kept = polys
    .filter((rings) => rings[0] && rings[0].length >= 4)
    .map((rings) => ({ rings, a: area({ type: 'Polygon', coordinates: rings }) }));
  if (!kept.length) return '';
  const maxA = Math.max(...kept.map((p) => p.a));
  return kept
    .filter((p) => p.a >= MIN_AREA || p.a === maxA)
    .map((p) => p.rings.map(ringPath).join(''))
    .join('');
}

function build(minWeight) {
  const t = simplify(presimplify(structuredClone(topo)), minWeight);
  const rows = feature(t, t.objects.states).features
    .map((f) => ({ usps: FIPS_TO_USPS[String(f.id).padStart(2, '0')], name: f.properties.name, d: geomToPath(f.geometry) }))
    .sort((a, b) => a.usps.localeCompare(b.usps));
  for (const r of rows) if (!r.d) throw new Error('state vanished: ' + r.usps);
  const b = BC_BOX;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 975 610" role="img" aria-label="Map of the United States">\n' +
    `<path class="nation" d="${geomToPath(merge(t, t.objects.states.geometries))}"/>\n` +
    rows.map((r) => `<path class="st" id="st-${r.usps}" data-name="${r.name}" d="${r.d}"/>`).join('\n') + '\n' +
    `<rect class="bc" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/>\n` +
    '</svg>\n';
  return { svg, count: rows.length };
}

// Pick the gentlest simplification that fits the size budget.
let chosen = null;
for (let w = 0.02; w < 50; w *= 1.2) {
  const r = build(w);
  const bytes = Buffer.byteLength(r.svg);
  if (bytes <= SIZE_LIMIT) { chosen = { ...r, w, bytes }; break; }
}
if (!chosen) throw new Error('could not fit size budget');
writeFileSync(new URL('../../assets/img/us-states.svg', import.meta.url), chosen.svg);
console.log(`us-states.svg: ${chosen.bytes} bytes (${(chosen.bytes / 1024).toFixed(1)} KiB), ${chosen.count} states, minWeight ${chosen.w.toFixed(3)}`);
