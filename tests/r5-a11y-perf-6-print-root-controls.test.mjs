// Ticket r5-a11y-perf-6: a print-one sheet must never print a button, input, select or textarea.
// G.printOnly copies one block into #printRoot, which sits outside <main>, so the rule for "main button" does not reach it.
// (1) The print block of assets/css/style.css hides #printRoot button (except .tile), input, select, textarea and .noprint,
//     and does not hide tap tiles or links.
// (2) In jsdom, each printOnly entry point is run with window.print stubbed. Every control found in #printRoot at print time
//     (tap tiles excepted, since they are kept on purpose) must match one of the hide selectors.
// Run with: node --test tests/r5-a11y-perf-6-print-root-controls.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8");
const CSS = RAW_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

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

function printBodies(css) {
  const bodies = [];
  const re = /@media\s+print\s*\{/g;
  let m;
  while ((m = re.exec(css))) bodies.push(braceBody(css, m.index + m[0].length - 1));
  assert.ok(bodies.length >= 1, "no @media print block found in style.css");
  return bodies;
}

// Flat rules inside the print blocks: selectors plus declarations.
function rulesIn(text) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const decls = {};
    for (const part of m[2].split(";")) {
      const idx = part.indexOf(":");
      if (idx < 0) continue;
      const prop = part.slice(0, idx).trim();
      if (prop) decls[prop] = part.slice(idx + 1).trim();
    }
    rules.push({ selectors: m[1].split(",").map((s) => s.trim()).filter(Boolean), decls });
  }
  return rules;
}

const PRINT_RULES = printBodies(CSS).flatMap((b) => rulesIn(b));
const HIDE_RULE = PRINT_RULES.find((r) => r.selectors.includes("#printRoot input"));

test("style.css print block: #printRoot controls are display:none !important", () => {
  assert.ok(HIDE_RULE, "a print rule must hide #printRoot input");
  for (const sel of ["#printRoot button:not(.tile)", "#printRoot input", "#printRoot select", "#printRoot textarea", "#printRoot .noprint"]) {
    assert.ok(HIDE_RULE.selectors.includes(sel), `the hide rule must include ${sel}`);
  }
  assert.equal(HIDE_RULE.decls.display, "none !important", "the hide rule must use display: none !important");
});

test("style.css print block: the #printRoot rule does not hide tap tiles or links", () => {
  for (const sel of HIDE_RULE.selectors) {
    assert.ok(!/(^|\s)a$|\.tile\b(?!\))/.test(sel), `${sel} must not hide links or tiles`);
  }
  assert.ok(!HIDE_RULE.selectors.includes("#printRoot button"), "a bare #printRoot button rule would hide tap tiles");
});

// Every print-one entry point, run with window.print stubbed. Each returns the page and the sheet's clickable parts.
const FLOWS = [
  { name: "resume Print or save as PDF", file: "resume.html", run: (d) => d.getElementById("rPrint").click() },
  {
    name: "permit Print my checklist",
    file: "permit.html",
    pre: async (p) => {
      type(p.window, p.document.getElementById("pState"), "ca");
      type(p.window, p.document.getElementById("pAge"), "15");
      type(p.window, p.document.getElementById("pKind"), "job");
      await tick();
      assert.ok(p.document.getElementById("pPacket").innerHTML.length > 0, "the permit packet must be filled before printing");
    },
    run: (d) => d.getElementById("pPrint").click(),
  },
  { name: "share Print this QR code", file: "share.html", run: (d) => d.querySelector("[data-print-qr]").click() },
  { name: "younger Print the safety card", file: "younger.html", wait: 200, run: (d) => d.getElementById("yPrint").click() },
  { name: "interview Print my prep sheet", file: "interview.html", wait: 150, run: (d) => d.getElementById("aPrint").click() },
  ...["outParent", "outGuest", "outSignup", "outEval", "outRef"].map((key) => ({
    name: "leaders data-print " + key,
    file: "leaders.html",
    run: (d) => d.querySelector('[data-print="' + key + '"]').click(),
  })),
  { name: "find Print my list", file: "find.html", run: (d) => d.getElementById("printList").click() },
];

for (const flow of FLOWS) {
  test("print-one sheet has no unhidden control: " + flow.name, async () => {
    const p = await loadPage(flow.file);
    await tick(flow.wait || 60);
    const { window, document } = p;
    if (flow.pre) await flow.pre(p);

    const found = [];
    let calls = 0;
    const hideSelectors = HIDE_RULE.selectors.filter((s) => s.startsWith("#printRoot"));
    window.print = () => {
      calls++;
      const root = document.getElementById("printRoot");
      if (!root) { found.push({ tag: "missing-root", covered: false }); return; }
      for (const el of root.querySelectorAll("button, input, select, textarea")) {
        if (el.classList.contains("tile")) continue; // tap tiles stay on paper on purpose
        const covered = hideSelectors.some((s) => el.matches(s));
        found.push({ tag: el.tagName.toLowerCase(), text: (el.textContent || el.value || "").trim().slice(0, 40), covered });
      }
    };

    flow.run(document);
    assert.equal(calls, 1, flow.name + " should call print once");
    const uncovered = found.filter((f) => !f.covered);
    assert.deepEqual(uncovered, [], "every control in the print copy must match the hide rule");
  });
}
