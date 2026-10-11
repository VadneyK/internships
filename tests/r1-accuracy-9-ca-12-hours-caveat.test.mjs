// r1-accuracy-9: the California 12 hours row in data/permits.json must carry the
// same caveat as src/rules.html, so a 12 year old babysitter is not told the
// row bans evening work. It must say the row is for the few jobs allowed at
// that age and point to the Labor Commissioner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("permits.json ca.hours[12] carries the few-jobs caveat", () => {
  const data = JSON.parse(readFileSync(join(root, "data/permits.json"), "utf8"));
  const text = data.states.ca.hours["12"];
  assert.ok(text.includes("few jobs allowed at that age"), `caveat missing: ${text}`);
  assert.ok(text.includes("833-526-4636"), "Labor Commissioner number missing");
  assert.ok(text.includes("Only between 7 a.m. and 7 p.m."), "original sentence changed");
  assert.ok(!/[\u2013\u2014]/.test(text), "dash character in hours text");
});
