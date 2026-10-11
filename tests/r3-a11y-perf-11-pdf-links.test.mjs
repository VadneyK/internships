// Links that open a PDF say "PDF" in their accessible name. G.markNewTabLinks adds the note (see assets/js/common.js).
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const PAGES = ["ready.html", "rules.html", "safety.html", "languages.html"];
const isPdfHref = (a) => {
  try { return /\.pdf$/i.test(new URL(a.href).pathname); } catch (e) { return false; }
};
const nameOf = (a) => a.getAttribute("aria-label") || a.textContent.replace(/\s+/g, " ").trim();

test("every link whose path ends in .pdf has PDF in its accessible name", async () => {
  for (const file of PAGES) {
    const { document } = await loadPage(file);
    await tick(200);
    const pdfs = [...document.querySelectorAll("a[href]")].filter(isPdfHref);
    assert.ok(pdfs.length > 0, file + " should have PDF links");
    for (const a of pdfs) {
      assert.match(nameOf(a), /PDF/, file + ": " + a.getAttribute("href"));
    }
  }
});

test("a PDF link with a new-tab target gets one PDF note and one new-tab note, and running the helper twice adds none", async () => {
  const { window, document } = await loadPage("ready.html");
  await tick(200);
  const main = document.querySelector("main");
  main.insertAdjacentHTML("beforeend",
    '<a id="p1" href="https://example.org/Guide.PDF?download=1#top" target="_blank" rel="noopener">Guide</a>' +
    '<a id="p2" href="https://example.org/sheet.pdf" target="_blank" rel="noopener" aria-label="Sheet">Sheet</a>' +
    '<a id="p3" href="https://example.org/plain">Read the pdf guide</a>' +
    '<a id="p4" href="https://example.org/doc.pdf">Doc</a>');
  window.TIG.markNewTabLinks(document);
  window.TIG.markNewTabLinks(document);
  await tick(30);
  const p1 = document.getElementById("p1"), p2 = document.getElementById("p2");
  const p3 = document.getElementById("p3"), p4 = document.getElementById("p4");

  assert.equal(nameOf(p1), "Guide (PDF) (opens in a new tab)");
  assert.equal(p1.querySelectorAll("span.sr[data-pdfnote]").length, 1);
  assert.equal(p1.querySelectorAll("span.sr[data-newtab]").length, 1);

  assert.equal(p2.getAttribute("aria-label"), "Sheet, PDF, opens in a new tab");

  assert.equal(nameOf(p3), "Read the pdf guide", "a non-.pdf link that only mentions pdf is not changed");
  assert.equal(p3.querySelectorAll("span.sr").length, 0);

  assert.equal(nameOf(p4), "Doc (PDF)");
  assert.equal(p4.querySelectorAll("span.sr[data-newtab]").length, 0, "no target=_blank, so no new-tab note");

  const before = [...document.querySelectorAll("a[href]")].map((a) => a.innerHTML + "|" + (a.getAttribute("aria-label") || ""));
  window.TIG.markNewTabLinks(document);
  window.TIG.markNewTabLinks(document);
  await tick(30);
  const after = [...document.querySelectorAll("a[href]")].map((a) => a.innerHTML + "|" + (a.getAttribute("aria-label") || ""));
  assert.deepEqual(after, before, "a third and fourth run change nothing");
});

test("on the four PDF pages, a second run leaves exactly one PDF note and one new-tab note per link", async () => {
  for (const file of PAGES) {
    const { window, document } = await loadPage(file);
    await tick(200);
    window.TIG.markNewTabLinks(document);
    window.TIG.markNewTabLinks(document);
    await tick(30);
    for (const a of [...document.querySelectorAll("a[href]")].filter(isPdfHref)) {
      const name = nameOf(a);
      assert.equal((name.match(/PDF/g) || []).length, 1, file + " exactly one PDF in name: " + name);
      if (a.getAttribute("target") === "_blank") {
        assert.equal((name.match(/opens in a new tab/gi) || []).length, 1, file + " one new-tab note: " + name);
      }
    }
  }
});
