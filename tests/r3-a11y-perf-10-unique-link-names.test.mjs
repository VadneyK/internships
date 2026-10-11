// Repeated "Official page" and "Open the official page" links name the program or page they open.
// Every accessible name on a page maps to one target only, so a links list reads distinct names.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const TAIL = /\s*\(opens in a new tab\)\s*$/;

// The accessible name: aria-label if set, else the text with the new-tab note removed.
function accName(a) {
  if (a.hasAttribute("aria-label")) return a.getAttribute("aria-label").replace(/\s+/g, " ").trim();
  const c = a.cloneNode(true);
  c.querySelectorAll("span").forEach((s) => { if (/opens in a new tab/i.test(s.textContent)) s.remove(); });
  return c.textContent.replace(/\s+/g, " ").trim();
}

function visibleText(a) {
  const c = a.cloneNode(true);
  c.querySelectorAll("span").forEach((s) => { if (/opens in a new tab/i.test(s.textContent)) s.remove(); });
  return c.textContent.replace(/\s+/g, " ").trim().replace(TAIL, "");
}

function namesToHrefs(doc) {
  const map = new Map();
  for (const a of doc.querySelectorAll("a[href]")) {
    const n = accName(a);
    if (!map.has(n)) map.set(n, new Set());
    map.get(n).add(a.getAttribute("href"));
  }
  return map;
}

function assertUnique(map, page) {
  for (const [name, hrefs] of map) {
    assert.ok(hrefs.size <= 1, page + ": accessible name \"" + name + "\" maps to " + hrefs.size + " links: " + [...hrefs].join(" "));
  }
}

function assertNamed(doc, page, visible, titleSel) {
  const links = [...doc.querySelectorAll("a[href]")].filter((a) => visibleText(a) === visible);
  assert.ok(links.length > 0, page + ": no \"" + visible + "\" links to check");
  for (const a of links) {
    const label = a.getAttribute("aria-label") || "";
    assert.ok(label.startsWith(visible), page + ": label does not start with \"" + visible + "\": " + label);
    const titleEl = a.closest("li") && a.closest("li").querySelector(titleSel);
    const title = titleEl ? titleEl.textContent.trim() : "";
    assert.ok(title, page + ": no program or page title in the row for " + a.getAttribute("href"));
    assert.ok(label.includes(title), page + ": label \"" + label + "\" does not name \"" + title + "\"");
  }
}

test("index.html: the closing-soon Official page links have distinct names that name the program", async () => {
  const { document } = await loadPage("index.html");
  for (let i = 0; i < 60 && !document.querySelector("#soonList li[data-id]"); i++) await tick(50);
  assert.ok(document.querySelectorAll("#soonList li[data-id] a[href]").length > 0, "soon list drew official links");
  assertUnique(namesToHrefs(document), "index.html");
  assertNamed(document, "index.html", "Official page", "b");
});

test("languages.html: the default list has distinct link names that name the page", async () => {
  const { document } = await loadPage("languages.html");
  for (let i = 0; i < 60 && !document.querySelector("#lList a[href]"); i++) await tick(50);
  assert.ok(document.querySelectorAll("#lList a[href]").length > 0, "language list drew links");
  assertUnique(namesToHrefs(document), "languages.html");
  assertNamed(document, "languages.html", "Open the official page", "h3");
});
