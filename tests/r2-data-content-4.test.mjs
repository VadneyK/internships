// knownDeadline: confirmed future deadlines on closed or unconfirmed cards, for the Find dates view only.
// Run with: node --test tests/r2-data-content-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ENTRIES = JSON.parse(readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const NOW = new Date(2026, 9, 9).getTime();

const KNOWN = {
  "bloomington-iu-jacobs-dance-summer-intensives": "2027-02-08",
  "college-park-pg-parks-shakespeare-in-the-parks-apprenticeship": "2027-03-01",
  "college-park-pg-parks-teen-performance-ensemble": "2027-02-07",
  "college-park-umd-sparc-robotics-certificate": "2026-12-01",
  "emory-pre-college-program": "2027-05-03",
  "nc-museum-natural-sciences-junior-interpreters": "2027-03-22",
  "nyc-columbia-pre-college-nyc-commuter-summer": "2027-04-01",
  "pittsburgh-cmu-cs-scholars": "2027-02-01",
  "pittsburgh-cmu-pre-college-programs": "2027-03-01",
  "pittsburgh-cmu-summer-academy-math-science": "2027-02-01"
};
const byId = (id) => ENTRIES.find((e) => e.id === id);
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

test("knownDeadline is exported", () => {
  assert.equal(typeof L.knownDeadline, "function");
});

test("the cards with a confirmed date get it, and futureDeadline still returns null", () => {
  for (const id of Object.keys(KNOWN)) {
    const e = byId(id);
    assert.ok(e, id + " is in entries.json");
    const k = L.knownDeadline(e, NOW);
    assert.ok(k, id + " should have a known deadline");
    assert.equal(iso(k), KNOWN[id], id);
    assert.equal(L.futureDeadline(e, NOW), null, id + " futureDeadline must stay null");
  }
});

test("a closed card with a last-year pattern or a past date returns null", () => {
  const base = byId("pittsburgh-cmu-cs-scholars");
  const pattern = Object.assign({}, base, { deadline_confidence: "last-year-pattern" });
  assert.equal(L.knownDeadline(pattern, NOW), null);
  const past = Object.assign({}, base, { deadline_iso: "2026-10-08" });
  assert.equal(L.knownDeadline(past, NOW), null);
  const none = Object.assign({}, base, { deadline_iso: null });
  assert.equal(L.knownDeadline(none, NOW), null);
});

test("today counts, and unconfirmed cards work the same way", () => {
  const base = byId("pittsburgh-cmu-cs-scholars");
  const today = Object.assign({}, base, { deadline_iso: "2026-10-09" });
  assert.ok(L.knownDeadline(today, NOW));
  const unconf = Object.assign({}, base, { status: "unconfirmed" });
  assert.ok(L.knownDeadline(unconf, NOW));
});

test("it matches futureDeadline when that is set, and never adds other statuses", () => {
  for (const e of ENTRIES) {
    const f = L.futureDeadline(e, NOW), k = L.knownDeadline(e, NOW);
    if (f) assert.equal(k && k.getTime(), f.getTime(), e.id);
    else if (k) assert.ok(["closed-expect-reopen", "unconfirmed"].includes(L.effStatus(e, NOW)) && e.deadline_confidence === "confirmed-2026-27", e.id);
  }
  const extra = ENTRIES.filter((e) => !L.futureDeadline(e, NOW) && L.knownDeadline(e, NOW)).map((e) => e.id).sort();
  assert.deepEqual(extra, Object.keys(KNOWN).sort());
});

test("the 60 day filter does not pick up the new rows", () => {
  const e = byId("pittsburgh-cmu-cs-scholars");
  const far = new Date(2026, 11, 20).getTime();
  assert.equal(L.matches(e, { when: "60" }, far), false);
});
