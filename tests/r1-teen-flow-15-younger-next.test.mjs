// Ticket r1-teen-flow-6: younger.html ends with one "Your next step" block with a single button to find.html.
// Run with: node --test tests/r1-teen-flow-15-younger-next.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, tick } from "./dom-helper.mjs";

test("younger: a section.nextstep#next-step with the h2 Your next step and one primary button", async () => {
  const { document, errors } = await loadPage("younger.html");
  await tick(120);
  assert.deepEqual(errors, []);
  const step = document.querySelector("section.nextstep#next-step");
  assert.ok(step, "section.nextstep#next-step exists");
  assert.equal(document.querySelectorAll("#next-step").length, 1, "one next-step block");
  assert.equal(step.querySelector("h2").textContent.trim(), "Your next step");

  const buttons = step.querySelectorAll("a.btn");
  assert.equal(buttons.length, 1, "exactly one primary button");
  assert.equal(buttons[0].textContent.trim(), "See programs that take your age");
});

test("younger: the next step button goes to find.html with age 13 (the page picks no age, so 13 is the default)", async () => {
  const { document } = await loadPage("younger.html");
  const btn = document.querySelector("section.nextstep#next-step a.btn");
  const href = btn.getAttribute("href");
  assert.equal(href, "find.html?age=13");
  const url = new URL(href, "https://example.test/younger.html");
  assert.equal(url.pathname, "/find.html");
  assert.equal(url.searchParams.get("age"), "13");
});

test("younger: the next step block is the last section in main, after the money section", async () => {
  const { document } = await loadPage("younger.html");
  const sections = [...document.querySelectorAll("main > section")];
  assert.equal(sections[sections.length - 1].id, "next-step");
  assert.ok(document.getElementById("money"), "money section still exists");
  assert.ok(document.getElementById("yNext"), "existing Next paragraph stays");
  assert.ok(document.getElementById("money").compareDocumentPosition(document.getElementById("next-step")) & 4, "next step comes after money");
});
