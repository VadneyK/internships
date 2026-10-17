// 2026-10-17: tests for the lib.js mutants the CI mutation run on main (run 39006683106) left alive, worst for a teen first.
// The hours checker could be made to report a too-early start, a late-hours exception or a weekly cap on every schedule,
// even a legal one, and no test noticed. Also: a program closing within 21 days must rank above a cheaper one closing
// later, clock times like 9:10, calendar line folding, the relax count for a place, and the Numbers page month lists.
// Run with: node --test tests/r10-tests-1-mut-lib-hours.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const OFF = null;
const week = (...days) => { const d = days.slice(); while (d.length < 7) d.push(OFF); return d; };
const day = (from, to) => ({ from, to });

/* ---------- hoursCheck: no problem is reported for a schedule inside every limit ---------- */

const LIMITS = { 14: { schoolDay: 3, nonSchoolDay: 8, schoolWeek: 18, offWeek: 40, earliest: 7, latest: 19, latestSummer: 21 } };

test("hoursCheck: a legal school week has no problems, even with every limit set", () => {
  const r = L.hoursCheck(LIMITS, 14, true, week(day(15, 18), day(15, 18), day(15, 18), day(15, 18), day(15, 18), day(9, 12)));
  assert.equal(r.limited, true);
  assert.equal(r.total, 18);
  assert.deepEqual(r.problems, []);
});

test("hoursCheck: the earliest start is flagged only when the day starts before it", () => {
  const ok = L.hoursCheck(LIMITS, 14, false, week(day(7, 12)));
  assert.deepEqual(ok.problems, [], "starting at 7 a.m. is allowed when the limit is 7 a.m.");
  const early = L.hoursCheck(LIMITS, 14, false, week(day(6.5, 12)));
  assert.deepEqual(early.problems, ["Monday: starting before 7 a.m. is not allowed at 14."]);
  const none = L.hoursCheck({ 14: { nonSchoolDay: 8 } }, 14, false, week(day(5, 9)));
  assert.deepEqual(none.problems, [], "no earliest limit, no early-start problem");
});

test("hoursCheck: the weekly cap is reported only above the cap", () => {
  const at = L.hoursCheck(LIMITS, 14, true, week(day(15, 18), day(15, 18), day(15, 18), day(15, 18), day(15, 18), day(10, 13)));
  assert.equal(at.total, 18);
  assert.deepEqual(at.problems, [], "18 hours is exactly the 18 hour school week cap");
  const over = L.hoursCheck(LIMITS, 14, true, week(day(15, 18), day(15, 18), day(15, 18), day(15, 18), day(15, 18), day(10, 14)));
  assert.deepEqual(over.problems, ["The week adds up to 19 hours, more than the 18 hour limit while school is in session at 14."]);
  const noCap = L.hoursCheck({ 14: { nonSchoolDay: 8 } }, 14, false, week(day(9, 17), day(9, 17), day(9, 17), day(9, 17), day(9, 17), day(9, 17)));
  assert.equal(noCap.total, 48);
  assert.deepEqual(noCap.problems, [], "no weekly cap, no weekly problem");
  // permits.json writes "no limit" as null, and 48 > null is true in JavaScript, so check null as well as a missing key.
  const nullCap = L.hoursCheck({ 14: { nonSchoolDay: 8, schoolDay: 8, offWeek: null, schoolWeek: null, earliest: null, latest: null } }, 14, false,
    week(day(9, 17), day(9, 17), day(9, 17), day(9, 17), day(9, 17), day(9, 17)));
  assert.deepEqual(nullCap.problems, [], "null limits are no limits");
});

test("hoursCheck: the late-hours exception is offered only up to its own latest time", () => {
  const lim = { 16: { latest: 22, lateMax: 24, lateNote: "until midnight on a night before a day off" } };
  const within = L.hoursCheck(lim, 16, true, week(day(18, 23)));
  assert.deepEqual(within.problems, ["Monday: the end time is past the usual limit of 10 p.m. at 16. There is an exception: until midnight on a night before a day off."]);
  const past = L.hoursCheck({ 16: { latest: 22, lateMax: 23, lateNote: "until 11 p.m. with a parent's note" } }, 16, true, week(day(18, 23.5)));
  assert.deepEqual(past.problems, ["Monday: the end time is past the usual limit of 10 p.m. at 16."], "past the exception's own end, no exception is offered");
  const noNote = L.hoursCheck({ 16: { latest: 22, lateMax: 24 } }, 16, true, week(day(18, 23)));
  assert.deepEqual(noNote.problems, ["Monday: the end time is past the usual limit of 10 p.m. at 16."]);
});

/* ---------- clockLabel ---------- */

test("clockLabel: minutes from 10 up have no leading zero; under 10 have one", () => {
  assert.equal(L.clockLabel(9 + 10 / 60), "9:10 a.m.");
  assert.equal(L.clockLabel(21 + 9 / 60), "9:09 p.m.");
  assert.equal(L.clockLabel(13 + 45 / 60), "1:45 p.m.");
});

/* ---------- rank: a deadline within 21 days beats cost ---------- */

