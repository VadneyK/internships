// Ticket r1-teen-flow-5: the permit page's "Your next step" block offers the main button to Get ready
// plus two alt links to the paycheck and interview pages. Loads the built permit.html in jsdom (no scripts run).
// Run with: node --test tests/r9-teen-flow-5-permit-next-links.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://example.test/";
const DASH = /[‐-―−]/;

function loadStep() {
  const html = fs.readFileSync(path.join(ROOT, "permit.html"), "utf8");
  const doc = new JSDOM(html).window.document;
  const step = doc.querySelector("section#next-step");
  assert.ok(step, "permit.html has section#next-step");
  return step;
}

function resolveTarget(href) {
  const url = new URL(href, BASE + "permit.html");
  assert.equal(url.origin, new URL(BASE).origin, "stays on this site (href " + href + ")");
  const target = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const file = path.join(ROOT, target);
  assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), target + " is a built page in the repo root");
  return target;
}

test("permit next step: main button still goes to ready.html and is not alt", () => {
  const step = loadStep();
  const primary = [...step.querySelectorAll("a.btn")].filter((a) => !a.classList.contains("alt"));
  assert.equal(primary.length, 1, "exactly one primary a.btn in #next-step");
  assert.equal(primary[0].textContent.trim(), "Get ready for day one");
  assert.equal(resolveTarget(primary[0].getAttribute("href")), "ready.html");
});

test("permit next step: paycheck and interview alt links resolve to built pages", () => {
  const step = loadStep();
  const alts = [...step.querySelectorAll("a.btn.alt")];
  const expected = new Map([
    ["See your first paycheck", "paycheck.html"],
    ["Practice the interview", "interview.html"],
  ]);
  assert.equal(alts.length, 2, "two alt buttons in #next-step");
  for (const a of alts) {
    const label = a.textContent.trim();
    assert.ok(expected.has(label), "unexpected alt label: " + label);
    assert.equal(resolveTarget(a.getAttribute("href")), expected.get(label), label + " goes to " + expected.get(label));
  }
  assert.equal(new Set(alts.map((a) => a.textContent.trim())).size, 2, "both labels are present");
});

test("permit next step: no en dash, em dash or other dash characters in the block", () => {
  const step = loadStep();
  const text = step.textContent + " " + [...step.querySelectorAll("[href]")].map((a) => a.getAttribute("href")).join(" ");
  assert.equal(DASH.test(text), false, "no dash characters in #next-step text or hrefs");
});
