// Site-wide DOM checks for the built pages in the repo root, run in jsdom with their real scripts.
// Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Built pages only. src/ holds templates and is not served.
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const EM_OR_EN_DASH = /[\u2013\u2014]/;
const BAD_TOKEN = /NaN|undefined|\{\{/;

// Static parse of a built file (no scripts run). Used for link and anchor targets.
const parsedCache = new Map();
function parsedFile(rel) {
  if (!parsedCache.has(rel)) {
    parsedCache.set(rel, new JSDOM(fs.readFileSync(path.join(ROOT, rel), "utf8")).window.document);
  }
  return parsedCache.get(rel);
}

// Returns problems for every <a href> in doc (a static or live document). rel is the file the links live in.
function linkProblems(doc, rel) {
  const problems = [];
  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href").trim();
    const where = `${rel} -> "${href}"`;
    if (/^(mailto|tel):/i.test(href)) continue;
    if (/^javascript:/i.test(href)) { problems.push(`${where} (javascript: link)`); continue; }
    if (/^https?:\/\//i.test(href)) {
      const rel_ = a.getAttribute("rel") || "";
      if (a.getAttribute("target") === "_blank" && !/\bnoopener\b/.test(rel_)) {
        problems.push(`${where} (target=_blank without rel noopener)`);
      }
      continue;
    }
    const hashAt = href.indexOf("#");
    const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
    const frag = hashAt === -1 ? "" : decodeURIComponent(href.slice(hashAt + 1));
    const filePart = decodeURIComponent(beforeHash.split("?")[0]);
    let target = rel;
    if (filePart) {
      const abs = path.join(ROOT, filePart.replace(/^\/+/, ""));
      if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        problems.push(`${where} (no such file)`);
        continue;
      }
      target = path.relative(ROOT, abs);
    }
    // find.js writes the #p-<id> program anchors at runtime, so those are checked in the live test below instead.
    if (frag && target === "find.html" && frag.startsWith("p-")) continue;
    if (frag && target.endsWith(".html")) {
      const tdoc = parsedFile(target);
      const found = [...tdoc.querySelectorAll("[id]")].some((el) => el.id === frag);
      if (!found) problems.push(`${where} (no id "${frag}" in ${target})`);
    }
  }
  return problems;
}

function accessibleName(document, el) {
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim();
    if (text) return text;
  }
  const ariaLabel = (el.getAttribute("aria-label") || "").trim();
  if (ariaLabel) return ariaLabel;
  if (el.tagName === "INPUT") return ((el.value || "") || el.getAttribute("title") || "").trim();
  const text = el.textContent.trim();
  if (text) return text;
  const img = el.querySelector("img[alt]");
  if (img && img.getAttribute("alt").trim()) return img.getAttribute("alt").trim();
  return (el.getAttribute("title") || "").trim();
}

function hasLabel(document, el) {
  if ((el.getAttribute("aria-label") || "").trim()) return true;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy && labelledBy.split(/\s+/).some((id) => document.getElementById(id))) return true;
  return Boolean(el.labels && el.labels.length);
}

// jsdom has no fetch(), and common.js calls fetch() for data/entries.json on every page that lists programs.
// So this loader serves those files from disk (same URL resolution as a browser) and otherwise matches loadPage
// in dom-helper.mjs. Storage can be given as JSON (storage, like the helper) or as raw strings (raw), because the
// theme is stored as a plain "dark" or "light" by common.js and the head script.
let originCache;
async function siteOrigin() {
  if (!originCache) originCache = (await loadPage("404.html")).window.location.origin;
  return originCache;
}

async function load(file, { storage = {}, raw = {} } = {}) {
  const origin = await siteOrigin();
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String((e && e.message) || e)));
  vc.on("error", (...a) => errors.push(a.join(" ")));
  const dom = await JSDOM.fromURL(`${origin}/${file}`, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, JSON.stringify(v));
      for (const [k, v] of Object.entries(raw)) w.localStorage.setItem(k, v);
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.fetch = async (input) => {
        const u = new URL(String(input), w.location.href);
        const abs = path.join(ROOT, decodeURIComponent(u.pathname).replace(/^\/+/, ""));
        if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
          return { ok: false, status: 404, json: async () => { throw new Error("not found"); }, text: async () => "" };
        }
        const text = fs.readFileSync(abs, "utf8");
        return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
      };
    },
  });
  await new Promise((r) => (dom.window.document.readyState === "complete" ? r() : dom.window.addEventListener("load", r)));
  await tick(80);
  return { dom, window: dom.window, document: dom.window.document, errors };
}

