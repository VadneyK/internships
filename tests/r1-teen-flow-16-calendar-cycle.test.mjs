// Ticket r1-teen-flow-7 (calendar): a small note under "Applications open" says the months come from the last cycle.
// Run with: node --test tests/r1-teen-flow-16-calendar-cycle.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const NOTE = "Some of these months come from the last application round. Check the program's own page for this year.";
const LONG_DASHES = /[\u2013\u2014]/;

test("calendar cycle note: sits right under the Applications open heading and is visible in a busy month", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" });
  await tick(200);
  const { document, errors } = p;
  assert.deepEqual(errors, []);
  const heading = document.getElementById("hOpen");
  assert.equal(heading.textContent.trim(), "Applications open");
  assert.equal(heading.hidden, false, "February has programs that open, so the heading shows");
  const note = document.getElementById("cOpenNote");
  assert.ok(note, "the note exists");
  assert.equal(note.hidden, false, "the note is not hidden");
  assert.equal(note.textContent.trim(), NOTE);
  assert.equal(note.previousElementSibling, heading, "the note comes directly after the heading");
  assert.equal(note.nextElementSibling, document.getElementById("cOpen"), "the note comes directly before the open list");
});

test("calendar cycle note: the note says the same thing as the page description", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" });
  await tick(200);
  const desc = p.document.querySelector('meta[name="description"]').getAttribute("content");
  assert.match(desc, /mostly describe the last application round/);
  assert.match(p.document.getElementById("cOpenNote").textContent, /last application round/);
});

test("calendar cycle note: the source template and built page both carry the note, with no long dashes", () => {
  for (const file of ["src/calendar.html", "calendar.html", "tests/r1-teen-flow-16-calendar-cycle.test.mjs"]) {
    const text = fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
    assert.equal(LONG_DASHES.test(text), false, file + " has no en or em dash");
  }
  for (const file of ["src/calendar.html", "calendar.html"]) {
    const html = fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
    assert.equal(html.includes(NOTE), true, file + " has the note");
  }
});
