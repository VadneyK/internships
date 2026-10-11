// Edge and property tests for paycheck() and the cents() rounding it uses.
// cents() is private to lib.js, so it is tested through gross = cents(wage * 1 hour).
// Fixed gap (see the Infinity test below): Infinity wage or hours gives gross Infinity and left NaN.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const money = JSON.parse(readFileSync(new URL("../data/money.json", import.meta.url), "utf8"));

let seed = 20261010;
function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
const dec2 = (n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
const finiteResult = (r) => [r.gross, r.left, ...r.lines.map((l) => l.amount)].every(Number.isFinite);

test("zero hours or zero wage: zero gross, zero tax, no NaN", () => {
  for (const p of money.presets) for (const parent of [false, true]) {
    for (const [w, h] of [[0, 20], [15, 0], [0, 0]]) {
      const r = L.paycheck(money, p.id, w, h, parent);
      assert.equal(r.gross, 0); assert.equal(r.left, 0);
      assert.ok(r.lines.every((l) => l.amount === 0));
      assert.ok(finiteResult(r));
    }
  }
});

test("300 seeded inputs: net within 0..gross, 2 decimals, gross monotonic in hours and wage", () => {
  for (let i = 0; i < 300; i++) {
    const p = money.presets[Math.floor(rnd() * money.presets.length)];
    const w = Math.round(rnd() * 5000) / 100, h = Math.round(rnd() * 8000) / 100, parent = rnd() < 0.3;
    const r = L.paycheck(money, p.id, w, h, parent);
    assert.ok(finiteResult(r));
    assert.ok(r.left >= 0 && r.left <= r.gross, `net out of range for ${p.id} ${w} ${h}`);
    for (const n of [r.gross, r.left, ...r.lines.map((l) => l.amount)]) assert.ok(dec2(n), `bad decimals ${n}`);
    const moreH = L.paycheck(money, p.id, w, h + rnd() * 10, parent);
    const moreW = L.paycheck(money, p.id, w + rnd() * 10, h, parent);
    assert.ok(moreH.gross >= r.gross && moreW.gross >= r.gross);
  }
});

test("cents rounds half cases up and consistently", () => {
  const g = (w) => L.paycheck(money, "ga", w, 1).gross;
  assert.equal(g(0.005), 0.01);
  assert.equal(g(1.005), 1.01);
  assert.equal(g(2.675), 2.68);
  assert.equal(g(0.004), 0);
  assert.equal(g(0.014), 0.01);
  assert.equal(g(0.015), 0.02);
  assert.equal(L.paycheck(money, "ga", 7.25, 3.5).gross, 25.38);
});

test("odd input returns null or a safe finite result and never throws", () => {
  const bad = ["abc", "", null, undefined, NaN, -1, -0.01, "-5", {}, [], "1e12x"];
  for (const b of bad) {
    for (const [w, h] of [[b, 10], [10, b]]) {
      let r;
      assert.doesNotThrow(() => { r = L.paycheck(money, "ca", w, h); });
      assert.ok(r === null || (typeof r === "object" && finiteResult(r)), `unsafe for ${String(b)}`);
    }
  }
  assert.equal(L.paycheck(money, "nope", 10, 10), null);
  assert.equal(L.paycheck(money, "ca", -5, 10), null);
  assert.equal(L.paycheck(money, "ca", "-5", 10), null);
  assert.equal(L.paycheck(money, "ca", "abc", 10), null);
  assert.equal(L.paycheck(money, "ca", "10", "2").gross, 20);
  const big = L.paycheck(money, "ca", 1e12, 1e12);
  assert.ok(big === null || (Number.isFinite(big.gross) && big.left <= big.gross));
  const big2 = L.paycheck(money, "ny-nyc", 1e12, 1);
  assert.ok(finiteResult(big2) && big2.left <= big2.gross);
});

test("Infinity input does not throw", () => {
  assert.doesNotThrow(() => L.paycheck(money, "ca", Infinity, 10));
  assert.doesNotThrow(() => L.paycheck(money, "ca", 10, Infinity));
});

// Infinity used to pass the >= 0 check and gave NaN take-home. paycheck() now checks isFinite.
test("Infinity wage or hours returns null instead of NaN take-home", () => {
  assert.equal(L.paycheck(money, "ca", Infinity, 10), null);
  assert.equal(L.paycheck(money, "ca", 10, Infinity), null);
});

test("every state with a minimum wage returns a result at that wage", () => {
  const states = money.states.map((s) => s.id);
  assert.ok(states.length >= 1);
  for (const st of states) {
    const presets = money.presets.filter((p) => p.state === st);
    assert.ok(presets.length > 0, `no preset for ${st}`);
    for (const p of presets) {
      const r = L.paycheck(money, p.id, p.wage, 10);
      assert.ok(r && finiteResult(r), p.id);
      assert.equal(r.state, st);
      assert.ok(r.gross > 0 && r.left > 0 && r.left <= r.gross);
    }
  }
});
