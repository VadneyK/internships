// Checks every point in tools/geo/points.json: inside its named state (unsimplified us-atlas outline) and inside the map box.
// Run from the repo root: node tools/geo/check_points.mjs [fails.json] [xy.json]   (default: tools/geo/check-fails.json and check-xy.json, not committed)
import fs from 'node:fs';
import { inState, stateAt } from './state-check.mjs';
import { project } from './project.mjs';
const pts = JSON.parse(fs.readFileSync(new URL('./points.json', import.meta.url), 'utf8'));
const fails = [], xy = [];
const counts = { cities: pts.cities.length, cards: 0, bc: 0, stateFail: 0, boxFail: 0, nullProj: 0 };
for (const c of pts.cities) {
  counts.cards += c.ids.length;
  const p = project(c.lat, c.lon);
  const f = [];
  if (c.state === 'BC') {
    counts.bc++;
    if (p !== null) f.push('BC point projected to ' + p);
  } else {
    let ok;
    try { ok = inState(c.lat, c.lon, c.state); } catch (e) { ok = false; f.push('unknown state ' + c.state); }
    if (!ok) { f.push(`not in ${c.state}; stateAt=${stateAt(c.lat, c.lon)}`); counts.stateFail++; }
    if (!p) { f.push('project null'); counts.nullProj++; }
    else if (!(p[0] >= 0 && p[0] <= 975 && p[1] >= 0 && p[1] <= 610)) { f.push('outside box ' + p); counts.boxFail++; }
    else xy.push({ key: c.key, state: c.state, x: Math.round(p[0]*10)/10, y: Math.round(p[1]*10)/10, n: c.ids.length });
  }
  if (f.length) fails.push({ key: c.key, state: c.state, lat: c.lat, lon: c.lon, precision: c.precision, n: c.ids.length, ids: c.ids, problems: f });
}
fs.writeFileSync(process.argv[2] || new URL('./check-fails.json', import.meta.url), JSON.stringify({ counts, fails }, null, 1));
fs.writeFileSync(process.argv[3] || new URL('./check-xy.json', import.meta.url), JSON.stringify(xy));
console.log(JSON.stringify(counts), 'xy', xy.length);
for (const f of fails) console.log(f.key, f.precision, f.lat, f.lon, f.problems.join('; '), f.ids.slice(0,3).join(','));
