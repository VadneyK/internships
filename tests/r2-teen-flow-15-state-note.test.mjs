// Ticket r2-state-note-1: Get ready and Your first paycheck say near the top that most examples are
// from California, point to the state notes, and name the British Columbia difference.
// Run with: node --test tests/r2-teen-flow-15-state-note.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const SENTENCE = "Most examples here are from California. Georgia, New York, Illinois and other states have their own notes: pick your state first. In British Columbia the rules differ: see the British Columbia work permit answer.";

for (const [page, id] of [["ready.html", "readyStateNote"], ["paycheck.html", "payStateNote"]]) {
  test(`r2-state-note-1: ${page} has the state and BC note as one plain line with the exact words`, async () => {
    const { document, errors } = await loadPage(page);
    assert.deepEqual(errors, []);
    const note = document.getElementById(id);
    assert.ok(note, `${page} has #${id}`);
    assert.equal(note.tagName, "P");
    assert.equal(note.textContent.replace(/\s+/g, " ").trim(), SENTENCE);
  });

  test(`r2-state-note-1: ${page} note sits near the top, before the first section heading`, async () => {
    const { document } = await loadPage(page);
    const note = document.getElementById(id);
    const firstH2 = document.querySelector("h2");
    assert.ok(firstH2, "the page has an h2");
    const before = note.compareDocumentPosition(firstH2) & 4; // Node.DOCUMENT_POSITION_FOLLOWING
    assert.ok(before, "the note comes before the first h2");
    assert.ok(document.querySelector("h1").compareDocumentPosition(note) & 4, "the note comes after the h1");
  });

  test(`r2-state-note-1: ${page} note links to permit.html and states.html only`, async () => {
    const { document } = await loadPage(page);
    // A script may add ?state= to the permit link once a state is known, so compare the path only.
    const hrefs = [...document.getElementById(id).querySelectorAll("a")].map((a) => (a.getAttribute("href") || "").split("?")[0]);
    assert.ok(hrefs.includes("permit.html"), "links to permit.html");
    assert.ok(hrefs.includes("states.html"), "links to states.html");
    assert.deepEqual([...new Set(hrefs)].sort(), ["permit.html", "states.html"]);
  });

  test(`r2-state-note-1: ${page} source has the note and no em or en dash`, () => {
    const src = rd("src/" + page);
    assert.ok(/Most examples here are from California\. /.test(src), "source has the note");
    assert.equal(src.includes(EM), false, page + " source has no em dash");
    assert.equal(src.includes(EN), false, page + " source has no en dash");
    assert.equal(rd(page).includes(EM) || rd(page).includes(EN), false, "built " + page + " has no em or en dash");
  });
}

test("r2-state-note-1: the Get ready lede is unchanged and still at most 45 words", async () => {
  const { document } = await loadPage("ready.html");
  const lede = document.querySelector("p.lede");
  assert.equal(lede.textContent.trim().split(/\s+/).length <= 45, true);
  assert.equal(lede.textContent.includes("Most examples"), false, "the note is not inside the lede");
});

test("r2-state-note-1: the Get ready no-offer note still follows the lede directly", async () => {
  const { document } = await loadPage("ready.html");
  assert.equal(document.getElementById("readyNoYes").previousElementSibling.className, "lede");
});

test("r2-state-note-1: the Getting paid opening line is unchanged", async () => {
  const { document } = await loadPage("ready.html");
  const p = document.getElementById("money").querySelector("h2").nextElementSibling;
  assert.match(p.textContent, /^Not in California\? The bank card is for every state\./);
});
