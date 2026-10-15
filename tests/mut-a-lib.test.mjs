// 2026-10-15: tests that pin lib.js behavior the 2026-10-14 mutation run showed was untested (insights, gradePhrase, blanksLeft, splitMessage).
// Run with: node --test tests/mut-a-lib.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

/* ---------- splitMessage ---------- */

test("splitMessage: splits Subject line from body at the first blank line", () => {
  assert.deepEqual(L.splitMessage("Subject: Hello there\n\nDear Ms. Lee,\n\nThanks.\nBye"),
    { subject: "Hello there", body: "Dear Ms. Lee,\n\nThanks.\nBye" });
  assert.deepEqual(L.splitMessage("Subject:   padded\n\nx"), { subject: "padded", body: "x" });
  assert.deepEqual(L.splitMessage("Subject: \n\nx"), { subject: "", body: "x" });
});

test("splitMessage: text that does not start with a Subject line is all body", () => {
  assert.deepEqual(L.splitMessage("Hi\n\nSubject: not first\n\nbody"), { subject: "", body: "Hi\n\nSubject: not first\n\nbody" });
  assert.deepEqual(L.splitMessage("Subject: no blank line\nbody"), { subject: "", body: "Subject: no blank line\nbody" });
  assert.deepEqual(L.splitMessage(""), { subject: "", body: "" });
});

/* ---------- gradePhrase ---------- */

test("gradePhrase: numbers 1 to 12 get the right ordinal, in every typed form", () => {
  const want = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th", 7: "7th", 8: "8th", 9: "9th", 10: "10th", 11: "11th", 12: "12th" };
  for (const n of Object.keys(want)) {
    const exp = "in " + want[n] + " grade";
    for (const typed of [n, want[n], want[n] + " grade", n + " grade", "Grade " + n, "grade  " + n, "  " + n + "  ", want[n].toUpperCase()]) {
      assert.equal(L.gradePhrase(typed), exp, JSON.stringify(typed));
    }
  }
});

test("gradePhrase: class names give 'a <class>', any case, with or without 'grade'", () => {
  assert.equal(L.gradePhrase("sophomore"), "a sophomore");
  assert.equal(L.gradePhrase("JUNIOR"), "a junior");
  assert.equal(L.gradePhrase("Freshman"), "a freshman");
  assert.equal(L.gradePhrase("senior grade"), "a senior");
  assert.equal(L.gradePhrase("Senior   grade"), "a senior");
});

test("gradePhrase: blank input falls back to a fill-in placeholder", () => {
  for (const v of ["", "   ", null, undefined]) assert.equal(L.gradePhrase(v), "in [grade]");
});

test("gradePhrase: other text is kept as typed, with ' grade' added only when the word is absent", () => {
  assert.equal(L.gradePhrase("0"), "in 0 grade");
  assert.equal(L.gradePhrase("13"), "in 13 grade");
  assert.equal(L.gradePhrase("pre-k"), "in pre-k grade");
  assert.equal(L.gradePhrase("9th grade honors"), "in 9th grade honors");
  assert.equal(L.gradePhrase("Grade A student"), "in Grade A student");
  assert.equal(L.gradePhrase("10 years"), "in 10 years grade");
  assert.equal(L.gradePhrase("my freshman"), "in my freshman grade");
  assert.equal(L.gradePhrase("freshman year"), "in freshman year grade");
  assert.equal(L.gradePhrase("abc 10"), "in abc 10 grade");
  assert.equal(L.gradePhrase("upgrade 5"), "in upgrade 5 grade");
  assert.equal(L.gradePhrase("1grade 2"), "in 1grade 2 grade");
  assert.equal(L.gradePhrase("10  grade"), "in 10th grade");
});

/* ---------- blanksLeft ---------- */

test("blanksLeft: lists bracketed words and 3+ underscore runs once each, in order of first appearance", () => {
  assert.deepEqual(L.blanksLeft("Hi [Name], I am ___ and [School]. Again [Name] and ___ and ______."),
    ["[Name]", "___", "[School]", "______"]);
});

test("blanksLeft: ignores short underscore runs, multi-line or empty brackets, and non-strings", () => {
  assert.deepEqual(L.blanksLeft("a __ b [] c [two\nlines] d"), []);
  assert.deepEqual(L.blanksLeft("[a [b] c]"), ["[b]"]);
  assert.deepEqual(L.blanksLeft(null), []);
  assert.deepEqual(L.blanksLeft(undefined), []);
  assert.deepEqual(L.blanksLeft(""), []);
  assert.deepEqual(L.blanksLeft("all filled in"), []);
});

/* ---------- insights ---------- */

