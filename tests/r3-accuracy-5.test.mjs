// Ticket r3-accuracy-5: the Get ready "Papers" line no longer says there is a required order.
// Run with: node --test tests/r3-accuracy-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("r3-accuracy-5: the label is 'Papers:' and the old order label is gone", () => {
  for (const file of ["src/ready.html", "ready.html"]) {
    const src = rd(file);
    assert.match(src, /<b>Papers:<\/b>/, file + " label");
    assert.doesNotMatch(src, /Papers, in order/, file + " must not keep the order label");
  }
});

test("r3-accuracy-5: the choice sentence is in the no-parent block", async () => {
  const { document, errors } = await loadPage("ready.html");
  assert.deepEqual(errors, []);
  const items = [...document.querySelectorAll("#no-parent li")].map((li) => li.textContent.trim());
  assert.match(items[1], /^Papers: You choose which acceptable documents to show\. A passport alone works \(see your papers\)\./);
});

test("r3-accuracy-5: the facts about birth certificate, Social Security card and state ID are kept", async () => {
  const { document } = await loadPage("ready.html");
  const text = document.querySelectorAll("#no-parent li")[1].textContent;
  assert.match(text, /A birth certificate, a Social Security card/);
  assert.match(text, /Social Security card/);
  assert.match(text, /replacement is free/);
  assert.match(text, /state ID/);
});

test("r3-accuracy-5: the Papers line adds no numbers and no dash characters", () => {
  for (const file of ["src/ready.html", "ready.html"]) {
    const line = rd(file).split("\n").find((l) => l.includes("<b>Papers:</b>"));
    assert.ok(line, file + " has the line");
    const text = line.replace(/<[^>]+>/g, "");
    assert.deepEqual(text.match(/\d+/g) || [], [], file + " numbers");
    assert.doesNotMatch(text, /[\u2013\u2014]/, file + " dash");
  }
});
