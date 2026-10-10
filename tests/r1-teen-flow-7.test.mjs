// Ticket r1-teen-flow-7: Paycheck gets a closed "Words you will see" box right after the On this page chips.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

const TERMS = ["Withhold", "W-4", "Exempt", "Social Security and Medicare"];

test("r1-teen-flow-7: paycheck has one closed Words box right after the On this page nav", async () => {
  const { document, errors } = await loadPage("paycheck.html");
  await tick(120);

  const boxes = document.querySelectorAll("#words");
  assert.equal(boxes.length, 1, "exactly one #words element");
  const box = boxes[0];
  assert.equal(box.tagName, "DETAILS", "#words is a details element");
  assert.ok(box.classList.contains("callout") && box.classList.contains("plain") && box.classList.contains("small"), "callout plain small classes");
  assert.equal(box.hasAttribute("open"), false, "closed by default");
  assert.equal(box.querySelector(":scope > summary").textContent.trim(), "Words you will see");

  const nav = document.querySelector('nav.chips[aria-label="On this page"]');
  assert.ok(nav, "On this page nav exists");
  assert.equal(nav.nextElementSibling, box, "the Words box comes right after the nav");

  assert.deepEqual(errors, [], "no script errors on the page");
});

test("r1-teen-flow-7: the Words box has exactly four plain terms, each with a short definition", async () => {
  const { document } = await loadPage("paycheck.html");
  await tick(120);

  const box = document.getElementById("words");
  const dts = [...box.querySelectorAll("dt")].map((d) => d.textContent.trim());
  assert.deepEqual(dts, TERMS, "four dt terms with the exact names, in order");

  const dds = [...box.querySelectorAll("dd")];
  assert.equal(dds.length, TERMS.length, "one dd per term");
  for (const dd of dds) {
    const words = dd.textContent.trim().split(/\s+/).filter(Boolean).length;
    assert.ok(words > 0 && words < 35, `dd has ${words} words: ${dd.textContent.trim()}`);
  }
});

test("r1-teen-flow-7: each term also appears in the main page text outside the Words box", async () => {
  const { document } = await loadPage("paycheck.html");
  await tick(200);

  const main = document.querySelector("main");
  assert.ok(main, "page has a main element");
  const clone = main.cloneNode(true);
  clone.querySelector("#words")?.remove();
  const text = clone.textContent.toLowerCase();
  for (const term of TERMS) {
    assert.ok(text.includes(term.toLowerCase()), `"${term}" appears in main text outside #words`);
  }
});

test("r1-teen-flow-7: no em dash or en dash in the Words box or on the page", async () => {
  const { document } = await loadPage("paycheck.html");
  await tick(200);

  const dash = /[\u2013\u2014]/;
  assert.doesNotMatch(document.getElementById("words").textContent, dash, "no dash in the Words box");
  assert.doesNotMatch(document.body.textContent, dash, "no dash anywhere on the page");
});
