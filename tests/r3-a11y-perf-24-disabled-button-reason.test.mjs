// A disabled button must look disabled, and the playbook's disabled "Save my plan as an image" button must say why.
// Part 1 checks style.css: a .btn:disabled (or .btn[disabled]) rule changes opacity, border style or color, and the forced-colors block uses GrayText for it.
// Part 2 checks playbook.html in jsdom: with no names, #planPng is disabled and aria-describedby points to a visible hint that says to add a name first.
//   After a name is typed, the button is enabled and the hint is hidden.
// Part 3 greps assets/js and src for "disabled": only the known case (the save button) exists, and it has a CSS rule.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSS = fs.readFileSync(path.join(ROOT, "assets/css/style.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

test("CSS: .btn:disabled changes the look, and forced colors use GrayText", () => {
  // Rules outside @media: find the one whose selector list includes .btn:disabled or .btn[disabled].
  const re = /([^{}@]+)\{([^{}]*)\}/g;
  let m, disabledBody = null;
  while ((m = re.exec(CSS))) {
    const sels = m[1].split(",").map((s) => s.replace(/\s+/g, " ").trim());
    if (sels.some((s) => /^\.btn(:disabled|\[disabled\])/.test(s))) { disabledBody = (disabledBody || "") + m[2]; }
  }
  assert.ok(disabledBody, "style.css needs a .btn:disabled or .btn[disabled] rule");
  assert.ok(/(^|;)\s*(opacity|border-style|color|background(-color)?)\s*:/.test(disabledBody), "the disabled rule must change opacity, border style, color or background");

  // The forced-colors block: a rule for the disabled button that uses GrayText.
  const start = CSS.indexOf("@media (forced-colors: active)");
  assert.ok(start >= 0, "style.css needs a forced-colors block");
  const block = CSS.slice(start, CSS.indexOf("\n}\n", start) + 3);
  const fc = [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].some((x) => /\.btn(:disabled|\[disabled\])/.test(x[1]) && /GrayText/.test(x[2]));
  assert.ok(fc, "the forced-colors block needs a disabled .btn rule that uses GrayText");
});

test("playbook: no names means the save button is disabled and its hint says to add a name first", async () => {
  const { window, document, errors } = await loadPage("playbook.html");
  assert.deepEqual(errors, []);
  const btn = document.getElementById("planPng");
  assert.equal(btn.disabled, true);
  const ids = (btn.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
  assert.ok(ids.length > 0, "the button needs aria-describedby");
  const hint = document.getElementById(ids[0]);
  assert.ok(hint, "aria-describedby must point to an element that exists");
  assert.match(hint.textContent, /add a name first/i);
  assert.doesNotMatch(hint.textContent, /[\u2013\u2014]/, "no dash characters");
  assert.equal(hint.hidden, false, "the hint must be visible when no names are typed");
  assert.notEqual(window.getComputedStyle(hint).display, "none");

  type(window, document.getElementById("pn0"), "Mrs. Lee");
  await tick();
  assert.equal(btn.disabled, false, "typing a name enables the button");
  assert.ok(hint.hidden || hint.textContent.trim() === "", "the hint is hidden or empty once a name is typed");
});

test("disabled: only the known case in assets/js and src, and it has a CSS rule", () => {
  const files = [];
  for (const dir of ["assets/js", "src"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (/\.(js|html)$/.test(f)) files.push(path.join(dir, f));
    }
  }
  const hits = [];
  for (const f of files) {
    fs.readFileSync(path.join(ROOT, f), "utf8").split("\n").forEach((line, i) => {
      if (/disabled/.test(line)) hits.push(f + ":" + (i + 1));
    });
  }
  const known = hits.filter((h) => /^assets\/js\/playbook\.js:/.test(h));
  assert.equal(hits.length, known.length, "unexpected disabled usage: " + hits.filter((h) => !known.includes(h)).join(", "));
  // 2026-10-17: one case. Write to them is only drawn once a card has a name (the card shows "Add a name" instead), so it never needed disabled.
  assert.equal(known.length, 1, "expected exactly one disabled case in playbook.js (the save button)");
  assert.ok(/\.btn:disabled|\.btn\[disabled\]/.test(CSS), "the disabled buttons need the CSS rule");
});
