// Map page data (2026-10-15): data/map.json places every program card exactly once, matches what tools/build_map.mjs makes
// from tools/geo/points.json, carries no URLs, and its dots sit inside the map. data/entries-map.json is the lite rows with
// only the keys map.js reads, and gives the same counts as the lite file for every filter the page offers.
// Run with: node --test tests/r3-tests-8-map-data.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildMap } from "../tools/build_map.mjs";
import { BC_BOX, project } from "../tools/geo/project.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const MAP = read("data/map.json");
const ENTRIES = read("data/entries.json");
const LITE = read("data/entries-lite.json");
const ROWS = read("data/entries-map.json");
const POINTS = read("tools/geo/points.json");
const L = createRequire(import.meta.url)(path.join(ROOT, "assets/js/lib.js"));

function allIds(m) {
  const out = [];
  for (const p of m.points.concat(m.bc)) out.push(...p.ids);
  for (const s of Object.keys(m.statewide)) out.push(...m.statewide[s]);
  out.push(...m.online, ...m.national, ...m.multi);
  return out;
}

test("map.json: every card id appears exactly once, and every id is a card in data/entries.json", () => {
  const ids = allIds(MAP), cards = new Set(ENTRIES.map((e) => e.id));
  const seen = new Map();
  for (const id of ids) seen.set(id, (seen.get(id) || 0) + 1);
  const twice = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  assert.deepEqual(twice, [], "ids placed more than once");
  const unknown = ids.filter((id) => !cards.has(id));
  assert.deepEqual(unknown, [], "ids in map.json that are not cards");
  const missing = [...cards].filter((id) => !seen.has(id));
  assert.deepEqual(missing, [], "cards missing from map.json: run python3 tools/geo/geocode.py, then node tools/build_map.mjs (see tools/geo/README.md)");
});

test("map.json has the documented shape and no URLs", () => {
  assert.deepEqual(Object.keys(MAP).sort(), ["bc", "multi", "national", "online", "points", "read", "statewide"]);
  assert.match(MAP.read, /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}$/, "read date like Oct 15, 2026");
  for (const p of MAP.points.concat(MAP.bc)) {
    assert.deepEqual(Object.keys(p).sort(), ["ids", "k", "lat", "lon", "s", "x", "y"], p.k);
    assert.ok(p.ids.length > 0, p.k + " has no cards");
    assert.match(p.s, /^[A-Z]{2}$/, p.k);
    assert.ok(p.k.endsWith(", " + p.s), p.k + " does not end with its state code " + p.s);
  }
  assert.ok(MAP.bc.every((p) => p.s === "BC") && MAP.points.every((p) => p.s !== "BC"), "BC points go in bc, US points in points");
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "data/map.json"), "utf8"), /https?:|www\./i);
});

test("map.json is what tools/build_map.mjs makes from tools/geo/points.json (rerun node tools/build_map.mjs when this fails)", () => {
  assert.deepEqual(buildMap(POINTS), MAP);
});

test("every US dot is inside the 975 x 610 map and is the projection of its own lat and lon; BC dots are inside the BC box", () => {
  for (const p of MAP.points) {
    assert.ok(p.x >= 0 && p.x <= 975 && p.y >= 0 && p.y <= 610, p.k + " off the map");
    assert.deepEqual(project(p.lat, p.lon), [p.x, p.y], p.k);
    const inBox = p.x >= BC_BOX.x && p.x <= BC_BOX.x + BC_BOX.w && p.y >= BC_BOX.y && p.y <= BC_BOX.y + BC_BOX.h;
    assert.ok(!inBox, p.k + " is hidden under the British Columbia box");
  }
  for (const p of MAP.bc) assert.ok(p.x > BC_BOX.x && p.x < BC_BOX.x + BC_BOX.w && p.y > BC_BOX.y && p.y < BC_BOX.y + BC_BOX.h, p.k + " outside the BC box");
});

test("us-states.svg: 975 x 610, every state drawn once, and the British Columbia box covers no state", () => {
  const svg = fs.readFileSync(path.join(ROOT, "assets/img/us-states.svg"), "utf8");
  assert.match(svg, /viewBox="0 0 975 610"/);
  const ids = [...svg.matchAll(/class="st" id="st-([A-Z]{2})"/g)].map((m) => m[1]);
  assert.equal(ids.length, 51, "50 states and DC");
  assert.equal(new Set(ids).size, 51);
  const rect = /<rect class="bc" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(svg);
  assert.ok(rect, "no BC box");
  assert.deepEqual(rect.slice(1).map(Number), [BC_BOX.x, BC_BOX.y, BC_BOX.w, BC_BOX.h], "the SVG box and tools/geo/project.mjs BC_BOX differ");
  // every vertex of every state path, from the absolute M and relative l pairs make_basemap.mjs writes
  for (const m of svg.matchAll(/class="st" id="st-([A-Z]{2})"[^>]*d="([^"]+)"/g)) {
    for (const ring of m[2].matchAll(/M([^l]+)l([^z]*)z/g)) {
      const nums = (s) => (s.match(/-?\d*\.?\d+/g) || []).map(Number);
      let [x, y] = nums(ring[1]);
      const rel = nums(ring[2]);
      for (let i = -2; i < rel.length; i += 2) {
        if (i >= 0) { x += rel[i]; y += rel[i + 1]; }
        const inside = x > BC_BOX.x && x < BC_BOX.x + BC_BOX.w && y > BC_BOX.y && y < BC_BOX.y + BC_BOX.h;
        assert.ok(!inside, m[1] + " has a point at " + x.toFixed(1) + ", " + y.toFixed(1) + " under the BC box");
      }
    }
  }
});

test("data/geo-overrides.json: every hand fix says why or where it came from", () => {
  const ov = read("data/geo-overrides.json");
  for (const k of ["byCity", "byId", "aliases"]) for (const [key, v] of Object.entries(ov[k])) assert.ok(typeof v.reason === "string" && v.reason.trim(), k + " " + key + " has no reason");
  for (const [key, v] of Object.entries(ov.manualPoints)) assert.match(v.source, /https:\/\//, "manualPoints " + key + " has no source link");
});

test("entries-map.json: the lite rows, same ids and order, with only the keys map.js reads", () => {
  const KEYS = ["id", "name", "org", "paid_type", "min_age", "max_age", "status", "deadline_iso", "opens_iso", "regions"];
  assert.deepEqual(ROWS.map((r) => r.id), LITE.map((r) => r.id));
  ROWS.forEach((r, i) => {
    const want = {};
    for (const k of KEYS) if (LITE[i][k] != null) want[k] = LITE[i][k];
    assert.deepEqual(r, want, r.id);
  });
});

test("entries-map.json gives the same city counts as the lite file for every age, pay and open choice", () => {
  const now = Date.now(), lite = new Map(LITE.map((e) => [e.id, e])), rows = new Map(ROWS.map((e) => [e.id, e]));
  for (const age of ["", "12", "14", "16", "18"]) for (const paid of [[], ["pay"]]) for (const when of ["", "open"]) {
    const s = { age, paid, when };
    for (const p of MAP.points.concat(MAP.bc)) {
      const a = p.ids.filter((id) => L.matches(lite.get(id), s, now)).length, b = p.ids.filter((id) => L.matches(rows.get(id), s, now)).length;
      assert.equal(b, a, p.k + " " + JSON.stringify(s));
    }
  }
});
