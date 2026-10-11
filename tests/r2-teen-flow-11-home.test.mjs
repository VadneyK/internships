// Ticket r2-home-1: home paying-job card follows the age, Canada line, no-adult line, deadline link.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadPage, type, tick } from "./dom-helper.mjs";

const src = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
const steps = (d) => [...d.querySelectorAll("#job-now ol li")];

test("r2-home-1: no age keeps the three steps and hides the Under 14 block", async () => {
  const { document } = await loadPage("index.html"); await tick(150);
  assert.equal(document.getElementById("jobYoung").hidden, true);
  assert.equal(steps(document)[0].querySelector("a").getAttribute("href"), "permit.html");
});

for (const age of ["12", "13"]) {
  test(`r2-home-1: age ${age} shows Under 14 button first and the neighbors line`, async () => {
    const { window, document } = await loadPage("index.html"); await tick(150);
    type(window, document.getElementById("pAge"), age); await tick(50);
    const y = document.getElementById("jobYoung");
    assert.equal(y.hidden, false);
    const a = y.querySelector("a.btn");
    assert.equal(a.textContent.trim(), "Under 14? Start here");
    assert.equal(a.getAttribute("href"), "younger.html");
    assert.match(y.textContent, /Federal law sets 14 as the minimum age for most non-farm jobs\. Your state can be stricter\./);
    assert.equal(document.querySelector("#job-now .card a.btn"), a, "first button in the card");
  });
}

test("r2-home-1: age 18 replaces step 1; changing back restores it", async () => {
  const { window, document } = await loadPage("index.html"); await tick(150);
  type(window, document.getElementById("pAge"), "18"); await tick(50);
  const s1 = steps(document)[0];
  assert.match(s1.textContent, /You are 18: no minor work permit\./);
  const a = s1.querySelector("a");
  assert.equal(a.textContent.trim(), "See employers that hire at 18");
  assert.equal(a.getAttribute("href"), "jobs.html?age=18");
  assert.equal(document.getElementById("jobYoung").hidden, true);
  assert.equal(steps(document).length, 3);
  type(window, document.getElementById("pAge"), "15"); await tick(50);
  assert.equal(steps(document)[0].querySelector("a").getAttribute("href"), "permit.html");
  assert.equal(document.getElementById("jobYoung").hidden, true);
});

test("r2-home-1: Canada line, no-adult line and calendar link are in the static page", () => {
  assert.match(src, /This guide covers the US and British Columbia, Canada\. Metro Vancouver is included\./);
  assert.match(src, /No adult to ask\? Ask a school counselor, teacher, coach or librarian\./);
  assert.match(src, /<a class="btn alt sm" href="calendar\.html">See every deadline by month<\/a>/);
});

test("r2-home-1: the deadline link stays when the data fails", async () => {
  const { document } = await loadPage("index.html", { now: Date.parse("2028-06-01T12:00:00Z") }); await tick(300);
  const a = document.querySelector("#soon a.btn");
  assert.equal(a.textContent.trim(), "See every deadline by month");
  assert.match(a.getAttribute("href"), /^calendar\.html/);
});
