// Run with: node --test tests/print.dom.test.mjs
// Locks in the print stylesheet in assets/css/style.css: light colors in every theme,
// link addresses printed after links in the main content, and the toast and theme button hidden.
// The CSS checks read the stylesheet as text. The last tests load Programs and the playbook in jsdom
// and check that closed <details> in main open for printing and close again afterwards.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
// Comments removed so their text never reads as a selector or a declaration.
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

const RESET_TOKENS = [
  "--paper", "--paper-2", "--surface", "--ink", "--ink-2", "--edge",
  "--tag-bg", "--tag-fg", "--good-bg", "--warn-bg", "--bad-bg",
];
// Text colors that also flip in dark mode, so tags and links stay readable on the light backgrounds.
const TEXT_TOKENS = ["--orange", "--orange-text", "--orange-display", "--good", "--warn", "--bad", "--focus"];

// Expands #abc to #aabbcc and lowercases, so hex values compare equal.
function normHex(hex) {
  const h = hex.trim().toLowerCase().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return "#" + full;
}

// Returns the text between the "{" at openIdx and its matching "}".
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

// Every @media print block in the file, with its position and body.
function printBlocks(css) {
  const out = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    const open = m.index + m[0].length - 1;
    out.push({ start: m.index, body: braceBody(css, open) });
  }
  assert.ok(out.length >= 1, "no @media print block found in style.css");
  return out;
}

// Flat rules inside a print block. The print blocks have no nested braces, so one regex is enough.
function rulesIn(body) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(body))) {
    const decls = {};
    for (const part of m[2].split(";")) {
      const idx = part.indexOf(":");
      if (idx < 0) continue;
      const prop = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (prop) decls[prop] = value;
    }
    rules.push({ selector: m[1].trim(), selectors: m[1].split(",").map((s) => s.trim()), decls });
  }
  return rules;
}

// Strips a trailing !important and reports whether it was there.
function splitImportant(value) {
  const important = /!\s*important\s*$/i.test(value);
  return { value: value.replace(/\s*!\s*important\s*$/i, "").trim(), important };
}

// The light token values, read from the first plain :root block (the light palette).
function lightTokens(css) {
  const m = /^:root \{([^}]*)\}/m.exec(css);
  assert.ok(m, "light :root block not found in style.css");
  const out = {};
  for (const part of m[1].split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const prop = part.slice(0, idx).trim();
    if (!prop.startsWith("--")) continue;
    out[prop] = part.slice(idx + 1).trim();
  }
  return out;
}

const LIGHT = lightTokens(CSS);
const LIGHT_HEX = new Set(
  Object.values(LIGHT).filter((v) => /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v)).map(normHex)
);

// All print rules, flattened, with the index of the block each came from.
function allPrintRules(css) {
  const rules = [];
  for (const block of printBlocks(css)) {
    for (const r of rulesIn(block.body)) rules.push({ ...r, blockStart: block.start });
  }
  return rules;
}

// The print rule that resets the color tokens on the root element.
function rootResetRule(css) {
  return allPrintRules(css).find(
    (r) => r.selectors.includes(":root") && r.selectors.includes(":root[data-theme]")
  );
}

test("print: the root reset sets every color token to its light value", () => {
  const rule = rootResetRule(CSS);
  assert.ok(rule, "no print rule for ':root, :root[data-theme]' found");
  for (const token of [...RESET_TOKENS, ...TEXT_TOKENS]) {
    assert.ok(token in rule.decls, `print root reset is missing ${token}`);
    const { value, important } = splitImportant(rule.decls[token]);
    assert.equal(normHex(value), normHex(LIGHT[token]), `${token} should print as ${LIGHT[token]}`);
    assert.ok(important, `${token} needs !important to beat the dark theme blocks`);
  }
});

test("print: the root reset also forces the light color scheme", () => {
  const rule = rootResetRule(CSS);
  assert.ok(rule, "no print rule for ':root, :root[data-theme]' found");
  const { value, important } = splitImportant(rule.decls["color-scheme"] || "");
  assert.equal(value, "light");
  assert.ok(important);
});

test("print: the root reset comes after both dark theme blocks, so placement also wins", () => {
  const printStart = printBlocks(CSS)[0].start;
  const systemDark = CSS.indexOf("@media (prefers-color-scheme: dark)");
  const manualDark = CSS.indexOf(':root[data-theme="dark"]');
  assert.ok(systemDark >= 0 && manualDark >= 0, "dark theme blocks not found");
  assert.ok(printStart > systemDark, "print block must come after the system dark block");
  assert.ok(printStart > manualDark, "print block must come after the manual dark block");
});