test("rank: an open program closing within 21 days sorts before a cheaper one closing later", () => {
  const now = new Date(2026, 9, 17).getTime();
  const soonFee = { id: "a", name: "A", status: "open-now", paid_type: "fee-based", deadline_iso: "2026-10-30", deadline_confidence: "confirmed-2026-27", priority: 3 };
  const laterPaid = { id: "b", name: "B", status: "open-now", paid_type: "paid", deadline_iso: "2027-01-15", deadline_confidence: "confirmed-2026-27", priority: 3 };
  assert.deepEqual(L.sortList([laterPaid, soonFee], "best", now).map((e) => e.id), ["a", "b"]);
  assert.equal(L.rank(soonFee, now)[1], 0);
  assert.equal(L.rank(laterPaid, now)[1], 1);
  const exactly21 = Object.assign({}, laterPaid, { id: "c", deadline_iso: "2026-11-07" });
  assert.equal(L.rank(exactly21, now)[1], 0, "21 days away still counts as soon");
});

/* ---------- icsFold ---------- */

test("icsFold: a lone backslash at the end stays as it is", () => {
  const ics = L.icsEvent({ dateISO: "2026-11-01", uid: "x", title: "Ends in a backslash \\", desc: "", stamp: new Date(Date.UTC(2026, 9, 17)) });
  assert.match(ics, /SUMMARY:Ends in a backslash \\\\\r\n/);
  assert.doesNotMatch(ics, /undefined/);
});

/* ---------- relaxOptions: a place with exactly 3 matches is not widened ---------- */

test("relaxOptions: a place with exactly 3 matches counts only those 3, not online programs too", () => {
  const now = new Date(2026, 9, 17).getTime();
  const local = (id) => ({ id, name: id, status: "rolling", paid_type: "paid", regions: ["boston"], min_age: 14, max_age: 18 });
  const online = (id) => ({ id, name: id, status: "rolling", paid_type: "paid", regions: ["virtual"], min_age: 16, max_age: 18 });
  const list = [local("l1"), local("l2"), local("l3"), online("o1"), online("o2")];
  const opts = L.relaxOptions(list, { place: "city:boston", age: "13" }, now);
  const age = opts.find((o) => o.key === "age");
  assert.ok(age, JSON.stringify(opts));
  assert.equal(age.count, 3);
  const two = L.relaxOptions(list.slice(1), { place: "city:boston", age: "13" }, now).find((o) => o.key === "age");
  assert.equal(two.count, 4, "with fewer than 3 local matches, online programs are added");
  const already = L.relaxOptions(list, { place: "city:boston", age: "13", placeOnline: true }, now).find((o) => o.key === "age");
  assert.equal(already.count, 3, "a state that already widened to online is counted unwidened first");
});

test("relaxOptions: equal counts keep the filter order (search word, then season, then kind)", () => {
  const now = new Date(2026, 9, 17).getTime();
  const e = (id, name, season, type) => ({ id, name, season, type, status: "rolling", paid_type: "paid", regions: ["boston"], min_age: 14, max_age: 18 });
  // Each filter, removed alone, leaves exactly one program, so only the filter order can decide.
  const list = [e("a", "Robotics Lab", "fall", "internship"), e("b", "Robotics Team", "summer", "volunteer"), e("c", "Art Studio", "fall", "volunteer")];
  for (const order of [list, list.slice().reverse()]) {
    const opts = L.relaxOptions(order, { q: "robotics", season: "fall", types: ["volunteer"] }, now);
    assert.deepEqual(opts.map((o) => [o.key, o.count]), [["q", 1], ["season", 1], ["types", 1]]);
  }
});

/* ---------- placeRegions ---------- */

test("placeRegions: areas list each region once, and a state never pulls in online or national", () => {
  for (const a of L.AREAS) {
    const rs = L.placeRegions("area:" + a[0]);
    assert.ok(rs && rs.length, a[0]);
    assert.equal(new Set(rs).size, rs.length, a[0] + " repeats a region: " + rs.join(","));
  }
  for (const s of L.STATES) {
    const rs = L.placeRegions("state:" + s[0]) || [];
    assert.ok(!rs.includes("virtual") && !rs.includes("national"), s[0]);
  }
});

/* ---------- insights: the month list on the Numbers page ---------- */

test("insights: programs with the same deadline are listed by id inside their month", () => {
  const now = new Date(2026, 9, 17).getTime();
  const mk = (id, d) => ({ id, name: id.toUpperCase(), status: "open-now", deadline_iso: d, deadline_confidence: "confirmed-2026-27", regions: ["boston"], type: "internship" });
  const out = L.insights([mk("zeta", "2026-11-05"), mk("alpha", "2026-11-05"), mk("mid", "2026-11-02"), mk("beta", "2026-12-01")], now);
  assert.deepEqual(out.months.map((m) => m.label), ["Nov 2026", "Dec 2026"]);
  assert.deepEqual(out.months[0].items.map((i) => i.id), ["mid", "alpha", "zeta"]);
  const again = L.insights([mk("alpha", "2026-11-05"), mk("zeta", "2026-11-05"), mk("mid", "2026-11-02"), mk("beta", "2026-11-05")], now);
  assert.deepEqual(again.months[0].items.map((i) => i.id), ["mid", "alpha", "beta", "zeta"], "the order does not depend on the input order");
});
