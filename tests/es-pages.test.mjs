// Spanish pages (docs/adr/0008-spanish-pages.md). Each es/<name>.html must stay a faithful copy of <name>.html:
// inside main, the same section ids in the same order, the same number of headings per section, the same numbers and the
// same links (an official Spanish twin listed in src/es/_links.json counts as its English page). A block only one side has
// is named on purpose: data-es-only on the Spanish side, EN_ONLY below for the English side. So an English edit that changes
// a fact fails here until the Spanish page is updated too.
// It also checks the build's work: lang="es", hreflang both ways, the language link, ../ links, the Spanish layout words,
// the draft note while a page waits for review, the CSP hashes, byte ceilings, axe, and the Spanish labels from es.js.
// The Spanish Playbook tools (es-playbook.js) have their own tests: tests/es-playbook.dom.test.mjs and tests/es-playbook.test.mjs.
// Run with: node --test tests/es-pages.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage, waitFor, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://vadneyk.github.io/internships/";
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const PAGES = fs.readdirSync(path.join(ROOT, "src/es")).filter((f) => f.endsWith(".html") && !f.startsWith("_")).map((f) => f.slice(0, -5)).sort();
const LINKS = JSON.parse(read("src/es/_links.json")).twins;
const ES_TO_EN = new Map(LINKS.map((l) => [new URL(l.es).href, new URL(l.en).href]));

// English blocks the Spanish page leaves out on purpose, by page. Each is a tool that runs in English only (ADR 0008).
// A function gets the English main and returns the elements to drop.
const EN_ONLY = {
  index: {
    reason: "the age picker and the closing-soon list are drawn by home.js from English program cards",
    drop: (m) => ["#picker", "#hubHelp", "#matchStatus", "#matches", "#matchMore", "#soonNote", "#soonStatus"].map((s) => m.querySelector(s)),
  },
  playbook: { reason: "nothing: the people map and the message builder run in Spanish too (es-playbook.js)", drop: () => [] },
  rules: { reason: "nothing: the Rules page has no tool", drop: () => [] },
};

// The scripts each Spanish page loads, in order. Home and Rules need only the Spanish labels (lib: none). The Playbook runs
// playbook.js with its Spanish words from es-playbook.js, which must load first.
const SCRIPTS = {
  index: ["../assets/js/common.js", "../assets/js/es.js"],
  playbook: ["../assets/js/lib.js", "../assets/js/common.js", "../assets/js/es.js", "../assets/js/es-playbook.js", "../assets/js/playbook.js"],
  rules: ["../assets/js/common.js", "../assets/js/es.js"],
};

const header = (name) => dict(read(`src/es/${name}.html`).split("\n---\n")[0]);
function dict(head) {
  return Object.fromEntries([...head.matchAll(/^(\w+):\s*(.*)$/gm)].map((m) => [m[1], m[2].trim()]));
}
const parse = (rel) => new JSDOM(read(rel)).window.document;
const enUrl = (name) => BASE + name + ".html";
const esUrl = (name) => BASE + "es/" + name + ".html";

// A link as the English page would have it: resolved, a Spanish twin mapped back, es/ pages mapped to their English twin.
function canonical(href, pageUrl) {
  let u = new URL(href, pageUrl).href;
  if (ES_TO_EN.has(u)) u = ES_TO_EN.get(u);
  if (u.startsWith(BASE + "es/")) u = BASE + u.slice((BASE + "es/").length);
  return u;
}
const numbersOf = (el) => {
  const text = el.textContent + " " + [...el.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).join(" ");
  return (text.match(/\d+(?:[.,:]\d+)*/g) || []).sort();
};

