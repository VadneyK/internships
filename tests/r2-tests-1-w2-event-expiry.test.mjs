// r2-tests-1 (w2): an event card whose date has passed must leave "Apply any time" and show "Event passed", not "Closed, check back".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const L = createRequire(import.meta.url)(join(root, "assets/js/lib.js"));
const ALL = JSON.parse(readFileSync(join(root, "data/entries.json"), "utf8"));
const events = ALL.filter((e) => e.status === "event");
const dated = events.filter((e) => e.deadline_iso);
const undated = events.filter((e) => !e.deadline_iso);
const noon = (iso, plus) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d + plus, 12); };
const bucket = (e, now, id) => L.insights([e], now).status.find((g) => g.id === id).n;

test("there are dated and undated event cards to sweep", () => {
  assert.ok(dated.length > 0);
  assert.ok(undated.length > 0);
});

test("dated event: stays an event through its day, closes the day after", () => {
  const bad = [];
  for (const e of dated) {
    for (const plus of [-1, 0]) {
      const now = noon(e.deadline_iso, plus);
      if (L.effStatus(e, now) !== "event" || bucket(e, now, "anytime") !== 1 || bucket(e, now, "closed") !== 0) bad.push(e.id + " " + plus);
    }
    for (const plus of [1, 90]) {
      const now = noon(e.deadline_iso, plus);
      if (L.effStatus(e, now) !== "event-passed") bad.push(e.id + " status " + plus);
      if (L.futureDeadline(e, now) !== null || L.knownDeadline(e, now) !== null) bad.push(e.id + " deadline " + plus);
      if (bucket(e, now, "anytime") !== 0 || bucket(e, now, "closed") !== 0 || bucket(e, now, "passed") !== 1) bad.push(e.id + " bucket " + plus);
    }
  }
  assert.deepEqual(bad, []);
});

test("undated event keeps status event at every date", () => {
  for (const e of undated) {
    for (const d of ["2026-10-10", "2027-01-05", "2028-06-01"]) assert.equal(L.effStatus(e, noon(d, 0)), "event", e.id);
  }
});
