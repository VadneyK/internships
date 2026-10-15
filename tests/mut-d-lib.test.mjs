// 2026-10-15: tests that pin lib.js behavior the 2026-10-14 mutation run showed was untested (relax helpers, ranking and sorting, ics, dates and status).
// Run with: node --test tests/mut-d-lib.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");

// Fixed "today": 15 Oct 2026, local noon (the lib parses dates in local time).
const NOW = new Date(2026, 9, 15, 12).getTime();
const mk = (o) => Object.assign({ name: "N", status: "rolling", paid_type: "paid", regions: ["statewide"], fields: ["any"], type: "internship" }, o);
const names = (l) => l.map((e) => e.name);
const day = (y, m, d) => new Date(y, m - 1, d).getTime();

// ---------- parseISO ----------
test("parseISO accepts real dates and returns a local Date", () => {
  const d = L.parseISO("2026-10-15");
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 9, 15]);
  assert.equal(L.parseISO("2024-02-29").getDate(), 29);
});
test("parseISO rejects wrong shapes and days that do not exist", () => {
  for (const bad of [undefined, null, "", "2026-10-15x", "x2026-10-15", "2026-10-15 ", "2026-1-15", "26-10-15",
    "2026-02-29", "2027-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-10-00", "2026-10-32"]) {
    assert.equal(L.parseISO(bad), null, String(bad));
  }
  // years below 100 are mapped to 19xx by Date, so the year check must reject them
  assert.equal(L.parseISO("0050-01-01"), null);
});

// ---------- effStatus ----------
test("effStatus: opens-soon turns into open-now on the opening day, not before", () => {
  const e = (opens) => mk({ status: "opens-soon", opens_iso: opens });
  assert.equal(L.effStatus(e("2026-10-14"), NOW), "open-now");
  assert.equal(L.effStatus(e("2026-10-15"), NOW), "open-now");
  assert.equal(L.effStatus(e("2026-10-16"), NOW), "opens-soon");
  assert.equal(L.effStatus(e(undefined), NOW), "opens-soon");
});
test("effStatus: an opening date never changes a status other than opens-soon", () => {
  for (const s of ["rolling", "year-round", "event", "closed-expect-reopen", "unconfirmed", "open-now"]) {
    assert.equal(L.effStatus(mk({ status: s, opens_iso: "2026-01-01" }), NOW), s, s);
  }
});
test("effStatus: passed deadlines go stale in the right direction", () => {
  assert.equal(L.effStatus(mk({ status: "open-now", deadline_iso: "2026-10-14" }), NOW), "closed-expect-reopen");
  assert.equal(L.effStatus(mk({ status: "opens-soon", deadline_iso: "2026-10-14", opens_iso: "2026-10-01" }), NOW), "closed-expect-reopen");
  assert.equal(L.effStatus(mk({ status: "open-now", deadline_iso: "2026-10-15" }), NOW), "open-now");
  assert.equal(L.effStatus(mk({ status: "event", deadline_iso: "2026-10-14" }), NOW), "event-passed");
  assert.equal(L.effStatus(mk({ status: "event", deadline_iso: "2026-10-15" }), NOW), "event");
  assert.equal(L.effStatus(mk({ status: "rolling", deadline_iso: "2026-01-01" }), NOW), "rolling");
});

