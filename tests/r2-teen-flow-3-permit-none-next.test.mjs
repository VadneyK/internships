// Ticket r2-teen-flow-3: "no permit" answers (verdict none or adult) end with a "What to do next" step before the sources line.
// Run with: node --test tests/r2-teen-flow-3-permit-none-next.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

// The answer card's paragraphs, in order, and the step paragraph if present.
function cardParts(document) {
  const card = document.querySelector("#pOut article");
  const paras = [...card.querySelectorAll("p")];
  const step = paras.find((p) => /^What to do next:/.test(p.textContent.trim())) || null;
  const sources = paras.find((p) => /^Read on /.test(p.textContent.trim())) || null;
  return { card, paras, step, sources };
}

test("permit: 18 or older job answer ends with a next step to jobs and resume, before the sources line", async () => {
  const p = await loadPage("permit.html", { search: "?state=ca&age=18&kind=job" }); await tick();
  assert.deepEqual(p.errors, []);
  assert.equal(p.document.querySelector("#pOut .tag").textContent, "No permit");
  const { step, sources, paras } = cardParts(p.document);
  assert.ok(step, "What to do next paragraph is present");
  assert.ok(sources, "sources line is present");
  assert.ok(paras.indexOf(step) < paras.indexOf(sources), "next step comes before the sources line");
  const jobs = step.querySelector("a[href='jobs.html?age=18']");
  assert.ok(jobs, "links jobs.html?age=18");
  const resume = step.querySelector("a[href='resume.html']");
  assert.ok(resume, "links resume.html");
  assert.doesNotMatch(p.document.querySelector("#pOut").textContent, /undefined|NaN/);
  assert.doesNotMatch(step.textContent, /[\u2013\u2014]/);
});

test("permit: volunteer answer under the permit age links to volunteer roles, not jobs", async () => {
  const p = await loadPage("permit.html", { search: "?state=ca&age=15&kind=volunteer" }); await tick();
  assert.deepEqual(p.errors, []);
  assert.equal(p.document.querySelector("#pOut .tag").textContent, "No permit");
  const { step, sources, paras } = cardParts(p.document);
  assert.ok(step, "What to do next paragraph is present");
  assert.ok(paras.indexOf(step) < paras.indexOf(sources), "next step comes before the sources line");
  assert.ok(step.querySelector("a[href='find.html?kind=volunteer']"), "links find.html?kind=volunteer");
  assert.equal(step.querySelector("a[href^='jobs.html']"), null, "no jobs link for a volunteer answer");
  assert.doesNotMatch(step.textContent, /[\u2013\u2014]/);
});

test("permit: age 12 or 13 with no-permit job answer links bare jobs.html", async () => {
  const p = await loadPage("permit.html", { search: "?state=ga&age=16&kind=job" }); await tick();
  const { step } = cardParts(p.document);
  assert.ok(step.querySelector("a[href='jobs.html?age=16']"), "links jobs.html?age=16 for age 16");
});

test("permit: the need and young answers get no next-step paragraph", async () => {
  const need = await loadPage("permit.html", { search: "?state=ca&age=15&kind=job" }); await tick();
  assert.equal(need.document.querySelector("#pOut .tag").textContent, "You need one");
  assert.equal(cardParts(need.document).step, null);
  const young = await loadPage("permit.html", { search: "?state=ca&age=12&kind=job" }); await tick();
  assert.equal(young.document.querySelector("#pOut .tag").textContent, "Too young for this");
  assert.equal(cardParts(young.document).step, null);
});
