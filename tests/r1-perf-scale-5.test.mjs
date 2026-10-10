// sortList computes rank() once per entry, not once per comparison, and keeps the old order exactly.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lib = require("../assets/js/lib.js");
const entries = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const NOWS = [new Date(2026, 9, 10, 12).getTime(), new Date(2026, 11, 1, 12).getTime(), new Date(2027, 2, 15, 12).getTime()];

// Reference: the comparator-based sort as it was before this change. Do not "improve" it.
function refSort(list, mode, now) {
  const l = list.slice();
  if (mode === "name") l.sort((a, b) => a.name.localeCompare(b.name));
  else if (mode === "deadline") l.sort((a, b) => {
    const da = lib.futureDeadline(a, now), db = lib.futureDeadline(b, now);
    if (da && db) return da - db || lib.compare(a, b, now);
    if (da) return -1; if (db) return 1; return lib.compare(a, b, now);
  });
  else l.sort((a, b) => lib.compare(a, b, now));
  return l;
}
const ids = (l) => l.map((e) => e.id);
const MODES = ["best", "deadline", "name"];

test("the real data has as many entries as data/meta.json says", () => {
  const meta = JSON.parse(fs.readFileSync(new URL("../data/meta.json", import.meta.url), "utf8"));
  assert.equal(entries.length, meta.count);
});

test("same id order as the reference sort for every mode and fixed date", () => {
  for (const now of NOWS) for (const mode of MODES) {
    assert.deepEqual(ids(lib.sortList(entries, mode, now)), ids(refSort(entries, mode, now)), mode + " at " + new Date(now).toISOString());
  }
});

test("default mode is 'best'", () => {
  assert.deepEqual(ids(lib.sortList(entries, undefined, NOWS[0])), ids(refSort(entries, "best", NOWS[0])));
});

test("same order when deadline_iso is null or the same day on every entry", () => {
  const nulled = entries.map((e) => Object.assign({}, e, { deadline_iso: null }));
  const sameDay = entries.map((e) => Object.assign({}, e, { deadline_iso: "2026-12-15" }));
  for (const list of [nulled, sameDay]) for (const now of NOWS) for (const mode of MODES) {
    assert.deepEqual(ids(lib.sortList(list, mode, now)), ids(refSort(list, mode, now)), mode);
  }
});

test("does not change the input list", () => {
  const before = ids(entries);
  for (const mode of MODES) lib.sortList(entries, mode, NOWS[0]);
  assert.deepEqual(ids(entries), before);
});

test("rank() runs at most once per entry for one sort", () => {
  const realRank = lib.rank;
  try {
    for (const mode of MODES) {
      let calls = 0;
      lib.rank = function (e, now) { calls++; return realRank(e, now); };
      lib.sortList(entries, mode, NOWS[0]);
      assert.ok(calls <= entries.length, mode + ": " + calls + " rank calls for " + entries.length + " entries");
    }
    let calls = 0;
    lib.rank = function (e, now) { calls++; return realRank(e, now); };
    lib.sortList(entries, "best", NOWS[0]);
    assert.equal(calls, entries.length);
  } finally { lib.rank = realRank; }
});

test("sortList('best') is at least 3 times faster than the reference", () => {
  const time = (fn) => { let best = Infinity; for (let i = 0; i < 5; i++) { const t = process.hrtime.bigint(); fn(); best = Math.min(best, Number(process.hrtime.bigint() - t)); } return best; };
  lib.sortList(entries, "best", NOWS[0]); refSort(entries, "best", NOWS[0]); // warm up
  const fast = time(() => lib.sortList(entries, "best", NOWS[0]));
  const slow = time(() => refSort(entries, "best", NOWS[0]));
  assert.ok(slow / fast >= 3, "ratio " + (slow / fast).toFixed(1) + " (reference " + (slow / 1e6).toFixed(2) + " ms, new " + (fast / 1e6).toFixed(2) + " ms)");
});

test("lib.compare and lib.rank keep their behavior", () => {
  const a = entries[0], b = entries[1];
  assert.equal(lib.rank(a, NOWS[0]).length, 7);
  assert.equal(lib.compare(a, a, NOWS[0]), 0);
  assert.equal(lib.compare(a, b, NOWS[0]), -lib.compare(b, a, NOWS[0]));
});
