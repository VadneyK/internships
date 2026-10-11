// Links drawn by JS after data loads resolve. Every built root page is loaded in jsdom, data is awaited,
// and find, jobs, playbook and calendar get one cheap interaction. Every a[href] in the live DOM is then checked:
// internal links point to a built file, #fragments match an id, external links are https, and target=_blank has noopener.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const NON_WEB = /^(mailto|tel|sms|blob):/i;

// find.html draws one card per program with id "p-<program id>" at runtime, so those fragments are checked against the data
const programIds = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "data", "entries.json"), "utf8")).map((e) => e.id));
const isCardFragment = (rel, frag) => rel === "find.html" && /^p-/.test(frag) && programIds.has(frag.slice(2));

const idCache = new Map();
function builtIds(file) {
  if (!idCache.has(file)) {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    idCache.set(file, new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1])));
  }
  return idCache.get(file);
}

const interactions = {
  "find.html": async ({ document }) => {
    const more = document.getElementById("more");
    assert.ok(more, "find: Show more button exists");
    more.click();
    await tick(200);
  },
  "jobs.html": async ({ window, document }) => {
    type(window, document.getElementById("jAge"), "16");
    await tick(200);
  },
  "playbook.html": async ({ document }) => {
    const b = document.getElementById("addPerson");
    assert.ok(b && !b.hidden, "playbook: add person button shows");
    b.click();
    await tick(150);
  },
  "calendar.html": async ({ window, document }) => {
    const sel = document.getElementById("cPlace");
    const v = [...sel.options].map((o) => o.value).find((x) => x);
    assert.ok(v, "calendar: a place option exists");
    type(window, sel, v);
    await tick(200);
  },
};

function check(f, page, when) {
  const { window, document } = page;
  const bad = [];
  const base = new window.URL(window.location.href);
  const links = [...document.querySelectorAll("a[href]")];
  for (const a of links) {
    const raw = a.getAttribute("href");
    const text = (a.textContent || "").replace(/\s+/g, " ").trim() || a.getAttribute("aria-label") || "(no text)";
    const who = f + " (" + when + ") href=" + JSON.stringify(raw) + " text=" + JSON.stringify(text) + ": ";
    if (/^\s*javascript:/i.test(raw)) { bad.push(who + "javascript: link"); continue; }
    if (NON_WEB.test(raw.trim())) continue;
    let u;
    try { u = new window.URL(raw, base); } catch (e) { bad.push(who + "cannot parse"); continue; }
    if (u.origin !== base.origin) {
      if (u.protocol !== "https:") bad.push(who + "external link is not https");
      if (a.getAttribute("target") === "_blank" && !/\bnoopener\b/.test(a.getAttribute("rel") || "")) bad.push(who + "target=_blank without rel noopener");
      continue;
    }
    if (a.getAttribute("target") === "_blank" && !/\bnoopener\b/.test(a.getAttribute("rel") || "")) bad.push(who + "target=_blank without rel noopener");
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, "").replace(/^internships\//, ""); // the site is served under /internships/
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { bad.push(who + "internal target " + rel + " does not exist"); continue; }
    const frag = decodeURIComponent(u.hash.replace(/^#/, ""));
    if (!frag) continue;
    const same = rel === f;
    const ok = (same && document.getElementById(frag)) || (rel.endsWith(".html") && builtIds(rel).has(frag)) || isCardFragment(rel, frag);
    if (!ok) bad.push(who + "fragment #" + frag + " is not an id in " + rel + (same ? " (built or live)" : ""));
  }
  assert.deepEqual(bad, [], bad.join("\n"));
  return links.length;
}

test("there are root pages to check", () => assert.ok(pages.length >= 15, "found " + pages.length));

for (const f of pages) {
  test(f + ": links in the live DOM resolve after load" + (interactions[f] ? " and after one interaction" : ""), async () => {
    const page = await loadPage(f);
    await tick(150);
    const n = check(f, page, "after load");
    assert.ok(n > 0, f + " has no links at all");
    if (interactions[f]) {
      await interactions[f](page);
      check(f, page, "after interaction");
    }
    page.window.close();
  });
}
