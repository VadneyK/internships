// relaxOptions and relaxLabel on the real cards: counts are true, capped at 3, sorted, and the words are clean.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const entries = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

const CLOCKS = [new Date(2026, 9, 10).getTime(), new Date(2027, 2, 15).getTime()];
const RELAX_ORDER = ["q", "age", "when", "season", "paid", "types", "fields", "verified", "noPermit", "hubs", "place"];

const places = ["city:" + L.CITIES[0][0], "area:" + L.AREAS[0][0], "state:" + L.STATES[0][0], "state:" + L.STATES[L.STATES.length - 1][0]];
const singles = [];
for (let age = 12; age <= 18; age++) singles.push({ age });
["open", "60", "anytime", "closed"].forEach((when) => singles.push({ when }));
["summer", "school-year", "fall", "winter", "spring"].forEach((season) => singles.push({ season }));
singles.push({ verified: true }, { noPermit: true }, { q: "zzzqx" }, { q: "robotics" });
places.forEach((place) => singles.push({ place }));
const states = singles.slice();
const base = [{ age: 14 }, { age: 16, when: "open" }, { when: "60", season: "summer" }, { verified: true, noPermit: true }, { q: "zzzqx" }];
const extra = [{ season: "winter" }, { verified: true }, { place: places[0] }, { place: places[2], when: "closed" }, { noPermit: true, q: "zzzqx" }, { types: ["research"] }, { hubs: [L.HUBS[0][0]] }];
base.forEach((b) => extra.forEach((x) => states.push({ ...b, ...x })));
base.forEach((b) => extra.forEach((x, i) => states.push({ age: 12, ...b, ...x, ...extra[(i + 2) % extra.length] })));

function removal(st, key) {
  const v = st[key], s = { ...st, placeOnline: false };
  s[key] = Array.isArray(v) ? [] : typeof v === "boolean" ? false : "";
  return s;
}
const count = (s, now) => entries.filter((e) => L.matches(e, s, now)).length;

test("relax suggestions on real cards are true, capped, sorted and well worded", () => {
  let checked = 0, withOptions = 0;
  for (const now of CLOCKS) for (const st of states) {
    const before = JSON.stringify(st);
    const out = L.relaxOptions(entries, st, now);
    const ctx = JSON.stringify(st) + " at " + now;
    assert.equal(JSON.stringify(st), before, "state mutated: " + ctx);
    assert.ok(out.length <= 3, "more than 3: " + ctx);
    for (let i = 0; i < out.length; i++) {
      const o = out[i];
      assert.ok(o.count > 0, "zero count: " + ctx);
      assert.ok(RELAX_ORDER.includes(o.key), "bad key " + o.key);
      if (i > 0) {
        const p = out[i - 1];
        assert.ok(p.count > o.count || (p.count === o.count && RELAX_ORDER.indexOf(p.key) < RELAX_ORDER.indexOf(o.key)), "bad order: " + ctx);
      }
      let s = removal(st, o.key), n = count(s, now);
      if (s.place && n < 3) { s.placeOnline = true; n = count(s, now); }
      assert.equal(o.count, n, "wrong count for " + o.key + ": " + ctx);
      assert.match(o.label, /^Remove /, ctx);
      assert.ok(!/undefined|NaN|\[object/.test(o.label), "bad label " + o.label);
      assert.ok(o.label.trim().length > "Remove ".length && !/:\s*$/.test(o.label), "empty value: " + o.label);
      checked++;
    }
    if (out.length) withOptions++;
  }
  assert.ok(checked > 100 && withOptions > 20, "grid too thin: " + checked + "/" + withOptions);
});
