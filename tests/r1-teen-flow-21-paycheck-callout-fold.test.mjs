// Ticket r1-teen-flow-4: on the paycheck page, the grey callout above the estimate keeps its
// "Facts, not tax advice" paragraph visible. The Social Security and Medicare text and the parent-business
// exception (with the permit.html link) sit in a details that is closed on load.
// Loads the built paycheck.html in jsdom (no scripts run).
// Run with: node --test tests/r1-teen-flow-21-paycheck-callout-fold.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUMMARY = "Working for your parent's own business?";

function loadDoc() {
  const html = fs.readFileSync(path.join(ROOT, "paycheck.html"), "utf8");
  return new JSDOM(html).window.document;
}

function calloutAboveParts(doc) {
  const parts = doc.querySelector("nav#parts");
  assert.ok(parts, "paycheck.html has nav#parts");
  const callout = parts.previousElementSibling;
  assert.ok(callout && callout.classList.contains("callout"), "the element before #parts is the grey callout");
  return callout;
}

test("the callout keeps the Facts paragraph visible, outside any details", () => {
  const callout = calloutAboveParts(loadDoc());
  const facts = [...callout.querySelectorAll(":scope > p")].find((p) => p.textContent.includes("Facts, not tax advice."));
  assert.ok(facts, "the Facts, not tax advice paragraph is a direct child of the callout");
  assert.equal(facts.closest("details"), null, "the Facts paragraph is not inside a details");
});

test("the callout has one details with the exact summary, closed on load", () => {
  const callout = calloutAboveParts(loadDoc());
  const details = callout.querySelectorAll("details");
  assert.equal(details.length, 1, "exactly one details in the callout");
  const d = details[0];
  assert.equal(d.querySelector(":scope > summary")?.textContent.trim(), SUMMARY, "summary text is kept word for word");
  assert.equal(d.hasAttribute("open"), false, "the details is closed on load");
});

test("the details holds the Social Security text, the exception and the permit.html link", () => {
  const d = calloutAboveParts(loadDoc()).querySelector("details");
  const text = d.textContent.replace(/\s+/g, " ");
  assert.ok(text.includes("Social Security and Medicare apply to most jobs in every state."), "Social Security and Medicare text is inside the details");
  assert.ok(text.includes("working for your parent's own sole proprietorship, or a partnership where both partners are your parents, when you are under 18."), "parent-business exception is inside the details");
  const link = d.querySelector('a[href="permit.html"]');
  assert.ok(link, "the details contains a link to permit.html");
  assert.equal(link.textContent, "the work permit finder", "the link text is kept word for word");
});

test("the source file has the same fold", () => {
  const src = fs.readFileSync(path.join(ROOT, "src", "paycheck.html"), "utf8");
  assert.ok(src.includes(`<details><summary>${SUMMARY}</summary>`), "src/paycheck.html has the details with the summary");
});
