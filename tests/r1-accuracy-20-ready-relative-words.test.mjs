// Ticket r1-accuracy-7: Get ready does not use "has more chances than" (the Boston finding
// counts applications, it does not show more offers) and does not use "ran this year"
// (a moving word); the VTA pass is a dated fact instead.
// Run with: node --test tests/r1-accuracy-20-ready-relative-words.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../src/ready.html", import.meta.url), "utf8");

test("r1-accuracy-7: ready.html does not claim broad applying gives more chances", () => {
  assert.doesNotMatch(src, /has more chances than/);
  assert.match(src, /If a program lets you apply to several jobs or sites, you can\./);
});

test("r1-accuracy-7: the VTA pass is dated, not 'ran this year'", () => {
  assert.doesNotMatch(src, /ran this year/);
  assert.match(src, /ran in 2026 \(read Oct 10, 2026\)/);
});
