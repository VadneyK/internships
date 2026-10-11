// Ticket r1-tests-5: property checks for ageText, relaxOptions, topPicks and planSummary on the real entries.json.
// Seeded random filter states, dates and plan lists. A failure prints the seed and the case.
// Run with: node --test tests/r1-tests-5-text-and-suggestion-properties.test.mjs
// Note: "dash" here means the em dash and en dash. A plain hyphen in grade text like "10-12" is real source wording.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

const SEED = 20261010;
const NOW = new Date(2026, 9, 10).getTime();
const DAY = 86400000;
const BAD_DASH = new RegExp("[" + [0x2012, 0x2013, 0x2014, 0x2015, 0x2212].map((c) => String.fromCharCode(c)).join("") + "]");

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function pickSome(r, arr) {
  const out = arr.filter(() => r() < 0.4);
  return out.length ? out : [pick(r, arr)];
}
const WORDS = ["art", "science", "paid", "camp", "health", "coding", "teen", "museum", "zzqx"];
const DIMS = [
  (r) => ({ place: pick(r, [...L.CITIES.map((c) => "city:" + c[0]), ...L.AREAS.map((a) => "area:" + a[0])]) }),
  (r) => ({ hubs: pickSome(r, L.HUBS.map((h) => h[0])) }),
  (r) => ({ age: 12 + Math.floor(r() * 7) }),
  (r) => ({ when: pick(r, ["open", "60", "anytime", "closed"]) }),
  (r) => ({ season: pick(r, ["summer", "fall", "winter", "spring"]) }),
  (r) => ({ paid: pickSome(r, L.PAID_GROUPS.map((g) => g[0])) }),
  (r) => ({ types: pickSome(r, Object.keys(L.TYPES)) }),
  (r) => ({ fields: pickSome(r, Object.keys(L.FIELDS).filter((k) => k !== "any")) }),
  () => ({ verified: true }),
  () => ({ noPermit: true }),
  (r) => ({ q: pick(r, WORDS) })
];
function randomState(r, density) {
  const s = {};
  DIMS.forEach((d) => { if (r() < density) Object.assign(s, d(r)); });
  return s;
}
const nowFor = (r) => NOW + Math.floor((r() - 0.3) * 400) * DAY;
const count = (list, s, now) => list.filter((e) => L.matches(e, s, now)).length;
const ids = (l) => l.map((e) => e.id);
function guarded(label, fn) {
  try { fn(); } catch (err) { err.message = "seed " + SEED + ", " + label + "\n" + err.message; throw err; }
}

test("r1-tests-5 seed " + SEED + ": ageText of every real card is clean text", () => {
  assert.ok(ENTRIES.length > 1000);
  ENTRIES.forEach((e) => {
    const t = L.ageText(e);
    assert.equal(typeof t, "string", e.id);
    assert.ok(t.trim().length > 0, "empty age text for " + e.id);
    assert.ok(!/null|undefined|NaN/.test(t), "bad word in age text for " + e.id + ": " + t);
    assert.ok(!BAD_DASH.test(t), "dash in age text for " + e.id + ": " + t);
  });
});

test("r1-tests-5 seed " + SEED + ": ageText on odd shapes stays clean", () => {
  const r = mulberry32(SEED + 1);
  for (let i = 0; i < 300; i++) {
    const e = {};
    if (r() < 0.5) e.min_age = pick(r, [null, undefined, 0, 12, 16]);
    if (r() < 0.5) e.max_age = pick(r, [null, undefined, 14, 18, 21]);
    if (r() < 0.4) e.grades = pick(r, [null, undefined, "", "9 to 12", "10-12"]);
    const t = L.ageText(e);
    guarded("case " + i + " " + JSON.stringify(e), () => {
      assert.ok(t.length > 0 && !/null|undefined|NaN/.test(t) && !BAD_DASH.test(t), t);
    });
  }
});

test("r1-tests-5 seed " + SEED + ": every relaxOptions suggestion adds matches and removes only its own filter", () => {
  const r = mulberry32(SEED + 2);
  let withOptions = 0, zeroStates = 0;
  for (let i = 0; i < 300; i++) {
    const state = randomState(r, i % 2 ? 0.45 : 0.25), now = nowFor(r);
    const snap = JSON.stringify(state);
    const opts = L.relaxOptions(ENTRIES, state, now);
    guarded("state #" + i + " " + snap, () => {
      assert.equal(JSON.stringify(state), snap, "relaxOptions changed the state");
      assert.ok(opts.length <= 3);
      assert.equal(new Set(opts.map((o) => o.key)).size, opts.length, "same filter offered twice");
      const before = count(ENTRIES, state, now);
      if (before === 0) zeroStates++;
      if (opts.length) withOptions++;
      opts.forEach((o) => {
        assert.ok(typeof o.label === "string" && o.label.length && !/null|undefined|NaN/.test(o.label) && !BAD_DASH.test(o.label), o.label);
        const v = state[o.key];
        assert.ok(Array.isArray(v) ? v.length : v, "offered to remove a filter that was not chosen: " + o.key);
        // Apply it the way the page does: clear that one filter, widen a small place search to online programs.
        const applied = Object.assign({}, state, { placeOnline: false });
        applied[o.key] = Array.isArray(v) ? [] : typeof v === "boolean" ? false : "";
        let n = count(ENTRIES, applied, now);
        if (applied.place && n < 3) { applied.placeOnline = true; n = count(ENTRIES, applied, now); }
        assert.equal(o.count, n, "reported count does not match the real count for " + o.key);
        assert.ok(n > 0);
        // Strictly more is promised where the help shows: when nothing matches. Otherwise never fewer.
        if (before === 0) assert.ok(n > before, "no new matches for " + o.key);
        else assert.ok(n >= before, "fewer matches after removing " + o.key);
        Object.keys(state).forEach((k) => {
          if (k === o.key || k === "placeOnline") return;
          assert.deepEqual(applied[k], state[k], "removed a filter that was not offered: " + k);
        });
      });
    });
  }
  assert.ok(withOptions > 20 && zeroStates > 20, "generator too weak: " + withOptions + " with options, " + zeroStates + " empty");
});

