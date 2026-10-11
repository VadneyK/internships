// Ticket r3-teen-flow-5: Safe at work has a closed "Words you will see" box, like the Paycheck page.
// Run with: node --test tests/r3-teen-flow-5.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const TERMS = ["OSHA", "EEOC", "Harassment", "Retaliation", "Workers' compensation"];

test("r3-teen-flow-5: the words box exists, is closed on load, and defines the five terms", async () => {
  const { document, errors } = await loadPage("safety.html");
  const box = document.getElementById("words");
  assert.ok(box, "#words exists");
  assert.equal(box.tagName, "DETAILS");
  assert.equal(box.classList.contains("callout") && box.classList.contains("plain") && box.classList.contains("small"), true);
  assert.equal(box.hasAttribute("open"), false, "closed on load");
  assert.equal(box.querySelector("summary").textContent.trim(), "Words you will see");
  assert.deepEqual([...box.querySelectorAll("dt")].map((d) => d.textContent.trim()), TERMS);
  assert.ok(box.querySelectorAll("dd").length === TERMS.length, "one definition per term");
  assert.deepEqual(errors, []);
});

test("r3-teen-flow-5: every term in the words box also appears elsewhere on the page", async () => {
  const { document } = await loadPage("safety.html");
  const clone = document.body.cloneNode(true);
  clone.querySelector("#words").remove();
  const rest = clone.textContent.toLowerCase();
  for (const term of TERMS) {
    assert.ok(rest.includes(term.toLowerCase()), term + " appears outside the words box");
  }
});

test("r3-teen-flow-5: a chip on the page links to the words box", async () => {
  const { document } = await loadPage("safety.html");
  const chip = [...document.querySelectorAll("nav.chips a")].find((a) => a.getAttribute("href") === "#words");
  assert.ok(chip, "chip links to #words");
  assert.ok(document.getElementById("words"));
});

test("r3-teen-flow-5: the built safety.html has the same words box as the template, and no dashes", () => {
  const src = fs.readFileSync(new URL("../src/safety.html", import.meta.url), "utf8");
  const out = fs.readFileSync(new URL("../safety.html", import.meta.url), "utf8");
  const block = (text) => text.match(/<details id="words"[\s\S]*?<\/details>/)?.[0];
  assert.ok(block(src), "template has the box");
  assert.equal(block(out), block(src), "build output matches the template");
  for (const [name, text] of [["src/safety.html", src], ["safety.html", out]]) {
    assert.equal(/[\u2013\u2014]/.test(text), false, name + " has no en or em dash");
  }
});