test("print: every hex color used in print blocks is already in the light palette", () => {
  for (const block of printBlocks(CSS)) {
    const hexes = block.body.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
    for (const hex of hexes) {
      assert.ok(LIGHT_HEX.has(normHex(hex)), `print uses ${hex}, which is not a light palette color`);
    }
  }
});

test("print: a link address is printed after links in main, but not after buttons or .noprint links", () => {
  const rules = allPrintRules(CSS);
  const addressRules = rules.filter((r) => r.decls.content && r.decls.content.includes("attr(href)"));
  assert.equal(addressRules.length, 1, "exactly one print rule should print link addresses");
  const rule = addressRules[0];
  assert.ok(
    rule.selector.startsWith('main a[href^="http"]'),
    `address rule should target absolute links in main, got: ${rule.selector}`
  );
  assert.ok(rule.selector.includes(":not(.btn)"), "address rule must skip .btn");
  assert.ok(rule.selector.includes(":not(.noprint)"), "address rule must skip .noprint");
  assert.ok(rule.selector.endsWith("::after"), "address rule must use ::after");
  assert.equal(rule.decls.content, '" (" attr(href) ")"');
});

test("print: the toast and the theme button are hidden", () => {
  const hidden = allPrintRules(CSS).filter((r) => r.decls.display && splitImportant(r.decls.display).value === "none");
  const hiddenSelectors = new Set(hidden.flatMap((r) => r.selectors));
  assert.ok(hiddenSelectors.has(".toast"), ".toast must be display: none in print");
  assert.ok(hiddenSelectors.has(".theme-btn"), ".theme-btn must be display: none in print");
});

// Loads a page in jsdom and waits for the program list to finish loading (the Programs page shows "Loading" first).
async function loadWithLists(file) {
  const page = await loadPage(file);
  for (let i = 0; i < 80 && /Loading/.test(page.document.getElementById("count")?.textContent || ""); i++) await tick(25);
  return page;
}

// Checks one page: some details are closed, beforeprint opens every details in main, afterprint restores the earlier state.
function assertPrintOpensAndRestores(window, document, label) {
  const items = [...document.querySelectorAll("main details")];
  assert.ok(items.length > 0, label + ": expected details inside main");
  const before = items.map((d) => d.open);
  assert.ok(before.some((open) => !open), label + ": expected at least one closed details before printing");
  window.dispatchEvent(new window.Event("beforeprint"));
  assert.ok(items.every((d) => d.open), label + ": every details in main should be open while printing");
  window.dispatchEvent(new window.Event("afterprint"));
  assert.deepEqual(items.map((d) => d.open), before, label + ": each details should go back to its earlier open or closed state");
}

test("print: on Programs, every details opens for printing and goes back afterwards, keeping a card opened by hand open", async () => {
  const { window, document, errors } = await loadWithLists("find.html");
  assert.deepEqual(errors, []);
  assert.ok(document.querySelectorAll("article.prog").length > 0, "program cards should be rendered");
  const handOpened = document.querySelector("article.prog details");
  handOpened.open = true;
  assertPrintOpensAndRestores(window, document, "find");
  assert.equal(handOpened.open, true, "a card opened by hand should stay open after printing");
});

test("print: on the playbook, every details opens for printing and goes back afterwards, keeping the open template open", async () => {
  const { window, document, errors } = await loadPage("playbook.html");
  assert.deepEqual(errors, []);
  assert.equal(document.querySelectorAll("main details").length, 6, "playbook should have six details in main");
  assertPrintOpensAndRestores(window, document, "playbook");
});

test("print: a second beforeprint before afterprint does not lose the original states", async () => {
  const { window, document } = await loadPage("playbook.html");
  const items = [...document.querySelectorAll("main details")];
  const before = items.map((d) => d.open);
  window.dispatchEvent(new window.Event("beforeprint"));
  window.dispatchEvent(new window.Event("beforeprint"));
  window.dispatchEvent(new window.Event("afterprint"));
  assert.deepEqual(items.map((d) => d.open), before);
});

test("print: afterprint with no earlier beforeprint changes nothing", async () => {
  const { window, document } = await loadPage("playbook.html");
  const items = [...document.querySelectorAll("main details")];
  const before = items.map((d) => d.open);
  window.dispatchEvent(new window.Event("afterprint"));
  assert.deepEqual(items.map((d) => d.open), before);
});
