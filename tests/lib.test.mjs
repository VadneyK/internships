// Run with: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");

const NOW = new Date(2026, 9, 7).getTime(); // Oct 7, 2026
const base = {
  id: "x", name: "Example Program", org: "Org", regions: ["oakland"], city: "Oakland, CA", type: "paid-youth-program",
  fields: ["health"], what_you_do: "Do things.", min_age: 16, max_age: 19, grades: null, paid_type: "paid", season: "summer",
  status: "open-now", deadline_iso: "2027-01-08", verified: "fetched", priority: 1, needs_work_permit: true
};

test("effStatus: a passed deadline turns Open now into Closed", () => {
  assert.equal(L.effStatus({ ...base, deadline_iso: "2026-10-01" }, NOW), "closed-expect-reopen");
  assert.equal(L.effStatus(base, NOW), "open-now");
});
test("effStatus: opens-soon flips to open-now on the opening date", () => {
  const e = { ...base, status: "opens-soon", opens_iso: "2026-11-16" };
  assert.equal(L.effStatus(e, NOW), "opens-soon");
  assert.equal(L.effStatus(e, new Date(2026, 10, 16).getTime()), "open-now");
  assert.equal(L.effStatus(e, new Date(2027, 0, 9).getTime()), "closed-expect-reopen");
});
test("rolling programs never expire", () => {
  assert.equal(L.effStatus({ ...base, status: "rolling", deadline_iso: null }, NOW), "rolling");
});
test("hubsOf groups regions", () => {
  assert.deepEqual(L.hubsOf({ regions: ["berkeley"] }), ["oak"]);
  assert.deepEqual(L.hubsOf({ regions: ["san-jose", "statewide"] }).sort(), ["state", "sv"]);
});
test("age filter respects min and max", () => {
  assert.equal(L.ageOk(base, 15), false);
  assert.equal(L.ageOk(base, 16), true);
  assert.equal(L.ageOk(base, 20), false);
  assert.equal(L.ageOk({ ...base, min_age: null, max_age: null }, 13), true);
});
test("matches: text search needs every word", () => {
  assert.equal(L.matches(base, { q: "example oakland" }, NOW), true);
  assert.equal(L.matches(base, { q: "example sacramento" }, NOW), false);
});
test("matches: pay groups", () => {
  assert.equal(L.matches(base, { paid: ["pay"] }, NOW), true);
  assert.equal(L.matches(base, { paid: ["free"] }, NOW), false);
  assert.equal(L.matches({ ...base, paid_type: "fee-based" }, { paid: ["fee"] }, NOW), true);
});
test("matches: verified-only and no-permit toggles", () => {
  assert.equal(L.matches({ ...base, verified: "snippet-only" }, { verified: true }, NOW), false);
  assert.equal(L.matches(base, { noPermit: true }, NOW), false);
});
test("matches: timing filters", () => {
  assert.equal(L.matches(base, { when: "open" }, NOW), true);
  assert.equal(L.matches({ ...base, deadline_iso: "2026-11-01" }, { when: "60" }, NOW), true);
  assert.equal(L.matches(base, { when: "60" }, NOW), false);
  assert.equal(L.matches({ ...base, status: "rolling" }, { when: "anytime" }, NOW), true);
});
test("sortList best: soonest open deadline first, closed last", () => {
  const a = { ...base, id: "a", name: "A", deadline_iso: "2027-02-01" };
  const b = { ...base, id: "b", name: "B", deadline_iso: "2026-11-01" };
  const c = { ...base, id: "c", name: "C", status: "closed-expect-reopen", deadline_iso: null };
  const d = { ...base, id: "d", name: "D", status: "rolling", deadline_iso: null };
  assert.deepEqual(L.sortList([c, a, d, b], "best", NOW).map((e) => e.id), ["b", "a", "d", "c"]);
});
test("esc escapes html and safeUrl blocks non-http", () => {
  assert.equal(L.esc('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  assert.equal(L.safeUrl("javascript:alert(1)"), "");
  assert.equal(L.safeUrl("https://example.org"), "https://example.org");
});
test("ageText", () => {
  assert.equal(L.ageText({ min_age: 16, max_age: 19 }), "Ages 16 to 19");
  assert.equal(L.ageText({ min_age: 14, max_age: null }), "Ages 14+");
  assert.equal(L.ageText({ min_age: null, max_age: null, grades: null }), "All high school ages");
});

test("followUpISO: one week after the send date, only when status is sent", () => {
  assert.equal(L.followUpISO({ s: "sent", d: "2026-10-07" }), "2026-10-14");
  assert.equal(L.followUpISO({ s: "sent", d: "2026-12-28" }), "2027-01-04");
  assert.equal(L.followUpISO({ s: "replied", d: "2026-10-07" }), "");
  assert.equal(L.followUpISO({ s: "sent" }), "");
});
test("planSummary counts sent messages and finds the next follow-up", () => {
  const people = [{ n: "Mrs. Lee", s: "sent", d: "2026-10-07" }, { n: "Mr. Chen", s: "sent", d: "2026-10-01" }, { n: "Coach" }, {}];
  const sum = L.planSummary(people, NOW);
  assert.equal(sum.named, 3);
  assert.equal(sum.sent, 2);
  assert.deepEqual(sum.next, { name: "Mr. Chen", date: "2026-10-08", due: false });
  assert.equal(L.planSummary(people, new Date(2026, 9, 9).getTime()).next.due, true);
  assert.equal(L.planSummary([{}, {}], NOW).next, null);
});
test("icsEvent makes an all-day event with escaped text", () => {
  const ics = L.icsEvent({ uid: "u1", title: "Follow up, Mrs. Lee", desc: "Line one\nLine; two", dateISO: "2026-10-14", stamp: new Date(Date.UTC(2026, 9, 7, 12, 0, 0)) });
  assert.match(ics, /DTSTART;VALUE=DATE:20261014/);
  assert.match(ics, /DTEND;VALUE=DATE:20261015/);
  assert.match(ics, /SUMMARY:Follow up\\, Mrs. Lee/);
  assert.ok(ics.includes("DESCRIPTION:Line one\\nLine\\; two"));
  assert.match(ics, /DTSTAMP:20261007T120000Z/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});
test("mailto and sms links are encoded; splitMessage separates the subject", () => {
  assert.equal(L.mailtoHref("Hi & bye", "a b\nc"), "mailto:?subject=Hi%20%26%20bye&body=a%20b%0Ac");
  assert.equal(L.smsHref("Hi there?"), "sms:?&body=Hi%20there%3F");
  assert.deepEqual(L.splitMessage("Subject: Quick question\n\nHi Mrs. Lee"), { subject: "Quick question", body: "Hi Mrs. Lee" });
  assert.deepEqual(L.splitMessage("Hi, this is Sam."), { subject: "", body: "Hi, this is Sam." });
});

test("search matches the start of words, so 'paid' does not find 'unpaid'", () => {
  const paid = { ...base, name: "Paid Summer Internship", what_you_do: "Earn money." };
  const unpaid = { ...base, type: "volunteer", id: "y", name: "Volunteer Hours", what_you_do: "An unpaid role." };
  assert.equal(L.matches(paid, { q: "paid" }, NOW), true);
  assert.equal(L.matches(unpaid, { q: "paid" }, NOW), false);
  assert.equal(L.matches(unpaid, { q: "volun" }, NOW), true);
  assert.equal(L.matches(paid, { q: "summer intern" }, NOW), true);
});

test("every region maps to a state table entry, and unknown regions never fall back to California", () => {
  L.REGIONS.forEach((r) => assert.ok(Object.prototype.hasOwnProperty.call(L.STATE_OF, r[0]), "no state entry for " + r[0]));
  assert.equal(L.stateOf({ regions: ["austin-not-yet-added"] }), "");
});

test("stateOf picks the state whose rules apply", () => {
  assert.equal(L.stateOf({ regions: ["oakland"] }), "ca");
  assert.equal(L.stateOf({ regions: ["statewide"] }), "ca");
  assert.equal(L.stateOf({ regions: ["orange-county", "san-diego"] }), "ca");
  assert.equal(L.stateOf({ regions: ["atlanta", "georgia"] }), "ga");
  assert.equal(L.stateOf({ regions: ["new-york-city"] }), "ny");
  assert.equal(L.stateOf({ regions: ["chicago"] }), "il");
  assert.equal(L.stateOf({ regions: ["virtual", "national"] }), "");
});

import fs from "node:fs";
const PERMITS = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

test("permitFor: the right permit for the right age, state and kind", () => {
  const f = (st, age, kind) => L.permitFor(PERMITS, st, age, kind);
  assert.equal(f("ca", 15, "job").verdict, "need");
  assert.equal(f("ca", 17, "job").verdict, "need");
  assert.equal(f("ca", 18, "job").verdict, "adult");
  assert.equal(f("ca", 13, "job").verdict, "young");
  assert.equal(f("ca", 13, "odd").verdict, "none");
  assert.equal(f("ca", 16, "volunteer").verdict, "none");
  assert.equal(f("ga", 15, "job").verdict, "need");
  assert.equal(f("ga", 16, "job").verdict, "none");
  assert.equal(f("il", 15, "program").verdict, "need");
  assert.equal(f("il", 16, "job").verdict, "none");
  assert.equal(f("ny", 17, "job").verdict, "need");
  assert.equal(f("ny", 15, "odd").verdict, "none");
  assert.equal(f("ny", 15, "own").verdict, "ask");
  assert.equal(f("tx", 15, "job").verdict, "nostate");
  assert.match(f("ca", 15, "job").hours, /3 hours/);
  assert.match(f("ny", 17, "job").hours, /28 a week/);
});

test("permits.json: every state answers every kind, with sources and no placeholder text", () => {
  const kinds = PERMITS.kinds.map((k) => k[0]);
  Object.keys(PERMITS.states).forEach((st) => {
    const s = PERMITS.states[st];
    kinds.forEach((k) => assert.ok(s.kinds[k] && s.kinds[k].text, st + " has no answer for " + k));
    assert.ok(s.links.length >= 2 && s.call && s.read && s.steps.length >= 3 && s.bring.length >= 3, st);
    s.links.forEach((l) => assert.match(l.u, /^(https:\/\/|[a-z]+\.html)/));
    assert.ok(L.REGIONS.length > 0 && L.STATE_OF);
  });
  assert.doesNotMatch(JSON.stringify(PERMITS), /undefined|NaN|TODO|—|–/);
});
