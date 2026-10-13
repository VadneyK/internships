// Ticket r8-ready-foster: Get ready has a closed block for teens in foster care or on their own.
// Run with: node --test tests/r8-teen-flow-9-ready-foster.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const ALLOWED = [
  "https://www.cde.ca.gov/ci/ct/we/documents/B1-4frm.doc",
  "https://ilga.gov/documents/legislation/ilcs/documents/082002060K55.htm",
  "https://dol.ny.gov/working-papers",
  "https://dol.georgia.gov/faqs-individuals/individuals-faqs-child-labor",
  "https://www.govinfo.gov/content/pkg/USCODE-2023-title42/html/USCODE-2023-title42-chap7-subchapIV-partE-sec675.htm",
  "https://www.govinfo.gov/content/pkg/USCODE-2023-title42/html/USCODE-2023-title42-chap7-subchapIV-partE-sec677.htm",
  "https://cdss.ca.gov/inforesources/foster-care/independent-living-program",
  "https://dfcs.georgia.gov/services/georgia-crew-cultivating-rising-experienced-worker",
  "https://dcfs.illinois.gov/brighter-futures/independence/moneysmartandjobsavvy.html",
];

test("r8-ready-foster: closed details with the exact summary", async () => {
  const { document, errors } = await loadPage("ready.html");
  assert.deepEqual(errors, []);
  const box = document.getElementById("foster");
  assert.ok(box);
  assert.equal(box.tagName, "DETAILS");
  assert.equal(box.hasAttribute("open"), false);
  assert.equal(box.querySelector("summary").textContent.trim(), "In foster care or on your own?");
});

test("r8-ready-foster: every link is https, listed, and opens in a new tab", async () => {
  const { document } = await loadPage("ready.html");
  const links = [...document.getElementById("foster").querySelectorAll("a")];
  assert.equal(links.length, ALLOWED.length);
  for (const a of links) {
    const h = a.getAttribute("href");
    assert.ok(h.startsWith("https://"), h);
    assert.ok(ALLOWED.includes(h), h);
    assert.equal(a.getAttribute("target"), "_blank");
    assert.match(a.getAttribute("rel"), /noopener/);
  }
});

test("r8-ready-foster: no em or en dash in the section", () => {
  const src = fs.readFileSync(new URL("../src/ready.html", import.meta.url), "utf8");
  const built = fs.readFileSync(new URL("../ready.html", import.meta.url), "utf8");
  for (const t of [src, built]) {
    const s = t.slice(t.indexOf('id="foster"'), t.indexOf("</details>", t.indexOf('id="foster"')));
    assert.ok(s.length > 100);
    assert.ok(!s.includes(String.fromCharCode(0x2014)) && !s.includes(String.fromCharCode(0x2013)));
  }
});
