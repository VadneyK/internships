import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEDERAL = "Federal law sets 14 as the minimum age for most non-farm jobs. Your state can be stricter.";

function pickAge(document, value) {
  const sel = document.getElementById("age");
  sel.value = value;
  sel.dispatchEvent(new sel.ownerDocument.defaultView.Event("change", { bubbles: true }));
}

test("r3-teen-flow-2: age 12 and 13 show the under-14 note with a link to younger.html?age=<age>; 14 and no age hide it", async () => {
  const { document } = await loadPage("find.html"); await tick(150);
  const note = document.getElementById("ageUnder14Note");
  assert.ok(note, "note exists");
  assert.equal(note.hidden, true, "hidden with no age");
  assert.equal(document.querySelectorAll("#ageUnder14Note").length, 1, "only one note");
  assert.ok(document.getElementById("ageUnder14Region").getAttribute("aria-live") === "polite", "inside a polite region");

  for (const age of ["12", "13"]) {
    pickAge(document, age); await tick(60);
    const n = document.getElementById("ageUnder14Note");
    assert.equal(n.hidden, false, "shown for " + age);
    assert.match(n.textContent, new RegExp(FEDERAL.replace(/\./g, "\\.")));
    const a = n.querySelector("a");
    assert.equal(a.getAttribute("href"), "younger.html?age=" + age);
    assert.ok(fs.existsSync(path.join(ROOT, "younger.html")), "younger.html is built");
    const rel = document.querySelector("#relatedLinks a[href^='younger.html']");
    assert.equal(rel.getAttribute("href"), "younger.html?age=" + age, "related chip carries age " + age);
  }

  pickAge(document, "14"); await tick(60);
  assert.equal(document.getElementById("ageUnder14Note").hidden, true, "hidden for 14");
  assert.equal(document.querySelector("#relatedLinks a[href^='younger.html']").getAttribute("href"), "younger.html", "related chip has no age for 14");

  pickAge(document, ""); await tick(60);
  assert.equal(document.getElementById("ageUnder14Note").hidden, true, "hidden for empty age");
  assert.equal(document.querySelector("#relatedLinks a[href^='younger.html']").getAttribute("href"), "younger.html");
});

test("r3-teen-flow-2: the note shows on load from ?age=12 and 13, and its link resolves to a built page", async () => {
  for (const age of ["12", "13"]) {
    const { document } = await loadPage("find.html", { search: "?age=" + age }); await tick(150);
    const n = document.getElementById("ageUnder14Note");
    assert.equal(n.hidden, false, "shown on load for " + age);
    const href = n.querySelector("a").getAttribute("href");
    assert.equal(href, "younger.html?age=" + age);
    assert.ok(fs.existsSync(path.join(ROOT, href.split("?")[0])), href + " resolves");
  }
  const { document } = await loadPage("find.html", { search: "?age=14" }); await tick(150);
  assert.equal(document.getElementById("ageUnder14Note").hidden, true, "hidden on load for 14");
});
