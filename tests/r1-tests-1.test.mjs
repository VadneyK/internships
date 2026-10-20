// Every internal link and in-page anchor in the built root pages must resolve, and the sitemap must match the pages.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://vadneyk.github.io/internships/";
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

// Known breaks, as "page|href" with a reason. Empty today.
const ALLOW = {};
// Pages that are meant to stay out of the sitemap (the error page is not a destination).
const NOT_IN_SITEMAP = { "404.html": "error page, not a destination", "leaders.html": "noindex and unlisted on purpose (tools/build.py keeps it out until approved)", "ignition.html": "noindex and unlisted on purpose until Ignition's leaders approve promoting it (tools/build.py keeps it out, 2026-10-20)" };

const docs = new Map();
for (const f of pages) docs.set(f, new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8")).window.document);

function hasAnchor(doc, id) {
  if (!id) return true;
  for (const el of doc.querySelectorAll("[id]")) if (el.id === id) return true;
  for (const el of doc.querySelectorAll("a[name]")) if (el.getAttribute("name") === id) return true;
  return false;
}

test("every internal href and #fragment in built pages resolves", () => {
  assert.ok(pages.length >= 20, "expected 20+ root pages, found " + pages.length);
  const fails = [];
  for (const [page, doc] of docs) {
    for (const a of doc.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href").trim();
      if (href === "" || /^(https?:|mailto:|tel:|sms:|javascript:|data:)/i.test(href)) continue;
      if (ALLOW[page + "|" + href]) continue;
      const [beforeHash, ...rest] = href.split("#");
      const frag = rest.length ? decodeURIComponent(rest.join("#")) : "";
      const filePart = beforeHash.split("?")[0];
      let targetPage = page;
      if (filePart !== "") {
        const rel = filePart.replace(/^\.\//, "").replace(/^\/internships\//, ""); // 404.html links are root-anchored under /internships/
        const full = path.join(ROOT, rel === "" || rel.endsWith("/") ? rel + "index.html" : rel);
        if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
          fails.push(page + ", " + href + " (file not found)");
          continue;
        }
        targetPage = path.relative(ROOT, full);
      }
      if (frag && targetPage.endsWith(".html")) {
        const tdoc = docs.get(targetPage);
        if (!tdoc) fails.push(page + ", " + href + " (target page not loaded)");
        else if (!hasAnchor(tdoc, frag)) fails.push(page + ", " + href + " (no id or name '" + frag + "' in " + targetPage + ")");
      }
    }
  }
  assert.deepEqual(fails, [], "Dead links:\n" + fails.join("\n"));
});

test("sitemap lists every root page and every sitemap URL maps to a file", () => {
  const xml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const problems = [];
  const listed = new Set();
  for (const loc of locs) {
    if (!loc.startsWith(SITE)) { problems.push("sitemap URL outside the site: " + loc); continue; }
    const rel = loc.slice(SITE.length) || "index.html";
    listed.add(rel);
    if (!fs.existsSync(path.join(ROOT, rel))) problems.push("sitemap URL has no file: " + loc);
  }
  for (const f of pages) {
    if (NOT_IN_SITEMAP[f]) continue;
    if (!listed.has(f)) problems.push("page missing from sitemap.xml: " + f);
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});
