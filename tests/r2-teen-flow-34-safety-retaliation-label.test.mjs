import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

// Static checks on the built safety page (no JavaScript run). The live script in assets/js/safety.js
// sets this h2 from data/safety.json, so this test covers the page as built, not the live view.
const html = fs.readFileSync(new URL("../safety.html", import.meta.url), "utf8");
const doc = new JSDOM(html).window.document;

test("safety page: the chip for part 5 says who punishes, and it links to the section", () => {
  const chip = [...doc.querySelectorAll("nav#parts a.chip")].find((a) => a.getAttribute("href") === "#sec-retaliation");
  assert.ok(chip, "chip linking to #sec-retaliation exists");
  assert.equal(chip.textContent.trim(), "5. If you are punished for speaking up");
  assert.ok(doc.getElementById("sec-retaliation"), "chip target exists");
});

test("safety page: the part 5 heading says the boss is the one punishing", () => {
  const h2 = doc.querySelector("#sec-retaliation h2");
  assert.ok(h2, "h2 inside #sec-retaliation exists");
  assert.equal(h2.textContent.trim(), "5. If your boss punishes you for speaking up (retaliation)");
});
