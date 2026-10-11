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
  assert.equal(L.matches({ ...base, paid_type: "not-stated" }, { paid: ["pay"] }, NOW), false);
  assert.equal(L.matches({ ...base, paid_type: "not-stated" }, { paid: ["unknown"] }, NOW), true);
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
  assert.equal(f("zz", 15, "job").verdict, "nostate");
  assert.equal(f("wa", 15, "job").verdict, "need");
  assert.equal(f("tx", 15, "job").verdict, "none");
  assert.equal(f("pa", 17, "job").verdict, "need");
  assert.equal(f("pa", 18, "job").verdict, "adult");
  assert.match(f("ca", 15, "job").hours, /3 hours/);
  assert.match(f("ny", 17, "job").hours, /28 a week/);
});

test("permitFor: a kind can override its answer for younger ages, so the headline never beats its text", () => {
  const f = (st, age, kind) => L.permitFor(PERMITS, st, age, kind);
  [12, 13].forEach((age) => {
    const r = f("ny", age, "odd");
    assert.equal(r.verdict, "ask");
    assert.equal(r.headline, "Check before you start");
    assert.match(r.text, /babysitter must be at least 14/);
    assert.match(r.text, /Yard work for 12 and 13 year olds is not stated/);
    assert.match(r.text, /888-469-7365/);
  });
  [14, 15].forEach((age) => assert.equal(f("mn", age, "job").verdict, "ask"));
  const mn = f("mn", 15, "job");
  assert.equal(mn.headline, "Check before you start");
  assert.match(mn.text, /Under 16 you need an employment certificate only to work on school days during school hours/);
  [14, 15].forEach((age) => assert.equal(f("ny", age, "odd").verdict, "none"));
  [16, 17].forEach((age) => assert.equal(f("mn", age, "job").verdict, "none"));
  assert.equal(f("mn", 16, "job").headline, "You do not need a permit for this");
  assert.equal(f("ca", 12, "odd").verdict, "none");
});

test("permitFor: the headline uses a or an to match the permit name", () => {
  assert.equal(L.permitFor(PERMITS, "ny", 15, "job").headline, "You need a Working papers (employment certificate)");
  const fake = { states: { xx: { name: "X", permit: "Employment certificate", needBelow: 18, minAge: { job: 14, note: "n" }, hours: {}, wage: "w", adult: "a", kinds: { job: { permit: true, text: "t" } } } } };
  assert.equal(L.permitFor(fake, "xx", 15, "job").headline, "You need an Employment certificate");
  fake.states.xx.permit = "Work permit";
  assert.equal(L.permitFor(fake, "xx", 15, "job").headline, "You need a Work permit");
  Object.keys(PERMITS.states).forEach((st) => {
    for (let age = 14; age <= 17; age++) {
      const r = L.permitFor(PERMITS, st, age, "job");
      assert.doesNotMatch(r.headline, /\bYou need a [AEIOUaeiou]/);
    }
  });
});

test("permits.json: every state answers every kind, with sources and no placeholder text", () => {
  const kinds = PERMITS.kinds.map((k) => k[0]);
  Object.keys(PERMITS.states).forEach((st) => {
    const s = PERMITS.states[st];
    kinds.forEach((k) => assert.ok(s.kinds[k] && s.kinds[k].text, st + " has no answer for " + k));
    assert.ok(s.links.length >= 2 && s.call && s.read && s.steps.length >= 3 && s.bring.length >= 1, st);
    s.links.forEach((l) => assert.match(l.u, /^(https:\/\/|[a-z]+\.html)/));
    assert.ok(L.REGIONS.length > 0 && L.STATE_OF);
  });
  assert.doesNotMatch(JSON.stringify(PERMITS), new RegExp("undefined|NaN|TODO|" + String.fromCharCode(0x2014) + "|" + String.fromCharCode(0x2013)));
});

