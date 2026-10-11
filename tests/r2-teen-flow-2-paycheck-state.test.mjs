// Ticket r2-teen-flow-2: the Next links on Your first paycheck carry the picked state.
// (tests/r2-teen-flow-2.test.mjs belongs to another ticket, so this file has its own name.)
// Run with: node --test tests/r2-teen-flow-2-paycheck-state.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

function hrefsIn(document, sel) {
  return [...document.querySelectorAll(sel)].map((a) => a.getAttribute("href"));
}

test("paycheck: choosing New York points safety, permit and interview at ny", async () => {
  const { window, document, errors } = await loadPage("paycheck.html");
  await tick(200);
  type(window, document.getElementById("mState"), "ny");
  await tick(20);
  assert.deepEqual(errors, []);
  for (const h of ["safety.html?state=ny", "permit.html?state=ny", "interview.html?state=ny"]) {
    assert.ok(hrefsIn(document, "main a").includes(h), h);
  }
  assert.ok(hrefsIn(document, "#next-step a").includes("safety.html?state=ny"), "Read Safe at work carries the state");
});

test("paycheck: find and jobs links are not given a state", async () => {
  const { window, document } = await loadPage("paycheck.html");
  await tick(200);
  type(window, document.getElementById("mState"), "ny");
  await tick(20);
  const next = hrefsIn(document, "#mNext a");
  assert.ok(next.includes("find.html"), "find.html unchanged");
  assert.ok(next.includes("jobs.html"), "jobs.html unchanged");
});

test("paycheck: a ?state=ny load also sets the Next links", async () => {
  const { document, errors } = await loadPage("paycheck.html", { search: "?state=ny" });
  await tick(200);
  assert.deepEqual(errors, []);
  assert.ok(hrefsIn(document, "#next-step a").includes("safety.html?state=ny"));
  assert.ok(hrefsIn(document, "#mNext a").includes("interview.html?state=ny"));
  assert.ok(hrefsIn(document, "#mNext a").includes("find.html"));
});
