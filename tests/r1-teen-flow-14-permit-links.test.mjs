// Ticket r1-teen-flow-8: the permit page's "Still unsure?" paragraph links to Jobs and Safe at work.
// Run with: node --test tests/r1-teen-flow-14-permit-links.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

function stillUnsure(document) {
  const h = [...document.querySelectorAll("h2")].find((el) => el.textContent.trim() === "Still unsure?");
  return h ? h.parentElement.querySelector("p") : null;
}

test("permit: the Still unsure? paragraph links to jobs.html and safety.html", async () => {
  const p = await loadPage("permit.html"); await tick();
  assert.deepEqual(p.errors, []);
  const para = stillUnsure(p.document);
  assert.ok(para, "Still unsure? paragraph is present");
  const jobs = [...para.querySelectorAll("a")].find((a) => a.textContent.trim() === "jobs that hire teens");
  const safe = [...para.querySelectorAll("a")].find((a) => a.textContent.trim() === "which jobs are off limits under 18");
  assert.ok(jobs, "jobs that hire teens link is present");
  assert.equal(jobs.getAttribute("href"), "jobs.html");
  assert.ok(safe, "off limits under 18 link is present");
  assert.equal(safe.getAttribute("href"), "safety.html");
});

test("permit: both new hrefs point at pages that exist in the repo", async () => {
  for (const file of ["jobs.html", "safety.html"]) {
    assert.ok(existsSync(join(repo, file)), file + " exists");
  }
});

test("permit: the Still unsure? paragraph keeps its older links and has no em or en dash", async () => {
  const p = await loadPage("permit.html"); await tick();
  const para = stillUnsure(p.document);
  const hrefs = [...para.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  for (const h of ["rules.html", "states.html", "ready.html", "find.html", "languages.html", "contribute.html"]) {
    assert.ok(hrefs.includes(h), h + " still linked");
  }
  assert.doesNotMatch(para.textContent, /[\u2013\u2014]/);
});
