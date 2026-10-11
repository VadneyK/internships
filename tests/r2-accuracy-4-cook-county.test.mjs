// Cook County's $15.40 rate for workers 18 and older is stated in the Illinois notes (ticket r2-accuracy-4).
// Run with: node --test tests/r2-accuracy-4-cook-county.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const states = read("src/states.html");
const money = JSON.parse(read("data/money.json"));
const parents = JSON.parse(read("data/parents.json"));

// Collect every string value in a JSON tree.
const allStrings = (node, out = []) => {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => allStrings(n, out));
  else if (node && typeof node === "object") Object.values(node).forEach((v) => allStrings(v, out));
  return out;
};

test("money.json gaps say Cook County outside Chicago is $15.40 and the estimate uses $15.00", () => {
  const gap = money.gaps.find((g) => g.startsWith("Cook County outside Chicago is $15.40"));
  assert.ok(gap, "gaps has the Cook County line");
  assert.ok(gap.includes("15.40"), gap);
  assert.ok(gap.includes("workers 18 and older"), gap);
  assert.ok(gap.includes("This estimate uses the state rate of $15.00"), gap);
});

test("parents.json points to states.html#other for Cook County and does not repeat the rate", () => {
  const all = allStrings(parents);
  assert.ok(!all.some((s) => s.includes("15.40")), "parents.json must not repeat $15.40");
  const pointer = (parents.money?.pay || []).find((s) => s.p === "states.html#other");
  assert.ok(pointer, "parents.json pay has a states.html#other statement");
  assert.ok(pointer.t.includes("Cook County outside Chicago"), pointer.t);
});

test("states.html still says Cook County outside Chicago is $15.40", () => {
  assert.match(states, /Cook County<\/b> outside Chicago: \$15\.40/);
});
