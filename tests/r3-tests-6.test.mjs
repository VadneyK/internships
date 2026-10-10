// Edge cases and property loops for the message, plan and place helpers in assets/js/lib.js.
// Run with: node --test tests/r3-tests-6.test.mjs
// Every random input comes from a seeded generator, so a failure is the same on every run.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
globalThis.self = globalThis;
const L = createRequire(import.meta.url)("../assets/js/lib.js");

/* mulberry32: a small seeded PRNG. Same seed, same sequence. */
function prng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

const NOW = new Date(2026, 9, 7, 12).getTime(); // Oct 7, 2026, noon local

/* ---------- splitMessage ---------- */

test("splitMessage: LF subject and body split at the blank line", () => {
  assert.deepEqual(L.splitMessage("Subject: Hello there\n\nDear Sam,\nThanks."), { subject: "Hello there", body: "Dear Sam,\nThanks." });
});

test("splitMessage: no space after the colon still gives the subject", () => {
  assert.deepEqual(L.splitMessage("Subject:Hi\n\nBody"), { subject: "Hi", body: "Body" });
});

test("splitMessage: a multi-paragraph body keeps every paragraph", () => {
  assert.deepEqual(L.splitMessage("Subject: S\n\nP1\n\nP2\n\nP3"), { subject: "S", body: "P1\n\nP2\n\nP3" });
});

test("splitMessage: empty subject line gives an empty subject and the body", () => {
  assert.deepEqual(L.splitMessage("Subject: \n\nBody"), { subject: "", body: "Body" });
  assert.deepEqual(L.splitMessage("Subject:\n\nBody"), { subject: "", body: "Body" });
});

test("splitMessage: empty body keeps the subject and gives an empty body", () => {
  assert.deepEqual(L.splitMessage("Subject: Hi\n\n"), { subject: "Hi", body: "" });
});

test("splitMessage: empty string gives empty subject and body", () => {
  assert.deepEqual(L.splitMessage(""), { subject: "", body: "" });
});

test("splitMessage: no Subject line returns the whole text as the body", () => {
  assert.deepEqual(L.splitMessage("Just a note"), { subject: "", body: "Just a note" });
  // The match is case sensitive, so a lowercase label is not a subject.
  assert.deepEqual(L.splitMessage("subject: Hi\n\nBody"), { subject: "", body: "subject: Hi\n\nBody" });
});

test("splitMessage: CRLF input is pinned to the current result (whole text as body)", () => {
  // Known limit: the pattern expects LF line ends, and "." does not cross the carriage return.
  // This pins today's behavior. If CRLF support is added, change this test on purpose.
  assert.deepEqual(L.splitMessage("Subject: Hi\r\n\r\nBody"), { subject: "", body: "Subject: Hi\r\n\r\nBody" });
});

test("splitMessage: null and undefined do not throw", () => {
  assert.deepEqual(L.splitMessage(null), { subject: "", body: null });
  const u = L.splitMessage(undefined);
  assert.equal(u.subject, "");
  assert.equal(u.body, undefined);
});

test("splitMessage: seeded subjects and bodies round trip (LF only)", () => {
  const r = prng(6001);
  const subjectPieces = ["a", "B", "7", " ", "&", "#", "%", "+", "\"", "'", "\u00e9", "\u4e2d", "\ud83d\ude00", ":", "\\", "\t"];
  const bodyPieces = subjectPieces.concat(["\n", "\n\n"]);
  const make = (pieces, max) => {
    let s = "";
    const n = Math.floor(r() * max);
    for (let i = 0; i < n; i++) s += pick(r, pieces);
    return s;
  };
  for (let i = 0; i < 200; i++) {
    // The subject starts with a non-space character and has no line break, so it is kept exactly.
    let subject = make(subjectPieces, 12);
    subject = subject.replace(/^\s+/, "x").replace(/\s*$/, "y");
    const body = make(bodyPieces, 40);
    const got = L.splitMessage("Subject: " + subject + "\n\n" + body);
    assert.equal(got.subject, subject, "subject case " + i);
    assert.equal(got.body, body, "body case " + i);
  }
});

