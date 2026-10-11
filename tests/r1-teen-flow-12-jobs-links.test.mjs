// Ticket r1-teen-flow-12-jobs-links: "Jobs that hire teens" is linked from Home (hero Jump to row)
// and from the Programs related chips, and the related chip carries ?age=<n> only for ages 12 to 18.
// Run with: node --test tests/r1-teen-flow-12-jobs-links.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const JOBS_LABEL = "Jobs that hire teens";

function jobsChips(document, selector) {
  return [...document.querySelectorAll(selector)].filter((a) => a.textContent.trim() === JOBS_LABEL);
}

test("r1-teen-flow-12-jobs-links: Home hero Jump to row has a Jobs that hire teens link to jobs.html", async () => {
  const { document, errors } = await loadPage("index.html");
  await tick(120);
  const chips = jobsChips(document, "section.hero nav[aria-label='Jump to'] a");
  assert.equal(chips.length, 1, "one Jobs that hire teens chip in the hero Jump to row");
  assert.equal(chips[0].getAttribute("href"), "jobs.html", "the chip goes to jobs.html with no query");
  assert.deepEqual(errors, [], "no script errors on Home");
});

test("r1-teen-flow-12-jobs-links: Programs related chips add Jobs that hire teens with no query when no age is picked", async () => {
  const { document, errors } = await loadPage("find.html");
  await tick(120);
  const chips = jobsChips(document, "#relatedLinks a");
  assert.equal(chips.length, 1, "one Jobs that hire teens chip in #relatedLinks");
  assert.equal(chips[0].getAttribute("href"), "jobs.html", "no age picked, so no query");
  assert.deepEqual(errors, [], "no script errors on Programs");
});

test("r1-teen-flow-12-jobs-links: the related chip carries the age for 15 from the URL", async () => {
  const { document, errors } = await loadPage("find.html", { search: "?age=15" });
  await tick(120);
  const chip = jobsChips(document, "#relatedLinks a")[0];
  assert.ok(chip, "chip exists");
  assert.equal(chip.getAttribute("href"), "jobs.html?age=15");
  assert.deepEqual(errors, [], "no script errors on Programs");
});

test("r1-teen-flow-12-jobs-links: the related chip carries the age for 12 and 13 as well", async () => {
  for (const age of ["12", "13"]) {
    const { document } = await loadPage("find.html", { search: "?age=" + age });
    await tick(60);
    const chip = jobsChips(document, "#relatedLinks a")[0];
    assert.equal(chip.getAttribute("href"), "jobs.html?age=" + age, "age " + age + " carried");
  }
});

test("r1-teen-flow-12-jobs-links: picking an age in the picker updates the Jobs chip, and clearing it removes the query", async () => {
  const { document, window, errors } = await loadPage("find.html");
  await tick(120);
  const age = document.getElementById("age");
  age.value = "17";
  age.dispatchEvent(new window.Event("change", { bubbles: true }));
  await tick(60);
  assert.equal(jobsChips(document, "#relatedLinks a")[0].getAttribute("href"), "jobs.html?age=17");

  age.value = "";
  age.dispatchEvent(new window.Event("change", { bubbles: true }));
  await tick(60);
  assert.equal(jobsChips(document, "#relatedLinks a")[0].getAttribute("href"), "jobs.html", "back to no query");
  assert.deepEqual(errors, [], "no script errors on Programs");
});
