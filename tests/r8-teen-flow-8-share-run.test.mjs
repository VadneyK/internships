// Ticket r8-share-run: three steps for a leader to run a table in any city.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = new JSDOM(fs.readFileSync(path.join(ROOT, "share.html"), "utf8")).window.document;
const handout = new JSDOM(fs.readFileSync(path.join(ROOT, "handout.html"), "utf8")).window.document;

test("three ordered steps sit above the city codes", () => {
  const h = doc.getElementById("runTable");
  const ol = h.nextElementSibling;
  assert.equal(ol.tagName, "OL");
  assert.ok(ol.classList.contains("steps"));
  assert.equal(ol.children.length, 3);
  assert.ok(h.compareDocumentPosition(doc.getElementById("leaderCodes")) & 4);
});

test("steps 2 and 3 link the handout and its table section", () => {
  const ol = doc.getElementById("runTable").nextElementSibling;
  const links = [...ol.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(links, ["handout.html", "handout.html#table"]);
  assert.ok(handout.getElementById("table"));
});
