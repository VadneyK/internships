// Month, year, leap-day and DST-day edges for the lib.js date helpers (addDays, followUpISO, daysUntil, icsEvent).
// Complements r1-tests-4-date-ics-edges and r1-tests-6-boundary-table, so only new cases are here.
// Run with: node --test tests/r2-tests-7-date-edges.test.mjs
process.env.TZ = "America/New_York"; // set before any Date is made, so the DST days are real
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const LIB_PATH = fileURLToPath(new URL("../assets/js/lib.js", import.meta.url));
const WORKER = fileURLToPath(new URL("./r1-tests-1-tzworker.mjs", import.meta.url));
const ZONES = ["America/New_York", "Pacific/Honolulu", "Asia/Kolkata"];

// 20 start dates: leap and non-leap Feb 28 to Mar 1, Dec 31 to Jan 1, and both US DST change days.
const STARTS = [
  "2026-01-01", "2026-01-31", "2026-02-28", "2026-03-01", "2026-03-08",
  "2026-03-14", "2026-10-31", "2026-11-01", "2026-12-31", "2027-01-01",
  "2027-02-28", "2027-03-01", "2027-03-13", "2027-03-14", "2027-03-15",
  "2028-02-28", "2028-02-29", "2028-03-01", "2028-12-31", "2029-06-15",
];

// Child process for the zone checks. It prints JSON. Plain CommonJS, so no extra file is needed.
const CHILD = `
const L = require(process.env.LIB_PATH);
const out = { daysUntil: {}, roundTripBad: 0 };
const DST = ["2026-11-01", "2027-03-14"];
for (const s of DST) {
  const [y, m, d] = s.split("-").map(Number);
  const noon = new Date(y, m - 1, d, 12, 0, 0);
  const late = new Date(y, m - 1, d, 23, 59, 0);
  const plus3 = L.parseISO(L.addDays(s, 3));
  const minus1 = L.parseISO(L.addDays(s, -1));
  out.daysUntil[s] = [L.daysUntil(plus3, noon), L.daysUntil(plus3, late), L.daysUntil(minus1, noon), L.daysUntil(L.parseISO(s), late)];
}
for (const s of ${JSON.stringify(STARTS)}) {
  for (let n = -400; n <= 400; n++) {
    if (L.addDays(L.addDays(s, n), -n) !== s) out.roundTripBad++;
  }
}
console.log(JSON.stringify(out));
`;