// main of one page, ready to compare: noscript out (the Spanish pages need no script to read), and the one-sided blocks out.
function prepared(name, lang) {
  const doc = parse(lang === "es" ? `es/${name}.html` : `${name}.html`);
  const main = doc.querySelector("main");
  main.querySelectorAll("noscript").forEach((n) => n.remove());
  if (lang === "es") main.querySelectorAll("[data-es-only]").forEach((n) => n.remove());
  else EN_ONLY[name].drop(main).forEach((n) => { assert.ok(n, name + ": an EN_ONLY block is missing from the English page; update EN_ONLY"); n.remove(); });
  const pageUrl = lang === "es" ? esUrl(name) : enUrl(name);
  return [...main.querySelectorAll(":scope > section")].map((s, i) => ({
    id: s.id || "top" + i,
    headings: s.querySelectorAll("h1, h2, h3, h4").length,
    numbers: numbersOf(s),
    links: [...s.querySelectorAll("a[href]")].map((a) => canonical(a.getAttribute("href"), pageUrl)).sort(),
  }));
}

test("every Spanish page has an English twin and an EN_ONLY entry, and the twin list is real", () => {
  assert.deepEqual(PAGES, ["index", "playbook", "rules"]);
  for (const p of PAGES) {
    assert.ok(fs.existsSync(path.join(ROOT, "src", p + ".html")), p);
    assert.ok(fs.existsSync(path.join(ROOT, "es", p + ".html")), "es/" + p + ".html is built");
    assert.ok(EN_ONLY[p] && EN_ONLY[p].reason.length > 10, p + " has an EN_ONLY entry with a reason");
  }
  const enSrc = PAGES.map((p) => read(`src/${p}.html`)).join("\n");
  const esSrc = PAGES.map((p) => read(`src/es/${p}.html`)).join("\n");
  for (const l of LINKS) {
    assert.match(l.read, /^\d{4}-\d{2}-\d{2}$/, l.es + " has a read date");
    assert.ok(l.title && l.title.length > 3, l.es + " has its Spanish title");
    assert.ok(enSrc.includes(`"${l.en}"`), l.en + " is linked from an English page (else drop the row)");
    assert.ok(esSrc.includes(`"${l.es}"`), l.es + " is linked from a Spanish page");
    assert.ok(!esSrc.includes(`"${l.en}"`), l.en + " has a Spanish twin, so the Spanish page links the twin");
  }
});

