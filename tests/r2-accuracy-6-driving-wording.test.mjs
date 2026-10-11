// Driving as a job wording on the Rules page matches the Get ready and Safe at work pages (ticket r2-accuracy-6).
// Run with: node --test tests/r2-accuracy-6-driving-wording.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// Updated 2026-10-10 to match the Rules page after it was checked against DOL Fact Sheet 34: not allowed under 17, and at 17 only under strict federal conditions. This is still not an absolute ban at 17.
const SENTENCE = "driving as a job (not allowed under 17; at 17, only under strict federal conditions), operating forklifts";

for (const page of ["src/rules.html", "rules.html"]) {
  test(`${page} says driving as a job is generally off limits, not an absolute ban`, () => {
    const html = read(page);
    assert.ok(html.includes(SENTENCE), `${page} is missing the driving sentence`);
    assert.equal(html.includes("driving as part of the job,"), false, `${page} still states the absolute ban`);
    // The 17 year old exception sits in the same parenthesis as "driving as a job".
    assert.match(html, /driving as a job \(not allowed under 17; at 17, only under/);
  });
}

test("transit.json driving text keeps the limited, occasional driving exception at 17", () => {
  const transit = JSON.parse(read("data/transit.json"));
  assert.ok(transit.driving.text.includes("limited, occasional driving"));
});
