import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));

test("aria-label on plain elements needs a role, and never sits on hidden or presentation nodes", () => {
  for (const f of pages) {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8")).window.document;
    for (const el of doc.querySelectorAll("[aria-label]")) {
      const tag = el.tagName.toLowerCase();
      if (["div", "span", "p", "i", "b", "small"].includes(tag)) {
        assert.ok(el.hasAttribute("role"), f + ": <" + tag + "> with aria-label has no role: " + el.getAttribute("aria-label"));
      }
      assert.notEqual(el.getAttribute("role"), "presentation", f + ": aria-label on role=presentation");
      assert.notEqual(el.getAttribute("aria-hidden"), "true", f + ": aria-label on aria-hidden");
    }
  }
});

test("the seven preview and stats elements are role=group", () => {
  const want = { "index.html": [".stats"], "insights.html": [".stats"], "leaders.html": [".letter"], "resume.html": [".resume"] };
  for (const [f, sels] of Object.entries(want)) {
    const doc = new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8")).window.document;
    for (const s of sels) {
      const els = doc.querySelectorAll(s + "[aria-label]");
      assert.ok(els.length >= 1, f + " " + s);
      els.forEach((e) => assert.equal(e.getAttribute("role"), "group"));
      if (f === "leaders.html") assert.equal(els.length, 4);
    }
  }
});

test("share.html QR images say where the code goes and load before print", async () => {
  const { document } = await loadPage("share.html");
  const cards = [...document.querySelectorAll(".qrcard")];
  assert.equal(cards.length, 11);
  cards.forEach((c, i) => {
    const img = c.querySelector("img");
    const words = c.querySelector("h3").textContent.trim().toLowerCase().split(/\s+/);
    const alt = img.getAttribute("alt");
    assert.ok(alt.startsWith("QR code"), alt);
    assert.ok(alt.length <= 60 && !alt.includes("/"), alt);
    // The alt must name the card title, words in order (the alt may add "the" or "page" around them).
    assert.ok(new RegExp(words.join("\\b.*\\b")).test(alt.toLowerCase()), alt + " does not name the card title: " + words.join(" "));
    assert.ok(!/for For/i.test(alt), alt);
    assert.ok(!/[\u2013\u2014]/.test(alt), alt);
    assert.equal(img.getAttribute("width"), "160");
    assert.equal(img.getAttribute("height"), "160");
    // 2026-10-14: no lazy loading. Printed straight after opening, lazy codes below the fold came out as blank squares (event check before the Alameda table).
    assert.ok(!img.hasAttribute("loading"), "QR image " + i + " must load before print");
  });
});

test("share.html print button still clones the image with its alt", async () => {
  const { document, window } = await loadPage("share.html");
  window.print = () => {};
  const card = document.querySelector(".qrcard");
  const alt = card.querySelector("img").getAttribute("alt");
  card.querySelector("[data-print-qr]").click();
  const printed = document.querySelector("#qrPrint img");
  assert.ok(printed, "image cloned into #qrPrint");
  assert.equal(printed.getAttribute("alt"), alt);
});
