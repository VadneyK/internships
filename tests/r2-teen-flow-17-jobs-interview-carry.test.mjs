import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick, type } from "./dom-helper.mjs";

const href = (document) => document.getElementById("jInterviewNext").getAttribute("href");

test("jobs: the interview button carries age 14 to 17 and a supported state, else it is plain", async () => {
  const { window, document, errors } = await loadPage("jobs.html", { search: "?age=16&state=CA" }); await tick(200);
  assert.equal(href(document), "interview.html?state=ca&age=16#availability");
  type(window, document.getElementById("jAge"), "15");
  assert.equal(href(document), "interview.html?state=ca&age=15#availability");
  type(window, document.getElementById("jState"), "NY");
  assert.equal(href(document), "interview.html?state=ny&age=15#availability");
  for (const a of ["u14", "18", ""]) { type(window, document.getElementById("jAge"), a); assert.equal(href(document), "interview.html", "age " + a); }
  type(window, document.getElementById("jAge"), "16");
  type(window, document.getElementById("jState"), "AK");
  assert.equal(href(document), "interview.html", "state the interview page lacks");
  type(window, document.getElementById("jState"), "");
  assert.equal(href(document), "interview.html", "no state");
  assert.deepEqual(errors, []);
});

test("interview.html opened from the carried href shows age 16 and the state", async () => {
  const j = await loadPage("jobs.html", { search: "?age=16&state=CA" }); await tick(200);
  const u = new URL(href(j.document), "http://x/");
  const { document } = await loadPage("interview.html", { search: u.search }); await tick(250);
  assert.equal(document.getElementById("aAge").value, "16");
  assert.equal(document.getElementById("aState").value, "ca");
});
