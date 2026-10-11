// Ticket r7-teen-flow-8: Apply and interview shows a plain card for ages 12, 13 and 18 instead of a silent empty age.
// Run with: node --test tests/r7-teen-flow-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

test("r7-teen-flow-8: saved findprefs age 13 shows the 12 and 13 card with a younger.html link and the age select stays empty", async () => {
  const { window, document, errors } = await loadPage("interview.html", { storage: { findprefs: { age: "13", place: "" } } });
  await tick(150);
  assert.deepEqual(errors, []);
  const out = document.getElementById("aOut");
  assert.match(out.textContent, /The hour check covers ages 14 to 17\. At 12 and 13 the rules differ/);
  const link = out.querySelector('a[href^="younger.html"]');
  assert.ok(link, "card links to younger.html");
  assert.equal(link.getAttribute("href"), "younger.html");
  assert.equal(document.getElementById("aAge").value, "");
  assert.equal(document.getElementById("aStatus").textContent, "", "no status line on load");
  type(window, document.getElementById("aAge"), "15");
  assert.doesNotMatch(out.textContent, /At 12 and 13/, "card is gone once a valid age is picked");
  assert.match(out.textContent, /hours a week offered/, "normal check runs after picking 15");
  assert.equal(document.getElementById("aStatus").getAttribute("role"), "status");
});

test("r7-teen-flow-8: address bar age 12 with a known state links younger.html with that state", async () => {
  const { document, errors } = await loadPage("interview.html", { search: "?age=12&state=ny" });
  await tick(150);
  assert.deepEqual(errors, []);
  assert.equal(document.getElementById("aState").value, "ny");
  assert.equal(document.getElementById("aAge").value, "");
  const link = document.querySelector('#aOut a[href^="younger.html"]');
  assert.ok(link);
  assert.equal(link.getAttribute("href"), "younger.html?state=ny");
});

test("r7-teen-flow-8: a state outside ca, ga, ny, il gets the plain younger.html link", async () => {
  const { document } = await loadPage("interview.html", { search: "?age=13&state=tx" });
  await tick(150);
  assert.equal(document.querySelector('#aOut a[href^="younger.html"]').getAttribute("href"), "younger.html");
});

test("r7-teen-flow-8: age 18 shows the card with a permit.html link and the stated fallback line (no data says hours stop at 18)", async () => {
  const { window, document } = await loadPage("interview.html", { search: "?age=18" });
  await tick(150);
  const out = document.getElementById("aOut");
  assert.match(out.textContent, /The hour check covers ages 14 to 17/);
  assert.doesNotMatch(out.textContent, /Employers set your hours/);
  assert.equal(out.querySelector('a[href="permit.html"]').textContent, "Check your permit");
  type(window, document.getElementById("aAge"), "17");
  assert.doesNotMatch(out.textContent, /The hour check covers ages 14 to 17\. At 12/);
});

test("r7-teen-flow-8: saved 14 to 17 ages show no card and keep the normal empty-state text", async () => {
  const { document } = await loadPage("interview.html", { search: "?age=14&state=ca", storage: { findprefs: { age: "14", place: "" } } });
  await tick(150);
  const out = document.getElementById("aOut");
  assert.doesNotMatch(out.textContent, /Pick your age/);
  assert.equal(document.getElementById("aAge").value, "14");
  const plain = await loadPage("interview.html", { storage: { findprefs: { age: "16", place: "" } } });
  await tick(150);
  assert.doesNotMatch(plain.document.getElementById("aOut").textContent, /At 12 and 13/);
  assert.match(plain.document.getElementById("aOut").textContent, /Pick your age and state to check/);
});
