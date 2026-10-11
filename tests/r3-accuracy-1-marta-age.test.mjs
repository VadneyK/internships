// Ticket r3-accuracy-1: the Atlanta MARTA "who" line must match the MARTA fares page
// ("Children 46 inches and under"), not an invented age 13 rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = fs.readFileSync(path.join(ROOT, "data", "transit.json"), "utf8");
const transit = JSON.parse(raw);
const atlanta = transit.places.find((p) => p.id === "atlanta");

test("Atlanta who line uses the 46 inch child rule", () => {
  assert.ok(atlanta, "atlanta place exists");
  assert.match(atlanta.who, /46 inches/);
  assert.doesNotMatch(atlanta.who, /13 and up/);
});

test("transit.json no longer contains the invented 13 and up rule", () => {
  assert.equal(raw.includes("13 and up"), false);
});
