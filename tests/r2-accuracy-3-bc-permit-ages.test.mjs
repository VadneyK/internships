// BC allows ages 12 and 13 to work with a permit or light work, so the finder must not say jobs start at 14.
// Run with: node --test tests/r2-accuracy-3-bc-permit-ages.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
globalThis.self = globalThis;
const L = createRequire(import.meta.url)("../assets/js/lib.js");
const permits = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));

test("BC ages 12 and 13 get ask, not young, and the text mentions light work", () => {
  for (const age of [12, 13]) {
    const r = L.permitFor(permits, "bc", age, "job");
    assert.equal(r.verdict, "ask", "age " + age);
    assert.ok(/light work/i.test(r.text), r.text);
    assert.ok(r.hours.includes("Children under 15"), "hours at " + age);
  }
});

test("BC ages 14 and 15 are unchanged", () => {
  for (const age of [14, 15]) {
    const r = L.permitFor(permits, "bc", age, "job");
    assert.equal(r.verdict, "ask");
    assert.ok(r.hours.includes("Children under 15"));
  }
});

test("other states still say young under 14", () => {
  const r = L.permitFor(permits, "ca", 13, "job");
  assert.equal(r.verdict, "young");
  assert.equal(r.headline, "Most paid jobs start at 14");
});
