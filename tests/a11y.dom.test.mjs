// Site-wide structure checks for the built pages in the repo root: headings, labels, ids, names, landmarks and link safety.
// Each page is parsed statically with JSDOM (no scripts run), so these checks see the HTML the server sends.
// Run with: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Same page list as tests/site.dom.test.mjs: built pages in the repo root only. src/ holds templates and is not served.
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

const parsedCache = new Map();
function staticDoc(file) {
  if (!parsedCache.has(file)) {
    parsedCache.set(file, new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document);
  }
  return parsedCache.get(file);
}

const clean = (s) => (s || "").trim();
const describe = (el) => el.outerHTML.slice(0, 90);

function hasLabel(doc, el) {
  if (clean(el.getAttribute("aria-label"))) return true;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy && labelledBy.split(/\s+/).some((id) => doc.getElementById(id))) return true;
  if (el.closest("label")) return true;
  if (el.id) return [...doc.querySelectorAll("label[for]")].some((l) => l.getAttribute("for") === el.id);
  return false;
}

// Each rule takes a parsed document and returns a list of problems (empty when the rule passes).
const RULES = {
  "has exactly one h1": (doc) => {
    const n = doc.querySelectorAll("h1").length;
    return n === 1 ? [] : [`found ${n} h1 elements`];
  },

  "no heading skips more than one level": (doc) => {
    const problems = [];
    let prev = 0;
    for (const h of doc.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
      const level = Number(h.tagName[1]);
      if (prev && level > prev + 1) problems.push(`h${prev} is followed by h${level}: "${clean(h.textContent).slice(0, 60)}"`);
      prev = level;
    }
    return problems;
  },

  "every input (not hidden), select and textarea has a label": (doc) =>
    [...doc.querySelectorAll("input:not([type=hidden]), select, textarea")]
      .filter((el) => !hasLabel(doc, el))
      .map(describe),

  "has no duplicate id values": (doc) => {
    const counts = new Map();
    for (const el of doc.querySelectorAll("[id]")) counts.set(el.id, (counts.get(el.id) || 0) + 1);
    return [...counts].filter(([, n]) => n > 1).map(([id, n]) => `id "${id}" appears ${n} times`);
  },

  "every img has an alt attribute": (doc) =>
    [...doc.querySelectorAll("img")].filter((img) => !img.hasAttribute("alt")).map(describe),

  "every button has text or aria-label": (doc) =>
    [...doc.querySelectorAll("button, input[type=button], input[type=submit], input[type=reset]")]
      // A value attribute names an input button only. On a <button>, value is not a visible label.
      .filter((el) => !clean(el.getAttribute("aria-label")) && !clean(el.textContent) && !(el.tagName === "INPUT" && clean(el.getAttribute("value"))))
      .map(describe),

  "every table has a caption or sits inside an element with aria-label": (doc) =>
    [...doc.querySelectorAll("table")]
      .filter((t) => {
        const caption = [...t.children].find((c) => c.tagName === "CAPTION");
        if (caption && clean(caption.textContent)) return false;
        const region = t.parentElement?.closest("[aria-label]");
        return !(region && clean(region.getAttribute("aria-label")));
      })
      .map(describe),

  'every tabindex="0" element has a role and an aria-label': (doc) =>
    [...doc.querySelectorAll('[tabindex="0"]')]
      .filter((el) => !clean(el.getAttribute("role")) || !clean(el.getAttribute("aria-label")))
      .map(describe),

  "has exactly one main landmark": (doc) => {
    const n = doc.querySelectorAll("main").length;
    return n === 1 ? [] : [`found ${n} <main> elements`];
  },

  'every a[target="_blank"] has rel containing noopener': (doc) =>
    [...doc.querySelectorAll('a[target="_blank"]')]
      .filter((a) => !/\bnoopener\b/.test(a.getAttribute("rel") || ""))
      .map(describe),
};

function checkAll(doc) {
  const out = {};
  for (const [name, rule] of Object.entries(RULES)) out[name] = rule(doc);
  return out;
}

test("the page list has the built pages in the repo root", () => {
  assert.ok(PAGES.includes("index.html"), "index.html missing from the page list");
  assert.ok(PAGES.length >= 18, `expected at least 18 built pages, found ${PAGES.length}`);
});

// ---------- every built page ----------

for (const file of PAGES) {
  for (const [name, rule] of Object.entries(RULES)) {
    test(`${file}: ${name}`, () => {
      assert.deepEqual(rule(staticDoc(file)), []);
    });
  }
}

// ---------- the checks themselves ----------
// A clean fixture must pass every rule. Each mutation breaks exactly one rule, and that rule must report it.

const BASELINE = `<!doctype html><html lang="en"><head><title>Fixture</title></head><body><main>
<h1>Title</h1><h2>Part</h2><h3>Detail</h3>
<form>
  <label for="age">Age</label><input id="age" type="number">
  <label>Name <input type="text"></label>
  <select aria-label="Hub"><option>One</option></select>
  <textarea aria-labelledby="notes"></textarea><span id="notes">Notes</span>
</form>
<img src="pic.png" alt="A photo">
<button>Save</button>
<table><caption>Rates</caption><tr><td>1</td></tr></table>
<div tabindex="0" role="region" aria-label="Filter">filter</div>
<a href="https://example.com/" target="_blank" rel="noopener">Outside</a>
</main></body></html>`;

