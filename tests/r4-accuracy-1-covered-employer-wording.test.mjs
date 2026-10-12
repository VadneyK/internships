// Wage and hours pages must not claim how many employers federal law covers.
// The only source says "employers covered by federal law" (ticket r2-accuracy-1).
// Run with: node --test tests/r4-accuracy-1-covered-employer-wording.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const BANNED = ["nearly every employer", "few employers federal", "At most employers"];
const dir = new URL("../src/", import.meta.url);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => ["src/" + f, fs.readFileSync(new URL(f, dir), "utf8")]);
files.push(["data/permits.json", fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8")]);

for (const [name, text] of files) {
  test(name + " has no stronger-than-source employer coverage wording", () => {
    for (const b of BANNED) assert.ok(!text.includes(b), name + " contains: " + b);
  });
}