for (const name of PAGES) {
  test(`es/${name}.html matches ${name}.html: sections, headings, numbers and links`, () => {
    const en = prepared(name, "en"), es = prepared(name, "es");
    assert.deepEqual(es.map((s) => s.id), en.map((s) => s.id), "the same sections in the same order");
    for (let i = 0; i < en.length; i++) {
      const at = `${name} section ${en[i].id}`;
      assert.equal(es[i].headings, en[i].headings, at + ": the same number of headings");
      assert.deepEqual(es[i].numbers, en[i].numbers, at + ": the same numbers (dates, prices, ages, hours, phone numbers)");
      assert.deepEqual(es[i].links, en[i].links, at + ": the same links, or their official Spanish twins");
    }
  });

  test(`es/${name}.html: lang, hreflang both ways, the language link and the draft state`, () => {
    const es = parse(`es/${name}.html`), en = parse(`${name}.html`);
    assert.equal(es.documentElement.lang, "es");
    assert.equal(en.documentElement.lang, "en");
    const want = [["en", (name === "index" ? BASE : enUrl(name))], ["es", (name === "index" ? BASE + "es/" : esUrl(name))], ["x-default", (name === "index" ? BASE : enUrl(name))]];
    for (const doc of [es, en]) {
      const alts = [...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.getAttribute("hreflang"), l.getAttribute("href")]);
      assert.deepEqual(alts, want, "hreflang alternates");
    }
    assert.equal(es.querySelector('link[rel="canonical"]').getAttribute("href"), want[1][1]);
    const sw = es.querySelector('nav.nav a[lang="en"]');
    assert.ok(sw && sw.getAttribute("hreflang") === "en" && sw.getAttribute("href") === `../${name}.html` && sw.textContent === "English");
    const back = en.querySelector('nav.nav a[lang="es"]');
    assert.ok(back && back.getAttribute("hreflang") === "es" && back.getAttribute("href") === `es/${name}.html` && back.textContent === "Español");
    assert.equal(es.querySelector("nav.nav").lastElementChild, sw, "the language link ends the nav");

    const pending = (header(name).review || "pending") === "pending";
    const note = es.querySelector("main #draft-note");
    const noindex = !!es.querySelector('meta[name="robots"][content="noindex"]');
    const inMap = read("sitemap.xml").includes(`<loc>${want[1][1]}</loc>`);
    if (pending) {
      assert.ok(note, "a page waiting for review shows the draft note");
      assert.ok(note.hasAttribute("data-es-only"));
      assert.match(note.textContent, /borrador/i);
      assert.match(note.textContent, /fluidez/);
      assert.ok(note.querySelector(`a[href="../${name}.html"][hreflang="en"]`), "the note links the English page");
      assert.ok(note.compareDocumentPosition(es.querySelector("main h1")) & 4, "the note comes before the h1");
      assert.ok(noindex, "a draft is noindex");
      assert.ok(!inMap, "a draft is not in the sitemap");
    } else {
      assert.match(header(name).review, /^\S.* \d{4}-\d{2}-\d{2}$/, "review: <reviewer> <YYYY-MM-DD>");
      assert.ok(!note && !noindex && inMap, "a reviewed page drops the note and noindex and is in the sitemap");
    }
  });

  test(`es/${name}.html: every local link and asset exists, and links that leave Spanish say so`, () => {
    const doc = parse(`es/${name}.html`);
    for (const el of doc.querySelectorAll("[href], [src]")) {
      const ref = el.getAttribute("href") ?? el.getAttribute("src");
      if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(ref)) continue;
      const url = new URL(ref, esUrl(name));
      assert.ok(url.href.startsWith(BASE), ref + " stays on the site");
      const file = decodeURIComponent(url.pathname.slice("/internships/".length)) || "index.html";
      assert.ok(fs.existsSync(path.join(ROOT, file)), `${ref} (${file}) exists`);
      if (el.tagName === "A" && file.endsWith(".html") && !file.startsWith("es/")) assert.equal(el.getAttribute("hreflang"), "en", ref + " leads to an English page");
    }
    const html = read(`es/${name}.html`);
    assert.ok(!/[\u2013\u2014]/.test(html + read(`src/es/${name}.html`) + read("src/es/_layout.json")), "no em or en dash");
    assert.ok(!html.includes("{{"), "no token left");
  });

  test(`es/${name}.html: CSP hashes match the inline scripts, and only the scripts it needs load`, () => {
    const html = read(`es/${name}.html`);
    const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1];
    const hashes = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => "'sha256-" + crypto.createHash("sha256").update(m[1]).digest("base64") + "'");
    assert.ok(hashes.length > 0);
    for (const h of hashes) assert.ok(csp.includes(h), "CSP lists " + h);
    const srcs = [...html.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
    assert.deepEqual(srcs, SCRIPTS[name]);
  });
}

// The words of the shared layout (header, footer, skip link, print line): every English text and label has its Spanish
// words. A new English string in src/_layout.html with no row in src/es/_layout.json fails here.
test("the Spanish header and footer have no English text left", () => {
  const words = (doc) => {
    const out = [];
    for (const root of [doc.querySelector(".skip"), doc.querySelector("header.top"), doc.querySelector(".print-source"), doc.querySelector("footer.foot")]) {
      const walk = doc.createTreeWalker(root, 4);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) if (/\p{L}/u.test(n.nodeValue)) out.push(n.nodeValue.trim());
      for (const el of [root, ...root.querySelectorAll("*")]) for (const a of ["aria-label", "title"]) if (el.hasAttribute(a)) out.push(a + "=" + el.getAttribute(a));
    }
    return out;
  };
  const en = words(parse("index.html")), es = words(parse("es/index.html"));
  assert.equal(es.length, en.length, "the same pieces of text");
  const same = en.filter((t, i) => es[i] === t);
  assert.deepEqual(same, [], "texts still in English on the Spanish page");
});

