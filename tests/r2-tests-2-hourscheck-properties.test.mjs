/*
  Property tests for hoursCheck (assets/js/lib.js) over every state in PERMIT_STATES and ages 12 to 18,
  using the real data/permits.json. A seeded PRNG makes every failure repeat.
  Bad input to hoursCheck (a null days list, words in a shift) is tested below and must not throw or give NaN.
*/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const permits = require("../data/permits.json");

const AGES = [12, 13, 14, 15, 16, 17, 18];
const bandOf = (a) => (a >= 18 ? "" : a >= 16 ? "16" : a >= 14 ? "14" : "");

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (str) => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

function randomWeek(rnd) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    if (rnd() < 0.4) { days.push(null); continue; }
    const from = Math.floor(rnd() * 48) / 2;
    const len = Math.floor(rnd() * 20) / 2;
    days.push({ from, to: Math.min(24, from + len) });
  }
  return days;
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const nullWeek = () => [null, null, null, null, null, null, null];

/* A problem string reduced to its day and kind, so "more hours" cannot look like a different problem. */
function kinds(out) {
  return new Set(out.problems.map((p) => {
    if (p.startsWith("The week")) return "week";
    const day = p.split(":")[0];
    return day + (/hour limit/.test(p) ? ":len" : /before/.test(p) ? ":early" : ":late");
  }));
}
function noNaN(out) {
  assert.ok(Number.isFinite(out.total), "total is finite: " + out.total);
  assert.ok(Array.isArray(out.perDay) && out.perDay.every(Number.isFinite), "perDay finite");
  assert.ok(Array.isArray(out.problems) && out.problems.every((p) => typeof p === "string" && !/NaN|undefined|null/.test(p)));
}

test("PERMIT_STATES all have limits objects in permits.json", () => {
  for (const st of L.PERMIT_STATES) assert.ok(permits.states[st] && "limits" in permits.states[st], st);
});

for (const st of L.PERMIT_STATES) {
  const limits = permits.states[st].limits;
  for (const inSchool of [true, false]) {
    test(`${st} inSchool=${inSchool}: empty week and one 1 hour shift in the window never report a problem`, () => {
      for (const age of AGES) {
        const empty = L.hoursCheck(limits, age, inSchool, nullWeek());
        assert.deepEqual(empty.problems, [], `${st} ${age} empty`);
        assert.equal(empty.total, 0);
        const lim = limits && limits[bandOf(age)];
        assert.equal(empty.limited, !!lim, `${st} ${age} limited flag`);
        const early = lim && lim.earliest != null ? lim.earliest : 0;
        const late = lim ? (!inSchool && lim.latestSummer != null ? lim.latestSummer : lim.latest) : null;
        const latest = late != null ? late : 24;
        for (const [from, to] of [[early, early + 1], [latest - 1, latest]]) {
          for (let d = 0; d < 7; d++) {
            const week = nullWeek();
            week[d] = { from, to };
            const out = L.hoursCheck(limits, age, inSchool, week);
            assert.deepEqual(out.problems, [], `${st} age ${age} day ${d} ${from}-${to}`);
            assert.equal(out.total, 1);
          }
        }
      }
    });

    test(`${st} inSchool=${inSchool}: 200 seeded random weeks are deterministic, pure, finite and monotonic`, () => {
      const rnd = mulberry32(seedOf(st + inSchool));
      for (let n = 0; n < 200; n++) {
        const age = AGES[Math.floor(rnd() * AGES.length)];
        const week = randomWeek(rnd);
        const before = clone(week), limBefore = clone(limits);
        const ctx = `${st} age ${age} #${n} ${JSON.stringify(week)}`;
        const a = L.hoursCheck(limits, age, inSchool, week);
        const b = L.hoursCheck(limits, age, inSchool, week);
        assert.deepEqual(a, b, "deterministic " + ctx);
        assert.deepEqual(week, before, "days not mutated " + ctx);
        assert.deepEqual(limits, limBefore, "limits not mutated " + ctx);
        noNaN(a);
        assert.equal(a.perDay.length, 7);
        if (!a.limited) assert.deepEqual(a.problems, [], "unlimited band has no problems " + ctx);

        /* Add hours: widen one day later (to up) or earlier (from down), or add a shift on an empty day. */
        const day = Math.floor(rnd() * 7), more = clone(week);
        const d = more[day];
        if (!d) more[day] = { from: 9 + Math.floor(rnd() * 8), to: 17 + Math.floor(rnd() * 7) };
        else if (rnd() < 0.5) d.to = Math.min(24, d.to + 1 + Math.floor(rnd() * 8));
        else d.from = Math.max(0, d.from - 1 - Math.floor(rnd() * 8));
        const c = L.hoursCheck(limits, age, inSchool, more);
        const ka = kinds(a), kc = kinds(c);
        for (const k of ka) assert.ok(kc.has(k), `adding hours removed ${k}: ${ctx}`);
        assert.ok(c.problems.length >= a.problems.length, "problem count never drops " + ctx);
        assert.ok(c.total >= a.total, "total never drops " + ctx);
      }
    });
  }
}

