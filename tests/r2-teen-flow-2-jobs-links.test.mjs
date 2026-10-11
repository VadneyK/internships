// Ticket r2-teen-flow-2: the "no job yet" lines on Paycheck, Playbook and Calendar link to jobs.html
// outside the header and footer. Resume's Next steps chip is not covered here yet: its existing test
// (tests/r3-teen-flow-7.test.mjs) pins exactly four links in #next and must be updated first.
// Run with: node --test tests/r2-teen-flow-2-jobs-links.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const DASHES = /[\u2013\u2014]/;
const PAGES = ["paycheck.html", "playbook.html", "calendar.html"];

for (const file of PAGES) {
  test(file + ": has an a[href='jobs.html'] outside the header and footer", async () => {
    const { document, errors } = await loadPage(file);
    await tick(120);
    assert.deepEqual(errors, []);
    const links = [...document.querySelectorAll("a[href='jobs.html']")].filter(
      (a) => !a.closest("header") && !a.closest("footer")
    );
    assert.ok(links.length >= 1, file + " links to jobs.html in the body");
  });
}

test("paycheck: the no job yet line links jobs.html next to Browse programs", async () => {
  const { document } = await loadPage("paycheck.html");
  const line = document.getElementById("mNext");
  const hrefs = [...line.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.ok(hrefs.includes("find.html"), "Browse programs stays");
  assert.ok(hrefs.includes("jobs.html"), "jobs.html is added");
});

test("playbook: the No one comes to mind line links find.html and jobs.html", async () => {
  const { document } = await loadPage("playbook.html");
  const line = [...document.querySelectorAll("#map p")].find((p) => /No one comes to mind yet/.test(p.textContent));
  assert.ok(line, "the paragraph is in the people map");
  const hrefs = [...line.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.ok(hrefs.includes("find.html"), "find.html stays");
  assert.ok(hrefs.includes("jobs.html"), "jobs.html is added");
});

test("calendar: the calNext line has a regular job sentence linking jobs.html", async () => {
  const { document } = await loadPage("calendar.html");
  await tick(120);
  const line = document.getElementById("calNext");
  const link = [...line.querySelectorAll("a")].find((a) => a.getAttribute("href") === "jobs.html");
  assert.ok(link, "jobs.html link in #calNext");
  assert.match(line.textContent, /Want a regular job instead\? See jobs that hire teens\./);
});

test("jobs links on these pages have no en or em dash", async () => {
  for (const file of PAGES) {
    const { document } = await loadPage(file);
    for (const a of document.querySelectorAll("a[href='jobs.html']")) {
      assert.equal(DASHES.test(a.closest("p, li, section")?.textContent || ""), false, file);
    }
  }
});