// ---------- futureDeadline / knownDeadline ----------
test("futureDeadline returns the date only for statuses that can still be applied to", () => {
  for (const s of ["open-now", "opens-soon", "rolling", "event"]) {
    const d = L.futureDeadline(mk({ status: s, deadline_iso: "2026-11-01" }), NOW);
    assert.ok(d instanceof Date, s);
    assert.equal(d.getTime(), day(2026, 11, 1), s);
  }
  for (const s of ["year-round", "closed-expect-reopen", "unconfirmed", "event-passed"]) {
    assert.equal(L.futureDeadline(mk({ status: s, deadline_iso: "2026-11-01" }), NOW), null, s);
  }
});
test("futureDeadline: today counts, yesterday and missing do not", () => {
  assert.ok(L.futureDeadline(mk({ deadline_iso: "2026-10-15" }), NOW));
  assert.equal(L.futureDeadline(mk({ deadline_iso: "2026-10-14" }), NOW), null);
  assert.equal(L.futureDeadline(mk({}), NOW), null);
});
test("knownDeadline: adds confirmed 2026-27 dates on closed or unconfirmed cards only", () => {
  const conf = "confirmed-2026-27";
  const k = (o) => L.knownDeadline(mk(o), NOW);
  assert.equal(k({ status: "unconfirmed", deadline_iso: "2026-12-01", deadline_confidence: conf }).getTime(), day(2026, 12, 1));
  assert.equal(k({ status: "closed-expect-reopen", deadline_iso: "2026-10-15", deadline_confidence: conf }).getTime(), day(2026, 10, 15));
  assert.equal(k({ status: "unconfirmed", deadline_iso: "2026-12-01", deadline_confidence: "estimated" }), null);
  assert.equal(k({ status: "unconfirmed", deadline_iso: "2026-12-01" }), null);
  assert.equal(k({ status: "unconfirmed", deadline_iso: "2026-10-14", deadline_confidence: conf }), null);
  // a status that is neither open-ish nor closed/unconfirmed gets no date even when confirmed
  assert.equal(k({ status: "year-round", deadline_iso: "2026-12-01", deadline_confidence: conf }), null);
  // a normal future deadline still comes through
  assert.equal(k({ status: "rolling", deadline_iso: "2026-12-01" }).getTime(), day(2026, 12, 1));
});

// ---------- rank / compareRanks ----------
test("rank: exact key array, with and without an age profile", () => {
  const e = mk({ status: "open-now", deadline_iso: "2026-10-25", paid_type: "paid", priority: 2, verified: "fetched", name: "A", min_age: 14 });
  assert.deepEqual(L.rank(e, NOW), [0, 0, 0, 10, 2, 0, "A"]);
  assert.deepEqual(L.rank(e, NOW, { age: 15 }), [0, 0, 0, 0, 10, 2, 0, "A"]);
  assert.deepEqual(L.rank(e, NOW, {}), [0, 0, 0, 10, 2, 0, "A"]);
});
test("rank: priority defaults to 3 and anything but fetched counts as unverified", () => {
  assert.deepEqual(L.rank(mk({ status: "year-round", name: "Z", verified: "pending" }), NOW), [2, 0, 0, 0, 3, 1, "Z"]);
});
test("rank: groups run open with deadline, open, anytime, closed, unknown", () => {
  const g = (o) => L.rank(mk(o), NOW)[0];
  assert.equal(g({ status: "open-now", deadline_iso: "2026-11-01" }), 0);
  assert.equal(g({ status: "open-now" }), 1);
  assert.equal(g({ status: "opens-soon" }), 1);
  assert.equal(g({ status: "rolling" }), 2);
  assert.equal(g({ status: "event" }), 2);
  assert.equal(g({ status: "closed-expect-reopen" }), 3);
  assert.equal(g({ status: "unconfirmed" }), 4);
});
test("rank: the deadline bucket splits at 21 days", () => {
  const b = (iso) => L.rank(mk({ status: "open-now", deadline_iso: iso }), NOW)[1];
  assert.equal(b("2026-10-15"), 0);
  assert.equal(b("2026-11-05"), 0); // 21 days
  assert.equal(b("2026-11-06"), 1); // 22 days
});
test("rank: cost tier 0 paid/stipend/mixed, 1 unpaid or not stated, 2 fee-based", () => {
  const c = (t) => L.rank(mk({ paid_type: t }), NOW)[2];
  for (const t of ["paid", "stipend", "mixed"]) assert.equal(c(t), 0, t);
  for (const t of ["unpaid", "unpaid-credit", "not-stated", undefined]) assert.equal(c(t), 1, String(t));
  assert.equal(c("fee-based"), 2);
});
test("rank: age fit key is 0 fits, 1 not stated, 2 does not fit (min only, max only, both)", () => {
  const a = (o) => L.rank(mk(o), NOW, { age: 15 })[3];
  assert.equal(a({ min_age: 14 }), 0);
  assert.equal(a({ min_age: 16 }), 2);
  assert.equal(a({ max_age: 17 }), 0);
  assert.equal(a({ max_age: 12 }), 2);
  assert.equal(a({ min_age: 14, max_age: 18 }), 0);
  assert.equal(a({ min_age: 16, max_age: 18 }), 2);
  assert.equal(a({}), 1);
  assert.equal(a({ min_age: 0 }), 0);
  assert.equal(a({ max_age: 0 }), 2);
});
test("compare (compareRanks) goes key by key, with the name as the last tie-break", () => {
  const a = mk({ name: "Apple" }), b = mk({ name: "Berry" });
  assert.equal(L.compare(a, b, NOW), -1);
  assert.equal(L.compare(b, a, NOW), 1);
  assert.equal(L.compare(a, a, NOW), 0);
  // an earlier key wins even when a later key (the name) points the other way
  const open = mk({ name: "Zed", status: "open-now" }), any = mk({ name: "Abe", status: "rolling" });
  assert.equal(L.compare(open, any, NOW), -1);
  assert.equal(L.compare(any, open, NOW), 1);
  // priority beats name
  const p1 = mk({ name: "Zed", priority: 1 }), p2 = mk({ name: "Abe", priority: 2 });
  assert.equal(L.compare(p1, p2, NOW), -1);
  // fetched beats unverified before the name is looked at
  const f = mk({ name: "Zed", verified: "fetched" }), u = mk({ name: "Abe", verified: "pending" });
  assert.equal(L.compare(f, u, NOW), -1);
  assert.equal(L.compare(u, f, NOW), 1);
});

