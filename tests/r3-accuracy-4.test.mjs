// Georgia $4.25 youth wage: the permit finder must keep "consecutive" and "optional",
// matching the Other states page (ticket r3-accuracy-4).
// Run with: node --test tests/r3-accuracy-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PERMITS = JSON.parse(fs.readFileSync(new URL("../data/permits.json", import.meta.url), "utf8"));
const STATES_HTML = fs.readFileSync(new URL("../src/states.html", import.meta.url), "utf8");
const gaWage = PERMITS.states.ga.wage;

test("permits.json Georgia wage says 90 consecutive days", () => {
  assert.ok(gaWage.includes("90 consecutive days"), gaWage);
});

test("permits.json Georgia wage says the youth rate is optional", () => {
  assert.ok(gaWage.includes("optional"), gaWage);
});

test("src/states.html Georgia pay says 90 consecutive days", () => {
  assert.ok(STATES_HTML.includes("90 consecutive days"));
});

test("src/states.html Georgia pay says the youth rate is optional", () => {
  assert.ok(STATES_HTML.includes("optional"));
});
