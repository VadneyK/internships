// Build-time validation: is a geocoded point really in the claimed state?
// Uses the UNSIMPLIFIED us-atlas 10m states (lon/lat) with d3 geoContains.
import { createRequire } from 'node:module';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import { FIPS_TO_USPS } from './fips.mjs';

const require = createRequire(import.meta.url);
const topo = require('us-atlas/states-10m.json');
const byUsps = new Map();
for (const f of feature(topo, topo.objects.states).features) {
  const usps = FIPS_TO_USPS[String(f.id).padStart(2, '0')];
  if (usps) byUsps.set(usps, f);
}

// inState(lat, lon, 'WA') -> true / false. Throws on an unknown USPS code.
// Note: us-atlas 10m is a generalised (1:10m) boundary, so points within about
// 1 km of a border or coastline can fall just outside; validate with that slack
// in mind.
export function inState(lat, lon, usps) {
  const f = byUsps.get(String(usps).toUpperCase());
  if (!f) throw new Error(`state-check: unknown USPS code ${usps}`);
  return geoContains(f, [lon, lat]);
}

// stateAt(lat, lon) -> USPS code of the state containing the point, or null.
export function stateAt(lat, lon) {
  for (const [usps, f] of byUsps) if (geoContains(f, [lon, lat])) return usps;
  return null;
}
