// Rules page driving line marks the federal rule and the California gap (ticket r2-accuracy-6).
// Run with: node --test tests/r2-accuracy-6-rules-driving-caveat.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const CLAUSE = "driving as a job (federal rule: not allowed under 17; at 17, only under strict federal conditions. We did not read California&rsquo;s own driving rules, so ask the Labor Commissioner at 833-526-4636), operating forklifts";

for (const page of ["src/rules.html", "rules.html"]) {
  test(`${page} labels the driving rule as federal and names the California gap`, () => {
    const html = read(page);
    assert.ok(html.includes(CLAUSE), `${page} is missing the driving clause`);
    assert.equal(html.includes("(not allowed under 17; at 17, only under strict federal conditions), operating forklifts"), false, `${page} still states the federal rule as the whole California rule`);
  });
}

test("the Labor Commissioner number on the Rules page is the one used elsewhere in the repo", () => {
  assert.ok(read("src/ready.html").includes("833-526-4636"));
  assert.ok(read("src/rules.html").includes("833-526-4636"));
});

test("transit.json names the same California gap the Rules page now states", () => {
  const transit = JSON.parse(read("data/transit.json"));
  assert.ok(transit.driving.text.includes("Your state may be stricter"));
  assert.ok(transit.gaps.some((g) => g.includes("California") && g.includes("driving")));
});
