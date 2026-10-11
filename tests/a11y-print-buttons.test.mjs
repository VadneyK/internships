// Run with: node --test tests/a11y-print-buttons.test.mjs
// Paper cannot be clicked. Every <button> inside <main> must be hidden by an @media print display: none rule
// (comments removed, same method as r1-a11y-perf-1-print-nav.test.mjs) or be on the allow list below.
// find.html and playbook.html are also checked after their scripts run, because they build buttons in JS.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function braceBody(css, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(openIdx + 1, i);
    }
  }
  throw new Error("unclosed block in style.css");
}

function printBlocks(css) {
  const out = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) out.push(braceBody(css, m.index + m[0].length - 1));
  assert.ok(out.length >= 1, "no @media print block found in style.css");
  return out;
}

const HIDDEN = new Set();
for (const body of printBlocks(CSS)) {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(body))) {
    if (/display\s*:\s*none\s*!\s*important/i.test(m[2])) {
      m[1].split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => HIDDEN.add(s));
    }
  }
}

// Buttons that print on purpose: the teen's chosen answer tile.
const ALLOW = ['.tile[aria-pressed="true"]'];

function matchesAny(el, sels) {
  return sels.some((s) => {
    try {
      return el.matches(s);
    } catch {
      return false;
    }
  });
}

function check(file, doc) {
  const problems = [];
  let count = 0;
  const main = doc.querySelector("main");
  if (!main) return { problems, count };
  for (const b of main.querySelectorAll("button")) {
    count++;
    if (matchesAny(b, [...HIDDEN]) || matchesAny(b, ALLOW)) continue;
    problems.push(`${file}: <button class="${b.className}" id="${b.id}">${b.textContent.trim().slice(0, 30)}</button>`);
  }
  return { problems, count };
}

const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

test("print: every button inside main on every built root page is hidden on paper or allow-listed", () => {
  assert.ok(PAGES.length >= 20, "expected the built root pages");
  const all = [];
  let total = 0;
  for (const f of PAGES) {
    const { problems, count } = check(f, new JSDOM(fs.readFileSync(path.join(ROOT, f), "utf8")).window.document);
    all.push(...problems);
    total += count;
  }
  assert.ok(total > 0, "no buttons found");
  assert.deepEqual(all, [], "buttons that would print as dead boxes:\n" + all.join("\n"));
});

for (const f of ["find.html", "playbook.html"]) {
  test(`print: buttons built by scripts on ${f} are hidden on paper or allow-listed`, async () => {
    const dom = await JSDOM.fromFile(path.join(ROOT, f), {
      runScripts: "dangerously",
      resources: "usable",
      url: "http://localhost/" + f,
      pretendToBeVisual: true,
    });
    await new Promise((r) => setTimeout(r, 1500));
    const { problems } = check(f, dom.window.document);
    assert.deepEqual(problems, [], "buttons that would print as dead boxes:\n" + problems.join("\n"));
    dom.window.close();
  });
}
