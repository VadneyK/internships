// Ticket r2-teen-flow-6: Interview, Paycheck and Younger get an "On this page" chip row, like Get ready.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const PAGES = {
  "interview.html": [
    ["#availability", "1. Days and hours"],
    ["#practice", "2. Practice questions"],
    ["#ask", "3. Ask and bring"],
    ["#references", "4. References"],
    ["#thanks", "5. Thank-you note"],
  ],
  "paycheck.html": [
    ["#est", "1. Estimate"],
    ["#forms", "2. Tax forms"],
    ["#wrong", "3. Late or wrong pay"],
    ["#bank", "4. Where it goes"],
  ],
  "younger.html": [
    ["#grid", "1. At my age"],
    ["#safety", "2. Stay safe"],
    ["#ladder", "3. Path to a job"],
    ["#money", "4. Money facts"],
  ],
};

for (const [file, expected] of Object.entries(PAGES)) {
  test(`r2-teen-flow-6: ${file} has one On this page chip row with the expected links`, async () => {
    const { document, errors } = await loadPage(file);
    await tick(120);

    const navs = document.querySelectorAll('nav.chips[aria-label="On this page"]');
    assert.equal(navs.length, 1, "exactly one On this page nav");
    const nav = navs[0];

    const links = [...nav.querySelectorAll("a")];
    assert.equal(links.length, expected.length, "link count matches the ticket");
    links.forEach((a, i) => {
      assert.ok(a.classList.contains("chip"), "each link is a.chip");
      assert.equal(a.style.textDecoration, "none", "links have text-decoration:none");
      const href = a.getAttribute("href") || "";
      assert.equal(href, expected[i][0], "href matches the section id");
      assert.equal(a.textContent.trim(), expected[i][1], "label matches the ticket");
      assert.match(href, /^#/, href + " should be a fragment link");
      assert.ok(document.getElementById(href.slice(1)), "no element with id " + href.slice(1));
    });

    assert.deepEqual(errors, [], "no script errors on the page");
  });
}