const NOW = new Date(2026, 9, 15, 12, 0, 0);
function ent(o) { return Object.assign({ name: "N" + o.id, status: "rolling", paid_type: "not-stated", type: "internship" }, o); }
const LIST = [
  ent({ id: "a12", status: "opens-soon", opens_iso: "2026-12-01", deadline_iso: "2027-02-01", paid_type: "unpaid", regions: ["san-francisco"], type: "leadership", fields: ["mystery"] }),
  ent({ id: "a1", status: "open-now", deadline_iso: "2026-11-20", paid_type: "paid", min_age: 14, max_age: 16, regions: ["davis", "sacramento"], season: "summer", fields: ["tech-cs", "any"], verified: "fetched", needs_work_permit: false }),
  ent({ id: "a2", status: "open-now", deadline_iso: "2026-10-01", paid_type: "stipend", min_age: 16, regions: ["san-francisco"], type: "research", fields: ["tech-cs", "science"], verified: "web" }),
  ent({ id: "a3", status: "opens-soon", opens_iso: "2026-10-10", deadline_iso: "2026-11-20", paid_type: "mixed", min_age: 16, regions: ["oakland", "san-francisco"], season: "fall", fields: ["health"] }),
  ent({ id: "a4", status: "rolling", paid_type: "unpaid", max_age: 15, regions: ["statewide"], type: "volunteer", season: "winter", needs_work_permit: true }),
  ent({ id: "a5", status: "event", deadline_iso: "2026-10-05", paid_type: "unpaid-credit", min_age: 13, max_age: 13, regions: [], type: "weird", season: "spring", fields: ["science"] }),
  ent({ id: "a6", status: "event", deadline_iso: "2026-12-03", paid_type: "fee-based", min_age: 17, regions: ["davis"], type: "research", season: "year-round", fields: [] }),
  ent({ id: "a7", status: "closed-expect-reopen", deadline_iso: "2026-11-20", regions: ["san-francisco"], season: "summer", fields: ["health", "tech-cs"], verified: "fetched" }),
  ent({ id: "a8", status: "rolling", deadline_iso: "2027-01-05", paid_type: "paid", min_age: 14, max_age: 18, regions: ["davis"], type: "volunteer", fields: ["tech-cs"] }),
  ent({ id: "a9", status: "year-round", paid_type: "stipend", min_age: 14, season: "summer", fields: ["science"] }),
  ent({ id: "z10", status: "open-now", deadline_iso: "2026-11-05", paid_type: "paid", regions: ["atlanta"], season: "summer", fields: ["engineering"] }),
  ent({ id: "a0", status: "open-now", deadline_iso: "2026-11-20", paid_type: "unpaid", regions: ["chicago"], season: "school-year" }),
  ent({ id: "a11", status: "unconfirmed", deadline_iso: "2026-11-20", paid_type: "mixed", type: "research" })
];
const D = L.insights(LIST, NOW);

test("insights: total and the shape of every section", () => {
  assert.equal(D.total, 13);
  assert.deepEqual(Object.keys(D).sort(), ["ages", "facts", "fields", "hubs", "months", "seasons", "status", "total", "types"]);
});

test("insights: status groups use the effective status (stale data is corrected), in fixed order with labels", () => {
  assert.deepEqual(D.status, [
    { id: "open", label: "Open now", n: 4 },
    { id: "soon", label: "Opens soon", n: 1 },
    { id: "anytime", label: "Apply any time", n: 4 },
    { id: "closed", label: "Closed, back next cycle", n: 2 },
    { id: "unknown", label: "Dates not posted", n: 1 },
    { id: "passed", label: "Event passed", n: 1 }
  ]);
});

test("insights: ages 13 to 18 count programs a teen of that age can join, and how many of those pay", () => {
  assert.deepEqual(D.ages, [
    { age: 13, n: 7, paid: 2 },
    { age: 14, n: 9, paid: 5 },
    { age: 15, n: 9, paid: 5 },
    { age: 16, n: 10, paid: 7 },
    { age: 17, n: 10, paid: 6 },
    { age: 18, n: 10, paid: 6 }
  ]);
});

test("insights: hubs list only non-empty hubs, in hub order, with pay-group counts", () => {
  assert.deepEqual(D.hubs, [
    { id: "davis", label: "Davis and Sacramento", n: 3, pay: 2, free: 0, fee: 1, unknown: 0 },
    { id: "oak", label: "Oakland and East Bay", n: 1, pay: 1, free: 0, fee: 0, unknown: 0 },
    { id: "sf", label: "San Francisco", n: 4, pay: 2, free: 1, fee: 0, unknown: 1 },
    { id: "state", label: "California-wide", n: 1, pay: 0, free: 1, fee: 0, unknown: 0 },
    { id: "atl", label: "Atlanta and Georgia", n: 1, pay: 1, free: 0, fee: 0, unknown: 0 },
    { id: "chi", label: "Chicago and Illinois", n: 1, pay: 0, free: 1, fee: 0, unknown: 0 }
  ]);
});

test("insights: months group upcoming deadlines, sorted by month then date then id, with year-aware labels", () => {
  assert.deepEqual(D.months, [
    { key: 202610, label: "Nov 2026", n: 4, items: [
      { name: "Nz10", id: "z10", date: "2026-11-05" },
      { name: "Na0", id: "a0", date: "2026-11-20" },
      { name: "Na1", id: "a1", date: "2026-11-20" },
      { name: "Na3", id: "a3", date: "2026-11-20" }] },
    { key: 202611, label: "Dec 2026", n: 1, items: [{ name: "Na6", id: "a6", date: "2026-12-03" }] },
    { key: 202700, label: "Jan 2027", n: 1, items: [{ name: "Na8", id: "a8", date: "2027-01-05" }] },
    { key: 202701, label: "Feb 2027", n: 1, items: [{ name: "Na12", id: "a12", date: "2027-02-01" }] }
  ]);
});

