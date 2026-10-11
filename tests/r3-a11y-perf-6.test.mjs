// Breadcrumbs: the eight text trails are a real Breadcrumb navigation, the separator is drawn by CSS, and no other page has one.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const SEPARATOR = "›"; // the old &rsaquo; character, which must no longer appear in any text node

// The eight pages, with the parent link and the current page name exactly as the old trail paragraph had them.
const CASES = [
  { file: "calendar.html", href: "find.html", parent: "Programs", current: "What opens when" },
  { file: "interview.html", href: "resume.html", parent: "Resume", current: "Apply and interview" },
  { file: "languages.html", href: "ready.html", parent: "Get ready", current: "In your language" },
  { file: "paycheck.html", href: "ready.html", parent: "Get ready", current: "Your first paycheck" },
  { file: "safety.html", href: "ready.html", parent: "Get ready", current: "Safe at work" },
  { file: "permit.html", href: "ready.html", parent: "Get ready", current: "Work permit finder" },
  { file: "younger.html", href: "ready.html", parent: "Get ready", current: "Ages 12 to 14" },
  { file: "jobs.html", href: "ready.html", parent: "Get ready", current: "Jobs that hire teens" },
  { file: "parents.html", href: "ready.html", parent: "Get ready", current: "For parents" },
];

// Static jsdom parse of a built page. No scripts run, which is enough for structure checks.
const docs = new Map();
function doc(file) {
  if (!docs.has(file)) docs.set(file, new JSDOM(read(file)).window.document);
  return docs.get(file);
}

function textNodes(root) {
  const out = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n.nodeValue);
  return out;
}

const crumbs = (d) => d.querySelectorAll('nav[aria-label="Breadcrumb"]');

for (const c of CASES) {
  test(`${c.file}: exactly one Breadcrumb nav with an ol of two li`, () => {
    const d = doc(c.file);
    assert.equal(crumbs(d).length, 1, "expected one Breadcrumb nav");
    const ol = crumbs(d)[0].querySelectorAll(":scope > ol");
    assert.equal(ol.length, 1, "expected one ol inside the Breadcrumb nav");
    assert.equal(ol[0].querySelectorAll(":scope > li").length, 2, "expected two li in the ol");
  });

  test(`${c.file}: first li links to ${c.href} with the text "${c.parent}"`, () => {
    const first = crumbs(doc(c.file))[0].querySelector("ol > li:first-child");
    const link = first.querySelector("a");
    assert.ok(link, "first li has no link");
    assert.equal(link.getAttribute("href"), c.href);
    assert.equal(link.textContent.trim(), c.parent);
    assert.equal(first.querySelectorAll("a").length, 1, "first li should hold only the parent link");
  });

  test(`${c.file}: second li is the current page as plain text with aria-current="page"`, () => {
    const second = crumbs(doc(c.file))[0].querySelector("ol > li:last-child");
    assert.equal(second.getAttribute("aria-current"), "page");
    assert.equal(second.querySelectorAll("a").length, 0, "current page should not be a link");
    assert.equal(second.textContent.trim(), c.current);
  });

  test(`${c.file}: no text node contains the separator character U+203A`, () => {
    for (const value of textNodes(doc(c.file).documentElement)) {
      assert.ok(!value.includes(SEPARATOR), `text node has U+203A: ${JSON.stringify(value)}`);
    }
  });

  test(`${c.file}: the old trail paragraph is gone`, () => {
    const d = doc(c.file);
    const trails = [...d.querySelectorAll("p.small.muted")].filter((p) => {
      const text = p.textContent.replace(/\s+/g, " ").trim();
      return text.startsWith(c.parent) && text.includes(c.current);
    });
    assert.equal(trails.length, 0, "a p.small.muted trail paragraph is still there");
  });
}

// The separator is drawn by a pseudo-element rule on the breadcrumb li, so screen readers do not announce it.
test("style.css: a ::before or ::after rule draws the breadcrumb separator on the li", () => {
  const css = read("assets/css/style.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const separator = rules.filter(([, selector, body]) =>
    selector.split(",").some((s) => /breadcrumb\b[^,]*\bli\b/.test(s) && /::(before|after)\s*$/.test(s.trim())) && /\bcontent\s*:/.test(body));
  assert.ok(separator.length > 0, "no .breadcrumb li ::before/::after rule with a content declaration");
});

// Every other built page has no Breadcrumb nav.
test("all other built pages have no Breadcrumb nav", () => {
  const others = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && !CASES.some((c) => c.file === f));
  assert.ok(others.length > 0, "no other built pages found");
  for (const f of others) {
    assert.equal(crumbs(doc(f)).length, 0, `${f} has a Breadcrumb nav`);
  }
});
