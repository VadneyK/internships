// Phone keyboards: the reference "Phone or email" box must not capitalize an email address or wear a text-only spell check.
// Loads interview.html with its real script, checks every reference contact box, and checks any reference added later.
// autocomplete stays "off" so tests/a11y-autocomplete-tokens.test.mjs keeps passing.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

function checkContact(el) {
  const id = el.id || "(no id)";
  assert.equal(el.getAttribute("autocapitalize"), "none", id + " autocapitalize");
  assert.equal(el.getAttribute("spellcheck"), "false", id + " spellcheck");
  assert.equal(el.getAttribute("autocomplete"), "off", id + " autocomplete");
}

test("interview.html: every reference contact box is plain (no capitals, no spell check, autocomplete off)", async () => {
  const p = await loadPage("interview.html");
  await tick(150);
  const { document } = p.window;
  const boxes = document.querySelectorAll("input[data-k='c']");
  assert.equal(boxes.length, 4, "four reference contact boxes on load");
  for (const el of boxes) checkContact(el);
  for (const el of document.querySelectorAll("input[data-k='n']")) {
    assert.equal(el.getAttribute("autocapitalize"), "words", (el.id || "name") + " keeps words");
  }
  p.window.close();
});

test("interview.html: a reference added on the page carries the same contact settings", async () => {
  const p = await loadPage("interview.html");
  await tick(150);
  const { document } = p.window;
  const add = document.querySelector("[data-add-ref], #addRef, #addReference");
  if (add) {
    add.click();
    await tick(60);
    const boxes = document.querySelectorAll("input[data-k='c']");
    assert.ok(boxes.length > 4, "a new reference contact box was added");
    for (const el of boxes) checkContact(el);
  } else {
    // The page has no add control: the reference list is fixed, so the boxes checked above are the full set.
    assert.equal(document.querySelectorAll("input[data-k='c']").length, 4);
  }
  p.window.close();
});