// ---------- sortList ----------
test("sortList by name uses locale order and does not touch the input", () => {
  const list = [mk({ name: "b" }), mk({ name: "C" }), mk({ name: "a" })];
  assert.deepEqual(names(L.sortList(list, "name", NOW)), ["a", "b", "C"]);
  assert.deepEqual(names(list), ["b", "C", "a"]);
});
test("sortList best: group, then bucket and cost, then days, then priority, then name", () => {
  const list = [
    mk({ name: "closed", status: "closed-expect-reopen" }),
    mk({ name: "fee-soon", status: "open-now", deadline_iso: "2026-10-20", paid_type: "fee-based" }),
    mk({ name: "paid-late", status: "open-now", deadline_iso: "2026-12-30" }),
    mk({ name: "paid-soon", status: "open-now", deadline_iso: "2026-10-25" }),
    mk({ name: "anytime", status: "rolling" }),
    mk({ name: "open-nodate", status: "open-now" }),
  ];
  assert.deepEqual(names(L.sortList(list, "best", NOW)), ["paid-soon", "fee-soon", "paid-late", "open-nodate", "anytime", "closed"]);
  assert.equal(names(list)[0], "closed", "input order unchanged");
});
test("sortList best with an age profile puts fitting ages before unstated before non-fitting", () => {
  const list = [mk({ name: "no", min_age: 17 }), mk({ name: "none" }), mk({ name: "fits", max_age: 18 })];
  assert.deepEqual(names(L.sortList(list, "best", NOW, { age: 15 })), ["fits", "none", "no"]);
});
test("sortList deadline: soonest date first, whatever the cost tier or group; best differs", () => {
  const list = [
    mk({ name: "paid-later", status: "open-now", deadline_iso: "2026-10-30" }),
    mk({ name: "fee-sooner", status: "open-now", deadline_iso: "2026-10-20", paid_type: "fee-based" }),
    mk({ name: "rolling-soonest", status: "rolling", deadline_iso: "2026-10-18" }),
  ];
  assert.deepEqual(names(L.sortList(list, "deadline", NOW)), ["rolling-soonest", "fee-sooner", "paid-later"]);
  assert.deepEqual(names(L.sortList(list, "best", NOW)), ["paid-later", "fee-sooner", "rolling-soonest"]);
});
test("sortList deadline: same date falls back to rank, in either input order", () => {
  const hi = mk({ name: "Zed", status: "open-now", deadline_iso: "2026-11-01", priority: 1 });
  const lo = mk({ name: "Abe", status: "open-now", deadline_iso: "2026-11-01", priority: 3 });
  assert.deepEqual(names(L.sortList([lo, hi], "deadline", NOW)), ["Zed", "Abe"]);
  assert.deepEqual(names(L.sortList([hi, lo], "deadline", NOW)), ["Zed", "Abe"]);
});
test("sortList deadline: programs without a date go after those with one, ordered by rank", () => {
  const dated = mk({ name: "dated", status: "open-now", deadline_iso: "2026-12-31", paid_type: "fee-based" });
  const n1 = mk({ name: "n-b", status: "rolling" }), n2 = mk({ name: "n-a", status: "rolling" });
  const want = ["dated", "n-a", "n-b"];
  assert.deepEqual(names(L.sortList([n1, dated, n2], "deadline", NOW)), want);
  assert.deepEqual(names(L.sortList([n1, n2, dated], "deadline", NOW)), want);
  assert.deepEqual(names(L.sortList([dated, n1, n2], "deadline", NOW)), want);
  assert.deepEqual(names(L.sortList([n2, n1, dated], "deadline", NOW)), want);
});
test("sortList deadline: a dated program beats an undated one even when its rank is worse", () => {
  const dated = mk({ name: "dated", status: "rolling", deadline_iso: "2026-12-31", paid_type: "fee-based" });
  const undated = mk({ name: "undated", status: "rolling", paid_type: "paid" });
  assert.deepEqual(names(L.sortList([dated, undated], "best", NOW)), ["undated", "dated"]);
  assert.deepEqual(names(L.sortList([dated, undated], "deadline", NOW)), ["dated", "undated"]);
  assert.deepEqual(names(L.sortList([undated, dated], "deadline", NOW)), ["dated", "undated"]);
});
test("sortList of an empty list is an empty copy", () => {
  const src = [];
  const out = L.sortList(src, "deadline", NOW);
  assert.deepEqual(out, []);
  assert.notEqual(out, src);
});

