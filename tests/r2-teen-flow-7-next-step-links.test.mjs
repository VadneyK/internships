// Ticket r2-teen-flow-7: every page in the teen chain ends with a #next-step block whose button goes to a real
// file in the repo root, with no path escape, and the Calendar, Playbook, Resume, Interview, Permit, Ready chain
// only moves forward. This file is separate because tests/r2-teen-flow-7.test.mjs already holds another ticket's tests.
// Run with: node --test tests/r2-teen-flow-7-next-step-links.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["find", "calendar", "playbook", "resume", "interview", "permit", "ready", "paycheck", "safety", "younger", "jobs"].map((p) => p + ".html");
const CHAIN = ["calendar.html", "playbook.html", "resume.html", "interview.html", "permit.html", "ready.html"];
const DASHES = /[\u2013\u2014]/;

function parse(file) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  return new JSDOM(html).window.document;
}

function nextStep(file) {
  const block = parse(file).querySelector("#next-step");
  assert.ok(block, file + " has a #next-step block");
  return block;
}

// Returns the repo-root file a link points to, or null when the link is not a plain local file
// (absolute path, scheme, protocol-relative, backslash, or a ".." segment), or the file does not exist.
function localFile(href) {
  if (typeof href !== "string" || href === "") return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/") || href.includes("\\")) return null;
  const file = href.split(/[?#]/)[0];
  if (file === "" || file.split("/").some((seg) => seg === "..")) return null;
  const full = path.resolve(ROOT, file);
  if (!full.startsWith(ROOT + path.sep)) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return file;
}

test("every teen page has one #next-step section.nextstep with a button to a real page", () => {
  for (const file of PAGES) {
    const block = nextStep(file);
    assert.ok(block.classList.contains("nextstep"), file + " next-step block has class nextstep");
    const buttons = block.querySelectorAll("a.btn:not(.alt)");
    if (file === "jobs.html") continue; // checked in the next test: jobs has three buttons by design
    assert.equal(buttons.length, 1, file + " has exactly one a.btn in #next-step");
    const href = buttons[0].getAttribute("href");
    assert.ok(localFile(href), file + " next step " + href + " is a real local file with no path escape");
  }
});

test("jobs: its next-step buttons each go to a real local page, and the first one is the primary button", () => {
  const buttons = nextStep("jobs.html").querySelectorAll("a.btn");
  assert.equal(buttons.length, 3, "jobs has three next-step buttons");
  assert.equal(buttons[0].id, "jPermitNext", "the first button is the primary permit button");
  for (const a of buttons) {
    const href = a.getAttribute("href");
    assert.ok(localFile(href), "jobs next step " + href + " is a real local file with no path escape");
  }
});

test("next-step links never point at a missing file or an escaping path", () => {
  assert.equal(localFile("../etc/passwd"), null);
  assert.equal(localFile("/permit.html"), null);
  assert.equal(localFile("https://example.com/"), null);
  assert.equal(localFile("missing-page.html"), null);
  assert.equal(localFile("#next-step"), null);
  assert.equal(localFile("permit.html?age=15"), "permit.html");
});

test("next-step blocks have no en dash or em dash", () => {
  for (const file of PAGES) {
    assert.equal(DASHES.test(nextStep(file).textContent), false, file + " next step has no en or em dash");
  }
});

test("chain: Calendar, Playbook, Resume, Interview, Permit, Ready each link forward, never back to an earlier step", () => {
  for (let i = 0; i < CHAIN.length - 1; i++) {
    const href = nextStep(CHAIN[i]).querySelector("a.btn").getAttribute("href");
    const file = localFile(href);
    const pos = CHAIN.indexOf(file);
    assert.ok(pos > i, CHAIN[i] + " next step " + href + " must be a later step in the chain, not an earlier one");
  }
});
