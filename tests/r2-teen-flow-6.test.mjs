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
    ["#earn", "Work near home"],
    ["#grid", "1. At my age"],
    ["#safety", "2. Stay safe"],
    ["#ladder", "3. Path to a job"],
    ["#money", "4. Money facts"],
    ["#words", "Words you will see"],
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
      assert.equal(a.getAttribute("style"), null, "ux9-quiet-cards: chip links carry no inline style; a.chip { text-decoration: none } lives in style.css");
      const href = a.getAttribute("href") || "";
      assert.equal(href, expected[i][0], "href matches the section id");
      assert.equal(a.textContent.trim(), expected[i][1], "label matches the ticket");
      assert.match(href, /^#/, href + " should be a fragment link");
      assert.ok(document.getElementById(href.slice(1)), "no element with id " + href.slice(1));
    });

    assert.deepEqual(errors, [], "no script errors on the page");
  });
}

// Ticket r2-teen-flow-6 (Jobs and Ages 12 to 14): the permit page gets a closed "Words you will see" box.
test("r2-teen-flow-6: permit.html has a closed Words you will see box with its terms", async () => {
  const { document } = await loadPage("permit.html");
  await tick(120);
  const boxes = document.querySelectorAll("details#words");
  assert.equal(boxes.length, 1);
  const box = boxes[0];
  assert.equal(box.querySelector("summary").textContent.trim(), "Words you will see");
  assert.equal(box.open, false, "closed by default");
  const text = document.body.textContent;
  for (const term of ["Non-farm job", "Hazardous job", "Withhold", "W-4"]) {
    assert.ok([...box.querySelectorAll("dt")].some((d) => d.textContent.trim() === term), term);
    assert.ok(text.includes(term), term + " in page text");
  }
  assert.doesNotMatch(box.textContent, /[\u2013\u2014]/, "no dash characters");
});
