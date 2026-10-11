// Ticket r3-teen-flow-4: the permit page's "Your next step" Interview button and the "Still unsure?" Jobs link carry the
// picked state and age (age 14 to 17 only, state only when in L.PERMIT_STATES). Links in the #pOut card are left alone.
// Run with: node --test tests/r3-teen-flow-4-permit-next-carry.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The page an href points to must be a built page in the repo root.
function assertBuiltPage(href, expected) {
  const target = href.split(/[?#]/)[0];
  assert.equal(target, expected, "href " + href + " goes to " + expected);
  const file = path.join(ROOT, target);
  assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), target + " is a built page in the repo root");
}

function links(document) {
  const interview = document.querySelector('main a[href^="interview.html"]');
  const jobs = [...document.querySelectorAll('main a[href^="jobs.html"]')].filter((a) => !document.getElementById("pOut").contains(a));
  return { interview, jobs };
}

test("permit: picking state ca and age 16 carries both to interview.html and jobs.html", async () => {
  const p = await loadPage("permit.html"); await tick();
  assert.deepEqual(p.errors, []);
  type(p.window, p.document.getElementById("pState"), "ca");
  type(p.window, p.document.getElementById("pAge"), "16");
  await tick();
  const { interview, jobs } = links(p.document);
  assert.equal(interview.getAttribute("href"), "interview.html?state=ca&age=16");
  assertBuiltPage(interview.getAttribute("href"), "interview.html");
  assert.equal(jobs.length, 1, "one Jobs link in Still unsure");
  assert.equal(jobs[0].getAttribute("href"), "jobs.html?state=ca&age=16");
  assertBuiltPage(jobs[0].getAttribute("href"), "jobs.html");
});

test("permit: ages 14 and 17 carry, and an unsupported state does not", async () => {
  const p = await loadPage("permit.html"); await tick();
  type(p.window, p.document.getElementById("pState"), "other");
  type(p.window, p.document.getElementById("pAge"), "14");
  await tick();
  let { interview, jobs } = links(p.document);
  assert.equal(interview.getAttribute("href"), "interview.html", "an unsupported state gives the plain href");
  assert.equal(jobs[0].getAttribute("href"), "jobs.html");
  type(p.window, p.document.getElementById("pState"), "ny");
  type(p.window, p.document.getElementById("pAge"), "17");
  await tick();
  ({ interview, jobs } = links(p.document));
  assert.equal(interview.getAttribute("href"), "interview.html?state=ny&age=17");
  assert.equal(jobs[0].getAttribute("href"), "jobs.html?state=ny&age=17");
});

test("permit: ages 12, 13 and 18 keep the plain hrefs with no leftover query", async () => {
  const p = await loadPage("permit.html"); await tick();
  type(p.window, p.document.getElementById("pState"), "ga");
  for (const age of ["12", "13", "18"]) {
    type(p.window, p.document.getElementById("pAge"), age);
    await tick();
    const { interview, jobs } = links(p.document);
    assert.equal(interview.getAttribute("href"), "interview.html", "age " + age + " interview plain");
    assert.equal(jobs[0].getAttribute("href"), "jobs.html", "age " + age + " jobs plain");
  }
});

test("permit: links inside the result card keep their own query", async () => {
  const p = await loadPage("permit.html", { search: "?state=ga&age=16&kind=job" }); await tick();
  const card = p.document.getElementById("pOut");
  const cardJobs = [...card.querySelectorAll('a[href^="jobs.html"]')];
  assert.ok(cardJobs.length > 0, "the answer card has a jobs link");
  for (const a of cardJobs) assert.doesNotMatch(a.getAttribute("href"), /state=/, "card jobs link not rewritten: " + a.getAttribute("href"));
});

test("permit: clearing the pickers returns the next-step links to plain hrefs and they still resolve", async () => {
  const p = await loadPage("permit.html", { search: "?state=il&age=15" }); await tick();
  let { interview, jobs } = links(p.document);
  assert.equal(interview.getAttribute("href"), "interview.html?state=il&age=15");
  assert.equal(jobs[0].getAttribute("href"), "jobs.html?state=il&age=15");
  type(p.window, p.document.getElementById("pState"), "");
  type(p.window, p.document.getElementById("pAge"), "");
  await tick();
  ({ interview, jobs } = links(p.document));
  assert.equal(interview.getAttribute("href"), "interview.html");
  assert.equal(jobs[0].getAttribute("href"), "jobs.html");
  assertBuiltPage(interview.getAttribute("href"), "interview.html");
  assertBuiltPage(jobs[0].getAttribute("href"), "jobs.html");
  assert.deepEqual(p.errors, []);
});
