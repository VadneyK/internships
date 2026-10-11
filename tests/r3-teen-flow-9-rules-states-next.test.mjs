// Ticket r3-teen-flow-9: rules.html and states.html end with a "Your next step" block.
// One primary button goes to permit.html, and a plain line links ready.html.
// Run with: node --test tests/r3-teen-flow-9-rules-states-next.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DASHES = /[\u2013\u2014]/;

for (const file of ["rules.html", "states.html"]) {
  test(`${file}: one section.nextstep#next-step with the h2 Your next step and one primary button to permit.html`, async () => {
    const { document, errors } = await loadPage(file);
    assert.deepEqual(errors, []);
    const steps = document.querySelectorAll("section.nextstep#next-step");
    assert.equal(steps.length, 1, "exactly one next-step block");
    const step = steps[0];
    assert.equal(step.querySelector("h2").textContent.trim(), "Your next step");

    const buttons = step.querySelectorAll("a.btn");
    assert.equal(buttons.length, 1, "exactly one a.btn");
    assert.equal(buttons[0].classList.contains("alt"), false, "the button is primary, not alt");
    assert.equal(buttons[0].getAttribute("href"), "permit.html");
    assert.ok(fs.existsSync(path.join(ROOT, "permit.html")), "permit.html is a built page");
  });

  test(`${file}: the next step is the last section in main and has a plain link to ready.html`, async () => {
    const { document } = await loadPage(file);
    const sections = [...document.querySelectorAll("main > section")];
    assert.equal(sections[sections.length - 1].id, "next-step");

    const step = document.getElementById("next-step");
    const plainLinks = [...step.querySelectorAll("a[href]")].filter((a) => !a.classList.contains("btn"));
    const ready = plainLinks.find((a) => a.getAttribute("href") === "ready.html");
    assert.ok(ready, "a plain (non-button) link to ready.html");
    assert.ok(fs.existsSync(path.join(ROOT, "ready.html")), "ready.html is a built page");
  });

  test(`${file}: the next step block has no en dash or em dash`, async () => {
    const { document } = await loadPage(file);
    assert.equal(DASHES.test(document.getElementById("next-step").textContent), false);
  });
}
