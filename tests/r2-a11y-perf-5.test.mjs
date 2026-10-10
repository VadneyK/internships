// Ticket r2-a11y-perf-5: links that open a new tab say so in their accessible name.
// Run with: node --test tests/r2-a11y-perf-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, type, tick } from "./dom-helper.mjs";

const RE = /opens in a new tab/i;
const count = (s) => (s.match(/opens in a new tab/gi) || []).length;
function nameOf(a) {
  return (a.getAttribute("aria-label") || a.textContent || "").replace(/\s+/g, " ").trim();
}
function check(document, where) {
  const links = [...document.querySelectorAll('a[target="_blank"]')];
  for (const a of links) {
    assert.match(nameOf(a), RE, `${where}: "${nameOf(a)}" has no new tab note`);
    assert.equal(count(nameOf(a)), 1, `${where}: "${nameOf(a)}" has more than one marker`);
  }
  return links.length;
}

for (const page of ["insights.html", "ready.html", "states.html", "about.html"]) {
  test(`${page}: every target=_blank link names the new tab`, async () => {
    const { document } = await loadPage(page);
    assert.ok(check(document, page) > 0, "expected at least one new tab link");
  });
}

test("find.html: new links get the marker after render and after Show more", async () => {
  const { document } = await loadPage("find.html");
  await tick(200);
  const before = check(document, "find.html");
  assert.ok(before > 0, "expected new tab links on the list");
  const more = [...document.querySelectorAll("button")].find((b) => /show more/i.test(b.textContent));
  assert.ok(more, "no Show more button");
  more.click();
  await tick(100);
  const after = check(document, "find.html after Show more");
  assert.ok(after > before, "Show more added no links");
});

test("calendar.html: links after picking a month get the marker", async () => {
  const { window, document } = await loadPage("calendar.html");
  await tick(200);
  const sel = [...document.querySelectorAll("select")].find((s) => s.options.length > 3) || document.querySelector("select");
  if (sel) {
    const opt = [...sel.options].filter((o) => o.value)[1] || sel.options[1];
    if (opt) type(window, sel, opt.value);
    await tick(100);
  }
  check(document, "calendar.html");
});

test("running the helper twice and mutating twice never adds a second marker", async () => {
  const { window, document } = await loadPage("about.html");
  const main = document.querySelector("main");
  window.TIG.markNewTabLinks(document);
  window.TIG.markNewTabLinks(document);
  const a = document.createElement("a");
  a.href = "https://example.org/"; a.target = "_blank"; a.textContent = "Example";
  const b = document.createElement("a");
  b.href = "https://example.org/b"; b.target = "_blank"; b.setAttribute("aria-label", "Example B");
  main.appendChild(a); main.appendChild(b);
  await tick(50);
  main.appendChild(document.createElement("p"));
  await tick(50);
  assert.equal(a.querySelectorAll("span.sr").length, 1);
  assert.equal(nameOf(b), "Example B, opens in a new tab");
  check(document, "about.html");
});

test("links without target=_blank are not changed, and the marker is the hidden .sr class", async () => {
  const { document } = await loadPage("about.html");
  const plain = [...document.querySelectorAll('main a:not([target="_blank"])')];
  assert.ok(plain.length > 0);
  for (const a of plain) assert.equal(count(a.outerHTML), 0, `plain link changed: ${a.outerHTML}`);
  const m = document.querySelector('a[target="_blank"] span.sr');
  if (m) assert.ok(m.classList.contains("sr"));
  assert.match(fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8"), /^\.sr \{/m);
});