// Byte ceilings (ADR 0007) for the Spanish pages, which the root page tables do not see. Set 2026-10-16 to the measured size
// rounded up to 100. Spanish runs about 20 percent longer than English, so es/rules.html (40,776 bytes) is over the 34,800 byte
// root page limit its English twin has. PENDING PERSON APPROVAL for that row. code is fonts.css, style.css, common.js and es.js
// (100,488 bytes; the same three shared files as 404.html, plus es.js), so a change to a shared file can trip these rows too.
// 2026-10-17: es.js lost the Copy buttons (575 bytes), so Home and Rules code 100500 to 100200. es/playbook.html now runs the
// people map and the message builder: lib.js, playbook.js and es-playbook.js join, code 100500 to 179500 (179,440 bytes, about
// 9 KB over its English twin, which is es-playbook.js) and html 25000 to 28800 (28,749 bytes). PENDING PERSON APPROVAL for that row.
const CEILINGS = {
  "es/index.html": { html: 21700, code: 100200 },
  "es/playbook.html": { html: 28800, code: 179500 },
  "es/rules.html": { html: 40800, code: 100200 },
};
test("Spanish pages stay under their byte ceilings (page and first-load code)", () => {
  assert.deepEqual(Object.keys(CEILINGS).sort(), PAGES.map((p) => `es/${p}.html`), "one row per Spanish page");
  for (const [file, c] of Object.entries(CEILINGS)) {
    const html = read(file);
    assert.ok(Buffer.byteLength(html) <= c.html, `${file} is ${Buffer.byteLength(html)} bytes, ceiling ${c.html}`);
    const refs = [...html.matchAll(/<(?:script src|link rel="stylesheet" href)="\.\.\/([^"?]+)/g)].map((m) => m[1]);
    const code = refs.reduce((s, r) => s + fs.statSync(path.join(ROOT, r)).size, 0);
    assert.ok(code <= c.code, `${file} loads ${code} bytes of code, ceiling ${c.code}`);
  }
});

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
for (const name of PAGES) {
  test(`axe: es/${name}.html has no WCAG A/AA violations, with the Menu shut and open`, async () => {
    const { window, document, errors } = await loadPage(`es/${name}.html`);
    window.eval(axeSource);
    const run = async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false } } })).violations.map((v) => v.id + ": " + v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | "));
    const shut = await run();
    await waitFor(() => document.querySelector("button.menu-btn"));
    const menu = document.querySelector("button.menu-btn");
    assert.equal(menu.textContent, "Menú", "es.js puts Spanish on the Menu button");
    menu.click();
    assert.deepEqual([...shut, ...(await run())], []);
    assert.deepEqual(errors || [], []);
  });
}

test("es/playbook.html: a Copy button copies its example and the toast is in Spanish", async () => {
  const { window, document } = await loadPage("es/playbook.html", { setup: (w) => { w.__copied = []; } });
  Object.defineProperty(window.navigator, "clipboard", { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true });
  const btns = [...document.querySelectorAll("main [data-copy]")];
  assert.equal(btns.length, 8, "the eight examples (the builder replaced the blank template)");
  for (const b of btns) assert.ok(document.getElementById(b.getAttribute("data-copy")), "each Copy button names its template");
  document.querySelector('[data-copy="t1"]').click();
  await tick(20);
  assert.equal(window.__copied[0], document.getElementById("t1").textContent);
  assert.equal(window.__copied.length, 1, "one copy per tap: only playbook.js wires the Copy buttons");
  assert.equal(document.getElementById("toast").textContent, "Copiado");
  window.TIG.toast("Press Ctrl+C or Cmd+C to copy");
  assert.equal(document.getElementById("toast").textContent, "Presiona Ctrl+C o Cmd+C para copiar");
  window.TIG.toast("Something else");
  assert.equal(document.getElementById("toast").textContent, "Something else", "other messages pass through");
});
