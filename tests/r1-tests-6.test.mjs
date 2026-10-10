// Edge cases for paycheck and hoursCheck. Run with: node --test tests/r1-tests-6.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const M = JSON.parse(fs.readFileSync(new URL("../data/money.json", import.meta.url), "utf8"));
const PM = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const CA = PM.states.ca.limits;
const NY = PM.states.ny.limits;

const toCents = (x) => Math.round(x * 100);
const twoDecimals = (x) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
function rng(seed) { // small seeded generator so the "random" cases are the same every run
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function allNumbers(r) {
  const v = [r.gross, r.left];
  r.lines.forEach((l) => v.push(l.amount));
  if (r.possibleDisability != null) v.push(r.possibleDisability);
  return v;
}
const week = (...d) => { const a = [null, null, null, null, null, null, null]; d.forEach(([i, f, t]) => { a[i] = { from: f, to: t }; }); return a; };

test("paycheck: unknown preset, empty, null, negative and NaN input all return null", () => {
  assert.equal(L.paycheck(M, "nope", 15, 10), null);
  assert.equal(L.paycheck(M, "", 15, 10), null);
  assert.equal(L.paycheck(M, undefined, 15, 10), null);
  for (const bad of ["", null, undefined, -1, -0.01, NaN, "abc"]) {
    assert.equal(L.paycheck(M, "ca", bad, 10), null, "wage " + String(bad));
    assert.equal(L.paycheck(M, "ca", 15, bad), null, "hours " + String(bad));
  }
});

test("paycheck: wage 0 or hours 0 gives gross 0 and left 0 for every preset", () => {
  for (const p of M.presets) {
    for (const [w, h] of [[0, 20], [15, 0], [0, 0], ["0", "0"]]) {
      const r = L.paycheck(M, p.id, w, h);
      assert.ok(r, p.id);
      assert.equal(r.gross, 0);
      assert.equal(r.left, 0);
      r.lines.forEach((l) => assert.equal(l.amount, 0));
    }
  }
});

test("paycheck: every preset gives left <= gross and no negative line", () => {
  for (const p of M.presets) {
    for (const [w, h] of [[p.wage, 10], [p.wage, 40], [p.wage, 0.25], [7.25, 3.5]]) {
      const r = L.paycheck(M, p.id, w, h);
      assert.ok(r, p.id);
      assert.ok(r.left <= r.gross, p.id + " left " + r.left + " gross " + r.gross);
      assert.ok(r.left >= 0, p.id);
      r.lines.forEach((l) => assert.ok(l.amount >= 0, p.id + " " + l.key));
      assert.equal(r.state, p.state);
    }
  }
});

test("paycheck: left is gross minus the lines to the cent for 100 seeded wage and hours pairs", () => {
  const rand = rng(20261009);
  for (let i = 0; i < 100; i++) {
    const wage = Math.round((5 + rand() * 45) * 100) / 100;
    const hours = Math.round(rand() * 60 * 4) / 4;
    for (const p of M.presets) {
      for (const parentBiz of [false, true]) {
        const r = L.paycheck(M, p.id, wage, hours, parentBiz);
        const sum = r.lines.reduce((s, l) => s + toCents(l.amount), 0);
        assert.equal(toCents(r.left), toCents(r.gross) - sum, `${p.id} ${wage} x ${hours} parentBiz ${parentBiz}`);
        allNumbers(r).forEach((n) => {
          assert.ok(Number.isFinite(n), "finite " + n);
          assert.ok(twoDecimals(n), "more than 2 decimals: " + n);
        });
      }
    }
  }
});

test("paycheck: string input from a form field works the same as numbers", () => {
  const a = L.paycheck(M, "ga", "7.25", "12");
  const b = L.paycheck(M, "ga", 7.25, 12);
  assert.deepEqual(a, b);
});

test("paycheck: parentBiz true removes the ss and medicare lines and raises take home", () => {
  for (const p of M.presets) {
    const normal = L.paycheck(M, p.id, p.wage, 20, false);
    const parent = L.paycheck(M, p.id, p.wage, 20, true);
    const keys = parent.lines.map((l) => l.key);
    assert.ok(!keys.includes("ss") && !keys.includes("medicare"), p.id);
    assert.ok(normal.lines.some((l) => l.key === "ss") && normal.lines.some((l) => l.key === "medicare"), p.id);
    assert.equal(parent.parentBiz, true);
    assert.equal(normal.parentBiz, false);
    assert.ok(parent.left > normal.left, p.id);
    assert.equal(parent.gross, normal.gross);
  }
});

test("paycheck: California adds an sdi line, other states do not", () => {
  const ca = L.paycheck(M, "ca", 16.9, 20);
  assert.ok(ca.lines.some((l) => l.key === "sdi"));
  assert.equal(ca.lines.find((l) => l.key === "sdi").amount, toCents(ca.gross * M.rates.sdi) / 100);
  for (const id of ["ga", "il-youth", "il-adult", "ny-up", "ny-nyc"]) {
    assert.ok(!L.paycheck(M, id, 15, 20).lines.some((l) => l.key === "sdi"), id);
  }
  assert.equal(ca.possibleDisability, undefined);
});

test("paycheck: New York presets add a pfl line and possibleDisability never above the weekly cap", () => {
  for (const id of ["ny-up", "ny-nyc"]) {
    for (const h of [1, 10, 24, 25, 40, 60]) {
      const r = L.paycheck(M, id, 17, h);
      assert.ok(r.lines.some((l) => l.key === "pfl"), id);
      assert.ok(!r.lines.some((l) => l.key === "sdi"), id);
      assert.ok(r.possibleDisability >= 0);
      assert.ok(r.possibleDisability <= M.rates.nyDisabilityWeekCap, id + " " + h);
    }
    // small pay stays under the cap, big pay is held at the cap
    const small = L.paycheck(M, id, 17, 2);
    assert.equal(small.possibleDisability, toCents(small.gross * M.rates.nyDisabilityRate) / 100);
    assert.ok(small.possibleDisability < M.rates.nyDisabilityWeekCap);
    assert.equal(L.paycheck(M, id, 17, 40).possibleDisability, M.rates.nyDisabilityWeekCap);
    // possibleDisability is not subtracted from left
    const big = L.paycheck(M, id, 17, 40);
    const sum = big.lines.reduce((s, l) => s + toCents(l.amount), 0);
    assert.equal(toCents(big.left), toCents(big.gross) - sum);
  }
  for (const id of ["ca", "ga", "il-youth", "il-adult"]) {
    assert.equal(L.paycheck(M, id, 15, 40).possibleDisability, undefined, id);
  }
});

test("hoursCheck: age 13 is not limited and has no problems", () => {
  const heavy = week([0, 0, 24], [1, 0, 24], [5, 4, 23]);
  for (const inSchool of [true, false]) {
    const r = L.hoursCheck(CA, 13, inSchool, heavy);
    assert.equal(r.limited, false);
    assert.deepEqual(r.problems, []);
    assert.equal(r.total, 24 + 24 + 19);
  }
});

// hoursCheck has no youth band at age 18 or older, so an adult is never checked against youth limits.
test("hoursCheck: age 18 is not limited and has no problems", () => {
  const heavy = week([0, 0, 24], [1, 0, 24], [5, 4, 23]);
  for (const inSchool of [true, false]) {
    const r = L.hoursCheck(CA, 18, inSchool, heavy);
    assert.equal(r.limited, false);
    assert.deepEqual(r.problems, []);
  }
});

test("hoursCheck: a day with from at or after to counts as 0 hours", () => {
  const r = L.hoursCheck(CA, 15, false, [
    { from: 10, to: 10 }, { from: 12, to: 9 }, { from: 8, to: 10 }, null, { from: null, to: 12 }, { from: 9, to: null }, { from: 0, to: 0 }
  ]);
  assert.deepEqual(r.perDay, [0, 0, 2, 0, 0, 0, 0]);
  assert.equal(r.total, 2);
  assert.deepEqual(r.problems, []);
});

test("hoursCheck: total equals the sum of perDay", () => {
  const rand = rng(77);
  for (let i = 0; i < 50; i++) {
    const days = [0, 1, 2, 3, 4, 5, 6].map(() => rand() < 0.3 ? null : { from: Math.floor(rand() * 20), to: Math.floor(rand() * 24) });
    for (const age of [13, 14, 15, 16, 17, 18]) {
      const r = L.hoursCheck(CA, age, rand() < 0.5, days);
      assert.equal(r.perDay.length, 7);
      assert.equal(r.total, r.perDay.reduce((s, h) => s + h, 0));
      r.perDay.forEach((h) => assert.ok(h >= 0));
    }
  }
});

test("hoursCheck: a school day over the limit names the day, a day off allows more", () => {
  const lim = CA["14"];
  const over = L.hoursCheck(CA, 14, true, week([2, 15, 15 + lim.schoolDay + 1]));
  assert.equal(over.limited, true);
  const hit = over.problems.filter((p) => p.startsWith("Wednesday"));
  assert.equal(hit.length, 1);
  assert.match(hit[0], /school day/);
  assert.match(hit[0], new RegExp("more than the " + lim.schoolDay + " hour limit"));
  // exactly at the limit is fine
  assert.deepEqual(L.hoursCheck(CA, 14, true, week([2, 15, 15 + lim.schoolDay])).problems, []);
  // the same hours on a Saturday are a day off, so only the non-school cap applies
  const sat = L.hoursCheck(CA, 14, true, week([5, 9, 9 + lim.schoolDay + 1]));
  assert.deepEqual(sat.problems, []);
  const satOver = L.hoursCheck(CA, 14, true, week([5, 8, 8 + lim.nonSchoolDay + 1]));
  assert.ok(satOver.problems.some((p) => p.startsWith("Saturday") && /day off/.test(p)));
  // with school out, a weekday uses the non-school cap
  assert.deepEqual(L.hoursCheck(CA, 14, false, week([2, 9, 9 + lim.schoolDay + 1])).problems, []);
});

test("hoursCheck: New York 16 treats Friday as a day off from school (weekdayOnly)", () => {
  const lim = NY["16"];
  assert.equal(lim.weekdayOnly, true);
  const fri = L.hoursCheck(NY, 16, true, week([4, 10, 10 + lim.schoolDay + 1]));
  assert.deepEqual(fri.problems.filter((p) => p.startsWith("Friday")), []);
  const thu = L.hoursCheck(NY, 16, true, week([3, 10, 10 + lim.schoolDay + 1]));
  assert.equal(thu.problems.filter((p) => p.startsWith("Thursday")).length, 1);
});

test("hoursCheck: a late shift and an early start each name the day", () => {
  const lim = CA["14"];
  const late = L.hoursCheck(CA, 14, true, week([1, lim.latest - 2, lim.latest + 1]));
  assert.ok(late.problems.some((p) => p.startsWith("Tuesday") && /working past 7 p\.m\./.test(p)), late.problems.join("|"));
  const early = L.hoursCheck(CA, 14, true, week([3, lim.earliest - 1, lim.earliest + 1]));
  assert.ok(early.problems.some((p) => p.startsWith("Thursday") && /before 7 a\.m\./.test(p)), early.problems.join("|"));
  // ending exactly at the latest hour is fine
  assert.deepEqual(L.hoursCheck(CA, 14, true, week([1, lim.latest - 2, lim.latest])).problems, []);
});

test("hoursCheck: inSchool false uses the summer latest hour when the state has one", () => {
  const lim = CA["14"];
  assert.ok(lim.latestSummer > lim.latest);
  const plan = week([0, lim.latest - 1, lim.latestSummer]);
  const school = L.hoursCheck(CA, 14, true, plan);
  assert.ok(school.problems.some((p) => p.startsWith("Monday") && /working past 7 p\.m\./.test(p)));
  assert.deepEqual(L.hoursCheck(CA, 14, false, plan).problems, []);
  const pastSummer = L.hoursCheck(CA, 14, false, week([0, lim.latestSummer - 2, lim.latestSummer + 1]));
  assert.ok(pastSummer.problems.some((p) => p.startsWith("Monday") && /working past 9 p\.m\./.test(p)));
  // a band with no summer hour keeps the regular latest hour even when school is out
  const sixteen = CA["16"];
  assert.equal(sixteen.latestSummer, null);
  const late16 = L.hoursCheck(CA, 16, false, week([0, sixteen.latest - 1, sixteen.latest + 1]));
  assert.ok(late16.problems.some((p) => p.startsWith("Monday") && /past 10 p\.m\./.test(p)));
});

test("hoursCheck: a week over the cap is flagged once and a null limits object is safe", () => {
  const lim = CA["14"];
  const days = [0, 1, 2, 3, 4, 5, 6].map(() => ({ from: 9, to: 15 }));
  const r = L.hoursCheck(CA, 14, false, days);
  assert.equal(r.total, 42);
  assert.equal(r.problems.filter((p) => p.startsWith("The week")).length, 1);
  assert.match(r.problems.find((p) => p.startsWith("The week")), new RegExp("more than the " + lim.offWeek + " hour limit"));
  const none = L.hoursCheck(null, 15, true, days);
  assert.equal(none.limited, false);
  assert.equal(none.total, 42);
});
