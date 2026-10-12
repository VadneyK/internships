// WCAG 2.5.3 (Label in Name): a link or button whose aria-label is set must contain its visible text, so a voice
// control user who says what they see can activate it. Every root page is loaded in jsdom with its real scripts in its
// default state. find.html is also checked after Show more and after picking a place; index.html (the home page) is
// also checked after the picker has results. Text inside .sr spans, hidden nodes and script or style is not visible
// text. Controls with no letter or digit in their visible text (a star glyph, the theme button) are skipped.
// ALLOWLIST must stay empty: a fix is the only way to clear a violation.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

/* Known violations: { page, text } where text is the normalized visible text. Must stay empty. */
const ALLOWLIST = [];

const SKIP_IN_TEXT = "script, style, template, .sr, [hidden], [aria-hidden='true']";

function norm(s) { return String(s || "").replace(/\s+/g, " ").trim().toLowerCase(); }

function visibleText(el) {
  const clone = el.cloneNode(true);
  for (const x of clone.querySelectorAll(SKIP_IN_TEXT)) x.remove();
  return norm(clone.textContent);
}

function visiblePieces(el) {
  const clone = el.cloneNode(true);
  for (const x of clone.querySelectorAll(SKIP_IN_TEXT)) x.remove();
  const out = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { const t = norm(c.textContent); if (/[\p{L}\p{N}]/u.test(t)) out.push(t); }
      else if (c.nodeType === 1) walk(c);
    }
  };
  walk(clone);
  return out;
}

// Returns a list of "<tag> visible text -> aria-label" strings, one per control whose name does not contain its visible text.
export function labelInNameViolations(doc) {
  const out = [];
  for (const el of doc.querySelectorAll("a, button, [role=button]")) {
    if (!el.hasAttribute("aria-label")) continue;
    const vis = visibleText(el);
    if (!/[\p{L}\p{N}]/u.test(vis)) continue;
    const label = norm(el.getAttribute("aria-label"));
    // Visible text sits in separate pieces (a name and a count badge, a month and a number). Each piece must be in the label,
    // in any order, so "Jan" and "28" are found in "January, 28 programs".
    const pieces = visiblePieces(el);
    if (!label.includes(vis) && !pieces.every((x) => label.includes(x))) out.push(el.tagName.toLowerCase() + " \"" + vis + "\" -> \"" + label + "\"");
  }
  return out;
}

const seen = []; // { where, checked }

function check(where, doc) {
  const viol = labelInNameViolations(doc);
  const allowed = ALLOWLIST.filter((x) => where.startsWith(x.page));
  const problems = [];
  const matched = new Set();
  for (const v of viol) {
    const hit = allowed.find((x) => v.includes("\"" + x.text + "\""));
    if (hit) matched.add(hit); else problems.push(v);
  }
  for (const x of allowed) if (!matched.has(x)) problems.push("allowlist entry no longer matches, remove it: " + x.page + " " + x.text);
  seen.push({ where, count: viol.length });
  assert.deepEqual(problems, [], where + ": label does not contain visible text");
}

test("negative self-test: a link whose aria-label drops its visible text fails the check", () => {
  const bad = new JSDOM("<a href='https://example.org' aria-label='Go'>Official page</a>").window.document;
  const v = labelInNameViolations(bad);
  assert.equal(v.length, 1, "one violation expected");
  assert.match(v[0], /official page/);
  const good = new JSDOM("<a href='https://example.org' aria-label='Official page for Camp Maple'>Official page</a>").window.document;
  assert.equal(labelInNameViolations(good).length, 0);
  const sym = new JSDOM("<button aria-label='Switch light and dark mode'>&#9681;</button><button aria-label='Save Camp to my list'>&#9733;</button>").window.document;
  assert.equal(labelInNameViolations(sym).length, 0, "symbol-only controls are skipped");
  const sr = new JSDOM("<a href='#x' aria-label='Open list, 3 items'>Open list<span class='sr'> (new)</span></a>").window.document;
  assert.equal(labelInNameViolations(sr).length, 0, ".sr text is not visible text");
});

for (const f of PAGES) {
  test(f + ": aria-label on links and buttons contains the visible text", async () => {
    const { document } = await loadPage(f);
    await tick(150);
    check(f, document);
  });
}

test("index.html: label in name holds after the picker has results", async () => {
  const { document, window } = await loadPage("index.html");
  const age = document.getElementById("pAge");
  assert.ok(age && [...age.options].some((o) => o.value === "14"), "age 14 option exists");
  type(window, age, "14");
  // Wait for the results to appear (up to 5 seconds) so a busy machine running the whole suite does not turn a slow data load into a failure.
  for (let i = 0; i < 100 && !document.querySelectorAll("#matches a, #matches button").length; i++) await tick(50);
  await tick(200);
  assert.ok(document.querySelectorAll("#matches a, #matches button").length > 0, "picker shows results");
  check("index.html (after picker results)", document);
});

test("find.html: label in name holds after Show more", async () => {
  const { document } = await loadPage("find.html");
  const more = document.getElementById("more");
  assert.ok(more, "Show more button exists");
  more.click();
  await tick(150);
  check("find.html (after Show more)", document);
});

test("find.html: label in name holds after picking a place", async () => {
  const { document, window } = await loadPage("find.html");
  const sel = document.getElementById("place");
  const opt = [...sel.options].find((o) => o.value.startsWith("city:"));
  assert.ok(opt, "a city option exists");
  type(window, sel, opt.value);
  await tick(150);
  const more = document.getElementById("more");
  if (more) { more.click(); await tick(150); }
  check("find.html (after picking a place)", document);
});

test.after(() => {
  console.log("\nLabel in name report (controls checked per state, violations):");
  for (const { where, count } of seen) console.log("  " + where + ": " + count + " violation(s)");
});