test("insights: month items sort fully by date, then id, whatever order they arrive in", () => {
  const mk = (id, d) => ent({ id, status: "open-now", deadline_iso: d });
  const ids = [["b", "2026-11-09"], ["c", "2026-11-02"], ["a", "2026-11-09"], ["d", "2026-11-30"], ["e", "2026-11-02"], ["f", "2026-11-15"], ["g", "2026-11-09"]];
  for (const order of [ids, ids.slice().reverse(), ids.slice().sort((x, y) => (x[0] < y[0] ? 1 : -1))]) {
    const r = L.insights(order.map((x) => mk(x[0], x[1])), NOW);
    assert.deepEqual(r.months[0].items.map((i) => i.id + "@" + i.date.slice(8)),
      ["c@02", "e@02", "a@09", "b@09", "g@09", "f@15", "d@30"]);
  }
});

test("insights: months are in calendar order across a year boundary", () => {
  const r = L.insights([ent({ id: "x", deadline_iso: "2027-01-02" }), ent({ id: "y", deadline_iso: "2026-12-30" }),
    ent({ id: "w", deadline_iso: "2026-10-15" })], NOW);
  assert.deepEqual(r.months.map((m) => m.label), ["Oct 2026", "Dec 2026", "Jan 2027"]);
  assert.deepEqual(r.months.map((m) => m.key), [202609, 202611, 202700]);
});

test("insights: seasons list all six in fixed order; missing season counts as year-round", () => {
  assert.deepEqual(D.seasons, [
    { id: "summer", label: "Summer", n: 4 },
    { id: "school-year", label: "School year", n: 1 },
    { id: "fall", label: "Fall", n: 1 },
    { id: "winter", label: "Winter", n: 1 },
    { id: "spring", label: "Spring", n: 1 },
    { id: "year-round", label: "Year-round", n: 5 }
  ]);
});

test("insights: types are labeled, unknown types keep their id, sorted by count high to low (ties keep first-seen order)", () => {
  assert.deepEqual(D.types, [
    { id: "internship", label: "Internship", n: 6 },
    { id: "research", label: "Research", n: 3 },
    { id: "volunteer", label: "Volunteer", n: 2 },
    { id: "leadership", label: "Leadership", n: 1 },
    { id: "weird", label: "weird", n: 1 }
  ]);
});

test("insights: fields skip 'any' and missing fields, are labeled, and sort by count high to low", () => {
  assert.deepEqual(D.fields, [
    { id: "tech-cs", label: "Tech and coding", n: 4 },
    { id: "science", label: "Science", n: 3 },
    { id: "health", label: "Health", n: 2 },
    { id: "mystery", label: "mystery", n: 1 },
    { id: "engineering", label: "Engineering", n: 1 }
  ]);
});

test("insights: facts count fetched, no-permit (only explicit false), paid at 14 (not mixed), free and cost", () => {
  assert.deepEqual(D.facts, { fetched: 2, noPermit: 1, paid14: 4, free: 4, cost: 1, jump16: 11, paidJump: 40 });
});

test("insights: an empty list gives zeros everywhere", () => {
  const e = L.insights([], NOW);
  assert.equal(e.total, 0);
  assert.deepEqual(e.facts, { fetched: 0, noPermit: 0, paid14: 0, free: 0, cost: 0, jump16: 0, paidJump: 0 });
  assert.deepEqual(e.seasons.map((s) => s.n), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(e.status.map((s) => s.n), [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(e.ages.map((a) => [a.n, a.paid]), [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]);
  assert.deepEqual([e.hubs, e.months, e.types, e.fields], [[], [], [], []]);
});

test("insights: jump figures are rounded percentages, negative when the count falls, and 0 (not Infinity) when the base is 0", () => {
  const p = (id, o) => ent(Object.assign({ id, paid_type: "paid" }, o));
  const only16 = L.insights([p("a", { min_age: 16 }), p("b", { min_age: 16 })], NOW);
  assert.equal(only16.facts.jump16, 0);
  assert.equal(only16.facts.paidJump, 0);
  // 3 programs at 15, 5 at 16: 66.7 rounds to 67. Paid at 14: 3, paid at 16: 5: also 67.
  const up = L.insights([p("a", {}), p("b", {}), p("c", {}), p("d", { min_age: 16 }), p("e", { min_age: 16 })], NOW);
  assert.equal(up.facts.jump16, 67);
  assert.equal(up.facts.paidJump, 67);
  // 2 programs end at 15, 1 starts at 16: 2 at 15, 1 at 16 is -50
  const down = L.insights([p("a", { max_age: 15 }), p("b", { max_age: 15 }), p("c", { min_age: 16 })], NOW);
  assert.equal(down.facts.jump16, -50);
  assert.equal(down.facts.paidJump, -50);
});
