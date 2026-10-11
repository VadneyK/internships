// Ticket r9-teen-flow-3: the resume Next steps block links to interview, playbook, find, permit,
// jobs (Jobs that hire teens) and ready (Get ready for day one), in the same btn sm alt style.
// The section keeps class noprint so the print layout does not change.
// Run with: node --test tests/r9-teen-flow-3-resume-next-links.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const TARGETS = ["interview.html", "playbook.html", "find.html", "permit.html", "jobs.html", "ready.html"];

test("r9-teen-flow-3: #next holds links to all six targets as btn sm alt", async () => {
  const { document, errors } = await loadPage("resume.html");
  assert.deepEqual(errors, []);
  const next = document.getElementById("next");
  assert.ok(next, "#next exists");
  const hrefs = [...next.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  for (const t of TARGETS) assert.ok(hrefs.includes(t), "#next links to " + t);
  for (const a of next.querySelectorAll("a")) {
    assert.ok(a.classList.contains("btn") && a.classList.contains("sm") && a.classList.contains("alt"), a.textContent.trim() + " is btn sm alt");
  }
  assert.equal(next.querySelector('a[href="jobs.html"]').textContent.trim(), "Jobs that hire teens");
  assert.equal(next.querySelector('a[href="ready.html"]').textContent.trim(), "Get ready for day one");
});

test("r9-teen-flow-3: every #next target exists as a built page", () => {
  for (const t of TARGETS) {
    assert.ok(fs.existsSync(new URL("../" + t, import.meta.url)), t + " exists at the repo root");
  }
});

test("r9-teen-flow-3: the #next section still has class noprint", async () => {
  const { document } = await loadPage("resume.html");
  const next = document.getElementById("next");
  assert.ok(next.classList.contains("noprint"), "#next keeps noprint");
});

test("r9-teen-flow-3: src and built resume.html both carry the two new links", () => {
  for (const file of ["src/resume.html", "resume.html"]) {
    const src = rd(file);
    assert.match(src, /<a class="btn sm alt" href="jobs\.html">Jobs that hire teens<\/a>/, file + " jobs link");
    assert.match(src, /<a class="btn sm alt" href="ready\.html">Get ready for day one<\/a>/, file + " ready link");
  }
});