// ---------- topPicks ----------
test("topPicks keeps only open, soon, rolling and year-round programs", () => {
  const list = ["open-now", "opens-soon", "rolling", "year-round", "event", "closed-expect-reopen", "unconfirmed"]
    .map((s) => mk({ name: s, status: s }));
  assert.deepEqual(names(L.topPicks(list, {}, NOW, 10)).sort(), ["open-now", "opens-soon", "rolling", "year-round"]);
});
test("topPicks uses the effective status (a passed deadline drops the program)", () => {
  const list = [mk({ name: "stale", status: "open-now", deadline_iso: "2026-10-01" }), mk({ name: "live", status: "open-now", deadline_iso: "2026-10-30" })];
  assert.deepEqual(names(L.topPicks(list, {}, NOW)), ["live"]);
});
test("topPicks drops fee-based programs", () => {
  const list = [mk({ name: "fee", paid_type: "fee-based" }), mk({ name: "ok", paid_type: "unpaid" })];
  assert.deepEqual(names(L.topPicks(list, {}, NOW)), ["ok"]);
});
test("topPicks with an age needs a stated range that fits", () => {
  const list = [
    mk({ name: "none" }), mk({ name: "min-ok", min_age: 14 }), mk({ name: "min-bad", min_age: 16 }),
    mk({ name: "max-ok", max_age: 17 }), mk({ name: "max-bad", max_age: 12 }), mk({ name: "both-ok", min_age: 13, max_age: 16 }),
  ];
  assert.deepEqual(names(L.topPicks(list, { age: 15 }, NOW, 10)).sort(), ["both-ok", "max-ok", "min-ok"]);
  // no age chosen: unstated ages are kept
  assert.equal(L.topPicks(list, {}, NOW, 10).length, 6);
  assert.equal(L.topPicks(list, null, NOW, 10).length, 6);
});
test("topPicks returns 3 by default, honors n, and clamps negatives to none", () => {
  const list = ["a", "b", "c", "d", "e"].map((n) => mk({ name: n }));
  assert.deepEqual(names(L.topPicks(list, {}, NOW)), ["a", "b", "c"]);
  assert.deepEqual(names(L.topPicks(list, {}, NOW, undefined)), ["a", "b", "c"]);
  assert.deepEqual(names(L.topPicks(list, {}, NOW, null)), ["a", "b", "c"]);
  assert.deepEqual(names(L.topPicks(list, {}, NOW, 5)), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(names(L.topPicks(list, {}, NOW, 1)), ["a"]);
  assert.deepEqual(L.topPicks(list, {}, NOW, 0), []);
  assert.deepEqual(L.topPicks(list, {}, NOW, -2), []);
});
test("topPicks handles a missing list and orders by the best order", () => {
  assert.deepEqual(L.topPicks(undefined, {}, NOW), []);
  assert.deepEqual(L.topPicks(null, { age: 15 }, NOW), []);
  const list = [mk({ name: "rolling", status: "rolling" }), mk({ name: "open", status: "open-now", deadline_iso: "2026-10-20" })];
  assert.deepEqual(names(L.topPicks(list, {}, NOW)), ["open", "rolling"]);
});

// ---------- relaxOptions / relaxLabel (relaxLabel is not exported, so it is checked through relaxOptions) ----------
const RL = [mk({ name: "one" }), mk({ name: "two", type: "research", fields: ["science"] }), mk({ name: "three", paid_type: "fee-based" })];
const keysCounts = (o) => o.map((x) => [x.key, x.count]);
// the label of the single suggestion a one-filter state produces
const label = (state, list = RL) => {
  const o = L.relaxOptions(list, state, NOW);
  assert.equal(o.length, 1, JSON.stringify(state));
  return o[0].label;
};

test("relax labels for the simple filters", () => {
  assert.equal(label({ q: "zzzz" }), "Remove the search word");
  assert.equal(label({ age: "15" }), "Remove age 15");
});
test("relax labels name each timing choice and fall back for an unknown one", () => {
  assert.equal(label({ when: "closed" }), "Remove Closed now, check back");
  const list = [mk({ name: "x", status: "open-now", deadline_iso: "2026-10-20" })];
  assert.equal(label({ when: "open" }, list), "Remove Open or opening soon");
  assert.equal(label({ when: "60" }, list), "Remove Deadline in the next 60 days");
  assert.equal(label({ when: "anytime" }, list), "Remove Apply anytime");
  assert.equal(label({ when: "someday" }, list), "Remove the timing filter");
});
test("relax labels for season, checked and permit filters", () => {
  const list = [mk({ name: "x", season: "summer", verified: "pending", needs_work_permit: true })];
  assert.equal(label({ season: "winter" }, list), "Remove the season filter");
  assert.equal(label({ verified: true }, list), "Remove Only checked on the official site");
  assert.equal(label({ noPermit: true }, list), "Remove No work permit needed");
});
test("relax label for place uses the place name", () => {
  const list = [mk({ name: "x", regions: ["boston"] })];
  const o = L.relaxOptions(list, { place: "city:davis" }, NOW);
  assert.deepEqual(o, [{ key: "place", label: "Remove place: Davis and Sacramento", count: 1 }]);
});
test("relax labels for list filters: one choice shows its readable name", () => {
  assert.equal(label({ paid: ["free"] }), "Remove pay: Free or volunteer");
  assert.equal(label({ paid: ["fee"] }), "Remove pay: Costs money");
  assert.equal(label({ types: ["research"] }), "Remove type: Research");
  assert.equal(label({ types: ["leadership"] }), "Remove type: Leadership");
  assert.equal(label({ fields: ["health"] }), "Remove interest: Health");
  assert.equal(label({ hubs: ["oak"] }), "Remove area: Oakland and East Bay");
});
test("relax labels for list filters: an unknown id is shown as it is, several are counted", () => {
  assert.equal(label({ paid: ["bogus"] }), "Remove pay: bogus");
  assert.equal(label({ types: ["bogus"] }), "Remove type: bogus");
  assert.equal(label({ paid: ["pay", "free"] }), "Remove the 2 pay filters");
  assert.equal(label({ types: ["research", "volunteer", "internship"] }), "Remove the 3 type filters");
  assert.equal(label({ fields: ["health", "science"] }), "Remove the 2 interest filters");
  assert.equal(label({ hubs: ["oak", "sf"] }), "Remove the 2 area filters");
});
test("relaxOptions returns key, label and count only, and skips empty or off filters", () => {
  const o = L.relaxOptions(RL, { q: "zzzz", types: [], paid: [], fields: [], hubs: [], verified: false, noPermit: false, season: "", place: "", when: "", age: "" }, NOW);
  assert.deepEqual(o, [{ key: "q", label: "Remove the search word", count: 3 }]);
});
test("relaxOptions drops a removal that still finds nothing, and copes with missing input", () => {
  assert.deepEqual(keysCounts(L.relaxOptions(RL, { q: "zzzz", types: ["research"] }, NOW)), [["q", 1]]);
  assert.deepEqual(L.relaxOptions([], { q: "x" }, NOW), []);
  assert.deepEqual(L.relaxOptions(null, { q: "x" }, NOW), []);
  assert.deepEqual(L.relaxOptions(undefined, { q: "x" }, NOW), []);
  assert.deepEqual(L.relaxOptions(RL, null, NOW), []);
  assert.deepEqual(L.relaxOptions(RL, undefined, NOW), []);
});
test("relaxOptions: most matches first, equal counts keep the filter order", () => {
  const list = [mk({ name: "item a", type: "research" }), mk({ name: "item b", type: "research" }), mk({ name: "item c", type: "volunteer" })];
  // tie at 1 each: q comes before types
  assert.deepEqual(keysCounts(L.relaxOptions(list, { q: "item a", types: ["volunteer"] }, NOW)), [["q", 1], ["types", 1]]);
  // a later filter with the higher count goes first
  assert.deepEqual(keysCounts(L.relaxOptions(list, { q: "item", types: ["research"] }, NOW)), [["types", 3], ["q", 2]]);
});
test("relaxOptions keeps at most 3 (the earliest filters on a tie) and does not change the state", () => {
  const st = { age: "15", paid: ["pay"], types: ["internship"], fields: ["health"], hubs: ["state"] };
  const plain = [mk({ name: "a" }), mk({ name: "b" }), mk({ name: "c" })];
  const copy = JSON.stringify(st);
  const o = L.relaxOptions(plain, st, NOW);
  assert.equal(JSON.stringify(st), copy);
  assert.deepEqual(keysCounts(o), [["age", 3], ["paid", 3], ["types", 3]]);
});
test("relaxOptions widens a thin place result to online programs", () => {
  const list = [
    mk({ name: "local", regions: ["davis"] }),
    mk({ name: "online1", regions: ["virtual"] }), mk({ name: "online2", regions: ["national"] }), mk({ name: "far", regions: ["boston"] }),
  ];
  // removing q leaves place=Davis: 1 local program, fewer than 3, so online ones are added: 3
  assert.deepEqual(keysCounts(L.relaxOptions(list, { q: "zzzz", place: "city:davis" }, NOW)), [["q", 3]]);
});

// ---------- icsFold (not exported, so it is checked through the DESCRIPTION line of icsEvent) ----------
const octets = (s) => Buffer.byteLength(s, "utf8");
const unfold = (s) => s.replace(/\r\n /g, "");
// the folded DESCRIPTION line for a raw description; "DESCRIPTION:" is 12 octets
const descLine = (desc) => {
  const ics = L.icsEvent({ dateISO: "2026-10-31", uid: "u", title: "t", desc, stamp: new Date(0) });
  return ics.slice(ics.indexOf("DESCRIPTION:"), ics.indexOf("\r\nEND:VEVENT"));
};
test("icsFold leaves a line of 75 octets alone and folds at 76", () => {
  assert.equal(descLine("a".repeat(63)), "DESCRIPTION:" + "a".repeat(63));
  assert.equal(descLine("a".repeat(64)), "DESCRIPTION:" + "a".repeat(63) + "\r\n a");
  assert.equal(descLine(""), "DESCRIPTION:");
});
test("icsFold continuation lines carry 74 octets after the leading space", () => {
  const lines = descLine("a".repeat(63 + 74 + 74 + 1)).split("\r\n");
  assert.deepEqual(lines.map(octets), [75, 75, 75, 2]);
  assert.ok(lines.slice(1).every((l) => l[0] === " "));
});
test("icsFold counts octets, and never splits a multi-byte character", () => {
  const desc = "x".repeat(62) + "\u00e9\u00e9" + "\u{1F600}".repeat(5) + "y";
  const out = descLine(desc);
  const lines = out.split("\r\n");
  assert.ok(lines.every((l) => octets(l) <= 75), "every line within 75 octets");
  // 12 + 62 = 74 octets, so the first e-acute (2 octets) does not fit and moves down
  assert.equal(lines[0], "DESCRIPTION:" + "x".repeat(62));
  assert.equal(unfold(out), "DESCRIPTION:" + desc);
});
test("icsFold keeps an escape pair together", () => {
  // 12 + 62 = 74 octets, then the two-octet \n pair would end at 76: it moves to the next line whole
  assert.equal(descLine("a".repeat(62) + "\nb"), "DESCRIPTION:" + "a".repeat(62) + "\r\n \\nb");
  // 12 + 61 = 73, the pair fits exactly (75)
  assert.equal(descLine("a".repeat(61) + ",b"), "DESCRIPTION:" + "a".repeat(61) + "\\,\r\n b");
  assert.equal(descLine("a".repeat(62) + "\\"), "DESCRIPTION:" + "a".repeat(62) + "\r\n \\\\");
});
test("icsFold passes escape pairs through unchanged when nothing folds", () => {
  assert.equal(descLine("x,y;z\\w\nq"), "DESCRIPTION:x\\,y\\;z\\\\w\\nq");
});

// ---------- icsEvent ----------
test("icsEvent builds the full all-day event, CRLF line ends and a final CRLF", () => {
  const got = L.icsEvent({ dateISO: "2026-10-31", uid: "abc123", title: "Apply, now; ok", desc: "Line one\nLine two", stamp: new Date(Date.UTC(2026, 9, 15, 12, 30, 45, 123)) });
  const want = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Teen Internship Guide//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    "UID:abc123@vadneyk.github.io", "DTSTAMP:20261015T123045Z", "DTSTART;VALUE=DATE:20261031", "DTEND;VALUE=DATE:20261101",
    "SUMMARY:Apply\\, now\\; ok", "DESCRIPTION:Line one\\nLine two", "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  assert.equal(got, want);
});
test("icsEvent ends on the next day across month and year boundaries", () => {
  const e = (d) => L.icsEvent({ dateISO: d, uid: "u", title: "t", desc: "d", stamp: new Date(0) });
  assert.match(e("2026-12-31"), /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n/);
  assert.match(e("2028-02-28"), /DTEND;VALUE=DATE:20280229\r\n/);
});
test("icsEvent folds long lines and returns an empty string for a bad date", () => {
  const long = L.icsEvent({ dateISO: "2026-10-31", uid: "u", title: "t", desc: "word ".repeat(40), stamp: new Date(0) });
  assert.ok(long.split("\r\n").every((l) => octets(l) <= 75));
  assert.equal(L.icsEvent({ dateISO: "2026-02-30", uid: "u" }), "");
  assert.equal(L.icsEvent({ dateISO: "nope" }), "");
  assert.equal(L.icsEvent(null), "");
  assert.equal(L.icsEvent(undefined), "");
  assert.equal(L.icsEvent({}), "");
});
