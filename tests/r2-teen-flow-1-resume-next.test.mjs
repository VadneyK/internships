// Ticket r2-teen-flow-1: resume.html ends with one "Your next step" block with a single button to interview.html.
// The other teen pages already end with section.nextstep#next-step; this checks they still do.
// Run with: node --test tests/r2-teen-flow-1-resume-next.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

const DASHES = /[\u2013\u2014]/;

test("resume: one section.nextstep#next-step with the h2 Your next step, one sentence and one button to interview.html", async () => {
  const { document, errors } = await loadPage("resume.html");
  assert.deepEqual(errors, []);
  const steps = document.querySelectorAll("section.nextstep#next-step");
  assert.equal(steps.length, 1, "exactly one next-step block");
  const step = steps[0];
  assert.equal(step.querySelector("h2").textContent.trim(), "Your next step");

  const paragraphs = [...step.querySelectorAll("p")].filter((p) => !p.querySelector("a.btn"));
  assert.equal(paragraphs.length, 1, "one plain sentence");
  assert.ok(paragraphs[0].textContent.trim().length > 0, "the sentence is not empty");

  const buttons = step.querySelectorAll("a.btn");
  assert.equal(buttons.length, 1, "exactly one a.btn");
  assert.equal(buttons[0].getAttribute("href"), "interview.html");
});

test("resume: the next step block is the last section in main, right before the footer", async () => {
  const { document } = await loadPage("resume.html");
  const sections = [...document.querySelectorAll("main > section")];
  assert.equal(sections[sections.length - 1].id, "next-step");
  const main = document.querySelector("main");
  const footer = document.querySelector("footer.foot");
  assert.ok(main.contains(document.getElementById("next-step")), "next step is inside main");
  assert.ok(footer, "footer exists");
  assert.ok(document.getElementById("next-step").compareDocumentPosition(footer) & 4, "footer comes after next step");
});

test("resume: the next step block has no en dash or em dash", async () => {
  const { document } = await loadPage("resume.html");
  const text = document.getElementById("next-step").textContent;
  assert.equal(DASHES.test(text), false, "no en or em dash in the block");
});

test("teen pages: each one ends with section.nextstep#next-step", async () => {
  const pages = ["find.html", "calendar.html", "interview.html", "jobs.html", "paycheck.html", "permit.html", "playbook.html", "ready.html", "safety.html", "younger.html", "resume.html"];
  for (const file of pages) {
    const { document } = await loadPage(file);
    const sections = [...document.querySelectorAll("main > section")];
    const last = sections[sections.length - 1];
    assert.ok(last, file + " has sections");
    assert.equal(last.id, "next-step", file + " ends with #next-step");
    assert.ok(last.classList.contains("nextstep"), file + " last section has class nextstep");
  }
});
