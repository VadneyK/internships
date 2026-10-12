// Ticket r1-teen-flow-5: the permit lede ends after the checklist sentence. The two "last read" dates
// sit in a p.small.muted directly under the "This is a summary" callout. Reads the built permit.html.
// Run with: node --test tests/r1-teen-flow-22-permit-lede-short.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDoc() {
  const html = fs.readFileSync(path.join(ROOT, "permit.html"), "utf8");
  return new JSDOM(html).window.document;
}

test("permit lede ends after the checklist sentence and has no last-read text", () => {
  const doc = loadDoc();
  const lede = doc.querySelector("p.lede");
  assert.ok(lede, "permit.html has p.lede");
  assert.doesNotMatch(lede.textContent, /last read/i, "lede has no 'last read' text");
  assert.doesNotMatch(lede.textContent, /Oct 9, 2026|Oct 7, 2026/, "lede has no read dates");
  assert.match(lede.textContent.trim(), /a checklist you can print or a message you can send to your school\.$/);
});

test("permit small line under the summary callout has both read dates", () => {
  const doc = loadDoc();
  const callout = [...doc.querySelectorAll("div.callout")].find((d) =>
    /This is a summary/.test(d.textContent)
  );
  assert.ok(callout, "callout 'This is a summary' exists");
  const small = callout.nextElementSibling;
  assert.ok(small && small.tagName === "P", "a p directly follows the callout");
  assert.ok(small.classList.contains("small") && small.classList.contains("muted"), "p has small and muted classes");
  assert.equal(
    small.textContent.trim(),
    "Most pages last read Oct 9, 2026. The California card was read Oct 7, 2026."
  );
});

test("permit page still has exactly one h1", () => {
  const doc = loadDoc();
  assert.equal(doc.querySelectorAll("h1").length, 1, "one h1");
});