test("PERMIT_STATES matches the states in permits.json", () => {
  assert.deepEqual([...L.PERMIT_STATES].sort(), Object.keys(PERMITS.states).sort());
});

test("places: every city and area resolves to real region ids, and matches filters by place", () => {
  const known = new Set(L.REGIONS.map((r) => r[0]));
  L.CITIES.forEach((c) => c[2].forEach((r) => assert.ok(known.has(r), c[0] + " has unknown region " + r)));
  L.AREAS.forEach((a) => {
    a[2].forEach((cid) => assert.ok(L.CITIES.some((c) => c[0] === cid), a[0] + " has unknown city " + cid));
    assert.ok(L.placeRegions("area:" + a[0]).length > 0);
  });
  assert.equal(L.placeRegions("city:nowhere"), null);
  assert.equal(L.placeLabel("city:boston"), "Boston");
  const boston = { regions: ["boston"] }, ca = { regions: ["statewide"] }, online = { regions: ["virtual"] };
  assert.equal(L.matches(boston, { place: "city:boston" }, Date.now()), true);
  assert.equal(L.matches(ca, { place: "city:boston" }, Date.now()), false);
  assert.equal(L.matches(ca, { place: "city:san-diego" }, Date.now()), true, "California-wide programs count for California cities");
  assert.equal(L.matches(online, { place: "city:boston" }, Date.now()), false);
  assert.equal(L.matches(online, { place: "city:boston", placeOnline: true }, Date.now()), true);
  assert.equal(L.matches({ regions: ["madison"] }, { place: "area:midwest" }, Date.now()), true);
  assert.deepEqual(L.hubsOfPlace("city:boston"), ["east"]);
});

test("permitFor: 18 year olds get no youth hours, a too-young answer links nothing false", () => {
  const a = L.permitFor(PERMITS, "ca", 18, "job");
  assert.equal(a.verdict, "adult");
  assert.equal(a.hours, "");
  const y = L.permitFor(PERMITS, "ca", 13, "job");
  assert.equal(y.verdict, "young");
  assert.equal(y.hours, "");
  assert.doesNotMatch(y.text, /usual first steps/);
});

test("no-permit filter only keeps programs that say no permit is needed", () => {
  const unknown = { regions: ["oakland"], needs_work_permit: null }, no = { regions: ["oakland"], needs_work_permit: false }, yes = { regions: ["oakland"], needs_work_permit: true };
  assert.equal(L.matches(unknown, { noPermit: true }, Date.now()), false);
  assert.equal(L.matches(no, { noPermit: true }, Date.now()), true);
  assert.equal(L.matches(yes, { noPermit: true }, Date.now()), false);
});

test("areas include California-wide programs like their own cities do", () => {
  assert.ok(L.placeRegions("area:bay-area").indexOf("statewide") > -1);
  assert.equal(L.placeRegions("area:midwest").indexOf("statewide"), -1);
});

test("every card's regions are known to the site (in REGIONS and with a STATE_OF key); a typo is caught", () => {
  const cards = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
  const known = new Set(L.REGIONS.map((r) => r[0]));
  // Returns "card id / region" pairs that the site would silently drop or mis-state. Empty regions are fine.
  const unknownRegions = (list) => {
    const bad = [];
    list.forEach((c) => (c.regions || []).forEach((r) => {
      if (!known.has(r) || !Object.prototype.hasOwnProperty.call(L.STATE_OF, r)) bad.push(c.id + " / " + r);
    }));
    return bad;
  };
  assert.deepEqual(unknownRegions(cards), [], "a card uses a region the site does not list");
  const typo = JSON.parse(JSON.stringify(cards[0]));
  typo.regions = ["oaklnd"];
  assert.deepEqual(unknownRegions([typo]), [typo.id + " / oaklnd"]);
});

