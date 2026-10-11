// Tap targets: checkboxes and breadcrumb links are big enough to tap on a phone (WCAG 2.2, 2.75rem rule).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";

const css = fs.readFileSync(new URL("../assets/css/style.css", import.meta.url), "utf8");

// Every rule block as { selectors: [...], body: "..." }, in file order.
function rules(text) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!sel || sel.startsWith("@")) continue;
    out.push({ selectors: sel.split(",").map((s) => s.replace(/\s+/g, " ").trim()), body: m[2] });
  }
  return out;
}

// Declarations from every rule whose selector list contains the exact selector, later rules win.
function declarations(selector) {
  const decl = {};
  for (const r of rules(css)) {
    if (!r.selectors.includes(selector)) continue;
    for (const d of r.body.split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decl[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
  }
  return decl;
}

const rem = (v) => {
  const m = /^(\d*\.?\d+)rem$/.exec(v || "");
  return m ? parseFloat(m[1]) : NaN;
};

test("style.css sizes input[type=checkbox] at 1.25rem or more and sets an accent-color", () => {
  const d = declarations('input[type="checkbox"]');
  assert.ok(rem(d.width) >= 1.25, "width is " + d.width);
  assert.ok(rem(d.height) >= 1.25, "height is " + d.height);
  assert.ok(d["accent-color"], "accent-color is missing");
});

test("style.css makes .breadcrumb a an inline-flex link at least 2.75rem tall", () => {
  const d = declarations(".breadcrumb a");
  assert.equal(d.display, "inline-flex");
  assert.ok(rem(d["min-height"]) >= 2.75, "min-height is " + d["min-height"]);
});

test("style.css gives a label that wraps a checkbox a min-height of at least 2.75rem", () => {
  const d = declarations('label:has(> input[type="checkbox"])');
  assert.ok(rem(d["min-height"]) >= 2.75, "min-height is " + d["min-height"]);
});

async function waitForCheckboxes(page, min = 1) {
  for (let i = 0; i < 60 && page.document.querySelectorAll("input[type=checkbox]").length < min; i++) await tick(50);
}

async function assertCheckboxes(file, { wait = false } = {}) {
  const page = await loadPage(file);
  if (wait) await waitForCheckboxes(page, 1);
  const boxes = [...page.document.querySelectorAll("input[type=checkbox]")];
  assert.ok(boxes.length > 0, file + " has no checkbox to check");
  for (const box of boxes) {
    const style = box.getAttribute("style") || "";
    assert.doesNotMatch(style, /\b(width|height)\s*:/, file + " checkbox " + (box.id || box.dataset.k || "") + " has an inline size");
    const label = box.closest("label") || (box.id && page.document.querySelector('label[for="' + box.id + '"]'));
    assert.ok(label, file + " checkbox " + (box.id || box.dataset.k || "") + " has no label");
  }
  return page;
}

test("paycheck.html, resume.html and ready.html checkboxes carry no inline size and each has a label", async () => {
  await assertCheckboxes("paycheck.html");
  await assertCheckboxes("resume.html");
  await assertCheckboxes("ready.html");
});

test("interview.html checkboxes (after data loads) carry no inline size and each has a label", async () => {
  await assertCheckboxes("interview.html", { wait: true });
});

test("ready.html checkboxes still work after the inline size moved to the stylesheet", async () => {
  const page = await loadPage("ready.html");
  const boxes = page.document.querySelectorAll("#readyList input[type=checkbox]");
  assert.equal(boxes.length, 8);
  assert.equal(boxes[0].getAttribute("style").includes("margin-top"), true);
});
