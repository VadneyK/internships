// Playbook: picking a person from the select must not move keyboard focus away (WCAG 3.2.2 On Input).
// A change event fires on every arrow key in the select, so the select keeps focus and only the fields and message update.
// The Write to them button still moves focus to the message, then to the next empty field.
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

// jsdom runs the page on its own timers, so the 350 ms focus jump is waited out with a real 1000 ms pause.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTwoPeople() {
  const page = await loadPage("playbook.html");
  const { window, document } = page;
  type(window, document.getElementById("pn0"), "Mrs. Lee");
  type(window, document.getElementById("pw0"), "dentist");
  type(window, document.getElementById("pn1"), "Mr. Park");
  type(window, document.getElementById("pw1"), "coach");
  await tick();
  return page;
}

test("playbook select: picking a person keeps focus on the select and fills the fields", async () => {
  const { window, document } = await withTwoPeople();
  const sel = document.getElementById("fToSel");
  sel.focus();
  assert.equal(document.activeElement, sel);

  const focusCalls = [];
  const realFocus = window.HTMLElement.prototype.focus;
  window.HTMLElement.prototype.focus = function (...args) {
    focusCalls.push(this);
    return realFocus.apply(this, args);
  };
  try {
    for (const [value, name] of [["0", "Mrs. Lee"], ["1", "Mr. Park"]]) {
      sel.value = value;
      sel.dispatchEvent(new window.Event("change", { bubbles: true }));
      await wait(1000);
      assert.equal(document.activeElement, sel, `focus stays on the select after picking ${name}`);
      assert.equal(document.getElementById("fTo").value, name);
      assert.match(document.getElementById("message").textContent, new RegExp(name.replace(/[.]/g, "\\.")));
    }
  } finally {
    window.HTMLElement.prototype.focus = realFocus;
  }
  const strayFocus = focusCalls.filter((el) => el !== sel);
  assert.equal(strayFocus.length, 0, "no focus() call on another element during select changes");
});

test("playbook Write to them button: focus lands on the message, then the next empty field", async () => {
  const { document } = await withTwoPeople();
  document.querySelector('[data-write="0"]').click();
  await tick();
  assert.equal(document.activeElement, document.getElementById("message"));
  await wait(1000);
  const next = ["fMe", "fGrade", "fSchool", "fHow", "fCurious"].filter((id) => !document.getElementById(id).value.trim())[0] || "fCurious";
  assert.equal(document.activeElement, document.getElementById(next));
  assert.equal(document.getElementById("fTo").value, "Mrs. Lee");
});
