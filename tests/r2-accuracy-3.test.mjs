// Find and Home pages: no blanket "all dates are for 2026 to 2027" claim and no "real deadlines" promise (ticket r2-accuracy-3).
// Run with: node --test tests/r2-accuracy-3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

for (const page of ["find.html", "index.html"]) {
  test(`${page} does not claim every date is for the 2026 to 2027 school year`, () => {
    assert.equal(read(page).includes("Dates are for the 2026 to 2027 school year"), false);
  });

  test(`${page} does not promise real deadlines`, () => {
    assert.equal(read(page).includes("real deadlines"), false);
  });
}

test("find.html explains the Based on last year tag", () => {
  assert.ok(read("find.html").includes("Based on last year"));
});

test("index.html says the deadlines are the ones we could confirm", () => {
  assert.ok(read("index.html").includes("with the deadlines we could confirm"));
});
