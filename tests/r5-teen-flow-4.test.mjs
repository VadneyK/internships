// Run with: node --test tests/r5-teen-flow-4.test.mjs
// Playbook ends with one "Your next step" block that links to resume.html.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

test("playbook: ends with one Your next step block with a single button to resume.html", async () => {
  const { document, errors } = await loadPage("playbook.html");
  assert.deepEqual(errors, []);
  const step = document.querySelector("section.nextstep#next-step");
  assert.ok(step, "section.nextstep#next-step exists");
  assert.equal(step.querySelector("h2").textContent.trim(), "Your next step");
  assert.equal(step.querySelectorAll("p").length - step.querySelectorAll("p a.btn").length, 1, "one plain sentence");
  const buttons = step.querySelectorAll("a.btn");
  assert.equal(buttons.length, 1, "exactly one a.btn");
  assert.equal(buttons[0].getAttribute("href"), "resume.html");
});

test("playbook: the next step section is the last section before the footer", async () => {
  const { document } = await loadPage("playbook.html");
  const sections = [...document.querySelectorAll("main section, body section")];
  assert.equal(sections[sections.length - 1].id, "next-step");
  const footer = document.querySelector("footer");
  if (footer) {
    const after = document.querySelector("#next-step").compareDocumentPosition(footer);
    assert.ok(after & 4, "footer comes after the next step block");
  }
});