// ---------- every built page ----------

for (const file of PAGES) {
  test(`${file}: loads with no script errors`, async () => {
    const { errors } = await load(file);
    assert.deepEqual(errors, []);
  });

  test(`${file}: exactly one h1`, async () => {
    const { document } = await load(file);
    assert.equal(document.querySelectorAll("h1").length, 1);
  });

  test(`${file}: skip link points at an existing id`, async () => {
    const { document } = await load(file);
    const skip = document.querySelector("a.skip");
    assert.ok(skip, "missing a.skip link");
    const href = skip.getAttribute("href");
    assert.ok(href && href.startsWith("#"), `skip href is "${href}"`);
    assert.ok(document.getElementById(href.slice(1)), `no element with id "${href.slice(1)}"`);
  });

  test(`${file}: title and meta description are set`, async () => {
    const { document } = await load(file);
    assert.ok(document.title.trim().length > 0, "empty <title>");
    const desc = document.querySelector('meta[name="description"]');
    assert.ok(desc && desc.getAttribute("content").trim().length > 0, "empty meta description");
  });

  test(`${file}: header nav has 6 links`, async () => {
    const { document } = await load(file);
    assert.equal(document.querySelectorAll("nav.nav a").length, 6);
  });

  if (file !== "404.html" && file !== "index.html") {
    // Home is not one of the six nav links (the brand link goes home), so only the other pages mark a current nav link.
    test(`${file}: exactly one nav link has aria-current="page"`, async () => {
      const { document } = await load(file);
      const current = document.querySelectorAll('nav.nav a[aria-current="page"]');
      assert.equal(current.length, 1, `found ${current.length} current links`);
    });
  }

  test(`${file}: theme button flips data-theme on <html> and stores it in localStorage`, async () => {
    const { window, document } = await load(file);
    const btn = document.getElementById("themeBtn");
    assert.ok(btn, "missing #themeBtn");
    const before = document.documentElement.getAttribute("data-theme");
    btn.click();
    const first = document.documentElement.getAttribute("data-theme");
    assert.notEqual(first, before);
    assert.ok(first === "dark" || first === "light", `data-theme is "${first}"`);
    assert.equal(window.localStorage.getItem("theme"), first);
    btn.click();
    assert.notEqual(document.documentElement.getAttribute("data-theme"), first);
  });

  test(`${file}: a saved theme is applied on the next load`, async () => {
    const { document: first, window: w1 } = await load(file);
    first.getElementById("themeBtn").click();
    const chosen = w1.localStorage.getItem("theme");
    assert.ok(chosen === "dark" || chosen === "light", `stored theme is "${chosen}"`);
    const { document } = await load(file, { raw: { theme: chosen } });
    assert.equal(document.documentElement.getAttribute("data-theme"), chosen);
  });

  test(`${file}: no em dash or en dash in page text`, async () => {
    const { document } = await load(file);
    const meta = document.querySelector('meta[name="description"]');
    const text = [document.title, meta ? meta.getAttribute("content") : "", document.body.textContent].join(" ");
    const hit = text.match(EM_OR_EN_DASH);
    assert.equal(hit, null, hit ? `dash found near: "${text.slice(Math.max(0, hit.index - 40), hit.index + 40)}"` : "");
  });

  test(`${file}: no NaN, undefined or {{ tokens in the page text`, async () => {
    const { document } = await load(file);
    const meta = document.querySelector('meta[name="description"]');
    const text = [document.title, meta ? meta.getAttribute("content") : "", document.body.textContent].join(" ");
    const hit = text.match(BAD_TOKEN);
    assert.equal(hit, null, hit ? `token "${hit[0]}" near: "${text.slice(Math.max(0, hit.index - 40), hit.index + 40)}"` : "");
  });

  test(`${file}: every img has an alt attribute`, async () => {
    const { document } = await load(file);
    const missing = [...document.querySelectorAll("img")].filter((img) => !img.hasAttribute("alt")).map((img) => img.getAttribute("src"));
    assert.deepEqual(missing, []);
  });

  test(`${file}: every button has an accessible name`, async () => {
    const { document } = await load(file);
    const unnamed = [...document.querySelectorAll("button, input[type=button], input[type=submit], input[type=reset]")]
      .filter((el) => accessibleName(document, el) === "")
      .map((el) => el.outerHTML.slice(0, 80));
    assert.deepEqual(unnamed, []);
  });

  test(`${file}: every form control has a label`, async () => {
    const { document } = await load(file);
    const unlabelled = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
      .filter((el) => !hasLabel(document, el))
      .map((el) => el.outerHTML.slice(0, 80));
    assert.deepEqual(unlabelled, []);
  });

  test(`${file}: every internal link resolves to a file and, for #fragments, an id`, async () => {
    assert.deepEqual(linkProblems(parsedFile(file), file), []);
  });

  test(`${file}: every external target=_blank link has rel noopener`, async () => {
    const { document } = await load(file);
    const bad = [...document.querySelectorAll('a[target="_blank"]')].filter((a) => !/\bnoopener\b/.test(a.getAttribute("rel") || ""));
    assert.deepEqual(bad.map((a) => a.getAttribute("href")), []);
  });
}

