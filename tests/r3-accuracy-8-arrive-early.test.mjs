// Arrive-early wording: ready.html and playbook.html give one sourced range or an honest "our suggestion" label.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("ready.html first day points to the sourced interview range instead of a flat 'ten minutes'", () => {
  const html = read("src/ready.html");
  assert.ok(html.includes("Arrive a few minutes early. For an interview our sources say 5 to 10 minutes or more, see <a href=\"interview.html\">Apply and interview</a>."), "first-day line changed");
  assert.ok(!html.includes("Arrive ten minutes early"), "old flat line still present");
});

test("playbook.html labels the five-minute tip as our suggestion, not a source", () => {
  const html = read("src/playbook.html");
  assert.ok(html.includes("Arrive about five minutes early for a chat with an adult. This is our suggestion, not from a source."), "playbook line changed");
  assert.ok(!html.includes("Arrive five minutes early."), "old flat line still present");
});

test("the two edited pages have no em dash or en dash", () => {
  for (const p of ["src/ready.html", "src/playbook.html"]) {
    assert.ok(!/[\u2013\u2014]/.test(read(p)), `${p} has a long dash`);
  }
});
