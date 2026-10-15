// Writes data/map.json for the map page (map.html) from tools/geo/points.json.
// Run from the repo root after tools/geo/geocode.py: node tools/build_map.mjs
//
// x and y are worked out here with tools/geo/project.mjs, the same projection that drew assets/img/us-states.svg
// (geoAlbersUsa, scale 1300, translate [487.5, 305], a 975 x 610 box). British Columbia points go in the small
// inset box (projectBC). Every card id lands in exactly one place: a city point, "Anywhere in <state>",
// online, national, or several places. No URLs are written.
//
// Output shape:
// {"read": "Oct 15, 2026",
//  "points": [{"k": "Oakland, CA", "s": "CA", "x": 0, "y": 0, "lat": 0, "lon": 0, "ids": ["..."]}],
//  "bc": [same shape, x and y inside the BC inset],
//  "statewide": {"CA": ["..."]}, "online": ["..."], "national": ["..."], "multi": ["..."]}
import fs from "node:fs";
import { project, projectBC } from "./geo/project.mjs";

const ROOT = new URL("../", import.meta.url);
const pts = JSON.parse(fs.readFileSync(new URL("tools/geo/points.json", ROOT), "utf8"));

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-10-15" to "Oct 15, 2026", the way the other data files write their read dates
function label(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) throw new Error("points.json read date is not YYYY-MM-DD: " + iso);
  return MON[+m[2] - 1] + " " + +m[3] + ", " + m[1];
}

export function buildMap(src) {
  if (src.unmatched && src.unmatched.length) throw new Error(src.unmatched.length + " cards are unmatched in points.json");
  const out = { read: label(src.read), points: [], bc: [], statewide: {}, online: [], national: [], multi: [] };
  for (const c of src.cities) {
    const row = (xy) => ({ k: c.key, s: c.state, x: xy[0], y: xy[1], lat: c.lat, lon: c.lon, ids: [...c.ids].sort() });
    if (c.state === "BC") {
      const xy = projectBC(c.lat, c.lon);
      if (!xy) throw new Error("BC point outside the inset window: " + c.key);
      out.bc.push(row(xy));
    } else {
      const xy = project(c.lat, c.lon);
      if (!xy) throw new Error("point off the map: " + c.key);
      out.points.push(row(xy));
    }
  }
  const byKey = (a, b) => (a.s + "|" + a.k < b.s + "|" + b.k ? -1 : 1);
  out.points.sort(byKey);
  out.bc.sort(byKey);
  const np = src.noPoint;
  for (const st of Object.keys(np.statewide).sort()) out.statewide[st] = [...np.statewide[st]].sort();
  for (const k of ["online", "national", "multi"]) out[k] = [...np[k]].sort();
  return out;
}

if (import.meta.url === "file://" + process.argv[1]) {
  const out = buildMap(pts);
  // one point per line keeps the diff readable when a card moves
  const line = (r) => JSON.stringify(r);
  const text =
    '{"read":' + JSON.stringify(out.read) + ",\n" +
    '"points":[\n' + out.points.map(line).join(",\n") + "\n],\n" +
    '"bc":[\n' + out.bc.map(line).join(",\n") + "\n],\n" +
    '"statewide":' + JSON.stringify(out.statewide) + ",\n" +
    '"online":' + JSON.stringify(out.online) + ",\n" +
    '"national":' + JSON.stringify(out.national) + ",\n" +
    '"multi":' + JSON.stringify(out.multi) + "\n}\n";
  fs.writeFileSync(new URL("data/map.json", ROOT), text);
  const n = out.points.reduce((a, p) => a + p.ids.length, 0) + out.bc.reduce((a, p) => a + p.ids.length, 0);
  console.log("wrote data/map.json: " + out.points.length + " US points, " + out.bc.length + " BC points, " + n + " cards on a point, " + Buffer.byteLength(text) + " bytes");
}
