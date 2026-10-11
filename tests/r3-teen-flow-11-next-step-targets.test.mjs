// Ticket r3-teen-flow-11: every teen page's "Your next step" button goes to a real built page other than itself.
// Reads the built root pages with jsdom (no scripts run). Run with: node --test tests/r3-teen-flow-11-next-step-targets.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://example.test/";

const TEEN_PAGES = [
  "find.html", "permit.html", "interview.html", "paycheck.html", "calendar.html", "resume.html",
  "playbook.html", "ready.html", "younger.html", "jobs.html", "safety.html", "parents.html",
  "share.html", "rules.html", "states.html",
];

// Pages allowed to have no #next-step block. Keep this short.
const ALLOW_NO_NEXT_STEP = new Set(["rules.html", "states.html"]);

function parse(file) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  return new JSDOM(html).window.document;
}

test("teen pages: each built page has section#next-step, or is on the short allow list", () => {
  for (const file of TEEN_PAGES) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), file + " is a built page in the repo root");
    const doc = parse(file);
    const step = doc.querySelector("section#next-step");
    if (!step) {
      assert.ok(ALLOW_NO_NEXT_STEP.has(file), file + " has no #next-step block and is not on the allow list");
    }
  }
});

test("teen pages: each next-step block has exactly one primary a.btn (no alt class) and it goes somewhere new", () => {
  for (const file of TEEN_PAGES) {
    const doc = parse(file);
    const step = doc.querySelector("section#next-step");
    if (!step) {
      assert.ok(ALLOW_NO_NEXT_STEP.has(file), file + " has no #next-step block and is not on the allow list");
      continue;
    }
    const primary = [...step.querySelectorAll("a.btn")].filter((a) => !a.classList.contains("alt"));
    assert.equal(primary.length, 1, file + " has exactly one primary a.btn in #next-step");

    const href = primary[0].getAttribute("href") || "";
    const url = new URL(href, BASE + file);
    assert.equal(url.origin, new URL(BASE).origin, file + " next step stays on this site (href " + href + ")");

    const target = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    assert.ok(target.length > 0, file + " next step has a page path (href " + href + ")");
    assert.ok(fs.existsSync(path.join(ROOT, target)) && fs.statSync(path.join(ROOT, target)).isFile(),
      file + " next step target " + target + " exists in the repo root");
    assert.notEqual(target, file, file + " next step does not point at the same page");
  }
});
