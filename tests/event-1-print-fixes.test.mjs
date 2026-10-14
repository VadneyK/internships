// Event check 2026-10-14 (before the Alameda table, Oct 23 and 24): fixes for what a printed page or a phone showed wrong.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("handout: the main button prints only the one page sheet, the other prints everything", async () => {
  const { document, window } = await loadPage("handout.html");
  let prints = 0;
  window.print = () => { prints++; };
  document.getElementById("handoutPrint").click();
  const root = document.getElementById("printRoot");
  assert.ok(root, "the sheet is copied into the print layer");
  assert.ok(document.body.classList.contains("print-one"));
  assert.ok(root.querySelector('img[src="assets/qr/home.svg"]'), "the QR code is on the printed sheet");
  assert.ok(!root.textContent.includes("Teach it in 45 minutes"), "lesson plans are not on the one page print");
  window.dispatchEvent(new window.Event("afterprint"));
  assert.equal(document.getElementById("printRoot"), null);
  document.getElementById("handoutPrintAll").click();
  assert.equal(prints, 2);
  assert.equal(document.getElementById("printRoot"), null, "the full print does not use the print layer");
});

test("share: the scanned-code start box is screen only, and the NorCal caption matches where its code goes", () => {
  const html = read("share.html");
  assert.match(html, /class="callout noprint" id="startHere"/);
  const card = html.slice(html.indexOf('data-name="norcal"'), html.indexOf('data-name="socal"'));
  assert.ok(card.includes("find.html?where=oak"));
  assert.ok(card.includes("East Bay") && !card.includes("Davis"), "the oak code opens Oakland and the East Bay only");
});

test("paycheck: the two column estimate table may shrink to a phone width", () => {
  const css = read("assets/css/style.css");
  assert.match(css, /@media \(max-width: 40rem\) \{[^}]*#mOut table[^{]*\{ min-width: 0; \}/);
});
