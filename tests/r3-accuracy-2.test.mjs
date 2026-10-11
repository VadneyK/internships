// r3-accuracy-2: the Ages 12 to 14 ladder step for 12 to 13 keeps the New York
// babysitter caveat and the "some states did not say" note beside the grid.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPage, tick } from "./dom-helper.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const younger = JSON.parse(readFileSync(join(root, "data", "younger.json"), "utf8"));

const CAVEAT = "Check your state in the grid first. New York says a babysitter must be at least 14, and some states did not say.";

test("younger.json: the 12 to 13 ladder step keeps its text and adds the state-grid caveat", () => {
  const step = younger.ladder.find((x) => x.age === "12 to 13");
  assert.ok(step, "12 to 13 ladder step exists");
  assert.equal(step.t, "Odd jobs for people you know");
  assert.match(step.d, /^Use the grid above for your state\. Family and neighbors first, with a parent who knows the details\. /);
  assert.ok(step.d.endsWith(CAVEAT), "caveat is the last sentence of the step");
  assert.doesNotMatch(step.d, /[\u2013\u2014]/, "no en dash or em dash");
});

test("younger page: the 12 to 13 ladder step shows the caveat and loads with no console error", async () => {
  const p = await loadPage("younger.html");
  await tick(200);
  assert.deepEqual(p.errors, []);
  const items = [...p.document.querySelectorAll("#ladderL li")];
  const step = items.find((li) => li.textContent.includes("Odd jobs for people you know"));
  assert.ok(step, "12 to 13 step is rendered");
  assert.ok(step.textContent.includes(CAVEAT), "rendered step includes the caveat");
});