test("gradePhrase: 'Grade 10' and '6' give clean grammar, not 'grade grade' or 'in 6 grade'", () => {
  assert.equal(L.gradePhrase("Grade 10"), "in 10th grade");
  assert.equal(L.gradePhrase("grade 6"), "in 6th grade");
  assert.equal(L.gradePhrase("6"), "in 6th grade");
  assert.equal(L.gradePhrase("1"), "in 1st grade");
  assert.equal(L.gradePhrase("2"), "in 2nd grade");
  assert.equal(L.gradePhrase("3"), "in 3rd grade");
  assert.equal(L.gradePhrase("4"), "in 4th grade");
});
test("rank: cost tier and age fit come after the group and the deadline bucket", () => {
  const fee = { ...base, id: "f", name: "F", paid_type: "fee-based", deadline_iso: "2026-10-10" };
  const paid = { ...base, id: "p", name: "P", paid_type: "paid", deadline_iso: "2027-03-01" };
  assert.deepEqual(L.sortList([paid, fee], "best", NOW).map((e) => e.id), ["f", "p"]);
  assert.equal(L.rank(paid, NOW).length + 1, L.rank(paid, NOW, { age: 16 }).length);
  assert.equal(L.rank(paid, NOW, { age: 16 })[3], 0);
});

/* The order the Find sort note describes (find.js SORT_NOTE_HEAD). NOW is Oct 7 2026, so the day counts are in the comments. */
const prog = (id, paid_type, deadline_iso, extra) => ({ ...base, id, name: id, paid_type, deadline_iso, status: "open-now", ...(extra || {}) });
const ids = (list, mode, profile) => L.sortList(list, mode || "best", NOW, profile).map((e) => e.id);

test("sort note order: inside the 3 week bucket, cost comes before the nearest deadline", () => {
  const paid18 = prog("paid18", "paid", "2026-10-25");   // 18 days
  const free2 = prog("free2", "unpaid", "2026-10-09");   // 2 days
  const free21 = prog("free21", "unpaid", "2026-10-28"); // 21 days, last day of the bucket
  const paid22 = prog("paid22", "paid", "2026-10-29");   // 22 days, outside the bucket
  assert.deepEqual(ids([paid22, free21, free2, paid18]), ["paid18", "free2", "free21", "paid22"]);
});

test("sort note order: paid, then unpaid or pay not stated, then costs money, then nearest deadline", () => {
  const fee5 = prog("fee5", "fee-based", "2026-10-12");     // 5 days
  const notStated5 = prog("notStated5", "not-stated", "2026-10-12"); // 5 days
  const paid20 = prog("paid20", "paid", "2026-10-27");     // 20 days
  const paid7 = prog("paid7", "stipend", "2026-10-14");    // 7 days
  assert.deepEqual(ids([fee5, paid20, notStated5, paid7]), ["paid7", "paid20", "notStated5", "fee5"]);
});

test("sort note order: age fit comes before the nearest deadline, and only when an age is set", () => {
  const fitLate = prog("fitLate", "paid", "2026-10-25", { min_age: 13, max_age: 15 }); // 18 days, fits 15
  const noFitSoon = prog("noFitSoon", "paid", "2026-10-15", { min_age: 16, max_age: 19 }); // 8 days, does not fit 15
  assert.deepEqual(ids([fitLate, noFitSoon]), ["noFitSoon", "fitLate"]);
  assert.deepEqual(ids([fitLate, noFitSoon], "best", { age: 15 }), ["fitLate", "noFitSoon"]);
});

test("sort note order: open with a deadline, then open with no deadline, then the rest, and groups beat cost", () => {
  const withDeadline = prog("withDeadline", "unpaid", "2026-11-06"); // 30 days, open with a deadline
  const openNoDeadline = prog("openNoDeadline", "paid", null);        // open, no deadline
  const rolling = { ...base, id: "rolling", name: "rolling", paid_type: "paid", status: "rolling", deadline_iso: null };
  assert.deepEqual(ids([rolling, openNoDeadline, withDeadline]), ["withDeadline", "openNoDeadline", "rolling"]);
});
