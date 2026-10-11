// Ticket r3-a11y-perf-5: the two scroll actions honor prefers-reduced-motion, and move focus to what they scrolled to.
// find.js ("See card" jump) and playbook.js ("Write to them") used behavior "smooth" in JavaScript, which ignores the CSS
// scroll-behavior rule. Each now uses G.motionOK(), and each focuses its target (card or message box).
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

// matchMedia stub: reduce matches only when asked. Runs before the page scripts (dom-helper keeps an existing matchMedia).
function motionSetup(reduce) {
  return (w) => {
    w.matchMedia = (q) => ({
      matches: reduce && q === "(prefers-reduced-motion: reduce)",
      media: q,
      addEventListener() {},
      removeEventListener() {},
    });
  };
}

// Record every scrollIntoView call on Element and HTMLElement (dom-helper stubs HTMLElement, which shadows Element).
function spyScroll(window) {
  const calls = [];
  const spy = function (opts) { calls.push({ el: this, opts }); };
  window.Element.prototype.scrollIntoView = spy;
  window.HTMLElement.prototype.scrollIntoView = spy;
  return calls;
}

test("find: See card with reduced motion scrolls without smooth and focuses the card", async () => {
  const { window, document, errors } = await loadPage("find.html", { setup: motionSetup(true) });
  type(window, document.getElementById("age"), "16");
  await tick(60);
  const jump = document.querySelector("#picksList [data-jump]");
  assert.ok(jump, "a pick with a See card link is shown for age 16");
  const calls = spyScroll(window);
  jump.click();
  await tick();
  const card = document.getElementById("p-" + jump.getAttribute("data-jump"));
  const hit = calls.find((c) => c.el === card);
  assert.ok(hit, "the card was scrolled to");
  assert.notEqual(hit.opts && hit.opts.behavior, "smooth");
  assert.equal(document.activeElement, card, "focus is on the card");
  assert.equal(card.getAttribute("tabindex"), "-1");
  assert.deepEqual(errors, []);
});

test("find: See card without reduced motion still scrolls smooth", async () => {
  const { window, document } = await loadPage("find.html", { setup: motionSetup(false) });
  type(window, document.getElementById("age"), "16");
  await tick(60);
  const jump = document.querySelector("#picksList [data-jump]");
  assert.ok(jump);
  const calls = spyScroll(window);
  jump.click();
  await tick();
  const card = document.getElementById("p-" + jump.getAttribute("data-jump"));
  const hit = calls.find((c) => c.el === card);
  assert.ok(hit, "the card was scrolled to");
  assert.equal(hit.opts.behavior, "smooth");
  assert.equal(document.activeElement, card);
});

test("playbook: Write to them with reduced motion scrolls without smooth and focuses the message box", async () => {
  const { window, document, errors } = await loadPage("playbook.html", { setup: motionSetup(true) });
  type(window, document.getElementById("pn0"), "Mrs. Lee");
  type(window, document.getElementById("ph0"), "my friend's mom");
  const calls = spyScroll(window);
  document.querySelector('[data-write="0"]').click();
  const msg = document.getElementById("message");
  const hit = calls.find((c) => c.el === msg);
  assert.ok(hit, "the message box was scrolled to");
  assert.notEqual(hit.opts && hit.opts.behavior, "smooth");
  assert.equal(document.activeElement, msg, "focus is on the message box");
  assert.equal(msg.getAttribute("tabindex"), "-1");
  assert.deepEqual(errors, []);
});

test("playbook: Write to them without reduced motion still scrolls smooth", async () => {
  const { window, document } = await loadPage("playbook.html", { setup: motionSetup(false) });
  type(window, document.getElementById("pn0"), "Mrs. Lee");
  type(window, document.getElementById("ph0"), "my friend's mom");
  const calls = spyScroll(window);
  document.querySelector('[data-write="0"]').click();
  const msg = document.getElementById("message");
  const hit = calls.find((c) => c.el === msg);
  assert.ok(hit);
  assert.equal(hit.opts.behavior, "smooth");
});
