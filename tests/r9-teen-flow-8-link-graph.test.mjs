// Link graph guard: every teen page stays reachable and keeps next-step links.
// Pure test: reads built html files, no network, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["find", "permit", "interview", "paycheck", "younger", "calendar", "ready", "playbook", "resume", "jobs", "safety", "rules", "states", "parents", "share"];
const ALL = ["index", "404", ...PAGES];

// Pages known to be under the 3-link bar. Remove an entry when its ticket lands.
const FEW_LINKS_ALLOWED = {
  share: "only links to find and jobs in main content until the share page gets more next steps",
};

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
const read = (p) => strip(fs.readFileSync(path.join(ROOT, p + ".html"), "utf8"));

function targets(html, self) {
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const t = m[1].split("#")[0].split("?")[0].replace(/^\.?\//, "").replace(/^internships\//, "").replace(/\.html$/, "");
    if (ALL.includes(t) && t !== self) out.add(t);
  }
  return out;
}

const full = {}, main = {};
for (const p of ALL) {
  const h = read(p);
  full[p] = targets(h, p);
  const m = h.match(/<main[\s\S]*?<\/main>/i);
  main[p] = targets(m ? m[0] : h, p);
}

function clicks(start) {
  const dist = { [start]: 0 };
  const q = [start];
  while (q.length) {
    const c = q.shift();
    for (const n of full[c]) if (!(n in dist)) { dist[n] = dist[c] + 1; q.push(n); }
  }
  return dist;
}

for (const start of ["index", "404"]) {
  test("every teen page is within 2 clicks of " + start, () => {
    const d = clicks(start);
    for (const p of PAGES) assert.ok(d[p] !== undefined && d[p] <= 2, p + " is not reachable from " + start + " in 2 clicks");
  });
}

test("every page except 404 has at least 3 distinct teen-page links in main", () => {
  for (const p of ALL.filter((x) => x !== "404")) {
    if (FEW_LINKS_ALLOWED[p]) continue;
    assert.ok(main[p].size >= 3, p + " has only " + main[p].size + " teen-page links in main");
  }
});

test("allow-list entries are still needed", () => {
  for (const p of Object.keys(FEW_LINKS_ALLOWED)) assert.ok(main[p].size < 3, p + " now has 3+ links, remove it from FEW_LINKS_ALLOWED");
});

test("no page links only to itself", () => {
  for (const p of ALL) assert.ok(full[p].size > 0, p + " links to no other teen page");
});
