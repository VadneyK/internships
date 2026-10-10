// Default sort (ticket r1-ranking-ux-1): soonest deadline bucket, then paid, then age fit, fee-based last.
// Run with: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));

const NOW = new Date(2026, 9, 10); // 2026-10-10, local midnight
const day = (n) => { const d = new Date(2026, 9, 10 + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const base = {
  id: "x", name: "Example", org: "Org", regions: ["oakland"], city: "Oakland, CA", type: "paid-youth-program", fields: ["health"],
  what_you_do: "Do things.", min_age: null, max_age: null, grades: null, paid_type: "paid", season: "summer",
  status: "open-now", deadline_iso: day(40), verified: "fetched", priority: 1, needs_work_permit: false,
};
const mk = (id, over) => ({ ...base, id, name: id.toUpperCase(), ...over });
const ids = (list) => list.map((e) => e.id);

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(list, seed) {
  const a = list.slice(), rnd = seededRandom(seed);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

test("(a) in one deadline bucket a paid entry with a later deadline sorts before a fee-based one with an earlier deadline", () => {
  const fee = mk("fee", { paid_type: "fee-based", deadline_iso: day(30) });
  const paid = mk("paid", { paid_type: "paid", deadline_iso: day(50) });
  assert.deepEqual(ids(L.sortList([fee, paid], "best", NOW)), ["paid", "fee"]);
  const soonFee = mk("soonfee", { paid_type: "fee-based", deadline_iso: day(5) });
  const soonPaid = mk("soonpaid", { paid_type: "paid", deadline_iso: day(20) });
  assert.deepEqual(ids(L.sortList([soonFee, soonPaid], "best", NOW)), ["soonpaid", "soonfee"], "same for the 21 days or less bucket");
});

test("(b) a fee-based entry due in 3 days still sorts before a paid entry due in 60 days", () => {
  const fee = mk("fee", { paid_type: "fee-based", deadline_iso: day(3) });
  const paid = mk("paid", { paid_type: "paid", deadline_iso: day(60) });
  assert.deepEqual(ids(L.sortList([paid, fee], "best", NOW)), ["fee", "paid"]);
});

test("the bucket edge is 21 days: 21 is soon, 22 is not", () => {
  const edge = mk("edge", { paid_type: "fee-based", deadline_iso: day(21) });
  const past = mk("past", { paid_type: "paid", deadline_iso: day(22) });
  assert.deepEqual(L.rank(edge, NOW).slice(0, 3), [0, 0, 2]);
  assert.deepEqual(L.rank(past, NOW).slice(0, 3), [0, 1, 0]);
  assert.deepEqual(ids(L.sortList([past, edge], "best", NOW)), ["edge", "past"]);
});

test("cost tiers: paid, stipend, mixed, then unpaid, unpaid-credit, not-stated, then fee-based", () => {
  const types = ["fee-based", "not-stated", "unpaid-credit", "unpaid", "mixed", "stipend", "paid"];
  const list = types.map((t) => mk(t, { paid_type: t, name: "Same" }));
  const tier = (e) => L.rank(e, NOW)[2];
  assert.deepEqual(list.map(tier), [2, 1, 1, 1, 0, 0, 0]);
  const out = L.sortList(list, "best", NOW);
  assert.deepEqual(out.map(tier), [0, 0, 0, 1, 1, 1, 2]);
});

test("group stays the first key: an open entry with no deadline never beats one with a deadline, and closed comes last", () => {
  const fee = mk("fee", { paid_type: "fee-based", deadline_iso: day(100) });
  const open = mk("open", { paid_type: "paid", deadline_iso: null });
  const rolling = mk("rolling", { paid_type: "paid", status: "rolling", deadline_iso: null });
  const closed = mk("closed", { paid_type: "paid", status: "closed-expect-reopen", deadline_iso: null });
  assert.deepEqual(ids(L.sortList([closed, rolling, open, fee], "best", NOW)), ["fee", "open", "rolling", "closed"]);
});

test("(c) with profile.age 15 an entry that states ages 14 to 17 sorts before an identical one with no ages", () => {
  const stated = mk("zz-stated", { min_age: 14, max_age: 17 });
  const blank = mk("aa-blank", { name: "AA-BLANK" });
  stated.name = "ZZ"; blank.name = "AA";
  assert.deepEqual(ids(L.sortList([blank, stated], "best", NOW, { age: 15 })), ["zz-stated", "aa-blank"]);
  assert.deepEqual(ids(L.sortList([stated, blank], "best", NOW, { age: 15 })), ["zz-stated", "aa-blank"]);
  // Without a profile, or with an empty age, the order is by name.
  assert.deepEqual(ids(L.sortList([stated, blank], "best", NOW)), ["aa-blank", "zz-stated"]);
  assert.deepEqual(ids(L.sortList([stated, blank], "best", NOW, {})), ["aa-blank", "zz-stated"]);
  assert.deepEqual(ids(L.sortList([stated, blank], "best", NOW, { age: "" })), ["aa-blank", "zz-stated"]);
  assert.equal(L.rank(blank, NOW).length + 1, L.rank(blank, NOW, { age: 15 }).length, "the age key is only added with an age");
});

test("age fit: a stated range that fits sorts before one with no ages, and a range that does not fit sorts after both", () => {
  const fits = mk("fits", { name: "Z", min_age: 14, max_age: 17 });
  const none = mk("none", { name: "M" });
  const miss = mk("miss", { name: "A", min_age: 16, max_age: 18 });
  assert.deepEqual(ids(L.sortList([miss, none, fits], "best", NOW, { age: 15 })), ["fits", "none", "miss"]);
  const minOnly = mk("minonly", { name: "Y", min_age: 13, max_age: null });
  assert.equal(L.rank(minOnly, NOW, { age: 15 })[3], 0);
});

test("age fit never outranks deadline bucket or cost tier", () => {
  const paidBlank = mk("paidblank", { deadline_iso: day(10) });
  const feeFits = mk("feefits", { paid_type: "fee-based", deadline_iso: day(10), min_age: 14, max_age: 17 });
  const lateFits = mk("latefits", { deadline_iso: day(60), min_age: 14, max_age: 17 });
  assert.deepEqual(ids(L.sortList([lateFits, feeFits, paidBlank], "best", NOW, { age: 15 })), ["paidblank", "feefits", "latefits"]);
});

test("compare accepts the profile", () => {
  const stated = mk("a", { name: "Z", min_age: 14, max_age: 17 });
  const blank = mk("b", { name: "A" });
  assert.equal(L.compare(stated, blank, NOW), 1);
  assert.equal(L.compare(stated, blank, NOW, { age: 15 }), -1);
});

test("(d) shuffling the input never changes the output order, on made-up ties and on the real data", () => {
  const ties = [];
  for (let i = 0; i < 12; i++) ties.push(mk("t" + i, { name: "Name " + String(i).padStart(2, "0"), paid_type: i % 2 ? "paid" : "unpaid", deadline_iso: i % 3 ? day(10) : day(40), min_age: i % 4 ? null : 14 }));
  // Two real programs can share every sort key including the name (for example two "Teen Volunteer" cards). Their
  // relative order follows the input by design (Array.sort is stable), so the real-data check keeps one of each.
  const distinctFor = (profile) => {
    const seen = new Set();
    return DATA.filter((e) => { const k = JSON.stringify(L.rank(e, NOW, profile)); if (seen.has(k)) return false; seen.add(k); return true; });
  };
  assert.ok(distinctFor(undefined).length > DATA.length * 0.9, "most real programs have a distinct sort key");
  for (const profile of [undefined, { age: 15 }]) {
    for (const [label, data] of [["ties", ties], ["real data", distinctFor(profile)]]) {
      for (const mode of ["best", "deadline"]) {
        const want = ids(L.sortList(data, mode, NOW, profile));
        assert.deepEqual(ids(L.sortList(data.slice().reverse(), mode, NOW, profile)), want, label + " " + mode + " reversed " + JSON.stringify(profile));
        for (const seed of [1, 2026, 101010]) assert.deepEqual(ids(L.sortList(shuffled(data, seed), mode, NOW, profile)), want, label + " " + mode + " seed " + seed);
      }
    }
  }
});

test("name sort ignores the profile", () => {
  const a = mk("a", { name: "Beta", min_age: 14, max_age: 17 }), b = mk("b", { name: "Alpha" });
  assert.deepEqual(ids(L.sortList([a, b], "name", NOW, { age: 15 })), ["b", "a"]);
});

test("(f) find.html: the first 20 cards match sortList, and no fee-based card sits above a non-fee card of the same status", async () => {
  const { document, errors } = await loadPage("find.html", { now: NOW.getTime() });
  const cards = [...document.querySelectorAll("#out article.prog")];
  assert.ok(cards.length >= 20, "need 20 cards, got " + cards.length);
  const shown = cards.slice(0, 20).map((c) => c.id.replace(/^p-/, ""));
  const want = ids(L.sortList(DATA, "best", NOW)).slice(0, 20);
  assert.deepEqual(shown, want);

  // Fee-based programs due within 21 days are allowed to lead (the deadline bucket comes first on purpose),
  // so only fee-based cards with a later or no deadline must stay below every non-fee card of the same status.
  const sorted = L.sortList(DATA, "best", NOW);
  const page = sorted.slice(0, cards.length);
  const fee = (e) => e.paid_type === "fee-based";
  const soon = (e) => { const d = L.futureDeadline(e, NOW); return !!d && L.daysUntil(d, NOW) <= 21; };
  page.forEach((e, i) => {
    if (!fee(e) || soon(e)) return;
    const status = L.effStatus(e, NOW);
    const later = page.slice(i + 1).find((o) => !fee(o) && L.effStatus(o, NOW) === status);
    assert.equal(later, undefined, "fee-based " + e.id + " at " + (i + 1) + " is above " + (later && later.id));
  });
  assert.deepEqual(errors, []);
});
