// Ticket r9-teen-flow-6: Get ready no-offer line also links to the calendar with plain words.
// Run with: node --test tests/r9-teen-flow-6-ready-calendar-link.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

test("r9-teen-flow-6: #readyNoYes links to find, jobs, playbook and calendar, in that paragraph", async () => {
  const { document, errors } = await loadPage("ready.html");
  const note = document.getElementById("readyNoYes");
  assert.ok(note, "readyNoYes exists");
  assert.equal(note.tagName, "P", "readyNoYes is a paragraph");
  const hrefs = [...note.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  for (const h of ["find.html", "jobs.html", "playbook.html", "calendar.html"]) {
    assert.ok(hrefs.includes(h), "no-offer line should link to " + h);
  }
  assert.deepEqual(errors, []);
});

test("r9-teen-flow-6: the calendar link uses plain words", async () => {
  const { document } = await loadPage("ready.html");
  const link = document.querySelector('#readyNoYes a[href="calendar.html"]');
  assert.ok(link, "calendar link exists in the no-offer line");
  assert.match(link.textContent.trim(), /see what opens when/i);
});

test("r9-teen-flow-6: the no-offer paragraph stays one short sentence group under 40 words", async () => {
  const { document } = await loadPage("ready.html");
  const note = document.getElementById("readyNoYes");
  const text = note.textContent.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  assert.ok(words < 40, "no-offer line is " + words + " words, want under 40");
  assert.ok(text.endsWith("."), "the line ends as one sentence group with a period");
});