// Links home.js writes at runtime (picker "Details", "See all", "Official page"): check them after the picker runs.
test("index.html: links created by the quick-start picker resolve", async () => {
  const { window, document } = await load("index.html");
  type(window, document.getElementById("pAge"), "16");
  await tick();
  assert.ok(document.querySelectorAll("#matches a[href]").length > 0, "picker made no links to check");
  assert.deepEqual(linkProblems(document, "index.html"), []);
});

test("index.html: picker Details links open find.html with their program anchor present", async () => {
  const { window, document } = await load("index.html");
  type(window, document.getElementById("pAge"), "16");
  await tick();
  const details = [...document.querySelectorAll('#matches a[href*="#p-"]')].map((a) => a.getAttribute("href"));
  assert.ok(details.length > 0, "picker made no Details links");
  const missing = [];
  for (const href of details) {
    const [pagePart, frag] = href.split("#");
    const target = await load(pagePart);
    await tick(20);
    if (!target.document.getElementById(decodeURIComponent(frag))) missing.push(href);
  }
  assert.deepEqual(missing, []);
});

// ---------- home page (index.html + home.js + common.js) ----------

test("home: quick-start picker shows real matches and a count", async () => {
  const { window, document, errors } = await load("index.html");
  assert.deepEqual(errors, []);
  assert.ok(document.querySelectorAll("#pHub option").length > 1, "hub list not filled");
  assert.ok(document.querySelectorAll("#pField option").length > 1, "field list not filled");
  type(window, document.getElementById("pAge"), "16");
  await tick();
  const more = document.getElementById("matchMore");
  assert.equal(more.hidden, false);
  const m = more.textContent.match(/See all (\d+) matches/);
  assert.ok(m, `expected "See all N matches", got "${more.textContent.trim()}"`);
  assert.ok(Number(m[1]) > 0, "zero matches for age 16");
  const cards = document.querySelectorAll("#matches .card.prog");
  assert.ok(cards.length > 0 && cards.length <= 4, `expected 1 to 4 cards, got ${cards.length}`);
  for (const c of cards) assert.ok(c.querySelector("h3").textContent.trim().length > 0);
});

test("home: stat numbers and footer count match data/entries.json", async () => {
  const { document } = await load("index.html");
  const total = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "entries.json"), "utf8")).length;
  const statNum = Number(document.querySelector(".stats .stat b").textContent.trim());
  assert.equal(statNum, total, `stat says ${statNum}, data has ${total} programs`);
  const footerCount = document.querySelector("footer .small").textContent.match(/(\d+) programs/);
  assert.ok(footerCount, "no program count in footer");
  assert.equal(Number(footerCount[1]), total, `footer says ${footerCount[1]}, data has ${total} programs`);
});

test("home: closing-soon list renders dated rows with day counts", async () => {
  const { document } = await load("index.html");
  const text = document.getElementById("soonList").textContent;
  assert.doesNotMatch(text, /Could not load/, "entries did not load");
  const rows = [...document.querySelectorAll("#soonList li")];
  assert.ok(rows.length > 0, "no rows");
  if (/No confirmed deadlines/.test(text)) return; // valid empty state
  for (const li of rows) {
    const day = li.querySelector(".d");
    assert.ok(day, "row has no date cell");
    const when = day.querySelector("small");
    assert.match(day.firstChild.textContent, /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/);
    assert.match(when.textContent, /^(today|\d+ days)$/);
  }
});

test("home: shared saved list (common.js) toggles and persists", async () => {
  const { window } = await load("index.html", { storage: { saved: ["abc"] } });
  const TIG = window.TIG;
  assert.equal(TIG.saved.has("abc"), true);
  assert.equal(TIG.saved.toggle("abc"), false);
  assert.equal(TIG.saved.has("abc"), false);
  assert.equal(TIG.saved.toggle("xyz"), true);
  assert.equal(window.localStorage.getItem("saved"), '["xyz"]');
});