/* ---------- mailtoHref and smsHref ---------- */

const MAIL_FIXED = ["", "100% & more #1 + \"quoted\" 'single'\nline2", "\u4e2d\u6587 \ud83d\ude00 caf\u00e9", "a=b&c=d?e/f\\g;h,i:j"];
const PIECES = ["a", "Q", "7", " ", "\n", "\r\n", "\t", "&", "#", "%", "+", "\"", "'", "=", "?", "/", "\\", ";", ",", ":",
  "\u00e9", "\u00df", "\u4e2d", "\ud83d\ude00", "%20", "&body=", "Subject:", "\u00a0", "\u2028", "&amp;", "+1 555"];
function randText(r, max) {
  let s = "";
  const n = Math.floor(r() * max);
  for (let i = 0; i < n; i++) s += pick(r, PIECES);
  return s;
}

test("mailtoHref: fixed unicode, &, #, %, +, newline and quote cases decode back exactly", () => {
  for (const subject of MAIL_FIXED) {
    for (const body of MAIL_FIXED) {
      const href = L.mailtoHref(subject, body);
      assert.ok(href.startsWith("mailto:?subject="), "prefix");
      assert.equal(href.split("?").length, 2, "one question mark");
      assert.ok(!/[\s"#]/.test(href), "no raw space, quote, newline or hash");
      const rest = href.slice("mailto:?".length);
      const parts = rest.split("&");
      assert.equal(parts.length, 2, "exactly one ampersand separator");
      assert.ok(parts[0].startsWith("subject=") && parts[1].startsWith("body="));
      assert.equal(decodeURIComponent(parts[0].slice("subject=".length)), subject);
      assert.equal(decodeURIComponent(parts[1].slice("body=".length)), body);
    }
  }
});

test("mailtoHref: 200 seeded strings decode back to the exact input", () => {
  const r = prng(6002);
  for (let i = 0; i < 200; i++) {
    const subject = randText(r, 14);
    const body = randText(r, 50);
    const href = L.mailtoHref(subject, body);
    const [sp, bp] = href.slice("mailto:?".length).split("&");
    assert.equal(decodeURIComponent(sp.slice("subject=".length)), subject, "subject case " + i);
    assert.equal(decodeURIComponent(bp.slice("body=".length)), body, "body case " + i);
  }
});

test("smsHref: fixed and seeded strings decode back to the exact input", () => {
  const r = prng(6003);
  const bodies = MAIL_FIXED.concat(["", "+", "&&", "%%", "##"]);
  for (let i = 0; i < 200; i++) bodies.push(randText(r, 50));
  bodies.forEach((body, i) => {
    const href = L.smsHref(body);
    assert.ok(href.startsWith("sms:?&body="), "prefix " + i);
    assert.ok(!/[\s"#]/.test(href), "no raw space, quote, newline or hash " + i);
    assert.equal(decodeURIComponent(href.slice("sms:?&body=".length)), body, "case " + i);
  });
});

test("mailtoHref and smsHref: empty input gives empty fields, no throw", () => {
  assert.equal(L.mailtoHref("", ""), "mailto:?subject=&body=");
  assert.equal(L.smsHref(""), "sms:?&body=");
});

/* ---------- planSummary ---------- */

test("planSummary: empty list gives zeros and no next", () => {
  assert.deepEqual(L.planSummary([], NOW), { named: 0, sent: 0, next: null });
});

test("planSummary: null entries, blank names and missing names are not counted", () => {
  const people = [
    null,
    undefined,
    { n: "   ", s: "sent", d: "2026-10-01" },
    { n: "", s: "sent", d: "2026-10-01" },
    { n: null, s: "sent", d: "2026-10-01" },
    { s: "sent", d: "2026-10-01" }
  ];
  assert.deepEqual(L.planSummary(people, NOW), { named: 0, sent: 0, next: null });
});

test("planSummary: a name is trimmed in next", () => {
  const got = L.planSummary([{ n: "  Ana  ", s: "sent", d: "2026-10-01" }], NOW);
  assert.equal(got.next.name, "Ana");
});

test("planSummary: two people with the same follow-up date, the first in the list wins", () => {
  const ana = { n: "Ana", s: "sent", d: "2026-10-01" };
  const ben = { n: "Ben", s: "sent", d: "2026-10-01" };
  assert.equal(L.planSummary([ana, ben], NOW).next.name, "Ana");
  assert.equal(L.planSummary([ben, ana], NOW).next.name, "Ben");
  assert.equal(L.planSummary([ana, ben], NOW).next.date, "2026-10-08");
});

test("planSummary: due is true on the follow-up day and false the day before", () => {
  const person = [{ n: "Ana", s: "sent", d: "2026-10-01" }];
  const dayBefore = new Date(2026, 9, 7, 23, 59).getTime();
  const onDay = new Date(2026, 9, 8, 0, 1).getTime();
  assert.equal(L.planSummary(person, dayBefore).next.due, false);
  assert.equal(L.planSummary(person, onDay).next.due, true);
  assert.equal(L.planSummary(person, onDay).next.date, "2026-10-08");
});

test("planSummary: a bad send date gives no next, but a sent status still counts", () => {
  for (const d of ["2026-02-30", "not a date", "", null, undefined, "2026-1-5"]) {
    const got = L.planSummary([{ n: "Ana", s: "sent", d }], NOW);
    assert.equal(got.next, null, "date " + JSON.stringify(d));
    assert.equal(got.sent, 1, "sent count for " + JSON.stringify(d));
    assert.equal(got.named, 1);
  }
});

test("planSummary: only a sent person with a send date has a follow-up", () => {
  const got = L.planSummary([
    { n: "Ana", s: "", d: "2026-10-01" },
    { n: "Ben", s: "replied", d: "2026-10-01" },
    { n: "Cy", s: "sent" }
  ], NOW);
  assert.equal(got.next, null);
  assert.equal(got.named, 3);
  assert.equal(got.sent, 2, "any status set counts as sent (pinned: replied counts)");
});

test("planSummary: the soonest follow-up wins across the list", () => {
  const got = L.planSummary([
    { n: "Late", s: "sent", d: "2026-10-05" },
    { n: "Early", s: "sent", d: "2026-09-30" }
  ], NOW);
  assert.equal(got.next.name, "Early");
  assert.equal(got.next.date, "2026-10-07");
  assert.equal(got.next.due, true);
});

/* ---------- ageText ---------- */

function expectAge(min, max, grades) {
  const bits = [];
  if (min != null && max != null) bits.push("Ages " + min + " to " + max);
  else if (min != null) bits.push("Ages " + min + "+");
  else if (max != null) bits.push("Up to age " + max);
  if (grades) bits.push("Grades " + grades);
  return bits.length ? bits.join(" \u00B7 ") : "All high school ages";
}

test("ageText: explicit pins including 0 and equal limits", () => {
  assert.equal(L.ageText({ min_age: null, max_age: null, grades: null }), "All high school ages");
  assert.equal(L.ageText({}), "All high school ages");
  assert.equal(L.ageText({ min_age: 13, max_age: 16 }), "Ages 13 to 16");
  assert.equal(L.ageText({ min_age: 16, max_age: 16 }), "Ages 16 to 16");
  assert.equal(L.ageText({ min_age: 0, max_age: 0 }), "Ages 0 to 0");
  assert.equal(L.ageText({ min_age: 0 }), "Ages 0+", "pinned: a zero minimum still shows");
  assert.equal(L.ageText({ min_age: 0, max_age: null }), "Ages 0+");
  assert.equal(L.ageText({ min_age: null, max_age: 0 }), "Up to age 0");
  assert.equal(L.ageText({ min_age: null, max_age: 18 }), "Up to age 18");
  assert.equal(L.ageText({ min_age: 14 }), "Ages 14+");
  assert.equal(L.ageText({ grades: "10" }), "Grades 10");
  assert.equal(L.ageText({ grades: "" }), "All high school ages", "empty grades adds nothing");
  assert.equal(L.ageText({ min_age: 13, max_age: 18, grades: "9 to 12" }), "Ages 13 to 18 \u00B7 Grades 9 to 12");
});

test("ageText: every min, max and grades combination matches the rule", () => {
  const mins = [undefined, null, 0, 13, 16];
  const maxs = [undefined, null, 0, 13, 16, 18];
  const grades = [undefined, null, "", "10", "9 to 12"];
  let n = 0;
  for (const min_age of mins) for (const max_age of maxs) for (const g of grades) {
    const got = L.ageText({ min_age, max_age, grades: g });
    assert.equal(got, expectAge(min_age, max_age, g), JSON.stringify({ min_age, max_age, grades: g }));
    assert.ok(!/undefined|null|NaN/.test(got), "no stray words: " + got);
    n++;
  }
  assert.equal(n, 5 * 6 * 5);
});

test("ageText: seeded random limits never leak undefined, null or NaN", () => {
  const r = prng(6004);
  const vals = [null, undefined, 0, 1, 13, 16, 18, 99];
  for (let i = 0; i < 200; i++) {
    const e = { min_age: pick(r, vals), max_age: pick(r, vals), grades: pick(r, [null, "", "K-12", "11"]) };
    const got = L.ageText(e);
    assert.ok(typeof got === "string" && got.length > 0, "non-empty string case " + i);
    assert.ok(!/undefined|null|NaN/.test(got), "stray word in " + got);
  }
});

/* ---------- placeLabel and hubsOfPlace ---------- */

test("placeLabel and hubsOfPlace: every CITIES and AREAS id has a label and at least one hub", () => {
  for (const c of L.CITIES) {
    assert.ok(L.placeLabel("city:" + c[0]).length > 0, "label for city:" + c[0]);
    assert.ok(L.hubsOfPlace("city:" + c[0]).length >= 1, "hub for city:" + c[0]);
  }
  for (const a of L.AREAS) {
    assert.ok(L.placeLabel("area:" + a[0]).length > 0, "label for area:" + a[0]);
    assert.ok(L.hubsOfPlace("area:" + a[0]).length >= 1, "hub for area:" + a[0]);
  }
});

test("placeLabel: pinned labels for a known city and area", () => {
  assert.equal(L.placeLabel("city:boston"), "Boston");
  assert.equal(L.placeLabel("area:midwest"), "Midwest");
});

test("placeLabel and hubsOfPlace: unknown ids return empty", () => {
  for (const p of ["city:nowhere", "area:nowhere", "area:boston", "city:midwest"]) {
    assert.equal(L.placeLabel(p), "", "label " + p);
    assert.deepEqual(L.hubsOfPlace(p), [], "hubs " + p);
  }
});

test("placeLabel and hubsOfPlace: malformed ids return empty and do not throw", () => {
  const bad = ["", null, undefined, "boston", "city:", "city", "state:ca", "City:boston", " city:boston", "city:boston\n", "area:", ":boston"];
  for (const p of bad) {
    assert.equal(L.placeLabel(p), "", "label for " + JSON.stringify(p));
    assert.deepEqual(L.hubsOfPlace(p), [], "hubs for " + JSON.stringify(p));
  }
});

test("hubsOfPlace: pinned hub order for a city and an area", () => {
  assert.deepEqual(L.hubsOfPlace("city:davis"), ["davis", "state"]);
  assert.deepEqual(L.hubsOfPlace("city:boston"), ["east"]);
});

/* ---------- isOpenish and isAnytime truth table ---------- */

const PAST = "2026-10-01";
const FUTURE = "2026-12-01";
const OPENS_LATER = "2026-11-16";
const OPENS_TODAY = "2026-10-07";

test("isOpenish and isAnytime: truth table over all 7 statuses, with and without dates", () => {
  // [status, extra fields, isOpenish, isAnytime]
  const rows = [
    ["open-now", {}, true, false],
    ["open-now", { deadline_iso: FUTURE }, true, false],
    ["open-now", { deadline_iso: PAST }, false, false],
    ["opens-soon", {}, true, false],
    ["opens-soon", { opens_iso: OPENS_LATER }, true, false],
    ["opens-soon", { opens_iso: OPENS_TODAY }, true, false],
    ["opens-soon", { opens_iso: OPENS_LATER, deadline_iso: PAST }, false, false],
    ["opens-soon", { opens_iso: "2026-02-30" }, true, false],
    ["rolling", {}, false, true],
    ["rolling", { deadline_iso: PAST }, false, true],
    ["year-round", {}, false, true],
    ["event", { deadline_iso: FUTURE }, false, true],
    ["event", { deadline_iso: PAST }, false, true],
    ["closed-expect-reopen", {}, false, false],
    ["closed-expect-reopen", { deadline_iso: FUTURE }, false, false],
    ["unconfirmed", {}, false, false],
    ["unconfirmed", { deadline_iso: FUTURE, deadline_confidence: "confirmed-2026-27" }, false, false],
    ["not-a-status", {}, false, false],
    [undefined, {}, false, false]
  ];
  rows.forEach(([status, extra, openish, anytime]) => {
    const e = Object.assign({ id: "t", name: "T", status }, extra);
    const label = JSON.stringify(status) + " " + JSON.stringify(extra);
    assert.equal(L.isOpenish(e, NOW), openish, "isOpenish " + label);
    assert.equal(L.isAnytime(e, NOW), anytime, "isAnytime " + label);
    assert.ok(!(openish && anytime), "a status is never both: " + label);
  });
});

test("isOpenish and isAnytime: an opening date that has arrived flips opens-soon to open", () => {
  const e = { status: "opens-soon", opens_iso: OPENS_TODAY };
  assert.equal(L.effStatus(e, NOW), "open-now");
  assert.equal(L.isOpenish(e, NOW), true);
});

/* ---------- insights ---------- */

const STATUSES7 = ["open-now", "opens-soon", "rolling", "year-round", "event", "closed-expect-reopen", "unconfirmed"];
const SEASONS6 = ["summer", "school-year", "fall", "winter", "spring", "year-round"];
const PAID6 = ["paid", "stipend", "mixed", "unpaid", "unpaid-credit", "fee-based", "not-stated"];
const TYPE_IDS = Object.keys(L.TYPES);
const FIELD_IDS = Object.keys(L.FIELDS);
const REGION_IDS = L.REGIONS.map((r) => r[0]);

function assertFinite(v, path) {
  if (typeof v === "number") assert.ok(Number.isFinite(v), "not finite at " + path + ": " + v);
  else if (v && typeof v === "object") for (const k of Object.keys(v)) assertFinite(v[k], path + "." + k);
}

const base = {
  id: "x", name: "Example", org: "Org", regions: ["oakland"], city: "Oakland, CA", type: "paid-youth-program",
  fields: ["health"], what_you_do: "Do things.", min_age: 16, max_age: 19, grades: null, paid_type: "paid", season: "summer",
  status: "open-now", deadline_iso: "2027-01-08", verified: "fetched", priority: 1, needs_work_permit: true
};

test("insights([]): every count is zero, no NaN, and the shape is complete", () => {
  const out = L.insights([], NOW);
  assert.equal(out.total, 0);
  assert.deepEqual(out.status.map((g) => g.id), ["open", "soon", "anytime", "closed", "unknown"]);
  assert.ok(out.status.every((g) => g.n === 0));
  assert.equal(out.ages.length, 6);
  assert.deepEqual(out.ages.map((a) => a.age), [13, 14, 15, 16, 17, 18]);
  assert.ok(out.ages.every((a) => a.n === 0 && a.paid === 0));
  assert.deepEqual(out.hubs, []);
  assert.deepEqual(out.months, []);
  assert.deepEqual(out.types, []);
  assert.deepEqual(out.fields, []);
  assert.equal(out.seasons.length, 6);
  assert.ok(out.seasons.every((s) => s.n === 0));
  assert.deepEqual(out.facts, { fetched: 0, noPermit: 0, paid14: 0, free: 0, cost: 0, jump16: 0, paidJump: 0 });
  assertFinite(out, "out");
});

test("insights(single card): pinned counts and every group sums to the total", () => {
  const out = L.insights([base], NOW);
  assert.equal(out.total, 1);
  assert.deepEqual(out.status.map((g) => g.n), [1, 0, 0, 0, 0]);
  assert.deepEqual(out.ages.map((a) => a.n), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(out.ages.map((a) => a.paid), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(out.hubs, [{ id: "oak", label: "Oakland and East Bay", n: 1, pay: 1, free: 0, fee: 0, unknown: 0 }]);
  assert.deepEqual(out.months.map((m) => [m.label, m.n]), [["Jan 2027", 1]]);
  assert.deepEqual(out.types, [{ id: "paid-youth-program", label: "Paid youth program", n: 1 }]);
  assert.deepEqual(out.fields, [{ id: "health", label: "Health", n: 1 }]);
  assert.equal(out.seasons.find((s) => s.id === "summer").n, 1);
  assert.equal(out.seasons.reduce((a, s) => a + s.n, 0), 1);
  assert.deepEqual(out.facts, { fetched: 1, noPermit: 0, paid14: 0, free: 0, cost: 0, jump16: 0, paidJump: 0 });
  assertFinite(out, "single");
});

test("insights: an odd card (no status, no type, null lists) does not throw or produce NaN", () => {
  const odd = { id: "odd", name: "Odd", regions: null, fields: null, type: "unknown-type", paid_type: null, status: "not-a-status" };
  const out = L.insights([odd], NOW);
  assert.equal(out.total, 1);
  assert.equal(out.status.reduce((a, g) => a + g.n, 0), 0, "an unknown status is in no status group");
  assert.deepEqual(out.hubs, []);
  assert.equal(out.types[0].label, "unknown-type", "unknown type id falls back to its own id");
  assertFinite(out, "odd");
});

test("insights: 200 seeded lists keep every group summing to the total, with no NaN", () => {
  const r = prng(6005);
  for (let run = 0; run < 200; run++) {
    const size = Math.floor(r() * 25);
    const list = [];
    for (let i = 0; i < size; i++) {
      list.push({
        id: "c" + run + "-" + i,
        name: "Card " + i,
        regions: [pick(r, REGION_IDS)],
        type: pick(r, TYPE_IDS),
        fields: [pick(r, FIELD_IDS)],
        status: pick(r, STATUSES7),
        season: pick(r, SEASONS6),
        paid_type: pick(r, PAID6),
        min_age: pick(r, [null, 13, 14, 15, 16, 17, 18]),
        max_age: pick(r, [null, 14, 16, 18]),
        deadline_iso: pick(r, [null, PAST, OPENS_TODAY, "2027-01-08", "2027-06-01"]),
        opens_iso: pick(r, [null, OPENS_TODAY, OPENS_LATER]),
        verified: pick(r, ["fetched", "snippet-only"]),
        needs_work_permit: pick(r, [true, false])
      });
    }
    const out = L.insights(list, NOW);
    const tag = "run " + run;
    assert.equal(out.total, size, tag);
    assert.equal(out.status.reduce((a, g) => a + g.n, 0), size, "status sums, " + tag);
    assert.equal(out.seasons.reduce((a, s) => a + s.n, 0), size, "seasons sum, " + tag);
    assert.equal(out.types.reduce((a, t) => a + t.n, 0), size, "types sum, " + tag);
    out.ages.forEach((a) => {
      assert.ok(a.n <= size && a.paid <= a.n, "ages bounded, " + tag);
    });
    out.hubs.forEach((h) => {
      assert.equal(h.pay + h.free + h.fee + h.unknown, h.n, "paid groups cover every hub row, " + tag);
      assert.ok(h.n >= 1 && h.n <= size, tag);
    });
    assert.ok(out.facts.fetched <= size && out.facts.noPermit <= size, tag);
    assertFinite(out, tag);
  }
});
