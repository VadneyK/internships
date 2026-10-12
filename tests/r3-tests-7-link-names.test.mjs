// WCAG 2.4.4: a link must make sense out of context. Every root page is loaded in jsdom with its scripts
// (find.html also after a place is picked and Show more is clicked once). For each a[href] the accessible name
// is aria-label, else aria-labelledby, else text content, else the alt of an inner image.
// Fails on: an empty name; a name that is only a filler word; two links with the same name but different targets
// (unless the owning card's id is in the aria-label). Known offenders sit in ALLOWLIST (a ratchet: exact counts,
// so a fixed one must be removed from the list, and a new one fails).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "404.html").sort();
const GENERIC = new Set(["here", "click here", "link", "more", "read more", "details", "learn more", "this", "go"]);

/* Known offenders: { page, name, count, kind } where kind is "empty", "generic" or "clash" and count is how many links. */
const ALLOWLIST = [
  { page: "about.html", name: "Rules page", count: 2, kind: "clash" },
  { page: "find.html", name: "What opens when", count: 3, kind: "clash" },
  { page: "insights.html", name: "See card", count: 8, kind: "clash" },
  { page: "parents.html", name: "Ages 12 to 14", count: 14, kind: "clash" },
  { page: "parents.html", name: "Apply and interview", count: 8, kind: "clash" },
  { page: "parents.html", name: "Get ready", count: 8, kind: "clash" },
  { page: "parents.html", name: "The Playbook", count: 8, kind: "clash" },
  { page: "parents.html", name: "The Rules", count: 23, kind: "clash" },
  { page: "parents.html", name: "Work permit finder", count: 20, kind: "clash" },
  { page: "parents.html", name: "Your first paycheck", count: 16, kind: "clash" },
  { page: "ready.html", name: "Playbook", count: 3, kind: "clash" },
  { page: "ready.html", name: "See how", count: 6, kind: "clash" },
  { page: "safety.html", name: "dir.ca.gov (opens in a new tab)", count: 3, kind: "clash" },
  { page: "younger.html", name: "Official page (opens in a new tab)", count: 8, kind: "clash" },
];

function norm(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

function accName(a) {
  const doc = a.ownerDocument;
  const label = norm(a.getAttribute("aria-label"));
  if (label) return label;
  const by = a.getAttribute("aria-labelledby");
  if (by) {
    const t = norm(by.split(/\s+/).map((id) => { const e = doc.getElementById(id); return e ? e.textContent : ""; }).join(" "));
    if (t) return t;
  }
  const text = norm(a.textContent);
  if (text) return text;
  const img = a.querySelector("img[alt]");
  return img ? norm(img.getAttribute("alt")) : "";
}

function ownerId(a) {
  const card = a.closest("[data-id]") || a.parentElement && a.parentElement.closest("[id]");
  return card ? card.getAttribute("data-id") || card.id : "";
}

function resolvedHref(a) { return new URL(a.getAttribute("href"), a.ownerDocument.baseURI).href; }

// Returns Map "kind|name" -> count of links
function findOffenders(doc) {
  const out = new Map();
  const add = (kind, name, n = 1) => { const k = kind + "|" + name; out.set(k, (out.get(k) || 0) + n); };
  const byName = new Map();
  for (const a of doc.querySelectorAll("a[href]")) {
    const name = accName(a);
    if (!name) { add("empty", "(no name)"); continue; }
    if (GENERIC.has(name.toLowerCase().replace(/[.!:]+$/, ""))) { add("generic", name); continue; }
    const id = ownerId(a);
    if (id && norm(a.getAttribute("aria-label")).includes(id)) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(a);
  }
  for (const [name, links] of byName) {
    const hrefs = new Set(links.map(resolvedHref));
    if (hrefs.size > 1) add("clash", name, links.length);
  }
  return out;
}

const seen = []; // { page, offenders, total }

function check(page, doc) {
  const off = findOffenders(doc);
  const total = doc.querySelectorAll("a[href]").length;
  seen.push({ page, total, off });
  const allowed = new Map(ALLOWLIST.filter((x) => x.page === page).map((x) => [x.kind + "|" + x.name, x.count]));
  const problems = [];
  for (const [k, n] of off) {
    if (!allowed.has(k)) problems.push("new offender " + k + " x" + n);
    else if (allowed.get(k) !== n) problems.push("count changed for " + k + ": allowlist " + allowed.get(k) + ", now " + n + (n < allowed.get(k) ? " (fixed? lower the count)" : ""));
  }
  for (const [k, n] of allowed) if (!off.has(k)) problems.push("allowlist entry no longer offends, remove it: " + k + " x" + n);
  assert.deepEqual(problems, [], page + ": link name problems");
}

for (const f of PAGES) {
  if (f === "find.html") continue;
  test(f + ": link names are not empty or generic and same-name links share one target", async () => {
    const { document } = await loadPage(f);
    await tick(150);
    check(f, document);
  });
}

test("find.html: link names hold after a place is picked and Show more is clicked once", async () => {
  const { document, window } = await loadPage("find.html");
  const sel = document.getElementById("place");
  const opt = [...sel.options].find((o) => o.value.startsWith("city:"));
  assert.ok(opt, "a city option exists");
  type(window, sel, opt.value);
  await tick(150);
  const more = document.getElementById("more");
  if (more) { more.click(); await tick(150); }
  check("find.html", document);
});

test.after(() => {
  console.log("\nLink name report (links checked, offending links by kind):");
  for (const { page, total, off } of seen.sort((a, b) => a.page.localeCompare(b.page))) {
    const parts = [...off].map(([k, n]) => k + " x" + n);
    console.log("  " + page + ": " + total + " links; " + (parts.length ? parts.join("; ") : "no offenders"));
  }
});
