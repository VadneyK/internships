// Ticket r1-teen-flow-5: a paid city program answer goes to Find, and "check first" answers get a next step.
// Run with: node --test tests/r8-teen-flow-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const L = require(join(repo, "assets/js/lib.js"));
const permits = JSON.parse(readFileSync(join(repo, "data/permits.json"), "utf8"));

// The answer card's "What to do next" paragraph and the "Who to call" paragraph, if present.
function parts(document) {
  const paras = [...document.querySelectorAll("#pOut article p")];
  const step = paras.find((p) => /^What to do next:/.test(p.textContent.trim())) || null;
  const call = paras.find((p) => /^Who to call:/.test(p.textContent.trim())) || null;
  return { paras, step, call };
}

test("permit: the verdicts this test relies on come from the data", () => {
  assert.equal(L.permitFor(permits, "ga", "16", "program").verdict, "none");
  assert.equal(L.permitFor(permits, "ga", "16", "job").verdict, "none");
  assert.equal(L.permitFor(permits, "bc", "16", "program").verdict, "ask");
  assert.equal(L.permitFor(permits, "bc", "15", "job").verdict, "ask");
});

test("permit: a no-permit program answer at 16 links to find.html?age=16, not jobs", async () => {
  const p = await loadPage("permit.html", { search: "?state=ga&age=16&kind=program" }); await tick();
  assert.deepEqual(p.errors, []);
  assert.equal(p.document.querySelector("#pOut .tag").textContent, "No permit");
  const { step } = parts(p.document);
  assert.ok(step, "What to do next paragraph is present");
  const link = [...step.querySelectorAll("a")].find((a) => a.textContent.trim() === "Find programs you can apply to");
  assert.ok(link, "Find programs you can apply to link is present");
  assert.equal(link.getAttribute("href"), "find.html?age=16");
  assert.equal(step.querySelector("a[href^='jobs.html']"), null, "no jobs link for a program answer");
  assert.doesNotMatch(p.document.querySelector("#pOut").textContent, /undefined|NaN/);
});

test("permit: a no-permit job answer at 16 still goes to jobs.html", async () => {
  const p = await loadPage("permit.html", { search: "?state=ga&age=16&kind=job" }); await tick();
  const { step } = parts(p.document);
  assert.ok(step.querySelector("a[href='jobs.html?age=16']"), "links jobs.html?age=16");
  assert.ok(step.querySelector("a[href='resume.html']"), "links resume.html");
  assert.equal(step.querySelector("a[href^='find.html']"), null, "no Find link for a job answer");
});

test("permit: a check-first program answer names the office first, then links Find programs", async () => {
  const p = await loadPage("permit.html", { search: "?state=bc&age=16&kind=program" }); await tick();
  assert.deepEqual(p.errors, []);
  assert.equal(p.document.querySelector("#pOut .tag").textContent, "Check first");
  const { paras, step, call } = parts(p.document);
  assert.ok(call, "Who to call paragraph is present");
  assert.ok(step, "What to do next paragraph is present");
  assert.ok(paras.indexOf(call) < paras.indexOf(step), "next step comes after Who to call");
  assert.ok(step.querySelector("a[href='find.html?age=16']"), "links find.html?age=16");
  assert.match(step.textContent, /Find programs/);
  assert.doesNotMatch(step.textContent, /[\u2013\u2014]/);
});

test("permit: a check-first job answer links Find jobs with the age", async () => {
  const p = await loadPage("permit.html", { search: "?state=bc&age=15&kind=job" }); await tick();
  const { step } = parts(p.document);
  assert.ok(step, "What to do next paragraph is present");
  assert.ok(step.querySelector("a[href='jobs.html?age=15']"), "links jobs.html?age=15");
  assert.match(step.textContent, /Find jobs/);
});

test("permit: need answers still have no next-step paragraph", async () => {
  const p = await loadPage("permit.html", { search: "?state=ca&age=15&kind=job" }); await tick();
  assert.equal(p.document.querySelector("#pOut .tag").textContent, "You need one");
  assert.equal(parts(p.document).step, null);
});