function runChild(tz) {
  const r = spawnSync(process.execPath, ["-e", CHILD], {
    env: { ...process.env, TZ: tz, LIB_PATH },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, "child failed under " + tz + ": " + r.stderr);
  return JSON.parse(r.stdout);
}

test("round trip addDays(addDays(d, n), -n) equals d for 20 dates and n from -400 to 400", () => {
  for (const s of STARTS) {
    for (let n = -400; n <= 400; n++) {
      const there = L.addDays(s, n);
      assert.ok(L.parseISO(there), "addDays(" + s + ", " + n + ") is a valid date");
      assert.equal(L.addDays(there, -n), s, "round trip from " + s + " by " + n);
    }
  }
});

test("round trip holds under each zone in a child process", () => {
  for (const tz of ZONES) {
    assert.equal(runChild(tz).roundTripBad, 0, "round trip fails under " + tz);
  }
});

test("addDays crosses the month, year and leap-day edges", () => {
  assert.equal(L.addDays("2027-02-28", 1), "2027-03-01", "non-leap year");
  assert.equal(L.addDays("2028-02-28", 1), "2028-02-29", "leap year");
  assert.equal(L.addDays("2028-02-29", 1), "2028-03-01", "leap day plus one");
  assert.equal(L.addDays("2028-03-01", -1), "2028-02-29", "back over the leap day");
  assert.equal(L.addDays("2027-03-01", -1), "2027-02-28", "back into a non-leap February");
  assert.equal(L.addDays("2026-12-31", 1), "2027-01-01", "year end");
  assert.equal(L.addDays("2027-01-01", -1), "2026-12-31", "year start, back");
  assert.equal(L.addDays("2027-12-31", 366), "2028-12-31", "over a leap day in 2028");
  assert.equal(L.addDays("2028-12-31", 365), "2029-12-31", "over a non-leap year");
  assert.equal(L.addDays("2026-10-31", 1), "2026-11-01", "day before the fall DST change");
  assert.equal(L.addDays("2027-03-13", 1), "2027-03-14", "day of the spring DST change");
  assert.equal(L.addDays("2027-03-14", 1), "2027-03-15", "day after the spring DST change");
});

test("followUpISO adds seven days across month, year and leap-day edges", () => {
  assert.equal(L.followUpISO({ s: "sent", d: "2027-02-25" }), "2027-03-04", "non-leap February");
  assert.equal(L.followUpISO({ s: "sent", d: "2028-02-24" }), "2028-03-02", "leap February");
  assert.equal(L.followUpISO({ s: "sent", d: "2026-12-28" }), "2027-01-04", "year end");
  assert.equal(L.followUpISO({ s: "sent", d: "2027-03-10" }), "2027-03-17", "across the spring DST change");
  assert.equal(L.followUpISO({ s: "sent", d: "2026-10-30" }), "2026-11-06", "across the fall DST change");
});

test("daysUntil is an integer on the DST change days in the chosen zones", () => {
  for (const tz of ZONES) {
    const o = runChild(tz).daysUntil;
    for (const s of Object.keys(o)) {
      for (const v of o[s]) assert.ok(Number.isInteger(v), tz + " " + s + " gives " + v);
    }
  }
});

test("daysUntil counts calendar days across the DST change days", () => {
  const fall = runChild("America/New_York").daysUntil["2026-11-01"];
  assert.deepEqual(fall, [3, 3, -1, 0], "fall change day");
  const spring = runChild("America/New_York").daysUntil["2027-03-14"];
  assert.deepEqual(spring, [3, 3, -1, 0], "spring change day");
  const honolulu = runChild("Pacific/Honolulu").daysUntil["2027-03-14"];
  assert.deepEqual(honolulu, [3, 3, -1, 0], "no DST in Honolulu");
});

test("daysUntil from in-process local noon on the DST days", () => {
  assert.equal(L.daysUntil(L.parseISO("2027-03-17"), new Date(2027, 2, 14, 12)), 3);
  assert.equal(L.daysUntil(L.parseISO("2026-11-04"), new Date(2026, 10, 1, 12)), 3);
  assert.equal(L.daysUntil(L.parseISO("2027-03-13"), new Date(2027, 2, 14, 12)), -1);
});

test("the existing zone worker still reports integer daysUntil values", () => {
  for (const tz of ZONES) {
    const r = spawnSync(process.execPath, [WORKER], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
    assert.equal(r.status, 0, "worker failed under " + tz + ": " + r.stderr);
    const o = JSON.parse(r.stdout);
    for (const k of Object.keys(o.daysUntil)) {
      for (const v of o.daysUntil[k]) assert.ok(Number.isInteger(v), tz + " " + k);
    }
  }
});

test("icsEvent DTEND is the next calendar day across year and leap-day edges", () => {
  const stamp = new Date(Date.UTC(2026, 9, 10, 12, 0, 0));
  const cases = [
    ["2028-02-28", "20280228", "20280229"],
    ["2028-02-29", "20280229", "20280301"],
    ["2027-02-28", "20270228", "20270301"],
    ["2026-12-31", "20261231", "20270101"],
    ["2027-03-14", "20270314", "20270315"],
  ];
  for (const [iso, start, end] of cases) {
    const ics = L.icsEvent({ uid: "edge-" + iso, title: "Deadline", desc: "Check the date", dateISO: iso, stamp });
    assert.match(ics, new RegExp("DTSTART;VALUE=DATE:" + start + "\\r\\n"), iso + " start");
    assert.match(ics, new RegExp("DTEND;VALUE=DATE:" + end + "\\r\\n"), iso + " end");
  }
});

test("addDays on 2028-02-28 plus 1 is 2028-02-29", () => {
  assert.equal(L.addDays("2028-02-28", 1), "2028-02-29");
});