test("malformed days that hoursCheck handles never throw or give NaN", () => {
  const limits = permits.states.ca.limits;
  const cases = {
    "empty list": [],
    "too short": [{ from: 9, to: 12 }],
    "too long": Array.from({ length: 12 }, () => ({ from: 9, to: 12 })),
    "null items": [null, undefined, null],
    "empty objects": [{}, { from: null }, { to: 5 }],
    "from after to (overnight)": [{ from: 20, to: 6 }, { from: 22, to: 2 }],
    "from equals to": [{ from: 10, to: 10 }],
    "negative": [{ from: -3, to: 5 }, { from: -9, to: -1 }],
    "over 24": [{ from: 5, to: 30 }, { from: 25, to: 99 }],
    "numeric strings": [{ from: "9", to: "12" }],
  };
  for (const [name, days] of Object.entries(cases)) {
    for (const age of [11, 12, 14, 15, 16, 17, 18, 19]) {
      for (const inSchool of [true, false]) {
        const before = structuredClone(days);
        let out;
        assert.doesNotThrow(() => { out = L.hoursCheck(limits, age, inSchool, days); }, `${name} age ${age}`);
        noNaN(out);
        assert.deepEqual(out, L.hoursCheck(limits, age, inSchool, days), "deterministic " + name);
        assert.deepEqual(days, before, "not mutated " + name);
      }
    }
  }
  /* An overnight span or from equal to to counts as zero hours, so it cannot be checked. Pinned so a change is noticed. */
  const o = L.hoursCheck(limits, 15, true, [{ from: 20, to: 6 }, { from: 10, to: 10 }]);
  assert.deepEqual(o.perDay, [0, 0]);
  assert.deepEqual(o.problems, []);
});

test("shape for ages outside the bands and for missing limits", () => {
  const week = [{ from: 3, to: 23 }, null, null, null, null, null, null];
  const unlimited = { total: 20, perDay: [20, 0, 0, 0, 0, 0, 0], problems: [], limited: false };
  const ca = permits.states.ca.limits;
  for (const age of [11, 0, 12, 13, 18, 19, 40, NaN, null, undefined, "x", -4]) {
    for (const inSchool of [true, false]) assert.deepEqual(L.hoursCheck(ca, age, inSchool, week), unlimited, "age " + age);
  }
  for (const lim of [null, undefined, {}, { 14: null, 16: null }, permits.states.bc.limits, permits.states.ga.limits]) {
    const age = lim === permits.states.ga.limits ? 16 : 15;
    assert.deepEqual(L.hoursCheck(lim, age, true, week), unlimited);
  }
  assert.equal(L.hoursCheck(ca, "15", true, week).limited, true, "numeric string age works");
  assert.ok(L.hoursCheck(ca, 15, true, week).problems.length > 0);
});

/* Bad input is treated as an empty week. */
test("null or missing days list does not throw", () => {
  for (const bad of [null, undefined, "x", 5, {}]) assert.doesNotThrow(() => L.hoursCheck(permits.states.ca.limits, 15, true, bad));
});
test("words in a shift never give NaN", () => {
  noNaN(L.hoursCheck(permits.states.ca.limits, 15, true, [{ from: "a", to: "b" }, { from: NaN, to: 5 }, { from: 1, to: Infinity }]));
});
