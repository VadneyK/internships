// Ticket r3-teen-flow-15-empty-jobs-link: the empty cards on Programs (find.html) and Calendar (calendar.html)
// each offer one link to jobs.html, next to the existing offers. Absent when there are results.
// Run with: node --test tests/r3-teen-flow-15-empty-jobs-link.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const JOBS_TEXT = "Want a regular job instead? See jobs that hire teens";
const NO_MATCH_Q = "zzzznomatch";

// find.js loads the programs with fetch, then renders; wait until the count label is no longer "Loading".
async function loadFind(search) {
  const p = await loadPage("find.html", { search });
  for (let i = 0; i < 80 && /Loading/.test(p.document.getElementById("count").textContent); i++) await tick(25);
  return p;
}

test("r3-teen-flow-15: Programs empty card has one jobs.html link with the plain text", async () => {
  const { document, errors } = await loadFind("?age=12&q=" + NO_MATCH_Q);
  const out = document.getElementById("out");
  assert.match(out.textContent, /Nothing matches yet/, "empty card is shown");
  const links = [...out.querySelectorAll("a[href='jobs.html']")];
  assert.equal(links.length, 1, "exactly one jobs.html link in the empty card");
  assert.equal(links[0].textContent.trim(), "See jobs that hire teens");
  assert.match(out.textContent, /Want a regular job instead\? See jobs that hire teens/);
  assert.ok(out.querySelector("a[href='younger.html']"), "the existing ages 12 to 14 offer stays");
  assert.ok(document.getElementById("emptyReset"), "the Clear all filters button stays");
  assert.deepEqual(errors, []);
});

test("r3-teen-flow-15: Programs empty card has the jobs link for a grown-up age too", async () => {
  const { document, errors } = await loadFind("?age=15&q=" + NO_MATCH_Q);
  const out = document.getElementById("out");
  assert.match(out.textContent, /Nothing matches yet/, "empty card is shown");
  assert.equal(out.querySelectorAll("a[href='jobs.html']").length, 1, "one jobs.html link");
  assert.deepEqual(errors, []);
});

test("r3-teen-flow-15: Programs has no jobs link in the empty card when results exist", async () => {
  const { document, errors } = await loadFind("?age=15");
  const out = document.getElementById("out");
  assert.ok(out.querySelectorAll("article.prog").length > 0, "results are shown");
  assert.equal(out.textContent.includes("Want a regular job instead?"), false, "no empty-card jobs line");
  assert.equal(out.querySelector("a[href='jobs.html']"), null, "no jobs.html link inside the results");
  assert.deepEqual(errors, []);
});

test("r3-teen-flow-15: Calendar nothing-found card has one jobs.html link after the anytime link", async () => {
  const p = await loadPage("calendar.html", { search: "?m=7&at=city:san-diego" });
  await tick(200);
  const { document, errors } = p;
  const n = document.querySelectorAll("#cClose li, #cOpen li").length;
  assert.equal(n, 0, "the filter gives zero programs");
  const card = document.getElementById("cNone");
  assert.equal(card.hidden, false, "nothing-found card is shown");
  const links = [...card.querySelectorAll("a[href='jobs.html']")];
  assert.equal(links.length, 1, "exactly one jobs.html link in #cNone");
  assert.equal(links[0].textContent.trim(), "See jobs that hire teens");
  assert.match(card.textContent, /Want a regular job instead\? See jobs that hire teens/);
  assert.equal(card.querySelector("a").id, "cNoneAnytime", "the anytime link is still the first link");
  assert.deepEqual(errors, []);
});

test("r3-teen-flow-15: Calendar jobs link inside #cNone is hidden when the month has results", async () => {
  const p = await loadPage("calendar.html", { search: "?m=2" });
  await tick(200);
  const { document, errors } = p;
  const n = document.querySelectorAll("#cClose li, #cOpen li").length;
  assert.ok(n > 0, "the month has programs");
  assert.equal(document.getElementById("cNone").hidden, true, "nothing-found card is hidden");
  assert.deepEqual(errors, []);
});
