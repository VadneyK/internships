// Run with: node --test tests/r2-teen-flow-3.test.mjs
// The permit answer links to the interview hours planner with the same state and age filled in.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick, type } from "./dom-helper.mjs";

const planLink = (document) => [...document.querySelectorAll("#pOut a")].find((a) => /Plan the hours you can offer/.test(a.textContent));

test("permit: a 15 year old in California gets the planner link with state and age in the href", async () => {
  const p = await loadPage("permit.html", { search: "?state=ca&age=15&kind=job" }); await tick(150);
  assert.deepEqual(p.errors, []);
  const a = planLink(p.document);
  assert.ok(a, "link is present");
  assert.equal(a.getAttribute("href"), "interview.html?state=ca&age=15#availability");
});

test("permit: no planner link at 13 or at 18", async () => {
  for (const age of ["13", "18"]) {
    const p = await loadPage("permit.html", { search: "?state=ca&age=" + age + "&kind=job" }); await tick(150);
    assert.deepEqual(p.errors, []);
    assert.equal(planLink(p.document), undefined, "no link at age " + age);
  }
});

test("interview: ?state=ny&age=16 selects them and the result names New York", async () => {
  const p = await loadPage("interview.html", { search: "?state=ny&age=16" }); await tick(150);
  assert.deepEqual(p.errors, []);
  assert.equal(p.document.getElementById("aState").value, "ny");
  assert.equal(p.document.getElementById("aAge").value, "16");
  assert.match(p.document.getElementById("aOut").textContent, /New York/);
});

test("interview: the URL wins over saved values", async () => {
  const p = await loadPage("interview.html", { search: "?state=ny&age=16", storage: { interview: { q: {}, refs: [], av: { state: "ga", age: "14" } } } }); await tick(150);
  assert.equal(p.document.getElementById("aState").value, "ny");
  assert.equal(p.document.getElementById("aAge").value, "16");
});

test("interview: bad ?state=zz&age=99 is ignored with no script error", async () => {
  const p = await loadPage("interview.html", { search: "?state=zz&age=99" }); await tick(150);
  assert.deepEqual(p.errors, []);
  assert.equal(p.document.getElementById("aState").value, "");
  assert.equal(p.document.getElementById("aAge").value, "");
  const q = await loadPage("interview.html", { search: "?state=zz&age=99", storage: { interview: { q: {}, refs: [], av: { state: "ga", age: "15" } } } }); await tick(150);
  assert.deepEqual(q.errors, []);
  assert.equal(q.document.getElementById("aState").value, "ga");
  assert.equal(q.document.getElementById("aAge").value, "15");
});

test("interview: saved state still loads when there are no params", async () => {
  const p = await loadPage("interview.html", { storage: { interview: { q: {}, refs: [], av: { state: "ga", age: "16" } } } }); await tick(150);
  assert.equal(p.document.getElementById("aState").value, "ga");
  assert.equal(p.document.getElementById("aAge").value, "16");
});

test("interview: picking NY and 16 carries state and age to permit, state to ready and younger; clearing puts the plain links back", async () => {
  const p = await loadPage("interview.html"); await tick(150);
  const { window, document } = p;
  assert.deepEqual(p.errors, []);
  const permit = () => document.querySelector('main a[href^="permit.html"]:not(#aOut a)').getAttribute("href");
  const ready = () => document.querySelector('main a[href^="ready.html"]').getAttribute("href");
  const younger = () => document.querySelector('main a[href^="younger.html"]').getAttribute("href");
  assert.equal(permit(), "permit.html", "plain before anything is picked");
  assert.equal(ready(), "ready.html");
  assert.equal(younger(), "younger.html");
  type(window, document.getElementById("aState"), "ny");
  type(window, document.getElementById("aAge"), "16");
  assert.equal(permit(), "permit.html?state=ny&age=16");
  assert.equal(ready(), "ready.html?state=ny");
  assert.equal(younger(), "younger.html?state=ny");
  type(window, document.getElementById("aAge"), "");
  type(window, document.getElementById("aState"), "");
  assert.equal(permit(), "permit.html", "cleared: permit link is plain again");
  assert.equal(ready(), "ready.html");
  assert.equal(younger(), "younger.html");
});
