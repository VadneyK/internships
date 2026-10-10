import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

test("share: loads clean, ten QR cards each with an image file that exists and a link on this site only", async () => {
  const p = await loadPage("share.html"); await tick(100);
  const { document } = p;
  assert.deepEqual(p.errors, []);
  const cards = [...document.querySelectorAll(".qrcard")];
  assert.equal(cards.length, 10);
  for (const c of cards) {
    const src = c.querySelector("img").getAttribute("src");
    assert.ok(fs.existsSync(new URL("../" + src, import.meta.url)), src + " should exist");
    assert.match(c.querySelector("button[data-copy-link]").getAttribute("data-copy-link"), /^https:\/\/vadneyk\.github\.io\/internships\//);
    assert.ok(c.querySelector("img").getAttribute("alt").length > 8);
  }
  assert.doesNotMatch(document.body.textContent, /undefined|NaN/);
});

test("share: each QR svg encodes the same link its card shows", () => {
  const files = fs.readdirSync(new URL("../assets/qr/", import.meta.url)).filter((f) => f.endsWith(".svg"));
  assert.equal(files.length, 10);
  for (const f of files) {
    const svg = fs.readFileSync(new URL("../assets/qr/" + f, import.meta.url), "utf8");
    assert.match(svg, /<title>https:\/\/vadneyk\.github\.io\/internships\//, f);
    assert.doesNotMatch(svg, /<script|onload|xlink:href/i, f + " should be plain shapes");
  }
});

test("share: the print button fills a print area with the code and the typed link, then hides it again", async () => {
  const p = await loadPage("share.html"); await tick(100);
  const { document, window } = p;
  window.print = () => {};
  document.querySelector('[data-print-qr="home"]').click();
  assert.equal(document.getElementById("qrPrint").hidden, true);
});
