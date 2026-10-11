// Ticket r1-teen-flow-2: the Ages 12 to 14 page links to Jobs under 14 and to What opens when (calendar).
// Run with: node --test tests/r9-teen-flow-2-younger-jobs-link.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("younger: a link to jobs.html?age=u14 sits in the body, outside the footer", async () => {
  const { document, errors } = await loadPage("younger.html");
  await tick(120);
  assert.deepEqual(errors, []);
  const links = [...document.querySelectorAll('body a[href="jobs.html?age=u14"]')].filter((a) => !a.closest(".foot"));
  assert.equal(links.length >= 1, true, "a body link to jobs.html?age=u14 outside .foot");
});

test("younger: a link to calendar.html sits in the body, outside the footer", async () => {
  const { document } = await loadPage("younger.html");
  const links = [...document.querySelectorAll('body a[href="calendar.html"]')].filter((a) => !a.closest(".foot"));
  assert.equal(links.length >= 1, true, "a body link to calendar.html outside .foot");
});

test("younger: the u14 value in the Jobs link is one the Jobs age picker accepts", async () => {
  const { document: younger } = await loadPage("younger.html");
  const href = [...younger.querySelectorAll('body a[href^="jobs.html?age="]')].find((a) => !a.closest(".foot")).getAttribute("href");
  const age = new URL(href, "https://example.test/younger.html").searchParams.get("age");
  assert.equal(age, "u14");

  const { document: jobs } = await loadPage("jobs.html");
  await tick(120);
  const values = [...jobs.querySelectorAll("#jAge option")].map((o) => o.value);
  assert.ok(values.includes(age), "jobs.html #jAge options include " + age + ": " + values.join(", "));
});