const MUTATIONS = [
  ["has exactly one h1", "<h2>Part</h2>", "<h1>Second</h1><h2>Part</h2>"],
  ["no heading skips more than one level", "<h3>Detail</h3>", "<h5>Detail</h5>"],
  ["every input (not hidden), select and textarea has a label", '<label for="age">Age</label>', "Age"],
  ["has no duplicate id values", '<span id="notes">Notes</span>', '<span id="notes">Notes</span><span id="age">Again</span>'],
  ["every img has an alt attribute", 'alt="A photo"', ""],
  ["every button has text or aria-label", "<button>Save</button>", "<button></button>"],
  ["every button has text or aria-label", "<button>Save</button>", '<button value="x"></button>'],
  ["every table has a caption or sits inside an element with aria-label", "<caption>Rates</caption>", ""],
  ['every tabindex="0" element has a role and an aria-label', 'role="region" aria-label="Filter"', ""],
  ["has exactly one main landmark", "<form>", "<main></main><form>"],
  ['every a[target="_blank"] has rel containing noopener', 'rel="noopener"', 'rel="external"'],
];

test("fixture: the clean baseline passes every rule", () => {
  const results = checkAll(new JSDOM(BASELINE).window.document);
  for (const [name, problems] of Object.entries(results)) assert.deepEqual(problems, [], name);
});

MUTATIONS.forEach(([rule, from, to], i) => {
  test(`fixture ${i + 1}: breaking "${rule}" is reported`, () => {
    assert.ok(BASELINE.includes(from), `fixture text not found: ${from}`);
    const broken = new JSDOM(BASELINE.replace(from, to)).window.document;
    const problems = RULES[rule](broken);
    assert.ok(problems.length > 0, `rule did not report the broken fixture`);
    for (const [other, list] of Object.entries(checkAll(broken))) {
      if (other !== rule) assert.deepEqual(list, [], `unexpected problem for "${other}"`);
    }
  });
});

// ---------- header controls: tap size and state ----------

const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");

// Every declaration body for a plain selector such as ".theme-btn" or ".nav a" (not :hover or [attr] variants).
function ruleBodies(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...CSS.matchAll(new RegExp("(?:^|[\\s}])" + esc + "\\s*\\{([^}]*)\\}", "g"))].map((m) => m[1]);
}
// Values declared for a property in those bodies. "height" also matches "min-height", and the reverse is not true.
function declared(bodies, prop) {
  const out = [];
  for (const b of bodies) {
    for (const m of b.matchAll(new RegExp("(?:^|[;\\s])(?:min-)?" + prop + "\\s*:\\s*([^;]+)", "g"))) out.push(m[1].trim());
  }
  return out;
}
// Convert "2.75rem" or "44px" to rem (16px = 1rem). Anything else is NaN and fails the check.
function toRem(v) {
  const m = /^([\d.]+)(rem|px)$/.exec(v);
  if (!m) return NaN;
  return m[2] === "rem" ? Number(m[1]) : Number(m[1]) / 16;
}
const MIN_TAP = 2.75; // 44px at the default font size, the same rule as .chip and .btn.sm

test("style.css: .theme-btn is at least 2.75rem wide and tall", () => {
  const bodies = ruleBodies(".theme-btn");
  for (const prop of ["width", "height"]) {
    const values = declared(bodies, prop);
    assert.ok(values.length > 0, `.theme-btn has no ${prop}`);
    for (const v of values) assert.ok(toRem(v) >= MIN_TAP, `.theme-btn ${prop} is ${v}`);
  }
});

test("style.css: .nav a has a min-height of at least 2.75rem", () => {
  const values = declared(ruleBodies(".nav a"), "min-height");
  assert.ok(values.length > 0, ".nav a has no min-height");
  for (const v of values) assert.ok(toRem(v) >= MIN_TAP, `.nav a min-height is ${v}`);
});

const THEME_LABEL = "Switch light and dark mode";

for (const file of PAGES) {
  test(`${file}: no stored theme, no matchMedia: aria-pressed starts "false", each click flips it and data-theme`, async () => {
    const { window, document } = await loadPage(file);
    try {
      const btn = document.getElementById("themeBtn");
      assert.ok(btn, "missing #themeBtn");
      assert.equal(btn.getAttribute("aria-label"), THEME_LABEL);
      assert.equal(btn.getAttribute("aria-pressed"), "false");

      btn.click();
      assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
      assert.equal(btn.getAttribute("aria-pressed"), "true");
      assert.equal(btn.getAttribute("aria-label"), THEME_LABEL);
      assert.equal(window.localStorage.getItem("theme"), "dark");

      btn.click();
      assert.equal(document.documentElement.getAttribute("data-theme"), "light");
      assert.equal(btn.getAttribute("aria-pressed"), "false");
      assert.equal(btn.getAttribute("aria-label"), THEME_LABEL);
      assert.equal(window.localStorage.getItem("theme"), "light");
    } finally {
      window.close();
    }
  });

  test(`${file}: a stored dark theme starts with aria-pressed "true" and one click goes light`, async () => {
    const { window, document } = await loadPage(file, { rawStorage: { theme: "dark" } });
    try {
      const btn = document.getElementById("themeBtn");
      assert.ok(btn, "missing #themeBtn");
      assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
      assert.equal(btn.getAttribute("aria-pressed"), "true");

      btn.click();
      assert.equal(document.documentElement.getAttribute("data-theme"), "light");
      assert.equal(btn.getAttribute("aria-pressed"), "false");
      assert.equal(btn.getAttribute("aria-label"), THEME_LABEL);
      assert.equal(window.localStorage.getItem("theme"), "light");
    } finally {
      window.close();
    }
  });
}