test("r1-tests-5 seed " + SEED + ": topPicks is a short, duplicate-free, stable subset of its input", () => {
  const r = mulberry32(SEED + 3);
  let nonEmpty = 0;
  for (let i = 0; i < 200; i++) {
    const state = randomState(r, 0.2), now = nowFor(r);
    const list = ENTRIES.filter((e) => L.matches(e, state, now));
    const profile = r() < 0.5 ? { age: 12 + Math.floor(r() * 7) } : r() < 0.5 ? {} : undefined;
    const n = pick(r, [undefined, undefined, 0, 1, 3, 5, 10]);
    const snap = JSON.stringify(list);
    guarded("state #" + i + " " + JSON.stringify(state) + " profile " + JSON.stringify(profile) + " n " + n, () => {
      const out = L.topPicks(list, profile, now, n);
      const cap = n == null ? 3 : n;
      assert.ok(out.length <= cap, "more than " + cap);
      assert.equal(new Set(ids(out)).size, out.length, "duplicate id");
      const have = new Set(ids(list));
      out.forEach((e) => assert.ok(have.has(e.id), "not in the input: " + e.id));
      assert.ok(out.every((e) => e.paid_type !== "fee-based"), "fee-based pick");
      if (profile && profile.age) out.forEach((e) => assert.ok(L.ageOk(e, profile.age) && (e.min_age != null || e.max_age != null), "age does not fit: " + e.id));
      assert.deepEqual(ids(L.topPicks(list, profile, now, n)), ids(out), "not stable for the same input");
      assert.equal(JSON.stringify(list), snap, "changed the input");
      if (out.length) nonEmpty++;
    });
  }
  assert.ok(nonEmpty > 50, "generator too weak: " + nonEmpty);
  assert.deepEqual(L.topPicks([], {}, NOW), []);
  assert.deepEqual(L.topPicks(null, null, NOW), []);
});

test("r1-tests-5 seed " + SEED + ": planSummary never throws, counts match, junk and unknown ids are ignored", () => {
  const r = mulberry32(SEED + 4);
  const real = ENTRIES.map((e) => e.id), pad = (n) => (n < 10 ? "0" : "") + n;
  const isoNear = (now) => { const d = new Date(now + Math.floor((r() - 0.5) * 60) * DAY); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  for (let i = 0; i < 300; i++) {
    const now = nowFor(r), today = new Date(now); today.setHours(0, 0, 0, 0);
    const todayISO = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());
    const people = [];
    const len = Math.floor(r() * 12);
    for (let k = 0; k < len; k++) {
      const kind = r();
      if (kind < 0.12) people.push(pick(r, [null, undefined, {}]));
      else if (kind < 0.24) people.push({ n: pick(r, ["", "   ", "\t"]), s: pick(r, ["", "sent"]), d: isoNear(now) });
      else people.push({
        n: pick(r, [pick(r, real), "unknown-id-" + k, "  " + pick(r, real) + "  "]),
        s: pick(r, ["", "sent", "replied", "meeting", "thanked"]),
        d: pick(r, ["", isoNear(now), isoNear(now)])
      });
    }
    guarded("case #" + i + " " + JSON.stringify(people), () => {
      const copy = JSON.stringify(people);
      const out = L.planSummary(people, now);
      assert.equal(JSON.stringify(people), copy, "changed the input");
      const named = people.filter((p) => p && p.n && p.n.trim());
      assert.equal(out.named, named.length);
      assert.equal(out.sent, named.filter((p) => p.s).length);
      assert.ok(out.sent <= out.named);
      const dueList = named.filter((p) => p.s === "sent" && p.d).map((p) => ({ name: p.n.trim(), date: L.addDays(p.d, 7) }))
        .filter((x) => x.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      if (!dueList.length) assert.equal(out.next, null);
      else {
        assert.equal(out.next.date, dueList[0].date);
        assert.equal(out.next.due, dueList[0].date <= todayISO);
        assert.ok(dueList.some((x) => x.date === out.next.date && x.name === out.next.name));
      }
      // A person with a blank name never counts, whatever their status.
      assert.equal(L.planSummary(people.concat([{ n: " ", s: "sent", d: todayISO }]), now).named, out.named);
    });
  }
  assert.deepEqual(L.planSummary([], NOW), { named: 0, sent: 0, next: null });
});
